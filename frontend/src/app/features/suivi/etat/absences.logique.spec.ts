import { describe, expect, it } from 'vitest';
import { ABS_SUITE, absenceProfil, clePersonne, equipe, indexAbsences, joursAbsence } from './absences.logique';

describe('Absences', () => {
  it('même clé que le serveur, quel que soit l’ordre, la casse ou les accents', () => {
    expect(clePersonne('MARTIN  Camille')).toBe('camille martin');
    expect(clePersonne('Élodie Dupré')).toBe('dupre elodie');
  });

  it('une ligne par collaborateur (avec ses profils), puis les personnes ajoutées', () => {
    const l = equipe(
      [
        { nom: 'Chef de projet', collaborateur: 'Camille Martin' },
        { nom: 'Expert', collaborateur: '' },
        { nom: 'Architecte', collaborateur: 'martin camille' },
      ],
      [{ id: 'p1', nom: 'Alex Dupont' }, { id: 'p2', nom: 'Camille MARTIN' }],
    );
    expect(l.map((p) => [p.nom, p.profils.join(' · '), p.ajoutee ?? ''])).toEqual([
      ['Camille Martin', 'Chef de projet · Architecte', ''],
      ['Alex Dupont', '', 'p1'],
    ]);
  });

  it('jours d’absence (demi-journée = 0,5), jours ouvrés seulement ; absence d’un profil par son collaborateur', () => {
    const idx = indexAbsences([
      { personne: 'camille martin', jour: '2026-10-05', moment: 'j' },
      { personne: 'camille martin', jour: '2026-10-06', moment: 'm' },
      { personne: 'camille martin', jour: '2026-10-10', moment: 'j' }, // samedi : ignoré
    ]);
    expect(joursAbsence(idx, 'camille martin', ['2026-10-05', '2026-10-06', '2026-10-10'])).toBe(1.5);
    expect(absenceProfil(idx, 'MARTIN Camille', '2026-10-06')).toBe('m');
    expect(absenceProfil(idx, '', '2026-10-06')).toBe('');
    expect(ABS_SUITE['']).toBe('j');
    expect(ABS_SUITE.a).toBe('');
  });
});
