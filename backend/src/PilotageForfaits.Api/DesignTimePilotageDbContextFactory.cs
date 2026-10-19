using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api;

/// <summary>
/// Construit le DbContext pour les commandes EF Core sans exécuter le démarrage HTTP de l'API.
/// Les migrations utilisent ainsi la même configuration PostgreSQL que l'application.
/// </summary>
public sealed class DesignTimePilotageDbContextFactory : IDesignTimeDbContextFactory<PilotageDbContext>
{
    public PilotageDbContext CreateDbContext(string[] args)
    {
        var currentDirectory = Directory.GetCurrentDirectory();
        var configurationDirectory = new[]
            {
                Path.Combine(currentDirectory, "src", "PilotageForfaits.Api"),
                currentDirectory
            }
            .FirstOrDefault(path => File.Exists(Path.Combine(path, "appsettings.json")));

        if (configurationDirectory is null)
            throw new DirectoryNotFoundException(
                "Impossible de trouver appsettings.json. Lancez les commandes EF Core depuis le dossier backend.");

        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        var configuration = new ConfigurationBuilder()
            .SetBasePath(configurationDirectory)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Pilotage");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "La chaîne ConnectionStrings:Pilotage est absente. Configurez PostgreSQL avant d'utiliser EF Core.");

        var options = new DbContextOptionsBuilder<PilotageDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new PilotageDbContext(options);
    }
}
