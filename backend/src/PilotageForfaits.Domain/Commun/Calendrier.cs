using System.Globalization;

namespace PilotageForfaits.Domain.Commun;

/// <summary>
/// Outils de dates du métier : mois au format « AAAA-MM », jours fériés français, jours ouvrés.
/// Reprend à l'identique les utilitaires de la version de référence (POC v65).
/// </summary>
public static class Calendrier
{
    private static readonly DateOnly OrigineExcel = new(1899, 12, 30);

    /// <summary>Mois d'une date, au format « AAAA-MM » (ex. 2026-09).</summary>
    public static string Mois(DateOnly jour) => jour.ToString("yyyy-MM", CultureInfo.InvariantCulture);

    /// <summary>Date au format « AAAA-MM-JJ ».</summary>
    public static string Iso(DateOnly jour) => jour.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Lit une date « AAAA-MM-JJ ».</summary>
    public static DateOnly LireIso(string iso) => DateOnly.ParseExact(iso, "yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Date au format français « JJ/MM/AAAA ».</summary>
    public static string Fr(DateOnly jour) => jour.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    /// <summary>Mois « AAAA-MM » au format français « MM/AAAA ».</summary>
    public static string MoisFr(string mois) => $"{mois[5..7]}/{mois[..4]}";

    /// <summary>Ajoute (ou retire) des mois à un mois « AAAA-MM ».</summary>
    public static string AjouterMois(string mois, int n)
    {
        var annee = int.Parse(mois[..4], CultureInfo.InvariantCulture);
        var m = int.Parse(mois[5..7], CultureInfo.InvariantCulture) - 1 + n;
        annee += (int)Math.Floor(m / 12.0);
        m = ((m % 12) + 12) % 12;
        return $"{annee:D4}-{m + 1:D2}";
    }

    /// <summary>Nombre de mois entre deux mois « AAAA-MM » (b − a).</summary>
    public static int MoisEntre(string a, string b)
    {
        var (y1, m1) = (int.Parse(a[..4], CultureInfo.InvariantCulture), int.Parse(a[5..7], CultureInfo.InvariantCulture));
        var (y2, m2) = (int.Parse(b[..4], CultureInfo.InvariantCulture), int.Parse(b[5..7], CultureInfo.InvariantCulture));
        return (y2 - y1) * 12 + (m2 - m1);
    }

    /// <summary>Premier jour d'un mois « AAAA-MM ».</summary>
    public static DateOnly PremierJour(string mois) =>
        new(int.Parse(mois[..4], CultureInfo.InvariantCulture), int.Parse(mois[5..7], CultureInfo.InvariantCulture), 1);

    /// <summary>Dernier jour d'un mois « AAAA-MM ».</summary>
    public static DateOnly DernierJour(string mois) => PremierJour(mois).AddMonths(1).AddDays(-1);

    /// <summary>Tous les jours d'un mois « AAAA-MM ».</summary>
    public static List<DateOnly> JoursDuMois(string mois)
    {
        var jours = new List<DateOnly>();
        for (var d = PremierJour(mois); Mois(d) == mois; d = d.AddDays(1)) jours.Add(d);
        return jours;
    }

    /// <summary>Convertit un numéro de série Excel (nombre de jours depuis le 30/12/1899) en date.</summary>
    public static DateOnly DepuisSerieExcel(double serie) => OrigineExcel.AddDays((int)Math.Round(serie, MidpointRounding.AwayFromZero));

    /// <summary>Numéro de série Excel d'une date (nombre de jours depuis le 30/12/1899).</summary>
    public static double VersSerieExcel(DateOnly jour) => jour.DayNumber - OrigineExcel.DayNumber;

    /// <summary>Lit une date française « JJ/MM/AAAA » contenue dans un texte ; null si absente.</summary>
    public static DateOnly? LireDateFr(string? texte)
    {
        if (string.IsNullOrEmpty(texte)) return null;
        var m = System.Text.RegularExpressions.Regex.Match(texte, @"(\d{1,2})/(\d{1,2})/(\d{4})");
        if (!m.Success) return null;
        var j = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        var mo = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
        var a = int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture);
        if (mo < 1 || mo > 12 || j < 1 || j > DateTime.DaysInMonth(a, mo)) return null;
        return new DateOnly(a, mo, j);
    }

    // ---------- Jours fériés français (métropole) ----------

    private static readonly Dictionary<int, Dictionary<DateOnly, string>> CacheFeries = new();
    private static readonly object Verrou = new();

    /// <summary>Date de Pâques (algorithme de Meeus/Jones/Butcher).</summary>
    public static DateOnly Paques(int y)
    {
        int a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4, f = (b + 8) / 25,
            g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4,
            l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451,
            mois = (h + l - 7 * m + 114) / 31, jour = ((h + l - 7 * m + 114) % 31) + 1;
        return new DateOnly(y, mois, jour);
    }

    /// <summary>Jours fériés d'une année, avec leur nom.</summary>
    public static IReadOnlyDictionary<DateOnly, string> JoursFeries(int annee)
    {
        lock (Verrou)
        {
            if (CacheFeries.TryGetValue(annee, out var connus)) return connus;
            var p = Paques(annee);
            var liste = new Dictionary<DateOnly, string>
            {
                [new DateOnly(annee, 1, 1)] = "Jour de l'an",
                [p.AddDays(1)] = "Lundi de Pâques",
                [new DateOnly(annee, 5, 1)] = "Fête du travail",
                [new DateOnly(annee, 5, 8)] = "Victoire 1945",
                [p.AddDays(39)] = "Ascension",
                [p.AddDays(50)] = "Lundi de Pentecôte",
                [new DateOnly(annee, 7, 14)] = "Fête nationale",
                [new DateOnly(annee, 8, 15)] = "Assomption",
                [new DateOnly(annee, 11, 1)] = "Toussaint",
                [new DateOnly(annee, 11, 11)] = "Armistice",
                [new DateOnly(annee, 12, 25)] = "Noël",
            };
            CacheFeries[annee] = liste;
            return liste;
        }
    }

    /// <summary>Nom du jour férié, ou null si le jour n'est pas férié.</summary>
    public static string? NomFerie(DateOnly jour) => JoursFeries(jour.Year).TryGetValue(jour, out var nom) ? nom : null;

    /// <summary>Jour ouvré : ni samedi, ni dimanche, ni férié.</summary>
    public static bool EstOuvre(DateOnly jour) =>
        jour.DayOfWeek != DayOfWeek.Saturday && jour.DayOfWeek != DayOfWeek.Sunday && NomFerie(jour) is null;

    /// <summary>Nombre de jours ouvrés entre deux dates incluses (0 si une date manque ou si b est avant a).</summary>
    public static int JoursOuvres(DateOnly? a, DateOnly? b)
    {
        if (a is null || b is null || b < a) return 0;
        var n = 0;
        for (var d = a.Value; d <= b.Value; d = d.AddDays(1)) if (EstOuvre(d)) n++;
        return n;
    }
}
