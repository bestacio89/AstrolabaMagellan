import { describe, expect, it } from 'vitest';
import { initialesDe, lienOuvrable, mentionne, morceaux, nomDocument } from './fil.logique';

describe('Fil de mises à jour', () => {
  it('met les mentions en évidence sans toucher au reste', () => {
    expect(morceaux('@Chloé peux-tu relire ? Merci')).toEqual([
      { texte: '@Chloé', mention: true },
      { texte: ' peux-tu relire ? Merci', mention: false },
    ]);
    expect(morceaux('<b>pas de HTML</b>')).toEqual([{ texte: '<b>pas de HTML</b>', mention: false }]);
  });

  it('reconnaît une personne mentionnée, sans tenir compte des accents', () => {
    expect(mentionne('@chloe tu reprends ?', 'Chloé', 'Martin')).toBe(true);
    expect(mentionne('@Chloé.Martin tu reprends ?', 'Chloé', 'Martin')).toBe(true);
    expect(mentionne('Chloé tu reprends ?', 'Chloé', 'Martin')).toBe(false);
    expect(mentionne('@Romain tu reprends ?', 'Chloé', 'Martin')).toBe(false);
  });

  it('distingue les liens web des chemins réseau', () => {
    expect(lienOuvrable('https://exemple.sharepoint.com/sites/p/doc.docx')).toBe(true);
    expect(lienOuvrable('\\\\serveur\\projets\\doc.docx')).toBe(false);
    expect(lienOuvrable(null)).toBe(false);
  });

  it('donne un nom court au document', () => {
    expect(nomDocument('https://exemple.sharepoint.com/sites/p/Cahier%20de%20recette.docx?web=1')).toBe('Cahier de recette.docx');
    expect(nomDocument('\\\\serveur\\projets\\Livrable.pdf')).toBe('Livrable.pdf');
    expect(initialesDe('Camille Martin')).toBe('CM');
  });
});
