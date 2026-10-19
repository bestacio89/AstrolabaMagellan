import { Injectable, signal } from '@angular/core';

/** Préférences d'affichage de l'application, propres à ce navigateur (elles ne changent rien pour les collègues). */
export interface Preferences {
  /** Lien « Mon travail » dans la barre latérale. */
  monTravail: boolean;
  /** Lien « Portefeuille » dans la barre latérale. */
  portefeuille: boolean;
  /** Barre latérale réduite (grand écran) pour laisser toute la largeur aux tableaux ; elle le reste sur toutes les pages. */
  barreRepliee: boolean;
  /** Groupe « Vendu (TSP) » ouvert dans la barre latérale (replié par défaut). */
  tspOuvert: boolean;
}

const DEFAUT: Preferences = { monTravail: true, portefeuille: true, barreRepliee: false, tspOuvert: false };
const CLE = 'pilotageForfaits.preferences.v1';

/**
 * Paramètres de l'application (barre latérale › Paramètres) : quels menus afficher.
 * Enregistrés dans le navigateur, comme les préférences d'affichage du suivi : un écran masqué reste accessible par son adresse.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly preferences = signal<Preferences>(PreferencesService.lire());

  changer(changement: Partial<Preferences>): void {
    this.preferences.update((p) => ({ ...p, ...changement }));
    try {
      localStorage.setItem(CLE, JSON.stringify(this.preferences()));
    } catch {
      /* stockage indisponible : le réglage vaut jusqu'à la fermeture de la page */
    }
  }

  private static lire(): Preferences {
    try {
      const lu = JSON.parse(localStorage.getItem(CLE) ?? '{}') as Partial<Preferences>;
      return {
        monTravail: typeof lu.monTravail === 'boolean' ? lu.monTravail : DEFAUT.monTravail,
        portefeuille: typeof lu.portefeuille === 'boolean' ? lu.portefeuille : DEFAUT.portefeuille,
        barreRepliee: typeof lu.barreRepliee === 'boolean' ? lu.barreRepliee : DEFAUT.barreRepliee,
        tspOuvert: typeof lu.tspOuvert === 'boolean' ? lu.tspOuvert : DEFAUT.tspOuvert,
      };
    } catch {
      return { ...DEFAUT };
    }
  }
}
