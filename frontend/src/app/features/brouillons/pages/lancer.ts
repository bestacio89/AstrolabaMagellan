import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjetsApi } from '../../../api/projets.api';
import { messageErreur } from '../../../core/http/erreurs.interceptor';
import { NavigationService } from '../../../core/layout/navigation';
import { NotificationsService } from '../../../core/notifications/notifications';
import { Fenetre } from '../../../shared/ui/fenetre';
import { Icone } from '../../../shared/ui/icone';
import { SuiviApi } from '../../suivi/api/suivi.api';
import { messageErreurFichier, telecharger } from '../../suivi/etat/fichiers';
import { appliquerTypesParDefaut } from '../../suivi/etat/types-par-defaut';
import { BrouillonsApi } from '../api/brouillons.api';
import { Controle } from '../api/brouillons.modeles';
import { BrouillonEtat } from '../etat/brouillon.etat';
import { RUBRIQUES } from './rubriques';

/**
 * « Prêt à lancer ? » : les contrôles du TSP (à corriger, conseils, au vert), le lancement du projet, l'export Excel,
 * et qui voit le brouillon (co-rédacteur). Le lancement est refusé tant qu'un point est à corriger.
 */
@Component({
  selector: 'app-lancer-brouillon',
  imports: [RouterLink, Icone, Fenetre],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.brouillon(); as b) {
      <div class="sechead">
        <div>
          <h2 class="ln-titre">Prêt à lancer ?</h2>
          <p>Les mêmes contrôles qu’à l’import d’un TSP Excel. Ils se mettent à jour pendant que vous corrigez.</p>
        </div>
      </div>
      <div class="s-grille">
        <div class="c-7 ln-col">
          <section class="card" aria-labelledby="ln-verif">
            <header>
              <div>
                <h2 id="ln-verif">Vérification du TSP</h2>
                <p>{{ resume() }}</p>
              </div>
            </header>
            @if (bloquants().length) {
              <div class="ln-groupe" data-niveau="bloquant">
                <h3>À corriger avant de lancer <span class="ln-n">{{ bloquants().length }}</span></h3>
                <ul>
                  @for (c of bloquants(); track $index) {
                    <li>
                      <span class="ln-i" aria-hidden="true">!</span>
                      <span class="ln-t"><b>{{ c.titre }}</b>@if (c.detail) { <span>{{ c.detail }}</span> }</span>
                      <a class="btn ln-lien" [routerLink]="['/brouillons', b.id, c.rubrique]">Corriger<span class="visuellement-cache"> ({{ libelleRubrique(c) }})</span></a>
                    </li>
                  }
                </ul>
              </div>
            }
            @if (conseils().length) {
              <div class="ln-groupe" data-niveau="conseil">
                <h3>Conseils, sans blocage <span class="ln-n">{{ conseils().length }}</span></h3>
                <ul>
                  @for (c of conseils(); track $index) {
                    <li>
                      <span class="ln-i" aria-hidden="true">i</span>
                      <span class="ln-t"><b>{{ c.titre }}</b>@if (c.detail) { <span>{{ c.detail }}</span> }</span>
                      <a class="btn ln-lien" [routerLink]="['/brouillons', b.id, c.rubrique]">Voir<span class="visuellement-cache"> ({{ libelleRubrique(c) }})</span></a>
                    </li>
                  }
                </ul>
              </div>
            }
            @if (oks().length) {
              <details class="ln-groupe" data-niveau="ok" [open]="!bloquants().length && !conseils().length">
                <summary><h3>Au vert <span class="ln-n">{{ oks().length }}</span></h3></summary>
                <ul>
                  @for (c of oks(); track $index) {
                    <li>
                      <span class="ln-i" aria-hidden="true">✓</span>
                      <span class="ln-t"><b>{{ c.titre }}</b>@if (c.detail) { <span>{{ c.detail }}</span> }</span>
                    </li>
                  }
                </ul>
              </details>
            }
          </section>

          <section class="card ln-lancement" aria-labelledby="ln-lancer">
            <div class="ln-lancement-t">
              <h2 id="ln-lancer">Lancer le projet</h2>
              <p>{{ raisonBlocage() ?? 'Tout est prêt. Le projet sera créé et vous en serez le chef de projet.' }}</p>
              @if (erreur()) {
                <p class="ln-erreur" role="alert">{{ erreur() }}</p>
              }
            </div>
            <button type="button" class="btn primary ln-grand" [disabled]="!!raisonBlocage() || lancement()" (click)="confirmation.set(true)">
              <app-icone nom="fusee" />{{ lancement() ? 'Lancement…' : 'Lancer le projet' }}
            </button>
          </section>
        </div>

        <div class="c-5 ln-col">
          <section class="card" aria-labelledby="ln-quoi">
            <header><div><h2 id="ln-quoi">Ce qui se passe au lancement</h2></div></header>
            <ol class="ln-etapes">
              <li><b>Le TSP devient la référence vendue.</b> Charge et prix sont figés : ensuite, tout changement passe par les évolutions du périmètre, tracées.</li>
              <li><b>Le projet devient visible</b> dans le portefeuille et pour l’équipe. La fiche reste modifiable dans ⚙ Paramètres du projet.</li>
              <li><b>Le suivi commence</b> : consommé, Gantt, plan de charge, facturation, comme pour un TSP importé. Le brouillon disparaît.</li>
            </ol>
          </section>

          <section class="card" aria-labelledby="ln-excel">
            <header>
              <div>
                <h2 id="ln-excel">TSP au format Excel</h2>
                <p>Mêmes onglets que le modèle (fiche, profil, workload, planning, échéancier, achats, frais), avec les totaux en formules. Réimportable tel quel.</p>
              </div>
            </header>
            <button type="button" class="btn ln-btn" [disabled]="export()" (click)="exporter()">
              <app-icone nom="exporter" [taille]="16" />{{ export() ? 'Préparation…' : 'Télécharger le TSP (.xlsx)' }}
            </button>
          </section>

          <section class="card" aria-labelledby="ln-qui">
            <header>
              <div>
                <h2 id="ln-qui">Qui voit ce brouillon</h2>
                <p>Personne d’autre, pas même le pilotage. Le co-rédacteur voit les prix ; après le lancement, il suit le projet en lecture.</p>
              </div>
            </header>
            <ul class="ln-personnes">
              <li>
                <span class="ln-av" aria-hidden="true">{{ initiales(b.createur.nomComplet) }}</span>
                <span><b>{{ b.createur.nomComplet }}</b><small>auteur · chef de projet au lancement</small></span>
              </li>
              @if (b.coRedacteur; as co) {
                <li>
                  <span class="ln-av ln-av-co" aria-hidden="true">{{ initiales(co.nomComplet) }}</span>
                  <span><b>{{ co.nomComplet }}</b><small>co-rédacteur · {{ co.email }}</small></span>
                  @if (b.estCreateur) {
                    <button type="button" class="btn ln-petit" (click)="inviter('')">Retirer</button>
                  }
                </li>
              }
            </ul>
            @if (b.estCreateur) {
              <form class="ln-invite" (submit)="$event.preventDefault(); inviter(email.value)">
                <label class="champ">
                  <span>{{ b.coRedacteur ? 'Remplacer le co-rédacteur' : 'Inviter un co-rédacteur' }} <small>Son adresse e-mail ; il doit s’être déjà connecté à l’application.</small></span>
                  <span class="ln-invite-l">
                    <input #email type="email" autocomplete="off" placeholder="prenom.nom@…" />
                    <button type="submit" class="btn" [disabled]="invitation()">Inviter</button>
                  </span>
                </label>
                @if (erreurInvitation()) {
                  <p class="ln-erreur" role="alert">{{ erreurInvitation() }}</p>
                }
              </form>
            } @else {
              <p class="muted ln-note">Seul {{ b.createur.nomComplet }} peut lancer le projet ou inviter quelqu’un.</p>
            }
          </section>

          @if (b.estCreateur) {
            <section class="card ln-danger" aria-labelledby="ln-sup">
              <header>
                <div>
                  <h2 id="ln-sup">Abandonner ce brouillon</h2>
                  <p>Rien n’a encore été créé : le brouillon est supprimé, sans trace. Pensez à exporter le TSP si vous voulez le garder.</p>
                </div>
              </header>
              <button type="button" class="btn ln-btn ln-sup" (click)="suppression.set(true)"><app-icone nom="poubelle" [taille]="16" />Supprimer le brouillon</button>
            </section>
          }
        </div>
      </div>

      <app-fenetre titre="Lancer le projet ?" [ouverte]="confirmation()" (fermee)="confirmation.set(false)">
        <p><b>{{ etat.titre() }}</b> va être créé, et vous en serez le chef de projet.</p>
        <p>Le TSP devient la référence vendue : ensuite, la charge et les prix ne changent plus que par les évolutions du périmètre.</p>
        <div pied>
          <button type="button" class="btn" (click)="confirmation.set(false)">Annuler</button>
          <button type="button" class="btn primary" (click)="lancer()">Lancer le projet</button>
        </div>
      </app-fenetre>
      <app-fenetre titre="Supprimer ce brouillon ?" [ouverte]="suppression()" (fermee)="suppression.set(false)">
        <p>Le TSP en cours de rédaction de <b>{{ etat.titre() }}</b> sera définitivement supprimé.</p>
        <div pied>
          <button type="button" class="btn" (click)="suppression.set(false)">Annuler</button>
          <button type="button" class="btn primary" (click)="supprimer()">Supprimer</button>
        </div>
      </app-fenetre>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .ln-titre {
      font: var(--texte-titre-ecran);
    }
    .ln-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .ln-groupe {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 14px;
      margin-top: 10px;
    }
    .ln-groupe[data-niveau='bloquant'] {
      border-color: color-mix(in srgb, var(--crit) 40%, var(--line));
    }
    .ln-groupe[data-niveau='conseil'] {
      border-color: color-mix(in srgb, var(--warn) 40%, var(--line));
    }
    .ln-groupe h3 {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
      font: 600 12px/16px var(--police-texte);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-2);
    }
    .ln-groupe[data-niveau='bloquant'] h3 {
      color: var(--crit);
    }
    .ln-groupe[data-niveau='conseil'] h3 {
      color: var(--warn);
    }
    .ln-groupe summary {
      cursor: pointer;
      list-style: none;
    }
    .ln-n {
      display: inline-flex;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: var(--surface-3);
      color: var(--ink);
      font-size: 12px;
      letter-spacing: 0;
    }
    .ln-groupe ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .ln-groupe li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
    }
    .ln-i {
      width: 18px;
      height: 18px;
      margin-top: 1px;
      border-radius: 50%;
      flex: none;
      display: grid;
      place-items: center;
      color: #fff;
      font: 700 11px/1 var(--police-texte);
      background: var(--c-statut-valide);
    }
    [data-niveau='bloquant'] .ln-i {
      background: var(--c-statut-bloque);
    }
    [data-niveau='conseil'] .ln-i {
      background: var(--c-statut-encours);
    }
    .ln-t {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13.5px;
    }
    .ln-t b {
      font-weight: 500;
    }
    .ln-t span {
      color: var(--ink-2);
      font-size: 12.5px;
    }
    .ln-lien,
    .ln-petit {
      height: 30px;
      padding: 0 10px;
      font-size: 13px;
      flex: none;
    }
    .ln-lancement {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .ln-lancement-t {
      flex: 1 1 280px;
      min-width: 0;
    }
    .ln-lancement h2 {
      font: 500 16px/24px var(--police-titre);
    }
    .ln-lancement p {
      margin: 4px 0 0;
      color: var(--ink-2);
      font-size: 13.5px;
    }
    .ln-lancement .btn.ln-grand {
      height: 44px;
      padding: 0 20px;
      gap: 8px;
      justify-content: center;
    }
    .ln-erreur {
      color: var(--crit) !important;
      font-size: 13px;
      margin: 8px 0 0;
    }
    .ln-etapes {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 13.5px;
      color: var(--ink-2);
    }
    .ln-etapes b {
      color: var(--ink);
      font-weight: 500;
    }
    .ln-btn {
      height: 36px;
      padding: 0 14px;
      gap: 6px;
    }
    .ln-personnes {
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ln-personnes li {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ln-personnes li > span:nth-child(2) {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      font-size: 13.5px;
    }
    .ln-personnes small {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .ln-av {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--c-primaire);
      color: #fff;
      display: grid;
      place-items: center;
      font: 600 12px/1 var(--police-texte);
      flex: none;
    }
    .ln-av-co {
      background: var(--c-violet);
    }
    .ln-invite-l {
      display: flex;
      gap: 8px;
    }
    .ln-invite-l .btn {
      height: 40px;
    }
    .ln-note {
      margin: 0;
      font-size: 12.5px;
    }
    .ln-sup {
      color: var(--crit);
    }
  `,
})
export class LancerBrouillon {
  protected readonly etat = inject(BrouillonEtat);
  private readonly api = inject(BrouillonsApi);
  private readonly projetsApi = inject(ProjetsApi);
  private readonly suiviApi = inject(SuiviApi);
  private readonly router = inject(Router);
  private readonly nav = inject(NavigationService);
  private readonly notifications = inject(NotificationsService);

  protected readonly confirmation = signal(false);
  protected readonly suppression = signal(false);
  protected readonly lancement = signal(false);
  protected readonly export = signal(false);
  protected readonly invitation = signal(false);
  protected readonly erreur = signal('');
  protected readonly erreurInvitation = signal('');

  private readonly controles = computed(() => this.etat.analyse()?.controles ?? []);
  protected readonly bloquants = computed(() => this.controles().filter((c) => c.niveau === 'bloquant'));
  protected readonly conseils = computed(() => this.controles().filter((c) => c.niveau === 'conseil'));
  protected readonly oks = computed(() => this.controles().filter((c) => c.niveau === 'ok'));

  protected readonly resume = computed(() => {
    const b = this.bloquants().length;
    const c = this.conseils().length;
    if (b) return `${b} point${b > 1 ? 's' : ''} à corriger avant de lancer${c ? `, ${c} conseil${c > 1 ? 's' : ''}` : ''}.`;
    if (c) return `Rien ne bloque le lancement. ${c} conseil${c > 1 ? 's' : ''} à regarder.`;
    return 'Tout est au vert.';
  });

  /** Pourquoi le bouton « Lancer » est indisponible (null : il est disponible). */
  protected readonly raisonBlocage = computed(() => {
    const b = this.etat.brouillon();
    if (!b) return '…';
    if (!b.estCreateur) return `Seul ${b.createur.nomComplet}, auteur du brouillon, peut lancer le projet.`;
    const n = this.bloquants().length;
    if (n) return `Disponible dès que ${n > 1 ? `les ${n} points rouges sont corrigés` : 'le point rouge est corrigé'}.`;
    if (this.etat.statut() === 'conflit') return 'Le brouillon a été modifié ailleurs : rechargez-le avant de lancer.';
    return null;
  });

  protected libelleRubrique(c: Controle): string {
    return RUBRIQUES.find((r) => r.cle === c.rubrique)?.libelle ?? '';
  }

  protected initiales(nom: string): string {
    return nom
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m[0]!.toUpperCase())
      .join('');
  }

  protected async lancer(): Promise<void> {
    const b = this.etat.brouillon();
    if (!b) return;
    this.confirmation.set(false);
    this.lancement.set(true);
    this.erreur.set('');
    try {
      if (!(await this.etat.enregistrerMaintenant())) {
        this.erreur.set('Le brouillon n’a pas pu être enregistré : le projet n’est pas lancé. ' + this.etat.erreur());
        return;
      }
      if (this.bloquants().length) return;
      const cree = await firstValueFrom(this.api.lancer(b.id, this.etat.versionCourante()));
      await appliquerTypesParDefaut(this.suiviApi, cree.id);
      try {
        this.nav.projets.set(await firstValueFrom(this.projetsApi.lister()));
      } catch {
        /* la barre latérale rechargera sa liste */
      }
      this.notifications.succes(`Projet lancé : ${this.etat.titre()}.`);
      await this.router.navigate(['/projets', cree.id]);
    } catch (e) {
      this.erreur.set(messageErreur(e));
      if (e instanceof HttpErrorResponse && e.status === 409) await this.etat.charger(b.id);
    } finally {
      this.lancement.set(false);
    }
  }

  protected async exporter(): Promise<void> {
    const b = this.etat.brouillon();
    if (!b) return;
    this.export.set(true);
    try {
      await this.etat.enregistrerMaintenant();
      telecharger(await firstValueFrom(this.api.exporter(b.id)), 'TSP.xlsx');
    } catch (e) {
      this.notifications.erreur(await messageErreurFichier(e));
    } finally {
      this.export.set(false);
    }
  }

  protected async inviter(email: string): Promise<void> {
    const b = this.etat.brouillon();
    if (!b) return;
    if (email.trim() === '' && !b.coRedacteur) {
      this.erreurInvitation.set('Saisissez l’adresse e-mail de la personne à inviter.');
      return;
    }
    this.invitation.set(true);
    this.erreurInvitation.set('');
    try {
      const r = await firstValueFrom(this.api.coRedacteur(b.id, email.trim()));
      this.etat.brouillon.set({ ...b, coRedacteur: r.coRedacteur });
      this.etat.adopterVersion(r.version);
      this.notifications.succes(r.coRedacteur ? `${r.coRedacteur.nomComplet} peut maintenant compléter ce brouillon.` : 'Co-rédacteur retiré.');
    } catch (e) {
      this.erreurInvitation.set(messageErreur(e));
    } finally {
      this.invitation.set(false);
    }
  }

  protected async supprimer(): Promise<void> {
    const b = this.etat.brouillon();
    if (!b) return;
    this.suppression.set(false);
    try {
      await firstValueFrom(this.api.supprimer(b.id));
      this.notifications.succes('Brouillon supprimé.');
      await this.router.navigate(['/projets']);
    } catch (e) {
      this.notifications.erreur(messageErreur(e));
    }
  }
}
