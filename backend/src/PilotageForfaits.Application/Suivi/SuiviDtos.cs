using PilotageForfaits.Domain.Calcul;

namespace PilotageForfaits.Application.Suivi;

// ============================================================================================
// Objets envoyés à l'écran de suivi d'un projet.
// Ils reprennent la forme et les noms du fichier de suivi de la version de référence (version HTML) :
// l'écran Angular est ainsi une traduction directe de celui du POC, sans réinterprétation.
// Différences : chaque objet modifiable porte son identifiant et son numéro de version
// (deux personnes ne peuvent pas s'écraser sans le savoir), et les montants ne sont envoyés
// qu'aux rôles qui ont le droit de les voir (voir FiltreMontants).
// ============================================================================================

/// <summary>Tout ce dont l'écran de suivi a besoin : les saisies, les indicateurs calculés et les droits.</summary>
public sealed class SuiviDto
{
    public required ProjetVueDto Projet { get; init; }
    /// <summary>Indicateurs calculés par le moteur (mêmes noms que le POC).</summary>
    public required ResultatCalcul Modele { get; init; }
    public required DroitsDto Droits { get; init; }
    /// <summary>Date du jour du serveur (à l'heure de Paris) : toutes les alertes s'y réfèrent.</summary>
    public DateOnly Aujourdhui { get; init; }
}

/// <summary>Ce que l'utilisateur connecté peut faire sur ce projet.</summary>
public sealed class DroitsDto
{
    public string Role { get; init; } = "";
    public string RoleLibelle { get; init; } = "";
    /// <summary>Chef de projet : toutes les saisies.</summary>
    public bool PeutModifier { get; init; }
    /// <summary>Saisie du consommé (chef de projet et consultant).</summary>
    public bool PeutSaisirConsomme { get; init; }
    /// <summary>CA, coûts, marges, TJM / CJM, achats, frais, facturation.</summary>
    public bool VoitMontants { get; init; }
    /// <summary>Exports COPIL / COPROJ (ils contiennent des montants).</summary>
    public bool PeutExporter { get; init; }
    /// <summary>Nom de l'utilisateur connecté (proposé comme responsable, décideur…).</summary>
    public string Utilisateur { get; init; } = "";
    public Guid UtilisateurId { get; init; }
    /// <summary>Projet archivé : tout est en lecture seule.</summary>
    public bool Archive { get; init; }
    /// <summary>Chef de projet (même si le projet est archivé) : peut le restaurer, ou le supprimer s'il a été créé par erreur.</summary>
    public bool EstChefDeProjet { get; init; }
}

/// <summary>Résultat d'une saisie : le suivi recalculé et les messages à afficher.</summary>
public sealed class ResultatSaisieDto
{
    public required object Suivi { get; init; }
    public List<MessageDto> Messages { get; init; } = new();
    /// <summary>Tâche à ouvrir dans le panneau de détail (ex. tâche créée).</summary>
    public string? Ouvrir { get; init; }
}

/// <summary>
/// Message court affiché après une saisie. « Action » propose une suite (ex. « valider-tache », « bilan-ia ») sur « Cible ».
/// </summary>
public sealed record MessageDto(string Texte, string Ton = "info", string? Action = null, string? Cible = null, string? LibelleAction = null);

