import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { messageErreur } from './erreurs.interceptor';

describe('messageErreur', () => {
  it('maps connectivity and authorization failures to actionable messages', () => {
    expect(messageErreur(new HttpErrorResponse({ status: 0 }))).toContain('serveur ne répond pas');
    expect(messageErreur(new HttpErrorResponse({ status: 401 }))).toContain('session a expiré');
    expect(messageErreur(new HttpErrorResponse({ status: 403 }))).toContain('pas le droit');
    expect(messageErreur(new HttpErrorResponse({ status: 404 }))).toBe('Élément introuvable.');
  });

  it('prefers validation details and problem details over a generic fallback', () => {
    expect(messageErreur(new HttpErrorResponse({ status: 400, error: { errors: { nom: ['Le nom est requis.'] } } }))).toBe('Le nom est requis.');
    expect(messageErreur(new HttpErrorResponse({ status: 422, error: { detail: 'La période est invalide.' } }))).toBe('La période est invalide.');
    expect(messageErreur(new HttpErrorResponse({ status: 500, error: { title: 'Erreur serveur.' } }))).toBe('Erreur serveur.');
    expect(messageErreur(new Error('unexpected'))).toContain('inattendue');
  });
});
