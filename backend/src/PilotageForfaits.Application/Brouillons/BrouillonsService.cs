using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Application.Projets;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Brouillons;

/// <summary>
/// Créer un projet en rédigeant son TSP dans l'application : brouillon privé, enregistré au fil de la saisie, puis lancé.
/// - Un brouillon naît vierge, d'un TSP Excel importé, ou du TSP vendu d'un projet existant.
/// - Seuls son auteur et le co-rédacteur qu'il invite le voient (ni liste de projets, ni portefeuille).
/// - Le lancement passe par la lecture d'un TSP importé (voir <see cref="RedactionTsp"/>) : il est refusé tant qu'un contrôle
///   est bloquant, et le forfait doit être unique (même règle que l'import). L'auteur devient chef de projet ; le co-rédacteur
///   suit le projet en lecture, montants compris. Le brouillon est alors supprimé.
/// </summary>
public sealed class BrouillonsService(
    IContexteDonnees db, ServiceAcces acces, IHorloge horloge, UniciteProjet unicite, ILecteurTsp lecteur,
    ConstructeurProjetCalcul constructeur, IEcrivainClasseur ecrivain, ServiceJournal journal)
{
    /// <summary>Format d'enregistrement du contenu (mêmes noms qu'à l'écran).</summary>
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Tailles maximales d'un TSP (bien au-delà des TSP réels : ~100 lignes, 10 profils) : protègent le serveur d'un envoi démesuré.
    private const int MaxProfils = 60, MaxTaches = 3000, MaxLignes = 300, MaxMois = 120;
    private const int TexteCourt = 400, TexteLong = 4000;

    /// <summary>Brouillons de l'utilisateur connecté (auteur ou co-rédacteur), les plus récents d'abord.</summary>
    public async Task<IReadOnlyList<BrouillonResumeDto>> ListerAsync(CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var brouillons = await db.Brouillons.AsNoTracking().Include(b => b.CreePar).Include(b => b.CoRedacteur)
            .Where(b => b.CreeParId == u.Id || b.CoRedacteurId == u.Id).ToListAsync(annulation);
        var noms = await NomsAsync(brouillons.Select(b => b.ModifieParId), annulation);
        // tri en mémoire : certaines bases (SQLite des tests) ne savent pas trier des dates avec fuseau horaire
        return brouillons.OrderByDescending(b => b.ModifieLe).Select(b => new BrouillonResumeDto(
            b.Id, b.Client, b.Nom, b.Reference, Libelles.De(b.Origine), b.Origine.ToString(), b.ModifieLe,
            b.ModifieParId is { } m ? noms.GetValueOrDefault(m) : null, b.CreePar?.NomComplet ?? "", b.CoRedacteur?.NomComplet, b.CreeParId == u.Id)).ToList();
    }

    /// <summary>Crée un brouillon vierge, ou repris du TSP vendu d'un projet existant (« ProjetSource »).</summary>
    public async Task<Guid> CreerAsync(CreationBrouillonCommande commande, CancellationToken annulation = default)
    {
        var u = await ExigerCreationAsync(annulation);
        var client = (commande.Client ?? "").Trim();
        var projet = (commande.Projet ?? "").Trim();
        var reference = string.IsNullOrWhiteSpace(commande.Reference) ? null : commande.Reference.Trim();
        if (client.Length == 0 || projet.Length == 0) throw new RegleMetierException("Le client et le nom du projet sont obligatoires.");
        await ExigerForfaitLibreAsync(reference, client, projet, null, u, annulation);

        TspSaisi contenu;
        var origine = OrigineBrouillon.Vierge;
        string? source = null;
        if (commande.ProjetSource is { } idSource)
        {
            var role = await acces.ExigerAccesAsync(idSource, annulation);
            if (!ServiceAcces.VoitMontants(role))
                throw new AccesRefuseException("Repartir d'un projet reprend ses prix : réservé au chef de projet et au pilotage de ce projet.");
            var donnees = await constructeur.ChargerDonneesAsync(idSource, annulation);
            contenu = RedactionTsp.DepuisProjet(donnees, client, projet, reference);
            origine = OrigineBrouillon.Copie;
            source = Tronquer($"{donnees.Projet.Client} — {donnees.Projet.Nom}", 400);
        }
        else contenu = ModeleTsp.Vierge(client, projet, reference);
        return await AjouterAsync(contenu, origine, source, u, annulation);
    }

    /// <summary>Crée un brouillon à partir d'un TSP Excel : tout ce qui se saisit dans un TSP est repris, à relire avant le lancement.</summary>
    public async Task<Guid> ImporterAsync(Stream fichier, string nomFichier, CancellationToken annulation = default)
    {
        var u = await ExigerCreationAsync(annulation);
        var lu = lecteur.Lire(fichier, nomFichier);
        await ExigerForfaitLibreAsync(lu.Fiche.Reference, lu.Fiche.Client, lu.Fiche.Projet, null, u, annulation);
        return await AjouterAsync(RedactionTsp.DepuisTsp(lu), OrigineBrouillon.ImportTsp, Tronquer(nomFichier, 400), u, annulation);
    }

    /// <summary>Un brouillon ouvert : son contenu et son analyse.</summary>
    public async Task<BrouillonDto> LireAsync(Guid id, CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var b = await db.Brouillons.AsNoTracking().Include(x => x.CreePar).Include(x => x.CoRedacteur).FirstOrDefaultAsync(x => x.Id == id, annulation);
        if (b is null || !b.EstOuvertA(u.Id)) throw new IntrouvableException("Brouillon introuvable.");
        var contenu = Lire(b);
        var noms = await NomsAsync([b.ModifieParId], annulation);
        return new BrouillonDto(
            b.Id, b.Version, contenu, Libelles.De(b.Origine), b.Origine.ToString(), b.Source, Personne(b.CreePar!),
            b.CoRedacteur is null ? null : Personne(b.CoRedacteur), b.CreeParId == u.Id, b.ModifieLe,
            b.ModifieParId is { } m ? noms.GetValueOrDefault(m) : null,
            await AnalyserAsync(contenu, b.CreePar!.NomComplet, annulation),
            new SuggestionsDto(ReferentielsMetier.Entites, ModeleTsp.Profils, ModeleTsp.TypesAchat, ["Forfait"]));
    }

    /// <summary>
    /// Enregistre le TSP complet (enregistrement automatique pendant la saisie) et renvoie son analyse à jour.
    /// Refusé si quelqu'un a enregistré entre-temps (autre onglet, co-rédacteur) : rien n'est écrasé sans le savoir.
    /// </summary>
    public async Task<BrouillonEnregistreDto> EnregistrerAsync(Guid id, EnregistrementBrouillonCommande commande, CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var b = await ChargerOuvertAsync(id, u, annulation);
        if (commande.Contenu is null) throw new RegleMetierException("Contenu du brouillon manquant.");
        await ExigerVersionAsync(b, commande.Version, annulation);
        var contenu = Normaliser(commande.Contenu);
        Ecrire(b, contenu, u);
        await db.SaveChangesAsync(annulation);
        var auteur = (await db.Utilisateurs.AsNoTracking().FirstAsync(x => x.Id == b.CreeParId, annulation)).NomComplet;
        return new BrouillonEnregistreDto(b.Version, b.ModifieLe, await AnalyserAsync(contenu, auteur, annulation));
    }

    /// <summary>Invite un co-rédacteur par son adresse e-mail (il doit s'être connecté au moins une fois), ou le retire (adresse vide).</summary>
    public async Task<CoRedacteurReponse> DefinirCoRedacteurAsync(Guid id, CoRedacteurCommande commande, CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var b = await ChargerOuvertAsync(id, u, annulation);
        if (b.CreeParId != u.Id) throw new AccesRefuseException("Seul l'auteur du brouillon peut inviter ou retirer un co-rédacteur.");
        var email = (commande.Email ?? "").Trim();
        if (email.Length == 0)
        {
            b.CoRedacteurId = null;
            await db.SaveChangesAsync(annulation);
            return new CoRedacteurReponse(null, b.Version);
        }
        var minuscules = email.ToLowerInvariant();
        var invite = await db.Utilisateurs.FirstOrDefaultAsync(x => x.Email.ToLower() == minuscules && x.Actif, annulation)
            ?? throw new RegleMetierException($"Personne n'utilise encore l'application avec l'adresse « {email} » : elle doit s'y être connectée au moins une fois.");
        if (invite.Id == u.Id) throw new RegleMetierException("Vous êtes déjà l'auteur de ce brouillon.");
        b.CoRedacteurId = invite.Id;
        await db.SaveChangesAsync(annulation);
        // la version du brouillon a changé : l'écran la reprend pour ses prochains enregistrements
        return new CoRedacteurReponse(Personne(invite), b.Version);
    }

    /// <summary>Supprime un brouillon (son auteur seulement). Rien n'a encore été créé : aucune trace à garder.</summary>
    public async Task SupprimerAsync(Guid id, CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var b = await ChargerOuvertAsync(id, u, annulation);
        if (b.CreeParId != u.Id) throw new AccesRefuseException("Seul l'auteur du brouillon peut le supprimer.");
        db.Brouillons.Remove(b);
        await db.SaveChangesAsync(annulation);
    }

    /// <summary>Le TSP au format Excel, à tout moment (mêmes onglets que le modèle, avec les formules de totaux ; réimportable tel quel).</summary>
    public async Task<FichierExport> ExporterAsync(Guid id, CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var b = await ChargerOuvertAsync(id, u, annulation);
        var contenu = Lire(b);
        var auteur = (await db.Utilisateurs.AsNoTracking().FirstAsync(x => x.Id == b.CreeParId, annulation)).NomComplet;
        ResultatCalcul? calcul = null;
        try { calcul = RedactionTsp.Calculer(contenu, Contexte(auteur), horloge.Maintenant); }
        catch (RegleMetierException) { /* TSP encore incomplet : export sans synthèse */ }
        var feuilles = ClasseurTsp.Feuilles(contenu, Contexte(auteur) with { Calcul = calcul });
        var f = contenu.Fiche;
        var nom = string.IsNullOrWhiteSpace(f.Reference)
            ? $"{ExportsService.NomFichier(f.Client, "Client")} - {ExportsService.NomFichier(f.Projet, "Projet")} - TSP.xlsx"
            : $"{ExportsService.NomFichier(f.Reference, "TSP")}.xlsx";
        return new FichierExport(ecrivain.Ecrire(feuilles), nom);
    }

    /// <summary>
    /// Lance le projet : refusé tant qu'un contrôle est bloquant ou que le forfait est déjà suivi. Réservé à l'auteur du brouillon,
    /// qui devient chef de projet. Le TSP devient la référence vendue ; le brouillon est supprimé.
    /// </summary>
    public async Task<Guid> LancerAsync(Guid id, LancementCommande commande, CancellationToken annulation = default)
    {
        var u = await acces.UtilisateurAsync(annulation);
        var b = await ChargerOuvertAsync(id, u, annulation);
        if (b.CreeParId != u.Id) throw new AccesRefuseException("Seul l'auteur du brouillon peut lancer le projet : il en devient le chef de projet.");
        if (!acces.PeutCreerUnProjet) throw new AccesRefuseException("Vous n'avez pas le droit de créer un projet.");
        await ExigerVersionAsync(b, commande.Version, annulation);
        var contenu = Lire(b);
        var analyse = await AnalyserAsync(contenu, u.NomComplet, annulation);
        var bloquants = analyse.Controles.Where(c => c.Niveau == AnalyseBrouillon.Bloquant).Select(c => c.Titre).ToList();
        if (bloquants.Count > 0)
            throw new RegleMetierException($"Le projet ne peut pas encore être lancé ({bloquants.Count} point(s) à corriger) : {string.Join(" ", bloquants)}");

        var projet = RedactionTsp.CreerProjet(contenu, Contexte(u.NomComplet), u.Id, horloge.Maintenant);
        projet.Habilitations.Add(new Habilitation
        {
            ProjetId = projet.Id, UtilisateurId = u.Id, Role = RoleProjet.ChefDeProjet, Depuis = horloge.Maintenant, AccordeeParId = u.Id,
        });
        if (b.CoRedacteurId is { } co)
            projet.Habilitations.Add(new Habilitation
            {
                ProjetId = projet.Id, UtilisateurId = co, Role = RoleProjet.Pilotage, Depuis = horloge.Maintenant, AccordeeParId = u.Id,
            });
        db.Projets.Add(projet);
        journal.Noter(projet.Id, u.Id, "Projet", projet.Id, "Lancement", null,
            b.Origine == OrigineBrouillon.ImportTsp && b.Source is not null ? $"{RedactionTsp.NomSource} (repris de {b.Source})" : RedactionTsp.NomSource);
        db.Brouillons.Remove(b);
        await db.SaveChangesAsync(annulation);
        return projet.Id;
    }

    // ---------- outils ----------

    private ClasseurTsp.Contexte Contexte(string auteur) => new(auteur, horloge.Aujourdhui);

    private async Task<AnalyseBrouillonDto> AnalyserAsync(TspSaisi contenu, string auteur, CancellationToken annulation)
    {
        var f = contenu.Fiche;
        var existant = string.IsNullOrWhiteSpace(f.Client) || string.IsNullOrWhiteSpace(f.Projet)
            ? null
            : await unicite.ChercherAsync(f.Reference, f.Client, f.Projet, null, annulation);
        return AnalyseBrouillon.Analyser(contenu, Contexte(auteur), horloge.Maintenant, existant);
    }

    private async Task<Utilisateur> ExigerCreationAsync(CancellationToken annulation)
    {
        var u = await acces.UtilisateurAsync(annulation);
        if (!acces.PeutCreerUnProjet) throw new AccesRefuseException("Vous n'avez pas le droit de créer un projet.");
        return u;
    }

    /// <summary>Un forfait n'est créé qu'une fois : ni projet existant (même règle que l'import), ni autre brouillon en cours.</summary>
    private async Task ExigerForfaitLibreAsync(string? reference, string? client, string? nom, Guid? sauf, Utilisateur u, CancellationToken annulation)
    {
        await unicite.ExigerLibreAsync(reference, client, nom, null, annulation);
        if (string.IsNullOrWhiteSpace(client) && string.IsNullOrWhiteSpace(nom)) return;
        var cle = IdentiteProjet.Cle(reference, client, nom);
        // peu de brouillons à la fois : la comparaison se fait en mémoire, avec exactement la règle d'identité des projets
        var autres = await db.Brouillons.AsNoTracking().Include(b => b.CreePar).Where(b => sauf == null || b.Id != sauf).ToListAsync(annulation);
        var meme = autres.FirstOrDefault(b => IdentiteProjet.Cle(b.Reference, b.Client, b.Nom) == cle);
        if (meme is null) return;
        throw new RegleMetierException(meme.EstOuvertA(u.Id)
            ? $"Vous avez déjà un brouillon pour ce forfait (« {meme.Client} — {meme.Nom} ») : reprenez-le depuis l'accueil."
            : $"Un brouillon existe déjà pour ce forfait, rédigé par {meme.CreePar?.NomComplet}. Demandez-lui de vous inviter comme co-rédacteur.");
    }

    private async Task<Guid> AjouterAsync(TspSaisi contenu, OrigineBrouillon origine, string? source, Utilisateur u, CancellationToken annulation)
    {
        var b = new BrouillonProjet { Origine = origine, Source = source, CreeParId = u.Id, CreeLe = horloge.Maintenant };
        Ecrire(b, Normaliser(contenu), u);
        db.Brouillons.Add(b);
        await db.SaveChangesAsync(annulation);
        return b.Id;
    }

    private void Ecrire(BrouillonProjet b, TspSaisi contenu, Utilisateur u)
    {
        b.Contenu = JsonSerializer.Serialize(contenu, Json);
        b.Client = contenu.Fiche.Client;
        b.Nom = contenu.Fiche.Projet;
        b.Reference = string.IsNullOrWhiteSpace(contenu.Fiche.Reference) ? null : contenu.Fiche.Reference;
        b.ModifieLe = horloge.Maintenant;
        b.ModifieParId = u.Id;
    }

    private static TspSaisi Lire(BrouillonProjet b) => JsonSerializer.Deserialize<TspSaisi>(b.Contenu, Json) ?? new TspSaisi();

    private async Task<BrouillonProjet> ChargerOuvertAsync(Guid id, Utilisateur u, CancellationToken annulation)
    {
        var b = await db.Brouillons.FirstOrDefaultAsync(x => x.Id == id, annulation);
        if (b is null || !b.EstOuvertA(u.Id)) throw new IntrouvableException("Brouillon introuvable.");
        return b;
    }

    private async Task ExigerVersionAsync(BrouillonProjet b, int version, CancellationToken annulation)
    {
        if (version == b.Version) return;
        var par = b.ModifieParId is { } m ? (await NomsAsync([m], annulation)).GetValueOrDefault(m) : null;
        throw new ConflitException(
            $"Ce brouillon a été modifié entre-temps{(par is null ? "" : $" par {par}")} : rechargez-le pour reprendre la dernière version.");
    }

    private async Task<Dictionary<Guid, string>> NomsAsync(IEnumerable<Guid?> ids, CancellationToken annulation)
    {
        var liste = ids.Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        if (liste.Count == 0) return new Dictionary<Guid, string>();
        return (await db.Utilisateurs.AsNoTracking().Where(x => liste.Contains(x.Id)).ToListAsync(annulation)).ToDictionary(x => x.Id, x => x.NomComplet);
    }

    private static string Tronquer(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";

    private static PersonneDto Personne(Utilisateur x) => new(x.Id, x.NomComplet, x.Email);

    /// <summary>
    /// Remet en ordre un contenu reçu de l'écran : textes sans espaces autour, identifiants présents et uniques, charges et planning
    /// rattachés à des profils existants, entités connues, tailles raisonnables. Un texte trop long est refusé avec un message clair.
    /// </summary>
    public static TspSaisi Normaliser(TspSaisi t)
    {
        // listes absentes de l'envoi (null) : vides
        t.Fiche ??= new FicheSaisie();
        t.Profils ??= new List<ProfilSaisi>();
        t.Taches ??= new List<TacheSaisie>();
        t.Planning ??= new Dictionary<string, Dictionary<string, decimal>>();
        t.Echeances ??= new List<EcheanceSaisie>();
        t.Achats ??= new List<AchatSaisi>();
        t.Prestataires ??= new List<PrestataireSaisi>();
        t.Frais ??= new List<FraisSaisi>();
        t.Metrique ??= new List<MetriqueSaisie>();
        t.Phases ??= new List<string>();
        t.Etapes ??= new List<string>();
        if (t.Profils.Count > MaxProfils) throw new RegleMetierException($"{MaxProfils} profils au maximum.");
        if (t.Taches.Count > MaxTaches) throw new RegleMetierException($"{MaxTaches} lignes de workload au maximum.");
        if (t.Echeances.Count > MaxLignes || t.Achats.Count > MaxLignes || t.Prestataires.Count > MaxLignes || t.Frais.Count > MaxLignes
            || t.Metrique.Count > MaxLignes || t.Phases.Count > MaxLignes || t.Etapes.Count > MaxLignes)
            throw new RegleMetierException($"{MaxLignes} lignes au maximum par liste.");

        string Court(string? s, string quoi)
        {
            var v = (s ?? "").Trim();
            if (v.Length > TexteCourt) throw new RegleMetierException($"{quoi} : {TexteCourt} caractères au maximum.");
            return v;
        }
        string Long(string? s, string quoi)
        {
            var v = (s ?? "").Trim();
            if (v.Length > TexteLong) throw new RegleMetierException($"{quoi} : {TexteLong} caractères au maximum.");
            return v;
        }
        static decimal Positif(decimal v) => v < 0 ? 0 : v;
        var vus = new HashSet<string>();
        string Id(string? id, string prefixe)
        {
            var v = (id ?? "").Trim();
            if (v.Length == 0 || v.Length > 40 || !vus.Add(v))
            {
                var k = vus.Count + 1;
                while (!vus.Add(v = $"{prefixe}{k}")) k++;
            }
            return v;
        }

        // premier profil d'un identifiant : il le garde ; un doublon ou un identifiant vide en reçoit un nouveau
        Dictionary<string, string>? renommageProfils = null;
        string Renommer(string? id)
        {
            var nouveau = Id(id, "p");
            renommageProfils ??= new Dictionary<string, string>();
            if (id is not null && !renommageProfils.ContainsKey(id)) renommageProfils[id] = nouveau;
            return nouveau;
        }

        var f = t.Fiche;
        var fiche = new FicheSaisie
        {
            Client = Court(f.Client, "Client"), Projet = Court(f.Projet, "Projet"), Reference = Court(f.Reference, "Référence"), Contact = Court(f.Contact, "Contact"),
            Agence = Court(f.Agence, "Agence"), ServiceLine = Court(f.ServiceLine, "Service line"), Directeur = Court(f.Directeur, "Directeur d'agence"),
            ResponsableSL = Court(f.ResponsableSL, "Responsable SL"), Commercial = Court(f.Commercial, "Commercial"),
            TypeContrat = string.IsNullOrWhiteSpace(f.TypeContrat) ? "Forfait" : Court(f.TypeContrat, "Type de contrat"), Debut = f.Debut, Fin = f.Fin,
        };
                var profils = t.Profils.Select(p => new ProfilSaisi
        {
            Id = Renommer(p.Id), Nom = Court(p.Nom, "Nom du profil"),
            Entite = ReferentielsMetier.Entites.FirstOrDefault(e => e == (p.Entite ?? "").Trim().ToUpperInvariant()) ?? "FO",
            Tjm = Positif(p.Tjm), Cjm = Positif(p.Cjm), Prcs = p.Prcs is { } prcs ? Positif(prcs) : null, Frais = Positif(p.Frais),
            Collaborateur = Court(p.Collaborateur, "Collaborateur"),
        }).ToList();
        var ids = profils.Select(p => p.Id).ToHashSet();
        // charges et planning suivent le profil, même si son identifiant a dû être changé (doublon, vide)
        string? Profil(string cle) => renommageProfils is not null && renommageProfils.TryGetValue(cle, out var nouveau) ? nouveau : null;
        var taches = t.Taches.Select(x => x.Separateur
            // séparateur : un titre, sans charge ; il garde son axe et son lot (le Planning en fait une sous-partie de cet axe)
            ? new TacheSaisie { Id = Id(x.Id, "t"), Axe = Court(x.Axe, "Axe"), Lot = Court(x.Lot, "Lot"), Libelle = Court(x.Libelle, "Séparateur"), Separateur = true }
            : new TacheSaisie
        {
            Id = Id(x.Id, "t"), Axe = Court(x.Axe, "Axe"), Lot = Court(x.Lot, "Lot"), Phase = Court(x.Phase, "Phase").ToUpperInvariant(),
            Etape = Court(x.Etape, "Étape"), Libelle = Court(x.Libelle, "Libellé de tâche"),
            Charges = (x.Charges ?? new Dictionary<string, decimal>()).Where(c => Profil(c.Key) is not null && c.Value != 0)
                .GroupBy(c => Profil(c.Key)!).ToDictionary(g => g.Key, g => Math.Round(g.Sum(c => c.Value), 6)),
            Livrable = x.Livrable, Hypothese = Long(x.Hypothese, "Hypothèse"),
        }).ToList();
        var planning = t.Planning
            .Where(p => Profil(p.Key) is not null && !string.IsNullOrEmpty(p.Key))
            .GroupBy(p => Profil(p.Key)!).Select(g => g.First())
            .Select(p => (Key: Profil(p.Key)!, Mois: (p.Value ?? new Dictionary<string, decimal>()).Where(m => ClasseurTsp.MoisValide(m.Key) && m.Value != 0).Take(MaxMois)
                .ToDictionary(m => m.Key, m => Math.Round(m.Value, 6))))
            .Where(p => p.Mois.Count > 0)
            .ToDictionary(p => p.Key, p => p.Mois);
        return new TspSaisi
        {
            Format = 1, Fiche = fiche, Remise = Math.Clamp(t.Remise, 0, 1), Profils = profils, Taches = taches, Planning = planning,
            Echeances = t.Echeances.Select(e => new EcheanceSaisie
            {
                Id = Id(e.Id, "e"), Nom = Court(e.Nom, "Nom d'échéance"), Pct = Math.Clamp(e.Pct, 0, 1), Mois = ClasseurTsp.MoisValide(e.Mois) ? e.Mois : null,
            }).ToList(),
            Achats = t.Achats.Select(a => new AchatSaisi
            {
                Id = Id(a.Id, "a"), Designation = Court(a.Designation, "Achat"), Type = Court(a.Type, "Type d'achat"), Cu = Positif(a.Cu), Qte = Positif(a.Qte),
                Revente = Positif(a.Revente), Commentaire = Long(a.Commentaire, "Commentaire"),
            }).ToList(),
            Prestataires = t.Prestataires.Select(p => new PrestataireSaisi
            {
                Id = Id(p.Id, "s"), Designation = Court(p.Designation, "Prestation"), Societe = Court(p.Societe, "Société"), CoutJour = Positif(p.CoutJour),
                Nbj = Positif(p.Nbj), Tjm = Positif(p.Tjm), Commentaire = Long(p.Commentaire, "Commentaire"),
            }).ToList(),
            Frais = t.Frais.Select(x => new FraisSaisi
            {
                Id = Id(x.Id, "f"), Libelle = Court(x.Libelle, "Frais"), Cu = Positif(x.Cu), Qte = Positif(x.Qte), Refacture = Positif(x.Refacture),
                Commentaire = Long(x.Commentaire, "Commentaire"),
            }).ToList(),
            Metrique = t.Metrique.Where(m => !string.IsNullOrWhiteSpace(m.Etape))
                .Select(m => new MetriqueSaisie { Etape = Court(m.Etape, "Étape de la métrique"), Pct = Positif(m.Pct) }).ToList(),
            Phases = t.Phases.Select(p => Court(p, "Phase").ToUpperInvariant()).Where(p => p.Length > 0).Distinct().ToList(),
            Etapes = t.Etapes.Select(e => Court(e, "Étape")).Where(e => e.Length > 0).Distinct().ToList(),
        };
    }
}
