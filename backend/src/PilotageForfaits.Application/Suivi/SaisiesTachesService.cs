using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Saisies sur une tâche : statut, avancement, reste à faire, dates prévues, intitulé, commentaire, classement,
/// bilan IA, échéance liée et consommé. Règles reprises de la version de référence (POC v65, fonction setField).
/// </summary>
public sealed class SaisiesTachesService(SaisieOutils o)
{
    // ------------------------------------------------------------------ statut et avancement

    /// <summary>
    /// Statut. Validé ⇔ 100 % : valider met l'avancement à 100 %, efface le RAF saisi et retient la date de validation ;
    /// rouvrir une tâche validée ramène l'avancement à 75 % (0 % si « À faire ») et retire la validation client du livrable.
    /// </summary>
    public async Task<ResultatSaisieDto> DefinirStatutAsync(Guid projetId, string uid, StatutCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var nouveau = Formats.StatutTache(c.Statut);
        var avant = (await o.CalculerAsync(projetId, a)).Tasks.First(x => x.Uid == uid);
        var etaitValidee = avant.Statut == ReferentielsMetier.StatutValide;
        var messages = new List<MessageDto>();

        var ramene = t.DefinirStatut(nouveau, o.Aujourdhui);
        if (nouveau == StatutTache.Valide)
        {
            if (!etaitValidee && !(avant.ConsoTotal > 0))
                messages.Add(new MessageDto("Tâche validée sans aucun consommé : pensez à saisir le temps passé, sinon elle affiche une économie fictive.", "attention"));
            if (!etaitValidee && avant.Ia > 0)
                messages.Add(new MessageDto("Tâche validée : faites le bilan de son enveloppe IA.", "info", "bilan-ia", uid, "Faire le bilan"));
        }
        else if (nouveau == StatutTache.AFaire && avant.ConsoTotal > 0 && !etaitValidee)
            messages.Add(new MessageDto($"Attention : {Formats.Jh(avant.ConsoTotal)} JH déjà consommés sur cette tâche. « À faire » est conservé, mais « En cours » serait plus juste.", "attention"));

        if (nouveau != StatutTache.Valide && etaitValidee)
        {
            // livrable rouvert : la validation client portait sur la version précédente
            var livrable = await o.Db.Livrables.FirstOrDefaultAsync(l => l.TacheId == t.Id, a);
            if (livrable?.ValideParClientLe is { } vl)
            {
                livrable.ValideParClientLe = null;
                if (string.IsNullOrEmpty(livrable.LienStockage)) o.Db.Livrables.Remove(livrable);
                messages.Add(new MessageDto($"Livrable rouvert : la validation client du {Formats.Date(vl)} est retirée (elle portait sur la version précédente)."));
            }
        }
        if (ramene)
            messages.Add(new MessageDto(nouveau == StatutTache.AFaire
                ? "Tâche remise « À faire » : avancement ramené à 0 %."
                : "Tâche rouverte : avancement ramené à 75 %. Ajustez-le si besoin."));

        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · statut", avant.Statut, Libelles.De(nouveau));
        return await o.TerminerAsync(projetId, messages, a);
    }

    /// <summary>Avancement. Sous 100 %, une tâche validée repasse « En cours » ; à 100 %, on propose de la valider.</summary>
    public async Task<ResultatSaisieDto> DefinirAvancementAsync(Guid projetId, string uid, AvancementCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var etaitValidee = t.Statut == StatutTache.Valide;
        var ancien = t.Avancement;
        var proposer = t.DefinirAvancement(c.Avancement);
        var messages = new List<MessageDto>();
        if (etaitValidee && c.Avancement < 1)
            messages.Add(new MessageDto($"Avancement {Formats.Pourcent(c.Avancement)} : la tâche n’est plus validée, elle repasse « En cours »."));
        if (proposer)
            messages.Add(new MessageDto("Avancement 100 % : la tâche est-elle terminée ?", "info", "valider-tache", uid, "La valider"));
        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · avancement", ancien, c.Avancement);
        return await o.TerminerAsync(projetId, messages, a);
    }

