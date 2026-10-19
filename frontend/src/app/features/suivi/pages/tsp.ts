import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuiviApi } from '../api/suivi.api';
import { ecartCls, ecartMark, fD, fDi, fE, fE2, fJ, fJz, fM, fP, fP2, fSigned } from '../etat/formats';
import { num, sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { defaultAxeName, Vue } from '../etat/vue';
import { Carte, CarteRepliable } from '../ui/cartes';
import { Fx } from '../ui/fx';
import { centrerMoisCourant } from './plan-de-charge';

// =====================================================================================
// Écrans du groupe TSP (la référence vendue) : Fiche, Synthèse, Profils, Chiffrage (fichier à part)
// et annexes Planning, Métrique, Ventilation. Lecture seule, sauf client / projet / référence (Fiche).
// =====================================================================================

/** Fiche projet : identification (client, projet, référence modifiables), dates, montants, noms des axes. */
import { SyntheseTsp } from '../ui/synthese-tsp';
@Component({
  selector: 'app-fiche',
  imports: [RouterLink, Carte],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Fiche projet</h2>
        <p>Reprise du TSP. Client, projet et référence se corrigent ici ; dates et noms des axes dans ⚙ Paramètres du projet ; les montants sont recalculés.</p>
      </div>
    </div>
    @if (etat.vue(); as v) {
      @let D = v.projet.dates;
      <div class="grid2">
        <app-carte titre="Identification">
          <div class="kv">
            @for (c of champsModifiables; track c[0]) {
              <div>{{ c[1] }}</div>
              <div>
                <input class="in w-txt" [attr.aria-label]="c[1]" [value]="valeurFiche(v, c[0])" [disabled]="!v.droits.peutModifier" #x (change)="fiche(v, c[0], x)" />
              </div>
            }
            @for (c of autresChamps(v); track c.key) {
              <div>{{ c.label }}</div>
              <div>{{ c.key === 'date' ? fD(c.value) : c.value }}</div>
            }
          </div>
        </app-carte>
        <app-carte titre="Dates du projet" sousTitre="Elles fixent les mois affichés partout : consommé, Gantt, plannings, graphiques, exports.">
          <a extra class="btn sm" routerLink="../parametres">Modifier dans ⚙ Paramètres du projet</a>
          <div class="kv">
            <div>Période au TSP</div>
            <div>{{ v.projet.periode?.start ? fD(v.projet.periode?.start) + ' → ' + fD(v.projet.periode?.end) : '—' }}</div>
            <div>Début du projet</div>
            <div>{{ fD(D.debut) }}</div>
            <div>Fin contractuelle</div>
            <div>{{ fD(D.finContrat) }}</div>
            <div>Fin prévue</div>
            <div>{{ fD(D.finPrevue) }}</div>
          </div>
        </app-carte>
        @if (v.m.synthese; as s) {
          <app-carte titre="Montants">
            <div class="kv">
              <div>Montant du contrat</div>
              <div class="num">{{ fE2(s.montantProjet) }}</div>
              <div>dont CA vendu (jours)</div>
              <div class="num">{{ fE2(s.ca) }}</div>
              <div>dont achats refacturés <small class="muted">(prévus au TSP)</small></div>
              <div class="num">{{ fE2(s.achatsRef) }}</div>
              <div>dont frais refacturés <small class="muted">(prévus au TSP)</small></div>
              <div class="num">{{ fE2(s.fraisRef) }}</div>
              @if ((v.m.financier?.caAvenant ?? 0) > 0.005) {
                <div>Avenants de réduction <small class="muted">(tâches annulées)</small></div>
                <div class="num neg">−{{ fE2(v.m.financier?.caAvenant) }}</div>
                <div><b>Montant du contrat après avenants</b></div>
                <div class="num">
                  <b>{{ fE2(s.montantProjet - (v.m.financier?.caAvenant ?? 0)) }}</b>
                </div>
              }
            </div>
          </app-carte>
        }
        <app-carte titre="Noms des axes" sousTitre="Le TSP ne contient que des codes (AXE1, 1, 2…). Le nom choisi est utilisé partout : tableaux, Gantt, exports.">
          <a extra class="btn sm" routerLink="../parametres">Modifier dans ⚙ Paramètres du projet</a>
          <div class="kv">
            @for (id of v.axeIds; track id) {
              <div>{{ id === '0' ? '0 (pilotage)' : id }}</div>
              <div>{{ nomAxe(v, id) }}</div>
            }
          </div>
        </app-carte>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Fiche {
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly fE2 = fE2;
  protected readonly champsModifiables: ['client' | 'projet' | 'reference', string][] = [
    ['client', 'Client'],
    ['projet', 'Projet'],
    ['reference', 'Référence'],
  ];

  protected valeurFiche(v: Vue, c: 'client' | 'projet' | 'reference'): string {
    return v.projet.fiche[c] ?? '';
  }

  protected autresChamps(v: Vue) {
    return v.projet.fiche.champs.filter((c) => !['client', 'projet', 'reference', 'periode'].includes(c.key) && (c.value ?? '').toString().trim());
  }

  /** Nom d'un code d'axe (nom choisi, sinon nom par défaut). */
  protected nomAxe(v: Vue, id: string): string {
    return v.projet.axes?.[id] || defaultAxeName(id);
  }

  protected fiche(v: Vue, champ: 'client' | 'projet' | 'reference', el: HTMLInputElement): void {
    const ancien = v.projet.fiche[champ] ?? '';
    const valeur = el.value.trim();
    if (valeur === ancien) return;
    void this.etat.saisir((id) => this.api.fiche(id, champ, valeur, this.etat.versionProjet()), { siErreur: () => (el.value = ancien) });
  }
}

/** Synthèse du TSP : l'onglet SYNTHESE, recalculé (même écran que la synthèse d'un brouillon). */
@Component({
  selector: 'app-synthese',
  imports: [Fx, SyntheseTsp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      @if (v.m.synthese; as s) {
        <div class="sechead">
          <div>
            <h2>Synthèse</h2>
            <p>L’onglet SYNTHESE du TSP vendu, recalculé à partir des profils, du workload, des frais et des achats. <app-fx cle="synthese" /></p>
          </div>
        </div>
        <app-synthese-tsp [synthese]="s" />
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Synthese {
  protected readonly etat = inject(SuiviEtat);
}

/** Profils du TSP (vendu, coûts, marges), ajouts en cours de projet et grille agences. */
@Component({
  selector: 'app-profils',
  imports: [Carte, CarteRepliable, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      @let s = m.s;
      <div class="sechead">
        <div>
          <h2>Profils</h2>
          <p>{{ m.nbNommes }} profil(s) au TSP. EN = Exakis Nelite. <app-fx cle="profils" /></p>
        </div>
      </div>
      <div class="kpis k3">
        <div class="kpi">
          <div class="l">CA initial</div>
          <div class="v">{{ v.projet.caInitial != null ? fE2(v.projet.caInitial) : '—' }}</div>
          <div class="s">{{ v.projet.caInitial != null ? 'Onglet PROFIL du TSP, avant remise' : 'Non renseigné dans le TSP' }}</div>
        </div>
        <div class="kpi">
          <div class="l">Remise</div>
          <div class="v">{{ fP2(v.projet.remise ?? 0) }}</div>
          <div class="s">{{ v.projet.remiseSaisie || v.projet.remise ? 'Appliquée aux TJM' : 'Non renseigné dans le TSP : aucune remise appliquée' }}</div>
        </div>
        <div class="kpi">
          <div class="l">CA vendu (jours)</div>
          <div class="v">{{ fE2(s.ca) }}</div>
          <div class="s">Total des profils, remise déduite</div>
        </div>
      </div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Profil</th>
              <th>Entité</th>
              <th>Collaborateur</th>
              <th class="n">TJM</th>
              <th class="n">CJM</th>
              @if (m.tci) {
                <th class="n">TCI / PRCS</th>
              }
              <th class="n">Vendu (JH)</th>
              <th class="n">CA vendu</th>
              <th class="n">Coût EN</th>
              <th class="n">Coût agence</th>
              <th class="n"><span title="Part du profil dans les jours vendus">Part JH</span></th>
              <th class="n"><span title="Part du profil dans le CA vendu">Part CA</span></th>
              <th class="n"><span title="Marge brute Exakis Nelite : (CA − coût EN) / CA">Marge brute EN</span></th>
              <th class="n"><span title="(CA − coût agence) / CA">Marge brute agence</span></th>
            </tr>
          </thead>
          <tbody>
            @for (p of m.liste; track p.i) {
              <tr>
                <td>{{ p.nom }}</td>
                <td>{{ p.entite }}</td>
                <td>{{ collaborateur(v, p.i) }}</td>
                <td class="n">{{ fE(p.tjm) }}</td>
                <td class="n">{{ fE(p.cjm) }}</td>
                @if (m.tci) {
                  <td class="n">{{ p.tci == null ? '—' : fE(p.tci) }}</td>
                }
                <td class="n">{{ fJ(p.charge) }}</td>
                <td class="n">{{ fE2(p.ca) }}</td>
                <td class="n">{{ fE2(p.coutEN) }}</td>
                <td class="n">{{ fE2(p.coutAgence) }}</td>
                <td class="n">{{ fP2(p.pctJH) }}</td>
                <td class="n">{{ fP2(p.pctCA) }}</td>
                <td class="n">{{ fP2(p.margeEN) }}</td>
                <td class="n">{{ fP2(p.margeAgence) }}</td>
              </tr>
            }
            <tr class="total">
              <td>TOTAL</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              @if (m.tci) {
                <td></td>
              }
              <td class="n">{{ fJ(s.jours) }}</td>
              <td class="n">{{ fE2(s.ca) }}</td>
              <td class="n">{{ fE2(s.cout) }}</td>
              <td class="n">{{ fE2(s.coutAgence) }}</td>
              <td></td>
              <td></td>
              <td class="n">{{ fP2(s.margeEN) }}</td>
              <td class="n">{{ fP2(s.margeAgence) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      @if (m.ajouts.length) {
        <app-carte
          titre="Ajouts en cours de projet (hors TSP vendu)"
          sousTitre="Charge ajoutée aux tâches, non facturée : elle n’entre ni dans le CA ni dans les totaux du TSP ci-dessus, mais son coût réduit la marge (voir Tableau de bord)."
        >
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Profil</th>
                  <th>Entité</th>
                  <th>Collaborateur</th>
                  <th class="n">TJM</th>
                  <th class="n">CJM</th>
                  <th class="n">Charge ajoutée</th>
                  <th class="n">Coût (CJM)</th>
                  <th>Ajouté le</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                @for (p of m.ajouts; track p.i) {
                  <tr>
                    <td>
                      {{ p.nom }}
                      @if (p.ajout) {
                        <span class="tag-aj">profil ajouté</span>
                      } @else {
                        <span class="muted">(profil du TSP)</span>
                      }
                    </td>
                    <td>{{ p.entite }}</td>
                    <td>{{ p.collaborateur }}</td>
                    <td class="n">{{ fE(p.tjm) }}</td>
                    <td class="n">{{ fE(p.cjm) }}</td>
                    <td class="n">{{ fJ(p.ajoutJH) }}</td>
                    <td class="n">{{ fE2(p.ajoutCout) }}</td>
                    <td>{{ p.ajout ? fDi(p.ajout.at) + (p.ajout.by ? ' · ' + p.ajout.by : '') : '' }}</td>
                    <td class="wrap-t muted">{{ p.ajout?.motif ?? '' }}</td>
                  </tr>
                }
                <tr class="total">
                  <td>TOTAL</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td class="n">{{ fJ(m.totalAjoutJH) }}</td>
                  <td class="n">{{ fE2(m.totalAjoutCout) }}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </app-carte>
      }
      @if (v.projet.grille?.length) {
        <app-carte-repliable cle="grille" titre="Grille agences" sousTitre="TJM pour 40 % de marge brute EN. Utile pour chiffrer un profil ajouté.">
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Profil</th>
                  <th class="n">TJM Paris</th>
                  <th class="n">CJM Paris</th>
                  <th class="n">TJM Région</th>
                  <th class="n">CJM Région</th>
                </tr>
              </thead>
              <tbody>
                @for (g of v.projet.grille; track $index) {
                  <tr>
                    <td>{{ g.profil }}</td>
                    <td class="n">{{ fE(g.tjmParis) }}</td>
                    <td class="n">{{ fE(g.cjmParis) }}</td>
                    <td class="n">{{ fE(g.tjmRegion) }}</td>
                    <td class="n">{{ fE(g.cjmRegion) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-carte-repliable>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Profils {
  private readonly etat = inject(SuiviEtat);
  protected readonly fDi = fDi;
  protected readonly fE = fE;
  protected readonly fE2 = fE2;
  protected readonly fJ = fJ;
  protected readonly fP2 = fP2;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    const s = v?.m.synthese;
    if (!v || !s) return null;
    // profils du TSP (montants et pourcentages au centième, comme dans le TSP)
    const liste = v.m.profils.filter((p) => !v.P[p.i]?.ajout && (p.nom || p.charge));
    const ajouts = v.m.profils
      .filter((p) => v.P[p.i]?.ajout || p.ajoutJH)
      .map((p) => ({ ...p, ajout: v.P[p.i]?.ajout ?? null, collaborateur: v.P[p.i]?.collaborateur ?? '' }));
    return {
      v,
      s,
      liste,
      nbNommes: liste.filter((p) => p.nom).length,
      tci: liste.some((p) => p.tci != null && p.tci !== 0),
      ajouts,
      totalAjoutJH: sum(ajouts.map((p) => p.ajoutJH)),
      totalAjoutCout: sum(ajouts.map((p) => p.ajoutCout ?? 0)),
    };
  });

  protected collaborateur(v: Vue, i: number): string {
    return v.P[i]?.collaborateur ?? '';
  }
}

/** Ventilation des charges : jours vendus par profil, par phase et par étape. */
@Component({
  selector: 'app-ventilation',
  imports: [Carte, CarteRepliable, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      @let ve = v.m.ventilation;
      <div class="sechead">
        <div>
          <h2>Ventilation des charges</h2>
          <p>Jours vendus par profil, par phase et par étape.{{ v.droits.voitMontants ? ' TJM moyen : ' + fE(v.m.synthese?.tjmClient) + '.' : '' }} <app-fx cle="ventilation" /></p>
        </div>
      </div>
      <app-carte titre="Par phase">
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                @for (p of m.profils; track p.i) {
                  <th class="n">{{ p.nom }}</th>
                }
                <th class="n">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (x of ve.parPhase; track x.cle) {
                <tr>
                  <td>{{ x.cle }}</td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ fJz(x.parProfil[p.i]) }}</td>
                  }
                  <td class="n">{{ fJz(x.total) }}</td>
                </tr>
              }
              <tr class="total">
                <td>Total</td>
                @for (p of m.profils; track p.i) {
                  <td class="n">{{ fJ(ve.totalProfil[p.i]) }}</td>
                }
                <td class="n">{{ fJ(m.total) }}</td>
              </tr>
              @if (v.droits.voitMontants && ve.montantProfil) {
                <tr class="total">
                  <td>CA vendu</td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ fE(ve.montantProfil[p.i]) }}</td>
                  }
                  <td class="n">{{ fE(m.totalMontant) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-carte>
      <app-carte titre="Par étape" [sousTitre]="m.sansEtape > 0.001 ? fJ(m.sansEtape) + ' JH sans étape renseignée dans le TSP (ligne « Non renseignée »).' : ''">
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Étape</th>
                @for (p of m.profils; track p.i) {
                  <th class="n">{{ p.nom }}</th>
                }
                <th class="n">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (x of m.pleines; track x.cle) {
                <tr>
                  <td>{{ x.cle }}</td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ fJz(x.parProfil[p.i]) }}</td>
                  }
                  <td class="n">{{ fJz(x.total) }}</td>
                </tr>
              }
              @if (m.sansEtape > 0.001) {
                <tr class="muted">
                  <td><i>Non renseignée</i></td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ fJz(ve.sansEtapeParProfil[p.i]) }}</td>
                  }
                  <td class="n">{{ fJz(m.sansEtape) }}</td>
                </tr>
              }
              <tr class="total">
                <td>Total</td>
                @for (p of m.profils; track p.i) {
                  <td class="n">{{ fJ(ve.totalProfil[p.i]) }}</td>
                }
                <td class="n">{{ fJ(m.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </app-carte>
      @if (m.vides.length) {
        <app-carte-repliable cle="ven-vides" [titre]="m.vides.length + ' étape(s) sans charge'" sousTitre="Étapes de la méthode non utilisées par ce projet.">
          <p class="muted">{{ m.vides.join(' · ') }}</p>
        </app-carte-repliable>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Ventilation {
  private readonly etat = inject(SuiviEtat);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const ve = v.m.ventilation;
    return {
      v,
      profils: v.P.filter((p) => !p.ajout && (p.nom || v.m.profils[p.i]?.charge)),
      total: sum(ve.totalProfil),
      totalMontant: sum(ve.montantProfil ?? []),
      pleines: ve.parEtape.filter((x) => x.total),
      vides: ve.parEtape.filter((x) => !x.total).map((x) => x.cle),
      sansEtape: sum(ve.sansEtapeParProfil ?? []),
    };
  });
}

/** Métrique : ratios théoriques par étape, rapportés à la charge « Développement et tests unitaires ». */
@Component({
  selector: 'app-metrique',
  imports: [Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Métrique</h2>
        <p>
          Ratios théoriques par étape, rapportés à la charge « Développement et tests unitaires ». Sans charge sur cette étape (cas d’un projet de conseil), les ratios ne
          s’appliquent pas.
         <app-fx cle="metrique" />
        </p>
      </div>
    </div>
    @if (etat.vue(); as v) {
      @if (v.m.metrique.length) {
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Étape</th>
                <th class="n">% théorique</th>
                <th class="n">Charge théorique</th>
                <th class="n">Charge propale</th>
                <th class="n">% projet</th>
                <th class="n">Écart</th>
              </tr>
            </thead>
            <tbody>
              @for (x of v.m.metrique; track x.etape) {
                <tr>
                  <td>{{ x.etape }}</td>
                  <td class="n">{{ fP(x.pct) }}</td>
                  <td class="n">{{ fJ(x.theorique) }}</td>
                  <td class="n">{{ fJ(x.propale) }}</td>
                  <td class="n">{{ fP(x.pctProjet) }}</td>
                  <td class="n">
                    @if (x.ecart == null) {
                      —
                    } @else {
                      <span [class.neg]="x.ecart > 0.001">{{ fP(x.ecart) }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="card empty">Onglet METRIQUE absent du TSP.</div>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Metrique {
  protected readonly etat = inject(SuiviEtat);
  protected readonly fJ = fJ;
  protected readonly fP = fP;
}

/** Annexe Planning : les deux tableaux de l'onglet PLANNING du TSP (par profil, par phase), en lecture seule. */
@Component({
  selector: 'app-planning',
  imports: [Carte],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Planning</h2>
        <p>Les deux tableaux de l’onglet PLANNING du TSP, tels qu’ils ont été saisis au chiffrage. En lecture seule : pour les corriger, modifiez le TSP puis réimportez-le.</p>
      </div>
    </div>
    @if (vm(); as m) {
      @let v = m.v;
      <app-carte titre="Planning par profil">
        <span sous-titre
          >Jours prévus par profil et par mois, saisis dans le TSP{{ v.projet.planningSource ? ' (onglet ' + v.projet.planningSource + ')' : '' }}. C’est la référence initiale du
          tableau de bord et de la facturation (FAE).</span
        >
        <span extra class="chips"
          ><span
            ><b>{{ fJ(m.p.charge) }}</b> JH prévus</span
          ><span
            ><b>{{ fJ(m.p.ventile) }}</b> ventilés</span
          ><span [class]="ecartCls(m.p.ecartTotal)">{{ ecartMark(m.p.ecartTotal) }}</span></span
        >
        <div class="tw">
          <table class="nw plangrid mscroll">
            <thead>
              <tr>
                <th>Profil</th>
                <th class="n">Charge par profil</th>
                @if (v.droits.voitMontants) {
                  <th class="n">TJM</th>
                }
                <th class="n">Ecart ?</th>
                @for (x of m.mois; track x.mois) {
                  <th class="n" [class.m-cur]="x.mois === v.moisCourant">
                    @if (x.dansProjet) {
                      {{ fM(x.mois) }}
                    } @else {
                      <span class="hp-m" title="Hors période du projet">{{ fM(x.mois) }} ⚠</span>
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (l of m.p.lignes; track l.i) {
                <tr>
                  <td>
                    {{ l.nom }}
                    @if (l.ajoute) {
                      <span class="tag-aj">profil ajouté</span>
                    }
                  </td>
                  <td class="n">
                    {{ fJ(l.charge) }}
                    @if (l.ajoutJH) {
                      <small class="aj-n" [title]="'dont ' + fJ(l.ajoutJH) + ' JH ajoutés en cours de projet'">dont +{{ fJ(l.ajoutJH) }}</small>
                    }
                  </td>
                  @if (v.droits.voitMontants) {
                    <td class="n">{{ fE(l.tjm) }}</td>
                  }
                  <td class="n">
                    <span [class]="ecartCls(l.ecart)">{{ ecartMark(l.ecart) }}</span>
                  </td>
                  @for (x of l.valeurs; track $index) {
                    <td class="n pcell ro">
                      @if (x) {
                        {{ fJ(x) }}
                      } @else {
                        <span class="muted">0</span>
                      }
                    </td>
                  }
                </tr>
              }
              <tr class="total">
                <td>TOTAL JH</td>
                <td class="n">{{ fJ(m.p.charge) }}</td>
                @if (v.droits.voitMontants) {
                  <td></td>
                }
                <td class="n">
                  <span [class]="ecartCls(m.p.ecartTotal)">{{ ecartMark(m.p.ecartTotal) }}</span>
                </td>
                @for (x of m.p.totalMois; track $index) {
                  <td class="n">{{ fJ(x) }}</td>
                }
              </tr>
              @if (v.droits.voitMontants) {
                <tr class="money">
                  <td>COUT MENSUEL (au TJM)</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  @for (x of m.p.valeurMois; track $index) {
                    <td class="n">{{ fE(x) }}</td>
                  }
                </tr>
                <tr class="money">
                  <td>COUT MENSUEL CUMULE (au TJM)</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  @for (x of m.p.valeurCumulee; track $index) {
                    <td class="n">{{ fE(x) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="sub" style="margin-top: 8px">
          « Ecart ? » = total ventilé sur les mois − charge du profil : ✓ quand toute la charge est ventilée.{{
            v.droits.voitMontants
              ? ' « TJM » : TJM du profil' + (v.projet.remise ? ' remisé' : '') + ' ; les lignes « COUT MENSUEL » sont donc la valeur vendue du mois (JH × TJM), comme dans le TSP.'
              : ''
          }}
        </p>
      </app-carte>
      @if (m.ph.lignes.length) {
        <app-carte titre="Planning par phase">
          <span sous-titre
            >Même planning, réparti par phase projet. « Charge par phase » = somme des charges des tâches du WORKLOAD de la phase ; les mois sont ceux saisis dans le TSP{{
              v.projet.planningPhases.source ? ' (onglet ' + v.projet.planningPhases.source + ')' : ''
            }}.</span
          >
          <span extra class="chips"
            ><span
              ><b>{{ fJ(m.ph.charge) }}</b> JH par phase</span
            ><span [class]="ecartCls(m.ph.ecartTotal)">{{ ecartMark(m.ph.ecartTotal) }}</span></span
          >
          <div class="tw">
            <table class="nw plangrid mscroll">
              <thead>
                <tr>
                  <th>Phases</th>
                  <th class="n">Charge par phase</th>
                  <th class="n">TJM</th>
                  <th class="n">Ecart ?</th>
                  @for (x of m.mois; track x.mois) {
                    <th class="n" [class.m-cur]="x.mois === v.moisCourant">
                      @if (x.dansProjet) {
                        {{ fM(x.mois) }}
                      } @else {
                        <span class="hp-m" title="Hors période du projet">{{ fM(x.mois) }} ⚠</span>
                      }
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (l of m.ph.lignes; track $index) {
                  <tr>
                    <td>{{ l.phase }}</td>
                    <td class="n">{{ fJz(l.charge) }}</td>
                    <td class="n">{{ l.tjm }}</td>
                    <td class="n">
                      <span [class]="ecartCls(l.ecart)">{{ ecartMark(l.ecart) }}</span>
                    </td>
                    @for (x of l.valeurs; track $index) {
                      <td class="n pcell ro">
                        @if (x) {
                          {{ fJ(x) }}
                        } @else {
                          <span class="muted">0</span>
                        }
                      </td>
                    }
                  </tr>
                }
                <tr class="total">
                  <td>TOTAL JH</td>
                  <td class="n">{{ fJ(m.ph.charge) }}</td>
                  <td></td>
                  <td class="n">
                    <span [class]="ecartCls(m.ph.ecartTotal)">{{ ecartMark(m.ph.ecartTotal) }}</span>
                  </td>
                  @for (x of m.ph.totalMois; track $index) {
                    <td class="n">{{ fJz(x) }}</td>
                  }
                </tr>
                <tr class="money">
                  <td>Écart avec le tableau par profil</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  @for (d of m.ph.difference; track $index) {
                    <td class="n">
                      <span [class]="abs(d) > 0.001 ? 'neg' : 'muted'">{{ abs(d) > 0.001 ? fSigned(d) : '=' }}</span>
                    </td>
                  }
                </tr>
              </tbody>
            </table>
          </div>
          <p class="sub" style="margin-top: 8px">
            « TJM » : valeurs reprises telles quelles du TSP (elles ne servent à aucun calcul). La dernière ligne compare, mois par mois, le total par phase au total par profil
            : les deux tableaux devraient donner le même nombre de JH.
          </p>
        </app-carte>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Planning {
  private readonly etat = inject(SuiviEtat);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;
  protected readonly fM = fM;
  protected readonly fSigned = fSigned;
  protected readonly ecartCls = ecartCls;
  protected readonly ecartMark = ecartMark;
  protected readonly abs = Math.abs;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const pr = v.projet.planningRef;
    const mois = v.m.months;
    const valeur = (i: number, mk: string) => {
      const k = pr.months.indexOf(mk);
      return k < 0 ? 0 : num(pr.rows[i]?.[k]);
    };
    // profils affichés : ceux qui ont un nom ou une charge ; charge = vendue + ajouts
    const profils = v.P.filter((p) => p.nom || v.m.profils[p.i]?.charge);
    const chargeProfil = (i: number) => (v.m.profils[i]?.charge ?? 0) + (v.m.profils[i]?.ajoutJH ?? 0);
    const lignes = profils.map((p) => ({
      i: p.i,
      nom: p.nom,
      ajoute: !!p.ajout,
      charge: chargeProfil(p.i),
      ajoutJH: v.m.profils[p.i]?.ajoutJH ?? 0,
      tjm: p.tjmR,
      // l'écart compte tout le planning saisi, y compris d'éventuels mois hors période
      ecart: sum(pr.months.map((mk) => valeur(p.i, mk))) - chargeProfil(p.i),
      valeurs: mois.map((mk) => valeur(p.i, mk)),
    }));
    const totalMois = mois.map((mk) => sum(profils.map((p) => valeur(p.i, mk))));
    const valeurMois = mois.map((mk) => sum(profils.map((p) => valeur(p.i, mk) * (p.tjmR ?? 0))));
    let cumul = 0;
    const valeurCumulee = valeurMois.map((x) => (cumul += x));

    const pp = v.projet.planningPhases;
    const chargePhase = pp.rows.map((r) => sum(v.tasks.filter((t) => t.phase === r.phase).map((t) => t.charge)));
    const totalPhase = mois.map((mk) => sum(pp.rows.map((r) => num(r.vals?.[mk]))));
    const tousMois = mois.map((mk) => sum(v.P.map((p) => valeur(p.i, mk))));
    const ecartsPhase = pp.rows.map((r, i) => sum(Object.values(r.vals ?? {}).map(num)) - chargePhase[i]);

    return {
      v,
      mois: mois.map((mk) => ({ mois: mk, dansProjet: mk >= v.m.moisDebut && mk <= v.m.moisFin })),
      p: {
        lignes,
        charge: sum(lignes.map((l) => l.charge)),
        ventile: sum(totalMois),
        ecartTotal: sum(lignes.map((l) => l.ecart)),
        totalMois,
        valeurMois,
        valeurCumulee,
      },
      ph: {
        lignes: pp.rows.map((r, i) => ({
          phase: r.phase,
          charge: chargePhase[i],
          tjm: r.cjm == null || r.cjm === '' ? '' : isFinite(Number(r.cjm)) && v.droits.voitMontants ? fE(Number(r.cjm)) : v.droits.voitMontants ? r.cjm : '',
          ecart: ecartsPhase[i],
          valeurs: mois.map((mk) => num(r.vals?.[mk])),
        })),
        charge: sum(chargePhase),
        ecartTotal: sum(ecartsPhase),
        totalMois: totalPhase,
        difference: totalPhase.map((x, k) => x - tousMois[k]),
      },
    };
  });

  constructor() {
    afterRenderEffect(() => {
      this.vm();
      centrerMoisCourant(this.hote.nativeElement);
    });
  }
}

