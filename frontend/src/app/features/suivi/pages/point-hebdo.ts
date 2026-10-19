import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SuiviApi } from '../api/suivi.api';
import { fD } from '../etat/formats';
import { chargerPptxGen, logoEntrepriseParDefaut, reduireLogo } from '../etat/point-hebdo.chargement';
import { apercu, presentation } from '../etat/point-hebdo.diapo';
import { telechargerFichier } from '../etat/fichiers';
import {
  CleIndicateur, clePeriode, donneesDiapo, EntreePointHebdo, lignes, LISTE_NIVEAUX, lundiDe, Meteo, MeteoSaisie, moisPrecedent, moisSuivant, MOIS_L, Niveau, NIVEAUX,
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
            <h2>Point {{ type() === 'mois' ? 'mensuel' : 'hebdo' }}</h2>
            <p>La diapositive du point de suivi delivery, à ajouter au support de l’entreprise. Les chiffres viennent du suivi ; complétez ce qui ne se calcule pas.</p>
          </div>
          <div class="seg" role="group" aria-label="Période">
            <button type="button" [attr.aria-pressed]="type() === 'semaine'" (click)="type.set('semaine')">Hebdomadaire</button>
            <button type="button" [attr.aria-pressed]="type() === 'mois'" (click)="type.set('mois')">Mensuel</button>
          </div>
        </div>
        <div class="ph-grille">
          <aside class="card ph-form" aria-label="À compléter">
            <label class="field"
              >{{ type() === 'mois' ? 'Mois' : 'Semaine' }}
              <select class="in" #per (change)="choisirPeriode(per.value)">
                @for (p of periodes(); track p.valeur) {
                  <option [value]="p.valeur" [selected]="p.valeur === (type() === 'mois' ? mois() : semaine())">{{ p.libelle }}</option>
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
              >{{ type() === 'mois' ? 'Ce mois-ci' : 'Cette semaine' }} <span class="auto">une ligne par point</span>
              <textarea class="in ph-txt" rows="4" name="actualites" placeholder="Ex. Atelier de cadrage réalisé avec le client" [value]="texte('actualites')" [disabled]="lecture()" #ac
                (input)="brouillon.set({ ...brouillon(), actualites: lignes(ac.value) })" (change)="enregistrer({ actualites: lignes(ac.value) })"></textarea>
            </label>
            <label class="field"
              >Points d’attention · leviers <span class="auto">une ligne par point</span>
              <textarea class="in ph-txt" rows="3" name="attention" placeholder="Ex. Disponibilité du RSSI à sécuriser" [value]="texte('attention')" [disabled]="lecture()" #at
                (input)="brouillon.set({ ...brouillon(), attention: lignes(at.value) })" (change)="enregistrer({ attention: lignes(at.value) })"></textarea>
            </label>
            <fieldset class="ph-ind" [disabled]="lecture()">
              <legend>Indicateurs <span class="auto">{{ dd.periode.colS }} : {{ type() === 'mois' ? 'ce mois' : 'cette semaine' }} · {{ dd.periode.colS1 }} : prévision</span></legend>
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
              @for (m of meteos; track m.cle) {
                <div class="ph-ind-l ph-meteo-l">
                  <span>{{ m.libelle }}</span>
                  <span class="ph-choix" role="radiogroup" aria-label="Météo">
                    @for (x of choixMeteo; track x.v) {
                      <button type="button" class="ph-meteo" role="radio" [attr.aria-checked]="dd[m.cle].meteo === x.v" [title]="x.titre" (click)="meteo(m.cle, { meteo: x.v })">{{ x.icone }}</button>
                    }
                  </span>
                  <span class="ph-choix" role="radiogroup" aria-label="Tendance">
                    @for (x of choixTendance; track x.v) {
                      <button type="button" [class]="'ph-tend n-' + x.v" role="radio" [attr.aria-checked]="dd[m.cle].tendance === x.v" [title]="x.titre" (click)="meteo(m.cle, { tendance: x.v })">{{ x.icone }}</button>
                    }
                  </span>
                </div>
              }
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
              <div class="ph-logos">
                @for (l of logos; track l.cle) {
                  @let img = reglages()[l.cle] || (l.cle === 'logoEntreprise' ? logoDefaut() : null);
                  <div class="ph-logo">
                    <span>{{ l.libelle }}@if (!reglages()[l.cle] && img) { <span class="auto">(par défaut)</span>}</span>
                    @if (img) {
                      <img [src]="img" [alt]="l.libelle" />
                    } @else {
                      <span class="ph-logo-vide">Aucun</span>
                    }
                    @if (!lecture()) {
                      <span class="toolbar">
                        <label class="btn sm">{{ img ? 'Changer' : 'Choisir une image' }}<input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden #f (change)="choisirLogo(l.cle, f)" /></label>
                        @if (reglages()[l.cle]) {
                          <button type="button" class="btn sm ghost" (click)="regler(l.cle, '')">{{ l.cle === 'logoEntreprise' ? 'Revenir au logo par défaut' : 'Retirer' }}</button>
                        }
                      </span>
                    }
                  </div>
                }
              </div>
            </details>
          </aside>
          <section class="ph-apercu" aria-label="Aperçu de la diapositive">
            <div class="ph-barre">
              <span class="muted">Aperçu, identique au fichier PowerPoint (16:9, modifiable)</span><span class="spacer"></span>
              <button type="button" class="btn primary" [disabled]="occupe()" (click)="telecharger()">{{ occupe() ? 'Préparation…' : 'Télécharger le PowerPoint' }}</button>
            </div>
            <div class="ph-cadre" #cadre [style.height.px]="hauteur()">
              <div class="ph-echelle" [style.transform]="'scale(' + echelle() + ')'" [innerHTML]="html()"></div>
            </div>
            <p class="auto">
              Consommé arrêté au {{ fD(dd.periode.fin) }} et valorisé au TJM. Risques : les 3 plus critiques. Actions : les ouvertes par date d’échéance, puis celles faites sur la période.
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
  protected readonly meteos = [{ cle: 'satisfaction', libelle: 'Satisfaction client' }, { cle: 'esprit', libelle: 'État d’esprit de l’équipe' }] as const;
  protected readonly choixMeteo: { v: Meteo; icone: string; titre: string }[] = [
    { v: 'soleil', icone: '☀', titre: 'Content, tout va bien' }, { v: 'nuage', icone: '☁', titre: 'Neutre, pourrait être mieux' }, { v: 'orage', icone: '⛈', titre: 'Insatisfait / démotivé' },
  ];
  protected readonly choixTendance: { v: Tendance; icone: string; titre: string }[] = [
    { v: 'vert', icone: '↗', titre: 'En amélioration' }, { v: 'jaune', icone: '→', titre: 'À surveiller' }, { v: 'rouge', icone: '↘', titre: 'En baisse' },
  ];
  protected readonly champsEquipe: { cle: keyof ReglagesPointHebdo; libelle: string; aide: string }[] = [
    { cle: 'commercial', libelle: 'Commercial', aide: 'Prénom NOM' }, { cle: 'avv', libelle: 'AVV', aide: 'Prénom NOM' },
    { cle: 'pilote', libelle: 'Pilote delivery', aide: 'Prénom NOM' }, { cle: 'modeFacturation', libelle: 'Mode de facturation', aide: 'J.H, UO…' },
  ];
  protected readonly logos = [{ cle: 'logoClient', libelle: 'Logo du client' }, { cle: 'logoEntreprise', libelle: 'Logo de l’entreprise' }] as const;

  // ---- période affichée ----
  private readonly aujourdhui = computed(() => this.vue()?.aujourdhui ?? new Date().toISOString().slice(0, 10));
  protected readonly type = signal<TypePeriode>('semaine');
  protected readonly semaine = linkedSignal(() => lundiDe(this.aujourdhui()));
  protected readonly mois = linkedSignal(() => this.aujourdhui().slice(0, 7));
  private readonly cle = computed(() => clePeriode(this.type(), this.semaine(), this.mois()));
  /** 13 semaines passées et la suivante ; 12 mois passés et le suivant (✓ : point enregistré). */
  protected readonly periodes = computed(() => {
    const p = this.vue()?.projet.pointsHebdo?.periodes ?? {}, auj = this.aujourdhui();
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

  // ---- diapositive ----
  private readonly entree = computed<EntreePointHebdo | null>(() => {
    const v = this.vue();
    if (!v) return null;
    return {
      P: v.P, taches: v.tasks, caTSP: v.m.financier?.caTSP ?? null, chargeAjout: v.m.perimetre.chargeAjout, chargeAnnulee: v.m.perimetre.chargeAnnulee,
      echeancier: v.m.echeancier, risques: v.risquesOuverts, actions: v.projet.actions, fiche: v.projet.fiche, dates: v.projet.dates, iaProfile: v.projet.settings.iaProfile,
    };
  });
  protected readonly d = computed(() => {
    const e = this.entree();
    return e
      ? donneesDiapo(e, { periode: this.type(), semaine: this.semaine(), mois: this.mois(), aujourdhui: this.aujourdhui(), saisie: this.saisie(), reglages: this.reglages(), logoEntrepriseParDefaut: this.logoDefaut() })
      : null;
  });
  // Aperçu : tout texte saisi y est échappé et les images contrôlées (voir apercu()) ; il peut donc être inséré tel quel,
  // ce qui garde les styles de position (Angular les retirerait sinon).
  protected readonly html = computed(() => { const d = this.d(); return this.assainisseur.bypassSecurityTrustHtml(d ? apercu(d) : ''); });

  // ---- mise à l'échelle de l'aperçu (13,333 × 7,5 pouces) ----
  private readonly cadre = viewChild<ElementRef<HTMLElement>>('cadre');
  private readonly largeur = signal(0);
  protected readonly echelle = computed(() => this.largeur() / (13.333 * 96) || 0.5);
  protected readonly hauteur = computed(() => 7.5 * 96 * this.echelle());

  constructor() {
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

  protected valeurReglage(cle: keyof ReglagesPointHebdo): string {
    const r = this.reglages();
    if (cle === 'commercial') return r.commercial ?? this.vue()?.projet.fiche.champs.find((c) => c.key === 'commercial')?.value ?? '';
    if (cle === 'modeFacturation') return r.modeFacturation ?? 'J.H';
    return r[cle] ?? '';
  }

  protected choisirPeriode(valeur: string): void {
    if (this.type() === 'mois') this.mois.set(valeur);
    else this.semaine.set(valeur);
  }

  /** Enregistre la saisie de la période (le serveur la remplace entière). */
  protected async enregistrer(maj: Partial<SaisiePeriode>, genere = false): Promise<boolean> {
    const s = { ...this.saisie(), ...maj }, cle = this.cle();
    const corps: SaisiePeriode = { actualites: s.actualites, attention: s.attention, indicateurs: s.indicateurs, satisfaction: s.satisfaction ?? null, esprit: s.esprit ?? null, extension: s.extension };
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

  protected meteo(cle: 'satisfaction' | 'esprit', maj: Partial<MeteoSaisie>): void {
    const avant = this.saisie()[cle] ?? { meteo: 'soleil', tendance: 'vert' };
    void this.enregistrer({ [cle]: { ...avant, ...maj } });
  }

  protected regler(cle: keyof ReglagesPointHebdo, valeur: string): void {
    void this.etat.saisir((id) => this.api.reglagePointHebdo(id, cle, valeur.trim()));
  }

  protected async choisirLogo(cle: 'logoClient' | 'logoEntreprise', champ: HTMLInputElement): Promise<void> {
    const f = champ.files?.[0];
    champ.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return this.etat.afficher('Image trop lourde (5 Mo au plus).', 'erreur');
    try {
      this.regler(cle, await reduireLogo(f));
    } catch {
      this.etat.afficher('Cette image n’a pas pu être lue.', 'erreur');
    }
  }

  /** Fabrique le PowerPoint dans le navigateur, le propose au téléchargement et note la date de génération. */
  protected async telecharger(): Promise<void> {
    const d = this.d();
    if (!d) return;
    this.occupe.set(true);
    try {
      const Pptx = await chargerPptxGen();
      const blob = (await presentation(Pptx, d).write({ outputType: 'blob' })) as Blob;
      telechargerFichier(blob, nomFichier(d));
      if (!this.lecture()) await this.enregistrer({}, true);
      this.etat.afficher('PowerPoint généré.', 'succes');
    } catch {
      this.etat.afficher('Le PowerPoint n’a pas pu être généré. Rechargez la page et réessayez.', 'erreur');
    } finally {
      this.occupe.set(false);
    }
  }
}
