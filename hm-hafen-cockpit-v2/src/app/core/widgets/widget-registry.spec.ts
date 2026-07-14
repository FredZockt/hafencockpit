import { ALL_WIDGET_TYPES, isWidgetType } from './widget.model';
import { WIDGET_REGISTRY, widgetDefinition } from './widget-registry';

describe('WIDGET_REGISTRY', () => {
  it('kennt jeden deklarierten Widget-Typ', () => {
    // Der Record<WidgetType, ...> erzwingt das zur Compile-Zeit; hier zusätzlich
    // zur Laufzeit, falls jemand die Registry per Cast umgeht.
    for (const type of ALL_WIDGET_TYPES) {
      expect(WIDGET_REGISTRY[type]).toBeDefined();
      expect(WIDGET_REGISTRY[type].type).toBe(type);
    }
  });

  it('benennt für jedes Widget eine Datenquelle', () => {
    // Die Herkunftsangabe ist Pflicht - sie steht in jeder Kachel im Rahmen.
    for (const definition of Object.values(WIDGET_REGISTRY)) {
      expect(definition.dataSource.length).toBeGreaterThan(0);
      expect(definition.title.length).toBeGreaterThan(0);
    }
  });

  it(
    'lädt für JEDEN Typ tatsächlich eine Komponente nach',
    async () => {
      // Führt die dynamischen import()s wirklich aus: Ein Tippfehler im Pfad fällt
      // hier auf, nicht erst beim Nutzer.
      for (const type of ALL_WIDGET_TYPES) {
        const component = await widgetDefinition(type).loadComponent();

        expect(component).toBeDefined();
        expect(typeof component).toBe('function'); // Komponentenklassen sind Funktionen
      }
    },
    // Eigenes Zeitlimit: Der Test lädt die Chunks echt - und der Tide-Chunk zieht
    // Chart.js mit. Das sprengt Vitests 5-Sekunden-Default.
    20_000,
  );
});

describe('isWidgetType', () => {
  it('erkennt bekannte Typen', () => {
    expect(isWidgetType('tide')).toBe(true);
    expect(isWidgetType('weather')).toBe(true);
    expect(isWidgetType('warnings')).toBe(true);
  });

  it('weist unbekannte Werte ab', () => {
    // Dieser Guard verhindert den Absturz, wenn im localStorage noch ein
    // Widget-Typ liegt, den es nicht mehr gibt.
    expect(isWidgetType('radar')).toBe(false);
    expect(isWidgetType('')).toBe(false);
    expect(isWidgetType(null)).toBe(false);
    expect(isWidgetType(42)).toBe(false);
    expect(isWidgetType({ type: 'tide' })).toBe(false);
  });
});
