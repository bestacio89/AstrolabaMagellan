import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { ProjetsApi } from '../../api/projets.api';
import { ProjetResume } from '../../api/modeles';
import { couleurProjet, initiales } from '../../shared/format/formats';
import { Fenetre } from '../../shared/ui/fenetre';
import { Icone } from '../../shared/ui/icone';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../session/session.service';
import { NavigationService, ProjetNavigation } from './navigation';
import { PreferencesService } from './preferences';
import { NOM_APPLICATION, SOUS_TITRE_APPLICATION } from './titre';

/** Nombre de projets listés dans la barre latérale (les autres sont sur l'accueil). */
const PROJETS_LISTES = 8;

/**
 * Barre latérale de toute l'application : accueil, rubriques du projet ouvert, accès rapide aux projets,
 * repères et personne connectée. Sur un petit écran, elle se replie derrière un bouton « Menu ».
 * Sur un grand écran, le bouton « ‹ » la réduit à une fine bande (préférence du navigateur) ; la flèche « › » la rouvre.
 */
@Component({
  selector: 'app-barre-laterale',
  imports: [RouterLink, Icone, Fenetre],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ouverte]': 'menuOuvert()', '[class.repliee]': 'prefs.preferences().barreRepliee' },
  template: `
    <div class="tete">
      <a routerLink="/projets" class="marque" [attr.aria-label]="nomApplication + ' — accueil'">
        <img class="logo" src="magellan-marque.png" alt="" width="46" height="24" />
        <span class="nom">{{ nomApplication }}<small>{{ sousTitre }}</small></span>
      </a>
      <button
        type="button"
        class="replier"
        aria-controls="navigation-principale"
        aria-label="Réduire le panneau de gauche"
        title="Réduire le panneau (plus de place pour les tableaux)"
        (click)="replier(true)"
      >
        <app-icone nom="retour" [taille]="18" />
      </button>
      <button
        type="button"
        class="menu"
        [attr.aria-expanded]="menuOuvert()"
        aria-controls="navigation-principale"
        aria-label="Menu"
        (click)="menuOuvert.set(!menuOuvert())"
      >
        <app-icone [nom]="menuOuvert() ? 'fermer' : 'menu'" [taille]="20" />
      </button>
    </div>

    <button type="button" class="deplier" aria-label="Afficher le panneau de gauche" title="Afficher le panneau de gauche" (click)="replier(false)">
      <span class="disque"><app-icone nom="chevron" [taille]="16" /></span>
    </button>

    <nav id="navigation-principale" class="corps" aria-label="Navigation principale">
      <div class="general">
      <a routerLink="/projets" class="lien" [class.actif]="surAccueil()" [attr.aria-current]="surAccueil() ? 'page' : null">
        <app-icone nom="accueil" [taille]="18" [epaisseur]="1.75" />Accueil
      </a>
      @if (prefs.preferences().monTravail) {
      <a routerLink="/mon-travail" class="lien" [class.actif]="surPage('/mon-travail')" [attr.aria-current]="surPage('/mon-travail') ? 'page' : null">
        <app-icone nom="travail" [taille]="18" [epaisseur]="1.75" /><span class="libelle">Mon travail</span>
        @if (nav.aMonTravail(); as n) {
          <span class="badge" [class.retard]="nav.aMonTravailRetard()" [title]="n + ' élément(s) à traiter'">{{ n }}</span>
        }
      </a>
      }
      @if (prefs.preferences().portefeuille) {
      <a routerLink="/portefeuille" class="lien" [class.actif]="surPage('/portefeuille')" [attr.aria-current]="surPage('/portefeuille') ? 'page' : null">
        <app-icone nom="portefeuille" [taille]="18" [epaisseur]="1.75" /><span class="libelle">Portefeuille</span>
      </a>
      }
      </div>

      @if (nav.projetOuvert(); as p) {
        <div class="projet" [class.brouillon]="!!p.etiquette">
          <span class="etiquette">{{ p.etiquette ?? 'Projet ouvert' }}</span>
          <div class="projet-nom" [title]="p.nom"><span class="puce" [style.background]="p.etiquette ? 'var(--c-violet)' : couleur(p.id)"></span><span>{{ p.nom }}</span></div>
          @for (g of p.groupes; track g.libelle) {
            @let actifDedans = g.liens.some((x) => x.actif);
            @let ouvert = !g.repliable || actifDedans || prefs.preferences().tspOuvert;
            <div class="groupe-bloc" role="group" [attr.aria-label]="g.libelle || null">
              @if (g.repliable) {
                <button
                  type="button"
                  class="etiquette pliable"
                  [attr.aria-expanded]="ouvert"
                  [title]="actifDedans ? 'Ouvert : vous êtes sur une page de ce groupe' : ouvert ? 'Replier' : 'Déplier'"
                  (click)="!actifDedans && prefs.changer({ tspOuvert: !ouvert })"
                >
                  <span>{{ g.libelle }}</span><app-icone class="chevron-g" nom="chevron" [taille]="14" [epaisseur]="2" />
                </button>
              } @else if (g.libelle) {
                <span class="etiquette">{{ g.libelle }}</span>
              }
              @for (l of ouvert ? g.liens : []; track l.chemin) {
                @if (l.intertitre) {
                  <span class="intertitre">{{ l.intertitre }}</span>
                }
                <a class="lien" [routerLink]="lienRubrique(p, l.chemin)" [class.actif]="l.actif" [attr.aria-current]="l.actif ? 'page' : null">
                  @if (l.etat) {
                    <span class="etat-r" [attr.data-etat]="l.etat" [title]="libelleEtat[l.etat]"></span>
                    <span class="visuellement-cache">{{ libelleEtat[l.etat] }} :</span>
                  } @else {
                    <app-icone [nom]="l.icone" [taille]="18" [epaisseur]="1.75" />
                  }
                  <span class="libelle">{{ l.libelle }}</span>
                  @if (l.note) {
                    <small class="note-r">{{ l.note }}</small>
                  }
                  @if (l.badge) {
                    <span class="badge" [class.retard]="l.retard" [title]="l.badge + ' point(s) à traiter' + (l.retard ? ', dont en retard' : '')">{{ l.badge }}</span>
                  }
                </a>
              }
            </div>
          }
        </div>
      }

      @if (projetsListes().length) {
        <div class="section">
          <span class="etiquette">{{ nav.projetOuvert() ? 'Autres projets' : 'Projets' }}</span>
          @for (pr of projetsListes(); track pr.id) {
            <a class="lien" [routerLink]="['/projets', pr.id]" [title]="nomProjet(pr)">
              <span class="puce" [style.background]="couleur(pr.id)"></span><span class="libelle">{{ nomProjet(pr) }}</span>
            </a>
          }
          @if (projetsEnPlus() > 0) {
            <a class="lien discret" routerLink="/projets">Voir les {{ projetsEnPlus() }} autres</a>
          }
        </div>
      }
    </nav>

    <div class="pied">
      <button type="button" class="lien" (click)="ouvrirReperes()"><app-icone nom="aide" [taille]="18" [epaisseur]="1.75" />Lexique</button>
      <button type="button" class="lien" (click)="parametresOuverts.set(true); menuOuvert.set(false)">
        <app-icone nom="preferences" [taille]="18" [epaisseur]="1.75" />Préférences
      </button>
      @if (auth.modeDev) {
        <label class="dev" title="Mode développement : changer d'utilisateur fictif">
          <span>Test</span>
          <select (change)="changerUtilisateur($event)">
            @for (u of utilisateursDev; track u.cle) {
              <option [value]="u.cle" [selected]="u.cle === auth.utilisateurDev()">{{ u.libelle }}</option>
            }
          </select>
        </label>
      }
      @if (session.moi(); as moi) {
        <div class="compte">
          <span class="avatar" aria-hidden="true">{{ initialesDe(moi.prenom, moi.nom) }}</span>
          <span class="identite">
            <b>{{ session.nomComplet() }}</b>
            <span>{{ session.libelleRole() }}</span>
          </span>
        </div>
      }
    </div>

    <app-fenetre titre="Préférences" [ouverte]="parametresOuverts()" (fermee)="parametresOuverts.set(false)">
      <p class="param-intro">Menus affichés dans la barre latérale. Réglage propre à ce navigateur : il ne change rien pour vos collègues.</p>
      <label class="param">
        <input type="checkbox" [checked]="prefs.preferences().monTravail" #mt (change)="prefs.changer({ monTravail: mt.checked })" />
        <span><b>Mon travail</b><small>Ce qui vous est confié sur tous vos projets, votre saisie de la semaine, vos notifications.</small></span>
      </label>
      <label class="param">
        <input type="checkbox" [checked]="prefs.preferences().portefeuille" #pf (change)="prefs.changer({ portefeuille: pf.checked })" />
        <span><b>Portefeuille</b><small>Tous les projets actifs sur une page, pour le point du lundi.</small></span>
      </label>
      <p class="param-intro">Les réglages d’un projet (axes, dates, alertes, archivage…) sont dans ce projet, rubrique ⚙ Paramètres du projet.</p>
      <div pied><button type="button" class="btn primaire" (click)="parametresOuverts.set(false)">Fermer</button></div>
    </app-fenetre>

    <app-fenetre titre="Lexique" [ouverte]="reperesOuverts()" (fermee)="reperesOuverts.set(false)">
      <dl class="reperes">
        <dt>Vendu</dt>
        <dd>La charge du TSP, figée à l'import.</dd>
        <dt>Prévu</dt>
        <dd>Vendu + charges ajoutées − parties annulées.</dd>
        <dt>Consommé</dt>
        <dd>Le temps passé, saisi jour par jour (1 jour-homme maximum par personne et par jour, sauf achats et cessions).</dd>
        <dt>Reste à faire</dt>
        <dd>Calculé profil par profil (prévu − consommé), ou saisi par le chef de projet. Nul une fois la tâche validée.</dd>
        <dt>Atterrissage</dt>
        <dd>Consommé + reste à faire : la charge totale attendue à la fin.</dd>
        <dt>Écart</dt>
        <dd>Atterrissage − prévu. Positif : dépassement ; négatif : économie.</dd>
        <dt>Enveloppe IA</dt>
        <dd>Charge « Agent IA » adossée aux profils humains. IA consommée = consommé total − charge des autres profils.</dd>
      </dl>
      <div pied><button type="button" class="btn" (click)="reperesOuverts.set(false)">Fermer</button></div>
    </app-fenetre>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      height: 100vh;
      width: var(--largeur-barre-laterale);
      flex: none;
      display: flex;
      flex-direction: column;
      background: var(--c-surface);
      border-right: 1px solid var(--c-bordure);
      z-index: 30;
    }
    .tete {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 var(--esp-3) 0 var(--esp-5);
      border-bottom: 1px solid var(--c-separateur);
      flex: none;
    }
    .marque {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--c-texte);
    }
    /* marque Magellan : image fournie par l'agence (fond transparent), jamais déformée */
    .logo {
      width: 46px;
      height: 24px;
      object-fit: contain;
      flex: none;
    }
    .nom {
      display: flex;
      flex-direction: column;
      font: 600 16px/19px var(--police-titre);
    }
    .nom small {
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .menu {
      display: none;
      border: 0;
      background: transparent;
      width: 40px;
      height: 40px;
      border-radius: var(--rayon);
      color: var(--c-texte);
      cursor: pointer;
      align-items: center;
      justify-content: center;
    }
    .menu:hover,
    .replier:hover {
      background: var(--c-survol);
    }
    .replier {
      border: 0;
      background: transparent;
      width: 32px;
      height: 32px;
      border-radius: var(--rayon);
      color: var(--c-texte-discret);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
    }
    .replier:hover {
      color: var(--c-texte);
    }
    .deplier {
      display: none;
    }

    /* grand écran, panneau réduit : une fine bande ; la flèche, à cheval sur le bord, le rouvre (toute la bande est cliquable) */
    @media (min-width: 901px) {
      :host {
        transition: width var(--transition);
      }
      :host(.repliee) {
        width: 20px;
      }
      :host(.repliee) .tete,
      :host(.repliee) .corps,
      :host(.repliee) .pied {
        display: none;
      }
      :host(.repliee) .deplier {
        display: block;
        position: absolute;
        inset: 0;
        width: 100%;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
      }
      :host(.repliee) .deplier:hover {
        background: var(--c-survol);
      }
      .disque {
        position: absolute;
        top: 20px;
        right: -12px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--c-surface);
        border: 1px solid var(--c-bordure);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
        color: var(--c-texte);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      :host(.repliee) .deplier:hover .disque,
      :host(.repliee) .deplier:focus-visible .disque {
        background: var(--c-primaire);
        border-color: var(--c-primaire);
        color: #fff;
      }
    }
    .corps {
      flex: 1;
      overflow-y: auto;
      padding: var(--esp-3) var(--esp-3) var(--esp-4);
      display: flex;
      flex-direction: column;
      gap: var(--esp-4);
    }
    .general {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .lien {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 34px;
      padding: 0 var(--esp-3);
      border: 0;
      border-radius: var(--rayon);
      background: transparent;
      color: var(--c-texte);
      font: 400 14px/20px var(--police-texte);
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: background var(--transition);
    }
    .lien app-icone {
      color: var(--c-texte-doux);
    }
    .lien:hover {
      background: var(--c-survol);
      color: var(--c-texte);
    }
    .lien.actif {
      background: var(--c-primaire-clair);
      color: var(--c-texte);
      font-weight: 500;
    }
    .lien.actif app-icone {
      color: var(--c-primaire-fonce);
    }
    .lien.discret {
      color: var(--c-texte-discret);
      font-size: 13px;
    }
    .libelle {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* petites capitales espacées : repère net des groupes, sans alourdir */
    .etiquette {
      display: block;
      padding: 0 var(--esp-3) 6px;
      font: 600 11px/16px var(--police-texte);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--c-texte-discret);
    }
    /* groupe repliable (le TSP vendu) : le titre est un bouton, chevron à droite */
    .etiquette.pliable {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      border: 0;
      background: transparent;
      padding-top: 4px;
      padding-bottom: 4px;
      margin-bottom: 2px;
      border-radius: var(--rayon);
      cursor: pointer;
      text-align: left;
    }
    .etiquette.pliable:hover {
      background: var(--c-survol);
      color: var(--c-texte);
    }
    .chevron-g {
      transition: transform var(--transition);
    }
    .etiquette.pliable[aria-expanded='true'] .chevron-g {
      transform: rotate(90deg);
    }
    .intertitre {
      display: block;
      padding: var(--esp-2) var(--esp-3) 4px 40px;
      font: 500 11px/16px var(--police-texte);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--c-texte-discret);
    }
    .projet {
      display: flex;
      flex-direction: column;
      padding-top: var(--esp-4);
      border-top: 1px solid var(--c-separateur);
    }
    .projet-nom {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 0 var(--esp-3) var(--esp-2);
      font: 500 14px/20px var(--police-titre);
    }
    .projet-nom .puce {
      margin-top: 5px;
    }
    .groupe-bloc {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-top: var(--esp-2);
      padding-top: var(--esp-3);
      border-top: 1px solid var(--c-separateur);
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: var(--esp-4);
      border-top: 1px solid var(--c-separateur);
    }
    .puce {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex: none;
    }
    .badge {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--c-neutre-fond);
      color: var(--c-texte);
      font: 500 12px/1 var(--police-texte);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .badge.retard {
      background: var(--c-statut-bloque);
      color: #fff;
    }
    /* brouillon : état de chaque rubrique (complète, à vérifier, à corriger, vide) */
    .projet.brouillon .projet-nom {
      color: var(--c-violet);
    }
    .etat-r {
      width: 16px;
      height: 16px;
      margin: 0 1px;
      border-radius: 50%;
      flex: none;
      position: relative;
      box-sizing: border-box;
    }
    .etat-r[data-etat='ok'] {
      background: var(--c-statut-valide);
    }
    .etat-r[data-etat='ok']::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      width: 4px;
      height: 8px;
      border: solid #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    .etat-r[data-etat='conseil'] {
      background: var(--c-statut-encours);
    }
    .etat-r[data-etat='bloquant'] {
      background: var(--c-statut-bloque);
    }
    .etat-r[data-etat='bloquant']::after {
      content: '!';
      position: absolute;
      inset: 0;
      color: #fff;
      font: 700 11px/16px var(--police-texte);
      text-align: center;
    }
    .etat-r[data-etat='vide'] {
      border: 2px solid var(--c-bordure-champ);
    }
    .note-r {
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
      white-space: nowrap;
    }
    .pied {
      border-top: 1px solid var(--c-separateur);
      padding: var(--esp-3);
      display: flex;
      flex-direction: column;
      gap: var(--esp-2);
      flex: none;
    }
    .dev {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      padding: var(--esp-2) var(--esp-3);
      border-radius: var(--rayon);
      background: var(--c-attention-fond);
      color: var(--c-attention);
      font: 500 12px/16px var(--police-texte);
    }
    .dev select {
      flex: 1;
      min-width: 0;
      height: 28px;
      border: 1px solid var(--c-bordure-champ);
      border-radius: var(--rayon);
      font: 400 13px var(--police-texte);
      color: var(--c-texte);
      background: var(--c-surface);
    }
    .compte {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px var(--esp-3);
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--c-primaire);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 500 12px/1 var(--police-texte);
      flex: none;
    }
    .identite {
      display: flex;
      flex-direction: column;
      font: 400 13px/18px var(--police-texte);
      min-width: 0;
    }
    .identite b {
      font-weight: 500;
    }
    .identite span {
      color: var(--c-texte-discret);
      font-size: 12px;
    }
    .param-intro {
      margin: 0 0 var(--esp-3);
      color: var(--c-texte-discret);
      font-size: 14px;
      line-height: 1.5;
    }
    .param-intro:last-of-type {
      margin: var(--esp-3) 0 0;
    }
    .param {
      display: flex;
      align-items: flex-start;
      gap: var(--esp-3);
      padding: var(--esp-3) 0;
      border-top: 1px solid var(--c-separateur);
      cursor: pointer;
    }
    .param input {
      width: 18px;
      height: 18px;
      margin-top: 2px;
      accent-color: var(--c-primaire);
      flex: none;
    }
    .param span {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .param b {
      font-weight: 500;
    }
    .param small {
      font-size: 13px;
      color: var(--c-texte-discret);
    }
    .reperes {
      margin: 0;
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 10px 16px;
      line-height: 1.5;
    }
    .reperes dt {
      font-weight: 600;
    }
    .reperes dd {
      margin: 0;
      color: var(--c-texte-doux);
    }

    /* petit écran : une barre en haut, le menu s'ouvre par-dessus la page */
    @media (max-width: 900px) {
      :host {
        position: sticky;
        width: 100%;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--c-bordure);
      }
      .tete {
        height: 56px;
        border-bottom: 0;
        padding: 0 var(--esp-2) 0 var(--esp-4);
      }
      .menu {
        display: inline-flex;
      }
      .replier {
        display: none;
      }
      .corps,
      .pied {
        display: none;
      }
      :host(.ouverte) .corps,
      :host(.ouverte) .pied {
        display: flex;
      }
      :host(.ouverte) {
        height: 100vh;
        position: fixed;
        inset: 0;
      }
      :host(.ouverte) .tete {
        border-bottom: 1px solid var(--c-separateur);
      }
    }
  `,
})
export class BarreLaterale implements OnInit {
  protected readonly nav = inject(NavigationService);
  protected readonly session = inject(SessionService);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ProjetsApi);
  private readonly router = inject(Router);

  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injecteur = inject(Injector);
  protected readonly nomApplication = NOM_APPLICATION;
  protected readonly sousTitre = SOUS_TITRE_APPLICATION;
  protected readonly menuOuvert = signal(false);
  protected readonly reperesOuverts = signal(false);
  protected readonly parametresOuverts = signal(false);
  protected readonly prefs = inject(PreferencesService);
  protected readonly initialesDe = initiales;
  /** Utilisateurs fictifs déclarés dans appsettings.Development.json de l'API. */
  protected readonly utilisateursDev = [
    { cle: 'chef', libelle: 'Chef de projet' },
    { cle: 'consultant', libelle: 'Consultant' },
    { cle: 'pilotage', libelle: 'Pilotage' },
  ];

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly surAccueil = computed(() => {
    const u = this.url().split('?')[0];
    return u === '/' || u === '/projets';
  });

  protected surPage(chemin: string): boolean {
    return this.url().split('?')[0].startsWith(chemin);
  }

  /** Projets actifs, sans celui qui est ouvert (il a son propre bloc). */
  private readonly autresProjets = computed(() => {
    const ouvert = this.nav.projetOuvert()?.id;
    return (this.nav.projets() ?? []).filter((p) => (p.statutCode === 'EnCours' || p.statutCode === 'EnPreparation') && p.id !== ouvert);
  });
  protected readonly projetsListes = computed(() => this.autresProjets().slice(0, PROJETS_LISTES));
  protected readonly projetsEnPlus = computed(() => Math.max(0, this.autresProjets().length - PROJETS_LISTES));

  constructor() {
    // le menu replié (petit écran) se referme dès qu'on change de page
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.menuOuvert.set(false));
  }

  /** Réduit ou rouvre le panneau ; le choix est retenu par le navigateur et vaut pour toutes les pages. */
  protected replier(reduire: boolean): void {
    this.prefs.changer({ barreRepliee: reduire });
    // le bouton cliqué disparaît : le focus clavier passe sur celui qui fait l'inverse
    afterNextRender(() => this.hote.nativeElement.querySelector<HTMLElement>(reduire ? '.deplier' : '.replier')?.focus(), { injector: this.injecteur });
  }

  ngOnInit(): void {
    if (this.nav.projets() === null) void this.chargerProjets();
  }

  private async chargerProjets(): Promise<void> {
    try {
      this.nav.projets.set(await firstValueFrom(this.api.lister()));
    } catch {
      // la liste n'est qu'un raccourci : l'accueil affiche l'erreur s'il y en a une
    }
  }

  protected nomProjet(p: ProjetResume): string {
    return [p.client, p.nom].filter(Boolean).join(' — ');
  }

  protected readonly couleur = couleurProjet;

  protected readonly libelleEtat: Record<string, string> = {
    ok: 'Rubrique complète',
    conseil: 'À vérifier',
    bloquant: 'À corriger avant le lancement',
    vide: 'Pas encore remplie',
  };

  /** Lien d'une rubrique du projet (ou du brouillon) ouvert. */
  protected lienRubrique(p: ProjetNavigation, chemin: string): string[] {
    return [...(p.base ?? ['/projets', p.id]), chemin];
  }

  /** Dans un projet : les repères détaillés du suivi ; ailleurs : les repères essentiels. */
  protected ouvrirReperes(): void {
    const p = this.nav.projetOuvert();
    if (p?.ouvrirReperes) p.ouvrirReperes();
    else this.reperesOuverts.set(true);
    this.menuOuvert.set(false);
  }

  protected changerUtilisateur(evenement: Event): void {
    this.auth.changerUtilisateurDev((evenement.target as HTMLSelectElement).value);
  }
}
