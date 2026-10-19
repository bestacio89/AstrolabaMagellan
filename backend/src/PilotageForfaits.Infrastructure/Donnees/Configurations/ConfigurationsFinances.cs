using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationLienEcheancePhase : IEntityTypeConfiguration<LienEcheancePhase>
{
    public void Configure(EntityTypeBuilder<LienEcheancePhase> b)
    {
        b.ToTable("LiensEcheancePhase");
        b.AppartientAuProjet();
        b.HasOne(x => x.Phase).WithMany().HasForeignKey(x => x.PhaseId).IsRequired();
        b.HasIndex(x => x.PhaseId).IsUnique(); // une phase n'est liée qu'à une seule échéance
    }
}

internal sealed class ConfigurationAchatReel : IEntityTypeConfiguration<AchatReel>
{
    public void Configure(EntityTypeBuilder<AchatReel> b)
    {
        b.ToTable("AchatsReels", t => t.HasCheckConstraint("CK_AchatsReels_Positifs", "CAST([Quantite] AS FLOAT) > 0 AND CAST([CoutUnitaire] AS FLOAT) >= 0 AND CAST([Refacture] AS FLOAT) >= 0"));
        b.AppartientAuProjet(p => p.AchatsReels);
        b.HasOne<LigneBudgetAchat>().WithMany().HasForeignKey(x => x.LigneBudgetAchatId).IsRequired(false);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.ReferenceUtilisateur(x => x.CreeParId);
    }
}

internal sealed class ConfigurationFraisReel : IEntityTypeConfiguration<FraisReel>
{
    public void Configure(EntityTypeBuilder<FraisReel> b)
    {
        b.ToTable("FraisReels", t => t.HasCheckConstraint("CK_FraisReels_Positif", "CAST([Montant] AS FLOAT) > 0"));
        b.AppartientAuProjet(p => p.FraisReels);
        b.HasOne<ImportFrais>().WithMany().HasForeignKey(x => x.ImportFraisId).IsRequired(false);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.ReferenceUtilisateur(x => x.CreeParId);
    }
}

internal sealed class ConfigurationImportFrais : IEntityTypeConfiguration<ImportFrais>
{
    public void Configure(EntityTypeBuilder<ImportFrais> b)
    {
        b.ToTable("ImportsFrais");
        b.AppartientAuProjet();
        b.Property(x => x.NomFichier).HasMaxLength(260);
        b.ReferenceUtilisateur(x => x.ImporteParId);
    }
}

internal sealed class ConfigurationPhotoIndicateurs : IEntityTypeConfiguration<PhotoIndicateurs>
{
    public void Configure(EntityTypeBuilder<PhotoIndicateurs> b)
    {
        b.ToTable("PhotosIndicateurs");
        b.AppartientAuProjet();
        b.HasIndex(x => new { x.ProjetId, x.Date, x.Nature }).IsUnique(); // une photo par date et nature
    }
}

internal sealed class ConfigurationPlanReference : IEntityTypeConfiguration<PlanReference>
{
    public void Configure(EntityTypeBuilder<PlanReference> b)
    {
        b.ToTable("PlansReference");
        b.AppartientAuProjet();
        b.Property(x => x.Libelle).HasMaxLength(200);
        b.HasMany(x => x.Lignes).WithOne().HasForeignKey(l => l.PlanReferenceId).IsRequired();
        b.ReferenceUtilisateur(x => x.FigeParId);
    }
}

internal sealed class ConfigurationLignePlanReference : IEntityTypeConfiguration<LignePlanReference>
{
    public void Configure(EntityTypeBuilder<LignePlanReference> b)
    {
        b.ToTable("LignesPlanReference");
        b.AppartientAuProjet();
        b.HasOne<Tache>().WithMany().HasForeignKey(x => x.TacheId).IsRequired();
        b.HasIndex(x => new { x.PlanReferenceId, x.TacheId }).IsUnique();
        b.Property(x => x.Cause).HasMaxLength(30);
        b.Property(x => x.Motif).HasMaxLength(1000);
    }
}

internal sealed class ConfigurationNotification : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("Notifications");
        b.AppartientAuProjet();
        b.HasOne<Utilisateur>().WithMany().HasForeignKey(x => x.DestinataireId).IsRequired();
        b.HasIndex(x => new { x.StatutEnvoi, x.DateCible });
    }
}
