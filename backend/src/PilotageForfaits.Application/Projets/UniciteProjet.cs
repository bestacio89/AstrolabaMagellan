using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Projets;

/// <summary>
/// Projet déjà suivi pour le même forfait. « Visible » : l'utilisateur y a accès (alors on lui dit lequel, et comment le retrouver) ;
/// sinon on lui dit seulement qu'il existe, sans en révéler le nom.
/// </summary>
public sealed record ProjetExistantDto(Guid? Id, string? Libelle, string Statut, bool Archive, bool Visible, string Message);

/// <summary>
/// Un même forfait n'est jamais suivi deux fois : avant de créer un projet (import d'un TSP, projet vide) ou de changer sa fiche,
/// on cherche un projet de même identité (voir <see cref="IdentiteProjet"/>), quel que soit son statut — archivé compris :
/// un projet terminé se restaure, il ne se réimporte pas. Seul un projet supprimé (créé par erreur) libère son identité.
/// L'index unique de la base garantit la règle même si deux imports arrivent en même temps.
/// </summary>
public sealed class UniciteProjet(IContexteDonnees db, ServiceAcces acces)
{
    /// <summary>Projet existant de même identité (autre que « sauf »), ou null.</summary>
    public async Task<ProjetExistantDto?> ChercherAsync(string? reference, string? client, string? nom, Guid? sauf, CancellationToken annulation = default)
    {
        var cle = IdentiteProjet.Cle(reference, client, nom);
        var existant = await db.Projets.AsNoTracking().FirstOrDefaultAsync(p => p.CleUnicite == cle && (sauf == null || p.Id != sauf), annulation);
        if (existant is null) return null;

        var visible = await acces.RoleSurProjetAsync(existant.Id, annulation) is not null;
        var archive = existant.Statut == StatutProjet.Archive;
        var quoi = IdentiteProjet.NumeroOpportunite(reference) is { } op ? $"l’opportunité OP{op}"
            : cle.StartsWith("REF:", StringComparison.Ordinal) ? "cette référence" : "ce client et ce nom de projet";
        string message;
        if (!visible)
            message = $"Un projet existe déjà pour {quoi}, mais vous n’y avez pas accès. Demandez à son chef de projet ou au pilotage de vous y habiliter.";
        else
        {
            var libelle = $"« {existant.Client} — {existant.Nom} »";
            message = archive
                ? $"Ce forfait est déjà suivi dans le projet {libelle}, archivé. Restaurez-le (⚙ Paramètres du projet) : son historique est conservé."
                : $"Ce forfait est déjà suivi dans le projet {libelle}. Ouvrez-le depuis l’accueil : un forfait ne se suit qu’une fois.";
            var versionExistante = IdentiteProjet.Version(existant.Reference);
            var nouvelleVersion = IdentiteProjet.Version(reference);
            if (nouvelleVersion is not null && versionExistante is not null && nouvelleVersion != versionExistante)
                message += $" Ce fichier est une autre version du TSP ({nouvelleVersion}, le projet suit la {versionExistante}) : la reprise d’une nouvelle version dans le projet existant (avenant) est à venir.";
        }
        return new ProjetExistantDto(visible ? existant.Id : null, visible ? $"{existant.Client} — {existant.Nom}" : null,
            archive ? "Archivé" : "Actif", archive, visible, message);
    }

    /// <summary>Refuse la création (ou la modification de la fiche) si le forfait est déjà suivi.</summary>
    public async Task ExigerLibreAsync(string? reference, string? client, string? nom, Guid? sauf, CancellationToken annulation = default)
    {
        if (await ChercherAsync(reference, client, nom, sauf, annulation) is { } existant) throw new RegleMetierException(existant.Message);
    }
}
