namespace PilotageForfaits.Domain.Calcul;

// ============================================================================================
// Résultats du moteur de calcul. Mêmes noms que la version de référence (version HTML), pour que
// les tests comparent automatiquement les deux moteurs. Rien de tout cela n'est stocké en base :
// tout est recalculé à chaque demande à partir des saisies.
// ============================================================================================

/// <summary>Tous les indicateurs d'un projet.</summary>
public sealed class ResultatCalcul
{
    public required List<ProfilPersonne> P { get; init; }
    /// <summary>Mois affichés (AAAA-MM) : période du projet, élargie aux mois qui portent des données.</summary>
    public required List<string> Months { get; init; }
    /// <summary>Premier et dernier mois de la période du projet (AAAA-MM) : les autres mois affichés sont « hors période ».</summary>
    public string MoisDebut { get; init; } = "";
    public string MoisFin { get; init; } = "";
    public required CalendrierProjet Cal { get; init; }
    public required DimensionRegroupement Dim { get; init; }
    public required List<TacheCalculee> Tasks { get; init; }
    public required List<ProfilCalcule> Profils { get; init; }
    public required SyntheseVente Synthese { get; init; }
    public required VentilationVente Ventilation { get; init; }
    public required List<MetriqueCalculee> Metrique { get; init; }
    public required List<GroupeCalcule> Axes { get; init; }
    public required StatistiquesTaches Total { get; init; }
    public required List<MoisCalcule> Mensuel { get; init; }
    /// <summary>Total du prévisionnel de charge (au départ, copie du planning vendu).</summary>
    public decimal RefTotal { get; init; }
    /// <summary>Total du planning vendu (TSP).</summary>
    public decimal TspTotal { get; init; }
    /// <summary>Au moins une valeur (profil × mois) du prévisionnel diffère du planning vendu.</summary>
    public bool Replanifie { get; init; }
    /// <summary>Jalons du projet, dans l'ordre des dates.</summary>
    public required List<JalonCalcule> Jalons { get; init; }
    /// <summary>Codes d'axe portés par au moins une tâche, dans l'ordre (couleur des axes quand on regroupe par lot ou par phase).</summary>
    public required List<string> AxeIdsActifs { get; init; }
    public required ArbreAvancement Avancement { get; init; }
    public required Financier Financier { get; init; }
    public required Perimetre Perimetre { get; init; }
    public required List<SurchargeJour> SurJours { get; init; }
    public required List<EcheanceCalculee> Echeancier { get; init; }
    public required SyntheseEcheances EchSynth { get; init; }
    public required List<RisqueCalcule> Risques { get; init; }
    public required AteliersEtLivrables Ateliers { get; init; }
    public required IndicateursIa Ia { get; init; }
    public required List<PointVigilance> Vigilance { get; init; }
    /// <summary>Uid des tâches à faire sans dates prévues.</summary>
    public required List<string> NonDatees { get; init; }
}

/// <summary>Profil tel qu'affiché (nom différencié si deux profils portent le même intitulé) avec son TJM remisé.</summary>
public sealed class ProfilPersonne
{
    public int I { get; init; }
    public string Nom { get; init; } = "";
    public string NomBase { get; init; } = "";
    public string Entite { get; init; } = "FO";
    public decimal Tjm { get; init; }
    /// <summary>TJM après remise.</summary>
    public decimal TjmR { get; init; }
    public decimal Cjm { get; init; }
    public decimal? Prcs { get; init; }
    public decimal Frais { get; init; }
    public string Collaborateur { get; init; } = "";
    public bool EstAjout { get; init; }
}

