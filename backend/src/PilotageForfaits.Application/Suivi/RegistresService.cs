using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Registres du projet : actions, décisions, risques. Saisie directe dans le tableau (comme un Excel), règles du POC :
/// une ligne vide existante est réutilisée au lieu d'en créer une autre ; progression ⇔ statut pour les actions.
/// </summary>
public sealed class RegistresService(SaisieOutils o)
{
    /// <summary>Instances proposées (origine d'une action, instance d'une décision).</summary>
    public static readonly IReadOnlyList<string> Instances = ["COPROJ", "COPIL", "Réunion client", "Interne", "Autre"];

    /// <summary>Impacts proposés pour une décision.</summary>
    public static readonly IReadOnlyList<string> Impacts = ["", "Périmètre", "Planning", "Charge", "Coût", "Qualité", "Organisation"];

    // ------------------------------------------------------------------ actions

    public async Task<ResultatSaisieDto> CreerActionAsync(Guid projetId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var existantes = await o.Db.Actions.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var vide = existantes.OrderBy(x => x.Reference, StringComparer.Ordinal).FirstOrDefault(x => string.IsNullOrWhiteSpace(x.Libelle));
        if (vide is not null)
            return await o.TerminerAsync(projetId, new List<MessageDto> { new($"{vide.Reference} est encore sans libellé : complétez-la d’abord.") }, a, vide.Id.ToString());
        var action = new ActionProjet
        {
            ProjetId = projetId, Reference = SaisieOutils.ProchaineReference(existantes.Select(x => x.Reference), "A"), Libelle = "", Porteur = "",
            Instance = "COPROJ", CreeeLe = o.Aujourdhui, DateCible = o.Aujourdhui.AddDays(7), Progression = 0, Statut = StatutAction.AFaire,
            Commentaire = "", CreeeParId = u.Id,
        };
        o.Db.Actions.Add(action);
        o.Noter(projetId, u, "Action", action.Id, "création", null, action.Reference);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a, action.Id.ToString());
    }

    /// <summary>
    /// Modifie un champ d'une action. Progression et statut restent cohérents, comme pour les tâches :
    /// 100 % → « Fait » ; entre 0 et 100 % → « En cours » ; « Fait » → 100 % ; « À faire » → 0 %. « Fait le » est daté automatiquement.
    /// </summary>
    public async Task<ResultatSaisieDto> ModifierActionAsync(Guid projetId, Guid id, ChampCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Actions.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Action introuvable.");
        SaisieOutils.VerifierVersion(x, c.Version, $"L’action {x.Reference}");
        var messages = new List<MessageDto>();
        var v = c.Valeur;
        switch (c.Champ)
        {
            case "libelle": x.Libelle = Limiter(SaisieOutils.Nettoyer(v), 1000); break;
            case "porteur": x.Porteur = Limiter(SaisieOutils.Nettoyer(v), 400); break;
            case "origine": x.Instance = SaisieOutils.Nettoyer(v); break;
            case "echeance": x.DateCible = Formats.LireDate(v); break;
            case "commentaire": x.Commentaire = SaisieOutils.Nettoyer(v); break;
            case "tache":
                if (string.IsNullOrWhiteSpace(v)) x.TacheId = null;
                else x.TacheId = (await o.TacheAsync(projetId, v.Trim(), a)).Id;
                break;
            case "progression":
                var p = Formats.LireNombre(v) ?? 0;
                if (p < 0 || p > 1) throw new RegleMetierException("La progression doit être comprise entre 0 et 100 %.");
                x.Progression = p;
                if (p >= 1 && x.Statut != StatutAction.Fait)
                {
                    x.Statut = StatutAction.Fait;
                    messages.Add(new MessageDto($"{x.Reference} : progression 100 % → action passée « Fait »."));
                }
                else if (p > 0 && p < 1 && x.Statut is StatutAction.AFaire or StatutAction.Fait) x.Statut = StatutAction.EnCours;
                else if (p == 0 && x.Statut == StatutAction.Fait) x.Statut = StatutAction.AFaire;
                break;
            case "statut":
                var s = Formats.StatutAction(v);
                x.Statut = s;
                if (s == StatutAction.Fait) x.Progression = 1;
                else if (s == StatutAction.AFaire) x.Progression = 0;
                else if (s == StatutAction.EnCours && (x.Progression == 0 || x.Progression >= 1)) x.Progression = x.Progression >= 1 ? 0.75m : 0.25m;
                break;
            default:
                throw new RegleMetierException($"Champ inconnu : « {c.Champ} ».");
        }
        x.FaiteLe = x.Statut == StatutAction.Fait ? (DateOnly?)(x.FaiteLe ?? o.Aujourdhui) : null;
        o.Noter(projetId, u, "Action", x.Id, $"{x.Reference} · {c.Champ}", null, v);
        return await o.TerminerAsync(projetId, messages, a);
    }

    /// <summary>Remet une action dans un état précédent (bouton « Annuler » après « ✓ Fait »).</summary>
    public async Task<ResultatSaisieDto> RestaurerActionAsync(Guid projetId, Guid id, RestaurerActionCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Actions.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Action introuvable.");
        x.Statut = Formats.StatutAction(c.Statut);
        x.Progression = Math.Clamp(c.Progression, 0, 1);
        x.FaiteLe = x.Statut == StatutAction.Fait ? (DateOnly?)(c.FaitLe ?? o.Aujourdhui) : null;
        o.Noter(projetId, u, "Action", x.Id, $"{x.Reference} · retour en arrière", null, c.Statut);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    public async Task<ResultatSaisieDto> SupprimerActionAsync(Guid projetId, Guid id, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Actions.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Action introuvable.");
        foreach (var r in await o.Db.Risques.Where(r => r.ActionId == id).ToListAsync(a)) r.ActionId = null;
        o.Db.Actions.Remove(x);
        o.Noter(projetId, u, "Action", x.Id, "suppression", $"{x.Reference} {x.Libelle}", null);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    // ------------------------------------------------------------------ décisions

    public async Task<ResultatSaisieDto> CreerDecisionAsync(Guid projetId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var existantes = await o.Db.Decisions.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var vide = existantes.OrderBy(x => x.Reference, StringComparer.Ordinal).FirstOrDefault(x => string.IsNullOrWhiteSpace(x.Libelle));
        if (vide is not null)
            return await o.TerminerAsync(projetId, new List<MessageDto> { new($"{vide.Reference} est encore sans libellé : complétez-la d’abord.") }, a, vide.Id.ToString());
        var decision = new Decision
        {
            ProjetId = projetId, Reference = SaisieOutils.ProchaineReference(existantes.Select(x => x.Reference), "D"), Date = o.Aujourdhui,
            Instance = "COPROJ", Libelle = "", Decideur = "", Impact = "", Statut = StatutDecision.Validee, Commentaire = "", CreeeParId = u.Id,
        };
        o.Db.Decisions.Add(decision);
        o.Noter(projetId, u, "Décision", decision.Id, "création", null, decision.Reference);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a, decision.Id.ToString());
    }

    public async Task<ResultatSaisieDto> ModifierDecisionAsync(Guid projetId, Guid id, ChampCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Decisions.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Décision introuvable.");
        SaisieOutils.VerifierVersion(x, c.Version, $"La décision {x.Reference}");
        var v = c.Valeur;
        switch (c.Champ)
        {
            case "date": x.Date = Formats.LireDate(v) ?? throw new RegleMetierException("La date de la décision est obligatoire."); break;
            case "instance": x.Instance = SaisieOutils.Nettoyer(v); break;
            case "libelle": x.Libelle = Limiter(SaisieOutils.Nettoyer(v), 1000); break;
            case "decideur": x.Decideur = Limiter(SaisieOutils.Nettoyer(v), 400); break;
            case "impact": x.Impact = SaisieOutils.Nettoyer(v); break;
            case "statut": x.Statut = Formats.StatutDecision(v); break;
            case "commentaire": x.Commentaire = SaisieOutils.Nettoyer(v); break;
            default: throw new RegleMetierException($"Champ inconnu : « {c.Champ} ».");
        }
        o.Noter(projetId, u, "Décision", x.Id, $"{x.Reference} · {c.Champ}", null, v);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    public async Task<ResultatSaisieDto> SupprimerDecisionAsync(Guid projetId, Guid id, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Decisions.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Décision introuvable.");
        foreach (var e in await o.Db.Evolutions.Where(e => e.DecisionId == id).ToListAsync(a)) e.DecisionId = null;
        o.Db.Decisions.Remove(x);
        o.Noter(projetId, u, "Décision", x.Id, "suppression", $"{x.Reference} {x.Libelle}", null);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    // ------------------------------------------------------------------ risques

    public async Task<ResultatSaisieDto> CreerRisqueAsync(Guid projetId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var existants = await o.Db.Risques.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var vide = existants.OrderBy(x => x.Reference, StringComparer.Ordinal).FirstOrDefault(x => string.IsNullOrWhiteSpace(x.Libelle));
        if (vide is not null)
            return await o.TerminerAsync(projetId, new List<MessageDto> { new($"{vide.Reference} est encore sans libellé : complétez-le d’abord.") }, a, vide.Id.ToString());
        var risque = new Risque
        {
            ProjetId = projetId, Reference = SaisieOutils.ProchaineReference(existants.Select(x => x.Reference), "R"), Libelle = "",
            Probabilite = ProbabiliteRisque.Moderee, Impact = ImpactRisque.Moyenne, Parade = "", Responsable = "", Statut = StatutRisque.Ouvert,
            Commentaire = "", CreeLe = o.Horloge.Maintenant, CreeParId = u.Id,
        };
        o.Db.Risques.Add(risque);
        o.Noter(projetId, u, "Risque", risque.Id, "création", null, risque.Reference);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a, risque.Id.ToString());
    }

    public async Task<ResultatSaisieDto> ModifierRisqueAsync(Guid projetId, Guid id, ChampCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Risques.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Risque introuvable.");
        SaisieOutils.VerifierVersion(x, c.Version, $"Le risque {x.Reference}");
        var v = c.Valeur;
        switch (c.Champ)
        {
            case "libelle": x.Libelle = Limiter(SaisieOutils.Nettoyer(v), 1000); break;
            case "proba": x.Probabilite = Formats.Probabilite(v); break;
            case "impact": x.Impact = Formats.Impact(v); break;
            case "parade": x.Parade = SaisieOutils.Nettoyer(v); break;
            case "type": x.Type = Formats.TypeRisque(v); break;
            case "cause": x.Cause = SaisieOutils.Nettoyer(v); break;
            case "plan": x.Plan = SaisieOutils.Nettoyer(v); break;
            case "responsable": x.Responsable = Limiter(SaisieOutils.Nettoyer(v), 400); break;
            case "statut": x.Statut = Formats.StatutRisque(v); break;
            case "commentaire": x.Commentaire = SaisieOutils.Nettoyer(v); break;
            case "action":
                if (string.IsNullOrWhiteSpace(v)) x.ActionId = null;
                else
                {
                    if (!Guid.TryParse(v, out var actionId)) throw new RegleMetierException("Action invalide : saisie annulée.");
                    if (!await o.Db.Actions.AnyAsync(y => y.ProjetId == projetId && y.Id == actionId, a)) throw new IntrouvableException("Action introuvable.");
                    x.ActionId = actionId;
                }
                break;
            default: throw new RegleMetierException($"Champ inconnu : « {c.Champ} ».");
        }
        o.Noter(projetId, u, "Risque", x.Id, $"{x.Reference} · {c.Champ}", null, v);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    public async Task<ResultatSaisieDto> SupprimerRisqueAsync(Guid projetId, Guid id, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.Risques.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Risque introuvable.");
        o.Db.Risques.Remove(x);
        o.Noter(projetId, u, "Risque", x.Id, "suppression", $"{x.Reference} {x.Libelle}", null);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    private static string Limiter(string texte, int longueur) => texte.Length > longueur ? texte[..longueur] : texte;
}
