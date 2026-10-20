# Entra ID group-to-capability mapping

Configure `AutorisationEntra:GroupesCapacites` through deployment configuration or environment variables. Each key is an Entra group object ID (GUID); each value is a list of supported capability identifiers. The committed default mapping remains empty, so no group-derived capabilities are granted until deployment configuration supplies a mapping.

Example shape only; replace these illustrative IDs in deployment configuration and do not commit real tenant values:

```json
{
  "AutorisationEntra": {
    "GroupesCapacites": {
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": [
        "projets.lire-tous",
        "exports.financiers"
      ],
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": [
        "projets.creer"
      ]
    }
  }
}
```

Supported capabilities are `projets.lire`, `projets.lire-tous`, `projets.creer`, `projets.modifier`, `consomme.saisir`, and `exports.financiers`. `projets.lire` allows reads only when the user also has a project assignment; `projets.lire-tous` is the explicit cross-project read capability. A capability claim is derived only from an authenticated principal's group claim and the server-side mapping. Existing `roles` claims are not rewritten.

Entra can omit a complete group list when membership exceeds token limits. The transformer treats `hasgroups` and `_claim_names` markers as overage signals and grants no group-derived capabilities in that case. This stage does not call Microsoft Graph; any future resolver must be deliberately designed, permissioned, and tested. Missing or unresolved group membership never implies access.

Named policies use `capacite:{identifier}`. The API's current project-authorization services must continue to apply capability checks together with project-assignment checks on each operation. A capability alone must not imply access to every project.
