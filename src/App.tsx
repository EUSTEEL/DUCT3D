import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PanelLeftOpen, Sliders, Undo2, X } from 'lucide-react';
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
import { buildStraightDuctFlatPattern } from './domain/flatPattern2D';
import {
  buildFreeMergePresetEdges,
  FOLD_EDGE_DEFS,
  getDefaultEdgeStatesForSplitMode,
  validateSetEdgeToBend,
  type FreeMergePresetId,
} from './domain/foldGraph';
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
  EdgeJoinMode,
  EndConnectionConfig,
  FoldEdgeId,
  FreeMergeNotice,
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
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [freeMergeNotice, setFreeMergeNotice] = useState<FreeMergeNotice | null>(null);
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
      if (!prev.autoSplit || prev.freeMergeMode) return prev;
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
    if (patch.freeMergeMode === false) {
      setFreeMergeNotice(null);
    }
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleDimensionChange = useCallback(
    (dim: 'W' | 'H' | 'L', value: number) => {
      setConfig((prev) => {
        const next = { ...prev, [dim]: value };
        if (next.autoSplit && !next.freeMergeMode) {
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
        if (next.autoSplit && !next.freeMergeMode) {
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
      setFreeMergeNotice(null);
      setConfig((prev) => {
        const next: DuctConfig = {
          ...prev,
          [end]: {
            ...prev[end],
            ...patch,
          },
        };
        if (next.autoSplit && !next.freeMergeMode) {
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
      setFreeMergeNotice(null);
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
        if (next.autoSplit && !next.freeMergeMode) {
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
      setInspectorOpen(false);
      setContextMenu(null);
      setFreeMergeNotice(null);
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
          freeMergeMode: false,
          customEdgeStates: {},
          seamOverrides: {},
        };
      });
    },
    [workshopSettings]
  );

  const handleToggleAutoSplit = useCallback(() => {
    setFreeMergeNotice(null);
    setConfig((prev) => {
      const nextAuto = !(prev.autoSplit && !prev.freeMergeMode);
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
          freeMergeMode: false,
          customEdgeStates: {},
          splitMode: rec.recommended,
          seamOverrides: {},
        };
      }
      return { ...prev, autoSplit: false };
    });
  }, [workshopSettings]);

  const handleToggleFreeMergeMode = useCallback(() => {
    setFreeMergeNotice(null);
    setConfig((prev) => {
      if (prev.freeMergeMode) {
        return { ...prev, freeMergeMode: false };
      }
      return {
        ...prev,
        freeMergeMode: true,
        autoSplit: false,
        customEdgeStates: getDefaultEdgeStatesForSplitMode(prev.splitMode),
      };
    });
  }, []);

  const handleSetEdgeMode = useCallback(
    (edgeId: FoldEdgeId, nextMode: EdgeJoinMode) => {
      const baseStates = config.freeMergeMode
        ? { ...config.customEdgeStates }
        : getDefaultEdgeStatesForSplitMode(config.splitMode);
      const testCfg: DuctConfig = {
        ...config,
        freeMergeMode: true,
        autoSplit: false,
        customEdgeStates: baseStates,
      };
      if (nextMode === 'bend') {
        const check = validateSetEdgeToBend(testCfg, edgeId);
        if (!check.allowed && check.wouldFormCycle && check.suggestedSplitEdgeId) {
          const splitId = check.suggestedSplitEdgeId;
          const edgeShort = FOLD_EDGE_DEFS[edgeId].shortLabel;
          const splitShort = FOLD_EDGE_DEFS[splitId].shortLabel;
          const loopTxt = check.cycleFaceLabels?.length
            ? ` (vòng ${check.cycleFaceLabels.join(' – ')})`
            : '';
          setConfig({
            ...testCfg,
            customEdgeStates: {
              ...baseStates,
              [splitId]: 'seam',
              [edgeId]: 'bend',
            },
          });
          setFreeMergeNotice({
            message: `Đã gộp ${edgeShort} — tự mở mí ${splitShort} để giữ tấm trải phẳng${loopTxt}`,
            targetEdgeId: edgeId,
            appliedSplitEdgeId: splitId,
            alternativeSplitEdges: check.breakableCycleEdges,
            baseEdgeStates: baseStates,
            prevFreeMergeMode: config.freeMergeMode,
          });
          return;
        }
        if (!check.allowed) {
          return;
        }
      }
      setFreeMergeNotice(null);
      setConfig({
        ...testCfg,
        customEdgeStates: {
          ...baseStates,
          [edgeId]: nextMode,
        },
      });
    },
    [config]
  );

  const handleSwapEdgeMerge = useCallback(
    (mergeEdgeId: FoldEdgeId, splitEdgeId: FoldEdgeId) => {
      const baseStates = config.freeMergeMode
        ? { ...config.customEdgeStates }
        : getDefaultEdgeStatesForSplitMode(config.splitMode);
      setFreeMergeNotice(null);
      setConfig({
        ...config,
        freeMergeMode: true,
        autoSplit: false,
        customEdgeStates: {
          ...baseStates,
          [splitEdgeId]: 'seam',
          [mergeEdgeId]: 'bend',
        },
      });
    },
    [config]
  );

  const handleSwitchAutoSplitEdge = useCallback(
    (altSplitEdgeId: FoldEdgeId) => {
      if (!freeMergeNotice) return;
      const { targetEdgeId, baseEdgeStates, alternativeSplitEdges, prevFreeMergeMode } =
        freeMergeNotice;
      const edgeShort = FOLD_EDGE_DEFS[targetEdgeId].shortLabel;
      const splitShort = FOLD_EDGE_DEFS[altSplitEdgeId].shortLabel;
      setConfig((prev) => ({
        ...prev,
        freeMergeMode: true,
        autoSplit: false,
        customEdgeStates: {
          ...baseEdgeStates,
          [altSplitEdgeId]: 'seam',
          [targetEdgeId]: 'bend',
        },
      }));
      setFreeMergeNotice({
        message: `Đã gộp ${edgeShort} — đang mở mí ${splitShort} để trải phẳng`,
        targetEdgeId,
        appliedSplitEdgeId: altSplitEdgeId,
        alternativeSplitEdges,
        baseEdgeStates,
        prevFreeMergeMode,
      });
    },
    [freeMergeNotice]
  );

  const handleUndoAutoSplit = useCallback(() => {
    if (!freeMergeNotice) return;
    const { baseEdgeStates, prevFreeMergeMode } = freeMergeNotice;
    setConfig((prev) => ({
      ...prev,
      freeMergeMode: prevFreeMergeMode,
      customEdgeStates: { ...baseEdgeStates },
    }));
    setFreeMergeNotice(null);
  }, [freeMergeNotice]);

  const handleApplyFreeMergePreset = useCallback((preset: FreeMergePresetId) => {
    setFreeMergeNotice(null);
    setConfig((prev) => ({
      ...prev,
      freeMergeMode: true,
      autoSplit: false,
      customEdgeStates: buildFreeMergePresetEdges(prev, preset),
    }));
  }, []);

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

  // Single-click ONLY highlights target; never auto-opens Floating Inspector
  const handleSelectTarget = useCallback((target: SelectionTarget) => {
    setContextMenu(null);
    setSelection(target);
    if (target === null) {
      setInspectorOpen(false);
    }
  }, []);

  // Double-click, Context Menu action, or sidebar C1/C2 card explicitly opens Floating Inspector
  const handleOpenInspector = useCallback((target: NonNullable<SelectionTarget>) => {
    setContextMenu(null);
    setSelection(target);
    setInspectorOpen(true);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectorOpen(false);
  }, []);

  const show3D = viewportMode === '3d' || viewportMode === 'split';
  const show2D = viewportMode === '2d' || viewportMode === 'split';
  const isSplit = viewportMode === 'split';

  const pure2dPill = selection
    ? selection.kind === 'piece'
      ? { prefix: 'Đang chọn mảnh:', code: selection.partCode }
      : selection.kind === 'end'
        ? { prefix: 'Đang chọn đầu:', code: selection.endKey.toUpperCase() }
        : selection.kind === 'seam'
          ? { prefix: 'Đang chọn mí:', code: CORNER_LABELS[selection.cornerId] }
          : { prefix: 'Đang chọn cạnh:', code: FOLD_EDGE_DEFS[selection.edgeId].shortLabel }
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
          flatPatternDoc={flatPatternDoc}
          selection={selection}
          onSelectTarget={handleSelectTarget}
          onOpenInspector={handleOpenInspector}
          onChange={handlePatchConfig}
          onDimensionChange={handleDimensionChange}
          onSheetMaterialChange={handleSheetMaterialChange}
          onCopyC1ToC2={handleCopyC1ToC2}
          onSelectSplitMode={handleSelectSplitMode}
          onToggleAutoSplit={handleToggleAutoSplit}
          onToggleFreeMergeMode={handleToggleFreeMergeMode}
          onSetEdgeMode={handleSetEdgeMode}
          onApplyFreeMergePreset={handleApplyFreeMergePreset}
          onSwapSeams={handleSwapSeams}
        />
      )}

      {/* Right Main Workspace: Quick Toolbar + 3D / 2D / Split Viewport */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
          {/* Smart Auto-Resolve Info Toast for Face–Edge Free-Merge Mode */}
          {freeMergeNotice && (
            <div
              id="free-merge-cycle-toast"
              role="status"
              className="absolute top-2.5 left-1/2 z-50 flex max-w-[94%] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/45 bg-[#0e1a1c]/96 px-3.5 py-2 text-xs text-emerald-100 shadow-2xl backdrop-blur-md"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="font-medium">{freeMergeNotice.message}</span>
              {freeMergeNotice.alternativeSplitEdges
                .filter((eid) => eid !== freeMergeNotice.appliedSplitEdgeId)
                .map((altId) => (
                  <button
                    key={altId}
                    id={`btn-toast-alt-split-${altId}`}
                    type="button"
                    onClick={() => handleSwitchAutoSplitEdge(altId)}
                    className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-100 ring-1 ring-sky-400/45 transition-colors hover:bg-sky-500/32"
                  >
                    Đổi mở {FOLD_EDGE_DEFS[altId].shortLabel}
                  </button>
                ))}
              <button
                id="btn-toast-undo-merge"
                type="button"
                onClick={handleUndoAutoSplit}
                className="inline-flex items-center gap-1 rounded-md bg-slate-700/55 px-2 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-slate-500/40 transition-colors hover:bg-slate-600/70 hover:text-white"
              >
                <Undo2 className="h-3 w-3" />
                <span>Hoàn tác</span>
              </button>
              <button
                type="button"
                onClick={() => setFreeMergeNotice(null)}
                aria-label="Đóng thông báo"
                className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
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
              onOpenInspector={handleOpenInspector}
              onOpenContextMenu={handleOpenContextMenu}
            />
            {show3D && (
              <ViewportOverlays
                config={config}
                sidebarOpen={sidebarOpen}
                selection={selection}
                inspectorOpen={inspectorOpen}
                onClearSelection={() => handleSelectTarget(null)}
                onOpenInspector={handleOpenInspector}
                onExpandSidebar={() => setSidebarOpen(true)}
                onCameraPreset={handleCameraPreset}
                compact={isSplit}
              />
            )}
          </div>

          {/* Pluggable 2D Laser Flat-Pattern Viewport Pane */}
          {show2D && (
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              <FlatPattern2DViewer
                document={flatPatternDoc}
                technicalMode={config.materialMode === 'technical'}
                selection={selection}
                onSelectTarget={handleSelectTarget}
                onOpenInspector={handleOpenInspector}
                onOpenContextMenu={handleOpenContextMenu}
                focusPartRequest={focusPartRequest}
                compact={isSplit}
                topLeftOverlay={
                  !show3D && (!sidebarOpen || (selection && pure2dPill)) ? (
                    <>
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
                      {selection && pure2dPill && (
                        <div
                          id="pill-selected-part"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/55 bg-sky-500/18 px-2.5 py-1 text-xs font-medium text-sky-100 shadow-lg backdrop-blur-md"
                        >
                          <span>{pure2dPill.prefix}</span>
                          <strong className="font-mono font-bold text-white">{pure2dPill.code}</strong>
                          {!inspectorOpen && (
                            <button
                              id="btn-pill-open-inspector"
                              type="button"
                              onClick={() => handleOpenInspector(selection)}
                              title="Mở thẻ tùy chỉnh nhanh (hoặc Click đúp lên đối tượng)"
                              className="ml-0.5 inline-flex items-center gap-1 rounded bg-sky-400/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-100 hover:bg-sky-400/35 hover:text-white"
                            >
                              <Sliders className="h-3 w-3" />
                              <span>Chỉnh</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectTarget(null)}
                            aria-label="Bỏ chọn"
                            className="rounded p-0.5 text-sky-200 hover:bg-sky-400/25 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : null
                }
              />
            </div>
          )}
        </div>
      </main>

      {/* Right-Click CAD Context Menu & Compact Floating Inspector Card (Double-Click to Open) */}
      <SelectionContextUI
        config={config}
        workshopSettings={workshopSettings}
        flatPatternDoc={flatPatternDoc}
        selection={selection}
        inspectorOpen={inspectorOpen}
        contextMenu={contextMenu}
        onCloseContextMenu={() => setContextMenu(null)}
        onSelectTarget={handleSelectTarget}
        onOpenInspector={handleOpenInspector}
        onCloseInspector={handleCloseInspector}
        onFocusPiece={handleFocusPiece}
        onUpdateEndConnection={handleUpdateEndConnection}
        onApplyEndToBoth={handleApplyEndToBoth}
        onUpdateCornerSeam={handleUpdateCornerSeam}
        onResetCornerOverrides={handleResetCornerOverrides}
        onSetEdgeMode={handleSetEdgeMode}
        onSwapEdgeMerge={handleSwapEdgeMerge}
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
