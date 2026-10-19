import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SuiviEtat } from '../etat/suivi.etat';
import { FenetreAjoutProfil } from './ajout-profil';
import { FenetreAnnulation } from './annulation';
import { FenetreBilanIa } from './bilan-ia';
import { FenetreImportFrais, FenetreNouveauFrais, FenetreNouvelAchat } from './depenses';
import { FenetreExportCoproj, FenetreReperes } from './export-reperes';
import { FenetreLienEcheance } from './lien-echeance';
import { FenetreNouvelleTache } from './nouvelle-tache';
import { FenetreReaffectation } from './reaffectation';

/** Affiche la fenêtre demandée par un écran, le panneau de détail ou un message (une seule à la fois). */
@Component({
  selector: 'app-fenetres',
  imports: [
    FenetreAjoutProfil,
    FenetreAnnulation,
    FenetreBilanIa,
    FenetreNouvelAchat,
    FenetreNouveauFrais,
    FenetreImportFrais,
    FenetreExportCoproj,
    FenetreReperes,
    FenetreLienEcheance,
    FenetreNouvelleTache,
    FenetreReaffectation,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.fenetre(); as f) {
      @if (f.type === 'nouvelle-tache') {
        <app-fenetre-nouvelle-tache [groupe]="f.groupe" (fermer)="fermer()" />
      } @else if (f.type === 'ajout-profil') {
        <app-fenetre-ajout-profil [uid]="f.uid" (fermer)="fermer()" />
      } @else if (f.type === 'reaffectation') {
        <app-fenetre-reaffectation [uid]="f.uid" [de]="f.de" (fermer)="fermer()" />
      } @else if (f.type === 'annulation') {
        <app-fenetre-annulation [uid]="f.uid" (fermer)="fermer()" />
      } @else if (f.type === 'bilan-ia') {
        <app-fenetre-bilan-ia [uid]="f.uid" (fermer)="fermer()" />
      } @else if (f.type === 'nouvel-achat') {
        <app-fenetre-nouvel-achat (fermer)="fermer()" />
      } @else if (f.type === 'nouveau-frais') {
        <app-fenetre-nouveau-frais [reprise]="f.reprise" (fermer)="fermer()" />
      } @else if (f.type === 'import-frais') {
        <app-fenetre-import-frais (fermer)="fermer()" />
      } @else if (f.type === 'lien-echeance') {
        <app-fenetre-lien-echeance [numero]="f.numero" (fermer)="fermer()" />
      } @else if (f.type === 'export-coproj') {
        <app-fenetre-export-coproj (fermer)="fermer()" />
      } @else if (f.type === 'reperes') {
        <app-fenetre-reperes (fermer)="fermer()" />
      }
    }
  `,
})
export class Fenetres {
  protected readonly etat = inject(SuiviEtat);

  protected fermer(): void {
    this.etat.fenetre.set(null);
  }
}
