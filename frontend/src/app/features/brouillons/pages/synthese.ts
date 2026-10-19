import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fx } from '../../suivi/ui/fx';
import { SyntheseTsp } from '../../suivi/ui/synthese-tsp';
import { BrouillonEtat } from '../etat/brouillon.etat';

/**
 * Synthèse du TSP en cours de rédaction : l'onglet SYNTHESE, recalculé à chaque enregistrement par le même moteur
 * que les projets lancés (même écran que Vendu (TSP) › Synthèse). Rien ne s'y saisit.
 */
@Component({
  selector: 'app-synthese-brouillon',
  imports: [RouterLink, Fx, SyntheseTsp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = etat.analyse();
    <div class="sechead">
      <div>
        <h2>Synthèse</h2>
        <p>
          L’onglet SYNTHESE du TSP, recalculé à chaque saisie à partir des profils, du workload, des frais et des achats. Ce sont les chiffres du projet une fois lancé.
          <app-fx cle="synthese" />
        </p>
      </div>
    </div>
    @if (a?.vente; as s) {
      @if (a!.bloquants > 0) {
        <div class="banner warn" role="status">
          <span
            ><b>Synthèse partielle.</b> {{ a!.bloquants }} point{{ a!.bloquants > 1 ? 's' : '' }} à corriger avant de lancer le projet : les chiffres peuvent encore
            changer.</span
          >
          <a class="btn sm" routerLink="../lancer">Voir les points</a>
        </div>
      }
      <app-synthese-tsp [synthese]="s" />
    } @else {
      <section class="card sy-vide">
        <h2>Pas encore de chiffres</h2>
        <p>La synthèse se calcule dès qu’il y a au moins un profil (avec son TJM et son CJM) et une tâche chiffrée dans le workload.</p>
        <div class="toolbar">
          <a class="btn" routerLink="../profils">Profils et prix</a>
          <a class="btn" routerLink="../workload">Workload</a>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .banner {
      margin-bottom: 14px;
    }
    .sy-vide p {
      color: var(--muted);
      margin: 6px 0 12px;
    }
  `,
})
export class SyntheseBrouillon {
  protected readonly etat = inject(BrouillonEtat);
}