/// <summary>Le projet, dans la forme du fichier de suivi du POC.</summary>
public sealed class ProjetVueDto
{
    public Guid Id { get; init; }
    /// <summary>Point hebdo : réglages et saisie par période (voir PointsHebdoService.Vue).</summary>
    public System.Text.Json.Nodes.JsonObject? PointsHebdo { get; set; }
    public int Version { get; init; }
    public string Statut { get; init; } = "";
    public required FicheVueDto Fiche { get; init; }
    /// <summary>Période indiquée dans le TSP (lecture seule).</summary>
    public PeriodeVueDto? Periode { get; init; }
    public decimal Remise { get; init; }
    public bool RemiseSaisie { get; init; }
    public decimal? CaInitial { get; init; }
    public List<ProfilVueDto> Profiles { get; init; } = new();
    public List<GrilleVueDto> Grille { get; init; } = new();
    public List<TacheVueDto> Tasks { get; init; } = new();
    public Dictionary<string, SuiviTacheVueDto> Track { get; init; } = new();
    public required ParametresVueDto Settings { get; init; }
    public required DatesProjetCalcul Dates { get; init; }
    public required ReferentielCalcul Ref { get; init; }
    /// <summary>Nom choisi pour chaque code d'axe.</summary>
    public Dictionary<string, string> Axes { get; init; } = new();
    /// <summary>Date limite facultative par code d'axe.</summary>
    public Dictionary<string, DateOnly?> DatesLimitesAxes { get; init; } = new();
    public List<DateLimiteAxeCalculee> EtatsDatesLimitesAxes { get; init; } = new();
    /// <summary>Noms personnalisés de lots ; les codes restent ceux des tâches.</summary>
    public Dictionary<string, string> Lots { get; init; } = new();
    public List<TypeTacheCalcul> Types { get; init; } = new();
    public List<FraisBudgetCalcul> Frais { get; init; } = new();
    public List<AchatBudgetCalcul> Achats { get; init; } = new();
    public List<PrestataireCalcul> Prestas { get; init; } = new();
    public List<MetriqueCalcul> Metrique { get; init; } = new();
    /// <summary>Prévisionnel de charge par profil et par mois (au départ, le planning vendu ; replanifiable).</summary>
    public required PlanningProfilsCalcul PlanningRef { get; init; }
    /// <summary>Planning vendu (onglet PLANNING du TSP), figé : la référence du prévisionnel.</summary>
    public PlanningProfilsCalcul? PlanningTsp { get; init; }
    /// <summary>Planning (vue d'ensemble) : dates saisies par ligne, jalons, éléments mis en avant, lignes masquées.</summary>
    public PlanningVueDto Planning { get; init; } = new();
    public required PlanningPhasesVueDto PlanningPhases { get; init; }
    public string? PlanningSource { get; init; }
    public List<EcheanceCalcul> Echeancier { get; init; } = new();
    public Dictionary<int, SuiviEcheanceVueDto> EchTrack { get; init; } = new();
    public List<AchatReelVueDto> AchatsReel { get; init; } = new();
    public List<FraisReelVueDto> FraisReel { get; init; } = new();
    public List<ActionVueDto> Actions { get; init; } = new();
    public List<DecisionVueDto> Decisions { get; init; } = new();
    public List<RisqueVueDto> Risques { get; init; } = new();
    /// <summary>Photo des indicateurs prise à chaque export COPIL / COPROJ.</summary>
    public List<PhotoVueDto> Historique { get; init; } = new();
    /// <summary>Points relevés au dernier import du TSP.</summary>
    public List<string> Warnings { get; init; } = new();
    public SourceVueDto? Source { get; init; }
    /// <summary>Dernières modifications enregistrées (journal).</summary>
    public List<JournalVueDto> Journal { get; init; } = new();
    /// <summary>Plannings de référence figés, du plus ancien au plus récent.</summary>
    public List<ReferenceVueDto> References { get; init; } = new();
    /// <summary>Causes possibles d'un écart au planning de référence.</summary>
    public List<string> Causes { get; init; } = new();
    /// <summary>Fil de mises à jour de chaque tâche (clé : repère de la tâche), du plus récent au plus ancien.</summary>
    public Dictionary<string, List<MiseAJourVueDto>> MisesAJour { get; init; } = new();
    /// <summary>Commentaires par cible : UID de tâche, act:GUID, dec:GUID ou rk:GUID.</summary>
    public Dictionary<string, List<CommentaireVueDto>> Commentaires { get; init; } = new();
}

/// <summary>Planning figé à une date : dates prévues et charge de chaque tâche (clé : repère de la tâche).</summary>
public sealed class ReferenceVueDto
{
    public Guid Id { get; init; }
    public string Libelle { get; init; } = "";
    public DateOnly Date { get; init; }
    public string? Par { get; init; }
    public Dictionary<string, LigneReferenceVueDto> Lignes { get; init; } = new();
}

public sealed class LigneReferenceVueDto
{
    public int Version { get; init; }
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
    /// <summary>Charge prévue de la tâche au moment où la référence a été figée (JH).</summary>
    public decimal Charge { get; init; }
    public string? Cause { get; init; }
    public string? Motif { get; init; }
}

