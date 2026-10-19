import { describe, expect, it } from 'vitest';
import { Financier } from '../api/modeles';
import { cascadeMarge, detailMarche, DonneesDetail, ecartsTaches, placerCascade, signeE, simulerDepense, TacheMarge } from './rentabilite.logique';

/** Indicateurs financiers d'un projet fictif (seuls les champs utiles à l'écran Rentabilité comptent). */
function financier(partiel: Partial<Financier> = {}): Financier {
  return {
    ca: 100000, caTSP: 100000, caAvenant: 0, coutInitial: 68000, coutAjout: 3000, coutAnnule: 1000, coutReaff: 0, coutPrevu: 70000,
    coutConso: 40000, coutRaf: 35000, coutFinal: 75000, marge: 25000, tauxMarge: 0.25, ecartCout: 7000,
    achats: { parLigne: [], hors: [], budget: 2000, budgetRev: 2600, reel: 3000, reelRev: 2600, horsTSP: 0, att: 3000, attRev: 2600, reste: 0, depasse: 1000, impactNet: -1000, parStatut: [] },
    frais: {
      budget: 4000, budgetRef: 0, reel: 4860, reelRef: 0, att: 4860, attRef: 0, reste: 0, depasse: 860, impactNet: -860, parCategorie: [], parCollab: [],
      reelNonRef: 4860, budgetNonRef: 4000, budgetRefCout: 0, attRefCout: 0, attNonRef: 4860,
    },
    margeNette: 22740, tauxMargeNette: 22740 / 102600, margeNetteVendue: 31000, tauxMargeNetteVendue: 31000 / 102600,
    ...partiel,
  };
}

/** Tâches du projet fictif : coût prévu 70 000 €, 75 000 € à l'atterrissage (une optimisation de 1 000 €, un dépassement de 6 000 €). */
const tache = (uid: string, partiel: Partial<TacheMarge>): TacheMarge => ({
  uid, label: uid.toUpperCase(), statut: 'En cours', annulee: false, charge: 10, consoTotal: 5, raf: 5, atterrissage: 10, coutPrevu: 0, coutConso: 0, coutRaf: 0, ...partiel,
});
const TACHES: TacheMarge[] = [
  tache('t1', { coutPrevu: 40000, coutConso: 30000, coutRaf: 16000, atterrissage: 11.5 }),
  tache('t2', { statut: 'Validé', coutPrevu: 30000, coutConso: 29000, coutRaf: 0, raf: 0, atterrissage: 9.7 }),
  tache('titre', { section: true, coutPrevu: 999, coutConso: 0 }),
];

