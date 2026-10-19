import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PointDeProjet, tonDuNiveau } from '../../etat/accueil.logique';

/** Bloc « À traiter sur vos projets » : les points qui demandent une action, tous projets confondus. */
@Component({
  selector: 'app-a-traiter',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="carte" aria-labelledby="titre-a-traiter">
      <div class="titre">
        <h2 id="titre-a-traiter">
          À traiter <span class="compteur-rond num">{{ total() }}</span>
        </h2>
        <span class="discret">Les points de vigilance de chaque projet, les plus urgents d'abord</span>
      </div>
      @for (p of points(); track $index) {
        <div class="point">
          <span class="pastille categorie" [class]="'pastille categorie ' + ton(p)">{{ p.categorie.libelle }}</span>
          <span class="texte">
            <b>{{ p.point.libelle }}</b>
            <span class="discret">
              · {{ p.projet }}
              @if (p.point.detail) {
                · {{ p.point.detail }}
              }
            </span>
          </span>
          <a [routerLink]="p.categorie.ecran ? ['/projets', p.projetId, p.categorie.ecran] : ['/projets', p.projetId]">{{ p.categorie.lien }} →</a>
        </div>
      } @empty {
        <p class="rien">Rien à traiter pour le moment.</p>
      }
    </section>
  `,
  styles: `
    .carte {
      padding: 20px 24px 10px;
    }
    .titre {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
      font: 500 18px/24px var(--police-titre);
    }
    .discret {
      font-size: 13px;
      color: var(--c-texte-discret);
    }
    .point {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      padding: 12px 8px;
      margin: 0 -8px;
      border-radius: 8px;
      transition: background var(--transition);
    }
    .point:hover {
      background: var(--c-surface-survol);
    }
    .categorie {
      width: 100%;
    }
    .texte {
      font-size: 14px;
      min-width: 0;
    }
    .texte b {
      font-weight: 600;
    }
    a {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      text-decoration: none;
    }
    .rien {
      margin: 0;
      padding: 8px 0 14px;
      color: var(--c-texte-discret);
    }
    @media (max-width: 720px) {
      .point {
        grid-template-columns: 1fr;
        gap: 6px;
      }
      .categorie {
        width: auto;
        justify-self: start;
      }
    }
  `,
})
export class ATraiter {
  readonly points = input.required<PointDeProjet[]>();
  readonly total = input.required<number>();

  protected ton(p: PointDeProjet) {
    return tonDuNiveau(p.point.niveau);
  }
}
