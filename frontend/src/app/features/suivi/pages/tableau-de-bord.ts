import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Action, PointVigilance } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { calculerAlertes } from '../etat/alertes';
import { estFinancier } from '../etat/vigilance';
import { fD, fJ, fP, fSigned, largeur, sgn } from '../etat/formats';
import { SuiviEtat } from '../etat/suivi.etat';
import { EtatUi, UiEtat } from '../etat/ui.etat';
import { atHoraire } from '../etat/vue';
import { Fx } from '../ui/fx';
import { GraphiqueAxes, GraphiqueMois } from '../ui/graphiques';
import { Barre } from '../ui/petits';

/** Un élément de la liste « À traiter », quelle que soit sa nature. */
interface ElementATraiter {
  cle: string;
  niveau: 'crit' | 'warn' | 'info' | 'ia';
  quand: string;
  genre: string;
  titre: string;
  sous: string;
  /** Tâche dont le détail s'ouvre au clic. */
  uid?: string;
  /** Écran (et réglages) où l'élément se traite. */
  onglet?: [string, Partial<EtatUi>];
  action?: { libelle: string; titre: string; faire?: () => void; ouvrir?: string };
}

/** Ordre d'affichage : en retard, puis aujourd'hui, puis bilans IA, puis à venir. */
const RANG: Record<ElementATraiter['niveau'], number> = { crit: 0, warn: 1, ia: 2, info: 3 };

/**
 * Tableau de bord du projet (version de référence) : à traiter, période, charges, finances, évolutions du périmètre,
 * graphiques, historique des comités, suivi par type, points de vigilance, atterrissage, planning, optimisation IA.
 */
