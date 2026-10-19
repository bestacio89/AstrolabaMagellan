using Microsoft.EntityFrameworkCore;
using PilotageForfaits.Application.Commun;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Application.Suivi;

/// <summary>
/// Achats et frais réels (HT), rattachés au budget du TSP ou « hors TSP ». Ils alimentent la marge nette.
/// Règles du POC : quantité et montant strictement positifs, coût unitaire et refacturé positifs ou nuls, date obligatoire.
/// </summary>
public sealed class DepensesService(SaisieOutils o)
{
    // ------------------------------------------------------------------ achats

    public async Task<ResultatSaisieDto> CreerAchatAsync(Guid projetId, NouvelAchatCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var designation = SaisieOutils.Nettoyer(c.Designation);
        if (designation.Length == 0) throw new RegleMetierException("Indiquez une désignation.");
        if (c.Qte <= 0) throw new RegleMetierException("Quantité invalide.");
        if (c.Cu < 0) throw new RegleMetierException("Indiquez le coût unitaire HT.");
        if (c.Refacture is < 0) throw new RegleMetierException("Montant refacturé invalide.");
        if (c.Date == default) throw new RegleMetierException("Indiquez la date.");
        var achat = new AchatReel
        {
            ProjetId = projetId, Date = c.Date, Designation = designation, Fournisseur = SaisieOutils.Nettoyer(c.Fournisseur),
            LigneBudgetAchatId = await LigneAsync(projetId, c.Ligne, a), Quantite = c.Qte, CoutUnitaire = c.Cu, Refacture = c.Refacture ?? 0,
            Statut = Formats.StatutAchat(c.Statut), Commentaire = SaisieOutils.Nettoyer(c.Commentaire), CreeLe = o.Horloge.Maintenant, CreeParId = u.Id,
        };
        o.Db.AchatsReels.Add(achat);
        o.Noter(projetId, u, "Achat", achat.Id, "création", null, $"{designation} {Formats.Euros(c.Qte * c.Cu)}");
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a, achat.Id.ToString(), m => new[]
        {
            new MessageDto(m.Financier.Achats.Depasse > 0.5m
                ? $"Achat ajouté. Achats au-delà du budget TSP : +{Formats.Euros(m.Financier.Achats.Depasse)}."
                : "Achat ajouté.", m.Financier.Achats.Depasse > 0.5m ? "attention" : "succes"),
        });
    }

    public async Task<ResultatSaisieDto> ModifierAchatAsync(Guid projetId, Guid id, ChampCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.AchatsReels.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Achat introuvable.");
        SaisieOutils.VerifierVersion(x, c.Version, "L’achat");
        var v = c.Valeur;
        switch (c.Champ)
        {
            case "qte":
                var q = Formats.LireNombre(v);
                if (q is null or <= 0) throw new RegleMetierException("Quantité invalide : saisissez un nombre supérieur à 0. Saisie annulée.");
                x.Quantite = q.Value;
                break;
            case "cu":
                var cu = Formats.LireNombre(v) ?? 0;
                if (cu < 0) throw new RegleMetierException("Coût unitaire invalide : saisissez un nombre positif. Saisie annulée.");
                x.CoutUnitaire = cu;
                break;
            case "refacture":
                var r = Formats.LireNombre(v) ?? 0;
                if (r < 0) throw new RegleMetierException("Montant refacturé invalide : saisissez un nombre positif. Saisie annulée.");
                x.Refacture = r;
                break;
            case "date": x.Date = Formats.LireDate(v) ?? throw new RegleMetierException("La date est obligatoire : saisie annulée."); break;
            case "designation": x.Designation = SaisieOutils.Nettoyer(v); break;
            case "fournisseur": x.Fournisseur = SaisieOutils.Nettoyer(v); break;
            case "ligne":
                int? indexLigne = null;
                if (!string.IsNullOrWhiteSpace(v))
                {
                    if (!int.TryParse(v, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var n))
                        throw new RegleMetierException("Ligne du budget achats invalide : saisie annulée.");
                    indexLigne = n;
                }
                x.LigneBudgetAchatId = await LigneAsync(projetId, indexLigne, a);
                break;
            case "statut": x.Statut = Formats.StatutAchat(v); break;
            case "commentaire": x.Commentaire = SaisieOutils.Nettoyer(v); break;
            default: throw new RegleMetierException($"Champ inconnu : « {c.Champ} ».");
        }
        o.Noter(projetId, u, "Achat", x.Id, $"{x.Designation} · {c.Champ}", null, v);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    public async Task<ResultatSaisieDto> SupprimerAchatAsync(Guid projetId, Guid id, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.AchatsReels.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Achat introuvable.");
        o.Db.AchatsReels.Remove(x);
        o.Noter(projetId, u, "Achat", x.Id, "suppression", $"{x.Designation} {Formats.Euros(x.Quantite * x.CoutUnitaire)}", null);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    // ------------------------------------------------------------------ frais

    public async Task<ResultatSaisieDto> CreerFraisAsync(Guid projetId, NouveauFraisCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        if (c.Date == default) throw new RegleMetierException("Indiquez la date.");
        var libelle = SaisieOutils.Nettoyer(c.Libelle);
        if (libelle.Length == 0) throw new RegleMetierException("Indiquez un libellé.");
        if (c.Montant <= 0) throw new RegleMetierException("Indiquez le montant HT.");
        var frais = new FraisReel
        {
            ProjetId = projetId, Date = c.Date, Collaborateur = SaisieOutils.Nettoyer(c.Collaborateur), Categorie = Formats.CategorieFrais(c.Categorie),
            Libelle = libelle, Montant = c.Montant, Refacturable = c.Refacturable, Commentaire = SaisieOutils.Nettoyer(c.Commentaire),
            CreeLe = o.Horloge.Maintenant, CreeParId = u.Id,
        };
        o.Db.FraisReels.Add(frais);
        o.Noter(projetId, u, "Frais", frais.Id, "création", null, $"{libelle} {Formats.Euros(c.Montant)}");
        var message = new MessageDto($"Frais ajouté ({c.Montant.ToString("#,##0.00", System.Globalization.CultureInfo.GetCultureInfo("fr-FR"))} €).",
            "succes", "nouveau-frais", null, "+ Un autre");
        return await o.TerminerAsync(projetId, new List<MessageDto> { message }, a, frais.Id.ToString());
    }

    public async Task<ResultatSaisieDto> ModifierFraisAsync(Guid projetId, Guid id, ChampCommande c, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.FraisReels.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Frais introuvable.");
        SaisieOutils.VerifierVersion(x, c.Version, "Le frais");
        var v = c.Valeur;
        switch (c.Champ)
        {
            case "montant":
                var m = Formats.LireNombre(v);
                if (m is null or <= 0) throw new RegleMetierException("Montant invalide : saisissez un nombre supérieur à 0. Saisie annulée.");
                x.Montant = m.Value;
                break;
            case "date": x.Date = Formats.LireDate(v) ?? throw new RegleMetierException("La date est obligatoire : saisie annulée."); break;
            case "collaborateur": x.Collaborateur = SaisieOutils.Nettoyer(v); break;
            case "categorie": x.Categorie = Formats.CategorieFrais(v); break;
            case "libelle": x.Libelle = SaisieOutils.Nettoyer(v); break;
            case "refacturable": x.Refacturable = string.Equals(v, "true", StringComparison.OrdinalIgnoreCase); break;
            case "commentaire": x.Commentaire = SaisieOutils.Nettoyer(v); break;
            default: throw new RegleMetierException($"Champ inconnu : « {c.Champ} ».");
        }
        o.Noter(projetId, u, "Frais", x.Id, $"{x.Libelle} · {c.Champ}", null, v);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    public async Task<ResultatSaisieDto> SupprimerFraisAsync(Guid projetId, Guid id, CancellationToken a)
    {
        var u = await o.ExigerChefAsync(projetId, a);
        var x = await o.Db.FraisReels.FirstOrDefaultAsync(y => y.ProjetId == projetId && y.Id == id, a) ?? throw new IntrouvableException("Frais introuvable.");
        o.Db.FraisReels.Remove(x);
        o.Noter(projetId, u, "Frais", x.Id, "suppression", $"{x.Libelle} {Formats.Euros(x.Montant)}", null);
        return await o.TerminerAsync(projetId, new List<MessageDto>(), a);
    }

    /// <summary>Ligne de budget d'achat du TSP désignée par sa position (null : hors TSP).</summary>
    private async Task<Guid?> LigneAsync(Guid projetId, int? index, CancellationToken a)
    {
        if (index is null) return null;
        var lignes = await o.Db.BudgetsAchats.Where(x => x.ProjetId == projetId).OrderBy(x => x.Ordre).Select(x => x.Id).ToListAsync(a);
        if (index < 0 || index >= lignes.Count) throw new IntrouvableException("Ligne du TSP introuvable.");
        return lignes[index.Value];
    }
}
