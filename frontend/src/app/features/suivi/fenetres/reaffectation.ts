import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { fE, fJ } from '../etat/formats';
import { lireNombre, round } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { reaffectable as reaffectableDe, TacheVue, taskProfiles } from '../etat/vue';
import { Modale } from '../ui/modale';
import { lireNouveauProfil } from './nouveau-profil';

/**
 * Réaffecter la charge d'un profil : une partie de ce qui reste à faire passe à une autre personne,
 * déjà sur le projet ou nouvelle (même rôle). Le total de la tâche et le CA ne changent pas ;
 * seul le coût varie si les deux personnes n'ont pas le même CJM.
 */
@Component({
  selector: 'app-fenetre-reaffectation',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (t(); as t) {
      <app-modale titre="Réaffecter la charge" [libelleValider]="libelleValider()" [large]="true" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <p class="m-ctx">
          Tâche : <b>{{ t.label }}</b>. Une partie de la charge passe d’une personne à une autre ; le total de la tâche ne change pas.
        </p>
        @if (de() != null) {
          <div class="m-reaff-de">
            <span class="muted">De</span>
            <b>{{ nom(i()) }}</b>
            <span class="muted"
              >Prévu {{ fJ(t.charges[i()]) }} JH · consommé {{ fJ(t.consoP[i()]) }} · <b>{{ fJ(max()) }} JH réaffectable{{ max() > 1 ? 's' : '' }}</b> (on ne réaffecte pas
              ce qui est déjà consommé)</span
            >
          </div>
        } @else {
          <label class="field"
            >De *
            <select class="in" name="de" #d (change)="choixDe.set(+d.value)">
              @for (s of sources(); track s) {
                <option [value]="s" [selected]="s === i()">{{ nom(s) }} — {{ fJ(reaffectable(t, s)) }} JH réaffectable{{ reaffectable(t, s) > 1 ? 's' : '' }}</option>
              }
            </select>
          </label>
        }
        <div class="field">
          Charge à réaffecter (JH) *
          <div class="toolbar" style="gap: 8px">
            <input
              class="in w-num"
              name="jh"
              inputmode="decimal"
              placeholder="Ex. 0,5"
              aria-label="Charge à réaffecter (JH)"
              style="width: 110px; flex: none; text-align: right"
              [value]="jh()"
              #j
              (input)="jh.set(j.value)"
            />
            <button type="button" class="btn sm" (click)="jh.set(fJ(round(max() / 2, 2)))">La moitié</button>
            <button type="button" class="btn sm" (click)="jh.set(fJ(max()))">Tout</button>
          </div>
        </div>
        <fieldset class="m-sec m-reaff-vers">
          <legend>Vers *</legend>
          <label class="m-radio"
            ><input type="radio" name="vers" value="exist" [checked]="!nouveau()" [disabled]="!cibles().length" (change)="nouveau.set(false)" /> Une personne déjà sur le
            projet
            <select class="in" name="versI" aria-label="Profil du projet" [disabled]="nouveau()" #vi (change)="choixVers.set(+vi.value)">
              @for (p of cibles(); track p.i) {
                <option [value]="p.i" [selected]="p.i === versI()">{{ p.nom }}</option>
              }
            </select>
          </label>
          <label class="m-radio"><input type="radio" name="vers" value="new" [checked]="nouveau()" (change)="nouveau.set(true)" /> Une nouvelle personne, même rôle</label>
          @if (nouveau()) {
            <div class="m-reaff-new fgrid">
              <label class="field span2"
                >Collaborateur *<input class="in" name="collab" placeholder="Prénom Nom" autocomplete="off" [value]="collab()" #c (input)="collab.set(c.value)"
              /></label>
              <label class="field">TJM (€)<input class="in" name="tjm" inputmode="decimal" [value]="tjm()" #tj (input)="tjm.set(tj.value)" /></label>
              <label class="field">CJM (€)<input class="in" name="cjm" inputmode="decimal" [value]="cjm()" #cj (input)="cjm.set(cj.value)" /></label>
              <span class="auto span2">Repris du profil d’origine ({{ base().nom }}, {{ base().entite || 'FO' }}) ; modifiable si la personne n’a pas le même coût.</span>
            </div>
          }
        </fieldset>
        <label class="field"
          >Motif *
          <textarea class="in" name="motif" rows="2" placeholder="Ex. Renfort pendant les congés de la personne prévue" #m (input)="motif.set(m.value)"></textarea>
        </label>
        <table class="m-reaff-t">
          <thead>
            <tr>
              <th>Après réaffectation</th>
              <th class="n">Avant</th>
              <th class="n">Après</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{{ nom(i()) }}</td>
              <td class="n">{{ fJ(t.charges[i()]) }} JH</td>
              <td class="n"><b>{{ okJh() ? fJ(t.charges[i()] - (jhNum() ?? 0)) : '—' }} JH</b></td>
            </tr>
            <tr>
              <td>{{ nomVers() || '—' }}</td>
              <td class="n">{{ avantVers() ? fJ(avantVers()) + ' JH' : '—' }}</td>
              <td class="n"><b>{{ okJh() ? fJ(avantVers() + (jhNum() ?? 0)) : '—' }} JH</b></td>
            </tr>
            <tr class="total">
              <td>Total de la tâche</td>
              <td class="n">{{ fJ(t.charge) }} JH</td>
              <td class="n">{{ fJ(t.charge) }} JH</td>
            </tr>
          </tbody>
        </table>
        <p class="m-reaff-cout">
          @if (ecartCout(); as e) {
            <span class="pill" [class]="'pill ' + (e.v > 0.5 ? 'lv-critique' : 'lv-ok')">Coût : {{ e.v < -0.5 ? '−' : '+' }}{{ fE(abs(e.v)) }}</span>
            <span class="muted">{{ abs(e.v) < 0.5 ? 'même CJM' : 'CJM ' + fE(e.de) + ' → ' + fE(e.vers) }} · CA inchangé (le vendu reste celui du TSP)</span>
          } @else {
            <span class="muted">Indiquez la charge pour voir l’effet sur le coût.</span>
          }
        </p>
      </app-modale>
    }
  `,
})
export class FenetreReaffectation {
  readonly uid = input.required<string>();
  /** Profil d'origine choisi depuis sa ligne ; null : à choisir dans la fenêtre. */
  readonly de = input<number | null>(null);
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly fJ = fJ;
  protected readonly fE = fE;
  protected readonly round = round;
  protected readonly abs = Math.abs;
  /** Profil de l'enveloppe IA : ni source ni destination. */
  private readonly ia = computed(() => this.etat.vue()?.projet.settings.iaProfile ?? -1);
  protected reaffectable(t: TacheVue, i: number): number {
    return reaffectableDe(t, i, this.ia());
  }

  protected readonly t = computed(() => this.etat.vue()?.parUid.get(this.uid()) ?? null);
  /** Profils de la tâche qui ont encore de la charge à réaffecter. */
  protected readonly sources = computed(() => {
    const t = this.t();
    return t ? taskProfiles(t).filter((i) => this.reaffectable(t, i) > 0) : [];
  });
  protected readonly choixDe = linkedSignal(() => this.de() ?? this.sources()[0] ?? 0);
  /** Profil d'origine. */
  protected readonly i = computed(() => this.de() ?? this.choixDe());
  protected readonly max = computed(() => {
    const t = this.t();
    return t ? this.reaffectable(t, this.i()) : 0;
  });
  /** Profil d'origine tel qu'il a été saisi (rôle sans le collaborateur, entité, prix). */
  protected readonly base = computed(() => {
    const v = this.etat.vue(),
      p = v?.P[this.i()];
    return { nom: p?.nomBase || p?.nom || '', entite: p?.entite || 'FO', tjm: p?.tjm ?? null, cjm: p?.cjm ?? null };
  });
  /** Personnes du projet qui peuvent reprendre la charge. */
  protected readonly cibles = computed(() => (this.etat.vue()?.P ?? []).filter((p) => p.nom && p.i !== this.i() && p.i !== this.ia()));
  protected readonly choixVers = linkedSignal(() => this.cibles()[0]?.i ?? -1);
  protected readonly versI = computed(() => (this.cibles().some((p) => p.i === this.choixVers()) ? this.choixVers() : (this.cibles()[0]?.i ?? -1)));
  protected readonly nouveau = signal(true);
  protected readonly jh = signal('');
  protected readonly collab = signal('');
  // TJM et CJM repris de la personne d'origine (à nouveau quand elle change)
  protected readonly tjm = linkedSignal(() => (this.base().tjm != null ? fJ(this.base().tjm) : ''));
  protected readonly cjm = linkedSignal(() => (this.base().cjm != null ? fJ(this.base().cjm) : ''));
  protected readonly motif = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected readonly jhNum = computed(() => {
    const n = lireNombre(this.jh());
    return n == null ? null : round(n, 2);
  });
  protected readonly okJh = computed(() => {
    const n = this.jhNum();
    return n != null && n > 0 && n <= this.max() + 1e-9;
  });
  protected readonly nomVers = computed(() => {
    if (!this.nouveau()) return this.nom(this.versI());
    const c = this.collab().trim();
    return this.base().nom + (c ? ' — ' + c : '');
  });
  protected readonly avantVers = computed(() => (this.nouveau() ? 0 : (this.t()?.charges[this.versI()] ?? 0)));
  protected readonly ecartCout = computed(() => {
    const v = this.etat.vue(),
      n = this.jhNum();
    const cjmDe = v?.P[this.i()]?.cjm ?? 0;
    const cjmVers = this.nouveau() ? lireNombre(this.cjm()) : (v?.P[this.versI()]?.cjm ?? null);
    if (!this.okJh() || n == null || cjmVers == null || !(cjmVers > 0)) return null;
    return { v: n * (cjmVers - cjmDe), de: cjmDe, vers: cjmVers };
  });
  protected readonly libelleValider = computed(() => (this.okJh() ? `Réaffecter ${fJ(this.jhNum())} JH` : 'Réaffecter'));

  protected nom(i: number): string {
    return this.etat.vue()?.P[i]?.nom ?? '';
  }

  private echec(message: string, champ: string | null): void {
    this.erreur.set(message);
    this.modale()?.signalerChamp(champ);
  }

  protected async valider(): Promise<void> {
    const v = this.etat.vue(),
      t = this.t();
    if (!v || !t) return;
    const i = this.i(),
      jh = this.jhNum(),
      max = this.max();
    if (!(jh != null && jh > 0)) return this.echec('Saisissez la charge à réaffecter en jours (ex. 0,5).', 'jh');
    if (jh > max + 1e-9) return this.echec(`Au plus ${fJ(max)} JH : c’est ce qui reste à faire pour ${this.nom(i)} (le consommé ne se réaffecte pas).`, 'jh');
    let versProfilId: string | null = null,
      collaborateur: string | null = null,
      tjm: number | null = null,
      cjm: number | null = null;
    if (this.nouveau()) {
      if (!this.collab().trim()) return this.echec('Indiquez le nom de la personne qui reprend cette charge.', 'collab');
      const b = this.base();
      const [p, e, champ] = lireNouveauProfil(v, { nom: b.nom, entite: b.entite, tjm: this.tjm(), cjm: this.cjm(), collaborateur: this.collab() });
      if (e || !p) return this.echec(e ?? '', champ === 'collaborateur' ? 'collab' : champ);
      collaborateur = p.collaborateur;
      tjm = p.tjm;
      cjm = p.cjm;
    } else {
      const j = this.versI();
      if (!(j >= 0) || j === i) return this.echec('Choisissez la personne qui reprend cette charge.', 'versI');
      versProfilId = v.P[j]?.id ?? null;
    }
    const motif = this.motif().trim();
    if (!motif) return this.echec('Indiquez le motif : il apparaît dans Rentabilité › Évolutions du périmètre et dans les exports.', 'motif');
    const deProfilId = v.P[i]?.id;
    if (!deProfilId) return this.echec('Profil introuvable : rechargez la page.', null);
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.reaffecter(id, t.uid, { deProfilId, versProfilId, collaborateur, tjm, cjm, jh, motif }));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}
