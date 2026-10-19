import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { SessionService } from '../session/session.service';

/**
 * Garde de route par rôle global. Exemple : canMatch: [exigerRoles('Administrateur')].
 * C'est un confort d'affichage : la vraie protection est faite par l'API, qui vérifie chaque appel.
 */
export function exigerRoles(...roles: string[]): CanMatchFn {
  return () => {
    const session = inject(SessionService);
    return session.aLeRole(...roles) ? true : inject(Router).createUrlTree(['/projets']);
  };
}