public sealed class TacheCalculee
{
    public string Uid { get; init; } = "";
    public int? Ligne { get; init; }
    public string Id { get; init; } = "";
    public string Label { get; init; } = "";
    public string LabelTSP { get; init; } = "";
    public string Axe { get; init; } = "";
    public string Phase { get; init; } = "";
    public string Lot { get; init; } = "";
    public string Etape { get; init; } = "";
    public string Hypothese { get; init; } = "";
    public decimal Charge { get; init; }
    public List<decimal> Charges { get; init; } = new();
    public List<decimal> ChargesV { get; init; } = new();
    public List<decimal> ChargesA { get; init; } = new();
    public decimal ChargeTSP { get; init; }
    public decimal ChargeAjout { get; init; }
    public bool EstAjout { get; init; }
    public bool Annulee { get; init; }
    public AnnulationCalcul? Annul { get; init; }
    public decimal ChargeInit { get; init; }
    public List<decimal> ChargesAnnul { get; init; } = new();
    public decimal ChargeAnnulee { get; init; }
    public decimal CoutAnnule { get; init; }
    public decimal CaAvenant { get; init; }
    public decimal Valo { get; init; }
    public decimal CoutPrevu { get; init; }
    public decimal CoutPrevuTSP { get; init; }
    public decimal CoutAjout { get; init; }
    /// <summary>Charge déplacée par les réaffectations, par profil (négative pour qui cède, positive pour qui reçoit ; somme nulle).</summary>
    public List<decimal> ChargesR { get; init; } = new();
    public List<ReaffectationCalcul> Reaff { get; init; } = new();
    /// <summary>Écart de coût des réaffectations de la tâche (nul si les CJM sont identiques).</summary>
    public decimal CoutReaff { get; init; }
    public decimal CjmMoyen { get; init; }
    public decimal TjmMoyen { get; init; }
    public decimal ConsoTotal { get; init; }
    public List<decimal> ConsoP { get; init; } = new();
    public List<decimal> RestP { get; init; } = new();
    public string Statut { get; init; } = "";
    public decimal Avancement { get; init; }
    public decimal RafAuto { get; init; }
    public decimal? RafSaisi { get; init; }
    public decimal Raf { get; init; }
    public decimal Atterrissage { get; init; }
    public decimal Ecart { get; init; }
    public bool RafAReestimer { get; init; }
    public decimal? RafSuggere { get; init; }
    public bool RafIncoherent { get; init; }
    public decimal CoutConso { get; init; }
    public decimal CoutRaf { get; init; }
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
    public bool DebutAuto { get; init; }
    public bool FinAuto { get; init; }
    public string Type { get; init; } = "";
    public bool TypeManuel { get; init; }
    /// <summary>Profil le plus chargé de la tâche (hors Agent IA).</summary>
    public string Responsable { get; init; } = "";
    /// <summary>Enveloppe Agent IA de la tâche (JH).</summary>
    public decimal Ia { get; init; }
    public decimal? IaRev { get; init; }
    public decimal? IaGain { get; init; }
    /// <summary>Charge des autres profils (humains).</summary>
    public decimal IaHum { get; init; }
    /// <summary>Enveloppe IA consommée : max(consommé total − charge des autres profils ; 0).</summary>
    public decimal IaConso { get; init; }
    /// <summary>Résultat IA : enveloppe − IA consommée (projection tant que la tâche n'est pas terminée).</summary>
    public decimal? IaRes { get; init; }
    /// <summary>totale, partielle, conforme, depassement, encours, avenir ou annulee.</summary>
    public string? IaStatut { get; init; }
    public bool IaAJustifier { get; init; }
    public string IaType { get; init; } = "";
    public string IaJustif { get; init; } = "";
    public string Commentaire { get; init; } = "";
    /// <summary>Jours avec du consommé, triés.</summary>
    public List<DateOnly> ConsoDates { get; init; } = new();
    /// <summary>Date de réalisation (livrable : « livré le ») = dernier jour de consommé une fois la tâche validée.</summary>
    public DateOnly? RealiseLe { get; init; }
    public DateOnly? DebutPrevu { get; init; }
    public DateOnly? FinPrevue { get; init; }
    /// <summary>Numéro de l'échéance de facturation liée (directement ou par sa phase).</summary>
    public int? EchN { get; set; }
    public bool EchViaPhase { get; set; }
    /// <summary>Code du groupe d'affichage (axe, lot ou phase selon le regroupement choisi).</summary>
    public string Grp { get; set; } = "";
}

