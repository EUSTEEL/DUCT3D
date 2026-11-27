import * as THREE from 'three';
import type {
  CornerId,
  DuctConfig,
  EdgeJoinMode,
  EndConnectionConfig,
  FaceId,
  FoldEdgeId,
  SplitMode,
  WallId,
} from '../types/duct';
import { computeRibLayout, getWallLength } from './ductRules';
import {
  buildAllEndAccessories,
  type BuiltAccessoryMesh,
  type BuiltFaceLabel,
  type ExtendedMaterialZone,
} from './endConnectionBuilder';
import { bichVHasTurnedLip, getEndCapEdgeSeam } from './endConnectionRules';
import {
  FOLD_EDGE_DEFS,
  getCapEdgeId,
  isBodyWall,
  resolveFoldGraph,
  type FaceTreeNode,
  type FoldComponent,
  type ResolvedFoldEdge,
  type ResolvedFoldGraph,
} from './foldGraph';

export const MM_TO_M = 0.001;
const MALE_BEVEL_RAD = (8 * Math.PI) / 180; // 8° gentle bevel (~0.98 mm on 7 mm width)
const NEP_C_CORNER_CHAMFER_MM = 3.5; // Item 2: 3–4 mm inward corner bevel on Nẹp C +12.5 mm tab

/**
 * Recursive articulated hinge node for integral sheet-metal folds
 * (Mí đơn +7, Mí kép +31 roll-formed lock, Hàn chập, TDC/TDF 3-fold C-box, Nẹp C 180° curl,
 * Bẻ chân, LCCT, Bích V +8 lip, Đầu bịt kín Mí kép chờ & merged cap lips).
 *
 * At runtime, dragging `Mở phôi 3D` ONLY updates `group.rotation` (ZERO geometry rebuilds!).
 */
export interface HingeSegmentNode {
  id: string;
  /** Interactive target tag when this hinge belongs to an integral end connection (C1 / C2) */
  endKey?: 'c1' | 'c2';
  /** Interactive target tag when this hinge belongs to a longitudinal seam (TR / TL / BR / BL) */
  cornerId?: CornerId;
  /** Interactive target tag when this hinge belongs to any FoldEdgeId (body or cap edge) */
  edgeId?: FoldEdgeId;
  /** Hinge pivot offset in parent's local frame (meters) */
  pivotM: [number, number, number];
  /** Hinge rotation axis in local frame ('x' for end flanges/cap top-bottom, 'z' for longitudinal seams/cap left-right) */
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
 * Articulated face panel inside a sheet-metal duct piece, expressed in the
 * universal right-handed face frame:
 *   +X = local horizontal span ([-dimX/2, +dimX/2])
 *   +Y = inward normal (MẶT ĐÁNH DẤU faces +Y at y = 0; outer face at y = -t)
 *   +Z = local depth span ([-dimZ/2, +dimZ/2])
 */
export interface WallRigNode {
  id: string;
  face: FaceId;
  /** Populated when face is a body wall */
  wall?: WallId;
  dimXMm: number;
  dimZMm: number;
  /** True for root face of piece */
  isRoot: boolean;
  /** Shared FoldEdgeId connecting this face to its parent (null for root) */
  viaEdgeId: FoldEdgeId | null;
  /** Hinge pivot offset inside parent face's local frame (meters) */
  hingePivotInParentM: [number, number, number];
  /** Hinge rotation axis in parent face's local frame */
  hingeAxis: 'x' | 'z';
  /** Folded rotation angle (radians, ±π/2) around hingeAxis at foldFactor = 1 */
  hingeFoldedAngleRad: number;
  /** Exact in-plane Y rotation aligning child's XZ axes with parent's unfolded XZ plane */
  flatRotYRad: number;
  /** Child face center offset from hinge in child's own local frame (meters) */
  childOffsetInLocalM: [number, number, number];
  geometry: THREE.BufferGeometry;
  edgesGeometry: THREE.EdgesGeometry;
  faceLabel: BuiltFaceLabel;
  /** Integral seams & end flanges attached as live rotating child hinges */
  flangeHinges: HingeSegmentNode[];
  /** Adjacent faces belonging to the same continuous sheet piece */
  childWalls: WallRigNode[];
}

export interface PieceRig {
  id: string;
  partCode: string;
  name: string;
  faces: FaceId[];
  walls: WallId[];
  isMergedTree: boolean;
  rootFace: FaceId;
  rootWall: WallRigNode;
  /** Folded root center (mm) & orientation quaternion */
  foldedCenterMm: [number, number, number];
  foldedQuat: [number, number, number, number];
  /** Unfolded flat sheet bounding box in rootFace's local XZ plane (mm) */
  flatBoundsLocalMm: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Target center X on the studio floor at unfold = 100% (mm, computed for non-overlapping layout) */
  flatLayoutCenterXMm: number;
  flatLayoutCenterZMm: number;
  /** Average outward explode direction in folded space */
  explodeDir: [number, number, number];
}

export interface BuiltWeldBeadRig {
  id: string;
  cornerId: CornerId;
  geometry: THREE.BufferGeometry;
}

export interface EdgeHitStrip3D {
  edgeId: FoldEdgeId;
  label: string;
  mode: EdgeJoinMode;
  kind: 'body' | 'cap_c1' | 'cap_c2';
  centerM: [number, number, number];
  rotation: [number, number, number];
  lengthM: number;
}

export interface UnfoldableDuctRig {
  pieces: PieceRig[];
  weldBeads: BuiltWeldBeadRig[];
  accessories: BuiltAccessoryMesh[];
  edgeHitStrips: EdgeHitStrip3D[];
  foldGraph: ResolvedFoldGraph;
  /** Metadata cached for zero-allocation runtime pose evaluation */
  W: number;
  H: number;
  L: number;
  splitMode: SplitMode;
  freeMergeMode: boolean;
  topIsFemaleTR: boolean;
  trIsPittsburgh: boolean;
}

export interface PiecePoseRuntime {
  positionM: [number, number, number];
  quaternion: [number, number, number, number];
  /** 1 = 90° folded body/cap bends; 0 = 0° completely flat */
  bodyFoldFactor: number;
  /** 1 = fully folded integral flanges & seams; 0 = 0° flat sheet */
  detailFoldFactor: number;
}

// ---------------------------------------------------------------------------
// 1. Universal 6-Face Coordinate Basis & General Parent->Child Hinge Math
// ---------------------------------------------------------------------------

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface FaceBasis3D {
  origin: Vec3;
  ex: Vec3;
  ey: Vec3; // inward normal (MẶT ĐÁNH DẤU)
  ez: Vec3;
  dimX: number;
  dimZ: number;
}

function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}
function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function getFaceBasis3D(face: FaceId, W: number, H: number, L: number): FaceBasis3D {
  switch (face) {
    case 'bottom':
      return {
        origin: v3(0, -H / 2, 0),
        ex: v3(1, 0, 0),
        ey: v3(0, 1, 0),
        ez: v3(0, 0, 1),
        dimX: W,
        dimZ: L,
      };
    case 'right':
      return {
        origin: v3(W / 2, 0, 0),
        ex: v3(0, 1, 0),
        ey: v3(-1, 0, 0),
        ez: v3(0, 0, 1),
        dimX: H,
        dimZ: L,
      };
    case 'top':
      return {
        origin: v3(0, H / 2, 0),
        ex: v3(-1, 0, 0),
        ey: v3(0, -1, 0),
        ez: v3(0, 0, 1),
        dimX: W,
        dimZ: L,
      };
    case 'left':
      return {
        origin: v3(-W / 2, 0, 0),
        ex: v3(0, -1, 0),
        ey: v3(1, 0, 0),
        ez: v3(0, 0, 1),
        dimX: H,
        dimZ: L,
      };
    case 'cap_c1':
      return {
        origin: v3(0, 0, L / 2),
        ex: v3(1, 0, 0),
        ey: v3(0, 0, -1),
        ez: v3(0, 1, 0),
        dimX: W,
        dimZ: H,
      };
    case 'cap_c2':
      return {
        origin: v3(0, 0, -L / 2),
        ex: v3(1, 0, 0),
        ey: v3(0, 0, 1),
        ez: v3(0, -1, 0),
        dimX: W,
        dimZ: H,
      };
  }
}

function basisToQuaternion(b: FaceBasis3D): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(b.ex.x, b.ex.y, b.ex.z),
    new THREE.Vector3(b.ey.x, b.ey.y, b.ey.z),
    new THREE.Vector3(b.ez.x, b.ez.y, b.ez.z)
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function worldToLocalBasis(p: Vec3, b: FaceBasis3D): Vec3 {
  return v3(dot3(p, b.ex), dot3(p, b.ey), dot3(p, b.ez));
}

function rotateAroundAxis90(v: Vec3, axis: 'x' | 'z', sign: 1 | -1): Vec3 {
  // Rotates vector `v` by `sign * (+90°)` around axis ('x' or 'z')
  if (axis === 'x') {
    return sign === 1 ? v3(v.x, -v.z, v.y) : v3(v.x, v.z, -v.y);
  }
  return sign === 1 ? v3(-v.y, v.x, v.z) : v3(v.y, -v.x, v.z);
}

