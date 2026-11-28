import {
  FACE_SHORT_LABELS,
  getCapEdgeId,
  isBodyWall,
  resolveFoldGraph,
  type FoldComponent,
  type ResolvedFoldEdge,
  type ResolvedFoldGraph,
} from '../../core/foldGraph/foldGraph';
import {
  PITTSBURGH_FEMALE_ALLOWANCE,
  PITTSBURGH_MALE_ALLOWANCE,
  SHEET_MATERIAL_LABELS,
  WALL_LABELS,
  computeRibLayout,
  getWallLength,
} from '../../core/rules/ductRules';
import {
  END_CONNECTION_SHORT_LABELS,
  bichVHasTurnedLip,
  getBichVDimensions,
  getEndCapEdgeSeam,
  getEndCapPanelEdgeAllowance,
  getPieceEndAllowanceMm,
  getWallEndAllowanceMm,
} from '../../core/rules/endConnectionRules';
import { DEFAULT_WORKSHOP_SETTINGS, getActiveSheetDimensions } from '../../core/rules/workshopSettings';
import type {
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  FaceId,
  FoldEdgeId,
  SeamType,
  WallId,
  WorkshopSettings,
} from '../../core/types/duct';
import type {
  Callout2D,
  Dimension2D,
  EditableContour2D,
  EditableSegment2D,
  EditableVertex2D,
  FlatPatternDocument,
  FlatPatternPiece,
  InteractiveEdge2D,
  Line2D,
  OverlapRect2D,
  Point2D,
  SegmentFeatureKind,
  SheetLimitCheck2D,
  VertexFeatureTag,
  WallRegionLabel2D,
  ZoneFill2D,
  ZoneFillKind,
} from '../../core/types/flatPattern2d';
import { getFaceBasis3D } from './geometry3D';

export const ROLL_FORMER_LIMIT_MM = DEFAULT_WORKSHOP_SETTINGS.rollFormerLimitMm;

/** Item 1: Default male seam (+7 mm) bevel angle from horizontal edge (5°–10°, default 8° => ~0.98 mm inset) */
export const DEFAULT_MALE_SEAM_BEVEL_DEG = 8;

/** Item 2: Inward diagonal corner chamfer (3–4 mm, default 3.5 mm) on outer corners of Nẹp C (+12.5 mm) tabs */
export const NEP_C_CORNER_CHAMFER_MM = 3.5;

export function getMaleSeamBevelInsetMm(
  widthMm: number = PITTSBURGH_MALE_ALLOWANCE,
  angleDeg: number = DEFAULT_MALE_SEAM_BEVEL_DEG
): number {
  const clampedDeg = Math.max(5, Math.min(10, angleDeg));
  return Number((widthMm * Math.tan((clampedDeg * Math.PI) / 180)).toFixed(3));
}

function fmtMm(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

interface TaggedPoint2D {
  x: number;
  y: number;
  tag?: VertexFeatureTag;
  segFeature?: SegmentFeatureKind;
}

/**
 * Builds an open, editable structured 2D contour (`vertices` + `segments`) ready for
 * future interactive 2D CAD editing tools, while deduplicating near-coincident points.
 */
function buildEditableContour(
  contourId: string,
  rawPts: readonly TaggedPoint2D[]
): { contour: EditableContour2D; polygon: Point2D[] } {
  const cleaned: TaggedPoint2D[] = [];
  for (const p of rawPts) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.05) {
      cleaned.push({
        x: Number(p.x.toFixed(3)),
        y: Number(p.y.toFixed(3)),
        tag: p.tag,
        segFeature: p.segFeature,
      });
    }
  }
  while (
    cleaned.length > 2 &&
    Math.hypot(
      cleaned[0].x - cleaned[cleaned.length - 1].x,
      cleaned[0].y - cleaned[cleaned.length - 1].y
    ) <= 0.05
  ) {
    cleaned.pop();
  }

  const vertices: EditableVertex2D[] = cleaned.map((p, i) => ({
    id: `${contourId}-v${i}`,
    x: p.x,
    y: p.y,
    ...(p.tag ? { tag: p.tag } : {}),
  }));

  const segments: EditableSegment2D[] = vertices.map((_, i) => ({
    id: `${contourId}-s${i}`,
    fromIndex: i,
    toIndex: (i + 1) % vertices.length,
    kind: 'line',
    feature: cleaned[i].segFeature ?? 'cut',
  }));

  const polygon: Point2D[] = vertices.map((v) => ({ x: v.x, y: v.y }));
  return {
    contour: {
      id: contourId,
      closed: true,
      vertices,
      segments,
    },
    polygon,
  };
}

interface EdgeSeamDetail {
  allowance: number;
  seamType: SeamType;
  isFemaleSide: boolean;
  label: string;
  shortDim: string;
  zoneKind: ZoneFillKind | null;
}

