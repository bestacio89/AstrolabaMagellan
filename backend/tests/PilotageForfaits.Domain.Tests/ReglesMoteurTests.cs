using PilotageForfaits.Domain.Calcul;

namespace PilotageForfaits.Domain.Tests;

/// <summary>Règles validées du moteur, vérifiées sur des cas simples et lisibles.</summary>
public sealed class ReglesMoteurTests
{
    private static readonly DateOnly Jour = new(2026, 10, 6);

    /// <summary>Projet minimal : un chef de projet (index 0), un consultant (1), l'Agent IA (2).</summary>
    private static ProjetCalcul Projet(decimal chefDeProjet, decimal consultant, decimal agentIa, SuiviTacheCalcul? suivi = null)
    {
        var p = new ProjetCalcul
        {
            Profiles =
            [
                new ProfilCalcul { Nom = "Chef de projet", Tjm = 800, Cjm = 400 },
                new ProfilCalcul { Nom = "Consultant", Tjm = 700, Cjm = 350 },
                new ProfilCalcul { Nom = "Agent IA", Tjm = 800, Cjm = 50 },
            ],
            Tasks = [new TacheCalcul { Uid = "r1", Id = "AXE1", Phase = "CONSTRUCTION", Label = "Tâche", Charges = [chefDeProjet, consultant, agentIa] }],
            Settings = new ParametresCalcul { StartMonth = "2026-09", IaProfile = 2 },
            Dates = new DatesProjetCalcul { Debut = new DateOnly(2026, 9, 1), FinContrat = new DateOnly(2026, 12, 31), FinPrevue = new DateOnly(2026, 12, 31) },
        };
        if (suivi is not null) p.Track["r1"] = suivi;
        return p;
    }

    private static Dictionary<int, Dictionary<string, decimal>> Conso(int profil, params (string Jour, decimal Jh)[] jours) =>
        new() { [profil] = jours.ToDictionary(j => j.Jour, j => j.Jh) };

    [Fact]
    public void Le_reste_a_faire_automatique_se_calcule_profil_par_profil()
    {
        // le consultant dépasse sa charge (3 pour 2) : son dépassement ne compense pas le reste du chef de projet
        var p = Projet(1, 2, 0, new SuiviTacheCalcul { ConsoP = Conso(1, ("2026-09-01", 1), ("2026-09-02", 1), ("2026-09-03", 1)) });
        var t = MoteurCalcul.Calculer(p, Jour).Tasks[0];
        Assert.Equal(1m, t.Raf);           // reste du chef de projet : 1
        Assert.Equal(4m, t.Atterrissage);  // 3 consommés + 1 restant
        Assert.Equal(1m, t.Ecart);
    }

    [Fact]
    public void Une_tache_validee_n_a_plus_de_reste_a_faire_meme_si_un_raf_a_ete_saisi()
    {
        var p = Projet(2, 0, 0, new SuiviTacheCalcul { Statut = "Validé", Avancement = 1, Raf = 3, ConsoP = Conso(0, ("2026-09-01", 1)) });
        var t = MoteurCalcul.Calculer(p, Jour).Tasks[0];
        Assert.Equal(0m, t.Raf);
        Assert.Null(t.RafSaisi);
    }

    [Fact]
    public void L_enveloppe_IA_absorbe_d_abord_le_depassement_des_profils_humains()
    {
        // charge humaine 2 + enveloppe IA 1 ; 2,5 JH consommés → IA consommée = 2,5 − 2 = 0,5 ; résultat = 1 − 0,5 = 0,5
        var p = Projet(0, 2, 1, new SuiviTacheCalcul { Statut = "Validé", Avancement = 1, IaJustif = "ok", ConsoP = Conso(1, ("2026-09-01", 1), ("2026-09-02", 1), ("2026-09-03", 0.5m)) });
        var t = MoteurCalcul.Calculer(p, Jour).Tasks[0];
        Assert.Equal(0.5m, t.IaConso);
        Assert.Equal(0.5m, t.IaRes);
        Assert.Equal("partielle", t.IaStatut);
    }

    [Fact]
    public void Une_tache_a_son_budget_humain_n_est_pas_en_depassement_IA()
    {
        var p = Projet(0, 2, 1, new SuiviTacheCalcul { Statut = "Validé", Avancement = 1, ConsoP = Conso(1, ("2026-09-01", 1), ("2026-09-02", 1)) });
        var t = MoteurCalcul.Calculer(p, Jour).Tasks[0];
        Assert.Equal(0m, t.IaConso);
        Assert.Equal("totale", t.IaStatut);
        Assert.True(t.IaAJustifier); // un bilan IA est demandé à la validation
    }

