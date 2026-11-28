import type {
  BeChanEdgeMode,
  BeChanEdges,
  BichVSpec,
  EndConnectionConfig,
  EndConnectionType,
  SeamType,
  WallId,
} from '../types/duct';

export const BICH_U_OUTER_LIP_MM = 10; // Gờ bẻ ngoài cố định 10 mm quay ngược về phía thân ống

export const END_CONNECTION_LABELS: Record<EndConnectionType, string> = {
  tdc_tdf: 'Bích TDC/TDF (Liền thân)',
  nep_c: 'Nẹp C (Liền thân)',
  be_chan: 'Đầu bẻ chân (Liền thân)',
  lcct: 'Lưới chắn côn trùng (LCCT)',
  end_cap: 'Đầu bịt kín (End Cap)',
  plain: 'Đầu để thẳng',
  bich_v_out: 'Bích V quay ngoài (Rời)',
  bich_v_in: 'Bích V quay trong (Rời)',
  bich_u: 'Bích U (Rời)',
};

export const END_CONNECTION_SHORT_LABELS: Record<EndConnectionType, string> = {
  tdc_tdf: 'TDC/TDF',
  nep_c: 'Nẹp C',
  be_chan: 'Bẻ chân',
  lcct: 'LCCT',
  end_cap: 'Bịt đầu',
  plain: 'Để thẳng',
  bich_v_out: 'Bích V ngoài',
  bich_v_in: 'Bích V trong',
  bich_u: 'Bích U',
};

export const BE_CHAN_MODE_LABELS: Record<BeChanEdgeMode, string> = {
  in: 'Bẻ vào',
  out: 'Bẻ ra',
  straight: 'Để thẳng',
};

export interface BeChanPreset {
  id: string;
  label: string;
  edges: BeChanEdges;
}

export const BE_CHAN_PRESETS: readonly BeChanPreset[] = [
  {
    id: '4-in',
    label: '4 bẻ vào',
    edges: { top: 'in', bottom: 'in', left: 'in', right: 'in' },
  },
  {
    id: '4-out',
    label: '4 bẻ ra',
    edges: { top: 'out', bottom: 'out', left: 'out', right: 'out' },
  },
  {
    id: '2-in-2-out',
    label: '2 bẻ vào – 2 bẻ ra',
    edges: { top: 'in', bottom: 'in', left: 'out', right: 'out' },
  },
  {
    id: '2-in-2-straight',
    label: '2 bẻ vào – 2 để thẳng',
    edges: { top: 'in', bottom: 'in', left: 'straight', right: 'straight' },
  },
  {
    id: '2-out-2-straight',
    label: '2 bẻ ra – 2 để thẳng',
    edges: { top: 'out', bottom: 'out', left: 'straight', right: 'straight' },
  },
] as const;

export function isDetachedFlange(type: EndConnectionType): boolean {
  return type === 'bich_v_out' || type === 'bich_v_in' || type === 'bich_u';
}

export function createDefaultEndConnection(
  type: EndConnectionType = 'tdc_tdf',
  overrides?: Partial<EndConnectionConfig>
): EndConnectionConfig {
  const defaultSpec: BichVSpec =
    type === 'bich_v_in' && overrides?.bichVSpec === 'V80x30'
      ? 'V40x40'
      : (overrides?.bichVSpec ?? 'V40x40');

  return {
    type,
    showEndIndent: false,
    bichVSpec: defaultSpec,
    bichVThickness: 3,
    bichVOutStyle: 'standard',
    bichUThickness: 2,
    bichUWrapLeg: 30,
    bichUFlangeFace: 40,
    beChanEdges: { top: 'out', bottom: 'out', left: 'out', right: 'out' },
    beChanWidth: 20,
    plainExtensionMm: 0,
    showLcctMesh: true,
    endCapSeamType: 'pittsburgh',
    endCapWeldOverlapWidth: 10,
    endCapEdgeSeams: {},
    ...overrides,
    ...(overrides?.beChanEdges ? { beChanEdges: { ...overrides.beChanEdges } } : {}),
    ...(overrides?.endCapEdgeSeams ? { endCapEdgeSeams: { ...overrides.endCapEdgeSeams } } : {}),
  };
}

/**
 * Dimensions of rolled angle steel V-flange:
 * - legFace: radial flange face width (perpendicular to duct axis Z)
 * - legAxial: axial leg hugging/entering along duct axis Z
 */
export function getBichVDimensions(spec: BichVSpec): {
  legFace: number;
  legAxial: number;
  vSize: number;
} {
  switch (spec) {
    case 'V30x30':
      return { legFace: 30, legAxial: 30, vSize: 30 };
    case 'V40x40':
      return { legFace: 40, legAxial: 40, vSize: 40 };
    case 'V50x50':
      return { legFace: 50, legAxial: 50, vSize: 50 };
    case 'V80x30':
      return { legFace: 80, legAxial: 30, vSize: 80 };
  }
}

