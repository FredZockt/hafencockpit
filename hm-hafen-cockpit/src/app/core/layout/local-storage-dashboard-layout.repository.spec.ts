/**
 * localStorage ist UNTRUSTED INPUT: kaputtes JSON, unbekannte Widget-Typen,
 * doppelte IDs - das Cockpit muss in JEDEM Fall starten.
 */

import { TestBed } from '@angular/core/testing';
import { DEFAULT_DASHBOARD_LAYOUT, type DashboardLayout } from './dashboard-layout.model';
import { LocalStorageDashboardLayoutRepository } from './local-storage-dashboard-layout.repository';

const STORAGE_KEY = 'harbor-cockpit.dashboard-layout.v1';

describe('LocalStorageDashboardLayoutRepository', () => {
  let repository: LocalStorageDashboardLayoutRepository;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [LocalStorageDashboardLayoutRepository],
    });

    repository = TestBed.inject(LocalStorageDashboardLayoutRepository);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('speichert und lädt ein Layout verlustfrei', () => {
    const layout: DashboardLayout = {
      version: 1,
      widgets: [{ id: 'tide-main', type: 'tide', position: 0 }],
    };

    repository.save(layout);

    expect(repository.load()).toEqual(layout);
  });

  it('schreibt tatsächlich unter dem versionierten Key', () => {
    // Der Key trägt die Version im Namen, damit ein künftiges v2 nicht kollidiert.
    repository.save(DEFAULT_DASHBOARD_LAYOUT);

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('liefert das Default-Layout beim ersten Besuch', () => {
    expect(repository.load()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('fällt bei kaputtem JSON auf das Default-Layout zurück', () => {
    localStorage.setItem(STORAGE_KEY, '{ das ist kein json');

    // Ein Dashboard, das wegen eines kaputten Eintrags nicht startet, wäre unbrauchbar.
    expect(repository.load()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('verwirft ein Layout mit fremder Schema-Version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, widgets: [] }));

    expect(repository.load()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('verwirft ein Layout, dessen widgets kein Array sind', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, widgets: 'kaputt' }));

    expect(repository.load()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('sortiert eine Kachel mit UNBEKANNTEM Typ aus, behält den Rest', () => {
    // Der wichtigste Guard: Läge im Browser noch ein entferntes 'radar'-Widget,
    // wäre WIDGET_REGISTRY['radar'] === undefined und der WidgetLoader stürzte
    // beim loadComponent() ab.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        widgets: [
          { id: 'radar-1', type: 'radar', position: 0 },
          { id: 'tide-main', type: 'tide', position: 1 },
        ],
      }),
    );

    const layout = repository.load();

    expect(layout.widgets).toHaveLength(1);
    expect(layout.widgets[0]?.type).toBe('tide');
  });

  it('liest ein ALTES Layout mit size-Feld weiter - und ignoriert das Feld', () => {
    // `size` gibt es im Modell nicht mehr. Ein alter Stand darf trotzdem nicht
    // verworfen werden: Wir lesen gezielt id/type/position, alles Überzählige
    // fällt weg. Deshalb war dafür keine neue Schema-Version nötig.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        widgets: [
          { id: 'weather-main', type: 'weather', position: 0, size: { cols: 1, rows: 1 } },
          { id: 'tide-main', type: 'tide', position: 1, size: { cols: 2, rows: 1 } },
        ],
      }),
    );

    const widgets = repository.load().widgets;

    expect(widgets.map((widget) => widget.id)).toEqual(['weather-main', 'tide-main']);
    expect(widgets[0]).toEqual({ id: 'weather-main', type: 'weather', position: 0 });
  });

  it('entfernt Kacheln mit doppelter ID', () => {
    // Doppelte IDs würden @for(track) und das Drag&Drop durcheinanderbringen.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        widgets: [
          { id: 'tide-main', type: 'tide', position: 0 },
          { id: 'tide-main', type: 'weather', position: 1 },
        ],
      }),
    );

    expect(repository.load().widgets).toHaveLength(1);
  });

  it('nummeriert Positionen lückenlos neu', () => {
    // Nach dem Entfernen einer Kachel können Lücken entstehen (0, 5, 9).
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        widgets: [
          { id: 'weather-main', type: 'weather', position: 9 },
          { id: 'tide-main', type: 'tide', position: 5 },
        ],
      }),
    );

    const widgets = repository.load().widgets;

    // Reihenfolge bleibt erhalten (5 vor 9), Positionen werden zu 0 und 1.
    expect(widgets.map((widget) => widget.id)).toEqual(['tide-main', 'weather-main']);
    expect(widgets.map((widget) => widget.position)).toEqual([0, 1]);
  });

  it('akzeptiert ein bewusst leeres Board', () => {
    // Alle Kacheln entfernt ist ein gültiger Zustand - kein "kaputt".
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, widgets: [] }));

    expect(repository.load().widgets).toEqual([]);
  });

  it('nimmt aber den Default, wenn ALLE Kacheln unbrauchbar waren', () => {
    // Unterschied zum Test davor: hier stand Müll drin, kein leeres Array.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, widgets: [{ id: '', type: 'quatsch' }] }),
    );

    expect(repository.load()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('löscht den Speicherstand', () => {
    repository.save(DEFAULT_DASHBOARD_LAYOUT);
    repository.clear();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(repository.load()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('wirft nicht, wenn localStorage.setItem fehlschlägt (Quota, Private Mode)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // Das Layout hält dann eben nur diese Sitzung.
    expect(() => repository.save(DEFAULT_DASHBOARD_LAYOUT)).not.toThrow();

    setItem.mockRestore();
  });
});
