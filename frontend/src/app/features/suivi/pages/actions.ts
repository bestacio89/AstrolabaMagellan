import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Action, Decision, Risque } from '../api/modeles';
import { Registre, SuiviApi } from '../api/suivi.api';
import { DEC_ST, RISK_IMPACT, RISK_IMPACT_DEF, RISK_PROBA, RISK_PROBA_DEF, RISK_TYPES, riskNiveau } from '../etat/constantes';
import { messageErreurFichier, telecharger } from '../etat/fichiers';
import { fD, stCls } from '../etat/formats';
import { addDays, joursEntre } from '../etat/outils';
import { enRetard, extrait, FiltresRegistres, initiales, instancesDuProjet, listesRegistres, ouverte, personnes, personnesDe, refCourte, relatif } from '../etat/registres.logique';
import { PANNEAU_REGISTRE, SuiviEtat } from '../etat/suivi.etat';
import { EtatUi, UiEtat } from '../etat/ui.etat';
import { Fx } from '../ui/fx';
import { Triable } from '../ui/triable';

/** Icônes des types de risque (Retard = calendrier, Qualité = coches, Budget = euro). */
export const RK_ICO: Record<string, string[]> = {
  Retard: ['M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 10h18M8 3v4M16 3v4'],
  Qualité: ['M4 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0', 'M14 4l6 6M20 4l-6 6M5 14l5 5M10 14l-5 5M17 14v6M14 17h6'],
  Budget: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M15.5 8.5a4 4 0 1 0 0 7M7 11h6M7 13.5h6'],
};

/** Libellé et classe du niveau d'une criticité. */
export function niveauRisque(crit: number): [string, string] {
  return ({ fort: ['critique', 'Fort'], moyen: ['attention', 'Moyen'], faible: ['ok', 'Faible'] } as const)[riskNiveau(crit)].slice() as [string, string];
}

/**
 * Actions & décisions (version HTML de référence, 55b-registres.js) : actions à mener, décisions prises en comité et risques du projet.
 * Une liste lisible (une ligne = un élément : quoi, qui, pour quand, où en est-on) ; un clic ouvre le panneau latéral pour tout modifier.
 * Filtres : texte, statut, personne (une personne même quand plusieurs sont nommées), date cible ou date, instance.
 * « Exporter (Excel) » : les trois registres, une feuille chacun.
 */
