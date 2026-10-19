using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Application.Brouillons;
using PilotageForfaits.Application.Exports;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>
/// Brouillons de projet : créer un projet en rédigeant son TSP dans l'application (vierge, depuis un TSP Excel ou depuis un projet),
/// l'enregistrer au fil de la saisie, l'exporter en Excel, puis le lancer.
/// </summary>
[ApiController]
[Authorize]
[Route("api/brouillons")]
public sealed class BrouillonsController(BrouillonsService brouillons) : ControllerBase
{
    /// <summary>Mes brouillons (auteur ou co-rédacteur).</summary>
    [HttpGet]
    public Task<IReadOnlyList<BrouillonResumeDto>> Lister(CancellationToken annulation) => brouillons.ListerAsync(annulation);

    /// <summary>Crée un brouillon vierge, ou repris du TSP vendu d'un projet existant.</summary>
    [HttpPost]
    public async Task<ActionResult<BrouillonCreeReponse>> Creer(CreationBrouillonCommande commande, CancellationToken annulation)
    {
        var id = await brouillons.CreerAsync(commande, annulation);
        return CreatedAtAction(nameof(Obtenir), new { id }, new BrouillonCreeReponse(id));
    }

    /// <summary>Crée un brouillon à partir d'un TSP (.xlsx / .xlsm), à relire avant de lancer le projet.</summary>
    [HttpPost("import-tsp")]
    [RequestSizeLimit(ProjetsController.TailleMaxTsp)]
    public async Task<ActionResult<BrouillonCreeReponse>> Importer(IFormFile fichier, CancellationToken annulation)
    {
        ProjetsController.VerifierFichierTsp(fichier);
        await using var flux = fichier.OpenReadStream();
        var id = await brouillons.ImporterAsync(flux, fichier.FileName, annulation);
        return CreatedAtAction(nameof(Obtenir), new { id }, new BrouillonCreeReponse(id));
    }

    [HttpGet("{id:guid}")]
    public Task<BrouillonDto> Obtenir(Guid id, CancellationToken annulation) => brouillons.LireAsync(id, annulation);

    /// <summary>Enregistre le TSP en cours de rédaction (enregistrement automatique) et renvoie son analyse à jour.</summary>
    [HttpPut("{id:guid}")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public Task<BrouillonEnregistreDto> Enregistrer(Guid id, EnregistrementBrouillonCommande commande, CancellationToken annulation) =>
        brouillons.EnregistrerAsync(id, commande, annulation);

    /// <summary>Invite (adresse e-mail) ou retire (adresse vide) le co-rédacteur.</summary>
    [HttpPut("{id:guid}/co-redacteur")]
    public Task<CoRedacteurReponse> CoRedacteur(Guid id, CoRedacteurCommande commande, CancellationToken annulation) =>
        brouillons.DefinirCoRedacteurAsync(id, commande, annulation);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Supprimer(Guid id, CancellationToken annulation)
    {
        await brouillons.SupprimerAsync(id, annulation);
        return NoContent();
    }

    /// <summary>Le TSP au format Excel (réimportable tel quel).</summary>
    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> Exporter(Guid id, CancellationToken annulation)
    {
        var f = await brouillons.ExporterAsync(id, annulation);
        return File(f.Contenu, FichierExport.TypeXlsx, f.Nom);
    }

    /// <summary>Lance le projet (auteur du brouillon, aucun point bloquant) : renvoie l'identifiant du projet créé.</summary>
    [HttpPost("{id:guid}/lancement")]
    public async Task<ActionResult<ProjetCreeReponse>> Lancer(Guid id, LancementCommande commande, CancellationToken annulation)
    {
        var projet = await brouillons.LancerAsync(id, commande, annulation);
        return Created($"/api/projets/{projet}", new ProjetCreeReponse(projet));
    }
}

public sealed record BrouillonCreeReponse(Guid Id);
