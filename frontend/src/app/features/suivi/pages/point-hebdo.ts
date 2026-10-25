import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SuiviApi } from '../api/suivi.api';
import { fD } from '../etat/formats';
import { chargerPptxGen, logoEntrepriseParDefaut } from '../etat/point-hebdo.chargement';
import { apercu, presentation } from '../etat/point-hebdo.diapo';
import { apercuRevueBimensuelle, chargerGabaritRevue, genererRevueBimensuelle, GabaritRevue } from '../etat/revue-bimensuelle';
import { telechargerFichier } from '../etat/fichiers';
import {
  CleIndicateur, clePeriode, donneesDiapo, EntreePointHebdo, lignes, LISTE_NIVEAUX, lundiDe, moisPrecedent, moisSuivant, MOIS_L, Niveau, NIVEAUX,
  nomFichier, numeroSemaine, plusJours, ReglagesPointHebdo, saisieDeLaPeriode, SaisiePeriode, Tendance, TypePeriode,
} from '../etat/point-hebdo.logique';
import { SuiviEtat } from '../etat/suivi.etat';

/**
 * Point hebdo (ou mensuel) : la diapositive PowerPoint du point de suivi delivery, à ajouter au support de l'entreprise.
 * À gauche, ce que le chef de projet complète ; à droite, l'aperçu de la diapositive, dessiné par le même code que le fichier.
 * Les chiffres viennent des indicateurs du serveur ; la saisie est gardée par période (la suivante repart de la précédente).
 */
