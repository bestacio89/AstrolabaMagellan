# AstrolabaMagellan Azure Delivery Starter

A private-network Azure deployment starter for the AstrolabaMagellan application.

**This is a template, not a verified deployment.** Before using it in production, review the Bicep deployment with `what-if`, confirm all repository paths and application settings, and test in a non-production subscription/environment.

See [`README-DEPLOIEMENT-FR.md`](README-DEPLOIEMENT-FR.md) for the French operational guide.

## Contents

- `azure-pipelines-ci.yml` — PR validation.
- `azure-pipelines-deploy.yml` — manually invoked deployment pipeline.
- `infra/main.bicep` — VNet, App Services, Key Vault, PostgreSQL Flexible Server, private endpoints, private DNS, managed identity RBAC.
- `infra/parameters/` — test and production parameter files with placeholders.
- `scripts/` — deployment, automatic PostgreSQL credential bootstrap, Key Vault secret provisioning, and private-network smoke-check scripts.

## Important blockers to resolve before deployment

1. Replace every `REPLACE_WITH_...` value.
2. Create a self-hosted Azure DevOps agent with private VNet connectivity; the deployment must reach private endpoints and App Service SCM/Kudu.
3. Confirm EF Core migration project/DbContext and Angular output path against the current repository.
4. Resolve Angular `/api` routing: separate App Services do not automatically make relative `/api` calls reach the backend. Add a reverse proxy/BFF or configure a private API URL and narrowly scoped CORS.
5. The deployment pipeline automatically generates/reuses PostgreSQL credentials, provisions the `astrolaba_app` role, and writes `AstrolabaPostgresConnectionString` to Key Vault. If a previous first deployment partially created PostgreSQL but failed before storing the admin secret, the deployment run rotates the admin password and stores the replacement; the what-if stage does not rotate credentials. The private agent must have `psql`, `openssl`, Azure CLI and private DNS/network access.
6. Configure production approvals/checks in Azure DevOps UI. The Azure DevOps service connection needs permissions to deploy resources/role assignments and write Key Vault secrets.

## Run CI

Create a pipeline in Azure DevOps pointing to `azure-pipelines-ci.yml`. Replace the service connection placeholder if using the AzureCLI Bicep validation task. Configure workload identity federation and minimum required permissions.

## Run deployment

Create a separate pipeline pointing to `azure-pipelines-deploy.yml`, set the pipeline variables documented in the YAML, and use a private self-hosted agent pool. Run the `test` environment first. Inspect `what-if` output before allowing deployment. Configure environment approvals in the Azure DevOps UI.
