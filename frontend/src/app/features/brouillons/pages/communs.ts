import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { formatEuros, formatJh, formatPourcentage } from '../../../shared/format/formats';
import { Rubrique } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';

const LIBELLES = { ok: 'Complète', conseil: 'À vérifier', bloquant: 'À corriger', vide: 'À remplir' } as const;

/** Pastille d'état d'une rubrique (complète, à vérifier, à corriger, à remplir), d'après la dernière analyse. */
@Component({
  selector: 'app-etat-rubrique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="er" [attr.data-etat]="etat()">{{ libelle() }}</span>`,
  styles: `
    .er {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 8px;
      border-radius: var(--rayon-badge);
      font: 500 12.5px/1 var(--police-texte);
      white-space: nowrap;
      background: var(--neutral-soft);
      color: var(--ink-2);
    }
    .er[data-etat='ok'] {
      background: var(--ok-soft);
      color: var(--ok);
    }
    .er[data-etat='conseil'] {
      background: var(--warn-soft);
      color: var(--warn);
    }
    .er[data-etat='bloquant'] {
      background: var(--crit-soft);
      color: var(--crit);
    }
  `,
})
export class EtatRubrique {
  private readonly etatBrouillon = inject(BrouillonEtat);
  readonly rubrique = input.required<Rubrique>();
  protected readonly etat = computed(() => this.etatBrouillon.analyse()?.rubriques[this.rubrique()] ?? 'vide');
  protected readonly libelle = computed(() => (this.rubrique() === 'depenses' && this.etat() === 'vide' ? 'Facultatif' : LIBELLES[this.etat()]));
}

/** Points à corriger et conseils d'une rubrique (rien s'il n'y en a pas), d'après la dernière analyse. */
@Component({
  selector: 'app-controles-rubrique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length) {
      <ul class="cr" [attr.aria-label]="'Points à vérifier'">
        @for (c of points(); track $index) {
          <li [attr.data-niveau]="c.niveau">
            <span class="cr-i" aria-hidden="true">{{ c.niveau === 'bloquant' ? '!' : 'i' }}</span>
            <span><b>{{ c.titre }}</b>@if (c.detail) { <span class="cr-d">{{ c.detail }}</span> }</span>
            <span class="visuellement-cache">{{ c.niveau === 'bloquant' ? '(à corriger avant le lancement)' : '(conseil)' }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .cr {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cr li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      background: var(--warn-soft);
    }
    .cr li[data-niveau='bloquant'] {
      background: var(--crit-soft);
    }
    .cr b {
      font-weight: 600;
    }
    .cr-d {
      color: var(--ink-2);
      margin-left: 6px;
    }
    .cr-i {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      flex: none;
      display: grid;
      place-items: center;
      font: 700 11px/1 var(--police-texte);
      color: #fff;
      background: var(--c-statut-encours);
      margin-top: 1px;
    }
    li[data-niveau='bloquant'] .cr-i {
      background: var(--c-statut-bloque);
    }
  `,
})
export class ControlesRubrique {
  private readonly etat = inject(BrouillonEtat);
  readonly rubrique = input.required<Rubrique>();
  protected readonly points = computed(() => (this.etat.analyse()?.controles ?? []).filter((c) => c.rubrique === this.rubrique() && c.niveau !== 'ok'));
}

/** Le TSP en direct, en une ligne (pages en pleine largeur : workload, planning). */
@Component({
  selector: 'app-resume-direct',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="rd num">
      @if (lignes() !== null) {
        <span>{{ lignes() }} ligne{{ lignes()! > 1 ? 's' : '' }}</span>
      }
      @if (etat.analyse()?.synthese; as s) {
        <span><b>{{ jh(s.jours) }}</b> JH</span>
        <span><b>{{ eur(s.montantProjet) }}</b></span>
        <span>marge <b>{{ pct(s.tauxMarge, 1) }}</b></span>
      }
      <span class="rd-note">au dernier enregistrement</span>
    </span>
  `,
  styles: `
    .rd {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 14px;
      font-size: 13px;
      color: var(--ink-2);
    }
    .rd b {
      color: var(--ink);
      font-weight: 600;
    }
    .rd-note {
      font-size: 12px;
      color: var(--muted);
    }
  `,
})
export class ResumeDirect {
  protected readonly etat = inject(BrouillonEtat);
  readonly lignes = input<number | null>(null);
  protected readonly jh = formatJh;
  protected readonly eur = formatEuros;
  protected readonly pct = formatPourcentage;
}
