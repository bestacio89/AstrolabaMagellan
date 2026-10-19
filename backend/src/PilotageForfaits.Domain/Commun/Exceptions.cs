namespace PilotageForfaits.Domain.Commun;

/// <summary>
/// Une règle métier n'est pas respectée (ex. « Pas de saisie possible sur une tâche annulée »).
/// Le message est destiné à l'utilisateur : il doit être clair et en français.
/// L'API la transforme en réponse 422 (« requête comprise mais refusée »).
/// </summary>
public class RegleMetierException(string message) : Exception(message);

/// <summary>Le fichier fourni n'est pas un TSP exploitable.</summary>
public sealed class TspInvalideException(string message) : RegleMetierException(message);
