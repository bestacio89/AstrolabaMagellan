using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Application.Securite;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Mutations des données de planning et d'absence. Les écritures liées à un projet passent toutes par
/// le contrôle chef-de-projet, le journal et le recalcul du suivi.
/// </summary>
public sealed class PlanningSaisieService(SaisieOutils o, ServiceAcces acces, IUtilisateurCourant courant, IHorloge horloge)
{
    public async Task<ResultatSaisieDto> DefinirDateAsync(Guid projetId, DatePlanningCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var cle = CleObligatoire(c.Cle);
        if (c.Cote is not ("debut" or "fin")) throw new RegleMetierException("Le côté de la date doit être « debut » ou « fin ».");
        var valeur = Formats.LireDate(c.Valeur);
        var ligne = await o.Db.DatesPlanning.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Cle == cle, a);
        if (ligne is null)
        {
            if (valeur is null) return await o.TerminerAsync(projetId, new(), a);
            ligne = new DatesPlanning { ProjetId = projetId, Cle = cle };
            o.Db.DatesPlanning.Add(ligne);
        }
        else SaisieOutils.VerifierVersion(ligne, c.Version, "La date du planning");
        var debut = c.Cote == "debut" ? valeur : ligne.Debut;
        var fin = c.Cote == "fin" ? valeur : ligne.Fin;
        if (debut is not null && fin is not null && fin < debut)
            throw new RegleMetierException("La fin prévue ne peut pas précéder le début prévu.");
        var ancienne = c.Cote == "debut" ? ligne.Debut : ligne.Fin;
        ligne.Debut = debut;
        ligne.Fin = fin;
        o.Noter(projetId, u, "Planning", ligne.Id, c.Cote, ancienne, valeur);
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> EffacerDatesAsync(Guid projetId, ClePlanningCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var cle = CleObligatoire(c.Cle);
        var ligne = await o.Db.DatesPlanning.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Cle == cle, a);
        if (ligne is not null)
        {
            o.Noter(projetId, u, "Planning", ligne.Id, "effacer dates", $"{ligne.Debut} / {ligne.Fin}", null);
            ligne.Debut = null;
            ligne.Fin = null;
            if (string.IsNullOrWhiteSpace(ligne.Nom)) o.Db.DatesPlanning.Remove(ligne);
        }
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> NommerSousPartieAsync(Guid projetId, NomSousPartieCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var cle = CleObligatoire(c.Cle);
        var nom = Limiter(SaisieOutils.Nettoyer(c.Nom), 200);
        var ligne = await o.Db.DatesPlanning.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Cle == cle, a);
        if (ligne is null)
        {
            ligne = new DatesPlanning { ProjetId = projetId, Cle = cle };
            o.Db.DatesPlanning.Add(ligne);
        }
        else SaisieOutils.VerifierVersion(ligne, c.Version, "La sous-partie");
        var ancien = ligne.Nom;
        ligne.Nom = nom.Length == 0 ? null : nom;
        if (ligne.Nom is null && ligne.Debut is null && ligne.Fin is null) o.Db.DatesPlanning.Remove(ligne);
        o.Noter(projetId, u, "Planning", ligne.Id, "nom de sous-partie", ancien, ligne.Nom);
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> AjouterJalonAsync(Guid projetId, JalonCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var jalon = CreerJalon(projetId, c);
        o.Db.Jalons.Add(jalon);
        o.Noter(projetId, u, "Jalon", jalon.Id, "création", null, jalon.Libelle);
        return await o.TerminerAsync(projetId, new(), a, jalon.Id.ToString());
    }

