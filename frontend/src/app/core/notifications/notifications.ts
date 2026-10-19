import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { Icone } from '../../shared/ui/icone';

export interface Notification {
  id: number;
  ton: 'succes' | 'erreur' | 'info';
  message: string;
}

/** Messages courts affichés en bas d'écran (succès d'une action, erreur renvoyée par l'API…). */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private prochainId = 1;
  readonly liste = signal<Notification[]>([]);

  succes(message: string): void {
    this.ajouter('succes', message);
  }

  erreur(message: string): void {
    this.ajouter('erreur', message, 9000);
  }

  info(message: string): void {
    this.ajouter('info', message);
  }

  retirer(id: number): void {
    this.liste.update((l) => l.filter((n) => n.id !== id));
  }

  private ajouter(ton: Notification['ton'], message: string, duree = 6000): void {
    const id = this.prochainId++;
    this.liste.update((l) => [...l, { id, ton, message }]);
    setTimeout(() => this.retirer(id), duree);
  }
}

@Component({
  selector: 'app-notifications',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="zone" role="status" aria-live="polite">
      @for (n of service.liste(); track n.id) {
        <div class="notification" [class]="n.ton">
          <span>{{ n.message }}</span>
          <button type="button" class="btn discret" aria-label="Fermer le message" (click)="service.retirer(n.id)">
            <app-icone nom="fermer" [taille]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .zone {
      position: fixed;
      right: 24px;
      bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1000;
      max-width: min(440px, calc(100vw - 32px));
    }
    .notification {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 8px 10px 16px;
      border-radius: 10px;
      background: var(--c-texte);
      color: #fff;
      box-shadow: 0 8px 24px rgba(19, 32, 51, 0.25);
      font-size: 14px;
      line-height: 1.4;
    }
    .notification.erreur {
      background: var(--c-critique);
    }
    .notification.succes {
      background: var(--c-ok);
    }
    .btn {
      color: #fff;
      height: 32px;
      width: 32px;
      padding: 0;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }
  `,
})
export class Notifications {
  protected readonly service = inject(NotificationsService);
}
