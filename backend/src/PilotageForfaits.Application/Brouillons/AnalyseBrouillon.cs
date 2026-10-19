using System.Globalization;
using PilotageForfaits.Application.Projets;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Brouillons;

/// <summary>
/// Ce que l'application dit d'un TSP en cours de rédaction, recalculé à chaque enregistrement :
/// - les chiffres clés, calculés par le moteur sur le projet que donnerait le lancement (mêmes règles qu'un TSP importé) ;
/// - les contrôles : « bloquant » (le lancement est refusé tant qu'il reste un point bloquant), « conseil » (à vérifier) ou « ok » ;
/// - l'état de chaque rubrique, affiché dans la barre latérale.
/// </summary>
public static class AnalyseBrouillon
{
    public const string Bloquant = "bloquant";
    public const string Conseil = "conseil";
    public const string Ok = "ok";
    public const string Vide = "vide";

    private static readonly CultureInfo Fr = CultureInfo.GetCultureInfo("fr-FR");

    public static AnalyseBrouillonDto Analyser(TspSaisi tsp, ClasseurTsp.Contexte contexte, DateTimeOffset maintenant, ProjetExistantDto? existant)
    {
        var controles = new List<ControleDto>();
        void Ajouter(string rubrique, string cle, string niveau, string titre, string? detail = null) =>
            controles.Add(new ControleDto(cle, niveau, titre, detail, rubrique));

        decimal Charge(TacheSaisie t) => t.Charges.Values.Sum();
        var chiffrees = tsp.Taches.Where(t => Charge(t) != 0).ToList();

        // ---- fiche ----
        var f = tsp.Fiche;
        var ficheOk = true;
        if (string.IsNullOrWhiteSpace(f.Client)) { Ajouter("fiche", "fiche.client", Bloquant, "Le client n’est pas renseigné."); ficheOk = false; }
        if (string.IsNullOrWhiteSpace(f.Projet)) { Ajouter("fiche", "fiche.projet", Bloquant, "Le nom du projet n’est pas renseigné."); ficheOk = false; }
        if (f.Debut is null || f.Fin is null)
        {
            Ajouter("fiche", "fiche.periode", Bloquant, "La période du projet est incomplète.",
                "Le début et la fin servent au planning, au Gantt et au calendrier du projet.");
            ficheOk = false;
        }
        else if (f.Fin < f.Debut)
        {
            Ajouter("fiche", "fiche.periode", Bloquant, "La fin du projet est avant son début.");
            ficheOk = false;
        }
        if (ficheOk) Ajouter("fiche", "fiche.ok", Ok, "Fiche complète", $"{f.Client} — {f.Projet}, du {Calendrier.Fr(f.Debut!.Value)} au {Calendrier.Fr(f.Fin!.Value)}");
        if (existant is not null) Ajouter("fiche", "fiche.unicite", Bloquant, "Ce forfait est déjà suivi dans un projet.", existant.Message);
        else if (!string.IsNullOrWhiteSpace(f.Client) && !string.IsNullOrWhiteSpace(f.Projet))
            Ajouter("fiche", "fiche.unicite", Ok, "Projet unique",
                IdentiteProjet.NumeroOpportunite(f.Reference) is { } op ? $"Aucun projet existant pour l’opportunité OP{op}." : "Aucun projet existant avec ce client et ce nom.");

        // ---- profils ----
        var chargeProfil = tsp.Profils.ToDictionary(p => p.Id, p => tsp.Taches.Sum(t => t.Charges.GetValueOrDefault(p.Id)));
        if (tsp.Profils.Count == 0) Ajouter("profils", "profils.aucun", Bloquant, "Aucun profil.", "Ajoutez les profils vendus, avec leur TJM et leur CJM.");
        else
        {
            var avant = controles.Count;
            var sansNom = tsp.Profils.Count(p => string.IsNullOrWhiteSpace(p.Nom));
            if (sansNom > 0) Ajouter("profils", "profils.nom", Bloquant, Pluriel(sansNom, "profil sans nom", "profils sans nom"));
            foreach (var g in tsp.Profils.Where(p => !string.IsNullOrWhiteSpace(p.Nom)).GroupBy(p => Texte.Norm(p.Nom)).Where(x => x.Count() > 1))
                Ajouter("profils", "profils.doublon", Bloquant, $"Deux profils s’appellent « {g.First().Nom.Trim()} ».",
                    "Le TSP repère les profils par leur nom : distinguez-les (ex. « Architecte 1 », « Architecte 2 »).");
            foreach (var p in tsp.Profils.Where(p => chargeProfil[p.Id] != 0 && p.Tjm <= 0))
                Ajouter("profils", "profils.tjm", Bloquant, $"« {Nom(p)} » n’a pas de TJM.", "Sans TJM, sa charge n’est pas valorisée.");
            foreach (var p in tsp.Profils.Where(p => chargeProfil[p.Id] != 0 && p.Cjm <= 0 && p.Entite is "FO" or "CESSION" or "ACHAT"))
                Ajouter("profils", "profils.cjm", Conseil, $"« {Nom(p)} » n’a pas de CJM.", "Sa charge ne coûte rien : la marge sera surestimée.");
            foreach (var p in tsp.Profils.Where(p => chargeProfil[p.Id] == 0))
                Ajouter("profils", "profils.charge", Conseil, $"« {Nom(p)} » n’a aucune charge au workload.", "Chiffrez ses tâches, ou retirez-le.");
            if (controles.Count == avant)
                Ajouter("profils", "profils.ok", Ok, "Profils et prix renseignés", Pluriel(tsp.Profils.Count, "profil", "profils"));
        }

        // ---- workload ----
        if (chiffrees.Count == 0)
            Ajouter("workload", "workload.aucune", Bloquant, "Aucune tâche chiffrée.", "Saisissez les tâches du workload et leurs jours par profil.");
        else
        {
            var avant = controles.Count;
            var sansLibelle = chiffrees.Count(t => string.IsNullOrWhiteSpace(t.Libelle));
            if (sansLibelle > 0)
                Ajouter("workload", "workload.libelle", Bloquant, Pluriel(sansLibelle, "ligne chiffrée sans libellé", "lignes chiffrées sans libellé"),
                    "Une ligne sans libellé est ignorée par le TSP : sa charge serait perdue.");
            var negatives = tsp.Taches.Count(t => t.Charges.Values.Any(v => v < 0));
            if (negatives > 0) Ajouter("workload", "workload.negatif", Bloquant, Pluriel(negatives, "ligne avec une charge négative", "lignes avec une charge négative"));
            var sansAxe = chiffrees.Count(t => string.IsNullOrWhiteSpace(t.Axe));
            if (sansAxe > 0)
                Ajouter("workload", "workload.axe", Conseil, Pluriel(sansAxe, "tâche sans axe", "tâches sans axe"),
                    "Elles seront regroupées dans « Sans axe » (axe modifiable ensuite dans le projet).");
            var sansEtape = chiffrees.Count(t => string.IsNullOrWhiteSpace(t.Etape));
            if (sansEtape > 0)
                Ajouter("workload", "workload.etape", Conseil, Pluriel(sansEtape, "tâche sans étape", "tâches sans étape"),
                    "Elles comptent dans « Sans étape » dans la ventilation et la métrique.");
            var sansPhase = chiffrees.Count(t => string.IsNullOrWhiteSpace(t.Phase));
            if (sansPhase > 0) Ajouter("workload", "workload.phase", Conseil, Pluriel(sansPhase, "tâche sans phase", "tâches sans phase"));
            var sansCharge = tsp.Taches.Count(t => !t.Separateur && Charge(t) == 0 && !string.IsNullOrWhiteSpace(t.Libelle));
            if (sansCharge > 0)
                Ajouter("workload", "workload.sanscharge", Conseil, Pluriel(sansCharge, "tâche sans charge", "tâches sans charge"),
                    "Une ligne sans charge devient un séparateur dans le TSP : chiffrez-la, ou transformez-la en séparateur.");
            if (controles.Count == avant)
                Ajouter("workload", "workload.ok", Ok, "Workload complet",
                    $"{Pluriel(chiffrees.Count, "tâche chiffrée", "tâches chiffrées")}, {Texte.Jh(chiffrees.Sum(Charge))} JH");
        }

        // ---- planning ----
        var planningSaisi = tsp.Planning.Values.Any(m => m.Values.Any(v => v != 0));
        var mois = ClasseurTsp.MoisDuPlanning(tsp);
        if (!planningSaisi)
        {
            if (chiffrees.Count > 0)
                Ajouter("planning", "planning.vide", Conseil, "Planning mensuel non saisi.", "Sans lui, la courbe « prévu » du plan de charge restera vide.");
        }
        else
        {
            var avant = controles.Count;
            foreach (var p in tsp.Profils)
            {
                var reparti = tsp.Planning.TryGetValue(p.Id, out var pm) ? pm.Where(x => mois.Contains(x.Key)).Sum(x => x.Value) : 0;
                var ecart = Texte.Arrondir(reparti - chargeProfil[p.Id]);
                if (ecart < 0) Ajouter("planning", "planning.ecart", Conseil, $"{Texte.Jh(-ecart)} JH de « {Nom(p)} » non répartis sur les mois.",
                    $"{Texte.Jh(chargeProfil[p.Id])} JH au workload, {Texte.Jh(reparti)} JH au planning.");
                else if (ecart > 0) Ajouter("planning", "planning.ecart", Conseil, $"{Texte.Jh(ecart)} JH de trop au planning pour « {Nom(p)} ».",
                    $"{Texte.Jh(chargeProfil[p.Id])} JH au workload, {Texte.Jh(reparti)} JH au planning.");
            }
            if (f.Debut is { } d && f.Fin is { } fin)
            {
                var hors = mois.Where(m => string.CompareOrdinal(m, Calendrier.Mois(d)) < 0 || string.CompareOrdinal(m, Calendrier.Mois(fin)) > 0).ToList();
                if (hors.Count > 0) Ajouter("planning", "planning.hors", Conseil, "Du planning est saisi hors de la période du projet.",
                    "Mois concernés : " + string.Join(", ", hors.Select(Calendrier.MoisFr)) + ".");
            }
            if (controles.Count == avant) Ajouter("planning", "planning.ok", Ok, "Planning cohérent avec le workload");
        }

        // ---- échéancier ----
        if (tsp.Echeances.Count == 0)
            Ajouter("echeancier", "echeancier.aucune", Bloquant, "Aucune échéance de facturation.", "Ajoutez les échéances : leur total doit faire 100 %.");
        else
        {
            var avant = controles.Count;
            var total = tsp.Echeances.Sum(e => e.Pct);
            if (Math.Abs(total - 1) > 0.00005m)
                Ajouter("echeancier", "echeancier.total", Bloquant, $"L’échéancier fait {Pct(total)}.",
                    total < 1 ? $"Il manque {Pct(1 - total)} pour facturer tout le contrat." : $"Il dépasse le contrat de {Pct(total - 1)}.");
            var sansNom = tsp.Echeances.Count(e => string.IsNullOrWhiteSpace(e.Nom));
            if (sansNom > 0) Ajouter("echeancier", "echeancier.nom", Conseil, Pluriel(sansNom, "échéance sans nom", "échéances sans nom"));
            var sansMois = tsp.Echeances.Count(e => !ClasseurTsp.MoisValide(e.Mois));
            if (sansMois > 0)
                Ajouter("echeancier", "echeancier.mois", Conseil, Pluriel(sansMois, "échéance sans mois de facturation", "échéances sans mois de facturation"),
                    "Le mois prévu alimente la facturation et les alertes de retard.");
            if (controles.Count == avant) Ajouter("echeancier", "echeancier.ok", Ok, "Échéancier complet", Pluriel(tsp.Echeances.Count, "échéance", "échéances") + ", 100 %");
        }

        // ---- achats, prestataires et frais (facultatifs) ----
        var lignesDepenses = tsp.Achats.Count + tsp.Prestataires.Count + tsp.Frais.Count;
        if (lignesDepenses > 0)
        {
            var sansLibelle = tsp.Achats.Count(a => string.IsNullOrWhiteSpace(a.Designation)) + tsp.Prestataires.Count(p => string.IsNullOrWhiteSpace(p.Designation))
                + tsp.Frais.Count(x => string.IsNullOrWhiteSpace(x.Libelle));
            if (sansLibelle > 0) Ajouter("depenses", "depenses.libelle", Conseil, Pluriel(sansLibelle, "dépense sans libellé", "dépenses sans libellé"));
            else Ajouter("depenses", "depenses.ok", Ok, "Achats et frais",
                $"{Pluriel(tsp.Achats.Count, "achat", "achats")}, {Pluriel(tsp.Prestataires.Count, "prestataire", "prestataires")}, {Pluriel(tsp.Frais.Count, "ligne de frais", "lignes de frais")}");
        }

        // ---- chiffres du moteur ----
        SyntheseBrouillonDto? synthese = null;
        SyntheseVente? vente = null;
        var parPhase = new List<RepartitionDto>();
        var metrique = new List<MetriqueBrouillonDto>();
        var profils = new List<ProfilBrouillonDto>();
        // deux profils de même nom : le TSP ne sait pas les distinguer, les chiffres seraient faux (le point est déjà bloquant)
        if (tsp.Profils.Count > 0 && chiffrees.Any(t => !string.IsNullOrWhiteSpace(t.Libelle)) && !controles.Any(c => c.Cle == "profils.doublon"))
        {
            ResultatCalcul? c = null;
            try { c = RedactionTsp.Calculer(tsp, contexte, maintenant); }
            catch (RegleMetierException) { /* TSP encore incomplet : pas de chiffres */ }
            if (c is not null)
            {
                var s = c.Synthese;
                vente = s;
                synthese = new SyntheseBrouillonDto(s.MontantProjet, s.Jours, s.Ca, s.Cout, s.TjmClient, s.CjmProd, s.MargeEN, s.MargeAgence,
                    s.ProvJH, s.ProvPct, s.AchatsMt, s.FraisDep, s.MargeNette, s.MargeNettePct);
                parPhase = s.ParPhase.Where(x => x.Charge != 0)
                    .Select(x => new RepartitionDto(string.IsNullOrEmpty(x.Cle) ? "Sans phase" : x.Cle, x.Charge, s.Jours != 0 ? x.Charge / s.Jours : 0)).ToList();
                metrique = c.Metrique.Select(m => new MetriqueBrouillonDto(m.Etape, m.Pct, m.Theorique, m.Propale, m.PctProjet, m.Ecart)).ToList();
                profils = c.Profils.Select(p => new ProfilBrouillonDto(p.I, p.Charge, p.Ca, p.CoutEN, p.MargeEN)).ToList();
            }
        }

        string Etat(string rubrique, bool vide)
        {
            var liste = controles.Where(x => x.Rubrique == rubrique).ToList();
            if (liste.Any(x => x.Niveau == Bloquant)) return Bloquant;
            if (vide) return Vide;
            return liste.Any(x => x.Niveau == Conseil) ? Conseil : Ok;
        }
        var rubriques = new RubriquesDto(
            Etat("fiche", false), Etat("profils", tsp.Profils.Count == 0), Etat("workload", tsp.Taches.Count == 0), Etat("planning", !planningSaisi),
            Etat("echeancier", tsp.Echeances.Count == 0), Etat("depenses", lignesDepenses == 0));

        return new AnalyseBrouillonDto(synthese, parPhase, metrique, profils, controles, rubriques, controles.Count(x => x.Niveau == Bloquant), existant, vente);
    }

    private static string Nom(ProfilSaisi p) => string.IsNullOrWhiteSpace(p.Nom) ? "Profil sans nom" : p.Nom.Trim();

    private static string Pluriel(int n, string singulier, string pluriel) => $"{n} {(n > 1 ? pluriel : singulier)}";

    /// <summary>Pourcentage au format français (« 80 % », « 12,5 % »).</summary>
    private static string Pct(decimal fraction) => (Texte.Arrondir(fraction * 100, 2)).ToString("0.##", Fr) + " %";
}
