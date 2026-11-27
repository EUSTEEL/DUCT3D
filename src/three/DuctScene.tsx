import { useCallback, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MM_TO_M } from '../domain/sheetProfileBuilder';
import type { CameraPreset, DuctConfig, SelectionTarget } from '../types/duct';
import { DuctAssembly } from './DuctAssembly';

export interface CameraCommand {
  preset: CameraPreset;
  seq: number;
  focusPartCode?: string;
}

interface DuctSceneProps {
  config: DuctConfig;
  ribPitchMm: number;
  cameraCommand: CameraCommand;
  selection: SelectionTarget;
  active?: boolean;
  onSelectTarget: (target: SelectionTarget) => void;
  onOpenInspector: (target: NonNullable<SelectionTarget>) => void;
  onOpenContextMenu: (x: number, y: number, target: NonNullable<SelectionTarget>) => void;
}

interface CameraControllerProps {
  config: DuctConfig;
  cameraCommand: CameraCommand;
}

function computePresetPose(
  preset: CameraPreset,
  W: number,
  H: number,
  L: number,
  explode: number,
  unfoldProgress: number
): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const wM = W * MM_TO_M;
  const hM = H * MM_TO_M;
  const lM = L * MM_TO_M;
  const uRatio = unfoldProgress / 100;
  const flatWidthM = (2 * (W + H) + 450) * MM_TO_M;
  const effWM = wM * (1 - uRatio) + flatWidthM * uRatio;
  const flangePad = 0.08 + uRatio * 0.25;
  const explodePad = (explode / 100) * Math.min(0.45, Math.max(wM, hM) * 0.48);
  const explodeAxialPad = (explode / 100) * 0.34 + uRatio * 0.3;
  const diag = Math.max(
    0.48,
    Math.hypot(effWM + flangePad + explodePad, hM + flangePad + explodePad, lM + explodeAxialPad)
  );

  switch (preset) {
    case 'seam_closeup': {
      // Zoom right into the Top-Right corner seam at the +Z front end to clearly inspect
      // Pittsburgh U-pocket, 45° Male bevel, hammer-over tab, or weld joint!
      const cx = (W / 2) * MM_TO_M;
      const cy = (H / 2) * MM_TO_M;
      const cz = (L / 2) * MM_TO_M;
      const zoomDist = Math.max(0.082, Math.min(0.16, Math.min(wM, hM) * 0.36));
      return {
        target: new THREE.Vector3(cx + 0.004, cy - 0.003, cz - Math.min(0.036, lM * 0.12)),
        pos: new THREE.Vector3(
          cx + zoomDist * 0.78,
          cy + zoomDist * 0.48,
          cz + zoomDist * 0.92
        ),
      };
    }
    case 'front_section': {
      const dist = Math.max(effWM + explodePad, hM + explodePad) * 1.55 + lM * 0.55;
      return {
        target: new THREE.Vector3(0, 0, 0),
        pos: new THREE.Vector3(0.04 * diag, 0.03 * diag, dist),
      };
    }
    case 'top': {
      const dist = Math.max(effWM + explodePad, lM + explodeAxialPad) * 1.38 + (hM + explodePad) * 0.4;
      return {
        target: new THREE.Vector3(0, 0, 0),
        pos: new THREE.Vector3(0.02, dist, 0.14 * diag),
      };
    }
    case 'iso':
    case 'reset':
    default: {
      // Classic hero 3/4 industrial angle highlighting Top-Right seam, front opening, and side ribs
      const d = diag * (1.18 - uRatio * 0.08);
      return {
        target: new THREE.Vector3(0, 0, 0),
        pos: new THREE.Vector3(d * (0.68 - uRatio * 0.32), d * (0.44 + uRatio * 0.42), d * (0.88 - uRatio * 0.12)),
      };
    }
  }
}

