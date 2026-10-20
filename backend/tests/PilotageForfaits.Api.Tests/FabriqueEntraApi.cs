using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// Hôte isolé pour vérifier la validation JWT sans appeler Microsoft Entra ID ni dépendre d'un tenant réel.
/// La clé symétrique et les identifiants sont réservés aux tests.
/// </summary>
public sealed class FabriqueEntraApi : WebApplicationFactory<Program>
{
    public const string TenantId = "11111111-1111-4111-8111-111111111111";
    public const string ClientId = "22222222-2222-4222-8222-222222222222";
    public const string Audience = "api://22222222-2222-4222-8222-222222222222";
    public const string Issuer = "https://login.microsoftonline.com/" + TenantId + "/v2.0";
    private static readonly SymmetricSecurityKey CleSignature =
        new(Encoding.UTF8.GetBytes("test-only-signing-key-never-use-in-production-42"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Tests");
        var testConfiguration = new Dictionary<string, string?>
        {
            ["ConnectionStrings:Pilotage"] = "Host=localhost;Database=unused_tests;Username=unused;Password=unused",
            ["Authentification:Mode"] = "EntraId",
            ["AzureAd:Instance"] = "https://login.microsoftonline.com/",
            ["AzureAd:TenantId"] = TenantId,
            ["AzureAd:ClientId"] = ClientId,
            ["AzureAd:Audience"] = Audience
        };
        foreach (var pair in testConfiguration)
            builder.UseSetting(pair.Key, pair.Value ?? string.Empty);

        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(testConfiguration);
        });

        builder.ConfigureTestServices(services =>
        {
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                // Les tests valident les mêmes contrôles JWT localement, sans découverte OIDC réseau.
                options.Authority = null;
                options.MetadataAddress = null;
                options.ConfigurationManager = null;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = Issuer,
                    ValidateAudience = true,
                    ValidAudience = Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = CleSignature
                };
                // Remplace les callbacks Entra dépendant de la découverte distante : les contrôles ci-dessus restent actifs.
                options.Events = new JwtBearerEvents();
            });
        });
    }

    public static string CreerJeton(
        string? issuer = null,
        string? audience = null,
        DateTime? expirationUtc = null)
    {
        var maintenant = DateTime.UtcNow;
        var jeton = new JwtSecurityToken(
            issuer: issuer ?? Issuer,
            audience: audience ?? Audience,
            claims:
            [
                new Claim("tid", TenantId),
                new Claim("oid", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
                new Claim("name", "Utilisateur de test")
            ],
            notBefore: expirationUtc.HasValue && expirationUtc.Value < maintenant
                ? expirationUtc.Value.AddMinutes(-5)
                : maintenant.AddMinutes(-1),
            expires: expirationUtc ?? maintenant.AddMinutes(5),
            signingCredentials: new SigningCredentials(CleSignature, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(jeton);
    }
}