describe('Rentabilité', () => {
  it('explique tout l’écart entre la marge vendue et la marge à terminaison', () => {
    const marches = cascadeMarge(financier(), TACHES);
    expect(marches[0]).toMatchObject({ cle: 'vendue', montant: 31000, nature: 'total' });
    expect(marches.at(-1)).toMatchObject({ cle: 'terminaison', montant: 22740, nature: 'total' });
    const variations = marches.slice(1, -1).reduce((s, m) => s + m.montant, 0);
    expect(31000 + variations).toBeCloseTo(22740, 6);
    // l'optimisation n'est plus masquée par le dépassement : deux colonnes distinctes
    expect(marches.some((m) => m.cle === 'derive')).toBe(false);
    expect(marches.find((m) => m.cle === 'optim')).toMatchObject({ montant: 1000, nature: 'hausse' });
    expect(marches.find((m) => m.cle === 'depass')).toMatchObject({ montant: -6000, nature: 'baisse' });
    expect(marches.find((m) => m.cle === 'annulations')).toMatchObject({ montant: 1000, nature: 'hausse' });
  });

  it('n’affiche pas les variations nulles', () => {
    const marches = cascadeMarge(financier(), TACHES);
    expect(marches.some((m) => m.cle === 'avenants')).toBe(false);
    expect(marches.some((m) => m.cle === 'reaff')).toBe(false);
  });

  it('montre le surcoût des réaffectations vers un CJM plus élevé', () => {
    // 1 JH passé d'un CJM 400 à un CJM 500 : le coût prévu des tâches augmente de 100 €, les dépassements ne le comptent pas une seconde fois
    const taches = TACHES.map((t) => (t.uid === 't1' ? { ...t, coutPrevu: 40100 } : t));
    const marches = cascadeMarge(financier({ coutReaff: 100, coutPrevu: 70100 }), taches);
    expect(marches.find((m) => m.cle === 'reaff')).toMatchObject({ montant: -100, nature: 'baisse' });
    expect(marches.find((m) => m.cle === 'depass')).toMatchObject({ montant: -5900 });
    const variations = marches.slice(1, -1).reduce((s, m) => s + m.montant, 0);
    expect(31000 + variations).toBeCloseTo(22740, 6);
  });

  it('place une marge négative sous le zéro', () => {
    const { barres, zero } = placerCascade(cascadeMarge(financier({ margeNette: -5000, margeNetteVendue: 10000 }), TACHES));
    expect(zero).toBeGreaterThan(0);
    const fin = barres.at(-1)!;
    expect(fin.bas).toBeCloseTo(0, 6);
    expect(fin.bas + fin.hauteur).toBeCloseTo(zero, 6);
  });

  it('coupe l’échelle pour que les petites variations restent visibles', () => {
    const { barres, coupee } = placerCascade(cascadeMarge(financier(), TACHES));
    expect(coupee).toBe(true);
    const depass = barres.find((b) => b.cle === 'depass')!;
    expect(depass.hauteur).toBeGreaterThan(10);
    expect(barres[0].bas).toBe(0);
  });

  it('retire du chiffre d’affaires les avenants de réduction', () => {
    const marches = cascadeMarge(financier({ caAvenant: 2000, margeNette: 20140 }), TACHES);
    expect(marches.find((m) => m.cle === 'avenants')).toMatchObject({ montant: -2000, nature: 'baisse' });
    expect(marches.some((m) => m.cle === 'autres')).toBe(false);
  });

  it('simule une dépense sans rien enregistrer', () => {
    const f = financier();
    const s = simulerDepense(f, { personnes: 6, jours: 2, transport: 180, sejour: 160, refacture: 0 });
    expect(s.cout).toBe(6 * 180 + 6 * 2 * 160);
    expect(s.margeApres).toBe(22740 - 3000);
    expect(s.tauxApres).toBeCloseTo((22740 - 3000) / (100000 + 2600 + 0), 9);
    expect(s.ecartPoints).toBeLessThan(0);
  });

  it('ignore les saisies vides ou négatives et tient compte du refacturé', () => {
    const s = simulerDepense(financier(), { personnes: -2, jours: Number.NaN, transport: 100, sejour: 100, refacture: 500 });
    expect(s.cout).toBe(0);
    expect(s.margeApres).toBe(22740 + 500);
  });

  it('signale l’économie fictive d’une tâche validée sans consommé', () => {
    const taches = [...TACHES, tache('t3', { statut: 'Validé', charge: 1, consoTotal: 0, raf: 0, atterrissage: 0, coutPrevu: 450, coutConso: 0, coutRaf: 0 })];
    const e = ecartsTaches(taches).find((x) => x.t.uid === 't3')!;
    expect(e).toMatchObject({ ecart: -450, fini: true, sansConso: true });
    const d = detailMarche('optim', donnees({}, taches))!;
    expect(d.alerte).toMatch(/1 tâche validée sans consommé/);
    expect(d.tableaux[0].titre).toMatch(/Constatées/);
    expect(d.tableaux[0].lignes.find((l) => l.cellules[0].tache === 't3')?.classe).toBe('rd-fictif');
    expect(d.action).toMatchObject({ chemin: 'workload', wl: 'conso' });
  });

  it('détaille chaque colonne : de quoi il s’agit, le calcul, les tâches', () => {
    for (const m of cascadeMarge(financier(), TACHES, { toutes: true })) {
      const d = detailMarche(m.cle, donnees());
      expect(!!d && d.quoi.length > 20 && d.calcul.length > 0).toBe(true);
    }
    expect(detailMarche('inconnue', donnees())).toBeNull();
    const dep = detailMarche('depass', donnees())!;
    expect(dep.tableaux[0].lignes[0].cellules[0]).toMatchObject({ texte: 'T1', tache: 't1', statut: 'En cours' });
    // « Autres écarts » : le même montant que la colonne
    const autres = cascadeMarge(financier(), TACHES, { toutes: true }).find((m) => m.cle === 'autres')?.montant ?? 0;
    const d = detailMarche('autres', donnees())!;
    expect(d.calcul.at(-1)?.valeur).toBe(signeE(autres));
  });

  it('frais : seuls ceux à notre charge au-delà de la part prévue réduisent la marge', () => {
    const d = detailMarche('frais', donnees())!;
    expect(d.calcul.map((l) => l.libelle)).toEqual(['Frais refacturables', 'Frais à notre charge', 'Effet sur la marge']);
    expect(d.calcul[1].valeur).toMatch(/^−860/);
  });
});

/** Données lues par le volet de détail. */
function donnees(partiel: Partial<Financier> = {}, taches: TacheMarge[] = TACHES): DonneesDetail {
  return { f: financier(partiel), taches, perimetre: [], cjm: [] };
}
