import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { AVANCEMENTS, STATUTS } from '../etat/constantes';
import { fD, fDi, fJ, fP, fSigned, sgn, stSlug } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { axeName, couleurGroupe, defaultAxeName, echEtat, filteredTasks, groupByAxe, idName, isOver, TacheVue, Vue } from '../etat/vue';
import { BarreFiltres } from '../ui/barre-filtres';
import { LienTache } from '../ui/tache';

/** Workload › Liste des tâches : statut et avancement modifiables dans le tableau, regroupé par axe, lot ou phase. */
import { Fx } from '../ui/fx';
@Component({
  selector: 'app-workload-liste',
  imports: [BarreFiltres, LienTache, Fx],
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
      <p class="sub">✎ = type corrigé à la main. Dates : prévues (le réel est dans le détail de la tâche et le Gantt) ; une fin prévue dépassée est en rouge.</p>
      <div class="tw tall">
        <table class="suivi fixw">
          <colgroup>
            @for (w of m.largeurs; track $index) {
              <col [style.width.%]="w" />
            }
          </colgroup>
          <thead>
            <tr>
              <th>Lot</th>
              @if (m.colPhase) {
                <th>Phase</th>
              }
              <th>Type</th>
              <th>Tâche</th>
              <th class="n">Prévu</th>
              <th>Statut</th>
              <th>Avancement</th>
              <th>Début prévu</th>
              <th>Fin prévue</th>
              <th class="n">Consommé</th>
              <th class="n">RAF</th>
              <th class="n">Écart</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (g of m.groupes; track g.cle) {
              <tr class="grp axg" [style.--axc]="g.couleur">
                <td [attr.colspan]="m.colPhase ? 13 : 12">
                  <div class="grp-h">
                    @if (g.phase) {
                      <button type="button" class="grp-name" [attr.data-openph]="g.cle" [title]="'Ouvrir la phase ' + g.cle">{{ g.nom }}</button>
                      @if (g.echeance; as e) {
                        <button type="button" class="ech-badge" [class]="'ech-badge ech-' + e.etat" [attr.data-openph]="g.cle" title="Échéance de la phase — cliquer pour la modifier">
                          € Échéance n° {{ e.n }} · {{ fD(e.date) }} · {{ e.libelle }}
                        </button>
                      } @else if (g.lienEcheance) {
                        <button type="button" class="grp-add grp-ech" [attr.data-openph]="g.cle" title="Lier toute la phase à une échéance de facturation">€ Échéance</button>
                      }
                    } @else {
                      {{ g.nom }}
                    }
                    @if (v.droits.peutModifier) {
                      <button
                        type="button"
                        class="grp-add"
                        [title]="'Créer une tâche dans « ' + g.nom + ' »'"
                        (click)="etat.fenetre.set({ type: 'nouvelle-tache', groupe: g.cle })"
                      >
                        + Tâche
                      </button>
                    }
                  </div>
                </td>
              </tr>
              @for (t of g.taches; track t.uid) {
                <tr class="axr" [class.is-annul]="t.annulee" [class.is-sel]="etat.panneau() === t.uid" [style.--axc]="g.couleur">
                  <td>
                    @if (t.id || t.tr.axe) {
                      @let lot = t.lot || defaultAxeName(t.id || t.tr.axe || '');
                      <span class="muted ell" [title]="lot">{{ lot }}</span>
                    } @else {
                      <select class="in" title="Affecter un axe" [disabled]="lecture()" #ax (change)="classement(t, 'axe', ax, '')">
                        <option value="" selected>— Choisir un axe —</option>
                        @for (x of v.axeIds; track x) {
                          <option [value]="x">{{ nomAxe(v, x) }}</option>
                        }
                      </select>
                      <span class="flag">Sans axe</span>
                    }
                  </td>
                  @if (m.colPhase) {
                    <td>
                      @if (t.phase) {
                        <button type="button" class="cell-ph" [attr.data-openph]="t.phase" [title]="'Ouvrir la phase ' + t.phase">
                          {{ t.phase }}
                          @if (t.echViaPhase) {
                            <span class="eur-dot" title="Phase liée à une échéance de facturation">€</span>
                          }
                        </button>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                  }
                  <td>
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
                  </td>
                  <td class="lbl wrap-t"><app-lien-tache [t]="t" /></td>
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
                      <select class="in" [disabled]="lecture()" #av (change)="avancement(t, av)">
                        @for (a of avancements; track a) {
                          <option [value]="a" [selected]="egal(a, t.avancement)">{{ fP(a) }}</option>
                        }
                      </select>
                    }
                  </td>
                  <td class="num">
                    @if (t.tr.debut) {
                      {{ fD(t.tr.debut) }}
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td class="num">
                    @if (t.tr.fin) {
                      <span [class.neg]="t.statut !== 'Validé' && !t.annulee && t.tr.fin < v.aujourdhui">{{ fD(t.tr.fin) }}</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td class="n">
                    <span [class.over]="isOver(t)">{{ fJ(t.consoTotal) }}</span>
                  </td>
                  <td class="n">
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
                    <span [class]="sgn(t.ecart)">{{ fSigned(t.ecart) }}</span>
                  </td>
                  <td>
                    @if (t.commentaire) {
                      <button type="button" class="cmt" [attr.data-open]="t.uid" [title]="t.commentaire">💬</button>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="13" class="empty">Aucune tâche ne correspond au filtre.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
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
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    const liste = filteredTasks(v, u).filter((t) => !u.typeF || (u.typeF === '__none' ? !t.type : t.type === u.typeF));
    const colPhase = v.m.dim.key !== 'phase';
    const groupes = groupByAxe(v, liste).map(([cle, taches]) => groupe(v, cle, taches));
    return {
      v,
      liste,
      groupes,
      colPhase,
      filtre: liste.length !== v.tasks.length,
      totaux: { prevu: sum(liste.map((t) => t.charge)), conso: sum(liste.map((t) => t.consoTotal)), raf: sum(liste.map((t) => t.raf)) },
      largeurs: colPhase ? [8, 9.5, 8, 16.5, 4.5, 10, 7, 7, 7, 7, 8, 4.5, 3] : [9, 8, 25, 4.5, 10, 7, 7, 7, 7, 8, 4.5, 3],
    };
  });

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
    nom: axeName(v, cle),
    couleur: couleurGroupe(v, cle),
    taches,
    phase,
    lienEcheance: phase && montants,
    echeance: phase && montants && e ? { n: e.n, date: e.datePrevue, etat: echEtat(v, e)[0], libelle: echEtat(v, e)[1] } : null,
  };
}
