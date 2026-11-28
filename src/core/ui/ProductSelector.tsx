import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, FolderTree, Lock } from 'lucide-react';
import {
  PRODUCT_GROUPS,
  PRODUCT_REGISTRY,
  getProductById,
} from '../../products/registry';
import type { ProductDefinition, ProductGroupId } from '../types/product';

interface ProductSelectorProps {
  activeProductId: string;
  onSelectProduct: (productId: string) => void;
}

/**
 * Compact branching product-tree selector embedded cleanly in `LeftSidebar`.
 * Automatically reads the 7 product groups, items, status badges, and capabilities
 * directly from `src/products/registry.ts`.
 */
export function ProductSelector({
  activeProductId,
  onSelectProduct,
}: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<ProductGroupId, boolean>>({
    ong_thang: true,
    con_thu: false,
    cut_vuong: false,
    z_vuong: false,
    te_chac: false,
    hop_gio: false,
    ong_phu_kien_tron: false,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeProduct = useMemo(() => getProductById(activeProductId), [activeProductId]);

  const groupedProducts = useMemo(() => {
    const map = new Map<ProductGroupId, ProductDefinition[]>();
    for (const g of PRODUCT_GROUPS) map.set(g.id, []);
    for (const prod of PRODUCT_REGISTRY) {
      const list = map.get(prod.group);
      if (list) list.push(prod);
    }
    return [...PRODUCT_GROUPS]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        group: g,
        items: map.get(g.id) ?? [],
      }))
      .filter((entry) => entry.items.length > 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleGroup = (gid: ProductGroupId) => {
    setExpandedGroups((prev) => ({ ...prev, [gid]: !prev[gid] }));
  };

  return (
    <div ref={rootRef} className="relative border-b border-[#202b3b] bg-[#0e141e] px-3 py-2">
      <button
        id="btn-product-selector"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="tree"
        title="Chọn loại sản phẩm / phụ kiện trong thư viện EUSTEEL"
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
          open
            ? 'border-sky-500/60 bg-sky-500/12 text-white'
            : 'border-[#233044] bg-[#131b28] text-slate-100 hover:border-sky-500/45 hover:bg-[#172233]'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FolderTree className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-100">
              {activeProduct.name}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180 text-sky-300' : ''
          }`}
        />
      </button>

      {/* Branching 7-Group Product Tree Popover */}
      {open && (
        <div
          id="product-selector-tree"
          role="tree"
          aria-label="Danh mục sản phẩm ống gió"
          className="cad-scroll absolute right-3 left-3 z-40 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-[#2b3c56] bg-[#0d141f]/98 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            <span>Danh mục sản phẩm ({PRODUCT_GROUPS.length} nhóm)</span>
            <span className="font-mono text-[9.5px] text-emerald-300">
              {PRODUCT_REGISTRY.filter((p) => p.status === 'active').length} sẵn sàng
            </span>
          </div>

          <div className="space-y-1">
            {groupedProducts.map(({ group, items }) => {
              const isExpanded = expandedGroups[group.id];
              const activeCount = items.filter((i) => i.status === 'active').length;
              return (
                <div
                  key={group.id}
                  role="treeitem"
                  aria-expanded={isExpanded}
                  className="rounded-lg bg-[#111927]/80"
                >
                  <button
                    id={`product-group-${group.id}`}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-slate-200 transition-colors hover:bg-[#192538] hover:text-white"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-sky-400" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />
                      )}
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[9.5px] text-slate-400">
                      {activeCount > 0 ? `${activeCount}/${items.length}` : `${items.length}`}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="space-y-0.5 pr-1.5 pb-1.5 pl-4">
                      {items.map((prod) => {
                        const isSelected = prod.id === activeProduct.id;
                        const isActive = prod.status === 'active';
                        return (
                          <button
                            key={prod.id}
                            id={`product-item-${prod.id}`}
                            type="button"
                            disabled={!isActive}
                            onClick={() => {
                              if (!isActive) return;
                              onSelectProduct(prod.id);
                              setOpen(false);
                            }}
                            title={prod.description}
                            className={`flex w-full items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors ${
                              isSelected
                                ? 'border-sky-500/60 bg-sky-500/20 text-white'
                                : isActive
                                  ? 'border-transparent bg-[#152031] text-slate-200 hover:border-sky-500/40 hover:bg-[#1b2940]'
                                  : 'cursor-not-allowed border-transparent bg-transparent text-slate-500'
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                              {prod.name}
                            </span>

                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                            ) : !isActive ? (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-slate-800/90 px-1 py-0.5 text-[8.5px] font-medium text-slate-500">
                                <Lock className="h-2.5 w-2.5" />
                                Chặng sau
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
