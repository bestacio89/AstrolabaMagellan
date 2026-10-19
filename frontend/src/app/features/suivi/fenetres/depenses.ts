import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { NouveauFrais, SuiviApi } from '../api/suivi.api';
import { ACHAT_STATUTS, FRAIS_CATEGORIES } from '../etat/constantes';
import { fE2 } from '../etat/formats';
import { distincts, lireNombre } from '../etat/outils';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';

/** Nouvel achat : formulaire guidé (ligne du TSP → désignation et coût unitaire proposés). */
@Component({
  selector: 'app-fenetre-nouvel-achat',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      <app-modale titre="Nouvel achat" libelleValider="Ajouter l’achat" [large]="true" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <div class="fgrid">
          <label class="field">Date<input class="in" type="date" name="date" [value]="date()" #d (change)="date.set(d.value)" /></label>
          <label class="field"
            >Ligne du TSP
            <select class="in" name="ligne" #l (change)="choisirLigne(l.value)">
              <option value="" [selected]="ligne() === ''">Hors TSP</option>
              @for (b of v.achatRows; track $index; let i = $index) {
                <option [value]="i" [selected]="ligne() === '' + i">{{ b.designation || 'Ligne ' + (i + 1) }} — budget {{ fE2(b.montant) }}</option>
              }
            </select>
          </label>
          <label class="field span2"
            >Désignation<input class="in" name="designation" placeholder="Ex. : 10 licences Copilot" [value]="designation()" #de (input)="designation.set(de.value)"
          /></label>
          <label class="field"
            >Fournisseur<input class="in" name="fournisseur" list="dl-fourn-n" #fo (input)="fournisseur.set(fo.value)" />
            <datalist id="dl-fourn-n">
              @for (x of fournisseurs(); track x) {
                <option [value]="x"></option>
              }
            </datalist>
          </label>
          <label class="field"
            >Statut
            <select class="in" name="statut" #st (change)="statut.set(st.value)">
              @for (x of statuts; track x) {
                <option [value]="x" [selected]="x === statut()">{{ x }}</option>
              }
            </select>
          </label>
          <label class="field">Quantité<input class="in" name="qte" inputmode="decimal" [value]="qte()" #q (input)="qte.set(q.value)" /></label>
          <label class="field">Coût unitaire HT (€)<input class="in" name="cu" inputmode="decimal" placeholder="0" [value]="cu()" #c (input)="cu.set(c.value)" /></label>
          <label class="field">Refacturé au client HT (€)<input class="in" name="refacture" inputmode="decimal" placeholder="0" #r (input)="refacture.set(r.value)" /></label>
          <div class="field">
            <span>Montant HT</span><b class="m-calc">{{ montantTexte() }}</b>
          </div>
          <label class="field span2">Commentaire<input class="in" name="commentaire" placeholder="N° de commande, devis…" #co (input)="commentaire.set(co.value)" /></label>
          <p class="auto span2">
            @if (budgetLigne(); as b) {
              Budget de la ligne : <b>{{ fE2(b.budget) }}</b> · déjà engagé {{ fE2(b.reel) }} · reste après cet achat
              <b [class.neg]="b.reste < -0.5">{{ fE2(b.reste) }}</b>
            } @else {
              Hors TSP : achat non prévu au contrat, son coût réduit la marge nette.
            }
          </p>
        </div>
      </app-modale>
    }
  `,
})
export class FenetreNouvelAchat {
  readonly fermer = output<void>();
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly fE2 = fE2;
  protected readonly statuts = ACHAT_STATUTS;

  protected readonly date = signal(this.etat.vue()?.aujourdhui ?? '');
  protected readonly ligne = signal('');
  protected readonly designation = signal('');
  protected readonly fournisseur = signal('');
  protected readonly statut = signal<string>('Commandé');
  protected readonly qte = signal('1');
  protected readonly cu = signal('');
  protected readonly refacture = signal('');
  protected readonly commentaire = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected readonly fournisseurs = computed(() => distincts((this.etat.vue()?.projet.achatsReel ?? []).map((a) => a.fournisseur).filter(Boolean)).sort());

  private readonly montant = computed(() => {
    const q = lireNombre(this.qte()),
      c = lireNombre(this.cu());
    return q != null && c != null && !isNaN(q) && !isNaN(c) ? q * c : null;
  });

  protected readonly montantTexte = computed(() => {
    const m = this.montant();
    return m == null ? '—' : fE2(m);
  });

  protected readonly budgetLigne = computed(() => {
    const v = this.etat.vue();
    if (!v || this.ligne() === '') return null;
    const l = v.m.financier?.achats.parLigne[+this.ligne()];
    if (!l) return null;
    return { budget: l.budget, reel: l.reel, reste: l.budget - l.reel - (this.montant() ?? 0) };
  });

  /** Ligne choisie : on propose sa désignation et son coût unitaire (si les champs sont vides). */
  protected choisirLigne(valeur: string): void {
    this.ligne.set(valeur);
    const b = valeur === '' ? null : this.etat.vue()?.achatRows[+valeur];
    if (!b) return;
    if (!this.designation().trim()) this.designation.set(b.designation || '');
    if (!this.cu().trim() && b.cu) this.cu.set(String(b.cu).replace('.', ','));
  }

  private echec(message: string, champ: string): void {
    this.erreur.set(message);
    this.modale()?.signalerChamp(champ);
  }

  protected async valider(): Promise<void> {
    const designation = this.designation().trim();
    if (!designation) return this.echec('Indiquez une désignation.', 'designation');
    const q = lireNombre(this.qte()),
      cu = lireNombre(this.cu()),
      rf = lireNombre(this.refacture());
    if (q == null || isNaN(q) || q <= 0) return this.echec('Quantité invalide.', 'qte');
    if (cu == null || isNaN(cu) || cu < 0) return this.echec('Indiquez le coût unitaire HT.', 'cu');
    if (rf != null && (isNaN(rf) || rf < 0)) return this.echec('Montant refacturé invalide.', 'refacture');
    if (!this.date()) return this.echec('Indiquez la date.', 'date');
    this.occupe.set(true);
    const r = await this.etat.saisir((id) =>
      this.api.nouvelAchat(id, {
        date: this.date(),
        ligne: this.ligne() === '' ? null : +this.ligne(),
        designation,
        fournisseur: this.fournisseur().trim(),
        qte: q,
        cu,
        refacture: rf ?? 0,
        statut: this.statut(),
        commentaire: this.commentaire().trim(),
      }),
    );
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}

/** Nouveau frais ; « + Un autre » (message après l'ajout) reprend la date, le collaborateur et la catégorie. */
@Component({
  selector: 'app-fenetre-nouveau-frais',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (etat.vue(); as v) {
      <app-modale titre="Nouveau frais" libelleValider="Ajouter le frais" [large]="true" [erreur]="erreur()" [occupe]="occupe()" (fermer)="fermer.emit()" (valider)="valider()">
        <div class="fgrid">
          <label class="field">Date<input class="in" type="date" name="date" [value]="date()" #d (change)="date.set(d.value)" /></label>
          <label class="field"
            >Collaborateur<input class="in" name="collaborateur" list="dl-people2" placeholder="Nom" [value]="collaborateur()" #c (input)="collaborateur.set(c.value)" />
            <datalist id="dl-people2">
              @for (x of v.personnes; track x) {
                <option [value]="x"></option>
              }
            </datalist>
          </label>
          <label class="field"
            >Catégorie
            <select class="in" name="categorie" #ca (change)="categorie.set(ca.value)">
              @for (x of categories; track x) {
                <option [value]="x" [selected]="x === categorie()">{{ x }}</option>
              }
            </select>
          </label>
          <label class="field">Montant HT (€)<input class="in" name="montant" inputmode="decimal" placeholder="0" #m (input)="montant.set(m.value)" /></label>
          <label class="field span2"
            >Libellé<input class="in" name="libelle" placeholder="Ex. : Train Paris – Lyon, atelier de cadrage" #l (input)="libelle.set(l.value)"
          /></label>
          <label class="m-check span2"
            ><input type="checkbox" name="refacturable" [checked]="refacturable()" #r (change)="refacturable.set(r.checked)" /> Refacturable au client</label
          >
          <label class="field span2">Commentaire<input class="in" name="commentaire" #co (input)="commentaire.set(co.value)" /></label>
        </div>
      </app-modale>
    }
  `,
})
export class FenetreNouveauFrais implements OnInit {
  /** Valeurs reprises du frais précédent (« + Un autre »). */
  readonly reprise = input<Partial<NouveauFrais> | null>(null);
  readonly fermer = output<void>();
  protected readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly categories = FRAIS_CATEGORIES;

