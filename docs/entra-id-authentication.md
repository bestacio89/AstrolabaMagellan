# Microsoft Entra ID authentication

## Runtime behavior

The API uses Microsoft Entra ID JWT bearer authentication by default. The authorization fallback policy requires an authenticated principal for every matched endpoint unless the endpoint explicitly opts out with `AllowAnonymous()`. The current public health endpoint is `GET /api/sante`.

The development identity handler is intentionally separate. It is selected only when `Authentification:Mode` is `Dev`, and the API refuses that mode unless the host environment is `Development` or `Tests`. Do not set this mode in staging or production.

## Required API configuration

Supply these values through deployment environment variables, a secret store, or local .NET user-secrets; do not commit tenant-specific values or credentials.

| Configuration key | Environment variable | Meaning |
| --- | --- | --- |
| `AzureAd:Instance` | `AzureAd__Instance` | Entra authority URL, normally `https://login.microsoftonline.com/` |
| `AzureAd:TenantId` | `AzureAd__TenantId` | Tenant GUID or tenant domain |
| `AzureAd:ClientId` | `AzureAd__ClientId` | Application (client) ID of the API registration, as a GUID |
| `AzureAd:Audience` | `AzureAd__Audience` | Expected access-token audience, normally the exposed API Application ID URI |

At startup, the API validates that the authority is an HTTPS URL, the tenant and API client IDs are real GUIDs, and the audience is a real GUID or absolute URI. Placeholder values such as `A_RENSEIGNER` are rejected. Unknown authentication modes are rejected. The configured group-to-capability mapping is also validated at startup so malformed group IDs or unsupported capabilities do not remain latent until a request arrives.

An empty `AutorisationEntra:GroupesCapacites` mapping is deliberately fail-closed: authentication can succeed, but no Entra group-derived application capabilities are granted. Configure the actual group object IDs and approved capability names before expecting users to access protected business operations.

## Entra app registration checklist

1. Register the API in the intended tenant.
2. Set the Application ID URI and expose the API scope(s) required by the client application.
3. Configure the client application to request an access token for this API, not an ID token.
4. Set the API's tenant ID, client ID, and exact expected audience in the deployment configuration.
5. Keep secrets and certificates in the deployment secret store. The API should not need a client secret merely to validate bearer access tokens.
6. Verify an access token from the intended tenant and audience; an ID token, expired token, token from another issuer, or token for another API must be rejected.

## Local development and tests

Local development may use the synthetic identities in `appsettings.Development.json`. They are not Entra identities and must never be enabled outside the `Development` or `Tests` host environments.

The API authentication tests use a local signing key and fixed test-only tenant/application identifiers. They do not call a real tenant or require a client secret. Production token validation remains configured through Microsoft.Identity.Web and the deployment's Entra settings.

## Authorization behavior already implemented

After a valid bearer token is accepted, `TransformationGroupesEntra` removes any capability claims supplied by the token and derives capabilities only from the server-side `AutorisationEntra:GroupesCapacites` mapping. Unknown groups grant nothing. Group-overage indicators grant no group-derived capabilities; the API does not attempt to infer or grant access when the complete group list is unavailable.

The API's fallback authorization policy requires an authenticated principal. Capability policies require the corresponding server-derived `capability` claim. Business services also enforce project membership and the relevant project permissions; the frontend's screen visibility is not a security boundary. A valid token alone does not imply access to every project or operation.

## Frontend configuration boundary

The Angular MSAL sign-in and token-acquisition flow is already present, but its production values are configured separately in `frontend/src/environments/environment.ts`:

- `auth.clientId`: client ID of the Angular single-page application registration (not the API registration's client ID).
- `auth.authority`: tenant-specific Entra authority URL.
- `auth.scopeApi`: the exposed API scope requested by Angular, currently shaped as `api://<api-application-id>/acces`.

These values are public application configuration, not secrets, but they must match the real registrations. With the current design, populating only the API's `appsettings.json` is not sufficient to enable real Angular sign-in; the Angular environment values must also be supplied. Consolidating these into runtime configuration would be a separate frontend configuration change and is intentionally outside this API-focused change.

## What still requires the real tenant

Code and automated tests can validate configuration structure, token validation behavior using test signing keys, group-to-capability mapping, and project authorization without a tenant. Only the following require the target organization's actual Entra/Azure environment:

- Replace the sample values in the API's `appsettings.json` or, preferably, the Azure deployment configuration with the real tenant ID, API application client ID, exact audience, and group object IDs.
- Register the API and expose the required delegated scope; configure the Angular client registration and redirect URI/token request when the frontend's Entra sign-in flow is enabled.
- Ensure Entra emits group claims for the API access token and validate the real token's issuer, audience, and group claim shape.
- Deploy the configuration and verify sign-in, 401/403 behavior, project access, and operational logging end to end.

The API does not need a client secret merely to validate bearer access tokens. Do not commit real tenant IDs or secrets to source control; use Azure application settings, environment variables, or a secret store for deployed environments.
