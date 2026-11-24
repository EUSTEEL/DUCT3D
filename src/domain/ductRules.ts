import type {
  CornerId,
  DuctConfig,
  PieceBlankInfo,
  ResolvedCornerSeam,
  RibLayout,
  SeamType,
  SheetThickness,
  SplitMode,
  SplitRecommendation,
  WallId,
} from '../types/duct';
import { SHEET_THICKNESSES } from '../types/duct';

export const SHEET_STANDARD_WIDTH = 1200; // mm (tấm chuẩn 6000 × 1200 mm)
export const SHEET_STANDARD_LENGTH = 6000; // mm
export const PITTSBURGH_FEMALE_ALLOWANCE = 31; // mm (+31 mm)
export const PITTSBURGH_MALE_ALLOWANCE = 7; // mm (+7 mm)
export const STEEL_DENSITY_KG_M3 = 7850; // kg/m³

export const WALL_LABELS: Record<WallId, string> = {
  top: 'Trên',
  bottom: 'Dưới',
  left: 'Trái',
  right: 'Phải',
};

export const CORNER_LABELS: Record<CornerId, string> = {
  TR: 'Góc Trên – Phải',
  BR: 'Góc Dưới – Phải',
  BL: 'Góc Dưới – Trái',
  TL: 'Góc Trên – Trái',
};

export const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  '1_piece': '1 mảnh (Chữ O)',
  '2_piece_L': '2 mảnh chữ L',
  '2_piece_UI': '2 mảnh chữ U+I',
  '4_piece': '4 mảnh rời',
};

export const SEAM_TYPE_LABELS: Record<SeamType, string> = {
  pittsburgh: 'Mí gò Pittsburgh',
  weld_overlap: 'Mí hàn chồng',
  weld_butt: 'Hàn đấu đầu (0–0)',
};

export interface DuctPreset {
  id: string;
  label: string;
  subtitle: string;
  W: number;
  H: number;
  L: number;
  thickness: SheetThickness;
}

export const DUCT_PRESETS: DuctPreset[] = [
  {
    id: 'std-1p',
    label: '500 × 320 • L1110',
    subtitle: '1 mảnh chuẩn',
    W: 500,
    H: 320,
    L: 1110,
    thickness: 0.75,
  },
  {
    id: 'med-2l',
    label: '900 × 600 • L1110',
    subtitle: '2 mảnh L (CV > 2400)',
    W: 900,
    H: 600,
    L: 1110,
    thickness: 0.95,
  },
  {
    id: 'large-4p',
    label: '1800 × 1400 • L1110',
    subtitle: '4 mảnh (W+H > 3000)',
    W: 1800,
    H: 1400,
    L: 1110,
    thickness: 1.2,
  },
  {
    id: 'long-4p',
    label: '800 × 500 • L1500',
    subtitle: 'Xoay dọc khổ 1200',
    W: 800,
    H: 500,
    L: 1500,
    thickness: 0.95,
  },
  {
    id: 'short-weld',
    label: '1200 × 600 • L110',
    subtitle: 'Ngắn (L < 140 gợi ý hàn)',
    W: 1200,
    H: 600,
    L: 110,
    thickness: 1.5,
  },
];

export const DEFAULT_DUCT_CONFIG: DuctConfig = {
  W: 500,
  H: 320,
  L: 1110,
  thickness: 0.75,
  autoSplit: true,
  splitMode: '1_piece',
  globalSeamType: 'pittsburgh',
  weldOverlapWidth: 10,
  swapSeamRoles: false,
  seamOverrides: {},
  seamState: 'seamed',
  explode: 0,
  stiffenerRibs: true,
  materialMode: 'galvanized',
};

/**
 * Evaluate automatic piece splitting according to EUSTEEL factory rules (SPEC 3.3).
 */
