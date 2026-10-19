import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjetsApi } from '../../api/projets.api';
import { messageErreur } from '../../core/http/erreurs.interceptor';
import { NavigationService } from '../../core/layout/navigation';
import { NotificationsService } from '../../core/notifications/notifications';
import { SessionService } from '../../core/session/session.service';
import { aujourdhuiIso, couleurProjet, formatDate } from '../../shared/format/formats';
import { Icone } from '../../shared/ui/icone';
import { Suivi } from '../suivi/api/modeles';
import { SuiviApi } from '../suivi/api/suivi.api';
import { fDh, fJ } from '../suivi/etat/formats';
import { initialesDe } from '../suivi/etat/fil.logique';
import { lundi } from '../portefeuille/portefeuille.logique';
import {
  elementsDuProjet,
  joursDeLaSemaine,
  LigneSemaine,
  lignesSemaine,
  notificationsDuProjet,
  parPeriode,
  periode,
  trierNotifications,
} from './travail.logique';

/** Dernière consultation des notifications (propre à ce navigateur). */
const CLE_VU = 'pilotageForfaits.travail.vu';
const JOURS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.'];

/**
 * « Mon travail » : pour la personne connectée, sur tous ses projets, ce qui lui est confié (en retard d'abord),
 * sa saisie de temps de la semaine et ce qui a changé sur ce qui la concerne.
 * Chaque saisie de temps passe par l'API du projet (mêmes règles que l'écran Workload : 1 JH par jour au plus…).
 */
