using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Securite;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>La personne connectée et ce qu'elle peut faire (sert à adapter l'interface).</summary>
[ApiController]
[Authorize]
[Route("api/moi")]
public sealed class MoiController(ServiceAcces acces, IUtilisateurCourant courant) : ControllerBase
{
    [HttpGet]
    public async Task<MoiDto> Obtenir(CancellationToken annulation)
    {
        var u = await acces.UtilisateurAsync(annulation);
        return new MoiDto(u.Id, u.Prenom, u.Nom, u.Email, courant.Roles.ToList(), acces.PeutCreerUnProjet, acces.VoitTousLesProjets);
    }
}

public sealed record MoiDto(Guid Id, string Prenom, string Nom, string Email, IReadOnlyList<string> Roles, bool PeutCreerUnProjet, bool VoitTousLesProjets);
