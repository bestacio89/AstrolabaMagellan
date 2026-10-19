using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Commun;

/// <summary>
/// Journal des modifications : « rien ne se supprime sans trace ». Les entrées sont ajoutées à la transaction en cours
/// et enregistrées en même temps que la modification elle-même.
/// </summary>
public sealed class ServiceJournal(IContexteDonnees db, IHorloge horloge)
{
    public void Noter(Guid projetId, Guid? utilisateurId, string objet, Guid? objetId, string champ, string? ancienneValeur, string? nouvelleValeur)
    {
        db.Journal.Add(new EntreeJournal
        {
            ProjetId = projetId, UtilisateurId = utilisateurId, Le = horloge.Maintenant.UtcDateTime,
            Objet = objet, ObjetId = objetId, Champ = champ, AncienneValeur = ancienneValeur, NouvelleValeur = nouvelleValeur,
        });
    }
}
