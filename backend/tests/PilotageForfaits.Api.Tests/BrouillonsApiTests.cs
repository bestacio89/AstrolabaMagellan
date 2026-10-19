using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Brouillons;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Application.Import;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Api.Tests;

/// <summary>Créer un projet en rédigeant son TSP : brouillon privé, enregistrement, contrôles, export Excel et lancement.</summary>
public sealed class BrouillonsApiTests : IClassFixture<FabriqueApi>
{
    private static readonly DateOnly Jour = new(2026, 10, 6);
    private static readonly DateTimeOffset Maintenant = FabriqueApi.HorlogeFixe.ParDefaut;
    private readonly FabriqueApi _api;

    public BrouillonsApiTests(FabriqueApi api)
    {
        _api = api;
        _api.PreparerBase();
    }

    /// <summary>Un TSP complet : 2 profils, 3 tâches (dont une ligne de titre), planning, échéancier à 100 %.</summary>
    private static object TspComplet(string client, string projet, decimal derniereEcheance = 0.5m) => new
    {
        format = 1,
        fiche = new { client, projet, reference = "", typeContrat = "Forfait", debut = "2026-11-02", fin = "2027-01-29" },
        remise = 0,
        profils = new[]
        {
            new { id = "p1", nom = "Chef de projet", entite = "FO", tjm = 800, cjm = 400, frais = 0, collaborateur = "" },
            new { id = "p2", nom = "Architecte", entite = "FO", tjm = 900, cjm = 500, frais = 0, collaborateur = "" },
        },
        taches = new object[]
        {
            new { id = "t1", axe = "1", lot = "Lot 1", phase = "PILOTAGE", etape = "Pilotage projet", libelle = "Cadrage", charges = new Dictionary<string, decimal> { ["p1"] = 2, ["p2"] = 1 }, livrable = false, hypothese = "" },
            new { id = "t2", axe = "1", lot = "Lot 1", phase = "", etape = "", libelle = "Conception", charges = new Dictionary<string, decimal>(), livrable = false, hypothese = "", separateur = true },
            new { id = "t3", axe = "1", lot = "Lot 1", phase = "CONCEPTION", etape = "Conception générale", libelle = "Dossier d'architecture", charges = new Dictionary<string, decimal> { ["p2"] = 5 }, livrable = true, hypothese = "" },
        },
        planning = new Dictionary<string, Dictionary<string, decimal>>
        {
            ["p1"] = new() { ["2026-11"] = 2 },
            ["p2"] = new() { ["2026-11"] = 4, ["2026-12"] = 2 },
        },
        echeances = new[]
        {
            new { id = "e1", nom = "Commande", pct = 0.5m, mois = "2026-11" },
            new { id = "e2", nom = "Recette", pct = derniereEcheance, mois = "2027-01" },
        },
        achats = Array.Empty<object>(),
        prestataires = Array.Empty<object>(),
        frais = Array.Empty<object>(),
        metrique = Array.Empty<object>(),
        phases = new[] { "PILOTAGE", "CONCEPTION" },
        etapes = new[] { "Pilotage projet", "Conception générale" },
    };

