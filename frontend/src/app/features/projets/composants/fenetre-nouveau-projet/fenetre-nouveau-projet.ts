import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjetResume } from '../../../../api/modeles';
import { messageErreur } from '../../../../core/http/erreurs.interceptor';
import { Fenetre } from '../../../../shared/ui/fenetre';
import { Icone } from '../../../../shared/ui/icone';
import { BrouillonsApi } from '../../../brouillons/api/brouillons.api';

type Depart = 'rediger' | 'copie';

/**
 * Fenêtre « Nouveau projet » : trois façons de commencer un projet gagné.
 * - importer un TSP Excel (le fichier est repris dans un brouillon, à relire avant de lancer) ;
 * - rédiger le TSP dans l'application (brouillon vierge) ;
 * - repartir du TSP vendu d'un projet existant (structure et prix, sans le suivi).
 * Dans tous les cas, le projet reste un brouillon privé jusqu'à son lancement.
 */
@Component({
  selector: 'app-fenetre-nouveau-projet',
  imports: [Fenetre, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fenetre-nouveau-projet.html',
  styleUrl: './fenetre-nouveau-projet.scss',
})
export class FenetreNouveauProjet {
  private readonly api = inject(BrouillonsApi);

  readonly ouverte = input(false);
  /** Projets dont on peut repartir (ceux dont l'utilisateur voit les prix). */
  readonly projets = input<ProjetResume[]>([]);
  readonly fermee = output<void>();
  /** L'utilisateur choisit d'importer un TSP Excel : le parent ouvre le sélecteur de fichier. */
  readonly importer = output<void>();
  /** Brouillon créé : son identifiant. */
  readonly cree = output<string>();

  protected readonly depart = signal<Depart>('rediger');
  protected readonly client = signal('');
  protected readonly projet = signal('');
  protected readonly reference = signal('');
  protected readonly source = signal('');
  protected readonly envoi = signal(false);
  protected readonly erreur = signal('');
  protected readonly tentative = signal(false);

  protected readonly sources = computed(() => this.projets().filter((p) => p.voitMontants && p.statutCode !== 'Archive'));
  protected readonly manque = computed(() => {
    const m: string[] = [];
    if (!this.client().trim()) m.push('le client');
    if (!this.projet().trim()) m.push('le nom du projet');
    if (this.depart() === 'copie' && !this.source()) m.push('le projet dont repartir');
    return m;
  });

  constructor() {
    // formulaire vierge à chaque ouverture
    effect(() => {
      if (this.ouverte()) {
        this.depart.set('rediger');
        this.client.set('');
        this.projet.set('');
        this.reference.set('');
        this.source.set('');
        this.erreur.set('');
        this.tentative.set(false);
      }
    });
  }

  protected valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected async creer(): Promise<void> {
    this.tentative.set(true);
    if (this.manque().length || this.envoi()) return;
    this.envoi.set(true);
    this.erreur.set('');
    try {
      const cree = await firstValueFrom(
        this.api.creer({
          client: this.client().trim(),
          projet: this.projet().trim(),
          reference: this.reference().trim() || null,
          projetSource: this.depart() === 'copie' ? this.source() : null,
        }),
      );
      this.cree.emit(cree.id);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
