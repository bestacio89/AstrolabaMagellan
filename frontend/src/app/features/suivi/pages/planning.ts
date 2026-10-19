import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { fD, fM, fML } from '../etat/formats';
import { LIGNES_CONFORT, LigneMacro, nomFichierMacro, presentationMacro } from '../etat/macro-planning';
import {
  avantPossible,
  barres,
  echelle,
  jalonsPlaces,
  LigneAffichee,
  lignesAffichees,
  moisAffiches,
  Morceau,
  quand,
  quandLong,
  retardLigne,
  retardTache,
} from '../etat/planning.logique';
import { chargerPptxGen } from '../etat/point-hebdo.chargement';
import { telechargerFichier } from '../etat/fichiers';
import { PANNEAU_PLANNING, SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { atRealise, isAtelier, isLivrable, lvLivre, lvPrevue, lvValide, TacheVue, typeName, Vue } from '../etat/vue';
import { Fx } from '../ui/fx';
import { OngletsPlanning } from '../ui/onglets-planning';
import { Gantt } from './gantt';

/** Une ligne prête à dessiner. */
interface LigneDessin {
  l: LigneAffichee<TacheVue>;
  cle: string;
  nom: string;
  type: string;
  couleur: string;
  piste: Morceau[];
  losange: { left: number; fait: boolean; texte: string } | null;
  nonDate: string | null;
  selection: boolean;
  aria: string;
}

const ICONE_PUNAISE = 'M9 3h6l-1 6 3 3v2H7v-2l3-3z';

/**
 * Planning › Vue d'ensemble (version HTML de référence, 56b-planning.js) : une ligne par groupe du reporting (axe, lot ou phase)
 * et, par axe ou par phase, les sous-parties et tâches mises en avant. Prévu : dates saisies dans le volet de la ligne, sinon
 * calculées depuis les dates des tâches ; réel : du premier au dernier jour de consommé ; jalons numérotés et leur légende.
 * « PowerPoint » : la même chose en une diapositive (Macro-Planning).
 */
@Component({
  selector: 'app-planning-ensemble',
  imports: [NgTemplateOutlet, Fx, OngletsPlanning],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      <div class="sechead">
        <div>
          <h2>Planning</h2>
          <p>
            Une ligne par {{ v.dimL.toLowerCase() }}{{
              v.m.dim.key === 'id' ? ' (sous-parties et tâches choisies affichées dessous)' : v.m.dim.key === 'phase' ? ' (tâches choisies affichées dessous)' : ''
            }}
            : barre pâle = période <b>prévue</b> ({{
              v.m.dim.key === 'id'
                ? 'axe : du plus tôt au plus tard de ses sous-parties et de ses tâches ; sous-partie : saisie dans son détail'
                : 'saisie dans le détail de la ligne'
            }}, sinon calculée depuis les dates des tâches) · barre pleine = période <b>réelle</b> (jours de consommé saisis) · hachures rouges = fin prévue dépassée.
            <app-fx cle="planning" />
          </p>
        </div>
        <app-onglets-planning />
      </div>

      <div class="toolbar pl-outils">
        <span class="g-lg pl-lg"
          ><span><i class="pl-lg-prevu"></i>{{ v.m.dim.key === 'id' ? 'Prévu (axe, ou dates saisies)' : 'Prévu saisi' }}</span
          ><span><i class="pl-lg-calc"></i>Prévu calculé (dates des tâches)</span><span><i class="pl-lg-reel"></i>Réel (consommé)</span
          ><span><i class="pl-lg-retard"></i>Fin prévue dépassée</span><span><i class="pl-lg-auj"></i>Aujourd’hui</span>
          @if (m.nbAvant) {
            <span><i class="pl-lg-los"></i>Atelier / livrable</span>
          }
        </span>
        <span class="spacer"></span>
        @if (m.masquees.length) {
          <span class="pl-masquees">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.9 3.7M6.1 6.6C3.8 8.2 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.4-1.1" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </svg>
            <span
              >{{ m.masquees.length }} ligne{{ m.masquees.length > 1 ? 's' : '' }} masquée{{ m.masquees.length > 1 ? 's' : '' }} :
              @for (a of m.masquees; track a.cle; let last = $last) {
                @if (m.modif) {
                  <button type="button" class="linkbtn" [title]="'Réafficher « ' + a.nom + ' » sur le planning'" (click)="reafficher(a.cle ?? '', a.nom)">{{ a.nom }}</button
                  >{{ last ? '' : ', ' }}
                } @else {
                  {{ a.nom }}{{ last ? '' : ', ' }}
                }
              }
            </span>
          </span>
        }
        @if (!m.possible) {
          @if (m.avantEnregistre) {
            <span class="pl-astuce">Regroupé par lot : les éléments mis en avant s’affichent par axe ou par phase.</span>
          }
        } @else if (m.nbAvant) {
          <span class="pl-compteur"
            ><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path [attr.d]="punaise" fill="currentColor" /><path d="M12 14v7" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
            >{{ m.nbAvant }} élément{{ m.nbAvant > 1 ? 's' : '' }} mis en avant
            @if (m.modif) {
              · <button type="button" class="linkbtn" (click)="toutRetirer()">Tout retirer</button>
            }
          </span>
        } @else if (m.modif) {
          <span class="pl-astuce"
            ><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path [attr.d]="punaise" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
              <path d="M12 14v7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg
            >Aucun élément mis en avant : cliquez sur {{ v.m.dim.key === 'id' ? 'un axe' : 'une phase' }} pour en choisir</span
          >
        }
        @if (m.modif) {
          <button type="button" class="btn sm" (click)="etat.fenetre.set({ type: 'jalon', id: null })">+ Jalon</button>
        }
        <button type="button" class="btn sm" title="Télécharger le planning affiché en une diapositive PowerPoint (Macro-Planning)" (click)="exporter()">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" /></svg
          >PowerPoint
        </button>
      </div>

      <section class="card pl-carte" aria-label="Planning du projet">
        <div class="pl-grille">
          <div class="pl-tete">
            <span class="pl-coin">{{ m.titreCol }} · cliquez pour le détail</span>
            <span class="pl-mois-l">
              @for (x of m.tete; track x.mois) {
                <span class="pl-mois" [style.left.%]="x.left" [style.width.%]="x.width" [title]="x.titre"
                  ><b>{{ x.court }}</b><small>{{ x.annee }}</small></span
                >
              }
            </span>
          </div>
          @for (s of m.separateurs; track $index) {
            <span class="pl-sep" [style.left]="'calc(var(--pl-lib) + (100% - var(--pl-lib)) * ' + s + ')'"></span>
          }
          @if (m.aujourdhui != null) {
            <span class="pl-auj" [style.left]="'calc(var(--pl-lib) + (100% - var(--pl-lib)) * ' + m.aujourdhui + ')'" [title]="'Aujourd’hui, ' + fD(v.aujourdhui)"></span>
          }
          @for (d of m.lignes; track d.cle) {
            @if (d.l.avant) {
              <div class="pl-ligne sous avant" [class.is-sel]="d.selection" [style.--c]="d.couleur">
                <span class="pl-lib"
                  >@if (m.modif) {
                    <button type="button" class="pl-pin on" [attr.aria-label]="'Retirer « ' + d.nom + ' » du planning'" title="Retirer du planning" (click)="mettreEnAvant(d.l.avant, false)">
                      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path [attr.d]="punaise" fill="currentColor" /><path d="M12 14v7" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
                    </button>
                  }<button type="button" class="pl-lib-b" [title]="d.nom + ' · ouvrir le détail'" (click)="ouvrir(d)"
                    ><small>{{ d.type }}</small><span>{{ d.nom }}</span></button
                  ></span
                >
                <button type="button" class="pl-piste pl-piste-b" tabindex="-1" aria-hidden="true" (click)="ouvrir(d)">
                  <ng-container *ngTemplateOutlet="piste; context: { $implicit: d }" />
                </button>
              </div>
            } @else {
              <button type="button" class="pl-ligne" [class.is-sel]="d.selection" [attr.aria-pressed]="d.selection" [attr.aria-label]="d.aria" [style.--c]="d.couleur" (click)="ouvrir(d)">
                <span class="pl-lib"><b>{{ d.nom }}</b></span>
                <span class="pl-piste"><ng-container *ngTemplateOutlet="piste; context: { $implicit: d }" /></span>
              </button>
            }
          } @empty {
            <p class="empty">{{ m.masquees.length ? 'Toutes les lignes sont masquées : cliquez sur un nom au-dessus pour en réafficher une.' : 'Aucune tâche.' }}</p>
          }
          <div class="pl-jalons">
            <span class="pl-lib"><b>Jalons</b></span>
            <span class="pl-piste">
              @for (p of m.jalons; track p.j.id) {
                @if (p.periode; as per) {
                  <span class="pl-jper" [style.left.%]="per.left" [style.width.%]="per.width" aria-hidden="true"></span>
                }
                <span class="pl-jnum" [class]="'pl-jnum' + (p.etat ? ' ' + p.etat : '') + (p.etage ? ' e1' : '')" [style.left.%]="p.x" aria-hidden="true">{{ p.j.numero ?? '?' }}</span>
                <button
                  type="button"
                  class="pl-losange"
                  [class]="'pl-losange' + (p.etat ? ' ' + p.etat : '')"
                  [style.left.%]="p.x"
                  [disabled]="!m.modif"
                  [attr.aria-label]="'Jalon ' + (p.j.numero ?? 'à confirmer') + ' : ' + p.j.libelle + ', ' + quandLong(p.j) + (m.modif ? '. Modifier' : '')"
                  [title]="quandLong(p.j) + ' : ' + p.j.libelle + (p.j.aConfirmer ? ' (à confirmer)' : '')"
                  (click)="modifierJalon(p.j.id)"
                ></button>
              } @empty {
                <span class="pl-nondate">{{ m.modif ? 'Aucun jalon : « + Jalon » pour en ajouter.' : 'Aucun jalon.' }}</span>
              }
            </span>
          </div>
        </div>
        @if (m.jalons.length) {
          <div class="pl-leg-j" [class.vide]="!m.numerotes.length" [style.--r3]="m.r3" [style.--r2]="m.r2">
            @for (p of m.numerotes; track p.j.id) {
              <ng-container *ngTemplateOutlet="legende; context: { $implicit: p }" />
            }
          </div>
          @if (m.aConfirmer.length) {
            <div class="pl-leg-j conf-l">
              @for (p of m.aConfirmer; track p.j.id) {
                <ng-container *ngTemplateOutlet="legende; context: { $implicit: p }" />
              }
            </div>
          }
        }
      </section>

      <ng-template #legende let-p>
        <button type="button" class="pl-leg" [class]="'pl-leg' + (p.etat ? ' ' + p.etat : '')" [disabled]="!m.modif" title="Modifier ce jalon" (click)="modifierJalon(p.j.id)">
          <span class="pl-jb">{{ p.j.numero ?? '?' }}</span><b>{{ p.j.aConfirmer ? 'À confirmer' : quand(p.j) }}</b
          ><span class="pl-leg-t"
            >{{ p.j.libelle }}
            @if (p.j.aConfirmer) {
              <i>({{ quand(p.j) }})</i>
            }
          </span>
        </button>
      </ng-template>

      <ng-template #piste let-d>
        @for (x of d.piste; track $index) {
          @switch (x.type) {
            @case ('date') {
              <span class="pl-date" [class.fin]="x.classe === 'fin'" [style.left.%]="x.left">{{ x.texte }}</span>
            }
            @case ('prevu') {
              <span class="pl-prevu" [class.calc]="x.classe === 'calc'" [style.left.%]="x.left" [style.width.%]="x.width"></span>
            }
            @case ('reel') {
              <span class="pl-reel" [class.fini]="x.classe === 'fini'" [style.left.%]="x.left" [style.width.%]="x.width"></span>
            }
            @case ('retard') {
              <span class="pl-retard" [style.left.%]="x.left" [style.width.%]="x.width" [title]="x.titre"></span>
            }
            @case ('pct') {
              <span class="pl-pct" [style.left]="'calc(' + x.left.toFixed(3) + '% + 6px)'">{{ x.texte }}</span>
            }
          }
        }
        @if (d.losange; as lo) {
          <span class="pl-los" [class.fait]="lo.fait" [style.left.%]="lo.left"></span>
          <span class="pl-los-l" [style.left]="'calc(' + lo.left.toFixed(3) + '% + 12px)'">{{ lo.texte }}</span>
        }
        @if (d.nonDate) {
          <span class="pl-nondate">{{ d.nonDate }}</span>
        }
      </ng-template>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class PlanningEnsemble {
  protected readonly etat = inject(SuiviEtat);
  private readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly quand = quand;
  protected readonly quandLong = quandLong;
  protected readonly punaise = ICONE_PUNAISE;

  /** Lignes affichées, avec leurs dates utiles à l'échelle. */
  private readonly lignes = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const pl = v.projet.planning;
    return { v, lignes: lignesAffichees(v.m.axes, v.tasks, v.m.dim.key, pl?.avant ?? {}, pl?.masque ?? {}) };
  });

  protected readonly vm = computed(() => {
    const x = this.lignes();
    if (!x) return null;
    const { v, lignes } = x;
    const td = v.aujourdhui;
    const jalonsM = v.m.jalons ?? [];
    const mois = moisAffiches(
      v.m.cal,
      td,
      lignes.map((l) => ({ g: l.g, dates: l.t ? datesTache(l.t) : undefined })),
      jalonsM,
      v.m.months,
    );
    const { d0, d1, pc } = echelle(mois);
    const panneau = this.etat.panneau();
    const dessins: LigneDessin[] = lignes.map((l) => dessiner(v, l, pc, td, panneau));
    const places = jalonsPlaces(jalonsM, pc, td);
    const numerotes = places.filter((p) => !p.j.aConfirmer);
    const tete = mois.map((mk, i) => {
      const a = pc(mk + '-01'),
        b = i + 1 < mois.length ? pc(mois[i + 1] + '-01') : 100;
      return { mois: mk, left: a, width: b - a, titre: fML(mk), court: fM(mk).split(' ')[0], annee: mk.slice(0, 4) };
    });
    const avant = v.projet.planning?.avant ?? {};
    const masque = v.projet.planning?.masque ?? {};
    return {
      v,
      modif: v.droits.peutModifier,
      titreCol: ({ id: 'Axes', lot: 'Lots', phase: 'Phases' } as Record<string, string>)[v.m.dim.key] ?? 'Groupes',
      lignes: dessins,
      lignesBrutes: lignes,
      mois,
      tete,
      separateurs: mois.slice(1).map((mk) => (pc(mk + '-01') / 100).toFixed(4)),
      aujourdhui: td >= d0 && td < d1 ? (pc(td) / 100).toFixed(4) : null,
      jalons: places,
      numerotes,
      aConfirmer: places.filter((p) => p.j.aConfirmer),
      r3: Math.max(1, Math.ceil(numerotes.length / 3)),
      r2: Math.max(1, Math.ceil(numerotes.length / 2)),
      nbAvant: lignes.filter((l) => l.avant).length,
      possible: avantPossible(v.m.dim.key),
      avantEnregistre: Object.keys(avant).length > 0,
      masquees: v.m.axes.filter((a) => masque[a.cle ?? '']),
    };
  });

  protected ouvrir(d: LigneDessin): void {
    if (d.l.tache && d.l.t) {
      if (this.etat.panneau() === d.l.t.uid) this.etat.fermerPanneau();
      else this.etat.ouvrirTache(d.l.t.uid);
      return;
    }
    if (this.etat.panneau() === PANNEAU_PLANNING + d.cle) this.etat.fermerPanneau();
    else this.etat.ouvrirLignePlanning(d.cle);
  }

  protected mettreEnAvant(cle: string | undefined, actif: boolean): void {
    if (cle) void this.etat.saisir((id) => this.api.elementPlanning(id, 'avant', cle, actif));
  }

  protected reafficher(cle: string, nom: string): void {
    void this.etat.saisir((id) => this.api.elementPlanning(id, 'masque', cle, false), {
      siSucces: () => this.etat.afficher(`« ${nom} » réaffiché sur le planning.`, 'succes'),
    });
  }

  protected modifierJalon(id: string): void {
    if (this.vm()?.modif) this.etat.fenetre.set({ type: 'jalon', id });
  }

  /** Retire du planning tous les éléments mis en avant (après confirmation). */
  protected async toutRetirer(): Promise<void> {
    const m = this.vm();
    if (!m) return;
    const cles = m.lignesBrutes.map((l) => l.avant).filter((c): c is string => !!c);
    if (!cles.length) return;
    const ok = await this.etat.confirmer(
      'Tout retirer du planning ?',
      [`${cles.length} élément(s) mis en avant ne seront plus affichés sous leur ${m.v.m.dim.key === 'phase' ? 'phase' : 'axe'}. Les tâches et leurs dates ne changent pas.`],
      'Tout retirer',
    );
    if (ok) void this.etat.saisir((id) => this.api.retirerElementsPlanning(id, cles));
  }

  /** Macro-Planning : exactement les lignes affichées, en une diapositive. */
  protected async exporter(): Promise<void> {
    const m = this.vm();
    if (!m) return;
    const v = m.v;
    const lignes: LigneMacro[] = m.lignesBrutes.map((l) => {
      if (l.t) {
        const t = l.t;
        if (isAtelier(t)) {
          const r = atRealise(t),
            dt = r || t.tr.atelier?.date;
          return { libelle: t.label, sous: true, idx: l.idx, losange: { date: dt || null, fait: !!r } };
        }
        if (isLivrable(t)) {
          const liv = lvLivre(t),
            dt = liv || lvPrevue(t);
          return { libelle: t.label, sous: true, idx: l.idx, losange: { date: dt || null, fait: !!liv } };
        }
        return { libelle: t.label, sous: true, idx: l.idx, debut: t.tr.debut || null, fin: t.tr.fin || null };
      }
      return { libelle: l.g?.nom ?? '', sous: l.sous, idx: l.idx, debut: l.g?.planDebut || null, fin: l.g?.planFin || null };
    });
    if (!lignes.length) {
      this.etat.afficher('Rien à exporter : le planning est vide.', 'attention');
      return;
    }
    if (lignes.length > LIGNES_CONFORT) {
      const ok = await this.etat.confirmer(
        'Beaucoup de lignes pour une diapositive',
        [`Le planning affiché compte ${lignes.length} lignes. Tout tiendra sur une seule diapositive, mais le texte sera petit.`, 'Pour l’alléger, retirez des éléments mis en avant (punaise).'],
        'Générer quand même',
      );
      if (!ok) return;
    }
    const f = v.projet.fiche;
    const d = {
      client: f.client || '',
      projet: f.projet || '',
      lignes,
      mois: m.mois,
      aujourdhui: v.aujourdhui,
      jalons: (v.m.jalons ?? []).map((j) => ({
        numero: j.numero,
        libelle: j.libelle,
        quand: quand(j),
        debut: j.debut ?? '',
        fin: j.type === 'periode' ? j.fin || null : null,
        aConfirmer: !!j.aConfirmer,
      })),
    };
    try {
      const Pptx = await chargerPptxGen();
      const blob = (await presentationMacro(new Pptx(), d).write({ outputType: 'blob' })) as Blob;
      telechargerFichier(blob, nomFichierMacro(d));
      this.etat.afficher('Macro-Planning généré : une diapositive avec les lignes affichées et les jalons.', 'succes');
    } catch {
      this.etat.afficher('Le PowerPoint n’a pas pu être généré.', 'erreur');
    }
  }
}

/** Dates d'une tâche mise en avant utiles à l'échelle (prévues, réelles, atelier, livrable). */
function datesTache(t: TacheVue): (string | null | undefined)[] {
  return [
    t.tr.debut,
    t.tr.fin,
    t.consoDates[0],
    t.consoDates[t.consoDates.length - 1],
    ...(isAtelier(t) ? [t.tr.atelier?.date, atRealise(t)] : []),
    ...(isLivrable(t) ? [lvPrevue(t), lvLivre(t)] : []),
  ];
}

/** Ligne prête à dessiner : nom, piste (barres ou losange), sélection, description pour les lecteurs d'écran. */
function dessiner(v: Vue, l: LigneAffichee<TacheVue>, pc: (iso: string, finJour?: boolean) => number, td: string, panneau: string | null): LigneDessin {
  const couleur = `var(--ax${l.idx % 8})`;
  if (l.t) {
    const t = l.t;
    const type = isAtelier(t) ? 'Atelier' : isLivrable(t) ? 'Livrable' : t.type ? typeName(v, t.type) || 'Tâche' : 'Tâche';
    let losange: LigneDessin['losange'] = null,
      nonDate: string | null = null,
      piste: Morceau[] = [];
    if (isAtelier(t)) {
      const r = atRealise(t),
        dt = t.tr.atelier?.date;
      if (r) losange = { left: pc(r), fait: true, texte: `${fD(r)} · réalisé` };
      else if (dt) losange = { left: pc(dt), fait: false, texte: `${fD(dt)} · planifié` };
      else nonDate = 'Atelier à planifier';
    } else if (isLivrable(t)) {
      const liv = lvLivre(t),
        pv = lvPrevue(t),
        val = lvValide(t);
      if (liv) losange = { left: pc(liv), fait: true, texte: `${fD(liv)} · livré${val ? ', validé par le client' : ''}` };
      else if (pv) losange = { left: pc(pv), fait: false, texte: `${fD(pv)} · livraison prévue` };
      else nonDate = 'Livraison non datée';
    } else {
      piste = barres(pc, {
        pd: t.tr.debut,
        pf: t.tr.fin,
        saisi: true,
        rd: t.consoDates[0],
        rf: t.consoDates[t.consoDates.length - 1],
        fin: retardTache(t, td),
        valide: t.statut === 'Validé',
        av: t.avancement,
      });
      if (!piste.length) nonDate = 'Non daté';
    }
    return {
      l,
      cle: l.avant ?? t.uid,
      nom: t.label,
      type: `${l.parentCache && l.parent ? l.parent.nom + ' · ' : ''}${type}`,
      couleur,
      piste,
      losange,
      nonDate,
      selection: panneau === t.uid,
      aria: t.label,
    };
  }
  const g = l.g!;
  const fin = retardLigne(g, td);
  const saisi = !!g.planSaisi || (!!(g as { planCalcule?: boolean }).planCalcule && !!(g as { planDeSaisies?: boolean }).planDeSaisies);
  const piste = barres(pc, { pd: g.planDebut, pf: g.planFin, saisi, rd: g.reelDebut, rf: g.reelFin, fin, valide: g.statut === 'Validé', av: g.avancement });
  const cle = g.cle ?? '';
  const aria = `${g.nom} : ${g.planDebut && g.planFin ? `prévu du ${fD(g.planDebut)} au ${fD(g.planFin)}${saisi ? '' : ' (calculé)'}` : 'non planifié'}${
    g.reelDebut ? `, réel du ${fD(g.reelDebut)} au ${fD(g.reelFin)}` : ''
  }, avancement ${Math.round(g.avancement * 100)} %${fin ? ', fin prévue dépassée' : ''}. Ouvrir le détail`;
  return {
    l,
    cle: l.avant ?? cle,
    nom: g.nom,
    type: `${l.parentCache && l.parent ? l.parent.nom + ' · ' : ''}Sous-partie`,
    couleur,
    piste,
    losange: null,
    nonDate: piste.length ? null : 'Non planifié',
    selection: panneau === PANNEAU_PLANNING + cle,
    aria,
  };
}

/** Écran Planning : vue d'ensemble (par défaut) ou Gantt détaillé. */
@Component({
  selector: 'app-planning',
  imports: [PlanningEnsemble, Gantt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ui.ui().gVue === 'detail') {
      <app-gantt />
    } @else {
      <app-planning-ensemble />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Planning {
  protected readonly ui = inject(UiEtat);
}