/**
 * Returns whether Bích V uses the +8 mm 90°-turned-out duct lip:
 * - Only V30/V40/V50 outward standard (bich_v_out + standard + != V80x30) gets +8 mm lip.
 * - V80×30 (cánh 30 lọt lòng W-3 × H-3), Bích V EI, and Bích V quay trong cut flush +0 mm.
 */
export function bichVHasTurnedLip(conn: EndConnectionConfig): boolean {
  return (
    conn.type === 'bich_v_out' &&
    conn.bichVOutStyle === 'standard' &&
    conn.bichVSpec !== 'V80x30'
  );
}

/** Resolve seam type for a specific edge ('top' | 'bottom' | 'left' | 'right') of an End Cap */
export function getEndCapEdgeSeam(conn: EndConnectionConfig, wall: WallId): SeamType {
  return conn.endCapEdgeSeams[wall] ?? conn.endCapSeamType;
}

/** End Cap panel allowance (+mm) on a single edge ('top' | 'bottom' | 'left' | 'right') */
export function getEndCapPanelEdgeAllowance(conn: EndConnectionConfig, wall: WallId): number {
  const seam = getEndCapEdgeSeam(conn, wall);
  if (seam === 'pittsburgh') return 7;
  if (seam === 'weld_overlap') return Math.max(7, Math.min(25, conn.endCapWeldOverlapWidth));
  return 0;
}

/** Exact duct-wall blank length allowance (+mm) for ONE specific wall at an end connection */
export function getWallEndAllowanceMm(conn: EndConnectionConfig, wall: WallId): number {
  switch (conn.type) {
    case 'tdc_tdf':
      return 48;
    case 'nep_c':
      return 12.5;
    case 'bich_v_out':
      return bichVHasTurnedLip(conn) ? 8 : 0;
    case 'bich_v_in':
    case 'bich_u':
      return 0;
    case 'plain':
      return Math.max(0, Math.min(300, Math.round(conn.plainExtensionMm)));
    case 'be_chan': {
      const mode = conn.beChanEdges[wall];
      return mode === 'straight' ? 0 : Math.max(5, Math.min(100, conn.beChanWidth));
    }
    case 'lcct':
      return 20;
    case 'end_cap':
      return getEndCapEdgeSeam(conn, wall) === 'pittsburgh' ? 31 : 0;
  }
}

/** Max blank length allowance (+mm) for a set of walls (e.g. one duct piece, or all 4 walls for duct max) */
export function getPieceEndAllowanceMm(
  conn: EndConnectionConfig,
  walls: readonly WallId[] = ['top', 'bottom', 'left', 'right']
): number {
  let maxA = 0;
  for (const w of walls) {
    const a = getWallEndAllowanceMm(conn, w);
    if (a > maxA) maxA = a;
  }
  return maxA;
}

/** Duct-level max blank allowance (+mm) for one end connection (used for L_phôi & auto-split) */
export function getEndAllowanceMm(conn: EndConnectionConfig): number {
  return getPieceEndAllowanceMm(conn, ['top', 'bottom', 'left', 'right']);
}

export function getEndAllowanceLabel(
  conn: EndConnectionConfig,
  walls: readonly WallId[] = ['top', 'bottom', 'left', 'right']
): string {
  const allow = getPieceEndAllowanceMm(conn, walls);
  switch (conn.type) {
    case 'tdc_tdf':
      return `TDC/TDF (+${allow})`;
    case 'nep_c':
      return `Nẹp C (+${allow})`;
    case 'bich_v_out':
      return conn.bichVSpec === 'V80x30'
        ? `V80×30 lọt lòng (+0)`
        : `${conn.bichVSpec} ${conn.bichVOutStyle === 'ei' ? 'EI' : 'ngoài'} (+${allow})`;
    case 'bich_v_in':
      return `${conn.bichVSpec} quay trong (+0)`;
    case 'bich_u':
      return `Bích U ${conn.bichUWrapLeg}×${conn.bichUFlangeFace}×10 (+0)`;
    case 'plain':
      return allow > 0 ? `Để thẳng (+${allow} không mí)` : 'Để thẳng (+0)';
    case 'be_chan': {
      const counts = { in: 0, out: 0, straight: 0 };
      for (const w of walls) counts[conn.beChanEdges[w]]++;
      if (allow === 0) return 'Bẻ chân (để thẳng +0)';
      if (counts.in === walls.length) return `Bẻ chân vào (+${allow})`;
      if (counts.out === walls.length) return `Bẻ chân ra (+${allow})`;
      return `Bẻ chân tùy biến (+${allow})`;
    }
    case 'lcct':
      return `LCCT (+${allow})`;
    case 'end_cap': {
      const hasPitts = walls.some((w) => getEndCapEdgeSeam(conn, w) === 'pittsburgh');
      return hasPitts ? `Bịt đầu - Mí kép chờ (+${allow})` : 'Bịt đầu - Mí hàn (+0)';
    }
  }
}

