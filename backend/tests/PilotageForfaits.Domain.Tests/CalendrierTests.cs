using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Tests;

public sealed class CalendrierTests
{
    [Fact]
    public void Paques_2026_est_le_5_avril() => Assert.Equal(new DateOnly(2026, 4, 5), Calendrier.Paques(2026));

    [Theory]
    [InlineData("2026-05-14", "Ascension")]
    [InlineData("2026-05-25", "Lundi de Pentecôte")]
    [InlineData("2026-11-11", "Armistice")]
    public void Les_jours_feries_sont_reconnus(string jour, string nom) => Assert.Equal(nom, Calendrier.NomFerie(Calendrier.LireIso(jour)));

    [Fact]
    public void Novembre_2026_compte_20_jours_ouvres()
    {
        // 21 jours de semaine, moins l'Armistice (mercredi) ; la Toussaint tombe un dimanche
        Assert.Equal(20, Calendrier.JoursOuvres(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30)));
    }

    [Theory]
    [InlineData("2026-11", 3, "2027-02")]
    [InlineData("2026-01", -1, "2025-12")]
    public void Ajouter_des_mois(string mois, int n, string attendu) => Assert.Equal(attendu, Calendrier.AjouterMois(mois, n));

    [Theory]
    [InlineData("[Atelier] Cadrage", "", "Atelier")]
    [InlineData("[Livrables] Baseline", "", "Livrable")]
    [InlineData("Session onboarding", "", "Atelier")]
    [InlineData("Rédaction", "oui", "Livrable")]
    [InlineData("Analyse post atelier", "", "Atelier")]
    [InlineData("Pilotage projet", "", "")]
    public void Le_type_est_devine_d_apres_l_intitule(string libelle, string marqueur, string attendu) =>
        Assert.Equal(attendu, ReferentielsMetier.DetecterType(libelle, marqueur));

    [Theory]
    [InlineData("Référence  Propale", "reference propale")]
    [InlineData("Conception fonctionnelle détaillée", "conception fonctionnelle detaillee")]
    [InlineData("Réutilisation d’un actif", "reutilisation d'un actif")]
    public void La_normalisation_ignore_accents_casse_et_apostrophes(string texte, string attendu) => Assert.Equal(attendu, Texte.Norm(texte));
}
