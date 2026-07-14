/** Wetter-Widget: kein HttpClient, kein DTO, keine Einheitenrechnung - nur Anzeige. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import type { AppError } from '../../../core/http/http-error.model';
import { RefreshScheduler } from '../../../core/refresh/refresh-scheduler.service';
import { injectWidgetContext } from '../../../core/widgets/widget-context';
import { WIDGET_REGISTRY } from '../../../core/widgets/widget-registry';
import {
  type RemoteData,
  pollRemoteData,
  remoteIdle,
  remoteLoadedAt,
  remoteValue,
  widgetStatus,
} from '../../../shared/models/remote-data.model';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';
import { WidgetFrameComponent } from '../../../shared/ui/widget-frame/widget-frame.component';
import type { HarborWeather } from '../data-access/weather.model';
import { WeatherRepository } from '../data-access/weather.repository';

/** Icon-Alias -> Emoji. Unbekannte Aliase landen beim Fragezeichen. */
const ICON_EMOJI: Readonly<Record<string, string>> = {
  'clear-day': '☀️',
  'clear-night': '🌙',
  'partly-cloudy-day': '⛅',
  'partly-cloudy-night': '☁️',
  cloudy: '☁️',
  fog: '🌫️',
  wind: '💨',
  rain: '🌧️',
  sleet: '🌨️',
  snow: '❄️',
  hail: '🧊',
  thunderstorm: '⛈️',
};

@Component({
  selector: 'app-weather-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, WidgetFrameComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './weather-widget.component.html',
  styleUrl: './weather-widget.component.scss',
})
export class WeatherWidgetComponent {
  private readonly repository = inject(WeatherRepository);
  /** Gemeinsamer Herzschlag - alle Kacheln laden im selben Moment. */
  private readonly scheduler = inject(RefreshScheduler);

  protected readonly context = injectWidgetContext();
  protected readonly definition = WIDGET_REGISTRY['weather'];

  private readonly weather = toSignal(
    pollRemoteData(() => this.repository.getCurrentWeather(), this.scheduler.ticks$),
    { initialValue: remoteIdle<HarborWeather>() satisfies RemoteData<HarborWeather> },
  );

  /** Auch während 'refreshing' und 'stale' gefüllt - kein Content-Jump. */
  protected readonly data = computed<HarborWeather | null>(() => remoteValue(this.weather()));

  /** grün / orange / rot für den Marker im Rahmen. */
  protected readonly status = computed(() => widgetStatus(this.weather()));
  protected readonly loadedAt = computed<Date | null>(() => remoteLoadedAt(this.weather()));

  /** Fehler nur anzeigen, wenn es noch NIE Daten gab. */
  protected readonly fatalError = computed<AppError | null>(() => {
    const state = this.weather();
    return state.state === 'error' ? state.error : null;
  });

  protected emoji(icon: string | null): string {
    if (icon === null) {
      return '❔';
    }
    return ICON_EMOJI[icon] ?? '❔';
  }

  /**
   * Der Windpfeil muss um 180° gedreht werden: Die meteorologische Windrichtung
   * gibt an, WOHER der Wind kommt. Das Glyph (↑) zeigt nach Norden, bei Wind AUS
   * Norden (0°) soll es nach SÜDEN zeigen.
   */
  protected windArrowRotation(degrees: number | null): number {
    return degrees === null ? 0 : (degrees + 180) % 360;
  }
}
