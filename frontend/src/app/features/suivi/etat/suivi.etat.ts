import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { messageErreur } from '../../../core/http/erreurs.interceptor';
import { MessageSaisie, ResultatSaisie, Suivi } from '../api/modeles';
import { NouveauFrais, SuiviApi } from '../api/suivi.api';
import { construireVue, Vue } from './vue';

/** Message court en bas d'écran, avec une action facultative (« Annuler », « La valider »…). */
export interface Toast {
  id: number;
  texte: string;
  ton: MessageSaisie['ton'];
  action: { libelle: string; executer: () => void } | null;
}

/** Fenêtre à ouvrir (une seule à la fois), demandée par un écran, le panneau de détail ou un message. */
export type FenetreDemandee =
  | { type: 'nouvelle-tache'; groupe: string | null }
  | { type: 'ajout-profil'; uid: string }
  | { type: 'reaffectation'; uid: string; de: number | null }
  | { type: 'annulation'; uid: string }
  | { type: 'bilan-ia'; uid: string }
  | { type: 'nouvel-achat' }
  | { type: 'nouveau-frais'; reprise: Partial<NouveauFrais> | null }
  | { type: 'import-frais' }
  | { type: 'lien-echeance'; numero: number }
  | { type: 'export-coproj' }
  | { type: 'reperes' };

/** Bouton d'une fenêtre de confirmation. */
export interface BoutonConfirmation<T> {
  libelle: string;
  valeur: T;
  principal?: boolean;
}

/** Demande de confirmation (texte simple, sans HTML). */
export interface Confirmation {
  titre: string;
  paragraphes: string[];
  liste?: string[];
  note?: string;
  boutons: BoutonConfirmation<string | null>[];
  repondre: (valeur: string | null) => void;
}

/** Options d'une saisie. */
export interface OptionsSaisie {
  /** Appelé si la saisie échoue (ex. remettre l'ancienne valeur dans le champ). */
  siErreur?: () => void;
  /** Appelé après une saisie réussie (avec le résultat). */
  siSucces?: (r: ResultatSaisie) => void;
  /** Action proposée sur le dernier message (ex. « Annuler » qui rétablit l'état précédent). */
  annuler?: { libelle: string; executer: () => void };
}


/** Valeur de « panneau » pour le détail de l'avancement (une tâche n'a jamais ce repère). */
export const PANNEAU_AVANCEMENT = 'av:';
/** Préfixe de « panneau » pour le détail d'une colonne de la cascade de la marge (Rentabilité). */
export const PANNEAU_MARGE = 'rt:';
/**
 * État de l'écran de suivi d'un projet, partagé par tous ses onglets, le panneau de détail et les fenêtres.
 * Chaque saisie est envoyée au serveur, qui applique les règles de gestion, enregistre et renvoie le suivi recalculé :
 * l'écran n'affiche donc jamais que des chiffres calculés par le serveur.
 * Les saisies sont envoyées l'une après l'autre (dans l'ordre), jamais en parallèle.
 */
@Injectable()
export class SuiviEtat {
  private readonly api = inject(SuiviApi);

  readonly projetId = signal('');
  readonly suivi = signal<Suivi | null>(null);
  readonly vue = computed<Vue | null>(() => {
    const s = this.suivi();
    return s ? construireVue(s) : null;
  });
  readonly chargement = signal(true);
  /** Message si le projet n'a pas pu être chargé. */
  readonly erreurChargement = signal<string | null>(null);
  /** Nombre de saisies en cours d'envoi. */
  readonly envois = signal(0);

  /** Panneau de détail ouvert : repère d'une tâche, « ph:<phase> », ou « av: » (détail de l'avancement du tableau de bord). */
  readonly panneau = signal<string | null>(null);
  /** Le panneau de phase a été ouvert depuis le détail de l'avancement : il propose d'y revenir. */
  readonly retourAvancement = signal(false);
  /** La tâche a été ouverte depuis le détail d'une colonne de la cascade : clé de la colonne, pour y revenir. */
  readonly retourMarge = signal<string | null>(null);
  readonly fenetre = signal<FenetreDemandee | null>(null);
  readonly confirmation = signal<Confirmation | null>(null);
  readonly toasts = signal<Toast[]>([]);
  /** Ligne à mettre en évidence (élément créé). */
  readonly ligneEnEvidence = signal<string | null>(null);

