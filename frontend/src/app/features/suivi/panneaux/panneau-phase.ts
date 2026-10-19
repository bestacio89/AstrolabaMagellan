import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { EcheanceCalculee } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { avancementValide } from '../etat/avancement';
import { STATUTS } from '../etat/constantes';
import { fD, fE, fJ, fP, fSigned, sgn, stSlug } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { TacheVue, echEtat } from '../etat/vue';
import { Barre, MiniBarre } from '../ui/petits';
import { EtiquetteAjout } from '../ui/tache';

interface PointAttention {
  libelle: string;
  taches: TacheVue[];
  niveau: 'crit' | 'warn';
}

/**
 * Panneau de détail d'une phase (même emplacement que celui des tâches) : points d'attention, avancement,
 * charges, dates, ateliers et livrables, échéance de facturation de la phase et liste de ses tâches.
 */
@Component({
  selector: 'app-panneau-phase',
  imports: [Barre, MiniBarre, EtiquetteAjout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vue(); as v) {
      @if (d(); as d) {
        <aside class="drawer" aria-label="Détail de la phase" style="--axc: var(--g-tsp)">
          <div class="dr-head">
            <div class="dr-nav">
              @if (etat.retourAvancement()) {
                <button type="button" class="btn sm ghost" title="Revenir au détail de l’avancement" (click)="etat.ouvrirAvancement()">‹ Avancement</button>
              }
              <span class="dr-kind">Phase</span><span class="spacer"></span
              ><button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
            </div>
            <h2 class="dr-title">{{ phase() }}</h2>
            <div class="dr-meta">{{ d.taches.length }} tâche(s){{ d.ajout ? ' · dont ' + fJ(d.ajout) + ' JH ajoutés en cours de projet' : '' }}</div>
          </div>
          <div class="dr-body">
            @if (d.points.length) {
              <section>
                <h3>Points d’attention</h3>
                @for (p of d.points; track p.libelle) {
                  <div class="ph-alert" [class]="'ph-alert ph-' + p.niveau">
                    <b>{{ p.taches.length }} {{ p.libelle.toLowerCase() }}</b>
                    <div>
                      @for (t of p.taches.slice(0, 4); track t.uid; let last = $last) {
                        <button type="button" class="linkbtn" [attr.data-open]="t.uid">{{ t.label }}</button>{{ last ? '' : ' · ' }}
                      }
                      {{ p.taches.length > 4 ? ' · +' + (p.taches.length - 4) : '' }}
                    </div>
                  </div>
                }
              </section>
            }
            <section>
              <h3>Statut et avancement</h3>
              <app-barre [valeur]="d.avancement" classe="ok" />
              <div class="ph-st">
                @for (s of d.statuts; track s.statut) {
                  <span class="pill xs" [class]="'pill xs st-' + stSlug(s.statut)">{{ s.statut }} · {{ s.n }}</span>
                }
              </div>
            </section>
            <section>
              <h3>Charges</h3>
              <div class="dr-kpis">
                <div>
                  <span>Prévu</span><b>{{ fJ(d.charge) }} JH</b>
                </div>
                <div>
                  <span>Consommé</span><b [class.over]="d.conso > d.charge + 1e-9">{{ fJ(d.conso) }} JH</b>
                </div>
                <div>
                  <span>Reste à faire</span><b>{{ fJ(d.raf) }} JH</b>
                </div>
                <div>
                  <span>Atterrissage</span><b>{{ fJ(d.atter) }} JH</b>
                </div>
              </div>
              <div class="ph-ec">
                <span
                  >Écart d’atterrissage : <b [class]="sgn(d.ecart)">{{ fSigned(d.ecart) }} JH</b>
                  @if (d.ecart > 0.001) {
                    <span class="pill lv-critique">Dépassement</span>
                  } @else if (d.ecart < -0.001) {
                    <span class="pill lv-ok">Optimisation</span>
                  } @else {
                    <span class="pill st-afaire">Conforme</span>
                  }
                </span>
                @if (v.droits.voitMontants) {
                  <span
                    >Coût à l’atterrissage : <b>{{ fE(d.cout) }}</b></span
                  >
                }
              </div>
            </section>
            <section>
              <h3>Dates</h3>
              <table class="pr-tbl">
                <thead>
                  <tr>
                    <th></th>
                    <th>Prévu</th>
                    <th>Réel <small>consommé</small></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Début</th>
                    <td>{{ fD(d.pD) }}</td>
                    <td>{{ fD(d.rD) }}</td>
                  </tr>
                  <tr>
                    <th>Fin</th>
                    <td>
                      {{ fD(d.pF) }}
                      @if (d.apres) {
                        <span class="neg">(après la fin du projet)</span>
                      }
                    </td>
                    <td>{{ fD(d.rF) }}</td>
                  </tr>
                </tbody>
              </table>
              <span class="auto"
                >Prévu : premier début et dernière fin prévus des tâches. Réel : premier et dernier jour de consommé saisi.{{
                  d.sansDates ? ' ' + d.sansDates + ' tâche(s) non validée(s) sans dates prévues.' : ''
                }}</span
              >
            </section>
            @if (d.types.length) {
              <section>
                <h3>Ateliers & livrables</h3>
                @for (x of d.types; track x.nom) {
                  <div class="ph-type">
                    <span>{{ x.nom }}</span><span class="num">{{ x.ok }} / {{ x.n }} réalisé(s)</span><app-mini-barre [valeur]="x.ok / x.n" />
                  </div>
                }
              </section>
            }
            @if (v.m.echeancier.length && v.droits.voitMontants) {
              <section>
                <h3>Facturation</h3>
                <label class="field"
                  >Échéance de la phase
                  <select #ec class="in" [disabled]="!v.droits.peutModifier" (change)="changerEcheance(ec)">
                    <option value="" [selected]="d.echeance == null">— Aucune —</option>
                    @for (e of v.m.echeancier; track e.n) {
                      <option [value]="e.n" [selected]="d.echeance?.n === e.n" [disabled]="d.echeance?.n !== e.n && !!e.realiseLe">{{ libelleEcheance(e) }}</option>
                    }
                  </select>
                </label>
                @if (d.echeance; as e) {
                  <div class="dr-ech" [class]="'dr-ech ech-' + echEtat(v, e)[0]">
                    <span class="pill" [class]="'pill ech-p-' + echEtat(v, e)[0]">{{ echEtat(v, e)[1] }}</span> <b>n° {{ e.n }}</b> · {{ fE(e.montant) }} · prévue le
                    {{ fD(e.datePrevue) }}{{ e.realiseLe ? ' · facturée le ' + fD(e.realiseLe) : '' }}{{ e.payeeLe ? ' · payée le ' + fD(e.payeeLe) : '' }}
                    <div class="perim-av">
                      <app-mini-barre [valeur]="e.avLie" /><span>Périmètre lié : {{ e.nLies }} tâche(s), avancement {{ fP(e.avLie ?? 0) }}</span>
                      @if (e.pret && !e.realiseLe) {
                        <span class="tag-ok">Prête à facturer</span>
                      }
                    </div>
                  </div>
                }
                <span class="auto"
                  >L’échéance choisie s’applique à toutes les tâches de la phase, actuelles et futures. Tant qu’elle est définie, les tâches ne peuvent pas avoir leur propre
                  échéance.{{ !d.echeance && d.directes.length ? ' ' + d.directes.length + ' tâche(s) ont aujourd’hui une échéance individuelle : elle serait remplacée.' : '' }}</span
                >
              </section>
            }
            <section>
              <h3>Tâches de la phase</h3>
              <div class="ph-tasks">
                @for (t of d.taches; track t.uid) {
                  <button type="button" class="ph-task" [attr.data-open]="t.uid">
                    <span class="ph-t-l">{{ t.label }}</span><app-etiquette-ajout [t]="t" /><span class="pill xs" [class]="'pill xs st-' + stSlug(t.statut)">{{ t.statut }}</span
                    ><span class="num muted">{{ fJ(t.consoTotal) }} / {{ fJ(t.charge) }} JH</span>
                  </button>
                }
              </div>
            </section>
          </div>
        </aside>
      }
    }
  `,
})
export class PanneauPhase {
  readonly phase = input.required<string>();
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  protected readonly vue = this.etat.vue;

  protected readonly fD = fD;
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly sgn = sgn;
  protected readonly stSlug = stSlug;
  protected readonly echEtat = echEtat;

  protected readonly d = computed(() => {
    const v = this.vue();
    if (!v) return null;
    const ph = this.phase();
    const ts = v.tasks.filter((t) => t.phase === ph);
    if (!ts.length) return null;
    const S = (f: (t: TacheVue) => number) => sum(ts.map(f));
    const charge = S((t) => t.charge),
      conso = S((t) => t.consoTotal),
      raf = S((t) => t.raf);
    const mn = (l: (string | null | undefined)[]) => l.filter((x): x is string => !!x).sort()[0] ?? null;
    const mx = (l: (string | null | undefined)[]) => l.filter((x): x is string => !!x).sort().slice(-1)[0] ?? null;
    const pF = mx(ts.map((t) => t.tr.fin));
    const td = v.aujourdhui;
    const points: PointAttention[] = (
      [
        { libelle: 'Bloquée / en attente', taches: ts.filter((t) => t.statut === 'Bloqué / En attente'), niveau: 'crit' },
        {
          libelle: 'En retard (fin prévue dépassée)',
          taches: ts.filter((t) => t.statut !== 'Validé' && !!t.tr.fin && t.tr.fin < td).sort((a, b) => (a.tr.fin ?? '').localeCompare(b.tr.fin ?? '')),
          niveau: 'crit',
        },
        { libelle: 'En dépassement de charge', taches: ts.filter((t) => t.consoTotal > t.charge + 1e-9), niveau: 'crit' },
        { libelle: 'Reste à faire à réestimer', taches: ts.filter((t) => t.rafAReestimer), niveau: 'warn' },
      ] satisfies PointAttention[]
    ).filter((p) => p.taches.length > 0);
    const planifiee = (t: TacheVue) => (t.type === 'Livrable' ? !!t.tr.fin : !!(t.tr.debut && t.tr.fin));
    const numero = v.phaseEch[ph];
    return {
      taches: ts,
      charge,
      conso,
      raf,
      atter: conso + raf,
      ecart: conso + raf - charge,
      ajout: S((t) => t.chargeAjout),
      cout: S((t) => (t.coutConso ?? 0) + (t.coutRaf ?? 0)),
      avancement: avancementValide(ts),
      statuts: [...STATUTS, 'Annulée'].map((statut) => ({ statut, n: ts.filter((t) => t.statut === statut).length })).filter((x) => x.n > 0),
      points,
      pD: mn(ts.map((t) => t.tr.debut)),
      pF,
      rD: mn(ts.map((t) => t.consoDates[0])),
      rF: mx(ts.map((t) => t.consoDates[t.consoDates.length - 1])),
      apres: !!(v.m.cal.finPrevue && pF && pF > v.m.cal.finPrevue),
      sansDates: ts.filter((t) => !planifiee(t) && t.statut !== 'Validé' && !t.annulee).length,
      types: v.projet.types
        .map((ty) => {
          const l = ts.filter((t) => t.type === ty.id);
          return { nom: ty.nom, n: l.length, ok: l.filter((t) => t.statut === 'Validé').length };
        })
        .filter((x) => x.n > 0),
      echeance: numero != null ? (v.m.echeancier.find((e) => e.n === numero) ?? null) : null,
      directes: ts.filter((t) => t.tr.ech != null),
    };
  });

  constructor() {
    effect(() => {
      if (this.vue() && !this.d()) this.etat.fermerPanneau();
    });
  }

  protected libelleEcheance(e: EcheanceCalculee): string {
    return `n° ${e.n} — ${e.nom}${e.datePrevue ? ` (${fD(e.datePrevue)})` : ''}${e.payeeLe ? ' · payée' : e.realiseLe ? ' · facturée' : ''}`;
  }

  /** Une phase n'a qu'une échéance ; elle remplace les échéances individuelles de ses tâches (après confirmation). */
  protected async changerEcheance(el: HTMLSelectElement): Promise<void> {
    const d = this.d();
    const v = this.vue();
    if (!d || !v) return;
    const ancien = d.echeance ? String(d.echeance.n) : '';
    const n = el.value ? +el.value : null;
    const ph = this.phase();
    const directes = d.taches.filter((t) => t.tr.ech != null && t.tr.ech !== n);
    if (n != null && directes.length) {
      const ok = await this.etat.confirmer(
        `Lier la phase ${ph} à l’échéance n° ${n} ?`,
        [`${directes.length} tâche(s) de la phase ont une échéance individuelle. Elle sera remplacée par celle de la phase :`],
        'Lier la phase',
        { liste: [...directes.slice(0, 6).map((t) => `${t.label} (n° ${t.tr.ech})`), ...(directes.length > 6 ? ['…'] : [])] },
      );
      if (!ok) {
        el.value = ancien;
        return;
      }
    }
    await this.etat.saisir((id) => this.api.echeancePhase(id, ph, n), { siErreur: () => (el.value = ancien) });
  }
}
