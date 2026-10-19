import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoisCalcule, Statistiques } from '../api/modeles';
import { fE, fJ, fJz, fM, fP, sgn } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { CarteRepliable, ToutReplier } from '../ui/cartes';

type CleMois = 'coutCJM' | 'cumCJM' | 'valoTJM' | 'cumTJM';

/** Recentre les tableaux mensuels qui débordent sur le mois en cours (colonnes figées déduites). */
export function centrerMoisCourant(racine: HTMLElement): void {
  racine.querySelectorAll<HTMLTableElement>('table.mscroll').forEach((tb) => {
    const tw = tb.closest<HTMLElement>('.tw'),
      th = tb.querySelector<HTMLElement>('th.m-cur');
    if (!tw || !th || tw.scrollWidth <= tw.clientWidth + 4 || tw.dataset['centre']) return;
    const gauche = tb.querySelector<HTMLElement>('th:first-child')?.offsetWidth ?? 0;
    const droite = tb.classList.contains('has-tot') ? (tb.querySelector<HTMLElement>('th:last-child')?.offsetWidth ?? 0) : 0;
    tw.scrollLeft = Math.max(0, th.offsetLeft - gauche - (tw.clientWidth - gauche - droite - th.offsetWidth) / 2);
    tw.dataset['centre'] = '1';
  });
}

/**
 * Plan de charge : consommé réel par profil et par mois (coût au CJM, valeur au TJM), prévu et consommé par axe et profil,
 * coûts à l'atterrissage. Le planning initial du TSP est dans Annexes › Planning.
 */
