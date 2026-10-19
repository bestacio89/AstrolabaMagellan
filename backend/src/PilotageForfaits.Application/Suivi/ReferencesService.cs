using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Planning de référence : le chef de projet « fige » le planning à une date (dates prévues et charge de chaque tâche),
/// puis le Gantt compare le planning actuel à cette référence. Chaque dérive peut recevoir une cause et un motif.
/// Une référence ne se modifie pas (seuls la cause et le motif de chaque écart se renseignent) et ne se supprime pas.
/// </summary>
public sealed class ReferencesService(SaisieOutils o)
{
    /// <summary>Nombre maximal de références par projet (au-delà, la comparaison n'a plus de sens à l'écran).</summary>
    public const int Maximum = 20;

    /// <summary>Fige le planning actuel : une ligne par tâche (hors titres de section et tâches annulées).</summary>
    public async Task<ResultatSaisieDto> FigerAsync(Guid projetId, FigerReferenceCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var nombre = await o.Db.PlansReference.CountAsync(x => x.ProjetId == projetId, a);
        if (nombre >= Maximum) throw new RegleMetierException($"Ce projet a déjà {Maximum} références : c’est le maximum.");
        var calcul = await o.CalculerAsync(projetId, a);
        var taches = await o.Db.Taches.AsNoTracking().Where(t => t.ProjetId == projetId && !t.EstSection).ToListAsync(a);
        var parRepere = taches.ToDictionary(t => t.Repere);
        var libelle = SaisieOutils.Nettoyer(c.Libelle);
        if (libelle.Length == 0) libelle = nombre == 0 ? "Référence initiale" : $"Référence {nombre + 1}";
        if (libelle.Length > 200) libelle = libelle[..200];

        var plan = new PlanReference { ProjetId = projetId, Date = o.Aujourdhui, Libelle = libelle, FigeParId = u.Id };
        foreach (var t in calcul.Tasks.Where(x => !x.Annulee))
        {
            if (!parRepere.TryGetValue(t.Uid, out var tache)) continue;
            plan.Lignes.Add(new LignePlanReference
            {
                ProjetId = projetId, PlanReferenceId = plan.Id, TacheId = tache.Id,
                DebutPrevu = tache.DebutPrevu, FinPrevue = tache.FinPrevue, ChargePrevue = t.Charge,
            });
        }
        o.Db.PlansReference.Add(plan);
        o.Noter(projetId, u, "Planning", plan.Id, "référence figée", null, libelle);
        var datees = plan.Lignes.Count(l => l.FinPrevue is not null);
        var message = datees == 0
            ? $"« {libelle} » figée, mais aucune tâche n’a encore de date : le Gantt n’aura rien à comparer."
            : $"« {libelle} » figée : {datees} tâche(s) datée(s). Le Gantt compare désormais le planning à cette référence.";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, datees == 0 ? "attention" : "succes") }, a);
    }

    /// <summary>Cause et motif de l'écart d'une tâche par rapport à une référence (vides : effacés).</summary>
    public async Task<ResultatSaisieDto> DefinirDeriveAsync(Guid projetId, Guid referenceId, string uid, DeriveCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var ligne = await o.Db.LignesPlanReference.FirstOrDefaultAsync(l => l.ProjetId == projetId && l.PlanReferenceId == referenceId && l.TacheId == t.Id, a)
            ?? throw new IntrouvableException("Cette tâche ne figure pas dans la référence (elle a été ajoutée ou annulée après).");
        SaisieOutils.VerifierVersion(ligne, c.Version, "L’écart de cette tâche");
        var cause = SaisieOutils.Nettoyer(c.Cause);
        if (cause.Length > 0 && !CausesDerive.Liste.Contains(cause))
            throw new RegleMetierException($"Cause inconnue : choisissez parmi {string.Join(", ", CausesDerive.Liste)}.");
        var motif = SaisieOutils.Nettoyer(c.Motif);
        var ancienne = Texte(ligne.Cause, ligne.Motif);
        ligne.Cause = cause.Length > 0 ? cause : null;
        ligne.Motif = motif.Length > 0 ? motif : null;
        o.Noter(projetId, u, "Planning", t.Id, $"{SaisiesTachesService.Libelle(t)} · motif de l’écart", ancienne, Texte(ligne.Cause, ligne.Motif));
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    private static string? Texte(string? cause, string? motif) =>
        cause is null && motif is null ? null : string.Join(" : ", new[] { cause, motif }.Where(x => !string.IsNullOrEmpty(x)));
}
