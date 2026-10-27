# Current-user authorization contract

## Endpoint

GET /api/moi/capacites requires an authenticated caller. It returns a versioned, server-derived description of effective capability identifiers and readable project IDs. The existing GET /api/moi response remains compatible with the current Angular client.

## Version 1 response

Example only:

    {
      "version": 1,
      "capacites": ["projets.lire", "projets.modifier"],
      "projetsAccessibles": ["b93f6d6c-7d39-4f79-9a18-1ef6a6c7c15b"]
    }

- version identifies the response schema.
- capacites contains known capability identifiers derived server-side from the validated access token's app roles and the application policy. Incoming capability claims are not trusted.
- projetsAccessibles contains IDs the caller can read. Manager/Admin receive all project IDs; other users receive only assigned project IDs.

The response contains no access token, secret, or project details. IDs are for navigation/presentation only. Every resource operation must re-evaluate authorization on the API.

## Role model

- Manager: portfolio-wide reads, project creation, project assignment, financial exports.
- Admin: portfolio-wide reads, project assignment, application-user/access administration; no implicit financial export or project-editing capability.
- Project Manager, Contributor, and Reader are PostgreSQL project-level roles. Their assignment limits the scope of project operations.

Project resources the caller cannot discover may return 404 Not Found. Authenticated but unauthorized operations return 403 Forbidden where appropriate.

## Compatibility

The existing GET /api/moi response is unchanged. Capability names are API contracts, not Angular component names. Every newly added capability must be enforced by the corresponding endpoint/service before a UI control relies on it.

Contributor task-level isolation requires a stable link between the Entra identity and a project profile and must filter all task/planning responses and writes. The current contract does not claim that this end-to-end workflow is complete.
