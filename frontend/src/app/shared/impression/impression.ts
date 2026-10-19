/**
 * Impression (ou enregistrement en PDF) d'une partie de l'écran : la barre latérale, l'en-tête et les boutons sont masqués,
 * la page est en paysage. Les règles sont dans src/styles.scss (« Impression »), selon la valeur de data-impression.
 * - « tableau » : le tableau de bord tel qu'affiché, daté (« Situation au … »).
 */
export type ModeImpression = 'tableau';

export function imprimer(mode: ModeImpression): void {
  const racine = document.documentElement;
  racine.dataset['impression'] = mode;
  const nettoyer = () => {
    delete racine.dataset['impression'];
    window.removeEventListener('afterprint', nettoyer);
  };
  window.addEventListener('afterprint', nettoyer);
  window.print();
}
