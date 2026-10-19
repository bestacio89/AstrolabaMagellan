# Security and release-readiness checklist

This checklist complements the staged implementation roadmap. It is not a claim that a deployment has been configured or that CI has passed.

## Microsoft Entra ID

- [ ] Register the API in the intended tenant and configure its Application ID URI and exposed scopes.
- [ ] Configure the client to request an access token for this API; do not send an ID token as a bearer token.
- [ ] Set `AzureAd:Instance`, `AzureAd:TenantId`, `AzureAd:ClientId`, and `AzureAd:Audience` using deployment configuration or a secret store.
- [ ] Confirm the token issuer, tenant, audience, lifetime, and signing key are validated.
- [ ] Configure the required group claims. Test a normal group list and group overage; overage must not grant capabilities.
- [ ] Map Entra group object IDs to only the approved capability identifiers. Review mapping changes as security-sensitive configuration.
- [ ] Confirm development authentication is not enabled in staging or production. The API should fail startup if it is.
- [ ] Confirm a valid identity without an application capability receives no privileged capability.

## Project authorization

- [ ] Verify identity is keyed by Entra tenant ID plus object ID, not email or display name.
- [ ] Migrate existing bare object-ID user keys to `{tenantId}:{objectId}` using `docs/entra-identity-key-migration.md` before rollout; verify existing project assignments remain attached.
- [ ] Verify a mapped read capability without project assignment cannot read a project.
- [ ] Verify project assignment without the required capability cannot read or change it.
- [ ] Verify project writes require both the relevant capability and an appropriate project role.
- [ ] Verify financial exports require both the financial capability and a role permitted to view financial amounts.
- [ ] Verify lists, details, nested resources, imports, drafts, and exports are scoped before returning data.
- [ ] Verify restricted projects are not disclosed through DTOs, error text, logs, or exports.
- [ ] Treat `GET /api/moi/capacites` as a presentation contract only; re-evaluate authorization on every resource operation.

## PostgreSQL and migrations

- [ ] Configure PostgreSQL connection settings through the deployment secret/configuration system.
- [ ] Apply migrations as an explicit deployment step with a reviewed backup and rollback plan.
- [ ] Test migration from a fresh database and upgrade from the previous supported schema.
- [ ] Review the migration diff before release; do not use `EnsureCreated`, database deletion, or destructive reset scripts in deployment.
- [ ] Run the PostgreSQL-backed authorization integration test with `POSTGRES_TEST_CONNECTION` pointing to a disposable test database.
- [ ] Confirm database access uses least-privilege credentials and TLS requirements appropriate to the hosting environment.

## CI and operational checks

- [ ] GitHub Actions jobs for .NET build/tests, Angular production build/tests, and reference scenarios have completed successfully.
- [ ] Review uploaded test results and resolve all failed or skipped security-critical tests.
- [ ] Confirm 401 and 403 behavior is consistent and inaccessible project IDs do not leak project existence.
- [ ] Confirm authorization failures are logged without bearer tokens, secrets, or sensitive project data.
- [ ] Confirm readiness/health endpoints expose only operational status and do not return configuration details.
- [ ] Record the deployed commit, migration version, configuration change, and rollback decision.

## Rollback

1. Stop rollout if migration or authorization verification fails.
2. Restore the previous application release only if it remains compatible with the current schema.
3. Use a reviewed forward-fix or database restore for incompatible schema changes; do not automatically drop tables or delete customer data.
4. Revoke or correct the relevant Entra app/group configuration if access was granted incorrectly.
5. Preserve sanitized logs and test evidence for incident review.

## Release decision

A release is ready only after the full CI pipeline is green, PostgreSQL migration checks pass, and the authorization matrix has been reviewed against the final screen-permission matrix. A queued CI run is not a pass.
