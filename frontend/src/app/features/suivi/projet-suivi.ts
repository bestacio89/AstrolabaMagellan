import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { ProjetsApi } from '../../api/projets.api';
import { messageErreur } from '../../core/http/erreurs.interceptor';
import { GroupeProjet, NavigationService, ProjetNavigation } from '../../core/layout/navigation';
import { lectureAtterrissage } from '../../shared/format/formats';
import { NomIcone } from '../../shared/ui/icone';
import { SuiviApi } from './api/suivi.api';
import { calculerAlertes } from './etat/alertes';
import { messageErreurFichier, telecharger } from './etat/fichiers';
import { ONGLETS } from './etat/constantes';
import { fD } from './etat/formats';
import { PANNEAU_AVANCEMENT, PANNEAU_MARGE, SuiviEtat } from './etat/suivi.etat';
import { UiEtat } from './etat/ui.etat';
import { Fenetres } from './fenetres/fenetres';
import { PanneauAvancement } from './panneaux/panneau-avancement';
import { PanneauMarge } from './panneaux/panneau-marge';
import { PanneauPhase } from './panneaux/panneau-phase';
import { PanneauTache } from './panneaux/panneau-tache';
import { ConfirmationFenetre, Toasts } from './ui/messages';

/** Icône de chaque rubrique dans la barre latérale. */
const ICONES: Record<string, NomIcone> = {
  'tableau-de-bord': 'tableau-de-bord',
  workload: 'liste',
  gantt: 'gantt',
  ateliers: 'personnes',
  actions: 'bulle',
  rentabilite: 'tendance',
  'plan-de-charge': 'graphique',
  facturation: 'facture',
  achats: 'panier',
  frais: 'recu',
  fiche: 'fiche',
  synthese: 'camembert',
  profils: 'profil',
  chiffrage: 'calculette',
  planning: 'calendrier',
  metrique: 'regle',
  ventilation: 'repartition',
  parametres: 'reglages',
};

/** Nom des groupes de rubriques dans la barre latérale (vide : groupe sans titre, seulement séparé par un trait). */
const NOMS_GROUPES: Record<string, string> = { pil: 'Pilotage', fin: 'Finances', tsp: 'Vendu (TSP)', set: '' };

/** Regroupements proposés (colonne du WORKLOAD du TSP). */
const REGROUPEMENTS: { cle: 'id' | 'lot' | 'phase'; libelle: string; colonne: string }[] = [
  { cle: 'id', libelle: 'Axe', colonne: 'A' },
  { cle: 'lot', libelle: 'Lot', colonne: 'B' },
  { cle: 'phase', libelle: 'Phase', colonne: 'C' },
];

/**
 * Écran de suivi d'un projet (tout ce qui suit l'import du TSP), sur le modèle de la version de référence (POC v65) :
 * barre projet (nom, période, exports), onglets Pilotage · Finances · TSP · Réglages, bandeaux, onglet affiché,
 * panneau de détail (tâche ou phase) à droite, fenêtres et messages.
 */
