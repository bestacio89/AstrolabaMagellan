import { Suivi } from '../suivi/api/modeles';
import { mentionne } from '../suivi/etat/fil.logique';

/**
 * « Mon travail » : ce qui est confié à la personne connectée, sur tous ses projets.
 *
 * Lien entre la personne et le projet (version actuelle) : par son NOM — prénom et nom saisis comme collaborateur
 * d'un profil du TSP, ou comme porteur d'une action. Quand chaque profil sera relié à un compte (la colonne existe
 * déjà en base : ProfilsProjet.UtilisateurId), ce lien se fera par le compte et ce fichier sera le seul à changer.
 *
 * Fonctions simples, testées sans navigateur (travail.logique.spec.ts). Aucun calcul de gestion : on trie et on regroupe.
 */

export interface Personne {
  prenom: string;
  nom: string;
}

/** Texte simplifié pour comparer des noms : sans accents, en minuscules, espaces et ponctuation réduits. */
export function simplifier(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Le texte désigne-t-il cette personne ? Il faut y trouver son prénom ET son nom (dans n'importe quel ordre) :
 * un prénom seul est trop ambigu dans une équipe.
 */
export function designe(texte: string | null | undefined, moi: Personne): boolean {
  if (!texte || !moi.prenom.trim() || !moi.nom.trim()) return false;
  const mots = new Set(simplifier(texte).split(' '));
  const prenom = simplifier(moi.prenom).split(' ');
  const nom = simplifier(moi.nom).split(' ');
  return [...prenom, ...nom].every((m) => mots.has(m));
}

export type Genre = 'Tâche' | 'Atelier' | 'Livrable' | 'Action';

/** Un élément confié à la personne. */
export interface ElementTravail {
  cle: string;
  projetId: string;
  projet: string;
  genre: Genre;
  titre: string;
  /** Échéance (fin prévue de la tâche, échéance de l'action). */
  date: string | null;
  statut: string;
  /** Tâche à ouvrir dans le projet (absent pour une action). */
  uid?: string;
  /** Écran du projet où l'élément se traite. */
  ecran: string;
}

/** Profils du projet tenus par la personne (index des profils). */
export function mesProfils(s: Suivi, moi: Personne): number[] {
  return s.modele.p.filter((p) => designe(p.collaborateur, moi)).map((p) => p.i);
}

/** Tâches (en cours ou à faire) où la personne a de la charge, et actions ouvertes qu'elle porte. */
export function elementsDuProjet(s: Suivi, projetId: string, moi: Personne): ElementTravail[] {
  const projet = [s.projet.fiche.client, s.projet.fiche.projet].filter(Boolean).join(' — ');
  const profils = mesProfils(s, moi);
  const taches: ElementTravail[] = s.modele.tasks
    .filter((t) => !t.annulee && t.statut !== 'Validé' && profils.some((i) => (t.charges[i] ?? 0) > 0))
    .map((t) => ({
      cle: `${projetId}:${t.uid}`,
      projetId,
      projet,
      genre: t.type === 'Atelier' || t.type === 'Livrable' ? t.type : 'Tâche',
      titre: t.label,
      date: t.fin,
      statut: t.statut,
      uid: t.uid,
      ecran: t.type === 'Atelier' || t.type === 'Livrable' ? 'ateliers' : 'workload',
    }));
  const actions: ElementTravail[] = s.projet.actions
    .filter((a) => a.statut !== 'Fait' && a.statut !== 'Annulée' && a.libelle.trim() && designe(a.porteur, moi))
    .map((a) => ({
      cle: `${projetId}:${a.id}`,
      projetId,
      projet,
      genre: 'Action',
      titre: `${a.ref} · ${a.libelle}`,
      date: a.echeance,
      statut: a.statut,
      ecran: 'actions',
    }));
  return [...taches, ...actions];
}

export type Periode = 'retard' | 'semaine' | 'plus-tard' | 'sans-date';

export const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: 'retard', libelle: 'En retard' },
  { cle: 'semaine', libelle: 'Cette semaine' },
  { cle: 'plus-tard', libelle: 'Plus tard' },
  { cle: 'sans-date', libelle: 'Sans échéance' },
];

