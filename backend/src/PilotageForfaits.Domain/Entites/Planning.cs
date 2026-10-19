namespace PilotageForfaits.Domain.Entites;

/// <summary>
/// Prévisionnel de charge d'un profil pour un mois, replanifié en cours de projet. Le planning vendu (<see cref="PlanningVenduProfil"/>)
/// n'est jamais modifié : tant qu'un projet n'a aucune ligne de prévisionnel, le prévisionnel est le planning vendu.
/// Unique par profil et par mois.
/// </summary>
public sealed class PrevisionnelProfil : EntiteDeProjet
{
    public Guid ProfilProjetId { get; set; }
    /// <summary>Mois au format AAAA-MM.</summary>
    public string Mois { get; set; } = "";
    public decimal JoursHomme { get; set; }
}

/// <summary>
/// Dates prévues saisies sur une ligne du Planning (et nom d'une sous-partie). La clé repère la ligne : « id|AXE1 », « lot|1.1 »,
/// « phase|CONCEPTION » pour une ligne du regroupement, « sec|r12|AXE1 » pour les dates d'une sous-partie, « sec|r12 » pour son nom.
/// Unique par projet et par clé.
/// </summary>
public sealed class DatesPlanning : EntiteDeProjet
{
    public string Cle { get; set; } = "";
    public DateOnly? Debut { get; set; }
    public DateOnly? Fin { get; set; }
    public string? Nom { get; set; }
}

/// <summary>Jalon du projet (date ou période), éventuellement à confirmer (losange vide, sans numéro).</summary>
public sealed class Jalon : EntiteDeProjet
{
    public string Libelle { get; set; } = "";
    public TypeJalon Type { get; set; } = TypeJalon.Date;
    public DateOnly Debut { get; set; }
    /// <summary>Fin d'une période (null pour une date).</summary>
    public DateOnly? Fin { get; set; }
    public bool AConfirmer { get; set; }
}

/// <summary>
/// Élément du Planning choisi par le chef de projet : une sous-partie ou une tâche mise en avant (« sec|r12|AXE1 », « tache|r15 »),
/// ou une ligne masquée (« id|AXE1 », « phase|X »…). Masquer ne retire rien du suivi. Unique par projet, nature et clé.
/// </summary>
public sealed class ElementPlanning : EntiteDeProjet
{
    public NatureElementPlanning Nature { get; set; }
    public string Cle { get; set; } = "";
}

/// <summary>Dates prévues d'une ligne du Planning (axe, lot, phase ou sous-partie) figées avec un planning de référence.</summary>
public sealed class DatesPlanReference : EntiteDeProjet
{
    public Guid PlanReferenceId { get; set; }
    public string Cle { get; set; } = "";
    public DateOnly? Debut { get; set; }
    public DateOnly? Fin { get; set; }
}
