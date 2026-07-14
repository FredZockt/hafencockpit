import {
  mapCondition,
  mapSource,
  mapToHarborWeather,
  selectWindWindow,
  toBeaufort,
  toCompassDirection,
} from './weather.mapper';
import type {
  BrightSkyCurrentWeatherDto,
  BrightSkyCurrentWeatherResponseDto,
  BrightSkySourceDto,
} from './brightsky-weather.dto';

/** Live-Messsatz (units=dwd -> Grad Celsius und km/h). */
const WEATHER: BrightSkyCurrentWeatherDto = {
  timestamp: '2026-07-14T14:30:00+02:00',
  source_id: 135798,
  temperature: 25.8,
  condition: 'dry',
  icon: 'partly-cloudy-day',
  wind_speed_10: 16.9,
  wind_direction_10: 70,
  wind_gust_speed_10: 27.0,
  wind_speed_30: 16.9,
  wind_direction_30: 70,
  wind_gust_speed_30: 27.0,
  wind_speed_60: 16.2,
  wind_direction_60: 80,
  wind_gust_speed_60: 29.0,
};

const SOURCE: BrightSkySourceDto = {
  id: 135798,
  dwd_station_id: '01975',
  wmo_station_id: '10147',
  station_name: 'Hamburg-Fuhlsbuettel',
  observation_type: 'synop',
  distance: 9147.0,
  lat: 53.6332,
  lon: 9.9881,
  height: 11.0,
};

const RESPONSE: BrightSkyCurrentWeatherResponseDto = {
  weather: WEATHER,
  sources: [SOURCE],
};

describe('mapCondition', () => {
  it('übersetzt die Wetterlagen ins Deutsche', () => {
    expect(mapCondition('dry')).toBe('trocken');
    expect(mapCondition('rain')).toBe('Regen');
    expect(mapCondition('thunderstorm')).toBe('Gewitter');
    expect(mapCondition('fog')).toBe('Nebel');
  });

  it('macht aus null "unbekannt" - NICHT "trocken"', () => {
    // null heißt "ich weiß es nicht", nicht "es regnet nicht".
    expect(mapCondition(null)).toBe('unbekannt');
  });
});

describe('toCompassDirection', () => {
  it('ordnet 0 Grad der Mitte von Nord zu', () => {
    expect(toCompassDirection(0)).toBe('N');
  });

  it('rechnet 350 Grad noch zu Nord (Sektormitte, nicht Sektorkante)', () => {
    // Ein naives Math.floor(deg / 22.5) lieferte hier NNW.
    expect(toCompassDirection(350)).toBe('N');
  });

  it('ordnet die Live-Windrichtung (70 Grad) korrekt zu', () => {
    expect(toCompassDirection(70)).toBe('ONO');
  });

  it('deckt die Hauptrichtungen ab', () => {
    expect(toCompassDirection(90)).toBe('O');
    expect(toCompassDirection(180)).toBe('S');
    expect(toCompassDirection(270)).toBe('W');
    expect(toCompassDirection(360)).toBe('N');
  });

  it('liefert null ohne Gradangabe', () => {
    expect(toCompassDirection(null)).toBeNull();
  });
});

describe('toBeaufort', () => {
  it('ordnet die Live-Windgeschwindigkeit (16,9 km/h) Bft 3 zu', () => {
    expect(toBeaufort(16.9)).toBe(3);
  });

  it('deckt die Skalenränder ab', () => {
    expect(toBeaufort(0)).toBe(0);
    expect(toBeaufort(0.5)).toBe(0);
    expect(toBeaufort(120)).toBe(12);
    expect(toBeaufort(250)).toBe(12);
  });

  it('liefert null ohne Messwert', () => {
    expect(toBeaufort(null)).toBeNull();
  });
});

describe('selectWindWindow', () => {
  it('bevorzugt das 10-Minuten-Mittel', () => {
    const window = selectWindWindow(WEATHER);
    expect(window.minutes).toBe(10);
    expect(window.speedKmh).toBe(16.9);
    expect(window.gustKmh).toBe(27.0);
  });

  it('fällt auf 30 Minuten zurück, wenn das 10-Minuten-Mittel fehlt', () => {
    const window = selectWindWindow({ ...WEATHER, wind_speed_10: null });
    expect(window.minutes).toBe(30);
    expect(window.speedKmh).toBe(16.9);
  });

  it('fällt weiter auf 60 Minuten zurück', () => {
    const window = selectWindWindow({
      ...WEATHER,
      wind_speed_10: null,
      wind_speed_30: null,
    });
    expect(window.minutes).toBe(60);
    expect(window.speedKmh).toBe(16.2);
  });

  it('meldet ehrlich "kein Wind verfügbar", wenn alle drei fehlen', () => {
    const window = selectWindWindow({
      ...WEATHER,
      wind_speed_10: null,
      wind_speed_30: null,
      wind_speed_60: null,
    });
    expect(window.minutes).toBeNull();
    expect(window.speedKmh).toBeNull();
  });
});

describe('mapSource', () => {
  it('findet die Station über die source_id - nicht über "nimm die erste"', () => {
    const otherSource: BrightSkySourceDto = { ...SOURCE, id: 999, station_name: 'Falsche Station' };

    const source = mapSource([otherSource, SOURCE], 135798);

    expect(source.stationName).toBe('Hamburg-Fuhlsbuettel');
  });

  it('rechnet die Entfernung von Metern in Kilometer um', () => {
    expect(mapSource([SOURCE], 135798).distanceKm).toBe(9.1);
  });

  it('kommt mit einer leeren Quellenliste zurecht', () => {
    const source = mapSource([], 1);
    expect(source.stationName).toBeNull();
    expect(source.distanceKm).toBeNull();
  });
});

describe('mapToHarborWeather', () => {
  it('übernimmt die Windgeschwindigkeit in km/h OHNE Umrechnung', () => {
    // Regressionstest: Bright Sky liefert mit units=dwd bereits km/h. Ein
    // `* 3.6` hätte aus 16,9 km/h -> 60,8 km/h gemacht (Brise -> steifer Wind).
    const weather = mapToHarborWeather(RESPONSE);

    expect(weather.windSpeedKmh).toBe(16.9);
    expect(weather.windGustKmh).toBe(27.0);
    expect(weather.windSpeedKmh).not.toBeCloseTo(16.9 * 3.6);
  });

  it('übernimmt die Temperatur in Grad Celsius (nicht Kelvin)', () => {
    expect(mapToHarborWeather(RESPONSE).temperatureCelsius).toBe(25.8);
  });

  it('leitet Himmelsrichtung und Beaufort ab', () => {
    const weather = mapToHarborWeather(RESPONSE);

    expect(weather.windDirection).toBe('ONO');
    expect(weather.windDirectionDegrees).toBe(70);
    expect(weather.beaufort).toBe(3);
  });

  it('weist aus, über welchen Zeitraum der Wind gemittelt ist', () => {
    expect(mapToHarborWeather(RESPONSE).windAveragingMinutes).toBe(10);
  });

  it('übernimmt die Herkunft der Messung', () => {
    const source = mapToHarborWeather(RESPONSE).source;

    expect(source.stationName).toBe('Hamburg-Fuhlsbuettel');
    expect(source.distanceKm).toBe(9.1);
    expect(source.observationType).toBe('synop');
  });

  it('fängt einen kaputten Zeitstempel ab', () => {
    const weather = mapToHarborWeather({
      ...RESPONSE,
      weather: { ...WEATHER, timestamp: 'unsinn' },
    });

    expect(Number.isNaN(weather.measuredAt.getTime())).toBe(false);
  });
});
