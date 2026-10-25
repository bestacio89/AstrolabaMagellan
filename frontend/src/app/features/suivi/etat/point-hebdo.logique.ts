/**
 * Point hebdo (ou mensuel) : les données de la diapositive de suivi delivery, calculées pour une période.
 * Les chiffres viennent des indicateurs du serveur ; le chef de projet complète le reste (actualités, points d'attention,
 * indicateurs, météo). Fonctions simples, testées sans navigateur (point-hebdo.logique.spec.ts).
 * Même règles que la version fichier unique (45-point-hebdo.js).
 */

import { riskNiveau } from './constantes';

/** Niveau d'un indicateur : légende du support « Suivi Delivery ». */
export type Niveau = 'vert' | 'jaune' | 'rouge' | 'gris';
export type Meteo = 'soleil' | 'nuage' | 'orage';
export type Tendance = 'vert' | 'jaune' | 'rouge';
export type TypePeriode = 'quinzaine' | 'semaine' | 'mois';

export const COULEURS = {
  marine: '003C5A', bleu: '00B9FF', texte: '003C5A', doux: '5B7083', vert: '009581', jaune: 'FFCC66', rouge: 'C30045', neutre: 'BFC7CE', blanc: 'FFFFFF', fond: 'F4F7F9',
} as const;

export const NIVEAUX: Record<Niveau, { couleur: string; libelle: string }> = {
  vert: { couleur: COULEURS.vert, libelle: 'Bon' },
  jaune: { couleur: COULEURS.jaune, libelle: 'Vigilance' },
  rouge: { couleur: COULEURS.rouge, libelle: 'Critique' },
  gris: { couleur: COULEURS.neutre, libelle: 'Fini / non commencé' },
};
export const LISTE_NIVEAUX: Niveau[] = ['vert', 'jaune', 'rouge', 'gris'];

export const INDICATEURS = [
  ['planning', 'Planning'], ['qualite', 'Qualité'], ['perimetre', 'Périmètre'], ['budget', 'Budget'], ['ressources', 'Ressources'], ['facturation', 'Facturation'], ['satisfaction', 'Satisfaction client'], ['esprit', 'État d’esprit interne'],
] as const;
export type CleIndicateur = (typeof INDICATEURS)[number][0];

// ---- ce que le serveur garde (PointsHebdoService) ----
export interface MeteoSaisie {
  meteo: Meteo;
  tendance: Tendance;
}
export interface SaisiePeriode {
  actualites: string[];
  attention: string[];
  indicateurs: Partial<Record<CleIndicateur, { s: Niveau; s1: Niveau }>>;
  satisfaction?: MeteoSaisie | null;
  esprit?: MeteoSaisie | null;
  extension: 'Oui' | 'Non';
  aEvoquer?: boolean;
  difficulte?: string;
  impact?: string;
  genereLe?: string | null;
  majLe?: string;
  par?: string;
}
export interface ReglagesPointHebdo {
  commercial?: string;
  avv?: string;
  pilote?: string;
  modeFacturation?: string;
  logoClient?: string;
  logoEntreprise?: string;
}
export interface PointsHebdo {
  reglages: ReglagesPointHebdo;
  periodes: Record<string, SaisiePeriode>;
}

// ---- ce dont le calcul a besoin (extrait de la vue du suivi) ----
export interface EntreePointHebdo {
  P: { tjmR?: number; tjm?: number; collaborateur: string }[];
  taches: {
    phase: string; chargesV: number[]; chargeTSP: number; charge: number; restP: number[]; raf: number; annulee: boolean; statut: string;
    debut?: string | null; fin?: string | null; tr: { consoP?: Record<string, Record<string, number>> | null };
  }[];
  caTSP: number | null;
  chargeAjout: number;
  chargeAnnulee: number;
  echeancier: { n: number; nom: string; pct: number; mois: string | null; montant?: number; datePrevue: string | null; realiseLe: string | null; payeeLe: string | null }[];
  risques: { libelle: string; parade: string; crit: number }[];
  actions: { libelle: string; porteur: string; statut: string; echeance: string | null; commentaire: string; faitLe: string | null }[];
  fiche: { client: string; projet: string; typeContrat: string; champs: { key: string; value: string }[] };
  dates: { debut: string | null; finContrat: string | null; finPrevue: string | null };
  iaProfile: number;
}

