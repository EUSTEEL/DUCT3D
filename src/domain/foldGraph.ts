import type {
  CapEdgeId,
  CornerId,
  DuctConfig,
  EdgeJoinMode,
  FaceId,
  FoldEdgeId,
  SeamType,
  SplitMode,
  WallId,
} from '../types/duct';
import { getEndCapEdgeSeam } from './endConnectionRules';

export const FACE_LABELS: Record<FaceId, string> = {
  top: 'Mặt Trên',
  bottom: 'Mặt Dưới',
  left: 'Hông Trái',
  right: 'Hông Phải',
  cap_c1: 'Bịt đầu C1',
  cap_c2: 'Bịt đầu C2',
};

export const FACE_SHORT_LABELS: Record<FaceId, string> = {
  top: 'Trên',
  bottom: 'Dưới',
  left: 'Trái',
  right: 'Phải',
  cap_c1: 'Bịt C1',
  cap_c2: 'Bịt C2',
};

export interface FoldEdgeDef {
  id: FoldEdgeId;
  faces: readonly [FaceId, FaceId];
  kind: 'body' | 'cap_c1' | 'cap_c2';
  label: string;
  shortLabel: string;
  oppositeEdgeId?: FoldEdgeId;
  /** For cap edges: which end & body wall this edge connects */
  endKey?: 'c1' | 'c2';
  wall?: WallId;
}

export const BODY_EDGE_IDS: readonly CornerId[] = ['TL', 'TR', 'BR', 'BL'] as const;
export const C1_CAP_EDGE_IDS: readonly CapEdgeId[] = [
  'C1_top',
  'C1_bottom',
  'C1_left',
  'C1_right',
] as const;
export const C2_CAP_EDGE_IDS: readonly CapEdgeId[] = [
  'C2_top',
  'C2_bottom',
  'C2_left',
  'C2_right',
] as const;

export const FOLD_EDGE_DEFS: Record<FoldEdgeId, FoldEdgeDef> = {
  TL: {
    id: 'TL',
    faces: ['left', 'top'],
    kind: 'body',
    label: 'Góc Trên – Trái (TL)',
    shortLabel: 'TL',
    oppositeEdgeId: 'BR',
  },
  TR: {
    id: 'TR',
    faces: ['top', 'right'],
    kind: 'body',
    label: 'Góc Trên – Phải (TR)',
    shortLabel: 'TR',
    oppositeEdgeId: 'BL',
  },
  BR: {
    id: 'BR',
    faces: ['right', 'bottom'],
    kind: 'body',
    label: 'Góc Dưới – Phải (BR)',
    shortLabel: 'BR',
    oppositeEdgeId: 'TL',
  },
  BL: {
    id: 'BL',
    faces: ['bottom', 'left'],
    kind: 'body',
    label: 'Góc Dưới – Trái (BL)',
    shortLabel: 'BL',
    oppositeEdgeId: 'TR',
  },
  C1_top: {
    id: 'C1_top',
    faces: ['top', 'cap_c1'],
    kind: 'cap_c1',
    label: 'Cạnh Bịt C1 – Trên',
    shortLabel: 'C1-Trên',
    oppositeEdgeId: 'C1_bottom',
    endKey: 'c1',
    wall: 'top',
  },
  C1_bottom: {
    id: 'C1_bottom',
    faces: ['bottom', 'cap_c1'],
    kind: 'cap_c1',
    label: 'Cạnh Bịt C1 – Dưới',
    shortLabel: 'C1-Dưới',
    oppositeEdgeId: 'C1_top',
    endKey: 'c1',
    wall: 'bottom',
  },
  C1_left: {
    id: 'C1_left',
    faces: ['left', 'cap_c1'],
    kind: 'cap_c1',
    label: 'Cạnh Bịt C1 – Trái',
    shortLabel: 'C1-Trái',
    oppositeEdgeId: 'C1_right',
    endKey: 'c1',
    wall: 'left',
  },
  C1_right: {
    id: 'C1_right',
    faces: ['right', 'cap_c1'],
    kind: 'cap_c1',
    label: 'Cạnh Bịt C1 – Phải',
    shortLabel: 'C1-Phải',
    oppositeEdgeId: 'C1_left',
    endKey: 'c1',
    wall: 'right',
  },
  C2_top: {
    id: 'C2_top',
    faces: ['top', 'cap_c2'],
    kind: 'cap_c2',
    label: 'Cạnh Bịt C2 – Trên',
    shortLabel: 'C2-Trên',
    oppositeEdgeId: 'C2_bottom',
    endKey: 'c2',
    wall: 'top',
  },
  C2_bottom: {
    id: 'C2_bottom',
    faces: ['bottom', 'cap_c2'],
    kind: 'cap_c2',
    label: 'Cạnh Bịt C2 – Dưới',
    shortLabel: 'C2-Dưới',
    oppositeEdgeId: 'C2_top',
    endKey: 'c2',
    wall: 'bottom',
  },
  C2_left: {
    id: 'C2_left',
    faces: ['left', 'cap_c2'],
    kind: 'cap_c2',
    label: 'Cạnh Bịt C2 – Trái',
    shortLabel: 'C2-Trái',
    oppositeEdgeId: 'C2_right',
    endKey: 'c2',
    wall: 'left',
  },
  C2_right: {
    id: 'C2_right',
    faces: ['right', 'cap_c2'],
    kind: 'cap_c2',
    label: 'Cạnh Bịt C2 – Phải',
    shortLabel: 'C2-Phải',
    oppositeEdgeId: 'C2_left',
    endKey: 'c2',
    wall: 'right',
  },
};

