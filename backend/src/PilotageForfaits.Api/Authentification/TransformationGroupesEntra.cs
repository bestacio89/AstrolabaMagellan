using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;

namespace PilotageForfaits.Api.Authentification;

/// <summary>
/// Traduit les groupes Entra validés en capacités configurées côté serveur.
/// Les groupes et capacités déclarés par le client ne sont jamais pris comme source de décision.
/// En cas de group overage, aucune capacité dérivée des groupes n'est accordée.
/// </summary>
public sealed class TransformationGroupesEntra(IConfiguration configuration) : IClaimsTransformation
{
    public const string TypeCapacite = "capability";
    private const string TypeGroupe = "groups";
    private const string TypeNomsClaims = "_claim_names";
    private const string TypeGroupesPresence = "hasgroups";

    private readonly Lazy<IReadOnlyDictionary<string, IReadOnlySet<string>>> _capacitesParGroupe =
        new(ChargerMapping);

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return Task.FromResult(principal);

        // Development authentication is only enabled in Development/Tests. Its configured capabilities are test/local fixtures,
        // not Entra token claims, so preserve them instead of replacing them with group-derived claims.
        if (principal.Identities.Any(i => i.IsAuthenticated
            && string.Equals(i.AuthenticationType, AuthentificationDev.Schema, StringComparison.Ordinal)))
            return Task.FromResult(principal);

        // Never trust capability claims supplied by the token itself; rebuild them from the server-side group mapping.
        foreach (var identiteExistante in principal.Identities)
        {
            foreach (var claim in identiteExistante.FindAll(TypeCapacite).ToArray())
                identiteExistante.RemoveClaim(claim);
        }

        if (GroupesEnDepassement(principal))
            return Task.FromResult(principal);

        var identite = principal.Identities.FirstOrDefault(i => i.IsAuthenticated);
        if (identite is null) return Task.FromResult(principal);
        var capacitesAjoutees = new HashSet<string>(StringComparer.Ordinal);

        foreach (var groupe in principal.FindAll(TypeGroupe).Select(c => c.Value).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!_capacitesParGroupe.Value.TryGetValue(groupe, out var capacites))
                continue;

            foreach (var capacite in capacites)
            {
                if (capacitesAjoutees.Add(capacite))
                    identite.AddClaim(new Claim(TypeCapacite, capacite));
            }
        }

        return Task.FromResult(principal);
    }

    private IReadOnlyDictionary<string, IReadOnlySet<string>> ChargerMapping()
    {
        var resultat = new Dictionary<string, IReadOnlySet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var groupe in configuration.GetSection("AutorisationEntra:GroupesCapacites").GetChildren())
        {
            if (!Guid.TryParse(groupe.Key, out var groupeId))
                throw new InvalidOperationException(
                    $"La clé '{groupe.Key}' de AutorisationEntra:GroupesCapacites doit être un identifiant d'objet de groupe Entra (GUID).");

            var valeurs = groupe.Get<string[]>() ?? [];
            var capacites = new HashSet<string>(StringComparer.Ordinal);
            foreach (var valeur in valeurs)
            {
                if (!CapacitesApplication.Toutes.Contains(valeur, StringComparer.Ordinal))
                    throw new InvalidOperationException(
                        $"La capacité '{valeur}' associée au groupe Entra '{groupeId:D}' n'est pas reconnue.");
                capacites.Add(valeur);
            }

            resultat[groupeId.ToString("D")] = capacites;
        }

        return resultat;
    }

    private static bool GroupesEnDepassement(ClaimsPrincipal principal)
    {
        // Entra may omit the groups list when group membership exceeds token limits.
        if (principal.Claims.Any(c => c.Type.Equals(TypeGroupesPresence, StringComparison.OrdinalIgnoreCase)))
            return true;

        foreach (var claim in principal.FindAll(TypeNomsClaims))
        {
            try
            {
                using var document = JsonDocument.Parse(claim.Value);
                if (document.RootElement.ValueKind == JsonValueKind.Object
                    && document.RootElement.TryGetProperty(TypeGroupe, out _))
                    return true;
            }
            catch (JsonException)
            {
                // A malformed overage marker is not evidence of a complete group list.
                return true;
            }
        }

        return false;
    }
}
