namespace PilotageForfaits.Domain.Entites;

/// <summary>
/// Base de tous les objets enregistrés : un identifiant technique (jamais une position ou un numéro de ligne)
/// et un numéro de version. Si deux personnes modifient le même objet en même temps, la seconde est prévenue
/// au lieu d'écraser la première (le numéro de version ne correspond plus).
/// </summary>
public abstract class Entite
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Numéro de version, augmenté automatiquement à chaque enregistrement d'une modification.</summary>
    public int Version { get; set; }
}

/// <summary>Objet qui appartient à un projet. La clé du projet sert à filtrer les données selon les habilitations.</summary>
public abstract class EntiteDeProjet : Entite
{
    public Guid ProjetId { get; set; }
}
