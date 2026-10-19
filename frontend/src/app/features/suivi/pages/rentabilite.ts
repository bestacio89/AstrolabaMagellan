import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fx } from '../ui/fx';
import { fD, fE, fJ, fP2 } from '../etat/formats';
import { cascadeMarge, DepenseSimulee, ecartsTaches, placerCascade, simulerDepense } from '../etat/rentabilite.logique';
import { PANNEAU_MARGE, SuiviEtat } from '../etat/suivi.etat';
import { estFinancier } from '../etat/vigilance';
import { echEtat, EtatEcheance } from '../etat/vue';
import { EcheanceCalculee, PointVigilance } from '../api/modeles';

/** Valeurs de départ du simulateur : un déplacement type (à adapter). */
const DEPENSE_INITIALE: DepenseSimulee = { personnes: 2, jours: 1, transport: 150, sejour: 120, refacture: 0 };

/**
 * Rentabilité réelle du projet : d'où vient l'écart entre la marge vendue et la marge à terminaison (cascade),
 * simulation d'une dépense avant de l'engager, évolutions du périmètre, achats et frais.
 * Tous les montants viennent du calcul du serveur ; le simulateur n'enregistre rien.
 */
@Component({
  selector: 'app-rentabilite',
  imports: [RouterLink, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      @if (v.m.financier; as f) {
        @let ecartPts = f.tauxMargeNette - (f.tauxMargeNetteVendue ?? 0);
        <div class="sechead">
          <div>
            <h2>Rentabilité</h2>
            <p>De la marge vendue à la marge attendue à la fin du projet, frais et achats compris. Situation au {{ fD(v.aujourdhui) }}. <app-fx cle="renta" /></p>
          </div>
        </div>

        <div class="kpis essentiels">
          <div class="kpi">
            <div class="l">Marge nette vendue</div>
            <div class="v">{{ fP2(f.tauxMargeNetteVendue) }}</div>
            <div class="s">{{ fE(f.margeNetteVendue) }} au TSP signé</div>
          </div>
          <div class="kpi">
            <div class="l">Marge nette à terminaison</div>
            <div class="v"><span [class.neg]="ecartPts < -0.0005">{{ fP2(f.tauxMargeNette) }}</span></div>
            <div class="s">
              <span class="ecart-badge" [class.neg]="ecartPts < -0.0005" [class.pos]="ecartPts > 0.0005">{{ points(ecartPts) }}</span>
              {{ fE(f.margeNette) }}
            </div>
          </div>
          <div class="kpi">
            <div class="l">Coût de production</div>
            <div class="v">{{ fE(f.coutFinal) }}</div>
            <div class="s">
              <span class="ecart-badge" [class.neg]="f.coutFinal - f.coutPrevu > 0.5" [class.pos]="f.coutFinal - f.coutPrevu < -0.5">{{ signeE(f.coutFinal - f.coutPrevu) }}</span>
              par rapport au prévu ({{ fE(f.coutPrevu) }}, ajouts compris)
            </div>
          </div>
          <div class="kpi">
            <div class="l">Achats et frais</div>
            <div class="v"><span [class.neg]="f.achats.impactNet + f.frais.impactNet < -0.5">{{ signeE(f.achats.impactNet + f.frais.impactNet) }}</span></div>
            <div class="s">Effet sur la marge, par rapport au budget du TSP</div>
          </div>
        </div>

        <div class="s-grille">
          <section class="tdb-carte c-7" aria-labelledby="rt-cascade">
            <header>
              <h2 id="rt-cascade">De la marge vendue à la marge à terminaison <app-fx cle="cascade" /></h2>
              <span class="tdb-resume">marge nette, en euros</span>
            </header>
            @let pl = placement();
            <div class="rt-cascade" role="group" [attr.aria-label]="resumeCascade()">
              @for (b of pl.barres; track b.cle) {
                <button
                  type="button"
                  class="rt-col"
                  [class.is-sel]="colonneOuverte() === b.cle"
                  [attr.aria-pressed]="colonneOuverte() === b.cle"
                  [title]="b.detail + ' — cliquez pour le détail'"
                  (click)="etat.ouvrirMarge(b.cle)"
                >
                  <span class="rt-zone">
                    @if (!pl.coupee) {
                      <span class="rt-zero" [style.bottom.%]="pl.zero"></span>
                    }
                    <span class="rt-barre" [class]="'rt-barre ' + b.nature" [class.negatif]="b.nature === 'total' && b.montant < 0" [style.bottom.%]="b.bas" [style.height.%]="b.hauteur"></span>
                    <span class="rt-val" [class]="'rt-val ' + b.nature" [style.bottom.%]="b.bas + b.hauteur">{{ b.nature === 'total' ? fE(b.montant) : signeE(b.montant) }}</span>
                  </span>
                  <span class="rt-lib">{{ b.libelle }}</span>
                </button>
              }
            </div>
            @if (sansConso(); as sc) {
              <p class="rt-alerte-conso" role="status">
                <b>{{ sc.n }} tâche{{ sc.n > 1 ? 's' : '' }} validée{{ sc.n > 1 ? 's' : '' }} sans consommé</b> : {{ signeE(sc.montant) }} d’économie fictive dans les
                optimisations, tant que le temps passé n’est pas saisi.
                <button type="button" class="linkbtn" (click)="etat.ouvrirMarge('optim')">Voir le détail</button>
              </p>
            }
            @if (principaleCause(); as c) {
              <p class="rt-lecture"><b>{{ c.libelle }}</b> pèse le plus sur la marge ({{ signeE(c.montant) }}) : {{ c.detail.toLowerCase() }}.</p>
            }
            <footer>
              <span
                >Cliquez sur une colonne pour son détail. Marge nette = production + achats + frais (refacturé compris).{{
                  pl.coupee ? ' Échelle coupée : les colonnes de total ne partent pas de zéro.' : ''
                }}</span
              >
            </footer>
          </section>

          <section class="tdb-carte c-5 rt-simu" aria-labelledby="rt-simu">
            <header>
              <h2 id="rt-simu">Simuler une dépense <app-fx cle="simu" /></h2>
              <span class="rt-note">rien n’est enregistré</span>
            </header>
            <div class="rt-champs">
              <label class="rt-champ"
                >Personnes<input class="in" type="number" min="0" step="1" [value]="depense().personnes" (input)="changer('personnes', $event)"
              /></label>
              <label class="rt-champ"
                >Jours sur place<input class="in" type="number" min="0" step="0.5" [value]="depense().jours" (input)="changer('jours', $event)"
              /></label>
              <label class="rt-champ"
                >Transport par personne (€)<input class="in" type="number" min="0" step="10" [value]="depense().transport" (input)="changer('transport', $event)"
              /></label>
              <label class="rt-champ"
                >Hébergement et repas, par personne et par jour (€)<input
                  class="in"
                  type="number"
                  min="0"
                  step="10"
                  [value]="depense().sejour"
                  (input)="changer('sejour', $event)"
              /></label>
              <label class="rt-champ large"
                >Refacturé au client (€)<input class="in" type="number" min="0" step="50" [value]="depense().refacture" (input)="changer('refacture', $event)"
              /></label>
            </div>
            @let s = simulation();
            <dl class="rt-resultat">
              <div>
                <dt>Coût de la dépense</dt>
                <dd>{{ fE(s.cout) }}</dd>
              </div>
              <div>
                <dt>Marge nette à terminaison</dt>
                <dd>
                  <span class="muted">{{ fP2(s.tauxAvant) }}</span> → <b class="rt-apres" [class.neg]="s.ecartPoints < -0.0005">{{ fP2(s.tauxApres) }}</b>
                </dd>
              </div>
              <div>
                <dt>Variation</dt>
                <dd>{{ points(s.ecartPoints) }} · {{ signeE(s.margeApres - s.margeAvant) }}</dd>
              </div>
            </dl>
            @if (f.tauxMargeNetteVendue != null && s.tauxApres < f.tauxMargeNetteVendue - 0.0005 && s.cout > 0) {
              <p class="rt-alerte">Après cette dépense, la marge serait sous la marge nette vendue ({{ fP2(f.tauxMargeNetteVendue) }}).</p>
            }
            <footer>
              <button type="button" class="btn sm ghost" (click)="depense.set(depenseInitiale)">Réinitialiser</button>
              <span>Une dépense engagée se saisit dans <a routerLink="../frais">Frais</a>.</span>
            </footer>
          </section>
        </div>

        <div class="s-grille">
          <section class="tdb-carte c-7" aria-labelledby="rt-couts">
            <header>
              <h2 id="rt-couts">Coûts et marges <app-fx cle="coutsMarges" /></h2>
              <span class="tdb-resume">CA {{ fE(f.ca) }}{{ f.caAvenant ? ' (avenants −' + fE(f.caAvenant) + ')' : '' }}</span>
            </header>
            <div class="rt-grille">
              <div class="rt-mesure">
                <span class="rt-l">Coût initial</span>
                <b>{{ fE(f.coutInitial) }}</b>
                <span class="rt-n">Budget du TSP (CJM){{ f.coutAjout ? ' · + ' + fE(f.coutAjout) + ' d’ajouts' : '' }}</span>
              </div>
              <div class="rt-mesure">
                <span class="rt-l">Coût final estimé</span>
                <b>{{ fE(f.coutFinal) }}</b>
                <span class="rt-n"
                  ><span [class.neg]="f.ecartCout > 0.5">{{ signeE(f.ecartCout) }} par rapport au TSP</span>{{ f.coutAjout || f.coutAnnule || f.coutReaff ? ' · ' : ''
                  }}@if (f.coutAjout || f.coutAnnule || f.coutReaff) {<span [class.neg]="f.coutFinal - f.coutPrevu > 0.5" [class.pos]="f.coutFinal - f.coutPrevu < -0.5"
                      >{{ signeE(f.coutFinal - f.coutPrevu) }} par rapport au prévu</span
                    >}</span
                >
              </div>
              <div class="rt-mesure">
                <span class="rt-l">Marge sur production</span>
                <b>{{ fE(f.marge) }}</b>
                <span class="rt-n">{{ fP2(f.tauxMarge) }} · jours seulement</span>
              </div>
              <div class="rt-mesure">
                <span class="rt-l">Achats à l’atterrissage</span>
                <b>{{ fE(f.achats.att) }}</b>
                <span class="rt-n">Réel {{ fE(f.achats.reel) }} · budget {{ fE(f.achats.budget) }}</span>
              </div>
              <div class="rt-mesure">
                <span class="rt-l">Frais à l’atterrissage</span>
                <b>{{ fE(f.frais.att) }}</b>
                <span class="rt-n">Réel {{ fE(f.frais.reel) }} · budget {{ fE(f.frais.budget) }}</span>
              </div>
              <div class="rt-mesure fort">
                <span class="rt-l">Marge nette à terminaison</span>
                <b>{{ fE(f.margeNette) }}</b>
                <span class="rt-n">{{ fP2(f.tauxMargeNette) }} · vendue {{ fP2(f.tauxMargeNetteVendue) }}</span>
                <span class="rt-n">Taux sur {{ fE(f.ca + f.achats.attRev + f.frais.attRef) }} (CA + refacturé)</span>
              </div>
            </div>
            <footer>
              <span
                >Marge nette = production + achats + frais, refacturé au client compris. Le taux de la marge sur production se calcule sur le CA des jours, celui de la
                marge nette sur le CA augmenté du refacturé : à euros égaux, il est plus bas.</span
              >
            </footer>
          </section>

          @if (v.m.echeancier.length) {
            @let Sy = v.m.echSynth;
            <section class="tdb-carte c-5" aria-labelledby="rt-fact">
              <header>
                <h2 id="rt-fact">Facturation <app-fx cle="echeances" /></h2>
                @if (Sy) {
                  <span class="tdb-resume">Facturé <b>{{ fE(Sy.facture) }}</b> · payé {{ fE(Sy.paye) }}</span>
                }
              </header>
              <div class="tdb-liste">
                @for (e of v.m.echeancier; track e.n) {
                  @let et = etatEcheance(e);
                  <div class="tdb-ech">
                    <span class="n">{{ e.n }}</span>
                    <span class="tdb-texte">
                      <span class="tdb-titre" [title]="e.nom">{{ e.nom }}</span>
                      <span class="tdb-sous">{{
                        e.payeeLe ? 'Payée le ' + fD(e.payeeLe) : e.realiseLe ? 'Facturée le ' + fD(e.realiseLe) : e.datePrevue ? 'Prévue le ' + fD(e.datePrevue) : 'Sans date'
                      }}</span>
                    </span>
                    <span class="montant">{{ fE(e.montant ?? 0) }}</span>
                    <span class="pill" [class]="'pill ech-p-' + et[0]">{{ et[1] }}</span>
                  </div>
                }
              </div>
              <footer>
                <span>{{ Sy ? 'Reste à facturer ' + fE(Sy.reste) : '' }}</span>
                <a routerLink="../facturation">Voir la facturation →</a>
              </footer>
            </section>
          }
        </div>

        <div class="s-grille">
          <section class="tdb-carte c-7" aria-labelledby="rt-perim">
            <header>
              <h2 id="rt-perim">Évolutions du périmètre <app-fx cle="perimetre" /></h2>
              <span class="tdb-resume"
                >{{ v.m.perimetre.lignes.length }} évolution{{ v.m.perimetre.lignes.length > 1 ? 's' : ''
                }}{{ v.m.perimetre.nReaff ? ' · dont ' + v.m.perimetre.nReaff + ' réaffectation' + (v.m.perimetre.nReaff > 1 ? 's' : '') : '' }}</span
              >
            </header>
            @if (v.m.perimetre.lignes.length) {
              <div class="tw">
                <table class="rt-table">
                  <colgroup>
                    <col />
                    <col style="width: 84px" />
                    <col style="width: 96px" />
                    <col style="width: 112px" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Évolution</th>
                      <th class="n">Charge</th>
                      <th class="n">Coût</th>
                      <th>Facturation</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of v.m.perimetre.lignes; track l.uid + l.kind + (l.i ?? '') + (l.id ?? '')) {
                      @if (l.kind === 'reaff') {
                        <tr class="rt-reaff">
                          <td>
                            <span class="rt-genre reaff">⇄ Réaffectation</span>
                            <button type="button" class="tlink" [attr.data-open]="l.uid">{{ l.label }}</button>
                            <span class="rt-motif"
                              >{{ fD(l.at) }}{{ l.by ? ' · ' + l.by : '' }} · <b>{{ l.profils[0] }} → {{ l.profils[1] }}</b>{{ l.motif ? ' · ' + l.motif : '' }}</span
                            >
                          </td>
                          <td class="n">
                            {{ fJ(l.jh) }} JH déplacé{{ l.jh > 1 ? 's' : '' }}<span class="rt-motif">total inchangé</span>
                          </td>
                          <td class="n">
                            <span [class.neg]="(l.cout ?? 0) > 0.5">{{ signeE(l.cout ?? 0) }}</span>
                            @if (abs(l.cout ?? 0) >= 0.5) {
                              <span class="rt-motif">CJM {{ fE(v.P[l.de ?? -1]?.cjm) }} → {{ fE(v.P[l.vers ?? -1]?.cjm) }}</span>
                            }
                          </td>
                          <td><span class="muted">Sans effet</span></td>
                        </tr>
                      } @else {
                      <tr>
                        <td>
                          <span class="rt-genre" [class.annul]="l.kind === 'annul'">{{ l.kind === 'annul' ? 'Annulation' : l.kind === 'profil' ? 'Profil ajouté' : 'Tâche ajoutée' }}</span>
                          <button type="button" class="tlink" [attr.data-open]="l.uid">{{ l.label }}</button>
                          <span class="rt-motif">{{ fD(l.at) }}{{ l.by ? ' · ' + l.by : '' }}{{ l.motif ? ' · ' + l.motif : '' }}</span>
                        </td>
                        <td class="n">{{ l.kind === 'annul' ? '−' : '+' }}{{ fJ(abs(l.jh)) }} JH</td>
                        <td class="n">{{ fE(l.cout) }}</td>
                        <td>
                          @if (l.kind === 'annul') {
                            {{ l.avenant ? 'Avenant' : 'Sans avenant' }}
                          } @else {
                            <span class="muted">Non facturé</span>
                          }
                        </td>
                      </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="tdb-vide">Aucune évolution : le périmètre est celui du TSP.</p>
            }
            <footer>
              <span
                >Règle actuelle : un ajout n’est pas facturé (le CA reste celui du TSP). Une réaffectation ne change ni la charge totale ni le CA : seul le coût varie
                quand la nouvelle personne n’a pas le même CJM. Le suivi des avenants « à refacturer » est en préparation.</span
              >
            </footer>
          </section>

          <div class="c-5 tdb-col">
          @if (pointsFinanciers().length) {
            <section class="tdb-carte" aria-labelledby="rt-vig">
              <header><h2 id="rt-vig">Points d’attention <app-fx cle="vigilance" /></h2></header>
              <div class="tdb-liste">
                @for (p of pointsFinanciers(); track p.cle) {
                  <div class="rt-point">
                    <span class="pill" [class]="'pill lv-' + p.niveau">{{ valeurPoint(p) }}</span>
                    <span><b>{{ p.label }}</b>{{ p.detail ? ' · ' + p.detail : '' }}</span>
                  </div>
                }
              </div>
            </section>
          }
          <section class="tdb-carte" aria-labelledby="rt-dep">
            <header><h2 id="rt-dep">Achats et frais <app-fx cle="depenses" /></h2></header>
            <div class="rt-dep">
              @for (d of depenses(); track d.cle) {
                <a class="rt-dep-l" [routerLink]="'../' + d.cle">
                  <span class="rt-dep-t">{{ d.libelle }}</span>
                  <span class="rt-dep-c"><span class="muted">Budget</span> {{ fE(d.budget) }}</span>
                  <span class="rt-dep-c"><span class="muted">Réel</span> {{ fE(d.reel) }}</span>
                  <span class="rt-dep-c" [class.neg]="d.impact < -0.5" [class.pos]="d.impact > 0.5"><span class="muted">Effet</span> {{ signeE(d.impact) }}</span>
                  <span class="rt-jauge" aria-hidden="true"><i [style.width.%]="d.pct" [class.depasse]="d.reel > d.budget + 0.5"></i></span>
                </a>
              }
            </div>
            <footer><span>Effet sur la marge nette : refacturé au client compris.</span></footer>
          </section>
          </div>
        </div>
      } @else {
        <div class="card empty">La rentabilité n’est affichée qu’aux rôles qui voient les montants.</div>
      }
    }
  `,
  styles: `
    .rt-cascade {
      position: relative;
      display: flex;
      gap: var(--esp-3);
      height: 260px;
      padding: var(--esp-6) var(--esp-1) 0;
    }
    /* ligne du zéro, continue d'une colonne à l'autre */
    .rt-zero {
      position: absolute;
      left: calc(var(--esp-3) / -2);
      right: calc(var(--esp-3) / -2);
      height: 0;
      border-top: 1px solid var(--c-bordure);
    }
    .rt-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--esp-2);
      /* chaque colonne est un bouton : un clic ouvre son détail dans le volet */
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      padding: 0 0 2px;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.12s;
    }
    .rt-col:hover,
    .rt-col.is-sel {
      background: var(--c-primaire-clair);
    }
    .rt-col.is-sel {
      box-shadow: inset 0 -3px 0 var(--accent);
    }
    .rt-col:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .rt-col:hover .rt-lib,
    .rt-col.is-sel .rt-lib {
      color: var(--c-texte);
      font-weight: 600;
    }
    .rt-zone {
      position: relative;
      flex: 1;
      display: block;
    }
    .rt-alerte-conso {
      margin: 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--c-attention-fond);
      color: var(--c-attention);
      font: 400 13px/19px var(--police-texte);
    }
    .rt-alerte-conso b {
      color: inherit;
    }
    .rt-barre {
      position: absolute;
      left: 12%;
      right: 12%;
      border-radius: var(--rayon);
    }
    .rt-barre.total {
      background: var(--c-statut-valide);
    }
    .rt-barre.total.negatif {
      background: var(--c-statut-bloque);
    }
    .rt-barre.hausse {
      background: var(--c-ok-fond);
      box-shadow: inset 0 0 0 1px var(--c-statut-valide);
    }
    .rt-barre.baisse {
      background: var(--c-critique-fond);
      box-shadow: inset 0 0 0 1px var(--c-statut-bloque);
    }
    .rt-val {
      position: absolute;
      left: -8px;
      right: -8px;
      margin-bottom: 4px;
      text-align: center;
      font: 600 12px/16px var(--police-texte);
      white-space: nowrap;
    }
    .rt-val.hausse {
      color: var(--c-ok);
    }
    .rt-val.baisse {
      color: var(--c-critique);
    }
    .rt-lib {
      height: 36px;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
      text-align: center;
      overflow: hidden;
    }
    .rt-lecture {
      margin: 0;
      padding: var(--esp-2) var(--esp-3);
      border-radius: var(--rayon);
      background: var(--c-primaire-clair);
      font: 400 14px/20px var(--police-texte);
    }
    .rt-simu {
      border-color: var(--c-primaire);
    }
    .rt-note {
      font: 400 12px/16px var(--police-texte);
      padding: 2px 8px;
      border-radius: var(--rayon-badge);
      background: var(--c-violet-fond);
      color: var(--c-violet);
    }
    .rt-champs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--esp-3);
    }
    .rt-champ {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 4px;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .rt-champ.large {
      grid-column: 1 / -1;
    }
    .rt-champ .in {
      width: 100%;
      box-sizing: border-box;
      height: 36px;
    }
    .rt-resultat {
      margin: 0;
      padding-top: var(--esp-3);
      border-top: 1px solid var(--c-separateur);
      display: flex;
      flex-direction: column;
      gap: var(--esp-2);
    }
    .rt-resultat div {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--esp-3);
      font: 400 14px/20px var(--police-texte);
    }
    .rt-resultat dt {
      color: var(--c-texte-discret);
    }
    .rt-resultat dd {
      margin: 0;
      text-align: right;
    }
    .rt-apres {
      font: 600 22px/28px var(--police-titre);
    }
    .rt-alerte {
      margin: 0;
      padding: var(--esp-2) var(--esp-3);
      border-radius: var(--rayon);
      background: var(--c-attention-fond);
      color: var(--c-attention);
      font: 400 13px/18px var(--police-texte);
    }
    .rt-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .rt-table th {
      text-align: left;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
      padding: 6px 8px;
      border-bottom: 1px solid var(--c-bordure);
    }
    .rt-table td {
      padding: 8px;
      border-bottom: 1px solid var(--c-separateur);
      font: 400 14px/20px var(--police-texte);
      vertical-align: top;
    }
    .rt-table .n {
      text-align: right;
      white-space: nowrap;
    }
    .rt-genre {
      display: inline-block;
      margin-right: 6px;
      padding: 0 6px;
      border-radius: var(--rayon-badge);
      background: var(--c-primaire-clair);
      color: var(--c-primaire-fonce);
      font: 400 12px/20px var(--police-texte);
    }
    .rt-genre.annul {
      background: var(--c-neutre-fond);
      color: var(--c-texte-discret);
    }
    .rt-genre.reaff {
      font-weight: 600;
    }
    tr.rt-reaff td {
      background: color-mix(in srgb, var(--accent-soft) 45%, var(--surface));
    }
    .rt-motif {
      display: block;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .rt-dep {
      display: flex;
      flex-direction: column;
      gap: var(--esp-3);
    }
    .rt-dep-l {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: 4px var(--esp-4);
      align-items: baseline;
      padding: var(--esp-3);
      border-radius: var(--rayon-carte);
      border: 1px solid var(--c-separateur);
      color: var(--c-texte);
      text-decoration: none;
      font: 400 14px/20px var(--police-texte);
    }
    .rt-dep-l:hover {
      background: var(--c-survol);
    }
    .rt-dep-t {
      font-weight: 500;
    }
    .rt-dep-c .muted {
      font-size: 12px;
      margin-right: 2px;
    }
    .rt-jauge {
      grid-column: 1 / -1;
      height: 6px;
      border-radius: 3px;
      background: var(--c-separateur);
      overflow: hidden;
    }
    .rt-jauge i {
      display: block;
      height: 100%;
      background: var(--c-primaire);
    }
    .rt-jauge i.depasse {
      background: var(--c-statut-bloque);
    }
    .rt-grille {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--esp-3);
    }
    .rt-mesure {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--esp-3);
      border-radius: var(--rayon-carte);
      background: var(--c-fond);
      min-width: 0;
    }
    .rt-mesure b {
      font: 600 20px/28px var(--police-titre);
    }
    .rt-mesure.fort {
      background: var(--c-primaire-clair);
    }
    .rt-l {
      font: 400 13px/18px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .rt-n {
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .rt-point {
      display: flex;
      align-items: flex-start;
      gap: var(--esp-3);
      padding: var(--esp-2) 0;
      border-top: 1px solid var(--c-separateur);
      font: 400 13px/18px var(--police-texte);
    }
    .rt-point .pill {
      flex: none;
      min-width: 76px;
      text-align: center;
    }
    .rt-point b {
      font-weight: 500;
    }
    @container (max-width: 560px) {
      .rt-grille {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @container (max-width: 380px) {
      .rt-champs {
        grid-template-columns: 1fr;
      }
      .rt-dep-l {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class Rentabilite {
  protected readonly etat = inject(SuiviEtat);
  protected readonly vue = this.etat.vue;
  protected readonly fD = fD;
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fP2 = fP2;
  protected readonly abs = Math.abs;
  protected readonly depenseInitiale = DEPENSE_INITIALE;

  protected readonly depense = signal<DepenseSimulee>(DEPENSE_INITIALE);

  /** Points de vigilance sur l'argent (coûts, achats, frais, facturation) : ils ne sont montrés qu'ici. */
  protected readonly pointsFinanciers = computed(() => (this.vue()?.m.vigilance ?? []).filter((p) => p.niveau !== 'ok' && estFinancier(p)));

  protected valeurPoint(p: PointVigilance): string {
    if (p.unite === '€') return this.signeE(+p.valeur);
    return p.unite ? `${fJ(+p.valeur)} ${p.unite}` : String(p.valeur);
  }

  /** État affiché d'une échéance (payée, facturée, en retard, proche, planifiée). */
  protected etatEcheance(e: EcheanceCalculee): [EtatEcheance, string] {
    const v = this.vue();
    return v ? echEtat(v, e) : ['none', ''];
  }

  private readonly financier = computed(() => this.vue()?.m.financier ?? null);
  private readonly cascade = computed(() => {
    const f = this.financier();
    const v = this.vue();
    return f && v ? cascadeMarge(f, v.tasks) : [];
  });
  /** Colonne dont le détail est ouvert dans le volet (repérée dans la cascade). */
  protected readonly colonneOuverte = computed(() => {
    const p = this.etat.panneau();
    return p?.startsWith(PANNEAU_MARGE) ? p.slice(PANNEAU_MARGE.length) : null;
  });
  /** Tâches validées sans consommé : leur « économie » est fictive tant que le temps passé n'est pas saisi. */
  protected readonly sansConso = computed(() => {
    const v = this.vue();
    const l = v ? ecartsTaches(v.tasks).filter((e) => e.sansConso && e.ecart < 0) : [];
    return l.length ? { n: l.length, montant: -l.reduce((s, e) => s + e.ecart, 0) } : null;
  });
  protected readonly placement = computed(() => placerCascade(this.cascade()));
  protected readonly simulation = computed(() => {
    const f = this.financier();
    return f ? simulerDepense(f, this.depense()) : { cout: 0, margeAvant: 0, margeApres: 0, tauxAvant: 0, tauxApres: 0, ecartPoints: 0 };
  });

  /** La variation qui pèse le plus sur la marge (s'il y en a une négative). */
  protected readonly principaleCause = computed(() => {
    const baisses = this.cascade().filter((m) => m.nature === 'baisse');
    return baisses.sort((a, b) => a.montant - b.montant)[0] ?? null;
  });

  protected readonly resumeCascade = computed(() =>
    this.cascade()
      .map((m) => `${m.libelle} ${m.nature === 'total' ? fE(m.montant) : this.signeE(m.montant)}`)
      .join(', '),
  );

  protected readonly depenses = computed(() => {
    const f = this.financier();
    if (!f) return [];
    const ligne = (cle: 'achats' | 'frais', libelle: string, budget: number, reel: number, impact: number) => ({
      cle,
      libelle,
      budget,
      reel,
      impact,
      pct: budget > 0 ? Math.min(100, (reel / budget) * 100) : reel > 0 ? 100 : 0,
    });
    return [ligne('achats', 'Achats', f.achats.budget, f.achats.reel, f.achats.impactNet), ligne('frais', 'Frais', f.frais.budget, f.frais.reel, f.frais.impactNet)];
  });

  protected changer(champ: keyof DepenseSimulee, e: Event): void {
    const valeur = Number((e.target as HTMLInputElement).value.replace(',', '.'));
    this.depense.update((d) => ({ ...d, [champ]: Number.isFinite(valeur) ? valeur : 0 }));
  }

  /** Montant signé : « +1 200 € », « −860 € ». */
  protected signeE(v: number): string {
    if (Math.abs(v) < 0.5) return fE(0);
    return (v > 0 ? '+' : '−') + fE(Math.abs(v));
  }

  /** Écart de taux en points : « −1,2 pt ». */
  protected points(v: number): string {
    const p = Math.round(v * 1000) / 10;
    if (Math.abs(p) < 0.05) return '0 pt';
    return (p > 0 ? '+' : '−') + Math.abs(p).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' pt';
  }
}
