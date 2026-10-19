import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjetsApi } from '../../api/projets.api';
import { NavigationService } from '../../core/layout/navigation';
import { aujourdhuiIso, couleurProjet, formatDate, formatEcart, formatJh, formatPourcentage } from '../../shared/format/formats';
import { imprimer } from '../../shared/impression/impression';
import { Icone } from '../../shared/ui/icone';
import { pointsDesProjets, tonDuNiveau } from '../projets/etat/accueil.logique';
import { chefs, lignesPortefeuille, lundi, synthese } from './portefeuille.logique';

/**
 * Portefeuille — le point du lundi : tous les projets actifs sur une ligne chacun (santé, avancement comparé au temps,
 * atterrissage, marge, points critiques, fin prévue), les plus fragiles d'abord, et ce qu'il faut remonter cette semaine.
 * Les marges n'apparaissent que pour les projets dont l'utilisateur voit les montants (le serveur ne les envoie pas aux autres).
 */
@Component({
  selector: 'app-portefeuille',
  imports: [RouterLink, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <div class="titre-page">
        <div class="titres">
          <h1>Portefeuille</h1>
          <p>Point du lundi · semaine du {{ formatDate(lundiDeLaSemaine) }} · situation au {{ formatDate(aujourdhui) }}</p>
        </div>
        <div class="boutons pf-ecran">
          @if (listeChefs().length > 1) {
            <label class="pf-filtre"
              >Chef de projet
              <select (change)="chef.set($any($event.target).value)" aria-label="Filtrer par chef de projet">
                <option value="">Tous</option>
                @for (c of listeChefs(); track c) {
                  <option [value]="c" [selected]="chef() === c">{{ c }}</option>
                }
              </select>
            </label>
          }
          <button type="button" class="btn" (click)="capturer()"><app-icone nom="imprimer" />Capture datée (PDF)</button>
        </div>
      </div>

      @if (chargement()) {
        <p class="pf-discret">Chargement du portefeuille…</p>
      } @else if (erreur()) {
        <div class="encart" role="alert">
          <app-icone nom="info" />
          <p>Le portefeuille n’a pas pu être chargé. <button type="button" class="btn" (click)="charger()">Réessayer</button></p>
        </div>
      } @else {
        @let s = resume();
        <div class="pf-chiffres" aria-label="Chiffres clés du portefeuille">
          <div class="pf-chiffre">
            <span class="pf-l">Projets actifs</span>
            <b>{{ s.actifs }}</b>
            <span class="pf-n">{{ s.pointsCritiques }} point{{ s.pointsCritiques > 1 ? 's' : '' }} critique{{ s.pointsCritiques > 1 ? 's' : '' }} à traiter</span>
          </div>
          <div class="pf-chiffre">
            <span class="pf-l">En dépassement</span>
            <b [class.pf-rouge]="s.enDerive > 0">{{ s.enDerive }}</b>
            <span class="pf-n">+ {{ s.aSurveiller }} à surveiller</span>
          </div>
          <div class="pf-chiffre">
            <span class="pf-l">En retard sur le temps</span>
            <b [class.pf-orange]="s.enRetardSurLeTemps > 0">{{ s.enRetardSurLeTemps }}</b>
            <span class="pf-n">avancement inférieur de plus de 10 points au temps écoulé</span>
          </div>
          <div class="pf-chiffre">
            <span class="pf-l">Sous la marge nette vendue</span>
            @if (s.avecMarge) {
              <b [class.pf-rouge]="s.sousMargeVendue > 0">{{ s.sousMargeVendue }}</b>
              <span class="pf-n">sur {{ s.avecMarge }} projet{{ s.avecMarge > 1 ? 's' : '' }} dont vous voyez la marge</span>
            } @else {
              <b>—</b>
              <span class="pf-n">marges réservées au chef de projet et au pilotage</span>
            }
          </div>
        </div>

        <section class="carte pf-carte" aria-labelledby="pf-titre">
          <header class="pf-tete">
            <h2 id="pf-titre">Tous les projets</h2>
            <span class="pf-discret">les plus fragiles d’abord</span>
          </header>
          @if (lignes().length) {
            <div class="pf-defilement">
              <div class="pf-tableau" role="table" aria-label="Projets du portefeuille">
                <div class="pf-ligne pf-entete" role="row">
                  <span role="columnheader">Projet</span>
                  <span role="columnheader">Chef de projet</span>
                  <span role="columnheader" class="c">Santé</span>
                  <span role="columnheader">Avancement / temps écoulé</span>
                  <span role="columnheader" class="n">Atterrissage</span>
                  <span role="columnheader" title="Marge nette (production, achats et frais) du TSP signé, puis attendue à la fin du projet">Marge nette vendue → à terminaison</span>
                  <span role="columnheader" class="c">Critiques</span>
                  <span role="columnheader">Fin prévue</span>
                </div>
                @for (l of lignes(); track l.projet.id) {
                  @let p = l.projet;
                  <a class="pf-ligne" role="row" [routerLink]="['/projets', p.id]" [style.--repere]="couleur(p.id)">
                    <span role="cell" class="pf-projet">
                      <span class="pf-nom">{{ p.client }} — {{ p.nom }}</span>
                      <span class="pf-sous">{{ p.reference ?? p.statut }}</span>
                    </span>
                    <span role="cell" class="pf-discret">{{ p.chefDeProjet ?? '—' }}</span>
                    <span role="cell" class="c"><span class="pastille" [class]="'pastille ' + l.sante.ton">{{ l.sante.libelle }}</span></span>
                    <span role="cell" class="pf-avancement">
                      @if (!p.estVide) {
                        <span class="pf-jauge" aria-hidden="true">
                          <i [style.width.%]="borne(p.avancement) * 100" [class.retard]="l.enRetardSurLeTemps"></i>
                          @if (l.tempsEcoule !== null) {
                            <b [style.left.%]="l.tempsEcoule * 100"></b>
                          }
                        </span>
                        <span class="pf-sous">
                          {{ formatPourcentage(p.avancement) }} fait{{ l.tempsEcoule !== null ? ' · ' + formatPourcentage(l.tempsEcoule) + ' du temps' : '' }}
                        </span>
                      } @else {
                        <span class="pf-discret">projet vide</span>
                      }
                    </span>
                    <span role="cell" class="n">
                      @if (!p.estVide) {
                        <b [class.pf-rouge]="l.sante.ton === 'critique'" [class.pf-vert]="p.ecart < -0.5">{{ formatEcart(p.ecart) }} JH</b>
                        <span class="pf-sous">sur {{ formatJh(p.prevu) }} prévus</span>
                      }
                    </span>
                    <span role="cell">
                      @if (l.ecartMarge !== null) {
                        <span class="pf-marge">
                          <span class="pf-discret">{{ formatPourcentage(p.tauxMargeVendue, 1) }}</span> →
                          <b [class.pf-rouge]="l.ecartMarge < -0.0005" [class.pf-vert]="l.ecartMarge > 0.0005">{{ formatPourcentage(p.tauxMargeAtterrissage, 1) }}</b>
                        </span>
                      } @else {
                        <span class="pf-discret">—</span>
                      }
                    </span>
                    <span role="cell" class="c">
                      @if (l.critiques) {
                        <span class="compteur-rond">{{ l.critiques }}</span>
                      } @else if (p.nombreATraiter) {
                        <span class="compteur-rond pf-gris">{{ p.nombreATraiter }}</span>
                      } @else {
                        <span class="pf-discret">—</span>
                      }
                    </span>
                    <span role="cell">
                      {{ formatDate(p.finPrevue ?? p.finContractuelle) }}
                      @if (p.joursOuvresRestants != null) {
                        <span class="pf-sous">{{ p.joursOuvresRestants }} j ouvrés restants</span>
                      }
                    </span>
                  </a>
                }
              </div>
            </div>
          } @else {
            <p class="pf-vide">Aucun projet actif{{ chef() ? ' pour ' + chef() : '' }}.</p>
          }
        </section>

        <section class="carte pf-carte" aria-labelledby="pf-remonter">
          <header class="pf-tete">
            <h2 id="pf-remonter">À remonter cette semaine</h2>
            <span class="pf-discret">points critiques et d’attention, tous projets</span>
          </header>
          @if (points().length) {
            <ul class="pf-points">
              @for (x of points(); track $index) {
                <li>
                  <span class="pastille" [class]="'pastille ' + tonDuNiveau(x.point.niveau)">{{ x.categorie.libelle }}</span>
                  <span class="pf-point">
                    <b>{{ x.projet }}</b> — {{ x.point.libelle }}{{ x.point.detail ? ' : ' + x.point.detail : '' }}
                  </span>
                  <a class="btn discret pf-ecran" [routerLink]="['/projets', x.projetId, x.categorie.ecran || 'tableau-de-bord']">{{ x.categorie.lien }}</a>
                </li>
              }
            </ul>
          } @else {
            <p class="pf-vide">Rien de critique cette semaine.</p>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .titre-page {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    .titres {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .titres h1 {
      font: var(--texte-titre-page);
      letter-spacing: -0.01em;
    }
    .titres p {
      margin: 0;
      font-size: 15px;
      color: var(--c-texte-discret);
    }
    .boutons {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--esp-3);
    }
    .pf-filtre {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .pf-filtre select {
      height: 40px;
      min-width: 180px;
      padding: 0 var(--esp-3);
      border: 1px solid var(--c-bordure-champ);
      border-radius: var(--rayon);
      background: var(--c-surface);
      font: 400 14px var(--police-texte);
      color: var(--c-texte);
    }
    .pf-discret {
      color: var(--c-texte-discret);
    }
    .pf-rouge {
      color: var(--c-critique);
    }
    .pf-orange {
      color: var(--c-attention);
    }
    .pf-vert {
      color: var(--c-ok);
    }
    .pf-chiffres {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }
    .pf-chiffre {
      background: var(--c-surface);
      border: 1px solid var(--c-separateur);
      border-radius: var(--rayon-carte);
      box-shadow: var(--ombre-carte);
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .pf-chiffre b {
      font: var(--texte-chiffre);
    }
    .pf-l {
      font: 400 13px/18px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .pf-n {
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .pf-carte {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .pf-tete {
      display: flex;
      align-items: baseline;
      gap: var(--esp-3);
      flex-wrap: wrap;
      padding: var(--esp-4) var(--esp-5);
    }
    .pf-tete h2 {
      font: var(--texte-titre-carte);
    }
    .pf-tete .pf-discret {
      font-size: 13px;
    }
    .pf-defilement {
      overflow-x: auto;
      position: relative;
    }
    .pf-tableau {
      min-width: 1104px;
    }
    .pf-ligne {
      display: grid;
      grid-template-columns: minmax(200px, 2fr) minmax(100px, 1fr) 120px minmax(150px, 1.3fr) 104px minmax(136px, 1fr) 72px 112px;
      gap: 10px;
      align-items: center;
      min-height: 56px;
      padding: 6px var(--esp-5);
      border-top: 1px solid var(--c-separateur);
      box-shadow: inset 4px 0 0 var(--repere, transparent);
      color: var(--c-texte);
      text-decoration: none;
      font: 400 14px/20px var(--police-texte);
      transition: background var(--transition);
    }
    a.pf-ligne:hover {
      background: var(--c-surface-survol, var(--c-survol));
    }
    .pf-entete {
      min-height: 36px;
      border-top: 1px solid var(--c-bordure);
      border-bottom: 1px solid var(--c-bordure);
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
      box-shadow: none;
    }
    .c {
      text-align: center;
      justify-self: center;
    }
    .n {
      text-align: right;
    }
    .pf-projet {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .pf-nom {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pf-sous {
      display: block;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .pf-avancement {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pf-jauge {
      position: relative;
      height: 8px;
      border-radius: 4px;
      background: var(--c-separateur);
    }
    .pf-jauge i {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 4px;
      background: #579bfc;
    }
    .pf-jauge i.retard {
      background: var(--c-statut-encours);
    }
    .pf-jauge b {
      position: absolute;
      top: -3px;
      width: 2px;
      height: 14px;
      margin-left: -1px;
      background: var(--c-texte);
    }
    .pf-marge b {
      font-weight: 500;
    }
    .pf-gris {
      background: var(--c-neutre-fond);
      color: var(--c-texte);
    }
    .pf-vide {
      margin: 0;
      padding: 0 var(--esp-5) var(--esp-5);
      color: var(--c-texte-discret);
    }
    .pf-points {
      list-style: none;
      margin: 0;
      padding: 0 var(--esp-5) var(--esp-3);
      display: flex;
      flex-direction: column;
    }
    .pf-points li {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      padding: var(--esp-2) 0;
      border-top: 1px solid var(--c-separateur);
    }
    .pf-points .pastille {
      flex: none;
      min-width: 104px;
    }
    .pf-point {
      flex: 1;
      min-width: 0;
      font: 400 14px/20px var(--police-texte);
    }
    .pf-point b {
      font-weight: 600;
    }
    @media (max-width: 1100px) {
      .pf-chiffres {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 560px) {
      .pf-chiffres {
        grid-template-columns: minmax(0, 1fr);
      }
      .pf-points li {
        flex-wrap: wrap;
      }
    }
    @media print {
      .pf-ecran {
        display: none !important;
      }
      .pf-defilement {
        overflow: visible;
      }
    }
  `,
})
export class Portefeuille implements OnInit {
  private readonly api = inject(ProjetsApi);
  private readonly nav = inject(NavigationService);

  protected readonly aujourdhui = aujourdhuiIso();
  protected readonly lundiDeLaSemaine = lundi(this.aujourdhui);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal(false);
  protected readonly chef = signal('');

  protected readonly formatDate = formatDate;
  protected readonly formatEcart = formatEcart;
  protected readonly formatJh = formatJh;
  protected readonly formatPourcentage = formatPourcentage;
  protected readonly tonDuNiveau = tonDuNiveau;
  protected readonly couleur = couleurProjet;

  private readonly projets = computed(() => this.nav.projets() ?? []);
  protected readonly listeChefs = computed(() => chefs(this.projets()));
  protected readonly lignes = computed(() => lignesPortefeuille(this.projets(), this.aujourdhui, this.chef()));
  protected readonly resume = computed(() => synthese(this.lignes()));
  protected readonly points = computed(() =>
    pointsDesProjets(
      this.lignes().map((l) => l.projet),
      12,
    ).filter((x) => x.point.niveau !== 'neutre'),
  );

  ngOnInit(): void {
    void this.charger();
  }

  /** Recharge toujours la liste : le point du lundi doit refléter les dernières saisies. */
  protected async charger(): Promise<void> {
    this.chargement.set(true);
    this.erreur.set(false);
    try {
      this.nav.projets.set(await firstValueFrom(this.api.lister()));
    } catch {
      this.erreur.set(true);
    } finally {
      this.chargement.set(false);
    }
  }

  protected borne(v: number): number {
    return Math.max(0, Math.min(1, v));
  }

  protected capturer(): void {
    imprimer('tableau');
  }
}
