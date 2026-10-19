using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Point hebdo (ou mensuel) : la diapositive de suivi delivery est fabriquée par l'écran à partir des indicateurs calculés ;
/// le serveur garde seulement ce que le chef de projet complète (actualités, points d'attention, indicateurs, météo),
/// période par période, et les réglages communs (équipe, mode de facturation, logos).
/// </summary>
public sealed class PointsHebdoService(SaisieOutils o)
{
    public const string CleReglages = "reglages";
    public static readonly IReadOnlySet<string> Indicateurs = new HashSet<string> { "planning", "qualite", "perimetre", "budget", "ressources", "facturation" };
    public static readonly IReadOnlySet<string> Niveaux = new HashSet<string> { "vert", "jaune", "rouge", "gris" };
    public static readonly IReadOnlySet<string> Meteos = new HashSet<string> { "soleil", "nuage", "orage" };
    public static readonly IReadOnlySet<string> Tendances = new HashSet<string> { "vert", "jaune", "rouge" };
    public static readonly IReadOnlySet<string> Reglages = new HashSet<string> { "commercial", "avv", "pilote", "modeFacturation", "logoClient", "logoEntreprise" };
    private const int MaxPoints = 15, MaxTexte = 300, MaxReglage = 200, MaxLogo = 1_000_000;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly Regex Logo = new(@"^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$", RegexOptions.CultureInvariant);

    /// <summary>Clé d'une semaine : « S: » suivi de son lundi.</summary>
    public static string CleSemaine(string lundi)
    {
        if (!DateOnly.TryParseExact(lundi, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) || d.DayOfWeek != DayOfWeek.Monday)
            throw new RegleMetierException("Semaine invalide : indiquez la date de son lundi (AAAA-MM-JJ).");
        return "S:" + lundi;
    }

