import { ReglagesPointHebdo, SaisiePeriode } from '../etat/point-hebdo.logique';
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ERREUR_GEREE_PAR_L_ECRAN } from '../../../core/http/erreurs.interceptor';
import { ResultatSaisie, Suivi } from './modeles';

/** Saisie générique d'un champ de registre (action, décision, risque, achat, frais). */
export interface Champ {
  champ: string;
  valeur: string | null;
  version?: number | null;
}

/**
 * Client de l'API de l'écran de suivi : une méthode par saisie de la version de référence.
 * Chaque saisie renvoie le suivi recalculé et les messages à afficher.
 * Les erreurs sont gérées par l'état du suivi (message, retour à la valeur précédente) : pas de message automatique.
 */
@Injectable({ providedIn: 'root' })
export class SuiviApi {
  private readonly http = inject(HttpClient);
  private readonly contexte = new HttpContext().set(ERREUR_GEREE_PAR_L_ECRAN, true);

  private base(id: string): string {
    return `${environment.api}/projets/${id}`;
  }

  private put(id: string, chemin: string, corps: unknown): Observable<ResultatSaisie> {
    return this.http.put<ResultatSaisie>(`${this.base(id)}/${chemin}`, corps, { context: this.contexte });
  }

  private post(id: string, chemin: string, corps: unknown = {}): Observable<ResultatSaisie> {
    return this.http.post<ResultatSaisie>(`${this.base(id)}/${chemin}`, corps, { context: this.contexte });
  }

  private supprimer(id: string, chemin: string): Observable<ResultatSaisie> {
    return this.http.delete<ResultatSaisie>(`${this.base(id)}/${chemin}`, { context: this.contexte });
  }

  obtenir(id: string): Observable<Suivi> {
    return this.http.get<Suivi>(`${this.base(id)}/suivi`, { context: this.contexte });
  }

  // ---- tâches ----
  statut(id: string, uid: string, statut: string, version?: number) {
    return this.put(id, `taches/${uid}/statut`, { statut, version });
  }
  avancement(id: string, uid: string, avancement: number, version?: number) {
    return this.put(id, `taches/${uid}/avancement`, { avancement, version });
  }
  resteAFaire(id: string, uid: string, raf: number | null, version?: number) {
    return this.put(id, `taches/${uid}/reste-a-faire`, { raf, version });
  }
  dates(id: string, uid: string, debut: string | null, fin: string | null, version?: number) {
    return this.put(id, `taches/${uid}/dates`, { debut, fin, version });
  }
  libelle(id: string, uid: string, libelle: string, version?: number) {
    return this.put(id, `taches/${uid}/libelle`, { libelle, version });
  }
  commentaire(id: string, uid: string, commentaire: string, version?: number) {
    return this.put(id, `taches/${uid}/commentaire`, { commentaire, version });
  }
  classement(id: string, uid: string, champ: 'type' | 'axe' | 'phase' | 'lot', valeur: string, version?: number) {
    return this.put(id, `taches/${uid}/classement`, { champ, valeur, version });
  }
  bilanIa(id: string, uid: string, iaType: string, iaJustif: string, version?: number) {
    return this.put(id, `taches/${uid}/bilan-ia`, { iaType, iaJustif, version });
  }
  echeanceTache(id: string, uid: string, numero: number | null, version?: number) {
    return this.put(id, `taches/${uid}/echeance`, { numero, version });
  }
  consomme(id: string, uid: string, profilId: string, jour: string, jh: number | null) {
    return this.put(id, `taches/${uid}/consomme`, { profilId, jour, jh });
  }

