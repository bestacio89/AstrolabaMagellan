using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Npgsql;
using Testcontainers.PostgreSql;
using PilotageForfaits.Api.Authentification;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// API de bout en bout sur un vrai PostgreSQL isolé par Testcontainers.
/// Chaque appel à PreparerBase recrée le schéma et rejoue les migrations pour isoler chaque test.
/// </summary>
public sealed class FabriqueApi : WebApplicationFactory<Program>
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18")
        .WithDatabase("pilotage_forfaits_tests")
        .WithUsername("pilotage")
        .WithPassword("pilotage_test_only")
        .Build();

    private readonly string _schema = "api_it_" + Guid.NewGuid().ToString("N");
    private string _baseConnectionString = "";
    private string _schemaConnectionString = "";

    public FabriqueApi()
    {
        _postgres.StartAsync().GetAwaiter().GetResult();
        _baseConnectionString = _postgres.GetConnectionString();
        _schemaConnectionString = new NpgsqlConnectionStringBuilder(_baseConnectionString)
        {
            SearchPath = _schema
        }.ConnectionString;

        CreerSchema();
        using var scope = Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<PilotageDbContext>().Database.Migrate();
    }

    private static Dictionary<string, string?> ConfigurationTests()
    {
        var configuration = new Dictionary<string, string?>
        {
            ["Authentification:Mode"] = "Dev",
            ["ConnectionStrings:Pilotage"] = "Host=localhost;Database=unused_tests;Username=unused;Password=unused",
        };

        var capacitesChef = new[] { "projets.lire", "projets.creer", "projets.modifier", "consomme.saisir", "exports.financiers" };
        var capacitesConsultant = new[] { "projets.lire", "consomme.saisir" };
        var capacitesPilotage = new[] { "projets.lire", "projets.lire-tous", "exports.financiers" };
        var utilisateurs = new[]
        {
            (Cle: "chef", Oid: "oid-chef", Prenom: "Camille", Nom: "Martin", Role: "ChefDeProjet", Capacites: capacitesChef),
            (Cle: "chef2", Oid: "oid-chef-2", Prenom: "Alex", Nom: "Durand", Role: "ChefDeProjet", Capacites: capacitesChef),
            (Cle: "consultant", Oid: "oid-consultant", Prenom: "Sam", Nom: "Petit", Role: "", Capacites: capacitesConsultant),
            (Cle: "pilotage", Oid: "oid-pilotage", Prenom: "Lou", Nom: "Bernard", Role: "Pilotage", Capacites: capacitesPilotage),
            (Cle: "sans-capacite", Oid: "oid-sans-capacite", Prenom: "Noa", Nom: "Test", Role: "", Capacites: Array.Empty<string>()),
        };

        for (var i = 0; i < utilisateurs.Length; i++)
        {
            var u = utilisateurs[i];
            var prefixe = $"Authentification:UtilisateursDev:{i}:";
            configuration[prefixe + "Cle"] = u.Cle;
            configuration[prefixe + "TenantId"] = "tenant-tests";
            configuration[prefixe + "Oid"] = u.Oid;
            configuration[prefixe + "Prenom"] = u.Prenom;
            configuration[prefixe + "Nom"] = u.Nom;
            configuration[prefixe + "Email"] = $"{u.Cle}@exemple.fr";
            if (u.Role.Length > 0) configuration[$"{prefixe}Roles:0"] = u.Role;
            for (var j = 0; j < u.Capacites.Length; j++)
                configuration[$"{prefixe}Capacites:{j}"] = u.Capacites[j];
        }

        return configuration;
    }

    public sealed class HorlogeFixe : IHorloge
    {
        public static readonly DateTimeOffset ParDefaut = new(2026, 10, 6, 10, 0, 0, TimeSpan.Zero);
        public DateTimeOffset Maintenant { get; set; } = ParDefaut;
        public DateOnly Aujourdhui => new(2026, 10, 6);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Tests");
        builder.ConfigureLogging(logging =>
        {
            logging.AddConsole();
            logging.SetMinimumLevel(LogLevel.Error);
        });

        var configurationTests = ConfigurationTests();
        configurationTests["ConnectionStrings:Pilotage"] = _schemaConnectionString;
        foreach (var pair in configurationTests)
            builder.UseSetting(pair.Key, pair.Value ?? string.Empty);
        builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(configurationTests));

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(options =>
            {
                options.DefaultScheme = AuthentificationDev.Schema;
                options.DefaultAuthenticateScheme = AuthentificationDev.Schema;
                options.DefaultChallengeScheme = AuthentificationDev.Schema;
                options.DefaultForbidScheme = AuthentificationDev.Schema;
            });
            services.RemoveAll<DbContextOptions<PilotageDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<PilotageDbContext>>();
            services.AddDbContext<PilotageDbContext>(options => options.UseNpgsql(_schemaConnectionString));
            services.RemoveAll<IHorloge>();
            services.AddSingleton<IHorloge, HorlogeFixe>();
        });
    }

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add("X-Utilisateur-Dev", "chef");
    }

    public HttpClient ClientPour(string utilisateur)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Remove("X-Utilisateur-Dev");
        client.DefaultRequestHeaders.Add("X-Utilisateur-Dev", utilisateur);
        return client;
    }

    public void PreparerBase()
    {
        using (var poolConnection = new NpgsqlConnection(_schemaConnectionString))
            NpgsqlConnection.ClearPool(poolConnection);

        using (var connection = new NpgsqlConnection(_baseConnectionString))
        {
            connection.Open();
            using var command = new NpgsqlCommand($"DROP SCHEMA IF EXISTS \"{_schema}\" CASCADE; CREATE SCHEMA \"{_schema}\";", connection);
            command.ExecuteNonQuery();
        }

        using var scope = Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<PilotageDbContext>().Database.Migrate();
    }

    private void CreerSchema()
    {
        using var connection = new NpgsqlConnection(_baseConnectionString);
        connection.Open();
        using var command = new NpgsqlCommand($"CREATE SCHEMA \"{_schema}\"", connection);
        command.ExecuteNonQuery();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;

        // The database belongs exclusively to this fixture; disposing the container removes its schema and data.
        // Avoid opening a new connection during teardown or clearing unrelated fixture pools globally.
        _postgres.DisposeAsync().AsTask().GetAwaiter().GetResult();
    }
}
