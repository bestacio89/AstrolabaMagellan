using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Entites;

/// <summary>Le forfait suivi. Racine de tous les autres objets.</summary>
public sealed class Projet : Entite
{
    public string? Code { get; set; }
    public string Nom { get; set; } = "";
    public string Client { get; set; } = "";
    public string? Reference { get; set; }
    /// <summary>
    /// Identité du forfait (numéro d'opportunité, sinon référence, sinon client et nom) : deux projets ne peuvent pas avoir
    /// la même (index unique en base). Voir <see cref="IdentiteProjet"/>. Recalculée à chaque changement de la fiche.
    /// </summary>
    public string? CleUnicite { get; set; }
    public string? Agence { get; set; }
    public string? ServiceLine { get; set; }
    public string? Directeur { get; set; }
    public string? ResponsableSL { get; set; }
    public string? Commercial { get; set; }
    public string? ContactClient { get; set; }
    public string? TypeContrat { get; set; }
    /// <summary>Statut enregistré : seul « Archivé » y compte. Pour l'affichage, utiliser <see cref="StatutAffiche"/>.</summary>
    public StatutProjet Statut { get; set; } = StatutProjet.EnPreparation;

    /// <summary>
    /// Statut affiché, recalculé à chaque lecture (jamais enregistré) : « Archivé » si le chef de projet l'a archivé ;
    /// sinon « En cours » dès que la date de début est atteinte ou qu'un premier temps est saisi ; « En préparation » avant.
    /// </summary>
    public StatutProjet StatutAffiche(DateOnly aujourdhui, bool aDuTempsSaisi) =>
        Statut == StatutProjet.Archive ? StatutProjet.Archive
        : aDuTempsSaisi || (Debut is { } debut && debut <= aujourdhui) ? StatutProjet.EnCours
        : StatutProjet.EnPreparation;
    public DateOnly? Debut { get; set; }
    public DateOnly? FinContractuelle { get; set; }
    /// <summary>Fin prévue : peut glisser par rapport à la fin contractuelle.</summary>
    public DateOnly? FinPrevue { get; set; }
    /// <summary>Remise commerciale du TSP (0,05 = 5 %).</summary>
    public decimal Remise { get; set; }
    public bool RemiseSaisie { get; set; }
    public decimal? CaInitial { get; set; }
    public decimal? PctPilotage { get; set; }
    public decimal? PctProvision { get; set; }
    public OrigineProjet Origine { get; set; }
    public DateTimeOffset CreeLe { get; set; }
    public Guid? CreeParId { get; set; }

    /// <summary>Réglages du suivi (un seul jeu par projet).</summary>
    public ParametresProjet Parametres { get; set; } = new();

    // ---- liens ----
    public List<Habilitation> Habilitations { get; set; } = new();
    public List<ChampFiche> ChampsFiche { get; set; } = new();
    public List<ImportTsp> Imports { get; set; } = new();
    public List<ProfilProjet> Profils { get; set; } = new();
    public List<GrilleAgence> Grille { get; set; } = new();
    public List<PlanningVenduProfil> PlanningProfils { get; set; } = new();
    public List<PlanningVenduPhase> PlanningPhases { get; set; } = new();
    public List<LigneBudgetAchat> BudgetAchats { get; set; } = new();
    public List<LigneBudgetFrais> BudgetFrais { get; set; } = new();
    public List<Prestataire> Prestataires { get; set; } = new();
    public List<Metrique> Metriques { get; set; } = new();
    public List<Echeance> Echeances { get; set; } = new();
    public List<Axe> Axes { get; set; } = new();
    public List<Phase> Phases { get; set; } = new();
    public List<Etape> Etapes { get; set; } = new();
    public List<TypeTache> TypesTache { get; set; } = new();
    public List<ValeurListeIa> ValeursIa { get; set; } = new();
    public List<Tache> Taches { get; set; } = new();
    public List<AchatReel> AchatsReels { get; set; } = new();
    public List<FraisReel> FraisReels { get; set; } = new();
    public List<ActionProjet> Actions { get; set; } = new();
    public List<Decision> Decisions { get; set; } = new();
    public List<Risque> Risques { get; set; } = new();

