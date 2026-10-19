using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Suivi;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Api.Tests;

/// <summary>
/// Écran de suivi : toutes les saisies passent par l'API et doivent produire exactement les indicateurs
/// de la version de référence (POC v65) ; droits par rôle ; montants jamais envoyés à un consultant ; exports.
/// </summary>
public sealed class SuiviApiTests : IClassFixture<FabriqueApi>
{
    private readonly FabriqueApi _api;

    public SuiviApiTests(FabriqueApi api)
    {
        _api = api;
        _api.PreparerBase();
    }

    // ------------------------------------------------------------------ outils

    private static MultipartFormDataContent FichierTsp(string nom = "tsp-exemple-a.xlsx")
    {
        var contenu = new ByteArrayContent(File.ReadAllBytes(OutilsTests.Donnees(nom)));
        contenu.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return new MultipartFormDataContent { { contenu, "fichier", nom } };
    }

    private static async Task<Guid> ImporterAsync(HttpClient client)
    {
        var reponse = await client.PostAsync("/api/projets/import-tsp", FichierTsp());
        Assert.Equal(HttpStatusCode.Created, reponse.StatusCode);
        return (await reponse.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<Guid>();
    }

    /// <summary>Envoie une saisie ; elle doit réussir. Renvoie la réponse (suivi recalculé et messages).</summary>
    private static async Task<JsonObject> Saisir(HttpClient client, HttpMethod methode, string url, object? corps = null)
    {
        var requete = new HttpRequestMessage(methode, url);
        if (corps is not null) requete.Content = JsonContent.Create(corps);
        var reponse = await client.SendAsync(requete);
        var texte = await reponse.Content.ReadAsStringAsync();
        Assert.True(reponse.IsSuccessStatusCode, $"{methode} {url} : {(int)reponse.StatusCode} {texte}");
        return JsonNode.Parse(texte)!.AsObject();
    }

    /// <summary>Envoie une saisie qui doit être refusée avec le code indiqué ; renvoie le message.</summary>
    private static async Task<string> Refuser(HttpClient client, HttpMethod methode, string url, object? corps, HttpStatusCode attendu)
    {
        var requete = new HttpRequestMessage(methode, url);
        if (corps is not null) requete.Content = JsonContent.Create(corps);
        var reponse = await client.SendAsync(requete);
        Assert.Equal(attendu, reponse.StatusCode);
        var probleme = await reponse.Content.ReadFromJsonAsync<JsonObject>();
        return probleme?["detail"]?.GetValue<string>() ?? "";
    }

    private FabriqueApi.HorlogeFixe Horloge => (FabriqueApi.HorlogeFixe)_api.Services.GetRequiredService<IHorloge>();

    private async Task ModifierBaseAsync(Func<PilotageDbContext, Task> modification)
    {
        using var scope = _api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PilotageDbContext>();
        await modification(db);
        await db.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ scénario de référence

    /// <summary>
    /// Rejoue le scénario « suivi en cours » de la version de référence en passant par l'API (import du TSP, puis les saisies
    /// comme à l'écran) et compare les indicateurs à ceux calculés par le POC sur le même scénario.
    /// Les seules données posées directement en base sont celles que l'écran ne permet pas de saisir (elles viennent du TSP
    /// ou sont volontairement incohérentes dans le scénario, comme 1,25 JH le même jour).
    /// </summary>
    [Fact]
    public async Task Les_saisies_du_scenario_de_reference_donnent_les_memes_indicateurs_que_le_POC()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        string U(string chemin) => $"/api/projets/{id}/{chemin}";
        var suivi = await client.GetFromJsonAsync<JsonObject>(U("suivi"));
        var profils = suivi!["projet"]!["profiles"]!.AsArray().Select(p => p!["id"]!.GetValue<Guid>()).ToList();

        Task Conso(string uid, int profil, string jour, decimal jh) =>
            Saisir(client, HttpMethod.Put, U($"taches/{uid}/consomme"), new { profilId = profils[profil], jour, jh });
        Task Statut(string uid, string statut) => Saisir(client, HttpMethod.Put, U($"taches/{uid}/statut"), new { statut });
        Task Avancement(string uid, decimal avancement) => Saisir(client, HttpMethod.Put, U($"taches/{uid}/avancement"), new { avancement });
        Task Classement(string uid, string champ, string valeur) => Saisir(client, HttpMethod.Put, U($"taches/{uid}/classement"), new { champ, valeur });
        Task Dates(string uid, string debut, string fin) => Saisir(client, HttpMethod.Put, U($"taches/{uid}/dates"), new { debut, fin });
        void A(int mois, int jour, int heure) => Horloge.Maintenant = new DateTimeOffset(2026, mois, jour, heure, 0, 0, TimeSpan.Zero);

        try
        {
            await Saisir(client, HttpMethod.Put, U("parametres/dates"), new { champ = "finPrevue", valeur = "2027-04-21" });

            // r5 : validée, consommé = charge humaine → enveloppe IA intacte
            await Conso("r5", 0, "2026-09-07", 1); await Conso("r5", 1, "2026-09-07", 0.5m); await Conso("r5", 2, "2026-09-07", 0.5m); await Conso("r5", 3, "2026-09-07", 0.5m);
            await Statut("r5", "Validé");
            await Saisir(client, HttpMethod.Put, U("taches/r5/bilan-ia"), new { iaType = "Rédaction et génération de livrables", iaJustif = "Comptes rendus générés par IA" });
            // r7 : en cours
            await Conso("r7", 0, "2026-09-10", 0.5m); await Conso("r7", 0, "2026-09-17", 0.5m); await Conso("r7", 0, "2026-09-24", 0.5m);
            await Statut("r7", "En cours"); await Avancement("r7", 0.5m);
            // r9 : validée, non justifiée, sans type
            await Conso("r9", 3, "2026-09-14", 1); await Conso("r9", 3, "2026-09-15", 0.8m);
            await Statut("r9", "Validé"); await Classement("r9", "type", "");
            // r10 : validée, enveloppe IA dépassée
            await Conso("r10", 3, "2026-09-16", 1); await Conso("r10", 3, "2026-09-17", 1); await Conso("r10", 3, "2026-09-18", 0.5m);
            await Statut("r10", "Validé");
            await Saisir(client, HttpMethod.Put, U("taches/r10/bilan-ia"), new { iaType = "Données client inexploitables", iaJustif = "Données client inexploitables" });
            // r12 : budget épuisé, non terminée
            await Conso("r12", 3, "2026-09-21", 1); await Conso("r12", 3, "2026-09-22", 1);
            await Statut("r12", "En cours"); await Avancement("r12", 0.75m);
            // r16 : en recette (la charge ajoutée sur un profil déjà vendu est posée en base, plus bas)
            await Statut("r16", "En recette"); await Avancement("r16", 0.75m);
            await Conso("r16", 2, "2026-09-23", 1);
            // r13 : annulée avec avenant après un peu de consommé ; r14 : annulée sans avenant
            await Conso("r13", 2, "2026-09-11", 0.5m);
            A(9, 25, 10);
            await Saisir(client, HttpMethod.Post, U("taches/r13/annulation"), new { motif = "Hors périmètre", avenant = true, enregistrerDecision = false });
            A(9, 26, 10);
            await Saisir(client, HttpMethod.Post, U("taches/r14/annulation"), new { motif = "Doublon", avenant = false, enregistrerDecision = false });
            // tâche ajoutée après r16
            A(9, 28, 9);
            var creation = await Saisir(client, HttpMethod.Post, U("taches"), new
            {
                label = "Atelier complémentaire RSSI", axe = "AXE1", lot = "1.2", phase = "CONSTRUCTION", etape = "",
                charges = new[] { new { profilId = profils[2], jh = 2m } }, motif = "Ajout validé en COPROJ", apres = "r16",
            });
            Assert.Equal("a1", creation["ouvrir"]!.GetValue<string>());
            Horloge.Maintenant = FabriqueApi.HorlogeFixe.ParDefaut;
            await Conso("a1", 2, "2026-09-29", 0.5m);
            // r18 : RAF saisi ; r20 : RAF incohérent ; r19 bloquée ; r21 validée sans consommé
            await Conso("r18", 0, "2026-09-28", 1);
            await Saisir(client, HttpMethod.Put, U("taches/r18/reste-a-faire"), new { raf = 2m });
            await Avancement("r18", 0.25m);
            await Conso("r20", 2, "2026-09-08", 0.5m); await Conso("r20", 2, "2026-09-09", 1);
            await Avancement("r20", 0.25m);
            await Statut("r19", "Bloqué / En attente");
            await Statut("r21", "Validé");
            // classement, dates, échéance liée
            await Classement("r30", "axe", "AXE1");
            await Classement("r31", "type", "Atelier");
            await Dates("r33", "2026-10-12", "2026-11-06");
            await Saisir(client, HttpMethod.Put, U("taches/r33/echeance"), new { numero = 2 });
            await Dates("r34", "2027-03-01", "2027-05-15");
            await Dates("r63", "2026-09-01", "2026-12-18");
            await Classement("r63", "phase", "PILOTAGE");
            await Classement("r63", "lot", "3.1");
            await Statut("r64", "A faire");
            // échéancier : n° 1 facturée et payée, n° 2 liée à la phase PILOTAGE, dates prévues
            await Saisir(client, HttpMethod.Put, U("echeances/1/dates"), new { champ = "realiseLe", valeur = "2026-09-30" });
            await Saisir(client, HttpMethod.Put, U("echeances/1/dates"), new { champ = "payeeLe", valeur = "2026-10-05" });
            await Saisir(client, HttpMethod.Put, U("phases/PILOTAGE/echeance"), new { numero = 2 });
            await Saisir(client, HttpMethod.Put, U("echeances/2/dates"), new { champ = "datePrevue", valeur = "2026-10-01" });
            await Saisir(client, HttpMethod.Put, U("echeances/4/dates"), new { champ = "datePrevue", valeur = "2027-05-31" });

            // ---- données que l'écran ne permet pas de saisir (TSP, ou incohérence volontaire du scénario) ----
            await ModifierBaseAsync(async db =>
            {
                var projet = await db.Projets.FirstAsync(p => p.Id == id);
                projet.Remise = 0.05m;
                db.BudgetsAchats.Add(new LigneBudgetAchat { ProjetId = id, Ordre = 0, Designation = "Licences", Type = "Logiciel", CoutUnitaire = 1000, Quantite = 2, Revente = 2600 });
                db.BudgetsFrais.Add(new LigneBudgetFrais { ProjetId = id, Ordre = 0, Libelle = "Déplacements", CoutUnitaire = 300, Quantite = 2, Refacture = 0 });
                db.Prestataires.Add(new Prestataire { ProjetId = id, Ordre = 0, Designation = "Expert externe", Societe = "Société X", CoutJour = 600, NombreJours = 3, Tjm = 900 });
                var r16 = await db.Taches.FirstAsync(t => t.ProjetId == id && t.Repere == "r16");
                var charge = await db.ChargesTache.FirstAsync(c => c.TacheId == r16.Id && c.ProfilProjetId == profils[3]);
                charge.ChargeAjoutee = 1;
                charge.MotifAjout = "Demande client";
                charge.AjouteeLe = new DateTimeOffset(2026, 9, 20, 9, 0, 0, TimeSpan.Zero);
                var r22 = await db.Taches.FirstAsync(t => t.ProjetId == id && t.Repere == "r22");
                db.Consommes.Add(new Consomme { ProjetId = id, TacheId = r22.Id, ProfilProjetId = profils[2], Jour = new DateOnly(2026, 9, 8), JoursHomme = 0.75m, SaisiLe = DateTimeOffset.UtcNow });
                var r21 = await db.Taches.FirstAsync(t => t.ProjetId == id && t.Repere == "r21");
                r21.ValideeLe = new DateOnly(2026, 9, 30);
                var e1 = await db.Echeances.FirstAsync(e => e.ProjetId == id && e.Numero == 1);
                e1.MontantFacture = 20000;
            });

            // achats et frais réels
            await Saisir(client, HttpMethod.Post, U("achats"), new
            {
                date = "2026-09-20", ligne = 0, designation = "Licences", fournisseur = "Éditeur", qte = 3m, cu = 1000m, refacture = 2600m, statut = "Commandé",
            });
            await Saisir(client, HttpMethod.Post, U("achats"), new
            {
                date = "2026-09-22", ligne = (int?)null, designation = "Matériel", fournisseur = "Revendeur", qte = 1m, cu = 500m, refacture = 0m, statut = "Reçu",
            });
            await Saisir(client, HttpMethod.Post, U("frais"), new { date = "2026-09-15", collaborateur = "Alex", categorie = "Transport", libelle = "Train", montant = 450m, refacturable = false });
            await Saisir(client, HttpMethod.Post, U("frais"), new { date = "2026-09-16", collaborateur = "Sam", categorie = "Hébergement", libelle = "Hôtel", montant = 250m, refacturable = true });

            // registres : une action en retard, une action faite, une ligne vide ; une décision à valider ; deux risques
            async Task<Guid> Creer(string registre) =>
                Guid.Parse((await Saisir(client, HttpMethod.Post, U(registre)))["ouvrir"]!.GetValue<string>());
            Task Champ(string registre, Guid ligne, string champ, string valeur) =>
                Saisir(client, HttpMethod.Put, U($"{registre}/{ligne}"), new { champ, valeur });
            var a1 = await Creer("actions");
            await Champ("actions", a1, "libelle", "Valider le planning"); await Champ("actions", a1, "porteur", "Alex");
            await Champ("actions", a1, "statut", "En cours"); await Champ("actions", a1, "echeance", "2026-09-30");
            var a2 = await Creer("actions");
            await Champ("actions", a2, "libelle", "Envoyer le compte rendu"); await Champ("actions", a2, "porteur", "Sam");
            await Champ("actions", a2, "statut", "Fait"); await Champ("actions", a2, "echeance", "2026-09-02");
            var a3 = await Creer("actions");
            await Champ("actions", a3, "echeance", "2026-09-01");
            Assert.Equal(a3, await Creer("actions")); // une ligne vide existe : elle est réutilisée
            var d1 = await Creer("decisions");
            await Champ("decisions", d1, "libelle", "Report du pilote"); await Champ("decisions", d1, "statut", "À valider"); await Champ("decisions", d1, "date", "2026-09-25");
            var k1 = await Creer("risques");
            await Champ("risques", k1, "libelle", "Indisponibilité du RSSI"); await Champ("risques", k1, "proba", "Forte"); await Champ("risques", k1, "impact", "Fort");
            var k2 = await Creer("risques");
            await Champ("risques", k2, "libelle", "Retard des licences"); await Champ("risques", k2, "proba", "Faible"); await Champ("risques", k2, "impact", "Moyen");

            // ---- comparaison avec la version de référence ----
            var final = await client.GetFromJsonAsync<JsonObject>(U("suivi"));
            OutilsTests.VerifierIdentique(OutilsTests.Lire("scenario-a-suivi-en-cours.attendu.json"), final!["modele"], "Scénario rejoué par l'API");

            // exports : classeurs lisibles, avec les onglets du POC
            var copil = await client.PostAsync(U("exports/copil"), null);
            Assert.Equal(HttpStatusCode.OK, copil.StatusCode);
            var onglets = Onglets(await copil.Content.ReadAsByteArrayAsync());
            Assert.Contains("Tableau de bord", onglets);
            Assert.Contains("Facturation", onglets);
            Assert.Contains("Historique", onglets); // la photo du jour figure dans l'export
            var coproj = await client.PostAsJsonAsync(U("exports/coproj"), new { du = "2026-09-22", au = "2026-10-06", horizon = 14 });
            Assert.Equal(HttpStatusCode.OK, coproj.StatusCode);
            Assert.Contains("Plan d’action", Onglets(await coproj.Content.ReadAsByteArrayAsync()));
            var apres = await client.GetFromJsonAsync<JsonObject>(U("suivi"));
            Assert.Equal("2026-10-06", apres!["projet"]!["settings"]!["lastCoproj"]!.GetValue<string>());
            Assert.Equal(2, apres["projet"]!["historique"]!.AsArray().Count);
        }
        finally
        {
            Horloge.Maintenant = FabriqueApi.HorlogeFixe.ParDefaut;
        }
    }

    /// <summary>Noms des onglets d'un classeur .xlsx.</summary>
    private static List<string> Onglets(byte[] xlsx)
    {
        using var zip = new ZipArchive(new MemoryStream(xlsx));
        using var lecture = new StreamReader(zip.GetEntry("xl/workbook.xml")!.Open());
        var xml = lecture.ReadToEnd();
        return System.Text.RegularExpressions.Regex.Matches(xml, "<sheet name=\"([^\"]*)\"").Select(m => System.Net.WebUtility.HtmlDecode(m.Groups[1].Value)).ToList();
    }

    // ------------------------------------------------------------------ règles

    [Fact]
    public async Task Une_personne_ne_peut_pas_saisir_plus_d_une_journee_le_meme_jour()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var suivi = await client.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        var profil = suivi!["projet"]!["profiles"]!.AsArray()[2]!["id"]!.GetValue<Guid>();
        await Saisir(client, HttpMethod.Put, $"/api/projets/{id}/taches/r20/consomme", new { profilId = profil, jour = "2026-09-08", jh = 0.5m });
        var message = await Refuser(client, HttpMethod.Put, $"/api/projets/{id}/taches/r22/consomme",
            new { profilId = profil, jour = "2026-09-08", jh = 0.75m }, HttpStatusCode.UnprocessableEntity);
        Assert.Contains("il reste 0,5 JH", message);
    }

