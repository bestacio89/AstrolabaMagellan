import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ERREUR_GEREE_PAR_L_ECRAN } from '../../../core/http/erreurs.interceptor';
import { Brouillon, BrouillonEnregistre, BrouillonResume, CreationBrouillon, Personne, TspSaisi } from './brouillons.modeles';

/**
 * Client de l'API des brouillons de projet (créer un projet en rédigeant son TSP).
 * Les erreurs sont affichées par l'écran lui-même (dans la fenêtre ou dans l'en-tête), pas en message en bas d'écran.
 */
@Injectable({ providedIn: 'root' })
export class BrouillonsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api}/brouillons`;
  private readonly contexte = new HttpContext().set(ERREUR_GEREE_PAR_L_ECRAN, true);

  lister(): Observable<BrouillonResume[]> {
    return this.http.get<BrouillonResume[]>(this.base);
  }

  creer(commande: CreationBrouillon): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.base, commande, { context: this.contexte });
  }

  importerTsp(fichier: File): Observable<{ id: string }> {
    const donnees = new FormData();
    donnees.append('fichier', fichier, fichier.name);
    return this.http.post<{ id: string }>(`${this.base}/import-tsp`, donnees, { context: this.contexte });
  }

  obtenir(id: string): Observable<Brouillon> {
    return this.http.get<Brouillon>(`${this.base}/${id}`, { context: this.contexte });
  }

  enregistrer(id: string, version: number, contenu: TspSaisi): Observable<BrouillonEnregistre> {
    return this.http.put<BrouillonEnregistre>(`${this.base}/${id}`, { version, contenu }, { context: this.contexte });
  }

  coRedacteur(id: string, email: string): Observable<{ coRedacteur: Personne | null; version: number }> {
    return this.http.put<{ coRedacteur: Personne | null; version: number }>(`${this.base}/${id}/co-redacteur`, { email }, { context: this.contexte });
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { context: this.contexte });
  }

  exporter(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/${id}/export`, { responseType: 'blob', observe: 'response', context: this.contexte });
  }

  lancer(id: string, version: number): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/${id}/lancement`, { version }, { context: this.contexte });
  }
}
