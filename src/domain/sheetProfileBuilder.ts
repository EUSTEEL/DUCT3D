import * as THREE from 'three';
import type {
  CornerId,
  DuctConfig,
  ResolvedCornerSeam,
  WallId,
} from '../types/duct';
import {
  computeRibLayout,
  getSplitTopologies,
  getWallLength,
  resolveActiveSeams,
} from './ductRules';

import {
  appendPieceIntegralEndFlanges,
  buildAllEndAccessories,
  type BuiltAccessoryMesh,
  type BuiltFaceLabel,
  type ExtendedMaterialZone,
  type Rotation2D,
} from './endConnectionBuilder';

export const MM_TO_M = 0.001;

/**
 * Material group indices inside each sheet-metal BufferGeometry:
 * 0 = Body sheet (Thân tôn)
 * 1 = Female Pittsburgh seam (Mí kép — Red in technical mode)
 * 2 = Male Pittsburgh seam (Mí đơn — Blue in technical mode)
 * 3 = 90° Body bend line (Đường chấn — Green in technical mode)
 * 4 = Welded seam zone (Mí hàn — Amber/Orange in technical mode)
 * 5 = Integral End Flange / Collar (Bích kết nối — Yellow in technical mode)
 */
export type MaterialZone = ExtendedMaterialZone;

interface Vec2 {
  x: number;
  y: number;
}

interface PolyNode {
  x: number;
  y: number;
}

interface PolySegmentMeta {
  zone: MaterialZone;
  isRibWall: boolean;
  ribOutwardNormal?: Vec2;
  wallSpanStart?: number;
  wallSpanEnd?: number;
  wallTotalSpan?: number;
  /** True if segment is the Male +7mm lip whose free tip must be chamfered 45° at z = ±L/2 */
  chamferTipEnd?: 'start' | 'end';
  chamferLengthMm?: number;
}

export interface BuiltWeldBead {
  id: string;
  cornerId: CornerId;
  geometry: THREE.BufferGeometry;
}

export interface BuiltPieceMesh {
  id: string;
  partCode: string; // '1-A', '1-B', '1-C', '1-D'
  name: string;
  walls: WallId[];
  geometry: THREE.BufferGeometry;
  edgesGeometry: THREE.EdgesGeometry;
  offset: [number, number, number]; // meters
  faceLabels: BuiltFaceLabel[];
}

export interface BuiltDuctAssembly {
  pieces: BuiltPieceMesh[];
  weldBeads: BuiltWeldBead[];
  accessories: BuiltAccessoryMesh[];
  boundingSizeM: [number, number, number];
}

// ---------------------------------------------------------------------------
// 2D Wall & Corner Geometry Helpers
// ---------------------------------------------------------------------------

function getCornerInnerPos(corner: CornerId, hw: number, hh: number): Vec2 {
  switch (corner) {
    case 'TL':
      return { x: -hw, y: hh };
    case 'TR':
      return { x: hw, y: hh };
    case 'BR':
      return { x: hw, y: -hh };
    case 'BL':
      return { x: -hw, y: -hh };
  }
}

function getWallOutwardNormal(wall: WallId): Vec2 {
  switch (wall) {
    case 'bottom':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'top':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
  }
}

function getWallCcwTangent(wall: WallId): Vec2 {
  switch (wall) {
    case 'bottom':
      return { x: 1, y: 0 };
    case 'right':
      return { x: 0, y: 1 };
    case 'top':
      return { x: -1, y: 0 };
    case 'left':
      return { x: 0, y: -1 };
  }
}

function getWallCorners(wall: WallId): { start: CornerId; end: CornerId } {
  switch (wall) {
    case 'bottom':
      return { start: 'BL', end: 'BR' };
    case 'right':
      return { start: 'BR', end: 'TR' };
    case 'top':
      return { start: 'TR', end: 'TL' };
    case 'left':
      return { start: 'TL', end: 'BL' };
  }
}

