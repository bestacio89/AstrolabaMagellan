using System.Globalization;
using System.Text;

namespace PilotageForfaits.Domain.Entites;

/// <summary>
/// Absence d'une personne un jour donné. Elle appartient à la personne, pas à un projet : saisie une fois (par la personne dans
/// « Mon travail », ou par un chef de projet), elle apparaît sur tous les projets où la personne travaille. Aucun effet sur les
/// charges ni les calculs. Unique par personne et par jour.
/// </summary>
public sealed class Absence : Entite
{
    /// <summary>Personne repérée par son nom normalisé (<see cref="Personnes.Cle"/>) tant que le lien personne ↔ compte n'existe pas.</summary>
    public string PersonneCle { get; set; } = "";
    /// <summary>Nom tel qu'il a été saisi (affichage).</summary>
    public string PersonneNom { get; set; } = "";
    /// <summary>Compte de la personne quand il est connu (Azure AD).</summary>
    public Guid? UtilisateurId { get; set; }
    public DateOnly Jour { get; set; }
    public MomentAbsence Moment { get; set; } = MomentAbsence.Journee;
    public DateTimeOffset SaisieLe { get; set; }
    public Guid? SaisieParId { get; set; }
}

/// <summary>Personne ajoutée à la main à l'écran Absences d'un projet (hors profils du TSP). Unique par projet et par nom.</summary>
public sealed class PersonneAjoutee : EntiteDeProjet
{
    public string Nom { get; set; } = "";
    public string Cle { get; set; } = "";
}

/// <summary>Repérage d'une personne par son nom, comme « Mon travail » : sans accents, sans majuscules, mots dans l'ordre alphabétique.</summary>
public static class Personnes
{
    /// <summary>« MARTIN Camille », « Camille  Martin » et « camille martin » donnent la même clé : « camille martin ».</summary>
    public static string Cle(string? nom)
    {
        var d = (nom ?? "").Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        var mots = sb.ToString().ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        Array.Sort(mots, StringComparer.Ordinal);
        return string.Join(' ', mots);
    }
}
