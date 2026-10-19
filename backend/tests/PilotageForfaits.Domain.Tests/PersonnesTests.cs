using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Domain.Tests;

/// <summary>Une absence appartient à la personne : elle est repérée par son nom, quelle que soit la façon de l'écrire.</summary>
public sealed class PersonnesTests
{
    [Theory]
    [InlineData("Camille Martin")]
    [InlineData("MARTIN Camille")]
    [InlineData("  camille   martin ")]
    [InlineData("Camille MARTIN")]
    public void Un_meme_nom_ecrit_autrement_donne_la_meme_personne(string nom) =>
        Assert.Equal("camille martin", Personnes.Cle(nom));

    [Fact]
    public void Les_accents_ne_comptent_pas() => Assert.Equal(Personnes.Cle("Hélène Léger"), Personnes.Cle("LEGER Helene"));

    [Fact]
    public void Deux_personnes_differentes_restent_distinctes() => Assert.NotEqual(Personnes.Cle("Camille Martin"), Personnes.Cle("Camille Bernard"));
}
