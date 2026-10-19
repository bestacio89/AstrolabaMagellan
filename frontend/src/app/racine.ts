import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarreLaterale } from './core/layout/barre-laterale';
import { Notifications } from './core/notifications/notifications';

/** Composant racine : la barre latérale, la page affichée selon l'adresse, et les messages. */
@Component({
  selector: 'app-racine',
  imports: [RouterOutlet, BarreLaterale, Notifications],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="application">
      <app-barre-laterale />
      <div class="contenu">
        <router-outlet />
      </div>
    </div>
    <app-notifications />
  `,
  styles: `
    .application {
      display: flex;
      min-height: 100vh;
    }
    .contenu {
      flex: 1;
      min-width: 0;
    }
    @media (max-width: 900px) {
      .application {
        flex-direction: column;
      }
    }
  `,
})
export class Racine {}
