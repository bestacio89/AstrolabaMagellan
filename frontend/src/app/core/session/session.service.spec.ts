import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let session: SessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    session = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the current user and derives the display name and highest-priority role', async () => {
    const chargement = session.charger();
    const request = http.expectOne(`${environment.api}/moi`);
    expect(request.request.method).toBe('GET');
    request.flush({ prenom: 'Camille', nom: 'Martin', roles: ['ChefDeProjet', 'Pilotage'] });
    await chargement;

    expect(session.nomComplet()).toBe('Camille Martin');
    expect(session.libelleRole()).toBe('Pilotage');
    expect(session.aLeRole('Pilotage')).toBe(true);
    expect(session.aLeRole('Administrateur')).toBe(false);
  });

  it('uses consultant as the fallback role when the user has no known global role', async () => {
    const chargement = session.charger();
    http.expectOne(`${environment.api}/moi`).flush({ prenom: 'Sam', nom: 'Petit', roles: [] });
    await chargement;

    expect(session.libelleRole()).toBe('Consultant');
    expect(session.aLeRole('ChefDeProjet', 'Administrateur')).toBe(false);
  });

  it('clears the session if loading the current user fails', async () => {
    const chargement = session.charger();
    http.expectOne(`${environment.api}/moi`).flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await chargement;

    expect(session.moi()).toBeNull();
    expect(session.nomComplet()).toBe('');
    expect(session.libelleRole()).toBe('Consultant');
  });
});