    [Fact]
    public void Le_statut_passe_en_cours_des_le_premier_consomme()
    {
        var p = Projet(2, 0, 0, new SuiviTacheCalcul { ConsoP = Conso(0, ("2026-09-01", 0.5m)) });
        Assert.Equal("En cours", MoteurCalcul.Calculer(p, Jour).Tasks[0].Statut);
    }

    [Fact]
    public void Plus_d_une_journee_le_meme_jour_est_signale()
    {
        var p = Projet(3, 0, 0, new SuiviTacheCalcul { ConsoP = Conso(0, ("2026-09-01", 1.5m)) });
        var r = MoteurCalcul.Calculer(p, Jour);
        Assert.Single(r.SurJours);
        Assert.Equal("jour", r.Vigilance[0].Cle);
    }

    [Fact]
    public void Un_profil_ACHAT_peut_depasser_une_journee()
    {
        var p = Projet(3, 0, 0, new SuiviTacheCalcul { ConsoP = Conso(0, ("2026-09-01", 1.5m)) });
        p.Profiles[0].Entite = "ACHAT";
        Assert.Empty(MoteurCalcul.Calculer(p, Jour).SurJours);
    }

    [Fact]
    public void Une_echeance_facturee_garde_son_montant_et_l_avenant_se_repartit_sur_les_autres()
    {
        var p = Projet(10, 0, 0, new SuiviTacheCalcul { Annul = new AnnulationCalcul { Avenant = true } });
        p.Tasks.Add(new TacheCalcul { Uid = "r2", Id = "AXE1", Label = "Autre tâche", Charges = [10, 0, 0] });
        p.Echeancier = [new EcheanceCalcul { N = 1, Nom = "Lancement", Pct = 0.5m, Mois = "2026-09" }, new EcheanceCalcul { N = 2, Nom = "Fin", Pct = 0.5m, Mois = "2026-12" }];
        p.EchTrack[1] = new SuiviEcheanceCalcul { RealiseLe = new DateOnly(2026, 9, 30), MontantFacture = 8000 };
        var r = MoteurCalcul.Calculer(p, Jour);
        // CA vendu 16 000 € ; avenant de réduction de 8 000 € (r1 annulée) → CA 8 000 € ; 8 000 € déjà facturés et figés
        Assert.Equal(8000m, r.Echeancier[0].Montant);
        Assert.Equal(0m, r.Echeancier[1].Montant);
        Assert.Equal(8000m, r.Financier.Ca);
    }

    [Fact]
    public void Le_projet_vide_se_calcule_sans_erreur()
    {
        var p = new ProjetCalcul
        {
            Settings = new ParametresCalcul { StartMonth = "2026-11" },
            Dates = new DatesProjetCalcul { Debut = new DateOnly(2026, 11, 2), FinContrat = new DateOnly(2027, 2, 26), FinPrevue = new DateOnly(2027, 2, 26) },
        };
        var r = MoteurCalcul.Calculer(p, Jour);
        Assert.Empty(r.Tasks);
        Assert.All(r.Vigilance, v => Assert.Equal("ok", v.Niveau));
    }

    // ---- réaffectation de la charge d'un profil à un autre ----

    /// <summary>Projet de 1 JH de chef de projet (A. Durand, CJM 400), avec un second chef de projet (C. Petit, CJM <paramref name="cjmPetit"/>).</summary>
    private static ProjetCalcul ProjetAvecDeuxChefsDeProjet(decimal cjmPetit, params ReaffectationCalcul[] reaff)
    {
        var p = Projet(1, 0, 0, new SuiviTacheCalcul { Reaff = reaff.ToList() });
        p.Profiles.Add(new ProfilCalcul { Nom = "Chef de projet", Collaborateur = "C. Petit", Tjm = 800, Cjm = cjmPetit, Ajout = new AjoutCalcul { Motif = "Renfort" } });
        return p;
    }

    [Fact]
    public void Une_reaffectation_deplace_la_charge_sans_changer_le_total_ni_le_CA()
    {
        var sans = MoteurCalcul.Calculer(ProjetAvecDeuxChefsDeProjet(400), Jour);
        var r = MoteurCalcul.Calculer(ProjetAvecDeuxChefsDeProjet(400,
            new ReaffectationCalcul { Id = "e1", De = 0, Vers = 3, Jh = 0.5m, Motif = "Renfort", At = "2026-10-01T09:00:00.000Z" }), Jour);
        var t = r.Tasks[0];
        Assert.Equal(0.5m, t.Charges[0]);
        Assert.Equal(0.5m, t.Charges[3]);
        Assert.Equal(1m, t.Charge);                       // total inchangé
        Assert.Equal(-0.5m, t.ChargesR[0]);
        Assert.Equal(0.5m, t.ChargesR[3]);
        Assert.Equal(0m, t.CoutReaff);                    // même CJM : aucun coût
        Assert.Equal(sans.Financier.Ca, r.Financier.Ca);  // le vendu reste celui du TSP
        Assert.Equal(sans.Financier.CoutPrevu, r.Financier.CoutPrevu);
        Assert.Equal(0m, r.Perimetre.ChargeAjout);        // ce n'est pas un ajout
        Assert.Equal(1, r.Perimetre.NReaff);
        var l = Assert.Single(r.Perimetre.Lignes);
        Assert.Equal("reaff", l.Kind);
        Assert.Equal(0.5m, l.Jh);
        Assert.Equal(0m, l.Cout);
        Assert.Equal(0, l.De);
        Assert.Equal(3, l.Vers);
        Assert.Equal("e1", l.Id);
    }

