using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>Historique de commentaires commun aux tâches, actions, décisions et risques.</summary>
public sealed class MisesAJourService(SaisieOutils o)
{
    public const int LongueurMaximale = 4000;

    /// <summary>Compatibilité avec l'ancien point d'entrée : ajoute un commentaire sur une tâche identifiée par son UID.</summary>
    public async Task<ResultatSaisieDto> AjouterAsync(Guid projetId, string uid, MiseAJourCommande c, CancellationToken a)
    {
        var t = await o.TacheAsync(projetId, uid, a);
        return await AjouterCibleAsync(projetId, "Tache", t.Id, new NouveauCommentaireCommande(c.Texte), a);
    }

    public async Task<ResultatSaisieDto> AjouterCibleAsync(Guid projetId, string cibleType, Guid cibleId, NouveauCommentaireCommande c, CancellationToken a)
    {
        var u = await o.ExigerSaisieConsommeAsync(projetId, a);
        var (type, libelle) = await ExigerCibleAsync(projetId, cibleType, cibleId, a);
        if (type != "Tache" && await EstContributeurAsync(projetId, u.Id, a))
            throw new AccesRefuseException("Un contributeur ne peut commenter que les tâches qui lui sont affectées.");
        if (type == "Tache")
        {
            var uid = await o.Db.Taches.Where(tache => tache.ProjetId == projetId && tache.Id == cibleId)
                .Select(tache => tache.Repere).FirstOrDefaultAsync(a)
                ?? throw new IntrouvableException("Tâche introuvable.");
            await o.ExigerTacheAccessibleAuContributeurAsync(projetId, uid, u.Id, a);
        }
        var texte = ValiderTexte(c.Texte);
        var commentaire = new Commentaire
        {
            ProjetId = projetId,
            CibleType = type,
            CibleId = cibleId,
            Le = o.Horloge.Maintenant.UtcDateTime,
            AuteurId = u.Id,
            Texte = texte,
        };
        o.Db.Commentaires.Add(commentaire);
        o.Noter(projetId, u, "Commentaire", commentaire.Id, $"Commentaire ajouté — {libelle}", null, texte);
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Commentaire publié.", "succes") }, a);
    }