@Component({
  selector: 'app-projet-suivi',
  imports: [RouterOutlet, RouterLink, PanneauTache, PanneauPhase, PanneauAvancement, PanneauMarge, Fenetres, Toasts, ConfirmationFenetre],
  providers: [SuiviEtat, UiEtat],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'suivi',
    // le détail de l'avancement, plus large, passe par-dessus la page au lieu de la rétrécir
    '[class.drawer-open]': '!!etat.panneau() && etat.panneau() !== panneauAvancement',
    // détail d'une colonne de la cascade : les cartes de Rentabilité passent sur toute la largeur, à côté du volet
    '[class.rt-volet]': 'etat.panneau()?.startsWith(panneauMarge) ?? false',
    '[class.compact]': 'ui.ui().compact',
    '(click)': 'clic($event)',
    '(document:click)': 'fermerMenus($event)',
    '(document:keydown)': 'clavier($event)',
  },
  template: `
    @if (etat.vue(); as v) {
      <header class="wrap s-entete">
        <nav class="s-ariane" aria-label="Fil d’Ariane">
          <a routerLink="/projets" class="s-retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            Mes projets
          </a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ libelleOnglet() }}</span>
        </nav>
        <div class="s-titre">
          <div class="s-titre-g">
            <div class="s-titre-ligne">
              <h1>{{ nomProjet() }}</h1>
              @if (lectureProjet(); as l) {
                <span class="pastille" [class]="'pastille ' + l.ton" title="Atterrissage comparé à la charge prévue">{{ l.libelle }}</span>
              }
            </div>
            <div class="s-puces">
              @if (v.projet.fiche.reference) {
                <span class="s-puce">{{ v.projet.fiche.reference }}</span>
              }
              @if (v.m.cal.debut) {
                <span class="s-puce">{{ fD(v.m.cal.debut) }} → {{ fD(v.m.cal.finPrevue) }}</span>
              }
              @if ((v.m.cal.glissementJours ?? 0) > 0) {
                <span class="s-puce attention" title="Écart entre la fin prévue et la fin contractuelle">Glissement +{{ v.m.cal.glissementJours }} j</span>
              }
              <span class="s-puce role" [title]="'Votre rôle sur ce projet : ' + v.droits.roleLibelle">{{ v.droits.roleLibelle }}</span>
            </div>
          </div>
          <div class="actions">
            <span class="dirty" [class.clean]="etat.envois() === 0" role="status">{{ etat.envois() ? 'Enregistrement…' : 'Enregistré' }}</span>
            <details class="dd grpdd">
              <summary class="grpbtn" [title]="'Regrouper par… ' + noteRegroupement">
                <svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                  <path d="m3 13 9 5 9-5" />
                </svg>
                <span class="gl2">Regrouper par</span><b>{{ v.dimL }}</b>
                <svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div class="dd-menu" role="menu">
                <div class="dd-h">Regrouper par</div>
                @for (r of regroupements; track r.cle) {
                  <button
                    type="button"
                    class="dd-i dd-btn"
                    [class.is-cur]="v.m.dim.key === r.cle"
                    role="menuitemradio"
                    [attr.aria-checked]="v.m.dim.key === r.cle"
                    [disabled]="!v.droits.peutModifier"
                    (click)="regrouper(r.cle)"
                  >
                    <span class="chk">{{ v.m.dim.key === r.cle ? '✓' : '' }}</span><span [title]="'Colonne ' + r.colonne + ' du WORKLOAD du TSP'">{{ r.libelle }}</span>
                  </button>
                }
                <div class="dd-sep"></div>
                <p class="dd-note">{{ v.droits.peutModifier ? noteRegroupement : 'Réglé par le chef de projet pour toute l’équipe.' }}</p>
              </div>
            </details>
            @if (v.droits.peutExporter) {
              <details class="dd m-export">
                <summary class="btn" title="Exporter un support de comité (Excel)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 4h16v16H4z" />
                    <path d="M4 10h16M10 4v16" />
                  </svg>
                  {{ exportEnCours() ? 'Export…' : 'Exporter' }}
                  <svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div class="dd-menu exp-menu">
                  <button class="dd-i dd-btn" type="button" [disabled]="exportEnCours()" (click)="exporterCopil()">
                    <span><b>COPIL</b><small>Comité de pilotage : trajectoire du forfait, finances, atterrissage</small></span>
                  </button>
                  <button class="dd-i dd-btn" type="button" [disabled]="exportEnCours()" (click)="etat.fenetre.set({ type: 'export-coproj' })">
                    <span><b>COPROJ</b><small>Comité projet : activité depuis le dernier comité, plan d’action, charge de l’équipe</small></span>
                  </button>
                </div>
              </details>
            }
          </div>
        </div>
      </header>

      <main class="wrap s-main">
        @if (avertissements().length) {
          <div class="s-notif attention" role="status">
            <svg class="s-notif-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
            </svg>
            <div class="s-notif-txt">
              <b>{{ avertissements().length }} point{{ avertissements().length > 1 ? 's' : '' }} relevé{{ avertissements().length > 1 ? 's' : '' }} à l’import du TSP</b>
              @if (avertissementsOuverts()) {
                <ul>
                  @for (w of avertissements(); track w) {
                    <li>{{ w }}</li>
                  }
                </ul>
              } @else {
                <span class="muted"> · {{ avertissements()[0] }}</span>
              }
            </div>
            <button class="btn sm ghost" type="button" [attr.aria-expanded]="avertissementsOuverts()" (click)="avertissementsOuverts.set(!avertissementsOuverts())">
              {{ avertissementsOuverts() ? 'Réduire' : 'Voir' }}
            </button>
            <button class="s-notif-x" type="button" aria-label="Masquer ces points" title="Masquer ces points" (click)="masquerAvertissements()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        }
        @if (v.droits.archive) {
          <div class="s-notif attention s-lecture" role="note">
            <svg class="s-notif-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7h18v13H3z" /><path d="M2 3h20v4H2z" /><path d="M10 12h4" />
            </svg>
            <div class="s-notif-txt"><b>Projet archivé</b> · consultation seule.{{ v.droits.estChefDeProjet ? ' Restaurez-le pour reprendre le suivi.' : '' }}</div>
            @if (v.droits.estChefDeProjet) {
              <button type="button" class="btn sm" [disabled]="restauration()" (click)="restaurer()">
                {{ restauration() ? 'Restauration…' : 'Restaurer le projet' }}
              </button>
            }
          </div>
        } @else if (!v.droits.peutModifier) {
          <div class="s-notif info s-lecture" role="note">
            <svg class="s-notif-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
            <div class="s-notif-txt">
              <b>{{ v.droits.roleLibelle }}</b> ·
              {{ v.droits.peutSaisirConsomme ? 'vous pouvez saisir votre consommé (Workload › Saisie du consommé) ; le reste est en lecture seule.' : 'consultation seule.' }}
            </div>
          </div>
        }
        <div class="s-panel" [class]="'s-panel g-' + groupeCourant()">
          <router-outlet />
        </div>
      </main>

      @if (etat.panneau(); as p) {
        @if (p.startsWith('ph:')) {
          <app-panneau-phase [phase]="p.slice(3)" />
        } @else if (p === panneauAvancement) {
          <app-panneau-avancement />
        } @else if (p.startsWith(panneauMarge)) {
          <app-panneau-marge [cle]="p.slice(panneauMarge.length)" />
        } @else {
          <app-panneau-tache [uid]="p" />
        }
      }
      <app-fenetres />
      @if (etat.confirmation(); as c) {
        <app-confirmation [c]="c" />
      }
    } @else if (etat.erreurChargement(); as e) {
      <main class="wrap s-main">
        <div class="banner warn" role="alert">
          <div>{{ e }}</div>
          <a class="btn sm" routerLink="/projets">Mes projets</a>
        </div>
      </main>
    } @else {
      <main class="wrap s-main"><p class="muted">Chargement du suivi…</p></main>
    }
    <app-toasts />
  `,
})
export class ProjetSuivi {
  protected readonly panneauAvancement = PANNEAU_AVANCEMENT;
  protected readonly panneauMarge = PANNEAU_MARGE;
  private readonly projetsApi = inject(ProjetsApi);
  /** Restauration d'un projet archivé en cours (bouton du bandeau). */
  protected readonly restauration = signal(false);
  /** Identifiant du projet, lu dans l'adresse (/projets/:id). */
  readonly id = input.required<string>();
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly router = inject(Router);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly nav = inject(NavigationService);