export function isBodyEdge(edgeId: FoldEdgeId): edgeId is CornerId {
  return edgeId === 'TL' || edgeId === 'TR' || edgeId === 'BR' || edgeId === 'BL';
}

export function isCapEdge(edgeId: FoldEdgeId): edgeId is CapEdgeId {
  return !isBodyEdge(edgeId);
}

export function isBodyWall(face: FaceId): face is WallId {
  return face === 'top' || face === 'bottom' || face === 'left' || face === 'right';
}

export function getCapEdgeId(endKey: 'c1' | 'c2', wall: WallId): CapEdgeId {
  return `${endKey.toUpperCase()}_${wall}` as CapEdgeId;
}

export function getActiveFaces(config: DuctConfig): FaceId[] {
  const faces: FaceId[] = ['top', 'bottom', 'left', 'right'];
  if (config.c1.type === 'end_cap') faces.push('cap_c1');
  if (config.c2.type === 'end_cap') faces.push('cap_c2');
  return faces;
}

export function getActiveEdgeIds(config: DuctConfig): FoldEdgeId[] {
  const edges: FoldEdgeId[] = [...BODY_EDGE_IDS];
  if (config.c1.type === 'end_cap') edges.push(...C1_CAP_EDGE_IDS);
  if (config.c2.type === 'end_cap') edges.push(...C2_CAP_EDGE_IDS);
  return edges;
}

export function getDefaultEdgeStatesForSplitMode(
  splitMode: SplitMode
): Record<FoldEdgeId, EdgeJoinMode> {
  const base: Record<FoldEdgeId, EdgeJoinMode> = {
    TL: 'bend',
    TR: 'seam',
    BR: 'bend',
    BL: 'bend',
    C1_top: 'seam',
    C1_bottom: 'seam',
    C1_left: 'seam',
    C1_right: 'seam',
    C2_top: 'seam',
    C2_bottom: 'seam',
    C2_left: 'seam',
    C2_right: 'seam',
  };

  switch (splitMode) {
    case '1_piece':
      base.TL = 'bend';
      base.BL = 'bend';
      base.BR = 'bend';
      base.TR = 'seam';
      break;
    case '2_piece_L':
      base.TL = 'bend';
      base.BR = 'bend';
      base.TR = 'seam';
      base.BL = 'seam';
      break;
    case '2_piece_UI':
      base.BL = 'bend';
      base.BR = 'bend';
      base.TL = 'seam';
      base.TR = 'seam';
      break;
    case '4_piece':
      base.TL = 'seam';
      base.TR = 'seam';
      base.BR = 'seam';
      base.BL = 'seam';
      break;
  }

  return base;
}

/**
 * Computes sanitized active edge join states guaranteeing a cycle-free spanning forest.
 */