interface ComputedHingeLink {
  hingePivotInParentMm: [number, number, number];
  hingeAxis: 'x' | 'z';
  hingeFoldedAngleRad: number;
  flatRotYRad: number;
  childOffsetInLocalMm: [number, number, number];
}

/**
 * Computes the EXACT 90° hinge transform between ANY two adjacent faces of the rectangular duct
 * (works identically for all 24 directed transitions across 4 body walls + 2 end caps!).
 */
function computeFaceHingeLink(
  parentFace: FaceId,
  childFace: FaceId,
  W: number,
  H: number,
  L: number
): ComputedHingeLink {
  const bp = getFaceBasis3D(parentFace, W, H, L);
  const bc = getFaceBasis3D(childFace, W, H, L);

  // Shared edge midpoint in folded world space is always bp.origin + bc.origin
  const midWorld = add3(bp.origin, bc.origin);
  const pPivot = worldToLocalBasis(sub3(midWorld, bp.origin), bp);
  const cOffset = worldToLocalBasis(sub3(bc.origin, midWorld), bc);

  // Child's inward normal in parent's local frame
  const yCinP = worldToLocalBasis(bc.ey, bp);
  // Hinge axis aP = (0, 1, 0) × yCinP = (yCinP.z, 0, -yCinP.x)
  const aPx = yCinP.z;
  const aPz = -yCinP.x;
  const hingeAxis: 'x' | 'z' = Math.abs(aPx) > 0.5 ? 'x' : 'z';
  const hingeSign: 1 | -1 = (hingeAxis === 'x' ? aPx : aPz) > 0 ? 1 : -1;
  const hingeFoldedAngleRad = hingeSign * (Math.PI / 2);

  // Compute R_flat = Rot(hingeAxis, -hingeSign * 90°) * (R_P^T * R_C)
  const exCinP = worldToLocalBasis(bc.ex, bp);
  const ezCinP = worldToLocalBasis(bc.ez, bp);
  const exFlat = rotateAroundAxis90(exCinP, hingeAxis, (-hingeSign) as 1 | -1);
  const ezFlat = rotateAroundAxis90(ezCinP, hingeAxis, (-hingeSign) as 1 | -1);
  // In THREE.js, rotation.y = theta maps (1,0,0) -> (cos θ, 0, -sin θ) and (0,0,1) -> (sin θ, 0, cos θ)
  const flatRotYRad = Math.atan2(ezFlat.x, exFlat.x);

  return {
    hingePivotInParentMm: [pPivot.x, pPivot.y, pPivot.z],
    hingeAxis,
    hingeFoldedAngleRad,
    flatRotYRad,
    childOffsetInLocalMm: [cOffset.x, cOffset.y, cOffset.z],
  };
}

// ---------------------------------------------------------------------------
// 2. Low-level Zone Geometry Builders
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

// ---------------------------------------------------------------------------
// 3. Thick Flat Plate & Embossed Straight-Rib Panel Geometry Builder
//    (Works for BOTH duct body walls AND merged End Cap panels!)
// ---------------------------------------------------------------------------

function buildRectPanelGeometry(
  dimX: number,
  dimZ: number,
  t: number,
  ribPositions: number[],
  ribsAlongX: boolean, // true for body walls (ribs parallel to C1/C2 = along X, spaced along Z)
  edgeZones: {
    negX: ExtendedMaterialZone | null;
    posX: ExtendedMaterialZone | null;
    negZ: ExtendedMaterialZone | null;
    posZ: ExtendedMaterialZone | null;
  }
): THREE.BufferGeometry {
  const zoneBuffers = createEmptyZoneBuffers();
  const halfX = dimX / 2;
  const halfZ = dimZ / 2;
  const uvScale = 1 / 280;
  const hasRibs = ribPositions.length > 0;

  const edgeStripX = Math.min(3.5, dimX * 0.08);
  const edgeStripZ = Math.min(3.5, dimZ * 0.08);

  const buildBreaks = (halfS: number, alongRib: boolean, negZone: boolean, posZone: boolean, strip: number) => {
    const span = halfS * 2;
    const raw: number[] = [-halfS, halfS];
    if (negZone) raw.push(-halfS + strip);
    if (posZone) raw.push(halfS - strip);
    if (hasRibs) {
      if (alongRib) {
        const margin = Math.min(26, span * 0.12);
        const ramp = Math.min(18, span * 0.08);
        raw.push(
          -halfS + margin,
          -halfS + margin + ramp * 0.5,
          -halfS + margin + ramp,
          halfS - margin - ramp,
          halfS - margin - ramp * 0.5,
          halfS - margin
        );
      } else {
        const ribHalfW = 7.2;
        for (const r of ribPositions) {
          raw.push(r - ribHalfW, r - ribHalfW * 0.52, r, r + ribHalfW * 0.52, r + ribHalfW);
        }
      }
    }
    raw.sort((a, b) => a - b);
    const breaks: number[] = [];
    for (const v of raw) {
      if (v < -halfS - 1e-4 || v > halfS + 1e-4) continue;
      const clamped = Math.max(-halfS, Math.min(halfS, v));
      if (breaks.length === 0 || clamped - breaks[breaks.length - 1] > 0.3) {
        breaks.push(clamped);
      }
    }
    if (breaks[breaks.length - 1] < halfS - 0.05) breaks.push(halfS);
    return breaks;
  };

  const xBreaks = buildBreaks(halfX, ribsAlongX, edgeZones.negX !== null, edgeZones.posX !== null, edgeStripX);
  const zBreaks = buildBreaks(halfZ, !ribsAlongX, edgeZones.negZ !== null, edgeZones.posZ !== null, edgeStripZ);

  const ribHalfW = 7.2;
  const ribDepth = Math.max(1.3, Math.min(2.2, t * 2.0));
  const spanAlong = ribsAlongX ? dimX : dimZ;
  const ribMargin = Math.min(26, spanAlong * 0.12);
  const ribRamp = Math.min(18, spanAlong * 0.08);

  const evalRibDispY = (x: number, z: number): number => {
    if (!hasRibs) return 0;
    const alongCoord = (ribsAlongX ? x : z) + spanAlong * 0.5;
    const perpCoord = ribsAlongX ? z : x;
    const fadeA = smoothstep(ribMargin, ribMargin + ribRamp, alongCoord);
    const fadeB = smoothstep(ribMargin, ribMargin + ribRamp, spanAlong - alongCoord);
    const fade = fadeA * fadeB;
    if (fade <= 1e-4) return 0;
    let maxBump = 0;
    for (const rp of ribPositions) {
      const d = Math.abs(perpCoord - rp);
      if (d < ribHalfW) {
        const w = 0.5 * (1 + Math.cos((Math.PI * d) / ribHalfW));
        if (w > maxBump) maxBump = w;
      }
    }
    return -maxBump * fade * ribDepth; // bulge OUTWARD (-Y)
  };

  for (let ix = 0; ix < xBreaks.length - 1; ix++) {
    const x0 = xBreaks[ix];
    const x1 = xBreaks[ix + 1];
    const xMid = (x0 + x1) * 0.5;
    const u0 = (x0 + halfX) * uvScale;
    const u1 = (x1 + halfX) * uvScale;

    for (let iz = 0; iz < zBreaks.length - 1; iz++) {
      const z0 = zBreaks[iz];
      const z1 = zBreaks[iz + 1];
      const zMid = (z0 + z1) * 0.5;
      const v0 = (z0 + halfZ) * uvScale;
      const v1 = (z1 + halfZ) * uvScale;

      let zone: ExtendedMaterialZone = 0;
      if (edgeZones.negX !== null && xMid < -halfX + edgeStripX + 0.1) zone = edgeZones.negX;
      else if (edgeZones.posX !== null && xMid > halfX - edgeStripX - 0.1) zone = edgeZones.posX;
      else if (edgeZones.negZ !== null && zMid < -halfZ + edgeStripZ + 0.1) zone = edgeZones.negZ;
      else if (edgeZones.posZ !== null && zMid > halfZ - edgeStripZ - 0.1) zone = edgeZones.posZ;
      const buf = zoneBuffers[zone];

      const d00 = evalRibDispY(x0, z0);
      const d10 = evalRibDispY(x1, z0);
      const d11 = evalRibDispY(x1, z1);
      const d01 = evalRibDispY(x0, z1);

      // Inner face (+Y normal)
      pushQuad(
        buf,
        [x0, d00, z0], [u0, v0],
        [x0, d01, z1], [u0, v1],
        [x1, d11, z1], [u1, v1],
        [x1, d10, z0], [u1, v0]
      );
      // Outer face (-Y normal)
      pushQuad(
        buf,
        [x0, -t + d00, z0], [u0, v0],
        [x1, -t + d10, z0], [u1, v0],
        [x1, -t + d11, z1], [u1, v1],
        [x0, -t + d01, z1], [u0, v1]
      );
    }

    // +Z and -Z thickness caps
    const posZBuf = zoneBuffers[edgeZones.posZ ?? 0];
    const negZBuf = zoneBuffers[edgeZones.negZ ?? 0];
    pushQuad(
      posZBuf,
      [x0, -t, halfZ], [u0, 0],
      [x1, -t, halfZ], [u1, 0],
      [x1, 0, halfZ], [u1, t * uvScale],
      [x0, 0, halfZ], [u0, t * uvScale]
    );
    pushQuad(
      negZBuf,
      [x0, -t, -halfZ], [u0, 0],
      [x0, 0, -halfZ], [u0, t * uvScale],
      [x1, 0, -halfZ], [u1, t * uvScale],
      [x1, -t, -halfZ], [u1, 0]
    );
  }

  // -X and +X thickness caps
  const negXBuf = zoneBuffers[edgeZones.negX ?? 0];
  const posXBuf = zoneBuffers[edgeZones.posX ?? 0];
  pushQuad(
    negXBuf,
    [-halfX, -t, -halfZ], [0, 0],
    [-halfX, -t, halfZ], [0, dimZ * uvScale],
    [-halfX, 0, halfZ], [t * uvScale, dimZ * uvScale],
    [-halfX, 0, -halfZ], [t * uvScale, 0]
  );
  pushQuad(
    posXBuf,
    [halfX, -t, -halfZ], [0, 0],
    [halfX, 0, -halfZ], [t * uvScale, 0],
    [halfX, 0, halfZ], [t * uvScale, dimZ * uvScale],
    [halfX, -t, halfZ], [0, dimZ * uvScale]
  );

  return finalizeZoneGeometry(zoneBuffers);
}

