import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Action, Decision, Risque } from '../api/modeles';
import { Registre, SuiviApi } from '../api/suivi.api';
import { ACT_ST, AVANCEMENTS, DEC_ST, IMPACTS, ORIGINES, RISK_IMPACT, RISK_IMPACT_DEF, RISK_PROBA, RISK_PROBA_DEF, RISK_ST, riskNiveau } from '../etat/constantes';
import { fD, fP, largeur, stCls } from '../etat/formats';
import { addDays, distincts } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { estOuverte, isLate } from '../etat/vue';

type Champ = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Actions & décisions : registres des actions, des décisions et des risques, saisis directement dans le tableau (comme un Excel).
 * Tout est repris dans les exports COPROJ et COPIL.
 */
@Component({
  selector: 'app-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      <div class="sechead">
        <div>
          <h2>Actions & décisions</h2>
          <p>Actions à mener, décisions prises en comité et risques du projet. Saisie directe dans le tableau ; tout est repris dans les exports COPROJ et COPIL.</p>
        </div>
        <div class="seg" role="group" aria-label="Registre">
          <button type="button" [attr.aria-pressed]="m.vue === 'actions'" (click)="ui.maj({ ad: 'actions' })">Actions ({{ m.ouvertes.length }})</button>
          <button type="button" [attr.aria-pressed]="m.vue === 'decisions'" (click)="ui.maj({ ad: 'decisions' })">Décisions ({{ v.projet.decisions.length }})</button>
          <button type="button" [attr.aria-pressed]="m.vue === 'risques'" (click)="ui.maj({ ad: 'risques' })">Risques ({{ v.risquesOuverts.length }})</button>
        </div>
      </div>
      <datalist id="dl-people">
        @for (p of v.personnes; track p) {
          <option [value]="p"></option>
        }
      </datalist>

      @switch (m.vue) {
        @case ('actions') {
          <div class="toolbar">
            <label class="field"
              >Afficher
              <select class="in" #f (change)="ui.maj({ adf: f.value })">
                @for (o of filtresActions; track o[0]) {
                  <option [value]="o[0]" [selected]="o[0] === ui.ui().adf">{{ o[1] }}</option>
                }
              </select>
            </label>
            <label class="field"
              >Responsable
              <select class="in" #rp (change)="ui.maj({ adp: rp.value })">
                <option value="" [selected]="!ui.ui().adp">Tous</option>
                @for (p of m.porteurs; track p) {
                  <option [value]="p" [selected]="p === ui.ui().adp">{{ p }}</option>
                }
              </select>
            </label>
            <label class="field">Rechercher<input class="in" type="search" placeholder="Réf., action, commentaire" [value]="ui.ui().adq" #q (input)="ui.maj({ adq: q.value })" /></label>
            <span class="spacer"></span>
            <span class="chips"
              ><span
                >Ouvertes <b>{{ m.ouvertes.length }}</b></span
              ><span
                >En retard <b [class.neg]="m.retard > 0">{{ m.retard }}</b></span
              ><span
                >Date cible sous {{ v.alerteActions }} j <b>{{ m.bientot }}</b></span
              ></span
            >
            @if (v.droits.peutModifier) {
              <button type="button" class="btn primary" (click)="creer('actions')">+ Nouvelle action</button>
            }
          </div>
          <div class="tw">
            <table class="reg reg-act">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Action</th>
                  <th>Responsable</th>
                  <th>Instance</th>
                  <th>Date cible</th>
                  <th>Progression</th>
                  <th>Statut</th>
                  <th>Tâche concernée</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (a of m.actions; track a.id) {
                  @let retard = enRetard(a);
                  <tr class="reg-main" [class.is-late]="retard" [class.is-closed]="!ouverte(a)" [attr.data-row]="a.id">
                    <td class="num muted" [title]="'Créée le ' + fD(a.cree) + (a.par ? ' par ' + a.par : '')">{{ a.ref }}</td>
                    <td class="c-lib">
                      <textarea
                        class="in w-full reg-txt"
                        rows="1"
                        [attr.data-lib]="a.id"
                        placeholder="Décrivez l’action…"
                        [attr.aria-label]="'Action ' + a.ref"
                        [value]="a.libelle"
                        [disabled]="lecture()"
                        #x1
                        (change)="champ('actions', a.id, 'libelle', x1, a.libelle)"
                      ></textarea>
                    </td>
                    <td>
                      <input
                        class="in w-pers"
                        list="dl-people"
                        placeholder="Responsable"
                        aria-label="Responsable"
                        [value]="a.porteur"
                        [disabled]="lecture()"
                        #x2
                        (change)="champ('actions', a.id, 'porteur', x2, a.porteur)"
                      />
                    </td>
                    <td>
                      <select class="in" aria-label="Instance" [disabled]="lecture()" #x3 (change)="champ('actions', a.id, 'origine', x3, a.origine)">
                        @for (o of origines; track o) {
                          <option [value]="o" [selected]="o === a.origine">{{ o }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      <input
                        class="in w-date"
                        type="date"
                        aria-label="Date cible"
                        [class.late]="retard"
                        [title]="retard ? 'Date cible dépassée' : ''"
                        [value]="a.echeance ?? ''"
                        [disabled]="lecture()"
                        #x4
                        (change)="champ('actions', a.id, 'echeance', x4, a.echeance ?? '')"
                      />
                    </td>
                    <td class="c-prog">
                      <select class="in" aria-label="Progression" [disabled]="lecture()" #x5 (change)="champ('actions', a.id, 'progression', x5, '' + a.progression)">
                        @for (p of avancements; track p) {
                          <option [value]="p" [selected]="egal(p, a.progression)">{{ fP(p) }}</option>
                        }
                      </select>
                      <div class="bar ok mini"><i [style.width]="largeur(a.progression)"></i></div>
                    </td>
                    <td>
                      <select class="in st" [class]="'in st st-' + stCls(a.statut)" aria-label="Statut" [disabled]="lecture()" #x6 (change)="champ('actions', a.id, 'statut', x6, a.statut)">
                        @for (s of statutsAction; track s) {
                          <option [value]="s" [selected]="s === a.statut">{{ s }}</option>
                        }
                      </select>
                      @if (a.faitLe) {
                        <span class="auto">le {{ fD(a.faitLe) }}</span>
                      }
                    </td>
                    <td>
                      <div class="t-link">
                        <select class="in w-tache" aria-label="Tâche concernée" [disabled]="lecture()" #x7 (change)="champ('actions', a.id, 'tache', x7, a.tache ?? '')">
                          <option value="" [selected]="!a.tache">—</option>
                          @for (t of m.taches; track t.uid) {
                            <option [value]="t.uid" [selected]="t.uid === a.tache">{{ t.libelle }}</option>
                          }
                        </select>
                        @if (a.tache && v.parUid.has(a.tache)) {
                          <button type="button" class="btn sm ghost" [attr.data-open]="a.tache" title="Ouvrir la tâche">↗</button>
                        }
                      </div>
                    </td>
                    <td>
                      @if (!lecture()) {
                        <button type="button" class="btn sm ghost" title="Supprimer" [attr.aria-label]="'Supprimer ' + a.ref" (click)="supprimer('actions', a)">✕</button>
                      }
                    </td>
                  </tr>
                  <!-- commentaire : ligne pleine largeur sous l'action, pour que tout le texte reste visible -->
                  <tr class="reg-txt-l" [class.is-late]="retard" [class.is-closed]="!ouverte(a)">
                    <td></td>
                    <td colspan="7">
                      <label class="reg-com-l"
                        ><span class="reg-com-lab">Commentaire</span
                        ><textarea
                          class="in reg-txt reg-com"
                          rows="2"
                          placeholder="Où en est-on ? Précisions, relances, points de blocage…"
                          [attr.aria-label]="'Commentaire ' + a.ref"
                          [value]="a.commentaire"
                          [disabled]="lecture()"
                          #x8
                          (change)="champ('actions', a.id, 'commentaire', x8, a.commentaire)"
                        ></textarea
                      ></label>
                    </td>
                    <td></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="empty">
                      {{ v.projet.actions.length ? 'Aucune action ne correspond au filtre.' : 'Aucune action pour l’instant. Ajoutez la première avec « + Nouvelle action ».' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('risques') {
          <div class="toolbar">
            <label class="field"
              >Afficher
              <select class="in" #f (change)="ui.maj({ rkf: f.value })">
                <option value="ouverts" [selected]="ui.ui().rkf === 'ouverts'">Risques ouverts</option>
                <option value="clos" [selected]="ui.ui().rkf === 'clos'">Maîtrisés / clos</option>
                <option value="tous" [selected]="ui.ui().rkf === 'tous'">Tous</option>
              </select>
            </label>
            <label class="field">Rechercher<input class="in" type="search" placeholder="Réf., risque, parade" [value]="ui.ui().adq" #q (input)="ui.maj({ adq: q.value })" /></label>
            <span class="spacer"></span>
            <span class="chips"
              ><span
                >Ouverts <b>{{ v.risquesOuverts.length }}</b></span
              ><span
                >Forts <b [class.neg]="v.risquesForts.length > 0">{{ v.risquesForts.length }}</b></span
              ></span
            >
            @if (v.droits.peutModifier) {
              <button type="button" class="btn primary" (click)="creer('risques')">+ Nouveau risque</button>
            }
          </div>
          <div class="rk-wrap">
            <div class="tw">
              <table class="reg reg-rk">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Risque</th>
                    <th>Probabilité</th>
                    <th>Impact</th>
                    <th>Criticité</th>
                    <th>Responsable</th>
                    <th>Statut</th>
                    <th>Action liée</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of m.risques; track r.id) {
                    <tr class="reg-main" [attr.data-row]="r.id" [class.is-closed]="!estOuvert(r)">
                      <td class="num muted" [title]="'Créé le ' + fD(r.cree) + (r.par ? ' par ' + r.par : '')">{{ r.ref }}</td>
                      <td class="c-lib">
                        <textarea
                          class="in w-full reg-txt"
                          rows="1"
                          [attr.data-lib]="r.id"
                          placeholder="Décrivez le risque…"
                          [attr.aria-label]="'Risque ' + r.ref"
                          [value]="r.libelle"
                          [disabled]="lecture()"
                          #y1
                          (change)="champ('risques', r.id, 'libelle', y1, r.libelle)"
                        ></textarea>
                      </td>
                      <td>
                        <select class="in" aria-label="Probabilité" [disabled]="lecture()" #y2 (change)="champ('risques', r.id, 'proba', y2, r.proba)">
                          @for (x of probas; track x) {
                            <option [value]="x" [selected]="x === (r.proba || 'Modérée')">{{ x }}</option>
                          }
                        </select>
                      </td>
                      <td>
                        <select class="in" aria-label="Importance" [disabled]="lecture()" #y3 (change)="champ('risques', r.id, 'impact', y3, r.impact)">
                          @for (x of impactsRisque; track x) {
                            <option [value]="x" [selected]="x === (r.impact || 'Moyenne')">{{ x }}</option>
                          }
                        </select>
                      </td>
                      <td>
                        <span class="pill" [class]="'pill lv-' + niveau(r.crit)[0]" [title]="'Probabilité × importance = ' + r.crit + ' sur 16'">{{ niveau(r.crit)[1] }} · {{ r.crit }}</span>
                      </td>
                      <td>
                        <input
                          class="in w-pers"
                          list="dl-people"
                          placeholder="Responsable"
                          aria-label="Responsable"
                          [value]="r.responsable"
                          [disabled]="lecture()"
                          #y5
                          (change)="champ('risques', r.id, 'responsable', y5, r.responsable)"
                        />
                      </td>
                      <td>
                        <select class="in" aria-label="Statut" [disabled]="lecture()" #y6 (change)="champ('risques', r.id, 'statut', y6, r.statut)">
                          @for (x of statutsRisque; track x) {
                            <option [value]="x" [selected]="x === (r.statut || 'Ouvert')">{{ x }}</option>
                          }
                        </select>
                      </td>
                      <td>
                        <select class="in" aria-label="Action liée" [disabled]="lecture()" #y7 (change)="champ('risques', r.id, 'action', y7, r.action ?? '')">
                          <option value="" [selected]="!r.action">—</option>
                          @for (a of v.projet.actions; track a.id) {
                            <option [value]="a.id" [selected]="a.id === r.action">{{ a.ref }} {{ a.libelle.slice(0, 40) }}</option>
                          }
                        </select>
                      </td>
                      <td>
                        @if (!lecture()) {
                          <button type="button" class="btn sm ghost" title="Supprimer" [attr.aria-label]="'Supprimer ' + r.ref" (click)="supprimer('risques', r)">✕</button>
                        }
                      </td>
                    </tr>
                    <tr class="reg-txt-l" [class.is-closed]="!estOuvert(r)">
                      <td></td>
                      <td colspan="7">
                        <label class="reg-com-l"
                          ><span class="reg-com-lab">Parade</span
                          ><textarea
                            class="in reg-txt reg-com"
                            rows="2"
                            placeholder="Plan de réduction : que fait-on pour que le risque ne survienne pas ?"
                            [attr.aria-label]="'Parade ' + r.ref"
                            [value]="r.parade"
                            [disabled]="lecture()"
                            #y4
                            (change)="champ('risques', r.id, 'parade', y4, r.parade)"
                          ></textarea
                        ></label>
                      </td>
                      <td></td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="9" class="empty">
                        {{
                          v.projet.risques.length
                            ? 'Aucun risque ne correspond au filtre.'
                            : 'Aucun risque pour l’instant. La provision pour risque du TSP se pilote ici : ajoutez le premier avec « + Nouveau risque ».'
                        }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (v.projet.risques.length) {
              <div class="rk-mat" aria-label="Matrice des risques ouverts">
                <span class="rk-ax">Probabilité ↑ · Importance →</span>
                @for (ligne of m.matrice; track ligne.proba) {
                  <span class="rk-l">{{ ligne.proba }}</span>
                  @for (c of ligne.cases; track $index) {
                    <span class="rk-c" [class]="'rk-c rk-' + c.niveau">{{ c.n || '' }}</span>
                  }
                }
                <span></span>
                @for (x of impactsRisque; track x) {
                  <span class="rk-l b">{{ x }}</span>
                }
              </div>
            }
          </div>
        }
        @default {
          <div class="toolbar">
            <label class="field"
              >Statut
              <select class="in" #f (change)="ui.maj({ adfd: f.value })">
                <option value="toutes" [selected]="ui.ui().adfd === 'toutes'">Toutes</option>
                @for (s of statutsDecision; track s) {
                  <option [value]="s" [selected]="s === ui.ui().adfd">{{ s }}</option>
                }
              </select>
            </label>
            <label class="field">Rechercher<input class="in" type="search" placeholder="Réf., décision, commentaire" [value]="ui.ui().adq" #q (input)="ui.maj({ adq: q.value })" /></label>
            <span class="spacer"></span>
            <span class="chips"
              ><span
                >Validées <b>{{ m.decValidees }}</b></span
              ><span
                >À valider <b>{{ m.decAValider }}</b></span
              ></span
            >
            @if (v.droits.peutModifier) {
              <button type="button" class="btn primary" (click)="creer('decisions')">+ Nouvelle décision</button>
            }
          </div>
          <div class="tw">
            <table class="reg">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Date</th>
                  <th>Instance</th>
                  <th>Décision</th>
                  <th>Décideur</th>
                  <th>Impact</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (d of m.decisions; track d.id) {
                  <tr class="reg-main" [attr.data-row]="d.id">
                    <td class="num muted">{{ d.ref }}</td>
                    <td>
                      <input class="in w-date" type="date" aria-label="Date" [value]="d.date" [disabled]="lecture()" #z1 (change)="champ('decisions', d.id, 'date', z1, d.date)" />
                    </td>
                    <td>
                      <select class="in" aria-label="Instance" [disabled]="lecture()" #z2 (change)="champ('decisions', d.id, 'instance', z2, d.instance)">
                        @for (o of origines; track o) {
                          <option [value]="o" [selected]="o === d.instance">{{ o }}</option>
                        }
                      </select>
                    </td>
                    <td class="c-lib">
                      <textarea
                        class="in w-full reg-txt"
                        rows="1"
                        [attr.data-lib]="d.id"
                        placeholder="Énoncez la décision…"
                        [attr.aria-label]="'Décision ' + d.ref"
                        [value]="d.libelle"
                        [disabled]="lecture()"
                        #z3
                        (change)="champ('decisions', d.id, 'libelle', z3, d.libelle)"
                      ></textarea>
                    </td>
                    <td>
                      <input
                        class="in w-pers"
                        list="dl-people"
                        placeholder="Décideur"
                        aria-label="Décideur"
                        [value]="d.decideur"
                        [disabled]="lecture()"
                        #z4
                        (change)="champ('decisions', d.id, 'decideur', z4, d.decideur)"
                      />
                    </td>
                    <td>
                      <select class="in" aria-label="Impact" [disabled]="lecture()" #z5 (change)="champ('decisions', d.id, 'impact', z5, d.impact)">
                        @for (o of impactsDecision; track o) {
                          <option [value]="o" [selected]="o === (d.impact || '')">{{ o || '—' }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      <select class="in st" [class]="'in st st-' + stCls(d.statut)" aria-label="Statut" [disabled]="lecture()" #z6 (change)="champ('decisions', d.id, 'statut', z6, d.statut)">
                        @for (s of statutsDecision; track s) {
                          <option [value]="s" [selected]="s === d.statut">{{ s }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      @if (!lecture()) {
                        <button type="button" class="btn sm ghost" title="Supprimer" [attr.aria-label]="'Supprimer ' + d.ref" (click)="supprimer('decisions', d)">✕</button>
                      }
                    </td>
                  </tr>
                  <tr class="reg-txt-l">
                    <td></td>
                    <td colspan="6">
                      <label class="reg-com-l"
                        ><span class="reg-com-lab">Commentaire</span
                        ><textarea
                          class="in reg-txt reg-com"
                          rows="2"
                          placeholder="Contexte, conditions, conséquences…"
                          [attr.aria-label]="'Commentaire ' + d.ref"
                          [value]="d.commentaire"
                          [disabled]="lecture()"
                          #z7
                          (change)="champ('decisions', d.id, 'commentaire', z7, d.commentaire)"
                        ></textarea
                      ></label>
                    </td>
                    <td></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="empty">
                      {{ v.projet.decisions.length ? 'Aucune décision ne correspond au filtre.' : 'Aucune décision pour l’instant. Ajoutez la première avec « + Nouvelle décision ».' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Actions {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);

  protected readonly fD = fD;
  protected readonly fP = fP;
  protected readonly largeur = largeur;
  protected readonly stCls = stCls;
  protected readonly ouverte = estOuverte;
  protected readonly origines = ORIGINES;
  protected readonly avancements = AVANCEMENTS;
  protected readonly statutsAction = ACT_ST;
  protected readonly statutsDecision = DEC_ST;
  protected readonly impactsDecision = IMPACTS;
  protected readonly probas = RISK_PROBA;
  protected readonly impactsRisque = RISK_IMPACT;
  protected readonly statutsRisque = RISK_ST;
  protected readonly filtresActions: [string, string][] = [
    ['ouvertes', 'Actions ouvertes'],
    ['retard', 'En retard'],
    ['closes', 'Faites / annulées'],
    ['toutes', 'Toutes'],
  ];
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    const q = u.adq.trim().toLowerCase();
    const A = v.projet.actions;
    const ouvertes = A.filter(estOuverte);
    const late = (a: Action) => isLate(v, a);
    const lim = addDays(v.aujourdhui, v.alerteActions);
    const f = u.adf || 'ouvertes';
    const actions = A.filter(
      (a) =>
        (f === 'toutes' || (f === 'ouvertes' && estOuverte(a)) || (f === 'retard' && late(a)) || (f === 'closes' && !estOuverte(a))) &&
        (!u.adp || a.porteur === u.adp) &&
        (!q || `${a.ref} ${a.libelle} ${a.commentaire}`.toLowerCase().includes(q)),
    ).sort(
      (x, y) =>
        Number(estOuverte(y)) - Number(estOuverte(x)) ||
        String(x.echeance || '9999').localeCompare(String(y.echeance || '9999')) ||
        x.ref.localeCompare(y.ref),
    );
    const ouvertsR = new Set(v.risquesOuverts.map((r) => r.id));
    const rkf = u.rkf || 'ouverts';
    const risques = v.projet.risques
      .filter(
        (r) =>
          (rkf === 'tous' || (rkf === 'ouverts' ? ouvertsR.has(r.id) : !ouvertsR.has(r.id))) &&
          (!q || `${r.ref} ${r.libelle} ${r.parade} ${r.commentaire}`.toLowerCase().includes(q)),
      )
      .sort((x, y) => y.crit - x.crit || x.ref.localeCompare(y.ref));
    const fd = u.adfd || 'toutes';
    const decisions = v.projet.decisions
      .filter((x) => (fd === 'toutes' || x.statut === fd) && (!q || `${x.ref} ${x.libelle} ${x.commentaire}`.toLowerCase().includes(q)))
      .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')) || y.ref.localeCompare(x.ref));
    // matrice probabilité × importance des risques ouverts (4 × 4)
    const matrice = [3, 2, 1, 0].map((pI) => ({
      proba: RISK_PROBA[pI],
      cases: [0, 1, 2, 3].map((iI) => {
        const n = v.risquesOuverts.filter(
          (r) => Math.max(0, RISK_PROBA.indexOf((r.proba || RISK_PROBA_DEF) as (typeof RISK_PROBA)[number])) === pI &&
            Math.max(0, RISK_IMPACT.indexOf((r.impact || RISK_IMPACT_DEF) as (typeof RISK_IMPACT)[number])) === iI,
        ).length;
        const c = (pI + 1) * (iI + 1);
        return { n, niveau: ({ fort: 'crit', moyen: 'warn', faible: 'ok' } as const)[riskNiveau(c)] };
      }),
    }));
    return {
      v,
      vue: u.ad === 'decisions' || u.ad === 'risques' ? u.ad : 'actions',
      ouvertes,
      retard: A.filter(late).length,
      bientot: ouvertes.filter((a) => a.echeance && a.echeance >= v.aujourdhui && a.echeance <= lim).length,
      porteurs: distincts(A.map((a) => a.porteur).filter(Boolean)).sort(),
      actions,
      taches: v.tasks.map((t) => ({ uid: t.uid, libelle: t.label.length > 60 ? t.label.slice(0, 59) + '…' : t.label })),
      risques,
      decisions,
      decValidees: v.projet.decisions.filter((x) => x.statut === 'Validée').length,
      decAValider: v.projet.decisions.filter((x) => x.statut === 'À valider').length,
      matrice,
    };
  });

  protected egal(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-9;
  }

  protected enRetard(a: Action): boolean {
    const v = this.etat.vue();
    return !!v && isLate(v, a);
  }

  protected estOuvert(r: Risque): boolean {
    return (r.statut || 'Ouvert') === 'Ouvert' || r.statut === 'Survenu';
  }

  protected niveau(crit: number): [string, string] {
    const libelles = { fort: ['critique', 'Fort'], moyen: ['attention', 'Moyen'], faible: ['ok', 'Faible'] } as const;
    return [...libelles[riskNiveau(crit)]] as [string, string];
  }

  /** Modification d'un champ : envoyée telle quelle (le serveur applique les règles : progression ⇔ statut, date « fait le »…). */
  protected champ(registre: Registre, id: string, champ: string, el: Champ, ancien: string): void {
    const valeur = el instanceof HTMLInputElement && el.type === 'date' ? el.value || null : el.value.trim();
    if ((valeur ?? '') === ancien) return;
    void this.etat.saisir((pid) => this.api.modifier(pid, registre, id, { champ, valeur, version: this.etat.versionLigne(registre, id) }), {
      siErreur: () => (el.value = ancien),
    });
  }

  /** Nouvelle ligne : le serveur réutilise une ligne encore sans libellé (double clic) ; son libellé est prêt à être saisi. */
  protected creer(registre: Registre): void {
    if (registre === 'actions') this.ui.maj({ adf: 'ouvertes' });
    if (registre === 'risques') this.ui.maj({ rkf: 'ouverts' });
    void this.etat.saisir((id) => this.api.creer(id, registre));
  }

  protected async supprimer(registre: Registre, x: Action | Decision | Risque): Promise<void> {
    if (x.libelle) {
      const nom = registre === 'actions' ? 'l’action' : registre === 'decisions' ? 'la décision' : 'le risque';
      const note =
        registre === 'actions'
          ? 'Pour garder la trace d’une action qui n’a plus lieu d’être, préférez le statut « Annulée ».'
          : registre === 'risques'
            ? 'Pour garder la trace d’un risque écarté, préférez le statut « Clos ».'
            : undefined;
      const ok = await this.etat.confirmer(`Supprimer ${nom} ${x.ref} ?`, [`« ${x.libelle} »`], 'Supprimer', note ? { note } : {});
      if (!ok) return;
    }
    void this.etat.saisir((id) => this.api.supprimerLigne(id, registre, x.id));
  }
}
