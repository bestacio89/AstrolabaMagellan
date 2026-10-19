using Microsoft.Extensions.DependencyInjection;
using PilotageForfaits.Application.Brouillons;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Application.Import;
using PilotageForfaits.Application.Projets;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Application.Suivi;

namespace PilotageForfaits.Application;

public static class DependencyInjection
{
    /// <summary>Déclare les services de la couche Application (un exemplaire par requête HTTP).</summary>
    public static IServiceCollection AjouterApplication(this IServiceCollection services)
    {
        services.AddScoped<ServiceAcces>();
        services.AddScoped<ServiceJournal>();
        services.AddScoped<ConstructeurProjetCalcul>();
        services.AddScoped<ProjetsService>();
        services.AddScoped<UniciteProjet>();
        services.AddScoped<ImportTspService>();
        services.AddScoped<BrouillonsService>();
        // écran de suivi et saisies
        services.AddScoped<SuiviService>();
        services.AddScoped<SaisieOutils>();
        services.AddScoped<SaisiesTachesService>();
        services.AddScoped<PerimetreService>();
        services.AddScoped<AteliersLivrablesService>();
        services.AddScoped<FacturationService>();
        services.AddScoped<RegistresService>();
        services.AddScoped<DepensesService>();
        services.AddScoped<ParametresService>();
        services.AddScoped<ExportsService>();
        services.AddScoped<ReferencesService>();
        services.AddScoped<MisesAJourService>();
        services.AddScoped<PointsHebdoService>();
        return services;
    }
}
