namespace PilotageForfaits.Domain.Tsp;

/// <summary>
/// Un classeur Excel vu de façon très simple : des feuilles, et dans chaque feuille des cellules repérées par
/// (ligne, colonne) en partant de 0. La lecture réelle du fichier (.xlsx / .xlsm) est faite par l'Infrastructure.
/// </summary>
public interface IClasseur
{
    /// <summary>Noms des feuilles, dans l'ordre du classeur.</summary>
    IReadOnlyList<string> NomsFeuilles { get; }

    /// <summary>Feuille dont le nom correspond (sans tenir compte des accents ni de la casse), ou null.</summary>
    IFeuille? Feuille(string nom);
}

public interface IFeuille
{
    /// <summary>Nom réel de la feuille dans le classeur.</summary>
    string Nom { get; }
    int MaxRow { get; }
    int MaxCol { get; }

    /// <summary>
    /// Valeur d'une cellule : null (vide), double (nombre ou date Excel), string, bool, ou <see cref="ErreurExcel"/>.
    /// Ce sont les valeurs mémorisées par Excel : les formules ne sont jamais recalculées.
    /// Une position hors de la feuille (ex. ligne -1) renvoie null.
    /// </summary>
    object? G(int ligne, int colonne);
}

/// <summary>Cellule en erreur dans Excel (#REF!, #N/A…). Elle compte comme vide ou 0.</summary>
public sealed record ErreurExcel(string Code);
