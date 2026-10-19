import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatEuros } from '../../../shared/format/formats';
import { FicheSaisie } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { ControlesRubrique, EtatRubrique } from './communs';

type ChampTexte = Exclude<keyof FicheSaisie, 'debut' | 'fin'>;

/** Rubrique « Fiche projet » : l'onglet FICHE PROJET du TSP (client, projet, référence, interlocuteurs, période). */
@Component({
  selector: 'app-fiche-brouillon',
  imports: [RouterLink, EtatRubrique, ControlesRubrique],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.contenu(); as tsp) {
      @let f = tsp.fiche;
      <section class="card">
        <header>
          <div>
            <h2>Fiche projet</h2>
            <p>L’onglet FICHE PROJET du TSP. Le client, le projet et la période sont nécessaires pour lancer le projet.</p>
          </div>
          <app-etat-rubrique rubrique="fiche" />
        </header>
        <div class="fb-grille">
          <label class="champ">
            <span>Client <span class="obligatoire" aria-hidden="true">*</span></span>
            <input [value]="f.client" (input)="texte('client', $event)" autocomplete="off" required maxlength="200" />
          </label>
          <label class="champ">
            <span>Projet <span class="obligatoire" aria-hidden="true">*</span></span>
            <input [value]="f.projet" (input)="texte('projet', $event)" autocomplete="off" required maxlength="200" />
          </label>
          <label class="champ fb-large">
            <span>Référence de la proposition <small>Avec le numéro d’opportunité (OP…) : c’est lui qui garantit qu’un forfait n’est suivi qu’une fois.</small></span>
            <input [value]="f.reference" (input)="texte('reference', $event)" autocomplete="off" maxlength="100" placeholder="OP0012345 - CLIENT - Projet - TSP - V1" />
          </label>
          @if (unicite(); as u) {
            <p class="fb-large fb-unicite" [class.fb-ko]="u.niveau === 'bloquant'" role="status">
              <b>{{ u.titre }}</b> {{ u.detail }}
              @if (existant()?.id; as idProjet) {
                <a [routerLink]="existant()!.archive ? ['/projets', idProjet, 'parametres'] : ['/projets', idProjet]">Ouvrir le projet existant</a>
              }
            </p>
          }
          <label class="champ">
            <span>Contact client</span>
            <input [value]="f.contact" (input)="texte('contact', $event)" autocomplete="off" />
          </label>
          <label class="champ">
            <span>Commercial</span>
            <input [value]="f.commercial" (input)="texte('commercial', $event)" autocomplete="off" />
          </label>
          <label class="champ">
            <span>Agence</span>
            <input [value]="f.agence" (input)="texte('agence', $event)" autocomplete="off" />
          </label>
          <label class="champ">
            <span>Service line</span>
            <input [value]="f.serviceLine" (input)="texte('serviceLine', $event)" autocomplete="off" />
          </label>
          <label class="champ">
            <span>Directeur d’agence</span>
            <input [value]="f.directeur" (input)="texte('directeur', $event)" autocomplete="off" />
          </label>
          <label class="champ">
            <span>Responsable de la service line</span>
            <input [value]="f.responsableSL" (input)="texte('responsableSL', $event)" autocomplete="off" />
          </label>
        </div>
      </section>

      <section class="card">
        <header>
          <div>
            <h2>Contrat et période</h2>
            <p>La période sert au planning mensuel, au Gantt et au calendrier du projet.</p>
          </div>
        </header>
        <div class="fb-grille fb-3">
          <label class="champ">
            <span>Type de contrat</span>
            <select (change)="texte('typeContrat', $event)">
              @for (t of typesContrat(); track t) {
                <option [value]="t" [selected]="t === f.typeContrat">{{ t }}</option>
              }
            </select>
          </label>
          <label class="champ">
            <span>Début <span class="obligatoire" aria-hidden="true">*</span></span>
            <input type="date" [value]="f.debut ?? ''" (change)="date('debut', $event)" required />
          </label>
          <label class="champ">
            <span>Fin contractuelle <span class="obligatoire" aria-hidden="true">*</span></span>
            <input type="date" [value]="f.fin ?? ''" [min]="f.debut ?? ''" (change)="date('fin', $event)" required />
          </label>
          <div class="champ">
            <span>Montant du contrat</span>
            <span class="fb-calcule num">{{ montant() }}</span>
            <small>Calculé : charge × TJM, remise déduite, plus les achats et frais refacturés.</small>
          </div>
        </div>
      </section>

      <app-controles-rubrique rubrique="fiche" />
      <p class="fb-note"><span class="obligatoire">*</span> nécessaire pour lancer le projet. Tout est enregistré au fil de la saisie.</p>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .fb-grille {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 16px;
    }
    .fb-grille.fb-3 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .fb-large {
      grid-column: 1 / -1;
    }
    .champ small {
      display: block;
    }
    .fb-calcule {
      height: 40px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      border-radius: var(--rayon);
      background: var(--surface-2);
      font-weight: 600;
    }
    .fb-unicite {
      margin: -4px 0 0;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--ok-soft);
      color: var(--ink);
      font-size: 13px;
    }
    .fb-unicite.fb-ko {
      background: var(--crit-soft);
    }
    .fb-unicite a {
      margin-left: 6px;
    }
    .fb-note {
      margin: 0;
      font-size: 12.5px;
      color: var(--muted);
    }
    @media (max-width: 1100px) {
      .fb-grille.fb-3 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .fb-grille,
      .fb-grille.fb-3 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class FicheBrouillon {
  protected readonly etat = inject(BrouillonEtat);

  protected readonly typesContrat = computed(() => {
    const liste = this.etat.brouillon()?.suggestions.typesContrat ?? ['Forfait'];
    const actuel = this.etat.contenu()?.fiche.typeContrat;
    return actuel && !liste.includes(actuel) ? [...liste, actuel] : liste;
  });
  protected readonly montant = computed(() => {
    const s = this.etat.analyse()?.synthese;
    return s ? formatEuros(s.montantProjet) : '—';
  });
  protected readonly unicite = computed(() => this.etat.analyse()?.controles.find((c) => c.cle === 'fiche.unicite') ?? null);
  protected readonly existant = computed(() => this.etat.analyse()?.projetExistant ?? null);

  protected texte(champ: ChampTexte, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement | HTMLSelectElement).value;
    this.etat.modifier((t) => (t.fiche[champ] = valeur));
  }

  protected date(champ: 'debut' | 'fin', evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.etat.modifier((t) => (t.fiche[champ] = valeur || null));
  }
}
