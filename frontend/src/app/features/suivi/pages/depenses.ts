import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AchatReel, FraisReel } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { ACHAT_STATUTS, FRAIS_CATEGORIES } from '../etat/constantes';
import { eurCls, eurIn, fE2, fJ, fP } from '../etat/formats';
import { distincts, lireNombre, sum } from '../etat/outils';
import { signeE } from '../etat/rentabilite.logique';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { Carte, CarteRepliable } from '../ui/cartes';
import { Fx } from '../ui/fx';
import { Barre } from '../ui/petits';

type Champ = HTMLInputElement | HTMLSelectElement;

/** Indicateurs communs aux achats et aux frais (budget TSP, réel, reste à engager, atterrissage). */
interface Depense {
  budget: number;
  reel: number;
  reste: number;
  att: number;
  depasse: number;
  impactNet: number;
}

/** Contrôles communs aux montants saisis dans le tableau (repris de la version de référence). */
function lireMontant(champ: string, brut: string): { ok: true; valeur: string } | { ok: false; message: string } {
  const n = lireNombre(brut);
  const strict = champ === 'qte' || champ === 'montant'; // quantité et montant : strictement positifs (comme à la création)
  if (n == null ? strict : isNaN(n) || n < 0 || (strict && n === 0))
    return { ok: false, message: `${champ === 'qte' ? 'Quantité' : 'Montant'} invalide : saisissez un nombre supérieur à 0. Saisie annulée.` };
  return { ok: true, valeur: String(n ?? 0) };
}