function CameraRig({ config, cameraCommand }: CameraControllerProps) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const animRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  }>({
    active: false,
    targetPos: new THREE.Vector3(),
    targetLook: new THREE.Vector3(),
  });

  const initializedRef = useRef(false);
  const dimsRef = useRef({
    W: config.W,
    H: config.H,
    L: config.L,
    explode: config.explode,
    unfoldProgress: config.unfoldProgress,
  });

  useEffect(() => {
    dimsRef.current = {
      W: config.W,
      H: config.H,
      L: config.L,
      explode: config.explode,
      unfoldProgress: config.unfoldProgress,
    };
  }, [config.W, config.H, config.L, config.explode, config.unfoldProgress]);

  // Set initial framing cleanly on first mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const { W, H, L, explode, unfoldProgress } = dimsRef.current;
      const pose = computePresetPose('iso', W, H, L, explode, unfoldProgress);
      camera.position.copy(pose.pos);
      camera.lookAt(pose.target);
      if (controlsRef.current) {
        controlsRef.current.target.copy(pose.target);
        controlsRef.current.update();
      }
    }
  }, [camera]);

  // Trigger smooth camera move when user clicks a preset button or selects "Phóng to mảnh này"
  useEffect(() => {
    if (cameraCommand.seq === 0) return;

    if (cameraCommand.preset === 'focus_part' && cameraCommand.focusPartCode) {
      const obj = scene.getObjectByName(`piece-${cameraCommand.focusPartCode}`);
      if (obj) {
        const box = new THREE.Box3().setFromObject(obj);
        if (!box.isEmpty()) {
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          box.getCenter(center);
          box.getSize(size);
          const diag = Math.max(0.28, size.length());
          const dir = camera.position.clone().sub(controlsRef.current?.target ?? center);
          if (dir.lengthSq() < 1e-4) dir.set(0.65, 0.45, 0.85);
          dir.normalize();
          const targetPos = center.clone().addScaledVector(dir, diag * 1.15);
          animRef.current = {
            active: true,
            targetPos,
            targetLook: center,
          };
          return;
        }
      }
    }

    const { W, H, L, explode, unfoldProgress } = dimsRef.current;
    const pose = computePresetPose(cameraCommand.preset, W, H, L, explode, unfoldProgress);
    animRef.current = {
      active: true,
      targetPos: pose.pos,
      targetLook: pose.target,
    };
  }, [cameraCommand, camera, scene]);

  useFrame((_, delta) => {
    if (!animRef.current.active || !controlsRef.current) return;
    const alpha = Math.min(1, delta * 10.5);
    camera.position.lerp(animRef.current.targetPos, alpha);
    controlsRef.current.target.lerp(animRef.current.targetLook, alpha);
    controlsRef.current.update();

    if (
      camera.position.distanceTo(animRef.current.targetPos) < 0.002 &&
      controlsRef.current.target.distanceTo(animRef.current.targetLook) < 0.002
    ) {
      camera.position.copy(animRef.current.targetPos);
      controlsRef.current.target.copy(animRef.current.targetLook);
      controlsRef.current.update();
      animRef.current.active = false;
    }
  });

  const stopAnimOnUserDrag = () => {
    animRef.current.active = false;
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.04}
      maxDistance={14}
      onStart={stopAnimOnUserDrag}
    />
  );
}