function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale2(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

function sub2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function len2(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function norm2(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-9 ? { x: v.x / l, y: v.y / l } : { x: 1, y: 0 };
}

function dot2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function rotatePoint2(pt: Vec2, origin: Vec2, angleRad: number): Vec2 {
  const dx = pt.x - origin.x;
  const dy = pt.y - origin.y;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: origin.x + dx * c - dy * s,
    y: origin.y + dx * s + dy * c,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Corner Seam Profile Generation in Universal Local Frame (p, q)
// ---------------------------------------------------------------------------

/**
 * Generates seam centerline points (in order FROM duct body OUTWARD toward free sheet edge)
 * for a wall meeting corner `cornerId`.
 *
 * Guarantees strictly positive clearance `gap` between all adjacent sheet layers across
 * thicknesses 0.58–1.5 mm (zero overlapping triangles / zero z-fighting).
 */
function buildSeamProfileFromBody(
  seam: ResolvedCornerSeam,
  wall: WallId,
  hw: number,
  hh: number,
  t: number,
  seamLockProgress: number, // 0 = Chưa gò mí, 1 = Đã gò mí
  L: number
): { points: PolyNode[]; segMetas: PolySegmentMeta[] } {
  const cornerInner = getCornerInnerPos(seam.cornerId, hw, hh);
  const { start } = getWallCorners(wall);
  const ccwT = getWallCcwTangent(wall);
  // Vector along THIS wall pointing TOWARD the seam corner
  const toCorner: Vec2 = start === seam.cornerId ? scale2(ccwT, -1) : ccwT;
  const outward: Vec2 = getWallOutwardNormal(wall);

  const gap = Math.max(0.24, t * 0.28);
  const isFemale = seam.femaleWall === wall;

  // Map local (p, q) -> XY where:
  // If Female: +p = outward from THIS wall, +q = toCorner (outward from mating wall)
  // If Male:   +p = toCorner (outward from mating wall), +q = outward from THIS wall
  const toXY = (p: number, q: number): Vec2 => {
    if (isFemale) {
      return add2(cornerInner, add2(scale2(outward, p), scale2(toCorner, q)));
    }
    return add2(cornerInner, add2(scale2(toCorner, p), scale2(outward, q)));
  };

  if (seam.seamType === 'pittsburgh') {
    if (isFemale) {
      // Mí kép Pittsburgh (+31 mm real U-pocket on OUTSIDE of Female wall)
      const qFold1 = -gap - 0.5 * t;
      const pInnerLeg = 1.5 * t + gap;
      const pocketDepth = 9.0;
      const qBottom = qFold1 - pocketDepth;
      const pOuterLeg = 3.5 * t + 3 * gap;
      const qHammer = 1.5 * t + gap;
      const hammerLen = 8.5;
      const alpha = (Math.PI / 2) * seamLockProgress; // 0 = upright, PI/2 = locked 90° flat over Male

      // Include a tiny lead-in point along the wall so Female red zone starts cleanly at the fold
      const pts: PolyNode[] = [
        toXY(0.5 * t, qFold1 - 2.0),
        toXY(0.5 * t, qFold1),
        toXY(pInnerLeg, qFold1),
        toXY(pInnerLeg, qBottom),
        toXY(pOuterLeg, qBottom),
        toXY(pOuterLeg, qHammer),
        toXY(pOuterLeg - hammerLen * Math.sin(alpha), qHammer + hammerLen * Math.cos(alpha)),
      ];

      const segMetas: PolySegmentMeta[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        segMetas.push({
          zone: 1, // Female Pittsburgh (Red)
          isRibWall: false,
        });
      }
      return { points: pts, segMetas };
    } else {
      // Mí đơn Pittsburgh (+7 mm, bent 90° inward toward duct interior, 45° end chamfers)
      const pMaleLip = 2.5 * t + 2 * gap;
      const maleLipLen = 7.0;
      const chamferLen = Math.min(7.0, L * 0.4);

      const pts: PolyNode[] = [
        toXY(-1.5, 0.5 * t), // Lead-in point on Male wall so Male blue highlight covers the lip corner cleanly
        toXY(pMaleLip, 0.5 * t),
        toXY(pMaleLip, 0.5 * t - maleLipLen),
      ];

      const segMetas: PolySegmentMeta[] = [
        { zone: 2, isRibWall: false },
        {
          zone: 2, // Male Pittsburgh (Blue)
          isRibWall: false,
          chamferTipEnd: 'end',
          chamferLengthMm: chamferLen,
        },
      ];
      return { points: pts, segMetas };
    }
  }

  if (seam.seamType === 'weld_overlap') {
    const lapW = Math.max(7, Math.min(25, seam.weldOverlapWidth));
    if (isFemale) {
      // Overlap flap extends past corner onto the outside of the mating wall by lapW mm
      const qLap = 1.5 * t + gap;
      const pts: PolyNode[] = [
        toXY(0.5 * t, -2.0),
        toXY(0.5 * t, qLap),
        toXY(0.5 * t - lapW, qLap),
      ];
      const segMetas: PolySegmentMeta[] = [
        { zone: 4, isRibWall: false },
        { zone: 4, isRibWall: false },
      ];
      return { points: pts, segMetas };
    } else {
      // Mating edge stops cleanly `gap` shy of Female inner face (0 mm extra allowance)
      const pts: PolyNode[] = [
        toXY(-4.0, 0.5 * t),
        toXY(-gap, 0.5 * t),
      ];
      const segMetas: PolySegmentMeta[] = [{ zone: 4, isRibWall: false }];
      return { points: pts, segMetas };
    }
  }

  // weld_butt (Hàn đấu đầu 0–0)
  if (isFemale) {
    const pts: PolyNode[] = [
      toXY(0.5 * t, -3.5),
      toXY(0.5 * t, t), // Flush with outer corner
    ];
    return { points: pts, segMetas: [{ zone: 4, isRibWall: false }] };
  } else {
    const pts: PolyNode[] = [
      toXY(-3.5, 0.5 * t),
      toXY(-gap, 0.5 * t), // Stops cleanly shy of Female inner face
    ];
    return { points: pts, segMetas: [{ zone: 4, isRibWall: false }] };
  }
}

// ---------------------------------------------------------------------------
// Wall Span Subdivider (for smooth embossed stiffener ribs)
// ---------------------------------------------------------------------------

function appendSubdividedWall(
  nodes: PolyNode[],
  metas: PolySegmentMeta[],
  startPt: Vec2,
  endPt: Vec2,
  wall: WallId,
  wallTotalSpan: number,
  wallOrigin: Vec2,
  hasRibs: boolean
): void {
  const dir = sub2(endPt, startPt);
  const segLen = len2(dir);
  if (segLen < 0.5) return;

  const outward = getWallOutwardNormal(wall);
  const ccwT = getWallCcwTangent(wall);
  // Span coordinates relative to the full wall's start corner (0 .. wallTotalSpan)
  const span0 = dot2(sub2(startPt, wallOrigin), ccwT);
  const span1 = dot2(sub2(endPt, wallOrigin), ccwT);

  if (!hasRibs) {
    nodes.push(endPt);
    metas.push({
      zone: 0,
      isRibWall: false,
      ribOutwardNormal: outward,
      wallSpanStart: span0,
      wallSpanEnd: span1,
      wallTotalSpan,
    });
    return;
  }

  // Subdivide along wall span so the rib smoothly fades to 0 near bends/seams
  const margin = Math.min(26, wallTotalSpan * 0.12);
  const ramp = Math.min(18, wallTotalSpan * 0.08);
  const breaks = [
    span0,
    Math.max(span0, Math.min(span1, margin)),
    Math.max(span0, Math.min(span1, margin + ramp * 0.5)),
    Math.max(span0, Math.min(span1, margin + ramp)),
    Math.max(span0, Math.min(span1, wallTotalSpan - margin - ramp)),
    Math.max(span0, Math.min(span1, wallTotalSpan - margin - ramp * 0.5)),
    Math.max(span0, Math.min(span1, wallTotalSpan - margin)),
    span1,
  ];

  // Deduplicate sorted breakpoints
  const uniqueBreaks: number[] = [];
  for (const b of breaks) {
    if (uniqueBreaks.length === 0 || b - uniqueBreaks[uniqueBreaks.length - 1] > 0.5) {
      uniqueBreaks.push(b);
    }
  }
  if (uniqueBreaks.length < 2) {
    uniqueBreaks.push(span1);
  }

  for (let i = 0; i < uniqueBreaks.length - 1; i++) {
    const sA = uniqueBreaks[i];
    const sB = uniqueBreaks[i + 1];
    const fracB = (sB - span0) / Math.max(1e-6, span1 - span0);
    const ptB = {
      x: startPt.x + dir.x * fracB,
      y: startPt.y + dir.y * fracB,
    };
    nodes.push(ptB);
    metas.push({
      zone: 0,
      isRibWall: true,
      ribOutwardNormal: outward,
      wallSpanStart: sA,
      wallSpanEnd: sB,
      wallTotalSpan,
    });
  }
}

// ---------------------------------------------------------------------------
// Assemble Full Piece Polyline (Start Seam -> Walls & 90° Bends -> End Seam)
// ---------------------------------------------------------------------------

interface PiecePolyline {
  nodes: PolyNode[];
  metas: PolySegmentMeta[];
  wallRotations: Partial<Record<WallId, Rotation2D[]>>;
}

function buildPiecePolyline(
  walls: WallId[],
  startCorner: CornerId,
  endCorner: CornerId,
  seamMap: Map<CornerId, ResolvedCornerSeam>,
  W: number,
  H: number,
  L: number,
  t: number,
  seamLockProgress: number,
  hasRibs: boolean,
  unfoldRatio: number, // Only > 0 for 1-piece duct unfolding
  isSinglePiece: boolean
): PiecePolyline {
  const hw = W / 2;
  const hh = H / 2;

  const startSeam = seamMap.get(startCorner)!;
  const endSeam = seamMap.get(endCorner)!;

  // Build start seam (goes FROM body TO free tip -> reverse it so polyline runs FROM free tip TO body)
  const startSeamRaw = buildSeamProfileFromBody(
    startSeam,
    walls[0],
    hw,
    hh,
    t,
    seamLockProgress,
    L
  );
  const startNodes = [...startSeamRaw.points].reverse();
  const startMetas: PolySegmentMeta[] = [...startSeamRaw.segMetas].reverse().map((m) => ({
    ...m,
    chamferTipEnd: m.chamferTipEnd === 'end' ? 'start' : m.chamferTipEnd,
  }));

  // Build end seam (goes FROM body TO free tip -> keep forward order)
  const endSeamRaw = buildSeamProfileFromBody(
    endSeam,
    walls[walls.length - 1],
    hw,
    hh,
    t,
    seamLockProgress,
    L
  );

  const nodes: PolyNode[] = [...startNodes];
  const metas: PolySegmentMeta[] = [...startMetas];

  // Track where each wall's centerline starts and ends, and where internal 90° bends sit
  const bendCornerIndices: { nodeIdx: number; corner: CornerId }[] = [];

  for (let wIdx = 0; wIdx < walls.length; wIdx++) {
    const wall = walls[wIdx];
    const wallLen = getWallLength(wall, W, H);
    const outward = getWallOutwardNormal(wall);
    const ccwT = getWallCcwTangent(wall);
    const { start: cStart, end: cEnd } = getWallCorners(wall);

    const wallInnerStart = getCornerInnerPos(cStart, hw, hh);
    const wallCenterStart = add2(wallInnerStart, scale2(outward, 0.5 * t));
    const wallInnerEnd = getCornerInnerPos(cEnd, hw, hh);
    const wallCenterEnd = add2(wallInnerEnd, scale2(outward, 0.5 * t));

    const bendMargin = Math.min(4.8, wallLen * 0.09);

    // Determine exact body segment start point on this wall
    let segStart: Vec2;
    if (wIdx === 0) {
      // Connects smoothly from last node of startSeam
      segStart = nodes[nodes.length - 1];
    } else {
      // Comes right out of the 90° bend corner at wallCenterStart
      const afterBend = add2(wallCenterStart, scale2(ccwT, bendMargin));
      nodes.push(afterBend);
      metas.push({ zone: 3, isRibWall: false }); // Green bend highlight
      segStart = afterBend;
    }

    // Determine exact body segment end point on this wall
    let segEnd: Vec2;
    if (wIdx === walls.length - 1) {
      segEnd = endSeamRaw.points[0];
    } else {
      segEnd = add2(wallCenterEnd, scale2(ccwT, -bendMargin));
    }

    // Append flat body wall (subdivided if stiffener ribs are enabled)
    appendSubdividedWall(
      nodes,
      metas,
      segStart,
      segEnd,
      wall,
      wallLen,
      wallCenterStart,
      hasRibs
    );

    // If there is another wall after this one, add the 90° bend corner vertex
    if (wIdx < walls.length - 1) {
      const cornerVertex = add2(
        wallCenterEnd,
        scale2(getWallOutwardNormal(walls[wIdx + 1]), 0.5 * t)
      );
      nodes.push(cornerVertex);
      metas.push({ zone: 3, isRibWall: false }); // Green bend highlight
      bendCornerIndices.push({ nodeIdx: nodes.length - 1, corner: cEnd });
    }
  }

  // Append remaining points of end seam (skipping point 0 which equals segEnd)
  for (let i = 1; i < endSeamRaw.points.length; i++) {
    nodes.push(endSeamRaw.points[i]);
    metas.push(endSeamRaw.segMetas[i - 1]);
  }

  // -------------------------------------------------------------------------
  // Special kinematics for 1-piece duct (O-duct):
  // 1) In "Chưa gò mí" (seamLockProgress < 1), gently spring open ONLY the wall
  //    carrying the Male edge so its +7 mm lip rises cleanly out of the open U-pocket!
  // 2) When "Tách mảnh" (unfoldRatio > 0), smoothly open the 3 body bends outward
  //    around the fixed Bottom wall so the trainee sees how the 1-piece sheet folds!
  // -------------------------------------------------------------------------
  const wallRotations: Partial<Record<WallId, Rotation2D[]>> = {};
  const addWallRot = (wall: WallId, pivot: Vec2, angle: number) => {
    if (!wallRotations[wall]) wallRotations[wall] = [];
    wallRotations[wall]!.push({ pivot, angle });
  };

  if (isSinglePiece && bendCornerIndices.length === 3) {
    // Walls order: ['top', 'left', 'bottom', 'right']
    // bendCornerIndices: [0: TL, 1: BL, 2: BR]
    const tlIdx = bendCornerIndices[0].nodeIdx;
    const blIdx = bendCornerIndices[1].nodeIdx;
    const brIdx = bendCornerIndices[2].nodeIdx;

    const unseamed = 1 - seamLockProgress;

    // 1) Gentle spring-open for Chưa gò mí (only on the Male side of TR)
    if (unseamed > 1e-4 && unfoldRatio < 0.01) {
      const trSeam = seamMap.get('TR')!;
      const liftMm = trSeam.seamType === 'pittsburgh' ? 13.5 : 8.5;
      if (trSeam.maleWall === 'right') {
        // Rotate 'right' wall (nodes > brIdx) clockwise (-angle) around BR outward (+X)
        const angle = -Math.asin(Math.min(0.25, liftMm / Math.max(80, H))) * unseamed;
        const pivot = { ...nodes[brIdx] };
        addWallRot('right', pivot, angle);
        for (let i = brIdx + 1; i < nodes.length; i++) {
          nodes[i] = rotatePoint2(nodes[i], pivot, angle);
        }
        for (let i = brIdx; i < metas.length; i++) {
          if (metas[i].ribOutwardNormal) {
            const n = metas[i].ribOutwardNormal!;
            metas[i].ribOutwardNormal = rotatePoint2(n, { x: 0, y: 0 }, angle);
          }
        }
      } else {
        // Male wall is 'top' (nodes < tlIdx) -> rotate CCW (+angle) around TL outward (+Y)
        const angle = Math.asin(Math.min(0.25, liftMm / Math.max(80, W))) * unseamed;
        const pivot = { ...nodes[tlIdx] };
        addWallRot('top', pivot, angle);
        for (let i = 0; i < tlIdx; i++) {
          nodes[i] = rotatePoint2(nodes[i], pivot, angle);
        }
        for (let i = 0; i < tlIdx; i++) {
          if (metas[i].ribOutwardNormal) {
            const n = metas[i].ribOutwardNormal!;
            metas[i].ribOutwardNormal = rotatePoint2(n, { x: 0, y: 0 }, angle);
          }
        }
      }
    }

    // 2) Smooth unfolding when explode > 0 on 1-piece duct (bottom stays anchored!)
    if (unfoldRatio > 1e-4) {
      const maxOpenRad = (24 * Math.PI) / 180; // Open each bend by up to 24°
      const delta = maxOpenRad * unfoldRatio;

      // First open Top around TL (CCW +delta)
      const tlPivot = { ...nodes[tlIdx] };
      addWallRot('top', tlPivot, delta);
      for (let i = 0; i < tlIdx; i++) {
        nodes[i] = rotatePoint2(nodes[i], tlPivot, delta);
      }
      for (let i = 0; i < tlIdx; i++) {
        if (metas[i].ribOutwardNormal) {
          metas[i].ribOutwardNormal = rotatePoint2(metas[i].ribOutwardNormal!, { x: 0, y: 0 }, delta);
        }
      }

      // Then open Left + Top together around BL (CCW +delta)
      const blPivot = { ...nodes[blIdx] };
      addWallRot('top', blPivot, delta);
      addWallRot('left', blPivot, delta);
      for (let i = 0; i < blIdx; i++) {
        nodes[i] = rotatePoint2(nodes[i], blPivot, delta);
      }
      for (let i = 0; i < blIdx; i++) {
        if (metas[i].ribOutwardNormal) {
          metas[i].ribOutwardNormal = rotatePoint2(metas[i].ribOutwardNormal!, { x: 0, y: 0 }, delta);
        }
      }

      // Open Right around BR (CW -delta)
      const brPivot = { ...nodes[brIdx] };
      addWallRot('right', brPivot, -delta);
      for (let i = brIdx + 1; i < nodes.length; i++) {
        nodes[i] = rotatePoint2(nodes[i], brPivot, -delta);
      }
      for (let i = brIdx; i < metas.length; i++) {
        if (metas[i].ribOutwardNormal) {
          metas[i].ribOutwardNormal = rotatePoint2(metas[i].ribOutwardNormal!, { x: 0, y: 0 }, -delta);
        }
      }
    }
  }

  return { nodes, metas, wallRotations };
}

// ---------------------------------------------------------------------------
// Thick-Walled 3D Extruder with Embossed Ribs, 45° Male Chamfers & Material Groups
// ---------------------------------------------------------------------------

interface ZoneTriangleBuffers {
  positions: number[];
  uvs: number[];
}

function pushTri(
  buf: ZoneTriangleBuffers,
  ax: number,
  ay: number,
  az: number,
  au: number,
  av: number,
  bx: number,
  by: number,
  bz: number,
  bu: number,
  bv: number,
  cx: number,
  cy: number,
  cz: number,
  cu: number,
  cv: number
): void {
  buf.positions.push(
    ax * MM_TO_M,
    ay * MM_TO_M,
    az * MM_TO_M,
    bx * MM_TO_M,
    by * MM_TO_M,
    bz * MM_TO_M,
    cx * MM_TO_M,
    cy * MM_TO_M,
    cz * MM_TO_M
  );
  buf.uvs.push(au, av, bu, bv, cu, cv);
}

function pushQuad(
  buf: ZoneTriangleBuffers,
  ax: number,
  ay: number,
  az: number,
  au: number,
  av: number,
  bx: number,
  by: number,
  bz: number,
  bu: number,
  bv: number,
  cx: number,
  cy: number,
  cz: number,
  cu: number,
  cv: number,
  dx: number,
  dy: number,
  dz: number,
  du: number,
  dv: number
): void {
  // Quad (A, B, C, D) -> (A, B, C) & (A, C, D)
  pushTri(buf, ax, ay, az, au, av, bx, by, bz, bu, bv, cx, cy, cz, cu, cv);
  pushTri(buf, ax, ay, az, au, av, cx, cy, cz, cu, cv, dx, dy, dz, du, dv);
}

/**
 * Evaluates straight rib displacement profile along Z (perpendicular to duct length L).
 * Returns height in [0, ribHeightMm].
 */
function evalRibZProfile(zMm: number, ribZPositions: number[], ribHeightMm: number): number {
  const halfBase = 7.0; // 14 mm total bead width
  const halfTop = 2.0; // 4 mm flat/crisp crest
  let h = 0;
  for (let i = 0; i < ribZPositions.length; i++) {
    const dist = Math.abs(zMm - ribZPositions[i]);
    if (dist < halfBase) {
      if (dist <= halfTop) {
        h = Math.max(h, ribHeightMm);
      } else {
        const u = 1 - (dist - halfTop) / (halfBase - halfTop);
        h = Math.max(h, ribHeightMm * u);
      }
    }
  }
  return h;
}

/**
 * Evaluates rib fade-out envelope along a flat wall span so corners & seams stay 100% flat.
 */
function evalRibSpanFade(spanMm: number, totalSpanMm: number): number {
  const margin = Math.min(26, totalSpanMm * 0.12);
  const ramp = Math.min(18, totalSpanMm * 0.08);
  const fadeStart = smoothstep(margin, margin + ramp, spanMm);
  const fadeEnd = smoothstep(margin, margin + ramp, totalSpanMm - spanMm);
  return fadeStart * fadeEnd;
}

/**
 * Extrudes a 2D centerline polyline into a watertight solid BufferGeometry of thickness `t`
 * with exact outward-facing normals, world-scale UVs, material groups, straight ribs, and 45° end chamfers.
 */
function extrudeSheetPolyline(
  poly: PiecePolyline,
  walls: WallId[],
  config: DuctConfig,
  seamLockProgress: number,
  ribZPositions: number[]
): THREE.BufferGeometry {
  const { L, thickness: t } = config;
  const { nodes, metas } = poly;
  const nNodes = nodes.length;
  const nSegs = nNodes - 1;
  const halfT = t * 0.5;
  const halfL = L * 0.5;

  // 1. Compute segment tangents, left normals (+N = inward), and cumulative UV arc length
  const segT: Vec2[] = [];
  const segN: Vec2[] = [];
  const cumArc: number[] = [0];

  for (let i = 0; i < nSegs; i++) {
    const d = sub2(nodes[i + 1], nodes[i]);
    const l = len2(d);
    const T = norm2(d);
    segT.push(T);
    segN.push({ x: -T.y, y: T.x }); // +90° CCW = Left / Inward
    cumArc.push(cumArc[i] + l);
  }

  // 2. Compute exact miter offsets at every node for Left (+halfT) and Right (-halfT) faces
  const leftPts: Vec2[] = [];
  const rightPts: Vec2[] = [];

  for (let i = 0; i < nNodes; i++) {
    let miter: Vec2;
    if (i === 0) {
      miter = scale2(segN[0], halfT);
    } else if (i === nNodes - 1) {
      miter = scale2(segN[nSegs - 1], halfT);
    } else {
      const nPrev = segN[i - 1];
      const nNext = segN[i];
      const bisector = add2(nPrev, nNext);
      const denom = dot2(bisector, nPrev);
      if (Math.abs(denom) < 0.15) {
        miter = scale2(nPrev, halfT);
      } else {
        const s = Math.min(halfT * 2.5, halfT / denom);
        miter = scale2(bisector, s);
      }
    }
    leftPts.push(add2(nodes[i], miter));
    rightPts.push(sub2(nodes[i], miter));
  }

  // 3. Build Z slices: include end caps, Male 45° chamfer planes, and stiffener rib profiles
  const zSet = new Set<number>([-halfL, halfL]);
  const chamferMax = Math.min(7.0, L * 0.4);
  if (chamferMax > 0.5) {
    zSet.add(-halfL + chamferMax);
    zSet.add(halfL - chamferMax);
  }

  const ribHeightMm = 2.8; // Crisp 2.8 mm outward bead
  for (const rz of ribZPositions) {
    for (const dz of [-7.0, -2.0, 2.0, 7.0]) {
      const z = rz + dz;
      if (z > -halfL + 1 && z < halfL - 1) {
        zSet.add(z);
      }
    }
  }
  const zSlices = Array.from(zSet).sort((a, b) => a - b);

  // UV scale: 1.0 UV = 280 mm so mini-spangle crystal scale stays realistic at all duct sizes
  const uvScale = 1 / 280;

  // Separate triangle buffers per MaterialZone (0..5)
  const zoneBuffers: Record<MaterialZone, ZoneTriangleBuffers> = {
    0: { positions: [], uvs: [] },
    1: { positions: [], uvs: [] },
    2: { positions: [], uvs: [] },
    3: { positions: [], uvs: [] },
    4: { positions: [], uvs: [] },
    5: { positions: [], uvs: [] },
  };

  // Helper to evaluate node XY at a given Z (applying outward stiffener rib displacement ONLY on flat rib walls)
  const getDisplacedPoint = (
    basePt: Vec2,
    segMeta: PolySegmentMeta,
    spanAtNode: number,
    zMm: number
  ): Vec2 => {
    if (
      !segMeta.isRibWall ||
      ribZPositions.length === 0 ||
      !segMeta.ribOutwardNormal ||
      segMeta.wallTotalSpan === undefined
    ) {
      return basePt;
    }
    const hz = evalRibZProfile(zMm, ribZPositions, ribHeightMm);
    if (hz <= 1e-5) return basePt;
    const fade = evalRibSpanFade(spanAtNode, segMeta.wallTotalSpan);
    if (fade <= 1e-5) return basePt;
    const disp = hz * fade;
    return {
      x: basePt.x + segMeta.ribOutwardNormal.x * disp,
      y: basePt.y + segMeta.ribOutwardNormal.y * disp,
    };
  };

  // 4. Emit Left (+N), Right (-N), Front (+Z), and Back (-Z) faces for every segment
  for (let i = 0; i < nSegs; i++) {
    const meta = metas[i];
    const buf = zoneBuffers[meta.zone];
    const LaBase = leftPts[i];
    const LbBase = leftPts[i + 1];
    const RaBase = rightPts[i];
    const RbBase = rightPts[i + 1];
    const uA = cumArc[i] * uvScale;
    const uB = cumArc[i + 1] * uvScale;
    const spanA = meta.wallSpanStart ?? 0;
    const spanB = meta.wallSpanEnd ?? 0;

    // Special exact handling for Male +7 mm lip with true 45° end chamfers
    if (meta.chamferTipEnd && meta.chamferLengthMm && meta.chamferLengthMm > 0.5) {
      const c = meta.chamferLengthMm;
      const zBackC = -halfL + c;
      const zFrontC = halfL - c;

      // Determine which end of segment i is the root (length L) vs free tip (length L - 2c)
      const tipIsEnd = meta.chamferTipEnd === 'end';
      const Lroot = tipIsEnd ? LaBase : LbBase;
      const Rroot = tipIsEnd ? RaBase : RbBase;
      const Ltip = tipIsEnd ? LbBase : LaBase;
      const Rtip = tipIsEnd ? RbBase : RaBase;
      const uRoot = tipIsEnd ? uA : uB;
      const uTip = tipIsEnd ? uB : uA;

      // Middle slices strictly between zBackC and zFrontC (inclusive)
      const midSlices = zSlices.filter((z) => z >= zBackC - 1e-4 && z <= zFrontC + 1e-4);

      // Emit middle quads (full height 7 mm)
      for (let k = 0; k < midSlices.length - 1; k++) {
        const z0 = midSlices[k];
        const z1 = midSlices[k + 1];
        const v0 = (z0 + halfL) * uvScale;
        const v1 = (z1 + halfL) * uvScale;

        // Left (+N) face: (La(z0), La(z1), Lb(z1), Lb(z0))
        pushQuad(
          buf,
          LaBase.x, LaBase.y, z0, uA, v0,
          LaBase.x, LaBase.y, z1, uA, v1,
          LbBase.x, LbBase.y, z1, uB, v1,
          LbBase.x, LbBase.y, z0, uB, v0
        );
        // Right (-N) face: (Ra(z0), Rb(z0), Rb(z1), Ra(z1))
        pushQuad(
          buf,
          RaBase.x, RaBase.y, z0, uA, v0,
          RbBase.x, RbBase.y, z0, uB, v0,
          RbBase.x, RbBase.y, z1, uB, v1,
          RaBase.x, RaBase.y, z1, uA, v1
        );
      }

      // Emit Back 45° chamfer triangles & 45° beveled end-cap (between -halfL and zBackC)
      const vBack0 = 0;
      const vBack1 = c * uvScale;
      if (tipIsEnd) {
        // a = root, b = tip
        // Left (+N) triangle: (La(-halfL), La(zBackC), Lb(zBackC)) -> (+Z) x (+T) = +N
        pushTri(
          buf,
          Lroot.x, Lroot.y, -halfL, uRoot, vBack0,
          Lroot.x, Lroot.y, zBackC, uRoot, vBack1,
          Ltip.x, Ltip.y, zBackC, uTip, vBack1
        );
        // Right (-N) triangle: (Ra(-halfL), Rb(zBackC), Ra(zBackC)) -> -N
        pushTri(
          buf,
          Rroot.x, Rroot.y, -halfL, uRoot, vBack0,
          Rtip.x, Rtip.y, zBackC, uTip, vBack1,
          Rroot.x, Rroot.y, zBackC, uRoot, vBack1
        );
        // Back 45° bevel cap (outward normal points (-Z, +T)):
        // (Rroot(-halfL), Lroot(-halfL), Ltip(zBackC), Rtip(zBackC))
        pushQuad(
          buf,
          Rroot.x, Rroot.y, -halfL, uRoot, vBack0,
          Lroot.x, Lroot.y, -halfL, uRoot, vBack0,
          Ltip.x, Ltip.y, zBackC, uTip, vBack1,
          Rtip.x, Rtip.y, zBackC, uTip, vBack1
        );
      } else {
        // a = tip, b = root
        // Left (+N) triangle: (Lb(-halfL), La(zBackC), Lb(zBackC)) -> verify:
        // (La(zBackC) - Lb(-halfL)) x (Lb(zBackC) - Lb(-halfL)) = (-T + Z) x (+Z) = (-T) x Z = +N!
        pushTri(
          buf,
          Lroot.x, Lroot.y, -halfL, uRoot, vBack0,
          Ltip.x, Ltip.y, zBackC, uTip, vBack1,
          Lroot.x, Lroot.y, zBackC, uRoot, vBack1
        );
        // Right (-N) triangle: reverse
        pushTri(
          buf,
          Rroot.x, Rroot.y, -halfL, uRoot, vBack0,
          Rroot.x, Rroot.y, zBackC, uRoot, vBack1,
          Rtip.x, Rtip.y, zBackC, uTip, vBack1
        );
        // Back 45° bevel cap (outward normal points (-Z, -T)):
        // (Rtip(zBackC), Ltip(zBackC), Lroot(-halfL), Rroot(-halfL))
        pushQuad(
          buf,
          Rtip.x, Rtip.y, zBackC, uTip, vBack1,
          Ltip.x, Ltip.y, zBackC, uTip, vBack1,
          Lroot.x, Lroot.y, -halfL, uRoot, vBack0,
          Rroot.x, Rroot.y, -halfL, uRoot, vBack0
        );
      }

      // Emit Front 45° chamfer triangles & 45° beveled end-cap (between zFrontC and +halfL)
      const vFront0 = (L - c) * uvScale;
      const vFront1 = L * uvScale;
      if (tipIsEnd) {
        // a = root, b = tip
        // Left (+N): (Lroot(zFrontC), Lroot(+halfL), Ltip(zFrontC)) -> (+Z) x (+T) = +N
        pushTri(
          buf,
          Lroot.x, Lroot.y, zFrontC, uRoot, vFront0,
          Lroot.x, Lroot.y, halfL, uRoot, vFront1,
          Ltip.x, Ltip.y, zFrontC, uTip, vFront0
        );
        // Right (-N): reverse
        pushTri(
          buf,
          Rroot.x, Rroot.y, zFrontC, uRoot, vFront0,
          Rtip.x, Rtip.y, zFrontC, uTip, vFront0,
          Rroot.x, Rroot.y, halfL, uRoot, vFront1
        );
        // Front 45° bevel cap (outward normal points (+Z, +T)):
        // (Rroot(+halfL), Rtip(zFrontC), Ltip(zFrontC), Lroot(+halfL))
        pushQuad(
          buf,
          Rroot.x, Rroot.y, halfL, uRoot, vFront1,
          Rtip.x, Rtip.y, zFrontC, uTip, vFront0,
          Ltip.x, Ltip.y, zFrontC, uTip, vFront0,
          Lroot.x, Lroot.y, halfL, uRoot, vFront1
        );
      } else {
        // a = tip, b = root
        // Left (+N): (Lroot(zFrontC), Ltip(zFrontC), Lroot(+halfL)) -> (-T) x (+Z) = +N
        pushTri(
          buf,
          Lroot.x, Lroot.y, zFrontC, uRoot, vFront0,
          Ltip.x, Ltip.y, zFrontC, uTip, vFront0,
          Lroot.x, Lroot.y, halfL, uRoot, vFront1
        );
        // Right (-N): reverse
        pushTri(
          buf,
          Rroot.x, Rroot.y, zFrontC, uRoot, vFront0,
          Rroot.x, Rroot.y, halfL, uRoot, vFront1,
          Rtip.x, Rtip.y, zFrontC, uTip, vFront0
        );
        // Front 45° bevel cap (outward normal points (+Z, -T)):
        // (Rtip(zFrontC), Rroot(+halfL), Lroot(+halfL), Ltip(zFrontC))
        pushQuad(
          buf,
          Rtip.x, Rtip.y, zFrontC, uTip, vFront0,
          Rroot.x, Rroot.y, halfL, uRoot, vFront1,
          Lroot.x, Lroot.y, halfL, uRoot, vFront1,
          Ltip.x, Ltip.y, zFrontC, uTip, vFront0
        );
      }

      // Emit free-edge tip cap ONLY along [zBackC, zFrontC]
      if (tipIsEnd && i === nSegs - 1) {
        // End Edge Cap (+T normal): (Rtip(z0), Rtip(z1), Ltip(z1), Ltip(z0))?
        // Verify: (R(z1)-R(z0)) x (L(z1)-R(z0)) = (+Z) x (+N) = -T! So reverse for +T:
        // (Rtip(z0), Ltip(z0), Ltip(z1), Rtip(z1)) -> (+N) x (+Z) = +T!
        for (let k = 0; k < midSlices.length - 1; k++) {
          const z0 = midSlices[k];
          const z1 = midSlices[k + 1];
          pushQuad(
            buf,
            Rtip.x, Rtip.y, z0, 0, (z0 + halfL) * uvScale,
            Ltip.x, Ltip.y, z0, t * uvScale, (z0 + halfL) * uvScale,
            Ltip.x, Ltip.y, z1, t * uvScale, (z1 + halfL) * uvScale,
            Rtip.x, Rtip.y, z1, 0, (z1 + halfL) * uvScale
          );
        }
      } else if (!tipIsEnd && i === 0) {
        // Start Edge Cap (-T normal): (Rtip(z0), Rtip(z1), Ltip(z1), Ltip(z0)) -> (+Z) x (+N) = -T!
        for (let k = 0; k < midSlices.length - 1; k++) {
          const z0 = midSlices[k];
          const z1 = midSlices[k + 1];
          pushQuad(
            buf,
            Rtip.x, Rtip.y, z0, 0, (z0 + halfL) * uvScale,
            Rtip.x, Rtip.y, z1, 0, (z1 + halfL) * uvScale,
            Ltip.x, Ltip.y, z1, t * uvScale, (z1 + halfL) * uvScale,
            Ltip.x, Ltip.y, z0, t * uvScale, (z0 + halfL) * uvScale
          );
        }
      }

      continue;
    }

    // Standard full-length segment (with optional embossed straight ribs along Z)
    for (let k = 0; k < zSlices.length - 1; k++) {
      const z0 = zSlices[k];
      const z1 = zSlices[k + 1];
      const v0 = (z0 + halfL) * uvScale;
      const v1 = (z1 + halfL) * uvScale;

      const La0 = getDisplacedPoint(LaBase, meta, spanA, z0);
      const La1 = getDisplacedPoint(LaBase, meta, spanA, z1);
      const Lb0 = getDisplacedPoint(LbBase, meta, spanB, z0);
      const Lb1 = getDisplacedPoint(LbBase, meta, spanB, z1);

      const Ra0 = getDisplacedPoint(RaBase, meta, spanA, z0);
      const Ra1 = getDisplacedPoint(RaBase, meta, spanA, z1);
      const Rb0 = getDisplacedPoint(RbBase, meta, spanB, z0);
      const Rb1 = getDisplacedPoint(RbBase, meta, spanB, z1);

      // Left (+N) face
      pushQuad(
        buf,
        La0.x, La0.y, z0, uA, v0,
        La1.x, La1.y, z1, uA, v1,
        Lb1.x, Lb1.y, z1, uB, v1,
        Lb0.x, Lb0.y, z0, uB, v0
      );

      // Right (-N) face
      pushQuad(
        buf,
        Ra0.x, Ra0.y, z0, uA, v0,
        Rb0.x, Rb0.y, z0, uB, v0,
        Rb1.x, Rb1.y, z1, uB, v1,
        Ra1.x, Ra1.y, z1, uA, v1
      );
    }

    // Front End-Cap (+Z normal): (Ra, Rb, Lb, La)
    pushQuad(
      buf,
      RaBase.x, RaBase.y, halfL, uA, 0,
      RbBase.x, RbBase.y, halfL, uB, 0,
      LbBase.x, LbBase.y, halfL, uB, t * uvScale,
      LaBase.x, LaBase.y, halfL, uA, t * uvScale
    );

    // Back End-Cap (-Z normal): (Ra, La, Lb, Rb)
    pushQuad(
      buf,
      RaBase.x, RaBase.y, -halfL, uA, 0,
      LaBase.x, LaBase.y, -halfL, uA, t * uvScale,
      LbBase.x, LbBase.y, -halfL, uB, t * uvScale,
      RbBase.x, RbBase.y, -halfL, uB, 0
    );
  }

  // 5. Emit Start & End Edge Caps for non-chamfered free edges
  if (!metas[0].chamferTipEnd) {
    const buf = zoneBuffers[metas[0].zone];
    const R0 = rightPts[0];
    const L0 = leftPts[0];
    for (let k = 0; k < zSlices.length - 1; k++) {
      const z0 = zSlices[k];
      const z1 = zSlices[k + 1];
      pushQuad(
        buf,
        R0.x, R0.y, z0, 0, (z0 + halfL) * uvScale,
        R0.x, R0.y, z1, 0, (z1 + halfL) * uvScale,
        L0.x, L0.y, z1, t * uvScale, (z1 + halfL) * uvScale,
        L0.x, L0.y, z0, t * uvScale, (z0 + halfL) * uvScale
      );
    }
  }

  if (!metas[nSegs - 1].chamferTipEnd) {
    const buf = zoneBuffers[metas[nSegs - 1].zone];
    const RN = rightPts[nNodes - 1];
    const LN = leftPts[nNodes - 1];
    for (let k = 0; k < zSlices.length - 1; k++) {
      const z0 = zSlices[k];
      const z1 = zSlices[k + 1];
      pushQuad(
        buf,
        RN.x, RN.y, z0, 0, (z0 + halfL) * uvScale,
        LN.x, LN.y, z0, t * uvScale, (z0 + halfL) * uvScale,
        LN.x, LN.y, z1, t * uvScale, (z1 + halfL) * uvScale,
        RN.x, RN.y, z1, 0, (z1 + halfL) * uvScale
      );
    }
  }

  // 5b. Append integral end flanges (C1 & C2) for this piece's walls
  appendPieceIntegralEndFlanges(zoneBuffers, walls, poly.wallRotations, config, seamLockProgress);

  // 6. Merge all MaterialZone buffers into one clean non-indexed BufferGeometry with groups
  const totalPositions: number[] = [];
  const totalUvs: number[] = [];
  const geometry = new THREE.BufferGeometry();

  let vertexOffset = 0;
  const zones: MaterialZone[] = [0, 1, 2, 3, 4, 5];
  for (const zone of zones) {
    const zb = zoneBuffers[zone];
    const count = zb.positions.length / 3;
    if (count > 0) {
      for (let j = 0; j < zb.positions.length; j++) {
        totalPositions.push(zb.positions[j]);
      }
      for (let j = 0; j < zb.uvs.length; j++) {
        totalUvs.push(zb.uvs[j]);
      }
      geometry.addGroup(vertexOffset, count, zone);
      vertexOffset += count;
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(totalPositions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(totalUvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

// ---------------------------------------------------------------------------
// Subtle 3D Weld Bead Geometry for Closed/Welded Seams
// ---------------------------------------------------------------------------

function buildWeldBeadGeometry(
  seam: ResolvedCornerSeam,
  W: number,
  H: number,
  L: number,
  t: number
): THREE.BufferGeometry | null {
  if (seam.seamType === 'pittsburgh') return null;

  const hw = W / 2;
  const hh = H / 2;
  const gap = Math.max(0.24, t * 0.28);
  const cornerInner = getCornerInnerPos(seam.cornerId, hw, hh);
  const nF = getWallOutwardNormal(seam.femaleWall);
  const nM = getWallOutwardNormal(seam.maleWall);

  const toXY = (p: number, q: number): Vec2 =>
    add2(cornerInner, add2(scale2(nF, p), scale2(nM, q)));

  const radiusMm = Math.max(1.1, t * 1.15);
  let center: Vec2;
  if (seam.seamType === 'weld_overlap') {
    const lapW = Math.max(7, Math.min(25, seam.weldOverlapWidth));
    // Fillet bead sitting neatly at the outer toe of the overlap flap
    center = toXY(0.5 * t - lapW - radiusMm * 0.45, t + gap + radiusMm * 0.45);
  } else {
    // Butt weld corner bead right along the outer 90° corner
    center = toXY(t + radiusMm * 0.15, t + radiusMm * 0.15);
  }

  const geom = new THREE.CylinderGeometry(
    radiusMm * MM_TO_M,
    radiusMm * MM_TO_M,
    (L - 1.5) * MM_TO_M,
    8,
    1
  );
  // Cylinder default axis is Y -> rotate to align with Z axis
  geom.rotateX(Math.PI / 2);
  geom.translate(center.x * MM_TO_M, center.y * MM_TO_M, 0);
  return geom;
}

// ---------------------------------------------------------------------------
// Collision-Free Piece Explode & Unseamed Kinematics
// ---------------------------------------------------------------------------

function computePieceOffsetMm(
  pieceId: string,
  config: DuctConfig,
  seamMap: Map<CornerId, ResolvedCornerSeam>,
  seamLockProgress: number,
  explodeRatio: number
): [number, number, number] {
  const { W, H, splitMode } = config;
  const baseExplode = Math.max(85, Math.min(250, Math.max(W, H) * 0.28));
  const unseamed = 1 - seamLockProgress;

  if (splitMode === '1_piece') {
    return [0, 0, 0];
  }

  if (splitMode === '2_piece_UI') {
    const trSeam = seamMap.get('TR')!;
    const unseamedLift = trSeam.seamType === 'pittsburgh' ? 13.5 : 8.5;
    if (pieceId === 'I') {
      return [0, unseamed * unseamedLift + explodeRatio * baseExplode * 1.1, 0];
    }
    // U-piece shifts gently down when exploded so center stays balanced
    return [0, -explodeRatio * baseExplode * 0.45, 0];
  }

  if (splitMode === '2_piece_L') {
    const trSeam = seamMap.get('TR')!;
    const topIsFemale = trSeam.femaleWall === 'top';
    const unseamedHalf = trSeam.seamType === 'pittsburgh' ? 6.8 : 4.2;

    // Two-stage extraction: slide cleanly out along pocket extraction axis first, then expand diagonally
    const stage1 = unseamed * unseamedHalf + explodeRatio * baseExplode * 0.85;
    const stage2 = Math.max(0, (explodeRatio - 0.1) / 0.9) * baseExplode * 0.65;

    if (topIsFemale) {
      // Pockets open along ±X -> slide L1 (-X), L2 (+X) first, then fan ±Y
      return pieceId === 'L1' ? [-stage1, stage2, 0] : [stage1, -stage2, 0];
    } else {
      // Pockets open along ±Y -> slide L1 (+Y), L2 (-Y) first, then fan ±X
      return pieceId === 'L1' ? [-stage2, stage1, 0] : [stage2, -stage1, 0];
    }
  }

  // 4_piece
  const trSeam = seamMap.get('TR')!;
  const topIsFemale = trSeam.femaleWall === 'top';
  const unseamedShift = trSeam.seamType === 'pittsburgh' ? 13.5 : 8.5;

  const primary = unseamed * unseamedShift + explodeRatio * baseExplode;
  const secondary = Math.max(0, (explodeRatio - 0.08) / 0.92) * baseExplode;

  if (topIsFemale) {
    // Left & Right extract horizontally FIRST out of Top & Bottom pockets
    switch (pieceId) {
      case 'L':
        return [-primary, 0, 0];
      case 'R':
        return [primary, 0, 0];
      case 'T':
        return [0, secondary, 0];
      case 'B':
        return [0, -secondary, 0];
    }
  } else {
    // Top & Bottom extract vertically FIRST out of Left & Right pockets
    switch (pieceId) {
      case 'T':
        return [0, primary, 0];
      case 'B':
        return [0, -primary, 0];
      case 'L':
        return [-secondary, 0, 0];
      case 'R':
        return [secondary, 0, 0];
    }
  }

  return [0, 0, 0];
}

function buildPieceInnerLabels(
  pieceId: string,
  partCode: string,
  walls: WallId[],
  wallRotationsMap: Partial<Record<WallId, Rotation2D[]>>,
  W: number,
  H: number,
  L: number,
  ribZPositions: number[]
): BuiltFaceLabel[] {
  const hw = W / 2;
  const hh = H / 2;
  const insetMm = 0.55; // Strictly inside inner face (lòng trong), zero z-fighting, invisible from exterior

  // Choose flat rib-free Z bay near the front opening so labels are crisp & immediately legible
  let labelZ = 0;
  let baySpanZ = L;
  if (ribZPositions.length > 0) {
    const lastRib = ribZPositions[ribZPositions.length - 1];
    const frontBay = L / 2 - lastRib;
    if (frontBay >= 95) {
      labelZ = lastRib + frontBay * 0.5;
      baySpanZ = frontBay - 24;
    } else if (ribZPositions.length >= 2) {
      const midIdx = Math.floor(ribZPositions.length / 2);
      labelZ = (ribZPositions[midIdx - 1] + ribZPositions[midIdx]) * 0.5;
      baySpanZ = ribZPositions[midIdx] - ribZPositions[midIdx - 1] - 24;
    }
  } else {
    baySpanZ = L - 24;
  }

  return walls.map((wall) => {
    let baseXY: Vec2;
    let baseEuler: THREE.Euler;
    const wallSpan = getWallLength(wall, W, H);
    switch (wall) {
      case 'bottom':
        baseXY = { x: 0, y: -hh + insetMm };
        baseEuler = new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ');
        break;
      case 'top':
        baseXY = { x: 0, y: hh - insetMm };
        baseEuler = new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ');
        break;
      case 'left':
        baseXY = { x: -hw + insetMm, y: 0 };
        baseEuler = new THREE.Euler(0, Math.PI / 2, 0, 'XYZ');
        break;
      case 'right':
        baseXY = { x: hw - insetMm, y: 0 };
        baseEuler = new THREE.Euler(0, -Math.PI / 2, 0, 'XYZ');
        break;
    }

    const rots = wallRotationsMap[wall];
    let ptXY = baseXY;
    let totalRotZ = 0;
    if (rots && rots.length > 0) {
      for (const r of rots) {
        ptXY = rotatePoint2(ptXY, r.pivot, r.angle);
        totalRotZ += r.angle;
      }
    }

    const finalQuat = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), totalRotZ)
      .multiply(new THREE.Quaternion().setFromEuler(baseEuler));
    const finalEuler = new THREE.Euler().setFromQuaternion(finalQuat, 'XYZ');

    // Size label cleanly proportional to available flat wall span & Z bay
    const maxW = Math.min(wall === 'top' || wall === 'bottom' ? wallSpan * 0.42 : baySpanZ * 0.68, 175);
    const maxH = Math.min(wall === 'top' || wall === 'bottom' ? baySpanZ * 0.62 : wallSpan * 0.46, 86);
    const labelW = Math.max(46, Math.min(maxW, maxH * 2.15));
    const labelH = Math.max(24, labelW * 0.46);

    return {
      id: `${pieceId}-lbl-${wall}`,
      partCode,
      pieceId,
      position: [ptXY.x * MM_TO_M, ptXY.y * MM_TO_M, labelZ * MM_TO_M],
      rotation: [finalEuler.x, finalEuler.y, finalEuler.z],
      sizeM: [labelW * MM_TO_M, labelH * MM_TO_M],
    };
  });
}

// ---------------------------------------------------------------------------
// Public Assembly Builder
// ---------------------------------------------------------------------------

/**
 * Builds the complete 3D straight duct assembly for a given config and animated
 * `seamLockProgress` (0 = Chưa gò mí, 1 = Đã gò mí) & `explodeRatio` (0..1).
 */
export function buildDuctAssembly(
  config: DuctConfig,
  seamLockProgress: number,
  explodeRatio: number
): BuiltDuctAssembly {
  const { W, H, L, thickness: t, splitMode, stiffenerRibs } = config;
  const topologies = getSplitTopologies(splitMode);
  const seams = resolveActiveSeams(config);
  const seamMap = new Map<CornerId, ResolvedCornerSeam>(seams.map((s) => [s.cornerId, s]));
  const ribLayout = computeRibLayout(L, stiffenerRibs);
  const isSinglePiece = splitMode === '1_piece';

  const pieces: BuiltPieceMesh[] = topologies.map((topo) => {
    const poly = buildPiecePolyline(
      topo.walls,
      topo.startCorner,
      topo.endCorner,
      seamMap,
      W,
      H,
      L,
      t,
      seamLockProgress,
      ribLayout.count > 0,
      isSinglePiece ? explodeRatio : 0,
      isSinglePiece
    );

    const geometry = extrudeSheetPolyline(
      poly,
      topo.walls,
      config,
      seamLockProgress,
      ribLayout.zPositionsMm
    );
    const edgesGeometry = new THREE.EdgesGeometry(geometry, 22);
    const offsetMm = computePieceOffsetMm(
      topo.id,
      config,
      seamMap,
      seamLockProgress,
      explodeRatio
    );
    const faceLabels = buildPieceInnerLabels(
      topo.id,
      topo.partCode,
      topo.walls,
      poly.wallRotations,
      W,
      H,
      L,
      ribLayout.zPositionsMm
    );

    return {
      id: topo.id,
      partCode: topo.partCode,
      name: topo.name,
      walls: topo.walls,
      geometry,
      edgesGeometry,
      offset: [
        offsetMm[0] * MM_TO_M,
        offsetMm[1] * MM_TO_M,
        offsetMm[2] * MM_TO_M,
      ],
      faceLabels,
    };
  });

  // Render weld beads only when tightly assembled & completed (Đã gò/hàn hoàn thiện)
  const weldBeads: BuiltWeldBead[] = [];
  if (seamLockProgress > 0.85 && explodeRatio < 0.02) {
    for (const seam of seams) {
      if (seam.seamType !== 'pittsburgh') {
        const geom = buildWeldBeadGeometry(seam, W, H, L, t);
        if (geom) {
          weldBeads.push({
            id: `weld-${seam.cornerId}`,
            cornerId: seam.cornerId,
            geometry: geom,
          });
        }
      }
    }
  }

  // Build detached Stage 2 end accessories (ke góc TDC/TDF, bích V/U rời, khung lưới LCCT, mảnh bịt đầu)
  const accessories = buildAllEndAccessories(config, seamLockProgress, explodeRatio);

  return {
    pieces,
    weldBeads,
    accessories,
    boundingSizeM: [W * MM_TO_M, H * MM_TO_M, L * MM_TO_M],
  };
}
