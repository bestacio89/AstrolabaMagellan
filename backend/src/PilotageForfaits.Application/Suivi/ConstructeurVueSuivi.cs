using System.Globalization;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;
using static PilotageForfaits.Application.Calcul.ConstructeurProjetCalcul;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Met les saisies d'un projet dans la forme du fichier de suivi du POC, pour l'écran de suivi.
/// S'appuie sur les données d'entrée du moteur (déjà dans cette forme) et y ajoute ce que seul l'écran utilise :
/// identifiants et versions, organisation des ateliers, suivi des livrables, registres complets, historique, journal.
/// </summary>
public static class ConstructeurVueSuivi
{
    public static ProjetVueDto Construire(DonneesProjet d, ProjetCalcul c, IReadOnlyList<EntreeJournal> journal, IReadOnlyDictionary<Guid, string> nomsJournal,
        ComplementsVue? complements = null, StatutProjet? statutAffiche = null)
    {
        var p = d.Projet;
        var indexAchat = d.BudgetAchats.Select((x, i) => (x.Id, i)).ToDictionary(x => x.Id, x => x.i);
        var tacheParId = d.Taches.ToDictionary(t => t.Id);
        var tacheParRepere = d.Taches.ToDictionary(t => t.Repere, StringComparer.Ordinal);
        var dernierImport = d.Imports.LastOrDefault();

        // ---- fiche ----
        var champs = d.ChampsFiche.Select(x => new ChampFicheVueDto(x.Cle ?? "", x.Libelle, x.Valeur)).ToList();
        string Champ(string cle) => d.ChampsFiche.FirstOrDefault(x => x.Cle == cle)?.Valeur ?? "";
        var periodeTexte = Champ("periode");
        PeriodeVueDto? periode = null;
        if (periodeTexte.Length > 0)
        {
            var morceaux = periodeTexte.Split(" au ", StringSplitOptions.TrimEntries);
            var debut = Calendrier.LireDateFr(morceaux[0]);
            var fin = morceaux.Length > 1 ? Calendrier.LireDateFr(morceaux[1]) : null;
            if (debut is not null || fin is not null) periode = new PeriodeVueDto(debut, fin);
        }

        // ---- suivi des tâches : celui du moteur, complété ----
        var ateliers = d.Ateliers.ToDictionary(a => a.TacheId);
        var livrables = d.Livrables.ToDictionary(l => l.TacheId);
        var destParAtelier = d.Destinataires.ToLookup(x => x.AtelierId);
        var evolParTache = d.Evolutions.ToLookup(e => e.TacheId);
        var track = new Dictionary<string, SuiviTacheVueDto>();
        foreach (var t in d.Taches)
        {
            var s = c.Track.TryGetValue(t.Repere, out var trouve) ? trouve : new SuiviTacheCalcul();
            AtelierVueDto? atelier = null;
            if (ateliers.TryGetValue(t.Id, out var a))
                atelier = new AtelierVueDto
                {
                    Date = a.DatePlanifiee, HeureDebut = Heure(a.HeureDebut), HeureFin = Heure(a.HeureFin),
                    Invit = a.InvitationEnvoyee, InvitLe = a.EnvoyeeLe,
                    Dest = destParAtelier[a.Id].OrderBy(x => x.Ordre).Select(x => x.NomOuEmail).ToList(),
                };
            LivrableVueDto? livr = livrables.TryGetValue(t.Id, out var l) && (l.ValideParClientLe is not null || l.LienStockage is not null)
                ? new LivrableVueDto { ValideLe = l.ValideParClientLe, Lien = l.LienStockage }
                : null;
            AnnulationVueDto? annul = null;
            if (s.Annul is not null)
            {
                var evol = evolParTache[t.Id].Where(e => e.Nature is NatureEvolution.Annulation or NatureEvolution.Retablissement)
                    .OrderBy(e => e.Le.UtcDateTime).LastOrDefault();
                annul = new AnnulationVueDto { At = s.Annul.At, By = s.Annul.By, Motif = s.Annul.Motif, Avenant = s.Annul.Avenant, Decision = evol?.DecisionId };
            }
            track[t.Repere] = new SuiviTacheVueDto
            {
                Label = s.Label, Statut = s.Statut, Avancement = s.Avancement, Raf = s.Raf, Debut = s.Debut, Fin = s.Fin, Commentaire = s.Commentaire,
                Type = s.Type, Axe = s.Axe, Phase = s.Phase, Lot = s.Lot, ValideLe = s.ValideLe, IaType = s.IaType, IaJustif = s.IaJustif,
                Ech = s.Ech, Annul = annul, ChargeAjout = s.ChargeAjout, AjoutInfo = s.AjoutInfo, ConsoP = s.ConsoP, Reaff = s.Reaff, Atelier = atelier, Livr = livr,
            };
        }

        // ---- registres ----
        var actions = d.Actions.OrderBy(x => x.Reference, StringComparer.Ordinal).Select(x => new ActionVueDto
        {
            Id = x.Id, Version = x.Version, Ref = x.Reference, Libelle = x.Libelle, Porteur = x.Porteur, Origine = x.Instance ?? "",
            Cree = x.CreeeLe, Echeance = x.DateCible, Progression = x.Progression, Statut = Libelles.De(x.Statut), FaitLe = x.FaiteLe,
            Commentaire = x.Commentaire, Tache = x.TacheId is { } tid && tacheParId.TryGetValue(tid, out var tache) ? tache.Repere : null,
            Par = d.Auteur(x.CreeeParId),
        }).ToList();
        var decisions = d.Decisions.OrderBy(x => x.Reference, StringComparer.Ordinal).Select(x => new DecisionVueDto
        {
            Id = x.Id, Version = x.Version, Ref = x.Reference, Date = x.Date, Instance = x.Instance ?? "", Libelle = x.Libelle,
            Decideur = x.Decideur ?? "", Impact = x.Impact ?? "", Statut = Libelles.De(x.Statut), Commentaire = x.Commentaire, Par = d.Auteur(x.CreeeParId),
        }).ToList();
        var risques = d.Risques.OrderBy(x => x.Reference, StringComparer.Ordinal).Select(x => new RisqueVueDto
        {
            Id = x.Id, Version = x.Version, Ref = x.Reference, Libelle = x.Libelle, Proba = Libelles.De(x.Probabilite), Impact = Libelles.De(x.Impact),
            Crit = Criticite(x.Probabilite, x.Impact), Niveau = ReferentielsMetier.NiveauRisque(Criticite(x.Probabilite, x.Impact)),
            Type = x.Type is { } ty ? Libelles.De(ty) : "", Cause = x.Cause ?? "", Parade = x.Parade ?? "", Plan = x.Plan ?? "",
            Responsable = x.Responsable ?? "", Statut = Libelles.De(x.Statut),
            Action = x.ActionId, Commentaire = x.Commentaire, Cree = HeureDeParis.Date(x.CreeLe), Par = d.Auteur(x.CreeParId),
        }).ToList();

        // ---- échéances ----
        var echTrack = new Dictionary<int, SuiviEcheanceVueDto>();
        foreach (var e in d.Echeances)
        {
            var s = c.EchTrack.GetValueOrDefault(e.Numero);
            echTrack[e.Numero] = new SuiviEcheanceVueDto
            {
                Version = e.Version, DatePrevue = e.DatePrevue, RealiseLe = e.FactureeLe, PayeeLe = e.PayeeLe, MontantFacture = e.MontantFacture,
                Commentaire = e.Commentaire, Phases = s?.Phases ?? new List<string>(),
            };
        }

        return new ProjetVueDto
        {
            Id = p.Id, Version = p.Version, Statut = Libelles.De(statutAffiche ?? p.Statut),
            Fiche = new FicheVueDto
            {
                Client = p.Client, Projet = p.Nom, Reference = p.Reference ?? "", TypeContrat = p.TypeContrat ?? Champ("typeContrat"), Champs = champs,
            },
            Periode = periode, Remise = p.Remise, RemiseSaisie = p.RemiseSaisie, CaInitial = p.CaInitial,
            Profiles = d.Profils.Select((x, i) => new ProfilVueDto
            {
                Id = x.Id, Version = x.Version, Nom = x.Nom, Entite = x.Entite, Tjm = x.Tjm, Cjm = x.Cjm, Prcs = x.Prcs, Frais = x.Frais,
                Collaborateur = x.Collaborateur, Ajout = c.Profiles[i].Ajout,
            }).ToList(),
            Grille = d.Grille.Select(g => new GrilleVueDto(g.Profil, g.TjmParis, g.CjmParis, g.TjmRegion, g.CjmRegion)).ToList(),
            Tasks = c.Tasks.Select((t, k) => new TacheVueDto
            {
                Uid = t.Uid, CibleId = tacheParRepere[t.Uid].Id, Version = tacheParRepere[t.Uid].Version, Ligne = t.Ligne, Id = t.Id, Lot = t.Lot, Phase = t.Phase, Etape = t.Etape, Label = t.Label,
                Charges = t.Charges, Section = t.Section, Livrable = t.Livrable, Hypothese = t.Hypothese, Ajout = t.Ajout, LivCol = t.LivCol,
            }).ToList(),
            Track = track,
            Settings = new ParametresVueDto
            {
                GroupBy = c.Settings.GroupBy, IaProfile = c.Settings.IaProfile,
                IaLeviers = c.Settings.IaLeviers is { Count: > 0 } ? c.Settings.IaLeviers : null,
                IaCauses = c.Settings.IaCauses is { Count: > 0 } ? c.Settings.IaCauses : null,
                AlerteActionsJours = p.Parametres.AlerteActionsJours, AlerteAtelierJours = p.Parametres.AlerteAteliersJours,
                AlerteLivrableJours = p.Parametres.AlerteLivrablesJours, AlerteEchJours = p.Parametres.AlerteEcheancesJours,
                LastCoproj = p.Parametres.DernierCoproj, StartMonth = c.Settings.StartMonth, NbMonths = c.Settings.NbMonths,
                Instances = Instances(p.Parametres.Instances),
            },
            Dates = c.Dates, Ref = c.Ref, Axes = c.Axes, Types = c.Types ?? new List<TypeTacheCalcul>(),
            Frais = c.Frais, Achats = c.Achats, Prestas = c.Prestas, Metrique = c.Metrique, PlanningRef = c.PlanningRef, PlanningTsp = c.PlanningTsp,
            Planning = new PlanningVueDto
            {
                Groupes = d.DatesPlanning.GroupBy(x => x.Cle).ToDictionary(g => g.Key, g => g.Select(x => new DatesPlanningVueDto
                {
                    Id = x.Id, Version = x.Version, Debut = x.Debut, Fin = x.Fin, Nom = x.Nom,
                }).First()),
                Jalons = d.Jalons.OrderBy(j => j.Debut).ThenBy(j => j.Libelle, StringComparer.Ordinal).Select(j => new JalonVueDto
                {
                    Id = j.Id, Version = j.Version, Libelle = j.Libelle, Type = j.Type switch { TypeJalon.Periode => "periode", TypeJalon.Semaine => "semaine", _ => "date" },
                    Debut = j.Debut, Fin = j.Type == TypeJalon.Periode ? j.Fin : null, AConfirmer = j.AConfirmer,
                }).ToList(),
                Avant = d.ElementsPlanning.Where(x => x.Nature == NatureElementPlanning.MisEnAvant).Select(x => x.Cle).Distinct().ToDictionary(k => k, _ => true),
                Masque = d.ElementsPlanning.Where(x => x.Nature == NatureElementPlanning.Masque).Select(x => x.Cle).Distinct().ToDictionary(k => k, _ => true),
            },
            PlanningPhases = new PlanningPhasesVueDto
            {
                Source = dernierImport?.SourcePlanningPhases,
                Rows = d.PlanningPhases.Select(l => new LignePlanningPhaseVueDto
                {
                    Phase = l.Phase, Cjm = l.CjmSaisi,
                    Vals = d.PlanningPhasesMois.Where(m => m.PlanningVenduPhaseId == l.Id).GroupBy(m => m.Mois).ToDictionary(g => g.Key, g => g.Sum(m => m.JoursHomme)),
                }).ToList(),
            },
            PlanningSource = dernierImport?.SourcePlanning,
            Echeancier = c.Echeancier, EchTrack = echTrack,
            AchatsReel = d.AchatsOrdonnes().Select(x => new AchatReelVueDto
            {
                Id = x.Id, Version = x.Version, Date = x.Date, Designation = x.Designation, Fournisseur = x.Fournisseur ?? "",
                Ligne = x.LigneBudgetAchatId is { } l && indexAchat.TryGetValue(l, out var i) ? i : null,
                Qte = x.Quantite, Cu = x.CoutUnitaire, Montant = x.Quantite * x.CoutUnitaire, Refacture = x.Refacture, Statut = Libelles.De(x.Statut),
                Commentaire = x.Commentaire, Cree = HeureDeParis.Date(x.CreeLe), Par = d.Auteur(x.CreeParId),
            }).ToList(),
            FraisReel = d.FraisOrdonnes().Select(x => new FraisReelVueDto
            {
                Id = x.Id, Version = x.Version, Date = x.Date, Collaborateur = x.Collaborateur, Categorie = Libelles.De(x.Categorie), Libelle = x.Libelle,
                Montant = x.Montant, Refacturable = x.Refacturable, Refacture = x.Refacturable ? x.Montant : 0, Commentaire = x.Commentaire,
                Cree = HeureDeParis.Date(x.CreeLe), Par = d.Auteur(x.CreeParId),
            }).ToList(),
            Actions = actions, Decisions = decisions, Risques = risques,
            Historique = d.Photos.Select(x => new PhotoVueDto
            {
                Date = x.Date, Kind = x.Nature == NaturePhoto.Coproj ? "COPROJ" : x.Nature == NaturePhoto.Copil ? "COPIL" : "Mensuelle",
                Prevu = x.Prevu, Conso = x.Consomme, Raf = x.ResteAFaire, Atterrissage = x.Atterrissage, CoutFinal = x.CoutFinal, Marge = x.Marge,
                MargeNette = x.MargeNette, TauxMargeNette = x.TauxMargeNette, FinPrevue = x.FinPrevue,
            }).ToList(),
            Warnings = dernierImport is null ? new List<string>() : dernierImport.PointsReleves.Split('\n', StringSplitOptions.RemoveEmptyEntries).ToList(),
            Source = dernierImport is null ? null : new SourceVueDto(dernierImport.NomFichier, dernierImport.ImporteLe),
            Journal = journal.Select(j => new JournalVueDto(new DateTimeOffset(DateTime.SpecifyKind(j.Le, DateTimeKind.Utc)), j.UtilisateurId is { } u && nomsJournal.TryGetValue(u, out var nom) ? nom : "",
                j.Objet, j.Champ, j.AncienneValeur, j.NouvelleValeur)).ToList(),
            References = complements?.References ?? new List<ReferenceVueDto>(),
            DatesLimitesAxes = complements?.DatesLimitesAxes ?? new Dictionary<string, DateOnly?>(),
            Lots = complements?.Lots ?? new Dictionary<string, string>(),
            Causes = CausesDerive.Liste.ToList(),
            MisesAJour = complements?.MisesAJour ?? new Dictionary<string, List<MiseAJourVueDto>>(),
            Commentaires = complements?.Commentaires ?? new Dictionary<string, List<CommentaireVueDto>>(),
        };
    }

    /// <summary>Instances de gouvernance enregistrées (une par ligne) ; null : liste par défaut.</summary>
    public static List<string>? Instances(string? texte)
    {
        var l = (texte ?? "").Split('\n').Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToList();
        return l.Count > 0 ? l : null;
    }

    /// <summary>Criticité d'un risque : probabilité × importance, chacune de 1 à 4 (1 à 16).</summary>
    public static int Criticite(ProbabiliteRisque probabilite, ImpactRisque impact) => ((int)probabilite + 1) * ((int)impact + 1);

    private static string? Heure(TimeOnly? h) => h?.ToString("HH:mm", CultureInfo.InvariantCulture);
}
