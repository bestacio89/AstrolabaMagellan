# Test strategy

## Goals

Tests must be deterministic, isolated, runnable from a clean checkout, and fail visibly when their required infrastructure or test discovery is missing. A successful production build is not a substitute for unit tests, and a passing unit-test suite is not a substitute for validating the production bundle.

## Backend test layers

| Project | Responsibility | Infrastructure |
| --- | --- | --- |
| `PilotageForfaits.Domain.Tests` | Domain invariants, business rules, calculation edge cases | None |
| `PilotageForfaits.Infrastructure.Tests` | Import/serialization, persistence mappings, provider-specific behavior | PostgreSQL for provider/migration integration tests; pure tests remain database-free |
| `PilotageForfaits.Api.Tests` | HTTP contract, authentication, authorization, validation, end-to-end API behavior | In-memory test host and isolated SQLite connection |
| Shared reference scenarios | Compare calculated output with reviewed reference data | Deterministic date and checked-in fixtures |

SQLite is a test-only substitute for API behavior tests. It must not be treated as proof that PostgreSQL-specific mappings, constraints, migrations, or SQL behave correctly. PostgreSQL tests use a real PostgreSQL service in CI.

Test factories must configure their own host instead of mutating process-wide environment variables. Shared fixtures and mutable clocks must not leak state between tests. Test data should be explicit, small, and named for the behavior under test.

## Angular test layers

- Pure calculation/state functions: direct Vitest unit tests with boundary cases.
- API clients: `HttpTestingController` tests asserting method, URL, query parameters, request body, HTTP context, and encoded route segments.
- Authentication, session, routing guards, interceptors, and error presentation: isolated tests with explicit providers/mocks.
- Components: focused rendering and interaction tests for meaningful user flows, including loading, empty, success, validation, and error states.
- Production build: run the production Angular build and assert that the expected browser entry point exists and is non-empty.

The production bundle is validated as a build artifact. Unit tests should not import compiled production files: Angular's test builder compiles the source under test and uses the explicit `pilotage-forfaits:build:development` target configured in `angular.json`. This avoids testing stale output from `dist` and keeps test diagnostics tied to source files.

## CI invariants

1. Run commands from the directory that owns the solution or package manifest.
2. Restore dependencies before building; build before running .NET tests with `--no-build`.
3. Run Angular production build and assert `frontend/dist/pilotage-forfaits/browser/index.html` exists before running Angular unit tests.
4. Fail CI when build or test commands fail; do not convert missing configuration into a passing test.
5. Collect .NET Cobertura coverage alongside TRX results and publish both as a workflow artifact, including when tests fail.
5. Run PostgreSQL integration tests only with a CI-provided `POSTGRES_TEST_CONNECTION`; skip them explicitly when that variable is absent for local runs.
6. Keep generated reference scenarios in sync with the checked-in expected JSON.
7. Treat coverage as diagnostic evidence, not as a quality gate by itself; establish a verified baseline before setting thresholds.
8. Review coverage and test gaps by behavior and risk, not by percentage alone.

## Coverage reporting

The backend CI test command uses the installed `coverlet.collector` package through `--collect:"XPlat Code Coverage"`. The workflow publishes the test-results directory as an artifact, including TRX test reports and Cobertura coverage files. This makes coverage inspectable without introducing an arbitrary percentage threshold before the baseline has been measured. Coverage artifacts must be reviewed alongside test outcomes and the behaviors covered.

## Current follow-up work

This test-foundation change adds focused Angular HTTP-client and session tests, makes the API test host configuration local to each test host, and verifies the production build artifact in both CI definitions. Remaining test refactoring should proceed by layer and feature; the new tests do not imply that every component or backend behavior is already covered.
