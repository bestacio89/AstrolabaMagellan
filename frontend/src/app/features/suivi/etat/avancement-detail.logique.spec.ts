import { describe, expect, it } from 'vitest';
import { Groupe, Modele, Statistiques } from '../api/modeles';
import { lignesAvancementPptx, nomFichierAvancement, pagesAvancement, sousVisibles, TacheAv, toutDeplier, validesAteliersLivrables, vueAvancement } from './avancement-detail.logique';

const stat = (p: Partial<Statistiques> = {}): Statistiques =>
  ({ prevu: 10, conso: 4, raf: 6, atterrissage: 10, ecart: 0, valides: 1, actives: 3, avancement: 0.3, statut: 'En cours', ateliers: 1, ateliersOK: 0, livrables: 0, livrablesOK: 0, ...p }) as Statistiques;
const tache = (uid: string, grp: string, type: string | null = null, statut = 'À faire'): TacheAv => ({
  uid,
  label: 'Tâche ' + uid,
  grp,
  type,
  statut,
  annulee: false,
  avancement: 0,
  consoTotal: 1,
  charge: 2,
  ecart: 0,
});
const taches = [tache('a', 'AXE1', 'Atelier'), tache('b', 'AXE1'), tache('c', 'AXE2', null, 'Validé')];
const modele = {
  axes: [{ id: 'AXE1', nom: 'Axe 1', ...stat() } as Groupe, { id: 'AXE2', nom: 'Axe 2', ...stat({ statut: 'Validé' }) } as Groupe],
  avancement: {
    cle: 'lot' as const,
    groupes: [
      { id: 'AXE1', nom: 'Axe 1', sous: [{ id: '1.1', nom: 'Lot 1.1', stat: stat(), taches: ['a', 'b'] }] },
      { id: 'AXE2', nom: 'Axe 2', sous: [{ id: '2.1', nom: 'Lot 2.1', stat: stat(), taches: ['c'] }] },
    ],
  },
} as Pick<Modele, 'axes' | 'avancement'>;

describe('avancement détaillé', () => {
  it('sous-parties affichées par défaut, sauf en regroupement par phase ; le choix mémorisé l’emporte', () => {
    expect(sousVisibles('axe', undefined)).toBe(true);
    expect(sousVisibles('phase', undefined)).toBe(false);
    expect(sousVisibles('phase', { phase: true })).toBe(true);
  });

  it('replié par défaut ; « Tout déplier » ouvre groupes et sous-parties', () => {
    const v = vueAvancement(modele, taches, { ouverts: {}, seul: false, avecSous: true });
    expect(v.groupes.map((g) => [g.nom, g.ouvert, g.nT])).toEqual([
      ['Axe 1', false, 2],
      ['Axe 2', false, 1],
    ]);
    expect(v.tousOuverts).toBe(false);
    const o = toutDeplier(modele);
    expect(o).toEqual({ 'g:AXE1': true, 's:AXE1|1.1': true, 'g:AXE2': true, 's:AXE2|2.1': true });
    expect(vueAvancement(modele, taches, { ouverts: o, seul: false, avecSous: true }).tousOuverts).toBe(true);
  });

  it('le filtre « Ateliers et livrables seulement » retire les groupes sans atelier ni livrable', () => {
    const v = vueAvancement(modele, taches, { ouverts: {}, seul: true, avecSous: true });
    expect(v.groupes.map((g) => g.id)).toEqual(['AXE1']);
    expect(v.groupes[0].sous[0].vis.map((t) => t.uid)).toEqual(['a']);
    // sans les sous-parties : les tâches du groupe directement
    const d = vueAvancement(modele, taches, { ouverts: {}, seul: true, avecSous: false });
    expect(d.groupes[0].taches.map((t) => t.uid)).toEqual(['a']);
    expect(d.groupes[0].nT).toBe(1);
  });

  it('les chiffres d’un groupe sont ceux de l’axe ; la couleur suit le rang de l’axe', () => {
    const v = vueAvancement(modele, taches, { ouverts: {}, seul: false, avecSous: true });
    expect(v.groupes[1].stat.statut).toBe('Validé');
    expect(v.groupes[1].couleur).toBe(1);
  });

  it('validées · ateliers · livrables, et « — » quand rien n’est prévu', () => {
    expect(validesAteliersLivrables(stat())).toBe('1/3 · 0/1 · —');
  });

  it('PowerPoint : une ligne par groupe replié, puis le total du projet ; tâches seulement si dépliées', () => {
    const x = { client: 'C', projet: 'P', aujourdhui: '2026-10-19', dimL: 'Axe', dimLl: 'axe', typeNom: (id: string) => id, couleur: (_v: string, d: string) => d };
    const replie = lignesAvancementPptx(vueAvancement(modele, taches, { ouverts: {}, seul: false, avecSous: true }), stat(), x);
    expect(replie.length).toBe(3);
    expect(replie[2].c[0].text).toBe('Projet');
    const deplie = lignesAvancementPptx(vueAvancement(modele, taches, { ouverts: toutDeplier(modele), seul: false, avecSous: true }), stat(), x);
    expect(deplie.length).toBe(3 + 2 + 3); // + 2 sous-parties + 3 tâches
    expect(deplie.find((l) => l.c[0].text === 'Tâche c')?.c[1].text).toBe(new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(1));
  });

  it('découpe en diapositives selon la hauteur disponible', () => {
    const pages = pagesAvancement(Array.from({ length: 30 }, () => ({ h: 0.3 })));
    expect(pages.map((p) => p.length)).toEqual([18, 12]);
  });

  it('nom du fichier sans caractères interdits', () => {
    expect(nomFichierAvancement('A/B', 'P:1', '2026-10-19')).toBe('Avancement - A B - P 1 - 2026-10-19.pptx');
  });
});