/**
 * Builds a watertight thick sheet-metal strip extending along `endSign * Z` from `0` to `lenMm`,
 * centered on y in [-t/2, +t/2], spanning `x in [x0, x1]`.
 * Supports:
 * - Corner bevels at free tip (`miterStartMm`, `miterEndMm`, e.g., 3.5 mm Nẹp C bevel or 8° Mí đơn bevel)
 * - Authentic TDC mid-face stepped channel groove (`tdcRibRidge`, per tdc_tdf_chưa_gò_ke_góc.jpg)
 * - Authentic TDF small triangular V-indent on the SIDE edges of the flange tab (`sideVIndent`)
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
    const rX0 = x0;
    const rX1 = x1;
    const tX0 = x0 + mS;
    const tX1 = x1 - mE;

    const xMin0 = endSign === 1 ? rX0 : tX0;
    const xMin1 = endSign === 1 ? rX1 : tX1;
    const xMax0 = endSign === 1 ? tX0 : rX0;
    const xMax1 = endSign === 1 ? tX1 : rX1;

    const u0 = 0;
    const u1 = (x1 - x0) * uvScale;
    const v0 = 0;
    const v1 = lenMm * uvScale;

    // +Y face
    pushQuad(buf, [xMin0, halfT, zMin], [u0, v0], [xMax0, halfT, zMax], [u0, v1], [xMax1, halfT, zMax], [u1, v1], [xMin1, halfT, zMin], [u1, v0]);
    // -Y face
    pushQuad(buf, [xMin0, -halfT, zMin], [u0, v0], [xMin1, -halfT, zMin], [u1, v0], [xMax1, -halfT, zMax], [u1, v1], [xMax0, -halfT, zMax], [u0, v1]);
    // zMax cap (+Z)
    pushQuad(buf, [xMax0, -halfT, zMax], [u0, 0], [xMax1, -halfT, zMax], [u1, 0], [xMax1, halfT, zMax], [u1, t * uvScale], [xMax0, halfT, zMax], [u0, t * uvScale]);
    // zMin cap (-Z)
    pushQuad(buf, [xMin0, -halfT, zMin], [u0, 0], [xMin0, halfT, zMin], [u0, t * uvScale], [xMin1, halfT, zMin], [u1, t * uvScale], [xMin1, -halfT, zMin], [u1, 0]);
    // -X cap
    pushQuad(buf, [xMin0, -halfT, zMin], [0, v0], [xMax0, -halfT, zMax], [0, v1], [xMax0, halfT, zMax], [t * uvScale, v1], [xMin0, halfT, zMin], [t * uvScale, v0]);
    // +X cap
    pushQuad(buf, [xMin1, -halfT, zMin], [0, v0], [xMin1, halfT, zMin], [t * uvScale, v0], [xMax1, halfT, zMax], [t * uvScale, v1], [xMax1, -halfT, zMax], [0, v1]);
  } else {
    // Sculpted TDC mid-face stepped groove (per tdc_tdf_chưa_gò_ke_góc.jpg) + optional TDF side V-indent
    const sSet = new Set<number>([0, lenMm]);
    if (opts?.tdcRibRidge && lenMm >= 22) {
      sSet.add(lenMm * 0.36);
      sSet.add(lenMm * 0.44);
      sSet.add(lenMm * 0.62);
      sSet.add(lenMm * 0.70);
    }
    const vCenterS = lenMm * 0.66;
    const vHalfS = 3.2;
    const vDepth = Math.min(3.2, (x1 - x0) * 0.08);
    if (opts?.sideVIndent && lenMm >= 18 && x1 - x0 >= 50) {
      sSet.add(Math.max(2, vCenterS - vHalfS));
      sSet.add(vCenterS);
      sSet.add(Math.min(lenMm - 2, vCenterS + vHalfS));
    }
    const sVals = Array.from(sSet).sort((a, b) => a - b);

    const evalYOff = (s: number): number => {
      if (!opts?.tdcRibRidge || lenMm < 22) return 0;
      const a0 = lenMm * 0.36;
      const a1 = lenMm * 0.44;
      const b0 = lenMm * 0.62;
      const b1 = lenMm * 0.70;
      const ridgeH = 1.65; // crisp stepped roll-formed groove visible along TDC face
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
      return { s, z: endSign * s, yOff: evalYOff(s), xl: x0 + ins, xr: x1 - ins };
    });
    if (endSign === -1) slices.reverse();

    for (let i = 0; i < slices.length - 1; i++) {
      const a = slices[i];
      const b = slices[i + 1];
      const u0 = 0;
      const u1 = (x1 - x0) * uvScale;
      const v0 = a.s * uvScale;
      const v1 = b.s * uvScale;

      pushQuad(buf, [a.xl, halfT + a.yOff, a.z], [u0, v0], [b.xl, halfT + b.yOff, b.z], [u0, v1], [b.xr, halfT + b.yOff, b.z], [u1, v1], [a.xr, halfT + a.yOff, a.z], [u1, v0]);
      pushQuad(buf, [a.xl, -halfT + a.yOff, a.z], [u0, v0], [a.xr, -halfT + a.yOff, a.z], [u1, v0], [b.xr, -halfT + b.yOff, b.z], [u1, v1], [b.xl, -halfT + b.yOff, b.z], [u0, v1]);
      pushQuad(buf, [a.xl, -halfT + a.yOff, a.z], [0, v0], [b.xl, -halfT + b.yOff, b.z], [0, v1], [b.xl, halfT + b.yOff, b.z], [t * uvScale, v1], [a.xl, halfT + a.yOff, a.z], [t * uvScale, v0]);
      pushQuad(buf, [a.xr, -halfT + a.yOff, a.z], [0, v0], [a.xr, halfT + a.yOff, a.z], [t * uvScale, v0], [b.xr, halfT + b.yOff, b.z], [t * uvScale, v1], [b.xr, -halfT + b.yOff, b.z], [0, v1]);
    }

    const first = slices[0];
    const last = slices[slices.length - 1];
    pushQuad(buf, [first.xl, -halfT + first.yOff, first.z], [0, 0], [first.xl, halfT + first.yOff, first.z], [0, t * uvScale], [first.xr, halfT + first.yOff, first.z], [(x1 - x0) * uvScale, t * uvScale], [first.xr, -halfT + first.yOff, first.z], [(x1 - x0) * uvScale, 0]);
    pushQuad(buf, [last.xl, -halfT + last.yOff, last.z], [0, 0], [last.xr, -halfT + last.yOff, last.z], [(x1 - x0) * uvScale, 0], [last.xr, halfT + last.yOff, last.z], [(x1 - x0) * uvScale, t * uvScale], [last.xl, halfT + last.yOff, last.z], [0, t * uvScale]);
  }

  return finalizeZoneGeometry(zoneBuffers);
}

/**
 * Builds a watertight thick longitudinal seam strip extending along `side * X` from `0` to `lenMm`,
 * spanning `z in [-L/2, +L/2]`, y in [-t/2, +t/2], with optional end bevels (`chamferTipZMm`)
 * and optional subtle roll-formed Pittsburgh ridge crease (`rollerBead`).
 */