  private file: Promise<unknown> = Promise.resolve();
  private prochainToast = 1;

  async charger(id: string): Promise<void> {
    this.projetId.set(id);
    this.chargement.set(true);
    this.erreurChargement.set(null);
    try {
      this.suivi.set(await firstValueFrom(this.api.obtenir(id)));
    } catch (e) {
      this.suivi.set(null);
      this.erreurChargement.set(
        e instanceof HttpErrorResponse && (e.status === 404 || e.status === 403)
          ? 'Ce projet est introuvable, ou vous n’y avez pas accès.'
          : messageErreur(e),
      );
    } finally {
      this.chargement.set(false);
    }
  }

  /** Recharge le suivi (après une modification simultanée par exemple). */
  async recharger(): Promise<void> {
    try {
      this.suivi.set(await firstValueFrom(this.api.obtenir(this.projetId())));
    } catch (e) {
      this.afficher(messageErreur(e), 'erreur');
    }
  }

  /**
   * Envoie une saisie. Renvoie le résultat, ou null en cas d'erreur (message déjà affiché).
   * Exemple : etat.saisir(() => api.statut(id, uid, 'Validé'), { siErreur: () => (champ.value = ancien) })
   */
  saisir(appel: (projetId: string) => Observable<ResultatSaisie>, options: OptionsSaisie = {}): Promise<ResultatSaisie | null> {
    const execution = this.file.then(() => this.executer(appel, options));
    this.file = execution.catch(() => undefined);
    return execution;
  }

  private async executer(appel: (projetId: string) => Observable<ResultatSaisie>, options: OptionsSaisie): Promise<ResultatSaisie | null> {
    this.envois.update((n) => n + 1);
    try {
      const r = await firstValueFrom(appel(this.projetId()));
      this.suivi.set(r.suivi);
      this.afficherMessages(r.messages, options.annuler);
      if (r.ouvrir) this.ligneEnEvidence.set(r.ouvrir);
      options.siSucces?.(r);
      return r;
    } catch (e) {
      options.siErreur?.();
      this.afficher(messageErreur(e), 'erreur');
      // modification simultanée : on recharge la version à jour
      if (e instanceof HttpErrorResponse && e.status === 409) await this.recharger();
      return null;
    } finally {
      this.envois.update((n) => n - 1);
    }
  }

  // ---------------------------------------------------------------- messages

  /** Affiche un message court. */
  afficher(texte: string, ton: Toast['ton'] = 'info', action: Toast['action'] = null): void {
    const id = this.prochainToast++;
    // un seul message avec action à la fois ; trois messages au plus
    this.toasts.update((l) => [...l.filter((t) => !action || !t.action), { id, texte, ton, action }].slice(-3));
    const duree = action ? 7000 : ton === 'erreur' ? 9000 : Math.min(6000, Math.max(3000, texte.length * 40));
    setTimeout(() => this.retirerToast(id), duree);
  }

  retirerToast(id: number): void {
    this.toasts.update((l) => l.filter((t) => t.id !== id));
  }

  private afficherMessages(messages: MessageSaisie[], annuler?: OptionsSaisie['annuler']): void {
    messages.forEach((m, i) => {
      const action = m.action ? this.actionDuMessage(m) : i === messages.length - 1 && annuler ? annuler : null;
      this.afficher(m.texte, m.ton, action);
    });
    if (!messages.length && annuler) this.afficher('Modification enregistrée.', 'succes', annuler);
  }

