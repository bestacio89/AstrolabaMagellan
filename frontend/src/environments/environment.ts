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
    clientId: 'A_RENSEIGNER',
    authority: 'https://login.microsoftonline.com/A_RENSEIGNER',
    /** Autorisation demandée pour appeler l'API (déclarée dans l'inscription de l'API dans Entra ID). */
    scopeApi: 'api://A_RENSEIGNER/acces',
  },
};
