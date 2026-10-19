/**
 * Formats d'affichage de l'écran de suivi, identiques à ceux de la version de référence (POC v65).
 * « — » signale une valeur absente.
 */

const nfJ = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nfE = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nfP = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });
const nfE2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfP2 = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Nombre = number | null | undefined;

const absent = (v: Nombre): v is null | undefined => v == null || !isFinite(v);

/** Jours-homme : « 4,5 ». */
export const fJ = (v: Nombre): string => (absent(v) ? '—' : nfJ.format(Math.round(v * 100) / 100));
/** Jours-homme, vide si nul. */
export const fJz = (v: Nombre): string => (!v ? '' : fJ(v));
/** Euros sans centimes. */
export const fE = (v: Nombre): string => (absent(v) ? '—' : nfE.format(v));
/** Euros avec centimes. */
export const fE2 = (v: Nombre): string => (absent(v) ? '—' : nfE2.format(v));
/** Pourcentage (1 décimale au plus). */
export const fP = (v: Nombre): string => (absent(v) ? '—' : nfP.format(v));
/** Pourcentage à 2 décimales. */
export const fP2 = (v: Nombre): string => (absent(v) ? '—' : nfP2.format(v));

/** Date « AAAA-MM-JJ » → « JJ/MM/AAAA ». */
export const fD = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

/** Date (heure locale) d'un horodatage ISO complet. */
export function fDi(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fD(iso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Date et heure (heure locale) d'un horodatage ISO complet : « 06/10/2026 14:05 ». */
export function fDh(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fD(iso);
  return `${fDi(iso)} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Mois court : « oct. 26 ». */
export function fM(mk: string): string {
  const [y, m] = mk.split('-');
  return `${MOIS[+m - 1]} ${y.slice(2)}`;
}

/** Mois long : « octobre 2026 ». */
export function fML(mk: string): string {
  const [y, m] = mk.split('-');
  return `${MOIS_L[+m - 1]} ${y}`;
}

/** Classe de couleur d'un écart (positif = dépassement = rouge). */
export const sgn = (v: number): string => (v > 0.001 ? 'neg' : v < -0.001 ? 'pos' : '');

/** Écart signé en JH : « +0,5 », « −2 », « 0 ». */
export const fSigned = (v: number): string => (Math.abs(v) < 0.005 ? '0' : (v > 0 ? '+' : '') + fJ(v));

/** Montant signé : « +1 200 € », « −300 € ». */
export const fSignedE = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '') + fE(Math.abs(v));

/** Montant saisi (champ texte) : « 12,50 ». */
export const eurIn = (v: Nombre): string => (v ?? 0).toFixed(2).replace('.', ',');

/** Classe CSS d'un statut de tâche. */
export function stSlug(s: string | null | undefined): string {
  switch (s) {
    case 'À faire':
    case 'A faire':
      return 'afaire';
    case 'En cours':
      return 'encours';
    case 'Bloqué / En attente':
      return 'bloque';
    case 'En recette':
    case 'Test':
      return 'test';
    case 'Validé':
      return 'valide';
    case 'Annulée':
      return 'annul';
    default:
      return 'afaire';
  }
}

/** Classe CSS d'un statut d'action ou de décision. */
export function stCls(s: string | null | undefined): string {
  switch (s) {
    case 'En cours':
      return 'encours';
    case 'Fait':
    case 'Validée':
      return 'valide';
    case 'Annulée':
      return 'annul';
    case 'À valider':
      return 'test';
    case 'Rejetée':
      return 'bloque';
    default:
      return 'afaire';
  }
}

/** « ✓ 0 » si l'écart est nul, sinon « ✗ 2,5 » (planning du TSP). */
export const ecartMark = (v: number): string => (Math.abs(v) < 0.001 ? `✓ ${fJ(0)}` : `✗ ${fJ(v)}`);
export const ecartCls = (v: number): string => (Math.abs(v) < 0.001 ? 'ec ok' : 'ec ko');

/** Classe d'un écart en euros (au-delà de 50 centimes). */
export const eurCls = (v: number): string => (v > 0.5 ? 'neg' : v < -0.5 ? 'pos' : '');

/** Largeur d'une barre de progression (texte CSS « 42.0% »). */
export const largeur = (v: Nombre): string => `${Math.max(0, Math.min(100, (v || 0) * 100)).toFixed(1)}%`;
