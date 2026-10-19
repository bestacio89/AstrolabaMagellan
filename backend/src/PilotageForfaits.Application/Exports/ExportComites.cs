using System.Globalization;
using PilotageForfaits.Application.Suivi;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using static PilotageForfaits.Application.Exports.C;

namespace PilotageForfaits.Application.Exports;

/// <summary>
/// Supports de comité au format Excel : COPIL (trajectoire du forfait, finances, atterrissage) et
/// COPROJ (activité depuis le dernier comité, plan d'action, charge de l'équipe).
/// Traduction fidèle de buildCopil et buildCoproj de la version de référence (POC v65) : mêmes onglets, mêmes colonnes, mêmes textes.
/// </summary>
public static class ExportComites
{
    private static readonly CultureInfo Fr = CultureInfo.GetCultureInfo("fr-FR");

    // ------------------------------------------------------------------ outils communs

    /// <summary>Accès commodes au projet et aux indicateurs.</summary>
    private sealed class Vue
    {
        public required ProjetVueDto P { get; init; }
        public required ResultatCalcul M { get; init; }
        public required DateOnly Aujourdhui { get; init; }
        public List<ActionVueDto> Actions => P.Actions.Where(a => !string.IsNullOrWhiteSpace(a.Libelle)).ToList();
        public List<DecisionVueDto> Decisions => P.Decisions.Where(d => !string.IsNullOrWhiteSpace(d.Libelle)).ToList();
        public List<RisqueVueDto> Risques => P.Risques.Where(r => !string.IsNullOrWhiteSpace(r.Libelle)).ToList();
        public List<RisqueVueDto> RisquesOuverts => Risques.Where(r => r.Statut is "Ouvert" or "Survenu").ToList();
        public List<RisqueVueDto> RisquesForts => RisquesOuverts.Where(r => r.Niveau == "fort").ToList();
        public SuiviTacheVueDto Tr(string uid) => P.Track.TryGetValue(uid, out var s) ? s : new SuiviTacheVueDto();
        public string LibelleTache(string? uid) => uid is null ? "" : M.Tasks.FirstOrDefault(t => t.Uid == uid)?.Label ?? "";
        public string? NomGroupeOuNull(string grp) => M.Axes.FirstOrDefault(a => a.Id == grp)?.Nom;
        public string NomGroupe(TacheCalculee t) => Ou(NomGroupeOuNull(t.Grp), "Sans " + M.Dim.Label.ToLowerInvariant());
        public string NomType(string id) => P.Types.FirstOrDefault(x => x.Id == id)?.Nom ?? "";
        public string Profil(int i) => i >= 0 && i < M.P.Count ? M.P[i].Nom : "";
        /// <summary>Consommé d'un profil sur une tâche entre deux dates (incluses).</summary>
        public decimal ConsoEntre(string uid, int i, Func<string, bool> retenir)
        {
            var cp = Tr(uid).ConsoP;
            if (cp is null || !cp.TryGetValue(i, out var jours)) return 0;
            return jours.Where(x => retenir(x.Key)).Sum(x => x.Value);
        }
    }

    private static string Ou(string? a, string b) => string.IsNullOrEmpty(a) ? b : a;
    private static string FmtJ(decimal v) => Texte.Jh(v);
    private static string FmtE(decimal v) => Texte.Euros(v);
    private static string FmtP(decimal? v) => v is null ? "—" : (v.Value * 100).ToString("0.#", Fr) + " %";
    private static string Iso(DateOnly d) => Calendrier.Iso(d);
    private static DateOnly? Derniere(List<DateOnly> l) => l.Count > 0 ? l[^1] : null;
    private static DateOnly? Premiere(List<DateOnly> l) => l.Count > 0 ? l[0] : null;

    /// <summary>Tâche planifiée : dates prévues saisies (pour un livrable, la date de livraison suffit).</summary>
    private static bool Planifiee(TacheCalculee t, SuiviTacheVueDto tr) =>
        t.Type == ReferentielsMetier.TypeLivrable ? tr.Fin is not null : tr.Debut is not null && tr.Fin is not null;

    /// <summary>Invitation d'un atelier, comme à l'écran : envoyée (date) · à envoyer (date fixée) · « — ».</summary>
    private static string Invitation(TacheCalculee t, AtelierVueDto? at) =>
        at?.Invit == true ? $"Envoyée le {D(at.InvitLe)}"
        : t.Statut == ReferentielsMetier.StatutValide || t.Annulee || at?.Date is null ? "—" : "À envoyer";

    private static string Horaire(AtelierVueDto? at) =>
        at?.HeureDebut is { Length: > 0 } hd ? " " + hd + (at.HeureFin is { Length: > 0 } hf ? "–" + hf : "") : "";

    private static object VigCellule(PointVigilance v) => v.Valeur switch
    {
        decimal d => v.Unite == "€" ? Eur(d) : v.Unite == "JH" ? Jh(d) : d,
        int n => v.Unite == "€" ? Eur(n) : v.Unite == "JH" ? Jh(n) : n,
        _ => Convert.ToString(v.Valeur, Fr) ?? "",
    };

    private static readonly string[] EnteteRisques = ["Réf.", "Risque", "Probabilité", "Impact", "Criticité", "Parade", "Responsable", "Statut", "Action liée", "Commentaire"];

    private static List<object?> LigneRisque(Vue v, RisqueVueDto r) => L(
        r.Ref, r.Libelle, Ou(r.Proba, ReferentielsMetier.RisqueProbaParDefaut), Ou(r.Impact, ReferentielsMetier.RisqueImpactParDefaut),
        $"{r.Crit} — {ReferentielsMetier.NiveauRisque(r.Crit)}",
        r.Parade, r.Responsable, Ou(r.Statut, "Ouvert"), v.Actions.FirstOrDefault(a => a.Id == r.Action)?.Ref ?? "", r.Commentaire);

