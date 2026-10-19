using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Domain.Tsp;

/// <summary>
/// TSP en cours de rédaction dans l'application (contenu d'un brouillon de projet).
/// Il ne contient que ce qui se SAISIT dans un TSP : tout le reste (montant du contrat, synthèse, ventilation, métrique)
/// est recalculé par le moteur, comme pour un TSP importé.
/// Il est transformé en classeur au format du TSP (voir ClasseurTsp dans l'Application) : le même classeur sert à l'export Excel
/// et au lancement du projet, qui passe ensuite par la lecture d'un TSP importé. Un TSP rédigé et un TSP importé donnent donc
/// exactement le même projet.
/// Identifiants (profils, tâches, lignes) : textes courts choisis par l'interface, stables pendant la rédaction.
/// </summary>
public sealed class TspSaisi
{
    /// <summary>Version du format (pour pouvoir le faire évoluer sans perdre les brouillons enregistrés).</summary>
    public int Format { get; set; } = 1;
    public FicheSaisie Fiche { get; set; } = new();
    /// <summary>Remise commerciale (0,05 = 5 %).</summary>
    public decimal Remise { get; set; }
    public List<ProfilSaisi> Profils { get; set; } = new();
    /// <summary>Lignes du WORKLOAD, dans l'ordre. Une ligne sans charge devient un titre de section (règle du TSP).</summary>
    public List<TacheSaisie> Taches { get; set; } = new();
    /// <summary>Planning mensuel par profil : identifiant du profil → mois (AAAA-MM) → jours-homme.</summary>
    public Dictionary<string, Dictionary<string, decimal>> Planning { get; set; } = new();
    public List<EcheanceSaisie> Echeances { get; set; } = new();
    public List<AchatSaisi> Achats { get; set; } = new();
    public List<PrestataireSaisi> Prestataires { get; set; } = new();
    public List<FraisSaisi> Frais { get; set; } = new();
    /// <summary>Repères de l'onglet METRIQUE (% théorique de chaque étape).</summary>
    public List<MetriqueSaisie> Metrique { get; set; } = new();
    /// <summary>Listes de l'onglet REF proposées pendant la saisie.</summary>
    public List<string> Phases { get; set; } = new();
    public List<string> Etapes { get; set; } = new();
}