export function evaluateSplitRecommendation(
  W: number,
  H: number,
  L: number,
  c1Allowance = 0,
  c2Allowance = 0
): SplitRecommendation {
  const perimeter = 2 * (W + H);
  const halfPerimeter = W + H;
  const L_blank = L + c1Allowance + c2Allowance;
  const maxSideWithFemale = Math.max(W, H) + PITTSBURGH_FEMALE_ALLOWANCE * 2;

  if (L_blank > SHEET_STANDARD_WIDTH) {
    if (maxSideWithFemale <= SHEET_STANDARD_WIDTH) {
      return {
        recommended: '4_piece',
        reason: `Phôi dài ${L_blank} mm > khổ tôn 1200 mm, các cạnh + mí ≤ 1200 mm → Đề xuất 4 mảnh xoay dọc tấm 6000×1200`,
        perimeter,
        halfPerimeter,
        rotateLongitudinal: true,
        exceedsSheet1200: false,
      };
    }
    return {
      recommended: '4_piece',
      reason: `Phôi dài ${L_blank} mm và cạnh lớn + mí (${maxSideWithFemale} mm) đều vượt khổ tôn 1200 mm → Đề xuất 4 mảnh kết hợp Nối C (17+17 mm)`,
      perimeter,
      halfPerimeter,
      rotateLongitudinal: true,
      exceedsSheet1200: true,
    };
  }

  if (halfPerimeter > 3000) {
    return {
      recommended: '4_piece',
      reason: `Nửa chu vi W+H = ${halfPerimeter.toLocaleString('vi-VN')} mm > 3.000 mm → Đề xuất chia 4 mảnh`,
      perimeter,
      halfPerimeter,
      rotateLongitudinal: false,
      exceedsSheet1200: false,
    };
  }

  if (perimeter > 2400) {
    return {
      recommended: '2_piece_L',
      reason: `Chu vi ${perimeter.toLocaleString('vi-VN')} mm > 2.400 mm và W+H = ${halfPerimeter.toLocaleString('vi-VN')} ≤ 3.000 mm → Đề xuất 2 mảnh chữ L`,
      perimeter,
      halfPerimeter,
      rotateLongitudinal: false,
      exceedsSheet1200: false,
    };
  }

  return {
    recommended: '1_piece',
    reason: `Chu vi ${perimeter.toLocaleString('vi-VN')} mm ≤ 2.400 mm & phôi dài ${L_blank} ≤ 1.200 mm → Đề xuất 1 mảnh gấp chữ O`,
    perimeter,
    halfPerimeter,
    rotateLongitudinal: false,
    exceedsSheet1200: false,
  };
}

export interface PieceTopology {
  id: string;
  name: string;
  /** Walls in strict counter-clockwise order looking from +Z toward -Z */
  walls: WallId[];
  startCorner: CornerId;
  endCorner: CornerId;
}

/**
 * Return exact piece topologies for each split mode (strict CCW order).
 * CCW wall loop: bottom (BL->BR) -> right (BR->TR) -> top (TR->TL) -> left (TL->BL)
 */
export function getSplitTopologies(splitMode: SplitMode): PieceTopology[] {
  switch (splitMode) {
    case '1_piece':
      // Single seam at Top-Right (TR) so it's prominently visible from default 3/4 view.
      return [
        {
          id: 'P1',
          name: 'Mảnh thân chữ O',
          walls: ['top', 'left', 'bottom', 'right'],
          startCorner: 'TR',
          endCorner: 'TR',
        },
      ];
    case '2_piece_L':
      // Two seams at opposite corners TR and BL.
      return [
        {
          id: 'L1',
          name: 'Mảnh L1 (Trên + Trái)',
          walls: ['top', 'left'],
          startCorner: 'TR',
          endCorner: 'BL',
        },
        {
          id: 'L2',
          name: 'Mảnh L2 (Dưới + Phải)',
          walls: ['bottom', 'right'],
          startCorner: 'BL',
          endCorner: 'TR',
        },
      ];
    case '2_piece_UI':
      // Two seams at top corners TL and TR.
      return [
        {
          id: 'U',
          name: 'Mảnh chữ U (Trái + Dưới + Phải)',
          walls: ['left', 'bottom', 'right'],
          startCorner: 'TL',
          endCorner: 'TR',
        },
        {
          id: 'I',
          name: 'Mảnh nắp I (Trên)',
          walls: ['top'],
          startCorner: 'TR',
          endCorner: 'TL',
        },
      ];
    case '4_piece':
      // Four seams at all four corners TL, TR, BR, BL.
      return [
        {
          id: 'T',
          name: 'Mảnh mặt Trên (W)',
          walls: ['top'],
          startCorner: 'TR',
          endCorner: 'TL',
        },
        {
          id: 'B',
          name: 'Mảnh mặt Dưới (W)',
          walls: ['bottom'],
          startCorner: 'BL',
          endCorner: 'BR',
        },
        {
          id: 'L',
          name: 'Mảnh hông Trái (H)',
          walls: ['left'],
          startCorner: 'TL',
          endCorner: 'BL',
        },
        {
          id: 'R',
          name: 'Mảnh hông Phải (H)',
          walls: ['right'],
          startCorner: 'BR',
          endCorner: 'TR',
        },
      ];
  }
}