function getEdgeSeamDetailFromFoldEdge(edge: ResolvedFoldEdge, face: FaceId): EdgeSeamDetail {
  const isFemaleSide = edge.femaleFace === face;
  if (edge.seamType === 'pittsburgh') {
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
  if (edge.seamType === 'weld_overlap') {
    if (isFemaleSide) {
      return {
        allowance: edge.weldOverlapWidth,
        seamType: 'weld_overlap',
        isFemaleSide: true,
        label: `Hàn chập (+${edge.weldOverlapWidth})`,
        shortDim: `+${edge.weldOverlapWidth}`,
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

function getSeamNotchDepthIntoBody(conn: EndConnectionConfig): number {
  switch (conn.type) {
    case 'tdc_tdf':
      return 12; // Khấu tổng 60 mm = 48 mm bích + 12 mm vào thân L
    case 'nep_c':
      return 12.5; // Khấu góc 25 mm = 12.5 mm mép uốn + 12.5 mm vào thân L
    case 'bich_v_out': {
      if (conn.bichVSpec === 'V80x30') return 0;
      const { vSize } = getBichVDimensions(conn.bichVSpec);
      return vSize + 5;
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
  const endLbl = endTag === 'C1' ? 'Kết nối 1' : 'Kết nối 2';
  switch (conn.type) {
    case 'tdc_tdf':
      return `${endLbl}: TDC/TDF +48 • Khấu góc 60 (48+12) • Khe bẻ 2 mm${conn.showEndIndent ? ' • Vết V cạnh tai (TDF)' : ''}`;
    case 'nep_c':
      return `${endLbl}: Nẹp C +12.5 • Vát góc đầu ${NEP_C_CORNER_CHAMFER_MM} mm • Khấu 25`;
    case 'bich_v_out': {
      if (conn.bichVSpec === 'V80x30') return `${endLbl}: V80×30 lọt lòng (+0)`;
      const { vSize } = getBichVDimensions(conn.bichVSpec);
      const n = vSize + 5;
      if (conn.bichVOutStyle === 'ei') {
        return `${endLbl}: ${conn.bichVSpec} EI (+0) • Khấu góc ${n}`;
      }
      return `${endLbl}: ${conn.bichVSpec} (+8) • Khấu góc ${n}+8 (${n + 8})`;
    }
    case 'bich_v_in': {
      const spec = conn.bichVSpec === 'V80x30' ? 'V40x40' : conn.bichVSpec;
      const { vSize } = getBichVDimensions(spec);
      return `${endLbl}: ${spec} quay trong (+0) • Khấu mí ${vSize + 5}`;
    }
    case 'bich_u':
      return `${endLbl}: Bích U rời • Cắt thẳng (+0)`;
    case 'lcct':
      return `${endLbl}: LCCT +20 • Vát góc 45° chấn vào trong`;
    case 'be_chan':
      return `${endLbl}: Bẻ chân F=${conn.beChanWidth} mm (ghép vuông đối đầu)`;
    case 'plain':
      return conn.plainExtensionMm > 0
        ? `${endLbl}: Để thẳng +${conn.plainExtensionMm} mm • Hết mí dọc trước đoạn kéo dài`
        : `${endLbl}: Để thẳng (+0)`;
    case 'end_cap':
      return `${endLbl}: Đầu bịt kín`;
  }
}

export function evaluateSheetLimit(
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

function getAdjacentWallCCW(wall: WallId, dir: -1 | 1): WallId {
  const seq: WallId[] = ['top', 'left', 'bottom', 'right'];
  const idx = seq.indexOf(wall);
  return seq[(idx + (dir === 1 ? 1 : 3)) % 4];
}

// ---------------------------------------------------------------------------
// 1. Standard Linear Body Chain Edge Profile Generator (C2 top / C1 bottom)
// ---------------------------------------------------------------------------

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
  points: TaggedPoint2D[];
  bendApexY: number[];
  zoneFills: ZoneFill2D[];
  foldLines: Line2D[];
  extraCallouts: Callout2D[];
  leftSeamLineY: number;
  rightSeamLineY: number;
} {
  const n = walls.length;
  const points: TaggedPoint2D[] = [];
  const bendApexY: number[] = [];
  const zoneFills: ZoneFill2D[] = [];
  const foldLines: Line2D[] = [];
  const extraCallouts: Callout2D[] = [];

  const dBody = Math.min(seamNotchDepth, Math.max(4, L * 0.38));
  const ySeamEnd = yBody - dirY * dBody;

  points.push({ x: wallX0[0], y: ySeamEnd, tag: 'seam_corner' });

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
      const notchIn = dBody;
      const yNotchRoot = yBody - dirY * notchIn;
      const stepIn = Math.min(1.5, span * 0.03);
      const stepHalfY = Math.min(1.0, notchIn * 0.25);
      const slotHalf = Math.min(1.0, span * 0.04); // exact 2.0 mm parallel bend slot
      const vTip = Math.min(2.0, notchIn * 0.35);

      const fx0 = isFirst ? x0 + stepIn : x0 + slotHalf;
      const fx1 = isLast ? x1 - stepIn : x1 - slotHalf;

      const vCenterY = yFlange - dirY * Math.min(18, a * 0.38);
      const vHalfW = 3.5;
      const vDepth = Math.min(3.5, (fx1 - fx0) * 0.08);
      const hasSideV = conn.showEndIndent && a >= 24 && fx1 - fx0 >= 60;

      if (isFirst) {
        points.push(
          { x: x0, y: yNotchRoot, tag: 'tdc_notch', segFeature: 'tdc_step' },
          { x: x0, y: yBody - dirY * stepHalfY, tag: 'tdc_notch', segFeature: 'tdc_step' },
          { x: fx0, y: yBody + dirY * stepHalfY, tag: 'tdc_notch', segFeature: 'flange_edge' }
        );
        if (hasSideV) {
          points.push(
            { x: fx0, y: vCenterY - dirY * vHalfW, tag: 'tdc_tdf_indent', segFeature: 'flange_edge' },
            { x: fx0 + vDepth, y: vCenterY, tag: 'tdc_tdf_indent', segFeature: 'flange_edge' },
            { x: fx0, y: vCenterY + dirY * vHalfW, tag: 'tdc_tdf_indent', segFeature: 'flange_edge' }
          );
          extraCallouts.push({
            x: fx0 + 18,
            y: vCenterY,
            text: `← V-lõm TDF (${endTag})`,
            align: 'start',
            tone: 'amber',
          });
        }
        points.push({ x: fx0, y: yFlange, tag: 'flange_tip', segFeature: 'flange_edge' });
      } else {
        const yVStartL = yNotchRoot + dirY * vTip;
        points.push(
          { x: fx0, y: yVStartL, tag: 'bend_notch', segFeature: 'bend_slot' },
          { x: fx0, y: yFlange, tag: 'flange_tip', segFeature: 'flange_edge' }
        );
      }

      if (!isLast) {
        const yVStartR = yNotchRoot + dirY * vTip;
        points.push(
          { x: fx1, y: yFlange, tag: 'flange_tip', segFeature: 'bend_slot' },
          { x: fx1, y: yVStartR, tag: 'bend_notch', segFeature: 'bend_slot' },
          { x: x1, y: yNotchRoot, tag: 'bend_notch', segFeature: 'bend_slot' }
        );
        bendApexY.push(yNotchRoot);
      } else {
        points.push({ x: fx1, y: yFlange, tag: 'flange_tip', segFeature: 'flange_edge' });
        if (hasSideV) {
          points.push(
            { x: fx1, y: vCenterY + dirY * vHalfW, tag: 'tdc_tdf_indent', segFeature: 'flange_edge' },
            { x: fx1 - vDepth, y: vCenterY, tag: 'tdc_tdf_indent', segFeature: 'flange_edge' },
            { x: fx1, y: vCenterY - dirY * vHalfW, tag: 'tdc_tdf_indent', segFeature: 'flange_edge' }
          );
        }
        points.push(
          { x: fx1, y: yBody + dirY * stepHalfY, tag: 'tdc_notch', segFeature: 'tdc_step' },
          { x: x1, y: yBody - dirY * stepHalfY, tag: 'tdc_notch', segFeature: 'tdc_step' },
          { x: x1, y: yNotchRoot, tag: 'tdc_notch', segFeature: 'tdc_step' }
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
      // Item 2: Nẹp C (+12.5 mm) runs corner-to-corner (~1.5–1.8 mm clearance) AND adds a clean
      // 3.5 mm inward diagonal corner bevel at BOTH outer corners of each +12.5 mm tab (NO 90° sharp protruding tip)!
      const notchIn = Math.min(12.5, Math.max(4, L * 0.25));
      const slotHalf = Math.min(1.5, span * 0.05);
      const trimL = Math.min(1.8, span * 0.05);
      const trimR = Math.min(1.8, span * 0.05);
      const xL = x0 + (isFirst ? trimL : slotHalf);
      const xR = x1 - (isLast ? trimR : slotHalf);
      const ch = Math.min(NEP_C_CORNER_CHAMFER_MM, (xR - xL) * 0.14, a * 0.45);
      const yCh = yFlange - dirY * ch;

      if (isFirst) {
        if (sAllow > 0) {
          points.push(
            { x: x0, y: yBody, tag: 'body_corner', segFeature: 'flange_edge' },
            { x: xL, y: yBody, tag: 'body_corner', segFeature: 'flange_edge' }
          );
        } else {
          points.push({ x: xL, y: yBody - dirY * notchIn, tag: 'body_corner', segFeature: 'flange_edge' });
        }
      } else {
        points.push({ x: xL, y: yBody, tag: 'bend_notch', segFeature: 'flange_edge' });
      }

      // Left outer corner inward diagonal chamfer (3.5 mm into +12.5 mm tab)
      points.push(
        { x: xL, y: yCh, tag: 'nep_c_chamfer', segFeature: 'nep_c_chamfer' },
        { x: xL + ch, y: yFlange, tag: 'nep_c_chamfer', segFeature: 'flange_edge' }
      );

      // Right outer corner inward diagonal chamfer (3.5 mm into +12.5 mm tab)
      points.push(
        { x: xR - ch, y: yFlange, tag: 'nep_c_chamfer', segFeature: 'nep_c_chamfer' },
        { x: xR, y: yCh, tag: 'nep_c_chamfer', segFeature: 'flange_edge' }
      );

      if (!isLast) {
        const apexY = yBody - dirY * notchIn;
        points.push(
          { x: xR, y: yBody, tag: 'bend_notch', segFeature: 'bend_slot' },
          { x: x1, y: apexY, tag: 'bend_notch', segFeature: 'bend_slot' }
        );
        bendApexY.push(apexY);
      } else {
        if (eAllow > 0) {
          points.push(
            { x: xR, y: yBody, tag: 'body_corner', segFeature: 'flange_edge' },
            { x: x1, y: yBody, tag: 'body_corner', segFeature: 'seam_edge' },
            { x: x1, y: ySeamEnd, tag: 'seam_corner', segFeature: 'seam_edge' }
          );
        } else {
          points.push(
            { x: xR, y: yBody - dirY * notchIn, tag: 'body_corner', segFeature: 'seam_edge' },
            { x: x1, y: ySeamEnd, tag: 'seam_corner', segFeature: 'seam_edge' }
          );
        }
      }

      zoneFills.push({
        kind: 'flange',
        points: [
          { x: xL, y: yBody },
          { x: xL, y: yCh },
          { x: xL + ch, y: yFlange },
          { x: xR - ch, y: yFlange },
          { x: xR, y: yCh },
          { x: xR, y: yBody },
        ],
      });
      foldLines.push({ x1: xL, y1: yBody, x2: xR, y2: yBody });
    } else if (conn.type === 'bich_v_out' && bichVHasTurnedLip(conn)) {
      const bendNotchIn = Math.min(8, Math.max(4, L * 0.2));
      const slotHalf = Math.min(1.5, span * 0.05);
      const lipStep = Math.min(2.0, span * 0.04);
      const tipRecess = Math.min(1.5, span * 0.04);
      const yTipJog = yFlange - dirY * Math.min(1.8, a * 0.3);

      if (isFirst) {
        const fxBase = x0 + lipStep;
        const fxTip = fxBase + tipRecess;
        points.push(
          { x: x0, y: ySeamEnd, tag: 'seam_corner' },
          { x: x0, y: yBody, tag: 'body_corner' },
          { x: fxBase, y: yBody, tag: 'body_corner' },
          { x: fxBase, y: yTipJog, tag: 'flange_tip' },
          { x: fxTip, y: yTipJog, tag: 'flange_tip' },
          { x: fxTip, y: yFlange, tag: 'flange_tip' }
        );
      } else {
        points.push({ x: x0 + slotHalf, y: yBody }, { x: x0 + slotHalf, y: yFlange });
      }

      if (!isLast) {
        const apexY = yBody - dirY * bendNotchIn;
        points.push({ x: x1 - slotHalf, y: yFlange }, { x: x1 - slotHalf, y: yBody }, { x: x1, y: apexY, tag: 'bend_notch' });
        bendApexY.push(apexY);
      } else {
        const fxBase = x1 - lipStep;
        const fxTip = fxBase - tipRecess;
        points.push(
          { x: fxTip, y: yFlange, tag: 'flange_tip' },
          { x: fxTip, y: yTipJog, tag: 'flange_tip' },
          { x: fxBase, y: yTipJog, tag: 'flange_tip' },
          { x: fxBase, y: yBody, tag: 'body_corner' },
          { x: x1, y: yBody, tag: 'body_corner' },
          { x: x1, y: ySeamEnd, tag: 'seam_corner' }
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
      if (isFirst) points.push({ x: x0, y: yBody }, { x: x0 + ch, y: yFlange });
      else points.push({ x: x0 + ch, y: yFlange });
      if (!isLast) {
        const apexY = yBody - dirY * 4;
        points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: apexY, tag: 'bend_notch' });
        bendApexY.push(apexY);
      } else {
        points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: yBody });
      }
      zoneFills.push({
        kind: 'flange',
        points: [{ x: x0, y: yBody }, { x: x0 + ch, y: yFlange }, { x: x1 - ch, y: yFlange }, { x: x1, y: yBody }],
      });
      foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
    } else if (conn.type === 'be_chan') {
      const mode = conn.beChanEdges[wall];
      const leftWall = getAdjacentWallCCW(wall, -1);
      const rightWall = getAdjacentWallCCW(wall, 1);
      const apexY = yBody - dirY * 4;

      if (mode === 'straight') {
        points.push({ x: isFirst ? x0 : x0 + 2, y: yBody });
        if (!isLast) {
          points.push({ x: x1 - 2, y: yBody }, { x: x1, y: apexY, tag: 'bend_notch' });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1, y: yBody });
        }
      } else if (mode === 'in') {
        const isHoriz = wall === 'top' || wall === 'bottom';
        const sqTrimL = !isHoriz && conn.beChanEdges[leftWall] === 'in'
          ? Math.min(a + 1.5, span * 0.38)
          : Math.min(1.5, span * 0.05);
        const sqTrimR = !isHoriz && conn.beChanEdges[rightWall] === 'in'
          ? Math.min(a + 1.5, span * 0.38)
          : Math.min(1.5, span * 0.05);

        if (isFirst) points.push({ x: x0, y: yBody }, { x: x0 + sqTrimL, y: yBody }, { x: x0 + sqTrimL, y: yFlange });
        else points.push({ x: x0 + sqTrimL, y: yBody }, { x: x0 + sqTrimL, y: yFlange });
        if (!isLast) {
          points.push({ x: x1 - sqTrimR, y: yFlange }, { x: x1 - sqTrimR, y: yBody }, { x: x1, y: apexY, tag: 'bend_notch' });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1 - sqTrimR, y: yFlange }, { x: x1 - sqTrimR, y: yBody }, { x: x1, y: yBody });
        }
        zoneFills.push({
          kind: 'flange',
          points: [{ x: x0 + sqTrimL, y: yBody }, { x: x0 + sqTrimL, y: yFlange }, { x: x1 - sqTrimR, y: yFlange }, { x: x1 - sqTrimR, y: yBody }],
        });
        foldLines.push({ x1: x0 + sqTrimL, y1: yBody, x2: x1 - sqTrimR, y2: yBody });
      } else {
        const clr = Math.min(2.0, span * 0.06);
        if (isFirst) points.push({ x: x0, y: yBody }, { x: x0 + clr, y: yBody }, { x: x0 + clr, y: yFlange });
        else points.push({ x: x0 + clr, y: yBody }, { x: x0 + clr, y: yFlange });
        if (!isLast) {
          points.push({ x: x1 - clr, y: yFlange }, { x: x1 - clr, y: yBody }, { x: x1, y: apexY, tag: 'bend_notch' });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1 - clr, y: yFlange }, { x: x1 - clr, y: yBody }, { x: x1, y: yBody });
        }
        zoneFills.push({
          kind: 'flange',
          points: [{ x: x0 + clr, y: yBody }, { x: x0 + clr, y: yFlange }, { x: x1 - clr, y: yFlange }, { x: x1 - clr, y: yBody }],
        });
        foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
      }
    } else if (conn.type === 'end_cap') {
      const es = getEndCapEdgeSeam(conn, wall);
      const apexY = yBody - dirY * 4;
      if (es === 'pittsburgh') {
        const ch = Math.min(3.5, span * 0.08);
        if (isFirst) points.push({ x: x0, y: yBody }, { x: x0 + ch, y: yFlange });
        else points.push({ x: x0 + ch, y: yFlange });
        if (!isLast) {
          points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: apexY, tag: 'bend_notch' });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1 - ch, y: yFlange }, { x: x1, y: yBody });
        }
        zoneFills.push({
          kind: 'female_seam',
          points: [{ x: x0, y: yBody }, { x: x0 + ch, y: yFlange }, { x: x1 - ch, y: yFlange }, { x: x1, y: yBody }],
        });
        foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
      } else {
        points.push({ x: isFirst ? x0 : x0 + 2, y: yBody });
        if (!isLast) {
          points.push({ x: x1 - 2, y: yBody }, { x: x1, y: apexY, tag: 'bend_notch' });
          bendApexY.push(apexY);
        } else {
          points.push({ x: x1, y: yBody });
        }
      }
    } else if (conn.type === 'plain' && a > 0) {
      if (isFirst) points.push({ x: x0, y: yBody }, { x: x0, y: yFlange });
      else points.push({ x: x0 + 2, y: yFlange });
      if (!isLast) {
        const apexY = yFlange - dirY * 4;
        points.push({ x: x1 - 2, y: yFlange }, { x: x1, y: apexY, tag: 'bend_notch' });
        bendApexY.push(apexY);
      } else {
        points.push({ x: x1, y: yFlange }, { x: x1, y: yBody });
      }
      zoneFills.push({
        kind: 'plain_ext',
        points: [{ x: x0, y: yBody }, { x: x0, y: yFlange }, { x: x1, y: yFlange }, { x: x1, y: yBody }],
      });
      foldLines.push({ x1: x0, y1: yBody, x2: x1, y2: yBody });
    } else {
      const hasCornerCut = dBody > 0;
      const trimL = hasCornerCut && sAllow === 0 ? Math.min(8, span * 0.1) : 0;
      const trimR = hasCornerCut && eAllow === 0 ? Math.min(8, span * 0.1) : 0;
      if (isFirst) {
        if (trimL > 0) points.push({ x: x0 + trimL, y: ySeamEnd }, { x: x0 + trimL, y: yBody });
        else points.push({ x: x0, y: yBody });
      } else {
        points.push({ x: x0 + 2, y: yBody });
      }
      if (!isLast) {
        const apexY = yBody - dirY * 4;
        points.push({ x: x1 - 2, y: yBody }, { x: x1, y: apexY, tag: 'bend_notch' });
        bendApexY.push(apexY);
      } else {
        if (trimR > 0) points.push({ x: x1 - trimR, y: yBody }, { x: x1 - trimR, y: ySeamEnd }, { x: x1, y: ySeamEnd });
        else points.push({ x: x1, y: yBody }, { x: x1, y: ySeamEnd });
      }
    }
  }

  return {
    points,
    bendApexY,
    zoneFills,
    foldLines,
    extraCallouts,
    leftSeamLineY: ySeamEnd,
    rightSeamLineY: ySeamEnd,
  };
}

