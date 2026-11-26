import * as THREE from 'three';
import type {
  DuctConfig,
  EndConnectionConfig,
  WallId,
} from '../types/duct';
import {
  BICH_U_OUTER_LIP_MM,
  bichVHasTurnedLip,
  getBichVDimensions,
  getEndCapEdgeSeam,
} from './endConnectionRules';
import { computeRibLayout, getEndCapPartCode, getWallLength } from './ductRules';

export const MM_TO_M = 0.001;

/**
 * MaterialZone indices (shared across body & integral flanges):
 * 0 = Body sheet (Thân tôn)
 * 1 = Female Pittsburgh seam (Mí kép — Red)
 * 2 = Male Pittsburgh seam (Mí đơn — Blue)
 * 3 = 90° Body bend line (Đường chấn — Green)
 * 4 = Welded seam zone (Mí hàn — Orange)
 * 5 = Integral End Flange / Collar (Bích kết nối — Yellow in technical mode)
 */
export type ExtendedMaterialZone = 0 | 1 | 2 | 3 | 4 | 5;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rotation2D {
  pivot: Vec2;
  angle: number;
}

export interface BuiltFaceLabel {
  id: string;
  partCode: string; // '1-A', '1-B', ..., '1-E', '1-F'
  pieceId: string;
  position: [number, number, number]; // meters in parent local frame
  rotation: [number, number, number]; // Euler XYZ
  sizeM: [number, number]; // widthM, heightM
}

export type AccessoryKind = 'bracket' | 'structural_flange' | 'lcct_frame' | 'lcct_mesh' | 'end_cap';

export interface AccessoryKinematics {
  endSign: 1 | -1;
  /** Radial direction for corner brackets [sx, sy] */
  radialDir: [number, number];
  /** Radial shift (mm) at 100% explode */
  explodeRadialMm: number;
  /** Axial shift (mm) at 100% explode */
  explodeAxialMm: number;
  /** Extra axial shift (mm) when Chưa gò mí (unseamed) */
  unseamedAxialMm: number;
  /** Radial shift (mm) during 0->30% 3D unfold retraction */
  unfoldRadialMm: number;
  /** Axial shift (mm) during 0->30% 3D unfold retraction */
  unfoldAxialMm: number;
}

export interface BuiltAccessoryMesh {
  id: string;
  kind: AccessoryKind;
  partCode?: string; // Set for selectable End Cap panels ('1-B', '1-E', '1-F'...)
  endKey?: 'c1' | 'c2';
  geometry: THREE.BufferGeometry;
  edgesGeometry: THREE.EdgesGeometry | null;
  offset: [number, number, number]; // meters
  faceLabels?: BuiltFaceLabel[];
  kinematics?: AccessoryKinematics;
}

interface ZoneBuf {
  positions: number[];
  uvs: number[];
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

function getWallMidInner(wall: WallId, hw: number, hh: number): Vec2 {
  switch (wall) {
    case 'bottom':
      return { x: 0, y: -hh };
    case 'right':
      return { x: hw, y: 0 };
    case 'top':
      return { x: 0, y: hh };
    case 'left':
      return { x: -hw, y: 0 };
  }
}

/** Returns neighboring walls at local xStart (-xDir) and xEnd (+xDir) of `wall` for end `endSign` */
function getAdjacentWallsAtLocalEnds(
  wall: WallId,
  endSign: 1 | -1
): { atStart: WallId; atEnd: WallId } {
  // CCW order: bottom -> right -> top -> left
  const order: WallId[] = ['bottom', 'right', 'top', 'left'];
  const idx = order.indexOf(wall);
  const prevCcw = order[(idx + 3) % 4];
  const nextCcw = order[(idx + 1) % 4];
  // xDir = endSign * ccw, so at xStart (-xDir) is prevCcw if endSign=+1 else nextCcw
  return endSign === 1
    ? { atStart: prevCcw, atEnd: nextCcw }
    : { atStart: nextCcw, atEnd: prevCcw };
}

function rotatePt2(pt: Vec2, pivot: Vec2, angle: number): Vec2 {
  const dx = pt.x - pivot.x;
  const dy = pt.y - pivot.y;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: pivot.x + dx * c - dy * s,
    y: pivot.y + dx * s + dy * c,
  };
}

function applyRotations2D(pt: Vec2, rotations?: Rotation2D[]): Vec2 {
  if (!rotations || rotations.length === 0) return pt;
  let cur = pt;
  for (let i = 0; i < rotations.length; i++) {
    cur = rotatePt2(cur, rotations[i].pivot, rotations[i].angle);
  }
  return cur;
}

function pushTri(
  buf: ZoneBuf,
  a: [number, number, number],
  auv: [number, number],
  b: [number, number, number],
  buv: [number, number],
  c: [number, number, number],
  cuv: [number, number]
): void {
  buf.positions.push(
    a[0] * MM_TO_M, a[1] * MM_TO_M, a[2] * MM_TO_M,
    b[0] * MM_TO_M, b[1] * MM_TO_M, b[2] * MM_TO_M,
    c[0] * MM_TO_M, c[1] * MM_TO_M, c[2] * MM_TO_M
  );
  buf.uvs.push(auv[0], auv[1], buv[0], buv[1], cuv[0], cuv[1]);
}

function pushQuad(
  buf: ZoneBuf,
  a: [number, number, number],
  auv: [number, number],
  b: [number, number, number],
  buv: [number, number],
  c: [number, number, number],
  cuv: [number, number],
  d: [number, number, number],
  duv: [number, number]
): void {
  pushTri(buf, a, auv, b, buv, c, cuv);
  pushTri(buf, a, auv, c, cuv, d, duv);
}

