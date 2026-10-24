using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationAtelier : IEntityTypeConfiguration<Atelier>
{
    public void Configure(EntityTypeBuilder<Atelier> b)
    {
        b.ToTable("Ateliers");
        b.AppartientAuProjet();
        b.HasOne<Tache>().WithMany().HasForeignKey(x => x.TacheId).IsRequired();
        b.HasIndex(x => x.TacheId).IsUnique(); // au plus un atelier par tâche
        b.HasMany(x => x.Destinataires).WithOne().HasForeignKey(d => d.AtelierId).IsRequired();
        b.Ignore(x => x.EstVide);
    }
}

internal sealed class ConfigurationDestinataire : IEntityTypeConfiguration<Destinataire>
{
    public void Configure(EntityTypeBuilder<Destinataire> b)
    {
        b.ToTable("Destinataires");
        b.AppartientAuProjet();
        b.ReferenceUtilisateur(x => x.UtilisateurId);
    }
}

internal sealed class ConfigurationLivrable : IEntityTypeConfiguration<Livrable>
{
    public void Configure(EntityTypeBuilder<Livrable> b)
    {
        b.ToTable("Livrables");
        b.AppartientAuProjet();
        b.HasOne<Tache>().WithMany().HasForeignKey(x => x.TacheId).IsRequired();
        b.HasIndex(x => x.TacheId).IsUnique(); // au plus un livrable par tâche
        b.Property(x => x.LienStockage).HasMaxLength(1000);
    }
}

internal sealed class ConfigurationCommentaire : IEntityTypeConfiguration<Commentaire>
{
    public void Configure(EntityTypeBuilder<Commentaire> b)
    {
        b.ToTable("Commentaires");
        b.AppartientAuProjet();
        b.Property(x => x.CibleType).HasMaxLength(30).IsRequired();
        b.Property(x => x.Texte).HasMaxLength(Outils.TexteLong).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.CibleType, x.CibleId, x.Le });
        b.ReferenceUtilisateur(x => x.AuteurId);
    }
}

internal sealed class ConfigurationPointHebdo : IEntityTypeConfiguration<PointHebdo>
{
    public void Configure(EntityTypeBuilder<PointHebdo> b)
    {
        b.ToTable("PointsHebdo");
        b.AppartientAuProjet();
        b.HasIndex(x => new { x.ProjetId, x.Cle }).IsUnique(); // une ligne par période (et une pour les réglages)
        b.Property(x => x.Cle).HasMaxLength(20).IsRequired();
        // texte sans limite (la règle générale des 400 caractères ne s'applique pas) : les logos y sont gardés, 1 Mo au plus chacun
        b.Property(x => x.Contenu).IsRequired().Metadata.SetMaxLength(null);
        b.ReferenceUtilisateur(x => x.ParId);
    }
}

internal sealed class ConfigurationActionProjet : IEntityTypeConfiguration<ActionProjet>
{
    public void Configure(EntityTypeBuilder<ActionProjet> b)
    {
        b.ToTable("Actions");
        b.AppartientAuProjet(p => p.Actions);
        b.Property(x => x.Reference).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Reference }).IsUnique();
        b.Property(x => x.Libelle).HasMaxLength(1000);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.HasOne<Tache>().WithMany().HasForeignKey(x => x.TacheId).IsRequired(false);
        b.ReferenceUtilisateur(x => x.PorteurId);
        b.ReferenceUtilisateur(x => x.CreeeParId);
    }
}

internal sealed class ConfigurationDecision : IEntityTypeConfiguration<Decision>
{
    public void Configure(EntityTypeBuilder<Decision> b)
    {
        b.ToTable("Decisions");
        b.AppartientAuProjet(p => p.Decisions);
        b.Property(x => x.Reference).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Reference }).IsUnique();
        b.Property(x => x.Libelle).HasMaxLength(1000);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.ReferenceUtilisateur(x => x.CreeeParId);
    }
}

internal sealed class ConfigurationRisque : IEntityTypeConfiguration<Risque>
{
    public void Configure(EntityTypeBuilder<Risque> b)
    {
        b.ToTable("Risques");
        b.AppartientAuProjet(p => p.Risques);
        b.Property(x => x.Reference).HasMaxLength(20).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Reference }).IsUnique();
        b.Property(x => x.Libelle).HasMaxLength(1000);
        b.Property(x => x.Parade).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.Cause).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.Plan).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.Commentaire).HasMaxLength(Outils.TexteLong);
        b.HasOne<ActionProjet>().WithMany().HasForeignKey(x => x.ActionId).IsRequired(false);
        b.ReferenceUtilisateur(x => x.CreeParId);
    }
}
