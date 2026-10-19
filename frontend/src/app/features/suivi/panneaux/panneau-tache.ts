import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Action } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { AVANCEMENTS, IA_CONFORME, IA_ST, STATUTS } from '../etat/constantes';
import { initialesDe, lienOuvrable, morceaux, nomDocument } from '../etat/fil.logique';
import { fD, fDh, fDi, fE, fJ, fJz, fP, fSigned, sgn, stSlug } from '../etat/formats';
import { joursEntre, lireNombre, round } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { UiEtat } from '../etat/ui.etat';
import {
  AT_STEPS,
  LV_STEPS,
  TacheVue,
  Vue,
  atRealise,
  atStep,
  axeName,
  destPool,
  echEtat,
  idName,
  isAtelier,
  isOver,
  lvLivre,
  lvPrevue,
  lvValide,
  reaffectable as reaffectableDe,
  taskProfiles,
} from '../etat/vue';
import { Fx } from '../ui/fx';
import { MiniBarre, Etapes } from '../ui/petits';

type Champ = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Panneau de détail d'une tâche (à droite, façon JIRA), repris de la version de référence :
 * statut et avancement, dates (atelier, livrable ou planning), charges par profil, classement,
 * optimisation IA, facturation, commentaire, actions liées, annulation.
 * Navigation : tâche précédente / suivante dans l'ordre affiché (Alt + ↑ / ↓).
 */
