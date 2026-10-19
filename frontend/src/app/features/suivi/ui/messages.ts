import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { Confirmation, SuiviEtat } from '../etat/suivi.etat';

/** Messages courts en bas à gauche, avec leur action éventuelle (« Annuler », « La valider »…). */
@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="s-toasts" role="status" aria-live="polite">
      @for (t of etat.toasts(); track t.id) {
        <div class="toast s-toast" [class.t-err]="t.ton === 'erreur'" [class.t-warn]="t.ton === 'attention'">
          <span>{{ t.texte }}</span>
          @if (t.action; as a) {
            <button type="button" class="toast-act" (click)="executer(t.id, a.executer)">{{ a.libelle }}</button>
          }
          <button type="button" class="toast-x" aria-label="Fermer le message" (click)="etat.retirerToast(t.id)">✕</button>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly etat = inject(SuiviEtat);

  protected executer(id: number, action: () => void): void {
    this.etat.retirerToast(id);
    action();
  }
}

/** Fenêtre de confirmation (« Supprimer ? », « Rétablir ? »…). */
@Component({
  selector: 'app-confirmation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogue class="s-dialog" aria-labelledby="conf-titre" (cancel)="repondre($event, null)">
      <div class="modal" role="document">
        <h2 id="conf-titre">{{ c().titre }}</h2>
        <div class="m-body">
          @for (p of c().paragraphes; track $index) {
            <p>{{ p }}</p>
          }
          @if (c().liste; as l) {
            <ul class="note">
              @for (x of l; track $index) {
                <li>{{ x }}</li>
              }
            </ul>
          }
          @if (c().note) {
            <p class="note">{{ c().note }}</p>
          }
        </div>
        <div class="actions">
          @for (b of c().boutons; track b.libelle) {
            <button type="button" class="btn" [class.primary]="b.principal" (click)="repondre(null, b.valeur)">{{ b.libelle }}</button>
          }
        </div>
      </div>
    </dialog>
  `,
})
export class ConfirmationFenetre {
  readonly c = input.required<Confirmation>();
  private readonly dialogue = viewChild.required<ElementRef<HTMLDialogElement>>('dialogue');

  constructor() {
    afterNextRender(() => {
      const d = this.dialogue().nativeElement;
      if (!d.open) d.showModal();
      d.querySelector<HTMLElement>('.btn.primary')?.focus();
    });
  }

  protected repondre(e: Event | null, valeur: string | null): void {
    e?.preventDefault();
    this.c().repondre(valeur);
  }
}
