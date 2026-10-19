using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Abstractions;

/// <summary>
/// Accès aux tables de la base, vu par les services. L'implémentation (EF Core + SQL Server) est dans l'Infrastructure.
/// Les services n'ont ainsi jamais besoin de connaître la base utilisée (SQL Server en production, SQLite dans les tests).
/// </summary>
public interface IContexteDonnees
{
    DbSet<Utilisateur> Utilisateurs { get; }
    DbSet<Habilitation> Habilitations { get; }
    DbSet<EntreeJournal> Journal { get; }
    DbSet<Projet> Projets { get; }
    DbSet<ChampFiche> ChampsFiche { get; }
    DbSet<ImportTsp> ImportsTsp { get; }
    DbSet<ProfilProjet> Profils { get; }
    DbSet<GrilleAgence> Grilles { get; }
    DbSet<PlanningVenduProfil> PlanningsProfils { get; }
    DbSet<PlanningVenduPhase> PlanningsPhases { get; }
    DbSet<PlanningVenduPhaseMois> PlanningsPhasesMois { get; }
    DbSet<LigneBudgetAchat> BudgetsAchats { get; }
    DbSet<LigneBudgetFrais> BudgetsFrais { get; }
    DbSet<Prestataire> Prestataires { get; }
    DbSet<Metrique> Metriques { get; }
    DbSet<Echeance> Echeances { get; }
    DbSet<LienEcheancePhase> LiensEcheancePhase { get; }
    DbSet<Axe> Axes { get; }
    DbSet<Phase> Phases { get; }
    DbSet<Etape> Etapes { get; }
    DbSet<TypeTache> TypesTache { get; }
    DbSet<ValeurListeIa> ValeursIa { get; }
    DbSet<Tache> Taches { get; }
    DbSet<ChargeTache> ChargesTache { get; }
    DbSet<Consomme> Consommes { get; }
    DbSet<EvolutionPerimetre> Evolutions { get; }
    DbSet<Atelier> Ateliers { get; }
    DbSet<Destinataire> Destinataires { get; }
    DbSet<Livrable> Livrables { get; }
    DbSet<MiseAJourTache> MisesAJour { get; }
    DbSet<PointHebdo> PointsHebdo { get; }
    DbSet<ActionProjet> Actions { get; }
    DbSet<Decision> Decisions { get; }
    DbSet<Risque> Risques { get; }
    DbSet<AchatReel> AchatsReels { get; }
    DbSet<FraisReel> FraisReels { get; }
    DbSet<ImportFrais> ImportsFrais { get; }
    DbSet<PhotoIndicateurs> PhotosIndicateurs { get; }
    DbSet<PlanReference> PlansReference { get; }
    DbSet<LignePlanReference> LignesPlanReference { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<BrouillonProjet> Brouillons { get; }
    /// <summary>Prévisionnel de charge par profil et par mois (replanification ; le planning vendu ne change pas).</summary>
    DbSet<PrevisionnelProfil> Previsionnels { get; }
    /// <summary>Planning : dates saisies par ligne, jalons, éléments mis en avant ou masqués, dates figées avec une référence.</summary>
    DbSet<DatesPlanning> DatesPlanning { get; }
    DbSet<Jalon> Jalons { get; }
    DbSet<ElementPlanning> ElementsPlanning { get; }
    DbSet<DatesPlanReference> DatesPlansReference { get; }
    /// <summary>Absences des personnes (rattachées à la personne, visibles sur tous ses projets) et personnes ajoutées par projet.</summary>
    DbSet<Absence> Absences { get; }
    DbSet<PersonneAjoutee> PersonnesAjoutees { get; }

    /// <summary>
    /// Marque pour suppression le projet et TOUTES ses données (toutes les tables rattachées au projet, journal compris).
    /// Rien n'est écrit avant SaveChangesAsync. Réservé à la suppression d'un projet créé par erreur (voir ProjetsService).
    /// </summary>
    Task MarquerProjetPourSuppressionAsync(Guid projetId, CancellationToken annulation = default);

    /// <summary>Enregistre toutes les modifications en une seule transaction.</summary>
    Task<int> SaveChangesAsync(CancellationToken annulation = default);
}