export function getEndNotchSummary(conn: EndConnectionConfig): string {
  switch (conn.type) {
    case 'tdc_tdf':
      return `Bích liền thân • Bù phôi +48 mm • Khấu tổng 60 mm (sâu thêm 12 mm) • Cao 32 mm, 4 ke góc lỗ giọt nước${
        conn.showEndIndent ? ' • Có dấu lõm phân biệt đầu sát góc' : ''
      }`;
    case 'nep_c':
      return 'Bích liền thân • Bù phôi +12.5 mm • Khấu 25 mm • Mép uốn cong 180° tạo rãnh chữ C chạy sát 4 góc (hở kỹ thuật ~1.5 mm)';
    case 'bich_v_out': {
      const { vSize } = getBichVDimensions(conn.bichVSpec);
      const notch = vSize + 5;
      if (conn.bichVSpec === 'V80x30') {
        return `Bích rời (2 thanh phủ bì + 2 lọt lòng, không lỗ) • V80×30 dày ${conn.bichVThickness} mm quay ngoài, cánh 30 mm lọt lòng (W−3 × H−3) • Đầu ống cắt thẳng +0 mm`;
      }
      if (conn.bichVOutStyle === 'ei') {
        return `Bích rời (2 thanh phủ bì + 2 lọt lòng, không lỗ) • ${conn.bichVSpec} EI dày ${conn.bichVThickness} mm • Lòng trong W−3 × H−3 • Cắt thẳng +0 mm, khấu EI = ${notch} mm`;
      }
      return `Bích rời (2 thanh phủ bì + 2 lọt lòng, không lỗ) • ${conn.bichVSpec} dày ${conn.bichVThickness} mm • Lòng trong W+5 × H+5 • Bù +8 mm lật 90°, khấu = ${notch} mm`;
    }
    case 'bich_v_in': {
      const spec = conn.bichVSpec === 'V80x30' ? 'V40x40' : conn.bichVSpec;
      return `Bích rời (2 thanh phủ bì + 2 lọt lòng, không lỗ) • ${spec} quay trong dày ${conn.bichVThickness} mm • Phủ bì W−3 × H−3 • Đầu ống cắt thẳng +0 mm`;
    }
    case 'bich_u':
      return `Bích rời (2 thanh phủ bì + 2 lọt lòng, không lỗ) • Dày ${conn.bichUThickness} mm • Cánh ôm ${conn.bichUWrapLeg} × Mặt bích ${conn.bichUFlangeFace} × Gờ ngoài cố định ${BICH_U_OUTER_LIP_MM} mm quay về thân • Phôi thân +0 mm`;
    case 'plain':
      return conn.plainExtensionMm > 0
        ? `Đoạn để thẳng mở rộng +${conn.plainExtensionMm} mm • Trơn hoàn toàn, KHÔNG chạy mí dọc thân trên đoạn kéo dài`
        : 'Đầu ống cắt phẳng +0 mm, không bích kết nối';
    case 'be_chan': {
      const e = conn.beChanEdges;
      const fmt = (m: BeChanEdgeMode) => BE_CHAN_MODE_LABELS[m];
      return `Bích liền thân • Bẻ chân F = ${conn.beChanWidth} mm • Trên: ${fmt(e.top)}, Dưới: ${fmt(e.bottom)}, Trái: ${fmt(e.left)}, Phải: ${fmt(e.right)}`;
    }
    case 'lcct':
      return 'Bích liền thân • Bù phôi +20 mm • Chấn 90° quay vào lòng trong • Kèm khung lưới chắn côn trùng ô vuông có nẹp chia ô';
    case 'end_cap': {
      const walls: WallId[] = ['top', 'bottom', 'left', 'right'];
      const pCount = walls.filter((w) => getEndCapEdgeSeam(conn, w) === 'pittsburgh').length;
      if (pCount === 4) {
        return '4 cạnh Mí kép chờ (+31 mm) • Tự sinh Mảnh bịt đầu rời 4 cạnh Mí đơn (+7 mm vát 45°), có thể đổi từng cạnh sang Mí hàn';
      }
      if (pCount === 0) {
        return `4 cạnh Mí hàn (${conn.endCapSeamType === 'weld_overlap' ? `Hàn chập ${conn.endCapWeldOverlapWidth} mm` : 'Hàn đấu đầu'}) • Phôi đầu ống +0 mm • Tự sinh Mảnh bịt đầu rời`;
      }
      return `Hỗn hợp ${pCount} cạnh Mí gò (+31/+7) & ${4 - pCount} cạnh Mí hàn • Tự sinh Mảnh bịt đầu rời`;
    }
  }
}
