using System.Text.RegularExpressions;

namespace PilotageForfaits.Domain.Commun;

/// <summary>
/// Identité d'un projet, pour qu'un même forfait ne soit jamais suivi deux fois.
/// <para>
/// 1. Le <b>numéro d'opportunité</b> trouvé dans la référence de la proposition (« OP00123 - CLIENT - TSP - V3 » → « OP:00123 ») :
///    c'est l'identifiant commercial du forfait. La version du TSP (V3, V4…) n'en fait pas partie : une nouvelle version
///    du TSP concerne le même projet.
/// </para>
/// <para>2. Sinon, la référence elle-même, sans sa version (« REF:… »).</para>
/// <para>3. Sinon (projet sans référence), le client et le nom du projet (« NOM:client|projet »).</para>
/// Les comparaisons ignorent les accents, les majuscules, la ponctuation et les espaces en trop.
/// </summary>
public static partial class IdentiteProjet
{
    /// <summary>Clé d'unicité du projet (jamais vide : le client et le nom sont obligatoires).</summary>
    public static string Cle(string? reference, string? client, string? nom)
    {
        if (NumeroOpportunite(reference) is { } op) return $"OP:{op}";
        var sansVersion = Simplifier(VersionEnFin().Replace(reference ?? "", ""));
        if (sansVersion.Length > 0) return Tronquer($"REF:{sansVersion}");
        return Tronquer($"NOM:{Simplifier(client)}|{Simplifier(nom)}");
    }

    /// <summary>Numéro d'opportunité (chiffres seulement, zéros compris), ou null s'il n'y en a pas.</summary>
    public static string? NumeroOpportunite(string? reference)
    {
        var m = Opportunite().Match(reference ?? "");
        return m.Success ? m.Groups[1].Value : null;
    }

    /// <summary>Version du TSP indiquée en fin de référence (« V3 »), ou null.</summary>
    public static string? Version(string? reference)
    {
        var m = VersionEnFin().Match(reference ?? "");
        return m.Success ? "V" + m.Groups[1].Value : null;
    }

    /// <summary>Texte comparable : sans accents ni ponctuation, en majuscules, espaces simplifiés.</summary>
    public static string Simplifier(string? s) => Espaces().Replace(NonAlphanumerique().Replace(Texte.Norm(s), " "), " ").Trim().ToUpperInvariant();

    private static string Tronquer(string s) => s.Length <= 200 ? s : s[..200];

    [GeneratedRegex(@"(?<![\p{L}\p{N}])OP\s*[-_ ]?\s*(\d{3,})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex Opportunite();

    [GeneratedRegex(@"[\s\-_]*\bV\s*(\d+)\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex VersionEnFin();

    [GeneratedRegex(@"[^\p{L}\p{N}]+")]
    private static partial Regex NonAlphanumerique();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Espaces();
}
