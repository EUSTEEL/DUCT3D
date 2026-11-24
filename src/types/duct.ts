export type SheetMaterialType = 'galvanized' | 'inox';

export type GalvanizedThickness = 0.58 | 0.75 | 0.95 | 1.15 | 1.2 | 1.5;
export type InoxThickness = 0.6 | 0.8 | 1.0;
export type SheetThickness = GalvanizedThickness | InoxThickness;

export const GALVANIZED_THICKNESSES: readonly GalvanizedThickness[] = [
  0.58, 0.75, 0.95, 1.15, 1.2, 1.5,
] as const;

export const INOX_THICKNESSES: readonly InoxThickness[] = [0.6, 0.8, 1.0] as const;

export const SHEET_THICKNESSES: readonly SheetThickness[] = [
  ...GALVANIZED_THICKNESSES,
  ...INOX_THICKNESSES,
] as const;

export type SplitMode = '1_piece' | '2_piece_L' | '2_piece_UI' | '4_piece';

export type SeamType = 'pittsburgh' | 'weld_overlap' | 'weld_butt';

export type SeamState = 'unseamed' | 'seamed';

/**
 * Viewport shading mode:
 * - 'realistic': renders the selected sheetMaterial ('galvanized' mini-spangle or 'inox' brushed stainless)
 * - 'technical': renders color-coded engineering zones (Red Female, Blue Male, Green Bend, Amber Weld)
 */
export type MaterialMode = 'realistic' | 'technical';

export type WallId = 'bottom' | 'right' | 'top' | 'left';

/**
 * Corner indices in cross-section looking from +Z toward -Z:
 * - TL: (-W/2, +H/2) between Left and Top
 * - TR: (+W/2, +H/2) between Top and Right
 * - BR: (+W/2, -H/2) between Right and Bottom
 * - BL: (-W/2, -H/2) between Bottom and Left
 */
export type CornerId = 'TL' | 'TR' | 'BR' | 'BL';

export interface CornerSeamOverride {
  seamType?: SeamType;
  weldOverlapWidth?: number;
  inverted?: boolean;
}

export interface DuctConfig {
  W: number; // Width (mm)
  H: number; // Height / Depth (mm)
  L: number; // Length (mm)
  sheetMaterial: SheetMaterialType; // 'galvanized' (1200mm) | 'inox' (1250mm)
  thickness: SheetThickness; // mm
  autoSplit: boolean;
  splitMode: SplitMode;
  globalSeamType: SeamType;
  weldOverlapWidth: number; // 7–25 mm (default 10 mm)
  swapSeamRoles: boolean; // Global Đảo mí kép ↔ mí đơn
  seamOverrides: Partial<Record<CornerId, CornerSeamOverride>>;
  seamState: SeamState; // Chưa gò mí ↔ Đã gò mí
  explode: number; // 0 to 100 (%)
  stiffenerRibs: boolean; // Gân tăng cứng thẳng
  materialMode: MaterialMode; // Vật liệu thật (Tôn Mạ Kẽm / Inox) ↔ Tô màu kỹ thuật
}

export interface ResolvedCornerSeam {
  cornerId: CornerId;
  label: string;
  seamType: SeamType;
  weldOverlapWidth: number;
  femaleWall: WallId; // Also acts as overlap-flap wall for weld_overlap
  maleWall: WallId;
  isOverridden: boolean;
}

export interface SplitRecommendation {
  recommended: SplitMode;
  reason: string;
  perimeter: number;
  halfPerimeter: number;
  sheetStandardWidth: number;
  rotateLongitudinal: boolean;
  exceedsSheetWidth: boolean;
}

export interface PieceBlankInfo {
  id: string;
  name: string;
  walls: WallId[];
  wallsLabel: string;
  wallSpanSum: number; // mm (pure duct walls without seam allowances)
  startSeamLabel: string;
  startAllowance: number; // mm
  endSeamLabel: string;
  endAllowance: number; // mm
  developedWidth: number; // mm (total flat blank width across cross-section)
  blankLength: number; // mm (along L)
  bendCount: number; // number of 90° body bends
  areaM2: number; // m²
  cutOrientation: 'ngang_chuan' | 'doc_6000' | 'can_noi_c';
  cutNote: string;
}

export interface RibLayout {
  enabled: boolean;
  count: number;
  pitchMm: number;
  zPositionsMm: number[];
}

export type CameraPreset = 'iso' | 'seam_closeup' | 'front_section' | 'top' | 'reset';

export type SidebarTab = 'params' | 'lsx' | 'blank';
