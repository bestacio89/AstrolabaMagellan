import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { JalonSaisi, SuiviApi } from '../api/suivi.api';
import { quandLong } from '../etat/planning.logique';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';

/**
 * Nouveau jalon / Modifier le jalon (Planning › Vue d'ensemble) : libellé, une date, une période ou une semaine,
 * « à confirmer » (losange vide, sans numéro). Un jalon existant peut être supprimé (après confirmation).
 */
@Component({
  selector: 'app-fenetre-jalon',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modale
      [titre]="j() ? 'Modifier le jalon' : 'Nouveau jalon'"
      [libelleValider]="j() ? 'Enregistrer' : 'Ajouter le jalon'"
      [erreur]="erreur()"
      [occupe]="occupe()"
      (fermer)="fermer.emit()"
      (valider)="valider()"
    >
      <label class="field"
        >Libellé
        <input class="in" name="libelle" maxlength="200" placeholder="Ex. COPIL de lancement" [value]="libelle()" #li (input)="libelle.set(li.value)" />
      </label>
      <div class="field">
        Quand
        <div class="seg sm" role="radiogroup" aria-label="Type de date">
          @for (x of types; track x[0]) {
            <label class="pl-radio"><input type="radio" name="type" [value]="x[0]" [checked]="type() === x[0]" (change)="type.set(x[0])" /> {{ x[1] }}</label>
          }
        </div>
      </div>
      <div class="fgrid">
        <label class="field"
          >{{ type() === 'periode' ? 'Du' : type() === 'semaine' ? 'Un jour de la semaine' : 'Date' }}
          <input class="in" type="date" name="debut" [value]="debut()" #de (change)="debut.set(de.value)" />
        </label>
        @if (type() === 'periode') {
          <label class="field"
            >Jusqu’au
            <input class="in" type="date" name="fin" [value]="fin()" #fi (change)="fin.set(fi.value)" />
          </label>
        }
      </div>
      <label class="pl-case"
        ><input type="checkbox" name="aConfirmer" [checked]="aConfirmer()" #ac (change)="aConfirmer.set(ac.checked)" /> À confirmer
        <span class="muted">(losange vide, sans numéro)</span></label
      >
      @if (j()) {
        <div><button type="button" class="btn sm danger-ghost" (click)="supprimer()">Supprimer ce jalon</button></div>
      }
    </app-modale>
  `,
})
export class FenetreJalon implements OnInit {
  /** Jalon à modifier (null : nouveau jalon). */
  readonly id = input<string | null>(null);
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);

  protected readonly types: [JalonSaisi['type'], string][] = [
    ['date', 'Une date'],
    ['periode', 'Une période'],
    ['semaine', 'Une semaine'],
  ];
  protected readonly j = computed(() => this.etat.vue()?.projet.planning?.jalons.find((x) => x.id === this.id()) ?? null);
  protected readonly libelle = signal('');
  protected readonly type = signal<JalonSaisi['type']>('date');
  protected readonly debut = signal('');
  protected readonly fin = signal('');
  protected readonly aConfirmer = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  ngOnInit(): void {
    const j = this.j();
    if (!j) return;
    this.libelle.set(j.libelle);
    this.type.set(j.type);
    this.debut.set(j.debut ?? '');
    this.fin.set(j.fin ?? '');
    this.aConfirmer.set(!!j.aConfirmer);
  }

  /** Contrôles de la version HTML (le serveur refait les mêmes). */
  private controle(): [string, string] | null {
    if (!this.libelle().trim()) return ['Indiquez le libellé du jalon.', 'libelle'];
    if (!this.debut()) return ['Indiquez la date du jalon.', 'debut'];
    if (this.type() === 'periode' && !this.fin()) return ['Indiquez la fin de la période.', 'fin'];
    if (this.type() === 'periode' && this.fin() < this.debut()) return ['La fin de la période ne peut pas précéder son début.', 'fin'];
    return null;
  }

  protected async valider(): Promise<void> {
    const ko = this.controle();
    if (ko) {
      this.erreur.set(ko[0]);
      this.modale()?.signalerChamp(ko[1]);
      return;
    }
    const corps: JalonSaisi = {
      libelle: this.libelle().trim(),
      type: this.type(),
      debut: this.debut(),
      fin: this.type() === 'periode' ? this.fin() : null,
      aConfirmer: this.aConfirmer(),
    };
    const j = this.j();
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => (j ? this.api.modifierJalon(id, j.id, { ...corps, version: j.version }) : this.api.ajouterJalon(id, corps)));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }

  protected async supprimer(): Promise<void> {
    const j = this.j();
    if (!j) return;
    const ok = await this.etat.confirmer('Supprimer le jalon ?', [`« ${j.libelle} » (${quandLong(j)}) sera retiré du planning.`], 'Supprimer');
    if (!ok) return;
    const r = await this.etat.saisir((id) => this.api.supprimerJalon(id, j.id));
    if (r) this.fermer.emit();
  }
}
