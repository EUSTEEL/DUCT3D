import type {
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  PieceBlankInfo,
  ResolvedCornerSeam,
  RibLayout,
  SeamType,
  SheetMaterialType,
  SheetThickness,
  SplitMode,
  SplitRecommendation,
  WallId,
  WorkshopSettings,
} from '../types/duct';
import { GALVANIZED_THICKNESSES, INOX_THICKNESSES } from '../types/duct';
import {
  createDefaultEndConnection,
  getEndAllowanceMm,
  getEndCapEdgeSeam,
  getEndCapPanelEdgeAllowance,
  getPieceEndAllowanceMm,
  getEndAllowanceLabel,
} from './endConnectionRules';
import type { FlatPatternDocument } from '../types/flatPattern2d';
import {
  BODY_EDGE_IDS,
  FACE_SHORT_LABELS,
  isBodyWall,
  resolveFoldGraph,
} from '../foldGraph/foldGraph';
import { DEFAULT_WORKSHOP_SETTINGS, getActiveSheetDimensions } from './workshopSettings';

export const GALVANIZED_SHEET_WIDTH = 1200; // mm (tấm chuẩn 1200 × 6000 mm)
export const INOX_SHEET_WIDTH = 1250; // mm (tấm chuẩn 1250 × 6000 mm)
export const SHEET_STANDARD_LENGTH = 6000; // mm
export const PITTSBURGH_FEMALE_ALLOWANCE = 31; // mm (+31 mm)
export const PITTSBURGH_MALE_ALLOWANCE = 7; // mm (+7 mm)

export const SHEET_MATERIAL_LABELS: Record<SheetMaterialType, string> = {
  galvanized: 'Tôn Mạ Kẽm',
  inox: 'Inox',
};

export function getSheetStandardWidth(
  material: SheetMaterialType,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): number {
  return getActiveSheetDimensions(material, settings).widthMm;
}

export function getSheetStandardLength(
  material: SheetMaterialType,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): number {
  return getActiveSheetDimensions(material, settings).lengthMm;
}

export function getAllowedThicknesses(material: SheetMaterialType): readonly SheetThickness[] {
  return material === 'inox' ? INOX_THICKNESSES : GALVANIZED_THICKNESSES;
}

export function normalizeThicknessForMaterial(
  thickness: SheetThickness,
  material: SheetMaterialType
): SheetThickness {
  const allowed = getAllowedThicknesses(material);
  if (allowed.includes(thickness)) return thickness;
  return material === 'inox' ? 0.8 : 0.75;
}

export const WALL_LABELS: Record<WallId, string> = {
  top: 'Trên',
  bottom: 'Dưới',
  left: 'Trái',
  right: 'Phải',
};

export const END_LABELS: Record<'c1' | 'c2', string> = {
  c1: 'Kết nối 1',
  c2: 'Kết nối 2',
};

export const END_DIRECTION_LABELS: Record<'c1' | 'c2', string> = {
  c1: 'Kết nối 1 (Trước)',
  c2: 'Kết nối 2 (Sau)',
};

export const CORNER_SHORT_LABELS: Record<CornerId, string> = {
  TL: 'Trên – Trái',
  TR: 'Trên – Phải',
  BL: 'Dưới – Trái',
  BR: 'Dưới – Phải',
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
  weld_overlap: 'Hàn chập',
  weld_butt: 'Hàn đấu đầu',
};

/** Sequential piece/face code: 0 -> '1-A', 1 -> '1-B', ..., 4 -> '1-E', 5 -> '1-F' */
export function indexToPartCode(index: number): string {
  return `1-${String.fromCharCode(65 + index)}`;
}

export interface DuctPreset {
  id: string;
  label: string;
  subtitle: string;
  W: number;
  H: number;
  L: number;
  sheetMaterial: SheetMaterialType;
  thickness: SheetThickness;
  c1: EndConnectionConfig;
  c2: EndConnectionConfig;
}

