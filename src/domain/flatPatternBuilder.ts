import type {
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  ResolvedCornerSeam,
  SeamType,
  WallId,
  WorkshopSettings,
} from '../types/duct';
import type {
  Callout2D,
  Dimension2D,
  FlatPatternDocument,
  FlatPatternPiece,
  Line2D,
  Point2D,
  SheetLimitCheck2D,
  WallRegionLabel2D,
  ZoneFill2D,
  ZoneFillKind,
} from '../types/flatPattern2d';
import {
  PITTSBURGH_FEMALE_ALLOWANCE,
  PITTSBURGH_MALE_ALLOWANCE,
  SHEET_MATERIAL_LABELS,
  WALL_LABELS,
  computeRibLayout,
  getEndCapPartCode,
  getSplitTopologies,
  getWallLength,
  resolveActiveSeams,
} from './ductRules';
import {
  END_CONNECTION_SHORT_LABELS,
  bichVHasTurnedLip,
  getBichVDimensions,
  getEndCapEdgeSeam,
  getEndCapPanelEdgeAllowance,
  getPieceEndAllowanceMm,
  getWallEndAllowanceMm,
} from './endConnectionRules';
import { DEFAULT_WORKSHOP_SETTINGS, getActiveSheetDimensions } from './workshopSettings';

export const ROLL_FORMER_LIMIT_MM = DEFAULT_WORKSHOP_SETTINGS.rollFormerLimitMm;

function fmtMm(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

function dedupePolygon(pts: Point2D[]): Point2D[] {
  const out: Point2D[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.05) {
      out.push({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) });
    }
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.05) {
      out.pop();
    }
  }
  return out;
}

interface EdgeSeamDetail {
  allowance: number;
  seamType: SeamType;
  isFemaleSide: boolean;
  label: string;
  shortDim: string;
  zoneKind: ZoneFillKind | null;
}

function getEdgeSeamDetail(seam: ResolvedCornerSeam, wall: WallId): EdgeSeamDetail {
  const isFemaleSide = seam.femaleWall === wall;
  if (seam.seamType === 'pittsburgh') {
    if (isFemaleSide) {
      return {
        allowance: PITTSBURGH_FEMALE_ALLOWANCE,
        seamType: 'pittsburgh',
        isFemaleSide: true,
        label: `Mí kép (+${PITTSBURGH_FEMALE_ALLOWANCE})`,
        shortDim: `+${PITTSBURGH_FEMALE_ALLOWANCE}`,
        zoneKind: 'female_seam',
      };
    }
    return {
      allowance: PITTSBURGH_MALE_ALLOWANCE,
      seamType: 'pittsburgh',
      isFemaleSide: false,
      label: `Mí đơn (+${PITTSBURGH_MALE_ALLOWANCE})`,
      shortDim: `+${PITTSBURGH_MALE_ALLOWANCE}`,
      zoneKind: 'male_seam',
    };
  }
  if (seam.seamType === 'weld_overlap') {
    if (isFemaleSide) {
      return {
        allowance: seam.weldOverlapWidth,
        seamType: 'weld_overlap',
        isFemaleSide: true,
        label: `Hàn chập (+${seam.weldOverlapWidth})`,
        shortDim: `+${seam.weldOverlapWidth}`,
        zoneKind: 'weld_seam',
      };
    }
    return {
      allowance: 0,
      seamType: 'weld_overlap',
      isFemaleSide: false,
      label: 'Hàn chập (+0)',
      shortDim: '0',
      zoneKind: null,
    };
  }
  return {
    allowance: 0,
    seamType: 'weld_butt',
    isFemaleSide: false,
    label: 'Hàn đấu đầu (0)',
    shortDim: '0',
    zoneKind: null,
  };
}

/**
 * How deep (mm) the corner notch cuts INSIDE the duct body length L along the longitudinal seam margin
 * at a given end connection.
 */
function getSeamNotchDepthIntoBody(conn: EndConnectionConfig): number {
  switch (conn.type) {
    case 'tdc_tdf':
      return 12; // Khấu tổng 60 mm = 48 mm bích + 12 mm vào thân L
    case 'nep_c':
      return 12.5; // Khấu góc 25 mm = 12.5 mm mép uốn + 12.5 mm vào thân L
    case 'bich_v_out': {
      if (conn.bichVSpec === 'V80x30') return 0;
      const { vSize } = getBichVDimensions(conn.bichVSpec);
      return vSize + 5; // V30 -> 35 (+8 = 43), V40 -> 45 (+8 = 53), V50 -> 55 (+8 = 63); EI -> V+5
    }
    case 'bich_v_in': {
      const spec = conn.bichVSpec === 'V80x30' ? 'V40x40' : conn.bichVSpec;
      const { vSize } = getBichVDimensions(spec);
      return vSize + 5;
    }
    case 'bich_u':
    case 'lcct':
    case 'be_chan':
    case 'plain':
    case 'end_cap':
      return 0;
  }
}

function getEndNotchBadge(conn: EndConnectionConfig, endTag: 'C1' | 'C2'): string | null {
  switch (conn.type) {
    case 'tdc_tdf':
      return `${endTag}: TDC/TDF +48 • Khấu góc 60 (48+12) • Khe bẻ 2 mm${conn.showEndIndent ? ' • Vết V cạnh tai (TDF)' : ''}`;
    case 'nep_c':
      return `${endTag}: Nẹp C +12.5 • Khấu góc 25 (12.5+12.5)`;
    case 'bich_v_out': {
      if (conn.bichVSpec === 'V80x30') return `${endTag}: V80×30 lọt lòng (+0)`;
      const { vSize } = getBichVDimensions(conn.bichVSpec);
      const n = vSize + 5;
      if (conn.bichVOutStyle === 'ei') {
        return `${endTag}: ${conn.bichVSpec} EI (+0) • Khấu góc ${n}`;
      }
      return `${endTag}: ${conn.bichVSpec} (+8) • Khấu góc ${n}+8 (${n + 8})`;
    }
    case 'bich_v_in': {
      const spec = conn.bichVSpec === 'V80x30' ? 'V40x40' : conn.bichVSpec;
      const { vSize } = getBichVDimensions(spec);
      return `${endTag}: ${spec} quay trong (+0) • Khấu mí ${vSize + 5}`;
    }
    case 'bich_u':
      return `${endTag}: Bích U rời • Cắt thẳng (+0)`;
    case 'lcct':
      return `${endTag}: LCCT +20 • Vát góc 45° chấn vào trong`;
    case 'be_chan':
      return `${endTag}: Bẻ chân F=${conn.beChanWidth} mm (ghép vuông đối đầu)`;
    case 'plain':
      return conn.plainExtensionMm > 0
        ? `${endTag}: Để thẳng +${conn.plainExtensionMm} mm • Hết mí dọc trước đoạn kéo dài`
        : `${endTag}: Để thẳng (+0)`;
    case 'end_cap':
      return `${endTag}: Đầu bịt kín`;
  }
}

/**
 * Evaluates blank against standard sheet dimensions (W_tấm × L_tấm, allowing 0° or 90° rotation)
 * AND against the roll-former beading limit ONLY along the dimension perpendicular to ribs (`rollCheckSpanMm`).
 */
