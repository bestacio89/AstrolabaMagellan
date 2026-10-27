# Microsoft Entra ID authentication and authorization

## Runtime behavior

The API uses Microsoft Entra ID JWT bearer authentication by default. Its fallback policy requires an authenticated principal for every endpoint unless the endpoint explicitly opts out with AllowAnonymous(); the health endpoint GET /api/sante is public.

The development identity handler is separate. It is selected only when Authentification:Mode is Dev, and startup rejects that mode outside Development and Tests.

## API configuration

Supply AzureAd:Instance, AzureAd:TenantId, AzureAd:ClientId, AzureAd:Audience, and AzureAd:RequiredScope through deployment configuration or a secret store. RequiredScope is the exact delegated scope name (not the full api:// URI); its value remains A_RENSEIGNER until the Entra administrator confirms it. Startup rejects an unset or placeholder scope, and the API requires that scope in the scp claim for protected routes. The API client ID is the API registration, not the Angular SPA registration. Startup rejects placeholder tenant/client/audience values. The API does not need a client secret merely to validate bearer tokens.

## Global authorization

After JWT validation, TransformationRolesEntra removes any capability claims carried by the token and derives application capabilities from the token's roles claim. Exact role values are Manager and Admin; unknown values do not grant global privileges.

- Manager: portfolio-wide project reads, project creation, project assignment, and financial exports.
- Admin: portfolio-wide project reads, project assignment, and application-user/access administration; no implicit financial export or project creation; project-level editing still requires the relevant PostgreSQL assignment.
- Project Manager and Contributor remain project-level roles stored in PostgreSQL, not global Entra app roles.

The API still checks the effective capability together with the user's PostgreSQL project assignment and project role. The frontend cannot grant access by hiding or showing controls. Capability identifiers and policy names are documented in the app-role authorization contract.

## Entra app registration checklist

1. Register the API and expose its delegated scope.
2. Declare Manager and Admin as app roles on the API registration, with user/group assignment enabled as appropriate.
3. Assign the roles to the intended users or groups; the SPA's client ID is not a role value or API audience.
4. Configure the client application to request an access token for the API, not an ID token.
5. Confirm the actual tenant ID, API client ID, Application ID URI, and scope with the Entra administrator.
6. Validate issuer, tenant, audience, signature, lifetime, required scope, and role claims independently in a real tenant.
7. Keep API app-role assignment and project-level PostgreSQL assignments distinct.

A single Entra security group may control who can access the enterprise application, but it is not used by the API to map global capabilities. No Microsoft Graph call is required to read validated JWT claims.

## Angular configuration

The SPA's auth.clientId is the client ID of the Angular registration; auth.authority identifies the tenant; auth.scopeApi is the exposed API scope. These values are public configuration but must match the real registrations. Do not substitute the SPA client ID for the API client ID or guess the scope value.

## Project and task authorization

The API scopes project lists and resource operations using PostgreSQL assignments. Inaccessible projects return 404 to avoid revealing their existence. Financial data is filtered on the server, not only hidden in Angular.

Project settings provide Manager/Admin controls to assign Project Manager, Contributor, and Reader roles and link a project profile to an application user. Contributor follow-up responses are filtered server-side to tasks charged to linked profiles, with dependent profile/task/planning data filtered consistently. Consumed-time writes must match both the caller's linked profile and a positively charged task. Contributor comments are restricted to accessible tasks; comment edits/deletions require the original author. Shared project planning writes remain Project Manager-only.

The source code and automated tests cannot validate the target organization's actual Entra role assignments, enterprise-application access group, or exact delegated scope. Verify those against the real API access token before rollout. The exact scope remains an architect-provided configuration value and must not be guessed.
