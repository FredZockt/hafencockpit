/**
 * Zeigt einen `AppError` - das eine Fehlerformat, auf das alle Repositories ihre sehr
 * unterschiedlichen Fehler abbilden (HTTP 500, Timeout, CORS-Abbruch, kaputtes JSON ...).
 *
 * Der Import von `AppError` aus `core/http/` ist erlaubt: ein technischer, fachneutraler Typ.
 * Verboten wäre der umgekehrte Weg - Fachwissen über Tide oder Wetter in shared/.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AppError } from '../../../core/http/http-error.model';

@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error" role="alert">
      <span class="error__icon" aria-hidden="true">!</span>

      <p class="error__message">{{ error().message }}</p>

      <!-- Eingeklappt: In der Leitstelle stören sie, im Support-Fall sind sie Gold wert. -->
      @if (error().technicalMessage || error().source) {
        <details class="error__details">
          <summary>Technische Details</summary>

          @if (error().statusCode !== undefined) {
            <p><strong>Status:</strong> {{ error().statusCode }}</p>
          }
          @if (error().source; as source) {
            <p class="error__url"><strong>Quelle:</strong> {{ source }}</p>
          }
          @if (error().technicalMessage; as technical) {
            <p>{{ technical }}</p>
          }
        </details>
      }

      @if (retryable()) {
        <button type="button" class="error__retry" (click)="retry.emit()">
          Erneut versuchen
        </button>
      }
    </div>
  `,
  styles: `
    /* Expliziter Flex-Host statt height:100% (siehe LoadingStateComponent). */
    :host {
      display: flex;
      flex: 1;
      min-height: 4rem;
    }

    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      flex: 1;
      text-align: center;
      color: var(--danger);
    }

    .error__icon {
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      background: var(--danger-soft);
      font-weight: 700;
    }

    .error__message {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text);
    }

    .error__details {
      width: 100%;
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: left;

      summary {
        cursor: pointer;
        text-align: center;
      }

      p {
        margin: 0.3rem 0 0;
      }
    }

    /* Lange URLs dürfen die Kachel nicht sprengen. */
    .error__url {
      overflow-wrap: anywhere;
    }

    .error__retry {
      padding: 0.3rem 0.7rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.75rem;
      cursor: pointer;

      &:hover {
        background: var(--surface-hover);
      }
    }
  `,
})
export class ErrorStateComponent {
  readonly error = input.required<AppError>();

  /** Bei den pollenden Widgets läuft der nächste Versuch ohnehin automatisch - dort aus. */
  readonly retryable = input<boolean>(false);

  readonly retry = output<void>();
}
