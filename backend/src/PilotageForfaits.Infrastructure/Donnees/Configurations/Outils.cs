using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees.Configurations;

/// <summary>Raccourcis communs aux configurations des tables.</summary>
internal static class Outils
{
    /// <summary>Longueur des textes longs (commentaires, hypothèses…).</summary>
    public const int TexteLong = 4000;

    /// <summary>L'objet appartient à un projet : lien obligatoire et index sur la clé du projet.</summary>
    public static void AppartientAuProjet<T>(this EntityTypeBuilder<T> b, Expression<Func<Projet, IEnumerable<T>?>>? navigation = null)
        where T : EntiteDeProjet
    {
        b.HasOne<Projet>().WithMany(navigation).HasForeignKey(x => x.ProjetId).IsRequired();
        b.HasIndex(x => x.ProjetId);
    }

    /// <summary>Lien facultatif vers un utilisateur (auteur d'une saisie, porteur…).</summary>
    public static void ReferenceUtilisateur<T>(this EntityTypeBuilder<T> b, Expression<Func<T, object?>> cle) where T : class =>
        b.HasOne<Utilisateur>().WithMany().HasForeignKey(cle).IsRequired(false);
}
