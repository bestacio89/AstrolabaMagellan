using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using PilotageForfaits.Api.Authentification;
using PilotageForfaits.Api.Erreurs;
using PilotageForfaits.Application;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Infrastructure;
using PilotageForfaits.Infrastructure.Donnees;

var builder = WebApplication.CreateBuilder(args);

// ---------- Couches de l'application ----------
builder.Services.AjouterApplication();
builder.Services.AjouterInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUtilisateurCourant, UtilisateurCourantHttp>();

// ---------- Authentification : compte d'entreprise (Entra ID), ou utilisateurs fictifs en développement ----------
var mode = builder.Configuration["Authentification:Mode"] ?? "EntraId";
if (mode == "Dev")
{
    if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Tests"))
        throw new InvalidOperationException("L'authentification de développement est interdite hors environnement de développement.");
    builder.Services.AddAuthentication(AuthentificationDev.Schema)
        .AddScheme<OptionsAuthentificationDev, AuthentificationDev>(AuthentificationDev.Schema,
            o => builder.Configuration.GetSection("Authentification:UtilisateursDev").Bind(o.Utilisateurs));
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
}
builder.Services.AddAuthorization();

// ---------- API REST ----------
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GestionnaireErreurs>();
builder.Services.AddOpenApi(); // description de l'API : /openapi/v1.json (sert à générer le client Angular)

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await PreparerBaseDeDeveloppementAsync(app);
}
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/sante", () => Results.Ok(new { statut = "ok" })).AllowAnonymous();

app.Run();

// En développement : crée ou met à jour la base au démarrage.
static async Task PreparerBaseDeDeveloppementAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
    if (db.Database.GetMigrations().Any())
    {
        // le modèle a changé depuis la dernière migration (nouvelle version de l'application) : il faut d'abord créer la migration
        if (db.Database.HasPendingModelChanges())
        {
            app.Logger.LogCritical(
                "LE MODÈLE DE DONNÉES A CHANGÉ DEPUIS LA DERNIÈRE MIGRATION : la base n'est pas mise à jour. Arrêtez l'API (Ctrl+C), puis depuis le dossier du dépôt : " +
                ".\\scripts\\creer-migration.ps1 -Nom <NomDuChangement> (Windows) ou ./scripts/creer-migration.sh <NomDuChangement>, et relancez l'API " +
                "(README, « Faire évoluer la base »).");
            return;
        }
        await db.Database.MigrateAsync();
    }
    else
    {
        // Pas encore de migration (voir README, « Créer la première migration ») : la base est créée directement.
        app.Logger.LogWarning("Aucune migration trouvée : la base de développement est créée sans migration. Créez la migration initiale avant toute recette.");
        await db.Database.EnsureCreatedAsync();
        // une base créée par une version précédente n'est pas mise à jour : on le dit clairement, dès le démarrage
        var manquants = await db.ElementsManquantsAsync();
        if (manquants.Count > 0)
            app.Logger.LogCritical(
                "LA BASE DE DÉVELOPPEMENT DATE D'UNE VERSION PRÉCÉDENTE : il lui manque {Manquants}. Arrêtez l'API (Ctrl+C), puis depuis le dossier du dépôt : " +
                ".\\scripts\\reinitialiser-base.ps1 (Windows) ou ./scripts/reinitialiser-base.sh. La base est supprimée puis recréée, gérée par migrations " +
                "(README, « Repartir propre et passer aux migrations »).", string.Join(", ", manquants));
    }
}

/// <summary>Rend la classe Program visible des tests d'intégration.</summary>
public partial class Program;
