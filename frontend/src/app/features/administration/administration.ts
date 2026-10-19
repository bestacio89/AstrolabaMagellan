import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EcranAVenir } from '../../shared/ui/ecran-a-venir';

/** Module « Administration » : écran à développer (voir la version de référence, POC v65). */
@Component({
  selector: 'app-administration',
  imports: [EcranAVenir],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-ecran-a-venir
      titre="Administration"
      description="Utilisateurs de l’application et habilitations sur les projets."
      [contenu]="contenu"
    />
  `,
})
export class Administration {
  protected readonly contenu = [
        'Utilisateurs (compte d’entreprise) et rôles',
        'Habilitations par projet : consultant, chef de projet, pilotage, lecteur',
  ];
}
