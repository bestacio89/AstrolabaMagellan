import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Commentaire } from '../api/modeles';
import { SuiviApi } from '../api/suivi.api';
import { SuiviEtat } from '../etat/suivi.etat';
import { morceaux } from '../etat/fil.logique';

/** Carte partagée d'historique : tâches, actions, décisions et risques. */
@Component({
  selector: 'app-carte-commentaires',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="com-card" aria-label="Commentaires">
      <header class="com-head">
        <div><h3>Commentaires</h3><small>{{ resume() }}</small></div>
        <span class="com-count">{{ commentaires().length + (ancienCommentaire()?.trim() ? 1 : 0) }}</span>
      </header>
      @if (peutEcrire()) {
        <div class="com-compose">
          <textarea class="in com-input" aria-label="Ajouter un commentaire" placeholder="Ajouter un commentaire… (@Prénom pour prévenir quelqu’un)"
            [value]="brouillon()" (input)="brouillon.set($any($event.target).value)" (keydown)="clavierPublication($event)"></textarea>
          <div class="com-compose-foot"><small>Ctrl + Entrée pour publier</small><button type="button" class="btn sm primary" [disabled]="!brouillon().trim() || occupe()" (click)="publier()">Publier</button></div>
        </div>
      }
      <div class="com-list">
        @for (c of visibles(); track c.id) {
          <article class="com-item">
            <span class="com-avatar" [style.background]="couleur(c.by)" [attr.aria-label]="c.by">{{ initiales(c.by) }}</span>
            <div class="com-content">
              <div class="com-meta"><b>{{ c.by || 'Utilisateur inconnu' }}</b><time>{{ dateRelative(c.at) }}</time>@if (c.modifieLe) { <span>· modifié</span> }</div>
              @if (editionId() === c.id) {
                <textarea class="in com-input" [value]="texteEdition()" (input)="texteEdition.set($any($event.target).value)" (keydown)="clavierEdition($event)"></textarea>
                <div class="com-actions"><button type="button" class="btn sm ghost" (click)="annulerEdition()">Annuler</button><button type="button" class="btn sm primary" [disabled]="!texteEdition().trim() || occupe()" (click)="enregistrerEdition(c)">Enregistrer</button></div>
              } @else {
                <p class="com-text">@for (x of morceaux(c.texte); track $index) { @if (x.mention) { <span class="com-mention">{{ x.texte }}</span> } @else { {{ x.texte }} } }</p>
                @if (estAuteur(c)) {
                  <div class="com-actions">
                    <button type="button" class="linkbtn" (click)="commencerEdition(c)">Modifier</button>
                    <button type="button" class="linkbtn danger" (click)="demanderSuppression(c.id)">Supprimer</button>
                  </div>
                }
                @if (confirmationSuppression() === c.id) {
                  <div class="com-confirm" role="group" aria-label="Confirmer la suppression">
                    <span>Supprimer ce commentaire ?</span><button type="button" class="btn sm ghost" (click)="demanderSuppression(null)">Annuler</button>
                    <button type="button" class="btn sm danger" [disabled]="occupe()" (click)="supprimer(c)">Supprimer</button>
                  </div>
                }
              }
            </div>
          </article>
        }
        @if (commentaires().length > 3) {
          <button type="button" class="com-more" (click)="afficherAnciens.update(v => !v)">{{ afficherAnciens() ? 'Masquer les commentaires plus anciens' : 'Afficher ' + (commentaires().length - 3) + ' commentaire(s) plus ancien(s)' }}</button>
        }
        @if (ancienCommentaire()?.trim(); as ancien) {
          <article class="com-item com-legacy">
            <span class="com-avatar com-avatar-legacy" aria-hidden="true">AV</span>
            <div class="com-content"><div class="com-meta"><b>Avant l’historique</b><span>commentaire saisi avant le 21/10/2026</span></div><p class="com-text">{{ ancien }}</p></div>
          </article>
        }
        @if (!commentaires().length && !ancienCommentaire()?.trim()) {
          <p class="com-empty">Aucun commentaire.</p>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display:block; }
    .com-card { display:flex; flex-direction:column; gap:12px; }
    .com-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .com-head h3 { margin:0; font-size:14px; font-weight:600; text-transform:none; }
    .com-head small { display:block; margin-top:3px; color:var(--ink-2); font-size:12px; }
    .com-count { display:inline-grid; place-items:center; min-width:24px; height:24px; border-radius:999px; padding:0 6px; background:var(--surface-2); color:var(--ink-2); font-size:12px; }
    .com-compose { display:flex; flex-direction:column; gap:6px; }
    .com-input { min-height:72px; resize:vertical; width:100%; }
    .com-compose-foot,.com-actions,.com-confirm { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .com-compose-foot { justify-content:space-between; }
    .com-compose-foot small { color:var(--ink-2); }
    .com-list { display:flex; flex-direction:column; gap:14px; }
    .com-item { display:grid; grid-template-columns:32px minmax(0,1fr); gap:10px; }
    .com-avatar { display:grid; place-items:center; width:32px; height:32px; border-radius:50%; color:#fff; font-size:11px; font-weight:700; }
    .com-avatar-legacy { background:#98a2b3; }
    .com-content { min-width:0; }
    .com-meta { display:flex; align-items:baseline; flex-wrap:wrap; gap:7px; color:var(--ink-2); font-size:12px; }
    .com-meta b { color:var(--ink); font-size:13px; }
    .com-text { margin:5px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.45; font-size:13px; }
    .com-mention { color:var(--accent); font-weight:650; background:var(--surface-2); border-radius:4px; padding:1px 3px; }
    .com-actions { margin-top:5px; }
    .com-actions .danger { color:var(--danger,#b42318); }
    .com-confirm { margin-top:8px; padding:8px; border:1px solid var(--line); border-radius:8px; background:var(--surface-2); }
    .com-confirm span { flex:1; }
    .com-more { align-self:flex-start; border:0; background:transparent; padding:4px 0; color:var(--link,var(--accent)); cursor:pointer; font:inherit; font-size:12px; }
    .com-empty { margin:0; color:var(--ink-2); font-size:13px; }
  `,
})
export class CarteCommentaires {
  readonly cibleType = input.required<'Tache' | 'Action' | 'Decision' | 'Risque'>();
  readonly cibleId = input.required<string>();
  readonly cle = input.required<string>();
  readonly ancienCommentaire = input<string | null>(null);
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  protected readonly morceaux = morceaux;
  protected readonly brouillon = signal('');
  protected readonly editionId = signal<string | null>(null);
  protected readonly texteEdition = signal('');
  protected readonly confirmationSuppression = signal<string | null>(null);
  protected readonly afficherAnciens = signal(false);
  protected readonly occupe = signal(false);
  protected readonly commentaires = computed(() => this.etat.vue()?.projet.commentaires?.[this.cle()] ?? []);
  protected readonly visibles = computed(() => this.afficherAnciens() ? this.commentaires() : this.commentaires().slice(0, 3));
  protected readonly resume = computed(() => {
    const liste = this.commentaires();
    if (!liste.length) return 'aucun';
    return `${liste.length} · dernier ${this.dateRelative(liste[0].at)}`;
  });
  protected peutEcrire(): boolean { return !!this.etat.vue()?.droits.peutSaisirConsomme; }
  protected estAuteur(c: Commentaire): boolean { return !!c.auteurId && c.auteurId.toLowerCase() === (this.etat.vue()?.droits.utilisateurId ?? '').toLowerCase(); }

  protected initiales(nom: string): string {
    const mots = nom.trim().split(/\s+/).filter(Boolean);
    return (mots.length > 1 ? mots[0][0] + mots[mots.length - 1][0] : nom.slice(0, 2)).toLocaleUpperCase('fr-FR');
  }
  protected couleur(nom: string): string {
    const palette = ['#335c9b','#287d72','#9a4d8c','#9a6226','#5865a8','#3e778d','#a34f4f','#627d32'];
    let h = 0; for (const ch of nom.toLocaleLowerCase('fr-FR')) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return palette[Math.abs(h) % palette.length];
  }
  protected dateRelative(iso: string): string {
    const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso;
    const maintenant = new Date();
    const jour = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
    const ecart = Math.round((jour(maintenant) - jour(d)) / 86400000);
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (ecart === 0) return `aujourd’hui à ${heure}`;
    if (ecart === 1) return `hier à ${heure}`;
    return `${d.toLocaleDateString('fr-FR')} à ${heure}`;
  }
  protected clavierPublication(e: KeyboardEvent): void { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); void this.publier(); } }
  protected clavierEdition(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.annulerEdition(); }
    else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); const c = this.commentaires().find(x => x.id === this.editionId()); if (c) void this.enregistrerEdition(c); }
  }
  protected async publier(): Promise<void> {
    const texte = this.brouillon().trim(); const v = this.etat.vue();
    if (!texte || !v || this.occupe()) return;
    this.occupe.set(true);
    const ok = await this.etat.saisir((id) => this.api.ajouterCommentaire(id, this.cibleType(), this.cibleId(), texte));
    this.occupe.set(false); if (ok) this.brouillon.set('');
  }
  protected commencerEdition(c: Commentaire): void { this.editionId.set(c.id); this.texteEdition.set(c.texte); this.confirmationSuppression.set(null); }
  protected annulerEdition(): void { this.editionId.set(null); this.texteEdition.set(''); }
  protected async enregistrerEdition(c: Commentaire): Promise<void> {
    const texte = this.texteEdition().trim(); if (!texte || this.occupe()) return;
    this.occupe.set(true); const ok = await this.etat.saisir((id) => this.api.modifierCommentaire(id, c.id, texte));
    this.occupe.set(false); if (ok) this.annulerEdition();
  }
  protected demanderSuppression(id: string | null): void { this.confirmationSuppression.set(id); }
  protected async supprimer(c: Commentaire): Promise<void> {
    if (this.occupe()) return;
    this.occupe.set(true); const ok = await this.etat.saisir((id) => this.api.supprimerCommentaire(id, c.id));
    this.occupe.set(false); if (ok) this.confirmationSuppression.set(null);
  }
}
