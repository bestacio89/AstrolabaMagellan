import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { RouterLink } from '@angular/router';
import { MoisCalcule, Statistiques } from '../api/modeles';
import { fE, fJ, fJz, fM, fP, fSigned, sgn } from '../etat/formats';
import { caseChaleur, grapheCharge, moisPasse, previsionnel, prevuReelADate, ProfilCharge, texteReste, ton, valeurPlanning } from '../etat/plan-de-charge.logique';
import { addMonths, lireNombre, monthDays } from '../etat/outils';
import { clePersonne, indexAbsences, joursAbsence } from '../etat/absences.logique';
import { UiEtat } from '../etat/ui.etat';
import { Fx } from '../ui/fx';
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

/** Vues du plan de charge. */
const VUES: [string, string][] = [
  ['pr', 'Prévu et réel'],
  ['prev', 'Prévisionnel'],
  ['axe', 'Par axe'],
  ['couts', 'Coûts'],
];

/**
 * Plan de charge (version HTML de référence, 54-charges-planning.js) :
 * - Prévu et réel : le prévisionnel de charge et le consommé saisi, côte à côte (indicateurs à date, tableau, graphique), puis le consommé réel valorisé ;
 * - Prévisionnel : replanifier la charge par profil et par mois sans toucher au TSP vendu, carte de chaleur de l'équipe ;
 * - Par axe (lot, phase) : prévu et consommé par profil ;
 * - Coûts : coûts à l'atterrissage.
 * Le planning vendu (TSP, par profil et par phase) est dans Annexes › Planning du TSP.
 */