function getEndSeamStop3DMm(conn: EndConnectionConfig): number {
  switch (conn.type) {
    case 'tdc_tdf':
      return 12;
    case 'nep_c':
      return 12.5;
    case 'bich_v_out':
      return conn.bichVSpec === 'V80x30' ? 0 : 10;
    case 'bich_v_in':
      return 10;
    default:
      return 0;
  }
}

function buildSeamStripGeometry(
  lenMm: number,
  L: number,
  t: number,
  side: -1 | 1,
  zone: ExtendedMaterialZone,
  chamferTipZMm = 0,
  rollerBead = false,
  stopNegZMm = 0,
  stopPosZMm = 0
): THREE.BufferGeometry {
  const zoneBuffers = createEmptyZoneBuffers();
  const buf = zoneBuffers[zone];
  const halfT = t * 0.5;
  const maxStop = Math.max(0, L * 0.42);
  const sNeg = Math.max(0, Math.min(stopNegZMm, maxStop));
  const sPos = Math.max(0, Math.min(stopPosZMm, maxStop));
  const zNeg = -L * 0.5 + sNeg;
  const zPos = L * 0.5 - sPos;
  const spanZ = Math.max(2, zPos - zNeg);
  const uvScale = 1 / 280;
  const ch = Math.max(0, Math.min(chamferTipZMm, spanZ * 0.32));

  const xA = 0;
  const xB = side * lenMm;
  const xMin = Math.min(xA, xB);
  const xMax = Math.max(xA, xB);

  const zMinA = side === 1 ? zNeg : zNeg + ch;
  const zMaxA = side === 1 ? zPos : zPos - ch;
  const zMinB = side === 1 ? zNeg + ch : zNeg;
  const zMaxB = side === 1 ? zPos - ch : zPos;

  const u0 = 0;
  const u1 = lenMm * uvScale;
  const v0 = 0;
  const v1 = spanZ * uvScale;

  if (!rollerBead || lenMm < 6) {
    // +Y face
    pushQuad(buf, [xMin, halfT, zMinA], [u0, v0], [xMin, halfT, zMaxA], [u0, v1], [xMax, halfT, zMaxB], [u1, v1], [xMax, halfT, zMinB], [u1, v0]);
    // -Y face
    pushQuad(buf, [xMin, -halfT, zMinA], [u0, v0], [xMax, -halfT, zMinB], [u1, v0], [xMax, -halfT, zMaxB], [u1, v1], [xMin, -halfT, zMaxA], [u0, v1]);
    // +Z cap
    pushQuad(buf, [xMin, -halfT, zMaxA], [u0, 0], [xMax, -halfT, zMaxB], [u1, 0], [xMax, halfT, zMaxB], [u1, t * uvScale], [xMin, halfT, zMaxA], [u0, t * uvScale]);
    // -Z cap
    pushQuad(buf, [xMin, -halfT, zMinA], [u0, 0], [xMin, halfT, zMinA], [u0, t * uvScale], [xMax, halfT, zMinB], [u1, t * uvScale], [xMax, -halfT, zMinB], [u1, 0]);
    // -X cap
    pushQuad(buf, [xMin, -halfT, zMinA], [0, v0], [xMin, -halfT, zMaxA], [0, v1], [xMin, halfT, zMaxA], [t * uvScale, v1], [xMin, halfT, zMinA], [t * uvScale, v0]);
    // +X cap
    pushQuad(buf, [xMax, -halfT, zMinB], [0, v0], [xMax, halfT, zMinB], [t * uvScale, v0], [xMax, halfT, zMaxB], [t * uvScale, v1], [xMax, -halfT, zMaxB], [0, v1]);
  } else {
    // Sculpted Pittsburgh roll-formed outer pocket wall with subtle longitudinal roller groove (`gờ rãnh nổi` per cận_cảnh_mí_đã_gò.jpg)
    const fracs = [0, 0.25, 0.42, 0.58, 0.75, 1.0];
    const beadOff = (f: number): number => {
      if (f <= 0.25 || f >= 0.75) return 0;
      if (f >= 0.42 && f <= 0.58) return 0.75;
      if (f < 0.42) return 0.75 * ((f - 0.25) / 0.17);
      return 0.75 * ((0.75 - f) / 0.17);
    };
    const pts = fracs.map((f) => ({
      x: side * lenMm * f,
      yOff: -beadOff(f), // subtle raised bead on exterior face of pocket
      u: lenMm * f * uvScale,
    }));
    if (side === -1) pts.reverse();

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      pushQuad(buf, [a.x, halfT + a.yOff, zNeg], [a.u, v0], [a.x, halfT + a.yOff, zPos], [a.u, v1], [b.x, halfT + b.yOff, zPos], [b.u, v1], [b.x, halfT + b.yOff, zNeg], [b.u, v0]);
      pushQuad(buf, [a.x, -halfT + a.yOff, zNeg], [a.u, v0], [b.x, -halfT + b.yOff, zNeg], [b.u, v0], [b.x, -halfT + b.yOff, zPos], [b.u, v1], [a.x, -halfT + a.yOff, zPos], [a.u, v1]);
      pushQuad(buf, [a.x, -halfT + a.yOff, zPos], [a.u, 0], [b.x, -halfT + b.yOff, zPos], [b.u, 0], [b.x, halfT + b.yOff, zPos], [b.u, t * uvScale], [a.x, halfT + a.yOff, zPos], [a.u, t * uvScale]);
      pushQuad(buf, [a.x, -halfT + a.yOff, zNeg], [a.u, 0], [a.x, halfT + a.yOff, zNeg], [a.u, t * uvScale], [b.x, halfT + b.yOff, zNeg], [b.u, t * uvScale], [b.x, -halfT + b.yOff, zNeg], [b.u, 0]);
    }
    const first = pts[0];
    const last = pts[pts.length - 1];
    pushQuad(buf, [first.x, -halfT + first.yOff, zNeg], [0, v0], [first.x, -halfT + first.yOff, zPos], [0, v1], [first.x, halfT + first.yOff, zPos], [t * uvScale, v1], [first.x, halfT + first.yOff, zNeg], [t * uvScale, v0]);
    pushQuad(buf, [last.x, -halfT + last.yOff, zNeg], [0, v0], [last.x, halfT + last.yOff, zNeg], [t * uvScale, v0], [last.x, halfT + last.yOff, zPos], [t * uvScale, v1], [last.x, -halfT + last.yOff, zPos], [0, v1]);
  }

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
  tag?: { endKey?: 'c1' | 'c2'; cornerId?: CornerId; edgeId?: FoldEdgeId }
): HingeSegmentNode {
  return {
    id,
    endKey: tag?.endKey,
    cornerId: tag?.cornerId,
    edgeId: tag?.edgeId,
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
// 4. Articulated Longitudinal Seam & Integral End Flange Chains
//    (Upgraded per Item 5 REF_NOTES.md: Roll-formed Pittsburgh S-pocket,
//     8° Mí đơn bevel, Stepped TDC channel, Smooth 180° Nẹp C w/ 3.5 mm chamfer)
// ---------------------------------------------------------------------------

function buildWallSeamHinge(
  wallId: string,
  edge: ResolvedFoldEdge,
  wall: WallId,
  side: -1 | 1,
  span: number,
  L: number,
  t: number,
  stopC2Mm = 0,
  stopC1Mm = 0
): HingeSegmentNode | null {
  const halfS = span / 2;
  const gap = Math.max(0.24, t * 0.28);
  const isFemale = edge.femaleFace === wall;
  const prefix = `${wallId}-seam-${side === -1 ? 'L' : 'R'}`;
  const seamTag = { cornerId: edge.id as CornerId, edgeId: edge.id };

  if (edge.seamType === 'pittsburgh') {
    if (isFemale) {
      // Authentic roll-formed Pittsburgh S-box pocket (`Mi.jpg`, `cận_cảnh_mí_kép.jpg`, `cận_cảnh_mí_đã_gò.jpg`):
      // - Distinct raised roller shoulder (`l1`), inner pocket back-wall (`l2`), open insertion U-slot (`l3`),
      //   ribbed outer pocket wall (`l4`), and 2-stage smooth-knee hammer-over locking tab (`l5a + l5b`)!
      const l1 = Math.max(2.0, t * 2.1); // raised roller shoulder outward
      const l2 = 9.5; // inner pocket wall running back along exterior
      const l3 = Math.max(2.7, 2.4 * t + 1.1); // clear visible slot opening for Mí đơn insertion
      const l4 = 10.6; // outer roll-formed lock pocket wall with subtle roller bead
      const l5a = 1.4; // smooth rolled knee radius (45° when locked)
      const l5b = 7.2; // flat clamping lip pressed tight onto adjacent wall (another 45° when locked)

      const h5b = makeHingeNode(
        `${prefix}-p5b`,
        [side * l5a, 0, 0],
        'z',
        side * (Math.PI / 4),
        buildSeamStripGeometry(l5b, L, t, side, 1, 0, false, stopC2Mm, stopC1Mm),
        [],
        true,
        seamTag
      );
      const h5a = makeHingeNode(
        `${prefix}-p5a`,
        [side * l4, 0, 0],
        'z',
        side * (Math.PI / 4),
        buildSeamStripGeometry(l5a, L, t, side, 1, 0, false, stopC2Mm, stopC1Mm),
        [h5b],
        true,
        seamTag
      );
      const h4 = makeHingeNode(
        `${prefix}-p4`,
        [side * l3, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(l4, L, t, side, 1, 0, true, stopC2Mm, stopC1Mm),
        [h5a],
        false,
        seamTag
      );
      const h3 = makeHingeNode(
        `${prefix}-p3`,
        [side * l2, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(l3, L, t, side, 1, 0, false, stopC2Mm, stopC1Mm),
        [h4],
        false,
        seamTag
      );
      const h2 = makeHingeNode(
        `${prefix}-p2`,
        [side * l1, 0, 0],
        'z',
        -side * (Math.PI / 2),
        buildSeamStripGeometry(l2, L, t, side, 1, 0, false, stopC2Mm, stopC1Mm),
        [h3],
        false,
        seamTag
      );
      return makeHingeNode(
        `${prefix}-p1`,
        [side * (halfS - gap - 0.5 * t), -0.5 * t, 0],
        'z',
        -side * (Math.PI / 2),
        buildSeamStripGeometry(l1, L, t, side, 1, 0, false, stopC2Mm, stopC1Mm),
        [h2],
        false,
        seamTag
      );
    } else {
      // Authentic Mí đơn (+7 mm, Blue Zone 2) with 8° gentle end bevel (~1 mm inset), bends 90° INWARD (+Y)
      const neck = Math.max(2.6, 2.2 * t + 1.0);
      const lipLen = 7.0;
      const chamfer = Math.min(lipLen * Math.tan(MALE_BEVEL_RAD), L * 0.25);

      const hLip = makeHingeNode(
        `${prefix}-mLip`,
        [side * neck, 0, 0],
        'z',
        side * (Math.PI / 2),
        buildSeamStripGeometry(lipLen, L, t, side, 2, chamfer, false, stopC2Mm, stopC1Mm),
        [],
        false,
        seamTag
      );
      return makeHingeNode(
        `${prefix}-mNeck`,
        [side * halfS, -0.5 * t, 0],
        'z',
        0,
        buildSeamStripGeometry(neck, L, t, side, 2, 0, false, stopC2Mm, stopC1Mm),
        [hLip],
        false,
        seamTag
      );
    }
  }

  if (edge.seamType === 'weld_overlap' && isFemale) {
    const lapW = Math.max(7, Math.min(25, edge.weldOverlapWidth));
    const neck = t + gap;
    const hFlap = makeHingeNode(
      `${prefix}-wFlap`,
      [side * neck, 0, 0],
      'z',
      side * (Math.PI / 2),
      buildSeamStripGeometry(lapW, L, t, side, 4, 0, false, stopC2Mm, stopC1Mm),
      [],
      false,
      seamTag
    );
    return makeHingeNode(
      `${prefix}-wNeck`,
      [side * halfS, -0.5 * t, 0],
      'z',
      0,
      buildSeamStripGeometry(neck, L, t, side, 4, 0, false, stopC2Mm, stopC1Mm),
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
  t: number,
  foldGraph: ResolvedFoldGraph
): HingeSegmentNode | null {
  if (conn.type === 'bich_v_in' || conn.type === 'bich_u') return null;

  // If this end is an End Cap AND the cap edge on this wall is MERGED ('bend'), NO seam hinge!
  if (conn.type === 'end_cap') {
    const capEdgeId = getCapEdgeId(endKey, wall);
    if (foldGraph.edges[capEdgeId]?.mode === 'bend') {
      return null;
    }
  }

  const span = getWallLength(wall, W, H);
  const halfS = span / 2;
  const gap = Math.max(0.24, t * 0.28);
  const prefix = `${wallId}-${endKey}`;
  const endTag = {
    endKey,
    ...(conn.type === 'end_cap' ? { edgeId: getCapEdgeId(endKey, wall) } : {}),
  };

  // 1. Bích TDC/TDF (+48 mm: stepped face + top + rear return + J-hook hem; tight 2 mm corner gap per tdc_tdf_chưa_gò_ke_góc.jpg)
  if (conn.type === 'tdc_tdf') {
    const trim = Math.max(1.0, t * 0.5 + 0.5);
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 6) return null;

    const l1 = 31.5;
    const l2 = 9.4;
    const l3 = 7.8;
    const l4 = 3.0;

    const h4 = makeHingeNode(`${prefix}-tdc4`, [0, 0, endSign * l3], 'x', endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l4, t, endSign, 5), [], false, endTag);
    const h3 = makeHingeNode(`${prefix}-tdc3`, [0, 0, endSign * l2], 'x', endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l3, t, endSign, 5), [h4], false, endTag);
    const h2 = makeHingeNode(`${prefix}-tdc2`, [0, 0, endSign * l1], 'x', endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l2, t, endSign, 5), [h3], false, endTag);
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

  // 2. Nẹp C liền thân (+12.5 mm, smooth 6-segment 180° semicircular curl hugging exterior + 3.5 mm corner bevels per nẹp_c_2.jpg & Item 2!)
  if (conn.type === 'nep_c') {
    const cornerClear = Math.max(1.2, Math.min(1.8, t + 0.5));
    const x0 = -halfS + cornerClear;
    const x1 = halfS - cornerClear;
    if (x1 - x0 < 6) return null;

    const arcSeg = 1.1; // 5 arc segments × 1.1 mm = 5.5 mm smooth semicircle (~3.5 mm outer diameter, ~1.9 mm C-slot clearance)
    const stepRad = Math.PI / 5; // 36° × 5 = exact 180° curl!
    const returnLen = 7.0; // 5.5 + 7.0 = exact 12.5 mm flat!
    const tipBevel = Math.min(NEP_C_CORNER_CHAMFER_MM, (x1 - x0) * 0.14);

    let child: HingeSegmentNode = makeHingeNode(
      `${prefix}-nc6`,
      [0, 0, endSign * arcSeg],
      'x',
      endSign * stepRad,
      buildAxialStripGeometry(x0, x1, returnLen, t, endSign, 5, {
        miterStartMm: tipBevel,
        miterEndMm: tipBevel,
      }),
      [],
      false,
      endTag
    );
    for (let k = 5; k >= 2; k--) {
      child = makeHingeNode(
        `${prefix}-nc${k}`,
        [0, 0, endSign * arcSeg],
        'x',
        endSign * stepRad,
        buildAxialStripGeometry(x0, x1, arcSeg, t, endSign, 5),
        [child],
        false,
        endTag
      );
    }
    return makeHingeNode(
      `${prefix}-nc1`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      0,
      buildAxialStripGeometry(x0, x1, arcSeg, t, endSign, 5),
      [child],
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
      buildAxialStripGeometry(x0, x1, 8.0, t, endSign, 5, { miterStartMm: 1.5, miterEndMm: 1.5 }),
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
    return makeHingeNode(
      `${prefix}-plainExt`,
      [0, -0.5 * t, endSign * (L / 2)],
      'x',
      0,
      buildAxialStripGeometry(-halfS + trim, halfS - trim, ext, t, endSign, 5),
      [],
      false,
      endTag
    );
  }

  // 5. Đầu bẻ chân tùy biến từng cạnh
  if (conn.type === 'be_chan') {
    const mode = conn.beChanEdges[wall];
    if (mode === 'straight') return null;
    const F = Math.max(5, Math.min(100, conn.beChanWidth));
    if (mode === 'out') {
      const trim = t + gap;
      const x0 = -halfS + trim;
      const x1 = halfS - trim;
      if (x1 - x0 < 4) return null;
      return makeHingeNode(`${prefix}-bcOut`, [0, -0.5 * t, endSign * (L / 2)], 'x', endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, F, t, endSign, 5), [], false, endTag);
    }
    const fEff = Math.min(F, Math.min(W, H) * 0.42);
    const isHoriz = wall === 'top' || wall === 'bottom';
    const leftAdj = getAdjacentWallOnSide(wall, -1);
    const rightAdj = getAdjacentWallOnSide(wall, 1);
    const trimL = !isHoriz && conn.beChanEdges[leftAdj] === 'in' ? fEff + gap : gap * 0.8;
    const trimR = !isHoriz && conn.beChanEdges[rightAdj] === 'in' ? fEff + gap : gap * 0.8;
    const x0 = -halfS + trimL;
    const x1 = halfS - trimR;
    if (x1 - x0 < 4) return null;
    return makeHingeNode(`${prefix}-bcIn`, [0, -0.5 * t, endSign * (L / 2)], 'x', -endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, fEff, t, endSign, 5), [], false, endTag);
  }

  // 6. Đầu gắn LCCT (+20 mm chấn vào trong, vát 45° cả 2 góc)
  if (conn.type === 'lcct') {
    const fEff = Math.min(20.0, Math.min(W, H) * 0.42);
    const trim = gap * 0.6;
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 4) return null;
    return makeHingeNode(`${prefix}-lcct`, [0, -0.5 * t, endSign * (L / 2)], 'x', -endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, fEff, t, endSign, 5, { miterStartMm: fEff, miterEndMm: fEff }), [], false, endTag);
  }

  // 7. Đầu bịt kín (cạnh đang ở trạng thái TÁCH MẢNH: Mí kép chờ +31 mm roll-formed hoặc Hàn +0 mm)
  if (conn.type === 'end_cap') {
    const edgeSeam = getEndCapEdgeSeam(conn, wall);
    const trim = t + gap + 1.0;
    const x0 = -halfS + trim;
    const x1 = halfS - trim;
    if (x1 - x0 < 6) return null;

    if (edgeSeam === 'pittsburgh') {
      const l1 = Math.max(2.0, t * 2.1);
      const l2 = 9.5;
      const l3 = Math.max(2.7, 2.4 * t + 1.1);
      const l4 = 10.6;
      const l5a = 1.4;
      const l5b = 7.2;

      const h5b = makeHingeNode(`${prefix}-cap5b`, [0, 0, endSign * l5a], 'x', -endSign * (Math.PI / 4), buildAxialStripGeometry(x0, x1, l5b, t, endSign, 1), [], true, endTag);
      const h5a = makeHingeNode(`${prefix}-cap5a`, [0, 0, endSign * l4], 'x', -endSign * (Math.PI / 4), buildAxialStripGeometry(x0, x1, l5a, t, endSign, 1), [h5b], true, endTag);
      const h4 = makeHingeNode(`${prefix}-cap4`, [0, 0, endSign * l3], 'x', -endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l4, t, endSign, 1), [h5a], false, endTag);
      const h3 = makeHingeNode(`${prefix}-cap3`, [0, 0, endSign * l2], 'x', -endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l3, t, endSign, 1), [h4], false, endTag);
      const h2 = makeHingeNode(`${prefix}-cap2`, [0, 0, endSign * l1], 'x', endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l2, t, endSign, 1), [h3], false, endTag);
      return makeHingeNode(`${prefix}-cap1`, [0, -0.5 * t, endSign * (L / 2 - gap - 0.5 * t)], 'x', endSign * (Math.PI / 2), buildAxialStripGeometry(x0, x1, l1, t, endSign, 1), [h2], false, endTag);
    }

    return makeHingeNode(`${prefix}-capWeld`, [0, -t - 0.08, endSign * (L / 2)], 'x', 0, buildAxialStripGeometry(x0, x1, 3.2, 0.16, -endSign as 1 | -1, 4), [], false, endTag);
  }

  return null;
}

