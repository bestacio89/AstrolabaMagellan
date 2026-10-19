namespace PilotageForfaits.Application.Suivi;

// ============================================================================================
// Saisies envoyées par l'écran de suivi. Une saisie = une action de l'utilisateur dans le POC.
// « Version » : numéro de version de l'objet tel qu'il était affiché (contrôle des modifications simultanées).
// ============================================================================================

// ---- tâches ----
public sealed record StatutCommande(string Statut, int? Version);
public sealed record AvancementCommande(decimal Avancement, int? Version);
public sealed record ResteAFaireCommande(decimal? Raf, int? Version);
public sealed record DatesTacheCommande(DateOnly? Debut, DateOnly? Fin, int? Version);
public sealed record LibelleCommande(string? Libelle, int? Version);
public sealed record CommentaireCommande(string? Commentaire, int? Version);
/// <summary>Champ : type, axe, phase ou lot. Valeur vide : retour à la valeur du TSP (pour le type : aucun type).</summary>
public sealed record ClassementCommande(string Champ, string? Valeur, int? Version);
public sealed record BilanIaCommande(string? IaType, string? IaJustif, int? Version);
public sealed record EcheanceTacheCommande(int? Numero, int? Version);
/// <summary>Consommé d'un profil sur une tâche, un jour donné (null ou 0 : effacé).</summary>
public sealed record ConsommeCommande(Guid ProfilId, DateOnly Jour, decimal? Jh);

// ---- périmètre ----
public sealed record AnnulationCommande(string? Motif, bool Avenant, bool EnregistrerDecision, int? Version);
public sealed record NouveauProfilCommande(string? Nom, string? Entite, decimal Tjm, decimal Cjm, string? Collaborateur);
public sealed record AjoutProfilCommande(Guid? ProfilId, NouveauProfilCommande? NouveauProfil, decimal Jh, string? Motif);
public sealed record ChargeAjouteeCommande(decimal Jh);
/// <summary>
/// Réaffecte une partie de la charge d'un profil (De) à une personne déjà sur le projet (VersProfilId)
/// ou à une nouvelle personne du même rôle (Collaborateur, Tjm, Cjm). Le total de la tâche ne change pas.
/// </summary>
public sealed record ReaffectationCommande(Guid DeProfilId, Guid? VersProfilId, string? Collaborateur, decimal? Tjm, decimal? Cjm, decimal Jh, string? Motif);
public sealed record ChargeNouvelleTacheCommande(Guid ProfilId, decimal Jh);
public sealed record NouvelleTacheCommande(
    string? Label, string? Axe, string? Lot, string? Phase, string? Etape, string? Type, DateOnly? Debut, DateOnly? Fin,
    List<ChargeNouvelleTacheCommande>? Charges, NouveauProfilCommande? NouveauProfil, decimal? NouveauProfilJh,
    string? Motif, string? Hypothese,
    // Repère de la tâche après laquelle insérer la nouvelle (sinon : après la dernière tâche du même groupe).
    string? Apres);

// ---- ateliers et livrables ----
public sealed record AtelierDateCommande(DateOnly? Date);
/// <summary>Heures au format HH:mm (vide : effacée).</summary>
public sealed record AtelierHoraireCommande(string? HeureDebut, string? HeureFin);
public sealed record InvitationCommande(bool Envoyee, DateOnly? Le);
public sealed record DestinatairesCommande(List<string>? Liste);
public sealed record ValidationClientCommande(DateOnly? ValideLe);
/// <summary>Adresse du document livré (SharePoint, partage réseau…). Vide : effacée.</summary>
public sealed record LienLivrableCommande(string? Lien);
/// <summary>Message ajouté au fil de mises à jour d'une tâche.</summary>
public sealed record MiseAJourCommande(string? Texte);
/// <summary>Point hebdo : niveau d'un indicateur pour la période (S ou M) et la suivante (S+1 ou M+1).</summary>
public sealed record IndicateurPointHebdo(string? S, string? S1);
public sealed record MeteoPointHebdo(string? Meteo, string? Tendance);
/// <summary>Saisie d'une période du point hebdo (remplace la précédente).</summary>
public sealed record PointHebdoCommande(
    List<string>? Actualites, List<string>? Attention, Dictionary<string, IndicateurPointHebdo>? Indicateurs,
    MeteoPointHebdo? Satisfaction, MeteoPointHebdo? Esprit, string? Extension, bool Genere);
/// <summary>Réglage du point hebdo (commercial, AVV, pilote, mode de facturation, logos) ; vide : retiré.</summary>
public sealed record ReglagePointHebdoCommande(string? Valeur);

// ---- planning de référence ----
/// <summary>Nom de la référence (vide : « Référence initiale », puis « Référence 2 »…).</summary>
public sealed record FigerReferenceCommande(string? Libelle);
/// <summary>Cause (liste fermée) et motif libre de l'écart d'une tâche par rapport à une référence.</summary>
public sealed record DeriveCommande(string? Cause, string? Motif, int? Version);

// ---- facturation ----
/// <summary>Champ : datePrevue, realiseLe (facturée le) ou payeeLe.</summary>
public sealed record EcheanceDateCommande(string Champ, DateOnly? Valeur, int? Version);
public sealed record PerimetreEcheanceCommande(List<string>? Phases, List<string>? Taches);
public sealed record EcheancePhaseCommande(int? Numero);

// ---- registres (actions, décisions, risques) et dépenses ----
/// <summary>Modification d'un champ d'une ligne de registre (valeur en texte ; dates AAAA-MM-JJ ; nombres avec un point).</summary>
public sealed record ChampCommande(string Champ, string? Valeur, int? Version);
public sealed record RestaurerActionCommande(string Statut, decimal Progression, DateOnly? FaitLe);
public sealed record NouvelAchatCommande(
    DateOnly Date, int? Ligne, string? Designation, string? Fournisseur, decimal Qte, decimal Cu, decimal? Refacture, string? Statut, string? Commentaire);
public sealed record NouveauFraisCommande(
    DateOnly Date, string? Collaborateur, string? Categorie, string? Libelle, decimal Montant, bool Refacturable, string? Commentaire);

// ---- paramètres ----
public sealed record RegroupementCommande(string GroupBy);
/// <summary>Champ : alerteActionsJours, alerteAtelierJours, alerteLivrableJours ou alerteEchJours.</summary>
public sealed record AlerteCommande(string Champ, int Jours);
public sealed record ProfilIaCommande(Guid? ProfilId);
public sealed record ListeIaCommande(List<string>? Valeurs);
public sealed record NomAxeCommande(string? Nom);
/// <summary>Champ : client, projet ou reference.</summary>
public sealed record FicheCommande(string Champ, string? Valeur, int? Version);
public sealed record TypeCommande(string? Nom);

// ---- exports ----
public sealed record CoprojCommande(DateOnly Du, DateOnly Au, int Horizon);