// ---------------------------------------------------------------------------
// 2. Linear Body Flat Piece Builder (for purely body-wall components)
// ---------------------------------------------------------------------------

function buildLinearBodyFlatPiece(
  config: DuctConfig,
  comp: FoldComponent,
  foldGraph: ResolvedFoldGraph,
  sheetWidthMm: number,
  sheetLengthMm: number,
  settings: WorkshopSettings
): FlatPatternPiece {
  const { W, H, L, c1, c2, stiffenerRibs } = config;
  const walls = comp.linearBodyWalls!;
  const startCorner = comp.startCorner!;
  const endCorner = comp.endCorner!;
  const startWall = walls[0];
  const endWall = walls[walls.length - 1];
  const startEdge = getEdgeSeamDetailFromFoldEdge(foldGraph.edges[startCorner], startWall);
  const endEdge = getEdgeSeamDetailFromFoldEdge(foldGraph.edges[endCorner], endWall);

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

  const c2Allow = getPieceEndAllowanceMm(c2, walls);
  const c1Allow = getPieceEndAllowanceMm(c1, walls);
  const yBodyTop = c2Allow;
  const yBodyBot = c2Allow + L;
  const blankL = L + c2Allow + c1Allow;

  let topNotch = getSeamNotchDepthIntoBody(c2);
  let botNotch = getSeamNotchDepthIntoBody(c1);
  if (topNotch + botNotch > L - 12) {
    const scale = Math.max(0, (L - 12) / Math.max(1, topNotch + botNotch));
    topNotch *= scale;
    botNotch *= scale;
  }

  const ySeamTop = yBodyTop + topNotch;
  const ySeamBot = yBodyBot - botNotch;

  const topRes = buildEndEdgePointsLR(walls, wallX0, wallX1, c2, yBodyTop, -1, sAllow, eAllow, topNotch, L, 'C2');
  const botRes = buildEndEdgePointsLR(walls, wallX0, wallX1, c1, yBodyBot, 1, sAllow, eAllow, botNotch, L, 'C1');

  const rawPts: TaggedPoint2D[] = [];
  rawPts.push(...topRes.points);

  // Item 1: Gentle 8° bevel (~0.98 mm on 7 mm width) at BOTH ends of Mí đơn (+7 mm) strips!
  const maleBevelInset = getMaleSeamBevelInsetMm(PITTSBURGH_MALE_ALLOWANCE, DEFAULT_MALE_SEAM_BEVEL_DEG);
  const rightBodyX = wallX1[walls.length - 1];
  const seamSpanY = Math.max(0, ySeamBot - ySeamTop);
  const isMaleRight = eAllow > 0 && endEdge.seamType === 'pittsburgh' && !endEdge.isFemaleSide;
  const chRightTop = isMaleRight ? Math.min(maleBevelInset, seamSpanY * 0.35) : 0;
  const chRightBot = isMaleRight ? Math.min(maleBevelInset, seamSpanY * 0.35) : 0;
  const rOuterTopY = ySeamTop + chRightTop;
  const rOuterBotY = ySeamBot - chRightBot;

  if (eAllow > 0) {
    rawPts.push(
      { x: rightBodyX, y: ySeamTop, tag: 'seam_corner', segFeature: isMaleRight ? 'male_bevel' : 'seam_edge' },
      { x: devW, y: rOuterTopY, tag: isMaleRight ? 'male_bevel' : 'seam_corner', segFeature: 'seam_edge' },
      { x: devW, y: rOuterBotY, tag: isMaleRight ? 'male_bevel' : 'seam_corner', segFeature: isMaleRight ? 'male_bevel' : 'seam_edge' },
      { x: rightBodyX, y: ySeamBot, tag: 'seam_corner', segFeature: 'cut' }
    );
  } else {
    rawPts.push(
      { x: rightBodyX, y: ySeamTop, tag: 'seam_corner', segFeature: 'seam_edge' },
      { x: rightBodyX, y: ySeamBot, tag: 'seam_corner', segFeature: 'cut' }
    );
  }

  rawPts.push(...[...botRes.points].reverse());

  const leftBodyX = wallX0[0];
  const isMaleLeft = sAllow > 0 && startEdge.seamType === 'pittsburgh' && !startEdge.isFemaleSide;
  const chLeftTop = isMaleLeft ? Math.min(maleBevelInset, seamSpanY * 0.35) : 0;
  const chLeftBot = isMaleLeft ? Math.min(maleBevelInset, seamSpanY * 0.35) : 0;
  const lOuterTopY = ySeamTop + chLeftTop;
  const lOuterBotY = ySeamBot - chLeftBot;

  if (sAllow > 0) {
    rawPts.push(
      { x: leftBodyX, y: ySeamBot, tag: 'seam_corner', segFeature: isMaleLeft ? 'male_bevel' : 'seam_edge' },
      { x: 0, y: lOuterBotY, tag: isMaleLeft ? 'male_bevel' : 'seam_corner', segFeature: 'seam_edge' },
      { x: 0, y: lOuterTopY, tag: isMaleLeft ? 'male_bevel' : 'seam_corner', segFeature: isMaleLeft ? 'male_bevel' : 'seam_edge' },
      { x: leftBodyX, y: ySeamTop, tag: 'seam_corner', segFeature: 'cut' }
    );
  } else {
    rawPts.push(
      { x: leftBodyX, y: ySeamBot, tag: 'seam_corner', segFeature: 'seam_edge' },
      { x: leftBodyX, y: ySeamTop, tag: 'seam_corner', segFeature: 'cut' }
    );
  }

  const { contour: outerContour, polygon: cutPolygon } = buildEditableContour(`${comp.id}-outer`, rawPts);

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

  const foldLines: Line2D[] = [...topRes.foldLines, ...botRes.foldLines];
  if (sAllow > 0) foldLines.push({ x1: leftBodyX, y1: lLineTopY, x2: leftBodyX, y2: lLineBotY, label: startEdge.label });
  if (eAllow > 0) foldLines.push({ x1: rightBodyX, y1: rLineTopY, x2: rightBodyX, y2: rLineBotY, label: endEdge.label });

  const bendLines: Line2D[] = [];
  const interactiveEdges: InteractiveEdge2D[] = [];
  const wallEndCornerMap: Record<WallId, CornerId> = { top: 'TL', left: 'BL', bottom: 'BR', right: 'TR' };
  for (let k = 0; k < walls.length - 1; k++) {
    const bx = wallX1[k];
    const y1 = topRes.bendApexY[k] ?? yBodyTop;
    const y2 = botRes.bendApexY[k] ?? yBodyBot;
    bendLines.push({ x1: bx, y1, x2: bx, y2, label: 'CHẤN 90°' });
    interactiveEdges.push({
      edgeId: wallEndCornerMap[walls[k]],
      mode: 'bend',
      x1: bx,
      y1,
      x2: bx,
      y2,
    });
  }
  // Also expose cap edges on C1/C2 when end is end_cap so user can right-click/double-click on 2D!
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (c2.type === 'end_cap') {
      interactiveEdges.push({
        edgeId: getCapEdgeId('c2', w),
        mode: foldGraph.edges[getCapEdgeId('c2', w)]?.mode ?? 'seam',
        x1: wallX0[i],
        y1: yBodyTop,
        x2: wallX1[i],
        y2: yBodyTop,
      });
    }
    if (c1.type === 'end_cap') {
      interactiveEdges.push({
        edgeId: getCapEdgeId('c1', w),
        mode: foldGraph.edges[getCapEdgeId('c1', w)]?.mode ?? 'seam',
        x1: wallX0[i],
        y1: yBodyBot,
        x2: wallX1[i],
        y2: yBodyBot,
      });
    }
  }

  const ribLayout = computeRibLayout(L, stiffenerRibs, settings.ribPitchMm);
  const ribLines: Line2D[] = [];
  const ribEdgePad = 14;
  if (ribLayout.count > 0) {
    const yMid = yBodyTop + L / 2;
    for (const zOff of ribLayout.zPositionsMm) {
      const ry = yMid + zOff;
      for (let i = 0; i < walls.length; i++) {
        const rx1 = wallX0[i] + Math.min(ribEdgePad, (wallX1[i] - wallX0[i]) * 0.12);
        const rx2 = wallX1[i] - Math.min(ribEdgePad, (wallX1[i] - wallX0[i]) * 0.12);
        if (rx2 - rx1 > 20) ribLines.push({ x1: rx1, y1: ry, x2: rx2, y2: ry });
      }
    }
  }

  const wallLabels: WallRegionLabel2D[] = walls.map((w, i) => ({
    x: (wallX0[i] + wallX1[i]) * 0.5,
    y: yBodyTop + Math.min(72, L * 0.14),
    text: WALL_LABELS[w].toUpperCase(),
    subtext: `${getWallLength(w, W, H)}`,
  }));

  const areaM2 = (devW / 1000) * (blankL / 1000);
  const limitCheck = evaluateSheetLimit(
    devW,
    blankL,
    sheetWidthMm,
    sheetLengthMm,
    settings.rollFormerLimitMm,
    ribLayout.count > 0,
    blankL
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
  ];
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
  if (c2Allow > 0) {
    dimensions.push({ axis: 'vertical', start: 0, end: yBodyTop, anchor: 0, offset: -58, label: `+${fmtMm(c2Allow)}`, tier: 'segment', accent: 'amber' });
  }
  dimensions.push({ axis: 'vertical', start: yBodyTop, end: yBodyBot, anchor: 0, offset: -58, label: `L=${L}`, tier: 'segment' });
  if (c1Allow > 0) {
    dimensions.push({ axis: 'vertical', start: yBodyBot, end: blankL, anchor: 0, offset: -58, label: `+${fmtMm(c1Allow)}`, tier: 'segment', accent: 'amber' });
  }
  if (ribLayout.count >= 2) {
    const yMid = yBodyTop + L / 2;
    dimensions.push({
      axis: 'vertical',
      start: yMid + ribLayout.zPositionsMm[0],
      end: yMid + ribLayout.zPositionsMm[1],
      anchor: devW,
      offset: 48,
      label: `Gân ${ribLayout.pitchMm}`,
      tier: 'detail',
      accent: 'sky',
    });
  }

  const callouts: Callout2D[] = [...topRes.extraCallouts, ...botRes.extraCallouts];
  const c2Badge = getEndNotchBadge(c2, 'C2');
  if (c2Badge) callouts.push({ x: devW * 0.5, y: -154, text: c2Badge, align: 'middle', tone: 'muted' });
  const c1Badge = getEndNotchBadge(c1, 'C1');
  if (c1Badge) {
    const baseC1Y = blankL + 56;
    const c1Y =
      limitCheck.orientation === 'ngang_chuan' && Math.abs(baseC1Y - sheetWidthMm) < 28
        ? sheetWidthMm + 34
        : baseC1Y;
    callouts.push({ x: devW * 0.5, y: c1Y, text: c1Badge, align: 'middle', tone: 'muted' });
  }
  if (c2.type === 'plain' && c2.plainExtensionMm > 0 && (sAllow > 0 || eAllow > 0)) {
    callouts.push({ x: devW + 18, y: yBodyTop + 4, text: `← Hết mí (+${c2.plainExtensionMm} trơn)`, align: 'start', tone: 'amber' });
  }
  if (c1.type === 'plain' && c1.plainExtensionMm > 0 && (sAllow > 0 || eAllow > 0)) {
    callouts.push({ x: devW + 18, y: yBodyBot + 4, text: `← Hết mí (+${c1.plainExtensionMm} trơn)`, align: 'start', tone: 'amber' });
  }

  const bendCount = Math.max(0, walls.length - 1);

  return {
    id: comp.id,
    partCode: comp.partCode,
    name: comp.name,
    subtitle: `${fmtMm(devW)} × ${fmtMm(blankL)} mm • ${areaM2.toFixed(2)} m² • ${bendCount} đường chấn`,
    isEndCap: false,
    leftCornerId: startCorner,
    rightCornerId: endCorner,
    bodyTopY: yBodyTop,
    bodyBottomY: yBodyBot,
    widthMm: devW,
    heightMm: blankL,
    areaM2,
    bendCount,
    originX: 0,
    originY: 0,
    outerContour,
    cutPolygon,
    zoneFills,
    bendLines,
    foldLines,
    ribLines,
    interactiveEdges,
    wallLabels,
    dimensions,
    callouts,
    centerLabelPos: { x: sAllow + (rightBodyX - sAllow) * 0.5, y: yBodyTop + L * 0.5 },
    limitCheck,
    viewingFaceNote: 'Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)',
  };
}

