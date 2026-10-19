import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy } from '@angular/core';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';

/**
 * Barre de filtres commune (Workload, Gantt, registres…) : groupe (axe, lot ou phase selon le regroupement),
 * recherche, et « Évolutions du périmètre » quand il y en a. Contenu projeté à la suite (filtres propres à l'écran, boutons).
 */
@Component({
  selector: 'app-barre-filtres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      <div class="toolbar barre-f">
        <label class="field"
          >{{ v.dimL }}
          <select class="in" #g (change)="ui.maj({ axe: g.value })">
            <option value="" [selected]="!ui.ui().axe">Tous</option>
            @for (a of v.m.axes; track a.id) {
              <option [value]="a.id || '__none'" [selected]="(a.id || '__none') === ui.ui().axe">{{ a.nom }}</option>
            }
          </select>
        </label>
        <label class="field">Rechercher<input class="in" type="search" placeholder="Tâche ou lot" [value]="ui.ui().q" #q (input)="rechercher(q.value)" /></label>
        @if (nbEvolutions()) {
          <div class="field">
            &nbsp;<button
              type="button"
              class="btn sm"
              [attr.aria-pressed]="ui.ui().onlyAjout"
              title="N’afficher que les tâches créées, complétées ou annulées en cours de projet"
              (click)="ui.maj({ onlyAjout: !ui.ui().onlyAjout })"
            >
              Évolutions du périmètre ({{ nbEvolutions() }})
            </button>
          </div>
        }
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class BarreFiltres implements OnDestroy {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  protected readonly nbEvolutions = computed(() => this.etat.vue()?.m.perimetre.lignes.length ?? 0);
  private minuterie: ReturnType<typeof setTimeout> | undefined;

  /** Recherche appliquée après une courte pause de frappe. */
  protected rechercher(valeur: string): void {
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.ui.maj({ q: valeur }), 250);
  }

  ngOnDestroy(): void {
    clearTimeout(this.minuterie);
  }
}
