# Security and release-readiness checklist

This checklist complements the implementation roadmap. It is not a claim that a deployment has been configured or CI has passed.

## Microsoft Entra ID

- [ ] Register the API in the intended tenant and expose the required delegated scope.
- [ ] Declare API app roles with exact values Manager and Admin; assign them only to approved users/groups.
- [ ] Configure the SPA to request an access token for this API; never send an ID token as a bearer token.
- [ ] Set AzureAd:Instance, AzureAd:TenantId, AzureAd:ClientId, and AzureAd:Audience through deployment configuration.
- [ ] Validate issuer, tenant, audience, signature, lifetime, and required scope independently from role authorization.
- [ ] Verify Manager receives operational portfolio permissions and Admin receives user/access administration without implicit financial privileges.
- [ ] Verify unknown/missing roles grant no global privileges and token-supplied capability claims are ignored.
- [ ] Confirm development authentication is rejected outside Development/Tests.

## Project and task authorization

- [ ] Verify identity is keyed by tenant ID plus object ID, not email or display name.
- [ ] Migrate existing bare object-ID user keys to {tenantId}:{objectId} using docs/entra-identity-key-migration.md; verify assignments remain attached.
- [ ] Verify a project-read capability without project assignment cannot read the project.
- [ ] Verify project assignment without the required capability cannot read/change the resource.
- [ ] Verify project writes require both the relevant capability and the appropriate project role.
- [ ] Verify Manager and Admin can discover all projects but do not share every mutation/financial permission.
- [ ] Verify financial exports require the financial capability and an eligible project role.
- [ ] Implement and test authorized assignment workflows for project users and project profiles before enabling those capabilities in UI.
- [ ] Link Contributor identities to project profiles using stable identity, then filter task/planning reads and writes by that link.
- [ ] Verify comments can only be edited by their author, including by project managers and administrators.
- [ ] Scope lists, details, nested resources, imports, drafts, and exports before returning data.
- [ ] Verify restricted projects are not disclosed through DTOs, errors, logs, or exports.
- [ ] Treat GET /api/moi/capacites as presentation data only; re-check authorization on every operation.

## PostgreSQL and migrations

- [ ] Configure PostgreSQL connection settings through deployment configuration/secret storage.
- [ ] Apply migrations as an explicit deployment step with reviewed backup and rollback plans.
- [ ] Test a fresh database and upgrade from the previous supported schema.
- [ ] Review migration diffs; never use EnsureCreated, database deletion, or destructive reset scripts in deployment.
- [ ] Run PostgreSQL-backed authorization integration tests against a disposable database.
- [ ] Confirm least-privilege database credentials and appropriate TLS settings.

## CI and operational checks

- [ ] GitHub Actions .NET build/tests and Angular production build/tests have completed successfully.
- [ ] Review test results and resolve failed/skipped security-critical tests.
- [ ] Verify 401/403 behavior and non-disclosure of inaccessible project IDs.
- [ ] Ensure logs never contain bearer tokens, secrets, or sensitive project data.
- [ ] Confirm health endpoints expose operational status only.
- [ ] Record the deployed commit, migration version, configuration change, and rollback decision.

## Rollback

1. Stop rollout if migration or authorization verification fails.
2. Restore the previous release only if it remains compatible with the current schema.
3. Use a reviewed forward-fix or database restore for incompatible schema changes; never automatically drop customer data.
4. Revoke or correct Entra app-role assignments if access was granted incorrectly.
5. Preserve sanitized logs and test evidence for incident review.

## Release decision

Release only after CI is green, PostgreSQL migration checks pass, and the role/permission matrix has been reviewed against the final screen-permission matrix. A queued CI run is not a pass.
