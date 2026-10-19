using PilotageForfaits.Application.Calcul;
using PilotageForfaits.Application.Exports;
using PilotageForfaits.Application.Import;
using PilotageForfaits.Domain.Calcul;
using PilotageForfaits.Domain.Commun;
using PilotageForfaits.Domain.Entites;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Application.Brouillons;

/// <summary>
/// Passage d'un TSP rédigé au projet, par le même chemin qu'un TSP importé :
/// TSP rédigé → classeur au format du TSP (ClasseurTsp) → lecture d'un TSP (InterpreteurTsp) → projet (ConvertisseurTsp).
/// Et, dans l'autre sens, reprise d'un TSP importé ou d'un projet existant dans un brouillon.
/// </summary>
public static class RedactionTsp
{
    /// <summary>Nom donné au « fichier » d'un TSP rédigé (il apparaît dans l'historique d'import du projet).</summary>
    public const string NomSource = "TSP rédigé dans l'application";

    /// <summary>Lit le TSP rédigé exactement comme un TSP importé.</summary>
    /// <exception cref="TspInvalideException">Le TSP n'a pas encore de tâche.</exception>
    public static TspLu Lire(TspSaisi tsp, ClasseurTsp.Contexte contexte) =>
        InterpreteurTsp.Interpreter(new ClasseurEnMemoire(ClasseurTsp.Feuilles(tsp, contexte)), NomSource, contexte.Date);

    /// <summary>Projet (en mémoire, non enregistré) que donnerait le lancement du TSP rédigé.</summary>
    public static Projet CreerProjet(TspSaisi tsp, ClasseurTsp.Contexte contexte, Guid? creePar, DateTimeOffset maintenant)
    {
        var lu = Lire(tsp, contexte);
        // les points relevés à la lecture concernent un fichier importé : un TSP rédigé a ses propres contrôles (AnalyseBrouillon)
        lu.Warnings.Clear();
        return ConvertisseurTsp.CreerProjet(lu, NomSource, creePar, maintenant, contexte.Date, OrigineProjet.RedactionTsp);
    }

    /// <summary>Calcul complet (synthèse, métrique, ventilation…) du projet que donnerait le lancement.</summary>
    public static ResultatCalcul Calculer(TspSaisi tsp, ClasseurTsp.Contexte contexte, DateTimeOffset maintenant)
    {
        var projet = CreerProjet(tsp, contexte, null, maintenant);
        return MoteurCalcul.Calculer(ConstructeurProjetCalcul.Construire(ConstructeurProjetCalcul.DonneesEnMemoire(projet)), contexte.Date);
    }

