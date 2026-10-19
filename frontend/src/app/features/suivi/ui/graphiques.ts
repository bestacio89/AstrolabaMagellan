import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Groupe, MoisCalcule, Photo } from '../api/modeles';
import { fD, fJ, fML, fSigned, MOIS } from '../etat/formats';
import { niceStep } from '../etat/outils';

/** Ligne d'une info-bulle de graphique. */
interface LigneBulle {
  libelle: string;
  valeur: string;
  couleur: string | null;
}

interface Bulle {
  titre: string;
  lignes: LigneBulle[];
}

/** Info-bulle qui suit la souris au-dessus des zones survolables (.hot) d'un graphique. */
abstract class AvecBulle {
  protected readonly survol = signal<{ i: number; x: number; y: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);

  protected survoler(e: MouseEvent, i: number, rect: { x: number; y: number; w: number; h: number }): void {
    const boite = (e.currentTarget as Element).closest('.chart')?.getBoundingClientRect();
    if (!boite) return;
    let left = e.clientX - boite.left + 14;
    if (left + 210 > boite.width) left = e.clientX - boite.left - 214;
    this.survol.set({ i, x: Math.max(0, left), y: Math.max(0, e.clientY - boite.top - 50), rect });
  }

  protected quitter(): void {
    this.survol.set(null);
  }
}

