using PilotageForfaits.Application.Abstractions;
using PilotageForfaits.Domain.Tsp;

namespace PilotageForfaits.Infrastructure.Excel;

/// <summary>Ouvre le fichier Excel et confie son interprétation au domaine (InterpreteurTsp).</summary>
public sealed class LecteurTsp(IHorloge horloge) : ILecteurTsp
{
    public TspLu Lire(Stream fichier, string nomFichier)
    {
        // copie en mémoire : la lecture d'un ZIP a besoin de se déplacer dans le fichier
        using var copie = new MemoryStream();
        fichier.CopyTo(copie);
        copie.Position = 0;
        var classeur = ClasseurXlsx.Ouvrir(copie);
        return InterpreteurTsp.Interpreter(classeur, nomFichier, horloge.Aujourdhui);
    }
}
