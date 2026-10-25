/** Libellé de présentation d'un lot ; le code reste la référence fonctionnelle des tâches. */
export function libelleLot(code: string | null | undefined, nom?: string | null): string {
  if (!code) return 'Sans lot';
  const personnalise = nom?.trim();
  if (code === '0') return `Lot 0 – ${personnalise || 'Pilotage'}`;
  return personnalise ? `Lot ${code} – ${personnalise}` : `Lot ${code}`;
}
