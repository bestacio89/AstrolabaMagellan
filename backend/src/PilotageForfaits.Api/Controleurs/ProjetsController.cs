using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Application.Import;
using PilotageForfaits.Application.Projets;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>Projets : liste selon les habilitations, création d'un projet vide, import d'un TSP, vue d'ensemble.</summary>
[ApiController]
[Authorize]
[Route("api/projets")]
public sealed class ProjetsController(ProjetsService projets, ImportTspService import) : ControllerBase
{
    /// <summary>Taille maximale d'un TSP (20 Mo).</summary>
    public const long TailleMaxTsp = 20 * 1024 * 1024;

    /// <summary>Projets visibles par l'utilisateur connecté, avec leurs indicateurs principaux. ?archives=true : les projets archivés.</summary>
    [HttpGet]
    public Task<IReadOnlyList<ProjetResumeDto>> Lister([FromQuery] bool archives, CancellationToken annulation) => projets.ListerAsync(archives, annulation);

    /// <summary>Archive ou restaure un projet (chef de projet).</summary>
    [HttpPut("{id:guid}/archivage")]
    public async Task<IActionResult> Archiver(Guid id, ArchivageCommande commande, CancellationToken annulation)
    {
        await projets.ArchiverAsync(id, commande, annulation);
        return NoContent();
    }

    /// <summary>Supprime définitivement un projet créé par erreur, sans suivi (chef de projet, nom du projet retapé).</summary>
    [HttpPost("{id:guid}/suppression")]
    public async Task<IActionResult> Supprimer(Guid id, SuppressionCommande commande, CancellationToken annulation)
    {
        await projets.SupprimerAsync(id, commande, annulation);
        return NoContent();
    }

    /// <summary>Vue d'ensemble d'un projet.</summary>
    [HttpGet("{id:guid}")]
    public Task<ProjetDetailDto> Obtenir(Guid id, CancellationToken annulation) => projets.ObtenirAsync(id, annulation);

    /// <summary>Crée un projet vide (V1 : la fiche seule, sans vendu).</summary>
    [HttpPost]
    public async Task<ActionResult<ProjetCreeReponse>> CreerVide(CreerProjetVideRequete requete, CancellationToken annulation)
    {
        var id = await projets.CreerVideAsync(new CreerProjetVideCommande(
            requete.Client!, requete.Nom!, requete.Reference, requete.Debut!.Value, requete.FinContractuelle!.Value, requete.TypeContrat), annulation);
        return CreatedAtAction(nameof(Obtenir), new { id }, new ProjetCreeReponse(id));
    }

    /// <summary>Crée un projet à partir d'un TSP (.xlsx / .xlsm), avec le même comportement que la version de référence.</summary>
    [HttpPost("import-tsp")]
    [RequestSizeLimit(TailleMaxTsp)]
    public async Task<ActionResult<ProjetCreeReponse>> ImporterTsp(IFormFile fichier, CancellationToken annulation)
    {
        VerifierFichierTsp(fichier);
        await using var flux = fichier.OpenReadStream();
        var id = await import.ImporterAsync(flux, fichier.FileName, annulation);
        return CreatedAtAction(nameof(Obtenir), new { id }, new ProjetCreeReponse(id));
    }

    /// <summary>Lit un TSP et décrit ce qui sera repris, sans rien enregistrer.</summary>
    [HttpPost("import-tsp/apercu")]
    [RequestSizeLimit(TailleMaxTsp)]
    public async Task<ApercuImportDto> AnalyserTsp(IFormFile fichier, CancellationToken annulation)
    {
        VerifierFichierTsp(fichier);
        await using var flux = fichier.OpenReadStream();
        return await import.AnalyserAsync(flux, fichier.FileName, annulation);
    }

    /// <summary>Contrôle du fichier envoyé (présent, au format Excel). Partagé avec l'import dans un brouillon.</summary>
    internal static void VerifierFichierTsp(IFormFile? fichier)
    {
        if (fichier is null || fichier.Length == 0) throw new RegleMetierException("Choisissez un fichier TSP.");
        var extension = Path.GetExtension(fichier.FileName).ToLowerInvariant();
        if (extension is not (".xlsx" or ".xlsm")) throw new RegleMetierException("Le TSP doit être un fichier Excel (.xlsx ou .xlsm).");
    }
}

/// <summary>Formulaire « Créer un projet vide ». Les champs marqués [Required] sont obligatoires.</summary>
public sealed class CreerProjetVideRequete
{
    [Required(ErrorMessage = "Le client est obligatoire."), MaxLength(200)]
    public string? Client { get; set; }

    [Required(ErrorMessage = "Le nom du projet est obligatoire."), MaxLength(200)]
    public string? Nom { get; set; }

    [MaxLength(100)]
    public string? Reference { get; set; }

    [Required(ErrorMessage = "La date de début est obligatoire.")]
    public DateOnly? Debut { get; set; }

    [Required(ErrorMessage = "La fin contractuelle est obligatoire.")]
    public DateOnly? FinContractuelle { get; set; }

    [MaxLength(50)]
    public string? TypeContrat { get; set; }
}

public sealed record ProjetCreeReponse(Guid Id);
