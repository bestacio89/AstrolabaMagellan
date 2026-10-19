using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Entites;

/// <summary>Ligne du WORKLOAD du TSP, ou tâche ajoutée en cours de projet.</summary>
public sealed class Tache : EntiteDeProjet
{
    // ---- repérage ----
    /// <summary>Repère stable de la tâche dans le projet : « r12 » pour la ligne 12 du TSP, « a1 », « a2 »… pour une tâche ajoutée.</summary>
    public string Repere { get; set; } = "";
    /// <summary>Position d'affichage (ordre du WORKLOAD, tâches ajoutées insérées après leur tâche d'ancrage).</summary>
    public int Position { get; set; }
    public OrigineElement Origine { get; set; } = OrigineElement.Tsp;

    // ---- valeurs du TSP (figées) ----
    public int? LigneTsp { get; set; }
    /// <summary>Code d'axe de la colonne A du TSP.</summary>
    public string CodeAxeTsp { get; set; } = "";
    public string LotTsp { get; set; } = "";
    public string PhaseTsp { get; set; } = "";
    public string EtapeTsp { get; set; } = "";
    public string LibelleTsp { get; set; } = "";
    public string Hypothese { get; set; } = "";
    /// <summary>Marqueur « livrable » du TSP (« oui » si la tâche produit un livrable).</summary>
    public string MarqueurLivrable { get; set; } = "";
    /// <summary>Ligne de titre du WORKLOAD (aucune charge) : ce n'est pas une tâche.</summary>
    public bool EstSection { get; set; }
    /// <summary>
    /// La colonne « Livrable » du WORKLOAD de ce TSP est renseignée (au moins un « oui ») : elle seule dit ce qu'est un livrable.
    /// Repère posé à l'import ; les projets importés avant cette règle ne l'ont pas et gardent la détection par le titre.
    /// </summary>
    public bool ColonneLivrable { get; set; }

    // ---- suivi ----
    /// <summary>Intitulé modifié en cours de projet (null : intitulé du TSP).</summary>
    public string? Libelle { get; set; }
    public Guid? AxeId { get; set; }
    public Axe? Axe { get; set; }
    public Guid? PhaseId { get; set; }
    public Phase? Phase { get; set; }
    /// <summary>Lot modifié en cours de projet (null : lot du TSP).</summary>
    public string? Lot { get; set; }
    public Guid? TypeTacheId { get; set; }
    public TypeTache? TypeTache { get; set; }
    /// <summary>Type choisi à la main. Sinon, il est déduit de l'intitulé (ex. « [Atelier] … »).</summary>
    public bool TypeSaisi { get; set; }
    /// <summary>Statut choisi ; null : « En cours » dès le premier consommé, sinon « À faire ».</summary>
    public StatutTache? Statut { get; set; }
    public decimal? Avancement { get; set; }
    /// <summary>Reste à faire saisi ; null : reste à faire automatique.</summary>
    public decimal? ResteAFaireSaisi { get; set; }
    public DateOnly? DebutPrevu { get; set; }
    public DateOnly? FinPrevue { get; set; }
    public string Commentaire { get; set; } = "";
    public DateOnly? ValideeLe { get; set; }
    public string? IaTypeOptimisation { get; set; }
    public string? IaCommentaire { get; set; }
    public decimal? IaChargeRevisee { get; set; }
    public Guid? EcheanceId { get; set; }

    public List<ChargeTache> Charges { get; set; } = new();
    public List<Consomme> Consommes { get; set; } = new();
    public List<EvolutionPerimetre> Evolutions { get; set; } = new();

    /// <summary>
    /// Une tâche est annulée quand sa dernière évolution (annulation ou rétablissement) est une annulation.
    /// L'état se déduit de l'historique (les évolutions doivent être chargées).
    /// </summary>
    public bool EstAnnulee => DerniereAnnulationOuRetablissement()?.Nature == NatureEvolution.Annulation;

    public EvolutionPerimetre? DerniereAnnulationOuRetablissement() => Evolutions
        .Where(e => e.Nature is NatureEvolution.Annulation or NatureEvolution.Retablissement)
        .OrderBy(e => e.Le)
        .LastOrDefault();

    /// <summary>Aucune saisie n'est possible sur une tâche annulée.</summary>
    public void VerifierModifiable()
    {
        if (EstAnnulee) throw new RegleMetierException("Tâche annulée : rétablissez-la pour la modifier.");
    }