/// <summary>Message du fil de mises à jour d'une tâche.</summary>
public sealed record MiseAJourVueDto(DateTimeOffset At, string By, string Texte);

/// <summary>Ce que la vue du suivi ajoute aux données du moteur, chargé à part (références, fil des tâches).</summary>
public sealed record CommentaireVueDto(Guid Id, DateTimeOffset At, string By, Guid? AuteurId, string Texte, DateTimeOffset? ModifieLe);
public sealed record ComplementsVue(List<ReferenceVueDto> References, Dictionary<string, List<MiseAJourVueDto>> MisesAJour, Dictionary<string, DateOnly?> DatesLimitesAxes, Dictionary<string, string> Lots, Dictionary<string, List<CommentaireVueDto>> Commentaires);

public sealed class FicheVueDto
{
    public string Client { get; init; } = "";
    public string Projet { get; init; } = "";
    public string Reference { get; init; } = "";
    public string TypeContrat { get; init; } = "";
    public List<ChampFicheVueDto> Champs { get; init; } = new();
}

public sealed record ChampFicheVueDto(string Key, string Label, string Value);

public sealed record PeriodeVueDto(DateOnly? Start, DateOnly? End);

public sealed class ProfilVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public string Nom { get; init; } = "";
    public string Entite { get; init; } = "FO";
    public decimal Tjm { get; init; }
    public decimal Cjm { get; init; }
    public decimal? Prcs { get; init; }
    public decimal Frais { get; init; }
    public string Collaborateur { get; init; } = "";
    public Guid? UtilisateurId { get; init; }
    public AjoutCalcul? Ajout { get; init; }
}

public sealed record GrilleVueDto(string Profil, decimal TjmParis, decimal CjmParis, decimal TjmRegion, decimal CjmRegion);

/// <summary>Ligne du WORKLOAD du TSP (valeurs vendues, figées) ou tâche ajoutée.</summary>
public sealed class TacheVueDto
{
    /// <summary>Repère de la tâche (r12 = ligne 12 du TSP, a1 = première tâche ajoutée).</summary>
    public string Uid { get; init; } = "";
    public Guid CibleId { get; init; }
    public int Version { get; init; }
    public int? Ligne { get; init; }
    /// <summary>Code de l'axe (colonne A du TSP).</summary>
    public string Id { get; init; } = "";
    public string Lot { get; init; } = "";
    public string Phase { get; init; } = "";
    public string Etape { get; init; } = "";
    public string Label { get; init; } = "";
    public List<decimal> Charges { get; init; } = new();
    public bool Section { get; init; }
    public string Livrable { get; init; } = "";
    public string Hypothese { get; init; } = "";
    /// <summary>La colonne « Livrable » du TSP dit seule ce qu'est un livrable (repère posé à l'import).</summary>
    public bool LivCol { get; init; }
    public AjoutCalcul? Ajout { get; init; }
}

/// <summary>Saisies de suivi d'une tâche (forme du POC) + organisation de l'atelier et suivi du livrable.</summary>
public sealed class SuiviTacheVueDto
{
    public string? Label { get; init; }
    public string? Statut { get; init; }
    public decimal? Avancement { get; init; }
    public decimal? Raf { get; init; }
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
    public string? Commentaire { get; init; }
    public string? Type { get; init; }
    public string? Axe { get; init; }
    public string? Phase { get; init; }
    public string? Lot { get; init; }
    public DateOnly? ValideLe { get; init; }
    public string? IaType { get; init; }
    public string? IaJustif { get; init; }
    public int? Ech { get; init; }
    public AnnulationVueDto? Annul { get; init; }
    public Dictionary<int, decimal>? ChargeAjout { get; init; }
    public Dictionary<int, AjoutCalcul>? AjoutInfo { get; init; }
    public Dictionary<int, Dictionary<string, decimal>>? ConsoP { get; init; }
    /// <summary>Réaffectations de charge d'un profil à un autre (Id : identifiant de l'évolution, pour l'annuler).</summary>
    public List<ReaffectationCalcul>? Reaff { get; init; }
    public AtelierVueDto? Atelier { get; init; }
    public LivrableVueDto? Livr { get; init; }
}