// ---------------------------------------------------------------------------
// 3. Detached End Cap Flat Piece Builder (Item 1: 8° Mí đơn bevel!)
// ---------------------------------------------------------------------------

function buildDetachedEndCapFlatPiece(
  config: DuctConfig,
  comp: FoldComponent,
  sheetWidthMm: number,
  sheetLengthMm: number,
  settings: WorkshopSettings
): FlatPatternPiece {
  const { W, H, stiffenerRibs } = config;
  const endKey = comp.endCapKey!;
  const conn = config[endKey];
  const endLbl = endKey === 'c1' ? 'Kết nối 1' : 'Kết nối 2';

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

  const maleBevel = getMaleSeamBevelInsetMm(PITTSBURGH_MALE_ALLOWANCE, DEFAULT_MALE_SEAM_BEVEL_DEG);
  const rawPts: TaggedPoint2D[] = [];
  const zoneFills: ZoneFill2D[] = [];
  const foldLines: Line2D[] = [];

  const edgeKind = (s: SeamType): ZoneFillKind | null =>
    s === 'pittsburgh' ? 'male_seam' : s === 'weld_overlap' ? 'weld_seam' : null;
  const edgeDim = (s: SeamType, a: number): string =>
    s === 'pittsburgh' ? '+7' : s === 'weld_overlap' ? `+${a}` : '0';

  // Top edge (L->R)
  if (tA > 0) {
    const ch = tSeam === 'pittsburgh' ? Math.min(maleBevel, W * 0.2) : 1.0;
    rawPts.push(
      { x: x0, y: y0, tag: 'body_corner', segFeature: 'male_bevel' },
      { x: x0 + ch, y: 0, tag: 'male_bevel', segFeature: 'seam_edge' },
      { x: x1 - ch, y: 0, tag: 'male_bevel', segFeature: 'male_bevel' },
      { x: x1, y: y0, tag: 'body_corner', segFeature: 'cut' }
    );
    const k = edgeKind(tSeam);
    if (k) zoneFills.push({ kind: k, points: [{ x: x0, y: y0 }, { x: x0 + ch, y: 0 }, { x: x1 - ch, y: 0 }, { x: x1, y: y0 }] });
    foldLines.push({ x1: x0, y1: y0, x2: x1, y2: y0 });
  } else {
    rawPts.push({ x: x0, y: y0, tag: 'body_corner' }, { x: x1, y: y0, tag: 'body_corner' });
  }

  // Right edge (T->B)
  if (rA > 0) {
    const ch = rSeam === 'pittsburgh' ? Math.min(maleBevel, H * 0.2) : 1.0;
    rawPts.push(
      { x: x1, y: y0, tag: 'body_corner', segFeature: 'male_bevel' },
      { x: devW, y: y0 + ch, tag: 'male_bevel', segFeature: 'seam_edge' },
      { x: devW, y: y1 - ch, tag: 'male_bevel', segFeature: 'male_bevel' },
      { x: x1, y: y1, tag: 'body_corner', segFeature: 'cut' }
    );
    const k = edgeKind(rSeam);
    if (k) zoneFills.push({ kind: k, points: [{ x: x1, y: y0 }, { x: devW, y: y0 + ch }, { x: devW, y: y1 - ch }, { x: x1, y: y1 }] });
    foldLines.push({ x1: x1, y1: y0, x2: x1, y2: y1 });
  } else {
    rawPts.push({ x: x1, y: y0, tag: 'body_corner' }, { x: x1, y: y1, tag: 'body_corner' });
  }

  // Bottom edge (R->L)
  if (bA > 0) {
    const ch = bSeam === 'pittsburgh' ? Math.min(maleBevel, W * 0.2) : 1.0;
    rawPts.push(
      { x: x1, y: y1, tag: 'body_corner', segFeature: 'male_bevel' },
      { x: x1 - ch, y: blankL, tag: 'male_bevel', segFeature: 'seam_edge' },
      { x: x0 + ch, y: blankL, tag: 'male_bevel', segFeature: 'male_bevel' },
      { x: x0, y: y1, tag: 'body_corner', segFeature: 'cut' }
    );
    const k = edgeKind(bSeam);
    if (k) zoneFills.push({ kind: k, points: [{ x: x1, y: y1 }, { x: x1 - ch, y: blankL }, { x: x0 + ch, y: blankL }, { x: x0, y: y1 }] });
    foldLines.push({ x1: x0, y1: y1, x2: x1, y2: y1 });
  } else {
    rawPts.push({ x: x1, y: y1, tag: 'body_corner' }, { x: x0, y: y1, tag: 'body_corner' });
  }

  // Left edge (B->T)
  if (lA > 0) {
    const ch = lSeam === 'pittsburgh' ? Math.min(maleBevel, H * 0.2) : 1.0;
    rawPts.push(
      { x: x0, y: y1, tag: 'body_corner', segFeature: 'male_bevel' },
      { x: 0, y: y1 - ch, tag: 'male_bevel', segFeature: 'seam_edge' },
      { x: 0, y: y0 + ch, tag: 'male_bevel', segFeature: 'male_bevel' },
      { x: x0, y: y0, tag: 'body_corner', segFeature: 'cut' }
    );
    const k = edgeKind(lSeam);
    if (k) zoneFills.push({ kind: k, points: [{ x: x0, y: y1 }, { x: 0, y: y1 - ch }, { x: 0, y: y0 + ch }, { x: x0, y: y0 }] });
    foldLines.push({ x1: x0, y1: y0, x2: x0, y2: y1 });
  } else {
    rawPts.push({ x: x0, y: y1, tag: 'body_corner' }, { x: x0, y: y0, tag: 'body_corner' });
  }

  const { contour: outerContour, polygon: cutPolygon } = buildEditableContour(`${comp.id}-outer`, rawPts);

  const interactiveEdges: InteractiveEdge2D[] = [
    { edgeId: getCapEdgeId(endKey, 'top'), mode: 'seam', x1: x0, y1: y0, x2: x1, y2: y0 },
    { edgeId: getCapEdgeId(endKey, 'bottom'), mode: 'seam', x1: x0, y1: y1, x2: x1, y2: y1 },
    { edgeId: getCapEdgeId(endKey, 'left'), mode: 'seam', x1: x0, y1: y0, x2: x0, y2: y1 },
    { edgeId: getCapEdgeId(endKey, 'right'), mode: 'seam', x1: x1, y1: y0, x2: x1, y2: y1 },
  ];

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
    { axis: 'horizontal', start: 0, end: devW, anchor: 0, offset: -112, label: `${fmtMm(devW)} mm`, tier: 'total', accent: limitCheck.exceedsSheetLimit && devW > sheetWidthMm ? 'red' : 'sky' },
    { axis: 'horizontal', start: x0, end: x1, anchor: 0, offset: -54, label: `W=${W}`, tier: 'segment' },
    { axis: 'vertical', start: 0, end: blankL, anchor: 0, offset: -120, label: `${fmtMm(blankL)} mm`, tier: 'total', accent: limitCheck.exceedsSheetLimit ? 'red' : limitCheck.exceedsRollFormer ? 'amber' : 'sky' },
    { axis: 'vertical', start: y0, end: y1, anchor: 0, offset: -58, label: `H=${H}`, tier: 'segment' },
  ];
  if (lA > 0) dimensions.push({ axis: 'horizontal', start: 0, end: x0, anchor: 0, offset: -54, label: edgeDim(lSeam, lA), tier: 'segment', accent: lSeam === 'pittsburgh' ? 'blue' : 'amber' });
  if (rA > 0) dimensions.push({ axis: 'horizontal', start: x1, end: devW, anchor: 0, offset: -54, label: edgeDim(rSeam, rA), tier: 'segment', accent: rSeam === 'pittsburgh' ? 'blue' : 'amber' });
  if (tA > 0) dimensions.push({ axis: 'vertical', start: 0, end: y0, anchor: 0, offset: -58, label: edgeDim(tSeam, tA), tier: 'segment', accent: tSeam === 'pittsburgh' ? 'blue' : 'amber' });
  if (bA > 0) dimensions.push({ axis: 'vertical', start: y1, end: blankL, anchor: 0, offset: -58, label: edgeDim(bSeam, bA), tier: 'segment', accent: bSeam === 'pittsburgh' ? 'blue' : 'amber' });
  if (ribLayout.count >= 2 && ribAlongX) {
    dimensions.push({
      axis: 'vertical',
      start: y0 + H * 0.5 + ribLayout.zPositionsMm[0],
      end: y0 + H * 0.5 + ribLayout.zPositionsMm[1],
      anchor: devW,
      offset: 48,
      label: `Gân ${ribLayout.pitchMm}`,
      tier: 'detail',
      accent: 'sky',
    });
  }

  const bendCount = [tA, bA, lA, rA].filter((a) => a > 0).length;
  const pittsCount = [tSeam, bSeam, lSeam, rSeam].filter((s) => s === 'pittsburgh').length;
  const callouts: Callout2D[] = [
    {
      x: devW * 0.5,
      y: -154,
      text: `Mảnh bịt đầu rời (${endLbl}) • ${pittsCount === 4 ? `4 cạnh Mí đơn (+7, vát ${DEFAULT_MALE_SEAM_BEVEL_DEG}°)` : `${pittsCount} Mí đơn / ${4 - pittsCount} Mí hàn`}`,
      align: 'middle',
      tone: 'sky',
    },
  ];

  return {
    id: comp.id,
    partCode: comp.partCode,
    name: comp.name,
    subtitle: `${fmtMm(devW)} × ${fmtMm(blankL)} mm • ${areaM2.toFixed(2)} m² • ${bendCount} cạnh bẻ`,
    isEndCap: true,
    endKey,
    widthMm: devW,
    heightMm: blankL,
    areaM2,
    bendCount,
    originX: 0,
    originY: 0,
    outerContour,
    cutPolygon,
    zoneFills,
    bendLines: [],
    foldLines,
    ribLines,
    interactiveEdges,
    wallLabels: [
      {
        x: x0 + W * 0.5,
        y: y0 + Math.min(55, H * 0.2),
        text: endKey === 'c1' ? 'BỊT KẾT NỐI 1' : 'BỊT KẾT NỐI 2',
        subtext: `${W}×${H}`,
      },
    ],
    dimensions,
    callouts,
    centerLabelPos: { x: x0 + W * 0.5, y: y0 + H * 0.52 },
    limitCheck,
    viewingFaceNote: 'Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)',
  };
}

