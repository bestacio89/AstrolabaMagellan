using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Application.Exports;

/// <summary>
/// Classeur Excel à écrire : une liste de feuilles, chacune une liste de lignes de cellules.
/// Même description que la version de référence (XlsxLite.write) pour produire exactement les mêmes exports.
/// </summary>
public sealed class Feuille
{
    public required string Nom { get; init; }
    /// <summary>Lignes ; une ligne null ou vide est une ligne blanche.</summary>
    public List<List<object?>> Lignes { get; init; } = new();
    /// <summary>Largeur de chaque colonne (en caractères).</summary>
    public List<double> Colonnes { get; init; } = new();
}

/// <summary>
/// Cellule mise en forme. Une cellule peut aussi être un simple texte ou un nombre.
/// Format : « jh » (2 décimales), « eur » (euros sans centimes), « eurc » (euros au centime), « pct » (pourcentage), « date ».
/// Type : « title » (titre de feuille) ou « section » (titre de bloc).
/// Formule : formule Excel sans « = » (ex. « SUM(F5:F12) ») ; V est alors la valeur déjà calculée, affichée telle quelle
/// et lue par les programmes qui ne recalculent pas (dont la lecture d'un TSP par l'application).
/// </summary>
public sealed record Cellule(object? V, string? Format = null, bool Gras = false, bool Entete = false, string? Type = null, string? Formule = null);

/// <summary>Écrit un classeur au format .xlsx (implémentation dans l'Infrastructure).</summary>
public interface IEcrivainClasseur
{
    byte[] Ecrire(IReadOnlyList<Feuille> feuilles);
}

/// <summary>Raccourcis de mise en forme des cellules (mêmes que le POC : H, T, SEC, jh, eur, pct).</summary>
internal static class C
{
    public static Cellule H(object? v) => new(v, Entete: true);
    public static Cellule T(string v) => new(v, Type: "title");
    public static Cellule Sec(string v) => new(v, Type: "section");
    public static Cellule Gras(object? v) => new(v, Gras: true);
    // (type de retour « object » : permet d'écrire « condition ? "" : Jh(x) »)
    public static object Jh(decimal? v, bool gras = false) => new Cellule(Texte.Arrondir(v ?? 0, 2), "jh", gras);
    public static object Eur(decimal? v, bool gras = false) => new Cellule(Texte.Arrondir(v ?? 0, 2), "eur", gras);
    public static object EurC(decimal? v) => new Cellule(Texte.Arrondir(v ?? 0, 2), "eurc");
    /// <summary>Pourcentage (vide si la valeur est inconnue).</summary>
    public static object Pct(decimal? v, bool gras = false) => v is null ? (object)"" : new Cellule(Texte.Arrondir(v.Value, 4), "pct", gras);
    /// <summary>Date au format jj/mm/aaaa (vide si inconnue).</summary>
    public static string D(DateOnly? d) => d is null ? "" : Calendrier.Fr(d.Value);
    /// <summary>Date d'un horodatage ISO (« 2026-09-25T10:00:00Z » → 25/09/2026).</summary>
    public static string D(string? iso) => string.IsNullOrEmpty(iso) || iso.Length < 10 ? "" : $"{iso[8..10]}/{iso[5..7]}/{iso[..4]}";

    private static readonly string[] MoisCourts = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    /// <summary>« 2026-09 » → « sept. 2026 ».</summary>
    public static string Mois(string mk) => $"{MoisCourts[int.Parse(mk[5..7]) - 1]} {mk[..4]}";

    public static List<object?> L(params object?[] cellules) => cellules.ToList();
    public static List<object?> Vide() => new();
}