  /** Suite proposée par un message du serveur. */
  private actionDuMessage(m: MessageSaisie): Toast['action'] {
    const libelle = m.libelleAction ?? 'OK';
    const cible = m.cible ?? '';
    switch (m.action) {
      case 'valider-tache':
        return { libelle, executer: () => void this.saisir((id) => this.api.statut(id, cible, 'Validé')) };
      case 'bilan-ia':
        return { libelle, executer: () => this.fenetre.set({ type: 'bilan-ia', uid: cible }) };
      case 'annuler-facture':
        return { libelle, executer: () => void this.saisir((id) => this.api.dateEcheance(id, +cible, 'realiseLe', null)) };
      case 'nouveau-frais':
        return { libelle, executer: () => this.fenetre.set({ type: 'nouveau-frais', reprise: this.repriseFrais }) };
      default:
        return null;
    }
  }

  /** Dernier frais saisi : « + Un autre » reprend sa date, son collaborateur, sa catégorie. */
  repriseFrais: Partial<NouveauFrais> | null = null;

  // ---------------------------------------------------------------- confirmation

  /** Demande une confirmation ; renvoie la valeur du bouton choisi (null : annulé). */
  demander(
    titre: string,
    paragraphes: string[],
    boutons: BoutonConfirmation<string | null>[],
    plus: { liste?: string[]; note?: string } = {},
  ): Promise<string | null> {
    return new Promise((resoudre) => {
      this.confirmation.set({
        titre,
        paragraphes,
        boutons,
        liste: plus.liste,
        note: plus.note,
        repondre: (v) => {
          this.confirmation.set(null);
          resoudre(v);
        },
      });
    });
  }

  /** Confirmation simple « Annuler / <action> ». */
  async confirmer(titre: string, paragraphes: string[], action: string, plus: { liste?: string[]; note?: string } = {}): Promise<boolean> {
    const r = await this.demander(titre, paragraphes, [{ libelle: 'Annuler', valeur: null }, { libelle: action, valeur: 'ok', principal: true }], plus);
    return r === 'ok';
  }

  // ---------------------------------------------------------------- versions
  // Lues au moment de l'envoi : une saisie mise en attente derrière une autre utilise la version à jour.

  versionTache(uid: string): number | undefined {
    return this.suivi()?.projet.tasks.find((t) => t.uid === uid)?.version;
  }

  versionEcheance(n: number): number | undefined {
    return this.suivi()?.projet.echTrack[String(n)]?.version;
  }

  versionProjet(): number | undefined {
    return this.suivi()?.projet.version;
  }

  versionLigne(registre: 'actions' | 'decisions' | 'risques' | 'achats' | 'frais', id: string): number | undefined {
    const p = this.suivi()?.projet;
    if (!p) return undefined;
    switch (registre) {
      case 'actions':
        return p.actions.find((x) => x.id === id)?.version;
      case 'decisions':
        return p.decisions.find((x) => x.id === id)?.version;
      case 'risques':
        return p.risques.find((x) => x.id === id)?.version;
      case 'achats':
        return p.achatsReel?.find((x) => x.id === id)?.version;
      case 'frais':
        return p.fraisReel?.find((x) => x.id === id)?.version;
    }
  }

  // ---------------------------------------------------------------- panneau de détail

  ouvrirTache(uid: string, retourMarge: string | null = null): void {
    this.retourAvancement.set(false);
    this.retourMarge.set(retourMarge);
    this.panneau.set(uid);
  }

  /** Détail d'une colonne de la cascade de la marge (Rentabilité). */
  ouvrirMarge(cle: string): void {
    this.retourAvancement.set(false);
    this.retourMarge.set(null);
    this.panneau.set(PANNEAU_MARGE + cle);
  }

  ouvrirPhase(phase: string, depuisAvancement = false): void {
    this.retourAvancement.set(depuisAvancement);
    this.retourMarge.set(null);
    this.panneau.set('ph:' + phase);
  }

  /** Détail de l'avancement par axe, lot ou phase (tableau de bord › « Détail »). */
  ouvrirAvancement(): void {
    this.retourAvancement.set(false);
    this.retourMarge.set(null);
    this.panneau.set(PANNEAU_AVANCEMENT);
  }

  fermerPanneau(): void {
    this.retourAvancement.set(false);
    this.retourMarge.set(null);
    this.panneau.set(null);
  }
}
