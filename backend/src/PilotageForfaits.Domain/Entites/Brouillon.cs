namespace PilotageForfaits.Domain.Entites;

/// <summary>
/// Projet en cours de création : un TSP rédigé (ou importé, ou repris d'un projet) que son auteur relit et complète
/// avant de le lancer. Privé : seuls son auteur et le co-rédacteur qu'il invite le voient ; il n'apparaît ni dans les
/// listes de projets ni dans le portefeuille. Au lancement, il devient un projet et le brouillon est supprimé.
/// Ce n'est pas un objet de projet (aucun projet n'existe encore) : il n'hérite donc pas d'EntiteDeProjet.
/// Le numéro de version (Entite.Version) détecte deux enregistrements simultanés (deux onglets, deux rédacteurs).
/// </summary>
public sealed class BrouillonProjet : Entite
{
    /// <summary>Client et nom du projet (copie de la fiche, pour les listes).</summary>
    public string Client { get; set; } = "";
    public string Nom { get; set; } = "";
    public string? Reference { get; set; }
    public OrigineBrouillon Origine { get; set; }
    /// <summary>Fichier TSP importé, ou projet repris, d'où vient le brouillon.</summary>
    public string? Source { get; set; }
    /// <summary>Contenu du TSP en cours de rédaction (format JSON de <see cref="Tsp.TspSaisi"/>).</summary>
    public string Contenu { get; set; } = "";
    public Guid CreeParId { get; set; }
    public Utilisateur? CreePar { get; set; }
    /// <summary>Personne invitée à compléter le brouillon (elle voit les prix). Après le lancement, elle suit le projet en lecture.</summary>
    public Guid? CoRedacteurId { get; set; }
    public Utilisateur? CoRedacteur { get; set; }
    public DateTimeOffset CreeLe { get; set; }
    public DateTimeOffset ModifieLe { get; set; }
    public Guid? ModifieParId { get; set; }

    /// <summary>L'utilisateur peut-il ouvrir et modifier ce brouillon ?</summary>
    public bool EstOuvertA(Guid utilisateurId) => CreeParId == utilisateurId || CoRedacteurId == utilisateurId;
}