/**
 * Determine active seam corners & default Female/Male wall assignments per SPEC 3.3.
 */
export function resolveActiveSeams(config: DuctConfig): ResolvedCornerSeam[] {
  const { W, H, splitMode, globalSeamType, weldOverlapWidth, swapSeamRoles, seamOverrides } = config;
  const wIsLarger = W >= H;

  type BaseSeam = { cornerId: CornerId; defaultFemale: WallId; defaultMale: WallId };
  let baseSeams: BaseSeam[] = [];

  switch (splitMode) {
    case '1_piece':
      baseSeams = [
        {
          cornerId: 'TR',
          defaultFemale: wIsLarger ? 'top' : 'right',
          defaultMale: wIsLarger ? 'right' : 'top',
        },
      ];
      break;
    case '2_piece_L':
      // SPEC 3.3: mỗi mảnh gồm 1 cạnh W + 1 cạnh H, cạnh lớn hơn mang Mí kép, cạnh nhỏ hơn mang Mí đơn.
      baseSeams = [
        {
          cornerId: 'TR',
          defaultFemale: wIsLarger ? 'top' : 'right',
          defaultMale: wIsLarger ? 'right' : 'top',
        },
        {
          cornerId: 'BL',
          defaultFemale: wIsLarger ? 'bottom' : 'left',
          defaultMale: wIsLarger ? 'left' : 'bottom',
        },
      ];
      break;
    case '2_piece_UI':
      // Default: U-piece sides carry 2 Female pockets opening up; flat I-lid carries 2 Male lips dropping cleanly in.
      baseSeams = [
        {
          cornerId: 'TR',
          defaultFemale: 'right',
          defaultMale: 'top',
        },
        {
          cornerId: 'TL',
          defaultFemale: 'left',
          defaultMale: 'top',
        },
      ];
      break;
    case '4_piece':
      // SPEC 3.3: 2 tấm cạnh dài hơn mang 2 Mí kép, 2 tấm cạnh ngắn hơn mang 2 Mí đơn.
      baseSeams = [
        {
          cornerId: 'TR',
          defaultFemale: wIsLarger ? 'top' : 'right',
          defaultMale: wIsLarger ? 'right' : 'top',
        },
        {
          cornerId: 'TL',
          defaultFemale: wIsLarger ? 'top' : 'left',
          defaultMale: wIsLarger ? 'left' : 'top',
        },
        {
          cornerId: 'BR',
          defaultFemale: wIsLarger ? 'bottom' : 'right',
          defaultMale: wIsLarger ? 'right' : 'bottom',
        },
        {
          cornerId: 'BL',
          defaultFemale: wIsLarger ? 'bottom' : 'left',
          defaultMale: wIsLarger ? 'left' : 'bottom',
        },
      ];
      break;
  }

  return baseSeams.map((base) => {
    const override = seamOverrides[base.cornerId];
    const seamType = override?.seamType ?? globalSeamType;
    const overlapW = override?.weldOverlapWidth ?? weldOverlapWidth;
    const flip = Boolean(swapSeamRoles) !== Boolean(override?.inverted);
    const femaleWall = flip ? base.defaultMale : base.defaultFemale;
    const maleWall = flip ? base.defaultFemale : base.defaultMale;
    const isOverridden =
      override !== undefined &&
      (override.seamType !== undefined ||
        override.weldOverlapWidth !== undefined ||
        override.inverted === true);

    return {
      cornerId: base.cornerId,
      label: CORNER_LABELS[base.cornerId],
      seamType,
      weldOverlapWidth: overlapW,
      femaleWall,
      maleWall,
      isOverridden,
    };
  });
}

