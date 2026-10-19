import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatEuros, formatPourcentage } from '../../../shared/format/formats';
import { Icone } from '../../../shared/ui/icone';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { arrondi, lireNombre, moisValide, nouvelId, texteNombre, totalEcheances } from '../etat/brouillon.logique';
import { ControlesRubrique, EtatRubrique } from './communs';

/** Rubrique « Échéancier » : l'onglet ECHEANCIER du TSP (jalons de facturation, part du contrat, mois prévu). Total : 100 %. */
@Component({
  selector: 'app-echeancier-brouillon',
  imports: [Icone, EtatRubrique, ControlesRubrique],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.contenu(); as tsp) {
      <section class="card">
        <header>
          <div>
            <h2>Échéancier de facturation</h2>
            <p>Chaque échéance facture une part du contrat (charge vendue). Le total doit faire 100 %.</p>
          </div>
          <app-etat-rubrique rubrique="echeancier" />
        </header>
        @if (tsp.echeances.length) {
          <div class="tw">
            <table class="ec-t">
              <thead>
                <tr>
                  <th scope="col" class="n">N°</th>
                  <th scope="col">Échéance</th>
                  <th scope="col" class="n">Part du contrat</th>
                  <th scope="col">Mois de facturation</th>
                  <th scope="col" class="n">Montant</th>
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (e of tsp.echeances; track e.id; let i = $index) {
                  <tr>
                    <td class="n muted num">{{ i + 1 }}</td>
                    <td><input class="in ec-nom" [value]="e.nom" (input)="nom(e.id, $event)" aria-label="Nom de l’échéance" placeholder="Ex. Commande, Recette, Mise en production" /></td>
                    <td class="n">
                      <span class="ec-pct"><input class="in w-num" inputmode="decimal" [value]="tn(pourcent(e.pct))" (change)="pct(e.id, $event)" aria-label="Part du contrat en %" /> %</span>
                    </td>
                    <td><input class="in" type="month" [value]="e.mois ?? ''" (change)="mois(e.id, $event)" aria-label="Mois de facturation" [class.bad]="!e.mois" /></td>
                    <td class="n num">{{ eur(e.pct * ca()) }}</td>
                    <td>
                      <button type="button" class="btn ghost ec-x" (click)="supprimer(e.id)" [attr.aria-label]="'Supprimer l’échéance ' + (i + 1)"><app-icone nom="poubelle" [taille]="16" /></button>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="total">
                  <td></td>
                  <td>Total</td>
                  <td class="n num ec" [class.ok]="complet()" [class.ko]="!complet()">{{ pc(total(), 1) }}</td>
                  <td></td>
                  <td class="n num">{{ eur(total() * ca()) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        } @else {
          <p class="empty">Aucune échéance. Ajoutez les jalons de facturation prévus au contrat.</p>
        }
        <div class="ec-pied">
          <button type="button" class="btn ec-ajout" (click)="ajouter()"><app-icone nom="plus" [taille]="16" />Ajouter une échéance</button>
          @if (tsp.echeances.length && total() < 1) {
            <button type="button" class="btn" (click)="completer()">Compléter la dernière à 100 %</button>
          }
          <span class="muted">Montants calculés sur le chiffre d’affaires des prestations ({{ eur(ca()) }}).</span>
        </div>
      </section>
      <app-controles-rubrique rubrique="echeancier" />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .ec-nom {
      width: 100%;
      min-width: 220px;
    }
    .ec-t .in {
      height: 32px;
    }
    .ec-pct {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .ec-x {
      width: 32px;
      height: 32px;
      padding: 0;
      justify-content: center;
    }
    .ec-pied {
      display: flex;
      align-items: center;
      gap: 10px 14px;
      flex-wrap: wrap;
      margin-top: 12px;
      font-size: 12.5px;
    }
    .ec-pied .btn {
      height: 36px;
      padding: 0 14px;
      gap: 6px;
    }
    .ec-ajout {
      color: var(--accent);
      border-style: dashed;
      border-color: var(--accent);
    }
  `,
})
export class EcheancierBrouillon {
  protected readonly etat = inject(BrouillonEtat);
  protected readonly eur = formatEuros;
  protected readonly pc = formatPourcentage;
  protected readonly tn = texteNombre;

  protected readonly ca = computed(() => this.etat.analyse()?.synthese?.ca ?? 0);
  protected readonly total = computed(() => totalEcheances(this.etat.contenu()?.echeances ?? []));
  protected readonly complet = computed(() => Math.abs(this.total() - 1) < 0.00005);

  protected pourcent(pct: number): number {
    return arrondi(pct * 100, 4);
  }

  protected nom(id: string, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.etat.modifier((t) => {
      const e = t.echeances.find((x) => x.id === id);
      if (e) e.nom = valeur;
    });
  }

  protected pct(id: string, evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const n = lireNombre(champ.value);
    const e0 = this.etat.contenu()?.echeances.find((x) => x.id === id);
    if (n === null || n < 0 || n > 100) {
      champ.value = texteNombre(this.pourcent(e0?.pct ?? 0));
      return;
    }
    this.etat.modifier((t) => {
      const e = t.echeances.find((x) => x.id === id);
      if (e) e.pct = arrondi(n / 100, 6);
    });
  }

  protected mois(id: string, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.etat.modifier((t) => {
      const e = t.echeances.find((x) => x.id === id);
      if (e) e.mois = moisValide(valeur) ? valeur : null;
    });
  }

  protected ajouter(): void {
    this.etat.modifier((t) => {
      const reste = Math.max(0, arrondi(1 - totalEcheances(t.echeances), 6));
      t.echeances.push({ id: nouvelId('e', t.echeances), nom: '', pct: reste, mois: null });
    });
  }

  protected completer(): void {
    this.etat.modifier((t) => {
      const derniere = t.echeances[t.echeances.length - 1];
      if (derniere) derniere.pct = arrondi(derniere.pct + 1 - totalEcheances(t.echeances), 6);
    });
  }

  protected supprimer(id: string): void {
    this.etat.modifier((t) => (t.echeances = t.echeances.filter((x) => x.id !== id)));
  }
}
