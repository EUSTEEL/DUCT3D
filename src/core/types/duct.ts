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
 * - 'realistic': renders selected sheetMaterial ('galvanized' mini-spangle or 'inox')
 * - 'technical': renders color-coded engineering zones (Red Female, Blue Male, Yellow Flange, Green Bend, Orange Weld)
 */
export type MaterialMode = 'realistic' | 'technical';

export type WallId = 'bottom' | 'right' | 'top' | 'left';

/** Any face in a 4-, 5-, or 6-face rectangular duct assembly */
export type FaceId = WallId | 'cap_c1' | 'cap_c2';

/**
 * Corner indices in cross-section looking from +Z toward -Z:
 * - TL: (-W/2, +H/2) between Left and Top
 * - TR: (+W/2, +H/2) between Top and Right
 * - BR: (+W/2, -H/2) between Right and Bottom
 * - BL: (-W/2, -H/2) between Bottom and Left
 */
export type CornerId = 'TL' | 'TR' | 'BR' | 'BL';

/** Shared edges between an End Cap (C1 or C2) and the 4 duct body walls */
export type CapEdgeId =
  | 'C1_top'
  | 'C1_bottom'
  | 'C1_left'
  | 'C1_right'
  | 'C2_top'
  | 'C2_bottom'
  | 'C2_left'
  | 'C2_right';

/** Any shared edge in the Face–Edge Graph (4 body edges + up to 8 end-cap edges) */
export type FoldEdgeId = CornerId | CapEdgeId;

/** Join mode of a shared edge between two adjacent faces */
export type EdgeJoinMode = 'bend' | 'seam';

export interface CornerSeamOverride {
  seamType?: SeamType;
  weldOverlapWidth?: number;
  inverted?: boolean;
}

// ---------------------------------------------------------------------------
// Stage 2 (Revised M1.2): End Connections Library (SPEC 3.4)
// ---------------------------------------------------------------------------

/**
 * Integral sheet-metal ends (Bích liền thân ống):
 *   tdc_tdf, nep_c, be_chan, lcct, end_cap, plain
 * Detached structural frames (Bích rời — KHÔNG vẽ lỗ):
 *   bich_v_out, bich_v_in, bich_u
 */
export type EndConnectionType =
  | 'tdc_tdf' // Bích TDC/TDF liền thân (+48 mm, cao 32 mm, 4 ke góc lỗ giọt nước, tùy chọn dấu lõm sát góc)
  | 'nep_c' // Nẹp C liền thân (+12.5 mm uốn cong vòng 180° tạo rãnh chữ C chạy sát 4 góc, hở kỹ thuật ~1–2 mm)
  | 'be_chan' // Đầu bẻ chân tùy biến từng cạnh Trên/Dưới/Trái/Phải (Bẻ vào | Bẻ ra | Để thẳng, +F mm)
  | 'lcct' // Đầu gắn Lưới chắn côn trùng (+20 mm chấn vào trong + khung lưới ô vuông)
  | 'end_cap' // Đầu bịt kín (4 cạnh tùy biến Mí gò / Hàn chập / Hàn đấu đầu + Mảnh bịt đầu rời 1-E/1-F...)
  | 'plain' // Đầu để thẳng (+L_thẳng mm đoạn kéo dài trơn hoàn toàn không chạy mí)
  | 'bich_v_out' // Bích V rời quay ngoài (V30/40/50 thường W+5 hoặc EI W-3; V80×30 cánh 30 lọt lòng W-3)
  | 'bich_v_in' // Bích V rời quay trong (phủ bì W-3 × H-3, thay thế TDC/TDF quay trong)
  | 'bich_u'; // Bích U rời (lệch cánh ôm × mặt bích × gờ bẻ ngoài cố định 10 mm quay về thân)

