import { describe, expect, it } from 'vitest';
import { ProjetResume } from '../../../api/modeles';
import { chiffresCles, compter, filtrerEtTrier, pointsDesProjets } from './accueil.logique';

function projet(partiel: Partial<ProjetResume>): ProjetResume {
  return {
    id: '1', nom: 'Projet', client: 'Client', reference: null, statut: 'En cours', statutCode: 'EnCours',
    monRole: 'Chef de projet', monRoleCode: 'ChefDeProjet', voitMontants: true, estVide: false,
    avancement: 0, prevu: 10, consomme: 0, atterrissage: 10, ecart: 0, tauxMargeAtterrissage: null, tauxMargeVendue: null,
    debut: null, finPrevue: null, finContractuelle: null, joursOuvresRestants: null, chefDeProjet: null,
    creeLe: '2026-10-01T00:00:00Z', nombreATraiter: 0, aTraiter: [],
    ...partiel,
  };
}

const projets = [
  projet({ id: 'a', client: 'Client Exemple', nom: 'Projet Exemple', reference: 'OP123', nombreATraiter: 2, ecart: 0.5, finPrevue: '2027-04-07' }),
  projet({ id: 'b', client: 'Hélios', nom: 'Gouvernance', ecart: 4, finPrevue: '2026-12-18' }),
  projet({ id: 'c', client: 'Atlas', nom: 'Copilot', statutCode: 'EnPreparation', estVide: true }),
  projet({ id: 'd', client: 'Port', nom: 'Socle', statutCode: 'Archive' }),
];

describe('Liste des projets', () => {
  it('compte les projets par statut (actifs = en cours + en préparation)', () => {
    expect(compter(projets)).toEqual({ actifs: 3, 'en-cours': 2, 'en-preparation': 1 });
  });

  it('cherche sans tenir compte des accents ni des majuscules', () => {
    expect(filtrerEtTrier(projets, 'actifs', 'helios', 'client').map((p) => p.id)).toEqual(['b']);
    expect(filtrerEtTrier(projets, 'actifs', 'op123', 'client').map((p) => p.id)).toEqual(['a']);
  });

  it('trie par fin prévue, écart, ou points à traiter', () => {
    expect(filtrerEtTrier(projets, 'en-cours', '', 'fin').map((p) => p.id)).toEqual(['b', 'a']);
    expect(filtrerEtTrier(projets, 'en-cours', '', 'ecart').map((p) => p.id)).toEqual(['b', 'a']);
    expect(filtrerEtTrier(projets, 'actifs', '', 'a-traiter')[0].id).toBe('a');
  });
});

describe('Points à traiter', () => {
  it('place les points critiques en premier et ignore les projets archivés', () => {
    const avecPoints = [
      projet({ id: 'a', aTraiter: [{ cle: 'echapres', libelle: 'Échéances après la fin', niveau: 'attention', detail: null, valeur: '2', unite: null }] }),
      projet({ id: 'b', aTraiter: [{ cle: 'reestimer', libelle: 'RAF à réestimer', niveau: 'critique', detail: null, valeur: '1', unite: null }] }),
      projet({ id: 'd', statutCode: 'Archive', aTraiter: [{ cle: 'bloque', libelle: 'Bloquée', niveau: 'critique', detail: null, valeur: '1', unite: null }] }),
    ];
    const points = pointsDesProjets(avecPoints);
    expect(points.map((p) => p.point.cle)).toEqual(['reestimer', 'echapres']);
    expect(points[1].categorie.libelle).toBe('Facturation');
  });
});

describe('Chiffres clés', () => {
  it('ne compte que les projets actifs, et la charge des seuls projets suivis', () => {
    const c = chiffresCles([
      projet({ id: 'a', prevu: 100, consomme: 20, ecart: 0 }),
      projet({ id: 'b', prevu: 50, consomme: 10, ecart: 20 }),
      projet({ id: 'c', statutCode: 'EnPreparation', estVide: true, prevu: 0 }),
      projet({ id: 'd', statutCode: 'Archive', prevu: 30, consomme: 30 }),
    ]);
    expect(c).toEqual({ actifs: 3, dansLaCible: 1, consomme: 30, prevu: 150 });
  });
});