public sealed class ProfilCalcule
{
    public int I { get; init; }
    public string Nom { get; init; } = "";
    public string Entite { get; init; } = "";
    public decimal Tjm { get; init; }
    public decimal Cjm { get; init; }
    /// <summary>Charge vendue au TSP (JH).</summary>
    public decimal Charge { get; init; }
    public decimal Ca { get; init; }
    public decimal CoutEN { get; init; }
    public decimal CoutAgence { get; init; }
    /// <summary>Coût de revient journalier agence (CESSION, ACHAT, BO).</summary>
    public decimal? Tci { get; init; }
    public decimal? MargeEN { get; init; }
    public decimal? MargeAgence { get; init; }
    public decimal? PctJH { get; set; }
    public decimal? PctCA { get; set; }
    public decimal AjoutJH { get; init; }
    public decimal AjoutCout { get; init; }
}

public sealed class SyntheseVente
{
    public decimal MontantProjet { get; init; }
    public decimal Jours { get; init; }
    public decimal Ca { get; init; }
    public decimal Cout { get; init; }
    public decimal CoutAgence { get; init; }
    public decimal? CjmProd { get; init; }
    public decimal? TjmClient { get; init; }
    public decimal? MargeAgence { get; init; }
    public decimal? MargeEN { get; init; }
    public decimal FraisDep { get; init; }
    public decimal FraisRef { get; init; }
    public decimal? FraisNonRefJour { get; init; }
    public decimal ProvJH { get; init; }
    public decimal ProvEur { get; init; }
    public decimal? ProvPct { get; init; }
    public decimal AchatsMt { get; init; }
    public decimal AchatsRef { get; init; }
    public decimal MargeAchats { get; init; }
    public decimal? MargeAchatsPct { get; init; }
    public decimal MargeNette { get; init; }
    public decimal? MargeNettePct { get; init; }
    public List<LigneEntite> ParEntite { get; init; } = new();
    public List<LignePivot> ParPhase { get; init; } = new();
    public List<LignePivot> ParEtape { get; init; } = new();
    /// <summary>Les cinq entités (FO, CESSION, ACHAT, BO, ACHAT BO), même vides, dans l'ordre de l'onglet SYNTHESE.</summary>
    public List<LigneEntite> Entites { get; init; } = new();
    /// <summary>BO + ACHAT BO.</summary>
    public LigneEntite? TotalBo { get; init; }
    /// <summary>Coût agence des profils BO et ACHAT BO ÷ leurs jours.</summary>
    public decimal? PrcsMoyenBack { get; init; }
    /// <summary>(TJM du TOTAL BO − PRCS moyen du BACK) ÷ TJM du TOTAL BO.</summary>
    public decimal? MargeFrontBack { get; init; }
    /// <summary>Tâches vendues (charge non nulle) : lot, phase, étape, charge et valorisation.</summary>
    public List<LigneVente> Lignes { get; init; } = new();
}

public sealed class LigneVente
{
    public string Lot { get; init; } = "";
    public string Phase { get; init; } = "";
    public string Etape { get; init; } = "";
    public decimal Charge { get; init; }
    public decimal Valo { get; init; }
}

public sealed class LigneEntite
{
    public string Entite { get; init; } = "";
    public decimal Jours { get; init; }
    public decimal Ca { get; init; }
    public decimal? Tjm { get; init; }
    public decimal? Cjm { get; init; }
    public decimal? CoutAgenceJour { get; init; }
    public decimal? MargeEN { get; init; }
    public decimal? MargeAgence { get; init; }
}

public sealed class LignePivot
{
    public string Cle { get; init; } = "";
    public decimal Charge { get; set; }
    public decimal Valo { get; set; }
}

public sealed class VentilationVente
{
    public List<LigneVentilation> ParPhase { get; init; } = new();
    public List<LigneVentilation> ParEtape { get; init; } = new();
    public List<decimal> TotalProfil { get; init; } = new();
    public List<decimal> MontantProfil { get; init; } = new();
    public decimal SansEtape { get; init; }
    public List<decimal> SansEtapeParProfil { get; init; } = new();
}

