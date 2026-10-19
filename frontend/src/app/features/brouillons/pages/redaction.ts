import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { NavigationService, ProjetNavigation } from '../../../core/layout/navigation';
import { NotificationsService } from '../../../core/notifications/notifications';
import { formatDate, formatJh, formatPourcentage } from '../../../shared/format/formats';
import { Icone } from '../../../shared/ui/icone';
import { messageErreurFichier, telecharger } from '../../suivi/etat/fichiers';
import { BrouillonsApi } from '../api/brouillons.api';
import { Rubrique } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { chargeTotale, depuis, totalEcheances } from '../etat/brouillon.logique';
import { PanneauDirect } from './panneau-direct';
import { RUBRIQUES } from './rubriques';

/**
 * Rédaction du TSP d'un nouveau projet (brouillon) : en-tête (nom, état de l'enregistrement, export, lancement),
 * rubrique affichée, et à droite le TSP « en direct » (chiffres recalculés par le serveur à chaque enregistrement).
 * Les rubriques et leur état sont publiés dans la barre latérale, comme celles d'un projet.
 */
@Component({
  selector: 'app-redaction',
  imports: [RouterOutlet, RouterLink, Icone, PanneauDirect],
  providers: [BrouillonEtat],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'suivi', '(window:beforeunload)': 'avantDeQuitter($event)' },
  template: `
    @if (etat.chargement()) {
      <p class="wrap r-attente" aria-busy="true">Ouverture du brouillon…</p>
    } @else if (etat.erreurChargement()) {
      <div class="wrap r-attente">
        <div class="banner warn" role="alert">
          <span>{{ etat.erreurChargement() }}</span>
          <a class="btn" routerLink="/projets">Retour à mes projets</a>
        </div>
      </div>
    } @else if (etat.contenu(); as tsp) {
      <header class="wrap s-entete">
        <nav class="s-ariane" aria-label="Fil d’Ariane">
          <a routerLink="/projets" class="s-retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            Mes projets
          </a>
          <span aria-hidden="true">/</span>
          <span>Nouveau projet</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ libelleRubrique() }}</span>
        </nav>
        <div class="s-titre">
          <div class="s-titre-g">
            <div class="s-titre-ligne">
              <h1>{{ etat.titre() }}</h1>
              <span class="r-brouillon">Brouillon</span>
            </div>
            <div class="s-puces">
              @if (tsp.fiche.reference) {
                <span class="s-puce">{{ tsp.fiche.reference }}</span>
              }
              @if (tsp.fiche.debut && tsp.fiche.fin) {
                <span class="s-puce">{{ fD(tsp.fiche.debut) }} → {{ fD(tsp.fiche.fin) }}</span>
              }
              <span class="s-puce r-prive" [title]="'Visible de ' + visiblePar()">
                <app-icone nom="cadenas" [taille]="14" />{{ visiblePar() }}
              </span>
              @if (etat.brouillon(); as b) {
                @if (b.origineCode !== 'Vierge') {
                  <span class="s-puce" [title]="b.origine">{{ b.origineCode === 'ImportTsp' ? 'Importé de ' : 'Repris de ' }}{{ b.source }}</span>
                }
              }
            </div>
          </div>
          <div class="actions r-actions">
            <span class="dirty" [class.clean]="etat.statut() === 'enregistre'" [class.r-ko]="etat.statut() === 'erreur' || etat.statut() === 'conflit'" role="status">
              {{ texteStatut() }}
            </span>
            <button type="button" class="btn" [disabled]="exportEnCours()" (click)="exporter()" title="Le TSP au format Excel, réimportable tel quel">
              <app-icone nom="fichier-excel" [taille]="16" />{{ exportEnCours() ? 'Export…' : 'Exporter en Excel' }}
            </button>
            @if (rubrique() !== 'lancer') {
              <a class="btn primary r-lancer" [routerLink]="['/brouillons', id(), 'lancer']">
                <app-icone nom="fusee" [taille]="16" />Vérifier et lancer
              </a>
            }
          </div>
        </div>
      </header>

      @if (etat.statut() === 'conflit') {
        <div class="wrap r-bandeaux">
          <div class="banner warn" role="alert">
            <span><b>{{ etat.erreur() }}</b> Vos dernières saisies n’ont pas été enregistrées.</span>
            <button type="button" class="btn" (click)="recharger()">Recharger le brouillon</button>
          </div>
        </div>
      } @else if (etat.statut() === 'erreur') {
        <div class="wrap r-bandeaux">
          <div class="banner warn" role="alert">
            <span><b>Enregistrement impossible.</b> {{ etat.erreur() }}</span>
            <button type="button" class="btn" (click)="etat.enregistrerMaintenant()">Réessayer</button>
          </div>
        </div>
      }

      <div class="wrap r-corps">
        <main class="r-principal">
          <router-outlet />
        </main>
        @if (!pleineLargeur()) {
          <app-panneau-direct class="r-direct" />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .r-attente {
      padding-block: 40px;
      color: var(--muted);
    }
    .r-brouillon {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 var(--esp-2);
      border-radius: var(--rayon-badge);
      background: var(--c-violet-fond);
      color: var(--c-violet);
      font: 500 13px/1 var(--police-texte);
    }
    .r-prive {
      gap: 6px;
      color: var(--ink-2);
    }
    .r-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
    }
    .r-actions .btn {
      height: 36px;
      padding: 0 14px;
      gap: 6px;
    }
    .r-lancer {
      text-decoration: none;
    }
    .dirty.r-ko {
      color: var(--crit);
    }
    .r-bandeaux {
      padding-top: 14px;
    }
    .r-corps {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
      padding-block: 20px 60px;
    }
    .r-principal {
      flex: 999 1 560px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .r-direct {
      flex: 1 1 280px;
      max-width: 340px;
      position: sticky;
      top: 16px;
    }
    @media (max-width: 900px) {
      .r-direct {
        position: static;
        max-width: none;
      }
    }
  `,
})
export class Redaction {
  protected readonly etat = inject(BrouillonEtat);
  private readonly api = inject(BrouillonsApi);
  private readonly nav = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);

  /** Identifiant du brouillon (paramètre de l'adresse). */
  readonly id = input.required<string>();
  protected readonly exportEnCours = signal(false);
  protected readonly fD = formatDate;
  /** Heure courante, pour « enregistré il y a 12 s » (rafraîchie toutes les 10 secondes). */
  private readonly maintenant = signal(new Date());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Rubrique affichée (dernier élément de l'adresse). */
  protected readonly rubrique = computed(() => this.url().split('?')[0].split('/').pop() ?? 'fiche');
  /** Les grands tableaux (workload, planning) et le lancement prennent toute la largeur : le TSP en direct est alors résumé dans la page. */
  protected readonly pleineLargeur = computed(() => ['workload', 'planning', 'synthese', 'lancer'].includes(this.rubrique()));
  protected readonly libelleRubrique = computed(
    () =>
      RUBRIQUES.find((r) => r.cle === this.rubrique())?.libelle ??
      (this.rubrique() === 'lancer' ? 'Prêt à lancer ?' : this.rubrique() === 'synthese' ? 'Synthèse' : ''),
  );

  protected readonly visiblePar = computed(() => {
    const b = this.etat.brouillon();
    if (!b) return '';
    const moi = b.estCreateur ? 'vous' : b.createur.nomComplet;
    const co = b.coRedacteur ? (b.estCreateur ? b.coRedacteur.nomComplet : 'vous') : null;
    return co ? `Visible de ${moi} et de ${co} seulement` : `Visible de ${moi} seulement`;
  });

  protected readonly texteStatut = computed(() => {
    switch (this.etat.statut()) {
      case 'modifie':
        return 'Modifications en attente…';
      case 'envoi':
        return 'Enregistrement…';
      case 'erreur':
        return 'Non enregistré';
      case 'conflit':
        return 'Modifié ailleurs';
      default:
        return `Enregistré ${depuis(this.etat.enregistreLe(), this.maintenant())}`.trim();
    }
  });

  /** Rubriques et leur état, publiés dans la barre latérale. */
  private readonly navigation = computed<ProjetNavigation | null>(() => {
    const tsp = this.etat.contenu();
    const a = this.etat.analyse();
    if (!tsp || !a) return null;
    const actif = this.rubrique();
    const pct = totalEcheances(tsp.echeances);
    const notes: Record<Rubrique, string> = {
      fiche: '',
      profils: tsp.profils.length ? String(tsp.profils.length) : '',
      workload: tsp.taches.length ? `${formatJh(chargeTotale(tsp))} JH` : '',
      planning: a.rubriques.planning === 'conseil' ? 'écart' : '',
      echeancier: tsp.echeances.length ? formatPourcentage(pct) : '',
      depenses: a.rubriques.depenses === 'vide' ? 'facultatif' : '',
    };
    return {
      id: this.id(),
      nom: this.etat.titre(),
      etiquette: 'Brouillon ouvert',
      base: ['/brouillons', this.id()],
      groupes: [
        {
          libelle: 'Rédaction du TSP',
          liens: RUBRIQUES.map((r) => ({
            libelle: r.libelle,
            chemin: r.cle,
            icone: 'fiche' as const,
            actif: actif === r.cle,
            badge: 0,
            retard: false,
            etat: a.rubriques[r.cle],
            note: notes[r.cle],
          })),
        },
        {
          libelle: 'Synthèse',
          liens: [{ libelle: 'Synthèse du TSP', chemin: 'synthese', icone: 'graphique' as const, actif: actif === 'synthese', badge: 0, retard: false }],
        },
        {
          libelle: 'Lancement',
          liens: [{ libelle: 'Prêt à lancer ?', chemin: 'lancer', icone: 'fusee' as const, actif: actif === 'lancer', badge: a.bloquants, retard: a.bloquants > 0 }],
        },
      ],
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.etat.charger(id));
    });
    effect(() => this.nav.projetOuvert.set(this.navigation()));
    const minuteur = setInterval(() => this.maintenant.set(new Date()), 10_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(minuteur);
      this.nav.projetOuvert.set(null);
      // en quittant l'écran : ce qui est en attente est enregistré
      void this.etat.enregistrerMaintenant();
    });
  }

  protected async exporter(): Promise<void> {
    this.exportEnCours.set(true);
    try {
      await this.etat.enregistrerMaintenant();
      telecharger(await firstValueFrom(this.api.exporter(this.id())), 'TSP.xlsx');
    } catch (e) {
      this.notifications.erreur(await messageErreurFichier(e));
    } finally {
      this.exportEnCours.set(false);
    }
  }

  protected recharger(): void {
    void this.etat.charger(this.id());
  }

  /** Fermer l'onglet avec des saisies non enregistrées : le navigateur demande confirmation. */
  protected avantDeQuitter(evenement: BeforeUnloadEvent): void {
    if (this.etat.statut() === 'modifie' || this.etat.statut() === 'envoi' || this.etat.statut() === 'erreur') {
      evenement.preventDefault();
      void this.etat.enregistrerMaintenant();
    }
  }
}
