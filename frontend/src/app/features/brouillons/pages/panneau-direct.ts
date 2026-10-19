import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate, formatEuros, formatJh, formatPourcentage } from '../../../shared/format/formats';
import { Rubrique } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { RUBRIQUES_OBLIGATOIRES } from './rubriques';

/**
 * « Le TSP en direct » : les chiffres clés du TSP en cours de rédaction, calculés par le serveur avec le moteur du projet
 * (mêmes règles qu'un TSP importé), mis à jour après chaque enregistrement ; la répartition par phase ; l'avancement de la rédaction.
 */
@Component({
  selector: 'app-panneau-direct',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card pd" aria-labelledby="pd-titre">
      <header>
        <div>
          <h2 id="pd-titre">Le TSP en direct</h2>
          <p>Recalculé à chaque enregistrement</p>
        </div>
      </header>
      @if (etat.analyse()?.synthese; as s) {
        <div class="pd-montant">
          <span>Montant du contrat</span>
          <b class="num">{{ eur(s.montantProjet) }}</b>
        </div>
        <div class="pd-grille">
          <div><span>Charge</span><b class="num">{{ jh(s.jours) }} JH</b></div>
          <div><span>TJM moyen</span><b class="num">{{ eur(s.tjmMoyen) }}</b></div>
          <div><span>Coût de production</span><b class="num">{{ eur(s.cout) }}</b></div>
          <div class="pd-marge" [class.pd-bas]="(s.tauxMarge ?? 0) < 0.3">
            <span>Marge brute</span><b class="num">{{ pct(s.tauxMarge, 1) }}</b>
          </div>
        </div>
        <dl class="pd-lignes">
          @if (pilotage(); as p) {
            <div><dt>Pilotage</dt><dd class="num">{{ pct(p, 1) }} de la charge</dd></div>
          }
          <div><dt>Provision pour risque</dt><dd class="num">{{ jh(s.provisionJh) }} JH · {{ pct(s.provisionPct, 1) }}</dd></div>
          @if (s.achats || s.frais) {
            <div><dt>Achats et frais</dt><dd class="num">{{ eur(s.achats + s.frais) }}</dd></div>
          }
          <div><dt>Marge nette</dt><dd class="num">{{ eur(s.margeNette) }} · {{ pct(s.tauxMargeNette, 1) }}</dd></div>
          @if (periode(); as p) {
            <div><dt>Période</dt><dd>{{ p }}</dd></div>
          }
        </dl>
      } @else {
        <p class="pd-vide">Les chiffres apparaissent dès qu’un profil a un TJM et qu’une tâche est chiffrée.</p>
      }
    </section>

    @if (etat.analyse()?.parPhase?.length) {
      <section class="card pd" aria-labelledby="pd-phases">
        <header>
          <div>
            <h2 id="pd-phases">Répartition par phase</h2>
            <p>Part de la charge vendue</p>
          </div>
        </header>
        <ul class="pd-phases">
          @for (p of etat.analyse()!.parPhase; track p.cle) {
            <li>
              <span class="pd-ph-l"><b>{{ p.cle }}</b><span class="num">{{ jh(p.jours) }} JH · {{ pct(p.part, 1) }}</span></span>
              <span class="barre"><b [style.width.%]="p.part * 100"></b></span>
            </li>
          }
        </ul>
      </section>
    }

    <section class="card pd" aria-labelledby="pd-avancement">
      <header>
        <div>
          <h2 id="pd-avancement">Avancement de la rédaction</h2>
          <p>{{ completes() }} rubrique{{ completes() > 1 ? 's' : '' }} sur {{ obligatoires.length }} · dans l’ordre que vous voulez</p>
        </div>
      </header>
      <span class="barre pd-av"><b [style.width.%]="(completes() / obligatoires.length) * 100"></b></span>
      @if (suivante(); as r) {
        <p class="pd-suite">Prochaine étape suggérée : <a [routerLink]="['/brouillons', id(), r.cle]">{{ r.action }}</a></p>
      } @else {
        <p class="pd-suite">Tout est renseigné : <a [routerLink]="['/brouillons', id(), 'lancer']">vérifiez et lancez le projet</a>.</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .pd > header {
      margin-bottom: 10px;
    }
    .pd h2 {
      font: 500 16px/24px var(--police-titre);
    }
    .pd-montant {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 12px;
    }
    .pd-montant span,
    .pd-grille span {
      font-size: 12.5px;
      color: var(--muted);
    }
    .pd-montant b {
      font: 600 28px/34px var(--police-titre);
    }
    .pd-grille {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .pd-grille > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px;
      border-radius: 6px;
      background: var(--surface-2);
      min-width: 0;
    }
    .pd-grille b {
      font: 600 17px/22px var(--police-titre);
      overflow-wrap: anywhere;
    }
    .pd-marge {
      background: var(--ok-soft) !important;
    }
    .pd-marge span,
    .pd-marge b {
      color: var(--ok) !important;
    }
    .pd-marge.pd-bas {
      background: var(--warn-soft) !important;
    }
    .pd-marge.pd-bas span,
    .pd-marge.pd-bas b {
      color: var(--warn) !important;
    }
    .pd-lignes {
      margin: 12px 0 0;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pd-lignes > div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
    }
    .pd-lignes dt {
      color: var(--muted);
    }
    .pd-lignes dd {
      margin: 0;
      text-align: right;
    }
    .pd-vide {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    .pd-phases {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pd-phases li {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pd-ph-l {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
    }
    .pd-ph-l b {
      font-weight: 500;
    }
    .pd-ph-l span {
      color: var(--muted);
    }
    .pd-av {
      display: block;
      height: 8px;
    }
    .pd-av b {
      background: var(--c-violet);
    }
    .pd-suite {
      margin: 10px 0 0;
      font-size: 13px;
      color: var(--muted);
    }
  `,
})
export class PanneauDirect {
  protected readonly etat = inject(BrouillonEtat);
  protected readonly obligatoires = RUBRIQUES_OBLIGATOIRES;
  protected readonly eur = formatEuros;
  protected readonly jh = formatJh;
  protected readonly pct = formatPourcentage;

  protected readonly id = computed(() => this.etat.brouillon()?.id ?? '');
  protected readonly pilotage = computed(() => this.etat.analyse()?.parPhase.find((p) => p.cle === 'PILOTAGE')?.part ?? null);

  protected readonly periode = computed(() => {
    const f = this.etat.contenu()?.fiche;
    return f?.debut && f.fin ? `${formatDate(f.debut)} → ${formatDate(f.fin)}` : null;
  });

  protected readonly completes = computed(() => {
    const r = this.etat.analyse()?.rubriques;
    return r ? this.obligatoires.filter((x) => r[x.cle] === 'ok' || r[x.cle] === 'conseil').length : 0;
  });

  /** Première rubrique à corriger, sinon la première encore vide. */
  protected readonly suivante = computed(() => {
    const r = this.etat.analyse()?.rubriques;
    if (!r) return null;
    const etat = (c: Rubrique) => r[c];
    return this.obligatoires.find((x) => etat(x.cle) === 'bloquant') ?? this.obligatoires.find((x) => etat(x.cle) === 'vide') ?? null;
  });
}