    /// <summary>Bloc « Achats et frais » (budget, réel, atterrissage, marge nette) ; « retenir » filtre les lignes détaillées.</summary>
    private static IEnumerable<List<object?>> AchatsFrais(Vue v, Func<DateOnly, bool>? retenir, string quand)
    {
        var A = v.M.Financier.Achats;
        var F = v.M.Financier.Frais;
        var fin = v.M.Financier;
        bool Ok(DateOnly d) => retenir is null || retenir(d);
        var achats = v.P.AchatsReel.Where(a => Ok(a.Date)).ToList();
        var frais = v.P.FraisReel.Where(x => Ok(x.Date)).ToList();
        var lignes = new List<List<object?>>
        {
            L(T("Achats et frais — budget du TSP, réel et atterrissage (HT)")),
            L("Achats : atterrissage = le plus élevé du budget et du réel pour chaque ligne du TSP, plus les achats hors TSP. Frais : refacturables et à notre charge comptés à part ; un frais non refacturé au-delà de la part prévue à notre charge réduit la marge."),
            Vide(),
            L(H(""), H("Budget TSP"), H("Réel saisi"), H("Reste à engager"), H("Atterrissage"), H("Écart"), H("Refacturé (atterrissage)")),
            L("Achats", Eur(A.Budget), Eur(A.Reel), Eur(A.Reste), Eur(A.Att), Eur(A.Depasse), Eur(A.AttRev)),
            L("Frais", Eur(F.Budget), Eur(F.Reel), Eur(F.Reste), Eur(F.Att), Eur(F.Depasse), Eur(F.AttRef)),
            Vide(),
            L(H("Marge nette vendue (TSP)"), H("Taux"), H("Marge nette à l’atterrissage"), H("Taux")),
            L(Eur(fin.MargeNetteVendue), Pct(fin.TauxMargeNetteVendue), Eur(fin.MargeNette), Pct(fin.TauxMargeNette)),
            Vide(),
            L(Sec($"ACHATS {quand}")),
            L(H("Date"), H("Désignation"), H("Fournisseur"), H("Ligne du TSP"), H("Statut"), H("Montant HT"), H("Refacturé"), H("Par"), H("Commentaire")),
        };
        lignes.AddRange(achats.Select(a => L(D(a.Date), a.Designation, a.Fournisseur,
            a.Ligne is { } i && i >= 0 && i < v.P.Achats.Count ? v.P.Achats[i].Designation : "Hors TSP", Ou(a.Statut, "Commandé"),
            EurC(a.Montant), EurC(a.Refacture), a.Par ?? "", a.Commentaire)));
        if (achats.Count == 0) lignes.Add(L("Aucun achat."));
        lignes.Add(Vide());
        lignes.Add(L(Sec($"FRAIS {quand}")));
        lignes.Add(L(H("Date"), H("Libellé"), H("Collaborateur"), H("Catégorie"), H("Refacturable"), H("Montant HT"), H("Refacturé"), H("Par"), H("Commentaire")));
        lignes.AddRange(frais.Select(x => L(D(x.Date), x.Libelle, x.Collaborateur, Ou(x.Categorie, "Autre"), x.Refacturable ? "Oui" : "Non",
            EurC(x.Montant), EurC(x.Refacture), x.Par ?? "", x.Commentaire)));
        if (frais.Count == 0) lignes.Add(L("Aucun frais."));
        return lignes;
    }

    private static readonly Dictionary<string, string> LibellesIa = new()
    {
        ["avenir"] = "À venir", ["encours"] = "En cours", ["totale"] = "Économie totale", ["partielle"] = "Économie partielle",
        ["conforme"] = "Conforme", ["depassement"] = "Dépassement",
    };

    // ------------------------------------------------------------------ COPIL

