using PilotageForfaits.Domain.Commun;
using static PilotageForfaits.Domain.Commun.ReferentielsMetier;

namespace PilotageForfaits.Domain.Calcul;

/// <summary>
/// Moteur de calcul : recalcule TOUS les indicateurs d'un projet à partir de ses saisies.
/// C'est la traduction fidèle de la fonction « compute » de la version de référence (version HTML du 18/10/2026,
/// copiée dans outils/reference-poc/poc/core.js).
/// Fonction pure : mêmes données + même date du jour = mêmes résultats. Aucun accès à la base.
/// Toute modification doit garder les tests de référence au vert (tests/PilotageForfaits.Domain.Tests).
/// </summary>
public static class MoteurCalcul
{
    private const decimal Epsilon = 0.000000001m;

    /// <summary>Calcule les indicateurs du projet à la date du jour indiquée.</summary>
    public static ResultatCalcul Calculer(ProjetCalcul p, DateOnly aujourdhui)
    {
        var s = p.Settings;
        var remise = p.Remise;

        // ---- profils : un profil = une personne ----
        // Deux profils de même intitulé (ex. deux architectes) restent distincts : on les différencie par le collaborateur, à défaut par un numéro.
        var nomCount = new Dictionary<string, int>();
        foreach (var pr in p.Profiles) if (!string.IsNullOrEmpty(pr.Nom)) nomCount[pr.Nom] = nomCount.GetValueOrDefault(pr.Nom) + 1;
        var vus = new Dictionary<string, int>();
        var P = new List<ProfilPersonne>();
        for (var i = 0; i < p.Profiles.Count; i++)
        {
            var pr = p.Profiles[i];
            var nom = pr.Nom;
            if (!string.IsNullOrEmpty(nom) && nomCount[nom] > 1)
            {
                vus[nom] = vus.GetValueOrDefault(nom) + 1;
                nom = !string.IsNullOrEmpty(pr.Collaborateur) ? $"{pr.Nom} — {pr.Collaborateur}" : $"{pr.Nom} {vus[pr.Nom]}";
            }
            P.Add(new ProfilPersonne
            {
                I = i, Nom = nom, NomBase = pr.Nom, Entite = pr.Entite, Tjm = pr.Tjm, TjmR = pr.Tjm * (1 - remise), Cjm = pr.Cjm,
                Prcs = pr.Prcs, Frais = pr.Frais, Collaborateur = pr.Collaborateur, EstAjout = pr.Ajout is not null,
            });
        }
        var nP = P.Count;
        decimal Cjm(int i) => i >= 0 && i < nP ? P[i].Cjm : 0;
        decimal TjmR(int i) => i >= 0 && i < nP ? P[i].TjmR : 0;

        // ---- dates du projet : début, fin contractuelle (TSP, fixe) et fin prévue (peut glisser) ----
        var D = p.Dates;
        var finRef = D.FinPrevue ?? D.FinContrat;
        var moisDebut = D.Debut is { } deb ? Calendrier.Mois(deb) : s.StartMonth ?? Calendrier.Mois(aujourdhui);
        string moisFin;
        if (finRef is not null)
        {
            moisFin = new[] { D.FinPrevue, D.FinContrat }.Where(x => x is not null).Select(x => Calendrier.Mois(x!.Value)).OrderBy(x => x, StringComparer.Ordinal).Last();
        }
        else moisFin = Calendrier.AjouterMois(s.StartMonth ?? moisDebut, (s.NbMonths == 0 ? 1 : s.NbMonths) - 1);

        // mois contenant des données hors période : on les garde visibles pour ne rien perdre
        var moisAvecDonnees = new HashSet<string>();
        foreach (var t in p.Tasks)
        {
            if (!p.Track.TryGetValue(t.Uid, out var tr0)) continue;
            foreach (var o in (tr0.ConsoP ?? new()).Values)
                foreach (var (d, v) in o) if (v != 0) moisAvecDonnees.Add(d[..7]);
            if (tr0.Debut is { } d0) moisAvecDonnees.Add(Calendrier.Mois(d0));
            if (tr0.Fin is { } d1) moisAvecDonnees.Add(Calendrier.Mois(d1));
        }
        for (var k = 0; k < p.PlanningRef.Months.Count; k++)
            if (p.PlanningRef.Rows.Any(r => k < r.Count && r[k] != 0)) moisAvecDonnees.Add(p.PlanningRef.Months[k]);
        if (p.PlanningTsp is { } tsp0)
            for (var k = 0; k < tsp0.Months.Count; k++)
                if (tsp0.Rows.Any(r => k < r.Count && r[k] != 0)) moisAvecDonnees.Add(tsp0.Months[k]);
        foreach (var r in p.PlanningPhases?.Rows ?? new())
            foreach (var (mk, v) in r.Vals) if (v != 0) moisAvecDonnees.Add(mk);
        var tousMois = new List<string> { moisDebut, moisFin };
        tousMois.AddRange(moisAvecDonnees);
        tousMois.Sort(StringComparer.Ordinal);
        var months = new List<string>();
        for (var mk = tousMois[0]; string.CompareOrdinal(mk, tousMois[^1]) <= 0; mk = Calendrier.AjouterMois(mk, 1)) months.Add(mk);
        bool DansProjet(string mk) => string.CompareOrdinal(mk, moisDebut) >= 0 && string.CompareOrdinal(mk, moisFin) <= 0;
        var horsProjetMois = months.Where(mk => !DansProjet(mk) && moisAvecDonnees.Contains(mk)).ToList();
        var indexMois = new Dictionary<string, int>();
        for (var k = 0; k < months.Count; k++) indexMois[months[k]] = k;
        var iaIdx = s.IaProfile;

        // ---- tâches ----
        var types = p.Types ?? TypesSocle.Select(x => new TypeTacheCalcul { Id = x.Id, Nom = x.Nom, Socle = true }).ToList();
        var typeIds = types.Select(x => x.Id).ToHashSet();
        var tasks = new List<TacheCalculee>();
        var suivis = new Dictionary<string, SuiviTacheCalcul>();
        foreach (var t in p.Tasks)
        {
            if (t.Section) continue;
            var tr = p.Track.TryGetValue(t.Uid, out var trouve) ? trouve : new SuiviTacheCalcul();
            suivis[t.Uid] = tr;
            // Charge vendue (TSP) + charge ajoutée en cours de projet (non facturée : elle ne change pas le CA)
            var chargesV = Enumerable.Range(0, nP).Select(i => i < t.Charges.Count ? t.Charges[i] : 0m).ToList();
            var chargesA = Enumerable.Range(0, nP).Select(i => tr.ChargeAjout?.GetValueOrDefault(i) ?? 0m).ToList();
            // Réaffectation : une partie de la charge d'un profil est confiée à un autre (même total, coût au CJM de la personne qui fait le travail)
            var reaff = (tr.Reaff ?? new List<ReaffectationCalcul>())
                .Where(r => r is not null && r.Jh > 0 && r.De != r.Vers && r.De >= 0 && r.De < nP && r.Vers >= 0 && r.Vers < nP).ToList();
            var chargesR = Enumerable.Repeat(0m, nP).ToList();
            foreach (var r in reaff) { chargesR[r.De] -= r.Jh; chargesR[r.Vers] += r.Jh; }
            var chargesPrev = chargesV.Select((v, i) => v + chargesA[i] + chargesR[i]).ToList();
            var coutReaff = chargesR.Select((c, i) => c * Cjm(i)).Sum();
            var chargeTSP = chargesV.Sum();
            var chargeAjout = chargesA.Sum();
            // consommé saisi par profil : consoP[indexProfil][date] = jours
            var cp = tr.ConsoP ?? new Dictionary<int, Dictionary<string, decimal>>();
            var consoP = Enumerable.Range(0, nP).Select(i => cp.TryGetValue(i, out var o) ? o.Values.Sum() : 0m).ToList();
            // Tâche annulée : seul le consommé (réellement travaillé) reste dans la charge ; le reste est annulé.
            var annul = tr.Annul;
            var chargesAnnul = annul is not null ? chargesPrev.Select((c, i) => Math.Max(c - consoP[i], 0)).ToList() : Enumerable.Repeat(0m, nP).ToList();
            var charges = annul is not null ? consoP.ToList() : chargesPrev;
            var charge = charges.Sum();
            var chargeInit = chargesPrev.Sum();
            var chargeAnnulee = chargesAnnul.Sum();
            var valo = chargesV.Select((c, i) => c * TjmR(i)).Sum();
            var coutPrevu = charges.Select((c, i) => c * Cjm(i)).Sum();
            var coutPrevuTSP = chargesV.Select((c, i) => c * Cjm(i)).Sum();
            var coutAjout = chargesA.Select((c, i) => c * Cjm(i)).Sum();
            var coutAnnule = chargesAnnul.Select((c, i) => c * Cjm(i)).Sum();
            // avenant de réduction : le CA baisse de la part vendue non réalisée
            var caAvenant = annul?.Avenant == true ? chargesAnnul.Select((c, i) => Math.Min(c, chargesV[i]) * TjmR(i)).Sum() : 0m;
            var cjmMoyen = charge != 0 ? coutPrevu / charge : 0;
            var tjmMoyen = charge != 0 ? valo / charge : 0;
            var dayTot = new Dictionary<string, decimal>();
            foreach (var o in cp.Values)
                foreach (var (d, v) in o) if (v > 0) dayTot[d] = dayTot.GetValueOrDefault(d) + v;
            var dates = dayTot.Keys.OrderBy(x => x, StringComparer.Ordinal).Select(Calendrier.LireIso).ToList();
            var consoTotal = consoP.Sum();
            // Statut : celui choisi par le chef de projet ; à défaut, « En cours » dès qu'il y a du consommé
            var statut = annul is not null ? StatutAnnulee
                : !string.IsNullOrEmpty(tr.Statut) ? AliasStatut.GetValueOrDefault(tr.Statut, tr.Statut)
                : consoTotal > 0 ? StatutEnCours : StatutAFaire;
            // Enveloppe IA : la charge Agent IA est adossée aux profils humains de la tâche ; c'est une réserve qu'on ne veut pas toucher.
            // IA consommée = max(consommé total de la tâche − charge des autres profils ; 0) (règle validée).
            var ia = annul is null && iaIdx >= 0 && iaIdx < nP ? charges[iaIdx] : 0m;
            var iaHum = Math.Max(0, charge - ia);
            var iaConso = ia > 0 ? Math.Max(0, consoTotal - iaHum) : 0m;
            // Reste par profil : nul quand la tâche est terminée. Profil Agent IA : reste = enveloppe − IA déjà consommée.
            var restP = statut == StatutValide || annul is not null
                ? Enumerable.Repeat(0m, nP).ToList()
                : charges.Select((c, i) => ia > 0 && i == iaIdx ? Math.Max(ia - iaConso, 0) : Math.Max(c - consoP[i], 0)).ToList();
            var restSum = restP.Sum();
            var restHum = restSum - (ia > 0 ? restP[iaIdx] : 0);
            var cjmReste = restSum != 0 ? restP.Select((r, i) => r * Cjm(i)).Sum() / restSum : cjmMoyen;
            decimal? iaRev = tr.IaRev;
            decimal? iaGain = iaRev is null ? null : Math.Max(0, ia - iaRev.Value);
            var fini = statut == StatutValide || statut == StatutAnnulee;
            // RAF automatique calculé profil par profil : un profil en dépassement ne compense pas un profil qui n'a pas travaillé
            var rafAuto = fini ? 0 : Math.Max(restSum, 0);
            // Une tâche validée ou annulée est terminée : son reste à faire est toujours 0, même si un RAF avait été saisi.
            decimal? rafSaisi = fini ? null : tr.Raf;
            var raf = rafSaisi ?? rafAuto;
            var atterrissage = consoTotal + raf;
            // Résultat IA = enveloppe − IA consommée (constaté à la validation ; avant : projection à l'atterrissage).
            decimal? iaRes = ia > 0 ? (fini ? ia - iaConso : ia - Math.Max(0, atterrissage - iaHum)) : null;
            string? iaStatut = !(ia > 0) ? null
                : annul is not null ? "annulee"
                : fini ? (iaRes > Epsilon ? (iaConso < Epsilon ? "totale" : "partielle") : iaRes < -Epsilon ? "depassement" : "conforme")
                : consoTotal > 0 ? "encours" : "avenir";
            var iaAJustifier = statut == StatutValide && ia > 0 && iaStatut != "conforme" && string.IsNullOrWhiteSpace(tr.IaJustif);
            var av = annul is not null ? 1m : tr.Avancement ?? 0m;
            // Budget épuisé mais tâche non terminée : le RAF automatique (0) serait faux → à réestimer par le chef de projet.
            var rafAReestimer = !fini && rafSaisi is null && charge > 0 && consoTotal > 0 && (ia > 0 && iaHum > 0 ? restHum : rafAuto) <= Epsilon;
            // RAF suggéré par le rythme observé : consommé × (1 − avancement) / avancement
            decimal? rafSuggere = !fini && av > 0 && av < 1 && consoTotal > 0 ? consoTotal * (1 - av) / av : null;
            var rafIncoherent = rafSuggere is not null && !rafAReestimer && Math.Abs(rafSuggere.Value - raf) > Math.Max(0.5m, 0.2m * charge);
            // profil principal : le plus chargé, hors Agent IA ; tâche annulée : sur sa charge d'origine
            var chP = annul is not null ? chargesPrev : charges;
            var maxI = -1;
            for (var i = 0; i < chP.Count; i++) if (i != iaIdx && chP[i] > 0 && (maxI < 0 || chP[i] > chP[maxI])) maxI = i;
            if (maxI < 0) maxI = chP.FindIndex(c => c > 0);
            var debut = tr.Debut ?? (dates.Count > 0 ? dates[0] : (DateOnly?)null);
            var fin = tr.Fin ?? (dates.Count > 0 ? dates[^1] : (DateOnly?)null);
            var type = tr.Type ?? DetecterType(t.Label, t.Livrable, t.LivCol);
            if (!typeIds.Contains(type)) type = "";
            tasks.Add(new TacheCalculee
            {
                Uid = t.Uid, Ligne = t.Ligne, Id = t.Id, Etape = t.Etape, Hypothese = t.Hypothese,
                Label = Ou(tr.Label, t.Label), LabelTSP = t.Label, Axe = Ou(tr.Axe, t.Id), Phase = Ou(tr.Phase, t.Phase), Lot = tr.Lot ?? t.Lot,
                Charge = charge, Charges = charges, ChargesV = chargesV, ChargesA = chargesA, ChargeTSP = chargeTSP, ChargeAjout = chargeAjout,
                EstAjout = t.Ajout is not null, Annulee = annul is not null, Annul = annul, ChargeInit = chargeInit, ChargesAnnul = chargesAnnul,
                ChargeAnnulee = chargeAnnulee, CoutAnnule = coutAnnule, CaAvenant = caAvenant,
                Valo = valo, CoutPrevu = coutPrevu, CoutPrevuTSP = coutPrevuTSP, CoutAjout = coutAjout, CjmMoyen = cjmMoyen, TjmMoyen = tjmMoyen,
                ChargesR = chargesR, Reaff = reaff, CoutReaff = coutReaff,
                ConsoTotal = consoTotal, ConsoP = consoP, RestP = restP, Statut = statut, Avancement = av,
                RafAuto = rafAuto, RafSaisi = rafSaisi, Raf = raf, Atterrissage = atterrissage, Ecart = atterrissage - charge,
                RafAReestimer = rafAReestimer, RafSuggere = rafSuggere, RafIncoherent = rafIncoherent,
                CoutConso = consoP.Select((v, i) => v * Cjm(i)).Sum(), CoutRaf = raf * cjmReste,
                Debut = debut, Fin = fin, DebutAuto = tr.Debut is null && dates.Count > 0, FinAuto = tr.Fin is null && dates.Count > 0,
                DebutPrevu = tr.Debut, FinPrevue = tr.Fin,
                Type = type, TypeManuel = tr.Type is not null, Responsable = maxI >= 0 && maxI < nP ? P[maxI].Nom : "",
                Ia = ia, IaRev = iaRev, IaGain = iaGain, IaHum = iaHum, IaConso = iaConso, IaRes = iaRes, IaStatut = iaStatut, IaAJustifier = iaAJustifier,
                IaType = tr.IaType ?? "", IaJustif = tr.IaJustif ?? "", Commentaire = tr.Commentaire ?? "", ConsoDates = dates,
                RealiseLe = statut == StatutValide ? (dates.Count > 0 ? dates[^1] : tr.ValideLe) : null,
            });
        }

        // ---- PROFIL (onglet Profil = TSP vendu) ----
        var profils = P.Select(pr =>
        {
            var i = pr.I;
            var I = tasks.Sum(t => t.ChargesV[i]);
            var ajoutJH = tasks.Sum(t => t.ChargesA[i]);
            var J = I * pr.TjmR;
            var K = pr.Cjm * I;
            // comme Excel (SI(C6="CESSION";…)) : l'entité se compare sans tenir compte des majuscules ni des espaces
            var entite = EntiteNormalisee(pr.Entite);
            decimal? H = entite switch
            {
                "CESSION" => (pr.Tjm - pr.Cjm) / 2 + pr.Cjm + (I != 0 ? pr.Frais / 2 / I : 0),
                "ACHAT" => pr.Cjm,
                "BO" or "ACHAT BO" => (pr.Prcs ?? PrcsDefaut) + (I != 0 ? pr.Frais / I : 0),
                _ => null,
            };
            var L = entite == "FO" ? pr.Cjm * I : (H ?? 0) * I;
            return new ProfilCalcule
            {
                I = i, Nom = pr.Nom, Entite = pr.Entite, Tjm = pr.Tjm, Cjm = pr.Cjm,
                Charge = I, Ca = J, CoutEN = K, CoutAgence = L, Tci = H,
                MargeEN = J != 0 ? (J - K) / J : null, MargeAgence = J != 0 ? (J - L) / J : null,
                AjoutJH = ajoutJH, AjoutCout = ajoutJH * pr.Cjm,
            };
        }).ToList();
        var totJ = profils.Sum(x => x.Charge);
        var totCA = profils.Sum(x => x.Ca);
        foreach (var x in profils)
        {
            x.PctJH = totJ != 0 ? x.Charge / totJ : null;
            x.PctCA = totCA != 0 ? x.Ca / totCA : null;
        }
        var totCout = profils.Sum(x => x.CoutEN);
        var totCoutAg = profils.Sum(x => x.CoutAgence);

        // ---- SYNTHÈSE DE LA VENTE ----
        var fraisDep = p.Frais.Sum(f => f.Cu * f.Qte);
        var fraisRef = p.Frais.Sum(f => f.Refacture);
        var achatsMt = p.Achats.Sum(a => a.Cu * a.Qte);
        var achatsRef = p.Achats.Sum(a => a.Revente);
        // SOMME.SI(phase ; "PROVISION" ; …) : sans tenir compte des majuscules
        var provision = tasks.Where(t => string.Equals(t.Phase.Trim(), "PROVISION", StringComparison.OrdinalIgnoreCase)).ToList();
        var provJH = provision.Sum(t => t.ChargeTSP);
        var provEur = provision.Sum(t => t.Valo);
        var margeAchats = achatsRef - achatsMt;
        var margeNette = totCA - totCout + margeAchats + fraisRef - fraisDep;
        var montantProjet = totCA + achatsRef + fraisRef;
        // ---- par entité (onglet SYNTHESE, lignes 33 à 69) : mêmes règles que les formules du TSP ----
        // jours, CA : vides s'ils sont nuls ; TJM = CA ÷ jours ; CJM, marges, taux de cession, coût d'achat : vides si le CA est nul
        LigneEntite ParEntiteDe(string nom, IReadOnlyCollection<string> codes)
        {
            var L = profils.Where(x => codes.Contains(EntiteNormalisee(x.Entite))).ToList();
            decimal j = L.Sum(x => x.Charge), ca = L.Sum(x => x.Ca), k = L.Sum(x => x.CoutEN), ag = L.Sum(x => x.CoutAgence);
            var avecCa = ca != 0 && j != 0;
            return new LigneEntite
            {
                Entite = nom, Jours = j, Ca = ca, Tjm = avecCa ? ca / j : null, Cjm = avecCa ? k / j : null, CoutAgenceJour = avecCa ? ag / j : null,
                MargeEN = ca != 0 ? (ca - k) / ca : null, MargeAgence = ca != 0 ? (ca - ag) / ca : null,
            };
        }
        var entites = ReferentielsMetier.Entites.Select(e => ParEntiteDe(e, [e])).ToList();
        var parEntite = entites.Where(x => x.Jours != 0).ToList();
        // TOTAL BO = BO + ACHAT BO ; PRCS moyen du BACK = coût agence ÷ jours ; marge FRONT / BACK = (TJM − PRCS moyen) ÷ TJM
        var totalBo = ParEntiteDe("TOTAL BO", ["BO", "ACHAT BO"]);
        var prcsBack = totalBo.Jours != 0 ? profils.Where(x => EntiteNormalisee(x.Entite) is "BO" or "ACHAT BO").Sum(x => x.CoutAgence) / totalBo.Jours : (decimal?)null;
        decimal? margeFrontBack = totalBo.Tjm is { } tjmBo && tjmBo != 0 && prcsBack is { } prcs ? (tjmBo - prcs) / tjmBo : null;
        List<LignePivot> Pivot(Func<TacheCalculee, string> cle)
        {
            var lignes = new List<LignePivot>();
            foreach (var t in tasks)
            {
                if (t.ChargeTSP == 0) continue;
                var k = Ou(cle(t), "Non renseignée");
                // comme un tableau croisé Excel : « PROVISION » et « Provision » sont la même ligne
                var o = lignes.Find(x => string.Equals(x.Cle.Trim(), k.Trim(), StringComparison.OrdinalIgnoreCase));
                if (o is null) { o = new LignePivot { Cle = k }; lignes.Add(o); }
                o.Charge += t.ChargeTSP;
                o.Valo += t.Valo;
            }
            return lignes;
        }
        var synthese = new SyntheseVente
        {
            MontantProjet = montantProjet, Jours = totJ, Ca = totCA, Cout = totCout, CoutAgence = totCoutAg,
            CjmProd = totJ != 0 ? totCout / totJ : null, TjmClient = totJ != 0 ? totCA / totJ : null,
            MargeAgence = totCA != 0 ? (totCA - totCoutAg) / totCA : null, MargeEN = totCA != 0 ? (totCA - totCout) / totCA : null,
            FraisDep = fraisDep, FraisRef = fraisRef, FraisNonRefJour = totJ != 0 ? (fraisDep - fraisRef) / totJ : null,
            ProvJH = provJH, ProvEur = provEur, ProvPct = totCA != 0 ? provEur / totCA : null,
            // SI(achats <> 0 ; (revente − achats) ÷ revente ; "") : rien sans achat, ni sans revente
            AchatsMt = achatsMt, AchatsRef = achatsRef, MargeAchats = margeAchats, MargeAchatsPct = achatsMt != 0 && achatsRef != 0 ? margeAchats / achatsRef : null,
            MargeNette = margeNette, MargeNettePct = montantProjet != 0 ? margeNette / montantProjet : null,
            ParEntite = parEntite, ParPhase = Pivot(t => t.Phase), ParEtape = Pivot(t => t.Etape),
            Entites = entites, TotalBo = totalBo, PrcsMoyenBack = prcsBack, MargeFrontBack = margeFrontBack,
            // lignes du WORKLOAD vendu, pour les tableaux croisés filtrés par lot (filtre « Lot » de l'onglet SYNTHESE)
            Lignes = tasks.Where(t => t.ChargeTSP != 0)
                .Select(t => new LigneVente { Lot = t.Lot, Phase = t.Phase, Etape = t.Etape, Charge = t.ChargeTSP, Valo = t.Valo }).ToList(),
        };

        // ---- VENTILATION ----
        var phasesVentil = Distinct(p.Ref.Phases.Concat(tasks.Select(t => t.Phase).Where(x => !string.IsNullOrEmpty(x))));
        // étapes : comparées sans tenir compte des accents, de la casse ni du type d'apostrophe
        var etapes = new List<string>();
        foreach (var e in p.Ref.Etapes.Concat(tasks.Select(t => t.Etape).Where(x => !string.IsNullOrEmpty(x))))
            if (!etapes.Any(x => Texte.Norm(x) == Texte.Norm(e))) etapes.Add(e);
        List<LigneVentilation> Grille(List<string> cles, bool parEtape) => cles.Select(k =>
        {
            var liste = tasks.Where(t => parEtape ? Texte.Norm(t.Etape) == Texte.Norm(k) : t.Phase == k).ToList();
            var v = Enumerable.Range(0, nP).Select(i => liste.Sum(t => t.ChargesV[i])).ToList();
            return new LigneVentilation { Cle = k, ParProfil = v, Total = v.Sum() };
        }).ToList();
        var sansEtape = tasks.Where(t => string.IsNullOrEmpty(t.Etape)).ToList();
        var ventilation = new VentilationVente
        {
            ParPhase = Grille(phasesVentil, false), ParEtape = Grille(etapes, true),
            TotalProfil = profils.Select(x => x.Charge).ToList(), MontantProfil = profils.Select(x => x.Ca).ToList(),
            SansEtape = sansEtape.Sum(t => t.ChargeTSP),
            SansEtapeParProfil = Enumerable.Range(0, nP).Select(i => sansEtape.Sum(t => t.ChargesV[i])).ToList(),
        };

        // ---- MÉTRIQUE ----
        decimal ChargeEtape(string e) => tasks.Where(t => Texte.Norm(t.Etape) == Texte.Norm(e)).Sum(t => t.ChargeTSP);
        var baseM = p.Metrique.FirstOrDefault(m => Texte.Norm(m.Etape).StartsWith("developpement", StringComparison.Ordinal));
        var baseMetrique = baseM is not null ? ChargeEtape(baseM.Etape) : 0;
        var metrique = p.Metrique.Select(m =>
        {
            var propale = ChargeEtape(m.Etape);
            decimal? pctProjet = baseMetrique != 0 ? propale / baseMetrique : null;
            return new MetriqueCalculee { Etape = m.Etape, Pct = m.Pct, Theorique = baseMetrique * m.Pct, Propale = propale, PctProjet = pctProjet, Ecart = pctProjet - m.Pct };
        }).ToList();

        // ---- AXES (ou lots, ou phases) ----
        var axeIds = new List<string>();
        foreach (var t in p.Tasks)
        {
            var a = t.Section ? t.Id : Ou(p.Track.TryGetValue(t.Uid, out var trA) ? trA.Axe : null, t.Id);
            if (!string.IsNullOrEmpty(a) && !axeIds.Contains(a)) axeIds.Add(a);
        }
        foreach (var a in p.Axes.Keys) if (!axeIds.Contains(a)) axeIds.Add(a);
        string NomAxe(string id) => string.IsNullOrEmpty(id) ? "Sans axe" : p.Axes.TryGetValue(id, out var n) && !string.IsNullOrEmpty(n) ? n : NomAxeParDefaut(id);
        bool Planifiee(TacheCalculee t) => t.Type == TypeLivrable ? t.FinPrevue is not null : t.DebutPrevu is not null && t.FinPrevue is not null;

        StatistiquesTaches Statistiques(List<TacheCalculee> liste)
        {
            var prevu = liste.Sum(t => t.Charge);
            var conso = liste.Sum(t => t.ConsoTotal);
            var raf = liste.Sum(t => t.Raf);
            var coutConso = liste.Sum(t => t.CoutConso);
            var coutRaf = liste.Sum(t => t.CoutRaf);
            var pd = liste.Where(t => t.DebutPrevu is not null).Select(t => t.DebutPrevu!.Value).OrderBy(x => x).ToList();
            var pf = liste.Where(t => t.FinPrevue is not null).Select(t => t.FinPrevue!.Value).OrderBy(x => x).ToList();
            var rd = liste.Where(t => t.ConsoDates.Count > 0).Select(t => t.ConsoDates[0]).OrderBy(x => x).ToList();
            var rf = liste.Where(t => t.ConsoDates.Count > 0).Select(t => t.ConsoDates[^1]).OrderBy(x => x).ToList();
            // Statut d'un groupe : Bloqué > En recette > Validé (toutes validées) > En cours (au moins une tâche démarrée) > À faire
            var demarre = liste.Any(t => (t.Statut != StatutAFaire && t.Statut != StatutAnnulee) || t.ConsoTotal > 0);
            var st = liste.Any(t => t.Statut == StatutBloque) ? StatutBloque
                : liste.Any(t => t.Statut == StatutEnRecette) ? StatutEnRecette
                : liste.Count > 0 && liste.All(t => t.Statut == StatutValide || t.Statut == StatutAnnulee) && liste.Any(t => t.Statut == StatutValide) ? StatutValide
                : demarre ? StatutEnCours : StatutAFaire;
            DateOnly? PremiereDe(params DateOnly?[] xs) => xs.Where(x => x is not null).OrderBy(x => x).FirstOrDefault();
            DateOnly? DerniereDe(params DateOnly?[] xs) => xs.Where(x => x is not null).OrderBy(x => x).LastOrDefault();
            DateOnly? Premier(List<DateOnly> l) => l.Count > 0 ? l[0] : null;
            DateOnly? Dernier(List<DateOnly> l) => l.Count > 0 ? l[^1] : null;
            var ateliers = liste.Where(t => t.Type == TypeAtelier).ToList();
            var livrables = liste.Where(t => t.Type == TypeLivrable).ToList();
            return new StatistiquesTaches
            {
                N = liste.Count, Prevu = prevu, Conso = conso, Raf = raf, Atterrissage = conso + raf, Ecart = conso + raf - prevu,
                PrevuTSP = liste.Sum(t => t.ChargeTSP), Ajout = liste.Sum(t => t.ChargeAjout), NAjout = liste.Count(t => t.EstAjout),
                Annule = liste.Sum(t => t.ChargeAnnulee), NAnnul = liste.Count(t => t.Annulee),
                CoutPrevu = liste.Sum(t => t.CoutPrevu), CoutConso = coutConso, CoutRaf = coutRaf, CoutFinal = coutConso + coutRaf,
                PrevuP = Enumerable.Range(0, nP).Select(i => liste.Sum(t => t.Charges[i])).ToList(),
                ConsoP = Enumerable.Range(0, nP).Select(i => liste.Sum(t => t.ConsoP[i])).ToList(),
                PrevuDebut = Premier(pd), PrevuFin = Dernier(pf), ReelDebut = Premier(rd), ReelFin = Dernier(rf),
                Debut = PremiereDe(Premier(pd), Premier(rd)), Fin = DerniereDe(Dernier(pf), Dernier(rf)),
                Dated = liste.Count(Planifiee), Valides = liste.Count(t => !t.Annulee && t.Statut == StatutValide), Actives = liste.Count(t => !t.Annulee),
                Avancement = AvancementValide(liste), AvDeclare = prevu != 0 ? liste.Sum(t => t.Charge * t.Avancement) / prevu : 0, Statut = st,
                Ateliers = ateliers.Count(t => !t.Annulee), AteliersOK = ateliers.Count(t => t.Statut == StatutValide),
                Livrables = livrables.Count(t => !t.Annulee), LivrablesOK = livrables.Count(t => t.Statut == StatutValide),
                Ia = liste.Sum(t => t.Ia), IaRetenu = liste.Sum(t => t.Ia),
                IaRes = liste.Where(t => t.IaStatut is not null && t.IaStatut != "annulee" && t.Statut == StatutValide).Sum(t => t.IaRes ?? 0),
            };
        }

        // Regroupement choisi par l'utilisateur : ID (colonne A), Lot (B) ou Phase (C)
        var dimKey = s.GroupBy is "id" or "lot" or "phase" ? s.GroupBy : "id";
        var dim = dimKey switch
        {
            "lot" => new DimensionRegroupement { Key = "lot", Label = "Lot", Col = "colonne B" },
            "phase" => new DimensionRegroupement { Key = "phase", Label = "Phase", Col = "colonne C" },
            _ => new DimensionRegroupement { Key = "id", Label = "Axe", Col = "ID – colonne A" },
        };
        foreach (var t in tasks) t.Grp = dimKey == "id" ? t.Axe : dimKey == "lot" ? t.Lot ?? "" : t.Phase ?? "";
        List<string> ordre;
        if (dimKey == "id") ordre = axeIds;
        else if (dimKey == "phase")
        {
            var ph = p.Ref.Phases;
            ordre = ph.Concat(tasks.Select(t => t.Grp).Where(g => !string.IsNullOrEmpty(g) && !ph.Contains(g))).ToList();
        }
        else ordre = tasks.Select(t => t.Grp).Where(g => !string.IsNullOrEmpty(g)).ToList();
        ordre = Distinct(ordre);
        string NomGroupe(string k) => dimKey == "id" ? NomAxe(k)
            : dimKey == "phase" ? (string.IsNullOrEmpty(k) ? k : k[..1] + k[1..].ToLowerInvariant())
            : k == "0" ? "Lot 0 – Pilotage" : $"Lot {k}";
        var axes = ordre
            .Select(id => new GroupeCalcule(Statistiques(tasks.Where(t => t.Grp == id).ToList())) { Id = id, Nom = NomGroupe(id) })
            .Where(a => a.N > 0).ToList();
        var sansGrp = tasks.Where(t => string.IsNullOrEmpty(t.Grp)).ToList();
        if (sansGrp.Count > 0) axes.Add(new GroupeCalcule(Statistiques(sansGrp)) { Id = "", Nom = $"Sans {dim.Label.ToLowerInvariant()}" });
        var sansAxe = dimKey == "id" ? sansGrp : new List<TacheCalculee>();
        var total = Statistiques(tasks);

        // ---- PLANNING : dates prévues saisies par ligne (axe, lot ou phase) et par sous-partie (ligne de titre du TSP) ----
        // Sans saisie, le prévu reste celui des tâches (premier début → dernière fin prévus) ; le réel vient toujours du consommé.
        var planG = p.Planning?.Groupes ?? new Dictionary<string, DatesLignePlanningCalcul>();
        void PlanDe(LignePlanifiee ligne, string cle)
        {
            var x = planG.GetValueOrDefault(cle);
            ligne.Cle = cle;
            ligne.PlanDebut = x?.Debut ?? ligne.PrevuDebut;
            ligne.PlanFin = x?.Fin ?? ligne.PrevuFin;
            ligne.PlanSaisi = x?.Debut is not null || x?.Fin is not null;
            ligne.PlanDebutSaisi = x?.Debut is not null;
            ligne.PlanFinSaisi = x?.Fin is not null;
        }
        foreach (var a in axes) PlanDe(a, $"{dimKey}|{a.Id}");
        if (dimKey == "id")
        {
            // Sous-parties d'un axe = les lignes de titre du TSP. Une tâche appartient au dernier titre qui la précède dans le TSP,
            // si ce titre est de son axe (colonne A) ; sinon elle compte directement dans l'axe. Le lot n'intervient pas.
            var titreDe = new Dictionary<string, TacheCalcul?>();
            TacheCalcul? titreCourant = null;
            foreach (var t in p.Tasks) { if (t.Section) titreCourant = t; else titreDe[t.Uid] = titreCourant; }
            // un titre sans axe prend l'axe de la première tâche qui le suit
            var axeDuTitre = new Dictionary<string, string>();
            for (var k = 0; k < p.Tasks.Count; k++)
            {
                var t = p.Tasks[k];
                if (!t.Section) continue;
                var a = t.Id;
                if (string.IsNullOrEmpty(a))
                {
                    var suivante = p.Tasks.Skip(k + 1).FirstOrDefault(x => !x.Section);
                    a = suivante is null ? "" : tasks.FirstOrDefault(x => x.Uid == suivante.Uid)?.Axe ?? suivante.Id;
                }
                axeDuTitre[t.Uid] = a ?? "";
            }
            foreach (var a in axes)
            {
                var titresVus = new List<TacheCalcul>();
                foreach (var t in tasks)
                {
                    var sc = t.Grp == a.Id ? titreDe.GetValueOrDefault(t.Uid) : null;
                    if (sc is not null && !string.IsNullOrEmpty(a.Id) && axeDuTitre.GetValueOrDefault(sc.Uid) == a.Id && !titresVus.Contains(sc)) titresVus.Add(sc);
                }
                a.SousParties = titresVus.Select(sc =>
                {
                    var liste = tasks.Where(t => t.Grp == a.Id && titreDe.GetValueOrDefault(t.Uid) == sc).ToList();
                    var nomTsp = string.IsNullOrEmpty(sc.Label) ? "Sous-partie" : sc.Label;
                    var nomSaisi = (planG.GetValueOrDefault($"sec|{sc.Uid}")?.Nom ?? "").Trim();
                    var sp = new SousPartieCalculee(Statistiques(liste))
                    {
                        Id = sc.Uid, Nom = nomSaisi.Length > 0 ? nomSaisi : nomTsp, NomTSP = nomTsp, Axe = a.Id, Uids = liste.Select(t => t.Uid).ToList(),
                    };
                    PlanDe(sp, $"sec|{sc.Uid}|{a.Id}");
                    return sp;
                }).Where(x => x.N > 0).ToList();
                if (a.SousParties.Count == 0) continue; // axe sans titre à lui : dates saisies sur l'axe, sinon celles de ses tâches
                // L'axe découpé s'étend du plus tôt au plus tard de ce qu'il contient (sous-parties, tâches placées sous aucun titre).
                // Il n'a pas de saisie propre : une date saisie auparavant sur l'axe reste enregistrée (signalée) mais n'est plus utilisée.
                var dans = a.SousParties.SelectMany(x => x.Uids).ToHashSet();
                var libres = tasks.Where(t => t.Grp == a.Id && !dans.Contains(t.Uid)).ToList();
                var debuts = a.SousParties.Select(x => x.PlanDebut).Concat(libres.Select(t => t.DebutPrevu)).Where(x => x is not null).OrderBy(x => x).ToList();
                var fins = a.SousParties.Select(x => x.PlanFin).Concat(libres.Select(t => t.FinPrevue)).Where(x => x is not null).OrderBy(x => x).ToList();
                var ancien = planG.GetValueOrDefault($"id|{a.Id}");
                a.PlanDebut = debuts.FirstOrDefault();
                a.PlanFin = fins.LastOrDefault();
                a.PlanSaisi = false; a.PlanDebutSaisi = false; a.PlanFinSaisi = false;
                a.PlanCalcule = true;
                a.PlanDeSaisies = a.SousParties.Any(x => x.PlanSaisi);
                a.PlanAncien = ancien is not null && (ancien.Debut is not null || ancien.Fin is not null) ? new PeriodeCalculee { Debut = ancien.Debut, Fin = ancien.Fin } : null;
            }
        }
        // jalons du projet, dans l'ordre des dates ; ceux « à confirmer » n'ont pas de numéro
        var numeroJalon = 0;
        var jalons = (p.Planning?.Jalons ?? new List<JalonCalcul>())
            .Where(j => j is not null && !string.IsNullOrEmpty(j.Id) && j.Debut is not null)
            .OrderBy(j => j.Debut).ThenBy(j => Texte.Norm(j.Libelle), StringComparer.Ordinal)
            .Select(j => new JalonCalcule
            {
                Id = j.Id, Libelle = j.Libelle, Type = j.Type, Debut = j.Debut, Fin = j.Fin, AConfirmer = j.AConfirmer,
                Numero = j.AConfirmer ? null : ++numeroJalon,
            }).ToList();

        // ---- AVANCEMENT DÉTAILLÉ : groupe › sous-partie (lot, ou phase quand on regroupe par lot) › tâches ----
        var cleSous = dimKey == "lot" ? "phase" : "lot";
        var arbre = new ArbreAvancement
        {
            Cle = cleSous,
            Groupes = axes.Select(a =>
            {
                var ts = tasks.Where(t => t.Grp == a.Id).ToList();
                var parties = new List<(string Cle, List<TacheCalculee> Taches)>();
                foreach (var t in ts)
                {
                    var k = cleSous == "lot" ? t.Lot : t.Phase;
                    var x = parties.FindIndex(y => y.Cle == k);
                    if (x < 0) parties.Add((k, new List<TacheCalculee> { t })); else parties[x].Taches.Add(t);
                }
                return new GroupeAvancement
                {
                    Id = a.Id, Nom = a.Nom,
                    Sous = parties.Select(x => new SousGroupeAvancement
                    {
                        Id = x.Cle, Nom = cleSous == "lot" ? (x.Cle.Length > 0 ? $"Lot {x.Cle}" : "Sans lot") : (x.Cle.Length > 0 ? x.Cle : "Sans phase"),
                        Stat = Statistiques(x.Taches), Taches = x.Taches.Select(t => t.Uid).ToList(),
                    }).ToList(),
                };
            }).ToList(),
        };

        // ---- MENSUEL ----
        var consoM = months.Select(_ => new decimal[nP]).ToList();
        decimal horsPeriode = 0;
        foreach (var t in tasks)
        {
            var cpt = suivis[t.Uid].ConsoP;
            if (cpt is null) continue;
            foreach (var (i, jours) in cpt)
                foreach (var (d, v) in jours)
                {
                    if (v == 0) continue;
                    if (!indexMois.TryGetValue(d[..7], out var k) || i >= nP || i < 0) { horsPeriode += v; continue; }
                    consoM[k][i] += v;
                }
        }
        var refM = months.Select(m =>
        {
            var j = p.PlanningRef.Months.IndexOf(m);
            return Enumerable.Range(0, nP).Select(i => j >= 0 && i < p.PlanningRef.Rows.Count && j < p.PlanningRef.Rows[i].Count ? p.PlanningRef.Rows[i][j] : 0m).ToList();
        }).ToList();
        // planning vendu (onglet PLANNING du TSP, figé à l'import) : référence initiale, jamais modifiée
        var tspSrc = p.PlanningTsp ?? p.PlanningRef;
        var tspM = months.Select(m =>
        {
            var j = tspSrc.Months.IndexOf(m);
            return Enumerable.Range(0, nP).Select(i => j >= 0 && i < tspSrc.Rows.Count && j < tspSrc.Rows[i].Count ? tspSrc.Rows[i][j] : 0m).ToList();
        }).ToList();
        decimal cumCJM = 0, cumTJM = 0, cumRefTJM = 0;
        var mensuel = new List<MoisCalcule>();
        for (var k = 0; k < months.Count; k++)
        {
            var c = consoM[k];
            var coutCJM = c.Select((v, i) => v * P[i].Cjm).Sum();
            var valoTJM = c.Select((v, i) => v * P[i].TjmR).Sum();
            var refTJM = refM[k].Select((v, i) => v * P[i].TjmR).Sum();
            cumCJM += coutCJM; cumTJM += valoTJM; cumRefTJM += refTJM;
            mensuel.Add(new MoisCalcule
            {
                Mois = months[k], ConsoP = c.ToList(), Conso = c.Sum(), RefP = refM[k], Ref = refM[k].Sum(), TspP = tspM[k], Tsp = tspM[k].Sum(),
                CoutCJM = coutCJM, CumCJM = cumCJM, ValoTJM = valoTJM, CumTJM = cumTJM, RefTJM = refTJM, CumRefTJM = cumRefTJM,
            });
        }
        var refTotal = p.PlanningRef.Rows.Sum(r => r.Sum());
        var tspTotal = tspSrc.Rows.Sum(r => r.Sum());
        // replanifié = au moins une valeur (profil × mois) du prévisionnel diffère du planning vendu
        static Dictionary<string, decimal> Valeurs(PlanningProfilsCalcul? pl)
        {
            var o = new Dictionary<string, decimal>();
            if (pl is null) return o;
            for (var i = 0; i < pl.Rows.Count; i++)
                for (var k = 0; k < pl.Months.Count && k < pl.Rows[i].Count; k++)
                    if (pl.Rows[i][k] != 0) o[$"{i}|{pl.Months[k]}"] = pl.Rows[i][k];
            return o;
        }
        var valeursTsp = Valeurs(p.PlanningTsp);
        var valeursPrev = Valeurs(p.PlanningRef);
        var replanifie = p.PlanningTsp is not null && valeursTsp.Keys.Union(valeursPrev.Keys)
            .Any(k => Math.Abs(valeursTsp.GetValueOrDefault(k) - valeursPrev.GetValueOrDefault(k)) > Epsilon);

        // ---- FINANCIER ----
        var coutInitial = tasks.Sum(t => t.CoutPrevuTSP); // coût budgété au TSP
        var coutAjoutTotal = tasks.Sum(t => t.CoutAjout);
        var coutAnnuleTotal = tasks.Sum(t => t.CoutAnnule);
        var coutReaffTotal = tasks.Sum(t => t.CoutReaff); // écart de coût des réaffectations (CJM différents)
        var caAvenantTotal = tasks.Sum(t => t.CaAvenant);
        var caEff = totCA - caAvenantTotal; // CA du forfait, diminué des avenants de réduction

        // ---- achats et frais : budget du TSP / réel saisi (montants HT) ----
        // Atterrissage = pour chaque ligne du TSP, le plus élevé du budget et du réel ; hors TSP = réel uniquement.
        var achReel = p.AchatsReel.Select(a => (a, montant: a.Qte * a.Cu, refacture: a.Refacture)).ToList();
        var achLignes = p.Achats.Select((b, i) =>
        {
            var L = achReel.Where(x => x.a.Ligne == i).ToList();
            var budget = b.Cu * b.Qte;
            decimal reel = L.Sum(x => x.montant), reelRev = L.Sum(x => x.refacture);
            return new LigneAchatBudget
            {
                I = i, Designation = b.Designation, Budget = budget, BudgetRev = b.Revente, Reel = reel, ReelRev = reelRev, N = L.Count,
                Att = Math.Max(budget, reel), AttRev = Math.Max(b.Revente, reelRev),
            };
        }).ToList();
        var horsIdx = achReel.Select((x, k) => (x, k)).Where(y => y.x.a.Ligne is null || y.x.a.Ligne < 0 || y.x.a.Ligne >= p.Achats.Count).Select(y => y.k).ToList();
        var horsTSP = horsIdx.Sum(k => achReel[k].montant);
        var achatsAtt = achLignes.Sum(l => l.Att) + horsTSP;
        var achatsAttRev = achLignes.Sum(l => l.AttRev) + horsIdx.Sum(k => achReel[k].refacture);
        var achats = new AchatsCalcules
        {
            ParLigne = achLignes, Hors = horsIdx, Budget = achatsMt, BudgetRev = achatsRef,
            Reel = achReel.Sum(x => x.montant), ReelRev = achReel.Sum(x => x.refacture), HorsTSP = horsTSP,
            Att = achatsAtt, AttRev = achatsAttRev,
            // ligne par ligne : le dépassement d'une ligne ne consomme pas le budget d'une autre
            Reste = achLignes.Sum(l => Math.Max(0, l.Budget - l.Reel)), Depasse = achatsAtt - achatsMt,
            // effet sur la marge nette par rapport au TSP : un dépassement couvert par du refacturé n'est pas une perte
            ImpactNet = (achatsAttRev - achatsAtt) - (achatsRef - achatsMt),
            ParStatut = AchatStatuts.Select(st =>
            {
                var l = achReel.Where(x => (string.IsNullOrEmpty(x.a.Statut) ? AchatStatuts[0] : x.a.Statut) == st).ToList();
                return new MontantParCle { Cle = st, N = l.Count, Montant = l.Sum(x => x.montant) };
            }).ToList(),
        };
        var frReel = p.FraisReel.Select(x => (x, montant: x.Montant, refacture: x.Refacturable ? x.Montant : 0m)).ToList();
        decimal fraisReelTotal = frReel.Sum(x => x.montant), fraisReelRef = frReel.Sum(x => x.refacture);
        // Deux enveloppes (règle du 09/10/2026) : les frais refacturables, remboursés par le client (sans effet sur la marge),
        // et ceux à notre charge. Part à notre charge prévue au TSP = budget − refacturé. Chaque enveloppe atterrit au plus
        // élevé de son budget et de son réel : un frais non refacturé au-delà de la part prévue à notre charge réduit la marge,
        // même s'il reste du budget refacturable.
        var fraisReelNonRef = fraisReelTotal - fraisReelRef;
        var fraisBudgetNonRef = Math.Max(0, fraisDep - fraisRef);
        var fraisBudgetRefCout = fraisDep - fraisBudgetNonRef;
        var fraisAttRefCout = Math.Max(fraisBudgetRefCout, fraisReelRef);
        var fraisAttNonRef = Math.Max(fraisBudgetNonRef, fraisReelNonRef);
        var fraisAtt = fraisAttRefCout + fraisAttNonRef;
        var fraisAttRef = fraisRef + Math.Max(0, fraisReelRef - fraisBudgetRefCout); // un dépassement refacturable est remboursé au réel
        var frais = new FraisCalcules
        {
            Budget = fraisDep, BudgetRef = fraisRef, Reel = fraisReelTotal, ReelRef = fraisReelRef,
            ReelNonRef = fraisReelNonRef, BudgetNonRef = fraisBudgetNonRef, BudgetRefCout = fraisBudgetRefCout, AttRefCout = fraisAttRefCout, AttNonRef = fraisAttNonRef,
            Att = fraisAtt, AttRef = fraisAttRef, Reste = Math.Max(0, fraisDep - fraisReelTotal), Depasse = fraisAtt - fraisDep,
            ImpactNet = (fraisAttRef - fraisAtt) - (fraisRef - fraisDep),
            ParCategorie = FraisCategories.Select(c =>
            {
                var l = frReel.Where(x => Ou(x.x.Categorie, "Autre") == c).ToList();
                return new MontantParCle { Cle = c, N = l.Count, Montant = l.Sum(x => x.montant) };
            }).ToList(),
            ParCollab = Distinct(frReel.Select(x => Ou(x.x.Collaborateur, "—"))).Select(c =>
            {
                var l = frReel.Where(x => Ou(x.x.Collaborateur, "—") == c).ToList();
                return new MontantParCle { Cle = c, N = l.Count, Montant = l.Sum(x => x.montant) };
            }).ToList(),
        };
        var margeProduction = caEff - total.CoutFinal;
        // marge nette : production (jours) + achats + frais, vendue (TSP) et à l’atterrissage
        var margeNetteAtt = margeProduction + (achats.AttRev - achats.Att) + (frais.AttRef - frais.Att);
        var caNetAtt = caEff + achats.AttRev + frais.AttRef;
        var financier = new Financier
        {
            Ca = caEff, CaTSP = totCA, CaAvenant = caAvenantTotal, CoutInitial = coutInitial, CoutAjout = coutAjoutTotal, CoutAnnule = coutAnnuleTotal,
            CoutReaff = coutReaffTotal, CoutPrevu = coutInitial + coutAjoutTotal + coutReaffTotal - coutAnnuleTotal, CoutConso = total.CoutConso, CoutRaf = total.CoutRaf, CoutFinal = total.CoutFinal,
            Marge = margeProduction, TauxMarge = caEff != 0 ? margeProduction / caEff : 0, EcartCout = total.CoutFinal - coutInitial,
            Achats = achats, Frais = frais,
            MargeNette = margeNetteAtt, TauxMargeNette = caNetAtt != 0 ? margeNetteAtt / caNetAtt : 0,
            MargeNetteVendue = synthese.MargeNette, TauxMargeNetteVendue = synthese.MargeNettePct,
        };

        // ---- évolutions du périmètre (ajouts en cours de projet, non facturés) ----
        var lignesAjout = new List<LignePerimetre>();
        foreach (var t in tasks)
        {
            List<string> NomsProfils(List<decimal> v) => v.Select((x, i) => x != 0 && i < nP ? P[i].Nom : null).Where(x => x is not null).Select(x => x!).ToList();
            if (t.Annulee)
                lignesAjout.Add(new LignePerimetre
                {
                    Kind = "annul", Uid = t.Uid, Label = t.Label, Profils = NomsProfils(t.ChargesAnnul), Jh = -t.ChargeAnnulee, Cout = -t.CoutAnnule,
                    Conso = t.ConsoTotal, Avenant = t.Annul!.Avenant, CaAvenant = t.CaAvenant, At = t.Annul.At, By = t.Annul.By, Motif = t.Annul.Motif,
                });
            var source = p.Tasks.First(x => x.Uid == t.Uid);
            if (t.EstAjout)
                lignesAjout.Add(new LignePerimetre
                {
                    Kind = "tache", Uid = t.Uid, Label = t.Label, Profils = NomsProfils(t.ChargesA), Jh = t.ChargeAjout, Cout = t.CoutAjout, Conso = t.ConsoTotal,
                    At = source.Ajout?.At, By = source.Ajout?.By, Motif = source.Ajout?.Motif,
                });
            else
                for (var i = 0; i < t.ChargesA.Count; i++)
                {
                    var v = t.ChargesA[i];
                    if (v == 0) continue;
                    var info = suivis[t.Uid].AjoutInfo?.GetValueOrDefault(i);
                    lignesAjout.Add(new LignePerimetre
                    {
                        Kind = "profil", Uid = t.Uid, Label = t.Label, I = i, Profils = [P[i].Nom], Jh = v, Cout = v * Cjm(i), Conso = t.ConsoP[i],
                        At = info?.At, By = info?.By, Motif = info?.Motif,
                    });
                }
        }
        // réaffectations : la charge passe d'un profil à un autre ; le total ne change pas, le coût suit le CJM
        foreach (var t in tasks)
            foreach (var r in t.Reaff)
                lignesAjout.Add(new LignePerimetre
                {
                    Kind = "reaff", Uid = t.Uid, Label = t.Label, Id = r.Id, De = r.De, Vers = r.Vers, Profils = [P[r.De].Nom, P[r.Vers].Nom],
                    Jh = r.Jh, Cout = r.Jh * (Cjm(r.Vers) - Cjm(r.De)), Conso = 0, At = r.At, By = r.By, Motif = r.Motif,
                });
        lignesAjout = lignesAjout.OrderByDescending(l => l.At ?? "", StringComparer.Ordinal).ToList();
        var perimetre = new Perimetre
        {
            ChargeTSP = total.PrevuTSP, ChargeAjout = total.Ajout, ChargeAnnulee = total.Annule, ChargeActuelle = total.Prevu,
            CoutAjout = coutAjoutTotal, CoutAnnule = coutAnnuleTotal, CoutReaff = coutReaffTotal, CaAvenant = caAvenantTotal,
            NReaff = lignesAjout.Count(l => l.Kind == "reaff"),
            NTaches = tasks.Count(t => t.EstAjout), NProfilsTache = lignesAjout.Count(l => l.Kind == "profil"), NAnnul = tasks.Count(t => t.Annulee),
            ProfilsAjoutes = P.Where(x => x.EstAjout).Select(x => x.I).ToList(), Lignes = lignesAjout,
            MargeVendue = totCA != 0 ? (totCA - coutInitial) / totCA : null,
            MargeAvecAjouts = caEff != 0 ? (caEff - coutInitial - coutAjoutTotal - coutReaffTotal + coutAnnuleTotal) / caEff : null,
        };

        // ---- ÉCHÉANCIER ----
        // Une phase est liée à une seule échéance ; ce lien prime sur celui des tâches de la phase.
        var phaseEch = new Dictionary<string, int>();
        foreach (var e in p.Echeancier)
            foreach (var ph in p.EchTrack.GetValueOrDefault(e.N)?.Phases ?? new())
                phaseEch.TryAdd(ph, e.N);
        foreach (var t in tasks)
        {
            t.EchViaPhase = phaseEch.ContainsKey(t.Phase);
            t.EchN = t.EchViaPhase ? phaseEch[t.Phase] : suivis[t.Uid].Ech is > 0 ? suivis[t.Uid].Ech : null;
        }
        // Montants : une échéance facturée garde son montant ; un avenant de réduction est réparti sur les échéances
        // non encore facturées, au prorata de leur pourcentage (le total facturé reste égal au CA du forfait).
        var moisCourant = Calendrier.Mois(aujourdhui);
        decimal? CumulA(Func<MoisCalcule, decimal> champ, string? mk)
        {
            if (mk is null) return null;
            if (string.CompareOrdinal(mk, months[0]) < 0) return 0;
            if (indexMois.TryGetValue(mk, out var k)) return champ(mensuel[k]);
            return mensuel.Count > 0 ? champ(mensuel[^1]) : 0;
        }
        var echBase = p.Echeancier.Select(e => (e, et: p.EchTrack.GetValueOrDefault(e.N) ?? new SuiviEcheanceCalcul())).ToList();
        // montant figé à la facturation ; anciens suivis sans montant figé : % × CA du TSP
        decimal MontantFige(EcheanceCalcul e, SuiviEcheanceCalcul et) => et.MontantFacture ?? e.Pct * totCA;
        var factInit = echBase.Where(x => x.et.RealiseLe is not null).Sum(x => MontantFige(x.e, x.et));
        var pctRestant = echBase.Where(x => x.et.RealiseLe is null).Sum(x => x.e.Pct);
        var echeancier = echBase.Select(x =>
        {
            var (e, et) = x;
            var montantInit = e.Pct * totCA;
            var montant = et.RealiseLe is not null ? MontantFige(e, et) : pctRestant == 0 ? montantInit : Math.Max(0, caEff - factInit) * e.Pct / pctRestant;
            // date prévue (par défaut fin du mois de facturation du TSP), facturée le, payée le, périmètre lié
            var datePrevue = et.DatePrevue ?? (e.Mois is not null ? Calendrier.DernierJour(e.Mois) : (DateOnly?)null);
            var lies = tasks.Where(t => !t.Annulee && t.EchN is not null && t.EchN == e.N).ToList();
            var chL = lies.Sum(t => t.Charge);
            int? jours = datePrevue is not null ? datePrevue.Value.DayNumber - aujourdhui.DayNumber : null;
            var statut = et.PayeeLe is not null ? "Payée" : et.RealiseLe is not null ? "Facturée" : jours is < 0 ? "En retard" : "Planifiée";
            return new EcheanceCalculee
            {
                N = e.N, Nom = e.Nom, Pct = e.Pct, Montant = montant, MontantInit = montantInit, AjustAvenant = montant - montantInit,
                Mois = datePrevue is not null ? Calendrier.Mois(datePrevue.Value) : e.Mois, MoisTSP = e.Mois,
                DatePrevue = datePrevue, DatePrevueAuto = et.DatePrevue is null, RealiseLe = et.RealiseLe, PayeeLe = et.PayeeLe,
                Commentaire = et.Commentaire ?? "", Phases = et.Phases ?? new(), Lies = lies.Select(t => t.Uid).ToList(),
                NLies = lies.Count, NLiesValides = lies.Count(t => t.Statut == StatutValide),
                AvLie = chL != 0 ? AvancementValide(lies) : null,
                Pret = lies.Count > 0 && lies.All(t => t.Statut == StatutValide), Jours = jours, Statut = statut,
                ApresFin = datePrevue is not null && finRef is not null && datePrevue > finRef,
            };
        }).ToList();
        // FAE (factures à établir) = valeur produite cumulée − montant facturé cumulé.
        // Prévue : planning de charge et dates prévues. Réelle : à la date de la facture, sinon en fin de mois (mois passés ou en cours).
        decimal factCum = 0;
        foreach (var e in echeancier.OrderBy(x => x.DatePrevue is null ? "9999" : Calendrier.Iso(x.DatePrevue.Value), StringComparer.Ordinal))
        {
            factCum += e.Montant;
            e.FactCum = factCum;
            e.ProdPlan = CumulA(m => m.CumRefTJM, e.Mois);
            e.FaePlan = e.ProdPlan is null ? null : e.ProdPlan - factCum;
            DateOnly? refD = e.RealiseLe ?? (e.Mois is not null && string.CompareOrdinal(e.Mois, moisCourant) <= 0 ? Calendrier.DernierJour(e.Mois) : (DateOnly?)null);
            if (refD is not null)
            {
                e.FactReel = echeancier.Where(x => x.RealiseLe is not null && x.RealiseLe <= refD).Sum(x => x.Montant);
                var moisRef = Calendrier.Mois(refD.Value);
                e.ProdReel = CumulA(m => m.CumTJM, string.CompareOrdinal(moisRef, moisCourant) < 0 ? moisRef : moisCourant) ?? 0;
                e.FaeReel = e.ProdReel - e.FactReel;
            }
            else { e.FactReel = null; e.ProdReel = null; e.FaeReel = null; }
        }
        // FAE (%) : une seule base pour toutes les lignes, le montant total des échéances.
        // Signe repris du TSP : négatif quand la production est en avance sur la facturation.
        var totEch = echeancier.Sum(e => e.Montant);
        foreach (var e in echeancier)
        {
            e.FaePlanPct = e.FaePlan is null || totEch == 0 ? null : -e.FaePlan / totEch;
            e.FaeReelPct = e.FaeReel is null || totEch == 0 ? null : -e.FaeReel / totEch;
        }
        var facture = echeancier.Where(e => e.RealiseLe is not null).Sum(e => e.Montant);
        var produit = CumulA(m => m.CumTJM, moisCourant) ?? 0;
        var echSynth = new SyntheseEcheances
        {
            Facture = facture, Paye = echeancier.Where(e => e.PayeeLe is not null).Sum(e => e.Montant), Reste = totEch - facture,
            Produit = produit, FaeADate = produit - facture, AjustAvenant = echeancier.Sum(e => e.AjustAvenant),
        };

        // ---- ATELIERS / LIVRABLES ----
        var al = tasks.Where(t => !string.IsNullOrEmpty(t.Type)).ToList();
        var parType = types.Select(ty =>
        {
            var l0 = al.Where(t => t.Type == ty.Id).ToList();
            var l = l0.Where(t => !t.Annulee).ToList();
            var ok = l.Count(t => t.Statut == StatutValide);
            return new CompteurParType
            {
                Id = ty.Id, Nom = ty.Nom, Socle = ty.Socle, Prevus = l.Count, Realises = ok, Restants = l.Count - ok, Annules = l0.Count - l.Count,
                Taux = l.Count > 0 ? (decimal)ok / l.Count : 0, Charge = l.Sum(t => t.Charge),
            };
        }).ToList();
        CompteurType Compter(string ty)
        {
            var l = al.Where(t => t.Type == ty && !t.Annulee).ToList();
            var ok = l.Count(t => t.Statut == StatutValide);
            return new CompteurType { Prevus = l.Count, Realises = ok, Restants = l.Count - ok, Taux = l.Count > 0 ? (decimal)ok / l.Count : 0 };
        }

        // ---- IA ----
        var iaTasks = tasks.Where(t => t.Ia > 0 && !t.Annulee).ToList();
        var iaVal = iaTasks.Where(t => t.Statut == StatutValide).ToList();
        var iaRef = iaTasks.Sum(t => t.Ia);
        var realise = iaVal.Sum(t => t.IaRes ?? 0);
        var envVal = iaVal.Sum(t => t.Ia);
        var projection = iaTasks.Sum(t => t.IaRes ?? 0);
        var tjmIA = iaIdx >= 0 && iaIdx < nP ? P[iaIdx].TjmR : 0;
        var cjmIA = iaIdx >= 0 && iaIdx < nP ? P[iaIdx].Cjm : 0;
        var iaParType = new List<IaParType>();
        foreach (var t in iaVal.Where(t => t.IaStatut != "conforme"))
        {
            var k = Ou(t.IaType, "Non renseigné");
            var o = iaParType.Find(x => x.Type == k);
            if (o is null) { o = new IaParType { Type = k, Sens = (t.IaRes ?? 0) >= 0 ? "eco" : "dep" }; iaParType.Add(o); }
            o.N++;
            o.Jh += t.IaRes ?? 0;
        }
        var indicateursIa = new IndicateursIa
        {
            Profil = iaIdx >= 0 && iaIdx < nP ? P[iaIdx].Nom : null, Ref = iaRef, Consomme = iaTasks.Sum(t => t.IaConso), Realise = realise, EnvVal = envVal,
            Projection = projection, Taux = envVal != 0 ? realise / envVal : 0, TauxProj = iaRef != 0 ? projection / iaRef : 0,
            ValeurTJM = realise * tjmIA, ValeurCJM = realise * cjmIA, ProjTJM = projection * tjmIA, Tjm = tjmIA, Cjm = cjmIA,
            Validees = iaVal.Count, AJustifier = iaTasks.Where(t => t.IaAJustifier).Select(t => t.Uid).ToList(),
            ParType = iaParType.OrderByDescending(x => x.Jh).ToList(),
            Leviers = s.IaLeviers is { Count: > 0 } ? s.IaLeviers : IaLeviers.ToList(),
            Causes = s.IaCauses is { Count: > 0 } ? s.IaCauses : IaCauses.ToList(),
            Tasks = iaTasks.Select(t => t.Uid).ToList(),
        };

        // ---- POINTS DE VIGILANCE ----
        var nonDatees = tasks.Where(t => !t.Annulee && t.Statut != StatutValide && !Planifiee(t)).ToList();
        var depassements = tasks.Where(t => t.ConsoTotal > t.Charge + Epsilon).ToList();
        string Niveau(bool alerte, string niveau) => alerte ? niveau : "ok";
        var nbBloque = tasks.Count(t => t.Statut == StatutBloque);
        var nbReestimer = tasks.Count(t => t.RafAReestimer);
        var nbIncoherent = tasks.Count(t => t.RafIncoherent);
        var nbSansConso = tasks.Count(t => t.Statut == StatutValide && !(t.ConsoTotal > 0));
        var vigilance = new List<PointVigilance>
        {
            new() { Cle = "sansAxe", Label = "Tâches sans axe", Valeur = sansAxe.Count, Niveau = Niveau(sansAxe.Count > 0, "critique"),
                Detail = sansAxe.Count > 0 ? $"{Texte.Jh(Texte.Arrondir(sansAxe.Sum(t => t.Charge)))} JH non rattachés à un axe" : "Toutes les tâches ont un axe" },
            new() { Cle = "bloque", Label = "Tâches bloquées / en attente", Valeur = nbBloque, Niveau = Niveau(nbBloque > 0, "critique") },
            new() { Cle = "reestimer", Label = "Reste à faire à réestimer", Valeur = nbReestimer, Niveau = Niveau(nbReestimer > 0, "critique"),
                Detail = "Budget consommé mais tâche non validée : indiquez le reste à faire réel" },
            new() { Cle = "incoherent", Label = "RAF incohérent avec l’avancement", Valeur = nbIncoherent, Niveau = Niveau(nbIncoherent > 0, "attention"),
                Detail = "Le rythme observé (consommé / avancement) suggère un autre reste à faire" },
            new() { Cle = "sansConso", Label = "Tâches validées sans consommé", Valeur = nbSansConso, Niveau = Niveau(nbSansConso > 0, "attention"),
                Detail = "Temps passé non saisi ? Sans consommé, la tâche affiche une économie fictive (écart, marge, résultat IA)" },
            new() { Cle = "depassement", Label = "Tâches en dépassement", Valeur = depassements.Count, Niveau = Niveau(depassements.Count > 0, "critique"),
                Detail = "Consommé supérieur à la charge vendue" },
            new() { Cle = "ecart", Label = "Écart d'atterrissage", Valeur = Texte.Arrondir(total.Ecart), Unite = "JH", Niveau = Niveau(total.Ecart > 0.001m, "critique") },
            new() { Cle = "cout", Label = "Écart coût / initial", Valeur = Texte.Arrondir(financier.EcartCout), Unite = "€", Niveau = Niveau(financier.EcartCout > 0.5m, "attention") },
        };
        if (achats.Depasse > 0.5m && achats.ImpactNet < -0.5m)
            vigilance.Add(new()
            {
                Cle = "achats", Label = "Achats au-delà du budget TSP", Valeur = Texte.Arrondir(achats.Depasse), Unite = "€", Niveau = "attention",
                Detail = $"{(achats.Hors.Count > 0 ? achats.Hors.Count + " achat(s) hors TSP · " : "")}atterrissage {Texte.Euros(achats.Att)} pour un budget de {Texte.Euros(achats.Budget)}",
            });
        // frais : seuls ceux à notre charge, au-delà de la part prévue au TSP, réduisent la marge
        if (frais.ImpactNet < -0.5m)
            vigilance.Add(new()
            {
                Cle = "frais", Label = "Frais à notre charge au-delà du TSP", Valeur = Texte.Arrondir(-frais.ImpactNet), Unite = "€", Niveau = "attention",
                Detail = $"{Texte.Euros(frais.ReelNonRef)} de frais non refacturés pour {Texte.Euros(frais.BudgetNonRef)} prévus à notre charge au TSP",
            });
        if (total.Ajout > 0)
            vigilance.Add(new()
            {
                Cle = "ajouts", Label = "Charge ajoutée non facturée", Valeur = Texte.Arrondir(total.Ajout), Unite = "JH", Niveau = "attention",
                Detail = $"{lignesAjout.Count(l => l.Kind != "annul" && l.Kind != "reaff")} ajout(s) au périmètre du TSP · coût estimé {Texte.Euros(coutAjoutTotal)} absorbé par la marge",
            });
        // ---- actions & décisions ----
        var actOuv = p.Actions.Where(a => !string.IsNullOrWhiteSpace(a.Libelle) && a.Statut != "Fait" && a.Statut != "Annulée").ToList();
        var actRetard = actOuv.Where(a => a.Echeance is not null && a.Echeance < aujourdhui).ToList();
        var decAValider = p.Decisions.Where(x => x.Statut == "À valider").ToList();
        if (actRetard.Count > 0)
            vigilance.Add(new()
            {
                Cle = "actions", Label = "Actions en retard", Valeur = actRetard.Count, Niveau = "critique",
                Detail = string.Join(" · ", actRetard.Take(3).Select(a => $"{a.Ref} {a.Libelle}{(string.IsNullOrEmpty(a.Porteur) ? "" : " (" + a.Porteur + ")")}")),
            });
        var echRetard = echeancier.Where(e => e.Statut == "En retard").ToList();
        if (echRetard.Count > 0)
            vigilance.Add(new()
            {
                Cle = "echeances", Label = "Échéances de facturation en retard", Valeur = echRetard.Count, Niveau = "critique",
                Detail = string.Join(" · ", echRetard.Take(3).Select(e => $"n° {e.N} {e.Nom} (prévue le {Calendrier.Fr(e.DatePrevue!.Value)})")),
            });
        var echApres = echeancier.Where(e => e.ApresFin && e.RealiseLe is null).ToList();
        if (echApres.Count > 0)
            vigilance.Add(new()
            {
                Cle = "echapres", Label = "Échéances prévues après la fin du projet", Valeur = echApres.Count, Niveau = "attention",
                Detail = string.Join(" · ", echApres.Select(e => $"n° {e.N} le {Calendrier.Fr(e.DatePrevue!.Value)}")),
            });
        if (decAValider.Count > 0)
            vigilance.Add(new()
            {
                Cle = "decisions", Label = "Décisions en attente de validation", Valeur = decAValider.Count, Niveau = "attention",
                Detail = string.Join(" · ", decAValider.Take(3).Select(x => $"{x.Ref} {x.Libelle}")),
            });
        // Une personne ne peut pas travailler plus d'une journée par jour, toutes tâches confondues
        var chargeJour = Enumerable.Range(0, nP).Select(_ => new Dictionary<string, decimal>()).ToList();
        foreach (var t in tasks)
            foreach (var (k, o) in suivis[t.Uid].ConsoP ?? new())
                if (k >= 0 && k < nP)
                    foreach (var (d, v) in o) if (v != 0) chargeJour[k][d] = chargeJour[k].GetValueOrDefault(d) + v;
        var surJours = new List<SurchargeJour>();
        for (var i = 0; i < nP; i++)
        {
            if (PeutDepasserUneJournee(P[i].Entite)) continue;
            foreach (var (d, v) in chargeJour[i]) if (v > 1 + Epsilon) surJours.Add(new SurchargeJour { I = i, D = Calendrier.LireIso(d), V = v });
        }
        surJours = surJours.OrderBy(x => x.D).ToList();
        if (surJours.Count > 0)
            vigilance.Insert(0, new()
            {
                Cle = "jour", Label = "Plus d’une journée saisie le même jour", Valeur = surJours.Count, Niveau = "critique",
                Detail = string.Join(" · ", surJours.Take(3).Select(x => $"{P[x.I].Nom} le {Calendrier.Fr(x.D)} : {Texte.Jh(x.V)} JH")) + (surJours.Count > 3 ? " …" : ""),
            });
        if (horsPeriode != 0)
            vigilance.Add(new() { Cle = "hors", Label = "Consommé non rattaché", Valeur = Texte.Arrondir(horsPeriode), Unite = "JH", Niveau = "attention", Detail = "Consommé saisi sur un profil inexistant" });

        // ---- risques ----
        int Niveau3(IReadOnlyList<string> liste, string v) => Math.Max(0, liste.ToList().IndexOf(v)) + 1;
        var risques = p.Risques.Select(r =>
        {
            var statutR = Ou(r.Statut, "Ouvert");
            // l'ancienne échelle (3 niveaux) est convertie : Moyenne → Modérée, Moyen → Moyenne, Fort → Forte
            var proba = ProbaSurQuatreNiveaux(r.Proba);
            var impact = ImpactSurQuatreNiveaux(r.Impact);
            var crit = Niveau3(RisqueProbabilites, proba) * Niveau3(RisqueImpacts, impact);
            return new RisqueCalcule
            {
                Ref = r.Ref, Libelle = r.Libelle, Proba = proba, Impact = impact, Statut = statutR,
                Crit = crit, Niveau = NiveauRisque(crit), Ouvert = statutR == "Ouvert" || statutR == "Survenu",
            };
        }).ToList();
        var risquesForts = risques.Where(r => r.Ouvert && r.Niveau == "fort").ToList();
        if (risquesForts.Count > 0)
            vigilance.Add(new()
            {
                Cle = "risques", Label = "Risques forts ouverts", Valeur = risquesForts.Count, Niveau = "critique",
                Detail = string.Join(" · ", risquesForts.Take(3).Select(r => $"{r.Ref} {r.Libelle}")),
            });

        // ---- calendrier du projet ----
        var cal = new CalendrierProjet { Debut = D.Debut, FinContrat = D.FinContrat, FinPrevue = finRef };
        if (cal.Debut is { } cd && cal.FinPrevue is { } cf)
        {
            var tot = Calendrier.JoursOuvres(cd, cf);
            var ecoule = aujourdhui < cd ? 0 : Calendrier.JoursOuvres(cd, aujourdhui < cf ? aujourdhui : cf);
            cal.JoursTotal = tot;
            cal.JoursEcoules = ecoule;
            cal.JoursRestants = Math.Max(tot - ecoule, 0);
            cal.TempsPct = tot != 0 ? (decimal)ecoule / tot : 0;
            cal.ConsoPct = total.Prevu != 0 ? total.Conso / total.Prevu : 0;
        }
        if (cal.FinContrat is { } fc && cal.FinPrevue is { } fp)
        {
            cal.GlissementJours = fp.DayNumber - fc.DayNumber;
            cal.GlissementOuvres = fp > fc ? Calendrier.JoursOuvres(fc.AddDays(1), fp) : fp < fc ? -Calendrier.JoursOuvres(fp.AddDays(1), fc) : 0;
        }
        if (cal.Debut is null || cal.FinPrevue is null)
            vigilance.Insert(0, new() { Cle = "dates", Label = "Dates du projet non renseignées", Valeur = "!", Niveau = "critique", Detail = "Renseignez le début et la fin du projet dans les paramètres du projet." });
        if (cal.GlissementJours > 0)
            vigilance.Insert(0, new()
            {
                Cle = "gliss", Label = "Glissement de la fin du projet", Valeur = cal.GlissementJours.Value, Unite = "j", Niveau = "critique",
                Detail = $"Fin prévue le {Calendrier.Fr(cal.FinPrevue!.Value)} au lieu du {Calendrier.Fr(cal.FinContrat!.Value)} (fin contractuelle)",
            });
        if (cal.TempsPct is not null && cal.ConsoPct - cal.TempsPct > 0.1m)
            vigilance.Add(new()
            {
                Cle = "rythme", Label = "Consommation en avance sur le calendrier", Valeur = Texte.Arrondir((cal.ConsoPct!.Value - cal.TempsPct.Value) * 100, 0), Unite = "pts", Niveau = "attention",
                Detail = $"{Texte.Arrondir(cal.ConsoPct.Value * 100, 0)} % de la charge consommée pour {Texte.Arrondir(cal.TempsPct.Value * 100, 0)} % du temps écoulé",
            });
        if (cal.FinPrevue is { } finP)
        {
            var tard = tasks.Where(t => t.Fin is not null && t.Fin > finP).ToList();
            if (tard.Count > 0)
                vigilance.Add(new() { Cle = "apresfin", Label = "Tâches datées après la fin prévue", Valeur = tard.Count, Niveau = "critique", Detail = string.Join(" · ", tard.Take(3).Select(t => t.Label)) });
        }
        if (cal.Debut is { } debP)
        {
            var tot = tasks.Count(t => t.Debut is not null && t.Debut < debP);
            if (tot > 0) vigilance.Add(new() { Cle = "avantdebut", Label = "Tâches démarrées avant le début du projet", Valeur = tot, Niveau = "attention" });
        }
        if (horsProjetMois.Count > 0)
            vigilance.Add(new()
            {
                Cle = "moishors", Label = "Données hors période du projet", Valeur = horsProjetMois.Count, Unite = "mois", Niveau = "attention",
                Detail = string.Join(", ", horsProjetMois.Select(Calendrier.MoisFr)),
            });

        return new ResultatCalcul
        {
            P = P, Months = months, MoisDebut = moisDebut, MoisFin = moisFin, Cal = cal, Dim = dim, Tasks = tasks, Profils = profils, Synthese = synthese, Ventilation = ventilation,
            Metrique = metrique, Axes = axes, Total = total, Mensuel = mensuel, RefTotal = refTotal, TspTotal = tspTotal, Replanifie = replanifie,
            Jalons = jalons, AxeIdsActifs = axeIds.Where(id => tasks.Any(t => t.Axe == id)).ToList(), Avancement = arbre,
            Financier = financier, Perimetre = perimetre,
            SurJours = surJours, Echeancier = echeancier, EchSynth = echSynth, Risques = risques,
            Ateliers = new AteliersEtLivrables { Ateliers = Compter(TypeAtelier), Livrables = Compter(TypeLivrable), ParType = parType },
            Ia = indicateursIa, Vigilance = vigilance, NonDatees = nonDatees.Select(t => t.Uid).ToList(),
        };
    }

