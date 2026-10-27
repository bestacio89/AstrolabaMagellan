using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Securite;

/// <summary>
/// Central enforcement of effective capabilities and project assignments.
/// A group-derived capability is necessary but does not replace project membership;
/// project membership is necessary but does not grant capabilities by itself.
/// </summary>
public sealed class ServiceAcces(IContexteDonnees db, IUtilisateurCourant courant, IHorloge horloge)
{
    private Utilisateur? _utilisateur;

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
        // Conservé pour l'administration locale du compte ; ce drapeau ne donne pas à lui seul accès aux projets.
        u.Administrateur = courant.Roles.Contains(RolesGlobaux.Admin);
        if (u.DerniereConnexion is null || horloge.Maintenant - u.DerniereConnexion > TimeSpan.FromHours(1))
            u.DerniereConnexion = horloge.Maintenant;
        await db.SaveChangesAsync(annulation);
        return _utilisateur = u;
    }

    private bool A(string capacite) => courant.Capacites.Contains(capacite, StringComparer.Ordinal);

    public bool VoitTousLesProjets => A(CapacitesAcces.ProjetsLireTous);
    public bool PeutLireProjets => A(CapacitesAcces.ProjetsLire) || VoitTousLesProjets;
    public bool PeutCreerUnProjet => A(CapacitesAcces.ProjetsCreer);

    /// <summary>
    /// Liste uniquement les identifiants de projets lisibles par l'utilisateur.
    /// Une capacité globale de pilotage élargit le périmètre; elle ne modifie pas les capacités d'écriture.
    /// </summary>
    public async Task<IReadOnlyList<Guid>> ProjetsAccessiblesAsync(CancellationToken annulation = default)
    {
        if (!PeutLireProjets) return Array.Empty<Guid>();

        if (VoitTousLesProjets)
        {
            return await db.Projets.AsNoTracking()
                .OrderBy(p => p.Id)
                .Select(p => p.Id)
                .ToListAsync(annulation);
        }

        var utilisateur = await UtilisateurAsync(annulation);
        return await db.Habilitations.AsNoTracking()
            .Where(h => h.UtilisateurId == utilisateur.Id)
            .OrderBy(h => h.ProjetId)
            .Select(h => h.ProjetId)
            .ToListAsync(annulation);
    }

    /// <summary>Role du projet seulement si l'utilisateur a la capacité de lecture et une affectation, ou la capacité globale de pilotage.</summary>
    public async Task<RoleProjet?> RoleSurProjetAsync(Guid projetId, CancellationToken annulation = default)
    {
        if (!PeutLireProjets) return null;

        var u = await UtilisateurAsync(annulation);
        var habilitation = await db.Habilitations.AsNoTracking()
            .FirstOrDefaultAsync(h => h.ProjetId == projetId && h.UtilisateurId == u.Id, annulation);
        if (habilitation is not null) return habilitation.Role;
        return VoitTousLesProjets ? RoleProjet.Pilotage : null;
    }

    /// <summary>Sans capacité et affectation adéquates, on ne révèle pas l'existence du projet.</summary>
    public async Task<RoleProjet> ExigerAccesAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await RoleSurProjetAsync(projetId, annulation);
        if (role is null || !await db.Projets.AnyAsync(p => p.Id == projetId, annulation))
            throw new IntrouvableException("Projet introuvable.");
        return role.Value;
    }

    public async Task ExigerModificationAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await ExigerAccesAsync(projetId, annulation);
        if (!PeutModifierSurProjet(role))
            throw new AccesRefuseException("La capacité de modification et le rôle de chef de projet sont requis.");
        await RefuserSiArchiveAsync(projetId, annulation);
    }

    public async Task ExigerSaisieConsommeAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await ExigerAccesAsync(projetId, annulation);
        if (!PeutSaisirConsommeSurProjet(role))
            throw new AccesRefuseException("La capacité de saisie et un rôle de chef de projet ou consultant sont requis.");
        await RefuserSiArchiveAsync(projetId, annulation);
    }

    public Task<bool> EstArchiveAsync(Guid projetId, CancellationToken annulation = default) =>
        db.Projets.AnyAsync(p => p.Id == projetId && p.Statut == StatutProjet.Archive, annulation);

    private async Task RefuserSiArchiveAsync(Guid projetId, CancellationToken annulation)
    {
        if (await EstArchiveAsync(projetId, annulation))
            throw new RegleMetierException("Projet archivé : restaurez-le (⚙ Paramètres du projet) pour le modifier.");
    }

    public async Task<RoleProjet> ExigerExportAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await ExigerAccesAsync(projetId, annulation);
        if (!PeutVoirMontants(role))
            throw new AccesRefuseException("La capacité d'export financier et un rôle de chef de projet ou pilotage sont requis.");
        return role;
    }

    public bool PeutVoirMontants(RoleProjet role) =>
        A(CapacitesAcces.ExportsFinanciers) && VoitMontants(role);

    public bool PeutModifierSurProjet(RoleProjet role) =>
        A(CapacitesAcces.ProjetsModifier) && PeutModifier(role);

    public bool PeutSaisirConsommeSurProjet(RoleProjet role) =>
        A(CapacitesAcces.ConsommeSaisir) && PeutSaisirConsomme(role);

    public static bool VoitMontants(RoleProjet role) => role is RoleProjet.ChefDeProjet or RoleProjet.Pilotage;
    public static bool PeutModifier(RoleProjet role) => role == RoleProjet.ChefDeProjet;
    public static bool PeutSaisirConsomme(RoleProjet role) => role is RoleProjet.ChefDeProjet or RoleProjet.Consultant;
}
