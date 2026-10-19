import { ChangeDetectionStrategy, Component, input, WritableSignal } from '@angular/core';
import { NouveauProfil } from '../api/suivi.api';
import { ENTITES_L } from '../etat/constantes';
import { lireNombre } from '../etat/outils';
import { Vue } from '../etat/vue';

/** Nouveau profil saisi (texte brut des champs). */
export interface SaisieProfil {
  nom: string;
  entite: string;
  tjm: string;
  cjm: string;
  collaborateur: string;
}

export const profilVide = (): SaisieProfil => ({ nom: '', entite: 'FO', tjm: '', cjm: '', collaborateur: '' });

/**
 * Contrôle un nouveau profil (mêmes règles que le serveur) :
 * nom obligatoire ; homonyme → collaborateur obligatoire et différent ; TJM et CJM positifs.
 * Renvoie [profil, null, null] ou [null, message, champ en erreur].
 */
export function lireNouveauProfil(v: Vue, s: SaisieProfil, prefixe = ''): [NouveauProfil | null, string | null, string | null] {
  const nom = s.nom.trim();
  const collab = s.collaborateur.trim();
  if (!nom) return [null, 'Donnez un nom au nouveau profil.', prefixe + 'nom'];
  const homonymes = v.projet.profiles.filter((x) => (x.nom || '').toLowerCase() === nom.toLowerCase());
  if (homonymes.length && !collab)
    return [
      null,
      `Le profil « ${nom} » existe déjà. S’il s’agit d’une autre personne, indiquez son nom dans « Collaborateur » pour les distinguer ; sinon, choisissez-le dans la liste.`,
      prefixe + 'collaborateur',
    ];
  if (homonymes.some((x) => (x.collaborateur || '').toLowerCase() === collab.toLowerCase()))
    return [null, `« ${nom} — ${collab} » existe déjà : choisissez-le dans la liste.`, prefixe + 'collaborateur'];
  const tjm = lireNombre(s.tjm),
    cjm = lireNombre(s.cjm);
  if (!(tjm != null && tjm > 0)) return [null, 'Saisissez le TJM du nouveau profil (nombre positif).', prefixe + 'tjm'];
  if (!(cjm != null && cjm > 0)) return [null, 'Saisissez le CJM du nouveau profil : sans lui, le coût et la marge seraient faux.', prefixe + 'cjm'];
  return [{ nom, entite: s.entite || 'FO', tjm, cjm, collaborateur: collab }, null, null];
}

/** Champs d'un nouveau profil projet (réutilisés dans « Ajouter un profil » et « Nouvelle tâche »). */
@Component({
  selector: 'app-champs-nouveau-profil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fgrid">
      <label class="field"
        >Nom du profil *<input class="in" [name]="prefixe() + 'nom'" placeholder="Ex. Expert Purview" autocomplete="off" [value]="v().nom" #a (input)="maj('nom', a.value)"
      /></label>
      <label class="field"
        >Entité
        <select class="in" [name]="prefixe() + 'entite'" #b (change)="maj('entite', b.value)">
          @for (e of entites; track e) {
            <option [value]="e" [selected]="e === v().entite">{{ e }}</option>
          }
        </select>
      </label>
      <label class="field"
        >TJM (€) *<input class="in" [name]="prefixe() + 'tjm'" inputmode="decimal" placeholder="Ex. 900" [value]="v().tjm" #c (input)="maj('tjm', c.value)"
      /></label>
      <label class="field"
        >CJM (€) *<input class="in" [name]="prefixe() + 'cjm'" inputmode="decimal" placeholder="Ex. 450" [value]="v().cjm" #d (input)="maj('cjm', d.value)"
      /></label>
      <label class="field span2"
        >Collaborateur<input
          class="in"
          [name]="prefixe() + 'collaborateur'"
          placeholder="Nom de la personne — obligatoire si ce profil existe déjà (ex. 2ᵉ architecte)"
          [value]="v().collaborateur"
          #e
          (input)="maj('collaborateur', e.value)"
      /></label>
    </div>
  `,
})
export class ChampsNouveauProfil {
  readonly valeur = input.required<WritableSignal<SaisieProfil>>();
  readonly prefixe = input('');
  protected readonly entites = ENTITES_L;

  protected v(): SaisieProfil {
    return this.valeur()();
  }

  protected maj(champ: keyof SaisieProfil, valeur: string): void {
    this.valeur().update((p) => ({ ...p, [champ]: valeur }));
  }
}
