using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// Démarre l'API complète en mémoire, avec une base SQLite en mémoire (au lieu de SQL Server),
/// des utilisateurs fictifs et une date du jour fixe (06/10/2026, celle des scénarios de référence).
/// </summary>
public sealed class FabriqueApi : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connexion = new("DataSource=:memory:");

    public FabriqueApi()
    {
        // La base SQLite en mémoire vit tant que la connexion reste ouverte.
        _connexion.Open();
        // Réglages lus par Program.cs dès son démarrage : on les passe par variables d'environnement,
        // lues de façon sûre au tout début (avant les réglages propres à la fabrique de tests).
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Tests");
        Environment.SetEnvironmentVariable("Authentification__Mode", "Dev");
        Environment.SetEnvironmentVariable("ConnectionStrings__Pilotage", "Server=inutilise-dans-les-tests");
        var utilisateurs = new[]
        {
            ("chef", "oid-chef", "Camille", "Martin", "ChefDeProjet"),
            ("chef2", "oid-chef-2", "Alex", "Durand", "ChefDeProjet"),
            ("consultant", "oid-consultant", "Sam", "Petit", ""),
            ("pilotage", "oid-pilotage", "Lou", "Bernard", "Pilotage"),
        };
        for (var i = 0; i < utilisateurs.Length; i++)
        {
            var (cle, oid, prenom, nom, role) = utilisateurs[i];
            var prefixe = $"Authentification__UtilisateursDev__{i}__";
            Environment.SetEnvironmentVariable(prefixe + "Cle", cle);
            Environment.SetEnvironmentVariable(prefixe + "Oid", oid);
            Environment.SetEnvironmentVariable(prefixe + "Prenom", prenom);
            Environment.SetEnvironmentVariable(prefixe + "Nom", nom);
            Environment.SetEnvironmentVariable(prefixe + "Email", $"{cle}@exemple.fr");
            if (role.Length > 0) Environment.SetEnvironmentVariable(prefixe + "Roles__0", role);
        }
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
        builder.ConfigureTestServices(services =>
        {
            // remplace SQL Server par SQLite en mémoire
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
        // chaque test part d'une base sans projet : un même TSP ne peut être importé qu'une fois (unicité des projets)
        foreach (var id in db.Projets.Select(p => p.Id).ToList()) db.MarquerProjetPourSuppressionAsync(id).GetAwaiter().GetResult();
        db.SaveChanges();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connexion.Dispose();
    }
}
