import { bootstrapApplication } from '@angular/platform-browser';
import { Racine } from './app/racine';
import { configurationApplication } from './app/app.config';

bootstrapApplication(Racine, configurationApplication).catch((erreur) => console.error(erreur));