    /// <summary>Reste à faire saisi (vide : calcul automatique, profil par profil).</summary>
    public async Task<ResultatSaisieDto> DefinirResteAFaireAsync(Guid projetId, string uid, ResteAFaireCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        t.VerifierModifiable();
        if (c.Raf is < 0) throw new RegleMetierException("Valeur invalide : saisissez un nombre positif.");
        var ancien = t.ResteAFaireSaisi;
        t.ResteAFaireSaisi = c.Raf;
        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · reste à faire", ancien, c.Raf);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Dates prévues (début, fin) : la fin ne précède pas le début.</summary>
    public async Task<ResultatSaisieDto> DefinirDatesAsync(Guid projetId, string uid, DatesTacheCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var finAvant = t.FinPrevue;
        var debutAvant = t.DebutPrevu;
        t.DefinirDatesPrevues(c.Debut, c.Fin);
        var messages = new List<MessageDto>();
        if (c.Fin is { } fin && fin != finAvant)
        {
            var avant = (await o.CalculerAsync(projetId, a)).Tasks.First(x => x.Uid == uid);
            if (avant.ConsoDates.Count > 0 && fin < avant.ConsoDates[^1] && avant.Statut != ReferentielsMetier.StatutValide)
                messages.Add(new MessageDto($"Du consommé est déjà saisi après le {Formats.Date(fin)} : vérifiez la fin prévue.", "attention"));
        }
        if (debutAvant != c.Debut) o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · début prévu", debutAvant, c.Debut);
        if (finAvant != c.Fin) o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · fin prévue", finAvant, c.Fin);
        return await o.TerminerAsync(projetId, messages, a);
    }

    /// <summary>
    /// Intitulé. Tâche du TSP : l'intitulé d'origine est conservé (on peut y revenir) ; tâche ajoutée : l'intitulé lui appartient.
    /// </summary>
    public async Task<ResultatSaisieDto> DefinirLibelleAsync(Guid projetId, string uid, LibelleCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var v = string.Join(' ', (c.Libelle ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (v.Length == 0) throw new RegleMetierException("L’intitulé ne peut pas être vide.");
        var ancien = Libelle(t);
        if (t.Origine == OrigineElement.Ajout) { t.LibelleTsp = v; t.Libelle = null; }
        else t.Libelle = v == t.LibelleTsp ? null : v;
        o.Noter(projetId, u, "Tâche", t.Id, "intitulé", ancien, v);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    public async Task<ResultatSaisieDto> DefinirCommentaireAsync(Guid projetId, string uid, CommentaireCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var ancien = t.Commentaire;
        t.Commentaire = c.Commentaire ?? "";
        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · commentaire", ancien, t.Commentaire);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Classement : type, axe, phase ou lot. Vide : retour à la valeur du TSP (pour le type : aucun type).</summary>
    public async Task<ResultatSaisieDto> DefinirClassementAsync(Guid projetId, string uid, ClassementCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var v = SaisieOutils.Nettoyer(c.Valeur);
        switch (c.Champ)
        {
            case "type":
                t.TypeSaisi = true;
                if (v.Length == 0) t.TypeTacheId = null;
                else
                {
                    var type = await o.Db.TypesTache.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == v, a)
                        ?? throw new IntrouvableException("Type de tâche introuvable.");
                    t.TypeTacheId = type.Id;
                }
                break;
            case "axe":
                t.AxeId = v.Length == 0 ? null : (await AxeAsync(projetId, v, a)).Id;
                break;
            case "phase":
                t.PhaseId = v.Length == 0 ? null : (await PhaseAsync(projetId, v, a)).Id;
                break;
            case "lot":
                t.Lot = v.Length == 0 ? null : v;
                break;
            default:
                throw new RegleMetierException($"Champ de classement inconnu : « {c.Champ} ».");
        }
        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · {c.Champ}", null, v);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Bilan IA : levier (ou cause de dépassement) et commentaire pour la direction de projet.</summary>
    public async Task<ResultatSaisieDto> DefinirBilanIaAsync(Guid projetId, string uid, BilanIaCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var type = SaisieOutils.Nettoyer(c.IaType);
        var justif = (c.IaJustif ?? "").Trim();
        t.IaTypeOptimisation = type.Length == 0 ? null : type;
        t.IaCommentaire = justif.Length == 0 ? null : justif;
        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · bilan IA", null, $"{type} — {justif}");
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>
    /// Échéance de facturation conditionnée par la tâche. Impossible si la phase de la tâche porte déjà une échéance
    /// (elle s'impose à toutes ses tâches) ; une échéance déjà facturée ne peut plus être choisie.
    /// </summary>
    public async Task<ResultatSaisieDto> DefinirEcheanceAsync(Guid projetId, string uid, EcheanceTacheCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        var calcule = (await o.CalculerAsync(projetId, a)).Tasks.First(x => x.Uid == uid);
        if (calcule.EchViaPhase)
            throw new RegleMetierException($"Échéance définie par la phase {calcule.Phase} : elle s’applique à toutes ses tâches. Modifiez-la depuis le panneau de la phase.");
        if (c.Numero is null) t.EcheanceId = null;
        else
        {
            var e = await o.Db.Echeances.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Numero == c.Numero, a)
                ?? throw new IntrouvableException("Échéance introuvable.");
            if (!e.EstSelectionnable && t.EcheanceId != e.Id)
                throw new RegleMetierException($"L’échéance n° {e.Numero} est déjà facturée : elle ne peut plus être liée à une tâche.");
            t.EcheanceId = e.Id;
        }
        o.Noter(projetId, u, "Tâche", t.Id, $"{Libelle(t)} · échéance liée", calcule.EchN, c.Numero);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    // ------------------------------------------------------------------ consommé

    /// <summary>
    /// Consommé d'un profil sur une tâche, un jour donné. Règles :
    /// 1 JH maximum par personne et par jour, toutes tâches confondues (sauf profils ACHAT et CESSION) ;
    /// pas de saisie sur une tâche annulée ; au centième de JH ;
    /// le premier consommé fait passer la tâche « En cours », l'absence de consommé la ramène « À faire » ;
    /// avertissements (non bloquants) : jour non ouvré, hors période du projet, dans le futur.
    /// </summary>
    public async Task<ResultatSaisieDto> SaisirConsommeAsync(Guid projetId, string uid, ConsommeCommande c, CancellationToken a)
    {
        var u = await o.ExigerSaisieConsommeAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        t.VerifierModifiable();
        var profil = await o.ProfilAsync(projetId, c.ProfilId, a);
        decimal? v = c.Jh;
        if (v is < 0) throw new RegleMetierException("Saisissez un nombre de jours positif, par exemple 0,5 : saisie annulée.");
        if (v is not null) v = Math.Round(v.Value, 2, MidpointRounding.AwayFromZero);
        if (v == 0) v = null;
        var multi = ReferentielsMetier.PeutDepasserUneJournee(profil.Entite);
        if (!multi && v > 1)
            throw new RegleMetierException($"Impossible : on ne peut pas saisir plus d’une journée de travail par jour ({Formats.Jh(v!.Value)} JH saisis).");

        var duJour = await o.Db.Consommes.Where(x => x.ProjetId == projetId && x.ProfilProjetId == profil.Id && x.Jour == c.Jour).ToListAsync(a);
        var existant = duJour.FirstOrDefault(x => x.TacheId == t.Id);
        var ancien = existant?.JoursHomme ?? 0;
        var autres = duJour.Where(x => x.TacheId != t.Id).Sum(x => x.JoursHomme);
        if (!multi && v is not null && autres + v.Value > 1)
            throw new RegleMetierException($"Impossible : {profil.Nom} a déjà {Formats.Jh(autres)} JH saisis le {Formats.Date(c.Jour)} sur d’autres tâches. " +
                $"Une journée de travail ne dépasse pas 1 JH : il reste {Formats.Jh(Math.Max(0, 1 - autres))} JH ce jour-là.");

        // somme faite en mémoire : certaines bases (SQLite des tests) ne savent pas additionner des décimaux
        var totalAvant = (await o.Db.Consommes.Where(x => x.TacheId == t.Id).Select(x => x.JoursHomme).ToListAsync(a)).Sum();
        if (v is null)
        {
            if (existant is not null) o.Db.Consommes.Remove(existant);
        }
        else if (existant is not null)
        {
            existant.JoursHomme = v.Value;
            existant.SaisiLe = o.Horloge.Maintenant;
            existant.SaisiParId = u.Id;
        }
        else
            o.Db.Consommes.Add(new Consomme
            {
                ProjetId = projetId, TacheId = t.Id, ProfilProjetId = profil.Id, Jour = c.Jour, JoursHomme = v.Value,
                SaisiLe = o.Horloge.Maintenant, SaisiParId = u.Id,
            });
        var totalApres = totalAvant - ancien + (v ?? 0);

        var messages = new List<MessageDto>();
        // Le statut « En cours » n'est pas enregistré : il se déduit du consommé (consommé > 0 → En cours, sinon À faire).
        if (v is not null && totalApres == v && (t.Statut is null || t.Statut == StatutTache.AFaire))
        {
            t.Statut = null;
            messages.Add(new MessageDto("Tâche passée « En cours » (premier consommé saisi)."));
        }
        if (totalApres == 0 && ancien > 0)
        {
            if (t.Statut == StatutTache.EnCours && (t.Avancement ?? 0) == 0) t.Statut = null;
            if (t.Statut is null) messages.Add(new MessageDto("Plus aucun consommé sur cette tâche : elle repasse « À faire »."));
        }
        if (v is not null && ancien == 0)
        {
            var projet = await o.Db.Projets.AsNoTracking().FirstAsync(p => p.Id == projetId, a);
            var finP = projet.FinPrevue ?? projet.FinContractuelle;
            var d = c.Jour;
            string? alerte = !Calendrier.EstOuvre(d)
                ? $"le {Formats.Date(d)} est {(Calendrier.NomFerie(d) is { } ferie ? $"férié ({ferie})" : "un week-end")}"
                : projet.Debut is { } deb && d < deb ? $"le {Formats.Date(d)} est avant le début du projet ({Formats.Date(deb)})"
                : finP is { } fp && d > fp ? $"le {Formats.Date(d)} est après la fin prévue du projet ({Formats.Date(fp)})"
                : d > o.Aujourdhui ? $"le {Formats.Date(d)} est dans le futur"
                : null;
            if (alerte is not null) messages.Add(new MessageDto($"Saisie enregistrée, mais {alerte} : vérifiez la date.", "attention"));
        }
        o.Noter(projetId, u, "Consommé", t.Id, $"{Libelle(t)} · {profil.Nom} · {Formats.Date(c.Jour)}", ancien == 0 ? null : (object)ancien, v);
        return await o.TerminerAsync(projetId, messages, a);
    }

    // ------------------------------------------------------------------ outils

    /// <summary>Intitulé affiché de la tâche.</summary>
    public static string Libelle(Tache t) => string.IsNullOrEmpty(t.Libelle) ? t.LibelleTsp : t.Libelle;

    /// <summary>Axe du projet (créé s'il n'existe pas encore : code trouvé seulement sur des tâches).</summary>
    internal async Task<Axe> AxeAsync(Guid projetId, string code, CancellationToken a)
    {
        var axe = await o.Db.Axes.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == code, a);
        if (axe is not null) return axe;
        var ordre = await o.Db.Axes.Where(x => x.ProjetId == projetId).Select(x => (int?)x.Ordre).MaxAsync(a) ?? -1;
        axe = new Axe { ProjetId = projetId, Code = code, Nom = "", Ordre = ordre + 1 };
        o.Db.Axes.Add(axe);
        return axe;
    }

    /// <summary>Phase du projet (créée si elle n'existe pas encore).</summary>
    internal async Task<Phase> PhaseAsync(Guid projetId, string code, CancellationToken a)
    {
        var phase = await o.Db.Phases.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == code, a);
        if (phase is not null) return phase;
        var ordre = await o.Db.Phases.Where(x => x.ProjetId == projetId).Select(x => (int?)x.Ordre).MaxAsync(a) ?? -1;
        phase = new Phase { ProjetId = projetId, Code = code, Ordre = ordre + 1, ListeReference = false };
        o.Db.Phases.Add(phase);
        return phase;
    }
}