export const DUCT_PRESETS: DuctPreset[] = [
  {
    id: 'std-1p',
    label: '500 × 320 • L1100',
    subtitle: '2 đầu TDC/TDF',
    W: 500,
    H: 320,
    L: 1100,
    sheetMaterial: 'galvanized',
    thickness: 0.75,
    c1: createDefaultEndConnection('tdc_tdf'),
    c2: createDefaultEndConnection('tdc_tdf'),
  },
  {
    id: 'tdc-endcap',
    label: '600 × 400 • L1000',
    subtitle: 'TDC/TDF + Bịt đầu kín',
    W: 600,
    H: 400,
    L: 1000,
    sheetMaterial: 'galvanized',
    thickness: 0.75,
    c1: createDefaultEndConnection('end_cap'),
    c2: createDefaultEndConnection('tdc_tdf'),
  },
  {
    id: 'med-2l',
    label: '900 × 600 • L1100',
    subtitle: '2 mảnh L • Bích V40',
    W: 900,
    H: 600,
    L: 1100,
    sheetMaterial: 'galvanized',
    thickness: 0.95,
    c1: createDefaultEndConnection('bich_v_out', { bichVSpec: 'V40x40', bichVOutStyle: 'standard' }),
    c2: createDefaultEndConnection('bich_v_out', { bichVSpec: 'V40x40', bichVOutStyle: 'standard' }),
  },
  {
    id: 'inox-nepc',
    label: '700 × 400 • L1200',
    subtitle: 'Inox 1250 • Nẹp C',
    W: 700,
    H: 400,
    L: 1200,
    sheetMaterial: 'inox',
    thickness: 0.8,
    c1: createDefaultEndConnection('nep_c'),
    c2: createDefaultEndConnection('nep_c'),
  },
  {
    id: 'lcct-bichu',
    label: '800 × 500 • L900',
    subtitle: 'LCCT + Bích U rời',
    W: 800,
    H: 500,
    L: 900,
    sheetMaterial: 'galvanized',
    thickness: 0.95,
    c1: createDefaultEndConnection('lcct', { showLcctMesh: true }),
    c2: createDefaultEndConnection('bich_u', { bichUWrapLeg: 30, bichUFlangeFace: 40 }),
  },
  {
    id: 'plain-ext',
    label: '600 × 350 • L950',
    subtitle: 'Để thẳng +40 + Bẻ chân',
    W: 600,
    H: 350,
    L: 950,
    sheetMaterial: 'galvanized',
    thickness: 0.75,
    c1: createDefaultEndConnection('plain', { plainExtensionMm: 40 }),
    c2: createDefaultEndConnection('be_chan', {
      beChanWidth: 20,
      beChanEdges: { top: 'in', bottom: 'in', left: 'out', right: 'out' },
    }),
  },
];

export const DEFAULT_DUCT_CONFIG: DuctConfig = {
  W: 500,
  H: 320,
  L: 1100,
  sheetMaterial: 'galvanized',
  thickness: 0.75,
  autoSplit: true,
  splitMode: '1_piece',
  freeMergeMode: false,
  customEdgeStates: {},
  globalSeamType: 'pittsburgh',
  weldOverlapWidth: 10,
  swapSeamRoles: false,
  seamOverrides: {},
  c1: createDefaultEndConnection('tdc_tdf'),
  c2: createDefaultEndConnection('tdc_tdf'),
  seamState: 'seamed',
  explode: 0,
  unfoldProgress: 0,
  stiffenerRibs: true,
  showFaceLabels: true,
  materialMode: 'realistic',
};

/**
 * Evaluate automatic piece splitting according to EUSTEEL factory rules (SPEC 3.3),
 * synchronized dynamically with WorkshopSettings sheet size (default 1200×6000 / 1250×6000 mm)
 * AND total blank length L_phôi = L + bù C1 + bù C2, allowing both 0° and 90° cutting orientations.
 */
