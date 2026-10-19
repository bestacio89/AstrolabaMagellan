using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Securite;

/// <summary>
/// Qui est connecté, et que peut-il faire ? Toutes les vérifications de droits passent par ici.
/// Droits par rôle (à valider) :
/// - Consultant : voit ses projets et saisit son consommé, sans les montants ;
/// - Chef de projet : voit et modifie tout son projet ;
/// - Pilotage : voit tous les projets en lecture, montants compris ;
/// - Lecteur : voit le projet, sans les montants.
/// </summary>
public sealed class ServiceAcces(IContexteDonnees db, IUtilisateurCourant courant, IHorloge horloge)
{
    private Utilisateur? _utilisateur;

    /// <summary>
    /// Fiche de l'utilisateur connecté. Créée à sa première connexion, mise à jour ensuite (nom, e-mail).
    /// </summary>
    public async Task<Utilisateur> UtilisateurAsync(CancellationToken annulation = default)
    {
        if (_utilisateur is not null) return _utilisateur;
        if (!courant.EstAuthentifie || string.IsNullOrEmpty(courant.IdentifiantExterne))
            throw new AccesRefuseException("Vous devez être connecté.");
        var u = await db.Utilisateurs.FirstOrDefaultAsync(x => x.IdentifiantExterne == courant.IdentifiantExterne, annulation);
        if (u is null)
        {
            u = new Utilisateur { IdentifiantExterne = courant.IdentifiantExterne, CreeLe = horloge.Maintenant };
            db.Utilisateurs.Add(u);
        }
        if (!u.Actif) throw new AccesRefuseException("Votre compte est désactivé dans l'application.");
        u.Prenom = courant.Prenom;
        u.Nom = courant.Nom;
        u.Email = courant.Email;
        u.Administrateur = courant.Roles.Contains(RolesGlobaux.Administrateur);
        // au plus une écriture par heure pour la date de dernière connexion (sinon chaque appel écrirait en base)
        if (u.DerniereConnexion is null || horloge.Maintenant - u.DerniereConnexion > TimeSpan.FromHours(1))
            u.DerniereConnexion = horloge.Maintenant;
        await db.SaveChangesAsync(annulation); // n'écrit rien si rien n'a changé
        return _utilisateur = u;
    }

    /// <summary>Le rôle Pilotage (ou Administrateur) donne accès en lecture à tous les projets.</summary>
    public bool VoitTousLesProjets =>
        courant.Roles.Contains(RolesGlobaux.Pilotage) || courant.Roles.Contains(RolesGlobaux.Administrateur);

    /// <summary>Peut créer un projet (import d'un TSP ou projet vide).</summary>
    public bool PeutCreerUnProjet =>
        courant.Roles.Contains(RolesGlobaux.ChefDeProjet) || courant.Roles.Contains(RolesGlobaux.Pilotage) || courant.Roles.Contains(RolesGlobaux.Administrateur);

    /// <summary>Rôle de l'utilisateur connecté sur un projet, ou null s'il n'y a pas accès.</summary>
    public async Task<RoleProjet?> RoleSurProjetAsync(Guid projetId, CancellationToken annulation = default)
    {
        var u = await UtilisateurAsync(annulation);
        var habilitation = await db.Habilitations.AsNoTracking()
            .FirstOrDefaultAsync(h => h.ProjetId == projetId && h.UtilisateurId == u.Id, annulation);
        if (habilitation is not null) return habilitation.Role;
        return VoitTousLesProjets ? RoleProjet.Pilotage : null;
    }

    /// <summary>
    /// Vérifie que l'utilisateur a accès au projet et renvoie son rôle.
    /// Sans accès, on répond « introuvable » : on ne révèle pas l'existence d'un projet auquel on n'a pas droit.
    /// </summary>
    public async Task<RoleProjet> ExigerAccesAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await RoleSurProjetAsync(projetId, annulation);
        if (role is null || !await db.Projets.AnyAsync(p => p.Id == projetId, annulation))
            throw new IntrouvableException("Projet introuvable.");
        return role.Value;
    }

    /// <summary>Exige le droit de modifier le projet (chef de projet).</summary>
    public async Task ExigerModificationAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await ExigerAccesAsync(projetId, annulation);
        if (!PeutModifier(role)) throw new AccesRefuseException("Seul le chef de projet peut modifier ce projet.");
        await RefuserSiArchiveAsync(projetId, annulation);
    }

    /// <summary>Exige le droit de saisir le consommé (chef de projet ou consultant du projet).</summary>
    public async Task ExigerSaisieConsommeAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await ExigerAccesAsync(projetId, annulation);
        if (!PeutSaisirConsomme(role)) throw new AccesRefuseException("Vous n'avez pas le droit de saisir le consommé sur ce projet.");
        await RefuserSiArchiveAsync(projetId, annulation);
    }

    /// <summary>Projet archivé (lecture seule pour tous).</summary>
    public Task<bool> EstArchiveAsync(Guid projetId, CancellationToken annulation = default) =>
        db.Projets.AnyAsync(p => p.Id == projetId && p.Statut == StatutProjet.Archive, annulation);

    /// <summary>Un projet archivé est en lecture seule : il faut d'abord le restaurer.</summary>
    private async Task RefuserSiArchiveAsync(Guid projetId, CancellationToken annulation)
    {
        if (await EstArchiveAsync(projetId, annulation))
            throw new RegleMetierException("Projet archivé : restaurez-le (⚙ Paramètres du projet) pour le modifier.");
    }

    /// <summary>Exige le droit d'exporter un support de comité (il contient des montants).</summary>
    public async Task<RoleProjet> ExigerExportAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await ExigerAccesAsync(projetId, annulation);
        if (!VoitMontants(role)) throw new AccesRefuseException("Les exports COPIL et COPROJ contiennent des montants : ils sont réservés au chef de projet et au pilotage.");
        return role;
    }

    /// <summary>Les montants (CA, coûts, marges) ne sont visibles que du chef de projet et du pilotage.</summary>
    public static bool VoitMontants(RoleProjet role) => role is RoleProjet.ChefDeProjet or RoleProjet.Pilotage;

    public static bool PeutModifier(RoleProjet role) => role == RoleProjet.ChefDeProjet;

    /// <summary>Le consultant saisit son consommé ; le chef de projet saisit tout.</summary>
    public static bool PeutSaisirConsomme(RoleProjet role) => role is RoleProjet.ChefDeProjet or RoleProjet.Consultant;
}
