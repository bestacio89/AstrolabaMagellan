namespace PilotageForfaits.Domain.Commun;

/// <summary>
/// Les dates affichées sont celles de Paris, quel que soit le fuseau du serveur
/// (en UTC, une saisie faite entre 0 h et 2 h tomberait encore la veille).
/// </summary>
public static class HeureDeParis
{
    /// <summary>Fuseau de Paris (nom IANA sous Linux, nom Windows sinon). UTC en dernier recours, si le serveur n'a aucune base de fuseaux.</summary>
    public static readonly TimeZoneInfo Fuseau = Trouver();

    /// <summary>Date à Paris d'un instant donné.</summary>
    public static DateOnly Date(DateTimeOffset instant) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, Fuseau).DateTime);

    private static TimeZoneInfo Trouver()
    {
        foreach (var id in new[] { "Europe/Paris", "Romance Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }
}
