import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Ajoute l'identité de l'utilisateur à chaque appel de l'API :
 * le jeton Entra ID en production, l'utilisateur fictif en développement.
 */
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  if (!requete.url.startsWith(environment.api)) return suivant(requete);
  const auth = inject(AuthService);
  if (auth.modeDev) {
    return suivant(requete.clone({ setHeaders: { 'X-Utilisateur-Dev': auth.utilisateurDev() } }));
  }
  return from(auth.jeton()).pipe(
    switchMap((jeton) => suivant(jeton ? requete.clone({ setHeaders: { Authorization: `Bearer ${jeton}` } }) : requete)),
  );
};
