using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using PilotageForfaits.Api.Authentification;

namespace PilotageForfaits.Api.Tests;

public sealed class TransformationGroupesEntraTests
{
    private const string GroupeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    private const string GroupeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    [Fact]
    public async Task Groupe_configure_ajoute_les_capacites_mappees()
    {
        var sut = Creer(new Dictionary<string, string?>
        {
            [$"AutorisationEntra:GroupesCapacites:{GroupeA}:0"] = CapacitesApplication.ProjetsLireTous,
            [$"AutorisationEntra:GroupesCapacites:{GroupeA}:1"] = CapacitesApplication.ExportsFinanciers
        });
        var principal = Authentifie(new Claim("groups", GroupeA));
        await sut.TransformAsync(principal);
        Assert.Contains(principal.FindAll(CapacitesApplication.TypeClaim), c => c.Value == CapacitesApplication.ProjetsLireTous);
        Assert.Contains(principal.FindAll(CapacitesApplication.TypeClaim), c => c.Value == CapacitesApplication.ExportsFinanciers);
    }

    [Fact]
    public async Task Plusieurs_groupes_combinent_les_capacites_sans_doublons()
    {
        var sut = Creer(new Dictionary<string, string?>
        {
            [$"AutorisationEntra:GroupesCapacites:{GroupeA}:0"] = CapacitesApplication.ProjetsLireTous,
            [$"AutorisationEntra:GroupesCapacites:{GroupeB}:0"] = CapacitesApplication.ProjetsCreer,
            [$"AutorisationEntra:GroupesCapacites:{GroupeB}:1"] = CapacitesApplication.ProjetsLireTous
        });
        var principal = Authentifie(new Claim("groups", GroupeA), new Claim("groups", GroupeB));
        await sut.TransformAsync(principal);
        Assert.Equal(2, principal.FindAll(CapacitesApplication.TypeClaim).Select(c => c.Value).Distinct().Count());
    }

    [Fact]
    public async Task Groupe_non_mappe_n_accorde_aucune_capacite()
    {
        var principal = Authentifie(new Claim("groups", GroupeA));
        await Creer(new Dictionary<string, string?>()).TransformAsync(principal);
        Assert.Empty(principal.FindAll(CapacitesApplication.TypeClaim));
    }

    [Theory]
    [InlineData("hasgroups", "true")]
    [InlineData("_claim_names", "{\"groups\":\"src1\"}")]
    public async Task Group_overage_n_accorde_aucune_capacite(string type, string valeur)
    {
        var principal = Authentifie(new Claim("groups", GroupeA), new Claim(type, valeur));
        await Creer(new Dictionary<string, string?>
        {
            [$"AutorisationEntra:GroupesCapacites:{GroupeA}:0"] = CapacitesApplication.ProjetsLireTous
        }).TransformAsync(principal);
        Assert.Empty(principal.FindAll(CapacitesApplication.TypeClaim));
    }

    [Fact]
    public async Task Identite_non_authentifiee_n_obtient_aucune_capacite()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("groups", GroupeA)]));
        await Creer(new Dictionary<string, string?>
        {
            [$"AutorisationEntra:GroupesCapacites:{GroupeA}:0"] = CapacitesApplication.ProjetsLireTous
        }).TransformAsync(principal);
        Assert.Empty(principal.FindAll(CapacitesApplication.TypeClaim));
    }


    [Fact]
    public async Task Capacite_presente_dans_le_jeton_est_ignoree_sans_mapping_de_groupe()
    {
        var principal = Authentifie(new Claim(CapacitesApplication.TypeClaim, CapacitesApplication.ExportsFinanciers));
        await Creer(new Dictionary<string, string?>()).TransformAsync(principal);
        Assert.Empty(principal.FindAll(CapacitesApplication.TypeClaim));
    }

    [Fact]
    public async Task Mapping_refuse_une_capacite_inconnue()
    {
        var sut = Creer(new Dictionary<string, string?>
        {
            [$"AutorisationEntra:GroupesCapacites:{GroupeA}:0"] = "administrateur-total"
        });
        var principal = Authentifie(new Claim("groups", GroupeA));
        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.TransformAsync(principal));
    }

    private static TransformationGroupesEntra Creer(IDictionary<string, string?> valeurs) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(valeurs).Build());

    private static ClaimsPrincipal Authentifie(params Claim[] claims) =>
        new(new ClaimsIdentity(claims, "Tests", "name", "roles"));
}
