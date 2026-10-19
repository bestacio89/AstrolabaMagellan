using PilotageForfaits.Domain.Calcul;

namespace PilotageForfaits.Domain.Tests;

/// <summary>
/// Jeu de tests de référence : chaque scénario a été calculé par le moteur de la version de référence (version HTML du
/// 18/10/2026, outils/reference-poc/poc/core.js), à la date du 06/10/2026 (outils/reference-poc/scenarios.cjs).
/// Le moteur C# doit donner exactement les mêmes résultats.
/// </summary>
public sealed class MoteurCalculReferenceTests
{
    private static readonly DateOnly DateDesScenarios = new(2026, 10, 6);

    [Theory]
    [InlineData("scenario-a-tsp-importe")]          // TSP importé, aucun suivi
    [InlineData("scenario-a-suivi-en-cours")]       // suivi complet : IA, annulations, ajouts, échéances facturées, achats, frais…
    [InlineData("scenario-a-regroupement-lot")]     // même suivi, regroupé par lot
    [InlineData("scenario-a-regroupement-phase")]   // même suivi, regroupé par phase
    [InlineData("scenario-b-tsp-sans-dates")]       // TSP sans fiche ni période
    [InlineData("scenario-c-projet-vide")]          // projet créé vide (V1)
    [InlineData("scenario-d-planning-previsionnel")] // planning (dates saisies, sous-parties, jalons), prévisionnel replanifié, risques 4 × 4
    [InlineData("scenario-d-planning-par-phase")]   // même planning, regroupé par phase
    public void Le_moteur_donne_les_memes_resultats_que_la_version_de_reference(string scenario)
    {
        var projet = OutilsTests.LireObjet<ProjetCalcul>($"{scenario}.entree.json");

        var resultat = MoteurCalcul.Calculer(projet, DateDesScenarios);

        OutilsTests.VerifierIdentique(OutilsTests.Lire($"{scenario}.attendu.json"), OutilsTests.VersJson(resultat), scenario);
    }

    [Fact]
    public void Le_calcul_ne_modifie_pas_les_donnees_d_entree()
    {
        var projet = OutilsTests.LireObjet<ProjetCalcul>("scenario-a-suivi-en-cours.entree.json");
        var avant = OutilsTests.VersJson(projet).ToJsonString();

        MoteurCalcul.Calculer(projet, DateDesScenarios);

        Assert.Equal(avant, OutilsTests.VersJson(projet).ToJsonString());
    }
}
