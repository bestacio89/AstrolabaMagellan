import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { GestionnaireErreurs } from './core/erreurs/gestionnaire-erreurs';
import { erreursInterceptor } from './core/http/erreurs.interceptor';
import { TitreApplication } from './core/layout/titre';
import { SessionService } from './core/session/session.service';

registerLocaleData(localeFr);

/** Configuration de l'application : routes, appels HTTP, connexion, langue, gestion des erreurs. */
export const configurationApplication: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    provideHttpClient(withInterceptors([authInterceptor, erreursInterceptor])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: TitleStrategy, useClass: TitreApplication },
    { provide: ErrorHandler, useClass: GestionnaireErreurs },
    // Au démarrage : connexion (Entra ID), puis lecture de la personne connectée et de ses droits.
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const session = inject(SessionService);
      await auth.initialiser();
      await session.charger();
    }),
  ],
};
