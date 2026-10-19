import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icone } from '../../../shared/ui/icone';
import { Statistiques } from '../api/modeles';
import {
  nomFichierAvancement,
  presentationAvancement,
  sousVisibles,
  toutDeplier,
  vueAvancement,
  xy,
} from '../etat/avancement-detail.logique';
import { telechargerFichier } from '../etat/fichiers';
import { fDi, fJ, fP, fSigned, sgn, stSlug } from '../etat/formats';
import { chargerPptxGen } from '../etat/point-hebdo.chargement';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { axeName, TacheVue, typeName } from '../etat/vue';
import { Fx } from '../ui/fx';
import { Barre } from '../ui/petits';
import { LienTache, Statut } from '../ui/tache';

/** Explication de chaque statut d'un périmètre (infobulle de l'étiquette). */
const AIDE_STATUT: Record<string, string> = {
  'À faire': 'Aucune tâche démarrée (ni statut, ni consommé).',
  'En cours': 'Au moins une tâche démarrée ou validée, mais pas toutes.',
  'En recette': 'Au moins une tâche en recette.',
  'Bloqué / En attente': 'Au moins une tâche bloquée : prioritaire sur les autres statuts.',
  Validé: 'Toutes les tâches du périmètre sont validées.',
};

/**
 * Détail de l'avancement (tableau de bord › « Détail › ») : panneau large, par-dessus la page.
 * Accordéon par axe, lot ou phase, puis par sous-partie (lot, ou phase quand on regroupe par lot), puis par tâche ;
 * filtre « Ateliers et livrables seulement » ; « Exporter en PowerPoint » reprend ce qui est déplié ;
 * puis le tableau « Charges et atterrissage » avec le total. Uniquement des jours (JH), aucun montant : visible par tous les rôles.
 * Traduction de 52f-avancement.js (version HTML de référence).
 */
