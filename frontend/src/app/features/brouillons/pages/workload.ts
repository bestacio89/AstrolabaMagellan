import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatJh } from '../../../shared/format/formats';
import { Icone } from '../../../shared/ui/icone';
import { TacheSaisie } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import {
  chargeProfil,
  chargeTache,
  chargeTotale,
  collerDansLeWorkload,
  ColonneWorkload,
  deplacerLigne,
  lignesAffichees,
  ligneVierge,
  lireCollage,
  lireNombre,
  nouvelId,
  separateurVierge,
  texteNombre,
} from '../etat/brouillon.logique';
import { ControlesRubrique, EtatRubrique, ResumeDirect } from './communs';

type ChampTexte = 'axe' | 'lot' | 'phase' | 'etape' | 'libelle' | 'hypothese';

/**
 * Rubrique « Workload » : l'onglet WORKLOAD du TSP, saisi comme dans un tableur.
 * - Entrée (ou flèches haut et bas) change de ligne, Tab de colonne ; un bloc copié depuis Excel se colle d'un coup ;
 * - des séparateurs (titres sans valeur, ex. « Socle sécurité ») organisent les lignes et portent le total de leur section ;
 * - les lignes se déplacent en les glissant par leur poignée (ou par le menu : Monter, Descendre) ;
 * - une suppression ou un collage s'annule d'un clic.
 */
