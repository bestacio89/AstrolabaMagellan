import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatEcart, formatEuros, formatJh, formatPourcentage } from './formats';

/** {{ 4.5 | jh }} → « 4,5 » */
@Pipe({ name: 'jh' })
export class JhPipe implements PipeTransform {
  transform(valeur: number | null | undefined): string {
    return formatJh(valeur);
  }
}

/** {{ 0.5 | ecart }} → « +0,5 » */
@Pipe({ name: 'ecart' })
export class EcartPipe implements PipeTransform {
  transform(valeur: number | null | undefined): string {
    return formatEcart(valeur);
  }
}

/** {{ 12500 | euros }} → « 12 500 € » */
@Pipe({ name: 'euros' })
export class EurosPipe implements PipeTransform {
  transform(valeur: number | null | undefined): string {
    return formatEuros(valeur);
  }
}

/** {{ 0.5358 | pourcent: 2 }} → « 53,58 % » */
@Pipe({ name: 'pourcent' })
export class PourcentPipe implements PipeTransform {
  transform(ratio: number | null | undefined, decimales = 0): string {
    return formatPourcentage(ratio, decimales);
  }
}

/** {{ '2027-04-07' | dateFr }} → « 07/04/2027 » */
@Pipe({ name: 'dateFr' })
export class DateFrPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return formatDate(iso);
  }
}