    /// <summary>
    /// Crée un projet vide (V1) : seule la fiche est renseignée, sans vendu.
    /// Plus tard, le TSP pourra être saisi dans l'application et remplira les mêmes objets qu'un import.
    /// </summary>
    public static Projet CreerVide(string client, string nom, string? reference, DateOnly debut, DateOnly finContractuelle,
        string? typeContrat, Guid? creePar, DateTimeOffset maintenant)
    {
        if (string.IsNullOrWhiteSpace(client)) throw new RegleMetierException("Le client est obligatoire.");
        if (string.IsNullOrWhiteSpace(nom)) throw new RegleMetierException("Le nom du projet est obligatoire.");
        if (finContractuelle < debut) throw new RegleMetierException("La fin contractuelle doit être après le début du projet.");
        var projet = new Projet
        {
            Client = client.Trim(), Nom = nom.Trim(), Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim(),
            TypeContrat = string.IsNullOrWhiteSpace(typeContrat) ? "Forfait" : typeContrat.Trim(),
            Debut = debut, FinContractuelle = finContractuelle, FinPrevue = finContractuelle,
            Statut = StatutProjet.EnPreparation, Origine = OrigineProjet.CreationManuelle, CreeLe = maintenant, CreeParId = creePar,
            Parametres = new ParametresProjet { PremierMois = Calendrier.Mois(debut), NombreMois = Math.Max(13, Calendrier.MoisEntre(Calendrier.Mois(debut), Calendrier.Mois(finContractuelle)) + 4) },
        };
        projet.AjouterTypesSocle();
        projet.CalculerCleUnicite();
        return projet;
    }

    /// <summary>Recalcule l'identité du projet à partir de sa référence, de son client et de son nom.</summary>
    public void CalculerCleUnicite() => CleUnicite = IdentiteProjet.Cle(Reference, Client, Nom);

    /// <summary>Ajoute les types de tâche « socle » (Atelier, Livrable), non supprimables.</summary>
    public void AjouterTypesSocle()
    {
        var ordre = 0;
        foreach (var (id, nomType) in ReferentielsMetier.TypesSocle)
            if (!TypesTache.Any(t => t.Code == id))
                TypesTache.Add(new TypeTache { ProjetId = Id, Code = id, Nom = nomType, Socle = true, Ordre = ordre++ });
    }

    /// <summary>Modifie les dates du projet en vérifiant leur cohérence.</summary>
    public void DefinirDates(DateOnly? debut, DateOnly? finContractuelle, DateOnly? finPrevue)
    {
        if (debut is not null && finContractuelle is not null && finContractuelle < debut)
            throw new RegleMetierException("La fin contractuelle doit être après le début du projet.");
        if (debut is not null && finPrevue is not null && finPrevue < debut)
            throw new RegleMetierException("La fin prévue doit être après le début du projet.");
        Debut = debut;
        FinContractuelle = finContractuelle;
        FinPrevue = finPrevue;
    }
}

/// <summary>Réglages du suivi d'un projet.</summary>
public sealed class ParametresProjet
{
    public Regroupement Regroupement { get; set; } = Regroupement.Axe;
    /// <summary>Premier mois du planning (AAAA-MM).</summary>
    public string? PremierMois { get; set; }
    public int NombreMois { get; set; } = 13;
    public int? AlerteActionsJours { get; set; }
    public int? AlerteEcheancesJours { get; set; }
    public int? AlerteAteliersJours { get; set; }
    public int? AlerteLivrablesJours { get; set; }
    public DateOnly? DernierCoproj { get; set; }
    /// <summary>Instances de gouvernance proposées pour les actions et décisions, une par ligne ; null : liste par défaut.</summary>
    public string? Instances { get; set; }
}

/// <summary>Ligne libre de la fiche projet du TSP.</summary>
public sealed class ChampFiche : EntiteDeProjet
{
    public string Libelle { get; set; } = "";
    public string Valeur { get; set; } = "";
    /// <summary>Champ reconnu (client, projet…) ou null.</summary>
    public string? Cle { get; set; }
    public int Ordre { get; set; }
}

/// <summary>Trace de chaque import de TSP.</summary>
public sealed class ImportTsp : EntiteDeProjet
{
    public string NomFichier { get; set; } = "";
    public DateTimeOffset ImporteLe { get; set; }
    public Guid? ImporteParId { get; set; }
    /// <summary>Points relevés à l'import, un par ligne.</summary>
    public string PointsReleves { get; set; } = "";
    /// <summary>Onglet d'où vient le planning par profil (PLANNING ou PILOTAGE CHARGES).</summary>
    public string? SourcePlanning { get; set; }
    public string? SourcePlanningPhases { get; set; }
    public Guid? MasquesParId { get; set; }
}