  protected readonly date = signal('');
  protected readonly collaborateur = signal('');
  protected readonly categorie = signal<string>('Transport');
  protected readonly montant = signal('');
  protected readonly libelle = signal('');
  protected readonly refacturable = signal(false);
  protected readonly commentaire = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  ngOnInit(): void {
    const v = this.etat.vue();
    const p = this.reprise();
    this.date.set(p?.date || v?.aujourdhui || '');
    this.collaborateur.set(p?.collaborateur ?? '');
    this.categorie.set(p?.categorie || 'Transport');
    // refacturable par défaut si le TSP prévoit des frais refacturés
    this.refacturable.set(p?.refacturable ?? (v?.m.synthese?.fraisRef ?? 0) > 0);
  }

  private echec(message: string, champ: string): void {
    this.erreur.set(message);
    this.modale()?.signalerChamp(champ);
  }

  protected async valider(): Promise<void> {
    if (!this.date()) return this.echec('Indiquez la date.', 'date');
    const libelle = this.libelle().trim();
    if (!libelle) return this.echec('Indiquez un libellé.', 'libelle');
    const m = lireNombre(this.montant());
    if (m == null || isNaN(m) || m <= 0) return this.echec('Indiquez le montant HT.', 'montant');
    const frais: NouveauFrais = {
      date: this.date(),
      collaborateur: this.collaborateur().trim(),
      categorie: this.categorie(),
      libelle,
      montant: m,
      refacturable: this.refacturable(),
      commentaire: this.commentaire().trim(),
    };
    // pour « + Un autre » : date, collaborateur, catégorie et refacturable repris
    this.etat.repriseFrais = { date: frais.date, collaborateur: frais.collaborateur, categorie: frais.categorie, refacturable: frais.refacturable };
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.nouveauFrais(id, frais));
    this.occupe.set(false);
    if (r) this.fermer.emit();
  }
}

/** Import de notes de frais : bientôt disponible (colonnes attendues). */
@Component({
  selector: 'app-fenetre-import-frais',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modale titre="Importer des frais — bientôt disponible" libelleValider="Compris" libelleAnnuler="" (fermer)="fermer.emit()" (valider)="fermer.emit()">
      <p>Vous pourrez importer un export Excel ou CSV de votre outil de notes de frais. Chaque ligne deviendra un frais du projet, sans ressaisie.</p>
      <p><b>Colonnes attendues :</b></p>
      <p class="imp-cols">
        @for (c of colonnes; track c) {
          <span class="chip">{{ c }}</span>
        }
      </p>
      <p class="note">En attendant, saisissez vos frais avec « + Nouveau frais » : ils seront conservés lors de l’import.</p>
    </app-modale>
  `,
})
export class FenetreImportFrais {
  readonly fermer = output<void>();
  protected readonly colonnes = ['Date', 'Collaborateur', 'Catégorie', 'Libellé', 'Montant HT', 'Refacturable (Oui / Non)'];
}
