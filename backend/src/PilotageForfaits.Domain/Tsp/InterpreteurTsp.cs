using System.Globalization;
using System.Text.RegularExpressions;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Tsp;

/// <summary>
/// Lit le contenu d'un TSP (onglets FICHE PROJET, PROFIL, WORKLOAD, FRAIS, ACHAT, ECHEANCIER, METRIQUE, PLANNING, REF).
/// Traduction fidèle de « parseTSP » de la version de référence (POC v65) : mêmes règles de repérage des colonnes,
/// mêmes valeurs par défaut, mêmes messages. Règle : on ne réutilise jamais les résultats de formules
/// « intelligents » du TSP (ils peuvent être faux, ex. #REF!) ; le moteur recalcule tout.
/// </summary>
public static class InterpreteurTsp
{
    private static readonly Dictionary<string, string> CleFiche = new()
    {
        ["nom du client"] = "client", ["projet"] = "projet", ["reference propale"] = "reference", ["contact client"] = "contact",
        ["agence"] = "agence", ["service line"] = "serviceLine", ["directeur agence"] = "directeur", ["responsable sl"] = "responsableSL",
        ["commercial"] = "commercial", ["type de contrat"] = "typeContrat", ["auteur :"] = "auteur", ["date :"] = "date",
    };

    /// <param name="classeur">Classeur ouvert.</param>
    /// <param name="nomFichier">Nom du fichier (sert de nom de projet si la fiche est vide).</param>
    /// <param name="aujourdhui">Date du jour (premier mois du planning si le TSP n'a pas de dates).</param>
    public static TspLu Interpreter(IClasseur classeur, string? nomFichier, DateOnly aujourdhui)
    {
        var warnings = new List<string>();
        var wl = classeur.Feuille("WORKLOAD");
        var pr = classeur.Feuille("PROFIL");
        if (wl is null || pr is null)
            throw new TspInvalideException("Ce fichier ne ressemble pas à un TSP : les onglets WORKLOAD et PROFIL sont introuvables.");
        // ancien suivi Excel (onglets TABLEAU DE BORD, GANTT…) : seule la partie TSP est reprise
        if (classeur.NomsFeuilles.Any(n => Regex.IsMatch(n.Trim(), "^(tableau de bord|gantt|ateliers & livrables)$", RegexOptions.IgnoreCase)))
            warnings.Add("Ce fichier est un ancien suivi Excel : seules les données du TSP (tâches, profils, charges, échéancier) sont reprises. Le consommé, les statuts et les dates saisis dans le suivi Excel ne le sont pas.");

        // --- FICHE PROJET ---
        var fiche = new FicheTsp();
        var fp = classeur.Feuille("FICHE PROJET");
        if (fp is not null)
        {
            for (var r = 0; r <= fp.MaxRow; r++)
            {
                foreach (var c in new[] { 1, 5 })
                {
                    var label = Str(fp.G(r, c));
                    if (label.Length == 0) continue;
                    var nl = Texte.Norm(label);
                    if (nl.StartsWith("montant", StringComparison.Ordinal) || nl.StartsWith("dont", StringComparison.Ordinal) || nl == "fiche projet") continue;
                    var brut = fp.G(r, c + 1);
                    var v = nl.StartsWith("date", StringComparison.Ordinal) ? (VersIso(brut) ?? Str(brut)) : Str(brut);
                    var key = nl.StartsWith("periode", StringComparison.Ordinal) ? "periode" : CleFiche.GetValueOrDefault(nl);
                    if (key is not null) Renseigner(fiche, key, v);
                    fiche.Champs.Add(new ChampFicheTsp { Label = Regex.Replace(label, @"\s*:\s*$", ""), Value = v, Key = key });
                }
            }
        }
        else warnings.Add("Onglet FICHE PROJET absent : informations projet non renseignées.");
        DateOnly? debut = null, fin = null;
        if (!string.IsNullOrEmpty(fiche.Periode))
        {
            var m = Regex.Match(fiche.Periode, @"(\d{1,2}/\d{1,2}/\d{4}).*?(\d{1,2}/\d{1,2}/\d{4})");
            if (m.Success) { debut = Calendrier.LireDateFr(m.Groups[1].Value); fin = Calendrier.LireDateFr(m.Groups[2].Value); }
        }
        if (debut is null || fin is null)
            warnings.Add("Période du projet absente du TSP : renseignez le début et la fin dans ⚙ Paramètres du projet › Dates du projet.");

        // --- PROFIL ---
        var hdr = -1;
        for (var r = 0; r <= pr.MaxRow; r++)
            if (Texte.Norm(Str(pr.G(r, 1))) == "profil" && Texte.Norm(Str(pr.G(r, 2))).StartsWith("entit", StringComparison.Ordinal)) { hdr = r; break; }
        if (hdr < 0) throw new TspInvalideException("Onglet PROFIL : en-tête « PROFIL » introuvable.");
        var profiles = new List<ProfilCalcul>();
        for (var r = hdr + 1; r <= pr.MaxRow; r++)
        {
            if (Texte.Norm(Str(pr.G(r, 1))) == "total") break;
            var gv = pr.G(r, 6);
            var entite = Str(pr.G(r, 2)).ToUpperInvariant();
            profiles.Add(new ProfilCalcul
            {
                Nom = Str(pr.G(r, 1)), Entite = entite.Length > 0 ? entite : "FO",
                Tjm = Num(pr.G(r, 3)), Cjm = Num(pr.G(r, 4)),
                Prcs = pr.G(r, 5) is double prcs ? VersDecimal(prcs) : null,
                Frais = gv is double fraisProfil ? VersDecimal(fraisProfil) : 0,
                Collaborateur = gv is double ? "" : Str(gv),
            });
        }
        // Remise et CA initial : cellules à droite de leur libellé, vides si non saisies dans le TSP
        decimal remise = 0;
        var remiseSaisie = false;
        decimal? caInitial = null;
        for (var r = 0; r <= pr.MaxRow; r++)
            for (var c = 0; c <= pr.MaxCol; c++)
            {
                var l = Texte.Norm(Str(pr.G(r, c)));
                var v = pr.G(r, c + 1);
                var rempli = v is not null && !(v is string sv && sv.Length == 0);
                if (l.StartsWith("remise", StringComparison.Ordinal))
                {
                    remise = Num(v);
                    if (remise > 1) remise /= 100;
                    remiseSaisie = rempli;
                }
                else if (l.StartsWith("ca initial", StringComparison.Ordinal) && rempli) caInitial = Num(v);
            }
        var grille = new List<LigneGrilleTsp>();
        var gh = ChercherLigne(pr, 1, s => s == "profils");
        if (gh >= 0)
            for (var r = gh + 1; r <= pr.MaxRow; r++)
            {
                var n = Str(pr.G(r, 1));
                if (n.Length == 0) break;
                grille.Add(new LigneGrilleTsp { Profil = n, TjmParis = Num(pr.G(r, 3)), CjmParis = Num(pr.G(r, 4)), TjmRegion = Num(pr.G(r, 5)), CjmRegion = Num(pr.G(r, 6)) });
            }

        // --- WORKLOAD : colonnes détectées dynamiquement ---
        var hr = ChercherLigne(wl, 0, s => s == "id", 0, 15);
        if (hr < 0) throw new TspInvalideException("Onglet WORKLOAD : ligne d'en-tête (colonne « ID ») introuvable.");
        string H(int c) => Texte.Norm(Str(wl.G(hr, c)));
        int Colonne(Func<string, bool> test, int depuis = 0)
        {
            for (var c = depuis; c <= wl.MaxCol; c++) if (test(H(c))) return c;
            return -1;
        }
        int cLot = Colonne(s => s == "lot"), cPhase = Colonne(s => s == "phase"), cEtape = Colonne(s => s == "etape"), cTache = Colonne(s => s == "tache");
        var cCharge = Colonne(s => s.StartsWith("total charge", StringComparison.Ordinal));
        var cValo = Colonne(s => s.StartsWith("total", StringComparison.Ordinal) && s.Contains("valorisation", StringComparison.Ordinal));
        if (cTache < 0 || cCharge < 0) throw new TspInvalideException("Onglet WORKLOAD : colonnes « Tâche » ou « TOTAL Charge » introuvables.");
        var pStart = (cValo >= 0 ? cValo : cCharge) + 1; // colonne H dans le modèle actuel
        var pEnd = pStart;
        while (pEnd <= wl.MaxCol)
        {
            var dessus = Texte.Norm(Str(wl.G(hr - 1, pEnd)));
            var h = H(pEnd);
            if (pEnd > pStart && (dessus.Contains("cout par profil", StringComparison.Ordinal) || (h.Length > 0 && h == H(pStart)))) break;
            if (h.StartsWith("livrable", StringComparison.Ordinal) || h.StartsWith("hypoth", StringComparison.Ordinal)) break;
            pEnd++;
        }
        var nbColonnesProfil = pEnd - pStart;
        var cLivrable = Colonne(s => s.StartsWith("livrable", StringComparison.Ordinal), pEnd);
        var cHyp = Colonne(s => s.StartsWith("hypoth", StringComparison.Ordinal) || s.StartsWith("commentaire", StringComparison.Ordinal), pEnd);
        // aligne la liste des profils sur les colonnes du WORKLOAD
        while (profiles.Count < nbColonnesProfil)
            profiles.Add(new ProfilCalcul { Nom = Str(wl.G(hr, pStart + profiles.Count)), Entite = "FO" });
        if (profiles.Count > nbColonnesProfil) profiles.RemoveRange(nbColonnesProfil, profiles.Count - nbColonnesProfil);
        for (var i = 0; i < profiles.Count; i++)
        {
            var h = Str(wl.G(hr, pStart + i));
            if (profiles[i].Nom.Length == 0 && h.Length > 0 && h != "0") profiles[i].Nom = h;
        }

        decimal? pctPilotage = null, pctProvision = null;
        for (var c = 0; c <= wl.MaxCol; c++)
        {
            var s = Texte.Norm(Str(wl.G(0, c)));
            if (s.Contains("pilotage", StringComparison.Ordinal)) pctPilotage = Num(wl.G(0, c + 1));
            if (s.Contains("provision", StringComparison.Ordinal)) pctProvision = Num(wl.G(0, c + 1));
        }

        var tasks = new List<TacheCalcul>();
        for (var r = hr + 1; r <= wl.MaxRow; r++)
        {
            var label = Str(wl.G(r, cTache));
            if (label.Length == 0) continue;
            var charges = new List<decimal>();
            for (var i = 0; i < nbColonnesProfil; i++) charges.Add(Num(wl.G(r, pStart + i)));
            tasks.Add(new TacheCalcul
            {
                Uid = "r" + (r + 1), Ligne = r + 1,
                Id = Str(wl.G(r, 0)), Lot = Str(wl.G(r, cLot)),
                Phase = Str(wl.G(r, cPhase)).ToUpperInvariant(), Etape = Str(wl.G(r, cEtape)), Label = label,
                Charges = charges, Section = charges.Sum() == 0,
                Livrable = cLivrable >= 0 ? Texte.Norm(Str(wl.G(r, cLivrable))) : "",
                Hypothese = cHyp >= 0 ? Str(wl.G(r, cHyp)) : "",
            });
        }
        if (tasks.Count == 0) throw new TspInvalideException("Onglet WORKLOAD : aucune tâche trouvée.");
        // colonne « Livrable » du WORKLOAD renseignée (au moins un « oui ») : c'est elle qui dit ce qu'est un livrable, plus le titre.
        // Le repère est gardé sur chaque tâche : un projet lancé avant cette règle (sans repère) garde la détection par le titre.
        if (cLivrable >= 0 && tasks.Any(t => !t.Section && t.Livrable == "oui")) foreach (var t in tasks) t.LivCol = true;
        var sansId = tasks.Where(t => !t.Section && t.Id.Length == 0).ToList();
        if (sansId.Count > 0)
            warnings.Add($"{sansId.Count} tâche(s) sans axe dans le TSP ({NombreJs(Texte.Arrondir(sansId.Sum(t => t.Charges.Sum())))} JH) : affectez-leur un axe depuis Workload › Liste des tâches (filtre « Sans axe »).");

        // --- FRAIS ---
        var frais = new List<FraisBudgetCalcul>();
        var fr = classeur.Feuille("FRAIS");
        if (fr is not null)
        {
            var h = ChercherLigne(fr, 0, s => s.StartsWith("libelle", StringComparison.Ordinal));
            if (h >= 0)
                for (var r = h + 1; r <= fr.MaxRow; r++)
                {
                    if (Texte.Norm(Str(fr.G(r, 0))) == "total") break;
                    var ligne = new FraisBudgetCalcul { Libelle = Str(fr.G(r, 0)), Cu = Num(fr.G(r, 1)), Qte = Num(fr.G(r, 2)), Refacture = Num(fr.G(r, 4)), Commentaire = Str(fr.G(r, 5)) };
                    if (ligne.Libelle.Length > 0 || ligne.Cu != 0 || ligne.Qte != 0 || ligne.Refacture != 0) frais.Add(ligne);
                }
        }
        // --- ACHAT ---
        var achats = new List<AchatBudgetCalcul>();
        var prestas = new List<PrestataireCalcul>();
        var ac = classeur.Feuille("ACHAT");
        if (ac is not null)
        {
            var h1 = ChercherLigne(ac, 0, s => s.StartsWith("achat materiel", StringComparison.Ordinal));
            if (h1 >= 0)
                for (var r = h1 + 1; r <= ac.MaxRow; r++)
                {
                    if (Texte.Norm(Str(ac.G(r, 0))) == "total") break;
                    var ligne = new AchatBudgetCalcul { Designation = Str(ac.G(r, 0)), Type = Str(ac.G(r, 1)), Cu = Num(ac.G(r, 2)), Qte = Num(ac.G(r, 3)), Revente = Num(ac.G(r, 6)), Commentaire = Str(ac.G(r, 8)) };
                    if (ligne.Designation.Length > 0 || ligne.Cu != 0 || ligne.Revente != 0) achats.Add(ligne);
                }
            var h2 = ChercherLigne(ac, 0, s => s.StartsWith("achat prestataires", StringComparison.Ordinal));
            if (h2 >= 0)
                for (var r = h2 + 1; r <= ac.MaxRow; r++)
                {
                    if (Texte.Norm(Str(ac.G(r, 0))) == "total") break;
                    var ligne = new PrestataireCalcul { Designation = Str(ac.G(r, 0)), Societe = Str(ac.G(r, 1)), CoutJour = Num(ac.G(r, 2)), Nbj = Num(ac.G(r, 3)), Tjm = Num(ac.G(r, 5)), Commentaire = Str(ac.G(r, 8)) };
                    if (ligne.Designation.Length > 0 || ligne.Societe.Length > 0 || ligne.Nbj != 0) prestas.Add(ligne);
                }
        }
        // --- ECHEANCIER ---
        var echeancier = new List<EcheanceCalcul>();
        var ec = classeur.Feuille("ECHEANCIER");
        if (ec is not null)
        {
            var h = ChercherLigne(ec, 1, s => s == "n°" || s == "no");
            if (h >= 0)
                for (var r = h + 1; r <= ec.MaxRow; r++)
                {
                    var nom = Str(ec.G(r, 2));
                    var pct = Num(ec.G(r, 3));
                    if (nom.Length == 0 && pct == 0) continue;
                    var mois = VersIso(ec.G(r, 4));
                    var n = (int)Num(ec.G(r, 1));
                    echeancier.Add(new EcheanceCalcul { N = n != 0 ? n : echeancier.Count + 1, Nom = nom, Pct = pct, Mois = mois?[..7] });
                }
        }
        // --- METRIQUE ---
        var metrique = new List<MetriqueCalcul>();
        var me = classeur.Feuille("METRIQUE");
        if (me is not null)
        {
            var h = ChercherLigne(me, 1, s => s == "etape");
            if (h >= 0)
                for (var r = h + 1; r <= me.MaxRow; r++)
                {
                    var e = Str(me.G(r, 1));
                    if (e.Length == 0) continue;
                    if (Texte.Norm(e) == "total") break;
                    metrique.Add(new MetriqueCalcul { Etape = e, Pct = Num(me.G(r, 2)) });
                }
        }
        // --- Planning de charge mensuel par profil ---
        // Priorité à l'onglet PILOTAGE CHARGES (valeurs définies avec le directeur de projet), sinon onglet PLANNING.
        // Profils rapprochés par leur nom, puis par position.
        var planningRef = new PlanningProfilsCalcul { Rows = profiles.Select(_ => new List<decimal>()).ToList() };
        string? planningSource = null;
        foreach (var nom in new[] { "PILOTAGE CHARGES", "PLANNING" })
        {
            var sh = classeur.Feuille(nom);
            var table = sh is null ? null : LirePlanning(sh, profiles);
            if (table is not null && table.Value.Mois.Count > 0)
            {
                planningRef = new PlanningProfilsCalcul { Months = table.Value.Mois, Rows = table.Value.Lignes };
                planningSource = sh!.Nom;
                break;
            }
        }
        var totalPlanning = planningRef.Rows.Sum(r => r.Sum());
        if (planningSource is not null && totalPlanning > 0)
            warnings.Add($"Planning de charge mensuel repris de l’onglet {planningSource} (consultable dans Annexes › Planning du TSP ; à replanifier dans Finances › Plan de charge › Prévisionnel).");
        else if (planningSource is not null)
            warnings.Add($"Onglet {planningSource} présent mais vide (0 JH) : la courbe « prévu » du Plan de charge restera vide.");
        else
            warnings.Add("Aucun planning de charge mensuel trouvé dans le TSP (onglet PLANNING ou PILOTAGE CHARGES) : la courbe « prévu » du Plan de charge restera vide.");
        // --- REF (listes) ---
        var refListes = new ReferentielCalcul();
        var rf = classeur.Feuille("REF");
        if (rf is not null)
        {
            var h = ChercherLigne(rf, 1, s => s == "phase");
            if (h >= 0)
                for (var r = h + 1; r <= rf.MaxRow; r++)
                {
                    var ph = Str(rf.G(r, 1));
                    if (ph.Length > 0) refListes.Phases.Add(ph.ToUpperInvariant());
                    var e = Str(rf.G(r, 3));
                    if (e.Length > 0) refListes.Etapes.Add(e);
                }
        }
        if (refListes.Phases.Count == 0) refListes.Phases.AddRange(ReferentielsMetier.PhasesParDefaut);

        // --- Planning de charge mensuel par phase (onglet PLANNING, tableau « Phases ») ---
        // Phase = liste REF ; mois saisis à la main ; CJM = valeurs saisies (non utilisées dans les calculs).
        PlanningPhasesTsp? planningPhases = null;
        foreach (var nom in new[] { "PLANNING", "PILOTAGE CHARGES" })
        {
            var sh = classeur.Feuille(nom);
            if (sh is null) continue;
            var h = ChercherLigne(sh, 1, x => x == "phases");
            if (h < 0) continue;
            var cols = new List<(int Col, string Mois)>();
            for (var c = 2; c <= sh.MaxCol; c++) if (VersIso(sh.G(h, c)) is { } d) cols.Add((c, d[..7]));
            if (cols.Count == 0)
            {
                // en-tête sans dates lisibles : on reprend celles du tableau « Profil » de la même feuille
                var hp = ChercherLigne(sh, 1, x => x == "profil");
                if (hp >= 0) for (var c = 2; c <= sh.MaxCol; c++) if (VersIso(sh.G(hp, c)) is { } d) cols.Add((c, d[..7]));
            }
            var lignes = new List<LignePlanningPhaseTsp>();
            for (var r = h + 1; r <= sh.MaxRow; r++)
            {
                var ph = Str(sh.G(r, 1));
                if (Texte.Norm(ph).StartsWith("total", StringComparison.Ordinal)) break;
                if (ph.Length == 0) continue;
                var cj = sh.G(r, 3);
                var vals = new Dictionary<string, decimal>();
                foreach (var (c, mk) in cols)
                {
                    var v = Num(sh.G(r, c));
                    if (v != 0) vals[mk] = v;
                }
                object? cjm = cj is double dcj ? VersDecimal(dcj) : Str(cj) is { Length: > 0 } scj ? scj : null;
                lignes.Add(new LignePlanningPhaseTsp { Phase = ph.ToUpperInvariant(), Cjm = cjm, Vals = vals });
            }
            if (lignes.Count > 0) { planningPhases = new PlanningPhasesTsp { Rows = lignes, Source = sh.Nom }; break; }
        }
        planningPhases ??= new PlanningPhasesTsp { Rows = refListes.Phases.Select(ph => new LignePlanningPhaseTsp { Phase = ph }).ToList() };

        // --- axes détectés + paramètres par défaut ---
        var axes = new Dictionary<string, string>();
        foreach (var t in tasks) if (t.Id.Length > 0 && !axes.ContainsKey(t.Id)) axes[t.Id] = ReferentielsMetier.NomAxeParDefaut(t.Id);
        string moisDebut;
        if (debut is not null) moisDebut = Calendrier.Mois(debut.Value);
        else
        {
            var premier = planningRef.Months.Where((_, i) => planningRef.Rows.Any(r => i < r.Count && r[i] != 0)).FirstOrDefault();
            moisDebut = premier ?? Calendrier.Mois(aujourdhui);
        }
        var moisFin = fin is not null ? Calendrier.Mois(fin.Value) : Calendrier.AjouterMois(moisDebut, 11);
        var iaIdx = profiles.FindIndex(p => Regex.IsMatch(p.Nom, @"agent\s*ia", RegexOptions.IgnoreCase));
        // Regroupement proposé : ID si la colonne A contient des « AXE… », Phase si au moins 3 phases pèsent chacune ≥ 5 % de la charge, sinon Lot
        var reelles = tasks.Where(t => !t.Section).ToList();
        var totalCharge = reelles.Sum(t => t.Charges.Sum());
        if (totalCharge == 0) totalCharge = 1;
        var poidsPhase = new Dictionary<string, decimal>();
        foreach (var t in reelles) if (t.Phase.Length > 0) poidsPhase[t.Phase] = poidsPhase.GetValueOrDefault(t.Phase) + t.Charges.Sum();
        var grandesPhases = poidsPhase.Values.Count(w => w / totalCharge >= 0.05m);
        var lots = reelles.Select(t => t.Lot).Where(l => l.Length > 0).ToHashSet();
        var groupBy = reelles.Any(t => Regex.IsMatch(t.Id, "^axe", RegexOptions.IgnoreCase)) ? "id" : grandesPhases >= 3 ? "phase" : lots.Count >= 2 ? "lot" : "id";
        // Fiche projet vide : on reprend le nom du fichier
        if (string.IsNullOrEmpty(fiche.Client) && string.IsNullOrEmpty(fiche.Projet) && !string.IsNullOrEmpty(nomFichier))
        {
            fiche.Projet = Regex.Replace(Regex.Replace(nomFichier, @"\.[^.]+$", ""), "_+", " ").Trim();
            warnings.Add("Fiche projet vide dans le TSP : le nom du fichier est utilisé comme nom de projet (modifiable dans TSP › Fiche).");
        }

        return new TspLu
        {
            Fiche = fiche, Periode = new PeriodeTsp { Start = debut, End = fin },
            Remise = remise, RemiseSaisie = remiseSaisie, CaInitial = caInitial, PctPilotage = pctPilotage, PctProvision = pctProvision,
            Profiles = profiles, Grille = grille, Tasks = tasks, PlanningPhases = planningPhases,
            Frais = frais, Achats = achats, Prestas = prestas, Echeancier = echeancier, Metrique = metrique,
            PlanningRef = planningRef, PlanningSource = planningSource, Ref = refListes, Axes = axes,
            Dates = new DatesProjetCalcul { Debut = debut, FinContrat = fin, FinPrevue = fin },
            Settings = new ParametresCalcul
            {
                StartMonth = moisDebut, NbMonths = Math.Max(13, Calendrier.MoisEntre(moisDebut, moisFin) + 4), IaProfile = iaIdx, GroupBy = groupBy,
            },
            Warnings = warnings,
        };
    }

