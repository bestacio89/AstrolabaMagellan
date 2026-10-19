import { NgTemplateOutlet } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject } from '@angular/core';
import { Groupe, PlanReference } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { fD, fM, stSlug } from '../etat/formats';
import { addDays, dow, joursEntre, monthDays, toUTC } from '../etat/outils';
import { Derive, derives, referenceAffichee, texteDecalage } from '../etat/reference.logique';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { atHoraire, atRealise, axeName, filteredTasks, groupByAxe, isAtelier, lvLivre, lvPrevue, lvValide, TacheVue, typeName } from '../etat/vue';
import { BarreFiltres } from '../ui/barre-filtres';
import { LienTache, Statut } from '../ui/tache';

/**
 * Élément dessiné sur la frise : contour prévu (gp), barre réelle (gr), jalon (gm), mention « non daté »,
 * période de la référence (gref) et glissement par rapport à elle (gglis).
 */
interface Marque {
  type: 'gp' | 'gr' | 'gm' | 'nodate' | 'gref' | 'gglis';
  classe: string;
  left: string | null;
  width: string | null;
  titre: string;
  texte?: string;
}

interface Texte {
  principal: string;
  classe: string;
  second: string;
}

/**
 * Planning Gantt (version de référence) : contour = période prévue, barre pleine = période réelle (jours de consommé),
 * couleur du statut ; jalons ◇ planifié et ◆ réalisé / livré ; repères début, fin contractuelle, fin prévue, aujourd'hui.
 * Échelle mois ou semaine ; colonnes Statut / Prévu / Réel masquables.
 */
