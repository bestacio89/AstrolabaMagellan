import { Injectable, signal } from '@angular/core';
import { AccountInfo, InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';
import { environment } from '../../../environments/environment';

const CLE_UTILISATEUR_DEV = 'pilotage.utilisateurDev';

/**
 * Connexion avec le compte d'entreprise (Microsoft Entra ID), via la bibliothèque officielle MSAL.
 * En développement (environment.auth.mode = 'dev'), aucune connexion : l'API utilise des utilisateurs fictifs,
 * choisis par l'en-tête « X-Utilisateur-Dev ».
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private msal: PublicClientApplication | null = null;

  readonly modeDev = environment.auth.mode === 'dev';
  readonly compte = signal<AccountInfo | null>(null);
  /** Utilisateur fictif choisi en développement (chef, consultant ou pilotage). */
  readonly utilisateurDev = signal(lireStockage(CLE_UTILISATEUR_DEV) ?? 'chef');

  /** Appelé au démarrage de l'application, avant le premier écran. */
  async initialiser(): Promise<void> {
    if (this.modeDev) return;
    this.msal = new PublicClientApplication({
      auth: { clientId: environment.auth.clientId, authority: environment.auth.authority, redirectUri: window.location.origin },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await this.msal.initialize();
    const retour = await this.msal.handleRedirectPromise();
    const compte = retour?.account ?? this.msal.getAllAccounts()[0] ?? null;
    if (!compte) {
      // pas encore connecté : redirection vers la page de connexion de l'entreprise
      await this.msal.loginRedirect({ scopes: [environment.auth.scopeApi] });
      return;
    }
    this.msal.setActiveAccount(compte);
    this.compte.set(compte);
  }

  /** Jeton d'accès à l'API (renouvelé automatiquement), ou null en développement. */
  async jeton(): Promise<string | null> {
    if (!this.msal) return null;
    const compte = this.msal.getActiveAccount();
    if (!compte) return null;
    const demande = { scopes: [environment.auth.scopeApi], account: compte };
    try {
      return (await this.msal.acquireTokenSilent(demande)).accessToken;
    } catch (erreur) {
      if (erreur instanceof InteractionRequiredAuthError) await this.msal.acquireTokenRedirect(demande);
      throw erreur;
    }
  }

  /** Change l'utilisateur fictif (développement uniquement) et recharge la page. */
  changerUtilisateurDev(cle: string): void {
    ecrireStockage(CLE_UTILISATEUR_DEV, cle);
    this.utilisateurDev.set(cle);
    window.location.reload();
  }

  async deconnecter(): Promise<void> {
    await this.msal?.logoutRedirect();
  }
}

// Le stockage du navigateur peut être indisponible (navigation privée, réglages) : on ne bloque jamais l'application.
function lireStockage(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* sans conséquence */
  }
}
