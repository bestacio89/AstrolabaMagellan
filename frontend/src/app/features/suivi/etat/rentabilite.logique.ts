import { AchatReel, Financier, LignePerimetre, Synthese } from '../api/modeles';
import { fE, fJ, fP2 } from './formats';

/**
 * Écran Rentabilité : mise en forme des montants calculés par le serveur (aucune règle de gestion ici).
 * Fonctions simples, testées sans navigateur (rentabilite.logique.spec.ts).
 */

/** Une marche de la cascade « marge vendue → marge à terminaison ». */
export interface MarcheCascade {
  cle: string;
  libelle: string;
  /** Montant en euros : total (début, fin) ou variation (+ gain, − perte). */
  montant: number;
  nature: 'total' | 'hausse' | 'baisse';
  /** Explication affichée au survol et sous le graphique. */
  detail: string;
}

/** En dessous d'un euro, une variation n'est pas affichée (arrondis). */
const SEUIL = 1;

/** Ce que la cascade lit d'une tâche (calcul du serveur). */
export interface TacheMarge {
  uid: string;
  label: string;
  statut: string;
  annulee: boolean;
  section?: boolean;
  charge: number;
  consoTotal: number;
  raf: number;
  atterrissage: number;
  coutPrevu?: number;
  coutConso?: number;
  coutRaf?: number;
}

/** Écart de coût d'une tâche : coût à l'atterrissage (consommé + reste à faire, au CJM) − coût prévu. */
export interface EcartTache {
  t: TacheMarge;
  ecart: number;
  /** Tâche validée : écart constaté (sinon : projeté). */
  fini: boolean;
  /** Validée sans aucun consommé : économie fictive tant que le temps passé n'est pas saisi. */
  sansConso: boolean;
}

/** Écarts de coût des tâches (hors titres et tâches annulées). Négatif = optimisation, positif = dépassement. */
export function ecartsTaches(taches: readonly TacheMarge[]): EcartTache[] {
  return taches
    .filter((t) => !t.section && !t.annulee)
    .map((t) => {
      const fini = t.statut === 'Validé';
      return { t, ecart: (t.coutConso ?? 0) + (t.coutRaf ?? 0) - (t.coutPrevu ?? 0), fini, sansConso: fini && !(t.consoTotal > 0) && t.charge > 0 };
    });
}

/**
 * Cascade de la marge nette : de la marge vendue (TSP) à la marge nette à terminaison, chaque marche expliquant une partie de l'écart.
 * Les optimisations (tâches qui finissent sous leur charge) et les dépassements sont deux marches distinctes, pour qu'un gain
 * ne soit pas masqué par un dépassement. La dernière variation (« Autres écarts ») garantit que la somme tombe juste
 * (remise, provisions, arrondis). « toutes » : garde aussi les marches de moins d'un euro (détail d'une colonne).
 */
export function cascadeMarge(f: Financier, taches: readonly TacheMarge[], options: { toutes?: boolean } = {}): MarcheCascade[] {
  const ec = ecartsTaches(taches);
  const optim = -ec.filter((e) => e.ecart < 0).reduce((s, e) => s + e.ecart, 0);
  const depass = ec.filter((e) => e.ecart > 0).reduce((s, e) => s + e.ecart, 0);
  const variations: Omit<MarcheCascade, 'nature'>[] = [
    { cle: 'avenants', libelle: 'Avenants', montant: -f.caAvenant, detail: 'Chiffre d’affaires retiré par les avenants de réduction' },
    { cle: 'ajouts', libelle: 'Charges ajoutées', montant: -f.coutAjout, detail: 'Coût des tâches et profils ajoutés en cours de projet (non facturés)' },
    { cle: 'annulations', libelle: 'Parties annulées', montant: f.coutAnnule, detail: 'Coût évité par les tâches annulées' },
    { cle: 'reaff', libelle: 'Réaffec\u00adtations', montant: -(f.coutReaff ?? 0), detail: 'Écart de coût quand la charge passe à une personne de CJM différent' },
    { cle: 'optim', libelle: 'Optimi\u00adsations', montant: optim, detail: 'Tâches qui finissent sous leur charge prévue (économie)' },
    { cle: 'depass', libelle: 'Dépasse\u00adments', montant: -depass, detail: 'Tâches qui finissent au-dessus de leur charge prévue (surcoût)' },
    { cle: 'achats', libelle: 'Achats', montant: f.achats.impactNet, detail: 'Achats réels et refacturés comparés au budget du TSP' },
    { cle: 'frais', libelle: 'Frais', montant: f.frais.impactNet, detail: 'Frais à notre charge comparés au budget du TSP (les frais refacturés sont neutres)' },
  ];
  const expliques = variations.reduce((s, v) => s + v.montant, 0);
  variations.push({
    cle: 'autres',
    libelle: 'Autres écarts',
    montant: f.margeNette - f.margeNetteVendue - expliques,
    detail: 'Remise, provisions et arrondis',
  });
  return [
    { cle: 'vendue', libelle: 'Marge nette vendue', montant: f.margeNetteVendue, nature: 'total', detail: 'Marge nette du TSP signé (production, achats et frais)' },
    ...variations
      .filter((v) => options.toutes || Math.abs(v.montant) >= SEUIL)
      .map((v): MarcheCascade => ({ ...v, nature: v.montant >= 0 ? 'hausse' : 'baisse' })),
    { cle: 'terminaison', libelle: 'Marge nette à terminaison', montant: f.margeNette, nature: 'total', detail: 'Marge nette attendue à la fin du projet' },
  ];
}

