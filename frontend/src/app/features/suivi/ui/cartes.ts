import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { formuleDuTitre } from '../etat/constantes';
import { UiEtat } from '../etat/ui.etat';
import { Fx } from './fx';

/**
 * Carte : titre, sous-titre (texte ou contenu projeté [sous-titre]), contenu.
 * Les titres connus reçoivent automatiquement leur bouton ƒx (comment c'est calculé).
 * Contenu projeté à droite du titre : [extra].
 */
@Component({
  selector: 'app-carte',
  imports: [Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card' },
  template: `
    <header>
      <div>
        <h2>{{ titre() }}</h2>
        <p>
          {{ sousTitre() }}<ng-content select="[sous-titre]" />
          @if (fx(); as f) {
            <app-fx [cle]="f" />
          }
        </p>
      </div>
      <ng-content select="[extra]" />
    </header>
    <ng-content />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Carte {
  readonly titre = input.required<string>();
  readonly sousTitre = input('');
  protected readonly fx = computed(() => formuleDuTitre(this.titre()));
}

/** Cartes repliées tant que l'utilisateur ne les a pas ouvertes. */
const REPLIEES_PAR_DEFAUT = new Set(['aq-presta', 'grille', 'ven-vides']);

/**
 * Carte repliable : le titre est un bouton (chevron). Repliée, elle garde son titre et un résumé chiffré ([resume]).
 * L'état est mémorisé sur ce poste.
 */
@Component({
  selector: 'app-carte-repliable',
  imports: [Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card ccard', '[class.is-coll]': 'repliee()' },
  template: `
    <header>
      <div class="cc-head">
        <h2>
          <button
            type="button"
            class="cc-tog"
            [attr.aria-expanded]="!repliee()"
            [attr.aria-controls]="'cc-' + cle()"
            [title]="(repliee() ? 'Déplier' : 'Replier') + ' ce tableau'"
            (click)="basculer()"
          >
            <svg class="cc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
            {{ titre() }}
          </button>
        </h2>
        <span class="cc-sum"><ng-content select="[resume]" /></span>
      </div>
      <p class="cc-sub">
        {{ sousTitre() }}
        @if (fx(); as f) {
          <app-fx [cle]="f" />
        }
      </p>
      <div class="cc-extra"><ng-content select="[extra]" /></div>
    </header>
    <div class="cc-body" [id]="'cc-' + cle()"><ng-content /></div>
  `,
  styles: `
    :host {
      display: block;
    }
    .cc-sum:empty,
    .cc-extra:empty {
      display: none;
    }
  `,
})
export class CarteRepliable {
  readonly cle = input.required<string>();
  readonly titre = input.required<string>();
  readonly sousTitre = input('');
  private readonly ui = inject(UiEtat);
  protected readonly fx = computed(() => formuleDuTitre(this.titre()));
  readonly repliee = computed(() => estRepliee(this.ui.ui().coll, this.cle()));

  protected basculer(): void {
    this.ui.maj({ coll: { ...this.ui.ui().coll, [this.cle()]: !this.repliee() } });
  }
}

export function estRepliee(coll: Record<string, boolean>, cle: string): boolean {
  return cle in coll ? !!coll[cle] : REPLIEES_PAR_DEFAUT.has(cle);
}

/** Bouton « Tout replier / Tout déplier » pour une série de cartes repliables. */
@Component({
  selector: 'app-tout-replier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <button type="button" class="btn sm" (click)="basculer()">{{ toutesRepliees() ? 'Tout déplier' : 'Tout replier' }}</button>
    </div>
  `,
})
export class ToutReplier {
  readonly cles = input.required<string[]>();
  private readonly ui = inject(UiEtat);
  protected readonly toutesRepliees = computed(() => this.cles().every((c) => estRepliee(this.ui.ui().coll, c)));

  protected basculer(): void {
    const valeur = !this.toutesRepliees();
    const coll = { ...this.ui.ui().coll };
    for (const c of this.cles()) coll[c] = valeur;
    this.ui.maj({ coll });
  }
}
