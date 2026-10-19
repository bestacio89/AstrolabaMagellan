using System.Reflection;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Tests;

/// <summary>
/// Règles du 18/10/2026 (version HTML de référence) : avancement = JH des tâches validées ÷ JH prévus, avancement déclaré
/// hors calcul, risques sur 4 niveaux, colonne « Livrable » du TSP, prévisionnel de charge, planning et jalons.
/// </summary>
public sealed class ReglesAvancementPlanningTests
{
    private static readonly DateOnly Jour = new(2026, 10, 6);

    /// <summary>Deux tâches d'un même axe : 8 JH et 2 JH, un seul profil.</summary>
    private static ProjetCalcul Projet(params (string Uid, decimal Charge, SuiviTacheCalcul? Suivi)[] taches)
    {
        var p = new ProjetCalcul
        {
            Profiles = [new ProfilCalcul { Nom = "Consultant", Tjm = 700, Cjm = 350 }],
            Settings = new ParametresCalcul { StartMonth = "2026-09" },
            Dates = new DatesProjetCalcul { Debut = new DateOnly(2026, 9, 1), FinContrat = new DateOnly(2026, 12, 31), FinPrevue = new DateOnly(2026, 12, 31) },
        };
        foreach (var (uid, charge, suivi) in taches)
        {
            p.Tasks.Add(new TacheCalcul { Uid = uid, Id = "AXE1", Lot = "1.1", Phase = "CONSTRUCTION", Label = "Tâche " + uid, Charges = [charge] });
            if (suivi is not null) p.Track[uid] = suivi;
        }
        return p;
    }

    [Fact]
    public void L_avancement_d_un_groupe_ne_compte_que_les_taches_validees_au_poids_de_leur_charge()
    {
        // 8 JH validés sur 10 → 80 %, quel que soit l'avancement déclaré de la tâche non validée (75 %)
        var p = Projet(("r1", 8, new SuiviTacheCalcul { Statut = "Validé", Avancement = 1 }), ("r2", 2, new SuiviTacheCalcul { Statut = "En cours", Avancement = 0.75m }));
        var m = MoteurCalcul.Calculer(p, Jour);
        Assert.Equal(0.8m, m.Total.Avancement);
        Assert.Equal(0.8m, m.Axes[0].Avancement);
        // l'avancement déclaré reste calculé à part : (8 × 1 + 2 × 0,75) ÷ 10
        Assert.Equal(0.95m, m.Total.AvDeclare);
    }

    [Fact]
    public void L_avancement_n_est_jamais_deduit_du_consomme()
    {
        var p = Projet(("r1", 4, new SuiviTacheCalcul { Statut = "En cours", Avancement = 0.5m, ConsoP = new() { [0] = new() { ["2026-09-01"] = 1, ["2026-09-02"] = 1, ["2026-09-03"] = 1 } } }));
        Assert.Equal(0m, MoteurCalcul.Calculer(p, Jour).Total.Avancement);
    }

    [Fact]
    public void Une_tache_annulee_ne_compte_pas_comme_validee()
    {
        var p = Projet(("r1", 4, new SuiviTacheCalcul { Statut = "Validé", Avancement = 1 }), ("r2", 4, new SuiviTacheCalcul { Annul = new AnnulationCalcul { Motif = "Hors périmètre" } }));
        var m = MoteurCalcul.Calculer(p, Jour);
        // tâche annulée sans consommé : sa charge tombe à 0 ; il reste 4 JH validés sur 4 JH prévus
        Assert.Equal(1m, m.Total.Avancement);
    }

    [Theory]
    [InlineData("Moyenne", "Fort", 6, "moyen")]          // ancienne échelle : Modérée (2) × Forte (3)
    [InlineData("Forte", "Fort", 9, "fort")]             // ancienne échelle : Forte (3) × Forte (3)
    [InlineData("Très forte", "Critique", 16, "fort")]
    [InlineData("Modérée", "Moyenne", 4, "moyen")]
    [InlineData("Faible", "Moyenne", 2, "faible")]
    [InlineData(null, null, 4, "moyen")]                 // valeurs par défaut : Modérée × Moyenne
    public void La_criticite_d_un_risque_se_lit_sur_4_niveaux(string? proba, string? impact, int crit, string niveau)
    {
        var p = Projet(("r1", 1, null));
        p.Risques.Add(new RisqueCalcul { Ref = "R-001", Libelle = "Risque", Proba = proba, Impact = impact, Statut = "Ouvert" });
        var r = MoteurCalcul.Calculer(p, Jour).Risques[0];
        Assert.Equal(crit, r.Crit);
        Assert.Equal(niveau, r.Niveau);
    }

