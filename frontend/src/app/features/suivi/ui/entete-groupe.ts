import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { fJ } from '../etat/formats';
import { JaugeGroupe } from '../etat/entete-groupe.logique';

/** En-tête commun aux groupes des écrans Workload et Ateliers & livrables. */
@Component({
  selector: 'app-entete-groupe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="'grp-h ' + classe()">
      <button type="button" class="fold grp-fold" [attr.aria-expanded]="!replie()" [attr.aria-label]="(replie() ? 'Déplier' : 'Replier') + ' le groupe ' + nom()" [title]="(replie() ? 'Déplier' : 'Replier') + ' le groupe'" (click)="basculer.emit()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <ng-content select="[groupe-nom]" />
      <span class="grp-meta">{{ nombreTaches() }} tâche{{ nombreTaches() > 1 ? 's' : '' }} · {{ fJ(charge()) }} JH</span>
      <span class="grp-jauge" [title]="jauge().infoBulle">
        @if (jauge().terminee) { <span class="grp-jauge-ok" aria-label="Tout est validé">✓</span> }
        @else { <span class="grp-jauge-bar"><i [style.width.%]="jauge().pourcentage"></i></span> }
        <span>{{ jauge().valides }} / {{ jauge().total }} {{ jauge().mot }}</span>
      </span>
      <ng-content select="[groupe-actions]" />
    </div>
  `,
  styles: `
    :host { display: contents; }
    .grp-h { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
    .grp-fold { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 22px; padding: 0; margin-right: 2px; border: 0; background: transparent; color: inherit; cursor: pointer; }
    .grp-fold svg { width: 14px; height: 14px; transition: transform 120ms ease; }
    .grp-fold[aria-expanded="false"] svg { transform: rotate(-90deg); }
    .grp-meta { font-size: 11px; opacity: .78; white-space: nowrap; }
    .grp-jauge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--c-texte-2, #667085); white-space: nowrap; }
    .grp-jauge-bar { display: inline-block; width: 42px; height: 5px; border-radius: 5px; overflow: hidden; background: var(--c-neutre-fond, #e4e8f0); }
    .grp-jauge-bar i { display: block; height: 100%; background: var(--c-ok, #3fb97c); }
    .grp-jauge-ok { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 50%; color: #147d4b; background: #d9f5e5; font-weight: 700; }
  `,
})
export class EnteteGroupe {
  readonly classe = input('');
  readonly nom = input.required<string>();
  readonly nombreTaches = input.required<number>();
  readonly charge = input.required<number>();
  readonly jauge = input.required<JaugeGroupe>();
  readonly replie = input(false);
  readonly basculer = output<void>();
  protected readonly fJ = fJ;
}
