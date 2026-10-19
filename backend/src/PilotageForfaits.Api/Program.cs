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
    await AppliquerMigrationsDeDeveloppementAsync(app);
}
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/sante", () => Results.Ok(new { statut = "ok" })).AllowAnonymous();

app.Run();

// En développement, le schéma doit toujours être géré par des migrations EF Core.
// EnsureCreated est volontairement interdit : il contourne l'historique des migrations et rend les évolutions non fiables.
static async Task AppliquerMigrationsDeDeveloppementAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
    var migrations = db.Database.GetMigrations().ToArray();

    if (migrations.Length == 0)
        throw new InvalidOperationException(
            "Aucune migration EF Core n'est présente. Créez et validez la migration initiale PostgreSQL avant de démarrer l'API en développement.");

    if (db.Database.HasPendingModelChanges())
        throw new InvalidOperationException(
            "Le modèle EF Core diffère de la dernière migration. Créez une nouvelle migration avant de démarrer l'API.");

    await db.Database.MigrateAsync();
}

/// <summary>Rend la classe Program visible des tests d'intégration.</summary>
public partial class Program;
