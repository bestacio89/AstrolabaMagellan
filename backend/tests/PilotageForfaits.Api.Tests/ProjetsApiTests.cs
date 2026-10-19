using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>Tests de bout en bout de l'API : authentification, habilitations, création, import et calculs.</summary>
public sealed class ProjetsApiTests : IClassFixture<FabriqueApi>
{
    private readonly FabriqueApi _api;

    public ProjetsApiTests(FabriqueApi api)
    {
        _api = api;
        _api.PreparerBase();
    }

    private static object ProjetVide(string nom) => new
    {
        client = "Client exemple", nom, reference = "OP00000", debut = "2026-11-02", finContractuelle = "2027-02-26", typeContrat = "Forfait",
    };

    private static MultipartFormDataContent FichierTsp(string nom = "tsp-exemple-a.xlsx")
    {
        var contenu = new ByteArrayContent(File.ReadAllBytes(OutilsTests.Donnees(nom)));
        contenu.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return new MultipartFormDataContent { { contenu, "fichier", nom } };
    }

    [Fact]
    public async Task La_sante_de_l_API_est_accessible_sans_connexion()
    {
        var reponse = await _api.CreateClient().GetAsync("/api/sante");
        Assert.Equal(HttpStatusCode.OK, reponse.StatusCode);
    }

