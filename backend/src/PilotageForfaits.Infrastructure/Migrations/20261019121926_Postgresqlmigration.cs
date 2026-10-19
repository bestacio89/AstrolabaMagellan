using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PilotageForfaits.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Postgresqlmigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Utilisateurs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IdentifiantExterne = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Prenom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Actif = table.Column<bool>(type: "boolean", nullable: false),
                    Administrateur = table.Column<bool>(type: "boolean", nullable: false),
                    CreeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DerniereConnexion = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Utilisateurs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Absences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonneCle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PersonneNom = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UtilisateurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Jour = table.Column<DateOnly>(type: "date", nullable: false),
                    Moment = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SaisieLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SaisieParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Absences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Absences_Utilisateurs_SaisieParId",
                        column: x => x.SaisieParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Absences_Utilisateurs_UtilisateurId",
                        column: x => x.UtilisateurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BrouillonsProjet",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Client = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Reference = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Origine = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Source = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Contenu = table.Column<string>(type: "text", nullable: false),
                    CreeParId = table.Column<Guid>(type: "uuid", nullable: false),
                    CoRedacteurId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifieLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifieParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BrouillonsProjet", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BrouillonsProjet_Utilisateurs_CoRedacteurId",
                        column: x => x.CoRedacteurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BrouillonsProjet_Utilisateurs_CreeParId",
                        column: x => x.CreeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BrouillonsProjet_Utilisateurs_ModifieParId",
                        column: x => x.ModifieParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Projets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Client = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Reference = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CleUnicite = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Agence = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    ServiceLine = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Directeur = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    ResponsableSL = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Commercial = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    ContactClient = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    TypeContrat = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Debut = table.Column<DateOnly>(type: "date", nullable: true),
                    FinContractuelle = table.Column<DateOnly>(type: "date", nullable: true),
                    FinPrevue = table.Column<DateOnly>(type: "date", nullable: true),
                    Remise = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    RemiseSaisie = table.Column<bool>(type: "boolean", nullable: false),
                    CaInitial = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    PctPilotage = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    PctProvision = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    Origine = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Parametres_Regroupement = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Parametres_PremierMois = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    Parametres_NombreMois = table.Column<int>(type: "integer", nullable: false),
                    Parametres_AlerteActionsJours = table.Column<int>(type: "integer", nullable: true),
                    Parametres_AlerteEcheancesJours = table.Column<int>(type: "integer", nullable: true),
                    Parametres_AlerteAteliersJours = table.Column<int>(type: "integer", nullable: true),
                    Parametres_AlerteLivrablesJours = table.Column<int>(type: "integer", nullable: true),
                    Parametres_DernierCoproj = table.Column<DateOnly>(type: "date", nullable: true),
                    Parametres_Instances = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Projets_Utilisateurs_CreeParId",
                        column: x => x.CreeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Axes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Axes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Axes_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BudgetsAchat",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Designation = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Type = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    CoutUnitaire = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Quantite = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Revente = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetsAchat", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BudgetsAchat_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BudgetsFrais",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    CoutUnitaire = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Quantite = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Refacture = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetsFrais", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BudgetsFrais_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChampsFiche",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Valeur = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Cle = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChampsFiche", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChampsFiche_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DatesPlanning",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Cle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Debut = table.Column<DateOnly>(type: "date", nullable: true),
                    Fin = table.Column<DateOnly>(type: "date", nullable: true),
                    Nom = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatesPlanning", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DatesPlanning_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Decisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Instance = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Libelle = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Decideur = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Impact = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreeeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Decisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Decisions_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Decisions_Utilisateurs_CreeeParId",
                        column: x => x.CreeeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Echeances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Numero = table.Column<int>(type: "integer", nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Pourcentage = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    MoisTsp = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    DatePrevue = table.Column<DateOnly>(type: "date", nullable: true),
                    FactureeLe = table.Column<DateOnly>(type: "date", nullable: true),
                    PayeeLe = table.Column<DateOnly>(type: "date", nullable: true),
                    MontantFacture = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Echeances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Echeances_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ElementsPlanning",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nature = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Cle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElementsPlanning", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ElementsPlanning_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Etapes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Etapes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Etapes_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GrillesAgence",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Profil = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    TjmParis = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    CjmParis = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    TjmRegion = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    CjmRegion = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GrillesAgence", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GrillesAgence_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Habilitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UtilisateurId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Depuis = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AccordeeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Habilitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Habilitations_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Habilitations_Utilisateurs_AccordeeParId",
                        column: x => x.AccordeeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Habilitations_Utilisateurs_UtilisateurId",
                        column: x => x.UtilisateurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ImportsFrais",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    NomFichier = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    ImporteLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ImporteParId = table.Column<Guid>(type: "uuid", nullable: true),
                    NombreLignes = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportsFrais", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportsFrais_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ImportsFrais_Utilisateurs_ImporteParId",
                        column: x => x.ImporteParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ImportsTsp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NomFichier = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    ImporteLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ImporteParId = table.Column<Guid>(type: "uuid", nullable: true),
                    PointsReleves = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SourcePlanning = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    SourcePlanningPhases = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    MasquesParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportsTsp", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportsTsp_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ImportsTsp_Utilisateurs_ImporteParId",
                        column: x => x.ImporteParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ImportsTsp_Utilisateurs_MasquesParId",
                        column: x => x.MasquesParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Jalons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Debut = table.Column<DateOnly>(type: "date", nullable: false),
                    Fin = table.Column<DateOnly>(type: "date", nullable: true),
                    AConfirmer = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Jalons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Jalons_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Journal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Le = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UtilisateurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Objet = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    ObjetId = table.Column<Guid>(type: "uuid", nullable: true),
                    Champ = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    AncienneValeur = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    NouvelleValeur = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Journal", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Journal_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Journal_Utilisateurs_UtilisateurId",
                        column: x => x.UtilisateurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Metriques",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Etape = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Pourcentage = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Metriques", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Metriques_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DestinataireId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nature = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ObjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    DateCible = table.Column<DateOnly>(type: "date", nullable: false),
                    EnvoyeeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    StatutEnvoi = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Notifications_Utilisateurs_DestinataireId",
                        column: x => x.DestinataireId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PersonnesAjoutees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nom = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Cle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonnesAjoutees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PersonnesAjoutees_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Phases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    ListeReference = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Phases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Phases_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhotosIndicateurs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Nature = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Prevu = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Consomme = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    ResteAFaire = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Atterrissage = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    CoutFinal = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Marge = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    MargeNette = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    TauxMargeNette = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    FinPrevue = table.Column<DateOnly>(type: "date", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotosIndicateurs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhotosIndicateurs_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlanningsVendusPhase",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Phase = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    CjmSaisi = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanningsVendusPhase", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanningsVendusPhase_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlansReference",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FigeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlansReference", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlansReference_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlansReference_Utilisateurs_FigeParId",
                        column: x => x.FigeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PointsHebdo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Cle = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Contenu = table.Column<string>(type: "text", nullable: false),
                    MajLe = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointsHebdo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PointsHebdo_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PointsHebdo_Utilisateurs_ParId",
                        column: x => x.ParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Prestataires",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Designation = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Societe = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    CoutJour = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    NombreJours = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Tjm = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Prestataires", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Prestataires_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProfilsProjet",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Rang = table.Column<int>(type: "integer", nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Entite = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Tjm = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Cjm = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Prcs = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    Frais = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Collaborateur = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    UtilisateurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Origine = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    AjouteLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AjouteParId = table.Column<Guid>(type: "uuid", nullable: true),
                    MotifAjout = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    EstAgentIa = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfilsProjet", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfilsProjet_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProfilsProjet_Utilisateurs_AjouteParId",
                        column: x => x.AjouteParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProfilsProjet_Utilisateurs_UtilisateurId",
                        column: x => x.UtilisateurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TypesTache",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Socle = table.Column<bool>(type: "boolean", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TypesTache", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TypesTache_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ValeursListeIa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Liste = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Libelle = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValeursListeIa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ValeursListeIa_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AchatsReels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LigneBudgetAchatId = table.Column<Guid>(type: "uuid", nullable: true),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Designation = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Fournisseur = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Quantite = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    CoutUnitaire = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Refacture = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AchatsReels", x => x.Id);
                    table.CheckConstraint("CK_AchatsReels_Positifs", "CAST([Quantite] AS FLOAT) > 0 AND CAST([CoutUnitaire] AS FLOAT) >= 0 AND CAST([Refacture] AS FLOAT) >= 0");
                    table.ForeignKey(
                        name: "FK_AchatsReels_BudgetsAchat_LigneBudgetAchatId",
                        column: x => x.LigneBudgetAchatId,
                        principalTable: "BudgetsAchat",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AchatsReels_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AchatsReels_Utilisateurs_CreeParId",
                        column: x => x.CreeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FraisReels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ImportFraisId = table.Column<Guid>(type: "uuid", nullable: true),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Collaborateur = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Categorie = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Libelle = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Montant = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Refacturable = table.Column<bool>(type: "boolean", nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FraisReels", x => x.Id);
                    table.CheckConstraint("CK_FraisReels_Positif", "CAST([Montant] AS FLOAT) > 0");
                    table.ForeignKey(
                        name: "FK_FraisReels_ImportsFrais_ImportFraisId",
                        column: x => x.ImportFraisId,
                        principalTable: "ImportsFrais",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FraisReels_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FraisReels_Utilisateurs_CreeParId",
                        column: x => x.CreeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LiensEcheancePhase",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EcheanceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiensEcheancePhase", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LiensEcheancePhase_Echeances_EcheanceId",
                        column: x => x.EcheanceId,
                        principalTable: "Echeances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiensEcheancePhase_Phases_PhaseId",
                        column: x => x.PhaseId,
                        principalTable: "Phases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LiensEcheancePhase_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlanningsVendusPhaseMois",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanningVenduPhaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mois = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    JoursHomme = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanningsVendusPhaseMois", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanningsVendusPhaseMois_PlanningsVendusPhase_PlanningVendu~",
                        column: x => x.PlanningVenduPhaseId,
                        principalTable: "PlanningsVendusPhase",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlanningsVendusPhaseMois_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DatesPlanReference",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanReferenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Debut = table.Column<DateOnly>(type: "date", nullable: true),
                    Fin = table.Column<DateOnly>(type: "date", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatesPlanReference", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DatesPlanReference_PlansReference_PlanReferenceId",
                        column: x => x.PlanReferenceId,
                        principalTable: "PlansReference",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DatesPlanReference_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlanningsVendusProfil",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfilProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mois = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    JoursHomme = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanningsVendusProfil", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanningsVendusProfil_ProfilsProjet_ProfilProjetId",
                        column: x => x.ProfilProjetId,
                        principalTable: "ProfilsProjet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlanningsVendusProfil_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PrevisionnelsProfil",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfilProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mois = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    JoursHomme = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrevisionnelsProfil", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrevisionnelsProfil_ProfilsProjet_ProfilProjetId",
                        column: x => x.ProfilProjetId,
                        principalTable: "ProfilsProjet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PrevisionnelsProfil_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Taches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Repere = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Origine = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LigneTsp = table.Column<int>(type: "integer", nullable: true),
                    CodeAxeTsp = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LotTsp = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PhaseTsp = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EtapeTsp = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    LibelleTsp = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Hypothese = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    MarqueurLivrable = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EstSection = table.Column<bool>(type: "boolean", nullable: false),
                    ColonneLivrable = table.Column<bool>(type: "boolean", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AxeId = table.Column<Guid>(type: "uuid", nullable: true),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    Lot = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    TypeTacheId = table.Column<Guid>(type: "uuid", nullable: true),
                    TypeSaisi = table.Column<bool>(type: "boolean", nullable: false),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Avancement = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    ResteAFaireSaisi = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    DebutPrevu = table.Column<DateOnly>(type: "date", nullable: true),
                    FinPrevue = table.Column<DateOnly>(type: "date", nullable: true),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ValideeLe = table.Column<DateOnly>(type: "date", nullable: true),
                    IaTypeOptimisation = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    IaCommentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    IaChargeRevisee = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    EcheanceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Taches", x => x.Id);
                    table.CheckConstraint("CK_Taches_Avancement", "[Avancement] IS NULL OR (CAST([Avancement] AS FLOAT) >= 0 AND CAST([Avancement] AS FLOAT) <= 1)");
                    table.ForeignKey(
                        name: "FK_Taches_Axes_AxeId",
                        column: x => x.AxeId,
                        principalTable: "Axes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Taches_Echeances_EcheanceId",
                        column: x => x.EcheanceId,
                        principalTable: "Echeances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Taches_Phases_PhaseId",
                        column: x => x.PhaseId,
                        principalTable: "Phases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Taches_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Taches_TypesTache_TypeTacheId",
                        column: x => x.TypeTacheId,
                        principalTable: "TypesTache",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Actions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Libelle = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Porteur = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    PorteurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Instance = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CreeeLe = table.Column<DateOnly>(type: "date", nullable: false),
                    DateCible = table.Column<DateOnly>(type: "date", nullable: true),
                    Progression = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FaiteLe = table.Column<DateOnly>(type: "date", nullable: true),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreeeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Actions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Actions_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Actions_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Actions_Utilisateurs_CreeeParId",
                        column: x => x.CreeeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Actions_Utilisateurs_PorteurId",
                        column: x => x.PorteurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Ateliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatePlanifiee = table.Column<DateOnly>(type: "date", nullable: true),
                    HeureDebut = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    HeureFin = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    InvitationEnvoyee = table.Column<bool>(type: "boolean", nullable: false),
                    EnvoyeeLe = table.Column<DateOnly>(type: "date", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ateliers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Ateliers_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Ateliers_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChargesTache",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfilProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChargeVendue = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    ChargeAjoutee = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    MotifAjout = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AjouteeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AjouteeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChargesTache", x => x.Id);
                    table.CheckConstraint("CK_ChargesTache_Positives", "CAST([ChargeVendue] AS FLOAT) >= 0 AND CAST([ChargeAjoutee] AS FLOAT) >= 0");
                    table.ForeignKey(
                        name: "FK_ChargesTache_ProfilsProjet_ProfilProjetId",
                        column: x => x.ProfilProjetId,
                        principalTable: "ProfilsProjet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChargesTache_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChargesTache_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChargesTache_Utilisateurs_AjouteeParId",
                        column: x => x.AjouteeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Consommes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfilProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Jour = table.Column<DateOnly>(type: "date", nullable: false),
                    JoursHomme = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    SaisiLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SaisiParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Consommes", x => x.Id);
                    table.CheckConstraint("CK_Consommes_Positif", "CAST([JoursHomme] AS FLOAT) > 0");
                    table.ForeignKey(
                        name: "FK_Consommes_ProfilsProjet_ProfilProjetId",
                        column: x => x.ProfilProjetId,
                        principalTable: "ProfilsProjet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Consommes_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Consommes_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Consommes_Utilisateurs_SaisiParId",
                        column: x => x.SaisiParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EvolutionsPerimetre",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfilProjetId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProfilSourceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nature = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Le = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ParId = table.Column<Guid>(type: "uuid", nullable: true),
                    Motif = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AvenantReduction = table.Column<bool>(type: "boolean", nullable: false),
                    JoursHomme = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    DecisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvolutionsPerimetre", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvolutionsPerimetre_Decisions_DecisionId",
                        column: x => x.DecisionId,
                        principalTable: "Decisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvolutionsPerimetre_ProfilsProjet_ProfilProjetId",
                        column: x => x.ProfilProjetId,
                        principalTable: "ProfilsProjet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvolutionsPerimetre_ProfilsProjet_ProfilSourceId",
                        column: x => x.ProfilSourceId,
                        principalTable: "ProfilsProjet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvolutionsPerimetre_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvolutionsPerimetre_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvolutionsPerimetre_Utilisateurs_ParId",
                        column: x => x.ParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LignesPlanReference",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanReferenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    DebutPrevu = table.Column<DateOnly>(type: "date", nullable: true),
                    FinPrevue = table.Column<DateOnly>(type: "date", nullable: true),
                    ChargePrevue = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Cause = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Motif = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LignesPlanReference", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LignesPlanReference_PlansReference_PlanReferenceId",
                        column: x => x.PlanReferenceId,
                        principalTable: "PlansReference",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LignesPlanReference_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LignesPlanReference_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Livrables",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValideParClientLe = table.Column<DateOnly>(type: "date", nullable: true),
                    LienStockage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Livrables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Livrables_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Livrables_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MisesAJourTache",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    Le = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AuteurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Texte = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MisesAJourTache", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MisesAJourTache_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MisesAJourTache_Taches_TacheId",
                        column: x => x.TacheId,
                        principalTable: "Taches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MisesAJourTache_Utilisateurs_AuteurId",
                        column: x => x.AuteurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Risques",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Libelle = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Probabilite = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Impact = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Cause = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Parade = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Plan = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Responsable = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Statut = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Commentaire = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreeLe = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreeParId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Risques", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Risques_Actions_ActionId",
                        column: x => x.ActionId,
                        principalTable: "Actions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Risques_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Risques_Utilisateurs_CreeParId",
                        column: x => x.CreeParId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Destinataires",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AtelierId = table.Column<Guid>(type: "uuid", nullable: false),
                    NomOuEmail = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    UtilisateurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Destinataires", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Destinataires_Ateliers_AtelierId",
                        column: x => x.AtelierId,
                        principalTable: "Ateliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Destinataires_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Destinataires_Utilisateurs_UtilisateurId",
                        column: x => x.UtilisateurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Absences_PersonneCle_Jour",
                table: "Absences",
                columns: new[] { "PersonneCle", "Jour" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Absences_SaisieParId",
                table: "Absences",
                column: "SaisieParId");

            migrationBuilder.CreateIndex(
                name: "IX_Absences_UtilisateurId",
                table: "Absences",
                column: "UtilisateurId");

            migrationBuilder.CreateIndex(
                name: "IX_AchatsReels_CreeParId",
                table: "AchatsReels",
                column: "CreeParId");

            migrationBuilder.CreateIndex(
                name: "IX_AchatsReels_LigneBudgetAchatId",
                table: "AchatsReels",
                column: "LigneBudgetAchatId");

            migrationBuilder.CreateIndex(
                name: "IX_AchatsReels_ProjetId",
                table: "AchatsReels",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Actions_CreeeParId",
                table: "Actions",
                column: "CreeeParId");

            migrationBuilder.CreateIndex(
                name: "IX_Actions_PorteurId",
                table: "Actions",
                column: "PorteurId");

            migrationBuilder.CreateIndex(
                name: "IX_Actions_ProjetId",
                table: "Actions",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Actions_ProjetId_Reference",
                table: "Actions",
                columns: new[] { "ProjetId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Actions_TacheId",
                table: "Actions",
                column: "TacheId");

            migrationBuilder.CreateIndex(
                name: "IX_Ateliers_ProjetId",
                table: "Ateliers",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Ateliers_TacheId",
                table: "Ateliers",
                column: "TacheId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Axes_ProjetId",
                table: "Axes",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Axes_ProjetId_Code",
                table: "Axes",
                columns: new[] { "ProjetId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BrouillonsProjet_CoRedacteurId",
                table: "BrouillonsProjet",
                column: "CoRedacteurId");

            migrationBuilder.CreateIndex(
                name: "IX_BrouillonsProjet_CreeParId",
                table: "BrouillonsProjet",
                column: "CreeParId");

            migrationBuilder.CreateIndex(
                name: "IX_BrouillonsProjet_ModifieParId",
                table: "BrouillonsProjet",
                column: "ModifieParId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetsAchat_ProjetId",
                table: "BudgetsAchat",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetsFrais_ProjetId",
                table: "BudgetsFrais",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ChampsFiche_ProjetId",
                table: "ChampsFiche",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ChargesTache_AjouteeParId",
                table: "ChargesTache",
                column: "AjouteeParId");

            migrationBuilder.CreateIndex(
                name: "IX_ChargesTache_ProfilProjetId",
                table: "ChargesTache",
                column: "ProfilProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ChargesTache_ProjetId",
                table: "ChargesTache",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ChargesTache_TacheId_ProfilProjetId",
                table: "ChargesTache",
                columns: new[] { "TacheId", "ProfilProjetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Consommes_ProfilProjetId_Jour",
                table: "Consommes",
                columns: new[] { "ProfilProjetId", "Jour" });

            migrationBuilder.CreateIndex(
                name: "IX_Consommes_ProjetId",
                table: "Consommes",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Consommes_SaisiParId",
                table: "Consommes",
                column: "SaisiParId");

            migrationBuilder.CreateIndex(
                name: "IX_Consommes_TacheId_ProfilProjetId_Jour",
                table: "Consommes",
                columns: new[] { "TacheId", "ProfilProjetId", "Jour" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatesPlanning_ProjetId",
                table: "DatesPlanning",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_DatesPlanning_ProjetId_Cle",
                table: "DatesPlanning",
                columns: new[] { "ProjetId", "Cle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatesPlanReference_PlanReferenceId_Cle",
                table: "DatesPlanReference",
                columns: new[] { "PlanReferenceId", "Cle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatesPlanReference_ProjetId",
                table: "DatesPlanReference",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Decisions_CreeeParId",
                table: "Decisions",
                column: "CreeeParId");

            migrationBuilder.CreateIndex(
                name: "IX_Decisions_ProjetId",
                table: "Decisions",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Decisions_ProjetId_Reference",
                table: "Decisions",
                columns: new[] { "ProjetId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Destinataires_AtelierId",
                table: "Destinataires",
                column: "AtelierId");

            migrationBuilder.CreateIndex(
                name: "IX_Destinataires_ProjetId",
                table: "Destinataires",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Destinataires_UtilisateurId",
                table: "Destinataires",
                column: "UtilisateurId");

            migrationBuilder.CreateIndex(
                name: "IX_Echeances_ProjetId",
                table: "Echeances",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Echeances_ProjetId_Numero",
                table: "Echeances",
                columns: new[] { "ProjetId", "Numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ElementsPlanning_ProjetId",
                table: "ElementsPlanning",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ElementsPlanning_ProjetId_Nature_Cle",
                table: "ElementsPlanning",
                columns: new[] { "ProjetId", "Nature", "Cle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Etapes_ProjetId",
                table: "Etapes",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_EvolutionsPerimetre_DecisionId",
                table: "EvolutionsPerimetre",
                column: "DecisionId");

            migrationBuilder.CreateIndex(
                name: "IX_EvolutionsPerimetre_ParId",
                table: "EvolutionsPerimetre",
                column: "ParId");

            migrationBuilder.CreateIndex(
                name: "IX_EvolutionsPerimetre_ProfilProjetId",
                table: "EvolutionsPerimetre",
                column: "ProfilProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_EvolutionsPerimetre_ProfilSourceId",
                table: "EvolutionsPerimetre",
                column: "ProfilSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_EvolutionsPerimetre_ProjetId",
                table: "EvolutionsPerimetre",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_EvolutionsPerimetre_TacheId",
                table: "EvolutionsPerimetre",
                column: "TacheId");

            migrationBuilder.CreateIndex(
                name: "IX_FraisReels_CreeParId",
                table: "FraisReels",
                column: "CreeParId");

            migrationBuilder.CreateIndex(
                name: "IX_FraisReels_ImportFraisId",
                table: "FraisReels",
                column: "ImportFraisId");

            migrationBuilder.CreateIndex(
                name: "IX_FraisReels_ProjetId",
                table: "FraisReels",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_GrillesAgence_ProjetId",
                table: "GrillesAgence",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Habilitations_AccordeeParId",
                table: "Habilitations",
                column: "AccordeeParId");

            migrationBuilder.CreateIndex(
                name: "IX_Habilitations_ProjetId",
                table: "Habilitations",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Habilitations_UtilisateurId_ProjetId",
                table: "Habilitations",
                columns: new[] { "UtilisateurId", "ProjetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImportsFrais_ImporteParId",
                table: "ImportsFrais",
                column: "ImporteParId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportsFrais_ProjetId",
                table: "ImportsFrais",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportsTsp_ImporteParId",
                table: "ImportsTsp",
                column: "ImporteParId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportsTsp_MasquesParId",
                table: "ImportsTsp",
                column: "MasquesParId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportsTsp_ProjetId",
                table: "ImportsTsp",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Jalons_ProjetId",
                table: "Jalons",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Journal_ProjetId",
                table: "Journal",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Journal_ProjetId_Le",
                table: "Journal",
                columns: new[] { "ProjetId", "Le" });

            migrationBuilder.CreateIndex(
                name: "IX_Journal_UtilisateurId",
                table: "Journal",
                column: "UtilisateurId");

            migrationBuilder.CreateIndex(
                name: "IX_LiensEcheancePhase_EcheanceId",
                table: "LiensEcheancePhase",
                column: "EcheanceId");

            migrationBuilder.CreateIndex(
                name: "IX_LiensEcheancePhase_PhaseId",
                table: "LiensEcheancePhase",
                column: "PhaseId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LiensEcheancePhase_ProjetId",
                table: "LiensEcheancePhase",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_LignesPlanReference_PlanReferenceId_TacheId",
                table: "LignesPlanReference",
                columns: new[] { "PlanReferenceId", "TacheId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LignesPlanReference_ProjetId",
                table: "LignesPlanReference",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_LignesPlanReference_TacheId",
                table: "LignesPlanReference",
                column: "TacheId");

            migrationBuilder.CreateIndex(
                name: "IX_Livrables_ProjetId",
                table: "Livrables",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Livrables_TacheId",
                table: "Livrables",
                column: "TacheId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Metriques_ProjetId",
                table: "Metriques",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_MisesAJourTache_AuteurId",
                table: "MisesAJourTache",
                column: "AuteurId");

            migrationBuilder.CreateIndex(
                name: "IX_MisesAJourTache_ProjetId",
                table: "MisesAJourTache",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_MisesAJourTache_TacheId",
                table: "MisesAJourTache",
                column: "TacheId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_DestinataireId",
                table: "Notifications",
                column: "DestinataireId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ProjetId",
                table: "Notifications",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_StatutEnvoi_DateCible",
                table: "Notifications",
                columns: new[] { "StatutEnvoi", "DateCible" });

            migrationBuilder.CreateIndex(
                name: "IX_PersonnesAjoutees_ProjetId",
                table: "PersonnesAjoutees",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PersonnesAjoutees_ProjetId_Cle",
                table: "PersonnesAjoutees",
                columns: new[] { "ProjetId", "Cle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Phases_ProjetId",
                table: "Phases",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Phases_ProjetId_Code",
                table: "Phases",
                columns: new[] { "ProjetId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhotosIndicateurs_ProjetId",
                table: "PhotosIndicateurs",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotosIndicateurs_ProjetId_Date_Nature",
                table: "PhotosIndicateurs",
                columns: new[] { "ProjetId", "Date", "Nature" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanningsVendusPhase_ProjetId",
                table: "PlanningsVendusPhase",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanningsVendusPhaseMois_PlanningVenduPhaseId_Mois",
                table: "PlanningsVendusPhaseMois",
                columns: new[] { "PlanningVenduPhaseId", "Mois" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanningsVendusPhaseMois_ProjetId",
                table: "PlanningsVendusPhaseMois",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanningsVendusProfil_ProfilProjetId_Mois",
                table: "PlanningsVendusProfil",
                columns: new[] { "ProfilProjetId", "Mois" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanningsVendusProfil_ProjetId",
                table: "PlanningsVendusProfil",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PlansReference_FigeParId",
                table: "PlansReference",
                column: "FigeParId");

            migrationBuilder.CreateIndex(
                name: "IX_PlansReference_ProjetId",
                table: "PlansReference",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PointsHebdo_ParId",
                table: "PointsHebdo",
                column: "ParId");

            migrationBuilder.CreateIndex(
                name: "IX_PointsHebdo_ProjetId",
                table: "PointsHebdo",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PointsHebdo_ProjetId_Cle",
                table: "PointsHebdo",
                columns: new[] { "ProjetId", "Cle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Prestataires_ProjetId",
                table: "Prestataires",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_PrevisionnelsProfil_ProfilProjetId_Mois",
                table: "PrevisionnelsProfil",
                columns: new[] { "ProfilProjetId", "Mois" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrevisionnelsProfil_ProjetId",
                table: "PrevisionnelsProfil",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfilsProjet_AjouteParId",
                table: "ProfilsProjet",
                column: "AjouteParId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfilsProjet_ProjetId",
                table: "ProfilsProjet",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfilsProjet_ProjetId_Rang",
                table: "ProfilsProjet",
                columns: new[] { "ProjetId", "Rang" });

            migrationBuilder.CreateIndex(
                name: "IX_ProfilsProjet_UtilisateurId",
                table: "ProfilsProjet",
                column: "UtilisateurId");

            migrationBuilder.CreateIndex(
                name: "IX_Projets_CleUnicite",
                table: "Projets",
                column: "CleUnicite",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Projets_CreeParId",
                table: "Projets",
                column: "CreeParId");

            migrationBuilder.CreateIndex(
                name: "IX_Projets_Statut",
                table: "Projets",
                column: "Statut");

            migrationBuilder.CreateIndex(
                name: "IX_Risques_ActionId",
                table: "Risques",
                column: "ActionId");

            migrationBuilder.CreateIndex(
                name: "IX_Risques_CreeParId",
                table: "Risques",
                column: "CreeParId");

            migrationBuilder.CreateIndex(
                name: "IX_Risques_ProjetId",
                table: "Risques",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Risques_ProjetId_Reference",
                table: "Risques",
                columns: new[] { "ProjetId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Taches_AxeId",
                table: "Taches",
                column: "AxeId");

            migrationBuilder.CreateIndex(
                name: "IX_Taches_EcheanceId",
                table: "Taches",
                column: "EcheanceId");

            migrationBuilder.CreateIndex(
                name: "IX_Taches_PhaseId",
                table: "Taches",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Taches_ProjetId",
                table: "Taches",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Taches_ProjetId_Position",
                table: "Taches",
                columns: new[] { "ProjetId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_Taches_ProjetId_Repere",
                table: "Taches",
                columns: new[] { "ProjetId", "Repere" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Taches_TypeTacheId",
                table: "Taches",
                column: "TypeTacheId");

            migrationBuilder.CreateIndex(
                name: "IX_TypesTache_ProjetId",
                table: "TypesTache",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_TypesTache_ProjetId_Code",
                table: "TypesTache",
                columns: new[] { "ProjetId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Utilisateurs_IdentifiantExterne",
                table: "Utilisateurs",
                column: "IdentifiantExterne",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ValeursListeIa_ProjetId",
                table: "ValeursListeIa",
                column: "ProjetId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Absences");

            migrationBuilder.DropTable(
                name: "AchatsReels");

            migrationBuilder.DropTable(
                name: "BrouillonsProjet");

            migrationBuilder.DropTable(
                name: "BudgetsFrais");

            migrationBuilder.DropTable(
                name: "ChampsFiche");

            migrationBuilder.DropTable(
                name: "ChargesTache");

            migrationBuilder.DropTable(
                name: "Consommes");

            migrationBuilder.DropTable(
                name: "DatesPlanning");

            migrationBuilder.DropTable(
                name: "DatesPlanReference");

            migrationBuilder.DropTable(
                name: "Destinataires");

            migrationBuilder.DropTable(
                name: "ElementsPlanning");

            migrationBuilder.DropTable(
                name: "Etapes");

            migrationBuilder.DropTable(
                name: "EvolutionsPerimetre");

            migrationBuilder.DropTable(
                name: "FraisReels");

            migrationBuilder.DropTable(
                name: "GrillesAgence");

            migrationBuilder.DropTable(
                name: "Habilitations");

            migrationBuilder.DropTable(
                name: "ImportsTsp");

            migrationBuilder.DropTable(
                name: "Jalons");

            migrationBuilder.DropTable(
                name: "Journal");

            migrationBuilder.DropTable(
                name: "LiensEcheancePhase");

            migrationBuilder.DropTable(
                name: "LignesPlanReference");

            migrationBuilder.DropTable(
                name: "Livrables");

            migrationBuilder.DropTable(
                name: "Metriques");

            migrationBuilder.DropTable(
                name: "MisesAJourTache");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "PersonnesAjoutees");

            migrationBuilder.DropTable(
                name: "PhotosIndicateurs");

            migrationBuilder.DropTable(
                name: "PlanningsVendusPhaseMois");

            migrationBuilder.DropTable(
                name: "PlanningsVendusProfil");

            migrationBuilder.DropTable(
                name: "PointsHebdo");

            migrationBuilder.DropTable(
                name: "Prestataires");

            migrationBuilder.DropTable(
                name: "PrevisionnelsProfil");

            migrationBuilder.DropTable(
                name: "Risques");

            migrationBuilder.DropTable(
                name: "ValeursListeIa");

            migrationBuilder.DropTable(
                name: "BudgetsAchat");

            migrationBuilder.DropTable(
                name: "Ateliers");

            migrationBuilder.DropTable(
                name: "Decisions");

            migrationBuilder.DropTable(
                name: "ImportsFrais");

            migrationBuilder.DropTable(
                name: "PlansReference");

            migrationBuilder.DropTable(
                name: "PlanningsVendusPhase");

            migrationBuilder.DropTable(
                name: "ProfilsProjet");

            migrationBuilder.DropTable(
                name: "Actions");

            migrationBuilder.DropTable(
                name: "Taches");

            migrationBuilder.DropTable(
                name: "Axes");

            migrationBuilder.DropTable(
                name: "Echeances");

            migrationBuilder.DropTable(
                name: "Phases");

            migrationBuilder.DropTable(
                name: "TypesTache");

            migrationBuilder.DropTable(
                name: "Projets");

            migrationBuilder.DropTable(
                name: "Utilisateurs");
        }
    }
}
