using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Infrastructure.Donnees;

/// <summary>
/// Probabilité d'un risque enregistrée en texte. Une base remplie avec l'ancienne échelle à 3 niveaux est relue sur la nouvelle,
/// sans migration de données : « Moyenne » → Modérée (Faible et Forte ne changent pas). L'écriture se fait toujours sur la nouvelle.
/// </summary>
public sealed class ConversionProbabiliteRisque() : ValueConverter<ProbabiliteRisque, string>(
    v => v.ToString(),
    s => s == "Moyenne" ? ProbabiliteRisque.Moderee : Enum.Parse<ProbabiliteRisque>(s));

/// <summary>Importance d'un risque (colonne Impact) : anciennes valeurs « Moyen » → Moyenne, « Fort » → Forte.</summary>
public sealed class ConversionImpactRisque() : ValueConverter<ImpactRisque, string>(
    v => v.ToString(),
    s => s == "Moyen" ? ImpactRisque.Moyenne : s == "Fort" ? ImpactRisque.Forte : Enum.Parse<ImpactRisque>(s));
