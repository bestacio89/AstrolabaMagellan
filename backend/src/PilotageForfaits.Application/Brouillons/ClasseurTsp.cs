using System.Globalization;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Brouillons;

/// <summary>
/// Met un TSP rédigé dans l'application en forme de classeur, onglet par onglet, à la place des cellules du modèle de TSP
/// (FICHE PROJET, PROFIL, WORKLOAD, PLANNING, ECHEANCIER, ACHAT, FRAIS, METRIQUE, REF).
/// Le même classeur sert à deux choses :
/// - l'export Excel (avec des formules de totaux, comme le modèle) ;
/// - le lancement du projet et le calcul de la synthèse, qui le lisent exactement comme un TSP importé (InterpreteurTsp).
/// C'est ce qui garantit qu'un TSP rédigé, exporté puis réimporté, donne le même projet.
/// </summary>
public static class ClasseurTsp
{
    /// <summary>Informations ajoutées au classeur : auteur et date (onglet FICHE PROJET), résultats du moteur pour l'export (facultatifs).</summary>
    public sealed record Contexte(string Auteur, DateOnly Date, ResultatCalcul? Calcul = null);

    /// <summary>Première ligne de tâches de l'onglet WORKLOAD (ligne 5 d'Excel, comme le modèle).</summary>
    private const int PremiereTache = 4;

