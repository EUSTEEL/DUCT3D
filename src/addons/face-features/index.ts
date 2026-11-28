import type { FaceId } from '../../core/types/duct';

/**
 * Placeholder type scaffolding for Phân hệ 8 — Chi tiết gắn trên mặt ống / phụ kiện
 * (lỗ trổ, chân rẽ, cổ trích, cửa thăm, tai treo, tyren, V gia cường, cánh hướng dòng, giật cổ).
 *
 * Pure Refactor (Bước 2): type contracts only — no runtime 3D/2D geometry changes yet.
 */

export type FaceFeatureKind =
  | 'hole_cutout' // Lỗ trổ vuông / chữ nhật / tròn trên vách ống
  | 'branch_takeoff' // Chân rẽ (gót giày / vuông-tròn / vuông-vuông)
  | 'collar_spigot' // Cổ trích / cổ bạt tròn hoặc vuông
  | 'access_door' // Cửa thăm kiểm tra / vệ sinh
  | 'hanging_bracket' // Tai treo / bát treo dập lỗ oval
  | 'tie_rod' // Tyren xuyên tâm chống phồng
  | 'angle_stiffener_v' // Thanh thép V gia cường thân ống
  | 'turning_vane' // Cánh hướng dòng bên trong cút/chuyển hướng
  | 'neck_offset'; // Giật cổ / giật cấp tránh dầm

export const FACE_FEATURE_LABELS: Record<FaceFeatureKind, string> = {
  hole_cutout: 'Lỗ trổ trên vách',
  branch_takeoff: 'Chân rẽ',
  collar_spigot: 'Cổ trích',
  access_door: 'Cửa thăm',
  hanging_bracket: 'Tai treo',
  tie_rod: 'Tyren xuyên tâm',
  angle_stiffener_v: 'V gia cường',
  turning_vane: 'Cánh hướng dòng',
  neck_offset: 'Giật cổ',
};

export interface FaceFeatureBase {
  id: string;
  kind: FaceFeatureKind;
  /** Target duct face where this feature attaches */
  face: FaceId;
  /** Center position along face's local horizontal axis (mm) */
  offsetXMm: number;
  /** Center position along face's local longitudinal axis (mm) */
  offsetZMm: number;
  enabled: boolean;
  label?: string;
}

export interface RectangularCutoutFeature extends FaceFeatureBase {
  kind: 'hole_cutout' | 'branch_takeoff' | 'collar_spigot' | 'access_door' | 'neck_offset';
  shape: 'rect' | 'round';
  widthMm: number;
  heightMm?: number;
  diameterMm?: number;
  collarLengthMm?: number;
}

export interface StructuralHardwareFeature extends FaceFeatureBase {
  kind: 'hanging_bracket' | 'tie_rod' | 'angle_stiffener_v' | 'turning_vane';
  spec?: string;
  quantity?: number;
}

export type FaceFeatureAttachment = RectangularCutoutFeature | StructuralHardwareFeature;

export interface FaceFeatureAddonState {
  enabled: boolean;
  items: FaceFeatureAttachment[];
}

export const EMPTY_FACE_FEATURE_STATE: FaceFeatureAddonState = {
  enabled: false,
  items: [],
};