function evaluateSheetLimit(
  widthMm: number,
  heightMm: number,
  sheetWidthMm: number,
  sheetLengthMm: number,
  rollFormerLimitMm: number,
  hasRibs: boolean,
  rollCheckSpanMm: number
): SheetLimitCheck2D {
  const shortSide = Math.min(widthMm, heightMm);
  const longSide = Math.max(widthMm, heightMm);
  const fitsHorizontal = heightMm <= sheetWidthMm && widthMm <= sheetLengthMm;
  const fitsRotated = widthMm <= sheetWidthMm && heightMm <= sheetLengthMm;
  const exceedsSheetLimit = !(fitsHorizontal || fitsRotated);
  const requiresNoiC = shortSide > sheetWidthMm;
  const exceedsRollFormer = hasRibs && rollCheckSpanMm > rollFormerLimitMm;

  if (exceedsSheetLimit) {
    const statusText =
      longSide > sheetLengthMm && shortSide <= sheetWidthMm
        ? `VƯỢT CHIỀU DÀI TẤM ${sheetLengthMm} mm (${fmtMm(widthMm)} × ${fmtMm(heightMm)} mm) — Cần chia mảnh`
        : `VƯỢT KHỔ ${sheetWidthMm}×${sheetLengthMm} (${fmtMm(widthMm)} × ${fmtMm(heightMm)} mm) — Cần chia mảnh hoặc Nối C (17+17)`;
    return {
      sheetWidthMm,
      sheetLengthMm,
      rollFormerLimitMm,
      orientation: 'vuot_kho',
      exceedsSheetLimit: true,
      requiresNoiC,
      exceedsRollFormer,
      statusText,
      severity: 'danger',
    };
  }

  const orientation: SheetLimitCheck2D['orientation'] = fitsHorizontal ? 'ngang_chuan' : 'doc_6000';

  if (exceedsRollFormer) {
    return {
      sheetWidthMm,
      sheetLengthMm,
      rollFormerLimitMm,
      orientation,
      exceedsSheetLimit: false,
      requiresNoiC: false,
      exceedsRollFormer: true,
      statusText: `Vượt khổ máy lăn gân ${rollFormerLimitMm} mm (chiều vuông góc gân ${fmtMm(rollCheckSpanMm)} > ${rollFormerLimitMm} mm)`,
      severity: 'warn',
    };
  }

  return {
    sheetWidthMm,
    sheetLengthMm,
    rollFormerLimitMm,
    orientation,
    exceedsSheetLimit: false,
    requiresNoiC: false,
    exceedsRollFormer: false,
    statusText: fitsHorizontal
      ? `Đạt — Cắt ngang khổ ${sheetWidthMm} mm (${fmtMm(widthMm)} × ${fmtMm(heightMm)} mm)`
      : `Đạt — Xoay dọc tấm ${sheetWidthMm}×${sheetLengthMm} (${fmtMm(widthMm)} ≤ ${sheetWidthMm} mm)`,
    severity: 'ok',
  };
}

/** Adjacent wall on the CW (-1) or CCW (+1) side around the duct cross-section */
function getAdjacentWallCCW(wall: WallId, dir: -1 | 1): WallId {
  // Note: piece wall order is CCW looking from +Z -> -Z: top -> left -> bottom -> right
  const seq: WallId[] = ['top', 'left', 'bottom', 'right'];
  const idx = seq.indexOf(wall);
  return seq[(idx + (dir === 1 ? 1 : 3)) % 4];
}

/**
 * Generates clockwise-ordered Left->Right perimeter points along ONE end of a body piece
 * (C2 top: dirY = -1; C1 bottom: dirY = +1, then reversed by caller for clockwise traversal).
 * Geometries strictly follow real factory workshop photos & CAD drawings in REF_NOTES.md.
 */