@Component({
  selector: 'app-tableau-de-bord',
  imports: [RouterLink, Fx, GraphiqueAxes, GraphiqueMois, Barre],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vue(); as v) {
      @let t = v.m.total;
      @let c = v.m.cal;
      <div class="tdb-tete">
        <h2>Tableau de bord</h2>
        <span class="tdb-date">Situation au {{ fD(v.aujourdhui) }} <app-fx cle="tuiles" /></span>
        @if (v.droits.voitMontants) {
          <span class="tdb-tete-actions">
            <a class="btn sm" routerLink="../point-hebdo" title="La diapositive PowerPoint du point de suivi de la semaine, à ajouter au support de l’entreprise">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4M7 13l3-3 2 2 4-4" />
              </svg>
              Revue bimensuelle (PowerPoint)
            </a>
          </span>
        }
      </div>

      <!-- dates manquantes -->
      @if (!c.debut || !c.finPrevue) {
        <div class="s-notif attention" role="status">
          <div class="s-notif-txt"><b>Dates du projet manquantes.</b> Renseignez le début et la fin dans ⚙ Paramètres du projet pour ajuster le planning.</div>
          <a class="btn sm" routerLink="../parametres">Renseigner les dates</a>
        </div>
      }

      <!-- les 3 indicateurs essentiels : l'état du projet en quelques secondes (l'avancement est dans « Avancement par axe ») -->
      <div class="kpis essentiels">
        <div class="kpi">
          <div class="l">Atterrissage</div>
          <div class="v">{{ fJ(t.atterrissage) }}<small>JH</small></div>
          <div class="s">
            <span [class]="'ecart-badge ' + sgn(t.ecart)">{{ fSigned(t.ecart) }} JH</span>sur {{ fJ(t.prevu) }} JH prévus
            @if (t.ajout || t.annule) {
              <span class="tdb-ligne2">{{ fSigned(t.atterrissage - t.prevuTSP) }} JH par rapport au TSP vendu</span>
            }
          </div>
        </div>
        <div class="kpi">
          <div class="l">Reste à faire</div>
          <div class="v">{{ fJ(t.raf) }}<small>JH</small></div>
          <div class="s">Charge restante pour terminer · {{ t.n - t.valides }} tâche{{ t.n - t.valides > 1 ? 's' : '' }} non validée{{ t.n - t.valides > 1 ? 's' : '' }}</div>
        </div>
        <div class="kpi">
          <div class="l">Fin prévue</div>
          <div class="v">{{ c.finPrevue ? fD(c.finPrevue) : '—' }}</div>
          <div class="s">
            @if ((c.glissementJours ?? 0) > 0) {
              <span class="ecart-badge attention">+{{ c.glissementJours }} j</span>
            } @else if ((c.glissementJours ?? 0) < 0) {
              <span class="ecart-badge pos">Avance {{ -(c.glissementJours ?? 0) }} j</span>
            }
            @if (c.joursRestants != null) {
              {{ c.joursRestants }} jours ouvrés restants
            }
          </div>
        </div>
      </div>

      <!-- ce qui demande une action, et ce qu'il faut surveiller -->
      <div class="s-grille">
        <section class="tdb-carte c-7" aria-labelledby="tdb-todo">
          <header>
            <h2 id="tdb-todo">
              À traiter
              @if (aTraiter().length) {
                <span class="compteur-rond" [style.background]="retardTotal() ? null : 'var(--c-neutre-fond)'" [style.color]="retardTotal() ? null : 'var(--c-texte)'">{{ aTraiter().length }}</span>
              }
            </h2>
            @if (retardTotal()) {
              <span class="tdb-resume"><b>{{ retardTotal() }}</b> en retard</span>
            }
          </header>
          @if (aTraiter().length) {
            <div class="tdb-liste">
              @for (x of aTraiterVisibles(); track x.cle) {
                <div class="tdb-item">
                  <span class="tdb-quand" [class]="'tdb-quand ' + x.niveau">{{ x.quand }}</span>
                  <span class="tdb-texte">
                    <span class="tdb-titre">
                      <span class="tdb-genre">{{ x.genre }}</span>
                      @if (x.uid) {
                        <button type="button" class="tlink" [attr.data-open]="x.uid">{{ x.titre }}</button>
                      } @else if (x.onglet) {
                        <button type="button" class="tlink" (click)="aller(x.onglet[0], x.onglet[1])">{{ x.titre }}</button>
                      } @else {
                        {{ x.titre }}
                      }
                    </span>
                    <span class="tdb-sous" [title]="x.sous">{{ x.sous }}</span>
                  </span>
                  @if (x.action; as a) {
                    @if (a.ouvrir) {
                      <button type="button" class="btn sm" [attr.data-open]="a.ouvrir" [title]="a.titre">{{ a.libelle }}</button>
                    } @else {
                      <button type="button" class="btn sm" [title]="a.titre" (click)="a.faire?.()">{{ a.libelle }}</button>
                    }
                  } @else {
                    <span></span>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="tdb-vide">Rien à traiter pour le moment.</p>
          }
          <footer>
            <span>Éléments en retard ou proches de leur date · délais réglables dans <a routerLink="../parametres">⚙ Paramètres du projet</a></span>
            @if (aTraiter().length > maxTodo) {
              <button type="button" class="btn sm ghost" (click)="todoOuvert.set(!todoOuvert())">
                {{ todoOuvert() ? 'Réduire' : 'Afficher les ' + aTraiter().length }}
              </button>
            }
          </footer>
        </section>

        <div class="c-5 tdb-col">
          @let vg = vigilance();
          @let nCrit = nbCritiques();
          <section class="tdb-carte tdb-vig" aria-labelledby="tdb-vig-t" [style.display]="afficherPointsDeVigilance ? null : 'none'">
            <details class="vig-plie" [open]="ui.ui().vigOuverte" (toggle)="basculerVigilance($event)">
              <summary>
                <span id="tdb-vig-t" class="vig-titre">Points de vigilance</span>
                <span class="vig-resume">
                  @if (vg.ko.length) {
                    @if (nCrit) {
                      <span class="pill lv-critique">{{ nCrit }} critique{{ nCrit > 1 ? 's' : '' }}</span>
                    }
                    @if (vg.ko.length - nCrit) {
                      <span class="pill lv-attention">{{ vg.ko.length - nCrit }} à surveiller</span>
                    }
                  } @else {
                    <span class="pill lv-ok">Tout est au vert</span>
                  }
                  <span class="vig-ouvrir"><span class="vo-o">Voir le détail ›</span><span class="vo-f">Réduire</span></span>
                </span>
              </summary>
              <p class="sub">{{ vg.ko.length ? vg.ko.length + ' point(s) à surveiller, calculés à chaque saisie.' : 'Tout est au vert.' }} <app-fx cle="vigilance" /></p>
              <div class="vig">
                @for (p of vg.ko; track p.cle) {
                  <div class="row">
                    <span>{{ p.label }}</span><span class="pill" [class]="'pill lv-' + p.niveau">{{ valeurVigilance(p) }}</span>
                    @if (p.detail) {
                      <small>{{ p.detail }}</small>
                    }
                  </div>
                }
              </div>
              @if (vg.ok.length) {
                <details class="vig-ok">
                  <summary>{{ vg.ok.length }} indicateur(s) au vert</summary>
                  <div class="vig">
                    @for (p of vg.ok; track p.cle) {
                      <div class="row">
                        <span>{{ p.label }}</span><span class="pill lv-ok">{{ valeurVigilance(p) }}</span>
                      </div>
                    }
                  </div>
                </details>
              }
            </details>
          </section>
          <section class="tdb-carte" aria-labelledby="tdb-livrables">
            <header>
              <h2 id="tdb-livrables">Livrables et ateliers <app-fx cle="livrables" /></h2>
              <span class="tdb-resume">Réalisé = statut « Validé »</span>
            </header>
            @for (x of v.m.ateliers.parType; track x.id) {
              <div class="tdb-type">
                <div class="tdb-type-l">
                  <span class="tdb-type-nom">{{ x.nom }}</span>
                  <span class="tdb-type-n"><b>{{ x.realises }}</b> / {{ x.prevus }} réalisés{{ x.restants ? ' · ' + x.restants + ' restant' + (x.restants > 1 ? 's' : '') : '' }}</span>
                </div>
                <app-barre [valeur]="x.taux" classe="ok" />
              </div>
            } @empty {
              <p class="tdb-vide">Aucun type de tâche suivi. Les types se gèrent dans <a routerLink="../parametres">⚙ Paramètres du projet</a>.</p>
            }
            <footer><a routerLink="../ateliers">Voir les ateliers et livrables →</a></footer>
          </section>
        </div>
      </div>

      <!-- avancement par axe, pleine largeur -->
      <div class="s-grille">
        <section class="tdb-carte c-12" aria-labelledby="tdb-axes">
          <header>
            <h2 id="tdb-axes">Avancement par {{ v.dimLl }} <app-fx cle="atter" /></h2>
            <span class="tdb-entete-droite">
              <span class="tdb-resume">Tâches validées et suivi de la charge</span>
              <button type="button" class="btn sm tdb-imprimer" (click)="etat.ouvrirAvancement()" title="Avancement détaillé et charges, dans le panneau de droite">Détail ›</button>
            </span>
          </header>
          <div>
            @for (a of v.m.axes; track a.id + $index; let k = $index) {
              @let couleur = 'var(--ax' + (k % 8) + ')';
              @let consoPct = a.prevu ? a.conso / a.prevu : 0;
              <div class="tdb-axe tdb-axe2">
                @if (v.m.dim.key === 'phase' && a.id) {
                  <button type="button" class="nom nom-lien" [attr.data-openph]="a.id" [title]="'Ouvrir la phase ' + a.nom"
                    ><span class="puce" [style.background]="couleur"></span><span>{{ a.nom }}</span></button
                  >
                } @else {
                  <span class="nom" [title]="a.nom"><span class="puce" [style.background]="couleur"></span><span>{{ a.nom }}</span></span>
                }
                <span class="barres">
                  <span class="tdb-b-l"><span>Avancement</span><small>{{ a.valides }} / {{ a.actives }} tâche{{ a.actives > 1 ? 's' : '' }} validée{{ a.actives > 1 ? 's' : '' }}</small></span>
                  <span class="bar" [title]="'Avancement : JH des tâches validées ÷ JH prévus = ' + fP(a.avancement || 0)"><i [style.width]="largeur(a.avancement || 0)" [style.background]="couleur"></i></span>
                  <span class="tdb-b-l tdb-b-charge"><span>Suivi de la charge</span><small>{{ fJ(a.conso) }} JH consommés · atterrissage {{ fJ(a.atterrissage) }} JH</small></span>
                  <span class="bar tdb-conso" [title]="'Consommé ÷ prévu = ' + fP(consoPct)"><i [style.width]="largeur(consoPct)"></i></span>
                </span>
                <span class="pct" title="Avancement : JH des tâches validées ÷ JH prévus">{{ fP(a.avancement || 0) }}</span>
                @if (a.ecart > 0.001) {
                  <span class="pill st-bloque" title="Atterrissage supérieur au prévu : dépassement anticipé ou constaté.">Dépassement</span>
                } @else if (a.ecart < -0.001) {
                  <span class="pill st-valide" title="Atterrissage inférieur au prévu : gain (tâches finies sous le budget, enveloppe IA non consommée…).">Optimisation</span>
                } @else {
                  <span class="pill tdb-conforme" title="Atterrissage = prévu.">Conforme</span>
                }
              </div>
            }
          </div>
        </section>
      </div>

      <!-- graphiques -->
      <section class="card">
        <header>
          <div>
            <h2>Charges & projection mensuelle</h2>
            <p>Survolez une barre ou un mois pour le détail. <app-fx cle="mensuel" /></p>
          </div>
        </header>
        <div class="grid2 charts2">
          <div class="subchart">
            <h3>Prévu, consommé et atterrissage par {{ v.dimLl }}</h3>
            <app-graphique-axes [axes]="v.m.axes" [dimension]="v.dimLl" />
          </div>
          <div class="subchart">
            <h3>Charge mensuelle — prévisionnel et consommé saisi</h3>
            <app-graphique-mois [mensuel]="v.m.mensuel" [moisCourant]="v.moisCourant" [replanifie]="!!v.m.replanifie" />
          </div>
        </div>
        <p class="caption">
          @let ecartRef = t.prevu - v.m.refTotal;
          Prévisionnel de charge : <b>{{ fJ(v.m.refTotal) }} JH</b> ventilés sur <b>{{ fJ(t.prevu) }} JH</b> prévus
          @if (abs(ecartRef) > 0.001) {
            — {{ fJ(abs(ecartRef)) }} JH {{ ecartRef > 0 ? 'restent à placer' : 'de trop' }} @if (v.droits.voitMontants) {
              (<a class="linkbtn" routerLink="../plan-de-charge" (click)="ui.maj({ pc: 'prev' })">Plan de charge › Prévisionnel</a>)
            }
          }
          · TSP vendu : {{ fJ(v.m.tspTotal ?? v.m.refTotal) }} JH{{ v.m.replanifie ? ' (différent du prévisionnel, en pointillé)' : '' }} ·
          <a class="linkbtn" routerLink="../planning">voir Annexes › Planning</a>.
        </p>
      </section>

    }
  `,
})
export class TableauDeBord {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly vue = this.etat.vue;
  /** Gardée calculée pour les exports, masquée dans le tableau de bord selon la revue du 21/10. */
  protected readonly afficherPointsDeVigilance = false;

  protected readonly fD = fD;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly sgn = sgn;
  protected readonly largeur = largeur;
  protected readonly abs = Math.abs;

  protected readonly alertes = computed(() => {
    const v = this.vue();
    return v
      ? calculerAlertes(v)
      : { actions: [], actionsRetard: 0, ateliers: [], ateliersRetard: 0, ateliersSansDate: 0, livrables: [], livrablesRetard: 0, echeances: [], echeancesRetard: 0, bilansIa: [] };
  });

  /** Nombre d'éléments « À traiter » affichés avant « Afficher tout ». */
  protected readonly maxTodo = 6;
  protected readonly todoOuvert = signal(false);

  /** Liste « À traiter » unique : actions, ateliers, livrables, échéances et bilans IA, les plus urgents d'abord. */
  protected readonly aTraiter = computed<ElementATraiter[]>(() => {
    const v = this.vue();
    if (!v) return [];
    const al = this.alertes();
    const modif = v.droits.peutModifier;
    const liste: ElementATraiter[] = [];
    for (const x of al.actions) {
      const a = x.action;
      liste.push({
        cle: 'a-' + a.id,
        niveau: x.niveau,
        quand: x.quand,
        genre: 'Action',
        titre: `${a.ref} · ${a.libelle || '(sans libellé)'}`,
        sous: `${a.porteur || 'sans responsable'} · date cible ${fD(a.echeance)}`,
        onglet: ['actions', { ad: 'actions', adf: 'ouvertes' }],
        action: modif ? { libelle: '✓ Fait', titre: 'Marquer l’action comme faite', faire: () => this.actionFaite(a) } : undefined,
      });
    }
    for (const x of al.ateliers) {
      const t = x.tache;
      const nParticipants = t.tr.atelier?.dest?.length ?? 0;
      const h = atHoraire(t);
      liste.push({
        cle: 'at-' + t.uid,
        niveau: x.niveau,
        quand: x.quand,
        genre: 'Atelier',
        titre: t.label,
        uid: t.uid,
        sous: `${fD(t.tr.atelier?.date)}${h ? ' · ' + h : ''} · ${nParticipants ? nParticipants + ' participant(s)' : 'aucun participant'}`,
        action: x.passe
          ? { libelle: 'Replanifier / valider', titre: 'Date passée : replanifiez l’atelier ou validez-le s’il a eu lieu', ouvrir: t.uid }
          : modif
            ? { libelle: '✓ Invitation envoyée', titre: 'Indiquer que l’invitation est partie aujourd’hui', faire: () => this.invitationEnvoyee(t.uid) }
            : undefined,
      });
    }
    for (const x of al.livrables) {
      const t = x.tache;
      liste.push({
        cle: 'lv-' + t.uid,
        niveau: x.niveau,
        quand: x.quand,
        genre: 'Livrable',
        titre: t.label,
        uid: t.uid,
        sous: `Livraison prévue le ${fD(t.tr.fin)}${t.responsable ? ' · ' + t.responsable : ''}`,
      });
    }
    if (v.droits.voitMontants) {
      for (const x of al.echeances) {
        const e = x.echeance;
        liste.push({
          cle: 'e-' + e.n,
          niveau: x.etat === 'crit' ? 'crit' : x.etat === 'warn' ? 'warn' : 'info',
          quand: x.quand,
          genre: 'Facturation',
          titre: `Échéance n° ${e.n}`,
          sous: `${e.nom} · prévue le ${fD(e.datePrevue)}`,
          onglet: ['facturation', {}],
          action: modif ? { libelle: '✓ Facturée', titre: 'Indiquer que la facture est émise aujourd’hui', faire: () => this.echeanceFacturee(e.n) } : undefined,
        });
      }
    }
    for (const t of al.bilansIa) {
      liste.push({
        cle: 'ia-' + t.uid,
        niveau: 'ia',
        quand: 'À justifier',
        genre: 'Bilan IA',
        titre: t.label,
        uid: t.uid,
        sous: `Écart sur l’enveloppe IA : ${fSigned(t.iaRes ?? 0)} JH, sans commentaire`,
        action: modif ? { libelle: 'Faire le bilan', titre: 'Expliquer l’écart sur l’enveloppe IA', faire: () => this.etat.fenetre.set({ type: 'bilan-ia', uid: t.uid }) } : undefined,
      });
    }
    return liste.map((x, i) => ({ x, i })).sort((p, q) => RANG[p.x.niveau] - RANG[q.x.niveau] || p.i - q.i).map((p) => p.x);
  });
  protected readonly aTraiterVisibles = computed(() => (this.todoOuvert() ? this.aTraiter() : this.aTraiter().slice(0, this.maxTodo)));
  protected readonly retardTotal = computed(() => this.aTraiter().filter((x) => x.niveau === 'crit').length);

  protected readonly vigilance = computed(() => {
    // les points sur l'argent sont dans Rentabilité : le tableau de bord ne montre aucun montant
    const l = (this.vue()?.m.vigilance ?? []).filter((p) => !estFinancier(p));
    // les points critiques d'abord, puis ceux à surveiller (ordre du moteur conservé à niveau égal)
    const ko = l.filter((p) => p.niveau !== 'ok').map((p, i) => ({ p, i }));
    ko.sort((a, b) => (a.p.niveau === 'critique' ? 0 : 1) - (b.p.niveau === 'critique' ? 0 : 1) || a.i - b.i);
    return { ko: ko.map((x) => x.p), ok: l.filter((p) => p.niveau === 'ok') };
  });
  protected readonly nbCritiques = computed(() => this.vigilance().ko.filter((p) => p.niveau === 'critique').length);

  /** Points de vigilance repliés par défaut : l'état ouvert / fermé est gardé pendant la session. */
  protected basculerVigilance(e: Event): void {
    const ouvert = (e.target as HTMLDetailsElement).open;
    if (ouvert !== this.ui.ui().vigOuverte) this.ui.maj({ vigOuverte: ouvert });
  }

  protected valeurVigilance(p: PointVigilance): string {
    if (p.unite) return fJ(+p.valeur) + ' ' + p.unite;
    return String(p.valeur);
  }

  /** Va sur un autre onglet en réglant ses filtres. */
  protected aller(onglet: string, reglages: Partial<EtatUi>): void {
    this.ui.maj(reglages);
    void this.router.navigate(['..', onglet], { relativeTo: this.route });
    window.scrollTo(0, 0);
  }

  protected actionFaite(a: Action): void {
    const avant = { statut: a.statut, progression: a.progression, faitLe: a.faitLe };
    void this.etat.saisir((id) => this.api.modifier(id, 'actions', a.id, { champ: 'statut', valeur: 'Fait', version: this.etat.versionLigne('actions', a.id) }), {
      siSucces: () =>
        this.etat.afficher(`${a.ref} marquée « Fait ».`, 'succes', {
          libelle: 'Annuler',
          executer: () => void this.etat.saisir((id) => this.api.restaurerAction(id, a.id, avant.statut, avant.progression, avant.faitLe)),
        }),
    });
  }

  protected invitationEnvoyee(uid: string): void {
    void this.etat.saisir((id) => this.api.invitation(id, uid, true), {
      annuler: { libelle: 'Annuler', executer: () => void this.etat.saisir((id) => this.api.invitation(id, uid, false)) },
    });
  }

  protected echeanceFacturee(n: number): void {
    const v = this.vue();
    if (!v) return;
    void this.etat.saisir((id) => this.api.dateEcheance(id, n, 'realiseLe', v.aujourdhui, this.etat.versionEcheance(n)));
  }
}
