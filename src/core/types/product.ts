/**
 * Pluggable Product Definition types powering the central product registry (`products/registry.ts`),
 * branching ProductSelector tree menu, and capability-driven 3D/2D/DXF viewport controls.
 */

export type ProductGroupId =
  | 'ong_thang'
  | 'con_thu'
  | 'cut_vuong'
  | 'z_vuong'
  | 'te_chac'
  | 'hop_gio'
  | 'ong_phu_kien_tron';

export type ProductStatus = 'active' | 'coming_soon';

export interface ProductCapabilities {
  /** True when the product supports 60fps 3D sheet unfolding (`Mở phôi 3D`) */
  unfoldSupported: boolean;
  /** True when the product has a 2D flat pattern blueprint (`Trải phẳng 2D` & `Song song 3D + 2D`) */
  flatPatternSupported: boolean;
  /** True when the product can export 1:1 mm CNC Laser DXF (`Tải file DXF`) */
  dxfSupported: boolean;
  /** True when the product supports interactive Face–Edge free-merge topology (`Ghép tự do`) */
  freeMergeSupported?: boolean;
}

export interface ProductDefinition {
  id: string;
  name: string;
  shortName?: string;
  group: ProductGroupId;
  groupLabel: string;
  description: string;
  status: ProductStatus;
  capabilities: ProductCapabilities;
}

export interface ProductGroupMeta {
  id: ProductGroupId;
  label: string;
  order: number;
}
