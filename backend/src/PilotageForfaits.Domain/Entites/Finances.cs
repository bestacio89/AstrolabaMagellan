namespace PilotageForfaits.Domain.Entites;

/// <summary>Une phase entière conditionne une échéance. Une phase n'est liée qu'à une seule échéance.</summary>
public sealed class LienEcheancePhase : EntiteDeProjet
{
    public Guid EcheanceId { get; set; }
    public Guid PhaseId { get; set; }
    public Phase? Phase { get; set; }
}

/// <summary>Achat commandé sur le projet, rattaché à une ligne du budget du TSP ou « hors TSP ».</summary>
public sealed class AchatReel : EntiteDeProjet
{
    public Guid? LigneBudgetAchatId { get; set; }
    public DateOnly Date { get; set; }
    public string Designation { get; set; } = "";
    public string? Fournisseur { get; set; }
    public decimal Quantite { get; set; }
    public decimal CoutUnitaire { get; set; }
    public decimal Refacture { get; set; }
    public StatutAchat Statut { get; set; } = StatutAchat.Commande;
    public string Commentaire { get; set; } = "";
    public DateTimeOffset CreeLe { get; set; }
    public Guid? CreeParId { get; set; }
}

/// <summary>Note de frais rattachée au projet.</summary>
public sealed class FraisReel : EntiteDeProjet
{
    public Guid? ImportFraisId { get; set; }
    public DateOnly Date { get; set; }
    public string Collaborateur { get; set; } = "";
    public CategorieFrais Categorie { get; set; } = CategorieFrais.Autre;
    public string Libelle { get; set; } = "";
    public decimal Montant { get; set; }
    public bool Refacturable { get; set; }
    public string Commentaire { get; set; } = "";
    public DateTimeOffset CreeLe { get; set; }
    public Guid? CreeParId { get; set; }
}

/// <summary>Lot de frais repris d'un fichier (V1).</summary>
public sealed class ImportFrais : EntiteDeProjet
{
    public string Source { get; set; } = "";
    public string NomFichier { get; set; } = "";
    public DateTimeOffset ImporteLe { get; set; }
    public Guid? ImporteParId { get; set; }
    public int NombreLignes { get; set; }
}

/// <summary>
/// Instantané des indicateurs pris à chaque comité : seule exception au principe « on ne stocke pas les résultats »,
/// pour comparer un comité au suivant. Unique par date et nature.
/// </summary>
public sealed class PhotoIndicateurs : EntiteDeProjet
{
    public DateOnly Date { get; set; }
    public NaturePhoto Nature { get; set; }
    public decimal Prevu { get; set; }
    public decimal Consomme { get; set; }
    public decimal ResteAFaire { get; set; }
    public decimal Atterrissage { get; set; }
    public decimal CoutFinal { get; set; }
    public decimal Marge { get; set; }
    public decimal MargeNette { get; set; }
    public decimal TauxMargeNette { get; set; }
    public DateOnly? FinPrevue { get; set; }
}

/// <summary>Planning figé à une date, pour mesurer les dérives (V1).</summary>
public sealed class PlanReference : EntiteDeProjet
{
    public DateOnly Date { get; set; }
    public string Libelle { get; set; } = "";
    public Guid? FigeParId { get; set; }
    public List<LignePlanReference> Lignes { get; set; } = new();
}

public sealed class LignePlanReference : EntiteDeProjet
{
    public Guid PlanReferenceId { get; set; }
    public Guid TacheId { get; set; }
    public DateOnly? DebutPrevu { get; set; }
    public DateOnly? FinPrevue { get; set; }
    public decimal ChargePrevue { get; set; }
    /// <summary>Cause de l'écart avec cette référence (une valeur de <see cref="CausesDerive.Liste"/>), renseignée par le chef de projet.</summary>
    public string? Cause { get; set; }
    /// <summary>Explication libre de l'écart.</summary>
    public string? Motif { get; set; }
}

/// <summary>Causes possibles d'une dérive de planning (liste courte, pour pouvoir compter et comparer les projets).</summary>
public static class CausesDerive
{
    public static readonly IReadOnlyList<string> Liste = new[] { "Client", "Périmètre", "Équipe", "Technique", "Estimation", "Autre" };
}

/// <summary>Alerte envoyée par e-mail (V1).</summary>
public sealed class Notification : EntiteDeProjet
{
    public Guid DestinataireId { get; set; }
    public NatureNotification Nature { get; set; }
    /// <summary>Objet concerné (action, livrable, atelier ou échéance).</summary>
    public Guid ObjetId { get; set; }
    public DateOnly DateCible { get; set; }
    public DateTimeOffset? EnvoyeeLe { get; set; }
    public StatutEnvoi StatutEnvoi { get; set; } = StatutEnvoi.AEnvoyer;
}