function buildEndEdgePointsLR(
  walls: readonly WallId[],
  wallX0: readonly number[],
  wallX1: readonly number[],
  conn: EndConnectionConfig,
  yBody: number,
  dirY: -1 | 1,
  sAllow: number,
  eAllow: number,
  seamNotchDepth: number,
  L: number,
  endTag: 'C1' | 'C2'
): {
  points: Point2D[];
  bendApexY: number[];
  zoneFills: ZoneFill2D[];
  foldLines: Line2D[];
  extraCallouts: Callout2D[];
  squareSeamTermination: boolean;
  leftSeamLineY: number;
  rightSeamLineY: number;
} {
  const n = walls.length;
  const points: Point2D[] = [];
  const bendApexY: number[] = [];
  const zoneFills: ZoneFill2D[] = [];
  const foldLines: Line2D[] = [];
  const extraCallouts: Callout2D[] = [];

  const dBody = Math.min(seamNotchDepth, Math.max(4, L * 0.38));
  const ySeamEnd = yBody - dirY * dBody;

  // Factory TDC/TDF & Bích V turned-lip use crisp 90° square step cuts from the longitudinal seam edge
  const squareSeamTermination =
    conn.type === 'tdc_tdf' || (conn.type === 'bich_v_out' && bichVHasTurnedLip(conn));

  // Start point meets the left longitudinal seam termination squarely at (wallX0[0], ySeamEnd)
  points.push({ x: wallX0[0], y: ySeamEnd });

  for (let i = 0; i < n; i++) {
    const wall = walls[i];
    const x0 = wallX0[i];
    const x1 = wallX1[i];
    const span = x1 - x0;
    const a = getWallEndAllowanceMm(conn, wall);
    const yFlange = yBody + dirY * a;
    const isFirst = i === 0;
    const isLast = i === n - 1;

    if (conn.type === 'tdc_tdf') {
      // Exact factory TDC/TDF profile (REF_NOTES.md #1–#8):
      // - Outer corners: sharp 90° step from seam edge -> straight 12 mm body recess -> tiny ~1.5 mm jog at yBody -> straight 48 mm flange side -> crisp 90° outer corner.
      // - Optional TDF V-indent: tiny triangular V-notch ON THE SIDE EDGE of the +48 mm flange tab!
      // - Interior 90° bend slots: exact 2 mm parallel slot (±1 mm from bend line) ending in a tiny sharp V-point right on the bend line!
      const notchIn = dBody; // 12 mm into body -> total depth 48 + 12 = 60 mm
      const yNotchRoot = yBody - dirY * notchIn;
      const stepIn = Math.min(1.5, span * 0.03);
      const stepHalfY = Math.min(1.0, notchIn * 0.25);
      const slotHalf = Math.min(1.0, span * 0.04); // exact 2.0 mm wide bend slot!
      const vTip = Math.min(2.0, notchIn * 0.35);

      const fx0 = isFirst ? x0 + stepIn : x0 + slotHalf;
      const fx1 = isLast ? x1 - stepIn : x1 - slotHalf;

      // TDF V-indent parameters on the SIDE edge of the +48 mm flange tab (~18 mm from outer tip)
      const vCenterY = yFlange - dirY * Math.min(18, a * 0.38);
      const vHalfW = 3.5;
      const vDepth = Math.min(3.5, (fx1 - fx0) * 0.08);
      const hasSideV = conn.showEndIndent && a >= 24 && fx1 - fx0 >= 60;

      if (isFirst) {
        // Straight 12 mm body recess along x0 -> tiny ~1.5 mm inward jog at yBody -> straight 48 mm side edge
        points.push(
          { x: x0, y: yNotchRoot },
          { x: x0, y: yBody - dirY * stepHalfY },
          { x: fx0, y: yBody + dirY * stepHalfY }
        );
        if (hasSideV) {
          points.push(
            { x: fx0, y: vCenterY - dirY * vHalfW },
            { x: fx0 + vDepth, y: vCenterY },
            { x: fx0, y: vCenterY + dirY * vHalfW }
          );
          extraCallouts.push({
            x: fx0 + 18,
            y: vCenterY,
            text: `← V-lõm TDF (${endTag})`,
            align: 'start',
            tone: 'amber',
          });
        }
        points.push({ x: fx0, y: yFlange });
      } else {
        // Rising wall of exact 2 mm interior bend slot (from tiny V-point shoulder straight to yFlange)
        const yVStartL = yNotchRoot + dirY * vTip;
        points.push({ x: fx0, y: yVStartL }, { x: fx0, y: yFlange });
      }

      if (!isLast) {
        // Falling wall of exact 2 mm interior bend slot -> tiny crisp V-point right on bend line x1
        const yVStartR = yNotchRoot + dirY * vTip;
        points.push({ x: fx1, y: yFlange }, { x: fx1, y: yVStartR }, { x: x1, y: yNotchRoot });
        bendApexY.push(yNotchRoot);
      } else {
        // Outer right edge: crisp 90° corner -> straight 48 mm side edge (with optional TDF V-indent) -> tiny ~1.5 mm jog -> straight 12 mm body recess
        points.push({ x: fx1, y: yFlange });
        if (hasSideV) {
          points.push(
            { x: fx1, y: vCenterY + dirY * vHalfW },
            { x: fx1 - vDepth, y: vCenterY },
            { x: fx1, y: vCenterY - dirY * vHalfW }
          );
        }
        points.push(
          { x: fx1, y: yBody + dirY * stepHalfY },
          { x: x1, y: yBody - dirY * stepHalfY },
          { x: x1, y: yNotchRoot }
        );
      }

      zoneFills.push({
        kind: 'flange',
        points: [
          { x: fx0, y: yBody },
          { x: fx0, y: yFlange },
          { x: fx1, y: yFlange },
          { x: fx1, y: yBody },
        ],
      });
      foldLines.push({ x1: fx0, y1: yBody, x2: fx1, y2: yBody });
    } else if (conn.type === 'nep_c') {
      // Nẹp C (+12.5 mm): runs corner-to-corner with tight ~1.5–2 mm corner clearance (REF_NOTES.md #28–#31)
      const notchIn = Math.min(12.5, Math.max(4, L * 0.25));
      const slotHalf = Math.min(1.5, span * 0.05);
      const trimL = Math.min(1.8, span * 0.05);
      const trimR = Math.min(1.8, span * 0.05);

      if (isFirst) {
        if (sAllow > 0) {
          points.push({ x: x0, y: yBody }, { x: x0 + trimL, y: yBody }, { x: x0 + trimL, y: yFlange });
        } else {
          points.push({ x: x0 + trimL, y: yBody - dirY * notchIn }, { x: x0 + trimL, y: yFlange });
        }
      } else {
        points.push({ x: x0 + slotHalf, y: yBody }, { x: x0 + slotHalf, y: yFlange });
      }

      if (!isLast) {
        const apexY = yBody - dirY * notchIn;
        points.push(
          { x: x1 - slotHalf, y: yFlange },
          { x: x1 - slotHalf, y: yBody },
          { x: x1, y: apexY }
        );
        bendApexY.push(apexY);
      } else {
        if (eAllow > 0) {
          points.push(
            { x: x1 - trimR, y: yFlange },
            { x: x1 - trimR, y: yBody },
            { x: x1, y: yBody },
            { x: x1, y: ySeamEnd }
          );
        } else {
          points.push(
            { x: x1 - trimR, y: yFlange },
            { x: x1 - trimR, y: yBody - dirY * notchIn },
            { x: x1, y: ySeamEnd }
          );
        }
      }

      zoneFills.push({
        kind: 'flange',
        points: [
          { x: x0 + (isFirst ? trimL : slotHalf), y: yBody },
          { x: x0 + (isFirst ? trimL : slotHalf), y: yFlange },
          { x: x1 - (isLast ? trimR : slotHalf), y: yFlange },
          { x: x1 - (isLast ? trimR : slotHalf), y: yBody },
        ],
      });
      foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
    } else if (conn.type === 'bich_v_out' && bichVHasTurnedLip(conn)) {
      // Bích V quay ngoài (+8 mm lip): sharp 90° seam step -> straight edge with tiny ~1.5 mm inward tip recess
      // (REF_NOTES.md #18: khấu_bẻ_ra_của_bích_V_quay_ngoài,_lõm_ở_góc_nhọn_một_chút.png)
      const bendNotchIn = Math.min(8, Math.max(4, L * 0.2));
      const slotHalf = Math.min(1.5, span * 0.05);
      const lipStep = Math.min(2.0, span * 0.04);
      const tipRecess = Math.min(1.5, span * 0.04);
      const yTipJog = yFlange - dirY * Math.min(1.8, a * 0.3);

      if (isFirst) {
        const fxBase = x0 + lipStep;
        const fxTip = fxBase + tipRecess;
        points.push(
          { x: x0, y: ySeamEnd },
          { x: x0, y: yBody },
          { x: fxBase, y: yBody },
          { x: fxBase, y: yTipJog },
          { x: fxTip, y: yTipJog },
          { x: fxTip, y: yFlange }
        );
      } else {
        points.push({ x: x0 + slotHalf, y: yBody }, { x: x0 + slotHalf, y: yFlange });
      }

      if (!isLast) {
        const apexY = yBody - dirY * bendNotchIn;
        points.push(
          { x: x1 - slotHalf, y: yFlange },
          { x: x1 - slotHalf, y: yBody },
          { x: x1, y: apexY }
        );
        bendApexY.push(apexY);
      } else {
        const fxBase = x1 - lipStep;
        const fxTip = fxBase - tipRecess;
        points.push(
          { x: fxTip, y: yFlange },
          { x: fxTip, y: yTipJog },
          { x: fxBase, y: yTipJog },
          { x: fxBase, y: yBody },
          { x: x1, y: yBody },
          { x: x1, y: ySeamEnd }
        );
      }

      zoneFills.push({
        kind: 'flange',
        points: [
          { x: x0 + (isFirst ? lipStep : slotHalf), y: yBody },
          { x: x0 + (isFirst ? lipStep + tipRecess : slotHalf), y: yFlange },
          { x: x1 - (isLast ? lipStep + tipRecess : slotHalf), y: yFlange },
          { x: x1 - (isLast ? lipStep : slotHalf), y: yBody },
        ],
      });
      foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
    } else if (conn.type === 'lcct') {
      const ch = Math.min(18, span * 0.24);
      if (isFirst) {
        points.push({ x: x0, y: yBody }, { x: x0 + ch, y: yFlange });
      } else {
        points.push({ x: x0 + ch, y: yFlange });
      }
      if (!isLast) {
        const apexY = yBody - dirY * 4;
        points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: apexY });
        bendApexY.push(apexY);
      } else {
        points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: yBody });
      }
      zoneFills.push({
        kind: 'flange',
        points: [
          { x: x0, y: yBody },
          { x: x0 + ch, y: yFlange },
          { x: x1 - ch, y: yFlange },
          { x: x1, y: yBody },
        ],
      });
      foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
    } else if (conn.type === 'be_chan') {
      const mode = conn.beChanEdges[wall];
      const leftWall = getAdjacentWallCCW(wall, -1);
      const rightWall = getAdjacentWallCCW(wall, 1);
      const apexY = yBody - dirY * 4;

      if (mode === 'straight') {
        if (!isFirst) {
          points.push({ x: x0 + 2, y: yBody });
        } else {
          points.push({ x: x0, y: yBody });
        }
        if (!isLast) {
          points.push({ x: x1 - 2, y: yBody }, { x: x1, y: apexY });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1, y: yBody });
        }
      } else if (mode === 'in') {
        // Factory square butt-joint (REF_NOTES.md #34–#35: bẻ_chân_vào_trong_1.jpg):
        // Top & Bottom run full width to corners (~1.5 mm relief); Left & Right trim squarely by F where adjacent wall is also 'in'!
        const isHoriz = wall === 'top' || wall === 'bottom';
        const sqTrimL = !isHoriz && conn.beChanEdges[leftWall] === 'in'
          ? Math.min(a + 1.5, span * 0.38)
          : Math.min(1.5, span * 0.05);
        const sqTrimR = !isHoriz && conn.beChanEdges[rightWall] === 'in'
          ? Math.min(a + 1.5, span * 0.38)
          : Math.min(1.5, span * 0.05);

        if (isFirst) {
          points.push(
            { x: x0, y: yBody },
            { x: x0 + sqTrimL, y: yBody },
            { x: x0 + sqTrimL, y: yFlange }
          );
        } else {
          points.push({ x: x0 + sqTrimL, y: yBody }, { x: x0 + sqTrimL, y: yFlange });
        }
        if (!isLast) {
          points.push(
            { x: x1 - sqTrimR, y: yFlange },
            { x: x1 - sqTrimR, y: yBody },
            { x: x1, y: apexY }
          );
          bendApexY.push(apexY);
        } else {
          points.push(
            { x: x1 - sqTrimR, y: yFlange },
            { x: x1 - sqTrimR, y: yBody },
            { x: x1, y: yBody }
          );
        }
        zoneFills.push({
          kind: 'flange',
          points: [
            { x: x0 + sqTrimL, y: yBody },
            { x: x0 + sqTrimL, y: yFlange },
            { x: x1 - sqTrimR, y: yFlange },
            { x: x1 - sqTrimR, y: yBody },
          ],
        });
        foldLines.push({ x1: x0 + sqTrimL, y1: yBody, x2: x1 - sqTrimR, y2: yBody });
      } else {
        // mode === 'out'
        const clr = Math.min(2.0, span * 0.06);
        if (isFirst) {
          points.push({ x: x0, y: yBody }, { x: x0 + clr, y: yBody }, { x: x0 + clr, y: yFlange });
        } else {
          points.push({ x: x0 + clr, y: yBody }, { x: x0 + clr, y: yFlange });
        }
        if (!isLast) {
          points.push({ x: x1 - clr, y: yFlange }, { x: x1 - clr, y: yBody }, { x: x1, y: apexY });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1 - clr, y: yFlange }, { x: x1 - clr, y: yBody }, { x: x1, y: yBody });
        }
        zoneFills.push({
          kind: 'flange',
          points: [
            { x: x0 + clr, y: yBody },
            { x: x0 + clr, y: yFlange },
            { x: x1 - clr, y: yFlange },
            { x: x1 - clr, y: yBody },
          ],
        });
        foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
      }
    } else if (conn.type === 'end_cap') {
      const es = getEndCapEdgeSeam(conn, wall);
      const apexY = yBody - dirY * 4;
      if (es === 'pittsburgh') {
        const ch = Math.min(3.5, span * 0.08);
        if (isFirst) {
          points.push({ x: x0, y: yBody }, { x: x0 + ch, y: yFlange });
        } else {
          points.push({ x: x0 + ch, y: yFlange });
        }
        if (!isLast) {
          points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: apexY });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: yBody });
        }
        zoneFills.push({
          kind: 'female_seam',
          points: [
            { x: x0, y: yBody },
            { x: x0 + ch, y: yFlange },
            { x: x1 - ch, y: yFlange },
            { x: x1, y: yBody },
          ],
        });
        foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
      } else {
        if (!isFirst) points.push({ x: x0 + 2, y: yBody });
        else points.push({ x: x0, y: yBody });
        if (!isLast) {
          points.push({ x: x1 - 2, y: yBody }, { x: x1, y: apexY });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1, y: yBody });
        }
      }
    } else if (conn.type === 'plain' && a > 0) {
      // Seamless straight extension (+L_thẳng): longitudinal seams STOP at yBody!
      if (isFirst) {
        points.push({ x: x0, y: yBody }, { x: x0, y: yFlange });
      } else {
        points.push({ x: x0 + 2, y: yFlange });
      }
      if (!isLast) {
        const apexY = yFlange - dirY * 4;
        points.push({ x: x1 - 2, y: yFlange }, { x: x1, y: apexY });
        bendApexY.push(apexY);
      } else {
        points.push({ x: x1, y: yFlange }, { x: x1, y: yBody });
      }
      zoneFills.push({
        kind: 'plain_ext',
        points: [
          { x: x0, y: yBody },
          { x: x0, y: yFlange },
          { x: x1, y: yFlange },
          { x: x1, y: yBody },
        ],
      });
      foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
    } else {
      // Flush cut (+0 mm): bich_u, plain (0), V80x30, bich_v_out EI, bich_v_in
      const hasCornerCut = dBody > 0;
      const trimL = hasCornerCut && sAllow === 0 ? Math.min(8, span * 0.1) : 0;
      const trimR = hasCornerCut && eAllow === 0 ? Math.min(8, span * 0.1) : 0;
      if (isFirst) {
        if (trimL > 0) {
          points.push({ x: x0 + trimL, y: ySeamEnd }, { x: x0 + trimL, y: yBody });
        } else {
          points.push({ x: x0, y: yBody });
        }
      } else {
        points.push({ x: x0 + 2, y: yBody });
      }
      if (!isLast) {
        const apexY = yBody - dirY * 4;
        points.push({ x: x1 - 2, y: yBody }, { x: x1, y: apexY });
        bendApexY.push(apexY);
      } else {
        if (trimR > 0) {
          points.push({ x: x1 - trimR, y: yBody }, { x: x1 - trimR, y: ySeamEnd }, { x: x1, y: ySeamEnd });
        } else {
          points.push({ x: x1, y: yBody }, { x: x1, y: ySeamEnd });
        }
      }
    }
  }

  return {
    points,
    bendApexY,
    zoneFills,
    foldLines,
    extraCallouts,
    squareSeamTermination,
    leftSeamLineY: ySeamEnd,
    rightSeamLineY: ySeamEnd,
  };
}

