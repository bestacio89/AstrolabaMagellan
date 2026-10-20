using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// Démarre l'API complète en mémoire, avec une base SQLite en mémoire réservée aux tests,
/// des utilisateurs fictifs et une date du jour fixe (06/10/2026, celle des scénarios de référence).
/// La configuration est injectée dans l'hôte de test : aucun état de configuration global du processus n'est modifié.
/// </summary>
public sealed class FabriqueApi : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connexion = new("DataSource=:memory:");

    public FabriqueApi()
    {
        // La base SQLite en mémoire vit tant que la connexion reste ouverte.
        _connexion.Open();
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
        var capacitesLectureSeule = new[] { "projets.lire" };
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

    /// <summary>
    /// Date du jour fixe (06/10/2026). L'heure (« Maintenant ») peut être réglée par un test pour dater des saisies
    /// (ex. rejouer un scénario où les ajouts ont eu lieu à des dates différentes).
    /// </summary>
    public sealed class HorlogeFixe : IHorloge
    {
        public static readonly DateTimeOffset ParDefaut = new(2026, 10, 6, 10, 0, 0, TimeSpan.Zero);
        public DateTimeOffset Maintenant { get; set; } = ParDefaut;
        public DateOnly Aujourdhui => new(2026, 10, 6);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Tests");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            // Add test overrides last so they take precedence over appsettings and environment configuration.
            configuration.AddInMemoryCollection(ConfigurationTests());
        });

        builder.ConfigureTestServices(services =>
        {
            // La base SQLite en mémoire est réservée aux tests d'intégration API.
            services.RemoveAll<DbContextOptions<PilotageDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<PilotageDbContext>>();
            services.AddDbContext<PilotageDbContext>(o => o.UseSqlite(_connexion));
            services.RemoveAll<IHorloge>();
            services.AddSingleton<IHorloge, HorlogeFixe>();
        });
    }

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add("X-Utilisateur-Dev", "chef");
    }

    /// <summary>Client HTTP connecté sous l'identité d'un utilisateur fictif (chef, chef2, consultant, pilotage).</summary>
    public HttpClient ClientPour(string utilisateur)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Remove("X-Utilisateur-Dev");
        client.DefaultRequestHeaders.Add("X-Utilisateur-Dev", utilisateur);
        return client;
    }

    /// <summary>Crée la base (une seule fois) avant le premier test.</summary>
    public void PreparerBase()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
        db.Database.EnsureCreated();
        // Chaque test repart d'une base sans projet : un même TSP ne peut être importé qu'une fois (unicité des projets).
        foreach (var id in db.Projets.Select(p => p.Id).ToList())
            db.MarquerProjetPourSuppressionAsync(id).GetAwaiter().GetResult();
        db.SaveChanges();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connexion.Dispose();
    }
}
