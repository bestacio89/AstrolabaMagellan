import { EcheanceSaisie, ProfilSaisi, TacheSaisie, TspSaisi } from '../api/brouillons.modeles';

/**
 * Règles d'affichage et de saisie de la rédaction d'un TSP : fonctions simples, sans Angular, testées sans navigateur
 * (brouillon.logique.spec.ts). Aucune règle de gestion ici : les chiffres officiels (synthèse, marge, contrôles) sont
 * calculés par le serveur, avec le moteur du projet. On ne fait que des totaux pour l'affichage immédiat.
 */

/** Nouvel identifiant court et unique dans une liste (« p4 », « t12 »…). */
export function nouvelId(prefixe: string, existants: readonly { id: string }[]): string {
  let max = 0;
  for (const e of existants) {
    const m = new RegExp(`^${prefixe}(\\d+)$`).exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (existants.some((e) => e.id === `${prefixe}${n}`)) n++;
  return `${prefixe}${n}`;
}

/** Arrondi d'affichage à 4 décimales (évite 0,1 + 0,2 = 0,30000000000000004). */
export function arrondi(v: number, decimales = 4): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

/** Charge totale d'une ligne du workload. */
export function chargeTache(t: TacheSaisie): number {
  return arrondi(Object.values(t.charges).reduce((s, v) => s + (v || 0), 0));
}

/** Charge totale d'un profil au workload. */
export function chargeProfil(tsp: TspSaisi, profilId: string): number {
  return arrondi(tsp.taches.reduce((s, t) => s + (t.charges[profilId] ?? 0), 0));
}

export function chargeTotale(tsp: TspSaisi): number {
  return arrondi(tsp.taches.reduce((s, t) => s + chargeTache(t), 0));
}

/** Valorisation d'une ligne : charge × TJM, remise déduite. */
export function valorisation(t: TacheSaisie, profils: readonly ProfilSaisi[], remise: number): number {
  return profils.reduce((s, p) => s + (t.charges[p.id] ?? 0) * p.tjm * (1 - remise), 0);
}

// ---------- mois ----------

/** « 2026-11 » + n mois. */
export function ajouterMois(mois: string, n: number): string {
  const a = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7)) - 1 + n;
  const annee = a + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${annee}-${String(mm + 1).padStart(2, '0')}`;
}

export function moisValide(m: string | null | undefined): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

/** Mois du planning : la période du projet, élargie aux mois déjà saisis (même règle que le serveur). */
export function moisDuPlanning(tsp: TspSaisi): string[] {
  const mois = new Set<string>();
  const { debut, fin } = tsp.fiche;
  if (debut && fin && fin >= debut) {
    for (let m = debut.slice(0, 7); m <= fin.slice(0, 7) && mois.size < 120; m = ajouterMois(m, 1)) mois.add(m);
  }
  for (const parMois of Object.values(tsp.planning)) for (const [m, v] of Object.entries(parMois)) if (v && moisValide(m)) mois.add(m);
  return [...mois].sort();
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-11 » → « nov. 2026 ». */
export function libelleMois(mois: string): string {
  return `${MOIS_COURTS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;
}

/** Le mois est-il dans la période du projet ? (vrai si la période n'est pas connue) */
export function dansLaPeriode(tsp: TspSaisi, mois: string): boolean {
  const { debut, fin } = tsp.fiche;
  if (!debut || !fin) return true;
  return mois >= debut.slice(0, 7) && mois <= fin.slice(0, 7);
}

/** Jours-homme répartis au planning pour un profil (sur les mois affichés). */
export function chargePlanifiee(tsp: TspSaisi, profilId: string): number {
  const parMois = tsp.planning[profilId] ?? {};
  return arrondi(Object.entries(parMois).reduce((s, [m, v]) => s + (moisValide(m) ? v || 0 : 0), 0));
}

/** Écart planning − workload d'un profil (négatif : des jours restent à répartir). */
export function ecartPlanning(tsp: TspSaisi, profilId: string): number {
  return arrondi(chargePlanifiee(tsp, profilId) - chargeProfil(tsp, profilId), 2);
}

/**
 * Répartit la charge d'un profil sur les mois de la période, par parts égales arrondies au quart de jour ;
 * le reste va au dernier mois (le total est toujours exact).
 */
export function repartirSurLaPeriode(charge: number, mois: readonly string[]): Record<string, number> {
  const resultat: Record<string, number> = {};
  if (!mois.length || charge <= 0) return resultat;
  const part = Math.floor((charge / mois.length) * 4) / 4;
  let reste = charge;
  mois.forEach((m, i) => {
    const v = i === mois.length - 1 ? arrondi(reste) : part;
    reste = arrondi(reste - v);
    if (v > 0) resultat[m] = v;
  });
  return resultat;
}

// ---------- saisie des nombres ----------

/** Lit un nombre saisi à la française (« 12,5 », « 1 200 », « 30 % » pour un pourcentage) ; null si illisible. Vide : 0. */
export function lireNombre(texte: string): number | null {
  const t = texte.replace(/[\s  €%]/g, '').replace(',', '.');
  if (t === '' || t === '-') return 0;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

/** Nombre affiché dans un champ de saisie : vide pour zéro, virgule décimale. */
export function texteNombre(v: number | null | undefined): string {
  if (!v) return '';
  return String(arrondi(v)).replace('.', ',');
}

// ---------- coller depuis Excel ----------

/**
 * Découpe un bloc copié depuis Excel (lignes séparées par un retour à la ligne, cellules par une tabulation ;
 * une cellule qui contient un retour à la ligne est entre guillemets). La dernière ligne vide est ignorée.
 */
export function lireCollage(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = '';
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"' && cellule === '') guillemets = true;
    else if (c === '\t') {
      ligne.push(cellule);
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = '';
    } else cellule += c;
  }
  if (cellule !== '' || ligne.length) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  return lignes.filter((l, i) => !(i === lignes.length - 1 && l.every((x) => x.trim() === '')));
}

