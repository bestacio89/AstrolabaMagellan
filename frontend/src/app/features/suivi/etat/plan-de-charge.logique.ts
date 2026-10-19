import { multiJours } from './constantes';
import { fJ, fM } from './formats';
import { isWorkday, monthDays, sum } from './outils';

/**
 * Plan de charge (traduction de 54-charges-planning.js, version HTML de référence) :
 * « Prévu et réel » (planning de charge et consommé saisi, vus ensemble), « Prévisionnel » (replanifier la charge sans toucher
 * au TSP vendu) et la carte de chaleur de l'équipe. Fonctions simples, testées sans navigateur.
 */

/** Ce que le plan de charge utilise d'un mois du modèle. */
export interface MoisCharge {
  mois: string;
  refP: number[];
  consoP: number[];
  tspP?: number[];
  ref: number;
  conso: number;
  tsp?: number;
}

/** Ce que le plan de charge utilise d'un profil. */
export interface ProfilCharge {
  i: number;
  nom: string;
  entite: string;
  /** Charge vendue + charges ajoutées en cours de projet (JH). */
  charge: number;
}

// ------------------------------------------------------------------ Prévu et réel

/** Mois « passé » : écoulé, en cours, ou déjà saisi (un mois à venir où du consommé est saisi apparaît comme passé). */
export const moisPasse = (m: MoisCharge, cur: string): boolean => m.mois <= cur || m.conso > 0;

/** Ton d'une case réel / prévu : orange = plus que prévu, bleu = moins que prévu. */
export const ton = (r: number, p: number): '' | 'pc-sur' | 'pc-sous' => (r - p > 0.001 ? 'pc-sur' : r - p < -0.001 ? 'pc-sous' : '');

/** Prévu et réel à date (mois écoulés et mois en cours), par profil et au total ; profils en avance ou en retard. */
export function prevuReelADate(M: readonly MoisCharge[], cur: string, act: readonly number[]) {
  const aDate = M.filter((m) => m.mois <= cur);
  const prevu = (i: number) => sum(aDate.map((m) => m.refP[i] || 0));
  const reel = (i: number) => sum(aDate.map((m) => m.consoP[i] || 0));
  const pT = sum(act.map(prevu)),
    rT = sum(act.map(reel));
  return {
    prevu,
    reel,
    pT,
    rT,
    avance: act.filter((i) => reel(i) - prevu(i) > 0.001),
    retard: act.filter((i) => reel(i) - prevu(i) < -0.001),
  };
}

/** Graphique « Charge mensuelle, tous profils » : barres prévu / réel du mois, courbes cumulées (prévu, réel, et vendu si replanifié). */
export function grapheCharge(M: readonly MoisCharge[], cur: string, replanifie: boolean) {
  const W = 1000,
    H = 190,
    L = 40,
    B = 26,
    n = M.length || 1;
  let cp = 0,
    cr = 0,
    ct = 0;
  const cumP = M.map((m) => (cp += m.ref)),
    cumR = M.map((m) => (cr += m.conso)),
    cumT = M.map((m) => (ct += m.tsp ?? 0));
  const mx = Math.max(1, ...cumP, ...cumR) * 1.08;
  const x = (k: number) => L + (k + 0.5) * ((W - L - 10) / n);
  const y = (v: number) => H - B - (v / mx) * (H - B - 12);
  const bw = Math.min(22, (W - L) / n / 3);
  const kCur = M.findIndex((m) => m.mois === cur);
  const dernierPasse = Math.max(-1, ...M.map((m, k) => (moisPasse(m, cur) ? k : -1)));
  const pts = (l: number[]) => l.map((v, k) => `${x(k).toFixed(0)},${y(v).toFixed(1)}`).join(' ');
  return {
    W,
    H,
    L,
    graduations: [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const v = Math.round((mx * f) / 1.08);
      return { v, y: +y(v).toFixed(0) };
    }),
    barres: M.map((m, k) => ({
      mois: m.mois,
      libelle: fM(m.mois),
      cur: m.mois === cur,
      x: +x(k).toFixed(0),
      prevu: { x: +(x(k) - bw - 1).toFixed(0), y: +y(m.ref).toFixed(1), h: +(H - B - y(m.ref)).toFixed(1), titre: `${fM(m.mois)} : prévu ${fJ(m.ref)} JH` },
      reel: moisPasse(m, cur) ? { x: +(x(k) + 1).toFixed(0), y: +y(m.conso).toFixed(1), h: +(H - B - y(m.conso)).toFixed(1), titre: `${fM(m.mois)} : réel ${fJ(m.conso)} JH` } : null,
    })),
    bw: +bw.toFixed(0),
    yTexte: H - 8,
    cumulPrevu: pts(cumP),
    cumulVendu: replanifie ? cumT.map((v, k) => `${x(k).toFixed(0)},${y(Math.min(v, mx)).toFixed(1)}`).join(' ') : null,
    cumulReel: dernierPasse >= 0 ? pts(cumR.slice(0, dernierPasse + 1)) : null,
    pointsReel: cumR.slice(0, dernierPasse + 1).map((v, k) => ({ x: +x(k).toFixed(0), y: +y(v).toFixed(1), titre: `Réel cumulé à fin ${fM(M[k].mois)} : ${fJ(v)} JH (prévu cumulé ${fJ(cumP[k])} JH)` })),
    aujourdhui: kCur >= 0 ? { x: +(x(kCur) + bw + 4).toFixed(0), y2: H - B } : null,
  };
}

