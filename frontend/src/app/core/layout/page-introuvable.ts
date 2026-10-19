import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-introuvable',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <h1>Page introuvable</h1>
      <p>L'adresse demandée n'existe pas, ou vous n'y avez pas accès.</p>
      <p><a routerLink="/projets">Revenir à mes projets</a></p>
    </main>
  `,
})
export class PageIntrouvable {}
