import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { messageErreur } from '../../../core/http/erreurs.interceptor';
import { BrouillonsApi } from '../api/brouillons.api';
import { AnalyseBrouillon, Brouillon, TspSaisi } from '../api/brouillons.modeles';

/** Où en est l'enregistrement : rien à enregistrer, modifications en attente, envoi en cours, erreur, ou conflit. */
export type StatutEnregistrement = 'enregistre' | 'modifie' | 'envoi' | 'erreur' | 'conflit';

/** Délai sans saisie avant l'enregistrement automatique. */
const DELAI_ENREGISTREMENT = 700;

/**
 * État du brouillon ouvert (un exemplaire par écran de rédaction) :
 * - le contenu du TSP, modifié par les rubriques via « modifier » ;
 * - l'enregistrement automatique (après une courte pause de saisie, un envoi à la fois, le dernier contenu l'emporte) ;
 * - l'analyse renvoyée par le serveur (chiffres clés, contrôles, état des rubriques) après chaque enregistrement.
 */
@Injectable()
export class BrouillonEtat {
  private readonly api = inject(BrouillonsApi);

  readonly brouillon = signal<Brouillon | null>(null);
  readonly contenu = signal<TspSaisi | null>(null);
  readonly analyse = signal<AnalyseBrouillon | null>(null);
  readonly statut = signal<StatutEnregistrement>('enregistre');
  readonly erreur = signal('');
  readonly enregistreLe = signal<Date | null>(null);
  readonly chargement = signal(true);
  readonly erreurChargement = signal('');

  private version = 0;
  private minuterie: ReturnType<typeof setTimeout> | null = null;
  private envoiEnCours: Promise<void> | null = null;
  private aRenvoyer = false;

  /** Nom affiché du projet en cours de rédaction. */
  readonly titre = computed(() => {
    const f = this.contenu()?.fiche;
    return [f?.client, f?.projet].filter((x) => x?.trim()).join(' — ') || 'Nouveau projet';
  });

  async charger(id: string): Promise<void> {
    this.chargement.set(true);
    this.erreurChargement.set('');
    try {
      const b = await firstValueFrom(this.api.obtenir(id));
      this.brouillon.set(b);
      this.contenu.set(b.contenu);
      this.analyse.set(b.analyse);
      this.version = b.version;
      this.statut.set('enregistre');
      this.erreur.set('');
      this.enregistreLe.set(new Date(b.modifieLe));
    } catch (e) {
      this.erreurChargement.set(messageErreur(e));
    } finally {
      this.chargement.set(false);
    }
  }

  /** Modifie le TSP (sur une copie : les écrans voient un nouvel objet) et programme l'enregistrement automatique. */
  modifier(modification: (tsp: TspSaisi) => void): void {
    const actuel = this.contenu();
    if (!actuel || this.statut() === 'conflit') return;
    const copie = structuredClone(actuel);
    modification(copie);
    this.contenu.set(copie);
    this.statut.set('modifie');
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => void this.envoyer(), DELAI_ENREGISTREMENT);
  }

  /** Enregistre tout de suite ce qui est en attente (avant un export, un lancement, ou en quittant l'écran). Vrai si tout est enregistré. */
  async enregistrerMaintenant(): Promise<boolean> {
    if (this.minuterie) {
      clearTimeout(this.minuterie);
      this.minuterie = null;
    }
    if (this.statut() === 'modifie' || this.statut() === 'erreur') await this.envoyer();
    while (this.envoiEnCours) await this.envoiEnCours;
    return this.statut() === 'enregistre';
  }

  /** Version lue (à envoyer avec le lancement : on lance exactement ce qui a été vu). */
  versionCourante(): number {
    return this.version;
  }

  /** Nouvelle version donnée par le serveur après une action sur le brouillon (ex. invitation d'un co-rédacteur). */
  adopterVersion(version: number): void {
    this.version = version;
  }

  private envoyer(): Promise<void> {
    if (this.envoiEnCours) {
      this.aRenvoyer = true;
      return this.envoiEnCours;
    }
    this.envoiEnCours = this.envoi().finally(() => {
      this.envoiEnCours = null;
      if (this.aRenvoyer) {
        this.aRenvoyer = false;
        void this.envoyer();
      }
    });
    return this.envoiEnCours;
  }

  private async envoi(): Promise<void> {
    const b = this.brouillon();
    const contenu = this.contenu();
    if (!b || !contenu) return;
    this.minuterie = null;
    this.statut.set('envoi');
    try {
      const r = await firstValueFrom(this.api.enregistrer(b.id, this.version, contenu));
      this.version = r.version;
      this.analyse.set(r.analyse);
      this.enregistreLe.set(new Date());
      this.erreur.set('');
      // modifié pendant l'envoi : un nouvel envoi suit
      this.statut.set(this.aRenvoyer || this.minuterie ? 'modifie' : 'enregistre');
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        this.statut.set('conflit');
        this.aRenvoyer = false;
      } else this.statut.set('erreur');
      this.erreur.set(messageErreur(e));
    }
  }
}