    public static List<Feuille> Feuilles(TspSaisi tsp, Contexte contexte)
    {
        var profils = tsp.Profils;
        var n = profils.Count;
        var remise = tsp.Remise;
        decimal Charge(TacheSaisie t, ProfilSaisi p) => t.Charges.TryGetValue(p.Id, out var v) ? v : 0;
        var chargeProfil = profils.Select(p => tsp.Taches.Sum(t => Charge(t, p))).ToList();
        var caProfil = profils.Select((p, i) => chargeProfil[i] * p.Tjm * (1 - remise)).ToList();
        var ca = caProfil.Sum();

        // ---- WORKLOAD (en premier : les autres onglets font référence à ses totaux) ----
        var wl = new Grille();
        var derniere = PremiereTache + Math.Max(tsp.Taches.Count, 1) - 1; // index de la dernière ligne de tâches
        var cP = 7; // colonne H : premier profil
        var cLivrable = cP + n;
        string Plage(int col) => $"{Lettre(col)}{PremiereTache + 1}:{Lettre(col)}{derniere + 1}";
        var totalCharge = chargeProfil.Sum();
        wl.E(0, 2, Titre("Workload"));
        wl.E(0, 6, "% pilotage projet");
        wl.E(0, 7, Nombre(PartDePhase(tsp, "PILOTAGE") * 100, "jh"));
        wl.E(0, 8, "% provision");
        wl.E(0, 9, Nombre(PartDePhase(tsp, "PROVISION") * 100, "jh"));
        wl.E(2, 4, new Cellule("SOUS TOTAL", Gras: true));
        wl.E(2, 5, Formule($"SUBTOTAL(9,{Plage(5)})", totalCharge, "bjh"));
        wl.E(2, 6, Formule($"SUBTOTAL(9,{Plage(6)})", ca, "beur"));
        for (var i = 0; i < n; i++) wl.E(2, cP + i, Formule($"SUBTOTAL(9,{Plage(cP + i)})", chargeProfil[i], "bjh"));
        foreach (var (texte, col) in new[] { ("ID", 0), ("Lot", 1), ("Phase", 2), ("Etape", 3), ("Tâche", 4), ("TOTAL Charge", 5), ("TOTAL\nValorisation", 6) })
            wl.E(3, col, Entete(texte));
        for (var i = 0; i < n; i++) wl.E(3, cP + i, Entete(profils[i].Nom));
        wl.E(3, cLivrable, Entete("Livrable"));
        wl.E(3, cLivrable + 1, Entete("Hypothèses/Commentaire"));
        for (var k = 0; k < tsp.Taches.Count; k++)
        {
            var t = tsp.Taches[k];
            var r = PremiereTache + k;
            if (t.Separateur)
            {
                // séparateur : le libellé, mis en valeur comme les titres de section du modèle, sans charge. Un titre garde son axe
                // et son lot, comme dans le TSP d'origine : le Planning en fait les sous-parties de cet axe.
                if (!string.IsNullOrWhiteSpace(t.Libelle)) { wl.E(r, 0, TexteOuVide(t.Axe)); wl.E(r, 1, TexteOuVide(t.Lot)); }
                wl.E(r, 4, string.IsNullOrWhiteSpace(t.Libelle) ? null : new Cellule(t.Libelle.Trim(), Type: "section"));
                continue;
            }
            var charges = profils.Select(p => Charge(t, p)).ToList();
            wl.E(r, 0, TexteOuVide(t.Axe));
            wl.E(r, 1, TexteOuVide(t.Lot));
            wl.E(r, 2, TexteOuVide(t.Phase.Trim().ToUpperInvariant()));
            wl.E(r, 3, TexteOuVide(t.Etape));
            wl.E(r, 4, TexteOuVide(t.Libelle));
            if (n > 0) wl.E(r, 5, Formule($"SUM({Lettre(cP)}{r + 1}:{Lettre(cP + n - 1)}{r + 1})", charges.Sum(), "jh"));
            var valo = profils.Select((p, i) => charges[i] * p.Tjm * (1 - remise)).Sum();
            if (valo != 0) wl.E(r, 6, new Cellule(Arrondi(valo), "eur"));
            for (var i = 0; i < n; i++) wl.E(r, cP + i, Nombre(charges[i], "jh"));
            wl.E(r, cLivrable, t.Livrable ? "oui" : null);
            wl.E(r, cLivrable + 1, TexteOuVide(t.Hypothese));
        }
        var colonnesWl = new List<double> { 6, 22, 16, 30, 48, 10, 13 };
        colonnesWl.AddRange(Enumerable.Repeat(12.0, n));
        colonnesWl.AddRange([9, 40]);

        // ---- PROFIL ----
        var pr = new Grille();
        pr.E(0, 1, Titre("Profil"));
        foreach (var (texte, col) in new[] { ("PROFIL", 1), ("Entité", 2), ("TJM", 3), ("CJM", 4), ("PRCS", 5), ("Frais Déplacement (si Cession)", 6), ("Charge", 8), ("CA (€)", 9), ("Coût (€)", 10), ("Marge", 11) })
            pr.E(4, col, Entete(texte));
        var rTotal = 5 + n;          // ligne « TOTAL »
        var rRemise = rTotal + 2;    // ligne « Remise »
        var celluleRemise = $"$J${rRemise + 1}";
        for (var i = 0; i < n; i++)
        {
            var p = profils[i];
            var r = 5 + i;
            var cout = chargeProfil[i] * p.Cjm;
            pr.E(r, 1, TexteOuVide(p.Nom));
            pr.E(r, 2, TexteOuVide(p.Entite));
            pr.E(r, 3, new Cellule(p.Tjm, "eurc"));
            pr.E(r, 4, new Cellule(p.Cjm, "eurc"));
            if (p.Prcs is { } prcs) pr.E(r, 5, new Cellule(prcs, "eurc"));
            // colonne G du modèle : frais d'une cession (nombre) ou, à défaut, personne prévue sur le profil (texte)
            if (p.Frais != 0) pr.E(r, 6, new Cellule(p.Frais, "eurc"));
            else pr.E(r, 6, TexteOuVide(p.Collaborateur));
            pr.E(r, 8, Formule($"WORKLOAD!{Lettre(cP + i)}3", chargeProfil[i], "jh"));
            pr.E(r, 9, Formule($"I{r + 1}*D{r + 1}*(1-{celluleRemise})", caProfil[i], "eur"));
            pr.E(r, 10, Formule($"I{r + 1}*E{r + 1}", cout, "eur"));
            pr.E(r, 11, Formule($"IF(J{r + 1}<>0,(J{r + 1}-K{r + 1})/J{r + 1},\"\")", caProfil[i] != 0 ? (caProfil[i] - cout) / caProfil[i] : 0, "pct"));
        }
        pr.E(rTotal, 1, new Cellule("TOTAL", Gras: true));
        pr.E(rTotal, 8, Somme("I", 6, rTotal, totalCharge, "bjh"));
        pr.E(rTotal, 9, Somme("J", 6, rTotal, ca, "beur"));
        pr.E(rTotal, 10, Somme("K", 6, rTotal, profils.Select((p, i) => chargeProfil[i] * p.Cjm).Sum(), "beur"));
        pr.E(rRemise, 8, "Remise");
        if (remise != 0) pr.E(rRemise, 9, new Cellule(remise, "pct"));
        var celluleCa = $"PROFIL!$J${rTotal + 1}";

        // ---- FICHE PROJET ----
        var f = tsp.Fiche;
        var montant = contexte.Calcul?.Synthese.MontantProjet ?? ca;
        var fp = new Grille();
        fp.E(0, 2, Titre("Fiche projet"));
        void Champ(int r, string libelle, string? valeur) { fp.E(r, 1, libelle); fp.E(r, 2, TexteOuVide(valeur)); }
        Champ(2, "Nom du client", f.Client);
        Champ(3, "Projet", f.Projet);
        Champ(4, "Référence propale", f.Reference);
        Champ(5, "Contact client", f.Contact);
        Champ(7, "Agence", f.Agence);
        Champ(8, "Service line", f.ServiceLine);
        Champ(9, "Directeur agence", f.Directeur);
        Champ(10, "Responsable SL", f.ResponsableSL);
        Champ(11, "Commercial", f.Commercial);
        Champ(13, "Type de contrat", f.TypeContrat);
        Champ(14, "Période (jj/mm/aaaa au jj/mm/aaaa)",
            f.Debut is { } d1 && f.Fin is { } d2 ? $"{Calendrier.Fr(d1)} au {Calendrier.Fr(d2)}" : "");
        fp.E(15, 1, "Montant du contrat");
        fp.E(15, 2, new Cellule(Arrondi(montant), "eur"));
        fp.E(2, 5, "Auteur :");
        fp.E(2, 6, TexteOuVide(contexte.Auteur));
        fp.E(3, 5, "Date :");
        fp.E(3, 6, Calendrier.Fr(contexte.Date));

        // ---- PLANNING (par profil) ----
        var mois = MoisDuPlanning(tsp);
        var pl = new Grille();
        pl.E(0, 1, Titre("Planning"));
        foreach (var (texte, col) in new[] { ("Profil", 1), ("Charge par profil", 2), ("CJM", 3), ("Ecart ?", 4) }) pl.E(3, col, Entete(texte));
        for (var k = 0; k < mois.Count; k++) pl.E(3, 5 + k, new Cellule(Calendrier.VersSerieExcel(Calendrier.PremierJour(mois[k])), "date", Gras: true));
        var dernierMois = 5 + Math.Max(mois.Count, 1) - 1;
        for (var i = 0; i < n; i++)
        {
            var p = profils[i];
            var r = 4 + i;
            var parMois = tsp.Planning.TryGetValue(p.Id, out var pm) ? pm : new Dictionary<string, decimal>();
            var reparti = mois.Sum(m => parMois.GetValueOrDefault(m));
            pl.E(r, 1, TexteOuVide(p.Nom));
            pl.E(r, 2, Formule($"PROFIL!I{6 + i}", chargeProfil[i], "jh"));
            pl.E(r, 3, new Cellule(p.Cjm, "eurc"));
            pl.E(r, 4, Formule($"SUM(F{r + 1}:{Lettre(dernierMois)}{r + 1})-C{r + 1}", reparti - chargeProfil[i], "jh"));
            for (var k = 0; k < mois.Count; k++) pl.E(r, 5 + k, Nombre(parMois.GetValueOrDefault(mois[k]), "jh"));
        }
        var rTotalPl = 4 + n;
        pl.E(rTotalPl, 1, new Cellule("TOTAL JH", Gras: true));
        pl.E(rTotalPl, 2, Somme("C", 5, rTotalPl, totalCharge, "bjh"));
        for (var k = 0; k < mois.Count; k++)
        {
            var col = Lettre(5 + k);
            var somme = profils.Sum(p => tsp.Planning.TryGetValue(p.Id, out var pm) ? pm.GetValueOrDefault(mois[k]) : 0);
            pl.E(rTotalPl, 5 + k, Somme(col, 5, rTotalPl, somme, "bjh"));
        }

        // ---- ECHEANCIER ----
        var ec = new Grille();
        ec.E(0, 1, Titre("Echéancier"));
        foreach (var (texte, col) in new[] { ("N°", 1), ("Nom Échéance", 2), ("%", 3), ("Mois Facturation", 4), ("Montant à Facturation", 5) }) ec.E(3, col, Entete(texte));
        for (var k = 0; k < tsp.Echeances.Count; k++)
        {
            var e = tsp.Echeances[k];
            var r = 4 + k;
            ec.E(r, 1, k + 1);
            ec.E(r, 2, TexteOuVide(e.Nom));
            ec.E(r, 3, new Cellule(e.Pct, "pct"));
            if (MoisValide(e.Mois)) ec.E(r, 4, new Cellule(Calendrier.VersSerieExcel(Calendrier.PremierJour(e.Mois!)), "date"));
            ec.E(r, 5, Formule($"D{r + 1}*{celluleCa}", e.Pct * ca, "eur"));
        }
        var rTotalEc = 4 + tsp.Echeances.Count;
        ec.E(rTotalEc, 4, new Cellule("TOTAL", Gras: true));
        ec.E(rTotalEc, 5, Somme("F", 5, rTotalEc, tsp.Echeances.Sum(e => e.Pct) * ca, "beur"));

        // ---- ACHAT ----
        var ac = new Grille();
        ac.E(0, 0, Titre("Achat"));
        foreach (var (texte, col) in new[] { ("Achat Matériel / Logiciel", 0), ("Type d'achat", 1), ("Coût unitaire", 2), ("Qté", 3), ("Montant HT", 4), ("Montant Revente", 6), ("Markup (%)", 7), ("Commentaire", 8) })
            ac.E(3, col, Entete(texte));
        var r0 = 4;
        foreach (var a in tsp.Achats)
        {
            ac.E(r0, 0, TexteOuVide(a.Designation));
            ac.E(r0, 1, TexteOuVide(a.Type));
            ac.E(r0, 2, new Cellule(a.Cu, "eurc"));
            ac.E(r0, 3, a.Qte);
            ac.E(r0, 4, Formule($"C{r0 + 1}*D{r0 + 1}", a.Cu * a.Qte, "eurc"));
            ac.E(r0, 6, new Cellule(a.Revente, "eurc"));
            ac.E(r0, 7, Formule($"IFERROR((G{r0 + 1}-E{r0 + 1})/G{r0 + 1},\"\")", a.Revente != 0 ? (a.Revente - a.Cu * a.Qte) / a.Revente : 0, "pct"));
            ac.E(r0, 8, TexteOuVide(a.Commentaire));
            r0++;
        }
        ac.E(r0, 0, new Cellule("TOTAL", Gras: true));
        ac.E(r0, 4, Somme("E", 5, r0, tsp.Achats.Sum(a => a.Cu * a.Qte), "beur"));
        ac.E(r0, 6, Somme("G", 5, r0, tsp.Achats.Sum(a => a.Revente), "beur"));
        var rP = r0 + 3;
        foreach (var (texte, col) in new[] { ("Achat Prestataires externes", 0), ("Société", 1), ("Coût jour", 2), ("Nbj", 3), ("Total Coût", 4), ("TJM", 5), ("Montant Revente", 6), ("Markup (%)", 7), ("Commentaire", 8) })
            ac.E(rP, col, Entete(texte));
        var r1 = rP + 1;
        foreach (var p in tsp.Prestataires)
        {
            ac.E(r1, 0, TexteOuVide(p.Designation));
            ac.E(r1, 1, TexteOuVide(p.Societe));
            ac.E(r1, 2, new Cellule(p.CoutJour, "eurc"));
            ac.E(r1, 3, p.Nbj);
            ac.E(r1, 4, Formule($"C{r1 + 1}*D{r1 + 1}", p.CoutJour * p.Nbj, "eurc"));
            ac.E(r1, 5, new Cellule(p.Tjm, "eurc"));
            ac.E(r1, 6, Formule($"D{r1 + 1}*F{r1 + 1}", p.Nbj * p.Tjm, "eurc"));
            ac.E(r1, 7, Formule($"IFERROR((G{r1 + 1}-E{r1 + 1})/G{r1 + 1},\"\")", p.Tjm != 0 ? (p.Tjm - p.CoutJour) / p.Tjm : 0, "pct"));
            ac.E(r1, 8, TexteOuVide(p.Commentaire));
            r1++;
        }
        ac.E(r1, 0, new Cellule("TOTAL", Gras: true));
        ac.E(r1, 4, Somme("E", rP + 2, r1, tsp.Prestataires.Sum(p => p.CoutJour * p.Nbj), "beur"));
        ac.E(r1, 6, Somme("G", rP + 2, r1, tsp.Prestataires.Sum(p => p.Nbj * p.Tjm), "beur"));

        // ---- FRAIS ----
        var fr = new Grille();
        fr.E(0, 0, Titre("Frais"));
        foreach (var (texte, col) in new[] { ("Libellé Frais", 0), ("Coût unitaire", 1), ("Qté", 2), ("Montant", 3), ("Montant Refacturé", 4), ("Commentaire", 5) })
            fr.E(3, col, Entete(texte));
        var r2 = 4;
        foreach (var x in tsp.Frais)
        {
            fr.E(r2, 0, TexteOuVide(x.Libelle));
            fr.E(r2, 1, new Cellule(x.Cu, "eurc"));
            fr.E(r2, 2, x.Qte);
            fr.E(r2, 3, Formule($"B{r2 + 1}*C{r2 + 1}", x.Cu * x.Qte, "eurc"));
            fr.E(r2, 4, new Cellule(x.Refacture, "eurc"));
            fr.E(r2, 5, TexteOuVide(x.Commentaire));
            r2++;
        }
        fr.E(r2, 0, new Cellule("TOTAL", Gras: true));
        fr.E(r2, 3, Somme("D", 5, r2, tsp.Frais.Sum(x => x.Cu * x.Qte), "beur"));
        fr.E(r2, 4, Somme("E", 5, r2, tsp.Frais.Sum(x => x.Refacture), "beur"));

        // ---- METRIQUE (le moteur recalcule les colonnes à droite ; elles sont écrites pour la lecture) ----
        var me = new Grille();
        me.E(0, 1, Titre("Métrique"));
        foreach (var (texte, col) in new[] { ("Etape", 1), ("% Théorique", 2), ("Charge Théorique", 3), ("Charge Propale", 4), ("% Projet", 5), ("Ecart (%)", 6) })
            me.E(3, col, Entete(texte));
        for (var k = 0; k < tsp.Metrique.Count; k++)
        {
            var m = tsp.Metrique[k];
            var calcule = contexte.Calcul?.Metrique.FirstOrDefault(x => x.Etape == m.Etape);
            me.E(4 + k, 1, TexteOuVide(m.Etape));
            me.E(4 + k, 2, new Cellule(m.Pct, "pct"));
            if (calcule is not null)
            {
                me.E(4 + k, 3, new Cellule(Arrondi(calcule.Theorique), "jh"));
                me.E(4 + k, 4, new Cellule(Arrondi(calcule.Propale), "jh"));
                if (calcule.PctProjet is { } pp) me.E(4 + k, 5, new Cellule(pp, "pct"));
                if (calcule.Ecart is { } ecart) me.E(4 + k, 6, new Cellule(ecart, "pct"));
            }
        }
        me.E(4 + tsp.Metrique.Count, 1, new Cellule("TOTAL", Gras: true));

        // ---- REF (listes) ----
        var rf = new Grille();
        rf.E(0, 1, Titre("Référence"));
        foreach (var (texte, col) in new[] { ("PHASE", 1), ("ETAPE", 3), ("PROFIL", 5), ("TYPE ACHAT", 9) }) rf.E(3, col, Entete(texte));
        var listes = new[] { (1, (IReadOnlyList<string>)tsp.Phases), (3, tsp.Etapes), (5, ModeleTsp.Profils), (9, ModeleTsp.TypesAchat) };
        foreach (var (col, valeurs) in listes)
            for (var k = 0; k < valeurs.Count; k++) rf.E(4 + k, col, TexteOuVide(col == 1 ? valeurs[k].Trim().ToUpperInvariant() : valeurs[k]));

        var feuilles = new List<Feuille>
        {
            fp.Vers("FICHE PROJET", 2, 36, 40, 4, 4, 12, 24),
        };
        if (contexte.Calcul is { } calcul) feuilles.Add(Synthese(calcul));
        feuilles.AddRange(
        [
            pr.Vers("PROFIL", 2, 30, 10, 11, 11, 10, 14, 4, 11, 13, 13, 9),
            new Feuille { Nom = "WORKLOAD", Lignes = wl.Lignes, Colonnes = colonnesWl },
            pl.Vers("PLANNING", [2, 26, 12, 11, 10, .. Enumerable.Repeat(10.0, mois.Count)]),
            ec.Vers("ECHEANCIER", 2, 6, 40, 9, 14, 16),
            ac.Vers("ACHAT", 36, 22, 13, 8, 13, 11, 14, 11, 36),
            fr.Vers("FRAIS", 40, 13, 8, 13, 16, 36),
            me.Vers("METRIQUE", 2, 40, 12, 14, 14, 10, 10),
            rf.Vers("REF", 2, 16, 2, 40, 2, 30, 2, 2, 2, 20),
        ]);
        return feuilles;
    }