export function getWallLength(wall: WallId, W: number, H: number): number {
  return wall === 'top' || wall === 'bottom' ? W : H;
}

/**
 * Compute straight stiffener rib positions perpendicular to L (~250–300 mm spacing).
 * Never generates X-cross beads.
 */
export function computeRibLayout(L: number, enabled: boolean): RibLayout {
  if (!enabled || L < 220) {
    return { enabled, count: 0, pitchMm: 0, zPositionsMm: [] };
  }

  const count = Math.max(1, Math.round(L / 275) - 1);
  const pitchMm = L / (count + 1);
  const zPositionsMm: number[] = [];
  for (let i = 1; i <= count; i++) {
    zPositionsMm.push(-L / 2 + i * pitchMm);
  }
  return {
    enabled: true,
    count,
    pitchMm,
    zPositionsMm,
  };
}

function getEdgeSeamAllowance(
  seam: ResolvedCornerSeam,
  wall: WallId
): { allowance: number; label: string } {
  const isFemaleSide = seam.femaleWall === wall;
  if (seam.seamType === 'pittsburgh') {
    return isFemaleSide
      ? { allowance: PITTSBURGH_FEMALE_ALLOWANCE, label: `Mí kép (+${PITTSBURGH_FEMALE_ALLOWANCE})` }
      : { allowance: PITTSBURGH_MALE_ALLOWANCE, label: `Mí đơn (+${PITTSBURGH_MALE_ALLOWANCE})` };
  }
  if (seam.seamType === 'weld_overlap') {
    return isFemaleSide
      ? { allowance: seam.weldOverlapWidth, label: `Hàn chồng (+${seam.weldOverlapWidth})` }
      : { allowance: 0, label: 'Hàn chồng (+0)' };
  }
  return { allowance: 0, label: 'Hàn đấu đầu (0)' };
}

/**
 * Calculate exact blank sheet dimensions & mass for every piece under current configuration.
 */
