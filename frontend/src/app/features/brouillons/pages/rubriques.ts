import { Rubrique } from '../api/brouillons.modeles';

/** Rubriques du TSP, dans l'ordre du menu (on les remplit dans l'ordre que l'on veut). */
export const RUBRIQUES: { cle: Rubrique; libelle: string; action: string }[] = [
  { cle: 'fiche', libelle: 'Fiche projet', action: 'compléter la fiche du projet' },
  { cle: 'profils', libelle: 'Profils et prix', action: 'ajouter les profils et leurs prix' },
  { cle: 'workload', libelle: 'Workload', action: 'chiffrer le workload' },
  { cle: 'planning', libelle: 'Planning mensuel', action: 'répartir la charge sur les mois' },
  { cle: 'echeancier', libelle: 'Échéancier', action: 'saisir l’échéancier de facturation' },
  { cle: 'depenses', libelle: 'Achats et frais', action: 'ajouter les achats et les frais' },
];

/** Rubriques à remplir pour lancer le projet (les achats et frais sont facultatifs). */
export const RUBRIQUES_OBLIGATOIRES = RUBRIQUES.filter((r) => r.cle !== 'depenses');