export function DuctScene({
  config,
  ribPitchMm,
  cameraCommand,
  selection,
  active = true,
  onSelectTarget,
  onOpenInspector,
  onOpenContextMenu,
}: DuctSceneProps) {
  const halfHM = (config.H / 2) * MM_TO_M;
  const explodeExtraM =
    config.splitMode === '1_piece'
      ? (config.explode / 100) * 0.06
      : (config.explode / 100) * Math.min(0.28, Math.max(config.W, config.H) * MM_TO_M * 0.32);
  const floorY = -(halfHM + explodeExtraM + 0.14);

  const unfoldedSpanM = (2 * (config.W + config.H) + 520) * MM_TO_M;
  const shadowExtent = Math.max(
    2.4,
    Math.max(config.W, config.H, config.L) * MM_TO_M * 2.2,
    (config.unfoldProgress / 100) * unfoldedSpanM * 1.4
  );

  // Track right-button pointer movement so OrbitControls right-drag Pan still works 100%,
  // while a crisp stationary right-click (< 4px move) opens the CAD Context Menu cleanly
  // on ALL OSes (Linux/macOS fire `contextmenu` on mousedown, so we trigger on `pointerup`!).
  const rightBtnRef = useRef<{
    down: boolean;
    valid: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    down: false,
    valid: false,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const handleContainerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      rightBtnRef.current = {
        down: true,
        valid: true,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    }
  }, []);

  const handleContainerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const r = rightBtnRef.current;
    if (!r.down) return;
    if (Math.hypot(e.clientX - r.startX, e.clientY - r.startY) >= 4) {
      r.moved = true;
    }
  }, []);

  const handleContainerPointerUpBubble = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      rightBtnRef.current.down = false;
      rightBtnRef.current.valid = false;
    }
  }, []);

  const handleMeshRightPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => {
      if (e.nativeEvent.button !== 2) return;
      const r = rightBtnRef.current;
      const dist = Math.hypot(e.nativeEvent.clientX - r.startX, e.nativeEvent.clientY - r.startY);
      if (!r.valid || r.moved || dist >= 4) {
        return; // Right-drag Pan occurred — do NOT open context menu
      }
      e.stopPropagation();
      r.valid = false;
      onOpenContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, target);
    },
    [onOpenContextMenu]
  );

  return (
    <div
      id="viewport-3d-container"
      className="studio-viewport-bg relative h-full w-full select-none"
      onPointerDownCapture={handleContainerPointerDown}
      onPointerMoveCapture={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUpBubble}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        frameloop={active ? 'always' : 'never'}
        shadows
        dpr={[1, 2]}
        camera={{ fov: 36, near: 0.005, far: 80, position: [1.0, 0.65, 1.3] }}
        onPointerMissed={(e) => {
          if (e.button === 0) onSelectTarget(null);
        }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.04,
          preserveDrawingBuffer: true,
        }}
      >
        {/* Procedural Studio Softbox HDRI Environment (100% offline, angled white/cool-blue panels) */}
        <Environment resolution={256} frames={1}>
          {/* Main Overhead Softbox */}
          <Lightformer
            form="rect"
            intensity={2.4}
            color="#f5f9ff"
            position={[0.4, 4.5, 1.2]}
            rotation={[Math.PI / 2.2, 0, 0]}
            scale={[7, 4.5, 1]}
          />
          {/* Front-Left Key Softbox Strip */}
          <Lightformer
            form="rect"
            intensity={2.6}
            color="#ffffff"
            position={[-4.5, 2.2, 3.8]}
            rotation={[0, Math.PI / 3.4, 0]}
            scale={[5.5, 3.2, 1]}
          />
          {/* Right Cool-Steel Fill Softbox (brings crisp sheen onto Right wall & Pittsburgh pocket) */}
          <Lightformer
            form="rect"
            intensity={2.1}
            color="#cbe1ff"
            position={[5.0, 1.6, 1.8]}
            rotation={[0, -Math.PI / 2.3, 0]}
            scale={[6, 3.5, 1]}
          />
          {/* Rear-Top Rim-Light Strip (catches sharp specular highlights along bends, seam lips & ribs) */}
          <Lightformer
            form="rect"
            intensity={3.6}
            color="#e2f0ff"
            position={[1.8, 3.6, -4.5]}
            rotation={[Math.PI / 5, Math.PI, 0]}
            scale={[8, 1.8, 1]}
          />
          {/* Subtle Lower Bounce Panel so undersides remain legible */}
          <Lightformer
            form="rect"
            intensity={0.55}
            color="#31415a"
            position={[0, -3.5, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[10, 10, 1]}
          />
        </Environment>

        {/* 3-Point Studio Direct Lighting + Rim Light */}
        <ambientLight intensity={0.28} color="#ccd9eb" />

        {/* Key Light */}
        <directionalLight
          position={[-2.6, 3.8, 3.2]}
          intensity={1.35}
          color="#f8fbff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0003}
          shadow-camera-near={0.2}
          shadow-camera-far={18}
          shadow-camera-left={-shadowExtent}
          shadow-camera-right={shadowExtent}
          shadow-camera-top={shadowExtent}
          shadow-camera-bottom={-shadowExtent}
        />

        {/* Cool Fill Light (Front-Right, illuminates duct interior & right seam) */}
        <directionalLight
          position={[3.4, 1.1, 2.6]}
          intensity={0.62}
          color="#bed7f7"
        />

        {/* Rim Light (Rear-Top-Right to outline metal folds and 45° chamfers) */}
        <directionalLight
          position={[2.4, 3.4, -3.8]}
          intensity={1.25}
          color="#e0f0ff"
        />

        {/* Subtle underside fill */}
        <directionalLight
          position={[-1.5, -2.8, 1.5]}
          intensity={0.28}
          color="#6c85a6"
        />

        {/* 3D Duct Parametric Model */}
        <DuctAssembly
          config={config}
          ribPitchMm={ribPitchMm}
          selection={selection}
          onSelectTarget={onSelectTarget}
          onOpenInspector={onOpenInspector}
          onContextMenuTarget={handleMeshRightPointerUp}
        />

        {/* Subtle Technical Floor Grid & Contact Shadows */}
        <Grid
          position={[0, floorY, 0]}
          args={[16, 16]}
          cellSize={0.1}
          cellThickness={0.45}
          cellColor="#243044"
          sectionSize={0.5}
          sectionThickness={0.85}
          sectionColor="#334561"
          fadeDistance={7.5}
          fadeStrength={2.2}
          infiniteGrid
        />

        <ContactShadows
          key={`${config.W}-${config.H}-${config.L}-${config.splitMode}-${config.freeMergeMode ? 'fm' : 'std'}-${config.c1.type}-${config.c2.type}-${Math.round(config.explode / 5)}`}
          position={[0, floorY + 0.002, 0]}
          opacity={0.42}
          scale={shadowExtent * 2.2}
          blur={2.2}
          resolution={256}
          frames={1}
          far={shadowExtent}
          color="#05080f"
        />

        <CameraRig config={config} cameraCommand={cameraCommand} />
      </Canvas>
    </div>
  );
}
