import { PointATraiter, ProjetResume } from '../../../api/modeles';
import { lectureAtterrissage, Ton } from '../../../shared/format/formats';

/**
 * Règles d'affichage de la page « Mes projets », écrites comme de simples fonctions :
 * faciles à lire et à tester (voir accueil.logique.spec.ts).
 */

export type Filtre = 'actifs' | 'en-cours' | 'en-preparation';
export type Tri = 'a-traiter' | 'fin' | 'ecart' | 'client';

export const FILTRES: { code: Filtre; libelle: string }[] = [
  { code: 'actifs', libelle: 'Actifs' },
  { code: 'en-cours', libelle: 'En cours' },
  { code: 'en-preparation', libelle: 'En préparation' },
];

export const TRIS: { code: Tri; libelle: string }[] = [
  { code: 'a-traiter', libelle: 'À traiter d’abord' },
  { code: 'fin', libelle: 'Fin prévue la plus proche' },
  { code: 'ecart', libelle: 'Écart le plus fort' },
  { code: 'client', libelle: 'Nom du client' },
];

export function correspondAuFiltre(projet: ProjetResume, filtre: Filtre): boolean {
  switch (filtre) {
    case 'actifs':
      return projet.statutCode === 'EnCours' || projet.statutCode === 'EnPreparation';
    case 'en-cours':
      return projet.statutCode === 'EnCours';
    case 'en-preparation':
      return projet.statutCode === 'EnPreparation';
  }
}

/** Recherche sans tenir compte des accents ni des majuscules, dans le nom, le client et la référence. */
export function correspondALaRecherche(projet: ProjetResume, recherche: string): boolean {
  const simplifier = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  const cherche = simplifier(recherche.trim());
  if (!cherche) return true;
  return simplifier(`${projet.nom} ${projet.client} ${projet.reference ?? ''}`).includes(cherche);
}

export function trier(projets: ProjetResume[], tri: Tri): ProjetResume[] {
  const copie = [...projets];
  const fin = (p: ProjetResume) => p.finPrevue ?? p.finContractuelle ?? '9999-12-31';
  switch (tri) {
    case 'a-traiter':
      return copie.sort((a, b) => b.nombreATraiter - a.nombreATraiter || a.client.localeCompare(b.client, 'fr'));
    case 'fin':
      return copie.sort((a, b) => fin(a).localeCompare(fin(b)));
    case 'ecart':
      return copie.sort((a, b) => b.ecart - a.ecart);
    case 'client':
      return copie.sort((a, b) => a.client.localeCompare(b.client, 'fr') || a.nom.localeCompare(b.nom, 'fr'));
  }
}

export function filtrerEtTrier(projets: ProjetResume[], filtre: Filtre, recherche: string, tri: Tri): ProjetResume[] {
  return trier(
    projets.filter((p) => correspondAuFiltre(p, filtre) && correspondALaRecherche(p, recherche)),
    tri,
  );
}

export function compter(projets: ProjetResume[]): Record<Filtre, number> {
  return {
    actifs: projets.filter((p) => correspondAuFiltre(p, 'actifs')).length,
    'en-cours': projets.filter((p) => correspondAuFiltre(p, 'en-cours')).length,
    'en-preparation': projets.filter((p) => correspondAuFiltre(p, 'en-preparation')).length,
  };
}

/** Catégorie d'un point à traiter : étiquette, et écran où le traiter. */
export interface Categorie {
  libelle: string;
  /** Écran du projet (chemin relatif à /projets/:id ; vide = tableau de bord). */
  ecran: string;
  lien: string;
}

export function categorie(cle: string): Categorie {
  switch (cle) {
    case 'echeances':
    case 'echapres':
      return { libelle: 'Facturation', ecran: 'facturation', lien: 'Voir la facturation' };
    case 'reestimer':
    case 'incoherent':
      return { libelle: 'Reste à faire', ecran: 'workload', lien: 'Ouvrir les tâches' };
    case 'depassement':
    case 'ecart':
      return { libelle: 'Charge', ecran: 'workload', lien: 'Ouvrir les tâches' };
    case 'bloque':
    case 'sansAxe':
      return { libelle: 'Tâches', ecran: 'workload', lien: 'Ouvrir les tâches' };
    case 'jour':
    case 'hors':
    case 'sansConso':
      return { libelle: 'Temps passé', ecran: 'workload', lien: 'Ouvrir les saisies' };
    case 'ajouts':
      return { libelle: 'Périmètre', ecran: 'workload', lien: 'Voir les ajouts' };
    case 'actions':
    case 'decisions':
    case 'risques':
      return { libelle: 'Gouvernance', ecran: 'actions', lien: 'Ouvrir les actions et décisions' };
    case 'achats':
      return { libelle: 'Finances', ecran: 'achats', lien: 'Voir les achats' };
    case 'frais':
      return { libelle: 'Finances', ecran: 'frais', lien: 'Voir les frais' };
    case 'cout':
      return { libelle: 'Finances', ecran: 'plan-de-charge', lien: 'Voir le plan de charge' };
    case 'dates':
      return { libelle: 'Planning', ecran: 'parametres', lien: 'Renseigner les dates' };
    case 'gliss':
    case 'apresfin':
    case 'avantdebut':
    case 'moishors':
    case 'rythme':
      return { libelle: 'Planning', ecran: 'gantt', lien: 'Voir le planning' };
    case 'preparation':
      return { libelle: 'Préparation', ecran: '', lien: 'Compléter le projet' };
    default:
      return { libelle: 'À vérifier', ecran: '', lien: 'Ouvrir le projet' };
  }
}

export function tonDuNiveau(niveau: PointATraiter['niveau']): Ton {
  return niveau === 'critique' ? 'critique' : niveau === 'attention' ? 'attention' : 'neutre';
}

/** Un point à traiter, avec son projet : pour le bloc « À traiter sur vos projets ». */
export interface PointDeProjet {
  projetId: string;
  projet: string;
  point: PointATraiter;
  categorie: Categorie;
}

/** Points à traiter de tous les projets actifs : les critiques d'abord. */
export function pointsDesProjets(projets: ProjetResume[], maximum = 8): PointDeProjet[] {
  const ordre: Record<PointATraiter['niveau'], number> = { critique: 0, attention: 1, neutre: 2 };
  return projets
    .filter((p) => correspondAuFiltre(p, 'actifs'))
    .flatMap((p) =>
      p.aTraiter.map((point) => ({ projetId: p.id, projet: `${p.client} — ${p.nom}`, point, categorie: categorie(point.cle) })),
    )
    .sort((a, b) => ordre[a.point.niveau] - ordre[b.point.niveau])
    .slice(0, maximum);
}

/** Chiffres clés de l'accueil, sur les projets actifs (en cours ou en préparation). */
export interface ChiffresCles {
  actifs: number;
  dansLaCible: number;
  consomme: number;
  prevu: number;
}

export function chiffresCles(projets: ProjetResume[]): ChiffresCles {
  const actifs = projets.filter((p) => p.statutCode === 'EnCours' || p.statutCode === 'EnPreparation');
  const suivis = actifs.filter((p) => !p.estVide);
  return {
    actifs: actifs.length,
    dansLaCible: suivis.filter((p) => lectureAtterrissage(p.ecart, p.prevu).ton === 'ok').length,
    consomme: suivis.reduce((n, p) => n + p.consomme, 0),
    prevu: suivis.reduce((n, p) => n + p.prevu, 0),
  };
}
