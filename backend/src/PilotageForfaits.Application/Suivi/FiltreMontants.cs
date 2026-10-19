using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Retire tous les montants (CA, coûts, marges, TJM / CJM, achats, frais, facturation) des données envoyées
/// aux rôles qui ne doivent pas les voir (consultant, lecteur). Les montants ne quittent jamais le serveur :
/// les masquer à l'écran ne suffirait pas, ils resteraient lisibles dans le navigateur.
/// RÈGLE DE MAINTENANCE : tout nouveau champ monétaire ajouté au moteur ou à la vue doit être ajouté ici
/// (un test vérifie qu'aucun montant connu n'est envoyé à un consultant).
/// </summary>
public static class FiltreMontants
{
    /// <summary>Champs monétaires, retirés où qu'ils se trouvent.</summary>
    public static readonly IReadOnlySet<string> Champs = new HashSet<string>(StringComparer.Ordinal)
    {
        // profils et tâches
        "tjm", "tjmR", "cjm", "prcs", "frais", "remise", "caInitial",
        "coutAnnule", "coutReaff", "caAvenant", "valo", "coutPrevu", "coutPrevuTSP", "coutAjout", "cjmMoyen", "tjmMoyen", "coutConso", "coutRaf", "coutFinal",
        // vente
        "ca", "caTSP", "coutEN", "coutAgence", "coutAgenceJour", "tci", "margeEN", "margeAgence", "pctCA", "ajoutCout", "montantProfil",
        // mensuel
        "coutCJM", "cumCJM", "valoTJM", "cumTJM", "refTJM", "cumRefTJM",
        // périmètre
        "cout", "margeVendue", "margeAvecAjouts",
        // IA
        "valeurTJM", "valeurCJM", "projTJM",
        // facturation
        "montant", "montantInit", "montantFacture", "ajustAvenant", "factCum", "prodPlan", "faePlan", "factReel", "prodReel", "faeReel",
        "faePlanPct", "faeReelPct",
        // historique des comités
        "marge", "margeNette", "tauxMarge", "tauxMargeNette",
    };

    /// <summary>Blocs entièrement monétaires, retirés en entier.</summary>
    public static readonly IReadOnlySet<string> Blocs = new HashSet<string>(StringComparer.Ordinal)
    {
        "financier", "synthese", "echSynth", "grille", "achats", "prestas", "achatsReel", "fraisReel",
        // point hebdo : la diapositive montre le budget, elle est réservée aux rôles qui voient les montants
        "pointsHebdo",
    };

    /// <summary>Textes libres dont les montants en euros sont ôtés (le reste du texte est conservé).</summary>
    public static readonly IReadOnlySet<string> TextesLibres = new HashSet<string>(StringComparer.Ordinal) { "commentaire", "texte", "motif" };

    /// <summary>Entrées du journal qui portent sur de l'argent : retirées en entier.</summary>
    public static readonly IReadOnlySet<string> ObjetsJournal = new HashSet<string>(StringComparer.Ordinal) { "Achat", "Frais", "Échéance", "Export" };

    /// <summary>Morceau de texte qui cite un montant en euros (« , coût évité 1 200 € »), avec son séparateur.</summary>
    private static readonly Regex MorceauEnEuros = new(@"(?:[,;]\s*|^)[^,;€\d]*-?−?\d[\d\s\u00a0\u202f.,]*€", RegexOptions.CultureInvariant);

    /// <summary>Montant isolé, n'importe où dans un texte : « 1 200 € », « € 1 200 », « 1200 euros ».</summary>
    private static readonly Regex MontantSeul = new(
        @"-?−?\d(?:[\d\u00a0\u202f.,]|\s(?=\d))*\s*(?:€|euros?\b)|€\s*-?−?\d(?:[\d\u00a0\u202f.,]|\s(?=\d))*",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static bool CiteUnMontant(string texte) => texte.Contains('€') || texte.Contains("euro", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Texte sans ses montants : d'abord le morceau entier qui les cite (« , coût évité 1 200 € »), puis tout montant qui resterait
    /// (« Atelier 3 décalé 1 200 € » → « Atelier 3 décalé [montant] »). Utilisé pour les textes libres envoyés à un consultant ou un lecteur.
    /// </summary>
    public static string SansMontant(string texte)
    {
        var r = MorceauEnEuros.Replace(texte, "");
        r = MontantSeul.Replace(r, "[montant]");
        return Regex.Replace(r, @"[ \t\u00a0]{2,}", " ").Trim();
    }

    /// <summary>Retire les montants d'un suivi déjà mis en JSON (modifié sur place).</summary>
    public static void Appliquer(JsonNode? noeud)
    {
        switch (noeud)
        {
            case JsonObject objet:
                foreach (var cle in objet.Select(x => x.Key).ToList())
                {
                    if (Champs.Contains(cle) || Blocs.Contains(cle)) objet.Remove(cle);
                    else if (cle == "journal" && objet[cle] is JsonArray entrees) FiltrerJournal(entrees);
                    // commentaire écrit par l'application (ex. décision d'annulation : « coût évité … € »), message du fil d'une tâche,
                    // motif d'un écart : les montants en euros en sont ôtés
                    else if (TextesLibres.Contains(cle) && objet[cle] is JsonValue v && v.TryGetValue<string>(out var texte) && CiteUnMontant(texte))
                        objet[cle] = SansMontant(texte);
                    else Appliquer(objet[cle]);
                }
                // points de vigilance exprimés en euros : retirés ; détail qui cite un coût : retiré
                if (objet["vigilance"] is JsonArray vigilance)
                {
                    for (var i = vigilance.Count - 1; i >= 0; i--)
                    {
                        if (vigilance[i] is not JsonObject point) continue;
                        if (point["unite"]?.GetValue<string>() == "€") vigilance.RemoveAt(i);
                        else if (point["cle"]?.GetValue<string>() == "ajouts") point.Remove("detail");
                    }
                }
                break;
            case JsonArray tableau:
                foreach (var element in tableau) Appliquer(element);
                break;
        }
    }

    /// <summary>Journal : les entrées sur l'argent (achats, frais, facturation, exports) et celles qui citent un montant sont retirées.</summary>
    private static void FiltrerJournal(JsonArray entrees)
    {
        for (var i = entrees.Count - 1; i >= 0; i--)
        {
            if (entrees[i] is not JsonObject e) continue;
            var objet = e["objet"]?.GetValue<string>() ?? "";
            var citeUnMontant = e.Any(x => x.Value is JsonValue v && v.TryGetValue<string>(out var t) && t.Contains('€'));
            if (ObjetsJournal.Contains(objet) || citeUnMontant) entrees.RemoveAt(i);
        }
    }
}
