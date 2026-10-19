import { describe, expect, it } from 'vitest';
import { cheminEntree, ecranDeMontants, entreeActive, entreeGroupee, groupeEcran, groupesVisibles, libelleEcran } from './navigation.logique';

describe('Menu d’un projet (charte v2)', () => {
  it('regroupe Achats et Frais sous « Dépenses », Fiche et Synthèse sous « Fiche & synthèse »', () => {
    const libelles = groupesVisibles(true).flatMap((g) => g.onglets.map((o) => o.libelle));
    expect(libelles).toContain('Dépenses');
    expect(libelles).toContain('Fiche & synthèse');
    expect(libelles).not.toContain('Achats');
    expect(libelles).not.toContain('Frais');
    expect(libelles).not.toContain('Synthèse');
  });

  it('nomme « Planning » l’ancien Gantt, sans renommer Workload ni Actions & décisions', () => {
    const libelles = groupesVisibles(true).flatMap((g) => g.onglets.map((o) => o.libelle));
    expect(libelles).toContain('Planning');
    expect(libelles).not.toContain('Gantt');
    expect(libelles).toContain('Workload');
    expect(libelles).toContain('Actions & décisions');
  });

  it('mène une entrée regroupée à son premier sous-onglet et la garde active sur chacun', () => {
    const dep = groupesVisibles(true).flatMap((g) => g.onglets).find((o) => o.libelle === 'Dépenses')!;
    expect(cheminEntree(dep)).toBe('achats');
    expect(entreeActive(dep, 'frais')).toBe(true);
    expect(entreeGroupee('frais')?.libelle).toBe('Dépenses');
    expect(entreeGroupee('workload')).toBeNull();
  });

  it('cache les écrans de montants à un consultant (Dépenses disparaît, Synthèse aussi)', () => {
    const g = groupesVisibles(false);
    const libelles = g.flatMap((x) => x.onglets.map((o) => o.libelle));
    expect(libelles).not.toContain('Dépenses');
    const fiche = g.flatMap((x) => x.onglets).find((o) => o.libelle === 'Fiche & synthèse')!;
    expect(fiche.sous!.map((x) => x.chemin)).toEqual(['fiche']);
    expect(ecranDeMontants('frais')).toBe(true);
    expect(ecranDeMontants('fiche')).toBe(false);
  });

  it('donne au fil d’Ariane le groupe et le nom de l’écran', () => {
    expect(libelleEcran('frais')).toBe('Frais');
    expect(libelleEcran('planning')).toBe('Planning du TSP');
    expect(groupeEcran('frais')?.groupe.groupe).toBe('Finances');
    expect(groupeEcran('metrique')?.annexe).toBe(true);
  });
});
