import { describe, expect, it } from 'vitest';
import { nomFichierMacro, pale, presentationMacro } from './macro-planning';
import { Presentation } from './point-hebdo.diapo';

/** Présentation factice qui compte les appels (même interface que PptxGenJS). */
function factice() {
  const appels: string[] = [];
  const slide = {
    background: undefined as unknown,
    addText: (t: unknown) => appels.push('texte:' + (typeof t === 'string' ? t : 'runs')),
    addShape: (s: string) => appels.push('forme:' + s),
    addTable: () => appels.push('table'),
    addImage: () => appels.push('image'),
  };
  const pres = {
    ShapeType: { rect: 'rect', roundRect: 'roundRect', line: 'line', sun: 'sun', cloud: 'cloud', lightningBolt: 'lightningBolt', rightArrow: 'rightArrow', diamond: 'diamond' },
    addSlide: () => slide,
    write: async () => null,
  } as unknown as Presentation;
  return { pres, appels };
}

describe('Macro-Planning', () => {
  it('nom du fichier sans caractères interdits', () => {
    expect(nomFichierMacro({ client: 'A/B', projet: 'P' })).toBe('Macro-Planning - A B - P.pptx');
  });

  it('couleur éclaircie', () => {
    expect(pale('000000', 0.5)).toBe('808080');
  });

  it('une diapositive : titre, mois, lignes (barre ou losange), jalons et légende', () => {
    const { pres, appels } = factice();
    presentationMacro(pres, {
      client: 'C',
      projet: 'P',
      aujourdhui: '2026-10-19',
      mois: ['2026-09', '2026-10', '2026-11'],
      lignes: [
        { libelle: 'Axe 1', sous: false, idx: 0, debut: '2026-09-07', fin: '2026-11-20' },
        { libelle: 'Atelier', sous: true, idx: 0, losange: { date: '2026-10-05', fait: true } },
        { libelle: 'Axe 2', sous: false, idx: 1 },
      ],
      jalons: [{ numero: 1, libelle: 'COPIL', quand: '13/10', debut: '2026-10-13', fin: null, aConfirmer: false }],
    });
    expect(appels).toContain('texte:Macro-Planning');
    expect(appels).toContain('texte:AXE 1');
    expect(appels).toContain('texte:Non planifié');
    expect(appels).toContain('texte:JALONS');
    expect(appels.filter((a) => a === 'forme:diamond').length).toBe(2); // l'atelier et le jalon
  });
});
