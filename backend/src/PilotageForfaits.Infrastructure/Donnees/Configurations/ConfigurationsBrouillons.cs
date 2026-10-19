using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

internal sealed class ConfigurationBrouillonProjet : IEntityTypeConfiguration<BrouillonProjet>
{
    public void Configure(EntityTypeBuilder<BrouillonProjet> b)
    {
        b.ToTable("BrouillonsProjet");
        b.Property(x => x.Client).IsRequired();
        b.Property(x => x.Nom).IsRequired();
        // contenu du TSP en cours de rédaction (JSON) : sans limite de longueur (nvarchar(max))
        b.Property(x => x.Contenu).IsRequired().Metadata.SetMaxLength(null);
        b.HasOne(x => x.CreePar).WithMany().HasForeignKey(x => x.CreeParId).IsRequired();
        b.HasOne(x => x.CoRedacteur).WithMany().HasForeignKey(x => x.CoRedacteurId).IsRequired(false);
        b.ReferenceUtilisateur(x => x.ModifieParId);
    }
}
