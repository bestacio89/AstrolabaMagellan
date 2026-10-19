using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace PilotageForfaits.Domain.Commun;

/// <summary>
/// Petits utilitaires de texte et de nombres, identiques à ceux de la version de référence (POC v65).
/// </summary>
public static partial class Texte
{
    /// <summary>
    /// Forme « comparable » d'un libellé : sans accents, sans casse, apostrophes unifiées, espaces simplifiés.
    /// Sert à comparer des en-têtes ou des étapes saisis de façons différentes.
    /// </summary>
    public static string Norm(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var decompose = s.Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decompose.Length);
        foreach (var c in decompose)
        {
            if (c >= '̀' && c <= 'ͯ') continue; // accents détachés de leur lettre
            sb.Append(c is '’' or '‘' or '`' or '´' ? '\'' : c);
        }
        return Espaces().Replace(sb.ToString().ToLowerInvariant(), " ").Trim();
    }

    /// <summary>Arrondi « à la JavaScript » (Math.round : la moitié va vers le haut), à d décimales.</summary>
    public static decimal Arrondir(decimal n, int d = 2)
    {
        var f = Puissance10(d);
        return Math.Floor(n * f + 0.5m) / f;
    }

    private static decimal Puissance10(int d)
    {
        var f = 1m;
        for (var i = 0; i < d; i++) f *= 10m;
        return f;
    }

    private static readonly NumberFormatInfo FormatFr = new()
    {
        NumberDecimalSeparator = ",",
        NumberGroupSeparator = " ",
        CurrencyDecimalSeparator = ",",
        CurrencyGroupSeparator = " ",
        CurrencySymbol = "€",
        CurrencyPositivePattern = 3, // « 1 234 € »
        CurrencyNegativePattern = 8, // « -1 234 € »
        CurrencyDecimalDigits = 0,
    };

    /// <summary>Nombre de jours-homme au format français (2 décimales au plus).</summary>
    public static string Jh(decimal v) => Arrondir(v).ToString("#,##0.##", FormatFr);

    /// <summary>Montant en euros, sans décimales (ex. « 12 500 € »).</summary>
    public static string Euros(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero).ToString("C0", FormatFr);

    [GeneratedRegex(@"\s+")]
    private static partial Regex Espaces();
}
