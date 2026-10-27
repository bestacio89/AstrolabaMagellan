using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Testcontainers.PostgreSql;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// End-to-end security test against an isolated PostgreSQL schema. It exercises real JWT validation,
/// app-role capability transformation, the versioned contract, and project assignment enforcement.
/// </summary>
public sealed class PostgreSqlAuthorizationApiTests : IClassFixture<FabriquePostgreSqlApi>
{
    private readonly FabriquePostgreSqlApi _fixture;

    public PostgreSqlAuthorizationApiTests(FabriquePostgreSqlApi fixture) => _fixture = fixture;

    [Fact]
    public async Task Validated_group_capability_does_not_bypass_project_assignment()
    {
        var chef = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            FabriquePostgreSqlApi.RoleManager));
        var reference = "SEC-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await chef.PostAsJsonAsync("/api/projets", new
        {
            client = "Client sécurité de test",
            nom = "Projet PostgreSQL " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var id = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var lecteur = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            FabriquePostgreSqlApi.RoleContributeur));
        var contrat = await lecteur.GetFromJsonAsync<JsonObject>("/api/moi/capacites");
        Assert.Contains("projets.lire", contrat!["capacites"]!.AsArray().Select(c => c!.GetValue<string>()));
        Assert.Empty(contrat["projetsAccessibles"]!.AsArray());

        // The reader has the mapped read capability but no server-side assignment to this project.
        Assert.Equal(HttpStatusCode.NotFound, (await lecteur.GetAsync($"/api/projets/{id}")).StatusCode);
        var liste = await lecteur.GetFromJsonAsync<JsonArray>("/api/projets");
        Assert.DoesNotContain(liste!, p => p!["id"]!.GetValue<Guid>() == id);
    }

    [Fact]
    public async Task Une_habilitation_autorise_la_lecture_sans_accorder_les_capacites_decriture_ni_les_autres_projets()
    {
        var objectIdChef = Guid.NewGuid().ToString();
        using var chef = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdChef,
            FabriquePostgreSqlApi.RoleManager));

        var reference = "SEC-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await chef.PostAsJsonAsync("/api/projets", new
        {
            client = "Client sécurité de test",
            nom = "Projet affecté " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var id = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var objectIdLecteurAffecte = Guid.NewGuid().ToString();
        using var lecteurAffecte = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdLecteurAffecte,
            FabriquePostgreSqlApi.RoleContributeur));

        // Creates the local user record from the validated Entra identity before assigning the project.
        var contrat = await lecteurAffecte.GetFromJsonAsync<JsonObject>("/api/moi/capacites");
        Assert.Contains("projets.lire", contrat!["capacites"]!.AsArray().Select(c => c!.GetValue<string>()));
        Assert.Empty(contrat["projetsAccessibles"]!.AsArray());

        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
            var utilisateur = await db.Utilisateurs.SingleAsync(
                u => u.IdentifiantExterne == $"{FabriquePostgreSqlApi.TenantId}:{objectIdLecteurAffecte}");
            db.Habilitations.Add(new Habilitation
            {
                ProjetId = id,
                UtilisateurId = utilisateur.Id,
                Role = RoleProjet.ChefDeProjet,
                Depuis = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.OK, (await lecteurAffecte.GetAsync($"/api/projets/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lecteurAffecte.PostAsJsonAsync("/api/projets", new
        {
            client = "Client sécurité de test",
            nom = "Création interdite " + reference,
            reference = reference + "-DENIED",
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        })).StatusCode);

        var objectIdLecteurSansAffectation = Guid.NewGuid().ToString();
        using var lecteurSansAffectation = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdLecteurSansAffectation,
            FabriquePostgreSqlApi.RoleContributeur));
        var contratSansAffectation = await lecteurSansAffectation.GetFromJsonAsync<JsonObject>("/api/moi/capacites");
        Assert.Contains("projets.lire", contratSansAffectation!["capacites"]!.AsArray().Select(c => c!.GetValue<string>()));
        Assert.Empty(contratSansAffectation["projetsAccessibles"]!.AsArray());
        Assert.Equal(HttpStatusCode.NotFound, (await lecteurSansAffectation.GetAsync($"/api/projets/{id}")).StatusCode);
    }

    [Fact]
    public async Task Planning_et_absences_exigent_un_projet_autorise_et_exposent_les_routes_du_client_Angular()
    {
        using var chef = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            Guid.NewGuid().ToString(),
            FabriquePostgreSqlApi.RoleManager));
        var reference = "API-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await chef.PostAsJsonAsync("/api/projets", new
        {
            client = "Client endpoints",
            nom = "Projet endpoints " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var id = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();
        var baseProjet = $"/api/projets/{id}";

        Assert.Equal(HttpStatusCode.OK, (await chef.PutAsJsonAsync($"{baseProjet}/planning/dates", new
        {
            cle = "id|AXE1", cote = "debut", valeur = "2026-11-03"
        })).StatusCode);

        var jalon = await chef.PostAsJsonAsync($"{baseProjet}/planning/jalons", new
        {
            libelle = "Lancement", type = "date", debut = "2026-11-04", fin = (string?)null, aConfirmer = false
        });
        Assert.Equal(HttpStatusCode.OK, jalon.StatusCode);
        var jalonId = Guid.Parse((await jalon.Content.ReadFromJsonAsync<JsonObject>())!["ouvrir"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.OK, (await chef.PutAsJsonAsync($"{baseProjet}/planning/jalons/{jalonId}", new
        {
            libelle = "Lancement confirmé", type = "date", debut = "2026-11-05", fin = (string?)null, aConfirmer = false
        })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await chef.DeleteAsync($"{baseProjet}/planning/jalons/{jalonId}")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await chef.PutAsJsonAsync($"{baseProjet}/absences", new
        {
            nom = "Camille Martin", jour = "2026-11-06", moment = "j"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await chef.PostAsJsonAsync($"{baseProjet}/personnes", new { nom = "Camille Martin" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await chef.PutAsJsonAsync($"{baseProjet}/parametres/instances", new
        {
            valeurs = new[] { "COPIL", "COPROJ" }, ancien = (string?)null, nouveau = (string?)null
        })).StatusCode);

        var exportRegistres = await chef.PostAsJsonAsync($"{baseProjet}/exports/registres", new { });
        Assert.Equal(HttpStatusCode.OK, exportRegistres.StatusCode);
        Assert.Contains("spreadsheetml.sheet", exportRegistres.Content.Headers.ContentType!.MediaType);

        using var lecteur = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            Guid.NewGuid().ToString(),
            FabriquePostgreSqlApi.RoleContributeur));
        Assert.Equal(HttpStatusCode.NotFound, (await lecteur.PutAsJsonAsync($"{baseProjet}/planning/dates", new
        {
            cle = "id|AXE1", cote = "fin", valeur = "2026-12-01"
        })).StatusCode);
    }


    [Fact]
    public async Task Manager_peut_affecter_un_contributeur_a_un_projet_via_l_api()
    {
        var objectIdManager = Guid.NewGuid().ToString();
        using var manager = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdManager,
            FabriquePostgreSqlApi.RoleManager));

        var reference = "ASSIGN-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await manager.PostAsJsonAsync("/api/projets", new
        {
            client = "Client affectation",
            nom = "Projet affectation " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var projetId = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var objectIdContributor = Guid.NewGuid().ToString();
        using var contributor = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdContributor,
            FabriquePostgreSqlApi.RoleContributeur));
        Assert.Equal(HttpStatusCode.OK, (await contributor.GetAsync("/api/moi/capacites")).StatusCode);

        Guid utilisateurId;
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
            utilisateurId = (await db.Utilisateurs.SingleAsync(
                utilisateur => utilisateur.IdentifiantExterne == $"{FabriquePostgreSqlApi.TenantId}:{objectIdContributor}")).Id;
        }

        var affectation = await manager.PutAsJsonAsync(
            $"/api/projets/{projetId}/habilitations/{utilisateurId}",
            new { role = "Consultant" });
        Assert.Equal(HttpStatusCode.NoContent, affectation.StatusCode);

        var habilitations = await manager.GetFromJsonAsync<JsonArray>(
            $"/api/projets/{projetId}/habilitations");
        Assert.Contains(habilitations!, item =>
            item!["utilisateurId"]!.GetValue<Guid>() == utilisateurId &&
            item["role"]!.GetValue<string>() == "Consultant");

        Assert.Equal(HttpStatusCode.OK, (await contributor.GetAsync($"/api/projets/{projetId}")).StatusCode);
    }

    [Fact]
    public async Task Admin_peut_desactiver_et_reactiver_un_compte_sans_pouvoir_se_desactiver_lui_meme()
    {
        var objectIdAdmin = Guid.NewGuid().ToString();
        using var admin = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(objectIdAdmin, "Admin"));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/utilisateurs")).StatusCode);

        var objectIdCible = Guid.NewGuid().ToString();
        using var cible = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdCible,
            FabriquePostgreSqlApi.RoleContributeur));
        Assert.Equal(HttpStatusCode.OK, (await cible.GetAsync("/api/moi/capacites")).StatusCode);

        Guid utilisateurCibleId;
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
            utilisateurCibleId = (await db.Utilisateurs.SingleAsync(
                utilisateur => utilisateur.IdentifiantExterne == $"{FabriquePostgreSqlApi.TenantId}:{objectIdCible}")).Id;
        }

        var desactivation = await admin.PutAsJsonAsync(
            $"/api/utilisateurs/{utilisateurCibleId}/activation",
            new { actif = false });
        Assert.Equal(HttpStatusCode.NoContent, desactivation.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await cible.GetAsync("/api/moi/capacites")).StatusCode);

        var reactivation = await admin.PutAsJsonAsync(
            $"/api/utilisateurs/{utilisateurCibleId}/activation",
            new { actif = true });
        Assert.Equal(HttpStatusCode.NoContent, reactivation.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await cible.GetAsync("/api/moi/capacites")).StatusCode);

        var adminMoi = await admin.GetFromJsonAsync<JsonObject>("/api/moi");
        var adminId = adminMoi!["id"]!.GetValue<Guid>();
        var selfDesactivation = await admin.PutAsJsonAsync(
            $"/api/utilisateurs/{adminId}/activation",
            new { actif = false });
        Assert.Equal(HttpStatusCode.BadRequest, selfDesactivation.StatusCode);
    }

    [Fact]
    public async Task Contributor_ne_voit_et_ne_saisit_que_les_taches_de_son_profil()
    {
        using var manager = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            Guid.NewGuid().ToString(), FabriquePostgreSqlApi.RoleManager));

        var reference = "TASKS-" + Guid.NewGuid().ToString("N")[..8];
        var creation = await manager.PostAsJsonAsync("/api/projets", new
        {
            client = "Client confidentialité",
            nom = "Projet tâches " + reference,
            reference,
            debut = "2026-11-02",
            finContractuelle = "2027-02-26",
            typeContrat = "Forfait"
        });
        Assert.Equal(HttpStatusCode.Created, creation.StatusCode);
        var projetId = (await creation.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var objectIdContributor = Guid.NewGuid().ToString();
        using var contributor = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            objectIdContributor, FabriquePostgreSqlApi.RoleContributeur));
        Assert.Equal(HttpStatusCode.OK, (await contributor.GetAsync("/api/moi/capacites")).StatusCode);

        Guid utilisateurId;
        Guid profilContributorId = Guid.NewGuid();
        Guid profilAutreId = Guid.NewGuid();
        Guid tacheContributorId;
        var tacheContributorUid = "r-contributor";
        var tacheAutreUid = "r-other";
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
            utilisateurId = (await db.Utilisateurs.SingleAsync(
                utilisateur => utilisateur.IdentifiantExterne == $"{FabriquePostgreSqlApi.TenantId}:{objectIdContributor}")).Id;

            var profilContributor = new ProfilProjet
            {
                Id = profilContributorId, ProjetId = projetId, Rang = 0, Nom = "Profil contributeur",
                Entite = "FO", Tjm = 0, Cjm = 0, Frais = 0, Collaborateur = "Contributeur"
            };
            var profilAutre = new ProfilProjet
            {
                Id = profilAutreId, ProjetId = projetId, Rang = 1, Nom = "Autre profil",
                Entite = "FO", Tjm = 0, Cjm = 0, Frais = 0, Collaborateur = "Autre personne"
            };
            var tacheContributor = new Tache
            {
                Id = Guid.NewGuid(), ProjetId = projetId, Repere = tacheContributorUid, Position = 0,
                LigneTsp = 1, CodeAxeTsp = "AXE1", LotTsp = "LOT1", PhaseTsp = "PHASE1",
                EtapeTsp = "ETAPE1", LibelleTsp = "Tâche du contributeur", Hypothese = "",
                MarqueurLivrable = "", EstSection = false, ColonneLivrable = false
            };
            var tacheAutre = new Tache
            {
                Id = Guid.NewGuid(), ProjetId = projetId, Repere = tacheAutreUid, Position = 1,
                LigneTsp = 2, CodeAxeTsp = "AXE2", LotTsp = "LOT2", PhaseTsp = "PHASE2",
                EtapeTsp = "ETAPE2", LibelleTsp = "Tâche d'un autre profil", Hypothese = "",
                MarqueurLivrable = "", EstSection = false, ColonneLivrable = false
            };
            tacheContributorId = tacheContributor.Id;
            db.Profils.AddRange(profilContributor, profilAutre);
            db.Taches.AddRange(tacheContributor, tacheAutre);
            db.ChargesTache.AddRange(
                new ChargeTache
                {
                    Id = Guid.NewGuid(), ProjetId = projetId, TacheId = tacheContributor.Id,
                    ProfilProjetId = profilContributorId, ChargeVendue = 1
                },
                new ChargeTache
                {
                    Id = Guid.NewGuid(), ProjetId = projetId, TacheId = tacheAutre.Id,
                    ProfilProjetId = profilAutreId, ChargeVendue = 1
                });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.NoContent, (await manager.PutAsJsonAsync(
            $"/api/projets/{projetId}/habilitations/{utilisateurId}", new { role = "Consultant" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await manager.PutAsJsonAsync(
            $"/api/projets/{projetId}/habilitations/profils/{profilContributorId}/utilisateur",
            new { utilisateurId })).StatusCode);

        var suivi = await contributor.GetFromJsonAsync<JsonObject>($"/api/projets/{projetId}/suivi");
        var tachesVisibles = suivi!["projet"]!["tasks"]!.AsArray()
            .Select(tache => tache!["uid"]!.GetValue<string>()).ToArray();
        Assert.Contains(tacheContributorUid, tachesVisibles);
        Assert.DoesNotContain(tacheAutreUid, tachesVisibles);

        var saisieAutorisee = await contributor.PutAsJsonAsync(
            $"/api/projets/{projetId}/taches/{tacheContributorUid}/consomme",
            new { profilId = profilContributorId, jour = "2026-11-12", jh = 0.5m });
        Assert.Equal(HttpStatusCode.OK, saisieAutorisee.StatusCode);

        var saisieInterdite = await contributor.PutAsJsonAsync(
            $"/api/projets/{projetId}/taches/{tacheAutreUid}/consomme",
            new { profilId = profilAutreId, jour = "2026-11-12", jh = 0.5m });
        Assert.Equal(HttpStatusCode.Forbidden, saisieInterdite.StatusCode);

        // A Project Manager may comment on a task, but neither the Contributor nor another project
        // member may edit or delete that comment unless they are its author.
        var commentaireCree = await manager.PostAsJsonAsync(
            $"/api/projets/{projetId}/commentaires/Tache/{tacheContributorId}",
            new { texte = "Commentaire rédigé par le Project Manager" });
        Assert.Equal(HttpStatusCode.OK, commentaireCree.StatusCode);

        Guid commentaireId;
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
            commentaireId = await db.Commentaires
                .Where(commentaire => commentaire.ProjetId == projetId && commentaire.CibleType == "Tache" && commentaire.CibleId == tacheContributorId)
                .Select(commentaire => commentaire.Id)
                .SingleAsync();
        }

        Assert.Equal(HttpStatusCode.Forbidden, (await contributor.PutAsJsonAsync(
            $"/api/projets/{projetId}/commentaires/{commentaireId}",
            new { texte = "Tentative de modification par un autre auteur" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await contributor.DeleteAsync(
            $"/api/projets/{projetId}/commentaires/{commentaireId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.PutAsJsonAsync(
            $"/api/projets/{projetId}/commentaires/{commentaireId}",
            new { texte = "Commentaire modifié par son auteur" })).StatusCode);
    }

    [Fact]
    public async Task Absences_personnelles_sont_authentifiees_et_limitees_a_la_personne_connectee()
    {
        using var utilisateur = _fixture.ClientPour(FabriquePostgreSqlApi.CreerJeton(
            Guid.NewGuid().ToString(),
            FabriquePostgreSqlApi.RoleManager));

        var avant = await utilisateur.GetAsync("/api/moi/absences?du=2026-11-01&au=2026-11-30");
        Assert.Equal(HttpStatusCode.OK, avant.StatusCode);

        var enregistre = await utilisateur.PutAsJsonAsync("/api/moi/absences", new
        {
            jour = "2026-11-12",
            moment = "m"
        });
        Assert.Equal(HttpStatusCode.OK, enregistre.StatusCode);
        var absences = await enregistre.Content.ReadFromJsonAsync<JsonArray>();
        Assert.Contains(absences!, x => x!["jour"]!.GetValue<string>() == "2026-11-12"
            && x["moment"]!.GetValue<string>() == "m");

        var efface = await utilisateur.PutAsJsonAsync("/api/moi/absences", new
        {
            jour = "2026-11-12",
            moment = ""
        });
        Assert.Equal(HttpStatusCode.OK, efface.StatusCode);
        var restantes = await efface.Content.ReadFromJsonAsync<JsonArray>();
        Assert.DoesNotContain(restantes!, x => x!["jour"]!.GetValue<string>() == "2026-11-12");
    }

}

