using System.Text.RegularExpressions;

namespace PilotageForfaits.Domain.Commun;

/// <summary>
/// Listes et règles de base du métier, reprises de la version de référence (version HTML).
/// </summary>
public static class ReferentielsMetier
{
    public const string StatutAFaire = "À faire";
    public const string StatutEnCours = "En cours";
    public const string StatutBloque = "Bloqué / En attente";
    public const string StatutEnRecette = "En recette";
    public const string StatutValide = "Validé";
    public const string StatutAnnulee = "Annulée";

    /// <summary>Statuts qu'on peut choisir pour une tâche (« Annulée » se déduit d'une annulation).</summary>
    public static readonly IReadOnlyList<string> Statuts = [StatutAFaire, StatutEnCours, StatutBloque, StatutEnRecette, StatutValide];

    /// <summary>Anciens libellés de statut (fichiers enregistrés avant le 01/10/2026).</summary>
    public static readonly IReadOnlyDictionary<string, string> AliasStatut = new Dictionary<string, string>
    {
        ["A faire"] = StatutAFaire,
        ["Test"] = StatutEnRecette,
    };

    /// <summary>Valeurs d'avancement proposées (0 %, 25 %, 50 %, 75 %, 100 %).</summary>
    public static readonly IReadOnlyList<decimal> Avancements = [0m, 0.25m, 0.5m, 0.75m, 1m];

    public static readonly IReadOnlyList<string> IaLeviers =
    [
        "Rédaction et génération de livrables", "Analyse et synthèse de données", "Scripts, paramétrage, automatisation",
        "Tests et recette automatisés", "Recherche et veille", "Réutilisation d’un actif existant", "Autre",
    ];

    public static readonly IReadOnlyList<string> IaCauses =
    [
        "Qualité insuffisante, reprise manuelle", "Outil ou licence indisponible", "Données client inexploitables",
        "Montée en compétence", "Périmètre modifié", "Autre",
    ];

    public static readonly IReadOnlyList<string> AchatStatuts = ["Commandé", "Reçu", "Facturé"];
    public static readonly IReadOnlyList<string> FraisCategories = ["Transport", "Hébergement", "Repas", "Autre"];
    public static readonly IReadOnlyList<string> Entites = ["FO", "CESSION", "ACHAT", "BO", "ACHAT BO"];

    /// <summary>
    /// Probabilité (abscisse de la matrice) et importance (ordonnée) d'un risque sur 4 niveaux ; criticité = probabilité × importance (1 à 16).
    /// Le champ enregistré s'appelle toujours « impact » ; il s'affiche « Importance ».
    /// </summary>
    public static readonly IReadOnlyList<string> RisqueProbabilites = ["Faible", "Modérée", "Forte", "Très forte"];
    public static readonly IReadOnlyList<string> RisqueImpacts = ["Faible", "Moyenne", "Forte", "Critique"];
    public const string RisqueProbaParDefaut = "Modérée";
    public const string RisqueImpactParDefaut = "Moyenne";
    /// <summary>Types d'un risque (légende du support de comité). Facultatif.</summary>
    public static readonly IReadOnlyList<string> RisqueTypes = ["Retard", "Qualité", "Budget"];

    /// <summary>Ancienne échelle à 3 niveaux : Faible → 1, Moyen(ne) → 2, Fort(e) → 3 (le niveau 4 s'attribue à la main).</summary>
    public static readonly IReadOnlyDictionary<string, string> RisqueAncienneProba = new Dictionary<string, string> { ["Moyenne"] = "Modérée" };
    public static readonly IReadOnlyDictionary<string, string> RisqueAncienImpact = new Dictionary<string, string> { ["Moyen"] = "Moyenne", ["Fort"] = "Forte" };

    /// <summary>Probabilité d'un risque sur la nouvelle échelle (une valeur de l'ancienne échelle est convertie ; vide : valeur par défaut).</summary>
    public static string ProbaSurQuatreNiveaux(string? v) => string.IsNullOrEmpty(v) ? RisqueProbaParDefaut : RisqueAncienneProba.GetValueOrDefault(v, v);
    /// <summary>Importance d'un risque sur la nouvelle échelle (une valeur de l'ancienne échelle est convertie ; vide : valeur par défaut).</summary>
    public static string ImpactSurQuatreNiveaux(string? v) => string.IsNullOrEmpty(v) ? RisqueImpactParDefaut : RisqueAncienImpact.GetValueOrDefault(v, v);

