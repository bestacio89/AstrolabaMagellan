namespace PilotageForfaits.Domain.Calcul;

// ============================================================================================
// Données d'entrée du moteur de calcul.
// Elles reprennent la forme et les noms du fichier de suivi de la version de référence (version HTML du 18/10/2026) :
// c'est ce qui permet de comparer automatiquement le moteur C# au moteur d'origine (voir les tests).
// La couche Application construit ces objets à partir de la base de données.
// Les profils sont repérés par leur position dans la liste « Profiles » (index 0, 1, 2…).
// ============================================================================================

/// <summary>Tout ce que le moteur doit savoir d'un projet pour calculer ses indicateurs.</summary>
public sealed class ProjetCalcul
{
    /// <summary>Remise commerciale du TSP (0,05 = 5 %).</summary>
    public decimal Remise { get; set; }
    public List<ProfilCalcul> Profiles { get; set; } = new();
    /// <summary>Lignes du WORKLOAD (y compris les lignes de section) et tâches ajoutées, dans l'ordre d'affichage.</summary>
    public List<TacheCalcul> Tasks { get; set; } = new();
    /// <summary>Suivi de chaque tâche, par identifiant de tâche (Uid).</summary>
    public Dictionary<string, SuiviTacheCalcul> Track { get; set; } = new();
    public ParametresCalcul Settings { get; set; } = new();
    public DatesProjetCalcul Dates { get; set; } = new();
    public ReferentielCalcul Ref { get; set; } = new();
    /// <summary>Nom choisi pour chaque code d'axe (colonne A du TSP).</summary>
    public Dictionary<string, string> Axes { get; set; } = new();
    /// <summary>Types de tâche (Atelier, Livrable et types ajoutés). Null : types socle uniquement.</summary>
    public List<TypeTacheCalcul>? Types { get; set; }
    public List<FraisBudgetCalcul> Frais { get; set; } = new();
    public List<AchatBudgetCalcul> Achats { get; set; } = new();
    public List<PrestataireCalcul> Prestas { get; set; } = new();
    public List<MetriqueCalcul> Metrique { get; set; } = new();
    /// <summary>Prévisionnel de charge par profil et par mois : au départ une copie du planning vendu, replanifiable en cours de projet.</summary>
    public PlanningProfilsCalcul PlanningRef { get; set; } = new();
    /// <summary>Planning vendu (onglet PLANNING du TSP), figé à l'import et jamais modifié. Null : suivi antérieur, le prévisionnel en tient lieu.</summary>
    public PlanningProfilsCalcul? PlanningTsp { get; set; }
    public PlanningPhasesCalcul? PlanningPhases { get; set; }
    public List<EcheanceCalcul> Echeancier { get; set; } = new();
    /// <summary>Suivi de chaque échéance, par numéro d'échéance.</summary>
    public Dictionary<int, SuiviEcheanceCalcul> EchTrack { get; set; } = new();
    public List<AchatReelCalcul> AchatsReel { get; set; } = new();
    public List<FraisReelCalcul> FraisReel { get; set; } = new();
    public List<ActionCalcul> Actions { get; set; } = new();
    public List<DecisionCalcul> Decisions { get; set; } = new();
    public List<RisqueCalcul> Risques { get; set; } = new();
    /// <summary>Planning (vue d'ensemble) : dates prévues saisies par ligne et jalons du projet.</summary>
    public PlanningCalcul? Planning { get; set; }
}

/// <summary>Planning de la vue d'ensemble : ce que le chef de projet saisit en plus des dates des tâches.</summary>
public sealed class PlanningCalcul
{
    /// <summary>
    /// Dates prévues (et nom d'une sous-partie) par clé de ligne : « id|AXE1 », « lot|1.1 », « phase|CONCEPTION » pour une ligne
    /// du regroupement, « sec|uid|AXE1 » pour les dates d'une sous-partie (ligne de titre du TSP), « sec|uid » pour son nom.
    /// </summary>
    public Dictionary<string, DatesLignePlanningCalcul> Groupes { get; set; } = new();
    public List<JalonCalcul> Jalons { get; set; } = new();
}

public sealed class DatesLignePlanningCalcul
{
    public DateOnly? Debut { get; set; }
    public DateOnly? Fin { get; set; }
    /// <summary>Nom choisi pour une sous-partie (vide : intitulé de la ligne de titre du TSP).</summary>
    public string? Nom { get; set; }
}

/// <summary>Jalon du projet : une date (« date ») ou une période (« periode »), éventuellement à confirmer.</summary>
public sealed class JalonCalcul
{
    public string Id { get; set; } = "";
    public string Libelle { get; set; } = "";
    public string Type { get; set; } = "date";
    public DateOnly? Debut { get; set; }
    public DateOnly? Fin { get; set; }
    public bool AConfirmer { get; set; }
}