    [Fact]
    public async Task Le_premier_consomme_fait_passer_la_tache_en_cours_et_valider_met_100_pourcent()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var suivi = await client.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        var profil = suivi!["projet"]!["profiles"]!.AsArray()[0]!["id"]!.GetValue<Guid>();
        var r = await Saisir(client, HttpMethod.Put, $"/api/projets/{id}/taches/r7/consomme", new { profilId = profil, jour = "2026-09-10", jh = 0.5m });
        Assert.Contains(r["messages"]!.AsArray(), m => m!["texte"]!.GetValue<string>().Contains("En cours"));
        var tache = (JsonObject t) => t["suivi"]!["modele"]!["tasks"]!.AsArray().First(x => x!["uid"]!.GetValue<string>() == "r7")!;
        Assert.Equal("En cours", tache(r)["statut"]!.GetValue<string>());
        r = await Saisir(client, HttpMethod.Put, $"/api/projets/{id}/taches/r7/statut", new { statut = "Validé" });
        Assert.Equal(1m, tache(r)["avancement"]!.GetValue<decimal>());
        Assert.Equal(0m, tache(r)["raf"]!.GetValue<decimal>());
        r = await Saisir(client, HttpMethod.Put, $"/api/projets/{id}/taches/r7/avancement", new { avancement = 0.5m });
        Assert.Equal("En cours", tache(r)["statut"]!.GetValue<string>());
    }

    [Fact]
    public async Task Une_tache_annulee_n_accepte_plus_de_saisie_et_peut_etre_retablie()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var url = $"/api/projets/{id}/taches/r13";
        var r = await Saisir(client, HttpMethod.Post, $"{url}/annulation", new { motif = "Hors périmètre", avenant = true, enregistrerDecision = true });
        Assert.Single(r["suivi"]!["projet"]!["decisions"]!.AsArray()); // décision enregistrée au registre
        await Refuser(client, HttpMethod.Put, $"{url}/statut", new { statut = "En cours" }, HttpStatusCode.UnprocessableEntity);
        r = await Saisir(client, HttpMethod.Delete, $"{url}/annulation");
        var tache = r["suivi"]!["modele"]!["tasks"]!.AsArray().First(x => x!["uid"]!.GetValue<string>() == "r13")!;
        Assert.False(tache["annulee"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Une_echeance_facturee_garde_son_montant_et_le_paiement_suit_la_facture()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var url = $"/api/projets/{id}/echeances/1/dates";
        await Refuser(client, HttpMethod.Put, url, new { champ = "payeeLe", valeur = "2026-10-01" }, HttpStatusCode.UnprocessableEntity);
        await Refuser(client, HttpMethod.Put, url, new { champ = "realiseLe", valeur = "2026-10-07" }, HttpStatusCode.UnprocessableEntity); // futur
        var r = await Saisir(client, HttpMethod.Put, url, new { champ = "realiseLe", valeur = "2026-10-01" });
        var montant = r["suivi"]!["projet"]!["echTrack"]!["1"]!["montantFacture"]!.GetValue<decimal>();
        Assert.True(montant > 0);
        await Refuser(client, HttpMethod.Put, url, new { champ = "payeeLe", valeur = "2026-09-30" }, HttpStatusCode.UnprocessableEntity); // avant la facture
    }

    [Fact]
    public async Task Une_modification_simultanee_est_refusee_sans_ecraser_l_autre()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var suivi = await client.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        var version = suivi!["projet"]!["tasks"]!.AsArray().First(t => t!["uid"]!.GetValue<string>() == "r7")!["version"]!.GetValue<int>();
        await Saisir(client, HttpMethod.Put, $"/api/projets/{id}/taches/r7/commentaire", new { commentaire = "Premier", version });
        await Refuser(client, HttpMethod.Put, $"/api/projets/{id}/taches/r7/commentaire", new { commentaire = "Second", version }, HttpStatusCode.Conflict);
    }

    // ------------------------------------------------------------------ référence, livrable, fil des tâches

    [Fact]
    public async Task Une_reference_figee_garde_les_dates_et_chaque_ecart_recoit_une_cause_et_un_motif()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        string U(string chemin) => $"/api/projets/{id}/{chemin}";
        await Saisir(client, HttpMethod.Put, U("taches/r33/dates"), new { debut = "2026-10-12", fin = "2026-11-06" });
        var r = await Saisir(client, HttpMethod.Post, U("references"), new { libelle = "" });
        var reference = r["suivi"]!["projet"]!["references"]!.AsArray().Single()!;
        Assert.Equal("Référence initiale", reference["libelle"]!.GetValue<string>());
        Assert.Equal("2026-11-06", reference["lignes"]!["r33"]!["fin"]!.GetValue<string>());
        var refId = reference["id"]!.GetValue<Guid>();

        // le planning bouge : la référence, elle, ne bouge pas
        r = await Saisir(client, HttpMethod.Put, U("taches/r33/dates"), new { debut = "2026-10-19", fin = "2026-11-20" });
        Assert.Equal("2026-11-06", r["suivi"]!["projet"]!["references"]![0]!["lignes"]!["r33"]!["fin"]!.GetValue<string>());

        await Refuser(client, HttpMethod.Put, U($"references/{refId}/taches/r33/derive"), new { cause = "Météo", motif = "x" }, HttpStatusCode.UnprocessableEntity);
        r = await Saisir(client, HttpMethod.Put, U($"references/{refId}/taches/r33/derive"), new { cause = "Client", motif = "Données de test livrées en retard" });
        var ligne = r["suivi"]!["projet"]!["references"]![0]!["lignes"]!["r33"]!;
        Assert.Equal("Client", ligne["cause"]!.GetValue<string>());
        Assert.Equal("Données de test livrées en retard", ligne["motif"]!.GetValue<string>());
        Assert.Contains("Client", r["suivi"]!["projet"]!["causes"]!.AsArray().Select(x => x!.GetValue<string>()));

        // seul le chef de projet fige une référence
        await Refuser(_api.ClientPour("pilotage"), HttpMethod.Post, U("references"), new { libelle = "x" }, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Le_lien_du_livrable_n_accepte_que_les_adresses_web_ou_reseau()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var url = $"/api/projets/{id}/taches/r7/livrable/lien";
        await Refuser(client, HttpMethod.Put, url, new { lien = "javascript:alert(1)" }, HttpStatusCode.UnprocessableEntity);
        await Refuser(client, HttpMethod.Put, url, new { lien = "C:\\Documents\\livrable.docx" }, HttpStatusCode.UnprocessableEntity);
        var r = await Saisir(client, HttpMethod.Put, url, new { lien = "https://exemple.sharepoint.com/sites/projet/livrable.docx" });
        Assert.Equal("https://exemple.sharepoint.com/sites/projet/livrable.docx", r["suivi"]!["projet"]!["track"]!["r7"]!["livr"]!["lien"]!.GetValue<string>());
        r = await Saisir(client, HttpMethod.Put, url, new { lien = "" });
        Assert.Null(r["suivi"]!["projet"]!["track"]!["r7"]!["livr"]);
    }

    [Fact]
    public async Task Le_fil_d_une_tache_est_ecrit_par_l_equipe_et_ne_montre_aucun_montant_a_un_consultant()
    {
        var chef = _api.ClientPour("chef");
        var id = await ImporterAsync(chef);
        var url = $"/api/projets/{id}/taches/r7/mises-a-jour";
        await Refuser(chef, HttpMethod.Post, url, new { texte = "   " }, HttpStatusCode.UnprocessableEntity);
        await Saisir(chef, HttpMethod.Post, url, new { texte = "Atelier décalé, budget déplacement 1 200 €" });
        var consultant = _api.ClientPour("consultant");
        await consultant.GetAsync("/api/moi");
        await ModifierBaseAsync(async db =>
        {
            var u = await db.Utilisateurs.FirstAsync(x => x.IdentifiantExterne == "oid-consultant");
            db.Habilitations.Add(new Habilitation { ProjetId = id, UtilisateurId = u.Id, Role = RoleProjet.Consultant, Depuis = DateTimeOffset.UtcNow });
        });
        JsonObject r;
        try
        {
            Horloge.Maintenant = FabriqueApi.HorlogeFixe.ParDefaut.AddMinutes(5); // le message du consultant vient après celui du chef
            r = await Saisir(consultant, HttpMethod.Post, url, new { texte = "@Chef c’est noté, je reprends jeudi" });
        }
        finally
        {
            Horloge.Maintenant = FabriqueApi.HorlogeFixe.ParDefaut;
        }
        var fil = r["suivi"]!["projet"]!["misesAJour"]!["r7"]!.AsArray();
        Assert.Equal(2, fil.Count);
        Assert.Equal("@Chef c’est noté, je reprends jeudi", fil[0]!["texte"]!.GetValue<string>()); // le plus récent d'abord
        Assert.DoesNotContain("€", fil[1]!["texte"]!.GetValue<string>());
        Assert.Contains("Atelier décalé", fil[1]!["texte"]!.GetValue<string>());
        // le pilotage lit, mais n'écrit pas
        await Refuser(_api.ClientPour("pilotage"), HttpMethod.Post, url, new { texte = "x" }, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Une_reaffectation_deplace_la_charge_sans_changer_le_total_et_peut_etre_annulee()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var url = $"/api/projets/{id}/taches/r7";
        var suivi = await client.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        var profils = suivi!["projet"]!["profiles"]!.AsArray();
        var chef = profils[0]!["id"]!.GetValue<Guid>();    // Chef de Projet — CDP, CJM 378, 2 JH prévus sur r7 (+ 1 JH d’enveloppe IA)
        var expert = profils[1]!["id"]!.GetValue<Guid>();  // Expert IA, CJM 405
        JsonNode Tache(JsonObject r) => r["suivi"]!["modele"]!["tasks"]!.AsArray().First(x => x!["uid"]!.GetValue<string>() == "r7")!;
        decimal Charge(JsonObject r, int i) => Tache(r)["charges"]!.AsArray()[i]!.GetValue<decimal>();
        var total = suivi!["modele"]!["tasks"]!.AsArray().First(x => x!["uid"]!.GetValue<string>() == "r7")!["charge"]!.GetValue<decimal>();

        // vers une personne déjà sur le projet : le total ne change pas, le coût suit le CJM
        var r = await Saisir(client, HttpMethod.Post, $"{url}/reaffectations", new { deProfilId = chef, versProfilId = expert, jh = 0.5m, motif = "Renfort" });
        Assert.Equal(total, Tache(r)["charge"]!.GetValue<decimal>());
        Assert.Equal(1.5m, Charge(r, 0));
        Assert.Equal(0.5m, Charge(r, 1));
        Assert.Equal(13.5m, r["suivi"]!["modele"]!["financier"]!["coutReaff"]!.GetValue<decimal>()); // 0,5 × (405 − 378)
        Assert.Contains(r["messages"]!.AsArray(), m => m!["texte"]!.GetValue<string>().Contains("réaffectés"));

        // on ne réaffecte pas plus que ce qui reste à faire ; la nouvelle personne doit être nommée ; le motif est obligatoire
        Assert.Contains("Au plus 1,5 JH", await Refuser(client, HttpMethod.Post, $"{url}/reaffectations",
            new { deProfilId = chef, versProfilId = expert, jh = 2m, motif = "Renfort" }, HttpStatusCode.UnprocessableEntity));
        Assert.Contains("nom de la personne", await Refuser(client, HttpMethod.Post, $"{url}/reaffectations",
            new { deProfilId = chef, jh = 0.5m, motif = "Renfort" }, HttpStatusCode.UnprocessableEntity));
        await Refuser(client, HttpMethod.Post, $"{url}/reaffectations", new { deProfilId = chef, versProfilId = expert, jh = 0.5m, motif = " " },
            HttpStatusCode.UnprocessableEntity);
        // l'enveloppe IA (profil 4 du TSP d'exemple) n'est pas une personne : elle ne se réaffecte pas
        Assert.Contains("enveloppe", await Refuser(client, HttpMethod.Post, $"{url}/reaffectations",
            new { deProfilId = profils[4]!["id"]!.GetValue<Guid>(), versProfilId = expert, jh = 0.5m, motif = "Renfort" }, HttpStatusCode.UnprocessableEntity));

        // vers une nouvelle personne du même rôle : un profil est créé, avec le TJM et le CJM de la personne d'origine
        r = await Saisir(client, HttpMethod.Post, $"{url}/reaffectations", new { deProfilId = chef, collaborateur = "C. Petit", jh = 1m, motif = "Congés" });
        var nouveau = r["suivi"]!["projet"]!["profiles"]!.AsArray().Last()!;
        Assert.Equal("C. Petit", nouveau["collaborateur"]!.GetValue<string>());
        Assert.Equal(profils[0]!["nom"]!.GetValue<string>(), nouveau["nom"]!.GetValue<string>());
        Assert.Equal(profils[0]!["cjm"]!.GetValue<decimal>(), nouveau["cjm"]!.GetValue<decimal>());
        Assert.Equal(0.5m, Charge(r, 0));
        Assert.Equal(total, Tache(r)["charge"]!.GetValue<decimal>());
        Assert.Equal(2, r["suivi"]!["modele"]!["perimetre"]!["nReaff"]!.GetValue<int>());

        // annuler : la charge revient à la personne d'origine
        var premiere = r["suivi"]!["projet"]!["track"]!["r7"]!["reaff"]!.AsArray().First(x => x!["vers"]!.GetValue<int>() == 1)!["id"]!.GetValue<string>();
        r = await Saisir(client, HttpMethod.Delete, $"{url}/reaffectations/{premiere}");
        Assert.Equal(1m, Charge(r, 0));
        Assert.Equal(0m, Charge(r, 1));
        Assert.Equal(1, r["suivi"]!["modele"]!["perimetre"]!["nReaff"]!.GetValue<int>());
    }

    [Fact]
    public async Task Le_point_hebdo_garde_la_saisie_de_chaque_periode_et_les_reglages()
    {
        var client = _api.ClientPour("chef");
        var id = await ImporterAsync(client);
        var url = $"/api/projets/{id}/points-hebdo";
        var saisie = new
        {
            actualites = new[] { " Atelier de cadrage réalisé ", "", "Recette du lot 1 en préparation" },
            attention = new[] { "Disponibilité du RSSI à sécuriser" },
            indicateurs = new Dictionary<string, object> { ["qualite"] = new { s = "jaune", s1 = "vert" } },
            satisfaction = new { meteo = "soleil", tendance = "vert" },
            esprit = new { meteo = "nuage", tendance = "jaune" },
            extension = "Non", genere = false,
        };
        var r = await Saisir(client, HttpMethod.Put, $"{url}/semaines/2026-10-05", saisie);
        var point = r["suivi"]!["projet"]!["pointsHebdo"]!["periodes"]!["S:2026-10-05"]!;
        Assert.Equal(2, point["actualites"]!.AsArray().Count); // lignes vides retirées, espaces ôtés
        Assert.Equal("Atelier de cadrage réalisé", point["actualites"]![0]!.GetValue<string>());
        Assert.Equal("jaune", point["indicateurs"]!["qualite"]!["s"]!.GetValue<string>());
        Assert.Null(point["genereLe"]);
        // génération du PowerPoint : la date est retenue, et gardée aux saisies suivantes
        r = await Saisir(client, HttpMethod.Put, $"{url}/semaines/2026-10-05", saisie with { genere = true });
        Assert.NotNull(r["suivi"]!["projet"]!["pointsHebdo"]!["periodes"]!["S:2026-10-05"]!["genereLe"]);
        r = await Saisir(client, HttpMethod.Put, $"{url}/semaines/2026-10-05", saisie);
        Assert.NotNull(r["suivi"]!["projet"]!["pointsHebdo"]!["periodes"]!["S:2026-10-05"]!["genereLe"]);
        // point mensuel, distinct du point hebdo
        r = await Saisir(client, HttpMethod.Put, $"{url}/mois/2026-10", saisie);
        Assert.Equal(2, r["suivi"]!["projet"]!["pointsHebdo"]!["periodes"]!.AsObject().Count);
        // contrôles : une semaine commence un lundi, niveaux et météos connus, logo en image
        await Refuser(client, HttpMethod.Put, $"{url}/semaines/2026-10-06", saisie, HttpStatusCode.UnprocessableEntity);
        await Refuser(client, HttpMethod.Put, $"{url}/semaines/2026-10-05",
            saisie with { indicateurs = new Dictionary<string, object> { ["qualite"] = new { s = "violet", s1 = "vert" } } }, HttpStatusCode.UnprocessableEntity);
        await Refuser(client, HttpMethod.Put, $"{url}/reglages/logoClient", new { valeur = "javascript:alert(1)" }, HttpStatusCode.UnprocessableEntity);
        // réglages communs
        r = await Saisir(client, HttpMethod.Put, $"{url}/reglages/avv", new { valeur = "Hugo LEROY" });
        Assert.Equal("Hugo LEROY", r["suivi"]!["projet"]!["pointsHebdo"]!["reglages"]!["avv"]!.GetValue<string>());
        r = await Saisir(client, HttpMethod.Put, $"{url}/reglages/logoClient", new { valeur = "data:image/png;base64,iVBORw0KGgo=" });
        Assert.StartsWith("data:image/png", r["suivi"]!["projet"]!["pointsHebdo"]!["reglages"]!["logoClient"]!.GetValue<string>());
        r = await Saisir(client, HttpMethod.Put, $"{url}/reglages/avv", new { valeur = "" });
        Assert.Null(r["suivi"]!["projet"]!["pointsHebdo"]!["reglages"]!["avv"]);
    }

    // ------------------------------------------------------------------ droits

    [Fact]
    public async Task Un_consultant_saisit_son_consomme_sans_jamais_recevoir_de_montant()
    {
        var chef = _api.ClientPour("chef");
        var id = await ImporterAsync(chef);
        // saisies du chef qui écrivent des montants dans le journal et dans un commentaire de décision
        await Saisir(chef, HttpMethod.Post, $"/api/projets/{id}/achats", new
        {
            date = "2026-09-20", ligne = (int?)null, designation = "Matériel", fournisseur = "Revendeur", qte = 1m, cu = 500m, refacture = 0m, statut = "Reçu",
        });
        await Saisir(chef, HttpMethod.Post, $"/api/projets/{id}/taches/r14/annulation", new { motif = "Doublon", avenant = true, enregistrerDecision = true });
        // habilitation du consultant (l'écran d'administration des habilitations viendra plus tard)
        var consultant = _api.ClientPour("consultant");
        await consultant.GetAsync("/api/moi"); // crée sa fiche
        await ModifierBaseAsync(async db =>
        {
            var u = await db.Utilisateurs.FirstAsync(x => x.IdentifiantExterne == "oid-consultant");
            db.Habilitations.Add(new Habilitation { ProjetId = id, UtilisateurId = u.Id, Role = RoleProjet.Consultant, Depuis = DateTimeOffset.UtcNow });
        });

        var texte = await consultant.GetStringAsync($"/api/projets/{id}/suivi");
        var suivi = JsonNode.Parse(texte)!.AsObject();
        Assert.False(suivi["droits"]!["voitMontants"]!.GetValue<bool>());
        Assert.True(suivi["droits"]!["peutSaisirConsomme"]!.GetValue<bool>());
        Assert.Null(suivi["modele"]!["financier"]);
        Assert.Null(suivi["modele"]!["synthese"]);
        Assert.Null(suivi["modele"]!["p"]!.AsArray()[0]!["tjm"]);
        Assert.Null(suivi["projet"]!["profiles"]!.AsArray()[0]!["cjm"]);
        Assert.Null(suivi["modele"]!["tasks"]!.AsArray()[0]!["coutPrevu"]);
        foreach (var champ in FiltreMontants.Champs.Concat(FiltreMontants.Blocs))
            Assert.DoesNotContain($"\"{champ}\":", texte);
        // aucun montant en euros, même dans un texte (journal, commentaire écrit par l'application) ; le JSON échappe « € » en \u20AC
        Assert.DoesNotContain("€", JsonNode.Parse(texte)!.ToJsonString(new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
        Assert.NotEmpty(suivi["projet"]!["decisions"]!.AsArray()); // la décision d'annulation reste visible, sans ses montants

        var profil = suivi["projet"]!["profiles"]!.AsArray()[0]!["id"]!.GetValue<Guid>();
        await Saisir(consultant, HttpMethod.Put, $"/api/projets/{id}/taches/r7/consomme", new { profilId = profil, jour = "2026-09-10", jh = 0.5m });
        await Refuser(consultant, HttpMethod.Put, $"/api/projets/{id}/taches/r7/statut", new { statut = "Validé" }, HttpStatusCode.Forbidden);
        await Refuser(consultant, HttpMethod.Post, $"/api/projets/{id}/exports/copil", null, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Le_pilotage_voit_les_montants_mais_ne_modifie_rien()
    {
        var id = await ImporterAsync(_api.ClientPour("chef"));
        var pilotage = _api.ClientPour("pilotage");
        var suivi = await pilotage.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        Assert.True(suivi!["droits"]!["voitMontants"]!.GetValue<bool>());
        Assert.False(suivi["droits"]!["peutModifier"]!.GetValue<bool>());
        Assert.NotNull(suivi["modele"]!["financier"]);
        await Refuser(pilotage, HttpMethod.Put, $"/api/projets/{id}/taches/r7/commentaire", new { commentaire = "x" }, HttpStatusCode.Forbidden);
        // l'export reste possible, sans photo des indicateurs (lecture seule)
        Assert.Equal(HttpStatusCode.OK, (await pilotage.PostAsync($"/api/projets/{id}/exports/copil", null)).StatusCode);
        var apres = await pilotage.GetFromJsonAsync<JsonObject>($"/api/projets/{id}/suivi");
        Assert.Empty(apres!["projet"]!["historique"]!.AsArray());
    }
}