/** Bloc de 4 indicateurs : budget, réel, reste à engager, atterrissage. */
@Component({
  selector: 'app-kpis-depenses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let D = d();
    <div class="kpis">
      <div class="kpi">
        <div class="l">Budget TSP</div>
        <div class="v">{{ fE2(D.budget) }}</div>
        <div class="s">{{ D.budget ? 'Vendu au TSP (HT)' : 'Aucun ' + nom() + ' prévu au TSP' }}</div>
      </div>
      <div class="kpi">
        <div class="l">Réel saisi</div>
        <div class="v">{{ fE2(D.reel) }}</div>
        <div class="s">{{ nb() }} ligne(s){{ complement() }}</div>
      </div>
      <div class="kpi">
        <div class="l">Reste à engager</div>
        <div class="v">{{ D.budget ? fE2(D.reste) : '—' }}</div>
        <div class="s">
          {{ D.budget ? fP(min(1, (D.reel - horsTsp()) / D.budget)) + ' du budget consommé' : 'Aucun budget ' + (nom() === 'achat' ? 'd’achat' : 'de frais') + ' au TSP' }}
        </div>
      </div>
      <div class="kpi hero">
        <div class="l">Atterrissage</div>
        <div class="v">
          <span [class.neg]="D.depasse > 0.5 && D.impactNet < -0.5">{{ fE2(D.att) }}</span>
        </div>
        <div class="s">
          @if (D.depasse > 0.5) {
            @if (D.impactNet >= -0.5) {
              +{{ fE2(D.depasse) }} au-delà du budget, <b class="pos">couvert par le refacturé</b>
            } @else {
              <b class="neg">+{{ fE2(D.depasse) }}</b> au-delà du budget
            }
          } @else {
            Dans le budget
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class KpisDepenses {
  readonly d = input.required<Depense>();
  readonly nom = input.required<'achat' | 'frais'>();
  readonly nb = input(0);
  readonly complement = input('');
  readonly horsTsp = input(0);
  protected readonly fE2 = fE2;
  protected readonly fP = fP;
  protected readonly min = Math.min;
}

/** Achats : budget vendu au TSP et achats réels (HT), saisis directement dans le tableau. */
@Component({
  selector: 'app-achats',
  imports: [Carte, CarteRepliable, Fx, KpisDepenses, Barre],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Achats</h2>
        <p>
          Achats matériel, logiciel et licences : budget vendu au TSP et achats réels du projet, en HT. Le réel alimente la marge nette du Tableau de bord.
          <app-fx cle="depenses" />
        </p>
      </div>
    </div>
    @if (vm(); as m) {
      @let v = m.v;
      @let A = m.A;
      <app-kpis-depenses
        [d]="A"
        nom="achat"
        [nb]="m.lignesReelles.length"
        [horsTsp]="A.horsTSP"
        [complement]="A.hors.length ? ' · ' + A.hors.length + ' hors TSP' : ''"
      />
      <datalist id="dl-fourn">
        @for (f of m.fournisseurs; track f) {
          <option [value]="f"></option>
        }
      </datalist>
      <div class="toolbar">
        <label class="field"
          >Statut
          <select class="in" #s (change)="ui.maj({ aqSt: s.value })">
            <option value="" [selected]="!ui.ui().aqSt">Tous</option>
            @for (x of statuts; track x) {
              <option [value]="x" [selected]="x === ui.ui().aqSt">{{ x }}</option>
            }
          </select>
        </label>
        <label class="field">Rechercher<input class="in" type="search" placeholder="Désignation, fournisseur…" [value]="ui.ui().aqQ" #q (input)="ui.maj({ aqQ: q.value })" /></label>
        <span class="spacer"></span>
        <span class="chips">
          @for (x of A.parStatut; track x.cle) {
            <span
              >{{ x.cle }} <b>{{ x.n }}</b></span
            >
          }
        </span>
        @if (v.droits.peutModifier) {
          <button type="button" class="btn primary" (click)="etat.fenetre.set({ type: 'nouvel-achat' })">+ Nouvel achat</button>
        }
      </div>
      <app-carte
        titre="Achats réels"
        sousTitre="Saisie directe dans le tableau. Montant HT = quantité × coût unitaire. « Hors TSP » : achat non prévu, son coût réduit la marge."
      >
        <div class="tw">
          <table class="reg dep fixw">
            <colgroup>
              @for (w of largeurs; track $index) {
                <col [style.width.%]="w" />
              }
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Désignation</th>
                <th>Fournisseur</th>
                <th>Ligne du TSP</th>
                <th class="n">Qté</th>
                <th class="n">Coût unitaire HT</th>
                <th class="n">Montant HT</th>
                <th class="n">Refacturé client HT</th>
                <th>Statut</th>
                <th>Commentaire</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (a of m.liste; track a.id) {
                <tr [attr.data-row]="a.id" [class.is-hors]="a.ligne == null">
                  <td><input class="in w-date" type="date" aria-label="Date" [value]="a.date" [disabled]="lecture()" #c1 (change)="champ(a, 'date', c1, a.date)" /></td>
                  <td class="c-lib">
                    <input class="in w-full" placeholder="Désignation" aria-label="Désignation" [value]="a.designation" [disabled]="lecture()" #c2 (change)="champ(a, 'designation', c2, a.designation)" />
                  </td>
                  <td>
                    <input class="in w-fourn" list="dl-fourn" placeholder="Fournisseur" aria-label="Fournisseur" [value]="a.fournisseur" [disabled]="lecture()" #c3 (change)="champ(a, 'fournisseur', c3, a.fournisseur)" />
                  </td>
                  <td>
                    <select class="in w-ligne" aria-label="Ligne du TSP" [disabled]="lecture()" #c4 (change)="champ(a, 'ligne', c4, a.ligne == null ? '' : '' + a.ligne)">
                      <option value="" [selected]="a.ligne == null">Hors TSP</option>
                      @for (b of v.achatRows; track $index; let i = $index) {
                        <option [value]="i" [selected]="a.ligne === i">{{ b.designation || 'Ligne ' + (i + 1) }} — budget {{ fE2(b.montant) }}</option>
                      }
                    </select>
                  </td>
                  <td class="num"><input class="in w-num" inputmode="decimal" aria-label="Quantité" [value]="fJ(a.qte)" [disabled]="lecture()" #c5 (change)="champ(a, 'qte', c5, fJ(a.qte))" /></td>
                  <td class="num"><input class="in w-eur" inputmode="decimal" aria-label="Coût unitaire HT" [value]="eurIn(a.cu)" [disabled]="lecture()" #c6 (change)="champ(a, 'cu', c6, eurIn(a.cu))" /></td>
                  <td class="num">
                    <b>{{ fE2(a.montant) }}</b>
                  </td>
                  <td class="num">
                    <input
                      class="in w-eur"
                      inputmode="decimal"
                      placeholder="0"
                      aria-label="Refacturé au client HT"
                      [value]="a.refacture ? eurIn(a.refacture) : ''"
                      [disabled]="lecture()"
                      #c7
                      (change)="champ(a, 'refacture', c7, a.refacture ? eurIn(a.refacture) : '')"
                    />
                  </td>
                  <td>
                    <select class="in st" [class]="'in st aq-' + statutIndex(a.statut)" aria-label="Statut" [disabled]="lecture()" #c8 (change)="champ(a, 'statut', c8, a.statut)">
                      @for (x of statuts; track x) {
                        <option [value]="x" [selected]="x === (a.statut || 'Commandé')">{{ x }}</option>
                      }
                    </select>
                  </td>
                  <td class="c-com">
                    <input class="in w-full" placeholder="—" aria-label="Commentaire" [value]="a.commentaire" [disabled]="lecture()" #c9 (change)="champ(a, 'commentaire', c9, a.commentaire)" />
                  </td>
                  <td>
                    @if (!lecture()) {
                      <button type="button" class="btn sm ghost" title="Supprimer" [attr.aria-label]="'Supprimer ' + (a.designation || 'cet achat')" (click)="supprimer(a)">✕</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="11" class="empty">
                    {{ m.lignesReelles.length ? 'Aucun achat ne correspond au filtre.' : 'Aucun achat saisi. Ajoutez le premier avec « + Nouvel achat ».' }}
                  </td>
                </tr>
              }
              @if (m.liste.length) {
                <tr class="total">
                  <td>TOTAL</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td class="n">{{ fE2(m.totalMontant) }}</td>
                  <td class="n">{{ fE2(m.totalRefacture) }}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte>
      <app-carte-repliable cle="aq-bud" titre="Budget du TSP" sousTitre="Lignes vendues, avec le réel rattaché à chacune. Atterrissage d’une ligne = le plus élevé du budget et du réel.">
        @if (v.achatRows.length || A.hors.length) {
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Type</th>
                  <th class="n">Budget HT</th>
                  <th class="n">Revente prévue</th>
                  <th class="n">Réel</th>
                  <th class="n">Écart</th>
                  <th>Consommation</th>
                </tr>
              </thead>
              <tbody>
                @for (l of A.parLigne; track l.i) {
                  <tr>
                    <td>{{ l.designation || '—' }}</td>
                    <td>{{ v.achatRows[l.i]?.type ?? '' }}</td>
                    <td class="n">{{ fE2(l.budget) }}</td>
                    <td class="n">{{ fE2(l.budgetRev) }}</td>
                    <td class="n">
                      @if (l.n) {
                        {{ fE2(l.reel) }}
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="n">
                      <span [class]="eurCls(l.reel - l.budget)">{{ l.n ? fE2(l.reel - l.budget) : '' }}</span>
                    </td>
                    <td><app-barre [valeur]="l.budget ? min(1, l.reel / l.budget) : l.reel ? 1 : 0" [classe]="l.reel > l.budget + 0.5 ? 'crit' : 'ok'" /></td>
                  </tr>
                }
                @if (A.hors.length) {
                  <tr>
                    <td><span class="tag-aj">Hors TSP</span></td>
                    <td></td>
                    <td class="n">{{ fE2(0) }}</td>
                    <td class="n">{{ fE2(0) }}</td>
                    <td class="n">{{ fE2(A.horsTSP) }}</td>
                    <td class="n">
                      <span class="neg">{{ fE2(A.horsTSP) }}</span>
                    </td>
                    <td></td>
                  </tr>
                }
                <tr class="total">
                  <td>TOTAL</td>
                  <td></td>
                  <td class="n">{{ fE2(A.budget) }}</td>
                  <td class="n">{{ fE2(A.budgetRev) }}</td>
                  <td class="n">{{ fE2(A.reel) }}</td>
                  <td class="n">
                    <span
                      [class]="eurCls(A.depasse)"
                      title="Dépassements des lignes + achats hors TSP (le budget non dépensé d’une ligne ne compense pas le dépassement d’une autre)"
                      >{{ A.depasse > 0.005 ? '+' : '' }}{{ fE2(A.depasse) }}</span
                    >
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">Aucun achat prévu au TSP : les achats saisis sont tous « hors TSP ».</p>
        }
      </app-carte-repliable>
      <app-carte-repliable
        cle="aq-presta"
        titre="Prestataires externes (rappel du TSP)"
        sousTitre="Leurs jours se suivent dans la saisie du consommé, via les profils de l’entité ACHAT : ils ne sont pas ressaisis ici pour ne pas être comptés deux fois."
      >
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th>Société</th>
                <th class="n">Coût jour</th>
                <th class="n">Nb j</th>
                <th class="n">Total coût</th>
                <th class="n">TJM</th>
                <th class="n">Revente</th>
                <th class="n">Markup</th>
                <th>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              @for (x of v.prestaRows; track $index) {
                <tr>
                  <td>{{ x.designation }}</td>
                  <td>{{ x.societe }}</td>
                  <td class="n">{{ fE2(x.coutJour) }}</td>
                  <td class="n">{{ fJ(x.nbj) }}</td>
                  <td class="n">{{ fE2(x.cout) }}</td>
                  <td class="n">{{ fE2(x.tjm) }}</td>
                  <td class="n">{{ fE2(x.revente) }}</td>
                  <td class="n">{{ fP(x.markup) }}</td>
                  <td>{{ x.commentaire }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="empty">Aucun prestataire au TSP.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte-repliable>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Achats {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  protected readonly statuts = ACHAT_STATUTS;
  protected readonly fE2 = fE2;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly eurIn = eurIn;
  protected readonly eurCls = eurCls;
  protected readonly min = Math.min;
  protected readonly largeurs = [11.5, 13.5, 10, 12.5, 5, 8, 8, 8, 9.5, 11, 3];
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    const A = v?.m.financier?.achats;
    if (!v || !A) return null;
    const u = this.ui.ui();
    const q = u.aqQ.trim().toLowerCase();
    const lignesReelles = v.projet.achatsReel ?? [];
    const ligneTsp = (a: AchatReel) => (a.ligne != null && v.achatRows[a.ligne] ? v.achatRows[a.ligne].designation || `Ligne ${a.ligne + 1}` : '');
    const liste = lignesReelles
      .filter(
        (a) =>
          (!u.aqSt || (a.statut || 'Commandé') === u.aqSt) && (!q || `${a.designation} ${a.fournisseur} ${a.commentaire} ${ligneTsp(a)}`.toLowerCase().includes(q)),
      )
      .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
    return {
      v,
      A,
      lignesReelles,
      liste,
      fournisseurs: distincts(lignesReelles.map((a) => a.fournisseur).filter(Boolean)).sort(),
      totalMontant: sum(liste.map((a) => a.montant)),
      totalRefacture: sum(liste.map((a) => a.refacture)),
    };
  });

  protected statutIndex(s: string): number {
    return Math.max(0, ACHAT_STATUTS.indexOf((s || 'Commandé') as (typeof ACHAT_STATUTS)[number]));
  }

  protected champ(a: AchatReel, champ: string, el: Champ, ancien: string): void {
    let valeur: string | null = el.value.trim();
    if (champ === 'qte' || champ === 'cu' || champ === 'refacture') {
      const r = lireMontant(champ, el.value);
      if (!r.ok) {
        el.value = ancien;
        this.etat.afficher(r.message, 'erreur');
        return;
      }
      valeur = r.valeur;
    } else if (champ === 'date' && !valeur) {
      el.value = ancien;
      this.etat.afficher('La date est obligatoire : saisie annulée.', 'erreur');
      return;
    }
    if (champ === 'ligne' && !valeur) valeur = null;
    void this.etat.saisir((id) => this.api.modifier(id, 'achats', a.id, { champ, valeur, version: this.etat.versionLigne('achats', a.id) }), {
      siErreur: () => (el.value = ancien),
    });
  }

  protected async supprimer(a: AchatReel): Promise<void> {
    const ok = await this.etat.confirmer('Supprimer cet achat ?', [`« ${a.designation} » — ${fE2(a.montant)} HT`], 'Supprimer');
    if (ok) void this.etat.saisir((id) => this.api.supprimerLigne(id, 'achats', a.id));
  }
}

/** Frais : budget vendu au TSP et frais réels (HT), saisis directement dans le tableau. */
@Component({
  selector: 'app-frais',
  imports: [Carte, CarteRepliable, Fx, KpisDepenses],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Frais</h2>
        <p>
          Frais de déplacement et de mission : budget vendu au TSP et frais réels du projet, en HT. Le réel alimente la marge nette du Tableau de bord.
          <app-fx cle="depenses" />
        </p>
      </div>
    </div>
    @if (vm(); as m) {
      @let v = m.v;
      @let F = m.F;
      <app-kpis-depenses [d]="F" nom="frais" [nb]="m.lignesReelles.length" [complement]="F.reelRef ? ' · ' + fE2(F.reelRef) + ' refacturables' : ''" />
      <datalist id="dl-people">
        @for (p of v.personnes; track p) {
          <option [value]="p"></option>
        }
      </datalist>
      <div class="toolbar">
        <label class="field"
          >Collaborateur
          <select class="in" #c (change)="ui.maj({ frC: c.value })">
            <option value="" [selected]="!ui.ui().frC">Tous</option>
            @for (x of m.collaborateurs; track x) {
              <option [value]="x" [selected]="x === ui.ui().frC">{{ x }}</option>
            }
          </select>
        </label>
        <label class="field"
          >Catégorie
          <select class="in" #k (change)="ui.maj({ frCat: k.value })">
            <option value="" [selected]="!ui.ui().frCat">Toutes</option>
            @for (x of categories; track x) {
              <option [value]="x" [selected]="x === ui.ui().frCat">{{ x }}</option>
            }
          </select>
        </label>
        <label class="field">Rechercher<input class="in" type="search" placeholder="Libellé, commentaire" [value]="ui.ui().frQ" #q (input)="ui.maj({ frQ: q.value })" /></label>
        <span class="spacer"></span>
        <button type="button" class="btn" title="Importer un export de l’outil de notes de frais — bientôt disponible" (click)="etat.fenetre.set({ type: 'import-frais' })">
          Importer… <span class="soon">Bientôt</span>
        </button>
        @if (v.droits.peutModifier) {
          <button type="button" class="btn primary" (click)="etat.fenetre.set({ type: 'nouveau-frais', reprise: null })">+ Nouveau frais</button>
        }
      </div>
      <app-carte titre="Frais réels" sousTitre="Saisie directe dans le tableau. Cochez « Refacturable » pour les frais repris sur la facture client.">
        <div class="tw">
          <table class="reg dep">
            <thead>
              <tr>
                <th>Date</th>
                <th>Collaborateur</th>
                <th>Catégorie</th>
                <th>Libellé</th>
                <th class="n">Montant HT</th>
                <th class="ctr">Refacturable</th>
                <th>Commentaire</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (x of m.liste; track x.id) {
                <tr [attr.data-row]="x.id">
                  <td><input class="in w-date" type="date" aria-label="Date" [value]="x.date" [disabled]="lecture()" #f1 (change)="champ(x, 'date', f1, x.date)" /></td>
                  <td>
                    <input class="in" list="dl-people" placeholder="Collaborateur" aria-label="Collaborateur" [value]="x.collaborateur" [disabled]="lecture()" #f2 (change)="champ(x, 'collaborateur', f2, x.collaborateur)" />
                  </td>
                  <td>
                    <select class="in" aria-label="Catégorie" [disabled]="lecture()" #f3 (change)="champ(x, 'categorie', f3, x.categorie)">
                      @for (c of categories; track c) {
                        <option [value]="c" [selected]="c === (x.categorie || 'Autre')">{{ c }}</option>
                      }
                    </select>
                  </td>
                  <td class="c-lib">
                    <input class="in w-full" placeholder="Libellé" aria-label="Libellé" [value]="x.libelle" [disabled]="lecture()" #f4 (change)="champ(x, 'libelle', f4, x.libelle)" />
                  </td>
                  <td class="num">
                    <input class="in w-eur" inputmode="decimal" aria-label="Montant HT" [value]="eurIn(x.montant)" [disabled]="lecture()" #f5 (change)="champ(x, 'montant', f5, eurIn(x.montant))" />
                  </td>
                  <td class="ctr">
                    <input type="checkbox" aria-label="Refacturable au client" [checked]="x.refacturable" [disabled]="lecture()" #f6 (change)="refacturable(x, f6)" />
                  </td>
                  <td class="c-com">
                    <input class="in w-full" placeholder="—" aria-label="Commentaire" [value]="x.commentaire" [disabled]="lecture()" #f7 (change)="champ(x, 'commentaire', f7, x.commentaire)" />
                  </td>
                  <td>
                    @if (!lecture()) {
                      <button type="button" class="btn sm ghost" title="Supprimer" [attr.aria-label]="'Supprimer ' + (x.libelle || 'ce frais')" (click)="supprimer(x)">✕</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="empty">{{ m.lignesReelles.length ? 'Aucun frais ne correspond au filtre.' : 'Aucun frais saisi. Ajoutez le premier avec « + Nouveau frais ».' }}</td>
                </tr>
              }
              @if (m.liste.length) {
                <tr class="total">
                  <td>TOTAL</td>
                  <td></td>
                  <td></td>
                  <td>{{ m.liste.length }} ligne(s)</td>
                  <td class="n">{{ fE2(m.totalMontant) }}</td>
                  <td class="ctr">
                    <span class="muted">{{ fE2(m.totalRefacture) }}</span>
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte>
      @if (m.lignesReelles.length) {
        <app-carte-repliable cle="fr-rep" titre="Répartition" sousTitre="Frais saisis par catégorie et par collaborateur.">
          <div class="grid2">
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <th>Catégorie</th>
                    <th class="n">Montant HT</th>
                    <th class="n">Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of m.parCategorie; track c.cle) {
                    <tr>
                      <td>{{ c.cle }}</td>
                      <td class="n">{{ fE2(c.montant) }}</td>
                      <td class="n">{{ c.n }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="tw">
              <table>
                <thead>
                  <tr>
                    <th>Collaborateur</th>
                    <th class="n">Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of m.parCollab; track c.cle) {
                    <tr>
                      <td>{{ c.cle }}</td>
                      <td class="n">{{ fE2(c.montant) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </app-carte-repliable>
      }
      <app-carte-repliable cle="fr-bud" titre="Budget du TSP" [sousTitre]="'Frais refacturables : le plus élevé du budget (' + fE2(F.budgetRefCout) + ') et du réel (' + fE2(F.reelRef) + '), remboursés par le client. Frais à notre charge : le plus élevé de la part prévue (' + fE2(F.budgetNonRef) + ') et du réel non refacturé (' + fE2(F.reelNonRef) + '). Atterrissage ' + fE2(F.att) + ', effet sur la marge ' + signe(F.impactNet) + '.'">
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Libellé</th>
                <th class="n">Coût unitaire</th>
                <th class="n">Qté</th>
                <th class="n">Montant</th>
                <th class="n">Montant refacturé</th>
                <th>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              @for (x of v.fraisRows; track $index) {
                <tr>
                  <td>{{ x.libelle }}</td>
                  <td class="n">{{ fE2(x.cu) }}</td>
                  <td class="n">{{ fJ(x.qte) }}</td>
                  <td class="n">{{ fE2(x.montant) }}</td>
                  <td class="n">{{ fE2(x.refacture) }}</td>
                  <td>{{ x.commentaire }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty">Aucun frais prévu au TSP.</td>
                </tr>
              }
              @if (v.fraisRows.length) {
                <tr class="total">
                  <td>TOTAL</td>
                  <td></td>
                  <td></td>
                  <td class="n">{{ fE2(v.m.synthese?.fraisDep) }}</td>
                  <td class="n">{{ fE2(v.m.synthese?.fraisRef) }}</td>
                  <td></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte-repliable>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Frais {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  protected readonly categories = FRAIS_CATEGORIES;
  protected readonly fE2 = fE2;
  /** Montant signé (« +250 € », « −250 € ») : effet des frais sur la marge. */
  protected readonly signe = signeE;
  protected readonly fJ = fJ;
  protected readonly eurIn = eurIn;
  protected readonly lecture = computed(() => !this.etat.vue()?.droits.peutModifier);

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    const F = v?.m.financier?.frais;
    if (!v || !F) return null;
    const u = this.ui.ui();
    const q = u.frQ.trim().toLowerCase();
    const lignesReelles = v.projet.fraisReel ?? [];
    const liste = lignesReelles
      .filter(
        (x) =>
          (!u.frC || (x.collaborateur || '—') === u.frC) &&
          (!u.frCat || (x.categorie || 'Autre') === u.frCat) &&
          (!q || `${x.libelle} ${x.commentaire}`.toLowerCase().includes(q)),
      )
      .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
    return {
      v,
      F,
      lignesReelles,
      liste,
      collaborateurs: distincts(lignesReelles.map((x) => x.collaborateur || '—')).sort(),
      totalMontant: sum(liste.map((x) => x.montant)),
      totalRefacture: sum(liste.map((x) => x.refacture)),
      parCategorie: F.parCategorie.filter((c) => c.n > 0),
      parCollab: [...F.parCollab].sort((a, b) => b.montant - a.montant),
    };
  });

  protected champ(x: FraisReel, champ: string, el: Champ, ancien: string): void {
    let valeur = el.value.trim();
    if (champ === 'montant') {
      const r = lireMontant(champ, el.value);
      if (!r.ok) {
        el.value = ancien;
        this.etat.afficher(r.message, 'erreur');
        return;
      }
      valeur = r.valeur;
    } else if (champ === 'date' && !valeur) {
      el.value = ancien;
      this.etat.afficher('La date est obligatoire : saisie annulée.', 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.modifier(id, 'frais', x.id, { champ, valeur, version: this.etat.versionLigne('frais', x.id) }), {
      siErreur: () => (el.value = ancien),
    });
  }

  protected refacturable(x: FraisReel, el: HTMLInputElement): void {
    void this.etat.saisir(
      (id) => this.api.modifier(id, 'frais', x.id, { champ: 'refacturable', valeur: el.checked ? 'true' : 'false', version: this.etat.versionLigne('frais', x.id) }),
      { siErreur: () => (el.checked = x.refacturable) },
    );
  }

  protected async supprimer(x: FraisReel): Promise<void> {
    const ok = await this.etat.confirmer('Supprimer ce frais ?', [`« ${x.libelle} » — ${fE2(x.montant)} HT`], 'Supprimer');
    if (ok) void this.etat.saisir((id) => this.api.supprimerLigne(id, 'frais', x.id));
  }
}
