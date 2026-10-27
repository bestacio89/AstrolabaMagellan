using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Application.Securite;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>Répertoire minimal des utilisateurs connus de l'application, réservé aux responsables habilités.</summary>
[ApiController]
[Authorize(Policy = "capacite:utilisateurs.lire")]
[Route("api/utilisateurs")]
public sealed class UtilisateursController(HabilitationsService habilitations) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public Task<IReadOnlyList<UtilisateurAffectationDto>> Lister(CancellationToken annulation) =>
        habilitations.ListerUtilisateursAsync(annulation);

    [HttpPut("{utilisateurId:guid}/activation")]
    [Authorize(Policy = "capacite:utilisateurs.administrer")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DefinirActif(
        Guid utilisateurId,
        [FromBody] ActivationUtilisateurRequete requete,
        CancellationToken annulation)
    {
        await habilitations.DefinirActifAsync(utilisateurId, requete.Actif, annulation);
        return NoContent();
    }
}

public sealed record ActivationUtilisateurRequete(bool Actif);
