using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Application.Projets;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Import;

/// <summary>Ce que l'import va reprendre, montré avant de confirmer.</summary>
public sealed record ApercuImportDto(
    string NomFichier,
    string Client,
    string Projet,
    string? Reference,
    DateOnly? Debut,
    DateOnly? FinContractuelle,
    int NombreTaches,
    int NombreProfils,
    int NombreEcheances,
    int NombreAxes,
    string? SourcePlanning,
    bool BudgetsAchatsFrais,
    IReadOnlyList<string> PointsReleves,
    // projet qui suit déjà ce forfait (l'import sera refusé), ou null
    ProjetExistantDto? ProjetExistant);

/// <summary>
/// Import d'un TSP : reprend exactement le comportement de la version de référence (même lecture, mêmes points relevés),
/// puis enregistre le vendu dans la base. Le vendu n'est plus jamais modifié ensuite.
/// </summary>
public sealed class ImportTspService(
    IContexteDonnees db, ServiceAcces acces, ILecteurTsp lecteur, IHorloge horloge, ServiceJournal journal, UniciteProjet unicite)
{
    /// <summary>Lit le fichier et décrit ce qui sera repris, sans rien enregistrer.</summary>
    public async Task<ApercuImportDto> AnalyserAsync(Stream fichier, string nomFichier, CancellationToken annulation = default)
    {
        await acces.UtilisateurAsync(annulation);
        if (!acces.PeutCreerUnProjet) throw new AccesRefuseException("Vous n'avez pas le droit de créer un projet.");
        var tsp = lecteur.Lire(fichier, nomFichier);
        return new ApercuImportDto(
            nomFichier, tsp.Fiche.Client ?? "", tsp.Fiche.Projet ?? "", NonVide(tsp.Fiche.Reference), tsp.Dates.Debut, tsp.Dates.FinContrat,
            tsp.Tasks.Count(t => !t.Section), tsp.Profiles.Count(p => p.Nom.Length > 0), tsp.Echeancier.Count, tsp.Axes.Count,
            tsp.PlanningSource, tsp.Achats.Count + tsp.Frais.Count + tsp.Prestas.Count > 0, tsp.Warnings,
            await unicite.ChercherAsync(tsp.Fiche.Reference, tsp.Fiche.Client, tsp.Fiche.Projet, null, annulation));
    }

    /// <summary>Lit le fichier, crée le projet et ses objets vendus, et en fait l'utilisateur chef de projet.</summary>
    public async Task<Guid> ImporterAsync(Stream fichier, string nomFichier, CancellationToken annulation = default)
    {
        var utilisateur = await acces.UtilisateurAsync(annulation);
        if (!acces.PeutCreerUnProjet) throw new AccesRefuseException("Vous n'avez pas le droit de créer un projet.");
        var tsp = lecteur.Lire(fichier, nomFichier);
        await unicite.ExigerLibreAsync(tsp.Fiche.Reference, tsp.Fiche.Client, tsp.Fiche.Projet, null, annulation);
        var projet = ConvertisseurTsp.CreerProjet(tsp, nomFichier, utilisateur.Id, horloge.Maintenant, horloge.Aujourdhui);
        projet.Habilitations.Add(new Habilitation
        {
            ProjetId = projet.Id, UtilisateurId = utilisateur.Id, Role = RoleProjet.ChefDeProjet, Depuis = horloge.Maintenant, AccordeeParId = utilisateur.Id,
        });
        db.Projets.Add(projet);
        journal.Noter(projet.Id, utilisateur.Id, "Projet", projet.Id, "Import TSP", null, nomFichier);
        await db.SaveChangesAsync(annulation);
        return projet.Id;
    }

    private static string? NonVide(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
}