    [Fact]
    public void Une_reaffectation_vers_un_CJM_different_change_le_cout_et_la_marge()
    {
        var sans = MoteurCalcul.Calculer(ProjetAvecDeuxChefsDeProjet(500), Jour);
        var r = MoteurCalcul.Calculer(ProjetAvecDeuxChefsDeProjet(500, new ReaffectationCalcul { Id = "e1", De = 0, Vers = 3, Jh = 1, Motif = "Compétence" }), Jour);
        Assert.Equal(100m, r.Tasks[0].CoutReaff);         // 1 JH × (500 − 400)
        Assert.Equal(100m, r.Financier.CoutReaff);
        Assert.Equal(sans.Financier.CoutPrevu + 100m, r.Financier.CoutPrevu);
        Assert.Equal(sans.Financier.CoutFinal + 100m, r.Financier.CoutFinal);
        Assert.Equal(sans.Financier.Ca, r.Financier.Ca);
        Assert.Equal(100m, Assert.Single(r.Perimetre.Lignes).Cout);
        Assert.True(r.Perimetre.MargeAvecAjouts < sans.Perimetre.MargeAvecAjouts);
    }

    [Fact]
    public void Une_reaffectation_vers_un_profil_inconnu_est_ignoree()
    {
        var r = MoteurCalcul.Calculer(ProjetAvecDeuxChefsDeProjet(400, new ReaffectationCalcul { De = 0, Vers = 9, Jh = 0.5m }), Jour);
        Assert.Equal(1m, r.Tasks[0].Charges[0]);
        Assert.Empty(r.Perimetre.Lignes);
    }

    /// <summary>Projet dont le TSP prévoit 17 500 € de frais, tous refacturés au client, avec des frais réels.</summary>
    private static FraisCalcules Frais(decimal budgetRefacture, params FraisReelCalcul[] reels)
    {
        var p = Projet(2, 0, 0);
        p.Frais = [new FraisBudgetCalcul { Libelle = "Déplacements", Cu = 500, Qte = 35, Refacture = budgetRefacture }];
        p.FraisReel = reels.ToList();
        return MoteurCalcul.Calculer(p, Jour).Financier.Frais;
    }

    [Fact]
    public void Un_frais_refacturable_ne_change_pas_la_marge()
    {
        Assert.Equal(0m, Frais(17500, new FraisReelCalcul { Montant = 250, Refacturable = true }).ImpactNet);
        // au-delà du budget, il est remboursé au réel : toujours sans effet
        Assert.Equal(0m, Frais(17500, new FraisReelCalcul { Montant = 18000, Refacturable = true }).ImpactNet);
    }

    [Fact]
    public void Un_frais_non_refacture_au_dela_de_la_part_prevue_a_notre_charge_reduit_la_marge()
    {
        // TSP : tout est refacturé (aucune part à notre charge) → les 250 € non refacturés sont une perte, même sous le budget
        var f = Frais(17500, new FraisReelCalcul { Montant = 250, Refacturable = false });
        Assert.Equal(-250m, f.ImpactNet);
        Assert.Equal(250m, f.ReelNonRef);
        Assert.Equal(0m, f.BudgetNonRef);
        // TSP : 2 500 € prévus à notre charge → 250 € non refacturés restent dans la part prévue
        Assert.Equal(0m, Frais(15000, new FraisReelCalcul { Montant = 250, Refacturable = false }).ImpactNet);
        // … et seul le dépassement de cette part réduit la marge
        Assert.Equal(-500m, Frais(15000, new FraisReelCalcul { Montant = 3000, Refacturable = false }).ImpactNet);
    }

    [Fact]
    public void Un_frais_refacturable_ne_cree_pas_de_gain_quand_le_TSP_ne_prevoyait_rien_de_refacture()
    {
        // ancienne règle : +250 € de gain fictif (le refacturé s'ajoutait sans que le coût augmente)
        Assert.Equal(0m, Frais(0, new FraisReelCalcul { Montant = 250, Refacturable = true }).ImpactNet);
    }
}
