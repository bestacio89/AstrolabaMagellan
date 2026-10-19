import { describe, expect, it } from 'vitest';
import { TspSaisi } from '../api/brouillons.modeles';
import {
  chargeProfil,
  collerDansLeWorkload,
  depuis,
  ecartPlanning,
  libelleMois,
  deplacerLigne,
  lignesAffichees,
  lireCollage,
  lireNombre,
  moisDuPlanning,
  nouvelId,
  repartirSurLaPeriode,
  totalEcheances,
} from './brouillon.logique';

function tsp(): TspSaisi {
  return {
    format: 1,
    fiche: {
      client: 'Client',
      projet: 'Projet',
      reference: '',
      contact: '',
      agence: '',
      serviceLine: '',
      directeur: '',
      responsableSL: '',
      commercial: '',
      typeContrat: 'Forfait',
      debut: '2026-11-02',
      fin: '2027-01-29',
    },
    remise: 0,
    profils: [
      { id: 'p1', nom: 'Chef de projet', entite: 'FO', tjm: 800, cjm: 400, prcs: null, frais: 0, collaborateur: '' },
      { id: 'p2', nom: 'Architecte', entite: 'FO', tjm: 900, cjm: 500, prcs: null, frais: 0, collaborateur: '' },
    ],
    taches: [
      { id: 't1', axe: '1', lot: 'Lot 1', phase: 'PILOTAGE', etape: '', libelle: 'Cadrage', charges: { p1: 2, p2: 1 }, livrable: false, hypothese: '', separateur: false },
      { id: 't2', axe: '1', lot: 'Lot 1', phase: 'CONCEPTION', etape: '', libelle: 'DAT', charges: { p2: 5 }, livrable: true, hypothese: '', separateur: false },
      { id: 't3', axe: '', lot: '', phase: '', etape: '', libelle: 'Socle sécurité', charges: {}, livrable: false, hypothese: '', separateur: true },
      { id: 't4', axe: '2', lot: 'Lot 2', phase: 'CONSTRUCTION', etape: '', libelle: 'Paramétrage', charges: { p2: 0.1 }, livrable: false, hypothese: '', separateur: false },
    ],
    planning: { p2: { '2026-11': 4, '2026-12': 2, '2027-03': 0.1 } },
    echeances: [
      { id: 'e1', nom: 'Commande', pct: 0.2, mois: '2026-11' },
      { id: 'e2', nom: 'Recette', pct: 0.1, mois: null },
    ],
    achats: [],
    prestataires: [],
    frais: [],
    metrique: [],
    phases: [],
    etapes: [],
  };
}

describe('Rédaction du TSP', () => {
  it('crée des identifiants courts et uniques', () => {
    expect(nouvelId('t', tsp().taches)).toBe('t5');
    expect(nouvelId('p', [])).toBe('p1');
  });

  it('additionne les charges sans erreur d’arrondi', () => {
    expect(chargeProfil(tsp(), 'p2')).toBe(6.1);
    expect(totalEcheances([{ id: 'a', nom: '', pct: 0.1, mois: null }, { id: 'b', nom: '', pct: 0.2, mois: null }])).toBe(0.3);
  });

  it('propose les mois de la période, élargis aux mois déjà saisis', () => {
    expect(moisDuPlanning(tsp())).toEqual(['2026-11', '2026-12', '2027-01', '2027-03']);
    expect(libelleMois('2027-03')).toBe('mars 2027');
    // 6,1 JH au workload, 6,1 au planning (dont 0,1 hors période) : pas d'écart
    expect(ecartPlanning(tsp(), 'p2')).toBe(0);
    expect(ecartPlanning(tsp(), 'p1')).toBe(-2);
  });

  it('répartit une charge sur la période par quarts de jour, sans perdre de reste', () => {
    expect(repartirSurLaPeriode(10, ['2026-11', '2026-12', '2027-01'])).toEqual({ '2026-11': 3.25, '2026-12': 3.25, '2027-01': 3.5 });
    expect(repartirSurLaPeriode(0, ['2026-11'])).toEqual({});
  });

  it('lit les nombres saisis à la française', () => {
    expect(lireNombre('12,5')).toBe(12.5);
    expect(lireNombre('1 200')).toBe(1200);
    expect(lireNombre('')).toBe(0);
    expect(lireNombre('abc')).toBeNull();
  });

  it('lit un bloc copié depuis Excel, y compris une cellule sur deux lignes', () => {
    expect(lireCollage('a\tb\r\nc\t"d\ne"\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd\ne'],
    ]);
  });

  it('colle un bloc dans le workload à partir de la cellule choisie, en ajoutant les lignes', () => {
    const t = tsp();
    collerDansLeWorkload(t, 3, 'libelle', [
      ['Recette', '1', '2,5', 'oui'],
      ['Classification des données', '', '', ''],
      ['Formation', '', '3', ''],
    ]);
    expect(t.taches[3]).toMatchObject({ libelle: 'Recette', charges: { p1: 1, p2: 2.5 }, livrable: true, separateur: false });
    // une ligne avec un libellé et sans charge devient un séparateur, comme dans le TSP
    expect(t.taches[4]).toMatchObject({ id: 't5', libelle: 'Classification des données', separateur: true, lot: '' });
    expect(t.taches[5]).toMatchObject({ id: 't6', libelle: 'Formation', charges: { p2: 3 }, separateur: false });
  });

  it('donne à chaque séparateur le total de sa section', () => {
    const l = lignesAffichees(tsp());
    expect(l.map((x) => (x.separateur ? `S:${x.total}:${x.parProfil.join('/')}` : x.index))).toEqual([0, 1, 'S:0.1:0/0.1', 3]);
  });

  it('déplace une ligne par glisser-déposer', () => {
    const l = ['a', 'b', 'c', 'd'];
    deplacerLigne(l, 0, 2);
    expect(l).toEqual(['b', 'c', 'a', 'd']);
    deplacerLigne(l, 3, 0);
    expect(l).toEqual(['d', 'b', 'c', 'a']);
  });

  it('dit depuis quand le brouillon est enregistré', () => {
    const t0 = new Date(2026, 9, 7, 14, 5, 0);
    expect(depuis(t0, new Date(2026, 9, 7, 14, 5, 2))).toBe('à l’instant');
    expect(depuis(t0, new Date(2026, 9, 7, 14, 5, 40))).toBe('il y a 40 s');
    expect(depuis(t0, new Date(2026, 9, 7, 16, 0, 0))).toBe('à 14:05');
  });
});