export function calculateBlankAnalysis(config: DuctConfig): PieceBlankInfo[] {
  const topologies = getSplitTopologies(config.splitMode);
  const seams = resolveActiveSeams(config);
  const seamMap = new Map<CornerId, ResolvedCornerSeam>(seams.map((s) => [s.cornerId, s]));

  return topologies.map((topo) => {
    const startWall = topo.walls[0];
    const endWall = topo.walls[topo.walls.length - 1];
    const startSeam = seamMap.get(topo.startCorner)!;
    const endSeam = seamMap.get(topo.endCorner)!;

    const startEdge = getEdgeSeamAllowance(startSeam, startWall);
    const endEdge = getEdgeSeamAllowance(endSeam, endWall);

    const wallSpanSum = topo.walls.reduce((sum, w) => sum + getWallLength(w, config.W, config.H), 0);
    const developedWidth = wallSpanSum + startEdge.allowance + endEdge.allowance;
    const blankLength = config.L;
    const bendCount = Math.max(0, topo.walls.length - 1);

    const areaM2 = (developedWidth / 1000) * (blankLength / 1000);
    const weightKg = areaM2 * (config.thickness / 1000) * STEEL_DENSITY_KG_M3;

    let cutOrientation: PieceBlankInfo['cutOrientation'];
    let cutNote: string;

    if (blankLength <= SHEET_STANDARD_WIDTH && developedWidth <= SHEET_STANDARD_LENGTH) {
      cutOrientation = 'ngang_1200';
      cutNote = `Cắt tiêu chuẩn theo khổ 1200 mm (L = ${blankLength} ≤ 1200)`;
    } else if (developedWidth <= SHEET_STANDARD_WIDTH && blankLength <= SHEET_STANDARD_LENGTH) {
      cutOrientation = 'doc_6000x1200';
      cutNote = `Xoay dọc tấm 6000×1200 (Khai triển ${developedWidth} ≤ 1200)`;
    } else {
      cutOrientation = 'can_noi_c';
      cutNote = `Vượt khổ tôn 1200 mm (${developedWidth} × ${blankLength}) — Cần chia nối C (17+17 mm)`;
    }

    return {
      id: topo.id,
      name: topo.name,
      walls: topo.walls,
      wallsLabel: topo.walls.map((w) => WALL_LABELS[w]).join(' + '),
      wallSpanSum,
      startSeamLabel: startEdge.label,
      startAllowance: startEdge.allowance,
      endSeamLabel: endEdge.label,
      endAllowance: endEdge.allowance,
      developedWidth,
      blankLength,
      bendCount,
      areaM2,
      weightKg,
      cutOrientation,
      cutNote,
    };
  });
}

export interface ParsedLsxResult {
  W?: number;
  H?: number;
  L?: number;
  thickness?: SheetThickness;
  suggestWeld?: boolean;
  notes: string[];
}

/**
 * Lightweight Vietnamese LSX straight-duct parser for Stage 1.
 * Example: "Ống gió KT: 500x320, L1110, tôn 0.75, bích TDC"
 */
export function parseStraightDuctLsx(raw: string): ParsedLsxResult {
  const text = raw.trim();
  const notes: string[] = [];
  const result: ParsedLsxResult = { notes };

  // Match WxH (e.g. "KT: 500x320", "1200 x 600", "900×700")
  const whMatch = text.match(/(?:KT[:\s]*)?(\d{2,4})\s*[xX×*]\s*(\d{2,4})/i);
  if (whMatch) {
    const W = Math.min(3000, Math.max(100, Number(whMatch[1])));
    const H = Math.min(3000, Math.max(100, Number(whMatch[2])));
    result.W = W;
    result.H = H;
    notes.push(`Kích thước tiết diện: W=${W} mm, H=${H} mm`);
  }

  // Match L (e.g. "L1110", "L=1540", "L 50", "dài 1200")
  const lMatch = text.match(/(?:\bL\s*[:=]?\s*|dài\s*[:=]?\s*)(\d{2,4})/i);
  if (lMatch) {
    const L = Math.min(3000, Math.max(40, Number(lMatch[1])));
    result.L = L;
    notes.push(`Chiều dài ống: L=${L} mm`);
    if (L < 140) {
      result.suggestWeld = true;
      notes.push('L < 140 mm: Gợi ý cân nhắc chuyển sang Mí hàn');
    }
  }

  // Match thickness (e.g. "t0.75", "t=1.2", "dày 0.95", "tôn 1.5")
  const tMatch = text.match(/(?:tôn|dày|\bt)\s*[:=]?\s*(0\.\d+|1\.\d+)/i);
  if (tMatch) {
    const parsedT = Number(tMatch[1]);
    // Snap to nearest factory standard thickness
    let nearest: SheetThickness = SHEET_THICKNESSES[0];
    let bestDiff = Infinity;
    for (const std of SHEET_THICKNESSES) {
      const diff = Math.abs(std - parsedT);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = std;
      }
    }
    result.thickness = nearest;
    notes.push(`Độ dày tôn: ${nearest} mm`);
  }

  if (/mí\s*hàn|hàn\s*kín|hàn\s*chồng/i.test(text)) {
    result.suggestWeld = true;
    notes.push('LSX có đề cập mí hàn');
  }

  return result;
}
