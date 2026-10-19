import { afterRenderEffect, ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { Icone } from './icone';

let compteur = 0;

/**
 * Fenêtre modale accessible, basée sur l'élément natif <dialog> (le navigateur gère le focus et la touche Échap).
 * Exemple :
 *   <app-fenetre titre="Créer un projet vide" [ouverte]="ouverte()" (fermee)="ouverte.set(false)">
 *     … contenu …
 *     <div pied> … boutons … </div>
 *   </app-fenetre>
 */
@Component({
  selector: 'app-fenetre',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogue [class.large]="large()" [attr.aria-labelledby]="idTitre" (cancel)="annuler($event)" (close)="surFermeture()">
      <div class="en-tete">
        <h2 [id]="idTitre">{{ titre() }}</h2>
        <button type="button" class="fermer" aria-label="Fermer" title="Fermer (Échap)" (click)="fermee.emit()">
          <app-icone nom="fermer" [taille]="20" />
        </button>
      </div>
      <div class="corps"><ng-content /></div>
      <div class="pied"><ng-content select="[pied]" /></div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(600px, calc(100vw - 32px));
      max-height: calc(100vh - 48px);
      padding: 0;
      border: 0;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(19, 32, 51, 0.25);
      color: var(--c-texte);
      font-family: var(--police-texte);
      overflow: auto;
    }
    dialog.large {
      width: min(780px, calc(100vw - 32px));
    }
    dialog::backdrop {
      background: rgba(19, 32, 51, 0.45);
    }
    .en-tete {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 22px 24px 16px;
      border-bottom: 1px solid var(--c-separateur);
    }
    h2 {
      font: 500 20px/28px var(--police-titre);
    }
    /* bouton de fermeture autonome (sans la classe .btn) : même rendu partout, y compris dans les écrans de suivi */
    .fermer {
      flex: none;
      width: 36px;
      height: 36px;
      margin: -4px -8px -4px 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--c-texte-doux);
      cursor: pointer;
      transition: background var(--transition), color var(--transition);
    }
    .fermer:hover {
      background: var(--c-survol);
      color: var(--c-texte);
    }
    .fermer:focus-visible {
      outline: 2px solid var(--c-primaire);
      outline-offset: 2px;
    }
    .corps {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .pied:not(:empty) {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px 22px;
      border-top: 1px solid var(--c-separateur);
    }
  `,
})
export class Fenetre {
  readonly titre = input.required<string>();
  readonly ouverte = input(false);
  /** Fenêtre plus large (contenu en colonnes). */
  readonly large = input(false);
  /** Demande de fermeture (croix, Échap, bouton Annuler) : le parent décide de fermer. */
  readonly fermee = output<void>();

  protected readonly idTitre = `fenetre-titre-${++compteur}`;
  private readonly dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');

  constructor() {
    // ouvre ou ferme le <dialog> quand l'entrée « ouverte » change (après l'affichage, quand l'élément existe)
    afterRenderEffect(() => {
      const element = this.dialogue().nativeElement;
      if (this.ouverte() && !element.open) element.showModal();
      if (!this.ouverte() && element.open) element.close();
    });
  }

  protected annuler(evenement: Event): void {
    evenement.preventDefault(); // Échap : on laisse le parent fermer
    this.fermee.emit();
  }

  protected surFermeture(): void {
    if (this.ouverte()) this.fermee.emit();
  }
}
