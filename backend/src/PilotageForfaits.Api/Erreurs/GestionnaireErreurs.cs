using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Api.Erreurs;

/// <summary>
/// Transforme les erreurs en réponses HTTP claires, au format standard « ProblemDetails » :
/// règle métier → 422, introuvable → 404, accès refusé → 403, modification simultanée ou écriture refusée par la base → 409, requête mal formée → 400/413, sinon 500 (sans détail technique).
/// </summary>
public sealed class GestionnaireErreurs(IProblemDetailsService problemes, ILogger<GestionnaireErreurs> journal, IHostEnvironment environnement) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext contexte, Exception exception, CancellationToken annulation)
    {
        var (statut, titre, detail) = exception switch
        {
            RegleMetierException e => (StatusCodes.Status422UnprocessableEntity, "Action impossible", e.Message),
            IntrouvableException e => (StatusCodes.Status404NotFound, "Introuvable", e.Message),
            AccesRefuseException e => (StatusCodes.Status403Forbidden, "Accès refusé", e.Message),
            ConflitException e => (StatusCodes.Status409Conflict, "Modification simultanée", e.Message),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "Modification simultanée",
                "Quelqu'un a modifié ces données pendant que vous les modifiiez. Rechargez la page pour voir sa version, puis refaites votre modification."),
            DbUpdateException { InnerException: Microsoft.Data.SqlClient.SqlException { Number: 207 or 208 } } when environnement.IsDevelopment() =>
                (StatusCodes.Status500InternalServerError, "Base de développement à mettre à jour",
                    "La base de données date d'une version précédente de l'application (table ou colonne manquante). Supprimez la base PilotageForfaits puis relancez l'API : elle sera recréée (voir le README)."),
            // autre échec d'écriture (le plus souvent : deux créations simultanées du même élément, refusées par un index unique)
            DbUpdateException => (StatusCodes.Status409Conflict, "Modification simultanée",
                "L'enregistrement n'a pas pu être fait car les données ont changé entre-temps. Rechargez la page, puis refaites votre modification."),
            BadHttpRequestException e => (e.StatusCode, "Requête invalide", e.Message),
            // développement : base créée par une version précédente (colonne 207 ou table 208 inconnue)
            Microsoft.Data.SqlClient.SqlException { Number: 207 or 208 } when environnement.IsDevelopment() => (StatusCodes.Status500InternalServerError,
                "Base de développement à mettre à jour",
                "La base de données date d'une version précédente de l'application (table ou colonne manquante). Supprimez la base PilotageForfaits puis relancez l'API : elle sera recréée (voir le README)."),
            _ => (StatusCodes.Status500InternalServerError, "Erreur inattendue", "Une erreur inattendue s'est produite. Elle a été enregistrée dans le journal du serveur."),
        };
        // requête abandonnée par le navigateur (page quittée) : rien à répondre, ce n'est pas une erreur du serveur
        if (exception is OperationCanceledException && contexte.RequestAborted.IsCancellationRequested) return true;
        if (statut == StatusCodes.Status500InternalServerError) journal.LogError(exception, "Erreur non gérée");
        else if (exception is DbUpdateException and not DbUpdateConcurrencyException) journal.LogWarning(exception, "Écriture refusée par la base");
        contexte.Response.StatusCode = statut;
        return await problemes.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = contexte,
            Exception = exception,
            ProblemDetails = new ProblemDetails { Status = statut, Title = titre, Detail = detail },
        });
    }
}