/** « Prévu, consommé et atterrissage par axe » : barres horizontales groupées. */
@Component({
  selector: 'app-graphique-axes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geo();
    <div class="chart" (mouseleave)="quitter()">
      <svg [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" role="img" [attr.aria-label]="'Prévu, consommé et atterrissage par ' + dimension()">
        @if (survol(); as s) {
          <rect class="hl" [attr.x]="s.rect.x" [attr.y]="s.rect.y" [attr.width]="s.rect.w" [attr.height]="s.rect.h" />
        }
        @for (t of g.graduations; track t.v) {
          <line class="gridl" [attr.x1]="t.x" [attr.x2]="t.x" [attr.y1]="g.T" [attr.y2]="g.H - g.B" />
          <text class="axis" [attr.x]="t.x" [attr.y]="g.H - 8" text-anchor="middle">{{ t.libelle }}</text>
        }
        @for (a of g.axes; track a.cle; let k = $index) {
          <text class="axis lbl-axe" [attr.x]="g.L - 8" [attr.y]="a.yNom" text-anchor="end">{{ a.nom }}</text>
          @for (b of a.barres; track b.cle) {
            @if (b.chemin) {
              <path [attr.d]="b.chemin" [style.fill]="b.couleur" />
            }
            <text class="axis val" [attr.x]="b.xVal" [attr.y]="b.yVal">{{ b.libelle }}</text>
          }
          <rect class="hot" x="0" [attr.y]="a.yHot" [attr.width]="g.W" [attr.height]="g.grp" (mousemove)="survoler($event, k, { x: 0, y: a.yHot, w: g.W, h: g.grp })" />
        }
        <line [attr.x1]="g.L" [attr.x2]="g.L" [attr.y1]="g.T" [attr.y2]="g.H - g.B" stroke="var(--line-strong)" />
      </svg>
      @if (survol(); as s) {
        <div class="tip" [style.left.px]="s.x" [style.top.px]="s.y">
          <b>{{ bulles()[s.i].titre }}</b>
          @for (l of bulles()[s.i].lignes; track l.libelle) {
            <div>
              <span>
                @if (l.couleur) {
                  <i class="sw" [style.background]="l.couleur"></i>
                }
                {{ l.libelle }}
              </span>
              <span>{{ l.valeur }}</span>
            </div>
          }
        </div>
      }
    </div>
    <div class="legend center">
      @for (s of series; track s[0]) {
        <span><i [style.background]="s[2]"></i>{{ s[1] }}</span>
      }
    </div>
  `,
})
export class GraphiqueAxes extends AvecBulle {
  readonly axes = input.required<Groupe[]>();
  readonly dimension = input('axe');
  protected readonly series: [keyof Pick<Groupe, 'prevu' | 'conso' | 'atterrissage'>, string, string][] = [
    ['prevu', 'Prévu (JH)', 'var(--c-prevu)'],
    ['conso', 'Consommé (JH)', 'var(--c-conso)'],
    ['atterrissage', 'Atterrissage (JH)', 'var(--c-atter)'],
  ];

  protected readonly geo = computed(() => {
    const axes = this.axes();
    const S = this.series;
    const W = 560,
      L = 170,
      R = 44,
      T = 6,
      bh = 9,
      gap = 2,
      grp = S.length * (bh + gap) + 14,
      B = 24;
    const H = T + axes.length * grp + B;
    const maxV = Math.max(1, ...axes.map((a) => Math.max(a.prevu, a.conso, a.atterrissage)));
    const step = niceStep(maxV / 4),
      top = Math.ceil(maxV / step) * step;
    const x = (v: number) => L + ((W - L - R) * v) / top;
    const graduations: { v: number; x: number; libelle: string }[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) graduations.push({ v, x: x(v), libelle: fJ(v) });
    return {
      W,
      H,
      L,
      T,
      B,
      grp,
      graduations,
      axes: axes.map((a, k) => {
        const y0 = T + k * grp + 7;
        return {
          cle: a.id + '|' + k,
          nom: a.nom.length > 26 ? a.nom.slice(0, 25) + '…' : a.nom,
          yNom: y0 + (S.length * (bh + gap)) / 2 + 3,
          yHot: T + k * grp,
          barres: S.map(([cle, , couleur], j) => {
            const y = y0 + j * (bh + gap),
              w = x(a[cle]) - L;
            const l = Math.max(w - 3, 0);
            return {
              cle,
              couleur,
              chemin: w > 0 ? `M${L},${y} h${l} q3,0 3,3 v${bh - 6} q0,3 -3,3 h${-l} z` : null,
              xVal: x(a[cle]) + 4,
              yVal: y + bh - 1,
              libelle: fJ(a[cle]),
            };
          }),
        };
      }),
    };
  });

  protected readonly bulles = computed<Bulle[]>(() =>
    this.axes().map((a) => ({
      titre: a.nom,
      lignes: [
        ...this.series.map(([cle, l, couleur]) => ({ libelle: l.replace(' (JH)', ''), valeur: fJ(a[cle]) + ' JH', couleur })),
        { libelle: 'Écart', valeur: fSigned(a.ecart) + ' JH', couleur: null },
      ],
    })),
  );
}

/** « Charge mensuelle — référence vs consommé saisi » : deux courbes. */
@Component({
  selector: 'app-graphique-mois',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geo();
    <div class="chart" (mouseleave)="quitter()">
      <svg [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" role="img" aria-label="Charge mensuelle : référence initiale et consommé saisi">
        @if (survol(); as s) {
          <rect class="hl" [attr.x]="s.rect.x" [attr.y]="s.rect.y" [attr.width]="s.rect.w" [attr.height]="s.rect.h" />
        }
        @for (t of g.graduations; track t.v) {
          <line class="gridl" [attr.x1]="g.L" [attr.x2]="g.W - g.R" [attr.y1]="t.y" [attr.y2]="t.y" />
          <text class="axis" [attr.x]="g.L - 6" [attr.y]="t.y + 4" text-anchor="end">{{ t.libelle }}</text>
        }
        @for (m of g.mois; track m.mois) {
          <text class="axis" [attr.x]="m.cx" [attr.y]="g.H - 16" text-anchor="middle">{{ m.court }}</text>
          @if (m.annee) {
            <text class="axis" [attr.x]="m.cx" [attr.y]="g.H - 3" text-anchor="middle" style="font-weight: 700">{{ m.annee }}</text>
          }
        }
        @if (g.xAujourdhui != null) {
          <line [attr.x1]="g.xAujourdhui" [attr.x2]="g.xAujourdhui" [attr.y1]="g.T" [attr.y2]="g.H - g.B" stroke="var(--today)" stroke-dasharray="3 3" stroke-width="1.5" />
          <text class="axis" [attr.x]="g.xAujourdhui + 4" [attr.y]="g.T + 9" style="fill: var(--today)">aujourd’hui</text>
        }
        @for (c of g.courbes; track c.couleur) {
          @if (c.points) {
            <polyline fill="none" stroke-width="2" stroke-linejoin="round" [style.stroke]="c.couleur" [attr.points]="c.points" />
          }
          @for (p of c.ronds; track $index) {
            <circle r="4" [attr.cx]="p.x" [attr.cy]="p.y" [style.fill]="c.couleur" style="stroke: var(--surface); stroke-width: 2" />
          }
        }
        @for (m of g.mois; track m.mois; let i = $index) {
          <rect class="hot" [attr.x]="m.xHot" [attr.y]="g.T" [attr.width]="g.bw" [attr.height]="g.H - g.T - g.B" (mousemove)="survoler($event, i, { x: m.xHot, y: g.T, w: g.bw, h: g.H - g.T - g.B })" />
        }
        <line [attr.x1]="g.L" [attr.x2]="g.W - g.R" [attr.y1]="g.y0" [attr.y2]="g.y0" stroke="var(--line-strong)" />
      </svg>
      @if (survol(); as s) {
        <div class="tip" [style.left.px]="s.x" [style.top.px]="s.y">
          <b>{{ bulles()[s.i].titre }}</b>
          @for (l of bulles()[s.i].lignes; track l.libelle) {
            <div>
              <span>
                @if (l.couleur) {
                  <i class="sw" [style.background]="l.couleur"></i>
                }
                {{ l.libelle }}
              </span>
              <span>{{ l.valeur }}</span>
            </div>
          }
        </div>
      }
    </div>
    <div class="legend center">
      <span><i class="line" style="background: var(--c-conso)"></i>Consommé saisi</span>
      <span><i class="line" style="background: var(--c-prevu)"></i>Référence initiale</span>
    </div>
  `,
})
export class GraphiqueMois extends AvecBulle {
  readonly mensuel = input.required<MoisCalcule[]>();
  readonly moisCourant = input.required<string>();

  /**
   * Dernier mois affiché pour le consommé : jusqu'au mois écoulé (pas de chute à 0 sur le mois en cours tant que rien n'y est saisi),
   * et au-delà s'il y a des saisies plus tardives : toute saisie apparaît.
   */
  private readonly jusqua = computed(() => {
    const data = this.mensuel();
    const dernier = data.reduce((m, d, i) => (d.conso > 0 ? i : m), -1);
    const cur = data.findIndex((d) => d.mois === this.moisCourant());
    return cur < 0 ? dernier : Math.max(dernier, data[cur]?.conso > 0 ? cur : cur - 1);
  });

  protected readonly geo = computed(() => {
    const data = this.mensuel();
    const upto = this.jusqua();
    const cur = data.findIndex((d) => d.mois === this.moisCourant());
    const W = 560,
      L = 36,
      R = 12,
      T = 12,
      B = 36,
      H = 262;
    const maxV = Math.max(1, ...data.map((d) => Math.max(d.conso, d.ref)));
    const step = niceStep(maxV / 4),
      top = Math.ceil(maxV / step) * step;
    const bw = (W - L - R) / Math.max(1, data.length);
    const cx = (i: number) => L + bw * i + bw / 2;
    const y = (v: number) => T + (H - T - B) * (1 - v / top);
    const graduations: { v: number; y: number; libelle: string }[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) graduations.push({ v, y: y(v), libelle: fJ(v) });
    const courbe = (cle: 'ref' | 'conso', couleur: string, n: number) => {
      const pts = data.slice(0, n).map((d, i) => ({ x: cx(i), y: y(d[cle]) }));
      return { couleur, points: pts.length ? pts.map((p) => `${p.x},${p.y}`).join(' ') : null, ronds: pts };
    };
    return {
      W,
      H,
      L,
      R,
      T,
      B,
      bw,
      y0: y(0),
      graduations,
      xAujourdhui: cur >= 0 ? cx(cur) : null,
      mois: data.map((d, i) => {
        const [yy, mm] = d.mois.split('-');
        return { mois: d.mois, cx: cx(i), xHot: L + bw * i, court: MOIS[+mm - 1].replace('.', ''), annee: i === 0 || mm === '01' ? yy : null };
      }),
      courbes: [courbe('ref', 'var(--c-prevu)', data.length), courbe('conso', 'var(--c-conso)', upto + 1)],
    };
  });

  protected readonly bulles = computed<Bulle[]>(() => {
    const upto = this.jusqua();
    return this.mensuel().map((d, i) => ({
      titre: fML(d.mois),
      lignes: [
        { libelle: 'Référence initiale', valeur: fJ(d.ref) + ' JH', couleur: 'var(--c-prevu)' },
        ...(i <= upto
          ? [
              { libelle: 'Consommé saisi', valeur: fJ(d.conso) + ' JH', couleur: 'var(--c-conso)' },
              { libelle: 'Écart', valeur: fSigned(d.conso - d.ref) + ' JH', couleur: null },
            ]
          : [{ libelle: 'Consommé', valeur: 'à venir', couleur: null }]),
      ],
    }));
  });
}

/** Évolution des indicateurs d'un comité à l'autre (une photo à chaque export COPIL / COPROJ). */
@Component({
  selector: 'app-graphique-historique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geo();
    <div class="chart">
      <svg [attr.viewBox]="'0 0 ' + g.W + ' ' + g.H" role="img" aria-label="Atterrissage et charge prévue d’un comité à l’autre">
        @for (t of g.graduations; track $index) {
          <line [attr.x1]="g.L" [attr.x2]="g.W - g.R" [attr.y1]="t.y" [attr.y2]="t.y" style="stroke: var(--line)" stroke-dasharray="3 3" />
          <text class="axis" [attr.x]="g.L - 6" [attr.y]="t.y + 4" text-anchor="end">{{ t.libelle }}</text>
        }
        @for (p of g.points; track $index) {
          <text class="axis" [attr.x]="p.x" [attr.y]="p.yAtter - 9" text-anchor="middle" style="font-weight: 700">{{ p.atter }}</text>
          <text class="axis" [attr.x]="p.x" [attr.y]="g.H - 14" text-anchor="middle">{{ p.date }}</text>
          <text class="axis" [attr.x]="p.x" [attr.y]="g.H - 2" text-anchor="middle">{{ p.kind }}</text>
        }
        @for (c of g.courbes; track c.couleur) {
          <polyline fill="none" stroke-width="2" [style.stroke]="c.couleur" [attr.points]="c.points" />
          @for (p of c.ronds; track $index) {
            <circle r="4" [attr.cx]="p.x" [attr.cy]="p.y" [style.fill]="c.couleur" style="stroke: var(--surface); stroke-width: 2">
              <title>{{ p.titre }}</title>
            </circle>
          }
        }
      </svg>
    </div>
    <div class="legend center">
      <span><i class="line" style="background: var(--c-prevu)"></i>Prévu</span>
      <span><i class="line" style="background: var(--c-atter)"></i>Atterrissage</span>
    </div>
  `,
})
export class GraphiqueHistorique {
  readonly photos = input.required<Photo[]>();

  protected readonly geo = computed(() => {
    const pts = this.photos();
    const W = 560,
      L = 44,
      R = 16,
      T = 14,
      B = 34,
      H = 200;
    const vals = pts.flatMap((h) => [h.atterrissage, h.prevu]);
    // échelle lisible : marge d'au moins 5 % autour des valeurs, pour qu'un petit écart ne paraisse pas énorme
    const mn = Math.min(...vals),
      mx = Math.max(...vals),
      pad = Math.max((mx - mn) * 0.2, mx * 0.05, 1);
    const lo = Math.max(0, mn - pad),
      hi = mx + pad;
    const x = (i: number) => (pts.length === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (pts.length - 1));
    const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
    const courbe = (cle: 'prevu' | 'atterrissage', couleur: string) => ({
      couleur,
      points: pts.map((h, i) => `${x(i)},${y(h[cle])}`).join(' '),
      ronds: pts.map((h, i) => ({ x: x(i), y: y(h[cle]), titre: `${fD(h.date)} (${h.kind}) : ${fJ(h[cle])} JH` })),
    });
    return {
      W,
      H,
      L,
      R,
      graduations: [0, 0.5, 1].map((k) => {
        const v = lo + (hi - lo) * k;
        return { y: y(v), libelle: fJ(Math.round(v)) };
      }),
      points: pts.map((h, i) => ({ x: x(i), yAtter: y(h.atterrissage), atter: fJ(h.atterrissage), date: fD(h.date).slice(0, 5), kind: h.kind })),
      courbes: [courbe('prevu', 'var(--c-prevu)'), courbe('atterrissage', 'var(--c-atter)')],
    };
  });
}
