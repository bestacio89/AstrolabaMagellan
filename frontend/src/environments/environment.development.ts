/**
 * Réglages de DÉVELOPPEMENT : pas d'Entra ID, des utilisateurs fictifs (déclarés côté API dans appsettings.Development.json).
 * Les appels /api sont redirigés vers l'API locale par proxy.conf.json.
 */
export const environment = {
  production: false,
  api: '/api',
  auth: {
    mode: 'dev' as 'entra' | 'dev',
    clientId: '',
    authority: '',
    scopeApi: '',
  },
};
