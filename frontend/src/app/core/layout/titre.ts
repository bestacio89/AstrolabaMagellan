import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Nom de l'application (Magellan) : utilisé dans l'onglet du navigateur et la barre latérale. */
export const NOM_APPLICATION = 'Astrolabe';
/** Ce que fait l'application, sous son nom. */
export const SOUS_TITRE_APPLICATION = 'Pilotage des forfaits';

/** Titre de l'onglet du navigateur : « Page · Astrolabe » (ou le nom seul quand la page n'a pas de titre). */
@Injectable({ providedIn: 'root' })
export class TitreApplication extends TitleStrategy {
  private readonly titre = inject(Title);

  override updateTitle(etat: RouterStateSnapshot): void {
    const page = this.buildTitle(etat);
    this.titre.setTitle(page ? `${page} · ${NOM_APPLICATION}` : `${NOM_APPLICATION} · ${SOUS_TITRE_APPLICATION}`);
  }
}
