using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Infrastructure.Donnees;

namespace PilotageForfaits.Infrastructure.Tests;

/// <summary>
/// Tests d'intégration de la migration initiale sur un vrai serveur PostgreSQL.
/// Configurez POSTGRES_TEST_CONNECTION pour exécuter ce test.
/// </summary>
public sealed class MigrationPostgreSqlTests
{
    [PostgreSqlFact]
    public async Task La_migration_initiale_est_applicable_et_idempotente()
    {
        var connectionString = Environment.GetEnvironmentVariable("POSTGRES_TEST_CONNECTION");
        Assert.False(string.IsNullOrWhiteSpace(connectionString));

        var options = new DbContextOptionsBuilder<PilotageDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        await using var db = new PilotageDbContext(options);

        Assert.False(db.Database.HasPendingModelChanges());

        await db.Database.MigrateAsync();

        var migrationsAppliquees = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
        Assert.NotEmpty(migrationsAppliquees);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        const string nomTable = "Projets";
        FormattableString requete = $"SELECT COUNT(*) AS \"Value\" FROM information_schema.tables WHERE table_schema = 'public' AND table_name = {nomTable}";
        var nombreTablesProjets = await db.Database.SqlQuery<int>(requete).SingleAsync();
        Assert.Equal(1, nombreTablesProjets);

        // A second migration pass must not change migration history or fail.
        await db.Database.MigrateAsync();

        Assert.Equal(
            migrationsAppliquees,
            (await db.Database.GetAppliedMigrationsAsync()).ToArray());
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }
}

/// <summary>
/// Skip the PostgreSQL integration test explicitly when no test connection is configured.
/// CI sets POSTGRES_TEST_CONNECTION and therefore executes the test.
/// </summary>
public sealed class PostgreSqlFactAttribute : FactAttribute
{
    public PostgreSqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("POSTGRES_TEST_CONNECTION")))
        {
            Skip = "POSTGRES_TEST_CONNECTION is not configured.";
        }
    }
}