/**
 * Builds articulated free-edge seam lips (+7 mm Mí đơn w/ 8° bevel, or Hàn chập flap)
 * on the NON-MERGED edges of an integrated End Cap face (`cap_c1` or `cap_c2`) so it
 * bends cleanly 90° inward into the mating body walls when folded, and flattens to 0° when unfolded!
 */
function buildIntegratedCapEdgeHinges(
  faceId: string,
  endKey: 'c1' | 'c2',
  W: number,
  H: number,
  t: number,
  conn: EndConnectionConfig,
  foldGraph: ResolvedFoldGraph
): HingeSegmentNode[] {
  const hinges: HingeSegmentNode[] = [];
  const halfW = W / 2;
  const halfH = H / 2;
  const gap = Math.max(0.24, t * 0.28);

  // Map each duct wall to the local edge of cap_c1 or cap_c2:
  // cap_c1: ex=(+1,0,0), ez=(0,+1,0) => +Z=top, -Z=bottom, +X=right, -X=left
  // cap_c2: ex=(+1,0,0), ez=(0,-1,0) => -Z=top, +Z=bottom, +X=right, -X=left
  const edgeMap: {
    wall: WallId;
    axis: 'x' | 'z';
    dir: 1 | -1;
    span: number;
    pivot: [number, number, number];
  }[] = [
    {
      wall: 'top',
      axis: 'x',
      dir: endKey === 'c1' ? 1 : -1,
      span: W,
      pivot: [0, -0.5 * t, (endKey === 'c1' ? 1 : -1) * halfH],
    },
    {
      wall: 'bottom',
      axis: 'x',
      dir: endKey === 'c1' ? -1 : 1,
      span: W,
      pivot: [0, -0.5 * t, (endKey === 'c1' ? -1 : 1) * halfH],
    },
    {
      wall: 'right',
      axis: 'z',
      dir: 1,
      span: H,
      pivot: [halfW, -0.5 * t, 0],
    },
    {
      wall: 'left',
      axis: 'z',
      dir: -1,
      span: H,
      pivot: [-halfW, -0.5 * t, 0],
    },
  ];

  for (const item of edgeMap) {
    const capEdgeId = getCapEdgeId(endKey, item.wall);
    const edgeInfo = foldGraph.edges[capEdgeId];
    if (!edgeInfo || edgeInfo.mode === 'bend') continue; // Merged edge = continuous sheet, NO seam lip!

    const seamType = getEndCapEdgeSeam(conn, item.wall);
    if (seamType === 'weld_butt') continue;

    const isPitts = seamType === 'pittsburgh';
    const lipLen = isPitts ? 7.0 : Math.max(7, Math.min(25, conn.endCapWeldOverlapWidth));
    const zone: ExtendedMaterialZone = isPitts ? 2 : 4;
    const bevel = isPitts ? Math.min(lipLen * Math.tan(MALE_BEVEL_RAD), item.span * 0.2) : 1.0;
    const trim = t + gap;
    const tag = { endKey, edgeId: capEdgeId };

    if (item.axis === 'x') {
      // Strip extends along item.dir * Z; bends 90° INWARD (+Y):
      // Rotating +Z toward +Y is -90° around X; rotating -Z toward +Y is +90° around X => -dir * π/2!
      const geom = buildAxialStripGeometry(-item.span / 2 + trim, item.span / 2 - trim, lipLen, t, item.dir, zone, {
        miterStartMm: bevel,
        miterEndMm: bevel,
      });
      hinges.push(
        makeHingeNode(
          `${faceId}-caplip-${item.wall}`,
          item.pivot,
          'x',
          -item.dir * (Math.PI / 2),
          geom,
          [],
          false,
          tag
        )
      );
    } else {
      // Strip extends along item.dir * X; bends 90° INWARD (+Y):
      // Rotating +X toward +Y is +90° around Z; rotating -X toward +Y is -90° around Z => +dir * π/2!
      const geom = buildSeamStripGeometry(lipLen, Math.max(6, item.span - 2 * trim), t, item.dir, zone, bevel);
      hinges.push(
        makeHingeNode(
          `${faceId}-caplip-${item.wall}`,
          item.pivot,
          'z',
          item.dir * (Math.PI / 2),
          geom,
          [],
          false,
          tag
        )
      );
    }
  }

  return hinges;
}