/** Position d'une marche dans le graphique : bas et hauteur, en pourcentage de la hauteur utile. */
export interface BarreCascade extends MarcheCascade {
  bas: number;
  hauteur: number;
}

/**
 * Place les marches sur une échelle commune. Une variation part du niveau atteint par la précédente ; les totaux partent du bas.
 * Quand tous les niveaux sont positifs, l'échelle est « coupée » (elle ne part pas de zéro) pour que les variations,
 * petites à côté des totaux, restent lisibles : les montants sont toujours écrits, et l'écran le signale.
 * Avec une marge négative, l'échelle part de zéro et le couvre (le zéro n'est alors pas en bas du graphique).
 */
export function placerCascade(marches: readonly MarcheCascade[]): { barres: BarreCascade[]; zero: number; coupee: boolean } {
  let niveau = 0;
  const segments = marches.map((m) => {
    if (m.nature === 'total') {
      niveau = m.montant;
      return { m, de: 0, a: m.montant };
    }
    const de = niveau;
    niveau += m.montant;
    return { m, de, a: niveau };
  });
  const niveaux = segments.flatMap((s) => (s.m.nature === 'total' ? [s.a] : [s.de, s.a]));
  const bas = Math.min(...niveaux, Infinity);
  const haut = Math.max(...niveaux, -Infinity);
  let min = Math.min(0, bas);
  const max = Math.max(0, haut);
  if (bas > 0 && niveaux.length) min = Math.max(0, bas - Math.max((haut - bas) * 0.6, haut * 0.04));
  const etendue = max - min || 1;
  const pct = (v: number) => Math.max(0, ((v - min) / etendue) * 100);
  return {
    barres: segments.map((s) => {
      const de = s.m.nature === 'total' ? Math.max(min, 0) : s.de;
      const b = pct(Math.min(de, s.a));
      return { ...s.m, bas: b, hauteur: Math.max(0.8, pct(Math.max(de, s.a)) - b) };
    }),
    zero: pct(0),
    coupee: min > 0,
  };
}

/** Dépense envisagée (déplacement, atelier sur site…), saisie dans le simulateur. */
export interface DepenseSimulee {
  personnes: number;
  jours: number;
  /** Transport aller-retour, par personne. */
  transport: number;
  /** Hébergement et repas, par personne et par jour. */
  sejour: number;
  /** Montant refacturé au client (0 si rien). */
  refacture: number;
}

export interface ResultatSimulation {
  cout: number;
  margeAvant: number;
  margeApres: number;
  tauxAvant: number;
  tauxApres: number;
  /** Variation du taux de marge, en points (0,012 = 1,2 point). */
  ecartPoints: number;
}

/** Nombre positif ou zéro (une saisie vide ou négative compte pour 0). */
const positif = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Effet d'une dépense sur la marge nette à terminaison. Même définition que le serveur :
 * marge nette = CA + refacturé − coûts ; taux = marge nette ÷ (CA + refacturé). Rien n'est enregistré.
 */