function buildBodyFlatPiece(
  config: DuctConfig,
  topo: { id: string; partCode: string; name: string; walls: WallId[]; startCorner: CornerId; endCorner: CornerId },
  seamMap: Map<CornerId, ResolvedCornerSeam>,
  sheetWidthMm: number,
  sheetLengthMm: number,
  settings: WorkshopSettings
): FlatPatternPiece {
  const { W, H, L, c1, c2, stiffenerRibs } = config;
  const walls = topo.walls;
  const startWall = walls[0];
  const endWall = walls[walls.length - 1];
  const startEdge = getEdgeSeamDetail(seamMap.get(topo.startCorner)!, startWall);
  const endEdge = getEdgeSeamDetail(seamMap.get(topo.endCorner)!, endWall);

  const sAllow = startEdge.allowance;
  const eAllow = endEdge.allowance;
  const wallX0: number[] = [];
  const wallX1: number[] = [];
  let cursorX = sAllow;
  for (const w of walls) {
    const span = getWallLength(w, W, H);
    wallX0.push(cursorX);
    cursorX += span;
    wallX1.push(cursorX);
  }
  const devW = cursorX + eAllow;

  // C2 is at Top (y = 0 .. yBodyTop), Body L is yBodyTop .. yBodyBot, C1 is at Bottom (yBodyBot .. blankL)
  const c2Allow = getPieceEndAllowanceMm(c2, walls);
  const c1Allow = getPieceEndAllowanceMm(c1, walls);
  const yBodyTop = c2Allow;
  const yBodyBot = c2Allow + L;
  const blankL = L + c2Allow + c1Allow;

  // Clamp combined seam notches safely for ultra-short ducts
  let topNotch = getSeamNotchDepthIntoBody(c2);
  let botNotch = getSeamNotchDepthIntoBody(c1);
  if (topNotch + botNotch > L - 12) {
    const scale = Math.max(0, (L - 12) / Math.max(1, topNotch + botNotch));
    topNotch *= scale;
    botNotch *= scale;
  }

  const ySeamTop = yBodyTop + topNotch;
  const ySeamBot = yBodyBot - botNotch;

  // Build top (C2) and bottom (C1) laser edges
  const topRes = buildEndEdgePointsLR(walls, wallX0, wallX1, c2, yBodyTop, -1, sAllow, eAllow, topNotch, L, 'C2');
  const botRes = buildEndEdgePointsLR(walls, wallX0, wallX1, c1, yBodyBot, 1, sAllow, eAllow, botNotch, L, 'C1');

  // Assemble watertight clockwise outer cut polygon:
  // Top (L->R) -> Right seam (T->B) -> Bottom (R->L) -> Left seam (B->T)
  const rawPts: Point2D[] = [];
  rawPts.push(...topRes.points);

  // Right seam strip (x from wallX1[last] to devW, moving Top -> Bottom)
  const rightBodyX = wallX1[walls.length - 1];
  const seamSpanY = Math.max(0, ySeamBot - ySeamTop);
  const isMaleRight = eAllow > 0 && endEdge.seamType === 'pittsburgh' && !endEdge.isFemaleSide;
  const chRightTop = isMaleRight && !topRes.squareSeamTermination ? Math.min(7, seamSpanY * 0.4) : 0;
  const chRightBot = isMaleRight && !botRes.squareSeamTermination ? Math.min(7, seamSpanY * 0.4) : 0;
  const rOuterTopY = ySeamTop + chRightTop;
  const rOuterBotY = ySeamBot - chRightBot;

  if (eAllow > 0) {
    rawPts.push(
      { x: rightBodyX, y: ySeamTop },
      { x: devW, y: rOuterTopY },
      { x: devW, y: rOuterBotY },
      { x: rightBodyX, y: ySeamBot }
    );
  } else {
    rawPts.push({ x: rightBodyX, y: ySeamTop }, { x: rightBodyX, y: ySeamBot });
  }

  // Bottom (R->L)
  rawPts.push(...[...botRes.points].reverse());

  // Left seam strip (x from wallX0[0] to 0, moving Bottom -> Top)
  const leftBodyX = wallX0[0];
  const isMaleLeft = sAllow > 0 && startEdge.seamType === 'pittsburgh' && !startEdge.isFemaleSide;
  const chLeftTop = isMaleLeft && !topRes.squareSeamTermination ? Math.min(7, seamSpanY * 0.4) : 0;
  const chLeftBot = isMaleLeft && !botRes.squareSeamTermination ? Math.min(7, seamSpanY * 0.4) : 0;
  const lOuterTopY = ySeamTop + chLeftTop;
  const lOuterBotY = ySeamBot - chLeftBot;

  if (sAllow > 0) {
    rawPts.push(
      { x: leftBodyX, y: ySeamBot },
      { x: 0, y: lOuterBotY },
      { x: 0, y: lOuterTopY },
      { x: leftBodyX, y: ySeamTop }
    );
  } else {
    rawPts.push({ x: leftBodyX, y: ySeamBot }, { x: leftBodyX, y: ySeamTop });
  }

  const cutPolygon = dedupePolygon(rawPts);

  // Zone fills (for Technical Color mode)
  const zoneFills: ZoneFill2D[] = [...topRes.zoneFills, ...botRes.zoneFills];
  const lLineTopY = topRes.leftSeamLineY;
  const lLineBotY = botRes.leftSeamLineY;
  const rLineTopY = topRes.rightSeamLineY;
  const rLineBotY = botRes.rightSeamLineY;

  if (sAllow > 0 && startEdge.zoneKind) {
    zoneFills.push({
      kind: startEdge.zoneKind,
      points: [
        { x: 0, y: lOuterTopY },
        { x: leftBodyX, y: lLineTopY },
        { x: leftBodyX, y: lLineBotY },
        { x: 0, y: lOuterBotY },
      ],
    });
  }
  if (eAllow > 0 && endEdge.zoneKind) {
    zoneFills.push({
      kind: endEdge.zoneKind,
      points: [
        { x: rightBodyX, y: rLineTopY },
        { x: devW, y: rOuterTopY },
        { x: devW, y: rOuterBotY },
        { x: rightBodyX, y: rLineBotY },
      ],
    });
  }

  // Fold lines (longitudinal seam lines + flange fold lines)
  const foldLines: Line2D[] = [...topRes.foldLines, ...botRes.foldLines];
  if (sAllow > 0) {
    foldLines.push({ x1: leftBodyX, y1: lLineTopY, x2: leftBodyX, y2: lLineBotY, label: startEdge.label });
  }
  if (eAllow > 0) {
    foldLines.push({ x1: rightBodyX, y1: rLineTopY, x2: rightBodyX, y2: rLineBotY, label: endEdge.label });
  }

  // 90° Bend lines connecting top V-notch apex to bottom V-notch apex
  const bendLines: Line2D[] = [];
  for (let k = 0; k < walls.length - 1; k++) {
    const bx = wallX1[k];
    const y1 = topRes.bendApexY[k] ?? yBodyTop;
    const y2 = botRes.bendApexY[k] ?? yBodyBot;
    bendLines.push({ x1: bx, y1, x2: bx, y2, label: 'CHẤN 90°' });
  }

  // Straight stiffener ribs ALWAYS run PARALLEL to C1 & C2 flanges (horizontal across X, spaced along Y/L by settings.ribPitchMm)
  const ribLayout = computeRibLayout(L, stiffenerRibs, settings.ribPitchMm);
  const ribLines: Line2D[] = [];
  const ribEdgePad = 14;
  if (ribLayout.count > 0) {
    const yMid = yBodyTop + L / 2;
    for (const zOff of ribLayout.zPositionsMm) {
      const ry = yMid + zOff;
      // Draw cleanly across each wall span (parallel to C1/C2, stopping just short of bend/seam lines)
      for (let i = 0; i < walls.length; i++) {
        const rx1 = wallX0[i] + Math.min(ribEdgePad, (wallX1[i] - wallX0[i]) * 0.12);
        const rx2 = wallX1[i] - Math.min(ribEdgePad, (wallX1[i] - wallX0[i]) * 0.12);
        if (rx2 - rx1 > 20) {
          ribLines.push({ x1: rx1, y1: ry, x2: rx2, y2: ry });
        }
      }
    }
  }

  // Wall face watermarks inside each wall region
  const wallLabels: WallRegionLabel2D[] = walls.map((w, i) => ({
    x: (wallX0[i] + wallX1[i]) * 0.5,
    y: yBodyTop + Math.min(72, L * 0.14),
    text: WALL_LABELS[w].toUpperCase(),
    subtext: `${getWallLength(w, W, H)}`,
  }));

  const areaM2 = (devW / 1000) * (blankL / 1000);
  // Roll-former limit checks ONLY along L_phôi (blankL, perpendicular to horizontal ribs!)
  const limitCheck = evaluateSheetLimit(
    devW,
    blankL,
    sheetWidthMm,
    sheetLengthMm,
    settings.rollFormerLimitMm,
    ribLayout.count > 0,
    blankL
  );

  // Mechanical Dimension Lines
  const dimensions: Dimension2D[] = [];
  // Top overall width (total tier)
  dimensions.push({
    axis: 'horizontal',
    start: 0,
    end: devW,
    anchor: 0,
    offset: -112,
    label: `${fmtMm(devW)} mm`,
    tier: 'total',
    accent: limitCheck.exceedsSheetLimit && devW > sheetWidthMm ? 'red' : 'sky',
  });
  // Top chain breakdown (seams + each wall)
  if (sAllow > 0) {
    dimensions.push({
      axis: 'horizontal',
      start: 0,
      end: sAllow,
      anchor: 0,
      offset: -54,
      label: startEdge.shortDim,
      tier: 'segment',
      accent: startEdge.zoneKind === 'female_seam' ? 'red' : startEdge.zoneKind === 'male_seam' ? 'blue' : 'amber',
    });
  }
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const prefix = w === 'top' || w === 'bottom' ? 'W' : 'H';
    dimensions.push({
      axis: 'horizontal',
      start: wallX0[i],
      end: wallX1[i],
      anchor: 0,
      offset: -54,
      label: `${prefix}=${getWallLength(w, W, H)}`,
      tier: 'segment',
    });
  }
  if (eAllow > 0) {
    dimensions.push({
      axis: 'horizontal',
      start: rightBodyX,
      end: devW,
      anchor: 0,
      offset: -54,
      label: endEdge.shortDim,
      tier: 'segment',
      accent: endEdge.zoneKind === 'female_seam' ? 'red' : endEdge.zoneKind === 'male_seam' ? 'blue' : 'amber',
    });
  }

  // Left overall blank length (total tier)
  dimensions.push({
    axis: 'vertical',
    start: 0,
    end: blankL,
    anchor: 0,
    offset: -120,
    label: `${fmtMm(blankL)} mm`,
    tier: 'total',
    accent: limitCheck.exceedsSheetLimit ? 'red' : limitCheck.exceedsRollFormer ? 'amber' : 'sky',
  });
  // Left chain breakdown (C2 + L + C1)
  if (c2Allow > 0) {
    dimensions.push({
      axis: 'vertical',
      start: 0,
      end: yBodyTop,
      anchor: 0,
      offset: -58,
      label: `+${fmtMm(c2Allow)}`,
      tier: 'segment',
      accent: 'amber',
    });
  }
  dimensions.push({
    axis: 'vertical',
    start: yBodyTop,
    end: yBodyBot,
    anchor: 0,
    offset: -58,
    label: `L=${L}`,
    tier: 'segment',
  });
  if (c1Allow > 0) {
    dimensions.push({
      axis: 'vertical',
      start: yBodyBot,
      end: blankL,
      anchor: 0,
      offset: -58,
      label: `+${fmtMm(c1Allow)}`,
      tier: 'segment',
      accent: 'amber',
    });
  }

  // Right-side rib pitch dimension (live pitch from Workshop Settings!)
  if (ribLayout.count >= 2) {
    const yMid = yBodyTop + L / 2;
    const r0 = yMid + ribLayout.zPositionsMm[0];
    const r1 = yMid + ribLayout.zPositionsMm[1];
    dimensions.push({
      axis: 'vertical',
      start: r0,
      end: r1,
      anchor: devW,
      offset: 48,
      label: `Gân ${ribLayout.pitchMm}`,
      tier: 'detail',
      accent: 'sky',
    });
  }

  // Callouts for C2 (top), C1 (bottom), and any notch / seam-stop info
  const callouts: Callout2D[] = [...topRes.extraCallouts, ...botRes.extraCallouts];
  const c2Badge = getEndNotchBadge(c2, 'C2');
  if (c2Badge) {
    callouts.push({ x: devW * 0.5, y: -154, text: c2Badge, align: 'middle', tone: 'muted' });
  }
  const c1Badge = getEndNotchBadge(c1, 'C1');
  if (c1Badge) {
    const baseC1Y = blankL + 56;
    const c1Y =
      limitCheck.orientation === 'ngang_chuan' && Math.abs(baseC1Y - sheetWidthMm) < 28
        ? sheetWidthMm + 34
        : baseC1Y;
    callouts.push({ x: devW * 0.5, y: c1Y, text: c1Badge, align: 'middle', tone: 'muted' });
  }

  // Explicit seam-stop callouts when plain extension > 0
  if (c2.type === 'plain' && c2.plainExtensionMm > 0 && (sAllow > 0 || eAllow > 0)) {
    callouts.push({
      x: devW + 18,
      y: yBodyTop + 4,
      text: `← Hết mí (+${c2.plainExtensionMm} trơn)`,
      align: 'start',
      tone: 'amber',
    });
  }
  if (c1.type === 'plain' && c1.plainExtensionMm > 0 && (sAllow > 0 || eAllow > 0)) {
    callouts.push({
      x: devW + 18,
      y: yBodyBot + 4,
      text: `← Hết mí (+${c1.plainExtensionMm} trơn)`,
      align: 'start',
      tone: 'amber',
    });
  }

  const bendCount = Math.max(0, walls.length - 1);

  return {
    id: topo.id,
    partCode: topo.partCode,
    name: topo.name,
    subtitle: `${fmtMm(devW)} × ${fmtMm(blankL)} mm • ${areaM2.toFixed(2)} m² • ${bendCount} đường chấn`,
    isEndCap: false,
    leftCornerId: topo.startCorner,
    rightCornerId: topo.endCorner,
    bodyTopY: yBodyTop,
    bodyBottomY: yBodyBot,
    widthMm: devW,
    heightMm: blankL,
    areaM2,
    bendCount,
    originX: 0,
    originY: 0,
    cutPolygon,
    zoneFills,
    bendLines,
    foldLines,
    ribLines,
    wallLabels,
    dimensions,
    callouts,
    centerLabelPos: { x: sAllow + (rightBodyX - sAllow) * 0.5, y: yBodyTop + L * 0.5 },
    limitCheck,
    viewingFaceNote: 'Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)',
  };
}

