import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { fD, fE, fJ, fP, stSlug } from '../etat/formats';
import { joursEntre } from '../etat/outils';
import { avantPossible, cleTache, filtreDe, retardLigne, sansAccent, surligne, toutesLesLignes, trouve } from '../etat/planning.logique';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { defaultAxeName, TacheVue } from '../etat/vue';

const PUNAISE = 'M9 3h6l-1 6 3 3v2H7v-2l3-3z';
const FILTRES: [string, string][] = [
  ['tous', 'Toutes'],
  ['afaire', 'À faire'],
  ['encours', 'En cours'],
  ['valide', 'Validées'],
];

/**
 * Volet d'une ligne du Planning (axe, lot, phase ou sous-partie), version HTML de référence (56b-planning.js) :
 * afficher ou masquer la ligne, nom (axe ou sous-partie), dates prévues (saisies, sinon calculées depuis les tâches),
 * réel, sous-parties et tâches avec recherche et filtre ; la punaise affiche l'élément sous sa ligne sur le planning.
 */
@Component({
  selector: 'app-panneau-planning',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let g = m.g;
      <aside class="drawer" [attr.aria-label]="'Planning : ' + g.nom" [style.--axc]="'var(--ax' + (m.idx % 8) + ')'">
        <div class="dr-head">
          <div class="dr-nav">
            <span class="dr-kind">{{ m.kind }}</span><span class="spacer"></span
            ><button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
          </div>
          <h2 class="dr-title">{{ g.nom }}</h2>
          <div class="dr-meta">
            {{ m.actives.length }} tâche(s){{ m.annulees ? ' · ' + m.annulees + ' annulée(s), masquée(s)' : '' }} · {{ fJ(g.conso) }} / {{ fJ(g.prevu) }} JH consommés
          </div>
        </div>
        <div class="dr-body">
          @if (!m.sous) {
            <label class="pl-case-t"
              ><input type="checkbox" [checked]="!m.masquee" [disabled]="!m.modif" #vis (change)="masquer(!vis.checked)" /><span
                ><b>Afficher sur le planning</b><small>Décochée, la ligne est masquée de la vue d’ensemble et du PowerPoint. Rien n’est supprimé.</small></span
              ></label
            >
          }
          @if (m.sous) {
            <section>
              <label class="field pl-champ"
                >Nom de la sous-partie
                <input class="in" maxlength="200" [value]="g.nom" [placeholder]="m.nomTSP" [disabled]="!m.modif" #ns (change)="nommerSousPartie(ns.value)" (keydown.enter)="ns.blur()" />
              </label>
              @if (g.nom !== m.nomTSP && m.nomTSP) {
                <span class="auto">Nom d’origine : {{ m.nomTSP }}</span>
              }
            </section>
          } @else if (m.dim === 'id' && m.id) {
            <section>
              <label class="field pl-champ"
                >Nom de l’axe
                <input class="in" maxlength="200" [value]="m.nomAxe" [placeholder]="defaultAxeName(m.id)" [disabled]="!m.modif" #na (change)="nommerAxe(m.id, na.value)" (keydown.enter)="na.blur()" />
              </label>
              <label class="field pl-champ">Date limite
                <input class="in" type="date" [value]="m.dateLimite ?? ''" [disabled]="!m.modif" #dl (change)="definirAxe(m.id, m.nomAxe, dl.value || null)" />
              </label>
              <label class="field pl-champ">Échéance de facturation
                <select class="in" [value]="m.echeanceAxe?.n ?? ''" [disabled]="!m.modif" #ea (change)="lierEcheanceAxe(m.id, m.echeanceAxe?.n ?? null, ea.value)">
                  <option value="">— Aucune —</option>
                  @for (e of v.m.echeancier; track e.n) {
                    <option [value]="e.n" [disabled]="!!e.realiseLe && m.echeanceAxe?.n !== e.n">n° {{ e.n }} · {{ e.nom }}</option>
                  }
                </select>
              </label>
              @if (m.echeanceAxe; as ea) {
                <span class="auto">Lié à l’échéance n° {{ ea.n }} · {{ fE(ea.montant) }}. Toutes les tâches de l’axe, y compris les ajouts futurs, suivent cette échéance.</span>
              }
              @if (m.etatDateLimite; as edl) {
                <span class="pill" [class]="'pill lv-' + (edl.niveau || 'neutre')">{{ edl.libelle }}</span>
                @if (edl.auDela.length) {
                  <div class="pl-dl-alert" role="status">
                    {{ edl.auDela.length }} tâche(s) finissent après le {{ fD(edl.date) }} :
                    @for (t of edl.auDela.slice(0, 4); track t.uid; let last = $last) {
                      <button type="button" class="linkbtn" [attr.data-open]="t.uid">{{ t.libelle }}</button>{{ last ? '' : ' · ' }}
                    }
                  </div>
                }
              }
              <span class="auto">Utilisé partout (tableaux, Gantt, exports), comme dans les paramètres du projet.</span>
            </section>
          } @else if (m.dim === 'lot' && m.id) {
            <section>
              <label class="field pl-champ">Nom du lot
                <input class="in" maxlength="200" [value]="m.nomLot" [placeholder]="'Lot ' + m.id" [disabled]="!m.modif" #nl (change)="nommerLot(m.id, nl.value)" (keydown.enter)="nl.blur()" />
              </label>
              <span class="auto">Code du TSP (colonne B) : {{ m.id }}. Le code ne change pas : seul le nom affiché change.</span>
            </section>
          }

          @if (m.axeCalc) {
            <section>
              <h3>Dates prévues <small>calculées</small></h3>
              <div class="dr-kpis pl-kpis2">
                <div><span>Début prévu</span><b>{{ fD(g.planDebut) }}</b></div>
                <div><span>Fin prévue</span><b>{{ fD(g.planFin) }}</b></div>
              </div>
              <div class="pl-etat">
                <span class="pl-pastille">Calculées</span
                ><span>{{
                  g.planDebut || g.planFin
                    ? m.sousParties.length
                      ? 'Du plus tôt au plus tard de ses sous-parties (leurs dates saisies, sinon celles de leurs tâches) et de ses tâches placées sous aucun titre. Pour les changer, modifiez une sous-partie ou une tâche.'
                      : 'Du premier début prévu à la dernière fin prévue de ses tâches. Pour les changer, modifiez une tâche.'
                    : 'Rien n’est encore daté : ' + (m.sousParties.length ? 'datez une sous-partie ci-dessous ou une tâche' : 'datez une tâche') + '.'
                }}</span>
              </div>
              @if (m.planAncien; as pa) {
                <div class="ph-alert ph-warn">
                  <b>Ancienne date saisie sur l’axe, plus utilisée</b>
                  <div>
                    {{ pa.debut ? fD(pa.debut) : '…' }} → {{ pa.fin ? fD(pa.fin) : '…' }} : l’axe reprend désormais ses sous-parties. Reportez ces dates sur les sous-parties
                    concernées.
                    @if (m.modif) {
                      <button type="button" class="linkbtn" (click)="effacer()">Effacer cette ancienne date</button>
                    }
                  </div>
                </div>
              }
            </section>
          } @else {
            <section>
              <h3>Dates prévues</h3>
              <div class="pl-deux">
                <label class="field"
                  >Début prévu<input class="in" type="date" [value]="g.planDebut || ''" [disabled]="!m.modif" #db (change)="dater('debut', db)"
                /></label>
                <label class="field">Fin prévue<input class="in" type="date" [value]="g.planFin || ''" [disabled]="!m.modif" #fn (change)="dater('fin', fn)" /></label>
              </div>
              <div class="pl-etat">
                <span class="pl-pastille" [class.saisi]="g.planSaisi">{{ m.etatDates }}</span><span>{{ m.texteEtat }}</span>
                @if (g.planSaisi && m.modif) {
                  <button type="button" class="linkbtn" (click)="effacer()">Revenir aux dates des tâches</button>
                }
              </div>
              @if (m.hors.length) {
                <div class="ph-alert ph-warn">
                  <b>Hors de la période prévue</b>
                  <div>
                    @for (t of m.hors.slice(0, 4); track t.uid; let last = $last) {
                      <button type="button" class="linkbtn" (click)="ouvrirTache(t.uid)">{{ t.label }}</button>{{ last ? '' : ' · ' }}
                    }
                    {{ m.hors.length > 4 ? ' · et ' + (m.hors.length - 4) + ' autre(s)' : '' }}
                  </div>
                </div>
              }
            </section>
          }

          <section>
            <h3>Réel <small>jours de consommé saisis</small></h3>
            <div class="dr-kpis">
              <div><span>Début réel</span><b>{{ fD(g.reelDebut) }}</b></div>
              <div><span>Dernier consommé</span><b>{{ fD(g.reelFin) }}</b></div>
              <div><span>Avancement</span><b>{{ fP(g.avancement) }}</b></div>
            </div>
            @if (m.retard) {
              <div class="ph-alert ph-crit">
                <b>Fin prévue dépassée de {{ m.joursRetard }} jour(s)</b>
                <div>
                  {{ g.statut === 'Validé' ? 'Dernier consommé le ' + fD(g.reelFin) + ' pour une fin prévue le ' + fD(g.planFin) + '.' : m.nonValidees + ' tâche(s) ne sont pas validées.' }}
                </div>
              </div>
            }
          </section>

          @if (m.actives.length + m.sousParties.length > 6) {
            <div class="pl-rech" role="search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                class="in"
                type="search"
                [value]="m.rech"
                [placeholder]="'Rechercher ' + (m.sousParties.length ? 'une sous-partie ou ' : '') + 'une tâche'"
                [attr.aria-label]="'Rechercher ' + (m.sousParties.length ? 'une sous-partie ou ' : '') + 'une tâche de ' + g.nom"
                autocomplete="off"
                spellcheck="false"
                #rq
                (input)="rechercher(rq.value)"
                (keydown.escape)="viderRecherche($event, rq)"
              />
              @if (m.rech) {
                <button type="button" class="pl-rech-x" aria-label="Effacer la recherche" title="Effacer (Échap)" (click)="rechercher('')">✕</button>
              }
            </div>
          }

          @if (m.sousVues.length) {
            <section>
              <h3>Sous-parties <small>lignes de titre du TSP</small></h3>
              <ng-container *ngTemplateOutlet="aide; context: { $implicit: m }" />
              <div class="pl-sous-l">
                @for (x of m.sousVues; track x.cle) {
                  <div class="pl-trow">
                    <ng-container *ngTemplateOutlet="pin; context: { cle: x.cle, nom: x.nom, on: !!m.avant[x.cle ?? ''], modif: m.modif }" />
                    <button type="button" class="ph-task pl-task" (click)="etat.ouvrirLignePlanning(x.cle ?? '')">
                      <span class="ph-t-l"
                        ><ng-container *ngTemplateOutlet="marque; context: { $implicit: x.nom, q: m.q }" /><small
                          >{{ x.uids.length }} tâche(s){{ x.planDebut && x.planFin ? ' · prévu ' + fD(x.planDebut) + ' → ' + fD(x.planFin) : '' }}</small
                        ></span
                      >
                    </button>
                  </div>
                }
              </div>
            </section>
          }

          <section>
            <h3>Tâches</h3>
            @if (!m.sousVues.length) {
              <ng-container *ngTemplateOutlet="aide; context: { $implicit: m }" />
            }
            <div class="pl-puces" role="group" aria-label="Filtrer les tâches">
              @for (f of filtres; track f[0]) {
                <button type="button" class="pl-puce" [attr.aria-pressed]="m.filtre === f[0]" (click)="ui.maj({ plFiltre: f[0] })">{{ f[1] }} · {{ m.nb[f[0]] }}</button>
              }
            </div>
            <span class="auto">En cours : en cours, en recette, bloquées ou en attente.</span>
            <div class="ph-tasks">
              @for (t of m.liste; track t.uid) {
                @if (m.pins) {
                  <div class="pl-trow">
                    <ng-container *ngTemplateOutlet="pin; context: { cle: cleTache(t.uid), nom: t.label, on: !!m.avant[cleTache(t.uid)], modif: m.modif }" />
                    <ng-container *ngTemplateOutlet="ligneTache; context: { $implicit: t, q: m.q }" />
                  </div>
                } @else {
                  <ng-container *ngTemplateOutlet="ligneTache; context: { $implicit: t, q: m.q }" />
                }
              } @empty {
                @if (m.q && !m.trouvees.length) {
                  <p class="empty">
                    Aucune tâche ne contient « {{ m.rech.trim() }} ». <button type="button" class="linkbtn" (click)="rechercher('')">Effacer la recherche</button>
                  </p>
                } @else {
                  <p class="empty">Aucune tâche pour ce filtre.</p>
                }
              }
            </div>
          </section>
        </div>
      </aside>

      <ng-template #aide let-m>
        @if (m.pins) {
          <div class="pl-aide-pin">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path [attr.d]="punaise" fill="currentColor" /><path d="M12 14v7" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            <span
              >@if (m.nbPin) {
                <b>{{ m.nbPin }} mis en avant</b> ·
              }
              punaise = affiché sous {{ m.dim === 'id' ? 'l’axe' : 'la phase' }} sur le planning</span
            >
          </div>
        }
      </ng-template>

      <ng-template #pin let-cle="cle" let-nom="nom" let-on="on" let-modif="modif">
        <button
          type="button"
          class="pl-pin"
          [class.on]="on"
          [attr.aria-pressed]="on"
          [disabled]="!modif"
          [attr.aria-label]="(on ? 'Retirer' : 'Afficher') + ' « ' + nom + ' » ' + (on ? 'du' : 'sur le') + ' planning'"
          [title]="on ? 'Retirer du planning' : 'Afficher sur le planning'"
          (click)="mettreEnAvant(cle, !on)"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            @if (on) {
              <path [attr.d]="punaise" fill="currentColor" /><path d="M12 14v7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            } @else {
              <path [attr.d]="punaise" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /><path
                d="M12 14v7"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            }
          </svg>
        </button>
      </ng-template>

      <ng-template #ligneTache let-t let-q="q">
        <button type="button" class="ph-task pl-task" (click)="ouvrirTache(t.uid)">
          <span class="ph-t-l"
            ><ng-container *ngTemplateOutlet="marque; context: { $implicit: t.label, q: q }" /><small>{{ dates(t) }}</small></span
          ><span class="pill xs" [class]="'pill xs st-' + stSlug(t.statut)">{{ t.statut }}</span
          ><span class="num muted">{{ fJ(t.consoTotal) }} / {{ fJ(t.charge) }} JH</span>
        </button>
      </ng-template>

      <ng-template #marque let-texte let-q="q">
        @let s = surligne(texte, q);
        {{ s.avant }}
        @if (s.trouve) {
          <mark>{{ s.trouve }}</mark>{{ s.apres }}
        }
      </ng-template>
    }
  `,
})
export class PanneauPlanning {
  /** Clé de la ligne (« id|AXE1 », « phase|X », « sec|r12|AXE1 »…). */
  readonly cle = input.required<string>();
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly stSlug = stSlug;
  protected readonly surligne = surligne;
  protected readonly cleTache = cleTache;
  protected readonly defaultAxeName = defaultAxeName;
  protected readonly filtres = FILTRES;
  protected readonly punaise = PUNAISE;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const l = toutesLesLignes(v.m.axes).find((x) => x.g.cle === this.cle());
    if (!l) return null;
    const u = this.ui.ui();
    const g = l.g;
    const dim = v.m.dim.key;
    const sp = l.sous ? (g as { uids: string[]; nomTSP: string }) : null;
    const toutes = v.tasks.filter((t) => (sp ? sp.uids.includes(t.uid) : (t.grp || '') === (g as { id: string }).id));
    const actives = toutes.filter((t) => !t.annulee);
    const rech = u.plRechCle === this.cle() ? u.plRech : '';
    const q = sansAccent(rech.trim());
    const trouvees = actives.filter((t) => trouve(t.label, q));
    const filtre = ['afaire', 'encours', 'valide'].includes(u.plFiltre) ? u.plFiltre : 'tous';
    const nb: Record<string, number> = { tous: trouvees.length, afaire: 0, encours: 0, valide: 0 };
    for (const t of trouvees) nb[filtreDe(t)]++;
    const liste = trouvees.filter((t) => filtre === 'tous' || filtreDe(t) === filtre);
    const retard = retardLigne(g, v.aujourdhui);
    const hors = g.planSaisi
      ? actives.filter((t) => (t.tr.debut && g.planDebut && t.tr.debut < g.planDebut) || (t.tr.fin && g.planFin && t.tr.fin > g.planFin))
      : [];
    const groupe = l.sous ? null : v.m.axes[l.idx];
    const sousParties = !l.sous && dim === 'id' ? (groupe?.sousParties ?? []) : [];
    const avant = v.projet.planning?.avant ?? {};
    const pins = avantPossible(dim);
    return {
      g,
      idx: l.idx,
      sous: l.sous,
      dim,
      id: groupe?.id ?? '',
      kind: l.sous ? `Sous-partie · ${l.parent?.nom ?? ''}` : v.m.dim.label,
      modif: v.droits.peutModifier,
      masquee: !!v.projet.planning?.masque?.[this.cle()],
      nomTSP: sp?.nomTSP ?? '',
      nomAxe: groupe ? (v.projet.axes?.[groupe.id] ?? '') : '',
      dateLimite: groupe && dim === 'id' ? (v.projet.datesLimitesAxes?.[groupe.id] ?? null) : null,
      etatDateLimite: groupe && dim === 'id' ? (v.m.datesLimitesAxes?.find((x) => x.code === groupe.id) ?? null) : null,
      echeanceAxe: groupe && dim === 'id' ? (v.m.echeancier.find((e) => e.axeCode === groupe.id) ?? null) : null,
      nomLot: groupe && dim === 'lot' ? (v.projet.lots?.[groupe.id] ?? '') : '',
      axeCalc: !l.sous && !!groupe?.planCalcule,
      planAncien: groupe?.planAncien ?? null,
      etatDates: g.planSaisi ? (g.planDebutSaisi && g.planFinSaisi ? 'Saisies' : g.planDebutSaisi ? 'Début saisi' : 'Fin saisie') : 'Calculées',
      texteEtat: g.planSaisi
        ? hors.length
          ? `${hors.length} tâche(s) prévue(s) hors de cette période.`
          : 'Les tâches datées sont toutes dans cette période.'
        : g.prevuDebut
          ? 'Du premier début prévu à la dernière fin prévue des tâches. Modifiez une date pour la fixer.'
          : 'Aucune tâche n’a de dates prévues : saisissez les dates de la ligne.',
      hors,
      retard,
      joursRetard: retard && g.planFin ? joursEntre(g.planFin, retard) : 0,
      nonValidees: actives.filter((t) => t.statut !== 'Validé').length,
      actives,
      annulees: toutes.length - actives.length,
      rech,
      q,
      trouvees,
      filtre,
      nb,
      liste,
      sousParties,
      sousVues: sousParties.filter((x) => trouve(x.nom, q)),
      avant,
      pins,
      nbPin: pins ? actives.filter((t) => avant[cleTache(t.uid)]).length + sousParties.filter((x) => avant[x.cle ?? '']).length : 0,
    };
  });

  protected dates(t: TacheVue): string {
    const d = t.tr.debut,
      f = t.tr.fin,
      c = t.consoDates;
    const prevu = d ? (f && f !== d ? `${fD(d)} → ${fD(f)}` : fD(d)) : f ? '→ ' + fD(f) : 'non daté';
    return `Prévu ${prevu}${c.length ? ` · Réel ${fD(c[0])}${c.length > 1 ? ' → ' + fD(c[c.length - 1]) : ''}` : ''}`;
  }

  /** Tâche ouverte depuis le volet : un bouton « ‹ Planning » ramène à la ligne. */
  protected ouvrirTache(uid: string): void {
    this.etat.ouvrirTache(uid, null, this.cle());
  }

  /** Date vide : retour au calcul ; la fin ne peut pas précéder le début (contrôle fait par le serveur, la saisie est rétablie sinon). */
  protected dater(cote: 'debut' | 'fin', el: HTMLInputElement): void {
    const g = this.vm()?.g;
    if (!g) return;
    const ancienne = (cote === 'debut' ? g.planDebut : g.planFin) || '';
    const deb = cote === 'debut' ? el.value || g.prevuDebut : g.planDebutSaisi ? g.planDebut : g.prevuDebut;
    const fin = cote === 'fin' ? el.value || g.prevuFin : g.planFinSaisi ? g.planFin : g.prevuFin;
    if (deb && fin && fin < deb) {
      this.etat.afficher('La fin prévue ne peut pas précéder le début prévu.', 'attention');
      el.value = ancienne;
      return;
    }
    const version = this.etat.vue()?.projet.planning?.groupes[this.cle()]?.version;
    void this.etat.saisir((id) => this.api.datePlanning(id, this.cle(), cote, el.value || null, version), { siErreur: () => (el.value = ancienne) });
  }

  protected effacer(): void {
    void this.etat.saisir((id) => this.api.effacerDatesPlanning(id, this.cle()));
  }

  protected nommerSousPartie(nom: string): void {
    const sp = this.vm()?.g as { id: string } | undefined;
    const version = sp ? this.etat.vue()?.projet.planning?.groupes['sec|' + sp.id]?.version : undefined;
    void this.etat.saisir((id) => this.api.nomSousPartie(id, this.cle(), nom.trim(), version));
  }

  protected nommerAxe(code: string, nom: string): void {
    void this.etat.saisir((id) => this.api.nomAxe(id, code, nom.trim()));
  }

  protected definirAxe(code: string, nom: string, dateLimite: string | null): void {
    void this.etat.saisir((id) => this.api.axe(id, code, nom.trim(), dateLimite));
  }

  protected lierEcheanceAxe(code: string, ancienne: number | null, valeur: string): void {
    const v = this.etat.vue();
    if (!v) return;
    const numero = valeur ? Number(valeur) : null;
    if (numero === null) {
      if (ancienne === null) return;
      const ancienneEch = v.m.echeancier.find((e) => e.n === ancienne);
      if (ancienneEch) void this.etat.saisir((id) => this.api.perimetreEcheance(id, ancienneEch.n, ancienneEch.phases ?? [], ancienneEch.lies ?? [], null));
      return;
    }
    const cible = v.m.echeancier.find((e) => e.n === numero);
    if (!cible || (cible.realiseLe && cible.n !== ancienne)) { this.etat.afficher('Une échéance déjà facturée ne peut pas être affectée à un autre axe.', 'attention'); return; }
    void this.etat.saisir((id) => this.api.perimetreEcheance(id, cible.n, cible.phases ?? [], cible.lies ?? [], code));
  }
  protected nommerLot(code: string, nom: string): void {
    void this.etat.saisir((id) => this.api.nomLot(id, code, nom.trim()));
  }

  protected masquer(masquer: boolean): void {
    void this.etat.saisir((id) => this.api.elementPlanning(id, 'masque', this.cle(), masquer));
  }

  protected mettreEnAvant(cle: string, actif: boolean): void {
    void this.etat.saisir((id) => this.api.elementPlanning(id, 'avant', cle, actif));
  }

  protected rechercher(texte: string): void {
    this.ui.maj({ plRech: texte, plRechCle: this.cle() });
  }

  /** Échap dans la recherche : vide d'abord le champ ; une seconde fois, ferme le volet comme d'habitude. */
  protected viderRecherche(e: Event, el: HTMLInputElement): void {
    if (!el.value) return;
    e.preventDefault();
    e.stopPropagation();
    el.value = '';
    this.rechercher('');
  }
}
