import { describe, expect, it } from 'vitest';
import { formatDate, formatEcart, formatJh, formatPourcentage, initiales, lectureAtterrissage } from './formats';

/** Espaces insécables utilisés par la mise en forme française (on les remplace pour comparer plus simplement). */
const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ');

describe('Mise en forme', () => {
  it('écrit les jours-homme avec une virgule', () => {
    expect(formatJh(4.5)).toBe('4,5');
    expect(formatJh(null)).toBe('—');
  });

  it('écrit un écart avec son signe', () => {
    expect(formatEcart(0.5)).toBe('+0,5');
    expect(formatEcart(-6)).toBe('−6');
    expect(formatEcart(0)).toBe('0');
  });

  it('écrit un pourcentage à partir d’un ratio', () => {
    expect(sansInsecables(formatPourcentage(0.5358, 2))).toBe('53,58 %');
  });

  it('écrit une date sans décalage de fuseau horaire', () => {
    expect(formatDate('2027-04-07')).toBe('07/04/2027');
  });

  it('donne les initiales', () => {
    expect(initiales('Camille', 'Martin')).toBe('CM');
  });
});

describe('Lecture de l’atterrissage', () => {
  it('distingue optimisation, cible, surveillance et dépassement', () => {
    expect(lectureAtterrissage(-6, 140).libelle).toBe('Optimisation');
    expect(lectureAtterrissage(0.5, 191).libelle).toBe('Dans la cible');
    expect(lectureAtterrissage(4, 82).libelle).toBe('À surveiller');
    expect(lectureAtterrissage(20, 82).libelle).toBe('Dépassement');
  });
});
