import { describe, expect, it } from 'vitest';
import { donneesDiapo, EntreePointHebdo, lignes, lundiDe, nomFichier, numeroSemaine, PointsHebdo, saisieDeLaPeriode, SaisiePeriode } from './point-hebdo.logique';

/** Projet fictif : 2 profils (TJM 800 et 600), 2 tâches de la phase CONSTRUCTION, 2 échéances. */
function entree(partiel: Partial<EntreePointHebdo> = {}): EntreePointHebdo {
  const tache = (consoP: Record<string, Record<string, number>>, raf: number) => ({
    phase: 'CONSTRUCTION', chargesV: [2, 2], chargeTSP: 4, charge: 4, restP: [1, 1], raf, annulee: false, statut: 'En cours', debut: '2026-10-01', fin: '2026-11-30', tr: { consoP },
  });
  return {
    P: [{ tjmR: 800, collaborateur: 'Alex MARTIN' }, { tjmR: 600, collaborateur: 'CDP' }],
    taches: [tache({ '0': { '2026-10-05': 1, '2026-10-12': 1 } }, 3), tache({}, 4)],
    caTSP: 11200, chargeAjout: 0, chargeAnnulee: 0,
    echeancier: [
      { n: 1, nom: 'Commande', pct: 0.5, mois: '2026-09', montant: 5600, datePrevue: '2026-09-30', realiseLe: '2026-09-30', payeeLe: null },
      { n: 2, nom: 'Recette', pct: 0.5, mois: '2026-10', montant: 5600, datePrevue: '2026-10-01', realiseLe: null, payeeLe: null },
    ],
    risques: [{ libelle: 'Licences', parade: '', crit: 2 }, { libelle: 'RSSI absent', parade: 'Suppléant', crit: 9 }],
    actions: [{ libelle: 'Valider le planning', porteur: 'Alex', statut: 'En cours', echeance: '2026-10-02', commentaire: '', faitLe: null }],
    fiche: { client: 'CLIENT EXEMPLE', projet: 'Projet exemple', typeContrat: 'Forfait', champs: [{ key: 'commercial', value: 'Claire FONTAINE' }] },
    dates: { debut: '2026-09-07', finContrat: '2027-04-07', finPrevue: '2027-04-07' },
    iaProfile: -1,
    ...partiel,
  };
}
const vide: SaisiePeriode = { actualites: [], attention: [], indicateurs: {}, extension: 'Non' };
const options = (o: Partial<Parameters<typeof donneesDiapo>[1]> = {}) => ({
  periode: 'semaine' as const, semaine: '2026-10-05', mois: '2026-10', aujourdhui: '2026-10-09', saisie: vide, reglages: {}, logoEntrepriseParDefaut: null, ...o,
});

describe('Point hebdo', () => {
  it('compte le consommé jusqu’au vendredi de la semaine, valorisé au TJM', () => {
    const d = donneesDiapo(entree(), options());
    expect(d.conso).toBe(1); // le jour du 12/10 est après la semaine du 05/10
    expect(d.budgetConsomme).toBe(800);
    expect(d.phases[0]).toMatchObject({ phase: 'CONSTRUCTION', v: 8, c: 1, vendu: 5600 });
    expect(d.periode).toMatchObject({ numero: 41, debut: '2026-10-05', fin: '2026-10-09', colS: 'S', colS1: 'S+1' });
  });

  it('compte tout le mois pour un point mensuel', () => {
    const d = donneesDiapo(entree(), options({ periode: 'mois' }));
    expect(d.conso).toBe(2);
    expect(d.periode).toMatchObject({ debut: '2026-10-01', fin: '2026-10-31', colS: 'M', colS1: 'M+1' });
  });

  it('propose les indicateurs d’après le calcul, et la saisie les remplace', () => {
    const d = donneesDiapo(entree(), options());
    const ind = (c: string) => d.indicateurs.find((i) => i.cle === c);
    expect(ind('facturation')).toMatchObject({ s: 'jaune', raison: '1 échéance(s) en retard' }); // échéance 2 prévue le 01/10, non facturée
    expect(ind('budget')?.s).toBe('vert'); // 1 consommé + 7 restants = 8 prévus : pas de dérive
    const saisi = donneesDiapo(entree(), options({ saisie: { ...vide, indicateurs: { facturation: { s: 'vert', s1: 'vert' } } } }));
    expect(saisi.indicateurs.find((i) => i.cle === 'facturation')).toMatchObject({ s: 'vert', propose: 'jaune' });
  });

  it('garde les 3 risques les plus critiques et les actions ouvertes en retard', () => {
    const d = donneesDiapo(entree(), options());
    expect(d.risques[0]).toMatchObject({ libelle: 'RSSI absent', niveau: 'rouge' });
    expect(d.actions[0]).toMatchObject({ libelle: 'Valider le planning', retard: true });
    expect(d.consultants).toEqual(['Alex MARTIN']); // « CDP » n'est pas un nom de personne
    expect(d.commercial).toBe('Claire FONTAINE');
  });

  it('reprend la période précédente pour un nouveau point (sauf les actualités)', () => {
    const points: PointsHebdo = {
      reglages: {},
      periodes: { 'S:2026-09-28': { ...vide, actualites: ['ancienne'], attention: ['RSSI'], indicateurs: { qualite: { s: 'vert', s1: 'jaune' } }, extension: 'Oui' } },
    };
    const r = saisieDeLaPeriode(points, 'S:2026-10-05');
    expect(r).toMatchObject({ enregistree: false, reprise: 'S:2026-09-28' });
    expect(r.saisie).toMatchObject({ actualites: [], attention: ['RSSI'], extension: 'Oui', indicateurs: { qualite: { s: 'jaune', s1: 'jaune' } } });
    expect(saisieDeLaPeriode(points, 'M:2026-10').reprise).toBeNull(); // un point mensuel ne reprend pas un point hebdo
  });

  it('nomme le fichier et lit une ligne par point', () => {
    expect(nomFichier(donneesDiapo(entree(), options()))).toBe('Point hebdo S41 2026 - CLIENT EXEMPLE - Projet exemple.pptx');
    expect(lignes('- un\n\n• deux \n')).toEqual(['un', 'deux']);
    expect(lundiDe('2026-10-09')).toBe('2026-10-05');
    expect(numeroSemaine('2027-01-01')).toBe(53);
  });
});
