import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatEuros, formatPourcentage } from '../../../shared/format/formats';
import { Icone } from '../../../shared/ui/icone';
import { TspSaisi } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { lireNombre, nouvelId, texteNombre } from '../etat/brouillon.logique';
import { ControlesRubrique, EtatRubrique } from './communs';

type Liste = 'achats' | 'prestataires' | 'frais';

/** Rubrique « Achats et frais » (facultative) : onglets ACHAT (matériel, logiciel, prestataires externes) et FRAIS du TSP. */
@Component({
  selector: 'app-depenses-brouillon',
  imports: [Icone, EtatRubrique, ControlesRubrique],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.contenu(); as tsp) {
      <section class="card">
        <header>
          <div>
            <h2>Achats de matériel et de logiciel</h2>
            <p>Coût d’achat et montant revendu au client. Facultatif.</p>
          </div>
          <app-etat-rubrique rubrique="depenses" />
        </header>
        @if (tsp.achats.length) {
          <div class="tw">
            <table class="dp">
              <thead>
                <tr>
                  <th scope="col">Achat</th>
                  <th scope="col">Type</th>
                  <th scope="col" class="n">Coût unitaire</th>
                  <th scope="col" class="n">Qté</th>
                  <th scope="col" class="n">Coût</th>
                  <th scope="col" class="n">Revente</th>
                  <th scope="col" class="n">Marge</th>
                  <th scope="col">Commentaire</th>
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (a of tsp.achats; track a.id) {
                  <tr>
                    <td><input class="in dp-l" [value]="a.designation" (input)="texte('achats', a.id, 'designation', $event)" aria-label="Achat" /></td>
                    <td><input class="in dp-m" [value]="a.type" (input)="texte('achats', a.id, 'type', $event)" list="dp-types" aria-label="Type d’achat" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(a.cu)" (change)="nombre('achats', a.id, 'cu', $event)" aria-label="Coût unitaire (€)" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(a.qte)" (change)="nombre('achats', a.id, 'qte', $event)" aria-label="Quantité" /></td>
                    <td class="n num">{{ eur(a.cu * a.qte) }}</td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(a.revente)" (change)="nombre('achats', a.id, 'revente', $event)" aria-label="Montant revendu (€)" /></td>
                    <td class="n num">{{ a.revente ? pct((a.revente - a.cu * a.qte) / a.revente) : '—' }}</td>
                    <td><input class="in dp-c" [value]="a.commentaire" (input)="texte('achats', a.id, 'commentaire', $event)" aria-label="Commentaire" /></td>
                    <td><button type="button" class="btn ghost dp-x" (click)="supprimer('achats', a.id)" aria-label="Supprimer l’achat"><app-icone nom="poubelle" [taille]="16" /></button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <button type="button" class="btn dp-ajout" (click)="ajouter('achats')"><app-icone nom="plus" [taille]="16" />Ajouter un achat</button>
        <datalist id="dp-types">
          @for (t of typesAchat(); track t) {
            <option [value]="t"></option>
          }
        </datalist>
      </section>

      <section class="card">
        <header>
          <div>
            <h2>Prestataires externes</h2>
            <p>Sous-traitance : coût jour et jours achetés, TJM revendu au client. Facultatif.</p>
          </div>
        </header>
        @if (tsp.prestataires.length) {
          <div class="tw">
            <table class="dp">
              <thead>
                <tr>
                  <th scope="col">Prestation</th>
                  <th scope="col">Société</th>
                  <th scope="col" class="n">Coût jour</th>
                  <th scope="col" class="n">Jours</th>
                  <th scope="col" class="n">Coût</th>
                  <th scope="col" class="n">TJM revendu</th>
                  <th scope="col" class="n">Revente</th>
                  <th scope="col">Commentaire</th>
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of tsp.prestataires; track p.id) {
                  <tr>
                    <td><input class="in dp-l" [value]="p.designation" (input)="texte('prestataires', p.id, 'designation', $event)" aria-label="Prestation" /></td>
                    <td><input class="in dp-m" [value]="p.societe" (input)="texte('prestataires', p.id, 'societe', $event)" aria-label="Société" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(p.coutJour)" (change)="nombre('prestataires', p.id, 'coutJour', $event)" aria-label="Coût jour (€)" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(p.nbj)" (change)="nombre('prestataires', p.id, 'nbj', $event)" aria-label="Nombre de jours" /></td>
                    <td class="n num">{{ eur(p.coutJour * p.nbj) }}</td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(p.tjm)" (change)="nombre('prestataires', p.id, 'tjm', $event)" aria-label="TJM revendu (€)" /></td>
                    <td class="n num">{{ eur(p.tjm * p.nbj) }}</td>
                    <td><input class="in dp-c" [value]="p.commentaire" (input)="texte('prestataires', p.id, 'commentaire', $event)" aria-label="Commentaire" /></td>
                    <td><button type="button" class="btn ghost dp-x" (click)="supprimer('prestataires', p.id)" aria-label="Supprimer la prestation"><app-icone nom="poubelle" [taille]="16" /></button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <button type="button" class="btn dp-ajout" (click)="ajouter('prestataires')"><app-icone nom="plus" [taille]="16" />Ajouter un prestataire</button>
      </section>

      <section class="card">
        <header>
          <div>
            <h2>Frais</h2>
            <p>Déplacements, hébergement… et la part refacturée au client. Facultatif.</p>
          </div>
        </header>
        @if (tsp.frais.length) {
          <div class="tw">
            <table class="dp">
              <thead>
                <tr>
                  <th scope="col">Frais</th>
                  <th scope="col" class="n">Coût unitaire</th>
                  <th scope="col" class="n">Qté</th>
                  <th scope="col" class="n">Montant</th>
                  <th scope="col" class="n">Refacturé</th>
                  <th scope="col">Commentaire</th>
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (x of tsp.frais; track x.id) {
                  <tr>
                    <td><input class="in dp-l" [value]="x.libelle" (input)="texte('frais', x.id, 'libelle', $event)" aria-label="Frais" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(x.cu)" (change)="nombre('frais', x.id, 'cu', $event)" aria-label="Coût unitaire (€)" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(x.qte)" (change)="nombre('frais', x.id, 'qte', $event)" aria-label="Quantité" /></td>
                    <td class="n num">{{ eur(x.cu * x.qte) }}</td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(x.refacture)" (change)="nombre('frais', x.id, 'refacture', $event)" aria-label="Montant refacturé (€)" /></td>
                    <td><input class="in dp-c" [value]="x.commentaire" (input)="texte('frais', x.id, 'commentaire', $event)" aria-label="Commentaire" /></td>
                    <td><button type="button" class="btn ghost dp-x" (click)="supprimer('frais', x.id)" aria-label="Supprimer les frais"><app-icone nom="poubelle" [taille]="16" /></button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <button type="button" class="btn dp-ajout" (click)="ajouter('frais')"><app-icone nom="plus" [taille]="16" />Ajouter des frais</button>
      </section>
      <app-controles-rubrique rubrique="depenses" />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .dp .in {
      height: 32px;
    }
    .dp-l {
      width: 100%;
      min-width: 200px;
    }
    .dp-m {
      width: 100%;
      min-width: 130px;
    }
    .dp-c {
      width: 100%;
      min-width: 160px;
    }
    .dp-x {
      width: 32px;
      height: 32px;
      padding: 0;
      justify-content: center;
    }
    .dp-ajout {
      margin-top: 12px;
      height: 36px;
      padding: 0 14px;
      gap: 6px;
      color: var(--accent);
      border-style: dashed;
      border-color: var(--accent);
    }
  `,
})
export class DepensesBrouillon {
  protected readonly etat = inject(BrouillonEtat);
  protected readonly eur = formatEuros;
  protected readonly pct = (v: number) => formatPourcentage(v, 1);
  protected readonly tn = texteNombre;
  protected readonly typesAchat = computed(() => this.etat.brouillon()?.suggestions.typesAchat ?? []);

  private ligne(t: TspSaisi, liste: Liste, id: string): Record<string, unknown> | undefined {
    return (t[liste] as { id: string }[]).find((x) => x.id === id) as Record<string, unknown> | undefined;
  }

  protected texte(liste: Liste, id: string, champ: string, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.etat.modifier((t) => {
      const l = this.ligne(t, liste, id);
      if (l) l[champ] = valeur;
    });
  }

  protected nombre(liste: Liste, id: string, champ: string, evenement: Event): void {
    const saisie = evenement.target as HTMLInputElement;
    const n = lireNombre(saisie.value);
    if (n === null || n < 0) {
      const actuel = this.etat.contenu();
      saisie.value = texteNombre(actuel ? (this.ligne(actuel, liste, id)?.[champ] as number) : 0);
      return;
    }
    this.etat.modifier((t) => {
      const l = this.ligne(t, liste, id);
      if (l) l[champ] = n;
    });
  }

  protected ajouter(liste: Liste): void {
    this.etat.modifier((t) => {
      if (liste === 'achats') t.achats.push({ id: nouvelId('a', t.achats), designation: '', type: '', cu: 0, qte: 1, revente: 0, commentaire: '' });
      else if (liste === 'prestataires')
        t.prestataires.push({ id: nouvelId('s', t.prestataires), designation: '', societe: '', coutJour: 0, nbj: 0, tjm: 0, commentaire: '' });
      else t.frais.push({ id: nouvelId('f', t.frais), libelle: '', cu: 0, qte: 1, refacture: 0, commentaire: '' });
    });
  }

  protected supprimer(liste: Liste, id: string): void {
    this.etat.modifier((t) => {
      if (liste === 'achats') t.achats = t.achats.filter((x) => x.id !== id);
      else if (liste === 'prestataires') t.prestataires = t.prestataires.filter((x) => x.id !== id);
      else t.frais = t.frais.filter((x) => x.id !== id);
    });
  }
}
