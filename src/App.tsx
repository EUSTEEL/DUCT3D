import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelLeftOpen, X } from 'lucide-react';
import { FlatPattern2DViewer } from './components/FlatPattern2DViewer';
import { LeftSidebar } from './components/LeftSidebar';
import { SelectionContextUI } from './components/SelectionContextUI';
import { TopToolbar } from './components/TopToolbar';
import { ViewportOverlays } from './components/ViewportOverlays';
import { WorkshopSettingsModal } from './components/WorkshopSettingsModal';
import {
  CORNER_LABELS,
  DEFAULT_DUCT_CONFIG,
  evaluateSplitForConfig,
  normalizeThicknessForMaterial,
} from './domain/ductRules';
import { buildStraightDuctFlatPattern } from './domain/flatPatternBuilder';
import {
  DEFAULT_WORKSHOP_SETTINGS,
  loadWorkshopSettings,
  saveWorkshopSettings,
} from './domain/workshopSettings';
import { DuctScene, type CameraCommand } from './three/DuctScene';
import type {
  CameraPreset,
  ContextMenuState,
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  SeamType,
  SelectionTarget,
  SheetMaterialType,
  SidebarTab,
  SplitMode,
  ViewportMode,
  WorkshopSettings,
} from './types/duct';

export function App() {
  const [config, setConfig] = useState<DuctConfig>(DEFAULT_DUCT_CONFIG);
  const [workshopSettings, setWorkshopSettings] = useState<WorkshopSettings>(() =>
    loadWorkshopSettings()
  );
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('params');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('3d');
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [focusPartRequest, setFocusPartRequest] = useState<{ partCode: string; seq: number } | null>(
    null
  );
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({
    preset: 'iso',
    seq: 0,
  });

  // Persist Workshop Settings to localStorage automatically
  useEffect(() => {
    saveWorkshopSettings(workshopSettings);
  }, [workshopSettings]);

  const flatPatternDoc = useMemo(
    () => buildStraightDuctFlatPattern(config, workshopSettings),
    [config, workshopSettings]
  );

  const handleWorkshopSettingsChange = useCallback((nextSettings: WorkshopSettings) => {
    setWorkshopSettings(nextSettings);
    setConfig((prev) => {
      if (!prev.autoSplit) return prev;
      const rec = evaluateSplitForConfig(
        prev.W,
        prev.H,
        prev.L,
        prev.sheetMaterial,
        prev.c1,
        prev.c2,
        nextSettings
      );
      if (rec.recommended !== prev.splitMode) {
        return { ...prev, splitMode: rec.recommended, seamOverrides: {} };
      }
      return prev;
    });
  }, []);

  const handleResetWorkshopSettings = useCallback(() => {
    handleWorkshopSettingsChange({ ...DEFAULT_WORKSHOP_SETTINGS });
  }, [handleWorkshopSettingsChange]);

  const handlePatchConfig = useCallback((patch: Partial<DuctConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleDimensionChange = useCallback(
    (dim: 'W' | 'H' | 'L', value: number) => {
      setConfig((prev) => {
        const next = { ...prev, [dim]: value };
        if (next.autoSplit) {
          const rec = evaluateSplitForConfig(
            next.W,
            next.H,
            next.L,
            next.sheetMaterial,
            next.c1,
            next.c2,
            workshopSettings
          );
          if (rec.recommended !== next.splitMode) {
            next.splitMode = rec.recommended;
            next.seamOverrides = {};
          }
        }
        return next;
      });
    },
    [workshopSettings]
  );

  const handleSheetMaterialChange = useCallback(
    (material: SheetMaterialType) => {
      setConfig((prev) => {
        const nextThickness = normalizeThicknessForMaterial(prev.thickness, material);
        const next: DuctConfig = {
          ...prev,
          sheetMaterial: material,
          thickness: nextThickness,
        };
        if (next.autoSplit) {
          const rec = evaluateSplitForConfig(
            next.W,
            next.H,
            next.L,
            material,
            next.c1,
            next.c2,
            workshopSettings
          );
          if (rec.recommended !== next.splitMode) {
            next.splitMode = rec.recommended;
            next.seamOverrides = {};
          }
        }
        return next;
      });
    },
    [workshopSettings]
  );

  const handleUpdateEndConnection = useCallback(
    (end: 'c1' | 'c2', patch: Partial<EndConnectionConfig>) => {
      setConfig((prev) => {
        const next: DuctConfig = {
          ...prev,
          [end]: {
            ...prev[end],
            ...patch,
          },
        };
        if (next.autoSplit) {
          const rec = evaluateSplitForConfig(
            next.W,
            next.H,
            next.L,
            next.sheetMaterial,
            next.c1,
            next.c2,
            workshopSettings
          );
          if (rec.recommended !== next.splitMode) {
            next.splitMode = rec.recommended;
            next.seamOverrides = {};
          }
        }
        return next;
      });
    },
    [workshopSettings]
  );

  const handleApplyEndToBoth = useCallback(
    (sourceEnd: 'c1' | 'c2') => {
      setConfig((prev) => {
        const src = prev[sourceEnd];
        const cloned: EndConnectionConfig = {
          ...src,
          beChanEdges: { ...src.beChanEdges },
          endCapEdgeSeams: { ...src.endCapEdgeSeams },
        };
        const next: DuctConfig = {
          ...prev,
          c1: sourceEnd === 'c1' ? prev.c1 : cloned,
          c2: sourceEnd === 'c2' ? prev.c2 : cloned,
        };
        if (next.autoSplit) {
          const rec = evaluateSplitForConfig(
            next.W,
            next.H,
            next.L,
            next.sheetMaterial,
            next.c1,
            next.c2,
            workshopSettings
          );
          if (rec.recommended !== next.splitMode) {
            next.splitMode = rec.recommended;
            next.seamOverrides = {};
          }
        }
        return next;
      });
    },
    [workshopSettings]
  );

  const handleCopyC1ToC2 = useCallback(() => {
    handleApplyEndToBoth('c1');
  }, [handleApplyEndToBoth]);

  const handleSelectSplitMode = useCallback(
    (mode: SplitMode) => {
      setSelection(null);
      setContextMenu(null);
      setConfig((prev) => {
        const rec = evaluateSplitForConfig(
          prev.W,
          prev.H,
          prev.L,
          prev.sheetMaterial,
          prev.c1,
          prev.c2,
          workshopSettings
        );
        return {
          ...prev,
          splitMode: mode,
          autoSplit: mode === rec.recommended,
          seamOverrides: {},
        };
      });
    },
    [workshopSettings]
  );

  const handleToggleAutoSplit = useCallback(() => {
    setConfig((prev) => {
      const nextAuto = !prev.autoSplit;
      if (nextAuto) {
        const rec = evaluateSplitForConfig(
          prev.W,
          prev.H,
          prev.L,
          prev.sheetMaterial,
          prev.c1,
          prev.c2,
          workshopSettings
        );
        return {
          ...prev,
          autoSplit: true,
          splitMode: rec.recommended,
          seamOverrides: {},
        };
      }
      return { ...prev, autoSplit: false };
    });
  }, [workshopSettings]);

  const handleSwapSeams = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      swapSeamRoles: !prev.swapSeamRoles,
    }));
  }, []);

  const handleUpdateCornerSeam = useCallback(
    (
      cornerId: CornerId,
      patch: { seamType?: SeamType; weldOverlapWidth?: number; inverted?: boolean }
    ) => {
      setConfig((prev) => ({
        ...prev,
        seamOverrides: {
          ...prev.seamOverrides,
          [cornerId]: {
            ...prev.seamOverrides[cornerId],
            ...patch,
          },
        },
      }));
    },
    []
  );

  const handleResetCornerOverrides = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      seamOverrides: {},
    }));
  }, []);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraCommand((prev) => ({ preset, seq: prev.seq + 1 }));
  }, []);

  const handleFocusPiece = useCallback((partCode: string) => {
    setFocusPartRequest((prev) => ({ partCode, seq: (prev?.seq ?? 0) + 1 }));
    setCameraCommand((prev) => ({ preset: 'focus_part', focusPartCode: partCode, seq: prev.seq + 1 }));
  }, []);

  const handleOpenContextMenu = useCallback(
    (x: number, y: number, target: NonNullable<SelectionTarget>) => {
      setContextMenu({ x, y, target });
    },
    []
  );

  const handleSelectTarget = useCallback((target: SelectionTarget) => {
    setContextMenu(null);
    setSelection(target);
  }, []);

  const show3D = viewportMode === '3d' || viewportMode === 'split';
  const show2D = viewportMode === '2d' || viewportMode === 'split';
  const isSplit = viewportMode === 'split';

  const pure2dPill = selection
    ? selection.kind === 'piece'
      ? { prefix: 'Đang chọn mảnh:', code: selection.partCode }
      : selection.kind === 'end'
        ? { prefix: 'Đang chọn đầu:', code: selection.endKey.toUpperCase() }
        : { prefix: 'Đang chọn mí:', code: CORNER_LABELS[selection.cornerId] }
    : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0f141d] text-slate-100 md:flex-row">
      {/* Slim Left Engineering Control Sidebar (collapsible for 100% fullscreen 3D/2D) */}
      {sidebarOpen && (
        <LeftSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCollapse={() => setSidebarOpen(false)}
          config={config}
          workshopSettings={workshopSettings}
          selection={selection}
          onSelectTarget={handleSelectTarget}
          onChange={handlePatchConfig}
          onDimensionChange={handleDimensionChange}
          onSheetMaterialChange={handleSheetMaterialChange}
          onCopyC1ToC2={handleCopyC1ToC2}
          onSelectSplitMode={handleSelectSplitMode}
          onToggleAutoSplit={handleToggleAutoSplit}
          onSwapSeams={handleSwapSeams}
        />
      )}

      {/* Right Main Workspace: Quick Toolbar + 3D / 2D / Split Viewport */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopToolbar
          config={config}
          viewportMode={viewportMode}
          onChangeViewportMode={setViewportMode}
          flatPatternSupported={true}
          unfoldSupported={true}
          onChange={handlePatchConfig}
          onSwapSeams={handleSwapSeams}
          onOpenWorkshopSettings={() => setSettingsModalOpen(true)}
        />
        <div
          className={`relative min-h-0 flex-1 overflow-hidden ${
            isSplit ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex'
          }`}
        >
          {/* 3D Studio Viewport Pane (kept mounted & paused in 2D-only mode to preserve camera/textures with zero WebGL context churn) */}
          <div
            className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${
              !show3D
                ? 'hidden'
                : isSplit
                  ? 'border-b border-[#222d3d] lg:border-r lg:border-b-0'
                  : ''
            }`}
          >
            <DuctScene
              config={config}
              ribPitchMm={workshopSettings.ribPitchMm}
              cameraCommand={cameraCommand}
              selection={selection}
              active={show3D}
              onSelectTarget={handleSelectTarget}
              onOpenContextMenu={handleOpenContextMenu}
            />
            {show3D && (
              <ViewportOverlays
                config={config}
                sidebarOpen={sidebarOpen}
                selection={selection}
                onClearSelection={() => setSelection(null)}
                onExpandSidebar={() => setSidebarOpen(true)}
                onCameraPreset={handleCameraPreset}
                compact={isSplit}
              />
            )}
          </div>

          {/* Pluggable 2D Laser Flat-Pattern Viewport Pane */}
          {show2D && (
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              {/* When in pure 2D mode, keep sidebar expand & selected-target pill accessible */}
              {!show3D && (!sidebarOpen || pure2dPill) && (
                <div className="absolute top-12 left-3 z-20 flex items-center gap-2">
                  {!sidebarOpen && (
                    <button
                      id="btn-expand-sidebar"
                      type="button"
                      onClick={() => setSidebarOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a3950] bg-[#0e141e]/90 px-3 py-1.5 text-xs font-medium text-sky-200 shadow-lg backdrop-blur-md transition-colors hover:border-sky-500/60 hover:bg-[#162030] hover:text-white"
                      title="Mở lại bảng điều khiển bên trái"
                    >
                      <PanelLeftOpen className="h-4 w-4 text-sky-400" />
                      <span>Bảng điều khiển</span>
                    </button>
                  )}
                  {pure2dPill && (
                    <div
                      id="pill-selected-part"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/55 bg-sky-500/18 px-2.5 py-1 text-xs font-medium text-sky-100 shadow-lg backdrop-blur-md"
                    >
                      <span>{pure2dPill.prefix}</span>
                      <strong className="font-mono font-bold text-white">{pure2dPill.code}</strong>
                      <button
                        type="button"
                        onClick={() => setSelection(null)}
                        aria-label="Bỏ chọn"
                        className="ml-0.5 rounded p-0.5 text-sky-200 hover:bg-sky-400/25 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <FlatPattern2DViewer
                document={flatPatternDoc}
                technicalMode={config.materialMode === 'technical'}
                selection={selection}
                onSelectTarget={handleSelectTarget}
                onOpenContextMenu={handleOpenContextMenu}
                focusPartRequest={focusPartRequest}
                compact={isSplit}
              />
            </div>
          )}
        </div>
      </main>

      {/* Right-Click CAD Context Menu & Compact Floating Inspector Card */}
      <SelectionContextUI
        config={config}
        workshopSettings={workshopSettings}
        selection={selection}
        contextMenu={contextMenu}
        onCloseContextMenu={() => setContextMenu(null)}
        onSelectTarget={handleSelectTarget}
        onFocusPiece={handleFocusPiece}
        onUpdateEndConnection={handleUpdateEndConnection}
        onApplyEndToBoth={handleApplyEndToBoth}
        onUpdateCornerSeam={handleUpdateCornerSeam}
        onResetCornerOverrides={handleResetCornerOverrides}
        onPatchConfig={handlePatchConfig}
      />

      {/* Workshop / Machine Settings Popup Modal */}
      <WorkshopSettingsModal
        open={settingsModalOpen}
        settings={workshopSettings}
        onChange={handleWorkshopSettingsChange}
        onReset={handleResetWorkshopSettings}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}

export default App;