    /// <summary>Brouillon à partir d'un TSP importé : tout ce qui se saisit dans un TSP est repris.</summary>
    public static TspSaisi DepuisTsp(TspLu t)
    {
        var f = t.Fiche;
        // les lignes vides du modèle (profil sans nom, sans charge ni planning) ne sont pas reprises
        bool Utilise(int i) =>
            t.Profiles[i].Nom.Trim().Length > 0 || t.Tasks.Any(x => i < x.Charges.Count && x.Charges[i] != 0)
            || (i < t.PlanningRef.Rows.Count && t.PlanningRef.Rows[i].Any(v => v != 0));
        var indices = Enumerable.Range(0, t.Profiles.Count).Where(Utilise).ToList();
        var profils = indices.Select((i, k) => new ProfilSaisi
        {
            Id = $"p{k + 1}", Nom = t.Profiles[i].Nom, Entite = t.Profiles[i].Entite, Tjm = t.Profiles[i].Tjm, Cjm = t.Profiles[i].Cjm,
            Prcs = t.Profiles[i].Prcs, Frais = t.Profiles[i].Frais, Collaborateur = t.Profiles[i].Collaborateur,
        }).ToList();
        var tsp = new TspSaisi
        {
            Fiche = new FicheSaisie
            {
                Client = f.Client ?? "", Projet = f.Projet ?? "", Reference = f.Reference ?? "", Contact = f.Contact ?? "", Agence = f.Agence ?? "",
                ServiceLine = f.ServiceLine ?? "", Directeur = f.Directeur ?? "", ResponsableSL = f.ResponsableSL ?? "", Commercial = f.Commercial ?? "",
                TypeContrat = string.IsNullOrWhiteSpace(f.TypeContrat) ? "Forfait" : f.TypeContrat, Debut = t.Dates.Debut, Fin = t.Dates.FinContrat,
            },
            Remise = t.Remise,
            Profils = profils,
            Taches = t.Tasks.Select((x, k) => new TacheSaisie
            {
                Id = $"t{k + 1}", Axe = x.Id, Lot = x.Lot, Phase = x.Phase, Etape = x.Etape, Libelle = x.Label,
                Charges = ChargesParProfil(x.Charges, indices, profils), Hypothese = x.Hypothese,
                // case « livrable » : la colonne du TSP quand elle est renseignée ; sinon (TSP sans « oui »), d'après le titre,
                // pour qu'un brouillon lancé donne les mêmes livrables qu'un import direct
                Livrable = x.Livrable == "oui" || (!x.LivCol && !x.Section && ReferentielsMetier.DetecterType(x.Label, x.Livrable) == ReferentielsMetier.TypeLivrable),
                Separateur = x.Section,
            }).ToList(),
            Echeances = t.Echeancier.OrderBy(e => e.N).Select((e, k) => new EcheanceSaisie { Id = $"e{k + 1}", Nom = e.Nom, Pct = e.Pct, Mois = e.Mois }).ToList(),
            Achats = t.Achats.Select((a, k) => new AchatSaisi
            {
                Id = $"a{k + 1}", Designation = a.Designation, Type = a.Type, Cu = a.Cu, Qte = a.Qte, Revente = a.Revente, Commentaire = a.Commentaire,
            }).ToList(),
            Prestataires = t.Prestas.Select((p, k) => new PrestataireSaisi
            {
                Id = $"s{k + 1}", Designation = p.Designation, Societe = p.Societe, CoutJour = p.CoutJour, Nbj = p.Nbj, Tjm = p.Tjm, Commentaire = p.Commentaire,
            }).ToList(),
            Frais = t.Frais.Select((x, k) => new FraisSaisi
            {
                Id = $"f{k + 1}", Libelle = x.Libelle, Cu = x.Cu, Qte = x.Qte, Refacture = x.Refacture, Commentaire = x.Commentaire,
            }).ToList(),
            Metrique = t.Metrique.Select(m => new MetriqueSaisie { Etape = m.Etape, Pct = m.Pct }).ToList(),
            Phases = t.Ref.Phases.ToList(),
            Etapes = t.Ref.Etapes.Count > 0 ? t.Ref.Etapes.ToList() : ModeleTsp.Etapes.ToList(),
        };
        for (var k = 0; k < indices.Count; k++)
        {
            if (indices[k] >= t.PlanningRef.Rows.Count) continue;
            var parMois = new Dictionary<string, decimal>();
            var ligne = t.PlanningRef.Rows[indices[k]];
            for (var m = 0; m < t.PlanningRef.Months.Count && m < ligne.Count; m++)
                if (ligne[m] != 0) parMois[t.PlanningRef.Months[m]] = ligne[m];
            if (parMois.Count > 0) tsp.Planning[profils[k].Id] = parMois;
        }
        return tsp;
    }

