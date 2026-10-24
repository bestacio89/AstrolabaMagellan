import { describe, expect, it } from 'vitest';
import { initialesParticipant } from './participants.logique';

describe('Participants d’atelier — initiales', () => {
  it('prend les initiales d’une adresse e-mail', () => {
    expect(initialesParticipant('camille.martin@example.test')).toBe('CM');
  });

  it('accepte un nom complet ou un identifiant avec tiret', () => {
    expect(initialesParticipant('Camille Martin')).toBe('CM');
    expect(initialesParticipant('jean-pierre')).toBe('JP');
  });

  it('retourne un marqueur stable pour une valeur vide', () => {
    expect(initialesParticipant('   ')).toBe('??');
  });
});