export function evaluateSplitRecommendation(
  W: number,
  H: number,
  L: number,
  sheetMaterial: SheetMaterialType = 'galvanized',
  c1Allowance = 0,
  c2Allowance = 0,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): SplitRecommendation {
  const { widthMm: sheetW, lengthMm: sheetL } = getActiveSheetDimensions(sheetMaterial, settings);
  const perimeter = 2 * (W + H);
  const halfPerimeter = W + H;
  const blankLength = L + c1Allowance + c2Allowance;
  const onePieceWidth = perimeter + PITTSBURGH_FEMALE_ALLOWANCE + PITTSBURGH_MALE_ALLOWANCE;
  const twoLWidth = halfPerimeter + PITTSBURGH_FEMALE_ALLOWANCE + PITTSBURGH_MALE_ALLOWANCE;
  const maxSideWithFemale = Math.max(W, H) + PITTSBURGH_FEMALE_ALLOWANCE * 2;

  if (blankLength > sheetW) {
    if (blankLength <= sheetL) {
      if (onePieceWidth <= sheetW) {
        return {
          recommended: '1_piece',
          reason: `L_phôi = ${blankLength} mm > ${sheetW} mm nhưng khổ trải ${onePieceWidth} ≤ ${sheetW} mm → Đạt 1 mảnh xoay dọc tấm ${sheetW}×${sheetL}`,
          perimeter,
          halfPerimeter,
          blankLength,
          c1Allowance,
          c2Allowance,
          sheetStandardWidth: sheetW,
          sheetStandardLength: sheetL,
          rotateLongitudinal: true,
          exceedsSheetWidth: false,
        };
      }
      if (twoLWidth <= sheetW) {
        return {
          recommended: '2_piece_L',
          reason: `L_phôi = ${blankLength} mm > ${sheetW} mm, nửa chu vi + mí = ${twoLWidth} ≤ ${sheetW} mm → Đề xuất 2 mảnh L xoay dọc tấm ${sheetW}×${sheetL}`,
          perimeter,
          halfPerimeter,
          blankLength,
          c1Allowance,
          c2Allowance,
          sheetStandardWidth: sheetW,
          sheetStandardLength: sheetL,
          rotateLongitudinal: true,
          exceedsSheetWidth: false,
        };
      }
      if (maxSideWithFemale <= sheetW) {
        return {
          recommended: '4_piece',
          reason: `L_phôi = ${blankLength} mm > ${sheetW} mm, cạnh lớn + mí (${maxSideWithFemale}) ≤ ${sheetW} mm → Đề xuất 4 mảnh xoay dọc tấm ${sheetW}×${sheetL}`,
          perimeter,
          halfPerimeter,
          blankLength,
          c1Allowance,
          c2Allowance,
          sheetStandardWidth: sheetW,
          sheetStandardLength: sheetL,
          rotateLongitudinal: true,
          exceedsSheetWidth: false,
        };
      }
    }
    return {
      recommended: '4_piece',
      reason: `L_phôi = ${blankLength} mm và cạnh lớn + mí (${maxSideWithFemale} mm) vượt khổ ${sheetW}×${sheetL} mm → Đề xuất 4 mảnh kết hợp Nối C (17+17 mm)`,
      perimeter,
      halfPerimeter,
      blankLength,
      c1Allowance,
      c2Allowance,
      sheetStandardWidth: sheetW,
      sheetStandardLength: sheetL,
      rotateLongitudinal: true,
      exceedsSheetWidth: true,
    };
  }

  if (halfPerimeter > 3000 || twoLWidth > sheetL) {
    return {
      recommended: '4_piece',
      reason: `Nửa chu vi W+H = ${halfPerimeter.toLocaleString('vi-VN')} mm > 3.000 mm → Đề xuất chia 4 mảnh`,
      perimeter,
      halfPerimeter,
      blankLength,
      c1Allowance,
      c2Allowance,
      sheetStandardWidth: sheetW,
      sheetStandardLength: sheetL,
      rotateLongitudinal: false,
      exceedsSheetWidth: false,
    };
  }

  if (perimeter > 2400 || onePieceWidth > sheetL) {
    return {
      recommended: '2_piece_L',
      reason: `Chu vi ${perimeter.toLocaleString('vi-VN')} mm > 2.400 mm và W+H = ${halfPerimeter.toLocaleString('vi-VN')} ≤ 3.000 mm → Đề xuất 2 mảnh chữ L`,
      perimeter,
      halfPerimeter,
      blankLength,
      c1Allowance,
      c2Allowance,
      sheetStandardWidth: sheetW,
      sheetStandardLength: sheetL,
      rotateLongitudinal: false,
      exceedsSheetWidth: false,
    };
  }

  return {
    recommended: '1_piece',
    reason: `Chu vi ${perimeter.toLocaleString('vi-VN')} mm ≤ 2.400 mm & L_phôi = ${blankLength} ≤ ${sheetW} mm → Đề xuất 1 mảnh gấp chữ O`,
    perimeter,
    halfPerimeter,
    blankLength,
    c1Allowance,
    c2Allowance,
    sheetStandardWidth: sheetW,
    sheetStandardLength: sheetL,
    rotateLongitudinal: false,
    exceedsSheetWidth: false,
  };
}

