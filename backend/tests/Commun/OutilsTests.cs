using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace PilotageForfaits.Tests.Commun;

/// <summary>Outils partagés par les projets de tests (fichier inclus dans chacun d'eux).</summary>
public static class OutilsTests
{
    /// <summary>Lecture des fichiers de la version de référence (noms en camelCase, nombres éventuellement en texte).</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    /// <summary>Dossier des données de référence copié à côté des tests.</summary>
    public static string Donnees(string nom) => Path.Combine(AppContext.BaseDirectory, "Donnees", nom);

    public static JsonNode Lire(string nom) => JsonNode.Parse(File.ReadAllText(Donnees(nom)))!;

    public static T LireObjet<T>(string nom) => JsonSerializer.Deserialize<T>(File.ReadAllText(Donnees(nom)), Json)!;

    public static JsonNode VersJson(object valeur) => JsonSerializer.SerializeToNode(valeur, valeur.GetType(), Json)!;

    /// <summary>
    /// Compare un résultat à l'attendu : seules les clés présentes dans l'attendu sont vérifiées.
    /// Les nombres sont comparés à 0,00001 près (la version de référence calcule en nombres à virgule flottante).
    /// Renvoie la liste des écarts (vide si tout est identique).
    /// </summary>
    public static List<string> Comparer(JsonNode? attendu, JsonNode? obtenu, string chemin = "$")
    {
        var ecarts = new List<string>();
        ComparerNoeud(attendu, obtenu, chemin, ecarts);
        return ecarts;
    }

    /// <summary>Vérifie que le résultat est identique à l'attendu et affiche les premiers écarts sinon.</summary>
    public static void VerifierIdentique(JsonNode? attendu, JsonNode? obtenu, string contexte)
    {
        var ecarts = Comparer(attendu, obtenu);
        Assert.True(ecarts.Count == 0, $"{contexte} : {ecarts.Count} écart(s) avec la version de référence.\n" + string.Join("\n", ecarts.Take(40)));
    }

    private static void ComparerNoeud(JsonNode? a, JsonNode? o, string chemin, List<string> ecarts)
    {
        if (a is null)
        {
            if (o is not null) ecarts.Add($"{chemin} : attendu null, obtenu {o.ToJsonString()}");
            return;
        }
        switch (a)
        {
            case JsonObject objet:
                if (o is not JsonObject obtenu) { ecarts.Add($"{chemin} : attendu un objet, obtenu {o?.ToJsonString() ?? "null"}"); return; }
                foreach (var (cle, valeur) in objet) ComparerNoeud(valeur, obtenu[cle], $"{chemin}.{cle}", ecarts);
                return;
            case JsonArray tableau:
                if (o is not JsonArray liste) { ecarts.Add($"{chemin} : attendu une liste, obtenu {o?.ToJsonString() ?? "null"}"); return; }
                if (liste.Count != tableau.Count) { ecarts.Add($"{chemin} : attendu {tableau.Count} éléments, obtenu {liste.Count}"); return; }
                for (var i = 0; i < tableau.Count; i++) ComparerNoeud(tableau[i], liste[i], $"{chemin}[{i}]", ecarts);
                return;
            default:
                var va = (JsonValue)a;
                if (va.GetValueKind() == JsonValueKind.Number)
                {
                    if (o is not JsonValue vo || vo.GetValueKind() != JsonValueKind.Number) { ecarts.Add($"{chemin} : attendu {a.ToJsonString()}, obtenu {o?.ToJsonString() ?? "null"}"); return; }
                    var x = double.Parse(a.ToJsonString(), CultureInfo.InvariantCulture);
                    var y = double.Parse(o.ToJsonString(), CultureInfo.InvariantCulture);
                    if (Math.Abs(x - y) > 1e-5 + 1e-9 * Math.Abs(x)) ecarts.Add($"{chemin} : attendu {x}, obtenu {y}");
                    return;
                }
                if (o is null || a.ToJsonString() != o.ToJsonString()) ecarts.Add($"{chemin} : attendu {a.ToJsonString()}, obtenu {o?.ToJsonString() ?? "null"}");
                return;
        }
    }
}
