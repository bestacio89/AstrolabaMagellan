using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// End-to-end security test against an isolated PostgreSQL schema. It exercises real JWT validation,
/// group-to-capability transformation, the versioned contract, and project assignment enforcement.
/// </summary>
public sealed class PostgreSqlAuthorizationApiTests : IClassFixture<FabriquePostgreSqlApi>
{
    private readonly FabriquePostgreSqlApi _fixture;

    public PostgreSqlAuthorizationApiTests(FabriquePostgreSqlApi fixture) => _fixture = fixture;

    [PostgreSqlApiFact]
    public async Task Validated_group_capability_does_not_bypass_project_assignment()
    {
        var chef = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            FabriquePostgreSqlApi.GroupeChef));
        var reference = "SEC-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await chef.PostAsJsonAsync("/api/projets", new
        {
            client = "Client sécurité de test",
            nom = "Projet PostgreSQL " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var id = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var lecteur = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            FabriquePostgreSqlApi.GroupeLecteur));
        var contrat = await lecteur.GetFromJsonAsync<JsonObject>("/api/moi/capacites");
        Assert.Contains("projets.lire", contrat!["capacites"]!.AsArray().Select(c => c!.GetValue<string>()));
        Assert.Empty(contrat["projetsAccessibles"]!.AsArray());

        // The reader has the mapped read capability but no server-side assignment to this project.
        Assert.Equal(HttpStatusCode.NotFound, (await lecteur.GetAsync($"/api/projets/{id}")).StatusCode);
        var liste = await lecteur.GetFromJsonAsync<JsonArray>("/api/projets");
        Assert.DoesNotContain(liste!, p => p!["id"]!.GetValue<Guid>() == id);
    }

    [PostgreSqlApiFact]
    public async Task Une_habilitation_autorise_la_lecture_sans_accorder_les_capacites_decriture_ni_les_autres_projets()
    {
        var objectIdChef = Guid.NewGuid().ToString();
        using var chef = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdChef,
            FabriquePostgreSqlApi.GroupeChef));

        var reference = "SEC-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await chef.PostAsJsonAsync("/api/projets", new
        {
            client = "Client sécurité de test",
            nom = "Projet affecté " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var id = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var objectIdLecteurAffecte = Guid.NewGuid().ToString();
        using var lecteurAffecte = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdLecteurAffecte,
            FabriquePostgreSqlApi.GroupeLecteur));

        // Creates the local user record from the validated Entra identity before assigning the project.
        var contrat = await lecteurAffecte.GetFromJsonAsync<JsonObject>("/api/moi/capacites");
        Assert.Contains("projets.lire", contrat!["capacites"]!.AsArray().Select(c => c!.GetValue<string>()));
        Assert.Empty(contrat["projetsAccessibles"]!.AsArray());

        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
            var utilisateur = await db.Utilisateurs.SingleAsync(
                u => u.IdentifiantExterne == $"{FabriquePostgreSqlApi.TenantId}:{objectIdLecteurAffecte}");
            db.Habilitations.Add(new Habilitation
            {
                ProjetId = id,
                UtilisateurId = utilisateur.Id,
                Role = RoleProjet.ChefDeProjet,
                Depuis = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.OK, (await lecteurAffecte.GetAsync($"/api/projets/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lecteurAffecte.PostAsJsonAsync("/api/projets", new
        {
            client = "Client sécurité de test",
            nom = "Création interdite " + reference,
            reference = reference + "-DENIED",
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        })).StatusCode);

        var objectIdLecteurSansAffectation = Guid.NewGuid().ToString();
        using var lecteurSansAffectation = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdLecteurSansAffectation,
            FabriquePostgreSqlApi.GroupeLecteur));
        var contratSansAffectation = await lecteurSansAffectation.GetFromJsonAsync<JsonObject>("/api/moi/capacites");
        Assert.Contains("projets.lire", contratSansAffectation!["capacites"]!.AsArray().Select(c => c!.GetValue<string>()));
        Assert.Empty(contratSansAffectation["projetsAccessibles"]!.AsArray());
        Assert.Equal(HttpStatusCode.NotFound, (await lecteurSansAffectation.GetAsync($"/api/projets/{id}")).StatusCode);
    }
}

