import { TestBed } from '@angular/core/testing';
import { DashboardLayoutStore } from './dashboard-layout-store.service';
import { DEFAULT_DASHBOARD_LAYOUT, type DashboardLayout } from './dashboard-layout.model';
import { DashboardLayoutRepository } from './dashboard-layout.repository';

/** In-Memory-Implementierung des Vertrags; zählt zusätzlich die Speichervorgänge. */
class InMemoryDashboardLayoutRepository extends DashboardLayoutRepository {
  private stored: DashboardLayout | null = null;

  saveCount = 0;
  clearCount = 0;

  seed(layout: DashboardLayout): void {
    this.stored = layout;
  }

  override load(): DashboardLayout {
    return this.stored ?? DEFAULT_DASHBOARD_LAYOUT;
  }

  override save(layout: DashboardLayout): void {
    this.stored = layout;
    this.saveCount += 1;
  }

  override clear(): void {
    this.stored = null;
    this.clearCount += 1;
  }
}

describe('DashboardLayoutStore', () => {
  let store: DashboardLayoutStore;
  let repository: InMemoryDashboardLayoutRepository;

  function configure(seed?: DashboardLayout): void {
    repository = new InMemoryDashboardLayoutRepository();
    if (seed) {
      repository.seed(seed);
    }

    TestBed.configureTestingModule({
      providers: [{ provide: DashboardLayoutRepository, useValue: repository }],
    });

    store = TestBed.inject(DashboardLayoutStore);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configure();
  });

  it('lädt das Layout beim Start aus dem Repository', () => {
    expect(store.widgets().map((widget) => widget.type)).toEqual(['tide', 'weather', 'warnings']);
  });

  it('liefert die Kacheln in Positionsreihenfolge', () => {
    TestBed.resetTestingModule();
    configure({
      version: 1,
      widgets: [
        { id: 'b', type: 'weather', position: 1 },
        { id: 'a', type: 'tide', position: 0 },
      ],
    });

    expect(store.widgets().map((widget) => widget.id)).toEqual(['a', 'b']);
  });

  it('verschiebt eine Kachel und nummeriert die Positionen neu', () => {
    store.moveWidget(0, 2);

    const widgets = store.widgets();

    expect(widgets.map((widget) => widget.type)).toEqual(['weather', 'warnings', 'tide']);
    // Die Positionen sind wieder lückenlos 0,1,2 - der persistierte Stand trägt
    // die Reihenfolge selbst.
    expect(widgets.map((widget) => widget.position)).toEqual([0, 1, 2]);
  });

  it('persistiert das Verschieben SOFORT', () => {
    store.moveWidget(0, 1);

    expect(repository.saveCount).toBe(1);
    expect(repository.load().widgets[0]?.type).toBe('weather');
  });

  it('speichert NICHT, wenn die Kachel auf ihrem Platz abgelegt wird', () => {
    store.moveWidget(1, 1);

    expect(repository.saveCount).toBe(0);
  });

  it('entfernt eine Kachel und persistiert', () => {
    store.removeWidget('weather-main');

    expect(store.widgets().map((widget) => widget.id)).toEqual(['tide-main', 'warnings-main']);
    expect(store.widgets().map((widget) => widget.position)).toEqual([0, 1]);
    expect(repository.saveCount).toBe(1);
  });

  it('ignoriert das Entfernen einer unbekannten ID', () => {
    store.removeWidget('gibt-es-nicht');

    expect(store.widgets()).toHaveLength(3);
    expect(repository.saveCount).toBe(0);
  });

  it('hängt eine neue Kachel ans Ende des Boards', () => {
    store.removeWidget('tide-main');
    store.addWidget('tide');

    const added = store.widgets().at(-1);

    expect(added?.type).toBe('tide');
    expect(added?.position).toBe(store.widgets().length - 1);
    // Eine Größe gibt es nicht mehr: Alle Kacheln sind gleich groß.
    expect(Object.keys(added ?? {})).toEqual(['id', 'type', 'position']);
  });

  it('vergibt kollisionsfreie IDs bei mehreren Kacheln desselben Typs', () => {
    // Doppelte IDs würden das Drag&Drop-Tracking zerstören.
    store.addWidget('tide');

    const ids = store.widgets().map((widget) => widget.id);

    expect(ids).toContain('tide-main');
    expect(ids).toContain('tide-2');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bietet nur Widget-Typen an, die noch nicht auf dem Board liegen', () => {
    // Default-Layout enthält alle drei -> nichts mehr anzubieten.
    expect(store.availableWidgetTypes()).toEqual([]);

    store.removeWidget('warnings-main');

    expect(store.availableWidgetTypes()).toEqual(['warnings']);
  });

  it('setzt das Layout zurück und löscht den Speicherstand', () => {
    store.removeWidget('tide-main');
    store.removeWidget('weather-main');

    store.resetLayout();

    expect(store.widgets()).toHaveLength(3);
    // Ohne `clear()` lüde der nächste Kaltstart eine KOPIE des Defaults.
    expect(repository.clearCount).toBe(1);
  });

  it('meldet ein leeres Board', () => {
    store.removeWidget('tide-main');
    store.removeWidget('weather-main');
    store.removeWidget('warnings-main');

    expect(store.isEmpty()).toBe(true);
    expect(store.widgets()).toEqual([]);
  });
});
