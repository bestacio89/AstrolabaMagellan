import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { fE, fJ, fJz } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { filteredTasks, idName } from '../etat/vue';
import { BarreFiltres } from '../ui/barre-filtres';

interface LigneChiffrage {
  cle: string;
  section: boolean;
  axe: string;
  sansAxe: boolean;
  lot: string;
  phase: string;
  etape: string;
  label: string;
  charges: number[];
  charge: number;
  valo: number | undefined;
}

/** Chiffrage du TSP tel que vendu (onglet WORKLOAD) : charge par tâche et par profil, sans les ajouts en cours de projet. */
import { Fx } from '../ui/fx';
@Component({
  selector: 'app-chiffrage',
  imports: [BarreFiltres, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Chiffrage</h2>
        <p>Le chiffrage du TSP tel que vendu (onglet WORKLOAD) : charge par tâche et par profil. Les ajouts en cours de projet n’y figurent pas. <app-fx cle="chiffrage" /></p>
      </div>
    </div>
    @if (vm(); as m) {
      <app-barre-filtres />
      <p class="sub">
        {{ m.profils.length }} profil(s) au TSP.{{ m.montants ? ' Valorisation = charge × TJM' + (m.remise ? ' remisé' : '') + '.' : '' }}{{
          m.ajouts ? ' Chiffrage vendu : les ajouts en cours de projet n’y figurent pas.' : ''
        }}
      </p>
      <div class="tw tall">
        <table>
          <thead>
            <tr>
              <th>Axe</th>
              <th>Lot</th>
              <th>Phase</th>
              <th>Étape</th>
              <th>Tâche</th>
              @for (p of m.profils; track p.i) {
                <th class="n">{{ p.nom || 'Profil ' + (p.i + 1) }}</th>
              }
              <th class="n">Total JH</th>
              @if (m.montants) {
                <th class="n">Valorisation</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (l of m.lignes; track l.cle) {
              @if (l.section) {
                <tr class="sec">
                  <td>{{ l.axe }}</td>
                  <td>{{ l.lot }}</td>
                  <td></td>
                  <td></td>
                  <td class="lbl">{{ l.label }}</td>
                  @for (p of m.profils; track p.i) {
                    <td></td>
                  }
                  <td></td>
                  @if (m.montants) {
                    <td></td>
                  }
                </tr>
              } @else {
                <tr>
                  <td>
                    @if (l.sansAxe) {
                      <span class="flag">Sans axe</span>
                    } @else {
                      {{ l.axe }}
                    }
                  </td>
                  <td>{{ l.lot }}</td>
                  <td>{{ l.phase }}</td>
                  <td>{{ l.etape }}</td>
                  <td class="lbl wrap-t">{{ l.label }}</td>
                  @for (p of m.profils; track p.i) {
                    <td class="n">{{ fJz(l.charges[p.i]) }}</td>
                  }
                  <td class="n">{{ fJ(l.charge) }}</td>
                  @if (m.montants) {
                    <td class="n">{{ fE(l.valo) }}</td>
                  }
                </tr>
              }
            }
            <tr class="total">
              <td>TOTAL</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              @for (p of m.profils; track p.i) {
                <td class="n">{{ fJ(m.totalProfil[p.i]) }}</td>
              }
              <td class="n">{{ fJ(m.total) }}</td>
              @if (m.montants) {
                <td class="n">{{ fE(m.totalValo) }}</td>
              }
            </tr>
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Chiffrage {
  private readonly etat = inject(SuiviEtat);
  private readonly ui = inject(UiEtat);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const u = this.ui.ui();
    // profils du TSP (ni ajoutés en cours de projet, ni vides)
    const profils = v.P.filter((p) => !p.ajout && (p.nom || v.m.profils[p.i]?.charge));
    const taches = filteredTasks(v, u).filter((t) => !t.estAjout);
    const lignes: (LigneChiffrage & { ordre: number })[] = taches.map((t) => ({
      cle: t.uid,
      ordre: t.ligne ?? 1e9,
      section: false,
      axe: t.id ? idName(v, t.id) : '',
      sansAxe: !t.id,
      lot: t.lot,
      phase: t.phase,
      etape: t.etape,
      label: t.label,
      charges: t.chargesV,
      charge: t.chargeTSP,
      valo: t.valo,
    }));
    if (!u.q && !u.axe) {
      for (const s of v.projet.tasks.filter((x) => x.section)) {
        lignes.push({ cle: s.uid, ordre: s.ligne ?? 1e9, section: true, axe: s.id, sansAxe: false, lot: s.lot, phase: '', etape: '', label: s.label, charges: [], charge: 0, valo: 0 });
      }
    }
    lignes.sort((a, b) => a.ordre - b.ordre);
    return {
      profils,
      lignes,
      montants: v.droits.voitMontants,
      remise: !!v.projet.remise,
      ajouts: v.m.perimetre.lignes.length > 0,
      totalProfil: v.P.map((p) => sum(taches.map((t) => t.chargesV[p.i]))),
      total: sum(taches.map((t) => t.chargeTSP)),
      totalValo: sum(taches.map((t) => t.valo ?? 0)),
    };
  });
}
