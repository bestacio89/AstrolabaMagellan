using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using PilotageForfaits.Application.Exports;

namespace PilotageForfaits.Infrastructure.Excel;

/// <summary>
/// Écrit un classeur .xlsx (Office Open XML) sans bibliothèque externe.
/// Traduction de XlsxLite.write de la version de référence : mêmes styles (en-têtes bleus, titres, formats €, JH, %),
/// même mise en page (paysage, ajusté à la largeur), même retour à la ligne des textes longs.
/// </summary>
public sealed partial class EcrivainXlsx : IEcrivainClasseur
{
    private static readonly Dictionary<string, int> Styles = new()
    {
        ["plain"] = 0, ["h"] = 1, ["title"] = 2, ["pct"] = 3, ["eur"] = 4, ["jh"] = 5, ["date"] = 6, ["bpct"] = 7, ["beur"] = 8, ["bjh"] = 9,
        ["section"] = 10, ["eurc"] = 11, ["beurc"] = 12, ["wrap"] = 13,
    };

    public byte[] Ecrire(IReadOnlyList<Feuille> feuilles)
    {
        using var flux = new MemoryStream();
        using (var zip = new ZipArchive(flux, ZipArchiveMode.Create, leaveOpen: true))
        {
            Ajouter(zip, "[Content_Types].xml", TypesContenu(feuilles.Count));
            Ajouter(zip, "_rels/.rels", RelationsRacine);
            Ajouter(zip, "xl/workbook.xml", Classeur(feuilles));
            Ajouter(zip, "xl/_rels/workbook.xml.rels", RelationsClasseur(feuilles.Count));
            Ajouter(zip, "xl/styles.xml", FeuilleDeStyles);
            for (var i = 0; i < feuilles.Count; i++) Ajouter(zip, $"xl/worksheets/sheet{i + 1}.xml", FeuilleXml(feuilles[i]));
        }
        return flux.ToArray();
    }

    private static void Ajouter(ZipArchive zip, string nom, string contenu)
    {
        var entree = zip.CreateEntry(nom, CompressionLevel.Optimal);
        using var ecriture = new StreamWriter(entree.Open(), new UTF8Encoding(false));
        ecriture.Write(contenu);
    }

