# Current-user authorization contract

## Endpoint

`GET /api/moi/capacites`

Requires an authenticated caller. It returns a versioned, server-derived description of the caller's effective capabilities and readable project identifiers. The existing `GET /api/moi` response is unchanged for compatibility with the current Angular client.

## Version 1 response

```json
{
  "version": 1,
  "capacites": [
    "projets.creer",
    "projets.lire",
    "projets.modifier"
  ],
  "projetsAccessibles": [
    "b93f6d6c-7d39-4f79-9a18-1ef6a6c7c15b"
  ]
}
```

The values above are illustrative only.

- `version` identifies the contract schema, not the API release.
- `capacites` contains known capability identifiers derived by the server from the validated identity and the configured group-to-capability mapping. It never echoes arbitrary capability claims from a client.
- `projetsAccessibles` contains project IDs the current user can read. A user without project-read capability receives an empty list. A user with the global project-reading capability receives the IDs of all projects; otherwise, only assigned project IDs are returned.

The response contains no access token, secret, email-based authorization key, or project details. IDs are for client-side navigation and presentation only. Every API request that reads or changes a project must still perform server-side authorization; clients cannot grant themselves access by editing this response or submitting a project ID.

## HTTP behavior

- `200 OK`: authenticated caller and contract returned.
- `401 Unauthorized`: no valid authenticated identity.
- `403 Forbidden`: the identity is authenticated but the account is disabled or an operation is not permitted, according to the endpoint's authorization rules.
- Project resources that the caller is not allowed to discover may return `404 Not Found` to avoid disclosing whether the project exists.

## Compatibility and evolution

The existing `GET /api/moi` response is not changed in this stage. New consumers should use `GET /api/moi/capacites` for the stable capability and project-scope contract. Additive changes may be made to version 1 only when they remain backward compatible; a breaking schema change requires a new version and documented migration plan.

The contract intentionally does not bind capabilities to Angular component names. The final view/profile mapping should be confirmed against the screen-permission matrix before frontend integration.