@Component({
  selector: 'app-plan-de-charge',
  imports: [RouterLink, CarteRepliable, ToutReplier],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      @let t = v.m.total;
      <div class="sechead">
        <div>
          <h2>Plan de charge</h2>
          <p>
            Consommé réel, prévu et consommé par {{ v.dimLl }}, coûts à l’atterrissage. Le planning initial du TSP (par profil et par phase) est dans
            <a class="linkbtn" routerLink="../planning">Annexes › Planning</a>.
          </p>
        </div>
        <app-tout-replier [cles]="cles" />
      </div>

      <app-carte-repliable
        cle="conso"
        titre="Consommé réel par profil"
        sousTitre="Issu de la saisie du consommé : chaque mois saisi est valorisé, coût interne au CJM, valeur produite au TJM."
      >
        <span resume
          ><b>{{ fJ(t.conso) }}</b> JH consommés · coût <b>{{ fE(m.dernier?.cumCJM ?? 0) }}</b> · valeur produite <b>{{ fE(m.dernier?.cumTJM ?? 0) }}</b></span
        >
        <div class="tw">
          <table class="mscroll has-tot">
            <thead>
              <tr>
                <th>Profil</th>
                @for (x of v.m.mensuel; track x.mois) {
                  <th class="n" [class.m-cur]="x.mois === v.moisCourant">{{ fM(x.mois) }}</th>
                }
                <th class="n">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (p of m.profils; track p.i) {
                <tr>
                  <td>{{ p.nom }}</td>
                  @for (x of v.m.mensuel; track x.mois) {
                    <td class="n">{{ fJz(x.consoP[p.i]) }}</td>
                  }
                  <td class="n">{{ fJ(totalProfil(v.m.mensuel, p.i)) }}</td>
                </tr>
              }
              <tr class="total">
                <td>TOTAL JH</td>
                @for (x of v.m.mensuel; track x.mois) {
                  <td class="n">{{ fJz(somme(x.consoP)) }}</td>
                }
                <td class="n">{{ fJ(t.conso) }}</td>
              </tr>
              @for (l of lignesMontants; track l[1]) {
                <tr class="money">
                  <td>{{ l[0] }}</td>
                  @for (x of v.m.mensuel; track x.mois) {
                    <!-- mensuel : dès qu'il y a une saisie ; cumul : jusqu'au dernier mois saisi -->
                    <td class="n">{{ (l[2] ? x.mois > (m.dernier?.mois ?? '') : !x[l[1]]) ? '' : fE(x[l[1]]) }}</td>
                  }
                  <td class="n">{{ l[2] ? '' : fE(totalMontant(v.m.mensuel, l[1])) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte-repliable>

      <app-carte-repliable cle="initial" [titre]="'Prévu par ' + v.dimLl + ' et profil'" [sousTitre]="'Charge prévue par ' + v.dimLl + ' et par profil (JH).'">
        <span resume
          ><b>{{ fJ(t.prevu) }}</b> JH sur {{ v.m.axes.length }} {{ v.dimLl }}(s)</span
        >
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>{{ v.dimL }}</th>
                @for (p of m.profils; track p.i) {
                  <th class="n">{{ p.nom }}</th>
                }
                <th class="n">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (a of m.lignes; track a.cle) {
                <tr [class.total]="a.total">
                  <td>{{ a.nom }}</td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ a.total ? fJ(a.s.prevuP[p.i]) : fJz(a.s.prevuP[p.i]) }}</td>
                  }
                  <td class="n">{{ fJ(a.s.prevu) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte-repliable>

      <app-carte-repliable cle="reel" [titre]="'Consommé par ' + v.dimLl + ' et profil'" [sousTitre]="'Consommé par ' + v.dimLl + ' et par profil (JH).'">
        <span resume
          ><b>{{ fJ(t.conso) }}</b> JH · {{ fP(t.prevu ? t.conso / t.prevu : 0) }} du prévu</span
        >
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>{{ v.dimL }}</th>
                @for (p of m.profils; track p.i) {
                  <th class="n">{{ p.nom }}</th>
                }
                <th class="n">Total</th>
                <th class="n">% du prévu</th>
              </tr>
            </thead>
            <tbody>
              @for (a of m.lignes; track a.cle) {
                <tr [class.total]="a.total">
                  <td>{{ a.nom }}</td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ a.total ? fJ(a.s.consoP[p.i]) : fJz(a.s.consoP[p.i]) }}</td>
                  }
                  <td class="n">{{ fJ(a.s.conso) }}</td>
                  <td class="n">{{ fP(a.s.prevu ? a.s.conso / a.s.prevu : 0) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte-repliable>

      <app-carte-repliable
        cle="term"
        [titre]="'Coûts à l’atterrissage par ' + v.dimLl"
        sousTitre="Coût prévu (prévu × CJM), consommé et reste à faire au CJM. Les JH à l’atterrissage sont détaillés sur le tableau de bord."
      >
        <span resume
          >Coût à l’atterrissage <b>{{ fE(t.coutFinal) }}</b> · écart <b [class]="sgn(ecart(t))">{{ fE(ecart(t)) }}</b></span
        >
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>{{ v.dimL }}</th>
                <th class="n">Atterrissage (JH)</th>
                <th class="n">Coût prévu</th>
                <th class="n">Coût consommé</th>
                <th class="n">Coût RAF</th>
                <th class="n">Coût à l’atterrissage</th>
                <th class="n">Écart / coût prévu</th>
              </tr>
            </thead>
            <tbody>
              @for (a of m.lignes; track a.cle) {
                <tr [class.total]="a.total">
                  <td>{{ a.nom }}</td>
                  <td class="n">{{ fJ(a.s.atterrissage) }}</td>
                  <td class="n">{{ fE(a.s.coutPrevu) }}</td>
                  <td class="n">{{ fE(a.s.coutConso) }}</td>
                  <td class="n">{{ fE(a.s.coutRaf) }}</td>
                  <td class="n">{{ fE(a.s.coutFinal) }}</td>
                  <td class="n">
                    <span [class]="sgn(ecart(a.s))">{{ fE(ecart(a.s)) }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte-repliable>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class PlanDeCharge {
  private readonly etat = inject(SuiviEtat);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;
  protected readonly fM = fM;
  protected readonly fP = fP;
  protected readonly sgn = sgn;
  protected readonly somme = sum;
  protected readonly cles = ['conso', 'initial', 'reel', 'term'];
  /** [libellé, champ, cumul ?] */
  protected readonly lignesMontants: [string, CleMois, boolean][] = [
    ['Coût interne mensuel (CJM)', 'coutCJM', false],
    ['Coût interne cumulé (CJM)', 'cumCJM', true],
    ['Valeur produite mensuelle (TJM)', 'valoTJM', false],
    ['Valeur produite cumulée (TJM)', 'cumTJM', true],
  ];

  protected totalMontant(mensuel: readonly MoisCalcule[], cle: CleMois): number {
    return mensuel.reduce((s, x) => s + (Number(x[cle]) || 0), 0);
  }

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    return {
      v,
      profils: v.P.filter((p) => p.nom || v.m.profils[p.i]?.charge),
      // dernier mois où du consommé est saisi (même s'il est après le mois en cours) : les cumuls s'arrêtent là
      dernier: [...v.m.mensuel].reverse().find((x) => x.conso > 0) ?? null,
      lignes: [
        ...v.m.axes.map((a, k) => ({ cle: a.id + '|' + k, nom: a.nom, s: a as Statistiques, total: false })),
        { cle: '__total', nom: 'TOTAL', s: v.m.total, total: true },
      ],
    };
  });

  constructor() {
    afterRenderEffect(() => {
      this.vm();
      centrerMoisCourant(this.hote.nativeElement);
    });
  }

  protected totalProfil(mensuel: MoisCalcule[], i: number): number {
    return sum(mensuel.map((x) => x.consoP[i]));
  }

  protected ecart(s: Statistiques): number {
    return (s.coutFinal ?? 0) - (s.coutPrevu ?? 0);
  }
}
