using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Tests;

/// <summary>Identité d'un projet : le numéro d'opportunité d'abord, la version du TSP n'en fait pas partie.</summary>
public sealed class IdentiteProjetTests
{
    [Theory]
    [InlineData("OP00123 - CLIENT - TSP - V3", "OP:00123")]
    [InlineData("op 00123 client tsp v4", "OP:00123")]
    [InlineData("Proposition OP-00123", "OP:00123")]
    [InlineData("PROP-2026-14 - V2", "REF:PROP 2026 14")]
    public void La_cle_vient_de_la_reference(string reference, string attendu) =>
        Assert.Equal(attendu, IdentiteProjet.Cle(reference, "Client", "Projet"));

    [Fact]
    public void Sans_reference_la_cle_est_le_client_et_le_nom_sans_accents_ni_majuscules()
    {
        Assert.Equal(IdentiteProjet.Cle(null, "Hélios", "Refonte  du portail"), IdentiteProjet.Cle("  ", "HELIOS", "refonte du Portail"));
        Assert.NotEqual(IdentiteProjet.Cle(null, "Hélios", "Refonte"), IdentiteProjet.Cle(null, "Hélios", "Migration"));
    }

    [Fact]
    public void Un_mot_qui_contient_OP_n_est_pas_un_numero_d_opportunite()
    {
        Assert.Null(IdentiteProjet.NumeroOpportunite("STOP 12345"));
        Assert.Equal("V3", IdentiteProjet.Version("OP00123 - TSP - V3"));
    }
}
