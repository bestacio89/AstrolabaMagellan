# Entra identity-key migration

## Why this is required

The current authorization identity key is `{tid}:{oid}` (tenant ID plus Entra object ID). Older rows may contain only the bare object ID. Without migrating those rows, the first sign-in after deployment creates a new `Utilisateurs` row and existing `Habilitations` remain attached to the old user, making project assignments appear to disappear.

Do not automatically adopt a legacy user by matching only `oid` at request time. A tenant-qualified key must remain the authorization boundary.

## Preconditions

1. Confirm the production API is configured for the intended single Entra tenant and record its tenant GUID.
2. Take and verify a PostgreSQL backup.
3. Run this script first in a restored staging copy.
4. Confirm existing keys are bare object-ID GUIDs. The script deliberately ignores non-GUID development/test identities.
5. Review the affected-row count and confirm no existing tenant-qualified key would collide.

## Transactional migration

Replace the placeholder with the configured Entra tenant GUID. Execute against the application's PostgreSQL database using a migration account with permission to update `Utilisateurs`.

```sql
BEGIN;

DO $migration$
DECLARE
    tenant_id text := '11111111-1111-4111-8111-111111111111';
BEGIN
    IF tenant_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'tenant_id must be a GUID';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Utilisateurs" legacy
        JOIN "Utilisateurs" qualified
          ON qualified."IdentifiantExterne" = tenant_id || ':' || legacy."IdentifiantExterne"
        WHERE legacy."IdentifiantExterne" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) THEN
        RAISE EXCEPTION 'A tenant-qualified identity already exists for a legacy object ID; reconcile duplicates before migration';
    END IF;

    UPDATE "Utilisateurs"
       SET "IdentifiantExterne" = tenant_id || ':' || "IdentifiantExterne"
     WHERE "IdentifiantExterne" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    RAISE NOTICE 'Tenant-qualified legacy identities updated: %', FOUND;
END
$migration$;

-- Inspect the affected rows and verify the resulting tenant:oid keys before committing.
SELECT "IdentifiantExterne"
FROM "Utilisateurs"
WHERE "IdentifiantExterne" LIKE '%:%';

-- COMMIT only after review. Otherwise use ROLLBACK.
-- COMMIT;
ROLLBACK;
```

The script intentionally ends with `ROLLBACK` so the first run is a dry run. After reviewing the row set and confirming the expected tenant, run it again with the final `ROLLBACK` replaced by `COMMIT`. Do not run it concurrently with application writes.

## Post-migration verification

- Sign in with a user that already has project assignments and verify the same projects remain visible.
- Verify the stored identity key is exactly `{configured-tenant-guid}:{oid}`.
- Verify no duplicate user or duplicate user/project assignment was created.
- Run the PostgreSQL-backed authorization integration tests.
- Record the migration and deployed commit in the release record.
