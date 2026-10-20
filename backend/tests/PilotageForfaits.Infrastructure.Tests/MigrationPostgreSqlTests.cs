using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Infrastructure.Donnees;
using Testcontainers.PostgreSql;

namespace PilotageForfaits.Infrastructure.Tests;

/// <summary>
/// Vérifie que la chaîne complète de migrations initialise le schéma sur un vrai PostgreSQL.
/// Le conteneur est créé pour ce test : aucune configuration locale ou variable d'environnement n'est requise.
/// </summary>
public sealed class MigrationPostgreSqlTests
{
    [Fact]
    public async Task La_chaine_de_migrations_cree_le_schema_attendu()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:18").Build();
        await postgres.StartAsync();

        var options = new DbContextOptionsBuilder<PilotageDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options;

        await using var db = new PilotageDbContext(options);

        Assert.False(db.Database.HasPendingModelChanges());

        await db.Database.MigrateAsync();

        var migrationsAppliquees = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
        Assert.NotEmpty(migrationsAppliquees);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        const string nomTable = "Projets";
        FormattableString requete = $"""
            SELECT COUNT(*) AS "Value"
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = {nomTable}
            """;
        var nombreTablesProjets = await db.Database.SqlQuery<int>(requete).SingleAsync();

        Assert.Equal(1, nombreTablesProjets);
    }
}