    public static List<Feuille> Copil(ProjetVueDto projet, ResultatCalcul modele, DateOnly aujourdhui)
    {
        var v = new Vue { P = projet, M = modele, Aujourdhui = aujourdhui };
        var m = modele;
        var f = projet.Fiche;
        var cal = m.Cal;
        var feuilles = new List<Feuille>();
        var moisCourant = Calendrier.Mois(aujourdhui);

        // ---- Tableau de bord ----
        var db = new List<List<object?>>
        {
            L(T($"COPIL — {f.Client} — {f.Projet}")),
            L($"Situation au {D(aujourdhui)}", "", $"Référence : {f.Reference}"),
            L($"Début : {D(cal.Debut)}", $"Fin contractuelle : {D(cal.FinContrat)}", $"Fin prévue : {D(cal.FinPrevue)}",
                cal.GlissementJours is { } g && g != 0 ? $"Glissement : {(g > 0 ? "+" : "")}{g} j" : "",
                cal.TempsPct is { } tp ? $"Temps écoulé : {Texte.Arrondir(tp * 100, 0)} %" : "",
                cal.JoursRestants is { } jr ? $"Jours ouvrés restants : {jr}" : ""),
            Vide(),
            L(Sec("CHARGES (JH)")),
            L(H("Prévu (JH)"), H("dont TSP vendu"), H("dont ajouts"), H("dont annulations"), H("Consommé"), H("RAF retenu"), H("Atterrissage"), H("Écart / prévu"), H("Écart / TSP")),
            L(Jh(m.Total.Prevu), Jh(m.Total.PrevuTSP), Jh(m.Total.Ajout), Jh(-m.Total.Annule), Jh(m.Total.Conso), Jh(m.Total.Raf), Jh(m.Total.Atterrissage),
                Jh(m.Total.Ecart), Jh(m.Total.Atterrissage - m.Total.PrevuTSP)),
            Vide(),
            L(Sec("FINANCIER DU FORFAIT")),
            L(H("CA du forfait"), H("Coût initial (TSP)"), H("Coût des ajouts"), H("Coût annulé"), H("Coût consommé"), H("Coût RAF"), H("Coût à l’atterrissage"),
                H("Marge sur production"), H("Taux"), H("Écart / coût TSP")),
            L(Eur(m.Financier.Ca), Eur(m.Financier.CoutInitial), Eur(m.Financier.CoutAjout), Eur(-m.Perimetre.CoutAnnule), Eur(m.Financier.CoutConso),
                Eur(m.Financier.CoutRaf), Eur(m.Financier.CoutFinal), Eur(m.Financier.Marge), Pct(m.Financier.TauxMarge), Eur(m.Financier.EcartCout)),
            L(H("Achats (atterrissage)"), H("dont budget TSP"), H("Frais (atterrissage)"), H("dont budget TSP"), H("Marge nette vendue"), H("Taux"),
                H("Marge nette à l’atterrissage"), H("Taux")),
            L(Eur(m.Financier.Achats.Att), Eur(m.Financier.Achats.Budget), Eur(m.Financier.Frais.Att), Eur(m.Financier.Frais.Budget),
                Eur(m.Financier.MargeNetteVendue), Pct(m.Financier.TauxMargeNetteVendue), Eur(m.Financier.MargeNette), Pct(m.Financier.TauxMargeNette)),
        };
        if (m.Perimetre.Lignes.Count > 0)
        {
            db.Add(Vide());
            db.Add(L(Sec("ÉVOLUTIONS DU PÉRIMÈTRE (ajouts non facturés, annulations)")));
            db.Add(L(H("Date"), H("Par"), H("Ajout"), H("Tâche"), H("Profil(s)"), H("Charge (JH)"), H("Coût (CJM)"), H("Consommé"), H("Motif")));
            db.AddRange(m.Perimetre.Lignes.Select(l => L(D(l.At), l.By ?? "",
                l.Kind == "tache" ? "Nouvelle tâche" : l.Kind == "annul" ? (l.Avenant ? "Annulation (avenant)" : "Annulation") : l.Kind == "reaff" ? "Réaffectation" : "Profil ajouté",
                l.Label, string.Join(", ", l.Profils), Jh(l.Jh), Eur(l.Cout), Jh(l.Conso), l.Motif ?? "")));
            db.Add(L(Gras("SOLDE (ajouts − annulations)"), "", "", "", "", Jh(m.Perimetre.ChargeAjout - m.Perimetre.ChargeAnnulee, true),
                Eur(m.Perimetre.CoutAjout - m.Perimetre.CoutAnnule, true)));
            db.Add(L($"Marge vendue : {FmtP(m.Perimetre.MargeVendue)}", "", $"Marge avec ajouts : {FmtP(m.Perimetre.MargeAvecAjouts)}"));
        }
        db.Add(Vide());
        db.Add(L(Sec("SUIVI PAR TYPE DE TÂCHE")));
        db.Add(L(H(""), H("Prévus"), H("Réalisés"), H("Restants"), H("Taux")));
        db.AddRange(m.Ateliers.ParType.Select(x => L(x.Nom, x.Prevus, x.Realises, x.Restants, Pct(x.Taux))));
        db.Add(Vide());
        db.Add(L(Sec("ATTERRISSAGE PAR " + m.Dim.Label.ToUpperInvariant())));
        db.Add(L(H(m.Dim.Label), H("Prévu (JH)"), H("Consommé (JH)"), H("RAF (JH)"), H("Atterrissage (JH)"), H("Écart (JH)"), H("Taux consommé"), H("Avancement"),
            H("Début prévu"), H("Fin prévue"), H("Début réel"), H("Fin réelle"), H("Statut des tâches"), H("Projection")));
        db.AddRange(m.Axes.Select(a => L(a.Nom, Jh(a.Prevu), Jh(a.Conso), Jh(a.Raf), Jh(a.Atterrissage), Jh(a.Ecart), Pct(a.Prevu != 0 ? a.Conso / a.Prevu : 0),
            Pct(a.Avancement), D(a.PlanDebut), D(a.PlanFin), D(a.ReelDebut), D(a.ReelFin), a.Statut,
            a.Ecart > 0.001m ? "Dépassement" : a.Ecart < -0.001m ? "Optimisation" : "Conforme")));
        var t0 = m.Total;
        db.Add(L(Gras("PROJET"), Jh(t0.Prevu, true), Jh(t0.Conso, true), Jh(t0.Raf, true), Jh(t0.Atterrissage, true), Jh(t0.Ecart, true),
            Pct(t0.Prevu != 0 ? t0.Conso / t0.Prevu : 0, true), Pct(t0.Avancement, true), D(t0.PrevuDebut), D(t0.PrevuFin), D(t0.ReelDebut), D(t0.ReelFin), "", ""));
        db.Add(Vide());
        db.Add(L(Sec("POINTS DE VIGILANCE")));
        db.Add(L(H("Indicateur"), H("Valeur"), H("Niveau"), H("Détail")));
        db.AddRange(m.Vigilance.Select(x => L(x.Label, VigCellule(x), x.Niveau == "ok" ? "OK" : x.Niveau == "critique" ? "Critique" : "À surveiller", x.Detail ?? "")));
        if (m.Ia.Profil is not null)
        {
            db.Add(Vide());
            db.Add(L(Sec($"OPTIMISATION IA (enveloppe {m.Ia.Profil})")));
            db.Add(L(H("Enveloppe IA (JH)"), H("IA consommée (JH)"), H("Économie réalisée (JH)"), H("Taux d’économie"), H("Valeur préservée (TJM)"), H("Projection à l’atterrissage (JH)")));
            db.Add(L(Jh(m.Ia.Ref), Jh(m.Ia.Consomme), Jh(m.Ia.Realise), Pct(m.Ia.Taux), Eur(m.Ia.ValeurTJM), Jh(m.Ia.Projection)));
        }
        feuilles.Add(new Feuille { Nom = "Tableau de bord", Lignes = db, Colonnes = [34, 14, 14, 14, 16, 16, 14, 14, 12, 12, 12, 12, 18, 16, 14] });

        // ---- Relevé des décisions et actions ouvertes ----
        if (v.Decisions.Count > 0 || v.Actions.Count > 0 || v.Risques.Count > 0)
        {
            var ouvertes = v.Actions.Where(a => a.Statut != "Fait" && a.Statut != "Annulée").ToList();
            var lignes = new List<List<object?>>
            {
                L(T("Relevé des décisions")), Vide(),
                L(H("Réf."), H("Date"), H("Instance"), H("Décision"), H("Décideur"), H("Impact"), H("Statut"), H("Commentaire")),
            };
            lignes.AddRange(v.Decisions.Select(x => L(x.Ref, D(x.Date), x.Instance, x.Libelle, x.Decideur, x.Impact, x.Statut, x.Commentaire)));
            lignes.Add(Vide());
            lignes.Add(L(Sec($"ACTIONS OUVERTES ({ouvertes.Count})")));
            lignes.Add(L(H("Réf."), H("Date cible"), H("Instance"), H("Action"), H("Responsable"), H("Progression"), H("Statut"), H("Commentaire"), H("Tâche concernée")));
            lignes.AddRange(ouvertes.Select(a => L(a.Ref, D(a.Echeance), a.Origine, a.Libelle, a.Porteur, Pct(a.Progression),
                a.Statut + (a.Echeance is { } e && e < aujourdhui ? " — EN RETARD" : ""), a.Commentaire, v.LibelleTache(a.Tache))));
            lignes.Add(Vide());
            lignes.Add(L(Sec($"RISQUES OUVERTS ({v.RisquesOuverts.Count})")));
            lignes.Add(EnteteRisques.Select(x => (object?)H(x)).ToList());
            if (v.RisquesOuverts.Count > 0) lignes.AddRange(v.RisquesOuverts.OrderByDescending(r => r.Crit).Select(r => LigneRisque(v, r)));
            else lignes.Add(L("Aucun risque ouvert."));
            feuilles.Add(new Feuille { Nom = "Décisions & actions", Lignes = lignes, Colonnes = [9, 12, 14, 56, 22, 14, 14, 40, 12, 40] });
        }

        // ---- Charges mensuelles ----
        var mens = new List<List<object?>>
        {
            L(T("Charges mensuelles (JH) — consommé réel et référence initiale")), Vide(),
            L(H("Mois"), H("Consommé réel"), H("Référence initiale (planning de charge)"), H("Coût interne (CJM)"), H("Coût cumulé"), H("Valeur produite (TJM)"), H("Valeur produite cumulée")),
        };
        // séries réelles arrêtées au mois en cours (un mois futur n'a pas de consommé)
        mens.AddRange(m.Mensuel.Select(x =>
        {
            var futur = string.CompareOrdinal(x.Mois, moisCourant) > 0;
            return L(Mois(x.Mois), futur ? "" : Jh(x.Conso), Jh(x.Ref), futur ? "" : Eur(x.CoutCJM), futur ? "" : Eur(x.CumCJM), futur ? "" : Eur(x.ValoTJM), futur ? "" : Eur(x.CumTJM));
        }));
        mens.Add(Vide());
        mens.Add(L(Sec("Consommé par profil (JH)")));
        var enteteMois = new List<object?> { H("Profil") };
        enteteMois.AddRange(m.Months.Select(mk => (object?)H(Mois(mk))));
        enteteMois.Add(H("Total"));
        mens.Add(enteteMois);
        for (var i = 0; i < m.P.Count; i++)
        {
            if (string.IsNullOrEmpty(m.P[i].Nom)) continue;
            var ligne = new List<object?> { m.P[i].Nom };
            var k = i;
            ligne.AddRange(m.Mensuel.Select(x => string.CompareOrdinal(x.Mois, moisCourant) > 0 ? (object?)"" : Jh(x.ConsoP[k])));
            ligne.Add(Jh(m.Mensuel.Sum(x => x.ConsoP[k]), true));
            mens.Add(ligne);
        }
        var colonnesMens = new List<double> { 26 };
        colonnesMens.AddRange(m.Months.Select(_ => 12d));
        colonnesMens.Add(12);
        feuilles.Add(new Feuille { Nom = "Charges mensuelles", Lignes = mens, Colonnes = colonnesMens });

        // ---- Ateliers & livrables ----
        var ateliers = new List<List<object?>>
        {
            L(T("Registre des ateliers & livrables")), Vide(),
            L(H(m.Dim.Label), H("Lot"), H("Type"), H("Intitulé"), H("Prévu (JH)"), H("Date planifiée"), H("Invitation"), H("Destinataires"), H("Réalisé / livré le"),
                H("Validé client le"), H("Début prévu"), H("Fin prévue"), H("Profil principal"), H("Statut"), H("Avancement"), H("Consommé"), H("RAF"), H("Commentaire")),
        };
        foreach (var t in m.Tasks.Where(x => x.Type.Length > 0))
        {
            var tr = v.Tr(t.Uid);
            var at = tr.Atelier;
            ateliers.Add(L(Ou(v.NomGroupeOuNull(t.Grp), t.Grp), t.Lot, v.NomType(t.Type), t.Label, Jh(t.Charge),
                at?.Date is { } da ? D(da) + Horaire(at) : "", t.Type == ReferentielsMetier.TypeAtelier ? Invitation(t, at) : "",
                string.Join("; ", at?.Dest ?? new List<string>()), D(t.RealiseLe), t.RealiseLe is not null ? D(tr.Livr?.ValideLe) : "",
                D(tr.Debut), D(tr.Fin), t.Responsable, t.Statut, t.Annulee ? "" : Pct(t.Avancement), Jh(t.ConsoTotal), Jh(t.Raf), t.Commentaire));
        }
        feuilles.Add(new Feuille { Nom = "Ateliers & livrables", Lignes = ateliers, Colonnes = [22, 8, 10, 60, 10, 16, 18, 40, 12, 14, 12, 12, 24, 18, 12, 12, 10, 40] });

        // ---- Suivi des tâches ----
        var suivi = new List<List<object?>>
        {
            L(T("Suivi détaillé des tâches")), Vide(),
            L(H(m.Dim.Label), H("Lot"), H("Phase"), H("Tâche"), H("Origine"), H("Prévu (JH)"), H("dont ajout"), H("Statut"), H("Avancement"), H("Début prévu"), H("Fin prévue"),
                H("Début réel"), H("Fin réelle"), H("Consommé"), H("RAF"), H("Atterrissage"), H("Écart"), H("Commentaire")),
        };
        foreach (var t in m.Tasks)
        {
            var tr = v.Tr(t.Uid);
            suivi.Add(L(v.NomGroupe(t), t.Lot, t.Phase, t.Label, t.EstAjout ? "Ajoutée" : "TSP", Jh(t.Charge), t.ChargeAjout != 0 ? Jh(t.ChargeAjout) : "",
                t.Statut, t.Annulee ? "" : Pct(t.Avancement), D(tr.Debut), D(tr.Fin), D(Premiere(t.ConsoDates)), D(Derniere(t.ConsoDates)),
                Jh(t.ConsoTotal), Jh(t.Raf), Jh(t.Atterrissage), Jh(t.Ecart), t.Commentaire));
        }
        feuilles.Add(new Feuille { Nom = "Suivi des tâches", Lignes = suivi, Colonnes = [22, 8, 14, 60, 10, 10, 10, 18, 10, 12, 12, 12, 12, 10, 10, 10, 10, 40] });

        // ---- Consommé détaillé par profil ----
        var detail = new List<List<object?>>
        {
            L(T("Consommé détaillé par tâche et par profil")), Vide(),
            L(H(m.Dim.Label), H("Tâche"), H("Profil"), H("Charge (JH)"), H("dont ajout"), H("Consommé (JH)"), H("Reste (JH)"), H("% consommé")),
        };
        foreach (var t in m.Tasks)
            for (var i = 0; i < t.Charges.Count; i++)
            {
                var c = t.Charges[i];
                if (!(c > 0 || t.ConsoP[i] > 0)) continue;
                var ajoute = i < projet.Profiles.Count && projet.Profiles[i].Ajout is not null;
                detail.Add(L(v.NomGroupe(t), t.Label, v.Profil(i) + (ajoute ? " (profil ajouté)" : ""), Jh(c), t.ChargesA[i] != 0 ? Jh(t.ChargesA[i]) : "",
                    Jh(t.ConsoP[i]), Jh(t.RestP[i]), c != 0 ? Pct(t.ConsoP[i] / c) : ""));
            }
        feuilles.Add(new Feuille { Nom = "Consommé par profil", Lignes = detail, Colonnes = [22, 60, 28, 12, 10, 12, 12, 12] });

        // ---- Planning (Gantt simplifié : une colonne par mois) ----
        var planning = new List<List<object?>> { L(T("Planning — ■ mois prévus · ● mois consommés hors de la période prévue")), Vide() };
        var entetePlanning = new List<object?> { H(m.Dim.Label), H("Tâche"), H("Début prévu"), H("Fin prévue"), H("Statut") };
        entetePlanning.AddRange(m.Months.Select(mk => (object?)H(Mois(mk))));
        planning.Add(entetePlanning);
        foreach (var t in m.Tasks)
        {
            var tr = v.Tr(t.Uid);
            var ligne = new List<object?> { v.NomGroupe(t), t.Label, D(tr.Debut), D(tr.Fin), t.Statut };
            foreach (var mk in m.Months)
            {
                var prevu = Planifiee(t, tr) && string.CompareOrdinal(Calendrier.Mois((tr.Debut ?? tr.Fin)!.Value), mk) <= 0
                    && string.CompareOrdinal(Calendrier.Mois(tr.Fin!.Value), mk) >= 0;
                ligne.Add(prevu ? "■" : t.ConsoDates.Any(x => Calendrier.Mois(x) == mk) ? "●" : "");
            }
            planning.Add(ligne);
        }
        var colonnesPlanning = new List<double> { 22, 60, 12, 12, 16 };
        colonnesPlanning.AddRange(m.Months.Select(_ => 9d));
        feuilles.Add(new Feuille { Nom = "Planning", Lignes = planning, Colonnes = colonnesPlanning });

        // ---- Facturation ----
        var es = m.EchSynth;
        var facturation = new List<List<object?>>
        {
            L(T("Facturation & vision FAE")),
            L($"Facturé : {FmtE(es.Facture)} · payé : {FmtE(es.Paye)} · reste à facturer : {FmtE(es.Reste)} · FAE à date : {FmtE(es.FaeADate)}" +
                (Math.Abs(es.AjustAvenant) > 0.5m ? $" · avenant réparti sur les échéances non facturées : {FmtE(es.AjustAvenant)}" : "")),
            Vide(),
            L(H("N°"), H("Échéance"), H("%"), H("Mois du TSP"), H("Date prévue"), H("Facturée le"), H("Payée le"), H("Statut"), H("Périmètre lié"), H("Avancement lié"),
                H("Montant"), H("Facturé cumulé prévu"), H("Valeur produite prévue (cumul)"), H("FAE prévue"), H("FAE prévue (%)"), H("Facturé réel (cumul)"),
                H("Valeur produite réelle (cumul)"), H("FAE réelle"), H("FAE réelle (%)")),
        };
        facturation.AddRange(m.Echeancier.Select(e => L(e.N, e.Nom, Pct(e.Pct), e.MoisTSP is null ? "" : Mois(e.MoisTSP), D(e.DatePrevue), D(e.RealiseLe), D(e.PayeeLe),
            e.Statut + (e.ApresFin ? " (après la fin du projet)" : ""), PerimetreLie(e, false), Pct(e.AvLie), Eur(e.Montant), Eur(e.FactCum),
            e.ProdPlan is null ? "" : Eur(e.ProdPlan), e.FaePlan is null ? "" : Eur(e.FaePlan), e.FaePlanPct is null ? "" : Pct(e.FaePlanPct),
            e.FactReel is null ? "" : Eur(e.FactReel), e.ProdReel is null ? "" : Eur(e.ProdReel), e.FaeReel is null ? "" : Eur(e.FaeReel),
            e.FaeReelPct is null ? "" : Pct(e.FaeReelPct))));
        feuilles.Add(new Feuille { Nom = "Facturation", Lignes = facturation, Colonnes = [6, 60, 8, 12, 12, 12, 14, 30, 12, 14, 16, 18, 16, 18, 12, 16, 18, 16, 12] });

        // ---- Achats & frais (toutes les lignes) ----
        var A = m.Financier.Achats;
        var F = m.Financier.Frais;
        if (A.Budget != 0 || projet.AchatsReel.Count > 0 || F.Budget != 0 || projet.FraisReel.Count > 0)
            feuilles.Add(new Feuille { Nom = "Achats & frais", Lignes = AchatsFrais(v, null, "SAISIS").ToList(), Colonnes = [14, 40, 22, 22, 14, 14, 14, 14, 30] });

        // ---- Optimisation IA : enveloppe Agent IA, résultat constaté et justification par tâche ----
        if (m.Ia.Profil is not null && m.Ia.Tasks.Count > 0)
        {
            var ia = new List<List<object?>>
            {
                L(T($"Optimisation IA — enveloppe « {m.Ia.Profil} » (réserve adossée aux profils de chaque tâche)")), Vide(),
                L(H("Enveloppe IA (JH)"), H("IA consommée (JH)"), H("Économie réalisée (JH)"), H("Taux d’économie"), H("Valeur préservée (TJM)"), H("Coût évité (CJM)"),
                    H("Projection (JH)"), H("À justifier")),
                L(Jh(m.Ia.Ref), Jh(m.Ia.Consomme), Jh(m.Ia.Realise), Pct(m.Ia.Taux), Eur(m.Ia.ValeurTJM), Eur(m.Ia.ValeurCJM), Jh(m.Ia.Projection), m.Ia.AJustifier.Count),
                Vide(), L(Sec("Résultat par type (tâches validées)")), L(H("Type"), H("Sens"), H("Tâches"), H("JH")),
            };
            ia.AddRange(m.Ia.ParType.Select(x => L(x.Type, x.Sens == "eco" ? "Économie" : "Dépassement", x.N, Jh(x.Jh))));
            ia.Add(Vide());
            ia.Add(L(Sec("Détail par tâche")));
            ia.Add(L(H(m.Dim.Label), H("Tâche"), H("Statut"), H("Enveloppe IA"), H("IA consommée"), H("Résultat (JH)"), H("Statut IA"), H("Type"), H("Commentaire")));
            foreach (var uid in m.Ia.Tasks)
            {
                var t = m.Tasks.First(x => x.Uid == uid);
                ia.Add(L(v.NomGroupeOuNull(t.Grp) ?? "", t.Label, t.Statut, Jh(t.Ia), Jh(t.IaConso), Jh(t.IaRes),
                    (t.IaStatut is not null && LibellesIa.TryGetValue(t.IaStatut, out var lib) ? lib : "") + (t.IaAJustifier ? " — À JUSTIFIER" : ""), t.IaType, t.IaJustif));
            }
            feuilles.Add(new Feuille { Nom = "Optimisation IA", Lignes = ia, Colonnes = [22, 60, 16, 12, 12, 12, 12, 18, 34, 60] });
        }

        // ---- Historique des indicateurs (une photo par comité) ----
        if (projet.Historique.Count > 0)
        {
            var hist = new List<List<object?>>
            {
                L(T("Évolution des indicateurs d’un comité à l’autre")), Vide(),
                L(H("Date"), H("Comité"), H("Prévu (JH)"), H("Consommé (JH)"), H("Atterrissage (JH)"), H("Coût à l’atterrissage"), H("Marge sur production"),
                    H("Marge nette"), H("Taux net"), H("Fin prévue")),
            };
            hist.AddRange(projet.Historique.Select(h => L(D(h.Date), h.Kind, Jh(h.Prevu), Jh(h.Conso), Jh(h.Atterrissage), Eur(h.CoutFinal), Eur(h.Marge),
                Eur(h.MargeNette), Pct(h.TauxMargeNette), D(h.FinPrevue))));
            feuilles.Add(new Feuille { Nom = "Historique", Lignes = hist, Colonnes = [12, 10, 12, 12, 12, 14, 14, 14, 12, 14, 18] });
        }
        return feuilles;
    }

