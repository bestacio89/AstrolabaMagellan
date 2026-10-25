import { describe, expect, it } from 'vitest';
import { filteredTasks, Vue } from './vue';

describe('Recherche Workload', () => {
  it('inclut les commentaires de la tâche dans la recherche', () => {
    const t = { uid: 'T-1', label: 'Tâche de suivi', lot: '1.1', commentaire: '', grp: 'AXE1', estAjout: false, chargeAjout: 0, annulee: false };
    const v = {
      tasks: [t],
      m: { perimetre: { lignes: [] } },
      projet: { commentaires: { 'T-1': [{ texte: 'point de blocage transversal' }] } },
    } as unknown as Vue;
    expect(filteredTasks(v, { axe: null, q: 'transversal', onlyAjout: false })).toHaveLength(1);
  });
});