export type BichVSpec = 'V30x30' | 'V40x40' | 'V50x50' | 'V80x30';
export type BichVThickness = 2 | 3 | 4;
export type BichVOutStyle = 'standard' | 'ei';
export type BichUThickness = 1.5 | 2 | 3;
export type BeChanEdgeMode = 'in' | 'out' | 'straight';
export type BeChanEdges = Record<WallId, BeChanEdgeMode>;

export const BICH_V_SPECS: readonly BichVSpec[] = ['V30x30', 'V40x40', 'V50x50', 'V80x30'] as const;
export const BICH_V_IN_SPECS: readonly BichVSpec[] = ['V30x30', 'V40x40', 'V50x50'] as const;
export const BICH_V_THICKNESSES: readonly BichVThickness[] = [2, 3, 4] as const;
export const BICH_U_THICKNESSES: readonly BichUThickness[] = [1.5, 2, 3] as const;

export interface EndConnectionConfig {
  type: EndConnectionType;
  /** TDC/TDF: tùy chọn dấu lõm nhỏ phân biệt đầu ở cạnh đầu sát góc (mặc định TẮT với ống thẳng) */
  showEndIndent: boolean;
  /** Bích V rời */
  bichVSpec: BichVSpec;
  bichVThickness: BichVThickness;
  bichVOutStyle: BichVOutStyle;
  /** Bích U rời (gờ bẻ ngoài cố định 10 mm quay ngược về phía thân ống) */
  bichUThickness: BichUThickness;
  bichUWrapLeg: number; // Cánh ôm thân ống (mặc định 30 mm)
  bichUFlangeFace: number; // Mặt bích phẳng (mặc định 40 mm)
  /** Đầu bẻ chân tùy biến độc lập từng cạnh Trên / Dưới / Trái / Phải */
  beChanEdges: BeChanEdges;
  beChanWidth: number; // F (mặc định 20 mm)
  /** Đầu để thẳng: chiều dài đoạn kéo dài trơn không chạy mí (mặc định 0 mm) */
  plainExtensionMm: number;
  /** Đầu gắn LCCT */
  showLcctMesh: boolean;
  /** Đầu bịt kín: cho phép tự do chuyển đổi từng cạnh ghép sang Mí gò / Hàn chập / Hàn đấu đầu */
  endCapSeamType: SeamType;
  endCapWeldOverlapWidth: number; // 7–25 mm (mặc định 10 mm)
  endCapEdgeSeams: Partial<Record<WallId, SeamType>>;
}

export interface DuctConfig {
  W: number; // Width (mm)
  H: number; // Height / Depth (mm)
  L: number; // Length (mm)
  sheetMaterial: SheetMaterialType; // 'galvanized' (1200mm) | 'inox' (1250mm)
  thickness: SheetThickness; // mm
  autoSplit: boolean;
  splitMode: SplitMode;
  /** Chế độ ghép mảnh tự do dựa trên đồ thị Mặt – Cạnh (Face–Edge Graph) */
  freeMergeMode: boolean;
  /** Trạng thái từng cạnh tiếp giáp ('bend' = Liền mảnh Chấn 90°, 'seam' = Tách mảnh Mí ghép) khi bật Ghép tự do */
  customEdgeStates: Partial<Record<FoldEdgeId, EdgeJoinMode>>;
  globalSeamType: SeamType;
  weldOverlapWidth: number; // 7–25 mm (default 10 mm)
  swapSeamRoles: boolean; // Global Đảo mí kép ↔ mí đơn
  seamOverrides: Partial<Record<CornerId, CornerSeamOverride>>;
  c1: EndConnectionConfig; // Đầu C1 (z = +L/2, hướng phía trước)
  c2: EndConnectionConfig; // Đầu C2 (z = -L/2, hướng phía sau)
  seamState: SeamState; // Chưa gò mí ↔ Đã gò mí
  explode: number; // 0 to 100 (%)
  unfoldProgress: number; // 0 (Gập thành phẩm) to 100 (Mở phẳng phôi 3D)
  stiffenerRibs: boolean; // Gân tăng cứng thẳng
  showFaceLabels: boolean; // Nhãn mặt đánh dấu trong lòng ống (1-A, 1-B, 1-C...) — mặc định BẬT
  materialMode: MaterialMode; // Vật liệu thật (Tôn Mạ Kẽm / Inox) ↔ Tô màu kỹ thuật
}

