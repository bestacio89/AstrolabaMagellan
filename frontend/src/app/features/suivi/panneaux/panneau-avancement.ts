import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Statistiques } from '../api/modeles';
import { fD, fJ, fSigned, stSlug } from '../etat/formats';
import { SuiviEtat } from '../etat/suivi.etat';
import { axeName } from '../etat/vue';
import { Fx } from '../ui/fx';
import { Barre } from '../ui/petits';

/** Explication de chaque statut d'un périmètre (infobulle de l'étiquette). */
const AIDE_STATUT: Record<string, string> = {
  'À faire': 'Aucune tâche démarrée (ni statut, ni consommé).',
  'En cours': 'Au moins une tâche démarrée ou validée, mais pas toutes.',
  'En recette': 'Au moins une tâche en recette.',
  'Bloqué / En attente': 'Au moins une tâche bloquée : prioritaire sur les autres statuts.',
  Validé: 'Toutes les tâches du périmètre sont validées.',
};

/**
 * Détail de l'avancement (tableau de bord › « Détail ») : charges et planning par axe, lot ou phase, avec le total.
 * Uniquement des jours (JH), aucun montant : visible par tous les rôles.
 * Si le projet est suivi par phase, chaque ligne ouvre le panneau de la phase (avec un retour ici).
 */
@Component({
  selector: 'app-panneau-avancement',
  imports: [NgTemplateOutlet, Barre, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vue(); as v) {
      @let parPhase = v.m.dim.key === 'phase';
      <aside class="drawer large" aria-label="Détail de l’avancement" style="--axc: var(--accent)">
        <div class="dr-head">
          <div class="dr-nav">
            <span class="dr-kind">Tableau de bord</span><span class="spacer"></span
            ><button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
          </div>
          <h2 class="dr-title">Avancement par {{ v.dimLl }} — détail</h2>
          <div class="dr-meta">
            En jours-homme (JH).{{ parPhase ? ' Cliquez sur une phase pour voir ses tâches.' : '' }}
          </div>
        </div>
        <div class="dr-body">
          <section>
            <h3 class="av-titre">Charges et atterrissage <app-fx cle="atter" /></h3>
            <div class="tw">
              <table class="av-table">
                <thead>
                  <tr>
                    <th>{{ v.m.dim.label }}</th>
                    <th class="n">Prévu</th>
                    <th class="n">Consommé</th>
                    <th class="n">RAF</th>
                    <th class="n">Atterrissage</th>
                    <th class="n">Écart</th>
                    <th class="av-barre">Taux consommé</th>
                    <th>Projection</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of v.m.axes; track a.id + $index) {
                    <tr>
                      <td class="av-nom">
                        @if (parPhase && a.id) {
                          <button type="button" class="av-lien" (click)="ouvrirPhase(a.id)" [title]="'Ouvrir la phase ' + a.id">{{ nom(v, a.id) }}</button>
                        } @else {
                          {{ nom(v, a.id) }}
                        }
                      </td>
                      <ng-container *ngTemplateOutlet="charges; context: { $implicit: a }" />
                    </tr>
                  }
                  <tr class="total">
                    <td>Total</td>
                    <ng-container *ngTemplateOutlet="charges; context: { $implicit: v.m.total }" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 class="av-titre">Planning <app-fx cle="plan" /></h3>
            <div class="tw">
              <table class="av-table">
                <thead>
                  <tr>
                    <th>{{ v.m.dim.label }}</th>
                    <th>Prévu</th>
                    <th>Réel</th>
                    <th class="n">Tâches validées</th>
                    <th class="av-barre">Avancement</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of v.m.axes; track a.id + $index) {
                    <tr>
                      <td class="av-nom">
                        @if (parPhase && a.id) {
                          <button type="button" class="av-lien" (click)="ouvrirPhase(a.id)" [title]="'Ouvrir la phase ' + a.id">{{ nom(v, a.id) }}</button>
                        } @else {
                          {{ nom(v, a.id) }}
                        }
                      </td>
                      <ng-container *ngTemplateOutlet="planning; context: { $implicit: a }" />
                    </tr>
                  }
                  <tr class="total">
                    <td>Projet</td>
                    <ng-container *ngTemplateOutlet="planning; context: { $implicit: v.m.total }" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </aside>

      <ng-template #charges let-s>
        <td class="n">{{ fJ(s.prevu) }}</td>
        <td class="n">{{ fJ(s.conso) }}</td>
        <td class="n">{{ fJ(s.raf) }}</td>
        <td class="n">{{ fJ(s.atterrissage) }}</td>
        <td class="n" [class.av-plus]="s.ecart > 0.001" [class.av-moins]="s.ecart < -0.001">{{ fSigned(s.ecart) }}</td>
        <td class="av-barre"><app-barre [valeur]="s.prevu ? s.conso / s.prevu : 0" /></td>
        <td>
          @if (s.ecart > 0.001) {
            <span class="pill st-bloque" title="Atterrissage supérieur au prévu : dépassement anticipé ou constaté.">Dépassement</span>
          } @else if (s.ecart < -0.001) {
            <span class="pill st-valide" title="Atterrissage inférieur au prévu : gain (tâches finies sous le budget, enveloppe IA non consommée…).">Optimisation</span>
          } @else {
            <span class="pill tdb-conforme" title="Atterrissage = prévu.">Conforme</span>
          }
        </td>
      </ng-template>

      <ng-template #planning let-s>
        <td class="av-dates">{{ periode(s.prevuDebut, s.prevuFin) }}</td>
        <td class="av-dates">{{ periode(s.reelDebut, s.reelFin) }}</td>
        <td class="n">{{ s.valides }} / {{ s.actives }}</td>
        <td class="av-barre"><app-barre classe="ok" [valeur]="s.avancement" /></td>
        <td><span class="pill" [class]="'pill st-' + stSlug(s.statut)" [title]="aideStatut(s.statut)">{{ s.statut }}</span></td>
      </ng-template>
    }
  `,
  styles: `
    .av-titre {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .av-table td,
    .av-table th {
      white-space: nowrap;
    }
    .av-nom {
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .av-lien {
      border: 0;
      padding: 0;
      background: none;
      font: inherit;
      color: var(--accent);
      cursor: pointer;
      text-align: left;
    }
    .av-lien:hover,
    .av-lien:focus-visible {
      text-decoration: underline;
    }
    .av-barre {
      width: 130px;
      min-width: 130px;
    }
    .av-dates {
      font-variant-numeric: tabular-nums;
    }
    .av-plus {
      color: var(--crit);
    }
    .av-moins {
      color: var(--ok);
    }
  `,
})
export class PanneauAvancement {
  protected readonly etat = inject(SuiviEtat);
  protected readonly vue = this.etat.vue;
  protected readonly fJ = fJ;
  protected readonly fSigned = fSigned;
  protected readonly stSlug = stSlug;
  protected readonly nom = axeName;

  protected periode(debut: string | null, fin: string | null): string {
    return debut || fin ? `${fD(debut)} → ${fD(fin)}` : '—';
  }

  protected aideStatut(statut: Statistiques['statut']): string {
    return AIDE_STATUT[statut] ?? '';
  }

  protected ouvrirPhase(phase: string): void {
    this.etat.ouvrirPhase(phase, true);
  }
}
