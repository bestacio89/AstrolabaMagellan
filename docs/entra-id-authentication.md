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

The API validates that the authority is HTTPS, the client ID is a GUID, and tenant/audience values are present and are not sample placeholders. Startup fails when the Entra configuration is incomplete instead of silently accepting an unusable identity configuration.

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

## Scope boundary

This stage authenticates callers and establishes the API's default authentication boundary. Mapping Entra groups to application capabilities and enforcing project assignments are later roadmap stages; a valid token alone does not imply access to every project or operation.
