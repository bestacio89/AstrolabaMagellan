import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SuiviApi } from '../api/suivi.api';
import { REPERES } from '../etat/constantes';
import { fD } from '../etat/formats';
import { addDays } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { messageErreurFichier, telecharger } from '../etat/fichiers';
import { Modale } from '../ui/modale';

/**
 * Export COPROJ : on choisit la période écoulée (par défaut depuis le dernier COPROJ) et l'horizon à venir.
 * Le chef de projet garde la date du dernier COPROJ et une photo des indicateurs (tableau de bord).
 */
@Component({
  selector: 'app-fenetre-export-coproj',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modale titre="Export COPROJ — comité projet" libelleValider="Générer le COPROJ" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
      <p class="m-ctx">Le COPROJ fait le point sur ce qui s’est passé <b>depuis le dernier comité</b> et sur ce qui arrive <b>dans les prochaines semaines</b>.</p>
      <div class="fgrid">
        <label class="field">Période couverte : du<input class="in" type="date" name="from" [value]="du()" #a (change)="du.set(a.value)" /></label>
        <label class="field">au<input class="in" type="date" name="to" [value]="au()" #b (change)="au.set(b.value)" /></label>
        <label class="field"
          >Horizon à venir
          <select class="in" name="horizon" #h (change)="horizon.set(+h.value)">
            @for (o of horizons; track o[0]) {
              <option [value]="o[0]" [selected]="o[0] === horizon()">{{ o[1] }}</option>
            }
          </select>
        </label>
        <div class="field">
          Dernier COPROJ<b>{{ dernier() ? fD(dernier()) : 'aucun' }}</b>
        </div>
      </div>
      <p class="note">
        Contenu : synthèse (avancement, activité de la période, points à traiter), plan d’action à compléter en séance, actions, décisions, risques, facturation, activité par
        personne, charge de l’équipe, ateliers & livrables, ajouts au périmètre, achats et frais.
      </p>
    </app-modale>
  `,
})
export class FenetreExportCoproj implements OnInit {
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly fD = fD;
  protected readonly horizons: [number, string][] = [
    [7, '1 semaine'],
    [14, '2 semaines'],
    [21, '3 semaines'],
    [28, '4 semaines'],
  ];
  protected readonly du = signal('');
  protected readonly au = signal('');
  protected readonly horizon = signal(14);
  protected readonly dernier = signal<string | null>(null);
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  ngOnInit(): void {
    const v = this.etat.vue();
    if (!v) return;
    const td = v.aujourdhui;
    const dernier = v.projet.settings.lastCoproj;
    this.dernier.set(dernier);
    this.du.set(dernier && dernier < td ? addDays(dernier, 1) : addDays(td, -14));
    this.au.set(td);
  }

  protected async valider(): Promise<void> {
    if (!this.du() || !this.au()) {
      this.erreur.set('Indiquez les deux dates de la période.');
      this.modale()?.signalerChamp(!this.du() ? 'from' : 'to');
      return;
    }
    if (this.du() > this.au()) {
      this.erreur.set('La date de début doit précéder la date de fin.');
      this.modale()?.signalerChamp('from');
      return;
    }
    this.occupe.set(true);
    this.erreur.set(null);
    try {
      const reponse = await firstValueFrom(this.api.coproj(this.etat.projetId(), this.du(), this.au(), this.horizon()));
      telecharger(reponse, `COPROJ - ${this.au()}.xlsx`);
      await this.etat.recharger();
      this.etat.afficher(
        this.etat.vue()?.droits.peutModifier
          ? 'Export COPROJ généré. La date est retenue et une photo des indicateurs est ajoutée au tableau de bord (carte « Évolution d’un comité à l’autre »).'
          : 'Export COPROJ généré.',
        'succes',
      );
      this.fermer.emit();
    } catch (e) {
      this.erreur.set(await messageErreurFichier(e));
    } finally {
      this.occupe.set(false);
    }
  }
}

/** Lexique : vocabulaire et règles de calcul (une notion = un nom). */
@Component({
  selector: 'app-fenetre-reperes',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modale titre="Lexique" libelleValider="Fermer" libelleAnnuler="" [large]="true" classe="rp-modal" (fermer)="fermer.emit()" (valider)="fermer.emit()">
      <p class="note" style="margin-top: 0">
        Une notion = un nom. Quand un écran reprend un libellé du TSP ou de la version de référence, il figure en « aussi affiché ».
      </p>
      @for (g of reperes; track g[0]) {
        <h3 class="rp-h">{{ g[0] }}</h3>
        <dl class="rp">
          @for (r of g[1]; track r[0]) {
            <dt>{{ r[0] }}</dt>
            <dd>
              {{ r[1] }}
              @if (r[2]) {
                <span class="rp-aussi">Aussi affiché : {{ r[2] }}</span>
              }
            </dd>
          }
        </dl>
      }
    </app-modale>
  `,
})
export class FenetreReperes {
  readonly fermer = output<void>();
  protected readonly reperes = REPERES;
}