/// <summary>Profil vendu au TSP ou ajouté en cours de projet. Un profil = une personne.</summary>
public sealed class ProfilCalcul
{
    public string Nom { get; set; } = "";
    /// <summary>FO, BO, CESSION, ACHAT ou ACHAT BO.</summary>
    public string Entite { get; set; } = "FO";
    public decimal Tjm { get; set; }
    public decimal Cjm { get; set; }
    public decimal? Prcs { get; set; }
    public decimal Frais { get; set; }
    public string Collaborateur { get; set; } = "";
    /// <summary>Renseigné quand le profil a été ajouté en cours de projet.</summary>
    public AjoutCalcul? Ajout { get; set; }
}

/// <summary>Trace d'un ajout (tâche, profil ou charge) : quand, par qui, pourquoi.</summary>
public sealed class AjoutCalcul
{
    public string? At { get; set; }
    public string? By { get; set; }
    public string? Motif { get; set; }
    /// <summary>Tâche après laquelle une tâche ajoutée est insérée.</summary>
    public string? After { get; set; }
}

/// <summary>Ligne du WORKLOAD du TSP (valeurs vendues, figées) ou tâche ajoutée.</summary>
public sealed class TacheCalcul
{
    public string Uid { get; set; } = "";
    public int? Ligne { get; set; }
    /// <summary>Code de l'axe (colonne A du TSP).</summary>
    public string Id { get; set; } = "";
    public string Lot { get; set; } = "";
    public string Phase { get; set; } = "";
    public string Etape { get; set; } = "";
    public string Label { get; set; } = "";
    /// <summary>Charge vendue de chaque profil (même ordre que la liste des profils).</summary>
    public List<decimal> Charges { get; set; } = new();
    /// <summary>Ligne de titre du WORKLOAD (aucune charge) : ce n'est pas une tâche.</summary>
    public bool Section { get; set; }
    /// <summary>Marqueur « livrable » du TSP (« oui » si la tâche produit un livrable).</summary>
    public string Livrable { get; set; } = "";
    public string Hypothese { get; set; } = "";
    public AjoutCalcul? Ajout { get; set; }
    /// <summary>
    /// TSP dont la colonne « Livrable » du WORKLOAD est renseignée (au moins un « oui ») : la colonne seule dit ce qu'est un
    /// livrable, le titre n'est plus regardé. Repère posé à l'import ; un projet lancé avant cette règle ne l'a pas.
    /// </summary>
    public bool LivCol { get; set; }
}

/// <summary>Annulation d'une tâche.</summary>
public sealed class AnnulationCalcul
{
    public string? At { get; set; }
    public string? By { get; set; }
    public string? Motif { get; set; }
    /// <summary>Avenant de réduction : le chiffre d'affaires baisse de la part vendue non réalisée.</summary>
    public bool Avenant { get; set; }
}

/// <summary>Saisies de suivi d'une tâche. Une valeur nulle signifie « non saisi ».</summary>
public sealed class SuiviTacheCalcul
{
    public string? Label { get; set; }
    public string? Statut { get; set; }
    public decimal? Avancement { get; set; }
    /// <summary>Reste à faire saisi par le chef de projet (null : reste à faire automatique).</summary>
    public decimal? Raf { get; set; }
    public DateOnly? Debut { get; set; }
    public DateOnly? Fin { get; set; }
    public string? Commentaire { get; set; }
    /// <summary>Type saisi à la main ; null : type détecté automatiquement d'après l'intitulé ; "" : aucun type.</summary>
    public string? Type { get; set; }
    public string? Axe { get; set; }
    public string? Phase { get; set; }
    public string? Lot { get; set; }
    public DateOnly? ValideLe { get; set; }
    public string? IaType { get; set; }
    public string? IaJustif { get; set; }
    public decimal? IaRev { get; set; }
    /// <summary>Numéro de l'échéance de facturation liée à la tâche.</summary>
    public int? Ech { get; set; }
    public AnnulationCalcul? Annul { get; set; }
    /// <summary>Charge ajoutée en cours de projet, par index de profil.</summary>
    public Dictionary<int, decimal>? ChargeAjout { get; set; }
    /// <summary>Motif de chaque charge ajoutée, par index de profil.</summary>
    public Dictionary<int, AjoutCalcul>? AjoutInfo { get; set; }
    /// <summary>Consommé : index de profil → jour (AAAA-MM-JJ) → jours-homme.</summary>
    public Dictionary<int, Dictionary<string, decimal>>? ConsoP { get; set; }
    /// <summary>Réaffectations de charge d'un profil à un autre, dans l'ordre où elles ont été faites.</summary>
    public List<ReaffectationCalcul>? Reaff { get; set; }
}

/// <summary>Une partie de la charge du profil De est confiée au profil Vers (index de profils) : le total de la tâche ne change pas.</summary>
public sealed class ReaffectationCalcul
{
    public string? Id { get; set; }
    public int De { get; set; }
    public int Vers { get; set; }
    public decimal Jh { get; set; }
    public string? Motif { get; set; }
    public string? At { get; set; }
    public string? By { get; set; }
}

