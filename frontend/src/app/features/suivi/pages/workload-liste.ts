import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { AVANCEMENTS, STATUTS } from '../etat/constantes';
import { fD, fDi, fJ, fP, fSigned, sgn, stSlug } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { axeName, couleurGroupe, defaultAxeName, echEtat, filteredTasks, groupByAxe, idName, isOver, TacheVue, typeName, Vue } from '../etat/vue';
import { colonnesListe, VUES_LISTE, vueListe } from '../etat/workload.logique';
import { calculerJaugeGroupe } from '../etat/entete-groupe.logique';
import { EnteteGroupe } from '../ui/entete-groupe';
import { BarreFiltres } from '../ui/barre-filtres';
import { LienTache } from '../ui/tache';
import { Triable } from '../ui/triable';

import { Fx } from '../ui/fx';

/**
 * Workload › Liste des tâches : statut et avancement déclaré modifiables dans le tableau, regroupé par axe, lot ou phase.
 * Trois affichages : Essentiel (lot, phase et type sous le nom de la tâche), Suivi (+ type et dates prévues), Complet (toutes les colonnes).
 */
@Component({
  selector: 'app-workload-liste',
  imports: [NgTemplateOutlet, BarreFiltres, LienTache, Fx, Triable, EnteteGroupe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      <app-barre-filtres>
        <label class="field"
          >Type
          <select class="in" #tf (change)="ui.maj({ typeF: tf.value })">
            <option value="" [selected]="!ui.ui().typeF">Tous</option>
            <option value="__none" [selected]="ui.ui().typeF === '__none'">Sans type</option>
            @for (x of v.projet.types; track x.id) {
              <option [value]="x.id" [selected]="x.id === ui.ui().typeF">{{ x.nom }}</option>
            }
          </select>
        </label>
        <div class="field">
          Affichage
          <div class="seg seg-sm" role="group" aria-label="Colonnes affichées">
            @for (x of vuesListe; track x[0]) {
              <button type="button" [attr.aria-pressed]="m.vueListe === x[0]" [title]="x[2]" (click)="ui.maj({ wlVue: x[0] })">{{ x[1] }}</button>
            }
          </div>
        </div>
        <span class="spacer"></span>
        @if (m.filtre) {
          <span class="chips" [title]="'Totaux des ' + m.liste.length + ' tâche(s) affichée(s)'"
            ><span class="muted">Sélection</span
            ><span
              >Prévu <b>{{ fJ(m.totaux.prevu) }}</b> JH</span
            ><span
              >Consommé <b>{{ fJ(m.totaux.conso) }}</b></span
            ><span
              >RAF <b>{{ fJ(m.totaux.raf) }}</b></span
            ><span
              >Atterrissage <b>{{ fJ(m.totaux.conso + m.totaux.raf) }}</b></span
            ></span
          >
        } @else {
          <span class="chips" title="Totaux du projet"
            ><span
              >Prévu <b>{{ fJ(v.m.total.prevu) }}</b> JH</span
            ><span
              >Consommé <b>{{ fJ(v.m.total.conso) }}</b></span
            ><span
              >RAF <b>{{ fJ(v.m.total.raf) }}</b></span
            ><span
              >Atterrissage <b>{{ fJ(v.m.total.atterrissage) }}</b></span
            ></span
          >
        }
        <app-fx cle="liste" />
        @if (v.droits.peutModifier) {
          <button type="button" class="btn primary" (click)="etat.fenetre.set({ type: 'nouvelle-tache', groupe: null })">+ Nouvelle tâche</button>
        }
      </app-barre-filtres>
      <p class="sub">
        {{ m.vueListe === 'essentiel' ? 'Lot, phase et type sont sous le nom de la tâche ; « Suivi » ajoute les dates prévues, « Complet » toutes les colonnes. ' : '' }}✎ = type corrigé à la
        main.
        {{ m.avecDates ? 'Dates : prévues (le réel est dans le détail de la tâche et le Gantt) ; une fin prévue dépassée est en rouge.' : 'Une fin prévue dépassée est signalée en rouge sous la tâche.' }}
        Cliquez sur un en-tête de colonne pour trier.
      </p>
      <div class="tw tall">
        <table appTriable class="suivi fixw" [class]="'suivi fixw wl-' + m.vueListe">
          <colgroup>
            @for (w of m.largeurs; track $index) {
              <col [style.width.%]="w" />
            }
          </colgroup>
          <thead>
            <tr>
              @if (m.meta) {
                <th>{{ v.m.dim.key === 'lot' ? 'Axe' : 'Lot' }}</th>
                <th>{{ v.m.dim.key === 'phase' ? 'Axe' : 'Phase' }}</th>
              }
              @if (m.avecType) {
                <th>Type</th>
              }
              <th>Tâche</th>
              <th class="n">Prévu</th>
              <th>Statut</th>
              <th>Avancement déclaré</th>
              @if (m.avecDates) {
                <th>Début prévu</th>
                <th>Fin prévue</th>
              }
              <th class="n">Consommé</th>
              <th class="n">RAF</th>
              <th class="n">Écart</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (g of m.groupes; track g.cle) {
              <tr class="grp axg" [style.--axc]="g.couleur">
                <td [attr.colspan]="m.nCols">
                  <app-entete-groupe
                    [nom]="g.nom"
                    [nombreTaches]="g.taches.length"
                    [charge]="g.charge"
                    [jauge]="g.jauge"
                    [replie]="!!ui.ui().groupesReplis[g.cleRepli]"
                    (basculer)="basculerGroupe(g.cleRepli)"
                  >
                    @if (g.phase) {
                      <button type="button" class="grp-name" groupe-nom [attr.data-openph]="g.cle" [title]="'Ouvrir la phase ' + g.cle">{{ g.nom }}</button>
                    } @else if (v.m.dim.key === 'id') {
                      <button type="button" class="grp-name" groupe-nom [title]="'Détails de l’axe ' + g.cle" (click)="etat.ouvrirLignePlanning(g.cle)">{{ g.nom }} <span aria-hidden="true">↗</span></button>
                    } @else if (v.m.dim.key === 'lot' && v.droits.peutModifier) {
                      <button type="button" class="grp-name" groupe-nom [title]="'Renommer le lot ' + g.cle" (click)="etat.fenetre.set({ type: 'lot', code: g.cle })">{{ g.nom }} <span aria-hidden="true">✎</span></button>
                    } @else {
                      <span groupe-nom>{{ g.nom }}</span>
                    }
                    <ng-container groupe-actions>
                      @if (g.phase) {
                        @if (g.echeance; as e) {
                          <button type="button" class="ech-badge" [class]="'ech-badge ech-' + e.etat" [attr.data-openph]="g.cle" title="Échéance de la phase — cliquer pour la modifier">
                            € Échéance n° {{ e.n }} · {{ fD(e.date) }} · {{ e.libelle }}
                          </button>
                        } @else if (g.lienEcheance) {
                          <button type="button" class="grp-add grp-ech" [attr.data-openph]="g.cle" title="Lier toute la phase à une échéance de facturation">€ Échéance</button>
                        }
                      }
                      @if (v.droits.peutModifier) {
                        <button type="button" class="grp-add" [title]="'Créer une tâche dans « ' + g.nom + ' »'" (click)="etat.fenetre.set({ type: 'nouvelle-tache', groupe: g.cle })">+ Tâche</button>
                      }
                    </ng-container>
                  </app-entete-groupe>
                </td>
              </tr>
              @for (t of g.taches; track t.uid) {
                @let finDepassee = !!t.tr.fin && t.statut !== 'Validé' && !t.annulee && t.tr.fin < v.aujourdhui;
                @let dernierCommentaire = v.projet.commentaires?.[t.uid]?.[0];
                <tr class="axr" [hidden]="ui.ui().groupesReplis[g.cleRepli]" [class.is-annul]="t.annulee" [class.is-sel]="etat.panneau() === t.uid" [style.--axc]="g.couleur">
                  @if (m.meta) {
                    <td><ng-container *ngTemplateOutlet="col1; context: { $implicit: t }" /></td>
                    <td>
                      @if (m.colPhase) {
                        <ng-container *ngTemplateOutlet="colPhase; context: { $implicit: t, vide: true }" />
                      } @else {
                        <ng-container *ngTemplateOutlet="pastille; context: { $implicit: t }" />
                      }
                    </td>
                  }
                  @if (m.avecType) {
                    <td><ng-container *ngTemplateOutlet="typeSel; context: { $implicit: t }" /></td>
                  }
                  <td class="lbl wrap-t" [attr.data-sort]="t.label.toLowerCase()">
                    <app-lien-tache [t]="t" />
                    @if (!m.meta) {
                      <div class="t-sous">
                        <ng-container *ngTemplateOutlet="col1; context: { $implicit: t }" />
                        @if (m.colPhase) {
                          @if (t.phase) {
                            <span class="t-sep" aria-hidden="true">·</span>
                            <ng-container *ngTemplateOutlet="colPhase; context: { $implicit: t, vide: false }" />
                          }
                        } @else {
                          <span class="t-sep" aria-hidden="true">·</span>
                          <ng-container *ngTemplateOutlet="pastille; context: { $implicit: t }" />
                        }
                        @if (!m.avecType && (t.type || t.typeManuel)) {
                          <span class="t-sep" aria-hidden="true">·</span>
                          <span class="t-type" [title]="t.typeManuel ? 'Type choisi à la main' : 'Type détecté automatiquement à l’import'"
                            >{{ typeNom(v, t.type) || 'Sans type' }}
                            @if (t.typeManuel) {
                              <span class="man" title="Type choisi à la main">✎</span>
                            }
                          </span>
                        }
                        @if (!m.avecDates && finDepassee) {
                          <span class="t-sep" aria-hidden="true">·</span><span class="neg" title="Fin prévue dépassée">Fin prévue {{ fD(t.tr.fin) }}</span>
                        }
                      </div>
                    }
                  </td>
                  <td class="n">{{ fJ(t.charge) }}</td>
                  <td>
                    @if (t.annulee) {
                      <span class="pill st-annul" [title]="titreAnnulation(t)">Annulée</span>
                    } @else {
                      <select class="in st" [class]="'in st st-' + stSlug(t.statut)" [disabled]="lecture()" #st (change)="statut(t, st)">
                        @for (s of statuts; track s) {
                          <option [value]="s" [selected]="s === t.statut">{{ s }}</option>
                        }
                      </select>
                    }
                  </td>
                  <td>
                    @if (t.annulee) {
                      <span class="muted">—</span>
                    } @else {
                      <span class="avc-cell"
                        ><span class="avc-bar" aria-hidden="true"><i [style.width.%]="round((t.avancement || 0) * 100)"></i></span
                        ><select class="in" [attr.data-f]="t.uid + '|avancement'" [disabled]="lecture()" #av (change)="avancement(t, av)">
                          @for (a of avancements; track a) {
                            <option [value]="a" [selected]="egal(a, t.avancement)">{{ fP(a) }}</option>
                          }
                        </select></span
                      >
                    }
                  </td>
                  @if (m.avecDates) {
                    <td class="num">
                      @if (t.tr.debut) {
                        {{ fD(t.tr.debut) }}
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="num">
                      @if (t.tr.fin) {
                        <span [class.neg]="finDepassee">{{ fD(t.tr.fin) }}</span>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                  }
                  <td class="n">
                    <span [class.over]="isOver(t)">{{ fJ(t.consoTotal) }}</span>
                  </td>
                  <td class="n" [attr.data-sort]="t.raf">
                    <span>{{ fJ(t.raf) }}</span>
                    @if (t.rafAReestimer) {
                      <button type="button" class="badge-crit" [attr.data-open]="t.uid" title="Budget consommé mais tâche non validée : indiquez le reste à faire réel">
                        à réestimer
                      </button>
                    } @else if (t.rafIncoherent) {
                      <button type="button" class="warn-ic" [attr.data-open]="t.uid" [title]="'RAF suggéré selon l’avancement : ' + fJ(t.rafSuggere) + ' JH'">⚠</button>
                    }
                    @if (t.rafSaisi != null) {
                      <span class="auto">saisi</span>
                    }
                  </td>
                  <td class="n">
                    <span data-ecart [class]="sgn(t.ecart)">{{ fSigned(t.ecart) }}</span>
                  </td>
                  <td>
                    @if (dernierCommentaire || t.commentaire) {
                      <button type="button" class="cmt" [attr.data-open]="t.uid" [title]="dernierCommentaire?.texte || t.commentaire" [attr.aria-label]="'Ouvrir les commentaires de ' + t.label">💬</button>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td [attr.colspan]="m.nCols" class="empty">Aucune tâche ne correspond au filtre. <button type="button" class="btn sm" (click)="ui.effacerFiltres()">Effacer les filtres</button></td>
              </tr>
            }
          </tbody>
          @if (m.liste.length) {
            <tfoot>
              <tr class="wl-total">
                @if (m.nAvant) {
                  <td [attr.colspan]="m.nAvant"></td>
                }
                <td class="lbl">Total des {{ m.liste.length }} tâche{{ m.liste.length > 1 ? 's' : '' }} affichée{{ m.liste.length > 1 ? 's' : '' }}</td>
                <td class="n">{{ fJ(m.totaux.prevu) }}</td>
                <td></td>
                <td></td>
                @if (m.avecDates) {
                  <td></td>
                  <td></td>
                }
                <td class="n">{{ fJ(m.totaux.conso) }}</td>
                <td class="n">{{ fJ(m.totaux.raf) }}</td>
                <td class="n"><span [class]="sgn(m.totaux.ecart)" data-ecart>{{ fSigned(m.totaux.ecart) }}</span></td>
                <td></td>
              </tr>
            </tfoot>
          }
        </table>
      </div>

      <!-- colonne « Lot » (ou « Axe » en regroupement par lot) : en colonne (Complet) ou sous le nom de la tâche -->
      <ng-template #col1 let-t>
        @if (t.id || t.tr.axe) {
          @if (v.m.dim.key === 'lot') {
            <ng-container *ngTemplateOutlet="pastille; context: { $implicit: t }" />
          } @else {
            @let lot = t.lot ? (v.projet.lots?.[t.lot] ? 'Lot ' + t.lot + ' – ' + v.projet.lots?.[t.lot] : 'Lot ' + t.lot) : defaultAxeName(t.id || t.tr.axe || '');
            <span class="muted ell" [title]="t.lot || ''">{{ lot }}</span>
          }
        } @else {
          <select class="in" title="Affecter un axe" [disabled]="lecture()" #ax (change)="classement(t, 'axe', ax, '')">
            <option value="" selected>— Choisir un axe —</option>
            @for (x of v.axeIds; track x) {
              <option [value]="x">{{ nomAxe(v, x) }}</option>
            }
          </select>
          <span class="flag">Sans axe</span>
        }
      </ng-template>

      <ng-template #colPhase let-t let-vide="vide">
        @if (t.phase) {
          <button type="button" class="cell-ph" [attr.data-openph]="t.phase" [title]="'Ouvrir la phase ' + t.phase">
            {{ t.phase }}
            @if (t.echViaPhase) {
              <span class="eur-dot" title="Phase liée à une échéance de facturation">€</span>
            }
          </button>
        } @else if (vide) {
          <span class="muted">—</span>
        }
      </ng-template>

      <!-- pastille de l'axe (colonne A), de la couleur de l'axe : quand on regroupe par phase ou par lot -->
      <ng-template #pastille let-t>
        @if (t.axe) {
          <span class="axp" [style.--axc]="couleurAxe(v, t.axe)" [title]="nomAxe(v, t.axe)">{{ t.axe === '0' ? 'Pilotage' : defaultAxeName(t.axe) }}</span>
        } @else {
          <span class="muted">—</span>
        }
      </ng-template>

      <ng-template #typeSel let-t>
        <span class="typecell"
          ><select
            class="in type-sel"
            [title]="t.typeManuel ? 'Type choisi à la main' : 'Type détecté automatiquement à l’import'"
            [disabled]="lecture()"
            #ty
            (change)="classement(t, 'type', ty, t.type)"
          >
            <option value="" [selected]="!t.type">—</option>
            @for (x of v.projet.types; track x.id) {
              <option [value]="x.id" [selected]="x.id === t.type">{{ x.nom }}</option>
            }
          </select>
          @if (t.typeManuel) {
            <span class="man" title="Type choisi à la main">✎</span>
          }
        </span>
      </ng-template>
    }
  `,
  styles: `
    :host { display: contents; }
    .grp-fold { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; margin-right: 4px; border: 0; background: transparent; color: inherit; cursor: pointer; }
    .grp-fold svg { width: 14px; height: 14px; transition: transform 120ms ease; }
    .grp-fold[aria-expanded="false"] svg { transform: rotate(-90deg); }
    .grp-jauge { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; font-size: 11px; color: var(--c-texte-2, #667085); white-space: nowrap; }
    .grp-jauge-bar { display: inline-block; width: 42px; height: 5px; border-radius: 5px; overflow: hidden; background: var(--c-neutre-fond, #e4e8f0); }
    .grp-jauge-bar i { display: block; height: 100%; background: var(--c-ok, #3fb97c); }
    .grp-jauge-ok { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 50%; color: #147d4b; background: #d9f5e5; font-weight: 700; }
  `,
})
export class WorkloadListe {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);

  protected readonly statuts = STATUTS;
  protected readonly avancements = AVANCEMENTS;
  protected readonly fD = fD;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly sgn = sgn;
  protected readonly stSlug = stSlug;
  protected readonly isOver = isOver;
  protected readonly defaultAxeName = defaultAxeName;
  protected readonly nomAxe = idName;
  protected readonly typeNom = typeName;
  protected readonly vuesListe = VUES_LISTE;
  protected readonly round = Math.round;
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    const liste = filteredTasks(v, u).filter((t) => !u.typeF || (u.typeF === '__none' ? !t.type : t.type === u.typeF));
    const colPhase = v.m.dim.key !== 'phase';
    const groupes = groupByAxe(v, liste).map(([cle, taches]) => groupe(v, cle, taches));
    const vl = vueListe(u.wlVue);
    return {
      v,
      liste,
      groupes,
      colPhase,
      vueListe: vl,
      ...colonnesListe(vl, v.m.dim.key),
      filtre: liste.length !== v.tasks.length,
      totaux: {
        prevu: sum(liste.map((t) => t.charge)),
        conso: sum(liste.map((t) => t.consoTotal)),
        raf: sum(liste.map((t) => t.raf)),
        ecart: sum(liste.map((t) => t.ecart)),
      },
    };
  });

  /** Couleur de la pastille d'un axe (colonne A) : rang de l'axe parmi les axes portés par une tâche. */
  protected couleurAxe(v: Vue, axe: string): string {
    return `var(--ax${Math.max(0, (v.m.axeIdsActifs ?? []).indexOf(axe)) % 8})`;
  }

  protected basculerGroupe(cle: string): void {
    const groupesReplis = { ...this.ui.ui().groupesReplis };
    if (groupesReplis[cle]) delete groupesReplis[cle];
    else groupesReplis[cle] = true;
    this.ui.maj({ groupesReplis });
  }

  protected egal(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-9;
  }

  protected titreAnnulation(t: TacheVue): string {
    return `Annulée le ${fDi(t.annul?.at)}${t.annul?.motif ? ' — ' + t.annul.motif : ''}`;
  }

  protected statut(t: TacheVue, el: HTMLSelectElement): void {
    const ancien = t.statut;
    void this.etat.saisir((id) => this.api.statut(id, t.uid, el.value, this.etat.versionTache(t.uid)), { siErreur: () => (el.value = ancien) });
  }

  protected avancement(t: TacheVue, el: HTMLSelectElement): void {
    const ancien = String(t.avancement);
    void this.etat.saisir((id) => this.api.avancement(id, t.uid, +el.value, this.etat.versionTache(t.uid)), { siErreur: () => (el.value = ancien) });
  }

  protected classement(t: TacheVue, champ: 'type' | 'axe', el: HTMLSelectElement, ancien: string): void {
    void this.etat.saisir((id) => this.api.classement(id, t.uid, champ, el.value, this.etat.versionTache(t.uid)), { siErreur: () => (el.value = ancien) });
  }
}

/** En-tête de groupe : nom, couleur et, en regroupement par phase, l'échéance de la phase. */
function groupe(v: Vue, cle: string, taches: TacheVue[]) {
  const phase = v.m.dim.key === 'phase' && !!cle;
  const numero = phase ? v.phaseEch[cle] : undefined;
  const e = numero != null ? v.m.echeancier.find((x) => x.n === numero) : undefined;
  const montants = v.droits.voitMontants && v.m.echeancier.length > 0;
  return {
    cle,
    cleRepli: `${v.m.dim.key}|${cle}`,
    nom: axeName(v, cle),
    couleur: couleurGroupe(v, cle),
    taches,
    jauge: calculerJaugeGroupe(taches),
    charge: sum(taches.map((t) => t.charge)),
    phase,
    lienEcheance: phase && montants,
    echeance: phase && montants && e ? { n: e.n, date: e.datePrevue, etat: echEtat(v, e)[0], libelle: echEtat(v, e)[1] } : null,
  };
}
