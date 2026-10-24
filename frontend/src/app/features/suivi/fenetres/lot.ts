import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';

/** Renommer un lot sans changer son code TSP ni les rattachements des tâches. */
@Component({
  selector: 'app-fenetre-lot',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      <app-modale titre="Nom du lot" libelleValider="Enregistrer" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <label class="field">
          Nom du lot
          <input class="in" name="nomLot" maxlength="200" autocomplete="off" [value]="nom()" #n (input)="nom.set(n.value)" (keydown.enter)="valider()" />
        </label>
        <p class="note">
          Code du TSP (colonne B) : <strong>{{ code() }}</strong> ·
          {{ nombreTaches() }} tâche(s).
          Le code ne change pas : seul le nom affiché change.
        </p>
      </app-modale>
    }
  `,
})
export class FenetreLot implements OnInit {
  readonly code = input.required<string>();
  readonly fermer = output<void>();
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly nom = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);
  protected readonly nombreTaches = computed(() => {
    const code = this.code();
    return this.etat.vue()?.projet.tasks.filter((t) => t.lot === code).length ?? 0;
  });

  ngOnInit(): void {
    this.nom.set(this.etat.vue()?.projet.lots?.[this.code()] ?? '');
  }

  protected async valider(): Promise<void> {
    const v = this.etat.vue();
    const code = this.code();
    const nom = this.nom().trim();
    if (!v) return;
    if (nom.length > 200) {
      this.erreur.set('Le nom ne peut pas dépasser 200 caractères.');
      this.modale()?.signalerChamp('nomLot');
      return;
    }
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.nomLot(id, code, nom));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}