import { Fx } from '../ui/fx';
@Component({
  selector: 'app-gantt',
  imports: [NgTemplateOutlet, BarreFiltres, LienTache, Statut, Fx],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Planning Gantt</h2>
        <p>
          Contour = période <b>prévue</b> · barre pleine = période <b>réelle</b> (jours de consommé saisis), couleur du statut. Jalons : ◇ planifié, ◆ réalisé ou livré.
          Repères : vert = début du projet · gris = fin contractuelle · pointillés rouges = fin prévue · rouge = aujourd’hui. <app-fx cle="gantt" />
        </p>
      </div>
    </div>
    @if (vm(); as m) {
      <app-barre-filtres>
        <div class="field">
          Échelle
          <div class="seg sm" role="group" aria-label="Échelle">
            <button type="button" [attr.aria-pressed]="m.zoom === 'mois'" (click)="ui.maj({ gZoom: 'mois' })">Mois</button>
            <button type="button" [attr.aria-pressed]="m.zoom === 'semaine'" (click)="ui.maj({ gZoom: 'semaine' })">Semaine</button>
          </div>
        </div>
        <div class="field">
          &nbsp;<button
            type="button"
            class="btn sm"
            [attr.aria-pressed]="m.compact"
            title="Masquer ou afficher les colonnes Statut, Prévu et Réel pour agrandir la frise"
            (click)="ui.maj({ gCompact: !m.compact })"
          >
            {{ m.compact ? 'Afficher les colonnes' : 'Masquer les colonnes' }}
          </button>
        </div>
        <div class="field">
          Comparer à
          <select class="in" [value]="m.choixReference" (change)="ui.maj({ gRef: $any($event.target).value })" aria-label="Planning de référence comparé">
            <option value="aucune">Aucune référence</option>
            @for (r of m.references; track r.id) {
              <option [value]="r.id" [selected]="m.reference?.id === r.id && m.choixReference !== 'aucune'">{{ r.libelle }} ({{ fD(r.date) }})</option>
            }
          </select>
        </div>
        @if (etat.vue()?.droits?.peutModifier) {
          <div class="field">
            &nbsp;<button type="button" class="btn sm" (click)="figer()" title="Enregistre les dates prévues actuelles de toutes les tâches comme référence">
              Figer une référence
            </button>
          </div>
        }
        <span class="spacer"></span>
        <span class="g-lg"
          >@if (m.reference) {
            <span><i class="gref"></i>Référence</span><span><i class="gglis"></i>Glissement</span>
          }<span><i class="gp"></i>Prévu</span><span><i class="gr g-encours"></i>Réel (consommé)</span><span><i class="gm m-plan"></i>Jalon planifié</span
          ><span><i class="gm m-done g-valide"></i>Réalisé / livré</span></span
        >
      </app-barre-filtres>
      <div class="tw tall">
        <table class="gantt" [class.g-compact]="m.compact" [style.--tlw]="m.largeurFrise ? m.largeurFrise + 'px' : null">
          <thead>
            <tr>
              <th class="stick">Tâche</th>
              @if (!m.compact) {
                <th>Statut</th>
                <th title="Dates prévues (saisies)">Prévu</th>
                <th title="Dates de consommé saisi, ou date de réalisation / livraison">Réel</th>
              }
              <th class="tl">
                <div class="mh">
                  @for (x of m.mois; track x.mois) {
                    <span [style.left]="x.left">{{ x.libelle }}</span>
                  }
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (g of m.groupes; track g.cle) {
              <tr class="grp">
                <td class="stick">{{ g.nom }}</td>
                @if (!m.compact) {
                  <td>
                    @if (g.axe) {
                      <app-statut [statut]="g.axe.statut" />
                    }
                  </td>
                  <td class="num g-d">{{ plage(g.axe?.prevuDebut ?? null, g.axe?.prevuFin ?? null) }}</td>
                  <td class="num g-d">{{ plage(g.axe?.reelDebut ?? null, g.axe?.reelFin ?? null) }}</td>
                }
                <td class="tl" [style.background]="m.fond">
                  @for (x of g.marques; track $index) {
                    <ng-container [ngTemplateOutlet]="marque" [ngTemplateOutletContext]="{ $implicit: x }" />
                  }
                </td>
              </tr>
              @for (t of g.taches; track t.tache.uid) {
                <tr [class.is-sel]="etat.panneau() === t.tache.uid">
                  <td class="stick">
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px"><app-lien-tache [t]="t.tache" /></div>
                    <span class="muted" style="font-size: 11.5px"
                      >{{ t.type ? t.type + ' · ' : '' }}{{ t.tache.responsable }}{{ m.compact ? ' · ' + t.tache.statut : '' }}</span
                    >
                  </td>
                  @if (!m.compact) {
                    <td style="white-space: nowrap">
                      <app-statut [statut]="t.tache.statut" />
                      @if (!t.tache.annulee) {
                        <span class="muted" style="font-size: 11.5px"> {{ round(t.tache.avancement * 100) }} %</span>
                      }
                    </td>
                    <td class="num g-d">
                      <span [class]="t.prevu.classe">{{ t.prevu.principal }}</span>
                      @if (t.prevu.second) {
                        <br /><span class="muted">{{ t.prevu.second }}</span>
                      }
                    </td>
                    <td class="num g-d">
                      <b [class]="t.reel.classe">{{ t.reel.principal }}</b>
                      @if (t.reel.second) {
                        <br /><span class="muted">{{ t.reel.second }}</span>
                      }
                    </td>
                  }
                  <td class="tl" [style.background]="m.fond">
                    @for (x of t.marques; track $index) {
                      <ng-container [ngTemplateOutlet]="marque" [ngTemplateOutletContext]="{ $implicit: x }" />
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td [attr.colspan]="m.compact ? 2 : 5" class="empty">Aucune tâche.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <ng-template #marque let-x>
        @switch (x.type) {
          @case ('gp') {
            <div class="gp" [class]="'gp ' + x.classe" [style.left]="x.left" [style.width]="x.width" [title]="x.titre"></div>
          }
          @case ('gr') {
            <div class="gr" [class]="'gr ' + x.classe" [style.left]="x.left" [style.width]="x.width" [title]="x.titre"></div>
          }
          @case ('gm') {
            <span class="gm" [class]="'gm ' + x.classe" [style.left]="x.left" [title]="x.titre"></span>
          }
          @case ('gref') {
            <div class="gref" [style.left]="x.left" [style.width]="x.width" [title]="x.titre"></div>
          }
          @case ('gglis') {
            <div class="gglis" [style.left]="x.left" [style.width]="x.width" [title]="x.titre"></div>
          }
          @default {
            <span class="nodate">{{ x.texte }}</span>
          }
        }
      </ng-template>

      @if (m.reference; as ref) {
        <section class="card g-derives" aria-labelledby="g-derives-titre">
          <header>
            <div>
              <h2 id="g-derives-titre">Journal des dérives</h2>
              <p>
                Tâches dont les dates ont changé depuis « {{ ref.libelle }} », figée le {{ fD(ref.date) }}{{ ref.par ? ' par ' + ref.par : '' }}. Indiquez la cause et le
                motif de chaque décalage : ils servent au comité et aux retours d’expérience.
              </p>
            </div>
            <span class="chips"
              ><span
                >Tâches décalées <b>{{ m.derives.length }}</b></span
              >
              @if (m.sansMotif) {
                <span
                  >Sans motif <b class="neg">{{ m.sansMotif }}</b></span
                >
              }
            </span>
          </header>
          @if (m.derives.length) {
            <div class="tw">
              <table class="g-der">
                <thead>
                  <tr>
                    <th>Tâche</th>
                    <th>Référence</th>
                    <th>Actuel</th>
                    <th class="n">Décalage</th>
                    <th>Cause</th>
                    <th>Motif</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of m.derives; track d.uid) {
                    <tr>
                      <td><button type="button" class="tlink" [attr.data-open]="d.uid">{{ d.libelle }}</button></td>
                      <td class="g-d">{{ plage(d.debutReference, d.finReference) }}</td>
                      <td class="g-d">{{ plage(d.debut, d.fin) }}</td>
                      <td class="n">
                        <span class="ecart-badge" [class.neg]="(d.decalage ?? 1) > 0" [class.pos]="(d.decalage ?? 0) < 0">{{ texteDecalage(d) }}</span>
                      </td>
                      @if (etat.vue()?.droits?.peutModifier) {
                        <td>
                          <select class="in" [value]="d.ligne.cause ?? ''" (change)="saisirDerive(ref, d, $any($event.target).value, d.ligne.motif)" aria-label="Cause du décalage">
                            <option value="">—</option>
                            @for (c of m.causes; track c) {
                              <option [value]="c" [selected]="d.ligne.cause === c">{{ c }}</option>
                            }
                          </select>
                        </td>
                        <td>
                          <input
                            class="in g-motif"
                            type="text"
                            maxlength="1000"
                            placeholder="Pourquoi ce décalage ?"
                            [value]="d.ligne.motif ?? ''"
                            (change)="saisirDerive(ref, d, d.ligne.cause, $any($event.target).value)"
                            aria-label="Motif du décalage"
                          />
                        </td>
                      } @else {
                        <td>{{ d.ligne.cause ?? '—' }}</td>
                        <td>{{ d.ligne.motif ?? '' }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="empty">Aucune tâche n’a bougé depuis cette référence.</p>
          }
        </section>
      } @else if (!m.references.length) {
        <div class="card g-derives vide">
          <p>
            <b>Pas encore de planning de référence.</b>
            {{
              etat.vue()?.droits?.peutModifier
                ? 'Une fois le planning établi, cliquez sur « Figer une référence » : le Gantt montrera ensuite chaque glissement et vous pourrez en noter le motif.'
                : 'Le chef de projet peut figer le planning : le Gantt montrera alors chaque glissement.'
            }}
          </p>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class Gantt {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly round = Math.round;

  protected readonly vm = computed(() => {
    const v = this.etat.vue();
    if (!v || !v.m.months.length) return null;
    const u = this.ui.ui();
    const premier = v.m.months[0] + '-01';
    const dernier = monthDays(v.m.months[v.m.months.length - 1]).slice(-1)[0];
    const t0 = toUTC(premier),
      t1 = toUTC(addDays(dernier, 1));
    const pos = (iso: string) => ((toUTC(iso) - t0) / (t1 - t0)) * 100;
    const dans = (iso: string | null | undefined): iso is string => !!iso && iso >= premier && iso <= dernier;
    const zoom = u.gZoom === 'semaine' ? 'semaine' : 'mois';
    const references = v.projet.references ?? [];
    const reference = referenceAffichee(references, u.gRef);

    // repères verticaux (fond de chaque ligne)
    const fonds = v.m.months.slice(1).map((mk) => `linear-gradient(var(--line),var(--line)) ${pos(mk + '-01').toFixed(3)}% 0/1px 100% no-repeat`);
    const td = v.aujourdhui;
    if (td >= premier && td <= dernier) fonds.unshift(`linear-gradient(var(--today),var(--today)) ${pos(td).toFixed(3)}% 0/2px 100% no-repeat`);
    const cal = v.m.cal;
    if (dans(cal.debut)) fonds.unshift(`linear-gradient(var(--ok),var(--ok)) ${pos(cal.debut).toFixed(3)}% 0/2px 100% no-repeat`);
    if (dans(cal.finContrat)) fonds.unshift(`linear-gradient(var(--ink-2),var(--ink-2)) ${pos(addDays(cal.finContrat, 1)).toFixed(3)}% 0/2px 100% no-repeat`);
    if (dans(cal.finPrevue) && cal.finPrevue !== cal.finContrat)
      fonds.unshift(`repeating-linear-gradient(var(--crit) 0 4px, transparent 4px 8px) ${pos(addDays(cal.finPrevue, 1)).toFixed(3)}% 0/2px 100% no-repeat`);
    const nbJours = Math.round((t1 - t0) / 864e5);
    if (zoom === 'semaine') {
      for (let d = premier; d <= dernier; d = addDays(d, 1))
        if (dow(d) === 1 && d.slice(8) !== '01') fonds.push(`linear-gradient(var(--line),var(--line)) ${pos(d).toFixed(3)}% 0/1px 100% no-repeat`);
    }

    const etendue = (a: string, b: string): { left: string; width: string } | null => {
      const l = Math.max(0, pos(a)),
        r = Math.min(100, pos(addDays(b, 1)));
      return r <= 0 || l >= 100 ? null : { left: l.toFixed(3) + '%', width: Math.max(0.4, r - l).toFixed(3) + '%' };
    };
    const barre = (type: 'gp' | 'gr', a: string, b: string, classe: string, titre: string): Marque[] => {
      const e = etendue(a, b);
      return e ? [{ type, classe, left: e.left, width: e.width, titre }] : [];
    };
    const jalon = (iso: string | null | undefined, classe: string, titre: string): Marque[] =>
      dans(iso) ? [{ type: 'gm', classe, left: pos(iso).toFixed(3) + '%', width: null, titre }] : [];
    const nonDate = (texte: string): Marque => ({ type: 'nodate', classe: '', left: null, width: null, titre: '', texte });

    /** Référence de la tâche (contour fin, en bas) et glissement de sa fin (en rouge). */
    const marquesReference = (t: TacheVue): Marque[] => {
      const l = reference?.lignes[t.uid];
      if (!l || t.annulee || (!l.debut && !l.fin)) return [];
      const h: Marque[] = [];
      const a = l.debut ?? l.fin!,
        b = l.fin ?? l.debut!;
      const e = etendue(a, b);
      if (e) h.push({ type: 'gref', classe: '', left: e.left, width: e.width, titre: `Référence : ${this.plage(l.debut, l.fin)}` });
      const fin = t.tr.fin;
      if (l.fin && fin && fin > l.fin) {
        const g = etendue(addDays(l.fin, 1), fin);
        if (g) h.push({ type: 'gglis', classe: '', left: g.left, width: g.width, titre: `Glissement de ${joursEntre(l.fin, fin)} jour(s) par rapport à la référence` });
      }
      return h;
    };

    const marquesTache = (t: TacheVue): Marque[] => [...marquesReference(t), ...marquesTacheSeule(t)];

    const marquesTacheSeule = (t: TacheVue): Marque[] => {
      const pD = t.tr.debut,
        pF = t.tr.fin,
        rD = t.consoDates[0],
        rF = t.consoDates[t.consoDates.length - 1];
      const cls = 'g-' + stSlug(t.statut);
      const h: Marque[] = [];
      if (isAtelier(t) && !t.annulee) {
        const at = t.tr.atelier,
          real = atRealise(t),
          hr = atHoraire(t);
        if (rD) h.push(...barre('gr', rD, rF, cls, `Consommé : ${fD(rD)} → ${fD(rF)}`));
        h.push(...jalon(at?.date, 'm-plan', `Atelier planifié le ${fD(at?.date)}${hr ? ' · ' + hr : ''}${at?.invit ? ' · invitation envoyée' : ''}`));
        h.push(...jalon(real, 'm-done ' + cls, `Atelier réalisé le ${fD(real)}`));
        if (!at?.date && !real) h.push(nonDate('Date de l’atelier à planifier'));
        return h;
      }
      if (t.type === 'Livrable' && !t.annulee) {
        const pv = lvPrevue(t);
        if (pD && pF && pD !== pF) h.push(...barre('gp', pD, pF, '', `Prévu : ${fD(pD)} → ${fD(pF)}`));
        if (rD) h.push(...barre('gr', rD, rF, cls, `Consommé : ${fD(rD)} → ${fD(rF)}`));
        h.push(...jalon(pv, 'm-plan', `Livraison prévue le ${fD(pv)}`));
        const liv = lvLivre(t),
          val = lvValide(t);
        h.push(
          ...jalon(liv, 'm-done ' + (val ? 'g-valide' : 'g-encours'), `Livré le ${fD(liv)}${val ? ` · validé par le client le ${fD(val)}` : ' · en attente de validation client'}`),
        );
        if (!pv && !liv) h.push(nonDate('Livraison non datée'));
        return h;
      }
      if (pD && pF) h.push(...barre('gp', pD, pF, '', `Prévu : ${fD(pD)} → ${fD(pF)}`));
      if (rD) h.push(...barre('gr', rD, rF, cls, `Consommé : ${fD(rD)} → ${fD(rF)} · ${t.statut} · ${Math.round(t.avancement * 100)} %`));
      // tâche validée sans dates ni consommé : jalon ◆ à la date de validation
      if (!h.length && t.statut === 'Validé' && t.tr.valideLe) h.push(...jalon(t.tr.valideLe, 'm-done ' + cls, `Validée le ${fD(t.tr.valideLe)} (aucun consommé saisi)`));
      return h.length ? h : [nonDate('Non daté')];
    };

    const marquesAxe = (a: Groupe | undefined): Marque[] => {
      if (!a) return [];
      const h: Marque[] = [];
      if (a.prevuDebut && a.prevuFin) h.push(...barre('gp', a.prevuDebut, a.prevuFin, 'ax', `Prévu : ${fD(a.prevuDebut)} → ${fD(a.prevuFin)}`));
      if (a.reelDebut && a.reelFin)
        h.push(...barre('gr', a.reelDebut, a.reelFin, 'ax g-axe', `Réel : ${fD(a.reelDebut)} → ${fD(a.reelFin)} · avancement ${Math.round(a.avancement * 100)} %`));
      return h.length ? h : [nonDate('Non planifié')];
    };

    const listeDerives = reference
      ? derives(
          v.tasks.map((t) => ({ uid: t.uid, label: t.label, annulee: t.annulee, debut: t.tr.debut ?? null, fin: t.tr.fin ?? null })),
          reference,
        )
      : [];
    return {
      references,
      reference,
      choixReference: u.gRef === 'aucune' ? 'aucune' : (reference?.id ?? 'aucune'),
      derives: listeDerives,
      sansMotif: listeDerives.filter((d) => !d.ligne.cause && !d.ligne.motif).length,
      causes: v.projet.causes ?? [],
      zoom,
      compact: u.gCompact,
      largeurFrise: zoom === 'semaine' ? Math.round((nbJours / 7) * 46) : 0,
      fond: fonds.join(','),
      mois: v.m.months.map((mk) => ({ mois: mk, left: pos(mk + '-01').toFixed(3) + '%', libelle: fM(mk) })),
      groupes: groupByAxe(v, filteredTasks(v, u)).map(([cle, taches]) => {
        const axe = v.m.axes.find((x) => x.id === cle);
        return {
          cle,
          nom: axeName(v, cle),
          axe,
          marques: marquesAxe(axe),
          taches: taches.map((t) => ({ tache: t, type: t.type ? typeName(v, t.type) : '', prevu: this.prevu(t), reel: this.reel(t), marques: marquesTache(t) })),
        };
      }),
    };
  });

  constructor() {
    // colonnes Statut / Prévu / Réel figées à côté de « Tâche », puis frise centrée sur aujourd'hui
    afterRenderEffect(() => {
      const m = this.vm();
      const v = this.etat.vue();
      if (!m || !v) return;
      const tw = this.hote.nativeElement.querySelector<HTMLElement>('.tw');
      const tb = tw?.querySelector<HTMLTableElement>('table.gantt');
      if (!tw || !tb) return;
      let fige = tb.querySelector<HTMLElement>('thead th.stick')?.offsetWidth ?? 0;
      if (!m.compact) {
        const entetes = [...tb.querySelectorAll<HTMLElement>('thead tr:first-child > th')];
        const gauches: number[] = [];
        let x = entetes[0]?.offsetWidth ?? 0;
        for (let k = 1; k <= 3 && entetes[k]; k++) {
          gauches[k] = x;
          x += entetes[k].offsetWidth;
        }
        tb.querySelectorAll('tr').forEach((tr) => {
          const cellules = tr.children;
          if (cellules.length < 5) return;
          for (let k = 1; k <= 3; k++) {
            const c = cellules[k] as HTMLElement;
            c.classList.add('gfix');
            c.style.left = gauches[k] + 'px';
          }
          cellules[3].classList.add('gfix-last');
        });
        fige = x;
      }
      if (this.dejaCentre || tw.scrollWidth <= tw.clientWidth + 4) return;
      const th = tw.querySelector<HTMLElement>('th.tl');
      const premier = v.m.months[0] + '-01';
      const dernier = monthDays(v.m.months[v.m.months.length - 1]).slice(-1)[0];
      const td = v.aujourdhui;
      if (!th || td < premier || td > dernier) return;
      const frac = joursEntre(premier, td) / (joursEntre(premier, dernier) + 1);
      tw.scrollLeft = Math.max(0, th.offsetLeft + frac * th.offsetWidth - fige - (tw.clientWidth - fige) / 2);
      this.dejaCentre = true;
    });
  }

  private dejaCentre = false;
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly texteDecalage = texteDecalage;

  /** Fige le planning actuel comme nouvelle référence (après confirmation). */
  protected async figer(): Promise<void> {
    const v = this.etat.vue();
    if (!v) return;
    const nb = v.projet.references?.length ?? 0;
    const ok = await this.etat.confirmer(
      'Figer une référence',
      [
        'Les dates prévues et la charge actuelles de toutes les tâches sont enregistrées comme référence.',
        'Le Gantt comparera ensuite le planning à cette référence ; chaque décalage pourra recevoir une cause et un motif.',
      ],
      'Figer le planning',
      { note: nb ? `Les ${nb} référence(s) précédente(s) restent consultables.` : 'C’est la première référence de ce projet.' },
    );
    if (!ok) return;
    const r = await this.etat.saisir((id) => this.api.figerReference(id, null));
    if (r) this.ui.maj({ gRef: 'auto' });
  }

  /** Cause ou motif d'un décalage (version lue au moment de l'envoi). */
  protected saisirDerive(ref: PlanReference, d: Derive, cause: string | null, motif: string | null): void {
    void this.etat.saisir((id) =>
      this.api.derive(
        id,
        ref.id,
        d.uid,
        cause || null,
        (motif ?? '').trim() || null,
        this.etat.suivi()?.projet.references.find((x) => x.id === ref.id)?.lignes[d.uid]?.version,
      ),
    );
  }

  protected plage(a: string | null, b: string | null): string {
    return a ? (b && b !== a ? `${fD(a)} → ${fD(b)}` : fD(a)) : '—';
  }

  private prevu(t: TacheVue): Texte {
    if (isAtelier(t) && !t.annulee) {
      const d = t.tr.atelier?.date;
      if (d) return { principal: fD(d), classe: '', second: atHoraire(t) };
      return { principal: atRealise(t) ? '—' : 'à planifier', classe: 'muted', second: '' };
    }
    if (t.type === 'Livrable' && !t.annulee) {
      const pv = lvPrevue(t);
      return { principal: pv ? fD(pv) : '—', classe: pv ? '' : 'muted', second: '' };
    }
    const p = this.plage(t.tr.debut ?? null, t.tr.fin ?? null);
    return { principal: p, classe: p === '—' ? 'muted' : '', second: '' };
  }

  private reel(t: TacheVue): Texte {
    const rD = t.consoDates[0] ?? null,
      rF = t.consoDates[t.consoDates.length - 1] ?? null;
    if (isAtelier(t) && !t.annulee) {
      const r = atRealise(t);
      if (r) return { principal: '✓ ' + fD(r), classe: 'pos', second: '' };
      return { principal: this.plage(rD, rF), classe: 'muted', second: '' };
    }
    if (t.type === 'Livrable' && !t.annulee) {
      const liv = lvLivre(t),
        val = lvValide(t),
        pv = lvPrevue(t);
      if (!liv) return { principal: '—', classe: 'muted', second: '' };
      const retard = pv && liv > pv ? joursEntre(pv, liv) : 0;
      return { principal: (val ? '✓ ' : '') + fD(liv) + (retard ? ` +${retard} j` : ''), classe: val ? 'pos' : '', second: val ? 'validé client' : 'attente client' };
    }
    if (!t.consoDates.length && t.statut === 'Validé' && t.tr.valideLe) return { principal: '✓ ' + fD(t.tr.valideLe), classe: 'pos', second: 'validée' };
    const p = this.plage(rD, rF);
    return { principal: p, classe: p === '—' ? 'muted' : '', second: '' };
  }
}