export interface ResolvedCornerSeam {
  cornerId: CornerId;
  label: string;
  seamType: SeamType;
  weldOverlapWidth: number;
  femaleWall: WallId; // Also acts as overlap-flap wall for weld_overlap (Hàn chập)
  maleWall: WallId;
  isOverridden: boolean;
}

export interface WorkshopSettings {
  rollFormerLimitMm: number; // Khổ máy lăn gân tối đa (mặc định 1900 mm)
  ribPitchMm: number; // Khoảng cách bước gân tăng cứng (mặc định 210 mm)
  galvanizedSheetW: number; // Khổ rộng tấm chuẩn Tôn Mạ Kẽm (mặc định 1200 mm)
  galvanizedSheetL: number; // Khổ dài tấm chuẩn Tôn Mạ Kẽm (mặc định 6000 mm)
  inoxSheetW: number; // Khổ rộng tấm chuẩn Inox (mặc định 1250 mm)
  inoxSheetL: number; // Khổ dài tấm chuẩn Inox (mặc định 6000 mm)
}

export type SelectionTarget =
  | { kind: 'piece'; partCode: string }
  | { kind: 'end'; endKey: 'c1' | 'c2' }
  | { kind: 'seam'; cornerId: CornerId }
  | { kind: 'edge'; edgeId: FoldEdgeId }
  | null;

export interface ContextMenuState {
  x: number;
  y: number;
  target: NonNullable<SelectionTarget>;
}

export interface FreeMergeNotice {
  message: string;
  targetEdgeId: FoldEdgeId;
  appliedSplitEdgeId: FoldEdgeId;
  alternativeSplitEdges: FoldEdgeId[];
  baseEdgeStates: Partial<Record<FoldEdgeId, EdgeJoinMode>>;
  prevFreeMergeMode: boolean;
}

export interface SplitRecommendation {
  recommended: SplitMode;
  reason: string;
  perimeter: number;
  halfPerimeter: number;
  blankLength: number;
  c1Allowance: number;
  c2Allowance: number;
  sheetStandardWidth: number;
  sheetStandardLength: number;
  rotateLongitudinal: boolean;
  exceedsSheetWidth: boolean;
}

export interface PieceBlankInfo {
  id: string;
  /** Standard sequential piece/face code: '1-A', '1-B', '1-C', '1-D', '1-E', '1-F'... */
  partCode: string;
  name: string;
  isEndCap?: boolean;
  isMergedTree?: boolean;
  endKey?: 'c1' | 'c2';
  walls: WallId[];
  faces?: FaceId[];
  wallsLabel: string;
  wallSpanSum: number; // mm (pure duct walls without seam allowances)
  startSeamLabel: string;
  startAllowance: number; // mm
  endSeamLabel: string;
  endAllowance: number; // mm
  c1Allowance: number; // mm
  c1Label: string;
  c2Allowance: number; // mm
  c2Label: string;
  baseLength: number; // mm (L or H)
  developedWidth: number; // mm (total flat blank width across X)
  blankLength: number; // mm (total flat blank height across Y)
  bendCount: number; // number of 90° internal bends
  areaM2: number; // m²
  cutOrientation: 'ngang_chuan' | 'doc_6000' | 'can_noi_c';
  cutNote: string;
  hasOverlap2D?: boolean;
  overlapWarning?: string;
}

export interface RibLayout {
  enabled: boolean;
  count: number;
  pitchMm: number;
  zPositionsMm: number[];
}

export type CameraPreset = 'iso' | 'seam_closeup' | 'front_section' | 'top' | 'reset' | 'focus_part';

export type SidebarTab = 'params' | 'lsx' | 'blank';
export type ViewportMode = '3d' | '2d' | 'split';
