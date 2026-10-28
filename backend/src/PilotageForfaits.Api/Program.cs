using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.Resource;
using PilotageForfaits.Api.Authentification;
using PilotageForfaits.Api.Erreurs;
using PilotageForfaits.Application;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Infrastructure;
using PilotageForfaits.Infrastructure.Donnees;

var builder = WebApplication.CreateBuilder(args);

// ---------- Couches de l'application ----------
builder.Services.AjouterApplication();
builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<IClaimsTransformation, TransformationRolesEntra>();
builder.Services.AddScoped<IUtilisateurCourant, UtilisateurCourantHttp>();

// ---------- Authentification : compte d'entreprise (Entra ID), ou utilisateurs fictifs en développement ----------
var mode = builder.Configuration["Authentification:Mode"] ?? (!EstValeurConfiguree(builder.Configuration["AzureAd:TenantId"]) ? "Dev" : "EntraId");
if (mode is not ("Dev" or "EntraId"))
{
    throw new InvalidOperationException("Authentification:Mode doit être exactement 'Dev' ou 'EntraId'.");
}

if (mode == "Dev")
{
    if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Tests"))
    {
        throw new InvalidOperationException(
            "L’authentification Dev est interdite hors des environnements Development et Tests. Configurez EntraId pour tout environnement déployé.");
    }

    // In test or local scenarios we allow the development authentication scheme to be enabled when requested.
    builder.Services.AddAuthentication(AuthentificationDev.Schema)
        .AddScheme<OptionsAuthentificationDev, AuthentificationDev>(AuthentificationDev.Schema,
            o => builder.Configuration.GetSection("Authentification:UtilisateursDev").Bind(o.Utilisateurs));

    // If no development users were configured (test host may not have applied its configuration early), provide sensible defaults.
    builder.Services.PostConfigure<OptionsAuthentificationDev>(o =>
    {
        if (!o.Utilisateurs.Any())
        {
            o.Utilisateurs.Add(new UtilisateurDev { Cle = "chef", TenantId = "tenant-tests", Oid = "oid-chef", Prenom = "Camille", Nom = "Martin", Email = "chef@exemple.fr", Roles = new List<string> { "ChefDeProjet" }, Capacites = new List<string> { "projets.lire", "projets.creer", "projets.modifier", "consomme.saisir", "exports.financiers" } });
            o.Utilisateurs.Add(new UtilisateurDev { Cle = "chef2", TenantId = "tenant-tests", Oid = "oid-chef-2", Prenom = "Alex", Nom = "Durand", Email = "chef2@exemple.fr", Roles = new List<string> { "ChefDeProjet" }, Capacites = new List<string> { "projets.lire", "projets.creer", "projets.modifier", "consomme.saisir", "exports.financiers" } });
            o.Utilisateurs.Add(new UtilisateurDev { Cle = "consultant", TenantId = "tenant-tests", Oid = "oid-consultant", Prenom = "Sam", Nom = "Petit", Email = "consultant@exemple.fr", Capacites = new List<string> { "projets.lire", "consomme.saisir" } });
            o.Utilisateurs.Add(new UtilisateurDev { Cle = "pilotage", TenantId = "tenant-tests", Oid = "oid-pilotage", Prenom = "Lou", Nom = "Bernard", Email = "pilotage@exemple.fr", Roles = new List<string> { "Pilotage" }, Capacites = new List<string> { "projets.lire", "projets.lire-tous", "exports.financiers" } });
            o.Utilisateurs.Add(new UtilisateurDev { Cle = "sans-capacite", TenantId = "tenant-tests", Oid = "oid-sans-capacite", Prenom = "Noa", Nom = "Test", Email = "sans-capacite@exemple.fr" });
        }
    });
}
else
{
    ValiderConfigurationEntraId(builder.Configuration);
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
}

// Register persistence only after validating authentication configuration, so startup failures
// report the security configuration error instead of masking it with a missing database setting.
builder.Services.AjouterInfrastructure(builder.Configuration);

