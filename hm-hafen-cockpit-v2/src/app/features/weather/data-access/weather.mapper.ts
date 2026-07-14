/** Wetter-Mapper: Bright-Sky-DTOs -> HarborWeather. Reine Funktionen, ohne HTTP. */

import type {
  BrightSkyCondition,
  BrightSkyCurrentWeatherDto,
  BrightSkyCurrentWeatherResponseDto,
  BrightSkySourceDto,
} from './brightsky-weather.dto';
import type {
  CompassDirection,
  HarborWeather,
  WeatherCondition,
  WeatherSource,
} from './weather.model';

/**
 * `null` -> 'unbekannt', NICHT 'trocken': Die API sagt damit "ich weiß es nicht",
 * nicht "es regnet nicht".
 */
export function mapCondition(condition: BrightSkyCondition): WeatherCondition {
  switch (condition) {
    case 'dry':
      return 'trocken';
    case 'fog':
      return 'Nebel';
    case 'rain':
      return 'Regen';
    case 'sleet':
      return 'Schneeregen';
    case 'snow':
      return 'Schnee';
    case 'hail':
      return 'Hagel';
    case 'thunderstorm':
      return 'Gewitter';
    case null:
      return 'unbekannt';
  }
}

const COMPASS: readonly CompassDirection[] = [
  'N',
  'NNO',
  'NO',
  'ONO',
  'O',
  'OSO',
  'SO',
  'SSO',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

/**
 * Gradzahl -> Himmelsrichtung. Jeder Sektor ist 22,5° breit.
 *
 * Das `+ 11.25` verschiebt die Sektorgrenze so, dass 0° in der MITTE von "N"
 * liegt - sonst würde 350° fälschlich als "NNW" gelten.
 */
export function toCompassDirection(degrees: number | null): CompassDirection | null {
  if (degrees === null || !Number.isFinite(degrees)) {
    return null;
  }

  const normalized = ((degrees % 360) + 360) % 360; // auch negative Werte robust
  const index = Math.floor((normalized + 11.25) / 22.5) % 16;

  // Guard nur wegen noUncheckedIndexedAccess; das Modulo hält den Index in [0, 15].
  return COMPASS[index] ?? null;
}

/** Obere Grenze je Windstärke: 0 Bft < 1 km/h ... 12 Bft >= 118 km/h. */
const BEAUFORT_UPPER_BOUNDS_KMH: readonly number[] = [
  1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117,
];

/** Beaufort wird abgeleitet - Bright Sky liefert es nicht. Eingabe ist km/h. */
export function toBeaufort(windSpeedKmh: number | null): number | null {
  if (windSpeedKmh === null || !Number.isFinite(windSpeedKmh) || windSpeedKmh < 0) {
    return null;
  }

  const index = BEAUFORT_UPPER_BOUNDS_KMH.findIndex((bound) => windSpeedKmh < bound);
  // -1 = über ALLEN Grenzen -> Orkan (12).
  return index === -1 ? 12 : index;
}

/**
 * Wählt das kürzeste Windmittel, das tatsächlich Daten hat (10/30/60 min), und
 * gibt mit zurück, WELCHES es war - damit das Widget "10-Min-Mittel" ausweisen
 * kann, statt einen Momentanwert vorzutäuschen.
 *
 * Es zählt nur ein Zeitraum, dessen GESCHWINDIGKEIT vorliegt: Ein Zeitraum mit
 * bloßer Richtung wäre nutzlos.
 */
export function selectWindWindow(dto: BrightSkyCurrentWeatherDto): {
  readonly minutes: 10 | 30 | 60 | null;
  readonly speedKmh: number | null;
  readonly gustKmh: number | null;
  readonly directionDegrees: number | null;
} {
  if (dto.wind_speed_10 !== null) {
    return {
      minutes: 10,
      speedKmh: dto.wind_speed_10,
      gustKmh: dto.wind_gust_speed_10,
      directionDegrees: dto.wind_direction_10,
    };
  }

  if (dto.wind_speed_30 !== null) {
    return {
      minutes: 30,
      speedKmh: dto.wind_speed_30,
      gustKmh: dto.wind_gust_speed_30,
      directionDegrees: dto.wind_direction_30,
    };
  }

  if (dto.wind_speed_60 !== null) {
    return {
      minutes: 60,
      speedKmh: dto.wind_speed_60,
      gustKmh: dto.wind_gust_speed_60,
      directionDegrees: dto.wind_direction_60,
    };
  }

  // Gar kein Windwert - kommt vor (z.B. reine Niederschlagsstationen).
  return { minutes: null, speedKmh: null, gustKmh: null, directionDegrees: null };
}

/**
 * Findet die Station, aus der der Messsatz stammt.
 *
 * `sources` ist ein ARRAY. Die Zuordnung läuft über `weather.source_id`, NICHT
 * über "nimm die erste" - die erste ist nur der Notnagel.
 */
export function mapSource(
  sources: readonly BrightSkySourceDto[],
  sourceId: number,
): WeatherSource {
  const matching = sources.find((source) => source.id === sourceId) ?? sources[0];

  if (matching === undefined) {
    return {
      stationName: null,
      distanceKm: null,
      observationType: null,
      dwdStationId: null,
    };
  }

  return {
    stationName: matching.station_name,
    // API liefert METER -> wir speichern KILOMETER, auf 100 m gerundet.
    distanceKm: Number.isFinite(matching.distance)
      ? Math.round(matching.distance / 100) / 10
      : null,
    observationType: matching.observation_type,
    dwdStationId: matching.dwd_station_id,
  };
}

/**
 * Haupt-Mapper. Man beachte: NIRGENDS steht hier `* 3.6` - die Werte sind dank
 * `units=dwd` bereits km/h (siehe brightsky-weather.dto.ts, Falle 2).
 */
export function mapToHarborWeather(response: BrightSkyCurrentWeatherResponseDto): HarborWeather {
  const weather = response.weather;
  const wind = selectWindWindow(weather);

  const measuredAt = new Date(weather.timestamp);

  return {
    temperatureCelsius: weather.temperature,
    condition: mapCondition(weather.condition),
    icon: weather.icon,

    windSpeedKmh: wind.speedKmh,
    windGustKmh: wind.gustKmh,
    windDirectionDegrees: wind.directionDegrees,
    windDirection: toCompassDirection(wind.directionDegrees),
    beaufort: toBeaufort(wind.speedKmh),
    windAveragingMinutes: wind.minutes,

    // Ein kaputter Zeitstempel darf nicht als "Invalid Date" in die UI gelangen.
    measuredAt: Number.isNaN(measuredAt.getTime()) ? new Date() : measuredAt,

    source: mapSource(response.sources, weather.source_id),
  };
}
