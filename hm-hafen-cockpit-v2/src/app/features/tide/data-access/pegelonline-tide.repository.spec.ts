import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HARBOR_COCKPIT_CONFIG, DEFAULT_HARBOR_COCKPIT_CONFIG } from '../../../core/config/app-config';
import { PegelOnlineTideRepository } from './pegelonline-tide.repository';
import { TideRepository } from './tide.repository';
import type { TideOverview } from './tide.model';

const BASE = DEFAULT_HARBOR_COCKPIT_CONFIG.pegelOnline.baseUrl;
const UUID = DEFAULT_HARBOR_COCKPIT_CONFIG.pegelOnline.stationUuid;

/* Fixtures = echte API-Antworten (2026-07-14). */
const STATION_RESPONSE = {
  uuid: UUID,
  number: '5952020',
  shortname: 'ST.PAULI',
  longname: 'HAMBURG ST. PAULI',
  water: { shortname: 'ELBE', longname: 'ELBE' },
};

const TIMESERIES_RESPONSE = {
  shortname: 'W',
  longname: 'WASSERSTAND ROHDATEN',
  unit: 'cm',
  equidistance: 1,
  gaugeZero: { unit: 'm. ü. NHN', value: -5.004, validFrom: '2019-11-01' },
};

const CURRENT_RESPONSE = {
  timestamp: '2026-07-14T14:32:00+02:00',
  value: 599.0,
  stateMnwMhw: 'unknown',
  stateNswHsw: 'unknown',
};

const MEASUREMENTS_RESPONSE = [
  { timestamp: '2026-07-14T14:30:00+02:00', value: 597.0 },
  { timestamp: '2026-07-14T14:31:00+02:00', value: 598.0 },
  { timestamp: '2026-07-14T14:32:00+02:00', value: 599.0 },
];

describe('PegelOnlineTideRepository', () => {
  let repository: TideRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HARBOR_COCKPIT_CONFIG, useValue: DEFAULT_HARBOR_COCKPIT_CONFIG },
        // Auch der Test spricht nur mit dem VERTRAG, nicht mit der Implementierung.
        { provide: TideRepository, useClass: PegelOnlineTideRepository },
      ],
    });

    repository = TestBed.inject(TideRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify(); // kein Request darf unbeantwortet liegenbleiben
  });

  /** Beantwortet die drei parallelen Requests nach dem Stations-Request. */
  function respondToDataRequests(): void {
    http.expectOne(`${BASE}/stations/${UUID}/W.json`).flush(TIMESERIES_RESPONSE);
    http.expectOne(`${BASE}/stations/${UUID}/W/currentmeasurement.json`).flush(CURRENT_RESPONSE);
    http.expectOne(`${BASE}/stations/${UUID}/W/measurements.json?start=P1D`).flush(
      MEASUREMENTS_RESPONSE,
    );
  }

  it('führt die vier Endpunkte zu einem TideOverview zusammen', () => {
    let result: TideOverview | undefined;
    repository.getTideOverview().subscribe((overview) => (result = overview));

    http.expectOne(`${BASE}/stations/${UUID}.json`).flush(STATION_RESPONSE);
    respondToDataRequests();

    expect(result?.stationName).toBe('HAMBURG ST. PAULI');
    expect(result?.waterName).toBe('ELBE');
    expect(result?.currentWaterLevelCm).toBe(599);
    expect(result?.unit).toBe('cm');
    // NHN nur möglich, weil auch die Zeitreihen-Metadaten (W.json) geholt werden.
    expect(result?.waterLevelMeterAboveSeaLevel).toBe(0.99);
    expect(result?.curve).toHaveLength(3);
  });

  it('setzt die drei datentragenden Requests PARALLEL ab (forkJoin)', () => {
    repository.getTideOverview().subscribe();

    http.expectOne(`${BASE}/stations/${UUID}.json`).flush(STATION_RESPONSE);

    // Alle drei müssen gleichzeitig offen sein. Wären sie verkettet (switchMap
    // statt forkJoin), läge hier nur einer an - dreifache Ladezeit.
    const open = http.match((request) => request.url.startsWith(`${BASE}/stations/${UUID}/W`));
    expect(open).toHaveLength(3);

    open[0]?.flush(TIMESERIES_RESPONSE);
    open[1]?.flush(CURRENT_RESPONSE);
    open[2]?.flush(MEASUREMENTS_RESPONSE);
  });

  it('sucht die Station per Fuzzy-Suche neu, wenn die UUID 404 liefert', () => {
    // Szenario: Die Messstelle wurde umgebaut, die UUID existiert nicht mehr.
    let result: TideOverview | undefined;
    repository.getTideOverview().subscribe((overview) => (result = overview));

    http
      .expectOne(`${BASE}/stations/${UUID}.json`)
      .flush('not found', { status: 404, statusText: 'Not Found' });

    http.expectOne(`${BASE}/stations.json?fuzzyId=hamburg`).flush([
      // Die Suche liefert live AUCH Hamburg-Harburg - eine Verwechslung wäre
      // fachlich fatal (anderer Elbarm).
      { ...STATION_RESPONSE, uuid: 'anderer', longname: 'HAMBURG-HARBURG' },
      STATION_RESPONSE,
    ]);

    respondToDataRequests();

    expect(result?.stationName).toBe('HAMBURG ST. PAULI');
  });

  it('reicht einen Serverfehler durch, statt in die Fuzzy-Suche auszuweichen', () => {
    // NUR ein 404 rechtfertigt die Neusuche. Bei HTTP 500 ist die Station nicht
    // verschwunden - eine Fuzzy-Suche würde nur die Last verdoppeln.
    let error: unknown;
    repository.getTideOverview().subscribe({ error: (err: unknown) => (error = err) });

    http
      .expectOne(`${BASE}/stations/${UUID}.json`)
      .flush('boom', { status: 500, statusText: 'Server Error' });

    // Keine Fuzzy-Suche - http.verify() im afterEach würde sie sonst anmahnen.
    expect(error).toBeDefined();
  });

  it('meldet einen Fehler, wenn die Fuzzy-Suche den Pegel nicht findet', () => {
    let error: unknown;
    repository.getTideOverview().subscribe({ error: (err: unknown) => (error = err) });

    http
      .expectOne(`${BASE}/stations/${UUID}.json`)
      .flush('not found', { status: 404, statusText: 'Not Found' });

    // Nur der falsche Pegel in der Trefferliste.
    http
      .expectOne(`${BASE}/stations.json?fuzzyId=hamburg`)
      .flush([{ ...STATION_RESPONSE, longname: 'HAMBURG-HARBURG' }]);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('HAMBURG ST. PAULI');
  });

  it('bündelt zwei gleichzeitige Zugriffe zu EINEM HTTP-Request (Cache)', () => {
    // Zwei Tide-Kacheln auf dem Board: ohne TTL-Cache doppelte Last - und im
    // schlimmsten Fall zwei unterschiedliche Werte nebeneinander.
    let first: TideOverview | undefined;
    let second: TideOverview | undefined;

    repository.getTideOverview().subscribe((overview) => (first = overview));
    repository.getTideOverview().subscribe((overview) => (second = overview));

    // Trotz zweier Abonnenten: nur EIN Satz Requests.
    http.expectOne(`${BASE}/stations/${UUID}.json`).flush(STATION_RESPONSE);
    respondToDataRequests();

    expect(first?.currentWaterLevelCm).toBe(599);
    expect(second).toBe(first);
  });
});