public sealed class ParametresCalcul
{
    /// <summary>Premier mois du planning (AAAA-MM).</summary>
    public string? StartMonth { get; set; }
    public int NbMonths { get; set; } = 13;
    /// <summary>Index du profil « Agent IA » (-1 : aucun).</summary>
    public int IaProfile { get; set; } = -1;
    /// <summary>Regroupement des tâches : id (axe), lot ou phase.</summary>
    public string GroupBy { get; set; } = "id";
    public List<string>? IaLeviers { get; set; }
    public List<string>? IaCauses { get; set; }
}

public sealed class DatesProjetCalcul
{
    public DateOnly? Debut { get; set; }
    public DateOnly? FinContrat { get; set; }
    public DateOnly? FinPrevue { get; set; }
}

public sealed class ReferentielCalcul
{
    public List<string> Phases { get; set; } = new();
    public List<string> Etapes { get; set; } = new();
}

public sealed class TypeTacheCalcul
{
    public string Id { get; set; } = "";
    public string Nom { get; set; } = "";
    public bool Socle { get; set; }
}

public sealed class FraisBudgetCalcul
{
    public string Libelle { get; set; } = "";
    public decimal Cu { get; set; }
    public decimal Qte { get; set; }
    public decimal Refacture { get; set; }
    public string Commentaire { get; set; } = "";
}

public sealed class AchatBudgetCalcul
{
    public string Designation { get; set; } = "";
    public string Type { get; set; } = "";
    public decimal Cu { get; set; }
    public decimal Qte { get; set; }
    public decimal Revente { get; set; }
    public string Commentaire { get; set; } = "";
}

public sealed class PrestataireCalcul
{
    public string Designation { get; set; } = "";
    public string Societe { get; set; } = "";
    public decimal CoutJour { get; set; }
    public decimal Nbj { get; set; }
    public decimal Tjm { get; set; }
    public string Commentaire { get; set; } = "";
}

public sealed class MetriqueCalcul
{
    public string Etape { get; set; } = "";
    public decimal Pct { get; set; }
}

/// <summary>Planning mensuel vendu, par profil : Rows[indexProfil][indexMois].</summary>
public sealed class PlanningProfilsCalcul
{
    public List<string> Months { get; set; } = new();
    public List<List<decimal>> Rows { get; set; } = new();
}

public sealed class PlanningPhasesCalcul
{
    public List<LignePlanningPhaseCalcul> Rows { get; set; } = new();
}

public sealed class LignePlanningPhaseCalcul
{
    public string Phase { get; set; } = "";
    /// <summary>Jours-homme par mois (AAAA-MM).</summary>
    public Dictionary<string, decimal> Vals { get; set; } = new();
}

/// <summary>Échéance de facturation vendue au TSP.</summary>
public sealed class EcheanceCalcul
{
    public int N { get; set; }
    public string Nom { get; set; } = "";
    public decimal Pct { get; set; }
    /// <summary>Mois de facturation prévu au TSP (AAAA-MM).</summary>
    public string? Mois { get; set; }
}

/// <summary>Suivi d'une échéance de facturation.</summary>
public sealed class SuiviEcheanceCalcul
{
    public DateOnly? DatePrevue { get; set; }
    /// <summary>Date de facturation.</summary>
    public DateOnly? RealiseLe { get; set; }
    public DateOnly? PayeeLe { get; set; }
    /// <summary>Montant figé au moment de la facturation.</summary>
    public decimal? MontantFacture { get; set; }
    public string? Commentaire { get; set; }
    /// <summary>Phases entières dont l'échéance dépend.</summary>
    public List<string>? Phases { get; set; }
}

public sealed class AchatReelCalcul
{
    public string? Id { get; set; }
    /// <summary>Index de la ligne de budget achat du TSP ; null : achat hors TSP.</summary>
    public int? Ligne { get; set; }
    public decimal Qte { get; set; }
    public decimal Cu { get; set; }
    public decimal Refacture { get; set; }
    public string? Statut { get; set; }
    public string? Designation { get; set; }
}

public sealed class FraisReelCalcul
{
    public string? Id { get; set; }
    public decimal Montant { get; set; }
    public bool Refacturable { get; set; }
    public string? Categorie { get; set; }
    public string? Collaborateur { get; set; }
}

public sealed class ActionCalcul
{
    public string? Id { get; set; }
    public string Ref { get; set; } = "";
    public string Libelle { get; set; } = "";
    public string? Porteur { get; set; }
    public string Statut { get; set; } = "";
    public DateOnly? Echeance { get; set; }
}

public sealed class DecisionCalcul
{
    public string? Id { get; set; }
    public string Ref { get; set; } = "";
    public string Libelle { get; set; } = "";
    public string Statut { get; set; } = "";
}

public sealed class RisqueCalcul
{
    public string? Id { get; set; }
    public string Ref { get; set; } = "";
    public string Libelle { get; set; } = "";
    /// <summary>Probabilité sur 4 niveaux (Faible, Modérée, Forte, Très forte) ; l'ancienne échelle à 3 niveaux est convertie.</summary>
    public string? Proba { get; set; }
    /// <summary>Importance sur 4 niveaux (Faible, Moyenne, Forte, Critique) ; le champ garde son nom d'origine « impact ».</summary>
    public string? Impact { get; set; }
    public string? Statut { get; set; }
}
