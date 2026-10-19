using PilotageForfaits.Application.Projets;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Brouillons;

// Objets échangés avec l'interface pour les brouillons de projet. Un brouillon n'est ouvert qu'à son auteur et au co-rédacteur
// qu'il invite, qui ont tous deux besoin des prix pour rédiger le TSP : les montants sont donc toujours envoyés.

/// <summary>Un brouillon dans la liste « Mes brouillons ».</summary>
public sealed record BrouillonResumeDto(
    Guid Id,
    string Client,
    string Nom,
    string? Reference,
    string Origine,
    string OrigineCode,
    DateTimeOffset ModifieLe,
    string? ModifiePar,
    string Createur,
    string? CoRedacteur,
    bool EstCreateur);

/// <summary>Un brouillon ouvert : le TSP en cours de rédaction et son analyse.</summary>
public sealed record BrouillonDto(
    Guid Id,
    // version lue : à renvoyer à l'enregistrement (détection de deux enregistrements simultanés)
    int Version,
    TspSaisi Contenu,
    string Origine,
    string OrigineCode,
    string? Source,
    PersonneDto Createur,
    PersonneDto? CoRedacteur,
    bool EstCreateur,
    DateTimeOffset ModifieLe,
    string? ModifiePar,
    AnalyseBrouillonDto Analyse,
    SuggestionsDto Suggestions);

public sealed record PersonneDto(Guid Id, string NomComplet, string Email);

/// <summary>Valeurs proposées pendant la saisie (on peut toujours en saisir d'autres).</summary>
public sealed record SuggestionsDto(IReadOnlyList<string> Entites, IReadOnlyList<string> Profils, IReadOnlyList<string> TypesAchat, IReadOnlyList<string> TypesContrat);

/// <summary>Réponse à un enregistrement : la nouvelle version et l'analyse mise à jour.</summary>
public sealed record BrouillonEnregistreDto(int Version, DateTimeOffset ModifieLe, AnalyseBrouillonDto Analyse);

/// <summary>Demande de création d'un brouillon (vierge, ou repris d'un projet existant).</summary>
public sealed record CreationBrouillonCommande(string? Client, string? Projet, string? Reference, Guid? ProjetSource);

/// <summary>Enregistrement du contenu : la version lue (refus si quelqu'un a enregistré entre-temps) et le TSP complet.</summary>
public sealed record EnregistrementBrouillonCommande(int Version, TspSaisi? Contenu);

/// <summary>Invitation d'un co-rédacteur par son adresse e-mail (vide : retirer le co-rédacteur).</summary>
public sealed record CoRedacteurCommande(string? Email);

/// <summary>Lancement : la version lue (on lance exactement ce que l'utilisateur a vu).</summary>
public sealed record LancementCommande(int Version);

/// <summary>Ce que l'analyse dit du TSP en cours de rédaction : chiffres clés, contrôles et état de chaque rubrique.</summary>
public sealed record AnalyseBrouillonDto(
    // null tant que le TSP n'a ni profil ni tâche chiffrée
    SyntheseBrouillonDto? Synthese,
    IReadOnlyList<RepartitionDto> ParPhase,
    IReadOnlyList<MetriqueBrouillonDto> Metrique,
    IReadOnlyList<ProfilBrouillonDto> Profils,
    IReadOnlyList<ControleDto> Controles,
    RubriquesDto Rubriques,
    int Bloquants,
    ProjetExistantDto? ProjetExistant,
    // l'onglet SYNTHESE complet (même calcul et même écran que la Synthèse d'un projet lancé) ; null tant qu'il n'y a pas de chiffres
    SyntheseVente? Vente = null);

public sealed record SyntheseBrouillonDto(
    decimal MontantProjet,
    decimal Jours,
    decimal Ca,
    decimal Cout,
    decimal? TjmMoyen,
    decimal? CjmProduction,
    decimal? TauxMarge,
    decimal? TauxMargeAgence,
    decimal ProvisionJh,
    decimal? ProvisionPct,
    decimal Achats,
    decimal Frais,
    decimal MargeNette,
    decimal? TauxMargeNette);

/// <summary>Charge d'une phase et sa part de la charge totale.</summary>
public sealed record RepartitionDto(string Cle, decimal Jours, decimal Part);

/// <summary>Une ligne de la métrique : part théorique d'une étape (en part de la charge de développement) et part réelle du TSP.</summary>
public sealed record MetriqueBrouillonDto(string Etape, decimal Pct, decimal Theorique, decimal Propale, decimal? PctProjet, decimal? Ecart);

/// <summary>Charge, chiffre d'affaires, coût et marge d'un profil (même ordre que les profils du TSP).</summary>
public sealed record ProfilBrouillonDto(int Index, decimal Charge, decimal Ca, decimal Cout, decimal? Marge);

/// <summary>Un contrôle : « bloquant » (empêche le lancement), « conseil » (à vérifier) ou « ok ».</summary>
public sealed record ControleDto(string Cle, string Niveau, string Titre, string? Detail, string Rubrique);

/// <summary>État de chaque rubrique : « ok », « conseil », « bloquant » ou « vide ».</summary>
public sealed record RubriquesDto(string Fiche, string Profils, string Workload, string Planning, string Echeancier, string Depenses);

/// <summary>Co-rédacteur après invitation ou retrait, et nouvelle version du brouillon (à reprendre par l'écran).</summary>
public sealed record CoRedacteurReponse(PersonneDto? CoRedacteur, int Version);
