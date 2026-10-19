using PilotageForfaits.Domain.Calcul;

namespace PilotageForfaits.Domain.Tsp;

/// <summary>
/// Contenu d'un TSP après lecture : exactement ce que produit la lecture de la version de référence (POC v65),
/// avec les mêmes noms (les tests comparent les deux). C'est ensuite le service d'import qui l'enregistre en base.
/// </summary>
public sealed class TspLu
{
    public FicheTsp Fiche { get; init; } = new();
    public PeriodeTsp Periode { get; init; } = new();
    public decimal Remise { get; init; }
    /// <summary>La remise a-t-elle été saisie dans le TSP (cellule non vide) ?</summary>
    public bool RemiseSaisie { get; init; }
    public decimal? CaInitial { get; init; }
    public decimal? PctPilotage { get; init; }
    public decimal? PctProvision { get; init; }
    public List<ProfilCalcul> Profiles { get; init; } = new();
    public List<LigneGrilleTsp> Grille { get; init; } = new();
    public List<TacheCalcul> Tasks { get; init; } = new();
    public PlanningPhasesTsp PlanningPhases { get; init; } = new();
    public List<FraisBudgetCalcul> Frais { get; init; } = new();
    public List<AchatBudgetCalcul> Achats { get; init; } = new();
    public List<PrestataireCalcul> Prestas { get; init; } = new();
    public List<EcheanceCalcul> Echeancier { get; init; } = new();
    public List<MetriqueCalcul> Metrique { get; init; } = new();
    public PlanningProfilsCalcul PlanningRef { get; init; } = new();
    /// <summary>Onglet d'où vient le planning mensuel par profil (PLANNING ou PILOTAGE CHARGES), ou null.</summary>
    public string? PlanningSource { get; init; }
    public ReferentielCalcul Ref { get; init; } = new();
    /// <summary>Codes d'axe trouvés (colonne A) et leur nom par défaut.</summary>
    public Dictionary<string, string> Axes { get; init; } = new();
    public DatesProjetCalcul Dates { get; init; } = new();
    public ParametresCalcul Settings { get; init; } = new();
    /// <summary>Points relevés pendant la lecture, à montrer à l'utilisateur.</summary>
    public List<string> Warnings { get; init; } = new();
}

/// <summary>Onglet FICHE PROJET : champs reconnus, et toutes les lignes telles quelles.</summary>
public sealed class FicheTsp
{
    public List<ChampFicheTsp> Champs { get; init; } = new();
    public string? Client { get; set; }
    public string? Projet { get; set; }
    public string? Reference { get; set; }
    public string? Contact { get; set; }
    public string? Agence { get; set; }
    public string? ServiceLine { get; set; }
    public string? Directeur { get; set; }
    public string? ResponsableSL { get; set; }
    public string? Commercial { get; set; }
    public string? TypeContrat { get; set; }
    public string? Auteur { get; set; }
    public string? Date { get; set; }
    public string? Periode { get; set; }
}

public sealed class ChampFicheTsp
{
    public string Label { get; init; } = "";
    public string Value { get; init; } = "";
    /// <summary>Champ reconnu (client, projet…) ou null pour une ligne libre.</summary>
    public string? Key { get; init; }
}

public sealed class PeriodeTsp
{
    public DateOnly? Start { get; init; }
    public DateOnly? End { get; init; }
}

public sealed class LigneGrilleTsp
{
    public string Profil { get; init; } = "";
    public decimal TjmParis { get; init; }
    public decimal CjmParis { get; init; }
    public decimal TjmRegion { get; init; }
    public decimal CjmRegion { get; init; }
}

public sealed class PlanningPhasesTsp
{
    public List<LignePlanningPhaseTsp> Rows { get; init; } = new();
    public string? Source { get; init; }
}

public sealed class LignePlanningPhaseTsp
{
    public string Phase { get; init; } = "";
    /// <summary>CJM saisi dans le TSP (nombre ou texte) : conservé pour information, non utilisé dans les calculs.</summary>
    public object? Cjm { get; init; }
    public Dictionary<string, decimal> Vals { get; init; } = new();
}
