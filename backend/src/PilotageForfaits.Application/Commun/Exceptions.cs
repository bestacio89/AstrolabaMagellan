namespace PilotageForfaits.Application.Commun;

/// <summary>L'objet demandé n'existe pas, ou l'utilisateur n'a pas le droit d'en connaître l'existence (réponse 404).</summary>
public sealed class IntrouvableException(string message) : Exception(message);

/// <summary>L'utilisateur est connu mais n'a pas le droit de faire cette action (réponse 403).</summary>
public sealed class AccesRefuseException(string message) : Exception(message);

/// <summary>
/// L'objet a été modifié par quelqu'un d'autre depuis qu'il a été affiché (son numéro de version a changé) : réponse 409.
/// L'écran recharge alors le projet pour montrer la version à jour.
/// </summary>
public sealed class ConflitException(string message) : Exception(message);
