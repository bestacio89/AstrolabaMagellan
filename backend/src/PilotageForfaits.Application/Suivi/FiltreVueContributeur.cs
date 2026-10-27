using System.Globalization;
using System.Text.Json.Nodes;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Reduces the project follow-up payload for a Contributor to tasks charged to profiles linked to that
/// local user. This is server-side data minimization; Angular filtering is not an authorization boundary.
/// </summary>
public static class FiltreVueContributeur
{
    public static void Appliquer(JsonObject json, IReadOnlyList<ProfilProjet> profils, Guid utilisateurId)
    {
        var indices = profils.Select((profil, index) => (profil, index))
            .Where(item => item.profil.UtilisateurId == utilisateurId)
            .Select(item => item.index)
            .ToArray();
        var nouvelleIndex = indices.Select((ancien, nouveau) => (ancien, nouveau))
            .ToDictionary(item => item.ancien, item => item.nouveau);

        var projet = json["projet"] as JsonObject;
        var modele = json["modele"] as JsonObject;
        if (projet is null || modele is null) return;

        var track = projet["track"] as JsonObject;
        var tasksModele = modele["tasks"] as JsonArray;
        var uidsAutorises = new HashSet<string>(StringComparer.Ordinal);
        if (tasksModele is not null)
        {
            foreach (var task in tasksModele.OfType<JsonObject>())
            {
                var uid = Texte(task["uid"]);
                if (!string.IsNullOrWhiteSpace(uid) && EstAffectee(task, track?[uid] as JsonObject, indices))
                    uidsAutorises.Add(uid);
            }
        }

        FiltrerProfils(projet["profiles"] as JsonArray, indices);
        FiltrerProfilsModele(modele["p"] as JsonArray, nouvelleIndex);
        FiltrerTaches(tasksModele, uidsAutorises, nouvelleIndex);
        FiltrerTaches(projet["tasks"] as JsonArray, uidsAutorises, nouvelleIndex);
        FiltrerTrack(track, uidsAutorises, nouvelleIndex);
        FiltrerObjetParCle(projet["misesAJour"] as JsonObject, uidsAutorises);
        FiltrerObjetParCle(projet["commentaires"] as JsonObject, uidsAutorises);
        FiltrerReferences(projet["references"] as JsonArray, uidsAutorises);
        FiltrerPlanning(projet["planning"] as JsonObject, uidsAutorises);
        FiltrerPlanningProfils(projet["planningRef"] as JsonObject, indices);
        FiltrerPlanningProfils(projet["planningTsp"] as JsonObject, indices);
        FiltrerAxesEtLots(projet, tasksModele, uidsAutorises);

        // Contributor receives task-centric information only; project-wide registers and financial ledgers
        // are not part of this role's view.
        ViderTableau(projet, "actions", "decisions", "risques", "historique", "journal",
            "grille", "frais", "achats", "prestas", "metrique", "achatsReel", "fraisReel",
            "warnings", "causes", "etatsDatesLimitesAxes");
        ViderObjet(projet, "echTrack");
        ViderObjet(projet, "pointsHebdo");
        projet["source"] = null;
        if (projet["fiche"] is JsonObject fiche && fiche["champs"] is JsonArray champs)
            champs.Clear();
        if (projet["planningPhases"] is JsonObject phases && phases["rows"] is JsonArray lignesPhases)
            lignesPhases.Clear();
    }

    private static bool EstAffectee(JsonObject task, JsonObject? suivi, IReadOnlyList<int> indices)
    {
        var charges = task["charges"] as JsonArray;
        if (indices.Any(index => index < (charges?.Count ?? 0) && Nombre(charges![index]) > 0))
            return true;

        foreach (var champ in new[] { "chargeAjout", "consoP" })
        {
            if (suivi?[champ] is not JsonObject valeurs) continue;
            foreach (var index in indices)
            {
                if (valeurs.TryGetPropertyValue(index.ToString(CultureInfo.InvariantCulture), out var valeur) &&
                    ContientValeurPositive(valeur))
                    return true;
            }
        }

        return false;
    }

    private static bool ContientValeurPositive(JsonNode? node)
    {
        if (node is JsonObject objet)
            return objet.Any(pair => ContientValeurPositive(pair.Value));
        if (node is JsonArray tableau)
            return tableau.Any(ContientValeurPositive);
        return Nombre(node) > 0;
    }

    private static void FiltrerProfils(JsonArray? profils, IReadOnlyList<int> indices)
    {
        if (profils is null) return;
        var gardes = indices.ToHashSet();
        for (var i = profils.Count - 1; i >= 0; i--)
            if (!gardes.Contains(i)) profils.RemoveAt(i);
    }

    private static void FiltrerProfilsModele(JsonArray? profils, IReadOnlyDictionary<int, int> nouvelleIndex)
    {
        if (profils is null) return;
        for (var i = profils.Count - 1; i >= 0; i--)
        {
            if (profils[i] is not JsonObject profil || !Entier(profil["i"], out var ancien) ||
                !nouvelleIndex.TryGetValue(ancien, out var nouveau))
            {
                profils.RemoveAt(i);
                continue;
            }
            profil["i"] = nouveau;
        }
    }

    private static void FiltrerTaches(JsonArray? taches, HashSet<string> uids, IReadOnlyDictionary<int, int> nouvelleIndex)
    {
        if (taches is null) return;
        for (var i = taches.Count - 1; i >= 0; i--)
        {
            if (taches[i] is not JsonObject tache || Texte(tache["uid"]) is not { } uid || !uids.Contains(uid))
            {
                taches.RemoveAt(i);
                continue;
            }
            RemapperTableau(tache["charges"] as JsonArray, nouvelleIndex);
        }
    }