@Component({
  selector: 'app-actions',
  imports: [NgTemplateOutlet, Fx, Triable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      @let u = ui.ui();
      <div class="sechead">
        <div>
          <h2>Actions & décisions</h2>
          <p>
            Actions à mener, décisions prises en comité et risques du projet. Cliquez sur une ligne pour l’ouvrir et la modifier ; tout est repris dans les exports
            COPROJ et COPIL. <app-fx cle="registres" />
          </p>
        </div>
        <div class="ad-tete-d">
          <button type="button" class="btn sm" title="Les trois registres (actions, décisions, risques) dans un fichier Excel, une feuille chacun" [disabled]="exportEnCours()" (click)="exporter()">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" /></svg
            >Exporter (Excel)
          </button>
          <div class="seg" role="group" aria-label="Registre">
            <button type="button" [attr.aria-pressed]="m.vue === 'actions'" (click)="ui.maj({ ad: 'actions' })">Actions ({{ m.ouvertes }})</button>
            <button type="button" [attr.aria-pressed]="m.vue === 'decisions'" (click)="ui.maj({ ad: 'decisions' })">Décisions ({{ v.projet.decisions.length }})</button>
            <button type="button" [attr.aria-pressed]="m.vue === 'risques'" (click)="ui.maj({ ad: 'risques' })">Risques ({{ v.risquesOuverts.length }})</button>
          </div>
        </div>
      </div>

      @switch (m.vue) {
        @case ('actions') {
          <div class="ad-kpis">
            <button type="button" class="ad-kpi" [class.on]="(u.adf || 'ouvertes') === 'ouvertes' && !u.adEch" [attr.aria-pressed]="(u.adf || 'ouvertes') === 'ouvertes' && !u.adEch" (click)="kpi('ouvertes')">
              <span>Ouvertes</span><b>{{ m.ouvertes }}</b>
            </button>
            <button type="button" class="ad-kpi" [class.on]="u.adEch === 'retard'" [attr.aria-pressed]="u.adEch === 'retard'" (click)="kpi('retard')">
              <span>En retard</span><b [class.neg]="m.retard > 0">{{ m.retard }}</b>
            </button>
            <button type="button" class="ad-kpi" [class.on]="u.adEch === 'semaine'" [attr.aria-pressed]="u.adEch === 'semaine'" (click)="kpi('sous')">
              <span>Date cible sous {{ v.alerteActions }} j</span><b>{{ m.bientot }}</b>
            </button>
            <span class="spacer"></span>
            @if (m.modif) {
              <button type="button" class="btn primary" (click)="creer('actions')">+ Nouvelle action</button>
            }
          </div>
          <div class="toolbar ad-filtres">
            <ng-container *ngTemplateOutlet="recherche; context: { $implicit: 'Réf., texte, commentaire, personne' }" />
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'adf', lib: 'Statut', opts: optsStatutAct, val: u.adf || 'ouvertes' }" />
            <ng-container *ngTemplateOutlet="choixPers; context: { cle: 'adp', lib: 'Responsable', liste: m.persAct, val: u.adp }" />
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'adEch', lib: 'Date cible', opts: optsEch, val: u.adEch }" />
            @if (u.adEch === 'periode') {
              <ng-container *ngTemplateOutlet="periode" />
            }
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'adInst', lib: 'Instance', opts: m.optsInst, val: u.adInst }" />
            @if (m.filtresAct) {
              <button type="button" class="linkbtn ad-raz" (click)="raz('actions')">Effacer les filtres</button>
            }
            <span class="spacer"></span><span class="ad-nb">{{ m.l.actions.length }} action{{ m.l.actions.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="ad-wrap">
            <table appTriable class="t ad-liste ad-act">
              <thead>
                <tr>
                  <th class="c-ref">Réf.</th>
                  <th class="c-txt">Action</th>
                  <th class="c-pers">Responsable</th>
                  <th class="c-date">Date cible</th>
                  <th class="c-st">Statut</th>
                </tr>
              </thead>
              <tbody>
                @for (a of m.l.actions; track a.id) {
                  @let retard = enRetard(a, v.aujourdhui);
                  @let t = a.tache ? v.parUid.get(a.tache) : null;
                  @let p = round(a.progression * 100);
                  <tr
                    class="ad-row"
                    [class.is-late]="retard"
                    [class.is-closed]="!ouverte(a)"
                    [class.is-sel]="m.panneau === 'act:' + a.id"
                    tabindex="0"
                    [attr.data-adopen]="'act:' + a.id"
                    [attr.aria-label]="a.ref + ' ' + (a.libelle || '') + ' : ouvrir le détail'"
                    (click)="ouvrir('act:' + a.id)"
                    (keydown)="clavier($event, 'act:' + a.id)"
                  >
                    <td class="c-ref">{{ a.ref }}</td>
                    <td class="c-txt">
                      <ng-container *ngTemplateOutlet="texte; context: { lib: a.libelle, com: a.commentaire, inst: a.origine, tache: t?.label }" />
                    </td>
                    <td class="c-pers"><ng-container *ngTemplateOutlet="puces; context: { $implicit: a.porteur }" /></td>
                    <td class="c-date">
                      @if (!a.echeance) {
                        <span class="muted">—</span>
                      } @else {
                        <span class="ad-d" [class.neg]="retard">{{ fD(a.echeance) }}</span
                        ><small [class.neg]="retard">{{
                          ouverte(a) ? (retard ? 'en retard de ' + -joursEntre(v.aujourdhui, a.echeance) + ' j' : relatif(a.echeance, v.aujourdhui)) : a.faitLe ? 'faite le ' + fD(a.faitLe) : ''
                        }}</small>
                      }
                    </td>
                    <td class="c-st">
                      <span class="pill xs" [class]="'pill xs st-' + stCls(a.statut)">{{ a.statut }}</span>
                      @if (a.statut !== 'Annulée') {
                        <span class="ad-prog"
                          ><span class="bar ok mini"><i [style.width.%]="p"></i></span><small>{{ p }} %</small></span
                        >
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="empty">
                      @if (v.projet.actions.length) {
                        Aucune action ne correspond aux filtres. <button type="button" class="linkbtn ad-raz" (click)="raz('actions')">Effacer les filtres</button>
                      } @else {
                        Aucune action pour l’instant. Ajoutez la première avec « + Nouvelle action ».
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @case ('decisions') {
          <div class="ad-kpis">
            <span class="ad-kpi"><span>Validées</span><b>{{ m.decValidees }}</b></span>
            <button type="button" class="ad-kpi" [class.on]="u.adfd === 'À valider'" [attr.aria-pressed]="u.adfd === 'À valider'" (click)="ui.maj({ adfd: u.adfd === 'À valider' ? 'toutes' : 'À valider' })">
              <span>À valider</span><b [class.warn-t]="m.decAValider > 0">{{ m.decAValider }}</b>
            </button>
            <span class="spacer"></span>
            @if (m.modif) {
              <button type="button" class="btn primary" (click)="creer('decisions')">+ Nouvelle décision</button>
            }
          </div>
          <div class="toolbar ad-filtres">
            <ng-container *ngTemplateOutlet="recherche; context: { $implicit: 'Réf., décision, commentaire, personne' }" />
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'adfd', lib: 'Statut', opts: optsStatutDec, val: u.adfd || 'toutes' }" />
            <ng-container *ngTemplateOutlet="choixPers; context: { cle: 'adpd', lib: 'Décideur', liste: m.persDec, val: u.adpd }" />
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'adDPer', lib: 'Date', opts: optsDate, val: u.adDPer }" />
            @if (u.adDPer === 'periode') {
              <ng-container *ngTemplateOutlet="periode" />
            }
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'adInst', lib: 'Instance', opts: m.optsInst, val: u.adInst }" />
            @if (m.filtresDec) {
              <button type="button" class="linkbtn ad-raz" (click)="raz('decisions')">Effacer les filtres</button>
            }
            <span class="spacer"></span><span class="ad-nb">{{ m.l.decisions.length }} décision{{ m.l.decisions.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="ad-wrap">
            <table appTriable class="t ad-liste ad-dec">
              <thead>
                <tr>
                  <th class="c-ref">Réf.</th>
                  <th class="c-date">Date</th>
                  <th class="c-txt">Décision</th>
                  <th class="c-pers">Décideur</th>
                  <th class="c-st">Statut</th>
                </tr>
              </thead>
              <tbody>
                @for (x of m.l.decisions; track x.id) {
                  <tr
                    class="ad-row"
                    [class.is-sel]="m.panneau === 'dec:' + x.id"
                    tabindex="0"
                    [attr.data-adopen]="'dec:' + x.id"
                    [attr.aria-label]="x.ref + ' ' + (x.libelle || '') + ' : ouvrir le détail'"
                    (click)="ouvrir('dec:' + x.id)"
                    (keydown)="clavier($event, 'dec:' + x.id)"
                  >
                    <td class="c-ref">{{ x.ref }}</td>
                    <td class="c-date">
                      <span class="ad-d">{{ fD(x.date) }}</span><small>{{ relatif(x.date, v.aujourdhui) }}</small>
                    </td>
                    <td class="c-txt">
                      <ng-container *ngTemplateOutlet="texte; context: { lib: x.libelle, com: x.commentaire, inst: x.instance, impact: x.impact }" />
                    </td>
                    <td class="c-pers"><ng-container *ngTemplateOutlet="puces; context: { $implicit: x.decideur }" /></td>
                    <td class="c-st">
                      <span class="pill xs" [class]="'pill xs ' + (x.statut === 'Validée' ? 'st-valide' : x.statut === 'À valider' ? 'st-test' : 'st-bloque')">{{ x.statut }}</span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="empty">
                      @if (v.projet.decisions.length) {
                        Aucune décision ne correspond aux filtres. <button type="button" class="linkbtn ad-raz" (click)="raz('decisions')">Effacer les filtres</button>
                      } @else {
                        Aucune décision pour l’instant. Ajoutez la première avec « + Nouvelle décision ».
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @case ('risques') {
          <div class="ad-kpis">
            <span class="ad-kpi"><span>Ouverts</span><b>{{ v.risquesOuverts.length }}</b></span>
            <span class="ad-kpi"><span>Forts</span><b [class.neg]="v.risquesForts.length > 0">{{ v.risquesForts.length }}</b></span>
            <span class="ad-kpi" title="Risques ouverts sans « Comment réduire »"><span>Sans moyen de réduction</span><b>{{ m.sansParade }}</b></span>
            <span class="ad-kpi" title="Risques ouverts sans plan d’actions ni action liée"><span>Sans plan d’actions</span><b>{{ m.sansPlan }}</b></span>
            <span class="spacer"></span>
            @if (m.modif) {
              <button type="button" class="btn primary" (click)="creer('risques')">+ Nouveau risque</button>
            }
          </div>
          <div class="toolbar ad-filtres">
            <ng-container *ngTemplateOutlet="recherche; context: { $implicit: 'Réf., risque, cause, réduction, plan d’actions, personne' }" />
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'rkf', lib: 'Statut', opts: optsStatutRk, val: u.rkf || 'ouverts' }" />
            <ng-container *ngTemplateOutlet="choix; context: { cle: 'rkty', lib: 'Type', opts: optsType, val: u.rkty }" />
            <ng-container *ngTemplateOutlet="choixPers; context: { cle: 'adpr', lib: 'Responsable', liste: m.persRk, val: u.adpr }" />
            @if (m.filtresRk) {
              <button type="button" class="linkbtn ad-raz" (click)="raz('risques')">Effacer les filtres</button>
            }
            <span class="spacer"></span>
            <span class="rk-legende" aria-label="Légende des types de risque"
              ><b>Légende</b>
              @for (t of types; track t) {
                <span><ng-container *ngTemplateOutlet="icone; context: { $implicit: t, n: 16 }" />{{ t }}</span>
              }
            </span>
            <span class="ad-nb">{{ m.l.risques.length }} risque{{ m.l.risques.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="rk-wrap">
            <div class="ad-wrap">
              <table appTriable class="t ad-liste ad-rk">
                <thead>
                  <tr>
                    <th class="c-ref">Réf.</th>
                    <th class="c-type">Type</th>
                    <th class="c-txt">Risque</th>
                    <th class="c-crit">Criticité</th>
                    <th class="c-pers">Responsable</th>
                    <th class="c-st">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of m.l.risques; track r.id) {
                    @let nv = niveau(r.crit);
                    @let ferme = !m.ouvertsR.has(r.id);
                    @let act = r.action ? m.actionsParId.get(r.action) : null;
                    <tr
                      class="ad-row"
                      [class.is-closed]="ferme"
                      [class.is-sel]="m.panneau === 'rk:' + r.id"
                      tabindex="0"
                      [attr.data-adopen]="'rk:' + r.id"
                      [attr.aria-label]="r.ref + ' ' + (r.libelle || '') + ' : ouvrir le détail'"
                      (click)="ouvrir('rk:' + r.id)"
                      (keydown)="clavier($event, 'rk:' + r.id)"
                    >
                      <td class="c-ref">{{ r.ref }}</td>
                      <td class="c-type">
                        @if (r.type) {
                          <span class="rk-type" [title]="r.type"
                            ><ng-container *ngTemplateOutlet="icone; context: { $implicit: r.type, n: 20 }" /><span class="rk-type-l">{{ r.type }}</span></span
                          >
                        } @else {
                          <span class="muted" title="Type non précisé">—</span>
                        }
                      </td>
                      <td class="c-txt">
                        <span class="ad-lib">
                          @if (r.libelle) {
                            {{ r.libelle }}
                          } @else {
                            <i class="muted">Sans libellé</i>
                          }
                        </span>
                        <span class="rk-rub">
                          <ng-container *ngTemplateOutlet="rubrique; context: { lib: 'Cause', val: r.cause, adef: false }" />
                          <ng-container *ngTemplateOutlet="rubrique; context: { lib: 'Comment réduire', val: r.parade, adef: true }" />
                          <ng-container *ngTemplateOutlet="rubrique; context: { lib: 'Plan d’actions', val: r.plan, adef: !act }" />
                        </span>
                        @if (act) {
                          <span class="ad-rep"
                            ><span class="ad-rep-t" [title]="act.libelle || ''">↳ Action {{ act.ref }} · {{ extrait(act.libelle, 60) }}</span></span
                          >
                        }
                      </td>
                      <td class="c-crit">
                        <span class="pill" [class]="'pill lv-' + nv[0]" [title]="'Probabilité × importance = ' + r.crit + ' sur 16'">{{ nv[1] }} · {{ r.crit }}</span
                        ><small title="Probabilité × importance">{{ r.proba || probaDef }} × {{ r.impact || impactDef }}</small>
                      </td>
                      <td class="c-pers"><ng-container *ngTemplateOutlet="puces; context: { $implicit: r.responsable }" /></td>
                      <td class="c-st">
                        <span class="pill xs" [class]="'pill xs ' + (r.statut === 'Survenu' ? 'st-bloque' : ferme ? 'st-valide' : 'st-afaire')">{{ r.statut || 'Ouvert' }}</span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="empty">
                        @if (v.projet.risques.length) {
                          Aucun risque ne correspond aux filtres. <button type="button" class="linkbtn ad-raz" (click)="raz('risques')">Effacer les filtres</button>
                        } @else {
                          Aucun risque pour l’instant. La provision pour risque du TSP se pilote ici : ajoutez le premier avec « + Nouveau risque ».
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (v.projet.risques.length) {
              <!-- matrice des risques ouverts : probabilité en abscisse, importance en ordonnée ; une pastille par risque, un clic l'ouvre -->
              <div class="rk-mat rk-mat4" role="figure" aria-label="Matrice des risques ouverts : probabilité en abscisse, importance en ordonnée">
                <span class="rk-ax">Importance ↑ · Probabilité →</span>
                @for (ligne of m.matrice; track ligne.impact) {
                  <span class="rk-l">{{ ligne.impact }}</span>
                  @for (c of ligne.cases; track $index) {
                    <span class="rk-c" [class]="'rk-c rk-' + c.niveau" [title]="c.titre">
                      @for (r of c.risques; track r.id) {
                        <button type="button" class="rk4-p" [title]="r.ref + ' · ' + (r.libelle || '')" (click)="ouvrir('rk:' + r.id)">{{ refCourte(r.ref) }}</button>
                      }
                    </span>
                  }
                }
                <span></span>
                @for (p of probas; track p) {
                  <span class="rk-l b">{{ p }}</span>
                }
              </div>
            }
          </div>
        }
      }

      <!-- ---- gabarits ---- -->
      <ng-template #recherche let-aide>
        <label class="field ad-rech"
          >Rechercher<input class="in" type="search" [value]="ui.ui().adq" [placeholder]="aide" #rq (input)="ui.maj({ adq: rq.value })"
        /></label>
      </ng-template>
      <ng-template #choix let-cle="cle" let-lib="lib" let-opts="opts" let-val="val">
        <label class="field"
          >{{ lib }}
          <select class="in" #s (change)="majFiltre(cle, s.value)">
            @for (o of opts; track o[0]) {
              <option [value]="o[0]" [selected]="o[0] === (val ?? '')">{{ o[1] }}</option>
            }
          </select>
        </label>
      </ng-template>
      <ng-template #choixPers let-cle="cle" let-lib="lib" let-liste="liste" let-val="val">
        <label class="field"
          >{{ lib }}
          <select class="in" title="Éléments où cette personne est citée, seule ou avec d’autres" #sp (change)="majFiltre(cle, sp.value)">
            <option value="" [selected]="!val">Toutes</option>
            @for (p of liste; track p.cle) {
              <option [value]="p.cle" [selected]="p.cle === val">{{ p.nom }} ({{ p.n }})</option>
            }
          </select>
        </label>
      </ng-template>
      <ng-template #periode>
        <label class="field">Du<input class="in w-date" type="date" [value]="ui.ui().adDu" #du (change)="ui.maj({ adDu: du.value })" /></label>
        <label class="field">Au<input class="in w-date" type="date" [value]="ui.ui().adAu" #au (change)="ui.maj({ adAu: au.value })" /></label>
      </ng-template>
      <ng-template #puces let-s>
        @let l = personnes(s);
        @if (!l.length) {
          <span class="muted">—</span>
        } @else {
          <span class="ad-pers-l">
            @for (p of l.slice(0, 3); track $index) {
              <span class="ad-pers" [title]="p"><i aria-hidden="true">{{ initiales(p) }}</i>{{ p }}</span>
            }
            @if (l.length > 3) {
              <span class="ad-plus" [title]="l.slice(3).join(', ')">+{{ l.length - 3 }}</span>
            }
          </span>
        }
      </ng-template>
      <ng-template #texte let-lib="lib" let-com="com" let-inst="inst" let-tache="tache" let-impact="impact">
        <span class="ad-lib">
          @if (lib) {
            {{ lib }}
          } @else {
            <i class="muted">Sans libellé</i>
          }
        </span>
        @if (inst || tache || impact) {
          <span class="ad-rep">
            @if (inst) {
              <span class="ad-tag">{{ inst }}</span>
            }
            @if (tache) {
              <span class="ad-rep-t" [title]="'Tâche concernée : ' + tache">↳ {{ tache }}</span>
            }
            @if (impact) {
              <span class="ad-rep-t">Impact : {{ impact }}</span>
            }
          </span>
        }
        @if (com) {
          <small class="ad-com">{{ extrait(com) }}</small>
        }
      </ng-template>
      <ng-template #rubrique let-lib="lib" let-val="val" let-adef="adef">
        <span class="rk-lg"
          ><span class="rk-lb">{{ lib }} :</span>{{ " " }}
          @if (val) {
            {{ extrait(val, 160) }}
          } @else if (adef) {
            <span class="neg-l">à définir</span>
          } @else {
            <span class="muted">—</span>
          }
        </span>
      </ng-template>
      <ng-template #icone let-t let-n="n">
        @if (ico[t]; as d) {
          <svg class="rk-ico" viewBox="0 0 24 24" [attr.width]="n" [attr.height]="n" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @for (p of d; track $index) {
              <path [attr.d]="p" />
            }
          </svg>
        }
      </ng-template>
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
  protected readonly stCls = stCls;
  protected readonly ouverte = ouverte;
  protected readonly enRetard = enRetard;
  protected readonly joursEntre = joursEntre;
  protected readonly relatif = relatif;
  protected readonly extrait = extrait;
  protected readonly personnes = personnes;
  protected readonly initiales = initiales;
  protected readonly refCourte = refCourte;
  protected readonly niveau = niveauRisque;
  protected readonly round = Math.round;
  protected readonly ico = RK_ICO;
  protected readonly types = RISK_TYPES;
  protected readonly probas = RISK_PROBA;
  protected readonly probaDef = RISK_PROBA_DEF;
  protected readonly impactDef = RISK_IMPACT_DEF;
  protected readonly exportEnCours = signal(false);

  protected readonly optsStatutAct: [string, string][] = [
    ['ouvertes', 'Ouvertes'],
    ['retard', 'En retard'],
    ['closes', 'Faites / annulées'],
    ['toutes', 'Toutes'],
  ];
  protected readonly optsEch: [string, string][] = [
    ['', 'Toutes'],
    ['retard', 'En retard'],
    ['semaine', 'Sous 7 jours'],
    ['quinzaine', 'Sous 15 jours'],
    ['mois', 'D’ici la fin du mois'],
    ['periode', 'Période…'],
  ];
  protected readonly optsStatutDec: [string, string][] = [['toutes', 'Toutes'], ...DEC_ST.map((o): [string, string] => [o, o])];
  protected readonly optsDate: [string, string][] = [
    ['', 'Toutes'],
    ['mois', 'Ce mois-ci'],
    ['30j', '30 derniers jours'],
    ['periode', 'Période…'],
  ];
  protected readonly optsStatutRk: [string, string][] = [
    ['ouverts', 'Ouverts'],
    ['clos', 'Maîtrisés / clos'],
    ['tous', 'Tous'],
  ];
  protected readonly optsType: [string, string][] = [['', 'Tous'], ...RISK_TYPES.map((t): [string, string] => [t, t]), ['__aucun', 'Non précisé']];

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    const A = v.projet.actions;
    const ouvertsR = new Set(v.risquesOuverts.map((r) => r.id));
    const l = listesRegistres({ actions: A, decisions: v.projet.decisions, risques: v.projet.risques, risquesOuverts: ouvertsR }, u as FiltresRegistres, v.aujourdhui);
    const ouv = A.filter(ouverte);
    const lim = addDays(v.aujourdhui, v.alerteActions);
    const iDe = (liste: readonly string[], val: string, def: string) => Math.max(0, liste.indexOf(val || def));
    const matrice = [...RISK_IMPACT.keys()].reverse().map((iI) => ({
      impact: RISK_IMPACT[iI],
      cases: [...RISK_PROBA.keys()].map((pI) => {
        const c = (pI + 1) * (iI + 1);
        const nv = riskNiveau(c);
        return {
          niveau: nv === 'fort' ? 'crit' : nv === 'moyen' ? 'warn' : 'ok',
          titre: `Probabilité ${RISK_PROBA[pI].toLowerCase()} × importance ${RISK_IMPACT[iI].toLowerCase()} = ${c}`,
          risques: v.risquesOuverts.filter((r) => iDe(RISK_PROBA, r.proba, RISK_PROBA_DEF) === pI && iDe(RISK_IMPACT, r.impact, RISK_IMPACT_DEF) === iI),
        };
      }),
    }));
    const p = this.etat.panneau();
    return {
      v,
      l,
      vue: u.ad === 'decisions' || u.ad === 'risques' ? u.ad : 'actions',
      modif: v.droits.peutModifier,
      panneau: p?.startsWith(PANNEAU_REGISTRE) ? p.slice(PANNEAU_REGISTRE.length) : null,
      ouvertes: ouv.length,
      retard: A.filter((a) => enRetard(a, v.aujourdhui)).length,
      bientot: ouv.filter((a) => a.echeance && a.echeance >= v.aujourdhui && a.echeance <= lim).length,
      decValidees: v.projet.decisions.filter((x) => x.statut === 'Validée').length,
      decAValider: v.projet.decisions.filter((x) => x.statut === 'À valider').length,
      sansParade: v.risquesOuverts.filter((r) => !String(r.parade || '').trim()).length,
      sansPlan: v.risquesOuverts.filter((r) => !String(r.plan || '').trim() && !r.action).length,
      ouvertsR,
      actionsParId: new Map(A.map((a) => [a.id, a])),
      persAct: personnesDe(A.map((a) => a.porteur)),
      persDec: personnesDe(v.projet.decisions.map((x) => x.decideur)),
      persRk: personnesDe(v.projet.risques.map((r) => r.responsable)),
      optsInst: [['', 'Toutes'], ...instancesDuProjet(v).map((x): [string, string] => [x, x])] as [string, string][],
      filtresAct: !!(u.adEch || u.adInst || u.adp || u.adq || (u.adf || 'ouvertes') !== 'ouvertes'),
      filtresDec: !!(u.adDPer || u.adInst || u.adpd || u.adq || (u.adfd || 'toutes') !== 'toutes'),
      filtresRk: !!(u.adpr || u.adq || u.rkty || (u.rkf || 'ouverts') !== 'ouverts'),
      matrice,
    };
  });

  protected majFiltre(cle: string, valeur: string): void {
    this.ui.maj({ [cle]: valeur } as Partial<EtatUi>);
  }

  /** Indicateurs cliquables : ils règlent les filtres (un second clic les retire). */
  protected kpi(c: 'ouvertes' | 'retard' | 'sous'): void {
    const e = this.ui.ui().adEch;
    if (c === 'ouvertes') this.ui.maj({ adf: 'ouvertes', adEch: '' });
    else if (c === 'retard') this.ui.maj({ adf: 'ouvertes', adEch: e === 'retard' ? '' : 'retard' });
    else this.ui.maj({ adf: 'ouvertes', adEch: e === 'semaine' ? '' : 'semaine' });
  }

  protected raz(vue: 'actions' | 'decisions' | 'risques'): void {
    const commun: Partial<EtatUi> = { adq: '', adInst: '', adDu: '', adAu: '' };
    if (vue === 'actions') this.ui.maj({ ...commun, adf: 'ouvertes', adEch: '', adp: '' });
    else if (vue === 'decisions') this.ui.maj({ ...commun, adfd: 'toutes', adDPer: '', adpd: '' });
    else this.ui.maj({ ...commun, rkf: 'ouverts', adpr: '', rkty: '' });
  }

  /** Un clic sur la ligne ouvre le détail (un second clic le referme). */
  protected ouvrir(spec: string): void {
    if (this.etat.panneau() === PANNEAU_REGISTRE + spec) this.etat.fermerPanneau();
    else this.etat.ouvrirRegistre(spec);
  }

  /** Entrée ou Espace : ouvrir ; flèches : ligne précédente ou suivante. */
  protected clavier(e: KeyboardEvent, spec: string): void {
    const tr = e.currentTarget as HTMLElement;
    if (e.target !== tr) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.etat.ouvrirRegistre(spec);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ((e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling) as HTMLElement | null)?.focus();
    }
  }

  /** Nouvelle ligne (le serveur réutilise une ligne encore sans libellé) : son détail s'ouvre, le libellé est prêt à être saisi. */
  protected async creer(registre: Registre): Promise<void> {
    if (registre === 'actions') this.ui.maj({ adf: 'ouvertes' });
    if (registre === 'risques') this.ui.maj({ rkf: 'ouverts' });
    const r = await this.etat.saisir((id) => this.api.creer(id, registre));
    if (r?.ouvrir) {
      this.etat.ouvrirRegistre(`${registre === 'actions' ? 'act' : registre === 'decisions' ? 'dec' : 'rk'}:${r.ouvrir}`);
      setTimeout(() => document.querySelector<HTMLTextAreaElement>('.drawer .ad-titre')?.focus(), 50);
    }
  }

  /** Les trois registres dans un fichier Excel, une feuille chacun. */
  protected async exporter(): Promise<void> {
    this.exportEnCours.set(true);
    try {
      const reponse = await firstValueFrom(this.api.registres(this.etat.projetId()));
      telecharger(reponse, 'Actions decisions risques.xlsx');
      this.etat.afficher('Export Excel généré : une feuille par registre (actions, décisions, risques).', 'succes');
    } catch (e) {
      this.etat.afficher(await messageErreurFichier(e), 'erreur');
    } finally {
      this.exportEnCours.set(false);
    }
  }
}

export type { Action, Decision, Risque };