public sealed class FabriquePostgreSqlApi : IAsyncLifetime
{
    public const string TenantId = "11111111-1111-4111-8111-111111111111";
    public const string ClientId = "22222222-2222-4222-8222-222222222222";
    public const string Audience = "api://22222222-2222-4222-8222-222222222222";
    public const string Issuer = "https://login.microsoftonline.com/" + TenantId + "/v2.0";
    public const string RoleManager = "Manager";
    public const string RoleContributeur = "Contributor";
    private const string CleTest = "only-for-tests-signing-key-never-use-in-production-2026";
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18")
        .WithDatabase("pilotage_forfaits_tests")
        .WithUsername("pilotage")
        .WithPassword("pilotage_test_only")
        .Build();
    private string? _baseConnectionString;
    private readonly string _schema = "security_it_" + Guid.NewGuid().ToString("N");
    private string _schemaConnectionString = "";
    private HoteApi? _host;

    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _host?.Services ?? throw new InvalidOperationException("PostgreSQL API host is not initialized.");

    public async Task InitializeAsync()
    {
        // Every fixture owns a fresh PostgreSQL container. No developer database or shared CI service is reused.
        await _postgres.StartAsync();
        _baseConnectionString = _postgres.GetConnectionString();

        var schemaBuilder = new NpgsqlConnectionStringBuilder(_baseConnectionString) { SearchPath = _schema };
        _schemaConnectionString = schemaBuilder.ConnectionString;

        await using (var connection = new NpgsqlConnection(_baseConnectionString))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE SCHEMA \"{_schema}\"", connection);
            await command.ExecuteNonQueryAsync();
        }

        _host = new HoteApi(_schemaConnectionString);
        Client = _host.CreateClient();
        using var scope = _host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
        await db.Database.MigrateAsync();
    }

    public HttpClient ClientPour(string jeton)
    {
        var client = _host!.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jeton);
        return client;
    }

    public static string CreerJeton(string objectId, string groupe)
    {
        var cle = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(CleTest));
        var maintenant = DateTime.UtcNow;
        var jeton = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims:
            [
                new Claim("tid", TenantId),
                new Claim("oid", objectId),
                new Claim("name", "Utilisateur PostgreSQL de test"),
                new Claim("scp", "acces"),
                new Claim("roles", groupe)
            ],
            notBefore: maintenant.AddMinutes(-1),
            expires: maintenant.AddMinutes(5),
            signingCredentials: new SigningCredentials(cle, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(jeton);
    }

    public async Task DisposeAsync()
    {
        if (_host is not null) await _host.DisposeAsync();
        Client?.Dispose();
        if (!string.IsNullOrWhiteSpace(_baseConnectionString))
        {
            NpgsqlConnection.ClearAllPools();
            await using var connection = new NpgsqlConnection(_baseConnectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"DROP SCHEMA IF EXISTS \"{_schema}\" CASCADE", connection);
            await command.ExecuteNonQueryAsync();
        }

        await _postgres.DisposeAsync();
    }

    private sealed class HoteApi(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Tests");
            var testConfiguration = new Dictionary<string, string?>
            {
                ["ConnectionStrings:Pilotage"] = connectionString,
                ["Authentification:Mode"] = "EntraId",
                ["AzureAd:Instance"] = "https://login.microsoftonline.com/",
                ["AzureAd:TenantId"] = TenantId,
                ["AzureAd:ClientId"] = ClientId,
                ["AzureAd:Audience"] = Audience,
                ["AzureAd:RequiredScope"] = "acces",
            };

            // Minimal hosting reads configuration while Program.cs is executing. Apply host settings
            // as well as the in-memory provider so test overrides are visible during early startup validation.
            foreach (var pair in testConfiguration)
                builder.UseSetting(pair.Key, pair.Value ?? string.Empty);

            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(testConfiguration);
            });

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<PilotageDbContext>>();
                services.RemoveAll<IDbContextOptionsConfiguration<PilotageDbContext>>();
                services.AddDbContext<PilotageDbContext>(options => options.UseNpgsql(connectionString));
                services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
                {
                    options.Authority = null;
                    options.MetadataAddress = null;
                    options.ConfigurationManager = null;
                    // Keep the exact Entra claim names used by the signed test tokens. This makes the
                    // app-role transformation exercise the raw tid/oid/roles contract without
                    // relying on framework inbound claim remapping.
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = Issuer,
                        ValidateAudience = true,
                        ValidAudience = Audience,
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(CleTest))
                    };
                    options.Events = new JwtBearerEvents();
                });
            });
        }
    }
}