function buildGeometryFromZones(
  zoneBuffers: Record<ExtendedMaterialZone, ZoneBuf>
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const geom = new THREE.BufferGeometry();
  let offset = 0;
  const zones: ExtendedMaterialZone[] = [0, 1, 2, 3, 4, 5];
  for (const z of zones) {
    const zb = zoneBuffers[z];
    const count = zb.positions.length / 3;
    if (count > 0) {
      for (let i = 0; i < zb.positions.length; i++) positions.push(zb.positions[i]);
      for (let i = 0; i < zb.uvs.length; i++) uvs.push(zb.uvs[i]);
      geom.addGroup(offset, count, z);
      offset += count;
    }
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

// ---------------------------------------------------------------------------
// Universal Right-Handed Thick Profile Sweeper for Wall End Flanges
// ---------------------------------------------------------------------------

interface ProfilePt2 {
  r: number; // radial outward from wall inner face (mm)
  dz: number; // axial outward from duct end plane (mm)
  /** Optional subtle indent offset applied ONLY when showCornerIndent is active on TDC/TDF */
  indentDr?: number;
}

/**
 * Sweeps a 2D open centerline polyline `(r, dz)` of thickness `t` along a wall span
 * in strictly right-handed local coordinates `(X_loc, Y_loc = outward, Z_loc = endSign * Z)`.
 *
 * Supports:
 * - Selective 45° inward corner miters per end (`miterStart45`, `miterEnd45`)
 * - Optional tiny corner identification dimple (`cornerIndent`) near one corner on TDC/TDF
 * - Optional 1-piece duct wall rotations so flanges & plain extensions move solidly during unfolding
 */
function appendWallEndProfile(
  buf: ZoneBuf,
  wall: WallId,
  W: number,
  H: number,
  L: number,
  t: number,
  endSign: 1 | -1,
  profile: ProfilePt2[],
  opts: {
    startTrimMm: number;
    endTrimMm: number;
    miterStart45?: boolean;
    miterEnd45?: boolean;
    cornerIndent?: boolean;
    wallRotations?: Rotation2D[];
  }
): void {
  if (profile.length < 2) return;
  const hw = W / 2;
  const hh = H / 2;
  const wallSpan = getWallLength(wall, W, H);
  const halfSpan = wallSpan / 2;
  const midInner = getWallMidInner(wall, hw, hh);
  const out = getWallOutwardNormal(wall);
  const ccw = getWallCcwTangent(wall);

  // Right-handed basis: Y_loc = out, Z_loc = (0, 0, endSign), X_loc = endSign * ccw
  const xDir: Vec2 = { x: ccw.x * endSign, y: ccw.y * endSign };
  const z0 = endSign * (L / 2);
  const halfT = t * 0.5;
  const uvScale = 1 / 280;

  const toWorld = (xLoc: number, r: number, dz: number): [number, number, number] => {
    const baseXY: Vec2 = {
      x: midInner.x + xDir.x * xLoc + out.x * r,
      y: midInner.y + xDir.y * xLoc + out.y * r,
    };
    const rotXY = applyRotations2D(baseXY, opts.wallRotations);
    return [rotXY.x, rotXY.y, z0 + endSign * dz];
  };

  const nPts = profile.length;
  const nSegs = nPts - 1;
  const segN: { r: number; dz: number }[] = [];
  const cumArc: number[] = [0];

  for (let i = 0; i < nSegs; i++) {
    const dr = profile[i + 1].r - profile[i].r;
    const ddz = profile[i + 1].dz - profile[i].dz;
    const len = Math.hypot(dr, ddz) || 1;
    segN.push({ r: -ddz / len, dz: dr / len });
    cumArc.push(cumArc[i] + len);
  }

  const computeOffsetCurves = (indentFactor: number) => {
    const pPts = profile.map((p) => ({
      r: p.r + (p.indentDr ?? 0) * indentFactor,
      dz: p.dz,
    }));
    const left: { r: number; dz: number }[] = [];
    const right: { r: number; dz: number }[] = [];
    for (let i = 0; i < nPts; i++) {
      let mr: number;
      let mdz: number;
      if (i === 0) {
        mr = segN[0].r * halfT;
        mdz = segN[0].dz * halfT;
      } else if (i === nPts - 1) {
        mr = segN[nSegs - 1].r * halfT;
        mdz = segN[nSegs - 1].dz * halfT;
      } else {
        const nP = segN[i - 1];
        const nX = segN[i];
        const br = nP.r + nX.r;
        const bdz = nP.dz + nX.dz;
        const denom = br * nP.r + bdz * nP.dz;
        if (Math.abs(denom) < 0.15) {
          mr = nP.r * halfT;
          mdz = nP.dz * halfT;
        } else {
          const s = Math.min(halfT * 2.5, halfT / denom);
          mr = br * s;
          mdz = bdz * s;
        }
      }
      left.push({ r: pPts[i].r + mr, dz: pPts[i].dz + mdz });
      right.push({ r: pPts[i].r - mr, dz: pPts[i].dz - mdz });
    }
    return { left, right };
  };

  const baseCurve = computeOffsetCurves(0);
  const indentCurve = opts.cornerIndent ? computeOffsetCurves(1) : baseCurve;

  const xStart = -halfSpan + opts.startTrimMm;
  const xEnd = halfSpan - opts.endTrimMm;
  if (xEnd - xStart < 3.0) return;

  // Optional single tiny corner-adjacent dimple (only on top wall near ONE corner when toggled ON)
  interface XSlice {
    x: number;
    indent: number;
    isStart?: boolean;
    isEnd?: boolean;
  }
  const slices: XSlice[] = [];
  if (opts.cornerIndent && wall === 'top' && xEnd - xStart > 65) {
    // Small dimple (width 6 mm) placed ~16 mm from the right corner edge
    const dimpleCenter = endSign === 1 ? xStart + 18 : xEnd - 18;
    const hwD = 3.0;
    slices.push({ x: xStart, indent: 0, isStart: true });
    slices.push({ x: dimpleCenter - hwD, indent: 0 });
    slices.push({ x: dimpleCenter - hwD * 0.45, indent: 0.78 });
    slices.push({ x: dimpleCenter, indent: 1.0 });
    slices.push({ x: dimpleCenter + hwD * 0.45, indent: 0.78 });
    slices.push({ x: dimpleCenter + hwD, indent: 0 });
    slices.push({ x: xEnd, indent: 0, isEnd: true });
  } else {
    slices.push({ x: xStart, indent: 0, isStart: true });
    slices.push({ x: xEnd, indent: 0, isEnd: true });
  }

  const getSliceCurve = (indent: number) => {
    if (indent <= 1e-4) return baseCurve;
    if (indent >= 0.999) return indentCurve;
    return computeOffsetCurves(indent);
  };

  const getXAtPt = (sl: XSlice, pt: { r: number; dz: number }): number => {
    // For inward flanges (r < 0), 45° corner miter shrinks the inward span by |r|
    if (sl.isStart && opts.miterStart45) {
      return sl.x - pt.r; // since r < 0 -> x moves toward +center by |r|
    }
    if (sl.isEnd && opts.miterEnd45) {
      return sl.x + pt.r; // since r < 0 -> x moves toward -center by |r|
    }
    return sl.x;
  };

  // Emit Left (+N_p) and Right (-N_p) faces
  for (let s = 0; s < slices.length - 1; s++) {
    const slA = slices[s];
    const slB = slices[s + 1];
    const cA = getSliceCurve(slA.indent);
    const cB = getSliceCurve(slB.indent);
    const u0 = (slA.x + halfSpan) * uvScale;
    const u1 = (slB.x + halfSpan) * uvScale;

    for (let i = 0; i < nSegs; i++) {
      const v0 = cumArc[i] * uvScale;
      const v1 = cumArc[i + 1] * uvScale;

      const LA = toWorld(getXAtPt(slA, cA.left[i]), cA.left[i].r, cA.left[i].dz);
      const LB = toWorld(getXAtPt(slA, cA.left[i + 1]), cA.left[i + 1].r, cA.left[i + 1].dz);
      const LC = toWorld(getXAtPt(slB, cB.left[i + 1]), cB.left[i + 1].r, cB.left[i + 1].dz);
      const LD = toWorld(getXAtPt(slB, cB.left[i]), cB.left[i].r, cB.left[i].dz);
      pushQuad(buf, LA, [u0, v0], LB, [u0, v1], LC, [u1, v1], LD, [u1, v0]);

      const RA = toWorld(getXAtPt(slA, cA.right[i]), cA.right[i].r, cA.right[i].dz);
      const RB = toWorld(getXAtPt(slB, cB.right[i]), cB.right[i].r, cB.right[i].dz);
      const RC = toWorld(getXAtPt(slB, cB.right[i + 1]), cB.right[i + 1].r, cB.right[i + 1].dz);
      const RD = toWorld(getXAtPt(slA, cA.right[i + 1]), cA.right[i + 1].r, cA.right[i + 1].dz);
      pushQuad(buf, RA, [u0, v0], RB, [u1, v0], RC, [u1, v1], RD, [u0, v1]);
    }
  }

  // Root & tip thickness caps
  for (let s = 0; s < slices.length - 1; s++) {
    const slA = slices[s];
    const slB = slices[s + 1];
    const cA = getSliceCurve(slA.indent);
    const cB = getSliceCurve(slB.indent);
    const u0 = (slA.x + halfSpan) * uvScale;
    const u1 = (slB.x + halfSpan) * uvScale;

    pushQuad(
      buf,
      toWorld(getXAtPt(slA, cA.right[0]), cA.right[0].r, cA.right[0].dz), [u0, 0],
      toWorld(getXAtPt(slA, cA.left[0]), cA.left[0].r, cA.left[0].dz), [u0, t * uvScale],
      toWorld(getXAtPt(slB, cB.left[0]), cB.left[0].r, cB.left[0].dz), [u1, t * uvScale],
      toWorld(getXAtPt(slB, cB.right[0]), cB.right[0].r, cB.right[0].dz), [u1, 0]
    );

    const last = nPts - 1;
    pushQuad(
      buf,
      toWorld(getXAtPt(slA, cA.left[last]), cA.left[last].r, cA.left[last].dz), [u0, 0],
      toWorld(getXAtPt(slA, cA.right[last]), cA.right[last].r, cA.right[last].dz), [u0, t * uvScale],
      toWorld(getXAtPt(slB, cB.right[last]), cB.right[last].r, cB.right[last].dz), [u1, t * uvScale],
      toWorld(getXAtPt(slB, cB.left[last]), cB.left[last].r, cB.left[last].dz), [u1, 0]
    );
  }

  // Start (-X) & End (+X) thickness caps
  const slFirst = slices[0];
  const slLast = slices[slices.length - 1];
  for (let i = 0; i < nSegs; i++) {
    const v0 = cumArc[i] * uvScale;
    const v1 = cumArc[i + 1] * uvScale;
    pushQuad(
      buf,
      toWorld(getXAtPt(slFirst, baseCurve.right[i]), baseCurve.right[i].r, baseCurve.right[i].dz), [0, v0],
      toWorld(getXAtPt(slFirst, baseCurve.right[i + 1]), baseCurve.right[i + 1].r, baseCurve.right[i + 1].dz), [0, v1],
      toWorld(getXAtPt(slFirst, baseCurve.left[i + 1]), baseCurve.left[i + 1].r, baseCurve.left[i + 1].dz), [t * uvScale, v1],
      toWorld(getXAtPt(slFirst, baseCurve.left[i]), baseCurve.left[i].r, baseCurve.left[i].dz), [t * uvScale, v0]
    );
    pushQuad(
      buf,
      toWorld(getXAtPt(slLast, baseCurve.right[i]), baseCurve.right[i].r, baseCurve.right[i].dz), [0, v0],
      toWorld(getXAtPt(slLast, baseCurve.left[i]), baseCurve.left[i].r, baseCurve.left[i].dz), [t * uvScale, v0],
      toWorld(getXAtPt(slLast, baseCurve.left[i + 1]), baseCurve.left[i + 1].r, baseCurve.left[i + 1].dz), [t * uvScale, v1],
      toWorld(getXAtPt(slLast, baseCurve.right[i + 1]), baseCurve.right[i + 1].r, baseCurve.right[i + 1].dz), [0, v1]
    );
  }
}

// ---------------------------------------------------------------------------
// 1. Integral End Flanges & Straight Extensions Attached to Each Duct Piece
// ---------------------------------------------------------------------------

/**
 * Appends integral end-flange geometry (or seamless straight collar extension) for C1 (+L/2)
 * and C2 (-L/2) directly into a duct piece's zone buffers so they move solidly with each split piece.
 */
export function appendPieceIntegralEndFlanges(
  zoneBuffers: Record<ExtendedMaterialZone, ZoneBuf>,
  walls: WallId[],
  wallRotationsMap: Partial<Record<WallId, Rotation2D[]>>,
  config: DuctConfig,
  seamLockProgress: number
): void {
  const { W, H, L, thickness: t, c1, c2 } = config;
  const gap = Math.max(0.24, t * 0.28);

  const ends: { endSign: 1 | -1; conn: EndConnectionConfig }[] = [
    { endSign: 1, conn: c1 },
    { endSign: -1, conn: c2 },
  ];

  for (const { endSign, conn } of ends) {
    if (conn.type === 'bich_v_in' || conn.type === 'bich_u') continue;

    for (const wall of walls) {
      const rots = wallRotationsMap[wall];

      // 1. Bích TDC/TDF liền thân (+48 mm, cao 32 mm, gập rỗng hình hộp chữ C — KHÔNG khấu V giữa cạnh!)
      if (conn.type === 'tdc_tdf') {
        const profile: ProfilePt2[] = [
          { r: 0.5 * t, dz: 0 },
          { r: 32.0, dz: 0, indentDr: -2.6 },
          { r: 32.0, dz: -9.2, indentDr: -2.6 },
          { r: 23.5, dz: -9.2 },
          { r: 23.5, dz: -6.2 },
        ];
        appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
          startTrimMm: t + gap,
          endTrimMm: t + gap,
          cornerIndent: conn.showEndIndent,
          wallRotations: rots,
        });
      }

      // 2. Nẹp C liền thân (+12.5 mm uốn cong vòng ra ngoài 180° tạo rãnh chữ C rỗng thật, chạy sát 4 góc!)
      else if (conn.type === 'nep_c') {
        const Rc = Math.max(2.4, 1.8 * t + 0.9); // tạo khe hở lòng chữ C rõ nét & không cấn mí kép góc
        const rCenter = 0.5 * t + Rc;
        const arcSteps = 7;
        const profile: ProfilePt2[] = [];
        for (let k = 0; k <= arcSteps; k++) {
          const theta = -Math.PI / 2 + (Math.PI * k) / arcSteps;
          profile.push({
            r: rCenter + Rc * Math.sin(theta),
            dz: Rc * Math.cos(theta),
          });
        }
        // Straight outer returned C-lip hugging parallel along exterior wall + subtle inward guide tip
        profile.push({ r: rCenter + Rc, dz: -10.5 });
        profile.push({ r: rCenter + Rc - 0.9, dz: -11.8 });

        // Chạy sát ra tận mép góc của từng mặt ống (chiều dài thanh Nẹp C ≈ W và H),
        // chỉ chừa khe hở kỹ thuật rất nhỏ ~1.2–2.0 mm tại đúng giao điểm 90° của 4 góc
        const cornerClearMm = Math.max(1.2, Math.min(2.0, t + 0.6));
        appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
          startTrimMm: cornerClearMm,
          endTrimMm: cornerClearMm,
          wallRotations: rots,
        });
      }

      // 3. Bích V quay ngoài ống thường (V30/40/50): gờ mí bẻ lật 90° +8 mm ôm mặt bích
      else if (conn.type === 'bich_v_out' && bichVHasTurnedLip(conn)) {
        const profile: ProfilePt2[] = [
          { r: 0.5 * t, dz: 0 },
          { r: 8.5, dz: 0 },
        ];
        appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
          startTrimMm: t + gap + 1.0,
          endTrimMm: t + gap + 1.0,
          wallRotations: rots,
        });
      }

      // 4. Đầu để thẳng (plain) có đoạn kéo dài trơn hoàn toàn (L_thẳng > 0: KHÔNG chạy mí!)
      else if (conn.type === 'plain' && conn.plainExtensionMm > 0) {
        const ext = Math.max(0, Math.min(300, conn.plainExtensionMm));
        // Clean flat straight wall sleeve extending outward from z = ±L/2 to ±(L/2 + ext) with NO seams!
        // Top & Bottom extend to outer corner (±(W/2 + t)), Left & Right stop flush at inner corner (±H/2)
        // so all 4 walls meet at razor-sharp 90° seamless corners with zero overlap!
        const isHoriz = wall === 'top' || wall === 'bottom';
        const trimMm = isHoriz ? -t : gap * 0.4;
        const profile: ProfilePt2[] = [
          { r: 0.5 * t, dz: 0 },
          { r: 0.5 * t, dz: ext },
        ];
        appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
          startTrimMm: trimMm,
          endTrimMm: trimMm,
          wallRotations: rots,
        });
      }

      // 5. Đầu bẻ chân tùy biến từng cạnh (Trên / Dưới / Trái / Phải: Bẻ vào | Bẻ ra | Để thẳng)
      else if (conn.type === 'be_chan') {
        const mode = conn.beChanEdges[wall];
        if (mode === 'straight') continue;
        const F = Math.max(5, Math.min(100, conn.beChanWidth));
        if (mode === 'out') {
          const profile: ProfilePt2[] = [
            { r: 0.5 * t, dz: 0 },
            { r: 0.5 * t + F, dz: 0 },
          ];
          appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
            startTrimMm: t + gap,
            endTrimMm: t + gap,
            wallRotations: rots,
          });
        } else {
          // Bẻ vào trong: chỉ vát 45° tại góc có cạnh kề cũng Bẻ vào để tránh cấn!
          const fEff = Math.min(F, Math.min(W, H) * 0.42);
          const { atStart, atEnd } = getAdjacentWallsAtLocalEnds(wall, endSign);
          const miterStart = conn.beChanEdges[atStart] === 'in';
          const miterEnd = conn.beChanEdges[atEnd] === 'in';
          const profile: ProfilePt2[] = [
            { r: 0.5 * t, dz: 0 },
            { r: -fEff, dz: 0 },
          ];
          appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
            startTrimMm: gap * 0.6,
            endTrimMm: gap * 0.6,
            miterStart45: miterStart,
            miterEnd45: miterEnd,
            wallRotations: rots,
          });
        }
      }

      // 6. Đầu gắn Lưới chắn côn trùng (LCCT: +20 mm chấn 90° quay vào lòng trong)
      else if (conn.type === 'lcct') {
        const fEff = Math.min(20.0, Math.min(W, H) * 0.42);
        const profile: ProfilePt2[] = [
          { r: 0.5 * t, dz: 0 },
          { r: -fEff, dz: 0 },
        ];
        appendWallEndProfile(zoneBuffers[5], wall, W, H, L, t, endSign, profile, {
          startTrimMm: gap * 0.6,
          endTrimMm: gap * 0.6,
          miterStart45: true,
          miterEnd45: true,
          wallRotations: rots,
        });
      }

      // 7. Đầu bịt kín (End Cap): từng cạnh tùy biến Mí gò (+31 mm Mí kép chờ) hoặc Mí hàn (+0 mm)
      else if (conn.type === 'end_cap') {
        const edgeSeam = getEndCapEdgeSeam(conn, wall);
        if (edgeSeam === 'pittsburgh') {
          const dzFold1 = -gap - 0.5 * t;
          const rInnerLeg = 1.5 * t + gap;
          const dzBottom = dzFold1 - 9.0;
          const rOuterLeg = 3.5 * t + 3 * gap;
          const dzHammer = 1.5 * t + gap;
          const hammerLen = 8.5;
          const alpha = (Math.PI / 2) * seamLockProgress;

          const profile: ProfilePt2[] = [
            { r: 0.5 * t, dz: dzFold1 - 1.5 },
            { r: 0.5 * t, dz: dzFold1 },
            { r: rInnerLeg, dz: dzFold1 },
            { r: rInnerLeg, dz: dzBottom },
            { r: rOuterLeg, dz: dzBottom },
            { r: rOuterLeg, dz: dzHammer },
            { r: rOuterLeg - hammerLen * Math.sin(alpha), dz: dzHammer + hammerLen * Math.cos(alpha) },
          ];
          appendWallEndProfile(zoneBuffers[1], wall, W, H, L, t, endSign, profile, {
            startTrimMm: t + gap + 1.0,
            endTrimMm: t + gap + 1.0,
            wallRotations: rots,
          });
        } else {
          // Welded edge (Hàn chập hoặc Hàn đấu đầu): đầu thân ống cắt phẳng +0 mm, đánh dấu nhẹ dải hàn màu cam (Zone 4)
          const profile: ProfilePt2[] = [
            { r: t + 0.08, dz: -3.2 },
            { r: t + 0.08, dz: 0 },
          ];
          appendWallEndProfile(zoneBuffers[4], wall, W, H, L, 0.16, endSign, profile, {
            startTrimMm: t + gap,
            endTrimMm: t + gap,
            wallRotations: rots,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Detached 3D Hardware & Accessories Builders
// ---------------------------------------------------------------------------

/**
 * Builds 4 stamped 3D TDC/TDF corner brackets with real 3D teardrop bolt holes
 * (pointed tip facing INWARD toward duct corner, round arc facing OUTWARD per ke_góc_đã_đóng_nhìn_mặt_trước.jpg)
 * and chamfered insertion leg tips (per ke_góc_1.jpg) sliding cleanly inside the hollow C-box channels.
 */
function buildTdcCornerBrackets(
  endKey: 'c1' | 'c2',
  endSign: 1 | -1,
  W: number,
  H: number,
  L: number,
  t: number,
  explodeRatio: number
): BuiltAccessoryMesh[] {
  const gap = Math.max(0.24, t * 0.28);
  const hw = W / 2;
  const hh = H / 2;
  const z0 = endSign * (L / 2);
  const bracketThick = 1.6;
  const hFlange = 32.0;
  const sqSize = hFlange - (t + gap) - 0.6;
  if (sqSize < 12) return [];

  const legLen = Math.min(44, Math.min(W, H) * 0.32);
  const legInner = Math.max(3.5, t + gap + 2.5);
  const legOuter = Math.min(sqSize - 3.5, 21.5);
  const startOff = t + gap + 0.3;
  const legChamfer = Math.min(5.5, (legOuter - legInner) * 0.42, legLen * 0.25);

  const lShape = new THREE.Shape();
  lShape.moveTo(startOff + legInner, -legLen);
  lShape.lineTo(startOff + legOuter - legChamfer, -legLen);
  lShape.lineTo(startOff + legOuter, -legLen + legChamfer);
  lShape.lineTo(startOff + legOuter, startOff);
  lShape.lineTo(startOff + sqSize, startOff);
  lShape.lineTo(startOff + sqSize, startOff + sqSize);
  lShape.lineTo(startOff, startOff + sqSize);
  lShape.lineTo(startOff, startOff + legOuter);
  lShape.lineTo(-legLen + legChamfer, startOff + legOuter);
  lShape.lineTo(-legLen, startOff + legOuter - legChamfer);
  lShape.lineTo(-legLen, startOff + legInner);
  lShape.lineTo(startOff, startOff + legInner);
  lShape.lineTo(startOff, startOff);
  lShape.lineTo(startOff + legInner, startOff);
  lShape.closePath();

  // Authentic teardrop bolt hole: ROUND lobe facing OUTWARD (+1, +1), POINTED tip facing INWARD (-1, -1) toward duct corner!
  const cx = startOff + sqSize * 0.56;
  const cy = startOff + sqSize * 0.56;
  const rBig = Math.min(5.2, sqSize * 0.2);
  const rTip = rBig * 0.36;
  const tipDist = rBig * 1.68;
  const hole = new THREE.Path();
  const dirAngle = -3 * Math.PI / 4; // Pointed V-tip aims straight toward inner duct corner (0, 0)
  const startA = dirAngle + Math.PI * 0.36;
  const endA = dirAngle + Math.PI * 1.64;
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const a = startA + ((endA - startA) * i) / steps;
    const px = cx + Math.cos(a) * rBig;
    const py = cy + Math.sin(a) * rBig;
    if (i === 0) hole.moveTo(px, py);
    else hole.lineTo(px, py);
  }
  const tipCx = cx + Math.cos(dirAngle) * tipDist;
  const tipCy = cy + Math.sin(dirAngle) * tipDist;
  const tipSteps = 10;
  for (let i = 0; i <= tipSteps; i++) {
    const a = dirAngle - Math.PI * 0.45 + (Math.PI * 0.9 * i) / tipSteps;
    hole.lineTo(tipCx + Math.cos(a) * rTip, tipCy + Math.sin(a) * rTip);
  }
  hole.closePath();
  lShape.holes.push(hole);

  const corners: { id: string; sx: 1 | -1; sy: 1 | -1 }[] = [
    { id: 'TR', sx: 1, sy: 1 },
    { id: 'TL', sx: -1, sy: 1 },
    { id: 'BR', sx: 1, sy: -1 },
    { id: 'BL', sx: -1, sy: -1 },
  ];

  const maxDiagMm = Math.max(70, Math.min(130, Math.min(W, H) * 0.24));
  const diagShiftMm = explodeRatio * maxDiagMm;
  const axialShiftMm = explodeRatio * 48;

  return corners.map((c) => {
    const geom = new THREE.ExtrudeGeometry(lShape, {
      depth: bracketThick,
      bevelEnabled: false,
      curveSegments: 16,
    });
    const zBack = endSign === 1 ? z0 - t - gap - bracketThick : z0 + t + gap;
    const posAttr = geom.getAttribute('position');
    const flipWinding = c.sx * c.sy < 0;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      const lz = posAttr.getZ(i);
      posAttr.setXYZ(
        i,
        (c.sx * hw + c.sx * lx) * MM_TO_M,
        (c.sy * hh + c.sy * ly) * MM_TO_M,
        (zBack + lz) * MM_TO_M
      );
    }
    if (flipWinding) {
      const idx = geom.getIndex();
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const b = idx.getX(i + 1);
          const d = idx.getX(i + 2);
          idx.setX(i + 1, d);
          idx.setX(i + 2, b);
        }
        idx.needsUpdate = true;
      } else {
        for (let i = 0; i < posAttr.count; i += 3) {
          const x1 = posAttr.getX(i + 1), y1 = posAttr.getY(i + 1), z1 = posAttr.getZ(i + 1);
          const x2 = posAttr.getX(i + 2), y2 = posAttr.getY(i + 2), z2 = posAttr.getZ(i + 2);
          posAttr.setXYZ(i + 1, x2, y2, z2);
          posAttr.setXYZ(i + 2, x1, y1, z1);
        }
      }
    }
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    return {
      id: `${endKey}-tdc-bracket-${c.id}`,
      kind: 'bracket',
      endKey,
      geometry: geom,
      edgesGeometry: new THREE.EdgesGeometry(geom, 24),
      offset: [
        c.sx * diagShiftMm * MM_TO_M,
        c.sy * diagShiftMm * MM_TO_M,
        endSign * axialShiftMm * MM_TO_M,
      ],
      kinematics: {
        endSign,
        radialDir: [c.sx, c.sy],
        explodeRadialMm: maxDiagMm,
        explodeAxialMm: 48,
        unseamedAxialMm: 0,
        unfoldRadialMm: 62,
        unfoldAxialMm: Math.max(190, Math.min(320, Math.max(W, H) * 0.36)),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Butt-Jointed 4-Bar Solid Frame Builder (2 Full-Length Outer Bars + 2 Clear-Span Inner Bars)
//    NO 45° miter cut on front flange face! 45° corner relief ONLY at rear wrap-leg tail!
//    NO bolt holes on Bích V or Bích U!
// ---------------------------------------------------------------------------

function pushBox(
  buf: ZoneBuf,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number
): void {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  const za = Math.min(z0, z1), zb = Math.max(z0, z1);
  if (xb - xa < 1e-4 || yb - ya < 1e-4 || zb - za < 1e-4) return;
  const uS = 1 / 280;
  const dx = (xb - xa) * uS, dy = (yb - ya) * uS, dz = (zb - za) * uS;
  const p000: [number, number, number] = [xa, ya, za];
  const p100: [number, number, number] = [xb, ya, za];
  const p110: [number, number, number] = [xb, yb, za];
  const p010: [number, number, number] = [xa, yb, za];
  const p001: [number, number, number] = [xa, ya, zb];
  const p101: [number, number, number] = [xb, ya, zb];
  const p111: [number, number, number] = [xb, yb, zb];
  const p011: [number, number, number] = [xa, yb, zb];
  // +Z
  pushQuad(buf, p001, [0, 0], p101, [dx, 0], p111, [dx, dy], p011, [0, dy]);
  // -Z
  pushQuad(buf, p000, [0, 0], p010, [0, dy], p110, [dx, dy], p100, [dx, 0]);
  // +Y
  pushQuad(buf, p011, [0, 0], p111, [dx, 0], p110, [dx, dz], p010, [0, dz]);
  // -Y
  pushQuad(buf, p000, [0, 0], p100, [dx, 0], p101, [dx, dz], p001, [0, dz]);
  // +X
  pushQuad(buf, p101, [0, 0], p100, [dz, 0], p110, [dz, dy], p111, [0, dy]);
  // -X
  pushQuad(buf, p000, [0, 0], p001, [dz, 0], p011, [dz, dy], p010, [0, dy]);
}

/**
 * Emits a rear axial wrap leg along a horizontal (X) or vertical (Y) bar with true 45° tail corner
 * relief chamfers (`góc vát ở phần thừa đuôi cánh ôm phía sau để không bị cấn góc`)!
 */
function pushChamferedRearLeg(
  buf: ZoneBuf,
  axis: 'x' | 'y',
  spanMin: number,
  spanMax: number,
  perpMin: number,
  perpMax: number,
  zRoot: number, // attaches cleanly to back of flat flange face
  zTail: number, // free rear end of wrap leg (in -endSign direction)
  chamferMm: number
): void {
  const halfSpan = (spanMax - spanMin) * 0.5;
  const depth = Math.abs(zTail - zRoot);
  const c = Math.max(0, Math.min(chamferMm, halfSpan * 0.35, depth * 0.72));
  const dirZ = zTail >= zRoot ? 1 : -1;
  const zCh = zTail - dirZ * c; // Z where 45° corner bevel begins

  // Cross-section polygon in (span s, z):
  //   0: (spanMin, zRoot) -> 1: (spanMax, zRoot) -> 2: (spanMax, zCh) -> 3: (spanMax - c, zTail)
  //   -> 4: (spanMin + c, zTail) -> 5: (spanMin, zCh)
  // Order strictly CCW in (s, z) assuming dirZ = +1; if dirZ = -1, reverse to keep outward normals!
  const rawPts: [number, number][] =
    c > 0.25
      ? [
          [spanMin, zRoot],
          [spanMax, zRoot],
          [spanMax, zCh],
          [spanMax - c, zTail],
          [spanMin + c, zTail],
          [spanMin, zCh],
        ]
      : [
          [spanMin, zRoot],
          [spanMax, zRoot],
          [spanMax, zTail],
          [spanMin, zTail],
        ];
  const poly = dirZ > 0 ? rawPts : [...rawPts].reverse();
  const uS = 1 / 280;

  const to3 = (s: number, p: number, z: number): [number, number, number] =>
    axis === 'x' ? [s, p, z] : [p, s, z];

  // For axis='x': (s=X, p=Y, z=Z). (X × Z) = -Y! So CCW in (X, Z) has normal -Y (at perpMin) and +Y (at perpMax reversed).
  // For axis='y': (s=Y, p=X, z=Z). (Y × Z) = +X! So CCW in (Y, Z) has normal +X (at perpMax) and -X (at perpMin reversed).
  const pA = Math.min(perpMin, perpMax);
  const pB = Math.max(perpMin, perpMax);
  const n = poly.length;

  // Convex fan triangulation for the two flat faces (pA and pB)
  for (let i = 1; i < n - 1; i++) {
    const a = poly[0], b = poly[i], d = poly[i + 1];
    if (axis === 'x') {
      // -Y face at pA uses CCW (a, b, d); +Y face at pB uses reversed (a, d, b)
      pushTri(buf, to3(a[0], pA, a[1]), [a[0] * uS, a[1] * uS], to3(b[0], pA, b[1]), [b[0] * uS, b[1] * uS], to3(d[0], pA, d[1]), [d[0] * uS, d[1] * uS]);
      pushTri(buf, to3(a[0], pB, a[1]), [a[0] * uS, a[1] * uS], to3(d[0], pB, d[1]), [d[0] * uS, d[1] * uS], to3(b[0], pB, b[1]), [b[0] * uS, b[1] * uS]);
    } else {
      // +X face at pB uses CCW (a, b, d); -X face at pA uses reversed (a, d, b)
      pushTri(buf, to3(a[0], pB, a[1]), [a[0] * uS, a[1] * uS], to3(b[0], pB, b[1]), [b[0] * uS, b[1] * uS], to3(d[0], pB, d[1]), [d[0] * uS, d[1] * uS]);
      pushTri(buf, to3(a[0], pA, a[1]), [a[0] * uS, a[1] * uS], to3(d[0], pA, d[1]), [d[0] * uS, d[1] * uS], to3(b[0], pA, b[1]), [b[0] * uS, b[1] * uS]);
    }
  }

  // Side perimeter quads around the polygon
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * uS;
    const thickU = (pB - pA) * uS;
    if (axis === 'x') {
      // Edge (a -> b) in CCW (X, Z) crossed with (+Y) points OUTWARD!
      // Verify: (b-a) = (+X) => (+X) × (+Y) = +Z? Wait: at bottom edge (a->b) = (+X) with interior at +Z -> outward is -Z!
      // Check (+Y) × (+X) = -Z! So quad (a(pA), a(pB), b(pB), b(pA)) -> (pB-pA) × (b-a) = (+Y) × (+X) = -Z = OUTWARD!
      pushQuad(
        buf,
        to3(a[0], pA, a[1]), [0, 0],
        to3(a[0], pB, a[1]), [thickU, 0],
        to3(b[0], pB, b[1]), [thickU, len],
        to3(b[0], pA, b[1]), [0, len]
      );
    } else {
      // Edge (a -> b) = (+Y) with interior at +Z -> outward is -Z. (+Y) × (+X) = -Z!
      // So (b-a) × (pB-pA) = (+Y) × (+X) = -Z = OUTWARD!
      // Quad (a(pA), b(pA), b(pB), a(pB)) -> (b-a) × (+X) = OUTWARD!
      pushQuad(
        buf,
        to3(a[0], pA, a[1]), [0, 0],
        to3(b[0], pA, b[1]), [0, len],
        to3(b[0], pB, b[1]), [thickU, len],
        to3(a[0], pB, a[1]), [thickU, 0]
      );
    }
  }
}

/**
 * Builds detached Bích V rời (Quay ngoài thường W+5, Quay ngoài EI W-3, V80×30 cánh 30 lọt lòng W-3,
 * hoặc Quay trong phủ bì W-3 × H-3) with:
 * - 2 full-length outer bars (Top/Bottom) + 2 clear-span inner bars (Left/Right) — ZERO 45° miter on front face!
 * - 45° relief bevels ONLY on the rear wrap-leg tails so corners never clash
 * - ZERO bolt holes!
 */
function buildBichVFrame(
  endKey: 'c1' | 'c2',
  endSign: 1 | -1,
  conn: EndConnectionConfig,
  W: number,
  H: number,
  L: number,
  t: number,
  explodeRatio: number
): BuiltAccessoryMesh {
  const gap = Math.max(0.24, t * 0.28);
  const tv = conn.bichVThickness;
  const spec = conn.type === 'bich_v_in' && conn.bichVSpec === 'V80x30' ? 'V40x40' : conn.bichVSpec;
  const { legFace, legAxial } = getBichVDimensions(spec);
  const zEnd = endSign * (L / 2);
  const zW = (dz: number) => zEnd + endSign * dz;
  const buttGap = 0.08;
  const zb: ZoneBuf = { positions: [], uvs: [] };

  let innerW: number;
  let innerH: number;
  let outerW: number;
  let outerH: number;
  let dzFront: number;
  let dzBack: number;
  let legAtInner: boolean;
  let legInnerOff: number; // radial band of axial leg relative to innerW/2 or outerW/2

  if (conn.type === 'bich_v_in') {
    // Bích V quay trong: Phủ bì = W-3 × H-3 (thay thế TDC/TDF quay trong)
    outerW = Math.max(40, W - 3);
    outerH = Math.max(40, H - 3);
    const lf = Math.min(legFace, Math.min(outerW, outerH) * 0.42);
    innerW = outerW - 2 * lf;
    innerH = outerH - 2 * lf;
    dzFront = 0;
    dzBack = -tv;
    legAtInner = false; // axial leg sits along OUTER edge (outer - tv .. outer) inside duct walls
    legInnerOff = 0;
  } else if (spec === 'V80x30' || conn.bichVOutStyle === 'ei') {
    // V80×30 (cánh 80 quay ngoài, cánh 30 lọt lòng W-3 × H-3) & Bích V EI quay ngoài (W-3 × H-3)
    const axialOuterW = Math.max(40, W - 3);
    const axialOuterH = Math.max(40, H - 3);
    innerW = Math.max(24, axialOuterW - 2 * tv);
    innerH = Math.max(24, axialOuterH - 2 * tv);
    outerW = innerW + 2 * legFace;
    outerH = innerH + 2 * legFace;
    dzBack = gap;
    dzFront = gap + tv;
    legAtInner = true; // axial leg sits at [innerW/2 .. innerW/2 + tv] = [(W-3)/2 - tv .. (W-3)/2] (lọt lòng W-3!)
    legInnerOff = 0;
  } else {
    // Bích V quay ngoài ống thường (V30/V40/V50): Lòng trong = W+5 × H+5, gờ mí tôn +8 mm lật phía trước
    innerW = W + 5;
    innerH = H + 5;
    outerW = innerW + 2 * legFace;
    outerH = innerH + 2 * legFace;
    dzFront = -(t + gap);
    dzBack = dzFront - tv;
    legAtInner = true;
    legInnerOff = 0;
  }

  const hOW = outerW / 2, hOH = outerH / 2;
  const hIW = innerW / 2, hIH = innerH / 2;
  const zF = zW(dzFront);
  const zB = zW(dzBack);
  const zTail = zW(dzFront - legAxial);

  // 1. Front flat flange face: 2 full-length outer bars (Top & Bottom) + 2 clear-span inner bars (Left & Right)
  pushBox(zb, -hOW, hOW, hIH, hOH, zB, zF); // Top (phủ bì)
  pushBox(zb, -hOW, hOW, -hOH, -hIH, zB, zF); // Bottom (phủ bì)
  pushBox(zb, -hOW, -hIW, -hIH + buttGap, hIH - buttGap, zB, zF); // Left (lọt lòng)
  pushBox(zb, hIW, hOW, -hIH + buttGap, hIH - buttGap, zB, zF); // Right (lọt lòng)

  // 2. Rear axial wrap legs with 45° corner tail relief chamfers (không cấn góc!)
  const tailChamfer = Math.min(legAxial * 0.45, Math.max(8, tv * 3.2));
  if (legAtInner) {
    const r0X = hIW + legInnerOff;
    const r0Y = hIH + legInnerOff;
    // Top & Bottom inner legs span [-r0X - tv, +r0X + tv] with 45° tail bevel; Left & Right fit cleanly between [-r0Y + buttGap, +r0Y - buttGap]
    pushChamferedRearLeg(zb, 'x', -r0X - tv, r0X + tv, r0Y, r0Y + tv, zB, zTail, tailChamfer);
    pushChamferedRearLeg(zb, 'x', -r0X - tv, r0X + tv, -r0Y - tv, -r0Y, zB, zTail, tailChamfer);
    pushChamferedRearLeg(zb, 'y', -r0Y + buttGap, r0Y - buttGap, -r0X - tv, -r0X, zB, zTail, tailChamfer);
    pushChamferedRearLeg(zb, 'y', -r0Y + buttGap, r0Y - buttGap, r0X, r0X + tv, zB, zTail, tailChamfer);
  } else {
    // Inward V-flange: axial legs sit along OUTER perimeter (hOW - tv .. hOW, hOH - tv .. hOH)
    pushChamferedRearLeg(zb, 'x', -hOW, hOW, hOH - tv, hOH, zB, zTail, tailChamfer);
    pushChamferedRearLeg(zb, 'x', -hOW, hOW, -hOH, -hOH + tv, zB, zTail, tailChamfer);
    pushChamferedRearLeg(zb, 'y', -hOH + tv + buttGap, hOH - tv - buttGap, -hOW, -hOW + tv, zB, zTail, tailChamfer);
    pushChamferedRearLeg(zb, 'y', -hOH + tv + buttGap, hOH - tv - buttGap, hOW - tv, hOW, zB, zTail, tailChamfer);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(zb.positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(zb.uvs, 2));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const maxAxV = Math.max(125, Math.min(230, Math.max(W, H) * 0.28));
  const axShiftMm = explodeRatio * maxAxV;

  return {
    id: `${endKey}-bich-v-frame`,
    kind: 'structural_flange',
    endKey,
    geometry: geom,
    edgesGeometry: new THREE.EdgesGeometry(geom, 20),
    offset: [0, 0, endSign * axShiftMm * MM_TO_M],
    kinematics: {
      endSign,
      radialDir: [0, 0],
      explodeRadialMm: 0,
      explodeAxialMm: maxAxV,
      unseamedAxialMm: 0,
      unfoldRadialMm: 0,
      unfoldAxialMm: Math.max(210, Math.min(360, Math.max(W, H) * 0.44)),
    },
  };
}

/**
 * Builds detached Bích U rời (1.5 / 2 / 3 mm, NO bolt holes):
 * - 2 full-length outer bars + 2 clear-span inner bars (ZERO 45° miter on front face!)
 * - Asymmetric U-channel: Cánh ôm thân (wrapLeg) × Mặt bích phẳng (flangeFace) × Gờ bẻ ngoài cố định 10 mm quay ngược về phía thân ống
 * - 45° corner relief bevels on the rear wrap-leg tails so corners never clash!
 */
function buildBichUFrame(
  endKey: 'c1' | 'c2',
  endSign: 1 | -1,
  conn: EndConnectionConfig,
  W: number,
  H: number,
  L: number,
  t: number,
  explodeRatio: number
): BuiltAccessoryMesh {
  const tu = conn.bichUThickness;
  const wrapLeg = Math.max(15, Math.min(120, conn.bichUWrapLeg));
  const flangeFace = Math.max(15, Math.min(120, conn.bichUFlangeFace));
  const outerLip = BICH_U_OUTER_LIP_MM; // cố định 10 mm quay ngược về phía thân ống
  const zEnd = endSign * (L / 2);
  const zW = (dz: number) => zEnd + endSign * dz;
  const buttGap = 0.08;
  const zb: ZoneBuf = { positions: [], uvs: [] };

  const innerW = W + 2 * t + 3.0;
  const innerH = H + 2 * t + 3.0;
  const outerW = innerW + 2 * flangeFace;
  const outerH = innerH + 2 * flangeFace;
  const hIW = innerW / 2, hIH = innerH / 2;
  const hOW = outerW / 2, hOH = outerH / 2;

  const zF = zW(0);
  const zB = zW(-tu);
  const zWrapTail = zW(-wrapLeg);
  const zLipTail = zW(-outerLip);

  // 1. Flat flange face: 2 full-length outer bars (Top/Bottom) + 2 clear-span inner bars (Left/Right)
  pushBox(zb, -hOW, hOW, hIH, hOH, zB, zF);
  pushBox(zb, -hOW, hOW, -hOH, -hIH, zB, zF);
  pushBox(zb, -hOW, -hIW, -hIH + buttGap, hIH - buttGap, zB, zF);
  pushBox(zb, hIW, hOW, -hIH + buttGap, hIH - buttGap, zB, zF);

  // 2. Rear inner wrap leg (Cánh ôm thân) with 45° tail corner relief bevels
  const wrapChamfer = Math.min(wrapLeg * 0.45, Math.max(8, tu * 3.5));
  pushChamferedRearLeg(zb, 'x', -hIW - tu, hIW + tu, hIH, hIH + tu, zB, zWrapTail, wrapChamfer);
  pushChamferedRearLeg(zb, 'x', -hIW - tu, hIW + tu, -hIH - tu, -hIH, zB, zWrapTail, wrapChamfer);
  pushChamferedRearLeg(zb, 'y', -hIH + buttGap, hIH - buttGap, -hIW - tu, -hIW, zB, zWrapTail, wrapChamfer);
  pushChamferedRearLeg(zb, 'y', -hIH + buttGap, hIH - buttGap, hIW, hIW + tu, zB, zWrapTail, wrapChamfer);

  // 3. Fixed 10 mm outer return lip (Gờ bẻ ngoài cố định 10 mm quay ngược về phía thân ống!)
  pushBox(zb, -hOW, hOW, hOH - tu, hOH, zLipTail, zB);
  pushBox(zb, -hOW, hOW, -hOH, -hOH + tu, zLipTail, zB);
  pushBox(zb, -hOW, -hOW + tu, -hIH + buttGap, hIH - buttGap, zLipTail, zB);
  pushBox(zb, hOW - tu, hOW, -hIH + buttGap, hIH - buttGap, zLipTail, zB);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(zb.positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(zb.uvs, 2));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const maxAxU = Math.max(125, Math.min(230, Math.max(W, H) * 0.28));
  const axShiftMm = explodeRatio * maxAxU;

  return {
    id: `${endKey}-bich-u-frame`,
    kind: 'structural_flange',
    endKey,
    geometry: geom,
    edgesGeometry: new THREE.EdgesGeometry(geom, 20),
    offset: [0, 0, endSign * axShiftMm * MM_TO_M],
    kinematics: {
      endSign,
      radialDir: [0, 0],
      explodeRadialMm: 0,
      explodeAxialMm: maxAxU,
      unseamedAxialMm: 0,
      unfoldRadialMm: 0,
      unfoldAxialMm: Math.max(210, Math.min(360, Math.max(W, H) * 0.44)),
    },
  };
}

/**
 * Builds removable LCCT Insect Screen Frame (Khung nẹp viền + thanh nẹp chia ô + mặt lưới ô vuông).
 */
function buildLcctScreen(
  endKey: 'c1' | 'c2',
  endSign: 1 | -1,
  W: number,
  H: number,
  L: number,
  t: number,
  explodeRatio: number
): BuiltAccessoryMesh[] {
  const gap = Math.max(0.24, t * 0.28);
  const outerW = Math.max(40, W - 4);
  const outerH = Math.max(40, H - 4);
  const frameBarW = Math.min(14, Math.min(outerW, outerH) * 0.14);
  const frameDepth = 9.0;
  const zFront = endSign * (L / 2) - endSign * (t + gap + 0.6);
  const zBack = zFront - endSign * frameDepth;
  const zCenter = (zFront + zBack) * 0.5;

  const maxAxLcct = Math.max(135, Math.min(240, Math.max(W, H) * 0.3));
  const axShiftMm = explodeRatio * maxAxLcct;
  const offset: [number, number, number] = [0, 0, endSign * axShiftMm * MM_TO_M];
  const lcctKinematics: AccessoryKinematics = {
    endSign,
    radialDir: [0, 0],
    explodeRadialMm: 0,
    explodeAxialMm: maxAxLcct,
    unseamedAxialMm: 0,
    unfoldRadialMm: 0,
    unfoldAxialMm: Math.max(210, Math.min(360, Math.max(W, H) * 0.44)),
  };

  const zb: ZoneBuf = { positions: [], uvs: [] };
  const hOW = outerW / 2, hOH = outerH / 2;
  const hIW = hOW - frameBarW, hIH = hOH - frameBarW;

  // Perimeter frame (2 outer + 2 inner square butt-jointed bars)
  pushBox(zb, -hOW, hOW, hIH, hOH, zBack, zFront);
  pushBox(zb, -hOW, hOW, -hOH, -hIH, zBack, zFront);
  pushBox(zb, -hOW, -hIW, -hIH, hIH, zBack, zFront);
  pushBox(zb, hIW, hOW, -hIH, hIH, zBack, zFront);

  // Grid divider mullions (thanh nẹp chia ô)
  const barHalf = 3.0;
  const barHalfD = 2.5;
  const innerClearW = Math.max(10, outerW - frameBarW * 2);
  const innerClearH = Math.max(10, outerH - frameBarW * 2);
  const nVert = outerW >= 420 ? Math.max(1, Math.min(4, Math.floor(outerW / 280))) : 1;
  const nHoriz =
    outerH >= 320 ? Math.max(1, Math.min(3, Math.floor(outerH / 260))) : outerH >= 200 ? 1 : 0;

  for (let i = 1; i <= nVert; i++) {
    const xPos = -innerClearW / 2 + (innerClearW * i) / (nVert + 1);
    pushBox(zb, xPos - barHalf, xPos + barHalf, -hIH, hIH, zCenter - barHalfD, zCenter + barHalfD);
  }
  for (let j = 1; j <= nHoriz; j++) {
    const yPos = -innerClearH / 2 + (innerClearH * j) / (nHoriz + 1);
    pushBox(zb, -hIW, hIW, yPos - barHalf, yPos + barHalf, zCenter - barHalfD, zCenter + barHalfD);
  }

  const mergedFrame = new THREE.BufferGeometry();
  mergedFrame.setAttribute('position', new THREE.Float32BufferAttribute(zb.positions, 3));
  mergedFrame.setAttribute('uv', new THREE.Float32BufferAttribute(zb.uvs, 2));
  mergedFrame.computeVertexNormals();
  mergedFrame.computeBoundingBox();
  mergedFrame.computeBoundingSphere();

  // Translucent square metallic wire-mesh plane
  const meshGeom = new THREE.PlaneGeometry(innerClearW * MM_TO_M, innerClearH * MM_TO_M);
  const uv = meshGeom.getAttribute('uv');
  const repX = Math.max(2, innerClearW / 40);
  const repY = Math.max(2, innerClearH / 40);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repX, uv.getY(i) * repY);
  }
  uv.needsUpdate = true;
  meshGeom.translate(0, 0, zCenter * MM_TO_M);
  meshGeom.computeBoundingBox();
  meshGeom.computeBoundingSphere();

  return [
    {
      id: `${endKey}-lcct-frame`,
      kind: 'lcct_frame',
      endKey,
      geometry: mergedFrame,
      edgesGeometry: new THREE.EdgesGeometry(mergedFrame, 22),
      offset,
      kinematics: lcctKinematics,
    },
    {
      id: `${endKey}-lcct-mesh`,
      kind: 'lcct_mesh',
      endKey,
      geometry: meshGeom,
      edgesGeometry: null,
      offset,
      kinematics: lcctKinematics,
    },
  ];
}

/**
 * Builds removable End Cap panel (`1-B`, `1-E`, `1-F`...):
 * - Flat sheet cover with optional straight embossed ribs (synced to stiffenerRibs & ribPitchMm, NO X-ribs!)
 * - Per-edge configurable seam: Mí đơn (+7 mm vát 45°), Hàn chập (7–25 mm gập ôm ngoài), hoặc Hàn đấu đầu (0–0)
 * - Stamped inner-face partCode label facing into the duct interior!
 */
function buildEndCapPanel(
  endKey: 'c1' | 'c2',
  endSign: 1 | -1,
  conn: EndConnectionConfig,
  config: DuctConfig,
  seamLockProgress: number,
  explodeRatio: number,
  ribPitchMm = 210
): BuiltAccessoryMesh {
  const { W, H, L, thickness: t, stiffenerRibs } = config;
  const gap = Math.max(0.24, t * 0.28);
  const uvScale = 1 / 280;
  const z0 = endSign * (L / 2);
  const partCode = getEndCapPartCode(config, endKey);

  const hasAnyPitts = (['top', 'bottom', 'left', 'right'] as WallId[]).some(
    (w) => getEndCapEdgeSeam(conn, w) === 'pittsburgh'
  );

  // Panel outer span clears duct wall cleanly (slightly larger for Pittsburgh / Hàn chập, flush W+2t for butt)
  const capMargin = hasAnyPitts ? 2.5 * t + 2 * gap - 0.25 : t + gap * 0.5;
  const capW = W + 2 * capMargin;
  const capH = H + 2 * capMargin;
  const hw = capW / 2;
  const hh = capH / 2;
  const dzOuter = hasAnyPitts ? 2.5 * t + 2 * gap : t + gap;
  const dzInner = dzOuter - t;

  const zoneBuffers: Record<ExtendedMaterialZone, ZoneBuf> = {
    0: { positions: [], uvs: [] },
    1: { positions: [], uvs: [] },
    2: { positions: [], uvs: [] },
    3: { positions: [], uvs: [] },
    4: { positions: [], uvs: [] },
    5: { positions: [], uvs: [] },
  };

  // Straight parallel embossed stiffener ribs on End Cap (configurable ribPitchMm, NEVER X-ribs)
  const ribAlongX = W >= H;
  const spanPerp = ribAlongX ? capH : capW;
  const spanAlong = ribAlongX ? capW : capH;
  const ribCenters = computeRibLayout(spanPerp, stiffenerRibs, ribPitchMm).zPositionsMm;

  const smoothstep = (e0: number, e1: number, x: number) => {
    const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return u * u * (3 - 2 * u);
  };
  const evalCapRibH = (x: number, y: number): number => {
    if (ribCenters.length === 0) return 0;
    const coordPerp = ribAlongX ? y : x;
    const coordAlong = (ribAlongX ? x : y) + spanAlong / 2;
    let hz = 0;
    for (const rc of ribCenters) {
      const dist = Math.abs(coordPerp - rc);
      if (dist < 7.0) {
        hz = Math.max(hz, dist <= 2.0 ? 2.6 : 2.6 * (1 - (dist - 2.0) / 5.0));
      }
    }
    if (hz <= 1e-4) return 0;
    const margin = Math.min(28, spanAlong * 0.14);
    const ramp = Math.min(18, spanAlong * 0.09);
    return hz * smoothstep(margin, margin + ramp, coordAlong) * smoothstep(margin, margin + ramp, spanAlong - coordAlong);
  };

  const makeBreaks = (halfS: number, alongRib: boolean): number[] => {
    const pts = new Set<number>([-halfS, halfS]);
    if (ribCenters.length > 0) {
      if (alongRib) {
        const margin = Math.min(28, halfS * 2 * 0.14);
        const ramp = Math.min(18, halfS * 2 * 0.09);
        for (const p of [-halfS + margin, -halfS + margin + ramp, halfS - margin - ramp, halfS - margin]) {
          if (p > -halfS + 1 && p < halfS - 1) pts.add(p);
        }
      } else {
        for (const rc of ribCenters) {
          for (const d of [-7, -2, 2, 7]) {
            if (rc + d > -halfS + 1 && rc + d < halfS - 1) pts.add(rc + d);
          }
        }
      }
    }
    return Array.from(pts).sort((a, b) => a - b);
  };

  const xs = makeBreaks(hw, ribAlongX);
  const ys = makeBreaks(hh, !ribAlongX);
  const bodyBuf = zoneBuffers[0];

  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const x0 = xs[ix], x1 = xs[ix + 1], y0 = ys[iy], y1 = ys[iy + 1];
      const h00 = evalCapRibH(x0, y0), h10 = evalCapRibH(x1, y0), h11 = evalCapRibH(x1, y1), h01 = evalCapRibH(x0, y1);
      const u0 = (x0 + hw) * uvScale, u1 = (x1 + hw) * uvScale;
      const v0 = (y0 + hh) * uvScale, v1 = (y1 + hh) * uvScale;

      const zo00 = z0 + endSign * (dzOuter + h00), zo10 = z0 + endSign * (dzOuter + h10);
      const zo11 = z0 + endSign * (dzOuter + h11), zo01 = z0 + endSign * (dzOuter + h01);
      const zi00 = z0 + endSign * (dzInner + h00), zi10 = z0 + endSign * (dzInner + h10);
      const zi11 = z0 + endSign * (dzInner + h11), zi01 = z0 + endSign * (dzInner + h01);

      if (endSign === 1) {
        pushQuad(bodyBuf, [x0, y0, zo00], [u0, v0], [x1, y0, zo10], [u1, v0], [x1, y1, zo11], [u1, v1], [x0, y1, zo01], [u0, v1]);
        pushQuad(bodyBuf, [x0, y0, zi00], [u0, v0], [x0, y1, zi01], [u0, v1], [x1, y1, zi11], [u1, v1], [x1, y0, zi10], [u1, v0]);
      } else {
        pushQuad(bodyBuf, [x0, y0, zo00], [u0, v0], [x0, y1, zo01], [u0, v1], [x1, y1, zo11], [u1, v1], [x1, y0, zo10], [u1, v0]);
        pushQuad(bodyBuf, [x0, y0, zi00], [u0, v0], [x1, y0, zi10], [u1, v0], [x1, y1, zi11], [u1, v1], [x0, y1, zi01], [u0, v1]);
      }
    }
  }

  // Per-edge seam lips around all 4 edges (Mí đơn +7 vát 45° | Hàn chập 7–25 mm | Hàn đấu đầu 0–0)
  const walls: WallId[] = ['top', 'bottom', 'left', 'right'];
  for (const wall of walls) {
    const edgeSeam = getEndCapEdgeSeam(conn, wall);
    const out = getWallOutwardNormal(wall);
    const ccw = getWallCcwTangent(wall);
    const xDir: Vec2 = { x: ccw.x * endSign, y: ccw.y * endSign };
    const edgeMid = getWallMidInner(wall, hw - 0.5 * t, hh - 0.5 * t);
    const rootHalf = (wall === 'top' || wall === 'bottom' ? capW : capH) / 2;

    const pt = (xLoc: number, rOff: number, dz: number): [number, number, number] => [
      edgeMid.x + xDir.x * xLoc + out.x * rOff,
      edgeMid.y + xDir.y * xLoc + out.y * rOff,
      z0 + endSign * dz,
    ];

    if (edgeSeam === 'pittsburgh') {
      // Male +7 mm lip bent 90° backward with 45° corner chamfers (Zone 2 = Blue)
      const lipBuf = zoneBuffers[2];
      const lipLen = 7.0;
      const chamfer = Math.min(lipLen, rootHalf * 0.3);
      const tipHalf = rootHalf - chamfer;
      const rOut = 0.5 * t, rIn = -0.5 * t;
      const dzRoot = dzOuter - 0.5 * t;
      const dzTip = dzRoot - lipLen;

      pushQuad(lipBuf, pt(-rootHalf, rOut, dzRoot), [0, 0], pt(rootHalf, rOut, dzRoot), [rootHalf * 2 * uvScale, 0], pt(tipHalf, rOut, dzTip), [(rootHalf + tipHalf) * uvScale, lipLen * uvScale], pt(-tipHalf, rOut, dzTip), [chamfer * uvScale, lipLen * uvScale]);
      pushQuad(lipBuf, pt(-rootHalf, rIn, dzRoot), [0, 0], pt(-tipHalf, rIn, dzTip), [chamfer * uvScale, lipLen * uvScale], pt(tipHalf, rIn, dzTip), [(rootHalf + tipHalf) * uvScale, lipLen * uvScale], pt(rootHalf, rIn, dzRoot), [rootHalf * 2 * uvScale, 0]);
      pushQuad(lipBuf, pt(-tipHalf, rIn, dzTip), [0, 0], pt(-tipHalf, rOut, dzTip), [t * uvScale, 0], pt(tipHalf, rOut, dzTip), [t * uvScale, tipHalf * 2 * uvScale], pt(tipHalf, rIn, dzTip), [0, tipHalf * 2 * uvScale]);
      pushQuad(lipBuf, pt(-rootHalf, rIn, dzRoot), [0, 0], pt(-rootHalf, rOut, dzRoot), [t * uvScale, 0], pt(-tipHalf, rOut, dzTip), [t * uvScale, chamfer * uvScale], pt(-tipHalf, rIn, dzTip), [0, chamfer * uvScale]);
      pushQuad(lipBuf, pt(rootHalf, rIn, dzRoot), [0, 0], pt(tipHalf, rIn, dzTip), [0, chamfer * uvScale], pt(tipHalf, rOut, dzTip), [t * uvScale, chamfer * uvScale], pt(rootHalf, rOut, dzRoot), [t * uvScale, 0]);
    } else if (edgeSeam === 'weld_overlap') {
      // Hàn chập (7–25 mm): flat overlap skirt wrapping cleanly outside duct wall (Zone 4 = Orange)
      const weldBuf = zoneBuffers[4];
      const lapLen = Math.max(7, Math.min(25, conn.endCapWeldOverlapWidth));
      const trim = t + gap;
      const halfSpan = rootHalf - trim;
      const rOut = 0.5 * t, rIn = -0.5 * t;
      const dzRoot = dzOuter - 0.5 * t;
      const dzTip = dzRoot - lapLen;

      pushQuad(weldBuf, pt(-halfSpan, rOut, dzRoot), [0, 0], pt(halfSpan, rOut, dzRoot), [halfSpan * 2 * uvScale, 0], pt(halfSpan, rOut, dzTip), [halfSpan * 2 * uvScale, lapLen * uvScale], pt(-halfSpan, rOut, dzTip), [0, lapLen * uvScale]);
      pushQuad(weldBuf, pt(-halfSpan, rIn, dzRoot), [0, 0], pt(-halfSpan, rIn, dzTip), [0, lapLen * uvScale], pt(halfSpan, rIn, dzTip), [halfSpan * 2 * uvScale, lapLen * uvScale], pt(halfSpan, rIn, dzRoot), [halfSpan * 2 * uvScale, 0]);
      pushQuad(weldBuf, pt(-halfSpan, rIn, dzTip), [0, 0], pt(-halfSpan, rOut, dzTip), [t * uvScale, 0], pt(halfSpan, rOut, dzTip), [t * uvScale, halfSpan * 2 * uvScale], pt(halfSpan, rIn, dzTip), [0, halfSpan * 2 * uvScale]);
      pushQuad(weldBuf, pt(-halfSpan, rIn, dzRoot), [0, 0], pt(-halfSpan, rOut, dzRoot), [t * uvScale, 0], pt(-halfSpan, rOut, dzTip), [t * uvScale, lapLen * uvScale], pt(-halfSpan, rIn, dzTip), [0, lapLen * uvScale]);
      pushQuad(weldBuf, pt(halfSpan, rIn, dzRoot), [0, 0], pt(halfSpan, rIn, dzTip), [0, lapLen * uvScale], pt(halfSpan, rOut, dzTip), [t * uvScale, lapLen * uvScale], pt(halfSpan, rOut, dzRoot), [t * uvScale, 0]);
    } else {
      // Hàn đấu đầu (0–0): clean edge thickness cap colored Orange (Zone 4)
      const buttBuf = zoneBuffers[4];
      const rOut = 0.5 * t;
      pushQuad(buttBuf, pt(-rootHalf, rOut, dzOuter), [0, 0], pt(rootHalf, rOut, dzOuter), [rootHalf * 2 * uvScale, 0], pt(rootHalf, rOut, dzInner), [rootHalf * 2 * uvScale, t * uvScale], pt(-rootHalf, rOut, dzInner), [0, t * uvScale]);
    }
  }

  const geom = buildGeometryFromZones(zoneBuffers);
  const maxUnseamedMm = hasAnyPitts ? 13.5 : 8.5;
  const maxExplodeMm = Math.max(135, Math.min(260, Math.max(W, H) * 0.34));
  const unseamedShift = (1 - seamLockProgress) * maxUnseamedMm;
  const explodeShift = explodeRatio * maxExplodeMm;

  // Inner-face marking (`1-B`, `1-E`, `1-F`...) stamped cleanly on the INSIDE of the End Cap
  const labelW = Math.max(60, Math.min(180, Math.min(W, H) * 0.42));
  const labelH = labelW * 0.46;
  const labelZ = z0 + endSign * (dzInner - 0.45);
  const faceLabel: BuiltFaceLabel = {
    id: `${endKey}-cap-label`,
    partCode,
    pieceId: `${endKey}-end-cap-panel`,
    position: [0, 0, labelZ * MM_TO_M],
    rotation: endSign === 1 ? [0, Math.PI, 0] : [0, 0, 0],
    sizeM: [labelW * MM_TO_M, labelH * MM_TO_M],
  };

  return {
    id: `${endKey}-end-cap-panel`,
    kind: 'end_cap',
    partCode,
    endKey,
    geometry: geom,
    edgesGeometry: new THREE.EdgesGeometry(geom, 22),
    offset: [0, 0, endSign * (unseamedShift + explodeShift) * MM_TO_M],
    faceLabels: [faceLabel],
    kinematics: {
      endSign,
      radialDir: [0, 0],
      explodeRadialMm: 0,
      explodeAxialMm: maxExplodeMm,
      unseamedAxialMm: maxUnseamedMm,
      unfoldRadialMm: 0,
      unfoldAxialMm: Math.max(220, Math.min(380, Math.max(W, H) * 0.46)),
    },
  };
}

// ---------------------------------------------------------------------------
// Master End-Connection Accessories Builder (for both C1 and C2)
// ---------------------------------------------------------------------------

export function buildAllEndAccessories(
  config: DuctConfig,
  seamLockProgress: number,
  explodeRatio: number,
  ribPitchMm = 210
): BuiltAccessoryMesh[] {
  const { W, H, L, thickness: t, c1, c2 } = config;
  const accessories: BuiltAccessoryMesh[] = [];

  const ends: { key: 'c1' | 'c2'; endSign: 1 | -1; conn: EndConnectionConfig }[] = [
    { key: 'c1', endSign: 1, conn: c1 },
    { key: 'c2', endSign: -1, conn: c2 },
  ];

  for (const { key, endSign, conn } of ends) {
    switch (conn.type) {
      case 'tdc_tdf':
        accessories.push(...buildTdcCornerBrackets(key, endSign, W, H, L, t, explodeRatio));
        break;
      case 'bich_v_out':
      case 'bich_v_in':
        accessories.push(buildBichVFrame(key, endSign, conn, W, H, L, t, explodeRatio));
        break;
      case 'bich_u':
        accessories.push(buildBichUFrame(key, endSign, conn, W, H, L, t, explodeRatio));
        break;
      case 'lcct':
        if (conn.showLcctMesh) {
          accessories.push(...buildLcctScreen(key, endSign, W, H, L, t, explodeRatio));
        }
        break;
      case 'end_cap':
        accessories.push(
          buildEndCapPanel(key, endSign, conn, config, seamLockProgress, explodeRatio, ribPitchMm)
        );
        break;
      case 'nep_c':
      case 'plain':
      case 'be_chan':
        break;
    }
  }

  return accessories;
}
