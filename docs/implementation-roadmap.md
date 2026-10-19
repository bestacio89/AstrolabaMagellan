# Backend modernization roadmap

## Objective

Move AstrolabaMagellan to PostgreSQL with EF Core code-first migrations and secure its APIs with Microsoft Entra ID. Authorization must combine Entra group membership (which determines the user's capability/view profile) with server-side project assignment (which limits the projects and data the user can access).

The Angular application and its existing screen designs are intentionally out of scope until the frontend and screen-permission matrix are ready. The backend must expose enforceable, testable authorization outcomes; hiding a screen in Angular is never a security boundary.

## Delivery rules

- One focused branch and one pull request per stage. Target `main` unless the stage depends on an open predecessor PR; dependent stages may be stacked on that predecessor and retargeted to `main` after it merges.
- Do not merge until CI is green and the stage's acceptance criteria are met.
- Commit format: `[Action][Scope]: lowercase summary`. Allowed actions: `[Feat]`, `[Fix]`, `[Patch]`, `[Test]`, `[Refactor]`, `[Docs]`, `[Chore]`. Scopes should use the existing project conventions, including `[Api]`, `[Domain]`, `[Application]`, `[Contracts]`, `[CPM]`, `[Tests]`, `[Messaging]`, and `[Persistence]`.
- Every PR uses the agreed sections: Summary, Details, Changes, Tests, Docs, and Release Notes.
- Never commit tenant IDs, client secrets, production connection strings, or real customer/project data.
- Keep the solution on .NET 10; do not introduce a preview SDK or unrelated framework upgrades.
- Preserve business calculations and existing Angular contracts unless a change is required and documented.

## Stage 1 — PostgreSQL and code-first persistence

**Purpose:** Replace SQL Server-specific persistence with PostgreSQL and make EF Core migrations the authoritative schema history.

**Expected changes**
- Audit all persistence projects, package references, provider-specific configuration, raw SQL, type mappings, and test setup before editing.
- Replace the SQL Server EF Core provider with the compatible Npgsql provider and centralize package versions where the repository already uses central package management.
- Configure PostgreSQL through environment-specific configuration; do not hard-code credentials.
- Create and commit a baseline migration that matches the current domain model, and use migrations rather than `EnsureCreated` or destructive reset scripts for normal schema evolution.
- Update development/test configuration and setup documentation. Keep production migration execution deliberate and observable rather than silently dropping or recreating data at startup.
- Add persistence integration tests against PostgreSQL (prefer a disposable PostgreSQL container where CI supports it); do not treat EF's in-memory provider as proof of relational behavior.

**Acceptance criteria**
- No SQL Server provider or SQL Server-only connection/configuration remains in the active persistence path.
- A clean PostgreSQL database can be created from committed migrations.
- Existing persistence and API tests pass, with PostgreSQL-backed integration coverage for critical mappings and operations.
- No migration or setup script deletes an existing database as part of the normal startup path.

## Stage 2 — Entra ID authentication

**Purpose:** Validate real Microsoft Entra ID access tokens at the API boundary.

**Expected changes**
- Configure JWT bearer validation through Microsoft.Identity.Web (or the repository's established compatible integration), with tenant and API audience supplied by configuration.
- Require authentication on protected API routes; explicitly mark only intentional health/readiness or other public endpoints as anonymous.
- Remove mock-user authentication from non-development environments and fail safely when required production identity configuration is missing.
- Keep secrets in the deployment secret store/environment, not appsettings committed to Git.
- Add tests for missing, malformed, expired, wrong-issuer, and wrong-audience tokens, plus the intended development-only behavior.

**Acceptance criteria**
- Protected endpoints reject anonymous or invalid-token requests.
- Tokens are validated against the configured tenant and API audience.
- Development conveniences cannot be enabled in staging/production accidentally.

## Stage 3 — Entra group-to-capability authorization

**Purpose:** Translate verified Entra group claims into stable application capabilities without trusting client-supplied role or group values.

**Expected changes**
- Define a central, documented mapping from configured Entra group object IDs to application capability/role policies. Use object IDs, not display names, as stable identifiers.
- Handle group overage explicitly: do not silently interpret a missing groups claim as no membership or grant access by default. If the token does not contain a complete group list, use a deliberate supported resolution strategy or deny access.
- Define policies for the application's known profiles and operations; avoid scattering raw group-ID comparisons across controllers.
- Add unit tests for mapped, unmapped, multiple-group, and missing/overage claim cases.

**Acceptance criteria**
- Capability assignment is derived only from validated identity claims and server configuration.
- Unknown or unresolved membership grants no privileged capability.
- Policy behavior is deterministic and covered by tests.

## Stage 4 — Project assignment and resource-level authorization

**Purpose:** Enforce the intersection of group-derived capability and project membership for every project-scoped operation.

**Expected changes**
- Model or formalize the relationship between an authenticated Entra identity and its project assignments using the existing domain and persistence conventions.
- Use a stable identity key (normally Entra tenant ID plus object ID) rather than email or display name for authorization decisions.
- Introduce reusable authorization handlers/services that evaluate both the required capability and access to the target project.
- Apply authorization to reads, writes, exports, imports, and nested project resources; scope queries to authorized projects before returning data.
- Prevent insecure direct-object references and avoid leaking restricted fields through DTOs, aggregate endpoints, errors, or exports.
- Keep the rules server-side; the Angular client will later consume an explicit permissions/capabilities response to select its already-designed view.

**Acceptance criteria**
- A user with a valid group but no assignment cannot access the project.
- A user assigned to a project but lacking the required group capability cannot perform the operation.
- Cross-project reads and writes are denied, including nested resources and exports.
- Tests prove both allowed and denied combinations.

## Stage 5 — Authorization contract for the future Angular integration

**Purpose:** Give Angular a stable description of the authenticated user's capabilities without making the frontend authoritative.

**Expected changes**
- Define a versionable API contract for the current user's effective capabilities and accessible project identifiers (or a safely paginated project list).
- Return capability identifiers and project-scoped permissions, not raw Entra tokens or secrets.
- Keep the contract independent of Angular component names and presentation details; finalize the mapping only after the screen-permission matrix is supplied.
- Document 401 versus 403 behavior and the expected handling of expired sessions and inaccessible projects.
- Add contract tests and API documentation.

**Acceptance criteria**
- The response is derived from server-validated identity, configured group mapping, and current project assignments.
- No frontend-provided project ID, role, or capability can elevate access.
- The contract can support the existing Angular designs without coupling backend authorization to UI implementation details.

## Stage 6 — Hardening, deployment, and release readiness

**Purpose:** Verify the full security and persistence path before production rollout.

**Expected changes**
- Add end-to-end API tests combining PostgreSQL, authenticated identities, group policies, and project assignments.
- Verify migration application, startup failure behavior, structured authorization logs, and safe error responses.
- Document Entra app registration requirements, delegated/application audience expectations, group claim configuration/overage behavior, PostgreSQL configuration, and deployment secret settings.
- Review CI to ensure restore, build, unit tests, integration tests, and migration validation run consistently.
- Document a rollout and rollback approach that does not depend on deleting production data.

**Acceptance criteria**
- CI passes and the security matrix covers anonymous, invalid identity, unknown group, wrong capability, unassigned project, assigned project, and cross-project attempts.
- A fresh database and an existing database can be upgraded through migrations.
- Operational documentation contains no real secrets or tenant-specific values.

## Pull request template

Every implementation-stage PR must use this structure:

```markdown
## 📌 Summary
Short summary of the changes.

## 🔍 Details
- [ ] Title follows the commit convention (`[Patch]`, `[Feat]`, `[Fix]`, `[Docs]`, etc.).
- [ ] Explains what changed and why.

## ✅ Changes
- ...

## 🧪 Tests
- [ ] Unit tests updated/added.
- [ ] Integration tests verified.
- [ ] CI passes locally (where applicable).

## 📚 Docs
- [ ] README/CHANGELOG updated if a public API or UX changed.
- [ ] No breaking changes left undocumented.

## 🚀 Release Notes
One-line changelog entry.
```

## Current status

Implementation is being delivered as separate pull requests. A merge alone is not evidence that the stage's acceptance criteria passed; CI and security review remain required.

| Stage | Pull request | State |
| --- | --- | --- |
| 1 — PostgreSQL and code-first persistence | [#2](https://github.com/bestacio89/AstrolabaMagellan/pull/2) | Merged; CI/release acceptance still requires verified checks |
| 2 — Entra ID authentication | [#4](https://github.com/bestacio89/AstrolabaMagellan/pull/4) | Merged; CI/release acceptance still requires verified checks |
| 3 — Group-to-capability authorization | [#5](https://github.com/bestacio89/AstrolabaMagellan/pull/5) | Open for review |
| 4 — Project/resource authorization | [#6](https://github.com/bestacio89/AstrolabaMagellan/pull/6) | Open for review; stacked on Stage 3 |
| 5 — Current-user authorization contract | [#7](https://github.com/bestacio89/AstrolabaMagellan/pull/7) | Open for review; stacked on Stage 4 |
| 6 — Security and release hardening | [#8](https://github.com/bestacio89/AstrolabaMagellan/pull/8) | Open for review; stacked on Stage 5 |

At the time of this update, GitHub Actions runner jobs are queued, so no successful CI result is claimed. Do not merge dependent stages until the preceding stage is merged, all required checks pass, and the security acceptance criteria have been reviewed.
