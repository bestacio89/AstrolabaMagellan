import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjetsApi } from '../../../api/projets.api';
import { messageErreur } from '../../../core/http/erreurs.interceptor';
import { NavigationService } from '../../../core/layout/navigation';
import { NotificationsService } from '../../../core/notifications/notifications';
import { SuiviApi } from '../api/suivi.api';
import { ALERT_OPTS } from '../etat/constantes';
import { fDh, fDi } from '../etat/formats';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import { ecrireTypesParDefaut } from '../etat/types-par-defaut';
import { defaultAxeName, Vue } from '../etat/vue';
import { Carte } from '../ui/cartes';
import { ListeEditable } from '../ui/liste-editable';

type CleAlerte = 'alerteActionsJours' | 'alerteAtelierJours' | 'alerteLivrableJours' | 'alerteEchJours';

/**
 * Paramètres du projet : réglages propres au projet, enregistrés avec lui (ils valent pour toute l'équipe) :
 * noms des axes, dates du projet, délais d'alerte, types de tâches, optimisation IA ; journal des modifications.
 */
@Component({
  selector: 'app-parametres',
  imports: [Carte, ListeEditable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sechead">
      <div>
        <h2>Paramètres du projet</h2>
        <p>Réglages propres à ce projet, enregistrés avec le suivi : ils valent pour toute l’équipe.</p>
      </div>
    </div>
    @if (etat.vue(); as v) {
      @let lecture = !v.droits.peutModifier;
      @let S = v.projet.settings;
      <div class="grid2">
        <app-carte
          titre="Noms des axes (colonne A du TSP)"
          sousTitre="Le TSP ne contient que des codes (AXE1, 1, 2…). Donnez-leur un nom lisible : il est utilisé partout (tableaux, Gantt, exports) quand le reporting est regroupé par axe."
        >
          <div class="kv">
            @for (id of v.axeIds; track id) {
              <div>{{ id === '0' ? '0 (pilotage)' : id }}</div>
              <div>
                <input
                  class="in w-txt"
                  [value]="nomSaisi(v, id)"
                  [placeholder]="defaultAxeName(id)"
                  [attr.aria-label]="'Nom de l’axe ' + id"
                  [disabled]="lecture"
                  #ax
                  (change)="nomAxe(v, id, ax)"
                />
              </div>
            }
          </div>
        </app-carte>
        <app-carte
          titre="Dates du projet"
          sousTitre="Elles fixent les mois affichés partout (consommé, Gantt, plannings, graphiques, export). Pré-remplies depuis la période indiquée dans le TSP."
        >
          <div class="kv">
            <div>Début du projet</div>
            <div><input class="in w-date" type="date" [value]="v.projet.dates.debut ?? ''" [disabled]="lecture" #d1 (change)="date(v, 'debut', d1)" /></div>
            <div>Fin contractuelle</div>
            <div>
              <input class="in w-date" type="date" [value]="v.projet.dates.finContrat ?? ''" [disabled]="lecture" #d2 (change)="date(v, 'finContrat', d2)" /><span class="auto"
                >Date du contrat (TSP). Ne change qu’en cas d’avenant.</span
              >
            </div>
            <div>Fin prévue</div>
            <div>
              <input class="in w-date" type="date" [value]="v.projet.dates.finPrevue ?? ''" [disabled]="lecture" #d3 (change)="date(v, 'finPrevue', d3)" /><span class="auto"
                >Date de fin réaliste aujourd’hui. Un écart avec la fin contractuelle apparaît comme un glissement.</span
              >
            </div>
          </div>
        </app-carte>
      </div>

      <h3 class="kgrp">Alertes et types</h3>
      <div class="grid2">
        <app-carte
          titre="Alertes du tableau de bord"
          sousTitre="Quand une action, un atelier à préparer, un livrable à remettre ou une échéance de facturation apparaît dans « À traiter ». Les éléments en retard restent toujours affichés."
        >
          <div class="kv">
            @for (a of alertes; track a.cle) {
              <div>{{ a.libelle }}</div>
              <div>
                <select class="in" [disabled]="lecture" #al (change)="alerte(a.cle, al, valeurAlerte(v, a.cle))">
                  @for (o of options; track o[0]) {
                    <option [value]="o[0]" [selected]="o[0] === valeurAlerte(v, a.cle)">{{ o[1].replace('{x}', a.objet) }}</option>
                  }
                </select>
              </div>
            }
          </div>
        </app-carte>
        <app-carte
          titre="Types de tâches"
          sousTitre="Atelier et Livrable (🔒) alimentent les registres et le tableau de bord ; ajoutez vos propres types, ils sont suivis de la même façon."
        >
          <div class="typelist">
            @for (x of v.projet.types; track x.id) {
              <div class="typerow">
                <input
                  class="in w-txt"
                  aria-label="Nom du type"
                  [value]="x.nom"
                  [readOnly]="x.socle"
                  [title]="x.socle ? 'Type socle : non modifiable' : ''"
                  [disabled]="lecture"
                  #ty
                  (change)="renommerType(x.id, x.nom, ty)"
                />
                <span class="muted num">{{ nbTaches(v, x.id) }} tâche(s)</span>
                @if (x.socle) {
                  <span class="lock" title="Type socle : non supprimable">🔒</span>
                } @else if (!lecture) {
                  <button type="button" class="btn sm ghost" title="Supprimer ce type" (click)="supprimerType(v, x.id, x.nom)">Supprimer</button>
                }
              </div>
            }
          </div>
          @if (!lecture) {
            <div class="toolbar" style="margin-top: 10px">
              <input class="in" placeholder="Nouveau type (ex. Formation)" aria-label="Nouveau type" #nt (keydown.enter)="$event.preventDefault(); ajouterType(v, nt)" />
              <button type="button" class="btn sm" (click)="ajouterType(v, nt)">Ajouter</button>
            </div>
          }
          @if (v.droits.peutModifier) {
            <div class="toolbar" style="margin-top: 10px">
              <button type="button" class="btn sm" (click)="typesParDefaut(v)">Utiliser cette liste par défaut pour les prochains imports</button
              ><span class="auto">Mémorisé dans ce navigateur uniquement.</span>
            </div>
          }
        </app-carte>
        <app-carte titre="Optimisation IA">
          <div class="kv">
            <div>Profil IA (enveloppe)</div>
            <div>
              <select class="in" [disabled]="lecture" #ia (change)="profilIa(v, ia)">
                <option value="-1" [selected]="S.iaProfile < 0">Aucun</option>
                @for (p of v.P; track p.i) {
                  @if (p.nom) {
                    <option [value]="p.i" [selected]="p.i === S.iaProfile">{{ p.nom }}</option>
                  }
                }
              </select>
              <span class="auto">Profil dont la charge est l’enveloppe IA de chaque tâche (Workload › Optimisation IA).</span>
            </div>
            <div>Leviers (économie)</div>
            <div>
              <app-liste-editable
                libelle="Leviers d’optimisation"
                placeholder="Nouveau levier (ex. Tests automatisés)"
                [valeurs]="v.m.ia.leviers"
                [lecture]="lecture"
                (changer)="listeIa('leviers-ia', $event)"
              />
              <span class="auto">Proposés quand l’enveloppe n’est pas (ou pas entièrement) consommée.</span>
            </div>
            <div>Causes (dépassement)</div>
            <div>
              <app-liste-editable
                libelle="Causes de dépassement"
                placeholder="Nouvelle cause (ex. Périmètre élargi)"
                [valeurs]="v.m.ia.causes"
                [lecture]="lecture"
                (changer)="listeIa('causes-ia', $event)"
              />
              <span class="auto">Proposées quand la tâche dépasse son enveloppe.</span>
            </div>
          </div>
        </app-carte>
        <app-carte titre="Affichage et lexique" sousTitre="Réglages propres à ce navigateur : ils ne changent rien pour vos collègues.">
          <label class="s-bascule">
            <input type="checkbox" [checked]="ui.ui().compact" #cp (change)="ui.maj({ compact: cp.checked })" />
            <span><b>Affichage compact</b><span class="auto">Tableaux plus serrés, pour voir plus de lignes à l’écran.</span></span>
          </label>
          <p class="note" style="margin-top: 14px">Unités, charges, montants, dates et statuts : les définitions utilisées dans tout l’outil.</p>
          <button type="button" class="btn" style="margin-top: 10px" (click)="etat.fenetre.set({ type: 'reperes' })">Ouvrir le lexique</button>
        </app-carte>
      </div>

      @if (v.droits.estChefDeProjet) {
        <h3 class="kgrp">Le projet</h3>
        <div class="grid2">
          <app-carte
            [titre]="v.droits.archive ? 'Projet archivé' : 'Archiver le projet'"
            [sousTitre]="
              v.droits.archive
                ? 'Il n’apparaît plus dans les listes et tout est en lecture seule. Restaurez-le pour reprendre le suivi.'
                : 'Pour un projet terminé ou abandonné : il quitte les listes et passe en lecture seule. Rien n’est perdu, il se restaure à tout moment.'
            "
          >
            <button type="button" class="btn" [disabled]="action()" (click)="archiver(!v.droits.archive)">
              {{ v.droits.archive ? 'Restaurer le projet' : 'Archiver le projet' }}
            </button>
            @if (!v.droits.archive) {
              <p class="note" style="margin-top: 12px">Les projets archivés restent consultables depuis l’accueil (« Projets archivés »).</p>
            }
          </app-carte>
          <app-carte titre="Supprimer le projet" sousTitre="Seulement pour un projet créé par erreur (mauvais TSP, essai) : la suppression est définitive.">
            @if (aDejaUnSuivi(v)) {
              <p class="note">
                Ce projet a déjà un suivi (temps passé, achats, frais ou facture émise) : il ne peut pas être supprimé. <b>Archivez-le</b> : il quitte les listes
                et son historique est conservé.
              </p>
            } @else {
              <p class="note">Tout ce qui concerne ce projet sera effacé : tâches, profils, réglages, journal. Pour confirmer, tapez son nom : <b>{{ v.projet.fiche.projet }}</b></p>
              <div class="sup-ligne">
                <input
                  class="in"
                  type="text"
                  [placeholder]="v.projet.fiche.projet"
                  aria-label="Nom du projet, pour confirmer la suppression"
                  [value]="confirmation()"
                  (input)="confirmation.set($any($event.target).value)"
                />
                <button type="button" class="btn danger" [disabled]="!nomConfirme(v) || action()" (click)="supprimer(v)">Supprimer définitivement</button>
              </div>
            }
          </app-carte>
        </div>
      }

      <h3 class="kgrp">Travail à plusieurs</h3>
      <div class="grid2">
        <app-carte titre="Travail à plusieurs">
          <div class="kv">
            <div>Votre nom</div>
            <div>{{ v.droits.utilisateur }} <span class="auto">Rôle sur ce projet : {{ v.droits.roleLibelle }}.</span></div>
            <div>Enregistrement</div>
            <div>Chaque saisie est enregistrée aussitôt sur le serveur. Si un collègue a modifié la même donnée entre-temps, l’écran se recharge avec sa version.</div>
            <div>TSP d’origine</div>
            <div>{{ v.projet.source?.fichier || '—' }} · importé le {{ fDi(v.projet.source?.importeLe) }}</div>
          </div>
          <p class="note">Les données du projet restent sur le serveur de l’entreprise. Seuls le chef de projet et les personnes qu’il a invitées y ont accès, selon leur rôle.</p>
        </app-carte>
        <app-carte titre="Journal des enregistrements" sousTitre="Qui a modifié quoi, et quand (dernières modifications).">
          @if (v.projet.journal.length) {
            <div class="tw" style="max-height: 360px">
              <table class="t">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Par</th>
                    <th>Objet</th>
                    <th>Modification</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of v.projet.journal; track $index) {
                    <tr>
                      <td style="white-space: nowrap">{{ fDh(e.at) }}</td>
                      <td>{{ e.by }}</td>
                      <td>{{ e.objet }}</td>
                      <td class="lbl wrap-t">
                        {{ e.champ }}{{ e.ancienne || e.nouvelle ? ' : ' : '' }}
                        @if (e.ancienne) {
                          <span class="muted">{{ e.ancienne }}</span> →
                        }
                        {{ e.nouvelle ?? '' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="note">Aucun enregistrement pour l’instant.</p>
          }
        </app-carte>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .sup-ligne {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .sup-ligne .in {
      flex: 1;
      min-width: 200px;
    }
  `,
})
export class Parametres {
  protected readonly etat = inject(SuiviEtat);
  protected readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly projetsApi = inject(ProjetsApi);
  private readonly router = inject(Router);
  private readonly nav = inject(NavigationService);
  private readonly notifs = inject(NotificationsService);
  /** Nom du projet retapé pour confirmer la suppression. */
  protected readonly confirmation = signal('');
  protected readonly action = signal(false);
  protected readonly fDi = fDi;
  protected readonly fDh = fDh;
  protected readonly defaultAxeName = defaultAxeName;
  protected readonly options = ALERT_OPTS;
  protected readonly alertes: { cle: CleAlerte; libelle: string; objet: string }[] = [
    { cle: 'alerteActionsJours', libelle: 'Actions', objet: 'sa date cible' },
    { cle: 'alerteAtelierJours', libelle: 'Ateliers (invitation à envoyer)', objet: 'l’atelier' },
    { cle: 'alerteLivrableJours', libelle: 'Livrables (à remettre)', objet: 'la livraison prévue' },
    { cle: 'alerteEchJours', libelle: 'Échéances de facturation', objet: 'sa date prévue' },
  ];
  private readonly nbParType = computed(() => {
    const n = new Map<string, number>();
    for (const t of this.etat.vue()?.tasks ?? []) if (t.type) n.set(t.type, (n.get(t.type) ?? 0) + 1);
    return n;
  });

  /** Une valeur par ligne (zone de texte). */
  protected nbTaches(_v: Vue, type: string): number {
    return this.nbParType().get(type) ?? 0;
  }

  protected valeurAlerte(v: Vue, cle: CleAlerte): number {
    switch (cle) {
      case 'alerteActionsJours':
        return v.alerteActions;
      case 'alerteAtelierJours':
        return v.alerteAteliers;
      case 'alerteLivrableJours':
        return v.alerteLivrables;
      case 'alerteEchJours':
        return v.alerteEcheances;
    }
  }

  /** Nom choisi pour un code d'axe (vide : nom par défaut). */
  protected nomSaisi(v: Vue, code: string): string {
    return v.projet.axes[code] || '';
  }

  protected nomAxe(v: Vue, code: string, el: HTMLInputElement): void {
    const ancien = this.nomSaisi(v, code);
    if (el.value.trim() === ancien) return;
    void this.etat.saisir((id) => this.api.nomAxe(id, code, el.value.trim()), { siErreur: () => (el.value = ancien) });
  }

  protected date(v: Vue, champ: 'debut' | 'finContrat' | 'finPrevue', el: HTMLInputElement): void {
    const ancien = v.projet.dates[champ] ?? '';
    void this.etat.saisir((id) => this.api.dateProjet(id, champ, el.value || null, this.etat.versionProjet()), { siErreur: () => (el.value = ancien) });
  }

  protected alerte(cle: CleAlerte, el: HTMLSelectElement, ancien: number): void {
    void this.etat.saisir((id) => this.api.alerte(id, cle, +el.value), { siErreur: () => (el.value = String(ancien)) });
  }

  protected profilIa(v: Vue, el: HTMLSelectElement): void {
    const ancien = String(v.projet.settings.iaProfile);
    const i = +el.value;
    const profilId = i >= 0 ? (v.P[i]?.id ?? null) : null;
    void this.etat.saisir((id) => this.api.profilIa(id, profilId), { siErreur: () => (el.value = ancien) });
  }

  /** Une valeur par ligne (doublons retirés) ; liste vide : liste par défaut rétablie. */
  /** Enregistre la liste complète (liste vide : le serveur rétablit la liste par défaut). */
  protected listeIa(liste: 'leviers-ia' | 'causes-ia', valeurs: string[]): void {
    void this.etat.saisir((id) => this.api.listeIa(id, liste, valeurs));
  }

  protected ajouterType(v: Vue, el: HTMLInputElement): void {
    const nom = el.value.trim();
    if (!nom) {
      this.etat.afficher('Saisissez le nom du type à ajouter.', 'attention');
      el.focus();
      return;
    }
    if (v.projet.types.some((x) => x.nom.toLowerCase() === nom.toLowerCase())) {
      this.etat.afficher('Ce type existe déjà.', 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.ajouterType(id, nom), { siSucces: () => (el.value = '') });
  }

  protected renommerType(code: string, ancien: string, el: HTMLInputElement): void {
    const nom = el.value.trim();
    if (nom === ancien) return;
    if (!nom) {
      el.value = ancien;
      this.etat.afficher('Le nom du type ne peut pas être vide.', 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.renommerType(id, code, nom), { siErreur: () => (el.value = ancien) });
  }

  protected async supprimerType(v: Vue, code: string, nom: string): Promise<void> {
    const n = this.nbTaches(v, code);
    const ok = await this.etat.confirmer(
      `Supprimer le type « ${nom} » ?`,
      [n ? `${n} tâche(s) utilisent ce type : elles passeront à « — ».` : 'Aucune tâche n’utilise ce type.'],
      'Supprimer',
    );
    if (ok) void this.etat.saisir((id) => this.api.supprimerType(id, code));
  }

  protected typesParDefaut(v: Vue): void {
    const ok = ecrireTypesParDefaut(v.projet.types.filter((x) => !x.socle).map((x) => x.nom));
    this.etat.afficher(
      ok ? 'Liste enregistrée : elle sera proposée à chaque nouvel import de TSP sur ce poste.' : 'Ce navigateur ne permet pas de mémoriser la liste.',
      ok ? 'succes' : 'erreur',
    );
  }

  /** Temps passé, dépenses ou facture : le projet a un suivi, il s'archive (le serveur applique la même règle). */
  protected aDejaUnSuivi(v: Vue): boolean {
    return (
      v.m.total.conso > 0 ||
      (v.projet.achatsReel?.length ?? 0) > 0 ||
      (v.projet.fraisReel?.length ?? 0) > 0 ||
      Object.values(v.projet.echTrack).some((e) => !!e.realiseLe)
    );
  }

  protected nomConfirme(v: Vue): boolean {
    const simple = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    return simple(this.confirmation()) === simple(v.projet.fiche.projet) && simple(this.confirmation()).length > 0;
  }

  /** Archive ou restaure, puis recharge (le projet passe en lecture seule, ou redevient modifiable). */
  protected async archiver(archive: boolean): Promise<void> {
    if (
      archive &&
      !(await this.etat.confirmer(
        'Archiver le projet',
        ['Le projet quitte les listes et passe en lecture seule pour toute l’équipe.', 'Rien n’est perdu : il se restaure à tout moment depuis ses paramètres.'],
        'Archiver',
      ))
    )
      return;
    this.action.set(true);
    try {
      await firstValueFrom(this.projetsApi.archiver(this.etat.projetId(), archive));
      this.nav.projets.set(null);
      await this.etat.recharger();
      this.etat.afficher(archive ? 'Projet archivé.' : 'Projet restauré : le suivi reprend.', 'succes');
    } catch (e) {
      this.etat.afficher(messageErreur(e), 'erreur');
    } finally {
      this.action.set(false);
    }
  }

  /** Suppression définitive (nom confirmé) ; retour à l'accueil. */
  protected async supprimer(v: Vue): Promise<void> {
    this.action.set(true);
    try {
      await firstValueFrom(this.projetsApi.supprimer(this.etat.projetId(), this.confirmation()));
      this.nav.projets.set(null);
      this.notifs.succes(`Projet « ${v.projet.fiche.projet} » supprimé.`);
      await this.router.navigate(['/projets']);
    } catch (e) {
      this.etat.afficher(messageErreur(e), 'erreur');
    } finally {
      this.action.set(false);
    }
  }
}