public sealed class FabriquePostgreSqlApi : IAsyncLifetime
{
    public const string TenantId = "11111111-1111-4111-8111-111111111111";
    public const string ClientId = "22222222-2222-4222-8222-222222222222";
    public const string Audience = "api://22222222-2222-4222-8222-222222222222";
    public const string Issuer = "https://login.microsoftonline.com/" + TenantId + "/v2.0";
    public const string GroupeChef = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    public const string GroupeLecteur = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    private const string CleTest = "only-for-tests-signing-key-never-use-in-production-2026";
    private readonly string? _baseConnectionString = Environment.GetEnvironmentVariable("POSTGRES_TEST_CONNECTION");
    private readonly string _schema = "security_it_" + Guid.NewGuid().ToString("N");
    private string _schemaConnectionString = "";
    private HoteApi? _host;

    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _host?.Services ?? throw new InvalidOperationException("PostgreSQL API host is not initialized.");

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(_baseConnectionString)) return;

        var schemaBuilder = new NpgsqlConnectionStringBuilder(_baseConnectionString) { SearchPath = _schema };
        _schemaConnectionString = schemaBuilder.ConnectionString;

        await using (var connection = new NpgsqlConnection(_baseConnectionString))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE SCHEMA \"{_schema}\"", connection);
            await command.ExecuteNonQueryAsync();
        }

        _host = new HoteApi(_schemaConnectionString);
        Client = _host.CreateClient();
        using var scope = _host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
        await db.Database.MigrateAsync();
    }

    public HttpClient ClientPour(string jeton)
    {
        var client = _host!.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jeton);
        return client;
    }

    public static string CreerJeton(string objectId, string groupe)
    {
        var cle = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(CleTest));
        var maintenant = DateTime.UtcNow;
        var jeton = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims:
            [
                new Claim("tid", TenantId),
                new Claim("oid", objectId),
                new Claim("name", "Utilisateur PostgreSQL de test"),
                new Claim("groups", groupe)
            ],
            notBefore: maintenant.AddMinutes(-1),
            expires: maintenant.AddMinutes(5),
            signingCredentials: new SigningCredentials(cle, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(jeton);
    }

    public async Task DisposeAsync()
    {
        if (_host is not null) await _host.DisposeAsync();
        Client?.Dispose();
        if (string.IsNullOrWhiteSpace(_baseConnectionString)) return;

        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_baseConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP SCHEMA IF EXISTS \"{_schema}\" CASCADE", connection);
        await command.ExecuteNonQueryAsync();
    }

    private sealed class HoteApi(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Tests");
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Pilotage"] = connectionString,
                    ["Authentification:Mode"] = "EntraId",
                    ["AzureAd:Instance"] = "https://login.microsoftonline.com/",
                    ["AzureAd:TenantId"] = TenantId,
                    ["AzureAd:ClientId"] = ClientId,
                    ["AzureAd:Audience"] = Audience,
                    [$"AutorisationEntra:GroupesCapacites:{GroupeChef}:0"] = "projets.lire",
                    [$"AutorisationEntra:GroupesCapacites:{GroupeChef}:1"] = "projets.creer",
                    [$"AutorisationEntra:GroupesCapacites:{GroupeChef}:2"] = "projets.modifier",
                    [$"AutorisationEntra:GroupesCapacites:{GroupeChef}:3"] = "consomme.saisir",
                    [$"AutorisationEntra:GroupesCapacites:{GroupeChef}:4"] = "exports.financiers",
                    [$"AutorisationEntra:GroupesCapacites:{GroupeLecteur}:0"] = "projets.lire"
                }));

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<PilotageDbContext>>();
                services.RemoveAll<IDbContextOptionsConfiguration<PilotageDbContext>>();
                services.AddDbContext<PilotageDbContext>(options => options.UseNpgsql(connectionString));
                services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
                {
                    options.Authority = null;
                    options.MetadataAddress = null;
                    options.ConfigurationManager = null;
                    // Keep the exact Entra claim names used by the signed test tokens. This makes the
                    // group-to-capability mapping exercise the raw tid/oid/groups contract without
                    // relying on framework inbound claim remapping.
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
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(CleTest))
                    };
                    options.Events = new JwtBearerEvents();
                });
            });
        }
    }
}

/// <summary>Runs only when CI or a developer explicitly configures a disposable PostgreSQL test database.</summary>
public sealed class PostgreSqlApiFactAttribute : FactAttribute
{
    public PostgreSqlApiFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("POSTGRES_TEST_CONNECTION")))
            Skip = "POSTGRES_TEST_CONNECTION is not configured.";
    }
}
