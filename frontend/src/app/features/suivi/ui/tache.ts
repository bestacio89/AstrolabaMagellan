import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { fDi, fJ, stSlug } from '../etat/formats';
import { TacheVue } from '../etat/vue';

/** Étiquette « Nouvelle » (tâche ajoutée en cours de projet) ou « +x JH » (charge ajoutée, non facturée). */
@Component({
  selector: 'app-etiquette-ajout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (t().estAjout) {
      <span class="tag-new" [title]="titreAjout()">Nouvelle</span>
    } @else if (t().chargeAjout) {
      <span class="tag-aj" [title]="fJ(t().chargeAjout) + ' JH ajoutés en cours de projet (non facturés)'">+{{ fJ(t().chargeAjout) }} JH</span>
    }
  `,
  styles: `
    :host {
      display: inline;
    }
  `,
})
export class EtiquetteAjout {
  readonly t = input.required<TacheVue>();
  protected readonly fJ = fJ;

  protected titreAjout(): string {
    const a = this.t().ajout;
    return `Tâche ajoutée le ${fDi(a?.at)}${a?.by ? ' par ' + a.by : ''} — ${a?.motif ?? ''}`;
  }
}

/**
 * Nom de tâche cliquable (ouvre le panneau de détail : attribut data-open, géré par l'écran de suivi),
 * suivi de l'étiquette « Nouvelle » (tâche ajoutée) ou « +x JH » (charge ajoutée).
 */
@Component({
  selector: 'app-lien-tache',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="tlink" [attr.data-open]="t().uid" title="Ouvrir le détail de la tâche">{{ t().label }}</button>
    @if (etiquette()) {
      <app-etiquette-ajout [t]="t()" />
    }
  `,
  imports: [EtiquetteAjout],
  styles: `
    :host {
      display: inline;
    }
  `,
})
export class LienTache {
  readonly t = input.required<TacheVue>();
  readonly etiquette = input(true);
}

/** Pastille de statut d'une tâche. */
@Component({
  selector: 'app-statut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [class]="'pill st-' + stSlug(statut()) + (petit() ? ' xs' : '')">{{ statut() }}</span>`,
  styles: `
    :host {
      display: inline;
    }
  `,
})
export class Statut {
  readonly statut = input.required<string>();
  readonly petit = input(false);
  protected readonly stSlug = stSlug;
}