// ---------------------------------------------------------------------------
// 4. General Face–Edge Spanning-Tree 2D Unfolder + Euler-Tour Polygon Merger
//    + 2D Overlap Checker (Item 6: arbitrary 5-face & 6-face free-merge nets!)
// ---------------------------------------------------------------------------

/** Side index in clockwise order around a face's local (lx, lz) rectangle (Y-down):
 *  0 = -Z (top), 1 = +X (right), 2 = +Z (bottom), 3 = -X (left)
 */
type LocalSideIdx = 0 | 1 | 2 | 3;

interface PlacedFace2D {
  face: FaceId;
  dimX: number;
  dimZ: number;
  cx: number;
  cy: number;
  rotY: number; // radians, exact multiple of π/2
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  to2D: (lx: number, lz: number) => Point2D;
  /** Mapping from local clockwise side index -> FoldEdgeId (if an edge exists on that side) */
  sideEdgeIds: Record<LocalSideIdx, FoldEdgeId | null>;
}

function getFaceSideEdgeIds(face: FaceId, config: DuctConfig): Record<LocalSideIdx, FoldEdgeId | null> {
  if (isBodyWall(face)) {
    const startC: Record<WallId, CornerId> = { bottom: 'BL', right: 'BR', top: 'TR', left: 'TL' };
    const endC: Record<WallId, CornerId> = { bottom: 'BR', right: 'TR', top: 'TL', left: 'BL' };
    return {
      0: config.c2.type === 'end_cap' ? getCapEdgeId('c2', face) : null, // -Z (C2)
      1: endC[face], // +X
      2: config.c1.type === 'end_cap' ? getCapEdgeId('c1', face) : null, // +Z (C1)
      3: startC[face], // -X
    };
  }
  if (face === 'cap_c1') {
    // cap_c1: ex=(+1,0,0), ez=(0,+1,0) -> -Z=bottom, +X=right, +Z=top, -X=left
    return {
      0: 'C1_bottom',
      1: 'C1_right',
      2: 'C1_top',
      3: 'C1_left',
    };
  }
  // cap_c2: ex=(+1,0,0), ez=(0,-1,0) -> -Z=top, +X=right, +Z=bottom, -X=left
  return {
    0: 'C2_top',
    1: 'C2_right',
    2: 'C2_bottom',
    3: 'C2_left',
  };
}

function getLocalSideEndpoints(
  dimX: number,
  dimZ: number,
  side: LocalSideIdx
): { a: Point2D; b: Point2D; out: Point2D; span: number } {
  const hx = dimX / 2;
  const hz = dimZ / 2;
  switch (side) {
    case 0:
      return { a: { x: -hx, y: -hz }, b: { x: hx, y: -hz }, out: { x: 0, y: -1 }, span: dimX };
    case 1:
      return { a: { x: hx, y: -hz }, b: { x: hx, y: hz }, out: { x: 1, y: 0 }, span: dimZ };
    case 2:
      return { a: { x: hx, y: hz }, b: { x: -hx, y: hz }, out: { x: 0, y: 1 }, span: dimX };
    case 3:
      return { a: { x: -hx, y: hz }, b: { x: -hx, y: -hz }, out: { x: -1, y: 0 }, span: dimZ };
  }
}