    /// <summary>Niveau d'une criticité, d'après la matrice de référence : 1 à 3 faible, 4 à 6 moyen, 8 et plus fort.</summary>
    public static string NiveauRisque(int criticite) => criticite >= 8 ? "fort" : criticite >= 4 ? "moyen" : "faible";

    /// <summary>Coût de revient journalier par défaut d'un profil BO.</summary>
    public const decimal PrcsDefaut = 450m;

    /// <summary>Phases par défaut quand le TSP n'a pas d'onglet REF.</summary>
    public static readonly IReadOnlyList<string> PhasesParDefaut =
        ["PILOTAGE", "CONCEPTION", "CONSTRUCTION", "VALIDATION", "FINALISATION", "GARANTIE", "TMA", "PROVISION"];

    public const string TypeAtelier = "Atelier";
    public const string TypeLivrable = "Livrable";

    /// <summary>Types de tâche « socle » : utilisés par le tableau de bord, le registre et les exports ; non supprimables.</summary>
    public static readonly IReadOnlyList<(string Id, string Nom)> TypesSocle = [(TypeAtelier, "Atelier"), (TypeLivrable, "Livrable")];

    /// <summary>
    /// Profils pouvant dépasser 1 JH par jour : un prestataire (ACHAT) ou une cession peut mobiliser plusieurs personnes.
    /// </summary>
    public static bool PeutDepasserUneJournee(string? entite) =>
        Regex.IsMatch((entite ?? "").ToUpperInvariant(), "^(ACHAT|CESSION)");

    /// <summary>Nom par défaut d'un axe d'après son code (colonne A du TSP).</summary>
    public static string NomAxeParDefaut(string code)
    {
        if (code == "0") return "Pilotage (transverse)";
        var m = Regex.Match(code, @"^axe\s*(\d+)", RegexOptions.IgnoreCase);
        return m.Success ? $"Axe {m.Groups[1].Value}" : code;
    }

    private const RegexOptions OptionsJs = RegexOptions.ECMAScript | RegexOptions.CultureInvariant;

    /// <summary>
    /// Devine le type d'une tâche (Atelier, Livrable ou aucun) d'après son intitulé et le marqueur « livrable » du TSP.
    /// <paramref name="colonneLivrable"/> : la colonne « Livrable » du WORKLOAD est renseignée dans ce TSP (repère posé à l'import) ;
    /// une tâche est alors un livrable si et seulement si sa cellule vaut « oui » ; les ateliers restent reconnus par le titre.
    /// </summary>
    public static string DetecterType(string libelle, string? marqueurLivrable, bool colonneLivrable = false)
    {
        var l = (libelle ?? "").ToLowerInvariant();
        if (colonneLivrable)
            return marqueurLivrable == "oui" ? TypeLivrable
                : Regex.IsMatch(l, @"^\s*\[\s*atelier", OptionsJs) || Regex.IsMatch(l, @"^\s*(atelier|session|webinar|workshop)", OptionsJs) || Regex.IsMatch(l, @"\batelier", OptionsJs) ? TypeAtelier
                : "";
        if (Regex.IsMatch(l, @"^\s*\[\s*livrable", OptionsJs)) return TypeLivrable;
        if (Regex.IsMatch(l, @"^\s*\[\s*atelier", OptionsJs)) return TypeAtelier;
        if (Regex.IsMatch(l, @"^\s*(atelier|session|webinar|workshop)", OptionsJs)) return TypeAtelier;
        if (Regex.IsMatch(l, @"^\s*livrable", OptionsJs)) return TypeLivrable;
        if (marqueurLivrable == "oui") return TypeLivrable;
        if (Regex.IsMatch(l, @"\batelier", OptionsJs)) return TypeAtelier;
        if (Regex.IsMatch(l, @"\blivrable", OptionsJs)) return TypeLivrable;
        return "";
    }
}
