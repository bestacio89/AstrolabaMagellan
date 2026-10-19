using System.Text;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Infrastructure.Excel;

namespace PilotageForfaits.Infrastructure.Tests;

/// <summary>
/// La lecture d'un TSP doit produire exactement les mêmes données que la version de référence (POC v65).
/// Les TSP d'exemple sont des copies anonymisées de TSP réels (outils/reference-poc/anonymise.py).
/// </summary>
public sealed class LecteurTspReferenceTests
{
    private sealed class HorlogeFixe : IHorloge
    {
        public DateTimeOffset Maintenant => new(2026, 10, 6, 10, 0, 0, TimeSpan.Zero);
        public DateOnly Aujourdhui => new(2026, 10, 6);
    }

    /// <summary>Champs comparés (les autres sont propres à l'outil d'origine : version du fichier, suivi vide…).</summary>
    private static readonly string[] Champs =
    [
        "fiche", "periode", "remise", "remiseSaisie", "caInitial", "pctPilotage", "pctProvision", "profiles", "grille", "tasks",
        "planningPhases", "frais", "achats", "prestas", "echeancier", "metrique", "planningRef", "planningSource", "ref", "axes",
        "dates", "settings", "warnings",
    ];

    [Theory]
    [InlineData("tsp-exemple-a")] // TSP complet (fiche, période, planning, Agent IA)
    [InlineData("tsp-exemple-b")] // TSP sans fiche ni période
    public void La_lecture_donne_les_memes_donnees_que_la_version_de_reference(string nom)
    {
        using var fichier = File.OpenRead(OutilsTests.Donnees($"{nom}.xlsx"));

        var tsp = new LecteurTsp(new HorlogeFixe()).Lire(fichier, $"{nom}.xlsx");

        var attendu = OutilsTests.Lire($"{nom}.lecture-attendue.json").AsObject();
        var obtenu = OutilsTests.VersJson(tsp).AsObject();
        foreach (var champ in Champs)
            OutilsTests.VerifierIdentique(attendu[champ], obtenu[champ], $"{nom} › {champ}");
    }

    [Fact]
    public void Un_fichier_qui_n_est_pas_un_classeur_est_refuse_avec_un_message_clair()
    {
        using var faux = new MemoryStream(Encoding.UTF8.GetBytes("ceci n'est pas un fichier Excel"));
        var ex = Assert.Throws<TspInvalideException>(() => new LecteurTsp(new HorlogeFixe()).Lire(faux, "faux.xlsx"));
        Assert.Contains("classeur Excel", ex.Message);
    }
}