// ---------------------------------------------------------------------------
// 5. General Face–Edge Tree Rig Builder per Component
// ---------------------------------------------------------------------------

function buildFaceRigNode(
  comp: FoldComponent,
  treeNode: FaceTreeNode,
  config: DuctConfig,
  foldGraph: ResolvedFoldGraph,
  bodyRibZPositions: number[],
  ribPitchMm: number
): WallRigNode {
  const { W, H, L, thickness: t, c1, c2, stiffenerRibs } = config;
  const face = treeNode.face;
  const basis = getFaceBasis3D(face, W, H, L);
  const nodeId = `${comp.id}-${face}`;
  const isRoot = treeNode.parentFace === null;

  let link: ComputedHingeLink = {
    hingePivotInParentMm: [0, 0, 0],
    hingeAxis: 'z',
    hingeFoldedAngleRad: 0,
    flatRotYRad: 0,
    childOffsetInLocalMm: [0, 0, 0],
  };
  if (treeNode.parentFace !== null) {
    link = computeFaceHingeLink(treeNode.parentFace, face, W, H, L);
  }

  let geometry: THREE.BufferGeometry;
  let faceLabel: BuiltFaceLabel;
  const flangeHinges: HingeSegmentNode[] = [];

  if (isBodyWall(face)) {
    const span = basis.dimX;
    const corners = getWallCorners(face);
    const startEdge = foldGraph.edges[corners.start];
    const endEdge = foldGraph.edges[corners.end];

    const zoneForBodyEdge = (e: ResolvedFoldEdge): ExtendedMaterialZone | null => {
      if (e.mode === 'bend') return 3; // Green 90° bend
      if (e.seamType === 'pittsburgh') return e.femaleFace === face ? 1 : 2;
      return 4;
    };

    const c1EdgeZone: ExtendedMaterialZone | null =
      c1.type === 'end_cap' && foldGraph.edges[getCapEdgeId('c1', face)]?.mode === 'bend' ? 3 : null;
    const c2EdgeZone: ExtendedMaterialZone | null =
      c2.type === 'end_cap' && foldGraph.edges[getCapEdgeId('c2', face)]?.mode === 'bend' ? 3 : null;

    geometry = buildRectPanelGeometry(span, L, t, bodyRibZPositions, true, {
      negX: zoneForBodyEdge(startEdge),
      posX: zoneForBodyEdge(endEdge),
      negZ: c2EdgeZone,
      posZ: c1EdgeZone,
    });

    // Inner face label stamped cleanly at (0, +0.55 mm, labelZ) facing +Y (MẶT ĐÁNH DẤU!)
    let labelZ = 0;
    let baySpanZ = L - 24;
    if (bodyRibZPositions.length > 0) {
      const lastRib = bodyRibZPositions[bodyRibZPositions.length - 1];
      const frontBay = L / 2 - lastRib;
      if (frontBay >= 85) {
        labelZ = lastRib + frontBay * 0.5;
        baySpanZ = frontBay - 24;
      } else if (bodyRibZPositions.length >= 2) {
        const midIdx = Math.floor(bodyRibZPositions.length / 2);
        labelZ = (bodyRibZPositions[midIdx - 1] + bodyRibZPositions[midIdx]) * 0.5;
        baySpanZ = bodyRibZPositions[midIdx] - bodyRibZPositions[midIdx - 1] - 24;
      }
    }
    const maxW = Math.min(span * 0.44, 175);
    const maxH = Math.min(baySpanZ * 0.62, 86);
    const labelW = Math.max(46, Math.min(maxW, maxH * 2.15));
    const labelH = Math.max(24, labelW * 0.46);
    faceLabel = {
      id: `${nodeId}-lbl`,
      partCode: comp.partCode,
      pieceId: comp.id,
      position: [0, 0.55 * MM_TO_M, labelZ * MM_TO_M],
      rotation: [-Math.PI / 2, 0, 0],
      sizeM: [labelW * MM_TO_M, labelH * MM_TO_M],
    };

    const stopC2 = getEndSeamStop3DMm(c2);
    const stopC1 = getEndSeamStop3DMm(c1);
    if (startEdge.mode === 'seam') {
      const sh = buildWallSeamHinge(nodeId, startEdge, face, -1, span, L, t, stopC2, stopC1);
      if (sh) flangeHinges.push(sh);
    }
    if (endEdge.mode === 'seam') {
      const eh = buildWallSeamHinge(nodeId, endEdge, face, 1, span, L, t, stopC2, stopC1);
      if (eh) flangeHinges.push(eh);
    }
    const c1Hinge = buildWallEndFlangeHinge(nodeId, face, 'c1', 1, c1, W, H, L, t, foldGraph);
    if (c1Hinge) flangeHinges.push(c1Hinge);
    const c2Hinge = buildWallEndFlangeHinge(nodeId, face, 'c2', -1, c2, W, H, L, t, foldGraph);
    if (c2Hinge) flangeHinges.push(c2Hinge);
  } else {
    // Integrated End Cap face ('cap_c1' or 'cap_c2') hinged directly into a body component!
    const endKey: 'c1' | 'c2' = face === 'cap_c1' ? 'c1' : 'c2';
    const conn = config[endKey];
    const ribAlongX = W >= H;
    const capRibLayout = computeRibLayout(ribAlongX ? H : W, stiffenerRibs, ribPitchMm);

    const edgeZoneForWall = (w: WallId): ExtendedMaterialZone | null => {
      const eid = getCapEdgeId(endKey, w);
      const e = foldGraph.edges[eid];
      if (!e) return null;
      if (e.mode === 'bend') return 3; // Green 90° bend!
      return e.seamType === 'pittsburgh' ? 2 : 4;
    };

    geometry = buildRectPanelGeometry(W, H, t, capRibLayout.zPositionsMm, ribAlongX, {
      negX: edgeZoneForWall('left'),
      posX: edgeZoneForWall('right'),
      posZ: edgeZoneForWall(endKey === 'c1' ? 'top' : 'bottom'),
      negZ: edgeZoneForWall(endKey === 'c1' ? 'bottom' : 'top'),
    });

    const labelW = Math.max(52, Math.min(165, Math.min(W, H) * 0.42));
    const labelH = Math.max(26, labelW * 0.46);
    faceLabel = {
      id: `${nodeId}-lbl`,
      partCode: comp.partCode,
      pieceId: comp.id,
      position: [0, 0.55 * MM_TO_M, 0],
      rotation: [-Math.PI / 2, 0, 0],
      sizeM: [labelW * MM_TO_M, labelH * MM_TO_M],
    };

    flangeHinges.push(...buildIntegratedCapEdgeHinges(nodeId, endKey, W, H, t, conn, foldGraph));
  }

  const childWalls = treeNode.children.map((ch) =>
    buildFaceRigNode(comp, ch, config, foldGraph, bodyRibZPositions, ribPitchMm)
  );

  return {
    id: nodeId,
    face,
    wall: isBodyWall(face) ? face : undefined,
    dimXMm: basis.dimX,
    dimZMm: basis.dimZ,
    isRoot,
    viaEdgeId: treeNode.viaEdgeId,
    hingePivotInParentM: [
      link.hingePivotInParentMm[0] * MM_TO_M,
      link.hingePivotInParentMm[1] * MM_TO_M,
      link.hingePivotInParentMm[2] * MM_TO_M,
    ],
    hingeAxis: link.hingeAxis,
    hingeFoldedAngleRad: link.hingeFoldedAngleRad,
    flatRotYRad: link.flatRotYRad,
    childOffsetInLocalM: [
      link.childOffsetInLocalMm[0] * MM_TO_M,
      link.childOffsetInLocalMm[1] * MM_TO_M,
      link.childOffsetInLocalMm[2] * MM_TO_M,
    ],
    geometry,
    edgesGeometry: new THREE.EdgesGeometry(geometry, 22),
    faceLabel,
    flangeHinges,
    childWalls,
  };
}

