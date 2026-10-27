# Entra app-role authorization contract

## Global roles

Declare these exact role values as app roles on the API registration and assign them to users or groups in Entra. The API reads the roles claim from the validated access token for this API. Do not use the SPA's ID token as an authorization source.

| App role value | Business purpose | Effective global capabilities |
| --- | --- | --- |
| Manager | Operational portfolio management | Read all projects, create projects, assign users to projects, financial exports |
| Admin | Application and access administration | Read all projects, assign users to projects, administer application users/access |
| No global role | Project-level user | Read assigned projects and perform only operations allowed by the user's PostgreSQL project role |

The two global roles are intentionally distinct. Admin does not receive financial export or project creation. Project editing still requires the relevant project-level role. Manager does not implicitly receive application-user administration.

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
- exports.financiers: portfolio-wide financial visibility and export capability (Manager). A Project Manager can see financial data on their assigned project, but does not receive portfolio exports.

Capabilities included in a token are not trusted. The API removes incoming capability claims and derives them from the validated roles claim. Unknown roles grant no global privileges. This mapping is code-defined and reviewed with the application, not configured through Entra group object IDs.

## Access token and scope

- Configure the SPA to request an access token for the API, using the API's exposed delegated scope.
- Validate issuer, tenant, audience, lifetime, signature, and required scope independently from app-role authorization.
- Configure the actual API Application ID URI, scope value, tenant, and app registration identifiers with the Entra administrator; do not infer them from the SPA client ID.
- Do not add Microsoft Graph permissions merely to read claims from an access token. Graph is needed only for separate Graph-backed features, with explicit permissions and consent.

## Implemented authorization boundary

The API exposes an authorized user directory, Manager/Admin-only project-role assignment endpoints, and project-profile-to-user assignment. The Angular project settings screen uses these endpoints to assign Project Manager, Contributor, and Reader roles and link a project profile to a known application user.

Contributor task filtering is performed server-side on the serialized project follow-up: only tasks with positive workload for a profile linked to the authenticated local user are returned. Profile indices and dependent task, track, comment, reference, and planning data are filtered/remapped together. Financial ledgers and project-wide registers are removed from the Contributor view.

Writes are independently authorized. Contributor consumed-time entries must target a task/profile pair assigned to the caller's linked profile. Contributor task comments are restricted to accessible tasks; editing and deleting comments require the original author. Shared project planning and project-configuration writes remain restricted to Project Managers. Personal absences remain under the current-user API.

These guarantees require PostgreSQL-backed integration tests and a green CI run before merge. A real tenant is still required to verify app-role assignments, the required delegated scope, enterprise-application assignment restrictions, and the resulting access token claims.