    private static void FiltrerTrack(JsonObject? track, HashSet<string> uids, IReadOnlyDictionary<int, int> nouvelleIndex)
    {
        if (track is null) return;
        foreach (var uid in track.Select(pair => pair.Key).ToArray())
        {
            if (!uids.Contains(uid) || track[uid] is not JsonObject suivi)
            {
                track.Remove(uid);
                continue;
            }
            RemapperObjet(suivi["chargeAjout"] as JsonObject, nouvelleIndex);
            RemapperObjet(suivi["ajoutInfo"] as JsonObject, nouvelleIndex);
            RemapperObjet(suivi["consoP"] as JsonObject, nouvelleIndex);
        }
    }

    private static void RemapperTableau(JsonArray? valeurs, IReadOnlyDictionary<int, int> nouvelleIndex)
    {
        if (valeurs is null) return;
        var anciennes = valeurs.Select(valeur => valeur?.DeepClone()).ToArray();
        valeurs.Clear();
        foreach (var ancien in nouvelleIndex.OrderBy(pair => pair.Value).Select(pair => pair.Key))
            valeurs.Add(ancien < anciennes.Length ? anciennes[ancien]?.DeepClone() : JsonValue.Create(0));
    }

    private static void RemapperObjet(JsonObject? valeurs, IReadOnlyDictionary<int, int> nouvelleIndex)
    {
        if (valeurs is null) return;
        var remappees = new List<(string Cle, JsonNode? Valeur)>();
        foreach (var paire in valeurs.ToArray())
        {
            if (!int.TryParse(paire.Key, NumberStyles.None, CultureInfo.InvariantCulture, out var ancien))
                continue;
            if (nouvelleIndex.TryGetValue(ancien, out var nouveau))
                remappees.Add((nouveau.ToString(CultureInfo.InvariantCulture), paire.Value?.DeepClone()));
            valeurs.Remove(paire.Key);
        }
        foreach (var paire in remappees)
            valeurs[paire.Cle] = paire.Valeur;
    }

    private static void FiltrerObjetParCle(JsonObject? objet, HashSet<string> uids)
    {
        if (objet is null) return;
        foreach (var cle in objet.Select(pair => pair.Key).ToArray())
            if (!uids.Contains(cle)) objet.Remove(cle);
    }

    private static void FiltrerReferences(JsonArray? references, HashSet<string> uids)
    {
        if (references is null) return;
        for (var i = references.Count - 1; i >= 0; i--)
        {
            if (references[i] is not JsonObject reference || reference["lignes"] is not JsonObject lignes)
            {
                references.RemoveAt(i);
                continue;
            }
            FiltrerObjetParCle(lignes, uids);
            if (lignes.Count == 0) references.RemoveAt(i);
        }
    }

    private static void FiltrerPlanning(JsonObject? planning, HashSet<string> uids)
    {
        if (planning is null) return;
        foreach (var propriete in new[] { "groupes", "avant", "masque" })
        {
            if (planning[propriete] is not JsonObject valeurs) continue;
            foreach (var cle in valeurs.Select(pair => pair.Key).ToArray())
            {
                var morceaux = cle.Split('|');
                var uid = morceaux.Length > 1 && (morceaux[0] is "tache" or "sec") ? morceaux[1] : null;
                if (uid is null || !uids.Contains(uid)) valeurs.Remove(cle);
            }
        }
    }

    private static void FiltrerPlanningProfils(JsonObject? planning, IReadOnlyList<int> indices)
    {
        if (planning?["rows"] is not JsonArray lignes) return;
        var anciennes = lignes.Select(ligne => ligne?.DeepClone()).ToArray();
        lignes.Clear();
        foreach (var index in indices)
            if (index < anciennes.Length) lignes.Add(anciennes[index]?.DeepClone());
    }

    private static void FiltrerAxesEtLots(JsonObject projet, JsonArray? tasks, HashSet<string> uids)
    {
        if (tasks is null) return;
        var taches = tasks.OfType<JsonObject>().Where(tache => Texte(tache["uid"]) is { } uid && uids.Contains(uid)).ToArray();
        var axes = taches.Select(tache => Texte(tache["id"])).OfType<string>().Where(value => !string.IsNullOrWhiteSpace(value)).ToHashSet(StringComparer.Ordinal);
        var lots = taches.Select(tache => Texte(tache["lot"])).OfType<string>().Where(value => !string.IsNullOrWhiteSpace(value)).ToHashSet(StringComparer.Ordinal);
        FiltrerObjetParCle(projet["axes"] as JsonObject, axes!);
        FiltrerObjetParCle(projet["lots"] as JsonObject, lots!);
    }

    private static void ViderTableau(JsonObject objet, params string[] noms)
    {
        foreach (var nom in noms)
            if (objet[nom] is JsonArray tableau) tableau.Clear();
    }

    private static void ViderObjet(JsonObject objet, string nom)
    {
        if (objet[nom] is JsonObject valeur) valeur.Clear();
        else objet[nom] = null;
    }

    private static string? Texte(JsonNode? node)
    {
        try { return node?.GetValue<string>(); }
        catch (InvalidOperationException) { return null; }
    }

    private static bool Entier(JsonNode? node, out int valeur)
    {
        try { return node is not null && node.AsValue().TryGetValue(out valeur); }
        catch (InvalidOperationException) { valeur = 0; return false; }
    }

    private static decimal Nombre(JsonNode? node)
    {
        try
        {
            if (node is not null && node.AsValue().TryGetValue<decimal>(out var valeur)) return valeur;
            if (node is not null && node.AsValue().TryGetValue<double>(out var nombre)) return (decimal)nombre;
        }
        catch (InvalidOperationException) { }
        return 0;
    }
}