    /// <summary>Lit un tableau « Profil | Charge par profil | CJM | Écart ? | mois… » (onglets PLANNING ou PILOTAGE CHARGES).</summary>
    private static (List<string> Mois, List<List<decimal>> Lignes)? LirePlanning(IFeuille sh, List<ProfilCalcul> profiles)
    {
        var h = -1;
        for (var r = 0; r <= Math.Min(sh.MaxRow, 40); r++) if (Texte.Norm(Str(sh.G(r, 1))) == "profil") { h = r; break; }
        if (h < 0) return null;
        var cols = new List<(int Col, string Mois)>();
        for (var c = 2; c <= sh.MaxCol; c++) if (VersIso(sh.G(h, c)) is { } d) cols.Add((c, d[..7]));
        if (cols.Count == 0) return null;
        var lignes = profiles.Select(p => cols.Select(x => 0m).ToList()).ToList();
        var utilises = new HashSet<int>();
        var pos = 0;
        for (var r = h + 1; r <= sh.MaxRow; r++)
        {
            var nom = Str(sh.G(r, 1));
            if (Texte.Norm(nom).StartsWith("total", StringComparison.Ordinal)) break;
            // deux profils de même nom (ex. deux architectes) : la 1re ligne va au 1er, la 2e au 2e
            var i = -1;
            for (var k = 0; k < profiles.Count; k++)
                if (profiles[k].Nom.Length > 0 && Texte.Norm(profiles[k].Nom) == Texte.Norm(nom) && !utilises.Contains(k)) { i = k; break; }
            if (i < 0 && (nom.Length == 0 || nom == "0") && pos < profiles.Count && profiles[pos].Nom.Length == 0) i = pos;
            if (i >= 0)
            {
                var r0 = r;
                lignes[i] = cols.Select(x => Num(sh.G(r0, x.Col))).ToList();
                utilises.Add(i);
            }
            pos++;
        }
        return (cols.Select(x => x.Mois).ToList(), lignes);
    }

