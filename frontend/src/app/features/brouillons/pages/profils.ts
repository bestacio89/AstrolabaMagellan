import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatEuros, formatJh, formatPourcentage } from '../../../shared/format/formats';
import { Fenetre } from '../../../shared/ui/fenetre';
import { Icone } from '../../../shared/ui/icone';
import { ProfilSaisi } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { arrondi, chargeProfil, lireNombre, nouvelId, texteNombre } from '../etat/brouillon.logique';
import { ControlesRubrique, EtatRubrique } from './communs';

type ChampNombre = 'tjm' | 'cjm' | 'prcs' | 'frais';

/** Rubrique « Profils et prix » : l'onglet PROFIL du TSP (profils vendus, entité, TJM, CJM, remise). */
@Component({
  selector: 'app-profils-brouillon',
  imports: [Icone, Fenetre, EtatRubrique, ControlesRubrique],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.contenu(); as tsp) {
      <section class="card">
        <header>
          <div>
            <h2>Profils et prix</h2>
            <p>TJM et CJM propres à ce projet. La charge de chaque profil vient du workload ; le CA et la marge sont calculés.</p>
          </div>
          <div class="pf-tete">
            <label class="pf-remise">
              Remise accordée
              <input class="in" inputmode="decimal" [value]="remise()" (change)="changerRemise($event)" aria-describedby="pf-remise-aide" />
              <span>%</span>
            </label>
            <app-etat-rubrique rubrique="profils" />
          </div>
        </header>
        <p id="pf-remise-aide" class="visuellement-cache">Remise commerciale appliquée à tous les TJM, en pourcentage.</p>

        @if (tsp.profils.length) {
          <div class="tw">
            <table class="pf">
              <thead>
                <tr>
                  <th scope="col">Profil</th>
                  <th scope="col">Entité</th>
                  <th scope="col" class="n">TJM</th>
                  <th scope="col" class="n">CJM</th>
                  <th scope="col" class="n" title="Coût de revient d’un profil BO (450 € si vide), ou frais d’un profil en cession">PRCS / frais</th>
                  <th scope="col" class="n">Charge</th>
                  <th scope="col" class="n">CA</th>
                  <th scope="col" class="n">Marge</th>
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of tsp.profils; track p.id; let i = $index) {
                  <tr>
                    <td class="pf-c-nom">
                      <input class="in pf-nom" [value]="p.nom" (input)="texte(p.id, 'nom', $event)" list="pf-suggestions" aria-label="Nom du profil" placeholder="Ex. Chef de projet" />
                      <input class="in pf-perso" [value]="p.collaborateur" (input)="texte(p.id, 'collaborateur', $event)" aria-label="Personne prévue sur ce profil (facultatif)" placeholder="Personne prévue (facultatif)" title="Relie le profil à « Mon travail » de cette personne" />
                    </td>
                    <td>
                      <select class="in" (change)="texte(p.id, 'entite', $event)" aria-label="Entité">
                        @for (e of entites(); track e) {
                          <option [value]="e" [selected]="e === p.entite">{{ e }}</option>
                        }
                      </select>
                    </td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(p.tjm)" (change)="nombre(p, 'tjm', $event)" aria-label="TJM (€)" /></td>
                    <td class="n"><input class="in w-num" inputmode="decimal" [value]="tn(p.cjm)" (change)="nombre(p, 'cjm', $event)" aria-label="CJM (€)" /></td>
                    <td class="n">
                      @if (p.entite === 'BO' || p.entite === 'ACHAT BO') {
                        <input class="in w-num" inputmode="decimal" [value]="tn(p.prcs)" placeholder="450" (change)="nombre(p, 'prcs', $event)" aria-label="PRCS (€)" />
                      } @else if (p.entite === 'CESSION') {
                        <input class="in w-num" inputmode="decimal" [value]="tn(p.frais)" (change)="nombre(p, 'frais', $event)" aria-label="Frais de déplacement (€)" />
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="n num">{{ jh(charge(p.id)) }} <span class="muted">JH</span></td>
                    <td class="n num">{{ eur(calcul(i)?.ca) }}</td>
                    <td class="n num">{{ pct(calcul(i)?.marge, 1) }}</td>
                    <td>
                      <button type="button" class="btn ghost pf-x" (click)="demanderSuppression(p)" [attr.aria-label]="'Retirer le profil ' + (p.nom || 'sans nom')">
                        <app-icone nom="poubelle" [taille]="16" />
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="total">
                  <td colspan="5">Total</td>
                  <td class="n num">{{ jh(total()) }} <span class="muted">JH</span></td>
                  <td class="n num">{{ eur(etat.analyse()?.synthese?.ca) }}</td>
                  <td class="n num">{{ pct(etat.analyse()?.synthese?.tauxMarge, 1) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        } @else {
          <p class="empty">Aucun profil pour l’instant. Ajoutez les profils vendus : leur nom devient une colonne du workload.</p>
        }
        <datalist id="pf-suggestions">
          @for (s of suggestions(); track s) {
            <option [value]="s"></option>
          }
        </datalist>
        <div class="pf-pied">
          <button type="button" class="btn pf-ajout" (click)="ajouter()"><app-icone nom="plus" [taille]="16" />Ajouter un profil</button>
          <span class="muted">Le CJM et les marges ne sont montrés qu’aux rôles qui voient les montants, comme dans le reste de l’application.</span>
        </div>
      </section>
      <app-controles-rubrique rubrique="profils" />

      <app-fenetre titre="Retirer ce profil ?" [ouverte]="!!aSupprimer()" (fermee)="aSupprimer.set(null)">
        @if (aSupprimer(); as p) {
          <p>
            « {{ p.nom || 'Profil sans nom' }} » porte <b>{{ jh(charge(p.id)) }} JH</b> au workload. Ces jours et son planning seront retirés.
          </p>
        }
        <div pied>
          <button type="button" class="btn" (click)="aSupprimer.set(null)">Annuler</button>
          <button type="button" class="btn primary" (click)="supprimer()">Retirer le profil</button>
        </div>
      </app-fenetre>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .pf-tete {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pf-remise {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--ink-2);
    }
    .pf-remise .in {
      width: 60px;
      text-align: right;
    }
    table.pf td {
      padding: 5px 8px;
    }
    .pf-c-nom {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 190px;
    }
    .pf-nom {
      width: 100%;
    }
    .pf .pf-perso {
      width: 100%;
      height: 26px;
      font-size: 12px;
      border-color: transparent;
      background: transparent;
      color: var(--ink-2);
    }
    .pf .pf-perso:hover,
    .pf .pf-perso:focus {
      border-color: var(--line-strong);
      background: var(--surface);
    }
    .pf select.in {
      width: 96px;
    }
    .pf .in {
      height: 32px;
    }
    .pf-x {
      width: 32px;
      height: 32px;
      padding: 0;
      justify-content: center;
    }
    .pf-pied {
      display: flex;
      align-items: center;
      gap: 12px 16px;
      flex-wrap: wrap;
      margin-top: 12px;
      font-size: 12.5px;
    }
    .pf-ajout {
      height: 36px;
      padding: 0 14px;
      gap: 6px;
      color: var(--accent);
      border-style: dashed;
      border-color: var(--accent);
    }
  `,
})
export class ProfilsBrouillon {
  protected readonly etat = inject(BrouillonEtat);
  protected readonly aSupprimer = signal<ProfilSaisi | null>(null);
  protected readonly jh = formatJh;
  protected readonly eur = formatEuros;
  protected readonly pct = formatPourcentage;
  protected readonly tn = texteNombre;

  protected readonly entites = computed(() => this.etat.brouillon()?.suggestions.entites ?? ['FO']);
  protected readonly suggestions = computed(() => this.etat.brouillon()?.suggestions.profils ?? []);
  protected readonly remise = computed(() => texteNombre(arrondi((this.etat.contenu()?.remise ?? 0) * 100, 2)));
  protected readonly total = computed(() => {
    const tsp = this.etat.contenu();
    return tsp ? tsp.profils.reduce((s, p) => s + chargeProfil(tsp, p.id), 0) : 0;
  });

  protected charge(id: string): number {
    const tsp = this.etat.contenu();
    return tsp ? chargeProfil(tsp, id) : 0;
  }

  /** CA et marge du profil (calculés par le serveur au dernier enregistrement). */
  protected calcul(index: number) {
    return this.etat.analyse()?.profils.find((p) => p.index === index) ?? null;
  }

  protected texte(id: string, champ: 'nom' | 'entite' | 'collaborateur', evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement | HTMLSelectElement).value;
    this.etat.modifier((t) => {
      const p = t.profils.find((x) => x.id === id);
      if (p) p[champ] = valeur;
    });
  }

  protected nombre(profil: ProfilSaisi, champ: ChampNombre, evenement: Event): void {
    const champSaisi = evenement.target as HTMLInputElement;
    const n = lireNombre(champSaisi.value);
    if (n === null || n < 0) {
      champSaisi.value = texteNombre(profil[champ]);
      return;
    }
    this.etat.modifier((t) => {
      const p = t.profils.find((x) => x.id === profil.id);
      if (!p) return;
      if (champ === 'prcs') p.prcs = champSaisi.value.trim() === '' ? null : n;
      else p[champ] = n;
    });
  }

  protected changerRemise(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const n = lireNombre(champ.value);
    if (n === null || n < 0 || n > 100) {
      champ.value = this.remise();
      return;
    }
    this.etat.modifier((t) => (t.remise = arrondi(n / 100, 6)));
  }

  protected ajouter(): void {
    this.etat.modifier((t) =>
      t.profils.push({ id: nouvelId('p', t.profils), nom: '', entite: 'FO', tjm: 0, cjm: 0, prcs: null, frais: 0, collaborateur: '' }),
    );
  }

  protected demanderSuppression(p: ProfilSaisi): void {
    if (this.charge(p.id) === 0) this.retirer(p.id);
    else this.aSupprimer.set(p);
  }

  protected supprimer(): void {
    const p = this.aSupprimer();
    if (p) this.retirer(p.id);
    this.aSupprimer.set(null);
  }

  private retirer(id: string): void {
    this.etat.modifier((t) => {
      t.profils = t.profils.filter((x) => x.id !== id);
      for (const tache of t.taches) delete tache.charges[id];
      delete t.planning[id];
    });
  }
}
