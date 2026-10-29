# AstrolabaMagellan Azure Delivery Starter

A private-network Azure deployment starter for the AstrolabaMagellan application.

**This is a template, not a verified deployment.** Green application CI does not validate this Azure DevOps pipeline. Before using it in production, validate the pipeline in Azure DevOps, review the Bicep deployment with `what-if`, confirm all repository paths and application settings, and test in a non-production subscription/environment.

See [`README-DEPLOIEMENT-FR.md`](README-DEPLOIEMENT-FR.md) for the French operational guide.

## Contents

- `azure-pipelines-ci.yml` — PR validation.
- `azure-pipelines-deploy.yml` — manually invoked deployment pipeline.
- `infra/main.bicep` — VNet, App Services, Key Vault, PostgreSQL Flexible Server, private endpoints, private DNS, managed identity RBAC, Log Analytics and workspace-based Application Insights.
- `infra/parameters/` — test and production parameter files with placeholders.
- `scripts/` — deployment, automatic PostgreSQL credential bootstrap, Key Vault secret provisioning, and private-network smoke-check scripts.

## Important blockers to resolve before deployment

1. Replace every `REPLACE_WITH_...` value.
2. Create a self-hosted Azure DevOps agent with private VNet connectivity; the deployment must reach private endpoints and App Service SCM/Kudu.
3. Confirm EF Core migration project/DbContext and Angular output path against the current repository.
4. Resolve Angular `/api` routing: separate App Services do not automatically make relative `/api` calls reach the backend. Add a reverse proxy/BFF or configure a private API URL and narrowly scoped CORS.
5. The deployment pipeline automatically generates/reuses PostgreSQL credentials, provisions a least-privilege `astrolaba_app` role, and writes `AstrolabaPostgresConnectionString` to Key Vault. Successful or partially completed deployment runs retain any generated application packages as pipeline artifacts for rollback/recovery. If a previous first deployment partially created PostgreSQL but failed before storing the admin secret, the deployment run rotates the admin password and stores the replacement; the what-if stage does not rotate credentials. The private agent must have `psql`, `openssl`, Azure CLI and private DNS/network access.
6. Application Insights captures API request, dependency and exception telemetry in the environment's Log Analytics workspace (30-day test retention, 90-day production retention). Configure Azure Monitor alert rules and action groups for availability, error rate and dependency failures before production. The Azure DevOps service connection needs permissions to deploy resources/role assignments and write Key Vault secrets.

## Run CI

Create a pipeline in Azure DevOps pointing to `AstrolabaMagellan-Azure-Delivery/azure-pipelines-ci.yml`. The Bicep compile stage does not require Azure credentials; infrastructure deployment permissions belong only in the deployment pipeline.

## Run deployment

Create a separate pipeline pointing to `AstrolabaMagellan-Azure-Delivery/azure-pipelines-deploy.yml`, set the pipeline variables documented in the YAML, and use a private self-hosted agent pool. Run the `test` environment first. Inspect `what-if` output before allowing deployment. Configure environment approvals in the Azure DevOps UI.


## Rollback and recovery

- The deployment pipeline publishes the generated ZIP packages as `deployment-packages-<BuildId>`, including on failure when the package directory exists. Retain successful release runs according to the operational retention policy.
- To roll back application code, download the backend and frontend ZIP artifacts from the last known-good deployment run and deploy them to their corresponding App Services from the private agent using `az webapp deploy`. Re-run the private smoke checks afterward.
- Database migrations are not automatically reversed. Use additive/expand-contract migrations for production releases. If data/schema recovery is required, restore PostgreSQL to a **new** server using the supported point-in-time restore workflow, validate the restored database, and only then plan the application connection switch. Never assume restoring an older application package also rolls back the database.
- Before production use, perform a timed restore exercise and record the recovery point objective (RPO) and recovery time objective (RTO). Backup retention alone is not proof that restoration works.