// ------------------------------------------------------------------ Prévisionnel

/**
 * Prévisionnel : mois écoulés = réel saisi (figé) ; mois en cours et à venir = prévisionnel modifiable.
 * « Projeté » = réel des mois écoulés + prévisionnel des mois restants ; « Reste à placer » = charge − projeté.
 */
export function previsionnel(M: readonly MoisCharge[], cur: string, profils: readonly ProfilCharge[], planVal: (i: number, mois: string) => number) {
  const cell = (m: MoisCharge, i: number) => (m.mois < cur ? m.consoP[i] || 0 : planVal(i, m.mois));
  const proj: Record<number, number> = {},
    reste: Record<number, number> = {};
  for (const p of profils) {
    proj[p.i] = sum(M.map((m) => cell(m, p.i)));
    reste[p.i] = p.charge - proj[p.i];
  }
  const totM = M.map((m) => sum(profils.map((p) => cell(m, p.i))));
  const ecM = M.map((m, k) => (m.mois < cur ? null : totM[k] - sum(profils.map((p) => m.tspP?.[p.i] || 0))));
  const deplaces = sum(profils.map((p) => sum(M.filter((m) => m.mois >= cur).map((m) => Math.max(planVal(p.i, m.mois) - (m.tspP?.[p.i] || 0), 0)))));
  const surcharge = (p: ProfilCharge, mk: string) => !multiJours(p.entite) && mk >= cur && planVal(p.i, mk) > joursOuvres(mk) + 1e-9;
  return {
    cell,
    proj,
    reste,
    totM,
    ecM,
    deplaces,
    surcharge,
    chT: sum(profils.map((p) => p.charge)),
    projT: sum(profils.map((p) => proj[p.i])),
    resteT: sum(profils.map((p) => reste[p.i])),
  };
}

/** « Reste à placer » : texte et classe. */
export function texteReste(r: number): [string, string] {
  if (Math.abs(r) < 0.001) return ['✓ tout est placé', 'pv-ok'];
  return r > 0 ? [`${fJ(r)} à placer`, 'pv-aplacer'] : [`+${fJ(-r)} au-delà`, 'pv-trop'];
}

export const joursOuvres = (mk: string): number => monthDays(mk).filter(isWorkday).length;

/**
 * Carte de chaleur : occupation d'un profil un mois donné = jours (réel pour les mois écoulés, prévisionnel ensuite) ÷ jours ouvrés.
 * Profils d'achat ou de cession (plusieurs personnes) : jours affichés, sans taux. absences = jours d'absence saisis (rappel au survol).
 */
export function caseChaleur(p: ProfilCharge, mois: string, jours: number, cur: string, absences = 0): { texte: string; classe: string; titre: string } {
  const passe = mois < cur;
  const nature = passe ? 'réels' : 'prévus';
  if (multiJours(p.entite)) return { texte: jours ? fJ(jours) : '', classe: 'hm hm-multi', titre: `${fJ(jours)} JH ${nature} — profil à plusieurs personnes : pas de taux d’occupation` };
  const jo = joursOuvres(mois);
  const r = jo ? jours / jo : 0;
  const niv = jours < 0.001 ? 'hm0' : r > 1 + 1e-9 ? 'hm4' : r >= 0.8 ? 'hm3' : r >= 0.5 ? 'hm2' : 'hm1';
  return {
    texte: jours < 0.001 ? '' : `${r > 1 + 1e-9 ? '▲ ' : ''}${Math.round(r * 100)} %`,
    classe: `hm ${niv}${passe ? ' hm-passe' : ''}`,
    titre: `${p.nom}, ${fM(mois)} : ${fJ(jours)} JH ${nature} sur ${jo} jours ouvrés${absences ? ` · ${fJ(absences)} j d’absence saisie` : ''}${r > 1 + 1e-9 ? ' — plus de jours que de jours ouvrés' : ''}`,
  };
}

/** Valeur du prévisionnel (planning de référence) pour un profil et un mois. */
export function valeurPlanning(pr: { months: string[]; rows: number[][] } | null | undefined, i: number, mois: string): number {
  const k = pr ? pr.months.indexOf(mois) : -1;
  return k < 0 ? 0 : Number(pr!.rows[i]?.[k]) || 0;
}
