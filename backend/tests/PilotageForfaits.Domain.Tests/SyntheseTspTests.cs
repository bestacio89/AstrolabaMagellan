using PilotageForfaits.Domain.Calcul;

namespace PilotageForfaits.Domain.Tests;

/// <summary>
/// Onglet SYNTHESE du TSP : chaque montant et chaque taux est comparé à la valeur calculée par les formules du modèle de TSP
/// (fichier Excel de référence, recalculé par un tableur sur ce jeu de données fictif : cinq profils, un par entité, remise de 5 %,
/// frais et achats). Les valeurs attendues sont celles du tableur, à 1e-6 près.
/// </summary>
public sealed class SyntheseTspTests
{
    private static readonly DateOnly Jour = new(2026, 10, 6);

    private static ProjetCalcul Projet() => new()
    {
        Remise = 0.05m,
        Profiles =
        [
            new ProfilCalcul { Nom = "Chef de projet", Entite = "FO", Tjm = 900, Cjm = 450 },
            new ProfilCalcul { Nom = "Consultant cession", Entite = "CESSION", Tjm = 800, Cjm = 400, Frais = 600 },
            new ProfilCalcul { Nom = "Expert achat", Entite = "ACHAT", Tjm = 950, Cjm = 500 },
            new ProfilCalcul { Nom = "Développeur BO", Entite = "BO", Tjm = 650, Cjm = 300, Frais = 400 },
            new ProfilCalcul { Nom = "Testeur achat BO", Entite = "ACHAT BO", Tjm = 600, Cjm = 280 },
        ],
        Tasks =
        [
            new TacheCalcul { Uid = "t1", Id = "1", Lot = "Lot A", Phase = "PILOTAGE", Etape = "Pilotage projet", Label = "T1", Charges = [3, 0, 0, 0, 0] },
            new TacheCalcul { Uid = "t2", Id = "1", Lot = "Lot A", Phase = "CONCEPTION", Etape = "Conception Générale", Label = "T2", Charges = [1, 4, 2, 0, 0] },
            new TacheCalcul { Uid = "t3", Id = "1", Lot = "Lot B", Phase = "CONSTRUCTION", Etape = "Développement et tests unitaires", Label = "T3", Charges = [0, 2, 0, 10, 3] },
            new TacheCalcul { Uid = "t4", Id = "1", Lot = "Lot B", Phase = "VALIDATION", Etape = "Tests d’intégration / Recette interne", Label = "T4", Charges = [0.5m, 0, 1, 2, 4] },
            new TacheCalcul { Uid = "t5", Id = "1", Lot = "Lot B", Phase = "PROVISION", Etape = "Provision pour risque", Label = "T5", Charges = [1, 0, 0, 1.5m, 0] },
            // « Provision » en minuscules : SOMME.SI ne tient pas compte de la casse, la tâche compte dans la provision
            new TacheCalcul { Uid = "t6", Id = "1", Lot = "Lot A", Phase = "Provision", Etape = "Provision pour risque", Label = "T6", Charges = [0, 0.5m, 0, 0, 0] },
        ],
        Frais = [new FraisBudgetCalcul { Libelle = "Déplacements", Cu = 450, Qte = 4, Refacture = 1000 }, new FraisBudgetCalcul { Libelle = "Repas", Cu = 120, Qte = 6 }],
        Achats = [new AchatBudgetCalcul { Designation = "Licences", Cu = 2000, Qte = 1, Revente = 2600 }, new AchatBudgetCalcul { Designation = "Câbles", Cu = 300, Qte = 2 }],
        Settings = new ParametresCalcul { StartMonth = "2026-09" },
        Dates = new DatesProjetCalcul { Debut = new DateOnly(2026, 9, 1), FinContrat = new DateOnly(2026, 12, 31), FinPrevue = new DateOnly(2026, 12, 31) },
    };

    private static void Proche(double attendu, decimal? obtenu, string libelle)
    {
        Assert.True(obtenu.HasValue, $"{libelle} : attendu {attendu}, obtenu vide");
        Assert.True(Math.Abs((double)obtenu!.Value - attendu) <= 1e-6 * Math.Max(1, Math.Abs(attendu)), $"{libelle} : attendu {attendu}, obtenu {obtenu}");
    }

    [Fact]
    public void Les_montants_et_taux_globaux_sont_ceux_du_TSP()
    {
        var s = MoteurCalcul.Calculer(Projet(), Jour).Synthese;
        Proche(28276.25, s.MontantProjet, "Montant du projet");
        Proche(35.5, s.Jours, "Nombre de jours produit");
        Proche(24676.25, s.Ca, "Jours valorisés");
        Proche(12585, s.Cout, "Coût du projet pour Exakis Nelite");
        Proche(354.507042253521, s.CjmProd, "CJM de production");
        Proche(0.278658629248772, s.MargeAgence, "Marge brute Agence");
        Proche(0.489995440960438, s.MargeEN, "Marge brute Exakis Nelite");
        Proche(695.105633802817, s.TjmClient, "TJM Client");
        Proche(2520, s.FraisDep, "Frais de déplacement");
        Proche(1000, s.FraisRef, "Montant des frais à refacturer");
        Proche(42.8169014084507, s.FraisNonRefJour, "Frais non refacturés / jour produit");
        Proche(3, s.ProvJH, "Provision pour risque (JH)");
        Proche(2161.25, s.ProvEur, "Provision pour risque (€)");
        Proche(0.0875842155919153, s.ProvPct, "Provision pour risque (%)");
        Proche(2600, s.AchatsMt, "Montant des achats mat/log");
        Proche(2600, s.AchatsRef, "Montant des achats à refacturer");
        Proche(0, s.MargeAchats, "Marge achats");
        Proche(0, s.MargeAchatsPct, "Marge des achats / reventes");
        Proche(10571.25, s.MargeNette, "Marge nette Exakis Nelite (€)");
        Proche(0.373856151363777, s.MargeNettePct, "Marge nette Exakis Nelite (%)");
    }