public sealed class LigneVentilation
{
    public string Cle { get; init; } = "";
    public List<decimal> ParProfil { get; init; } = new();
    public decimal Total { get; init; }
}

public sealed class MetriqueCalculee
{
    public string Etape { get; init; } = "";
    public decimal Pct { get; init; }
    public decimal Theorique { get; init; }
    public decimal Propale { get; init; }
    public decimal? PctProjet { get; init; }
    public decimal? Ecart { get; init; }
}

/// <summary>Statistiques d'un ensemble de tâches (un axe, un lot, une phase ou le projet entier).</summary>
public class StatistiquesTaches
{
    public int N { get; init; }
    public decimal Prevu { get; init; }
    public decimal Conso { get; init; }
    public decimal Raf { get; init; }
    public decimal Atterrissage { get; init; }
    public decimal Ecart { get; init; }
    public decimal PrevuTSP { get; init; }
    public decimal Ajout { get; init; }
    public int NAjout { get; init; }
    public decimal Annule { get; init; }
    public int NAnnul { get; init; }
    public decimal CoutPrevu { get; init; }
    public decimal CoutConso { get; init; }
    public decimal CoutRaf { get; init; }
    public decimal CoutFinal { get; init; }
    public List<decimal> PrevuP { get; init; } = new();
    public List<decimal> ConsoP { get; init; } = new();
    public DateOnly? PrevuDebut { get; init; }
    public DateOnly? PrevuFin { get; init; }
    public DateOnly? ReelDebut { get; init; }
    public DateOnly? ReelFin { get; init; }
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
    public int Dated { get; init; }
    public int Valides { get; init; }
    public int Actives { get; init; }
    /// <summary>Avancement = JH des tâches validées ÷ JH prévus (une tâche compte quand elle est validée, au poids de sa charge).</summary>
    public decimal Avancement { get; init; }
    /// <summary>Avancement déclaré pondéré par la charge (paliers saisis dans Workload) : indication seulement, jamais affiché comme l'avancement.</summary>
    public decimal AvDeclare { get; init; }
    public string Statut { get; init; } = "";
    public int Ateliers { get; init; }
    public int AteliersOK { get; init; }
    public int Livrables { get; init; }
    public int LivrablesOK { get; init; }
    public decimal Ia { get; init; }
    public decimal IaRetenu { get; init; }
    public decimal IaRes { get; init; }

    public StatistiquesTaches() { }

    /// <summary>Copie des statistiques (un groupe affiché part des statistiques de ses tâches).</summary>
    protected StatistiquesTaches(StatistiquesTaches s)
    {
        N = s.N;
        Prevu = s.Prevu;
        Conso = s.Conso;
        Raf = s.Raf;
        Atterrissage = s.Atterrissage;
        Ecart = s.Ecart;
        PrevuTSP = s.PrevuTSP;
        Ajout = s.Ajout;
        NAjout = s.NAjout;
        Annule = s.Annule;
        NAnnul = s.NAnnul;
        CoutPrevu = s.CoutPrevu;
        CoutConso = s.CoutConso;
        CoutRaf = s.CoutRaf;
        CoutFinal = s.CoutFinal;
        PrevuP = s.PrevuP;
        ConsoP = s.ConsoP;
        PrevuDebut = s.PrevuDebut;
        PrevuFin = s.PrevuFin;
        ReelDebut = s.ReelDebut;
        ReelFin = s.ReelFin;
        Debut = s.Debut;
        Fin = s.Fin;
        Dated = s.Dated;
        Valides = s.Valides;
        Actives = s.Actives;
        Avancement = s.Avancement;
        AvDeclare = s.AvDeclare;
        Statut = s.Statut;
        Ateliers = s.Ateliers;
        AteliersOK = s.AteliersOK;
        Livrables = s.Livrables;
        LivrablesOK = s.LivrablesOK;
        Ia = s.Ia;
        IaRetenu = s.IaRetenu;
        IaRes = s.IaRes;
    }
}

