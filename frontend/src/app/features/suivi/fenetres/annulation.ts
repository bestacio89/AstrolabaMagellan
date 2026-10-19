import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { fE, fJ } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';

/**
 * Annuler une tâche (motif obligatoire, réversible). Le consommé reste ; seul le reste à faire disparaît.
 * Avenant de réduction : le client paie moins (la part vendue non réalisée sort du CA).
 * La décision peut être enregistrée dans le registre.
 */
@Component({
  selector: 'app-fenetre-annulation',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (calc(); as c) {
      <app-modale titre="Annuler la tâche" libelleValider="Annuler la tâche" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <p class="m-ctx">
          Tâche : <b>{{ c.t.label }}</b>
        </p>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Profil</th>
                <th class="n">Prévu</th>
                <th class="n">Consommé</th>
                <th class="n">Annulé (JH)</th>
                <th class="n">Coût évité</th>
              </tr>
            </thead>
            <tbody>
              @for (l of c.lignes; track l.nom) {
                <tr>
                  <td>{{ l.nom }}</td>
                  <td class="n">{{ fJ(l.prevu) }}</td>
                  <td class="n">{{ fJ(l.conso) }}</td>
                  <td class="n">
                    <b>{{ fJ(l.reste) }}</b>
                  </td>
                  <td class="n">{{ fE(l.cout) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="muted">Tout a déjà été consommé : rien à annuler.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="imp-grid">
          <div>
            <span>Charge prévue</span><b>{{ fJ(c.prevuTotal) }} → {{ fJ(c.prevuTotal - c.jh) }} JH</b>
          </div>
          <div>
            <span>Consommé conservé</span><b>{{ fJ(c.t.consoTotal) }} JH</b>
          </div>
          <div>
            <span>CA du forfait</span><b>{{ avenant() ? fE(c.ca) + ' → ' + fE(c.ca - c.caRed) : fE(c.ca) + ' (inchangé)' }}</b>
          </div>
          <div>
            <span>Marge sur production</span>
            <b
              >{{ fE(c.marge) }} → {{ fE(margeApres()) }}
              <small [class]="margeApres() >= c.marge ? 'pos' : 'neg'">({{ margeApres() >= c.marge ? '+' : '' }}{{ fE(margeApres() - c.marge) }})</small></b
            >
          </div>
        </div>
        @if (c.caRed > 0.005) {
          <label class="m-check"
            ><input type="checkbox" name="avenant" [checked]="avenant()" (change)="avenant.set(av.checked)" #av /> Avenant de réduction : le client paie moins (CA −{{
              fE(c.caRed)
            }})</label
          >
        }
        <label class="field"
          >Motif de l’annulation *
          <textarea
            class="in"
            name="motif"
            rows="2"
            placeholder="Ex. Abandon décidé au COPIL du 12/10 : hors priorités client"
            #mo
            (input)="motif.set(mo.value)"
          ></textarea>
        </label>
        <label class="m-check"
          ><input type="checkbox" name="decision" [checked]="decision()" #de (change)="decision.set(de.checked)" /> Enregistrer la décision dans le registre (Actions &
          décisions)</label
        >
        <p class="note">
          La tâche reste visible, barrée, et peut être rétablie. Le consommé déjà saisi est conservé ; plus aucune saisie n’est possible sur la tâche.
        </p>
      </app-modale>
    }
  `,
})
export class FenetreAnnulation {
  readonly uid = input.required<string>();
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);

  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly avenant = signal(false);
  protected readonly decision = signal(true);
  protected readonly motif = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected readonly calc = computed(() => {
    const v = this.etat.vue();
    const t = v?.parUid.get(this.uid());
    if (!v || !t) return null;
    const restes = t.charges.map((c, i) => Math.max(c - t.consoP[i], 0));
    const cjm = (i: number) => v.P[i]?.cjm ?? 0;
    const tjmR = (i: number) => v.P[i]?.tjmR ?? 0;
    const f = v.m.financier;
    return {
      t,
      lignes: restes
        .map((r, i) => ({ nom: v.P[i]?.nom ?? '', prevu: t.charges[i], conso: t.consoP[i], reste: r, cout: r * cjm(i) }))
        .filter((l) => l.reste > 0),
      jh: sum(restes),
      cout: sum(restes.map((r, i) => r * cjm(i))),
      caRed: sum(restes.map((r, i) => Math.min(r, t.chargesV[i]) * tjmR(i))),
      prevuTotal: v.m.total.prevu,
      ca: f?.ca ?? 0,
      marge: f?.marge ?? 0,
      coutFinal: f?.coutFinal ?? 0,
    };
  });

  protected readonly margeApres = computed(() => {
    const c = this.calc();
    if (!c) return 0;
    const ca = c.ca - (this.avenant() ? c.caRed : 0);
    return ca - (c.coutFinal - c.cout);
  });

  protected async valider(): Promise<void> {
    const c = this.calc();
    if (!c) return;
    const motif = this.motif().trim();
    if (!motif) {
      this.erreur.set('Indiquez le motif : il est repris dans le tableau de bord, le registre et les exports.');
      this.modale()?.signalerChamp('motif');
      return;
    }
    const avenant = this.avenant() && c.caRed > 0.005;
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.annuler(id, c.t.uid, motif, avenant, this.decision(), this.etat.versionTache(c.t.uid)));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}
