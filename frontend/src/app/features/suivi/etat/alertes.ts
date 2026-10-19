import { Action, EcheanceCalculee } from '../api/modeles';
import { addDays, joursEntre } from './outils';
import { EtatEcheance, TacheVue, Vue, echEtat, estOuverte, isAtelier, lvPrevue } from './vue';

/**
 * Bloc « À traiter » du tableau de bord : actions, ateliers, livrables, facturation et bilans IA
 * en retard ou proches de leur date (délais réglables dans les paramètres). Repris de la version de référence.
 */

export type NiveauAlerte = 'crit' | 'warn' | 'info';

export interface AlerteAction {
  action: Action;
  niveau: NiveauAlerte;
  quand: string;
}

export interface AlerteAtelier {
  tache: TacheVue;
  niveau: NiveauAlerte;
  quand: string;
  /** Date passée : replanifier ou valider. */
  passe: boolean;
}

export interface AlerteLivrable {
  tache: TacheVue;
  niveau: NiveauAlerte;
  quand: string;
}

export interface AlerteEcheance {
  echeance: EcheanceCalculee;
  etat: EtatEcheance;
  quand: string;
}

export interface BlocsAlertes {
  actions: AlerteAction[];
  actionsRetard: number;
  ateliers: AlerteAtelier[];
  ateliersRetard: number;
  ateliersSansDate: number;
  livrables: AlerteLivrable[];
  livrablesRetard: number;
  echeances: AlerteEcheance[];
  echeancesRetard: number;
  bilansIa: TacheVue[];
}

function niveau(k: number, passeLibelle: (n: number) => string, procheNiveau: NiveauAlerte = 'info'): [NiveauAlerte, string] {
  if (k < 0) return ['crit', passeLibelle(-k)];
  if (k === 0) return ['warn', 'Aujourd’hui'];
  return [procheNiveau, k === 1 ? 'Demain' : `Dans ${k} j`];
}

export function calculerAlertes(v: Vue): BlocsAlertes {
  const td = v.aujourdhui;

  // actions : en retard (toujours) + date cible dans le délai d'alerte
  const limA = addDays(td, v.alerteActions);
  const actions = v.projet.actions
    .filter((a) => a.libelle.trim() && estOuverte(a) && a.echeance && a.echeance <= limA)
    .sort((x, y) => (x.echeance ?? '').localeCompare(y.echeance ?? ''))
    .map((a) => {
      const [n, quand] = niveau(joursEntre(td, a.echeance ?? td), (k) => `En retard de ${k} j`);
      return { action: a, niveau: n, quand };
    });

  // ateliers datés dans le délai, invitation non partie
  const ats = v.tasks.filter((t) => isAtelier(t) && !t.annulee && t.statut !== 'Validé');
  const limAt = addDays(td, v.alerteAteliers);
  const ateliers = ats
    .filter((t) => t.tr.atelier?.date && !t.tr.atelier.invit && t.tr.atelier.date <= limAt)
    .sort((a, b) => (a.tr.atelier?.date ?? '').localeCompare(b.tr.atelier?.date ?? ''))
    .map((t) => {
      const k = joursEntre(td, t.tr.atelier?.date ?? td);
      const [n, quand] = niveau(k, (x) => `Passé de ${x} j`, 'warn');
      return { tache: t, niveau: n, quand, passe: k < 0 };
    });

  // livrables dont la livraison est prévue dans le délai
  const limL = addDays(td, v.alerteLivrables);
  const livrables = v.tasks
    .filter((t) => t.type === 'Livrable' && !t.annulee && t.statut !== 'Validé' && lvPrevue(t) && (lvPrevue(t) ?? '') <= limL)
    .sort((a, b) => (lvPrevue(a) ?? '').localeCompare(lvPrevue(b) ?? ''))
    .map((t) => {
      const [n, quand] = niveau(joursEntre(td, lvPrevue(t) ?? td), (k) => `En retard de ${k} j`);
      return { tache: t, niveau: n, quand };
    });

  // échéances non facturées dans le délai
  const echeances = v.m.echeancier
    .filter((e) => !e.realiseLe && e.jours != null && e.jours <= v.alerteEcheances)
    .sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0))
    .map((e) => {
      const [etat, quand] = echEtat(v, e);
      return { echeance: e, etat, quand };
    });

  const bilansIa = v.m.ia.aJustifier.map((uid) => v.parUid.get(uid)).filter((t): t is TacheVue => !!t);

  return {
    actions,
    actionsRetard: actions.filter((x) => x.niveau === 'crit').length,
    ateliers,
    ateliersRetard: ateliers.filter((x) => x.passe).length,
    ateliersSansDate: ats.filter((t) => !t.tr.atelier?.date).length,
    livrables,
    livrablesRetard: livrables.filter((x) => x.niveau === 'crit').length,
    echeances,
    echeancesRetard: echeances.filter((x) => (x.echeance.jours ?? 0) < 0).length,
    bilansIa,
  };
}
