import { HttpResponse } from '@angular/common/http';
import { messageErreur } from '../../../core/http/erreurs.interceptor';

/** Propose le fichier reçu au téléchargement (nom donné par le serveur). */
export function telecharger(reponse: HttpResponse<Blob>, nomParDefaut: string): void {
  const blob = reponse.body;
  if (!blob) return;
  const entete = reponse.headers.get('Content-Disposition') ?? '';
  const etoile = /filename\*=UTF-8''([^;]+)/i.exec(entete);
  const simple = /filename="?([^";]+)"?/i.exec(entete);
  const nom = etoile ? decodeURIComponent(etoile[1]) : simple ? simple[1] : nomParDefaut;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
}

/** Message d'une erreur d'export (la réponse d'erreur arrive sous forme de fichier : on la relit). */
export async function messageErreurFichier(e: unknown): Promise<string> {
  const corps = (e as { error?: unknown })?.error;
  if (corps instanceof Blob) {
    try {
      const probleme = JSON.parse(await corps.text()) as { detail?: string; title?: string };
      if (probleme.detail || probleme.title) return probleme.detail ?? probleme.title ?? '';
    } catch {
      /* réponse illisible : message générique */
    }
  }
  return messageErreur(e);
}

/** Propose au téléchargement un fichier fabriqué dans le navigateur (ex. PowerPoint du point hebdo). */
export function telechargerFichier(blob: Blob, nom: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
}