export function evaluateSplitForConfig(
  W: number,
  H: number,
  L: number,
  sheetMaterial: SheetMaterialType,
  c1: EndConnectionConfig,
  c2: EndConnectionConfig,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): SplitRecommendation {
  return evaluateSplitRecommendation(
    W,
    H,
    L,
    sheetMaterial,
    getEndAllowanceMm(c1),
    getEndAllowanceMm(c2),
    settings
  );
}

export interface PieceTopology {
  id: string;
  partCode: string; // '1-A', '1-B', '1-C', '1-D'
  name: string;
  /** Walls in strict counter-clockwise order looking from +Z toward -Z */
  walls: WallId[];
  startCorner: CornerId;
  endCorner: CornerId;
}

export function getSplitTopologies(splitMode: SplitMode): PieceTopology[] {
  switch (splitMode) {
    case '1_piece':
      return [
        {
          id: 'P1',
          partCode: '1-A',
          name: 'Mảnh thân chữ O',
          walls: ['top', 'left', 'bottom', 'right'],
          startCorner: 'TR',
          endCorner: 'TR',
        },
      ];
    case '2_piece_L':
      return [
        {
          id: 'L1',
          partCode: '1-A',
          name: 'Mảnh L1 (Trên + Trái)',
          walls: ['top', 'left'],
          startCorner: 'TR',
          endCorner: 'BL',
        },
        {
          id: 'L2',
          partCode: '1-B',
          name: 'Mảnh L2 (Dưới + Phải)',
          walls: ['bottom', 'right'],
          startCorner: 'BL',
          endCorner: 'TR',
        },
      ];
    case '2_piece_UI':
      return [
        {
          id: 'U',
          partCode: '1-A',
          name: 'Mảnh chữ U (Trái + Dưới + Phải)',
          walls: ['left', 'bottom', 'right'],
          startCorner: 'TL',
          endCorner: 'TR',
        },
        {
          id: 'I',
          partCode: '1-B',
          name: 'Mảnh nắp I (Trên)',
          walls: ['top'],
          startCorner: 'TR',
          endCorner: 'TL',
        },
      ];
    case '4_piece':
      return [
        {
          id: 'T',
          partCode: '1-A',
          name: 'Mảnh mặt Trên (W)',
          walls: ['top'],
          startCorner: 'TR',
          endCorner: 'TL',
        },
        {
          id: 'B',
          partCode: '1-B',
          name: 'Mảnh mặt Dưới (W)',
          walls: ['bottom'],
          startCorner: 'BL',
          endCorner: 'BR',
        },
        {
          id: 'L',
          partCode: '1-C',
          name: 'Mảnh hông Trái (H)',
          walls: ['left'],
          startCorner: 'TL',
          endCorner: 'BL',
        },
        {
          id: 'R',
          partCode: '1-D',
          name: 'Mảnh hông Phải (H)',
          walls: ['right'],
          startCorner: 'BR',
          endCorner: 'TR',
        },
      ];
  }
}

/** Resolve sequential part code ('1-B', '1-E', '1-F'...) for an End Cap on C1 or C2 */
export function getEndCapPartCode(config: DuctConfig, endKey: 'c1' | 'c2'): string {
  const graph = resolveFoldGraph(config);
  const comp = graph.faceToComponent.get(endKey === 'c1' ? 'cap_c1' : 'cap_c2');
  if (comp) return comp.partCode;
  const bodyCount = getSplitTopologies(config.splitMode).length;
  if (endKey === 'c1') return indexToPartCode(bodyCount);
  const offset = config.c1.type === 'end_cap' ? 1 : 0;
  return indexToPartCode(bodyCount + offset);
}

/**
 * Resolves active longitudinal corner seams for BOTH standard split modes AND free-merge mode,
 * enforcing factory default female/male orientation (larger side carries Mí kép)
 * while supporting global swap and per-corner overrides.
 */
export function resolveActiveSeams(config: DuctConfig): ResolvedCornerSeam[] {
  const graph = resolveFoldGraph(config);
  const seams: ResolvedCornerSeam[] = [];
  for (const cid of BODY_EDGE_IDS) {
    const edge = graph.edges[cid];
    if (!edge || edge.mode !== 'seam') continue;
    seams.push({
      cornerId: cid,
      label: CORNER_LABELS[cid],
      seamType: edge.seamType,
      weldOverlapWidth: edge.weldOverlapWidth,
      femaleWall: edge.femaleFace as WallId,
      maleWall: edge.maleFace as WallId,
      isOverridden: edge.isOverridden,
    });
  }
  return seams;
}