    private static string FeuilleXml(Feuille feuille)
    {
        var lignes = new StringBuilder();
        for (var r = 0; r < feuille.Lignes.Count; r++)
        {
            var ligne = feuille.Lignes[r];
            if (ligne is null) continue;
            var cellules = new StringBuilder();
            for (var c = 0; c < ligne.Count; c++)
            {
                var brute = ligne[c];
                if (brute is null || (brute is string s0 && s0.Length == 0)) continue;
                var o = brute as Cellule ?? new Cellule(brute);
                var reference = Colonne(c) + (r + 1).ToString(CultureInfo.InvariantCulture);
                if (o.V is null || (o.V is string vide && vide.Length == 0))
                {
                    if (o.Entete || o.Type is not null) cellules.Append($"<c r=\"{reference}\" s=\"{(o.Entete ? Styles["h"] : Styles["title"])}\"/>");
                    continue;
                }
                var style = Styles["plain"];
                if (o.Type == "title") style = Styles["title"];
                else if (o.Type == "section") style = Styles["section"];
                else if (o.Entete) style = Styles["h"];
                else if (o.Format is not null)
                    style = Styles.TryGetValue((o.Gras ? "b" : "") + o.Format, out var sg) ? sg : Styles.TryGetValue(o.Format, out var sf) ? sf : 0;
                else if (o.Gras) style = Styles["h"];

                var nombre = Nombre(o.V);
                var formule = o.Formule is null ? "" : $"<f>{Echapper(o.Formule)}</f>";
                if (nombre is not null)
                {
                    cellules.Append($"<c r=\"{reference}\" s=\"{style}\">{formule}<v>{nombre}</v></c>");
                    continue;
                }
                if (o.Formule is not null)
                {
                    // formule au résultat texte : valeur mémorisée de type « str »
                    cellules.Append($"<c r=\"{reference}\" s=\"{style}\" t=\"str\">{formule}<v>{Echapper(Convert.ToString(o.V, CultureInfo.InvariantCulture) ?? "")}</v></c>");
                    continue;
                }
                var texte = Convert.ToString(o.V, CultureInfo.InvariantCulture) ?? "";
                // texte plus long que sa colonne : retour à la ligne si c'est une colonne de texte (largeur ≥ 30)
                // ou si la cellule voisine est remplie (le texte ne peut pas déborder dessus, il serait coupé)
                var largeur = c < feuille.Colonnes.Count ? feuille.Colonnes[c] : 10;
                var suivante = c + 1 < ligne.Count ? ligne[c + 1] : null;
                var pleine = suivante is not null && !(suivante is string s1 && s1.Length == 0)
                    && !(suivante is Cellule cs && (cs.V is null || (cs.V is string s2 && s2.Length == 0)));
                // un texte saisi sur plusieurs lignes (commentaire d'une action…) garde ses retours à la ligne
                if (style == Styles["plain"] && ((texte.Length > largeur && (largeur >= 30 || pleine)) || texte.Contains('\n'))) style = Styles["wrap"];
                cellules.Append($"<c r=\"{reference}\" s=\"{style}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{Echapper(texte)}</t></is></c>");
            }
            lignes.Append($"<row r=\"{r + 1}\">{cellules}</row>");
        }
        var colonnes = string.Concat(feuille.Colonnes.Select((w, i) =>
            $"<col min=\"{i + 1}\" max=\"{i + 1}\" width=\"{w.ToString(CultureInfo.InvariantCulture)}\" customWidth=\"1\"/>"));
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
            "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetPr><pageSetUpPr fitToPage=\"1\"/></sheetPr>" +
            "<sheetViews><sheetView workbookViewId=\"0\" showGridLines=\"0\"/></sheetViews>" +
            (colonnes.Length > 0 ? $"<cols>{colonnes}</cols>" : "") +
            $"<sheetData>{lignes}</sheetData>" +
            "<pageMargins left=\"0.4\" right=\"0.4\" top=\"0.5\" bottom=\"0.5\" header=\"0.3\" footer=\"0.3\"/>" +
            "<pageSetup paperSize=\"9\" orientation=\"landscape\" fitToWidth=\"1\" fitToHeight=\"0\"/></worksheet>";
    }

    /// <summary>Valeur numérique écrite telle quelle dans la cellule (null si ce n'est pas un nombre).</summary>
    private static string? Nombre(object v) => v switch
    {
        decimal d => d.ToString(CultureInfo.InvariantCulture),
        int i => i.ToString(CultureInfo.InvariantCulture),
        long l => l.ToString(CultureInfo.InvariantCulture),
        double x when double.IsFinite(x) => x.ToString("R", CultureInfo.InvariantCulture),
        _ => null,
    };

    /// <summary>Lettre de colonne Excel : 0 → A, 25 → Z, 26 → AA.</summary>
    private static string Colonne(int index)
    {
        var n = index + 1;
        var s = "";
        while (n > 0)
        {
            var m = (n - 1) % 26;
            s = (char)('A' + m) + s;
            n = (n - 1) / 26;
        }
        return s;
    }