/// <summary>Ligne du Planning (groupe ou sous-partie) : statistiques et dates prévues, saisies ou calculées.</summary>
public abstract class LignePlanifiee : StatistiquesTaches
{
    protected LignePlanifiee() { }
    protected LignePlanifiee(StatistiquesTaches s) : base(s) { }
    /// <summary>Clé de la ligne dans le planning (« id|AXE1 », « phase|CONCEPTION », « sec|uid|AXE1 »…).</summary>
    public string Cle { get; set; } = "";
    /// <summary>Prévu de la ligne : dates saisies dans le Planning, sinon premier début / dernière fin prévus des tâches.</summary>
    public DateOnly? PlanDebut { get; set; }
    public DateOnly? PlanFin { get; set; }
    public bool PlanSaisi { get; set; }
    public bool PlanDebutSaisi { get; set; }
    public bool PlanFinSaisi { get; set; }
}

/// <summary>Un groupe affiché (axe, lot ou phase) avec ses statistiques.</summary>
public sealed class GroupeCalcule : LignePlanifiee
{
    public GroupeCalcule() { }
    public GroupeCalcule(StatistiquesTaches s) : base(s) { }
    public string Id { get; init; } = "";
    public string Nom { get; init; } = "";
    /// <summary>Axe découpé en sous-parties : son prévu va du plus tôt au plus tard de ce qu'il contient, sans saisie propre.</summary>
    public bool PlanCalcule { get; set; }
    /// <summary>Axe découpé dont au moins une sous-partie a des dates saisies (sinon tout son prévu vient des tâches : pointillé).</summary>
    public bool PlanDeSaisies { get; set; }
    /// <summary>Dates saisies sur l'axe avant son découpage : gardées, signalées dans son détail, plus utilisées.</summary>
    public PeriodeCalculee? PlanAncien { get; set; }
    /// <summary>Sous-parties de l'axe (regroupement par axe) : les lignes de titre du TSP qui précèdent ses tâches.</summary>
    public List<SousPartieCalculee> SousParties { get; set; } = new();
}

/// <summary>Sous-partie d'un axe : une ligne de titre du TSP (intitulé sans charge) et les tâches de l'axe placées dessous.</summary>
public sealed class SousPartieCalculee : LignePlanifiee
{
    public SousPartieCalculee(StatistiquesTaches s) : base(s) { }
    /// <summary>Uid de la ligne de titre.</summary>
    public string Id { get; init; } = "";
    /// <summary>Nom choisi dans le Planning, sinon l'intitulé du TSP.</summary>
    public string Nom { get; init; } = "";
    public string NomTSP { get; init; } = "";
    public string Axe { get; init; } = "";
    public List<string> Uids { get; init; } = new();
}

public sealed class PeriodeCalculee
{
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
}

/// <summary>Jalon du projet, numéroté dans l'ordre des dates (un jalon « à confirmer » n'a pas de numéro).</summary>
public sealed class JalonCalcule
{
    public string Id { get; init; } = "";
    public string Libelle { get; init; } = "";
    public string Type { get; init; } = "date";
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
    public bool AConfirmer { get; init; }
    public int? Numero { get; init; }
}

/// <summary>
/// Avancement détaillé : chaque groupe du regroupement choisi, ses sous-parties (le lot quand on regroupe par axe ou par phase,
/// la phase quand on regroupe par lot), puis leurs tâches. Mêmes indicateurs qu'au tableau de bord : aucun chiffre nouveau.
/// </summary>
public sealed class ArbreAvancement
{
    /// <summary>« lot » ou « phase » : ce qui découpe chaque groupe.</summary>
    public string Cle { get; init; } = "lot";
    public List<GroupeAvancement> Groupes { get; init; } = new();
}

public sealed class GroupeAvancement
{
    /// <summary>Identifiant du groupe (même ordre et mêmes indicateurs que Axes).</summary>
    public string Id { get; init; } = "";
    public string Nom { get; init; } = "";
    public List<SousGroupeAvancement> Sous { get; init; } = new();
}

