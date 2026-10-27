using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using PilotageForfaits.Application.Abstractions;

namespace PilotageForfaits.Api.Authentification;

/// <summary>
/// Derives application capabilities from roles in the validated API access token.
/// Project membership and project-specific rights remain authoritative in PostgreSQL.
/// </summary>
public sealed class TransformationRolesEntra : IClaimsTransformation
{
    private static readonly string[] CapacitesBase =
    [
        CapacitesApplication.ProjetsLire,
        CapacitesApplication.ProjetsModifier,
        CapacitesApplication.ConsommeSaisir
    ];

    private static readonly IReadOnlyDictionary<string, string[]> CapacitesParRole =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [RolesGlobaux.Manager] =
            [
                CapacitesApplication.ProjetsLireTous,
                CapacitesApplication.ProjetsCreer,
                CapacitesApplication.ProjetsAffecterUtilisateurs,
                CapacitesApplication.UtilisateursLire,
                CapacitesApplication.ExportsFinanciers
            ],
            [RolesGlobaux.Admin] =
            [
                CapacitesApplication.ProjetsLireTous,
                CapacitesApplication.ProjetsAffecterUtilisateurs,
                CapacitesApplication.UtilisateursLire,
                CapacitesApplication.UtilisateursAdministrer
            ]
        };

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return Task.FromResult(principal);

        // Synthetic development identities have explicit capabilities and are only enabled in Development/Tests.
        if (principal.Identities.Any(identity =>
            identity.IsAuthenticated &&
            string.Equals(identity.AuthenticationType, AuthentificationDev.Schema, StringComparison.Ordinal)))
        {
            return Task.FromResult(principal);
        }

        // Capability claims are server-derived and must never be accepted directly from a token.
        foreach (var identity in principal.Identities)
        {
            foreach (var claim in identity.FindAll(CapacitesApplication.TypeClaim).ToArray())
                identity.RemoveClaim(claim);
        }

        var identityCible = principal.Identities.FirstOrDefault(identity => identity.IsAuthenticated);
        if (identityCible is null)
            return Task.FromResult(principal);

        var capacites = new HashSet<string>(CapacitesBase, StringComparer.Ordinal);
        foreach (var role in principal.Claims
            .Where(claim => claim.Type is "roles" or ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Distinct(StringComparer.Ordinal))
        {
            if (CapacitesParRole.TryGetValue(role, out var capacitesRole))
                capacites.UnionWith(capacitesRole);
        }

        foreach (var capacite in capacites.OrderBy(value => value, StringComparer.Ordinal))
            identityCible.AddClaim(new Claim(CapacitesApplication.TypeClaim, capacite));

        return Task.FromResult(principal);
    }
}