public sealed class AnnulationVueDto
{
    public string? At { get; init; }
    public string? By { get; init; }
    public string? Motif { get; init; }
    public bool Avenant { get; init; }
    /// <summary>Décision enregistrée au registre lors de l'annulation.</summary>
    public Guid? Decision { get; init; }
}

public sealed class AtelierVueDto
{
    public DateOnly? Date { get; init; }
    /// <summary>Heure de début (HH:mm).</summary>
    public string? HeureDebut { get; init; }
    public string? HeureFin { get; init; }
    public bool Invit { get; init; }
    public DateOnly? InvitLe { get; init; }
    public List<string> Dest { get; init; } = new();
}

public sealed class LivrableVueDto
{
    /// <summary>Validé par le client le.</summary>
    public DateOnly? ValideLe { get; init; }
    /// <summary>Adresse du document livré (SharePoint, chemin réseau).</summary>
    public string? Lien { get; init; }
}

public sealed class ParametresVueDto
{
    public string GroupBy { get; init; } = "id";
    public int IaProfile { get; init; } = -1;
    /// <summary>Listes propres au projet ; null : listes par défaut.</summary>
    public List<string>? IaLeviers { get; init; }
    public List<string>? IaCauses { get; init; }
    public int? AlerteActionsJours { get; init; }
    public int? AlerteAtelierJours { get; init; }
    public int? AlerteLivrableJours { get; init; }
    public int? AlerteEchJours { get; init; }
    public DateOnly? LastCoproj { get; init; }
    public string? StartMonth { get; init; }
    public int NbMonths { get; init; }
    /// <summary>Instances de gouvernance du projet ; null : liste par défaut.</summary>
    public List<string>? Instances { get; init; }
}

/// <summary>Planning de la vue d'ensemble, dans la forme du fichier de suivi de la version HTML (planning.groupes, .jalons, .avant, .masque).</summary>
public sealed class PlanningVueDto
{
    /// <summary>Dates saisies (et nom d'une sous-partie), par clé de ligne (« id|AXE1 », « sec|r12|AXE1 », « sec|r12 »…).</summary>
    public Dictionary<string, DatesPlanningVueDto> Groupes { get; init; } = new();
    public List<JalonVueDto> Jalons { get; init; } = new();
    /// <summary>Sous-parties et tâches mises en avant (« sec|r12|AXE1 », « tache|r15 ») : clé → true.</summary>
    public Dictionary<string, bool> Avant { get; init; } = new();
    /// <summary>Lignes masquées sur la vue d'ensemble (« id|AXE1 », « phase|X »…) : clé → true. Rien n'est supprimé du suivi.</summary>
    public Dictionary<string, bool> Masque { get; init; } = new();
}

public sealed class DatesPlanningVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public DateOnly? Debut { get; init; }
    public DateOnly? Fin { get; init; }
    public string? Nom { get; init; }
}

public sealed class JalonVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public string Libelle { get; init; } = "";
    /// <summary>« date » ou « periode ».</summary>
    public string Type { get; init; } = "date";
    public DateOnly Debut { get; init; }
    public DateOnly? Fin { get; init; }
    public bool AConfirmer { get; init; }
}

public sealed class PlanningPhasesVueDto
{
    public List<LignePlanningPhaseVueDto> Rows { get; init; } = new();
    public string? Source { get; init; }
}

public sealed class LignePlanningPhaseVueDto
{
    public string Phase { get; init; } = "";
    /// <summary>Valeur saisie dans le TSP (nombre ou texte), pour information.</summary>
    public string? Cjm { get; init; }
    public Dictionary<string, decimal> Vals { get; init; } = new();
}

public sealed class SuiviEcheanceVueDto
{
    public int Version { get; init; }
    public DateOnly? DatePrevue { get; init; }
    public DateOnly? RealiseLe { get; init; }
    public DateOnly? PayeeLe { get; init; }
    public decimal? MontantFacture { get; init; }
    public string? Commentaire { get; init; }
    public List<string> Phases { get; init; } = new();
}

