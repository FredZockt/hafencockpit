/**
 * Root-Komponente. Kein Router: Es gibt genau eine Seite. Ein Router "auf Vorrat" wäre Ballast -
 * er käme später genau hier hin, ohne dass eine andere Datei sich ändern müsste.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HarborCockpitPageComponent } from './core/shell/harbor-cockpit-page.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HarborCockpitPageComponent],
  template: `<app-harbor-cockpit-page />`,
})
export class App {}
