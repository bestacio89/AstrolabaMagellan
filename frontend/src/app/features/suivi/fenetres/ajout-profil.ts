import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { fE } from '../etat/formats';
import { lireNombre } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { libelleProfil } from '../etat/vue';
import { Modale } from '../ui/modale';
import { ChampsNouveauProfil, lireNouveauProfil, profilVide, SaisieProfil } from './nouveau-profil';

/**
 * Parcours A — ajouter un profil à une tâche (profil existant ou nouveau profil projet).
 * Un ajout n'est jamais facturé : le CA reste celui du TSP, son coût (charge × CJM) réduit la marge.
 */
@Component({
  selector: 'app-fenetre-ajout-profil',
  imports: [Modale, ChampsNouveauProfil],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (t(); as t) {
      <app-modale titre="Ajouter un profil à la tâche" libelleValider="Ajouter le profil" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <p class="m-ctx">
          Tâche : <b>{{ t.label }}</b>
        </p>
        <label class="field"
          >Profil
          <select class="in" name="prof" #pr (change)="choix.set(pr.value)">
            @for (p of disponibles(); track p.i) {
              <option [value]="p.i" [selected]="choix() === '' + p.i">{{ libelle(p) }}</option>
            }
            <option value="__new" [selected]="choix() === '__new'">+ Nouveau profil…</option>
          </select>
        </label>
        @if (choix() === '__new') {
          <div class="newprof">
            <p class="note">Le nouveau profil rejoint la liste des profils du projet (hors onglet Profil du TSP).</p>
            <app-champs-nouveau-profil [valeur]="nouveau" />
          </div>
        }
        <div class="fgrid">
          <label class="field">Charge ajoutée (JH) *<input class="in" name="jh" inputmode="decimal" placeholder="Ex. 2" #j (input)="jh.set(j.value)" /></label>
          <div class="field">
            Coût estimé<b class="m-cost">{{ cout() }}</b>
          </div>
        </div>
        <label class="field"
          >Motif *
          <textarea class="in" name="motif" rows="2" placeholder="Ex. Renfort demandé au COPIL du 12/10" #m (input)="motif.set(m.value)"></textarea>
        </label>
        <p class="m-sum">
          <span class="tag-aj">non facturé</span><span class="muted">Le CA reste celui du TSP ; le coût (charge × CJM) réduit la marge.</span>
        </p>
      </app-modale>
    }
  `,
})
export class FenetreAjoutProfil {
  readonly uid = input.required<string>();
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);

  protected readonly t = computed(() => this.etat.vue()?.parUid.get(this.uid()) ?? null);
  /** Profils pas encore chiffrés sur la tâche. */
  protected readonly disponibles = computed(() => {
    const v = this.etat.vue(),
      t = this.t();
    return v && t ? v.P.filter((p) => p.nom && !(t.charges[p.i] > 0)) : [];
  });
  protected readonly choix = linkedSignal(() => (this.disponibles().length ? String(this.disponibles()[0].i) : '__new'));
  protected readonly nouveau = signal<SaisieProfil>(profilVide());
  protected readonly jh = signal('');
  protected readonly motif = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected readonly cout = computed(() => {
    const jh = lireNombre(this.jh());
    const v = this.etat.vue();
    const cjm = this.choix() === '__new' ? lireNombre(this.nouveau().cjm) : (v?.P[+this.choix()]?.cjm ?? null);
    return jh != null && jh > 0 && cjm != null && cjm > 0 ? fE(jh * cjm) : '—';
  });

  protected libelle(p: Parameters<typeof libelleProfil>[0]): string {
    return libelleProfil(p, fE);
  }

  private echec(message: string, champ: string | null): void {
    this.erreur.set(message);
    this.modale()?.signalerChamp(champ);
  }

  protected async valider(): Promise<void> {
    const v = this.etat.vue(),
      t = this.t();
    if (!v || !t) return;
    let nouveauProfil = null;
    let profilId: string | null = null;
    if (this.choix() === '__new') {
      const [p, e, champ] = lireNouveauProfil(v, this.nouveau());
      if (e) return this.echec(e, champ);
      nouveauProfil = p;
    } else profilId = v.P[+this.choix()]?.id ?? null;
    const jh = lireNombre(this.jh());
    if (!(jh != null && jh > 0)) return this.echec('Saisissez la charge ajoutée en jours (ex. 0,5 ou 2).', 'jh');
    const motif = this.motif().trim();
    if (!motif) return this.echec('Indiquez le motif : il apparaît dans le tableau de bord et l’export COPIL.', 'motif');
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.ajouterProfil(id, t.uid, { profilId, nouveauProfil, jh, motif }));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}
