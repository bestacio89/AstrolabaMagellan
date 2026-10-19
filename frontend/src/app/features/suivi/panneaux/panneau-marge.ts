import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { fE, stSlug } from '../etat/formats';
import { ActionDetail, cascadeMarge, detailMarche, MarcheCascade, signeE } from '../etat/rentabilite.logique';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';

/**
 * Détail d'une colonne de la cascade « De la marge vendue à la marge à terminaison » (Rentabilité) :
 * de quoi il s'agit, le calcul, ce qui compose le montant (tâches cliquables, avec un retour ici), et l'écran où agir.
 * Volet de largeur normale : la cascade reste visible et cliquable à côté. Les flèches parcourent les colonnes.
 */
@Component({
  selector: 'app-panneau-marge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vue(); as v) {
      @if (marche(); as m) {
        @let dt = detail();
        <aside class="drawer" [attr.aria-label]="'Détail : ' + libelle(m.libelle)" style="--axc: var(--accent)">
          <div class="dr-head">
            <div class="dr-nav">
              <button type="button" class="btn sm" [disabled]="!precedente()" title="Colonne précédente" (click)="aller(precedente()?.cle)">
                ‹ {{ precedente() ? libelle(precedente()!.libelle) : '' }}
              </button>
              <button type="button" class="btn sm" [disabled]="!suivante()" title="Colonne suivante" (click)="aller(suivante()?.cle)">
                {{ suivante() ? libelle(suivante()!.libelle) : '' }} ›
              </button>
              <span class="muted">{{ position() + 1 }} / {{ cascade().length }}</span>
              <span class="spacer"></span>
              <button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
            </div>
            <span class="dr-kind">Rentabilité · cascade de la marge</span>
            <h2 class="dr-title">{{ libelle(m.libelle) }}</h2>
            <div class="rd-montant" [class]="'rd-montant ' + m.nature">
              {{ m.nature === 'total' ? fE(m.montant) : signeE(m.montant) }}<span>{{ m.nature === 'total' ? 'marge nette' : m.montant >= 0 ? 'améliore la marge' : 'réduit la marge' }}</span>
            </div>
          </div>
          @if (dt) {
            <div class="dr-body">
              <section>
                <h3>De quoi s’agit-il ?</h3>
                <p class="rd-quoi">{{ dt.quoi }}</p>
              </section>
              @if (dt.alerte) {
                <p class="rd-alerte" role="status">{{ dt.alerte }}</p>
              }
              <section>
                <h3>Le calcul</h3>
                <dl class="rd-calcul">
                  @for (l of dt.calcul; track $index) {
                    <div [class.total]="l.total">
                      <dt>
                        {{ l.libelle }}
                        @if (l.note) {
                          <small>{{ l.note }}</small>
                        }
                      </dt>
                      <dd>{{ l.valeur }}</dd>
                    </div>
                  }
                </dl>
              </section>
              @for (tb of dt.tableaux; track tb.titre) {
                <section>
                  <h3>{{ tb.titre }}</h3>
                  <div class="tw">
                    <table class="rd-table">
                      <thead>
                        <tr>
                          @for (c of tb.colonnes; track $index) {
                            <th [class.n]="c.n">{{ c.libelle }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (l of tb.lignes; track $index) {
                          <tr [class]="l.classe ?? ''">
                            @for (c of l.cellules; track $index) {
                              <td [class.n]="c.n" [class]="(c.n ? 'n ' : '') + (c.classe ?? '')">
                                @if (c.tache) {
                                  <button type="button" class="rd-lien" title="Ouvrir la tâche" (click)="etat.ouvrirTache(c.tache, cle())">{{ c.texte }}</button>
                                } @else {
                                  {{ c.texte }}
                                }
                                @if (c.motif || c.statut) {
                                  <span class="rd-motif">
                                    @if (c.statut) {
                                      <span class="pill" [class]="'pill st-' + stSlug(c.statut)">{{ c.statut }}</span>
                                    }
                                    {{ c.motif }}
                                  </span>
                                }
                                @if (c.alerte) {
                                  <span class="rd-motif rd-alerte-l">{{ c.alerte }}</span>
                                }
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                      @if (tb.total) {
                        <tfoot>
                          <tr class="total">
                            @for (c of tb.total; track $index) {
                              <td [class]="(c.n ? 'n ' : '') + (c.classe ?? '')">
                                {{ c.texte }}
                                @if (c.motif) {
                                  <span class="rd-motif">{{ c.motif }}</span>
                                }
                              </td>
                            }
                          </tr>
                        </tfoot>
                      }
                    </table>
                  </div>
                </section>
              }
              @if (dt.aide) {
                <p class="note">{{ dt.aide }}</p>
              }
              @if (dt.action; as a) {
                <div class="rd-action">
                  <button type="button" class="btn sm" (click)="agir(a)">{{ a.libelle }} →</button>
                </div>
              }
            </div>
          }
        </aside>
      }
    }
  `,
  styles: `
    .rd-montant {
      margin-top: 6px;
      font: 700 26px/32px var(--police-titre);
      font-variant-numeric: tabular-nums;
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .rd-montant span {
      font: 400 13px/18px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .rd-montant.hausse {
      color: var(--c-ok);
    }
    .rd-montant.baisse {
      color: var(--c-critique);
    }
    .rd-quoi {
      margin: 0;
      font: 400 14px/21px var(--police-texte);
    }
    .rd-alerte {
      margin: 0 0 10px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--c-attention-fond);
      color: var(--c-attention);
      font: 400 13px/19px var(--police-texte);
    }
    .rd-calcul {
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .rd-calcul > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 7px 0;
      border-bottom: 1px dashed var(--c-separateur);
    }
    .rd-calcul dt {
      font: 400 14px/20px var(--police-texte);
    }
    .rd-calcul dt small {
      display: block;
      font-size: 12px;
      color: var(--c-texte-discret);
    }
    .rd-calcul dd {
      margin: 0;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .rd-calcul > div.total {
      border-bottom: 0;
      border-top: 2px solid var(--c-bordure);
      margin-top: 2px;
    }
    .rd-calcul > div.total dt,
    .rd-calcul > div.total dd {
      font-weight: 700;
    }
    .rd-calcul > div.total dt small {
      font-weight: 400;
    }
    .rd-table {
      width: 100%;
      border-collapse: collapse;
    }
    .rd-table th {
      text-align: left;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
      padding: 6px 8px;
      border-bottom: 1px solid var(--c-bordure);
    }
    .rd-table td {
      padding: 7px 8px;
      border-bottom: 1px solid var(--c-separateur);
      font: 400 13px/18px var(--police-texte);
      vertical-align: top;
    }
    .rd-table .n {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .rd-table tr.total td {
      font-weight: 600;
      background: var(--c-fond);
    }
    .rd-table tr.rd-fictif td {
      background: var(--c-attention-fond);
    }
    .rd-table .pos {
      color: var(--c-ok);
    }
    .rd-table .neg {
      color: var(--c-critique);
    }
    .rd-lien {
      border: 0;
      padding: 0;
      background: none;
      font: inherit;
      color: var(--accent);
      cursor: pointer;
      text-align: left;
    }
    .rd-lien:hover,
    .rd-lien:focus-visible {
      text-decoration: underline;
    }
    .rd-motif {
      display: block;
      font: 400 12px/16px var(--police-texte);
      color: var(--c-texte-discret);
    }
    .rd-motif .pill {
      margin-right: 4px;
    }
    .rd-alerte-l {
      color: var(--c-attention);
    }
    .rd-action {
      padding-top: 14px;
    }
  `,
})
export class PanneauMarge {
  protected readonly etat = inject(SuiviEtat);
  private readonly ui = inject(UiEtat);
  private readonly router = inject(Router);
  /** Route du projet (le volet est dessiné par l'écran du projet, hors des onglets). */
  private readonly route = inject(ActivatedRoute);
  readonly cle = input.required<string>();
  protected readonly vue = this.etat.vue;
  protected readonly fE = fE;
  protected readonly signeE = signeE;
  protected readonly stSlug = stSlug;

  /** Colonnes dessinées ; une colonne de moins d'un euro (non dessinée) reste consultable par lien. */
  protected readonly cascade = computed(() => {
    const v = this.vue(), f = v?.m.financier;
    if (!v || !f) return [];
    const cas = cascadeMarge(f, v.tasks);
    if (!cas.some((x) => x.cle === this.cle())) {
      const x = cascadeMarge(f, v.tasks, { toutes: true }).find((y) => y.cle === this.cle());
      if (x) cas.splice(cas.length - 1, 0, x);
    }
    return cas;
  });
  protected readonly position = computed(() => this.cascade().findIndex((x) => x.cle === this.cle()));
  protected readonly marche = computed<MarcheCascade | null>(() => this.cascade()[this.position()] ?? null);
  protected readonly precedente = computed<MarcheCascade | null>(() => this.cascade()[this.position() - 1] ?? null);
  protected readonly suivante = computed<MarcheCascade | null>(() => this.cascade()[this.position() + 1] ?? null);
  protected readonly detail = computed(() => {
    const v = this.vue(), f = v?.m.financier;
    if (!v || !f) return null;
    return detailMarche(this.cle(), {
      f,
      taches: v.tasks,
      perimetre: v.m.perimetre.lignes,
      cjm: v.P.map((p) => p.cjm),
      synthese: v.m.synthese,
      achatsReel: v.projet.achatsReel,
    });
  });

  /** Libellé sans les césures (« Optimi­sations » → « Optimisations »). */
  protected libelle(l: string): string {
    return l.replace(/­/g, '');
  }

  protected aller(cle: string | undefined): void {
    if (cle) this.etat.ouvrirMarge(cle);
  }

  protected agir(a: ActionDetail): void {
    if (a.wl) this.ui.maj({ wl: a.wl });
    this.etat.fermerPanneau();
    void this.router.navigate([a.chemin], { relativeTo: this.route });
  }
}