  protected readonly fD = fD;
  protected readonly regroupements = REGROUPEMENTS;
  protected readonly noteRegroupement = 'Regroupe tâches, graphiques et export COPIL. Enregistré dans le suivi : s’applique aussi à vos collègues.';
  protected readonly exportEnCours = signal(false);
  /** Points relevés à l'import : résumés sur une ligne, dépliables. */
  protected readonly avertissementsOuverts = signal(false);

  /** Onglet affiché (dernier segment de l'adresse). */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e: NavigationEnd) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly onglet = computed(() => this.url().split('?')[0].split('#')[0].split('/').pop() ?? '');
  /** Tâche à ouvrir, indiquée dans l'adresse (?tache=…). */
  private readonly tacheDemandee = computed(() => this.router.parseUrl(this.url()).queryParamMap.get('tache'));

  /** Onglets visibles selon le rôle (les écrans de montants sont réservés à ceux qui les voient). */
  protected readonly groupes = computed(() => {
    const voit = this.etat.vue()?.droits.voitMontants ?? false;
    return ONGLETS.map((g) => ({ ...g, onglets: g.onglets.filter((o) => voit || !o.montants) })).filter((g) => g.onglets.length > 0);
  });

  protected readonly groupeCourant = computed(() => {
    const o = this.onglet();
    return ONGLETS.find((g) => g.onglets.some((x) => x.chemin === o) || g.annexes?.some((x) => x.chemin === o))?.classe ?? 'pil';
  });

  protected readonly annexeCourante = computed(() => ONGLETS.flatMap((g) => g.annexes ?? []).find((a) => a.chemin === this.onglet()) ?? null);

  /** Lecture de l'atterrissage (dans la cible, à surveiller…), avec les mêmes seuils que la page d'accueil. */
  protected readonly lectureProjet = computed(() => {
    const t = this.etat.vue()?.m.total;
    return t && t.prevu > 0 ? lectureAtterrissage(t.ecart, t.prevu) : null;
  });

  /** Libellé de l'onglet affiché (fil d'Ariane). */
  protected readonly libelleOnglet = computed(() => {
    const o = this.onglet();
    if (o === 'point-hebdo') return 'Point hebdo'; // ouvert depuis le tableau de bord, hors barre latérale
    return ONGLETS.flatMap((g) => [...g.onglets, ...(g.annexes ?? [])]).find((x) => x.chemin === o)?.libelle ?? '';
  });

  /** Rubriques du projet pour la barre latérale, avec le nombre de points à traiter de chacune. */
  private readonly navigationProjet = computed<ProjetNavigation | null>(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const o = this.onglet();
    const al = calculerAlertes(v);
    const badges: Record<string, [number, boolean]> = {
      workload: [al.bilansIa.length, false],
      ateliers: [al.ateliers.length + al.livrables.length, al.ateliersRetard + al.livrablesRetard > 0],
      actions: [al.actions.length, al.actionsRetard > 0],
      facturation: [al.echeances.length, al.echeancesRetard > 0],
    };
    const lien = (x: { chemin: string; libelle: string }) => ({
      libelle: x.libelle,
      chemin: x.chemin,
      icone: ICONES[x.chemin] ?? 'fiche',
      actif: o === x.chemin,
      badge: badges[x.chemin]?.[0] ?? 0,
      retard: badges[x.chemin]?.[1] ?? false,
    });
    const groupes: GroupeProjet[] = [];
    for (const g of this.groupes()) {
      // le TSP vendu (et ses annexes) : un seul groupe, replié par défaut, car on le consulte rarement une fois le projet lancé
      const annexes = (g.annexes ?? []).filter((x) => x.chemin !== 'metrique' || this.metriqueUtile() || o === 'metrique');
      const liens = [...g.onglets.map(lien), ...annexes.map((x, k) => ({ ...lien(x), intertitre: k === 0 ? 'Annexes' : undefined }))];
      groupes.push({ libelle: NOMS_GROUPES[g.classe] ?? g.groupe, liens, repliable: g.classe === 'tsp' });
    }
    return { id: this.id(), nom: this.nomProjet(), groupes, ouvrirReperes: () => this.etat.fenetre.set({ type: 'reperes' }) };
  });

  /** Métrique n'a de sens qu'avec une charge « Développement » (projet de réalisation). */
  protected readonly metriqueUtile = computed(() => !!this.etat.vue()?.m.metrique.some((x) => x.propale > 0 && /^d[ée]veloppement/i.test(x.etape)));

  protected readonly nomProjet = computed(() => {
    const f = this.etat.vue()?.projet.fiche;
    return [f?.client, f?.projet].filter(Boolean).join(' — ') || 'Projet sans nom';
  });

  /** Points relevés à l'import, sauf ceux masqués sur ce poste et le point « sans axe » devenu sans objet. */
  protected readonly avertissements = computed(() => {
    const v = this.etat.vue();
    if (!v) return [];
    const sansAxeOk = !v.m.vigilance.some((x) => x.cle === 'sansAxe' && x.niveau !== 'ok');
    const masques = this.ui.ui().dismissed;
    return v.projet.warnings.filter((w) => !masques[w] && !(sansAxeOk && /sans axe/i.test(w)));
  });

  constructor() {
    // la barre latérale affiche les rubriques du projet ouvert, tant que cet écran est affiché
    effect(() => this.nav.projetOuvert.set(this.navigationProjet()));
    inject(DestroyRef).onDestroy(() => this.nav.projetOuvert.set(null));
    effect(() => {
      const id = this.id();
      untracked(() => void this.etat.charger(id));
    });
    // écran de montants ouvert par son adresse (lien copié, favori) par un rôle qui ne les voit pas :
    // retour au tableau de bord (les montants ne sont de toute façon pas envoyés par le serveur).
    effect(() => {
      const v = this.etat.vue();
      const o = this.onglet();
      if (!v || v.droits.voitMontants) return;
      if (ONGLETS.some((g) => g.onglets.some((x) => x.chemin === o && x.montants))) {
        untracked(() => void this.router.navigate(['/projets', this.id(), 'tableau-de-bord'], { replaceUrl: true }));
      }
    });
    // tâche demandée par l'adresse (lien depuis « Mon travail » : ?tache=r12) : son détail s'ouvre une fois le suivi chargé
    effect(() => {
      const v = this.etat.vue();
      const demandee = this.tacheDemandee();
      if (!v || !demandee) return;
      untracked(() => {
        if (v.parUid.has(demandee)) this.etat.ouvrirTache(demandee);
        void this.router.navigate([], { queryParams: { tache: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
    // le détail d'une colonne de la cascade ne concerne que Rentabilité : il se referme quand on change d'écran
    effect(() => {
      const o = this.onglet(), p = this.etat.panneau();
      if (o !== 'rentabilite' && p?.startsWith(PANNEAU_MARGE)) untracked(() => this.etat.fermerPanneau());
    });
    // élément créé (ou demandé depuis un autre onglet) : mis en évidence, et son libellé prêt à être saisi.
    // L'onglet peut être en cours de chargement : on réessaie quelques fois.
    effect(() => {
      const cible = this.etat.ligneEnEvidence();
      if (!cible) return;
      let essais = 0;
      const chercher = () => {
        const racine = this.hote.nativeElement;
        const champ = racine.querySelector<HTMLInputElement>(`[data-lib="${CSS.escape(cible)}"]`);
        const ligne =
          champ?.closest('tr') ??
          racine.querySelector(`tr[data-row="${CSS.escape(cible)}"]`) ??
          racine.querySelector(`.s-panel [data-open="${CSS.escape(cible)}"]`)?.closest('tr');
        if (!ligne && ++essais < 20) {
          setTimeout(chercher, 100);
          return;
        }
        if (ligne) {
          ligne.scrollIntoView({ block: 'center' });
          ligne.classList.add('flash');
          setTimeout(() => ligne.classList.remove('flash'), 1800);
        }
        champ?.focus();
        this.etat.ligneEnEvidence.set(null);
      };
      setTimeout(chercher, 50);
    });
  }

  /** Restaure le projet archivé depuis le bandeau (sans confirmation : rien n'est perdu, et l'archivage se refait à tout moment). */
  protected async restaurer(): Promise<void> {
    this.restauration.set(true);
    try {
      await firstValueFrom(this.projetsApi.archiver(this.etat.projetId(), false));
      this.nav.projets.set(null);
      await this.etat.recharger();
      this.etat.afficher('Projet restauré : le suivi reprend.', 'succes');
    } catch (e) {
      this.etat.afficher(messageErreur(e), 'erreur');
    } finally {
      this.restauration.set(false);
    }
  }

  /** Clic n'importe où dans l'écran : ouverture du détail d'une tâche (data-open) ou d'une phase (data-openph). */
  protected clic(e: Event): void {
    const cible = e.target instanceof Element ? e.target : null;
    if (!cible) return;
    const ph = cible.closest<HTMLElement>('[data-openph]');
    if (ph?.dataset['openph'] != null) {
      e.preventDefault();
      this.etat.ouvrirPhase(ph.dataset['openph']);
      return;
    }
    const t = cible.closest<HTMLElement>('[data-open]');
    if (t?.dataset['open']) {
      e.preventDefault();
      this.etat.ouvrirTache(t.dataset['open']);
    }
  }

  /** Les menus déroulants se referment dès qu'on clique ailleurs (ou sur un de leurs choix). */
  protected fermerMenus(e: Event): void {
    const cible = e.target instanceof Node ? e.target : null;
    this.hote.nativeElement.querySelectorAll<HTMLDetailsElement>('details.dd[open]').forEach((d) => {
      const choix = cible instanceof Element && d.contains(cible) && !!cible.closest('.dd-btn');
      if (!cible || !d.contains(cible) || choix) d.open = false;
    });
  }

  /** Échap ferme le panneau de détail (si aucune fenêtre n'est ouverte). */
  protected clavier(e: Event): void {
    if (e instanceof KeyboardEvent && e.key === 'Escape' && this.etat.panneau() && !this.etat.fenetre() && !this.etat.confirmation()) {
      const actif = document.activeElement;
      if (actif instanceof HTMLElement && actif.closest('.dr-title')) return; // l'intitulé gère sa propre touche Échap
      e.preventDefault(); // la touche a servi : la saisie agrandie, par exemple, ne se referme pas en même temps
      this.etat.fermerPanneau();
    }
  }

  protected masquerAvertissements(): void {
    const v = this.etat.vue();
    if (!v) return;
    const dismissed = { ...this.ui.ui().dismissed };
    for (const w of v.projet.warnings) dismissed[w] = true;
    this.ui.maj({ dismissed });
  }

  protected async regrouper(cle: 'id' | 'lot' | 'phase'): Promise<void> {
    const v = this.etat.vue();
    if (!v || v.m.dim.key === cle) return;
    const r = await this.etat.saisir((id) => this.api.regroupement(id, cle));
    if (r) this.ui.maj({ axe: '' });
  }

  /** Export COPIL : le fichier est téléchargé ; une photo des indicateurs est ajoutée à l'historique. */
  protected async exporterCopil(): Promise<void> {
    this.exportEnCours.set(true);
    try {
      const reponse = await firstValueFrom(this.api.copil(this.etat.projetId()));
      telecharger(reponse, 'COPIL.xlsx');
      await this.etat.recharger();
      this.etat.afficher(
        this.etat.vue()?.droits.peutModifier
          ? 'Export COPIL généré. Une photo des indicateurs est ajoutée à l’historique.'
          : 'Export COPIL généré.',
        'succes',
      );
    } catch (e) {
      this.etat.afficher(await messageErreurFichier(e), 'erreur');
    } finally {
      this.exportEnCours.set(false);
    }
  }
}
