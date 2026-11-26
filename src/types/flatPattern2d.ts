/**
 * Pluggable, renderer-agnostic 2D Flat Pattern (Laser Cut) data contract.
 * Completely decoupled from Three.js / 3D geometry so future duct fittings
 * (côn, cút, T, chân rẽ, tiêu âm...) can plug directly into FlatPattern2DViewer,
 * while fittings without 2D unfolding simply disable the 2D toggle.
 */

export interface Point2D {
  x: number; // mm
  y: number; // mm
}

export interface Line2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
}

export type ZoneFillKind = 'female_seam' | 'male_seam' | 'weld_seam' | 'flange' | 'plain_ext';

export interface ZoneFill2D {
  kind: ZoneFillKind;
  points: Point2D[];
}

export interface Dimension2D {
  /** 'horizontal' measures along X; 'vertical' measures along Y */
  axis: 'horizontal' | 'vertical';
  /** Start and end coordinate along the measured axis (piece-local mm) */
  start: number;
  end: number;
  /** Anchor position along the perpendicular axis where witness lines start (piece-local mm) */
  anchor: number;
  /** Offset distance outward from anchor to the dimension line (signed mm) */
  offset: number;
  /** Formatted text label (e.g. '2038', '+31', 'W=500', 'L=1100') */
  label: string;
  /** 'total' = bold primary dimension; 'segment' = chain breakdown; 'detail' = rib/notch callout */
  tier: 'total' | 'segment' | 'detail';
  /** Optional accent color hint */
  accent?: 'default' | 'sky' | 'amber' | 'red' | 'blue';
}

export interface Callout2D {
  x: number;
  y: number;
  text: string;
  align?: 'start' | 'middle' | 'end';
  tone?: 'muted' | 'sky' | 'amber' | 'emerald' | 'red';
}

export interface WallRegionLabel2D {
  x: number;
  y: number;
  text: string;
  subtext?: string;
}

export interface SheetLimitCheck2D {
  /** Standard material sheet width (default 1200 mm Tôn Mạ Kẽm / 1250 mm Inox) */
  sheetWidthMm: number;
  /** Standard material sheet length (default 6000 mm) */
  sheetLengthMm: number;
  /** Roll-former beading machine limit (default 1900 mm, checked ONLY perpendicular to ribs = L_phôi) */
  rollFormerLimitMm: number;
  /** Valid cutting orientation on standard sheet (allows 0° or 90° rotation) */
  orientation: 'ngang_chuan' | 'doc_6000' | 'vuot_kho';
  /** True ONLY when blank cannot fit in sheetW × sheetL in EITHER 0° or 90° orientation */
  exceedsSheetLimit: boolean;
  /** True when BOTH dimensions exceed sheetW (must split or use Nối C 17+17) */
  requiresNoiC: boolean;
  /** True ONLY when hasRibs AND dimension perpendicular to ribs (L_phôi) > rollFormerLimitMm */
  exceedsRollFormer: boolean;
  /** Concise Vietnamese guidance message */
  statusText: string;
  severity: 'ok' | 'warn' | 'danger';
}

export interface FlatPatternPiece {
  id: string;
  partCode: string; // '1-A', '1-B', '1-C', '1-D', '1-E', '1-F'...
  name: string;
  subtitle: string;
  isEndCap: boolean;
  endKey?: 'c1' | 'c2';
  /** Active longitudinal seam corner IDs at Left (x=0) and Right (x=widthMm) edges of body pieces */
  leftCornerId?: 'TL' | 'TR' | 'BR' | 'BL';
  rightCornerId?: 'TL' | 'TR' | 'BR' | 'BL';
  /** Body Y boundaries inside piece-local coordinates (for 2D end C2/C1 interactive hit zones) */
  bodyTopY?: number;
  bodyBottomY?: number;
  /** Overall blank bounding box in mm */
  widthMm: number; // X span (developedWidth)
  heightMm: number; // Y span (blankLength)
  areaM2: number;
  bendCount: number;
  /** Placement origin on the global 2D nesting canvas (mm) */
  originX: number;
  originY: number;
  /** Watertight clockwise outer laser-cut polygon (piece-local mm) */
  cutPolygon: Point2D[];
  /** Optional interior cutout loops (e.g., branch holes in later stages), also exported on DXF layer CUT */
  innerHoles?: Point2D[][];
  /** Technical color zone overlays (shown when Tô màu kỹ thuật is active) */
  zoneFills: ZoneFill2D[];
  /** 90° press-brake bend lines (Đường chấn) */
  bendLines: Line2D[];
  /** Seam / flange fold boundary lines (Ranh giới mí / bích) */
  foldLines: Line2D[];
  /** Straight stiffener rib lines (parallel to C1 & C2, configurable pitch from Workshop Settings) */
  ribLines: Line2D[];
  /** Wall face watermarks inside multi-wall pieces (TRÊN, TRÁI, DƯỚI, PHẢI) */
  wallLabels: WallRegionLabel2D[];
  /** Mechanical extension & dimension lines */
  dimensions: Dimension2D[];
  /** Notch / seam-stop / indent annotations */
  callouts: Callout2D[];
  /** Center position for primary part code badge (piece-local mm) */
  centerLabelPos: Point2D;
  /** Standard sheet (W×L with 0°/90° rotation) & roll-former (L_phôi) check */
  limitCheck: SheetLimitCheck2D;
  /** Viewing face note */
  viewingFaceNote: string;
}

export interface FlatPatternDocument {
  title: string;
  specSummary: string;
  materialLabel: string;
  thicknessMm: number;
  sheetWidthMm: number; // e.g., 1200 mm (Tôn Mạ Kẽm) or 1250 mm (Inox)
  sheetLengthMm: number; // e.g., 6000 mm
  rollFormerLimitMm: number; // e.g., 1900 mm
  ribPitchMm: number; // e.g., 210 mm
  totalAreaM2: number;
  pieces: FlatPatternPiece[];
  /** Global bounding box of all laid-out pieces including dimension gutters (mm) */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  /** Clean filename stem for DXF export */
  exportFileName: string;
}
