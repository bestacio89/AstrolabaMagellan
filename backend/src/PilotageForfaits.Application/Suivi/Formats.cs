using System.Globalization;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>Mise en forme des messages (à la française, comme dans le POC) et lecture des libellés saisis.</summary>
public static class Formats
{
    private static readonly CultureInfo Fr = CultureInfo.GetCultureInfo("fr-FR");

    public static string Jh(decimal v) => Texte.Jh(v);
    public static string Euros(decimal v) => Texte.Euros(v);
    public static string Date(DateOnly d) => Calendrier.Fr(d);
    public static string Pourcent(decimal ratio) => (ratio * 100).ToString("0.#", Fr) + " %";

    /// <summary>Écart signé : « +0,5 » ou « −6 ».</summary>
    public static string Signe(decimal v) => Math.Abs(v) < 0.005m ? "0" : (v > 0 ? "+" : "−") + Texte.Jh(Math.Abs(v));

    /// <summary>Statut d'une tâche à partir de son libellé (anciens libellés acceptés).</summary>
    public static StatutTache StatutTache(string? libelle)
    {
        var l = ReferentielsMetier.AliasStatut.TryGetValue(libelle ?? "", out var alias) ? alias : libelle;
        return l switch
        {
            ReferentielsMetier.StatutAFaire => Domain.Entites.StatutTache.AFaire,
            ReferentielsMetier.StatutEnCours => Domain.Entites.StatutTache.EnCours,
            ReferentielsMetier.StatutBloque => Domain.Entites.StatutTache.Bloque,
            ReferentielsMetier.StatutEnRecette => Domain.Entites.StatutTache.EnRecette,
            ReferentielsMetier.StatutValide => Domain.Entites.StatutTache.Valide,
            _ => throw new RegleMetierException($"Statut inconnu : « {libelle} »."),
        };
    }

    public static StatutAction StatutAction(string? libelle) => libelle switch
    {
        "À faire" => Domain.Entites.StatutAction.AFaire,
        "En cours" => Domain.Entites.StatutAction.EnCours,
        "Fait" => Domain.Entites.StatutAction.Fait,
        "Annulée" => Domain.Entites.StatutAction.Annulee,
        _ => throw new RegleMetierException($"Statut d’action inconnu : « {libelle} »."),
    };

    public static StatutDecision StatutDecision(string? libelle) => libelle switch
    {
        "Validée" => Domain.Entites.StatutDecision.Validee,
        "À valider" => Domain.Entites.StatutDecision.AValider,
        "Rejetée" => Domain.Entites.StatutDecision.Rejetee,
        _ => throw new RegleMetierException($"Statut de décision inconnu : « {libelle} »."),
    };

    public static StatutRisque StatutRisque(string? libelle) => libelle switch
    {
        "Ouvert" => Domain.Entites.StatutRisque.Ouvert,
        "Maîtrisé" => Domain.Entites.StatutRisque.Maitrise,
        "Survenu" => Domain.Entites.StatutRisque.Survenu,
        "Clos" => Domain.Entites.StatutRisque.Clos,
        _ => throw new RegleMetierException($"Statut de risque inconnu : « {libelle} »."),
    };

    /// <summary>Probabilité sur 4 niveaux ; un libellé de l'ancienne échelle (« Moyenne ») est converti.</summary>
    public static ProbabiliteRisque Probabilite(string? libelle) => libelle switch
    {
        "Faible" => ProbabiliteRisque.Faible,
        "Modérée" or "Moyenne" => ProbabiliteRisque.Moderee,
        "Forte" => ProbabiliteRisque.Forte,
        "Très forte" => ProbabiliteRisque.TresForte,
        _ => throw new RegleMetierException($"Probabilité inconnue : « {libelle} »."),
    };

    /// <summary>Importance sur 4 niveaux ; un libellé de l'ancienne échelle (« Moyen », « Fort ») est converti.</summary>
    public static ImpactRisque Impact(string? libelle) => libelle switch
    {
        "Faible" => ImpactRisque.Faible,
        "Moyenne" or "Moyen" => ImpactRisque.Moyenne,
        "Forte" or "Fort" => ImpactRisque.Forte,
        "Critique" => ImpactRisque.Critique,
        _ => throw new RegleMetierException($"Importance inconnue : « {libelle} »."),
    };

    /// <summary>Type d'un risque ; vide : aucun type.</summary>
    public static TypeRisque? TypeRisque(string? libelle) => libelle switch
    {
        null or "" => null,
        "Retard" => Domain.Entites.TypeRisque.Retard,
        "Qualité" => Domain.Entites.TypeRisque.Qualite,
        "Budget" => Domain.Entites.TypeRisque.Budget,
        _ => throw new RegleMetierException($"Type de risque inconnu : « {libelle} »."),
    };

    public static StatutAchat StatutAchat(string? libelle) => libelle switch
    {
        null or "" or "Commandé" => Domain.Entites.StatutAchat.Commande,
        "Reçu" => Domain.Entites.StatutAchat.Recu,
        "Facturé" => Domain.Entites.StatutAchat.Facture,
        _ => throw new RegleMetierException($"Statut d’achat inconnu : « {libelle} »."),
    };

    public static CategorieFrais CategorieFrais(string? libelle) => libelle switch
    {
        "Transport" => Domain.Entites.CategorieFrais.Transport,
        "Hébergement" => Domain.Entites.CategorieFrais.Hebergement,
        "Repas" => Domain.Entites.CategorieFrais.Repas,
        null or "" or "Autre" => Domain.Entites.CategorieFrais.Autre,
        _ => throw new RegleMetierException($"Catégorie de frais inconnue : « {libelle} »."),
    };

    /// <summary>Date saisie au format AAAA-MM-JJ (vide : aucune date).</summary>
    public static DateOnly? LireDate(string? texte)
    {
        if (string.IsNullOrWhiteSpace(texte)) return null;
        if (DateOnly.TryParseExact(texte.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
        throw new RegleMetierException($"Date invalide : « {texte} ».");
    }

    /// <summary>Nombre saisi (point ou virgule ; vide : aucun nombre).</summary>
    public static decimal? LireNombre(string? texte)
    {
        if (string.IsNullOrWhiteSpace(texte)) return null;
        var t = texte.Trim().Replace(" ", "").Replace("\u00A0", "").Replace("\u202F", "").Replace(',', '.');
        if (decimal.TryParse(t, NumberStyles.Number, CultureInfo.InvariantCulture, out var v)) return v;
        throw new RegleMetierException($"Nombre invalide : « {texte} ».");
    }

    /// <summary>Heure saisie au format HH:mm (vide : aucune heure).</summary>
    public static TimeOnly? LireHeure(string? texte)
    {
        if (string.IsNullOrWhiteSpace(texte)) return null;
        if (TimeOnly.TryParseExact(texte.Trim(), new[] { "HH:mm", "H:mm", "HH:mm:ss" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var h)) return h;
        throw new RegleMetierException($"Heure invalide : « {texte} ».");
    }
}
