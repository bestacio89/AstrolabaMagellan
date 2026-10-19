using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationProfilProjet : IEntityTypeConfiguration<ProfilProjet>
{
    public void Configure(EntityTypeBuilder<ProfilProjet> b)
    {
        b.ToTable("ProfilsProjet");
        b.AppartientAuProjet(p => p.Profils);
        b.Property(x => x.Entite).HasMaxLength(20);
        b.Property(x => x.MotifAjout).HasMaxLength(2000);
        b.HasIndex(x => new { x.ProjetId, x.Rang });
        b.ReferenceUtilisateur(x => x.UtilisateurId);
        b.ReferenceUtilisateur(x => x.AjouteParId);
    }
}

internal sealed class ConfigurationGrilleAgence : IEntityTypeConfiguration<GrilleAgence>
{
    public void Configure(EntityTypeBuilder<GrilleAgence> b)
    {
        b.ToTable("GrillesAgence");
        b.AppartientAuProjet(p => p.Grille);
    }
}

internal sealed class ConfigurationPlanningVenduProfil : IEntityTypeConfiguration<PlanningVenduProfil>
{
    public void Configure(EntityTypeBuilder<PlanningVenduProfil> b)
    {
        b.ToTable("PlanningsVendusProfil");
        b.AppartientAuProjet(p => p.PlanningProfils);
        b.Property(x => x.Mois).HasMaxLength(7).IsRequired();
        b.HasOne<ProfilProjet>().WithMany().HasForeignKey(x => x.ProfilProjetId).IsRequired();
        b.HasIndex(x => new { x.ProfilProjetId, x.Mois }).IsUnique(); // unique par profil et mois
    }
}

internal sealed class ConfigurationPlanningVenduPhase : IEntityTypeConfiguration<PlanningVenduPhase>
{
    public void Configure(EntityTypeBuilder<PlanningVenduPhase> b)
    {
        b.ToTable("PlanningsVendusPhase");
        b.AppartientAuProjet(p => p.PlanningPhases);
        b.Property(x => x.Phase).HasMaxLength(50);
        b.Property(x => x.CjmSaisi).HasMaxLength(100);
        b.HasMany(x => x.Mois).WithOne().HasForeignKey(m => m.PlanningVenduPhaseId).IsRequired();
    }
}

internal sealed class ConfigurationPlanningVenduPhaseMois : IEntityTypeConfiguration<PlanningVenduPhaseMois>
{
    public void Configure(EntityTypeBuilder<PlanningVenduPhaseMois> b)
    {
        b.ToTable("PlanningsVendusPhaseMois");
        b.AppartientAuProjet();
        b.Property(x => x.Mois).HasMaxLength(7).IsRequired();
        b.HasIndex(x => new { x.PlanningVenduPhaseId, x.Mois }).IsUnique();
    }
}

internal sealed class ConfigurationLigneBudgetAchat : IEntityTypeConfiguration<LigneBudgetAchat>
{
    public void Configure(EntityTypeBuilder<LigneBudgetAchat> b)
    {
        b.ToTable("BudgetsAchat");
        b.AppartientAuProjet(p => p.BudgetAchats);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
    }
}

internal sealed class ConfigurationLigneBudgetFrais : IEntityTypeConfiguration<LigneBudgetFrais>
{
    public void Configure(EntityTypeBuilder<LigneBudgetFrais> b)
    {
        b.ToTable("BudgetsFrais");
        b.AppartientAuProjet(p => p.BudgetFrais);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
    }
}

internal sealed class ConfigurationPrestataire : IEntityTypeConfiguration<Prestataire>
{
    public void Configure(EntityTypeBuilder<Prestataire> b)
    {
        b.ToTable("Prestataires");
        b.AppartientAuProjet(p => p.Prestataires);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
    }
}

internal sealed class ConfigurationMetrique : IEntityTypeConfiguration<Metrique>
{
    public void Configure(EntityTypeBuilder<Metrique> b)
    {
        b.ToTable("Metriques");
        b.AppartientAuProjet(p => p.Metriques);
    }
}

internal sealed class ConfigurationEcheance : IEntityTypeConfiguration<Echeance>
{
    public void Configure(EntityTypeBuilder<Echeance> b)
    {
        b.ToTable("Echeances");
        b.AppartientAuProjet(p => p.Echeances);
        b.Property(x => x.MoisTsp).HasMaxLength(7);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.HasIndex(x => new { x.ProjetId, x.Numero }).IsUnique();
        b.HasMany(x => x.Phases).WithOne().HasForeignKey(l => l.EcheanceId).IsRequired();
        b.Ignore(x => x.EstSelectionnable);
    }
}
