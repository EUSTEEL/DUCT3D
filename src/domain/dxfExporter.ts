import {
  BlockFlags,
  DxfWriter,
  LWPolylineFlags,
  MTextAttachmentPoint,
  Units,
  point2d,
  point3d,
} from '@tarikjabiri/dxf';
import type { Dimension2D, FlatPatternDocument, FlatPatternPiece, Point2D } from '../types/flatPattern2d';

/** Fixed uniform spacing (mm) between adjacent cut pieces in exported DXF nesting */
export const DXF_PIECE_GAP_MM = 20;

/**
 * Generates compact timestamp filename per SPEC Item 4: `YYYYMMDD_HHmmss.dxf`
 * (e.g. `20261126_223500.dxf`).
 */
export function formatDxfTimestampFileName(now: Date = new Date()): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}.dxf`;
}

interface DxfPlacedPiece {
  piece: FlatPatternPiece;
  /** Lower-left X of piece bounding box in CAD coordinates (mm, X right) */
  x0: number;
  /** Lower-left Y of piece bounding box in CAD coordinates (mm, Y up) */
  y0: number;
  row: number;
  col: number;
  rowCount: number;
}

function fmtDimVal(v: number): string {
  const clean = Math.abs(v) < 1e-4 ? 0 : Math.round(v * 10) / 10;
  return Number.isInteger(clean) ? String(clean) : clean.toFixed(1).replace(/\.0$/, '');
}

function roundCoord(v: number): number {
  const clean = Math.abs(v) < 1e-6 ? 0 : v;
  return Math.round(clean * 1000) / 1000;
}

/**
 * Cleans a closed polygon loop for CNC Laser LWPOLYLINE export:
 * - Removes duplicate consecutive / wrap-around vertices
 * - Removes strictly collinear intermediate vertices along straight segments
 *   so Bodor Thinker 3.0 & AutoCAD 2021 receive minimal watertight closed LWPOLYLINE loops
 *   with zero zero-length segments and zero overlapping lines.
 */
function cleanClosedLoop(pts: readonly Point2D[]): Point2D[] {
  const deduped: Point2D[] = [];
  for (const p of pts) {
    const rx = roundCoord(p.x);
    const ry = roundCoord(p.y);
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.hypot(rx - prev.x, ry - prev.y) > 0.02) {
      deduped.push({ x: rx, y: ry });
    }
  }
  while (
    deduped.length > 2 &&
    Math.hypot(
      deduped[0].x - deduped[deduped.length - 1].x,
      deduped[0].y - deduped[deduped.length - 1].y
    ) <= 0.02
  ) {
    deduped.pop();
  }
  if (deduped.length <= 3) return deduped;

  const minimal: Point2D[] = [];
  const n = deduped.length;
  for (let i = 0; i < n; i++) {
    const a = deduped[(i - 1 + n) % n];
    const b = deduped[i];
    const c = deduped[(i + 1) % n];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const bcx = c.x - b.x;
    const bcy = c.y - b.y;
    const lenAB = Math.hypot(abx, aby);
    const lenBC = Math.hypot(bcx, bcy);
    if (lenAB < 1e-4 || lenBC < 1e-4) continue;
    const cross = Math.abs(abx * bcy - aby * bcx) / (lenAB * lenBC);
    const dot = (abx * bcx + aby * bcy) / (lenAB * lenBC);
    if (cross < 1e-4 && dot > 0.9999) {
      continue;
    }
    minimal.push(b);
  }
  return minimal.length >= 3 ? minimal : deduped;
}

/**
 * Packs all flat-pattern pieces cleanly for CNC Laser DXF cutting with exact
 * `DXF_PIECE_GAP_MM` (20 mm) separation and at most 2 columns per row so every
 * piece sits on an outer perimeter for non-overlapping AutoCAD dimensions.
 */
function layoutPiecesForDxf(pieces: readonly FlatPatternPiece[]): {
  placed: DxfPlacedPiece[];
  cutMaxX: number;
  cutMaxY: number;
} {
  if (pieces.length === 0) {
    return { placed: [], cutMaxX: 100, cutMaxY: 100 };
  }

  const bodyPieces = pieces.filter((p) => !p.isEndCap);
  const capPieces = pieces.filter((p) => p.isEndCap);

  const rows: FlatPatternPiece[][] = [];
  if (bodyPieces.length === 1 && capPieces.length === 1) {
    rows.push([bodyPieces[0], capPieces[0]]);
  } else {
    for (let i = 0; i < bodyPieces.length; i += 2) {
      rows.push(bodyPieces.slice(i, i + 2));
    }
    for (let i = 0; i < capPieces.length; i += 2) {
      rows.push(capPieces.slice(i, i + 2));
    }
  }

  const rowHeights = rows.map((row) => Math.max(...row.map((p) => p.heightMm)));
  const totalHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rows.length - 1) * DXF_PIECE_GAP_MM;

  const placed: DxfPlacedPiece[] = [];
  let maxX = 0;
  let cursorTopY = totalHeight;

  rows.forEach((row, rIdx) => {
    const rH = rowHeights[rIdx];
    const rowBottomY = cursorTopY - rH;
    let cursorX = 0;
    row.forEach((piece, cIdx) => {
      placed.push({
        piece,
        x0: cursorX,
        y0: rowBottomY,
        row: rIdx,
        col: cIdx,
        rowCount: rows.length,
      });
      cursorX += piece.widthMm + DXF_PIECE_GAP_MM;
      maxX = Math.max(maxX, cursorX - DXF_PIECE_GAP_MM);
    });
    cursorTopY = rowBottomY - DXF_PIECE_GAP_MM;
  });

  return { placed, cutMaxX: maxX, cutMaxY: totalHeight };
}

/**
 * Generates an AutoCAD 2021+ (AC1021) & Bodor Thinker 3.0 compliant ASCII DXF string
 * using `@tarikjabiri/dxf`:
 * - Complete HEADER ($INSUNITS = 4 mm, $MEASUREMENT = 1 metric, exact extents & $HANDSEED),
 *   CLASSES, TABLES, BLOCKS (with anonymous `*D1..*Dn` dimension display blocks), ENTITIES, OBJECTS.
 * - Absolute 1:1 mm scale, CAD Y-up coordinate system.
 * - Strictly 2 entity layers ONLY:
 *   1. `CUT`: Closed `LWPOLYLINE` outer contours (read from editable `outerContour.vertices`)
 *             + optional inner cutout contours, spaced 20 mm apart.
 *   2. `DIM`: Native DXF `DIMENSION` entities (LinearDimension, style `Standard`) paired with
 *             anonymous `*D1..*Dn` geometry blocks so AutoCAD 2021 renders all dimensions
 *             immediately with zero errors while Bodor Thinker 3.0 isolates layer `CUT` cleanly.
 * - Excludes 100% of bend lines, stiffener ribs, sheet guides, callouts, and inner 1-A/1-B labels.
 */
export function buildExportableDxfString(doc: FlatPatternDocument): string {
  const { placed, cutMaxX, cutMaxY } = layoutPiecesForDxf(doc.pieces);

  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.setVariable('$MEASUREMENT', { 70: 1 }); // Metric (mm)
  dxf.setVariable('$DIMSCALE', { 40: 1 });
  dxf.setVariable('$DIMTXT', { 40: 16 });
  dxf.setVariable('$DIMASZ', { 40: 8 });
  dxf.setVariable('$DIMEXO', { 40: 4 });
  dxf.setVariable('$DIMEXE', { 40: 6 });
  dxf.setVariable('$DIMGAP', { 40: 4 });
  dxf.setVariable('$DIMDEC', { 70: 1 });
  dxf.setVariable('$DIMZIN', { 70: 8 });
  dxf.setVariable('$DIMTAD', { 70: 1 });

  // Configure Standard DIMSTYLE for crisp 1:1 mm display in AutoCAD 2021
  const dimStyle = dxf.document.dimStyleStandard;
  dimStyle.DIMSCALE = 1;
  dimStyle.DIMASZ = 8;
  dimStyle.DIMEXO = 4;
  dimStyle.DIMEXE = 6;
  dimStyle.DIMDLI = 12;
  dimStyle.DIMTXT = 16;
  dimStyle.DIMGAP = 4;
  dimStyle.DIMDEC = 1;
  dimStyle.DIMZIN = 8;
  dimStyle.DIMTAD = 1;
  dimStyle.DIMTIH = 0;
  dimStyle.DIMTOH = 0;
  dimStyle.DIMTOFL = 1;

  // Define strictly 2 user layers: CUT (ACI 7) & DIM (ACI 3); system layer 0 remains empty
  dxf.addLayer('CUT', 7, 'Continuous');
  dxf.addLayer('DIM', 3, 'Continuous');
  dxf.setZeroLayerAsCurrent();

  let extMinX = 0;
  let extMinY = 0;
  let extMaxX = cutMaxX;
  let extMaxY = cutMaxY;
  const trackPt = (x: number, y: number) => {
    extMinX = Math.min(extMinX, x);
    extMinY = Math.min(extMinY, y);
    extMaxX = Math.max(extMaxX, x);
    extMaxY = Math.max(extMaxY, y);
  };

  let dimBlockCounter = 1;

  for (const item of placed) {
    const { piece, x0, y0, row, col, rowCount } = item;
    const h = piece.heightMm;
    const w = piece.widthMm;

    // Map SVG piece-local (x right, y down) -> CAD world (x right, y up)
    const toCad = (p: Point2D): Point2D => ({
      x: roundCoord(x0 + p.x),
      y: roundCoord(y0 + (h - p.y)),
    });

    // 1. Layer CUT: Read from open editable outerContour.vertices (fallback cutPolygon)
    const outerSrc = piece.outerContour?.vertices?.length
      ? piece.outerContour.vertices
      : piece.cutPolygon;
    const outerLoop = cleanClosedLoop(outerSrc.map(toCad));
    if (outerLoop.length >= 3) {
      dxf.addLWPolyline(
        outerLoop.map((v) => ({ point: point2d(v.x, v.y) })),
        {
          flags: LWPolylineFlags.Closed,
          layerName: 'CUT',
        }
      );
      outerLoop.forEach((p) => trackPt(p.x, p.y));
    }

    // Optional interior cutouts (holes / branches in future stages), also on Layer CUT
    const holeLoops: Point2D[][] = [];
    if (piece.innerContours && piece.innerContours.length > 0) {
      for (const ic of piece.innerContours) {
        holeLoops.push(ic.vertices.map((v) => ({ x: v.x, y: v.y })));
      }
    } else if (piece.innerHoles) {
      holeLoops.push(...piece.innerHoles);
    }
    for (const hole of holeLoops) {
      const cleanHole = cleanClosedLoop(hole.map(toCad));
      if (cleanHole.length >= 3) {
        dxf.addLWPolyline(
          cleanHole.map((v) => ({ point: point2d(v.x, v.y) })),
          {
            flags: LWPolylineFlags.Closed,
            layerName: 'CUT',
          }
        );
        cleanHole.forEach((p) => trackPt(p.x, p.y));
      }
    }

    // 2. Layer DIM: Native Linear DIMENSION entities + anonymous `*D1..*Dn` display blocks
    const primaryDims: Dimension2D[] = piece.dimensions.filter(
      (d) => (d.tier === 'total' || d.tier === 'segment') && Math.abs(d.end - d.start) >= 0.5
    );

    const hDir = rowCount > 1 && row === rowCount - 1 ? -1 : 1;
    const vDir = col === 0 ? -1 : 1;
    const dimExo = 4;
    const dimExe = 6;
    const tick = 5.5;

    for (const d of primaryDims) {
      const dist = d.tier === 'total' ? 92 : 44;
      const blockName = `*D${dimBlockCounter++}`;
      const dimBlock = dxf.document.blocks.addBlock(blockName, dxf.document.objects, false);
      dimBlock.flags = BlockFlags.AnonymousBlock;
      dimBlock.setLayerName('0');

      if (d.axis === 'horizontal') {
        const ax1 = roundCoord(x0 + Math.min(d.start, d.end));
        const ax2 = roundCoord(x0 + Math.max(d.start, d.end));
        const spanMm = roundCoord(Math.abs(ax2 - ax1));
        const anchorY = roundCoord(hDir > 0 ? y0 + h : y0);
        const dimY = roundCoord(anchorY + hDir * dist);
        const midX = roundCoord((ax1 + ax2) * 0.5);
        const midY = roundCoord(dimY + hDir * 13);

        // Anonymous display block geometry (for immediate crisp rendering in AutoCAD 2021)
        const extStartY = roundCoord(anchorY + hDir * dimExo);
        const extEndY = roundCoord(dimY + hDir * dimExe);
        dimBlock.addLine(point3d(ax1, extStartY, 0), point3d(ax1, extEndY, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(ax2, extStartY, 0), point3d(ax2, extEndY, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(ax1, dimY, 0), point3d(ax2, dimY, 0), { layerName: 'DIM' });
        // Crisp architectural diagonal ticks at both endpoints
        dimBlock.addLine(point3d(ax1 - tick, dimY - tick, 0), point3d(ax1 + tick, dimY + tick, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(ax2 - tick, dimY - tick, 0), point3d(ax2 + tick, dimY + tick, 0), { layerName: 'DIM' });
        dimBlock.addMText(point3d(midX, midY, 0), 16, fmtDimVal(spanMm), {
          layerName: 'DIM',
          attachmentPoint: MTextAttachmentPoint.MiddleCenter,
          rotation: 0,
          width: 0,
        });

        dxf.addLinearDim(point3d(ax1, anchorY, 0), point3d(ax2, anchorY, 0), {
          layerName: 'DIM',
          blockName,
          definitionPoint: point3d(ax2, dimY, 0),
          middlePoint: point3d(midX, midY, 0),
          angle: 0,
          styleName: 'Standard',
          ActualMeasurement: spanMm,
          text: '',
        });

        trackPt(ax1, dimY);
        trackPt(ax2, midY);
      } else {
        const ay1 = roundCoord(y0 + (h - Math.max(d.start, d.end)));
        const ay2 = roundCoord(y0 + (h - Math.min(d.start, d.end)));
        const spanMm = roundCoord(Math.abs(ay2 - ay1));
        const anchorX = roundCoord(vDir < 0 ? x0 : x0 + w);
        const dimX = roundCoord(anchorX + vDir * dist);
        const midX = roundCoord(dimX + vDir * 13);
        const midY = roundCoord((ay1 + ay2) * 0.5);

        const extStartX = roundCoord(anchorX + vDir * dimExo);
        const extEndX = roundCoord(dimX + vDir * dimExe);
        dimBlock.addLine(point3d(extStartX, ay1, 0), point3d(extEndX, ay1, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(extStartX, ay2, 0), point3d(extEndX, ay2, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(dimX, ay1, 0), point3d(dimX, ay2, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(dimX - tick, ay1 - tick, 0), point3d(dimX + tick, ay1 + tick, 0), { layerName: 'DIM' });
        dimBlock.addLine(point3d(dimX - tick, ay2 - tick, 0), point3d(dimX + tick, ay2 + tick, 0), { layerName: 'DIM' });
        dimBlock.addMText(point3d(midX, midY, 0), 16, fmtDimVal(spanMm), {
          layerName: 'DIM',
          attachmentPoint: MTextAttachmentPoint.MiddleCenter,
          rotation: 90,
          width: 0,
        });

        dxf.addLinearDim(point3d(anchorX, ay1, 0), point3d(anchorX, ay2, 0), {
          layerName: 'DIM',
          blockName,
          definitionPoint: point3d(dimX, ay2, 0),
          middlePoint: point3d(midX, midY, 0),
          angle: 90,
          styleName: 'Standard',
          ActualMeasurement: spanMm,
          text: '',
        });

        trackPt(dimX, ay1);
        trackPt(midX, ay2);
      }
    }
  }

  // Set exact extents, limits, and active VPORT framing so AutoCAD 2021 opens centered on the full sheet!
  dxf.setVariable('$LIMMIN', { 10: roundCoord(extMinX - 50), 20: roundCoord(extMinY - 50) });
  dxf.setVariable('$LIMMAX', { 10: roundCoord(extMaxX + 50), 20: roundCoord(extMaxY + 50) });
  dxf.setVariable('$EXTMIN', { 10: roundCoord(extMinX), 20: roundCoord(extMinY), 30: 0 });
  dxf.setVariable('$EXTMAX', { 10: roundCoord(extMaxX), 20: roundCoord(extMaxY), 30: 0 });

  const viewCx = roundCoord((extMinX + extMaxX) * 0.5);
  const viewCy = roundCoord((extMinY + extMaxY) * 0.5);
  const viewH = roundCoord(Math.max(250, (extMaxY - extMinY) * 1.18));
  dxf.document.activeVPort.viewCenter = [viewCx, viewCy];
  dxf.document.activeVPort.viewHeight = viewH;

  return dxf.stringify();
}
