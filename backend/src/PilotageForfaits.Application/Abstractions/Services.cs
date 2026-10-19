using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Abstractions;

/// <summary>La personne connectée, telle que la décrit son jeton (compte d'entreprise).</summary>
public interface IUtilisateurCourant
{
    bool EstAuthentifie { get; }
    /// <summary>Identifiant du compte d'entreprise (« oid » Entra ID).</summary>
    string IdentifiantExterne { get; }
    string Prenom { get; }
    string Nom { get; }
    string Email { get; }
    /// <summary>Rôles globaux attribués dans Entra ID (voir <see cref="RolesGlobaux"/>).</summary>
    IReadOnlyCollection<string> Roles { get; }
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