    /// <summary>Périmètre lié d'une échéance : « Phases : … · n tâche(s)[, m validée(s)] ».</summary>
    private static string PerimetreLie(EcheanceCalculee e, bool court)
    {
        var morceaux = new List<string>();
        if (e.Phases.Count > 0) morceaux.Add("Phases : " + string.Join(", ", e.Phases));
        if (e.NLies > 0) morceaux.Add(court ? $"{e.NLies} tâche(s)" : $"{e.NLies} tâche(s), {e.NLiesValides} validée(s)");
        return string.Join(" · ", morceaux);
    }

    // ------------------------------------------------------------------ COPROJ

    /// <summary>
    /// COPROJ : ce qui s'est passé depuis le dernier comité (du … au …) et ce qui arrive dans les prochaines semaines (horizon en jours).
    /// </summary>
    public static List<Feuille> Coproj(ProjetVueDto projet, ResultatCalcul modele, DateOnly du, DateOnly au, int horizon, DateOnly aujourdhui)
    {
        var v = new Vue { P = projet, M = modele, Aujourdhui = aujourdhui };
        var m = modele;
        var f = projet.Fiche;
        var fin = au.AddDays(horizon);
        bool DansPeriode(DateOnly? d) => d is not null && d >= du && d <= au;
        bool DansPeriodeIso(string jour) => string.CompareOrdinal(jour, Iso(du)) >= 0 && string.CompareOrdinal(jour, Iso(au)) <= 0;
        var P = m.P;
        var taches = m.Tasks;

        // consommé de la période, par tâche et par profil
        var periode = taches.Select(t =>
        {
            var parProfil = Enumerable.Range(0, P.Count).Select(i => v.ConsoEntre(t.Uid, i, DansPeriodeIso)).ToList();
            return (t, parProfil, total: parProfil.Sum());
        }).ToList();
        var consoPeriode = periode.Sum(x => x.total);
        DateOnly? ValideeLe(TacheCalculee t) => v.Tr(t.Uid).ValideLe ?? (t.Statut == ReferentielsMetier.StatutValide ? Derniere(t.ConsoDates) : null);
        var validees = taches.Where(t => t.Statut == ReferentielsMetier.StatutValide && DansPeriode(ValideeLe(t))).ToList();
        var demarrees = taches.Where(t => DansPeriode(Premiere(t.ConsoDates))).ToList();
        var nonValidees = taches.Where(t => t.Statut != ReferentielsMetier.StatutValide && !t.Annulee).ToList();
        var retardFin = nonValidees.Where(t => v.Tr(t.Uid).Fin is { } fn && fn < au).ToList();
        var retardDebut = nonValidees.Where(t => !(t.ConsoTotal != 0) && v.Tr(t.Uid).Debut is { } dd && dd < au && !retardFin.Contains(t)).ToList();
        var bloquees = nonValidees.Where(t => t.Statut == ReferentielsMetier.StatutBloque).ToList();
        var aDemarrer = nonValidees.Where(t => !(t.ConsoTotal != 0) && v.Tr(t.Uid).Debut is { } dd && dd >= au && dd <= fin).ToList();
        var aTerminer = nonValidees.Where(t => v.Tr(t.Uid).Fin is { } fn && fn >= au && fn <= fin).ToList();
        var reestimer = taches.Where(t => t.RafAReestimer).ToList();
        var depassement = taches.Where(t => t.ConsoTotal > t.Charge + 0.000000001m).ToList();
        var ajouts = m.Perimetre.Lignes.Where(l => l.At is { Length: >= 10 } at && DansPeriodeIso(at[..10])).ToList();
        string Evolutions(List<LignePerimetre> ls)
        {
            var aj = ls.Where(l => l.Kind != "annul" && l.Kind != "reaff").ToList();
            var an = ls.Where(l => l.Kind == "annul").ToList();
            var re = ls.Where(l => l.Kind == "reaff").ToList();
            string S(List<LignePerimetre> l0) => FmtJ(l0.Sum(l => Math.Abs(l.Jh)));
            var parts = new List<string>();
            if (aj.Count > 0) parts.Add($"{aj.Count} ajout(s) (+{S(aj)} JH)");
            if (an.Count > 0) parts.Add($"{an.Count} annulation(s) (−{S(an)} JH)");
            if (re.Count > 0) parts.Add($"{re.Count} réaffectation(s) ({S(re)} JH déplacés, total inchangé)");
            return parts.Count > 0 ? string.Join(", ", parts) : "aucune";
        }
        var t0 = m.Total;
        var c = m.Cal;
        var actions = v.Actions;
        var decisions = v.Decisions;
        var actionsOuvertes = actions.Where(a => a.Statut != "Fait" && a.Statut != "Annulée").ToList();
        var actionsRetard = actionsOuvertes.Where(a => a.Echeance is { } e && e < au).ToList();
        var feuilles = new List<Feuille>();

        // ---- 1. Synthèse ----
        var syn = new List<List<object?>>
        {
            L(T($"COPROJ — {f.Client} — {f.Projet}")),
            L($"Période couverte : du {D(du)} au {D(au)}", "", $"Horizon : jusqu’au {D(fin)} ({Math.Round(horizon / 7m, MidpointRounding.AwayFromZero)} semaine(s))", "", $"Référence : {f.Reference}"),
            Vide(),
            L(Sec("OÙ EN EST-ON ?")),
            L(H("Avancement global"), H("Temps écoulé"), H("Charge consommée"), H("Consommé (JH)"), H("Prévu (JH)"), H("RAF (JH)"), H("Atterrissage (JH)"), H("Écart (JH)"),
                H("Fin prévue"), H("Jours ouvrés restants")),
            L(Pct(t0.Avancement), Pct(c.TempsPct), Pct(c.ConsoPct), Jh(t0.Conso), Jh(t0.Prevu), Jh(t0.Raf), Jh(t0.Atterrissage), Jh(t0.Ecart), D(c.FinPrevue),
                c.JoursRestants is { } jr ? (object)jr : ""),
            Vide(),
            L(Sec("DEPUIS LE DERNIER COMITÉ")),
            L(H("Consommé sur la période"), H("Tâches démarrées"), H("Tâches validées"), H("Ateliers / livrables validés"), H("Évolutions du périmètre")),
            L(Jh(consoPeriode), demarrees.Count, validees.Count, validees.Count(t => t.Type.Length > 0), Evolutions(ajouts)),
            Vide(),
            L(Sec("À TRAITER EN COMITÉ")),
            L(H("En retard (fin dépassée)"), H("Démarrage en retard"), H("Bloquées / en attente"), H("RAF à réestimer"), H("En dépassement"), H($"À démarrer d’ici le {D(fin)}"),
                H($"À terminer d’ici le {D(fin)}"), H("Actions ouvertes"), H("dont en retard"), H("Décisions à valider"), H("Risques forts ouverts")),
            L(retardFin.Count, retardDebut.Count, bloquees.Count, reestimer.Count, depassement.Count, aDemarrer.Count, aTerminer.Count, actionsOuvertes.Count,
                actionsRetard.Count, decisions.Count(x => x.Statut == "À valider"), m.Risques.Count(r => r.Ouvert && r.Niveau == "fort")),
            Vide(),
            L(Sec($"AVANCEMENT PAR {m.Dim.Label.ToUpperInvariant()}")),
            L(H(m.Dim.Label), H("Statut des tâches"), H("Avancement"), H("Consommé période"), H("Consommé total"), H("Prévu"), H("RAF"), H("Écart"), H("Début prévu"), H("Fin prévue")),
        };
        syn.AddRange(m.Axes.Select(a => L(a.Nom, a.Statut, Pct(a.Avancement), Jh(periode.Where(x => x.t.Grp == a.Id).Sum(x => x.total)), Jh(a.Conso), Jh(a.Prevu),
            Jh(a.Raf), Jh(a.Ecart), D(a.PlanDebut), D(a.PlanFin))));
        syn.Add(Vide());
        syn.Add(L(Sec("POINTS DE VIGILANCE")));
        syn.Add(L(H("Indicateur"), H("Valeur"), H("Niveau"), H("Détail")));
        syn.AddRange(m.Vigilance.Where(x => x.Niveau != "ok").Select(x => L(x.Label, VigCellule(x), x.Niveau == "critique" ? "Critique" : "À surveiller", x.Detail ?? "")));
        feuilles.Add(new Feuille { Nom = "Synthèse COPROJ", Lignes = syn, Colonnes = [26, 16, 16, 16, 16, 16, 16, 14, 14, 16] });

        // ---- 2. Plan d'action : la feuille de travail du comité ----
        var categories = new List<(string Nom, List<TacheCalculee> Liste)>
        {
            ("En retard (fin prévue dépassée)", retardFin), ("Démarrage en retard", retardDebut), ("Bloquée / en attente", bloquees),
            ("RAF à réestimer", reestimer), ("En dépassement", depassement), ($"À démarrer d’ici le {D(fin)}", aDemarrer), ($"À terminer d’ici le {D(fin)}", aTerminer),
        };
        // une ligne par tâche ; si elle relève de plusieurs points, les motifs sont regroupés (« En retard · RAF à réestimer »)
        var parTache = new List<(TacheCalculee T, List<string> Motifs)>();
        foreach (var (nom, liste) in categories)
            foreach (var t in liste)
            {
                var i = parTache.FindIndex(x => x.T.Uid == t.Uid);
                if (i >= 0) { if (!parTache[i].Motifs.Contains(nom)) parTache[i].Motifs.Add(nom); }
                else parTache.Add((t, new List<string> { nom }));
            }
        var plan = new List<List<object?>>
        {
            L(T("Plan d’action — tâches à traiter en comité")), L("Les deux dernières colonnes sont à compléter pendant la réunion."), Vide(),
            L(H("Point"), H(m.Dim.Label), H("Tâche"), H("Profil principal"), H("Statut"), H("Avancement"), H("Début prévu"), H("Fin prévue"), H("Consommé"), H("RAF"),
                H("Commentaire"), H("Action / décision"), H("Date cible")),
        };
        if (parTache.Count > 0)
            plan.AddRange(parTache.Select(x =>
            {
                var tr = v.Tr(x.T.Uid);
                return L(string.Join(" · ", x.Motifs), v.NomGroupe(x.T), x.T.Label, x.T.Responsable, x.T.Statut, x.T.Annulee ? "" : Pct(x.T.Avancement),
                    D(tr.Debut), D(tr.Fin), Jh(x.T.ConsoTotal), Jh(x.T.Raf), x.T.Commentaire, "", "");
            }));
        else plan.Add(L("Aucun point bloquant ni date cible sur la période."));
        feuilles.Add(new Feuille { Nom = "Plan d’action", Lignes = plan, Colonnes = [30, 22, 56, 22, 18, 11, 12, 12, 11, 10, 40, 30, 16] });

        // ---- 2 bis. Actions et décisions ----
        var actionsTriees = actionsOuvertes.OrderBy(a => a.Echeance is null ? "9" : Iso(a.Echeance.Value), StringComparer.Ordinal).ToList();
        actionsTriees.AddRange(actions.Where(a => a.Statut == "Fait" && DansPeriode(a.FaitLe)));
        var feuilleActions = new List<List<object?>>
        {
            L(T("Suivi des actions")),
            L($"{actionsOuvertes.Count} action(s) ouverte(s), dont {actionsRetard.Count} en retard · actions soldées sur la période en fin de liste."), Vide(),
            L(H("Réf."), H("Action"), H("Responsable"), H("Instance"), H("Créée le"), H("Date cible"), H("Progression"), H("Statut"), H("Faite le"), H("Commentaire"), H("Tâche concernée")),
        };
        if (actionsTriees.Count > 0)
            feuilleActions.AddRange(actionsTriees.Select(a => L(a.Ref, a.Libelle, a.Porteur, a.Origine, D(a.Cree), D(a.Echeance), Pct(a.Progression),
                a.Statut + (a.Statut != "Fait" && a.Statut != "Annulée" && a.Echeance is { } e && e < au ? " — EN RETARD" : ""), D(a.FaitLe), a.Commentaire,
                v.LibelleTache(a.Tache))));
        else feuilleActions.Add(L("Aucune action ouverte."));
        feuilles.Add(new Feuille { Nom = "Actions", Lignes = feuilleActions, Colonnes = [9, 56, 22, 14, 12, 12, 12, 22, 12, 40, 40] });

        var decisionsRetenues = decisions.Where(x => DansPeriode(x.Date) || x.Statut == "À valider").ToList();
        var feuilleDecisions = new List<List<object?>>
        {
            L(T("Relevé des décisions")), L("Décisions prises sur la période et décisions encore à valider."), Vide(),
            L(H("Réf."), H("Date"), H("Instance"), H("Décision"), H("Décideur"), H("Impact"), H("Statut"), H("Commentaire")),
        };
        if (decisionsRetenues.Count > 0)
            feuilleDecisions.AddRange(decisionsRetenues.Select(x => L(x.Ref, D(x.Date), x.Instance, x.Libelle, x.Decideur, x.Impact, x.Statut, x.Commentaire)));
        else feuilleDecisions.Add(L("Aucune décision sur la période."));
        feuilles.Add(new Feuille { Nom = "Décisions", Lignes = feuilleDecisions, Colonnes = [9, 12, 14, 56, 22, 14, 14, 40] });

        // ---- 2 bis b. Risques ouverts ----
        if (v.Risques.Count > 0)
        {
            var risques = new List<List<object?>>
            {
                L(T("Registre des risques")),
                L($"{v.RisquesOuverts.Count} risque(s) ouvert(s), dont {v.RisquesForts.Count} fort(s) (criticité ≥ 8 sur 16)."), Vide(),
                EnteteRisques.Select(x => (object?)H(x)).ToList(),
            };
            if (v.RisquesOuverts.Count > 0) risques.AddRange(v.RisquesOuverts.OrderByDescending(r => r.Crit).Select(r => LigneRisque(v, r)));
            else risques.Add(L("Aucun risque ouvert."));
            feuilles.Add(new Feuille { Nom = "Risques", Lignes = risques, Colonnes = [9, 50, 12, 10, 12, 40, 22, 12, 10, 40] });
        }

        // ---- 2 ter. Échéances : en retard, facturées sur la période, à venir dans l'horizon ----
        if (m.Echeancier.Count > 0)
        {
            var retenues = m.Echeancier.Where(e => e.Statut == "En retard" || DansPeriode(e.RealiseLe)
                || (e.RealiseLe is null && e.DatePrevue is { } dp && dp >= au && dp <= fin)).ToList();
            var ech = new List<List<object?>>
            {
                L(T("Échéances de facturation")), L($"En retard, facturées sur la période et à venir d’ici le {D(fin)}."), Vide(),
                L(H("N°"), H("Échéance"), H("Montant"), H("Date prévue"), H("Facturée le"), H("Statut"), H("Périmètre lié"), H("Avancement lié"), H("Prête à facturer")),
            };
            if (retenues.Count > 0)
                ech.AddRange(retenues.Select(e => L(e.N, e.Nom, Eur(e.Montant), D(e.DatePrevue), D(e.RealiseLe), e.Statut, PerimetreLie(e, true), Pct(e.AvLie),
                    e.RealiseLe is not null ? "" : e.Pret ? "Oui" : e.NLies > 0 ? "Non" : "")));
            else ech.Add(L("Aucune échéance concernée."));
            feuilles.Add(new Feuille { Nom = "Échéances", Lignes = ech, Colonnes = [6, 50, 12, 12, 12, 14, 30, 14, 14] });
        }

        // ---- 3. Activité de la période (qui a travaillé sur quoi) ----
        var activite = new List<List<object?>>
        {
            L(T($"Consommé du {D(du)} au {D(au)}")), Vide(), L(Sec("Par personne")), L(H("Profil"), H("Consommé période (JH)")),
        };
        for (var i = 0; i < P.Count; i++)
        {
            var k = i;
            var total = periode.Sum(x => x.parProfil[k]);
            if (!string.IsNullOrEmpty(P[i].Nom) && total > 0) activite.Add(L(P[i].Nom, Jh(total)));
        }
        activite.Add(L(Gras("TOTAL"), Jh(consoPeriode, true)));
        activite.Add(Vide());
        activite.Add(L(Sec("Par tâche et par profil")));
        activite.Add(L(H(m.Dim.Label), H("Tâche"), H("Profil"), H("Consommé période"), H("Consommé total"), H("Charge"), H("Reste"), H("Statut")));
        var lignesActivite = new List<List<object?>>();
        foreach (var x in periode)
            for (var i = 0; i < x.parProfil.Count; i++)
                if (x.parProfil[i] > 0)
                    lignesActivite.Add(L(v.NomGroupe(x.t), x.t.Label, v.Profil(i), Jh(x.parProfil[i]), Jh(x.t.ConsoP[i]), Jh(x.t.Charges[i]), Jh(x.t.RestP[i]), x.t.Statut));
        if (lignesActivite.Count > 0) activite.AddRange(lignesActivite);
        else activite.Add(L("Aucun consommé saisi sur la période."));
        feuilles.Add(new Feuille { Nom = "Activité de la période", Lignes = activite, Colonnes = [22, 56, 28, 14, 14, 12, 12, 18] });

        // ---- 4. Charge de l'équipe : mois en cours et mois suivant (planning de charge vs consommé) ----
        var reference = aujourdhui > au ? aujourdhui : au;
        var mk0 = Calendrier.Mois(reference);
        var mk1 = Calendrier.AjouterMois(mk0, 1);
        decimal Planifie(int i, string mk)
        {
            var k = projet.PlanningRef.Months.IndexOf(mk);
            return k >= 0 && i < projet.PlanningRef.Rows.Count && k < projet.PlanningRef.Rows[i].Count ? projet.PlanningRef.Rows[i][k] : 0;
        }
        decimal ConsoMois(int i, string mk) => taches.Sum(t => v.ConsoEntre(t.Uid, i, jour => jour.StartsWith(mk, StringComparison.Ordinal)));
        List<DateOnly> Ouvres(string mk) => Calendrier.JoursDuMois(mk).Where(Calendrier.EstOuvre).ToList();
        var resteOuvres = Ouvres(mk0).Count(x => x > reference);
        var equipe = new List<List<object?>>
        {
            L(T("Charge de l’équipe — planning de charge et consommé")),
            L($"Mois en cours : {mk0[5..7]}/{mk0[..4]} · mois suivant : {mk1[5..7]}/{mk1[..4]}. « Surcharge » = plus de jours prévus que de jours ouvrés disponibles."),
            Vide(),
            L(H("Profil"), H("Prévu mois en cours"), H("Consommé mois en cours"), H("Reste à faire ce mois"), H("Jours ouvrés restants"), H("Alerte"), H("Prévu mois suivant"),
                H("Jours ouvrés mois suivant"), H("Alerte")),
        };
        for (var i = 0; i < P.Count; i++)
        {
            if (string.IsNullOrEmpty(P[i].Nom)) continue;
            var pl = Planifie(i, mk0);
            var co = ConsoMois(i, mk0);
            var reste = Math.Max(pl - co, 0);
            var suivant = Planifie(i, mk1);
            var ouvresSuivant = Ouvres(mk1).Count;
            equipe.Add(L(P[i].Nom, Jh(pl), Jh(co), Jh(reste), resteOuvres, reste > resteOuvres + 0.000000001m ? "Surcharge" : "", Jh(suivant), ouvresSuivant,
                suivant > ouvresSuivant + 0.000000001m ? "Surcharge" : ""));
        }
        feuilles.Add(new Feuille { Nom = "Charge équipe", Lignes = equipe, Colonnes = [30, 14, 14, 14, 14, 14, 14, 14, 14] });

        // ---- 5. Ateliers & livrables : réalisés et à venir ----
        var al = taches.Where(t => t.Type.Length > 0).ToList();
        List<object?> LigneAl(string categorie, TacheCalculee t)
        {
            var tr = v.Tr(t.Uid);
            var at = tr.Atelier;
            var dateDebut = at?.Date ?? tr.Debut;
            var invitationOuLivraison = t.Type == ReferentielsMetier.TypeAtelier ? Invitation(t, at)
                : t.Type == ReferentielsMetier.TypeLivrable ? (t.RealiseLe is not null ? $"Livré le {D(t.RealiseLe)}" : "À livrer") : "";
            var destinatairesOuValidation = t.Type == ReferentielsMetier.TypeLivrable
                ? (t.RealiseLe is null ? "" : tr.Livr?.ValideLe is { } vl ? $"Validé client le {D(vl)}" : "En attente de validation client")
                : string.Join("; ", at?.Dest ?? new List<string>());
            return L(categorie, v.NomType(t.Type), v.NomGroupe(t), t.Label, t.Responsable, t.Statut, D(dateDebut) + Horaire(at), D(tr.Fin), invitationOuLivraison,
                destinatairesOuValidation, D(ValideeLe(t)));
        }
        var lignesAl = new List<List<object?>>();
        lignesAl.AddRange(al.Where(t => t.Statut == ReferentielsMetier.StatutValide && DansPeriode(ValideeLe(t))).Select(t => LigneAl("Réalisé sur la période", t)));
        lignesAl.AddRange(al.Where(t => !t.Annulee && t.Statut != ReferentielsMetier.StatutValide && v.Tr(t.Uid).Fin is { } fn && fn < au).Select(t => LigneAl("En retard", t)));
        lignesAl.AddRange(al.Where(t =>
        {
            var tr = v.Tr(t.Uid);
            if (t.Annulee || t.Statut == ReferentielsMetier.StatutValide || (tr.Fin is { } fn && fn < au)) return false;
            return (tr.Debut is { } dd && dd <= fin && dd >= au) || (tr.Fin is { } ff && ff <= fin && ff >= au);
        }).Select(t => LigneAl("À venir", t)));
        var ateliers = new List<List<object?>>
        {
            L(T("Ateliers & livrables — réalisés sur la période et à venir")), Vide(),
            L(H(""), H("Type"), H(m.Dim.Label), H("Intitulé"), H("Profil principal"), H("Statut"), H("Date / début"), H("Fin"), H("Invitation / livraison"),
                H("Destinataires / validation client"), H("Validé le")),
        };
        if (lignesAl.Count > 0) ateliers.AddRange(lignesAl);
        else ateliers.Add(L("Aucun atelier ni livrable réalisé sur la période, en retard ou à venir."));
        feuilles.Add(new Feuille { Nom = "Ateliers & livrables", Lignes = ateliers, Colonnes = [22, 12, 22, 56, 22, 18, 16, 12, 18, 50, 12] });

        // ---- 6. Ajouts au périmètre ----
        if (m.Perimetre.Lignes.Count > 0)
        {
            var perim = new List<List<object?>>
            {
                L(T("Évolutions du périmètre (non facturées)")),
                L($"Sur la période : {Evolutions(ajouts)}. Solde depuis le début du projet (ajouts − annulations) : " +
                    $"{FmtJ(m.Perimetre.ChargeAjout - m.Perimetre.ChargeAnnulee)} JH, {FmtE(m.Perimetre.CoutAjout - m.Perimetre.CoutAnnule)}."),
                Vide(),
                L(H("Date"), H("Par"), H("Ajout"), H("Tâche"), H("Profil(s)"), H("Charge (JH)"), H("Coût (CJM)"), H("Motif")),
            };
            perim.AddRange(m.Perimetre.Lignes.Select(l => L(D(l.At), l.By ?? "",
                (l.Kind == "tache" ? "Nouvelle tâche" : l.Kind == "annul" ? "Annulation" : l.Kind == "reaff" ? "Réaffectation" : "Profil ajouté") +
                (l.At is { Length: >= 10 } at && DansPeriodeIso(at[..10]) ? " (période)" : ""),
                l.Label, string.Join(", ", l.Profils), Jh(l.Jh), Eur(l.Cout), l.Motif ?? "")));
            feuilles.Add(new Feuille { Nom = "Ajouts périmètre", Lignes = perim, Colonnes = [12, 16, 16, 56, 30, 12, 12, 40] });
        }

        // ---- 7. Achats et frais : budget TSP / réel / atterrissage, lignes de la période ----
        var A = m.Financier.Achats;
        var F = m.Financier.Frais;
        if (A.Budget != 0 || projet.AchatsReel.Count > 0 || F.Budget != 0 || projet.FraisReel.Count > 0)
            feuilles.Add(new Feuille { Nom = "Achats & frais", Lignes = AchatsFrais(v, d => d >= du && d <= au, "DE LA PÉRIODE").ToList(), Colonnes = [14, 40, 22, 22, 14, 14, 14, 14, 30] });
        return feuilles;
    }
}