/** Computes exact flat XZ bounding box (mm) of a PieceRig when fully unfolded (foldFactor = 0) */
function computeFlatBoundsLocalMm(root: WallRigNode): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const visit = (node: WallRigNode, ox: number, oz: number, rotY: number) => {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const xform = (lx: number, lz: number): [number, number] => [
      ox + lx * c + lz * s,
      oz - lx * s + lz * c,
    ];
    const hx = node.dimXMm / 2;
    const hz = node.dimZMm / 2;
    for (const [cx, cz] of [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ] as const) {
      const [wx, wz] = xform(cx, cz);
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }

    for (const ch of node.childWalls) {
      const [px, pz] = xform(ch.hingePivotInParentM[0] / MM_TO_M, ch.hingePivotInParentM[2] / MM_TO_M);
      const childRotY = rotY + ch.flatRotYRad;
      const cc = Math.cos(childRotY);
      const ss = Math.sin(childRotY);
      const offX = ch.childOffsetInLocalM[0] / MM_TO_M;
      const offZ = ch.childOffsetInLocalM[2] / MM_TO_M;
      const chCenterX = px + offX * cc + offZ * ss;
      const chCenterZ = pz - offX * ss + offZ * cc;
      visit(ch, chCenterX, chCenterZ, childRotY);
    }
  };

  visit(root, 0, 0, 0);
  return { minX, maxX, minZ, maxZ };
}

function buildPieceRig(
  comp: FoldComponent,
  config: DuctConfig,
  foldGraph: ResolvedFoldGraph,
  bodyRibZPositions: number[],
  ribPitchMm: number
): PieceRig {
  const { W, H, L } = config;
  const rootBasis = getFaceBasis3D(comp.rootFace, W, H, L);
  const rootQuat = basisToQuaternion(rootBasis);
  const rootWall = buildFaceRigNode(comp, comp.tree, config, foldGraph, bodyRibZPositions, ribPitchMm);
  const flatBoundsLocalMm = computeFlatBoundsLocalMm(rootWall);

  // Average outward normal of component's faces for clean radial explode in free-merge mode
  let ex = 0;
  let ey = 0;
  let ez = 0;
  for (const f of comp.faces) {
    const b = getFaceBasis3D(f, W, H, L);
    ex -= b.ey.x;
    ey -= b.ey.y;
    ez -= b.ey.z;
  }
  const len = Math.hypot(ex, ey, ez);
  const explodeDir: [number, number, number] = len > 1e-4 ? [ex / len, ey / len, ez / len] : [0, 1, 0];

  return {
    id: comp.id,
    partCode: comp.partCode,
    name: comp.name,
    faces: comp.faces,
    walls: comp.faces.filter(isBodyWall),
    isMergedTree: comp.isMergedTree,
    rootFace: comp.rootFace,
    rootWall,
    foldedCenterMm: [rootBasis.origin.x, rootBasis.origin.y, rootBasis.origin.z],
    foldedQuat: [rootQuat.x, rootQuat.y, rootQuat.z, rootQuat.w],
    flatBoundsLocalMm,
    flatLayoutCenterXMm: 0,
    flatLayoutCenterZMm: 0,
    explodeDir,
  };
}

// ---------------------------------------------------------------------------
// 6. Weld Beads & Interactive 3D Shared Edge Hit Strips
// ---------------------------------------------------------------------------