    private static async Task<Guid> CreerAsync(HttpClient client, string nomClient, string projet)
    {
        var reponse = await client.PostAsJsonAsync("/api/brouillons", new { client = nomClient, projet });
        Assert.Equal(HttpStatusCode.Created, reponse.StatusCode);
        return (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();
    }

    private static async Task<JsonObject> EnregistrerAsync(HttpClient client, Guid id, int version, object contenu)
    {
        var reponse = await client.PutAsJsonAsync($"/api/brouillons/{id}", new { version, contenu });
        Assert.Equal(HttpStatusCode.OK, reponse.StatusCode);
        return (await reponse.Content.ReadFromJsonAsync<JsonObject>())!;
    }

    private static string Unique(string nom) => $"{nom} {Guid.NewGuid().ToString()[..8]}";

    [Fact]
    public async Task Un_brouillon_est_prive_et_n_apparait_pas_dans_les_projets()
    {
        var chef = _api.ClientPour("chef");
        var client = Unique("Client brouillon");
        var id = await CreerAsync(chef, client, "Projet privé");

        var mesBrouillons = await chef.GetFromJsonAsync<JsonArray>("/api/brouillons");
        Assert.Contains(mesBrouillons!, b => b!["id"]!.GetValue<Guid>() == id);
        var projets = await chef.GetFromJsonAsync<JsonArray>("/api/projets");
        Assert.DoesNotContain(projets!, p => p!["client"]!.GetValue<string>() == client);

        // un autre chef de projet ne le voit pas, même par son adresse
        Assert.Equal(HttpStatusCode.NotFound, (await _api.ClientPour("chef2").GetAsync($"/api/brouillons/{id}")).StatusCode);
        Assert.DoesNotContain((await _api.ClientPour("chef2").GetFromJsonAsync<JsonArray>("/api/brouillons"))!, b => b!["id"]!.GetValue<Guid>() == id);
    }

    [Fact]
    public async Task Un_consultant_ne_peut_pas_creer_de_brouillon()
    {
        var reponse = await _api.ClientPour("consultant").PostAsJsonAsync("/api/brouillons", new { client = "C", projet = "P" });
        Assert.Equal(HttpStatusCode.Forbidden, reponse.StatusCode);
    }

    [Fact]
    public async Task Le_brouillon_vierge_signale_ce_qui_manque_avant_le_lancement()
    {
        var chef = _api.ClientPour("chef");
        var id = await CreerAsync(chef, Unique("Client vierge"), "Projet vierge");
        var brouillon = await chef.GetFromJsonAsync<JsonObject>($"/api/brouillons/{id}");
        var analyse = brouillon!["analyse"]!;
        Assert.Null(analyse["synthese"]);
        Assert.True(analyse["bloquants"]!.GetValue<int>() >= 4); // période, profils, workload, échéancier
        Assert.Equal("bloquant", analyse["rubriques"]!["fiche"]!.GetValue<string>());
        Assert.Equal("vide", analyse["rubriques"]!["depenses"]!.GetValue<string>());
        // le TSP vierge reprend les listes et les repères du modèle
        Assert.NotEmpty(brouillon["contenu"]!["etapes"]!.AsArray());
        Assert.NotEmpty(brouillon["contenu"]!["metrique"]!.AsArray());

        var lancement = await chef.PostAsJsonAsync($"/api/brouillons/{id}/lancement", new { version = brouillon["version"]!.GetValue<int>() });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, lancement.StatusCode);
    }

