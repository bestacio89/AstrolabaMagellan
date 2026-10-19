import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { NouveauProfil, SuiviApi } from '../api/suivi.api';
import { fE, fJ } from '../etat/formats';
import { lireNombre } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { idName } from '../etat/vue';
import { Modale } from '../ui/modale';
import { ChampsNouveauProfil, lireNouveauProfil, profilVide, SaisieProfil } from './nouveau-profil';

/**
 * Parcours B — créer une tâche, avec les mêmes propriétés qu'une ligne du WORKLOAD du TSP.
 * La charge est un ajout non facturé (le CA ne change pas, le coût réduit la marge) ; le motif est obligatoire.
 * Le groupe de la tâche (axe, lot ou phase) est prérempli quand on la crée depuis un groupe.
 */
@Component({
  selector: 'app-fenetre-nouvelle-tache',
  imports: [Modale, ChampsNouveauProfil],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      <app-modale titre="Nouvelle tâche" libelleValider="Créer la tâche" [large]="true" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <fieldset class="m-sec">
          <legend><span class="m-step">1</span>La tâche</legend>
          <div class="fgrid">
            <label class="field span2"
              >Intitulé *<input class="in" name="label" placeholder="Ex. [Atelier] Revue des politiques Purview" autocomplete="off" #lb (input)="label.set(lb.value)"
            /></label>
            <label class="field"
              >Axe
              <select class="in" name="id" title="Colonne A du TSP" #ax (change)="axe.set(ax.value)">
                <option value="">— Aucun —</option>
                @for (x of v.axeIds; track x) {
                  <option [value]="x" [selected]="x === axe()">{{ x }} — {{ nomAxe(x) }}</option>
                }
              </select>
            </label>
            <label class="field"
              >Lot<input class="in" title="Colonne B du TSP" name="lot" list="dl-nlots" placeholder="Ex. 1.1" [value]="lot()" #lo (input)="lot.set(lo.value)" />
              <datalist id="dl-nlots">
                @for (x of v.lots; track x) {
                  <option [value]="x"></option>
                }
              </datalist>
            </label>
            <label class="field"
              >Phase
              <select class="in" name="phase" title="Colonne C du TSP" #ph (change)="phase.set(ph.value)">
                <option value="">— Aucune —</option>
                @for (x of v.phases; track x) {
                  <option [value]="x" [selected]="x === phase()">{{ x }}</option>
                }
              </select>
            </label>
            <label class="field"
              >Étape
              <select class="in" name="etape" title="Colonne D du TSP" #et (change)="etape.set(et.value)">
                <option value="">— Aucune —</option>
                @for (x of v.etapes; track x) {
                  <option [value]="x">{{ x }}</option>
                }
              </select>
            </label>
            <label class="field"
              >Type
              <select class="in" name="type" #ty (change)="type.set(ty.value)">
                <option value="">Détection automatique</option>
                @for (x of v.projet.types; track x.id) {
                  <option [value]="x.id">{{ x.nom }}</option>
                }
              </select>
            </label>
            <span></span>
            <label class="field">Début prévu<input class="in" type="date" name="debut" #db (change)="debut.set(db.value)" /></label>
            <label class="field">Fin prévue<input class="in" type="date" name="fin" #fn (change)="fin.set(fn.value)" /></label>
          </div>
        </fieldset>
        <fieldset class="m-sec">
          <legend><span class="m-step">2</span>Charge prévue par profil</legend>
          <div class="tw m-prof">
            <table>
              <thead>
                <tr>
                  <th>Profil</th>
                  <th class="n">TJM</th>
                  <th class="n">CJM</th>
                  <th class="n">Prévu (JH)</th>
                </tr>
              </thead>
              <tbody>
                @for (p of profils(); track p.i) {
                  <tr>
                    <td>
                      {{ p.nom }}
                      @if (p.ajout) {
                        <span class="tag-aj">ajouté</span>
                      }
                    </td>
                    <td class="n muted">{{ fE(p.tjm) }}</td>
                    <td class="n muted">{{ fE(p.cjm) }}</td>
                    <td class="n">
                      <input class="in w-num" [name]="'c' + p.i" inputmode="decimal" placeholder="0" [attr.aria-label]="'Charge ' + p.nom" #ch (input)="charge(p.i, ch.value)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <label class="m-check"
            ><input type="checkbox" name="withNew" #wn (change)="avecNouveau.set(wn.checked)" /> Le profil nécessaire n’existe pas : créer un nouveau profil</label
          >
          @if (avecNouveau()) {
            <div class="newprof">
              <app-champs-nouveau-profil [valeur]="nouveau" prefixe="np_" />
              <label class="field" style="max-width: 280px"
                >Charge du nouveau profil (JH) *<input class="in" name="np_jh" inputmode="decimal" placeholder="Ex. 1,5" #nj (input)="nouveauJh.set(nj.value)"
              /></label>
            </div>
          }
          <div class="m-sum">
            <span
              >Total <b class="m-tot">{{ fJ(totaux().jh) }}</b> JH</span
            ><span
              >Coût estimé <b class="m-cost">{{ fE(totaux().cout) }}</b></span
            ><span class="tag-aj">non facturé</span>
          </div>
        </fieldset>
        <fieldset class="m-sec">
          <legend><span class="m-step">3</span>Justification</legend>
          <label class="field"
            >Motif de l’ajout *
            <textarea
              class="in"
              name="motif"
              rows="2"
              placeholder="Ex. Atelier supplémentaire demandé par le client au COPIL du 12/10"
              #mo
              (input)="motif.set(mo.value)"
            ></textarea>
          </label>
          <label class="field"
            >Hypothèse / description<input
              class="in"
              name="hypothese"
              placeholder="Facultatif — équivalent de la colonne Hypothèse du TSP"
              #hy
              (input)="hypothese.set(hy.value)"
          /></label>
        </fieldset>
      </app-modale>
    }
  `,
})
export class FenetreNouvelleTache implements OnInit {
  /** Groupe d'où l'on crée la tâche (selon le regroupement : code d'axe, lot ou phase). */
  readonly groupe = input<string | null>(null);
  readonly fermer = output<void>();
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly fE = fE;
  protected readonly fJ = fJ;

  protected readonly label = signal('');
  protected readonly axe = signal('');
  protected readonly lot = signal('');
  protected readonly phase = signal('');
  protected readonly etape = signal('');
  protected readonly type = signal('');
  protected readonly debut = signal('');
  protected readonly fin = signal('');
  protected readonly charges = signal<Record<number, string>>({});
  protected readonly avecNouveau = signal(false);
  protected readonly nouveau = signal<SaisieProfil>(profilVide());
  protected readonly nouveauJh = signal('');
  protected readonly motif = signal('');
  protected readonly hypothese = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected readonly profils = computed(() => this.etat.vue()?.P.filter((p) => p.nom) ?? []);

  protected readonly totaux = computed(() => {
    let jh = 0,
      cout = 0;
    for (const p of this.profils()) {
      const n = lireNombre(this.charges()[p.i] ?? '');
      if (n != null && n > 0) {
        jh += n;
        cout += n * (p.cjm ?? 0);
      }
    }
    if (this.avecNouveau()) {
      const n = lireNombre(this.nouveauJh()),
        c = lireNombre(this.nouveau().cjm);
      if (n != null && n > 0) {
        jh += n;
        cout += n * (c != null && c > 0 ? c : 0);
      }
    }
    return { jh, cout };
  });

  ngOnInit(): void {
    const g = this.groupe();
    const dim = this.etat.vue()?.m.dim.key;
    if (g) {
      if (dim === 'phase') this.phase.set(g);
      else if (dim === 'lot') this.lot.set(g);
      else this.axe.set(g);
    }
  }

  protected nomAxe(id: string): string {
    const v = this.etat.vue();
    return v ? idName(v, id) : id;
  }

  protected charge(i: number, valeur: string): void {
    this.charges.update((c) => ({ ...c, [i]: valeur }));
  }

  private echec(message: string, champ: string | null): void {
    this.erreur.set(message);
    this.modale()?.signalerChamp(champ);
  }

  protected async valider(): Promise<void> {
    const v = this.etat.vue();
    if (!v) return;
    const label = this.label().trim();
    if (!label) return this.echec('Saisissez l’intitulé de la tâche.', 'label');
    const charges: { profilId: string; jh: number }[] = [];
    for (const p of this.profils()) {
      const n = lireNombre(this.charges()[p.i] ?? '');
      if (n != null && (isNaN(n) || n < 0)) return this.echec(`Charge invalide pour « ${p.nom} » : saisissez un nombre de jours.`, 'c' + p.i);
      if (n != null && n > 0) charges.push({ profilId: p.id, jh: n });
    }
    let nouveauProfil: NouveauProfil | null = null;
    let nouveauProfilJh: number | null = null;
    if (this.avecNouveau()) {
      const [np, e, champ] = lireNouveauProfil(v, this.nouveau(), 'np_');
      if (e) return this.echec(e, champ);
      nouveauProfil = np;
      nouveauProfilJh = lireNombre(this.nouveauJh());
      if (!(nouveauProfilJh != null && nouveauProfilJh > 0)) return this.echec('Saisissez la charge du nouveau profil.', 'np_jh');
    }
    if (!(this.totaux().jh > 0)) return this.echec('Indiquez la charge prévue d’au moins un profil.', this.profils()[0] ? 'c' + this.profils()[0].i : null);
    if (this.debut() && this.fin() && this.fin() < this.debut()) return this.echec('La fin prévue doit être postérieure au début.', 'fin');
    const motif = this.motif().trim();
    if (!motif) return this.echec('Indiquez le motif : il apparaît dans le tableau de bord et l’export COPIL.', 'motif');
    this.occupe.set(true);
    const r = await this.etat.saisir((id) =>
      this.api.nouvelleTache(id, {
        label,
        axe: this.axe(),
        lot: this.lot().trim(),
        phase: this.phase(),
        etape: this.etape(),
        type: this.type(),
        debut: this.debut() || null,
        fin: this.fin() || null,
        charges,
        nouveauProfil,
        nouveauProfilJh,
        motif,
        hypothese: this.hypothese().trim(),
        apres: null,
      }),
    );
    this.occupe.set(false);
    if (!r) return;
    this.fermer.emit();
    if (r.ouvrir) this.etat.ouvrirTache(r.ouvrir);
  }
}
