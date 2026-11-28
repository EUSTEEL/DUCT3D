import type { FaceId } from '../../core/types/duct';

/**
 * Placeholder type scaffolding for Phân hệ 10 — Lớp bọc bảo ôn & chống cháy EI
 * (bọc tấm EI, xốp PE/cao su lưu hóa, bông thủy tinh, áo tôn bọc ngoài, tiêu âm).
 *
 * Pure Refactor (Bước 2): type contracts only — no runtime 3D/2D geometry changes yet.
 */

export type InsulationLayerKind =
  | 'ei_board' // Tấm chống cháy EI (thạch cao / MGO / calcium silicate)
  | 'foam_pe' // Xốp bảo ôn PE / cao su lưu hóa
  | 'glass_wool' // Bông thủy tinh / bông khoáng tỷ trọng cao
  | 'metal_cladding' // Lớp áo tôn / nhôm bọc bảo vệ ngoài trời
  | 'acoustic_liner'; // Lớp lót tiêu âm lòng trong ống

export const INSULATION_LAYER_LABELS: Record<InsulationLayerKind, string> = {
  ei_board: 'Bọc tấm chống cháy EI',
  foam_pe: 'Bảo ôn xốp',
  glass_wool: 'Bông thủy tinh / khoáng',
  metal_cladding: 'Áo tôn bọc ngoài',
  acoustic_liner: 'Lót tiêu âm',
};

export interface InsulationLayerSpec {
  id: string;
  kind: InsulationLayerKind;
  /** Layer thickness in mm */
  thicknessMm: number;
  /** Optional fire-resistance rating label for EI assemblies (e.g. 'EI30', 'EI45', 'EI60', 'EI90', 'EI120') */
  eiRating?: 'EI30' | 'EI45' | 'EI60' | 'EI90' | 'EI120';
  /** Faces covered by this layer (empty / omitted = all active outer faces) */
  faces?: FaceId[];
  enabled: boolean;
}

export interface InsulationAddonState {
  enabled: boolean;
  layers: InsulationLayerSpec[];
}

export const EMPTY_INSULATION_STATE: InsulationAddonState = {
  enabled: false,
  layers: [],
};
