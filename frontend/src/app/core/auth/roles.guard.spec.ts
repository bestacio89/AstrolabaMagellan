import { Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SessionService } from '../session/session.service';
import { exigerRoles } from './roles.guard';

describe('exigerRoles', () => {
  it('allows matching roles without redirecting', () => {
    const session = { aLeRole: vi.fn(() => true) };
    const router = { createUrlTree: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: session },
        { provide: Router, useValue: router },
      ],
    });

    const resultat = TestBed.runInInjectionContext(() => exigerRoles('Administrateur', 'Pilotage')({} as Route, [] as UrlSegment[]));
    expect(resultat).toBe(true);
    expect(session.aLeRole).toHaveBeenCalledWith('Administrateur', 'Pilotage');
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to the project list when no requested role is present', () => {
    const destination = {} as UrlTree;
    const session = { aLeRole: vi.fn(() => false) };
    const router = { createUrlTree: vi.fn(() => destination) };
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: session },
        { provide: Router, useValue: router },
      ],
    });

    const resultat = TestBed.runInInjectionContext(() => exigerRoles('Administrateur')({} as Route, [] as UrlSegment[]));
    expect(resultat).toBe(destination);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/projets']);
  });
});