    public async Task<ResultatSaisieDto> ModifierAsync(Guid projetId, Guid commentaireId, ModifierCommentaireCommande c, CancellationToken a)
    {
        var u = await o.ExigerSaisieConsommeAsync(projetId, a);
        var commentaire = await o.Db.Commentaires.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Id == commentaireId, a)
            ?? throw new IntrouvableException("Commentaire introuvable.");
        await ExigerCommentaireAccessibleAuContributeurAsync(projetId, commentaire, u.Id, a);
        if (commentaire.AuteurId != u.Id) throw new AccesRefuseException("Seul l’auteur peut modifier ce commentaire.");
        var texte = ValiderTexte(c.Texte);
        var ancien = commentaire.Texte;
        commentaire.Texte = texte;
        commentaire.ModifieLe = o.Horloge.Maintenant.UtcDateTime;
        var cible = await LibelleCibleAsync(projetId, commentaire.CibleType, commentaire.CibleId, a);
        o.Noter(projetId, u, "Commentaire", commentaire.Id, $"Commentaire modifié — {cible}", ancien, texte);
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Commentaire modifié.", "succes") }, a);
    }

    public async Task<ResultatSaisieDto> SupprimerAsync(Guid projetId, Guid commentaireId, CancellationToken a)
    {
        var u = await o.ExigerSaisieConsommeAsync(projetId, a);
        var commentaire = await o.Db.Commentaires.FirstOrDefaultAsync(x => x.ProjetId == projetId && x.Id == commentaireId, a)
            ?? throw new IntrouvableException("Commentaire introuvable.");
        await ExigerCommentaireAccessibleAuContributeurAsync(projetId, commentaire, u.Id, a);
        if (commentaire.AuteurId != u.Id) throw new AccesRefuseException("Seul l’auteur peut supprimer ce commentaire.");
        var libelle = await LibelleCibleAsync(projetId, commentaire.CibleType, commentaire.CibleId, a);
        o.Db.Commentaires.Remove(commentaire);
        o.Noter(projetId, u, "Commentaire", commentaire.Id, $"Commentaire supprimé — {libelle}", commentaire.Texte, null);
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Commentaire supprimé.", "succes") }, a);
    }

    private async Task<bool> EstContributeurAsync(Guid projetId, Guid utilisateurId, CancellationToken a) =>
        await o.Db.Habilitations.AnyAsync(habilitation =>
            habilitation.ProjetId == projetId &&
            habilitation.UtilisateurId == utilisateurId &&
            habilitation.Role == RoleProjet.Consultant, a);

    private async Task ExigerCommentaireAccessibleAuContributeurAsync(
        Guid projetId, Commentaire commentaire, Guid utilisateurId, CancellationToken a)
    {
        if (commentaire.CibleType != "Tache") return;

        // Task ownership is a data-minimization rule for Contributors, not a restriction on a Project Manager
        // who may legitimately manage the project and their own comments across its tasks.
        if (!await EstContributeurAsync(projetId, utilisateurId, a)) return;

        var uid = await o.Db.Taches.Where(tache => tache.ProjetId == projetId && tache.Id == commentaire.CibleId)
            .Select(tache => tache.Repere).FirstOrDefaultAsync(a)
            ?? throw new IntrouvableException("Tâche introuvable.");
        await o.ExigerTacheAccessibleAuContributeurAsync(projetId, uid, utilisateurId, a);
    }

    private static string ValiderTexte(string? valeur)
    {
        var texte = SaisieOutils.Nettoyer(valeur);
        if (texte.Length == 0) throw new RegleMetierException("Le commentaire est vide.");
        if (texte.Length > LongueurMaximale) throw new RegleMetierException($"Commentaire trop long : {LongueurMaximale} caractères au maximum.");
        return texte;
    }

    private async Task<(string Type, string Libelle)> ExigerCibleAsync(Guid projetId, string cibleType, Guid cibleId, CancellationToken a)
    {
        var type = cibleType.Trim().ToLowerInvariant() switch
        {
            "tache" or "tâche" => "Tache",
            "action" => "Action",
            "decision" or "décision" => "Decision",
            "risque" => "Risque",
            _ => throw new RegleMetierException("Type de commentaire inconnu."),
        };
        return (type, await LibelleCibleAsync(projetId, type, cibleId, a));
    }

    private async Task<string> LibelleCibleAsync(Guid projetId, string type, Guid id, CancellationToken a) => type switch
    {
        "Tache" => await o.Db.Taches.Where(x => x.ProjetId == projetId && x.Id == id)
            .Select(x => x.Libelle ?? x.LibelleTsp).FirstOrDefaultAsync(a)
            ?? throw new IntrouvableException("Tâche introuvable."),
        "Action" => await o.Db.Actions.Where(x => x.ProjetId == projetId && x.Id == id).Select(x => x.Reference + " " + x.Libelle).FirstOrDefaultAsync(a)
            ?? throw new IntrouvableException("Action introuvable."),
        "Decision" => await o.Db.Decisions.Where(x => x.ProjetId == projetId && x.Id == id).Select(x => x.Reference + " " + x.Libelle).FirstOrDefaultAsync(a)
            ?? throw new IntrouvableException("Décision introuvable."),
        "Risque" => await o.Db.Risques.Where(x => x.ProjetId == projetId && x.Id == id).Select(x => x.Reference + " " + x.Libelle).FirstOrDefaultAsync(a)
            ?? throw new IntrouvableException("Risque introuvable."),
        _ => throw new RegleMetierException("Type de commentaire inconnu."),
    };
}