    private static void Renseigner(FicheTsp fiche, string cle, string valeur)
    {
        switch (cle)
        {
            case "client": fiche.Client = valeur; break;
            case "projet": fiche.Projet = valeur; break;
            case "reference": fiche.Reference = valeur; break;
            case "contact": fiche.Contact = valeur; break;
            case "agence": fiche.Agence = valeur; break;
            case "serviceLine": fiche.ServiceLine = valeur; break;
            case "directeur": fiche.Directeur = valeur; break;
            case "responsableSL": fiche.ResponsableSL = valeur; break;
            case "commercial": fiche.Commercial = valeur; break;
            case "typeContrat": fiche.TypeContrat = valeur; break;
            case "auteur": fiche.Auteur = valeur; break;
            case "date": fiche.Date = valeur; break;
            case "periode": fiche.Periode = valeur; break;
        }
    }

    private static int ChercherLigne(IFeuille sh, int col, Func<string, bool> test, int depuis = 0, int? jusqua = null)
    {
        var fin = jusqua ?? sh.MaxRow;
        for (var r = depuis; r <= fin; r++) if (test(Texte.Norm(Str(sh.G(r, col))))) return r;
        return -1;
    }

    // ---------- conversions identiques à la version de référence ----------

    /// <summary>Texte d'une cellule (vide pour une cellule vide ou en erreur), sans espaces autour.</summary>
    public static string Str(object? v) => v switch
    {
        null or ErreurExcel => "",
        string s => s.Trim(),
        bool b => b ? "true" : "false",
        double d => NombreJs(d),
        _ => (v.ToString() ?? "").Trim(),
    };

