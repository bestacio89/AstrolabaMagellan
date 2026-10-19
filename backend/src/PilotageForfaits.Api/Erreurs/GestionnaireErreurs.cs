using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;

namespace PilotageForfaits.Api.Erreurs;

public sealed class GestionnaireErreurs(
    IProblemDetailsService problemes,
    ILogger<GestionnaireErreurs> journal,
    IHostEnvironment environnement) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext contexte,
        Exception exception,
        CancellationToken annulation)
    {
        // A disconnected client cannot receive an error response.
        if (exception is OperationCanceledException &&
            contexte.RequestAborted.IsCancellationRequested)
        {
            return true;
        }

        var (statut, titre, detail) = exception switch
        {
            RegleMetierException e =>
                (StatusCodes.Status422UnprocessableEntity,
                    "Action impossible", e.Message),

            IntrouvableException e =>
                (StatusCodes.Status404NotFound,
                    "Introuvable", e.Message),

            AccesRefuseException e =>
                (StatusCodes.Status403Forbidden,
                    "Accès refusé", e.Message),

            ConflitException e =>
                (StatusCodes.Status409Conflict,
                    "Modification en conflit", e.Message),

            DbUpdateConcurrencyException =>
                (StatusCodes.Status409Conflict,
                    "Modification simultanée",
                    "Ces données ont été modifiées depuis leur chargement. Rechargez-les avant de réessayer."),

            // Development only: the database schema does not match the EF model.
            DbUpdateException
            {
                InnerException: PostgresException
                {
                    SqlState: PostgresErrorCodes.UndefinedTable
                        or PostgresErrorCodes.UndefinedColumn
                }
            } when environnement.IsDevelopment() =>
                (StatusCodes.Status500InternalServerError,
                    "Schéma de base de données incompatible",
                    "Le schéma PostgreSQL ne correspond pas au modèle actuel. Vérifiez les migrations EF Core et appliquez les migrations manquantes. Ne supprimez pas la base pour résoudre ce problème."),

            // PostgreSQL unique constraint violation.
            DbUpdateException
            {
                InnerException: PostgresException
                {
                    SqlState: PostgresErrorCodes.UniqueViolation
                }
            } =>
                (StatusCodes.Status409Conflict,
                    "Conflit de données",
                    "Un enregistrement avec les mêmes valeurs uniques existe déjà."),

            // PostgreSQL foreign key or other integrity constraint violation.
            DbUpdateException
            {
                InnerException: PostgresException
                {
                    SqlState: PostgresErrorCodes.ForeignKeyViolation
                        or PostgresErrorCodes.CheckViolation
                        or PostgresErrorCodes.NotNullViolation
                }
            } =>
                (StatusCodes.Status409Conflict,
                    "Contrainte de données",
                    "L'opération ne respecte pas une contrainte de la base de données."),

            BadHttpRequestException e =>
                (e.StatusCode, "Requête invalide", e.Message),

            PostgresException
            {
                SqlState: PostgresErrorCodes.UndefinedTable
                    or PostgresErrorCodes.UndefinedColumn
            } when environnement.IsDevelopment() =>
                (StatusCodes.Status500InternalServerError,
                    "Schéma de base de données incompatible",
                    "Le schéma PostgreSQL ne correspond pas au modèle actuel. Vérifiez les migrations EF Core et appliquez les migrations manquantes."),

            _ =>
                (StatusCodes.Status500InternalServerError,
                    "Erreur inattendue",
                    "Une erreur inattendue s'est produite. Elle a été enregistrée dans le journal du serveur.")
        };

        if (statut >= StatusCodes.Status500InternalServerError)
        {
            journal.LogError(exception, "Erreur non gérée");
        }
        else if (exception is DbUpdateException)
        {
            journal.LogWarning(exception, "Échec de mise à jour des données");
        }

        contexte.Response.StatusCode = statut;

        return await problemes.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = contexte,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = statut,
                Title = titre,
                Detail = detail
            }
        });
    }
}
