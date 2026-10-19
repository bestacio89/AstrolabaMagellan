/* Construit les scénarios de référence : entrée (format de la version HTML) + résultats attendus calculés par son moteur (poc/core.js). */
const { Core, XlsxLite } = require('./loadcore.cjs');
const fs = require('fs');
const OUT = process.argv[2] || __dirname + '/../../backend/tests/Donnees';
const DONNEES = __dirname + '/../../backend/tests/Donnees';
fs.mkdirSync(OUT, { recursive: true });
const clone = (x) => JSON.parse(JSON.stringify(x));

function conso(p, uid, i, jours) { const tr = (p.track[uid] = p.track[uid] || {}); tr.consoP = tr.consoP || {}; tr.consoP[i] = Object.assign(tr.consoP[i] || {}, jours); }
function suivi(p, uid, o) { p.track[uid] = Object.assign(p.track[uid] || {}, o); }

function scenarioA(base) {
  const p = clone(base);
  p.remise = 0.05;
  p.dates = { debut: '2026-09-07', finContrat: '2027-04-07', finPrevue: '2027-04-21' };
  // r5 : validée, consommé = charge humaine -> enveloppe IA intacte (totale)
  conso(p, 'r5', 0, { '2026-09-07': 1 }); conso(p, 'r5', 1, { '2026-09-07': 0.5 }); conso(p, 'r5', 2, { '2026-09-07': 0.5 }); conso(p, 'r5', 3, { '2026-09-07': 0.5 });
  suivi(p, 'r5', { statut: 'Validé', avancement: 1, iaJustif: 'Comptes rendus générés par IA', iaType: 'Rédaction et génération de livrables', valideLe: '2026-09-07' });
  // r7 : en cours
  conso(p, 'r7', 0, { '2026-09-10': 0.5, '2026-09-17': 0.5, '2026-09-24': 0.5 });
  suivi(p, 'r7', { statut: 'En cours', avancement: 0.5 });
  // r9 : validée, dépassement humain partiellement absorbé par l'enveloppe IA (partielle), non justifiée
  conso(p, 'r9', 3, { '2026-09-14': 1, '2026-09-15': 0.8 });
  suivi(p, 'r9', { statut: 'Validé', avancement: 1, type: '' });
  // r10 : validée, enveloppe IA dépassée
  conso(p, 'r10', 3, { '2026-09-16': 1, '2026-09-17': 1, '2026-09-18': 0.5 });
  suivi(p, 'r10', { statut: 'Validé', avancement: 1, iaJustif: 'Données client inexploitables', iaType: 'Données client inexploitables' });
  // r12 : budget humain épuisé, tâche non terminée -> RAF à réestimer
  conso(p, 'r12', 3, { '2026-09-21': 1, '2026-09-22': 1 });
  suivi(p, 'r12', { statut: 'En cours', avancement: 0.75 });
  // r13 : annulée avec avenant de réduction, après un peu de consommé
  conso(p, 'r13', 2, { '2026-09-11': 0.5 });
  suivi(p, 'r13', { annul: { at: '2026-09-25T10:00:00.000Z', by: 'Alex', motif: 'Hors périmètre', avenant: true } });
  // r14 : annulée sans avenant, sans consommé
  suivi(p, 'r14', { annul: { at: '2026-09-26T10:00:00.000Z', by: 'Alex', motif: 'Doublon', avenant: false } });
  // r16 : charge ajoutée sur un profil (non facturée), en recette
  suivi(p, 'r16', { statut: 'En recette', avancement: 0.75, chargeAjout: { 3: 1 }, ajoutInfo: { 3: { at: '2026-09-20T09:00:00.000Z', by: 'Alex', motif: 'Demande client' } } });
  conso(p, 'r16', 2, { '2026-09-23': 1 });
  // tâche ajoutée en cours de projet, après r16
  const nt = Core.newTaskObj('a1', { id: 'AXE1', lot: '1.2', phase: 'CONSTRUCTION', etape: '', label: 'Atelier complémentaire RSSI', ajout: { at: '2026-09-28T09:00:00.000Z', by: 'Alex', motif: 'Ajout validé en COPROJ', after: 'r16' } });
  Core.insertTask(p.tasks, nt);
  suivi(p, 'a1', { chargeAjout: { 2: 2 } });
  conso(p, 'a1', 2, { '2026-09-29': 0.5 });
  // r18 : RAF saisi
  conso(p, 'r18', 0, { '2026-09-28': 1 });
  suivi(p, 'r18', { raf: 2, avancement: 0.25 });
  // r20 : RAF incohérent avec l'avancement ; r22 : plus d'une journée le même jour pour le profil 2
  conso(p, 'r20', 2, { '2026-09-08': 0.5, '2026-09-09': 1 });
  suivi(p, 'r20', { avancement: 0.25 });
  conso(p, 'r22', 2, { '2026-09-08': 0.75 });
  // r19 : bloquée ; r21 : validée sans consommé
  suivi(p, 'r19', { statut: 'Bloqué / En attente' });
  suivi(p, 'r21', { statut: 'Validé', avancement: 1, valideLe: '2026-09-30' });
  // r30 : axe affecté en cours de projet ; r31 : type saisi à la main
  suivi(p, 'r30', { axe: 'AXE1' });
  suivi(p, 'r31', { type: 'Atelier' });
  // dates prévues ; r34 après la fin prévue ; r33 liée à l'échéance 2
  suivi(p, 'r33', { debut: '2026-10-12', fin: '2026-11-06', ech: 2 });
  suivi(p, 'r34', { debut: '2027-03-01', fin: '2027-05-15' });
  suivi(p, 'r63', { debut: '2026-09-01', fin: '2026-12-18', phase: 'PILOTAGE', lot: '3.1' });
  // ancien libellé de statut
  suivi(p, 'r64', { statut: 'A faire' });
  // échéancier : n°1 facturée (montant figé), n°2 liée à la phase PILOTAGE et en retard, n°4 après la fin du projet
  p.echTrack = {
    1: { realiseLe: '2026-09-30', montantFacture: 20000, payeeLe: '2026-10-05' },
    2: { phases: ['PILOTAGE'], datePrevue: '2026-10-01' },
    4: { datePrevue: '2027-05-31', commentaire: 'Décalée' },
  };
  // budgets achats / frais / prestataires (absents du TSP d'exemple) et réels
  p.achats = [{ designation: 'Licences', type: 'Logiciel', cu: 1000, qte: 2, revente: 2600, commentaire: '' }];
  p.frais = [{ libelle: 'Déplacements', cu: 300, qte: 2, refacture: 0, commentaire: '' }];
  p.prestas = [{ designation: 'Expert externe', societe: 'Société X', coutJour: 600, nbj: 3, tjm: 900, commentaire: '' }];
  p.achatsReel = [
    { id: 'aq1', date: '2026-09-20', designation: 'Licences', fournisseur: 'Éditeur', ligne: 0, qte: 3, cu: 1000, refacture: 2600, statut: 'Commandé' },
    { id: 'aq2', date: '2026-09-22', designation: 'Matériel', fournisseur: 'Revendeur', ligne: null, qte: 1, cu: 500, refacture: 0, statut: 'Reçu' },
  ];
  p.fraisReel = [
    { id: 'fr1', date: '2026-09-15', collaborateur: 'Alex', categorie: 'Transport', libelle: 'Train', montant: 450, refacturable: false },
    { id: 'fr2', date: '2026-09-16', collaborateur: 'Sam', categorie: 'Hébergement', libelle: 'Hôtel', montant: 250, refacturable: true },
  ];
  p.actions = [
    { id: 'ac1', ref: 'A-001', libelle: 'Valider le planning', porteur: 'Alex', statut: 'En cours', echeance: '2026-09-30' },
    { id: 'ac2', ref: 'A-002', libelle: '', porteur: '', statut: 'À faire', echeance: '2026-09-01' },
    { id: 'ac3', ref: 'A-003', libelle: 'Envoyer le compte rendu', porteur: 'Sam', statut: 'Fait', echeance: '2026-09-02' },
  ];
  p.decisions = [{ id: 'dc1', ref: 'D-001', date: '2026-09-25', libelle: 'Report du pilote', statut: 'À valider' }];
  p.risques = [
    { id: 'rk1', ref: 'R-001', libelle: 'Indisponibilité du RSSI', proba: 'Forte', impact: 'Fort', statut: 'Ouvert' },
    { id: 'rk2', ref: 'R-002', libelle: 'Retard des licences', proba: 'Faible', impact: 'Moyen', statut: 'Ouvert' },
  ];
  return p;
}

