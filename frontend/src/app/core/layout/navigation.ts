import { Injectable, signal } from '@angular/core';
import { ProjetResume } from '../../api/modeles';
import { NomIcone } from '../../shared/ui/icone';

/** Une rubrique du projet ouvert, dans la barre latérale. */
export interface LienProjet {
  libelle: string;
  /** Chemin relatif à /projets/:id (ex. « workload »). */
  chemin: string;
  icone: NomIcone;
  actif: boolean;
  /** Nombre de points à traiter dans cette rubrique (rien si 0). */
  badge: number;
  /** Au moins un de ces points est en retard : badge rouge. */
  retard: boolean;
  /** Rubrique d'un brouillon : son état (pastille à la place de l'icône) et une courte note à droite (« 140 JH », « facultatif »). */
  etat?: 'ok' | 'conseil' | 'bloquant' | 'vide';
  note?: string;
  /** Petit titre affiché juste avant ce lien, à l'intérieur du groupe (ex. « Annexes »). */
  intertitre?: string;
}

export interface GroupeProjet {
  libelle: string;
  /** Groupe consulté rarement (le TSP vendu) : replié par défaut, ouvert d'office quand on est sur une de ses pages. */
  repliable?: boolean;
  liens: LienProjet[];
}

/** Le projet ouvert (ou le brouillon en cours de rédaction), tel que son écran le décrit à la barre latérale. */
export interface ProjetNavigation {
  id: string;
  nom: string;
  groupes: GroupeProjet[];
  /** Ouvre les repères propres au suivi (vocabulaire et règles de calcul) ; sinon, les repères essentiels. */
  ouvrirReperes?: () => void;
  /** Titre du bloc (« Projet ouvert » par défaut, « Brouillon ouvert »). */
  etiquette?: string;
  /** Début des liens des rubriques (par défaut ['/projets', id]). */
  base?: string[];
}

/**
 * Lien entre les écrans et la barre latérale (toujours affichée) :
 * - la liste des projets, mise à jour par la page d'accueil quand elle les charge ;
 * - le projet ouvert et ses rubriques, publiés par l'écran de suivi tant qu'il est affiché.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  /** null : pas encore chargée (la barre latérale la charge alors elle-même). */
  readonly projets = signal<ProjetResume[] | null>(null);
  readonly projetOuvert = signal<ProjetNavigation | null>(null);
  /** Nombre d'éléments à traiter dans « Mon travail » (0 : pas de pastille), publié par cet écran une fois chargé. */
  readonly aMonTravail = signal(0);
  /** Au moins un de ces éléments est en retard : pastille rouge. */
  readonly aMonTravailRetard = signal(false);
}