export interface Phase {
  phase: string; vendu: number; conso: number; v: number; c: number; raf: number; m1: number; prevu: number; atter: number; valoAtter: number; tend: Niveau;
}
export interface Echeance { n: number; nom: string; pct: number; mois: string | null; montant: number; statut: 'Payée' | 'Facturée' | 'En retard' | 'Planifiée' }
export interface DonneesDiapo {
  client: string; projet: string;
  periode: { type: TypePeriode; debut: string; fin: string; numero: number; mois: string; moisSuivant: string; libelleMois: string; libelleMoisSuivant: string; colS: string; colS1: string };
  typologie: string; modeFacturation: string; debut: string | null; fin: string | null; glissement: number;
  budgetInitial: number | null; budgetConsomme: number; avancement: number; prevu: number; conso: number; raf: number; atterrissage: number; facture: number;
  commercial: string; avv: string; pilote: string; consultants: string[]; extension: string;
  actualites: string[]; attention: string[];
  phases: Phase[]; echeances: Echeance[];
  indicateurs: { cle: CleIndicateur; libelle: string; s: Niveau; s1: Niveau; propose: Niveau; raison: string }[];
  risques: { libelle: string; parade: string; niveau: Niveau }[];
  actions: { libelle: string; pilote: string; echeance: string; statut: string; commentaire: string; retard: boolean }[];
  satisfaction: MeteoSaisie; esprit: MeteoSaisie;
  genereLe: string; logoClient: string | null; logoEntreprise: string | null;
}

