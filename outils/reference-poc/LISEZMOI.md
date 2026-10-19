# Moteur de la version de référence (version HTML du 18/10/2026)

Ce dossier contient le cœur de la version de référence (fichiers `poc/core.js` et `poc/xlsx-lite.js`, copiés tels quels de `src/40-moteur.js` et `src/30-xlsx-lite.js` de la version HTML du 18/10/2026) et les scripts qui en tirent les **résultats attendus** des tests du serveur. Jusqu'au 11/10/2026, la référence était le POC v65 ; les règles décidées depuis dans la version HTML (avancement, risques, prévisionnel, planning, colonne Livrable…) sont décrites dans `docs/regles-metier.md`.

| Fichier | Rôle |
|---|---|
| `poc/core.js` | Lecture du TSP (`parseTSP`) et moteur de calcul (`compute`) du POC — **ne pas modifier**, sauf écart volontaire documenté (voir plus bas) : c'est la spécification |
| `poc/xlsx-lite.js` | Lecture des fichiers Excel du POC |
| `loadcore.cjs` | Charge le moteur dans Node.js, avec une date du jour fixe (`TODAY`, par défaut 2026-10-06) |
| `scenarios.cjs` | Construit les scénarios (entrée + résultats attendus) dans `backend/tests/Donnees` |
| `anonymise.py` | Fabrique une copie anonymisée d'un TSP réel (noms remplacés, macros retirées, valeurs conservées) |

## Régénérer les résultats attendus

Prérequis : Node.js 22.

```bash
TODAY=2026-10-06 node outils/reference-poc/scenarios.cjs
```

L'intégration continue refait ce calcul à chaque envoi et vérifie que les fichiers du dépôt n'ont pas été modifiés à la main.

## Ajouter un cas de test

1. Ajouter (ou compléter) un scénario dans `scenarios.cjs` : on part d'un TSP lu par le POC et on ajoute des saisies (consommé, statuts, annulations…).
2. Régénérer les fichiers.
3. Ajouter le nom du scénario dans `MoteurCalculReferenceTests` (projet `PilotageForfaits.Domain.Tests`).

## Faire évoluer une règle de calcul

Si une règle doit changer par rapport au POC, on ne modifie pas `core.js` : on documente la nouvelle règle dans `docs/regles-metier.md`, on écrit un test dédié dans `PilotageForfaits.Domain.Tests`, puis on adapte le moteur C#. Les scénarios de référence concernés sont alors mis à jour en connaissance de cause.

Depuis le 18/10/2026, `core.js` est le moteur de la version HTML, où les règles sont décidées : il n'y a plus d'écart volontaire à reporter. Une règle nouvelle est d'abord faite dans la version HTML, puis `core.js` est recopié et les scénarios régénérés (la règle des frais du 09/10/2026, un temps notée « écart volontaire à la v65 », en fait partie).
