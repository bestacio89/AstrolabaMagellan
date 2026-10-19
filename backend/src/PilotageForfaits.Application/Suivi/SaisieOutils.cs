using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Outils communs à toutes les saisies : contrôle des droits et des versions, enregistrement, journal,
/// puis renvoi du suivi recalculé. Une saisie = une transaction (un seul enregistrement).
/// </summary>
public sealed class SaisieOutils(
    IContexteDonnees db, ServiceAcces acces, SuiviService suivi, ConstructeurProjetCalcul constructeur, IHorloge horloge, ServiceJournal journal)
{
    public IContexteDonnees Db => db;
    public IHorloge Horloge => horloge;
    public DateOnly Aujourdhui => horloge.Aujourdhui;

    /// <summary>Saisie réservée au chef de projet : renvoie l'utilisateur connecté.</summary>
    public async Task<Utilisateur> ExigerChefAsync(Guid projetId, CancellationToken annulation)
    {
        await acces.ExigerModificationAsync(projetId, annulation);
        return await acces.UtilisateurAsync(annulation);
    }

    /// <summary>Saisie du consommé (chef de projet ou consultant).</summary>
    public async Task<Utilisateur> ExigerSaisieConsommeAsync(Guid projetId, CancellationToken annulation)
    {
        await acces.ExigerSaisieConsommeAsync(projetId, annulation);
        return await acces.UtilisateurAsync(annulation);
    }

    /// <summary>
    /// Vérifie que l'objet n'a pas été modifié depuis son affichage. Sans numéro de version (null), pas de contrôle.
    /// (EF Core refait ce contrôle au moment d'écrire, pour le cas où deux enregistrements arrivent en même temps.)
    /// </summary>
    public static void VerifierVersion(Entite objet, int? versionAffichee, string quoi)
    {
        if (versionAffichee is not null && objet.Version != versionAffichee)
            throw new ConflitException($"{quoi} a été modifié(e) par quelqu’un d’autre pendant votre saisie. L’écran est rechargé avec sa version à jour : refaites votre modification si elle est toujours utile.");
    }

    /// <summary>Note une modification dans le journal du projet.</summary>
    public void Noter(Guid projetId, Utilisateur auteur, string objet, Guid? objetId, string champ, object? ancienne, object? nouvelle) =>
        journal.Noter(projetId, auteur.Id, objet, objetId, champ, Texte(ancienne), Texte(nouvelle));

    /// <summary>
    /// Enregistre, puis renvoie le suivi recalculé et les messages.
    /// « apres » ajoute des messages qui dépendent des indicateurs recalculés (ex. dépassement du budget d'achats).
    /// </summary>
    public async Task<ResultatSaisieDto> TerminerAsync(Guid projetId, List<MessageDto> messages, CancellationToken annulation, string? ouvrir = null,
        Func<ResultatCalcul, IEnumerable<MessageDto>>? apres = null)
    {
        await db.SaveChangesAsync(annulation);
        var role = await acces.ExigerAccesAsync(projetId, annulation);
        var (json, modele) = await suivi.ConstruireAvecModeleAsync(projetId, role, annulation);
        if (apres is not null) messages.AddRange(apres(modele));
        return new ResultatSaisieDto { Suivi = json, Messages = messages, Ouvrir = ouvrir };
    }

    /// <summary>Indicateurs actuels du projet (avant la saisie), pour les règles qui en dépendent.</summary>
    public async Task<ResultatCalcul> CalculerAsync(Guid projetId, CancellationToken annulation) =>
        MoteurCalcul.Calculer(await constructeur.ChargerAsync(projetId, annulation), horloge.Aujourdhui);

    /// <summary>Tâche du projet (avec ses évolutions, pour savoir si elle est annulée).</summary>
    public async Task<Tache> TacheAsync(Guid projetId, string repere, CancellationToken annulation) =>
        await db.Taches.Include(t => t.Evolutions).FirstOrDefaultAsync(t => t.ProjetId == projetId && t.Repere == repere && !t.EstSection, annulation)
        ?? throw new IntrouvableException("Tâche introuvable.");

    /// <summary>Profil du projet.</summary>
    public async Task<ProfilProjet> ProfilAsync(Guid projetId, Guid profilId, CancellationToken annulation) =>
        await db.Profils.FirstOrDefaultAsync(p => p.ProjetId == projetId && p.Id == profilId, annulation)
        ?? throw new IntrouvableException("Profil introuvable.");

    /// <summary>Nom de l'utilisateur, tel qu'il apparaît dans les registres (« Par »).</summary>
    public static string Nom(Utilisateur u) => u.NomComplet;

    /// <summary>Prochaine référence d'un registre : A-001, D-002…</summary>
    public static string ProchaineReference(IEnumerable<string> references, string prefixe)
    {
        var max = 0;
        foreach (var r in references)
        {
            var chiffres = new string(r.Where(char.IsDigit).ToArray());
            if (int.TryParse(chiffres, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n > max) max = n;
        }
        return $"{prefixe}-{(max + 1).ToString("000", CultureInfo.InvariantCulture)}";
    }

    /// <summary>Texte nettoyé (espaces en trop retirés) ; null devient vide.</summary>
    public static string Nettoyer(string? texte) => (texte ?? "").Trim();

    private static string? Texte(object? v) => v switch
    {
        null => null,
        DateOnly d => Calendrier.Fr(d),
        decimal m => m.ToString("0.##", CultureInfo.GetCultureInfo("fr-FR")),
        bool b => b ? "oui" : "non",
        _ => Convert.ToString(v, CultureInfo.GetCultureInfo("fr-FR")),
    };
}
