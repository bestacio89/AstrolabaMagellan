using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Infrastructure.Excel;

/// <summary>
/// Lecture d'un classeur Excel (.xlsx / .xlsm) sans bibliothèque externe, comme dans la version de référence (xlsx-lite) :
/// un classeur est un ZIP qui contient des fichiers XML ; on lit les valeurs mémorisées des cellules
/// (les formules ne sont jamais recalculées). Même comportement que la version de référence, cellule par cellule.
/// </summary>
public sealed partial class ClasseurXlsx : IClasseur
{
    private const int Largeur = 20000; // clé d'une cellule = ligne × 20000 + colonne (comme la version de référence)
    private readonly Dictionary<string, string> _cheminParFeuille = new();
    private readonly Dictionary<string, FeuilleXlsx> _feuilles = new();
    private readonly List<string> _ordre = new();
    private readonly List<string> _chainesPartagees = new();
    private readonly Dictionary<string, byte[]> _fichiers;

    private ClasseurXlsx(Dictionary<string, byte[]> fichiers) => _fichiers = fichiers;

    public IReadOnlyList<string> NomsFeuilles => _ordre;

    /// <summary>Ouvre un classeur à partir de son contenu.</summary>
    /// <exception cref="TspInvalideException">Le fichier n'est pas un classeur Excel lisible.</exception>
    public static ClasseurXlsx Ouvrir(Stream flux)
    {
        Dictionary<string, byte[]> fichiers;
        try
        {
            using var zip = new ZipArchive(flux, ZipArchiveMode.Read, leaveOpen: true);
            fichiers = new Dictionary<string, byte[]>();
            foreach (var entree in zip.Entries)
            {
                // seuls les fichiers XML utiles sont lus (pas les images, ni les macros)
                if (!entree.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase) && !entree.FullName.EndsWith(".rels", StringComparison.OrdinalIgnoreCase)) continue;
                using var s = entree.Open();
                using var m = new MemoryStream();
                s.CopyTo(m);
                fichiers[entree.FullName] = m.ToArray();
            }
        }
        catch (InvalidDataException)
        {
            throw new TspInvalideException("Ce fichier n'est pas un classeur Excel valide (.xlsx / .xlsm).");
        }
        var classeur = new ClasseurXlsx(fichiers);
        classeur.LireStructure();
        return classeur;
    }

    private string? LireFichier(string nom) => _fichiers.TryGetValue(nom, out var octets) ? Encoding.UTF8.GetString(octets) : null;

    private void LireStructure()
    {
        var wbXml = LireFichier("xl/workbook.xml") ?? throw new TspInvalideException("Classeur Excel illisible : workbook.xml absent.");
        var relsXml = LireFichier("xl/_rels/workbook.xml.rels") ?? "";
        var rels = new Dictionary<string, string>();
        foreach (Match m in Relation().Matches(relsXml))
        {
            var id = Attribut(m.Groups[1].Value, "Id");
            if (id is not null) rels[id] = Attribut(m.Groups[1].Value, "Target") ?? "";
        }
        var ss = LireFichier("xl/sharedStrings.xml");
        if (ss is not null)
            foreach (Match m in ChainePartagee().Matches(ss)) _chainesPartagees.Add(TexteDesRuns(m.Groups[1].Value));
        foreach (Match m in FeuilleXml().Matches(wbXml))
        {
            var nom = Attribut(m.Groups[1].Value, "name") ?? "";
            var rid = Attribut(m.Groups[1].Value, "r:id") ?? "";
            var cible = rels.GetValueOrDefault(rid, "");
            cible = Regex.Replace(cible, @"^/?xl/", "");
            cible = Regex.Replace(cible, "^/", "");
            _ordre.Add(nom);
            _cheminParFeuille[nom] = "xl/" + cible;
        }
    }

    /// <summary>Feuille dont le nom correspond, sans tenir compte des accents, des espaces autour ni de la casse.</summary>
    public IFeuille? Feuille(string nom)
    {
        static string Normaliser(string s)
        {
            var d = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var c in d) if (c < '̀' || c > 'ͯ') sb.Append(c);
            return sb.ToString().Trim().ToUpperInvariant();
        }
        var trouve = _ordre.FirstOrDefault(n => Normaliser(n) == Normaliser(nom));
        if (trouve is null) return null;
        if (!_feuilles.TryGetValue(trouve, out var feuille))
        {
            feuille = new FeuilleXlsx(trouve, LireCellules(LireFichier(_cheminParFeuille[trouve]) ?? ""));
            _feuilles[trouve] = feuille;
        }
        return feuille;
    }

    private Dictionary<long, object?> LireCellules(string xml)
    {
        var cellules = new Dictionary<long, object?>();
        foreach (Match c in Cellule().Matches(xml))
        {
            var a = c.Groups[1].Value;
            var interieur = c.Groups[2].Success ? c.Groups[2].Value : "";
            var reference = Attribut(a, "r");
            if (reference is null) continue;
            var t = Attribut(a, "t");
            object? v;
            if (t == "inlineStr") v = TexteDesRuns(interieur);
            else
            {
                var vm = Valeur().Match(interieur);
                if (!vm.Success) continue; // formule sans valeur mémorisée : cellule ignorée
                var brut = DecoderXml(vm.Groups[1].Value);
                v = t switch
                {
                    "s" => int.TryParse(brut, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) && i >= 0 && i < _chainesPartagees.Count ? _chainesPartagees[i] : "",
                    "str" => brut,
                    "b" => brut == "1",
                    "e" => new ErreurExcel(brut),
                    _ => brut.Length == 0 ? null : double.TryParse(brut, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) ? n : double.NaN,
                };
            }
            var rm = ReferenceCellule().Match(reference);
            if (!rm.Success) continue;
            var ligne = long.Parse(rm.Groups[2].Value, CultureInfo.InvariantCulture) - 1;
            cellules[ligne * Largeur + IndexColonne(rm.Groups[1].Value)] = v;
        }
        return cellules;
    }

    private static int IndexColonne(string lettres)
    {
        var n = 0;
        foreach (var ch in lettres) n = n * 26 + (ch - 'A' + 1);
        return n - 1;
    }

    private static string? Attribut(string attributs, string nom)
    {
        var m = Regex.Match(attributs, "(?:^|\\s)" + Regex.Escape(nom) + "=\"([^\"]*)\"");
        return m.Success ? DecoderXml(m.Groups[1].Value) : null;
    }

    /// <summary>Concatène les morceaux de texte &lt;t&gt; en ignorant les annotations phonétiques &lt;rPh&gt;.</summary>
    private static string TexteDesRuns(string xml)
    {
        var propre = Phonetique().Replace(xml, "");
        var sb = new StringBuilder();
        foreach (Match m in MorceauTexte().Matches(propre)) sb.Append(DecoderXml(m.Groups[1].Value));
        return sb.ToString();
    }

    private static string DecoderXml(string s) => WebUtility.HtmlDecode(s);

    [GeneratedRegex("<Relationship\\b([^>]*)/?>")] private static partial Regex Relation();
    [GeneratedRegex("<si\\b[^>]*>([\\s\\S]*?)</si>")] private static partial Regex ChainePartagee();
    [GeneratedRegex("<sheet\\b([^>]*)/?>")] private static partial Regex FeuilleXml();
    [GeneratedRegex("<c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</c>)")] private static partial Regex Cellule();
    [GeneratedRegex("<v>([\\s\\S]*?)</v>")] private static partial Regex Valeur();
    [GeneratedRegex("^([A-Z]+)(\\d+)$")] private static partial Regex ReferenceCellule();
    [GeneratedRegex("<rPh\\b[\\s\\S]*?</rPh>")] private static partial Regex Phonetique();
    [GeneratedRegex("<t\\b[^>]*>([\\s\\S]*?)</t>")] private static partial Regex MorceauTexte();

    private sealed class FeuilleXlsx : IFeuille
    {
        private readonly Dictionary<long, object?> _cellules;

        public FeuilleXlsx(string nom, Dictionary<long, object?> cellules)
        {
            Nom = nom;
            _cellules = cellules;
            foreach (var cle in cellules.Keys)
            {
                var r = (int)(cle / Largeur);
                var c = (int)(cle % Largeur);
                if (r > MaxRow) MaxRow = r;
                if (c > MaxCol) MaxCol = c;
            }
        }

        public string Nom { get; }
        public int MaxRow { get; }
        public int MaxCol { get; }

        public object? G(int ligne, int colonne)
        {
            if (ligne < 0 || colonne < 0) return null;
            var v = _cellules.GetValueOrDefault((long)ligne * Largeur + colonne);
            return v is double d && double.IsNaN(d) ? null : v;
        }
    }
}
