using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Infrastructure;

/// <summary>Date et heure réelles. « Aujourd'hui » est calculé à l'heure de Paris, quel que soit le fuseau du serveur.</summary>
public sealed class HorlogeSysteme : IHorloge
{
    public DateTimeOffset Maintenant => DateTimeOffset.UtcNow;

    public DateOnly Aujourdhui => HeureDeParis.Date(DateTimeOffset.UtcNow);
}
