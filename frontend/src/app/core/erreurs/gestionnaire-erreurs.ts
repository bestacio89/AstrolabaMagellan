import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, inject, Injectable } from '@angular/core';
import { NotificationsService } from '../notifications/notifications';

/**
 * Filet de sécurité pour les erreurs imprévues du code de l'interface :
 * on les trace dans la console et on prévient l'utilisateur sans bloquer l'écran.
 * (Les erreurs d'appel à l'API sont déjà signalées par l'intercepteur.)
 */
@Injectable()
export class GestionnaireErreurs implements ErrorHandler {
  private readonly notifications = inject(NotificationsService);

  handleError(erreur: unknown): void {
    console.error(erreur);
    if (erreur instanceof HttpErrorResponse) return;
    this.notifications.erreur('Une erreur inattendue s’est produite dans l’écran. Rechargez la page si le problème persiste.');
  }
}
