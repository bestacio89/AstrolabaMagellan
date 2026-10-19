import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/**
 * Liste de libellés modifiable (leviers IA, causes de dépassement…) : chaque élément se renomme ou se retire,
 * et un champ en bas en ajoute un (Entrée ou « Ajouter »). Les doublons sont refusés (sans tenir compte des majuscules).
 * La liste ne se vide pas : « Rétablir la liste par défaut » renvoie une liste vide, que le serveur remplace par celle par défaut.
 */
@Component({
  selector: 'app-liste-editable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="le-liste" [attr.aria-label]="libelle()">
      @for (v of valeurs(); track $index + v) {
        <li>
          <input class="in" [value]="v" [disabled]="lecture()" [attr.aria-label]="libelle() + ' : ' + v" #el (change)="renommer($index, el)" />
          @if (!lecture()) {
            <button
              type="button"
              class="le-x"
              [disabled]="valeurs().length === 1"
              [title]="valeurs().length === 1 ? 'Gardez au moins un élément (ou rétablissez la liste par défaut)' : 'Retirer « ' + v + ' »'"
              [attr.aria-label]="'Retirer ' + v"
              (click)="retirer($index)"
            >
              ×
            </button>
          }
        </li>
      }
    </ul>
    @if (!lecture()) {
      <div class="le-ajout">
        <input class="in" [placeholder]="placeholder()" [attr.aria-label]="'Ajouter : ' + libelle()" #nouveau (keydown.enter)="$event.preventDefault(); ajouter(nouveau)" (input)="erreur.set('')" />
        <button type="button" class="btn sm" (click)="ajouter(nouveau)">+ Ajouter</button>
      </div>
      @if (erreur()) {
        <p class="le-erreur" role="alert">{{ erreur() }}</p>
      }
      <button type="button" class="le-defaut" (click)="changer.emit([])">Rétablir la liste par défaut</button>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .le-liste {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .le-liste li {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .le-liste .in,
    .le-ajout .in {
      flex: 1;
      min-width: 0;
    }
    .le-x {
      width: 28px;
      height: 28px;
      flex: none;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }
    .le-x:hover:not(:disabled) {
      background: var(--crit-soft);
      color: var(--crit);
    }
    .le-x:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .le-ajout {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      padding-right: 32px;
    }
    .le-erreur {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--crit);
    }
    .le-defaut {
      margin-top: 6px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 12px;
      color: var(--muted);
      text-decoration: underline;
      cursor: pointer;
    }
    .le-defaut:hover {
      color: var(--accent);
    }
  `,
})
export class ListeEditable {
  readonly valeurs = input.required<readonly string[]>();
  readonly lecture = input(false);
  /** Nom de la liste, pour les lecteurs d'écran (ex. « Leviers d'optimisation »). */
  readonly libelle = input.required<string>();
  readonly placeholder = input('Nouvel élément');
  /** Nouvelle liste complète, à enregistrer. */
  readonly changer = output<string[]>();
  protected readonly erreur = signal('');

  protected ajouter(champ: HTMLInputElement): void {
    const texte = champ.value.trim();
    if (!texte) {
      champ.focus();
      return;
    }
    if (this.existe(texte)) {
      this.erreur.set(`« ${texte} » est déjà dans la liste.`);
      return;
    }
    this.changer.emit([...this.valeurs(), texte]);
    champ.value = '';
    champ.focus();
  }

  protected renommer(index: number, champ: HTMLInputElement): void {
    const texte = champ.value.trim();
    const avant = this.valeurs()[index];
    if (texte === avant) return;
    // vide : on retire l'élément (sauf s'il est le dernier) ; doublon : on revient à l'ancien libellé
    if (!texte) {
      if (this.valeurs().length > 1) this.retirer(index);
      else champ.value = avant;
      return;
    }
    if (this.existe(texte, index)) {
      this.erreur.set(`« ${texte} » est déjà dans la liste.`);
      champ.value = avant;
      return;
    }
    this.changer.emit(this.valeurs().map((v, i) => (i === index ? texte : v)));
  }

  protected retirer(index: number): void {
    if (this.valeurs().length <= 1) return;
    this.changer.emit(this.valeurs().filter((_, i) => i !== index));
  }

  private existe(texte: string, sauf = -1): boolean {
    const t = texte.toLocaleLowerCase('fr');
    return this.valeurs().some((v, i) => i !== sauf && v.toLocaleLowerCase('fr') === t);
  }
}
