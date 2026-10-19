import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { ERREUR_GEREE_PAR_L_ECRAN } from '../../../core/http/erreurs.interceptor';
import { SuiviApi } from './suivi.api';

describe('SuiviApi', () => {
  let api: SuiviApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(SuiviApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads a project tracking document and marks errors as screen-managed', () => {
    api.obtenir('project-42').subscribe();
    const request = http.expectOne(`${environment.api}/projets/project-42/suivi`);
    expect(request.request.method).toBe('GET');
    expect(request.request.context.get(ERREUR_GEREE_PAR_L_ECRAN)).toBe(true);
    request.flush({});
  });

  it('encodes task updates in the expected endpoint and payload', () => {
    api.statut('project-42', 'task-7', 'Validé', 3).subscribe();
    const request = http.expectOne(`${environment.api}/projets/project-42/taches/task-7/statut`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ statut: 'Validé', version: 3 });
    expect(request.request.context.get(ERREUR_GEREE_PAR_L_ECRAN)).toBe(true);
    request.flush({});
  });

  it('routes weekly and monthly reporting keys to their respective endpoints', () => {
    api.pointHebdo('project-42', 'S:2026-10-05', { actualites: [], attention: [], indicateurs: {}, extension: 'Non' }).subscribe();
    const semaine = http.expectOne(`${environment.api}/projets/project-42/points-hebdo/semaines/2026-10-05`);
    expect(semaine.request.method).toBe('PUT');
    expect(semaine.request.body.genere).toBe(false);
    semaine.flush({});

    api.pointHebdo('project-42', 'M:2026-10', { actualites: [], attention: [], indicateurs: {}, extension: 'Non' }, true).subscribe();
    const mois = http.expectOne(`${environment.api}/projets/project-42/points-hebdo/mois/2026-10`);
    expect(mois.request.method).toBe('PUT');
    expect(mois.request.body.genere).toBe(true);
    mois.flush({});
  });

  it('URL-encodes phase names that contain spaces or accents', () => {
    api.echeancePhase('project-42', 'CONCEPTION & étude', 2).subscribe();
    const request = http.expectOne(`${environment.api}/projets/project-42/phases/CONCEPTION%20%26%20%C3%A9tude/echeance`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ numero: 2 });
    request.flush({});
  });
});
