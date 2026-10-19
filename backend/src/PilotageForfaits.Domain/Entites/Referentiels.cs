namespace PilotageForfaits.Domain.Entites;

/// <summary>Code de la colonne A du TSP (0, AXE1…) et le nom choisi.</summary>
public sealed class Axe : EntiteDeProjet
{
    public string Code { get; set; } = "";
    public string Nom { get; set; } = "";
    public int Ordre { get; set; }
}

/// <summary>Phase du projet (onglet REF : PILOTAGE, CONSTRUCTION…).</summary>
public sealed class Phase : EntiteDeProjet
{
    public string Code { get; set; } = "";
    public int Ordre { get; set; }
    /// <summary>Vrai pour les phases de la liste de l'onglet REF ; faux pour une phase trouvée seulement sur des tâches.</summary>
    public bool ListeReference { get; set; } = true;
}

/// <summary>Étape (onglet REF).</summary>
public sealed class Etape : EntiteDeProjet
{
    public string Libelle { get; set; } = "";
    public int Ordre { get; set; }
}

/// <summary>Type de tâche : Atelier et Livrable (socle, non supprimables) et types ajoutés.</summary>
public sealed class TypeTache : EntiteDeProjet
{
    public string Code { get; set; } = "";
    public string Nom { get; set; } = "";
    public bool Socle { get; set; }
    public int Ordre { get; set; }
}

/// <summary>Leviers d'optimisation IA et causes de dépassement proposés dans les listes.</summary>
public sealed class ValeurListeIa : EntiteDeProjet
{
    public ListeIa Liste { get; set; }
    public string Libelle { get; set; } = "";
    public int Ordre { get; set; }
}
