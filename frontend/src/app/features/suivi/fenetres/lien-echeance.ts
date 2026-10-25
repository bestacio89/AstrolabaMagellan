import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { fE, fJ } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';
import { EtiquetteAjout } from '../ui/tache';

/**
 * Lier une échéance de facturation à des phases (toutes leurs tâches, y compris celles ajoutées plus tard)
 * et/ou à des tâches. Une phase n'appartient qu'à une échéance : la cocher la déplace ici.
 * Une tâche dont la phase est cochée suit la phase (sa case est verrouillée).
 */
@Component({
  selector: 'app-fenetre-lien-echeance',
  imports: [Modale, EtiquetteAjout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (donnees(); as d) {
      <app-modale [titre]="'Lier un périmètre à l’échéance n° ' + d.e.n" libelleValider="Enregistrer les liens" [large]="true" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <p class="m-ctx">
          Échéance <b>n° {{ d.e.n }} — {{ d.e.nom }}</b> · {{ fE(d.e.montant) }}
        </p>
        <fieldset class="m-sec">
          <legend><span class="m-step">1</span>Axe lié</legend>
          <label class="field">Axe (toutes ses tâches, présentes et futures)
            <select class="in" [value]="axeCode() ?? ''" #ax (change)="choisirAxe(ax.value)">
              <option value="">— Aucun axe —</option>
              @for (a of d.axes; track a.id) { <option [value]="a.id" [disabled]="!!a.prisPar || (!!d.e.realiseLe && d.e.axeCode !== a.id)">{{ a.nom }} · {{ a.id }}{{ a.prisPar ? " · prise par l’échéance n° " + a.prisPar : a.facturee ? " · facturée" : "" }}</option> }
            </select>
          </label>
          <p class="note">Les tâches de l’axe suivent cette échéance sauf lorsqu’une phase est liée. Une tâche ne déclenche qu’une facture.</p>
        </fieldset>
        <fieldset class="m-sec">
          <legend><span class="m-step">2</span>Phases liées</legend>
          <p class="note" style="margin: 0">Toutes les tâches de la phase comptent, y compris celles ajoutées plus tard.</p>
          <div class="ph-grid">
            @for (p of d.phases; track p.nom) {
              <label class="ph-opt"
                ><input type="checkbox" [checked]="phasesCochees().has(p.nom)" #cb (change)="cocherPhase(p.nom, cb.checked)" /><span
                  ><b>{{ p.nom }}</b
                  ><small
                    >{{ p.n }} tâche(s) · {{ fJ(p.jh) }} JH{{ p.autre != null ? ' · liée au n° ' + p.autre + ' (la cocher la déplace ici)' : '' }}</small
                  ></span
                ></label
              >
            }
          </div>
        </fieldset>
        <fieldset class="m-sec">
          <legend><span class="m-step">3</span>Tâches liées</legend>
          <input class="in" type="search" placeholder="Filtrer les tâches…" autocomplete="off" #q (input)="filtre.set(q.value)" />
          <div class="tw m-prof ech-tasks">
            <table>
              <tbody>
                @for (t of d.taches; track t.uid) {
                  @if (visible(t.label)) {
                    <tr [class.is-lock]="phasesCochees().has(t.phase) || t.viaPhase || t.viaAxe">
                      <td style="width: 28px">
                        <input
                          type="checkbox"
                          [attr.aria-label]="t.label"
                          [disabled]="phasesCochees().has(t.phase) || t.viaPhase || t.viaAxe"
                          [checked]="phasesCochees().has(t.phase) || t.viaPhase && d.phaseEch[t.phase] === d.e.n || t.viaAxe || tachesCochees().has(t.uid)"
                          #ct
                          (change)="cocherTache(t.uid, ct.checked)"
                        />
                      </td>
                      <td>
                        {{ t.label }}<app-etiquette-ajout [t]="t" />
                        <small class="muted t-note" style="display: block">{{
                          t.viaAxe ? 'incluse via l’axe ' + t.axe : t.viaPhase ? 'incluse via la phase ' + t.phase : phasesCochees().has(t.phase) ? 'incluse via la phase ' + t.phase : t.autre != null ? 'liée à l’échéance n° ' + t.autre + ' — la cocher la déplace ici' : ''
                        }}</small>
                      </td>
                      <td class="muted">{{ t.phase }}</td>
                      <td class="n">{{ fJ(t.charge) }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </fieldset>
      </app-modale>
    }
  `,
})
export class FenetreLienEcheance implements OnInit {
  readonly numero = input.required<number>();
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly phasesCochees = signal(new Set<string>());
  protected readonly tachesCochees = signal(new Set<string>());
  protected readonly axeCode = signal<string | null>(null);
  protected readonly filtre = signal('');
  protected readonly occupe = signal(false);

  protected readonly donnees = computed(() => {
    const v = this.etat.vue();
    const e = v?.m.echeancier.find((x) => x.n === this.numero());
    if (!v || !e) return null;
    const phases = v.phases
      .filter((ph) => v.tasks.some((t) => t.phase === ph))
      .map((ph) => {
        const ts = v.tasks.filter((t) => t.phase === ph);
        const o = v.phaseEch[ph];
        return { nom: ph, n: ts.length, jh: sum(ts.map((t) => t.charge)), autre: o != null && o !== e.n ? o : null };
      });
    const taches = v.tasks.map((t) => ({ ...t, viaAxe: !!e.axeCode && t.axe === e.axeCode && !t.echViaPhase, viaPhase: !!t.echViaPhase, autre: !t.echViaPhase && !t.echViaAxe && t.tr.ech != null && t.tr.ech !== e.n ? t.tr.ech : null }));
    const axes = [...new Set(v.tasks.map((t) => t.axe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')).map((id) => {
      const autre = v.m.echeancier.find((x) => x.n !== e.n && x.axeCode === id);
      return { id, nom: v.projet.axes?.[id] || id, prisPar: autre?.n ?? null, facturee: !!autre?.realiseLe };
    });
    return { e, phases, taches, axes, phaseEch: v.phaseEch };
  });

  ngOnInit(): void {
    const v = this.etat.vue();
    const n = this.numero();
    if (!v) return;
    this.axeCode.set(v.m.echeancier.find((e) => e.n === n)?.axeCode ?? null);
    this.phasesCochees.set(new Set(v.phases.filter((ph) => v.phaseEch[ph] === n)));
    this.tachesCochees.set(new Set(v.tasks.filter((t) => !t.echViaPhase && t.tr.ech === n).map((t) => t.uid)));
  }

  protected visible(label: string): boolean {
    const q = this.filtre().trim().toLowerCase();
    return !q || label.toLowerCase().includes(q);
  }

  protected choisirAxe(code: string): void {
    this.axeCode.set(code || null);
  }

  protected cocherPhase(ph: string, oui: boolean): void {
    if (oui) this.axeCode.set(null);
    this.phasesCochees.update((s) => {
      const n = new Set(s);
      if (oui) n.add(ph);
      else n.delete(ph);
      return n;
    });
    // une tâche qui suivait la phase décochée n'est plus liée
    if (!oui) {
      const v = this.etat.vue();
      const uids = new Set(v?.tasks.filter((t) => t.phase === ph).map((t) => t.uid) ?? []);
      this.tachesCochees.update((s) => new Set([...s].filter((u) => !uids.has(u))));
    }
  }

  protected cocherTache(uid: string, oui: boolean): void {
    if (oui) this.axeCode.set(null);
    this.tachesCochees.update((s) => {
      const n = new Set(s);
      if (oui) n.add(uid);
      else n.delete(uid);
      return n;
    });
  }

  protected async valider(): Promise<void> {
    const v = this.etat.vue();
    if (!v) return;
    const phases = [...this.phasesCochees()];
    // les tâches des phases cochées suivent leur phase : seules les autres sont envoyées
    const taches = [...this.tachesCochees()].filter((u) => !phases.includes(v.parUid.get(u)?.phase ?? '') && !(this.axeCode() && v.parUid.get(u)?.axe === this.axeCode()));
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.perimetreEcheance(id, this.numero(), phases, taches, this.axeCode()));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}