    [Fact]
    public async Task L_utilisateur_connecte_est_cree_a_sa_premiere_connexion()
    {
        var moi = await _api.ClientPour("chef").GetFromJsonAsync<JsonObject>("/api/moi");
        Assert.Equal("Camille", moi!["prenom"]!.GetValue<string>());
        Assert.True(moi["peutCreerUnProjet"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Un_projet_vide_cree_apparait_en_preparation_dans_la_liste_de_son_chef_de_projet()
    {
        var client = _api.ClientPour("chef");
        var reponse = await client.PostAsJsonAsync("/api/projets", ProjetVide("Projet vide de test"));
        Assert.Equal(HttpStatusCode.Created, reponse.StatusCode);
        var id = (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var liste = await client.GetFromJsonAsync<JsonArray>("/api/projets");
        var projet = liste!.Single(p => p!["id"]!.GetValue<Guid>() == id)!;
        Assert.Equal("En préparation", projet["statut"]!.GetValue<string>());
        Assert.Equal("Chef de projet", projet["monRole"]!.GetValue<string>());
        Assert.True(projet["estVide"]!.GetValue<bool>());

        var detail = await client.GetFromJsonAsync<JsonObject>($"/api/projets/{id}");
        Assert.Equal("Création manuelle", detail!["origine"]!.GetValue<string>());
    }

    [Fact]
    public async Task Un_projet_vide_sans_client_est_refuse()
    {
        var reponse = await _api.ClientPour("chef").PostAsJsonAsync("/api/projets", new { nom = "Sans client", debut = "2026-11-02", finContractuelle = "2027-02-26" });
        Assert.Equal(HttpStatusCode.BadRequest, reponse.StatusCode);
    }

    [Fact]
    public async Task Une_fin_avant_le_debut_est_refusee_avec_un_message_clair()
    {
        var reponse = await _api.ClientPour("chef").PostAsJsonAsync("/api/projets", new { client = "C", nom = "P", debut = "2027-01-01", finContractuelle = "2026-01-01" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, reponse.StatusCode);
        var probleme = await reponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Contains("fin contractuelle", probleme!["detail"]!.GetValue<string>());
    }

    [Fact]
    public async Task Un_consultant_ne_peut_pas_creer_de_projet()
    {
        var reponse = await _api.ClientPour("consultant").PostAsJsonAsync("/api/projets", ProjetVide("Interdit"));
        Assert.Equal(HttpStatusCode.Forbidden, reponse.StatusCode);
    }

    [Fact]
    public async Task Un_chef_de_projet_ne_voit_pas_les_projets_des_autres()
    {
        var reponse = await _api.ClientPour("chef").PostAsJsonAsync("/api/projets", ProjetVide("Projet privé"));
        var id = (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var autre = _api.ClientPour("chef2");
        var liste = await autre.GetFromJsonAsync<JsonArray>("/api/projets");
        Assert.DoesNotContain(liste!, p => p!["id"]!.GetValue<Guid>() == id);
        Assert.Equal(HttpStatusCode.NotFound, (await autre.GetAsync($"/api/projets/{id}")).StatusCode);

        // le pilotage voit tous les projets, en lecture
        var pilotage = await _api.ClientPour("pilotage").GetFromJsonAsync<JsonObject>($"/api/projets/{id}");
        Assert.Equal("Pilotage", pilotage!["monRole"]!.GetValue<string>());
        Assert.False(pilotage["peutModifier"]!.GetValue<bool>());
    }

    [Fact]
    public async Task L_apercu_d_un_TSP_decrit_ce_qui_sera_repris_sans_rien_enregistrer()
    {
        var client = _api.ClientPour("chef2");
        var avant = (await client.GetFromJsonAsync<JsonArray>("/api/projets"))!.Count;
        var reponse = await client.PostAsync("/api/projets/import-tsp/apercu", FichierTsp());
        Assert.Equal(HttpStatusCode.OK, reponse.StatusCode);
        var apercu = await reponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("CLIENT EXEMPLE", apercu!["client"]!.GetValue<string>());
        Assert.Equal(93, apercu["nombreTaches"]!.GetValue<int>());
        Assert.Equal(avant, (await client.GetFromJsonAsync<JsonArray>("/api/projets"))!.Count);
    }

    [Fact]
    public async Task Un_fichier_qui_n_est_pas_un_TSP_est_refuse()
    {
        var contenu = new MultipartFormDataContent { { new ByteArrayContent("pas un tsp"u8.ToArray()), "fichier", "faux.xlsx" } };
        var reponse = await _api.ClientPour("chef").PostAsync("/api/projets/import-tsp", contenu);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, reponse.StatusCode);
    }

    /// <summary>
    /// Aller-retour complet : TSP → base de données → moteur. Les indicateurs doivent être identiques à ceux
    /// que la version de référence calcule sur le même TSP (scénario « scenario-a-tsp-importe »).
    /// </summary>
    [Fact]
    public async Task Un_TSP_importe_donne_les_memes_indicateurs_que_la_version_de_reference()
    {
        var client = _api.ClientPour("chef");
        var reponse = await client.PostAsync("/api/projets/import-tsp", FichierTsp());
        Assert.Equal(HttpStatusCode.Created, reponse.StatusCode);
        var id = (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        using (var scope = _api.Services.CreateScope())
        {
            var constructeur = new ConstructeurProjetCalcul(scope.ServiceProvider.GetRequiredService<PilotageDbContext>());
            var calcul = MoteurCalcul.Calculer(await constructeur.ChargerAsync(id), new DateOnly(2026, 10, 6));
            OutilsTests.VerifierIdentique(OutilsTests.Lire("scenario-a-tsp-importe.attendu.json"), OutilsTests.VersJson(calcul), "TSP importé puis relu en base");
        }

        var detail = await client.GetFromJsonAsync<JsonObject>($"/api/projets/{id}");
        var attendu = OutilsTests.Lire("scenario-a-tsp-importe.attendu.json");
        Assert.Equal(attendu["total"]!["prevu"]!.GetValue<decimal>(), detail!["indicateurs"]!["prevu"]!.GetValue<decimal>());
        Assert.Equal("Import d'un TSP", detail["origine"]!.GetValue<string>());
        Assert.NotEmpty(detail["dernierImport"]!["pointsReleves"]!.AsArray());
    }

    [Fact]
    public async Task Les_montants_ne_sont_pas_envoyes_a_un_role_qui_ne_doit_pas_les_voir()
    {
        var reponse = await _api.ClientPour("chef").PostAsync("/api/projets/import-tsp", FichierTsp());
        var id = (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var chef = await _api.ClientPour("chef").GetFromJsonAsync<JsonObject>($"/api/projets/{id}");
        Assert.NotNull(chef!["indicateurs"]!["chiffreAffaires"]);

        var pilotage = await _api.ClientPour("pilotage").GetFromJsonAsync<JsonObject>($"/api/projets/{id}");
        Assert.NotNull(pilotage!["indicateurs"]!["chiffreAffaires"]);

        // le consultant n'est pas habilité sur ce projet : il ne le voit pas du tout
        Assert.Equal(HttpStatusCode.NotFound, (await _api.ClientPour("consultant").GetAsync($"/api/projets/{id}")).StatusCode);
    }

    // ------------------------------------------------------------------ archivage et suppression

    private static async Task<Guid> ImporterAsync(HttpClient client)
    {
        var reponse = await client.PostAsync("/api/projets/import-tsp", FichierTsp());
        Assert.Equal(HttpStatusCode.Created, reponse.StatusCode);
        return (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();
    }

    private static async Task<HttpResponseMessage> EnvoyerAsync(HttpClient client, HttpMethod methode, string url, object corps)
    {
        var requete = new HttpRequestMessage(methode, url) { Content = JsonContent.Create(corps) };
        return await client.SendAsync(requete);
    }

    [Fact]
    public async Task Un_projet_archive_quitte_la_liste_passe_en_lecture_seule_et_peut_etre_restaure()
    {
        var chef = _api.ClientPour("chef");
        var id = await ImporterAsync(chef);
        Assert.Equal(HttpStatusCode.NoContent, (await EnvoyerAsync(chef, HttpMethod.Put, $"/api/projets/{id}/archivage", new { archive = true })).StatusCode);

        Assert.DoesNotContain((await chef.GetFromJsonAsync<JsonArray>("/api/projets"))!, p => p!["id"]!.GetValue<Guid>() == id);
        Assert.Contains((await chef.GetFromJsonAsync<JsonArray>("/api/projets?archives=true"))!, p => p!["id"]!.GetValue<Guid>() == id);
        var suivi = await chef.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        Assert.True(suivi!["droits"]!["archive"]!.GetValue<bool>());
        Assert.False(suivi["droits"]!["peutModifier"]!.GetValue<bool>());
        var saisie = await EnvoyerAsync(chef, HttpMethod.Put, $"/api/projets/{id}/taches/r7/commentaire", new { commentaire = "x" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, saisie.StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await EnvoyerAsync(chef, HttpMethod.Put, $"/api/projets/{id}/archivage", new { archive = false })).StatusCode);
        var projet = (await chef.GetFromJsonAsync<JsonArray>("/api/projets"))!.Single(p => p!["id"]!.GetValue<Guid>() == id)!;
        Assert.NotEqual("Archive", projet["statutCode"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Forbidden, (await EnvoyerAsync(_api.ClientPour("pilotage"), HttpMethod.Put, $"/api/projets/{id}/archivage", new { archive = true })).StatusCode);
    }

    [Fact]
    public async Task Un_projet_cree_par_erreur_se_supprime_avec_toutes_ses_donnees_apres_confirmation_de_son_nom()
    {
        var chef = _api.ClientPour("chef");
        var id = await ImporterAsync(chef); // l'import remplit la plupart des tables du projet
        var nom = (await chef.GetFromJsonAsync<JsonObject>($"/api/projets/{id}"))!["nom"]!.GetValue<string>();

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await EnvoyerAsync(chef, HttpMethod.Post, $"/api/projets/{id}/suppression", new { confirmation = "autre nom" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await EnvoyerAsync(_api.ClientPour("pilotage"), HttpMethod.Post, $"/api/projets/{id}/suppression", new { confirmation = nom })).StatusCode);

        var reponse = await EnvoyerAsync(chef, HttpMethod.Post, $"/api/projets/{id}/suppression", new { confirmation = "  " + nom.ToUpperInvariant() + " " });
        Assert.Equal(HttpStatusCode.NoContent, reponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await chef.GetAsync($"/api/projets/{id}/suivi")).StatusCode);
        Assert.DoesNotContain((await chef.GetFromJsonAsync<JsonArray>("/api/projets"))!, p => p!["id"]!.GetValue<Guid>() == id);
    }

    [Fact]
    public async Task Un_projet_qui_a_un_suivi_ne_se_supprime_pas_il_s_archive()
    {
        var chef = _api.ClientPour("chef");
        var id = await ImporterAsync(chef);
        var suivi = await chef.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        var profil = suivi!["projet"]!["profiles"]!.AsArray()[0]!["id"]!.GetValue<Guid>();
        var conso = await EnvoyerAsync(chef, HttpMethod.Put, $"/api/projets/{id}/taches/r7/consomme", new { profilId = profil, jour = "2026-09-10", jh = 0.5m });
        Assert.True(conso.IsSuccessStatusCode, await conso.Content.ReadAsStringAsync());
        var nom = (await chef.GetFromJsonAsync<JsonObject>($"/api/projets/{id}"))!["nom"]!.GetValue<string>();

        var reponse = await EnvoyerAsync(chef, HttpMethod.Post, $"/api/projets/{id}/suppression", new { confirmation = nom });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, reponse.StatusCode);
        Assert.Contains("Archivez-le", (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["detail"]!.GetValue<string>());
    }

    // ------------------------------------------------------------------ unicité des projets

    [Fact]
    public async Task Un_TSP_deja_importe_ne_peut_pas_l_etre_une_seconde_fois()
    {
        var chef = _api.ClientPour("chef");
        var id = await ImporterAsync(chef);

        // l'aperçu le signale avant l'import…
        var apercu = await (await chef.PostAsync("/api/projets/import-tsp/apercu", FichierTsp())).Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(id, apercu!["projetExistant"]!["id"]!.GetValue<Guid>());
        // … et l'import est refusé, avec le moyen de retrouver le projet
        var reponse = await chef.PostAsync("/api/projets/import-tsp", FichierTsp());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, reponse.StatusCode);
        Assert.Contains("déjà suivi", (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["detail"]!.GetValue<string>());

        // un collègue sans accès apprend seulement qu'il existe, sans son nom
        var autre = await _api.ClientPour("chef2").PostAsync("/api/projets/import-tsp", FichierTsp());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, autre.StatusCode);
        var detail = (await autre.Content.ReadFromJsonAsync<JsonObject>())!["detail"]!.GetValue<string>();
        Assert.Contains("pas accès", detail);
        Assert.DoesNotContain("CLIENT EXEMPLE", detail);

        // archivé, il se restaure : il ne se réimporte pas
        await EnvoyerAsync(chef, HttpMethod.Put, $"/api/projets/{id}/archivage", new { archive = true });
        reponse = await chef.PostAsync("/api/projets/import-tsp", FichierTsp());
        Assert.Contains("Restaurez-le", (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["detail"]!.GetValue<string>());

        // seul un projet supprimé (créé par erreur) libère son identité
        await EnvoyerAsync(chef, HttpMethod.Put, $"/api/projets/{id}/archivage", new { archive = false });
        var nom = (await chef.GetFromJsonAsync<JsonObject>($"/api/projets/{id}"))!["nom"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.NoContent, (await EnvoyerAsync(chef, HttpMethod.Post, $"/api/projets/{id}/suppression", new { confirmation = nom })).StatusCode);
        await ImporterAsync(chef);
    }

    [Fact]
    public async Task Un_projet_vide_ne_peut_pas_reprendre_l_identite_d_un_projet_existant()
    {
        var chef = _api.ClientPour("chef");
        Assert.Equal(HttpStatusCode.Created, (await chef.PostAsJsonAsync("/api/projets", ProjetVide("Premier"))).StatusCode);
        // même numéro d'opportunité (OP00000), autre nom : c'est le même forfait
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await chef.PostAsJsonAsync("/api/projets", ProjetVide("Second"))).StatusCode);
        // sans référence : le client et le nom font l'identité (accents et majuscules ignorés)
        object SansReference(string nom) => new { client = "Client exemple", nom, debut = "2026-11-02", finContractuelle = "2027-02-26" };
        Assert.Equal(HttpStatusCode.Created, (await chef.PostAsJsonAsync("/api/projets", SansReference("Refonte intranet"))).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await chef.PostAsJsonAsync("/api/projets", SansReference("REFONTE  INTRANÉT"))).StatusCode);
    }
}
