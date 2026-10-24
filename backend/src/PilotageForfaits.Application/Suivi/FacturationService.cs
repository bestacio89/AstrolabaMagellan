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
        var axeCode = SaisieOutils.Nettoyer(c.AxeCode);
        if (axeCode.Length > 50) throw new RegleMetierException("Code d’axe invalide.");
        var axe = axeCode.Length == 0 ? null : await o.Db.Axes.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == axeCode, a)
            ?? throw new IntrouvableException("Axe introuvable.");
        await using var transaction = await o.Db.Database.BeginTransactionAsync(a);
        var selection = axe is null ? (c.Phases ?? new List<string>()).Select(SaisieOutils.Nettoyer).Where(x => x.Length > 0).Distinct().ToList() : new List<string>();
        var tachesCochees = axe is null ? (c.Taches ?? new List<string>()).ToHashSet() : new HashSet<string>();
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
        if (axe is not null)
        {
            var autres = await o.Db.Echeances.Where(x => x.ProjetId == projetId && x.Id != e.Id && x.AxeCode == axe.Code).ToListAsync(a);
            if (autres.Count > 0)
            {
                e.AxeCode = null;
                foreach (var autre in autres) autre.AxeCode = null;
                await o.Db.SaveChangesAsync(a); // libère l’index unique avant d’affecter l’axe à une autre échéance
            }
            e.AxeCode = axe.Code;
            var phasesDeAxe = taches.Where(t => t.AxeId == axe.Id).Select(t => PhaseDe(t, phases)).Where(x => x.Length > 0).ToHashSet(StringComparer.Ordinal);
            var idsPhasesDeAxe = phases.Where(p => phasesDeAxe.Contains(p.Code)).Select(p => p.Id).ToHashSet();
            o.Db.LiensEcheancePhase.RemoveRange(liens.Where(l => idsPhasesDeAxe.Contains(l.PhaseId)).ToList());
            foreach (var t in taches.Where(t => t.AxeId == axe.Id)) t.EcheanceId = null;
        }
        foreach (var t in taches)
        {
            if (selection.Contains(PhaseDe(t, phases))) { t.EcheanceId = null; continue; } // suit la phase
            if (tachesCochees.Contains(t.Repere)) t.EcheanceId = e.Id;
            else if (t.EcheanceId == e.Id) t.EcheanceId = null;
        }
        if (axe is null) e.AxeCode = null;
        o.Noter(projetId, u, "Échéance", e.Id, $"n° {numero} · périmètre lié", null,
            string.Join(", ", (axe is null ? selection.Select(p => "phase " + p).Concat(tachesCochees) : new[] { "axe " + axe.Code })));
        var resultat = await o.TerminerAsync(projetId, new List<MessageDto>(), a, apres: m =>
        {
            var ech = m.Echeancier.First(x => x.N == numero);
            return new[]
            {
                new MessageDto($"Échéance n° {numero} : {ech.NLies} tâche(s) liée(s){(ech.Phases.Count > 0 ? $" (dont via {ech.Phases.Count} phase(s))" : "")}.", "succes"),
            };
        });
        await transaction.CommitAsync(a);
        return resultat;
    }

    /// <summary>
    /// Lie une échéance à un axe sans retirer par défaut les liens de phase : la phase reste prioritaire.
    /// Les phases explicitement demandées sont déliées, et les échéances individuelles des tâches de l'axe sont reprises.
    /// </summary>
    public async Task<ResultatSaisieDto> LierAxeAsync(Guid projetId, string code, LienAxeEcheanceCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        code = SaisieOutils.Nettoyer(code);
        if (code.Length == 0 || code.Length > 50) throw new RegleMetierException("Code d’axe invalide.");
        if (!string.Equals(SaisieOutils.Nettoyer(c.Axe), code, StringComparison.Ordinal))
            throw new RegleMetierException("Le code d’axe du corps de la requête ne correspond pas à l’axe demandé.");
        var axe = await o.Db.Axes.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == code, a)
            ?? throw new IntrouvableException("Axe introuvable.");
        var echeances = await o.Db.Echeances.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var actuelle = echeances.FirstOrDefault(x => x.AxeCode == code);
        if (c.Numero is null)
        {
            if (actuelle is null)
                return await o.TerminerAsync(projetId, new List<MessageDto> { new($"Axe {code} ne déclenche plus de facture.", "succes") }, a);
            if (actuelle.FactureeLe is not null)
                throw new RegleMetierException("Une échéance déjà facturée ne peut pas être déliée de son axe.");
            actuelle.AxeCode = null;
            o.Noter(projetId, u, "Axe", axe.Id, $"{code} · facturation", actuelle.Numero, null);
            return await o.TerminerAsync(projetId, new List<MessageDto> { new($"Axe {code} ne déclenche plus de facture.", "succes") }, a);
        }

        var cible = echeances.FirstOrDefault(x => x.Numero == c.Numero.Value)
            ?? throw new IntrouvableException("Échéance introuvable.");
        if (cible.FactureeLe is not null && cible.AxeCode != code)
            throw new RegleMetierException("Une échéance déjà facturée ne peut pas être affectée à un axe.");
        if (!string.IsNullOrEmpty(cible.AxeCode) && cible.AxeCode != code)
            throw new RegleMetierException($"L’échéance n° {cible.Numero} est déjà déclenchée par l’axe {cible.AxeCode}.");

        var taches = await o.Db.Taches.Where(t => t.ProjetId == projetId && !t.EstSection).ToListAsync(a);
        var phases = await o.Db.Phases.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var tachesAxe = taches.Where(t => t.AxeId == axe.Id).ToList();
        var phasesAxe = tachesAxe.Select(t => PhaseDe(t, phases)).Where(x => x.Length > 0).ToHashSet(StringComparer.Ordinal);
        var aDelier = (c.PhasesADelier ?? Array.Empty<string>()).Select(SaisieOutils.Nettoyer).Where(x => x.Length > 0).Distinct(StringComparer.Ordinal).ToHashSet(StringComparer.Ordinal);
        if (aDelier.Any(x => !phasesAxe.Contains(x)))
            throw new RegleMetierException("Une phase à délier ne contient aucune tâche de cet axe.");
        var phasesSelectionnees = phases.Where(p => aDelier.Contains(p.Code)).Select(p => p.Id).ToHashSet();
        var liens = await o.Db.LiensEcheancePhase.Where(x => x.ProjetId == projetId).ToListAsync(a);
        o.Db.LiensEcheancePhase.RemoveRange(liens.Where(x => phasesSelectionnees.Contains(x.PhaseId)).ToList());

        if (actuelle is not null && actuelle.Id != cible.Id)
        {
            if (actuelle.FactureeLe is not null)
                throw new RegleMetierException("L’échéance actuelle est déjà facturée ; son axe ne peut pas être déplacé.");
            actuelle.AxeCode = null;
            await o.Db.SaveChangesAsync(a); // libère l'index unique avant de lier la nouvelle échéance
        }
        cible.AxeCode = code;
        foreach (var t in tachesAxe) t.EcheanceId = null;
        o.Noter(projetId, u, "Axe", axe.Id, $"{code} · facturation", actuelle?.Numero, cible.Numero);
        return await o.TerminerAsync(projetId, new List<MessageDto>
        {
            new($"Axe {code} : déclenche l’échéance n° {cible.Numero}.", "succes"),
        }, a);
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