public sealed class SousGroupeAvancement
{
    public string Id { get; init; } = "";
    public string Nom { get; init; } = "";
    public required StatistiquesTaches Stat { get; init; }
    /// <summary>Uid des tâches, dans l'ordre du WORKLOAD.</summary>
    public List<string> Taches { get; init; } = new();
}

public sealed class DimensionRegroupement
{
    public string Key { get; init; } = "id";
    public string Label { get; init; } = "Axe";
    public string Col { get; init; } = "";
}

public sealed class MoisCalcule
{
    public string Mois { get; init; } = "";
    public List<decimal> ConsoP { get; init; } = new();
    public decimal Conso { get; init; }
    public List<decimal> RefP { get; init; } = new();
    public decimal Ref { get; init; }
    /// <summary>Planning vendu (TSP) du mois, par profil : référence initiale, jamais modifiée.</summary>
    public List<decimal> TspP { get; init; } = new();
    public decimal Tsp { get; init; }
    public decimal CoutCJM { get; init; }
    public decimal CumCJM { get; init; }
    public decimal ValoTJM { get; init; }
    public decimal CumTJM { get; init; }
    public decimal RefTJM { get; init; }
    public decimal CumRefTJM { get; init; }
}

public sealed class Financier
{
    /// <summary>CA du forfait, diminué des avenants de réduction.</summary>
    public decimal Ca { get; init; }
    public decimal CaTSP { get; init; }
    public decimal CaAvenant { get; init; }
    public decimal CoutInitial { get; init; }
    public decimal CoutAjout { get; init; }
    public decimal CoutAnnule { get; init; }
    public decimal CoutReaff { get; init; }
    public decimal CoutPrevu { get; init; }
    public decimal CoutConso { get; init; }
    public decimal CoutRaf { get; init; }
    public decimal CoutFinal { get; init; }
    public decimal Marge { get; init; }
    public decimal TauxMarge { get; init; }
    public decimal EcartCout { get; init; }
    public required AchatsCalcules Achats { get; init; }
    public required FraisCalcules Frais { get; init; }
    public decimal MargeNette { get; init; }
    public decimal TauxMargeNette { get; init; }
    public decimal MargeNetteVendue { get; init; }
    public decimal? TauxMargeNetteVendue { get; init; }
}

public sealed class AchatsCalcules
{
    public List<LigneAchatBudget> ParLigne { get; init; } = new();
    /// <summary>Index (dans AchatsReel) des achats hors TSP.</summary>
    public List<int> Hors { get; init; } = new();
    public decimal Budget { get; init; }
    public decimal BudgetRev { get; init; }
    public decimal Reel { get; init; }
    public decimal ReelRev { get; init; }
    public decimal HorsTSP { get; init; }
    public decimal Att { get; init; }
    public decimal AttRev { get; init; }
    public decimal Reste { get; init; }
    public decimal Depasse { get; init; }
    public decimal ImpactNet { get; init; }
    public List<MontantParCle> ParStatut { get; init; } = new();
}

public sealed class LigneAchatBudget
{
    public int I { get; init; }
    public string Designation { get; init; } = "";
    public decimal Budget { get; init; }
    public decimal BudgetRev { get; init; }
    public decimal Reel { get; init; }
    public decimal ReelRev { get; init; }
    public int N { get; init; }
    public decimal Att { get; init; }
    public decimal AttRev { get; init; }
}

