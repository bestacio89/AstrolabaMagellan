import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProjetResume } from '../../../../api/modeles';
import { couleurProjet, lectureAtterrissage } from '../../../../shared/format/formats';
import { DateFrPipe, EcartPipe, JhPipe, PourcentPipe } from '../../../../shared/format/pipes';
import { Icone } from '../../../../shared/ui/icone';
import { Filtre, FILTRES, Tri, TRIS } from '../../etat/accueil.logique';

/** Tableau des projets ouverts à l'utilisateur, avec filtre par statut, recherche et tri. */
@Component({
  selector: 'app-liste-projets',
  imports: [RouterLink, Icone, JhPipe, EcartPipe, PourcentPipe, DateFrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // le menu est en position fixe (le tableau défile horizontalement et le couperait) : il se ferme au défilement
  host: {
    '(document:click)': 'menuOuvert.set(null)',
    '(document:keydown.escape)': 'menuOuvert.set(null)',
    '(window:scroll)': 'menuOuvert.set(null)',
    '(window:resize)': 'menuOuvert.set(null)',
  },
  templateUrl: './liste-projets.html',
  styleUrl: './liste-projets.scss',
})
export class ListeProjets {
  readonly projets = input.required<ProjetResume[]>();
  readonly compteurs = input.required<Record<Filtre, number>>();
  readonly filtre = input.required<Filtre>();
  readonly recherche = input.required<string>();
  readonly tri = input.required<Tri>();

  readonly filtreChange = output<Filtre>();
  readonly rechercheChange = output<string>();
  readonly triChange = output<Tri>();
  /** Le chef de projet demande l'archivage d'un projet (confirmé par la page). */
  readonly archiver = output<ProjetResume>();

  /** Projet dont le menu ⋯ est ouvert (un seul à la fois). */
  protected readonly menuOuvert = signal<string | null>(null);

  /** Position du menu ouvert, sous son bouton, aligné à droite. */
  protected readonly positionMenu = signal({ haut: 0, droite: 0 });

  protected basculerMenu(id: string, evenement: Event): void {
    evenement.stopPropagation();
    if (this.menuOuvert() === id) {
      this.menuOuvert.set(null);
      return;
    }
    const r = (evenement.currentTarget as HTMLElement).getBoundingClientRect();
    // près du bas de l'écran, le menu s'ouvre au-dessus du bouton
    const haut = r.bottom + 4 + 140 > window.innerHeight ? Math.max(8, r.top - 4 - 140) : r.bottom + 4;
    this.positionMenu.set({ haut, droite: window.innerWidth - r.right });
    this.menuOuvert.set(id);
  }

  protected readonly filtres = FILTRES;
  protected readonly tris = TRIS;
  protected readonly lecture = lectureAtterrissage;
  protected readonly couleur = couleurProjet;

  protected saisirRecherche(evenement: Event): void {
    this.rechercheChange.emit((evenement.target as HTMLInputElement).value);
  }

  protected choisirTri(evenement: Event): void {
    this.triChange.emit((evenement.target as HTMLSelectElement).value as Tri);
  }

  /** Part consommée de la charge prévue, en pourcentage pour la barre (0 à 100). */
  protected largeurBarre(projet: ProjetResume): number {
    return Math.max(0, Math.min(100, Math.round(projet.avancement * 100)));
  }
}
