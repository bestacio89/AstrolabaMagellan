using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PilotageForfaits.Infrastructure.Migrations;

[Migration("20261020213000_FixTacheAvancementCheckConstraint")]
public sealed partial class FixTacheAvancementCheckConstraint : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_Taches_Avancement",
            table: "Taches");

        migrationBuilder.AddCheckConstraint(
            name: "CK_Taches_Avancement",
            table: "Taches",
            sql: "\"Avancement\" IS NULL OR (CAST(\"Avancement\" AS NUMERIC) >= 0 AND CAST(\"Avancement\" AS NUMERIC) <= 1)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_Taches_Avancement",
            table: "Taches");

        migrationBuilder.AddCheckConstraint(
            name: "CK_Taches_Avancement",
            table: "Taches",
            sql: "\"Avancement\" IS NULL OR (\"Avancement\" >= 0 AND \"Avancement\" <= 1)");
    }
}
