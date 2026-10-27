using System.Security.Claims;
using PilotageForfaits.Api.Authentification;
using PilotageForfaits.Application.Abstractions;

namespace PilotageForfaits.Api.Tests;

public sealed class TransformationRolesEntraTests
{
    [Fact]
    public async Task Identite_authentifiee_recoit_les_capacites_de_base_sans_acces_global()
    {
        var principal = Authentifie();
        await new TransformationRolesEntra().TransformAsync(principal);

        Assert.Contains(CapacitesApplication.ProjetsLire, Valeurs(principal));
        Assert.Contains(CapacitesApplication.ProjetsModifier, Valeurs(principal));
        Assert.Contains(CapacitesApplication.ConsommeSaisir, Valeurs(principal));
        Assert.DoesNotContain(CapacitesApplication.ProjetsLireTous, Valeurs(principal));
        Assert.DoesNotContain(CapacitesApplication.ProjetsCreer, Valeurs(principal));
        Assert.DoesNotContain(CapacitesApplication.ExportsFinanciers, Valeurs(principal));
    }

    [Fact]
    public async Task Role_Manager_accorde_les_capacites_de_supervision_metier()
    {
        var principal = Authentifie(new Claim("roles", RolesGlobaux.Manager));
        await new TransformationRolesEntra().TransformAsync(principal);

        var capacites = Valeurs(principal);
        Assert.Contains(CapacitesApplication.ProjetsLireTous, capacites);
        Assert.Contains(CapacitesApplication.ProjetsCreer, capacites);
        Assert.Contains(CapacitesApplication.ProjetsAffecterUtilisateurs, capacites);
        Assert.Contains(CapacitesApplication.ExportsFinanciers, capacites);
        Assert.DoesNotContain(CapacitesApplication.UtilisateursAdministrer, capacites);
    }

    [Fact]
    public async Task Role_Admin_accorde_l_administration_sans_droit_financier_implicite()
    {
        var principal = Authentifie(new Claim("roles", RolesGlobaux.Admin));
        await new TransformationRolesEntra().TransformAsync(principal);

        var capacites = Valeurs(principal);
        Assert.Contains(CapacitesApplication.ProjetsLireTous, capacites);
        Assert.Contains(CapacitesApplication.ProjetsAffecterUtilisateurs, capacites);
        Assert.Contains(CapacitesApplication.UtilisateursAdministrer, capacites);
        Assert.DoesNotContain(CapacitesApplication.ProjetsCreer, capacites);
        Assert.DoesNotContain(CapacitesApplication.ExportsFinanciers, capacites);
    }

    [Fact]
    public async Task Role_inconnu_n_accorde_aucun_privilege_global()
    {
        var principal = Authentifie(new Claim("roles", "SuperAdmin"));
        await new TransformationRolesEntra().TransformAsync(principal);

        var capacites = Valeurs(principal);
        Assert.DoesNotContain(CapacitesApplication.ProjetsLireTous, capacites);
        Assert.DoesNotContain(CapacitesApplication.ProjetsCreer, capacites);
        Assert.DoesNotContain(CapacitesApplication.UtilisateursAdministrer, capacites);
    }

    [Fact]
    public async Task Capacites_fournies_dans_le_jeton_sont_supprimees_et_recalculees()
    {
        var principal = Authentifie(
            new Claim(CapacitesApplication.TypeClaim, CapacitesApplication.UtilisateursAdministrer),
            new Claim(CapacitesApplication.TypeClaim, CapacitesApplication.ExportsFinanciers));
        await new TransformationRolesEntra().TransformAsync(principal);

        var capacites = Valeurs(principal);
        Assert.DoesNotContain(CapacitesApplication.UtilisateursAdministrer, capacites);
        Assert.DoesNotContain(CapacitesApplication.ExportsFinanciers, capacites);
        Assert.Contains(CapacitesApplication.ProjetsLire, capacites);
    }

    [Fact]
    public async Task Identite_non_authentifiee_n_obtient_aucune_capacite()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("roles", RolesGlobaux.Manager)]));
        await new TransformationRolesEntra().TransformAsync(principal);
        Assert.Empty(Valeurs(principal));
    }

    [Fact]
    public async Task Capacites_dev_configurees_sont_preservees()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(CapacitesApplication.TypeClaim, CapacitesApplication.UtilisateursAdministrer)],
            AuthentificationDev.Schema,
            "name",
            "roles"));

        await new TransformationRolesEntra().TransformAsync(principal);

        Assert.Contains(CapacitesApplication.UtilisateursAdministrer, Valeurs(principal));
    }

    private static string[] Valeurs(ClaimsPrincipal principal) =>
        principal.FindAll(CapacitesApplication.TypeClaim).Select(claim => claim.Value).ToArray();

    private static ClaimsPrincipal Authentifie(params Claim[] claims) =>
        new(new ClaimsIdentity(claims, "Tests", "name", "roles"));
}