public sealed class FraisCalcules
{
    public decimal Budget { get; init; }
    public decimal BudgetRef { get; init; }
    public decimal Reel { get; init; }
    public decimal ReelRef { get; init; }
    /// <summary>Frais réels non refacturés (à notre charge).</summary>
    public decimal ReelNonRef { get; init; }
    /// <summary>Part des frais prévue à notre charge au TSP : budget − refacturé (0 si tout est refacturé).</summary>
    public decimal BudgetNonRef { get; init; }
    /// <summary>Coût prévu des frais refacturables : budget − part à notre charge.</summary>
    public decimal BudgetRefCout { get; init; }
    /// <summary>Atterrissage des frais refacturables : le plus élevé du budget refacturable et du réel refacturable.</summary>
    public decimal AttRefCout { get; init; }
    /// <summary>Atterrissage des frais à notre charge : le plus élevé de la part prévue et du réel non refacturé.</summary>
    public decimal AttNonRef { get; init; }
    public decimal Att { get; init; }
    public decimal AttRef { get; init; }
    public decimal Reste { get; init; }
    public decimal Depasse { get; init; }
    public decimal ImpactNet { get; init; }
    public List<MontantParCle> ParCategorie { get; init; } = new();
    public List<MontantParCle> ParCollab { get; init; } = new();
}

public sealed class MontantParCle
{
    public string Cle { get; init; } = "";
    public int N { get; init; }
    public decimal Montant { get; init; }
}

public sealed class Perimetre
{
    public decimal ChargeTSP { get; init; }
    public decimal ChargeAjout { get; init; }
    public decimal ChargeAnnulee { get; init; }
    public decimal ChargeActuelle { get; init; }
    public decimal CoutAjout { get; init; }
    public decimal CoutAnnule { get; init; }
    public decimal CoutReaff { get; init; }
    public decimal CaAvenant { get; init; }
    public int NReaff { get; init; }
    public int NTaches { get; init; }
    public int NProfilsTache { get; init; }
    public int NAnnul { get; init; }
    public List<int> ProfilsAjoutes { get; init; } = new();
    public List<LignePerimetre> Lignes { get; init; } = new();
    public decimal? MargeVendue { get; init; }
    public decimal? MargeAvecAjouts { get; init; }
}

/// <summary>
/// Une évolution du périmètre : nouvelle tâche (« tache »), charge ajoutée sur un profil (« profil »), annulation (« annul »)
/// ou réaffectation de charge d'un profil à un autre (« reaff »).
/// </summary>
public sealed class LignePerimetre
{
    public string Kind { get; init; } = "";
    public string Uid { get; init; } = "";
    public string Label { get; init; } = "";
    public int? I { get; init; }
    /// <summary>Réaffectation : identifiant, profil qui cède et profil qui reçoit (index).</summary>
    public string? Id { get; init; }
    public int? De { get; init; }
    public int? Vers { get; init; }
    public List<string> Profils { get; init; } = new();
    public decimal Jh { get; init; }
    public decimal Cout { get; init; }
    public decimal Conso { get; init; }
    public bool Avenant { get; init; }
    public decimal CaAvenant { get; init; }
    public string? At { get; init; }
    public string? By { get; init; }
    public string? Motif { get; init; }
}

public sealed class SurchargeJour
{
    /// <summary>Index du profil.</summary>
    public int I { get; init; }
    public DateOnly D { get; init; }
    public decimal V { get; init; }
}

public sealed class EcheanceCalculee
{
    public int N { get; init; }
    public string Nom { get; init; } = "";
    public decimal Pct { get; init; }
    public decimal Montant { get; init; }
    public decimal MontantInit { get; init; }
    public decimal AjustAvenant { get; init; }
    /// <summary>Mois de facturation retenu (celui de la date prévue).</summary>
    public string? Mois { get; init; }
    public string? MoisTSP { get; init; }
    public DateOnly? DatePrevue { get; init; }
    public bool DatePrevueAuto { get; init; }
    public DateOnly? RealiseLe { get; init; }
    public DateOnly? PayeeLe { get; init; }
    public string Commentaire { get; init; } = "";
    public List<string> Phases { get; init; } = new();
    public List<string> Lies { get; init; } = new();
    public int NLies { get; init; }
    public int NLiesValides { get; init; }
    public decimal? AvLie { get; init; }
    /// <summary>Toutes les tâches liées sont validées : l'échéance peut être facturée.</summary>
    public bool Pret { get; init; }
    public int? Jours { get; init; }
    /// <summary>Planifiée, En retard, Facturée ou Payée.</summary>
    public string Statut { get; init; } = "";
    public bool ApresFin { get; init; }
    public decimal FactCum { get; set; }
    public decimal? ProdPlan { get; set; }
    public decimal? FaePlan { get; set; }
    public decimal? FactReel { get; set; }
    public decimal? ProdReel { get; set; }
    public decimal? FaeReel { get; set; }
    public decimal? FaePlanPct { get; set; }
    public decimal? FaeReelPct { get; set; }
}

