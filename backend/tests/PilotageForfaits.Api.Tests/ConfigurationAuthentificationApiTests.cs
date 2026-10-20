using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace PilotageForfaits.Api.Tests;

public sealed class ConfigurationAuthentificationApiTests
{
    [Fact]
    public void Le_mode_dev_echoue_en_environnement_production()
    {
        using var factory = new FabriqueConfigurationApi(new Dictionary<string, string?>
        {
            ["Authentification:Mode"] = "Dev",
            ["ConnectionStrings:Pilotage"] = "Host=localhost;Database=unused;Username=unused;Password=unused"
        });

        var exception = Record.Exception(() => factory.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("authentification Dev est interdite hors des environnements Development et Tests", exception.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Une_authorite_entra_non_https_est_refusee_au_demarrage()
    {
        using var factory = new FabriqueConfigurationApi(new Dictionary<string, string?>
        {
            ["Authentification:Mode"] = "EntraId",
            ["AzureAd:Instance"] = "http://login.microsoftonline.com/",
            ["AzureAd:TenantId"] = "11111111-1111-4111-8111-111111111111",
            ["AzureAd:ClientId"] = "22222222-2222-4222-8222-222222222222",
            ["AzureAd:Audience"] = "api://22222222-2222-4222-8222-222222222222"
        });

        var exception = Record.Exception(() => factory.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("AzureAd:Instance", exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Un_tenant_entra_qui_n_est_pas_un_guid_est_refuse_au_demarrage()
    {
        using var factory = new FabriqueConfigurationApi(new Dictionary<string, string?>
        {
            ["Authentification:Mode"] = "EntraId",
            ["ConnectionStrings:Pilotage"] = "Host=localhost;Database=unused;Username=unused;Password=unused",
            ["AzureAd:Instance"] = "https://login.microsoftonline.com/",
            ["AzureAd:TenantId"] = "tenant-invalide",
            ["AzureAd:ClientId"] = "22222222-2222-4222-8222-222222222222",
            ["AzureAd:Audience"] = "api://22222222-2222-4222-8222-222222222222"
        });

        var exception = Record.Exception(() => factory.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("AzureAd:TenantId", exception.ToString(), StringComparison.Ordinal);
    }

    private sealed class FabriqueConfigurationApi(IDictionary<string, string?> values) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");
            // Make the intended values available during minimal-host startup and app configuration.
            foreach (var pair in values)
                builder.UseSetting(pair.Key, pair.Value ?? string.Empty);

            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(values);
            });
        }
    }
}
