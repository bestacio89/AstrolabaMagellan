import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';
import { EtatTri, ordonner, triSuivant, valeurDeTri } from '../etat/tri.logique';

const CLE = 'pilotage.tri';

/** États de tri mémorisés sur ce poste, par tableau (écran + intitulés des colonnes). */
function lire(): Record<string, EtatTri> {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? '{}') as Record<string, EtatTri>;
  } catch {
    return {};
  }
}
function ecrire(o: Record<string, EtatTri>): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(o));
  } catch {
    /* stockage indisponible : le tri reste valable jusqu'au prochain affichage */
  }
}

/**
 * Tri des colonnes d'un tableau (charte v2) : un clic (ou Entrée) sur l'en-tête trie la colonne, ▲ puis ▼ puis ordre d'origine.
 * Le tri se fait à l'intérieur de chaque groupe : bandeaux de groupe, sous-totaux et totaux restent à leur place.
 * Il ne change que l'affichage (pas les données) et il est mémorisé par tableau sur ce poste.
 * Les lignes restent celles d'Angular : seul leur ordre dans le tableau change, et il est réappliqué après chaque mise à jour.
 * Valeur d'une cellule : son attribut data-sort, sinon sa liste ou sa case de saisie, sinon son texte.
 */
@Directive({ selector: 'table[appTriable]', host: { class: 'triable' } })
export class Triable implements AfterViewInit, OnDestroy {
  /** Clé du tableau (par défaut : intitulés des colonnes), pour mémoriser son tri. */
  readonly appTriable = input<string>('');
  private readonly table = inject<ElementRef<HTMLTableElement>>(ElementRef).nativeElement;
  private observateur: MutationObserver | null = null;
  private enCours = false;
  private readonly ordre = new WeakMap<HTMLTableRowElement, number>();
  private compteur = 0;

  private readonly clic = (e: Event): void => {
    const th = (e.target as HTMLElement).closest('th.th-tri') as HTMLTableCellElement | null;
    if (!th || !this.table.contains(th)) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label, app-fx')) return;
    if (e instanceof KeyboardEvent) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
    }
    const tous = lire();
    const cle = this.cle();
    const suivant = triSuivant(tous[cle], th.cellIndex);
    if (suivant) tous[cle] = suivant;
    else delete tous[cle];
    ecrire(tous);
    this.appliquer();
  };

  ngAfterViewInit(): void {
    this.table.addEventListener('click', this.clic);
    this.table.addEventListener('keydown', this.clic);
    this.appliquer();
    // Angular ajoute, retire ou modifie des lignes : le tri est réappliqué (sans boucle : on ignore nos propres déplacements)
    this.observateur = new MutationObserver(() => {
      if (!this.enCours) queueMicrotask(() => this.appliquer());
    });
    this.observateur.observe(this.table, { childList: true, subtree: true, characterData: true });
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
    this.table.removeEventListener('click', this.clic);
    this.table.removeEventListener('keydown', this.clic);
  }

  private cle(): string {
    const entetes = [...(this.table.tHead?.rows[0]?.cells ?? [])].map((th) => (th.textContent ?? '').replace(/[▲▼]/g, '').trim());
    return `${location.pathname.split('/').pop()}|${this.appTriable() || entetes.join('¦')}`;
  }

  private valeur(td: HTMLTableCellElement | undefined): number | string | null {
    if (!td) return null;
    const ds = td.dataset['sort'];
    if (ds != null) {
      if (ds === '') return null;
      const n = Number(ds);
      return Number.isFinite(n) ? n : ds.toLowerCase();
    }
    const sel = td.querySelector('select');
    if (sel && sel.value !== '' && Number.isFinite(Number(sel.value))) return Number(sel.value);
    if (sel) return sel.selectedOptions[0]?.text.toLowerCase() ?? null;
    const champ = td.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea');
    return valeurDeTri(champ ? champ.value : (td.textContent ?? ''));
  }

  /** Ligne déplaçable : autant de cellules que l'en-tête, sans fusion, hors bandeaux, sections et totaux. */
  private mobile(tr: HTMLTableRowElement, n: number): boolean {
    if (/\b(grp|axg|total|tot|sec|sub|tsub|detail|sep|empty|is-tot|wl-total)\b/.test(tr.className) || tr.hidden) return false;
    const c = [...tr.cells];
    return c.length === n && c.every((td) => td.colSpan === 1 && td.rowSpan === 1);
  }

  private appliquer(): void {
    const tete = this.table.tHead;
    const corps = this.table.tBodies[0];
    if (!tete || tete.rows.length !== 1 || !corps) return;
    this.enCours = true;
    try {
      const ths = [...tete.rows[0].cells];
      const n = ths.length;
      const etat = lire()[this.cle()] ?? null;
      ths.forEach((th, i) => {
        if (th.colSpan === 1 && (th.textContent ?? '').trim()) {
          th.classList.add('th-tri');
          th.tabIndex = 0;
          if (!th.title) th.title = 'Trier sur cette colonne';
        }
        const actif = !!etat && etat[0] === i;
        th.setAttribute('aria-sort', actif ? (etat![1] > 0 ? 'ascending' : 'descending') : 'none');
        let ind = th.querySelector<HTMLElement>(':scope > .tri-ind');
        if (!ind && th.classList.contains('th-tri')) {
          ind = document.createElement('span');
          ind.className = 'tri-ind';
          ind.setAttribute('aria-hidden', 'true');
          th.append(ind);
        }
        if (ind) ind.textContent = actif ? (etat![1] > 0 ? '▲' : '▼') : '';
      });
      const lignes = [...corps.rows];
      for (const tr of lignes) if (!this.ordre.has(tr)) this.ordre.set(tr, this.compteur++);
      // segments de lignes déplaçables entre deux lignes fixes : chacun est trié à sa place
      const segments: (HTMLTableRowElement | HTMLTableRowElement[])[] = [];
      let cur: HTMLTableRowElement[] = [];
      for (const tr of lignes) {
        if (this.mobile(tr, n)) cur.push(tr);
        else {
          if (cur.length) segments.push(cur);
          cur = [];
          segments.push(tr);
        }
      }
      if (cur.length) segments.push(cur);
      // chaque segment est réordonné à sa place (juste avant ce qui le suit) : les repères d'Angular entre les groupes ne bougent
      // pas, une ligne ajoutée plus tard arrive donc dans le bon groupe, puis le tri est réappliqué
      for (const s of segments) {
        if (!Array.isArray(s) || s.length < 2) continue;
        const base = s.slice().sort((a, b) => this.ordre.get(a)! - this.ordre.get(b)!);
        const idx = etat && etat[0] < n ? ordonner(base.map((tr) => this.valeur(tr.cells[etat[0]])), etat[1]) : base.map((_, i) => i);
        const voulu = idx.map((i) => base[i]);
        if (voulu.every((tr, i) => s[i] === tr)) continue; // déjà dans l'ordre : rien à déplacer
        const apres = s[s.length - 1].nextSibling;
        for (const tr of voulu) corps.insertBefore(tr, apres);
      }
    } finally {
      queueMicrotask(() => (this.enCours = false));
    }
  }
}
