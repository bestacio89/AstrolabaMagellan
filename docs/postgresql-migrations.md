# PostgreSQL et migrations EF Core

PostgreSQL est le fournisseur relationnel de référence. Le schéma doit être créé et faire évoluer exclusivement au moyen de migrations EF Core ; `EnsureCreated` est interdit.

## État de la migration initiale

La migration initiale n'est pas encore générée dans ce changement. Elle doit être produite à partir du modèle EF Core courant avec le fournisseur Npgsql, puis relue et testée sur PostgreSQL avant que cette branche puisse être fusionnée. Ne pas créer une migration SQL Server puis la réutiliser : les types, séquences, identifiants et annotations de fournisseur diffèrent.

## Préparer un environnement local

1. Installer le SDK .NET 10 et Docker Desktop.
2. À la racine du dépôt, lancer `docker compose up -d` et attendre que le contrôle de santé PostgreSQL soit vert.
3. Vérifier la chaîne `ConnectionStrings: Pilotage` dans `backend/src/PilotageForfaits.Api/appsettings.Development.json`. Ne jamais copier les identifiants locaux dans un environnement partagé.
4. Depuis `backend`, restaurer puis compiler la solution avant de générer la migration.

## Générer la migration initiale

Depuis le dossier `backend`, exécuter :

```powershell
dotnet tool restore
dotnet ef migrations add InitialPostgreSql --project src/PilotageForfaits.Infrastructure --startup-project src/PilotageForfaits.Api --output-dir Donnees/Migrations
```

Si aucun manifeste d'outils EF Core n'est présent, installer l'outil localement via un manifeste versionné et aligné sur EF Core 10 avant de poursuivre ; ne pas dépendre d'une installation globale non documentée.

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
