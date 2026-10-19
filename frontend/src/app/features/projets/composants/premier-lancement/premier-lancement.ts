import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Icone } from '../../../../shared/ui/icone';

/**
 * Écran affiché quand aucun projet n'est encore ouvert à l'utilisateur :
 * deux façons de démarrer (importer un TSP ; ou le rédiger dans l'application). Dans les deux cas, un brouillon est créé.
 */
@Component({
  selector: 'app-premier-lancement',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './premier-lancement.html',
  styleUrl: './premier-lancement.scss',
})
export class PremierLancement {
  readonly prenom = input('');
  /** Faux pour un utilisateur sans droit de création (ex. consultant) : seul le message d'attente est affiché. */
  readonly peutCreer = input(true);

  readonly fichierChoisi = output<File>();
  readonly choisirFichier = output<void>();
  /** Rédiger le TSP dans l'application (ouvre la fenêtre « Nouveau projet »). */
  readonly rediger = output<void>();

  protected readonly survol = signal(false);

  protected deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    const fichier = evenement.dataTransfer?.files?.[0];
    if (fichier) this.fichierChoisi.emit(fichier);
  }

  protected survoler(evenement: DragEvent, actif: boolean): void {
    evenement.preventDefault();
    this.survol.set(actif);
  }
}
