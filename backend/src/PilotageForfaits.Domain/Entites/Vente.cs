using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Entites;

// Objets du TSP vendu. Ils sont figés après l'import : le suivi s'ajoute à côté (charges ajoutées, annulations, consommé).

/// <summary>Profil vendu au TSP ou ajouté en cours de projet. Un profil = une personne.</summary>
public sealed class ProfilProjet : EntiteDeProjet
{
    /// <summary>Rang dans le TSP (ordre d'affichage). C'est une information, jamais une clé.</summary>
    public int Rang { get; set; }
    public string Nom { get; set; } = "";
    /// <summary>FO, BO, CESSION, ACHAT ou ACHAT BO.</summary>
    public string Entite { get; set; } = "FO";
    public decimal Tjm { get; set; }
    public decimal Cjm { get; set; }
    public decimal? Prcs { get; set; }
    public decimal Frais { get; set; }
    public string Collaborateur { get; set; } = "";
    public Guid? UtilisateurId { get; set; }
    public OrigineElement Origine { get; set; } = OrigineElement.Tsp;
    public DateTimeOffset? AjouteLe { get; set; }
    public Guid? AjouteParId { get; set; }
    public string? MotifAjout { get; set; }
    /// <summary>Profil « Agent IA » : sa charge est une enveloppe adossée aux profils humains de la tâche.</summary>
    public bool EstAgentIa { get; set; }
}

/// <summary>Grille de TJM et CJM de référence du TSP.</summary>
public sealed class GrilleAgence : EntiteDeProjet
{
    public int Ordre { get; set; }
    public string Profil { get; set; } = "";
    public decimal TjmParis { get; set; }
    public decimal CjmParis { get; set; }
    public decimal TjmRegion { get; set; }
    public decimal CjmRegion { get; set; }
}

/// <summary>Planning mensuel vendu par profil (onglet PLANNING ou PILOTAGE CHARGES). Unique par profil et mois.</summary>
public sealed class PlanningVenduProfil : EntiteDeProjet
{
    public Guid ProfilProjetId { get; set; }
    /// <summary>Mois au format AAAA-MM.</summary>
    public string Mois { get; set; } = "";
    public decimal JoursHomme { get; set; }
}

/// <summary>Ligne du second tableau de l'onglet PLANNING (planning par phase).</summary>
public sealed class PlanningVenduPhase : EntiteDeProjet
{
    public string Phase { get; set; } = "";
    public int Ordre { get; set; }
    /// <summary>CJM saisi dans le TSP (texte libre), pour information.</summary>
    public string? CjmSaisi { get; set; }
    public List<PlanningVenduPhaseMois> Mois { get; set; } = new();
}

public sealed class PlanningVenduPhaseMois : EntiteDeProjet
{
    public Guid PlanningVenduPhaseId { get; set; }
    /// <summary>Mois au format AAAA-MM.</summary>
    public string Mois { get; set; } = "";
    public decimal JoursHomme { get; set; }
}

/// <summary>Achat vendu au TSP.</summary>
public sealed class LigneBudgetAchat : EntiteDeProjet
{
    public int Ordre { get; set; }
    public string Designation { get; set; } = "";
    public string Type { get; set; } = "";
    public decimal CoutUnitaire { get; set; }
    public decimal Quantite { get; set; }
    public decimal Revente { get; set; }
    public string Commentaire { get; set; } = "";
}

/// <summary>Frais vendus au TSP.</summary>
public sealed class LigneBudgetFrais : EntiteDeProjet
{
    public int Ordre { get; set; }
    public string Libelle { get; set; } = "";
    public decimal CoutUnitaire { get; set; }
    public decimal Quantite { get; set; }
    public decimal Refacture { get; set; }
    public string Commentaire { get; set; } = "";
}

/// <summary>Sous-traitant prévu au TSP.</summary>
public sealed class Prestataire : EntiteDeProjet
{
    public int Ordre { get; set; }
    public string Designation { get; set; } = "";
    public string Societe { get; set; } = "";
    public decimal CoutJour { get; set; }
    public decimal NombreJours { get; set; }
    public decimal Tjm { get; set; }
    public string Commentaire { get; set; } = "";
}

/// <summary>Répartition attendue de la charge par étape (onglet METRIQUE).</summary>
public sealed class Metrique : EntiteDeProjet
{
    public int Ordre { get; set; }
    public string Etape { get; set; } = "";
    public decimal Pourcentage { get; set; }
}

/// <summary>Jalon de facturation vendu, et son suivi.</summary>
public sealed class Echeance : EntiteDeProjet
{
    public int Numero { get; set; }
    public string Nom { get; set; } = "";
    public decimal Pourcentage { get; set; }
    /// <summary>Mois de facturation prévu au TSP (AAAA-MM).</summary>
    public string? MoisTsp { get; set; }
    public DateOnly? DatePrevue { get; set; }
    public DateOnly? FactureeLe { get; set; }
    public DateOnly? PayeeLe { get; set; }
    /// <summary>Montant figé au moment de la facturation : il ne bouge plus ensuite.</summary>
    public decimal? MontantFacture { get; set; }
    public string Commentaire { get; set; } = "";

    public List<LienEcheancePhase> Phases { get; set; } = new();

    /// <summary>Une échéance facturée reste visible mais ne peut plus être choisie pour un nouveau lien.</summary>
    public bool EstSelectionnable => FactureeLe is null;

    /// <summary>
    /// Facture l'échéance (ou corrige la date de facture). La date ne peut pas être dans le futur ni après le paiement.
    /// Le montant est figé à la première facturation : un avenant ultérieur ne modifie plus une facture émise.
    /// </summary>
    public void Facturer(DateOnly le, decimal montant, DateOnly aujourdhui)
    {
        if (le > aujourdhui)
            throw new RegleMetierException("Date dans le futur : indiquez la date réelle d’émission de la facture. Saisie annulée.");
        if (montant < 0) throw new RegleMetierException("Le montant facturé ne peut pas être négatif.");
        if (PayeeLe is not null && PayeeLe < le)
            throw new RegleMetierException($"La facture ne peut pas être postérieure au paiement ({Calendrier.Fr(PayeeLe.Value)}) : saisie annulée.");
        if (FactureeLe is null) MontantFacture = Math.Round(montant, 2, MidpointRounding.AwayFromZero);
        FactureeLe = le;
    }

    /// <summary>Enregistre (ou efface) le paiement : il suit forcément la facturation et ne peut pas être dans le futur.</summary>
    public void EnregistrerPaiement(DateOnly? le, DateOnly aujourdhui)
    {
        if (le is null) { PayeeLe = null; return; }
        if (FactureeLe is null) throw new RegleMetierException("Indiquez d’abord la date de facturation.");
        if (le > aujourdhui) throw new RegleMetierException("Date dans le futur : indiquez la date réelle du paiement. Saisie annulée.");
        if (le < FactureeLe)
            throw new RegleMetierException($"Le paiement ne peut pas précéder la facture ({Calendrier.Fr(FactureeLe.Value)}) : saisie annulée.");
        PayeeLe = le;
    }

    /// <summary>Annule la facturation (erreur de saisie) : le montant redevient calculé.</summary>
    public void AnnulerFacturation()
    {
        FactureeLe = null;
        PayeeLe = null;
        MontantFacture = null;
    }
}
