import { ProjetResume } from '../../api/modeles';
import { lectureAtterrissage, Ton } from '../../shared/format/formats';

/**
 * Portefeuille (point du lundi) : tous les projets actifs sur une ligne chacun, les plus fragiles d'abord.
 * Aucun calcul de gestion ici : les indicateurs viennent du serveur (liste des projets) ; on les classe et on les résume.
 * Fonctions simples, testées sans navigateur (portefeuille.logique.spec.ts).
 */

export interface LignePortefeuille {
  projet: ProjetResume;
  sante: { libelle: string; ton: Ton };
  /** Part du temps écoulé entre le début et la fin prévue (0 à 1), si les dates sont connues. */
  tempsEcoule: number | null;
  /** L'avancement a plus de 10 points de retard sur le temps écoulé. */
  enRetardSurLeTemps: boolean;
  /** Points à traiter critiques (en retard, dépassement…). */
  critiques: number;
  /** Écart entre la marge à l'atterrissage et la marge vendue (en points ; null si non visible). */
  ecartMarge: number | null;
}

/** Ordre d'affichage : les projets en difficulté d'abord. */
const RANG: Record<Ton, number> = { critique: 0, attention: 1, info: 2, ok: 3, neutre: 4 };

/** Part du temps écoulé : (aujourd'hui − début) ÷ (fin − début), bornée entre 0 et 1. */
export function tempsEcoule(p: ProjetResume, aujourdhui: string): number | null {
  const fin = p.finPrevue ?? p.finContractuelle;
  if (!p.debut || !fin || fin <= p.debut) return null;
  const jour = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const r = (jour(aujourdhui) - jour(p.debut)) / (jour(fin) - jour(p.debut));
  return Math.max(0, Math.min(1, r));
}

export function ligne(p: ProjetResume, aujourdhui: string): LignePortefeuille {
  const temps = tempsEcoule(p, aujourdhui);
  return {
    projet: p,
    sante: p.estVide ? { libelle: 'À préparer', ton: 'neutre' } : lectureAtterrissage(p.ecart, p.prevu),
    tempsEcoule: temps,
    enRetardSurLeTemps: !p.estVide && temps !== null && p.avancement < temps - 0.1,
    critiques: p.aTraiter.filter((x) => x.niveau === 'critique').length,
    ecartMarge: p.tauxMargeAtterrissage != null && p.tauxMargeVendue != null ? p.tauxMargeAtterrissage - p.tauxMargeVendue : null,
  };
}

/** Projets actifs (en cours ou en préparation), éventuellement d'un seul chef de projet, les plus fragiles d'abord. */
export function lignesPortefeuille(projets: readonly ProjetResume[], aujourdhui: string, chef = ''): LignePortefeuille[] {
  return projets
    .filter((p) => p.statutCode === 'EnCours' || p.statutCode === 'EnPreparation')
    .filter((p) => !chef || p.chefDeProjet === chef)
    .map((p) => ligne(p, aujourdhui))
    .sort(
      (a, b) =>
        RANG[a.sante.ton] - RANG[b.sante.ton] ||
        Number(b.enRetardSurLeTemps) - Number(a.enRetardSurLeTemps) ||
        b.critiques - a.critiques ||
        b.projet.ecart - a.projet.ecart ||
        a.projet.client.localeCompare(b.projet.client, 'fr'),
    );
}

export interface SynthesePortefeuille {
  actifs: number;
  enDerive: number;
  aSurveiller: number;
  enRetardSurLeTemps: number;
  /** Projets dont la marge à l'atterrissage est sous la marge vendue (parmi ceux dont on voit la marge). */
  sousMargeVendue: number;
  avecMarge: number;
  pointsCritiques: number;
}

export function synthese(lignes: readonly LignePortefeuille[]): SynthesePortefeuille {
  const avecMarge = lignes.filter((l) => l.ecartMarge !== null);
  return {
    actifs: lignes.length,
    enDerive: lignes.filter((l) => l.sante.ton === 'critique').length,
    aSurveiller: lignes.filter((l) => l.sante.ton === 'attention').length,
    enRetardSurLeTemps: lignes.filter((l) => l.enRetardSurLeTemps).length,
    sousMargeVendue: avecMarge.filter((l) => (l.ecartMarge ?? 0) < -0.0005).length,
    avecMarge: avecMarge.length,
    pointsCritiques: lignes.reduce((n, l) => n + l.critiques, 0),
  };
}

/** Chefs de projet présents dans la liste (pour le filtre). */
export function chefs(projets: readonly ProjetResume[]): string[] {
  return [...new Set(projets.map((p) => p.chefDeProjet).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Lundi de la semaine d'une date (« semaine du … »). */
export function lundi(aujourdhui: string): string {
  const d = new Date(Date.UTC(+aujourdhui.slice(0, 4), +aujourdhui.slice(5, 7) - 1, +aujourdhui.slice(8, 10)));
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}
