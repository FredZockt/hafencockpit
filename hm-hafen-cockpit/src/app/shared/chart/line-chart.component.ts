/**
 * Ganglinie auf Basis von Chart.js.
 *
 * Liegt in `shared/` und weiß deshalb NICHTS über Tide oder PEGELONLINE: `LineChartPoint` ist
 * fachneutral (Zeitstempel + Zahl). Das Tide-Widget bildet sein Domain-Modell darauf ab.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  type ChartConfiguration,
  type ScriptableContext,
} from 'chart.js';
// Lehrt Chart.js den Umgang mit Datumswerten. Ohne ihn wirft die TimeScale zur Laufzeit.
import 'chartjs-adapter-date-fns';
import { de } from 'date-fns/locale';

// Bewusst KEIN `Chart.register(...registerables)` - das zöge jeden Diagrammtyp (Balken, Torte,
// Radar ...) ins Bundle. Nur die sieben Bausteine, die eine gefüllte Linie mit Zeitachse
// braucht; alles andere fällt dem Tree-Shaking zum Opfer.
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Tooltip,
);

export interface LineChartPoint {
  readonly timestamp: Date;
  /** `null` = Messlücke, kein Wert. Nicht mit 0 verwechseln! */
  readonly value: number | null;
}

/** Liest eine CSS-Custom-Property aus dem Theme (siehe styles.scss). */
function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Ein <canvas> ist für Screenreader eine schwarze Box: role="img", Label, Textfallback. -->
    <div class="chart">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()">
        {{ ariaLabel() }}
      </canvas>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    /* Chart.js braucht einen Container mit DEFINIERTER Höhe; zusammen mit
     * maintainAspectRatio:false füllt das Canvas ihn exakt aus. Ohne feste Höhe wächst
     * das Canvas bei jedem Resize-Durchlauf ein Stück weiter. */
    .chart {
      position: relative;
      height: 120px;
      width: 100%;
    }
  `,
})
export class LineChartComponent {
  /** Die Kurve. Reihenfolge = zeitliche Reihenfolge (aufsteigend). */
  readonly points = input.required<readonly LineChartPoint[]>();

  /** Einheit für Achse und Tooltip, z.B. "cm". */
  readonly unit = input<string>('');

  readonly ariaLabel = input<string>('Ganglinie');

  /**
   * Exakte Extremwerte aus den ROHDATEN. Die übergebene Kurve ist ausgedünnt (Tide: ~1437
   * Punkte -> 144); leitete die Y-Achse ihre Grenzen allein aus den gezeichneten Punkten ab,
   * könnte sie einen Scheitelwert abschneiden, der dem Raster zum Opfer gefallen ist.
   */
  readonly rangeMin = input<number | null>(null);
  readonly rangeMax = input<number | null>(null);

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private chart: Chart<'line', { x: number; y: number | null }[]> | null = null;

  constructor() {
    // `afterNextRender` statt ngOnInit: Chart.js braucht ein Canvas, das wirklich im DOM
    // hängt und eine Größe hat.
    afterNextRender(() => this.createChart());

    // Der Chart wird AKTUALISIERT, nicht neu erzeugt: Ein destroy() + new Chart() bei jedem
    // Auto-Refresh würde die Kachel sichtbar aufblitzen lassen.
    effect(() => {
      const data = this.chartData();
      const suggestedMin = this.rangeMin();
      const suggestedMax = this.rangeMax();

      const chart = this.chart;
      if (chart === null) {
        return; // Canvas noch nicht da - createChart() nimmt die Daten dann mit.
      }

      chart.data.datasets[0]!.data = data;

      const yScale = chart.options.scales?.['y'];
      if (yScale !== undefined) {
        yScale.suggestedMin = suggestedMin ?? undefined;
        yScale.suggestedMax = suggestedMax ?? undefined;
      }

      chart.update('none');
    });

    // Chart.js hängt sich an Resize-Events des Canvas - ohne destroy() bliebe der Listener liegen.
    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }

  private chartData(): { x: number; y: number | null }[] {
    return this.points().map((point) => ({
      x: point.timestamp.getTime(),
      y: point.value,
    }));
  }

  private createChart(): void {
    const canvas = this.canvasRef().nativeElement;

    // Farben aus dem Theme - so folgt der Chart automatisch dem hellen bzw. dunklen Modus.
    const accent = cssVar('--accent', '#4aa8e0');
    const textMuted = cssVar('--text-muted', '#8ea2b4');
    const border = cssVar('--border', '#2a3947');
    const surface = cssVar('--surface', '#16202b');
    const unit = this.unit();

    const config: ChartConfiguration<'line', { x: number; y: number | null }[]> = {
      type: 'line',
      data: {
        datasets: [
          {
            data: this.chartData(),
            borderColor: accent,
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: accent,
            pointHoverBorderColor: surface,
            tension: 0.3,

            fill: 'origin',
            // Scriptable: Der Farbverlauf braucht den Canvas-Kontext, den es beim
            // Konfigurieren noch nicht gibt.
            backgroundColor: (context: ScriptableContext<'line'>) => {
              const { ctx, chartArea } = context.chart;
              if (chartArea === undefined) {
                return 'transparent'; // erster Durchlauf: Fläche noch unbekannt
              }
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, `${accent}47`);
              gradient.addColorStop(1, `${accent}00`);
              return gradient;
            },

            // Messlücken (value: null) NICHT überbrücken - eine durchgezogene Linie wäre
            // eine Behauptung, die die Daten nicht decken.
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        // Zusammen mit der festen Container-Höhe (siehe styles).
        maintainAspectRatio: false,
        animation: false,

        // Hover über die gesamte Spalte - eine dichte Kurve ist sonst kaum zu treffen.
        interaction: { mode: 'index', intersect: false },

        scales: {
          x: {
            type: 'time',
            adapters: { date: { locale: de } },
            time: {
              unit: 'hour',
              displayFormats: { hour: 'HH:mm' },
              tooltipFormat: 'dd.MM.yyyy HH:mm',
            },
            grid: { color: border, drawTicks: false },
            border: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10 },
              maxRotation: 0,
              // Kein festes Raster: Chart.js sucht sich selbst "runde" Uhrzeiten und
              // verhindert überlappende Beschriftungen.
              maxTicksLimit: 5,
            },
          },
          y: {
            type: 'linear',
            suggestedMin: this.rangeMin() ?? undefined,
            suggestedMax: this.rangeMax() ?? undefined,
            grid: { color: border, drawTicks: false },
            border: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10 },
              maxTicksLimit: 4,
              callback: (value) => `${value} ${unit}`.trim(),
            },
          },
        },

        plugins: {
          tooltip: {
            backgroundColor: surface,
            borderColor: border,
            borderWidth: 1,
            titleColor: textMuted,
            bodyColor: accent,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y} ${unit}`.trim(),
            },
          },
        },
      },
    };

    this.chart = new Chart(canvas, config);
  }
}