@Component({
  selector: 'app-panneau-avancement',
  imports: [NgTemplateOutlet, Barre, Fx, Icone, LienTache, Statut],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vue(); as v) {
      @let parPhase = v.m.dim.key === 'phase';
      @let V = arbre();
      @let nomSous = V.cle === 'lot' ? 'lots' : 'phases';
      <aside class="drawer large av-volet" aria-label="Avancement détaillé" style="--axc: var(--accent)">
        <div class="dr-head">
          <div class="dr-nav">
            <span class="dr-kind">Tableau de bord</span><span class="spacer"></span
            ><button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
          </div>
          <h2 class="dr-title">Avancement par {{ v.dimLl }} — détail</h2>
          <div class="dr-meta">En jours-homme (JH). « Exporter en PowerPoint » reprend ce qui est déplié.</div>
        </div>
        <div class="dr-body">
          <div class="toolbar av-outils">
            <button type="button" class="btn sm bascule" [attr.aria-pressed]="V.seul" title="N’afficher que les tâches de type Atelier ou Livrable" (click)="basculerFiltre()">
              {{ V.seul ? '✓ ' : '' }}Ateliers et livrables seulement
            </button>
            <button type="button" class="btn sm" (click)="toutBasculer(V.tousOuverts)">{{ V.tousOuverts ? 'Tout replier' : 'Tout déplier' }}</button>
            <button
              type="button"
              class="av-switch"
              role="switch"
              [attr.aria-checked]="V.avecSous"
              [title]="V.avecSous ? 'Masquer les ' + nomSous + ' : les tâches s’affichent directement sous chaque ' + v.dimLl : 'Afficher les ' + nomSous + ' entre chaque ' + v.dimLl + ' et ses tâches'"
              (click)="basculerSous()"
            >
              <span class="av-switch-piste" aria-hidden="true"><span class="av-switch-bouton"></span></span>Afficher les {{ nomSous }}
            </button>
            <span class="spacer"></span>
            <button type="button" class="btn sm" title="Fabrique un PowerPoint (16:9) avec ce qui est déplié" [disabled]="occupe()" (click)="exporter()">
              <app-icone nom="fiche" [taille]="15" [epaisseur]="2" /> Exporter en PowerPoint
            </button>
          </div>

          <div class="av-arbre" role="table" aria-label="Avancement détaillé">
            <div class="av-ligne av-entete" role="row">
              <span class="av-nom">{{ v.m.dim.label }} › {{ V.avecSous ? (V.cle === 'lot' ? 'lot › ' : 'phase › ') : '' }}tâche</span>
              <span class="av-c">Avancement</span><span class="av-c n">Consommé / prévu</span><span class="av-c n">Écart</span
              ><span class="av-c n">Validées · ateliers · livrables</span><span class="av-c">Statut</span>
            </div>
            @for (g of V.groupes; track g.cle) {
              <div class="av-g" [class.ouvert]="g.ouvert" [class.av-direct]="!V.avecSous" [style.--axc]="'var(--ax' + g.couleur + ')'">
                <div class="av-ligne av-niv1" role="row">
                  <span class="av-nom">
                    <ng-container *ngTemplateOutlet="bascule; context: { cle: g.cle, nom: g.nom, ouvert: g.ouvert, n: g.nT + ' tâche' + (g.nT > 1 ? 's' : '') }" />
                    @if (parPhase && g.id) {
                      <button type="button" class="av-ph linkbtn" [title]="'Ouvrir la phase ' + g.id" (click)="ouvrirPhase(g.id)">Phase ›</button>
                    }
                  </span>
                  <ng-container *ngTemplateOutlet="chiffres; context: { $implicit: g.stat }" />
                </div>
                @if (g.ouvert) {
                  @if (V.avecSous) {
                    @for (sp of g.sous; track sp.cle) {
                      <div class="av-s" [class.ouvert]="sp.ouvert">
                        <div class="av-ligne av-niv2" role="row">
                          <span class="av-nom">
                            <ng-container *ngTemplateOutlet="bascule; context: { cle: sp.cle, nom: sp.nom, ouvert: sp.ouvert, n: sp.vis.length + ' tâche' + (sp.vis.length > 1 ? 's' : '') }" />
                          </span>
                          <ng-container *ngTemplateOutlet="chiffres; context: { $implicit: sp.stat }" />
                        </div>
                        @if (sp.ouvert) {
                          @for (x of sp.vis; track x.uid) {
                            <ng-container *ngTemplateOutlet="tache; context: { $implicit: x }" />
                          }
                        }
                      </div>
                    }
                  } @else {
                    @for (x of g.taches; track x.uid) {
                      <ng-container *ngTemplateOutlet="tache; context: { $implicit: x }" />
                    }
                  }
                }
              </div>
            } @empty {
              <p class="muted av-vide">
                Aucune tâche de type Atelier ou Livrable.
                <button type="button" class="btn sm" (click)="basculerFiltre()">Afficher toutes les tâches</button>
              </p>
            }
            <div class="av-ligne av-total" role="row">
              <span class="av-nom">Projet</span>
              <ng-container *ngTemplateOutlet="chiffres; context: { $implicit: v.m.total }" />
            </div>
          </div>
          <p class="sub av-note">
            Avancement = JH des tâches validées ÷ JH prévus : une tâche compte quand elle est validée, au poids de sa charge (l’avancement déclaré dans Workload est
            rappelé à titre indicatif). Validées · ateliers · livrables : validés / prévus. Écart : ▲ dépassement, ▼ économie. Les chiffres d’un groupe portent sur
            toutes ses tâches, même filtrées.
          </p>

          <div class="av-synth">
            <section>
              <h3 class="av-titre">Charges et atterrissage <app-fx cle="atter" /></h3>
              <div class="tw">
                <table class="av-table">
                  <thead>
                    <tr>
                      <th>{{ v.m.dim.label }}</th>
                      <th class="n">Prévu</th>
                      <th class="n">Consommé</th>
                      <th class="n">RAF</th>
                      <th class="n">Atterrissage</th>
                      <th class="n">Écart</th>
                      <th class="av-barre">Consommation</th>
                      <th>Projection</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of v.m.axes; track a.id + $index) {
                      <tr>
                        <td class="av-nom">
                          @if (parPhase && a.id) {
                            <button type="button" class="av-lien" (click)="ouvrirPhase(a.id)" [title]="'Ouvrir la phase ' + a.id">{{ nom(v, a.id) }}</button>
                          } @else {
                            {{ nom(v, a.id) }}
                          }
                        </td>
                        <ng-container *ngTemplateOutlet="charges; context: { $implicit: a }" />
                      </tr>
                    }
                    <tr class="total">
                      <td>Total</td>
                      <ng-container *ngTemplateOutlet="charges; context: { $implicit: v.m.total }" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </aside>

      <ng-template #bascule let-cle="cle" let-nom="nom" let-ouvert="ouvert" let-n="n">
        <button type="button" class="av-tog" [attr.aria-expanded]="ouvert" [title]="ouvert ? 'Replier' : 'Déplier'" (click)="basculer(cle)">
          <svg class="av-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" /></svg
          ><span class="av-nom-t">{{ nom }}</span><span class="av-n">{{ n }}</span>
        </button>
      </ng-template>

      <ng-template #avc let-val="val" let-cls="cls">
        <span class="av-avc"
          ><span class="avc-bar" [class]="'avc-bar ' + (cls || '')" aria-hidden="true"><i [style.width.%]="pct(val)"></i></span><b>{{ fP(val || 0) }}</b></span
        >
      </ng-template>

      <ng-template #chiffres let-s>
        <span class="av-c" title="JH des tâches validées ÷ JH prévus"><ng-container *ngTemplateOutlet="avc; context: { val: s.avancement }" /></span>
        <span class="av-c n">{{ fJ(s.conso) }} <span class="muted">/ {{ fJ(s.prevu) }}</span></span>
        <span class="av-c n"><span [class]="sgn(s.ecart)" data-ecart>{{ fSigned(s.ecart) }}</span></span>
        <span class="av-c n av-al" title="Tâches validées / tâches (hors annulées) · ateliers validés / prévus · livrables validés / prévus"
          ><span [class.muted]="!s.actives">{{ xy(s.valides, s.actives) }}</span><span class="t-sep" aria-hidden="true">·</span
          ><span [class.muted]="!s.ateliers">{{ xy(s.ateliersOK, s.ateliers) }}</span><span class="t-sep" aria-hidden="true">·</span
          ><span [class.muted]="!s.livrables">{{ xy(s.livrablesOK, s.livrables) }}</span></span
        >
        <span class="av-c"><app-statut [statut]="s.statut" [attr.title]="aideStatut(s.statut)" /></span>
      </ng-template>

      <ng-template #tache let-x>
        <div class="av-ligne av-niv3" [class.is-annul]="x.annulee" role="row">
          <span class="av-nom av-t" [title]="x.label"
            ><app-lien-tache [t]="x" />
            @if (x.type) {
              <span class="av-type">{{ typeNom(x.type) }}</span>
            }
          </span>
          <span class="av-c">
            @if (x.annulee) {
              <span class="muted">—</span>
            } @else {
              <ng-container *ngTemplateOutlet="avc; context: { val: x.statut === 'Validé' ? 1 : 0, cls: 'ok' }" />
              @if (x.statut !== 'Validé' && x.avancement > 0) {
                <small class="av-dec" title="Avancement déclaré dans Workload (indication, hors calcul)">déclaré {{ fP(x.avancement) }}</small>
              }
            }
          </span>
          <span class="av-c n">{{ fJ(x.consoTotal) }} <span class="muted">/ {{ fJ(x.charge) }}</span></span>
          <span class="av-c n"><span [class]="sgn(x.ecart)" data-ecart>{{ fSigned(x.ecart) }}</span></span>
          <span class="av-c"></span>
          <span class="av-c">
            @if (x.annulee) {
              <span class="pill st-annul" [title]="'Annulée le ' + fDi(x.annul?.at) + (x.annul?.motif ? ' — ' + x.annul.motif : '')">Annulée</span>
            } @else {
              <app-statut [statut]="x.statut" />
            }
          </span>
        </div>
      </ng-template>

      <ng-template #charges let-s>
        <td class="n">{{ fJ(s.prevu) }}</td>
        <td class="n">{{ fJ(s.conso) }}</td>
        <td class="n">{{ fJ(s.raf) }}</td>
        <td class="n">{{ fJ(s.atterrissage) }}</td>
        <td class="n" [class.av-plus]="s.ecart > 0.001" [class.av-moins]="s.ecart < -0.001">{{ fSigned(s.ecart) }}</td>
        <td class="av-barre"><app-barre [valeur]="s.prevu ? s.conso / s.prevu : 0" /></td>
        <td>
          @if (s.ecart > 0.001) {
            <span class="pill st-bloque" title="Atterrissage supérieur au prévu : dépassement anticipé ou constaté.">Dépassement</span>
          } @else if (s.ecart < -0.001) {
            <span class="pill st-valide" title="Atterrissage inférieur au prévu : gain (tâches finies sous le budget, enveloppe IA non consommée…).">Optimisation</span>
          } @else {
            <span class="pill tdb-conforme" title="Atterrissage = prévu.">Conforme</span>
          }
        </td>
      </ng-template>

    }
  `,
  styles: `
    .av-titre {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .av-table td,
    .av-table th {
      white-space: nowrap;
    }
    .av-nom {
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .av-lien {
      border: 0;
      padding: 0;
      background: none;
      font: inherit;
      color: var(--accent);
      cursor: pointer;
      text-align: left;
    }
    .av-lien:hover,
    .av-lien:focus-visible {
      text-decoration: underline;
    }
    .av-barre {
      width: 130px;
      min-width: 130px;
    }
    .av-dates {
      font-variant-numeric: tabular-nums;
    }
    .av-plus {
      color: var(--crit);
    }
    .av-moins {
      color: var(--ok);
    }
  `,
})
export class PanneauAvancement {
  protected readonly etat = inject(SuiviEtat);
  private readonly ui = inject(UiEtat);
  protected readonly vue = this.etat.vue;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fDi = fDi;
  protected readonly fSigned = fSigned;
  protected readonly sgn = sgn;
  protected readonly stSlug = stSlug;
  protected readonly xy = xy;
  protected readonly nom = axeName;
  protected readonly occupe = signal(false);

  /** Ce qui est affiché (groupes, sous-parties, tâches visibles, état déplié). */
  protected readonly arbre = computed(() => {
    const v = this.vue();
    const u = this.ui.ui();
    if (!v) return vueAvancement<TacheVue>({ axes: [], avancement: undefined }, [], { ouverts: {}, seul: false, avecSous: true });
    return vueAvancement(v.m, v.tasks, { ouverts: u.avOuv, seul: u.avAL, avecSous: sousVisibles(v.m.dim.key, u.avSous) });
  });

  protected pct(v: number | null | undefined): number {
    return Math.round(Math.max(0, Math.min(1, v || 0)) * 100);
  }

  protected typeNom(id: string): string {
    const v = this.vue();
    return v ? typeName(v, id) || id : id;
  }

  protected aideStatut(statut: Statistiques['statut']): string {
    return AIDE_STATUT[statut] ?? '';
  }

  protected basculer(cle: string): void {
    const o = this.ui.ui().avOuv;
    this.ui.maj({ avOuv: { ...o, [cle]: !o[cle] } });
  }

  protected toutBasculer(tousOuverts: boolean): void {
    const v = this.vue();
    if (v) this.ui.maj({ avOuv: tousOuverts ? {} : toutDeplier(v.m) });
  }

  protected basculerFiltre(): void {
    this.ui.maj({ avAL: !this.ui.ui().avAL });
  }

  protected basculerSous(): void {
    const v = this.vue();
    if (!v) return;
    const u = this.ui.ui();
    this.ui.maj({ avSous: { ...u.avSous, [v.m.dim.key]: !sousVisibles(v.m.dim.key, u.avSous) } });
  }

  protected ouvrirPhase(phase: string): void {
    this.etat.ouvrirPhase(phase, true);
  }

  /** PowerPoint (16:9) de ce qui est déplié, fabriqué dans le navigateur. */
  protected async exporter(): Promise<void> {
    const v = this.vue();
    if (!v) return;
    this.occupe.set(true);
    try {
      const Pptx = await chargerPptxGen();
      const css = getComputedStyle(document.body);
      const f = v.projet.fiche;
      const contexte = {
        client: f.client ?? '',
        projet: f.projet ?? '',
        aujourdhui: v.aujourdhui,
        dimL: v.m.dim.label,
        dimLl: v.dimLl,
        typeNom: (id: string) => this.typeNom(id),
        couleur: (variable: string, defaut: string) => css.getPropertyValue(variable).trim() || defaut,
      };
      const pres = presentationAvancement(new Pptx(), this.arbre(), v.m.total, contexte);
      const blob = (await pres.write({ outputType: 'blob' })) as Blob;
      telechargerFichier(blob, nomFichierAvancement(contexte.client, contexte.projet, v.aujourdhui));
      this.etat.afficher('PowerPoint de l’avancement détaillé téléchargé.', 'succes');
    } catch {
      this.etat.afficher('Le PowerPoint n’a pas pu être généré. Rechargez la page et réessayez.', 'erreur');
    } finally {
      this.occupe.set(false);
    }
  }
}