@Component({
  selector: 'app-mon-travail',
  imports: [RouterLink, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <div class="titre-page">
        <div class="titres">
          <span class="mt-sur">{{ jourLong }}</span>
          <h1>Bonjour {{ session.moi()?.prenom ?? '' }}</h1>
          @if (!chargement()) {
            <p>{{ resume() }}</p>
          }
        </div>
      </div>

      @if (chargement()) {
        <p class="mt-discret">Chargement de vos projets…</p>
      } @else {
        @if (echecs().length) {
          <div class="encart" role="alert">
            <app-icone nom="info" />
            <p>{{ echecs().length }} projet(s) n’ont pas pu être lus : {{ echecs().join(', ') }}. <button type="button" class="btn" (click)="charger()">Réessayer</button></p>
          </div>
        }
        <div class="mt-grille">
          <div class="mt-colonne">
            <section class="carte mt-carte" aria-labelledby="mt-confie">
              <header class="mt-tete">
                <h2 id="mt-confie">Ce qui m’est confié</h2>
                <span class="mt-discret">{{ elements().length }} élément{{ elements().length > 1 ? 's' : '' }} ouverts</span>
              </header>
              @for (g of groupes(); track g.cle) {
                @let replie = g.cle === 'sans-date' && !sansDateOuvert();
                <div class="mt-groupe" [class]="'mt-groupe ' + g.cle">
                  {{ g.libelle }} <span>· {{ g.elements.length }}</span>
                  @if (g.cle === 'sans-date') {
                    <button type="button" class="mt-plier" [attr.aria-expanded]="!replie" (click)="sansDateOuvert.set(replie)">{{ replie ? 'Afficher' : 'Masquer' }}</button>
                  }
                </div>
                @for (e of replie ? [] : g.elements; track e.cle) {
                  <a class="mt-element" [routerLink]="['/projets', e.projetId, e.ecran]" [queryParams]="e.uid ? { tache: e.uid } : {}" [style.--repere]="couleur(e.projetId)">
                    <span class="mt-genre">{{ e.genre }}</span>
                    <span class="mt-titre">
                      <span class="mt-nom">{{ e.titre }}</span>
                      <span class="mt-projet">{{ e.projet }}</span>
                    </span>
                    <span class="mt-date" [class.retard]="g.cle === 'retard'">{{ e.date ? formatDate(e.date) : '—' }}</span>
                    <span class="pastille" [class]="'pastille ' + tonStatut(e.statut)">{{ e.statut }}</span>
                  </a>
                }
              } @empty {
                <div class="mt-vide">
                  <p><b>Rien ne vous est confié pour l’instant.</b></p>
                  <p>
                    Les tâches apparaissent ici quand votre nom (« {{ session.nomComplet() }} ») est indiqué comme collaborateur d’un profil du TSP, et les actions quand
                    vous en êtes le porteur. Si votre nom est écrit autrement dans un projet, demandez au chef de projet de le corriger.
                  </p>
                </div>
              }
            </section>

            <section class="carte mt-carte" aria-labelledby="mt-semaine">
              <header class="mt-tete">
                <h2 id="mt-semaine">Ma saisie de la semaine</h2>
                <span class="mt-semaines">
                  <button type="button" class="btn discret" aria-label="Semaine précédente" (click)="decaler(-7)">‹</button>
                  <span>semaine du {{ formatDate(semaine()) }}</span>
                  <button type="button" class="btn discret" aria-label="Semaine suivante" (click)="decaler(7)">›</button>
                </span>
              </header>
              @if (lignes().length) {
                <div class="mt-defilement">
                  <table class="mt-table">
                    <thead>
                      <tr>
                        <th>Projet · tâche</th>
                        @for (j of jours(); track j; let k = $index) {
                          <th class="c" [class.auj]="j === aujourdhui">{{ nomsJours[k] }} {{ j.slice(8) }}</th>
                        }
                        <th class="c">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (l of lignes(); track l.cle) {
                        <tr>
                          <td>
                            <div class="mt-lib">
                              <i [style.background]="couleur(l.projetId)"></i>
                              <span><b>{{ l.titre }}</b><small>{{ l.projet }}</small></span>
                            </div>
                          </td>
                          @for (j of jours(); track j) {
                            <td class="c">
                              <input
                                class="mt-case"
                                type="number"
                                min="0"
                                max="1"
                                step="0.25"
                                inputmode="decimal"
                                [value]="l.parJour[j] ? l.parJour[j] : ''"
                                [disabled]="!l.peutSaisir || envoi()"
                                [attr.aria-label]="'Consommé du ' + formatDate(j) + ' sur ' + l.titre"
                                (change)="saisir(l, j, $event)"
                              />
                            </td>
                          }
                          <td class="c"><b>{{ fJ(total(l)) }}</b></td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total du jour</td>
                        @for (j of jours(); track j) {
                          <td class="c" [class.trop]="totalJour(j) > 1.0001">{{ fJ(totalJour(j)) }}</td>
                        }
                        <td class="c"><b>{{ fJ(totalSemaine()) }}</b></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p class="mt-note">En jours-homme (0,25 = 2 h). 1 JH au plus par jour, toutes tâches confondues. Le chef de projet voit le consommé mis à jour.</p>
              } @else {
                <p class="mt-vide">Aucune tâche en cours où vous avez de la charge.</p>
              }
            </section>
          </div>

          <section class="carte mt-carte mt-notifs" aria-labelledby="mt-notifs">
            <header class="mt-tete">
              <h2 id="mt-notifs">
                Notifications
                @if (nonLues()) {
                  <span class="compteur-rond">{{ nonLues() }}</span>
                }
              </h2>
              @if (nonLues()) {
                <button type="button" class="btn discret" (click)="toutLu()">Tout marquer comme lu</button>
              }
            </header>
            @for (n of notifications(); track n.cle) {
              <a class="mt-notif" [class.nouvelle]="estNouvelle(n.le)" [routerLink]="['/projets', n.projetId, n.ecran]" [queryParams]="n.uid ? { tache: n.uid } : {}">
                <span class="mt-av" aria-hidden="true">{{ initialesDe(n.par) }}</span>
                <span class="mt-notif-corps">
                  <span><b>{{ n.par }}</b> {{ n.texte }}</span>
                  <small>{{ n.projet }} · {{ fDh(n.le) }}</small>
                </span>
              </a>
            } @empty {
              <p class="mt-vide">Rien de nouveau sur ce qui vous concerne.</p>
            }
            <p class="mt-note">
              Dans l’application pour l’instant : l’envoi par e-mail ou Teams sera branché avec l’équipe d’hébergement. Mentionnez un collègue dans une mise à jour avec
              « @Prénom ».
            </p>
          </section>
        </div>
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
    }
    .titres p {
      margin: 0;
      font-size: 15px;
      color: var(--c-texte-discret);
    }
    .mt-sur {
      font: 400 13px/18px var(--police-texte);
      color: var(--c-texte-discret);
      text-transform: capitalize;
    }
    .mt-discret {
      color: var(--c-texte-discret);
    }
    .mt-grille {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: var(--esp-6);
      align-items: start;
    }
    .mt-colonne {
      display: flex;
      flex-direction: column;
      gap: var(--esp-6);
      min-width: 0;
    }
    .mt-carte {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .mt-tete {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--esp-3);
      flex-wrap: wrap;
      padding: var(--esp-4) var(--esp-5);
    }
    .mt-tete h2 {
      font: var(--texte-titre-carte);
      display: flex;
      align-items: center;
      gap: var(--esp-2);
    }
    .mt-tete .btn {
      height: 32px;
      padding: 0 var(--esp-2);
      font-size: 13px;
    }
    .mt-tete .mt-discret {
      font-size: 13px;
    }
    .mt-groupe {
      padding: 8px var(--esp-5);
      border-top: 1px solid var(--c-bordure);
      background: var(--c-fond);
      font: 600 13px/18px var(--police-texte);
    }
    .mt-plier {
      margin-left: var(--esp-2);
      border: 0;
      background: transparent;
      color: var(--c-primaire);
      font: 400 13px/18px var(--police-texte);
      cursor: pointer;
      padding: 0;
    }
    .mt-groupe span {
      font-weight: 400;
      color: var(--c-texte-discret);
    }
    .mt-groupe.retard {
      color: var(--c-critique);
    }
    .mt-groupe.semaine {
      color: var(--c-attention);
    }
    .mt-element {
      display: grid;
      grid-template-columns: 84px minmax(0, 1fr) 96px 120px;
      gap: var(--esp-3);
      align-items: center;
      min-height: 52px;
      padding: 4px var(--esp-5);
      border-top: 1px solid var(--c-separateur);
      box-shadow: inset 4px 0 0 var(--repere, transparent);
      color: var(--c-texte);
      text-decoration: none;
      transition: background var(--transition);
    }
    .mt-element:hover {
      background: var(--c-survol);
    }
    .mt-genre {
      font: 400 12px/20px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .mt-titre {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mt-nom {
      font: 500 14px/20px var(--police-texte);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mt-projet {
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .mt-date {
      font: 500 13px/18px var(--police-texte);
    }
    .mt-date.retard {
      color: var(--c-critique);
    }
    .mt-element .pastille {
      width: 100%;
      min-height: 32px;
    }
    .mt-vide {
      margin: 0;
      padding: 0 var(--esp-5) var(--esp-5);
      color: var(--c-texte-discret);
      line-height: 1.5;
    }
    .mt-vide p {
      margin: 0 0 var(--esp-2);
    }
    .mt-vide b {
      color: var(--c-texte);
      font-weight: 500;
    }
    .mt-semaines {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: 400 13px/18px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .mt-semaines .btn {
      height: 32px;
      padding: 0 10px;
      font-size: 18px;
    }
    .mt-defilement {
      overflow-x: auto;
      padding: 0 var(--esp-5);
    }
    .mt-table {
      width: 100%;
      min-width: 600px;
      border-collapse: collapse;
    }
    .mt-table th {
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
      text-align: left;
      padding: 6px;
      border-bottom: 1px solid var(--c-bordure);
    }
    .mt-table th.auj {
      color: var(--c-primaire-fonce);
      font-weight: 600;
    }
    .mt-table td {
      padding: 6px 4px;
      border-bottom: 1px solid var(--c-separateur);
      font: 400 14px/20px var(--police-texte);
    }
    .mt-table tfoot td {
      border-bottom: 0;
      color: var(--c-texte-discret);
    }
    .mt-table td.trop {
      color: var(--c-critique);
      font-weight: 600;
    }
    .c {
      text-align: center !important;
    }
    .mt-lib {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      min-width: 170px;
      max-width: 280px;
    }
    .mt-lib i {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex: none;
    }
    .mt-lib span {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mt-lib b {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mt-lib small {
      font-size: 12px;
      color: var(--c-texte-discret);
    }
    .mt-case {
      width: 52px;
      height: 32px;
      box-sizing: border-box;
      padding: 0 6px;
      text-align: center;
      border: 1px solid var(--c-bordure-champ);
      border-radius: var(--rayon);
      font: 400 14px var(--police-texte);
    }
    .mt-case:focus {
      outline: none;
      border-color: var(--c-primaire);
    }
    .mt-note {
      margin: 0;
      padding: var(--esp-3) var(--esp-5) var(--esp-4);
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .mt-notif {
      display: flex;
      gap: var(--esp-3);
      padding: var(--esp-3) var(--esp-5);
      border-top: 1px solid var(--c-separateur);
      color: var(--c-texte);
      text-decoration: none;
      font: 400 13px/18px var(--police-texte);
    }
    .mt-notif:hover {
      background: var(--c-survol);
    }
    .mt-notif.nouvelle {
      background: var(--c-primaire-pale);
    }
    .mt-notif b {
      font-weight: 600;
    }
    .mt-notif small {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: var(--c-texte-discret);
    }
    .mt-notif-corps {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .mt-av {
      width: 32px;
      height: 32px;
      flex: none;
      border-radius: 50%;
      background: var(--c-primaire);
      color: #fff;
      display: grid;
      place-items: center;
      font: 500 12px/1 var(--police-texte);
    }
    @media (max-width: 1100px) {
      .mt-grille {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 640px) {
      .mt-element {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .mt-genre,
      .mt-element .pastille {
        display: none;
      }
    }
  `,
})
export class MonTravail implements OnInit {
  protected readonly session = inject(SessionService);
  private readonly nav = inject(NavigationService);
  private readonly projetsApi = inject(ProjetsApi);
  private readonly api = inject(SuiviApi);
  private readonly notifs = inject(NotificationsService);

  protected readonly aujourdhui = aujourdhuiIso();
  protected readonly jourLong = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  protected readonly nomsJours = JOURS;
  protected readonly formatDate = formatDate;
  protected readonly fDh = fDh;
  protected readonly fJ = fJ;
  protected readonly initialesDe = initialesDe;
  protected readonly couleur = couleurProjet;

  protected readonly chargement = signal(true);
  protected readonly envoi = signal(false);
  /** Suivi de chaque projet actif, par identifiant. */
  private readonly suivis = signal<Record<string, Suivi>>({});
  protected readonly echecs = signal<string[]>([]);
  protected readonly semaine = signal(lundi(this.aujourdhui));
  /** Les éléments sans échéance (souvent nombreux) sont repliés par défaut. */
  protected readonly sansDateOuvert = signal(false);
  protected readonly vu = signal(MonTravail.lireVu());

  private readonly moi = computed(() => {
    const m = this.session.moi();
    return m ? { prenom: m.prenom, nom: m.nom } : null;
  });

  protected readonly elements = computed(() => {
    const moi = this.moi();
    if (!moi) return [];
    return Object.entries(this.suivis()).flatMap(([id, s]) => elementsDuProjet(s, id, moi));
  });
  protected readonly groupes = computed(() => parPeriode(this.elements(), this.aujourdhui));
  protected readonly jours = computed(() => joursDeLaSemaine(this.semaine()));
  protected readonly lignes = computed(() => {
    const moi = this.moi();
    if (!moi) return [];
    const jours = this.jours();
    return Object.entries(this.suivis()).flatMap(([id, s]) => lignesSemaine(s, id, moi, jours));
  });
  protected readonly notifications = computed(() => {
    const moi = this.moi();
    if (!moi) return [];
    const elements = this.elements();
    return trierNotifications(Object.entries(this.suivis()).map(([id, s]) => notificationsDuProjet(s, id, moi, elements)));
  });
  protected readonly nonLues = computed(() => this.notifications().filter((n) => this.estNouvelle(n.le)).length);

  /** Notification arrivée après la dernière consultation (« Tout marquer comme lu »). */
  protected estNouvelle(le: string): boolean {
    const vu = Date.parse(this.vu());
    return Number.isNaN(vu) || Date.parse(le) > vu;
  }

  protected readonly resume = computed(() => {
    const e = this.elements();
    const retard = e.filter((x) => periode(x, this.aujourdhui) === 'retard').length;
    const semaine = e.filter((x) => periode(x, this.aujourdhui) === 'semaine').length;
    if (!e.length) return 'Rien ne vous est confié sur vos projets en cours.';
    const morceaux = [
      retard ? `${retard} élément${retard > 1 ? 's' : ''} en retard` : '',
      semaine ? `${semaine} à rendre cette semaine` : '',
      `${e.length} au total`,
    ].filter(Boolean);
    return morceaux.join(' · ') + '.';
  });

  ngOnInit(): void {
    void this.charger();
  }

  /** Lit les projets actifs, puis le suivi de chacun (en parallèle). Un projet illisible n'empêche pas d'afficher les autres. */
  protected async charger(): Promise<void> {
    this.chargement.set(true);
    this.echecs.set([]);
    try {
      const projets = await firstValueFrom(this.projetsApi.lister());
      this.nav.projets.set(projets);
      const actifs = projets.filter((p) => !p.estVide && (p.statutCode === 'EnCours' || p.statutCode === 'EnPreparation'));
      const resultats = await Promise.allSettled(actifs.map((p) => firstValueFrom(this.api.obtenir(p.id))));
      const suivis: Record<string, Suivi> = {};
      const echecs: string[] = [];
      resultats.forEach((r, k) => {
        if (r.status === 'fulfilled') suivis[actifs[k].id] = r.value;
        else echecs.push(`${actifs[k].client} — ${actifs[k].nom}`);
      });
      this.suivis.set(suivis);
      this.echecs.set(echecs);
    } catch (e) {
      this.notifs.erreur(messageErreur(e));
    } finally {
      this.chargement.set(false);
      this.publierCompteur();
    }
  }

  /** Pastille de « Mon travail » dans la barre latérale : éléments en retard ou à rendre cette semaine. */
  private publierCompteur(): void {
    const urgents = this.elements().filter((x) => ['retard', 'semaine'].includes(periode(x, this.aujourdhui)));
    this.nav.aMonTravail.set(urgents.length);
    this.nav.aMonTravailRetard.set(urgents.some((x) => periode(x, this.aujourdhui) === 'retard'));
  }

  protected decaler(jours: number): void {
    const d = new Date(this.semaine() + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + jours);
    this.semaine.set(d.toISOString().slice(0, 10));
  }

  protected total(l: LigneSemaine): number {
    return this.jours().reduce((n, j) => n + (l.parJour[j] ?? 0), 0);
  }

  protected totalJour(j: string): number {
    return this.lignes().reduce((n, l) => n + (l.parJour[j] ?? 0), 0);
  }

  protected totalSemaine(): number {
    return this.jours().reduce((n, j) => n + this.totalJour(j), 0);
  }

  /** Saisie d'une case : envoyée au projet ; le serveur applique les règles et renvoie le suivi recalculé. */
  protected async saisir(l: LigneSemaine, jour: string, e: Event): Promise<void> {
    const champ = e.target as HTMLInputElement;
    const brut = champ.value.trim().replace(',', '.');
    const jh = brut === '' ? null : Number(brut);
    const ancien = l.parJour[jour] ? String(l.parJour[jour]) : '';
    if (jh !== null && (!Number.isFinite(jh) || jh < 0 || jh > 1)) {
      this.notifs.erreur('Saisissez un nombre de jours entre 0 et 1 (0,25 = 2 h).');
      champ.value = ancien;
      return;
    }
    this.envoi.set(true);
    try {
      const r = await firstValueFrom(this.api.consomme(l.projetId, l.uid, l.profilId, jour, jh || null));
      this.suivis.update((s) => ({ ...s, [l.projetId]: r.suivi }));
      for (const m of r.messages) {
        if (m.ton === 'erreur') this.notifs.erreur(m.texte);
        else if (m.ton === 'attention') this.notifs.info(m.texte);
      }
      this.publierCompteur();
    } catch (err) {
      champ.value = ancien;
      this.notifs.erreur(messageErreur(err));
    } finally {
      this.envoi.set(false);
    }
  }

  protected toutLu(): void {
    const maintenant = new Date().toISOString();
    this.vu.set(maintenant);
    try {
      localStorage.setItem(CLE_VU, maintenant);
    } catch {
      /* stockage indisponible : l'état « lu » ne sera pas mémorisé */
    }
  }

  protected tonStatut(statut: string): string {
    if (/bloqu|retard/i.test(statut)) return 'critique';
    if (/cours|recette/i.test(statut)) return 'attention';
    if (/fait|valid/i.test(statut)) return 'ok';
    return 'neutre';
  }

  private static lireVu(): string {
    try {
      return localStorage.getItem(CLE_VU) ?? '';
    } catch {
      return '';
    }
  }
}
