import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { IA_CONFORME, IA_ST } from '../etat/constantes';
import { fE, fJ, fP, fSigned } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { axeName, couleurGroupe, filteredTasks, groupByAxe, TacheVue, Vue } from '../etat/vue';
import { BarreFiltres } from '../ui/barre-filtres';
import { Carte } from '../ui/cartes';
import { LienTache, Statut } from '../ui/tache';

/**
 * Workload › Optimisation IA : enveloppe Agent IA de chaque tâche, résultat (constaté à la validation, projeté avant),
 * levier ou cause et commentaire ; synthèse des économies par levier.
 */
@Component({
  selector: 'app-workload-ia',
  imports: [BarreFiltres, Carte, LienTache, Statut],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      @let ia = v.m.ia;
      @if (!ia.profil) {
        <div class="card">
          <p>Aucun profil IA n’est défini. Choisissez-le dans <b>⚙ Paramètres du projet</b> (par défaut, le profil dont le nom contient « Agent IA »).</p>
        </div>
      } @else {
        <app-barre-filtres>
          <label class="field"
            >Résultat IA
            <select class="in" #f (change)="ui.maj({ iaF: f.value })">
              @for (o of filtres(ia.aJustifier.length); track o[0]) {
                <option [value]="o[0]" [selected]="o[0] === ui.ui().iaF">{{ o[1] }}</option>
              }
            </select>
          </label>
          <span class="spacer"></span>
        </app-barre-filtres>
        <div class="kpis">
          <div class="kpi">
            <div class="l">Enveloppe IA</div>
            <div class="v">{{ fJ(ia.ref) }}<small>JH</small></div>
            <div class="s">{{ ia.profil }} · {{ ia.tasks.length }} tâche(s){{ v.droits.voitMontants ? ' · ' + fE(ia.ref * (ia.tjm ?? 0)) + ' au TJM' : '' }}</div>
          </div>
          <div class="kpi">
            <div class="l">IA consommée</div>
            <div class="v">{{ fJ(ia.consomme) }}<small>JH</small></div>
            <div class="s">Consommé total des tâches au-delà de la charge des autres profils</div>
          </div>
          <div class="kpi hero">
            <div class="l">Économie réalisée</div>
            <div class="v">
              <span [class]="ia.realise < -1e-9 ? 'neg' : ia.realise > 1e-9 ? 'pos' : ''">{{ fSigned(ia.realise) }}</span><small>JH</small>
            </div>
            <div class="s">
              {{ v.droits.voitMontants ? fE(ia.valeurTJM) + ' préservés (TJM) · ' + fE(ia.valeurCJM) + ' évités (CJM) · ' : '' }}{{ ia.validees }} tâche(s) validée(s) · taux
              {{ fP(ia.taux) }}
            </div>
          </div>
          <div class="kpi">
            <div class="l">Projection à l’atterrissage</div>
            <div class="v">{{ fSigned(ia.projection) }}<small>JH</small></div>
            <div class="s">{{ fP(ia.tauxProj) }} de l’enveloppe{{ v.droits.voitMontants ? ' · ' + fE(ia.projTJM) + ' au TJM' : '' }}</div>
          </div>
        </div>
        @if (ia.aJustifier.length) {
          <div class="banner warn">
            <div>
              <b>{{ ia.aJustifier.length }} bilan(s) IA à faire.</b> Tâche(s) validée(s) avec un écart sur l’enveloppe, sans commentaire.
            </div>
            <button type="button" class="btn sm" (click)="ui.maj({ iaF: 'just' })">Les afficher</button>
          </div>
        }
        <app-carte
          titre="Résultat par tâche"
          sousTitre="L’enveloppe IA est une réserve adossée aux profils de chaque tâche : elle n’est consommée que si la tâche dépasse la charge de ses profils. Résultat constaté à la validation, projection (≈) avant."
        >
          <div class="tw tall">
            <table class="ia-t">
              <colgroup>
                @for (w of largeurs; track $index) {
                  <col [style.width.%]="w" />
                }
              </colgroup>
              <thead>
                <tr>
                  <th>Tâche</th>
                  <th>Statut</th>
                  <th class="n">Enveloppe IA</th>
                  <th class="n">Profils</th>
                  <th class="n">Consommé</th>
                  <th class="n">IA consommée</th>
                  <th class="n">Résultat</th>
                  <th>Statut IA</th>
                  <th>Type</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                @for (g of m.groupes; track g.cle) {
                  <tr class="grp axg" [style.--axc]="g.couleur">
                    <td colspan="10">
                      {{ g.nom }} <span class="muted">· {{ g.taches.length }} · {{ fSigned(g.constate) }} JH constatés</span>
                    </td>
                  </tr>
                  @for (t of g.taches; track t.uid) {
                    <tr class="axr" [class.ia-row-just]="t.iaAJustifier" [class.is-sel]="etat.panneau() === t.uid" [style.--axc]="g.couleur">
                      <td class="lbl wrap-t"><app-lien-tache [t]="t" /></td>
                      <td><app-statut [statut]="t.statut" /></td>
                      <td class="n">{{ fJ(t.ia) }}</td>
                      <td class="n" title="Charge des autres profils de la tâche">{{ fJ(t.iaHum) }}</td>
                      <td class="n">{{ fJ(t.consoTotal) }}</td>
                      <td class="n">
                        @if (t.iaConso) {
                          {{ fJ(t.iaConso) }}
                        } @else {
                          <span class="muted">0</span>
                        }
                      </td>
                      <td class="n">
                        @if (t.iaRes == null) {
                          —
                        } @else {
                          <span
                            [class]="t.iaRes > 1e-9 ? 'pos' : t.iaRes < -1e-9 ? 'neg' : ''"
                            [title]="t.statut === 'Validé' ? 'Résultat constaté' : 'Projection à l’atterrissage'"
                            >{{ t.statut === 'Validé' ? '' : '≈ ' }}{{ fSigned(t.iaRes) }}</span
                          >
                        }
                      </td>
                      <td>
                        <span class="ia-pill" [class]="'ia-pill ' + statutIa(t)[1]">{{ statutIa(t)[0] }}</span>
                        @if (t.iaAJustifier) {
                          <span class="ia-pill ia-just" title="Tâche validée avec un écart sur l’enveloppe IA : indiquez le type et le commentaire">À justifier</span>
                        }
                      </td>
                      <td>
                        <select class="in ia-type" aria-label="Type d’optimisation" [disabled]="!v.droits.peutModifier" #ty (change)="bilan(t, ty.value, t.iaJustif, ty, t.iaType)">
                          <option value="">— {{ (t.iaRes ?? 0) < -1e-9 ? 'Cause' : 'Levier' }} —</option>
                          @for (x of typesIa(v, t); track x) {
                            <option [value]="x" [selected]="x === t.iaType">{{ x }}</option>
                          }
                        </select>
                      </td>
                      <td class="c-com">
                        <textarea
                          class="in cmt-auto"
                          rows="1"
                          aria-label="Commentaire IA"
                          [placeholder]="t.statut === 'Validé' ? 'Pourquoi ce résultat ?' : 'Commentaire'"
                          [title]="t.iaJustif"
                          [value]="t.iaJustif"
                          [disabled]="!v.droits.peutModifier"
                          #ju
                          (change)="bilan(t, t.iaType, ju.value, ju, t.iaJustif)"
                        ></textarea>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td colspan="10" class="empty">Aucune tâche ne correspond au filtre.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-carte>
        <app-carte titre="Économies par levier" sousTitre="Tâches validées avec un écart, par type d’optimisation. La liste des types se règle dans ⚙ Paramètres du projet.">
          @if (ia.parType.length) {
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Sens</th>
                    <th class="n">Tâches</th>
                    <th class="n">JH</th>
                    @if (v.droits.voitMontants) {
                      <th class="n">Valeur (TJM)</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (x of ia.parType; track x.type) {
                    <tr>
                      <td>{{ x.type }}</td>
                      <td>
                        @if (x.sens === 'eco') {
                          <span class="ia-pill ia-eco">Économie</span>
                        } @else {
                          <span class="ia-pill ia-dep">Dépassement</span>
                        }
                      </td>
                      <td class="n">{{ x.n }}</td>
                      <td class="n">{{ fSigned(x.jh) }}</td>
                      @if (v.droits.voitMontants) {
                        <td class="n">{{ fE(x.jh * (ia.tjm ?? 0)) }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="muted">Aucune tâche validée avec un écart pour l’instant.</p>
          }
        </app-carte>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class WorkloadIa {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly largeurs = [22, 8, 6, 6, 7, 7, 6, 10, 12, 16];

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    const f = u.iaF;
    const garder = new Set(filteredTasks(v, u).map((t) => t.uid)); // mêmes filtres que la liste
    const ok = (t: TacheVue) =>
      !f || (f === 'just' ? t.iaAJustifier : f === 'eco' ? t.iaStatut === 'totale' || t.iaStatut === 'partielle' : t.iaStatut === f);
    const liste = v.m.ia.tasks
      .map((uid) => v.parUid.get(uid))
      .filter((t): t is TacheVue => !!t && garder.has(t.uid) && ok(t));
    return {
      v,
      groupes: groupByAxe(v, liste).map(([cle, taches]) => ({
        cle,
        nom: axeName(v, cle),
        couleur: couleurGroupe(v, cle),
        taches,
        constate: sum(taches.filter((t) => t.statut === 'Validé').map((t) => t.iaRes ?? 0)),
      })),
    };
  });

  protected filtres(nbAJustifier: number): [string, string][] {
    return [
      ['', 'Tous'],
      ['just', `À justifier (${nbAJustifier})`],
      ['eco', 'Économies'],
      ['conforme', 'Conformes'],
      ['depassement', 'Dépassements'],
      ['encours', 'En cours'],
      ['avenir', 'À venir'],
    ];
  }

  protected statutIa(t: TacheVue): [string, string] {
    return IA_ST[t.iaStatut ?? ''] ?? ['—', 'ia-none'];
  }

  protected typesIa(v: Vue, t: TacheVue): string[] {
    const r = t.iaRes ?? 0;
    const liste = r > 1e-9 ? v.m.ia.leviers : r < -1e-9 ? v.m.ia.causes : [IA_CONFORME, ...v.m.ia.leviers];
    return t.iaType && !liste.includes(t.iaType) ? [...liste, t.iaType] : liste;
  }

  protected bilan(t: TacheVue, iaType: string, iaJustif: string, el: HTMLSelectElement | HTMLTextAreaElement, ancien: string): void {
    void this.etat.saisir((id) => this.api.bilanIa(id, t.uid, iaType, iaJustif.trim(), this.etat.versionTache(t.uid)), { siErreur: () => (el.value = ancien) });
  }
}
