import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { ERREUR_GEREE_PAR_L_ECRAN } from '../core/http/erreurs.interceptor';
import { MoiApi, ProjetsApi } from './projets.api';

describe('ProjetsApi', () => {
  let api: ProjetsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ProjetsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists active projects without adding an archive filter', () => {
    api.lister().subscribe();
    const request = http.expectOne(`${environment.api}/projets`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush([]);
  });

  it('requests archived projects with an explicit query parameter', () => {
    api.lister(true).subscribe();
    const request = http.expectOne((r) => r.url === `${environment.api}/projets`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('archives')).toBe('true');
    request.flush([]);
  });

  it('sends the archive state using the project-specific endpoint', () => {
    api.archiver('project-42', true).subscribe();
    const request = http.expectOne(`${environment.api}/projets/project-42/archivage`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ archive: true });
    expect(request.request.context.get(ERREUR_GEREE_PAR_L_ECRAN)).toBe(true);
    request.flush(null);
  });

  it('sends the typed confirmation for permanent deletion', () => {
    api.supprimer('project-42', 'Projet à supprimer').subscribe();
    const request = http.expectOne(`${environment.api}/projets/project-42/suppression`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ confirmation: 'Projet à supprimer' });
    expect(request.request.context.get(ERREUR_GEREE_PAR_L_ECRAN)).toBe(true);
    request.flush(null);
  });

  it('uploads the selected TSP file as multipart form data', () => {
    const fichier = new File(['contenu'], 'projet.tsp', { type: 'application/octet-stream' });
    api.apercuTsp(fichier).subscribe();
    const request = http.expectOne(`${environment.api}/projets/import-tsp/apercu`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    const fichierEnvoye = (request.request.body as FormData).get('fichier');
    expect(fichierEnvoye).toBeInstanceOf(File);
    expect((fichierEnvoye as File).name).toBe(fichier.name);
    expect(request.request.context.get(ERREUR_GEREE_PAR_L_ECRAN)).toBe(true);
    request.flush({});
  });
});

describe('MoiApi', () => {
  it('loads the current-user contract from the API', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(MoiApi).obtenir().subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${environment.api}/moi`);
    expect(request.request.method).toBe('GET');
    request.flush({ prenom: 'Camille', nom: 'Martin', roles: [] });
    TestBed.inject(HttpTestingController).verify();
  });
});