function buildEndCapFlatPiece(
  config: DuctConfig,
  endKey: 'c1' | 'c2',
  sheetWidthMm: number,
  sheetLengthMm: number,
  settings: WorkshopSettings
): FlatPatternPiece {
  const { W, H, stiffenerRibs } = config;
  const conn = config[endKey];
  const partCode = getEndCapPartCode(config, endKey);
  const endLbl = endKey.toUpperCase();

  const lSeam = getEndCapEdgeSeam(conn, 'left');
  const rSeam = getEndCapEdgeSeam(conn, 'right');
  const tSeam = getEndCapEdgeSeam(conn, 'top');
  const bSeam = getEndCapEdgeSeam(conn, 'bottom');

  const lA = getEndCapPanelEdgeAllowance(conn, 'left');
  const rA = getEndCapPanelEdgeAllowance(conn, 'right');
  const tA = getEndCapPanelEdgeAllowance(conn, 'top');
  const bA = getEndCapPanelEdgeAllowance(conn, 'bottom');

  const devW = W + lA + rA;
  const blankL = H + tA + bA;
  const x0 = lA;
  const x1 = lA + W;
  const y0 = tA;
  const y1 = tA + H;

  const rawPts: Point2D[] = [];
  const zoneFills: ZoneFill2D[] = [];
  const foldLines: Line2D[] = [];

  const edgeKind = (s: SeamType): ZoneFillKind | null =>
    s === 'pittsburgh' ? 'male_seam' : s === 'weld_overlap' ? 'weld_seam' : null;
  const edgeDim = (s: SeamType, a: number): string =>
    s === 'pittsburgh' ? '+7' : s === 'weld_overlap' ? `+${a}` : '0';

  // Top edge (L->R)
  if (tA > 0) {
    const ch = tSeam === 'pittsburgh' ? Math.min(7, W * 0.25) : 1.5;
    rawPts.push({ x: x0, y: y0 }, { x: x0 + ch, y: 0 }, { x: x1 - ch, y: 0 }, { x: x1, y: y0 });
    const k = edgeKind(tSeam);
    if (k) {
      zoneFills.push({
        kind: k,
        points: [{ x: x0, y: y0 }, { x: x0 + ch, y: 0 }, { x: x1 - ch, y: 0 }, { x: x1, y: y0 }],
      });
    }
    foldLines.push({ x1: x0, y1: y0, x2: x1, y2: y0 });
  } else {
    rawPts.push({ x: x0, y: y0 }, { x: x1, y: y0 });
  }

  // Right edge (T->B)
  if (rA > 0) {
    const ch = rSeam === 'pittsburgh' ? Math.min(7, H * 0.25) : 1.5;
    rawPts.push({ x: x1, y: y0 }, { x: devW, y: y0 + ch }, { x: devW, y: y1 - ch }, { x: x1, y: y1 });
    const k = edgeKind(rSeam);
    if (k) {
      zoneFills.push({
        kind: k,
        points: [{ x: x1, y: y0 }, { x: devW, y: y0 + ch }, { x: devW, y: y1 - ch }, { x: x1, y: y1 }],
      });
    }
    foldLines.push({ x1: x1, y1: y0, x2: x1, y2: y1 });
  } else {
    rawPts.push({ x: x1, y: y0 }, { x: x1, y: y1 });
  }

  // Bottom edge (R->L)
  if (bA > 0) {
    const ch = bSeam === 'pittsburgh' ? Math.min(7, W * 0.25) : 1.5;
    rawPts.push({ x: x1, y: y1 }, { x: x1 - ch, y: blankL }, { x: x0 + ch, y: blankL }, { x: x0, y: y1 });
    const k = edgeKind(bSeam);
    if (k) {
      zoneFills.push({
        kind: k,
        points: [{ x: x1, y: y1 }, { x: x1 - ch, y: blankL }, { x: x0 + ch, y: blankL }, { x: x0, y: y1 }],
      });
    }
    foldLines.push({ x1: x0, y1: y1, x2: x1, y2: y1 });
  } else {
    rawPts.push({ x: x1, y: y1 }, { x: x0, y: y1 });
  }

  // Left edge (B->T)
  if (lA > 0) {
    const ch = lSeam === 'pittsburgh' ? Math.min(7, H * 0.25) : 1.5;
    rawPts.push({ x: x0, y: y1 }, { x: 0, y: y1 - ch }, { x: 0, y: y0 + ch }, { x: x0, y: y0 });
    const k = edgeKind(lSeam);
    if (k) {
      zoneFills.push({
        kind: k,
        points: [{ x: x0, y: y1 }, { x: 0, y: y1 - ch }, { x: 0, y: y0 + ch }, { x: x0, y: y0 }],
      });
    }
    foldLines.push({ x1: x0, y1: y0, x2: x0, y2: y1 });
  } else {
    rawPts.push({ x: x0, y: y1 }, { x: x0, y: y0 });
  }

  // Straight stiffener ribs on End Cap (using configurable Workshop Settings rib pitch)
  const ribAlongX = W >= H;
  const spanPerp = ribAlongX ? H : W;
  const ribLayout = computeRibLayout(spanPerp, stiffenerRibs, settings.ribPitchMm);
  const ribLines: Line2D[] = [];
  const pad = 18;
  for (const offset of ribLayout.zPositionsMm) {
    if (ribAlongX) {
      const ry = y0 + H * 0.5 + offset;
      ribLines.push({ x1: x0 + pad, y1: ry, x2: x1 - pad, y2: ry });
    } else {
      const rx = x0 + W * 0.5 + offset;
      ribLines.push({ x1: rx, y1: y0 + pad, x2: rx, y2: y1 - pad });
    }
  }

  const areaM2 = (devW / 1000) * (blankL / 1000);
  const rollCheckSpanMm = ribAlongX ? blankL : devW;
  const limitCheck = evaluateSheetLimit(
    devW,
    blankL,
    sheetWidthMm,
    sheetLengthMm,
    settings.rollFormerLimitMm,
    ribLayout.count > 0,
    rollCheckSpanMm
  );

  const dimensions: Dimension2D[] = [
    {
      axis: 'horizontal',
      start: 0,
      end: devW,
      anchor: 0,
      offset: -112,
      label: `${fmtMm(devW)} mm`,
      tier: 'total',
      accent: limitCheck.exceedsSheetLimit && devW > sheetWidthMm ? 'red' : 'sky',
    },
    {
      axis: 'horizontal',
      start: x0,
      end: x1,
      anchor: 0,
      offset: -54,
      label: `W=${W}`,
      tier: 'segment',
    },
    {
      axis: 'vertical',
      start: 0,
      end: blankL,
      anchor: 0,
      offset: -120,
      label: `${fmtMm(blankL)} mm`,
      tier: 'total',
      accent: limitCheck.exceedsSheetLimit ? 'red' : limitCheck.exceedsRollFormer ? 'amber' : 'sky',
    },
    {
      axis: 'vertical',
      start: y0,
      end: y1,
      anchor: 0,
      offset: -58,
      label: `H=${H}`,
      tier: 'segment',
    },
  ];
  if (lA > 0) {
    dimensions.push({ axis: 'horizontal', start: 0, end: x0, anchor: 0, offset: -54, label: edgeDim(lSeam, lA), tier: 'segment', accent: lSeam === 'pittsburgh' ? 'blue' : 'amber' });
  }
  if (rA > 0) {
    dimensions.push({ axis: 'horizontal', start: x1, end: devW, anchor: 0, offset: -54, label: edgeDim(rSeam, rA), tier: 'segment', accent: rSeam === 'pittsburgh' ? 'blue' : 'amber' });
  }
  if (tA > 0) {
    dimensions.push({ axis: 'vertical', start: 0, end: y0, anchor: 0, offset: -58, label: edgeDim(tSeam, tA), tier: 'segment', accent: tSeam === 'pittsburgh' ? 'blue' : 'amber' });
  }
  if (bA > 0) {
    dimensions.push({ axis: 'vertical', start: y1, end: blankL, anchor: 0, offset: -58, label: edgeDim(bSeam, bA), tier: 'segment', accent: bSeam === 'pittsburgh' ? 'blue' : 'amber' });
  }
  if (ribLayout.count >= 2 && ribAlongX) {
    const ry0 = y0 + H * 0.5 + ribLayout.zPositionsMm[0];
    const ry1 = y0 + H * 0.5 + ribLayout.zPositionsMm[1];
    dimensions.push({ axis: 'vertical', start: ry0, end: ry1, anchor: devW, offset: 48, label: `Gân ${ribLayout.pitchMm}`, tier: 'detail', accent: 'sky' });
  }

  const bendCount = [tA, bA, lA, rA].filter((a) => a > 0).length;
  const pittsCount = [tSeam, bSeam, lSeam, rSeam].filter((s) => s === 'pittsburgh').length;
  const callouts: Callout2D[] = [
    {
      x: devW * 0.5,
      y: -154,
      text: `Mảnh bịt đầu rời (${endLbl}) • ${pittsCount === 4 ? '4 cạnh Mí đơn (+7, vát 45°)' : `${pittsCount} Mí đơn / ${4 - pittsCount} Mí hàn`}`,
      align: 'middle',
      tone: 'sky',
    },
  ];

  return {
    id: `CAP-${endLbl}`,
    partCode,
    name: `Mảnh bịt đầu rời (${endLbl})`,
    subtitle: `${fmtMm(devW)} × ${fmtMm(blankL)} mm • ${areaM2.toFixed(2)} m² • ${bendCount} cạnh bẻ`,
    isEndCap: true,
    endKey,
    widthMm: devW,
    heightMm: blankL,
    areaM2,
    bendCount,
    originX: 0,
    originY: 0,
    cutPolygon: dedupePolygon(rawPts),
    zoneFills,
    bendLines: [],
    foldLines,
    ribLines,
    wallLabels: [{ x: x0 + W * 0.5, y: y0 + Math.min(55, H * 0.2), text: `BỊT ĐẦU ${endLbl}`, subtext: `${W}×${H}` }],
    dimensions,
    callouts,
    centerLabelPos: { x: x0 + W * 0.5, y: y0 + H * 0.52 },
    limitCheck,
    viewingFaceNote: 'Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)',
  };
}

