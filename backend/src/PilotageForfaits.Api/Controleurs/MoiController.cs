using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Api.Authentification;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Application.Suivi;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>La personne connectée et ce qu'elle peut faire (sert à adapter l'interface).</summary>
[ApiController]
[Authorize]
[Route("api/moi")]
public sealed class MoiController(ServiceAcces acces, IUtilisateurCourant courant, PlanningSaisieService planningSaisie) : ControllerBase
{
    [HttpGet]
    public async Task<MoiDto> Obtenir(CancellationToken annulation)
    {
        var u = await acces.UtilisateurAsync(annulation);
        return new MoiDto(u.Id, u.Prenom, u.Nom, u.Email, courant.Roles.ToList(), acces.PeutCreerUnProjet, acces.VoitTousLesProjets);
    }

    /// <summary>
    /// Contrat versionné pour connaître les capacités effectives et les identifiants de projets accessibles.
    /// Il décrit les autorisations côté serveur; il ne remplace pas les contrôles d'accès sur chaque opération.
    /// </summary>
    [HttpGet("capacites")]
    [ProducesResponseType<MoiCapacitesDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<MoiCapacitesDto> ObtenirCapacites(CancellationToken annulation)
    {
        await acces.UtilisateurAsync(annulation);
        var capacites = courant.Capacites
            .Where(c => CapacitesApplication.Toutes.Contains(c, StringComparer.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToArray();
        var projets = await acces.ProjetsAccessiblesAsync(annulation);
        return new MoiCapacitesDto(1, capacites, projets);
    }

    /// <summary>Absences de l'utilisateur courant sur une période inclusive.</summary>
    [HttpGet("absences")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public Task<IReadOnlyList<MonAbsenceDto>> Absences([FromQuery] string du, [FromQuery] string au, CancellationToken annulation)
    {
        if (!DateOnly.TryParseExact(du, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var debut)
            || !DateOnly.TryParseExact(au, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fin))
            throw new RegleMetierException("Les dates du et au doivent être au format AAAA-MM-JJ.");
        return planningSaisie.MesAbsencesAsync(debut, fin, annulation);
    }

    /// <summary>Définit ou efface l'absence de l'utilisateur connecté pour un jour.</summary>
    [HttpPut("absences")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public Task<IReadOnlyList<MonAbsenceDto>> DefinirAbsence(AbsencePersonnelleCommande commande, CancellationToken annulation)
    {
        if (!DateOnly.TryParseExact(commande.Jour, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var jour))
            throw new RegleMetierException("Le jour doit être au format AAAA-MM-JJ.");
        return planningSaisie.DefinirMonAbsenceAsync(jour, commande.Moment, annulation);
    }
}

public sealed record AbsencePersonnelleCommande(string Jour, string Moment);

public sealed record MoiDto(Guid Id, string Prenom, string Nom, string Email, IReadOnlyList<string> Roles, bool PeutCreerUnProjet, bool VoitTousLesProjets);

/// <summary>Contrat stable, version 1, des capacités et du périmètre de lecture de l'utilisateur courant.</summary>
public sealed record MoiCapacitesDto(
    int Version,
    IReadOnlyList<string> Capacites,
    IReadOnlyList<Guid> ProjetsAccessibles);
