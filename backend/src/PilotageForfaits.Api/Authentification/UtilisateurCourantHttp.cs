using System.Security.Claims;
using PilotageForfaits.Application.Abstractions;

namespace PilotageForfaits.Api.Authentification;

/// <summary>
/// Lit l'utilisateur connecté dans le jeton de la requête. Les noms des informations (« claims ») diffèrent selon la
/// configuration du jeton Entra ID : on accepte les deux formes (courte et longue).
/// </summary>
public sealed class UtilisateurCourantHttp(IHttpContextAccessor accesseur) : IUtilisateurCourant
{
    private ClaimsPrincipal? Utilisateur => accesseur.HttpContext?.User;

    private string Valeur(params string[] types) =>
        types.Select(t => Utilisateur?.FindFirst(t)?.Value).FirstOrDefault(v => !string.IsNullOrEmpty(v)) ?? "";

    public bool EstAuthentifie => Utilisateur?.Identity?.IsAuthenticated == true;

    public string IdentifiantExterne => Valeur("oid", "http://schemas.microsoft.com/identity/claims/objectidentifier");

    public string Prenom => Valeur("given_name", ClaimTypes.GivenName);

    public string Nom
    {
        get
        {
            var nom = Valeur("family_name", ClaimTypes.Surname);
            return nom.Length > 0 ? nom : Valeur("name");
        }
    }

    public string Email => Valeur("preferred_username", "email", ClaimTypes.Email, ClaimTypes.Upn);

    public IReadOnlyCollection<string> Roles =>
        (Utilisateur?.Claims ?? [])
            .Where(c => c.Type is "roles" or ClaimTypes.Role)
            .Select(c => c.Value)
            .Distinct()
            .ToList();
}
