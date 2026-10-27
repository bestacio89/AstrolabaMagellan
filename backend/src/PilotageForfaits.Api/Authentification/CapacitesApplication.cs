using PilotageForfaits.Application.Abstractions;

namespace PilotageForfaits.Api.Authentification;

/// <summary>API aliases for stable application capability identifiers; policies and application services share one contract.</summary>
public static class CapacitesApplication
{
    public const string ProjetsLire = CapacitesAcces.ProjetsLire;
    public const string ProjetsLireTous = CapacitesAcces.ProjetsLireTous;
    public const string ProjetsCreer = CapacitesAcces.ProjetsCreer;
    public const string ProjetsModifier = CapacitesAcces.ProjetsModifier;
    public const string ProjetsAffecterUtilisateurs = CapacitesAcces.ProjetsAffecterUtilisateurs;
    public const string UtilisateursLire = CapacitesAcces.UtilisateursLire;
    public const string UtilisateursAdministrer = CapacitesAcces.UtilisateursAdministrer;
    public const string ConsommeSaisir = CapacitesAcces.ConsommeSaisir;
    public const string ExportsFinanciers = CapacitesAcces.ExportsFinanciers;
    public const string TypeClaim = "capability";

    public static IReadOnlyList<string> Toutes { get; } =
    [
        ProjetsLire,
        ProjetsLireTous,
        ProjetsCreer,
        ProjetsModifier,
        ProjetsAffecterUtilisateurs,
        UtilisateursLire,
        UtilisateursAdministrer,
        ConsommeSaisir,
        ExportsFinanciers
    ];

    public static string Politique(string capacite) => $"capacite:{capacite}";
}
