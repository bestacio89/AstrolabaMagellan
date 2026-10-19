import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Noms des icônes disponibles (traits simples, couleur du texte). */
export type NomIcone =
  | 'plus'
  | 'importer'
  | 'chevron'
  | 'recherche'
  | 'cadenas'
  | 'info'
  | 'fermer'
  | 'fichier'
  | 'fichier-excel'
  | 'coche'
  | 'aide'
  | 'personne-ajout'
  | 'retour'
  | 'accueil'
  | 'menu'
  | 'tableau-de-bord'
  | 'liste'
  | 'gantt'
  | 'personnes'
  | 'bulle'
  | 'graphique'
  | 'facture'
  | 'panier'
  | 'recu'
  | 'fiche'
  | 'camembert'
  | 'profil'
  | 'calculette'
  | 'calendrier'
  | 'regle'
  | 'repartition'
  | 'reglages'
  | 'preferences'
  | 'exporter'
  | 'calques'
  | 'deconnexion'
  | 'portefeuille'
  | 'travail'
  | 'cloche'
  | 'lien'
  | 'imprimer'
  | 'drapeau'
  | 'tendance'
  | 'crayon'
  | 'copier'
  | 'poubelle'
  | 'presse-papiers'
  | 'haut'
  | 'bas'
  | 'fusee';

/**
 * Icône SVG intégrée. Décorative par défaut (masquée aux lecteurs d'écran) : le texte du bouton suffit.
 * Exemple : <app-icone nom="plus" />
 */
@Component({
  selector: 'app-icone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display: inline-flex' },
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="taille()"
      [attr.height]="taille()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="epaisseur()"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (nom()) {
        @case ('plus') {
          <path d="M12 5v14" /><path d="M5 12h14" />
        }
        @case ('importer') {
          <path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" />
        }
        @case ('preferences') {
          <path d="M4 6h9" /><path d="M17 6h3" /><circle cx="15" cy="6" r="2" /><path d="M4 12h3" /><path d="M11 12h9" /><circle cx="9" cy="12" r="2" /><path
            d="M4 18h11"
          /><path d="M19 18h1" /><circle cx="17" cy="18" r="2" />
        }
        @case ('chevron') {
          <path d="m9 6 6 6-6 6" />
        }
        @case ('retour') {
          <path d="m15 6-6 6 6 6" />
        }
        @case ('recherche') {
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        }
        @case ('cadenas') {
          <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
        }
        @case ('fermer') {
          <path d="M6 6l12 12" /><path d="M18 6 6 18" />
        }
        @case ('fichier') {
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path
            d="M9 17h6"
          />
        }
        @case ('fichier-excel') {
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m9 13 6 5" /><path
            d="m15 13-6 5"
          />
        }
        @case ('coche') {
          <path d="m5 12 5 5 9-10" />
        }
        @case ('aide') {
          <circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" /><path d="M12 17h.01" />
        }
        @case ('accueil') {
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        }
        @case ('menu') {
          <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
        }
        @case ('tableau-de-bord') {
          <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect
            x="3"
            y="16"
            width="7"
            height="5"
            rx="1.5"
          />
        }
        @case ('liste') {
          <path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="m3 6 1 1 2-2" /><path d="m3 12 1 1 2-2" /><path d="m3 18 1 1 2-2" />
        }
        @case ('gantt') {
          <path d="M4 6h8" /><path d="M8 12h10" /><path d="M6 18h7" />
        }
        @case ('personnes') {
          <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15 14.5c3 0 6 2 6 5.5" />
        }
        @case ('bulle') {
          <path d="M4 4h16v12H8l-4 4z" />
        }
        @case ('graphique') {
          <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />
        }
        @case ('facture') {
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6" /><path d="M9 12h6" />
        }
        @case ('panier') {
          <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h12L22 7H6" />
        }
        @case ('recu') {
          <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" />
        }
        @case ('fiche') {
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" />
        }
        @case ('camembert') {
          <path d="M21 12a9 9 0 1 1-9-9v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
        }
        @case ('profil') {
          <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M5.5 17c.6-1.8 2-3 3.5-3s2.9 1.2 3.5 3" /><path d="M15 10h3" /><path
            d="M15 14h3"
          />
        }
        @case ('calculette') {
          <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8" /><path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" /><path
            d="M8 16h.01"
          /><path d="M12 16h.01" /><path d="M16 16h.01" />
        }
        @case ('calendrier') {
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
        }
        @case ('regle') {
          <path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2" /><path d="m10 10 2 2" /><path d="m13 7 2 2" />
        }
        @case ('repartition') {
          <path d="M12 3v6" /><path d="M12 9 5 15v6" /><path d="m12 9 7 6v6" />
        }
        @case ('reglages') {
          <circle cx="12" cy="12" r="3" /><path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        }
        @case ('exporter') {
          <path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" />
        }
        @case ('calques') {
          <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" />
        }
        @case ('deconnexion') {
          <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="m10 17-5-5 5-5" /><path d="M5 12h11" />
        }
        @case ('portefeuille') {
          <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M3 13h18" />
        }
        @case ('travail') {
          <rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" />
        }
        @case ('cloche') {
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" />
        }
        @case ('lien') {
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
        }
        @case ('imprimer') {
          <path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" />
        }
        @case ('drapeau') {
          <path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" />
        }
        @case ('tendance') {
          <path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" />
        }
        @case ('crayon') {
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        }
        @case ('copier') {
          <rect x="8" y="8" width="13" height="13" rx="2" /><path d="M4 16V5a2 2 0 0 1 2-2h11" />
        }
        @case ('poubelle') {
          <path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" />
        }
        @case ('presse-papiers') {
          <rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
        }
        @case ('haut') {
          <path d="m6 15 6-6 6 6" />
        }
        @case ('bas') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('fusee') {
          <path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2" /><path d="M9 18 6 15c1-5 5-11 13-12-1 8-7 12-12 13Z" /><circle cx="14.5" cy="9.5" r="1.5" />
        }
        @case ('personne-ajout') {
          <circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M17 11h5" /><path d="M19.5 8.5v5" />
        }
      }
    </svg>
  `,
})
export class Icone {
  readonly nom = input.required<NomIcone>();
  readonly taille = input(18);
  readonly epaisseur = input(2);
}
