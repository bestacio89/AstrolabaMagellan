import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EcheanceCalculee } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { fD, fE, fJ, fP, fSignedE } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { echEtat, Vue } from '../etat/vue';
import { Carte } from '../ui/cartes';
import { MiniBarre } from '../ui/petits';

/**
 * Facturation : échéances du contrat (date prévue, facture émise, paiement reçu, périmètre qui conditionne la facture)
 * et factures à établir (FAE). Un montant facturé est figé (un avenant se reporte sur les échéances non facturées).
 */
@Component({
  selector: 'app-facturation',
  imports: [RouterLink, Carte, MiniBarre],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Facturation</h2>
        <p>Échéances du contrat : date prévue, facture émise, paiement reçu et travail qui conditionne chaque échéance. En dessous, les factures à établir (FAE).</p>
      </div>
    </div>
    @if (vm(); as m) {
      @let v = m.v;
      @let Sy = v.m.echSynth;
      @if (!m.lignes.length) {
        <div class="card empty">Aucune échéance dans le TSP.</div>
      } @else {
        @if (m.sansDate) {
          <div class="banner warn">
            <div><b>Dates prévues manquantes.</b> {{ m.sansDate }} échéance(s) sans mois dans le TSP : renseignez leur date prévue ci-dessous.</div>
          </div>
        }
        @if (abs(m.totalPct - 1) > 0.001) {
          <div class="banner warn">
            <div>Le total des pourcentages des échéances vaut {{ fP(m.totalPct) }} au lieu de 100 %.</div>
          </div>
        }
        <app-carte titre="Échéances">
          <span sous-titre
            >Saisissez la date de facture puis la date de paiement. Liez une phase ou des tâches pour suivre le travail qui conditionne la facture. Alerte au tableau de bord
            {{ v.alerteEcheances }} jour(s) avant la date prévue (⚙ Paramètres du projet).
            @if (abs(Sy?.ajustAvenant ?? 0) > 0.5) {
              Avenant : {{ fSignedE(Sy?.ajustAvenant ?? 0) }} au total{{
                m.ajustFacture ? ', dont ' + fSignedE(m.ajustFacture) + ' déjà intégrés aux factures émises' : ''
              }}
              ; le reste est réparti sur les échéances non encore facturées.
            }
          </span>
          <span extra class="chips"
            ><span
              >Facturées <b>{{ m.nbFacturees }} / {{ m.lignes.length }}</b></span
            ><span
              >Facturé <b>{{ fE(Sy?.facture) }}</b></span
            ><span
              >Payé <b>{{ fE(Sy?.paye) }}</b></span
            ><span
              >Reste à facturer <b>{{ fE(Sy?.reste) }}</b></span
            ></span
          >
          <div class="tw">
            <table class="echt fixw">
              <colgroup>
                @for (w of largeurs; track $index) {
                  <col [style.width.%]="w" />
                }
              </colgroup>
              <thead>
                <tr>
                  <th class="n">N°</th>
                  <th>Échéance</th>
                  <th class="n">Montant</th>
                  <th>Date prévue</th>
                  <th>Facturée le</th>
                  <th>Payée le</th>
                  <th>Statut</th>
                  <th>Périmètre lié</th>
                </tr>
              </thead>
              <tbody>
                @for (e of m.lignes; track e.n) {
                  @let et = etat2(v, e);
                  <tr [class]="'ech-' + et[0]">
                    <td class="n">{{ e.n }}</td>
                    <td class="lbl wrap-t">
                      <b>{{ e.nom }}</b>
                    </td>
                    <td class="n">
                      {{ fE(e.montant) }}
                      @if (e.realiseLe) {
                        <small class="muted" style="display: block" title="Montant de la facture émise : il ne change plus (un avenant se reporte sur les échéances non facturées)"
                          >{{ fP(e.pct) }} · 🔒 figé à la facture</small
                        >
                      } @else if (abs(e.ajustAvenant ?? 0) > 0.5) {
                        <small class="muted" style="display: block" title="Part de l’avenant répartie sur cette échéance non facturée"
                          >{{ fP(e.pct) }} · avenant {{ fSignedE(e.ajustAvenant ?? 0) }}</small
                        >
                      } @else {
                        <small class="muted" style="display: block">{{ fP(e.pct) }}</small>
                      }
                    </td>
                    <td>
                      <input
                        class="in w-date"
                        type="date"
                        [attr.aria-label]="'Date prévue de l’échéance ' + e.n"
                        [value]="e.datePrevue ?? ''"
                        [disabled]="lecture()"
                        #dp
                        (change)="date(e, 'datePrevue', dp, e.datePrevue)"
                      />
                      @if (e.datePrevueAuto && e.datePrevue) {
                        <span class="auto">fin du mois prévu au TSP</span>
                      }
                    </td>
                    <td>
                      <input
                        class="in w-date"
                        type="date"
                        [attr.aria-label]="'Échéance ' + e.n + ' facturée le'"
                        [value]="e.realiseLe ?? ''"
                        [disabled]="lecture()"
                        #rl
                        (change)="date(e, 'realiseLe', rl, e.realiseLe)"
                      />
                    </td>
                    <td>
                      <input
                        class="in w-date"
                        type="date"
                        [attr.aria-label]="'Échéance ' + e.n + ' payée le'"
                        [value]="e.payeeLe ?? ''"
                        [disabled]="lecture() || !e.realiseLe"
                        [title]="e.realiseLe ? '' : 'Indiquez d’abord la date de facturation'"
                        #pl
                        (change)="date(e, 'payeeLe', pl, e.payeeLe)"
                      />
                    </td>
                    <td>
                      <span class="pill" [class]="'pill ech-p-' + et[0]">{{ et[1] }}</span>
                      @if (e.apresFin && !e.realiseLe) {
                        <span class="tag-warn" title="La date prévue tombe après la fin prévue du projet">après la fin du projet</span>
                      }
                    </td>
                    <td>
                      <div class="perim">
                        @if (perimetre(v, e); as p) {
                          @if (p.phases.length || p.directes) {
                            <div class="perim-chips">
                              @for (ph of p.phases; track ph) {
                                <button type="button" class="chip-ph" [attr.data-openph]="ph" [title]="'Ouvrir la phase ' + ph">{{ ph }}</button>
                              }
                              @if (p.directes) {
                                <span class="chip-t">{{ p.directes }} tâche(s)</span>
                              }
                            </div>
                            <div class="perim-av">
                              <app-mini-barre [valeur]="e.avLie" /><span>{{ fP(e.avLie ?? 0) }}</span>
                              @if (e.pret && !e.realiseLe) {
                                <span class="tag-ok">Prête à facturer</span>
                              }
                            </div>
                          } @else {
                            <span class="muted">Aucun périmètre lié</span>
                          }
                          @if (!lecture()) {
                            <button type="button" class="btn sm" [class.hov]="!p.phases.length && !p.directes" (click)="etat.fenetre.set({ type: 'lien-echeance', numero: e.n })">
                              {{ p.phases.length || p.directes ? 'Modifier' : 'Lier…' }}
                            </button>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="legend ech-leg">
            <span><i class="ech-sw ok"></i>Payée</span><span><i class="ech-sw fact"></i>Facturée</span><span><i class="ech-sw warn"></i>Échéance proche</span
            ><span><i class="ech-sw crit"></i>En retard</span><span><i class="ech-sw plan"></i>Planifiée</span>
          </div>
        </app-carte>

        <app-carte
          titre="Factures à établir (FAE)"
          sousTitre="FAE = valeur produite cumulée − montant facturé cumulé, à la date de chaque échéance. Une FAE négative signifie que la facturation est en avance sur la production. Le réel est calculé à la date de facture, ou en fin de mois pour les mois écoulés."
        >
          <span extra class="chips"
            ><span
              >Produit à date <b>{{ fE(Sy?.produit) }}</b></span
            ><span
              >FAE à date <b [class]="classeFae(Sy?.faeADate)">{{ fE(Sy?.faeADate) }}</b></span
            ></span
          >
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th class="n">N°</th>
                  <th>Échéance</th>
                  <th>Date prévue</th>
                  <th class="n">Montant</th>
                  <th class="n">Facturé cumulé prévu</th>
                  <th class="n">Produit prévu</th>
                  <th class="n">FAE prévue</th>
                  <th class="n">FAE prévue (%)</th>
                  <th class="n">Facturé réel</th>
                  <th class="n">Produit réel</th>
                  <th class="n">FAE réelle</th>
                  <th class="n">FAE réelle (%)</th>
                </tr>
              </thead>
              <tbody>
                @for (e of m.fae; track e.n) {
                  <tr>
                    <td class="n">{{ e.n }}</td>
                    <td class="lbl wrap-t">{{ e.nom }}</td>
                    <td>{{ fD(e.datePrevue) }}</td>
                    <td class="n">{{ fE(e.montant) }}</td>
                    <td class="n">{{ fE(e.factCum) }}</td>
                    <td class="n">{{ e.prodPlan == null ? '—' : fE(e.prodPlan) }}</td>
                    <td class="n">
                      <span [class]="classeFae(e.faePlan)">{{ e.faePlan == null ? '—' : fE(e.faePlan) }}</span>
                    </td>
                    <td class="n">
                      <span class="fae-pct" [class]="'fae-pct ' + classePct(e.faePlanPct)" [title]="titrePct(e.faePlanPct)">{{ pct(e.faePlanPct) }}</span>
                    </td>
                    <td class="n">{{ e.factReel == null ? '—' : fE(e.factReel) }}</td>
                    <td class="n">{{ e.prodReel == null ? '—' : fE(e.prodReel) }}</td>
                    <td class="n">
                      <span [class]="classeFae(e.faeReel)">{{ e.faeReel == null ? '—' : fE(e.faeReel) }}</span>
                    </td>
                    <td class="n">
                      <span class="fae-pct" [class]="'fae-pct ' + classePct(e.faeReelPct)" [title]="titrePct(e.faeReelPct)">{{ pct(e.faeReelPct) }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="note">
            « Produit prévu » : planning du TSP valorisé au TJM. « Produit réel » : consommé saisi valorisé au TJM. « FAE (%) » = − FAE ÷ montant total des échéances, même
            base pour toutes les lignes (le TSP change de base à partir de la 4ᵉ ligne). Couleurs : <span class="fae-e f-warn">orange</span> = production en avance, factures à
            établir ; <span class="fae-e f-ok">vert</span> = facturation en avance sur la production.
            @if (abs(v.m.total.prevu - v.m.refTotal) > 0.001) {
              Le planning du TSP ne ventile que {{ fJ(v.m.refTotal) }} JH sur {{ fJ(v.m.total.prevu) }} JH prévus : les {{ fJ(v.m.total.prevu - v.m.refTotal) }} JH non
              ventilés n’entrent pas dans le « produit prévu », d’où une FAE prévue négative en fin de projet (<a class="linkbtn" routerLink="../planning">Annexes › Planning</a>).
            }
          </p>
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
export class Facturation {
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fSignedE = fSignedE;
  protected readonly abs = Math.abs;
  protected readonly etat2 = echEtat;
  protected readonly largeurs = [4, 17.5, 11, 11.5, 11.5, 11.5, 12, 21];
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const E = v.m.echeancier;
    return {
      v,
      lignes: E,
      sansDate: E.filter((e) => !e.datePrevue).length,
      totalPct: sum(E.map((e) => e.pct)),
      nbFacturees: E.filter((e) => e.realiseLe).length,
      ajustFacture: E.some((e) => e.realiseLe && Math.abs(e.ajustAvenant ?? 0) > 0.5) ? sum(E.filter((e) => e.realiseLe).map((e) => e.ajustAvenant ?? 0)) : 0,
      fae: [...E].sort((a, b) => String(a.datePrevue || '9999').localeCompare(String(b.datePrevue || '9999'))),
    };
  });

  /** Phases liées à l'échéance et nombre de tâches liées directement. */
  protected perimetre(v: Vue, e: EcheanceCalculee): { phases: string[]; directes: number } {
    return {
      phases: e.phases.filter((ph) => v.phaseEch[ph] === e.n),
      directes: e.lies.filter((uid) => !v.parUid.get(uid)?.echViaPhase).length,
    };
  }

  /** FAE en € : orange = factures à établir (production en avance), vert = facturation en avance. */
  protected classeFae(x: number | null | undefined): string {
    return x == null ? '' : x > 0.5 ? 'fae-e f-warn' : x < -0.5 ? 'fae-e f-ok' : '';
  }

  protected classePct(x: number | null | undefined): string {
    return x == null ? '' : x < -0.0005 ? 'f-warn' : x > 0.0005 ? 'f-ok' : '';
  }

  protected titrePct(x: number | null | undefined): string {
    return x == null ? '' : x < 0 ? 'Production en avance sur la facturation : factures à établir' : 'Facturation en avance sur la production';
  }

  protected pct(x: number | null | undefined): string {
    return x == null ? '—' : (x * 100).toFixed(2).replace('.', ',') + ' %';
  }

  /** Dates d'une échéance : facture et paiement ni dans le futur, ni dans le désordre (contrôles repris du serveur). */
  protected date(e: EcheanceCalculee, champ: 'datePrevue' | 'realiseLe' | 'payeeLe', el: HTMLInputElement, ancien: string | null): void {
    const v = this.etat.vue();
    if (!v) return;
    const valeur = el.value || null;
    const remettre = () => (el.value = ancien ?? '');
    if ((champ === 'realiseLe' || champ === 'payeeLe') && valeur && valeur > v.aujourdhui) {
      remettre();
      this.etat.afficher(
        `Date dans le futur : indiquez la date réelle ${champ === 'realiseLe' ? 'd’émission de la facture' : 'du paiement'}. Saisie annulée.`,
        'erreur',
      );
      return;
    }
    if (champ === 'payeeLe' && valeur && e.realiseLe && valeur < e.realiseLe) {
      remettre();
      this.etat.afficher(`Le paiement ne peut pas précéder la facture (${fD(e.realiseLe)}) : saisie annulée.`, 'erreur');
      return;
    }
    if (champ === 'realiseLe' && valeur && e.payeeLe && e.payeeLe < valeur) {
      remettre();
      this.etat.afficher(`La facture ne peut pas être postérieure au paiement (${fD(e.payeeLe)}) : saisie annulée.`, 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.dateEcheance(id, e.n, champ, valeur, this.etat.versionEcheance(e.n)), { siErreur: remettre });
  }
}
