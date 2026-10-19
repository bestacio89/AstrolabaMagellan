using System.Net;
using System.Net.Http.Headers;

namespace PilotageForfaits.Api.Tests;

/// <summary>Vérifie que la frontière HTTP rejette les requêtes non authentifiées et les JWT invalides.</summary>
public sealed class AuthentificationEntraApiTests : IClassFixture<FabriqueEntraApi>
{
    private readonly HttpClient _client;

    public AuthentificationEntraApiTests(FabriqueEntraApi api) => _client = api.CreateClient();

    [Fact]
    public async Task La_sante_reste_accessible_sans_jeton()
    {
        var reponse = await _client.GetAsync("/api/sante");
        Assert.Equal(HttpStatusCode.OK, reponse.StatusCode);
    }

    [Fact]
    public async Task Une_route_protegee_refuse_une_requete_sans_jeton()
    {
        var reponse = await _client.GetAsync("/api/moi");
        Assert.Equal(HttpStatusCode.Unauthorized, reponse.StatusCode);
    }

    [Fact]
    public async Task Une_route_protegee_refuse_un_jeton_mal_forme()
    {
        using var requete = RequeteAvecJeton("not-a-jwt");
        var reponse = await _client.SendAsync(requete);
        Assert.Equal(HttpStatusCode.Unauthorized, reponse.StatusCode);
    }

    [Theory]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("expired")]
    public async Task Une_route_protegee_refuse_un_jeton_signe_mais_invalide(string cas)
    {
        var maintenant = DateTime.UtcNow;
        var jeton = cas switch
        {
            "issuer" => FabriqueEntraApi.CreerJeton(issuer: "https://issuer-inconnu.example/"),
            "audience" => FabriqueEntraApi.CreerJeton(audience: "api://autre-api"),
            "expired" => FabriqueEntraApi.CreerJeton(expirationUtc: maintenant.AddMinutes(-5)),
            _ => throw new ArgumentOutOfRangeException(nameof(cas))
        };

        using var requete = RequeteAvecJeton(jeton);
        var reponse = await _client.SendAsync(requete);
        Assert.Equal(HttpStatusCode.Unauthorized, reponse.StatusCode);
    }

    [Fact]
    public async Task Un_jeton_valide_passe_la_barriere_d_authentification()
    {
        using var requete = RequeteAvecJeton(FabriqueEntraApi.CreerJeton());
        var reponse = await _client.SendAsync(requete);

        // L'endpoint consulte la base de données, volontairement non configurée dans cette suite.
        // L'assertion porte sur la barrière JWT : une identité valide ne doit pas recevoir 401.
        Assert.NotEqual(HttpStatusCode.Unauthorized, reponse.StatusCode);
    }

    private static HttpRequestMessage RequeteAvecJeton(string jeton)
    {
        var requete = new HttpRequestMessage(HttpMethod.Get, "/api/moi");
        requete.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jeton);
        return requete;
    }
}
