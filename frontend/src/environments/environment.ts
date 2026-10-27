/**
 * Réglages de PRODUCTION (remplacés par environment.development.ts en développement).
 * Les identifiants Entra ID sont à renseigner avec l'équipe (voir docs/a-valider.md).
 */
export const environment = {
  production: true,

  /** Adresse de l'API (même domaine que l'application en production). */
  api: '/api',
  auth: {
    mode: 'entra' as 'entra' | 'dev',
    clientId: 'a45e69e5-a929-4491-945c-82b2caf7f097',
    authority: 'https://login.microsoftonline.com/91a30855-a777-43a6-8fad-66854b9a4d1b',
    scopeApi: 'api://0e3a6b58-3a85-49ae-915b-e0f5b15e9483/user.access',
  },
};