@Component({
  selector: 'app-plan-de-charge',
  imports: [RouterLink, CarteRepliable, ToutReplier, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      @let t = v.m.total;
      <div class="sechead">
        <div>
          <h2>Plan de charge</h2>
          <p>
            Prévu et consommé réel côte à côte, prévisionnel à replanifier, prévu et consommé par {{ v.dimLl }}, coûts à l’atterrissage. Le planning vendu (TSP, par
            profil et par phase) est dans <a class="linkbtn" routerLink="../planning">Annexes › Planning</a>.
          </p>
        </div>
        <div class="pc-tete-d">
          @if (m.cles.length) {
            <app-tout-replier [cles]="m.cles" />
          }
          <div class="seg" role="group" aria-label="Vue du plan de charge">
            @for (x of vues; track x[0]) {
              <button type="button" [attr.aria-pressed]="m.vue === x[0]" (click)="ui.maj({ pc: x[0] })">
                {{ x[0] === 'axe' ? 'Par ' + v.dimLl : x[1] }}
                @if (x[0] === 'prev' && v.m.replanifie) {
                  <span class="pv-dot" title="Replanifié : différent du TSP"></span>
                }
              </button>
            }
          </div>
        </div>
      </div>

      @if (m.vue === 'pr') {
        @let r = m.pr!;
        <div class="kpis">
          <div class="kpi">
            <div class="l">Prévu à date</div>
            <div class="v">{{ fJ(r.pT) }}<small>JH</small></div>
            <div class="s">Cumul jusqu’à {{ m.moisCourantConnu ? fM(v.moisCourant) : 'aujourd’hui' }}, {{ v.m.replanifie ? 'prévisionnel replanifié' : 'prévisionnel de charge' }}</div>
          </div>
          <div class="kpi">
            <div class="l">Réel saisi à date</div>
            <div class="v">{{ fJ(r.rT) }}<small>JH</small></div>
            <div class="s">
              <span class="ecart-badge" [class.attention]="r.rT - r.pT > 0.001" [class.pc-b]="r.rT - r.pT < -0.001">{{ fSigned(r.rT - r.pT) }} JH</span> par rapport au prévu à date
            </div>
          </div>
          <div class="kpi">
            <div class="l">En avance à date</div>
            <div class="v">{{ r.avance.length }}<small>profil{{ r.avance.length > 1 ? 's' : '' }}</small></div>
            <div class="s">{{ r.avance.length ? liste(r.avance) : 'Aucun profil au-delà de son prévu' }}</div>
          </div>
          <div class="kpi">
            <div class="l">En retard à date</div>
            <div class="v">{{ r.retard.length }}<small>profil{{ r.retard.length > 1 ? 's' : '' }}</small></div>
            <div class="s">{{ r.retard.length ? liste(r.retard) : 'Aucun profil en dessous de son prévu' }}</div>
          </div>
        </div>
        <section class="card pc-carte">
          <header>
            <div>
              <h2>Prévu et réel, par profil <app-fx cle="prevureel" /></h2>
              <p>
                <b>Prévu = {{ v.m.replanifie ? 'prévisionnel replanifié' : 'prévisionnel de charge' }}</b> (<button type="button" class="linkbtn" (click)="ui.maj({ pc: 'prev' })">
                  voir le prévisionnel</button
                >). Mois écoulés : <b>réel</b> / prévu, avec une jauge ; mois à venir : prévu seul. <span class="pc-sur-t">Orange</span> = plus de jours que prévu (avance
                ou dépassement), <span class="pc-sous-t">bleu</span> = moins que prévu (retard ou économie). Un écart n’est pas une erreur : c’est la vie du projet.
              </p>
            </div>
          </header>
          @if (m.vide) {
            <p class="sub">
              Aucun planning mensuel : seul le réel peut être affiché. Saisissez-le dans <button type="button" class="linkbtn" (click)="ui.maj({ pc: 'prev' })">Prévisionnel</button>.
            </p>
          }
          <div class="tw">
            <table class="mscroll pc-table">
              <thead>
                <tr>
                  <th>Profil</th>
                  @for (x of v.m.mensuel; track x.mois) {
                    <th class="n" [class.m-cur]="x.mois === v.moisCourant">
                      {{ fM(x.mois) }}
                      @if (x.mois === v.moisCourant) {
                        <small class="pc-encours">en cours</small>
                      }
                    </th>
                  }
                  <th class="n">À date<small class="pc-encours">réel / prévu</small></th>
                  <th class="n">Écart</th>
                  <th class="n">Prévu total</th>
                </tr>
              </thead>
              <tbody>
                @for (p of m.profils; track p.i) {
                  @let e = r.reel(p.i) - r.prevu(p.i);
                  <tr>
                    <td>{{ p.nom }}</td>
                    @for (x of v.m.mensuel; track x.mois) {
                      @let pv = x.refP[p.i] || 0;
                      @let re = x.consoP[p.i] || 0;
                      @if (!passe(x, v.moisCourant)) {
                        <td class="n pc-fut" [class.m-cur]="x.mois === v.moisCourant">
                          @if (pv) {
                            {{ fJ(pv) }}
                          } @else {
                            <span class="muted">·</span>
                          }
                        </td>
                      } @else {
                        <td class="n" [class.m-cur]="x.mois === v.moisCourant">
                          <span class="pc-c" [class]="'pc-c ' + ton(re, pv)" [title]="'Réel ' + fJ(re) + ' JH · prévu ' + fJ(pv) + ' JH · écart ' + fSigned(re - pv)"
                            ><b>{{ fJ(re) }}</b><span>/ {{ fJ(pv) }}</span></span
                          ><span class="pc-jauge" aria-hidden="true"><i [style.width.%]="jauge(re, pv)"></i></span>
                        </td>
                      }
                    }
                    <td class="n">
                      <b>{{ fJ(r.reel(p.i)) }}</b><span class="muted"> / {{ fJ(r.prevu(p.i)) }}</span>
                    </td>
                    <td class="n">
                      <span [class]="e > 0.001 ? 'pc-t-sur' : e < -0.001 ? 'pc-t-sous' : 'muted'">{{ abs(e) > 0.001 ? fSigned(e) : '0' }}</span>
                    </td>
                    <td class="n muted">{{ fJ(prevuTotal(v.m.mensuel, p.i)) }}</td>
                  </tr>
                }
                <tr class="total">
                  <td>TOTAL JH</td>
                  @for (x of v.m.mensuel; track x.mois) {
                    @if (passe(x, v.moisCourant)) {
                      <td class="n" [class.m-cur]="x.mois === v.moisCourant">
                        <b>{{ fJ(x.conso) }}</b><span class="muted"> / {{ fJ(x.ref) }}</span>
                      </td>
                    } @else {
                      <td class="n pc-fut" [class.m-cur]="x.mois === v.moisCourant">{{ fJ(x.ref) }}</td>
                    }
                  }
                  <td class="n">
                    <b>{{ fJ(r.rT) }}</b><span class="muted"> / {{ fJ(r.pT) }}</span>
                  </td>
                  <td class="n">{{ fSigned(r.rT - r.pT) }}</td>
                  <td class="n">{{ fJ(m.prevuTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="card pc-carte">
          <header>
            <div>
              <h2>Charge mensuelle, tous profils</h2>
              <p>Barres : jours du mois (prévu / réel saisi) ; courbes : cumul depuis le début du projet. Survolez une barre ou un point pour le détail.</p>
            </div>
          </header>
          @let g = m.graphe!;
          <svg class="pc-graphe" [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" width="100%" role="img" aria-label="Charge mensuelle : prévu et réel saisi, par mois et en cumul">
            @for (x of g.graduations; track $index) {
              <line [attr.x1]="g.L" [attr.x2]="g.W - 10" [attr.y1]="x.y" [attr.y2]="x.y" stroke="var(--line)" />
              <text [attr.x]="g.L - 6" [attr.y]="x.y + 4" font-size="10" fill="var(--muted)" text-anchor="end">{{ x.v }}</text>
            }
            @for (b of g.barres; track b.mois) {
              <rect [attr.x]="b.prevu.x" [attr.y]="b.prevu.y" [attr.width]="g.bw" [attr.height]="b.prevu.h" rx="3" fill="var(--pc-prevu)">
                <title>{{ b.prevu.titre }}</title>
              </rect>
              @if (b.reel; as re) {
                <rect [attr.x]="re.x" [attr.y]="re.y" [attr.width]="g.bw" [attr.height]="re.h" rx="3" fill="var(--c-conso)">
                  <title>{{ re.titre }}</title>
                </rect>
              }
              <text [attr.x]="b.x" [attr.y]="g.yTexte" font-size="10.5" [attr.fill]="b.cur ? 'var(--c-conso)' : 'var(--muted)'" [attr.font-weight]="b.cur ? 600 : 400" text-anchor="middle">
                {{ b.libelle }}
              </text>
            }
            <polyline fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4" [attr.points]="g.cumulPrevu" />
            @if (g.cumulVendu) {
              <polyline fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round" [attr.points]="g.cumulVendu"><title>Vendu (TSP) cumulé</title></polyline>
            }
            @if (g.cumulReel) {
              <polyline fill="none" stroke="var(--c-conso)" stroke-width="2.5" [attr.points]="g.cumulReel" />
              @for (pt of g.pointsReel; track $index) {
                <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" fill="var(--c-conso)"><title>{{ pt.titre }}</title></circle>
              }
            }
            @if (g.aujourdhui; as a) {
              <line [attr.x1]="a.x" [attr.x2]="a.x" y1="8" [attr.y2]="a.y2" stroke="var(--today)" stroke-dasharray="3 3" />
              <text [attr.x]="a.x + 4" y="16" font-size="10" fill="var(--today)">aujourd’hui</text>
            }
          </svg>
          <div class="legend pc-leg">
            <span><i style="background: var(--pc-prevu)"></i>Prévu (mois)</span><span><i style="background: var(--c-conso)"></i>Réel saisi (mois)</span
            ><span><i class="pc-l-tir"></i>Prévu cumulé</span><span><i class="pc-l-plein"></i>Réel cumulé</span>
            @if (v.m.replanifie) {
              <span><i class="pc-l-pt"></i>Vendu (TSP) cumulé</span>
            }
          </div>
        </section>

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
      }

      @if (m.vue === 'prev') {
        @let c = m.pv!;
        @let rk = texteReste(c.resteT);
        <div class="kpis">
          <div class="kpi">
            <div class="l">Charge à réaliser</div>
            <div class="v">{{ fJ(c.chT) }}<small>JH</small></div>
            <div class="s">Charge vendue{{ m.ajouts ? ' + charges ajoutées' : '' }}, tous profils</div>
          </div>
          <div class="kpi">
            <div class="l">Projeté</div>
            <div class="v">{{ fJ(c.projT) }}<small>JH</small></div>
            <div class="s">Réel jusqu’à fin {{ fM(m.moisPrecedent) }} + prévisionnel à partir de {{ fM(v.moisCourant) }}</div>
          </div>
          <div class="kpi" [class.hero]="abs(c.resteT) > 0.001">
            <div class="l">Reste à placer</div>
            <div class="v">{{ rk[0] }}</div>
            <div class="s">Charge − projeté : à répartir sur les mois à venir</div>
          </div>
          <div class="kpi">
            <div class="l">Déplacé par rapport au TSP</div>
            <div class="v">{{ fJ(c.deplaces) }}<small>JH</small></div>
            <div class="s">{{ v.m.replanifie ? 'Jours ajoutés sur des mois à venir par rapport au planning vendu' : 'Le prévisionnel suit encore le planning vendu' }}</div>
          </div>
        </div>
        <section class="card pc-carte">
          <header>
            <div>
              <h2>Prévisionnel de charge, par profil <app-fx cle="previsionnel" /></h2>
              <p>
                Replanifiez ici les jours de chaque profil, mois par mois. <b>Le TSP vendu n’est jamais modifié</b> : il reste dans
                <a class="linkbtn" routerLink="../planning">Annexes › Planning du TSP</a> et sert de référence initiale.
              </p>
              <p class="pv-leg">
                Mois écoulés : réel saisi, en gris · mois en cours et à venir : cases modifiables · <span class="pv-leg-mod">●</span> valeur différente du TSP (survolez la
                case pour voir le TSP) · <span class="pv-leg-bad">▲ rouge</span> : plus de jours que de jours ouvrés dans le mois.
              </p>
            </div>
            @if (m.modif) {
              <div class="cc-extra">
                <button
                  type="button"
                  class="btn sm"
                  [disabled]="!v.m.replanifie"
                  [title]="v.m.replanifie ? '' : 'Le prévisionnel suit déjà le planning du TSP'"
                  (click)="reinitialiser()"
                >
                  Repartir du planning du TSP
                </button>
              </div>
            }
          </header>
          <div class="tw">
            <table class="nw plangrid mscroll pv-table">
              <thead>
                <tr>
                  <th>Profil</th>
                  <th class="n">Charge</th>
                  @for (x of v.m.mensuel; track x.mois) {
                    <th class="n" [class.m-cur]="x.mois === v.moisCourant">
                      {{ fM(x.mois) }}
                      @if (x.mois < v.moisCourant) {
                        <small class="pc-encours">réel</small>
                      } @else if (x.mois === v.moisCourant) {
                        <small class="pc-encours">en cours</small>
                      }
                      @if (!dansProjet(x.mois)) {
                        <span class="hp-m" title="Hors période du projet">⚠</span>
                      }
                    </th>
                  }
                  <th class="n">Projeté</th>
                  <th class="n">Reste à placer</th>
                </tr>
              </thead>
              <tbody>
                @for (p of m.profils; track p.i) {
                  @let rs = texteReste(c.reste[p.i]);
                  <tr>
                    <td>
                      {{ p.nom }}
                      @if (v.P[p.i]?.ajout) {
                        <span class="tag-aj">profil ajouté</span>
                      }
                    </td>
                    <td class="n">
                      {{ fJ(m.charge(p.i)) }}
                      @if (v.m.profils[p.i]?.ajoutJH) {
                        <small class="aj-n" [title]="'dont ' + fJ(v.m.profils[p.i].ajoutJH) + ' JH ajoutés en cours de projet'">dont +{{ fJ(v.m.profils[p.i].ajoutJH) }}</small>
                      }
                    </td>
                    @for (x of v.m.mensuel; track x.mois) {
                      @if (x.mois < v.moisCourant) {
                        <td class="n pv-passe">
                          <span [title]="'Réel saisi : ' + fJ(x.consoP[p.i] || 0) + ' JH (prévu ' + fJ(plan(p.i, x.mois)) + ' JH)'">
                            @if (x.consoP[p.i]) {
                              {{ fJ(x.consoP[p.i]) }}
                            } @else {
                              <span class="muted">0</span>
                            }
                          </span>
                        </td>
                      } @else {
                        @let val = plan(p.i, x.mois);
                        @let tsp = x.tspP?.[p.i] || 0;
                        <td class="n pcell" [class.m-cur]="x.mois === v.moisCourant">
                          <input
                            class="pin"
                            [class.pv-mod]="abs(val - tsp) > 0.001"
                            [class.bad]="c.surcharge(m.profilCharge(p.i), x.mois)"
                            inputmode="decimal"
                            [value]="val ? fJ(val) : ''"
                            placeholder="0"
                            [disabled]="!m.modif"
                            [attr.aria-label]="p.nom + ', ' + fM(x.mois)"
                            [title]="'Vendu (TSP) : ' + fJ(tsp) + ' JH' + (x.mois === v.moisCourant ? ' · réel déjà saisi ce mois : ' + fJ(x.consoP[p.i] || 0) + ' JH' : '')"
                            #ce
                            (change)="saisir(p.i, x.mois, ce, val)"
                          />
                        </td>
                      }
                    }
                    <td class="n">
                      <b>{{ fJ(c.proj[p.i]) }}</b>
                    </td>
                    <td class="n">
                      <span [class]="rs[1]">{{ rs[0] }}</span>
                    </td>
                  </tr>
                }
                <tr class="total">
                  <td>TOTAL JH</td>
                  <td class="n">{{ fJ(c.chT) }}</td>
                  @for (x of v.m.mensuel; track x.mois; let k = $index) {
                    <td class="n" [class.m-cur]="x.mois === v.moisCourant">{{ fJz(c.totM[k]) }}</td>
                  }
                  <td class="n">
                    <b>{{ fJ(c.projT) }}</b>
                  </td>
                  <td class="n">
                    <span [class]="rk[1]">{{ rk[0] }}</span>
                  </td>
                </tr>
                <tr class="money">
                  <td>Vendu (TSP)</td>
                  <td></td>
                  @for (x of v.m.mensuel; track x.mois) {
                    <td class="n muted">{{ fJz(m.venduMois(x)) }}</td>
                  }
                  <td class="n muted">{{ fJ(v.m.tspTotal ?? 0) }}</td>
                  <td></td>
                </tr>
                <tr class="money">
                  <td>Écart avec le TSP</td>
                  <td></td>
                  @for (x of v.m.mensuel; track x.mois; let k = $index) {
                    @let e = c.ecM[k];
                    <td class="n">
                      @if (e == null) {
                        <span class="muted">—</span>
                      } @else {
                        <span [class]="abs(e) > 0.001 ? 'pv-ec' : 'muted'">{{ abs(e) > 0.001 ? fSigned(e) : '' }}</span>
                      }
                    </td>
                  }
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="sub" style="margin-top: 8px">
            Ce prévisionnel alimente : Plan de charge › Prévu et réel, la FAE prévue (Finances › Facturation) et la charge de l’équipe du COPROJ. La référence initiale du
            tableau de bord reste le planning vendu. Pour planifier au-delà de la fin du projet, décalez la fin prévue dans ⚙ Paramètres du projet.
          </p>
        </section>
        <app-carte-repliable
          cle="heat"
          titre="Charge de l’équipe, mois par mois"
          sousTitre="Occupation de chaque profil = jours du mois ÷ jours ouvrés du mois (les absences saisies dans Pilotage › Absences sont rappelées au survol). Repérez d’un coup d’œil les mois surchargés ou creux ; corrigez dans le tableau ci-dessus."
        >
          <div class="tw">
            <table class="hm-table">
              <thead>
                <tr>
                  <th class="hm-p-h">Profil</th>
                  @for (x of v.m.mensuel; track x.mois) {
                    <th class="n" [class.m-cur]="x.mois === v.moisCourant">{{ fM(x.mois) }}</th>
                  }
                  <th class="hm-fin" aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                @for (p of m.profils; track p.i) {
                  <tr>
                    <th scope="row" class="hm-p">{{ p.nom }}</th>
                    @for (x of v.m.mensuel; track x.mois) {
                      @let h = chaleur(m.profilCharge(p.i), x.mois, c.cell(x, p.i), v.moisCourant);
                      <td [class]="h.classe + (x.mois === v.moisCourant ? ' m-cur' : '')" [title]="h.titre">{{ h.texte }}</td>
                    }
                    <td class="hm-fin" aria-hidden="true"></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="legend hm-leg">
            <span><i class="hm-sw hm1"></i>moins de 50 %</span><span><i class="hm-sw hm2"></i>50 à 79 %</span><span><i class="hm-sw hm3"></i>80 à 100 %</span
            ><span><i class="hm-sw hm4"></i>▲ plus de 100 % (surcharge)</span><span class="muted">Mois écoulés : réel saisi (hachuré) · ensuite : prévisionnel</span>
          </div>
        </app-carte-repliable>
      }

      @if (m.vue === 'axe') {
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
      }

      @if (m.vue === 'couts') {
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
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;
  protected readonly fM = fM;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly sgn = sgn;
  protected readonly somme = sum;
  protected readonly abs = Math.abs;
  protected readonly ton = ton;
  protected readonly passe = moisPasse;
  protected readonly texteReste = texteReste;
  protected readonly vues = VUES;
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
    const u = this.ui.ui();
    const vue = VUES.some(([k]) => k === u.pc) ? u.pc : 'pr';
    const profils = v.P.filter((p) => p.nom || v.m.profils[p.i]?.charge);
    const act = profils.map((p) => p.i);
    const charge = (i: number) => (v.m.profils[i]?.charge ?? 0) + (v.m.profils[i]?.ajoutJH ?? 0);
    const profilCharge = (i: number): ProfilCharge => ({ i, nom: v.P[i]?.nom ?? '', entite: v.P[i]?.entite ?? '', charge: charge(i) });
    const cur = v.moisCourant;
    const plan = (i: number, mk: string) => valeurPlanning(v.projet.planningRef, i, mk);
    return {
      v,
      vue,
      modif: v.droits.peutModifier,
      cles: ({ pr: ['conso'], prev: ['heat'], axe: ['initial', 'reel'], couts: ['term'] } as Record<string, string[]>)[vue] ?? [],
      profils,
      charge,
      profilCharge,
      // dernier mois où du consommé est saisi (même s'il est après le mois en cours) : les cumuls s'arrêtent là
      dernier: [...v.m.mensuel].reverse().find((x) => x.conso > 0) ?? null,
      lignes: [
        ...v.m.axes.map((a, k) => ({ cle: a.id + '|' + k, nom: a.nom, s: a as Statistiques, total: false })),
        { cle: '__total', nom: 'TOTAL', s: v.m.total, total: true },
      ],
      pr: vue === 'pr' ? prevuReelADate(v.m.mensuel, cur, act) : null,
      graphe: vue === 'pr' ? grapheCharge(v.m.mensuel, cur, !!v.m.replanifie) : null,
      vide: !sum(v.m.mensuel.map((x) => x.ref)),
      prevuTotal: sum(v.m.mensuel.map((x) => x.ref || 0)),
      moisCourantConnu: v.m.mensuel.some((x) => x.mois === cur),
      pv: vue === 'prev' ? previsionnel(v.m.mensuel, cur, profils.map((p) => profilCharge(p.i)), plan) : null,
      ajouts: sum(act.map((i) => v.m.profils[i]?.ajoutJH ?? 0)) > 0,
      moisPrecedent: addMonths(cur, -1),
      venduMois: (x: MoisCalcule) => sum(act.map((i) => x.tspP?.[i] || 0)),
    };
  });

  constructor() {
    afterRenderEffect(() => {
      this.vm();
      centrerMoisCourant(this.hote.nativeElement);
    });
  }

  protected liste(l: number[]): string {
    const v = this.etat.vue();
    const r = this.vm()?.pr;
    if (!v || !r) return '';
    return l.map((i) => `${v.P[i]?.nom ?? ''} ${fSigned(r.reel(i) - r.prevu(i))}`).join(' · ');
  }

  protected jauge(r: number, p: number): number {
    return Math.round(p ? Math.min(100, (r / p) * 100) : r ? 100 : 0);
  }

  protected prevuTotal(mensuel: readonly MoisCalcule[], i: number): number {
    return sum(mensuel.map((x) => x.refP[i] || 0));
  }

  protected plan(i: number, mk: string): number {
    return valeurPlanning(this.etat.vue()?.projet.planningRef, i, mk);
  }

  protected dansProjet(mk: string): boolean {
    const m = this.etat.vue()?.m;
    return !m || (mk >= m.moisDebut && mk <= m.moisFin);
  }

  /** Absences de l'équipe, rappelées au survol de la carte de chaleur (sans changer le taux). */
  private readonly absences = computed(() => indexAbsences(this.etat.vue()?.projet.absences));

  protected chaleur(p: ProfilCharge, mois: string, jours: number, cur: string) {
    const v = this.etat.vue();
    const collab = v?.P[p.i]?.collaborateur;
    const ab = collab ? joursAbsence(this.absences(), clePersonne(collab), monthDays(mois)) : 0;
    return caseChaleur(p, mois, jours, cur, ab);
  }

  /** Case du prévisionnel : nombre de jours (vide = 0) ; une saisie illisible est refusée et la case rétablie. */
  protected saisir(i: number, mois: string, el: HTMLInputElement, ancienne: number): void {
    const v = this.etat.vue();
    const profil = v?.P[i];
    if (!v || !profil) return;
    const brut = el.value.trim();
    const jh = brut === '' ? 0 : lireNombre(brut);
    if (jh == null || jh < 0) {
      this.etat.afficher('Indiquez un nombre de jours (ex. 4 ou 2,5).', 'attention');
      el.value = ancienne ? fJ(ancienne) : '';
      return;
    }
    if (Math.abs(jh - ancienne) < 1e-9) return;
    void this.etat.saisir((id) => this.api.previsionnel(id, profil.id, mois, jh), { siErreur: () => (el.value = ancienne ? fJ(ancienne) : '') });
  }

  protected async reinitialiser(): Promise<void> {
    const ok = await this.etat.confirmer(
      'Repartir du planning du TSP ?',
      ['Le prévisionnel de charge reprend, pour chaque profil et chaque mois, les jours du planning vendu. Le réel déjà saisi n’est pas touché. Les mois écoulés gardent le réel ; seuls les mois à venir changent de fait.'],
      'Repartir du TSP',
    );
    if (ok) void this.etat.saisir((id) => this.api.reinitialiserPrevisionnel(id));
  }

  protected totalProfil(mensuel: MoisCalcule[], i: number): number {
    return sum(mensuel.map((x) => x.consoP[i]));
  }

  protected ecart(s: Statistiques): number {
    return (s.coutFinal ?? 0) - (s.coutPrevu ?? 0);
  }
}
