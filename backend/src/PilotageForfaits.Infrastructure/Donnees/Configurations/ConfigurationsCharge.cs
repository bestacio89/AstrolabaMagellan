using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationTache : IEntityTypeConfiguration<Tache>
{
    public void Configure(EntityTypeBuilder<Tache> b)
    {
        b.ToTable("Taches");
        b.AppartientAuProjet(p => p.Taches);
        b.Property(x => x.Repere).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Repere }).IsUnique();
        b.HasIndex(x => new { x.ProjetId, x.Position });
        b.Property(x => x.CodeAxeTsp).HasMaxLength(50);
        b.Property(x => x.LotTsp).HasMaxLength(50);
        b.Property(x => x.PhaseTsp).HasMaxLength(50);
        b.Property(x => x.Lot).HasMaxLength(50);
        b.Property(x => x.LibelleTsp).HasMaxLength(1000);
        b.Property(x => x.Libelle).HasMaxLength(1000);
        b.Property(x => x.Hypothese).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.IaCommentaire).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.MarqueurLivrable).HasMaxLength(50);
        b.HasOne(x => x.Axe).WithMany().HasForeignKey(x => x.AxeId).IsRequired(false);
        b.HasOne(x => x.Phase).WithMany().HasForeignKey(x => x.PhaseId).IsRequired(false);
        b.HasOne(x => x.TypeTache).WithMany().HasForeignKey(x => x.TypeTacheId).IsRequired(false);
        b.HasOne<Echeance>().WithMany().HasForeignKey(x => x.EcheanceId).IsRequired(false);
        b.HasMany(x => x.Charges).WithOne().HasForeignKey(c => c.TacheId).IsRequired();
        b.HasMany(x => x.Consommes).WithOne().HasForeignKey(c => c.TacheId).IsRequired();
        b.HasMany(x => x.Evolutions).WithOne().HasForeignKey(e => e.TacheId).IsRequired();
        b.Ignore(x => x.EstAnnulee);
        b.ToTable(t => t.HasCheckConstraint("CK_Taches_Avancement", "[Avancement] IS NULL OR (CAST([Avancement] AS FLOAT) >= 0 AND CAST([Avancement] AS FLOAT) <= 1)"));
    }
}

internal sealed class ConfigurationChargeTache : IEntityTypeConfiguration<ChargeTache>
{
    public void Configure(EntityTypeBuilder<ChargeTache> b)
    {
        b.ToTable("ChargesTache", t => t.HasCheckConstraint("CK_ChargesTache_Positives", "CAST([ChargeVendue] AS FLOAT) >= 0 AND CAST([ChargeAjoutee] AS FLOAT) >= 0"));
        b.AppartientAuProjet();
        b.HasOne(x => x.ProfilProjet).WithMany().HasForeignKey(x => x.ProfilProjetId).IsRequired();
        b.HasIndex(x => new { x.TacheId, x.ProfilProjetId }).IsUnique(); // une charge par tâche et profil
        b.Property(x => x.MotifAjout).HasMaxLength(2000);
        b.ReferenceUtilisateur(x => x.AjouteeParId);
    }
}

internal sealed class ConfigurationConsomme : IEntityTypeConfiguration<Consomme>
{
    public void Configure(EntityTypeBuilder<Consomme> b)
    {
        b.ToTable("Consommes", t => t.HasCheckConstraint("CK_Consommes_Positif", "CAST([JoursHomme] AS FLOAT) > 0"));
        b.AppartientAuProjet();
        b.HasOne<ProfilProjet>().WithMany().HasForeignKey(x => x.ProfilProjetId).IsRequired();
        b.HasIndex(x => new { x.TacheId, x.ProfilProjetId, x.Jour }).IsUnique(); // un consommé par tâche, profil et jour
        b.HasIndex(x => new { x.ProfilProjetId, x.Jour }); // contrôle « 1 JH par personne et par jour »
        b.ReferenceUtilisateur(x => x.SaisiParId);
    }
}

internal sealed class ConfigurationEvolutionPerimetre : IEntityTypeConfiguration<EvolutionPerimetre>
{
    public void Configure(EntityTypeBuilder<EvolutionPerimetre> b)
    {
        b.ToTable("EvolutionsPerimetre");
        b.AppartientAuProjet();
        b.HasOne<ProfilProjet>().WithMany().HasForeignKey(x => x.ProfilProjetId).IsRequired(false);
        b.HasOne<ProfilProjet>().WithMany().HasForeignKey(x => x.ProfilSourceId).IsRequired(false);
        b.HasOne<Decision>().WithMany().HasForeignKey(x => x.DecisionId).IsRequired(false);
        b.Property(x => x.Motif).HasMaxLength(2000);
        b.ReferenceUtilisateur(x => x.ParId);
    }
}
