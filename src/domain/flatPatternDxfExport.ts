import type { Dimension2D, FlatPatternDocument, FlatPatternPiece, Point2D } from '../types/flatPattern2d';

/** Fixed uniform spacing (mm) between adjacent cut pieces in exported DXF nesting */
export const DXF_PIECE_GAP_MM = 20;

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

function fmtNum(v: number): string {
  const clean = Math.abs(v) < 1e-6 ? 0 : v;
  return clean.toFixed(4).replace(/\.?0+$/, '') || '0';
}

/**
 * Cleans a closed polygon loop for CNC Laser LWPOLYLINE export:
 * - Removes duplicate consecutive / wrap-around vertices
 * - Removes strictly collinear intermediate vertices along straight segments
 *   so Bodor Thinker / AutoCAD receives clean minimal closed LWPOLYLINE loops
 *   with zero zero-length segments and zero double lines.
 */
function cleanClosedLoop(pts: readonly Point2D[]): Point2D[] {
  const deduped: Point2D[] = [];
  for (const p of pts) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.02) {
      deduped.push({ x: p.x, y: p.y });
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

  // Strip strictly collinear mid-edge vertices (cross product ~ 0 & same forward direction)
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
 * piece sits on an outer perimeter for clean, non-overlapping AutoCAD dimensions.
 */
function layoutPiecesForDxf(pieces: readonly FlatPatternPiece[]): {
  placed: DxfPlacedPiece[];
  cutMaxX: number;
  cutMaxY: number;
} {
  if (pieces.length === 0) {
    return { placed: [], cutMaxX: 100, cutMaxY: 100 };
  }

  // Group into rows (max 2 columns per row; keep End Caps on their own row if body uses 2+ pieces)
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
  let cursorTopY = totalHeight; // Row 0 sits at top (high Y in CAD Y-up space)

  rows.forEach((row, rIdx) => {
    const rH = rowHeights[rIdx];
    const rowBottomY = cursorTopY - rH;
    let cursorX = 0;
    row.forEach((piece, cIdx) => {
      // Align piece vertically centered within its row or bottom-aligned; bottom-aligned keeps clean row baseline
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

class DxfWriter {
  private lines: string[] = [];
  private nextHandle = 0x10;

  allocHandle(): string {
    const h = this.nextHandle.toString(16).toUpperCase();
    this.nextHandle += 1;
    return h;
  }

  peekNextHandle(): string {
    return this.nextHandle.toString(16).toUpperCase();
  }

  pair(code: number, value: string | number): void {
    this.lines.push(String(code), String(value));
  }

  pt(xCode: number, yCode: number, x: number, y: number, zCode?: number, z = 0): void {
    this.pair(xCode, fmtNum(x));
    this.pair(yCode, fmtNum(y));
    if (zCode !== undefined) {
      this.pair(zCode, fmtNum(z));
    }
  }

  toString(): string {
    return `${this.lines.join('\r\n')}\r\n`;
  }
}

/**
 * Generates an AutoCAD R2000 (AC1015) & Bodor Thinker 3.0 compliant ASCII DXF string:
 * - Absolute 1:1 mm scale ($INSUNITS = 4, $MEASUREMENT = 1), CAD Y-up coordinate system.
 * - Strictly 2 layers ONLY:
 *   1. `CUT`: Closed `LWPOLYLINE` outer contours (+ optional inner cutouts) spaced uniformly 20 mm apart.
 *   2. `DIM`: Native DXF `DIMENSION` entities (linear code 70=32, DIMSTYLE STANDARD) for overall blank size
 *             and primary edge segments — ZERO fake LINE/TEXT entities.
 * - Excludes 100% of bend lines, 210 mm ribs, 1200/1250 mm sheet guides, callouts, and 1-A/1-B inner labels.
 */
export function buildExportableDxfString(doc: FlatPatternDocument): string {
  const { placed, cutMaxX, cutMaxY } = layoutPiecesForDxf(doc.pieces);

  // Pre-build entity descriptors so we know exact overall extents and final $HANDSEED before emitting HEADER
  interface CutLoopEntity {
    vertices: Point2D[];
  }
  interface NativeDimEntity {
    axis: 'horizontal' | 'vertical';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    defX: number;
    defY: number;
    midX: number;
    midY: number;
  }

  const cutLoops: CutLoopEntity[] = [];
  const dimEntities: NativeDimEntity[] = [];

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

  for (const item of placed) {
    const { piece, x0, y0, row, col, rowCount } = item;
    const h = piece.heightMm;
    const w = piece.widthMm;

    // Map SVG piece-local (x, y down) -> CAD world (x right, y up)
    const toCad = (p: Point2D): Point2D => ({
      x: x0 + p.x,
      y: y0 + (h - p.y),
    });

    const outerLoop = cleanClosedLoop(piece.cutPolygon.map(toCad));
    if (outerLoop.length >= 3) {
      cutLoops.push({ vertices: outerLoop });
      outerLoop.forEach((p) => trackPt(p.x, p.y));
    }

    if (piece.innerHoles) {
      for (const hole of piece.innerHoles) {
        const cleanHole = cleanClosedLoop(hole.map(toCad));
        if (cleanHole.length >= 3) {
          cutLoops.push({ vertices: cleanHole });
          cleanHole.forEach((p) => trackPt(p.x, p.y));
        }
      }
    }

    // Native DXF DIMENSION entities on Layer DIM (total & primary segment dims only — NO rib/detail dims)
    const primaryDims: Dimension2D[] = piece.dimensions.filter(
      (d) => (d.tier === 'total' || d.tier === 'segment') && Math.abs(d.end - d.start) >= 0.5
    );

    // Place horizontal dims above row 0, or below bottom row when multi-row;
    // place vertical dims left of col 0, or right of col 1 so zero dims cross neighboring cut pieces.
    const hDir = rowCount > 1 && row === rowCount - 1 ? -1 : 1;
    const vDir = col === 0 ? -1 : 1;

    for (const d of primaryDims) {
      const dist = d.tier === 'total' ? 92 : 44;
      if (d.axis === 'horizontal') {
        const ax1 = x0 + Math.min(d.start, d.end);
        const ax2 = x0 + Math.max(d.start, d.end);
        const anchorY = hDir > 0 ? y0 + h : y0;
        const dimY = anchorY + hDir * dist;
        const midX = (ax1 + ax2) * 0.5;
        const midY = dimY + hDir * 12;
        dimEntities.push({
          axis: 'horizontal',
          x1: ax1,
          y1: anchorY,
          x2: ax2,
          y2: anchorY,
          defX: ax2,
          defY: dimY,
          midX,
          midY,
        });
        trackPt(ax1, dimY);
        trackPt(ax2, midY);
      } else {
        // Flip SVG Y span [d.start, d.end] into ascending CAD Y span
        const ay1 = y0 + (h - Math.max(d.start, d.end));
        const ay2 = y0 + (h - Math.min(d.start, d.end));
        const anchorX = vDir < 0 ? x0 : x0 + w;
        const dimX = anchorX + vDir * dist;
        const midX = dimX + vDir * 12;
        const midY = (ay1 + ay2) * 0.5;
        dimEntities.push({
          axis: 'vertical',
          x1: anchorX,
          y1: ay1,
          x2: anchorX,
          y2: ay2,
          defX: dimX,
          defY: ay2,
          midX,
          midY,
        });
        trackPt(dimX, ay1);
        trackPt(midX, ay2);
      }
    }
  }

  // Build body sections first using a temporary writer so we get exact $HANDSEED for HEADER
  const body = new DxfWriter();

  // Reserve fixed structural table & object handles
  const hVportTable = body.allocHandle();
  const hVportActive = body.allocHandle();
  const hLtypeTable = body.allocHandle();
  const hLtypeByBlock = body.allocHandle();
  const hLtypeByLayer = body.allocHandle();
  const hLtypeCont = body.allocHandle();
  const hLayerTable = body.allocHandle();
  const hLayerCut = body.allocHandle();
  const hLayerDim = body.allocHandle();
  const hStyleTable = body.allocHandle();
  const hStyleStandard = body.allocHandle();
  const hViewTable = body.allocHandle();
  const hUcsTable = body.allocHandle();
  const hAppIdTable = body.allocHandle();
  const hAppIdAcad = body.allocHandle();
  const hDimStyleTable = body.allocHandle();
  const hDimStyleStandard = body.allocHandle();
  const hBlockRecTable = body.allocHandle();
  const hModelBlockRec = body.allocHandle();
  const hPaperBlockRec = body.allocHandle();
  const hModelBlock = body.allocHandle();
  const hModelEndBlk = body.allocHandle();
  const hPaperBlock = body.allocHandle();
  const hPaperEndBlk = body.allocHandle();
  const hRootDict = body.allocHandle();
  const hAcadGroupDict = body.allocHandle();

  const viewCx = (extMinX + extMaxX) * 0.5;
  const viewCy = (extMinY + extMaxY) * 0.5;
  const viewH = Math.max(200, (extMaxY - extMinY) * 1.15);
  const viewAspect = Math.max(0.5, (extMaxX - extMinX) / Math.max(1, extMaxY - extMinY));

  // ---------- TABLES SECTION ----------
  body.pair(0, 'SECTION');
  body.pair(2, 'TABLES');

  // VPORT
  body.pair(0, 'TABLE');
  body.pair(2, 'VPORT');
  body.pair(5, hVportTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 1);
  body.pair(0, 'VPORT');
  body.pair(5, hVportActive);
  body.pair(330, hVportTable);
  body.pair(100, 'AcDbSymbolTableRecord');
  body.pair(100, 'AcDbViewportTableRecord');
  body.pair(2, '*Active');
  body.pair(70, 0);
  body.pt(10, 20, 0, 0);
  body.pt(11, 21, 1, 1);
  body.pt(12, 22, viewCx, viewCy);
  body.pt(13, 23, 0, 0);
  body.pt(14, 24, 10, 10);
  body.pt(15, 25, 10, 10);
  body.pt(16, 26, 0, 0, 36, 1);
  body.pt(17, 27, 0, 0, 37, 0);
  body.pair(40, fmtNum(viewH));
  body.pair(41, fmtNum(viewAspect));
  body.pair(42, 50);
  body.pair(43, 0);
  body.pair(44, 0);
  body.pair(50, 0);
  body.pair(51, 0);
  body.pair(71, 0);
  body.pair(72, 100);
  body.pair(73, 1);
  body.pair(74, 3);
  body.pair(75, 0);
  body.pair(76, 0);
  body.pair(77, 0);
  body.pair(78, 0);
  body.pair(0, 'ENDTAB');

  // LTYPE
  body.pair(0, 'TABLE');
  body.pair(2, 'LTYPE');
  body.pair(5, hLtypeTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 3);
  for (const [hLt, name, desc] of [
    [hLtypeByBlock, 'ByBlock', ''],
    [hLtypeByLayer, 'ByLayer', ''],
    [hLtypeCont, 'CONTINUOUS', 'Solid line'],
  ] as const) {
    body.pair(0, 'LTYPE');
    body.pair(5, hLt);
    body.pair(330, hLtypeTable);
    body.pair(100, 'AcDbSymbolTableRecord');
    body.pair(100, 'AcDbLinetypeTableRecord');
    body.pair(2, name);
    body.pair(70, 0);
    body.pair(3, desc);
    body.pair(72, 65);
    body.pair(73, 0);
    body.pair(40, 0);
  }
  body.pair(0, 'ENDTAB');

  // LAYER — STRICTLY 2 LAYERS ONLY: CUT & DIM
  body.pair(0, 'TABLE');
  body.pair(2, 'LAYER');
  body.pair(5, hLayerTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 2);

  // Layer 1: CUT (ACI 7 White/Black, continuous, printable)
  body.pair(0, 'LAYER');
  body.pair(5, hLayerCut);
  body.pair(330, hLayerTable);
  body.pair(100, 'AcDbSymbolTableRecord');
  body.pair(100, 'AcDbLayerTableRecord');
  body.pair(2, 'CUT');
  body.pair(70, 0);
  body.pair(62, 7);
  body.pair(6, 'CONTINUOUS');
  body.pair(290, 1);
  body.pair(370, 25);

  // Layer 2: DIM (ACI 3 Green, continuous, native DIMENSION entities only)
  body.pair(0, 'LAYER');
  body.pair(5, hLayerDim);
  body.pair(330, hLayerTable);
  body.pair(100, 'AcDbSymbolTableRecord');
  body.pair(100, 'AcDbLayerTableRecord');
  body.pair(2, 'DIM');
  body.pair(70, 0);
  body.pair(62, 3);
  body.pair(6, 'CONTINUOUS');
  body.pair(290, 1);
  body.pair(370, 15);
  body.pair(0, 'ENDTAB');

  // STYLE (STANDARD)
  body.pair(0, 'TABLE');
  body.pair(2, 'STYLE');
  body.pair(5, hStyleTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 1);
  body.pair(0, 'STYLE');
  body.pair(5, hStyleStandard);
  body.pair(330, hStyleTable);
  body.pair(100, 'AcDbSymbolTableRecord');
  body.pair(100, 'AcDbTextStyleTableRecord');
  body.pair(2, 'STANDARD');
  body.pair(70, 0);
  body.pair(40, 0);
  body.pair(41, 1);
  body.pair(50, 0);
  body.pair(71, 0);
  body.pair(42, 16);
  body.pair(3, 'txt');
  body.pair(4, '');
  body.pair(0, 'ENDTAB');

  // VIEW (empty)
  body.pair(0, 'TABLE');
  body.pair(2, 'VIEW');
  body.pair(5, hViewTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 0);
  body.pair(0, 'ENDTAB');

  // UCS (empty)
  body.pair(0, 'TABLE');
  body.pair(2, 'UCS');
  body.pair(5, hUcsTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 0);
  body.pair(0, 'ENDTAB');

  // APPID (ACAD)
  body.pair(0, 'TABLE');
  body.pair(2, 'APPID');
  body.pair(5, hAppIdTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 1);
  body.pair(0, 'APPID');
  body.pair(5, hAppIdAcad);
  body.pair(330, hAppIdTable);
  body.pair(100, 'AcDbSymbolTableRecord');
  body.pair(100, 'AcDbRegAppTableRecord');
  body.pair(2, 'ACAD');
  body.pair(70, 0);
  body.pair(0, 'ENDTAB');

  // DIMSTYLE (STANDARD — note handle uses group code 105 per AC1015 spec!)
  body.pair(0, 'TABLE');
  body.pair(2, 'DIMSTYLE');
  body.pair(5, hDimStyleTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 1);
  body.pair(100, 'AcDbDimStyleTable');
  body.pair(71, 1);
  body.pair(0, 'DIMSTYLE');
  body.pair(105, hDimStyleStandard);
  body.pair(330, hDimStyleTable);
  body.pair(100, 'AcDbSymbolTableRecord');
  body.pair(100, 'AcDbDimStyleTableRecord');
  body.pair(2, 'STANDARD');
  body.pair(70, 0);
  body.pair(40, 1); // DIMSCALE
  body.pair(41, 8); // DIMASZ (arrow size mm)
  body.pair(42, 4); // DIMEXO (extension offset)
  body.pair(43, 12); // DIMDLI
  body.pair(44, 6); // DIMEXE (extension beyond dim line)
  body.pair(73, 0); // DIMTIH
  body.pair(74, 0); // DIMTOH
  body.pair(77, 1); // DIMTAD (text above dim line)
  body.pair(78, 8); // DIMZIN (suppress trailing zeros)
  body.pair(140, 16); // DIMTXT (text height mm)
  body.pair(147, 4); // DIMGAP
  body.pair(172, 1); // DIMTOFL
  body.pair(271, 1); // DIMDEC (up to 1 decimal, e.g., 12.5)
  body.pair(275, 0); // DIMAUNIT
  body.pair(280, 0); // DIMJUST
  body.pair(340, hStyleStandard); // DIMTXSTY -> STANDARD
  body.pair(0, 'ENDTAB');

  // BLOCK_RECORD
  body.pair(0, 'TABLE');
  body.pair(2, 'BLOCK_RECORD');
  body.pair(5, hBlockRecTable);
  body.pair(330, '0');
  body.pair(100, 'AcDbSymbolTable');
  body.pair(70, 2);
  for (const [hBr, name] of [
    [hModelBlockRec, '*Model_Space'],
    [hPaperBlockRec, '*Paper_Space'],
  ] as const) {
    body.pair(0, 'BLOCK_RECORD');
    body.pair(5, hBr);
    body.pair(330, hBlockRecTable);
    body.pair(100, 'AcDbSymbolTableRecord');
    body.pair(100, 'AcDbBlockTableRecord');
    body.pair(2, name);
  }
  body.pair(0, 'ENDTAB');

  body.pair(0, 'ENDSEC');

  // ---------- BLOCKS SECTION ----------
  body.pair(0, 'SECTION');
  body.pair(2, 'BLOCKS');
  for (const [hBr, hBlk, hEnd, name] of [
    [hModelBlockRec, hModelBlock, hModelEndBlk, '*Model_Space'],
    [hPaperBlockRec, hPaperBlock, hPaperEndBlk, '*Paper_Space'],
  ] as const) {
    body.pair(0, 'BLOCK');
    body.pair(5, hBlk);
    body.pair(330, hBr);
    body.pair(100, 'AcDbEntity');
    body.pair(8, 'CUT');
    body.pair(100, 'AcDbBlockBegin');
    body.pair(2, name);
    body.pair(70, 0);
    body.pt(10, 20, 0, 0, 30, 0);
    body.pair(3, name);
    body.pair(1, '');
    body.pair(0, 'ENDBLK');
    body.pair(5, hEnd);
    body.pair(330, hBr);
    body.pair(100, 'AcDbEntity');
    body.pair(8, 'CUT');
    body.pair(100, 'AcDbBlockEnd');
  }
  body.pair(0, 'ENDSEC');

  // ---------- ENTITIES SECTION ----------
  body.pair(0, 'SECTION');
  body.pair(2, 'ENTITIES');

  // 1. Layer CUT: Closed LWPOLYLINE loops only (outer piece perimeters + optional inner cutouts)
  for (const loop of cutLoops) {
    body.pair(0, 'LWPOLYLINE');
    body.pair(5, body.allocHandle());
    body.pair(330, hModelBlockRec);
    body.pair(100, 'AcDbEntity');
    body.pair(8, 'CUT');
    body.pair(100, 'AcDbPolyline');
    body.pair(90, loop.vertices.length);
    body.pair(70, 1); // Bit 1 = Closed polyline (watertight)
    body.pair(43, 0); // Constant width 0
    for (const v of loop.vertices) {
      body.pt(10, 20, v.x, v.y);
    }
  }

  // 2. Layer DIM: Native DXF linear DIMENSION entities (70 = 32, DIMSTYLE STANDARD) ONLY
  for (const dm of dimEntities) {
    body.pair(0, 'DIMENSION');
    body.pair(5, body.allocHandle());
    body.pair(330, hModelBlockRec);
    body.pair(100, 'AcDbEntity');
    body.pair(8, 'DIM');
    body.pair(100, 'AcDbDimension');
    body.pt(10, 20, dm.defX, dm.defY, 30, 0);
    body.pt(11, 21, dm.midX, dm.midY, 31, 0);
    body.pair(70, 32); // Linear/Rotated dimension (0) + exclusive block flag (32)
    body.pair(71, 5); // Middle-center text attachment
    body.pair(1, ''); // AutoCAD computes exact mm measurement automatically
    body.pair(3, 'STANDARD');
    body.pair(100, 'AcDbAlignedDimension');
    body.pt(13, 23, dm.x1, dm.y1, 33, 0);
    body.pt(14, 24, dm.x2, dm.y2, 34, 0);
    body.pair(50, dm.axis === 'horizontal' ? 0 : 90);
    body.pair(100, 'AcDbRotatedDimension');
  }

  body.pair(0, 'ENDSEC');

  // ---------- OBJECTS SECTION ----------
  body.pair(0, 'SECTION');
  body.pair(2, 'OBJECTS');
  body.pair(0, 'DICTIONARY');
  body.pair(5, hRootDict);
  body.pair(330, '0');
  body.pair(100, 'AcDbDictionary');
  body.pair(281, 1);
  body.pair(3, 'ACAD_GROUP');
  body.pair(350, hAcadGroupDict);

  body.pair(0, 'DICTIONARY');
  body.pair(5, hAcadGroupDict);
  body.pair(330, hRootDict);
  body.pair(100, 'AcDbDictionary');
  body.pair(281, 1);
  body.pair(0, 'ENDSEC');

  body.pair(0, 'EOF');

  // ---------- HEADER SECTION (with exact final $HANDSEED & $INSUNITS = 4) ----------
  const header = new DxfWriter();
  header.pair(0, 'SECTION');
  header.pair(2, 'HEADER');
  header.pair(9, '$ACADVER');
  header.pair(1, 'AC1015');
  header.pair(9, '$DWGCODEPAGE');
  header.pair(3, 'ANSI_1252');
  header.pair(9, '$INSUNITS');
  header.pair(70, 4); // Millimeters (1:1 mm)
  header.pair(9, '$MEASUREMENT');
  header.pair(70, 1); // Metric
  header.pair(9, '$CLAYER');
  header.pair(8, 'CUT');
  header.pair(9, '$DIMSTYLE');
  header.pair(2, 'STANDARD');
  header.pair(9, '$DIMSCALE');
  header.pair(40, 1);
  header.pair(9, '$DIMTXT');
  header.pair(40, 16);
  header.pair(9, '$DIMASZ');
  header.pair(40, 8);
  header.pair(9, '$DIMEXE');
  header.pair(40, 6);
  header.pair(9, '$DIMEXO');
  header.pair(40, 4);
  header.pair(9, '$DIMGAP');
  header.pair(40, 4);
  header.pair(9, '$DIMDEC');
  header.pair(70, 1);
  header.pair(9, '$DIMZIN');
  header.pair(70, 8);
  header.pair(9, '$DIMTAD');
  header.pair(70, 1);
  header.pair(9, '$LIMMIN');
  header.pt(10, 20, extMinX - 50, extMinY - 50);
  header.pair(9, '$LIMMAX');
  header.pt(10, 20, extMaxX + 50, extMaxY + 50);
  header.pair(9, '$EXTMIN');
  header.pt(10, 20, extMinX, extMinY, 30, 0);
  header.pair(9, '$EXTMAX');
  header.pt(10, 20, extMaxX, extMaxY, 30, 0);
  header.pair(9, '$HANDSEED');
  header.pair(5, body.peekNextHandle());
  header.pair(0, 'ENDSEC');

  return header.toString() + body.toString();
}