/**
 * Planning, prévisionnel et risques (version HTML du 18/10/2026) : dates saisies sur des lignes et des sous-parties, nom d'une
 * sous-partie, date saisie sur un axe découpé (gardée, plus utilisée), jalons (date, période, à confirmer, sans date),
 * prévisionnel replanifié par rapport au planning vendu, risques sur la nouvelle échelle et sur l'ancienne.
 */
function scenarioD(A) {
  const p = clone(A);
  p.planning = {
    groupes: {
      'sec|r6|AXE1': { debut: '2026-09-14', fin: '2026-11-30' },
      'sec|r17': { nom: 'Données sensibles' },
      'id|AXE1': { debut: '2026-09-01', fin: '2027-01-29' },
      'id|AXE3': { fin: '2027-01-15' },
      'id|AXE4': { debut: '2026-10-01', fin: '2027-02-26' },
      'phase|CONSTRUCTION': { debut: '2026-10-05', fin: '2027-02-12' },
    },
    jalons: [
      { id: 'J2', libelle: 'Recette', type: 'periode', debut: '2026-11-02', fin: '2026-11-13' },
      { id: 'J1', libelle: 'Comité de lancement', type: 'date', debut: '2026-09-07' },
      { id: 'J3', libelle: 'Mise en production', type: 'date', debut: '2027-01-20', aConfirmer: true },
      { id: 'J4', libelle: 'Bilan', type: 'date', debut: '2027-03-01' },
      { id: 'J5', libelle: 'Sans date', type: 'date' },
    ],
  };
  // prévisionnel : 2 JH du premier profil décalés d'un mois sur l'autre (le planning vendu reste tel quel)
  p.planningTsp = clone(p.planningRef);
  const row = p.planningRef.rows[0], k = row.findIndex((v) => Number(v) >= 2);
  row[k] = Number(row[k]) - 2; row[k + 1] = Number(row[k + 1] || 0) + 2;
  p.risques = [
    { id: 'rk1', ref: 'R-001', libelle: 'Indisponibilité du RSSI', proba: 'Très forte', impact: 'Critique', statut: 'Ouvert', type: 'Retard', cause: 'Arbitrages internes', parade: 'Suppléant désigné', plan: 'A-001' },
    { id: 'rk2', ref: 'R-002', libelle: 'Retard des licences', proba: 'Modérée', impact: 'Moyenne', statut: 'Ouvert', type: 'Budget' },
    { id: 'rk3', ref: 'R-003', libelle: 'Ancienne échelle', proba: 'Moyenne', impact: 'Fort', statut: 'Ouvert' },
    { id: 'rk4', ref: 'R-004', libelle: 'Risque clos', proba: 'Forte', impact: 'Forte', statut: 'Clos', type: 'Qualité' },
  ];
  return p;
}