    private static string Echapper(string s) =>
        Controles().Replace(s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;"), "");

    [GeneratedRegex("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]")]
    private static partial Regex Controles();

    private static string Classeur(IReadOnlyList<Feuille> feuilles) =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
        "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>" +
        string.Concat(feuilles.Select((f, i) => $"<sheet name=\"{Echapper(NomFeuille(f.Nom)).Replace("\"", "&quot;")}\" sheetId=\"{i + 1}\" r:id=\"rId{i + 1}\"/>")) +
        "</sheets><calcPr calcId=\"191029\" fullCalcOnLoad=\"1\"/></workbook>";

    /// <summary>Nom d'onglet accepté par Excel : 31 caractères au plus, sans [ ] : * ? / \.</summary>
    private static string NomFeuille(string nom)
    {
        var propre = new string(nom.Where(c => "[]:*?/\\".IndexOf(c) < 0).ToArray());
        return propre.Length > 31 ? propre[..31] : propre;
    }

    private static string RelationsClasseur(int n) =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        string.Concat(Enumerable.Range(1, n).Select(i =>
            $"<Relationship Id=\"rId{i}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{i}.xml\"/>")) +
        $"<Relationship Id=\"rId{n + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>";

    private static string TypesContenu(int n) =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
        "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
        "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
        string.Concat(Enumerable.Range(1, n).Select(i =>
            $"<Override PartName=\"/xl/worksheets/sheet{i}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>")) +
        "</Types>";

    private const string RelationsRacine =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>";

    private const string FeuilleDeStyles =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
        "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">\n" +
        "<numFmts count=\"4\"><numFmt numFmtId=\"164\" formatCode=\"#,##0 &quot;€&quot;\"/><numFmt numFmtId=\"167\" formatCode=\"#,##0.00 &quot;€&quot;\"/><numFmt numFmtId=\"165\" formatCode=\"#,##0.00\"/><numFmt numFmtId=\"166\" formatCode=\"dd/mm/yyyy\"/></numFmts>\n" +
        "<fonts count=\"4\"><font><sz val=\"10\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"10\"/><color rgb=\"FFFFFFFF\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"14\"/><color rgb=\"FF1F3A5F\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"10\"/><name val=\"Calibri\"/></font></fonts>\n" +
        "<fills count=\"4\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF1F3A5F\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE3E9F2\"/></patternFill></fill></fills>\n" +
        "<borders count=\"2\"><border/><border><bottom style=\"thin\"><color rgb=\"FFC9D2DE\"/></bottom></border></borders>\n" +
        "<cellStyleXfs count=\"1\"><xf/></cellStyleXfs>\n" +
        "<cellXfs count=\"14\">\n" +
        "<xf fontId=\"0\" borderId=\"1\" applyBorder=\"1\"/>\n" +
        "<xf fontId=\"1\" fillId=\"2\" applyFont=\"1\" applyFill=\"1\"><alignment wrapText=\"1\" vertical=\"center\"/></xf>\n" +
        "<xf fontId=\"2\" applyFont=\"1\"/>\n" +
        "<xf numFmtId=\"10\" fontId=\"0\" borderId=\"1\" applyNumberFormat=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"164\" fontId=\"0\" borderId=\"1\" applyNumberFormat=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"165\" fontId=\"0\" borderId=\"1\" applyNumberFormat=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"166\" fontId=\"0\" borderId=\"1\" applyNumberFormat=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"10\" fontId=\"3\" borderId=\"1\" applyNumberFormat=\"1\" applyFont=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"164\" fontId=\"3\" borderId=\"1\" applyNumberFormat=\"1\" applyFont=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"165\" fontId=\"3\" borderId=\"1\" applyNumberFormat=\"1\" applyFont=\"1\" applyBorder=\"1\"/>\n" +
        "<xf fontId=\"3\" fillId=\"3\" applyFont=\"1\" applyFill=\"1\"/>\n" +
        "<xf numFmtId=\"167\" fontId=\"0\" borderId=\"1\" applyNumberFormat=\"1\" applyBorder=\"1\"/>\n" +
        "<xf numFmtId=\"167\" fontId=\"3\" borderId=\"1\" applyNumberFormat=\"1\" applyFont=\"1\" applyBorder=\"1\"/>\n" +
        "<xf fontId=\"0\" borderId=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment wrapText=\"1\" vertical=\"top\"/></xf>\n" +
        "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";
}
