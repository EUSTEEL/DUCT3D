import * as THREE from 'three';
import type {
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  ResolvedCornerSeam,
  SplitMode,
  WallId,
} from '../types/duct';
import {
  computeRibLayout,
  getSplitTopologies,
  getWallLength,
  resolveActiveSeams,
} from './ductRules';
import {
  buildAllEndAccessories,
  type BuiltAccessoryMesh,
  type BuiltFaceLabel,
  type ExtendedMaterialZone,
} from './endConnectionBuilder';
import { bichVHasTurnedLip, getEndCapEdgeSeam } from './endConnectionRules';

export const MM_TO_M = 0.001;

/**
 * Recursive articulated hinge node for integral sheet-metal folds
 * (Mí đơn +7, Mí kép +31, Hàn chập, TDC/TDF 3-fold C-box, Nẹp C 180° curl,
 * Bẻ chân, LCCT, Bích V +8 lip, Đầu bịt kín Mí kép chờ).
 *
 * At runtime, dragging `Mở phôi 3D` ONLY updates `group.rotation` (ZERO geometry rebuilds!).
 */
export interface HingeSegmentNode {
  id: string;
  /** Interactive target tag when this hinge belongs to an integral end connection (C1 / C2) */
  endKey?: 'c1' | 'c2';
  /** Interactive target tag when this hinge belongs to a longitudinal seam (TR / TL / BR / BL) */
  cornerId?: CornerId;
  /** Hinge pivot offset in parent's local frame (meters) */
  pivotM: [number, number, number];
  /** Hinge rotation axis in local frame ('x' for end flanges, 'z' for longitudinal seams) */
  axis: 'x' | 'z';
  /** Folded rotation angle (radians) at unfold = 0% (smoothly interpolates -> 0 at unfold = 100%) */
  foldedAngleRad: number;
  /** If true, angle is also scaled by `seamLockProgress` (0 = Chưa gò mí, 1 = Đã gò mí) */
  usesSeamLock?: boolean;
  /** Static non-indexed BufferGeometry with [0..5] material zone groups */
  geometry: THREE.BufferGeometry;
  edgesGeometry: THREE.EdgesGeometry;
  /** Nested sub-folds along the sheet strip */
  children: HingeSegmentNode[];
}

/**
 * Articulated wall panel inside a sheet-metal duct piece, expressed in the
 * universal right-handed wall frame:
 *   +X = CCW tangent around duct ([-span/2, +span/2])
 *   +Y = inward normal (MẶT ĐÁNH DẤU faces +Y at y = 0; outer face at y = -t)
 *   +Z = axial C2 (-L/2) -> C1 (+L/2)
 */
export interface WallRigNode {
  id: string;
  wall: WallId;
  spanMm: number;
  /** 0 = root wall of piece; -1 / +1 = child wall hinged at parent's -span/2 or +span/2 bend */
  hingeSideFromParent: -1 | 0 | 1;
  parentSpanMm: number;
  geometry: THREE.BufferGeometry;
  edgesGeometry: THREE.EdgesGeometry;
  faceLabel: BuiltFaceLabel;
  /** Integral seams & end flanges attached as live rotating child hinges */
  flangeHinges: HingeSegmentNode[];
  /** Adjacent walls belonging to the same continuous sheet piece */
  childWalls: WallRigNode[];
}

export interface PieceRig {
  id: string;
  partCode: string;
  name: string;
  walls: WallId[];
  rootWall: WallRigNode;
}

export interface BuiltWeldBeadRig {
  id: string;
  cornerId: CornerId;
  geometry: THREE.BufferGeometry;
}

export interface UnfoldableDuctRig {
  pieces: PieceRig[];
  weldBeads: BuiltWeldBeadRig[];
  accessories: BuiltAccessoryMesh[];
  /** Metadata cached for zero-allocation runtime pose evaluation */
  W: number;
  H: number;
  L: number;
  splitMode: SplitMode;
  topIsFemaleTR: boolean;
  trIsPittsburgh: boolean;
}

export interface PiecePoseRuntime {
  positionM: [number, number, number];
  rotZ: number;
  /** 1 = 90° folded body bends; 0 = 0° completely flat */
  bodyFoldFactor: number;
  /** 1 = fully folded integral flanges & seams; 0 = 0° flat sheet */
  detailFoldFactor: number;
}

// ---------------------------------------------------------------------------
// Low-level Zone Geometry Builders
// ---------------------------------------------------------------------------

interface ZoneBuf {
  positions: number[];
  uvs: number[];
}