@Component({
  selector: 'app-panneau-tache',
  imports: [Fx, MiniBarre, Etapes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'clavier($event)' },
  template: `
    @if (vue(); as v) {
      @if (t(); as t) {
        <aside class="drawer" aria-label="Détail de la tâche" [style.--axc]="couleur()">
          <div class="dr-head">
            <div class="dr-nav">
              @if (etat.retourMarge(); as rt) {
                <button type="button" class="btn sm ghost" title="Revenir au détail de la rentabilité" (click)="revenirMarge(rt)">‹ Rentabilité</button>
              }
              <button type="button" class="btn sm" [disabled]="position().pos <= 0" title="Tâche précédente (Alt + ↑)" (click)="naviguer(-1)">▲ Précédente</button>
              <button
                type="button"
                class="btn sm"
                [disabled]="position().pos < 0 || position().pos >= position().total - 1"
                title="Tâche suivante (Alt + ↓)"
                (click)="naviguer(1)"
              >
                Suivante ▼
              </button>
              <span class="muted">{{ position().pos >= 0 ? position().pos + 1 + ' / ' + position().total : '' }}</span>
              <span class="spacer"></span>
              <button type="button" class="btn sm ghost" title="Fermer (Échap)" (click)="etat.fermerPanneau()">✕ Fermer</button>
            </div>
            <div class="dr-crumbs">
              @if (v.m.dim.key === 'phase' && t.phase) {
                <button type="button" class="dr-axe crumb-ph" [attr.data-openph]="t.phase" [title]="'Ouvrir la phase ' + t.phase">{{ nomGroupe(v, t.grp) }}</button>
              } @else {
                <span class="dr-axe">{{ nomGroupe(v, t.grp) }}</span>
              }
              @if (v.m.dim.key !== 'id' && t.axe) {
                <span>Axe {{ nomAxe(v, t.axe) }}</span>
              }
              @if (v.m.dim.key !== 'lot' && t.lot) {
                <span>Lot {{ t.lot }}</span>
              }
              @if (t.phase && v.m.dim.key !== 'phase') {
                <button type="button" class="crumb-ph" [attr.data-openph]="t.phase" [title]="'Ouvrir la phase ' + t.phase">{{ t.phase }}</button>
              }
              @if (t.etape) {
                <span>{{ t.etape }}</span>
              }
            </div>
            <h2 class="dr-title">
              <textarea
                #titre
                class="dr-title-in"
                rows="1"
                aria-label="Intitulé de la tâche"
                [title]="lecture() ? '' : 'Cliquer pour modifier l’intitulé (Entrée : valider · Échap : annuler)'"
                [value]="t.label"
                [readOnly]="lecture()"
                (keydown.enter)="$event.preventDefault(); titre.blur()"
                (keydown.escape)="$event.preventDefault(); $event.stopPropagation(); titre.value = t.label; titre.blur()"
                (change)="libelle(t, titre)"
              ></textarea>
            </h2>
            @if (!t.estAjout && t.label !== t.labelTSP) {
              <div class="dr-tsp">
                Intitulé TSP : {{ t.labelTSP }}
                @if (!lecture()) {
                  <button type="button" class="linkbtn" (click)="revenirIntituleTsp(t)">Revenir à l’intitulé du TSP</button>
                }
              </div>
            }
            <div class="dr-meta">
              @if (t.estAjout) {
                <span class="tag-new">Nouvelle</span> Tâche ajoutée le {{ fDi(t.ajout?.at) }}{{ t.ajout?.by ? ' par ' + t.ajout?.by : '' }}{{
                  t.ajout?.motif ? ' — « ' + t.ajout?.motif + ' »' : ''
                }}
              } @else {
                Ligne {{ t.ligne }} du TSP
              }
              · Profil principal : {{ t.responsable }}
            </div>
          </div>

          <div class="dr-body">
            @if (t.annulee) {
              <div class="annul-banner">
                <div>
                  <b>Tâche annulée</b> le {{ fDi(t.annul?.at) }}{{ t.annul?.by ? ' par ' + t.annul?.by : '' }}
                  @if (t.annul?.avenant) {
                    · <b>avenant de réduction</b>
                    @if (v.droits.voitMontants) {
                      (CA −{{ fE(t.caAvenant) }})
                    }
                  } @else {
                    · CA inchangé
                  }
                  <div class="muted">
                    « {{ t.annul?.motif ?? '' }} »
                    @if (decisionAnnulation(); as d) {
                      · décision {{ d }}
                    }
                  </div>
                  <div class="muted">
                    {{ fJ(t.chargeAnnulee) }} JH annulés · {{ fJ(t.consoTotal) }} JH déjà consommés conservés
                    @if (v.droits.voitMontants) {
                      · coût évité {{ fE(t.coutAnnule) }}
                    }
                  </div>
                </div>
                @if (!lecture()) {
                  <button type="button" class="btn sm" (click)="retablir(t)">Rétablir la tâche</button>
                }
              </div>
            } @else {
              <section>
                <h3>Statut et avancement</h3>
                <div class="dr-choices">
                  @for (s of statuts; track s) {
                    <button
                      type="button"
                      class="pill"
                      [class]="'pill st-' + stSlug(s)"
                      [class.on]="t.statut === s"
                      [attr.aria-pressed]="t.statut === s"
                      [disabled]="lecture()"
                      (click)="statut(t, s)"
                    >
                      {{ s }}
                    </button>
                  }
                </div>
                <div class="dr-steps" style="margin-top: 10px">
                  @for (a of avancements; track a) {
                    <button
                      type="button"
                      [class.on]="egal(t.avancement, a)"
                      [attr.aria-pressed]="egal(t.avancement, a)"
                      [disabled]="lecture()"
                      (click)="avancement(t, a)"
                    >
                      {{ fP(a) }}
                    </button>
                  }
                </div>
              </section>
            }

            <!-- dates : atelier, livrable ou planning -->
            @if (atelier(t)) {
              <section class="plan-sec">
                <h3>Atelier</h3>
                <app-etapes [libelles]="atSteps" [faits]="atStep(t)" titre="Préparation de l’atelier" />
                <table class="pr-tbl">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Planifié <small>avec le client</small></th>
                      <th>Réalisé</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>Date</th>
                      <td>
                        <input #dat class="in w-date" type="date" aria-label="Date planifiée" [value]="t.tr.atelier?.date ?? ''" [disabled]="lecture()" (change)="dateAtelier(t, dat)" />
                      </td>
                      <td>
                        @if (atRealise(t); as r) {
                          <b class="pos">✓ {{ fD(r) }}</b>
                          @if (!t.consoDates.length) {
                            <span class="auto">date de validation (aucun consommé)</span>
                          }
                        } @else {
                          <span class="muted">à la validation</span>
                        }
                      </td>
                    </tr>
                    <tr>
                      <th>Horaire</th>
                      <td colspan="2">
                        <div class="hh">
                          <input #hd class="in" type="time" aria-label="Heure de début" [value]="t.tr.atelier?.heureDebut ?? ''" [disabled]="lecture()" (change)="horaire(t, hd, hf)" />
                          <span>→</span>
                          <input #hf class="in" type="time" aria-label="Heure de fin" [value]="t.tr.atelier?.heureFin ?? ''" [disabled]="lecture()" (change)="horaire(t, hd, hf)" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p class="auto">
                  Planifié : date convenue avec le client et les équipes, reportée dans le Gantt. Réalisé : date du consommé saisi, renseignée quand la tâche est validée.
                  {{ plageConso(t) }}
                </p>
                <h4 class="sub-h">Invitation</h4>
                <div class="inv-line">
                  @if (t.tr.atelier?.invit) {
                    <span class="inv-st ok" [title]="'Envoyée le ' + fD(t.tr.atelier?.invitLe)">✓ Envoyée</span>
                    <label class="inv-d"
                      >le
                      <input #il class="in w-date" type="date" aria-label="Date d’envoi de l’invitation" [value]="t.tr.atelier?.invitLe ?? ''" [disabled]="lecture()" (change)="dateInvitation(t, il)"
                    /></label>
                    @if (!lecture()) {
                      <button type="button" class="btn sm ghost" (click)="invitation(t, false)">Annuler l’envoi</button>
                    }
                  } @else if (t.statut === 'Validé') {
                    <span class="inv-st none">—</span><span class="muted">Atelier réalisé : aucune invitation enregistrée.</span>
                    @if (!lecture()) {
                      <button type="button" class="btn sm ghost" (click)="invitation(t, true)">Marquer envoyée</button>
                    }
                  } @else if (t.tr.atelier?.date) {
                    <span class="inv-st todo">À envoyer</span>
                    @if (!lecture()) {
                      <button type="button" class="btn sm" (click)="invitation(t, true)">Marquer envoyée</button>
                    }
                  } @else {
                    <span class="inv-st none">—</span><span class="muted">À envoyer une fois la date fixée.</span>
                  }
                </div>
                <div class="field">
                  Destinataires <span class="muted">({{ dest(t).length }})</span>
                  <div class="chips-in">
                    @for (d of dest(t); track d; let i = $index) {
                      <span class="chip"
                        >{{ d }}
                        @if (!lecture()) {
                          <button type="button" class="s-chip-del" [attr.aria-label]="'Retirer ' + d" (mousedown)="$event.preventDefault()" (click)="retirerDestinataire(t, i)">×</button>
                        }
                      </span>
                    }
                    @if (!lecture()) {
                      <input
                        #nd
                        class="chip-input"
                        list="dl-dest"
                        aria-label="Ajouter un destinataire"
                        [placeholder]="dest(t).length ? 'Ajouter…' : 'Nom ou e-mail, puis Entrée'"
                        (keydown)="toucheDestinataire($event, t, nd)"
                        (blur)="ajouterDestinataires(t, nd)"
                      />
                    }
                  </div>
                  <datalist id="dl-dest">
                    @for (p of propositions(v, t); track p) {
                      <option [value]="p"></option>
                    }
                  </datalist>
                </div>
                @if (dest(t).length) {
                  <button type="button" class="btn sm" (click)="copierAdresses(t)">Copier les adresses</button
                  ><span class="auto" style="display: inline; margin-left: 8px">Séparées par « ; », prêtes pour Outlook.</span>
                }
              </section>
            } @else if (livrable(t)) {
              <section class="plan-sec">
                <h3>Livrable</h3>
                <app-etapes [libelles]="lvSteps" [faits]="lvValide(t) ? 2 : lvLivre(t) ? 1 : 0" titre="Suivi du livrable" />
                <table class="pr-tbl">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Prévu</th>
                      <th>Réel</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>Livraison au client</th>
                      <td><input #lf class="in w-date" type="date" aria-label="Livraison prévue" [value]="t.tr.fin ?? ''" [disabled]="lecture()" (change)="dates(t, 'fin', lf)" /></td>
                      <td>
                        @if (lvLivre(t); as liv) {
                          <b class="pos">✓ {{ fD(liv) }}</b>
                          @if (retardLivraison(t); as r) {
                            <span class="neg"> +{{ r }} j</span>
                          }
                        } @else {
                          <span class="muted">à la validation</span>
                        }
                      </td>
                    </tr>
                    <tr>
                      <th>Validation client</th>
                      <td class="muted">—</td>
                      <td>
                        @if (lvLivre(t)) {
                          <input #lv class="in w-date" type="date" aria-label="Validé par le client le" [value]="lvValide(t) ?? ''" [disabled]="lecture()" (change)="validationClient(t, lv)" />
                          @if (!lvValide(t)) {
                            <span class="auto">en attente du client</span>
                          }
                        } @else {
                          <span class="muted">après livraison</span>
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p class="auto">
                  Livré : renseigné automatiquement quand la tâche est validée dans la saisie du consommé (dernier jour saisi). Validation client : à saisir quand le client a
                  validé. {{ plageConso(t) }}
                </p>
                <div class="lv-doc">
                  <span class="lv-doc-l">Document livré</span>
                  @if (t.tr.livr?.lien; as lien) {
                    <div class="lv-doc-carte">
                      <span class="lv-doc-ico" aria-hidden="true"
                        ><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg
                      ></span>
                      <span class="lv-doc-nom" [title]="lien">{{ nomDocument(lien) }}</span>
                      @if (lienOuvrable(lien)) {
                        <a class="btn sm ghost" [href]="lien" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>
                      } @else {
                        <button type="button" class="btn sm ghost" (click)="copier(lien)" title="Chemin réseau : à coller dans l’explorateur de fichiers">Copier le chemin</button>
                      }
                    </div>
                  }
                  @if (!lecture()) {
                    <input
                      #ld
                      class="in"
                      type="text"
                      maxlength="1000"
                      placeholder="Coller le lien SharePoint ou le chemin réseau du document"
                      aria-label="Lien du document livré"
                      [value]="t.tr.livr?.lien ?? ''"
                      (change)="lienDocument(t, ld)"
                    />
                  } @else if (!t.tr.livr?.lien) {
                    <span class="muted">Aucun document indiqué.</span>
                  }
                </div>
              </section>
            } @else {
              <section class="plan-sec">
                <h3>Planning</h3>
                <table class="pr-tbl">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Prévu</th>
                      <th>Réel <small>consommé</small></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>Début</th>
                      <td><input #pd class="in w-date" type="date" aria-label="Début prévu" [value]="t.tr.debut ?? ''" [disabled]="lecture()" (change)="dates(t, 'debut', pd)" /></td>
                      <td>{{ fD(t.consoDates[0]) }}</td>
                    </tr>
                    <tr>
                      <th>Fin</th>
                      <td><input #pf class="in w-date" type="date" aria-label="Fin prévue" [value]="t.tr.fin ?? ''" [disabled]="lecture()" (change)="dates(t, 'fin', pf)" /></td>
                      <td>
                        {{ fD(derniereDate(t)) }}
                        @if (ecartFin(t); as e) {
                          <span [class]="e > 0 ? 'neg' : 'pos'"> ({{ e > 0 ? '+' : '' }}{{ e }} j)</span>
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p class="auto">Réel = premier et dernier jour de consommé saisi, tous profils confondus.</p>
              </section>
            }

            <section>
              <h3>Charges</h3>
              <div class="dr-kpis">
                <div>
                  <span>
                    @if (t.annulee) {
                      Prévu <small>({{ fJ(t.chargeInit) }} − {{ fJ(t.chargeAnnulee) }} annulés)</small>
                    } @else if (t.chargeAjout) {
                      @if (t.estAjout) {
                        Prévu <small>(tâche ajoutée)</small>
                      } @else {
                        Prévu <small>({{ fJ(t.chargeTSP) }} vendus + {{ fJ(t.chargeAjout) }} ajoutés)</small>
                      }
                    } @else {
                      Prévu <small>(= vendu)</small>
                    }
                  </span>
                  <b>{{ fJ(t.charge) }} JH</b>
                </div>
                <div>
                  <span>Consommé</span><b [class.over]="isOver(t)">{{ fJ(t.consoTotal) }} JH</b>
                </div>
                <div>
                  <span>Atterrissage</span><b>{{ fJ(t.atterrissage) }} JH</b>
                </div>
                <div>
                  <span>Écart</span><b [class]="sgn(t.ecart)">{{ fSigned(t.ecart) }} JH</b>
                </div>
              </div>
              @if (!t.annulee) {
                <label class="field" style="margin-top: 10px">
                  <span [title]="aideRaf"
                    >Reste à faire (JH) <span class="muted" aria-hidden="true">ⓘ</span></span
                  >
                  <input
                    #raf
                    class="in w-num"
                    inputmode="decimal"
                    [value]="t.rafSaisi == null ? '' : fJ(t.rafSaisi)"
                    [placeholder]="fJ(t.rafAuto)"
                    [title]="aideRaf"
                    [disabled]="lecture()"
                    (change)="resteAFaire(t, raf)"
                  />
                </label>
              }
              @if (t.rafAReestimer) {
                <div class="dr-alert crit">
                  <b>Reste à faire à réestimer.</b> Le budget de la tâche est consommé ({{ fJ(t.consoTotal) }} / {{ fJ(t.charge) }} JH) mais elle n’est pas validée : saisissez le
                  nombre de jours encore nécessaires, ou validez-la si elle est terminée.
                </div>
              }
              @if (t.rafSuggere != null && ecartSuggestion(t) >= 0.05) {
                <div class="dr-alert" [class]="'dr-alert ' + (t.rafIncoherent ? 'warn' : 'info')">
                  RAF suggéré selon l’avancement ({{ fP(t.avancement) }} pour {{ fJ(t.consoTotal) }} JH consommés) : <b>{{ fJ(t.rafSuggere) }} JH</b
                  >{{ t.rafIncoherent ? ' — écart important avec le RAF retenu (' + fJ(t.raf) + ' JH).' : '.' }}
                  @if (!lecture()) {
                    <button type="button" class="btn sm" (click)="appliquerSuggestion(t)">Appliquer</button>
                  }
                </div>
              }
              @if (t.annulee) {
                <div class="note">Répartition annulée : {{ repartitionAnnulee(v, t) }}</div>
              } @else {
                <!-- largeurs fixes : le tableau tient dans le panneau, le nom du profil passe à la ligne -->
                <table class="dr-prof dr-prof-fixe">
                  <colgroup>
                    <col />
                    <col style="width: 48px" />
                    @if (avecReaff(t)) {
                      <col style="width: 66px" />
                    }
                    <col style="width: 60px" />
                    <col style="width: 66px" />
                    <col style="width: 44px" />
                    <col style="width: 62px" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Profil</th>
                      <th class="n">Vendu</th>
                      @if (avecReaff(t)) {
                        <th class="n c-reaff" title="Charge retirée à un profil (−) et confiée à un autre (+)">Réaffecté</th>
                      }
                      <th class="n">Ajouté</th>
                      <th class="n">Consommé</th>
                      <th class="n">RAF</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (i of profils(t); track i) {
                      <tr [class.is-aj]="!!t.chargesA[i]" [class.is-reaff]="recues(t, i).length > 0">
                        <td>
                          {{ v.P[i]?.nom ?? '' }}
                          @if (recues(t, i).length) {
                            <span class="tag-reaff">réaffecté</span>
                          } @else if (v.P[i]?.ajout) {
                            <span class="tag-aj" title="Profil créé en cours de projet">profil ajouté</span>
                          }
                          @if (t.chargesA[i] && !t.estAjout && motifAjout(t, i); as motif) {
                            <small class="muted dr-motif" [title]="motif">{{ motif }}</small>
                          }
                          @for (r of recues(t, i); track r.id) {
                            <small class="muted dr-motif dr-reaff"
                              >De {{ v.P[r.de]?.nom ?? '' }} ({{ fJ(r.jh) }} JH){{ r.motif ? ' · « ' + r.motif + ' »' : '' }}
                              @if (!lecture()) {
                                <button
                                  type="button"
                                  class="dr-reaff-x"
                                  [title]="'Annuler cette réaffectation : la charge revient à ' + (v.P[r.de]?.nom ?? '')"
                                  [attr.aria-label]="'Annuler la réaffectation de ' + (v.P[r.de]?.nom ?? '') + ' vers ' + (v.P[i]?.nom ?? '')"
                                  (click)="annulerReaffectation(t, r.id)"
                                >
                                  ✕
                                </button>
                              }
                            </small>
                          }
                        </td>
                        <td class="n">{{ fJz(t.chargesV[i]) || '—' }}</td>
                        @if (avecReaff(t)) {
                          <td class="n" [class.c-reaff]="!!t.chargesR[i]">{{ t.chargesR[i] ? fSigned(t.chargesR[i]) : '—' }}</td>
                        }
                        <td class="n">
                          @if (t.chargesA[i]) {
                            <input
                              #aj
                              class="in w-num sm"
                              inputmode="decimal"
                              [value]="fJ(t.chargesA[i])"
                              [attr.aria-label]="'Charge ajoutée ' + (v.P[i]?.nom ?? '')"
                              title="Charge ajoutée (non facturée)"
                              [disabled]="lecture()"
                              (change)="modifierAjout(t, i, aj)"
                            />
                          } @else {
                            —
                          }
                        </td>
                        <td class="n" [class.over]="depasse(t, i)">{{ fJ(t.consoP[i]) }}</td>
                        <td class="n" [class.neg]="depasse(t, i)">{{ depasse(t, i) ? fSigned(t.charges[i] - t.consoP[i]) : fJ(t.restP[i]) }}</td>
                        <td class="dr-act">
                          @if (!lecture() && reaffectable(t, i) > 0) {
                            <button
                              type="button"
                              class="dr-reaff-btn"
                              title="Réaffecter une partie de la charge"
                              [attr.aria-label]="'Réaffecter une partie de la charge de ' + (v.P[i]?.nom ?? '')"
                              (click)="etat.fenetre.set({ type: 'reaffectation', uid: t.uid, de: i })"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M4 8h13" />
                                <path d="m14 5 3 3-3 3" />
                                <path d="M20 16H7" />
                                <path d="m10 13-3 3 3 3" />
                              </svg>
                            </button>
                          }
                          @if (t.chargesA[i] && !lecture() && !(t.estAjout && nbAjouts(t) <= 1)) {
                            <button type="button" class="btn sm ghost" title="Retirer cet ajout" (click)="retirerAjout(t, i)">✕</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (!lecture()) {
                  <div class="dr-gestes">
                    <div>
                      <button
                        type="button"
                        class="btn sm dr-geste-reaff"
                        [disabled]="!aReaffecter(t)"
                        [title]="aReaffecter(t) ? '' : 'Rien à réaffecter : toute la charge de cette tâche est déjà consommée.'"
                        (click)="etat.fenetre.set({ type: 'reaffectation', uid: t.uid, de: null })"
                      >
                        ⇄ Réaffecter la charge</button
                      ><span class="auto">Même charge, confiée à une autre personne. Le total de la tâche ne change pas.</span>
                    </div>
                    <div>
                      <button type="button" class="btn sm" (click)="etat.fenetre.set({ type: 'ajout-profil', uid: t.uid })">+ Ajouter un profil</button
                      ><span class="auto">Charge en plus, non facturée : elle augmente le prévu et réduit la marge.</span>
                    </div>
                  </div>
                }
              }
            </section>

            <section>
              <h3>Classement</h3>
              <div class="dr-dates">
                <label class="field"
                  >Type{{ t.typeManuel ? ' ✎' : '' }}
                  <select #ty class="in" [disabled]="lecture()" (change)="classement(t, 'type', ty, t.type)">
                    <option value="" [selected]="!t.type">—</option>
                    @for (x of v.projet.types; track x.id) {
                      <option [value]="x.id" [selected]="x.id === t.type">{{ x.nom }}</option>
                    }
                  </select>
                </label>
                <label class="field"
                  >Axe
                  <select #ax class="in" [disabled]="lecture()" (change)="classement(t, 'axe', ax, t.axe)">
                    @if (!t.id) {
                      <option value="" [selected]="!t.axe">— Choisir un axe —</option>
                    }
                    @for (x of v.axeIds; track x) {
                      <option [value]="x" [selected]="x === t.axe">{{ nomAxe(v, x) }}</option>
                    }
                  </select>
                </label>
                <label class="field"
                  >Phase
                  <select #ph class="in" [disabled]="lecture()" (change)="classement(t, 'phase', ph, t.phase)">
                    @if (!t.phase) {
                      <option value="" selected>—</option>
                    }
                    @for (x of v.phases; track x) {
                      <option [value]="x" [selected]="x === t.phase">{{ x }}</option>
                    }
                  </select>
                </label>
                <label class="field"
                  >Lot
                  <input #lo class="in" list="dl-lots" [value]="t.lot" [disabled]="lecture()" (change)="classement(t, 'lot', lo, t.lot)" />
                  <datalist id="dl-lots">
                    @for (x of v.lots; track x) {
                      <option [value]="x"></option>
                    }
                  </datalist>
                </label>
              </div>
            </section>

            @if (t.ia > 0) {
              <section>
                <h3>Optimisation IA <app-fx cle="ia" /></h3>
                <div class="dr-kpis">
                  <div>
                    <span>Enveloppe IA</span><b>{{ fJ(t.ia) }} JH</b>
                  </div>
                  <div>
                    <span>Profils prévus</span><b>{{ fJ(t.iaHum) }} JH</b>
                  </div>
                  <div>
                    <span>IA consommée</span><b>{{ fJ(t.iaConso) }} JH</b>
                  </div>
                  <div>
                    <span>{{ t.statut === 'Validé' ? 'Résultat' : 'Projection' }}</span>
                    <b>
                      @if (t.iaRes == null) {
                        —
                      } @else {
                        <span [class]="t.iaRes > 1e-9 ? 'pos' : t.iaRes < -1e-9 ? 'neg' : ''" [title]="t.statut === 'Validé' ? 'Résultat constaté' : 'Projection à l’atterrissage'"
                          >{{ t.statut === 'Validé' ? '' : '≈ ' }}{{ fSigned(t.iaRes) }}</span
                        >
                      }
                    </b>
                  </div>
                </div>
                <div class="ia-line">
                  <span class="ia-pill" [class]="'ia-pill ' + iaStatut(t)[1]">{{ iaStatut(t)[0] }}</span>
                  @if (t.iaAJustifier) {
                    <span class="ia-pill ia-just" title="Tâche validée avec un écart sur l’enveloppe IA : indiquez le type et le commentaire">À justifier</span>
                  }
                </div>
                <label class="field" style="margin-top: 8px"
                  >{{ (t.iaRes ?? 0) < -1e-9 ? 'Cause du dépassement' : 'Levier d’optimisation' }}
                  <select #it class="in" [disabled]="lecture()" (change)="bilanIa(t, it.value, t.iaJustif, it, t.iaType)">
                    <option value="">— {{ (t.iaRes ?? 0) < -1e-9 ? 'Cause' : 'Levier' }} —</option>
                    @for (x of typesIa(v, t); track x) {
                      <option [value]="x" [selected]="x === t.iaType">{{ x }}</option>
                    }
                  </select>
                </label>
                <label class="field" style="margin-top: 8px"
                  >Commentaire IA
                  <textarea
                    #ij
                    class="in dr-cmt"
                    rows="2"
                    placeholder="Pourquoi l’enveloppe IA a-t-elle été (ou non) consommée ?"
                    [value]="t.iaJustif"
                    [disabled]="lecture()"
                    (change)="bilanIa(t, t.iaType, ij.value, ij, t.iaJustif)"
                  ></textarea>
                </label>
              </section>
            }

            @if (v.m.echeancier.length && v.droits.voitMontants) {
              <section>
                <h3>Facturation</h3>
                @if (t.echViaPhase) {
                  <div class="lockline">
                    <span class="lock-ic" aria-hidden="true">🔒</span
                    ><span
                      >Échéance définie par la phase <b>{{ t.phase }}</b> : elle s’applique à toutes ses tâches.</span
                    ><button type="button" class="btn sm" [attr.data-openph]="t.phase">Ouvrir la phase</button>
                  </div>
                } @else {
                  <label class="field"
                    >Échéance liée
                    <select #ec class="in" [disabled]="lecture()" (change)="echeance(t, ec)">
                      <option value="" [selected]="t.tr.ech == null">— Aucune —</option>
                      @for (e of v.m.echeancier; track e.n) {
                        <option [value]="e.n" [selected]="t.tr.ech === e.n" [disabled]="t.tr.ech !== e.n && !!e.realiseLe">{{ libelleEcheance(e) }}</option>
                      }
                    </select>
                  </label>
                }
                @if (echeanceTache(v, t); as e) {
                  <div class="dr-ech" [class]="'dr-ech ech-' + echEtat(v, e)[0]">
                    <span class="pill" [class]="'pill ech-p-' + echEtat(v, e)[0]">{{ echEtat(v, e)[1] }}</span> <b>n° {{ e.n }}</b> · {{ fE(e.montant) }} · prévue le
                    {{ fD(e.datePrevue) }}{{ e.realiseLe ? ' · facturée le ' + fD(e.realiseLe) : '' }}{{ e.payeeLe ? ' · payée le ' + fD(e.payeeLe) : '' }}
                    <div class="perim-av">
                      <app-mini-barre [valeur]="e.avLie" /><span>Périmètre lié : {{ e.nLies }} tâche(s), avancement {{ fP(e.avLie ?? 0) }}</span>
                      @if (e.pret && !e.realiseLe) {
                        <span class="tag-ok">Prête à facturer</span>
                      }
                    </div>
                  </div>
                } @else if (!t.echViaPhase) {
                  <span class="auto"
                    >Liez la tâche à l’échéance de facturation qu’elle conditionne
                    @if (t.phase) {
                      , ou liez toute la phase {{ t.phase }} depuis <button type="button" class="linkbtn" [attr.data-openph]="t.phase">son panneau</button>
                    }
                    .</span
                  >
                }
              </section>
            }

            <section>
              <h3>Commentaire</h3>
              <textarea
                #cm
                class="in dr-cmt"
                rows="4"
                placeholder="Points d’attention, décisions, blocages…"
                [value]="t.commentaire"
                [disabled]="lecture()"
                (change)="commentaire(t, cm)"
              ></textarea>
            </section>

            <section class="fil">
              <h3>
                Mises à jour
                @if (fil().length) {
                  <span class="fil-n">{{ fil().length }}</span>
                }
              </h3>
              @if (v.droits.peutSaisirConsomme) {
                <div class="fil-saisie">
                  <textarea
                    #mj
                    class="in"
                    rows="2"
                    maxlength="4000"
                    placeholder="Où en est la tâche ? @Prénom pour prévenir quelqu’un"
                    aria-label="Nouvelle mise à jour"
                    (keydown.control.enter)="publier(t, mj)"
                    (keydown.meta.enter)="publier(t, mj)"
                  ></textarea>
                  <div class="fil-pied">
                    <span class="auto">Visible par toute l’équipe du projet · les montants en euros sont masqués pour les consultants.</span>
                    <button type="button" class="btn sm primary" (click)="publier(t, mj)">Publier</button>
                  </div>
                </div>
              }
              @for (m of fil(); track $index) {
                <div class="fil-msg">
                  <span class="fil-av" aria-hidden="true">{{ initialesDe(m.by || '?') }}</span>
                  <div class="fil-corps">
                    <span class="fil-tete"><b>{{ m.by || 'Utilisateur' }}</b> · {{ fDh(m.at) }}</span>
                    <p>
                      @for (x of morceaux(m.texte); track $index) {
                        @if (x.mention) {
                          <span class="fil-mention">{{ x.texte }}</span>
                        } @else {
                          {{ x.texte }}
                        }
                      }
                    </p>
                  </div>
                </div>
              } @empty {
                <p class="auto">Aucune mise à jour pour l’instant.</p>
              }
            </section>

            @if (t.hypothese) {
              <section>
                <h3>{{ t.estAjout ? 'Hypothèse / description' : 'Hypothèse du TSP' }}</h3>
                <p class="note">{{ t.hypothese }}</p>
              </section>
            }

            @if (actionsLiees(v, t); as acts) {
              @if (acts.length) {
                <section>
                  <h3>Actions liées</h3>
                  <div class="ph-tasks">
                    @for (a of acts; track a.id) {
                      <button type="button" class="ph-task" (click)="allerAction(a)">
                        <span class="ph-t-l"
                          ><b>{{ a.ref }}</b> {{ a.libelle }}</span
                        >
                        <span class="muted">{{ a.porteur }}</span>
                        <span class="pill xs">{{ a.statut }}</span>
                        <span class="num muted">{{ a.echeance ? fD(a.echeance) : '' }}</span>
                      </button>
                    }
                  </div>
                </section>
              }
            }

            @if (!lecture() && !t.annulee && t.statut !== 'Validé') {
              <section class="dr-danger">
                <button type="button" class="btn sm danger-ghost" (click)="etat.fenetre.set({ type: 'annulation', uid: t.uid })">Annuler la tâche…</button
                ><span class="auto">Retire le reste à faire du périmètre ; le consommé est conservé.</span>
              </section>
            }
            @if (!lecture() && t.estAjout) {
              <section>
                <button type="button" class="btn sm danger" (click)="supprimer(t)">Supprimer cette tâche ajoutée</button>
              </section>
            }
          </div>
        </aside>
      }
    }
  `,
})
export class PanneauTache {
  readonly uid = input.required<string>();
  protected readonly etat = inject(SuiviEtat);
  private readonly ui = inject(UiEtat);
  private readonly api = inject(SuiviApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly vue = this.etat.vue;
  protected readonly t = computed(() => this.vue()?.parUid.get(this.uid()) ?? null);
  protected readonly lecture = computed(() => !this.vue()?.droits.peutModifier);
  protected readonly couleur = computed(() => {
    const v = this.vue(),
      t = this.t();
    return v && t ? `var(--ax${Math.max(0, v.m.axes.findIndex((a) => a.id === t.grp)) % 8})` : 'var(--ax0)';
  });

  protected readonly statuts = STATUTS;
  protected readonly avancements = AVANCEMENTS;
  protected readonly atSteps = AT_STEPS;
  protected readonly lvSteps = LV_STEPS;
  protected readonly aideRaf =
    'Vide = calcul automatique, profil par profil : Σ max(prévu − consommé ; 0) ; Agent IA : reste de l’enveloppe. Toujours 0 quand la tâche est validée.';
  protected readonly fD = fD;
  protected readonly fDh = fDh;
  protected readonly fDi = fDi;
  protected readonly morceaux = morceaux;
  protected readonly lienOuvrable = lienOuvrable;
  protected readonly nomDocument = nomDocument;
  protected readonly initialesDe = initialesDe;
  /** Fil de mises à jour de la tâche, du plus récent au plus ancien. */
  protected readonly fil = computed(() => this.vue()?.projet.misesAJour?.[this.uid()] ?? []);
  protected readonly fE = fE;
  protected readonly fJ = fJ;
  protected readonly fJz = fJz;
  protected readonly fP = fP;
  protected readonly fSigned = fSigned;
  protected readonly sgn = sgn;
  protected readonly stSlug = stSlug;
  protected readonly isOver = isOver;
  protected readonly atStep = atStep;
  protected readonly atRealise = atRealise;
  protected readonly lvLivre = lvLivre;
  protected readonly lvValide = lvValide;
  protected readonly echEtat = echEtat;
  protected readonly nomGroupe = axeName;
  protected readonly nomAxe = idName;
  protected readonly profils = taskProfiles;

  /** Position de la tâche dans la liste affichée (ordre et filtres de l'onglet). */
  protected readonly position = computed(() => {
    this.vue();
    this.ui.ui();
    const liste = listeAffichee();
    return { pos: liste.indexOf(this.uid()), total: liste.length };
  });

  constructor() {
    // tâche disparue (supprimée) : on ferme le panneau
    effect(() => {
      if (this.vue() && !this.t()) this.etat.fermerPanneau();
    });
  }

  protected atelier(t: TacheVue): boolean {
    return isAtelier(t) && !t.annulee;
  }

  protected livrable(t: TacheVue): boolean {
    return t.type === 'Livrable' && !t.annulee;
  }

  protected egal(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-9;
  }

  protected dest(t: TacheVue): string[] {
    return t.tr.atelier?.dest ?? [];
  }

  protected propositions(v: Vue, t: TacheVue): string[] {
    const d = this.dest(t);
    return destPool(v).filter((x) => !d.includes(x));
  }

  protected plageConso(t: TacheVue): string {
    return t.consoDates.length ? `Consommé saisi du ${fD(t.consoDates[0])} au ${fD(t.consoDates[t.consoDates.length - 1])}.` : 'Aucun consommé saisi.';
  }

  protected derniereDate(t: TacheVue): string | null {
    return t.consoDates[t.consoDates.length - 1] ?? null;
  }

  protected ecartFin(t: TacheVue): number {
    const rf = this.derniereDate(t);
    return rf && t.tr.fin ? joursEntre(t.tr.fin, rf) : 0;
  }

  protected retardLivraison(t: TacheVue): number {
    const liv = lvLivre(t),
      pv = lvPrevue(t);
    return liv && pv && liv > pv ? joursEntre(pv, liv) : 0;
  }

  protected ecartSuggestion(t: TacheVue): number {
    return Math.abs((t.rafSuggere ?? 0) - t.raf);
  }

  protected depasse(t: TacheVue, i: number): boolean {
    return t.consoP[i] > t.charges[i] + 1e-9;
  }

  protected nbAjouts(t: TacheVue): number {
    return Object.keys(t.tr.chargeAjout ?? {}).length;
  }

  /** Charge encore réaffectable (jamais pour l'enveloppe IA). */
  protected reaffectable(t: TacheVue, i: number): number {
    return reaffectableDe(t, i, this.vue()?.projet.settings.iaProfile ?? -1);
  }

  /** Le tableau montre la colonne « Réaffecté » dès qu'une réaffectation touche la tâche. */
  protected avecReaff(t: TacheVue): boolean {
    return t.chargesR.some((x) => Math.abs(x) > 1e-9);
  }

  /** Réaffectations reçues par un profil. */
  protected recues(t: TacheVue, i: number) {
    return t.reaff.filter((r) => r.vers === i);
  }

  /** Au moins un profil a de la charge à réaffecter. */
  protected aReaffecter(t: TacheVue): boolean {
    return this.profils(t).some((i) => this.reaffectable(t, i) > 0);
  }

  protected motifAjout(t: TacheVue, i: number): string {
    return t.tr.ajoutInfo?.[String(i)]?.motif ?? '';
  }

  protected repartitionAnnulee(v: Vue, t: TacheVue): string {
    return (
      t.chargesAnnul
        .map((c, i) => (c ? `${v.P[i]?.nom ?? ''} ${fJ(c)} JH` : null))
        .filter(Boolean)
        .join(' · ') || '—'
    );
  }

  protected readonly decisionAnnulation = computed(() => {
    const t = this.t(),
      v = this.vue();
    const id = t?.tr.annul?.decision;
    return id ? (v?.projet.decisions.find((d) => d.id === id)?.ref ?? '') : '';
  });

  protected iaStatut(t: TacheVue): [string, string] {
    return IA_ST[t.iaStatut ?? ''] ?? ['—', 'ia-none'];
  }

  /** Leviers si économie, causes si dépassement (le type déjà choisi reste proposé). */
  protected typesIa(v: Vue, t: TacheVue): string[] {
    const r = t.iaRes ?? 0;
    const liste = r > 1e-9 ? v.m.ia.leviers : r < -1e-9 ? v.m.ia.causes : [IA_CONFORME, ...v.m.ia.leviers];
    return t.iaType && !liste.includes(t.iaType) ? [...liste, t.iaType] : liste;
  }

  protected libelleEcheance(e: Vue['m']['echeancier'][number]): string {
    return `n° ${e.n} — ${e.nom}${e.datePrevue ? ` (${fD(e.datePrevue)})` : ''}${e.payeeLe ? ' · payée' : e.realiseLe ? ' · facturée' : ''}`;
  }

  protected echeanceTache(v: Vue, t: TacheVue): Vue['m']['echeancier'][number] | null {
    return t.echN != null ? (v.m.echeancier.find((x) => x.n === t.echN) ?? null) : null;
  }

  protected actionsLiees(v: Vue, t: TacheVue): Action[] {
    return v.projet.actions.filter((a) => a.tache === t.uid);
  }

  // ---------------------------------------------------------------- navigation

  /** « ‹ Rentabilité » : retour au détail de la colonne de la cascade, sur l'écran Rentabilité (même si on en est sorti entre-temps). */
  protected async revenirMarge(cle: string): Promise<void> {
    if (!this.router.url.split('?')[0].endsWith('/rentabilite')) await this.router.navigate(['rentabilite'], { relativeTo: this.route });
    this.etat.ouvrirMarge(cle);
  }

  protected naviguer(pas: number): void {
    const liste = listeAffichee();
    const suivante = liste[liste.indexOf(this.uid()) + pas];
    if (!suivante) return;
    this.etat.ouvrirTache(suivante, this.etat.retourMarge()); // le retour vers le détail de la rentabilité est gardé
    document.querySelector(`.suivi .s-panel [data-open="${CSS.escape(suivante)}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  protected clavier(e: Event): void {
    if (!(e instanceof KeyboardEvent) || !e.altKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    if (this.etat.fenetre() || this.etat.confirmation()) return;
    e.preventDefault();
    this.naviguer(e.key === 'ArrowDown' ? 1 : -1);
  }

  protected allerAction(a: Action): void {
    this.ui.maj({ ad: 'actions', adf: a.statut === 'Fait' || a.statut === 'Annulée' ? 'toutes' : 'ouvertes' });
    this.etat.fermerPanneau();
    void this.router.navigate(['actions'], { relativeTo: this.route }).then(() => this.etat.ligneEnEvidence.set(a.id));
  }

  // ---------------------------------------------------------------- saisies

  private remettre(el: Champ, ancien: string): () => void {
    return () => (el.value = ancien);
  }

  protected statut(t: TacheVue, s: string): void {
    if (t.statut === s) return;
    void this.etat.saisir((id) => this.api.statut(id, t.uid, s, this.etat.versionTache(t.uid)));
  }

  protected avancement(t: TacheVue, a: number): void {
    if (this.egal(t.avancement, a)) return;
    void this.etat.saisir((id) => this.api.avancement(id, t.uid, a, this.etat.versionTache(t.uid)));
  }

  protected libelle(t: TacheVue, el: HTMLTextAreaElement): void {
    const v = el.value.replace(/\s+/g, ' ').trim();
    if (!v) {
      el.value = t.label;
      this.etat.afficher('L’intitulé ne peut pas être vide.', 'attention');
      return;
    }
    if (v === t.label) return;
    void this.etat.saisir((id) => this.api.libelle(id, t.uid, v, this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, t.label) });
  }

  protected async revenirIntituleTsp(t: TacheVue): Promise<void> {
    const r = await this.etat.saisir((id) => this.api.libelle(id, t.uid, t.labelTSP, this.etat.versionTache(t.uid)));
    if (r) this.etat.afficher('Intitulé du TSP rétabli.', 'succes');
  }

  /** Adresse du document livré : enregistrée telle quelle (le serveur n'accepte que les liens web et les chemins réseau). */
  protected lienDocument(t: TacheVue, el: HTMLInputElement): void {
    const ancien = t.tr.livr?.lien ?? '';
    void this.etat.saisir((id) => this.api.lienLivrable(id, t.uid, el.value.trim() || null), { siErreur: this.remettre(el, ancien) });
  }

  protected copier(texte: string): void {
    void navigator.clipboard?.writeText(texte).then(
      () => this.etat.afficher('Chemin copié : collez-le dans l’explorateur de fichiers.', 'succes'),
      () => this.etat.afficher('Copie impossible : sélectionnez le chemin à la main.', 'attention'),
    );
  }

  /** Publie une mise à jour ; le champ est vidé une fois enregistrée. */
  protected async publier(t: TacheVue, el: HTMLTextAreaElement): Promise<void> {
    const texte = el.value.trim();
    if (!texte) return;
    const r = await this.etat.saisir((id) => this.api.miseAJour(id, t.uid, texte));
    if (r) el.value = '';
  }

  protected commentaire(t: TacheVue, el: HTMLTextAreaElement): void {
    void this.etat.saisir((id) => this.api.commentaire(id, t.uid, el.value, this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, t.commentaire) });
  }

  protected resteAFaire(t: TacheVue, el: HTMLInputElement): void {
    const ancien = t.rafSaisi == null ? '' : fJ(t.rafSaisi);
    const n = lireNombre(el.value);
    if (n != null && (isNaN(n) || n < 0)) {
      el.value = ancien;
      this.etat.afficher('Valeur invalide : saisissez un nombre positif.', 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.resteAFaire(id, t.uid, n, this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, ancien) });
  }

  protected appliquerSuggestion(t: TacheVue): void {
    const n = round(t.rafSuggere ?? 0, 2);
    void this.etat.saisir((id) => this.api.resteAFaire(id, t.uid, n, this.etat.versionTache(t.uid)));
  }

  protected dates(t: TacheVue, champ: 'debut' | 'fin', el: HTMLInputElement): void {
    const valeur = el.value || null;
    const ancien = (champ === 'debut' ? t.tr.debut : t.tr.fin) ?? '';
    const debut = champ === 'debut' ? valeur : (t.tr.debut ?? null);
    const fin = champ === 'fin' ? valeur : (t.tr.fin ?? null);
    if (debut && fin && fin < debut) {
      el.value = ancien;
      this.etat.afficher(`La fin prévue (${fD(fin)}) ne peut pas précéder le début prévu (${fD(debut)}) : saisie annulée.`, 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.dates(id, t.uid, debut, fin, this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, ancien) });
  }

  protected classement(t: TacheVue, champ: 'type' | 'axe' | 'phase' | 'lot', el: HTMLInputElement | HTMLSelectElement, ancien: string): void {
    const valeur = el.value.trim();
    if (valeur === ancien) return;
    void this.etat.saisir((id) => this.api.classement(id, t.uid, champ, valeur, this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, ancien) });
  }

  protected bilanIa(t: TacheVue, iaType: string, iaJustif: string, el: Champ, ancien: string): void {
    void this.etat.saisir((id) => this.api.bilanIa(id, t.uid, iaType, iaJustif.trim(), this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, ancien) });
  }

  protected echeance(t: TacheVue, el: HTMLSelectElement): void {
    const ancien = t.tr.ech == null ? '' : String(t.tr.ech);
    const n = el.value ? +el.value : null;
    void this.etat.saisir((id) => this.api.echeanceTache(id, t.uid, n, this.etat.versionTache(t.uid)), { siErreur: this.remettre(el, ancien) });
  }

  // ---- atelier

  protected dateAtelier(t: TacheVue, el: HTMLInputElement): void {
    void this.etat.saisir((id) => this.api.dateAtelier(id, t.uid, el.value || null), { siErreur: this.remettre(el, t.tr.atelier?.date ?? '') });
  }

  protected horaire(t: TacheVue, debut: HTMLInputElement, fin: HTMLInputElement): void {
    const hd = debut.value || null,
      hf = fin.value || null;
    const remettre = () => {
      debut.value = t.tr.atelier?.heureDebut ?? '';
      fin.value = t.tr.atelier?.heureFin ?? '';
    };
    if (hd && hf && hf <= hd) {
      remettre();
      this.etat.afficher(`L’heure de fin (${hf}) doit être après l’heure de début (${hd}) : saisie annulée.`, 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.horaireAtelier(id, t.uid, hd, hd ? hf : null), { siErreur: remettre });
  }

  protected invitation(t: TacheVue, envoyee: boolean): void {
    void this.etat.saisir((id) => this.api.invitation(id, t.uid, envoyee));
  }

  protected dateInvitation(t: TacheVue, el: HTMLInputElement): void {
    const ancien = t.tr.atelier?.invitLe ?? '';
    if (!el.value) {
      el.value = ancien;
      this.etat.afficher('Date d’envoi obligatoire : pour annuler l’envoi, utilisez « Annuler l’envoi ».', 'erreur');
      return;
    }
    const aujourdhui = this.vue()?.aujourdhui ?? '';
    if (el.value > aujourdhui) {
      el.value = ancien;
      this.etat.afficher('La date d’envoi ne peut pas être dans le futur : saisie annulée.', 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.dateInvitation(id, t.uid, el.value), { siErreur: this.remettre(el, ancien) });
  }

  protected toucheDestinataire(e: KeyboardEvent, t: TacheVue, el: HTMLInputElement): void {
    if (e.key === 'Enter' || e.key === ';' || e.key === ',') {
      e.preventDefault();
      if (el.value.trim()) this.ajouterDestinataires(t, el);
    } else if (e.key === 'Backspace' && !el.value) {
      const d = this.dest(t);
      if (d.length) void this.etat.saisir((id) => this.api.destinataires(id, t.uid, d.slice(0, -1)));
    }
  }

  /** Ajoute un ou plusieurs destinataires (séparés par ; , ou retour à la ligne), sans doublon. */
  protected ajouterDestinataires(t: TacheVue, el: HTMLInputElement): void {
    const brut = el.value;
    if (!brut.trim()) return;
    el.value = ''; // vidé avant l'envoi : la perte de focus ne doit pas relancer l'ajout
    const actuels = this.dest(t);
    const tous = brut
      .split(/[;,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    const nouveaux = tous.filter(
      (x, i) => !actuels.some((y) => y.toLowerCase() === x.toLowerCase()) && tous.findIndex((z) => z.toLowerCase() === x.toLowerCase()) === i,
    );
    if (!nouveaux.length) {
      this.etat.afficher(tous.length > 1 ? 'Ces destinataires sont déjà dans la liste.' : `« ${tous[0] ?? ''} » est déjà dans la liste.`, 'attention');
      return;
    }
    const pasMail = nouveaux.filter((x) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x.replace(/^.*<(.+)>$/, '$1')));
    if (pasMail.length) this.etat.afficher(`Pas une adresse e-mail : ${pasMail.join(', ')}. Ajouté quand même, mais Outlook ne pourra pas l’utiliser.`, 'attention');
    void this.etat.saisir((id) => this.api.destinataires(id, t.uid, [...actuels, ...nouveaux]), { siErreur: () => (el.value = brut) }).then(() => el.focus());
  }

  protected retirerDestinataire(t: TacheVue, i: number): void {
    const d = [...this.dest(t)];
    d.splice(i, 1);
    void this.etat.saisir((id) => this.api.destinataires(id, t.uid, d));
  }

  protected copierAdresses(t: TacheVue): void {
    const texte = this.dest(t).join('; ');
    const n = this.dest(t).length;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texte).then(
        () => this.etat.afficher(`${n} adresse(s) copiée(s).`, 'succes'),
        () => window.prompt('Copiez la liste :', texte),
      );
    } else window.prompt('Copiez la liste :', texte);
  }

  protected validationClient(t: TacheVue, el: HTMLInputElement): void {
    void this.etat.saisir((id) => this.api.validationClient(id, t.uid, el.value || null), { siErreur: this.remettre(el, lvValide(t) ?? '') });
  }

  // ---- ajouts et annulation

  protected modifierAjout(t: TacheVue, i: number, el: HTMLInputElement): void {
    const ancien = fJ(t.chargesA[i]);
    const n = lireNombre(el.value);
    const profil = this.vue()?.P[i];
    if (n == null || isNaN(n) || n <= 0 || !profil) {
      el.value = ancien;
      this.etat.afficher('Saisissez une charge positive. Pour retirer l’ajout, utilisez ✕.', 'erreur');
      return;
    }
    void this.etat.saisir((id) => this.api.modifierAjout(id, t.uid, profil.id, n), { siErreur: this.remettre(el, ancien) });
  }

  protected async retirerAjout(t: TacheVue, i: number): Promise<void> {
    const profil = this.vue()?.P[i];
    if (!profil) return;
    const ok = await this.etat.confirmer(
      'Retirer cet ajout ?',
      [
        `La charge ajoutée de ${fJ(t.chargesA[i])} JH pour « ${profil.nom} » sera retirée.${
          t.consoP[i] ? ` Le consommé déjà saisi (${fJ(t.consoP[i])} JH) est conservé.` : ''
        }`,
      ],
      'Retirer',
    );
    if (!ok) return;
    await this.etat.saisir((id) => this.api.retirerAjout(id, t.uid, profil.id));
  }

  /** Annule une réaffectation : la charge revient à la personne d'origine. */
  protected async annulerReaffectation(t: TacheVue, id: string): Promise<void> {
    const v = this.vue(),
      r = t.reaff.find((x) => x.id === id);
    if (!v || !r) return;
    const vers = v.P[r.vers]?.nom ?? '',
      de = v.P[r.de]?.nom ?? '';
    const conso = t.consoP[r.vers] ?? 0,
      reste = (t.charges[r.vers] ?? 0) - r.jh;
    // « Garder » plutôt qu'« Annuler » : deux boutons « Annuler… » prêteraient à confusion
    const choix = await this.etat.demander(
      'Annuler la réaffectation ?',
      [`Les ${fJ(r.jh)} JH confiés à ${vers} reviennent à ${de}.`],
      [
        { libelle: 'Garder', valeur: null },
        { libelle: 'Annuler la réaffectation', valeur: 'ok', principal: true },
      ],
      conso > reste + 1e-9 ? { note: `${vers} a déjà ${fJ(conso)} JH consommés sur cette tâche : ce temps reste saisi et apparaîtra en dépassement.` } : {},
    );
    if (choix !== 'ok') return;
    await this.etat.saisir((id2) => this.api.annulerReaffectation(id2, t.uid, id));
  }

  protected async retablir(t: TacheVue): Promise<void> {
    const ref = this.decisionAnnulation();
    const ok = await this.etat.confirmer(
      'Rétablir la tâche ?',
      [`« ${t.label} » retrouve sa charge de ${fJ(t.chargeInit)} JH et redevient saisissable.`],
      'Rétablir',
      ref ? { note: `La décision ${ref} reste dans le registre : passez-la à « Rejetée » si l’annulation est revenue sur.` } : {},
    );
    if (!ok) return;
    await this.etat.saisir((id) => this.api.retablir(id, t.uid));
  }

  protected async supprimer(t: TacheVue): Promise<void> {
    const ok = await this.etat.confirmer(
      'Supprimer cette tâche ajoutée ?',
      [`« ${t.label} » sera retirée du suivi${t.consoTotal ? `, avec ${fJ(t.consoTotal)} JH de consommé déjà saisis` : ''}.`],
      'Supprimer',
    );
    if (!ok) return;
    const r = await this.etat.saisir((id) => this.api.supprimerTache(id, t.uid));
    if (r) this.etat.fermerPanneau();
  }
}

/** Repères des tâches dans l'ordre affiché par l'onglet (filtres compris), hors blocs d'alerte. */
function listeAffichee(): string[] {
  const vus = new Set<string>();
  document.querySelectorAll<HTMLElement>('.suivi .s-panel [data-open]').forEach((b) => {
    if (b.closest('.todo, .al-row, [hidden]')) return;
    const u = b.dataset['open'];
    if (u) vus.add(u);
  });
  return [...vus];
}
