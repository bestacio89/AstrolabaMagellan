using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Écran de suivi d'un projet : les saisies (forme du POC), les indicateurs recalculés et les droits de l'utilisateur.
/// Les montants sont retirés côté serveur pour les rôles qui ne doivent pas les voir.
/// </summary>
public sealed class SuiviService(IContexteDonnees db, ServiceAcces acces, ConstructeurProjetCalcul constructeur, IHorloge horloge)
{
    /// <summary>Mêmes réglages que l'API (noms en camelCase, listes de valeurs en texte).</summary>
    public static readonly JsonSerializerOptions OptionsJson = CreerOptions();

    private static JsonSerializerOptions CreerOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }

    /// <summary>Nombre d'entrées du journal envoyées à l'écran (les plus récentes).</summary>
    public const int TailleJournal = 60;

    public async Task<JsonObject> ObtenirAsync(Guid projetId, CancellationToken annulation = default)
    {
        var role = await acces.ExigerAccesAsync(projetId, annulation);
        return await ConstruireAsync(projetId, role, annulation);
    }

    /// <summary>Construit le suivi pour un rôle donné (le droit d'accès doit déjà avoir été vérifié).</summary>
    public async Task<JsonObject> ConstruireAsync(Guid projetId, RoleProjet role, CancellationToken annulation = default) =>
        (await ConstruireAvecModeleAsync(projetId, role, annulation)).Json;

    /// <summary>Construit le suivi et renvoie aussi les indicateurs calculés (utiles pour les messages après une saisie).</summary>
    public async Task<(JsonObject Json, ResultatCalcul Modele)> ConstruireAvecModeleAsync(Guid projetId, RoleProjet role, CancellationToken annulation = default)
    {
        var donnees = await constructeur.ChargerDonneesAsync(projetId, annulation);
        var calcul = ConstructeurProjetCalcul.Construire(donnees);
        var modele = MoteurCalcul.Calculer(calcul, horloge.Aujourdhui);
        var journal = await db.Journal.AsNoTracking().Where(j => j.ProjetId == projetId)
            .OrderByDescending(j => j.Le).Take(TailleJournal).ToListAsync(annulation);
        var ids = journal.Where(j => j.UtilisateurId is not null).Select(j => j.UtilisateurId!.Value).Distinct().ToList();
        var noms = await db.Utilisateurs.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.NomComplet, annulation);
        var utilisateur = await acces.UtilisateurAsync(annulation);
        // projet archivé : lecture seule pour tous (il faut le restaurer pour le modifier)
        var archive = donnees.Projet.Statut == StatutProjet.Archive;

        var pointsHebdo = await db.PointsHebdo.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var auteursPh = pointsHebdo.Where(x => x.ParId is not null).Select(x => x.ParId!.Value).Distinct().ToList();
        var nomsPh = await db.Utilisateurs.AsNoTracking().Where(u => auteursPh.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.NomComplet, annulation);
        var suivi = new SuiviDto
        {
            Projet = ConstructeurVueSuivi.Construire(donnees, calcul, journal, noms, await ComplementsAsync(projetId, donnees.Taches, annulation),
                donnees.Projet.StatutAffiche(horloge.Aujourdhui, modele.Total.Conso > 0)),
            Modele = modele,
            Droits = new DroitsDto
            {
                Role = role.ToString(), RoleLibelle = Libelles.De(role), PeutModifier = acces.PeutModifierSurProjet(role) && !archive,
                PeutSaisirConsomme = acces.PeutSaisirConsommeSurProjet(role) && !archive, VoitMontants = acces.PeutVoirMontants(role),
                Archive = archive, EstChefDeProjet = acces.PeutModifierSurProjet(role),
                PeutExporter = acces.PeutVoirMontants(role), Utilisateur = utilisateur.NomComplet,
            },
            Aujourdhui = horloge.Aujourdhui,
        };
        suivi.Projet.PointsHebdo = PointsHebdoService.Vue(pointsHebdo, nomsPh);
        var json = JsonSerializer.SerializeToNode(suivi, OptionsJson)!.AsObject();
        if (!acces.PeutVoirMontants(role)) FiltreMontants.Appliquer(json);
        return (json, modele);
    }

    /// <summary>Nombre de messages du fil envoyés par tâche (les plus récents).</summary>
    public const int TailleFil = 50;

    /// <summary>Plannings de référence et fil de mises à jour des tâches, avec le nom de leurs auteurs.</summary>
    private async Task<ComplementsVue> ComplementsAsync(Guid projetId, IReadOnlyList<Tache> taches, CancellationToken annulation)
    {
        var repere = taches.ToDictionary(t => t.Id, t => t.Repere);
        var axes = await db.Axes.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var lots = await db.Lots.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var plans = await db.PlansReference.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var lignes = await db.LignesPlanReference.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var messages = await db.Commentaires.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var ids = plans.Select(p => p.FigeParId).Concat(messages.Select(m => m.AuteurId)).Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        var noms = await db.Utilisateurs.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.NomComplet, annulation);
        string? Nom(Guid? id) => id is { } v && noms.TryGetValue(v, out var n) ? n : null;
        var lignesParPlan = lignes.ToLookup(l => l.PlanReferenceId);

        var references = plans.OrderBy(p => p.Date).ThenBy(p => p.Libelle, StringComparer.Ordinal).Select(p => new ReferenceVueDto
        {
            Id = p.Id, Libelle = p.Libelle, Date = p.Date, Par = Nom(p.FigeParId),
            Lignes = lignesParPlan[p.Id].Where(l => repere.ContainsKey(l.TacheId)).ToDictionary(l => repere[l.TacheId], l => new LigneReferenceVueDto
            {
                Version = l.Version, Debut = l.DebutPrevu, Fin = l.FinPrevue, Charge = l.ChargePrevue, Cause = l.Cause, Motif = l.Motif,
            }),
        }).ToList();
        // Les listes sont triées en mémoire : les dates UTC sont comparées de façon identique sur tous les fournisseurs.
        string? Cle(Commentaire m) => m.CibleType switch
        {
            "Tache" when repere.TryGetValue(m.CibleId, out var uid) => uid,
            "Action" => "act:" + m.CibleId,
            "Decision" => "dec:" + m.CibleId,
            "Risque" => "rk:" + m.CibleId,
            _ => null,
        };
        var commentaires = messages.Select(m => (Cle: Cle(m), Message: m)).Where(x => x.Cle is not null)
            .GroupBy(x => x.Cle!).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Message.Le).Select(x =>
                new CommentaireVueDto(x.Message.Id, new DateTimeOffset(DateTime.SpecifyKind(x.Message.Le, DateTimeKind.Utc)),
                    Nom(x.Message.AuteurId) ?? "", x.Message.AuteurId, x.Message.Texte,
                    x.Message.ModifieLe is { } modifie ? new DateTimeOffset(DateTime.SpecifyKind(modifie, DateTimeKind.Utc)) : null)).ToList());
        var fil = messages.Where(m => m.CibleType == "Tache" && repere.ContainsKey(m.CibleId)).GroupBy(m => repere[m.CibleId]).ToDictionary(
            g => g.Key,
            g => g.OrderByDescending(m => m.Le).Take(TailleFil)
                .Select(m => new MiseAJourVueDto(new DateTimeOffset(DateTime.SpecifyKind(m.Le, DateTimeKind.Utc)), Nom(m.AuteurId) ?? "", m.Texte)).ToList());
        return new ComplementsVue(references, fil,
            axes.GroupBy(x => x.Code).ToDictionary(g => g.Key, g => g.First().DateLimite),
            lots.GroupBy(x => x.Code).ToDictionary(g => g.Key, g => g.First().Nom), commentaires);
    }
}
