import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Action, Decision, Risque } from '../api/modeles';
import { Registre, SuiviApi } from '../api/suivi.api';
import { ACT_ST, AVANCEMENTS, DEC_ST, IMPACTS, RISK_IMPACT, RISK_IMPACT_DEF, RISK_PROBA, RISK_PROBA_DEF, RISK_ST, RISK_TYPES } from '../etat/constantes';
import { fD, stCls } from '../etat/formats';
import { joursEntre } from '../etat/outils';
import { surligne } from '../etat/planning.logique';
import { enRetard, extrait, FiltresRegistres, initiales, instancesDuProjet, listesRegistres, norm, personnes, personnesDe, relatif } from '../etat/registres.logique';
import { PANNEAU_REGISTRE, SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { niveauRisque } from '../pages/actions';
import { CarteCommentaires } from '../ui/carte-commentaires';

type Genre = 'act' | 'dec' | 'rk';
const NOM: Record<Genre, string> = { act: 'Action', dec: 'Décision', rk: 'Risque' };
const REGISTRE: Record<Genre, Registre> = { act: 'actions', dec: 'decisions', rk: 'risques' };

/**
 * Panneau latéral d'une action, d'une décision ou d'un risque (version HTML de référence, 55b-registres.js) : tout s'y modifie,
 * champ par champ (le serveur applique les règles : statut ⇔ avancement, date « faite le »…). Personnes : une étiquette par personne.
 * « ▲ ▼ » (Alt + ↑ / ↓) : élément précédent ou suivant de la liste affichée, filtres compris.
 */
@Component({
  selector: 'app-panneau-registre',
  imports: [NgTemplateOutlet, CarteCommentaires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'raccourcis($event)' },
  template: `
    @if (vm(); as m) {
      @let x = m.x;
      @let lect = !m.modif;
      <aside class="drawer" [attr.aria-label]="m.nom + ' ' + x.ref" style="--axc: var(--accent)">
        <div class="dr-head">
          <div class="dr-nav">
            <span class="dr-kind">{{ m.nom }} · {{ x.ref }}</span>
            <button type="button" class="btn sm" [disabled]="m.pos <= 0" title="Précédente dans la liste (Alt + ↑)" (click)="naviguer(-1)">▲</button
            ><button type="button" class="btn sm" [disabled]="m.pos < 0 || m.pos >= m.ordre.length - 1" title="Suivante dans la liste (Alt + ↓)" (click)="naviguer(1)">▼</button>
            <span class="muted">{{ m.pos >= 0 ? m.pos + 1 + ' / ' + m.ordre.length : '' }}</span><span class="spacer"></span>
            <button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
          </div>
          <h2 class="dr-title">
            <textarea
              class="dr-title-in ad-titre"
              rows="2"
              [value]="x.libelle || ''"
              [placeholder]="m.genre === 'act' ? 'Décrivez l’action…' : m.genre === 'dec' ? 'Énoncez la décision…' : 'Décrivez le risque…'"
              [attr.aria-label]="m.nom + ' ' + x.ref + ' : libellé'"
              [disabled]="lect"
              #ti
              (input)="ajuster(ti)"
              (keydown.enter)="$event.preventDefault(); ti.blur()"
              (change)="champ('libelle', ti.value, x.libelle)"
            ></textarea>
          </h2>
          @if (m.meta) {
            <div class="dr-meta">{{ m.meta }}</div>
          }
        </div>
        <div class="dr-body">
          @switch (m.genre) {
            @case ('act') {
              @let a = m.action!;
              <section>
                <h3>Statut et avancement</h3>
                <div class="dr-choices" role="group">
                  @for (s of statutsAct; track s) {
                    <button type="button" class="pill" [class]="'pill st-' + stCls(s) + (s === a.statut ? ' on' : '')" [attr.aria-pressed]="s === a.statut" [disabled]="lect" (click)="champ('statut', s, a.statut)">{{ s }}</button>
                  }
                </div>
                <div class="dr-choices ad-av" role="group" aria-label="Avancement">
                  @for (p of avancements; track p) {
                    <button type="button" class="pill" [class.on]="egal(a.progression, p)" [attr.aria-pressed]="egal(a.progression, p)" [disabled]="lect" (click)="champ('progression', '' + p, '' + a.progression)">{{ round(p * 100) }} %</button>
                  }
                </div>
              </section>
              <section>
                <h3>Qui, quand, où</h3>
                <ng-container *ngTemplateOutlet="persChamp; context: { champ: 'porteur', val: a.porteur, lib: 'Responsable(s)' }" />
                <div class="pl-deux">
                  <label class="field"
                    >Date cible<input class="in" type="date" [value]="a.echeance || ''" [disabled]="lect" #ec (change)="champ('echeance', ec.value || null, a.echeance)" />
                    @if (a.echeance) {
                      <span class="auto"
                        ><span [class.neg]="m.retard">{{ m.retard ? 'En retard de ' + -joursEntre(m.aujourdhui, a.echeance) + ' j' : relatif(a.echeance, m.aujourdhui) }}</span></span
                      >
                    }
                  </label>
                  <ng-container *ngTemplateOutlet="instance; context: { champ: 'origine', val: a.origine }" />
                </div>
                <!-- tâche concernée : la tâche choisie, et une recherche dans les tâches du TSP (intitulé, axe, sous-partie) -->
                <div class="field ad-tache-champ">
                  <span>Tâche concernée <small class="muted">facultative</small></span>
                  @if (m.tache; as t) {
                    <div class="ad-tache-ch">
                      <span
                        ><b>{{ t.label }}</b><small>{{ ou(t.uid) }}</small></span
                      ><button type="button" class="btn sm ghost" title="Ouvrir la tâche" (click)="ouvrirTache(t.uid)">Ouvrir ↗</button>
                      @if (!lect) {
                        <button type="button" class="btn sm ghost" title="Retirer le lien" aria-label="Retirer la tâche concernée" (click)="lierTache('')">✕</button>
                      }
                    </div>
                  }
                  @if (!lect) {
                    <div class="pl-rech ad-tache-rech">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
                      <input
                        class="in"
                        type="search"
                        [value]="rechTache()"
                        [placeholder]="m.tache ? 'Changer de tâche : rechercher…' : 'Rechercher une tâche (intitulé, axe…)'"
                        autocomplete="off"
                        aria-label="Rechercher une tâche du TSP"
                        #tq
                        (input)="rechTache.set(tq.value)"
                        (keydown.escape)="viderRecherche($event, tq)"
                        (keydown.arrowdown)="$event.preventDefault(); premiereOption()"
                      />
                    </div>
                    @if (m.q) {
                      <div class="ad-tache-res" role="listbox">
                        @for (y of m.resultats; track y.uid) {
                          @let s = surligne(y.label, m.q);
                          <button type="button" class="ad-tache-o" role="option" (click)="lierTache(y.uid)">
                            <span
                              >{{ s.avant }}
                              @if (s.trouve) {
                                <mark>{{ s.trouve }}</mark>{{ s.apres }}
                              }</span
                            ><small>{{ ou(y.uid) }}</small>
                          </button>
                        } @empty {
                          <p class="empty">Aucune tâche ne contient « {{ rechTache().trim() }} ».</p>
                        }
                        @if (m.nbResultats > m.resultats.length) {
                          <p class="muted ad-tache-plus">{{ m.nbResultats - m.resultats.length }} autre(s) : précisez la recherche.</p>
                        }
                      </div>
                    }
                  }
                </div>
              </section>
              <app-carte-commentaires [cibleType]="'Action'" [cibleId]="a.id" [cle]="'act:' + a.id" [ancienCommentaire]="a.commentaire" />
            }
            @case ('dec') {
              @let d = m.decision!;
              <section>
                <h3>Statut</h3>
                <div class="dr-choices" role="group">
                  @for (s of statutsDec; track s) {
                    <button
                      type="button"
                      class="pill"
                      [class]="'pill ' + (s === 'Validée' ? 'st-valide' : s === 'À valider' ? 'st-test' : 'st-bloque') + (s === d.statut ? ' on' : '')"
                      [attr.aria-pressed]="s === d.statut"
                      [disabled]="lect"
                      (click)="champ('statut', s, d.statut)"
                    >
                      {{ s }}
                    </button>
                  }
                </div>
              </section>
              <section>
                <h3>Quand, qui, où</h3>
                <div class="pl-deux">
                  <label class="field"
                    >Date<input class="in" type="date" [value]="d.date || ''" [disabled]="lect" #dd (change)="champ('date', dd.value || null, d.date)" />
                    @if (d.date) {
                      <span class="auto">{{ relatif(d.date, m.aujourdhui) }}</span>
                    }
                  </label>
                  <ng-container *ngTemplateOutlet="instance; context: { champ: 'instance', val: d.instance }" />
                </div>
                <ng-container *ngTemplateOutlet="persChamp; context: { champ: 'decideur', val: d.decideur, lib: 'Décideur(s)' }" />
                <label class="field"
                  >Impact
                  <select class="in" [disabled]="lect" #im (change)="champ('impact', im.value, d.impact)">
                    @for (o of impacts; track o) {
                      <option [value]="o" [selected]="o === (d.impact || '')">{{ o || '—' }}</option>
                    }
                  </select>
                </label>
              </section>
              <app-carte-commentaires [cibleType]="'Decision'" [cibleId]="d.id" [cle]="'dec:' + d.id" [ancienCommentaire]="d.commentaire" />
            }
            @case ('rk') {
              @let r = m.risque!;
              @let nv = niveau(r.crit || 0);
              <section>
                <h3>
                  Évaluation <span class="pill ad-crit" [class]="'pill ad-crit lv-' + nv[0]" title="Probabilité × importance, sur 16">{{ nv[1] }} · {{ r.crit || 0 }}</span>
                </h3>
                <div class="ad-eval">
                  <span>Probabilité</span>
                  <ng-container *ngTemplateOutlet="choixSimple; context: { champ: 'proba', opts: probas, val: r.proba || probaDef }" />
                </div>
                <div class="ad-eval">
                  <span>Importance</span>
                  <ng-container *ngTemplateOutlet="choixSimple; context: { champ: 'impact', opts: importances, val: r.impact || impactDef }" />
                </div>
                <div class="ad-eval">
                  <span>Statut</span>
                  <ng-container *ngTemplateOutlet="choixSimple; context: { champ: 'statut', opts: statutsRk, val: r.statut || 'Ouvert' }" />
                </div>
              </section>
              <section>
                <h3>Type</h3>
                <div class="dr-choices" role="group">
                  @for (t of typesRk; track t[0]) {
                    <button type="button" class="pill" [class.on]="t[0] === (r.type || '')" [attr.aria-pressed]="t[0] === (r.type || '')" [disabled]="lect" (click)="champ('type', t[0], r.type || '')">
                      {{ t[1] }}
                    </button>
                  }
                </div>
              </section>
              <section>
                <ng-container *ngTemplateOutlet="zone; context: { champ: 'cause', lib: 'Cause', aide: 'D’où vient le risque ? Ex. disponibilité des acteurs, retard de validation…', rows: 3, val: r.cause }" />
                <ng-container *ngTemplateOutlet="zone; context: { champ: 'parade', lib: 'Comment réduire', aide: 'Que fait-on pour que le risque ne survienne pas, ou pèse moins ?', rows: 3, val: r.parade }" />
                <ng-container
                  *ngTemplateOutlet="zone; context: { champ: 'plan', lib: 'Plan d’actions', aide: 'Les actions concrètes prévues (ateliers, relances, communication…). Liez aussi une action du registre ci-dessous.', rows: 3, val: r.plan }"
                />
              </section>
              <section>
                <h3>Qui, quoi</h3>
                <ng-container *ngTemplateOutlet="persChamp; context: { champ: 'responsable', val: r.responsable, lib: 'Responsable(s)' }" />
                <label class="field"
                  >Action liée
                  <select class="in" [disabled]="lect" #al (change)="champ('action', al.value, r.action || '')">
                    <option value="" [selected]="!r.action">—</option>
                    @for (a of m.actions; track a.id) {
                      <option [value]="a.id" [selected]="a.id === r.action">{{ a.ref }} · {{ extrait(a.libelle, 60) }}</option>
                    }
                  </select>
                  @if (m.actionLiee; as act) {
                    <span class="auto"><button type="button" class="linkbtn" (click)="etat.ouvrirRegistre('act:' + act.id)">Ouvrir {{ act.ref }}</button></span>
                  }
                </label>
              </section>
              <app-carte-commentaires [cibleType]="'Risque'" [cibleId]="r.id" [cle]="'rk:' + r.id" [ancienCommentaire]="r.commentaire" />
            }
          }
          <datalist id="dl-ad-pers">
            @for (p of m.suggestions; track p) {
              <option [value]="p"></option>
            }
          </datalist>
          @if (!lect) {
            <div class="ad-pied">
              <span class="ad-note-enr">Chaque modification est enregistrée aussitôt et reprise dans les exports COPROJ et COPIL.</span
              ><button type="button" class="btn sm danger-ghost" (click)="supprimer()">Supprimer {{ m.genre === 'act' ? 'l’action' : m.genre === 'dec' ? 'la décision' : 'le risque' }}</button>
            </div>
          }
        </div>
      </aside>

      <ng-template #instance let-cle="champ" let-val="val">
        <label class="field"
          >Instance
          <select class="in" [disabled]="!m.modif" #ins (change)="champ(cle, ins.value, val)">
            @if (val && !m.instances.includes(val)) {
              <option [value]="val" selected>{{ val }} (retirée de la liste)</option>
            }
            @for (o of m.instances; track o) {
              <option [value]="o" [selected]="o === val">{{ o }}</option>
            }
          </select>
          <span class="auto"><button type="button" class="linkbtn" (click)="gererInstances()">Gérer les instances</button></span>
        </label>
      </ng-template>

      <ng-template #choixSimple let-cle="champ" let-opts="opts" let-val="val">
        <div class="dr-choices" role="group">
          @for (o of opts; track o) {
            <button type="button" class="pill" [class.on]="o === val" [attr.aria-pressed]="o === val" [disabled]="!m.modif" (click)="champ(cle, o, val)">{{ o }}</button>
          }
        </div>
      </ng-template>

      <ng-template #zone let-cle="champ" let-lib="lib" let-aide="aide" let-rows="rows" let-val="val">
        <label class="field ad-zone"
          >{{ lib }}
          <textarea class="in" [rows]="rows" [placeholder]="aide" [value]="val || ''" [disabled]="!m.modif" #z (change)="champ(cle, z.value, val || '')"></textarea>
        </label>
      </ng-template>

      <!-- personnes : une étiquette par personne (retirer d'un clic), un champ pour en ajouter (Entrée, virgule ou liste) -->
      <ng-template #persChamp let-cle="champ" let-val="val" let-lib="lib">
        @let l = personnes(val);
        <div class="field ad-pers-champ">
          <span>{{ lib }}</span>
          <div class="ad-tokens">
            @for (p of l; track $index; let i = $index) {
              <span class="ad-pers"
                ><i aria-hidden="true">{{ initiales(p) }}</i>{{ p }}
                @if (m.modif) {
                  <button type="button" [attr.aria-label]="'Retirer ' + p" title="Retirer" (click)="retirerPersonne(cle, val, i)">✕</button>
                }
              </span>
            }
            @if (m.modif) {
              <input
                class="ad-tok-in"
                list="dl-ad-pers"
                [placeholder]="l.length ? 'Ajouter une personne…' : 'Nom, puis Entrée'"
                [attr.aria-label]="'Ajouter : ' + lib"
                #pa
                (keydown.enter)="$event.preventDefault(); ajouterPersonne(cle, val, pa)"
                (keydown)="virgule($event, cle, val, pa)"
                (change)="ajouterPersonne(cle, val, pa)"
              />
            }
          </div>
        </div>
      </ng-template>
    }
  `,
})
export class PanneauRegistre {
  /** « act:<id> », « dec:<id> » ou « rk:<id> ». */
  readonly spec = input.required<string>();
  protected readonly etat = inject(SuiviEtat);
  private readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);

  protected readonly fD = fD;
  protected readonly stCls = stCls;
  protected readonly round = Math.round;
  protected readonly joursEntre = joursEntre;
  protected readonly relatif = relatif;
  protected readonly extrait = extrait;
  protected readonly personnes = personnes;
  protected readonly initiales = initiales;
  protected readonly surligne = surligne;
  protected readonly niveau = niveauRisque;
  protected readonly statutsAct = ACT_ST;
  protected readonly statutsDec = DEC_ST;
  protected readonly statutsRk = RISK_ST;
  protected readonly avancements = AVANCEMENTS;
  protected readonly impacts = IMPACTS;
  protected readonly probas = RISK_PROBA;
  protected readonly importances = RISK_IMPACT;
  protected readonly probaDef = RISK_PROBA_DEF;
  protected readonly impactDef = RISK_IMPACT_DEF;
  protected readonly typesRk: [string, string][] = [...RISK_TYPES.map((t): [string, string] => [t, t]), ['', 'Non précisé']];
  /** Recherche de la tâche concernée (repart vide sur un autre élément). */
  protected readonly rechTache = signal('');

  constructor() {
    effect(() => {
      this.spec();
      this.rechTache.set('');
    });
    // le libellé s'ajuste à sa hauteur
    effect(() => {
      this.vm();
      setTimeout(() => {
        const ta = this.hote.nativeElement.querySelector<HTMLTextAreaElement>('.ad-titre');
        if (ta) this.ajuster(ta);
      });
    });
  }

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const [genre, id] = this.spec().split(':') as [Genre, string];
    const liste: (Action | Decision | Risque)[] = genre === 'act' ? v.projet.actions : genre === 'dec' ? v.projet.decisions : v.projet.risques;
    const x = liste.find((y) => y.id === id);
    if (!x) return null;
    const l = listesRegistres(
      { actions: v.projet.actions, decisions: v.projet.decisions, risques: v.projet.risques, risquesOuverts: new Set(v.risquesOuverts.map((r) => r.id)) },
      this.ui.ui() as FiltresRegistres,
      v.aujourdhui,
    );
    const ordre = l.ordre[genre];
    const action = genre === 'act' ? (x as Action) : null;
    const risque = genre === 'rk' ? (x as Risque) : null;
    const q = norm(this.rechTache());
    const tous = q ? v.tasks.filter((y) => !y.annulee && norm(`${y.label} ${this.ou(y.uid)}`).includes(q)) : [];
    const suggestions = [
      ...new Set([
        ...v.personnes.flatMap(personnes),
        ...personnesDe([...v.projet.actions.map((a) => a.porteur), ...v.projet.decisions.map((d) => d.decideur), ...v.projet.risques.map((r) => r.responsable)]).map((p) => p.nom),
      ]),
    ].sort((a, b) => a.localeCompare(b, 'fr'));
    let meta = '';
    if (action) meta = `Créée le ${fD(action.cree)}${action.par ? ' par ' + action.par : ''}${action.faitLe ? ` · faite le ${fD(action.faitLe)}` : ''}`;
    else if (risque) meta = `Créé le ${fD((risque as Risque & { cree?: string }).cree)}${(risque as Risque & { par?: string }).par ? ' par ' + (risque as Risque & { par?: string }).par : ''}`;
    else meta = (x as Decision).par ? `Saisie par ${(x as Decision).par}` : '';
    return {
      genre,
      x,
      nom: NOM[genre],
      modif: v.droits.peutModifier,
      aujourdhui: v.aujourdhui,
      ordre,
      pos: ordre.indexOf(this.spec()),
      meta,
      action,
      decision: genre === 'dec' ? (x as Decision) : null,
      risque,
      retard: action ? enRetard(action, v.aujourdhui) : false,
      tache: action?.tache ? (v.parUid.get(action.tache) ?? null) : null,
      q,
      resultats: tous.slice(0, 8),
      nbResultats: tous.length,
      instances: instancesDuProjet(v),
      actions: v.projet.actions,
      actionLiee: risque?.action ? (v.projet.actions.find((a) => a.id === risque.action) ?? null) : null,
      suggestions,
    };
  });

  /** Axe et sous-partie d'une tâche (« Axe 1 · Cadrage »). */
  protected ou(uid: string): string {
    const v = this.etat.vue();
    const t = v?.parUid.get(uid);
    if (!v || !t) return '';
    const ax = v.m.axes.find((g) => g.id === (t.grp || ''));
    const sp = ax?.sousParties?.find((s) => s.uids.includes(uid));
    return [ax?.nom, sp?.nom].filter(Boolean).join(' · ');
  }

  protected egal(a: number, b: number): boolean {
    return Math.abs((a || 0) - b) < 1e-9;
  }

  protected ajuster(ta: HTMLTextAreaElement): void {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  /** Enregistre un champ (le serveur applique les règles : statut et avancement restent cohérents). */
  protected champ(champ: string, valeur: string | null, ancien: string | number | null | undefined): void {
    const m = this.vm();
    if (!m) return;
    const v = typeof valeur === 'string' ? valeur.trim() : valeur;
    if ((v ?? '') === String(ancien ?? '')) return;
    const registre = REGISTRE[m.genre];
    const id = m.x.id;
    void this.etat.saisir((pid) => this.api.modifier(pid, registre, id, { champ, valeur: v, version: this.etat.versionLigne(registre, id) }));
  }

  protected ajouterPersonne(champ: string, val: string, el: HTMLInputElement): void {
    const neuves = personnes(el.value);
    if (!neuves.length) return;
    const l = personnes(val);
    const ajout = neuves.filter((p) => !l.some((q) => norm(q) === norm(p)));
    el.value = '';
    if (!ajout.length) {
      this.etat.afficher('Déjà dans la liste.', 'info');
      return;
    }
    this.champ(champ, [...l, ...ajout].join(' / '), val);
  }

  protected virgule(e: KeyboardEvent, champ: string, val: string, el: HTMLInputElement): void {
    if (e.key !== ',') return;
    e.preventDefault();
    this.ajouterPersonne(champ, val, el);
  }

  protected retirerPersonne(champ: string, val: string, i: number): void {
    const l = personnes(val);
    l.splice(i, 1);
    this.champ(champ, l.join(' / '), val);
  }

  protected lierTache(uid: string): void {
    const a = this.vm()?.action;
    if (!a) return;
    this.rechTache.set('');
    void this.etat.saisir((pid) => this.api.modifier(pid, 'actions', a.id, { champ: 'tache', valeur: uid || null, version: this.etat.versionLigne('actions', a.id) }), {
      siSucces: () => this.etat.afficher(uid ? 'Tâche concernée enregistrée.' : 'Lien vers la tâche retiré.', 'succes'),
    });
  }

  /** Tâche ouverte depuis l'action : « ‹ A-001 » ramène à l'action. */
  protected ouvrirTache(uid: string): void {
    this.etat.ouvrirTache(uid, null, null, this.spec());
  }

  protected viderRecherche(e: Event, el: HTMLInputElement): void {
    if (!el.value) return;
    e.preventDefault();
    e.stopPropagation();
    el.value = '';
    this.rechTache.set('');
  }

  protected premiereOption(): void {
    this.hote.nativeElement.querySelector<HTMLElement>('.ad-tache-o')?.focus();
  }

  protected gererInstances(): void {
    this.etat.fermerPanneau();
    void this.router.navigate(['/projets', this.etat.projetId(), 'parametres']);
  }

  protected naviguer(pas: number): void {
    const m = this.vm();
    if (!m) return;
    const n = m.ordre[m.pos + pas];
    if (!n) return;
    this.etat.ouvrirRegistre(n);
    document.querySelector(`[data-adopen="${CSS.escape(n)}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  /** Alt + ↑ / ↓ : élément précédent ou suivant. */
  protected raccourcis(e: KeyboardEvent): void {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    if (!this.etat.panneau()?.startsWith(PANNEAU_REGISTRE)) return;
    e.preventDefault();
    this.naviguer(e.key === 'ArrowUp' ? -1 : 1);
  }

  protected async supprimer(): Promise<void> {
    const m = this.vm();
    if (!m) return;
    const x = m.x;
    if (x.libelle) {
      const nom = m.genre === 'act' ? 'l’action' : m.genre === 'dec' ? 'la décision' : 'le risque';
      const note =
        m.genre === 'act'
          ? 'Pour garder la trace d’une action qui n’a plus lieu d’être, préférez le statut « Annulée ».'
          : m.genre === 'rk'
            ? 'Pour garder la trace d’un risque écarté, préférez le statut « Clos ».'
            : undefined;
      const ok = await this.etat.confirmer(`Supprimer ${nom} ${x.ref} ?`, [`« ${x.libelle} »`], 'Supprimer', note ? { note } : {});
      if (!ok) return;
    }
    const r = await this.etat.saisir((pid) => this.api.supprimerLigne(pid, REGISTRE[m.genre], x.id));
    if (r) this.etat.fermerPanneau();
  }
}
