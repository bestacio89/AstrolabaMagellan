import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjetsApi } from '../../../api/projets.api';
import { ProjetResume } from '../../../api/modeles';
import { NavigationService } from '../../../core/layout/navigation';
import { chiffresCles, compter, Filtre, filtrerEtTrier, pointsDesProjets, Tri } from './accueil.logique';

/**
 * État de la page « Mes projets » : les données chargées et les choix de l'utilisateur (filtre, recherche, tri).
 * Les composants d'affichage lisent ces signaux ; ils ne parlent jamais directement à l'API.
 */
@Injectable()
export class AccueilEtat {
  private readonly api = inject(ProjetsApi);
  private readonly nav = inject(NavigationService);

  readonly projets = signal<ProjetResume[]>([]);
  readonly chargement = signal(true);
  readonly enErreur = signal(false);
  readonly filtre = signal<Filtre>('actifs');
  readonly recherche = signal('');
  readonly tri = signal<Tri>('a-traiter');

  readonly compteurs = computed(() => compter(this.projets()));
  readonly chiffres = computed(() => chiffresCles(this.projets()));
  readonly projetsAffiches = computed(() => filtrerEtTrier(this.projets(), this.filtre(), this.recherche(), this.tri()));
  readonly pointsATraiter = computed(() => pointsDesProjets(this.projets()));
  readonly nombrePointsATraiter = computed(() =>
    this.projets().filter((p) => p.statutCode === 'EnCours' || p.statutCode === 'EnPreparation').reduce((n, p) => n + p.nombreATraiter, 0),
  );
  /** Aucun projet ouvert à l'utilisateur : on affiche l'écran de premier lancement. */
  readonly aucunProjet = computed(() => !this.chargement() && !this.enErreur() && this.projets().length === 0);

  async charger(): Promise<void> {
    this.chargement.set(true);
    this.enErreur.set(false);
    try {
      const projets = await firstValueFrom(this.api.lister());
      this.projets.set(projets);
      this.nav.projets.set(projets); // la barre latérale suit la même liste
    } catch {
      this.enErreur.set(true);
    } finally {
      this.chargement.set(false);
    }
  }
}
