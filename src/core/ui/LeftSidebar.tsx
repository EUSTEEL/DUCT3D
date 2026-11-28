import type { ReactNode } from 'react';
import { FileSpreadsheet, FileText, PanelLeftClose, SlidersHorizontal } from 'lucide-react';
import type { SidebarTab } from '../types/duct';
import type { ProductDefinition } from '../types/product';
import { ProductSelector } from './ProductSelector';

interface LeftSidebarProps {
  activeProduct: ProductDefinition;
  onSelectProduct: (productId: string) => void;
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  onCollapse: () => void;
  paramsContent: ReactNode;
  lsxContent: ReactNode;
  blankContent: ReactNode;
}

export function LeftSidebar({
  activeProduct,
  onSelectProduct,
  activeTab,
  onSelectTab,
  onCollapse,
  paramsContent,
  lsxContent,
  blankContent,
}: LeftSidebarProps) {
  const tabs: { id: SidebarTab; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: 'params', label: 'Thông số', icon: SlidersHorizontal },
    { id: 'lsx', label: 'Nhập LSX', icon: FileText },
    { id: 'blank', label: 'S Phôi', icon: FileSpreadsheet },
  ];

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-[#222d3d] bg-[#11161f] md:w-[320px]">
      {/* Brand Header + Collapse Sidebar Button */}
      <div className="flex items-center justify-between border-b border-[#202b3b] px-4 py-2.5">
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
            Mô phỏng 3D Cấu tạo {activeProduct.name}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Compact Branching Product Selector (driven automatically by products/registry.ts) */}
      <ProductSelector
        activeProductId={activeProduct.id}
        onSelectProduct={onSelectProduct}
      />

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

      {/* Scrollable Tab Body (injected per active product) */}
      <div className="cad-scroll flex-1 overflow-y-auto px-3.5 pt-3">
        {activeTab === 'params' && paramsContent}
        {activeTab === 'lsx' && lsxContent}
        {activeTab === 'blank' && blankContent}
      </div>
    </aside>
  );
}
