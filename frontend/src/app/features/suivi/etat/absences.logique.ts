import { AbsenceEquipe } from '../api/modeles';
import { isWorkday } from './outils';

/**
 * Absences (traduction de 55c-absences.js, version HTML de référence) : une demi-journée (matin, après-midi) ou une journée.
 * Une absence appartient à la personne (saisie dans « Mon travail » ou par le chef de projet) : la personne est repérée par son nom
 * normalisé, comme sur le serveur (Personnes.Cle). Aucun effet sur les charges ni sur les calculs.
 */

export type Moment = 'j' | 'm' | 'a';

/** Libellé, phrase et nombre de jours de chaque moment. */
export const ABS: Record<Moment, [string, string, number]> = {
  j: ['Journée', 'absent toute la journée', 1],
  m: ['Matin', 'absent le matin', 0.5],
  a: ['Après-midi', 'absent l’après-midi', 0.5],
};

/** Un clic fait défiler : présent → journée → matin → après-midi → présent. */
export const ABS_SUITE: Record<'' | Moment, '' | Moment> = { '': 'j', j: 'm', m: 'a', a: '' };

/** « MARTIN Camille », « Camille  Martin » et « camille martin » donnent la même clé : « camille martin » (même règle que le serveur). */
export function clePersonne(nom: string | null | undefined): string {
  return String(nom ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** Une personne du planning des absences. */
export interface PersonneAbsences {
  nom: string;
  cle: string;
  /** Profils tenus (vide pour une personne ajoutée à la main). */
  profils: string[];
  /** Personne ajoutée à la main (identifiant pour la retirer). */
  ajoutee?: string;
}

/** Équipe : les collaborateurs nommés sur les profils (une ligne par personne, avec ses profils), puis les personnes ajoutées. */
export function equipe(profils: readonly { nom: string; collaborateur: string }[], ajoutees: readonly { id: string; nom: string }[]): PersonneAbsences[] {
  const l: PersonneAbsences[] = [];
  profils.forEach((p, i) => {
    const n = String(p.collaborateur || '').trim();
    if (!n) return;
    const cle = clePersonne(n);
    const x = l.find((y) => y.cle === cle);
    if (x) x.profils.push(p.nom || `Profil ${i + 1}`);
    else l.push({ nom: n, cle, profils: [p.nom || `Profil ${i + 1}`] });
  });
  for (const a of ajoutees) {
    const cle = clePersonne(a.nom);
    if (!l.some((y) => y.cle === cle)) l.push({ nom: a.nom, cle, profils: [], ajoutee: a.id });
  }
  return l;
}

/** Index des absences : personne (clé) → jour → moment. */
export function indexAbsences(absences: readonly AbsenceEquipe[] | null | undefined): Map<string, Map<string, Moment>> {
  const m = new Map<string, Map<string, Moment>>();
  for (const a of absences ?? []) {
    if (!m.has(a.personne)) m.set(a.personne, new Map());
    m.get(a.personne)!.set(a.jour, a.moment);
  }
  return m;
}

/** Jours d'absence d'une personne sur des jours (journée = 1, demi-journée = 0,5), jours ouvrés seulement. */
export function joursAbsence(idx: Map<string, Map<string, Moment>>, cle: string, jours: readonly string[]): number {
  const p = idx.get(cle);
  if (!p) return 0;
  return jours.filter(isWorkday).reduce((s, d) => s + (ABS[p.get(d) as Moment]?.[2] ?? 0), 0);
}

/** Absence du collaborateur d'un profil un jour donné (saisie du consommé, carte de chaleur). */
export function absenceProfil(idx: Map<string, Map<string, Moment>>, collaborateur: string | null | undefined, jour: string): '' | Moment {
  const n = String(collaborateur ?? '').trim();
  return n ? (idx.get(clePersonne(n))?.get(jour) ?? '') : '';
}
