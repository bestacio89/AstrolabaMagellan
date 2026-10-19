namespace PilotageForfaits.Domain.Entites;

/// <summary>Personne qui se connecte avec son compte d'entreprise (Microsoft Entra ID).</summary>
public sealed class Utilisateur : Entite
{
    /// <summary>Identifiant du compte d'entreprise (« oid » du jeton Entra ID). Unique.</summary>
    public string IdentifiantExterne { get; set; } = "";
    public string Nom { get; set; } = "";
    public string Prenom { get; set; } = "";
    public string Email { get; set; } = "";
    public bool Actif { get; set; } = true;
    public bool Administrateur { get; set; }
    public DateTimeOffset CreeLe { get; set; }
    public DateTimeOffset? DerniereConnexion { get; set; }

    public List<Habilitation> Habilitations { get; set; } = new();

    public string NomComplet => string.Join(' ', new[] { Prenom, Nom }.Where(x => !string.IsNullOrWhiteSpace(x)));
}

/// <summary>Droit d'un utilisateur sur un projet. Une seule habilitation par couple utilisateur – projet.</summary>
public sealed class Habilitation : EntiteDeProjet
{
    public Guid UtilisateurId { get; set; }
    public Utilisateur? Utilisateur { get; set; }
    public RoleProjet Role { get; set; }
    public DateTimeOffset Depuis { get; set; }
    public Guid? AccordeeParId { get; set; }
}

/// <summary>Journal des modifications : qui a changé quoi, et quand.</summary>
public sealed class EntreeJournal : EntiteDeProjet
{
    /// <summary>Date et heure UTC (type simple : toutes les bases savent le trier, ce qui sert à afficher les dernières entrées).</summary>
    public DateTime Le { get; set; }
    public Guid? UtilisateurId { get; set; }
    /// <summary>Type de l'objet modifié (ex. « Tache »).</summary>
    public string Objet { get; set; } = "";
    public Guid? ObjetId { get; set; }
    public string Champ { get; set; } = "";
    public string? AncienneValeur { get; set; }
    public string? NouvelleValeur { get; set; }
}
