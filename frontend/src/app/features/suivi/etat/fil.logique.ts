/**
 * Fil de mises à jour d'une tâche et liens de documents : mise en forme seulement.
 * Fonctions simples, testées sans navigateur (fil.logique.spec.ts).
 */

/** Morceau d'un message : texte simple ou mention d'une personne (« @Camille »). */
export interface Morceau {
  texte: string;
  mention: boolean;
}

/** Une mention : « @ » suivi de lettres (accents compris), chiffres, point, tiret ou trait bas. */
const MENTION = /(@[\p{L}\p{N}._-]+)/u;

/** Découpe un message pour mettre les mentions en évidence (sans jamais interpréter de HTML). */
export function morceaux(texte: string): Morceau[] {
  return texte
    .split(MENTION)
    .filter((m) => m.length > 0)
    .map((m) => ({ texte: m, mention: MENTION.test(m) && m.startsWith('@') }));
}

/** Le message mentionne-t-il cette personne ? (prénom, nom ou prénom.nom, sans tenir compte des accents ni des majuscules) */
export function mentionne(texte: string, prenom: string, nom: string): boolean {
  const simple = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const cibles = [prenom, nom, `${prenom}.${nom}`, `${prenom}${nom}`].filter((x) => x.trim().length > 0).map(simple);
  return morceaux(texte)
    .filter((m) => m.mention)
    .some((m) => cibles.includes(simple(m.texte.slice(1))));
}

/** Lien que le navigateur peut ouvrir directement (adresse web) ; un chemin réseau (\\serveur\…) se copie. */
export function lienOuvrable(lien: string | null | undefined): boolean {
  return !!lien && /^https?:\/\//i.test(lien);
}

/** Nom court d'un document à partir de son adresse : « Cahier_de_recette_v3.docx ». */
export function nomDocument(lien: string): string {
  const sansParametres = lien.split(/[?#]/)[0].replace(/[\\/]+$/, '');
  const dernier = sansParametres.split(/[\\/]/).pop() ?? lien;
  try {
    return decodeURIComponent(dernier) || lien;
  } catch {
    return dernier || lien;
  }
}

/** Initiales d'un nom complet (« Camille Martin » → « CM »). */
export function initialesDe(nomComplet: string): string {
  return nomComplet
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('');
}