public sealed class FicheSaisie
{
    public string Client { get; set; } = "";
    public string Projet { get; set; } = "";
    /// <summary>Référence de la proposition (« OP12345 - CLIENT - Projet - TSP - V1 ») : son numéro d'opportunité rend le projet unique.</summary>
    public string Reference { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Agence { get; set; } = "";
    public string ServiceLine { get; set; } = "";
    public string Directeur { get; set; } = "";
    public string ResponsableSL { get; set; } = "";
    public string Commercial { get; set; } = "";
    public string TypeContrat { get; set; } = "Forfait";
    public DateOnly? Debut { get; set; }
    public DateOnly? Fin { get; set; }
}

public sealed class ProfilSaisi
{
    public string Id { get; set; } = "";
    public string Nom { get; set; } = "";
    /// <summary>FO, CESSION, ACHAT, BO ou ACHAT BO.</summary>
    public string Entite { get; set; } = "FO";
    public decimal Tjm { get; set; }
    public decimal Cjm { get; set; }
    /// <summary>Coût de revient journalier d'un profil BO (450 € si vide).</summary>
    public decimal? Prcs { get; set; }
    /// <summary>Frais de déplacement d'un profil en cession.</summary>
    public decimal Frais { get; set; }
    /// <summary>Personne prévue sur ce profil (facultatif) : relie le profil à « Mon travail ».</summary>
    public string Collaborateur { get; set; } = "";
}

public sealed class TacheSaisie
{
    public string Id { get; set; } = "";
    /// <summary>Code d'axe (colonne ID du TSP).</summary>
    public string Axe { get; set; } = "";
    public string Lot { get; set; } = "";
    public string Phase { get; set; } = "";
    public string Etape { get; set; } = "";
    public string Libelle { get; set; } = "";
    /// <summary>Charge vendue par profil : identifiant du profil → jours-homme.</summary>
    public Dictionary<string, decimal> Charges { get; set; } = new();
    public bool Livrable { get; set; }
    public string Hypothese { get; set; } = "";
    /// <summary>
    /// Séparateur : titre qui organise le workload (ex. « Socle sécurité »), sans aucune valeur. Dans le TSP, c'est une ligne
    /// avec un libellé et sans charge (titre de section).
    /// </summary>
    public bool Separateur { get; set; }
}

public sealed class EcheanceSaisie
{
    public string Id { get; set; } = "";
    public string Nom { get; set; } = "";
    /// <summary>Part du contrat (0,3 = 30 %).</summary>
    public decimal Pct { get; set; }
    /// <summary>Mois de facturation prévu (AAAA-MM).</summary>
    public string? Mois { get; set; }
}

public sealed class AchatSaisi
{
    public string Id { get; set; } = "";
    public string Designation { get; set; } = "";
    public string Type { get; set; } = "";
    public decimal Cu { get; set; }
    public decimal Qte { get; set; }
    public decimal Revente { get; set; }
    public string Commentaire { get; set; } = "";
}

public sealed class PrestataireSaisi
{
    public string Id { get; set; } = "";
    public string Designation { get; set; } = "";
    public string Societe { get; set; } = "";
    public decimal CoutJour { get; set; }
    public decimal Nbj { get; set; }
    public decimal Tjm { get; set; }
    public string Commentaire { get; set; } = "";
}

public sealed class FraisSaisi
{
    public string Id { get; set; } = "";
    public string Libelle { get; set; } = "";
    public decimal Cu { get; set; }
    public decimal Qte { get; set; }
    public decimal Refacture { get; set; }
    public string Commentaire { get; set; } = "";
}

public sealed class MetriqueSaisie
{
    public string Etape { get; set; } = "";
    public decimal Pct { get; set; }
}

/// <summary>Contenu d'un TSP vierge : les listes et repères du modèle de TSP de l'agence.</summary>
public static class ModeleTsp
{
    /// <summary>Étapes de l'onglet REF du modèle.</summary>
    public static readonly IReadOnlyList<string> Etapes =
    [
        "Pilotage projet", "Analyse de l'existant", "Conception générale", "Conception technique détaillée", "Conception fonctionnelle détaillée",
        "Ergonomie/Graphisme", "Cahier de recette", "Développement et tests unitaires", "Tests d'intégration / Recette interne",
        "Livraison / installation / Mise en œuvre", "Pilote", "Généralisation", "Support", "Reprise de contenu", "Assistance recette",
        "Formation", "Garantie (suite recette - 3 mois)", "Provision pour risque", "Hors abaques",
    ];

    /// <summary>Repères de l'onglet METRIQUE du modèle (en part de la charge de développement).</summary>
    public static readonly IReadOnlyList<(string Etape, decimal Pct)> Metrique =
    [
        ("Pilotage projet", 0.2m), ("Conception générale", 0.05m), ("Conception fonctionnelle détaillée", 0.25m),
        ("Conception technique détaillée", 0.2m), ("Cahier de recette", 0.15m), ("Développement et tests unitaires", 1m),
        ("Tests d'intégration / Recette interne", 0.2m), ("Livraison / installation / Mise en œuvre", 0.1m), ("Assistance recette", 0.1m),
        ("Garantie (suite recette - 3 mois)", 0.06m),
    ];

    /// <summary>Profils de l'onglet REF du modèle (suggestions).</summary>
    public static readonly IReadOnlyList<string> Profils =
    [
        "Consultant Junior", "Consultant Change", "Consultant Technique", "Consultant Data", "Expert senior", "Architecte", "Architecte Senior",
        "Chef de Projet", "Chef de Projet Senior", "Directeur de projet", "Consultant Fonctionnel", "Consultant Fonctionnel Senior",
        "Expert fonctionnel", "Référent", "Manager", "Dev Confirmé", "Dev Junior", "Testeur",
    ];

    /// <summary>Types d'achat de l'onglet REF du modèle (suggestions).</summary>
    public static readonly IReadOnlyList<string> TypesAchat =
        ["CSP Microsoft", "JetBrains", "Logiciel", "ManageEngine", "Matériel", "Skillisy", "Rescue", "Run2C", "Support - MCO"];

    /// <summary>Un TSP vierge, avec la fiche déjà renseignée.</summary>
    public static TspSaisi Vierge(string client, string projet, string? reference) => new()
    {
        Fiche = new FicheSaisie { Client = client.Trim(), Projet = projet.Trim(), Reference = (reference ?? "").Trim() },
        Phases = ReferentielsMetier.PhasesParDefaut.ToList(),
        Etapes = Etapes.ToList(),
        Metrique = Metrique.Select(m => new MetriqueSaisie { Etape = m.Etape, Pct = m.Pct }).ToList(),
    };
}