export function getEffectiveEdgeStates(config: DuctConfig): Record<FoldEdgeId, EdgeJoinMode> {
  const defaults = getDefaultEdgeStatesForSplitMode(config.splitMode);
  if (!config.freeMergeMode) return defaults;

  const activeEdges = getActiveEdgeIds(config);
  const desired: Record<FoldEdgeId, EdgeJoinMode> = { ...defaults };
  for (const id of activeEdges) {
    const custom = config.customEdgeStates[id];
    if (custom === 'bend' || custom === 'seam') {
      desired[id] = custom;
    }
  }

  // Defensively ensure no closed cycles via Union-Find across active bend edges
  const parent = new Map<FaceId, FaceId>();
  const find = (f: FaceId): FaceId => {
    const p = parent.get(f) ?? f;
    if (p === f) return f;
    const r = find(p);
    parent.set(f, r);
    return r;
  };

  const safe: Record<FoldEdgeId, EdgeJoinMode> = { ...desired };
  for (const id of activeEdges) {
    if (safe[id] !== 'bend') continue;
    const [u, v] = FOLD_EDGE_DEFS[id].faces;
    const ru = find(u);
    const rv = find(v);
    if (ru === rv) {
      safe[id] = 'seam';
    } else {
      parent.set(ru, rv);
    }
  }
  return safe;
}

export interface EdgeMergeValidation {
  allowed: boolean;
  reason?: string;
  cycleEdges?: FoldEdgeId[];
  suggestedSplitEdgeId?: FoldEdgeId;
}

/**
 * Checks whether setting `edgeId` to `'bend'` (Liền mảnh — Chấn 90°) preserves a valid
 * acyclic spanning forest. If merging creates a closed cycle, returns the exact cycle
 * and suggests the most intuitive edge to split so the user can swap hinges in 1 click.
 */
export function validateSetEdgeToBend(
  config: DuctConfig,
  edgeId: FoldEdgeId
): EdgeMergeValidation {
  const activeEdges = getActiveEdgeIds(config);
  if (!activeEdges.includes(edgeId)) {
    return { allowed: false, reason: 'Cạnh này không tồn tại trong cấu hình hiện tại.' };
  }

  const states = getEffectiveEdgeStates(config);
  if (states[edgeId] === 'bend') {
    return { allowed: true };
  }

  const [startFace, targetFace] = FOLD_EDGE_DEFS[edgeId].faces;
  // BFS over existing 'bend' edges to detect path between startFace and targetFace
  const adj = new Map<FaceId, { next: FaceId; via: FoldEdgeId }[]>();
  for (const eid of activeEdges) {
    if (states[eid] !== 'bend') continue;
    const [a, b] = FOLD_EDGE_DEFS[eid].faces;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ next: b, via: eid });
    adj.get(b)!.push({ next: a, via: eid });
  }

  const visited = new Set<FaceId>([startFace]);
  const prev = new Map<FaceId, { from: FaceId; via: FoldEdgeId }>();
  const queue: FaceId[] = [startFace];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === targetFace) break;
    for (const step of adj.get(cur) ?? []) {
      if (visited.has(step.next)) continue;
      visited.add(step.next);
      prev.set(step.next, { from: cur, via: step.via });
      queue.push(step.next);
    }
  }

  if (!visited.has(targetFace)) {
    return { allowed: true };
  }

  // Reconstruct simple path forming the cycle
  const pathEdges: FoldEdgeId[] = [];
  let walk: FaceId = targetFace;
  while (walk !== startFace) {
    const info = prev.get(walk)!;
    pathEdges.push(info.via);
    walk = info.from;
  }

  const def = FOLD_EDGE_DEFS[edgeId];
  // Choose best suggested edge to split:
  // 1) Opposite edge if it lies on the cycle
  // 2) Same-kind edge (e.g. another cap_c1 edge if merging a cap_c1 edge)
  // 3) First edge along the cycle path
  let suggestedSplitEdgeId: FoldEdgeId | undefined;
  if (def.oppositeEdgeId && pathEdges.includes(def.oppositeEdgeId)) {
    suggestedSplitEdgeId = def.oppositeEdgeId;
  } else {
    suggestedSplitEdgeId =
      pathEdges.find((e) => FOLD_EDGE_DEFS[e].kind === def.kind) ?? pathEdges[0];
  }

  return {
    allowed: false,
    reason: 'Không thể nối kín vòng — cần tách ít nhất 1 cạnh để trải phẳng',
    cycleEdges: [...pathEdges, edgeId],
    suggestedSplitEdgeId,
  };
}