/** Colonnes saisissables du workload, dans l'ordre de l'écran (et du TSP). */
export type ColonneWorkload = 'axe' | 'lot' | 'phase' | 'etape' | 'libelle' | `profil:${string}` | 'livrable' | 'hypothese';

export function colonnesWorkload(profils: readonly ProfilSaisi[]): ColonneWorkload[] {
  return ['axe', 'lot', 'phase', 'etape', 'libelle', ...profils.map((p) => `profil:${p.id}` as const), 'livrable', 'hypothese'];
}

/** Une ligne vierge du workload, qui reprend l'axe, le lot, la phase et l'étape de la ligne précédente. */
export function ligneVierge(id: string, precedente?: TacheSaisie): TacheSaisie {
  return {
    id,
    axe: precedente?.axe ?? '1',
    lot: precedente?.lot ?? '',
    phase: precedente?.phase ?? '',
    etape: precedente?.etape ?? '',
    libelle: '',
    charges: {},
    livrable: false,
    hypothese: '',
    separateur: false,
  };
}

/** Un séparateur vierge : un titre, sans aucune valeur. */
export function separateurVierge(id: string): TacheSaisie {
  return { id, axe: '', lot: '', phase: '', etape: '', libelle: '', charges: {}, livrable: false, hypothese: '', separateur: true };
}

/** Déplace une ligne (glisser-déposer) : elle prend la place « vers » ; les autres suivent. */
export function deplacerLigne<T>(lignes: T[], de: number, vers: number): void {
  if (de === vers || de < 0 || de >= lignes.length) return;
  const [ligne] = lignes.splice(de, 1);
  lignes.splice(Math.max(0, Math.min(vers, lignes.length)), 0, ligne);
}

/** Écrit une valeur saisie dans une colonne d'une ligne (les nombres illisibles sont ignorés). */
export function ecrireCellule(t: TacheSaisie, colonne: ColonneWorkload, valeur: string): void {
  if (colonne.startsWith('profil:')) {
    const n = lireNombre(valeur);
    if (n === null) return;
    const id = colonne.slice(7);
    if (n === 0) delete t.charges[id];
    else t.charges[id] = n;
  } else if (colonne === 'livrable') t.livrable = /^(oui|x|1|vrai|true|o)$/i.test(valeur.trim());
  else if (colonne === 'phase') t.phase = valeur.trim().toUpperCase();
  else (t as unknown as Record<string, string>)[colonne] = valeur.trim();
}

/**
 * Colle un bloc copié depuis Excel à partir d'une cellule : remplit les colonnes vers la droite et les lignes vers le bas,
 * en ajoutant les lignes qui manquent. Renvoie le nombre de lignes touchées.
 */
export function collerDansLeWorkload(
  tsp: TspSaisi,
  ligneDepart: number,
  colonneDepart: ColonneWorkload,
  bloc: readonly string[][],
): number {
  const colonnes = colonnesWorkload(tsp.profils);
  const c0 = Math.max(0, colonnes.indexOf(colonneDepart));
  bloc.forEach((valeurs, k) => {
    const index = ligneDepart + k;
    while (tsp.taches.length <= index) tsp.taches.push(ligneVierge(nouvelId('t', tsp.taches), tsp.taches[tsp.taches.length - 1]));
    const t = tsp.taches[index];
    valeurs.forEach((v, j) => {
      const colonne = colonnes[c0 + j];
      if (colonne) ecrireCellule(t, colonne, v);
    });
    // règle du TSP : une ligne avec un libellé et sans aucune charge est un titre de section (séparateur)
    t.separateur = !!t.libelle.trim() && chargeTache(t) === 0;
    if (t.separateur) Object.assign(t, { axe: '', lot: '', phase: '', etape: '', livrable: false, hypothese: '' });
  });
  return bloc.length;
}

/**
 * Lignes du workload à afficher. Un séparateur porte le total des lignes qui le suivent, jusqu'au séparateur suivant.
 */
export interface LigneAffichee {
  cle: string;
  index: number;
  separateur: boolean;
  /** Séparateur : total de sa section, et par profil. */
  total: number;
  parProfil: number[];
}

export function lignesAffichees(tsp: TspSaisi): LigneAffichee[] {
  return tsp.taches.map((t, index) => {
    if (!t.separateur) return { cle: t.id, index, separateur: false, total: 0, parProfil: [] };
    const section: TacheSaisie[] = [];
    for (let k = index + 1; k < tsp.taches.length && !tsp.taches[k].separateur; k++) section.push(tsp.taches[k]);
    return {
      cle: t.id,
      index,
      separateur: true,
      total: arrondi(section.reduce((s, x) => s + chargeTache(x), 0)),
      parProfil: tsp.profils.map((p) => arrondi(section.reduce((s, x) => s + (x.charges[p.id] ?? 0), 0))),
    };
  });
}

// ---------- échéancier ----------

export function totalEcheances(echeances: readonly EcheanceSaisie[]): number {
  return arrondi(echeances.reduce((s, e) => s + (e.pct || 0), 0), 6);
}

// ---------- état de l'enregistrement ----------

/** « Enregistré à l'instant », « il y a 12 s », « il y a 3 min », « à 14:05 ». */
export function depuis(date: Date | null, maintenant: Date): string {
  if (!date) return '';
  const s = Math.round((maintenant.getTime() - date.getTime()) / 1000);
  if (s < 5) return 'à l’instant';
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  return `à ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
