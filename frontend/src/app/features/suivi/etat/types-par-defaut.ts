import { firstValueFrom } from 'rxjs';
import { SuiviApi } from '../api/suivi.api';

/**
 * Types de tâches proposés à chaque nouvel import de TSP, mémorisés sur ce poste (comme la version de référence).
 * Seuls les types ajoutés sont retenus (Atelier et Livrable existent toujours).
 */
const CLE = 'pilotageForfaits.typesParDefaut.v1';

export function lireTypesParDefaut(): string[] {
  try {
    const brut = localStorage.getItem(CLE);
    const l = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function ecrireTypesParDefaut(noms: string[]): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(noms));
    return true;
  } catch {
    return false;
  }
}

/** Ajoute au projet importé les types par défaut de ce poste (un échec n'empêche pas l'import). */
export async function appliquerTypesParDefaut(api: SuiviApi, projetId: string): Promise<void> {
  for (const nom of lireTypesParDefaut()) {
    try {
      await firstValueFrom(api.ajouterType(projetId, nom));
    } catch {
      /* type déjà présent ou refusé : on continue */
    }
  }
}