// ---- dates ----
export const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const utc = (iso: string): number => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const versIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const plusJours = (d: string, n: number): string => versIso(utc(d) + n * 86400000);
export const lundiDe = (d: string): string => plusJours(d, -((new Date(utc(d)).getUTCDay() + 6) % 7));
export const moisSuivant = (mk: string): string => {
  const y = +mk.slice(0, 4), m = +mk.slice(5, 7);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
export const moisPrecedent = (mk: string): string => {
  const y = +mk.slice(0, 4), m = +mk.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
/** Numéro de semaine ISO 8601. */
export function numeroSemaine(d: string): number {
  const t = new Date(utc(d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const premier = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - premier.getTime()) / 86400000 - 3 + ((premier.getUTCDay() + 6) % 7)) / 7);
}
const ouvre = (d: string): boolean => { const j = new Date(utc(d)).getUTCDay(); return j !== 0 && j !== 6; };
function joursOuvres(de: string, a: string): number {
  let n = 0;
  for (let d = de; d <= a; d = plusJours(d, 1)) if (ouvre(d)) n++;
  return n;
}

/** Clé d'une période, comme le serveur la range : « S:lundi » ou « M:AAAA-MM ». */
export const clePeriode = (type: TypePeriode, semaine: string, mois: string, seance = semaine): string => type === 'mois' ? `M:${mois}` : type === 'quinzaine' ? `Q:${seance}` : `S:${semaine}`;

// ---- formats de la diapositive (espaces ordinaires : PowerPoint n'a pas toujours l'espace fine) ----
const nfE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfJ = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const esp = (s: string): string => s.replace(/[  ]/g, ' ');
export const fE = (v: number | null | undefined): string => (v == null || !isFinite(v) ? '—' : esp(nfE.format(Math.round(v))) + ' €');
export const fJ = (v: number | null | undefined): string => (v == null || !isFinite(v) ? '—' : esp(nfJ.format(Math.round(v * 10) / 10)));
export const fD = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const fM = (mk: string | null): string => (mk ? `${MOIS[+mk.slice(5, 7) - 1]}-${mk.slice(2, 4)}` : '—');
const somme = (l: readonly number[]): number => l.reduce((s, v) => s + (isFinite(v) ? v : 0), 0);

/**
 * Saisie à afficher pour une période : celle enregistrée, sinon reprise de la précédente période du même type
 * (points d'attention, appréciations qualité et ressources — la prévision devient la valeur —, météo, extension).
 * Les actualités repartent de zéro.
 */
export function saisieDeLaPeriode(points: PointsHebdo | null | undefined, cle: string): { saisie: SaisiePeriode; enregistree: boolean; reprise: string | null } {
  const periodes = points?.periodes ?? {};
  if (periodes[cle]) return { saisie: periodes[cle], enregistree: true, reprise: null };
  const prec = Object.keys(periodes).filter((k) => k[0] === cle[0] && k < cle).sort().pop() ?? null;
  const p = prec ? periodes[prec] : null;
  const indicateurs: SaisiePeriode['indicateurs'] = {};
  for (const c of ['qualite', 'ressources'] as const) {
    const i = p?.indicateurs?.[c];
    if (i) indicateurs[c] = { s: i.s1 || i.s, s1: i.s1 || i.s };
  }
  return {
    saisie: { actualites: [], attention: p?.attention ?? [], indicateurs, satisfaction: p?.satisfaction ?? null, esprit: p?.esprit ?? null, extension: p?.extension ?? 'Non' },
    enregistree: false,
    reprise: prec,
  };
}

/**
 * Données de la diapositive pour la période choisie. Le consommé est compté jusqu'au dernier jour de la période
 * (vendredi de la semaine, ou fin du mois) et valorisé au TJM (prix de vente).
 */
export function donneesDiapo(e: EntreePointHebdo, o: {
  periode: TypePeriode; semaine: string; mois: string; seance?: string; aujourdhui: string; saisie: SaisiePeriode; reglages: ReglagesPointHebdo; logoEntrepriseParDefaut: string | null;
}): DonneesDiapo {
  const typeP = o.periode;
  const debut = typeP === 'mois' ? `${o.mois}-01` : typeP === 'quinzaine' ? plusJours(o.seance ?? o.semaine, -13) : lundiDe(o.semaine);
  const fin = typeP === 'mois' ? plusJours(`${moisSuivant(o.mois)}-01`, -1) : typeP === 'quinzaine' ? (o.seance ?? o.semaine) : plusJours(debut, 4);
  const mois = fin.slice(0, 7), m1 = moisSuivant(mois);
  const s = o.saisie, r = o.reglages, P = e.P;
  const tjm = (i: number): number => P[i]?.tjmR ?? P[i]?.tjm ?? 0;
  const consoA = (t: EntreePointHebdo['taches'][number], i: number): number =>
    somme(Object.entries(t.tr.consoP?.[String(i)] ?? {}).filter(([d]) => d <= fin).map(([, v]) => v));
  const fiche = Object.fromEntries((e.fiche.champs ?? []).map((c) => [c.key, c.value]));
  // ---- par phase : budget (€, au TJM) et charges (jours) ----
  const phases: Phase[] = [];
  for (const t of e.taches) {
    const nom = t.phase || 'Sans phase';
    let ph = phases.find((x) => x.phase === nom);
    if (!ph) phases.push((ph = { phase: nom, vendu: 0, conso: 0, v: 0, c: 0, raf: 0, m1: 0, prevu: 0, atter: 0, valoAtter: 0, tend: 'vert' }));
    let consoTache = 0;
    P.forEach((_, i) => {
      const c = consoA(t, i);
      consoTache += c;
      ph.vendu += (t.chargesV[i] ?? 0) * tjm(i);
      ph.conso += c * tjm(i);
      ph.c += c;
      ph.valoAtter += (c + (t.restP[i] ?? 0)) * tjm(i);
    });
    ph.v += t.chargeTSP;
    ph.prevu += t.charge;
    const raf = t.annulee || t.statut === 'Validé' ? 0 : t.raf;
    ph.raf += raf;
    ph.atter += consoTache + raf;
    // prévision du mois suivant : le reste à faire réparti sur les jours ouvrés jusqu'à la fin prévue de la tâche
    if (raf > 0 && t.fin) {
      const apres = plusJours(fin, 1);
      const de = apres > (t.debut ?? '') ? apres : (t.debut as string), a = t.fin;
      const debM1 = `${m1}-01`, finM1 = plusJours(`${moisSuivant(m1)}-01`, -1);
      const tot = de <= a ? joursOuvres(de, a) : 0;
      if (tot > 0) {
        const x = de > debM1 ? de : debM1, y = a < finM1 ? a : finM1;
        if (x <= y) ph.m1 += (raf * joursOuvres(x, y)) / tot;
      }
    }
  }
  // tendance : atterrissage comparé au prévu (légende : dérive < 1 % = vigilance, > 1 % = critique)
  const tendance = (atter: number, prevu: number): Niveau =>
    prevu <= 0 ? (atter > 0 ? 'rouge' : 'vert') : atter / prevu - 1 > 0.01 ? 'rouge' : atter / prevu - 1 > 0.0001 ? 'jaune' : 'vert';
  phases.forEach((ph) => (ph.tend = tendance(ph.atter, ph.prevu)));
  // ---- totaux ----
  const prevu = somme(e.taches.map((t) => t.charge)), conso = somme(phases.map((p) => p.c)), raf = somme(phases.map((p) => p.raf));
  const d = e.dates;
  const glissement = d.finPrevue && d.finContrat ? Math.round((utc(d.finPrevue) - utc(d.finContrat)) / 86400000) : 0;
  // ---- échéancier ----
  const echeances: Echeance[] = e.echeancier.map((x) => ({
    n: x.n, nom: x.nom, pct: x.pct, mois: x.mois, montant: x.montant ?? 0,
    statut: x.payeeLe && x.payeeLe <= fin ? 'Payée' : x.realiseLe && x.realiseLe <= fin ? 'Facturée' : x.datePrevue && x.datePrevue < debut ? 'En retard' : 'Planifiée',
  }));
  // ---- indicateurs proposés (le chef de projet les ajuste) ----
  const tachesEnRetard = e.taches.filter((t) => !t.annulee && t.statut !== 'Validé' && t.fin && t.fin < debut).length;
  const derive = prevu > 0 ? (conso + raf) / prevu - 1 : 0;
  const ajoutNet = e.chargeAjout - e.chargeAnnulee;
  const demarre = conso > 0, termine = e.taches.length > 0 && e.taches.every((t) => t.annulee || t.statut === 'Validé');
  const retardsEch = echeances.filter((x) => x.statut === 'En retard').length;
  const propose: Record<CleIndicateur, Niveau> = {
    planning: !demarre || termine ? 'gris' : glissement > 0 ? 'rouge' : tachesEnRetard ? 'jaune' : 'vert',
    qualite: !demarre || termine ? 'gris' : 'vert',
    perimetre: ajoutNet > 0 ? 'jaune' : 'vert',
    budget: !demarre ? 'gris' : derive > 0.01 ? 'rouge' : derive > 0.0001 ? 'jaune' : 'vert',
    ressources: 'vert',
    facturation: retardsEch ? 'jaune' : 'vert',
  };
  const pct = (v: number): string => `${(Math.round(v * 1000) / 10).toLocaleString('fr-FR')} %`;
  const raison: Record<CleIndicateur, string> = {
    planning: !demarre ? 'Projet pas encore démarré' : termine ? 'Toutes les tâches sont validées' : glissement > 0 ? `Fin prévue ${glissement} j après la fin contractuelle` : tachesEnRetard ? `${tachesEnRetard} tâche(s) en retard` : 'Pas de retard',
    qualite: 'À apprécier par le chef de projet',
    perimetre: ajoutNet > 0 ? `${fJ(ajoutNet)} JH ajoutés non facturés` : 'Pas d’ajout non compensé',
    budget: !demarre ? 'Rien de consommé' : derive > 0.0001 ? `Dérive de ${pct(derive)} (atterrissage / prévu)` : 'Pas de dérive',
    ressources: 'À apprécier par le chef de projet',
    facturation: retardsEch ? `${retardsEch} échéance(s) en retard` : 'Pas de retard de facturation',
  };
  const indicateurs = INDICATEURS.map(([cle, libelle]) => {
    const S = s.indicateurs?.[cle]?.s ?? propose[cle];
    return { cle, libelle, s: S, s1: s.indicateurs?.[cle]?.s1 ?? S, propose: propose[cle], raison: raison[cle] };
  });
  // ---- risques et actions ----
  const crit = (c: number): Niveau => ({ fort: 'rouge', moyen: 'jaune', faible: 'vert' } as const)[riskNiveau(c)];
  const risques = [...e.risques].sort((a, b) => b.crit - a.crit).slice(0, 3).map((x) => ({ libelle: x.libelle || '', parade: x.parade || '', niveau: crit(x.crit) }));
  const fermee = (st: string): boolean => st === 'Fait' || st === 'Annulée';
  const ouvertes = e.actions.filter((a) => a.libelle.trim() && !fermee(a.statut)).sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'));
  const faites = e.actions.filter((a) => a.libelle.trim() && a.statut === 'Fait' && a.faitLe && a.faitLe >= debut && a.faitLe <= fin);
  const actions = [...ouvertes, ...faites].slice(0, 5).map((a) => ({
    libelle: a.libelle, pilote: a.porteur || '', echeance: a.echeance ?? '', statut: a.statut || '', commentaire: a.commentaire || '',
    retard: !!(a.echeance && a.echeance < debut && !fermee(a.statut)),
  }));
  // ---- équipe : les collaborateurs nommés des profils (hors enveloppe IA) ----
  const consultants = [...new Set(P.map((p, i) => (i !== e.iaProfile ? (p.collaborateur || '').trim() : '')).filter((c) => c.includes(' ')))];
  return {
    client: e.fiche.client || fiche['client'] || '', projet: e.fiche.projet || fiche['projet'] || '',
    periode: {
      type: typeP, debut, fin, numero: numeroSemaine(debut), mois, moisSuivant: m1,
      libelleMois: `${MOIS_L[+mois.slice(5, 7) - 1]} ${mois.slice(0, 4)}`, libelleMoisSuivant: MOIS_L[+m1.slice(5, 7) - 1],
      colS: typeP === 'mois' ? 'M' : 'S', colS1: typeP === 'mois' ? 'M+1' : 'S+1',
    },
    typologie: e.fiche.typeContrat || fiche['typeContrat'] || 'Forfait', modeFacturation: r.modeFacturation || 'J.H',
    debut: d.debut, fin: d.finPrevue || d.finContrat, glissement,
    budgetInitial: e.caTSP, budgetConsomme: somme(phases.map((p) => p.conso)),
    avancement: prevu > 0 ? conso / prevu : 0, prevu, conso, raf, atterrissage: conso + raf,
    facture: somme(echeances.filter((x) => x.statut === 'Facturée' || x.statut === 'Payée').map((x) => x.montant)),
    commercial: r.commercial ?? fiche['commercial'] ?? '', avv: r.avv ?? '', pilote: r.pilote ?? '', consultants,
    extension: s.extension || 'Non',
    actualites: s.actualites.filter((x) => x.trim()), attention: s.attention.filter((x) => x.trim()),
    phases, echeances, indicateurs, risques, actions,
    satisfaction: s.satisfaction ?? { meteo: 'soleil', tendance: 'vert' }, esprit: s.esprit ?? { meteo: 'soleil', tendance: 'vert' },
    aEvoquer: !!s.aEvoquer, difficulte: s.difficulte ?? (s.attention.find((x) => x.trim()) || ''), impact: s.impact ?? '',
    genereLe: o.aujourdhui, logoEntreprise: o.logoEntrepriseParDefaut,
  };
}

/** Nom du fichier : « Point hebdo S41 2026 - Client - Projet.pptx » (caractères interdits par Windows retirés). */
export function nomFichier(d: DonneesDiapo): string {
  const pe = d.periode, quand = pe.type === 'mois' ? `Point mensuel ${pe.mois}` : `Point hebdo S${pe.numero} ${pe.debut.slice(0, 4)}`;
  return `${quand} - ${d.client} - ${d.projet}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) + '.pptx';
}

/** Une ligne de texte par point (les puces collées depuis un autre document sont retirées). */
export const lignes = (t: string): string[] => t.split('\n').map((x) => x.replace(/^\s*[-•·*]\s*/, '').trim()).filter(Boolean);
