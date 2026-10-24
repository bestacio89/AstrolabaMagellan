import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { avancementValide } from '../etat/avancement';
import { STATUTS } from '../etat/constantes';
import { fD, fE, fJ, fP, stSlug } from '../etat/formats';
import { sum } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { TacheVue, defaultAxeName } from '../etat/vue';
import { Barre, MiniBarre } from '../ui/petits';
import { EtiquetteAjout } from '../ui/tache';

/** Volet latéral de l'axe : nom/date limite, suivi, tâches et facturation. */
@Component({
  selector: 'app-panneau-axe',
  imports: [Barre, MiniBarre, EtiquetteAjout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (d(); as d) {
      <aside class="drawer" aria-label="Détail de l’axe" [style.--axc]="'var(--ax' + (d.idx % 8) + ')'">
        <div class="dr-head">
          <div class="dr-nav"><span class="dr-kind">Axe</span><span class="spacer"></span><button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button></div>
          <h2 class="dr-title">{{ d.nom }}</h2>
          <div class="dr-meta">Code du TSP : {{ code() }}{{ code() === '0' ? ' (pilotage)' : '' }} · {{ d.taches.length }} tâche(s){{ d.ajout ? ' · dont ' + fJ(d.ajout) + ' JH ajoutés en cours de projet' : '' }}</div>
          <div class="dr-kpis">
            <div><small>Prévu</small><strong>{{ fJ(d.charge) }} JH</strong></div>
            <div><small>Consommé</small><strong>{{ fJ(d.conso) }} JH</strong></div>
            <div><small>Atterrissage</small><strong>{{ fJ(d.atter) }} JH</strong></div>
            <div><small>Écart</small><strong>{{ fJ(d.ecart) }} JH</strong></div>
          </div>
        </div>
        <div class="dr-body">
          <section [class.ax-cible]="etat.sectionAxe() === 'nom'">
            <h3>L’axe <span class="muted">{{ d.dateEtat?.libelle ?? 'pas de date limite' }}</span></h3>
            <label class="field">Nom de l’axe
              <input class="in" maxlength="200" [value]="d.nomSaisi" [placeholder]="defaultAxeName(code())" [disabled]="!d.modif" #nom (change)="nommer(nom.value)" (keydown.enter)="nom.blur()" />
            </label>
            <label class="field">Date limite
              <input class="in" type="date" [value]="d.dateLimite" [disabled]="!d.modif" #date (change)="dateLimite(date.value)" />
            </label>
            @if (d.dateEtat) {
              <p class="muted">{{ d.dateEtat.libelle }}</p>
              @if (d.dateEtat.auDela.length) {
                <div class="ax-alert" role="status">{{ d.dateEtat.auDela.length }} tâche(s) finissent après le {{ fD(d.dateEtat.date) }} :
                  @for (t of d.dateEtat.auDela.slice(0, 4); track t.uid) {
                    <button type="button" class="linklike" (click)="ouvrirTache(t.uid)">{{ t.libelle }}</button>
                  }
                </div>
              }
            }
          </section>
          @if (d.points.length) {
            <section><h3>Points d’attention</h3>
              @for (p of d.points; track p.libelle) {
                <div class="ph-alert" [class]="'ph-alert ph-' + p.niveau"><strong>{{ p.libelle }}</strong>
                  @for (t of p.taches.slice(0, 4); track t.uid) { <button type="button" class="linklike" (click)="ouvrirTache(t.uid)">{{ t.label }}</button> }
                </div>
              }
            </section>
          }
          <section><h3>Statut et avancement <span class="muted">{{ d.valides }} / {{ d.taches.length }} validées · {{ fP(d.avancement) }}</span></h3>
            <app-barre [valeur]="d.avancement" />
            <div class="ph-stats">@for (s of d.statuts; track s.statut) { <span class="pill xs" [class]="'pill xs st-' + stSlug(s.statut)">{{ s.statut }} · {{ s.n }}</span> }</div>
          </section>
          <section><h3>Charges <span class="muted">{{ d.taches.length }} tâche(s) · reste à faire {{ fJ(d.raf) }} JH</span></h3>
            <div class="ax-grid"><span>Prévu</span><strong>{{ fJ(d.charge) }} JH</strong><span>Consommé</span><strong>{{ fJ(d.conso) }} JH</strong><span>Reste à faire</span><strong>{{ fJ(d.raf) }} JH</strong><span>Atterrissage</span><strong>{{ fJ(d.atter) }} JH</strong><span>Écart d’atterrissage</span><strong>{{ fSigned(d.ecart) }} JH</strong><span>Coût à l’atterrissage</span><strong>{{ fE(d.cout) }}</strong></div>
          </section>
          <section><h3>Dates <span class="muted">{{ d.pD ? fD(d.pD) : 'à planifier' }} → {{ d.pF ? fD(d.pF) : '—' }}</span></h3>
            <p>Prévu : {{ d.pD ? fD(d.pD) : 'à planifier' }} – {{ d.pF ? fD(d.pF) : '—' }}</p>
            <p>Réel : {{ d.rD ? fD(d.rD) : '—' }} – {{ d.rF ? fD(d.rF) : '—' }}{{ d.apres ? ' (après la fin du projet)' : '' }}</p>
          </section>
          @if (d.types.length) {
            <section><h3>Ateliers & livrables</h3>@for (t of d.types; track t.nom) { <div class="ax-type"><span>{{ t.nom }} · {{ t.ok }} / {{ t.n }} réalisé(s)</span><app-mini-barre [valeur]="t.n ? 100 * t.ok / t.n : 0" /></div> }</section>
          }
          @if (d.echeancier.length) {
            <section [class.ax-cible]="etat.sectionAxe() === 'fact'"><h3>Facturation <span class="muted">{{ d.echeance ? 'échéance n° ' + d.echeance.n : 'aucune facture' }}</span></h3>
              <label class="field">Échéance déclenchée par l’axe
                <select class="in" [value]="d.echeance?.n ?? ''" [disabled]="!d.modif" #ech (change)="changerEcheance(ech)">
                  <option value="">— Aucune —</option>
                  @for (e of d.echeancier; track e.n) {
                    <option [value]="e.n" [disabled]="!!e.realiseLe && d.echeance?.n !== e.n || !!e.axeCode && e.axeCode !== code()">n° {{ e.n }} — {{ e.nom }}{{ e.datePrevue ? ' (' + fD(e.datePrevue) + ')' : '' }}{{ e.axeCode && e.axeCode !== code() ? ' · prise par ' + e.axeCode : e.realiseLe ? ' · facturée' : '' }}</option>
                  }
                </select>
              </label>
              @if (d.echeance) {
                <div class="ph-ech"><strong>Échéance n° {{ d.echeance.n }} · {{ d.echeance.nom }}</strong><p>{{ fE(d.echeance.montant) }} · {{ d.echeance.nLiesValides }} / {{ d.echeance.nLies }} tâches validées · {{ fP(d.echeance.avLie ?? 0) }}</p>
                  @if (d.echeance.pret && !d.echeance.realiseLe && d.modif) { <button type="button" class="btn primary sm" (click)="facturer(d.echeance.n)">✓ Facture émise</button> }
                  @if (d.echeance.realiseLe) { <p class="muted">Facturée le {{ fD(d.echeance.realiseLe) }}{{ d.echeance.payeeLe ? ' · payée' : '' }}</p> }
                </div>
              }
              <p class="muted">L’échéance choisie vaut pour toutes les tâches de l’axe, actuelles et futures ; elle est prête à facturer quand elles sont toutes validées. Un axe par échéance. Une tâche ne déclenche qu’une facture : celle de sa phase si la phase est liée, sinon celle de l’axe.</p>
              <p class="muted">{{ d.viaPhase }} tâche(s) de l’axe suivent l’échéance de leur phase. {{ d.directes }} tâche(s) ont aujourd’hui une échéance individuelle.</p>
            </section>
          }
          <section><h3>Tâches de l’axe <span class="muted">{{ d.taches.length }}</span></h3>
            <div class="ph-tasks">@for (t of d.taches; track t.uid) {
              <button type="button" class="ph-task" (click)="ouvrirTache(t.uid)">
                <span class="ph-t-l">{{ t.label }}</span><app-etiquette-ajout [t]="t" /><span class="pill xs" [class]="'pill xs st-' + stSlug(t.statut)">{{ t.statut }}</span><span class="num muted">{{ fJ(t.consoTotal) }} / {{ fJ(t.charge) }} JH</span>
              </button>
            }</div>
          </section>
        </div>
      </aside>
    }
  `,
  styles: `
    :host { display: contents; }
    .dr-kpis { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 12px; }
    .dr-kpis > div { background: var(--surface-2); border-radius: 8px; padding: 8px; min-width: 0; }
    .dr-kpis small { display:block; font-size: 11px; color: var(--muted); }
    .dr-kpis strong { display:block; font-size: 13px; font-variant-numeric: tabular-nums; }
    .ax-grid { display:grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px 14px; }
    .ax-type { display:flex; justify-content:space-between; gap:12px; align-items:center; margin:8px 0; }
    .ax-alert { margin-top:8px; color:#b42318; font-weight:600; }
    .ax-cible { outline: 2px solid var(--axc); outline-offset: 2px; animation: ax-highlight 1.5s ease-out; }
    @keyframes ax-highlight { from { box-shadow: 0 0 0 4px color-mix(in srgb,var(--axc) 25%,transparent); } to { box-shadow: 0 0 0 0 transparent; } }
    @media (max-width: 700px) { .dr-kpis { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  `,
})
export class PanneauAxe {
  readonly code = input.required<string>();
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  protected readonly fD = fD;
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly stSlug = stSlug;
  protected readonly defaultAxeName = defaultAxeName;
  protected readonly vue = this.etat.vue;

  protected readonly d = computed(() => {
    const v = this.vue();
    if (!v) return null;
    const code = this.code();
    const taches = v.tasks.filter((t) => t.axe === code);
    if (!taches.length && !v.m.axeIdsActifs?.includes(code)) return null;
    const S = (f: (t: TacheVue) => number) => sum(taches.map(f));
    const charge = S((t) => t.charge), conso = S((t) => t.consoTotal), raf = S((t) => t.raf);
    const mn = (l: (string | null | undefined)[]) => l.filter((x): x is string => !!x).sort()[0] ?? null;
    const mx = (l: (string | null | undefined)[]) => l.filter((x): x is string => !!x).sort().slice(-1)[0] ?? null;
    const echeance = v.m.echeancier.find((e) => e.axeCode === code) ?? null;
    return {
      idx: Math.max(0, (v.m.axeIdsActifs ?? []).indexOf(code)),
      nom: v.projet.axes?.[code] || defaultAxeName(code),
      nomSaisi: v.projet.axes?.[code] ?? '',
      dateLimite: v.projet.datesLimitesAxes?.[code] ?? '',
      dateEtat: v.m.datesLimitesAxes?.find((x) => x.code === code) ?? null,
      modif: v.droits.peutModifier,
      taches,
      charge, conso, raf, atter: conso + raf, ecart: conso + raf - charge,
      ajout: S((t) => t.chargeAjout),
      cout: S((t) => (t.coutConso ?? 0) + (t.coutRaf ?? 0)),
      avancement: avancementValide(taches),
      valides: taches.filter((t) => t.statut === 'Validé' && !t.annulee).length,
      statuts: [...STATUTS, 'Annulée'].map((statut) => ({ statut, n: taches.filter((t) => t.statut === statut).length })).filter((x) => x.n > 0),
      points: [
        { libelle: 'Bloquée / en attente', taches: taches.filter((t) => t.statut === 'Bloqué / En attente'), niveau: 'crit' },
        { libelle: 'En retard (fin prévue dépassée)', taches: taches.filter((t) => t.statut !== 'Validé' && !!t.tr.fin && t.tr.fin < v.aujourdhui).sort((a, b) => (a.tr.fin ?? '').localeCompare(b.tr.fin ?? '')), niveau: 'crit' },
        { libelle: 'En dépassement de charge', taches: taches.filter((t) => t.consoTotal > t.charge + 1e-9), niveau: 'crit' },
        { libelle: 'Reste à faire à réestimer', taches: taches.filter((t) => t.rafAReestimer), niveau: 'warn' },
      ].filter((p) => p.taches.length),
      pD: mn(taches.map((t) => t.tr.debut)), pF: mx(taches.map((t) => t.tr.fin)),
      rD: mn(taches.map((t) => t.consoDates[0])), rF: mx(taches.map((t) => t.consoDates[t.consoDates.length - 1])),
      apres: !!(v.m.cal.finPrevue && mx(taches.map((t) => t.tr.fin)) && mx(taches.map((t) => t.tr.fin))! > v.m.cal.finPrevue),
      types: v.projet.types.map((ty) => { const l = taches.filter((t) => t.type === ty.id); return { nom: ty.nom, n: l.length, ok: l.filter((t) => t.statut === 'Validé').length }; }).filter((x) => x.n > 0),
      echeance, echeancier: v.m.echeancier,
      viaPhase: taches.filter((t) => !!v.phaseEch[t.phase]).length,
      phasesAutres: [...new Set(taches.map((t) => t.phase).filter((p) => !!v.phaseEch[p]))].map((code) => ({ code, numero: v.phaseEch[code], n: taches.filter((t) => t.phase === code).length })),
      directes: taches.filter((t) => t.tr.ech != null).length,
    };
  });

  constructor() { effect(() => { if (this.vue() && !this.d()) this.etat.fermerPanneau(); }); }
  protected nommer(nom: string): void { void this.etat.saisir((id) => this.api.axe(id, this.code(), nom.trim(), this.d()?.dateLimite || null)); }
  protected dateLimite(date: string): void { void this.etat.saisir((id) => this.api.axe(id, this.code(), this.d()?.nomSaisi ?? '', date || null)); }
  protected ouvrirTache(uid: string): void { this.etat.ouvrirTache(uid); }
  protected async changerEcheance(el: HTMLSelectElement): Promise<void> {
    const d = this.d();
    if (!d) return;
    const ancienne = d.echeance ? String(d.echeance.n) : '';
    const numero = el.value ? Number(el.value) : null;
    if (numero === null) {
      const ok = await this.etat.confirmer(`Délier l’axe ${this.code()} de la facturation ?`, ['Les tâches ne suivront plus une échéance déclenchée par cet axe.'], 'Délier l’axe');
      if (!ok) { el.value = ancienne; return; }
      void this.etat.saisir((id) => this.api.facturationAxe(id, this.code(), null), { siErreur: () => (el.value = ancienne) });
      return;
    }
    const cible = d.echeancier.find((e) => e.n === numero);
    if (!cible || (cible.realiseLe && cible.n !== d.echeance?.n) || (cible.axeCode && cible.axeCode !== this.code())) {
      this.etat.afficher('Cette échéance est déjà facturée ou liée à un autre axe.', 'attention');
      el.value = ancienne;
      return;
    }
    const phases = d.phasesAutres.filter((p) => p.numero !== numero);
    const directes = d.taches.filter((t) => t.tr.ech != null);
    let phasesADelier: string[] = [];
    if (phases.length) {
      const choix = await this.etat.demander(
        `Lier Axe ${this.code()} à l’échéance n° ${numero} ?`,
        [
          'Une tâche ne déclenche qu’une seule facture.',
          `${directes.length} tâche(s) de l’axe ont aujourd’hui une échéance individuelle : elle sera reprise par l’axe.`,
          ...phases.map((p) => `${p.n} tâche(s) de l’axe appartiennent à la phase ${p.code}, liée en entier à l’échéance n° ${p.numero}.`),
        ],
        [
          { libelle: 'Annuler', valeur: null },
          { libelle: 'Délier les phases', valeur: 'delier' },
          { libelle: 'Garder sur la phase', valeur: 'garder', principal: true },
        ],
      );
      if (choix === null) { el.value = ancienne; return; }
      if (choix === 'delier') phasesADelier = phases.map((p) => p.code);
    } else if (directes.length) {
      const ok = await this.etat.confirmer(
        `Lier Axe ${this.code()} à l’échéance n° ${numero} ?`,
        ['Une tâche ne déclenche qu’une seule facture.', `${directes.length} tâche(s) de l’axe ont aujourd’hui une échéance individuelle : elle sera reprise par l’axe.`],
        'Lier l’axe',
      );
      if (!ok) { el.value = ancienne; return; }
    }
    void this.etat.saisir((id) => this.api.facturationAxe(id, this.code(), numero, phasesADelier), { siErreur: () => (el.value = ancienne) });
  }
  protected facturer(numero: number): void { void this.etat.saisir((id) => this.api.realiserEcheance(id, numero, this.vue()?.aujourdhui ?? new Date().toISOString().slice(0, 10))); }
}
