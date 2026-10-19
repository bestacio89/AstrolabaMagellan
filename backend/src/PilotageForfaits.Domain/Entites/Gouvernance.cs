using System.Globalization;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Entites;

/// <summary>
/// Organisation d'une tâche de type atelier : date convenue avec le client, horaire, invitation, destinataires.
/// Sa date de réalisation se déduit (dernier jour de consommé une fois la tâche validée).
/// </summary>
public sealed class Atelier : EntiteDeProjet
{
    public Guid TacheId { get; set; }
    public DateOnly? DatePlanifiee { get; set; }
    public TimeOnly? HeureDebut { get; set; }
    public TimeOnly? HeureFin { get; set; }
    public bool InvitationEnvoyee { get; set; }
    /// <summary>Date d'envoi de l'invitation.</summary>
    public DateOnly? EnvoyeeLe { get; set; }
    public List<Destinataire> Destinataires { get; set; } = new();

    /// <summary>Fixe (ou efface) la date de l'atelier. Sans date, l'invitation n'a plus de sens : elle est effacée.</summary>
    public void DefinirDate(DateOnly? date)
    {
        DatePlanifiee = date;
        if (date is null)
        {
            InvitationEnvoyee = false;
            EnvoyeeLe = null;
        }
    }

    /// <summary>Horaire : la fin doit être après le début ; sans heure de début, pas d'heure de fin.</summary>
    public void DefinirHoraire(TimeOnly? debut, TimeOnly? fin)
    {
        if (debut is null) fin = null;
        if (debut is not null && fin is not null && fin <= debut)
            throw new RegleMetierException($"L’heure de fin ({fin.Value.ToString("HH:mm", CultureInfo.InvariantCulture)}) doit être après l’heure de début ({debut.Value.ToString("HH:mm", CultureInfo.InvariantCulture)}) : saisie annulée.");
        HeureDebut = debut;
        HeureFin = fin;
    }

    /// <summary>Invitation envoyée (datée du jour si aucune date n'est connue) ou envoi annulé.</summary>
    public void MarquerInvitation(bool envoyee, DateOnly aujourdhui)
    {
        InvitationEnvoyee = envoyee;
        EnvoyeeLe = envoyee ? EnvoyeeLe ?? aujourdhui : null;
    }

    /// <summary>Corrige la date d'envoi de l'invitation : obligatoire et jamais dans le futur.</summary>
    public void DefinirDateEnvoi(DateOnly? le, DateOnly aujourdhui)
    {
        if (le is null) throw new RegleMetierException("Date d’envoi obligatoire : pour annuler l’envoi, utilisez « Annuler l’envoi ».");
        if (le > aujourdhui) throw new RegleMetierException("La date d’envoi ne peut pas être dans le futur : saisie annulée.");
        InvitationEnvoyee = true;
        EnvoyeeLe = le;
    }

    /// <summary>Plus rien n'est renseigné : l'organisation peut être supprimée.</summary>
    public bool EstVide => DatePlanifiee is null && HeureDebut is null && HeureFin is null && !InvitationEnvoyee && Destinataires.Count == 0;
}

/// <summary>Invité à un atelier.</summary>
public sealed class Destinataire : EntiteDeProjet
{
    public Guid AtelierId { get; set; }
    public string NomOuEmail { get; set; } = "";
    public int Ordre { get; set; }
    public Guid? UtilisateurId { get; set; }
}

/// <summary>Suivi d'une tâche de type livrable. « Livré le » se déduit de la validation de la tâche.</summary>
public sealed class Livrable : EntiteDeProjet
{
    public Guid TacheId { get; set; }
    /// <summary>Validation par le client : manuelle.</summary>
    public DateOnly? ValideParClientLe { get; set; }
    /// <summary>Lien vers le lieu de stockage du livrable (V1).</summary>
    public string? LienStockage { get; set; }
}

/// <summary>
/// Mise à jour écrite sur une tâche (fil daté et signé, visible par toute l'équipe du projet).
/// On ajoute, on ne modifie ni ne supprime : le fil garde la trace de ce qui a été dit.
/// </summary>
public sealed class MiseAJourTache : EntiteDeProjet
{
    public Guid TacheId { get; set; }
    /// <summary>Date et heure UTC.</summary>
    public DateTime Le { get; set; }
    public Guid? AuteurId { get; set; }
    public string Texte { get; set; } = "";
}

/// <summary>
/// Point hebdo (ou mensuel) : ce que le chef de projet complète pour la diapositive de suivi delivery
/// (actualités, points d'attention, indicateurs, météo), une ligne par période ; la ligne « reglages » garde l'équipe et les logos.
/// Le contenu est un JSON validé par le service (PointsHebdoService).
/// </summary>
public sealed class PointHebdo : EntiteDeProjet
{
    /// <summary>« reglages », « S:AAAA-MM-JJ » (lundi de la semaine) ou « M:AAAA-MM ».</summary>
    public string Cle { get; set; } = "";
    public string Contenu { get; set; } = "{}";
    /// <summary>Date et heure UTC de la dernière modification.</summary>
    public DateTime MajLe { get; set; }
    public Guid? ParId { get; set; }
}

/// <summary>Action à mener (référence A-001…).</summary>
public sealed class ActionProjet : EntiteDeProjet
{
    public string Reference { get; set; } = "";
    public string Libelle { get; set; } = "";
    public string Porteur { get; set; } = "";
    public Guid? PorteurId { get; set; }
    public string? Instance { get; set; }
    public DateOnly CreeeLe { get; set; }
    public DateOnly? DateCible { get; set; }
    public decimal Progression { get; set; }
    public StatutAction Statut { get; set; } = StatutAction.AFaire;
    public DateOnly? FaiteLe { get; set; }
    public string Commentaire { get; set; } = "";
    public Guid? CreeeParId { get; set; }
    public Guid? TacheId { get; set; }
}

/// <summary>Décision prise ou à valider (référence D-001…).</summary>
public sealed class Decision : EntiteDeProjet
{
    public string Reference { get; set; } = "";
    public DateOnly Date { get; set; }
    public string? Instance { get; set; }
    public string Libelle { get; set; } = "";
    public string? Decideur { get; set; }
    public string? Impact { get; set; }
    public StatutDecision Statut { get; set; } = StatutDecision.AValider;
    public string Commentaire { get; set; } = "";
    public Guid? CreeeParId { get; set; }
}

/// <summary>Risque projet (référence R-001…). Criticité = probabilité × importance (4 niveaux chacune, de 1 à 16).</summary>
public sealed class Risque : EntiteDeProjet
{
    public string Reference { get; set; } = "";
    public string Libelle { get; set; } = "";
    public ProbabiliteRisque Probabilite { get; set; } = ProbabiliteRisque.Moderee;
    /// <summary>Importance (le nom « Impact » est celui d'origine, gardé pour les données existantes).</summary>
    public ImpactRisque Impact { get; set; } = ImpactRisque.Moyenne;
    public TypeRisque? Type { get; set; }
    /// <summary>Cause du risque.</summary>
    public string? Cause { get; set; }
    /// <summary>« Comment réduire » (nom d'origine : parade).</summary>
    public string? Parade { get; set; }
    /// <summary>Plan d'actions.</summary>
    public string? Plan { get; set; }
    public string? Responsable { get; set; }
    public StatutRisque Statut { get; set; } = StatutRisque.Ouvert;
    public string Commentaire { get; set; } = "";
    public DateTimeOffset CreeLe { get; set; }
    public Guid? CreeParId { get; set; }
    public Guid? ActionId { get; set; }
}