export interface ResolvedFoldEdge {
  id: FoldEdgeId;
  faces: readonly [FaceId, FaceId];
  kind: 'body' | 'cap_c1' | 'cap_c2';
  label: string;
  shortLabel: string;
  mode: EdgeJoinMode;
  seamType: SeamType;
  weldOverlapWidth: number;
  femaleFace: FaceId;
  maleFace: FaceId;
  isOverridden: boolean;
  endKey?: 'c1' | 'c2';
  wall?: WallId;
}

export interface FaceTreeNode {
  face: FaceId;
  parentFace: FaceId | null;
  viaEdgeId: FoldEdgeId | null;
  children: FaceTreeNode[];
}

export interface FoldComponent {
  id: string;
  partCode: string; // '1-A', '1-B', ...
  name: string;
  faces: FaceId[];
  bendEdges: FoldEdgeId[];
  bendCount: number;
  isPureEndCap: boolean;
  endCapKey?: 'c1' | 'c2';
  /** True when component has ONLY body walls (no end cap merged in) */
  isPureBodyLinear: boolean;
  /** True when component merges at least 1 end cap with 1+ body walls */
  isMergedTree: boolean;
  /** CCW ordered body walls + start/end corners (populated iff isPureBodyLinear) */
  linearBodyWalls?: WallId[];
  startCorner?: CornerId;
  endCorner?: CornerId;
  rootFace: FaceId;
  tree: FaceTreeNode;
}

export interface ResolvedFoldGraph {
  freeMergeMode: boolean;
  activeFaces: FaceId[];
  activeEdgeIds: FoldEdgeId[];
  edges: Record<FoldEdgeId, ResolvedFoldEdge>;
  components: FoldComponent[];
  /** Quick lookup: face -> owning component */
  faceToComponent: Map<FaceId, FoldComponent>;
}

const CCW_WALL_SEQ: readonly WallId[] = ['top', 'left', 'bottom', 'right'] as const;
const WALL_START_CORNER: Record<WallId, CornerId> = {
  top: 'TR',
  left: 'TL',
  bottom: 'BL',
  right: 'BR',
};
const WALL_END_CORNER: Record<WallId, CornerId> = {
  top: 'TL',
  left: 'BL',
  bottom: 'BR',
  right: 'TR',
};

function orderBodyWallsCCW(
  wallSet: Set<WallId>,
  edgeStates: Record<FoldEdgeId, EdgeJoinMode>
): { walls: WallId[]; startCorner: CornerId; endCorner: CornerId } {
  // Find the wall in wallSet whose CCW-previous corner is NOT an internal bend inside wallSet
  let startWall: WallId = 'top';
  for (const w of CCW_WALL_SEQ) {
    if (!wallSet.has(w)) continue;
    const startC = WALL_START_CORNER[w];
    if (edgeStates[startC] !== 'bend') {
      startWall = w;
      break;
    }
  }

  const ordered: WallId[] = [];
  let idx = CCW_WALL_SEQ.indexOf(startWall);
  for (let k = 0; k < 4; k++) {
    const w = CCW_WALL_SEQ[(idx + k) % 4];
    if (!wallSet.has(w)) break;
    ordered.push(w);
    const nextC = WALL_END_CORNER[w];
    if (edgeStates[nextC] !== 'bend') break;
  }

  return {
    walls: ordered,
    startCorner: WALL_START_CORNER[ordered[0]],
    endCorner: WALL_END_CORNER[ordered[ordered.length - 1]],
  };
}

function defaultBodyFemaleWall(
  cornerId: CornerId,
  W: number,
  H: number,
  splitMode: SplitMode,
  freeMergeMode: boolean
): { defaultFemale: WallId; defaultMale: WallId } {
  const wIsLarger = W >= H;
  if (!freeMergeMode && splitMode === '2_piece_UI') {
    if (cornerId === 'TR') return { defaultFemale: 'right', defaultMale: 'top' };
    if (cornerId === 'TL') return { defaultFemale: 'left', defaultMale: 'top' };
  }
  switch (cornerId) {
    case 'TR':
      return {
        defaultFemale: wIsLarger ? 'top' : 'right',
        defaultMale: wIsLarger ? 'right' : 'top',
      };
    case 'TL':
      return {
        defaultFemale: wIsLarger ? 'top' : 'left',
        defaultMale: wIsLarger ? 'left' : 'top',
      };
    case 'BR':
      return {
        defaultFemale: wIsLarger ? 'bottom' : 'right',
        defaultMale: wIsLarger ? 'right' : 'bottom',
      };
    case 'BL':
      return {
        defaultFemale: wIsLarger ? 'bottom' : 'left',
        defaultMale: wIsLarger ? 'left' : 'bottom',
      };
  }
}

