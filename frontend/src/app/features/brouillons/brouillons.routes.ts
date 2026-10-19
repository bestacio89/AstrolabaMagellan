import { Routes } from '@angular/router';
import { Redaction } from './pages/redaction';

/**
 * Rédaction du TSP d'un nouveau projet (/brouillons/:id/…). Chaque rubrique est chargée à la demande ;
 * on passe de l'une à l'autre dans l'ordre que l'on veut.
 */
export const ROUTES_BROUILLONS: Routes = [
  {
    path: ':id',
    component: Redaction,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'fiche' },
      { path: 'fiche', title: 'Nouveau projet · Fiche', loadComponent: () => import('./pages/fiche').then((m) => m.FicheBrouillon) },
      { path: 'profils', title: 'Nouveau projet · Profils et prix', loadComponent: () => import('./pages/profils').then((m) => m.ProfilsBrouillon) },
      { path: 'workload', title: 'Nouveau projet · Workload', loadComponent: () => import('./pages/workload').then((m) => m.WorkloadBrouillon) },
      { path: 'planning', title: 'Nouveau projet · Planning mensuel', loadComponent: () => import('./pages/planning').then((m) => m.PlanningBrouillon) },
      { path: 'echeancier', title: 'Nouveau projet · Échéancier', loadComponent: () => import('./pages/echeancier').then((m) => m.EcheancierBrouillon) },
      { path: 'depenses', title: 'Nouveau projet · Achats et frais', loadComponent: () => import('./pages/depenses').then((m) => m.DepensesBrouillon) },
      { path: 'synthese', title: 'Nouveau projet · Synthèse', loadComponent: () => import('./pages/synthese').then((m) => m.SyntheseBrouillon) },
      { path: 'lancer', title: 'Nouveau projet · Prêt à lancer ?', loadComponent: () => import('./pages/lancer').then((m) => m.LancerBrouillon) },
    ],
  },
];