    /// <summary>Clé d'un mois : « M:AAAA-MM ».</summary>
    public static string CleMois(string mois)
    {
        if (!DateOnly.TryParseExact(mois + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new RegleMetierException("Mois invalide (AAAA-MM).");
        return "M:" + mois;
    }

    /// <summary>Enregistre la saisie d'une période (elle remplace la précédente).</summary>
    public async Task<ResultatSaisieDto> EnregistrerAsync(Guid projetId, string cle, PointHebdoCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        string Meteo(MeteoPointHebdo? m, string quoi)
        {
            if (m is null) return "";
            if (!Meteos.Contains(m.Meteo ?? "") || !Tendances.Contains(m.Tendance ?? "")) throw new RegleMetierException($"{quoi} : météo ou tendance inconnue.");
            return m.Meteo!;
        }
        Meteo(c.Satisfaction, "Satisfaction client");
        Meteo(c.Esprit, "État d’esprit de l’équipe");
        var indicateurs = new Dictionary<string, IndicateurPointHebdo>();
        foreach (var (k, v) in c.Indicateurs ?? new())
        {
            if (!Indicateurs.Contains(k)) throw new RegleMetierException($"Indicateur inconnu : « {k} ».");
            if (!Niveaux.Contains(v?.S ?? "") || !Niveaux.Contains(v?.S1 ?? "")) throw new RegleMetierException($"Niveau inconnu pour l’indicateur « {k} ».");
            indicateurs[k] = v!;
        }
        if (c.Extension is not null and not "Oui" and not "Non") throw new RegleMetierException("Extension de périmètre : Oui ou Non.");
        var contenu = new JsonObject
        {
            ["actualites"] = Liste(c.Actualites, "Actualités"),
            ["attention"] = Liste(c.Attention, "Points d’attention"),
            ["indicateurs"] = JsonSerializer.SerializeToNode(indicateurs, Json),
            ["satisfaction"] = c.Satisfaction is null ? null : JsonSerializer.SerializeToNode(c.Satisfaction, Json),
            ["esprit"] = c.Esprit is null ? null : JsonSerializer.SerializeToNode(c.Esprit, Json),
            ["extension"] = c.Extension ?? "Non",
        };
        var ligne = await LigneAsync(projetId, cle, a);
        var maintenant = o.Horloge.Maintenant.UtcDateTime;
        // la date de génération du PowerPoint est gardée d'une saisie à l'autre
        var avant = JsonNode.Parse(ligne.Contenu) as JsonObject;
        var genereLe = c.Genere ? maintenant.ToString("o", CultureInfo.InvariantCulture) : avant?["genereLe"]?.GetValue<string>();
        if (genereLe is not null) contenu["genereLe"] = genereLe;
        ligne.Contenu = contenu.ToJsonString();
        ligne.MajLe = maintenant;
        ligne.ParId = u.Id;
        o.Noter(projetId, u, "Point hebdo", ligne.Id, Libelle(cle), null, c.Genere ? "PowerPoint généré" : "saisie");
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Modifie un réglage commun à toutes les périodes ; une valeur vide le retire.</summary>
    public async Task<ResultatSaisieDto> RegleAsync(Guid projetId, string champ, ReglagePointHebdoCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        if (!Reglages.Contains(champ)) throw new IntrouvableException("Réglage inconnu.");
        var valeur = SaisieOutils.Nettoyer(c.Valeur);
        if (champ.StartsWith("logo", StringComparison.Ordinal))
        {
            if (valeur.Length > MaxLogo) throw new RegleMetierException("Logo trop lourd : choisissez une image plus petite.");
            if (valeur.Length > 0 && !Logo.IsMatch(valeur)) throw new RegleMetierException("Logo invalide : image PNG ou JPEG attendue.");
        }
        else if (valeur.Length > MaxReglage) throw new RegleMetierException($"Texte trop long : {MaxReglage} caractères au maximum.");
        var ligne = await LigneAsync(projetId, CleReglages, a);
        var contenu = JsonNode.Parse(ligne.Contenu) as JsonObject ?? new JsonObject();
        if (valeur.Length == 0) contenu.Remove(champ); else contenu[champ] = valeur;
        ligne.Contenu = contenu.ToJsonString();
        ligne.MajLe = o.Horloge.Maintenant.UtcDateTime;
        ligne.ParId = u.Id;
        o.Noter(projetId, u, "Point hebdo", ligne.Id, champ.StartsWith("logo", StringComparison.Ordinal) ? "logo" : champ, null, champ.StartsWith("logo", StringComparison.Ordinal) ? (valeur.Length > 0 ? "modifié" : "retiré") : valeur);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Les points hebdo du projet, dans la forme lue par l'écran : { reglages: {…}, periodes: { "S:…": {…} } }.</summary>
    public static JsonObject Vue(IEnumerable<PointHebdo> lignes, IReadOnlyDictionary<Guid, string> noms)
    {
        var reglages = new JsonObject();
        var periodes = new JsonObject();
        foreach (var l in lignes.OrderBy(x => x.Cle, StringComparer.Ordinal))
        {
            if (JsonNode.Parse(l.Contenu) is not JsonObject c) continue;
            if (l.Cle == CleReglages) { reglages = c; continue; }
            c["majLe"] = new DateTimeOffset(DateTime.SpecifyKind(l.MajLe, DateTimeKind.Utc)).ToString("o", CultureInfo.InvariantCulture);
            c["par"] = l.ParId is { } p && noms.TryGetValue(p, out var nom) ? nom : "";
            periodes[l.Cle] = c;
        }
        return new JsonObject { ["reglages"] = reglages, ["periodes"] = periodes };
    }

    private async Task<PointHebdo> LigneAsync(Guid projetId, string cle, CancellationToken a)
    {
        var ligne = await o.Db.PointsHebdo.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Cle == cle, a);
        if (ligne is null)
        {
            ligne = new PointHebdo { ProjetId = projetId, Cle = cle };
            o.Db.PointsHebdo.Add(ligne);
        }
        return ligne;
    }

    private static JsonArray Liste(List<string>? l, string quoi)
    {
        var points = (l ?? new()).Select(SaisieOutils.Nettoyer).Where(x => x.Length > 0).ToList();
        if (points.Count > MaxPoints) throw new RegleMetierException($"{quoi} : {MaxPoints} points au maximum.");
        if (points.Any(x => x.Length > MaxTexte)) throw new RegleMetierException($"{quoi} : {MaxTexte} caractères au maximum par point.");
        return new JsonArray(points.Select(x => (JsonNode?)JsonValue.Create(x)).ToArray());
    }

    private static string Libelle(string cle) => cle.StartsWith("M:", StringComparison.Ordinal) ? $"point mensuel {cle[2..]}" : $"point hebdo du {cle[2..]}";
}
