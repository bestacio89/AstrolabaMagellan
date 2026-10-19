/**
 * Mise en forme des nombres, montants et dates, à la française.
 * Fonctions simples (sans Angular) : utilisables partout et faciles à tester.
 */

const nombreJh = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Jours-homme : « 4,5 ». */
export function formatJh(valeur: number | null | undefined): string {
  return valeur == null ? '—' : nombreJh.format(Math.round(valeur * 100) / 100);
}

/** Écart signé : « +0,5 » ou « −6 » (vrai signe moins typographique). */
export function formatEcart(valeur: number | null | undefined): string {
  if (valeur == null) return '—';
  const arrondi = Math.round(valeur * 100) / 100;
  if (arrondi === 0) return '0';
  return (arrondi > 0 ? '+' : '−') + nombreJh.format(Math.abs(arrondi));
}

/** Montant en euros sans centimes : « 12 500 € ». */
export function formatEuros(valeur: number | null | undefined): string {
  return valeur == null ? '—' : euros.format(valeur);
}

/** Pourcentage à partir d'un ratio (0,5358 → « 53,58 % »). */
export function formatPourcentage(ratio: number | null | undefined, decimales = 0): string {
  if (ratio == null || !isFinite(ratio)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(ratio);
}

/** Date « AAAA-MM-JJ » (format de l'API) en « JJ/MM/AAAA », sans passer par les fuseaux horaires. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}

/** Date du jour au format « AAAA-MM-JJ », à l'heure locale. */
export function aujourdhuiIso(maintenant = new Date()): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

/** Ton visuel d'une pastille. */
export type Ton = 'ok' | 'attention' | 'critique' | 'neutre' | 'info';

/**
 * Lecture de l'atterrissage d'un projet : écart entre ce qui sera consommé à la fin et ce qui est prévu.
 * Seuils (à ajuster avec les chefs de projet) : économie ≥ 0,5 JH → « Optimisation » ;
 * dépassement jusqu'à 1 JH ou 2 % du prévu → « Dans la cible » ; jusqu'à 10 % → « À surveiller » ; au-delà → « Dépassement ».
 */
export function lectureAtterrissage(ecart: number, prevu: number): { libelle: string; ton: Ton } {
  if (ecart <= -0.5) return { libelle: 'Optimisation', ton: 'ok' };
  if (ecart <= Math.max(1, prevu * 0.02)) return { libelle: 'Dans la cible', ton: 'ok' };
  if (ecart <= prevu * 0.1) return { libelle: 'À surveiller', ton: 'attention' };
  return { libelle: 'Dépassement', ton: 'critique' };
}

/** Initiales d'une personne : « Camille Martin » → « CM ». */
export function initiales(prenom: string, nom: string): string {
  return ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase() || '?';
}

/** Couleurs de repère des projets. */
const COULEURS_PROJET = ['#1d6ce0', '#e2711d', '#1ba672', '#8c5fe0', '#e0559b', '#0e8fa8'];

/** Couleur de repère d'un projet : toujours la même pour un projet donné (barre latérale, liste). */
export function couleurProjet(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS_PROJET[h % COULEURS_PROJET.length];
}