    /// <summary>Onglet SYNTHESE (export seulement : à la lecture, le moteur recalcule tout).</summary>
    private static Feuille Synthese(ResultatCalcul calcul)
    {
        var s = calcul.Synthese;
        var g = new Grille();
        g.E(0, 2, Titre("Synthèse"));
        // mêmes libellés et même ordre que l'onglet SYNTHESE du modèle de TSP ; une ligne vide (libellé "") sépare les blocs
        LigneEntite E(string e) => s.Entites.FirstOrDefault(x => x.Entite == e) ?? new LigneEntite { Entite = e };
        decimal? Si(decimal v) => v != 0 ? v : null;
        var fo = E("FO"); var ce = E("CESSION"); var ac = E("ACHAT"); var bo = E("BO"); var ab = E("ACHAT BO"); var tb = s.TotalBo ?? new LigneEntite { Entite = "TOTAL BO" };
        var lignes = new List<(string Libelle, decimal? Valeur, string Format)>
        {
            ("Montant du projet (€)", s.MontantProjet, "eur"), ("", null, ""),
            ("Nombre de jours produit (jh)", s.Jours, "jh"), ("Jours valorisés (€)", s.Ca, "eur"), ("Coût du projet pour Exakis Nelite (€)", s.Cout, "eur"),
            ("CJM de production", s.CjmProd, "eurc"), ("Marge brute Agence (%)", s.MargeAgence, "pct"), ("Marge brute Exakis Nelite (%)", s.MargeEN, "pct"),
            ("TJM Client (€)", s.TjmClient, "eurc"), ("", null, ""),
            ("Frais de déplacement (€)", s.FraisDep, "eur"), ("Montant des frais à refacturer (€)", s.FraisRef, "eur"),
            ("Frais non refacturés / jour produit", s.FraisNonRefJour, "eurc"), ("", null, ""),
            ("Provision pour Risque (JH)", s.ProvJH, "jh"), ("Provision pour Risque (€)", s.ProvEur, "eur"), ("Provision pour Risque (%)", s.ProvPct, "pct"), ("", null, ""),
            ("Montant des achats mat/log (€)", s.AchatsMt, "eur"), ("Montant des achats à refacturer (€)", s.AchatsRef, "eur"),
            ("Marge achats (€)", s.MargeAchats, "eur"), ("Marge des Achats/Reventes (%)", s.MargeAchatsPct, "pct"), ("", null, ""),
            ("Marge Nette Exakis Nelite (€)", s.MargeNette, "eur"), ("Marge Nette Exakis Nelite (%)", s.MargeNettePct, "pct"), ("", null, ""),
            ("FO - Nombre de jours produit (jh)", Si(fo.Jours), "jh"), ("FO - Jours valorisés (€)", Si(fo.Ca), "eur"), ("FO - TJM Client (€)", fo.Tjm, "eurc"),
            ("FO - CJM Production (€)", fo.Cjm, "eurc"), ("FO - Marge Exakis Nelite (%)", fo.MargeEN, "pct"), ("", null, ""),
            ("CESSION - Nombre de jours produit", Si(ce.Jours), "jh"), ("CESSION - Jours valorisés (€)", Si(ce.Ca), "eur"), ("CESSION - TJM Client (€)", ce.Tjm, "eurc"),
            ("CESSION - CJM Production (€)", ce.Cjm, "eurc"), ("CESSION - Marge Exakis Nelite (%)", ce.MargeEN, "pct"),
            ("CESSION - Taux de Cession Interne", ce.CoutAgenceJour, "eurc"), ("CESSION - Marge AGENCE (%)", ce.MargeAgence, "pct"), ("", null, ""),
            ("ACHAT - Nombre de jours produit", Si(ac.Jours), "jh"), ("ACHAT - Jours valorisés (€)", Si(ac.Ca), "eur"), ("ACHAT - TJM Client (€)", ac.Tjm, "eurc"),
            ("ACHAT - Coût d'achat Moyen / j (€)", ac.CoutAgenceJour, "eurc"), ("ACHAT - Marge AGENCE (%)", ac.MargeAgence, "pct"), ("", null, ""),
            ("BO - Nombre de jours produit (jh)", Si(bo.Jours), "jh"), ("BO - Jours valorisés (€)", Si(bo.Ca), "eur"), ("BO - TJM Client (€)", bo.Tjm, "eurc"),
            ("BO - CJM Production (€)", bo.Cjm, "eurc"), ("BO - Marge Exakis Nelite (%)", bo.MargeEN, "pct"),
            ("ACHAT BO - Nombre de jours produit", Si(ab.Jours), "jh"), ("ACHAT BO - Jours valorisés (€)", Si(ab.Ca), "eur"), ("ACHAT BO - TJM Client (€)", ab.Tjm, "eurc"),
            ("ACHAT BO - CJM Production (€)", ab.Cjm, "eurc"), ("ACHAT BO - Marge Exakis Nelite (%)", ab.MargeEN, "pct"),
            ("TOTAL BO - Nombre de jours produit", Si(tb.Jours), "jh"), ("TOTAL BO - Jours valorisés (€)", Si(tb.Ca), "eur"), ("TOTAL BO - TJM Client (€)", tb.Tjm, "eurc"),
            ("TOTAL BO - CJM Production (€)", tb.Cjm, "eurc"), ("TOTAL BO - Marge Exakis Nelite (%)", tb.MargeEN, "pct"),
            ("PRCS Moyen du BACK", s.PrcsMoyenBack, "eurc"), ("Marge FRONT / BACK", s.MargeFrontBack, "pct"),
        };
        for (var k = 0; k < lignes.Count; k++)
        {
            if (lignes[k].Libelle.Length > 0) g.E(3 + k, 2, lignes[k].Libelle);
            if (lignes[k].Valeur is { } v) g.E(3 + k, 3, new Cellule(Arrondi(v, lignes[k].Format == "pct" ? 4 : 2), lignes[k].Format));
        }
        return g.Vers("SYNTHESE", 2, 2, 46, 16);
    }

