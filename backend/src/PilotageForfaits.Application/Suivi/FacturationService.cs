using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Facturation : dates des échéances (prévue, facturée le, payée le) et périmètre lié (phases et tâches qui conditionnent la facture).
/// Règles du POC : une date de facture ou de paiement n'est jamais dans le futur ; le paiement suit la facture ;
/// le montant est figé à la facturation ; une phase n'est liée qu'à une seule échéance et s'impose à toutes ses tâches.
/// </summary>
public sealed class FacturationService(SaisieOutils o)
{
    public async Task<ResultatSaisieDto> DefinirDateAsync(Guid projetId, int numero, EcheanceDateCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var e = await EcheanceAsync(projetId, numero, a);
        SaisieOutils.VerifierVersion(e, c.Version, "L’échéance");
        var messages = new List<MessageDto>();
        switch (c.Champ)
        {
            case "datePrevue":
                o.Noter(projetId, u, "Échéance", e.Id, $"n° {numero} · date prévue", e.DatePrevue, c.Valeur);
                e.DatePrevue = c.Valeur;
                break;
            case "realiseLe":
                o.Noter(projetId, u, "Échéance", e.Id, $"n° {numero} · facturée le", e.FactureeLe, c.Valeur);
                if (c.Valeur is null) e.AnnulerFacturation(); // pas de paiement sans facture
                else
                {
                    var premiere = e.FactureeLe is null;
                    // montant affiché à ce moment-là (un avenant ultérieur ne modifie plus une facture émise)
                    var montant = (await o.CalculerAsync(projetId, a)).Echeancier.First(x => x.N == numero).Montant;
                    e.Facturer(c.Valeur.Value, montant, o.Aujourdhui);
                    if (premiere)
                        messages.Add(new MessageDto(
                            $"Échéance n° {numero} indiquée facturée {(c.Valeur == o.Aujourdhui ? "aujourd’hui" : "le " + Formats.Date(c.Valeur.Value))} ({Formats.Euros(e.MontantFacture ?? 0)}).",
                            "succes", "annuler-facture", numero.ToString(System.Globalization.CultureInfo.InvariantCulture), "Annuler"));
                }
                break;
            case "payeeLe":
                o.Noter(projetId, u, "Échéance", e.Id, $"n° {numero} · payée le", e.PayeeLe, c.Valeur);
                e.EnregistrerPaiement(c.Valeur, o.Aujourdhui);
                break;
            default:
                throw new RegleMetierException($"Champ inconnu : « {c.Champ} ».");
        }
        return await o.TerminerAsync(projetId, messages, a);
    }