function indexToPartCodeLocal(index: number): string {
  return `1-${String.fromCharCode(65 + index)}`;
}

function buildComponentName(
  faces: FaceId[],
  isPureEndCap: boolean,
  isPureBodyLinear: boolean,
  linearWalls?: WallId[]
): string {
  if (isPureEndCap) {
    const endLbl = faces[0] === 'cap_c1' ? 'C1' : 'C2';
    return `Mảnh bịt đầu rời (${endLbl})`;
  }
  if (isPureBodyLinear && linearWalls) {
    if (linearWalls.length === 4) return 'Mảnh thân chữ O';
    if (linearWalls.length === 3) {
      return `Mảnh chữ U (${linearWalls.map((w) => FACE_SHORT_LABELS[w]).join(' + ')})`;
    }
    if (linearWalls.length === 2) {
      return `Mảnh chữ L (${linearWalls.map((w) => FACE_SHORT_LABELS[w]).join(' + ')})`;
    }
    const w = linearWalls[0];
    if (w === 'top') return 'Mảnh mặt Trên (W)';
    if (w === 'bottom') return 'Mảnh mặt Dưới (W)';
    if (w === 'left') return 'Mảnh hông Trái (H)';
    return 'Mảnh hông Phải (H)';
  }
  // Merged body + end cap component
  const hasC1 = faces.includes('cap_c1');
  const hasC2 = faces.includes('cap_c2');
  const bodyCount = faces.filter(isBodyWall).length;
  if (bodyCount === 4 && faces.length === 5) {
    return `Mảnh kín 5 mặt liền (${hasC1 ? 'C1' : 'C2'})`;
  }
  if (bodyCount === 4 && faces.length === 6) {
    return 'Mảnh kín 6 mặt liền';
  }
  if (hasC1 && hasC2) {
    return `Mảnh ghép (${faces.map((f) => FACE_SHORT_LABELS[f]).join(' + ')})`;
  }
  return `Mảnh ghép (${faces.map((f) => FACE_SHORT_LABELS[f]).join(' + ')})`;
}

function chooseComponentRootFace(
  faces: FaceId[],
  adj: Map<FaceId, { next: FaceId; via: FoldEdgeId }[]>
): FaceId {
  // If an end cap is the hub of a star/cross (degree >= 3), anchor on that cap!
  for (const cap of ['cap_c1', 'cap_c2'] as const) {
    if (faces.includes(cap) && (adj.get(cap)?.length ?? 0) >= 3) {
      return cap;
    }
  }
  // Otherwise prefer 'bottom' (unfolds directly onto studio floor), then 'top', 'left', 'right', caps
  const pref: FaceId[] = ['bottom', 'top', 'left', 'right', 'cap_c1', 'cap_c2'];
  for (const f of pref) {
    if (faces.includes(f)) return f;
  }
  return faces[0];
}

function buildSpanningTree(
  root: FaceId,
  adj: Map<FaceId, { next: FaceId; via: FoldEdgeId }[]>
): FaceTreeNode {
  const visited = new Set<FaceId>([root]);
  const build = (face: FaceId, parentFace: FaceId | null, viaEdgeId: FoldEdgeId | null): FaceTreeNode => {
    const children: FaceTreeNode[] = [];
    for (const step of adj.get(face) ?? []) {
      if (visited.has(step.next)) continue;
      visited.add(step.next);
      children.push(build(step.next, face, step.via));
    }
    return { face, parentFace, viaEdgeId, children };
  };
  return build(root, null, null);
}

/**
 * Resolves the complete Face–Edge Graph for the current DuctConfig — supporting
 * both standard split presets (1_piece, 2_piece_L, 2_piece_UI, 4_piece) and
 * arbitrary free-merge 4-, 5-, and 6-face sheet-metal topologies.
 */