    [Fact]
    public async Task Un_TSP_redige_puis_lance_devient_un_projet_et_le_brouillon_disparait()
    {
        var chef = _api.ClientPour("chef");
        var nomClient = Unique("Client rédigé");
        var id = await CreerAsync(chef, nomClient, "Projet rédigé");
        var lu = await chef.GetFromJsonAsync<JsonObject>($"/api/brouillons/{id}");
        var enregistre = await EnregistrerAsync(chef, id, lu!["version"]!.GetValue<int>(), TspComplet(nomClient, "Projet rédigé"));

        var analyse = enregistre["analyse"]!;
        Assert.Equal(0, analyse["bloquants"]!.GetValue<int>());
        // CA = 2 × 800 + 6 × 900 = 7 000 € ; coût = 2 × 400 + 6 × 500 = 3 800 €
        Assert.Equal(7000m, analyse["synthese"]!["ca"]!.GetValue<decimal>());
        Assert.Equal(3800m, analyse["synthese"]!["cout"]!.GetValue<decimal>());
        Assert.Equal(8m, analyse["synthese"]!["jours"]!.GetValue<decimal>());
        // planning de l'architecte : 6 JH répartis sur 6 ; chef de projet : 2 sur 2 → cohérent
        Assert.Equal("ok", analyse["rubriques"]!["planning"]!.GetValue<string>());

        var lancement = await chef.PostAsJsonAsync($"/api/brouillons/{id}/lancement", new { version = enregistre["version"]!.GetValue<int>() });
        Assert.Equal(HttpStatusCode.Created, lancement.StatusCode);
        var projetId = (await lancement.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();

        var detail = await chef.GetFromJsonAsync<JsonObject>($"/api/projets/{projetId}");
        Assert.Equal("TSP rédigé dans l'application", detail!["origine"]!.GetValue<string>());
        Assert.Equal("Chef de projet", detail["monRole"]!.GetValue<string>());
        Assert.Equal(8m, detail["indicateurs"]!["prevu"]!.GetValue<decimal>());
        Assert.Equal(HttpStatusCode.NotFound, (await chef.GetAsync($"/api/brouillons/{id}")).StatusCode);

        // le forfait est désormais suivi : un nouveau brouillon du même forfait est refusé
        var doublon = await chef.PostAsJsonAsync("/api/brouillons", new { client = nomClient, projet = "Projet rédigé" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, doublon.StatusCode);
    }

    [Fact]
    public async Task Le_lancement_est_refuse_tant_qu_un_point_est_bloquant()
    {
        var chef = _api.ClientPour("chef");
        var nomClient = Unique("Client échéancier");
        var id = await CreerAsync(chef, nomClient, "Projet");
        var lu = await chef.GetFromJsonAsync<JsonObject>($"/api/brouillons/{id}");
        var enregistre = await EnregistrerAsync(chef, id, lu!["version"]!.GetValue<int>(), TspComplet(nomClient, "Projet", derniereEcheance: 0.3m));
        Assert.Equal(1, enregistre["analyse"]!["bloquants"]!.GetValue<int>());
        Assert.Contains(enregistre["analyse"]!["controles"]!.AsArray(), c => c!["cle"]!.GetValue<string>() == "echeancier.total" && c["niveau"]!.GetValue<string>() == "bloquant");

        var lancement = await chef.PostAsJsonAsync($"/api/brouillons/{id}/lancement", new { version = enregistre["version"]!.GetValue<int>() });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, lancement.StatusCode);
        var probleme = await lancement.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Contains("80 %", probleme!["detail"]!.GetValue<string>());
    }

    [Fact]
    public async Task Deux_enregistrements_simultanes_ne_s_ecrasent_pas()
    {
        var chef = _api.ClientPour("chef");
        var nomClient = Unique("Client conflit");
        var id = await CreerAsync(chef, nomClient, "Projet");
        var version = (await chef.GetFromJsonAsync<JsonObject>($"/api/brouillons/{id}"))!["version"]!.GetValue<int>();
        await EnregistrerAsync(chef, id, version, TspComplet(nomClient, "Projet"));

        var perime = await chef.PutAsJsonAsync($"/api/brouillons/{id}", new { version, contenu = TspComplet(nomClient, "Projet") });
        Assert.Equal(HttpStatusCode.Conflict, perime.StatusCode);
    }

    [Fact]
    public async Task Le_co_redacteur_invite_voit_et_complete_le_brouillon_mais_ne_le_lance_pas()
    {
        var chef = _api.ClientPour("chef");
        await _api.ClientPour("chef2").GetAsync("/api/moi"); // première connexion : la personne est connue de l'application
        var nomClient = Unique("Client co-rédaction");
        var id = await CreerAsync(chef, nomClient, "Projet");
        var invitation = await chef.PutAsJsonAsync($"/api/brouillons/{id}/co-redacteur", new { email = "CHEF2@exemple.fr" });
        Assert.Equal(HttpStatusCode.OK, invitation.StatusCode);
        // l'invitation change la version : l'auteur continue d'enregistrer avec la version renvoyée
        var versionApresInvitation = (await invitation.Content.ReadFromJsonAsync<JsonObject>())!["version"]!.GetValue<int>();
        await EnregistrerAsync(chef, id, versionApresInvitation, TspComplet(nomClient, "Projet"));

        var co = _api.ClientPour("chef2");
        var lu = await co.GetFromJsonAsync<JsonObject>($"/api/brouillons/{id}");
        Assert.False(lu!["estCreateur"]!.GetValue<bool>());
        var enregistre = await EnregistrerAsync(co, id, lu["version"]!.GetValue<int>(), TspComplet(nomClient, "Projet"));
        var lancement = await co.PostAsJsonAsync($"/api/brouillons/{id}/lancement", new { version = enregistre["version"]!.GetValue<int>() });
        Assert.Equal(HttpStatusCode.Forbidden, lancement.StatusCode);

        // inconnu de l'application : refusé avec un message clair
        var inconnu = await chef.PutAsJsonAsync($"/api/brouillons/{id}/co-redacteur", new { email = "personne@exemple.fr" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, inconnu.StatusCode);
    }

    [Fact]
    public async Task Un_TSP_Excel_importe_dans_un_brouillon_puis_exporte_se_relit_a_l_identique()
    {
        var chef = _api.ClientPour("chef");
        var contenu = new ByteArrayContent(await File.ReadAllBytesAsync(OutilsTests.Donnees("tsp-exemple-b.xlsx")));
        contenu.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        var import = await chef.PostAsync("/api/brouillons/import-tsp", new MultipartFormDataContent { { contenu, "fichier", "tsp-exemple-b.xlsx" } });
        Assert.Equal(HttpStatusCode.Created, import.StatusCode);
        var id = (await import.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();
        var brouillon = await chef.GetFromJsonAsync<JsonObject>($"/api/brouillons/{id}");
        Assert.Equal("ImportTsp", brouillon!["origineCode"]!.GetValue<string>());

        var export = await chef.GetAsync($"/api/brouillons/{id}/export");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        var octets = await export.Content.ReadAsByteArrayAsync();

        // le fichier exporté, relu comme un TSP importé, donne la même synthèse que le brouillon
        using var scope = _api.Services.CreateScope();
        var lecteur = scope.ServiceProvider.GetRequiredService<ILecteurTsp>();
        var relu = lecteur.Lire(new MemoryStream(octets), "export.xlsx");
        var calcul = RedactionTsp.Calculer(RedactionTsp.DepuisTsp(relu), new ClasseurTsp.Contexte("Test", Jour), Maintenant);
        var synthese = brouillon["analyse"]!["synthese"]!;
        Assert.Equal(synthese["ca"]!.GetValue<decimal>(), calcul.Synthese.Ca);
        Assert.Equal(synthese["jours"]!.GetValue<decimal>(), calcul.Synthese.Jours);
        Assert.Equal(synthese["cout"]!.GetValue<decimal>(), calcul.Synthese.Cout);
        Assert.Equal(synthese["montantProjet"]!.GetValue<decimal>(), calcul.Synthese.MontantProjet);
    }

    [Theory]
    [InlineData("tsp-exemple-a.xlsx")]
    [InlineData("tsp-exemple-b.xlsx")]
    public void Un_TSP_repris_dans_un_brouillon_donne_les_memes_chiffres_que_son_import_direct(string fichier)
    {
        using var scope = _api.Services.CreateScope();
        var lecteur = scope.ServiceProvider.GetRequiredService<ILecteurTsp>();
        using var flux = File.OpenRead(OutilsTests.Donnees(fichier));
        var lu = lecteur.Lire(flux, fichier);

        var direct = MoteurCalcul.Calculer(
            ConstructeurProjetCalcul.Construire(ConstructeurProjetCalcul.DonneesEnMemoire(ConvertisseurTsp.CreerProjet(lu, fichier, null, Maintenant, Jour))), Jour);
        var redige = RedactionTsp.Calculer(RedactionTsp.DepuisTsp(lu), new ClasseurTsp.Contexte("Test", Jour), Maintenant);

        var a = direct.Synthese;
        var b = redige.Synthese;
        Assert.Equal(a.MontantProjet, b.MontantProjet);
        Assert.Equal(a.Jours, b.Jours);
        Assert.Equal(a.Ca, b.Ca);
        Assert.Equal(a.Cout, b.Cout);
        Assert.Equal(a.CoutAgence, b.CoutAgence);
        Assert.Equal(a.MargeNette, b.MargeNette);
        Assert.Equal(a.AchatsMt, b.AchatsMt);
        Assert.Equal(a.FraisDep, b.FraisDep);
        Assert.Equal(direct.Tasks.Count, redige.Tasks.Count);
        // les lignes vides du modèle (profil sans nom ni charge) ne sont pas reprises dans le brouillon
        Assert.Equal(direct.Profils.Where(p => p.Charge != 0).Select(p => p.Charge), redige.Profils.Where(p => p.Charge != 0).Select(p => p.Charge));
        Assert.Equal(direct.Echeancier.Select(e => e.Montant), redige.Echeancier.Select(e => e.Montant));
        Assert.Equal(direct.Metrique.Select(m => m.Propale), redige.Metrique.Select(m => m.Propale));
        Assert.Equal(direct.RefTotal, redige.RefTotal);
    }

    [Fact]
    public void Un_TSP_vide_se_met_en_classeur_sans_reference_circulaire()
    {
        var feuilles = ClasseurTsp.Feuilles(ModeleTsp.Vierge("Client", "Projet", null), new ClasseurTsp.Contexte("Test", Jour));
        foreach (var f in feuilles)
            for (var r = 0; r < f.Lignes.Count; r++)
                for (var c = 0; c < f.Lignes[r].Count; c++)
                    if (f.Lignes[r][c] is Cellule { Formule: { } formule })
                        Assert.DoesNotContain($"{ClasseurTsp.Lettre(c)}{r + 1}", formule.Replace("$", ""));
    }
}