    /// <summary>
    /// Lie une échéance à des phases (toutes leurs tâches, y compris celles ajoutées plus tard) et/ou à des tâches.
    /// Une phase n'appartient qu'à une échéance : la cocher la retire des autres. Une tâche dont la phase est liée suit sa phase.
    /// </summary>
    public async Task<ResultatSaisieDto> LierPerimetreAsync(Guid projetId, int numero, PerimetreEcheanceCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var e = await EcheanceAsync(projetId, numero, a);
        var selection = (c.Phases ?? new List<string>()).Select(SaisieOutils.Nettoyer).Where(x => x.Length > 0).Distinct().ToList();
        var tachesCochees = (c.Taches ?? new List<string>()).ToHashSet();

        var phases = await o.Db.Phases.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var liens = await o.Db.LiensEcheancePhase.Where(x => x.ProjetId == projetId).ToListAsync(a);
        // liens de cette échéance qui ne sont plus voulus
        foreach (var lien in liens.Where(l => l.EcheanceId == e.Id))
        {
            var code = phases.FirstOrDefault(p => p.Id == lien.PhaseId)?.Code;
            if (code is null || !selection.Contains(code)) o.Db.LiensEcheancePhase.Remove(lien);
        }
        foreach (var code in selection)
        {
            var phase = phases.FirstOrDefault(p => p.Code == code);
            if (phase is null)
            {
                phase = new Phase { ProjetId = projetId, Code = code, Ordre = phases.Count == 0 ? 0 : phases.Max(p => p.Ordre) + 1, ListeReference = false };
                o.Db.Phases.Add(phase);
                phases.Add(phase);
            }
            var lien = liens.FirstOrDefault(l => l.PhaseId == phase.Id);
            if (lien is null) o.Db.LiensEcheancePhase.Add(new LienEcheancePhase { ProjetId = projetId, EcheanceId = e.Id, PhaseId = phase.Id });
            else lien.EcheanceId = e.Id; // la phase quitte son ancienne échéance
        }

        var taches = await o.Db.Taches.Where(t => t.ProjetId == projetId && !t.EstSection).ToListAsync(a);
        foreach (var t in taches)
        {
            if (selection.Contains(PhaseDe(t, phases))) { t.EcheanceId = null; continue; } // suit la phase
            if (tachesCochees.Contains(t.Repere)) t.EcheanceId = e.Id;
            else if (t.EcheanceId == e.Id) t.EcheanceId = null;
        }
        o.Noter(projetId, u, "Échéance", e.Id, $"n° {numero} · périmètre lié", null,
            string.Join(", ", selection.Select(p => "phase " + p).Concat(tachesCochees)));
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a, apres: m =>
        {
            var ech = m.Echeancier.First(x => x.N == numero);
            return new[]
            {
                new MessageDto($"Échéance n° {numero} : {ech.NLies} tâche(s) liée(s){(ech.Phases.Count > 0 ? $" (dont via {ech.Phases.Count} phase(s))" : "")}.", "succes"),
            };
        });
    }

    /// <summary>
    /// Échéance d'une phase : elle s'applique à toutes les tâches de la phase, actuelles et futures,
    /// et remplace les échéances individuelles de ces tâches.
    /// </summary>
    public async Task<ResultatSaisieDto> DefinirEcheancePhaseAsync(Guid projetId, string code, EcheancePhaseCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var phases = await o.Db.Phases.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var phase = phases.FirstOrDefault(p => p.Code == code);
        var liens = await o.Db.LiensEcheancePhase.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var lien = phase is null ? null : liens.FirstOrDefault(l => l.PhaseId == phase.Id);
        var taches = await o.Db.Taches.Where(t => t.ProjetId == projetId && !t.EstSection).ToListAsync(a);
        var tachesPhase = taches.Where(t => PhaseDe(t, phases) == code).ToList();
        if (tachesPhase.Count == 0) throw new IntrouvableException("Phase introuvable.");
        string message;
        if (c.Numero is null)
        {
            if (lien is not null) o.Db.LiensEcheancePhase.Remove(lien);
            message = $"Phase {code} : échéance retirée. Les tâches peuvent à nouveau avoir leur propre échéance.";
        }
        else
        {
            var e = await EcheanceAsync(projetId, c.Numero.Value, a);
            if (phase is null)
            {
                phase = new Phase { ProjetId = projetId, Code = code, Ordre = phases.Count == 0 ? 0 : phases.Max(p => p.Ordre) + 1, ListeReference = false };
                o.Db.Phases.Add(phase);
            }
            if (lien is null) o.Db.LiensEcheancePhase.Add(new LienEcheancePhase { ProjetId = projetId, EcheanceId = e.Id, PhaseId = phase.Id });
            else lien.EcheanceId = e.Id;
            foreach (var t in tachesPhase) t.EcheanceId = null;
            message = $"Phase {code} liée à l’échéance n° {e.Numero} ({tachesPhase.Count} tâches).";
        }
        o.Noter(projetId, u, "Phase", phase?.Id, $"{code} · échéance", null, c.Numero);
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    private async Task<Echeance> EcheanceAsync(Guid projetId, int numero, CancellationToken a) =>
        await o.Db.Echeances.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Numero == numero, a)
        ?? throw new IntrouvableException("Échéance introuvable.");

    /// <summary>Phase d'une tâche : celle choisie en cours de projet, sinon celle du TSP.</summary>
    private static string PhaseDe(Tache t, List<Phase> phases) =>
        t.PhaseId is { } id && phases.FirstOrDefault(p => p.Id == id) is { Code.Length: > 0 } phase ? phase.Code : t.PhaseTsp;
}
