using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Évolutions du périmètre : annulation (avec ou sans avenant de réduction) et rétablissement d'une tâche,
/// nouvelle tâche, profil ajouté à une tâche. Règles du POC :
/// un ajout n'est jamais facturé (le CA reste celui du TSP) et son coût réduit la marge ;
/// une tâche du TSP ne se supprime pas, elle s'annule (le consommé est conservé, le reste à faire disparaît).
/// </summary>
public sealed class PerimetreService(SaisieOutils o)
{
    /// <summary>Écart entre deux positions de tâches (permet d'insérer une tâche sans renuméroter les autres).</summary>
    public const int PasPosition = 1024;

    // ------------------------------------------------------------------ annulation

    public async Task<ResultatSaisieDto> AnnulerAsync(Guid projetId, string uid, AnnulationCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        SaisieOutils.VerifierVersion(t, c.Version, "La tâche");
        if (t.EstAnnulee) throw new RegleMetierException("Cette tâche est déjà annulée.");
        var modele = await o.CalculerAsync(projetId, a);
        var tc = modele.Tasks.First(x => x.Uid == uid);
        if (tc.Statut == ReferentielsMetier.StatutValide)
            throw new RegleMetierException("Tâche validée : il n’y a plus rien à annuler. Rouvrez-la d’abord si elle doit être annulée.");
        var motif = SaisieOutils.Nettoyer(c.Motif);
        if (motif.Length == 0) throw new RegleMetierException("Indiquez le motif : il est repris dans le tableau de bord, le registre et les exports.");

        // Ce qui est annulé : le reste à faire de chaque profil (le consommé, réellement travaillé, est conservé).
        decimal jh = 0, cout = 0, caReduction = 0;
        for (var i = 0; i < tc.Charges.Count && i < modele.P.Count; i++)
        {
            var reste = Math.Max(tc.Charges[i] - tc.ConsoP[i], 0);
            jh += reste;
            cout += reste * modele.P[i].Cjm;
            caReduction += Math.Min(reste, tc.ChargesV[i]) * modele.P[i].TjmR;
        }
        var avenant = c.Avenant && caReduction > 0.005m;
        var le = ProchainHorodatage(t);

        Decision? decision = null;
        if (c.EnregistrerDecision)
        {
            var references = await o.Db.Decisions.Where(x => x.ProjetId == projetId).Select(x => x.Reference).ToListAsync(a);
            var libelle = $"Annulation de la tâche « {tc.Label} »{(avenant ? " (avenant de réduction)" : "")} — {motif}";
            decision = new Decision
            {
                ProjetId = projetId, Reference = SaisieOutils.ProchaineReference(references, "D"), Date = o.Aujourdhui, Instance = "COPROJ",
                Libelle = libelle.Length > 1000 ? libelle[..1000] : libelle, Decideur = SaisieOutils.Nom(u), Impact = "Périmètre",
                Statut = StatutDecision.Validee, CreeeParId = u.Id,
                Commentaire = $"{Formats.Jh(jh)} JH annulés, coût évité {Formats.Euros(cout)}{(avenant ? $", CA −{Formats.Euros(caReduction)}" : "")}",
            };
            o.Db.Decisions.Add(decision);
        }
        o.Db.Evolutions.Add(new EvolutionPerimetre
        {
            ProjetId = projetId, TacheId = t.Id, Nature = NatureEvolution.Annulation, Le = le, ParId = u.Id, Motif = motif,
            AvenantReduction = avenant, JoursHomme = jh, DecisionId = decision?.Id,
        });
        t.ResteAFaireSaisi = null;
        o.Noter(projetId, u, "Tâche", t.Id, $"{tc.Label} · annulation", null, motif);
        var message = $"Tâche annulée : {Formats.Jh(jh)} JH retirés{(avenant ? $", CA −{Formats.Euros(caReduction)}" : $", coût évité {Formats.Euros(cout)}")}.";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    /// <summary>Rétablit une tâche annulée : elle retrouve sa charge et redevient saisissable.</summary>
    public async Task<ResultatSaisieDto> RetablirAsync(Guid projetId, string uid, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        if (!t.EstAnnulee) throw new RegleMetierException("Cette tâche n’est pas annulée.");
        o.Db.Evolutions.Add(new EvolutionPerimetre
        {
            ProjetId = projetId, TacheId = t.Id, Nature = NatureEvolution.Retablissement, Le = ProchainHorodatage(t), ParId = u.Id,
            Motif = "Rétablissement",
        });
        o.Noter(projetId, u, "Tâche", t.Id, $"{SaisiesTachesService.Libelle(t)} · rétablissement", "annulée", "rétablie");
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Tâche rétablie.", "succes") }, a);
    }

    // ------------------------------------------------------------------ nouvelle tâche

    /// <summary>Crée une tâche (mêmes propriétés qu'une ligne du WORKLOAD du TSP), avec sa charge par profil (non facturée).</summary>
    public async Task<ResultatSaisieDto> CreerTacheAsync(Guid projetId, NouvelleTacheCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var label = string.Join(' ', (c.Label ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (label.Length == 0) throw new RegleMetierException("Saisissez l’intitulé de la tâche.");
        var profils = await o.Db.Profils.Where(p => p.ProjetId == projetId).OrderBy(p => p.Rang).ToListAsync(a);
        var charges = new List<(ProfilProjet Profil, decimal Jh)>();
        foreach (var ch in c.Charges ?? new List<ChargeNouvelleTacheCommande>())
        {
            var profil = profils.FirstOrDefault(p => p.Id == ch.ProfilId) ?? throw new IntrouvableException("Profil introuvable.");
            if (ch.Jh < 0) throw new RegleMetierException($"Charge invalide pour « {profil.Nom} » : saisissez un nombre de jours.");
            if (charges.Any(x => x.Profil.Id == profil.Id)) throw new RegleMetierException($"Le profil « {profil.Nom} » est indiqué deux fois.");
            if (ch.Jh > 0) charges.Add((profil, ch.Jh));
        }
        var maintenant = o.Horloge.Maintenant;
        var motif = SaisieOutils.Nettoyer(c.Motif);
        if (c.NouveauProfil is not null)
        {
            var nouveau = LireNouveauProfil(c.NouveauProfil, profils);
            if (!(c.NouveauProfilJh > 0)) throw new RegleMetierException("Saisissez la charge du nouveau profil.");
            charges.Add((nouveau, c.NouveauProfilJh!.Value));
        }
        if (!(charges.Sum(x => x.Jh) > 0)) throw new RegleMetierException("Indiquez la charge prévue d’au moins un profil.");
        if (c.Debut is not null && c.Fin is not null && c.Fin < c.Debut) throw new RegleMetierException("La fin prévue doit être postérieure au début.");
        if (motif.Length == 0) throw new RegleMetierException("Indiquez le motif : il apparaît dans le tableau de bord et l’export COPIL.");

        // nouveau profil : créé seulement une fois tout vérifié
        foreach (var (profil, _) in charges.Where(x => !profils.Contains(x.Profil)))
        {
            profil.ProjetId = projetId;
            profil.Rang = profils.Count == 0 ? 0 : profils.Max(p => p.Rang) + 1;
            profil.AjouteLe = maintenant;
            profil.AjouteParId = u.Id;
            profil.MotifAjout = motif;
            o.Db.Profils.Add(profil);
            profils.Add(profil);
        }

        var axe = SaisieOutils.Nettoyer(c.Axe);
        var phase = SaisieOutils.Nettoyer(c.Phase).ToUpperInvariant();
        var lot = SaisieOutils.Nettoyer(c.Lot);
        var toutes = await o.Db.Taches.Where(x => x.ProjetId == projetId).ToListAsync(a);
        var reperes = toutes.Select(x => x.Repere).ToList();
        var numero = 1 + reperes.Where(r => r.StartsWith('a')).Select(r => int.TryParse(r[1..], out var n) ? n : 0).DefaultIfEmpty(0).Max();
        var tache = new Tache
        {
            ProjetId = projetId, Repere = $"a{numero}", Origine = OrigineElement.Ajout, LigneTsp = null,
            CodeAxeTsp = axe, LotTsp = lot, PhaseTsp = phase, EtapeTsp = SaisieOutils.Nettoyer(c.Etape), LibelleTsp = label,
            Hypothese = SaisieOutils.Nettoyer(c.Hypothese), DebutPrevu = c.Debut, FinPrevue = c.Fin,
        };
        tache.Position = await PositionAsync(projetId, toutes, c.Apres, axe, phase, lot, a);
        if (axe.Length > 0) tache.AxeId = (await o.Db.Axes.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == axe, a))?.Id;
        if (phase.Length > 0) tache.PhaseId = (await o.Db.Phases.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == phase, a))?.Id;
        var typeCode = SaisieOutils.Nettoyer(c.Type);
        if (typeCode.Length > 0)
        {
            var type = await o.Db.TypesTache.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Code == typeCode, a)
                ?? throw new IntrouvableException("Type de tâche introuvable.");
            tache.TypeSaisi = true;
            tache.TypeTacheId = type.Id;
        }
        o.Db.Taches.Add(tache);
        foreach (var (profil, jh) in charges)
            o.Db.ChargesTache.Add(new ChargeTache
            {
                ProjetId = projetId, TacheId = tache.Id, ProfilProjetId = profil.Id, ChargeAjoutee = jh,
                MotifAjout = motif, AjouteeLe = maintenant, AjouteeParId = u.Id,
            });
        o.Db.Evolutions.Add(new EvolutionPerimetre
        {
            ProjetId = projetId, TacheId = tache.Id, Nature = NatureEvolution.NouvelleTache, Le = maintenant, ParId = u.Id, Motif = motif,
            JoursHomme = charges.Sum(x => x.Jh),
        });
        // la date saisie devient la date planifiée de l'atelier (type choisi ou détecté d'après l'intitulé)
        var typeEffectif = typeCode.Length > 0 ? typeCode : ReferentielsMetier.DetecterType(label, "");
        if (typeEffectif == ReferentielsMetier.TypeAtelier && c.Debut is not null)
            o.Db.Ateliers.Add(new Atelier { ProjetId = projetId, TacheId = tache.Id, DatePlanifiee = c.Debut });

        o.Noter(projetId, u, "Tâche", tache.Id, "nouvelle tâche", null, label);
        var message = $"Tâche « {label} » créée ({Formats.Jh(charges.Sum(x => x.Jh))} JH non facturés).";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a, tache.Repere);
    }

    /// <summary>Supprime une tâche ajoutée en cours de projet (jamais une tâche du TSP : elle s'annule), avec ses saisies.</summary>
    public async Task<ResultatSaisieDto> SupprimerTacheAsync(Guid projetId, string uid, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        if (t.Origine != OrigineElement.Ajout)
            throw new RegleMetierException("Une tâche du TSP ne se supprime pas : annulez-la (son consommé est conservé).");
        o.Db.Consommes.RemoveRange(await o.Db.Consommes.Where(x => x.TacheId == t.Id).ToListAsync(a));
        o.Db.ChargesTache.RemoveRange(await o.Db.ChargesTache.Where(x => x.TacheId == t.Id).ToListAsync(a));
        o.Db.Evolutions.RemoveRange(t.Evolutions);
        var atelier = await o.Db.Ateliers.Include(x => x.Destinataires).FirstOrDefaultAsync(x => x.TacheId == t.Id, a);
        if (atelier is not null)
        {
            o.Db.Destinataires.RemoveRange(atelier.Destinataires);
            o.Db.Ateliers.Remove(atelier);
        }
        o.Db.Livrables.RemoveRange(await o.Db.Livrables.Where(x => x.TacheId == t.Id).ToListAsync(a));
        o.Db.LignesPlanReference.RemoveRange(await o.Db.LignesPlanReference.Where(x => x.TacheId == t.Id).ToListAsync(a));
        o.Db.MisesAJour.RemoveRange(await o.Db.MisesAJour.Where(x => x.TacheId == t.Id).ToListAsync(a));
        foreach (var action in await o.Db.Actions.Where(x => x.TacheId == t.Id).ToListAsync(a)) action.TacheId = null;
        o.Db.Taches.Remove(t);
        o.Noter(projetId, u, "Tâche", t.Id, "suppression d’une tâche ajoutée", SaisiesTachesService.Libelle(t), null);
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Tâche ajoutée supprimée.", "succes") }, a);
    }

    // ------------------------------------------------------------------ profils ajoutés à une tâche

    /// <summary>Ajoute un profil (existant ou nouveau) à une tâche : charge non facturée, motif obligatoire.</summary>
    public async Task<ResultatSaisieDto> AjouterProfilAsync(Guid projetId, string uid, AjoutProfilCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        t.VerifierModifiable();
        var profils = await o.Db.Profils.Where(p => p.ProjetId == projetId).OrderBy(p => p.Rang).ToListAsync(a);
        var chargesTache = await o.Db.ChargesTache.Where(x => x.TacheId == t.Id).ToListAsync(a);
        ProfilProjet profil;
        if (c.NouveauProfil is not null) profil = LireNouveauProfil(c.NouveauProfil, profils);
        else
        {
            profil = profils.FirstOrDefault(p => p.Id == c.ProfilId) ?? throw new IntrouvableException("Profil introuvable.");
            var existante = chargesTache.FirstOrDefault(x => x.ProfilProjetId == profil.Id);
            if (existante is not null && existante.ChargeVendue + existante.ChargeAjoutee > 0)
                throw new RegleMetierException($"Le profil « {profil.Nom} » est déjà prévu sur cette tâche : modifiez sa charge ajoutée dans le tableau des profils.");
        }
        if (!(c.Jh > 0)) throw new RegleMetierException("Saisissez la charge ajoutée en jours (ex. 0,5 ou 2).");
        var motif = SaisieOutils.Nettoyer(c.Motif);
        if (motif.Length == 0) throw new RegleMetierException("Indiquez le motif : il apparaît dans le tableau de bord et l’export COPIL.");
        var maintenant = o.Horloge.Maintenant;
        if (!profils.Contains(profil))
        {
            profil.ProjetId = projetId;
            profil.Rang = profils.Count == 0 ? 0 : profils.Max(p => p.Rang) + 1;
            profil.AjouteLe = maintenant;
            profil.AjouteParId = u.Id;
            profil.MotifAjout = motif;
            o.Db.Profils.Add(profil);
        }
        var charge = chargesTache.FirstOrDefault(x => x.ProfilProjetId == profil.Id);
        if (charge is null)
        {
            charge = new ChargeTache { ProjetId = projetId, TacheId = t.Id, ProfilProjetId = profil.Id };
            o.Db.ChargesTache.Add(charge);
        }
        charge.ChargeAjoutee = Math.Round(charge.ChargeAjoutee + c.Jh, 2, MidpointRounding.AwayFromZero);
        charge.MotifAjout = motif;
        charge.AjouteeLe = maintenant;
        charge.AjouteeParId = u.Id;
        o.Db.Evolutions.Add(new EvolutionPerimetre
        {
            ProjetId = projetId, TacheId = t.Id, ProfilProjetId = profil.Id, Nature = NatureEvolution.AjoutCharge, Le = maintenant, ParId = u.Id,
            Motif = motif, JoursHomme = c.Jh,
        });
        o.Noter(projetId, u, "Tâche", t.Id, $"{SaisiesTachesService.Libelle(t)} · profil ajouté", null, $"{profil.Nom} {Formats.Jh(c.Jh)} JH");
        var message = $"Profil « {profil.Nom} » ajouté à la tâche ({Formats.Jh(c.Jh)} JH non facturés).";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    /// <summary>Modifie la charge ajoutée d'un profil (positive ; pour la retirer : RetirerAjoutAsync).</summary>
    public async Task<ResultatSaisieDto> ModifierAjoutAsync(Guid projetId, string uid, Guid profilId, ChargeAjouteeCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        t.VerifierModifiable();
        if (!(c.Jh > 0)) throw new RegleMetierException("Saisissez une charge positive. Pour retirer l’ajout, utilisez ✕.");
        var charge = await o.Db.ChargesTache.FirstOrDefaultAsync(x => x.TacheId == t.Id && x.ProfilProjetId == profilId, a);
        if (charge is null || charge.ChargeAjoutee == 0) throw new IntrouvableException("Aucune charge ajoutée pour ce profil sur cette tâche.");
        var ancien = charge.ChargeAjoutee;
        await VerifierPasDeChargeNegativeAsync(projetId, t, profilId, ancien - Math.Round(c.Jh, 2, MidpointRounding.AwayFromZero), a);
        charge.ChargeAjoutee = Math.Round(c.Jh, 2, MidpointRounding.AwayFromZero);
        o.Noter(projetId, u, "Tâche", t.Id, $"{SaisiesTachesService.Libelle(t)} · charge ajoutée", ancien, charge.ChargeAjoutee);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Retire la charge ajoutée d'un profil (le consommé déjà saisi est conservé). Une tâche ajoutée garde au moins un profil.</summary>
    public async Task<ResultatSaisieDto> RetirerAjoutAsync(Guid projetId, string uid, Guid profilId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var charges = await o.Db.ChargesTache.Where(x => x.TacheId == t.Id).ToListAsync(a);
        var charge = charges.FirstOrDefault(x => x.ProfilProjetId == profilId);
        if (charge is null || charge.ChargeAjoutee == 0) throw new IntrouvableException("Aucune charge ajoutée pour ce profil sur cette tâche.");
        if (t.Origine == OrigineElement.Ajout && charges.Count(x => x.ChargeAjoutee > 0) <= 1)
            throw new RegleMetierException("Une tâche ajoutée garde au moins un profil : supprimez la tâche si elle n’a plus lieu d’être.");
        await VerifierPasDeChargeNegativeAsync(projetId, t, profilId, charge.ChargeAjoutee, a);
        var ancien = charge.ChargeAjoutee;
        if (charge.ChargeVendue == 0) o.Db.ChargesTache.Remove(charge);
        else
        {
            charge.ChargeAjoutee = 0;
            charge.MotifAjout = null;
            charge.AjouteeLe = null;
            charge.AjouteeParId = null;
        }
        o.Noter(projetId, u, "Tâche", t.Id, $"{SaisiesTachesService.Libelle(t)} · ajout retiré", ancien, null);
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Ajout retiré.", "succes") }, a);
    }

    // ------------------------------------------------------------------ réaffectation de charge

    /// <summary>
    /// Confie une partie de la charge d'un profil à une autre personne (déjà sur le projet, ou nouvelle avec le même rôle).
    /// Le total de la tâche et le CA ne changent pas ; seul le coût varie si les CJM diffèrent.
    /// On ne réaffecte que ce qui n'est pas encore consommé (prévu − consommé).
    /// </summary>
    public async Task<ResultatSaisieDto> ReaffecterAsync(Guid projetId, string uid, ReaffectationCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        t.VerifierModifiable();
        var profils = await o.Db.Profils.Where(p => p.ProjetId == projetId).OrderBy(p => p.Rang).ToListAsync(a);
        var iDe = profils.FindIndex(p => p.Id == c.DeProfilId);
        if (iDe < 0) throw new IntrouvableException("Profil introuvable.");
        var source = profils[iDe];
        // l'enveloppe IA est une réserve adossée aux profils humains, pas une personne : elle ne se réaffecte pas
        if (source.EstAgentIa) throw new RegleMetierException("La charge de l’Agent IA est une enveloppe : elle ne se réaffecte pas.");
        var modele = await o.CalculerAsync(projetId, a);
        var tc = modele.Tasks.FirstOrDefault(x => x.Uid == uid) ?? throw new IntrouvableException("Tâche introuvable.");
        var reaffectable = Reaffectable(tc, iDe);
        var jh = Math.Round(c.Jh, 2, MidpointRounding.AwayFromZero);
        if (!(jh > 0)) throw new RegleMetierException("Saisissez la charge à réaffecter en jours (ex. 0,5).");
        if (jh > reaffectable)
            throw new RegleMetierException(reaffectable > 0
                ? $"Au plus {Formats.Jh(reaffectable)} JH : c’est ce qui reste à faire pour {modele.P[iDe].Nom} (le consommé ne se réaffecte pas)."
                : $"Rien à réaffecter pour {modele.P[iDe].Nom} : sa charge sur cette tâche est déjà consommée.");

        ProfilProjet cible;
        int iVers;
        if (c.VersProfilId is { } versId)
        {
            iVers = profils.FindIndex(p => p.Id == versId);
            if (iVers < 0) throw new IntrouvableException("Profil introuvable.");
            if (iVers == iDe || string.IsNullOrWhiteSpace(profils[iVers].Nom)) throw new RegleMetierException("Choisissez la personne qui reprend cette charge.");
            cible = profils[iVers];
            if (cible.EstAgentIa) throw new RegleMetierException("La charge de l’Agent IA est une enveloppe : on ne lui réaffecte pas de charge.");
        }
        else
        {
            if (SaisieOutils.Nettoyer(c.Collaborateur).Length == 0) throw new RegleMetierException("Indiquez le nom de la personne qui reprend cette charge.");
            // même rôle et même entité que la personne d'origine ; TJM et CJM repris d'elle s'ils ne sont pas indiqués
            cible = LireNouveauProfil(new NouveauProfilCommande(source.Nom, source.Entite, c.Tjm ?? source.Tjm, c.Cjm ?? source.Cjm, c.Collaborateur), profils);
            // même rôle : le reste de la fiche de la personne d'origine est repris
            cible.Prcs = source.Prcs;
            cible.Frais = source.Frais;
            iVers = profils.Count;
        }
        var motif = SaisieOutils.Nettoyer(c.Motif);
        if (motif.Length == 0) throw new RegleMetierException("Indiquez le motif : il apparaît dans Rentabilité › Évolutions du périmètre et dans les exports.");

        var maintenant = o.Horloge.Maintenant;
        if (!profils.Contains(cible))
        {
            cible.ProjetId = projetId;
            cible.Rang = profils.Count == 0 ? 0 : profils.Max(p => p.Rang) + 1;
            cible.AjouteLe = maintenant;
            cible.AjouteParId = u.Id;
            cible.MotifAjout = motif;
            o.Db.Profils.Add(cible);
        }
        o.Db.Evolutions.Add(new EvolutionPerimetre
        {
            ProjetId = projetId, TacheId = t.Id, ProfilSourceId = source.Id, ProfilProjetId = cible.Id, Nature = NatureEvolution.Reaffectation,
            Le = maintenant, ParId = u.Id, Motif = motif, JoursHomme = jh,
        });
        o.Noter(projetId, u, "Tâche", t.Id, $"{SaisiesTachesService.Libelle(t)} · réaffectation", modele.P[iDe].Nom,
            $"{Formats.Jh(jh)} JH à {(cible.Collaborateur.Length > 0 ? $"{cible.Nom} — {cible.Collaborateur}" : cible.Nom)}");
        // les noms sont lus après le calcul : un homonyme ajouté peut changer la façon de distinguer les profils
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a, apres: m => new[]
        {
            new MessageDto($"{Formats.Jh(jh)} JH réaffectés de {NomProfil(m, iDe)} à {NomProfil(m, iVers)}. Le total de la tâche ne change pas.", "succes"),
        });
    }

    /// <summary>Annule une réaffectation : la charge revient à la personne d'origine (le consommé déjà saisi est conservé).</summary>
    public async Task<ResultatSaisieDto> AnnulerReaffectationAsync(Guid projetId, string uid, Guid reaffectationId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        t.VerifierModifiable();
        var e = t.Evolutions.FirstOrDefault(x => x.Id == reaffectationId && x.Nature == NatureEvolution.Reaffectation)
            ?? throw new IntrouvableException("Réaffectation introuvable.");
        var source = e.ProfilSourceId is { } de ? await o.Db.Profils.FirstOrDefaultAsync(p => p.Id == de, a) : null;
        // la charge reçue a pu être réaffectée à son tour : l'annuler rendrait la charge de cette personne négative
        var profils = await o.Db.Profils.Where(p => p.ProjetId == projetId).OrderBy(p => p.Rang).ToListAsync(a);
        var iVers = profils.FindIndex(p => p.Id == e.ProfilProjetId);
        var tc = (await o.CalculerAsync(projetId, a)).Tasks.FirstOrDefault(x => x.Uid == uid);
        if (tc is not null && iVers >= 0 && iVers < tc.Charges.Count && tc.Charges[iVers] - e.JoursHomme < -0.001m)
            throw new RegleMetierException("Cette charge a été réaffectée à son tour : annulez d’abord la réaffectation faite depuis cette personne.");
        o.Db.Evolutions.Remove(e);
        o.Noter(projetId, u, "Tâche", t.Id, $"{SaisiesTachesService.Libelle(t)} · réaffectation annulée", $"{Formats.Jh(e.JoursHomme)} JH", e.Motif);
        var message = source is null ? "Réaffectation annulée." : $"Réaffectation annulée : la charge revient à {source.Nom}{(source.Collaborateur.Length > 0 ? $" — {source.Collaborateur}" : "")}.";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    /// <summary>
    /// Retirer de la charge ajoutée ne doit pas rendre négative la charge d'un profil dont une partie a été réaffectée :
    /// il faut d'abord annuler la réaffectation.
    /// </summary>
    private async Task VerifierPasDeChargeNegativeAsync(Guid projetId, Tache t, Guid profilId, decimal retrait, CancellationToken a)
    {
        if (retrait <= 0 || !t.Evolutions.Any(e => e.Nature == NatureEvolution.Reaffectation && e.ProfilSourceId == profilId)) return;
        var profils = await o.Db.Profils.Where(p => p.ProjetId == projetId).OrderBy(p => p.Rang).ToListAsync(a);
        var i = profils.FindIndex(p => p.Id == profilId);
        var tc = (await o.CalculerAsync(projetId, a)).Tasks.FirstOrDefault(x => x.Uid == t.Repere);
        if (tc is not null && i >= 0 && i < tc.Charges.Count && tc.Charges[i] - retrait < -0.001m)
            throw new RegleMetierException("Une partie de cette charge a été réaffectée : annulez d’abord la réaffectation, puis retirez l’ajout.");
    }

    /// <summary>Ce qui peut encore être réaffecté pour un profil : prévu − consommé (jamais négatif).</summary>
    public static decimal Reaffectable(TacheCalculee t, int i) =>
        i >= 0 && i < t.Charges.Count && i < t.ConsoP.Count ? Math.Max(Math.Round(t.Charges[i] - t.ConsoP[i], 2, MidpointRounding.AwayFromZero), 0) : 0;

    private static string NomProfil(ResultatCalcul m, int i) => i >= 0 && i < m.P.Count ? m.P[i].Nom : "";

    // ------------------------------------------------------------------ outils

    /// <summary>Contrôle un nouveau profil saisi (mêmes règles que le POC) et le prépare (il n'est pas encore enregistré).</summary>
    private static ProfilProjet LireNouveauProfil(NouveauProfilCommande n, List<ProfilProjet> existants)
    {
        var nom = SaisieOutils.Nettoyer(n.Nom);
        if (nom.Length == 0) throw new RegleMetierException("Donnez un nom au nouveau profil.");
        var collaborateur = SaisieOutils.Nettoyer(n.Collaborateur);
        var homonymes = existants.Where(x => string.Equals(x.Nom, nom, StringComparison.OrdinalIgnoreCase)).ToList();
        if (homonymes.Count > 0 && collaborateur.Length == 0)
            throw new RegleMetierException($"Le profil « {nom} » existe déjà. S’il s’agit d’une autre personne, indiquez son nom dans « Collaborateur » pour les distinguer ; sinon, choisissez-le dans la liste.");
        if (homonymes.Any(x => string.Equals(x.Collaborateur, collaborateur, StringComparison.OrdinalIgnoreCase)))
            throw new RegleMetierException($"« {nom} — {collaborateur} » existe déjà : choisissez-le dans la liste.");
        if (!(n.Tjm > 0)) throw new RegleMetierException("Saisissez le TJM du nouveau profil (nombre positif).");
        if (!(n.Cjm > 0)) throw new RegleMetierException("Saisissez le CJM du nouveau profil : sans lui, le coût et la marge seraient faux.");
        var entite = string.IsNullOrWhiteSpace(n.Entite) ? "FO" : n.Entite.Trim();
        if (!ReferentielsMetier.Entites.Contains(entite)) throw new RegleMetierException($"Entité inconnue : « {entite} ».");
        return new ProfilProjet
        {
            Nom = nom, Entite = entite, Tjm = n.Tjm, Cjm = n.Cjm, Prcs = null, Frais = 0, Collaborateur = collaborateur, Origine = OrigineElement.Ajout,
        };
    }

    /// <summary>
    /// Position d'une tâche ajoutée : juste après la tâche indiquée, sinon après la dernière tâche du même groupe
    /// (axe, lot ou phase selon le regroupement du projet), sinon à la fin.
    /// </summary>
    private async Task<int> PositionAsync(Guid projetId, List<Tache> toutes, string? apres, string axe, string phase, string lot, CancellationToken a)
    {
        var ordonnees = toutes.OrderBy(x => x.Position).ToList();
        if (ordonnees.Count == 0) return 0;
        Tache? ancre = null;
        if (!string.IsNullOrWhiteSpace(apres))
            ancre = ordonnees.FirstOrDefault(x => x.Repere == apres) ?? throw new IntrouvableException("Tâche d’ancrage introuvable.");
        else
        {
            var projet = await o.Db.Projets.AsNoTracking().FirstAsync(p => p.Id == projetId, a);
            var axes = await o.Db.Axes.AsNoTracking().Where(x => x.ProjetId == projetId).ToDictionaryAsync(x => x.Id, x => x.Code, a);
            var phases = await o.Db.Phases.AsNoTracking().Where(x => x.ProjetId == projetId).ToDictionaryAsync(x => x.Id, x => x.Code, a);
            string Groupe(Tache x) => projet.Parametres.Regroupement switch
            {
                Regroupement.Phase => x.PhaseId is { } ph && phases.TryGetValue(ph, out var code) && code.Length > 0 ? code : x.PhaseTsp,
                Regroupement.Lot => x.Lot ?? x.LotTsp,
                _ => x.AxeId is { } ax && axes.TryGetValue(ax, out var code) && code.Length > 0 ? code : x.CodeAxeTsp,
            };
            var voulu = projet.Parametres.Regroupement switch { Regroupement.Phase => phase, Regroupement.Lot => lot, _ => axe };
            if (voulu.Length > 0) ancre = ordonnees.LastOrDefault(x => !x.EstSection && Groupe(x) == voulu);
            ancre ??= ordonnees[^1];
        }
        var k = ordonnees.IndexOf(ancre);
        var suivante = k + 1 < ordonnees.Count ? ordonnees[k + 1] : null;
        if (suivante is null) return ancre.Position + PasPosition;
        if (suivante.Position - ancre.Position >= 2) return ancre.Position + (suivante.Position - ancre.Position) / 2;
        // plus de place entre les deux : on renumérote (rare)
        for (var i = 0; i < ordonnees.Count; i++) ordonnees[i].Position = i * PasPosition;
        return ancre.Position + PasPosition / 2;
    }

    /// <summary>Horodatage d'une annulation / d'un rétablissement : toujours après la précédente évolution (l'ordre fait foi).</summary>
    private DateTimeOffset ProchainHorodatage(Tache t)
    {
        var le = o.Horloge.Maintenant;
        var derniere = t.Evolutions.Where(e => e.Nature is NatureEvolution.Annulation or NatureEvolution.Retablissement)
            .OrderBy(e => e.Le.UtcDateTime).LastOrDefault();
        if (derniere is not null && le <= derniere.Le) le = derniere.Le.AddTicks(1);
        return le;
    }
}
