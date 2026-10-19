import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { STATUTS } from '../etat/constantes';
import { fD, fDi, fJ, stSlug } from '../etat/formats';
import { joursEntre, sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { atHoraire, atRealise, axeName, couleurGroupe, groupByAxe, isOver, lvLivre, lvPrevue, lvValide, TacheVue, Vue } from '../etat/vue';
import { BarreFiltres } from '../ui/barre-filtres';
import { LienTache } from '../ui/tache';

/** Colonne d'un registre (largeur fixe en pixels, répartie au prorata de la largeur disponible). */
interface Colonne {
  k: string;
  l: string;
  w: number;
  n?: boolean;
}

/** Colonnes masquées par défaut : « Responsable principal ». */
const MASQUEES_PAR_DEFAUT: Record<string, boolean> = { resp: true };

/**
 * Ateliers & livrables : un registre par type de tâche (types gérés dans ⚙ Paramètres du projet), regroupé par axe, lot ou phase.
 * Atelier : date planifiée, réalisé, invitation, destinataires. Livrable : livraison, validation client. Autres : dates.
 */
import { Fx } from '../ui/fx';
@Component({
  selector: 'app-ateliers',
  imports: [BarreFiltres, LienTache, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      <div class="sechead">
        <div>
          <h2>Ateliers & livrables</h2>
          <p>
            Un registre par type de tâche (types gérés dans ⚙ Paramètres du projet), regroupé par {{ v.dimLl }}. Le type d’une tâche se change dans son détail. Réalisé / livré = date du
            dernier consommé quand la tâche est validée dans la saisie du consommé ; la validation client d’un livrable reste à indiquer à la main.
            <app-fx cle="registres" />
          </p>
        </div>
        <div class="seg reg-seg" role="tablist" aria-label="Registre">
          @for (x of v.m.ateliers.parType; track x.id) {
            <button type="button" role="tab" [attr.aria-pressed]="x.id === m.cur" [title]="x.realises + ' réalisé(s) sur ' + x.prevus + ' prévu(s)'" (click)="changerType(x.id)">
              {{ x.nom }}<span class="seg-n">{{ x.realises }} / {{ x.prevus }}</span>
            </button>
          }
        </div>
      </div>
      <app-barre-filtres>
        @if (m.cur === 'Atelier') {
          <label class="field"
            >Préparation
            <select class="in" #p (change)="ui.maj({ alPrep: p.value })">
              @for (o of m.filtres; track o[0]) {
                <option [value]="o[0]" [selected]="o[0] === ui.ui().alPrep">{{ o[1] }}</option>
              }
            </select>
          </label>
        } @else if (m.cur === 'Livrable') {
          <label class="field"
            >Suivi
            <select class="in" #p (change)="ui.maj({ lvPrep: p.value })">
              @for (o of m.filtres; track o[0]) {
                <option [value]="o[0]" [selected]="o[0] === ui.ui().lvPrep">{{ o[1] }}</option>
              }
            </select>
          </label>
        }
        <span class="spacer"></span>
        <details class="dd push">
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
            @for (c of m.toutes; track c.k) {
              @if (c.k !== 'lib') {
                <label class="dd-i"><input type="checkbox" [checked]="!!m.masquees[c.k]" #cb (change)="masquer(m.cur, c.k, cb.checked)" /> {{ c.l }}</label>
              }
            }
            <div class="dd-sep"></div>
            <button type="button" class="dd-i dd-btn" (click)="reinitialiser(m.cur)">Réinitialiser l’affichage</button>
          </div>
        </details>
      </app-barre-filtres>
      <div class="tw tall reg-tw">
        <table class="atreg rz" [style.min-width.px]="m.largeurMin">
          <colgroup>
            @for (c of m.colonnes; track c.k) {
              <col [style.width.%]="c.pct" />
            }
          </colgroup>
          <thead>
            <tr>
              @for (c of m.colonnes; track c.k) {
                <th [class.n]="c.n" [class.stk]="c.k === 'lot' || c.k === 'lib'" [class.stk-last]="c.k === 'lib'" [style.left.px]="gauche(m, c.k)">{{ c.l }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (g of m.groupes; track g.cle) {
              <tr class="grp axg" [style.--axc]="g.couleur">
                <td [attr.colspan]="m.colonnes.length">
                  <span class="grp-stk"
                    >{{ g.nom }} <span class="muted">· {{ g.taches.length }}</span></span
                  >
                </td>
              </tr>
              @for (t of g.taches; track t.uid) {
                <tr class="axr" [class.is-annul]="t.annulee" [class.is-sel]="etat.panneau() === t.uid" [style.--axc]="g.couleur">
                  @for (c of m.colonnes; track c.k) {
                    <td
                      [class.n]="c.n"
                      [class.lbl]="c.k === 'lib'"
                      [class.wrap-t]="c.k === 'lib'"
                      [class.struck]="c.k === 'lib' && !t.type"
                      [class.stk]="c.k === 'lot' || c.k === 'lib'"
                      [class.stk-last]="c.k === 'lib'"
                      [style.left.px]="gauche(m, c.k)"
                    >
                      @switch (c.k) {
                        @case ('lot') {
                          <span class="ell" [title]="t.lot">{{ t.lot }}</span>
                        }
                        @case ('lib') {
                          <app-lien-tache [t]="t" />
                          @if (!t.type) {
                            <span class="flag">Retiré du registre</span>
                          }
                        }
                        @case ('charge') {
                          {{ fJ(t.charge) }}
                        }
                        @case ('date') {
                          @if (!t.annulee) {
                            <input class="in w-date" type="date" aria-label="Date planifiée de l’atelier" [value]="t.tr.atelier?.date ?? ''" [disabled]="lecture()" #dt (change)="dateAtelier(t, dt)" />
                            @if (horaire(t)) {
                              <span class="auto">{{ horaire(t) }}</span>
                            }
                          }
                        }
                        @case ('real') {
                          @if (atRealise(t); as r) {
                            <span class="inv-ok">✓ {{ fD(r) }}</span>
                          } @else {
                            <span class="muted">—</span>
                          }
                        }
                        @case ('inv') {
                          @if (!t.annulee) {
                            @if (t.statut === 'Validé' && !t.tr.atelier?.invit) {
                              <span class="muted" title="Atelier réalisé">—</span>
                            } @else if (t.tr.atelier?.invit) {
                              <span class="inv-st ok" [title]="'Invitation envoyée le ' + fD(t.tr.atelier?.invitLe)">✓ Envoyée</span>
                            } @else if (t.tr.atelier?.date) {
                              <button type="button" class="inv-todo" title="Cliquer quand l’invitation est envoyée" [disabled]="lecture()" (click)="invitation(t.uid)">À envoyer</button>
                            } @else {
                              <span class="muted" title="Fixez d’abord la date">—</span>
                            }
                          }
                        }
                        @case ('dest') {
                          <button type="button" class="dest-n" [attr.data-open]="t.uid" [title]="destinataires(t) || (lecture() ? 'Aucun destinataire' : 'Aucun destinataire — cliquer pour en ajouter')">
                            @if (t.tr.atelier?.dest?.length) {
                              👥 {{ t.tr.atelier?.dest?.length }}
                            } @else if (lecture()) {
                              <span class="muted">—</span>
                            } @else {
                              <span class="muted">+ Ajouter</span>
                            }
                          </button>
                        }
                        @case ('liv') {
                          @if (!t.annulee) {
                            @if (lvLivre(t); as liv) {
                              <span class="inv-ok" title="Date du dernier consommé saisi sur la tâche validée">✓ livré le {{ fD(liv) }}</span>
                              @if (lvPrevue(t); as pv) {
                                <span class="auto"
                                  >prévu le {{ fD(pv) }}
                                  @if (liv > pv) {
                                    · <span class="neg">+{{ joursEntre(pv, liv) }} j</span>
                                  }
                                </span>
                              }
                            } @else {
                              <input
                                class="in w-date"
                                type="date"
                                aria-label="Livraison prévue"
                                title="Livraison prévue (fin prévue de la tâche)"
                                [class.late]="enRetard(v, t)"
                                [value]="t.tr.fin ?? ''"
                                [disabled]="lecture()"
                                #lf
                                (change)="livraison(t, lf)"
                              />
                              @if (enRetard(v, t)) {
                                <span class="auto neg">en retard de {{ joursEntre(t.tr.fin ?? v.aujourdhui, v.aujourdhui) }} j</span>
                              }
                            }
                          }
                        }
                        @case ('val') {
                          @if (!t.annulee) {
                            @if (lvValide(t); as val) {
                              <button
                                type="button"
                                class="inv-ok lv-undo"
                                [title]="'Validé par le client le ' + fD(val) + ' — cliquer pour annuler'"
                                [disabled]="lecture()"
                                (click)="validationClient(t, null)"
                              >
                                ✓ {{ fD(val) }}
                              </button>
                            } @else if (lvLivre(t); as liv) {
                              <button
                                type="button"
                                class="inv-todo"
                                title="Cliquer quand le client a validé le livrable"
                                [disabled]="lecture()"
                                (click)="validationClient(t, v.aujourdhui)"
                              >
                                En attente{{ joursEntre(liv, v.aujourdhui) > 0 ? ' · ' + joursEntre(liv, v.aujourdhui) + ' j' : '' }}
                              </button>
                            } @else {
                              <span class="muted" title="Le livrable est livré quand la tâche est validée dans la saisie du consommé">—</span>
                            }
                          }
                        }
                        @case ('deb') {
                          {{ fD(t.debut) }}
                        }
                        @case ('fin') {
                          {{ fD(t.fin) }}
                        }
                        @case ('resp') {
                          {{ t.responsable }}
                        }
                        @case ('statut') {
                          @if (t.annulee) {
                            <span class="pill st-annul" [title]="'Annulée le ' + fDi(t.annul?.at) + (t.annul?.motif ? ' — ' + t.annul?.motif : '')">Annulée</span>
                          } @else {
                            <select class="in st" [class]="'in st st-' + stSlug(t.statut)" aria-label="Statut" [disabled]="lecture()" #st (change)="statut(t, st)">
                              @for (s of statuts; track s) {
                                <option [value]="s" [selected]="s === t.statut">{{ s }}</option>
                              }
                            </select>
                          }
                        }
                        @case ('conso') {
                          <span [class.over]="isOver(t)">{{ fJ(t.consoTotal) }}</span>
                        }
                        @case ('raf') {
                          {{ fJ(t.raf) }}
                        }
                        @case ('com') {
                          <textarea
                            class="in cmt-auto"
                            rows="1"
                            placeholder="Commentaire"
                            aria-label="Commentaire"
                            [title]="t.commentaire"
                            [value]="t.commentaire"
                            [disabled]="lecture()"
                            #cm
                            (change)="commentaire(t, cm)"
                          ></textarea>
                        }
                      }
                    </td>
                  }
                </tr>
              }
            } @empty {
              <tr>
                <td [attr.colspan]="m.colonnes.length" class="empty">Aucun élément dans le registre {{ m.nomType }}.</td>
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
export class Ateliers {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly statuts = STATUTS;
  protected readonly fD = fD;
  protected readonly fDi = fDi;
  protected readonly fJ = fJ;
  protected readonly stSlug = stSlug;
  protected readonly isOver = isOver;
  protected readonly atRealise = atRealise;
  protected readonly lvLivre = lvLivre;
  protected readonly lvPrevue = lvPrevue;
  protected readonly lvValide = lvValide;
  protected readonly horaire = atHoraire;
  protected readonly joursEntre = joursEntre;
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  /** Tâches retirées du registre affiché (type effacé) : gardées barrées jusqu'au changement de registre. */
  private readonly gardees = signal(new Map<string, string>());
  private typesPrecedents = new Map<string, string>();
  /** Largeur réelle de la colonne Lot (la colonne Intitulé figée se cale dessus). */
  private readonly largeurLot = signal(0);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    const types = v.projet.types;
    const cur = types.some((x) => x.id === u.alType) ? u.alType : (types[0]?.id ?? '');
    const q = u.q.trim().toLowerCase();
    const gardees = this.gardees();
    const source = [...v.ateliersList.filter((t) => t.type === cur), ...v.tasks.filter((t) => !t.type && gardees.get(t.uid) === cur)].sort(
      (a, b) => (a.ligne ?? 1e9) - (b.ligne ?? 1e9),
    );
    const prep = cur === 'Atelier' ? u.alPrep : cur === 'Livrable' ? u.lvPrep : '';
    const garder = (t: TacheVue): boolean => {
      if (!prep) return true;
      if (t.annulee) return false;
      if (cur === 'Livrable') return prep === 'aliv' ? !lvLivre(t) : prep === 'aval' ? !!lvLivre(t) && !lvValide(t) : true;
      if (t.statut === 'Validé') return false;
      if (cur === 'Atelier') return prep === 'plan' ? !t.tr.atelier?.date : prep === 'inv' ? !!t.tr.atelier?.date && !t.tr.atelier?.invit : !!t.tr.atelier?.invit;
      return true;
    };
    const liste = source.filter((t) => (!u.axe || (u.axe === '__none' ? !t.grp : t.grp === u.axe)) && (!q || t.label.toLowerCase().includes(q)) && garder(t));

    const debut: Colonne[] = [
      { k: 'lot', l: 'Lot', w: 110 },
      { k: 'lib', l: 'Intitulé', w: 250 },
      { k: 'charge', l: 'Charge', w: 64, n: true },
    ];
    const fin: Colonne[] = [
      { k: 'resp', l: 'Responsable principal', w: 180 },
      { k: 'statut', l: 'Statut', w: 150 },
      { k: 'conso', l: 'Consommé', w: 88, n: true },
      { k: 'raf', l: 'RAF', w: 56, n: true },
      { k: 'com', l: 'Commentaire', w: 300 },
    ];
    let milieu: Colonne[];
    let filtres: [string, string][] = [];
    if (cur === 'Atelier') {
      const ats = source.filter((t) => !t.annulee && t.statut !== 'Validé');
      milieu = [
        { k: 'date', l: 'Date planifiée', w: 160 },
        { k: 'real', l: 'Réalisé le', w: 120 },
        { k: 'inv', l: 'Invitation', w: 100 },
        { k: 'dest', l: 'Destinataires', w: 100 },
      ];
      filtres = [
        ['', 'Tout'],
        ['plan', `À planifier (${ats.filter((t) => !t.tr.atelier?.date).length})`],
        ['inv', `Invitation à envoyer (${ats.filter((t) => t.tr.atelier?.date && !t.tr.atelier.invit).length})`],
        ['ok', `Prêts (${ats.filter((t) => t.tr.atelier?.invit).length})`],
      ];
    } else if (cur === 'Livrable') {
      const lvs = source.filter((t) => !t.annulee);
      milieu = [
        { k: 'liv', l: 'Livraison au client', w: 180 },
        { k: 'val', l: 'Validation client', w: 150 },
      ];
      filtres = [
        ['', 'Tout'],
        ['aliv', `À livrer (${lvs.filter((t) => !lvLivre(t)).length})`],
        ['aval', `Livrés, en attente de validation client (${lvs.filter((t) => lvLivre(t) && !lvValide(t)).length})`],
      ];
    } else {
      milieu = [
        { k: 'deb', l: 'Début', w: 110 },
        { k: 'fin', l: 'Fin', w: 110 },
      ];
    }
    const toutes = [...debut, ...milieu, ...fin];
    const masquees = { ...(u.regHide[cur] ?? MASQUEES_PAR_DEFAUT) };
    const visibles = toutes.filter((c) => c.k === 'lib' || !masquees[c.k]);
    const total = sum(visibles.map((c) => c.w));
    return {
      v,
      cur,
      nomType: types.find((x) => x.id === cur)?.nom ?? '',
      filtres,
      toutes,
      masquees,
      nbMasquees: toutes.filter((c) => c.k !== 'lib' && masquees[c.k]).length,
      colonnes: visibles.map((c) => ({ ...c, pct: +((c.w / total) * 100).toFixed(2) })),
      lotVisible: visibles.some((c) => c.k === 'lot'),
      largeurMin: Math.round(total * 0.8),
      groupes: groupByAxe(v, liste).map(([cle, taches]) => ({ cle, nom: axeName(v, cle), couleur: couleurGroupe(v, cle), taches })),
    };
  });

  constructor() {
    // une tâche dont on efface le type (depuis son détail) reste affichée, barrée, dans le registre courant
    effect(() => {
      const v = this.etat.vue();
      if (!v) return;
      const cur = this.vm()?.cur ?? '';
      const avant = this.typesPrecedents;
      const ajout = new Map(this.gardees());
      let change = false;
      for (const t of v.tasks) {
        const precedent = avant.get(t.uid);
        if (precedent === cur && cur && !t.type && !ajout.has(t.uid)) {
          ajout.set(t.uid, cur);
          change = true;
        }
      }
      this.typesPrecedents = new Map(v.tasks.map((t) => [t.uid, t.type]));
      if (change) this.gardees.set(ajout);
    });
    // la colonne Intitulé figée se cale sur la largeur réelle de la colonne Lot
    afterRenderEffect(() => {
      this.vm();
      const lot = this.hote.nativeElement.querySelector<HTMLElement>('table.atreg thead th.stk:not(.stk-last)');
      const l = lot ? Math.round(lot.getBoundingClientRect().width) : 0;
      if (l !== this.largeurLot()) this.largeurLot.set(l);
    });
  }

  protected gauche(m: { lotVisible: boolean }, k: string): number | null {
    if (k === 'lot') return 0;
    if (k === 'lib') return m.lotVisible ? this.largeurLot() : 0;
    return null;
  }

  protected changerType(id: string): void {
    this.gardees.set(new Map());
    this.ui.maj({ alType: id });
  }

  protected masquer(type: string, k: string, oui: boolean): void {
    const u = this.ui.ui();
    const h = { ...(u.regHide[type] ?? MASQUEES_PAR_DEFAUT) };
    if (oui) h[k] = true;
    else delete h[k];
    this.ui.maj({ regHide: { ...u.regHide, [type]: h } });
  }

  protected reinitialiser(type: string): void {
    const regHide = { ...this.ui.ui().regHide };
    delete regHide[type];
    this.ui.maj({ regHide });
    this.etat.afficher('Affichage du registre réinitialisé.', 'succes');
  }

  protected destinataires(t: TacheVue): string {
    return (t.tr.atelier?.dest ?? []).join('\n');
  }

  protected enRetard(v: Vue, t: TacheVue): boolean {
    const pv = lvPrevue(t);
    return !!pv && pv < v.aujourdhui;
  }

  // ---------------------------------------------------------------- saisies

  protected statut(t: TacheVue, el: HTMLSelectElement): void {
    const ancien = t.statut;
    void this.etat.saisir((id) => this.api.statut(id, t.uid, el.value, this.etat.versionTache(t.uid)), { siErreur: () => (el.value = ancien) });
  }

  protected commentaire(t: TacheVue, el: HTMLTextAreaElement): void {
    void this.etat.saisir((id) => this.api.commentaire(id, t.uid, el.value, this.etat.versionTache(t.uid)), { siErreur: () => (el.value = t.commentaire) });
  }

  protected dateAtelier(t: TacheVue, el: HTMLInputElement): void {
    void this.etat.saisir((id) => this.api.dateAtelier(id, t.uid, el.value || null), { siErreur: () => (el.value = t.tr.atelier?.date ?? '') });
  }

  protected invitation(uid: string): void {
    void this.etat.saisir((id) => this.api.invitation(id, uid, true), {
      annuler: { libelle: 'Annuler', executer: () => void this.etat.saisir((id) => this.api.invitation(id, uid, false)) },
    });
  }

  protected livraison(t: TacheVue, el: HTMLInputElement): void {
    const fin = el.value || null;
    const debut = t.tr.debut ?? null;
    if (debut && fin && fin < debut) {
      el.value = t.tr.fin ?? '';
      this.etat.afficher(`La fin prévue (${fD(fin)}) ne peut pas précéder le début prévu (${fD(debut)}) : saisie annulée.`, 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.dates(id, t.uid, debut, fin, this.etat.versionTache(t.uid)), { siErreur: () => (el.value = t.tr.fin ?? '') });
  }

  protected validationClient(t: TacheVue, date: string | null): void {
    const avant = lvValide(t);
    void this.etat.saisir((id) => this.api.validationClient(id, t.uid, date), {
      annuler: { libelle: 'Annuler', executer: () => void this.etat.saisir((id) => this.api.validationClient(id, t.uid, avant)) },
    });
  }
}
