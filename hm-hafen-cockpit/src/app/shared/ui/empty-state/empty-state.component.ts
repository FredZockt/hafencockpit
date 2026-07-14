/**
 * Empty ist KEIN Error: Ein leeres `alerts`-Array ist beim Warnungen-Widget der Normalfall.
 * Als Fehler dargestellt, sähe die Leitstelle bei ruhigem Wetter dauerhaft eine rote Kachel -
 * und würde rote Kacheln bald ignorieren. Daher eine eigene, ruhige Optik.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      @if (icon(); as iconText) {
        <span class="empty__icon" aria-hidden="true">{{ iconText }}</span>
      }

      <p class="empty__text">{{ text() }}</p>

      @if (hint(); as hintText) {
        <p class="empty__hint">{{ hintText }}</p>
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

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      flex: 1;
      text-align: center;
    }

    .empty__icon {
      font-size: 1.4rem;
      line-height: 1;
    }

    .empty__text {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text);
    }

    .empty__hint {
      margin: 0;
      font-size: 0.72rem;
      color: var(--text-muted);
    }
  `,
})
export class EmptyStateComponent {
  readonly text = input.required<string>();
  /** Zusatzzeile, z.B. woher wir wissen, dass wirklich nichts vorliegt. */
  readonly hint = input<string | null>(null);
  /** Bewusst als Text, um keine Icon-Lib zu ziehen. */
  readonly icon = input<string | null>(null);
}