public sealed class AchatReelVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public DateOnly Date { get; init; }
    public string Designation { get; init; } = "";
    public string Fournisseur { get; init; } = "";
    /// <summary>Index de la ligne de budget du TSP ; null : hors TSP.</summary>
    public int? Ligne { get; init; }
    public decimal Qte { get; init; }
    public decimal Cu { get; init; }
    public decimal Montant { get; init; }
    public decimal Refacture { get; init; }
    public string Statut { get; init; } = "";
    public string Commentaire { get; init; } = "";
    public DateOnly Cree { get; init; }
    public string? Par { get; init; }
}

public sealed class FraisReelVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public DateOnly Date { get; init; }
    public string Collaborateur { get; init; } = "";
    public string Categorie { get; init; } = "";
    public string Libelle { get; init; } = "";
    public decimal Montant { get; init; }
    public bool Refacturable { get; init; }
    /// <summary>Montant refacturé (le montant si le frais est refacturable).</summary>
    public decimal Refacture { get; init; }
    public string Commentaire { get; init; } = "";
    public DateOnly Cree { get; init; }
    public string? Par { get; init; }
}

public sealed class ActionVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public string Ref { get; init; } = "";
    public string Libelle { get; init; } = "";
    public string Porteur { get; init; } = "";
    /// <summary>Instance d'origine (COPROJ, COPIL…).</summary>
    public string Origine { get; init; } = "";
    public DateOnly Cree { get; init; }
    /// <summary>Date cible.</summary>
    public DateOnly? Echeance { get; init; }
    public decimal Progression { get; init; }
    public string Statut { get; init; } = "";
    public DateOnly? FaitLe { get; init; }
    public string Commentaire { get; init; } = "";
    /// <summary>Tâche concernée (repère).</summary>
    public string? Tache { get; init; }
    public string? Par { get; init; }
}

public sealed class DecisionVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public string Ref { get; init; } = "";
    public DateOnly Date { get; init; }
    public string Instance { get; init; } = "";
    public string Libelle { get; init; } = "";
    public string Decideur { get; init; } = "";
    public string Impact { get; init; } = "";
    public string Statut { get; init; } = "";
    public string Commentaire { get; init; } = "";
    public string? Par { get; init; }
}

public sealed class RisqueVueDto
{
    public Guid Id { get; init; }
    public int Version { get; init; }
    public string Ref { get; init; } = "";
    public string Libelle { get; init; } = "";
    /// <summary>Probabilité : Faible, Modérée, Forte, Très forte.</summary>
    public string Proba { get; init; } = "";
    /// <summary>Importance (nom d'origine : impact) : Faible, Moyenne, Forte, Critique.</summary>
    public string Impact { get; init; } = "";
    /// <summary>Criticité = probabilité × importance (1 à 16).</summary>
    public int Crit { get; init; }
    /// <summary>faible (1 à 3), moyen (4 à 6), fort (8 et plus).</summary>
    public string Niveau { get; init; } = "faible";
    /// <summary>Retard, Qualité, Budget, ou vide.</summary>
    public string Type { get; init; } = "";
    public string Cause { get; init; } = "";
    /// <summary>« Comment réduire ».</summary>
    public string Parade { get; init; } = "";
    /// <summary>Plan d'actions.</summary>
    public string Plan { get; init; } = "";
    public string Responsable { get; init; } = "";
    public string Statut { get; init; } = "";
    /// <summary>Action liée.</summary>
    public Guid? Action { get; init; }
    public string Commentaire { get; init; } = "";
    public DateOnly Cree { get; init; }
    public string? Par { get; init; }
}

public sealed class PhotoVueDto
{
    public DateOnly Date { get; init; }
    /// <summary>COPIL ou COPROJ.</summary>
    public string Kind { get; init; } = "";
    public decimal Prevu { get; init; }
    public decimal Conso { get; init; }
    public decimal Raf { get; init; }
    public decimal Atterrissage { get; init; }
    public decimal CoutFinal { get; init; }
    public decimal Marge { get; init; }
    public decimal MargeNette { get; init; }
    public decimal TauxMargeNette { get; init; }
    public DateOnly? FinPrevue { get; init; }
}

public sealed record SourceVueDto(string Fichier, DateTimeOffset ImporteLe);

public sealed record JournalVueDto(DateTimeOffset At, string By, string Objet, string Champ, string? Ancienne, string? Nouvelle);
