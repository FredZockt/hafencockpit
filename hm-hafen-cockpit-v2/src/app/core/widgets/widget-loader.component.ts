/**
 * Lädt die Komponente zu einer Kachel dynamisch nach: Registry -> loadComponent()
 * -> eigener JS-Chunk -> NgComponentOutlet. Wer eine Kachel nicht auf dem Board
 * hat, lädt ihren Code nie.
 *
 * Ein `import()` kann scheitern (Chunk nach einem Deployment weg, Netzwerk weg) -
 * ohne catch bliebe die Kachel ewig im Spinner; wir zeigen den normalen ErrorState.
 */

import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  type Type,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { mapUnknownError } from '../http/http-error.mapper';
import type { AppError } from '../http/http-error.model';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';
import { WIDGET_CONTEXT, type WidgetContext } from './widget-context';
import { WIDGET_REGISTRY } from './widget-registry';
import type { DashboardWidgetInstance } from './widget.model';

@Component({
  selector: 'app-widget-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, LoadingStateComponent, ErrorStateComponent],
  template: `
    @if (loadError(); as error) {
      <div class="loader__error">
        <app-error-state [error]="error" />
      </div>
    } @else if (componentType(); as loadedComponent) {
      <!-- widgetInjector ist eine KONSTANTE, kein Signal-Aufruf - siehe Kommentar an der Property. -->
      <ng-container *ngComponentOutlet="loadedComponent; injector: widgetInjector" />
    } @else {
      <app-loading-state text="Widget wird geladen ..." />
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    /* Der Platzhalter braucht denselben Rahmen wie eine echte Kachel - sonst
       kollabiert das Grid an dieser Stelle. */
    .loader__error {
      display: grid;
      place-items: center;
      height: 100%;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
    }
  `,
})
export class WidgetLoaderComponent {
  readonly widget = input.required<DashboardWidgetInstance>();

  /** Meldet den Entfernen-Wunsch der Kachel nach oben an die Shell. */
  readonly remove = output<string>();

  private readonly parentInjector = inject(Injector);

  private readonly componentTypeSignal = signal<Type<unknown> | null>(null);
  private readonly loadErrorSignal = signal<AppError | null>(null);

  protected readonly componentType = this.componentTypeSignal.asReadonly();
  protected readonly loadError = this.loadErrorSignal.asReadonly();

  /**
   * WIRD GENAU EINMAL GEBAUT - kein `computed`!
   *
   * NgComponentOutlet ZERSTÖRT die Komponente und erzeugt sie NEU, sobald sich der
   * übergebene Injector ändert. Da der Store bei jeder Layout-Änderung frische
   * Instanz-Objekte erzeugt, würde ein vom Widget-Signal abhängiger Injector bei
   * jedem Drag & Drop alle Kacheln neu aufbauen und alle Daten neu laden lassen.
   * Der Kontext liest die aktuelle Instanz stattdessen über das Signal: inhaltlich
   * immer aktuell, ohne seine Identität zu wechseln.
   */
  protected readonly widgetInjector: Injector;

  constructor() {
    // Signals sind gewöhnliche Funktionen und brauchen kein `this`: Der Kontext
    // hängt am Signal, nicht an der Komponenteninstanz.
    const widget = this.widget;
    const removeOutput = this.remove;

    const context: WidgetContext = {
      get instance(): DashboardWidgetInstance {
        return widget();
      },
      remove: () => removeOutput.emit(widget().id),
    };

    this.widgetInjector = Injector.create({
      providers: [{ provide: WIDGET_CONTEXT, useValue: context }],
      parent: this.parentInjector,
    });

    /*
     * `effect` statt `ngOnInit`: Der Loader wird über @for(track widget.id) erzeugt;
     * wechselt die Instanz, läuft ngOnInit nicht erneut. Der Effect reagiert auf
     * jede Änderung von `widget()` und lädt den passenden Typ nach.
     */
    effect(() => {
      const type = this.widget().type;
      void this.loadWidgetComponent(type);
    });
  }

  private async loadWidgetComponent(type: DashboardWidgetInstance['type']): Promise<void> {
    this.loadErrorSignal.set(null);

    try {
      const definition = WIDGET_REGISTRY[type];
      const component = await definition.loadComponent();
      this.componentTypeSignal.set(component);
    } catch (error: unknown) {
      this.loadErrorSignal.set(mapUnknownError(error));
      this.componentTypeSignal.set(null);
    }
  }
}