    /// <summary>Nombre d'une cellule : 0 si vide, booléen, en erreur ou illisible ; « 12,5 » est accepté.</summary>
    public static decimal Num(object? v)
    {
        switch (v)
        {
            case null or bool or ErreurExcel: return 0;
            case double d: return double.IsFinite(d) ? VersDecimal(d) : 0;
            case string s:
                var t = Regex.Replace(s, @"\s", "");
                var virgule = t.IndexOf(',');
                if (virgule >= 0) t = t[..virgule] + "." + t[(virgule + 1)..];
                var m = Regex.Match(t, @"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?");
                return m.Success && double.TryParse(m.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) ? VersDecimal(n) : 0;
            default: return 0;
        }
    }

    /// <summary>Date d'une cellule (numéro de série Excel ou texte « JJ/MM/AAAA ») au format AAAA-MM-JJ, ou null.</summary>
    public static string? VersIso(object? v)
    {
        if (v is double d && d > 20000 && d < 80000) return Calendrier.Iso(Calendrier.DepuisSerieExcel(d));
        var date = Calendrier.LireDateFr(Str(v));
        return date is null ? null : Calendrier.Iso(date.Value);
    }

    private static decimal VersDecimal(double d) => Math.Abs(d) > 7.9e28 ? 0 : (decimal)d;

    /// <summary>Écriture d'un nombre comme en JavaScript (point décimal, pas de zéros inutiles).</summary>
    private static string NombreJs(double d) => d.ToString(CultureInfo.InvariantCulture);

    private static string NombreJs(decimal d) => d.ToString("0.##########", CultureInfo.InvariantCulture);
}
