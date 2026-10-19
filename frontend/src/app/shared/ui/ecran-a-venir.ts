import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icone } from './icone';

let compteur = 0;

/**
 * Écran pas encore développé : indique ce qu'il contiendra, d'après la version de référence (POC v65).
 * Chaque module (features/…) a déjà sa route et sa page : il suffit de remplacer ce composant.
 */
@Component({
  selector: 'app-ecran-a-venir',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="carte bloc" [attr.aria-labelledby]="idTitre">
      <h2 [id]="idTitre">{{ titre() }}</h2>
      <p>{{ description() }}</p>
      @if (contenu().length) {
        <ul>
          @for (element of contenu(); track element) {
            <li><app-icone nom="coche" [taille]="16" />{{ element }}</li>
          }
        </ul>
      }
      <div class="encart">
        <app-icone nom="info" />
        <p>Écran prévu dans une prochaine version. Il reprendra le comportement de la version de référence.</p>
      </div>
    </section>
  `,
  styles: `
    .bloc {
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 820px;
    }
    h2 {
      font-size: 22px;
    }
    p {
      margin: 0;
      color: var(--c-texte-doux);
      line-height: 1.5;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      color: var(--c-texte-2);
    }
    li app-icone {
      color: var(--c-ok);
      margin-top: 1px;
    }
  `,
})
export class EcranAVenir {
  readonly titre = input.required<string>();
  readonly description = input('');
  readonly contenu = input<string[]>([]);
  protected readonly idTitre = `ecran-a-venir-${++compteur}`;
}
