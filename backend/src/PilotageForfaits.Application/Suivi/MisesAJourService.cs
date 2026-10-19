using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Fil de mises à jour d'une tâche : messages datés et signés, visibles par toute l'équipe du projet.
/// Le chef de projet et les consultants peuvent écrire (ce sont eux qui font avancer la tâche) ; le pilotage et les lecteurs lisent.
/// </summary>
public sealed class MisesAJourService(SaisieOutils o)
{
    /// <summary>Longueur maximale d'une mise à jour.</summary>
    public const int LongueurMaximale = 4000;

    public async Task<ResultatSaisieDto> AjouterAsync(Guid projetId, string uid, MiseAJourCommande c, CancellationToken a)
    {
        var u = await o.ExigerSaisieConsommeAsync(projetId, a);
        var t = await o.TacheAsync(projetId, uid, a);
        var texte = SaisieOutils.Nettoyer(c.Texte);
        if (texte.Length == 0) throw new RegleMetierException("La mise à jour est vide.");
        if (texte.Length > LongueurMaximale) throw new RegleMetierException($"Mise à jour trop longue : {LongueurMaximale} caractères au maximum.");
        o.Db.MisesAJour.Add(new MiseAJourTache
        {
            ProjetId = projetId, TacheId = t.Id, Le = o.Horloge.Maintenant.UtcDateTime, AuteurId = u.Id, Texte = texte,
        });
        return await o.TerminerAsync(projetId, new List<MessageDto> { new("Mise à jour publiée.", "succes") }, a);
    }
}
