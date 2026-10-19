import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { fP, largeur } from '../etat/formats';

/** Barre de progression avec son pourcentage. */
@Component({
  selector: 'app-barre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barrow">
      <div class="bar" [class]="'bar ' + classe()"><i [style.width]="largeur(valeur())"></i></div>
      <span class="num">{{ fP(valeur()) }}</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Barre {
  readonly valeur = input<number | null | undefined>(0);
  readonly classe = input('');
  protected readonly fP = fP;
  protected readonly largeur = largeur;
}

/** Petite barre (sans pourcentage). */
@Component({
  selector: 'app-mini-barre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="bar ok mini"><i [style.width]="largeur(valeur())"></i></span>`,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class MiniBarre {
  readonly valeur = input<number | null | undefined>(0);
  protected readonly largeur = largeur;
}

/**
 * Étapes nommées par ce qui est accompli (ex. Date fixée · Invitation envoyée · Réalisé).
 * faits : nombre d'étapes faites, ou une case par étape (une étape peut avoir été sautée : « — »).
 */
@Component({
  selector: 'app-etapes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="stepper" [style.grid-template-columns]="'repeat(' + libelles().length + ',1fr)'" [attr.aria-label]="titre()">
      @for (e of etapes(); track e.libelle; let i = $index) {
        <li [class]="e.classe" [attr.aria-current]="e.classe === 'cur' ? 'step' : null">
          <span>{{ e.classe === 'done' ? '✓' : e.classe === 'skip' ? '—' : i + 1 }}</span>{{ e.libelle }}
        </li>
      }
    </ol>
  `,
})
export class Etapes {
  readonly libelles = input.required<string[]>();
  readonly faits = input.required<number | boolean[]>();
  readonly titre = input('');
  protected readonly etapes = computed(() => {
    const f = this.faits();
    const ok = Array.isArray(f) ? f : this.libelles().map((_, i) => i < f);
    const suivante = ok.indexOf(false);
    const derniere = ok.lastIndexOf(true);
    return this.libelles().map((libelle, i) => {
      const fait = !!ok[i];
      const saute = !fait && i < derniere;
      const courante = !fait && !saute && i === suivante;
      return { libelle, classe: fait ? 'done' : saute ? 'skip' : courante ? 'cur' : '' };
    });
  });
}