export function getWallLength(wall: WallId, W: number, H: number): number {
  return wall === 'top' || wall === 'bottom' ? W : H;
}

export const STIFFENER_RIB_PITCH_MM = 210;
export const STIFFENER_RIB_MIN_END_CLEARANCE_MM = 90;

export function computeRibLayout(
  L: number,
  enabled: boolean,
  pitchMm: number = STIFFENER_RIB_PITCH_MM
): RibLayout {
  const safePitch = Math.max(80, Math.min(600, Math.round(pitchMm)));
  if (!enabled || L < 220) {
    return { enabled, count: 0, pitchMm: safePitch, zPositionsMm: [] };
  }

  const usableSpan = L - 2 * STIFFENER_RIB_MIN_END_CLEARANCE_MM;
  const count = Math.max(1, Math.floor(usableSpan / safePitch) + 1);
  const halfSpan = ((count - 1) * safePitch) / 2;
  const zPositionsMm: number[] = [];
  for (let i = 0; i < count; i++) {
    zPositionsMm.push(-halfSpan + i * safePitch);
  }
  return {
    enabled: true,
    count,
    pitchMm: safePitch,
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
      ? { allowance: seam.weldOverlapWidth, label: `Hàn chập (+${seam.weldOverlapWidth})` }
      : { allowance: 0, label: 'Hàn chập (+0)' };
  }
  return { allowance: 0, label: 'Hàn đấu đầu (0)' };
}

function evaluateCutOrientation(
  developedWidth: number,
  blankLength: number,
  sheetW: number,
  sheetL: number
): { cutOrientation: PieceBlankInfo['cutOrientation']; cutNote: string } {
  if (blankLength <= sheetW && developedWidth <= sheetL) {
    return {
      cutOrientation: 'ngang_chuan',
      cutNote: `Đạt — Cắt ngang khổ ${sheetW} mm (${blankLength} ≤ ${sheetW})`,
    };
  }
  if (developedWidth <= sheetW && blankLength <= sheetL) {
    return {
      cutOrientation: 'doc_6000',
      cutNote: `Đạt — Xoay dọc tấm ${sheetW}×${sheetL} (${developedWidth} ≤ ${sheetW})`,
    };
  }
  return {
    cutOrientation: 'can_noi_c',
    cutNote: `Vượt khổ tấm ${sheetW}×${sheetL} (${developedWidth} × ${blankLength}) — Cần chia mảnh hoặc Nối C (17+17 mm)`,
  };
}

function formatEndCapEdgeShort(seam: SeamType, lapW: number): string {
  if (seam === 'pittsburgh') return 'Mí đơn (+7)';
  if (seam === 'weld_overlap') return `Hàn chập (+${lapW})`;
  return 'Hàn đấu đầu (+0)';
}

/**
 * Calculate exact blank sheet dimensions & area (m²) for every piece resolved from
 * the active Face–Edge Graph (supporting standard splits AND free-merge 5/6-face nets!).
 * When `flatDoc` is provided, exact bounding-box dimensions and 2D overlap flags mirror the 2D blueprint 100%.
 * Never calculates or exposes weight (kg).
 */