    /// <summary>
    /// Change le statut. Règle : « Validé » si et seulement si l'avancement vaut 100 %.
    /// Valider met l'avancement à 100 %, efface le reste à faire saisi et retient la date de validation.
    /// Quitter « Validé » (avancement à 100 %) ramène l'avancement à 75 %, ou à 0 % si la tâche revient « À faire ».
    /// Renvoie vrai si l'avancement a été ramené (pour le signaler à l'utilisateur).
    /// </summary>
    public bool DefinirStatut(StatutTache statut, DateOnly aujourdhui)
    {
        VerifierModifiable();
        var etaitValidee = Statut == StatutTache.Valide;
        var avancementRamene = false;
        if (statut == StatutTache.Valide)
        {
            Avancement = 1;
            ResteAFaireSaisi = null;
            ValideeLe ??= aujourdhui;
        }
        else
        {
            ValideeLe = null;
            if (etaitValidee && (Avancement ?? 0) >= 1)
            {
                Avancement = statut == StatutTache.AFaire ? 0 : 0.75m;
                avancementRamene = true;
            }
        }
        Statut = statut;
        return avancementRamene;
    }

    /// <summary>
    /// Change l'avancement (0 à 100 %). Une tâche validée qui passe sous 100 % repasse « En cours ».
    /// Atteindre 100 % ne valide pas automatiquement : la méthode renvoie vrai pour proposer la validation.
    /// </summary>
    public bool DefinirAvancement(decimal avancement)
    {
        VerifierModifiable();
        if (avancement < 0 || avancement > 1) throw new RegleMetierException("L'avancement doit être compris entre 0 et 100 %.");
        if (Statut == StatutTache.Valide && avancement < 1)
        {
            Statut = StatutTache.EnCours;
            ValideeLe = null;
        }
        Avancement = avancement;
        return avancement == 1 && Statut != StatutTache.Valide;
    }

    /// <summary>
    /// Définit les dates prévues : la fin prévue doit être après le début.
    /// (Comme dans la version de référence, les dates restent modifiables sur une tâche annulée.)
    /// </summary>
    public void DefinirDatesPrevues(DateOnly? debut, DateOnly? fin)
    {
        if (debut is not null && fin is not null && fin < debut)
            throw new RegleMetierException($"La fin prévue ({Calendrier.Fr(fin.Value)}) ne peut pas précéder le début prévu ({Calendrier.Fr(debut.Value)}) : saisie annulée.");
        DebutPrevu = debut;
        FinPrevue = fin;
    }
}

/// <summary>Charge d'un profil sur une tâche : vendue au TSP, et ajoutée en cours de projet (non facturée).</summary>
public sealed class ChargeTache : EntiteDeProjet
{
    public Guid TacheId { get; set; }
    public Guid ProfilProjetId { get; set; }
    public ProfilProjet? ProfilProjet { get; set; }
    public decimal ChargeVendue { get; set; }
    public decimal ChargeAjoutee { get; set; }
    public string? MotifAjout { get; set; }
    public DateTimeOffset? AjouteeLe { get; set; }
    public Guid? AjouteeParId { get; set; }
}

/// <summary>Temps passé par un profil sur une tâche, un jour donné. Unique par tâche, profil et jour.</summary>
public sealed class Consomme : EntiteDeProjet
{
    public Guid TacheId { get; set; }
    public Guid ProfilProjetId { get; set; }
    public DateOnly Jour { get; set; }
    public decimal JoursHomme { get; set; }
    public DateTimeOffset SaisiLe { get; set; }
    public Guid? SaisiParId { get; set; }
}

/// <summary>Tout changement par rapport au vendu : nouvelle tâche, ajout de charge, annulation, rétablissement.</summary>
public sealed class EvolutionPerimetre : EntiteDeProjet
{
    public Guid TacheId { get; set; }
    /// <summary>Profil concerné ; pour une réaffectation, celui qui reçoit la charge.</summary>
    public Guid? ProfilProjetId { get; set; }
    /// <summary>Réaffectation : profil qui cède la charge.</summary>
    public Guid? ProfilSourceId { get; set; }
    public NatureEvolution Nature { get; set; }
    public DateTimeOffset Le { get; set; }
    public Guid? ParId { get; set; }
    public string Motif { get; set; } = "";
    /// <summary>Annulation avec avenant de réduction : le chiffre d'affaires baisse de la part vendue non réalisée.</summary>
    public bool AvenantReduction { get; set; }
    public decimal JoursHomme { get; set; }
    public Guid? DecisionId { get; set; }
}

/// <summary>
/// Règle « 1 JH maximum par personne et par jour, toutes tâches confondues ».
/// Exception : les entités ACHAT et CESSION, qui peuvent mobiliser plusieurs personnes.
/// </summary>
public static class RegleJournee
{
    /// <summary>Vérifie le total d'une personne pour un jour (consommé déjà saisi sur les autres tâches + nouvelle saisie).</summary>
    public static void Verifier(ProfilProjet profil, decimal totalDuJour)
    {
        if (totalDuJour < 0) throw new RegleMetierException("Le consommé ne peut pas être négatif.");
        if (ReferentielsMetier.PeutDepasserUneJournee(profil.Entite)) return;
        if (totalDuJour > 1)
            throw new RegleMetierException($"{profil.Nom} ne peut pas dépasser 1 jour-homme le même jour, toutes tâches confondues ({totalDuJour:0.##} JH saisis).");
    }
}
