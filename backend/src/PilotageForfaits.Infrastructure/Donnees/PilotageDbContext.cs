using System.Reflection;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees;

/// <summary>
/// Accès à PostgreSQL avec Entity Framework Core.
/// La structure des tables est décrite dans le dossier Configurations, une classe par objet du modèle de données.
/// </summary>
public sealed class PilotageDbContext(DbContextOptions<PilotageDbContext> options) : DbContext(options), IContexteDonnees
{
    public DbSet<Utilisateur> Utilisateurs => Set<Utilisateur>();
    public DbSet<Habilitation> Habilitations => Set<Habilitation>();
    public DbSet<EntreeJournal> Journal => Set<EntreeJournal>();
    public DbSet<Projet> Projets => Set<Projet>();
    public DbSet<ChampFiche> ChampsFiche => Set<ChampFiche>();
    public DbSet<ImportTsp> ImportsTsp => Set<ImportTsp>();
    public DbSet<ProfilProjet> Profils => Set<ProfilProjet>();
    public DbSet<GrilleAgence> Grilles => Set<GrilleAgence>();
    public DbSet<PlanningVenduProfil> PlanningsProfils => Set<PlanningVenduProfil>();
    public DbSet<PlanningVenduPhase> PlanningsPhases => Set<PlanningVenduPhase>();
    public DbSet<PlanningVenduPhaseMois> PlanningsPhasesMois => Set<PlanningVenduPhaseMois>();
    public DbSet<LigneBudgetAchat> BudgetsAchats => Set<LigneBudgetAchat>();
    public DbSet<LigneBudgetFrais> BudgetsFrais => Set<LigneBudgetFrais>();
    public DbSet<Prestataire> Prestataires => Set<Prestataire>();
    public DbSet<Metrique> Metriques => Set<Metrique>();
    public DbSet<Echeance> Echeances => Set<Echeance>();
    public DbSet<LienEcheancePhase> LiensEcheancePhase => Set<LienEcheancePhase>();
    public DbSet<Axe> Axes => Set<Axe>();
    public DbSet<Phase> Phases => Set<Phase>();
    public DbSet<Etape> Etapes => Set<Etape>();
    public DbSet<TypeTache> TypesTache => Set<TypeTache>();
    public DbSet<ValeurListeIa> ValeursIa => Set<ValeurListeIa>();
    public DbSet<Tache> Taches => Set<Tache>();
    public DbSet<ChargeTache> ChargesTache => Set<ChargeTache>();
    public DbSet<Consomme> Consommes => Set<Consomme>();
    public DbSet<EvolutionPerimetre> Evolutions => Set<EvolutionPerimetre>();
    public DbSet<Atelier> Ateliers => Set<Atelier>();
    public DbSet<Destinataire> Destinataires => Set<Destinataire>();
    public DbSet<Livrable> Livrables => Set<Livrable>();
    public DbSet<MiseAJourTache> MisesAJour => Set<MiseAJourTache>();
    public DbSet<PointHebdo> PointsHebdo => Set<PointHebdo>();
    public DbSet<ActionProjet> Actions => Set<ActionProjet>();
    public DbSet<Decision> Decisions => Set<Decision>();
    public DbSet<Risque> Risques => Set<Risque>();
    public DbSet<AchatReel> AchatsReels => Set<AchatReel>();
    public DbSet<FraisReel> FraisReels => Set<FraisReel>();
    public DbSet<ImportFrais> ImportsFrais => Set<ImportFrais>();
    public DbSet<PhotoIndicateurs> PhotosIndicateurs => Set<PhotoIndicateurs>();
    public DbSet<PlanReference> PlansReference => Set<PlanReference>();
    public DbSet<LignePlanReference> LignesPlanReference => Set<LignePlanReference>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<BrouillonProjet> Brouillons => Set<BrouillonProjet>();
    public DbSet<PrevisionnelProfil> Previsionnels => Set<PrevisionnelProfil>();
    public DbSet<DatesPlanning> DatesPlanning => Set<DatesPlanning>();
    public DbSet<Jalon> Jalons => Set<Jalon>();
    public DbSet<ElementPlanning> ElementsPlanning => Set<ElementPlanning>();
    public DbSet<DatesPlanReference> DatesPlansReference => Set<DatesPlanReference>();
    public DbSet<Absence> Absences => Set<Absence>();
    public DbSet<PersonneAjoutee> PersonnesAjoutees => Set<PersonneAjoutee>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PilotageDbContext).Assembly);

        // Numéro de version de chaque objet : sert à détecter deux modifications simultanées.
        foreach (var type in modelBuilder.Model.GetEntityTypes().Where(t => typeof(Entite).IsAssignableFrom(t.ClrType)).ToList())
            modelBuilder.Entity(type.ClrType).Property(nameof(Entite.Version)).IsConcurrencyToken();

        // « Rien ne se supprime sans trace » : aucune suppression en cascade. Un objet lié empêche la suppression.
        // (Les suppressions en cascade sont interdites par la règle métier, quel que soit le fournisseur.)
        foreach (var lien in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()).Where(fk => !fk.IsOwnership))
            lien.DeleteBehavior = DeleteBehavior.Restrict;
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Nombres décimaux : 6 décimales (jours-homme, pourcentages, TJM issus de calculs comme 418,333333).
        configurationBuilder.Properties<decimal>().HavePrecision(18, 6);
        // Textes : 400 caractères par défaut (les textes longs sont précisés dans les configurations).
        configurationBuilder.Properties<string>().HaveMaxLength(400);
        // Listes de valeurs enregistrées en texte, lisibles directement dans la base.
        configurationBuilder.Properties<RoleProjet>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutProjet>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<OrigineProjet>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<OrigineElement>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<OrigineBrouillon>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutTache>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<NatureEvolution>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutAction>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutDecision>().HaveConversion<string>().HaveMaxLength(30);
        // risques : l'ancienne échelle (3 niveaux) est relue sur la nouvelle (4 niveaux), voir ConversionsRisque
        configurationBuilder.Properties<ProbabiliteRisque>().HaveConversion<ConversionProbabiliteRisque>().HaveMaxLength(30);
        configurationBuilder.Properties<ImpactRisque>().HaveConversion<ConversionImpactRisque>().HaveMaxLength(30);
        configurationBuilder.Properties<TypeRisque>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<TypeJalon>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<NatureElementPlanning>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<MomentAbsence>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutRisque>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutAchat>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<CategorieFrais>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<NaturePhoto>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<ListeIa>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<Regroupement>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<NatureNotification>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<StatutEnvoi>().HaveConversion<string>().HaveMaxLength(30);
    }

    /// <summary>
    /// Toutes les tables rattachées à un projet sont parcourues automatiquement (tout objet qui hérite d'EntiteDeProjet) :
    /// une table ajoutée plus tard est donc prise en compte sans rien changer ici. EF Core ordonne lui-même les suppressions
    /// (les objets qui dépendent d'un autre d'abord), ce qui respecte l'interdiction des suppressions en cascade.
    /// </summary>
    public async Task MarquerProjetPourSuppressionAsync(Guid projetId, CancellationToken annulation = default)
    {
        var charger = typeof(PilotageDbContext).GetMethod(nameof(ChargerDuProjetAsync), BindingFlags.NonPublic | BindingFlags.Instance)!;
        var types = Model.GetEntityTypes()
            .Where(t => !t.IsOwned() && typeof(EntiteDeProjet).IsAssignableFrom(t.ClrType))
            .Select(t => t.ClrType).Distinct().ToList();
        // tout est chargé d'abord, puis tout est marqué : le résultat ne dépend pas de l'ordre des tables
        var aSupprimer = new List<object>();
        foreach (var type in types)
            aSupprimer.AddRange(await (Task<List<object>>)charger.MakeGenericMethod(type).Invoke(this, new object[] { projetId, annulation })!);
        var projet = await Projets.FirstAsync(p => p.Id == projetId, annulation);
        RemoveRange(aSupprimer);
        Projets.Remove(projet);
    }

    private async Task<List<object>> ChargerDuProjetAsync<T>(Guid projetId, CancellationToken annulation) where T : EntiteDeProjet =>
        (await Set<T>().Where(x => x.ProjetId == projetId).ToListAsync(annulation)).Cast<object>().ToList();

    /// <summary>
    /// Outil de diagnostic : compare les tables et colonnes du modèle à celles de la base PostgreSQL
    /// (une base créée par une version précédente n'est pas mise à jour). Renvoie ce qui manque (vide : tout va bien).
    /// Lecture du catalogue (INFORMATION_SCHEMA) : aucune requête en erreur, donc rien de bruyant dans le journal.
    /// </summary>
    public async Task<List<string>> ElementsManquantsAsync(CancellationToken annulation = default)
    {
        FormattableString requete = $"SELECT table_name AS \"NomTable\", column_name AS \"NomColonne\" FROM information_schema.columns WHERE table_schema = 'public'";
        var existantes = (await Database.SqlQuery<ColonneSql>(requete)
                .ToListAsync(annulation))
            .Select(c => (c.NomTable.ToUpperInvariant(), c.NomColonne.ToUpperInvariant())).ToHashSet();
        var tables = existantes.Select(c => c.Item1).ToHashSet();
        var manquants = new List<string>();
        foreach (var type in Model.GetEntityTypes())
        {
            var table = type.GetTableName();
            if (table is null) continue;
            if (!tables.Contains(table.ToUpperInvariant())) { if (!manquants.Contains($"table {table}")) manquants.Add($"table {table}"); continue; }
            var objet = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, type.GetSchema());
            foreach (var propriete in type.GetProperties())
            {
                var colonne = propriete.GetColumnName(objet);
                if (colonne is not null && !existantes.Contains((table.ToUpperInvariant(), colonne.ToUpperInvariant())))
                    manquants.Add($"{table}.{colonne}");
            }
        }
        return manquants.Distinct().ToList();
    }

    /// <summary>Une colonne du catalogue PostgreSQL.</summary>
    public sealed class ColonneSql
    {
        public string NomTable { get; set; } = "";
        public string NomColonne { get; set; } = "";
    }

    /// <summary>
    /// Avant chaque enregistrement : augmente le numéro de version des objets modifiés.
    /// EF Core vérifie que la version en base est toujours celle lue ; sinon, quelqu'un d'autre a modifié l'objet entre-temps
    /// et l'enregistrement est refusé (DbUpdateConcurrencyException, transformée en réponse 409 par l'API).
    /// </summary>
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        VerifierLongueurs();
        // les réglages du projet sont rangés dans la ligne du projet (type « possédé ») : les modifier change aussi sa version
        foreach (var p in ChangeTracker.Entries<Projet>())
        {
            if (p.State == EntityState.Unchanged && p.Reference(x => x.Parametres).TargetEntry?.State == EntityState.Modified)
                p.Property(x => x.Version).IsModified = true;
        }
        foreach (var e in ChangeTracker.Entries<Entite>())
        {
            if (e.State == EntityState.Added) e.Entity.Version = 1;
            else if (e.State == EntityState.Modified) e.Entity.Version = e.OriginalValues.GetValue<int>(nameof(Entite.Version)) + 1;
        }
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Un texte plus long que sa colonne ferait échouer l'enregistrement avec une erreur technique (500) :
    /// on répond à la place par un message clair (422). Le journal, lui, ne doit jamais bloquer une saisie : il est tronqué.
    /// </summary>
    private void VerifierLongueurs()
    {
        foreach (var e in ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified))
        {
            foreach (var p in e.Properties)
            {
                if (p.CurrentValue is not string texte || (e.State == EntityState.Modified && !p.IsModified)) continue;
                var max = p.Metadata.GetMaxLength();
                if (max is null || texte.Length <= max) continue;
                if (e.Entity is EntreeJournal) p.CurrentValue = texte[..(max.Value - 1)] + "…";
                else throw new RegleMetierException($"Texte trop long : {max} caractères au maximum. Saisie annulée.");
            }
        }
    }
}
