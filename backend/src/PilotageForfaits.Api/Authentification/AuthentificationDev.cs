using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace PilotageForfaits.Api.Authentification;

/// <summary>Un utilisateur fictif, pour travailler en local sans Entra ID (déclaré dans appsettings.Development.json).</summary>
public sealed class UtilisateurDev
{
    public string Cle { get; set; } = "";
    public string Oid { get; set; } = "";
    public string Prenom { get; set; } = "";
    public string Nom { get; set; } = "";
    public string Email { get; set; } = "";
    public List<string> Roles { get; set; } = new();
}

public sealed class OptionsAuthentificationDev : AuthenticationSchemeOptions
{
    public List<UtilisateurDev> Utilisateurs { get; set; } = new();
}

/// <summary>
/// Authentification de DÉVELOPPEMENT uniquement : l'utilisateur est choisi par l'en-tête « X-Utilisateur-Dev »
/// (sinon le premier de la liste). Interdite hors environnement de développement ou de test (contrôle dans Program.cs).
/// </summary>
public sealed class AuthentificationDev(IOptionsMonitor<OptionsAuthentificationDev> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<OptionsAuthentificationDev>(options, logger, encoder)
{
    public const string Schema = "Dev";
    public const string EnTete = "X-Utilisateur-Dev";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var cle = Request.Headers[EnTete].FirstOrDefault();
        var u = string.IsNullOrEmpty(cle) ? Options.Utilisateurs.FirstOrDefault() : Options.Utilisateurs.FirstOrDefault(x => x.Cle == cle);
        if (u is null) return Task.FromResult(AuthenticateResult.Fail("Utilisateur de développement inconnu."));
        var claims = new List<Claim>
        {
            new("oid", u.Oid),
            new("given_name", u.Prenom),
            new("family_name", u.Nom),
            new("preferred_username", u.Email),
            new("name", $"{u.Prenom} {u.Nom}".Trim()),
        };
        claims.AddRange(u.Roles.Select(r => new Claim("roles", r)));
        var identite = new ClaimsIdentity(claims, Schema, "name", "roles");
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identite), Schema)));
    }
}