@Component({
  selector: 'app-workload-brouillon',
  imports: [RouterLink, Icone, EtatRubrique, ControlesRubrique, ResumeDirect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.contenu(); as tsp) {
      <section class="card">
        <header>
          <div>
            <h2>Workload</h2>
            <p>Les tâches du TSP et leurs jours par profil. Saisie au clavier comme dans Excel ; glissez une ligne par sa poignée pour la déplacer.</p>
          </div>
          <app-etat-rubrique rubrique="workload" />
        </header>

        @if (!tsp.profils.length) {
          <div class="banner info">
            <span>Ajoutez d’abord les profils : chacun devient une colonne de jours du workload.</span>
            <a class="btn" [routerLink]="['/brouillons', etat.brouillon()?.id, 'profils']">Ajouter les profils</a>
          </div>
        }

        <div class="toolbar wl-outils">
          <button type="button" class="btn primary" (click)="ajouterEnBas(false)"><app-icone nom="plus" [taille]="16" />Ligne</button>
          <button type="button" class="btn" (click)="ajouterEnBas(true)" title="Un titre qui organise le workload, sans aucune valeur (ex. « Socle sécurité »)">
            <app-icone nom="plus" [taille]="16" />Séparateur
          </button>
          <button type="button" class="btn" [attr.aria-expanded]="aideCollage()" aria-controls="wl-aide" (click)="aideCollage.set(!aideCollage())">
            <app-icone nom="presse-papiers" [taille]="16" />Coller depuis Excel
          </button>
          <span class="spacer"></span>
          <app-resume-direct [lignes]="nombreTaches()" />
        </div>
        @if (aideCollage()) {
          <p id="wl-aide" class="note wl-aide">
            Dans Excel, sélectionnez les cellules (par exemple les colonnes <b>ID à Tâche</b> de l’onglet WORKLOAD), copiez-les
            (<kbd>Ctrl</kbd> + <kbd>C</kbd>), cliquez ici dans la cellule de départ, puis collez (<kbd>Ctrl</kbd> + <kbd>V</kbd>).
            Les colonnes se remplissent vers la droite dans cet ordre : Axe, Lot, Phase, Étape, Tâche, un profil par colonne, Livrable, Hypothèse.
            Les lignes qui manquent sont ajoutées ; une ligne avec un libellé et sans charge devient un séparateur, comme dans le TSP.
          </p>
        }
        @if (annulation(); as a) {
          <div class="wl-colle" role="status">
            <span>{{ a.message }}</span>
            <button type="button" class="btn" (click)="annuler()">Annuler</button>
            <button type="button" class="btn ghost" aria-label="Fermer" (click)="annulation.set(null)"><app-icone nom="fermer" [taille]="14" /></button>
          </div>
        }

        @if (tsp.taches.length) {
          <div class="tw tall">
            <table class="plangrid wl" (paste)="coller($event)" (keydown)="clavier($event)">
              <thead>
                <tr>
                  <th scope="col" class="wl-c-poignee"><span class="visuellement-cache">Déplacer</span></th>
                  <th scope="col" class="n">#</th>
                  <th scope="col">Axe</th>
                  <th scope="col">Lot</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Étape</th>
                  <th scope="col" class="wl-c-lib">Tâche</th>
                  @for (p of tsp.profils; track p.id) {
                    <th scope="col" class="n wl-c-p" [title]="p.nom">{{ p.nom || 'Profil sans nom' }}</th>
                  }
                  <th scope="col" class="n">Total</th>
                  <th scope="col" title="Livrable à remettre au client">Livr.</th>
                  <th scope="col">Hypothèse / commentaire</th>
                  <th scope="col"><span class="visuellement-cache">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lignes(); track l.cle) {
                  @let t = tsp.taches[l.index];
                  <tr
                    [class.wl-sep]="l.separateur"
                    [class.wl-glisse]="glisse() === l.index"
                    [class.wl-cible-avant]="cible()?.index === l.index && !cible()!.apres"
                    [class.wl-cible-apres]="cible()?.index === l.index && cible()!.apres"
                    (dragover)="survol(l.index, $event)"
                    (drop)="deposer($event)"
                  >
                    <td class="wl-c-poignee">
                      <span class="wl-poignee" draggable="true" (dragstart)="debutGlisser(l.index, $event)" (dragend)="finGlisser()" title="Glisser pour déplacer la ligne" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                      </span>
                    </td>
                    <td class="n muted num">{{ l.index + 1 }}</td>
                    @if (l.separateur) {
                      <td colspan="5" class="wl-sep-titre">
                        <input class="pin wl-t" [value]="t.libelle" (input)="texte(t.id, 'libelle', $event)" [attr.data-l]="l.index" data-c="libelle" aria-label="Titre du séparateur" placeholder="Titre du séparateur (ex. Socle sécurité)" />
                      </td>
                      @for (v of l.parProfil; track $index) {
                        <td class="n num wl-sep-n">{{ v ? jh(v) : '' }}</td>
                      }
                      <td class="n num wl-sep-n">{{ l.total ? jh(l.total) : '' }}</td>
                      <td colspan="2" class="wl-sep-note">séparateur · sans valeur</td>
                    } @else {
                      <td><input class="pin wl-t wl-axe" [value]="t.axe" (input)="texte(t.id, 'axe', $event)" [attr.data-l]="l.index" data-c="axe" list="wl-axes" aria-label="Axe" /></td>
                      <td><input class="pin wl-t wl-lot" [value]="t.lot" (input)="texte(t.id, 'lot', $event)" [attr.data-l]="l.index" data-c="lot" list="wl-lots" aria-label="Lot" /></td>
                      <td><input class="pin wl-t wl-phase" [value]="t.phase" (input)="texte(t.id, 'phase', $event)" (change)="majuscules(t.id, $event)" [attr.data-l]="l.index" data-c="phase" list="wl-phases" aria-label="Phase" /></td>
                      <td><input class="pin wl-t wl-etape" [value]="t.etape" (input)="texte(t.id, 'etape', $event)" [attr.data-l]="l.index" data-c="etape" list="wl-etapes" aria-label="Étape" /></td>
                      <td class="wl-c-lib">
                        <input class="pin wl-t wl-lib" [value]="t.libelle" (input)="texte(t.id, 'libelle', $event)" [attr.data-l]="l.index" data-c="libelle" aria-label="Tâche" [placeholder]="l.index === 0 ? 'Libellé de la tâche' : ''" />
                      </td>
                      @for (p of tsp.profils; track p.id) {
                        <td class="pcell">
                          <input class="pin" inputmode="decimal" [value]="tn(t.charges[p.id])" (change)="charge(t.id, p.id, $event)" [attr.data-l]="l.index" [attr.data-c]="'profil:' + p.id" [attr.aria-label]="'Jours ' + (p.nom || 'profil')" />
                        </td>
                      }
                      <td class="n num wl-tot">{{ chargeDe(t) ? jh(chargeDe(t)) : '' }}</td>
                      <td class="wl-livr">
                        <input type="checkbox" [checked]="t.livrable" (change)="livrable(t.id, $event)" [attr.data-l]="l.index" data-c="livrable" aria-label="Livrable" />
                      </td>
                      <td><input class="pin wl-t wl-hyp" [value]="t.hypothese" (input)="texte(t.id, 'hypothese', $event)" [attr.data-l]="l.index" data-c="hypothese" aria-label="Hypothèse ou commentaire" /></td>
                    }
                    <td class="wl-actions">
                      <button type="button" class="btn ghost wl-x" (click)="supprimer(l.index)" [attr.aria-label]="'Supprimer la ligne ' + (l.index + 1)" title="Supprimer la ligne">
                        <app-icone nom="poubelle" [taille]="15" />
                      </button>
                      <details class="dd wl-menu">
                        <summary class="btn ghost" [attr.aria-label]="'Autres actions sur la ligne ' + (l.index + 1)">⋯</summary>
                        <div class="dd-menu" role="menu">
                          <button type="button" class="dd-i dd-btn" role="menuitem" (click)="inserer(l.index, false, $event)">Insérer une ligne dessous</button>
                          <button type="button" class="dd-i dd-btn" role="menuitem" (click)="inserer(l.index, true, $event)">Insérer un séparateur dessous</button>
                          @if (!l.separateur) {
                            <button type="button" class="dd-i dd-btn" role="menuitem" (click)="dupliquer(l.index, $event)">Dupliquer</button>
                          }
                          <button type="button" class="dd-i dd-btn" role="menuitem" (click)="basculer(l.index, $event)">
                            {{ l.separateur ? 'Transformer en ligne de tâche' : 'Transformer en séparateur' }}
                          </button>
                          <div class="dd-sep"></div>
                          <button type="button" class="dd-i dd-btn" role="menuitem" [disabled]="l.index === 0" (click)="deplacer(l.index, -1, $event)">Monter</button>
                          <button type="button" class="dd-i dd-btn" role="menuitem" [disabled]="l.index === tsp.taches.length - 1" (click)="deplacer(l.index, 1, $event)">Descendre</button>
                        </div>
                      </details>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="total">
                  <td colspan="7">Total du TSP</td>
                  @for (p of tsp.profils; track p.id) {
                    <td class="n num">{{ jh(totalProfil(p.id)) }}</td>
                  }
                  <td class="n num">{{ jh(total()) }}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="wl-clavier muted">
            <kbd>Entrée</kbd> ou <kbd>↓</kbd> ligne suivante (une ligne est ajoutée en fin de tableau) · <kbd>↑</kbd> ligne précédente ·
            <kbd>Tab</kbd> colonne suivante · <kbd>Ctrl</kbd> + <kbd>V</kbd> coller un bloc d’Excel · poignée
            <span class="wl-poignee-ex" aria-hidden="true">⠿</span> glisser pour déplacer · les cases vides valent 0
          </p>
        } @else {
          <div class="empty wl-vide">
            <p>Aucune ligne pour l’instant.</p>
            <span class="wl-vide-b">
              <button type="button" class="btn primary" (click)="ajouterEnBas(false)"><app-icone nom="plus" [taille]="16" />Ajouter la première ligne</button>
              <button type="button" class="btn" (click)="ajouterEnBas(true)"><app-icone nom="plus" [taille]="16" />Commencer par un séparateur</button>
            </span>
            <p class="muted">Ou ajoutez une ligne, puis collez-y un bloc copié depuis le WORKLOAD d’un TSP Excel.</p>
          </div>
        }

        <datalist id="wl-axes">
          @for (v of axes(); track v) {
            <option [value]="v"></option>
          }
        </datalist>
        <datalist id="wl-lots">
          @for (v of lots(); track v) {
            <option [value]="v"></option>
          }
        </datalist>
        <datalist id="wl-phases">
          @for (v of tsp.phases; track v) {
            <option [value]="v"></option>
          }
        </datalist>
        <datalist id="wl-etapes">
          @for (v of tsp.etapes; track v) {
            <option [value]="v"></option>
          }
        </datalist>
      </section>
      <app-controles-rubrique rubrique="workload" />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .wl-outils {
      margin-bottom: 12px;
    }
    .wl-outils .btn,
    .wl-vide .btn {
      height: 34px;
      padding: 0 12px;
      gap: 6px;
    }
    .spacer {
      flex: 1;
    }
    .wl-aide {
      margin: 0 0 12px;
    }
    kbd {
      display: inline-block;
      padding: 0 5px;
      border: 1px solid var(--line-strong);
      border-bottom-width: 2px;
      border-radius: 4px;
      background: var(--surface);
      font: 500 11.5px/18px var(--police-texte);
    }
    .wl-colle {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding: 8px 8px 8px 14px;
      border-radius: 8px;
      background: var(--c-texte);
      color: #fff;
      font-size: 13.5px;
    }
    .wl-colle span {
      flex: 1;
    }
    .wl-colle .btn {
      height: 30px;
      padding: 0 10px;
      background: transparent;
      color: #fff;
      border-color: rgba(255, 255, 255, 0.4);
    }
    table.wl {
      width: max-content;
      min-width: 100%;
    }
    table.wl td {
      padding: 1px 3px;
    }
    table.wl th {
      padding: 6px 6px;
    }
    .wl .pin {
      width: 58px;
    }
    .wl .wl-t {
      text-align: left;
      width: 100%;
    }
    .wl .wl-axe {
      width: 40px;
    }
    .wl .wl-lot {
      width: 118px;
    }
    .wl .wl-phase {
      width: 122px;
      text-transform: uppercase;
    }
    .wl .wl-etape {
      width: 156px;
    }
    .wl .wl-lib {
      width: 236px;
    }
    .wl .wl-hyp {
      width: 150px;
    }
    .wl-c-p {
      max-width: 90px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wl-tot {
      font-weight: 600;
    }
    .wl-livr {
      text-align: center;
    }
    .wl-livr input {
      width: 16px;
      height: 16px;
      accent-color: var(--accent);
    }
    /* poignée de déplacement (glisser-déposer) */
    .wl-c-poignee {
      width: 22px;
      padding: 0 !important;
    }
    .wl-poignee {
      display: grid;
      place-items: center;
      width: 22px;
      height: 30px;
      color: var(--line-strong);
      cursor: grab;
      border-radius: 4px;
    }
    tr:hover .wl-poignee {
      color: var(--ink-2);
    }
    .wl-poignee:active {
      cursor: grabbing;
    }
    .wl-poignee-ex {
      color: var(--ink-2);
    }
    tr.wl-glisse td {
      opacity: 0.4;
    }
    tr.wl-cible-avant td {
      box-shadow: inset 0 2px 0 var(--accent);
    }
    tr.wl-cible-apres td {
      box-shadow: inset 0 -2px 0 var(--accent);
    }
    /* séparateur : un titre de section, sans valeur (comme les lignes colorées du TSP) */
    tr.wl-sep td {
      background: var(--warn-soft);
      border-top: 1px solid color-mix(in srgb, var(--warn) 30%, var(--line));
    }
    tr.wl-sep:hover td {
      background: color-mix(in srgb, var(--warn-soft) 80%, var(--warn) 8%);
    }
    .wl-sep-titre .pin {
      font-weight: 600;
      color: var(--ink);
    }
    .wl-sep-n {
      font-weight: 600;
      color: var(--ink-2);
    }
    .wl-sep-note {
      font-size: 11.5px;
      color: var(--warn);
      white-space: nowrap;
    }
    .wl-actions {
      white-space: nowrap;
    }
    .wl-x {
      width: 28px;
      height: 28px;
      padding: 0;
      justify-content: center;
      color: var(--ink-2);
    }
    .wl-x:hover {
      color: var(--crit);
    }
    .wl-menu {
      display: inline-block;
    }
    .wl-menu summary {
      width: 28px;
      height: 28px;
      padding: 0;
      justify-content: center;
      list-style: none;
      font-weight: 600;
    }
    .wl-menu summary::-webkit-details-marker {
      display: none;
    }
    .wl-menu .dd-menu {
      right: 0;
      left: auto;
    }
    .wl-clavier {
      margin: 10px 0 0;
      font-size: 12.5px;
      line-height: 22px;
    }
    .wl-vide {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .wl-vide p {
      margin: 0;
    }
    .wl-vide-b {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
  `,
})
export class WorkloadBrouillon {
  protected readonly etat = inject(BrouillonEtat);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly jh = formatJh;
  protected readonly tn = texteNombre;
  protected readonly chargeDe = chargeTache;

  protected readonly aideCollage = signal(false);
  /** Dernière action annulable (collage, suppression) : l'état des lignes juste avant. */
  protected readonly annulation = signal<{ message: string; avant: TacheSaisie[] } | null>(null);
  /** Glisser-déposer : ligne déplacée, et où elle irait. */
  protected readonly glisse = signal<number | null>(null);
  protected readonly cible = signal<{ index: number; apres: boolean } | null>(null);

  protected readonly lignes = computed(() => {
    const tsp = this.etat.contenu();
    return tsp ? lignesAffichees(tsp) : [];
  });
  protected readonly nombreTaches = computed(() => (this.etat.contenu()?.taches ?? []).filter((t) => !t.separateur).length);
  protected readonly total = computed(() => {
    const tsp = this.etat.contenu();
    return tsp ? chargeTotale(tsp) : 0;
  });
  protected readonly axes = computed(() => this.distincts((t) => t.axe));
  protected readonly lots = computed(() => this.distincts((t) => t.lot));

  protected totalProfil(id: string): number {
    const tsp = this.etat.contenu();
    return tsp ? chargeProfil(tsp, id) : 0;
  }

  private distincts(f: (t: TacheSaisie) => string): string[] {
    return [...new Set((this.etat.contenu()?.taches ?? []).filter((t) => !t.separateur).map(f).filter((x) => x.trim()))];
  }

  private tache(t: { taches: TacheSaisie[] }, id: string): TacheSaisie | undefined {
    return t.taches.find((x) => x.id === id);
  }

  protected texte(id: string, champ: ChampTexte, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    this.etat.modifier((t) => {
      const x = this.tache(t, id);
      if (x) x[champ] = valeur;
    });
  }

  protected majuscules(id: string, evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value.trim().toUpperCase();
    this.etat.modifier((t) => {
      const x = this.tache(t, id);
      if (x) x.phase = valeur;
    });
  }

  protected charge(id: string, profilId: string, evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const n = lireNombre(champ.value);
    if (n === null) {
      champ.value = texteNombre(this.tache(this.etat.contenu()!, id)?.charges[profilId]);
      return;
    }
    this.etat.modifier((t) => {
      const x = this.tache(t, id);
      if (!x) return;
      if (n === 0) delete x.charges[profilId];
      else x.charges[profilId] = n;
    });
  }

  protected livrable(id: string, evenement: Event): void {
    const coche = (evenement.target as HTMLInputElement).checked;
    this.etat.modifier((t) => {
      const x = this.tache(t, id);
      if (x) x.livrable = coche;
    });
  }

  private nouvelle(t: { taches: TacheSaisie[] }, separateur: boolean, precedente?: TacheSaisie): TacheSaisie {
    const id = nouvelId('t', t.taches);
    // une ligne qui suit un séparateur ne reprend pas ses champs (vides) : on remonte à la dernière vraie tâche
    const modele = precedente?.separateur ? undefined : precedente;
    return separateur ? separateurVierge(id) : ligneVierge(id, modele);
  }

  private derniereTache(t: { taches: TacheSaisie[] }, avant: number): TacheSaisie | undefined {
    for (let k = Math.min(avant, t.taches.length - 1); k >= 0; k--) if (!t.taches[k].separateur) return t.taches[k];
    return undefined;
  }

  protected ajouterEnBas(separateur: boolean): void {
    const n = this.etat.contenu()?.taches.length ?? 0;
    this.etat.modifier((t) => t.taches.push(this.nouvelle(t, separateur, this.derniereTache(t, t.taches.length - 1))));
    this.focaliser(n, 'libelle');
  }

  protected inserer(index: number, separateur: boolean, evenement: Event): void {
    this.fermerMenu(evenement);
    this.etat.modifier((t) => t.taches.splice(index + 1, 0, this.nouvelle(t, separateur, this.derniereTache(t, index))));
    this.focaliser(index + 1, 'libelle');
  }

  protected dupliquer(index: number, evenement: Event): void {
    this.fermerMenu(evenement);
    this.etat.modifier((t) => t.taches.splice(index + 1, 0, { ...structuredClone(t.taches[index]), id: nouvelId('t', t.taches) }));
  }

  /** Tâche ↔ séparateur. Une tâche chiffrée qui devient séparateur perd ses valeurs : l'action s'annule d'un clic. */
  protected basculer(index: number, evenement: Event): void {
    this.fermerMenu(evenement);
    const avant = structuredClone(this.etat.contenu()?.taches ?? []);
    const ligne = avant[index];
    if (!ligne) return;
    this.etat.modifier((t) => {
      const x = t.taches[index];
      if (x.separateur) Object.assign(x, ligneVierge(x.id, this.derniereTache(t, index - 1)), { libelle: x.libelle });
      else Object.assign(x, separateurVierge(x.id), { libelle: x.libelle });
    });
    if (!ligne.separateur && chargeTache(ligne) > 0) this.annulation.set({ message: 'Ligne transformée en séparateur : ses jours ont été retirés.', avant });
  }

  protected deplacer(index: number, sens: -1 | 1, evenement: Event): void {
    this.fermerMenu(evenement);
    this.etat.modifier((t) => deplacerLigne(t.taches, index, index + sens));
  }

  protected supprimer(index: number): void {
    const avant = structuredClone(this.etat.contenu()?.taches ?? []);
    const ligne = avant[index];
    if (!ligne) return;
    this.etat.modifier((t) => t.taches.splice(index, 1));
    const nom = ligne.libelle.trim() ? `« ${ligne.libelle.trim()} »` : `n° ${index + 1}`;
    this.annulation.set({ message: ligne.separateur ? `Séparateur ${nom} supprimé.` : `Ligne ${nom} supprimée.`, avant });
  }

  protected annuler(): void {
    const a = this.annulation();
    if (!a) return;
    this.etat.modifier((t) => (t.taches = a.avant));
    this.annulation.set(null);
  }

  // ---------- glisser-déposer ----------

  protected debutGlisser(index: number, evenement: DragEvent): void {
    this.glisse.set(index);
    if (!evenement.dataTransfer) return;
    evenement.dataTransfer.effectAllowed = 'move';
    evenement.dataTransfer.setData('text/plain', String(index));
    const ligne = (evenement.target as HTMLElement).closest('tr');
    if (ligne) evenement.dataTransfer.setDragImage(ligne, 16, 16);
  }

  protected survol(index: number, evenement: DragEvent): void {
    if (this.glisse() === null) return;
    evenement.preventDefault();
    if (evenement.dataTransfer) evenement.dataTransfer.dropEffect = 'move';
    const r = (evenement.currentTarget as HTMLElement).getBoundingClientRect();
    const apres = evenement.clientY > r.top + r.height / 2;
    const c = this.cible();
    if (!c || c.index !== index || c.apres !== apres) this.cible.set({ index, apres });
  }

  protected deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    const de = this.glisse();
    const c = this.cible();
    this.finGlisser();
    if (de === null || !c) return;
    let vers = c.index + (c.apres ? 1 : 0);
    if (de < vers) vers -= 1;
    if (vers !== de) this.etat.modifier((t) => deplacerLigne(t.taches, de, vers));
  }

  protected finGlisser(): void {
    this.glisse.set(null);
    this.cible.set(null);
  }

  /** Bloc copié depuis Excel (plusieurs cellules) : collé à partir de la cellule où se trouve le curseur. */
  protected coller(evenement: ClipboardEvent): void {
    const cible = evenement.target as HTMLElement;
    const ligne = Number(cible.dataset['l']);
    const colonne = cible.dataset['c'] as ColonneWorkload | undefined;
    const texte = evenement.clipboardData?.getData('text/plain') ?? '';
    if (!colonne || Number.isNaN(ligne) || !/[\t\n]/.test(texte.replace(/\r?\n$/, ''))) return; // une seule valeur : collage normal
    evenement.preventDefault();
    const bloc = lireCollage(texte);
    const avant = structuredClone(this.etat.contenu()?.taches ?? []);
    this.etat.modifier((t) => collerDansLeWorkload(t, ligne, colonne, bloc));
    this.annulation.set({ message: `${bloc.length} ligne${bloc.length > 1 ? 's' : ''} collée${bloc.length > 1 ? 's' : ''} depuis Excel.`, avant });
  }

  /** Entrée, flèches haut et bas : change de ligne dans la même colonne (Entrée ajoute une ligne en fin de tableau). */
  protected clavier(evenement: KeyboardEvent): void {
    const cible = evenement.target as HTMLInputElement;
    if (cible.tagName !== 'INPUT' || cible.type === 'checkbox') return;
    const ligne = Number(cible.dataset['l']);
    const colonne = cible.dataset['c'];
    if (Number.isNaN(ligne) || !colonne) return;
    // champ avec suggestions : les flèches parcourent les suggestions, Entrée laisse d'abord le navigateur valider celle choisie
    const avecSuggestions = !!cible.getAttribute('list');
    if (avecSuggestions && (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp')) return;
    let suivante: number | null = null;
    if ((evenement.key === 'Enter' && !evenement.shiftKey) || evenement.key === 'ArrowDown') suivante = ligne + 1;
    else if ((evenement.key === 'Enter' && evenement.shiftKey) || evenement.key === 'ArrowUp') suivante = ligne - 1;
    if (suivante === null || suivante < 0) return;
    const nombre = this.etat.contenu()?.taches.length ?? 0;
    if (suivante >= nombre && evenement.key !== 'Enter') return;
    if (!avecSuggestions) evenement.preventDefault();
    if (suivante >= nombre) this.etat.modifier((t) => t.taches.push(this.nouvelle(t, false, this.derniereTache(t, t.taches.length - 1))));
    this.focaliser(suivante, colonne);
  }

  /** Met le curseur dans une cellule (ou, si cette ligne n'a pas la colonne, comme un séparateur, dans son libellé). */
  private focaliser(ligne: number, colonne: string): void {
    setTimeout(() => {
      const racine = this.hote.nativeElement;
      const champ =
        racine.querySelector<HTMLInputElement>(`[data-l="${ligne}"][data-c="${colonne}"]`) ??
        racine.querySelector<HTMLInputElement>(`[data-l="${ligne}"][data-c="libelle"]`);
      champ?.focus();
      champ?.select?.();
    });
  }

  private fermerMenu(evenement: Event): void {
    (evenement.target as HTMLElement).closest('details')?.removeAttribute('open');
  }
}