/** Dimanche de la semaine d'une date (« cette semaine » va jusqu'au dimanche). */
export function dimanche(aujourdhui: string): string {
  const d = new Date(Date.UTC(+aujourdhui.slice(0, 4), +aujourdhui.slice(5, 7) - 1, +aujourdhui.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

export function periode(e: ElementTravail, aujourdhui: string): Periode {
  if (!e.date) return 'sans-date';
  if (e.date < aujourdhui) return 'retard';
  if (e.date <= dimanche(aujourdhui)) return 'semaine';
  return 'plus-tard';
}

/** Éléments regroupés par période, chaque groupe trié par date puis par projet. */
export function parPeriode(elements: readonly ElementTravail[], aujourdhui: string): { cle: Periode; libelle: string; elements: ElementTravail[] }[] {
  return PERIODES.map((p) => ({
    ...p,
    elements: elements
      .filter((e) => periode(e, aujourdhui) === p.cle)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.projet.localeCompare(b.projet, 'fr') || a.titre.localeCompare(b.titre, 'fr')),
  })).filter((g) => g.elements.length > 0);
}

/** Une ligne de « Ma semaine » : une tâche, avec mon profil sur cette tâche et le consommé déjà saisi par jour. */
export interface LigneSemaine {
  cle: string;
  projetId: string;
  projet: string;
  uid: string;
  titre: string;
  profilIndex: number;
  profilId: string;
  /** Consommé par jour (AAAA-MM-JJ). */
  parJour: Record<string, number>;
  peutSaisir: boolean;
}

/** Statuts d'une tâche sur laquelle on travaille en ce moment. */
const ACTIVES = ['En cours', 'En recette', 'Bloqué / En attente'];

/**
 * Tâches de ma semaine, avec mon profil : celles en cours, celles dont la période prévue touche la semaine,
 * et celles où j'ai déjà saisi du temps cette semaine (pour pouvoir le corriger). Les tâches validées ou annulées n'y sont pas.
 */
export function lignesSemaine(s: Suivi, projetId: string, moi: Personne, jours: readonly string[]): LigneSemaine[] {
  const premier = jours[0] ?? '';
  const dernier = jours[jours.length - 1] ?? '';
  const projet = [s.projet.fiche.client, s.projet.fiche.projet].filter(Boolean).join(' — ');
  const profils = mesProfils(s, moi);
  const lignes: LigneSemaine[] = [];
  for (const t of s.modele.tasks) {
    if (t.annulee || t.statut === 'Validé') continue;
    for (const i of profils) {
      if ((t.charges[i] ?? 0) <= 0) continue;
      const profil = s.projet.profiles[i];
      if (!profil) continue;
      const saisi = s.projet.track[t.uid]?.consoP?.[String(i)] ?? {};
      const debut = t.debut ?? t.fin;
      const fin = t.fin ?? t.debut;
      const prevueCetteSemaine = !!debut && !!fin && debut <= dernier && fin >= premier;
      const saisieCetteSemaine = jours.some((j) => (saisi[j] ?? 0) > 0);
      if (!ACTIVES.includes(t.statut) && !prevueCetteSemaine && !saisieCetteSemaine) continue;
      lignes.push({
        cle: `${projetId}:${t.uid}:${i}`,
        projetId,
        projet,
        uid: t.uid,
        titre: t.label,
        profilIndex: i,
        profilId: profil.id,
        parJour: { ...saisi },
        peutSaisir: s.droits.peutSaisirConsomme,
      });
    }
  }
  return lignes;
}

/** Les cinq jours ouvrables d'une semaine, à partir de son lundi. */
export function joursDeLaSemaine(lundi: string): string[] {
  const d = new Date(Date.UTC(+lundi.slice(0, 4), +lundi.slice(5, 7) - 1, +lundi.slice(8, 10)));
  return [0, 1, 2, 3, 4].map((k) => {
    const j = new Date(d);
    j.setUTCDate(d.getUTCDate() + k);
    return j.toISOString().slice(0, 10);
  });
}

/** Une notification : ce qui a changé sur ce qui me concerne, écrit par quelqu'un d'autre. */
export interface NotificationTravail {
  cle: string;
  projetId: string;
  projet: string;
  /** Horodatage ISO. */
  le: string;
  par: string;
  texte: string;
  uid?: string;
  ecran: string;
}

/**
 * Notifications d'un projet : mentions dans le fil des tâches, éléments qui me sont confiés,
 * et modifications faites par d'autres sur mes tâches et mes actions (d'après le journal du projet).
 */
export function notificationsDuProjet(s: Suivi, projetId: string, moi: Personne, mesElements: readonly ElementTravail[]): NotificationTravail[] {
  const projet = [s.projet.fiche.client, s.projet.fiche.projet].filter(Boolean).join(' — ');
  const moiComplet = `${moi.prenom} ${moi.nom}`;
  const parMoi = (par: string) => designe(par, moi);
  const liste: NotificationTravail[] = [];

  // 1. mentions dans le fil des tâches
  for (const [uid, fil] of Object.entries(s.projet.misesAJour ?? {})) {
    const tache = s.modele.tasks.find((t) => t.uid === uid);
    for (const m of fil) {
      if (parMoi(m.by) || !mentionne(m.texte, moi.prenom, moi.nom)) continue;
      liste.push({
        cle: `${projetId}:m:${uid}:${m.at}`,
        projetId,
        projet,
        le: m.at,
        par: m.by,
        texte: `vous a mentionné(e) sur « ${tache?.label ?? uid} » : ${m.texte.length > 140 ? m.texte.slice(0, 139) + '…' : m.texte}`,
        uid,
        ecran: 'workload',
      });
    }
  }

  // 2. journal : ce qui me concerne, modifié par quelqu'un d'autre
  const mesTaches = mesElements.filter((e) => e.uid && e.projetId === projetId);
  const mesActions = mesElements.filter((e) => e.genre === 'Action' && e.projetId === projetId).map((e) => e.titre.split(' · ')[0]);
  for (const j of s.projet.journal) {
    if (!j.by || parMoi(j.by)) continue;
    const confie = designe(j.nouvelle, moi) && !designe(j.ancienne, moi);
    const tache = mesTaches.find((e) => j.champ.startsWith(e.titre + ' · '));
    const action = mesActions.find((ref) => j.champ.startsWith(ref + ' · '));
    if (!confie && !tache && !action) continue;
    const quoi = j.champ.includes(' · ') ? j.champ.slice(j.champ.lastIndexOf(' · ') + 3) : j.champ;
    const sujet = tache ? `« ${tache.titre} »` : action ? `l’action ${action}` : j.champ.split(' · ')[0];
    const texte = confie
      ? `vous a confié ${sujet}`
      : `a modifié ${sujet} · ${quoi}${j.nouvelle ? ' : ' + (j.ancienne ? j.ancienne + ' → ' : '') + j.nouvelle : ''}`;
    liste.push({
      cle: `${projetId}:j:${j.at}:${j.champ}`,
      projetId,
      projet,
      le: j.at,
      par: j.by,
      texte: texte.replace(moiComplet, 'vous'),
      uid: tache?.uid,
      ecran: tache?.ecran ?? 'actions',
    });
  }
  return liste;
}

/** Toutes les notifications, les plus récentes d'abord, sans doublon. */
export function trierNotifications(listes: readonly NotificationTravail[][], maximum = 20): NotificationTravail[] {
  const vues = new Set<string>();
  return listes
    .flat()
    .filter((n) => (vues.has(n.cle) ? false : (vues.add(n.cle), true)))
    .sort((a, b) => b.le.localeCompare(a.le))
    .slice(0, maximum);
}