export function simulerDepense(f: Financier, d: DepenseSimulee): ResultatSimulation {
  const cout = positif(d.personnes) * positif(d.transport) + positif(d.personnes) * positif(d.jours) * positif(d.sejour);
  const refacture = positif(d.refacture);
  const caNet = f.ca + f.achats.attRev + f.frais.attRef;
  const margeApres = f.margeNette - cout + refacture;
  const tauxApres = caNet + refacture !== 0 ? margeApres / (caNet + refacture) : 0;
  return {
    cout,
    margeAvant: f.margeNette,
    margeApres,
    tauxAvant: f.tauxMargeNette,
    tauxApres,
    ecartPoints: tauxApres - f.tauxMargeNette,
  };
}

// ---------------------------------------------------------------- détail d'une colonne de la cascade (volet)

/** Une ligne du calcul : libellé, montant, note ; « total » pour la ligne de résultat. */
export interface LigneCalcul {
  libelle: string;
  valeur: string;
  note?: string;
  total?: boolean;
}

/** Une cellule d'un tableau du détail. « tache » : la cellule ouvre la tâche ; « statut » : étiquette de statut sous l'intitulé. */
export interface CelluleDetail {
  texte: string;
  n?: boolean;
  classe?: string;
  motif?: string;
  tache?: string;
  statut?: string;
  alerte?: string;
}

export interface TableauDetail {
  titre: string;
  colonnes: { libelle: string; n?: boolean }[];
  lignes: { cellules: CelluleDetail[]; classe?: string }[];
  total?: CelluleDetail[];
}

/** Écran où agir, proposé en bas du volet (chemin relatif au projet ; « wl » : vue du workload). */
export interface ActionDetail {
  chemin: string;
  libelle: string;
  wl?: 'suivi' | 'conso';
}

export interface DetailMarche {
  quoi: string;
  calcul: LigneCalcul[];
  alerte?: string;
  tableaux: TableauDetail[];
  aide?: string;
  action?: ActionDetail;
}

/** Ce que le détail lit du projet (calcul du serveur). */
export interface DonneesDetail {
  f: Financier;
  taches: readonly TacheMarge[];
  perimetre: readonly LignePerimetre[];
  /** CJM des profils (index des réaffectations). */
  cjm: readonly (number | undefined)[];
  synthese?: Synthese;
  achatsReel?: readonly AchatReel[];
}

/** Montant signé : « +1 200 € », « −860 € ». */
export const signeE = (v: number): string => (Math.abs(v) < 0.5 ? fE(0) : (v > 0 ? '+' : '−') + fE(Math.abs(v)));
const classe = (v: number): string => (v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : '');
const somme = <T>(l: readonly T[], f: (x: T) => number): number => l.reduce((s, x) => s + f(x), 0);
const lien = (t: { uid: string; label: string }, motif?: string, extra: Partial<CelluleDetail> = {}): CelluleDetail => ({ texte: t.label, tache: t.uid, motif, ...extra });

