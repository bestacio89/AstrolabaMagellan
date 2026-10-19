import { describe, expect, it } from 'vitest';
import { Groupe, PlanReference } from '../api/modeles';
import {
  avantPossible,
  barres,
  cleTache,
  derivesGroupes,
  echelle,
  filtreDe,
  jalonsPlaces,
  lignesAffichees,
  moisAffiches,
  quand,
  quandLong,
  retardLigne,
  surligne,
  TachePlanning,
  trouve,
  sansAccent,
} from './planning.logique';

const groupe = (id: string, p: Partial<Groupe> = {}): Groupe =>
  ({ id, nom: 'Axe ' + id, cle: 'id|' + id, actives: 2, statut: 'En cours', planDebut: null, planFin: null, reelDebut: null, reelFin: null, sousParties: [], ...p }) as Groupe;
const tache = (uid: string, grp: string, p: Partial<TachePlanning> = {}): TachePlanning => ({
  uid,
  label: 'Tâche ' + uid,
  grp,
  statut: 'À faire',
  annulee: false,
  avancement: 0,
  type: null,
  consoDates: [],
  tr: {},
  ...p,
});

describe('Planning › vue d’ensemble', () => {
  const axes = [
    groupe('A', { sousParties: [{ id: 's1', nom: 'Cadrage', nomTSP: 'Cadrage', axe: 'A', uids: ['t1'], cle: 'sec|s1|A' } as never] }),
    groupe('B'),
  ];
  const taches = [tache('t1', 'A'), tache('t2', 'B'), tache('t3', 'B', { annulee: true })];

  it('mise en avant : sous un axe ou une phase seulement', () => {
    expect(avantPossible('id')).toBe(true);
    expect(avantPossible('phase')).toBe(true);
    expect(avantPossible('lot')).toBe(false);
  });

  it('chaque groupe, puis ses sous-parties et tâches mises en avant ; une ligne masquée garde ses éléments', () => {
    const avant = { 'sec|s1|A': true, [cleTache('t2')]: true, [cleTache('t3')]: true };
    const l = lignesAffichees(axes, taches, 'id', avant, { 'id|B': true });
    expect(l.map((x) => (x.t ? x.t.uid : x.g!.cle))).toEqual(['id|A', 'sec|s1|A', 't2']);
    expect(l[2].parentCache).toBe(true); // B masqué : la tâche garde le nom de sa ligne
    // regroupé par lot : rien n'est mis en avant (rien n'est perdu)
    expect(lignesAffichees(axes, taches, 'lot', avant, {}).length).toBe(2);
  });

  it('retard : fin prévue dépassée, jusqu’à aujourd’hui ou jusqu’au dernier consommé si validée', () => {
    expect(retardLigne({ ...groupe('A'), planFin: '2026-10-01' }, '2026-10-19')).toBe('2026-10-19');
    expect(retardLigne({ ...groupe('A'), planFin: '2026-10-01', statut: 'Validé', reelFin: '2026-10-05' } as Groupe, '2026-10-19')).toBe('2026-10-05');
    expect(retardLigne({ ...groupe('A'), planFin: '2026-10-30' }, '2026-10-19')).toBeNull();
  });

  it('dates des jalons comme en comité', () => {
    expect(quand({ type: 'date', debut: '2026-10-13', fin: null })).toBe('13/10');
    expect(quand({ type: 'periode', debut: '2026-10-19', fin: '2026-10-30' })).toBe('19 au 30/10');
    expect(quand({ type: 'periode', debut: '2026-10-26', fin: '2026-11-06' })).toBe('26/10 au 06/11');
    expect(quand({ type: 'semaine', debut: '2026-11-04', fin: null })).toBe('Sem. du 02/11');
    expect(quandLong({ type: 'semaine', debut: '2026-11-04', fin: null })).toBe('semaine du 02/11/2026');
    expect(quandLong({ type: 'date', debut: '2026-10-13', fin: null })).toBe('le 13/10/2026');
  });

  it('mois affichés : du plus tôt au plus tard, aujourd’hui compris', () => {
    const m = moisAffiches({ debut: '2026-09-07', finPrevue: '2026-11-20', finContrat: null }, '2026-10-19', [], [{ debut: '2027-01-05', fin: null }], []);
    expect(m).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  });

  it('barres : prévu saisi ou calculé, réel, retard et pourcentage', () => {
    const { pc } = echelle(['2026-09', '2026-10', '2026-11']);
    const b = barres(pc, { pd: '2026-10-01', pf: '2026-10-10', saisi: false, rd: '2026-10-02', rf: '2026-10-15', fin: '2026-10-19', valide: false, av: 0.5 });
    expect(b.map((x) => x.type)).toEqual(['date', 'prevu', 'reel', 'retard', 'pct']);
    expect(b[0].texte).toBe('01/10/2026 → 10/10/2026'); // barre courte : une seule étiquette
    expect(b[1].classe).toBe('calc');
    expect(b[4].texte).toBe('50 %');
    expect(barres(pc, { saisi: true, fin: null, valide: false, av: 0 })).toEqual([]);
  });

  it('deux jalons proches : la pastille du second monte d’un étage', () => {
    const { pc } = echelle(['2026-10']);
    const p = jalonsPlaces(
      [
        { id: '1', libelle: 'a', type: 'date', debut: '2026-10-05', fin: null, aConfirmer: false, numero: 1 },
        { id: '2', libelle: 'b', type: 'date', debut: '2026-10-06', fin: null, aConfirmer: true, numero: null },
      ],
      pc,
      '2026-10-19',
    );
    expect(p.map((x) => [x.etage, x.etat])).toEqual([
      [0, 'passe'],
      [1, 'conf'],
    ]);
  });

  it('recherche sans accent ni majuscule, passage surligné', () => {
    expect(trouve('Sécurité du tenant', sansAccent('securite'))).toBe(true);
    expect(surligne('Sécurité du tenant', 'securite')).toEqual({ avant: '', trouve: 'Sécurité', apres: ' du tenant' });
    expect(filtreDe({ statut: 'Bloqué / En attente' })).toBe('encours');
  });

  it('journal : lignes décalées depuis la référence', () => {
    const ref = { id: 'r', libelle: 'R', date: '2026-09-01', par: null, lignes: {}, groupes: { 'id|A': { debut: '2026-09-01', fin: '2026-10-01', nom: 'Axe A' } } } as PlanReference;
    const d = derivesGroupes([groupe('A', { planDebut: '2026-09-01', planFin: '2026-10-11' }), groupe('B')], ref);
    expect(d).toEqual([{ cle: 'id|A', nom: 'Axe A', debutReference: '2026-09-01', finReference: '2026-10-01', debut: '2026-09-01', fin: '2026-10-11', decalage: 10 }]);
  });
});
