import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { SuiviApi } from '../api/suivi.api';
import { IA_CONFORME, IA_ST } from '../etat/constantes';
import { fJ, fSigned } from '../etat/formats';
import { SuiviEtat } from '../etat/suivi.etat';
import { Modale } from '../ui/modale';

/** Bilan IA d'une tâche : proposé à la validation d'une tâche qui porte une enveloppe IA. */
@Component({
  selector: 'app-fenetre-bilan-ia',
  imports: [Modale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (t(); as t) {
      <app-modale
        titre="Bilan IA de la tâche"
        libelleValider="Enregistrer le bilan"
        libelleAnnuler="Plus tard"
        [erreur]="erreur()"
        [occupe]="occupe()"
        (fermer)="plusTard()"
        (valider)="valider()"
      >
        <p class="m-ctx">
          Tâche : <b>{{ t.label }}</b>
        </p>
        <div class="ia-bilan">
          <div>
            <span>Enveloppe IA</span><b>{{ fJ(t.ia) }} JH</b>
          </div>
          <div>
            <span>Profils de la tâche</span><b>{{ fJ(t.iaHum) }} JH prévus</b>
          </div>
          <div>
            <span>Consommé total</span><b>{{ fJ(t.consoTotal) }} JH</b>
          </div>
          <div>
            <span>IA consommée</span><b>{{ fJ(t.iaConso) }} JH</b>
          </div>
          <div class="ia-b-res">
            <span>Résultat</span><b [class]="res() > 1e-9 ? 'pos' : res() < -1e-9 ? 'neg' : ''">{{ fSigned(res()) }} JH</b
            ><span class="ia-pill" [class]="'ia-pill ' + statutIa()[1]">{{ statutIa()[0] }}</span>
          </div>
        </div>
        <label class="field"
          >{{ res() < -1e-9 ? 'Cause du dépassement' : 'Levier d’optimisation' }}
          <select class="in" name="iaType" #ty (change)="iaType.set(ty.value)">
            <option value="">— {{ res() < -1e-9 ? 'Cause' : 'Levier' }} —</option>
            @for (x of types(); track x) {
              <option [value]="x" [selected]="x === iaType()">{{ x }}</option>
            }
          </select>
        </label>
        <label class="field"
          >Commentaire *
          <textarea class="in" name="iaJustif" rows="3" [placeholder]="exemple()" [value]="iaJustif()" #ju (input)="iaJustif.set(ju.value)"></textarea>
        </label>
        <p class="note">Repris dans l’écran Optimisation IA et dans l’export COPIL.</p>
      </app-modale>
    }
  `,
})
export class FenetreBilanIa implements OnInit {
  readonly uid = input.required<string>();
  readonly fermer = output<void>();
  private readonly etat = inject(SuiviEtat);
  private readonly api = inject(SuiviApi);
  private readonly modale = viewChild(Modale);
  protected readonly fJ = fJ;
  protected readonly fSigned = fSigned;

  protected readonly t = computed(() => this.etat.vue()?.parUid.get(this.uid()) ?? null);
  protected readonly res = computed(() => this.t()?.iaRes ?? 0);
  protected readonly statutIa = computed(() => IA_ST[this.t()?.iaStatut ?? ''] ?? ['—', 'ia-none']);
  protected readonly iaType = signal('');
  protected readonly iaJustif = signal('');
  protected readonly erreur = signal<string | null>(null);
  protected readonly occupe = signal(false);

  protected readonly types = computed(() => {
    const v = this.etat.vue(),
      t = this.t();
    if (!v || !t) return [];
    const r = this.res();
    const liste = r > 1e-9 ? v.m.ia.leviers : r < -1e-9 ? v.m.ia.causes : [IA_CONFORME, ...v.m.ia.leviers];
    return t.iaType && !liste.includes(t.iaType) ? [...liste, t.iaType] : liste;
  });

  protected readonly exemple = computed(() =>
    this.res() > 1e-9
      ? 'Ex. : matrice générée avec Copilot puis relue, 0,5 JH évités'
      : this.res() < -1e-9
        ? 'Ex. : sorties IA inexploitables, reprise manuelle des procédures'
        : 'Ex. : enveloppe utilisée pour la relecture des livrables générés',
  );

  ngOnInit(): void {
    const t = this.t();
    if (t) {
      this.iaType.set(t.iaType);
      this.iaJustif.set(t.iaJustif);
    }
  }

  protected plusTard(): void {
    if (this.t()?.iaAJustifier) this.etat.afficher('Bilan IA à compléter : la tâche apparaît dans « À traiter ».', 'attention');
    this.fermer.emit();
  }

  protected async valider(): Promise<void> {
    const t = this.t();
    if (!t) return;
    if (!this.iaJustif().trim()) {
      this.erreur.set('Le commentaire explique le résultat à la direction de projet : renseignez-le, ou choisissez « Plus tard ».');
      this.modale()?.signalerChamp('iaJustif');
      return;
    }
    this.occupe.set(true);
    const r = await this.etat.saisir((id) => this.api.bilanIa(id, t.uid, this.iaType(), this.iaJustif().trim(), this.etat.versionTache(t.uid)));
    this.occupe.set(false);
    if (!r) return;
    this.etat.afficher('Bilan IA enregistré.', 'succes');
    this.fermer.emit();
  }
}
