/** Initiales lisibles pour les pastilles de participants des ateliers. */
export function initialesParticipant(valeur: string): string {
  const local = valeur.trim().split('@', 1)[0] ?? '';
  const morceaux = local.replace(/[._-]+/g, ' ').split(/\s+/u).filter(Boolean);
  if (morceaux.length === 0) return '??';
  const initiales = morceaux.length > 1
    ? Array.from(morceaux[0])[0] + Array.from(morceaux[1])[0]
    : Array.from(morceaux[0]).slice(0, 2).join('');
  return initiales.toLocaleUpperCase('fr-FR');
}
