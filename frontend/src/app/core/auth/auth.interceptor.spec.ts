import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

function configurer(auth: Pick<AuthService, 'modeDev' | 'utilisateurDev' | 'jeton'>): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('authInterceptor', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('adds the selected development identity only to API requests', () => {
    const auth = {
      modeDev: true,
      utilisateurDev: signal('consultant'),
      jeton: vi.fn().mockResolvedValue(null),
    } as unknown as AuthService;
    const http = configurer(auth);
    const client = TestBed.inject(HttpClient);

    client.get('/api/projets').subscribe();
    const apiRequest = http.expectOne('/api/projets');
    expect(apiRequest.request.headers.get('X-Utilisateur-Dev')).toBe('consultant');
    apiRequest.flush([]);

    client.get('/assets/logo.png').subscribe();
    const assetRequest = http.expectOne('/assets/logo.png');
    expect(assetRequest.request.headers.has('X-Utilisateur-Dev')).toBe(false);
    assetRequest.flush({});
  });

  it('adds a bearer token in Entra mode', async () => {
    const auth = {
      modeDev: false,
      utilisateurDev: signal('chef'),
      jeton: vi.fn().mockResolvedValue('access-token'),
    } as unknown as AuthService;
    const http = configurer(auth);
    const client = TestBed.inject(HttpClient);

    client.get(`${environment.api}/moi`).subscribe();
    // The interceptor awaits the token promise before forwarding the request.
    let requests: ReturnType<HttpTestingController['match']> = [];
    await vi.waitFor(() => {
      requests = http.match(`${environment.api}/moi`);
      expect(requests).toHaveLength(1);
    });
    const request = requests[0];
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush({ prenom: 'Camille', nom: 'Martin', roles: [] });
    expect(auth.jeton).toHaveBeenCalledOnce();
  });
});
