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
    /// <summary>Rôles Entra conservés à titre de profil d'identité, pas comme décision d'accès aux ressources.</summary>
    IReadOnlyCollection<string> Roles { get; }
    /// <summary>Capacités applicatives calculées côté serveur à partir de la configuration d'autorisation.</summary>
    IReadOnlyCollection<string> Capacites { get; }
}

/// <summary>Noms des rôles globaux déclarés dans l'inscription de l'application Entra ID.</summary>
public static class RolesGlobaux
{
    /// <summary>Peut créer des projets (il en devient chef de projet).</summary>
    public const string ChefDeProjet = "ChefDeProjet";
    /// <summary>Voit tous les projets en lecture, montants compris.</summary>
    public const string Pilotage = "Pilotage";
    /// <summary>Administre l'application (utilisateurs, habilitations).</summary>
    public const string Administrateur = "Administrateur";
}

/// <summary>Identifiants de capacités utilisés par les cas d'usage applicatifs.</summary>
public static class CapacitesAcces
{
    public const string ProjetsLire = "projets.lire";
    public const string ProjetsLireTous = "projets.lire-tous";
    public const string ProjetsCreer = "projets.creer";
    public const string ProjetsModifier = "projets.modifier";
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
