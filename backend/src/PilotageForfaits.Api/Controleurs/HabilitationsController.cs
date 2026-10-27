using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>Affectations de projet et liaison des profils à un compte utilisateur stable.</summary>
[ApiController]
[Authorize(Policy = "capacite:projets.affecter-utilisateurs")]
[Route("api/projets/{projetId:guid}/habilitations")]
public sealed class HabilitationsController(HabilitationsService habilitations) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public Task<IReadOnlyList<HabilitationProjetDto>> Lister(Guid projetId, CancellationToken annulation) =>
        habilitations.ListerAsync(projetId, annulation);

    [HttpPut("{utilisateurId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Affecter(
        Guid projetId,
        Guid utilisateurId,
        [FromBody] AffectationRoleProjetRequete requete,
        CancellationToken annulation)
    {
        await habilitations.AffecterAsync(projetId, utilisateurId, requete.Role, annulation);
        return NoContent();
    }

    [HttpDelete("{utilisateurId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Retirer(Guid projetId, Guid utilisateurId, CancellationToken annulation)
    {
        await habilitations.RetirerAsync(projetId, utilisateurId, annulation);
        return NoContent();
    }

    [HttpPut("profils/{profilId:guid}/utilisateur")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AffecterProfil(
        Guid projetId,
        Guid profilId,
        [FromBody] AffectationProfilRequete requete,
        CancellationToken annulation)
    {
        await habilitations.AffecterProfilAsync(projetId, profilId, requete.UtilisateurId, annulation);
        return NoContent();
    }
}

public sealed record AffectationRoleProjetRequete(RoleProjet Role);
public sealed record AffectationProfilRequete(Guid? UtilisateurId);
