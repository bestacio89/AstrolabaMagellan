using PilotageForfaits.Application.Suivi;

namespace PilotageForfaits.Api.Tests;

/// <summary>Textes libres envoyés à un consultant ou un lecteur : aucun montant ne doit y rester.</summary>
public sealed class FiltreMontantsTests
{
    [Theory]
    [InlineData("Atelier décalé, budget déplacement 1 200 €", "Atelier décalé")]
    [InlineData("Décision : annulation, coût évité 1 200 €", "Décision : annulation")]
    [InlineData("Atelier 3 décalé 1 200 €", "Atelier 3 décalé [montant]")]
    [InlineData("Coût € 1 500 validé", "Coût [montant] validé")]
    [InlineData("1500 euros de frais", "[montant] de frais")]
    [InlineData("Réunion en Europe le 3", "Réunion en Europe le 3")]
    public void Les_montants_sont_retires_des_textes_libres(string texte, string attendu) =>
        Assert.Equal(attendu, FiltreMontants.SansMontant(texte));
}
