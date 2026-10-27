using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Securite;

/// <summary>
/// Manages project-role and project-profile assignments. Every mutation is restricted to identities
/// carrying the server-derived assignment capability and is recorded in the project journal.
/// </summary>
public sealed class HabilitationsService(
    IContexteDonnees db,
    IUtilisateurCourant courant,
    ServiceAcces acces,
    IHorloge horloge,
    ServiceJournal journal,
    ILogger<HabilitationsService> traces)
{
    public async Task<IReadOnlyList<UtilisateurAffectationDto>> ListerUtilisateursAsync(CancellationToken annulation = default)
    {
        ExigerLectureUtilisateurs();
        return await db.Utilisateurs.AsNoTracking()
            .Where(utilisateur => utilisateur.Actif)
            .OrderBy(utilisateur => utilisateur.Nom)
            .ThenBy(utilisateur => utilisateur.Prenom)
            .Select(utilisateur => new UtilisateurAffectationDto(
                utilisateur.Id, utilisateur.Prenom, utilisateur.Nom, utilisateur.Email))
            .ToListAsync(annulation);
    }

    public async Task<IReadOnlyList<HabilitationProjetDto>> ListerAsync(Guid projetId, CancellationToken annulation = default)
    {
        ExigerAffectation();
        await ExigerProjetAsync(projetId, annulation);
        return await db.Habilitations.AsNoTracking()
            .Where(habilitation => habilitation.ProjetId == projetId)
            .OrderBy(habilitation => habilitation.Utilisateur!.Nom)
            .ThenBy(habilitation => habilitation.Utilisateur!.Prenom)
            .Select(habilitation => new HabilitationProjetDto(
                habilitation.UtilisateurId,
                habilitation.Utilisateur!.Prenom,
                habilitation.Utilisateur.Nom,
                habilitation.Utilisateur.Email,
                habilitation.Role))
            .ToListAsync(annulation);
    }

    public async Task DefinirActifAsync(Guid utilisateurId, bool actif, CancellationToken annulation = default)
    {
        if (!courant.Capacites.Contains(CapacitesApplication.UtilisateursAdministrer, StringComparer.Ordinal))
            throw new AccesRefuseException("Seul un administrateur de l'application peut activer ou désactiver un compte.");

        var cible = await db.Utilisateurs.FirstOrDefaultAsync(utilisateur => utilisateur.Id == utilisateurId, annulation)
            ?? throw new IntrouvableException("Utilisateur introuvable.");
        var acteur = await acces.UtilisateurAsync(annulation);
        if (!actif && cible.Id == acteur.Id)
            throw new RegleMetierException("Vous ne pouvez pas désactiver votre propre compte.");

        if (cible.Actif == actif) return;
        cible.Actif = actif;
        await db.SaveChangesAsync(annulation);
        traces.LogWarning(
            "Accès applicatif {Action} pour l'utilisateur {UtilisateurId}, modifié par {ActeurId}.",
            actif ? "activé" : "désactivé", cible.Id, acteur.Id);
    }

    public async Task AffecterAsync(
        Guid projetId,
        Guid utilisateurId,
        RoleProjet role,
        CancellationToken annulation = default)
    {
        ExigerAffectation();
        if (role is not (RoleProjet.ChefDeProjet or RoleProjet.Consultant or RoleProjet.Lecteur))
            throw new RegleMetierException("Le rôle de projet doit être ChefDeProjet, Consultant ou Lecteur.");

        await ExigerProjetAsync(projetId, annulation);
        var cible = await db.Utilisateurs.FirstOrDefaultAsync(
            utilisateur => utilisateur.Id == utilisateurId && utilisateur.Actif, annulation)
            ?? throw new IntrouvableException("Utilisateur actif introuvable.");

        var acteur = await acces.UtilisateurAsync(annulation);
        var existante = await db.Habilitations.FirstOrDefaultAsync(
            habilitation => habilitation.ProjetId == projetId && habilitation.UtilisateurId == cible.Id, annulation);
        var ancienRole = existante?.Role.ToString();

        if (existante is null)
        {
            db.Habilitations.Add(new Habilitation
            {
                ProjetId = projetId,
                UtilisateurId = cible.Id,
                Role = role,
                Depuis = horloge.Maintenant,
                AccordeeParId = acteur.Id
            });
        }
        else
        {
            existante.Role = role;
            existante.Depuis = horloge.Maintenant;
            existante.AccordeeParId = acteur.Id;
        }

        journal.Noter(projetId, acteur.Id, "Habilitation", cible.Id, "Rôle", ancienRole, role.ToString());
        await db.SaveChangesAsync(annulation);
    }

    public async Task RetirerAsync(Guid projetId, Guid utilisateurId, CancellationToken annulation = default)
    {
        ExigerAffectation();
        await ExigerProjetAsync(projetId, annulation);
        var existante = await db.Habilitations.FirstOrDefaultAsync(
            habilitation => habilitation.ProjetId == projetId && habilitation.UtilisateurId == utilisateurId, annulation)
            ?? throw new IntrouvableException("Affectation introuvable.");

        if (existante.Role == RoleProjet.ChefDeProjet)
        {
            var nombreChefs = await db.Habilitations.CountAsync(
                habilitation => habilitation.ProjetId == projetId && habilitation.Role == RoleProjet.ChefDeProjet,
                annulation);
            if (nombreChefs <= 1)
                throw new RegleMetierException("Impossible de retirer le dernier chef de projet. Affectez d'abord un autre chef de projet.");
        }

        var acteur = await acces.UtilisateurAsync(annulation);
        db.Habilitations.Remove(existante);
        journal.Noter(projetId, acteur.Id, "Habilitation", utilisateurId, "Rôle", existante.Role.ToString(), null);
        await db.SaveChangesAsync(annulation);
    }

    public async Task AffecterProfilAsync(
        Guid projetId,
        Guid profilId,
        Guid? utilisateurId,
        CancellationToken annulation = default)
    {
        ExigerAffectation();
        await ExigerProjetAsync(projetId, annulation);
        var profil = await db.Profils.FirstOrDefaultAsync(
            valeur => valeur.ProjetId == projetId && valeur.Id == profilId, annulation)
            ?? throw new IntrouvableException("Profil de projet introuvable.");

        if (utilisateurId is { } id)
        {
            var cible = await db.Utilisateurs.FirstOrDefaultAsync(
                utilisateur => utilisateur.Id == id && utilisateur.Actif, annulation)
                ?? throw new IntrouvableException("Utilisateur actif introuvable.");

            var estAffecteAuProjet = await db.Habilitations.AnyAsync(habilitation =>
                habilitation.ProjetId == projetId &&
                habilitation.UtilisateurId == cible.Id &&
                (habilitation.Role == RoleProjet.ChefDeProjet || habilitation.Role == RoleProjet.Consultant),
                annulation);
            if (!estAffecteAuProjet)
                throw new AccesRefuseException("L'utilisateur doit être affecté au projet comme chef de projet ou consultant avant de lui attribuer un profil.");
        }

        var acteur = await acces.UtilisateurAsync(annulation);
        var ancien = profil.UtilisateurId;
        profil.UtilisateurId = utilisateurId;
        journal.Noter(projetId, acteur.Id, "Profil", profil.Id, "Utilisateur affecté", ancien?.ToString(), utilisateurId?.ToString());
        await db.SaveChangesAsync(annulation);
    }

    private void ExigerLectureUtilisateurs()
    {
        if (!courant.Capacites.Contains(CapacitesApplication.UtilisateursLire, StringComparer.Ordinal))
            throw new AccesRefuseException("La consultation des utilisateurs est réservée aux responsables habilités.");
    }

    private void ExigerAffectation()
    {
        if (!courant.Capacites.Contains(CapacitesApplication.ProjetsAffecterUtilisateurs, StringComparer.Ordinal))
            throw new AccesRefuseException("La gestion des affectations est réservée aux responsables habilités.");
    }

    private async Task ExigerProjetAsync(Guid projetId, CancellationToken annulation)
    {
        if (!await db.Projets.AnyAsync(projet => projet.Id == projetId, annulation))
            throw new IntrouvableException("Projet introuvable.");
    }
}

public sealed record UtilisateurAffectationDto(Guid Id, string Prenom, string Nom, string Email);
public sealed record HabilitationProjetDto(Guid UtilisateurId, string Prenom, string Nom, string Email, RoleProjet Role);