    /// <summary>Mois du planning : la période du projet, élargie aux mois déjà saisis.</summary>
    public static List<string> MoisDuPlanning(TspSaisi tsp)
    {
        var mois = new SortedSet<string>(StringComparer.Ordinal);
        if (tsp.Fiche.Debut is { } d && tsp.Fiche.Fin is { } f && f >= d)
            for (var m = Calendrier.Mois(d); string.CompareOrdinal(m, Calendrier.Mois(f)) <= 0 && mois.Count < 120; m = Calendrier.AjouterMois(m, 1)) mois.Add(m);
        foreach (var parMois in tsp.Planning.Values)
            foreach (var (m, v) in parMois)
                if (v != 0 && MoisValide(m)) mois.Add(m);
        return mois.ToList();
    }

    /// <summary>Part de la charge totale portée par une phase (0 si aucune charge).</summary>
    private static decimal PartDePhase(TspSaisi tsp, string phase)
    {
        var total = tsp.Taches.Sum(t => t.Charges.Values.Sum());
        if (total == 0) return 0;
        return tsp.Taches.Where(t => Texte.Norm(t.Phase) == Texte.Norm(phase)).Sum(t => t.Charges.Values.Sum()) / total;
    }

    public static bool MoisValide(string? mois) =>
        mois is { Length: 7 } && mois[4] == '-' && int.TryParse(mois[..4], NumberStyles.None, CultureInfo.InvariantCulture, out var a) && a is >= 1955 and <= 2118
        && int.TryParse(mois[5..], NumberStyles.None, CultureInfo.InvariantCulture, out var m) && m is >= 1 and <= 12;

