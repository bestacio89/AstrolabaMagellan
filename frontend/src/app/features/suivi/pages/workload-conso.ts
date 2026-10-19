import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, linkedSignal, signal } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { multiJours } from '../etat/constantes';
import { fD, fJ, fJz, fML, fSigned, stSlug } from '../etat/formats';
import { dow, holidayName, isWorkday, lireNombre, monthDays, num, round, sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { axeName, couleurGroupe, defaultAxeName, filteredTasks, groupByAxe, idName, isOver, ProfilVue, TacheVue, taskProfiles, Vue } from '../etat/vue';
import { BarreFiltres } from '../ui/barre-filtres';
import { Fx } from '../ui/fx';
import { EtiquetteAjout } from '../ui/tache';

/** Colonnes d'identification masquables, figées à gauche (largeurs en pixels). */
const META_COLS: { k: 'id' | 'lot' | 'phase'; l: string; w: number }[] = [
  { k: 'id', l: 'Axe', w: 84 },
  { k: 'lot', l: 'Lot', w: 56 },
  { k: 'phase', l: 'Phase', w: 120 },
];
const LARGEUR_TACHE = { def: 280, min: 160, max: 900 };
const JOURS = 'DLMMJVS';

interface LigneProfil {
  i: number;
  profil: ProfilVue | undefined;
  /** Consommé saisi par jour. */
  parJour: Record<string, number>;
  mois: number;
  depasse: boolean;
}

/**
 * Workload › Saisie du consommé : une grille par mois, une ligne par tâche (total) et par profil (saisie).
 * Règle : 1 JH maximum par personne et par jour, toutes tâches confondues (sauf entités ACHAT et CESSION).
 * Navigation au clavier : flèches, Entrée (ligne suivante).
 */
@Component({
  selector: 'app-workload-conso',
  imports: [NgTemplateOutlet, BarreFiltres, EtiquetteAjout, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      <!-- « Agrandir » : la saisie occupe toute la fenêtre, avec des cases plus grandes ; Échap ou « Réduire » pour revenir -->
      <div class="ws-zone" [class.ws-plein]="plein()" [attr.role]="plein() ? 'region' : null" [attr.aria-label]="plein() ? 'Saisie du consommé, agrandie' : null">
      @if (plein()) {
        <div class="ws-tete">
          <h2>Saisie du consommé <small>{{ fML(m.mois) }}</small></h2>
          <button type="button" class="btn sm" (click)="plein.set(false)" title="Revenir à l’affichage normal (Échap)">Réduire ✕</button>
        </div>
      }
      <app-barre-filtres>
        <label class="field"
          >Profil
          <select class="in" aria-label="Filtrer sur un profil" title="Tâches où ce profil est prévu ou a du consommé (tous les profils de ces tâches restent affichés)" #pf (change)="ui.maj({ profF: pf.value })">
            <option value="" [selected]="m.profil === null">Tous</option>
            @for (p of m.profilsFiltre; track p.i) {
              <option [value]="p.i" [selected]="p.i === m.profil">{{ p.nom }}</option>
            }
          </select>
        </label>
        <div class="field"
          >Mois
          <div class="mois-nav">
            <button class="btn sm icone" type="button" [disabled]="m.index <= 0" aria-label="Mois précédent" title="Mois précédent" (click)="ui.maj({ month: v.m.months[m.index - 1] })">◀</button>
            <select class="in" aria-label="Mois affiché" #mo (change)="ui.maj({ month: mo.value })">
              @for (x of v.m.months; track x) {
                <option [value]="x" [selected]="x === m.mois">{{ fML(x) }}</option>
              }
            </select>
            <button class="btn sm icone" type="button" [disabled]="m.index >= v.m.months.length - 1" aria-label="Mois suivant" title="Mois suivant" (click)="ui.maj({ month: v.m.months[m.index + 1] })">▶</button>
            <button class="btn sm ghost" type="button" (click)="ui.maj({ month: null })">Ce mois-ci</button>
          </div>
        </div>
        <!-- affichage : un seul groupe, toujours à droite (il passe à la ligne d'un bloc, jamais bouton par bouton) -->
        <div class="field push"
          >&nbsp;
          <div class="toolbar actions-affichage">
            @if (m.unDeplie) {
              <button class="btn sm" type="button" (click)="replier(m.liste, true)">Tout replier</button>
            } @else {
              <button class="btn sm" type="button" (click)="replier(m.liste, false)">Tout déplier</button>
            }
            <!-- bouton bascule, comme les autres filtres : en bleu quand le filtre est actif (tâches terminées masquées) -->
            <button
              type="button"
              class="btn sm bascule"
              [attr.aria-pressed]="ui.ui().hideDone"
              [title]="ui.ui().hideDone ? 'Afficher les tâches validées et annulées' : 'Masquer les tâches validées et annulées'"
              (click)="ui.maj({ hideDone: !ui.ui().hideDone })"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m5 12 5 5 9-10" /></svg
              >{{ ui.ui().hideDone ? 'Tâches terminées masquées' : 'Tâches terminées' }}
            </button>
            @if (!plein()) {
              <button type="button" class="btn sm" (click)="plein.set(true)" title="Saisie sur toute la fenêtre, cases plus grandes">⤢ Agrandir</button>
            }
            <details class="dd">
              <summary class="btn sm burger" [title]="'Colonnes' + (m.nbMasquees ? ' (' + m.nbMasquees + ' masquée' + (m.nbMasquees > 1 ? 's' : '') + ')' : '')" aria-label="Colonnes">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                @if (m.nbMasquees) {
                  <span class="dd-badge">{{ m.nbMasquees }}</span>
                }
              </summary>
              <div class="dd-menu" role="group" aria-label="Colonnes à masquer">
                <div class="dd-h">Colonnes à masquer</div>
                @for (c of metaCols; track c.k) {
                  <label class="dd-i"
                    ><input type="checkbox" [checked]="masquee(v, c.k)" #cb (change)="masquer(v, c.k, cb.checked)" /> {{ c.l }}
                    @if (v.m.dim.key === c.k) {
                      <small class="muted">(critère de regroupement)</small>
                    }
                  </label>
                }
                <div class="dd-sep"></div>
                <button type="button" class="dd-i dd-btn" (click)="largeurParDefaut()">Largeur de « Tâche » par défaut</button>
              </div>
            </details>
          </div>
        </div>
      </app-barre-filtres>
      @if (v.m.cal.debut) {
        <p class="sub">
          Période du projet : du <b>{{ fD(v.m.cal.debut) }}</b> au <b>{{ fD(v.m.cal.finPrevue) }}</b
          >{{ v.m.cal.finContrat && v.m.cal.finContrat !== v.m.cal.finPrevue ? ' (fin contractuelle ' + fD(v.m.cal.finContrat) + ')' : '' }}. Les jours hors période sont hachurés. <app-fx cle="saisie" />
        </p>
      }
      <div class="tw tall">
        <table class="daygrid lisible" [style]="m.styleGrille" (keydown)="clavier($event)" (focusin)="selectionner($event)">
          <thead>
            <tr>
              @for (c of m.visibles; track c.k) {
                <th class="smc" [class]="'smc sm-' + c.k">{{ c.l }}</th>
              }
              <th class="stick">
                Tâche<span
                  class="colrs"
                  title="Glisser pour élargir · double-clic : ajuster au titre le plus long"
                  (pointerdown)="debutRedimension($event)"
                  (dblclick)="ajusterLargeur()"
                ></span>
              </th>
              <th class="stick2">Profil</th>
              <th class="n">Prévu</th>
              <th class="n">Consommé</th>
              <th class="n">RAF</th>
              @for (j of m.jours; track j.d) {
                <th class="d" [class.off]="!j.ouvre" [class.hp]="j.hors" [class.today]="j.d === v.aujourdhui" [title]="j.titre">
                  {{ j.num }}<span>{{ j.lettre }}</span>
                </th>
              }
              <th class="n">Mois</th>
            </tr>
          </thead>
          <tbody>
            @for (g of m.groupes; track g.cle) {
              <tr class="grp axg" [style.--axc]="g.couleur">
                @if (m.visibles.length) {
                  <td class="smg" [attr.colspan]="m.visibles.length">
                    <ng-container *ngTemplateOutlet="nomGroupe; context: { $implicit: g }" />
                  </td>
                  <td class="stick"></td>
                } @else {
                  <td class="stick"><ng-container *ngTemplateOutlet="nomGroupe; context: { $implicit: g }" /></td>
                }
                <td class="stick2"></td>
                <td [attr.colspan]="m.jours.length + 4"></td>
              </tr>
              @for (t of g.taches; track t.uid) {
                @let replie = !!ui.ui().folded[t.uid];
                @let fini = t.statut === 'Validé';
                <tr class="tsum axr" [class.is-valide]="fini" [class.is-annul]="t.annulee" [class.is-sel]="etat.panneau() === t.uid" [style.--axc]="g.couleur">
                  @for (c of m.visibles; track c.k) {
                    @switch (c.k) {
                      @case ('id') {
                        <td class="smc sm-id" [title]="nomAxe(v, t.axe)">{{ t.axe === '0' ? 'Pilotage' : t.axe ? defaultAxeName(t.axe) : '—' }}</td>
                      }
                      @case ('lot') {
                        <td class="smc sm-lot">{{ t.lot }}</td>
                      }
                      @case ('phase') {
                        <td class="smc sm-phase">
                          @if (t.phase) {
                            <button type="button" class="cell-ph" [attr.data-openph]="t.phase" [title]="'Ouvrir la phase ' + t.phase + (t.etape ? ' · ' + t.etape : '')">
                              {{ t.phase }}
                              @if (t.echViaPhase) {
                                <span class="eur-dot" title="Phase liée à une échéance de facturation">€</span>
                              }
                            </button>
                          }
                        </td>
                      }
                    }
                  }
                  <td class="stick">
                    <div class="tname">
                      <button
                        type="button"
                        class="fold"
                        [attr.aria-expanded]="!replie"
                        title="Afficher / masquer le détail par profil"
                        aria-label="Détail par profil"
                        (click)="basculer(t.uid)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      @if (fini) {
                        <span class="okmark" title="Tâche validée">✓</span>
                      }
                      <button type="button" class="tlink" [attr.data-open]="t.uid" title="Ouvrir le détail de la tâche">{{ t.label }}</button
                      ><app-etiquette-ajout [t]="t" />
                    </div>
                  </td>
                  <td class="stick2 muted">
                    <div class="s2">
                      @if (t.statut !== 'À faire') {
                        <span class="pill xs" [class]="'pill xs st-' + stSlug(t.statut)">{{ t.statut }}</span>
                      }
                      <span class="s2-n">{{ profils(t).length }} profil{{ profils(t).length > 1 ? 's' : '' }}</span>
                    </div>
                  </td>
                  <td class="n c-prevu">{{ fJ(t.charge) }}</td>
                  <td class="n c-conso" [class.zero]="!t.consoTotal" [class.over]="isOver(t)">{{ fJ(t.consoTotal) }}</td>
                  <td class="n c-raf" [class.zero]="!t.raf">{{ fJ(t.raf) }}</td>
                  @for (j of m.jours; track j.d) {
                    <td class="dsum" [class.off]="!j.ouvre" [class.hp]="j.hors">{{ fJz(t.dayTot[j.d]) }}</td>
                  }
                  <td class="n">{{ fJz(moisTache(t, m.jours)) }}</td>
                </tr>
                @for (p of lignesProfils(v, t, m.jours); track p.i) {
                  <tr class="tsub axr" [class.valide-sub]="fini" [class.is-prof]="p.i === m.profil" [style.--axc]="g.couleur" [hidden]="replie">
                    @for (c of m.visibles; track c.k) {
                      <td class="smc" [class]="'smc sm-' + c.k"></td>
                    }
                    <td class="stick"></td>
                    <td class="stick2" [title]="(p.profil?.collaborateur ?? '') + (t.chargesA[p.i] ? ' — ' + fJ(t.chargesA[p.i]) + ' JH ajoutés (non facturés)' : '')">
                      {{ p.profil?.nom || 'Profil ' + (p.i + 1) }}
                      @if (t.chargesA[p.i] && !t.estAjout) {
                        <span class="tag-aj">+ ajout</span>
                      }
                      @if (!t.charges[p.i]) {
                        <span class="flag">Non chiffré</span>
                      }
                    </td>
                    <td class="n c-prevu">{{ fJz(t.charges[p.i]) || '0' }}</td>
                    <td class="n c-conso" [class.zero]="!t.consoP[p.i]" [class.over]="p.depasse">{{ fJ(t.consoP[p.i]) }}</td>
                    <td class="n c-raf" [class.neg]="p.depasse">{{ p.depasse ? fSigned(t.charges[p.i] - t.consoP[p.i]) : fJ(t.restP[p.i]) }}</td>
                    @for (j of m.jours; track j.d; let ci = $index) {
                      <td [class.off]="!j.ouvre" [class.hp]="j.hors">
                        <input
                          #cel
                          [attr.data-c]="ci"
                          inputmode="decimal"
                          [value]="p.parJour[j.d] ? fJ(p.parJour[j.d]) : ''"
                          [class.has]="!!p.parJour[j.d]"
                          [class.bad]="tropCharge(v, p, j.d)"
                          [title]="tropCharge(v, p, j.d) ? fJ(v.dayLoad[p.i][j.d]) + ' JH saisis ce jour-là pour ' + (p.profil?.nom ?? '') + ', toutes tâches confondues : maximum 1 JH' : ''"
                          [disabled]="t.annulee || !v.droits.peutSaisirConsomme"
                          [attr.aria-label]="(p.profil?.nom ?? '') + ' — ' + t.label + ' le ' + fD(j.d)"
                          (change)="saisir(v, t, p, j.d, cel)"
                        />
                      </td>
                    }
                    <td class="n">{{ fJz(p.mois) }}</td>
                  </tr>
                }
              }
            } @empty {
              <tr>
                <td [attr.colspan]="m.jours.length + 6 + m.visibles.length" class="empty">Aucune tâche ne correspond au filtre.</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              @if (m.visibles.length) {
                <td class="smg" [attr.colspan]="m.visibles.length"></td>
              }
              <td class="stick" style="text-align: left" [title]="m.profil !== null ? 'Jours saisis par ce profil, sur les tâches affichées' : ''">
                Total du jour{{ m.profil !== null ? ' · ' + (m.v.P[m.profil]?.nom ?? '') : '' }}
              </td>
              <td class="stick2"></td>
              <td></td>
              <td></td>
              <td></td>
              @for (j of m.jours; track j.d) {
                <td>{{ fJz(m.totalJour[j.d]) }}</td>
              }
              <td>{{ fJz(m.totalMois) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
      <ng-template #nomGroupe let-g>
        @if (g.phase) {
          <button type="button" class="grp-name" [attr.data-openph]="g.cle" [title]="'Ouvrir la phase ' + g.cle">{{ g.nom }}</button>
          @if (g.echeance) {
            <span class="eur-dot" title="Phase liée à une échéance de facturation">€</span>
          }
        } @else {
          {{ g.nom }}
        }
      </ng-template>
    }
  `,
  host: { '(document:keydown.escape)': 'quitterPlein($event)' },
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class WorkloadConso {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly metaCols = META_COLS;
  /** Saisie agrandie (toute la fenêtre, cases plus grandes) : le temps de la saisie, non mémorisé. */
  protected readonly plein = signal(false);
  protected readonly fD = fD;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;
  protected readonly fML = fML;
  protected readonly fSigned = fSigned;
  protected readonly stSlug = stSlug;
  protected readonly isOver = isOver;
  protected readonly defaultAxeName = defaultAxeName;
  protected readonly nomAxe = idName;
  protected readonly profils = taskProfiles;

  /** Largeur de la colonne « Tâche » (modifiée en direct pendant le glissement). */
  protected readonly largeurTache = linkedSignal(() => Math.min(LARGEUR_TACHE.max, Math.max(LARGEUR_TACHE.min, this.ui.ui().taskW || LARGEUR_TACHE.def)));

  /** Échap quitte l'affichage agrandi, sauf si un panneau ou une fenêtre est ouvert (Échap le ferme d'abord). */
  protected quitterPlein(e: Event): void {
    if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (this.plein() && !this.etat.panneau() && !this.etat.fenetre() && !this.etat.confirmation()) this.plein.set(false);
  }

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v || !v.m.months.length) return null;
    const u = this.ui.ui();
    const mois = u.month && v.m.months.includes(u.month) ? u.month : v.m.months.includes(v.moisCourant) ? v.moisCourant : v.m.months[0];
    const cal = v.m.cal;
    const jours = monthDays(mois).map((d) => {
      const h = holidayName(d);
      const hors = (!!cal.debut && d < cal.debut) || (!!cal.finPrevue && d > cal.finPrevue);
      return { d, num: +d.slice(8), lettre: JOURS[dow(d)], ouvre: isWorkday(d), hors, titre: hors ? 'Hors période du projet' : (h ?? '') };
    });
    // filtre « Profil » : les tâches où ce profil est prévu ou a déjà du consommé, avec tous leurs profils
    const profilsFiltre = [...new Set(v.tasks.flatMap((t) => taskProfiles(t)))]
      .filter((i) => v.P[i]?.nom)
      .sort((a, b) => a - b)
      .map((i) => ({ i, nom: v.P[i].nom }));
    const profil = u.profF !== '' && profilsFiltre.some((p) => p.i === +u.profF) ? +u.profF : null;
    const liste = filteredTasks(v, u).filter(
      (t) => !(u.hideDone && (t.statut === 'Validé' || t.annulee)) && (profil === null || taskProfiles(t).includes(profil)),
    );
    const visibles = META_COLS.filter((c) => !this.masquee(v, c.k));
    let gauche = 0;
    const positions: string[] = [];
    for (const c of visibles) {
      positions.push(`--l-${c.k}:${gauche}px`);
      gauche += c.w;
    }
    const lt = this.largeurTache();
    const totalJour: Record<string, number> = {};
    // profil filtré : le total du jour est le sien (on voit d'un coup d'œil s'il dépasse 1 JH)
    for (const j of jours)
      totalJour[j.d] = sum(liste.map((t) => (profil === null ? (t.dayTot[j.d] ?? 0) : num(t.tr.consoP?.[String(profil)]?.[j.d]))));
    return {
      v,
      mois,
      index: v.m.months.indexOf(mois),
      jours,
      liste,
      visibles,
      nbMasquees: META_COLS.length - visibles.length,
      styleGrille: [`--lt:${gauche}px`, `--wt:${lt}px`, `--lp:${gauche + lt}px`, ...positions].join(';'),
      groupes: groupByAxe(v, liste).map(([cle, taches]) => ({
        cle,
        nom: axeName(v, cle),
        couleur: couleurGroupe(v, cle),
        taches,
        phase: v.m.dim.key === 'phase' && !!cle,
        echeance: v.phaseEch[cle] != null,
      })),
      profilsFiltre,
      profil,
      totalJour,
      totalMois: sum(Object.values(totalJour)),
      unDeplie: liste.some((t) => !u.folded[t.uid]),
    };
  });

  /** Colonne masquée ? Celle du critère de regroupement l'est d'office (le bandeau de groupe l'affiche déjà). */
  protected masquee(v: Vue, k: 'id' | 'lot' | 'phase'): boolean {
    const u = this.ui.ui();
    return v.m.dim.key === k ? !u.colForce[k] : !!u.hideCols[k];
  }

  protected masquer(v: Vue, k: 'id' | 'lot' | 'phase', oui: boolean): void {
    const u = this.ui.ui();
    if (v.m.dim.key === k) this.ui.maj({ colForce: { ...u.colForce, [k]: !oui } });
    else {
      const hideCols = { ...u.hideCols };
      if (oui) hideCols[k] = true;
      else delete hideCols[k];
      this.ui.maj({ hideCols });
    }
  }

  protected moisTache(t: TacheVue, jours: { d: string }[]): number {
    return sum(jours.map((j) => t.dayTot[j.d] ?? 0));
  }

  protected lignesProfils(v: Vue, t: TacheVue, jours: { d: string }[]): LigneProfil[] {
    return taskProfiles(t).map((i) => {
      const parJour: Record<string, number> = {};
      for (const [d, x] of Object.entries(t.tr.consoP?.[String(i)] ?? {})) parJour[d] = num(x);
      return {
        i,
        profil: v.P[i],
        parJour,
        mois: sum(jours.map((j) => parJour[j.d] ?? 0)),
        depasse: t.consoP[i] > t.charges[i] + 1e-9,
      };
    });
  }

  /** Plus d'une journée saisie ce jour-là pour cette personne (hors ACHAT / CESSION). */
  protected tropCharge(v: Vue, p: LigneProfil, d: string): boolean {
    return !!p.parJour[d] && !multiJours(p.profil?.entite) && (v.dayLoad[p.i]?.[d] ?? 0) > 1 + 1e-9;
  }

  protected basculer(uid: string): void {
    const folded = { ...this.ui.ui().folded };
    if (folded[uid]) delete folded[uid];
    else folded[uid] = true;
    this.ui.maj({ folded });
  }

  protected replier(liste: TacheVue[], oui: boolean): void {
    const folded = { ...this.ui.ui().folded };
    for (const t of liste) {
      if (oui) folded[t.uid] = true;
      else delete folded[t.uid];
    }
    this.ui.maj({ folded });
  }

  /** Saisie d'une case : contrôles immédiats (comme la version de référence), puis envoi au serveur qui applique toutes les règles. */
  protected saisir(v: Vue, t: TacheVue, p: LigneProfil, d: string, el: HTMLInputElement): void {
    let n = lireNombre(el.value);
    if (n != null && !isNaN(n)) n = round(n, 2); // au centième de JH, comme à l'affichage
    const ancien = p.parJour[d] ?? 0;
    const remettre = () => {
      el.value = ancien ? fJ(ancien) : '';
      el.classList.remove('bad');
    };
    if (n != null && (isNaN(n) || n < 0)) {
      remettre();
      this.etat.afficher('Saisissez un nombre de jours positif, par exemple 0,5 : saisie annulée.', 'erreur');
      return;
    }
    if ((n ?? 0) === ancien) {
      remettre();
      return;
    }
    const multi = multiJours(p.profil?.entite);
    if (!multi && (n ?? 0) > 1 + 1e-9) {
      remettre();
      this.etat.afficher(`Impossible : on ne peut pas saisir plus d’une journée de travail par jour (${fJ(n)} JH saisis).`, 'erreur');
      return;
    }
    const autres = (v.dayLoad[p.i]?.[d] ?? 0) - ancien;
    if (!multi && n && autres + n > 1 + 1e-9) {
      remettre();
      this.etat.afficher(
        `Impossible : ${p.profil?.nom || 'ce profil'} a déjà ${fJ(autres)} JH saisis le ${fD(d)} sur d’autres tâches. Une journée de travail ne dépasse pas 1 JH : il reste ${fJ(Math.max(0, 1 - autres))} JH ce jour-là.`,
        'erreur',
      );
      return;
    }
    const profilId = p.profil?.id;
    if (!profilId) return;
    const valeur = n || null;
    void this.etat.saisir((id) => this.api.consomme(id, t.uid, profilId, d, valeur), {
      siErreur: remettre,
      siSucces: () => (el.value = valeur ? fJ(valeur) : ''),
    });
  }

  // ---------------------------------------------------------------- clavier

  protected selectionner(e: Event): void {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.dataset['c'] != null) el.select();
  }

  /** Flèches haut / bas et Entrée : même jour, ligne suivante ; gauche / droite : jour voisin (en bord de texte). */
  protected clavier(e: Event): void {
    if (!(e instanceof KeyboardEvent)) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.dataset['c'] == null) return;
    const table = el.closest('table');
    if (!table) return;
    const c = +el.dataset['c'];
    let suivant: HTMLInputElement | null | undefined = null;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'ArrowUp') {
      const colonne = [...table.querySelectorAll<HTMLInputElement>(`input[data-c="${c}"]`)].filter((x) => x.offsetParent !== null);
      suivant = colonne[colonne.indexOf(el) + (e.key === 'ArrowUp' ? -1 : 1)];
    } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
      suivant = el.closest('tr')?.querySelector<HTMLInputElement>(`input[data-c="${c - 1}"]`);
    } else if (e.key === 'ArrowRight' && el.selectionEnd === el.value.length) {
      suivant = el.closest('tr')?.querySelector<HTMLInputElement>(`input[data-c="${c + 1}"]`);
    } else return;
    if (suivant) {
      e.preventDefault();
      suivant.focus();
      suivant.select();
    }
  }

  // ---------------------------------------------------------------- largeur de la colonne « Tâche »

  protected debutRedimension(e: PointerEvent): void {
    e.preventDefault();
    const poignee = e.currentTarget as HTMLElement;
    const x0 = e.clientX,
      l0 = this.largeurTache();
    poignee.setPointerCapture(e.pointerId);
    const racine = this.hote.nativeElement.closest('.suivi');
    racine?.classList.add('col-resizing');
    const deplacer = (ev: PointerEvent) => this.largeurTache.set(this.borner(l0 + ev.clientX - x0));
    const fin = () => {
      poignee.removeEventListener('pointermove', deplacer);
      poignee.removeEventListener('pointerup', fin);
      racine?.classList.remove('col-resizing');
      this.ui.maj({ taskW: this.largeurTache() });
    };
    poignee.addEventListener('pointermove', deplacer);
    poignee.addEventListener('pointerup', fin);
  }

  /** Double-clic : ajuster au titre de tâche le plus long (au plus 40 % de la largeur visible). */
  protected ajusterLargeur(): void {
    let besoin = 0;
    this.hote.nativeElement.querySelectorAll('.daygrid tr.tsum .tname').forEach((n) => {
      const w = [...n.children].reduce((a, c) => a + (c as HTMLElement).scrollWidth + 6, 0);
      if (w > besoin) besoin = w;
    });
    const visible = this.hote.nativeElement.querySelector('.daygrid')?.closest('.tw')?.clientWidth ?? window.innerWidth;
    this.ui.maj({ taskW: this.borner(Math.min(besoin + 28, Math.max(LARGEUR_TACHE.min, Math.round(visible * 0.4)))) });
  }

  protected largeurParDefaut(): void {
    this.ui.maj({ taskW: LARGEUR_TACHE.def });
  }

  private borner(w: number): number {
    return Math.round(Math.min(LARGEUR_TACHE.max, Math.max(LARGEUR_TACHE.min, w)));
  }
}
