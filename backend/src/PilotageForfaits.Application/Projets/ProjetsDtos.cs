namespace PilotageForfaits.Application.Projets;

// Objets échangés avec l'interface (DTO). Les montants valent null quand le rôle de l'utilisateur ne permet pas de les voir :
// ils ne sont jamais envoyés au navigateur, même masqués.

/// <summary>Une ligne de la page « Mes projets ».</summary>
public sealed record ProjetResumeDto(
    Guid Id,
    string Nom,
    string Client,
    string? Reference,
    string Statut,
    string StatutCode,
    string MonRole,
    string MonRoleCode,
    bool VoitMontants,
    bool EstVide,
    decimal Avancement,
    decimal Prevu,
    decimal Consomme,
    decimal Atterrissage,
    decimal Ecart,
    // Taux de marge NETTE à terminaison et vendu (production + achats + frais ; null : non visible pour ce rôle, ou projet sans vendu).
    decimal? TauxMargeAtterrissage,
    decimal? TauxMargeVendue,
    DateOnly? Debut,
    DateOnly? FinPrevue,
    DateOnly? FinContractuelle,
    int? JoursOuvresRestants,
    string? ChefDeProjet,
    DateTimeOffset CreeLe,
    int NombreATraiter,
    IReadOnlyList<PointATraiterDto> ATraiter);

/// <summary>Un point « à traiter » (point de vigilance qui demande une action).</summary>
public sealed record PointATraiterDto(string Cle, string Libelle, string Niveau, string? Detail, string Valeur, string? Unite);

/// <summary>Archiver (true) ou restaurer (false) un projet.</summary>
public sealed record ArchivageCommande(bool? Archive);

/// <summary>Suppression définitive : le nom du projet, retapé par l'utilisateur, confirme qu'il sait ce qu'il supprime.</summary>
public sealed record SuppressionCommande(string? Confirmation);

/// <summary>Demande de création d'un projet vide (V1 : la fiche seule).</summary>
public sealed record CreerProjetVideCommande(
    string Client,
    string Nom,
    string? Reference,
    DateOnly Debut,
    DateOnly FinContractuelle,
    string? TypeContrat);

/// <summary>Le projet, tel qu'affiché dans sa vue d'ensemble.</summary>
public sealed record ProjetDetailDto(
    Guid Id,
    string Nom,
    string Client,
    string? Reference,
    string Statut,
    string StatutCode,
    string Origine,
    string MonRole,
    string MonRoleCode,
    bool VoitMontants,
    bool PeutModifier,
    bool EstVide,
    DateOnly? Debut,
    DateOnly? FinContractuelle,
    DateOnly? FinPrevue,
    IReadOnlyList<ChampFicheDto> Fiche,
    IndicateursDto Indicateurs,
    CalendrierDto Calendrier,
    IReadOnlyList<PointATraiterDto> Vigilance,
    IReadOnlyList<GroupeDto> Groupes,
    string LibelleGroupe,
    IReadOnlyList<EcheanceDto> Echeances,
    ImportDto? DernierImport);

public sealed record ChampFicheDto(string Libelle, string Valeur);

public sealed record IndicateursDto(
    int NombreTaches,
    int TachesValidees,
    decimal Avancement,
    decimal Prevu,
    decimal PrevuTsp,
    decimal Consomme,
    decimal ResteAFaire,
    decimal Atterrissage,
    decimal Ecart,
    decimal? ChiffreAffaires,
    decimal? CoutFinal,
    decimal? Marge,
    decimal? TauxMarge,
    decimal? MargeNette,
    decimal? TauxMargeNette);

public sealed record CalendrierDto(
    int? JoursOuvresTotal,
    int? JoursOuvresEcoules,
    decimal? TempsEcoule,
    decimal? ChargeConsommee,
    int? GlissementJours);

public sealed record GroupeDto(
    string Code,
    string Nom,
    int NombreTaches,
    decimal Prevu,
    decimal Consomme,
    decimal ResteAFaire,
    decimal Atterrissage,
    decimal Ecart,
    decimal Avancement,
    string Statut);

public sealed record EcheanceDto(
    int Numero,
    string Nom,
    decimal Pourcentage,
    decimal? Montant,
    DateOnly? DatePrevue,
    DateOnly? FactureeLe,
    string Statut,
    // Une échéance facturée a un montant figé : elle reste visible mais n'est plus sélectionnable.
    bool Selectionnable);

public sealed record ImportDto(string NomFichier, DateTimeOffset ImporteLe, IReadOnlyList<string> PointsReleves);
