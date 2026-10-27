using System.Text.Json.Nodes;
using PilotageForfaits.Application.Suivi;
using PilotageForfaits.Domain.Entites;

namespace PilotageForfaits.Api.Tests;

public sealed class FiltreVueContributeurTests
{
    [Fact]
    public void Ne_retourne_que_les_taches_et_donnees_associees_aux_profils_de_l_utilisateur()
    {
        var utilisateur = Guid.NewGuid();
        var profils = new[]
        {
            new ProfilProjet { Id = Guid.NewGuid(), UtilisateurId = utilisateur },
            new ProfilProjet { Id = Guid.NewGuid(), UtilisateurId = Guid.NewGuid() }
        };
        var json = JsonNode.Parse("""
        {
          "projet": {
            "profiles": [{"id":"p0"},{"id":"p1"}],
            "tasks": [
              {"uid":"t1","charges":[1,0],"id":"AXE1","lot":"LOT1"},
              {"uid":"t2","charges":[0,2],"id":"AXE2","lot":"LOT2"}
            ],
            "track": {
              "t1":{"consoP":{"0":{"2026-10-05":0.5},"1":{"2026-10-06":1}}},
              "t2":{"consoP":{"1":{"2026-10-07":1}}}
            },
            "misesAJour":{"t1":[],"t2":[]},
            "commentaires":{"t1":[],"t2":[],"act:123":[]},
            "references":[{"lignes":{"t1":{"charge":1},"t2":{"charge":2}}}],
            "planning":{"groupes":{"tache|t1":{},"tache|t2":{},"id|AXE1":{}},"avant":{"tache|t1":true,"tache|t2":true},"masque":{}},
            "planningRef":{"months":["2026-10"],"rows":[[1],[2]]},
            "planningTsp":{"months":["2026-10"],"rows":[[3],[4]]},
            "actions":[{"id":"a1"}],
            "decisions":[{"id":"d1"}],
            "risques":[{"id":"r1"}],
            "journal":[{"champ":"secret"}],
            "fiche":{"champs":[{"key":"budget","value":"secret"}]}
          },
          "modele": {
            "p":[{"i":0,"collaborateur":"Personne A"},{"i":1,"collaborateur":"Personne B"}],
            "tasks":[
              {"uid":"t1","charges":[1,0]},
              {"uid":"t2","charges":[0,2]}
            ]
          }
        }
        """)!.AsObject();

        FiltreVueContributeur.Appliquer(json, profils, utilisateur);

        var projet = json["projet"]!.AsObject();
        var modele = json["modele"]!.AsObject();
        Assert.Single(projet["profiles"]!.AsArray());
        Assert.Equal("p0", projet["profiles"]![0]!["id"]!.GetValue<string>());
        Assert.Single(projet["tasks"]!.AsArray());
        Assert.Equal("t1", projet["tasks"]![0]!["uid"]!.GetValue<string>());
        Assert.Single(modele["tasks"]!.AsArray());
        Assert.Equal("t1", modele["tasks"]![0]!["uid"]!.GetValue<string>());
        Assert.Single(modele["p"]!.AsArray());
        Assert.Equal(0, modele["p"]![0]!["i"]!.GetValue<int>());
        Assert.Equal(1, projet["tasks"]![0]!["charges"]![0]!.GetValue<int>());
        Assert.Single(projet["track"]!.AsObject());
        Assert.True(projet["track"]!["t1"]!["consoP"]!.AsObject().ContainsKey("0"));
        Assert.False(projet["track"]!["t1"]!["consoP"]!.AsObject().ContainsKey("1"));
        Assert.Single(projet["misesAJour"]!.AsObject());
        Assert.Single(projet["commentaires"]!.AsObject());
        Assert.Single(projet["references"]![0]!["lignes"]!.AsObject());
        Assert.Single(projet["planning"]!["groupes"]!.AsObject());
        Assert.Single(projet["planning"]!["avant"]!.AsObject());
        Assert.Single(projet["planningRef"]!["rows"]!.AsArray());
        Assert.Single(projet["planningTsp"]!["rows"]!.AsArray());
        Assert.Empty(projet["actions"]!.AsArray());
        Assert.Empty(projet["decisions"]!.AsArray());
        Assert.Empty(projet["risques"]!.AsArray());
        Assert.Empty(projet["journal"]!.AsArray());
        Assert.Empty(projet["fiche"]!["champs"]!.AsArray());
    }

    [Fact]
    public void Profil_non_lie_a_l_utilisateur_ne_lui_expose_aucune_tache()
    {
        var json = JsonNode.Parse("""
        {
          "projet": {
            "profiles":[{"id":"p0"}],
            "tasks":[{"uid":"t1","charges":[1]}],
            "track":{"t1":{"consoP":{"0":{"2026-10-05":1}}}},
            "misesAJour":{"t1":[]},
            "commentaires":{"t1":[]},
            "actions":[{"id":"a1"}],
            "planning":{"groupes":{"tache|t1":{}}}
          },
          "modele":{"p":[{"i":0}],"tasks":[{"uid":"t1","charges":[1]}]}
        }
        """)!.AsObject();

        FiltreVueContributeur.Appliquer(json,
            [new ProfilProjet { Id = Guid.NewGuid(), UtilisateurId = Guid.NewGuid() }],
            Guid.NewGuid());

        Assert.Empty(json["projet"]!["profiles"]!.AsArray());
        Assert.Empty(json["projet"]!["tasks"]!.AsArray());
        Assert.Empty(json["modele"]!["tasks"]!.AsArray());
        Assert.Empty(json["projet"]!["track"]!.AsObject());
        Assert.Empty(json["projet"]!["actions"]!.AsArray());
    }
}
