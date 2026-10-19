import { ChangeDetectionStrategy, Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { CleFormule, FORMULES } from '../etat/constantes';

/** Bulle ouverte (une seule à la fois dans tout l'écran). */
const ouverte = signal<object | null>(null);

/**
 * Bouton « ƒx Calcul » : affiche comment un indicateur est calculé (formules de la version de référence).
 * La bulle se ferme par la croix, la touche Échap ou un clic ailleurs.
 */
@Component({
  selector: 'app-fx',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'clicAilleurs()',
    '(document:keydown.escape)': 'echap()',
    '(window:scroll)': 'defilement()',
  },
  template: `
    <button
      #bouton
      type="button"
      class="fx-btn"
      aria-haspopup="dialog"
      [attr.aria-expanded]="estOuverte()"
      title="Comment c’est calculé"
      (click)="basculer($event)"
    >
      ƒx<span>Calcul</span>
    </button>
    @if (estOuverte()) {
      <div
        class="fx-pop"
        role="dialog"
        [attr.aria-label]="'Calcul : ' + formule()[0]"
        [style.position]="'fixed'"
        [style.left.px]="position().left"
        [style.top.px]="position().top"
        [style.width.px]="position().largeur"
        (click)="$event.stopPropagation()"
      >
        <div class="fx-h">
          <b>ƒx {{ formule()[0] }}</b><button type="button" class="fx-x" aria-label="Fermer" (click)="fermer()">✕</button>
        </div>
        <dl>
          @for (l of formule()[1]; track l[0]) {
            <dt>{{ l[0] }}</dt>
            <dd>
              <code>{{ l[1] }}</code>
              @if (l[2]) {
                <small>{{ l[2] }}</small>
              }
            </dd>
          }
        </dl>
      </div>
    }
  `,
  styles: `
    :host {
      display: inline;
    }
  `,
})
export class Fx {
  readonly cle = input.required<CleFormule>();
  protected readonly formule = computed(() => FORMULES[this.cle()]);
  protected readonly estOuverte = computed(() => ouverte() === this);
  protected readonly position = signal({ left: 0, top: 0, largeur: 520 });
  private readonly bouton = viewChild.required<ElementRef<HTMLButtonElement>>('bouton');

  protected basculer(e: Event): void {
    e.stopPropagation();
    if (this.estOuverte()) {
      this.fermer();
      return;
    }
    const r = this.bouton().nativeElement.getBoundingClientRect();
    const largeur = Math.min(520, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left, window.innerWidth - largeur - 12));
    // sous le bouton s'il y a la place, sinon au-dessus (hauteur estimée)
    const hauteur = 60 + this.formule()[1].length * 44;
    const top = r.bottom + 8 + hauteur < window.innerHeight ? r.bottom + 8 : Math.max(8, r.top - hauteur - 8);
    this.position.set({ left, top, largeur });
    ouverte.set(this);
  }

  protected fermer(): void {
    if (this.estOuverte()) ouverte.set(null);
    this.bouton().nativeElement.focus();
  }

  protected clicAilleurs(): void {
    if (this.estOuverte()) ouverte.set(null);
  }

  protected echap(): void {
    if (this.estOuverte()) this.fermer();
  }

  protected defilement(): void {
    if (this.estOuverte()) ouverte.set(null);
  }
}
