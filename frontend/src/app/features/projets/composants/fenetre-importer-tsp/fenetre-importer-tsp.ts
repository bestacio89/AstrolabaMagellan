import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApercuImport } from '../../../../api/modeles';
import { ProjetsApi } from '../../../../api/projets.api';
import { messageErreur } from '../../../../core/http/erreurs.interceptor';
import { Fenetre } from '../../../../shared/ui/fenetre';
import { Icone } from '../../../../shared/ui/icone';
import { BrouillonsApi } from '../../../brouillons/api/brouillons.api';

type Etape = 'lecture' | 'pret' | 'refuse' | 'import';

/**
 * Fenêtre « Importer un TSP » : lit le fichier choisi (aperçu, sans rien enregistrer) pour vérifier qu'il est importable
 * et que le forfait n'est pas déjà suivi, puis crée un brouillon de projet : le TSP y est relu et complété avant le lancement
 * (les contrôles du TSP sont dans le brouillon, rubrique par rubrique, et dans « Prêt à lancer ? »).
 * Même lecture que la version de référence (faite par l'API).
 */
@Component({
  selector: 'app-fenetre-importer-tsp',
  imports: [RouterLink, Fenetre, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fenetre-importer-tsp.html',
  styleUrl: './fenetre-importer-tsp.scss',
})
export class FenetreImporterTsp {
  private readonly api = inject(ProjetsApi);
  private readonly brouillons = inject(BrouillonsApi);

  /** Fichier choisi : la fenêtre est ouverte tant qu'il y en a un. */
  readonly fichier = input<File | null>(null);
  readonly fermee = output<void>();
  readonly changerFichier = output<void>();
  /** Brouillon créé : son identifiant. */
  readonly importe = output<string>();

  protected readonly etape = signal<Etape>('lecture');
  protected readonly apercu = signal<ApercuImport | null>(null);
  protected readonly erreur = signal('');

  constructor() {
    // à chaque nouveau fichier : lecture de l'aperçu
    effect(() => {
      const fichier = this.fichier();
      if (fichier) untracked(() => this.lire(fichier));
    });
  }

  private async lire(fichier: File): Promise<void> {
    this.etape.set('lecture');
    this.apercu.set(null);
    this.erreur.set('');
    if (!/\.xls[xm]$/i.test(fichier.name)) {
      this.erreur.set('Le TSP doit être un fichier Excel (.xlsx ou .xlsm).');
      this.etape.set('refuse');
      return;
    }
    try {
      this.apercu.set(await firstValueFrom(this.api.apercuTsp(fichier)));
      this.etape.set('pret');
    } catch (e) {
      this.erreur.set(messageErreur(e));
      this.etape.set('refuse');
    }
  }

  protected async importer(): Promise<void> {
    const fichier = this.fichier();
    if (!fichier || this.etape() !== 'pret') return;
    this.etape.set('import');
    try {
      const cree = await firstValueFrom(this.brouillons.importerTsp(fichier));
      this.importe.emit(cree.id);
    } catch (e) {
      this.erreur.set(messageErreur(e));
      this.etape.set('refuse');
    }
  }
}