    /// <summary>
    /// Brouillon à partir du TSP vendu d'un projet existant : profils et prix, tâches et charges vendues, échéancier (sans les mois),
    /// budgets d'achats et de frais, listes. Ni dates, ni planning, ni suivi (consommé, statuts, ajouts, équipe).
    /// </summary>
    public static TspSaisi DepuisProjet(ConstructeurProjetCalcul.DonneesProjet d, string client, string projet, string? reference)
    {
        var p = d.Projet;
        var vendus = d.Profils.Where(x => x.Origine == OrigineElement.Tsp).ToList();
        var profils = vendus.Select((x, i) => new ProfilSaisi
        {
            Id = $"p{i + 1}", Nom = x.Nom, Entite = x.Entite, Tjm = x.Tjm, Cjm = x.Cjm, Prcs = x.Prcs, Frais = x.Frais,
        }).ToList();
        var idProfil = vendus.Select((x, i) => (x.Id, profils[i].Id)).ToDictionary(x => x.Item1, x => x.Item2);
        var charges = d.Charges.ToLookup(c => c.TacheId);
        var tsp = ModeleTsp.Vierge(client, projet, reference);
        tsp.Fiche.Contact = p.ContactClient ?? "";
        tsp.Fiche.Agence = p.Agence ?? "";
        tsp.Fiche.ServiceLine = p.ServiceLine ?? "";
        tsp.Fiche.Directeur = p.Directeur ?? "";
        tsp.Fiche.ResponsableSL = p.ResponsableSL ?? "";
        tsp.Fiche.Commercial = p.Commercial ?? "";
        tsp.Fiche.TypeContrat = string.IsNullOrWhiteSpace(p.TypeContrat) ? "Forfait" : p.TypeContrat;
        tsp.Remise = p.Remise;
        tsp.Profils = profils;
        tsp.Taches = d.Taches.Where(t => t.Origine == OrigineElement.Tsp).Select((t, k) => new TacheSaisie
        {
            Id = $"t{k + 1}", Axe = t.CodeAxeTsp, Lot = t.LotTsp, Phase = t.PhaseTsp, Etape = t.EtapeTsp, Libelle = t.LibelleTsp,
            Charges = charges[t.Id].Where(c => c.ChargeVendue != 0 && idProfil.ContainsKey(c.ProfilProjetId))
                .GroupBy(c => idProfil[c.ProfilProjetId]).ToDictionary(g => g.Key, g => g.Sum(c => c.ChargeVendue)),
            Livrable = t.MarqueurLivrable == "oui", Hypothese = t.Hypothese, Separateur = t.EstSection,
        }).ToList();
        tsp.Echeances = d.Echeances.OrderBy(e => e.Numero).Select((e, k) => new EcheanceSaisie { Id = $"e{k + 1}", Nom = e.Nom, Pct = e.Pourcentage }).ToList();
        tsp.Achats = d.BudgetAchats.Select((a, k) => new AchatSaisi
        {
            Id = $"a{k + 1}", Designation = a.Designation, Type = a.Type, Cu = a.CoutUnitaire, Qte = a.Quantite, Revente = a.Revente, Commentaire = a.Commentaire,
        }).ToList();
        tsp.Prestataires = d.Prestataires.Select((x, k) => new PrestataireSaisi
        {
            Id = $"s{k + 1}", Designation = x.Designation, Societe = x.Societe, CoutJour = x.CoutJour, Nbj = x.NombreJours, Tjm = x.Tjm, Commentaire = x.Commentaire,
        }).ToList();
        tsp.Frais = d.BudgetFrais.Select((x, k) => new FraisSaisi
        {
            Id = $"f{k + 1}", Libelle = x.Libelle, Cu = x.CoutUnitaire, Qte = x.Quantite, Refacture = x.Refacture, Commentaire = x.Commentaire,
        }).ToList();
        if (d.Metriques.Count > 0) tsp.Metrique = d.Metriques.Select(m => new MetriqueSaisie { Etape = m.Etape, Pct = m.Pourcentage }).ToList();
        var phases = d.Phases.Where(x => x.ListeReference).Select(x => x.Code).ToList();
        if (phases.Count > 0) tsp.Phases = phases;
        if (d.Etapes.Count > 0) tsp.Etapes = d.Etapes.Select(x => x.Libelle).ToList();
        return tsp;
    }

    /// <summary>Charges d'une ligne du TSP (par position de profil) rattachées aux profils repris (par identifiant).</summary>
    private static Dictionary<string, decimal> ChargesParProfil(List<decimal> charges, List<int> indices, List<ProfilSaisi> profils)
    {
        var resultat = new Dictionary<string, decimal>();
        for (var k = 0; k < indices.Count; k++)
            if (indices[k] < charges.Count && charges[indices[k]] != 0) resultat[profils[k].Id] = charges[indices[k]];
        return resultat;
    }

    /// <summary>
    /// Le classeur construit par <see cref="ClasseurTsp"/>, vu comme un classeur ouvert : mêmes valeurs que celles que lirait
    /// l'application dans le fichier Excel exporté (nombres en double, cellules vides absentes, valeurs mémorisées des formules).
    /// </summary>
    private sealed class ClasseurEnMemoire(IReadOnlyList<Feuille> feuilles) : IClasseur
    {
        public IReadOnlyList<string> NomsFeuilles { get; } = feuilles.Select(f => f.Nom).ToList();

        public IFeuille? Feuille(string nom)
        {
            var f = feuilles.FirstOrDefault(x => Texte.Norm(x.Nom) == Texte.Norm(nom));
            return f is null ? null : new FeuilleEnMemoire(f);
        }
    }

    private sealed class FeuilleEnMemoire : IFeuille
    {
        private readonly Dictionary<(int, int), object> _cellules = new();

        public FeuilleEnMemoire(Feuille feuille)
        {
            Nom = feuille.Nom;
            for (var r = 0; r < feuille.Lignes.Count; r++)
            {
                var ligne = feuille.Lignes[r];
                if (ligne is null) continue;
                for (var c = 0; c < ligne.Count; c++)
                {
                    var brute = ligne[c] is Cellule cellule ? cellule.V : ligne[c];
                    var v = brute switch
                    {
                        null => null,
                        string s when s.Length == 0 => null,
                        string s => s,
                        decimal d => (object)(double)d,
                        int i => (double)i,
                        long l => (double)l,
                        double x => x,
                        bool b => b,
                        _ => brute.ToString(),
                    };
                    if (v is null) continue;
                    _cellules[(r, c)] = v;
                    if (r > MaxRow) MaxRow = r;
                    if (c > MaxCol) MaxCol = c;
                }
            }
        }

        public string Nom { get; }
        public int MaxRow { get; }
        public int MaxCol { get; }

        public object? G(int ligne, int colonne) => _cellules.GetValueOrDefault((ligne, colonne));
    }
}