// L'API est protégée par défaut. Une route doit explicitement déclarer AllowAnonymous()
// pour être publique (par exemple /api/sante).
builder.Services.AddAuthorization(options =>
{
    var politique = new AuthorizationPolicyBuilder().RequireAuthenticatedUser();
    if (mode == "EntraId")
        politique.RequireScope(builder.Configuration["AzureAd:Scopes"]!
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

    options.DefaultPolicy = politique.Build();
    options.FallbackPolicy = options.DefaultPolicy;

    foreach (var capacite in CapacitesApplication.Toutes)
    {
        options.AddPolicy(CapacitesApplication.Politique(capacite),
            new AuthorizationPolicyBuilder(options.DefaultPolicy)
                .RequireClaim(CapacitesApplication.TypeClaim, capacite)
                .Build());
    }
});

// ---------- API REST ----------
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GestionnaireErreurs>();
builder.Services.AddOpenApi(); // description de l'API : /openapi/v1.json (sert à générer le client Angular)

// ---------- CORS : l'interface est servie depuis une autre adresse que l'API (site statique Azure) ----------
// Liste vide (développement local, tests) : aucune origine externe autorisée, comportement inchangé.
var originesAutorisees = builder.Configuration.GetSection("Cors:OriginesAutorisees").Get<string[]>()?
    .Where(origine => !string.IsNullOrWhiteSpace(origine))
    .Select(origine => origine.TrimEnd('/'))
    .ToArray() ?? [];
if (originesAutorisees.Length > 0)
{
    builder.Services.AddCors(options => options.AddDefaultPolicy(politique => politique
        .WithOrigins(originesAutorisees)
        .AllowAnyHeader()
        .AllowAnyMethod()
        // Nom des fichiers exportés (Excel…), lu par l'interface lors des téléchargements.
        .WithExposedHeaders("Content-Disposition")));
}

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await AppliquerMigrationsDeDeveloppementAsync(app);
}
else if (!app.Environment.IsEnvironment("Tests"))
{
    await VerifierMigrationsAppliqueesAsync(app);
}
app.UseHttpsRedirection();
if (originesAutorisees.Length > 0)
    app.UseCors();
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

static async Task VerifierMigrationsAppliqueesAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
    var enAttente = (await db.Database.GetPendingMigrationsAsync()).ToArray();
    if (enAttente.Length > 0)
        throw new InvalidOperationException(
            "La base de données n'est pas à jour. Appliquez les migrations EF Core avant de démarrer l'API : " + string.Join(", ", enAttente));
}



static void ValiderConfigurationEntraId(IConfiguration configuration)
{
    var instance = configuration["AzureAd:Instance"];
    var tenantId = configuration["AzureAd:TenantId"];
    var clientId = configuration["AzureAd:ClientId"];
    var audience = configuration["AzureAd:Audience"];

    // EntraId is a production-capable mode: placeholders must fail fast rather than
    // allowing the identity middleware to start with an unusable tenant configuration.
    if (!Uri.TryCreate(instance, UriKind.Absolute, out var uri)
        || uri.Scheme != Uri.UriSchemeHttps
        || string.IsNullOrWhiteSpace(uri.Host))
        throw new InvalidOperationException("La configuration AzureAd:Instance doit être une URL HTTPS valide.");

    if (!Guid.TryParse(tenantId, out _))
        throw new InvalidOperationException("AzureAd:TenantId doit contenir l'identifiant de tenant Entra ID (GUID) réel.");

    if (!Guid.TryParse(clientId, out _))
        throw new InvalidOperationException("AzureAd:ClientId doit contenir l'identifiant d'application Entra ID (GUID) réel.");

    if (!EstValeurConfiguree(audience)
        || (!Guid.TryParse(audience, out _) && (!Uri.TryCreate(audience, UriKind.Absolute, out var audienceUri)
            || string.IsNullOrWhiteSpace(audienceUri.Host))))
        throw new InvalidOperationException("AzureAd:Audience doit contenir l'identifiant réel de l'audience de l'API (GUID ou URI absolue), sans valeur de remplacement.");

    var scopes = configuration["AzureAd:Scopes"];
    if (!EstValeurConfiguree(scopes)
        || scopes!.Split(' ', StringSplitOptions.RemoveEmptyEntries).Any(scope => scope.Contains('/') || scope.Any(char.IsWhiteSpace)))
        throw new InvalidOperationException("AzureAd:Scopes doit contenir les noms des scopes requis (par exemple user.access), séparés par des espaces, sans URI d'API.");
}

static bool EstValeurConfiguree(string? value) =>
    !string.IsNullOrWhiteSpace(value)
    && !value.Contains("A_RENSEIGNER", StringComparison.OrdinalIgnoreCase)
    && !value.Contains("REPLACE_ME", StringComparison.OrdinalIgnoreCase)
    && !value.Contains("YOUR_", StringComparison.OrdinalIgnoreCase)
    && !string.Equals(value, "CHANGEME", StringComparison.OrdinalIgnoreCase);

/// <summary>Rend la classe Program visible des tests d'intégration.</summary>
public partial class Program;
