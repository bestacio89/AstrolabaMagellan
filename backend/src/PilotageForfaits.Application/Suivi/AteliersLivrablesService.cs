using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Organisation des ateliers (date convenue avec le client, horaire, invitation, destinataires)
/// et validation client des livrables. Règles du POC (setAtelier, setLivrable).
/// </summary>
public sealed class AteliersLivrablesService(SaisieOutils o)
{
    /// <summary>
    /// Date planifiée de l'atelier. Elle alimente les dates prévues de la tâche quand elles sont vides ou qu'elles suivaient déjà l'atelier.
    /// Sans date, l'invitation est effacée.
    /// </summary>
    public async Task<ResultatSaisieDto> DefinirDateAsync(Guid projetId, string uid, AtelierDateCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var at = await AtelierAsync(projetId, t, a);
        var ancienne = at.DatePlanifiee;
        at.DefinirDate(c.Date);
        if (t.DebutPrevu is null || t.DebutPrevu == ancienne) t.DebutPrevu = c.Date;
        if (t.FinPrevue is null || t.FinPrevue == ancienne) t.FinPrevue = c.Date;
        Nettoyer(at);
        o.Noter(projetId, u, "Atelier", t.Id, $"{SaisiesTachesService.Libelle(t)} · date", ancienne, c.Date);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Horaire de l'atelier : la fin après le début ; sans début, pas de fin.</summary>
    public async Task<ResultatSaisieDto> DefinirHoraireAsync(Guid projetId, string uid, AtelierHoraireCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var at = await AtelierAsync(projetId, t, a);
        at.DefinirHoraire(Formats.LireHeure(c.HeureDebut), Formats.LireHeure(c.HeureFin));
        Nettoyer(at);
        o.Noter(projetId, u, "Atelier", t.Id, $"{SaisiesTachesService.Libelle(t)} · horaire", null, $"{c.HeureDebut}–{c.HeureFin}");
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Invitation envoyée (datée du jour) ou envoi annulé.</summary>
    public async Task<ResultatSaisieDto> MarquerInvitationAsync(Guid projetId, string uid, InvitationCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var at = await AtelierAsync(projetId, t, a);
        at.MarquerInvitation(c.Envoyee, o.Aujourdhui);
        Nettoyer(at);
        o.Noter(projetId, u, "Atelier", t.Id, $"{SaisiesTachesService.Libelle(t)} · invitation", null, c.Envoyee ? "envoyée" : "envoi annulé");
        var message = c.Envoyee ? "Invitation notée comme envoyée aujourd’hui." : "Envoi de l’invitation annulé.";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    /// <summary>Date d'envoi de l'invitation : obligatoire, jamais dans le futur.</summary>
    public async Task<ResultatSaisieDto> DefinirDateInvitationAsync(Guid projetId, string uid, AtelierDateCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var at = await AtelierAsync(projetId, t, a);
        var ancienne = at.EnvoyeeLe;
        at.DefinirDateEnvoi(c.Date, o.Aujourdhui);
        o.Noter(projetId, u, "Atelier", t.Id, $"{SaisiesTachesService.Libelle(t)} · invitation envoyée le", ancienne, c.Date);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Destinataires de l'invitation (noms ou adresses e-mail), sans doublon.</summary>
    public async Task<ResultatSaisieDto> DefinirDestinatairesAsync(Guid projetId, string uid, DestinatairesCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var at = await AtelierAsync(projetId, t, a);
        var liste = new List<string>();
        foreach (var x in c.Liste ?? new List<string>())
        {
            var v = SaisieOutils.Nettoyer(x);
            if (v.Length > 0 && !liste.Any(y => string.Equals(y, v, StringComparison.OrdinalIgnoreCase))) liste.Add(v.Length > 400 ? v[..400] : v);
        }
        o.Db.Destinataires.RemoveRange(at.Destinataires);
        at.Destinataires.Clear();
        for (var i = 0; i < liste.Count; i++)
        {
            var d = new Destinataire { ProjetId = projetId, AtelierId = at.Id, NomOuEmail = liste[i], Ordre = i };
            at.Destinataires.Add(d);
            o.Db.Destinataires.Add(d);
        }
        Nettoyer(at);
        o.Noter(projetId, u, "Atelier", t.Id, $"{SaisiesTachesService.Libelle(t)} · destinataires", null, string.Join("; ", liste));
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Validation du livrable par le client (manuelle, une fois le livrable livré, c'est-à-dire la tâche validée).</summary>
    public async Task<ResultatSaisieDto> DefinirValidationClientAsync(Guid projetId, string uid, ValidationClientCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        if (c.ValideLe is not null)
        {
            var calcule = (await o.CalculerAsync(projetId, a)).Tasks.First(x => x.Uid == uid);
            if (calcule.RealiseLe is null)
                throw new RegleMetierException("Le livrable n’est pas encore livré : il l’est quand la tâche est validée. La validation client vient ensuite.");
        }
        var livrable = await o.Db.Livrables.FirstOrDefaultAsync(l => l.TacheId == t.Id, a);
        var ancienne = livrable?.ValideParClientLe;
        if (livrable is null && c.ValideLe is not null)
        {
            livrable = new Livrable { ProjetId = projetId, TacheId = t.Id };
            o.Db.Livrables.Add(livrable);
        }
        if (livrable is not null)
        {
            livrable.ValideParClientLe = c.ValideLe;
            if (livrable.ValideParClientLe is null && string.IsNullOrEmpty(livrable.LienStockage)) o.Db.Livrables.Remove(livrable);
        }
        o.Noter(projetId, u, "Livrable", t.Id, $"{SaisiesTachesService.Libelle(t)} · validé client le", ancienne, c.ValideLe);
        var message = c.ValideLe is null
            ? "Validation client retirée : le livrable repasse « En attente »."
            : c.ValideLe == o.Aujourdhui ? "Livrable validé par le client aujourd’hui." : $"Livrable validé par le client le {Formats.Date(c.ValideLe.Value)}.";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    /// <summary>
    /// Adresse du document livré (lien SharePoint, chemin réseau…). Seules les adresses web (https://, http://) et réseau (\\serveur\…)
    /// sont acceptées : un lien qui ouvrirait autre chose (script, fichier local) est refusé.
    /// </summary>
    public async Task<ResultatSaisieDto> DefinirLienAsync(Guid projetId, string uid, LienLivrableCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var lien = SaisieOutils.Nettoyer(c.Lien);
        if (lien.Length > 0 && !LienAccepte(lien))
            throw new RegleMetierException("Lien non reconnu : indiquez une adresse qui commence par https:// (SharePoint, Teams…) ou un chemin réseau \\\\serveur\\dossier.");
        if (lien.Length > 1000) throw new RegleMetierException("Lien trop long : 1000 caractères au maximum.");
        var livrable = await o.Db.Livrables.FirstOrDefaultAsync(l => l.TacheId == t.Id, a);
        var ancienne = livrable?.LienStockage;
        if (livrable is null && lien.Length > 0)
        {
            livrable = new Livrable { ProjetId = projetId, TacheId = t.Id };
            o.Db.Livrables.Add(livrable);
        }
        if (livrable is not null)
        {
            livrable.LienStockage = lien.Length > 0 ? lien : null;
            if (livrable.ValideParClientLe is null && livrable.LienStockage is null) o.Db.Livrables.Remove(livrable);
        }
        o.Noter(projetId, u, "Livrable", t.Id, $"{SaisiesTachesService.Libelle(t)} · document", ancienne, lien.Length > 0 ? lien : null);
        var message = lien.Length > 0 ? "Lien du document enregistré." : "Lien du document retiré.";
        return await o.TerminerAsync(projetId, new List<MessageDto> { new(message, "succes") }, a);
    }

    /// <summary>Adresse web (https, http) ou chemin réseau Windows (\\serveur\partage).</summary>
    public static bool LienAccepte(string lien) =>
        (Uri.TryCreate(lien, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
        || CheminReseau.IsMatch(lien);

    /// <summary>Chemin réseau \\serveur\partage… (et pas un chemin local déguisé comme \\?\C:\ ou \\.\).</summary>
    private static readonly System.Text.RegularExpressions.Regex CheminReseau =
        new(@"^\\\\[A-Za-z0-9][\w.\-]*\\[^\\]+", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    /// <summary>Organisation de l'atelier de la tâche (créée au besoin), avec ses destinataires.</summary>
    private async Task<Atelier> AtelierAsync(Guid projetId, Tache t, CancellationToken a)
    {
        var at = await o.Db.Ateliers.Include(x => x.Destinataires).FirstOrDefaultAsync(x => x.TacheId == t.Id, a);
        if (at is not null) return at;
        at = new Atelier { ProjetId = projetId, TacheId = t.Id };
        o.Db.Ateliers.Add(at);
        return at;
    }

    /// <summary>Plus rien n'est renseigné : l'organisation de l'atelier est supprimée.</summary>
    private void Nettoyer(Atelier at)
    {
        if (at.EstVide) o.Db.Ateliers.Remove(at); // (un atelier jamais enregistré est simplement oublié)
    }
}