export function calculateBlankAnalysis(
  config: DuctConfig,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS,
  flatDoc?: FlatPatternDocument
): PieceBlankInfo[] {
  const graph = resolveFoldGraph(config);
  const seams = resolveActiveSeams(config);
  const seamMap = new Map<CornerId, ResolvedCornerSeam>(seams.map((s) => [s.cornerId, s]));
  const { widthMm: sheetW, lengthMm: sheetL } = getActiveSheetDimensions(config.sheetMaterial, settings);
  const flatPieceMap = new Map(flatDoc?.pieces.map((p) => [p.id, p]) ?? []);

  return graph.components.map((comp) => {
    const flatPiece = flatPieceMap.get(comp.id);

    // 1. Standalone detached End Cap panel
    if (comp.isPureEndCap && comp.endCapKey) {
      const endKey = comp.endCapKey;
      const conn = config[endKey];
      const leftA = getEndCapPanelEdgeAllowance(conn, 'left');
      const rightA = getEndCapPanelEdgeAllowance(conn, 'right');
      const topA = getEndCapPanelEdgeAllowance(conn, 'top');
      const botA = getEndCapPanelEdgeAllowance(conn, 'bottom');

      const capW = flatPiece ? Math.round(flatPiece.widthMm * 10) / 10 : config.W + leftA + rightA;
      const capH = flatPiece ? Math.round(flatPiece.heightMm * 10) / 10 : config.H + topA + botA;
      const areaM2 = (capW / 1000) * (capH / 1000);
      const lapW = conn.endCapWeldOverlapWidth;
      const { cutOrientation, cutNote } = evaluateCutOrientation(capW, capH, sheetW, sheetL);
      const bendCount = (['top', 'bottom', 'left', 'right'] as WallId[]).filter(
        (w) => getEndCapEdgeSeam(conn, w) !== 'weld_butt'
      ).length;

      return {
        id: comp.id,
        partCode: comp.partCode,
        name: comp.name,
        isEndCap: true,
        endKey,
        walls: [],
        faces: comp.faces,
        wallsLabel: `Mặt bịt ${config.W} × ${config.H}`,
        wallSpanSum: config.W,
        startSeamLabel: formatEndCapEdgeShort(getEndCapEdgeSeam(conn, 'left'), lapW),
        startAllowance: leftA,
        endSeamLabel: formatEndCapEdgeShort(getEndCapEdgeSeam(conn, 'right'), lapW),
        endAllowance: rightA,
        c1Allowance: topA,
        c1Label: formatEndCapEdgeShort(getEndCapEdgeSeam(conn, 'top'), lapW),
        c2Allowance: botA,
        c2Label: formatEndCapEdgeShort(getEndCapEdgeSeam(conn, 'bottom'), lapW),
        baseLength: config.H,
        developedWidth: capW,
        blankLength: capH,
        bendCount,
        areaM2,
        cutOrientation,
        cutNote,
      };
    }

    // 2. Linear purely body-wall component
    if (comp.isPureBodyLinear && comp.linearBodyWalls && comp.startCorner && comp.endCorner) {
      const walls = comp.linearBodyWalls;
      const startWall = walls[0];
      const endWall = walls[walls.length - 1];
      const startSeam = seamMap.get(comp.startCorner)!;
      const endSeam = seamMap.get(comp.endCorner)!;
      const startEdge = getEdgeSeamAllowance(startSeam, startWall);
      const endEdge = getEdgeSeamAllowance(endSeam, endWall);

      const c1Allowance = getPieceEndAllowanceMm(config.c1, walls);
      const c2Allowance = getPieceEndAllowanceMm(config.c2, walls);
      const c1Label = getEndAllowanceLabel(config.c1, walls);
      const c2Label = getEndAllowanceLabel(config.c2, walls);
      const blankLength = flatPiece ? Math.round(flatPiece.heightMm * 10) / 10 : config.L + c1Allowance + c2Allowance;

      const wallSpanSum = walls.reduce((sum, w) => sum + getWallLength(w, config.W, config.H), 0);
      const developedWidth = flatPiece ? Math.round(flatPiece.widthMm * 10) / 10 : wallSpanSum + startEdge.allowance + endEdge.allowance;
      const bendCount = comp.bendCount;
      const areaM2 = (developedWidth / 1000) * (blankLength / 1000);
      const { cutOrientation, cutNote } = evaluateCutOrientation(developedWidth, blankLength, sheetW, sheetL);

      return {
        id: comp.id,
        partCode: comp.partCode,
        name: comp.name,
        walls,
        faces: comp.faces,
        wallsLabel: walls.map((w) => WALL_LABELS[w]).join(' + '),
        wallSpanSum,
        startSeamLabel: startEdge.label,
        startAllowance: startEdge.allowance,
        endSeamLabel: endEdge.label,
        endAllowance: endEdge.allowance,
        c1Allowance,
        c1Label,
        c2Allowance,
        c2Label,
        baseLength: config.L,
        developedWidth,
        blankLength,
        bendCount,
        areaM2,
        cutOrientation,
        cutNote,
      };
    }

    // 3. Free-merge multi-face tree component (merges body walls + end cap(s) via 90° bends!)
    const walls = comp.faces.filter(isBodyWall);
    const wallSpanSum = walls.reduce((sum, w) => sum + getWallLength(w, config.W, config.H), 0);
    const capExtraH =
      (comp.faces.includes('cap_c1') ? config.H : 0) + (comp.faces.includes('cap_c2') ? config.H : 0);
    const developedWidth = flatPiece
      ? Math.round(flatPiece.widthMm * 10) / 10
      : Math.max(config.W, wallSpanSum) + 38;
    const blankLength = flatPiece
      ? Math.round(flatPiece.heightMm * 10) / 10
      : config.L + capExtraH + 55;
    const areaM2 = (developedWidth / 1000) * (blankLength / 1000);
    const { cutOrientation, cutNote } = evaluateCutOrientation(developedWidth, blankLength, sheetW, sheetL);

    return {
      id: comp.id,
      partCode: comp.partCode,
      name: comp.name,
      isMergedTree: true,
      walls,
      faces: comp.faces,
      wallsLabel: comp.faces.map((f) => FACE_SHORT_LABELS[f]).join(' + '),
      wallSpanSum,
      startSeamLabel: 'Ghép tự do',
      startAllowance: 0,
      endSeamLabel: `${comp.faces.length} mặt liền`,
      endAllowance: 0,
      c1Allowance: getPieceEndAllowanceMm(config.c1, walls.length > 0 ? walls : ['top']),
      c1Label: getEndAllowanceLabel(config.c1, walls.length > 0 ? walls : ['top']),
      c2Allowance: getPieceEndAllowanceMm(config.c2, walls.length > 0 ? walls : ['top']),
      c2Label: getEndAllowanceLabel(config.c2, walls.length > 0 ? walls : ['top']),
      baseLength: config.L,
      developedWidth,
      blankLength,
      bendCount: comp.bendCount,
      areaM2,
      cutOrientation,
      cutNote,
      hasOverlap2D: flatPiece?.hasOverlap2D,
      overlapWarning: flatPiece?.overlapWarning,
    };
  });
}

