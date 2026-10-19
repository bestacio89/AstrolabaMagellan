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
    /// <summary>Déclare la base de données, la lecture des TSP, l'écriture des exports Excel et l'horloge.</summary>
    public static IServiceCollection AjouterInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var chaine = configuration.GetConnectionString("Pilotage")
            ?? throw new InvalidOperationException("Chaîne de connexion « ConnectionStrings:Pilotage » absente de la configuration.");
        services.AddDbContext<PilotageDbContext>(o => o.UseSqlServer(chaine, sql => sql.EnableRetryOnFailure()));
        services.AddScoped<IContexteDonnees>(sp => sp.GetRequiredService<PilotageDbContext>());
        services.AddSingleton<IHorloge, HorlogeSysteme>();
        services.AddScoped<ILecteurTsp, LecteurTsp>();
        services.AddSingleton<IEcrivainClasseur, EcrivainXlsx>();
        return services;
    }
}
