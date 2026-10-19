import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MoiApi } from '../../api/projets.api';
import { Moi } from '../../api/modeles';

/** La personne connectée et ses droits globaux (chargés une fois au démarrage). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(MoiApi);

  readonly moi = signal<Moi | null>(null);
  readonly nomComplet = computed(() => {
    const m = this.moi();
    return m ? `${m.prenom} ${m.nom}`.trim() : '';
  });
  /** Libellé du rôle global, affiché sous le nom dans l'en-tête. */
  readonly libelleRole = computed(() => {
    const roles = this.moi()?.roles ?? [];
    if (roles.includes('Administrateur')) return 'Administrateur';
    if (roles.includes('Pilotage')) return 'Pilotage';
    if (roles.includes('ChefDeProjet')) return 'Chef de projet';
    return 'Consultant';
  });

  async charger(): Promise<void> {
    try {
      this.moi.set(await firstValueFrom(this.api.obtenir()));
    } catch {
      this.moi.set(null); // l'erreur est déjà signalée par l'intercepteur
    }
  }

  aLeRole(...roles: string[]): boolean {
    const mesRoles = this.moi()?.roles ?? [];
    return roles.some((r) => mesRoles.includes(r));
  }
}