    [Fact]
    public void Chaque_entite_a_les_valeurs_du_TSP()
    {
        var s = MoteurCalcul.Calculer(Projet(), Jour).Synthese;
        LigneEntite E(string e) => s.Entites.Single(x => x.Entite == e);
        Assert.Equal(new[] { "FO", "CESSION", "ACHAT", "BO", "ACHAT BO" }, s.Entites.Select(x => x.Entite).ToArray());

        Proche(5.5, E("FO").Jours, "FO jours"); Proche(4702.5, E("FO").Ca, "FO CA"); Proche(855, E("FO").Tjm, "FO TJM");
        Proche(450, E("FO").Cjm, "FO CJM"); Proche(0.473684210526316, E("FO").MargeEN, "FO marge EN");

        Proche(6.5, E("CESSION").Jours, "CESSION jours"); Proche(4940, E("CESSION").Ca, "CESSION CA"); Proche(760, E("CESSION").Tjm, "CESSION TJM");
        Proche(400, E("CESSION").Cjm, "CESSION CJM"); Proche(0.473684210526316, E("CESSION").MargeEN, "CESSION marge EN");
        Proche(646.153846153846, E("CESSION").CoutAgenceJour, "CESSION taux de cession interne"); Proche(0.149797570850202, E("CESSION").MargeAgence, "CESSION marge agence");

        Proche(3, E("ACHAT").Jours, "ACHAT jours"); Proche(2707.5, E("ACHAT").Ca, "ACHAT CA"); Proche(902.5, E("ACHAT").Tjm, "ACHAT TJM");
        Proche(500, E("ACHAT").CoutAgenceJour, "ACHAT coût d'achat moyen / j"); Proche(0.445983379501385, E("ACHAT").MargeAgence, "ACHAT marge agence");

        Proche(13.5, E("BO").Jours, "BO jours"); Proche(8336.25, E("BO").Ca, "BO CA"); Proche(617.5, E("BO").Tjm, "BO TJM");
        Proche(300, E("BO").Cjm, "BO CJM"); Proche(0.51417004048583, E("BO").MargeEN, "BO marge EN");

        Proche(7, E("ACHAT BO").Jours, "ACHAT BO jours"); Proche(3990, E("ACHAT BO").Ca, "ACHAT BO CA"); Proche(570, E("ACHAT BO").Tjm, "ACHAT BO TJM");
        Proche(280, E("ACHAT BO").Cjm, "ACHAT BO CJM"); Proche(0.508771929824561, E("ACHAT BO").MargeEN, "ACHAT BO marge EN");

        var bo = s.TotalBo!;
        Proche(20.5, bo.Jours, "TOTAL BO jours"); Proche(12326.25, bo.Ca, "TOTAL BO CA"); Proche(601.280487804878, bo.Tjm, "TOTAL BO TJM");
        Proche(293.170731707317, bo.Cjm, "TOTAL BO CJM"); Proche(0.512422675185073, bo.MargeEN, "TOTAL BO marge EN");
        Proche(469.512195121951, s.PrcsMoyenBack, "PRCS moyen du BACK");
        Proche(0.219146131224014, s.MargeFrontBack, "Marge FRONT / BACK");
    }

    [Fact]
    public void Les_tableaux_croises_reprennent_charge_et_valorisation_par_phase_et_par_lot()
    {
        var s = MoteurCalcul.Calculer(Projet(), Jour).Synthese;
        Proche(5700, s.ParPhase.Single(x => x.Cle == "CONCEPTION").Valo, "CONCEPTION valorisation");
        Proche(9405, s.ParPhase.Single(x => x.Cle == "CONSTRUCTION").Valo, "CONSTRUCTION valorisation");
        Proche(4845, s.ParPhase.Single(x => x.Cle == "VALIDATION").Valo, "VALIDATION valorisation");
        // « PROVISION » et « Provision » : une seule ligne, comme dans un tableau croisé Excel
        var provision = s.ParPhase.Single(x => string.Equals(x.Cle, "PROVISION", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(3m, provision.Charge);
        Proche(2161.25, provision.Valo, "PROVISION valorisation");
        Assert.Equal(6, s.Lignes.Count);
        Assert.Equal(35.5m, s.Lignes.Sum(x => x.Charge));
        Proche(24676.25, s.Lignes.Sum(x => x.Valo), "Total valorisation des lignes");
        Assert.Equal(10.5m, s.Lignes.Where(x => x.Lot == "Lot A").Sum(x => x.Charge));
    }

    [Fact]
    public void Sans_achat_la_marge_des_achats_reste_vide_et_l_entite_se_lit_sans_tenir_compte_de_la_casse()
    {
        var p = Projet();
        p.Achats = [new AchatBudgetCalcul { Designation = "Revente seule", Cu = 0, Qte = 0, Revente = 800 }];
        p.Profiles[0].Entite = " fo ";
        var s = MoteurCalcul.Calculer(p, Jour).Synthese;
        Assert.Null(s.MargeAchatsPct); // SI(achats <> 0 ; … ; "") : vide dans le TSP
        Proche(800, s.MargeAchats, "Marge achats");
        Proche(5.5, s.Entites.Single(x => x.Entite == "FO").Jours, "FO jours (entité saisie « fo »)");
    }
}
