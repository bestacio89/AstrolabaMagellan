import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuiviApi } from '../api/suivi.api';
import { ABS, ABS_SUITE, equipe, indexAbsences, joursAbsence, Moment, PersonneAbsences } from '../etat/absences.logique';
import { fD, fJ, fML } from '../etat/formats';
import { dow, holidayName, isWorkday, monthDays } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';

/**
 * Pilotage › Absences (version HTML de référence, 55c-absences.js) : qui est absent, et quand, sur la période du projet.
 * Une ligne par collaborateur (nommé sur un profil, ou ajouté à la main), une colonne par jour ; un clic sur une case fait défiler
 * journée → matin → après-midi → présent (chef de projet). Chacun saisit aussi ses propres absences dans « Mon travail » :
 * une absence appartient à la personne et apparaît sur tous ses projets. Aucun effet sur les charges ni sur les calculs.
 */
@Component({
  selector: 'app-absences',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vm(); as m) {
      @let v = m.v;
      <div class="sechead">
        <div>
          <h2>Absences</h2>
          <p>
            Qui est absent, et quand : une demi-journée (matin ou après-midi) ou une journée entière. Sur la période du projet{{
              v.m.cal.debut ? ' (du ' + fD(v.m.cal.debut) + ' au ' + fD(v.m.cal.finPrevue) + ')' : ''
            }}, réglée dans ⚙ Paramètres du projet. Chacun peut aussi saisir les siennes dans « Mon travail ». Aucun effet sur les charges ni sur les calculs : la saisie
            du consommé signale simplement les jours d’absence.
          </p>
        </div>
      </div>
      @if (!m.personnes.length) {
        <div class="card empty abs-vide">
          Aucun collaborateur n’est nommé sur les profils du projet.
          <a class="btn sm primary" routerLink="../profils">Nommer les collaborateurs</a>
          @if (m.modif) {
            <button type="button" class="btn sm" (click)="etat.fenetre.set({ type: 'personne' })">+ Ajouter une personne</button>
          }
        </div>
      } @else {
        <div class="toolbar barre-f">
          <div class="field">
            Mois
            <div class="mois-nav">
              <button class="btn sm icone" type="button" [disabled]="m.k <= 0" aria-label="Mois précédent" title="Mois précédent" (click)="ui.maj({ absMois: m.mois[m.k - 1] })">◀</button>
              <select class="in" aria-label="Mois affiché" #ms (change)="ui.maj({ absMois: ms.value })">
                @for (x of m.mois; track x) {
                  <option [value]="x" [selected]="x === m.mk">{{ fML(x) }}</option>
                }
              </select>
              <button
                class="btn sm icone"
                type="button"
                [disabled]="m.k >= m.mois.length - 1"
                aria-label="Mois suivant"
                title="Mois suivant"
                (click)="ui.maj({ absMois: m.mois[m.k + 1] })"
              >
                ▶
              </button>
              @if (m.mois.includes(m.moisCourant)) {
                <button class="btn sm ghost" type="button" (click)="ui.maj({ absMois: m.moisCourant })">Ce mois-ci</button>
              }
            </div>
          </div>
          <span class="spacer"></span>
          @if (m.modif) {
            <button type="button" class="btn sm" title="Ajouter une personne qui n’est sur aucun profil (renfort, sous-traitant…)" (click)="etat.fenetre.set({ type: 'personne' })">
              + Ajouter une personne
            </button>
          }
          <span class="chips"
            ><span>{{ m.ouvres.length }} jours ouvrés</span><span>{{ m.personnes.length }} collaborateur{{ m.personnes.length > 1 ? 's' : '' }}</span></span
          >
        </div>
        <section class="card abs-carte">
          <header>
            <div>
              <h2>{{ fML(m.mk) }}</h2>
            </div>
          </header>
          <div class="tw">
            <table class="abs-table" role="grid" [attr.aria-label]="'Absences de ' + fML(m.mk)">
              <thead>
                <tr>
                  <th class="abs-p">Collaborateur</th>
                  @for (d of m.jours; track d.iso) {
                    <th class="abs-d" [class.off]="!d.ouvre" [class.today]="d.iso === v.aujourdhui" [title]="d.ferie || fD(d.iso)">
                      {{ d.num }}<span>{{ d.lettre }}</span>
                    </th>
                  }
                  <th class="abs-t n">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (p of m.personnes; track p.cle) {
                  <tr>
                    <th scope="row" class="abs-p">
                      <b>{{ p.nom }}</b
                      ><small>
                        @if (p.ajoutee) {
                          ajoutée à la main
                          @if (m.modif) {
                            <button type="button" class="abs-retirer" [title]="'Retirer ' + p.nom + ' de la liste (ses absences saisies sont gardées)'" [attr.aria-label]="'Retirer ' + p.nom" (click)="retirer(p)">
                              ✕
                            </button>
                          }
                        } @else {
                          {{ p.profils.join(' · ') }}
                        }
                      </small>
                    </th>
                    @for (d of m.jours; track d.iso) {
                      @if (!d.ouvre) {
                        <td class="abs-c off" [title]="d.ferie || 'Week-end'"></td>
                      } @else {
                        @let a = m.de(p.cle, d.iso);
                        <td class="abs-c" [class.today]="d.iso === v.aujourdhui">
                          <button
                            type="button"
                            class="abs-b"
                            [class]="'abs-b' + (a ? ' abs-' + a : '')"
                            [attr.data-abs]="p.cle + '|' + d.iso"
                            [disabled]="!m.modif"
                            [attr.aria-label]="p.nom + ', ' + fD(d.iso) + ' : ' + (a ? abs[a][1] : 'présent')"
                            [title]="p.nom + ' — ' + fD(d.iso) + ' : ' + (a ? abs[a][1] : 'présent')"
                            (click)="basculer(p, d.iso, a)"
                          ></button>
                        </td>
                      }
                    }
                    <td class="abs-t n">
                      <b>{{ fJ(m.total(p.cle)) }}</b> j
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="abs-pied">
                  <th class="abs-p">Absents</th>
                  @for (d of m.jours; track d.iso) {
                    @if (!d.ouvre) {
                      <td class="abs-c off"></td>
                    } @else {
                      <td class="abs-c n">{{ m.absents(d.iso) ? fJ(m.absents(d.iso)) : '' }}</td>
                    }
                  }
                  <td class="abs-t n">
                    <b>{{ fJ(m.totalGeneral) }}</b> j
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="legend abs-leg">
            <span><i class="abs-sw abs-j"></i>Journée</span><span><i class="abs-sw abs-m"></i>Matin</span><span><i class="abs-sw abs-a"></i>Après-midi</span
            ><span><i class="abs-sw abs-off"></i>Week-end ou jour férié</span><span class="muted">Un clic sur une case : journée → matin → après-midi → présent</span>
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Absences {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly fJ = fJ;
  protected readonly fML = fML;
  protected readonly abs = ABS;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v) return null;
    const dansProjet = v.m.months.filter((mk) => mk >= v.m.moisDebut && mk <= v.m.moisFin);
    const mois = dansProjet.length ? dansProjet : v.m.months;
    const cur = v.moisCourant;
    const choix = this.ui.ui().absMois;
    const mk = mois.includes(choix) ? choix : mois.includes(cur) ? cur : mois[0];
    const jours = (mk ? monthDays(mk) : []).map((iso) => ({ iso, num: +iso.slice(8), lettre: 'DLMMJVS'[dow(iso)], ouvre: isWorkday(iso), ferie: holidayName(iso) }));
    const ouvres = jours.filter((d) => d.ouvre).map((d) => d.iso);
    const personnes = equipe(v.P, v.projet.personnesAjoutees ?? []);
    const idx = indexAbsences(v.projet.absences);
    const total = (cle: string) => joursAbsence(idx, cle, ouvres);
    return {
      v,
      modif: v.droits.peutModifier,
      mois,
      mk,
      k: mois.indexOf(mk),
      moisCourant: cur,
      jours,
      ouvres,
      personnes,
      de: (cle: string, d: string): '' | Moment => idx.get(cle)?.get(d) ?? '',
      total,
      absents: (d: string) => personnes.reduce((s, p) => s + (ABS[idx.get(p.cle)?.get(d) as Moment]?.[2] ?? 0), 0),
      totalGeneral: personnes.reduce((s, p) => s + total(p.cle), 0),
    };
  });

  /** Clic sur une case : journée → matin → après-midi → présent ; le focus reste sur la case. */
  protected basculer(p: PersonneAbsences, jour: string, actuel: '' | Moment): void {
    const suivant = ABS_SUITE[actuel];
    const cible = `${p.cle}|${jour}`;
    void this.etat.saisir((id) => this.api.absence(id, p.nom, jour, suivant), {
      siSucces: () => setTimeout(() => document.querySelector<HTMLElement>(`[data-abs="${CSS.escape(cible)}"]`)?.focus()),
    });
  }

  protected async retirer(p: PersonneAbsences): Promise<void> {
    if (p.ajoutee) await this.etat.saisir((id) => this.api.retirerPersonne(id, p.ajoutee!));
  }
}