/** Explication, calcul et éléments d'une colonne de la cascade ; null pour une colonne inconnue. */
export function detailMarche(cle: string, d: DonneesDetail): DetailMarche | null {
  const { f, perimetre } = d;
  const A = f.achats, F = f.frais, S = d.synthese;
  const ec = ecartsTaches(d.taches);
  switch (cle) {
    case 'vendue':
      return {
        quoi: 'La marge que le TSP signé prévoyait : ce que le projet devait rapporter une fois payés les jours de production, les achats et les frais. C’est le point de départ de la cascade.',
        calcul: S
          ? [
              { libelle: 'Chiffre d’affaires des jours', valeur: fE(S.ca), note: 'charge vendue × TJM' },
              { libelle: 'Coût de production', valeur: '−' + fE(S.cout), note: 'charge vendue × CJM' },
              { libelle: 'Marge sur achats', valeur: signeE(S.achatsRef - S.achatsMt), note: `revente ${fE(S.achatsRef)} − achat ${fE(S.achatsMt)}` },
              { libelle: 'Frais', valeur: signeE(S.fraisRef - S.fraisDep), note: `refacturés ${fE(S.fraisRef)} − budget ${fE(S.fraisDep)}` },
              { libelle: 'Marge nette vendue', valeur: fE(f.margeNetteVendue), note: `${fP2(f.tauxMargeNetteVendue)} du montant du projet (${fE(S.montantProjet)})`, total: true },
            ]
          : [{ libelle: 'Marge nette vendue', valeur: fE(f.margeNetteVendue), note: fP2(f.tauxMargeNetteVendue), total: true }],
        tableaux: [],
        action: { chemin: 'synthese', libelle: 'Voir la synthèse du TSP' },
      };
    case 'avenants': {
      const l = perimetre.filter((x) => x.kind === 'annul' && x.avenant && (x.caAvenant ?? 0) > 0.5);
      return {
        quoi: 'Quand une partie du projet est annulée avec un avenant de réduction, le client paie moins : le chiffre d’affaires baisse de la part vendue qui ne sera pas réalisée.',
        calcul: [{ libelle: 'CA retiré', valeur: '−' + fE(f.caAvenant), note: 'JH vendus non réalisés × TJM, pour chaque tâche annulée avec avenant', total: true }],
        tableaux: [
          {
            titre: 'Tâches annulées avec avenant',
            colonnes: [{ libelle: 'Tâche' }, { libelle: 'JH annulés', n: true }, { libelle: 'CA retiré', n: true }],
            lignes: l.map((x) => ({ cellules: [lien(x), { texte: fJ(Math.abs(x.jh)), n: true }, { texte: '−' + fE(x.caAvenant), n: true, classe: 'neg' }] })),
            total: [{ texte: 'Total' }, { texte: '' }, { texte: '−' + fE(f.caAvenant), n: true, classe: 'neg' }],
          },
        ],
        aide: 'Le coût évité par ces annulations apparaît dans « Parties annulées ».',
      };
    }
    case 'ajouts': {
      const l = perimetre.filter((x) => x.kind === 'tache' || x.kind === 'profil');
      return {
        quoi: 'Du travail ajouté en cours de projet, sans être facturé au client : il coûte des jours (au CJM) sans rapporter de chiffre d’affaires.',
        calcul: [{ libelle: 'Coût des charges ajoutées', valeur: '−' + fE(f.coutAjout), note: 'JH ajoutés × CJM du profil', total: true }],
        tableaux: [
          {
            titre: 'Ajouts au périmètre',
            colonnes: [{ libelle: 'Tâche' }, { libelle: 'Profil' }, { libelle: 'JH', n: true }, { libelle: 'Coût', n: true }],
            lignes: l.map((x) => ({ cellules: [lien(x, x.motif ?? undefined), { texte: x.profils.join(', ') }, { texte: '+' + fJ(x.jh), n: true }, { texte: '−' + fE(x.cout ?? 0), n: true, classe: 'neg' }] })),
            total: [{ texte: 'Total' }, { texte: '' }, { texte: '+' + fJ(somme(l, (x) => x.jh)), n: true }, { texte: '−' + fE(f.coutAjout), n: true, classe: 'neg' }],
          },
        ],
        aide: 'Règle actuelle : un ajout n’est pas facturé. S’il doit l’être, il passe par un avenant.',
      };
    }
    case 'annulations': {
      const l = perimetre.filter((x) => x.kind === 'annul');
      return {
        quoi: 'Les tâches annulées ne seront pas réalisées : le coût de la charge restante est évité. Seul le temps déjà passé reste dans les coûts.',
        calcul: [{ libelle: 'Coût évité', valeur: '+' + fE(f.coutAnnule), note: 'charge non réalisée × CJM', total: true }],
        tableaux: [
          {
            titre: 'Tâches annulées',
            colonnes: [{ libelle: 'Tâche' }, { libelle: 'JH annulés', n: true }, { libelle: 'Coût évité', n: true }, { libelle: 'Avenant' }],
            lignes: l.map((x) => ({
              cellules: [lien(x), { texte: fJ(Math.abs(x.jh)), n: true }, { texte: '+' + fE(Math.abs(x.cout ?? 0)), n: true, classe: 'pos' }, { texte: x.avenant ? `Oui · CA −${fE(x.caAvenant)}` : 'Non' }],
            })),
            total: [{ texte: 'Total' }, { texte: '' }, { texte: '+' + fE(f.coutAnnule), n: true, classe: 'pos' }, { texte: '' }],
          },
        ],
        aide: 'Sans avenant, le client paie toujours le prix du forfait : l’annulation améliore la marge. Avec un avenant, le CA retiré apparaît dans « Avenants ».',
      };
    }
    case 'reaff': {
      const l = perimetre.filter((x) => x.kind === 'reaff');
      const total = -(f.coutReaff ?? 0);
      return {
        quoi: 'Une partie de la charge d’un profil est confiée à une autre personne. La charge totale ne change pas, mais le coût suit le CJM de la personne qui fait le travail.',
        calcul: [{ libelle: 'Écart de coût', valeur: signeE(total), note: 'JH réaffectés × (CJM d’origine − CJM de la nouvelle personne)', total: true }],
        tableaux: [
          {
            titre: 'Réaffectations',
            colonnes: [{ libelle: 'Tâche' }, { libelle: 'De → vers' }, { libelle: 'JH', n: true }, { libelle: 'Effet', n: true }],
            lignes: l.map((x) => ({
              cellules: [
                lien(x),
                { texte: `${x.profils[0] ?? ''} → ${x.profils[1] ?? ''}`, motif: `CJM ${fE(d.cjm[x.de ?? -1])} → ${fE(d.cjm[x.vers ?? -1])}` },
                { texte: fJ(x.jh), n: true },
                { texte: signeE(-(x.cout ?? 0)), n: true, classe: classe(-(x.cout ?? 0)) },
              ],
            })),
            total: [{ texte: 'Total' }, { texte: '' }, { texte: '' }, { texte: signeE(total), n: true, classe: classe(total) }],
          },
        ],
      };
    }
    case 'optim': {
      const l = ec.filter((e) => e.ecart < 0).sort((a, b) => a.ecart - b.ecart);
      const fictif = l.filter((e) => e.sansConso);
      const tableau = (titre: string, g: EcartTache[]): TableauDetail => ({
        titre,
        colonnes: [{ libelle: 'Tâche' }, { libelle: 'Prévu', n: true }, { libelle: 'Atterr.', n: true }, { libelle: 'Économie', n: true }],
        lignes: g.map((e) => ({
          classe: e.sansConso ? 'rd-fictif' : undefined,
          cellules: [
            lien(e.t, `consommé ${fJ(e.t.consoTotal)} JH${e.fini ? '' : ` + reste ${fJ(e.t.raf)} JH`}`, {
              statut: e.t.statut,
              alerte: e.sansConso ? 'Validée sans consommé : économie fictive tant que le temps passé n’est pas saisi' : undefined,
            }),
            { texte: fJ(e.t.charge), n: true },
            { texte: fJ(e.t.atterrissage), n: true },
            { texte: '+' + fE(-e.ecart), n: true, classe: 'pos' },
          ],
        })),
        total: [{ texte: 'Total' }, { texte: fJ(somme(g, (e) => e.t.charge)), n: true }, { texte: fJ(somme(g, (e) => e.t.atterrissage)), n: true }, { texte: '+' + fE(-somme(g, (e) => e.ecart)), n: true, classe: 'pos' }],
      });
      const constatees = l.filter((e) => e.fini), prevues = l.filter((e) => !e.fini);
      return {
        quoi: 'Les tâches qui finissent sous leur charge prévue : moins de jours que prévu, donc un coût plus bas et une marge plus haute. Une tâche validée à 0,5 JH au lieu de 1 JH économise 0,5 JH × CJM.',
        calcul: [{ libelle: 'Économie', valeur: '+' + fE(-somme(l, (e) => e.ecart)), note: 'Σ (coût prévu − coût à l’atterrissage), tâche par tâche · coût à l’atterrissage = (consommé + reste à faire) × CJM', total: true }],
        alerte: fictif.length
          ? `${fictif.length} tâche${fictif.length > 1 ? 's' : ''} validée${fictif.length > 1 ? 's' : ''} sans consommé (${signeE(-somme(fictif, (e) => e.ecart))}) : sans temps passé saisi, ${fictif.length > 1 ? 'elles affichent' : 'elle affiche'} une économie fictive. Saisissez le consommé dans Workload › Saisie du consommé.`
          : undefined,
        tableaux: [
          ...(constatees.length ? [tableau('Constatées — tâches validées', constatees)] : []),
          ...(prevues.length ? [tableau('Prévues — tâches en cours, reste à faire réestimé à la baisse', prevues)] : []),
        ],
        action: fictif.length ? { chemin: 'workload', libelle: 'Saisir le consommé', wl: 'conso' } : { chemin: 'workload', libelle: 'Voir les tâches', wl: 'suivi' },
      };
    }
    case 'depass': {
      const l = ec.filter((e) => e.ecart > 0).sort((a, b) => b.ecart - a.ecart);
      const tableau = (titre: string, g: EcartTache[]): TableauDetail => ({
        titre,
        colonnes: [{ libelle: 'Tâche' }, { libelle: 'Prévu', n: true }, { libelle: 'Atterr.', n: true }, { libelle: 'Surcoût', n: true }],
        lignes: g.map((e) => ({
          cellules: [
            lien(e.t, `consommé ${fJ(e.t.consoTotal)} JH${e.fini ? '' : ` + reste ${fJ(e.t.raf)} JH`}`, { statut: e.t.statut }),
            { texte: fJ(e.t.charge), n: true },
            { texte: fJ(e.t.atterrissage), n: true },
            { texte: '−' + fE(e.ecart), n: true, classe: 'neg' },
          ],
        })),
        total: [{ texte: 'Total' }, { texte: fJ(somme(g, (e) => e.t.charge)), n: true }, { texte: fJ(somme(g, (e) => e.t.atterrissage)), n: true }, { texte: '−' + fE(somme(g, (e) => e.ecart)), n: true, classe: 'neg' }],
      });
      const constates = l.filter((e) => e.fini), projetes = l.filter((e) => !e.fini);
      return {
        quoi: 'Les tâches qui finissent au-dessus de leur charge prévue : plus de jours que prévu, donc un coût plus haut et une marge plus basse. Pour une tâche en cours, c’est une projection (consommé + reste à faire).',
        calcul: [{ libelle: 'Surcoût', valeur: '−' + fE(somme(l, (e) => e.ecart)), note: 'Σ (coût à l’atterrissage − coût prévu), tâche par tâche', total: true }],
        tableaux: [...(constates.length ? [tableau('Constatés — tâches validées', constates)] : []), ...(projetes.length ? [tableau('Projetés — tâches en cours', projetes)] : [])],
        aide: 'Un dépassement accepté par le client se traite par un ajout au périmètre ou un avenant.',
        action: { chemin: 'workload', libelle: 'Voir les tâches', wl: 'suivi' },
      };
    }
    case 'achats': {
      const reels = d.achatsReel ?? [];
      const lignes = [
        ...A.parLigne.map((l) => ({ nom: l.designation || `Ligne ${l.i + 1}`, budget: l.budget, reel: l.reel, att: l.att, ref: l.attRev, effet: l.attRev - l.att - (l.budgetRev - l.budget) })),
        ...A.hors.map((i) => reels[i]).filter((a): a is AchatReel => !!a).map((a) => ({ nom: `${a.designation || 'Achat'} (hors TSP)`, budget: 0, reel: a.montant, att: a.montant, ref: a.refacture, effet: a.refacture - a.montant })),
      ];
      return {
        quoi: 'Les achats (licences, matériel, sous-traitance…) comparés au budget du TSP. Une ligne garde son budget tant que le réel reste en dessous ; seul un dépassement non refacturé au client pèse sur la marge.',
        calcul: [
          { libelle: 'Atterrissage des achats', valeur: '−' + fE(A.att), note: 'pour chaque ligne, le plus élevé du budget et du réel, plus les achats hors TSP' },
          { libelle: 'Refacturé au client', valeur: '+' + fE(A.attRev) },
          { libelle: 'Rappel du TSP', valeur: signeE(-(A.budgetRev - A.budget)), note: `revente ${fE(A.budgetRev)} − budget ${fE(A.budget)}` },
          { libelle: 'Effet sur la marge', valeur: signeE(A.impactNet), total: true },
        ],
        tableaux: lignes.length
          ? [
              {
                titre: 'Par ligne',
                colonnes: [{ libelle: 'Achat' }, { libelle: 'Budget', n: true }, { libelle: 'Atterr.', n: true }, { libelle: 'Refacturé', n: true }, { libelle: 'Effet', n: true }],
                lignes: lignes.map((x) => ({
                  cellules: [{ texte: x.nom, motif: `réel ${fE(x.reel)}` }, { texte: fE(x.budget), n: true }, { texte: fE(x.att), n: true }, { texte: fE(x.ref), n: true }, { texte: signeE(x.effet), n: true, classe: classe(x.effet) }],
                })),
                total: [{ texte: 'Total', motif: `réel ${fE(A.reel)}` }, { texte: fE(A.budget), n: true }, { texte: fE(A.att), n: true }, { texte: fE(A.attRev), n: true }, { texte: signeE(A.impactNet), n: true, classe: classe(A.impactNet) }],
              },
            ]
          : [],
        action: { chemin: 'achats', libelle: 'Voir les achats' },
      };
    }
    case 'frais':
      return {
        quoi: 'Les frais (déplacements, hébergement, repas…) comparés au budget du TSP, en deux enveloppes. Les frais refacturables sont remboursés par le client : ils ne changent pas la marge. Les frais non refacturés sont à notre charge : au-delà de la part prévue à notre charge au TSP, chaque euro réduit la marge, même s’il reste du budget refacturable.',
        calcul: [
          { libelle: 'Frais refacturables', valeur: fE(0), note: `atterrissage ${fE(F.attRefCout)} (budget ${fE(F.budgetRefCout)}, réel ${fE(F.reelRef)}), remboursé par le client` },
          { libelle: 'Frais à notre charge', valeur: signeE(-(F.attNonRef - F.budgetNonRef)), note: `réel non refacturé ${fE(F.reelNonRef)} · part prévue au TSP ${fE(F.budgetNonRef)} (budget ${fE(F.budget)} − refacturé ${fE(F.budgetRef)})` },
          { libelle: 'Effet sur la marge', valeur: signeE(F.impactNet), total: true },
        ],
        tableaux: F.parCategorie.some((c) => c.n)
          ? [
              {
                titre: 'Frais réels par catégorie',
                colonnes: [{ libelle: 'Catégorie' }, { libelle: 'Nombre', n: true }, { libelle: 'Montant', n: true }],
                lignes: F.parCategorie.filter((c) => c.n).map((c) => ({ cellules: [{ texte: c.cle }, { texte: String(c.n), n: true }, { texte: fE(c.montant), n: true }] })),
                total: [{ texte: 'Total' }, { texte: String(somme(F.parCategorie, (c) => c.n)), n: true }, { texte: fE(F.reel), n: true }],
              },
            ]
          : [],
        action: { chemin: 'frais', libelle: 'Voir les frais' },
      };
    case 'autres': {
      const marches = cascadeMarge(f, d.taches, { toutes: true }).filter((x) => x.nature !== 'total' && x.cle !== 'autres');
      const expliques = somme(marches, (x) => x.montant);
      const autres = f.margeNette - f.margeNetteVendue - expliques;
      return {
        quoi: 'Ce que les autres colonnes n’expliquent pas : remise commerciale, provision pour risque, arrondis du TSP. Cette colonne garantit que la cascade tombe juste.',
        calcul: [
          { libelle: 'Marge nette à terminaison', valeur: fE(f.margeNette) },
          { libelle: '− Marge nette vendue', valeur: fE(f.margeNetteVendue) },
          { libelle: '− Colonnes expliquées', valeur: signeE(expliques) },
          { libelle: 'Autres écarts', valeur: signeE(autres), total: true },
        ],
        tableaux: [],
        aide: Math.abs(autres) > Math.max(100, Math.abs(f.margeNetteVendue) * 0.02) ? 'Écart important : vérifiez la remise et la provision dans la synthèse du TSP.' : 'Écart faible : il s’agit en général d’arrondis.',
        action: { chemin: 'synthese', libelle: 'Voir la synthèse du TSP' },
      };
    }
    case 'terminaison':
      return {
        quoi: 'La marge nette attendue à la fin du projet, avec ce qui a déjà été dépensé et ce qui reste à faire. C’est le point d’arrivée de la cascade.',
        calcul: [
          { libelle: 'Chiffre d’affaires', valeur: fE(f.ca), note: f.caAvenant ? `CA du TSP ${fE(f.caTSP)}, avenants déduits` : 'CA du TSP' },
          { libelle: 'Coût déjà consommé', valeur: '−' + fE(f.coutConso), note: 'consommé × CJM' },
          { libelle: 'Coût du reste à faire', valeur: '−' + fE(f.coutRaf), note: 'reste à faire × CJM' },
          { libelle: 'Achats', valeur: signeE(A.attRev - A.att), note: `refacturé ${fE(A.attRev)} − atterrissage ${fE(A.att)}` },
          { libelle: 'Frais', valeur: signeE(F.attRef - F.att), note: `refacturé ${fE(F.attRef)} − atterrissage ${fE(F.att)}` },
          { libelle: 'Marge nette à terminaison', valeur: fE(f.margeNette), note: `${fP2(f.tauxMargeNette)} de ${fE(f.ca + A.attRev + F.attRef)} (CA + refacturé) · vendue ${fP2(f.tauxMargeNetteVendue)}`, total: true },
        ],
        tableaux: [],
      };
    default:
      return null;
  }
}