    [Fact]
    public void Un_risque_est_fort_a_partir_de_8_sur_16()
    {
        var p = Projet(("r1", 1, null));
        p.Risques.Add(new RisqueCalcul { Ref = "R-001", Libelle = "Modéré", Proba = "Modérée", Impact = "Forte", Statut = "Ouvert" }); // 6 : moyen
        Assert.DoesNotContain(MoteurCalcul.Calculer(p, Jour).Vigilance, v => v.Cle == "risques");
        p.Risques.Add(new RisqueCalcul { Ref = "R-002", Libelle = "Fort", Proba = "Modérée", Impact = "Critique", Statut = "Ouvert" }); // 8 : fort
        Assert.Contains(MoteurCalcul.Calculer(p, Jour).Vigilance, v => v.Cle == "risques" && (int)v.Valeur == 1);
    }

    [Theory]
    [InlineData("[Livrable] Dossier d'architecture", "", false, "Livrable")] // sans repère : règle du titre
    [InlineData("[Livrable] Dossier d'architecture", "", true, "")]          // colonne renseignée : le titre n'est plus regardé
    [InlineData("Dossier d'architecture", "oui", true, "Livrable")]
    [InlineData("Atelier de cadrage", "", true, "Atelier")]                 // les ateliers restent reconnus par le titre
    [InlineData("[Atelier] Lancement", "oui", true, "Livrable")]           // la colonne prime
    public void La_colonne_Livrable_du_TSP_dit_seule_ce_qu_est_un_livrable(string libelle, string marqueur, bool colonne, string attendu) =>
        Assert.Equal(attendu, ReferentielsMetier.DetecterType(libelle, marqueur, colonne));

    [Fact]
    public void Le_previsionnel_identique_au_planning_vendu_n_est_pas_replanifie()
    {
        var p = Projet(("r1", 4, null));
        p.PlanningRef = new PlanningProfilsCalcul { Months = ["2026-09", "2026-10"], Rows = [[2, 2]] };
        p.PlanningTsp = new PlanningProfilsCalcul { Months = ["2026-09", "2026-10"], Rows = [[2, 2]] };
        var m = MoteurCalcul.Calculer(p, Jour);
        Assert.False(m.Replanifie);
        Assert.Equal(4m, m.TspTotal);

        p.PlanningRef = new PlanningProfilsCalcul { Months = ["2026-09", "2026-10"], Rows = [[1, 3]] };
        m = MoteurCalcul.Calculer(p, Jour);
        Assert.True(m.Replanifie);
        Assert.Equal(2m, m.Mensuel.Single(x => x.Mois == "2026-09").Tsp); // le planning vendu ne bouge pas
        Assert.Equal(1m, m.Mensuel.Single(x => x.Mois == "2026-09").Ref);
    }

    [Fact]
    public void Sans_planning_vendu_le_previsionnel_en_tient_lieu()
    {
        var p = Projet(("r1", 4, null));
        p.PlanningRef = new PlanningProfilsCalcul { Months = ["2026-09"], Rows = [[3]] };
        var m = MoteurCalcul.Calculer(p, Jour);
        Assert.False(m.Replanifie);
        Assert.Equal(3m, m.TspTotal);
    }

    [Fact]
    public void Les_dates_saisies_dans_le_planning_priment_sur_celles_des_taches()
    {
        var p = Projet(("r1", 4, new SuiviTacheCalcul { Debut = new DateOnly(2026, 9, 7), Fin = new DateOnly(2026, 10, 30) }));
        var m = MoteurCalcul.Calculer(p, Jour);
        Assert.Equal(new DateOnly(2026, 9, 7), m.Axes[0].PlanDebut);
        Assert.False(m.Axes[0].PlanSaisi);

        p.Planning = new PlanningCalcul { Groupes = { ["id|AXE1"] = new DatesLignePlanningCalcul { Fin = new DateOnly(2026, 11, 27) } } };
        m = MoteurCalcul.Calculer(p, Jour);
        Assert.Equal(new DateOnly(2026, 9, 7), m.Axes[0].PlanDebut); // début : celui des tâches
        Assert.Equal(new DateOnly(2026, 11, 27), m.Axes[0].PlanFin);  // fin : celle saisie
        Assert.True(m.Axes[0].PlanSaisi);
        Assert.True(m.Axes[0].PlanFinSaisi);
        Assert.False(m.Axes[0].PlanDebutSaisi);
    }

