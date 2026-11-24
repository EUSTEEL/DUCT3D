import { FileSpreadsheet, FileText, PanelLeftClose, SlidersHorizontal } from 'lucide-react';
import type {
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  SeamType,
  SheetMaterialType,
  SidebarTab,
  SplitMode,
} from '../types/duct';
import { BlankAnalysisTab } from './BlankAnalysisTab';
import { LsxTab } from './LsxTab';
import { ParamsTab } from './ParamsTab';

interface LeftSidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  onCollapse: () => void;
  config: DuctConfig;
  selectedPartCode: string | null;
  onSelectPart: (partCode: string | null) => void;
  onChange: (patch: Partial<DuctConfig>) => void;
  onDimensionChange: (dim: 'W' | 'H' | 'L', value: number) => void;
  onSheetMaterialChange: (material: SheetMaterialType) => void;
  onUpdateEndConnection: (end: 'c1' | 'c2', patch: Partial<EndConnectionConfig>) => void;
  onCopyC1ToC2: () => void;
  onSelectSplitMode: (mode: SplitMode) => void;
  onToggleAutoSplit: () => void;
  onSwapSeams: () => void;
  onUpdateCornerSeam: (
    cornerId: CornerId,
    patch: { seamType?: SeamType; weldOverlapWidth?: number; inverted?: boolean }
  ) => void;
  onResetCornerOverrides: () => void;
}

export function LeftSidebar({
  activeTab,
  onSelectTab,
  onCollapse,
  config,
  selectedPartCode,
  onSelectPart,
  onChange,
  onDimensionChange,
  onSheetMaterialChange,
  onUpdateEndConnection,
  onCopyC1ToC2,
  onSelectSplitMode,
  onToggleAutoSplit,
  onSwapSeams,
  onUpdateCornerSeam,
  onResetCornerOverrides,
}: LeftSidebarProps) {
  const tabs: { id: SidebarTab; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: 'params', label: 'Thông số', icon: SlidersHorizontal },
    { id: 'lsx', label: 'Nhập LSX', icon: FileText },
    { id: 'blank', label: 'S Phôi', icon: FileSpreadsheet },
  ];

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-[#222d3d] bg-[#11161f] md:w-[340px]">
      {/* Brand Header + Collapse Sidebar Button */}
      <div className="flex items-center justify-between border-b border-[#202b3b] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-sky-500/15 font-mono text-xs font-bold text-sky-400 ring-1 ring-sky-500/35">
              EU
            </span>
            <h1 className="text-sm font-bold tracking-tight text-slate-100">
              EUSTEEL <span className="font-mono font-semibold text-sky-400">DUCT3D</span>
            </h1>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Mô phỏng 3D Cấu tạo Ống gió Thẳng
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded bg-[#1a2433] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-300">
            M1.2
          </span>
          <button
            id="btn-collapse-sidebar"
            type="button"
            onClick={onCollapse}
            title="Thu gọn bảng điều khiển để xem 3D toàn màn hình"
            aria-label="Thu gọn bảng điều khiển"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#243043] bg-[#161e2b] text-slate-400 transition-colors hover:border-sky-500/45 hover:bg-[#1d283a] hover:text-sky-200"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 3-Tab Navigation: Thông số | Nhập LSX | S Phôi */}
      <nav
        className="grid grid-cols-3 border-b border-[#202b3b] bg-[#0e131b] p-1"
        aria-label="Danh mục cấu hình"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[#1c2636] text-sky-200 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Scrollable Tab Body */}
      <div className="cad-scroll flex-1 overflow-y-auto px-3.5 pt-3.5">
        {activeTab === 'params' && (
          <ParamsTab
            config={config}
            selectedPartCode={selectedPartCode}
            onSelectPart={onSelectPart}
            onChange={onChange}
            onDimensionChange={onDimensionChange}
            onSheetMaterialChange={onSheetMaterialChange}
            onUpdateEndConnection={onUpdateEndConnection}
            onCopyC1ToC2={onCopyC1ToC2}
            onSelectSplitMode={onSelectSplitMode}
            onToggleAutoSplit={onToggleAutoSplit}
            onSwapSeams={onSwapSeams}
            onUpdateCornerSeam={onUpdateCornerSeam}
            onResetCornerOverrides={onResetCornerOverrides}
          />
        )}
        {activeTab === 'lsx' && <LsxTab config={config} onApplyConfig={onChange} />}
        {activeTab === 'blank' && (
          <BlankAnalysisTab
            config={config}
            selectedPartCode={selectedPartCode}
            onSelectPart={onSelectPart}
          />
        )}
      </div>
    </aside>
  );
}
