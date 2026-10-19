using System.Globalization;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Import;

/// <summary>
/// Transforme le contenu lu d'un TSP en objets du modèle de données (projet, profils, tâches, charges vendues, échéancier…).
/// Le passage inverse (base → moteur) est fait par ConstructeurProjetCalcul : les tests vérifient que l'aller-retour
/// donne exactement les mêmes indicateurs que la version de référence.
/// </summary>
public static class ConvertisseurTsp
{
    /// <param name="origine">Import d'un fichier, ou TSP rédigé dans l'application (même lecture, voir Brouillons.RedactionTsp).</param>
    public static Projet CreerProjet(TspLu tsp, string nomFichier, Guid? importePar, DateTimeOffset maintenant, DateOnly aujourdhui,
        OrigineProjet origine = OrigineProjet.ImportTsp)
    {
        var f = tsp.Fiche;
        var projet = new Projet
        {
            Nom = f.Projet ?? "", Client = f.Client ?? "", Reference = Vide(f.Reference), Agence = Vide(f.Agence), ServiceLine = Vide(f.ServiceLine),
            Directeur = Vide(f.Directeur), ResponsableSL = Vide(f.ResponsableSL), Commercial = Vide(f.Commercial), ContactClient = Vide(f.Contact),
            TypeContrat = Vide(f.TypeContrat),
            Debut = tsp.Dates.Debut, FinContractuelle = tsp.Dates.FinContrat, FinPrevue = tsp.Dates.FinPrevue,
            Statut = tsp.Dates.Debut is { } debut && debut > aujourdhui ? StatutProjet.EnPreparation : StatutProjet.EnCours,
            Remise = tsp.Remise, RemiseSaisie = tsp.RemiseSaisie, CaInitial = tsp.CaInitial, PctPilotage = tsp.PctPilotage, PctProvision = tsp.PctProvision,
            Origine = origine, CreeLe = maintenant, CreeParId = importePar,
            Parametres = new ParametresProjet
            {
                Regroupement = Libelles.RegroupementDepuisCode(tsp.Settings.GroupBy), PremierMois = tsp.Settings.StartMonth, NombreMois = tsp.Settings.NbMonths,
            },
        };
        projet.CalculerCleUnicite();
        var id = projet.Id;

        projet.ChampsFiche.AddRange(f.Champs.Select((c, i) => new ChampFiche { ProjetId = id, Libelle = c.Label, Valeur = c.Value, Cle = c.Key, Ordre = i }));
        projet.Imports.Add(new ImportTsp
        {
            ProjetId = id, NomFichier = nomFichier, ImporteLe = maintenant, ImporteParId = importePar,
            PointsReleves = string.Join("\n", tsp.Warnings), SourcePlanning = tsp.PlanningSource, SourcePlanningPhases = tsp.PlanningPhases.Source,
        });

        // ---- profils (le rang est conservé comme information) ----
        var profils = tsp.Profiles.Select((p, i) => new ProfilProjet
        {
            ProjetId = id, Rang = i, Nom = p.Nom, Entite = p.Entite, Tjm = p.Tjm, Cjm = p.Cjm, Prcs = p.Prcs, Frais = p.Frais,
            Collaborateur = p.Collaborateur, Origine = OrigineElement.Tsp, EstAgentIa = i == tsp.Settings.IaProfile,
        }).ToList();
        projet.Profils.AddRange(profils);
        projet.Grille.AddRange(tsp.Grille.Select((g, i) => new GrilleAgence
        {
            ProjetId = id, Ordre = i, Profil = g.Profil, TjmParis = g.TjmParis, CjmParis = g.CjmParis, TjmRegion = g.TjmRegion, CjmRegion = g.CjmRegion,
        }));

        // ---- planning vendu par profil (toutes les cellules, y compris les zéros, pour garder les colonnes du TSP) ----
        for (var i = 0; i < profils.Count; i++)
            for (var k = 0; k < tsp.PlanningRef.Months.Count; k++)
            {
                var ligne = i < tsp.PlanningRef.Rows.Count ? tsp.PlanningRef.Rows[i] : new List<decimal>();
                projet.PlanningProfils.Add(new PlanningVenduProfil
                {
                    ProjetId = id, ProfilProjetId = profils[i].Id, Mois = tsp.PlanningRef.Months[k], JoursHomme = k < ligne.Count ? ligne[k] : 0,
                });
            }
        // ---- planning vendu par phase ----
        for (var i = 0; i < tsp.PlanningPhases.Rows.Count; i++)
        {
            var l = tsp.PlanningPhases.Rows[i];
            var ligne = new PlanningVenduPhase
            {
                ProjetId = id, Phase = l.Phase, Ordre = i,
                CjmSaisi = l.Cjm switch { null => null, decimal d => d.ToString(CultureInfo.InvariantCulture), _ => l.Cjm.ToString() },
            };
            ligne.Mois.AddRange(l.Vals.Select(v => new PlanningVenduPhaseMois { ProjetId = id, PlanningVenduPhaseId = ligne.Id, Mois = v.Key, JoursHomme = v.Value }));
            projet.PlanningPhases.Add(ligne);
        }

        // ---- budgets, prestataires, métrique, échéancier ----
        projet.BudgetAchats.AddRange(tsp.Achats.Select((a, i) => new LigneBudgetAchat
        {
            ProjetId = id, Ordre = i, Designation = a.Designation, Type = a.Type, CoutUnitaire = a.Cu, Quantite = a.Qte, Revente = a.Revente, Commentaire = a.Commentaire,
        }));
        projet.BudgetFrais.AddRange(tsp.Frais.Select((x, i) => new LigneBudgetFrais
        {
            ProjetId = id, Ordre = i, Libelle = x.Libelle, CoutUnitaire = x.Cu, Quantite = x.Qte, Refacture = x.Refacture, Commentaire = x.Commentaire,
        }));
        projet.Prestataires.AddRange(tsp.Prestas.Select((x, i) => new Prestataire
        {
            ProjetId = id, Ordre = i, Designation = x.Designation, Societe = x.Societe, CoutJour = x.CoutJour, NombreJours = x.Nbj, Tjm = x.Tjm, Commentaire = x.Commentaire,
        }));
        projet.Metriques.AddRange(tsp.Metrique.Select((m, i) => new Metrique { ProjetId = id, Ordre = i, Etape = m.Etape, Pourcentage = m.Pct }));
        projet.Echeances.AddRange(tsp.Echeancier.Select(e => new Echeance { ProjetId = id, Numero = e.N, Nom = e.Nom, Pourcentage = e.Pct, MoisTsp = e.Mois }));

        // ---- référentiels ----
        var axes = tsp.Axes.Select((a, i) => new Axe { ProjetId = id, Code = a.Key, Nom = a.Value, Ordre = i }).ToList();
        projet.Axes.AddRange(axes);
        var phases = new List<Phase>();
        foreach (var code in tsp.Ref.Phases)
            if (!phases.Any(p => p.Code == code)) phases.Add(new Phase { ProjetId = id, Code = code, Ordre = phases.Count, ListeReference = true });
        foreach (var t in tsp.Tasks)
            if (t.Phase.Length > 0 && !phases.Any(p => p.Code == t.Phase)) phases.Add(new Phase { ProjetId = id, Code = t.Phase, Ordre = phases.Count, ListeReference = false });
        projet.Phases.AddRange(phases);
        projet.Etapes.AddRange(tsp.Ref.Etapes.Select((e, i) => new Etape { ProjetId = id, Libelle = e, Ordre = i }));
        projet.AjouterTypesSocle();

        // ---- tâches et charges vendues ----
        for (var k = 0; k < tsp.Tasks.Count; k++)
        {
            var t = tsp.Tasks[k];
            var tache = new Tache
            {
                ProjetId = id, Repere = t.Uid, Position = k * Suivi.PerimetreService.PasPosition, Origine = OrigineElement.Tsp, LigneTsp = t.Ligne,
                CodeAxeTsp = t.Id, LotTsp = t.Lot, PhaseTsp = t.Phase, EtapeTsp = t.Etape, LibelleTsp = t.Label, Hypothese = t.Hypothese,
                MarqueurLivrable = t.Livrable, EstSection = t.Section, ColonneLivrable = t.LivCol,
                AxeId = axes.FirstOrDefault(a => a.Code == t.Id)?.Id,
                PhaseId = phases.FirstOrDefault(p => p.Code == t.Phase)?.Id,
            };
            for (var i = 0; i < profils.Count && i < t.Charges.Count; i++)
                if (t.Charges[i] != 0)
                    tache.Charges.Add(new ChargeTache { ProjetId = id, TacheId = tache.Id, ProfilProjetId = profils[i].Id, ChargeVendue = t.Charges[i] });
            projet.Taches.Add(tache);
        }
        return projet;
    }

    private static string? Vide(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
}
