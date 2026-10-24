using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PilotageForfaits.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EvolutionsRevueBimensuelle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DateLimite",
                table: "Axes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AxeCode",
                table: "Echeances",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Lots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Nom = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Lots_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Commentaires",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CibleType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CibleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Le = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AuteurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Texte = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ModifieLe = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Commentaires", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Commentaires_Projets_ProjetId",
                        column: x => x.ProjetId,
                        principalTable: "Projets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Commentaires_Utilisateurs_AuteurId",
                        column: x => x.AuteurId,
                        principalTable: "Utilisateurs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Lots_ProjetId",
                table: "Lots",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Lots_ProjetId_Code",
                table: "Lots",
                columns: new[] { "ProjetId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Echeances_ProjetId_AxeCode",
                table: "Echeances",
                columns: new[] { "ProjetId", "AxeCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Commentaires_AuteurId",
                table: "Commentaires",
                column: "AuteurId");

            migrationBuilder.CreateIndex(
                name: "IX_Commentaires_ProjetId",
                table: "Commentaires",
                column: "ProjetId");

            migrationBuilder.CreateIndex(
                name: "IX_Commentaires_ProjetId_CibleType_CibleId_Le",
                table: "Commentaires",
                columns: new[] { "ProjetId", "CibleType", "CibleId", "Le" });

            migrationBuilder.Sql("""
                INSERT INTO "Commentaires" ("Id", "CibleType", "CibleId", "Le", "AuteurId", "Texte", "ModifieLe", "ProjetId", "Version")
                SELECT "Id", 'Tache', "TacheId", "Le", "AuteurId", "Texte", NULL, "ProjetId", "Version"
                FROM "MisesAJourTache";
                """);

            migrationBuilder.DropTable(name: "MisesAJourTache");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MisesAJourTache",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjetId = table.Column<Guid>(type: "uuid", nullable: false),
                    TacheId = table.Column<Guid>(type: "uuid", nullable: false),
                    Le = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AuteurId = table.Column<Guid>(type: "uuid", nullable: true),
                    Texte = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MisesAJourTache", x => x.Id);
                    table.ForeignKey(name: "FK_MisesAJourTache_Projets_ProjetId", column: x => x.ProjetId, principalTable: "Projets", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "FK_MisesAJourTache_Taches_TacheId", column: x => x.TacheId, principalTable: "Taches", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "FK_MisesAJourTache_Utilisateurs_AuteurId", column: x => x.AuteurId, principalTable: "Utilisateurs", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(name: "IX_MisesAJourTache_AuteurId", table: "MisesAJourTache", column: "AuteurId");
            migrationBuilder.CreateIndex(name: "IX_MisesAJourTache_ProjetId", table: "MisesAJourTache", column: "ProjetId");
            migrationBuilder.CreateIndex(name: "IX_MisesAJourTache_TacheId", table: "MisesAJourTache", column: "TacheId");

            migrationBuilder.Sql("""
                INSERT INTO "MisesAJourTache" ("Id", "ProjetId", "TacheId", "Le", "AuteurId", "Texte", "Version")
                SELECT "Id", "ProjetId", "CibleId", "Le", "AuteurId", "Texte", "Version"
                FROM "Commentaires"
                WHERE "CibleType" = 'Tache';
                """);

            migrationBuilder.DropTable(name: "Commentaires");
            migrationBuilder.DropIndex(name: "IX_Echeances_ProjetId_AxeCode", table: "Echeances");
            migrationBuilder.DropColumn(name: "AxeCode", table: "Echeances");
            migrationBuilder.DropTable(name: "Lots");
            migrationBuilder.DropColumn(name: "DateLimite", table: "Axes");
        }
    }
}
