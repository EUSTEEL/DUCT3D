import type { ProductDefinition } from '../../core/types/product';

export { DuctAssembly } from './DuctAssembly';
export { buildStraightDuctFlatPattern } from './flatPattern2D';
export {
  buildUnfoldableDuctRig,
  disposeUnfoldableDuctRig,
  evaluateAccessoryRetractFactor,
  evaluatePieceRuntimePose,
  getFaceBasis3D,
} from './geometry3D';
export { BlankAnalysisTab } from './ui/BlankAnalysisTab';
export { LsxTab } from './ui/LsxTab';
export { ParamsTab } from './ui/ParamsTab';

/**
 * Product Registration: Ống vuông thẳng (Straight Rectangular Duct).
 */
export const ONG_VUONG_THANG_PRODUCT: ProductDefinition = {
  id: 'ong-vuong-thang',
  name: 'Ống vuông thẳng',
  shortName: 'Ống vuông thẳng',
  group: 'ong_thang',
  groupLabel: 'Ống thẳng',
  description:
    'Ống gió thẳng tiết diện chữ nhật: 9 loại đầu kết nối (Kết nối 1 / Kết nối 2), chia mảnh theo khổ tôn, ghép tự do 4–6 mặt, mở phôi 3D, trải phẳng 2D & xuất DXF.',
  status: 'active',
  capabilities: {
    unfoldSupported: true,
    flatPatternSupported: true,
    dxfSupported: true,
    freeMergeSupported: true,
  },
};