    // ---------- cellules ----------

    private static Cellule Titre(string texte) => new(texte, Type: "title");
    private static Cellule Entete(string texte) => new(texte, Entete: true);
    private static Cellule Formule(string formule, decimal valeur, string format) =>
        new(Arrondi(valeur, format.EndsWith("pct", StringComparison.Ordinal) ? 6 : 4), format.TrimStart('b'), Gras: format.StartsWith('b'), Formule: formule);
    /// <summary>
    /// Total d'une colonne entre deux lignes d'Excel (numérotées à partir de 1). Sans ligne à additionner, la valeur seule
    /// (une formule sur une plage vide finirait sur la ligne du total elle-même : référence circulaire).
    /// </summary>
    private static Cellule Somme(string colonne, int premiere, int derniere, decimal valeur, string format) =>
        derniere >= premiere ? Formule($"SUM({colonne}{premiere}:{colonne}{derniere})", valeur, format)
            : new Cellule(Arrondi(valeur), format.TrimStart('b'), Gras: format.StartsWith('b'));

    /// <summary>Nombre, ou cellule vide pour zéro (comme les charges du modèle).</summary>
    private static Cellule? Nombre(decimal valeur, string format) => valeur == 0 ? null : new Cellule(valeur, format);
    private static string? TexteOuVide(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static decimal Arrondi(decimal v, int d = 4) => Math.Round(v, d, MidpointRounding.AwayFromZero);

    /// <summary>Lettre de colonne Excel : 0 → A, 25 → Z, 26 → AA.</summary>
    public static string Lettre(int index)
    {
        var n = index + 1;
        var s = "";
        while (n > 0)
        {
            var m = (n - 1) % 26;
            s = (char)('A' + m) + s;
            n = (n - 1) / 26;
        }
        return s;
    }

    /// <summary>Lignes d'un onglet en construction.</summary>
    private sealed class Grille
    {
        public List<List<object?>> Lignes { get; } = new();

        public void E(int ligne, int colonne, object? valeur)
        {
            while (Lignes.Count <= ligne) Lignes.Add(new List<object?>());
            var l = Lignes[ligne];
            while (l.Count <= colonne) l.Add(null);
            l[colonne] = valeur;
        }

        public Feuille Vers(string nom, params double[] colonnes) => new() { Nom = nom, Lignes = Lignes, Colonnes = colonnes.ToList() };
    }
}