/** Places every face of a FoldComponent in exact 2D unfolded coordinates (u = x_3d, v = z_3d) */
function unfoldComponentFaces2D(
  comp: FoldComponent,
  config: DuctConfig
): Map<FaceId, PlacedFace2D> {
  const { W, H, L } = config;
  const placed = new Map<FaceId, PlacedFace2D>();

  const makeTo2D = (cx: number, cy: number, rotY: number) => {
    const c = Math.round(Math.cos(rotY));
    const s = Math.round(Math.sin(rotY));
    return (lx: number, lz: number): Point2D => ({
      x: cx + lx * c + lz * s,
      y: cy - lx * s + lz * c,
    });
  };

  const addPlaced = (face: FaceId, cx: number, cy: number, rotY: number) => {
    const basis = getFaceBasis3D(face, W, H, L);
    const to2D = makeTo2D(cx, cy, rotY);
    const hx = basis.dimX / 2;
    const hz = basis.dimZ / 2;
    const corners = [to2D(-hx, -hz), to2D(hx, -hz), to2D(hx, hz), to2D(-hx, hz)];
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    placed.set(face, {
      face,
      dimX: basis.dimX,
      dimZ: basis.dimZ,
      cx,
      cy,
      rotY,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      to2D,
      sideEdgeIds: getFaceSideEdgeIds(face, config),
    });
  };

  const visit = (node: FoldComponent['tree'], cx: number, cy: number, rotY: number) => {
    addPlaced(node.face, cx, cy, rotY);
    const bp = getFaceBasis3D(node.face, W, H, L);
    const parentTo2D = makeTo2D(cx, cy, rotY);

    for (const ch of node.children) {
      const bc = getFaceBasis3D(ch.face, W, H, L);
      // Shared edge midpoint in world = bp.origin + bc.origin
      const midX = bp.origin.x + bc.origin.x;
      const midY = bp.origin.y + bc.origin.y;
      const midZ = bp.origin.z + bc.origin.z;

      const dpx = midX - bp.origin.x;
      const dpy = midY - bp.origin.y;
      const dpz = midZ - bp.origin.z;
      const pPivotX = dpx * bp.ex.x + dpy * bp.ex.y + dpz * bp.ex.z;
      const pPivotZ = dpx * bp.ez.x + dpy * bp.ez.y + dpz * bp.ez.z;

      const dcx = bc.origin.x - midX;
      const dcy = bc.origin.y - midY;
      const dcz = bc.origin.z - midZ;
      const cOffX = dcx * bc.ex.x + dcy * bc.ex.y + dcz * bc.ex.z;
      const cOffZ = dcx * bc.ez.x + dcy * bc.ez.y + dcz * bc.ez.z;

      // Exact in-plane flatRotY from 3D hinge math
      const yCinPx = bc.ey.x * bp.ex.x + bc.ey.y * bp.ex.y + bc.ey.z * bp.ex.z;
      const yCinPz = bc.ey.x * bp.ez.x + bc.ey.y * bp.ez.y + bc.ey.z * bp.ez.z;
      const aPx = yCinPz;
      const aPz = -yCinPx;
      const hingeAxis: 'x' | 'z' = Math.abs(aPx) > 0.5 ? 'x' : 'z';
      const hingeSign: 1 | -1 = (hingeAxis === 'x' ? aPx : aPz) > 0 ? 1 : -1;

      const exCinP = {
        x: bc.ex.x * bp.ex.x + bc.ex.y * bp.ex.y + bc.ex.z * bp.ex.z,
        y: bc.ex.x * bp.ey.x + bc.ex.y * bp.ey.y + bc.ex.z * bp.ey.z,
        z: bc.ex.x * bp.ez.x + bc.ex.y * bp.ez.y + bc.ex.z * bp.ez.z,
      };
      const ezCinP = {
        x: bc.ez.x * bp.ex.x + bc.ez.y * bp.ex.y + bc.ez.z * bp.ex.z,
        y: bc.ez.x * bp.ey.x + bc.ez.y * bp.ey.y + bc.ez.z * bp.ey.z,
        z: bc.ez.x * bp.ez.x + bc.ez.y * bp.ez.y + bc.ez.z * bp.ez.z,
      };
      const rot90 = (v: { x: number; y: number; z: number }, s: 1 | -1) =>
        hingeAxis === 'x'
          ? s === 1
            ? { x: v.x, y: -v.z, z: v.y }
            : { x: v.x, y: v.z, z: -v.y }
          : s === 1
            ? { x: -v.y, y: v.x, z: v.z }
            : { x: v.y, y: -v.x, z: v.z };
      const exFlat = rot90(exCinP, (-hingeSign) as 1 | -1);
      const ezFlat = rot90(ezCinP, (-hingeSign) as 1 | -1);
      const flatRotY = Math.atan2(ezFlat.x, exFlat.x);

      const childRotY = rotY + flatRotY;
      const pivot2D = parentTo2D(pPivotX, pPivotZ);
      const cc = Math.round(Math.cos(childRotY));
      const ss = Math.round(Math.sin(childRotY));
      const childCx = pivot2D.x + cOffX * cc + cOffZ * ss;
      const childCy = pivot2D.y - cOffX * ss + cOffZ * cc;

      visit(ch, childCx, childCy, childRotY);
    }
  };

  visit(comp.tree, 0, 0, 0);
  return placed;
}

/**
 * Generates clockwise cut points along ONE free exterior side of a placed face in a merged tree.
 * Handles ALL factory edge profiles: TDC/TDF (+48 + V-indent), Nẹp C (+12.5 w/ 3.5 mm chamfer),
 * Mí kép (+31), Mí đơn (+7 w/ 8° bevel), Hàn chập, Bẻ chân, LCCT, Bích V (+8), Để thẳng (+L_thẳng),
 * and End Cap edges!
 */
function emitFreeSideProfile(
  pf: PlacedFace2D,
  side: LocalSideIdx,
  config: DuctConfig,
  foldGraph: ResolvedFoldGraph,
  startClearMm: number,
  endClearMm: number
): {
  pts: TaggedPoint2D[];
  zoneFill: ZoneFill2D | null;
  foldLine: Line2D | null;
} {
  const { a, b, out, span } = getLocalSideEndpoints(pf.dimX, pf.dimZ, side);
  const edgeId = pf.sideEdgeIds[side];
  const maleBevel = getMaleSeamBevelInsetMm(PITTSBURGH_MALE_ALLOWANCE, DEFAULT_MALE_SEAM_BEVEL_DEG);

  // Tangent unit vector along edge from a -> b (in local face space)
  const tx = (b.x - a.x) / Math.max(1e-6, span);
  const ty = (b.y - a.y) / Math.max(1e-6, span);

  // Helper: map (s along edge [0..span], d outward >= 0) -> 2D world point
  const ptAt = (s: number, d: number, tag?: VertexFeatureTag, segFeature?: SegmentFeatureKind): TaggedPoint2D => {
    const p = pf.to2D(a.x + tx * s + out.x * d, a.y + ty * s + out.y * d);
    return { x: p.x, y: p.y, tag, segFeature };
  };

  const sMin = Math.min(startClearMm, span * 0.22);
  const sMax = Math.max(sMin + 2, span - Math.min(endClearMm, span * 0.22));

  // Case 1: Body wall longitudinal side (side 1 or 3) -> Mí kép (+31), Mí đơn (+7 w/ 8° bevel), Hàn chập, or Hàn đấu đầu
  if (isBodyWall(pf.face) && (side === 1 || side === 3) && edgeId) {
    const seamDetail = getEdgeSeamDetailFromFoldEdge(foldGraph.edges[edgeId], pf.face);
    const allow = seamDetail.allowance;
    if (allow <= 0) {
      return { pts: [ptAt(0, 0, 'body_corner'), ptAt(span, 0, 'body_corner')], zoneFill: null, foldLine: null };
    }
    const isMale = seamDetail.seamType === 'pittsburgh' && !seamDetail.isFemaleSide;
    const ch = isMale ? Math.min(maleBevel, (sMax - sMin) * 0.3) : 0;
    const pts: TaggedPoint2D[] = [
      ptAt(0, 0, 'body_corner'),
      ...(sMin > 0.1 ? [ptAt(sMin, 0, 'seam_corner', isMale ? 'male_bevel' : 'seam_edge')] : []),
      ptAt(sMin + ch, allow, isMale ? 'male_bevel' : 'seam_corner', 'seam_edge'),
      ptAt(sMax - ch, allow, isMale ? 'male_bevel' : 'seam_corner', isMale ? 'male_bevel' : 'seam_edge'),
      ...(span - sMax > 0.1 ? [ptAt(sMax, 0, 'seam_corner')] : []),
      ptAt(span, 0, 'body_corner'),
    ];
    const pA = ptAt(sMin, 0);
    const pB = ptAt(sMin + ch, allow);
    const pC = ptAt(sMax - ch, allow);
    const pD = ptAt(sMax, 0);
    return {
      pts,
      zoneFill: seamDetail.zoneKind ? { kind: seamDetail.zoneKind, points: [pA, pB, pC, pD] } : null,
      foldLine: { x1: pA.x, y1: pA.y, x2: pD.x, y2: pD.y },
    };
  }

  // Case 2: End Cap face free side -> Mí đơn (+7 w/ 8° bevel), Hàn chập, or Hàn đấu đầu
  if (!isBodyWall(pf.face) && edgeId) {
    const endKey: 'c1' | 'c2' = pf.face === 'cap_c1' ? 'c1' : 'c2';
    const conn = config[endKey];
    const wall = foldGraph.edges[edgeId].wall!;
    const seam = getEndCapEdgeSeam(conn, wall);
    const allow = getEndCapPanelEdgeAllowance(conn, wall);
    if (allow <= 0) {
      return { pts: [ptAt(0, 0, 'body_corner'), ptAt(span, 0, 'body_corner')], zoneFill: null, foldLine: null };
    }
    const isPitts = seam === 'pittsburgh';
    const ch = isPitts ? Math.min(maleBevel, (sMax - sMin) * 0.25) : 1.0;
    const pts: TaggedPoint2D[] = [
      ptAt(0, 0, 'body_corner', 'male_bevel'),
      ...(sMin > 0.1 ? [ptAt(sMin, 0, 'seam_corner', 'male_bevel')] : []),
      ptAt(sMin + ch, allow, 'male_bevel', 'seam_edge'),
      ptAt(sMax - ch, allow, 'male_bevel', 'male_bevel'),
      ...(span - sMax > 0.1 ? [ptAt(sMax, 0, 'seam_corner')] : []),
      ptAt(span, 0, 'body_corner'),
    ];
    const pA = ptAt(sMin, 0);
    const pB = ptAt(sMin + ch, allow);
    const pC = ptAt(sMax - ch, allow);
    const pD = ptAt(sMax, 0);
    return {
      pts,
      zoneFill: { kind: isPitts ? 'male_seam' : 'weld_seam', points: [pA, pB, pC, pD] },
      foldLine: { x1: pA.x, y1: pA.y, x2: pD.x, y2: pD.y },
    };
  }

  // Case 3: Body wall end side (side 0 = C2, side 2 = C1)
  const wall = pf.face as WallId;
  const conn = side === 0 ? config.c2 : config.c1;
  const allow = getWallEndAllowanceMm(conn, wall);

  if (conn.type === 'tdc_tdf') {
    const stepIn = Math.min(1.5, span * 0.03);
    const xL = Math.max(sMin, stepIn);
    const xR = Math.min(sMax, span - stepIn);
    const hasSideV = conn.showEndIndent && allow >= 24 && xR - xL >= 60;
    const vPos = allow - Math.min(18, allow * 0.38);
    const pts: TaggedPoint2D[] = [ptAt(0, 0, 'tdc_notch'), ptAt(xL, 0, 'tdc_notch')];
    if (hasSideV) {
      pts.push(
        ptAt(xL, vPos - 3.5, 'tdc_tdf_indent'),
        ptAt(xL + 3.5, vPos, 'tdc_tdf_indent'),
        ptAt(xL, vPos + 3.5, 'tdc_tdf_indent')
      );
    }
    pts.push(ptAt(xL, allow, 'flange_tip'), ptAt(xR, allow, 'flange_tip'));
    if (hasSideV) {
      pts.push(
        ptAt(xR, vPos + 3.5, 'tdc_tdf_indent'),
        ptAt(xR - 3.5, vPos, 'tdc_tdf_indent'),
        ptAt(xR, vPos - 3.5, 'tdc_tdf_indent')
      );
    }
    pts.push(ptAt(xR, 0, 'tdc_notch'), ptAt(span, 0, 'tdc_notch'));
    return {
      pts,
      zoneFill: { kind: 'flange', points: [ptAt(xL, 0), ptAt(xL, allow), ptAt(xR, allow), ptAt(xR, 0)] },
      foldLine: { x1: ptAt(xL, 0).x, y1: ptAt(xL, 0).y, x2: ptAt(xR, 0).x, y2: ptAt(xR, 0).y },
    };
  }

  if (conn.type === 'nep_c') {
    // Item 2: Nẹp C +12.5 mm with 3.5 mm inward corner bevels!
    const trim = Math.min(1.8, span * 0.05);
    const xL = Math.max(sMin, trim);
    const xR = Math.min(sMax, span - trim);
    const ch = Math.min(NEP_C_CORNER_CHAMFER_MM, (xR - xL) * 0.14, allow * 0.45);
    const dCh = allow - ch;
    const pts: TaggedPoint2D[] = [
      ptAt(0, 0, 'body_corner'),
      ptAt(xL, 0, 'body_corner'),
      ptAt(xL, dCh, 'nep_c_chamfer', 'nep_c_chamfer'),
      ptAt(xL + ch, allow, 'nep_c_chamfer', 'flange_edge'),
      ptAt(xR - ch, allow, 'nep_c_chamfer', 'nep_c_chamfer'),
      ptAt(xR, dCh, 'nep_c_chamfer', 'flange_edge'),
      ptAt(xR, 0, 'body_corner'),
      ptAt(span, 0, 'body_corner'),
    ];
    return {
      pts,
      zoneFill: {
        kind: 'flange',
        points: [ptAt(xL, 0), ptAt(xL, dCh), ptAt(xL + ch, allow), ptAt(xR - ch, allow), ptAt(xR, dCh), ptAt(xR, 0)],
      },
      foldLine: { x1: ptAt(xL, 0).x, y1: ptAt(xL, 0).y, x2: ptAt(xR, 0).x, y2: ptAt(xR, 0).y },
    };
  }

  if (conn.type === 'end_cap' && allow > 0) {
    // Unmerged end_cap body wall edge: Mí kép chờ +31 mm
    const ch = Math.min(3.5, (sMax - sMin) * 0.08);
    const pts: TaggedPoint2D[] = [
      ptAt(0, 0, 'body_corner'),
      ...(sMin > 0.1 ? [ptAt(sMin, 0, 'seam_corner')] : []),
      ptAt(sMin + ch, allow, 'seam_corner'),
      ptAt(sMax - ch, allow, 'seam_corner'),
      ...(span - sMax > 0.1 ? [ptAt(sMax, 0, 'seam_corner')] : []),
      ptAt(span, 0, 'body_corner'),
    ];
    return {
      pts,
      zoneFill: { kind: 'female_seam', points: [ptAt(sMin, 0), ptAt(sMin + ch, allow), ptAt(sMax - ch, allow), ptAt(sMax, 0)] },
      foldLine: { x1: ptAt(sMin, 0).x, y1: ptAt(sMin, 0).y, x2: ptAt(sMax, 0).x, y2: ptAt(sMax, 0).y },
    };
  }

  if (allow > 0) {
    // General flange (LCCT, Bẻ chân, Bích V +8, Plain extension)
    const ch = conn.type === 'lcct' ? Math.min(18, (sMax - sMin) * 0.24) : conn.type === 'plain' ? 0 : 1.5;
    const pts: TaggedPoint2D[] = [
      ptAt(0, 0, 'body_corner'),
      ...(sMin > 0.1 ? [ptAt(sMin, 0, 'body_corner')] : []),
      ptAt(sMin + ch, allow, 'flange_tip'),
      ptAt(sMax - ch, allow, 'flange_tip'),
      ...(span - sMax > 0.1 ? [ptAt(sMax, 0, 'body_corner')] : []),
      ptAt(span, 0, 'body_corner'),
    ];
    return {
      pts,
      zoneFill: { kind: conn.type === 'plain' ? 'plain_ext' : 'flange', points: [ptAt(sMin, 0), ptAt(sMin + ch, allow), ptAt(sMax - ch, allow), ptAt(sMax, 0)] },
      foldLine: { x1: ptAt(sMin, 0).x, y1: ptAt(sMin, 0).y, x2: ptAt(sMax, 0).x, y2: ptAt(sMax, 0).y },
    };
  }

  return { pts: [ptAt(0, 0, 'body_corner'), ptAt(span, 0, 'body_corner')], zoneFill: null, foldLine: null };
}

