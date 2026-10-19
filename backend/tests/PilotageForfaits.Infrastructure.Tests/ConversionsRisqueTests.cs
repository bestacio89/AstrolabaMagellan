using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Infrastructure.Tests;

/// <summary>
/// Risques : une base remplie avec l'ancienne échelle à 3 niveaux est relue sur la nouvelle (4 niveaux) sans migration de données ;
/// l'écriture se fait toujours sur la nouvelle échelle.
/// </summary>
public sealed class ConversionsRisqueTests
{
    [Theory]
    [InlineData("Faible", ProbabiliteRisque.Faible)]
    [InlineData("Moyenne", ProbabiliteRisque.Moderee)]   // ancienne échelle
    [InlineData("Forte", ProbabiliteRisque.Forte)]
    [InlineData("Moderee", ProbabiliteRisque.Moderee)]
    [InlineData("TresForte", ProbabiliteRisque.TresForte)]
    public void La_probabilite_enregistree_est_relue_sur_4_niveaux(string enBase, ProbabiliteRisque attendue) =>
        Assert.Equal(attendue, new ConversionProbabiliteRisque().ConvertFromProvider(enBase));

    [Theory]
    [InlineData("Faible", ImpactRisque.Faible)]
    [InlineData("Moyen", ImpactRisque.Moyenne)]          // ancienne échelle
    [InlineData("Fort", ImpactRisque.Forte)]             // ancienne échelle
    [InlineData("Moyenne", ImpactRisque.Moyenne)]
    [InlineData("Critique", ImpactRisque.Critique)]
    public void L_importance_enregistree_est_relue_sur_4_niveaux(string enBase, ImpactRisque attendue) =>
        Assert.Equal(attendue, new ConversionImpactRisque().ConvertFromProvider(enBase));

    [Fact]
    public void L_ecriture_se_fait_sur_la_nouvelle_echelle()
    {
        Assert.Equal("Moderee", new ConversionProbabiliteRisque().ConvertToProvider(ProbabiliteRisque.Moderee));
        Assert.Equal("Forte", new ConversionImpactRisque().ConvertToProvider(ImpactRisque.Forte));
    }
}
