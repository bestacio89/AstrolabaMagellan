import { Injectable, signal } from '@angular/core';

/**
 * Préférences d'affichage de l'écran de suivi (filtres, colonnes masquées, cartes repliées…).
 * Elles ne concernent que l'affichage : mémorisées sur ce poste (navigateur), jamais envoyées au serveur.
 * Si le navigateur refuse le stockage (navigation privée…), l'écran fonctionne quand même.
 */
export interface EtatUi {
  // Workload
  wl: 'suivi' | 'conso' | 'ia';
  /** Liste des tâches : affichage Essentiel, Suivi ou Complet. */
  wlVue: string;
  month: string | null;
  axe: string;
  q: string;
  typeF: string;
  onlyAjout: boolean;
  iaF: string;
  hideDone: boolean;
  /** Saisie du consommé : profil filtré (index du profil, '' = tous). Non mémorisé : propre au projet ouvert. */
  profF: string;
  folded: Record<string, boolean>;
  hideCols: Record<string, boolean>;
  colForce: Record<string, boolean>;
  taskW: number;
  // Tableau de bord
  todo: string;
  /** Points de vigilance dépliés (repliés par défaut ; non mémorisé d'une visite à l'autre). */
  vigOuverte: boolean;
  dismissed: Record<string, boolean>;
  // cartes repliées
  coll: Record<string, boolean>;
  // Ateliers & livrables
  alType: string;
  alPrep: string;
  lvPrep: string;
  regHide: Record<string, Record<string, boolean>>;
  // Actions & décisions
  ad: 'actions' | 'decisions' | 'risques';
  adf: string;
  adfd: string;
  adp: string;
  adq: string;
  rkf: string;
  /** Registres : date cible (actions), instance, période (du / au), date (décisions), personnes (décisions, risques), type de risque. */
  adEch: string;
  adInst: string;
  adDu: string;
  adAu: string;
  adDPer: string;
  adpd: string;
  adpr: string;
  rkty: string;
  // Plan de charge : Prévu et réel, Prévisionnel, Par axe, Coûts (mémorisé)
  pc: string;
  // Absences : mois affiché (non mémorisé)
  absMois: string;
  // Planning
  /** Vue d'ensemble (par défaut) ou Gantt détaillé. Non mémorisé. */
  gVue: 'ens' | 'detail';
  /** Volet d'une ligne : filtre des tâches (tous, afaire, encours, valide). */
  plFiltre: string;
  /** Volet d'une ligne : recherche, valable pour la ligne plRechCle (repart vide sur une autre ligne). */
  plRech: string;
  plRechCle: string;
  // Gantt
  gZoom: 'mois' | 'semaine';
  gCompact: boolean;
  /** Référence comparée : « auto » (la plus récente), « aucune », ou l'identifiant d'une référence. Propre au projet : non mémorisée. */
  gRef: string;
  // Achats & frais
  aqSt: string;
  aqQ: string;
  frC: string;
  frCat: string;
  frQ: string;
  // Avancement détaillé (tableau de bord › « Détail › »)
  /** Groupes et sous-parties dépliés (non mémorisé). */
  avOuv: Record<string, boolean>;
  /** Filtre « Ateliers et livrables seulement » (non mémorisé). */
  avAL: boolean;
  /** Afficher les sous-parties, par regroupement (axe, lot, phase) : mémorisé. */
  avSous: Record<string, boolean>;
  // Affichage
  /** Tableaux plus serrés : plus de lignes à l'écran. */
  compact: boolean;
}

const DEFAUT: EtatUi = {
  wl: 'suivi',
  wlVue: 'essentiel',
  month: null,
  axe: '',
  q: '',
  typeF: '',
  onlyAjout: false,
  vigOuverte: false,
  iaF: '',
  hideDone: false,
  profF: '',
  folded: {},
  hideCols: {},
  colForce: {},
  taskW: 280,
  todo: '',
  dismissed: {},
  coll: {},
  alType: '',
  alPrep: '',
  lvPrep: '',
  regHide: {},
  ad: 'actions',
  adf: 'ouvertes',
  adfd: 'toutes',
  adp: '',
  adq: '',
  rkf: 'ouverts',
  adEch: '',
  adInst: '',
  adDu: '',
  adAu: '',
  adDPer: '',
  adpd: '',
  adpr: '',
  rkty: '',
  pc: 'pr',
  absMois: '',
  gVue: 'ens',
  plFiltre: 'tous',
  plRech: '',
  plRechCle: '',
  gZoom: 'mois',
  gCompact: false,
  gRef: 'auto',
  aqSt: '',
  aqQ: '',
  frC: '',
  frCat: '',
  frQ: '',
  avOuv: {},
  avAL: false,
  avSous: {},
  compact: false,
};

/** Clés mémorisées d'une session à l'autre (les recherches et filtres ponctuels ne le sont pas). */
const MEMORISEES: (keyof EtatUi)[] = [
  'wl',
  'wlVue',
  'axe',
  'typeF',
  'hideDone',
  'folded',
  'hideCols',
  'colForce',
  'taskW',
  'todo',
  'dismissed',
  'coll',
  'alType',
  'regHide',
  'ad',
  'adf',
  'rkf',
  'gZoom',
  'gCompact',
  'avSous',
  'pc',
  'compact',
];

const CLE = 'pilotageForfaits.suivi.ui.v1';

@Injectable()
export class UiEtat {
  readonly ui = signal<EtatUi>(UiEtat.lire());

  /** Modifie une ou plusieurs préférences. */
  maj(changement: Partial<EtatUi>): void {
    this.ui.update((u) => ({ ...u, ...changement }));
    this.ecrire();
  }

  /** « Effacer les filtres » des listes de tâches (Workload) : axe, recherche, type, évolutions, profil, filtre IA. */
  effacerFiltres(): void {
    this.maj({ axe: '', q: '', typeF: '', onlyAjout: false, profF: '', iaF: '' });
  }

  private static lire(): EtatUi {
    try {
      const brut = localStorage.getItem(CLE);
      const lu = brut ? (JSON.parse(brut) as Partial<EtatUi>) : {};
      const u: EtatUi = { ...DEFAUT };
      for (const k of MEMORISEES) {
        if (lu[k] !== undefined && typeof lu[k] === typeof DEFAUT[k]) (u as unknown as Record<string, unknown>)[k] = lu[k];
      }
      return u;
    } catch {
      return { ...DEFAUT };
    }
  }

  private ecrire(): void {
    try {
      const u = this.ui();
      const o: Record<string, unknown> = {};
      for (const k of MEMORISEES) o[k] = u[k];
      localStorage.setItem(CLE, JSON.stringify(o));
    } catch {
      /* stockage indisponible : préférences non mémorisées */
    }
  }
}
