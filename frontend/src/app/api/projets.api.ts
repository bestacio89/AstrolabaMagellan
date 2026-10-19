import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ERREUR_GEREE_PAR_L_ECRAN } from '../core/http/erreurs.interceptor';
import { ApercuImport, Moi, ProjetDetail, ProjetResume } from './modeles';

/**
 * Client de l'API : une méthode par point d'entrée, sans logique d'écran.
 * (Les écrans passent par leur « état », qui appelle ce client.)
 */
@Injectable({ providedIn: 'root' })
export class ProjetsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api}/projets`;

  /** Projets visibles ; « archives » : seulement les projets archivés. */
  lister(archives = false): Observable<ProjetResume[]> {
    return this.http.get<ProjetResume[]>(this.base, archives ? { params: { archives: 'true' } } : {});
  }

  /** Archive (true) ou restaure (false) un projet. */
  archiver(id: string, archive: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/archivage`, { archive }, { context: this.erreurGereeParLEcran() });
  }

  /** Supprime définitivement un projet créé par erreur ; « confirmation » = le nom du projet retapé. */
  supprimer(id: string, confirmation: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/suppression`, { confirmation }, { context: this.erreurGereeParLEcran() });
  }

  obtenir(id: string): Observable<ProjetDetail> {
    return this.http.get<ProjetDetail>(`${this.base}/${id}`);
  }

  /**
   * Aperçu d'un TSP avant son import (dans un brouillon : voir BrouillonsApi). L'erreur est affichée dans la fenêtre ouverte.
   */
  apercuTsp(fichier: File): Observable<ApercuImport> {
    return this.http.post<ApercuImport>(`${this.base}/import-tsp/apercu`, this.formulaire(fichier), {
      context: this.erreurGereeParLEcran(),
    });
  }

  private erreurGereeParLEcran(): HttpContext {
    return new HttpContext().set(ERREUR_GEREE_PAR_L_ECRAN, true);
  }

  private formulaire(fichier: File): FormData {
    const donnees = new FormData();
    donnees.append('fichier', fichier, fichier.name);
    return donnees;
  }
}

@Injectable({ providedIn: 'root' })
export class MoiApi {
  private readonly http = inject(HttpClient);

  obtenir(): Observable<Moi> {
    return this.http.get<Moi>(`${environment.api}/moi`);
  }

  /** Mes absences entre deux dates incluses (elles valent pour tous mes projets). */
  absences(du: string, au: string): Observable<MonAbsence[]> {
    return this.http.get<MonAbsence[]>(`${environment.api}/moi/absences`, { params: { du, au } });
  }

  /** Mon absence un jour (moment vide : présent) ; renvoie mes absences du mois de ce jour. */
  absence(jour: string, moment: '' | 'j' | 'm' | 'a'): Observable<MonAbsence[]> {
    return this.http.put<MonAbsence[]>(`${environment.api}/moi/absences`, { jour, moment });
  }
}

/** Une de mes absences : « j » journée, « m » matin, « a » après-midi. */
export interface MonAbsence {
  jour: string;
  moment: 'j' | 'm' | 'a';
}
