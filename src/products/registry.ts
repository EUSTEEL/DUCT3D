import type { ProductDefinition, ProductGroupMeta } from '../core/types/product';
import { ONG_VUONG_THANG_PRODUCT } from './ong-vuong-thang';

export const DEFAULT_PRODUCT_ID = ONG_VUONG_THANG_PRODUCT.id;

export const PRODUCT_GROUPS: readonly ProductGroupMeta[] = [
  { id: 'ong_thang', label: 'Ống thẳng', order: 1 },
  { id: 'con_thu', label: 'Côn thu', order: 2 },
  { id: 'cut_vuong', label: 'Cút vuông', order: 3 },
  { id: 'z_vuong', label: 'Z vuông', order: 4 },
  { id: 'te_chac', label: 'Tê & Chạc', order: 5 },
  { id: 'hop_gio', label: 'Hộp gió', order: 6 },
  { id: 'ong_phu_kien_tron', label: 'Ống & Phụ kiện tròn', order: 7 },
] as const;

/**
 * Central pluggable Product Registry (7 standardized workshop product groups).
 * - `ProductSelector` builds its branching tree menu automatically from this list.
 * - `TopToolbar` and `FlatPattern2DViewer` read `capabilities` from the active product.
 */
export const PRODUCT_REGISTRY: readonly ProductDefinition[] = [
  // 1. Ống thẳng
  ONG_VUONG_THANG_PRODUCT,

  // 2. Côn thu
  {
    id: 'con-thu-vuong-vuong',
    name: 'Côn thu vuông - vuông',
    shortName: 'Côn vuông - vuông',
    group: 'con_thu',
    groupLabel: 'Côn thu',
    description: 'Côn thu đồng tâm hoặc lệch tâm nối hai tiết diện chữ nhật.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'con-thu-vuong-tron',
    name: 'Côn thu vuông - tròn',
    shortName: 'Côn vuông - tròn',
    group: 'con_thu',
    groupLabel: 'Côn thu',
    description: 'Côn chuyển tiết diện từ đầu vuông sang cổ tròn đồng tâm hoặc lệch tâm.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'con-thu-vuong-tron-ei',
    name: 'Côn thu vuông - tròn EI',
    shortName: 'Côn vuông - tròn EI',
    group: 'con_thu',
    groupLabel: 'Côn thu',
    description: 'Côn chuyển vuông - tròn chuẩn kết cấu chống cháy EI.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },

  // 3. Cút vuông (gộp 90°, 45°, lẻ độ vào thông số góc)
  {
    id: 'cut-vuong',
    name: 'Cút vuông',
    shortName: 'Cút vuông',
    group: 'cut_vuong',
    groupLabel: 'Cút vuông',
    description: 'Cút vuông chuyển hướng tiết diện chữ nhật (chọn góc 90°, 45° hoặc lẻ độ trong thông số).',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'cut-vuong-ei',
    name: 'Cút vuông EI',
    shortName: 'Cút vuông EI',
    group: 'cut_vuong',
    groupLabel: 'Cút vuông',
    description: 'Cút vuông kết cấu chống cháy EI (chọn góc 90°, 45° hoặc lẻ độ trong thông số).',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },

  // 4. Z vuông
  {
    id: 'z-vuong',
    name: 'Z vuông',
    shortName: 'Z vuông',
    group: 'z_vuong',
    groupLabel: 'Z vuông',
    description: 'Ống Z vuông lệch cốt 1 phương hoặc 2 phương.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'z-luon-tron',
    name: 'Z lượn tròn',
    shortName: 'Z lượn tròn',
    group: 'z_vuong',
    groupLabel: 'Z vuông',
    description: 'Ống Z vuông bo cong lượn tròn giảm tổn thất áp suất.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },

  // 5. Tê & Chạc
  {
    id: 'te-vuong',
    name: 'Tê vuông',
    shortName: 'Tê vuông',
    group: 'te_chac',
    groupLabel: 'Tê & Chạc',
    description: 'Tê vuông phân nhánh tiết diện chữ nhật.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'chac-3',
    name: 'Chạc 3',
    shortName: 'Chạc 3',
    group: 'te_chac',
    groupLabel: 'Tê & Chạc',
    description: 'Chạc 3 (chạc Y) chia nhánh hai hướng tiết diện chữ nhật.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'chac-4',
    name: 'Chạc 4',
    shortName: 'Chạc 4',
    group: 'te_chac',
    groupLabel: 'Tê & Chạc',
    description: 'Chạc 4 phân nhánh ba hướng từ ống chính tiết diện chữ nhật.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'te-chac-ei',
    name: 'Tê / Chạc EI',
    shortName: 'Tê / Chạc EI',
    group: 'te_chac',
    groupLabel: 'Tê & Chạc',
    description: 'Tê vuông và chạc chia nhánh kết cấu chống cháy EI.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },

  // 6. Hộp gió
  {
    id: 'hop-gio-mang',
    name: 'Hộp gió / Máng',
    shortName: 'Hộp gió / Máng',
    group: 'hop_gio',
    groupLabel: 'Hộp gió',
    description: 'Hộp góp gió kỹ thuật và máng gió vuông chữ nhật.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'hop-dau-may',
    name: 'Hộp đầu máy',
    shortName: 'Hộp đầu máy',
    group: 'hop_gio',
    groupLabel: 'Hộp gió',
    description: 'Hộp kết nối đầu máy điều hòa / quạt thông gió.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: true,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },

  // 7. Ống & Phụ kiện tròn
  {
    id: 'ong-tron-tron',
    name: 'Ống tròn trơn',
    shortName: 'Ống tròn trơn',
    group: 'ong_phu_kien_tron',
    groupLabel: 'Ống & Phụ kiện tròn',
    description: 'Ống gió tròn trơn hàn dọc hoặc ghép mí dọc.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'ong-tron-xoan',
    name: 'Ống tròn xoắn',
    shortName: 'Ống tròn xoắn',
    group: 'ong_phu_kien_tron',
    groupLabel: 'Ống & Phụ kiện tròn',
    description: 'Ống gió tròn xoắn cuốn băng (không dùng trải phẳng chấn 90°).',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: false,
      dxfSupported: false,
      freeMergeSupported: false,
    },
  },
  {
    id: 'cut-tron',
    name: 'Cút tròn',
    shortName: 'Cút tròn',
    group: 'ong_phu_kien_tron',
    groupLabel: 'Ống & Phụ kiện tròn',
    description: 'Cút tròn ghép múi 90° / 45° / lẻ độ trải phẳng từng múi cắt Laser.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'con-tron',
    name: 'Côn tròn',
    shortName: 'Côn tròn',
    group: 'ong_phu_kien_tron',
    groupLabel: 'Ống & Phụ kiện tròn',
    description: 'Côn thu tròn đồng tâm hoặc lệch tâm trải phẳng cắt Laser.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'z-tron',
    name: 'Z tròn',
    shortName: 'Z tròn',
    group: 'ong_phu_kien_tron',
    groupLabel: 'Ống & Phụ kiện tròn',
    description: 'Ống Z tròn lệch cốt ghép múi cắt Laser.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
  {
    id: 'te-chac-tron',
    name: 'Tê / Chạc tròn',
    shortName: 'Tê / Chạc tròn',
    group: 'ong_phu_kien_tron',
    groupLabel: 'Ống & Phụ kiện tròn',
    description: 'Tê tròn và chạc chia nhánh tiết diện tròn trải phẳng khai triển giao tuyến.',
    status: 'coming_soon',
    capabilities: {
      unfoldSupported: false,
      flatPatternSupported: true,
      dxfSupported: true,
      freeMergeSupported: false,
    },
  },
] as const;

export function getProductById(productId: string): ProductDefinition {
  return (
    PRODUCT_REGISTRY.find((p) => p.id === productId) ?? ONG_VUONG_THANG_PRODUCT
  );
}
