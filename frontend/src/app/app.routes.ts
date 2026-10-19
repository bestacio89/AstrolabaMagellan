import { Routes } from '@angular/router';
import { exigerRoles } from './core/auth/roles.guard';
import { PageIntrouvable } from './core/layout/page-introuvable';

/**
 * Plan de l'application. Chaque module (« feature ») est chargé seulement quand on l'ouvre (chargement à la demande).
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projets' },
  {
    path: 'projets',
    loadChildren: () => import('./features/projets/projets.routes').then((m) => m.ROUTES_PROJETS),
  },
  {
    path: 'brouillons',
    loadChildren: () => import('./features/brouillons/brouillons.routes').then((m) => m.ROUTES_BROUILLONS),
  },
  {
    path: 'portefeuille',
    title: 'Portefeuille',
    loadComponent: () => import('./features/portefeuille/portefeuille').then((m) => m.Portefeuille),
  },
  {
    path: 'mon-travail',
    title: 'Mon travail',
    loadComponent: () => import('./features/travail/mon-travail').then((m) => m.MonTravail),
  },
  {
    path: 'administration',
    canMatch: [exigerRoles('Administrateur')],
    loadChildren: () => import('./features/administration/administration.routes').then((m) => m.ROUTES_ADMINISTRATION),
  },
  { path: '**', component: PageIntrouvable, title: 'Page introuvable' },
];