  // ---- périmètre ----
  annuler(id: string, uid: string, motif: string, avenant: boolean, enregistrerDecision: boolean, version?: number) {
    return this.post(id, `taches/${uid}/annulation`, { motif, avenant, enregistrerDecision, version });
  }
  retablir(id: string, uid: string) {
    return this.supprimer(id, `taches/${uid}/annulation`);
  }
  nouvelleTache(id: string, commande: NouvelleTache) {
    return this.post(id, 'taches', commande);
  }
  supprimerTache(id: string, uid: string) {
    return this.supprimer(id, `taches/${uid}`);
  }
  ajouterProfil(id: string, uid: string, commande: AjoutProfil) {
    return this.post(id, `taches/${uid}/profils`, commande);
  }
  modifierAjout(id: string, uid: string, profilId: string, jh: number) {
    return this.put(id, `taches/${uid}/profils/${profilId}`, { jh });
  }
  retirerAjout(id: string, uid: string, profilId: string) {
    return this.supprimer(id, `taches/${uid}/profils/${profilId}`);
  }
  // ---- point hebdo ----
  pointHebdo(id: string, cle: string, saisie: SaisiePeriode, genere = false) {
    const chemin = cle.startsWith('M:') ? `points-hebdo/mois/${cle.slice(2)}` : `points-hebdo/semaines/${cle.slice(2)}`;
    return this.put(id, chemin, { ...saisie, genere });
  }
  reglagePointHebdo(id: string, champ: keyof ReglagesPointHebdo, valeur: string) {
    return this.put(id, `points-hebdo/reglages/${champ}`, { valeur });
  }
  reaffecter(id: string, uid: string, commande: Reaffecter) {
    return this.post(id, `taches/${uid}/reaffectations`, commande);
  }
  annulerReaffectation(id: string, uid: string, reaffectationId: string) {
    return this.supprimer(id, `taches/${uid}/reaffectations/${reaffectationId}`);
  }

  // ---- ateliers et livrables ----
  dateAtelier(id: string, uid: string, date: string | null) {
    return this.put(id, `taches/${uid}/atelier/date`, { date });
  }
  horaireAtelier(id: string, uid: string, heureDebut: string | null, heureFin: string | null) {
    return this.put(id, `taches/${uid}/atelier/horaire`, { heureDebut, heureFin });
  }
  invitation(id: string, uid: string, envoyee: boolean) {
    return this.put(id, `taches/${uid}/atelier/invitation`, { envoyee });
  }
  dateInvitation(id: string, uid: string, date: string | null) {
    return this.put(id, `taches/${uid}/atelier/invitation/date`, { date });
  }
  destinataires(id: string, uid: string, liste: string[]) {
    return this.put(id, `taches/${uid}/atelier/destinataires`, { liste });
  }
  validationClient(id: string, uid: string, valideLe: string | null) {
    return this.put(id, `taches/${uid}/livrable`, { valideLe });
  }
  lienLivrable(id: string, uid: string, lien: string | null) {
    return this.put(id, `taches/${uid}/livrable/lien`, { lien });
  }
  miseAJour(id: string, uid: string, texte: string) {
    return this.post(id, `taches/${uid}/mises-a-jour`, { texte });
  }

  // ---- planning de référence ----
  figerReference(id: string, libelle: string | null) {
    return this.post(id, 'references', { libelle });
  }
  derive(id: string, referenceId: string, uid: string, cause: string | null, motif: string | null, version?: number) {
    return this.put(id, `references/${referenceId}/taches/${uid}/derive`, { cause, motif, version });
  }

  // ---- facturation ----
  dateEcheance(id: string, n: number, champ: 'datePrevue' | 'realiseLe' | 'payeeLe', valeur: string | null, version?: number) {
    return this.put(id, `echeances/${n}/dates`, { champ, valeur, version });
  }
  perimetreEcheance(id: string, n: number, phases: string[], taches: string[]) {
    return this.put(id, `echeances/${n}/perimetre`, { phases, taches });
  }
  echeancePhase(id: string, phase: string, numero: number | null) {
    return this.put(id, `phases/${encodeURIComponent(phase)}/echeance`, { numero });
  }

