import { describe, expect, it } from 'vitest';
import { ProjetResume } from '../../api/modeles';
import { chefs, lignesPortefeuille, lundi, synthese, tempsEcoule } from './portefeuille.logique';

function projet(partiel: Partial<ProjetResume>): ProjetResume {
  return {
    id: '1', nom: 'Projet', client: 'Client', reference: null, statut: 'En cours', statutCode: 'EnCours',
    monRole: 'Chef de projet', monRoleCode: 'ChefDeProjet', voitMontants: true, estVide: false,
    avancement: 0.5, prevu: 100, consomme: 50, atterrissage: 100, ecart: 0, tauxMargeAtterrissage: 0.3, tauxMargeVendue: 0.3,
    debut: '2026-01-01', finPrevue: '2026-12-31', finContractuelle: '2026-12-31', joursOuvresRestants: 60, chefDeProjet: 'Noël',
    creeLe: '2026-01-01T00:00:00Z', nombreATraiter: 0, aTraiter: [],
    ...partiel,
  };
}

describe('Portefeuille', () => {
  it('mesure le temps écoulé entre le début et la fin prévue', () => {
    expect(tempsEcoule(projet({}), '2026-01-01')).toBe(0);
    expect(tempsEcoule(projet({}), '2027-03-01')).toBe(1);
    expect(tempsEcoule(projet({ debut: null }), '2026-06-01')).toBeNull();
  });

  it('met les projets fragiles en tête et ignore les projets archivés', () => {
    const lignes = lignesPortefeuille(
      [
        projet({ id: 'ok', client: 'A' }),
        projet({ id: 'derive', client: 'B', ecart: 20 }),
        projet({ id: 'surv', client: 'C', ecart: 5 }),
        projet({ id: 'clos', statutCode: 'Archive', ecart: 50 }),
        projet({ id: 'vide', estVide: true, statutCode: 'EnPreparation' }),
      ],
      '2026-07-01',
    );
    expect(lignes.map((l) => l.projet.id)).toEqual(['derive', 'surv', 'ok', 'vide']);
    expect(lignes[0].sante.libelle).toBe('Dépassement');
  });

  it('signale un avancement en retard sur le temps écoulé et une marge sous la marge vendue', () => {
    const [l] = lignesPortefeuille([projet({ avancement: 0.2, tauxMargeAtterrissage: 0.25 })], '2026-07-01');
    expect(l.enRetardSurLeTemps).toBe(true);
    expect(l.ecartMarge).toBeCloseTo(-0.05, 9);
    const s = synthese([l]);
    expect(s.sousMargeVendue).toBe(1);
    expect(s.enRetardSurLeTemps).toBe(1);
  });

  it('ne montre pas de marge quand le rôle ne la voit pas', () => {
    const [l] = lignesPortefeuille([projet({ tauxMargeAtterrissage: null, tauxMargeVendue: null, voitMontants: false })], '2026-07-01');
    expect(l.ecartMarge).toBeNull();
    expect(synthese([l]).avecMarge).toBe(0);
  });

  it('filtre par chef de projet et donne le lundi de la semaine', () => {
    const liste = [projet({ id: 'a', chefDeProjet: 'Noël' }), projet({ id: 'b', chefDeProjet: 'Romain' })];
    expect(chefs(liste)).toEqual(['Noël', 'Romain']);
    expect(lignesPortefeuille(liste, '2026-07-01', 'Romain').map((l) => l.projet.id)).toEqual(['b']);
    expect(lundi('2026-10-07')).toBe('2026-10-05');
    expect(lundi('2026-10-05')).toBe('2026-10-05');
    expect(lundi('2026-10-11')).toBe('2026-10-05');
  });
});