@Component({
  selector: 'app-point-hebdo',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vue(); as v) {
      @if (!v.droits.voitMontants) {
        <div class="card empty">Le point hebdo n’est proposé qu’aux rôles qui voient les montants.</div>
      } @else if (d(); as dd) {
        <div class="sechead">
          <div>
            <h2>{{ type() === 'quinzaine' ? 'Revue bimensuelle' : type() === 'mois' ? 'Point mensuel' : 'Point hebdomadaire' }}</h2>
            <p>Préparez les éléments de la revue delivery. Les chiffres sont calculés à partir du suivi ; les appréciations et commentaires sont conservés d’une séance à l’autre.</p>
            @if (v.projet.pointsHebdo?.reglages.logoClient; as logo) { <p class="ph-client"><img [src]="logo" alt="Logo du client" /><a routerLink="../parametres">Modifier le logo du client dans Paramètres du projet</a></p> }
          </div>
          <div class="seg" role="group" aria-label="Période">
            <button type="button" [attr.aria-pressed]="type() === 'quinzaine'" (click)="type.set('quinzaine')">Revue bimensuelle</button>
            <button type="button" [attr.aria-pressed]="type() === 'semaine'" (click)="type.set('semaine')">Hebdomadaire</button>
            <button type="button" [attr.aria-pressed]="type() === 'mois'" (click)="type.set('mois')">Mensuel</button>
          </div>
        </div>
        <div class="ph-grille">
          <aside class="card ph-form" aria-label="À compléter">
            <label class="field"
              >{{ type() === 'mois' ? 'Mois' : type() === 'quinzaine' ? 'Date de la séance' : 'Semaine' }}
              <select class="in" #per (change)="choisirPeriode(per.value)">
                @for (p of periodes(); track p.valeur) {
                  <option [value]="p.valeur" [selected]="p.valeur === (type() === 'mois' ? mois() : type() === 'quinzaine' ? seance() : semaine())">{{ p.libelle }}</option>
                }
              </select>
            </label>
            @if (etatSaisie(); as e) {
              <span class="ph-etat" [class.ok]="e.enregistree">
                @if (e.enregistree) {
                  Enregistré{{ e.saisie.majLe ? ' le ' + fD(e.saisie.majLe.slice(0, 10)) : '' }}{{ e.saisie.par ? ' par ' + e.saisie.par : '' }}{{ e.saisie.genereLe ? ' · PowerPoint généré le ' + fD(e.saisie.genereLe.slice(0, 10)) : '' }}
                } @else if (e.reprise) {
                  Nouveau point : points d’attention, appréciations et météo repris du point précédent
                } @else {
                  Nouveau point
                }
              </span>
            }
            <label class="field"
              >{{ type() === 'mois' ? 'Faits marquants du mois' : type() === 'quinzaine' ? 'Faits marquants de la quinzaine' : 'Faits marquants de la semaine' }} <span class="auto">une ligne par point</span>
              <textarea class="in ph-txt" rows="4" name="actualites" placeholder="Ex. Atelier de cadrage réalisé avec le client" [value]="texte('actualites')" [disabled]="lecture()" #ac
                (input)="brouillon.set({ ...brouillon(), actualites: lignes(ac.value) })" (change)="enregistrer({ actualites: lignes(ac.value) })"></textarea>
            </label>
            <label class="field"
              >Points d’attention · leviers <span class="auto">une ligne par point</span>
              <textarea class="in ph-txt" rows="3" name="attention" placeholder="Ex. Disponibilité du RSSI à sécuriser" [value]="texte('attention')" [disabled]="lecture()" #at
                (input)="brouillon.set({ ...brouillon(), attention: lignes(at.value) })" (change)="enregistrer({ attention: lignes(at.value) })"></textarea>
            </label>
            @if (type() === 'quinzaine') {
              <label class="field">À évoquer en séance
                <span class="seg ph-seg" role="group">
                  <button type="button" [attr.aria-pressed]="!saisie().aEvoquer" [disabled]="lecture()" (click)="enregistrer({ aEvoquer: false })">Non</button>
                  <button type="button" [attr.aria-pressed]="!!saisie().aEvoquer" [disabled]="lecture()" (click)="enregistrer({ aEvoquer: true })">Oui</button>
                </span>
              </label>
              <label class="field">Difficulté rencontrée
                <textarea class="in ph-txt" rows="2" [value]="saisie().difficulte ?? ''" [disabled]="lecture()" #df (change)="enregistrer({ difficulte: df.value })"></textarea>
              </label>
              <label class="field">Impact
                <textarea class="in ph-txt" rows="2" [value]="saisie().impact ?? ''" [disabled]="lecture()" #im (change)="enregistrer({ impact: im.value })"></textarea>
              </label>
            }
            <fieldset class="ph-ind" [disabled]="lecture()">
              <legend>Indicateurs <span class="auto">{{ dd.periode.colS }} : {{ type() === 'mois' ? 'ce mois' : type() === 'quinzaine' ? 'la quinzaine' : 'cette semaine' }} · {{ dd.periode.colS1 }} : prévision</span></legend>
              <div class="ph-ind-l ph-ind-tete"><span></span><span>{{ dd.periode.colS }}</span><span>{{ dd.periode.colS1 }}</span></div>
              @for (i of dd.indicateurs; track i.cle) {
                <div class="ph-ind-l">
                  <span [title]="i.raison">{{ i.libelle }}<small>{{ i.raison }}</small></span>
                  @for (q of quand; track q) {
                    <span class="ph-points" role="radiogroup" [attr.aria-label]="i.libelle + ' ' + (q === 's' ? dd.periode.colS : dd.periode.colS1)">
                      @for (n of niveaux; track n) {
                        <button type="button" [class]="'ph-pt n-' + n" role="radio" [attr.aria-checked]="(q === 's' ? i.s : i.s1) === n"
                          [title]="libelleNiveau(n) + (q === 's' && n === i.propose ? ' — proposé par le calcul' : '')" (click)="indicateur(i.cle, q, n)"></button>
                      }
                    </span>
                  }
                </div>
              }
              <p class="ph-leg">
                @for (n of niveaux; track n) {
                  <span><i [class]="'ph-pt n-' + n"></i>{{ libelleNiveau(n) }}</span>
                }
              </p>

            </fieldset>
            <div class="field">
              Possibilité d’extension de périmètre ?
              <span class="seg ph-seg" role="group">
                @for (x of ouiNon; track x) {
                  <button type="button" [attr.aria-pressed]="dd.extension === x" [disabled]="lecture()" (click)="enregistrer({ extension: x })">{{ x }}</button>
                }
              </span>
            </div>
            <details class="ph-plus">
              <summary>Équipe, contrat et logos <span class="auto">gardés d’une période à l’autre</span></summary>
              <div class="fgrid">
                @for (c of champsEquipe; track c.cle) {
                  <label class="field"
                    >{{ c.libelle }}<input class="in" [value]="valeurReglage(c.cle)" [placeholder]="c.aide" [disabled]="lecture()" #rg (change)="regler(c.cle, rg.value)"
                  /></label>
                }
              </div>
              <p class="auto">Consultants : repris des collaborateurs des profils (<a routerLink="../parametres">Paramètres du projet</a>).</p>
            <h3 class="ph-subhead">N° ODT des phases</h3>
            <p class="auto">Les numéros sont conservés d’une revue à l’autre.</p>
            @for (phase of v.m.phases; track phase) {
              <label class="field">{{ phase }}
                <input class="in" [value]="numeroOdt(phase)" [disabled]="lecture()" #odt (change)="odtPhase(phase, odt.value)" />
              </label>
            }
            </details>
          </aside>
          <section class="ph-apercu" aria-label="Aperçu de la diapositive">
            <div class="ph-barre">
              <span class="muted">Aperçu de la revue bimensuelle (16:9)</span><span class="spacer"></span>
              <button type="button" class="btn primary" [disabled]="occupe()" (click)="telecharger()">{{ occupe() ? 'Préparation…' : type() === 'quinzaine' ? 'Télécharger le PowerPoint (3 slides)' : 'Télécharger le PowerPoint' }}</button>
            </div>
            <div class="ph-cadre" #cadre [style.height.px]="hauteur()">
              <div class="ph-echelle" [style.transform]="'scale(' + echelle() + ')'" [innerHTML]="html()"></div>
            </div>
            <p class="auto">
              Consommé arrêté au {{ fD(dd.periode.fin) }} et valorisé au TJM. Risques : les 3 plus critiques (Actions &amp; décisions › Risques). Actions : les ouvertes par date d’échéance, puis celles faites sur la période.
            </p>
          </section>
        </div>
      }
    }
  `,
})
export class PointHebdo {
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly assainisseur = inject(DomSanitizer);
  protected readonly vue = this.etat.vue;
  protected readonly fD = fD;
  protected readonly lignes = lignes;
  protected readonly niveaux = LISTE_NIVEAUX;
  protected readonly quand = ['s', 's1'] as const;
  protected readonly ouiNon = ['Non', 'Oui'] as const;
  protected readonly champsEquipe: { cle: Exclude<keyof ReglagesPointHebdo, 'odt'>; libelle: string; aide: string }[] = [
    { cle: 'commercial', libelle: 'Commercial', aide: 'Prénom NOM' }, { cle: 'avv', libelle: 'AVV', aide: 'Prénom NOM' },
    { cle: 'pilote', libelle: 'Pilote delivery', aide: 'Prénom NOM' }, { cle: 'modeFacturation', libelle: 'Mode de facturation', aide: 'J.H, UO…' },
  ];

  // ---- période affichée ----
  private readonly aujourdhui = computed(() => this.vue()?.aujourdhui ?? new Date().toISOString().slice(0, 10));
  protected readonly type = signal<TypePeriode>('quinzaine');
  protected readonly semaine = linkedSignal(() => lundiDe(this.aujourdhui()));
  protected readonly mois = linkedSignal(() => this.aujourdhui().slice(0, 7));
  protected readonly seance = linkedSignal(() => this.aujourdhui());
  private readonly cle = computed(() => clePeriode(this.type(), this.semaine(), this.mois(), this.seance()));
  /** 13 semaines passées et la suivante ; 12 mois passés et le suivant (✓ : point enregistré). */
  protected readonly periodes = computed(() => {
    const p = this.vue()?.projet.pointsHebdo?.periodes ?? {}, auj = this.aujourdhui();
    if (this.type() === 'quinzaine') {
      const dates = new Set<string>(Object.keys(p).filter((k) => k.startsWith('Q:')).map((k) => k.slice(2)));
      for (let k = 0; k < 14; k++) dates.add(plusJours(auj, -14 * k));
      return [...dates].sort((a, b) => b.localeCompare(a)).slice(0, 14).map((d) => ({ valeur: d, libelle: `Séance du ${fD(d)}${d === auj ? ' (aujourd’hui)' : ''}${p['Q:' + d] ? ' ✓' : ''}` }));
    }
    if (this.type() === 'mois') {
      const l: { valeur: string; libelle: string }[] = [];
      for (let m = moisSuivant(auj.slice(0, 7)), k = 0; k < 14; k++, m = moisPrecedent(m))
        l.push({ valeur: m, libelle: `${MOIS_L[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}${m === auj.slice(0, 7) ? ' (en cours)' : ''}${p['M:' + m] ? ' ✓' : ''}` });
      return l;
    }
    const lundi = lundiDe(auj);
    return Array.from({ length: 14 }, (_, k) => {
      const l = plusJours(lundi, (1 - k) * 7);
      return { valeur: l, libelle: `S${numeroSemaine(l)} · du ${fD(l).slice(0, 5)} au ${fD(plusJours(l, 4))}${l === lundi ? ' (en cours)' : ''}${p['S:' + l] ? ' ✓' : ''}` };
    });
  });

  // ---- saisie ----
  protected readonly etatSaisie = computed(() => saisieDeLaPeriode(this.vue()?.projet.pointsHebdo, this.cle()));
  /** Texte en cours de frappe (l'aperçu le suit) ; effacé quand on change de période. */
  protected readonly brouillon = linkedSignal<string, Partial<SaisiePeriode>>({ source: this.cle, computation: () => ({}) });
  private readonly saisie = computed<SaisiePeriode>(() => ({ ...this.etatSaisie().saisie, ...this.brouillon() }));
  protected readonly reglages = computed<ReglagesPointHebdo>(() => this.vue()?.projet.pointsHebdo?.reglages ?? {});
  protected readonly logoDefaut = signal<string | null>(null);
  protected readonly lecture = computed(() => !this.vue()?.droits.peutModifier);
  protected readonly occupe = signal(false);
  protected readonly gabaritRevue = signal<GabaritRevue | null>(null);

  // ---- diapositive ----
  private readonly entree = computed<EntreePointHebdo | null>(() => {
    const v = this.vue();
    if (!v) return null;
    return {
      P: v.P, taches: v.tasks, caTSP: v.m.financier?.caTSP ?? null, chargeAjout: v.m.perimetre.chargeAjout, chargeAnnulee: v.m.perimetre.chargeAnnulee,
      echeancier: v.m.echeancier, risques: v.risquesOuverts, actions: v.projet.actions.map((a) => ({ ...a, commentaire: v.projet.commentaires?.['act:' + a.id]?.[0]?.texte ?? a.commentaire })), fiche: v.projet.fiche, dates: v.projet.dates, iaProfile: v.projet.settings.iaProfile,
    };
  });
  protected readonly d = computed(() => {
    const e = this.entree();
    return e
      ? donneesDiapo(e, { periode: this.type(), semaine: this.semaine(), mois: this.mois(), seance: this.seance(), aujourdhui: this.aujourdhui(), saisie: this.saisie(), reglages: this.reglages(), logoEntrepriseParDefaut: this.logoDefaut() })
      : null;
  });
  // Aperçu : tout texte saisi y est échappé et les images contrôlées (voir apercu()) ; il peut donc être inséré tel quel,
  // ce qui garde les styles de position (Angular les retirerait sinon).
  protected readonly html = computed(() => { const d = this.d(); const g = this.gabaritRevue(); return this.assainisseur.bypassSecurityTrustHtml(d ? this.type() === 'quinzaine' && g ? apercuRevueBimensuelle(d, g) : apercu(d) : ''); });

  // ---- mise à l'échelle de l'aperçu (13,333 × 7,5 pouces) ----
  private readonly cadre = viewChild<ElementRef<HTMLElement>>('cadre');
  private readonly largeur = signal(0);
  protected readonly echelle = computed(() => this.largeur() / (13.333 * 96) || 0.5);
  protected readonly hauteur = computed(() => (this.type() === 'quinzaine' ? 3 * 720 + 48 : 7.5 * 96) * this.echelle());

  constructor() {
    void chargerGabaritRevue().then((g) => this.gabaritRevue.set(g));
    void logoEntrepriseParDefaut().then((l) => this.logoDefaut.set(l));
    const destruction = inject(DestroyRef);
    afterNextRender(() => {
      const observateur = new ResizeObserver(() => this.largeur.set(this.cadre()?.nativeElement.clientWidth ?? 0));
      const suivre = (): void => {
        const c = this.cadre()?.nativeElement;
        if (c) {
          observateur.observe(c);
          this.largeur.set(c.clientWidth);
        } else setTimeout(suivre, 100); // l'écran attend le suivi
      };
      suivre();
      destruction.onDestroy(() => observateur.disconnect());
    });
  }

  protected libelleNiveau(n: Niveau): string {
    return NIVEAUX[n].libelle;
  }

  protected texte(champ: 'actualites' | 'attention'): string {
    return (this.etatSaisie().saisie[champ] ?? []).join('\n');
  }

  protected valeurReglage(cle: Exclude<keyof ReglagesPointHebdo, 'odt'>): string {
    const r = this.reglages();
    if (cle === 'commercial') return r.commercial ?? this.vue()?.projet.fiche.champs.find((c) => c.key === 'commercial')?.value ?? '';
    if (cle === 'modeFacturation') return r.modeFacturation ?? 'J.H';
    return r[cle] ?? '';
  }

  protected choisirPeriode(valeur: string): void {
    if (this.type() === 'mois') this.mois.set(valeur);
    else if (this.type() === 'quinzaine') this.seance.set(valeur);
    else this.semaine.set(valeur);
  }

  /** Enregistre la saisie de la période (le serveur la remplace entière). */
  protected async enregistrer(maj: Partial<SaisiePeriode>, genere = false): Promise<boolean> {
    const s = { ...this.saisie(), ...maj }, cle = this.cle();
    const corps: SaisiePeriode = { actualites: s.actualites, attention: s.attention, indicateurs: s.indicateurs, satisfaction: s.satisfaction ?? null, esprit: s.esprit ?? null, extension: s.extension, aEvoquer: !!s.aEvoquer, difficulte: s.difficulte ?? '', impact: s.impact ?? '' };
    const r = await this.etat.saisir((id) => this.api.pointHebdo(id, cle, corps, genere));
    if (r) this.brouillon.set({});
    return !!r;
  }

  /** Changer S entraîne S+1 tant que la prévision n'a pas été choisie à part. */
  protected indicateur(cle: CleIndicateur, quand: 's' | 's1', n: Niveau): void {
    const d = this.d()?.indicateurs.find((x) => x.cle === cle);
    if (!d) return;
    const ind = { ...this.saisie().indicateurs }, deja = ind[cle];
    const cur = { s: d.s, s1: d.s1 };
    if (quand === 's') {
      if (!deja?.s1 || cur.s1 === cur.s) cur.s1 = n;
      cur.s = n;
    } else cur.s1 = n;
    ind[cle] = cur;
    void this.enregistrer({ indicateurs: ind });
  }

  protected regler(cle: keyof ReglagesPointHebdo, valeur: string): void {
    void this.etat.saisir((id) => this.api.reglagePointHebdo(id, cle, valeur.trim()));
  }

  protected numeroOdt(phase: string): string {
    return this.reglages().odt?.[phase] ?? '';
  }

  protected odtPhase(phase: string, valeur: string): void {
    const odt = { ...(this.reglages().odt ?? {}) };
    if (valeur.trim()) odt[phase] = valeur.trim();
    else delete odt[phase];
    void this.etat.saisir((id) => this.api.reglagePointHebdo(id, 'odt', JSON.stringify(odt)));
  }

  /** Fabrique le PowerPoint dans le navigateur, le propose au téléchargement et note la date de génération. */
  protected async telecharger(): Promise<void> {
    const d = this.d();
    if (!d) return;
    this.occupe.set(true);
    try {
      let blob: Blob;
      if (this.type() === 'quinzaine') blob = await genererRevueBimensuelle(d);
      else {
        const Pptx = await chargerPptxGen();
        blob = (await presentation(Pptx, d).write({ outputType: 'blob' })) as Blob;
      }
      telechargerFichier(blob, nomFichier(d));
      if (!this.lecture()) await this.enregistrer({}, true);
      this.etat.afficher('PowerPoint généré.', 'succes');
    } catch (erreur) {
      this.etat.afficher(erreur instanceof Error ? erreur.message : 'Le PowerPoint n’a pas pu être généré. Rechargez la page et réessayez.', 'erreur');
    } finally {
      this.occupe.set(false);
    }
  }
}
