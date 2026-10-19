/* ============================================================
   CORE — le "cerveau" de l'application, sans aucun affichage.
   1. parseTSP   : lit le fichier TSP et en extrait les données brutes
   2. compute    : recalcule TOUS les indicateurs à partir de ces données
   3. buildCopil : prépare les onglets de l'export Excel COPIL
   Règle : on ne réutilise jamais les résultats de formules du TSP
   (ils peuvent être faux, ex. #REF!), on recalcule tout.
   ============================================================ */
const Core = (() => {
  const SCHEMA = 2; // v2 : consommé saisi par profil (track[uid].consoP[indexProfil][date])
  const STATUTS = ['À faire', 'En cours', 'Bloqué / En attente', 'En recette', 'Validé'];
  /** Anciens libellés de statut (fichiers enregistrés avant le 01/10/2026). */
  const STATUT_ALIAS = { 'A faire': 'À faire', Test: 'En recette' };
  // Optimisation IA : leviers (économie) et causes (dépassement) — listes par défaut, modifiables dans Paramètres du projet
  const IA_LEVIERS = ['Rédaction et génération de livrables', 'Analyse et synthèse de données', 'Scripts, paramétrage, automatisation', 'Tests et recette automatisés', 'Recherche et veille', 'Réutilisation d’un actif existant', 'Autre'];
  const IA_CAUSES = ['Qualité insuffisante, reprise manuelle', 'Outil ou licence indisponible', 'Données client inexploitables', 'Montée en compétence', 'Périmètre modifié', 'Autre'];
  const IA_CONFORME = 'IA utilisée comme prévu';
  const ACHAT_STATUTS = ['Commandé', 'Reçu', 'Facturé'];
  /** Météo du projet (choisie par le chef de projet) : niveau → libellé, symbole. */
  const METEO = [['soleil', 'Sous contrôle', '☀'], ['nuage', 'À surveiller', '⛅'], ['orage', 'En difficulté', '⛈']];
  /** Registre des risques : probabilité et importance sur 4 niveaux ; criticité = probabilité × importance (1 à 16). */
  // Risques : probabilité (en abscisse de la matrice) × importance (en ordonnée), 4 niveaux chacune ; score de 1 à 16.
  // Le champ enregistré s'appelle toujours « impact » (fichiers existants) ; il s'affiche « Importance ».
  const RISK_PROBA = ['Faible', 'Modérée', 'Forte', 'Très forte'], RISK_IMPACT = ['Faible', 'Moyenne', 'Forte', 'Critique'], RISK_ST = ['Ouvert', 'Maîtrisé', 'Survenu', 'Clos'];
  const RISK_DEF = { proba: 'Modérée', impact: 'Moyenne' };
  /** Type d'un risque (légende du support de comité) : Retard, Qualité, Budget. Champ facultatif « type ». */
  const RISK_TYPES = ['Retard', 'Qualité', 'Budget'];
  // « Comment réduire » est enregistré dans le champ « parade » (nom d'origine : les fichiers existants sont repris tels quels).
  /** Niveau d'un score, d'après la matrice de référence : 1 à 3 faible (vert), 4 à 6 moyen (orange), 8 et plus fort (rouge). */
  const riskNiveau = (c) => (c >= 8 ? 'fort' : c >= 4 ? 'moyen' : 'faible');
  /** Ancienne échelle à 3 niveaux : Faible → 1, Moyen(ne) → 2, Fort(e) → 3 (le niveau 4 s'attribue à la main). */
  const RISK_ANCIEN = { proba: { Moyenne: 'Modérée' }, impact: { Moyen: 'Moyenne', Fort: 'Forte' } };
  function migrerRisques(p) {
    for (const r of p?.risques || []) {
      if (RISK_ANCIEN.proba[r.proba]) r.proba = RISK_ANCIEN.proba[r.proba];
      if (RISK_ANCIEN.impact[r.impact]) r.impact = RISK_ANCIEN.impact[r.impact];
    }
  }
  /** Profils pouvant dépasser 1 JH par jour (un prestataire ou une cession peut mobiliser plusieurs personnes). */
  const multiJours = (pr) => /^(ACHAT|CESSION)/.test(String(pr?.entite || '').toUpperCase());
  const FRAIS_CATEGORIES = ['Transport', 'Hébergement', 'Repas', 'Autre'];
  const AVANCEMENTS = [0, 0.25, 0.5, 0.75, 1];
  const ENTITES = ['FO', 'CESSION', 'ACHAT', 'BO', 'ACHAT BO'];
  const PRCS_DEFAUT = 450;
  /** Entité d'un profil, comparée sans tenir compte des majuscules ni des espaces (comme Excel). */
  const entiteNormalisee = (e) => String(e || '').trim().toUpperCase();
  // Types de tâches « socle » : utilisés par le tableau de bord, le registre et l'export ; non supprimables
  const TYPES_SOCLE = [{ id: 'Atelier', nom: 'Atelier', socle: true }, { id: 'Livrable', nom: 'Livrable', socle: true }];

  // ---------- petits utilitaires ----------
  const num = (v) => {
    if (v == null || v === '' || typeof v === 'boolean') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (typeof v === 'object') return 0; // erreur Excel (#REF!…)
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  };
  const str = (v) => (v == null || typeof v === 'object' ? '' : String(v).trim());
  const norm = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
  const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const sum = (arr) => arr.reduce((s, x) => s + (x || 0), 0);

  // ---------- dates (format texte AAAA-MM-JJ, sans fuseau horaire) ----------
  const EPOCH = Date.UTC(1899, 11, 30);
  const toUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);
  // Nombres écrits dans un texte (exports, points de vigilance) : format français, même arrondi que l'écran
  const nfJ0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  const nfE0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const nfP0 = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtJ = (v) => nfJ0.format(Math.round((+v || 0) * 100) / 100);
  const fmtE = (v) => nfE0.format(+v || 0);
  const fmtP = (v) => (v == null || !isFinite(v) ? '—' : nfP0.format(v));
  /** Tâche planifiée : dates prévues saisies (un livrable n'a besoin que de sa date de livraison = fin prévue). */
  const planifiee = (t) => (t.type === 'Livrable' ? !!t.tr.fin : !!(t.tr.debut && t.tr.fin));
  /** Date du jour à l'heure locale (et non UTC : entre 0 h et 2 h, l'UTC donne encore la veille). */
  const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const serialToISO = (n) => fromUTC(EPOCH + Math.round(n) * 864e5);
  const addDays = (iso, n) => fromUTC(toUTC(iso) + n * 864e5);
  const dow = (iso) => new Date(toUTC(iso)).getUTCDay();
  const monthOf = (iso) => iso.slice(0, 7);
  const addMonths = (mk, n) => {
    let [y, m] = mk.split('-').map(Number);
    m = m - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  };
  const monthDays = (mk) => {
    const out = []; let d = mk + '-01';
    while (monthOf(d) === mk) { out.push(d); d = addDays(d, 1); }
    return out;
  };
  const monthsBetween = (a, b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const parseFrDate = (s) => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
  const toISO = (v) => (typeof v === 'number' && v > 20000 && v < 80000 ? serialToISO(v) : parseFrDate(str(v)));

  // Jours fériés français (métropole)
  const holidayCache = {};
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    const e = easter(y);
    const list = {
      [`${y}-01-01`]: "Jour de l'an", [addDays(e, 1)]: 'Lundi de Pâques', [`${y}-05-01`]: 'Fête du travail',
      [`${y}-05-08`]: 'Victoire 1945', [addDays(e, 39)]: 'Ascension', [addDays(e, 50)]: 'Lundi de Pentecôte',
      [`${y}-07-14`]: 'Fête nationale', [`${y}-08-15`]: 'Assomption', [`${y}-11-01`]: 'Toussaint',
      [`${y}-11-11`]: 'Armistice', [`${y}-12-25`]: 'Noël',
    };
    return (holidayCache[y] = list);
  }
  const holidayName = (iso) => holidays(+iso.slice(0, 4))[iso] || null;
  const isWorkday = (iso) => { const d = dow(iso); return d !== 0 && d !== 6 && !holidayName(iso); };
  function workdays(a, b) {
    if (!a || !b || b < a) return 0;
    let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (isWorkday(d)) n++;
    return n;
  }

  // ============================================================
  // 1. LECTURE DU TSP
  // ============================================================
  async function parseTSP(XlsxLite, buffer, fileName) {
    const wb = await XlsxLite.read(buffer);
    const warnings = [];
    const wl = await wb.sheet('WORKLOAD');
    const pr = await wb.sheet('PROFIL');
    if (!wl || !pr) throw new Error("Ce fichier ne ressemble pas à un TSP : les onglets WORKLOAD et PROFIL sont introuvables.");
    // ancien suivi Excel (onglets TABLEAU DE BORD, GANTT…) : seule la partie TSP est reprise
    if ((wb.sheetNames || []).some((n) => /^(tableau de bord|gantt|ateliers & livrables)$/i.test(String(n).trim())))
      warnings.push('Ce fichier est un ancien suivi Excel : seules les données du TSP (tâches, profils, charges, échéancier) sont reprises. Le consommé, les statuts et les dates saisis dans le suivi Excel ne le sont pas.');
    const findRow = (sh, col, test, from = 0, to = sh.maxRow) => { for (let r = from; r <= to; r++) if (test(norm(sh.g(r, col)))) return r; return -1; };

    // --- FICHE PROJET ---
    const fiche = { champs: [] };
    const fp = await wb.sheet('FICHE PROJET');
    const KEYS = { 'nom du client': 'client', projet: 'projet', 'reference propale': 'reference', 'contact client': 'contact', agence: 'agence', 'service line': 'serviceLine', 'directeur agence': 'directeur', 'responsable sl': 'responsableSL', commercial: 'commercial', 'type de contrat': 'typeContrat', 'auteur :': 'auteur', 'date :': 'date' };
    if (fp) {
      for (let r = 0; r <= fp.maxRow; r++) {
        for (const c of [1, 5]) {
          const label = str(fp.g(r, c)); if (!label) continue;
          const nl = norm(label);
          if (nl.startsWith('montant') || nl.startsWith('dont') || nl === 'fiche projet') continue;
          let v = fp.g(r, c + 1);
          if (nl.startsWith('date')) v = toISO(v) || str(v); else v = str(v);
          const key = nl.startsWith('periode') ? 'periode' : KEYS[nl];
          if (key) fiche[key] = v;
          fiche.champs.push({ label: label.replace(/\s*:\s*$/, ''), value: v, key: key || null });
        }
      }
    } else warnings.push("Onglet FICHE PROJET absent : informations projet non renseignées.");
    let periode = { start: null, end: null };
    if (fiche.periode) {
      const m = /(\d{1,2}\/\d{1,2}\/\d{4}).*?(\d{1,2}\/\d{1,2}\/\d{4})/.exec(fiche.periode);
      if (m) periode = { start: parseFrDate(m[1]), end: parseFrDate(m[2]) };
    }
    if (!periode.start || !periode.end) warnings.push('Période du projet absente du TSP : renseignez le début et la fin dans ⚙ Paramètres du projet › Dates du projet.');

    // --- PROFIL ---
    let hdr = -1;
    for (let r = 0; r <= pr.maxRow; r++) if (norm(pr.g(r, 1)) === 'profil' && norm(pr.g(r, 2)).startsWith('entit')) { hdr = r; break; }
    if (hdr < 0) throw new Error("Onglet PROFIL : en-tête « PROFIL » introuvable.");
    const profiles = [];
    for (let r = hdr + 1; r <= pr.maxRow; r++) {
      if (norm(pr.g(r, 1)) === 'total') break;
      const gv = pr.g(r, 6);
      profiles.push({
        nom: str(pr.g(r, 1)), entite: str(pr.g(r, 2)).toUpperCase() || 'FO',
        tjm: num(pr.g(r, 3)), cjm: num(pr.g(r, 4)),
        prcs: typeof pr.g(r, 5) === 'number' ? pr.g(r, 5) : null,
        frais: typeof gv === 'number' ? gv : 0,
        collaborateur: typeof gv === 'number' ? '' : str(gv),
      });
    }
    // Remise (J15) et CA initial (J14) : cellules à droite de leur libellé, vides si non saisies dans le TSP
    let remise = 0, remiseSaisie = false, caInitial = null;
    for (let r = 0; r <= pr.maxRow; r++) for (let c = 0; c <= pr.maxCol; c++) {
      const l = norm(pr.g(r, c)), v = pr.g(r, c + 1), filled = v !== null && v !== undefined && v !== '';
      if (l.startsWith('remise')) { remise = num(v); if (remise > 1) remise /= 100; remiseSaisie = filled; }
      else if (l.startsWith('ca initial') && filled) caInitial = num(v);
    }
    const grille = [];
    const gh = findRow(pr, 1, (s) => s === 'profils');
    if (gh >= 0) for (let r = gh + 1; r <= pr.maxRow; r++) {
      const n = str(pr.g(r, 1)); if (!n) break;
      grille.push({ profil: n, tjmParis: num(pr.g(r, 3)), cjmParis: num(pr.g(r, 4)), tjmRegion: num(pr.g(r, 5)), cjmRegion: num(pr.g(r, 6)) });
    }

    // --- WORKLOAD : colonnes détectées dynamiquement ---
    const hr = findRow(wl, 0, (s) => s === 'id', 0, 15);
    if (hr < 0) throw new Error("Onglet WORKLOAD : ligne d'en-tête (colonne « ID ») introuvable.");
    const H = (c) => norm(wl.g(hr, c));
    const colOf = (test, from = 0) => { for (let c = from; c <= wl.maxCol; c++) if (test(H(c))) return c; return -1; };
    const cLot = colOf((s) => s === 'lot'), cPhase = colOf((s) => s === 'phase'), cEtape = colOf((s) => s === 'etape'), cTache = colOf((s) => s === 'tache');
    const cCharge = colOf((s) => s.startsWith('total charge'));
    const cValo = colOf((s) => s.startsWith('total') && s.includes('valorisation'));
    if (cTache < 0 || cCharge < 0) throw new Error("Onglet WORKLOAD : colonnes « Tâche » ou « TOTAL Charge » introuvables.");
    const pStart = (cValo >= 0 ? cValo : cCharge) + 1; // colonne H dans le modèle actuel
    let pEnd = pStart;
    while (pEnd <= wl.maxCol) {
      const above = norm(wl.g(hr - 1, pEnd));
      const h = H(pEnd);
      if (pEnd > pStart && (above.includes('cout par profil') || (h && h === H(pStart)))) break;
      if (h.startsWith('livrable') || h.startsWith('hypoth')) break;
      pEnd++;
    }
    const nProfCols = pEnd - pStart;
    const cLivrable = colOf((s) => s.startsWith('livrable'), pEnd);
    const cHyp = colOf((s) => s.startsWith('hypoth') || s.startsWith('commentaire'), pEnd);
    // aligne la liste des profils sur les colonnes du WORKLOAD
    while (profiles.length < nProfCols) profiles.push({ nom: str(wl.g(hr, pStart + profiles.length)), entite: 'FO', tjm: 0, cjm: 0, prcs: null, frais: 0, collaborateur: '' });
    profiles.length = nProfCols;
    profiles.forEach((p, i) => { const h = str(wl.g(hr, pStart + i)); if (!p.nom && h && h !== '0') p.nom = h; });

    let pctPilotage = null, pctProvision = null;
    for (let c = 0; c <= wl.maxCol; c++) {
      const s = norm(wl.g(0, c));
      if (s.includes('pilotage')) pctPilotage = num(wl.g(0, c + 1));
      if (s.includes('provision')) pctProvision = num(wl.g(0, c + 1));
    }

    const tasks = [];
    for (let r = hr + 1; r <= wl.maxRow; r++) {
      const label = str(wl.g(r, cTache));
      if (!label) continue;
      const charges = [];
      for (let i = 0; i < nProfCols; i++) charges.push(num(wl.g(r, pStart + i)));
      const idRaw = wl.g(r, 0);
      tasks.push({
        uid: 'r' + (r + 1), ligne: r + 1,
        id: idRaw === 0 ? '0' : str(idRaw),
        lot: wl.g(r, cLot) === 0 ? '0' : str(wl.g(r, cLot)),
        phase: str(wl.g(r, cPhase)).toUpperCase(), etape: str(wl.g(r, cEtape)), label,
        charges, section: sum(charges) === 0,
        livrable: cLivrable >= 0 ? norm(wl.g(r, cLivrable)) : '',
        hypothese: cHyp >= 0 ? str(wl.g(r, cHyp)) : '',
      });
    }
    if (!tasks.length) throw new Error("Onglet WORKLOAD : aucune tâche trouvée.");
    // colonne « Livrable » du WORKLOAD renseignée (au moins un « oui ») : c'est elle qui dit ce qu'est un livrable, plus le titre.
    // Le repère est gardé sur chaque tâche : un suivi lancé avant cette règle (sans repère) garde la détection par le titre.
    if (cLivrable >= 0 && tasks.some((t) => !t.section && t.livrable === 'oui')) tasks.forEach((t) => { t.livCol = true; });
    const sansId = tasks.filter((t) => !t.section && !t.id);
    if (sansId.length) warnings.push(`${sansId.length} tâche(s) sans axe dans le TSP (${round(sum(sansId.map((t) => sum(t.charges))))} JH) : affectez-leur un axe depuis Workload › Liste des tâches (filtre « Sans axe »).`);

    // --- FRAIS ---
    const frais = [];
    const fr = await wb.sheet('FRAIS');
    if (fr) {
      const h = findRow(fr, 0, (s) => s.startsWith('libelle'));
      if (h >= 0) for (let r = h + 1; r <= fr.maxRow; r++) {
        if (norm(fr.g(r, 0)) === 'total') break;
        const row = { libelle: str(fr.g(r, 0)), cu: num(fr.g(r, 1)), qte: num(fr.g(r, 2)), refacture: num(fr.g(r, 4)), commentaire: str(fr.g(r, 5)) };
        if (row.libelle || row.cu || row.qte || row.refacture) frais.push(row);
      }
    }
    // --- ACHAT ---
    const achats = [], prestas = [];
    const ac = await wb.sheet('ACHAT');
    if (ac) {
      const h1 = findRow(ac, 0, (s) => s.startsWith('achat materiel'));
      if (h1 >= 0) for (let r = h1 + 1; r <= ac.maxRow; r++) {
        if (norm(ac.g(r, 0)) === 'total') break;
        const row = { designation: str(ac.g(r, 0)), type: str(ac.g(r, 1)), cu: num(ac.g(r, 2)), qte: num(ac.g(r, 3)), revente: num(ac.g(r, 6)), commentaire: str(ac.g(r, 8)) };
        if (row.designation || row.cu || row.revente) achats.push(row);
      }
      const h2 = findRow(ac, 0, (s) => s.startsWith('achat prestataires'));
      if (h2 >= 0) for (let r = h2 + 1; r <= ac.maxRow; r++) {
        if (norm(ac.g(r, 0)) === 'total') break;
        const row = { designation: str(ac.g(r, 0)), societe: str(ac.g(r, 1)), coutJour: num(ac.g(r, 2)), nbj: num(ac.g(r, 3)), tjm: num(ac.g(r, 5)), commentaire: str(ac.g(r, 8)) };
        if (row.designation || row.societe || row.nbj) prestas.push(row);
      }
    }
    // --- ECHEANCIER ---
    const echeancier = [];
    const ec = await wb.sheet('ECHEANCIER');
    if (ec) {
      const h = findRow(ec, 1, (s) => s === 'n°' || s === 'no');
      if (h >= 0) for (let r = h + 1; r <= ec.maxRow; r++) {
        const nom = str(ec.g(r, 2)), pct = num(ec.g(r, 3));
        if (!nom && !pct) continue;
        const m = toISO(ec.g(r, 4));
        echeancier.push({ n: num(ec.g(r, 1)) || echeancier.length + 1, nom, pct, mois: m ? monthOf(m) : null });
      }
    }
    // --- METRIQUE ---
    const metrique = [];
    const me = await wb.sheet('METRIQUE');
    if (me) {
      const h = findRow(me, 1, (s) => s === 'etape');
      if (h >= 0) for (let r = h + 1; r <= me.maxRow; r++) {
        const e = str(me.g(r, 1)); if (!e) continue;
        if (norm(e) === 'total') break;
        metrique.push({ etape: e, pct: num(me.g(r, 2)) });
      }
    }
    // --- Planning de charge mensuel par profil ---
    // Priorité à l'onglet PILOTAGE CHARGES (valeurs définies avec le directeur de projet),
    // sinon onglet PLANNING du TSP. Profils rapprochés par leur nom, puis par position.
    const planningRef = { months: [], rows: profiles.map(() => []) };
    let planningSource = null;
    for (const name of ['PILOTAGE CHARGES', 'PLANNING']) {
      const sh = await wb.sheet(name);
      const t = sh && readPlanningTable(sh, profiles);
      if (t && t.months.length) { planningRef.months = t.months; planningRef.rows = t.rows; planningSource = sh.name; break; }
    }
    const planTot = sum(planningRef.rows.map((r) => sum((r || []).map(num))));
    if (planningSource && planTot > 0) warnings.push(`Planning de charge mensuel repris de l’onglet ${planningSource} (consultable dans Annexes › Planning du TSP ; à replanifier dans Finances › Plan de charge › Prévisionnel).`);
    else if (planningSource) warnings.push(`Onglet ${planningSource} présent mais vide (0 JH) : la courbe « prévu » du Plan de charge restera vide.`);
    else warnings.push('Aucun planning de charge mensuel trouvé dans le TSP (onglet PLANNING ou PILOTAGE CHARGES) : la courbe « prévu » du Plan de charge restera vide.');
    // --- REF (listes) ---
    const ref = { phases: [], etapes: [] };
    const rf = await wb.sheet('REF');
    if (rf) {
      const h = findRow(rf, 1, (s) => s === 'phase');
      if (h >= 0) for (let r = h + 1; r <= rf.maxRow; r++) {
        const p = str(rf.g(r, 1)); if (p) ref.phases.push(p.toUpperCase());
        const e = str(rf.g(r, 3)); if (e) ref.etapes.push(e);
      }
    }
    if (!ref.phases.length) ref.phases = ['PILOTAGE', 'CONCEPTION', 'CONSTRUCTION', 'VALIDATION', 'FINALISATION', 'GARANTIE', 'TMA', 'PROVISION'];

    // --- Planning de charge mensuel par phase (onglet PLANNING, tableau « Phases », lignes 18-27) ---
    // Phase = liste REF ; mois saisis à la main ; CJM = valeurs saisies (non utilisées dans les calculs).
    let planningPhases = null;
    for (const name of ['PLANNING', 'PILOTAGE CHARGES']) {
      const sh = await wb.sheet(name);
      if (!sh) continue;
      const h = findRow(sh, 1, (x) => x === 'phases');
      if (h < 0) continue;
      const cols = [];
      for (let c = 2; c <= sh.maxCol; c++) { const d = toISO(sh.g(h, c)); if (d) cols.push([c, monthOf(d)]); }
      if (!cols.length) { // en-tête sans dates lisibles : on reprend celles du tableau « Profil » de la même feuille
        const hp = findRow(sh, 1, (x) => x === 'profil');
        if (hp >= 0) for (let c = 2; c <= sh.maxCol; c++) { const d = toISO(sh.g(hp, c)); if (d) cols.push([c, monthOf(d)]); }
      }
      const rows = [];
      for (let r = h + 1; r <= sh.maxRow; r++) {
        const ph = str(sh.g(r, 1));
        if (norm(ph).startsWith('total')) break;
        if (!ph) continue;
        const cj = sh.g(r, 3);
        const vals = {};
        cols.forEach(([c, mk]) => { const v = num(sh.g(r, c)); if (v) vals[mk] = v; });
        rows.push({ phase: ph.toUpperCase(), cjm: typeof cj === 'number' ? cj : str(cj) || null, vals });
      }
      if (rows.length) { planningPhases = { rows, source: sh.name }; break; }
    }
    if (!planningPhases) planningPhases = { rows: ref.phases.map((ph) => ({ phase: ph, cjm: null, vals: {} })), source: null };

    // --- axes détectés + paramètres par défaut ---
    const axes = {};
    for (const t of tasks) if (t.id && !(t.id in axes)) axes[t.id] = defaultAxeName(t.id);
    const startMonth = periode.start ? monthOf(periode.start) : (planningRef.months.find((m, i) => planningRef.rows.some((r) => r[i])) || monthOf(localISO()));
    const endMonth = periode.end ? monthOf(periode.end) : addMonths(startMonth, 11);
    const iaIdx = profiles.findIndex((p) => /agent\s*ia/i.test(p.nom));
    // Regroupement proposé : ID si la colonne A contient des « AXE… », Phase si au moins 3 phases pèsent chacune ≥ 5 % de la charge, sinon Lot
    const real = tasks.filter((t) => !t.section), totalCh = sum(real.map((t) => sum(t.charges))) || 1;
    const phaseW = {}; real.forEach((t) => { if (t.phase) phaseW[t.phase] = (phaseW[t.phase] || 0) + sum(t.charges); });
    const bigPhases = Object.values(phaseW).filter((w) => w / totalCh >= 0.05).length;
    const lots = new Set(real.map((t) => t.lot).filter(Boolean));
    const groupBy = real.some((t) => /^axe/i.test(t.id)) ? 'id' : bigPhases >= 3 ? 'phase' : lots.size >= 2 ? 'lot' : 'id';
    // Fiche projet vide : on reprend le nom du fichier
    if (!fiche.client && !fiche.projet && fileName) {
      fiche.projet = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
      warnings.push('Fiche projet vide dans le TSP : le nom du fichier est utilisé comme nom de projet (modifiable dans TSP › Fiche).');
    }

    return {
      schema: SCHEMA,
      source: { fichier: fileName || 'TSP', importeLe: new Date().toISOString() },
      fiche, periode, remise, remiseSaisie, caInitial, pctPilotage, pctProvision, profiles, grille, tasks,
      planningPhases, planningPhasesTsp: JSON.parse(JSON.stringify(planningPhases)),
      types: TYPES_SOCLE.map((x) => ({ ...x })),
      meta: { id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), version: 0 }, journal: [],
      frais, achats, prestas, echeancier, metrique, planningRef, planningSource, planningTsp: JSON.parse(JSON.stringify(planningRef)), ref, axes,
      dates: { debut: periode.start || null, finContrat: periode.end || null, finPrevue: periode.end || null },
      settings: { startMonth, nbMonths: Math.max(13, monthsBetween(startMonth, endMonth) + 4), iaProfile: iaIdx, groupBy },
      track: {}, warnings,
    };
  }

  /** Lot tel qu'on le compare : « 3,.0 », « 3.0 » et 3 désignent le même lot ; vide si la tâche n'a pas de lot. */
  function normLot(l) {
    const x = String(l ?? '').trim().replace(/,/g, '.').replace(/\.{2,}/g, '.');
    if (!x) return '';
    return /^\d+(\.\d+)?$/.test(x) ? String(Number(x)) : x;
  }
  /** Libellé d'un lot sans titre dans le TSP : « Lot 4.0 », « Lot 4.1 ». */
  const libLot = (l) => `Lot ${/^[1-9]\d*$/.test(l) ? l + '.0' : l}`;
  /** Planning : les sous-parties d'un axe sont les lignes de titre du TSP (clés « sec|uid|axe » pour les dates, « sec|uid » pour le nom).
   *  Une version intermédiaire les rangeait par lot (clés « sp|axe|lot ») : ces saisies reviennent sur le titre de l'axe qui porte
   *  ce lot. Sans titre correspondant, elles restent dans le fichier sans être utilisées (signalées dans le détail de l'axe). */
  function migrerPlanning(p) {
    const P = p?.planning; if (!P) return;
    const titres = (p.tasks || []).filter((t) => t.section);
    const vers = (axe, lot) => { const sc = titres.find((t) => t.id === axe && normLot(t.lot) === lot); return sc ? sc.uid : null; };
    const conv = (o) => {
      const out = {};
      for (const [k, v] of Object.entries(o)) {
        if (!k.startsWith('sp|')) { out[k] = { ...(out[k] || {}), ...v }; continue; }
        const [, axe, lot] = k.split('|'), uid = vers(axe, lot);
        if (!uid) { out[k] = v; continue; }
        const { nom, ...dates } = v;
        if (Object.keys(dates).length) out[`sec|${uid}|${axe}`] = { ...dates, ...(out[`sec|${uid}|${axe}`] || {}) };
        if (nom) out[`sec|${uid}`] = { nom, ...(out[`sec|${uid}`] || {}) };
      }
      return out;
    };
    if (P.groupes && Object.keys(P.groupes).some((k) => k.startsWith('sp|'))) P.groupes = conv(P.groupes);
    if (P.avant && Object.keys(P.avant).some((k) => k.startsWith('sp|'))) {
      const A = {}; for (const k of Object.keys(P.avant)) { if (!k.startsWith('sp|')) { A[k] = 1; continue; } const [, axe, lot] = k.split('|'), uid = vers(axe, lot); if (uid) A[`sec|${uid}|${axe}`] = 1; } P.avant = A;
    }
    for (const r of p.references || []) if (r?.groupes && Object.keys(r.groupes).some((k) => k.startsWith('sp|'))) r.groupes = conv(r.groupes);
  }

  /** Met à niveau un suivi enregistré avec une version précédente de l'outil. */
  function migrate(p) {
    migrerPlanning(p);
    migrerRisques(p);
    const notes = [];
    let n = 0;
    for (const t of p.tasks || []) {
      const tr = p.track?.[t.uid];
      if (!tr || !tr.conso) continue;
      const tot = sum(t.charges);
      tr.consoP = tr.consoP || {};
      for (const [d, v] of Object.entries(tr.conso)) {
        t.charges.forEach((c, i) => { if (c > 0 && tot) { tr.consoP[i] = tr.consoP[i] || {}; tr.consoP[i][d] = round((num(v) * c) / tot, 6); } });
      }
      delete tr.conso; n++;
    }
    // textes d'import d'anciennes versions : mis à jour (le planning n'est plus modifiable dans le Plan de charge)
    if (Array.isArray(p.warnings)) p.warnings = p.warnings.map((w) => String(w)
      .replace(/\(?modifiable dans Finances › Plan de charge\)?/g, '(consultable en lecture seule dans Annexes › Planning)')
      .replace(/dans la Fiche projet/g, 'dans ⚙ Paramètres du projet › Dates du projet')
      .replace(/⚙ Paramètres ›/g, '⚙ Paramètres du projet ›'));
    // nouveautés Astrolabe : plannings de référence (Gantt), causes de décalage, fil des mises à jour
    if (!Array.isArray(p.references)) p.references = [];
    if (!Array.isArray(p.misesAJour)) p.misesAJour = [];
    if (n) notes.push(`${n} tâche(s) avaient un consommé global (ancienne version) : il a été réparti entre profils au prorata de la charge. Vérifiez la répartition.`);
    if (!p.meta) p.meta = { id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), version: 0 };
    if (!Array.isArray(p.journal)) p.journal = [];
    if (!Array.isArray(p.actions)) p.actions = [];
    if (!Array.isArray(p.decisions)) p.decisions = [];
    if (!Array.isArray(p.risques)) p.risques = [];
    if (!Array.isArray(p.historique)) p.historique = [];
    if (!p.meteo || typeof p.meteo !== 'object') p.meteo = {};
    if (!Array.isArray(p.achatsReel)) p.achatsReel = [];
    for (const tr of Object.values(p.track || {})) if (tr && STATUT_ALIAS[tr.statut]) tr.statut = STATUT_ALIAS[tr.statut];
    if (!Array.isArray(p.fraisReel)) p.fraisReel = [];
    if (!p.echTrack || typeof p.echTrack !== 'object') p.echTrack = {};
    if (!Array.isArray(p.types)) p.types = TYPES_SOCLE.map((x) => ({ ...x }));
    for (const s0 of TYPES_SOCLE) if (!p.types.some((x) => x.id === s0.id)) p.types.unshift({ ...s0 });
    if (!p.dates) p.dates = { debut: p.periode?.start || null, finContrat: p.periode?.end || null, finPrevue: p.periode?.end || null };
    if (p.planningRef && !p.planningTsp) p.planningTsp = JSON.parse(JSON.stringify(p.planningRef));
    if (!p.planningPhases) {
      const phases = p.ref?.phases?.length ? p.ref.phases : ['PILOTAGE', 'CONCEPTION', 'CONSTRUCTION', 'VALIDATION', 'FINALISATION', 'GARANTIE', 'TMA', 'PROVISION'];
      p.planningPhases = { rows: phases.map((ph) => ({ phase: ph, cjm: null, vals: {} })), source: null };
      p.planningPhasesTsp = JSON.parse(JSON.stringify(p.planningPhases));
    }
    p.schema = SCHEMA;
    return notes;
  }

  /** Lit un tableau « Profil | Charge par profil | CJM | Écart ? | mois… » (onglets PLANNING ou PILOTAGE CHARGES). */
  function readPlanningTable(sh, profiles) {
    let h = -1;
    for (let r = 0; r <= Math.min(sh.maxRow, 40); r++) if (norm(sh.g(r, 1)) === 'profil') { h = r; break; }
    if (h < 0) return null;
    const cols = [];
    for (let c = 2; c <= sh.maxCol; c++) { const d = toISO(sh.g(h, c)); if (d) cols.push([c, monthOf(d)]); }
    if (!cols.length) return null;
    const rows = profiles.map(() => cols.map(() => 0));
    const unknown = [], used = new Set();
    let pos = 0;
    for (let r = h + 1; r <= sh.maxRow; r++) {
      const name = str(sh.g(r, 1));
      if (norm(name).startsWith('total')) break;
      // deux profils de même nom (ex. deux architectes) : la 1re ligne va au 1er, la 2e au 2e
      let i = profiles.findIndex((p, k) => p.nom && norm(p.nom) === norm(name) && !used.has(k));
      if (i < 0 && !name) i = -1;
      if (i < 0 && name && name !== '0') unknown.push(name);
      if (i < 0 && (!name || name === '0') && pos < profiles.length && !profiles[pos].nom) i = pos;
      if (i >= 0) { rows[i] = cols.map(([c]) => num(sh.g(r, c))); used.add(i); }
      pos++;
    }
    return { months: cols.map((x) => x[1]), rows, unknown };
  }


  // ============================================================
  // TRAVAIL À PLUSIEURS : versions, fusion et journal
  // Principe : on « aplatit » les saisies en paires clé → valeur, puis on compare
  // la version de départ (base), la mienne et celle du fichier (theirs).
  // ============================================================
  const TRACK_FIELDS = ['label', 'iaType', 'statut', 'avancement', 'raf', 'debut', 'fin', 'commentaire', 'type', 'axe', 'phase', 'lot', 'iaRev', 'iaJustif', 'iaValide', 'valideLe', 'ech', 'annul', 'atelier'];
  /** Réglages du projet fusionnés un par un (une clé retirée d'un côté est retirée à la fusion). */
  const SETTINGS_FUSION = ['groupBy', 'iaProfile', 'iaLeviers', 'iaCauses', 'instances', 'startMonth', 'nbMonths', 'lastCoproj', 'alerteActionsJours', 'alerteEchJours', 'alerteAtelierJours', 'alerteLivrableJours'];
  function flatten(p) {
    const f = {};
    for (const [uid, tr] of Object.entries(p.track || {})) {
      for (const k of TRACK_FIELDS) if (tr[k] !== undefined) f[`t|${uid}|${k}`] = tr[k];
      for (const [i, o] of Object.entries(tr.consoP || {})) for (const [d, v] of Object.entries(o || {})) if (num(v)) f[`c|${uid}|${i}|${d}`] = num(v);
      for (const [i, v] of Object.entries(tr.chargeAjout || {})) if (num(v)) f[`a|${uid}|${i}`] = num(v);
      for (const [i, o] of Object.entries(tr.ajoutInfo || {})) if (o) f[`ai|${uid}|${i}`] = o;
      for (const r of tr.reaff || []) if (r && r.id) f[`ra|${uid}|${r.id}`] = r;
      // livrable : lien du document et validation client, champ par champ (deux personnes peuvent saisir l'un et l'autre)
      for (const [k, v] of Object.entries(tr.livr || {})) if (v !== undefined && v !== '') f[`lv|${uid}|${k}`] = v;
    }
    // actions et décisions (une entrée = un enregistrement)
    for (const a of p.actions || []) f[`ac|${a.id}`] = a;
    for (const d of p.decisions || []) f[`dc|${d.id}`] = d;
    // achats et frais réels (une ligne = un enregistrement)
    for (const a of p.achatsReel || []) f[`aq|${a.id}`] = a;
    for (const x of p.fraisReel || []) f[`fr|${x.id}`] = x;
    // risques, météo (projet et axes), historique des indicateurs à chaque comité
    for (const x of p.risques || []) f[`rk|${x.id}`] = x;
    for (const [k, v] of Object.entries(p.meteo || {})) if (v && v.niveau) f[`mt|${k}`] = v;
    for (const x of p.historique || []) f[`hs|${x.date}_${x.kind}`] = x;
    for (const [n, o] of Object.entries(p.echTrack || {})) if (o && Object.keys(o).length) f[`ec|${n}`] = o;
    // tâches et profils ajoutés en cours de projet
    for (const t of p.tasks || []) if (t.ajout) f[`nt|${t.uid}`] = taskDef(t);
    (p.profiles || []).forEach((pr, k) => { if (pr.ajout) f[`np|${k}`] = profDef(pr); });
    const pr = p.planningRef || { months: [], rows: [] };
    (pr.rows || []).forEach((row, i) => (pr.months || []).forEach((mk, k) => { if (num(row?.[k])) f[`p|${i}|${mk}`] = num(row[k]); }));
    (p.planningPhases?.rows || []).forEach((r) => Object.entries(r.vals || {}).forEach(([mk, v]) => { if (num(v)) f[`ph|${r.phase}|${mk}`] = num(v); }));
    for (const [id, n] of Object.entries(p.axes || {})) if (n) f[`ax|${id}`] = n;
    // planning : dates prévues (et nom d'une sous-partie) par groupe, jalons (un enregistrement chacun)
    for (const [cle, v] of Object.entries(p.planning?.groupes || {})) {
      const o = {}; for (const k of ['debut', 'fin', 'nom']) if (v?.[k]) o[k] = v[k];
      if (Object.keys(o).length) f[`pg|${cle}`] = o;
    }
    for (const j of p.planning?.jalons || []) if (j && j.id) f[`jl|${j.id}`] = j;
    // éléments mis en avant sur le planning (tâche « tache|uid », sous-partie « sec|uid|axe ») : un enregistrement chacun
    for (const [cle, v] of Object.entries(p.planning?.avant || {})) if (v) f[`pa|${cle}`] = 1;
    // lignes masquées du planning (« id|AXE1 », « phase|X »…) : un enregistrement chacune ; masquer n'enlève rien au suivi
    for (const [cle, v] of Object.entries(p.planning?.masque || {})) if (v) f[`pm|${cle}`] = 1;
    for (const [k, v] of Object.entries(p.dates || {})) if (v) f[`d|${k}`] = v;
    for (const k of ['client', 'projet', 'reference']) if (p.fiche?.[k]) f[`f|${k}`] = p.fiche[k];
    // absences (Pilotage › Absences) : une demi-journée ou une journée par personne et par jour ; « j » journée, « m » matin, « a » après-midi
    for (const [per, o] of Object.entries(p.absences || {})) for (const [d, v] of Object.entries(o || {})) if (v) f[`ab|${encodeURIComponent(per)}|${d}`] = v;
    // personnes ajoutées à la main dans Absences (hors profils) : un enregistrement chacune
    for (const n of p.equipeSup || []) if (n) f[`eq|${encodeURIComponent(n)}`] = 1;
    for (const k of SETTINGS_FUSION) if (p.settings?.[k] !== undefined) f[`s|${k}`] = p.settings[k];
    for (const t of p.types || []) f[`ty|${t.id}`] = t.nom;
    // plannings de référence (figés, non modifiables) et, pour chaque tâche, la cause et le motif de son écart
    for (const r of p.references || []) {
      const lignes = {};
      for (const [uid, l] of Object.entries(r.lignes || {})) {
        lignes[uid] = { debut: l.debut ?? null, fin: l.fin ?? null, charge: l.charge ?? 0 };
        for (const k of ['cause', 'motif']) if (l[k]) f[`rd|${r.id}|${uid}|${k}`] = l[k];
      }
      f[`rf|${r.id}`] = { id: r.id, date: r.date, libelle: r.libelle, par: r.par || '', lignes, ...(r.groupes ? { groupes: r.groupes } : {}) };
    }
    // fil des mises à jour des tâches (un message = un enregistrement)
    for (const m of p.misesAJour || []) f[`mj|${m.id}`] = m;
    // point hebdo : réglages (équipe, logos) champ par champ, et un enregistrement par période (semaine ou mois)
    for (const [k, v] of Object.entries(p.pointsHebdo?.reglages || {})) if (v !== undefined && v !== '' && v !== null) f[`pr|${k}`] = v;
    for (const [k, v] of Object.entries(p.pointsHebdo?.periodes || {})) if (v) f[`pt|${k}`] = v;
    // Copie profonde : la « base » ne doit jamais partager d'objet avec le projet en cours,
    // sinon une modification sur place (action, risque, achat…) serait invisible à la fusion.
    return JSON.parse(JSON.stringify(f));
  }
  const taskDef = (t) => ({ id: t.id || '', lot: t.lot || '', phase: t.phase || '', etape: t.etape || '', label: t.label, hypothese: t.hypothese || '', ajout: t.ajout });
  const profDef = (pr) => ({ nom: pr.nom, entite: pr.entite, tjm: pr.tjm, cjm: pr.cjm, collaborateur: pr.collaborateur || '', ajout: pr.ajout });
  /** Crée l'objet tâche d'une tâche ajoutée (même forme qu'une ligne du WORKLOAD, sans charge vendue). */
  const newTaskObj = (uid, d) => ({ uid, ligne: null, id: d.id || '', lot: d.lot || '', phase: (d.phase || '').toUpperCase(), etape: d.etape || '', label: d.label, charges: [], section: false, livrable: '', hypothese: d.hypothese || '', ajout: d.ajout });
  /** Insère une tâche ajoutée juste après sa tâche d'ancrage (ou à la fin), après les ajouts déjà insérés au même endroit. */
  function insertTask(tasks, t) {
    let k = tasks.findIndex((x) => x.uid === t.ajout?.after);
    if (k < 0) { tasks.push(t); return; }
    while (k + 1 < tasks.length && tasks[k + 1].ajout && tasks[k + 1].ajout.after === t.ajout.after) k++;
    tasks.splice(k + 1, 0, t);
  }
  /** Renumérote des profils (ancien index → nouvel index) partout où l'index sert de clé. */
  function remapProfiles(p, map) {
    const q = JSON.parse(JSON.stringify(p));
    const mv = (o) => { if (!o) return o; const r = {}; for (const [k, v] of Object.entries(o)) r[map[k] ?? k] = v; return r; };
    const profs = [];
    q.profiles.forEach((pr, k) => { profs[map[k] ?? k] = pr; });
    q.profiles = Array.from({ length: profs.length }, (_, k) => profs[k] || { nom: '', entite: 'FO', tjm: 0, cjm: 0, prcs: null, frais: 0, collaborateur: '' });
    for (const tr of Object.values(q.track || {})) { tr.consoP = mv(tr.consoP); if (tr.chargeAjout) tr.chargeAjout = mv(tr.chargeAjout); if (tr.ajoutInfo) tr.ajoutInfo = mv(tr.ajoutInfo); if (tr.reaff) tr.reaff = tr.reaff.map((r) => ({ ...r, de: map[r.de] ?? r.de, vers: map[r.vers] ?? r.vers })); }
    if (q.planningRef?.rows) { const rows = []; q.planningRef.rows.forEach((r, k) => { rows[map[k] ?? k] = r; }); q.planningRef.rows = Array.from({ length: q.profiles.length }, (_, k) => rows[k] || q.planningRef.months.map(() => 0)); }
    if (q.settings && map[q.settings.iaProfile] != null) q.settings.iaProfile = map[q.settings.iaProfile];
    return q;
  }
  /**
   * Avant une fusion : si un collègue a ajouté des profils pendant que j'en ajoutais aussi,
   * les miens risquent d'avoir le même numéro que les siens → je décale les miens après les siens.
   */
  function reconcileProfiles(baseFlat, mine, theirs) {
    const id = (pr) => `${pr.ajout?.at}|${pr.nom}`;
    const inBase = new Set(Object.keys(baseFlat).filter((k) => k.startsWith('np|')).map((k) => +k.split('|')[1]));
    const theirIds = new Set((theirs.profiles || []).filter((x) => x.ajout).map(id));
    const mineNew = mine.profiles.map((pr, k) => [pr, k]).filter(([pr, k]) => pr.ajout && !inBase.has(k) && !theirIds.has(id(pr)));
    const n = (theirs.profiles || []).length;
    if (!mineNew.length || mineNew.every(([, k]) => k >= n)) return mine;
    const map = {};
    mineNew.forEach(([, k], j) => { map[k] = n + j; });
    return remapProfiles(mine, map);
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** Fusion à trois voies. Un conflit = la même donnée modifiée différemment des deux côtés. */
  function merge3(base, mine, theirs) {
    const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]);
    const merged = {}, conflicts = [];
    let fromThem = 0;
    for (const k of keys) {
      const b = base[k], m = mine[k], t = theirs[k];
      let v;
      if (same(m, t)) v = m;
      else if (same(m, b)) { v = t; fromThem++; }
      else if (same(t, b)) v = m;
      else { conflicts.push({ key: k, base: b, mine: m, theirs: t }); v = m; }
      if (v !== undefined) merged[k] = v;
    }
    return { merged, conflicts, fromThem };
  }
  /** Reconstruit les saisies du projet à partir des paires clé → valeur fusionnées. */
  function applyFlat(p, f) {
    const q = JSON.parse(JSON.stringify(p));
    q.track = {};
    const tr = (uid) => (q.track[uid] = q.track[uid] || {});
    const months = new Set(q.planningRef?.months || []);
    const plan = {}, phs = {};
    q.axes = {}; q.dates = { debut: null, finContrat: null, finPrevue: null };
    q.fiche = q.fiche || {}; ['client', 'projet', 'reference'].forEach((k) => { q.fiche[k] = ''; });
    const types = [], newTasks = [], newProfs = [], acts = [], decs = [], ech = {}, achs = [], frs = [], rks = [], hss = [], refs = {}, refD = [], majs = [];
    q.settings = { ...(q.settings || {}) }; SETTINGS_FUSION.forEach((k) => delete q.settings[k]);
    q.pointsHebdo = { reglages: {}, periodes: {} };
    const planG = {}, jls = [], avant = {}, masque = {}, abs = {}, eq = [];
    for (const [k, v] of Object.entries(f)) {
      const parts = k.split('|');
      if (parts[0] === 't') tr(parts[1])[parts[2]] = v;
      else if (parts[0] === 'a') { const o = tr(parts[1]); (o.chargeAjout = o.chargeAjout || {})[parts[2]] = v; }
      else if (parts[0] === 'ai') { const o = tr(parts[1]); (o.ajoutInfo = o.ajoutInfo || {})[parts[2]] = v; }
      else if (parts[0] === 'nt') newTasks.push([parts[1], v]);
      else if (parts[0] === 'ac') acts.push(v);
      else if (parts[0] === 'dc') decs.push(v);
      else if (parts[0] === 'aq') achs.push(v);
      else if (parts[0] === 'fr') frs.push(v);
      else if (parts[0] === 'rk') rks.push(v);
      else if (parts[0] === 'hs') hss.push(v);
      else if (parts[0] === 'mt') (q.meteo = q.meteo || {})[parts[1]] = v;
      else if (parts[0] === 'ec') ech[parts[1]] = v;
      else if (parts[0] === 'np') newProfs.push([+parts[1], v]);
      else if (parts[0] === 'c') { const o = tr(parts[1]); o.consoP = o.consoP || {}; (o.consoP[parts[2]] = o.consoP[parts[2]] || {})[parts[3]] = v; }
      else if (parts[0] === 'p') { months.add(parts[2]); (plan[parts[1]] = plan[parts[1]] || {})[parts[2]] = v; }
      else if (parts[0] === 'ph') (phs[parts[1]] = phs[parts[1]] || {})[parts[2]] = v;
      else if (parts[0] === 'ax') q.axes[parts[1]] = v;
      else if (parts[0] === 'd') q.dates[parts[1]] = v;
      else if (parts[0] === 'f') q.fiche[parts[1]] = v;
      else if (parts[0] === 's') q.settings[parts[1]] = v;
      else if (parts[0] === 'ty') types.push([parts[1], v]);
      else if (parts[0] === 'rf') refs[parts[1]] = JSON.parse(JSON.stringify(v));
      else if (parts[0] === 'rd') refD.push([parts[1], parts[2], { [parts[3]]: v }]);
      else if (parts[0] === 'ra') { const o = tr(parts[1]); (o.reaff = o.reaff || []).push(v); }
      else if (parts[0] === 'lv') { const o = tr(parts[1]); (o.livr = o.livr || {})[parts[2]] = v; }
      else if (parts[0] === 'mj') majs.push(v);
      else if (parts[0] === 'pr') (q.pointsHebdo.reglages[parts[1]] = v);
      else if (parts[0] === 'pt') (q.pointsHebdo.periodes[parts.slice(1).join('|')] = v);
      else if (parts[0] === 'pg') planG[parts.slice(1).join('|')] = { ...v };
      else if (parts[0] === 'jl') jls.push(JSON.parse(JSON.stringify(v)));
      else if (parts[0] === 'pa') avant[parts.slice(1).join('|')] = 1;
      else if (parts[0] === 'pm') masque[parts.slice(1).join('|')] = 1;
      else if (parts[0] === 'eq') eq.push(decodeURIComponent(parts[1]));
      else if (parts[0] === 'ab') { const per = decodeURIComponent(parts[1]); (abs[per] = abs[per] || {})[parts[2]] = v; }
    }
    // absences : présentes seulement s'il y en a (un suivi qui ne s'en sert pas reste identique)
    if (Object.keys(abs).length) q.absences = abs; else delete q.absences;
    if (eq.length) q.equipeSup = eq.sort((a, b) => a.localeCompare(b, 'fr')); else delete q.equipeSup;
    // planning : présent seulement s'il contient quelque chose (un suivi qui ne s'en sert pas reste identique)
    if (Object.keys(planG).length || jls.length || Object.keys(avant).length || Object.keys(masque).length) {
      q.planning = {};
      if (Object.keys(planG).length) q.planning.groupes = planG;
      if (jls.length) q.planning.jalons = jls.sort((a, b) => String(a.debut || '').localeCompare(String(b.debut || '')) || String(a.id).localeCompare(String(b.id)));
      if (Object.keys(avant).length) q.planning.avant = avant;
      if (Object.keys(masque).length) q.planning.masque = masque;
    }
    else delete q.planning;
    refD.forEach(([id, uid, v]) => { const l = refs[id]?.lignes?.[uid]; if (l) Object.assign(l, v); });
    for (const o of Object.values(q.track)) if (o.reaff) o.reaff.sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
    q.references = Object.values(refs).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
    q.misesAJour = majs.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const byRef = (a, b) => String(a.ref || '').localeCompare(String(b.ref || ''), 'fr', { numeric: true }) || String(a.cree || '').localeCompare(String(b.cree || ''));
    q.actions = acts.sort(byRef); q.decisions = decs.sort(byRef); q.echTrack = ech;
    const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.cree || '').localeCompare(String(b.cree || ''));
    q.achatsReel = achs.sort(byDate); q.fraisReel = frs.sort(byDate);
    q.risques = rks.sort(byRef); q.historique = hss.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.kind).localeCompare(String(b.kind)));
    // profils : ceux du TSP + ceux ajoutés (à leur numéro)
    q.profiles = (q.profiles || []).filter((x) => !x.ajout);
    newProfs.sort((a, b) => a[0] - b[0]).forEach(([k, d]) => { q.profiles[k] = { prcs: null, frais: 0, ...d }; });
    q.profiles = Array.from({ length: q.profiles.length }, (_, k) => q.profiles[k] || { nom: '', entite: 'FO', tjm: 0, cjm: 0, prcs: null, frais: 0, collaborateur: '' });
    // tâches : celles du TSP + celles ajoutées, à leur place
    q.tasks = (q.tasks || []).filter((t) => !t.ajout);
    newTasks.sort((a, b) => String(a[1].ajout?.at).localeCompare(String(b[1].ajout?.at))).forEach(([uid, d]) => insertTask(q.tasks, newTaskObj(uid, d)));
    const ms = [...months].sort();
    q.planningRef = { months: ms, rows: (q.profiles || []).map((_, i) => ms.map((mk) => plan[i]?.[mk] || 0)) };
    if (q.planningPhases) {
      const rows = q.planningPhases.rows || [];
      Object.keys(phs).forEach((ph) => { if (!rows.some((r) => r.phase === ph)) rows.push({ phase: ph, cjm: null, vals: {} }); });
      rows.forEach((r) => { r.vals = { ...(phs[r.phase] || {}) }; });
      q.planningPhases.rows = rows;
    }
    const order = (p.types || []).map((t) => t.id);
    q.types = types.sort((a, b) => ((order.indexOf(a[0]) + 1 || 999) - (order.indexOf(b[0]) + 1 || 999)))
      .map(([id, nom]) => ({ id, nom, ...(TYPES_SOCLE.some((x) => x.id === id) ? { socle: true } : {}) }));
    for (const s0 of TYPES_SOCLE) if (!q.types.some((x) => x.id === s0.id)) q.types.unshift({ ...s0 });
    (q.fiche.champs || []).forEach((c) => { if (c.key && c.key in q.fiche) c.value = q.fiche[c.key]; });
    return q;
  }
  const SETTING_LBL = { instances: 'Instances de gouvernance', groupBy: 'Regrouper par', iaProfile: 'Profil Agent IA', iaLeviers: 'Leviers d’optimisation IA', iaCauses: 'Causes de dépassement IA', startMonth: 'Premier mois du planning', nbMonths: 'Nombre de mois', lastCoproj: 'Dernier COPROJ', alerteActionsJours: 'Alerte actions (jours)', alerteEchJours: 'Alerte échéances (jours)', alerteAtelierJours: 'Alerte ateliers (jours)', alerteLivrableJours: 'Alerte livrables (jours)' };
  /** Libellé lisible d'une clé (pour la liste des conflits et le journal). */
  function describeKey(p, key) {
    const parts = key.split('|');
    const task = (uid) => (p.tasks || []).find((t) => t.uid === uid)?.label || uid;
    const prof = (i) => p.profiles?.[+i]?.nom || `profil ${+i + 1}`;
    const FIELD = { label: 'intitulé', statut: 'statut', avancement: 'avancement', raf: 'reste à faire', debut: 'début prévu', fin: 'fin prévue', commentaire: 'commentaire', type: 'type', axe: 'axe', phase: 'phase', lot: 'lot', iaRev: 'charge IA révisée', iaJustif: 'commentaire IA', iaType: 'type d’optimisation IA', iaValide: 'gain IA accepté', annul: 'annulation', ech: 'échéance liée', atelier: 'organisation de l’atelier', livr: 'suivi du livrable' };
    const d = (x) => (x ? x.split('-').reverse().join('/') : '');
    switch (parts[0]) {
      case 't': return `${task(parts[1])} — ${FIELD[parts[2]] || parts[2]}`;
      case 'c': return `${task(parts[1])} — consommé ${prof(parts[2])} le ${d(parts[3])}`;
      case 'a': return `${task(parts[1])} — charge ajoutée ${prof(parts[2])}`;
      case 'ai': return `${task(parts[1])} — motif de l’ajout ${prof(parts[2])}`;
      case 'nt': return `Tâche ajoutée « ${task(parts[1])} »`;
      case 'np': return `Profil ajouté « ${prof(parts[1])} »`;
      case 'ac': { const a = (p.actions || []).find((x) => x.id === parts[1]); return `Action ${a?.ref || ''} « ${a?.libelle || ''} »`; }
      case 'ec': return `Échéance n° ${parts[1]}`;
      case 'aq': { const a = (p.achatsReel || []).find((x) => x.id === parts[1]); return `Achat « ${a?.designation || ''} »`; }
      case 'rk': { const a = (p.risques || []).find((x) => x.id === parts[1]); return `Risque ${a?.ref || ''} « ${a?.libelle || ''} »`; }
      case 'mt': return parts[1] === '__projet' ? 'Météo du projet' : `Météo de l’axe ${parts[1]}`;
      case 'hs': return `Historique ${parts[1].replace('_', ' ')}`;
      case 'fr': { const a = (p.fraisReel || []).find((x) => x.id === parts[1]); return `Frais « ${a?.libelle || ''} »${a?.date ? ' du ' + d(a.date) : ''}`; }
      case 'dc': { const x = (p.decisions || []).find((y) => y.id === parts[1]); return `Décision ${x?.ref || ''} « ${x?.libelle || ''} »`; }
      case 'p': return `Prévisionnel de charge ${prof(parts[1])} — ${parts[2]}`;
      case 'ph': return `Planning phase ${parts[1]} — ${parts[2]}`;
      case 'ax': return `Nom de l’axe ${parts[1]}`;
      case 'pg': { const c = parts.slice(1).join('|'); if (c.startsWith('sp|')) return `Planning — ${p.planning?.groupes?.[c]?.nom || libLot(parts[3])} (axe ${parts[2]})`; if (c.startsWith('sec|')) { const u = c.split('|')[1]; return `Planning — sous-partie « ${p.planning?.groupes?.[`sec|${u}`]?.nom || task(u)} »${c.split('|').length > 2 ? ' (dates)' : ' (nom)'}`; } return `Planning — dates prévues de ${c.startsWith('id|') ? 'l’axe' : c.startsWith('lot|') ? 'le lot' : 'la phase'} ${c.split('|').slice(1).join('|') || '(sans groupe)'}`; }
      case 'jl': { const j = (p.planning?.jalons || []).find((x) => x.id === parts[1]); return `Jalon « ${j?.libelle || ''} »`; }
      case 'pm': return `Planning — ligne « ${parts[1] === 'id' ? (p.axes?.[parts[2]] || defaultAxeName(parts[2]) || 'Sans axe') : parts.slice(2).join('|') || 'sans groupe'} » masquée`;
      case 'pa': return parts[1] === 'sp' ? `Planning — ${p.planning?.groupes?.[parts.slice(1).join('|')]?.nom || libLot(parts[3])} (axe ${parts[2]}) mise en avant` : parts[1] === 'tache' ? `${task(parts[2])} — mise en avant sur le planning` : `Planning — sous-partie « ${p.planning?.groupes?.[`sec|${parts[2]}`]?.nom || task(parts[2])} » mise en avant`;
      case 'ab': return `Absence de ${decodeURIComponent(parts[1])} le ${d(parts[2])}`;
      case 'eq': return `Personne ajoutée aux absences : ${decodeURIComponent(parts[1])}`;
      case 'd': return `Dates du projet — ${({ debut: 'début', finContrat: 'fin contractuelle', finPrevue: 'fin prévue' })[parts[1]] || parts[1]}`;
      case 'f': return `Fiche projet — ${({ client: 'client', projet: 'projet', reference: 'référence' })[parts[1]] || parts[1]}`;
      case 's': return `Paramètre « ${SETTING_LBL[parts[1]] || parts[1]} »`;
      case 'ty': return `Type de tâche ${parts[1]}`;
      case 'rf': return `Planning de référence « ${(p.references || []).find((r) => r.id === parts[1])?.libelle || parts[1]} »`;
      case 'rd': return `${task(parts[2])} — ${parts[3] === 'motif' ? 'motif' : 'cause'} du décalage`;
      case 'ra': return `${task(parts[1])} — réaffectation de charge`;
      case 'lv': return `${task(parts[1])} — ${parts[2] === 'lien' ? 'document livré' : 'validation client'}`;
      case 'mj': return `Mise à jour d’une tâche`;
      case 'pr': return `Point hebdo — ${({ avv: 'AVV', pilote: 'pilote delivery', commercial: 'commercial', modeFacturation: 'mode de facturation', logoClient: 'logo du client', logoEntreprise: 'logo de l’entreprise' })[parts[1]] || parts[1]}`;
      case 'pt': { const c = parts.slice(1).join('|'); return c.startsWith('M:') ? `Point mensuel ${c.slice(2)}` : `Point hebdo de la semaine du ${d(c.slice(2))}`; }
      default: return key;
    }
  }
  /** Résumé des modifications entre deux états, pour le journal. */
  function summarizeChanges(before, after) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const cnt = {};
    const add = (label) => { cnt[label] = (cnt[label] || 0) + 1; };
    for (const k of keys) {
      if (same(before[k], after[k])) continue;
      const [kind, , field] = k.split('|');
      if (kind === 'c') add('saisie(s) de consommé');
      else if (kind === 'a' || kind === 'ai') add('charge(s) ajoutée(s) à une tâche');
      else if (kind === 'nt') add(before[k] === undefined ? 'tâche(s) créée(s)' : after[k] === undefined ? 'tâche(s) supprimée(s)' : 'tâche(s) ajoutée(s) modifiée(s)');
      else if (kind === 'np') add('profil(s) ajouté(s)');
      else if (kind === 'ac') add('action(s)');
      else if (kind === 'dc') add('décision(s)');
      else if (kind === 'ec') add('échéance(s) de facturation');
      else if (kind === 'aq') add('achat(s)');
      else if (kind === 'fr') add('frais');
      else if (kind === 'ab') add('absence(s)');
      else if (kind === 'eq') add('personne(s) ajoutée(s)');
      else if (kind === 'rk') add('risque(s)');
      else if (kind === 'mt') add('météo');
      else if (kind === 'hs') add('photo(s) d’indicateurs');
      else if (kind === 'rf') add('planning(s) de référence figé(s)');
      else if (kind === 'rd') add('motif(s) de décalage');
      else if (kind === 'lv') add('livrable(s)');
      else if (kind === 'ra') add('réaffectation(s) de charge');
      else if (kind === 'mj') add('mise(s) à jour de tâche');
      else if (kind === 'pt' || kind === 'pr') add('point(s) hebdo');
      else if (kind === 'pg') add('date(s) de planning');
      else if (kind === 'jl') add('jalon(s)');
      else if (kind === 'pa') add('élément(s) mis en avant sur le planning');
      else if (kind === 'pm') add('ligne(s) masquée(s) sur le planning');
      else if (kind === 't') add({ statut: 'statut(s)', avancement: 'avancement(s)', raf: 'reste(s) à faire', commentaire: 'commentaire(s)', debut: 'date(s)', fin: 'date(s)', type: 'type(s)', annul: 'annulation(s) de tâche', atelier: 'organisation(s) d’atelier', livr: 'suivi(s) de livrable' }[field] || 'autre(s) champ(s) de tâche');
      else if (kind === 'p') add('valeur(s) du prévisionnel de charge');
      else if (kind === 'ph') add('valeur(s) de planning');
      else add('paramètre(s)');
    }
    return Object.entries(cnt).map(([l, n]) => `${n} ${l}`).join(', ');
  }

  const aLibelle = (x) => !!String(x?.libelle || '').trim();
  function defaultAxeName(id) {
    if (id === '0') return 'Pilotage (transverse)';
    const m = /^axe\s*(\d+)/i.exec(id);
    return m ? `Axe ${m[1]}` : id;
  }

  function detectType(t) {
    const l = t.label.toLowerCase();
    // TSP dont la colonne « Livrable » est renseignée : livrable si et seulement si « oui » ; les ateliers restent reconnus par le titre
    if (t.livCol) return t.livrable === 'oui' ? 'Livrable' : /^\s*\[\s*atelier/.test(l) || /^\s*(atelier|session|webinar|workshop)/.test(l) || /\batelier/.test(l) ? 'Atelier' : '';
    if (/^\s*\[\s*livrable/.test(l)) return 'Livrable';
    if (/^\s*\[\s*atelier/.test(l)) return 'Atelier';
    if (/^\s*(atelier|session|webinar|workshop)/.test(l)) return 'Atelier';
    if (/^\s*livrable/.test(l)) return 'Livrable';
    if (t.livrable === 'oui') return 'Livrable';
    if (/\batelier/.test(l)) return 'Atelier';
    if (/\blivrable/.test(l)) return 'Livrable';
    return '';
  }

  // ============================================================
  // 2. CALCULS
  // ============================================================
  /**
   * Avancement d'un ensemble de tâches (axe, lot, phase, échéance, projet) : JH des tâches validées ÷ JH prévus.
   * Seules les tâches validées comptent (une tâche de 8 JH pèse plus qu'une tâche de 0,5 JH). L'avancement déclaré
   * d'une tâche (paliers 0 à 100 %) reste une indication sur la tâche : il n'entre dans aucun pourcentage de groupe.
   */
  const avValide = (list) => { const p = sum(list.map((t) => t.charge || 0)); return p ? sum(list.filter((t) => !t.annulee && t.statut === 'Validé').map((t) => t.charge || 0)) / p : 0; };
  function compute(p) {
    const S = p.settings;
    const remise = p.remise || 0;
    const P = p.profiles.map((pr, i) => ({ ...pr, i, nomBase: pr.nom, tjmR: pr.tjm * (1 - remise) }));
    // Un profil = une personne. Deux profils de même intitulé (ex. deux architectes) restent distincts :
    // on les différencie à l'affichage par le collaborateur, à défaut par un numéro.
    const nomCount = {};
    P.forEach((x) => { if (x.nom) nomCount[x.nom] = (nomCount[x.nom] || 0) + 1; });
    const seen = {};
    P.forEach((x) => { if (x.nom && nomCount[x.nom] > 1) { seen[x.nom] = (seen[x.nom] || 0) + 1; x.nom = x.collaborateur ? `${x.nom} — ${x.collaborateur}` : `${x.nom} ${seen[x.nom]}`; } });
    const nP = P.length;
    // Dates du projet : début, fin contractuelle (TSP, fixe) et fin prévue (peut glisser)
    const D = p.dates || {};
    const finRef = D.finPrevue || D.finContrat || null;
    const m0 = D.debut ? monthOf(D.debut) : S.startMonth || monthOf(localISO());
    const m1 = finRef ? [D.finPrevue, D.finContrat].filter(Boolean).map(monthOf).sort().pop() : addMonths(S.startMonth || m0, (S.nbMonths || 1) - 1);
    // mois contenant des données hors période : on les garde visibles pour ne rien perdre
    const dataMonths = new Set();
    for (const t of p.tasks) {
      const tr0 = p.track[t.uid]; if (!tr0) continue;
      for (const o of Object.values(tr0.consoP || {})) for (const [d, v] of Object.entries(o || {})) if (num(v)) dataMonths.add(monthOf(d));
      if (tr0.debut) dataMonths.add(monthOf(tr0.debut)); if (tr0.fin) dataMonths.add(monthOf(tr0.fin));
    }
    (p.planningRef?.months || []).forEach((mk, k) => { if ((p.planningRef.rows || []).some((r) => num(r?.[k]))) dataMonths.add(mk); });
    (p.planningTsp?.months || []).forEach((mk, k) => { if ((p.planningTsp.rows || []).some((r) => num(r?.[k]))) dataMonths.add(mk); });
    (p.planningPhases?.rows || []).forEach((r) => Object.entries(r.vals || {}).forEach(([mk, v]) => { if (num(v)) dataMonths.add(mk); }));
    const allM = [m0, m1, ...dataMonths].sort();
    const months = []; for (let mk = allM[0]; mk <= allM[allM.length - 1]; mk = addMonths(mk, 1)) months.push(mk);
    const inProjet = (mk) => mk >= m0 && mk <= m1;
    const horsProjetMois = months.filter((mk) => !inProjet(mk) && dataMonths.has(mk));
    const mIndex = Object.fromEntries(months.map((m, i) => [m, i]));
    const iaIdx = S.iaProfile ?? -1;

    // ---- tâches ----
    const typeIds = new Set((p.types || TYPES_SOCLE).map((x) => x.id));
    const typeOf = (tr, t) => { const v = tr.type != null ? tr.type : detectType(t); return v && typeIds.has(v) ? v : ''; };
    const tasks = [], sections = [];
    for (const t of p.tasks) {
      if (t.section) { sections.push(t); continue; }
      const tr = p.track[t.uid] || {};
      // Charge vendue (TSP) + charge ajoutée en cours de projet (non facturée : elle ne change pas le CA)
      const chargesV = P.map((_, i) => num(t.charges?.[i]));
      const chargesA = P.map((_, i) => num(tr.chargeAjout?.[i]));
      // Réaffectation : une partie de la charge d'un profil est confiée à un autre (même total, coût au CJM de la personne qui fait le travail)
      const reaff = (tr.reaff || []).filter((r) => r && num(r.jh) > 0 && P[r.de] && P[r.vers]);
      const chargesR = P.map(() => 0);
      for (const r of reaff) { chargesR[r.de] -= num(r.jh); chargesR[r.vers] += num(r.jh); }
      const chargesPrev = chargesV.map((v, i) => v + chargesA[i] + chargesR[i]);
      const coutReaff = sum(chargesR.map((c, i) => c * (P[i]?.cjm || 0)));
      const chargeTSP = sum(chargesV), chargeAjout = sum(chargesA);
      // consommé saisi par profil : consoP[indexProfil][date] = jours
      const cp = tr.consoP || {};
      const consoP = P.map((_, i) => sum(Object.values(cp[i] || {}).map(num)));
      // Tâche annulée : seul le consommé (réellement travaillé) reste dans la charge ; le reste est annulé.
      const annul = tr.annul || null;
      const chargesAnnul = annul ? chargesPrev.map((c, i) => Math.max(c - consoP[i], 0)) : P.map(() => 0);
      const charges = annul ? consoP.slice() : chargesPrev;
      const charge = sum(charges), chargeInit = sum(chargesPrev), chargeAnnulee = sum(chargesAnnul);
      const valo = sum(chargesV.map((c, i) => c * (P[i]?.tjmR || 0)));
      const coutPrevu = sum(charges.map((c, i) => c * (P[i]?.cjm || 0)));
      const coutPrevuTSP = sum(chargesV.map((c, i) => c * (P[i]?.cjm || 0)));
      const coutAjout = sum(chargesA.map((c, i) => c * (P[i]?.cjm || 0)));
      const coutAnnule = sum(chargesAnnul.map((c, i) => c * (P[i]?.cjm || 0)));
      // avenant de réduction : le CA baisse de la part vendue non réalisée
      const caAvenant = annul?.avenant ? sum(chargesAnnul.map((c, i) => Math.min(c, chargesV[i]) * (P[i]?.tjmR || 0))) : 0;
      const cjmMoyen = charge ? coutPrevu / charge : 0;
      const tjmMoyen = charge ? valo / charge : 0;
      const dayTot = {};
      for (const k of Object.keys(cp)) for (const [d, v] of Object.entries(cp[k] || {})) if (num(v) > 0) dayTot[d] = (dayTot[d] || 0) + num(v);
      const dates = Object.keys(dayTot).sort();
      const consoTotal = sum(consoP);
      // Statut : celui choisi par le chef de projet ; à défaut, « En cours » dès qu'il y a du consommé
      const statut = annul ? 'Annulée' : STATUT_ALIAS[tr.statut] || tr.statut || (consoTotal > 0 ? 'En cours' : 'À faire');
      // Enveloppe IA : la charge Agent IA est adossée aux profils humains de la tâche ; c'est une réserve qu'on ne veut pas toucher.
      // IA consommée = max(consommé total de la tâche − charge des autres profils ; 0) : la saisie directe sur le profil
      // Agent IA reste permise et compte dans le consommé total ; un profil sous sa charge la compense (règle validée).
      const ia = !annul && iaIdx >= 0 ? charges[iaIdx] || 0 : 0;
      const iaHum = Math.max(0, charge - ia);
      const consoIA = iaIdx >= 0 ? consoP[iaIdx] || 0 : 0;
      const iaConso = ia > 0 ? Math.max(0, consoTotal - iaHum) : 0; // consoIA : saisie directe, incluse dans consoTotal
      // Reste par profil : nul quand la tâche est terminée (validée ou annulée), comme le reste de la tâche.
      // Profil Agent IA : reste = enveloppe − IA déjà consommée (le dépassement humain « mange » la réserve).
      const restP = statut === 'Validé' || annul ? charges.map(() => 0)
        : charges.map((c, i) => (ia > 0 && i === iaIdx ? Math.max(ia - iaConso, 0) : Math.max(c - consoP[i], 0)));
      const restSum = sum(restP);
      const restHum = restSum - (ia > 0 ? restP[iaIdx] || 0 : 0);
      const cjmReste = restSum ? sum(restP.map((r, i) => r * (P[i]?.cjm || 0))) / restSum : cjmMoyen;
      const iaRev = tr.iaRev === '' || tr.iaRev == null ? null : num(tr.iaRev);
      const iaGain = iaRev == null ? null : Math.max(0, ia - iaRev);
      const iaValide = tr.iaValide === 'Oui';
      const gainRetenu = 0; // ancien « gain accepté » : remplacé par la mesure de l'enveloppe IA (voir plus bas)
      const fini = statut === 'Validé' || statut === 'Annulée';
      // RAF automatique calculé profil par profil : un profil en dépassement ne compense pas un profil qui n'a pas travaillé
      const rafAuto = fini ? 0 : Math.max(restSum - gainRetenu, 0);
      // Une tâche validée ou annulée est terminée : son reste à faire est toujours 0, même si un RAF avait été saisi.
      const rafSaisi = fini || tr.raf === '' || tr.raf == null ? null : num(tr.raf);
      const raf = rafSaisi ?? rafAuto;
      const atterrissage = consoTotal + raf;
      // Résultat IA = enveloppe − IA consommée (constaté à la validation ; avant : projection à l'atterrissage).
      const iaRes = ia > 0 ? (fini ? ia - iaConso : ia - Math.max(0, atterrissage - iaHum)) : null;
      const iaStatut = !(ia > 0) ? null : annul ? 'annulee' : fini ? (iaRes > 1e-9 ? (iaConso < 1e-9 ? 'totale' : 'partielle') : iaRes < -1e-9 ? 'depassement' : 'conforme') : consoTotal > 0 ? 'encours' : 'avenir';
      const iaAJustifier = statut === 'Validé' && ia > 0 && iaStatut !== 'conforme' && !String(tr.iaJustif || '').trim();
      const av = annul ? 1 : tr.avancement == null ? 0 : num(tr.avancement);
      // Budget épuisé mais tâche non terminée : le RAF automatique (0) serait faux → à réestimer par le chef de projet
      // Avec une enveloppe IA : on regarde les profils humains (la réserve IA n'est pas du travail prévu).
      const rafAReestimer = !fini && rafSaisi == null && charge > 0 && consoTotal > 0 && (ia > 0 && iaHum > 0 ? restHum : rafAuto) <= 1e-9;
      // RAF suggéré par le rythme observé : consommé × (1 − avancement) / avancement
      const rafSuggere = !fini && av > 0 && av < 1 && consoTotal > 0 ? consoTotal * (1 - av) / av : null;
      const rafIncoherent = rafSuggere != null && !rafAReestimer && Math.abs(rafSuggere - raf) > Math.max(0.5, 0.2 * charge);
      // profil principal : le plus chargé, hors Agent IA (réserve, pas une personne) ; tâche annulée : sur sa charge d'origine
      const chP = annul ? chargesPrev : charges;
      let maxI = -1; chP.forEach((c, i) => { if (i !== iaIdx && c > 0 && (maxI < 0 || c > chP[maxI])) maxI = i; });
      if (maxI < 0) maxI = chP.findIndex((c) => c > 0);
      const debut = tr.debut || dates[0] || null;
      const fin = tr.fin || dates[dates.length - 1] || null;
      tasks.push({
        ...t, label: tr.label || t.label, labelTSP: t.label, tr, axe: tr.axe || t.id || '', phase: tr.phase || t.phase, lot: tr.lot ?? t.lot, charge,  // phase et lot ajustables en cours de projet
        charges, chargesV, chargesA, chargeTSP, chargeAjout, estAjout: !!t.ajout,
        annulee: !!annul, annul, chargeInit, chargesAnnul, chargeAnnulee, coutAnnule, caAvenant,
        valo, coutPrevu, coutPrevuTSP, coutAjout, cjmMoyen, tjmMoyen, chargesR, reaff, coutReaff,
        consoTotal, consoP, restP, dayTot,
        statut, avancement: av,
        rafAuto, rafSaisi, raf, atterrissage, ecart: atterrissage - charge, rafAReestimer, rafSuggere, rafIncoherent,
        coutConso: sum(consoP.map((v, i) => v * (P[i]?.cjm || 0))), coutRaf: raf * cjmReste,
        debut, fin, debutAuto: !tr.debut && !!dates[0], finAuto: !tr.fin && !!dates[0],
        type: typeOf(tr, t), typeManuel: tr.type != null, responsable: P[maxI]?.nom || '',
        ia, iaRev, iaGain, iaValide, gainRetenu, iaHum, iaConso, iaRes, iaStatut, iaAJustifier, iaType: tr.iaType || '', iaJustif: tr.iaJustif || '',
        iaTaux: iaGain != null && ia ? iaGain / ia : null,
        commentaire: tr.commentaire || '', consoDates: dates,
        // date de réalisation (livrable : « livré le ») = dernier jour de consommé une fois la tâche validée
        realiseLe: statut === 'Validé' ? dates[dates.length - 1] || tr.valideLe || null : null,
      });
    }

    // ---- PROFIL ----
    const profils = P.map((pr, i) => {
      const I = sum(tasks.map((t) => t.chargesV[i] || 0)); // onglet Profil = TSP vendu
      const ajoutJH = sum(tasks.map((t) => t.chargesA[i] || 0));
      const J = I * pr.tjmR, K = pr.cjm * I;
      // comme Excel (SI(C6="CESSION";…)) : l'entité se compare sans tenir compte des majuscules ni des espaces
      const ent = entiteNormalisee(pr.entite);
      let H = null;
      if (ent === 'CESSION') H = (pr.tjm - pr.cjm) / 2 + pr.cjm + (I ? pr.frais / 2 / I : 0);
      else if (ent === 'ACHAT') H = pr.cjm;
      else if (ent === 'BO' || ent === 'ACHAT BO') H = (pr.prcs ?? PRCS_DEFAUT) + (I ? pr.frais / I : 0);
      const L = ent === 'FO' ? pr.cjm * I : (H || 0) * I;
      return { ...pr, charge: I, ca: J, coutEN: K, coutAgence: L, tci: H, margeEN: J ? (J - K) / J : null, margeAgence: J ? (J - L) / J : null, ajoutJH, ajoutCout: ajoutJH * pr.cjm };
    });
    const totJ = sum(profils.map((x) => x.charge)), totCA = sum(profils.map((x) => x.ca));
    profils.forEach((x) => { x.pctJH = totJ ? x.charge / totJ : null; x.pctCA = totCA ? x.ca / totCA : null; });
    const totCout = sum(profils.map((x) => x.coutEN)), totCoutAg = sum(profils.map((x) => x.coutAgence));

    // ---- SYNTHESE ----
    const fraisRows = (p.frais || []).map((f) => ({ ...f, montant: f.cu * f.qte }));
    const achatRows = (p.achats || []).map((a) => ({ ...a, montant: a.cu * a.qte, markup: a.revente ? (a.revente - a.cu * a.qte) / a.revente : null }));
    const prestaRows = (p.prestas || []).map((a) => ({ ...a, cout: a.coutJour * a.nbj, revente: a.tjm * a.nbj, markup: a.tjm * a.nbj ? (a.tjm * a.nbj - a.coutJour * a.nbj) / (a.tjm * a.nbj) : null }));
    const fraisDep = sum(fraisRows.map((f) => f.montant)), fraisRef = sum(fraisRows.map((f) => f.refacture));
    const achatsMt = sum(achatRows.map((a) => a.montant)), achatsRef = sum(achatRows.map((a) => a.revente));
    // SOMME.SI(phase ; "PROVISION" ; …) : sans tenir compte des majuscules
    const provision = tasks.filter((t) => String(t.phase || '').trim().toUpperCase() === 'PROVISION');
    const provJH = sum(provision.map((t) => t.chargeTSP));
    const provEur = sum(provision.map((t) => t.valo));
    const margeAchats = achatsRef - achatsMt;
    const margeNette = totCA - totCout + margeAchats + fraisRef - fraisDep;
    const montantProjet = totCA + achatsRef + fraisRef;
    // ---- par entité (onglet SYNTHESE, lignes 33 à 69) : mêmes règles que les formules du TSP ----
    // TJM, CJM, coût agence / j : vides si le CA ou les jours sont nuls ; marges : vides si le CA est nul
    const parEntiteDe = (nom, codes) => {
      const L = profils.filter((x) => codes.includes(entiteNormalisee(x.entite)));
      const j = sum(L.map((x) => x.charge)), ca = sum(L.map((x) => x.ca)), k = sum(L.map((x) => x.coutEN)), ag = sum(L.map((x) => x.coutAgence));
      const avecCa = ca !== 0 && j !== 0;
      return { entite: nom, jours: j, ca, tjm: avecCa ? ca / j : null, cjm: avecCa ? k / j : null, coutAgenceJour: avecCa ? ag / j : null, margeEN: ca ? (ca - k) / ca : null, margeAgence: ca ? (ca - ag) / ca : null };
    };
    const entites = ENTITES.map((e) => parEntiteDe(e, [e]));
    const parEntite = entites.filter((x) => x.jours);
    // TOTAL BO = BO + ACHAT BO ; PRCS moyen du BACK = coût agence ÷ jours ; marge FRONT / BACK = (TJM − PRCS moyen) ÷ TJM
    const totalBo = parEntiteDe('TOTAL BO', ['BO', 'ACHAT BO']);
    const prcsMoyenBack = totalBo.jours ? sum(profils.filter((x) => ['BO', 'ACHAT BO'].includes(entiteNormalisee(x.entite))).map((x) => x.coutAgence)) / totalBo.jours : null;
    const margeFrontBack = totalBo.tjm && prcsMoyenBack != null ? (totalBo.tjm - prcsMoyenBack) / totalBo.tjm : null;
    // comme un tableau croisé Excel : « PROVISION » et « Provision » sont la même ligne (le premier libellé rencontré est gardé)
    const pivot = (key) => {
      const lignes = [];
      for (const t of tasks) {
        if (!t.chargeTSP) continue;
        const k = t[key] || 'Non renseignée';
        let o = lignes.find((x) => x.cle.trim().toUpperCase() === k.trim().toUpperCase());
        if (!o) { o = { cle: k, charge: 0, valo: 0 }; lignes.push(o); }
        o.charge += t.chargeTSP; o.valo += t.valo;
      }
      return lignes;
    };
    const synthese = {
      montantProjet, jours: totJ, ca: totCA, cout: totCout, coutAgence: totCoutAg,
      cjmProd: totJ ? totCout / totJ : null, tjmClient: totJ ? totCA / totJ : null,
      margeAgence: totCA ? (totCA - totCoutAg) / totCA : null, margeEN: totCA ? (totCA - totCout) / totCA : null,
      fraisDep, fraisRef, fraisNonRefJour: totJ ? (fraisDep - fraisRef) / totJ : null,
      provJH, provEur, provPct: totCA ? provEur / totCA : null,
      achatsMt, achatsRef, margeAchats, margeAchatsPct: achatsMt && achatsRef ? margeAchats / achatsRef : null, // SI(achats <> 0 ; … ; "")
      margeNette, margeNettePct: montantProjet ? margeNette / montantProjet : null,
      parEntite, parPhase: pivot('phase'), parEtape: pivot('etape'),
      entites, totalBo, prcsMoyenBack, margeFrontBack,
      // lignes du WORKLOAD vendu, pour les tableaux croisés filtrés par lot (filtre « Lot » de l'onglet SYNTHESE)
      lignes: tasks.filter((t) => t.chargeTSP).map((t) => ({ lot: t.lot, phase: t.phase, etape: t.etape, charge: t.chargeTSP, valo: t.valo })),
    };

    // ---- VENTILATION ----
    const phases = [...new Set([...(p.ref?.phases || []), ...tasks.map((t) => t.phase).filter(Boolean)])];
    // étapes : comparées sans tenir compte des accents, de la casse ni du type d'apostrophe (’ ou ')
    const etapes = [];
    [...(p.ref?.etapes || []), ...tasks.map((t) => t.etape).filter(Boolean)].forEach((e) => { if (!etapes.some((x) => norm(x) === norm(e))) etapes.push(e); });
    const grid = (list, key) => list.map((k) => {
      const v = P.map((_, i) => sum(tasks.filter((t) => (key === 'etape' ? norm(t[key]) === norm(k) : t[key] === k)).map((t) => t.chargesV[i] || 0)));
      return { cle: k, parProfil: v, total: sum(v) };
    });
    const ventilation = {
      parPhase: grid(phases, 'phase'), parEtape: grid(etapes, 'etape'),
      totalProfil: profils.map((x) => x.charge), montantProfil: profils.map((x) => x.ca),
      sansEtape: sum(tasks.filter((t) => !t.etape).map((t) => t.chargeTSP)),
      sansEtapeParProfil: P.map((_, i) => sum(tasks.filter((t) => !t.etape).map((t) => t.chargesV[i] || 0))),
    };

    // ---- METRIQUE ----
    const chargeEtape = (e) => sum(tasks.filter((t) => norm(t.etape) === norm(e)).map((t) => t.chargeTSP));
    const baseM = (p.metrique || []).find((m) => norm(m.etape).startsWith('developpement'));
    const base = baseM ? chargeEtape(baseM.etape) : 0;
    const metrique = (p.metrique || []).map((m) => {
      const propale = chargeEtape(m.etape);
      const pctProjet = base ? propale / base : null;
      return { ...m, theorique: base * m.pct, propale, pctProjet, ecart: pctProjet == null ? null : pctProjet - m.pct };
    });

    // ---- axes ----
    const axeIds = [];
    for (const t of p.tasks) { const a = t.section ? t.id : (p.track[t.uid]?.axe || t.id); if (a && !axeIds.includes(a)) axeIds.push(a); }
    for (const a of Object.keys(p.axes || {})) if (!axeIds.includes(a)) axeIds.push(a);
    const axeName = (id) => (id ? p.axes?.[id] || defaultAxeName(id) : 'Sans axe');
    const axeStat = (list) => {
      const prevu = sum(list.map((t) => t.charge)), conso = sum(list.map((t) => t.consoTotal)), raf = sum(list.map((t) => t.raf));
      const coutConso = sum(list.map((t) => t.coutConso)), coutRaf = sum(list.map((t) => t.coutRaf));
      const dated = list.filter(planifiee); // tâches planifiées (dates prévues saisies)
      const pd = list.map((t) => t.tr.debut).filter(Boolean).sort(), pf = list.map((t) => t.tr.fin).filter(Boolean).sort();
      const rd = list.map((t) => t.consoDates[0]).filter(Boolean).sort(), rf = list.map((t) => t.consoDates[t.consoDates.length - 1]).filter(Boolean).sort();
      // Statut d'un axe : Bloqué > En recette > Validé (toutes validées) > En cours (au moins une tâche démarrée) > A faire
      const started = list.some((t) => (t.statut !== 'À faire' && t.statut !== 'Annulée') || t.consoTotal > 0);
      const st = list.some((t) => t.statut === 'Bloqué / En attente') ? 'Bloqué / En attente'
        : list.some((t) => t.statut === 'En recette') ? 'En recette'
        : list.length && list.every((t) => t.statut === 'Validé' || t.statut === 'Annulée') && list.some((t) => t.statut === 'Validé') ? 'Validé'
        : started ? 'En cours' : 'À faire';
      const byType = (ty) => list.filter((t) => t.type === ty);
      return {
        n: list.length, prevu, conso, raf, atterrissage: conso + raf, ecart: conso + raf - prevu,
        prevuTSP: sum(list.map((t) => t.chargeTSP)), ajout: sum(list.map((t) => t.chargeAjout)), nAjout: list.filter((t) => t.estAjout).length,
        annule: sum(list.map((t) => t.chargeAnnulee)), nAnnul: list.filter((t) => t.annulee).length,
        coutPrevu: sum(list.map((t) => t.coutPrevu)), coutConso, coutRaf, coutFinal: coutConso + coutRaf,
        prevuP: P.map((_, i) => sum(list.map((t) => t.charges[i] || 0))), consoP: P.map((_, i) => sum(list.map((t) => t.consoP[i] || 0))),
        prevuDebut: pd[0] || null, prevuFin: pf.slice(-1)[0] || null, reelDebut: rd[0] || null, reelFin: rf.slice(-1)[0] || null,
        debut: [pd[0], rd[0]].filter(Boolean).sort()[0] || null, fin: [pf.slice(-1)[0], rf.slice(-1)[0]].filter(Boolean).sort().slice(-1)[0] || null, // étendue totale (Gantt)
        dated: dated.length, valides: list.filter((t) => !t.annulee && t.statut === 'Validé').length, actives: list.filter((t) => !t.annulee).length, avancement: avValide(list), avDeclare: prevu ? sum(list.map((t) => t.charge * t.avancement)) / prevu : 0, statut: st,
        ateliers: byType('Atelier').filter((t) => !t.annulee).length, ateliersOK: byType('Atelier').filter((t) => t.statut === 'Validé').length,
        livrables: byType('Livrable').filter((t) => !t.annulee).length, livrablesOK: byType('Livrable').filter((t) => t.statut === 'Validé').length,
        ia: sum(list.map((t) => t.ia)), iaRetenu: sum(list.map((t) => t.ia - t.gainRetenu)), iaRes: sum(list.filter((t) => t.iaStatut && t.iaStatut !== 'annulee' && t.statut === 'Validé').map((t) => t.iaRes)),
      };
    };
    // Regroupement choisi par l'utilisateur : ID (colonne A), Lot (B) ou Phase (C)
    const dimKey = ['id', 'lot', 'phase'].includes(S.groupBy) ? S.groupBy : 'id';
    const DIM = { id: { key: 'id', label: 'Axe', col: 'ID – colonne A' }, lot: { key: 'lot', label: 'Lot', col: 'colonne B' }, phase: { key: 'phase', label: 'Phase', col: 'colonne C' } }[dimKey];
    tasks.forEach((t) => { t.grp = dimKey === 'id' ? t.axe : dimKey === 'lot' ? t.lot || '' : t.phase || ''; });
    const titleCase = (x) => (x ? x.charAt(0) + x.slice(1).toLowerCase() : x);
    let order;
    if (dimKey === 'id') order = axeIds;
    else if (dimKey === 'phase') { const ph = p.ref?.phases || []; order = [...ph, ...tasks.map((t) => t.grp).filter((g) => g && !ph.includes(g))]; }
    else order = tasks.map((t) => t.grp).filter(Boolean);
    order = [...new Set(order)];
    const grpName = (k) => (dimKey === 'id' ? axeName(k) : dimKey === 'phase' ? titleCase(k) : k === '0' ? 'Lot 0 – Pilotage' : `Lot ${k}`);
    const axes = order.map((id) => ({ id, nom: grpName(id), ...axeStat(tasks.filter((t) => t.grp === id)) })).filter((a) => a.n);
    const sansGrp = tasks.filter((t) => !t.grp);
    if (sansGrp.length) axes.push({ id: '', nom: `Sans ${DIM.label.toLowerCase()}`, ...axeStat(sansGrp) });
    const sansAxe = dimKey === 'id' ? sansGrp : [];
    const total = axeStat(tasks);

    // ---- planning : dates prévues saisies par groupe (axe, lot ou phase) et par sous-partie (titre de section du TSP) ----
    // Sans saisie, le prévu reste celui des tâches (premier début → dernière fin prévus) ; le réel vient toujours du consommé.
    const planG = p.planning?.groupes || {};
    const planDe = (cle, st) => {
      const x = planG[cle] || {};
      return { cle, planDebut: x.debut || st.prevuDebut || null, planFin: x.fin || st.prevuFin || null, planSaisi: !!(x.debut || x.fin), planDebutSaisi: !!x.debut, planFinSaisi: !!x.fin };
    };
    axes.forEach((a) => { Object.assign(a, planDe(`${dimKey}|${a.id}`, a)); a.sousParties = []; });
    if (dimKey === 'id') {
      // sous-parties d'un axe = les lignes de titre du TSP (intitulé sans charge, comme « Socle Sécurité -> Socle de confiance IA »).
      // Une tâche appartient au dernier titre qui la précède dans le TSP, si ce titre est de son axe (colonne A) ; sinon elle
      // compte directement dans l'axe. Le lot (colonne B) n'intervient pas : il ne sert qu'au regroupement « par Lot ».
      const secDe = {}, axeTitre = {}; let secCour = null;
      for (const t of p.tasks) { if (t.section) secCour = t; else secDe[t.uid] = secCour; }
      // un titre sans axe (suivi lancé depuis un brouillon d'une version précédente) prend l'axe de la première tâche qui le suit
      p.tasks.forEach((t, k) => { if (!t.section) return; let a = t.id; if (!a) { const n = p.tasks.slice(k + 1).find((x) => !x.section); a = n ? tasks.find((x) => x.uid === n.uid)?.axe || n.id : ''; } axeTitre[t.uid] = a || ''; });
      for (const a of axes) {
        const vues = [];
        for (const t of tasks) { const sc = t.grp === a.id ? secDe[t.uid] : null; if (sc && a.id && axeTitre[sc.uid] === a.id && !vues.includes(sc)) vues.push(sc); }
        a.sousParties = vues.map((sc) => {
          const liste = tasks.filter((t) => t.grp === a.id && secDe[t.uid] === sc), cle = `sec|${sc.uid}|${a.id}`, st = axeStat(liste);
          const nomTSP = sc.label || 'Sous-partie';
          return { id: sc.uid, nom: String(planG[`sec|${sc.uid}`]?.nom || '').trim() || nomTSP, nomTSP, axe: a.id, uids: liste.map((t) => t.uid), ...st, ...planDe(cle, st) };
        }).filter((x) => x.n);
        if (!a.sousParties.length) continue; // axe sans titre à lui : dates saisies sur l'axe, sinon celles de ses tâches
        // l'axe s'étend du plus tôt au plus tard de ce qu'il contient : ses sous-parties (dates saisies, sinon celles de leurs tâches)
        // et ses tâches placées sous aucun titre. Il n'a pas de saisie propre.
        const dans = new Set(a.sousParties.flatMap((x) => x.uids));
        const libres = tasks.filter((t) => t.grp === a.id && !dans.has(t.uid));
        const deb = [...a.sousParties.map((x) => x.planDebut), ...libres.map((t) => t.tr.debut)].filter(Boolean).sort();
        const fin = [...a.sousParties.map((x) => x.planFin), ...libres.map((t) => t.tr.fin)].filter(Boolean).sort();
        Object.assign(a, { planDebut: deb[0] || null, planFin: fin.slice(-1)[0] || null });
      }
      // un axe découpé en sous-parties n'a pas de date saisie : il reprend toujours ce qu'il contient. Une date saisie
      // auparavant sur l'axe reste dans le fichier (signalée dans son détail) mais n'est plus utilisée. Un axe sans
      // sous-partie (un seul lot, sans titre) garde la saisie possible : c'est le seul niveau où le dater sans dater ses tâches.
      axes.forEach((a) => {
        if (!a.sousParties.length) return;
        const ancien = planG[`id|${a.id}`];
        Object.assign(a, { planSaisi: false, planDebutSaisi: false, planFinSaisi: false, planCalcule: true, planDeSaisies: a.sousParties.some((x) => x.planSaisi), planAncien: ancien && (ancien.debut || ancien.fin) ? { debut: ancien.debut || null, fin: ancien.fin || null } : null });
      });
      // dates saisies sur un lot sans ligne de titre (version intermédiaire) : gardées dans le fichier, signalées dans le détail de l'axe
      axes.forEach((a) => {
        const l = Object.entries(planG).filter(([k, v]) => k.startsWith(`sp|${a.id}|`) && (v.debut || v.fin)).map(([k, v]) => ({ cle: k, lot: k.split('|')[2], debut: v.debut || null, fin: v.fin || null }));
        if (l.length) a.planAnciensLots = l;
      });
    }
    // jalons du projet, dans l'ordre des dates (les jalons « à confirmer » sans numéro)
    const jalons = (p.planning?.jalons || []).filter((j) => j && j.id && j.debut).map((j) => ({ ...j })) // copies : le numéro n'est pas enregistré
      .sort((x, y) => String(x.debut).localeCompare(String(y.debut)) || String(x.libelle || '').localeCompare(String(y.libelle || ''), 'fr'));
    let numJalon = 0;
    jalons.forEach((j) => { j.numero = j.aConfirmer ? null : ++numJalon; });

    // ---- mensuel ----
    const blank = () => months.map(() => P.map(() => 0));
    const consoM = blank();
    let horsPeriode = 0;
    for (const t of tasks) {
      const cp = t.tr.consoP || {};
      for (const key of Object.keys(cp)) {
        const i = +key;
        for (const [d, raw] of Object.entries(cp[key] || {})) {
          const v = num(raw); if (!v) continue;
          const k = mIndex[monthOf(d)];
          if (k == null || i < 0 || i >= nP) { horsPeriode += v; continue; }
          consoM[k][i] += v;
        }
      }
    }
    const refM = months.map((m) => {
      const j = p.planningRef?.months?.indexOf(m) ?? -1;
      return P.map((_, i) => (j >= 0 ? num(p.planningRef.rows[i]?.[j]) : 0));
    });
    // planning vendu (onglet PLANNING du TSP, figé à l'import) : référence initiale, jamais modifiée
    const tspSrc = p.planningTsp || p.planningRef;
    const tspM = months.map((m) => {
      const j = tspSrc?.months?.indexOf(m) ?? -1;
      return P.map((_, i) => (j >= 0 ? num(tspSrc.rows[i]?.[j]) : 0));
    });
    let cumCJM = 0, cumTJM = 0, cumRefTJM = 0;
    const mensuel = months.map((m, k) => {
      const c = consoM[k], coutCJM = sum(c.map((v, i) => v * P[i].cjm)), valoTJM = sum(c.map((v, i) => v * P[i].tjmR));
      const refTJM = sum(refM[k].map((v, i) => v * P[i].tjmR));
      cumCJM += coutCJM; cumTJM += valoTJM; cumRefTJM += refTJM;
      return {
        mois: m, consoP: c, conso: sum(c), refP: refM[k], ref: sum(refM[k]), tspP: tspM[k], tsp: sum(tspM[k]),
        coutCJM, cumCJM, valoTJM, cumTJM, refTJM, cumRefTJM,
      };
    });
    const refTotal = sum(p.planningRef?.rows?.flat() || []);
    const tspTotal = sum(tspSrc?.rows?.flat() || []);
    // replanifié = au moins une valeur (profil × mois) du prévisionnel diffère du planning vendu
    const planVals = (pl) => { const o = {}; (pl?.rows || []).forEach((r, i) => (pl.months || []).forEach((mk, k) => { const v = num(r?.[k]); if (v) o[`${i}|${mk}`] = v; })); return o; };
    const pvA = planVals(p.planningTsp), pvB = planVals(p.planningRef);
    const replanifie = !!p.planningTsp && [...new Set([...Object.keys(pvA), ...Object.keys(pvB)])].some((k) => Math.abs((pvA[k] || 0) - (pvB[k] || 0)) > 1e-9);

    // ---- financier ----
    const coutInitial = sum(tasks.map((t) => t.coutPrevuTSP)); // coût budgété au TSP
    const coutAjout = sum(tasks.map((t) => t.coutAjout));
    const coutAnnule = sum(tasks.map((t) => t.coutAnnule));
    const coutReaff = sum(tasks.map((t) => t.coutReaff)); // écart de coût des réaffectations (CJM différents)
    const caAvenant = sum(tasks.map((t) => t.caAvenant));
    const caEff = totCA - caAvenant; // CA du forfait, diminué des avenants de réduction
    const financier = {
      ca: caEff, caTSP: totCA, caAvenant, coutInitial, coutAjout, coutAnnule, coutReaff, coutPrevu: coutInitial + coutAjout + coutReaff - coutAnnule, coutConso: total.coutConso, coutRaf: total.coutRaf, coutFinal: total.coutFinal,
      marge: caEff - total.coutFinal, tauxMarge: caEff ? (caEff - total.coutFinal) / caEff : 0, ecartCout: total.coutFinal - coutInitial,
    };

    // ---- achats et frais : budget du TSP / réel saisi en cours de projet (montants HT) ----
    // Atterrissage = pour chaque ligne du TSP, le plus élevé du budget et du réel (le budget non dépensé reste réputé à engager) ;
    // hors TSP = réel uniquement.
        const achReel = (p.achatsReel || []).map((a) => ({ ...a, montant: num(a.qte) * num(a.cu), refacture: num(a.refacture) }));
    const achLignes = achatRows.map((b, i) => {
      const L = achReel.filter((a) => a.ligne !== '' && a.ligne != null && +a.ligne === i);
      const reel = sum(L.map((a) => a.montant)), reelRev = sum(L.map((a) => a.refacture));
      return { i, designation: b.designation, budget: b.montant, budgetRev: b.revente, reel, reelRev, n: L.length, att: Math.max(b.montant, reel), attRev: Math.max(b.revente, reelRev) };
    });
    const achHors = achReel.filter((a) => a.ligne === '' || a.ligne == null || !achatRows[+a.ligne]);
    const achats = {
      lignes: achReel, parLigne: achLignes, hors: achHors,
      budget: achatsMt, budgetRev: achatsRef,
      reel: sum(achReel.map((a) => a.montant)), reelRev: sum(achReel.map((a) => a.refacture)),
      horsTSP: sum(achHors.map((a) => a.montant)),
      parStatut: ACHAT_STATUTS.map((st) => ({ statut: st, n: achReel.filter((a) => (a.statut || ACHAT_STATUTS[0]) === st).length, montant: sum(achReel.filter((a) => (a.statut || ACHAT_STATUTS[0]) === st).map((a) => a.montant)) })),
    };
    achats.att = sum(achLignes.map((l) => l.att)) + achats.horsTSP;
    achats.attRev = sum(achLignes.map((l) => l.attRev)) + sum(achHors.map((a) => a.refacture));
    achats.reste = sum(achLignes.map((l) => Math.max(0, l.budget - l.reel))); // ligne par ligne : le dépassement d'une ligne ne consomme pas le budget d'une autre
    achats.depasse = achats.att - achats.budget;
    // effet sur la marge nette par rapport au TSP : un dépassement couvert par du refacturé n'est pas une perte
    achats.impactNet = (achats.attRev - achats.att) - (achats.budgetRev - achats.budget);
    const frReel = (p.fraisReel || []).map((x) => ({ ...x, montant: num(x.montant), refacture: x.refacturable ? num(x.montant) : 0 }));
    const frais = {
      lignes: frReel, budget: fraisDep, budgetRef: fraisRef,
      reel: sum(frReel.map((x) => x.montant)), reelRef: sum(frReel.map((x) => x.refacture)),
      parCategorie: FRAIS_CATEGORIES.map((c) => ({ cat: c, montant: sum(frReel.filter((x) => (x.categorie || 'Autre') === c).map((x) => x.montant)), n: frReel.filter((x) => (x.categorie || 'Autre') === c).length })),
      parCollab: [...new Set(frReel.map((x) => x.collaborateur || '—'))].map((c) => ({ collaborateur: c, montant: sum(frReel.filter((x) => (x.collaborateur || '—') === c).map((x) => x.montant)) })),
    };
    // Deux enveloppes : les frais refacturables (le client les rembourse : sans effet sur la marge) et ceux à notre charge.
    // Part à notre charge prévue au TSP = budget − refacturé (0 si tout est refacturé). Chaque enveloppe atterrit au plus
    // élevé de son budget et de son réel : un frais non refacturé au-delà de la part prévue à notre charge réduit la marge,
    // même s'il reste du budget refacturable (le client ne le paiera pas).
    frais.reelNonRef = frais.reel - frais.reelRef;
    frais.budgetNonRef = Math.max(0, frais.budget - frais.budgetRef);
    frais.budgetRefCout = frais.budget - frais.budgetNonRef; // coût prévu des frais refacturables
    frais.attRefCout = Math.max(frais.budgetRefCout, frais.reelRef);
    frais.attNonRef = Math.max(frais.budgetNonRef, frais.reelNonRef);
    frais.att = frais.attRefCout + frais.attNonRef;
    frais.attRef = frais.budgetRef + Math.max(0, frais.reelRef - frais.budgetRefCout); // un dépassement refacturable est remboursé au réel
    frais.reste = Math.max(0, frais.budget - frais.reel); frais.depasse = frais.att - frais.budget;
    frais.impactNet = (frais.attRef - frais.att) - (frais.budgetRef - frais.budget);
    // marge nette : production (jours) + achats + frais, vendue (TSP) et à l’atterrissage
    const margeNetteAtt = financier.marge + (achats.attRev - achats.att) + (frais.attRef - frais.att);
    const caNetAtt = financier.ca + achats.attRev + frais.attRef;
    financier.achats = achats; financier.frais = frais;
    financier.margeNette = margeNetteAtt; financier.tauxMargeNette = caNetAtt ? margeNetteAtt / caNetAtt : 0;
    financier.margeNetteVendue = synthese.margeNette; financier.tauxMargeNetteVendue = synthese.margeNettePct;

    // ---- évolutions du périmètre (ajouts en cours de projet, non facturés) ----
    const lignesAjout = [];
    for (const t of tasks) {
      if (t.annulee) lignesAjout.push({ kind: 'annul', uid: t.uid, label: t.label, profils: t.chargesAnnul.map((v, i) => (v ? P[i]?.nom : null)).filter(Boolean), jh: -t.chargeAnnulee, cout: -t.coutAnnule, conso: t.consoTotal, avenant: !!t.annul.avenant, caAvenant: t.caAvenant, ...(t.annul || {}) });
      if (t.estAjout) lignesAjout.push({ kind: 'tache', uid: t.uid, label: t.label, profils: t.chargesA.map((v, i) => (v ? P[i]?.nom : null)).filter(Boolean), jh: t.chargeAjout, cout: t.coutAjout, conso: t.consoTotal, ...(t.ajout || {}) });
      else t.chargesA.forEach((v, i) => { if (v) lignesAjout.push({ kind: 'profil', uid: t.uid, label: t.label, i, profils: [P[i]?.nom], jh: v, cout: v * (P[i]?.cjm || 0), conso: t.consoP[i], ...(t.tr.ajoutInfo?.[i] || {}) }); });
    }
    // réaffectations : la charge passe d'un profil à un autre ; le total ne change pas, le coût suit le CJM
    for (const t of tasks) for (const r of t.reaff) {
      lignesAjout.push({ kind: 'reaff', uid: t.uid, label: t.label, id: r.id, de: r.de, vers: r.vers, profils: [P[r.de]?.nom, P[r.vers]?.nom], jh: num(r.jh), cout: num(r.jh) * ((P[r.vers]?.cjm || 0) - (P[r.de]?.cjm || 0)), conso: 0, at: r.at, by: r.by, motif: r.motif });
    }
    lignesAjout.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const perimetre = {
      chargeTSP: total.prevuTSP, chargeAjout: total.ajout, chargeAnnulee: total.annule, chargeActuelle: total.prevu, coutAjout, coutAnnule, coutReaff, caAvenant, nReaff: lignesAjout.filter((l) => l.kind === 'reaff').length,
      nTaches: tasks.filter((t) => t.estAjout).length, nProfilsTache: lignesAjout.filter((l) => l.kind === 'profil').length, nAnnul: tasks.filter((t) => t.annulee).length,
      profilsAjoutes: P.filter((x) => x.ajout), lignes: lignesAjout,
      margeVendue: totCA ? (totCA - coutInitial) / totCA : null, margeAvecAjouts: caEff ? (caEff - coutInitial - coutAjout - coutReaff + coutAnnule) / caEff : null,
    };

    // ---- échéancier ----
    const todayISO = localISO();
    // Une phase est liée à une seule échéance ; ce lien prime sur celui des tâches de la phase.
    const phaseEch = {};
    for (const e of p.echeancier || []) for (const ph of p.echTrack?.[e.n]?.phases || []) if (phaseEch[ph] == null) phaseEch[ph] = e.n;
    const echOf = (t) => (phaseEch[t.phase] != null ? phaseEch[t.phase] : t.tr.ech || null);
    tasks.forEach((t) => { t.echN = echOf(t); t.echViaPhase = phaseEch[t.phase] != null; });
    // Montants : une échéance facturée garde son montant ; un avenant de réduction est réparti sur les échéances
    // non encore facturées, au prorata de leur pourcentage (le total facturé reste égal au CA du forfait).
    const curMonth = todayISO.slice(0, 7);
    const cumAt = (field, mk) => (!mk ? null : mk < months[0] ? 0 : mIndex[mk] != null ? mensuel[mIndex[mk]][field] : mensuel[mensuel.length - 1]?.[field] ?? 0);
    const echBase = (p.echeancier || []).map((e) => ({ e, et: p.echTrack?.[e.n] || {} }));
    // montant figé à la facturation (montantFacture) ; anciens suivis sans montant figé : % × CA du TSP
    const montantFige = ({ e, et }) => (et.montantFacture != null ? num(et.montantFacture) : e.pct * totCA);
    const factInit = sum(echBase.filter((x) => x.et.realiseLe).map(montantFige));
    const pctRestant = sum(echBase.filter((x) => !x.et.realiseLe).map((x) => x.e.pct));
    const finProjet = finRef;
    const echeancier = echBase.map(({ e, et }) => {
      const montantInit = e.pct * totCA;
      const montant = et.realiseLe ? montantFige({ e, et }) : !pctRestant ? montantInit : Math.max(0, caEff - factInit) * e.pct / pctRestant;
      // suivi de l'échéance : date prévue (par défaut fin du mois de facturation du TSP), facturée le, payée le, périmètre lié
      const datePrevue = et.datePrevue || (e.mois ? monthDays(e.mois).slice(-1)[0] : null);
      const phases = et.phases || [];
      const lies = tasks.filter((t) => !t.annulee && t.echN != null && String(t.echN) === String(e.n));
      const chL = sum(lies.map((t) => t.charge));
      const avLie = chL ? avValide(lies) : null;
      const realiseLe = et.realiseLe || null, payeeLe = et.payeeLe || null;
      const jours = datePrevue ? Math.round((toUTC(datePrevue) - toUTC(todayISO)) / 864e5) : null;
      const statut = payeeLe ? 'Payée' : realiseLe ? 'Facturée' : jours != null && jours < 0 ? 'En retard' : 'Planifiée';
      return { ...e, montant, montantInit, ajustAvenant: montant - montantInit, mois: datePrevue ? datePrevue.slice(0, 7) : e.mois, moisTSP: e.mois,
        datePrevue, datePrevueAuto: !et.datePrevue, realiseLe, payeeLe, commentaire: et.commentaire || '', phases, lies, nLies: lies.length, nLiesValides: lies.filter((t) => t.statut === 'Validé').length,
        avLie, pret: lies.length > 0 && lies.every((t) => t.statut === 'Validé'), jours, statut, apresFin: !!(datePrevue && finProjet && datePrevue > finProjet) };
    });
    // FAE (factures à établir) = valeur produite cumulée − montant facturé cumulé.
    // Prévue : planning de charge et dates prévues du suivi.
    // Réelle : à la date de la facture si elle est émise, sinon en fin de mois (mois passés ou en cours seulement).
    let factCum = 0;
    [...echeancier].sort((a, b) => String(a.datePrevue || '9999').localeCompare(String(b.datePrevue || '9999'))).forEach((e) => {
      factCum += e.montant; e.factCum = factCum;
      e.prodPlan = cumAt('cumRefTJM', e.mois); e.faePlan = e.prodPlan == null ? null : e.prodPlan - factCum;
      const refD = e.realiseLe || (e.mois && e.mois <= curMonth ? monthDays(e.mois).slice(-1)[0] : null);
      if (refD) {
        e.factReel = sum(echeancier.filter((x) => x.realiseLe && x.realiseLe <= refD).map((x) => x.montant));
        e.prodReel = cumAt('cumTJM', refD.slice(0, 7) < curMonth ? refD.slice(0, 7) : curMonth) ?? 0; e.faeReel = e.prodReel - e.factReel;
      } else { e.factReel = null; e.prodReel = null; e.faeReel = null; }
    });
    // FAE (%) : une seule base pour toutes les lignes, le montant total des échéances (= montant du contrat facturable).
    // Signe repris du TSP : négatif quand la production est en avance sur la facturation (factures à établir).
    const totEch = sum(echeancier.map((e) => e.montant));
    echeancier.forEach((e) => { e.faePlanPct = e.faePlan == null || !totEch ? null : -e.faePlan / totEch; e.faeReelPct = e.faeReel == null || !totEch ? null : -e.faeReel / totEch; });
    const facture = sum(echeancier.filter((e) => e.realiseLe).map((e) => e.montant));
    const echSynth = { facture, paye: sum(echeancier.filter((e) => e.payeeLe).map((e) => e.montant)), reste: sum(echeancier.map((e) => e.montant)) - facture,
      produit: cumAt('cumTJM', curMonth) ?? 0, faeADate: (cumAt('cumTJM', curMonth) ?? 0) - facture, ajustAvenant: sum(echeancier.map((e) => e.ajustAvenant)) };

    // ---- ateliers / livrables ----
    const al = tasks.filter((t) => t.type);
    const types = p.types || TYPES_SOCLE;
    const parType = types.map((ty) => { const l0 = al.filter((t) => t.type === ty.id), l = l0.filter((t) => !t.annulee); const ok = l.filter((t) => t.statut === 'Validé').length; return { ...ty, prevus: l.length, realises: ok, restants: l.length - ok, annules: l0.length - l.length, taux: l.length ? ok / l.length : 0, charge: sum(l.map((t) => t.charge)) }; });
    const cnt = (ty) => { const l = al.filter((t) => t.type === ty && !t.annulee); const ok = l.filter((t) => t.statut === 'Validé').length; return { prevus: l.length, realises: ok, restants: l.length - ok, taux: l.length ? ok / l.length : 0 }; };

    // ---- IA ----
    const iaTasks = tasks.filter((t) => t.ia > 0 && !t.annulee);
    const iaVal = iaTasks.filter((t) => t.statut === 'Validé');
    const iaRef = sum(iaTasks.map((t) => t.ia));
    const realise = sum(iaVal.map((t) => t.iaRes)), envVal = sum(iaVal.map((t) => t.ia));
    const projection = sum(iaTasks.map((t) => t.iaRes));
    const tjmIA = P[iaIdx]?.tjmR || 0, cjmIA = P[iaIdx]?.cjm || 0;
    const iaParType = {};
    iaVal.filter((t) => t.iaStatut !== 'conforme').forEach((t) => { const k = t.iaType || 'Non renseigné'; const o = (iaParType[k] = iaParType[k] || { type: k, n: 0, jh: 0, sens: t.iaRes >= 0 ? 'eco' : 'dep' }); o.n++; o.jh += t.iaRes; });
    const ia = {
      profil: P[iaIdx]?.nom || null, ref: iaRef, consomme: sum(iaTasks.map((t) => t.iaConso)), realise, envVal, projection,
      taux: envVal ? realise / envVal : 0, tauxProj: iaRef ? projection / iaRef : 0,
      valeurTJM: realise * tjmIA, valeurCJM: realise * cjmIA, projTJM: projection * tjmIA, tjm: tjmIA, cjm: cjmIA,
      validees: iaVal.length, aJustifier: iaTasks.filter((t) => t.iaAJustifier), parType: Object.values(iaParType).sort((x, y) => y.jh - x.jh),
      leviers: Array.isArray(p.settings?.iaLeviers) && p.settings.iaLeviers.length ? p.settings.iaLeviers : IA_LEVIERS,
      causes: Array.isArray(p.settings?.iaCauses) && p.settings.iaCauses.length ? p.settings.iaCauses : IA_CAUSES,
      tasks: iaTasks,
    };
    // compatibilité (anciens noms)
    ia.gainsValides = realise; ia.valeur = ia.valeurTJM;

    // ---- points de vigilance ----
    const nonDatees = tasks.filter((t) => !t.annulee && t.statut !== 'Validé' && !planifiee(t)); // à faire sans dates prévues
    const depassements = tasks.filter((t) => t.consoTotal > t.charge + 1e-9);
    const vigilance = [
      { cle: 'sansAxe', label: "Tâches sans axe", valeur: sansAxe.length, niveau: sansAxe.length ? 'critique' : 'ok', detail: sansAxe.length ? `${String(round(sum(sansAxe.map((t) => t.charge)))).replace('.', ',')} JH non rattachés à un axe` : 'Toutes les tâches ont un axe' },
      // « Tâches non planifiées » retiré : mesure jugée sans intérêt pour le pilotage
      { cle: 'bloque', label: 'Tâches bloquées / en attente', valeur: tasks.filter((t) => t.statut === 'Bloqué / En attente').length, niveau: tasks.some((t) => t.statut === 'Bloqué / En attente') ? 'critique' : 'ok' },
      { cle: 'reestimer', label: 'Reste à faire à réestimer', valeur: tasks.filter((t) => t.rafAReestimer).length, niveau: tasks.some((t) => t.rafAReestimer) ? 'critique' : 'ok', detail: 'Budget consommé mais tâche non validée : indiquez le reste à faire réel' },
      { cle: 'incoherent', label: 'RAF incohérent avec l’avancement', valeur: tasks.filter((t) => t.rafIncoherent).length, niveau: tasks.some((t) => t.rafIncoherent) ? 'attention' : 'ok', detail: 'Le rythme observé (consommé / avancement) suggère un autre reste à faire' },
      { cle: 'sansConso', label: 'Tâches validées sans consommé', valeur: tasks.filter((t) => t.statut === 'Validé' && !(t.consoTotal > 0)).length, niveau: tasks.some((t) => t.statut === 'Validé' && !(t.consoTotal > 0)) ? 'attention' : 'ok', detail: 'Temps passé non saisi ? Sans consommé, la tâche affiche une économie fictive (écart, marge, résultat IA)' },
      { cle: 'depassement', label: 'Tâches en dépassement', valeur: depassements.length, niveau: depassements.length ? 'critique' : 'ok', detail: 'Consommé supérieur à la charge vendue' },
      { cle: 'ecart', label: "Écart d'atterrissage", valeur: round(total.ecart), unite: 'JH', niveau: total.ecart > 0.001 ? 'critique' : 'ok' },
      { cle: 'cout', label: 'Écart coût / initial', valeur: round(financier.ecartCout), unite: '€', niveau: financier.ecartCout > 0.5 ? 'attention' : 'ok' },
      // « JH non ventilés » : fait du TSP (planning figé), affiché dans Annexes › Planning et sous la courbe mensuelle, pas en vigilance
    ];
    if (financier.achats.depasse > 0.5 && financier.achats.impactNet < -0.5) vigilance.push({ cle: 'achats', label: 'Achats au-delà du budget TSP', valeur: round(financier.achats.depasse), unite: '€', niveau: 'attention', detail: `${financier.achats.hors.length ? financier.achats.hors.length + ' achat(s) hors TSP · ' : ''}atterrissage ${fmtE(financier.achats.att)} pour un budget de ${fmtE(financier.achats.budget)}` });
    // frais : seuls ceux à notre charge, au-delà de la part prévue au TSP, réduisent la marge (règle du 09/10/2026)
    if (financier.frais.impactNet < -0.5) vigilance.push({ cle: 'frais', label: 'Frais à notre charge au-delà du TSP', valeur: round(-financier.frais.impactNet), unite: '€', niveau: 'attention', detail: `${fmtE(financier.frais.reelNonRef)} de frais non refacturés pour ${fmtE(financier.frais.budgetNonRef)} prévus à notre charge au TSP` });
    if (total.ajout > 0) vigilance.push({ cle: 'ajouts', label: 'Charge ajoutée non facturée', valeur: round(total.ajout), unite: 'JH', niveau: 'attention', detail: `${lignesAjout.filter((l) => l.kind !== 'annul' && l.kind !== 'reaff').length} ajout(s) au périmètre du TSP · coût estimé ${fmtE(coutAjout)} absorbé par la marge` });
    // ---- actions & décisions ----
    const td0 = localISO();
    const actOuv = (p.actions || []).filter((a) => aLibelle(a) && a.statut !== 'Fait' && a.statut !== 'Annulée');
    const actRetard = actOuv.filter((a) => a.echeance && a.echeance < td0);
    const decAValider = (p.decisions || []).filter((x) => x.statut === 'À valider');
    if (actRetard.length) vigilance.push({ cle: 'actions', label: 'Actions en retard', valeur: actRetard.length, niveau: 'critique', detail: actRetard.slice(0, 3).map((a) => `${a.ref} ${a.libelle}${a.porteur ? ' (' + a.porteur + ')' : ''}`).join(' · ') });
    const echRetard = echeancier.filter((e) => e.statut === 'En retard');
    if (echRetard.length) vigilance.push({ cle: 'echeances', label: 'Échéances de facturation en retard', valeur: echRetard.length, niveau: 'critique', detail: echRetard.slice(0, 3).map((e) => `n° ${e.n} ${e.nom} (prévue le ${e.datePrevue.split('-').reverse().join('/')})`).join(' · ') });
    const echApres = echeancier.filter((e) => e.apresFin && !e.realiseLe);
    if (echApres.length) vigilance.push({ cle: 'echapres', label: 'Échéances prévues après la fin du projet', valeur: echApres.length, niveau: 'attention', detail: echApres.map((e) => `n° ${e.n} le ${e.datePrevue.split('-').reverse().join('/')}`).join(' · ') });
    if (decAValider.length) vigilance.push({ cle: 'decisions', label: 'Décisions en attente de validation', valeur: decAValider.length, niveau: 'attention', detail: decAValider.slice(0, 3).map((x) => `${x.ref} ${x.libelle}`).join(' · ') });
    // Une personne ne peut pas travailler plus d'une journée par jour, toutes tâches confondues
    const dayLoad = P.map(() => ({}));
    for (const t of tasks) for (const [k, o] of Object.entries(t.tr.consoP || {})) for (const [d, v] of Object.entries(o || {})) if (num(v) && dayLoad[+k]) dayLoad[+k][d] = (dayLoad[+k][d] || 0) + num(v);
    const surJours = [];
    dayLoad.forEach((o, i) => { if (multiJours(P[i])) return; Object.entries(o).forEach(([d, v]) => { if (v > 1 + 1e-9) surJours.push({ i, d, v }); }); });
    surJours.sort((a, b) => a.d.localeCompare(b.d));
    if (surJours.length) vigilance.unshift({ cle: 'jour', label: 'Plus d’une journée saisie le même jour', valeur: surJours.length, niveau: 'critique', detail: surJours.slice(0, 3).map((x) => `${P[x.i].nom} le ${x.d.split('-').reverse().join('/')} : ${String(round(x.v)).replace(".", ",")} JH`).join(' · ') + (surJours.length > 3 ? ' …' : '') });
    if (horsPeriode) vigilance.push({ cle: 'hors', label: 'Consommé non rattaché', valeur: round(horsPeriode), unite: 'JH', niveau: 'attention', detail: 'Consommé saisi sur un profil inexistant' });

    // ---- risques ----
    const riskLvl = (lst, v) => Math.max(0, lst.indexOf(v)) + 1;
    const risques = (p.risques || []).map((r) => ({ ...r, crit: riskLvl(RISK_PROBA, RISK_ANCIEN.proba[r.proba] || r.proba || RISK_DEF.proba) * riskLvl(RISK_IMPACT, RISK_ANCIEN.impact[r.impact] || r.impact || RISK_DEF.impact) }));
    const risquesOuverts = risques.filter((r) => (r.statut || 'Ouvert') === 'Ouvert' || r.statut === 'Survenu');
    const risquesForts = risquesOuverts.filter((r) => riskNiveau(r.crit) === 'fort');
    if (risquesForts.length) vigilance.push({ cle: 'risques', label: 'Risques forts ouverts', valeur: risquesForts.length, niveau: 'critique', detail: risquesForts.slice(0, 3).map((r) => `${r.ref} ${r.libelle}`).join(' · ') });
    // ---- calendrier du projet ----
    const td = localISO();
    const cal = { debut: D.debut || null, finContrat: D.finContrat || null, finPrevue: finRef };
    if (cal.debut && cal.finPrevue) {
      const tot = workdays(cal.debut, cal.finPrevue);
      const ecoule = td < cal.debut ? 0 : workdays(cal.debut, td < cal.finPrevue ? td : cal.finPrevue);
      cal.joursTotal = tot; cal.joursEcoules = ecoule; cal.joursRestants = Math.max(tot - ecoule, 0);
      cal.tempsPct = tot ? ecoule / tot : 0;
      cal.consoPct = total.prevu ? total.conso / total.prevu : 0;
    }
    if (cal.finContrat && cal.finPrevue) {
      cal.glissementJours = Math.round((toUTC(cal.finPrevue) - toUTC(cal.finContrat)) / 864e5);
      cal.glissementOuvres = cal.finPrevue > cal.finContrat ? workdays(addDays(cal.finContrat, 1), cal.finPrevue) : cal.finPrevue < cal.finContrat ? -workdays(addDays(cal.finPrevue, 1), cal.finContrat) : 0;
    }
    if (!cal.debut || !cal.finPrevue) vigilance.unshift({ cle: 'dates', label: 'Dates du projet non renseignées', valeur: '!', niveau: 'critique', detail: 'Renseignez le début et la fin du projet dans ⚙ Paramètres du projet › Dates du projet.' });
    if (cal.glissementJours > 0) vigilance.unshift({ cle: 'gliss', label: 'Glissement de la fin du projet', valeur: cal.glissementJours, unite: 'j', niveau: 'critique', detail: `Fin prévue le ${cal.finPrevue.split('-').reverse().join('/')} au lieu du ${cal.finContrat.split('-').reverse().join('/')} (fin contractuelle)` });
    if (cal.tempsPct != null && cal.consoPct - cal.tempsPct > 0.1) vigilance.push({ cle: 'rythme', label: 'Consommation en avance sur le calendrier', valeur: Math.round((cal.consoPct - cal.tempsPct) * 100), unite: 'pts', niveau: 'attention', detail: `${Math.round(cal.consoPct * 100)} % de la charge consommée pour ${Math.round(cal.tempsPct * 100)} % du temps écoulé` });
    if (cal.finPrevue) {
      const late = tasks.filter((t) => t.fin && t.fin > cal.finPrevue);
      if (late.length) vigilance.push({ cle: 'apresfin', label: 'Tâches datées après la fin prévue', valeur: late.length, niveau: 'critique', detail: late.slice(0, 3).map((t) => t.label).join(' · ') });
    }
    if (cal.debut) {
      const early = tasks.filter((t) => t.debut && t.debut < cal.debut);
      if (early.length) vigilance.push({ cle: 'avantdebut', label: 'Tâches démarrées avant le début du projet', valeur: early.length, niveau: 'attention' });
    }
    if (horsProjetMois.length) vigilance.push({ cle: 'moishors', label: 'Données hors période du projet', valeur: horsProjetMois.length, unite: 'mois', niveau: 'attention', detail: horsProjetMois.map((mk) => mk.split('-').reverse().join('/')).join(', ') });

    return {
      P, months, inProjet, cal, dim: DIM, tasks, sections, jalons, profils, synthese, ventilation, metrique, axes, axeIdsActifs: axeIds.filter((id) => tasks.some((t) => t.axe === id)), total, mensuel, refTotal, tspTotal, replanifie,
      financier, perimetre, dayLoad, surJours, phaseEch, actions: { ouvertes: actOuv, retard: actRetard }, echeancier, echSynth, risques, risquesOuverts, risquesForts, meteo: p.meteo || {}, fraisRows, achatRows, prestaRows,
      ateliers: { list: al, ateliers: cnt('Atelier'), livrables: cnt('Livrable'), parType },
      typeName: (id) => types.find((x) => x.id === id)?.nom || '', ia, vigilance, nonDatees,
      axeStat, // mêmes indicateurs pour un groupe quelconque de tâches (Avancement détaillé)
    };
  }

  /**
   * Avancement détaillé : chaque groupe du regroupement choisi (axe, lot ou phase), ses sous-parties, puis ses tâches.
   * Sous-partie : le lot quand on regroupe par axe ou par phase, la phase quand on regroupe par lot.
   * Indicateurs calculés comme au tableau de bord (axeStat) : aucun chiffre nouveau.
   */
  function avancementArbre(m) {
    const cle = m.dim.key === 'lot' ? 'phase' : 'lot';
    const nomSous = (k) => (cle === 'lot' ? (k ? `Lot ${k}` : 'Sans lot') : k || 'Sans phase');
    return { cle, groupes: m.axes.map((a) => {
      const ts = m.tasks.filter((t) => (t.grp || '') === (a.id || ''));
      const parts = new Map();
      ts.forEach((t) => { const k = String(t[cle] || ''); if (!parts.has(k)) parts.set(k, []); parts.get(k).push(t); });
      return { id: a.id || '', nom: a.nom, stat: a, sous: [...parts].map(([k, l]) => ({ id: k, nom: nomSous(k), stat: m.axeStat(l), taches: l })) };
    }) };
  }

  // ---------- aides communes aux exports ----------
  const meteoLabel = (mt) => { const x = METEO.find((y) => y[0] === mt?.niveau); return x ? `${x[2]} ${x[1]}` : 'Non renseignée'; };
  const taskLabel = (m, uid) => m.tasks.find((t) => t.uid === uid)?.label || '';
  /** Lignes « Achats & frais » (budget, réel, atterrissage, marge nette) ; inP filtre les lignes détaillées (toutes si absent). */
  function achatsFraisRows(m, H, T, SEC, eur, pct, d, inP, quand) {
    const A = m.financier.achats, F = m.financier.frais, fin = m.financier, ok = (x) => !inP || inP(x);
    const eurC = (v) => ({ v: round(v || 0, 2), s: 'eurc' }); // lignes détaillées : au centime (ex. 120,50 €)
    return [
      [T('Achats et frais — budget du TSP, réel et atterrissage (HT)')], ['Achats : atterrissage = le plus élevé du budget et du réel pour chaque ligne du TSP, plus les achats hors TSP. Frais : refacturables et à notre charge comptés à part ; un frais non refacturé au-delà de la part prévue à notre charge réduit la marge.'], [],
      [H(''), H('Budget TSP'), H('Réel saisi'), H('Reste à engager'), H('Atterrissage'), H('Écart'), H('Refacturé (atterrissage)')],
      ['Achats', eur(A.budget), eur(A.reel), eur(A.reste), eur(A.att), eur(A.depasse), eur(A.attRev)],
      ['Frais', eur(F.budget), eur(F.reel), eur(F.reste), eur(F.att), eur(F.depasse), eur(F.attRef)],
      [],
      [H('Marge nette vendue (TSP)'), H('Taux'), H('Marge nette à l’atterrissage'), H('Taux')],
      [eur(fin.margeNetteVendue), pct(fin.tauxMargeNetteVendue), eur(fin.margeNette), pct(fin.tauxMargeNette)],
      [],
      [SEC(`ACHATS ${quand}`)],
      [H('Date'), H('Désignation'), H('Fournisseur'), H('Ligne du TSP'), H('Statut'), H('Montant HT'), H('Refacturé'), H('Par'), H('Commentaire')],
      ...A.lignes.filter((a) => ok(a.date)).map((a) => [d(a.date), a.designation || '', a.fournisseur || '', a.ligne !== '' && a.ligne != null && m.achatRows[+a.ligne] ? m.achatRows[+a.ligne].designation : 'Hors TSP', a.statut || 'Commandé', eurC(a.montant), eurC(a.refacture), a.par || '', a.commentaire || '']),
      ...(A.lignes.some((a) => ok(a.date)) ? [] : [['Aucun achat.']]),
      [],
      [SEC(`FRAIS ${quand}`)],
      [H('Date'), H('Libellé'), H('Collaborateur'), H('Catégorie'), H('Refacturable'), H('Montant HT'), H('Refacturé'), H('Par'), H('Commentaire')],
      ...F.lignes.filter((x) => ok(x.date)).map((x) => [d(x.date), x.libelle || '', x.collaborateur || '', x.categorie || 'Autre', x.refacturable ? 'Oui' : 'Non', eurC(x.montant), eurC(x.refacture), x.par || '', x.commentaire || '']),
      ...(F.lignes.some((x) => ok(x.date)) ? [] : [['Aucun frais.']]),
    ];
  }
  const RISK_HEAD = ['Réf.', 'Type', 'Risque', 'Cause', 'Probabilité', 'Importance', 'Criticité', 'Comment réduire', 'Plan d’actions', 'Responsable', 'Statut', 'Action liée', 'Commentaire'];
  const RISK_COLS = [9, 10, 44, 34, 12, 12, 12, 40, 40, 22, 12, 10, 36];
  const riskRow = (p, r) => [r.ref, r.type || '', r.libelle || '', r.cause || '', r.proba || RISK_DEF.proba, r.impact || RISK_DEF.impact, `${r.crit} — ${riskNiveau(r.crit)}`, r.parade || '', r.plan || '', r.responsable || '', r.statut || 'Ouvert', (p.actions || []).find((a) => a.id === r.action)?.ref || '', r.commentaire || ''];

  // ============================================================
  // 3. EXPORT COPIL (onglets Excel)
  // ============================================================
  /** Invitation d'un atelier, comme à l'écran : envoyée (date) · à envoyer (date fixée) · « — » (réalisé sans invitation, ou date à fixer). */
  const invTxt = (t, at) => (at.invit ? `Envoyée le ${at.invitLe ? at.invitLe.split('-').reverse().join('/') : ''}` : t.statut === 'Validé' || t.annulee || !at.date ? '—' : 'À envoyer');
  /** Exports : les lignes créées puis laissées vides (sans libellé) ne sont pas reprises. */
  const sansVides = (p) => ({ ...p, actions: (p.actions || []).filter(aLibelle), decisions: (p.decisions || []).filter(aLibelle), risques: (p.risques || []).filter(aLibelle) });
  /** Onglet « Lexique » des exports COPIL et COPROJ : un mot = un sens, et la correspondance avec les anciens libellés (transition). */
  const LEXIQUE = [
    ['Vendu', 'Charge et prix du TSP signé', 'TSP, charge propale'],
    ['Prévu', 'Vendu + ajouts − annulations : la charge à réaliser', 'Charge prévue'],
    ['Consommé', 'Jours réellement passés, saisis chaque mois', 'Réel saisi'],
    ['Consommation', 'Consommé ÷ prévu', 'Taux consommé, avancement (tableau de bord)'],
    ['Avancement', 'JH des tâches validées ÷ JH prévus', 'Avancement pondéré (paliers déclarés)'],
    ['Avancement déclaré', 'Sur une tâche : paliers 0 à 100 % (indication, hors calcul)', ''],
    ['RAF', 'Reste à faire : jours encore nécessaires pour terminer', ''],
    ['Atterrissage', 'Consommé + RAF : la charge totale attendue à la fin', 'À terminaison, Atterr.'],
    ['Écart', 'Atterrissage − prévu (▲ dépassement, ▼ économie)', 'Écart ?'],
    ['Valeur produite', 'Jours × TJM du profil (remise déduite)', 'Produit, coût mensuel au TJM'],
  ];
  const lexiqueSheet = () => ({ name: 'Lexique', cols: [18, 60, 40], rows: [
    [{ v: 'Lexique — les mots des exports', t: 'title' }],
    [],
    [{ v: 'Terme', h: true }, { v: 'Définition', h: true }, { v: 'Anciens libellés', h: true }],
    ...LEXIQUE.map(([a, b, c]) => [{ v: a, b: true }, b, c]),
  ] });
  function buildCopil(p, m) {
    p = sansVides(p);
    const f = p.fiche || {};
    const H = (v) => ({ v, h: true });
    const T = (v) => ({ v, t: 'title' });
    const SEC = (v) => ({ v, t: 'section' });
    const jh = (v, b) => ({ v: round(v || 0, 2), s: 'jh', b });
    const eur = (v, b) => ({ v: round(v || 0, 2), s: 'eur', b });
    const vigCell = (v) => (typeof v.valeur !== 'number' ? v.valeur : v.unite === '€' ? eur(v.valeur) : v.unite === 'JH' ? jh(v.valeur) : v.valeur);
    const pct = (v, b) => (v == null ? '' : { v: round(v, 4), s: 'pct', b });
    const d = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
    const mLabel = (mk) => { const [y, mo] = mk.split('-'); return ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][+mo - 1] + ' ' + y; };
    const today = localISO();
    const sheets = [];

    // Tableau de bord
    const db = [
      [T(`COPIL — ${f.client || ''} — ${f.projet || ''}`)],
      [`Situation au ${d(today)}`, '', `Référence : ${f.reference || ''}`],
      [`Début : ${d(m.cal.debut)}`, `Fin contractuelle : ${d(m.cal.finContrat)}`, `Fin prévue : ${d(m.cal.finPrevue)}`, m.cal.glissementJours ? `Glissement : ${m.cal.glissementJours > 0 ? '+' : ''}${m.cal.glissementJours} j` : '', m.cal.tempsPct != null ? `Temps écoulé : ${Math.round(m.cal.tempsPct * 100)} %` : '', m.cal.joursRestants != null ? `Jours ouvrés restants : ${m.cal.joursRestants}` : ''],
      [],
      [SEC('CHARGES (JH)')],
      [H('Prévu (JH)'), H('dont TSP vendu'), H('dont ajouts'), H('dont annulations'), H('Consommé'), H('RAF retenu'), H('Atterrissage'), H('Écart / prévu'), H('Écart / TSP')],
      [jh(m.total.prevu), jh(m.total.prevuTSP), jh(m.total.ajout), jh(-m.total.annule), jh(m.total.conso), jh(m.total.raf), jh(m.total.atterrissage), jh(m.total.ecart), jh(m.total.atterrissage - m.total.prevuTSP)],
      [],
      [SEC('FINANCIER DU FORFAIT')],
      [H('CA du forfait'), H('Coût initial (TSP)'), H('Coût des ajouts'), H('Coût annulé'), H('Coût consommé'), H('Coût RAF'), H('Coût à l’atterrissage'), H('Marge sur production'), H('Taux'), H('Écart / coût TSP')],
      [eur(m.financier.ca), eur(m.financier.coutInitial), eur(m.financier.coutAjout), eur(-m.perimetre.coutAnnule), eur(m.financier.coutConso), eur(m.financier.coutRaf), eur(m.financier.coutFinal), eur(m.financier.marge), pct(m.financier.tauxMarge), eur(m.financier.ecartCout)],
      [H('Achats (atterrissage)'), H('dont budget TSP'), H('Frais (atterrissage)'), H('dont budget TSP'), H('Marge nette vendue'), H('Taux'), H('Marge nette à l’atterrissage'), H('Taux')],
      [eur(m.financier.achats.att), eur(m.financier.achats.budget), eur(m.financier.frais.att), eur(m.financier.frais.budget), eur(m.financier.margeNetteVendue), pct(m.financier.tauxMargeNetteVendue), eur(m.financier.margeNette), pct(m.financier.tauxMargeNette)],
      ...(m.perimetre.lignes.length ? [[],
        [SEC('ÉVOLUTIONS DU PÉRIMÈTRE (ajouts non facturés, annulations)')],
        [H('Date'), H('Par'), H('Ajout'), H('Tâche'), H('Profil(s)'), H('Charge (JH)'), H('Coût (CJM)'), H('Consommé'), H('Motif')],
        ...m.perimetre.lignes.map((l) => [d((l.at || '').slice(0, 10)), l.by || '', l.kind === 'tache' ? 'Nouvelle tâche' : l.kind === 'annul' ? (l.avenant ? 'Annulation (avenant)' : 'Annulation') : l.kind === 'reaff' ? 'Réaffectation' : 'Profil ajouté', l.label, l.profils.join(', '), jh(l.jh), eur(l.cout), jh(l.conso), l.motif || '']),
        [{ v: 'SOLDE (ajouts − annulations)', b: true }, '', '', '', '', jh(m.perimetre.chargeAjout - m.perimetre.chargeAnnulee, true), eur(m.perimetre.coutAjout - m.perimetre.coutAnnule, true)],
        [`Marge vendue : ${fmtP(m.perimetre.margeVendue)}`, '', `Marge avec ajouts : ${fmtP(m.perimetre.margeAvecAjouts)}`]] : []),
      [],
      [SEC('SUIVI PAR TYPE DE TÂCHE')],
      [H(''), H('Prévus'), H('Réalisés'), H('Restants'), H('Taux')],
      ...m.ateliers.parType.map((x) => [x.nom, x.prevus, x.realises, x.restants, pct(x.taux)]),
      [],
      [SEC('ATTERRISSAGE PAR ' + m.dim.label.toUpperCase())],
      [H(m.dim.label), H('Prévu (JH)'), H('Consommé (JH)'), H('RAF (JH)'), H('Atterrissage (JH)'), H('Écart (JH)'), H('Consommation'), H('Avancement'), H('Début prévu'), H('Fin prévue'), H('Début réel'), H('Fin réelle'), H('Statut des tâches'), H('Projection')],
      ...m.axes.map((a) => [a.nom, jh(a.prevu), jh(a.conso), jh(a.raf), jh(a.atterrissage), jh(a.ecart), pct(a.prevu ? a.conso / a.prevu : 0), pct(a.avancement), d(a.planDebut), d(a.planFin), d(a.reelDebut), d(a.reelFin), a.statut, a.ecart > 0.001 ? 'Dépassement' : a.ecart < -0.001 ? 'Optimisation' : 'Conforme']),
      [{ v: 'PROJET', b: true }, jh(m.total.prevu, true), jh(m.total.conso, true), jh(m.total.raf, true), jh(m.total.atterrissage, true), jh(m.total.ecart, true), pct(m.total.prevu ? m.total.conso / m.total.prevu : 0, true), pct(m.total.avancement, true), d(m.total.prevuDebut), d(m.total.prevuFin), d(m.total.reelDebut), d(m.total.reelFin), '', ''],
      [],
      [SEC('POINTS DE VIGILANCE')],
      [H('Indicateur'), H('Valeur'), H('Niveau'), H('Détail')],
      ...m.vigilance.map((v) => [v.label, vigCell(v), v.niveau === 'ok' ? 'OK' : v.niveau === 'critique' ? 'Critique' : 'À surveiller', v.detail || '']),
    ];
    if (m.ia.profil) db.push([], [SEC(`OPTIMISATION IA (enveloppe ${m.ia.profil})`)], [H('Enveloppe IA (JH)'), H('IA consommée (JH)'), H('Économie réalisée (JH)'), H('Taux d’économie'), H('Valeur préservée (TJM)'), H('Projection à l’atterrissage (JH)')],
      [jh(m.ia.ref), jh(m.ia.consomme), jh(m.ia.realise), pct(m.ia.taux), eur(m.ia.valeurTJM), jh(m.ia.projection)]);
    sheets.push({ name: 'Tableau de bord', rows: db, cols: [34, 14, 14, 14, 16, 16, 14, 14, 12, 12, 12, 12, 18, 16, 14] });

    // Relevé des décisions (toutes) et actions ouvertes
    if ((p.decisions || []).length || (p.actions || []).length || (p.risques || []).length) {
      const ouv = (p.actions || []).filter((a) => a.statut !== 'Fait' && a.statut !== 'Annulée');
      sheets.push({ name: 'Décisions & actions', cols: [9, 12, 14, 56, 22, 14, 14, 40, 12, 40], rows: [
        [T('Relevé des décisions')], [],
        [H('Réf.'), H('Date'), H('Instance'), H('Décision'), H('Décideur'), H('Impact'), H('Statut'), H('Commentaire')],
        ...(p.decisions || []).map((x) => [x.ref, d(x.date), x.instance || '', x.libelle, x.decideur || '', x.impact || '', x.statut, x.commentaire || '']),
        [], [SEC(`ACTIONS OUVERTES (${ouv.length})`)],
        [H('Réf.'), H('Date cible'), H('Instance'), H('Action'), H('Responsable'), H('Progression'), H('Statut'), H('Commentaire'), H('Tâche concernée')],
        ...ouv.map((a) => [a.ref, d(a.echeance), a.origine || '', a.libelle, a.porteur || '', pct(num(a.progression)), a.statut + (a.echeance && a.echeance < today ? ' — EN RETARD' : ''), a.commentaire || '', taskLabel(m, a.tache)]),
        [], [SEC(`RISQUES OUVERTS (${m.risquesOuverts.length})`)],
        RISK_HEAD.map(H),
        ...(m.risquesOuverts.length ? [...m.risquesOuverts].sort((x, y) => y.crit - x.crit).map((r) => riskRow(p, r)) : [['Aucun risque ouvert.']]),
      ] });
    }

    // Mensuel
    const mens = [[T('Charges mensuelles (JH) — consommé réel, référence initiale et prévisionnel')], [],
      [H('Mois'), H('Consommé réel'), H('Référence initiale (TSP vendu)'), H('Prévisionnel (replanifié)'), H('Coût interne (CJM)'), H('Coût cumulé'), H('Valeur produite (TJM)'), H('Valeur produite cumulée')],
      // séries réelles arrêtées au mois en cours (un mois futur n'a pas de consommé)
      ...m.mensuel.map((x) => { const fut = x.mois > today.slice(0, 7); return [mLabel(x.mois), fut ? '' : jh(x.conso), jh(x.tsp), jh(x.ref), fut ? '' : eur(x.coutCJM), fut ? '' : eur(x.cumCJM), fut ? '' : eur(x.valoTJM), fut ? '' : eur(x.cumTJM)]; }),
      [], [SEC('Consommé par profil (JH)')], [H('Profil'), ...m.months.map((mk) => H(mLabel(mk))), H('Total')],
      ...m.P.map((pr, i) => pr.nom ? [pr.nom, ...m.mensuel.map((x) => (x.mois > today.slice(0, 7) ? '' : jh(x.consoP[i]))), jh(sum(m.mensuel.map((x) => x.consoP[i])), true)] : null).filter(Boolean)];
    sheets.push({ name: 'Charges mensuelles', rows: mens, cols: [26, ...m.months.map(() => 12), 12] });

    // Ateliers & livrables
    sheets.push({ name: 'Ateliers & livrables', cols: [22, 8, 10, 60, 10, 16, 18, 40, 12, 14, 12, 12, 24, 18, 12, 12, 10, 40], rows: [
      [T('Registre des ateliers & livrables')], [],
      [H(m.dim.label), H('Lot'), H('Type'), H('Intitulé'), H('Prévu (JH)'), H('Date planifiée'), H('Invitation'), H('Destinataires'), H('Réalisé / livré le'), H('Validé client le'), H('Début prévu'), H('Fin prévue'), H('Profil principal'), H('Statut'), H('Avancement'), H('Consommé'), H('RAF'), H('Commentaire')],
      ...m.ateliers.list.map((t) => { const at = t.tr.atelier || {}; return [m.axes.find((a) => a.id === t.grp)?.nom || t.grp, t.lot, m.typeName(t.type), t.label, jh(t.charge), at.date ? d(at.date) + ((at.heureDebut || at.heure) ? ' ' + (at.heureDebut || at.heure) + (at.heureFin ? '–' + at.heureFin : '') : '') : '', t.type === 'Atelier' ? invTxt(t, at) : '', (at.dest || []).join('; '), d(t.realiseLe), t.realiseLe ? d(t.tr.livr?.valideLe) : '', d(t.tr.debut), d(t.tr.fin), t.responsable, t.statut, (t.annulee ? '' : pct(t.avancement)), jh(t.consoTotal), jh(t.raf), t.commentaire]; }),
    ] });

    // Suivi des tâches
    sheets.push({ name: 'Suivi des tâches', cols: [22, 8, 14, 60, 10, 10, 10, 18, 10, 12, 12, 12, 12, 10, 10, 10, 10, 40], rows: [
      [T('Suivi détaillé des tâches')], [],
      [H(m.dim.label), H('Lot'), H('Phase'), H('Tâche'), H('Origine'), H('Prévu (JH)'), H('dont ajout'), H('Statut'), H('Avancement déclaré'), H('Début prévu'), H('Fin prévue'), H('Début réel'), H('Fin réelle'), H('Consommé'), H('RAF'), H('Atterrissage'), H('Écart'), H('Commentaire')],
      ...m.tasks.map((t) => [m.axes.find((a) => a.id === t.grp)?.nom || 'Sans ' + m.dim.label.toLowerCase(), t.lot, t.phase, t.label, t.estAjout ? 'Ajoutée' : 'TSP', jh(t.charge), t.chargeAjout ? jh(t.chargeAjout) : '', t.statut, (t.annulee ? '' : pct(t.avancement)), d(t.tr.debut), d(t.tr.fin), d(t.consoDates[0]), d(t.consoDates[t.consoDates.length - 1]), jh(t.consoTotal), jh(t.raf), jh(t.atterrissage), jh(t.ecart), t.commentaire]),
    ] });

    // Consommé détaillé par profil
    const det = [];
    for (const t of m.tasks) t.charges.forEach((c, i) => { if (c > 0 || t.consoP[i] > 0) det.push([m.axes.find((a) => a.id === t.grp)?.nom || 'Sans ' + m.dim.label.toLowerCase(), t.label, (m.P[i]?.nom || '') + (m.P[i]?.ajout ? ' (profil ajouté)' : ''), jh(c), t.chargesA[i] ? jh(t.chargesA[i]) : '', jh(t.consoP[i]), jh(t.restP[i]), c ? pct(t.consoP[i] / c) : '']); });
    sheets.push({ name: 'Consommé par profil', cols: [22, 60, 28, 12, 10, 12, 12, 12], rows: [
      [T('Consommé détaillé par tâche et par profil')], [],
      [H(m.dim.label), H('Tâche'), H('Profil'), H('Charge (JH)'), H('dont ajout'), H('Consommé (JH)'), H('Reste (JH)'), H('% consommé')], ...det] });

    // Planning (Gantt simplifié : une colonne par mois)
    sheets.push({ name: 'Planning', cols: [22, 60, 12, 12, 16, ...m.months.map(() => 9)], rows: [
      [T('Planning — ■ mois prévus · ● mois consommés hors de la période prévue')], [],
      [H(m.dim.label), H('Tâche'), H('Début prévu'), H('Fin prévue'), H('Statut'), ...m.months.map((mk) => H(mLabel(mk)))],
      ...m.tasks.map((t) => [m.axes.find((a) => a.id === t.grp)?.nom || 'Sans ' + m.dim.label.toLowerCase(), t.label, d(t.tr.debut), d(t.tr.fin), t.statut,
        ...m.months.map((mk) => (planifiee(t) && (t.tr.debut || t.tr.fin).slice(0, 7) <= mk && t.tr.fin.slice(0, 7) >= mk ? '■' : t.consoDates.some((x) => x.slice(0, 7) === mk) ? '●' : ''))]),
    ] });

    // Échéancier
    sheets.push({ name: 'Facturation', cols: [6, 60, 8, 12, 12, 12, 14, 30, 12, 14, 16, 18, 16, 18, 12, 16, 18, 16, 12], rows: [
      [T('Facturation & vision FAE')], [`Facturé : ${fmtE(m.echSynth.facture)} · payé : ${fmtE(m.echSynth.paye)} · reste à facturer : ${fmtE(m.echSynth.reste)} · FAE à date : ${fmtE(m.echSynth.faeADate)}${Math.abs(m.echSynth.ajustAvenant) > 0.5 ? ` · avenant réparti sur les échéances non facturées : ${fmtE(m.echSynth.ajustAvenant)}` : ''}`], [],
      [H('N°'), H('Échéance'), H('%'), H('Mois du TSP'), H('Date prévue'), H('Facturée le'), H('Payée le'), H('Statut'), H('Périmètre lié'), H('Avancement lié'), H('Montant'), H('Facturé cumulé prévu'), H('Valeur produite prévue (cumul)'), H('FAE prévue'), H('FAE prévue (%)'), H('Facturé réel (cumul)'), H('Valeur produite réelle (cumul)'), H('FAE réelle'), H('FAE réelle (%)')],
      ...m.echeancier.map((e) => [e.n, e.nom, pct(e.pct), e.moisTSP ? mLabel(e.moisTSP) : '', d(e.datePrevue), d(e.realiseLe), d(e.payeeLe), e.statut + (e.apresFin ? ' (après la fin du projet)' : ''), [e.phases.length ? 'Phases : ' + e.phases.join(', ') : '', e.nLies ? `${e.nLies} tâche(s), ${e.nLiesValides} validée(s)` : ''].filter(Boolean).join(' · '), pct(e.avLie), eur(e.montant), eur(e.factCum), e.prodPlan == null ? '' : eur(e.prodPlan), e.faePlan == null ? '' : eur(e.faePlan), e.faePlanPct == null ? '' : pct(e.faePlanPct), e.factReel == null ? '' : eur(e.factReel), e.prodReel == null ? '' : eur(e.prodReel), e.faeReel == null ? '' : eur(e.faeReel), e.faeReelPct == null ? '' : pct(e.faeReelPct)]),
    ] });
    // Achats & frais (toutes les lignes)
    { const A = m.financier.achats, F = m.financier.frais;
      if (A.budget || A.lignes.length || F.budget || F.lignes.length) sheets.push({ name: 'Achats & frais', cols: [14, 40, 22, 22, 14, 14, 14, 14, 30], rows: achatsFraisRows(m, H, T, SEC, eur, pct, d, null, 'SAISIS') }); }
    // Historique des indicateurs (une photo par comité)
    // Optimisation IA : enveloppe Agent IA, résultat constaté et justification par tâche
    if (m.ia.profil && m.ia.tasks.length) {
      const LIB = { avenir: 'À venir', encours: 'En cours', totale: 'Économie totale', partielle: 'Économie partielle', conforme: 'Conforme', depassement: 'Dépassement' };
      sheets.push({ name: 'Optimisation IA', cols: [22, 60, 16, 12, 12, 12, 12, 18, 34, 60], rows: [
        [T(`Optimisation IA — enveloppe « ${m.ia.profil} » (réserve adossée aux profils de chaque tâche)`)], [],
        [H('Enveloppe IA (JH)'), H('IA consommée (JH)'), H('Économie réalisée (JH)'), H('Taux d’économie'), H('Valeur préservée (TJM)'), H('Coût évité (CJM)'), H('Projection (JH)'), H('À justifier')],
        [jh(m.ia.ref), jh(m.ia.consomme), jh(m.ia.realise), pct(m.ia.taux), eur(m.ia.valeurTJM), eur(m.ia.valeurCJM), jh(m.ia.projection), m.ia.aJustifier.length],
        [], [SEC('Résultat par type (tâches validées)')], [H('Type'), H('Sens'), H('Tâches'), H('JH')],
        ...m.ia.parType.map((x) => [x.type, x.sens === 'eco' ? 'Économie' : 'Dépassement', x.n, jh(x.jh)]),
        [], [SEC('Détail par tâche')],
        [H(m.dim.label), H('Tâche'), H('Statut'), H('Enveloppe IA'), H('IA consommée'), H('Résultat (JH)'), H('Statut IA'), H('Type'), H('Commentaire')],
        ...m.ia.tasks.map((t) => [m.axes.find((a) => a.id === t.grp)?.nom || '', t.label, t.statut, jh(t.ia), jh(t.iaConso), jh(t.iaRes), (LIB[t.iaStatut] || '') + (t.iaAJustifier ? ' — À JUSTIFIER' : ''), t.iaType, t.iaJustif]),
      ] });
    }
    if ((p.historique || []).length) sheets.push({ name: 'Historique', cols: [12, 10, 12, 12, 12, 14, 14, 14, 12, 14, 18], rows: [
      [T('Évolution des indicateurs d’un comité à l’autre')], [],
      [H('Date'), H('Comité'), H('Prévu (JH)'), H('Consommé (JH)'), H('Atterrissage (JH)'), H('Coût à l’atterrissage'), H('Marge sur production'), H('Marge nette'), H('Taux net'), H('Fin prévue')],
      ...p.historique.map((h) => [d(h.date), h.kind, jh(h.prevu), jh(h.conso), jh(h.atterrissage), eur(h.coutFinal), eur(h.marge), eur(h.margeNette), pct(h.tauxMargeNette), d(h.finPrevue)]),
    ] });
    sheets.push(lexiqueSheet());
    return sheets;
  }


  // ============================================================
  // 4. EXPORT COPROJ (comité projet : opérationnel, court terme)
  // Le COPIL regarde la trajectoire du forfait ; le COPROJ regarde
  // ce qui s'est passé depuis le dernier comité et ce qui arrive.
  // ============================================================
  /**
   * Export des trois registres (Actions & décisions) : une feuille par registre, tous les éléments (ouverts d'abord),
   * avec toutes les colonnes utiles en comité. Les exports COPIL et COPROJ ne changent pas.
   */
  function buildRegistres(p, m, opts = {}) {
    const H = (v) => ({ v, h: true }), T = (v) => ({ v, t: 'title' });
    const pct = (v) => ({ v: round(v, 4), s: 'pct' });
    const d = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
    const auj = opts.aujourdhui || localISO(new Date()), quand = d(auj);
    const acts = p.actions || [], decs = p.decisions || [];
    const ouverte = (a) => a.statut !== 'Fait' && a.statut !== 'Annulée';
    const retard = (a) => ouverte(a) && a.echeance && a.echeance < auj;
    const actsT = [...acts].sort((x, y) => (ouverte(y) - ouverte(x)) || String(x.echeance || '9999').localeCompare(String(y.echeance || '9999')) || String(x.ref).localeCompare(String(y.ref)));
    const decsT = [...decs].sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')) || String(y.ref).localeCompare(String(x.ref)));
    const rks = [...(m.risques || [])].sort((x, y) => (m.risquesOuverts.includes(y) - m.risquesOuverts.includes(x)) || y.crit - x.crit || String(x.ref).localeCompare(String(y.ref)));
    return [
      { name: 'Actions', cols: [9, 56, 26, 14, 12, 12, 12, 22, 12, 44, 40], rows: [
        [T('Actions')], [`${acts.length} action(s), dont ${acts.filter(ouverte).length} ouverte(s) et ${acts.filter(retard).length} en retard · exporté le ${quand}`], [],
        [H('Réf.'), H('Action'), H('Responsable(s)'), H('Instance'), H('Créée le'), H('Date cible'), H('Progression'), H('Statut'), H('Faite le'), H('Commentaire'), H('Tâche concernée')],
        ...(actsT.length ? actsT.map((a) => [a.ref, a.libelle || '', a.porteur || '', a.origine || '', d(a.cree), d(a.echeance), pct(num(a.progression)), a.statut + (retard(a) ? ' — EN RETARD' : ''), d(a.faitLe), a.commentaire || '', taskLabel(m, a.tache)]) : [['Aucune action.']]),
      ] },
      { name: 'Décisions', cols: [9, 12, 14, 56, 26, 14, 14, 44], rows: [
        [T('Décisions')], [`${decs.length} décision(s), dont ${decs.filter((x) => x.statut === 'À valider').length} à valider · exporté le ${quand}`], [],
        [H('Réf.'), H('Date'), H('Instance'), H('Décision'), H('Décideur'), H('Impact'), H('Statut'), H('Commentaire')],
        ...(decsT.length ? decsT.map((x) => [x.ref, d(x.date), x.instance || '', x.libelle || '', x.decideur || '', x.impact || '', x.statut || '', x.commentaire || '']) : [['Aucune décision.']]),
      ] },
      { name: 'Risques', cols: RISK_COLS, rows: [
        [T('Risques')], [`${rks.length} risque(s), dont ${m.risquesOuverts.length} ouvert(s) · exporté le ${quand}`], [],
        RISK_HEAD.map(H),
        ...(rks.length ? rks.map((r) => riskRow(p, r)) : [['Aucun risque.']]),
      ] },
    ];
  }

  function buildCoproj(p, m, opts = {}) {
    p = sansVides(p);
    const f = p.fiche || {};
    const today = localISO();
    const to = opts.to || today, from = opts.from || addDays(to, -14), horizon = opts.horizon || 14;
    const end = addDays(to, horizon);
    const H = (v) => ({ v, h: true }), T = (v) => ({ v, t: 'title' }), SEC = (v) => ({ v, t: 'section' });
    const jh = (v, b) => ({ v: round(v || 0, 2), s: 'jh', b });
    const eur = (v, b) => ({ v: round(v || 0, 2), s: 'eur', b });
    const vigCell = (v) => (typeof v.valeur !== 'number' ? v.valeur : v.unite === '€' ? eur(v.valeur) : v.unite === 'JH' ? jh(v.valeur) : v.valeur);
    const pct = (v, b) => (v == null ? '' : { v: round(v, 4), s: 'pct', b });
    const d = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
    const inP = (x) => x && x >= from && x <= to;
    const grpName = (t) => m.axes.find((a) => a.id === t.grp)?.nom || 'Sans ' + m.dim.label.toLowerCase();
    const P = m.P, tasks = m.tasks;
    // consommé de la période, par tâche et par profil
    const per = tasks.map((t) => {
      const byP = P.map((_, i) => sum(Object.entries(t.tr.consoP?.[i] || {}).filter(([x]) => inP(x)).map(([, v]) => num(v))));
      return { t, byP, tot: sum(byP) };
    });
    const consoPer = sum(per.map((x) => x.tot));
    const valideLe = (t) => t.tr.valideLe || (t.statut === 'Validé' ? t.consoDates[t.consoDates.length - 1] || null : null);
    const validees = tasks.filter((t) => t.statut === 'Validé' && inP(valideLe(t)));
    const demarrees = tasks.filter((t) => inP(t.consoDates[0]));
    const nonVal = tasks.filter((t) => t.statut !== 'Validé' && !t.annulee);
    const retardFin = nonVal.filter((t) => t.tr.fin && t.tr.fin < to);
    const retardDeb = nonVal.filter((t) => !t.consoTotal && t.tr.debut && t.tr.debut < to && !retardFin.includes(t));
    const bloquees = nonVal.filter((t) => t.statut === 'Bloqué / En attente');
    const aDemarrer = nonVal.filter((t) => !t.consoTotal && t.tr.debut && t.tr.debut >= to && t.tr.debut <= end);
    const aTerminer = nonVal.filter((t) => t.tr.fin && t.tr.fin >= to && t.tr.fin <= end);
    const reest = tasks.filter((t) => t.rafAReestimer), depass = tasks.filter((t) => t.consoTotal > t.charge + 1e-9);
    const ajouts = m.perimetre.lignes.filter((l) => inP((l.at || '').slice(0, 10)));
    const evolTxt = (ls) => { const aj = ls.filter((l) => l.kind !== 'annul' && l.kind !== 'reaff'), an = ls.filter((l) => l.kind === 'annul'), re = ls.filter((l) => l.kind === 'reaff'), s = (l0) => fmtJ(sum(l0.map((l) => Math.abs(l.jh))));
      return [aj.length ? `${aj.length} ajout(s) (+${s(aj)} JH)` : '', an.length ? `${an.length} annulation(s) (−${s(an)} JH)` : '', re.length ? `${re.length} réaffectation(s) (${s(re)} JH déplacés, total inchangé)` : ''].filter(Boolean).join(', ') || 'aucune'; };
    const t0 = m.total, c = m.cal;
    const acts = p.actions || [], decs = p.decisions || [];
    const actOuv = acts.filter((a) => a.statut !== 'Fait' && a.statut !== 'Annulée');
    const actRet = actOuv.filter((a) => a.echeance && a.echeance < to);
    const sheets = [];

    // 1. Synthèse
    const syn = [
      [T(`COPROJ — ${f.client || ''} — ${f.projet || ''}`)],
      [`Période couverte : du ${d(from)} au ${d(to)}`, '', `Horizon : jusqu’au ${d(end)} (${Math.round(horizon / 7)} semaine(s))`, '', `Référence : ${f.reference || ''}`],
      [],
      [SEC('OÙ EN EST-ON ?')],
      [H('Avancement global'), H('Temps écoulé'), H('Charge consommée'), H('Consommé (JH)'), H('Prévu (JH)'), H('RAF (JH)'), H('Atterrissage (JH)'), H('Écart (JH)'), H('Fin prévue'), H('Jours ouvrés restants')],
      [pct(t0.avancement), pct(c.tempsPct), pct(c.consoPct), jh(t0.conso), jh(t0.prevu), jh(t0.raf), jh(t0.atterrissage), jh(t0.ecart), d(c.finPrevue), c.joursRestants ?? ''],
      [],
      [SEC('DEPUIS LE DERNIER COMITÉ')],
      [H('Consommé sur la période'), H('Tâches démarrées'), H('Tâches validées'), H('Ateliers / livrables validés'), H('Évolutions du périmètre')],
      [jh(consoPer), demarrees.length, validees.length, validees.filter((t) => t.type).length, evolTxt(ajouts)],
      [],
      [SEC('À TRAITER EN COMITÉ')],
      [H('En retard (fin dépassée)'), H('Démarrage en retard'), H('Bloquées / en attente'), H('RAF à réestimer'), H('En dépassement'), H(`À démarrer d’ici le ${d(end)}`), H(`À terminer d’ici le ${d(end)}`), H('Actions ouvertes'), H('dont en retard'), H('Décisions à valider'), H('Risques forts ouverts')],
      [retardFin.length, retardDeb.length, bloquees.length, reest.length, depass.length, aDemarrer.length, aTerminer.length, actOuv.length, actRet.length, decs.filter((x) => x.statut === 'À valider').length, m.risquesForts.length],
      [],
      [SEC(`AVANCEMENT PAR ${m.dim.label.toUpperCase()}`)],
      [H(m.dim.label), H('Statut des tâches'), H('Avancement'), H('Consommé période'), H('Consommé total'), H('Prévu'), H('RAF'), H('Écart'), H('Début prévu'), H('Fin prévue')],
      ...m.axes.map((a) => [a.nom, a.statut, pct(a.avancement), jh(sum(per.filter((x) => x.t.grp === a.id).map((x) => x.tot))), jh(a.conso), jh(a.prevu), jh(a.raf), jh(a.ecart), d(a.planDebut), d(a.planFin)]),
      [],
      [SEC('POINTS DE VIGILANCE')],
      [H('Indicateur'), H('Valeur'), H('Niveau'), H('Détail')],
      ...m.vigilance.filter((v) => v.niveau !== 'ok').map((v) => [v.label, vigCell(v), v.niveau === 'critique' ? 'Critique' : 'À surveiller', v.detail || '']),
    ];
    sheets.push({ name: 'Synthèse COPROJ', rows: syn, cols: [26, 16, 16, 16, 16, 16, 16, 14, 14, 16] });

    // 2. Plan d'action : la feuille de travail du comité
    const actRow = (cat, t) => [cat, grpName(t), t.label, t.responsable, t.statut, (t.annulee ? '' : pct(t.avancement)), d(t.tr.debut), d(t.tr.fin), jh(t.consoTotal), jh(t.raf), t.commentaire, '', ''];
    const cats = [['En retard (fin prévue dépassée)', retardFin], ['Démarrage en retard', retardDeb], ['Bloquée / en attente', bloquees], ['RAF à réestimer', reest], ['En dépassement', depass], [`À démarrer d’ici le ${d(end)}`, aDemarrer], [`À terminer d’ici le ${d(end)}`, aTerminer]];
    // une ligne par tâche ; si elle relève de plusieurs points, les motifs sont regroupés (« En retard · RAF à réestimer »)
    const byUid = new Map();
    for (const [cat, list] of cats) for (const t of list) { const x = byUid.get(t.uid); if (x) { if (!x.cats.includes(cat)) x.cats.push(cat); } else byUid.set(t.uid, { t, cats: [cat] }); }
    const act = [...byUid.values()].map(({ t, cats: cs }) => actRow(cs.join(' · '), t));
    sheets.push({ name: 'Plan d’action', cols: [30, 22, 56, 22, 18, 11, 12, 12, 11, 10, 40, 30, 16], rows: [
      [T('Plan d’action — tâches à traiter en comité')], ['Les deux dernières colonnes sont à compléter pendant la réunion.'], [],
      [H('Point'), H(m.dim.label), H('Tâche'), H('Profil principal'), H('Statut'), H('Avancement déclaré'), H('Début prévu'), H('Fin prévue'), H('Consommé'), H('RAF'), H('Commentaire'), H('Action / décision'), H('Date cible')],
      ...(act.length ? act : [['Aucun point bloquant ni date cible sur la période.']]),
    ] });

    // 2 bis. Actions et décisions
    const aRow = (a) => [a.ref, a.libelle, a.porteur || '', a.origine || '', d(a.cree), d(a.echeance), pct(num(a.progression)), a.statut + (a.statut !== 'Fait' && a.statut !== 'Annulée' && a.echeance && a.echeance < to ? ' — EN RETARD' : ''), d(a.faitLe), a.commentaire || '', taskLabel(m, a.tache)];
    const actsSorted = [...actOuv.sort((x, y) => String(x.echeance || '9').localeCompare(String(y.echeance || '9'))), ...acts.filter((a) => a.statut === 'Fait' && inP(a.faitLe))];
    sheets.push({ name: 'Actions', cols: [9, 56, 22, 14, 12, 12, 12, 22, 12, 40, 40], rows: [
      [T('Suivi des actions')], [`${actOuv.length} action(s) ouverte(s), dont ${actRet.length} en retard · actions soldées sur la période en fin de liste.`], [],
      [H('Réf.'), H('Action'), H('Responsable'), H('Instance'), H('Créée le'), H('Date cible'), H('Progression'), H('Statut'), H('Faite le'), H('Commentaire'), H('Tâche concernée')],
      ...(actsSorted.length ? actsSorted.map(aRow) : [['Aucune action ouverte.']]),
    ] });
    const dRow = (x) => [x.ref, d(x.date), x.instance || '', x.libelle, x.decideur || '', x.impact || '', x.statut, x.commentaire || ''];
    const decsSel = decs.filter((x) => inP(x.date) || x.statut === 'À valider');
    sheets.push({ name: 'Décisions', cols: [9, 12, 14, 56, 22, 14, 14, 40], rows: [
      [T('Relevé des décisions')], ['Décisions prises sur la période et décisions encore à valider.'], [],
      [H('Réf.'), H('Date'), H('Instance'), H('Décision'), H('Décideur'), H('Impact'), H('Statut'), H('Commentaire')],
      ...(decsSel.length ? decsSel.map(dRow) : [['Aucune décision sur la période.']]),
    ] });

    // 2 bis b. Risques ouverts
    if ((p.risques || []).length) sheets.push({ name: 'Risques', cols: RISK_COLS, rows: [
      [T('Registre des risques')], [`${m.risquesOuverts.length} risque(s) ouvert(s), dont ${m.risquesForts.length} fort(s) (criticité ≥ 8 sur 16).`], [],
      RISK_HEAD.map(H),
      ...(m.risquesOuverts.length ? [...m.risquesOuverts].sort((x, y) => y.crit - x.crit).map((r) => riskRow(p, r)) : [['Aucun risque ouvert.']]),
    ] });

    // 2 ter. Échéances de facturation : en retard, réalisées sur la période, à venir dans l'horizon
    const echSel = m.echeancier.filter((e) => e.statut === 'En retard' || inP(e.realiseLe) || (!e.realiseLe && e.datePrevue && e.datePrevue >= to && e.datePrevue <= end));
    if (m.echeancier.length) sheets.push({ name: 'Échéances', cols: [6, 50, 12, 12, 12, 14, 30, 14, 14], rows: [
      [T('Échéances de facturation')], [`En retard, facturées sur la période et à venir d’ici le ${d(end)}.`], [],
      [H('N°'), H('Échéance'), H('Montant'), H('Date prévue'), H('Facturée le'), H('Statut'), H('Périmètre lié'), H('Avancement lié'), H('Prête à facturer')],
      ...(echSel.length ? echSel.map((e) => [e.n, e.nom, eur(e.montant), d(e.datePrevue), d(e.realiseLe), e.statut, [e.phases.length ? 'Phases : ' + e.phases.join(', ') : '', e.nLies ? `${e.nLies} tâche(s)` : ''].filter(Boolean).join(' · '), pct(e.avLie), e.realiseLe ? '' : e.pret ? 'Oui' : e.nLies ? 'Non' : '']) : [['Aucune échéance concernée.']]),
    ] });

    // 3. Activité de la période (qui a travaillé sur quoi)
    const actv = [];
    for (const x of per) x.byP.forEach((v, i) => { if (v > 0) actv.push([grpName(x.t), x.t.label, P[i]?.nom || '', jh(v), jh(x.t.consoP[i]), jh(x.t.charges[i]), jh(x.t.restP[i]), x.t.statut]); });
    const parProfil = P.map((pr, i) => [pr, sum(per.map((x) => x.byP[i]))]).filter(([pr, v]) => pr.nom && v > 0);
    sheets.push({ name: 'Activité de la période', cols: [22, 56, 28, 14, 14, 12, 12, 18], rows: [
      [T(`Consommé du ${d(from)} au ${d(to)}`)], [],
      [SEC('Par personne')], [H('Profil'), H('Consommé période (JH)')],
      ...parProfil.map(([pr, v]) => [pr.nom, jh(v)]), [{ v: 'TOTAL', b: true }, jh(consoPer, true)], [],
      [SEC('Par tâche et par profil')],
      [H(m.dim.label), H('Tâche'), H('Profil'), H('Consommé période'), H('Consommé total'), H('Charge'), H('Reste'), H('Statut')], ...(actv.length ? actv : [['Aucun consommé saisi sur la période.']]),
    ] });

    // 4. Charge de l'équipe : mois en cours et mois suivant (planning de charge vs consommé)
    const mk0 = monthOf(today > to ? today : to), mk1 = addMonths(mk0, 1);
    const plan = (i, mk) => { const k = p.planningRef?.months?.indexOf(mk) ?? -1; return k >= 0 ? num(p.planningRef.rows[i]?.[k]) : 0; };
    const consoMois = (i, mk) => sum(tasks.map((t) => sum(Object.entries(t.tr.consoP?.[i] || {}).filter(([x]) => monthOf(x) === mk).map(([, v]) => num(v)))));
    const wd = (mk) => monthDays(mk).filter(isWorkday);
    const resteOuvres = wd(mk0).filter((x) => x > (today > to ? today : to)).length;
    const eq = P.map((pr, i) => [pr, i]).filter(([pr]) => pr.nom).map(([pr, i]) => {
      const pl = plan(i, mk0), co = consoMois(i, mk0), rst = Math.max(pl - co, 0);
      return [pr.nom, jh(pl), jh(co), jh(rst), resteOuvres, rst > resteOuvres + 1e-9 ? 'Surcharge' : '', jh(plan(i, mk1)), wd(mk1).length, plan(i, mk1) > wd(mk1).length + 1e-9 ? 'Surcharge' : ''];
    });
    sheets.push({ name: 'Charge équipe', cols: [30, 14, 14, 14, 14, 14, 14, 14, 14], rows: [
      [T('Charge de l’équipe — prévisionnel de charge et consommé')], [`Mois en cours : ${mk0.split('-').reverse().join('/')} · mois suivant : ${mk1.split('-').reverse().join('/')}. « Surcharge » = plus de jours prévus que de jours ouvrés disponibles.`], [],
      [H('Profil'), H('Prévu mois en cours'), H('Consommé mois en cours'), H('Reste à faire ce mois'), H('Jours ouvrés restants'), H('Alerte'), H('Prévu mois suivant'), H('Jours ouvrés mois suivant'), H('Alerte')], ...eq,
    ] });

    // 5. Ateliers & livrables : réalisés et à venir
    const al = tasks.filter((t) => t.type);
    const atl = (t) => t.tr.atelier || {};
    const alRow = (cat, t) => [cat, m.typeName(t.type), grpName(t), t.label, t.responsable, t.statut, d(atl(t).date || t.tr.debut) + ((atl(t).heureDebut || atl(t).heure) ? ' ' + (atl(t).heureDebut || atl(t).heure) + (atl(t).heureFin ? '–' + atl(t).heureFin : '') : ''), d(t.tr.fin), t.type === 'Atelier' ? invTxt(t, atl(t)) : t.type === 'Livrable' ? (t.realiseLe ? `Livré le ${d(t.realiseLe)}` : 'À livrer') : '', t.type === 'Livrable' ? (!t.realiseLe ? '' : t.tr.livr?.valideLe ? `Validé client le ${d(t.tr.livr.valideLe)}` : 'En attente de validation client') : (atl(t).dest || []).join('; '), d(valideLe(t))];
    const alRows = [
      ...al.filter((t) => t.statut === 'Validé' && inP(valideLe(t))).map((t) => alRow('Réalisé sur la période', t)),
      ...al.filter((t) => !t.annulee && t.statut !== 'Validé' && t.tr.fin && t.tr.fin < to).map((t) => alRow('En retard', t)),
      ...al.filter((t) => !t.annulee && t.statut !== 'Validé' && !(t.tr.fin && t.tr.fin < to) && ((t.tr.debut && t.tr.debut <= end && t.tr.debut >= to) || (t.tr.fin && t.tr.fin <= end && t.tr.fin >= to))).map((t) => alRow('À venir', t)),
    ];
    sheets.push({ name: 'Ateliers & livrables', cols: [22, 12, 22, 56, 22, 18, 16, 12, 18, 50, 12], rows: [
      [T('Ateliers & livrables — réalisés sur la période et à venir')], [],
      [H(''), H('Type'), H(m.dim.label), H('Intitulé'), H('Profil principal'), H('Statut'), H('Date / début'), H('Fin'), H('Invitation / livraison'), H('Destinataires / validation client'), H('Validé le')],
      ...(alRows.length ? alRows : [['Aucun atelier ni livrable réalisé sur la période, en retard ou à venir.']]),
    ] });

    // 6. Ajouts au périmètre de la période
    if (m.perimetre.lignes.length) sheets.push({ name: 'Ajouts périmètre', cols: [12, 16, 16, 56, 30, 12, 12, 40], rows: [
      [T('Évolutions du périmètre (non facturées)')], [`Sur la période : ${evolTxt(ajouts)}. Solde depuis le début du projet (ajouts − annulations) : ${fmtJ(m.perimetre.chargeAjout - m.perimetre.chargeAnnulee)} JH, ${fmtE(m.perimetre.coutAjout - m.perimetre.coutAnnule)}.`], [],
      [H('Date'), H('Par'), H('Ajout'), H('Tâche'), H('Profil(s)'), H('Charge (JH)'), H('Coût (CJM)'), H('Motif')],
      ...m.perimetre.lignes.map((l) => [d((l.at || '').slice(0, 10)), l.by || '', (l.kind === 'tache' ? 'Nouvelle tâche' : l.kind === 'annul' ? 'Annulation' : l.kind === 'reaff' ? 'Réaffectation' : 'Profil ajouté') + (inP((l.at || '').slice(0, 10)) ? ' (période)' : ''), l.label, l.profils.join(', '), jh(l.jh), eur(l.cout), l.motif || '']),
    ] });
    // 7. Achats et frais : budget TSP / réel / atterrissage, lignes de la période
    { const A = m.financier.achats, F = m.financier.frais;
      if (A.budget || A.lignes.length || F.budget || F.lignes.length) sheets.push({ name: 'Achats & frais', cols: [14, 40, 22, 22, 14, 14, 14, 14, 30], rows: achatsFraisRows(m, H, T, SEC, eur, pct, d, inP, 'DE LA PÉRIODE') }); }
    // Avancement détaillé (charte v2) : groupes, sous-parties et tâches, comme l'écran Pilotage › Avancement détaillé
    const arbre = avancementArbre(m);
    const fr = (a, b) => (b ? `${a} / ${b}` : '—');
    const ligneAv = (niv, nom, s, b) => [{ v: niv, b }, { v: nom, b }, { v: s.statut, b }, pct(s.avancement, b), jh(s.prevu, b), jh(s.conso, b), jh(s.raf, b), jh(s.atterrissage, b), jh(s.ecart, b), { v: fr(s.valides, s.actives), b }, { v: fr(s.ateliersOK, s.ateliers), b }, { v: fr(s.livrablesOK, s.livrables), b }];
    sheets.push({ name: 'Avancement détaillé', cols: [14, 60, 18, 12, 12, 12, 12, 14, 12, 14, 12, 12], rows: [
      [T(`Avancement détaillé — ${f.client || ''} — ${f.projet || ''}`)],
      [`Par ${m.dim.label.toLowerCase()}, puis par ${arbre.cle}, puis par tâche. Situation au ${d(today)}. Avancement = JH des tâches validées ÷ JH prévus. Tâches, ateliers et livrables : validés / prévus.`],
      [],
      [H('Niveau'), H(m.dim.label + ' / ' + (arbre.cle === 'lot' ? 'lot' : 'phase') + ' / tâche'), H('Statut'), H('Avancement'), H('Prévu (JH)'), H('Consommé (JH)'), H('RAF (JH)'), H('Atterrissage (JH)'), H('Écart (JH)'), H('Tâches validées'), H('Ateliers'), H('Livrables')],
      ...arbre.groupes.flatMap((g) => [ligneAv(m.dim.label, g.nom, g.stat, true), ...g.sous.flatMap((sp) => [ligneAv(arbre.cle === 'lot' ? 'Lot' : 'Phase', '   ' + sp.nom, sp.stat),
        ...sp.taches.map((t) => ['Tâche', '      ' + t.label + (m.typeName(t.type) ? ` [${m.typeName(t.type)}]` : ''), t.annulee ? 'Annulée' : t.statut, t.annulee ? '' : pct(t.statut === 'Validé' ? 1 : 0), jh(t.charge), jh(t.consoTotal), jh(t.raf), jh(t.atterrissage), jh(t.ecart), '', '', ''])])]),
      ligneAv('Projet', 'PROJET', t0, true),
    ] });
    sheets.push(lexiqueSheet());
    return sheets;
  }

  return {
    avancementArbre,
    parseTSP, compute, buildCopil, buildCoproj, buildRegistres, migrate, migrerPlanning, migrerRisques, riskNiveau, RISK_DEF, RISK_TYPES, normLot, TYPES_SOCLE, flatten, merge3, applyFlat, describeKey, summarizeChanges, newTaskObj, insertTask, reconcileProfiles, remapProfiles, STATUTS, AVANCEMENTS, IA_LEVIERS, IA_CAUSES, IA_CONFORME, ACHAT_STATUTS, FRAIS_CATEGORIES, METEO, RISK_PROBA, RISK_IMPACT, RISK_ST, multiJours, SCHEMA,
    util: { planifiee, localISO, num, str, round, sum, addDays, addMonths, monthDays, monthOf, dow, isWorkday, holidayName, workdays, defaultAxeName, toUTC, detectType },
  };
})();


