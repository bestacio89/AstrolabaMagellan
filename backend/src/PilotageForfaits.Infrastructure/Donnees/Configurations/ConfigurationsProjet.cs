using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationProjet : IEntityTypeConfiguration<Projet>
{
    public void Configure(EntityTypeBuilder<Projet> b)
    {
        b.ToTable("Projets");
        b.Property(x => x.Code).HasMaxLength(50);
        // un même forfait n'est jamais suivi deux fois (voir IdentiteProjet) ; les projets sans clé (anciens) ne sont pas concernés
        b.Property(x => x.CleUnicite).HasMaxLength(200);
        b.HasIndex(x => x.CleUnicite).IsUnique();
        b.Property(x => x.Nom).IsRequired();
        b.Property(x => x.Client).IsRequired();
        b.HasIndex(x => x.Statut);
        b.ReferenceUtilisateur(x => x.CreeParId);
        // Paramètres du projet : un seul jeu par projet, rangé dans la table des projets.
        b.OwnsOne(x => x.Parametres, p =>
        {
            p.Property(x => x.PremierMois).HasMaxLength(7);
            p.Property(x => x.Instances).HasMaxLength(Outils.TexteLong);
        });
        b.Navigation(x => x.Parametres).IsRequired();
    }
}

internal sealed class ConfigurationChampFiche : IEntityTypeConfiguration<ChampFiche>
{
    public void Configure(EntityTypeBuilder<ChampFiche> b)
    {
        b.ToTable("ChampsFiche");
        b.AppartientAuProjet(p => p.ChampsFiche);
        b.Property(x => x.Valeur).HasMaxLength(2000);
        b.Property(x => x.Cle).HasMaxLength(50);
    }
}

internal sealed class ConfigurationImportTsp : IEntityTypeConfiguration<ImportTsp>
{
    public void Configure(EntityTypeBuilder<ImportTsp> b)
    {
        b.ToTable("ImportsTsp");
        b.AppartientAuProjet(p => p.Imports);
        b.Property(x => x.NomFichier).HasMaxLength(260);
        b.Property(x => x.PointsReleves).HasMaxLength(Outils.TexteLong);
        b.ReferenceUtilisateur(x => x.ImporteParId);
        b.ReferenceUtilisateur(x => x.MasquesParId);
    }
}
