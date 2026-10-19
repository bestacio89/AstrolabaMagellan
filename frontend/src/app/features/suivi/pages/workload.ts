import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiEtat } from '../etat/ui.etat';
import { WorkloadConso } from './workload-conso';
import { WorkloadIa } from './workload-ia';
import { WorkloadListe } from './workload-liste';

const VUES: { cle: 'suivi' | 'conso' | 'ia'; libelle: string; intro: string }[] = [
  {
    cle: 'suivi',
    libelle: 'Liste des tâches',
    intro:
      'Tâches du TSP vendu et ajouts en cours de projet. Statut et avancement se changent dans le tableau ; cliquez sur une tâche pour son détail (dates prévues, reste à faire, profils, commentaire).',
  },
  {
    cle: 'conso',
    libelle: 'Saisie du consommé',
    intro:
      'Jours travaillés, par personne et par jour : 1 JH maximum par personne et par jour, toutes tâches confondues (sauf profils des entités ACHAT et CESSION, qui peuvent mobiliser plusieurs personnes).',
  },
  {
    cle: 'ia',
    libelle: 'Optimisation IA',
    intro:
      'Enveloppe Agent IA de chaque tâche : une réserve qu’on cherche à ne pas consommer. Résultat constaté à la validation, avec son levier (ou sa cause) et un commentaire pour la direction de projet.',
  },
];

/** Workload : liste des tâches, saisie du consommé, optimisation IA. */
@Component({
  selector: 'app-workload',
  imports: [WorkloadListe, WorkloadConso, WorkloadIa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let cle = ui.ui().wl;
    <div class="sechead">
      <div>
        <h2>Workload</h2>
        <p>{{ intro(cle) }}</p>
      </div>
      <div class="seg" role="group" aria-label="Vue">
        @for (x of vues; track x.cle) {
          <button type="button" [attr.aria-pressed]="cle === x.cle" (click)="ui.maj({ wl: x.cle })">{{ x.libelle }}</button>
        }
      </div>
    </div>
    @switch (cle) {
      @case ('conso') {
        <app-workload-conso />
      }
      @case ('ia') {
        <app-workload-ia />
      }
      @default {
        <app-workload-liste />
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Workload {
  protected readonly ui = inject(UiEtat);
  protected readonly vues = VUES;

  protected intro(cle: string): string {
    return VUES.find((v) => v.cle === cle)?.intro ?? VUES[0].intro;
  }
}
