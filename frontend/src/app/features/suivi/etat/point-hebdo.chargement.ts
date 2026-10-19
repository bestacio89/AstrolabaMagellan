import { ConstructeurPresentation } from './point-hebdo.diapo';

/**
 * Chargements à la demande de l'écran Point hebdo (fichiers du dossier public, servis avec l'application) :
 * - PptxGenJS (environ 450 Ko), seulement au moment de fabriquer le PowerPoint ;
 * - le logo de l'entreprise par défaut, mis sous forme d'image intégrée pour la diapositive.
 * PptxGenJS est livré tel quel (licence MIT) plutôt qu'installé par npm : sa version « module » importe des modules
 * de Node.js que la construction pour le navigateur ne sait pas toujours écarter.
 */
let pptx: Promise<ConstructeurPresentation> | null = null;
let logo: Promise<string | null> | null = null;

const adresse = (chemin: string): string => new URL(chemin, document.baseURI).href;

/** PptxGenJS, chargé une seule fois. */
export function chargerPptxGen(): Promise<ConstructeurPresentation> {
  const deja = (window as unknown as { PptxGenJS?: ConstructeurPresentation }).PptxGenJS;
  if (deja) return Promise.resolve(deja);
  pptx ??= new Promise<ConstructeurPresentation>((ok, ko) => {
    const s = document.createElement('script');
    s.src = adresse('vendor/pptxgen.bundle.js');
    s.async = true;
    s.onload = () => {
      const c = (window as unknown as { PptxGenJS?: ConstructeurPresentation }).PptxGenJS;
      if (c) ok(c);
      else ko(new Error('PptxGenJS absent'));
    };
    s.onerror = () => {
      pptx = null; // nouvel essai possible
      ko(new Error('PptxGenJS introuvable'));
    };
    document.head.appendChild(s);
  });
  return pptx;
}

/** Logo de l'entreprise par défaut (image intégrée), ou null s'il ne peut pas être lu. */
export function logoEntrepriseParDefaut(): Promise<string | null> {
  logo ??= fetch(adresse('point-hebdo/logo-entreprise.png'))
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then(lireEnImage)
    .catch(() => null);
  return logo;
}

const lireEnImage = (b: Blob): Promise<string> =>
  new Promise((ok, ko) => {
    const l = new FileReader();
    l.onload = () => ok(String(l.result));
    l.onerror = () => ko(new Error('lecture'));
    l.readAsDataURL(b);
  });

/** Réduit une image (logo choisi par l'utilisateur) à 480 px au plus et la convertit en PNG intégré. */
export function reduireLogo(fichier: File): Promise<string> {
  return lireEnImage(fichier).then(
    (src) =>
      new Promise<string>((ok, ko) => {
        const img = new Image();
        img.onerror = () => ko(new Error('image'));
        img.onload = () => {
          const l = img.naturalWidth || 480, h = img.naturalHeight || 480, k = Math.min(1, 480 / Math.max(l, h));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(l * k));
          cv.height = Math.max(1, Math.round(h * k));
          cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
          ok(cv.toDataURL('image/png'));
        };
        img.src = src;
      }),
  );
}
