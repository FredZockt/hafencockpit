/**
 * Alle Widgets zeigen denselben Spinner: Ein Disponent soll auf einen Blick erkennen, dass eine
 * Kachel lädt - und nicht erst herausfinden müssen, wie DIESES Widget "lädt" darstellt.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- aria-live="polite": meldet den Ladevorgang, ohne den Nutzer zu unterbrechen. -->
    <div class="loading" role="status" aria-live="polite">
      <span class="loading__spinner" aria-hidden="true"></span>
      <span class="loading__text">{{ text() }}</span>
    </div>
  `,
  styles: `
    /* Der Host nimmt sich den freien Platz im Kachelkörper (Flex-Spalte), statt sich auf
       height:100% zu verlassen - das setzt eine definierte Elternhöhe voraus. */
    :host {
      display: flex;
      flex: 1;
      min-height: 4rem;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      flex: 1;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    .loading__spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .loading__spinner {
        animation: none;
      }
    }
  `,
})
export class LoadingStateComponent {
  readonly text = input<string>('Daten werden geladen ...');
}
