using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Abstractions;

/// <summary>La personne connectée, telle que la décrit son jeton (compte d'entreprise).</summary>
public interface IUtilisateurCourant
{
    bool EstAuthentifie { get; }
    /// <summary>Clé d'identité stable composée du tenant Entra et de l'object ID.</summary>
    string IdentifiantExterne { get; }
    string Prenom { get; }
    string Nom { get; }
    string Email { get; }
    /// <summary>Rôles globaux présents dans le jeton d'accès de l'API.</summary>
    IReadOnlyCollection<string> Roles { get; }
    /// <summary>Capacités calculées côté serveur depuis les rôles globaux et les règles applicatives.</summary>
    IReadOnlyCollection<string> Capacites { get; }
}

/// <summary>Valeurs exactes des rôles d'application globaux à déclarer sur l'inscription Entra de l'API.</summary>
public static class RolesGlobaux
{
    /// <summary>Supervision opérationnelle du portefeuille et affectation des utilisateurs aux projets.</summary>
    public const string Manager = "Manager";
    /// <summary>Administration des utilisateurs et des habilitations, sans privilèges financiers implicites.</summary>
    public const string Admin = "Admin";
}

/// <summary>Identifiants de capacités utilisés par les cas d'usage applicatifs.</summary>
public static class CapacitesAcces
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
}

/// <summary>Date et heure du jour. Remplaçable dans les tests pour obtenir des résultats reproductibles.</summary>
public interface IHorloge
{
    DateTimeOffset Maintenant { get; }
    /// <summary>Date du jour à l'heure de Paris (et non UTC : entre 0 h et 2 h, l'UTC donne encore la veille).</summary>
    DateOnly Aujourdhui { get; }
}

/// <summary>Lit un fichier TSP (.xlsx / .xlsm).</summary>
public interface ILecteurTsp
{
    /// <exception cref="TspInvalideException">Le fichier n'est pas un TSP exploitable.</exception>
    TspLu Lire(Stream fichier, string nomFichier);
}
