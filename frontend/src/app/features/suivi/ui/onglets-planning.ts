import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PANNEAU_PLANNING, SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';

/** Sous-onglets du planning, comme dans Workload : Vue d'ensemble (par défaut) et Gantt détaillé. */
@Component({
  selector: 'app-onglets-planning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="group" aria-label="Vue du planning">
      <button type="button" [attr.aria-pressed]="ui.ui().gVue !== 'detail'" (click)="choisir('ens')">Vue d’ensemble</button>
      <button type="button" [attr.aria-pressed]="ui.ui().gVue === 'detail'" (click)="choisir('detail')">Gantt détaillé</button>
    </div>
  `,
})
export class OngletsPlanning {
  protected readonly ui = inject(UiEtat);
  private readonly etat = inject(SuiviEtat);

  protected choisir(v: 'ens' | 'detail'): void {
    this.ui.maj({ gVue: v });
    if (this.etat.panneau()?.startsWith(PANNEAU_PLANNING)) this.etat.fermerPanneau();
  }
}