    [Fact]
    public void Les_sous_parties_d_un_axe_sont_les_lignes_de_titre_du_TSP()
    {
        var p = Projet(("r2", 2, null), ("r3", 2, null), ("r5", 1, null));
        // titre r1 (sans axe : prend celui de la tâche qui suit) avant r2 et r3 ; titre r4 (axe AXE1) avant r5
        p.Tasks.Insert(0, new TacheCalcul { Uid = "r1", Label = "Socle", Section = true });
        p.Tasks.Insert(3, new TacheCalcul { Uid = "r4", Id = "AXE1", Label = "Gouvernance", Section = true });
        p.Planning = new PlanningCalcul
        {
            Groupes =
            {
                ["sec|r1|AXE1"] = new DatesLignePlanningCalcul { Debut = new DateOnly(2026, 9, 14), Fin = new DateOnly(2026, 10, 16) },
                ["sec|r4"] = new DatesLignePlanningCalcul { Nom = "Comitologie" },
                ["id|AXE1"] = new DatesLignePlanningCalcul { Debut = new DateOnly(2026, 9, 1) },
            },
        };
        var a = MoteurCalcul.Calculer(p, Jour).Axes.Single(x => x.Id == "AXE1");
        Assert.Equal(new[] { "r1", "r4" }, a.SousParties.Select(x => x.Id));
        Assert.Equal(new[] { "r2", "r3" }, a.SousParties[0].Uids);
        Assert.Equal("Comitologie", a.SousParties[1].Nom);
        Assert.Equal("Gouvernance", a.SousParties[1].NomTSP);
        // axe découpé : pas de saisie propre, il s'étend sur ses sous-parties ; l'ancienne date reste signalée
        Assert.True(a.PlanCalcule);
        Assert.False(a.PlanSaisi);
        Assert.True(a.PlanDeSaisies);
        Assert.Equal(new DateOnly(2026, 9, 14), a.PlanDebut);
        Assert.Equal(new DateOnly(2026, 9, 1), a.PlanAncien!.Debut);
    }

    [Fact]
    public void Les_jalons_sont_numerotes_dans_l_ordre_des_dates_sauf_ceux_a_confirmer()
    {
        var p = Projet(("r1", 1, null));
        p.Planning = new PlanningCalcul
        {
            Jalons =
            [
                new JalonCalcul { Id = "J2", Libelle = "Recette", Type = "periode", Debut = new DateOnly(2026, 11, 2), Fin = new DateOnly(2026, 11, 13) },
                new JalonCalcul { Id = "J1", Libelle = "Lancement", Debut = new DateOnly(2026, 9, 7) },
                new JalonCalcul { Id = "J3", Libelle = "Mise en production", Debut = new DateOnly(2026, 10, 1), AConfirmer = true },
                new JalonCalcul { Id = "J4", Libelle = "Sans date" },
            ],
        };
        var j = MoteurCalcul.Calculer(p, Jour).Jalons;
        Assert.Equal(new[] { "J1", "J3", "J2" }, j.Select(x => x.Id));
        Assert.Equal(new int?[] { 1, null, 2 }, j.Select(x => x.Numero));
    }

    [Fact]
    public void L_avancement_detaille_decoupe_chaque_groupe_par_lot_ou_par_phase()
    {
        var p = Projet(("r1", 8, new SuiviTacheCalcul { Statut = "Validé" }), ("r2", 2, new SuiviTacheCalcul { Lot = "1.2" }));
        var arbre = MoteurCalcul.Calculer(p, Jour).Avancement;
        Assert.Equal("lot", arbre.Cle);
        Assert.Equal(new[] { "Lot 1.1", "Lot 1.2" }, arbre.Groupes[0].Sous.Select(x => x.Nom));
        Assert.Equal(1m, arbre.Groupes[0].Sous[0].Stat.Avancement);

        p.Settings.GroupBy = "lot";
        arbre = MoteurCalcul.Calculer(p, Jour).Avancement;
        Assert.Equal("phase", arbre.Cle);
        Assert.Equal("CONSTRUCTION", arbre.Groupes[0].Sous[0].Nom);
    }

    [Fact]
    public void Une_ligne_du_planning_reprend_toutes_les_statistiques_de_ses_taches()
    {
        // garde-fou : la copie des statistiques (constructeur de StatistiquesTaches) n'oublie aucune propriété
        var p = Projet(("r1", 8, new SuiviTacheCalcul { Statut = "Validé", Avancement = 1, Debut = new DateOnly(2026, 9, 7), Fin = new DateOnly(2026, 9, 30), ConsoP = new() { [0] = new() { ["2026-09-07"] = 1 } } }));
        var m = MoteurCalcul.Calculer(p, Jour);
        foreach (var prop in typeof(StatistiquesTaches).GetProperties(BindingFlags.Public | BindingFlags.Instance))
            Assert.Equal(System.Text.Json.JsonSerializer.Serialize(prop.GetValue(m.Total)), System.Text.Json.JsonSerializer.Serialize(prop.GetValue(m.Axes[0])));
    }
}
