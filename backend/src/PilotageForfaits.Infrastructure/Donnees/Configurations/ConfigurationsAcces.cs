using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationUtilisateur : IEntityTypeConfiguration<Utilisateur>
{
    public void Configure(EntityTypeBuilder<Utilisateur> b)
    {
        b.ToTable("Utilisateurs");
        b.Property(x => x.IdentifiantExterne).HasMaxLength(100).IsRequired();
        b.HasIndex(x => x.IdentifiantExterne).IsUnique();
        b.Property(x => x.Email).HasMaxLength(320);
        b.Ignore(x => x.NomComplet);
    }
}

internal sealed class ConfigurationHabilitation : IEntityTypeConfiguration<Habilitation>
{
    public void Configure(EntityTypeBuilder<Habilitation> b)
    {
        b.ToTable("Habilitations");
        b.AppartientAuProjet(p => p.Habilitations);
        b.HasOne(x => x.Utilisateur).WithMany(u => u.Habilitations).HasForeignKey(x => x.UtilisateurId).IsRequired();
        b.HasIndex(x => new { x.UtilisateurId, x.ProjetId }).IsUnique(); // une habilitation par utilisateur et projet
        b.ReferenceUtilisateur(x => x.AccordeeParId);
    }
}

internal sealed class ConfigurationEntreeJournal : IEntityTypeConfiguration<EntreeJournal>
{
    public void Configure(EntityTypeBuilder<EntreeJournal> b)
    {
        b.ToTable("Journal");
        b.AppartientAuProjet();
        b.ReferenceUtilisateur(x => x.UtilisateurId);
        b.Property(x => x.AncienneValeur).HasMaxLength(Outils.TexteLong);
        b.Property(x => x.NouvelleValeur).HasMaxLength(Outils.TexteLong);
        b.HasIndex(x => new { x.ProjetId, x.Le });
    }
}
