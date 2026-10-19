using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationPrevisionnelProfil : IEntityTypeConfiguration<PrevisionnelProfil>
{
    public void Configure(EntityTypeBuilder<PrevisionnelProfil> b)
    {
        b.ToTable("PrevisionnelsProfil");
        b.AppartientAuProjet();
        b.Property(x => x.Mois).HasMaxLength(7).IsRequired();
        b.HasOne<ProfilProjet>().WithMany().HasForeignKey(x => x.ProfilProjetId).IsRequired();
        b.HasIndex(x => new { x.ProfilProjetId, x.Mois }).IsUnique(); // unique par profil et mois
    }
}

internal sealed class ConfigurationDatesPlanning : IEntityTypeConfiguration<DatesPlanning>
{
    public void Configure(EntityTypeBuilder<DatesPlanning> b)
    {
        b.ToTable("DatesPlanning");
        b.AppartientAuProjet();
        b.Property(x => x.Cle).HasMaxLength(200).IsRequired();
        b.Property(x => x.Nom).HasMaxLength(200);
        b.HasIndex(x => new { x.ProjetId, x.Cle }).IsUnique(); // une ligne par ligne du planning
    }
}

internal sealed class ConfigurationJalon : IEntityTypeConfiguration<Jalon>
{
    public void Configure(EntityTypeBuilder<Jalon> b)
    {
        b.ToTable("Jalons");
        b.AppartientAuProjet();
        b.Property(x => x.Libelle).HasMaxLength(200).IsRequired();
    }
}

internal sealed class ConfigurationElementPlanning : IEntityTypeConfiguration<ElementPlanning>
{
    public void Configure(EntityTypeBuilder<ElementPlanning> b)
    {
        b.ToTable("ElementsPlanning");
        b.AppartientAuProjet();
        b.Property(x => x.Cle).HasMaxLength(200).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Nature, x.Cle }).IsUnique();
    }
}

internal sealed class ConfigurationDatesPlanReference : IEntityTypeConfiguration<DatesPlanReference>
{
    public void Configure(EntityTypeBuilder<DatesPlanReference> b)
    {
        b.ToTable("DatesPlanReference");
        b.AppartientAuProjet();
        b.Property(x => x.Cle).HasMaxLength(200).IsRequired();
        b.HasOne<PlanReference>().WithMany().HasForeignKey(x => x.PlanReferenceId).IsRequired();
        b.HasIndex(x => new { x.PlanReferenceId, x.Cle }).IsUnique();
    }
}

internal sealed class ConfigurationAbsence : IEntityTypeConfiguration<Absence>
{
    public void Configure(EntityTypeBuilder<Absence> b)
    {
        // Une absence appartient à la personne, pas à un projet : elle est visible sur tous ses projets.
        b.ToTable("Absences");
        b.Property(x => x.PersonneCle).HasMaxLength(200).IsRequired();
        b.Property(x => x.PersonneNom).HasMaxLength(200).IsRequired();
        b.HasIndex(x => new { x.PersonneCle, x.Jour }).IsUnique(); // une saisie par personne et par jour
        b.HasIndex(x => x.UtilisateurId);
        b.ReferenceUtilisateur(x => x.UtilisateurId);
        b.ReferenceUtilisateur(x => x.SaisieParId);
    }
}

internal sealed class ConfigurationPersonneAjoutee : IEntityTypeConfiguration<PersonneAjoutee>
{
    public void Configure(EntityTypeBuilder<PersonneAjoutee> b)
    {
        b.ToTable("PersonnesAjoutees");
        b.AppartientAuProjet();
        b.Property(x => x.Nom).HasMaxLength(200).IsRequired();
        b.Property(x => x.Cle).HasMaxLength(200).IsRequired();
        b.HasIndex(x => new { x.ProjetId, x.Cle }).IsUnique(); // doublon refusé, sans tenir compte des majuscules ni des accents
    }
}
