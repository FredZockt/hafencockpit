# Hafen-Cockpit Hamburg — v2

> **v2 gegenüber v1:** Diese Fassung enthält zusätzlich das **Schiffsverkehr-Widget (AIS)**.
> Es dient als Nachweis, dass ein viertes Widget die bestehende App nicht anfasst —
> und als Beispiel für den Fall, dass eine Datenquelle **nicht** direkt aus dem Browser
> abrufbar ist. Siehe [Schiffsverkehr-Widget](#schiffsverkehr-widget-ais).

Konfigurierbares Dashboard für die Hafenleitstelle. Widgets lassen sich per
Drag & Drop anordnen; das Layout wird in `localStorage` persistiert.

Angular 21 (zoneless, Signals, Standalone) · Angular CDK (Drag & Drop) · Chart.js (Tidekurve).

```bash
npm install
npm start      # http://localhost:4200
npm test       # 149 Tests (Vitest)
npm run build
```

**Kacheln sind einheitlich**: jede genau ein Drittel breit und gleich hoch. Die
Zeilenhöhe im Grid ist fest — dadurch ist die Kachelgeometrie vom Inhalt
entkoppelt, und das Layout springt nicht, wenn sich Inhalte ändern (z. B. eine
Warnung dazukommt). Was nicht passt, scrollt *innerhalb* seiner Kachel.

---

## Datenquellen

Alle drei Widgets zeigen **echte Live-Daten**. Beide APIs sind öffentlich, ohne
API-Key nutzbar und senden `Access-Control-Allow-Origin: *` — es wird **kein
Proxy und kein Backend** benötigt.

Sämtliche Angaben unten wurden am **14.07.2026 live gegen die APIs verifiziert**
(Antwortstruktur, Feldnamen, Einheiten, CORS-Header).

### 1. Tide — PEGELONLINE (Wasserstraßen- und Schifffahrtsverwaltung des Bundes)

Basis: `https://www.pegelonline.wsv.de/webservices/rest-api/v2`

| Endpunkt | Zweck |
|---|---|
| `/stations/{uuid}.json` | Stammdaten (Name, Gewässer) |
| `/stations/{uuid}/W.json` | **Einheit + Pegelnullpunkt** |
| `/stations/{uuid}/W/currentmeasurement.json` | aktueller Wasserstand |
| `/stations/{uuid}/W/measurements.json?start=P1D` | Kurve der letzten 24 h |
| `/stations.json?fuzzyId=hamburg` | nur als Fallback (siehe unten) |

Pegel **HAMBURG ST. PAULI**, UUID `d488c5cc-4de9-4631-8ce1-0db0e700b546`.
PEGELONLINE empfiehlt ausdrücklich die Adressierung über die UUID, weil Namen und
Nummern weder eindeutig noch dauerhaft stabil sind. Liefert die UUID einmal einen
HTTP 404 (Messstelle umgebaut), sucht das Repository die Station über die
Fuzzy-Suche neu — und greift dabei gezielt St. Pauli heraus, weil die Suche live
auch **HAMBURG-HARBURG** zurückgibt (anderer Elbarm, Verwechslung wäre fachlich fatal).

Zwei Punkte, die den Unterschied zwischen „Zahl anzeigen" und „Zahl verstehen" ausmachen:

- **Der Wasserstand bezieht sich auf den Pegelnullpunkt (PNP), nicht auf den
  Meeresspiegel.** „649 cm" heißt *nicht* 6,49 m über NN. Der PNP von St. Pauli
  liegt bei −5,004 m ü. NHN (`gaugeZero` aus `W.json`). Erst damit ergibt sich
  1,49 m ü. NHN. Deshalb wird `W.json` überhaupt mitgeladen, statt „cm"
  anzunehmen — und deshalb zeigt das Widget beide Werte samt PNP an.
- **Die Zeitreihe löst minütlich auf** (`equidistance: 1`), `?start=P1D` liefert
  real ~1437 Punkte. Die Kurve wird für die Kachel auf 144 Punkte ausgedünnt.
  Min/Max/Spanne werden aber weiterhin aus den **Rohdaten** berechnet — die
  angezeigten Zahlen sind exakt, nur die gezeichnete Linie ist vereinfacht. Die
  Kachel weist das offen aus („Kurve: 145 von 1437 Messpunkten dargestellt").

### 2. Wetter — Bright Sky (Open Data des DWD)

`GET https://api.brightsky.dev/current_weather?lat=53.5511&lon=9.9937&tz=Europe/Berlin&units=dwd`

Liefert die Messung der nächstgelegenen DWD-Station (live: *Hamburg-Fuhlsbüttel*,
9,1 km entfernt, `observation_type: synop`). Entfernung und Station stehen in der
Kachel — eine Windmessung 9 km landeinwärts ist eben nicht die Windmessung an der
Kaikante.

### 3. Warnungen — Bright Sky `/alerts` (amtliche DWD-CAP-Warnungen)

`GET https://api.brightsky.dev/alerts?lat=53.5511&lon=9.9937&tz=Europe/Berlin`

Der DWD selbst stellt Warnstatusdaten u. a. als JSONP bzw. CAP/XML bereit — aus
einem Angular-Frontend unsauber zu konsumieren. Bright Sky liefert dieselben
amtlichen DWD-Daten als CORS-fähiges JSON.

- Ein **leeres `alerts`-Array ist der Normalfall** und kein Fehler → ruhiger
  Empty-State mit Beleg („Geprüft für Warnzelle Hamburg-Mitte/Ost"), keine rote
  Kachel. Eine Kachel, die bei schönem Wetter dauerhaft rot leuchtet, wird
  ignoriert — und dann übersieht jemand die echte Sturmflutwarnung.
- **Testmeldungen** (`status: 'test'`) werden herausgefiltert, aber **mitgezählt
  und ausgewiesen**. „0 Warnungen" darf nie heimlich „wir haben etwas
  verschwiegen" heißen.

---

## Drei Korrekturen gegenüber der Architektur-Vorlage

Die Vorlage (PDF) skizziert die DTOs plausibel, aber an drei Stellen weichen sie
von den echten APIs ab. Alle drei wären **stille** Fehler gewesen — die App hätte
funktioniert und trotzdem Falsches angezeigt.

| # | Vorlage | Realität | Folge, wäre es übernommen worden |
|---|---|---|---|
| 1 | `wind_speed`, `wind_gust_speed`, `wind_direction` | `/current_weather` hat **nur** `wind_speed_10/30/60` usw. (die Vorlage beschreibt das Schema von `/weather`) | Felder wären `undefined` → Wind dauerhaft „–", ohne Fehlermeldung |
| 2 | Wind in m/s → Umrechnung `* 3.6` | Bright Sky liefert per Default (`units=dwd`) **bereits km/h** (nur `units=si` gibt m/s) | 16,9 km/h wären als **60,8 km/h** angezeigt worden — aus „schwacher Brise" wird „steifer Wind" |
| 3 | `headline`, `description`, `severity`, `id: string`, `expires: Date` | CAP-Felder sind **lokalisiert** (`headline_de`/`_en`), `id` ist eine **Zahl**, `expires` ist **nullable** | Warnungstexte wären leer geblieben; eine Warnung ohne Enddatum wäre als „vorbei" behandelt worden |

Verifiziert per Live-Abruf und gegen die OpenAPI-3.1-Spec von Bright Sky.
Regressionstests dazu: `weather.mapper.spec.ts` („übernimmt km/h OHNE Umrechnung"),
`warnings.mapper.spec.ts` („liest die DEUTSCHEN Textfelder", „ohne Ende = laufend").

---

## Schiffsverkehr-Widget (AIS)

Das vierte Widget zeigt ein- und auslaufende Schiffe im 25-km-Umkreis. Es ist aus
zwei Gründen interessant.

### 1. Der Integrationsaufwand: ein Ordner, eine Zeile

Um das Widget einzuhängen, waren an der bestehenden App **genau drei Änderungen**
nötig — mehr nicht:

```ts
// core/widgets/widget.model.ts
export type WidgetType = 'tide' | 'weather' | 'warnings' | 'ship-traffic';   // (1)
```

```ts
// core/widgets/widget-registry.ts
'ship-traffic': { … loadComponent: () => import('…/ship-traffic-widget.component') }  // (2)
```

```ts
// app.config.ts
{ provide: ShipTrafficRepository, useClass: MockShipTrafficRepository }              // (3)
```

Weil `WIDGET_REGISTRY` ein `Record<WidgetType, WidgetDefinition>` ist, **zeigt der
Compiler nach Änderung (1) sofort jede Stelle**, die noch fehlt — man kann das
Widget gar nicht halb registrieren.

**Nicht angefasst wurden**: Shell, Grid, Drag & Drop, Layout-Store, localStorage-
Persistenz, Refresh-Scheduler, Status-Marker, Countdown. Das Widget ist automatisch
ziehbar, wird persistiert, taucht im „Widget hinzufügen"-Menü auf und bekommt seinen
eigenen Lazy-Chunk (6,5 kB).

### 2. Die erste Quelle, die kein CORS kann

PEGELONLINE und Bright Sky sind ohne Key und mit `Access-Control-Allow-Origin: *`
nutzbar — deshalb kommt v1 ganz ohne Backend aus. **Bei AIS endet das:**

| Anbieter | Zugang | Browser-tauglich? |
|---|---|---|
| **aisstream.io** | API-Key (kostenlos, Anmeldung), WebSocket | **Nein** — *„connections directly to aisstream.io from the browser are not supported"* |
| **AISHub** | Mitgliedschaft + Username, max. 1 Abruf/Minute | kein CORS dokumentiert |
| MarineTraffic / VesselFinder | kommerziell | nein |
| Digitraffic (FI) | kein Key, CORS offen | ja — aber **finnische Gewässer** |

Es gibt also **zwei unabhängige Gründe** für einen kleinen Proxy: Der Key darf nicht
ins Bundle (alles im Browser ist öffentlich), **und** aisstream lässt Browser gar
nicht erst rein.

Genau dafür gibt es den abstrakten Vertrag. Aktuell läuft das Widget gegen
**Demo-Daten**; der Umstieg auf echte Daten ist *eine Zeile*:

```ts
// app.config.ts — heute:
{ provide: ShipTrafficRepository, useClass: MockShipTrafficRepository }
// … sobald der Proxy läuft:
{ provide: ShipTrafficRepository, useClass: BackendShipTrafficRepository }
```

Am Widget, am Mapper, am Template und an den Tests ändert sich **nichts**.

### Der Proxy (noch nicht gebaut)

Er wäre bewusst **dumm** — er hält den Key und die Verbindung, interpretiert aber
nichts. Die AIS-Semantik bleibt an einer Stelle (unserem Mapper), statt auf zwei
Codebasen zu zerfallen:

```
Browser ──HTTP/JSON──▶  Proxy  ──WebSocket + Key──▶  aisstream.io
                          ├─ hält den Key (ENV, nie im Bundle)
                          ├─ EINE Verbindung für alle Nutzer
                          ├─ pflegt Map<mmsi, Schiff> für die Elbe-Bounding-Box
                          └─ GET /ships → Snapshot + CORS-Header
```

Nebeneffekt: Der Proxy verwandelt den **Datenstrom** in **Snapshots**. Damit passt
AIS wieder in die bestehende Architektur (`getShipTraffic(): Observable<…>`) —
inklusive gemeinsamem 60-Sekunden-Takt, Countdown und `refreshing`/`stale`.
Kein Sonderfall in der App.

### Die AIS-Fallen (in `ship-traffic.mapper.ts`)

AIS-Rohdaten sind deutlich unangenehmer als alles bisher. **„Unbekannt" wird nicht
als `null` kodiert, sondern als Zahl:**

| Feld | Sentinel | Ohne Abfangen zeigt die Kachel … |
|---|---|---|
| `sog` | `102.3` | ein Schiff mit **102 Knoten** |
| `cog` | `360` | Kurs **360°** statt „unbekannt" |
| `latitude` / `longitude` | `91` / `181` | ein Schiff am **Nordpol** |
| `trueHeading` | `511` | Unsinn |

Dazu kommen: `shipType` und `navigationalStatus` sind **Zahlencodes** (70–79 Fracht,
80–89 Tanker; 0 = in Fahrt, 5 = festgemacht); `destination` ist **Freitext** von der
Brücke (`HAMBURG`, `DEHAM`, `HH`, `hamburg,ger`); und die **ETA hat kein Jahr** —
nur Monat/Tag/Stunde/Minute, sodass eine Januar-ETA im Dezember ins *Folgejahr*
gehört.

Das Mock-Repository liefert bewusst **rohe AIS-DTOs mit genau diesen Fallen** und
schickt sie durch denselben Mapper wie die echte Quelle. In der Demo sieht man
deshalb, dass sie greifen: Das Lotsenboot zeigt „– kn" statt 102,3, und die Fußzeile
meldet „2 ohne Position / außerhalb verworfen".

23 Tests decken das ab (`ship-traffic.mapper.spec.ts`).

---

## Architektur

```
src/app/
  core/        Dashboard-Shell, Widget-Registry, dynamisches Laden,
               Layout-Persistenz, Fehler-Mapping, Konfiguration
  shared/      WidgetFrame, Loading/Error/Empty, LineChart, RemoteData<T>
               (keinerlei Hafen-Fachlogik)
  features/    tide/ · weather/ · warnings/
               je: data-access/ (DTO, Mapper, API-Service, Repository)
                   ui/         (Widget-Komponente)
```

**Datenfluss:** `API-DTO → Mapper → Domain-Modell → RemoteData<T> → Widget`

**Repositories als Verträge.** Jedes Feature hat eine abstrakte Repository-Klasse;
die Implementierung wird in `app.config.ts` zugewiesen. Ein Widget kennt weder
URL noch DTO noch Einheitenfrage:

```ts
{ provide: TideRepository,     useClass: PegelOnlineTideRepository }
{ provide: WeatherRepository,  useClass: BrightSkyWeatherRepository }
{ provide: WarningsRepository, useClass: BrightSkyWarningsRepository }
```

Ein Wechsel auf Mock-Daten, Open-Meteo oder ein eigenes Backend ist damit **eine
Zeile** — kein Widget, kein Template, kein UI-Test ändert sich. Dasselbe gilt für
die Persistenz (`DashboardLayoutRepository` → localStorage / IndexedDB / Backend).

**Ladezustände** sind eine diskriminierte Union statt Booleans:

```ts
type RemoteData<T> =
  | { state: 'idle' } | { state: 'loading' }
  | { state: 'success'; data: T; loadedAt: Date }
  | { state: 'error'; error: AppError };
```

Im Template wird sie über `@let state = tide()` + `@switch` ausgewertet — ein
direktes `tide().data` würde unter `strictTemplates` nicht kompilieren, weil
TypeScript über zwei getrennte Funktionsaufrufe nicht einengen kann.

**Kein `any`** — technisch erzwungen. Zusätzlich zu Angulars Defaults sind
`exactOptionalPropertyTypes` und `noUncheckedIndexedAccess` aktiv; untrusted
Daten (localStorage, API-Antworten) laufen als `unknown` durch Type Guards.

**Dynamisches Laden.** Jedes Widget liegt in einem eigenen Lazy-Chunk
(`tide-widget-component`, `weather-widget-component`, `warnings-widget-component`)
und wird erst geladen, wenn die Kachel wirklich auf dem Board liegt. Ein viertes
Widget kostet: ein Feature-Verzeichnis + **ein Eintrag in der Registry**. Das
Dashboard wird nicht angefasst.

Das zahlt sich bei Chart.js unmittelbar aus: Die Bibliothek landet vollständig im
**Tide-Chunk** (11 kB → 224 kB roh / 63 kB übertragen), das Initial-Bundle wächst
nur um ~5 kB. Wer die Tide-Kachel entfernt, lädt Chart.js nie herunter. Registriert
werden zudem nur die sieben tatsächlich benötigten Chart.js-Bausteine — nicht
`registerables`, das jeden Diagrammtyp (Balken, Torte, Radar …) mit hineinzöge.

⚠️ Ein Fallstrick, der hier gezielt vermieden wird: `NgComponentOutlet` **zerstört
und erzeugt die Komponente neu, sobald sich der übergebene Injector ändert**. Da
der Layout-Store bei jeder Änderung frische Instanz-Objekte erzeugt, hätte ein aus
der Instanz abgeleiteter (`computed`) Injector dazu geführt, dass *jedes Ziehen*
sämtliche Widgets zerstört, neu aufbaut und alle Daten neu lädt. Der Injector im
`WidgetLoader` ist deshalb **stabil**; der Kontext liest die aktuelle Instanz über
einen Getter aus dem Signal.

---

## Robustheit

- **localStorage ist untrusted input.** Kaputtes JSON, fremde Schema-Version,
  unbekannte Widget-Typen (Overbleibsel eines entfernten Widgets), unsinnige
  Größen, doppelte IDs — alles wird verworfen bzw. korrigiert; das Cockpit
  startet in jedem Fall. Ein bewusst leeres Board bleibt aber leer.
- **Ein gemeinsamer Refresh-Takt** (60 s) für *alle* Kacheln, mit Countdown unter
  „Layout zurücksetzen". Der Takt liegt nicht privat in den Widgets, sondern im
  zentralen `RefreshScheduler`: Anzeige und Abruf hängen an *derselben* Uhr und
  können nicht auseinanderlaufen. Weil alle gleichzeitig laden, können zwei
  nebeneinander stehende Zahlen nie unterschiedlich alt sein.
- **Hintergrund-Aktualisierung ohne Content-Jump.** `RemoteData<T>` kennt neben
  `loading`/`success`/`error` auch `refreshing` (lädt nach, **alte Daten bleiben
  sichtbar**) und `stale` (Abruf fehlgeschlagen, **alte Daten bleiben stehen**).
  `loading`/`error` bedeuten damit präzise „wir hatten noch *nie* Daten". Nach dem
  ersten Erfolg kann eine Kachel ihren Inhalt also nicht mehr verlieren — und
  damit auch nie ihre Höhe. Kein Spinner, kein Kollaps, kein Zurückspringen.
- **Status-Marker je Kachel**: 🟢 live · 🟠 wird im Hintergrund aktualisiert
  (pulsierender Ring, springt automatisch auf grün zurück) · 🔴 letzter Abruf
  fehlgeschlagen. Bei `stale` zeigt die Kachel weiter ihre Daten — ein zwei
  Minuten alter Wasserstand ist nützlicher als eine leere Kachel — aber der rote
  Marker macht unmissverständlich klar, dass sie nicht live sind.
- Ein fehlgeschlagener Abruf stoppt das Polling nicht (`catchError` liegt
  *innerhalb* von `switchMap`).
- **TTL-Cache** im Repository: Zwei Kacheln desselben Typs teilen sich einen
  HTTP-Request und können dadurch gar nicht unterschiedliche Werte anzeigen.
  Fehler werden **nicht** gecacht.
- **Messlücken** (`value: null`) sind Lücken, keine Nullen: Die Kurve bricht dort
  auf, statt eine Linie durchzuziehen, die die Daten nicht hergeben.

## Tests

112 Tests (Vitest + jsdom), Schwerpunkt auf Mappern, Layout-Store und Repositories:

```
core/http/http-error.mapper.spec.ts
core/layout/local-storage-dashboard-layout.repository.spec.ts   ← Muell-Resistenz
core/layout/dashboard-layout-store.service.spec.ts              ← Persistenz-Zusage
core/widgets/widget-registry.spec.ts                            ← lädt jeden Chunk wirklich
shared/util/ttl-cache.spec.ts
features/*/data-access/*.mapper.spec.ts                         ← Fachlogik + Regressionen
features/tide/data-access/pegelonline-tide.repository.spec.ts   ← HttpTestingController
```
