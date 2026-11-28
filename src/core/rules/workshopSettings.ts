import type { SheetMaterialType, WorkshopSettings } from '../types/duct';

export const WORKSHOP_SETTINGS_STORAGE_KEY = 'eusteel_duct3d_workshop_settings_v1';

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  rollFormerLimitMm: 1900,
  ribPitchMm: 210,
  galvanizedSheetW: 1200,
  galvanizedSheetL: 6000,
  inoxSheetW: 1250,
  inoxSheetL: 6000,
};

function clampInt(val: unknown, fallback: number, min: number, max: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function sanitizeWorkshopSettings(raw: Partial<WorkshopSettings> | null | undefined): WorkshopSettings {
  return {
    rollFormerLimitMm: clampInt(raw?.rollFormerLimitMm, DEFAULT_WORKSHOP_SETTINGS.rollFormerLimitMm, 600, 4000),
    ribPitchMm: clampInt(raw?.ribPitchMm, DEFAULT_WORKSHOP_SETTINGS.ribPitchMm, 80, 600),
    galvanizedSheetW: clampInt(raw?.galvanizedSheetW, DEFAULT_WORKSHOP_SETTINGS.galvanizedSheetW, 500, 3000),
    galvanizedSheetL: clampInt(raw?.galvanizedSheetL, DEFAULT_WORKSHOP_SETTINGS.galvanizedSheetL, 1000, 12000),
    inoxSheetW: clampInt(raw?.inoxSheetW, DEFAULT_WORKSHOP_SETTINGS.inoxSheetW, 500, 3000),
    inoxSheetL: clampInt(raw?.inoxSheetL, DEFAULT_WORKSHOP_SETTINGS.inoxSheetL, 1000, 12000),
  };
}

export function loadWorkshopSettings(): WorkshopSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_WORKSHOP_SETTINGS };
    }
    const raw = window.localStorage.getItem(WORKSHOP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSHOP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<WorkshopSettings>;
    return sanitizeWorkshopSettings(parsed);
  } catch {
    return { ...DEFAULT_WORKSHOP_SETTINGS };
  }
}

export function saveWorkshopSettings(settings: WorkshopSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(WORKSHOP_SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeWorkshopSettings(settings)));
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
}

export function getActiveSheetDimensions(
  material: SheetMaterialType,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): { widthMm: number; lengthMm: number } {
  if (material === 'inox') {
    return { widthMm: settings.inoxSheetW, lengthMm: settings.inoxSheetL };
  }
  return { widthMm: settings.galvanizedSheetW, lengthMm: settings.galvanizedSheetL };
}
