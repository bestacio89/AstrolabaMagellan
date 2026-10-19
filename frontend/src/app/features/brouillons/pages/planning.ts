import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatEcart, formatJh } from '../../../shared/format/formats';
import { BrouillonEtat } from '../etat/brouillon.etat';
import {
  arrondi,
  chargePlanifiee,
  chargeProfil,
  dansLaPeriode,
  ecartPlanning,
  libelleMois,
  lireNombre,
  moisDuPlanning,
  repartirSurLaPeriode,
  texteNombre,
} from '../etat/brouillon.logique';
import { ControlesRubrique, EtatRubrique, ResumeDirect } from './communs';

/**
 * Rubrique « Planning mensuel » : l'onglet PLANNING du TSP (jours de chaque profil, mois par mois).
 * Il alimente la courbe « prévu » du plan de charge et le Gantt de référence. L'écart avec le workload est signalé.
 */
@Component({
  selector: 'app-planning-brouillon',
  imports: [RouterLink, EtatRubrique, ControlesRubrique, ResumeDirect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.contenu(); as tsp) {
      <section class="card">
        <header>
          <div>
            <h2>Planning mensuel</h2>
            <p>Les jours de chaque profil, mois par mois. Chaque ligne doit retomber sur la charge du workload (colonne « Écart »).</p>
          </div>
          <app-etat-rubrique rubrique="planning" />
        </header>

        @if (!mois().length) {
          <div class="banner info">
            <span>Renseignez d’abord la période du projet : les mois du planning en découlent.</span>
            <a class="btn" [routerLink]="['/brouillons', etat.brouillon()?.id, 'fiche']">Compléter la fiche</a>
          </div>
        } @else if (!tsp.profils.length) {
          <div class="banner info">
            <span>Ajoutez d’abord les profils et leurs jours au workload.</span>
            <a class="btn" [routerLink]="['/brouillons', etat.brouillon()?.id, 'profils']">Ajouter les profils</a>
          </div>
        } @else {
          <div class="pl-resume"><app-resume-direct /></div>
          <div class="tw">
            <table class="plangrid pl">
              <thead>
                <tr>
                  <th scope="col">Profil</th>
                  <th scope="col" class="n">Workload</th>
                  <th scope="col" class="n">Écart</th>
                  @for (m of mois(); track m) {
                    <th scope="col" class="n" [class.hp]="!dansPeriode(m)" [title]="dansPeriode(m) ? '' : 'Hors de la période du projet'">{{ lm(m) }}</th>
                  }
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of tsp.profils; track p.id) {
                  @let ecart = ecartDe(p.id);
                  <tr>
                    <th scope="row" class="pl-nom">{{ p.nom || 'Profil sans nom' }}</th>
                    <td class="n num">{{ jh(chargeDe(p.id)) }}</td>
                    <td class="n num ec" [class.ok]="ecart === 0" [class.ko]="ecart !== 0" [title]="titreEcart(ecart)">{{ ecart === 0 ? '✓' : ec(ecart) }}</td>
                    @for (m of mois(); track m) {
                      <td class="pcell" [class.hp]="!dansPeriode(m)">
                        <input class="pin" inputmode="decimal" [value]="tn(tsp.planning[p.id]?.[m])" (change)="saisir(p.id, m, $event)" [attr.aria-label]="(p.nom || 'Profil') + ', ' + lm(m)" />
                      </td>
                    }
                    <td>
                      <button type="button" class="btn ghost pl-rep" (click)="repartir(p.id)" [disabled]="chargeDe(p.id) === 0" title="Répartit la charge du workload à parts égales sur les mois de la période (remplace la ligne)">
                        Répartir
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="total">
                  <td>Total</td>
                  <td class="n num">{{ jh(totalWorkload()) }}</td>
                  <td class="n num ec" [class.ok]="ecartTotal() === 0" [class.ko]="ecartTotal() !== 0">{{ ecartTotal() === 0 ? '✓' : ec(ecartTotal()) }}</td>
                  @for (m of mois(); track m) {
                    <td class="n num">{{ totalMois(m) ? jh(totalMois(m)) : '' }}</td>
                  }
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="pl-note muted">
            « Répartir » partage la charge du profil à parts égales (au quart de jour) sur les mois de la période ; ajustez ensuite à la main.
            Les mois hachurés sont hors de la période du projet.
          </p>
        }
      </section>
      <app-controles-rubrique rubrique="planning" />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    table.pl td {
      padding: 2px 4px;
    }
    .pl-nom {
      font-weight: 500;
      white-space: nowrap;
      text-align: left;
      position: sticky;
      left: 0;
      background: var(--surface);
      z-index: 1;
    }
    .pl .pin {
      width: 58px;
    }
    .pl-rep {
      height: 28px;
      padding: 0 8px;
      font-size: 12.5px;
      color: var(--accent);
    }
    .pl-resume {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    .pl-note {
      margin: 10px 0 0;
      font-size: 12.5px;
    }
  `,
})
export class PlanningBrouillon {
  protected readonly etat = inject(BrouillonEtat);
  protected readonly jh = formatJh;
  protected readonly ec = formatEcart;
  protected readonly tn = texteNombre;
  protected readonly lm = libelleMois;

  protected readonly mois = computed(() => {
    const tsp = this.etat.contenu();
    return tsp ? moisDuPlanning(tsp) : [];
  });
  /** Mois de la période seule (pour « Répartir »). */
  private readonly moisPeriode = computed(() => this.mois().filter((m) => this.dansPeriode(m)));
  protected readonly totalWorkload = computed(() => {
    const tsp = this.etat.contenu();
    return tsp ? arrondi(tsp.profils.reduce((s, p) => s + chargeProfil(tsp, p.id), 0)) : 0;
  });
  protected readonly totalPlanifie = computed(() => {
    const tsp = this.etat.contenu();
    return tsp ? arrondi(tsp.profils.reduce((s, p) => s + chargePlanifiee(tsp, p.id), 0)) : 0;
  });

  protected readonly ecartTotal = computed(() => arrondi(this.totalPlanifie() - this.totalWorkload(), 2));

  protected dansPeriode(m: string): boolean {
    const tsp = this.etat.contenu();
    return !tsp || dansLaPeriode(tsp, m);
  }

  protected chargeDe(id: string): number {
    const tsp = this.etat.contenu();
    return tsp ? chargeProfil(tsp, id) : 0;
  }

  protected ecartDe(id: string): number {
    const tsp = this.etat.contenu();
    return tsp ? ecartPlanning(tsp, id) : 0;
  }

  protected titreEcart(ecart: number): string {
    if (ecart === 0) return 'Le planning retombe sur la charge du workload';
    return ecart < 0 ? `${formatJh(-ecart)} JH restent à répartir` : `${formatJh(ecart)} JH de trop au planning`;
  }

  protected totalMois(m: string): number {
    const tsp = this.etat.contenu();
    return tsp ? arrondi(tsp.profils.reduce((s, p) => s + (tsp.planning[p.id]?.[m] ?? 0), 0)) : 0;
  }

  protected saisir(profilId: string, mois: string, evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const n = lireNombre(champ.value);
    if (n === null || n < 0) {
      champ.value = texteNombre(this.etat.contenu()?.planning[profilId]?.[mois]);
      return;
    }
    this.etat.modifier((t) => {
      const parMois = (t.planning[profilId] ??= {});
      if (n === 0) delete parMois[mois];
      else parMois[mois] = n;
      if (!Object.keys(parMois).length) delete t.planning[profilId];
    });
  }

  protected repartir(profilId: string): void {
    const charge = this.chargeDe(profilId);
    const mois = this.moisPeriode();
    this.etat.modifier((t) => {
      const repartition = repartirSurLaPeriode(charge, mois);
      if (Object.keys(repartition).length) t.planning[profilId] = repartition;
      else delete t.planning[profilId];
    });
  }
}
