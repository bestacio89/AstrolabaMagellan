import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Probleme } from '../../api/modeles';
import { NotificationsService } from '../notifications/notifications';

/** Placer ce jeton à « true » sur une requête pour que l'écran gère lui-même l'erreur (pas de message automatique). */
export const ERREUR_GEREE_PAR_L_ECRAN = new HttpContextToken<boolean>(() => false);

/** Transforme une réponse d'erreur de l'API en message clair pour l'utilisateur. */
export function messageErreur(erreur: unknown): string {
  if (!(erreur instanceof HttpErrorResponse)) return 'Une erreur inattendue s’est produite.';
  if (erreur.status === 0) return 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.';
  const probleme = (erreur.error ?? {}) as Probleme;
  if (probleme.errors) {
    const premiers = Object.values(probleme.errors).flat();
    if (premiers.length) return premiers.join(' ');
  }
  if (probleme.detail) return probleme.detail;
  if (erreur.status === 401) return 'Votre session a expiré : reconnectez-vous.';
  if (erreur.status === 403) return 'Vous n’avez pas le droit de faire cette action.';
  if (erreur.status === 404) return 'Élément introuvable.';
  return probleme.title ?? 'Une erreur inattendue s’est produite.';
}

/** Affiche un message pour toute erreur d'appel à l'API (sauf si l'écran la gère lui-même). */
export const erreursInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const notifications = inject(NotificationsService);
  return suivant(requete).pipe(
    catchError((erreur: unknown) => {
      if (!requete.context.get(ERREUR_GEREE_PAR_L_ECRAN)) notifications.erreur(messageErreur(erreur));
      return throwError(() => erreur);
    }),
  );
};
