using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Calcul;

/// <summary>
/// Charge les saisies d'un projet depuis la base et les met dans la forme attendue par le moteur de calcul.
/// C'est le seul endroit qui fait le lien entre le modèle de données et le moteur.
/// </summary>
public sealed class ConstructeurProjetCalcul(IContexteDonnees db)
{
    /// <summary>Charge les saisies du projet et les met dans la forme attendue par le moteur de calcul.</summary>
    public async Task<ProjetCalcul> ChargerAsync(Guid projetId, CancellationToken annulation = default) =>
        Construire(await ChargerDonneesAsync(projetId, annulation));

    /// <summary>Charge toutes les saisies d'un projet (lecture seule). Sert au moteur, à l'écran de suivi et aux exports.</summary>
    public async Task<DonneesProjet> ChargerDonneesAsync(Guid projetId, CancellationToken annulation = default)
    {
        var projet = await db.Projets.AsNoTracking().FirstAsync(p => p.Id == projetId, annulation);
        // Une requête par table : plus simple à lire et plus efficace qu'une seule requête avec toutes les jointures.
        var profils = await db.Profils.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Rang).ToListAsync(annulation);
        var taches = await db.Taches.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Position).ToListAsync(annulation);
        var charges = await db.ChargesTache.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var consommes = await db.Consommes.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var evolutions = await db.Evolutions.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var axes = await db.Axes.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var phases = await db.Phases.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var etapes = await db.Etapes.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var types = await db.TypesTache.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var valeursIa = await db.ValeursIa.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var echeances = await db.Echeances.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Numero).ToListAsync(annulation);
        var liensPhases = await db.LiensEcheancePhase.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var planning = await db.PlanningsProfils.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var planningPhases = await db.PlanningsPhases.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var planningPhasesMois = await db.PlanningsPhasesMois.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var budgetAchats = await db.BudgetsAchats.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var budgetFrais = await db.BudgetsFrais.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var prestataires = await db.Prestataires.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var metriques = await db.Metriques.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var achatsReels = await db.AchatsReels.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var fraisReels = await db.FraisReels.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var actions = await db.Actions.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var decisions = await db.Decisions.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var risques = await db.Risques.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var ateliers = await db.Ateliers.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var destinataires = await db.Destinataires.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var livrables = await db.Livrables.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var photos = await db.PhotosIndicateurs.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var imports = await db.ImportsTsp.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var champs = await db.ChampsFiche.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var grille = await db.Grilles.AsNoTracking().Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).ToListAsync(annulation);
        var previsionnel = await db.Previsionnels.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var datesPlanning = await db.DatesPlanning.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var jalons = await db.Jalons.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var elementsPlanning = await db.ElementsPlanning.AsNoTracking().Where(x => x.ProjetId == projetId).ToListAsync(annulation);
        var idsAuteurs = evolutions.Select(e => e.ParId).Concat(charges.Select(c => c.AjouteeParId)).Concat(profils.Select(p => p.AjouteParId))
            .Concat(actions.Select(a => a.CreeeParId)).Concat(decisions.Select(x => x.CreeeParId)).Concat(risques.Select(r => r.CreeParId))
            .Concat(achatsReels.Select(a => a.CreeParId)).Concat(fraisReels.Select(f => f.CreeParId))
            .Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        var auteurs = await db.Utilisateurs.AsNoTracking().Where(u => idsAuteurs.Contains(u.Id)).ToDictionaryAsync(u => u.Id, annulation);

        // Tri en mémoire des dates avec fuseau horaire (certaines bases, comme SQLite des tests, ne savent pas les trier).
        return new DonneesProjet(projet, profils, taches, charges, consommes, evolutions, axes, phases, etapes, types, valeursIa,
            echeances, liensPhases, planning, planningPhases, planningPhasesMois, budgetAchats, budgetFrais, prestataires, metriques,
            achatsReels, fraisReels, actions, decisions, risques, auteurs,
            ateliers, destinataires, livrables, photos.OrderBy(x => x.Date).ThenBy(x => x.Nature).ToList(),
            imports.OrderBy(x => x.ImporteLe).ToList(), champs, grille)
        {
            Previsionnel = previsionnel, DatesPlanning = datesPlanning, Jalons = jalons, ElementsPlanning = elementsPlanning,
        };
    }

    /// <summary>
    /// Saisies d'un projet créé en mémoire et pas encore enregistré (ex. le projet que donnera le lancement d'un brouillon) :
    /// le calculer par le même chemin qu'un projet enregistré garantit que ce qu'on voit avant le lancement est ce qu'on obtiendra.
    /// </summary>
    public static DonneesProjet DonneesEnMemoire(Projet p) => new(
        p, p.Profils.OrderBy(x => x.Rang).ToList(), p.Taches.OrderBy(x => x.Position).ToList(), p.Taches.SelectMany(t => t.Charges).ToList(),
        new List<Consomme>(), new List<EvolutionPerimetre>(), p.Axes.OrderBy(x => x.Ordre).ToList(), p.Phases.OrderBy(x => x.Ordre).ToList(),
        p.Etapes.OrderBy(x => x.Ordre).ToList(), p.TypesTache.OrderBy(x => x.Ordre).ToList(), p.ValeursIa.ToList(),
        p.Echeances.OrderBy(x => x.Numero).ToList(), new List<LienEcheancePhase>(), p.PlanningProfils.ToList(),
        p.PlanningPhases.OrderBy(x => x.Ordre).ToList(), p.PlanningPhases.SelectMany(x => x.Mois).ToList(),
        p.BudgetAchats.OrderBy(x => x.Ordre).ToList(), p.BudgetFrais.OrderBy(x => x.Ordre).ToList(), p.Prestataires.OrderBy(x => x.Ordre).ToList(),
        p.Metriques.OrderBy(x => x.Ordre).ToList(), new List<AchatReel>(), new List<FraisReel>(), new List<ActionProjet>(), new List<Decision>(),
        new List<Risque>(), new Dictionary<Guid, Utilisateur>(), new List<Atelier>(), new List<Destinataire>(), new List<Livrable>(),
        new List<PhotoIndicateurs>(), p.Imports.ToList(), p.ChampsFiche.OrderBy(x => x.Ordre).ToList(), p.Grille.OrderBy(x => x.Ordre).ToList());

    /// <summary>Toutes les saisies d'un projet, déjà chargées.</summary>
    public sealed record DonneesProjet(
        Projet Projet, List<ProfilProjet> Profils, List<Tache> Taches, List<ChargeTache> Charges, List<Consomme> Consommes,
        List<EvolutionPerimetre> Evolutions, List<Axe> Axes, List<Phase> Phases, List<Etape> Etapes, List<TypeTache> Types,
        List<ValeurListeIa> ValeursIa, List<Echeance> Echeances, List<LienEcheancePhase> LiensPhases, List<PlanningVenduProfil> Planning,
        List<PlanningVenduPhase> PlanningPhases, List<PlanningVenduPhaseMois> PlanningPhasesMois, List<LigneBudgetAchat> BudgetAchats,
        List<LigneBudgetFrais> BudgetFrais, List<Prestataire> Prestataires, List<Metrique> Metriques, List<AchatReel> AchatsReels,
        List<FraisReel> FraisReels, List<ActionProjet> Actions, List<Decision> Decisions, List<Risque> Risques,
        Dictionary<Guid, Utilisateur> Auteurs,
        List<Atelier> Ateliers, List<Destinataire> Destinataires, List<Livrable> Livrables, List<PhotoIndicateurs> Photos,
        List<ImportTsp> Imports, List<ChampFiche> ChampsFiche, List<GrilleAgence> Grille)
    {
        /// <summary>Prévisionnel de charge replanifié (vide : le prévisionnel est le planning vendu).</summary>
        public List<PrevisionnelProfil> Previsionnel { get; init; } = new();
        /// <summary>Planning : dates saisies par ligne (et noms des sous-parties), jalons, éléments mis en avant ou masqués.</summary>
        public List<DatesPlanning> DatesPlanning { get; init; } = new();
        public List<Jalon> Jalons { get; init; } = new();
        public List<ElementPlanning> ElementsPlanning { get; init; } = new();

        /// <summary>Nom de l'auteur d'une saisie (ou null s'il est inconnu).</summary>
        public string? Auteur(Guid? id) => id is not null && Auteurs.TryGetValue(id.Value, out var u) ? u.NomComplet : null;

        /// <summary>Achats réels dans l'ordre utilisé par le moteur (date, puis date de création).</summary>
        public List<AchatReel> AchatsOrdonnes() => AchatsReels.OrderBy(x => x.Date).ThenBy(x => x.CreeLe.UtcDateTime).ToList();

        /// <summary>Frais réels dans l'ordre utilisé par le moteur (date, puis date de création).</summary>
        public List<FraisReel> FraisOrdonnes() => FraisReels.OrderBy(x => x.Date).ThenBy(x => x.CreeLe.UtcDateTime).ToList();
    }

    /// <summary>Transforme les saisies en données d'entrée du moteur (sans accès à la base).</summary>
    public static ProjetCalcul Construire(DonneesProjet d)
    {
        var p = d.Projet;
        // Le moteur repère les profils par leur position dans la liste : on fait la correspondance identifiant → position.
        var indexProfil = d.Profils.Select((x, i) => (x.Id, i)).ToDictionary(x => x.Id, x => x.i);
        string? Auteur(Guid? id) => d.Auteur(id);
        static string? Iso(DateTimeOffset? t) => t?.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
        var axeParId = d.Axes.ToDictionary(x => x.Id);
        var phaseParId = d.Phases.ToDictionary(x => x.Id);
        var typeParId = d.Types.ToDictionary(x => x.Id);
        var echeanceParId = d.Echeances.ToDictionary(x => x.Id);
        var indexAchat = d.BudgetAchats.Select((x, i) => (x.Id, i)).ToDictionary(x => x.Id, x => x.i);

        var resultat = new ProjetCalcul
        {
            Remise = p.Remise,
            Profiles = d.Profils.Select(x => new ProfilCalcul
            {
                Nom = x.Nom, Entite = x.Entite, Tjm = x.Tjm, Cjm = x.Cjm, Prcs = x.Prcs, Frais = x.Frais, Collaborateur = x.Collaborateur,
                Ajout = x.Origine == OrigineElement.Ajout ? new AjoutCalcul { At = Iso(x.AjouteLe), By = Auteur(x.AjouteParId), Motif = x.MotifAjout } : null,
            }).ToList(),
            Settings = new ParametresCalcul
            {
                StartMonth = p.Parametres.PremierMois ?? (p.Debut is { } debut ? Calendrier.Mois(debut) : null),
                NbMonths = p.Parametres.NombreMois,
                IaProfile = d.Profils.FindIndex(x => x.EstAgentIa),
                GroupBy = Libelles.CodeMoteur(p.Parametres.Regroupement),
                IaLeviers = d.ValeursIa.Where(x => x.Liste == ListeIa.Levier).Select(x => x.Libelle).ToList(),
                IaCauses = d.ValeursIa.Where(x => x.Liste == ListeIa.Cause).Select(x => x.Libelle).ToList(),
            },
            Dates = new DatesProjetCalcul { Debut = p.Debut, FinContrat = p.FinContractuelle, FinPrevue = p.FinPrevue },
            Ref = new ReferentielCalcul
            {
                Phases = d.Phases.Where(x => x.ListeReference).Select(x => x.Code).ToList(),
                Etapes = d.Etapes.Select(x => x.Libelle).ToList(),
            },
            Axes = d.Axes.GroupBy(x => x.Code).ToDictionary(g => g.Key, g => g.First().Nom),
            Types = d.Types.Select(x => new TypeTacheCalcul { Id = x.Code, Nom = x.Nom, Socle = x.Socle }).ToList(),
            Frais = d.BudgetFrais.Select(x => new FraisBudgetCalcul { Libelle = x.Libelle, Cu = x.CoutUnitaire, Qte = x.Quantite, Refacture = x.Refacture, Commentaire = x.Commentaire }).ToList(),
            Achats = d.BudgetAchats.Select(x => new AchatBudgetCalcul { Designation = x.Designation, Type = x.Type, Cu = x.CoutUnitaire, Qte = x.Quantite, Revente = x.Revente, Commentaire = x.Commentaire }).ToList(),
            Prestas = d.Prestataires.Select(x => new PrestataireCalcul { Designation = x.Designation, Societe = x.Societe, CoutJour = x.CoutJour, Nbj = x.NombreJours, Tjm = x.Tjm, Commentaire = x.Commentaire }).ToList(),
            Metrique = d.Metriques.Select(x => new MetriqueCalcul { Etape = x.Etape, Pct = x.Pourcentage }).ToList(),
            Echeancier = d.Echeances.Select(x => new EcheanceCalcul { N = x.Numero, Nom = x.Nom, Pct = x.Pourcentage, Mois = x.MoisTsp }).ToList(),
            AchatsReel = d.AchatsOrdonnes().Select(x => new AchatReelCalcul
            {
                Id = x.Id.ToString(), Ligne = x.LigneBudgetAchatId is { } l && indexAchat.TryGetValue(l, out var i) ? i : null,
                Qte = x.Quantite, Cu = x.CoutUnitaire, Refacture = x.Refacture, Statut = Libelles.De(x.Statut), Designation = x.Designation,
            }).ToList(),
            FraisReel = d.FraisOrdonnes().Select(x => new FraisReelCalcul
            {
                Id = x.Id.ToString(), Montant = x.Montant, Refacturable = x.Refacturable, Categorie = Libelles.De(x.Categorie), Collaborateur = x.Collaborateur,
            }).ToList(),
            Actions = d.Actions.OrderBy(x => x.Reference).Select(x => new ActionCalcul
            {
                Id = x.Id.ToString(), Ref = x.Reference, Libelle = x.Libelle, Porteur = x.Porteur, Statut = Libelles.De(x.Statut), Echeance = x.DateCible,
            }).ToList(),
            Decisions = d.Decisions.OrderBy(x => x.Reference).Select(x => new DecisionCalcul { Id = x.Id.ToString(), Ref = x.Reference, Libelle = x.Libelle, Statut = Libelles.De(x.Statut) }).ToList(),
            Risques = d.Risques.OrderBy(x => x.Reference).Select(x => new RisqueCalcul
            {
                Id = x.Id.ToString(), Ref = x.Reference, Libelle = x.Libelle, Proba = Libelles.De(x.Probabilite), Impact = Libelles.De(x.Impact), Statut = Libelles.De(x.Statut),
            }).ToList(),
        };

        // ---- suivi des échéances ----
        foreach (var e in d.Echeances)
        {
            var phasesLiees = d.LiensPhases.Where(l => l.EcheanceId == e.Id && phaseParId.ContainsKey(l.PhaseId)).Select(l => phaseParId[l.PhaseId].Code).ToList();
            resultat.EchTrack[e.Numero] = new SuiviEcheanceCalcul
            {
                DatePrevue = e.DatePrevue, RealiseLe = e.FactureeLe, PayeeLe = e.PayeeLe, MontantFacture = e.MontantFacture,
                Commentaire = e.Commentaire, Phases = phasesLiees,
            };
        }

        // ---- planning vendu (figé) et prévisionnel de charge ----
        // Tant qu'aucune valeur n'a été replanifiée, le prévisionnel est le planning vendu. À la première modification, le
        // prévisionnel complet est enregistré (copie du vendu + la modification) : une valeur absente vaut alors 0.
        PlanningProfilsCalcul Grille(IEnumerable<(Guid Profil, string Mois, decimal Jh)> valeurs)
        {
            var liste = valeurs.ToList();
            var mois = liste.Select(x => x.Mois).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToList();
            return new PlanningProfilsCalcul
            {
                Months = mois,
                Rows = d.Profils.Select(pr => mois.Select(mk => liste.Where(x => x.Profil == pr.Id && x.Mois == mk).Sum(x => x.Jh)).ToList()).ToList(),
            };
        }
        var vendu = Grille(d.Planning.Select(x => (x.ProfilProjetId, x.Mois, x.JoursHomme)));
        resultat.PlanningTsp = vendu;
        resultat.PlanningRef = d.Previsionnel.Count > 0 ? Grille(d.Previsionnel.Select(x => (x.ProfilProjetId, x.Mois, x.JoursHomme))) : vendu;

        // ---- planning (vue d'ensemble) : dates saisies par ligne et jalons ----
        resultat.Planning = new PlanningCalcul
        {
            Groupes = d.DatesPlanning.GroupBy(x => x.Cle).ToDictionary(g => g.Key, g => new DatesLignePlanningCalcul { Debut = g.First().Debut, Fin = g.First().Fin, Nom = g.First().Nom }),
            Jalons = d.Jalons.Select(j => new JalonCalcul
            {
                Id = j.Id.ToString(), Libelle = j.Libelle, Type = j.Type switch { TypeJalon.Periode => "periode", TypeJalon.Semaine => "semaine", _ => "date" },
                Debut = j.Debut, Fin = j.Type == TypeJalon.Periode ? j.Fin : null, AConfirmer = j.AConfirmer,
            }).ToList(),
        };
        resultat.PlanningPhases = new PlanningPhasesCalcul
        {
            Rows = d.PlanningPhases.Select(l => new LignePlanningPhaseCalcul
            {
                Phase = l.Phase,
                Vals = d.PlanningPhasesMois.Where(m => m.PlanningVenduPhaseId == l.Id).GroupBy(m => m.Mois).ToDictionary(g => g.Key, g => g.Sum(m => m.JoursHomme)),
            }).ToList(),
        };

        // ---- tâches et leur suivi ----
        var chargesParTache = d.Charges.ToLookup(c => c.TacheId);
        var consoParTache = d.Consommes.ToLookup(c => c.TacheId);
        var evolParTache = d.Evolutions.ToLookup(e => e.TacheId);
        foreach (var t in d.Taches)
        {
            var nouvelle = evolParTache[t.Id].Where(e => e.Nature == NatureEvolution.NouvelleTache).OrderBy(e => e.Le).FirstOrDefault();
            var chargesVendues = Enumerable.Repeat(0m, d.Profils.Count).ToList();
            foreach (var c in chargesParTache[t.Id])
                if (indexProfil.TryGetValue(c.ProfilProjetId, out var i)) chargesVendues[i] += c.ChargeVendue;
            resultat.Tasks.Add(new TacheCalcul
            {
                Uid = t.Repere, Ligne = t.LigneTsp, Id = t.CodeAxeTsp, Lot = t.LotTsp, Phase = t.PhaseTsp, Etape = t.EtapeTsp, Label = t.LibelleTsp,
                Charges = chargesVendues, Section = t.EstSection, Livrable = t.MarqueurLivrable, Hypothese = t.Hypothese, LivCol = t.ColonneLivrable,
                Ajout = t.Origine == OrigineElement.Ajout ? new AjoutCalcul { At = Iso(nouvelle?.Le), By = Auteur(nouvelle?.ParId), Motif = nouvelle?.Motif } : null,
            });

            // annulation : la dernière évolution « annulation / rétablissement » fait foi
            var derniere = evolParTache[t.Id].Where(e => e.Nature is NatureEvolution.Annulation or NatureEvolution.Retablissement).OrderBy(e => e.Le).LastOrDefault();
            var suivi = new SuiviTacheCalcul
            {
                Label = t.Libelle, Statut = t.Statut is null ? null : Libelles.De(t.Statut.Value), Avancement = t.Avancement, Raf = t.ResteAFaireSaisi,
                Debut = t.DebutPrevu, Fin = t.FinPrevue, Commentaire = t.Commentaire,
                Type = t.TypeSaisi ? (t.TypeTacheId is { } ty && typeParId.TryGetValue(ty, out var type) ? type.Code : "") : null,
                Axe = t.AxeId is { } ax && axeParId.TryGetValue(ax, out var axe) ? axe.Code : null,
                Phase = t.PhaseId is { } ph && phaseParId.TryGetValue(ph, out var phase) ? phase.Code : null,
                Lot = t.Lot, ValideLe = t.ValideeLe, IaType = t.IaTypeOptimisation, IaJustif = t.IaCommentaire, IaRev = t.IaChargeRevisee,
                Ech = t.EcheanceId is { } ec && echeanceParId.TryGetValue(ec, out var echeance) ? echeance.Numero : null,
                Annul = derniere?.Nature == NatureEvolution.Annulation
                    ? new AnnulationCalcul { At = Iso(derniere.Le), By = Auteur(derniere.ParId), Motif = derniere.Motif, Avenant = derniere.AvenantReduction }
                    : null,
            };
            foreach (var c in chargesParTache[t.Id].Where(c => c.ChargeAjoutee != 0))
            {
                if (!indexProfil.TryGetValue(c.ProfilProjetId, out var i)) continue;
                (suivi.ChargeAjout ??= new())[i] = c.ChargeAjoutee;
                (suivi.AjoutInfo ??= new())[i] = new AjoutCalcul { At = Iso(c.AjouteeLe), By = Auteur(c.AjouteeParId), Motif = c.MotifAjout };
            }
            // réaffectations : dans l'ordre où elles ont été faites ; une réaffectation dont un profil n'existe plus est ignorée
            foreach (var e in evolParTache[t.Id].Where(e => e.Nature == NatureEvolution.Reaffectation).OrderBy(e => e.Le.UtcDateTime))
            {
                if (e.ProfilSourceId is not { } de || e.ProfilProjetId is not { } vers) continue;
                if (!indexProfil.TryGetValue(de, out var iDe) || !indexProfil.TryGetValue(vers, out var iVers)) continue;
                (suivi.Reaff ??= new()).Add(new ReaffectationCalcul
                {
                    Id = e.Id.ToString(), De = iDe, Vers = iVers, Jh = e.JoursHomme, Motif = e.Motif, At = Iso(e.Le), By = Auteur(e.ParId),
                });
            }
            foreach (var c in consoParTache[t.Id])
            {
                if (!indexProfil.TryGetValue(c.ProfilProjetId, out var i)) continue;
                var parJour = (suivi.ConsoP ??= new()).TryGetValue(i, out var o) ? o : suivi.ConsoP[i] = new Dictionary<string, decimal>();
                var jour = Calendrier.Iso(c.Jour);
                parJour[jour] = parJour.GetValueOrDefault(jour) + c.JoursHomme;
            }
            resultat.Track[t.Repere] = suivi;
        }
        return resultat;
    }
}
