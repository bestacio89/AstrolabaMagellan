using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationAxe : IEntityTypeConfiguration<Axe>
{
    public void Configure(EntityTypeBuilder<Axe> b)
    {
        b.ToTable("Axes");
        b.AppartientAuProjet(p => p.Axes);
        b.Property(x => x.Code).HasMaxLength(50).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Code }).IsUnique();
    }
}

internal sealed class ConfigurationPhase : IEntityTypeConfiguration<Phase>
{
    public void Configure(EntityTypeBuilder<Phase> b)
    {
        b.ToTable("Phases");
        b.AppartientAuProjet(p => p.Phases);
        b.Property(x => x.Code).HasMaxLength(50).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Code }).IsUnique();
    }
}

internal sealed class ConfigurationEtape : IEntityTypeConfiguration<Etape>
{
    public void Configure(EntityTypeBuilder<Etape> b)
    {
        b.ToTable("Etapes");
        b.AppartientAuProjet(p => p.Etapes);
    }
}

internal sealed class ConfigurationTypeTache : IEntityTypeConfiguration<TypeTache>
{
    public void Configure(EntityTypeBuilder<TypeTache> b)
    {
        b.ToTable("TypesTache");
        b.AppartientAuProjet(p => p.TypesTache);
        b.Property(x => x.Code).HasMaxLength(50).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Code }).IsUnique();
    }
}

internal sealed class ConfigurationValeurListeIa : IEntityTypeConfiguration<ValeurListeIa>
{
    public void Configure(EntityTypeBuilder<ValeurListeIa> b)
    {
        b.ToTable("ValeursListeIa");
        b.AppartientAuProjet(p => p.ValeursIa);
    }
}
