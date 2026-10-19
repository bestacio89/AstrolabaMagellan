import { Injectable, signal } from '@angular/core';

/**
 * Préférences d'affichage de l'écran de suivi (filtres, colonnes masquées, cartes repliées…).
 * Elles ne concernent que l'affichage : mémorisées sur ce poste (navigateur), jamais envoyées au serveur.
 * Si le navigateur refuse le stockage (navigation privée…), l'écran fonctionne quand même.
 */
export interface EtatUi {
  // Workload
  wl: 'suivi' | 'conso' | 'ia';
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
  // Affichage
  /** Tableaux plus serrés : plus de lignes à l'écran. */
  compact: boolean;
}

const DEFAUT: EtatUi = {
  wl: 'suivi',
  month: null,
  axe: '',
  q: '',
  typeF: '',
  onlyAjout: false,
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
  gZoom: 'mois',
  gCompact: false,
  gRef: 'auto',
  aqSt: '',
  aqQ: '',
  frC: '',
  frCat: '',
  frQ: '',
  compact: false,
};

/** Clés mémorisées d'une session à l'autre (les recherches et filtres ponctuels ne le sont pas). */
const MEMORISEES: (keyof EtatUi)[] = [
  'wl',
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
