import { Routes } from '@angular/router';
import { Accueil } from './pages/accueil/accueil';

/**
 * Routes du module Projets : la page d'accueil, puis le suivi d'un projet (chargé à la demande).
 */
export const ROUTES_PROJETS: Routes = [
  { path: '', component: Accueil, title: 'Mes projets' },
  { path: ':id', loadChildren: () => import('../suivi/suivi.routes').then((m) => m.ROUTES_SUIVI) },
];