/**
 * Main Straight-Duct adapter producing the pluggable FlatPatternDocument for FlatPattern2DViewer.
 */
export function buildStraightDuctFlatPattern(
  config: DuctConfig,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): FlatPatternDocument {
  const { widthMm: sheetWidthMm, lengthMm: sheetLengthMm } = getActiveSheetDimensions(
    config.sheetMaterial,
    settings
  );
  const topologies = getSplitTopologies(config.splitMode);
  const seams = resolveActiveSeams(config);
  const seamMap = new Map<CornerId, ResolvedCornerSeam>(seams.map((s) => [s.cornerId, s]));

  const pieces: FlatPatternPiece[] = topologies.map((topo) =>
    buildBodyFlatPiece(config, topo, seamMap, sheetWidthMm, sheetLengthMm, settings)
  );

  // Append removable End Cap pieces (1-B / 1-E / 1-F...) right in the 2D sheet space
  if (config.c1.type === 'end_cap') {
    pieces.push(buildEndCapFlatPiece(config, 'c1', sheetWidthMm, sheetLengthMm, settings));
  }
  if (config.c2.type === 'end_cap') {
    pieces.push(buildEndCapFlatPiece(config, 'c2', sheetWidthMm, sheetLengthMm, settings));
  }

  // Clean multi-row CAD layout with generous dimension gutters
  const GUTTER_L = 220;
  const GUTTER_R = 200;
  const GUTTER_T = 230;
  const GUTTER_B = 140;
  const maxPieceW = Math.max(...pieces.map((p) => p.widthMm), 600);
  const maxRowWidth =
    pieces.length === 4
      ? (maxPieceW + GUTTER_L + GUTTER_R) * 2 + 60
      : Math.max(2800, maxPieceW + GUTTER_L + GUTTER_R + 100);

  let curX = 0;
  let curY = 0;
  let rowMaxH = 0;
  let globalMaxX = 0;
  let globalMaxY = 0;

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const cellW = p.widthMm + GUTTER_L + GUTTER_R;
    const cellH = p.heightMm + GUTTER_T + GUTTER_B;

    if (i > 0 && curX + cellW > maxRowWidth) {
      curX = 0;
      curY += rowMaxH + 80;
      rowMaxH = 0;
    }

    p.originX = curX + GUTTER_L;
    p.originY = curY + GUTTER_T;

    curX += cellW;
    rowMaxH = Math.max(rowMaxH, cellH);
    globalMaxX = Math.max(globalMaxX, p.originX + p.widthMm + GUTTER_R);
    globalMaxY = Math.max(globalMaxY, p.originY + p.heightMm + GUTTER_B);
  }

  const totalAreaM2 = pieces.reduce((sum, p) => sum + p.areaM2, 0);
  const matLabel = SHEET_MATERIAL_LABELS[config.sheetMaterial];
  const c1Short = END_CONNECTION_SHORT_LABELS[config.c1.type];
  const c2Short = END_CONNECTION_SHORT_LABELS[config.c2.type];
  const endsStr = c1Short === c2Short ? `2× ${c1Short}` : `C1: ${c1Short} • C2: ${c2Short}`;

  return {
    title: `Trải phẳng 2D — Ống thẳng ${config.W} × ${config.H} × L${config.L} mm`,
    specSummary: `${matLabel} ${config.thickness} mm (Khổ ${sheetWidthMm}×${sheetLengthMm} mm) • ${endsStr} • ${pieces.length} mảnh • Tổng S phôi: ${totalAreaM2.toFixed(2)} m²`,
    materialLabel: matLabel,
    thicknessMm: config.thickness,
    sheetWidthMm,
    sheetLengthMm,
    rollFormerLimitMm: settings.rollFormerLimitMm,
    ribPitchMm: settings.ribPitchMm,
    totalAreaM2,
    pieces,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: Math.max(600, globalMaxX),
      maxY: Math.max(600, globalMaxY),
      width: Math.max(600, globalMaxX),
      height: Math.max(600, globalMaxY),
    },
    exportFileName: `EUSTEEL_DUCT3D_${config.W}x${config.H}_L${config.L}_${config.sheetMaterial === 'inox' ? `Inox${sheetWidthMm}` : `Ton${sheetWidthMm}`}_2D`,
  };
}
