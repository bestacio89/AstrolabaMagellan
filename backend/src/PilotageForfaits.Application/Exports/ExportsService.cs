using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Application.Suivi;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Exports;

/// <summary>Fichier produit (contenu et nom proposé au téléchargement).</summary>
public sealed record FichierExport(byte[] Contenu, string Nom)
{
    public const string TypeXlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

/// <summary>
/// Exports COPIL et COPROJ (Excel). Comme dans le POC, une photo des indicateurs est prise à chaque export
/// (carte « Évolution d'un comité à l'autre » du tableau de bord), et la date du dernier COPROJ est retenue.
/// Ces deux traces ne sont enregistrées que si l'utilisateur peut modifier le projet (chef de projet) :
/// un export par le pilotage, en lecture seule, ne modifie rien.
/// </summary>
public sealed partial class ExportsService(
    IContexteDonnees db, ServiceAcces acces, ConstructeurProjetCalcul constructeur, IHorloge horloge, IEcrivainClasseur ecrivain, ServiceJournal journal)
{
    public async Task<FichierExport> CopilAsync(Guid projetId, CancellationToken a)
    {
        var role = await acces.ExigerExportAsync(projetId, a);
        // la photo des indicateurs n'est prise que par le chef de projet, et jamais sur un projet archivé (lecture seule)
        if (ServiceAcces.PeutModifier(role) && !await acces.EstArchiveAsync(projetId, a)) await PhotographierAsync(projetId, NaturePhoto.Copil, null, a);
        var (vue, modele) = await ChargerAsync(projetId, a);
        var feuilles = ExportComites.Copil(vue, modele, horloge.Aujourdhui);
        return new FichierExport(ecrivain.Ecrire(feuilles), $"COPIL - {NomFichier(vue.Fiche.Client, "Projet")} - {NomFichier(vue.Fiche.Projet, "")} - {Calendrier.Iso(horloge.Aujourdhui)}.xlsx".Replace(" -  - ", " - "));
    }

    public async Task<FichierExport> CoprojAsync(Guid projetId, CoprojCommande c, CancellationToken a)
    {
        var role = await acces.ExigerExportAsync(projetId, a);
        if (c.Du == default || c.Au == default) throw new RegleMetierException("Indiquez les deux dates de la période.");
        if (c.Du > c.Au) throw new RegleMetierException("La date de début doit précéder la date de fin.");
        if (c.Horizon is not (7 or 14 or 21 or 28)) throw new RegleMetierException("Horizon non proposé.");
        if (ServiceAcces.PeutModifier(role) && !await acces.EstArchiveAsync(projetId, a)) await PhotographierAsync(projetId, NaturePhoto.Coproj, c.Au, a);
        var (vue, modele) = await ChargerAsync(projetId, a);
        var feuilles = ExportComites.Coproj(vue, modele, c.Du, c.Au, c.Horizon, horloge.Aujourdhui);
        return new FichierExport(ecrivain.Ecrire(feuilles), $"COPROJ - {NomFichier(vue.Fiche.Client, "Projet")} - {NomFichier(vue.Fiche.Projet, "")} - {Calendrier.Iso(c.Au)}.xlsx".Replace(" -  - ", " - "));
    }

    /// <summary>
    /// Photo des indicateurs (une par jour et par type de comité, remplacée si elle existe déjà).
    /// COPROJ : la date du dernier COPROJ est retenue (elle ne recule jamais, même si l'on refait un COPROJ sur une période passée).
    /// </summary>
    private async Task PhotographierAsync(Guid projetId, NaturePhoto nature, DateOnly? auCoproj, CancellationToken a)
    {
        var u = await acces.UtilisateurAsync(a);
        var m = MoteurCalcul.Calculer(await constructeur.ChargerAsync(projetId, a), horloge.Aujourdhui);
        var date = horloge.Aujourdhui;
        var photo = await db.PhotosIndicateurs.FirstOrDefaultAsync(p => p.ProjetId == projetId && p.Date == date && p.Nature == nature, a);
        if (photo is null)
        {
            photo = new PhotoIndicateurs { ProjetId = projetId, Date = date, Nature = nature };
            db.PhotosIndicateurs.Add(photo);
        }
        photo.Prevu = Texte.Arrondir(m.Total.Prevu, 2);
        photo.Consomme = Texte.Arrondir(m.Total.Conso, 2);
        photo.ResteAFaire = Texte.Arrondir(m.Total.Raf, 2);
        photo.Atterrissage = Texte.Arrondir(m.Total.Atterrissage, 2);
        photo.CoutFinal = Texte.Arrondir(m.Financier.CoutFinal, 0);
        photo.Marge = Texte.Arrondir(m.Financier.Marge, 0);
        photo.MargeNette = Texte.Arrondir(m.Financier.MargeNette, 0);
        photo.TauxMargeNette = Texte.Arrondir(m.Financier.TauxMargeNette, 4);
        photo.FinPrevue = m.Cal.FinPrevue;
        if (auCoproj is not null)
        {
            var projet = await db.Projets.FirstAsync(p => p.Id == projetId, a);
            if (projet.Parametres.DernierCoproj is null || auCoproj > projet.Parametres.DernierCoproj) projet.Parametres.DernierCoproj = auCoproj;
        }
        journal.Noter(projetId, u.Id, "Export", projetId, nature == NaturePhoto.Copil ? "COPIL" : "COPROJ", null, Calendrier.Fr(date));
        await db.SaveChangesAsync(a);
    }

    private async Task<(ProjetVueDto Vue, ResultatCalcul Modele)> ChargerAsync(Guid projetId, CancellationToken a)
    {
        var donnees = await constructeur.ChargerDonneesAsync(projetId, a);
        var calcul = ConstructeurProjetCalcul.Construire(donnees);
        var modele = MoteurCalcul.Calculer(calcul, horloge.Aujourdhui);
        var vue = ConstructeurVueSuivi.Construire(donnees, calcul, new List<EntreeJournal>(), new Dictionary<Guid, string>());
        return (vue, modele);
    }

    /// <summary>Morceau de nom de fichier sans caractère interdit, 60 caractères au plus.</summary>
    internal static string NomFichier(string? s, string defaut)
    {
        var propre = Espaces().Replace(Interdits().Replace(s ?? "", " "), " ").Trim();
        if (propre.Length > 60) propre = propre[..60];
        return propre.Length == 0 ? defaut : propre;
    }

    [GeneratedRegex("[\\\\/:*?\"<>|]+")]
    private static partial Regex Interdits();

    [GeneratedRegex("\\s+")]
    private static partial Regex Espaces();
}