const r = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, Array.isArray(o[k]) ? o[k].map(r) : r(o[k] ?? null)]));
function extract(m) {
  return {
    tasks: m.tasks.map((t) => pick(t, ['uid', 'label', 'axe', 'phase', 'lot', 'charge', 'chargeTSP', 'chargeAjout', 'chargeInit', 'chargeAnnulee', 'charges', 'consoP', 'consoTotal', 'restP', 'rafAuto', 'rafSaisi', 'raf', 'atterrissage', 'ecart', 'statut', 'avancement', 'ia', 'iaHum', 'iaConso', 'iaRes', 'iaStatut', 'iaAJustifier', 'rafAReestimer', 'rafSuggere', 'rafIncoherent', 'valo', 'coutPrevu', 'coutConso', 'coutRaf', 'caAvenant', 'debut', 'fin', 'realiseLe', 'type', 'responsable', 'echN', 'grp'])),
    profils: m.profils.map((x) => pick(x, ['nom', 'charge', 'ca', 'coutEN', 'coutAgence', 'tci', 'margeEN', 'margeAgence', 'pctJH', 'pctCA', 'ajoutJH'])),
    synthese: pick(m.synthese, ['montantProjet', 'jours', 'ca', 'cout', 'coutAgence', 'cjmProd', 'tjmClient', 'margeAgence', 'margeEN', 'fraisDep', 'fraisRef', 'provJH', 'provEur', 'achatsMt', 'achatsRef', 'margeAchats', 'margeNette', 'margeNettePct']),
    ventilation: { parPhase: m.ventilation.parPhase.map((x) => pick(x, ['cle', 'total'])), parEtape: m.ventilation.parEtape.map((x) => pick(x, ['cle', 'total'])), sansEtape: r(m.ventilation.sansEtape) },
    metrique: m.metrique.map((x) => pick(x, ['etape', 'pct', 'theorique', 'propale', 'pctProjet', 'ecart'])),
    axes: m.axes.map((a) => ({
      ...pick(a, ['id', 'nom', 'n', 'prevu', 'conso', 'raf', 'atterrissage', 'ecart', 'prevuTSP', 'ajout', 'annule', 'statut', 'avancement', 'avDeclare', 'valides', 'actives', 'ateliers', 'ateliersOK', 'livrables', 'livrablesOK', 'ia', 'iaRes', 'coutFinal',
        'cle', 'planDebut', 'planFin', 'planSaisi', 'planDebutSaisi', 'planFinSaisi']),
      planCalcule: !!a.planCalcule, planDeSaisies: !!a.planDeSaisies, planAncien: a.planAncien || null,
      sousParties: (a.sousParties || []).map((x) => pick(x, ['id', 'nom', 'nomTSP', 'axe', 'uids', 'n', 'prevu', 'conso', 'avancement', 'statut', 'cle', 'planDebut', 'planFin', 'planSaisi'])),
    })),
    total: pick(m.total, ['n', 'prevu', 'conso', 'raf', 'atterrissage', 'ecart', 'prevuTSP', 'ajout', 'annule', 'coutPrevu', 'coutConso', 'coutRaf', 'coutFinal', 'statut', 'avancement', 'avDeclare', 'valides', 'actives', 'ia', 'iaRes']),
    months: m.months,
    mensuel: m.mensuel.map((x) => pick(x, ['mois', 'conso', 'ref', 'tsp', 'tspP', 'coutCJM', 'cumCJM', 'valoTJM', 'cumTJM', 'refTJM', 'cumRefTJM'])),
    refTotal: r(m.refTotal),
    tspTotal: r(m.tspTotal),
    replanifie: m.replanifie,
    jalons: m.jalons.map((j) => ({ id: j.id, libelle: j.libelle, debut: j.debut, fin: j.fin || null, aConfirmer: !!j.aConfirmer, numero: j.numero })),
    axeIdsActifs: m.axeIdsActifs,
    avancement: (() => { const a = Core.avancementArbre(m); return { cle: a.cle, groupes: a.groupes.map((g) => ({ id: g.id, nom: g.nom, sous: g.sous.map((x) => ({ id: x.id, nom: x.nom, stat: pick(x.stat, ['n', 'prevu', 'conso', 'raf', 'ecart', 'avancement', 'valides', 'actives', 'ateliers', 'ateliersOK', 'livrables', 'livrablesOK', 'statut']), taches: x.taches.map((t) => t.uid) })) })) }; })(),
    risques: m.risques.map((x) => ({ ref: x.ref, crit: x.crit, niveau: Core.riskNiveau(x.crit) })),
    financier: {
      ...pick(m.financier, ['ca', 'caTSP', 'caAvenant', 'coutInitial', 'coutAjout', 'coutAnnule', 'coutPrevu', 'coutConso', 'coutRaf', 'coutFinal', 'marge', 'tauxMarge', 'ecartCout', 'margeNette', 'tauxMargeNette', 'margeNetteVendue', 'tauxMargeNetteVendue']),
      achats: pick(m.financier.achats, ['budget', 'budgetRev', 'reel', 'reelRev', 'horsTSP', 'att', 'attRev', 'reste', 'depasse', 'impactNet']),
      frais: pick(m.financier.frais, ['budget', 'budgetRef', 'reel', 'reelRef', 'att', 'attRef', 'reste', 'depasse', 'impactNet']),
    },
    perimetre: { ...pick(m.perimetre, ['chargeTSP', 'chargeAjout', 'chargeAnnulee', 'chargeActuelle', 'coutAjout', 'coutAnnule', 'caAvenant', 'nTaches', 'nProfilsTache', 'nAnnul', 'margeVendue', 'margeAvecAjouts']), lignes: m.perimetre.lignes.map((l) => pick(l, ['kind', 'uid', 'jh', 'cout'])) },
    echeancier: m.echeancier.map((e) => pick(e, ['n', 'nom', 'pct', 'montant', 'montantInit', 'ajustAvenant', 'mois', 'datePrevue', 'realiseLe', 'payeeLe', 'statut', 'nLies', 'nLiesValides', 'avLie', 'pret', 'jours', 'apresFin', 'factCum', 'prodPlan', 'faePlan', 'factReel', 'prodReel', 'faeReel', 'faePlanPct', 'faeReelPct'])),
    echSynth: pick(m.echSynth, ['facture', 'paye', 'reste', 'produit', 'faeADate', 'ajustAvenant']),
    ateliers: { ateliers: m.ateliers.ateliers, livrables: m.ateliers.livrables, parType: m.ateliers.parType.map((x) => pick(x, ['id', 'prevus', 'realises', 'restants', 'annules', 'charge'])) },
    ia: pick(m.ia, ['profil', 'ref', 'consomme', 'realise', 'envVal', 'projection', 'taux', 'tauxProj', 'valeurTJM', 'valeurCJM', 'validees']),
    vigilance: m.vigilance.map((v) => pick(v, ['cle', 'valeur', 'niveau'])),
    cal: pick(m.cal, ['debut', 'finContrat', 'finPrevue', 'joursTotal', 'joursEcoules', 'joursRestants', 'tempsPct', 'consoPct', 'glissementJours', 'glissementOuvres']),
    surJours: m.surJours.map((x) => pick(x, ['i', 'd', 'v'])),
  };
}
const write = (name, p) => {
  // entrée : mêmes données que le fichier de suivi du POC, sans les champs propres à l'outil
  // le planning vendu (planningTsp) est gardé : c'est la référence figée du prévisionnel (planningRef)
  const input = clone(p); delete input.journal; delete input.meta; delete input.source; delete input.planningPhasesTsp;
  fs.writeFileSync(`${OUT}/${name}.entree.json`, JSON.stringify(input, null, 1));
  fs.writeFileSync(`${OUT}/${name}.attendu.json`, JSON.stringify(extract(Core.compute(p)), null, 1));
  console.log('scénario', name, 'ok');
};
(async () => {
  const a = await Core.parseTSP(XlsxLite, fs.readFileSync(DONNEES + '/tsp-exemple-a.xlsx'), 'tsp-exemple-a.xlsx');
  const b = await Core.parseTSP(XlsxLite, fs.readFileSync(DONNEES + '/tsp-exemple-b.xlsx'), 'tsp-exemple-b.xlsx');
  const A = scenarioA(a);
  write('scenario-a-suivi-en-cours', A);
  write('scenario-a-regroupement-lot', Object.assign(clone(A), { settings: { ...A.settings, groupBy: 'lot' } }));
  write('scenario-a-regroupement-phase', Object.assign(clone(A), { settings: { ...A.settings, groupBy: 'phase' } }));
  write('scenario-b-tsp-sans-dates', b);
  const D = scenarioD(A);
  write('scenario-d-planning-previsionnel', D);
  write('scenario-d-planning-par-phase', Object.assign(clone(D), { settings: { ...D.settings, groupBy: 'phase' } }));
  write('scenario-a-tsp-importe', a);
  // coquille vide : création manuelle (V1)
  const vide = { schema: 2, fiche: { champs: [], client: 'Client', projet: 'Projet vide' }, periode: { start: '2026-11-02', end: '2027-02-26' }, remise: 0, profiles: [], grille: [], tasks: [],
    planningPhases: { rows: [], source: null }, types: Core.TYPES_SOCLE.map((x) => ({ ...x })), frais: [], achats: [], prestas: [], echeancier: [], metrique: [], planningRef: { months: [], rows: [] },
    ref: { phases: [], etapes: [] }, axes: {}, dates: { debut: '2026-11-02', finContrat: '2027-02-26', finPrevue: '2027-02-26' }, settings: { startMonth: '2026-11', nbMonths: 13, iaProfile: -1, groupBy: 'id' }, track: {}, warnings: [] };
  write('scenario-c-projet-vide', vide);
  // lecture des TSP : résultat attendu de l'import (même forme que parseTSP)
  for (const [n, p] of [['tsp-exemple-a', a], ['tsp-exemple-b', b]]) {
    const x = clone(p); delete x.source; delete x.meta; delete x.journal;
    fs.writeFileSync(`${OUT}/${n}.lecture-attendue.json`, JSON.stringify(x, null, 1));
  }
})().catch((e) => { console.error(e); process.exit(1); });
