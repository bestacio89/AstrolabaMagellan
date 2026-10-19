import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';

let compteur = 0;

/**
 * Fenêtre (formulaire) de l'écran de suivi, sur le modèle de la version de référence :
 * en-tête avec titre et croix, corps, pied avec message d'erreur et boutons.
 * Basée sur l'élément natif <dialog> : le navigateur garde le focus dans la fenêtre et gère la touche Échap.
 * La fenêtre est ouverte dès son affichage ; le parent la retire pour la fermer.
 */
@Component({
  selector: 'app-modale',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogue class="s-dialog" [attr.aria-labelledby]="idTitre" (cancel)="annuler($event)">
      <form class="modal form" [class.wide]="large()" [class]="classe()" novalidate (submit)="soumettre($event)">
        <div class="m-head">
          <h2 [id]="idTitre">{{ titre() }}</h2>
          <button type="button" class="btn sm ghost" aria-label="Fermer" (click)="fermer.emit()">✕</button>
        </div>
        <div class="m-body"><ng-content /></div>
        <div class="m-foot">
          @if (erreur()) {
            <div class="m-err" role="alert">{{ erreur() }}</div>
          }
          <div class="actions">
            @if (libelleAnnuler()) {
              <button class="btn" type="button" (click)="fermer.emit()">{{ libelleAnnuler() }}</button>
            }
            @if (libelleValider()) {
              <button class="btn primary" type="submit" [disabled]="occupe()">{{ libelleValider() }}</button>
            }
          </div>
        </div>
      </form>
    </dialog>
  `,
})
export class Modale {
  readonly titre = input.required<string>();
  readonly libelleValider = input('Valider');
  readonly libelleAnnuler = input('Annuler');
  readonly large = input(false);
  readonly classe = input('');
  readonly erreur = input<string | null>(null);
  readonly occupe = input(false);
  readonly fermer = output<void>();
  readonly valider = output<void>();

  protected readonly idTitre = `modale-titre-${++compteur}`;
  private readonly dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');

  constructor() {
    afterNextRender(() => {
      const d = this.dialogue().nativeElement;
      if (!d.open) d.showModal();
      // premier champ de saisie, sinon premier bouton
      const champ = d.querySelector<HTMLElement>('.m-body input:not([type=hidden]):not([disabled]), .m-body select, .m-body textarea');
      (champ ?? d.querySelector<HTMLElement>('.actions .btn.primary'))?.focus();
    });
  }

  protected annuler(e: Event): void {
    e.preventDefault();
    this.fermer.emit();
  }

  protected soumettre(e: Event): void {
    e.preventDefault();
    this.valider.emit();
  }

  /** Met en évidence le champ en erreur (attribut name) et lui donne le focus. */
  signalerChamp(nom: string | null): void {
    const d = this.dialogue().nativeElement;
    d.querySelectorAll('.is-bad').forEach((x) => x.classList.remove('is-bad'));
    if (!nom) return;
    const champ = d.querySelector<HTMLElement>(`[name="${CSS.escape(nom)}"]`);
    if (champ) {
      champ.classList.add('is-bad');
      champ.focus();
    }
    d.querySelector('.m-err')?.scrollIntoView({ block: 'nearest' });
  }
}