public sealed class SyntheseEcheances
{
    public decimal Facture { get; init; }
    public decimal Paye { get; init; }
    public decimal Reste { get; init; }
    public decimal Produit { get; init; }
    public decimal FaeADate { get; init; }
    public decimal AjustAvenant { get; init; }
}

public sealed class RisqueCalcule
{
    public string Ref { get; init; } = "";
    public string Libelle { get; init; } = "";
    public string Proba { get; init; } = "";
    public string Impact { get; init; } = "";
    public string Statut { get; init; } = "";
    /// <summary>Criticité = probabilité × importance (1 à 16).</summary>
    public int Crit { get; init; }
    /// <summary>faible (1 à 3), moyen (4 à 6) ou fort (8 et plus).</summary>
    public string Niveau { get; init; } = "faible";
    public bool Ouvert { get; init; }
}

public sealed class AteliersEtLivrables
{
    public CompteurType Ateliers { get; init; } = new();
    public CompteurType Livrables { get; init; } = new();
    public List<CompteurParType> ParType { get; init; } = new();
}

public class CompteurType
{
    public int Prevus { get; init; }
    public int Realises { get; init; }
    public int Restants { get; init; }
    public decimal Taux { get; init; }
}

public sealed class CompteurParType : CompteurType
{
    public string Id { get; init; } = "";
    public string Nom { get; init; } = "";
    public bool Socle { get; init; }
    public int Annules { get; init; }
    public decimal Charge { get; init; }
}

public sealed class IndicateursIa
{
    public string? Profil { get; init; }
    public decimal Ref { get; init; }
    public decimal Consomme { get; init; }
    public decimal Realise { get; init; }
    public decimal EnvVal { get; init; }
    public decimal Projection { get; init; }
    public decimal Taux { get; init; }
    public decimal TauxProj { get; init; }
    public decimal ValeurTJM { get; init; }
    public decimal ValeurCJM { get; init; }
    public decimal ProjTJM { get; init; }
    public decimal Tjm { get; init; }
    public decimal Cjm { get; init; }
    public int Validees { get; init; }
    public List<string> AJustifier { get; init; } = new();
    public List<IaParType> ParType { get; init; } = new();
    public List<string> Leviers { get; init; } = new();
    public List<string> Causes { get; init; } = new();
    public List<string> Tasks { get; init; } = new();
}

public sealed class IaParType
{
    public string Type { get; init; } = "";
    public int N { get; set; }
    public decimal Jh { get; set; }
    /// <summary>« eco » (économie) ou « dep » (dépassement).</summary>
    public string Sens { get; init; } = "";
}

/// <summary>Point de vigilance (alimente le tableau de bord et le bloc « À traiter »).</summary>
public sealed class PointVigilance
{
    public string Cle { get; init; } = "";
    public string Label { get; init; } = "";
    /// <summary>Nombre (ou « ! » pour des dates manquantes).</summary>
    public object Valeur { get; init; } = 0;
    public string? Unite { get; init; }
    /// <summary>critique, attention ou ok.</summary>
    public string Niveau { get; init; } = "ok";
    public string? Detail { get; init; }
}

public sealed class CalendrierProjet
{
    public DateOnly? Debut { get; init; }
    public DateOnly? FinContrat { get; init; }
    public DateOnly? FinPrevue { get; init; }
    public int? JoursTotal { get; set; }
    public int? JoursEcoules { get; set; }
    public int? JoursRestants { get; set; }
    public decimal? TempsPct { get; set; }
    public decimal? ConsoPct { get; set; }
    public int? GlissementJours { get; set; }
    public int? GlissementOuvres { get; set; }
}