  // ---- registres et dépenses ----
  creer(id: string, registre: Registre) {
    return this.post(id, registre);
  }
  modifier(id: string, registre: Registre | 'achats' | 'frais', ligne: string, champ: Champ) {
    return this.put(id, `${registre}/${ligne}`, champ);
  }
  supprimerLigne(id: string, registre: Registre | 'achats' | 'frais', ligne: string) {
    return this.supprimer(id, `${registre}/${ligne}`);
  }
  restaurerAction(id: string, action: string, statut: string, progression: number, faitLe: string | null) {
    return this.put(id, `actions/${action}/restaurer`, { statut, progression, faitLe });
  }
  nouvelAchat(id: string, achat: NouvelAchat) {
    return this.post(id, 'achats', achat);
  }
  nouveauFrais(id: string, frais: NouveauFrais) {
    return this.post(id, 'frais', frais);
  }

  // ---- paramètres ----
  regroupement(id: string, groupBy: string) {
    return this.put(id, 'parametres/regroupement', { groupBy });
  }
  alerte(id: string, champ: string, jours: number) {
    return this.put(id, 'parametres/alertes', { champ, jours });
  }
  profilIa(id: string, profilId: string | null) {
    return this.put(id, 'parametres/profil-ia', { profilId });
  }
  listeIa(id: string, liste: 'leviers-ia' | 'causes-ia', valeurs: string[]) {
    return this.put(id, `parametres/${liste}`, { valeurs });
  }
  dateProjet(id: string, champ: 'debut' | 'finContrat' | 'finPrevue', valeur: string | null, version?: number) {
    return this.put(id, 'parametres/dates', { champ, valeur, version });
  }
  nomAxe(id: string, code: string, nom: string) {
    return this.put(id, `axes/${encodeURIComponent(code)}/nom`, { nom });
  }
  fiche(id: string, champ: 'client' | 'projet' | 'reference', valeur: string, version?: number) {
    return this.put(id, 'fiche', { champ, valeur, version });
  }
  ajouterType(id: string, nom: string) {
    return this.post(id, 'types', { nom });
  }
  renommerType(id: string, code: string, nom: string) {
    return this.put(id, `types/${encodeURIComponent(code)}`, { nom });
  }
  supprimerType(id: string, code: string) {
    return this.supprimer(id, `types/${encodeURIComponent(code)}`);
  }

  // ---- exports ----
  copil(id: string): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.base(id)}/exports/copil`, {}, { responseType: 'blob', observe: 'response', context: this.contexte });
  }
  coproj(id: string, du: string, au: string, horizon: number): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.base(id)}/exports/coproj`, { du, au, horizon }, { responseType: 'blob', observe: 'response', context: this.contexte });
  }
}

export type Registre = 'actions' | 'decisions' | 'risques';

export interface NouveauProfil {
  nom: string;
  entite: string;
  tjm: number;
  cjm: number;
  collaborateur: string;
}

export interface NouvelleTache {
  label: string;
  axe: string;
  lot: string;
  phase: string;
  etape: string;
  type: string;
  debut: string | null;
  fin: string | null;
  charges: { profilId: string; jh: number }[];
  nouveauProfil: NouveauProfil | null;
  nouveauProfilJh: number | null;
  motif: string;
  hypothese: string;
  apres: string | null;
}

export interface AjoutProfil {
  profilId: string | null;
  nouveauProfil: NouveauProfil | null;
  jh: number;
  motif: string;
}

/** Réaffecter : vers une personne du projet (versProfilId) ou une nouvelle personne du même rôle (collaborateur, tjm, cjm). */
export interface Reaffecter {
  deProfilId: string;
  versProfilId: string | null;
  collaborateur: string | null;
  tjm: number | null;
  cjm: number | null;
  jh: number;
  motif: string;
}

export interface NouvelAchat {
  date: string;
  ligne: number | null;
  designation: string;
  fournisseur: string;
  qte: number;
  cu: number;
  refacture: number;
  statut: string;
  commentaire: string;
}

export interface NouveauFrais {
  date: string;
  collaborateur: string;
  categorie: string;
  libelle: string;
  montant: number;
  refacturable: boolean;
  commentaire: string;
}
