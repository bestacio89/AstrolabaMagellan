import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LigneEntite, LignePivot, LigneVente, Synthese } from '../api/modeles';
import { fE2, fJ, fP2 } from '../etat/formats';
import { Carte } from './cartes';

/** Une ligne du tableau « Par entité » : le libellé du TSP et la valeur à lire pour chaque entité (null : la ligne n'existe pas pour elle). */
interface LigneMatrice {
  libelle: string;
  valeur: (e: LigneEntite) => string | null;
}

/** Colonnes du tableau « Par entité », dans l'ordre de l'onglet SYNTHESE. */
const ENTITES = ['FO', 'CESSION', 'ACHAT', 'BO', 'ACHAT BO', 'TOTAL BO'] as const;

/**
 * Onglet SYNTHESE du TSP, à l'identique : mêmes libellés, mêmes règles (une valeur sans objet reste vide « — »).
 * Le même composant sert au brouillon (Rédaction › Synthèse) et au projet lancé (Vendu (TSP) › Synthèse) :
 * les chiffres vus avant le lancement sont ceux du projet lancé. Tous les montants viennent du moteur de calcul du serveur.
 */
@Component({
  selector: 'app-synthese-tsp',
  imports: [NgTemplateOutlet, Carte],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = synthese();
    <div class="kpis">
      <div class="kpi">
        <div class="l">Montant du projet</div>
        <div class="v">{{ fE2(s.montantProjet) }}</div>
        <div class="s">Jours valorisés + achats et frais à refacturer</div>
      </div>
      <div class="kpi">
        <div class="l">Nombre de jours produit</div>
        <div class="v">{{ fJ(s.jours) }}<small>JH</small></div>
        <div class="s">TJM client {{ fE2(s.tjmClient) }}</div>
      </div>
      <div class="kpi">
        <div class="l">Marge brute Exakis Nelite</div>
        <div class="v">{{ fP2(s.margeEN) }}</div>
        <div class="s">Sur les jours valorisés</div>
      </div>
      <div class="kpi hero">
        <div class="l">Marge nette Exakis Nelite</div>
        <div class="v">{{ fP2(s.margeNettePct) }}</div>
        <div class="s">{{ fE2(s.margeNette) }}</div>
      </div>
    </div>

    <div class="grid2 st-bloc">
      <app-carte titre="Production">
        <div class="kv st-kv">
          <div>Montant du projet (€)</div>
          <div class="num">{{ fE2(s.montantProjet) }}</div>
          <div>Nombre de jours produit (jh)</div>
          <div class="num">{{ fJ(s.jours) }}</div>
          <div>Jours valorisés (€)</div>
          <div class="num">{{ fE2(s.ca) }}</div>
          <div>Coût du projet pour Exakis Nelite (€)</div>
          <div class="num">{{ fE2(s.cout) }}</div>
          <div>CJM de production</div>
          <div class="num">{{ fE2(s.cjmProd) }}</div>
          <div>Marge brute Agence (%)</div>
          <div class="num">{{ fP2(s.margeAgence) }}</div>
          <div>Marge brute Exakis Nelite (%)</div>
          <div class="num">{{ fP2(s.margeEN) }}</div>
          <div>TJM Client (€)</div>
          <div class="num">{{ fE2(s.tjmClient) }}</div>
        </div>
      </app-carte>
      <app-carte titre="Frais, provision, achats et marge nette">
        <div class="kv st-kv">
          <div>Frais de déplacement (€)</div>
          <div class="num">{{ fE2(s.fraisDep) }}</div>
          <div>Montant des frais à refacturer (€)</div>
          <div class="num">{{ fE2(s.fraisRef) }}</div>
          <div>Frais non refacturés / jour produit</div>
          <div class="num">{{ fE2(s.fraisNonRefJour) }}</div>
          <div>Provision pour risque (JH)</div>
          <div class="num">{{ fJ(s.provJH) }}</div>
          <div>Provision pour risque (€)</div>
          <div class="num">{{ fE2(s.provEur) }}</div>
          <div>Provision pour risque (%)</div>
          <div class="num">{{ fP2(s.provPct) }}</div>
          <div>Montant des achats mat/log (€)</div>
          <div class="num">{{ fE2(s.achatsMt) }}</div>
          <div>Montant des achats à refacturer (€)</div>
          <div class="num">{{ fE2(s.achatsRef) }}</div>
          <div>Marge achats (€)</div>
          <div class="num">{{ fE2(s.margeAchats) }}</div>
          <div>Marge des achats / reventes (%)</div>
          <div class="num">{{ fP2(s.margeAchatsPct) }}</div>
          <div class="st-fort">Marge nette Exakis Nelite (€)</div>
          <div class="num st-fort">{{ fE2(s.margeNette) }}</div>
          <div class="st-fort">Marge nette Exakis Nelite (%)</div>
          <div class="num st-fort">{{ fP2(s.margeNettePct) }}</div>
        </div>
      </app-carte>
    </div>

    <app-carte class="st-bloc" titre="Par entité" sousTitre="FO = front office · CESSION = cession interne · ACHAT = sous-traitance · BO = back office. Une case vide « — » : sans objet pour l’entité, ou entité absente du TSP.">
      <div class="tw">
        <table class="st-ent">
          <thead>
            <tr>
              <th></th>
              @for (e of colonnes(); track e.entite) {
                <th class="n" [class.st-absent]="!e.jours" [class.st-total]="e.entite === 'TOTAL BO'">{{ e.entite }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (l of lignesMatrice; track l.libelle) {
              <tr>
                <td>{{ l.libelle }}</td>
                @for (e of colonnes(); track e.entite) {
                  <td class="n" [class.st-absent]="!e.jours" [class.st-total]="e.entite === 'TOTAL BO'">{{ l.valeur(e) ?? '' }}</td>
                }
              </tr>
            }
            <!-- indicateurs du back office : sous le TOTAL BO -->
            <tr class="st-back">
              <td>PRCS moyen du BACK</td>
              <td [attr.colspan]="colonnes().length - 1"></td>
              <td class="n st-total">{{ fE2(s.prcsMoyenBack) }}</td>
            </tr>
            <tr class="st-back">
              <td>Marge FRONT / BACK</td>
              <td [attr.colspan]="colonnes().length - 1"></td>
              <td class="n st-total">{{ fP2(s.margeFrontBack) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </app-carte>

    <div class="st-filtre">
      <label class="field"
        >Lot
        <select class="in" [value]="lot()" (change)="lot.set($any($event.target).value)">
          <option value="">(Tous)</option>
          @for (l of lots(); track l) {
            <option [value]="l || vide">{{ l || '(vide)' }}</option>
          }
        </select>
      </label>
      <span class="muted">Filtre des deux tableaux croisés, comme le filtre « Lot » de l’onglet SYNTHESE.</span>
    </div>
    <div class="grid2">
      <app-carte titre="Par phase">
        <ng-container *ngTemplateOutlet="pivot; context: { $implicit: parPhase(), titre: 'Phase' }" />
      </app-carte>
      <app-carte titre="Par étape">
        <ng-container *ngTemplateOutlet="pivot; context: { $implicit: parEtape(), titre: 'Étape' }" />
      </app-carte>
    </div>

    <ng-template #pivot let-liste let-titre="titre">
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>{{ titre }}</th>
              <th class="n">Charge (JH)</th>
              <th class="n">Valorisation</th>
            </tr>
          </thead>
          <tbody>
            @for (x of liste; track x.cle) {
              <tr>
                <td>{{ x.cle }}</td>
                <td class="n">{{ fJ(x.charge) }}</td>
                <td class="n">{{ fE2(x.valo) }}</td>
              </tr>
            }
            <tr class="total">
              <td>Total général</td>
              <td class="n">{{ fJ(total(liste, 'charge')) }}</td>
              <td class="n">{{ fE2(total(liste, 'valo')) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: contents;
    }
    .st-kv {
      grid-template-columns: minmax(200px, 1fr) auto;
    }
    .st-kv .num {
      text-align: right;
    }
    .st-fort {
      font-weight: 600;
      color: var(--ink) !important;
    }
    .st-bloc {
      margin-top: 16px;
    }
    .st-ent {
      table-layout: fixed;
      min-width: 760px;
    }
    .st-ent th:first-child,
    .st-ent td:first-child {
      width: 210px;
    }
    .st-ent th.n,
    .st-ent td.n {
      white-space: nowrap;
    }
    .st-absent {
      color: var(--muted);
    }
    .st-total {
      background: var(--surface-2);
      font-weight: 600;
    }
    .st-back td {
      background: var(--surface-2);
    }
    .st-back td.n {
      font-weight: 600;
    }
    .st-filtre {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin: 18px 0 10px;
    }
    .st-filtre .muted {
      font-size: 12.5px;
      padding-bottom: 8px;
    }
  `,
})
export class SyntheseTsp {
  readonly synthese = input.required<Synthese>();
  protected readonly lot = signal('');
  /** Valeur de l'option « (vide) » du filtre Lot. */
  protected readonly vide = '__vide';
  protected readonly fE2 = fE2;
  protected readonly fJ = fJ;
  protected readonly fP2 = fP2;

  /** Colonnes : les cinq entités (même vides) et le TOTAL BO, comme dans le TSP. */
  protected readonly colonnes = computed((): LigneEntite[] => {
    const s = this.synthese();
    const vide = (entite: string): LigneEntite => ({ entite, jours: 0, ca: 0, tjm: null, cjm: null, coutAgenceJour: null, margeEN: null, margeAgence: null });
    const toutes = [...(s.entites ?? s.parEntite ?? []), ...(s.totalBo ? [s.totalBo] : [])];
    return ENTITES.map((e) => toutes.find((x) => x.entite === e) ?? vide(e));
  });

  /** Lignes du tableau « Par entité » : chaque entité n'a que les lignes que le TSP lui donne. */
  protected readonly lignesMatrice: LigneMatrice[] = [
    { libelle: 'Nombre de jours produit (jh)', valeur: (e) => (e.jours ? fJ(e.jours) : '—') },
    { libelle: 'Jours valorisés (€)', valeur: (e) => (e.ca ? fE2(e.ca) : '—') },
    { libelle: 'TJM Client (€)', valeur: (e) => fE2(e.tjm) },
    { libelle: 'CJM Production (€)', valeur: (e) => (e.entite === 'ACHAT' ? null : fE2(e.cjm)) },
    { libelle: 'Coût d’achat moyen / j (€)', valeur: (e) => (e.entite === 'ACHAT' ? fE2(e.coutAgenceJour) : null) },
    { libelle: 'Marge Exakis Nelite (%)', valeur: (e) => (e.entite === 'ACHAT' ? null : fP2(e.margeEN)) },
    { libelle: 'Taux de cession interne', valeur: (e) => (e.entite === 'CESSION' ? fE2(e.coutAgenceJour) : null) },
    { libelle: 'Marge AGENCE (%)', valeur: (e) => (e.entite === 'CESSION' || e.entite === 'ACHAT' ? fP2(e.margeAgence) : null) },
  ];

  protected readonly lots = computed(() => [...new Set((this.synthese().lignes ?? []).map((l) => l.lot))].sort((a, b) => a.localeCompare(b, 'fr')));

  /** Lignes vendues retenues par le filtre « Lot ». */
  private readonly lignes = computed((): LigneVente[] => {
    const l = this.synthese().lignes ?? [];
    const lot = this.lot();
    // « (vide) » : les lignes sans lot (valeur distincte de « (Tous) », sinon les deux options se confondraient)
    return lot ? l.filter((x) => x.lot === (lot === this.vide ? '' : lot)) : l;
  });

  protected readonly parPhase = computed(() => this.pivoter((l) => l.phase, this.synthese().parPhase));
  protected readonly parEtape = computed(() => this.pivoter((l) => l.etape, this.synthese().parEtape));

  /** Charge et valorisation par clé (sans tenir compte des majuscules), dans l'ordre du workload ; sans lignes : le calcul du serveur. */
  private pivoter(cle: (l: LigneVente) => string, parDefaut: LignePivot[]): LignePivot[] {
    if (!this.synthese().lignes) return parDefaut;
    const res: LignePivot[] = [];
    for (const l of this.lignes()) {
      const k = cle(l).trim() || 'Non renseignée';
      // comme un tableau croisé Excel : « PROVISION » et « Provision » sont la même ligne
      let o = res.find((x) => x.cle.toLocaleUpperCase('fr') === k.toLocaleUpperCase('fr'));
      if (!o) res.push((o = { cle: k, charge: 0, valo: 0 }));
      o.charge += l.charge;
      o.valo += l.valo;
    }
    return res;
  }

  protected total(liste: LignePivot[], cle: 'charge' | 'valo'): number {
    return liste.reduce((s, x) => s + x[cle], 0);
  }

}
