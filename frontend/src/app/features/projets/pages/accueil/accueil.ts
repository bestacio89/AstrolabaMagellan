import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjetsApi } from '../../../../api/projets.api';
import { ProjetResume } from '../../../../api/modeles';
import { NotificationsService } from '../../../../core/notifications/notifications';
import { SessionService } from '../../../../core/session/session.service';
import { aujourdhuiIso } from '../../../../shared/format/formats';
import { DateFrPipe, JhPipe } from '../../../../shared/format/pipes';
import { Fenetre } from '../../../../shared/ui/fenetre';
import { Icone } from '../../../../shared/ui/icone';
import { NavigationService } from '../../../../core/layout/navigation';
import { messageErreur } from '../../../../core/http/erreurs.interceptor';
import { ATraiter } from '../../composants/a-traiter/a-traiter';
import { BrouillonsApi } from '../../../brouillons/api/brouillons.api';
import { BrouillonResume } from '../../../brouillons/api/brouillons.modeles';
import { depuis } from '../../../brouillons/etat/brouillon.logique';
import { FenetreImporterTsp } from '../../composants/fenetre-importer-tsp/fenetre-importer-tsp';
import { FenetreNouveauProjet } from '../../composants/fenetre-nouveau-projet/fenetre-nouveau-projet';
import { ListeProjets } from '../../composants/liste-projets/liste-projets';
import { PremierLancement } from '../../composants/premier-lancement/premier-lancement';
import { AccueilEtat } from '../../etat/accueil.etat';

/**
 * Page d'accueil « Mes projets » : les brouillons en cours de rédaction, la liste des projets selon les habilitations,
 * les points à traiter, et la création d'un projet (importer un TSP, le rédiger, ou repartir d'un projet).
 */
@Component({
  selector: 'app-accueil',
  imports: [NgTemplateOutlet, RouterLink, Fenetre, Icone, DateFrPipe, JhPipe, ATraiter, ListeProjets, PremierLancement, FenetreImporterTsp, FenetreNouveauProjet],
  providers: [AccueilEtat],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accueil.html',
  styleUrl: './accueil.scss',
})
export class Accueil implements OnInit {
  protected readonly etat = inject(AccueilEtat);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);

  protected readonly aujourdhui = aujourdhuiIso();
  protected readonly fichierTsp = signal<File | null>(null);
  protected readonly creationOuverte = signal(false);
  /** Projets archivés : chargés avec la page (pour afficher leur nombre), la rubrique reste repliée. */
  protected readonly archivesOuvertes = signal(false);
  protected readonly archives = signal<ProjetResume[] | null>(null);
  private readonly api = inject(ProjetsApi);
  private readonly brouillonsApi = inject(BrouillonsApi);
  /** Brouillons de projet de l'utilisateur (auteur ou co-rédacteur). */
  protected readonly brouillons = signal<BrouillonResume[]>([]);
  protected readonly maintenant = new Date();
  protected readonly depuis = depuis;
  private readonly nav = inject(NavigationService);
  /** Projet dont l'archivage attend confirmation (menu ⋯ de la liste). */
  protected readonly aArchiver = signal<ProjetResume | null>(null);
  protected readonly archivage = signal(false);
  private readonly selecteurFichier = viewChild.required<ElementRef<HTMLInputElement>>('selecteurFichier');

  ngOnInit(): void {
    void this.etat.charger();
    void this.chargerBrouillons();
    void this.chargerArchives();
  }

  private async chargerArchives(): Promise<void> {
    try {
      this.archives.set(await firstValueFrom(this.api.lister(true)));
    } catch {
      this.archives.set([]); // l'erreur est déjà signalée par l'intercepteur
    }
  }

  private async chargerBrouillons(): Promise<void> {
    try {
      this.brouillons.set(await firstValueFrom(this.brouillonsApi.lister()));
    } catch {
      // l'erreur est déjà signalée par l'intercepteur ; la liste des projets reste utilisable
    }
  }

  protected dateDe(iso: string): Date {
    return new Date(iso);
  }

  /** Depuis la fenêtre « Nouveau projet » : importer un TSP Excel. */
  protected importerDepuisNouveau(): void {
    this.creationOuverte.set(false);
    this.choisirTsp();
  }

  /** Archive le projet confirmé, puis met à jour la liste, les archives et la barre latérale. */
  protected async archiver(): Promise<void> {
    const p = this.aArchiver();
    if (!p) return;
    this.archivage.set(true);
    try {
      await firstValueFrom(this.api.archiver(p.id, true));
      this.aArchiver.set(null);
      // retiré sur place (sans recharger la page) ; il rejoint les projets archivés
      this.etat.projets.update((l) => l.filter((x) => x.id !== p.id));
      this.nav.projets.update((l) => l?.filter((x) => x.id !== p.id) ?? null);
      this.notifications.succes(`Projet « ${p.client} — ${p.nom} » archivé.`);
      await this.chargerArchives();
    } catch (e) {
      this.notifications.erreur(messageErreur(e));
    } finally {
      this.archivage.set(false);
    }
  }

  protected basculerArchives(): void {
    this.archivesOuvertes.update((o) => !o);
  }

  /** Ouvre le sélecteur de fichier du navigateur. */
  protected choisirTsp(): void {
    const champ = this.selecteurFichier().nativeElement;
    champ.value = ''; // permet de choisir à nouveau le même fichier
    champ.click();
  }

  protected surFichierChoisi(evenement: Event): void {
    const fichier = (evenement.target as HTMLInputElement).files?.[0];
    if (fichier) this.fichierTsp.set(fichier);
  }

  protected projetImporte(id: string): void {
    this.fichierTsp.set(null);
    this.notifications.succes('TSP repris dans un brouillon : relisez-le, puis lancez le projet.');
    void this.router.navigate(['/brouillons', id]);
  }

  protected brouillonCree(id: string): void {
    this.creationOuverte.set(false);
    void this.router.navigate(['/brouillons', id]);
  }
}