    public async Task<ResultatSaisieDto> ModifierJalonAsync(Guid projetId, Guid jalonId, JalonCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var jalon = await o.Db.Jalons.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Id == jalonId, a)
            ?? throw new IntrouvableException("Jalon introuvable.");
        SaisieOutils.VerifierVersion(jalon, c.Version, "Le jalon");
        var ancien = $"{jalon.Libelle} ({jalon.Debut:yyyy-MM-dd})";
        AppliquerJalon(jalon, c);
        o.Noter(projetId, u, "Jalon", jalon.Id, "modification", ancien, $"{jalon.Libelle} ({jalon.Debut:yyyy-MM-dd})");
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> SupprimerJalonAsync(Guid projetId, Guid jalonId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var jalon = await o.Db.Jalons.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Id == jalonId, a)
            ?? throw new IntrouvableException("Jalon introuvable.");
        o.Db.Jalons.Remove(jalon);
        o.Noter(projetId, u, "Jalon", jalon.Id, "suppression", jalon.Libelle, null);
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> DefinirElementAsync(Guid projetId, ElementPlanningCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var cle = CleObligatoire(c.Cle);
        var nature = c.Nature switch
        {
            "avant" => NatureElementPlanning.MisEnAvant,
            "masque" => NatureElementPlanning.Masque,
            _ => throw new RegleMetierException("La nature doit être « avant » ou « masque ».")
        };
        var element = await o.Db.ElementsPlanning.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Nature == nature && x.Cle == cle, a);
        if (c.Actif && element is null)
        {
            element = new ElementPlanning { ProjetId = projetId, Nature = nature, Cle = cle };
            o.Db.ElementsPlanning.Add(element);
            o.Noter(projetId, u, "Planning", element.Id, nature.ToString(), null, cle);
        }
        else if (!c.Actif && element is not null)
        {
            o.Db.ElementsPlanning.Remove(element);
            o.Noter(projetId, u, "Planning", element.Id, nature.ToString(), cle, null);
        }
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> RetirerElementsAsync(Guid projetId, ClesPlanningCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var cles = (c.Cles ?? []).Select(CleObligatoire).Distinct(StringComparer.Ordinal).ToArray();
        var elements = await o.Db.ElementsPlanning.Where(x => x.ProjetId == projetId && cles.Contains(x.Cle)).ToListAsync(a);
        foreach (var element in elements)
        {
            o.Noter(projetId, u, "Planning", element.Id, "retirer élément", $"{element.Nature}:{element.Cle}", null);
            o.Db.ElementsPlanning.Remove(element);
        }
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> DefinirPrevisionnelAsync(Guid projetId, PrevisionnelCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        if (!DateOnly.TryParseExact($"{c.Mois}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new RegleMetierException("Le mois doit être au format AAAA-MM.");
        if (c.Jh is < 0 or > 100000) throw new RegleMetierException("La charge prévisionnelle doit être comprise entre 0 et 100000 JH.");
        _ = await o.ProfilAsync(projetId, c.ProfilId, a);
        var ligne = await o.Db.Previsionnels.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.ProfilProjetId == c.ProfilId && x.Mois == c.Mois, a);
        if (c.Jh is null)
        {
            if (ligne is not null)
            {
                o.Db.Previsionnels.Remove(ligne);
                o.Noter(projetId, u, "Prévisionnel", ligne.Id, c.Mois, ligne.JoursHomme, null);
            }
        }
        else if (ligne is null)
        {
            ligne = new PrevisionnelProfil { ProjetId = projetId, ProfilProjetId = c.ProfilId, Mois = c.Mois, JoursHomme = c.Jh.Value };
            o.Db.Previsionnels.Add(ligne);
            o.Noter(projetId, u, "Prévisionnel", ligne.Id, c.Mois, null, c.Jh);
        }
        else
        {
            var ancien = ligne.JoursHomme;
            ligne.JoursHomme = c.Jh.Value;
            o.Noter(projetId, u, "Prévisionnel", ligne.Id, c.Mois, ancien, c.Jh);
        }
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> ReinitialiserPrevisionnelAsync(Guid projetId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var lignes = await o.Db.Previsionnels.Where(x => x.ProjetId == projetId).ToListAsync(a);
        foreach (var ligne in lignes)
        {
            o.Noter(projetId, u, "Prévisionnel", ligne.Id, "réinitialisation", ligne.JoursHomme, null);
            o.Db.Previsionnels.Remove(ligne);
        }
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> DefinirAbsenceProjetAsync(Guid projetId, AbsenceCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var nom = Limiter(SaisieOutils.Nettoyer(c.Nom), 200);
        if (nom.Length == 0) throw new RegleMetierException("Le nom de la personne est obligatoire.");
        if (!DateOnly.TryParseExact(c.Jour, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var jour))
            throw new RegleMetierException("Le jour doit être au format AAAA-MM-JJ.");
        var cle = Personnes.Cle(nom);
        var absence = await o.Db.Absences.FirstOrDefaultAsync(x => x.PersonneCle == cle && x.Jour == jour, a);
        if (c.Moment == "")
        {
            if (absence is not null)
            {
                o.Db.Absences.Remove(absence);
                o.Noter(projetId, u, "Absence", absence.Id, "suppression", $"{nom} {c.Jour}", null);
            }
        }
        else
        {
            var moment = LireMoment(c.Moment);
            if (absence is null)
            {
                absence = new Absence { PersonneCle = cle, PersonneNom = nom, Jour = jour, SaisieLe = horloge.Maintenant, SaisieParId = u.Id };
                o.Db.Absences.Add(absence);
            }
            var ancien = absence.Moment;
            absence.PersonneNom = nom;
            absence.Moment = moment;
            absence.SaisieLe = horloge.Maintenant;
            absence.SaisieParId = u.Id;
            o.Noter(projetId, u, "Absence", absence.Id, c.Jour, ancien, moment);
        }
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> AjouterPersonneAsync(Guid projetId, PersonneCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var nom = Limiter(SaisieOutils.Nettoyer(c.Nom), 200);
        var cle = Personnes.Cle(nom);
        if (cle.Length == 0) throw new RegleMetierException("Le nom de la personne est obligatoire.");
        if (await o.Db.PersonnesAjoutees.AnyAsync(x => x.ProjetId == projetId && x.Cle == cle, a))
            throw new RegleMetierException("Cette personne est déjà présente dans le projet.");
        var personne = new PersonneAjoutee { ProjetId = projetId, Nom = nom, Cle = cle };
        o.Db.PersonnesAjoutees.Add(personne);
        o.Noter(projetId, u, "Personne", personne.Id, "création", null, nom);
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> RetirerPersonneAsync(Guid projetId, Guid personneId, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var personne = await o.Db.PersonnesAjoutees.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Id == personneId, a)
            ?? throw new IntrouvableException("Personne introuvable.");
        o.Db.PersonnesAjoutees.Remove(personne);
        o.Noter(projetId, u, "Personne", personne.Id, "suppression", personne.Nom, null);
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<ResultatSaisieDto> DefinirInstancesAsync(Guid projetId, InstancesCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var valeurs = (c.Valeurs ?? []).Select(SaisieOutils.Nettoyer).Where(x => x.Length > 0)
            .Select(x => Limiter(x, 200)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (c.Ancien is not null && c.Nouveau is not null)
        {
            var ancien = valeurs.FindIndex(x => string.Equals(x, c.Ancien, StringComparison.OrdinalIgnoreCase));
            if (ancien >= 0) valeurs[ancien] = Limiter(SaisieOutils.Nettoyer(c.Nouveau), 200);
            valeurs = valeurs.Where(x => x.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        if (valeurs.Count > 50) throw new RegleMetierException("La liste ne peut pas contenir plus de 50 instances.");
        var projet = await o.Db.Projets.FirstOrDefaultAsync(x => x.Id == projetId, a) ?? throw new IntrouvableException("Projet introuvable.");
        var ancienJson = projet.Parametres.Instances;
        projet.Parametres.Instances = valeurs.Count == 0 ? null : JsonSerializer.Serialize(valeurs);
        o.Noter(projetId, u, "Paramètres", projet.Id, "instances", ancienJson, projet.Parametres.Instances);
        return await o.TerminerAsync(projetId, new(), a);
    }

    public async Task<IReadOnlyList<MonAbsenceDto>> MesAbsencesAsync(DateOnly du, DateOnly au, CancellationToken a)
    {
        if (au < du) throw new RegleMetierException("La date de fin doit être postérieure ou égale à la date de début.");
        if (au.DayNumber - du.DayNumber > 366) throw new RegleMetierException("La période ne peut pas dépasser 367 jours.");
        var utilisateur = await acces.UtilisateurAsync(a);
        var cle = Personnes.Cle($"{courant.Prenom} {courant.Nom}");
        var lignes = await o.Db.Absences.AsNoTracking()
            .Where(x => x.Jour >= du && x.Jour <= au && (x.UtilisateurId == utilisateur.Id || (x.UtilisateurId == null && x.PersonneCle == cle)))
            .OrderBy(x => x.Jour)
            .Select(x => new { x.Jour, x.Moment })
            .ToListAsync(a);
        return lignes.Select(x => new MonAbsenceDto(x.Jour.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), CodeMoment(x.Moment))).ToList();
    }

    public async Task<IReadOnlyList<MonAbsenceDto>> DefinirMonAbsenceAsync(DateOnly jour, string momentCode, CancellationToken a)
    {
        var utilisateur = await acces.UtilisateurAsync(a);
        var nom = Limiter(SaisieOutils.Nettoyer($"{courant.Prenom} {courant.Nom}"), 200);
        var cle = Personnes.Cle(nom);
        var absence = await o.Db.Absences.FirstOrDefaultAsync(x => x.UtilisateurId == utilisateur.Id && x.Jour == jour, a);
        if (absence is null)
        {
            // A manager-created, unlinked absence can be claimed by the matching account. Never mutate another
            // account's record merely because two people happen to have the same display name.
            var parNom = await o.Db.Absences.FirstOrDefaultAsync(x => x.PersonneCle == cle && x.Jour == jour, a);
            if (parNom is not null && parNom.UtilisateurId is not null && parNom.UtilisateurId != utilisateur.Id)
                throw new RegleMetierException("Une autre personne possède déjà une absence pour ce jour avec le même nom affiché. Contactez le responsable du projet pour lever l'ambiguïté.");
            absence = parNom;
        }
        if (momentCode == "")
        {
            if (absence is not null) o.Db.Absences.Remove(absence);
        }
        else
        {
            var moment = LireMoment(momentCode);
            if (absence is null)
            {
                absence = new Absence { PersonneCle = cle, PersonneNom = nom, Jour = jour };
                o.Db.Absences.Add(absence);
            }
            absence.UtilisateurId = utilisateur.Id;
            absence.PersonneCle = cle;
            absence.PersonneNom = nom;
            absence.Jour = jour;
            absence.Moment = moment;
            absence.SaisieLe = horloge.Maintenant;
            absence.SaisieParId = utilisateur.Id;
        }
        await o.Db.SaveChangesAsync(a);
        var debutMois = new DateOnly(jour.Year, jour.Month, 1);
        var finMois = debutMois.AddMonths(1).AddDays(-1);
        return await MesAbsencesAsync(debutMois, finMois, a);
    }

    private static Jalon CreerJalon(Guid projetId, JalonCommande c)
    {
        var jalon = new Jalon { ProjetId = projetId };
        AppliquerJalon(jalon, c);
        return jalon;
    }

    private static void AppliquerJalon(Jalon jalon, JalonCommande c)
    {
        var libelle = Limiter(SaisieOutils.Nettoyer(c.Libelle), 200);
        if (libelle.Length == 0) throw new RegleMetierException("Le libellé du jalon est obligatoire.");
        if (!DateOnly.TryParseExact(c.Debut, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var debut))
            throw new RegleMetierException("La date de début du jalon doit être au format AAAA-MM-JJ.");
        DateOnly? fin = null;
        if (!string.IsNullOrWhiteSpace(c.Fin))
        {
            if (!DateOnly.TryParseExact(c.Fin, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                throw new RegleMetierException("La date de fin du jalon doit être au format AAAA-MM-JJ.");
            fin = parsed;
        }
        if (c.Type == "periode" && (fin is null || fin < debut))
            throw new RegleMetierException("Un jalon de type période doit avoir une fin égale ou postérieure au début.");
        if (c.Type is not ("date" or "periode" or "semaine")) throw new RegleMetierException("Type de jalon inconnu.");
        jalon.Libelle = libelle;
        jalon.Type = c.Type switch { "periode" => TypeJalon.Periode, "semaine" => TypeJalon.Semaine, _ => TypeJalon.Date };
        jalon.Debut = debut;
        jalon.Fin = jalon.Type == TypeJalon.Periode ? fin : null;
        jalon.AConfirmer = c.AConfirmer;
    }

    private static MomentAbsence LireMoment(string code) => code switch
    {
        "j" => MomentAbsence.Journee,
        "m" => MomentAbsence.Matin,
        "a" => MomentAbsence.ApresMidi,
        _ => throw new RegleMetierException("Le moment d'absence doit être vide, « j », « m » ou « a ».")
    };

    private static string CodeMoment(MomentAbsence moment) => moment switch
    {
        MomentAbsence.Journee => "j",
        MomentAbsence.Matin => "m",
        MomentAbsence.ApresMidi => "a",
        _ => throw new ArgumentOutOfRangeException(nameof(moment))
    };

    private static string CleObligatoire(string? cle)
    {
        var value = SaisieOutils.Nettoyer(cle);
        if (value.Length == 0 || value.Length > 200) throw new RegleMetierException("La clé du planning est obligatoire (200 caractères maximum).");
        return value;
    }

    private static string Limiter(string value, int longueur) => value.Length <= longueur ? value : value[..longueur];
}

public sealed record DatePlanningCommande(string Cle, string Cote, string? Valeur, int? Version = null);
public sealed record ClePlanningCommande(string Cle);
public sealed record NomSousPartieCommande(string Cle, string Nom, int? Version = null);
public sealed record JalonCommande(string Libelle, string Type, string Debut, string? Fin, bool AConfirmer, int? Version = null);
public sealed record ElementPlanningCommande(string Nature, string Cle, bool Actif);
public sealed record ClesPlanningCommande(List<string>? Cles);
public sealed record PrevisionnelCommande(Guid ProfilId, string Mois, decimal? Jh);
public sealed record AbsenceCommande(string Nom, string Jour, string Moment);
public sealed record PersonneCommande(string Nom);
public sealed record InstancesCommande(List<string>? Valeurs, string? Ancien = null, string? Nouveau = null);
public sealed record MonAbsenceDto(string Jour, string Moment);