function createEmptyZoneBuffers(): Record<ExtendedMaterialZone, ZoneBuf> {
  return {
    0: { positions: [], uvs: [] },
    1: { positions: [], uvs: [] },
    2: { positions: [], uvs: [] },
    3: { positions: [], uvs: [] },
    4: { positions: [], uvs: [] },
    5: { positions: [], uvs: [] },
  };
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

function finalizeZoneGeometry(
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
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

function getAdjacentWallOnSide(wall: WallId, side: -1 | 1): WallId {
  const ccw: WallId[] = ['bottom', 'right', 'top', 'left'];
  const idx = ccw.indexOf(wall);
  return ccw[(idx + (side === 1 ? 1 : 3)) % 4];
}

function getBaseWallCenterMm(wall: WallId, W: number, H: number): [number, number] {
  switch (wall) {
    case 'bottom':
      return [0, -H / 2];
    case 'right':
      return [W / 2, 0];
    case 'top':
      return [0, H / 2];
    case 'left':
      return [-W / 2, 0];
  }
}

function getBaseWallRotZ(wall: WallId): number {
  switch (wall) {
    case 'bottom':
      return 0;
    case 'right':
      return Math.PI / 2;
    case 'top':
      return Math.PI;
    case 'left':
      return -Math.PI / 2;
  }
}

// ---------------------------------------------------------------------------
// 1. Thick Flat Plate & Embossed Straight-Rib Wall Geometry Builder
// ---------------------------------------------------------------------------

/**
 * Builds a single duct wall panel in universal local coordinates:
 *   x in [-span/2, +span/2], y in [-t, 0] (+Y = inner face), z in [-L/2, +L/2]
 * with smooth embossed straight 210 mm ribs bulging outward (-Y) and clean
 * technical zone strips along interior 90° bends (Green Zone 3) or welded edges (Zone 4).
 */
function buildWallPanelGeometry(
  span: number,
  L: number,
  t: number,
  ribZPositions: number[],
  leftEdgeZone: ExtendedMaterialZone | null,
  rightEdgeZone: ExtendedMaterialZone | null
): THREE.BufferGeometry {
  const zoneBuffers = createEmptyZoneBuffers();
  const halfS = span / 2;
  const halfL = L / 2;
  const uvScale = 1 / 280;
  const hasRibs = ribZPositions.length > 0;

  // Build X breakpoints: subtle edge color strip (3.5 mm) + rib fade ramp
  const edgeStrip = Math.min(3.5, span * 0.08);
  const ribMargin = Math.min(26, span * 0.12);
  const ribRamp = Math.min(18, span * 0.08);

  const rawXs: number[] = [-halfS, halfS];
  if (leftEdgeZone !== null) rawXs.push(-halfS + edgeStrip);
  if (rightEdgeZone !== null) rawXs.push(halfS - edgeStrip);
  if (hasRibs) {
    rawXs.push(
      -halfS + ribMargin,
      -halfS + ribMargin + ribRamp * 0.5,
      -halfS + ribMargin + ribRamp,
      halfS - ribMargin - ribRamp,
      halfS - ribMargin - ribRamp * 0.5,
      halfS - ribMargin
    );
  }
  rawXs.sort((a, b) => a - b);
  const xBreaks: number[] = [];
  for (const x of rawXs) {
    if (xBreaks.length === 0 || x - xBreaks[xBreaks.length - 1] > 0.35) {
      xBreaks.push(x);
    }
  }
  if (xBreaks[xBreaks.length - 1] < halfS - 0.05) {
    xBreaks.push(halfS);
  }

  // Build Z slices around exact 210 mm straight ribs
  const ribHalfW = 7.2;
  const ribDepth = Math.max(1.25, Math.min(2.1, t * 1.9));
  const rawZs: number[] = [-halfL, halfL];
  for (const rz of ribZPositions) {
    rawZs.push(
      rz - ribHalfW,
      rz - ribHalfW * 0.52,
      rz,
      rz + ribHalfW * 0.52,
      rz + ribHalfW
    );
  }
  rawZs.sort((a, b) => a - b);
  const zBreaks: number[] = [];
  for (const z of rawZs) {
    if (z < -halfL - 1e-4 || z > halfL + 1e-4) continue;
    const clamped = Math.max(-halfL, Math.min(halfL, z));
    if (zBreaks.length === 0 || clamped - zBreaks[zBreaks.length - 1] > 0.25) {
      zBreaks.push(clamped);
    }
  }
  if (zBreaks[zBreaks.length - 1] < halfL - 0.05) zBreaks.push(halfL);

  const evalRibDispY = (x: number, z: number): number => {
    if (!hasRibs) return 0;
    const s = x + halfS;
    const fadeL = smoothstep(ribMargin, ribMargin + ribRamp, s);
    const fadeR = smoothstep(ribMargin, ribMargin + ribRamp, span - s);
    const xFade = fadeL * fadeR;
    if (xFade <= 1e-4) return 0;
    let maxBump = 0;
    for (const rz of ribZPositions) {
      const dz = Math.abs(z - rz);
      if (dz < ribHalfW) {
        const w = 0.5 * (1 + Math.cos((Math.PI * dz) / ribHalfW));
        if (w > maxBump) maxBump = w;
      }
    }
    // Bulge OUTWARD (-Y in universal local frame)
    return -maxBump * xFade * ribDepth;
  };

  for (let ix = 0; ix < xBreaks.length - 1; ix++) {
    const x0 = xBreaks[ix];
    const x1 = xBreaks[ix + 1];
    const xMid = (x0 + x1) * 0.5;
    let zone: ExtendedMaterialZone = 0;
    if (leftEdgeZone !== null && xMid < -halfS + edgeStrip + 0.1) zone = leftEdgeZone;
    else if (rightEdgeZone !== null && xMid > halfS - edgeStrip - 0.1) zone = rightEdgeZone;
    const buf = zoneBuffers[zone];
    const u0 = (x0 + halfS) * uvScale;
    const u1 = (x1 + halfS) * uvScale;

    for (let iz = 0; iz < zBreaks.length - 1; iz++) {
      const z0 = zBreaks[iz];
      const z1 = zBreaks[iz + 1];
      const v0 = (z0 + halfL) * uvScale;
      const v1 = (z1 + halfL) * uvScale;

      const d00 = evalRibDispY(x0, z0);
      const d10 = evalRibDispY(x1, z0);
      const d11 = evalRibDispY(x1, z1);
      const d01 = evalRibDispY(x0, z1);

      // Inner face (+Y normal): (x0,z0)->(x0,z1)->(x1,z1)->(x1,z0)
      pushQuad(
        buf,
        [x0, d00, z0], [u0, v0],
        [x0, d01, z1], [u0, v1],
        [x1, d11, z1], [u1, v1],
        [x1, d10, z0], [u1, v0]
      );

      // Outer face (-Y normal): (x0,z0)->(x1,z0)->(x1,z1)->(x0,z1)
      pushQuad(
        buf,
        [x0, -t + d00, z0], [u0, v0],
        [x1, -t + d10, z0], [u1, v0],
        [x1, -t + d11, z1], [u1, v1],
        [x0, -t + d01, z1], [u0, v1]
      );
    }

    // Front (+Z) thickness cap
    pushQuad(
      buf,
      [x0, -t, halfL], [u0, 0],
      [x1, -t, halfL], [u1, 0],
      [x1, 0, halfL], [u1, t * uvScale],
      [x0, 0, halfL], [u0, t * uvScale]
    );
    // Back (-Z) thickness cap
    pushQuad(
      buf,
      [x0, -t, -halfL], [u0, 0],
      [x0, 0, -halfL], [u0, t * uvScale],
      [x1, 0, -halfL], [u1, t * uvScale],
      [x1, -t, -halfL], [u1, 0]
    );
  }

  // Left (-X) & Right (+X) thickness caps
  const leftBuf = zoneBuffers[leftEdgeZone ?? 0];
  const rightBuf = zoneBuffers[rightEdgeZone ?? 0];
  pushQuad(
    leftBuf,
    [-halfS, -t, -halfL], [0, 0],
    [-halfS, -t, halfL], [0, L * uvScale],
    [-halfS, 0, halfL], [t * uvScale, L * uvScale],
    [-halfS, 0, -halfL], [t * uvScale, 0]
  );
  pushQuad(
    rightBuf,
    [halfS, -t, -halfL], [0, 0],
    [halfS, 0, -halfL], [t * uvScale, 0],
    [halfS, 0, halfL], [t * uvScale, L * uvScale],
    [halfS, -t, halfL], [0, L * uvScale]
  );

  return finalizeZoneGeometry(zoneBuffers);
}

/**
 * Builds a watertight thick sheet-metal strip extending along `endSign * Z` from `0` to `lenMm`,
 * centered on y in [-t/2, +t/2], spanning `x in [x0, x1]`.
 * Supports:
 * - Optional 45° corner miters at free tip (`miterStartMm`, `miterEndMm`)
 * - Authentic TDC mid-face stepped longitudinal stiffener ridge (`tdcRibRidge`, per tdc_tdf_chưa_gò_ke_góc.jpg)
 * - Authentic TDF small triangular V-indent on the SIDE edges of the flange tab (`sideVIndent`, per Bích_TDF_trên_bản_vẽ_với_vết_v_lõm.png)
 */
function buildAxialStripGeometry(
  x0: number,
  x1: number,
  lenMm: number,
  t: number,
  endSign: 1 | -1,
  zone: ExtendedMaterialZone,
  opts?: {
    miterStartMm?: number;
    miterEndMm?: number;
    sideVIndent?: boolean;
    tdcRibRidge?: boolean;
  }
): THREE.BufferGeometry {
  const zoneBuffers = createEmptyZoneBuffers();
  const buf = zoneBuffers[zone];
  const halfT = t * 0.5;
  const uvScale = 1 / 280;
  const zA = 0;
  const zB = endSign * lenMm;
  const zMin = Math.min(zA, zB);
  const zMax = Math.max(zA, zB);
  const mS = Math.max(0, Math.min(opts?.miterStartMm ?? 0, (x1 - x0) * 0.42));
  const mE = Math.max(0, Math.min(opts?.miterEndMm ?? 0, (x1 - x0) * 0.42));
  const useMultiSlice = Boolean(opts?.tdcRibRidge || opts?.sideVIndent);

  if (!useMultiSlice) {
    // Corner coordinates at root (z = 0) vs free tip (z = endSign * lenMm)
    const rX0 = x0;
    const rX1 = x1;
    const tX0 = x0 + mS;
    const tX1 = x1 - mE;

    // Map (root vs tip) cleanly to zMin/zMax so outward normals are always strictly right-handed
    const xMin0 = endSign === 1 ? rX0 : tX0;
    const xMin1 = endSign === 1 ? rX1 : tX1;
    const xMax0 = endSign === 1 ? tX0 : rX0;
    const xMax1 = endSign === 1 ? tX1 : rX1;

    const u0 = 0;
    const u1 = (x1 - x0) * uvScale;
    const v0 = 0;
    const v1 = lenMm * uvScale;

    // +Y face
    pushQuad(
      buf,
      [xMin0, halfT, zMin], [u0, v0],
      [xMax0, halfT, zMax], [u0, v1],
      [xMax1, halfT, zMax], [u1, v1],
      [xMin1, halfT, zMin], [u1, v0]
    );
    // -Y face
    pushQuad(
      buf,
      [xMin0, -halfT, zMin], [u0, v0],
      [xMin1, -halfT, zMin], [u1, v0],
      [xMax1, -halfT, zMax], [u1, v1],
      [xMax0, -halfT, zMax], [u0, v1]
    );
    // zMax cap (+Z)
    pushQuad(
      buf,
      [xMax0, -halfT, zMax], [u0, 0],
      [xMax1, -halfT, zMax], [u1, 0],
      [xMax1, halfT, zMax], [u1, t * uvScale],
      [xMax0, halfT, zMax], [u0, t * uvScale]
    );
    // zMin cap (-Z)
    pushQuad(
      buf,
      [xMin0, -halfT, zMin], [u0, 0],
      [xMin0, halfT, zMin], [u0, t * uvScale],
      [xMin1, halfT, zMin], [u1, t * uvScale],
      [xMin1, -halfT, zMin], [u1, 0]
    );
    // -X bevel/side cap
    pushQuad(
      buf,
      [xMin0, -halfT, zMin], [0, v0],
      [xMax0, -halfT, zMax], [0, v1],
      [xMax0, halfT, zMax], [t * uvScale, v1],
      [xMin0, halfT, zMin], [t * uvScale, v0]
    );
    // +X bevel/side cap
    pushQuad(
      buf,
      [xMin1, -halfT, zMin], [0, v0],
      [xMin1, halfT, zMin], [t * uvScale, v0],
      [xMax1, halfT, zMax], [t * uvScale, v1],
      [xMax1, -halfT, zMax], [0, v1]
    );
  } else {
    // Sliced along `s in [0, lenMm]` to sculpt the TDC mid-face stepped rib ridge
    // AND optional TDF triangular V-indent on the side edges of the flange tab.
    const sSet = new Set<number>([0, lenMm]);
    if (opts?.tdcRibRidge && lenMm >= 22) {
      sSet.add(lenMm * 0.42);
      sSet.add(lenMm * 0.50);
      sSet.add(lenMm * 0.62);
      sSet.add(lenMm * 0.70);
    }
    const vCenterS = lenMm * 0.66;
    const vHalfS = 3.2;
    const vDepth = Math.min(3.0, (x1 - x0) * 0.08);
    if (opts?.sideVIndent && lenMm >= 18 && x1 - x0 >= 50) {
      sSet.add(Math.max(2, vCenterS - vHalfS));
      sSet.add(vCenterS);
      sSet.add(Math.min(lenMm - 2, vCenterS + vHalfS));
    }
    const sVals = Array.from(sSet).sort((a, b) => a - b);

    // Evaluate subtle stepped ridge offset along Y (in local frame, -Y points forward out of flange face once rotated 90°)
    const evalYOff = (s: number): number => {
      if (!opts?.tdcRibRidge || lenMm < 22) return 0;
      const a0 = lenMm * 0.42;
      const a1 = lenMm * 0.50;
      const b0 = lenMm * 0.62;
      const b1 = lenMm * 0.70;
      const ridgeH = 1.15;
      if (s <= a0 || s >= b1) return 0;
      if (s < a1) return ridgeH * ((s - a0) / (a1 - a0));
      if (s <= b0) return ridgeH;
      return ridgeH * (1 - (s - b0) / (b1 - b0));
    };

    const evalSideInset = (s: number): number => {
      if (!opts?.sideVIndent || lenMm < 18 || x1 - x0 < 50) return 0;
      const ds = Math.abs(s - vCenterS);
      if (ds >= vHalfS) return 0;
      return vDepth * (1 - ds / vHalfS);
    };

    const slices = sVals.map((s) => {
      const ins = evalSideInset(s);
      return {
        s,
        z: endSign * s,
        yOff: evalYOff(s),
        xl: x0 + ins,
        xr: x1 - ins,
      };
    });
    // Sort strictly by ascending Z so outward normals are always right-handed!
    if (endSign === -1) slices.reverse();

    for (let i = 0; i < slices.length - 1; i++) {
      const a = slices[i];
      const b = slices[i + 1];
      const u0 = 0;
      const u1 = (x1 - x0) * uvScale;
      const v0 = a.s * uvScale;
      const v1 = b.s * uvScale;

      // +Y face
      pushQuad(
        buf,
        [a.xl, halfT + a.yOff, a.z], [u0, v0],
        [b.xl, halfT + b.yOff, b.z], [u0, v1],
        [b.xr, halfT + b.yOff, b.z], [u1, v1],
        [a.xr, halfT + a.yOff, a.z], [u1, v0]
      );
      // -Y face
      pushQuad(
        buf,
        [a.xl, -halfT + a.yOff, a.z], [u0, v0],
        [a.xr, -halfT + a.yOff, a.z], [u1, v0],
        [b.xr, -halfT + b.yOff, b.z], [u1, v1],
        [b.xl, -halfT + b.yOff, b.z], [u0, v1]
      );
      // -X side cap
      pushQuad(
        buf,
        [a.xl, -halfT + a.yOff, a.z], [0, v0],
        [b.xl, -halfT + b.yOff, b.z], [0, v1],
        [b.xl, halfT + b.yOff, b.z], [t * uvScale, v1],
        [a.xl, halfT + a.yOff, a.z], [t * uvScale, v0]
      );
      // +X side cap
      pushQuad(
        buf,
        [a.xr, -halfT + a.yOff, a.z], [0, v0],
        [a.xr, halfT + a.yOff, a.z], [t * uvScale, v0],
        [b.xr, halfT + b.yOff, b.z], [t * uvScale, v1],
        [b.xr, -halfT + b.yOff, b.z], [0, v1]
      );
    }

    const first = slices[0];
    const last = slices[slices.length - 1];
    // zMin cap (-Z)
    pushQuad(
      buf,
      [first.xl, -halfT + first.yOff, first.z], [0, 0],
      [first.xl, halfT + first.yOff, first.z], [0, t * uvScale],
      [first.xr, halfT + first.yOff, first.z], [(x1 - x0) * uvScale, t * uvScale],
      [first.xr, -halfT + first.yOff, first.z], [(x1 - x0) * uvScale, 0]
    );
    // zMax cap (+Z)
    pushQuad(
      buf,
      [last.xl, -halfT + last.yOff, last.z], [0, 0],
      [last.xr, -halfT + last.yOff, last.z], [(x1 - x0) * uvScale, 0],
      [last.xr, halfT + last.yOff, last.z], [(x1 - x0) * uvScale, t * uvScale],
      [last.xl, halfT + last.yOff, last.z], [0, t * uvScale]
    );
  }

  return finalizeZoneGeometry(zoneBuffers);
}

/**
 * Builds a watertight thick longitudinal seam strip extending along `side * X` from `0` to `lenMm`,
 * spanning `z in [-L/2, +L/2]`, y in [-t/2, +t/2], with optional 45° end chamfers at the free tip
 * (for Male +7 mm Pittsburgh lip).
 */
function buildSeamStripGeometry(
  lenMm: number,
  L: number,
  t: number,
  side: -1 | 1,
  zone: ExtendedMaterialZone,
  chamferTipZMm = 0
): THREE.BufferGeometry {
  const zoneBuffers = createEmptyZoneBuffers();
  const buf = zoneBuffers[zone];
  const halfT = t * 0.5;
  const halfL = L * 0.5;
  const uvScale = 1 / 280;
  const ch = Math.max(0, Math.min(chamferTipZMm, halfL * 0.65));

  const xA = 0;
  const xB = side * lenMm;
  const xMin = Math.min(xA, xB);
  const xMax = Math.max(xA, xB);

  const zMinA = side === 1 ? -halfL : -halfL + ch;
  const zMaxA = side === 1 ? halfL : halfL - ch;
  const zMinB = side === 1 ? -halfL + ch : -halfL;
  const zMaxB = side === 1 ? halfL - ch : halfL;

  const u0 = 0;
  const u1 = lenMm * uvScale;
  const v0 = 0;
  const v1 = L * uvScale;

  // +Y face
  pushQuad(
    buf,
    [xMin, halfT, zMinA], [u0, v0],
    [xMin, halfT, zMaxA], [u0, v1],
    [xMax, halfT, zMaxB], [u1, v1],
    [xMax, halfT, zMinB], [u1, v0]
  );
  // -Y face
  pushQuad(
    buf,
    [xMin, -halfT, zMinA], [u0, v0],
    [xMax, -halfT, zMinB], [u1, v0],
    [xMax, -halfT, zMaxB], [u1, v1],
    [xMin, -halfT, zMaxA], [u0, v1]
  );
  // +Z cap
  pushQuad(
    buf,
    [xMin, -halfT, zMaxA], [u0, 0],
    [xMax, -halfT, zMaxB], [u1, 0],
    [xMax, halfT, zMaxB], [u1, t * uvScale],
    [xMin, halfT, zMaxA], [u0, t * uvScale]
  );
  // -Z cap
  pushQuad(
    buf,
    [xMin, -halfT, zMinA], [u0, 0],
    [xMin, halfT, zMinA], [u0, t * uvScale],
    [xMax, halfT, zMinB], [u1, t * uvScale],
    [xMax, -halfT, zMinB], [u1, 0]
  );
  // -X cap
  pushQuad(
    buf,
    [xMin, -halfT, zMinA], [0, v0],
    [xMin, -halfT, zMaxA], [0, v1],
    [xMin, halfT, zMaxA], [t * uvScale, v1],
    [xMin, halfT, zMinA], [t * uvScale, v0]
  );
  // +X cap
  pushQuad(
    buf,
    [xMax, -halfT, zMinB], [0, v0],
    [xMax, halfT, zMinB], [t * uvScale, v0],
    [xMax, halfT, zMaxB], [t * uvScale, v1],
    [xMax, -halfT, zMaxB], [0, v1]
  );

  return finalizeZoneGeometry(zoneBuffers);
}

function makeHingeNode(
  id: string,
  pivotMm: [number, number, number],
  axis: 'x' | 'z',
  foldedAngleRad: number,
  geometry: THREE.BufferGeometry,
  children: HingeSegmentNode[] = [],
  usesSeamLock = false,
  tag?: { endKey?: 'c1' | 'c2'; cornerId?: CornerId }
): HingeSegmentNode {
  return {
    id,
    endKey: tag?.endKey,
    cornerId: tag?.cornerId,
    pivotM: [pivotMm[0] * MM_TO_M, pivotMm[1] * MM_TO_M, pivotMm[2] * MM_TO_M],
    axis,
    foldedAngleRad,
    usesSeamLock,
    geometry,
    edgesGeometry: new THREE.EdgesGeometry(geometry, 22),
    children,
  };
}

// ---------------------------------------------------------------------------
// 2. Articulated Longitudinal Seam & Integral End Flange Chains per Wall
// ---------------------------------------------------------------------------

function buildWallSeamHinge(
  wallId: string,
  seam: ResolvedCornerSeam,
  wall: WallId,
  side: -1 | 1,
  span: number,
  L: number,
  t: number
): HingeSegmentNode | null {
  const halfS = span / 2;
  const gap = Math.max(0.24, t * 0.28);
  const isFemale = seam.femaleWall === wall;
  const prefix = `${wallId}-seam-${side === -1 ? 'L' : 'R'}`;
  const seamTag = { cornerId: seam.cornerId };

  if (seam.seamType === 'pittsburgh') {
    if (isFemale) {
      // Authentic 5-segment articulated Mí kép (+31 mm) U-pocket that unrolls completely flat!
      const l1 = t + gap; // ~1.0–2.0 mm outward step
      const l2 = 9.0; // inner pocket wall back along exterior
      const l3 = 2 * t + 2 * gap; // U-turn spacer outward
      const l4 = 10.5; // outer pocket wall forward to corner
      const l5 = 8.5; // hammer-over lock tab (rotates with seamLockProgress!)

      const h5 = makeHingeNode(
        `${prefix}-p5`,
        [side * l4, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(l5, L, t, side, 1, 0),
        [],
        true,
        seamTag
      );
      const h4 = makeHingeNode(
        `${prefix}-p4`,
        [side * l3, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(l4, L, t, side, 1, 0),
        [h5],
        false,
        seamTag
      );
      const h3 = makeHingeNode(
        `${prefix}-p3`,
        [side * l2, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(l3, L, t, side, 1, 0),
        [h4],
        false,
        seamTag
      );
      const h2 = makeHingeNode(
        `${prefix}-p2`,
        [side * l1, 0, 0],
        'z',
        -side * (Math.PI / 2),
        buildSeamStripGeometry(l2, L, t, side, 1, 0),
        [h3],
        false,
        seamTag
      );
      return makeHingeNode(
        `${prefix}-p1`,
        [side * (halfS - gap - 0.5 * t), -0.5 * t, 0],
        'z',
        -side * (Math.PI / 2),
        buildSeamStripGeometry(l1, L, t, side, 1, 0),
        [h2],
        false,
        seamTag
      );
    } else {
      // Authentic Mí đơn (+7 mm, Blue Zone 2) with 45° beveled ends, bends 90° INWARD (+Y)
      const neck = 2 * t + 2 * gap;
      const lipLen = 7.0;
      const chamfer = Math.min(7.0, L * 0.38);

      const hLip = makeHingeNode(
        `${prefix}-mLip`,
        [side * neck, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(lipLen, L, t, side, 2, chamfer),
        [],
        false,
        seamTag
      );
      return makeHingeNode(
        `${prefix}-mNeck`,
        [side * halfS, -0.5 * t, 0],
        'z',
        0,
        buildSeamStripGeometry(neck, L, t, side, 2, 0),
        [hLip],
        false,
        seamTag
      );
    }
  }

  if (seam.seamType === 'weld_overlap' && isFemale) {
    const lapW = Math.max(7, Math.min(25, seam.weldOverlapWidth));
    const neck = t + gap;
    const hFlap = makeHingeNode(
      `${prefix}-wFlap`,
      [side * neck, 0, 0],
      'z',
      side * (Math.PI / 2),
      buildSeamStripGeometry(lapW, L, t, side, 4, 0),
      [],
      false,
      seamTag
    );
    return makeHingeNode(
      `${prefix}-wNeck`,
      [side * halfS, -0.5 * t, 0],
      'z',
      0,
      buildSeamStripGeometry(neck, L, t, side, 4, 0),
      [hFlap],
      false,
      seamTag
    );
  }

  return null;
}

function buildWallEndFlangeHinge(
  wallId: string,
  wall: WallId,
  endKey: 'c1' | 'c2',
  endSign: 1 | -1,
  conn: EndConnectionConfig,
  W: number,
  H: number,
  L: number,
  t: number
): HingeSegmentNode | null {
  if (conn.type === 'bich_v_in' || conn.type === 'bich_u') return null;
  const span = getWallLength(wall, W, H);
  const halfS = span / 2;
  const gap = Math.max(0.24, t * 0.28);
  const prefix = `${wallId}-${endKey}`;
  const endTag = { endKey };

  // 1. Bích TDC/TDF (+48 mm: 31.5 stepped face + 9.2 top + 7.3 rear return + 2.5 J-hook curl; tight 2 mm corner gap per REF_NOTES.md #7-#8)
  if (conn.type === 'tdc_tdf') {
    const trim = Math.max(1.0, t * 0.5 + 0.5); // ~1 mm each side => ~2 mm clean corner gap!
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 6) return null;

    const l1 = 31.5;
    const l2 = 9.2;
    const l3 = 7.3;
    const l4 = 2.6;

    const h4 = makeHingeNode(
      `${prefix}-tdc4`,
      [0, 0, endSign * l3],
      'x',
      endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, l4, t, endSign, 5),
      [],
      false,
      endTag
    );
    const h3 = makeHingeNode(
      `${prefix}-tdc3`,
      [0, 0, endSign * l2],
      'x',
      endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, l3, t, endSign, 5),
      [h4],
      false,
      endTag
    );
    const h2 = makeHingeNode(
      `${prefix}-tdc2`,
      [0, 0, endSign * l1],
      'x',
      endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, l2, t, endSign, 5),
      [h3],
      false,
      endTag
    );
    return makeHingeNode(
      `${prefix}-tdc1`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, l1, t, endSign, 5, {
        tdcRibRidge: true,
        sideVIndent: conn.showEndIndent,
      }),
      [h2],
      false,
      endTag
    );
  }

  // 2. Nẹp C liền thân (+12.5 mm, 180° curl hugging exterior, corner-to-corner ~1.2-2.0 mm gap)
  if (conn.type === 'nep_c') {
    const cornerClear = Math.max(1.2, Math.min(2.0, t + 0.6));
    const x0 = -halfS + cornerClear;
    const x1 = halfS - cornerClear;
    if (x1 - x0 < 6) return null;

    const arcSeg = 2.0;
    const returnLen = 6.5; // 2 + 2 + 2 + 6.5 = 12.5 mm flat!

    const h4 = makeHingeNode(
      `${prefix}-nc4`,
      [0, 0, endSign * arcSeg],
      'x',
      endSign * (Math.PI / 3),
      buildAxialStripGeometry(x0, x1, returnLen, t, endSign, 5),
      [],
      false,
      endTag
    );
    const h3 = makeHingeNode(
      `${prefix}-nc3`,
      [0, 0, endSign * arcSeg],
      'x',
      endSign * (Math.PI / 3),
      buildAxialStripGeometry(x0, x1, arcSeg, t, endSign, 5),
      [h4],
      false,
      endTag
    );
    const h2 = makeHingeNode(
      `${prefix}-nc2`,
      [0, 0, endSign * arcSeg],
      'x',
      endSign * (Math.PI / 3),
      buildAxialStripGeometry(x0, x1, arcSeg, t, endSign, 5),
      [h3],
      false,
      endTag
    );
    return makeHingeNode(
      `${prefix}-nc1`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      0,
      buildAxialStripGeometry(x0, x1, arcSeg, t, endSign, 5),
      [h2],
      false,
      endTag
    );
  }

  // 3. Bích V quay ngoài ống thường (V30/40/50): mép lật +8 mm quay ngoài
  if (conn.type === 'bich_v_out' && bichVHasTurnedLip(conn)) {
    const trim = t + gap + 1.0;
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 6) return null;

    return makeHingeNode(
      `${prefix}-bvLip`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, 8.0, t, endSign, 5),
      [],
      false,
      endTag
    );
  }

  // 4. Để thẳng có đoạn kéo dài (+L_thẳng trơn, KHÔNG chạy mí)
  if (conn.type === 'plain' && conn.plainExtensionMm > 0) {
    const ext = Math.max(0, Math.min(300, conn.plainExtensionMm));
    const isHoriz = wall === 'top' || wall === 'bottom';
    const trim = isHoriz ? -t : gap * 0.4;
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    return makeHingeNode(
      `${prefix}-plainExt`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      0, // Always straight! Moves solidly with wall panel!
      buildAxialStripGeometry(x0, x1, ext, t, endSign, 5),
      [],
      false,
      endTag
    );
  }

  // 5. Đầu bẻ chân tùy biến từng cạnh (Bẻ vào / Bẻ ra / Để thẳng)
  if (conn.type === 'be_chan') {
    const mode = conn.beChanEdges[wall];
    if (mode === 'straight') return null;
    const F = Math.max(5, Math.min(100, conn.beChanWidth));
    if (mode === 'out') {
      const trim = t + gap;
      const x0 = -halfS + trim;
      const x1 = halfS - trim;
      if (x1 - x0 < 4) return null;
      return makeHingeNode(
        `${prefix}-bcOut`,
        [0, -0.5 * t, endSign * (L / 2)],
        'x',
        endSign * (Math.PI / 2),
        buildAxialStripGeometry(x0, x1, F, t, endSign, 5),
        [],
        false,
        endTag
      );
    }
    // Bẻ vào trong: ghép vuông đối đầu chuẩn xưởng (REF_NOTES.md #34–#35: bẻ_chân_vào_trong_1.jpg)!
    // Cạnh Trên & Dưới chạy phủ sát góc; cạnh Trái & Phải cắt vuông lọt lòng trừ F tại góc giao với cạnh cũng Bẻ vào.
    const fEff = Math.min(F, Math.min(W, H) * 0.42);
    const isHoriz = wall === 'top' || wall === 'bottom';
    const leftAdj = getAdjacentWallOnSide(wall, -1);
    const rightAdj = getAdjacentWallOnSide(wall, 1);
    const trimL = !isHoriz && conn.beChanEdges[leftAdj] === 'in' ? fEff + gap : gap * 0.8;
    const trimR = !isHoriz && conn.beChanEdges[rightAdj] === 'in' ? fEff + gap : gap * 0.8;
    const x0 = -halfS + trimL;
    const x1 = halfS - trimR;
    if (x1 - x0 < 4) return null;
    return makeHingeNode(
      `${prefix}-bcIn`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      -endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, fEff, t, endSign, 5),
      [],
      false,
      endTag
    );
  }

  // 6. Đầu gắn LCCT (+20 mm chấn vào trong, vát 45° cả 2 góc)
  if (conn.type === 'lcct') {
    const fEff = Math.min(20.0, Math.min(W, H) * 0.42);
    const trim = gap * 0.6;
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 4) return null;
    return makeHingeNode(
      `${prefix}-lcct`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      -endSign * (Math.PI / 2),
      buildAxialStripGeometry(x0, x1, fEff, t, endSign, 5, {
        miterStartMm: fEff,
        miterEndMm: fEff,
      }),
      [],
      false,
      endTag
    );
  }

  // 7. Đầu bịt kín (Mí kép chờ +31 mm hoặc Hàn +0 mm)
  if (conn.type === 'end_cap') {
    const edgeSeam = getEndCapEdgeSeam(conn, wall);
    const trim = t + gap + 1.0;
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 6) return null;

    if (edgeSeam === 'pittsburgh') {
      const l1 = t + gap;
      const l2 = 9.0;
      const l3 = 2 * t + 2 * gap;
      const l4 = 10.5;
      const l5 = 8.5;

      const h5 = makeHingeNode(
        `${prefix}-cap5`,
        [0, 0, endSign * l4],
        'x',
        -endSign * (Math.PI / 2),
        buildAxialStripGeometry(x0, x1, l5, t, endSign, 1),
        [],
        true,
        endTag
      );
      const h4 = makeHingeNode(
        `${prefix}-cap4`,
        [0, 0, endSign * l3],
        'x',
        -endSign * (Math.PI / 2),
        buildAxialStripGeometry(x0, x1, l4, t, endSign, 1),
        [h5],
        false,
        endTag
      );
      const h3 = makeHingeNode(
        `${prefix}-cap3`,
        [0, 0, endSign * l2],
        'x',
        -endSign * (Math.PI / 2),
        buildAxialStripGeometry(x0, x1, l3, t, endSign, 1),
        [h4],
        false,
        endTag
      );
      const h2 = makeHingeNode(
        `${prefix}-cap2`,
        [0, 0, endSign * l1],
        'x',
        endSign * (Math.PI / 2),
        buildAxialStripGeometry(x0, x1, l2, t, endSign, 1),
        [h3],
        false,
        endTag
      );
      return makeHingeNode(
        `${prefix}-cap1`,
        [0, -0.5 * t, endSign * (L / 2 - gap - 0.5 * t)],
        'x',
        endSign * (Math.PI / 2),
        buildAxialStripGeometry(x0, x1, l1, t, endSign, 1),
        [h2],
        false,
        endTag
      );
    }

    // Welded edge indicator strip (Zone 4 Amber, 0 mm extra blank)
    return makeHingeNode(
      `${prefix}-capWeld`,
      [0, -t - 0.08, endSign * (L / 2)],
      'x',
      0,
      buildAxialStripGeometry(x0, x1, 3.2, 0.16, -endSign as 1 | -1, 4),
      [],
      false,
      endTag
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// 3. Wall Tree Construction per Piece Topology
// ---------------------------------------------------------------------------

function buildWallNode(
  pieceId: string,
  partCode: string,
  wall: WallId,
  hingeSideFromParent: -1 | 0 | 1,
  parentSpanMm: number,
  isStartWall: boolean,
  isEndWall: boolean,
  seamMap: Map<CornerId, ResolvedCornerSeam>,
  config: DuctConfig,
  ribZPositions: number[],
  childWalls: WallRigNode[]
): WallRigNode {
  const { W, H, L, thickness: t, c1, c2 } = config;
  const span = getWallLength(wall, W, H);
  const wallId = `${pieceId}-${wall}`;
  const corners = getWallCorners(wall);

  const startSeam = isStartWall ? seamMap.get(corners.start) : undefined;
  const endSeam = isEndWall ? seamMap.get(corners.end) : undefined;

  // Determine edge technical color strip on the wall panel itself
  const leftEdgeZone: ExtendedMaterialZone | null = !isStartWall
    ? 3 // Interior 90° bend line (Green)
    : startSeam?.seamType === 'pittsburgh'
      ? startSeam.femaleWall === wall
        ? 1
        : 2
      : startSeam
        ? 4
        : null;

  const rightEdgeZone: ExtendedMaterialZone | null = !isEndWall
    ? 3 // Interior 90° bend line (Green)
    : endSeam?.seamType === 'pittsburgh'
      ? endSeam.femaleWall === wall
        ? 1
        : 2
      : endSeam
        ? 4
        : null;

  const geometry = buildWallPanelGeometry(span, L, t, ribZPositions, leftEdgeZone, rightEdgeZone);
  const edgesGeometry = new THREE.EdgesGeometry(geometry, 22);

  // Inner face label stamped cleanly at (0, +0.55 mm, labelZ) facing +Y (MẶT ĐÁNH DẤU!)
  let labelZ = 0;
  let baySpanZ = L - 24;
  if (ribZPositions.length > 0) {
    const lastRib = ribZPositions[ribZPositions.length - 1];
    const frontBay = L / 2 - lastRib;
    if (frontBay >= 85) {
      labelZ = lastRib + frontBay * 0.5;
      baySpanZ = frontBay - 24;
    } else if (ribZPositions.length >= 2) {
      const midIdx = Math.floor(ribZPositions.length / 2);
      labelZ = (ribZPositions[midIdx - 1] + ribZPositions[midIdx]) * 0.5;
      baySpanZ = ribZPositions[midIdx] - ribZPositions[midIdx - 1] - 24;
    }
  }

  const maxW = Math.min(span * 0.44, 175);
  const maxH = Math.min(baySpanZ * 0.62, 86);
  const labelW = Math.max(46, Math.min(maxW, maxH * 2.15));
  const labelH = Math.max(24, labelW * 0.46);

  const faceLabel: BuiltFaceLabel = {
    id: `${wallId}-lbl`,
    partCode,
    pieceId,
    position: [0, 0.55 * MM_TO_M, labelZ * MM_TO_M],
    rotation: [-Math.PI / 2, 0, 0], // PlaneGeometry +Z normal rotated -90° around X -> points +Y (inward!)
    sizeM: [labelW * MM_TO_M, labelH * MM_TO_M],
  };

  // Attach articulated seams & end flanges
  const flangeHinges: HingeSegmentNode[] = [];
  if (startSeam) {
    const sh = buildWallSeamHinge(wallId, startSeam, wall, -1, span, L, t);
    if (sh) flangeHinges.push(sh);
  }
  if (endSeam) {
    const eh = buildWallSeamHinge(wallId, endSeam, wall, 1, span, L, t);
    if (eh) flangeHinges.push(eh);
  }
  const c1Hinge = buildWallEndFlangeHinge(wallId, wall, 'c1', 1, c1, W, H, L, t);
  if (c1Hinge) flangeHinges.push(c1Hinge);
  const c2Hinge = buildWallEndFlangeHinge(wallId, wall, 'c2', -1, c2, W, H, L, t);
  if (c2Hinge) flangeHinges.push(c2Hinge);

  return {
    id: wallId,
    wall,
    spanMm: span,
    hingeSideFromParent,
    parentSpanMm,
    geometry,
    edgesGeometry,
    faceLabel,
    flangeHinges,
    childWalls,
  };
}

function buildPieceRig(
  topo: { id: string; partCode: string; name: string; walls: WallId[]; startCorner: CornerId; endCorner: CornerId },
  seamMap: Map<CornerId, ResolvedCornerSeam>,
  config: DuctConfig,
  ribZPositions: number[]
): PieceRig {
  const { W, H } = config;
  const ws = topo.walls;
  // Choose anchor wall: prefer 'bottom' whenever present so the flat sheet opens directly onto y=0
  const rootIdx = ws.includes('bottom') ? ws.indexOf('bottom') : 0;

  // Recursive helper expanding CW (idx - 1, side = -1) or CCW (idx + 1, side = +1) along topo.walls
  const buildChain = (idx: number, hingeSide: -1 | 0 | 1, parentSpan: number): WallRigNode => {
    const w = ws[idx];
    const span = getWallLength(w, W, H);
    const children: WallRigNode[] = [];

    // Expand backward toward idx - 1 (side = -1) if we are root or moving backward
    if ((hingeSide === 0 || hingeSide === -1) && idx > 0) {
      children.push(buildChain(idx - 1, -1, span));
    }
    // Expand forward toward idx + 1 (side = +1) if we are root or moving forward
    if ((hingeSide === 0 || hingeSide === 1) && idx < ws.length - 1) {
      children.push(buildChain(idx + 1, 1, span));
    }

    return buildWallNode(
      topo.id,
      topo.partCode,
      w,
      hingeSide,
      parentSpan,
      idx === 0,
      idx === ws.length - 1,
      seamMap,
      config,
      ribZPositions,
      children
    );
  };

  return {
    id: topo.id,
    partCode: topo.partCode,
    name: topo.name,
    walls: ws,
    rootWall: buildChain(rootIdx, 0, 0),
  };
}

// ---------------------------------------------------------------------------
// 4. Weld Beads (shown only when tightly assembled, explode ~ 0 & unfold ~ 0)
// ---------------------------------------------------------------------------

function buildRigWeldBeads(
  seams: ResolvedCornerSeam[],
  W: number,
  H: number,
  L: number,
  t: number
): BuiltWeldBeadRig[] {
  const hw = W / 2;
  const hh = H / 2;
  const gap = Math.max(0.24, t * 0.28);
  const beads: BuiltWeldBeadRig[] = [];

  const cornerPos = (c: CornerId): [number, number] => {
    switch (c) {
      case 'TL': return [-hw, hh];
      case 'TR': return [hw, hh];
      case 'BR': return [hw, -hh];
      case 'BL': return [-hw, -hh];
    }
  };
  const outN = (w: WallId): [number, number] => {
    switch (w) {
      case 'bottom': return [0, -1];
      case 'right': return [1, 0];
      case 'top': return [0, 1];
      case 'left': return [-1, 0];
    }
  };

  for (const seam of seams) {
    if (seam.seamType === 'pittsburgh') continue;
    const [cx, cy] = cornerPos(seam.cornerId);
    const nF = outN(seam.femaleWall);
    const nM = outN(seam.maleWall);
    const radiusMm = Math.max(1.1, t * 1.15);

    let p: number;
    let q: number;
    if (seam.seamType === 'weld_overlap') {
      const lapW = Math.max(7, Math.min(25, seam.weldOverlapWidth));
      p = 0.5 * t - lapW - radiusMm * 0.45;
      q = t + gap + radiusMm * 0.45;
    } else {
      p = t + radiusMm * 0.15;
      q = t + radiusMm * 0.15;
    }

    const bx = cx + nF[0] * p + nM[0] * q;
    const by = cy + nF[1] * p + nM[1] * q;
    const geom = new THREE.CylinderGeometry(
      radiusMm * MM_TO_M,
      radiusMm * MM_TO_M,
      (L - 1.5) * MM_TO_M,
      8,
      1
    );
    geom.rotateX(Math.PI / 2);
    geom.translate(bx * MM_TO_M, by * MM_TO_M, 0);
    beads.push({ id: `weld-${seam.cornerId}`, cornerId: seam.cornerId, geometry: geom });
  }
  return beads;
}

// ---------------------------------------------------------------------------
// 5. Master Static Rig Builder (called ONLY on dimensional/structural edits!)
// ---------------------------------------------------------------------------

/**
 * Builds the complete static hierarchical pivot rig for 60fps 3D unfolding, exploding,
 * and seam locking. Rebuilding happens ONLY when dimensions/material/ends/split change —
 * dragging `Mở phôi 3D` or `Tách mảnh` performs ZERO geometry allocations.
 */
export function buildUnfoldableDuctRig(
  config: DuctConfig,
  ribPitchMm = 210
): UnfoldableDuctRig {
  const { W, H, L, thickness: t, splitMode, stiffenerRibs } = config;
  const topologies = getSplitTopologies(splitMode);
  const seams = resolveActiveSeams(config);
  const seamMap = new Map<CornerId, ResolvedCornerSeam>(seams.map((s) => [s.cornerId, s]));
  const ribLayout = computeRibLayout(L, stiffenerRibs, ribPitchMm);

  const pieces = topologies.map((topo) =>
    buildPieceRig(topo, seamMap, config, ribLayout.zPositionsMm)
  );

  const weldBeads = buildRigWeldBeads(seams, W, H, L, t);
  // Build accessories at baseline offset 0; live explode + 0-30% unfold retraction run in DuctAssembly!
  const accessories = buildAllEndAccessories(config, 1, 0, ribPitchMm);

  const trSeam = seamMap.get('TR') ?? seams[0];

  return {
    pieces,
    weldBeads,
    accessories,
    W,
    H,
    L,
    splitMode,
    topIsFemaleTR: trSeam ? trSeam.femaleWall === 'top' : true,
    trIsPittsburgh: trSeam ? trSeam.seamType === 'pittsburgh' : true,
  };
}

/** Disposes every GPU BufferGeometry & EdgesGeometry inside an UnfoldableDuctRig */
export function disposeUnfoldableDuctRig(rig: UnfoldableDuctRig): void {
  const disposeHinge = (h: HingeSegmentNode) => {
    h.geometry.dispose();
    h.edgesGeometry.dispose();
    h.children.forEach(disposeHinge);
  };
  const disposeWall = (w: WallRigNode) => {
    w.geometry.dispose();
    w.edgesGeometry.dispose();
    w.flangeHinges.forEach(disposeHinge);
    w.childWalls.forEach(disposeWall);
  };
  rig.pieces.forEach((p) => disposeWall(p.rootWall));
  rig.weldBeads.forEach((b) => b.geometry.dispose());
  rig.accessories.forEach((a) => {
    a.geometry.dispose();
    a.edgesGeometry?.dispose();
  });
}

// ---------------------------------------------------------------------------
// 6. Zero-Allocation Runtime Pose Evaluators (called at 60fps in useFrame / layout!)
// ---------------------------------------------------------------------------

/** Evaluates detached accessory retraction [0..1] during the 0% -> 30% unfold phase */
export function evaluateAccessoryRetractFactor(unfoldRatio: number): number {
  return smoothstep(0.0, 0.3, unfoldRatio);
}

/**
 * Evaluates live root position, root rotation, body bend fold factor, and detail flange/seam
 * fold factor for a piece — composing `unfoldRatio` (0..1), `explodeRatio` (0..1), and
 * `seamLockProgress` (0..1) cleanly without conflicts or mid-arc collisions.
 */
export function evaluatePieceRuntimePose(
  piece: PieceRig,
  rig: UnfoldableDuctRig,
  seamLockProgress: number,
  explodeRatio: number,
  unfoldRatio: number
): PiecePoseRuntime {
  const { W, H, splitMode, topIsFemaleTR, trIsPittsburgh } = rig;
  const rootWall = piece.rootWall.wall;
  const [baseX, baseY] = getBaseWallCenterMm(rootWall, W, H);
  const baseRotZ = getBaseWallRotZ(rootWall);

  // Smooth staging: accessories clear first (0..30%), walls & integral folds flatten over 6..100%
  const uBody = smoothstep(0.06, 1.0, unfoldRatio);
  const uDetail = smoothstep(0.12, 0.94, unfoldRatio);
  const unseamed = (1 - seamLockProgress) * (1 - uBody);

  const baseExplode = Math.max(85, Math.min(250, Math.max(W, H) * 0.28));
  // Keep explode active smoothly even during unfold (increases separation between unfolded pieces)
  let expX = 0;
  let expY = 0;

  if (splitMode === '2_piece_UI') {
    const uLift = trIsPittsburgh ? 13.5 : 8.5;
    if (piece.id === 'I') {
      expY = unseamed * uLift + explodeRatio * baseExplode * 1.1;
    } else {
      expY = -explodeRatio * baseExplode * 0.45;
    }
  } else if (splitMode === '2_piece_L') {
    const uHalf = trIsPittsburgh ? 6.8 : 4.2;
    const s1 = unseamed * uHalf + explodeRatio * baseExplode * 0.85;
    const s2 = Math.max(0, (explodeRatio - 0.1) / 0.9) * baseExplode * 0.65;
    if (topIsFemaleTR) {
      expX = piece.id === 'L1' ? -s1 : s1;
      expY = piece.id === 'L1' ? s2 : -s2;
    } else {
      expX = piece.id === 'L1' ? -s2 : s2;
      expY = piece.id === 'L1' ? s1 : -s1;
    }
  } else if (splitMode === '4_piece') {
    const uShift = trIsPittsburgh ? 13.5 : 8.5;
    const primary = unseamed * uShift + explodeRatio * baseExplode;
    const secondary = Math.max(0, (explodeRatio - 0.08) / 0.92) * baseExplode;
    if (topIsFemaleTR) {
      if (piece.id === 'L') expX = -primary;
      else if (piece.id === 'R') expX = primary;
      else if (piece.id === 'T') expY = secondary;
      else if (piece.id === 'B') expY = -secondary;
    } else {
      if (piece.id === 'T') expY = primary;
      else if (piece.id === 'B') expY = -primary;
      else if (piece.id === 'L') expX = -secondary;
      else if (piece.id === 'R') expX = secondary;
    }
  }

  // Target flat horizontal layout (uBody = 1): all inner faces pointing +Y UPWARD, centered around X=0, Y=0
  const flatGap = 135 + explodeRatio * 140;
  let flatX = 0;
  let flatY = 0;
  let arcX = 0;
  let arcY = 0;
  const arc = Math.sin(uBody * Math.PI);

  if (splitMode === '1_piece') {
    // At u=1, bottom is at X=0, left+top extend -(H+W) to left, right extends +H to right
    // -> sheet center is at -W/2, so shift root by +W/2 to center the flat sheet cleanly at X=0!
    flatX = W * 0.5;
    flatY = 0;
  } else if (splitMode === '2_piece_L') {
    // Both L1 (top+left) and L2 (bottom+right) have root spanning [-W/2, +W/2] and child spanning [+W/2, +W/2 + H]
    // Lay L1 on LEFT, L2 on RIGHT with clean `flatGap` between them, centered at X=0!
    const sep = Math.max(90, Math.min(200, Math.max(W, H) * 0.25));
    if (piece.id === 'L1') {
      flatX = -(flatGap * 0.5 + H + W * 0.5);
      flatY = 0;
      arcX = -arc * sep;
      arcY = arc * sep * 1.05;
    } else {
      flatX = flatGap * 0.5 + W * 0.5;
      flatY = 0;
      arcX = arc * sep * 0.55;
      arcY = -arc * sep * 0.35;
    }
  } else if (splitMode === '2_piece_UI') {
    // U (width W + 2H, centered on bottom root) on LEFT; I (width W) on RIGHT
    const totalW = W + 2 * H + flatGap + W;
    if (piece.id === 'U') {
      flatX = -totalW * 0.5 + H + W * 0.5;
      flatY = 0;
      arcY = -arc * Math.min(70, H * 0.22);
    } else {
      flatX = totalW * 0.5 - W * 0.5;
      flatY = 0;
      arcY = arc * Math.max(95, H * 0.65);
    }
  } else {
    // 4_piece: lay out cleanly Left -> Right in standard order: T (1-A) | L (1-C) | B (1-B) | R (1-D)
    const totalW = 2 * W + 2 * H + 3 * flatGap;
    const xT = -totalW * 0.5 + W * 0.5;
    const xL = xT + W * 0.5 + flatGap + H * 0.5;
    const xB = xL + H * 0.5 + flatGap + W * 0.5;
    const xR = xB + W * 0.5 + flatGap + H * 0.5;

    if (piece.id === 'T') {
      flatX = xT;
      arcY = arc * Math.max(100, H * 0.72);
    } else if (piece.id === 'L') {
      flatX = xL;
      arcX = -arc * 45;
    } else if (piece.id === 'B') {
      flatX = xB;
      arcY = -arc * 35;
    } else {
      flatX = xR;
      arcX = arc * 45;
    }
  }

  // Blend folded + explode position smoothly into flat layout + arc clearance
  const posX = (baseX + expX * (1 - uBody * 0.85)) * (1 - uBody) + flatX * uBody + arcX;
  const posY = (baseY + expY * (1 - uBody * 0.85)) * (1 - uBody) + flatY * uBody + arcY;
  const rotZ = baseRotZ * (1 - uBody);

  // Body bend fold factor: 1 at 0% (or gently opened by explode on 1_piece), 0 at 100%
  const singlePieceExplodeOpen = splitMode === '1_piece' ? explodeRatio * 0.14 : 0;
  const bodyFoldFactor = Math.max(0, (1 - uBody) * (1 - singlePieceExplodeOpen));
  const detailFoldFactor = Math.max(0, 1 - uDetail);

  return {
    positionM: [posX * MM_TO_M, posY * MM_TO_M, 0],
    rotZ,
    bodyFoldFactor,
    detailFoldFactor,
  };
}