function buildRigWeldBeads(
  foldGraph: ResolvedFoldGraph,
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

  for (const cid of ['TL', 'TR', 'BR', 'BL'] as CornerId[]) {
    const seam = foldGraph.edges[cid];
    if (seam.mode !== 'seam' || seam.seamType === 'pittsburgh') continue;
    const [cx, cy] = cornerPos(cid);
    const nF = outN(seam.femaleFace as WallId);
    const nM = outN(seam.maleFace as WallId);
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
    const geom = new THREE.CylinderGeometry(radiusMm * MM_TO_M, radiusMm * MM_TO_M, (L - 1.5) * MM_TO_M, 8, 1);
    geom.rotateX(Math.PI / 2);
    geom.translate(bx * MM_TO_M, by * MM_TO_M, 0);
    beads.push({ id: `weld-${cid}`, cornerId: cid, geometry: geom });
  }
  return beads;
}

function buildEdgeHitStrips(
  foldGraph: ResolvedFoldGraph,
  W: number,
  H: number,
  L: number,
  t: number
): EdgeHitStrip3D[] {
  const hw = W / 2 + t + 1.5;
  const hh = H / 2 + t + 1.5;
  const hl = L / 2 + t + 1.5;
  const strips: EdgeHitStrip3D[] = [];

  for (const edgeId of foldGraph.activeEdgeIds) {
    const edge = foldGraph.edges[edgeId];
    const def = FOLD_EDGE_DEFS[edgeId];
    if (def.kind === 'body') {
      const x = edgeId === 'TR' || edgeId === 'BR' ? hw : -hw;
      const y = edgeId === 'TL' || edgeId === 'TR' ? hh : -hh;
      strips.push({
        edgeId,
        label: edge.label,
        mode: edge.mode,
        kind: def.kind,
        centerM: [x * MM_TO_M, y * MM_TO_M, 0],
        rotation: [Math.PI / 2, 0, 0], // Cylinder default axis Y -> rotate X 90° to align along Z!
        lengthM: Math.max(0.04, (L - 28) * MM_TO_M),
      });
    } else {
      const zSign = def.endKey === 'c1' ? 1 : -1;
      const z = zSign * hl;
      const wall = def.wall!;
      if (wall === 'top' || wall === 'bottom') {
        const y = wall === 'top' ? hh : -hh;
        strips.push({
          edgeId,
          label: edge.label,
          mode: edge.mode,
          kind: def.kind,
          centerM: [0, y * MM_TO_M, z * MM_TO_M],
          rotation: [0, 0, Math.PI / 2], // align Cylinder Y along X
          lengthM: Math.max(0.04, (W - 24) * MM_TO_M),
        });
      } else {
        const x = wall === 'right' ? hw : -hw;
        strips.push({
          edgeId,
          label: edge.label,
          mode: edge.mode,
          kind: def.kind,
          centerM: [x * MM_TO_M, 0, z * MM_TO_M],
          rotation: [0, 0, 0], // Cylinder Y already aligned along Y!
          lengthM: Math.max(0.04, (H - 24) * MM_TO_M),
        });
      }
    }
  }

  return strips;
}

// ---------------------------------------------------------------------------
// 7. Master Static Rig Builder (called ONLY on dimensional/structural edits!)
// ---------------------------------------------------------------------------

export function buildUnfoldableDuctRig(
  config: DuctConfig,
  ribPitchMm = 210
): UnfoldableDuctRig {
  const { W, H, L, thickness: t, splitMode, freeMergeMode, stiffenerRibs } = config;
  const foldGraph = resolveFoldGraph(config);
  const ribLayout = computeRibLayout(L, stiffenerRibs, ribPitchMm);

  // Build articulated PieceRigs for every non-detached-cap component (all body & merged-cap pieces!)
  const pieces = foldGraph.components
    .filter((comp) => !comp.isPureEndCap)
    .map((comp) => buildPieceRig(comp, config, foldGraph, ribLayout.zPositionsMm, ribPitchMm));

  // Precompute clean non-overlapping flat X/Z layout centers on studio floor at unfold = 100%
  const baseFlatGap = 155;
  const widths = pieces.map((p) => p.flatBoundsLocalMm.maxX - p.flatBoundsLocalMm.minX);
  const totalFlatW =
    widths.reduce((sum, w) => sum + w, 0) + Math.max(0, pieces.length - 1) * baseFlatGap;
  let cursorX = -totalFlatW * 0.5;
  pieces.forEach((p, i) => {
    const b = p.flatBoundsLocalMm;
    const localMidX = (b.minX + b.maxX) * 0.5;
    const localMidZ = (b.minZ + b.maxZ) * 0.5;
    p.flatLayoutCenterXMm = cursorX + widths[i] * 0.5 - localMidX;
    p.flatLayoutCenterZMm = -localMidZ;
    cursorX += widths[i] + baseFlatGap;
  });

  const weldBeads = buildRigWeldBeads(foldGraph, W, H, L, t);
  const accessories = buildAllEndAccessories(config, 1, 0, ribPitchMm, foldGraph);
  const edgeHitStrips = buildEdgeHitStrips(foldGraph, W, H, L, t);

  const trEdge = foldGraph.edges.TR;

  return {
    pieces,
    weldBeads,
    accessories,
    edgeHitStrips,
    foldGraph,
    W,
    H,
    L,
    splitMode,
    freeMergeMode,
    topIsFemaleTR: trEdge ? trEdge.femaleFace === 'top' : true,
    trIsPittsburgh: trEdge ? trEdge.seamType === 'pittsburgh' : true,
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
// 8. Zero-Allocation Runtime Pose Evaluators (60fps in useFrame / layout!)
// ---------------------------------------------------------------------------

export function evaluateAccessoryRetractFactor(unfoldRatio: number): number {
  return smoothstep(0.0, 0.3, unfoldRatio);
}

const _qFolded = new THREE.Quaternion();
const _qFlat = new THREE.Quaternion();
const _qOut = new THREE.Quaternion();

export function evaluatePieceRuntimePose(
  piece: PieceRig,
  rig: UnfoldableDuctRig,
  seamLockProgress: number,
  explodeRatio: number,
  unfoldRatio: number
): PiecePoseRuntime {
  const { W, H, splitMode, freeMergeMode, topIsFemaleTR, trIsPittsburgh } = rig;
  const [baseX, baseY, baseZ] = piece.foldedCenterMm;

  const uBody = smoothstep(0.06, 1.0, unfoldRatio);
  const uDetail = smoothstep(0.12, 0.94, unfoldRatio);
  const unseamed = (1 - seamLockProgress) * (1 - uBody);

  const baseExplode = Math.max(85, Math.min(250, Math.max(W, H) * 0.28));
  let expX = 0;
  let expY = 0;
  let expZ = 0;

  if (!freeMergeMode && !piece.isMergedTree) {
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
  } else if (rig.pieces.length > 1) {
    // General radial explode for any custom free-merge multi-piece graph
    const shift = (unseamed * 9.0 + explodeRatio * baseExplode * 0.95);
    expX = piece.explodeDir[0] * shift;
    expY = piece.explodeDir[1] * shift;
    expZ = piece.explodeDir[2] * shift;
  }

  // Flat target pose: every piece lies horizontally on y = 0 with +Y (MẶT ĐÁNH DẤU) facing straight UP!
  const pieceIdx = rig.pieces.indexOf(piece);
  const extraExplodeSpreadX =
    rig.pieces.length > 1
      ? (pieceIdx - (rig.pieces.length - 1) * 0.5) * explodeRatio * 145
      : 0;
  const flatX = piece.flatLayoutCenterXMm + extraExplodeSpreadX;
  const flatY = 0;
  const flatZ = piece.flatLayoutCenterZMm;

  const arc = Math.sin(uBody * Math.PI);
  const sep = rig.pieces.length > 1 ? Math.max(60, Math.min(160, Math.max(W, H) * 0.22)) : 0;
  const arcX = arc * piece.explodeDir[0] * sep * 0.65;
  const arcY = arc * piece.explodeDir[1] * sep * 0.65;

  const foldedX = baseX + expX;
  const foldedY = baseY + expY;
  const foldedZ = baseZ + expZ;

  const posX = foldedX * (1 - uBody) + flatX * uBody + arcX;
  const posY = foldedY * (1 - uBody) + flatY * uBody + arcY;
  const posZ = foldedZ * (1 - uBody) + flatZ * uBody;

  _qFolded.set(piece.foldedQuat[0], piece.foldedQuat[1], piece.foldedQuat[2], piece.foldedQuat[3]);
  _qFlat.identity(); // Local +Y faces world +Y (upward!), local XZ aligns with world XZ!
  _qOut.copy(_qFolded).slerp(_qFlat, uBody);

  return {
    positionM: [posX * MM_TO_M, posY * MM_TO_M, posZ * MM_TO_M],
    quaternion: [_qOut.x, _qOut.y, _qOut.z, _qOut.w],
    bodyFoldFactor: 1 - uBody,
    detailFoldFactor: 1 - uDetail,
  };
}