    /// <summary>
    /// Avancement d'un ensemble de tâches (axe, lot, phase, échéance, projet) : JH des tâches validées ÷ JH prévus.
    /// Seules les tâches validées comptent, au poids de leur charge. L'avancement déclaré d'une tâche (paliers 0 à 100 %)
    /// reste une indication sur la tâche : il n'entre dans aucun pourcentage de groupe. Jamais déduit du consommé.
    /// </summary>
    internal static decimal AvancementValide(IReadOnlyCollection<TacheCalculee> liste)
    {
        var prevu = liste.Sum(t => t.Charge);
        return prevu != 0 ? liste.Where(t => !t.Annulee && t.Statut == ReferentielsMetier.StatutValide).Sum(t => t.Charge) / prevu : 0;
    }

    /// <summary>Équivalent de « a || b » en JavaScript pour du texte : b si a est vide.</summary>
    private static string Ou(string? a, string b) => string.IsNullOrEmpty(a) ? b : a;

    /// <summary>Supprime les doublons en gardant l'ordre d'apparition.</summary>
    private static List<string> Distinct(IEnumerable<string> valeurs)
    {
        var vus = new HashSet<string>();
        var liste = new List<string>();
        foreach (var v in valeurs) if (vus.Add(v)) liste.Add(v);
        return liste;
    }

    /// <summary>Entité d'un profil telle que les formules du TSP la comparent (majuscules, sans espaces autour).</summary>
    private static string EntiteNormalisee(string? entite) => (entite ?? "").Trim().ToUpperInvariant();
}