/**
 * General Spanning-Tree 2D Flat Piece Builder for merged multi-face components
 * (e.g. `top + cap_c1`, `1-piece O + cap_c1`, `5-face cross`, `6-face box net`)!
 * Produces ONE single watertight clockwise outer laser-cut polygon via Euler-Tour perimeter walk,
 * plus exact 2D face-overlap detection, internal 90° bend lines, ribs, dimensions, and sheet checks.
 */
function buildMergedTreeFlatPiece(
  config: DuctConfig,
  comp: FoldComponent,
  foldGraph: ResolvedFoldGraph,
  sheetWidthMm: number,
  sheetLengthMm: number,
  settings: WorkshopSettings
): FlatPatternPiece {
  const { W, H, L, stiffenerRibs } = config;
  const placedMap = unfoldComponentFaces2D(comp, config);
  const placedList = Array.from(placedMap.values());

  // 1. Build bend-edge twin lookup: `${face}:${side}` -> { twinFace, twinSide, edgeId }
  const bendTwin = new Map<string, { twinFace: FaceId; twinSide: LocalSideIdx; edgeId: FoldEdgeId }>();
  const edgeToSides = new Map<FoldEdgeId, { face: FaceId; side: LocalSideIdx }[]>();
  for (const pf of placedList) {
    for (const side of [0, 1, 2, 3] as LocalSideIdx[]) {
      const eid = pf.sideEdgeIds[side];
      if (!eid || foldGraph.edges[eid]?.mode !== 'bend') continue;
      if (!edgeToSides.has(eid)) edgeToSides.set(eid, []);
      edgeToSides.get(eid)!.push({ face: pf.face, side });
    }
  }
  for (const [eid, pairs] of edgeToSides.entries()) {
    if (pairs.length === 2) {
      bendTwin.set(`${pairs[0].face}:${pairs[0].side}`, { twinFace: pairs[1].face, twinSide: pairs[1].side, edgeId: eid });
      bendTwin.set(`${pairs[1].face}:${pairs[1].side}`, { twinFace: pairs[0].face, twinSide: pairs[0].side, edgeId: eid });
    }
  }

  // 2. Detect 2D face overlaps across all distinct face pairs in this unfolded net!
  const overlapRectsRaw: OverlapRect2D[] = [];
  for (let i = 0; i < placedList.length; i++) {
    for (let j = i + 1; j < placedList.length; j++) {
      const a = placedList[i];
      const b = placedList[j];
      const ox0 = Math.max(a.minX, b.minX);
      const oy0 = Math.max(a.minY, b.minY);
      const ox1 = Math.min(a.maxX, b.maxX);
      const oy1 = Math.min(a.maxY, b.maxY);
      if (ox1 - ox0 > 1.0 && oy1 - oy0 > 1.0) {
        overlapRectsRaw.push({
          x: ox0,
          y: oy0,
          w: ox1 - ox0,
          h: oy1 - oy0,
          label: `${FACE_SHORT_LABELS[a.face]} ∩ ${FACE_SHORT_LABELS[b.face]}`,
        });
      }
    }
  }

  // Helper: check if transitioning across bend(s) at the start or end corner of (pf, side) forms a 90° reflex corner
  // (e.g. 5-face cross), in which case we give a clean corner clearance trim so adjacent seam strips never self-intersect.
  const getCornerReflexTrim = (pf: PlacedFace2D, side: LocalSideIdx, atEnd: boolean): number => {
    const adjSide = ((side + (atEnd ? 1 : 3)) % 4) as LocalSideIdx;
    const twin = bendTwin.get(`${pf.face}:${adjSide}`);
    if (!twin) return 0;
    // Check if the twin's next side after crossing is ALSO a free edge whose outward vector points back into our tab
    const nextSide = ((twin.twinSide + (atEnd ? 1 : 3)) % 4) as LocalSideIdx;
    if (bendTwin.has(`${twin.twinFace}:${nextSide}`)) {
      // Two bends meeting at a reflex vertex -> 90° concave notch! Trim clearance generously.
      return 34;
    }
    return 2.0; // Clean 2 mm bend notch relief for collinear transitions (e.g. top + cap_c1)
  };

  // 3. Euler-Tour Clockwise Outer Perimeter Walk (visits EVERY free exterior edge exactly once!)
  let startFace: FaceId | null = null;
  let startSide: LocalSideIdx = 0;
  outerSearch: for (const pf of placedList) {
    for (const s of [0, 1, 2, 3] as LocalSideIdx[]) {
      if (!bendTwin.has(`${pf.face}:${s}`)) {
        startFace = pf.face;
        startSide = s;
        break outerSearch;
      }
    }
  }

  const rawPts: TaggedPoint2D[] = [];
  const rawZones: ZoneFill2D[] = [];
  const rawFolds: Line2D[] = [];
  const rawInteractive: InteractiveEdge2D[] = [];

  if (startFace) {
    let curFace: FaceId = startFace;
    let curSide: LocalSideIdx = startSide;
    let guard = 0;
    do {
      const pf = placedMap.get(curFace)!;
      const trimStart = getCornerReflexTrim(pf, curSide, false);
      const trimEnd = getCornerReflexTrim(pf, curSide, true);
      const emitted = emitFreeSideProfile(pf, curSide, config, foldGraph, trimStart, trimEnd);
      rawPts.push(...emitted.pts);
      if (emitted.zoneFill) rawZones.push(emitted.zoneFill);
      if (emitted.foldLine) rawFolds.push(emitted.foldLine);

      const eid = pf.sideEdgeIds[curSide];
      if (eid) {
        const ep = getLocalSideEndpoints(pf.dimX, pf.dimZ, curSide);
        const pa = pf.to2D(ep.a.x, ep.a.y);
        const pb = pf.to2D(ep.b.x, ep.b.y);
        rawInteractive.push({ edgeId: eid, mode: 'seam', x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
      }

      // Advance clockwise around end corner across any internal 'bend' edges!
      let nextFace: FaceId = curFace;
      let nextSide: LocalSideIdx = ((curSide + 1) % 4) as LocalSideIdx;
      let crossGuard = 0;
      while (bendTwin.has(`${nextFace}:${nextSide}`) && crossGuard < 12) {
        const twin = bendTwin.get(`${nextFace}:${nextSide}`)!;
        nextFace = twin.twinFace;
        nextSide = ((twin.twinSide + 1) % 4) as LocalSideIdx;
        crossGuard++;
      }
      curFace = nextFace;
      curSide = nextSide;
      guard++;
    } while ((curFace !== startFace || curSide !== startSide) && guard < 40);
  }

  // 4. Collect internal 90° bend lines, stiffener ribs, and wall region labels
  const rawBends: Line2D[] = [];
  const seenBendIds = new Set<FoldEdgeId>();
  for (const [eid, pairs] of edgeToSides.entries()) {
    if (seenBendIds.has(eid) || pairs.length === 0) continue;
    seenBendIds.add(eid);
    const pf = placedMap.get(pairs[0].face)!;
    const ep = getLocalSideEndpoints(pf.dimX, pf.dimZ, pairs[0].side);
    const pa = pf.to2D(ep.a.x, ep.a.y);
    const pb = pf.to2D(ep.b.x, ep.b.y);
    rawBends.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, label: 'CHẤN 90°' });
    rawInteractive.push({ edgeId: eid, mode: 'bend', x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
  }

  const rawRibs: Line2D[] = [];
  const rawWallLabels: WallRegionLabel2D[] = [];
  const bodyRibLayout = computeRibLayout(L, stiffenerRibs, settings.ribPitchMm);

  for (const pf of placedList) {
    if (isBodyWall(pf.face)) {
      const span = getWallLength(pf.face, W, H);
      const pad = Math.min(14, span * 0.12);
      for (const zOff of bodyRibLayout.zPositionsMm) {
        const p1 = pf.to2D(-span / 2 + pad, zOff);
        const p2 = pf.to2D(span / 2 - pad, zOff);
        rawRibs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
      const lp = pf.to2D(0, -L * 0.34);
      rawWallLabels.push({
        x: lp.x,
        y: lp.y,
        text: WALL_LABELS[pf.face].toUpperCase(),
        subtext: `${span}`,
      });
    } else {
      const ribAlongX = W >= H;
      const capRibs = computeRibLayout(ribAlongX ? H : W, stiffenerRibs, settings.ribPitchMm);
      const pad = 18;
      for (const off of capRibs.zPositionsMm) {
        if (ribAlongX) {
          const p1 = pf.to2D(-W / 2 + pad, off);
          const p2 = pf.to2D(W / 2 - pad, off);
          rawRibs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        } else {
          const p1 = pf.to2D(off, -H / 2 + pad);
          const p2 = pf.to2D(off, H / 2 - pad);
          rawRibs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        }
      }
      const endLbl = pf.face === 'cap_c1' ? 'KẾT NỐI 1' : 'KẾT NỐI 2';
      const lp = pf.to2D(0, 0);
      rawWallLabels.push({
        x: lp.x,
        y: lp.y,
        text: `BỊT ${endLbl}`,
        subtext: `${W}×${H}`,
      });
    }
  }

  // 5. Normalize entire piece so bounding box starts strictly at (0, 0)
  const allX = rawPts.map((p) => p.x);
  const allY = rawPts.map((p) => p.y);
  const minX = allX.length > 0 ? Math.min(...allX) : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) : W;
  const minY = allY.length > 0 ? Math.min(...allY) : 0;
  const maxY = allY.length > 0 ? Math.max(...allY) : L;
  const widthMm = Number((maxX - minX).toFixed(2));
  const heightMm = Number((maxY - minY).toFixed(2));

  const shiftPt = (p: Point2D): Point2D => ({ x: p.x - minX, y: p.y - minY });
  const shiftLine = (l: Line2D): Line2D => ({
    ...l,
    x1: l.x1 - minX,
    y1: l.y1 - minY,
    x2: l.x2 - minX,
    y2: l.y2 - minY,
  });

  const shiftedTagged: TaggedPoint2D[] = rawPts.map((p) => ({
    ...p,
    x: p.x - minX,
    y: p.y - minY,
  }));
  const { contour: outerContour, polygon: cutPolygon } = buildEditableContour(`${comp.id}-outer`, shiftedTagged);
  const zoneFills: ZoneFill2D[] = rawZones.map((z) => ({ kind: z.kind, points: z.points.map(shiftPt) }));
  const foldLines = rawFolds.map(shiftLine);
  const bendLines = rawBends.map(shiftLine);
  const ribLines = rawRibs.map(shiftLine);
  const interactiveEdges: InteractiveEdge2D[] = rawInteractive.map((e) => ({
    ...e,
    x1: e.x1 - minX,
    y1: e.y1 - minY,
    x2: e.x2 - minX,
    y2: e.y2 - minY,
  }));
  const wallLabels: WallRegionLabel2D[] = rawWallLabels.map((wl) => ({
    ...wl,
    x: wl.x - minX,
    y: wl.y - minY,
  }));
  const overlapRects: OverlapRect2D[] = overlapRectsRaw.map((r) => ({
    ...r,
    x: r.x - minX,
    y: r.y - minY,
  }));

  const rootPlaced = placedMap.get(comp.rootFace) ?? placedList[0];
  const centerLabelPos = shiftPt({ x: rootPlaced.cx, y: rootPlaced.cy });

  const areaM2 = (widthMm / 1000) * (heightMm / 1000);
  const hasOverlap2D = overlapRects.length > 0;
  const overlapWarning = hasOverlap2D
    ? `Chồng đè mặt khi trải phẳng 2D (${overlapRects.map((r) => r.label).join(', ')}) — Không thể cắt Laser liền mảnh!`
    : undefined;

  const limitCheck = evaluateSheetLimit(
    widthMm,
    heightMm,
    sheetWidthMm,
    sheetLengthMm,
    settings.rollFormerLimitMm,
    ribLines.length > 0,
    Math.min(widthMm, heightMm) <= settings.rollFormerLimitMm ? heightMm : Math.max(widthMm, heightMm)
  );

  // Clean overall dimensions (both X and Y) + face-boundary breakdown where clean
  const dimensions: Dimension2D[] = [
    {
      axis: 'horizontal',
      start: 0,
      end: widthMm,
      anchor: 0,
      offset: -112,
      label: `${fmtMm(widthMm)} mm`,
      tier: 'total',
      accent: limitCheck.exceedsSheetLimit && widthMm > sheetWidthMm ? 'red' : 'sky',
    },
    {
      axis: 'vertical',
      start: 0,
      end: heightMm,
      anchor: 0,
      offset: -120,
      label: `${fmtMm(heightMm)} mm`,
      tier: 'total',
      accent: limitCheck.exceedsSheetLimit ? 'red' : limitCheck.exceedsRollFormer ? 'amber' : 'sky',
    },
  ];

  // Add per-face segment chain along vertical axis if faces stack cleanly vertically (e.g., top + cap_c1!)
  const yStops = new Set<number>([0, heightMm]);
  for (const pf of placedList) {
    yStops.add(Number((pf.minY - minY).toFixed(2)));
    yStops.add(Number((pf.maxY - minY).toFixed(2)));
  }
  const sortedY = Array.from(yStops).sort((a, b) => a - b);
  for (let i = 0; i < sortedY.length - 1; i++) {
    const seg = sortedY[i + 1] - sortedY[i];
    if (seg >= 6) {
      dimensions.push({
        axis: 'vertical',
        start: sortedY[i],
        end: sortedY[i + 1],
        anchor: 0,
        offset: -58,
        label: `${fmtMm(seg)}`,
        tier: 'segment',
      });
    }
  }

  const callouts: Callout2D[] = [
    {
      x: widthMm * 0.5,
      y: -154,
      text: `Ghép tự do (${comp.faces.map((f) => FACE_SHORT_LABELS[f]).join(' + ')}) • ${comp.bendCount} đường chấn 90° liền mảnh`,
      align: 'middle',
      tone: hasOverlap2D ? 'amber' : 'sky',
    },
  ];

  return {
    id: comp.id,
    partCode: comp.partCode,
    name: comp.name,
    subtitle: `${fmtMm(widthMm)} × ${fmtMm(heightMm)} mm • ${areaM2.toFixed(2)} m² • ${comp.bendCount} đường chấn`,
    isEndCap: false,
    isMergedTree: true,
    widthMm,
    heightMm,
    areaM2,
    bendCount: comp.bendCount,
    originX: 0,
    originY: 0,
    outerContour,
    cutPolygon,
    zoneFills,
    bendLines,
    foldLines,
    ribLines,
    interactiveEdges,
    wallLabels,
    dimensions,
    callouts,
    centerLabelPos,
    limitCheck,
    hasOverlap2D,
    overlapWarning,
    overlapRects: hasOverlap2D ? overlapRects : undefined,
    viewingFaceNote: 'Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)',
  };
}

// ---------------------------------------------------------------------------
// 5. Master Straight-Duct Flat Pattern Document Builder (FoldGraph-driven!)
// ---------------------------------------------------------------------------

export function buildStraightDuctFlatPattern(
  config: DuctConfig,
  settings: WorkshopSettings = DEFAULT_WORKSHOP_SETTINGS
): FlatPatternDocument {
  const { widthMm: sheetWidthMm, lengthMm: sheetLengthMm } = getActiveSheetDimensions(
    config.sheetMaterial,
    settings
  );
  const foldGraph = resolveFoldGraph(config);

  const pieces: FlatPatternPiece[] = foldGraph.components.map((comp) => {
    if (comp.isPureEndCap) {
      return buildDetachedEndCapFlatPiece(config, comp, sheetWidthMm, sheetLengthMm, settings);
    }
    if (comp.isPureBodyLinear) {
      return buildLinearBodyFlatPiece(config, comp, foldGraph, sheetWidthMm, sheetLengthMm, settings);
    }
    return buildMergedTreeFlatPiece(config, comp, foldGraph, sheetWidthMm, sheetLengthMm, settings);
  });

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
  const endsStr =
    c1Short === c2Short
      ? `2× ${c1Short}`
      : `Kết nối 1: ${c1Short} • Kết nối 2: ${c2Short}`;

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
    exportFileName: `EUSTEEL_DUCT3D_${config.W}x${config.H}_L${config.L}`,
  };
}
