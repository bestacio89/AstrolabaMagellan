using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Application.Suivi;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Api.Controleurs;

/// <summary>
/// Écran de suivi d'un projet : lecture (saisies + indicateurs) et toutes les saisies de la version de référence (POC v65).
/// Chaque saisie renvoie le suivi recalculé et les messages à afficher.
/// </summary>
[ApiController]
[Authorize]
[Route("api/projets/{id:guid}")]
public sealed class SuiviController(
    SuiviService suivi, SaisiesTachesService taches, PerimetreService perimetre, AteliersLivrablesService ateliers,
    FacturationService facturation, RegistresService registres, DepensesService depenses, ParametresService parametres, ExportsService exports,
    ReferencesService references, MisesAJourService misesAJour, PointsHebdoService pointsHebdo)
    : ControllerBase
{
    /// <summary>Saisies, indicateurs calculés et droits de l'utilisateur sur le projet.</summary>
    [HttpGet("suivi")]
    public Task<JsonObject> Obtenir(Guid id, CancellationToken a) => suivi.ObtenirAsync(id, a);

    // ---------------------------------------------------------------- tâches

    [HttpPut("taches/{uid}/statut")]
    public Task<ResultatSaisieDto> Statut(Guid id, string uid, StatutCommande c, CancellationToken a) => taches.DefinirStatutAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/avancement")]
    public Task<ResultatSaisieDto> Avancement(Guid id, string uid, AvancementCommande c, CancellationToken a) => taches.DefinirAvancementAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/reste-a-faire")]
    public Task<ResultatSaisieDto> ResteAFaire(Guid id, string uid, ResteAFaireCommande c, CancellationToken a) => taches.DefinirResteAFaireAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/dates")]
    public Task<ResultatSaisieDto> Dates(Guid id, string uid, DatesTacheCommande c, CancellationToken a) => taches.DefinirDatesAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/libelle")]
    public Task<ResultatSaisieDto> Libelle(Guid id, string uid, LibelleCommande c, CancellationToken a) => taches.DefinirLibelleAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/commentaire")]
    public Task<ResultatSaisieDto> Commentaire(Guid id, string uid, CommentaireCommande c, CancellationToken a) => taches.DefinirCommentaireAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/classement")]
    public Task<ResultatSaisieDto> Classement(Guid id, string uid, ClassementCommande c, CancellationToken a) => taches.DefinirClassementAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/bilan-ia")]
    public Task<ResultatSaisieDto> BilanIa(Guid id, string uid, BilanIaCommande c, CancellationToken a) => taches.DefinirBilanIaAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/echeance")]
    public Task<ResultatSaisieDto> EcheanceTache(Guid id, string uid, EcheanceTacheCommande c, CancellationToken a) => taches.DefinirEcheanceAsync(id, uid, c, a);

    /// <summary>Consommé d'un profil sur une tâche, un jour donné (chef de projet ou consultant).</summary>
    [HttpPut("taches/{uid}/consomme")]
    public Task<ResultatSaisieDto> Consomme(Guid id, string uid, ConsommeCommande c, CancellationToken a) => taches.SaisirConsommeAsync(id, uid, c, a);

    // ---------------------------------------------------------------- périmètre

    [HttpPost("taches")]
    public Task<ResultatSaisieDto> NouvelleTache(Guid id, NouvelleTacheCommande c, CancellationToken a) => perimetre.CreerTacheAsync(id, c, a);

    /// <summary>Supprime une tâche ajoutée en cours de projet (une tâche du TSP s'annule).</summary>
    [HttpDelete("taches/{uid}")]
    public Task<ResultatSaisieDto> SupprimerTache(Guid id, string uid, CancellationToken a) => perimetre.SupprimerTacheAsync(id, uid, a);

    [HttpPost("taches/{uid}/annulation")]
    public Task<ResultatSaisieDto> Annuler(Guid id, string uid, AnnulationCommande c, CancellationToken a) => perimetre.AnnulerAsync(id, uid, c, a);

    [HttpDelete("taches/{uid}/annulation")]
    public Task<ResultatSaisieDto> Retablir(Guid id, string uid, CancellationToken a) => perimetre.RetablirAsync(id, uid, a);

    [HttpPost("taches/{uid}/profils")]
    public Task<ResultatSaisieDto> AjouterProfil(Guid id, string uid, AjoutProfilCommande c, CancellationToken a) => perimetre.AjouterProfilAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/profils/{profilId:guid}")]
    public Task<ResultatSaisieDto> ModifierAjout(Guid id, string uid, Guid profilId, ChargeAjouteeCommande c, CancellationToken a) =>
        perimetre.ModifierAjoutAsync(id, uid, profilId, c, a);

    [HttpDelete("taches/{uid}/profils/{profilId:guid}")]
    public Task<ResultatSaisieDto> RetirerAjout(Guid id, string uid, Guid profilId, CancellationToken a) => perimetre.RetirerAjoutAsync(id, uid, profilId, a);

    [HttpPost("taches/{uid}/reaffectations")]
    public Task<ResultatSaisieDto> Reaffecter(Guid id, string uid, ReaffectationCommande c, CancellationToken a) => perimetre.ReaffecterAsync(id, uid, c, a);

    [HttpDelete("taches/{uid}/reaffectations/{reaffectationId:guid}")]
    public Task<ResultatSaisieDto> AnnulerReaffectation(Guid id, string uid, Guid reaffectationId, CancellationToken a) =>
        perimetre.AnnulerReaffectationAsync(id, uid, reaffectationId, a);

    // ---------------------------------------------------------------- ateliers et livrables

    [HttpPut("taches/{uid}/atelier/date")]
    public Task<ResultatSaisieDto> DateAtelier(Guid id, string uid, AtelierDateCommande c, CancellationToken a) => ateliers.DefinirDateAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/atelier/horaire")]
    public Task<ResultatSaisieDto> HoraireAtelier(Guid id, string uid, AtelierHoraireCommande c, CancellationToken a) => ateliers.DefinirHoraireAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/atelier/invitation")]
    public Task<ResultatSaisieDto> Invitation(Guid id, string uid, InvitationCommande c, CancellationToken a) => ateliers.MarquerInvitationAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/atelier/invitation/date")]
    public Task<ResultatSaisieDto> DateInvitation(Guid id, string uid, AtelierDateCommande c, CancellationToken a) => ateliers.DefinirDateInvitationAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/atelier/destinataires")]
    public Task<ResultatSaisieDto> Destinataires(Guid id, string uid, DestinatairesCommande c, CancellationToken a) => ateliers.DefinirDestinatairesAsync(id, uid, c, a);

    [HttpPut("taches/{uid}/livrable")]
    public Task<ResultatSaisieDto> ValidationClient(Guid id, string uid, ValidationClientCommande c, CancellationToken a) =>
        ateliers.DefinirValidationClientAsync(id, uid, c, a);

    /// <summary>Adresse du document livré (lien SharePoint, chemin réseau).</summary>
    [HttpPut("taches/{uid}/livrable/lien")]
    public Task<ResultatSaisieDto> LienLivrable(Guid id, string uid, LienLivrableCommande c, CancellationToken a) => ateliers.DefinirLienAsync(id, uid, c, a);

    // ---------------------------------------------------------------- point hebdo (diapositive de suivi delivery)

    [HttpPut("points-hebdo/semaines/{lundi}")]
    public Task<ResultatSaisieDto> PointHebdoSemaine(Guid id, string lundi, PointHebdoCommande c, CancellationToken a) =>
        pointsHebdo.EnregistrerAsync(id, PointsHebdoService.CleSemaine(lundi), c, a);

    [HttpPut("points-hebdo/mois/{mois}")]
    public Task<ResultatSaisieDto> PointHebdoMois(Guid id, string mois, PointHebdoCommande c, CancellationToken a) =>
        pointsHebdo.EnregistrerAsync(id, PointsHebdoService.CleMois(mois), c, a);

    [HttpPut("points-hebdo/reglages/{champ}")]
    public Task<ResultatSaisieDto> PointHebdoReglage(Guid id, string champ, ReglagePointHebdoCommande c, CancellationToken a) =>
        pointsHebdo.RegleAsync(id, champ, c, a);

    /// <summary>Ajoute un message au fil de mises à jour d'une tâche (chef de projet ou consultant).</summary>
    [HttpPost("taches/{uid}/mises-a-jour")]
    public Task<ResultatSaisieDto> MiseAJour(Guid id, string uid, MiseAJourCommande c, CancellationToken a) => misesAJour.AjouterAsync(id, uid, c, a);

    // ---------------------------------------------------------------- planning de référence

    /// <summary>Fige le planning actuel comme référence.</summary>
    [HttpPost("references")]
    public Task<ResultatSaisieDto> FigerReference(Guid id, FigerReferenceCommande c, CancellationToken a) => references.FigerAsync(id, c, a);

    /// <summary>Cause et motif de l'écart d'une tâche par rapport à une référence.</summary>
    [HttpPut("references/{referenceId:guid}/taches/{uid}/derive")]
    public Task<ResultatSaisieDto> Derive(Guid id, Guid referenceId, string uid, DeriveCommande c, CancellationToken a) =>
        references.DefinirDeriveAsync(id, referenceId, uid, c, a);

    // ---------------------------------------------------------------- facturation

    [HttpPut("echeances/{numero:int}/dates")]
    public Task<ResultatSaisieDto> DateEcheance(Guid id, int numero, EcheanceDateCommande c, CancellationToken a) => facturation.DefinirDateAsync(id, numero, c, a);

    [HttpPut("echeances/{numero:int}/perimetre")]
    public Task<ResultatSaisieDto> PerimetreEcheance(Guid id, int numero, PerimetreEcheanceCommande c, CancellationToken a) =>
        facturation.LierPerimetreAsync(id, numero, c, a);

    [HttpPut("phases/{code}/echeance")]
    public Task<ResultatSaisieDto> EcheancePhase(Guid id, string code, EcheancePhaseCommande c, CancellationToken a) =>
        facturation.DefinirEcheancePhaseAsync(id, code, c, a);

    // ---------------------------------------------------------------- actions, décisions, risques

    [HttpPost("actions")]
    public Task<ResultatSaisieDto> CreerAction(Guid id, CancellationToken a) => registres.CreerActionAsync(id, a);

    [HttpPut("actions/{actionId:guid}")]
    public Task<ResultatSaisieDto> ModifierAction(Guid id, Guid actionId, ChampCommande c, CancellationToken a) => registres.ModifierActionAsync(id, actionId, c, a);

    [HttpPut("actions/{actionId:guid}/restaurer")]
    public Task<ResultatSaisieDto> RestaurerAction(Guid id, Guid actionId, RestaurerActionCommande c, CancellationToken a) =>
        registres.RestaurerActionAsync(id, actionId, c, a);

    [HttpDelete("actions/{actionId:guid}")]
    public Task<ResultatSaisieDto> SupprimerAction(Guid id, Guid actionId, CancellationToken a) => registres.SupprimerActionAsync(id, actionId, a);

    [HttpPost("decisions")]
    public Task<ResultatSaisieDto> CreerDecision(Guid id, CancellationToken a) => registres.CreerDecisionAsync(id, a);

    [HttpPut("decisions/{decisionId:guid}")]
    public Task<ResultatSaisieDto> ModifierDecision(Guid id, Guid decisionId, ChampCommande c, CancellationToken a) =>
        registres.ModifierDecisionAsync(id, decisionId, c, a);

    [HttpDelete("decisions/{decisionId:guid}")]
    public Task<ResultatSaisieDto> SupprimerDecision(Guid id, Guid decisionId, CancellationToken a) => registres.SupprimerDecisionAsync(id, decisionId, a);

    [HttpPost("risques")]
    public Task<ResultatSaisieDto> CreerRisque(Guid id, CancellationToken a) => registres.CreerRisqueAsync(id, a);

    [HttpPut("risques/{risqueId:guid}")]
    public Task<ResultatSaisieDto> ModifierRisque(Guid id, Guid risqueId, ChampCommande c, CancellationToken a) => registres.ModifierRisqueAsync(id, risqueId, c, a);

    [HttpDelete("risques/{risqueId:guid}")]
    public Task<ResultatSaisieDto> SupprimerRisque(Guid id, Guid risqueId, CancellationToken a) => registres.SupprimerRisqueAsync(id, risqueId, a);

    // ---------------------------------------------------------------- achats et frais

    [HttpPost("achats")]
    public Task<ResultatSaisieDto> CreerAchat(Guid id, NouvelAchatCommande c, CancellationToken a) => depenses.CreerAchatAsync(id, c, a);

    [HttpPut("achats/{achatId:guid}")]
    public Task<ResultatSaisieDto> ModifierAchat(Guid id, Guid achatId, ChampCommande c, CancellationToken a) => depenses.ModifierAchatAsync(id, achatId, c, a);

    [HttpDelete("achats/{achatId:guid}")]
    public Task<ResultatSaisieDto> SupprimerAchat(Guid id, Guid achatId, CancellationToken a) => depenses.SupprimerAchatAsync(id, achatId, a);

    [HttpPost("frais")]
    public Task<ResultatSaisieDto> CreerFrais(Guid id, NouveauFraisCommande c, CancellationToken a) => depenses.CreerFraisAsync(id, c, a);

    [HttpPut("frais/{fraisId:guid}")]
    public Task<ResultatSaisieDto> ModifierFrais(Guid id, Guid fraisId, ChampCommande c, CancellationToken a) => depenses.ModifierFraisAsync(id, fraisId, c, a);

    [HttpDelete("frais/{fraisId:guid}")]
    public Task<ResultatSaisieDto> SupprimerFrais(Guid id, Guid fraisId, CancellationToken a) => depenses.SupprimerFraisAsync(id, fraisId, a);

    // ---------------------------------------------------------------- paramètres

    [HttpPut("parametres/regroupement")]
    public Task<ResultatSaisieDto> Regroupement(Guid id, RegroupementCommande c, CancellationToken a) => parametres.DefinirRegroupementAsync(id, c, a);

    [HttpPut("parametres/alertes")]
    public Task<ResultatSaisieDto> Alerte(Guid id, AlerteCommande c, CancellationToken a) => parametres.DefinirAlerteAsync(id, c, a);

    [HttpPut("parametres/profil-ia")]
    public Task<ResultatSaisieDto> ProfilIa(Guid id, ProfilIaCommande c, CancellationToken a) => parametres.DefinirProfilIaAsync(id, c, a);

    [HttpPut("parametres/leviers-ia")]
    public Task<ResultatSaisieDto> LeviersIa(Guid id, ListeIaCommande c, CancellationToken a) => parametres.DefinirListeIaAsync(id, ListeIa.Levier, c, a);

    [HttpPut("parametres/causes-ia")]
    public Task<ResultatSaisieDto> CausesIa(Guid id, ListeIaCommande c, CancellationToken a) => parametres.DefinirListeIaAsync(id, ListeIa.Cause, c, a);

    [HttpPut("parametres/dates")]
    public Task<ResultatSaisieDto> DatesProjet(Guid id, ChampCommande c, CancellationToken a) => parametres.DefinirDateAsync(id, c, a);

    [HttpPut("axes/{code}/nom")]
    public Task<ResultatSaisieDto> NomAxe(Guid id, string code, NomAxeCommande c, CancellationToken a) => parametres.NommerAxeAsync(id, code, c, a);

    [HttpPut("fiche")]
    public Task<ResultatSaisieDto> Fiche(Guid id, FicheCommande c, CancellationToken a) => parametres.DefinirFicheAsync(id, c, a);

    [HttpPost("types")]
    public Task<ResultatSaisieDto> AjouterType(Guid id, TypeCommande c, CancellationToken a) => parametres.AjouterTypeAsync(id, c, a);

    [HttpPut("types/{code}")]
    public Task<ResultatSaisieDto> RenommerType(Guid id, string code, TypeCommande c, CancellationToken a) => parametres.RenommerTypeAsync(id, code, c, a);

    [HttpDelete("types/{code}")]
    public Task<ResultatSaisieDto> SupprimerType(Guid id, string code, CancellationToken a) => parametres.SupprimerTypeAsync(id, code, a);

    // ---------------------------------------------------------------- exports

    /// <summary>Export COPIL (Excel) ; une photo des indicateurs est ajoutée à l'historique.</summary>
    [HttpPost("exports/copil")]
    public async Task<IActionResult> Copil(Guid id, CancellationToken a)
    {
        var f = await exports.CopilAsync(id, a);
        return File(f.Contenu, FichierExport.TypeXlsx, f.Nom);
    }

    /// <summary>Export COPROJ (Excel) sur une période ; la date du dernier COPROJ est retenue.</summary>
    [HttpPost("exports/coproj")]
    public async Task<IActionResult> Coproj(Guid id, CoprojCommande c, CancellationToken a)
    {
        var f = await exports.CoprojAsync(id, c, a);
        return File(f.Contenu, FichierExport.TypeXlsx, f.Nom);
    }
}