export interface ParsedLsxResult {
  W?: number;
  H?: number;
  L?: number;
  sheetMaterial?: SheetMaterialType;
  thickness?: SheetThickness;
  c1?: EndConnectionConfig;
  c2?: EndConnectionConfig;
  suggestWeld?: boolean;
  notes: string[];
}

/**
 * Vietnamese LSX straight-duct parser supporting dimensions, material (Tôn / Inox),
 * thickness, and Stage 2 end connections (TDC/TDF, Nẹp C, Bích V ngoài/trong/V80x30,
 * Bích U, Để thẳng +L_thẳng, Bẻ chân, LCCT, Bịt đầu).
 */
export function parseStraightDuctLsx(
  raw: string,
  currentMaterial: SheetMaterialType = 'galvanized'
): ParsedLsxResult {
  const text = raw.trim();
  const notes: string[] = [];
  const result: ParsedLsxResult = { notes };

  let targetMat: SheetMaterialType = currentMaterial;
  if (/\binox\b|sus\s*304|sus\s*201|sus\s*316/i.test(text)) {
    targetMat = 'inox';
    result.sheetMaterial = 'inox';
    notes.push('Vật liệu: Inox (khổ chuẩn 1250 mm)');
  } else if (/tôn\s*mạ\s*kẽm|\btôn\b/i.test(text)) {
    targetMat = 'galvanized';
    result.sheetMaterial = 'galvanized';
    notes.push('Vật liệu: Tôn Mạ Kẽm (khổ chuẩn 1200 mm)');
  }

  const whMatch = text.match(/(?:KT[:\s]*)?(\d{2,4})\s*[xX×*]\s*(\d{2,4})/i);
  if (whMatch) {
    result.W = Math.min(3000, Math.max(100, Number(whMatch[1])));
    result.H = Math.min(3000, Math.max(100, Number(whMatch[2])));
    notes.push(`Kích thước tiết diện: W=${result.W} mm, H=${result.H} mm`);
  }

  const lMatch = text.match(/(?:\bL\s*[:=]?\s*|dài\s*[:=]?\s*)(\d{2,4})/i);
  if (lMatch) {
    result.L = Math.min(3000, Math.max(40, Number(lMatch[1])));
    notes.push(`Chiều dài ống: L=${result.L} mm`);
    if (result.L < 140) {
      result.suggestWeld = true;
      notes.push('L < 140 mm: Gợi ý cân nhắc chuyển sang Mí hàn');
    }
  }

  const tMatch = text.match(/(?:tôn|inox|dày|\bt)\s*[:=]?\s*(0\.\d+|1\.\d+)/i);
  if (tMatch) {
    const parsedT = Number(tMatch[1]);
    const allowed = getAllowedThicknesses(targetMat);
    let nearest: SheetThickness = allowed[0];
    let bestDiff = Infinity;
    for (const std of allowed) {
      const diff = Math.abs(std - parsedT);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = std;
      }
    }
    result.thickness = nearest;
    notes.push(`Độ dày ${SHEET_MATERIAL_LABELS[targetMat]}: ${nearest} mm`);
  }

  // Detect end connection patterns
  const plainExtMatch = text.match(/để\s*thẳng\s*\+?(\d{1,3})/i);
  const plainExt = plainExtMatch ? Math.min(300, Number(plainExtMatch[1])) : 0;

  if (/1\s*đầu\s*(?:bích\s*)?td[cf].*1\s*đầu\s*(?:để\s*thẳng|trơn)/i.test(text)) {
    result.c1 = createDefaultEndConnection('tdc_tdf');
    result.c2 = createDefaultEndConnection('plain', { plainExtensionMm: plainExt });
    notes.push(
      `Đầu kết nối: Kết nối 1 TDC/TDF, Kết nối 2 Để thẳng${plainExt > 0 ? ` (+${plainExt} mm)` : ''}`
    );
  } else if (/bích\s*v\s*(?:quay\s*)?trong/i.test(text)) {
    result.c1 = createDefaultEndConnection('bich_v_in');
    result.c2 = createDefaultEndConnection('bich_v_in');
    notes.push('Đầu kết nối: 2 đầu Bích V quay trong');
  } else if (/v80\s*[x×]\s*30/i.test(text)) {
    result.c1 = createDefaultEndConnection('bich_v_out', { bichVSpec: 'V80x30' });
    result.c2 = createDefaultEndConnection('bich_v_out', { bichVSpec: 'V80x30' });
    notes.push('Đầu kết nối: 2 đầu Bích V80×30 (cánh 30 lọt lòng W−3 × H−3)');
  } else if (/bích\s*v/i.test(text)) {
    result.c1 = createDefaultEndConnection('bich_v_out');
    result.c2 = createDefaultEndConnection('bich_v_out');
    notes.push('Đầu kết nối: 2 đầu Bích V quay ngoài');
  } else if (/bích\s*u/i.test(text)) {
    result.c1 = createDefaultEndConnection('bich_u');
    result.c2 = createDefaultEndConnection('bich_u');
    notes.push('Đầu kết nối: 2 đầu Bích U rời');
  } else if (/bích\s*td[cf]|tdc\/tdf/i.test(text)) {
    result.c1 = createDefaultEndConnection('tdc_tdf');
    result.c2 = createDefaultEndConnection('tdc_tdf');
    notes.push('Đầu kết nối: 2 đầu Bích TDC/TDF');
  } else if (/nẹp\s*c|\bnc\b/i.test(text)) {
    result.c1 = createDefaultEndConnection('nep_c');
    result.c2 = createDefaultEndConnection('nep_c');
    notes.push('Đầu kết nối: 2 đầu Nẹp C liền thân');
  } else if (plainExtMatch) {
    result.c1 = createDefaultEndConnection('plain', { plainExtensionMm: plainExt });
    notes.push(`Kết nối 1: Để thẳng (+${plainExt} mm không chạy mí)`);
  }

  if (/bịt\s*đầu|bịt\s*kín|end\s*cap/i.test(text)) {
    result.c1 = createDefaultEndConnection('end_cap');
    notes.push('Kết nối 1: Bịt đầu kín');
  }
  if (/lcct|lưới\s*chắn\s*côn\s*trùng/i.test(text)) {
    result.c1 = createDefaultEndConnection('lcct');
    notes.push('Kết nối 1: Lưới chắn côn trùng (LCCT)');
  }

  if (/mí\s*hàn|hàn\s*kín|hàn\s*chập|hàn\s*đấu\s*đầu/i.test(text)) {
    result.suggestWeld = true;
    notes.push('LSX có đề cập mí hàn');
  }

  return result;
}
