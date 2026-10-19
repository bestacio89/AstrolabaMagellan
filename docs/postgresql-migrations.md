# PostgreSQL et migrations EF Core

PostgreSQL est le fournisseur relationnel de référence. Le schéma doit être créé et faire évoluer exclusivement au moyen de migrations EF Core ; `EnsureCreated` est interdit.

## État de la migration initiale

La migration initiale `20261019121926_Postgresqlmigration` et le modèle instantané sont maintenant versionnés sous `src/PilotageForfaits.Infrastructure/Migrations`. Ils ont été générés avec Npgsql, et les index spécifiques à SQL Server ont été corrigés pour PostgreSQL. La migration reste à valider sur une base PostgreSQL vierge : compilation, génération du script SQL, application de la migration et tests de persistance doivent réussir avant fusion. Ne pas créer une migration SQL Server puis la réutiliser : les types, séquences, identifiants et annotations de fournisseur diffèrent.

## Préparer un environnement local

1. Installer le SDK .NET 10 et Docker Desktop.
2. À la racine du dépôt, lancer `docker compose up -d` et attendre que le contrôle de santé PostgreSQL soit vert.
3. Vérifier la chaîne `ConnectionStrings: Pilotage` dans `backend/src/PilotageForfaits.Api/appsettings.Development.json`. Ne jamais copier les identifiants locaux dans un environnement partagé.
4. Depuis `backend`, restaurer et compiler la solution, puis appliquer la migration versionnée.

## Générer la migration initiale

Depuis le dossier `backend`, exécuter :

```powershell
dotnet tool restore
dotnet ef migrations add InitialPostgreSql --project src/PilotageForfaits.Infrastructure --startup-project src/PilotageForfaits.Api --output-dir Donnees/Migrations
```

Le dépôt fournit déjà un manifeste d'outils local dans `backend/.config/dotnet-tools.json` avec `dotnet-ef` aligné sur EF Core 10. Restaurer cet outil via `dotnet tool restore` ; ne pas dépendre d'une installation globale non documentée.

Ensuite :

```powershell
dotnet build PilotageForfaits.sln
dotnet test PilotageForfaits.sln
dotnet ef migrations script --project src/PilotageForfaits.Infrastructure --startup-project src/PilotageForfaits.Api
```

Inspecter la migration et le script SQL généré. Vérifier notamment les clés étrangères, index, colonnes décimales (précision 18, échelle 6), enums stockés en texte, propriétés possédées, jetons de concurrence, noms de tables/colonnes et comportements de suppression. La migration doit être reproductible sur une base PostgreSQL vide.

## Critères d'acceptation

- Une migration initiale PostgreSQL et son modèle instantané sont versionnés.
- Une base PostgreSQL vide est créée uniquement via `Database.MigrateAsync()`.
- Une deuxième exécution de l'API n'altère pas le schéma et n'échoue pas.
- Les tests d'intégration vérifient création, lecture, modification, concurrence et contraintes relationnelles sur PostgreSQL réel.
- Aucune référence runtime à `UseSqlServer`, aucun conteneur SQL Server et aucune initialisation de schéma via `EnsureCreated` ne subsistent.
- Le build et tous les tests passent dans CI avec PostgreSQL comme service.

La branche reste en brouillon tant que ces critères ne sont pas satisfaits.
