using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Domain.Tests;

/// <summary>Règles portées par les objets du modèle (statut ⇔ avancement, facturation, journée maximale…).</summary>
public sealed class ReglesEntitesTests
{
    private static readonly DateOnly Jour = new(2026, 10, 6);

    [Fact]
    public void Valider_met_l_avancement_a_100_pourcent()
    {
        var t = new Tache { Avancement = 0.5m };
        t.DefinirStatut(StatutTache.Valide, Jour);
        Assert.Equal(1m, t.Avancement);
        Assert.Equal(Jour, t.ValideeLe);
    }

    [Theory]
    [InlineData(StatutTache.EnCours, 0.75)]
    [InlineData(StatutTache.EnRecette, 0.75)]
    [InlineData(StatutTache.AFaire, 0)]
    public void Quitter_valide_ramene_l_avancement_a_75_ou_0_pourcent(StatutTache nouveau, double avancementAttendu)
    {
        var t = new Tache();
        t.DefinirStatut(StatutTache.Valide, Jour);
        t.DefinirStatut(nouveau, Jour);
        Assert.Equal((decimal)avancementAttendu, t.Avancement);
        Assert.Null(t.ValideeLe);
    }

    [Fact]
    public void Atteindre_100_pourcent_propose_de_valider_sans_valider()
    {
        var t = new Tache { Statut = StatutTache.EnCours };
        Assert.True(t.DefinirAvancement(1));
        Assert.Equal(StatutTache.EnCours, t.Statut);
    }

    [Fact]
    public void Une_tache_validee_qui_passe_sous_100_pourcent_repasse_en_cours()
    {
        var t = new Tache();
        t.DefinirStatut(StatutTache.Valide, Jour);
        t.DefinirAvancement(0.5m);
        Assert.Equal(StatutTache.EnCours, t.Statut);
    }

    [Fact]
    public void Aucune_saisie_n_est_possible_sur_une_tache_annulee()
    {
        var t = new Tache();
        t.Evolutions.Add(new EvolutionPerimetre { Nature = NatureEvolution.Annulation, Le = DateTimeOffset.UtcNow });
        Assert.True(t.EstAnnulee);
        Assert.Throws<RegleMetierException>(() => t.DefinirStatut(StatutTache.EnCours, Jour));
    }

    [Fact]
    public void Une_tache_retablie_n_est_plus_annulee()
    {
        var t = new Tache();
        t.Evolutions.Add(new EvolutionPerimetre { Nature = NatureEvolution.Annulation, Le = new DateTimeOffset(2026, 9, 1, 10, 0, 0, TimeSpan.Zero) });
        t.Evolutions.Add(new EvolutionPerimetre { Nature = NatureEvolution.Retablissement, Le = new DateTimeOffset(2026, 9, 2, 10, 0, 0, TimeSpan.Zero) });
        Assert.False(t.EstAnnulee);
    }

    [Fact]
    public void La_fin_prevue_doit_etre_apres_le_debut()
    {
        var t = new Tache();
        Assert.Throws<RegleMetierException>(() => t.DefinirDatesPrevues(new DateOnly(2026, 10, 10), new DateOnly(2026, 10, 1)));
    }

    [Fact]
    public void Une_facture_ne_peut_pas_etre_datee_dans_le_futur()
    {
        var e = new Echeance();
        Assert.Throws<RegleMetierException>(() => e.Facturer(Jour.AddDays(1), 1000, Jour));
    }

    [Fact]
    public void Une_echeance_facturee_a_un_montant_fige_et_n_est_plus_selectionnable()
    {
        var e = new Echeance();
        e.Facturer(Jour, 12500, Jour);
        Assert.Equal(12500m, e.MontantFacture);
        Assert.False(e.EstSelectionnable);
    }

    [Fact]
    public void Le_paiement_suit_la_facturation()
    {
        var e = new Echeance();
        Assert.Throws<RegleMetierException>(() => e.EnregistrerPaiement(Jour, Jour));
        e.Facturer(Jour, 1000, Jour);
        Assert.Throws<RegleMetierException>(() => e.EnregistrerPaiement(Jour.AddDays(-1), Jour));
    }

    [Theory]
    [InlineData("FO", 1.0, false)]
    [InlineData("FO", 1.25, true)]
    [InlineData("ACHAT", 2.0, false)]
    [InlineData("CESSION", 3.0, false)]
    public void Une_personne_ne_depasse_pas_une_journee_sauf_ACHAT_et_CESSION(string entite, double total, bool refuse)
    {
        var profil = new ProfilProjet { Nom = "Consultant", Entite = entite };
        var ex = Record.Exception(() => RegleJournee.Verifier(profil, (decimal)total));
        Assert.Equal(refuse, ex is RegleMetierException);
    }

    [Fact]
    public void Un_projet_vide_exige_une_fin_apres_le_debut()
    {
        Assert.Throws<RegleMetierException>(() =>
            Projet.CreerVide("Client", "Projet", null, new DateOnly(2027, 1, 1), new DateOnly(2026, 1, 1), null, null, DateTimeOffset.UtcNow));
    }

    [Fact]
    public void Un_projet_vide_est_en_preparation_avec_les_types_socle()
    {
        var p = Projet.CreerVide("Client", "Projet", null, new DateOnly(2026, 11, 2), new DateOnly(2027, 2, 26), null, null, DateTimeOffset.UtcNow);
        Assert.Equal(StatutProjet.EnPreparation, p.Statut);
        Assert.Equal(OrigineProjet.CreationManuelle, p.Origine);
        Assert.Equal(new[] { "Atelier", "Livrable" }, p.TypesTache.Select(t => t.Code).ToArray());
        Assert.Empty(p.Taches);
    }

    [Theory]
    [InlineData("2026-11-02", false, StatutProjet.EnPreparation)] // démarre plus tard, aucun temps saisi
    [InlineData("2026-11-02", true, StatutProjet.EnCours)]        // du temps saisi avant la date prévue : il a démarré
    [InlineData("2026-10-06", false, StatutProjet.EnCours)]       // la date de début est atteinte
    [InlineData(null, false, StatutProjet.EnPreparation)]         // pas de date, pas de temps
    public void Le_statut_affiche_se_deduit_des_dates_et_du_temps_saisi(string? debut, bool aDuTemps, StatutProjet attendu)
    {
        var p = new Projet { Statut = StatutProjet.EnPreparation, Debut = debut is null ? null : DateOnly.ParseExact(debut, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture) };
        Assert.Equal(attendu, p.StatutAffiche(Jour, aDuTemps));
    }

    [Fact]
    public void Un_projet_archive_reste_archive_quelles_que_soient_ses_dates()
    {
        var p = new Projet { Statut = StatutProjet.Archive, Debut = new DateOnly(2025, 1, 1) };
        Assert.Equal(StatutProjet.Archive, p.StatutAffiche(Jour, true));
    }
}
