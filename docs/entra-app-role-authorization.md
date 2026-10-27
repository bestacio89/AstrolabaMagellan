# Entra app-role authorization contract

## Global roles

Declare these exact role values as app roles on the API registration and assign them to users or groups in Entra. The API reads the roles claim from the validated access token for this API. Do not use the SPA's ID token as an authorization source.

| App role value | Business purpose | Effective global capabilities |
| --- | --- | --- |
| Manager | Operational portfolio management | Read all projects, create projects, assign users to projects, financial exports |
| Admin | Application and access administration | Read all projects, assign users to projects, administer application users/access |
| No global role | Project-level user | Read assigned projects and perform only operations allowed by the user's PostgreSQL project role |

The two global roles are intentionally distinct. Admin does not implicitly receive financial export, project creation, or project-editing capabilities. Manager does not implicitly receive application-user administration.

## Project roles in PostgreSQL

Global app roles do not replace project membership. PostgreSQL assignments remain authoritative for each project:

- Project Manager (stored as ChefDeProjet): can manage an assigned project within the capabilities available to that identity.
- Contributor (stored as Consultant): access is limited to assigned project resources and contributor-specific operations.
- Reader (stored as Lecteur): read-only project access.
- Pilotage: project-level read role; it does not itself grant global capabilities.

The API returns 404 for projects the caller is not allowed to discover. Every operation must repeat server-side authorization; Angular visibility is only a presentation concern.

## Capability identifiers

The API derives the following claims on the server:

- projets.lire: project reads, still restricted by project assignment.
- projets.lire-tous: cross-project read scope for Manager and Admin.
- projets.creer: create a project (Manager).
- projets.modifier: project modifications, still intersected with the assigned project role.
- projets.affecter-utilisateurs: permission identifier reserved for project-assignment operations (Manager and Admin).
- utilisateurs.administrer: permission identifier reserved for application-user/access administration (Admin).
- consomme.saisir: consumed-time entry, intersected with the project role.
- exports.financiers: financial visibility/export capability (Manager); project role checks still apply.

Capabilities included in a token are not trusted. The API removes incoming capability claims and derives them from the validated roles claim. Unknown roles grant no global privileges. This mapping is code-defined and reviewed with the application, not configured through Entra group object IDs.

## Access token and scope

- Configure the SPA to request an access token for the API, using the API's exposed delegated scope.
- Validate issuer, tenant, audience, lifetime, signature, and required scope independently from app-role authorization.
- Configure the actual API Application ID URI, scope value, tenant, and app registration identifiers with the Entra administrator; do not infer them from the SPA client ID.
- Do not add Microsoft Graph permissions merely to read claims from an access token. Graph is needed only for separate Graph-backed features, with explicit permissions and consent.

## Known implementation boundary

The current domain has project assignments and a profile-to-user link, but a full management workflow for assigning users to projects/profiles is not yet exposed as an API/UI feature. The new capability identifiers establish the authorization contract; they must be enforced by any assignment endpoints before such endpoints are released.

Contributor task-level filtering also depends on linking the contributor's Entra identity to a project profile and consistently applying that link to every task/planning response and write. A display name or email match is not an authorization key. Until that data path is implemented and tested, do not claim that task-level isolation is complete.
