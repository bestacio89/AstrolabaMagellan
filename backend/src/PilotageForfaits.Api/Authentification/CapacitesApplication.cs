namespace PilotageForfaits.Api.Authentification;

/// <summary>Identifiants stables des capacités de l'API, indépendants des écrans Angular.</summary>
public static class CapacitesApplication
{
    public const string ProjetsLire = "projets.lire";
    public const string ProjetsLireTous = "projets.lire-tous";
    public const string ProjetsCreer = "projets.creer";
    public const string ProjetsModifier = "projets.modifier";
    public const string ProjetsAffecterUtilisateurs = "projets.affecter-utilisateurs";
    public const string UtilisateursLire = "utilisateurs.lire";
    public const string UtilisateursAdministrer = "utilisateurs.administrer";
    public const string ConsommeSaisir = "consomme.saisir";
    public const string ExportsFinanciers = "exports.financiers";
    public const string TypeClaim = "capability";

    public static IReadOnlyList<string> Toutes { get; } =
    [
        ProjetsLire,
        ProjetsLireTous,
        ProjetsCreer,
        ProjetsModifier,
        ProjetsAffecterUtilisateurs,
        UtilisateursAdministrer,
        ConsommeSaisir,
        ExportsFinanciers
    ];

    public static string Politique(string capacite) => $"capacite:{capacite}";
}
