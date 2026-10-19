import { ChangeDetectionStrategy, Component, inject, output, signal, viewChild } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { clePersonne, equipe } from '../etat/absences.logique';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';

/** Ajouter une personne qui n'est sur aucun profil (renfort, sous-traitant…) : elle apparaît dans le planning des absences. */
@Component({
  selector: 'app-fenetre-personne',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modale titre="Ajouter une personne" libelleValider="Ajouter" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
      <label class="field"
        >Nom et prénom<input class="in" name="nom" placeholder="Ex. : Camille Durand" autocomplete="off" [value]="nom()" #n (input)="nom.set(n.value)"
      /></label>
      <p class="note">
        Pour une personne qui n’est sur aucun profil du projet (renfort, sous-traitant…). Les collaborateurs nommés sur les profils sont déjà dans la liste.
      </p>
    </app-modale>
  `,
})
export class FenetrePersonne {
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly nom = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected async valider(): Promise<void> {
    const n = this.nom().trim();
    const v = this.etat.vue();
    if (!n) {
      this.erreur.set('Indiquez le nom.');
      this.modale()?.signalerChamp('nom');
      return;
    }
    if (v && equipe(v.P, v.projet.personnesAjoutees ?? []).some((p) => p.cle === clePersonne(n))) {
      this.erreur.set('Cette personne est déjà dans la liste.');
      this.modale()?.signalerChamp('nom');
      return;
    }
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.ajouterPersonne(id, n));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}
