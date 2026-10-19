using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Infrastructure.Donnees;
using PilotageForfaits.Infrastructure.Excel;

namespace PilotageForfaits.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Déclare PostgreSQL, la lecture des TSP, l'écriture des exports Excel et l'horloge.</summary>
    public static IServiceCollection AjouterInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var chaine = configuration.GetConnectionString("Pilotage");
        if (string.IsNullOrWhiteSpace(chaine))
        {
            // If running tests, the test host injects configuration and test services; skip requiring a real connection string.
            var environment = configuration["Environment"] ?? configuration["ASPNETCORE_ENVIRONMENT"] ?? configuration["DOTNET_ENVIRONMENT"];
            if (string.Equals(environment, "Tests", StringComparison.OrdinalIgnoreCase))
            {
                // Tests will replace the DbContext with an in-memory SQLite in ConfigureTestServices.
                chaine = null;
            }
            else
            {
                // During non-test runs, prefer an explicit registration override if present.
                if (services.Any(sd => sd.ServiceType == typeof(DbContextOptions<PilotageDbContext>)))
                {
                    // Don't register PostgreSQL DbContext; an alternative was provided.
                    chaine = null;
                }
                else
                {
                    throw new InvalidOperationException("La chaîne de connexion « ConnectionStrings:Pilotage » est absente ou vide.");
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(chaine))
        {
            services.AddDbContext<PilotageDbContext>(options =>
                options.UseNpgsql(chaine, postgres => postgres.EnableRetryOnFailure()));
        }

        services.AddScoped<IContexteDonnees>(sp => sp.GetRequiredService<PilotageDbContext>());
        services.AddSingleton<IHorloge, HorlogeSysteme>();
        services.AddScoped<ILecteurTsp, LecteurTsp>();
        services.AddSingleton<IEcrivainClasseur, EcrivainXlsx>();
        return services;
    }
}