export function resolveFoldGraph(config: DuctConfig): ResolvedFoldGraph {
  const activeFaces = getActiveFaces(config);
  const activeEdgeIds = getActiveEdgeIds(config);
  const edgeStates = getEffectiveEdgeStates(config);

  const edges = {} as Record<FoldEdgeId, ResolvedFoldEdge>;

  for (const edgeId of Object.keys(FOLD_EDGE_DEFS) as FoldEdgeId[]) {
    const def = FOLD_EDGE_DEFS[edgeId];
    const mode: EdgeJoinMode = activeEdgeIds.includes(edgeId) ? edgeStates[edgeId] : 'seam';

    if (def.kind === 'body') {
      const cid = edgeId as CornerId;
      const override = config.seamOverrides[cid];
      const { defaultFemale, defaultMale } = defaultBodyFemaleWall(
        cid,
        config.W,
        config.H,
        config.splitMode,
        config.freeMergeMode
      );
      const flip = Boolean(config.swapSeamRoles) !== Boolean(override?.inverted);
      const femaleFace: FaceId = flip ? defaultMale : defaultFemale;
      const maleFace: FaceId = flip ? defaultFemale : defaultMale;
      const seamType = override?.seamType ?? config.globalSeamType;
      const weldOverlapWidth = override?.weldOverlapWidth ?? config.weldOverlapWidth;
      const isOverridden =
        override !== undefined &&
        (override.seamType !== undefined ||
          override.weldOverlapWidth !== undefined ||
          override.inverted === true);

      edges[edgeId] = {
        id: edgeId,
        faces: def.faces,
        kind: def.kind,
        label: def.label,
        shortLabel: def.shortLabel,
        mode,
        seamType,
        weldOverlapWidth,
        femaleFace,
        maleFace,
        isOverridden,
      };
    } else {
      const endKey = def.endKey!;
      const wall = def.wall!;
      const conn = config[endKey];
      const seamType = getEndCapEdgeSeam(conn, wall);
      const weldOverlapWidth = conn.endCapWeldOverlapWidth;
      const isOverridden = conn.endCapEdgeSeams[wall] !== undefined;
      // On an end cap seam, the body wall carries Female (+31 mm Mí kép chờ),
      // and the end cap panel carries Male (+7 mm Mí đơn or Hàn chập flap).
      edges[edgeId] = {
        id: edgeId,
        faces: def.faces,
        kind: def.kind,
        label: def.label,
        shortLabel: def.shortLabel,
        mode,
        seamType,
        weldOverlapWidth,
        femaleFace: wall,
        maleFace: endKey === 'c1' ? 'cap_c1' : 'cap_c2',
        isOverridden,
        endKey,
        wall,
      };
    }
  }

  // Build adjacency over active 'bend' edges
  const bendAdj = new Map<FaceId, { next: FaceId; via: FoldEdgeId }[]>();
  for (const f of activeFaces) bendAdj.set(f, []);
  for (const eid of activeEdgeIds) {
    if (edges[eid].mode !== 'bend') continue;
    const [a, b] = FOLD_EDGE_DEFS[eid].faces;
    bendAdj.get(a)!.push({ next: b, via: eid });
    bendAdj.get(b)!.push({ next: a, via: eid });
  }

  // Extract connected components via BFS in canonical face order
  const faceOrder: FaceId[] = ['top', 'bottom', 'left', 'right', 'cap_c1', 'cap_c2'];
  // Match canonical UI preset ordering in standard modes (e.g., 2_piece_UI puts U=['left','bottom','right'] before I=['top'])
  const canonicalSeedOrder: FaceId[] =
    !config.freeMergeMode && config.splitMode === '2_piece_UI'
      ? ['left', 'bottom', 'right', 'top', 'cap_c1', 'cap_c2']
      : faceOrder;

  const seen = new Set<FaceId>();
  const rawComps: { faces: FaceId[]; bendEdges: FoldEdgeId[] }[] = [];

  for (const seed of canonicalSeedOrder) {
    if (!activeFaces.includes(seed) || seen.has(seed)) continue;
    const compFaces: FaceId[] = [];
    const compBendSet = new Set<FoldEdgeId>();
    const q: FaceId[] = [seed];
    seen.add(seed);

    while (q.length > 0) {
      const cur = q.shift()!;
      compFaces.push(cur);
      for (const step of bendAdj.get(cur) ?? []) {
        compBendSet.add(step.via);
        if (!seen.has(step.next)) {
          seen.add(step.next);
          q.push(step.next);
        }
      }
    }

    rawComps.push({
      faces: compFaces,
      bendEdges: Array.from(compBendSet),
    });
  }

  // Sort components cleanly: body/merged components first (in seed priority), detached pure caps last
  rawComps.sort((a, b) => {
    const aPureCap = a.faces.length === 1 && !isBodyWall(a.faces[0]);
    const bPureCap = b.faces.length === 1 && !isBodyWall(b.faces[0]);
    if (aPureCap !== bPureCap) return aPureCap ? 1 : -1;
    const aMin = Math.min(...a.faces.map((f) => canonicalSeedOrder.indexOf(f)));
    const bMin = Math.min(...b.faces.map((f) => canonicalSeedOrder.indexOf(f)));
    return aMin - bMin;
  });

  const components: FoldComponent[] = rawComps.map((rc, idx) => {
    const partCode = indexToPartCodeLocal(idx);
    const isPureEndCap = rc.faces.length === 1 && !isBodyWall(rc.faces[0]);
    const endCapKey = isPureEndCap ? (rc.faces[0] === 'cap_c1' ? 'c1' : 'c2') : undefined;
    const isPureBodyLinear = rc.faces.every(isBodyWall);
    const isMergedTree = !isPureEndCap && !isPureBodyLinear;

    let linearBodyWalls: WallId[] | undefined;
    let startCorner: CornerId | undefined;
    let endCorner: CornerId | undefined;
    if (isPureBodyLinear) {
      const ordered = orderBodyWallsCCW(new Set(rc.faces as WallId[]), edgeStates);
      linearBodyWalls = ordered.walls;
      startCorner = ordered.startCorner;
      endCorner = ordered.endCorner;
    }

    // Stable human-readable component ID (matches standard preset IDs when applicable)
    let id = `FG-${idx + 1}`;
    if (isPureEndCap) {
      id = endCapKey === 'c1' ? 'CAP-C1' : 'CAP-C2';
    } else if (!config.freeMergeMode && isPureBodyLinear && linearBodyWalls) {
      if (config.splitMode === '1_piece') id = 'P1';
      else if (config.splitMode === '2_piece_L') id = linearBodyWalls.includes('top') ? 'L1' : 'L2';
      else if (config.splitMode === '2_piece_UI') id = linearBodyWalls.length === 3 ? 'U' : 'I';
      else {
        const w = linearBodyWalls[0];
        id = w === 'top' ? 'T' : w === 'bottom' ? 'B' : w === 'left' ? 'L' : 'R';
      }
    }

    const rootFace = chooseComponentRootFace(rc.faces, bendAdj);
    const tree = buildSpanningTree(rootFace, bendAdj);
    const name = buildComponentName(rc.faces, isPureEndCap, isPureBodyLinear, linearBodyWalls);

    return {
      id,
      partCode,
      name,
      faces: rc.faces,
      bendEdges: rc.bendEdges,
      bendCount: rc.bendEdges.length,
      isPureEndCap,
      endCapKey,
      isPureBodyLinear,
      isMergedTree,
      linearBodyWalls,
      startCorner,
      endCorner,
      rootFace,
      tree,
    };
  });

  const faceToComponent = new Map<FaceId, FoldComponent>();
  for (const comp of components) {
    for (const f of comp.faces) {
      faceToComponent.set(f, comp);
    }
  }

  return {
    freeMergeMode: config.freeMergeMode,
    activeFaces,
    activeEdgeIds,
    edges,
    components,
    faceToComponent,
  };
}

/**
 * Convenience preset builders for 5-face / 6-face free-merge training demos.
 */
export function buildFreeMergePresetEdges(
  config: DuctConfig,
  preset: 'merge_c1_top' | 'cross_5_face' | 'reset_standard'
): Partial<Record<FoldEdgeId, EdgeJoinMode>> {
  const base = getDefaultEdgeStatesForSplitMode(config.splitMode);
  if (preset === 'reset_standard') {
    return base;
  }
  if (preset === 'merge_c1_top') {
    // Keep body split as-is (valid tree) and merge cap_c1 onto top!
    return {
      ...base,
      C1_top: 'bend',
      C1_bottom: 'seam',
      C1_left: 'seam',
      C1_right: 'seam',
    };
  }
  // 'cross_5_face': 5-face cross with cap_c1 in center + all 4 body walls hinged to cap_c1
  return {
    TL: 'seam',
    TR: 'seam',
    BR: 'seam',
    BL: 'seam',
    C1_top: 'bend',
    C1_bottom: 'bend',
    C1_left: 'bend',
    C1_right: 'bend',
    C2_top: 'seam',
    C2_bottom: 'seam',
    C2_left: 'seam',
    C2_right: 'seam',
  };
}
