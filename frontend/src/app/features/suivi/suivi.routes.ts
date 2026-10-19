import { Routes } from '@angular/router';
import { ProjetSuivi } from './projet-suivi';

/**
 * Onglets de l'écran de suivi d'un projet (/projets/:id/…). Chaque onglet est chargé à la demande.
 * Les onglets de montants (Finances, Synthèse, Profils) ne sont proposés qu'aux rôles qui voient les montants ;
 * pour les autres, le serveur ne transmet de toute façon aucun montant.
 */
export const ROUTES_SUIVI: Routes = [
  {
    path: '',
    component: ProjetSuivi,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      { path: 'tableau-de-bord', title: 'Tableau de bord', loadComponent: () => import('./pages/tableau-de-bord').then((m) => m.TableauDeBord) },
      { path: 'point-hebdo', title: 'Point hebdo', loadComponent: () => import('./pages/point-hebdo').then((m) => m.PointHebdo) },
      { path: 'workload', title: 'Workload', loadComponent: () => import('./pages/workload').then((m) => m.Workload) },
      { path: 'gantt', title: 'Planning Gantt', loadComponent: () => import('./pages/gantt').then((m) => m.Gantt) },
      { path: 'ateliers', title: 'Ateliers & livrables', loadComponent: () => import('./pages/ateliers').then((m) => m.Ateliers) },
      { path: 'actions', title: 'Actions & décisions', loadComponent: () => import('./pages/actions').then((m) => m.Actions) },
      { path: 'rentabilite', title: 'Rentabilité', loadComponent: () => import('./pages/rentabilite').then((m) => m.Rentabilite) },
      { path: 'plan-de-charge', title: 'Plan de charge', loadComponent: () => import('./pages/plan-de-charge').then((m) => m.PlanDeCharge) },
      { path: 'facturation', title: 'Facturation', loadComponent: () => import('./pages/facturation').then((m) => m.Facturation) },
      { path: 'achats', title: 'Achats', loadComponent: () => import('./pages/depenses').then((m) => m.Achats) },
      { path: 'frais', title: 'Frais', loadComponent: () => import('./pages/depenses').then((m) => m.Frais) },
      { path: 'fiche', title: 'Fiche projet', loadComponent: () => import('./pages/tsp').then((m) => m.Fiche) },
      { path: 'synthese', title: 'Synthèse', loadComponent: () => import('./pages/tsp').then((m) => m.Synthese) },
      { path: 'profils', title: 'Profils', loadComponent: () => import('./pages/tsp').then((m) => m.Profils) },
      { path: 'chiffrage', title: 'Chiffrage', loadComponent: () => import('./pages/chiffrage').then((m) => m.Chiffrage) },
      { path: 'planning', title: 'Planning du TSP', loadComponent: () => import('./pages/tsp').then((m) => m.Planning) },
      { path: 'metrique', title: 'Métrique', loadComponent: () => import('./pages/tsp').then((m) => m.Metrique) },
      { path: 'ventilation', title: 'Ventilation', loadComponent: () => import('./pages/tsp').then((m) => m.Ventilation) },
      { path: 'parametres', title: 'Paramètres du projet', loadComponent: () => import('./pages/parametres').then((m) => m.Parametres) },
      { path: '**', redirectTo: 'tableau-de-bord' },
    ],
  },
];
