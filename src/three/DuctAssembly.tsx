import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { AccessoryKind, BuiltFaceLabel } from '../domain/endConnectionBuilder';
import {
  MM_TO_M,
  buildUnfoldableDuctRig,
  disposeUnfoldableDuctRig,
  evaluateAccessoryRetractFactor,
  evaluatePieceRuntimePose,
  type EdgeHitStrip3D,
  type HingeSegmentNode,
  type UnfoldableDuctRig,
  type WallRigNode,
} from '../domain/geometry3D';
import type { DuctConfig, FoldEdgeId, SelectionTarget } from '../types/duct';
import { createFaceLabelTexture } from './faceLabelTexture';
import { createDuctMaterialSet, type DuctMaterialSet } from './galvanizedMaterial';

function applyRigTransforms(
  rig: UnfoldableDuctRig,
  materialSet: DuctMaterialSet,
  endCapMaterials: THREE.MeshStandardMaterial[],
  accessoryEdgeMaterial: THREE.LineBasicMaterial,
  baseEdgeOpacity: number,
  seamLock: number,
  explodeRatio: number,
  unfoldRatio: number,
  pieceRootMap: Map<string, THREE.Group>,
  wallHingeMap: Map<string, { group: THREE.Group; node: WallRigNode; pieceId: string }>,
  detailHingeMap: Map<string, { group: THREE.Group; node: HingeSegmentNode; pieceId: string }>,
  accessoryMap: Map<string, THREE.Group>,
  weldGroup: THREE.Group | null
): void {
  const poseByPiece = new Map<string, ReturnType<typeof evaluatePieceRuntimePose>>();
  for (const piece of rig.pieces) {
    const pose = evaluatePieceRuntimePose(piece, rig, seamLock, explodeRatio, unfoldRatio);
    poseByPiece.set(piece.id, pose);
    const rootGrp = pieceRootMap.get(piece.id);
    if (rootGrp) {
      rootGrp.position.set(pose.positionM[0], pose.positionM[1], pose.positionM[2]);
      rootGrp.quaternion.set(
        pose.quaternion[0],
        pose.quaternion[1],
        pose.quaternion[2],
        pose.quaternion[3]
      );
    }
  }

  wallHingeMap.forEach(({ group, node, pieceId }) => {
    const pose = poseByPiece.get(pieceId);
    if (!pose) return;
    const unseamedOpen =
      node.unseamedOpenFactor && node.unseamedOpenFactor > 0
        ? (1 - seamLock) * node.unseamedOpenFactor
        : 0;
    const openFrac = Math.max(pose.singlePieceExplodeOpen, unseamedOpen);
    const effectiveFold = Math.max(0, (1 - pose.unfoldBodyBlend) * (1 - openFrac));
    const angle = node.hingeFoldedAngleRad * effectiveFold;
    if (node.hingeAxis === 'x') {
      group.rotation.x = angle;
      group.rotation.z = 0;
    } else {
      group.rotation.z = angle;
      group.rotation.x = 0;
    }
  });

  detailHingeMap.forEach(({ group, node, pieceId }) => {
    const pose = poseByPiece.get(pieceId);
    if (!pose) return;
    const lockMult = node.usesSeamLock ? seamLock : 1;
    const angle = node.foldedAngleRad * pose.detailFoldFactor * lockMult;
    if (node.axis === 'x') {
      group.rotation.x = angle;
      group.rotation.z = 0;
    } else {
      group.rotation.z = angle;
      group.rotation.x = 0;
    }
  });

  const detRetract = evaluateAccessoryRetractFactor(unfoldRatio);
  const accOpacity = 1 - detRetract * 0.72;
  const isTranslucent = detRetract > 0.01;

  for (const acc of rig.accessories) {
    const grp = accessoryMap.get(acc.id);
    if (!grp || !acc.kinematics) continue;
    const k = acc.kinematics;
    const unseamedShift = (1 - seamLock) * (1 - detRetract) * k.unseamedAxialMm;
    const radShift = explodeRatio * k.explodeRadialMm + detRetract * k.unfoldRadialMm;
    const axShift =
      unseamedShift + explodeRatio * k.explodeAxialMm + detRetract * k.unfoldAxialMm;
    grp.position.set(
      k.radialDir[0] * radShift * MM_TO_M,
      k.radialDir[1] * radShift * MM_TO_M,
      k.endSign * axShift * MM_TO_M
    );
  }

  const accMats: THREE.MeshStandardMaterial[] = [
    materialSet.bracketRealistic,
    materialSet.bracketTechnical,
    materialSet.structuralFlangeRealistic,
    materialSet.structuralFlangeTechnical,
    materialSet.lcctFrameRealistic,
    materialSet.lcctFrameTechnical,
    ...endCapMaterials,
  ];
  for (const mat of accMats) {
    if (mat.transparent !== isTranslucent) {
      mat.transparent = isTranslucent;
      mat.depthWrite = !isTranslucent;
      mat.needsUpdate = true;
    }
    mat.opacity = accOpacity;
  }
  materialSet.lcctWireMeshRealistic.opacity = accOpacity;
  materialSet.lcctWireMeshTechnical.opacity = accOpacity;
  accessoryEdgeMaterial.opacity = baseEdgeOpacity * accOpacity;

  if (weldGroup) {
    weldGroup.visible = seamLock > 0.85 && explodeRatio < 0.02 && unfoldRatio < 0.02;
  }
}

interface DuctAssemblyProps {
  config: DuctConfig;
  ribPitchMm: number;
  selection: SelectionTarget;
  onSelectTarget: (target: SelectionTarget) => void;
  onOpenInspector: (target: NonNullable<SelectionTarget>) => void;
  onContextMenuTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

interface InnerFaceDecalProps {
  label: BuiltFaceLabel;
  selected: boolean;
  opacity?: number;
  onClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onDoubleClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onContextTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

function InnerFaceDecal({
  label,
  selected,
  opacity = 1,
  onClickTarget,
  onDoubleClickTarget,
  onContextTarget,
}: InnerFaceDecalProps) {
  const texture = useMemo(
    () => createFaceLabelTexture(label.partCode, selected),
    [label.partCode, selected]
  );

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const target: NonNullable<SelectionTarget> = { kind: 'piece', partCode: label.partCode };

  return (
    <mesh
      position={label.position}
      rotation={label.rotation}
      onClick={(e) => onClickTarget(e, target)}
      onDoubleClick={(e) => onDoubleClickTarget(e, target)}
      onPointerUp={(e) => onContextTarget(e, target)}
      renderOrder={2}
    >
      <planeGeometry args={label.sizeM} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.FrontSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

interface HingeBranchProps {
  node: HingeSegmentNode;
  partCode: string;
  selection: SelectionTarget;
  activeMaterials: THREE.MeshStandardMaterial[];
  baseEdgeMaterial: THREE.LineBasicMaterial;
  endSelectedEdgeMaterial: THREE.LineBasicMaterial;
  seamSelectedEdgeMaterial: THREE.LineBasicMaterial;
  onRegisterHinge: (id: string, group: THREE.Group | null, node: HingeSegmentNode) => void;
  onClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onDoubleClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onContextTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

function HingeBranch({
  node,
  partCode,
  selection,
  activeMaterials,
  baseEdgeMaterial,
  endSelectedEdgeMaterial,
  seamSelectedEdgeMaterial,
  onRegisterHinge,
  onClickTarget,
  onDoubleClickTarget,
  onContextTarget,
}: HingeBranchProps) {
  const target: NonNullable<SelectionTarget> = node.endKey
    ? { kind: 'end', endKey: node.endKey }
    : node.cornerId
      ? { kind: 'seam', cornerId: node.cornerId }
      : node.edgeId
        ? { kind: 'edge', edgeId: node.edgeId }
        : { kind: 'piece', partCode };

  const isEndSelected = Boolean(
    node.endKey && selection?.kind === 'end' && selection.endKey === node.endKey
  );
  const isSeamSelected = Boolean(
    (node.cornerId && selection?.kind === 'seam' && selection.cornerId === node.cornerId) ||
      (node.edgeId && selection?.kind === 'edge' && selection.edgeId === node.edgeId)
  );
  const edgeMat = isEndSelected
    ? endSelectedEdgeMaterial
    : isSeamSelected
      ? seamSelectedEdgeMaterial
      : baseEdgeMaterial;

  return (
    <group
      name={node.id}
      position={node.pivotM}
      ref={(el) => onRegisterHinge(node.id, el, node)}
    >
      <mesh
        geometry={node.geometry}
        material={activeMaterials}
        castShadow
        receiveShadow
        onClick={(e) => onClickTarget(e, target)}
        onDoubleClick={(e) => onDoubleClickTarget(e, target)}
        onPointerUp={(e) => onContextTarget(e, target)}
      />
      <lineSegments geometry={node.edgesGeometry} material={edgeMat} />
      {node.children.map((child) => (
        <HingeBranch
          key={child.id}
          node={child}
          partCode={partCode}
          selection={selection}
          activeMaterials={activeMaterials}
          baseEdgeMaterial={baseEdgeMaterial}
          endSelectedEdgeMaterial={endSelectedEdgeMaterial}
          seamSelectedEdgeMaterial={seamSelectedEdgeMaterial}
          onRegisterHinge={onRegisterHinge}
          onClickTarget={onClickTarget}
          onDoubleClickTarget={onDoubleClickTarget}
          onContextTarget={onContextTarget}
        />
      ))}
    </group>
  );
}

interface WallBranchProps {
  node: WallRigNode;
  partCode: string;
  selection: SelectionTarget;
  isSelected: boolean;
  showFaceLabels: boolean;
  activeMaterials: THREE.MeshStandardMaterial[];
  edgeMaterial: THREE.LineBasicMaterial;
  endSelectedEdgeMaterial: THREE.LineBasicMaterial;
  seamSelectedEdgeMaterial: THREE.LineBasicMaterial;
  onRegisterWallHinge: (id: string, group: THREE.Group | null, node: WallRigNode) => void;
  onRegisterDetailHinge: (id: string, group: THREE.Group | null, node: HingeSegmentNode) => void;
  onClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onDoubleClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onContextTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

function WallBranch({
  node,
  partCode,
  selection,
  isSelected,
  showFaceLabels,
  activeMaterials,
  edgeMaterial,
  endSelectedEdgeMaterial,
  seamSelectedEdgeMaterial,
  onRegisterWallHinge,
  onRegisterDetailHinge,
  onClickTarget,
  onDoubleClickTarget,
  onContextTarget,
}: WallBranchProps) {
  const pieceTarget: NonNullable<SelectionTarget> = { kind: 'piece', partCode };

  const wallBody = (
    <>
      <mesh
        geometry={node.geometry}
        material={activeMaterials}
        castShadow
        receiveShadow
        onClick={(e) => onClickTarget(e, pieceTarget)}
        onDoubleClick={(e) => onDoubleClickTarget(e, pieceTarget)}
        onPointerUp={(e) => onContextTarget(e, pieceTarget)}
      />
      <lineSegments geometry={node.edgesGeometry} material={edgeMaterial} />

      {showFaceLabels && (
        <InnerFaceDecal
          label={node.faceLabel}
          selected={isSelected}
          onClickTarget={onClickTarget}
          onDoubleClickTarget={onDoubleClickTarget}
          onContextTarget={onContextTarget}
        />
      )}

      {/* Integral seams & end flanges hinged directly onto this face */}
      {node.flangeHinges.map((hinge) => (
        <HingeBranch
          key={hinge.id}
          node={hinge}
          partCode={partCode}
          selection={selection}
          activeMaterials={activeMaterials}
          baseEdgeMaterial={edgeMaterial}
          endSelectedEdgeMaterial={endSelectedEdgeMaterial}
          seamSelectedEdgeMaterial={seamSelectedEdgeMaterial}
          onRegisterHinge={onRegisterDetailHinge}
          onClickTarget={onClickTarget}
          onDoubleClickTarget={onDoubleClickTarget}
          onContextTarget={onContextTarget}
        />
      ))}

      {/* Adjacent faces (body walls OR merged end caps) hinged around 90° bend edges */}
      {node.childWalls.map((child) => (
        <WallBranch
          key={child.id}
          node={child}
          partCode={partCode}
          selection={selection}
          isSelected={isSelected}
          showFaceLabels={showFaceLabels}
          activeMaterials={activeMaterials}
          edgeMaterial={edgeMaterial}
          endSelectedEdgeMaterial={endSelectedEdgeMaterial}
          seamSelectedEdgeMaterial={seamSelectedEdgeMaterial}
          onRegisterWallHinge={onRegisterWallHinge}
          onRegisterDetailHinge={onRegisterDetailHinge}
          onClickTarget={onClickTarget}
          onDoubleClickTarget={onDoubleClickTarget}
          onContextTarget={onContextTarget}
        />
      ))}
    </>
  );

  if (node.isRoot) {
    return <group name={`wall-${node.id}`}>{wallBody}</group>;
  }

  return (
    <group
      name={`hinge-${node.id}`}
      position={node.hingePivotInParentM}
      ref={(el) => onRegisterWallHinge(node.id, el, node)}
    >
      <group rotation={[0, node.flatRotYRad, 0]}>
        <group name={`wall-${node.id}`} position={node.childOffsetInLocalM}>
          {wallBody}
        </group>
      </group>
    </group>
  );
}

interface EdgeHitStripMeshProps {
  strip: EdgeHitStrip3D;
  freeMergeMode: boolean;
  selected: boolean;
  hovered: boolean;
  onHover: (edgeId: FoldEdgeId | null) => void;
  onClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onDoubleClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onContextTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

function EdgeHitStripMesh({
  strip,
  freeMergeMode,
  selected,
  hovered,
  onHover,
  onClickTarget,
  onDoubleClickTarget,
  onContextTarget,
}: EdgeHitStripMeshProps) {
  const target: NonNullable<SelectionTarget> = { kind: 'edge', edgeId: strip.edgeId };
  const visible = freeMergeMode || selected || hovered;
  const color = selected
    ? '#38bdf8'
    : strip.mode === 'bend'
      ? hovered
        ? '#4ade80'
        : '#22c55e'
      : hovered
        ? '#fbbf24'
        : '#f59e0b';
  const visualRadius = selected ? 0.0048 : hovered ? 0.004 : 0.003;
  const hitRadius = freeMergeMode ? 0.011 : 0.0065;

  return (
    <group position={strip.centerM} rotation={strip.rotation} name={`edge-strip-${strip.edgeId}`}>
      {visible && (
        <mesh renderOrder={4}>
          <cylinderGeometry args={[visualRadius, visualRadius, strip.lengthM, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={selected ? 0.98 : hovered ? 0.9 : 0.78}
          />
        </mesh>
      )}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(strip.edgeId);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
        onClick={(e) => onClickTarget(e, target)}
        onDoubleClick={(e) => onDoubleClickTarget(e, target)}
        onPointerUp={(e) => onContextTarget(e, target)}
      >
        <cylinderGeometry args={[hitRadius, hitRadius, strip.lengthM, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Renders the parametric 3D straight duct assembly with hierarchical zero-rebuild
 * 60fps pivot groups supporting:
 * - Smooth `Mở phôi 3D` (0% -> 100%) unfolding of arbitrary Face–Edge spanning trees (4/5/6 faces)
 * - Smooth detached accessory axial retraction & fade during 0% -> 30% unfold
 * - Smooth `Tách mảnh` (0% -> 100%) and `Chưa gò mí <-> Đã gò mí` lock animation
 * - Single-click highlight, double-click Floating Inspector, and right-click Context Menu
 *   for pieces, C1/C2 ends, longitudinal seams, and shared fold edges
 */
export function DuctAssembly({
  config,
  ribPitchMm,
  selection,
  onSelectTarget,
  onOpenInspector,
  onContextMenuTarget,
}: DuctAssemblyProps) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<FoldEdgeId | null>(null);
  const materialSet = useMemo(() => createDuctMaterialSet(), []);

  useEffect(() => {
    return () => {
      materialSet.dispose();
    };
  }, [materialSet]);

  const {
    W,
    H,
    L,
    thickness,
    splitMode,
    freeMergeMode,
    customEdgeStates,
    globalSeamType,
    weldOverlapWidth,
    swapSeamRoles,
    seamOverrides,
    c1,
    c2,
    stiffenerRibs,
    showFaceLabels,
  } = config;

  // Build static hierarchical pivot rig ONCE per structural config change —
  // `unfoldProgress`, `explode`, and `seamState` NEVER trigger geometry rebuilds!
  const rig = useMemo(() => {
    const geomConfig: DuctConfig = {
      W,
      H,
      L,
      sheetMaterial: 'galvanized',
      thickness,
      autoSplit: false,
      splitMode,
      freeMergeMode,
      customEdgeStates,
      globalSeamType,
      weldOverlapWidth,
      swapSeamRoles,
      seamOverrides,
      c1,
      c2,
      seamState: 'seamed',
      explode: 0,
      unfoldProgress: 0,
      stiffenerRibs,
      showFaceLabels,
      materialMode: 'realistic',
    };
    return buildUnfoldableDuctRig(geomConfig, ribPitchMm);
  }, [
    W,
    H,
    L,
    thickness,
    splitMode,
    freeMergeMode,
    customEdgeStates,
    globalSeamType,
    weldOverlapWidth,
    swapSeamRoles,
    seamOverrides,
    c1,
    c2,
    stiffenerRibs,
    showFaceLabels,
    ribPitchMm,
  ]);

  useEffect(() => {
    return () => {
      disposeUnfoldableDuctRig(rig);
    };
  }, [rig]);

  const isTech = config.materialMode === 'technical';
  const activeMaterials = isTech
    ? materialSet.technicalMaterials
    : config.sheetMaterial === 'inox'
      ? materialSet.inoxMaterials
      : materialSet.galvanizedMaterials;

  // Dedicated cloned materials for detached End Cap accessory so 0->30% opacity fade NEVER affects body pieces
  const endCapMaterials = useMemo(
    () => activeMaterials.map((m) => m.clone()),
    [activeMaterials]
  );

  useEffect(() => {
    return () => {
      endCapMaterials.forEach((m) => m.dispose());
    };
  }, [endCapMaterials]);

  const baseEdgeOpacity =
    config.materialMode === 'technical'
      ? 0.62
      : config.sheetMaterial === 'inox'
        ? 0.36
        : 0.42;

  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: config.materialMode === 'realistic' ? '#0c131f' : '#090e17',
      transparent: true,
      opacity: baseEdgeOpacity,
      depthWrite: false,
    });
  }, [config.materialMode, baseEdgeOpacity]);

  const accessoryEdgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: config.materialMode === 'realistic' ? '#0c131f' : '#090e17',
      transparent: true,
      opacity: baseEdgeOpacity,
      depthWrite: false,
    });
  }, [config.materialMode, baseEdgeOpacity]);

  const selectedEdgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
  }, []);

  const endSelectedEdgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
  }, []);

  const seamSelectedEdgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#34d399',
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
  }, []);

  useEffect(() => {
    return () => {
      edgeMaterial.dispose();
      accessoryEdgeMaterial.dispose();
      selectedEdgeMaterial.dispose();
      endSelectedEdgeMaterial.dispose();
      seamSelectedEdgeMaterial.dispose();
    };
  }, [
    edgeMaterial,
    accessoryEdgeMaterial,
    selectedEdgeMaterial,
    endSelectedEdgeMaterial,
    seamSelectedEdgeMaterial,
  ]);

  const weldBeadMat = isTech
    ? materialSet.weldBeadTechnical
    : config.sheetMaterial === 'inox'
      ? materialSet.weldBeadInox
      : materialSet.weldBeadGalvanized;

  const getAccessoryMaterial = (kind: AccessoryKind) => {
    switch (kind) {
      case 'end_cap':
        return endCapMaterials;
      case 'bracket':
        return isTech ? materialSet.bracketTechnical : materialSet.bracketRealistic;
      case 'structural_flange':
        return isTech
          ? materialSet.structuralFlangeTechnical
          : materialSet.structuralFlangeRealistic;
      case 'lcct_frame':
        return isTech ? materialSet.lcctFrameTechnical : materialSet.lcctFrameRealistic;
      case 'lcct_mesh':
        return isTech ? materialSet.lcctWireMeshTechnical : materialSet.lcctWireMeshRealistic;
    }
  };

  // Live imperative refs for 60fps zero-allocation transforms
  const pieceRootRefs = useRef<Map<string, THREE.Group>>(new Map());
  const wallHingeRefs = useRef<
    Map<string, { group: THREE.Group; node: WallRigNode; pieceId: string }>
  >(new Map());
  const detailHingeRefs = useRef<
    Map<string, { group: THREE.Group; node: HingeSegmentNode; pieceId: string }>
  >(new Map());
  const accessoryRefs = useRef<Map<string, THREE.Group>>(new Map());
  const weldGroupRef = useRef<THREE.Group | null>(null);

  const targetSeamLock = config.seamState === 'seamed' ? 1 : 0;
  const explodeRatio = config.explode / 100;
  const unfoldRatio = config.unfoldProgress / 100;

  // Live animated refs updated strictly inside effects & useFrame (React Compiler clean!)
  const animStateRef = useRef<{
    targetSeamLock: number;
    currentSeamLock: number;
    explodeRatio: number;
    unfoldRatio: number;
    rig: typeof rig;
    endCapMaterials: THREE.MeshStandardMaterial[];
    accessoryEdgeMaterial: THREE.LineBasicMaterial;
    baseEdgeOpacity: number;
  }>({
    targetSeamLock,
    currentSeamLock: targetSeamLock,
    explodeRatio,
    unfoldRatio,
    rig,
    endCapMaterials,
    accessoryEdgeMaterial,
    baseEdgeOpacity,
  });

  // Apply pose synchronously on mount and whenever rig/slider props change (zero flash, zero geometry rebuild!)
  useLayoutEffect(() => {
    const st = animStateRef.current;
    st.targetSeamLock = targetSeamLock;
    st.explodeRatio = explodeRatio;
    st.unfoldRatio = unfoldRatio;
    st.rig = rig;
    st.endCapMaterials = endCapMaterials;
    st.accessoryEdgeMaterial = accessoryEdgeMaterial;
    st.baseEdgeOpacity = baseEdgeOpacity;

    applyRigTransforms(
      st.rig,
      materialSet,
      st.endCapMaterials,
      st.accessoryEdgeMaterial,
      st.baseEdgeOpacity,
      st.currentSeamLock,
      st.explodeRatio,
      st.unfoldRatio,
      pieceRootRefs.current,
      wallHingeRefs.current,
      detailHingeRefs.current,
      accessoryRefs.current,
      weldGroupRef.current
    );
  }, [
    rig,
    materialSet,
    targetSeamLock,
    explodeRatio,
    unfoldRatio,
    endCapMaterials,
    accessoryEdgeMaterial,
    baseEdgeOpacity,
  ]);

  // Smoothly animate Chưa gò mí <-> Đã gò mí at 60fps via pure rotation updates
  useFrame((_, delta) => {
    const st = animStateRef.current;
    const diff = st.targetSeamLock - st.currentSeamLock;
    if (Math.abs(diff) > 0.001) {
      const step = Math.min(1, delta * 9.5);
      const next = st.currentSeamLock + diff * step;
      st.currentSeamLock = Math.abs(st.targetSeamLock - next) < 0.005 ? st.targetSeamLock : next;
      applyRigTransforms(
        st.rig,
        materialSet,
        st.endCapMaterials,
        st.accessoryEdgeMaterial,
        st.baseEdgeOpacity,
        st.currentSeamLock,
        st.explodeRatio,
        st.unfoldRatio,
        pieceRootRefs.current,
        wallHingeRefs.current,
        detailHingeRefs.current,
        accessoryRefs.current,
        weldGroupRef.current
      );
    }
  });

  // Single-click ONLY selects & highlights (does NOT open Floating Inspector, does NOT toggle off so dblclick works smoothly)
  const handleClickTarget = (
    e: ThreeEvent<MouseEvent>,
    target: NonNullable<SelectionTarget>
  ) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    onSelectTarget(target);
  };

  // Double-click opens Floating Inspector for the clicked piece, end, seam, or edge
  const handleDoubleClickTarget = (
    e: ThreeEvent<MouseEvent>,
    target: NonNullable<SelectionTarget>
  ) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    onOpenInspector(target);
  };

  const selectedPartCode = selection?.kind === 'piece' ? selection.partCode : null;
  const selectedEdgeId = selection?.kind === 'edge' ? selection.edgeId : null;
  const detFadeOpacity = 1 - evaluateAccessoryRetractFactor(config.unfoldProgress / 100) * 0.72;
  const showEdgeHitStrips = config.explode < 2 && config.unfoldProgress < 2;
  const visibleEdgeStrips = useMemo(() => {
    if (!showEdgeHitStrips) return [];
    // In freeMergeMode show ALL active shared edges (body + end caps) interactively.
    // In standard mode, only attach subtle edge hit strips on 'bend' edges so normal seam/end hits stay crisp.
    return freeMergeMode
      ? rig.edgeHitStrips
      : rig.edgeHitStrips.filter((s) => s.mode === 'bend' || s.edgeId === selectedEdgeId);
  }, [showEdgeHitStrips, freeMergeMode, rig.edgeHitStrips, selectedEdgeId]);

  return (
    <group name="duct-assembly-root">
      {/* Hierarchical Sheet-Metal Duct Pieces (60fps zero-rebuild pivot tree) */}
      {rig.pieces.map((piece) => {
        const isSelected = selectedPartCode === piece.partCode;
        const pieceEdgeMat = isSelected ? selectedEdgeMaterial : edgeMaterial;

        return (
          <group
            key={piece.id}
            name={`piece-${piece.partCode}`}
            ref={(el) => {
              if (el) pieceRootRefs.current.set(piece.id, el);
              else pieceRootRefs.current.delete(piece.id);
            }}
          >
            <WallBranch
              node={piece.rootWall}
              partCode={piece.partCode}
              selection={selection}
              isSelected={isSelected}
              showFaceLabels={showFaceLabels}
              activeMaterials={activeMaterials}
              edgeMaterial={pieceEdgeMat}
              endSelectedEdgeMaterial={endSelectedEdgeMaterial}
              seamSelectedEdgeMaterial={seamSelectedEdgeMaterial}
              onRegisterWallHinge={(id, grp, node) => {
                if (grp) wallHingeRefs.current.set(id, { group: grp, node, pieceId: piece.id });
                else wallHingeRefs.current.delete(id);
              }}
              onRegisterDetailHinge={(id, grp, node) => {
                if (grp) detailHingeRefs.current.set(id, { group: grp, node, pieceId: piece.id });
                else detailHingeRefs.current.delete(id);
              }}
              onClickTarget={handleClickTarget}
              onDoubleClickTarget={handleDoubleClickTarget}
              onContextTarget={onContextMenuTarget}
            />
          </group>
        );
      })}

      {/* Interactive Shared Edge Hit Strips (Face–Edge Graph: click / double-click / right-click in 3D) */}
      {visibleEdgeStrips.map((strip) => (
        <EdgeHitStripMesh
          key={strip.edgeId}
          strip={strip}
          freeMergeMode={freeMergeMode}
          selected={selectedEdgeId === strip.edgeId}
          hovered={hoveredEdgeId === strip.edgeId}
          onHover={setHoveredEdgeId}
          onClickTarget={handleClickTarget}
          onDoubleClickTarget={handleDoubleClickTarget}
          onContextTarget={onContextMenuTarget}
        />
      ))}

      {/* Longitudinal Weld Beads (hidden automatically when exploding or unfolding) */}
      <group ref={weldGroupRef} name="weld-beads-group">
        {rig.weldBeads.map((bead) => {
          const seamTarget: NonNullable<SelectionTarget> = {
            kind: 'seam',
            cornerId: bead.cornerId,
          };
          return (
            <mesh
              key={bead.id}
              name={bead.id}
              geometry={bead.geometry}
              material={weldBeadMat}
              castShadow
              onClick={(e) => handleClickTarget(e, seamTarget)}
              onDoubleClick={(e) => handleDoubleClickTarget(e, seamTarget)}
              onPointerUp={(e) => onContextMenuTarget(e, seamTarget)}
            />
          );
        })}
      </group>

      {/* Detached Stage 2 End Accessories (smooth 0->30% axial retract + fade during unfold) */}
      {rig.accessories.map((acc) => {
        const isPieceSelected = Boolean(acc.partCode && selectedPartCode === acc.partCode);
        const isEndSelected = Boolean(
          acc.endKey && selection?.kind === 'end' && selection.endKey === acc.endKey
        );
        const accTarget: NonNullable<SelectionTarget> | null = acc.partCode
          ? { kind: 'piece', partCode: acc.partCode }
          : acc.endKey
            ? { kind: 'end', endKey: acc.endKey }
            : null;
        const accEdgeMat = isPieceSelected
          ? selectedEdgeMaterial
          : isEndSelected
            ? endSelectedEdgeMaterial
            : accessoryEdgeMaterial;

        return (
          <group
            key={acc.id}
            name={acc.partCode ? `piece-${acc.partCode}` : acc.id}
            ref={(el) => {
              if (el) accessoryRefs.current.set(acc.id, el);
              else accessoryRefs.current.delete(acc.id);
            }}
          >
            <mesh
              geometry={acc.geometry}
              material={getAccessoryMaterial(acc.kind)}
              castShadow={acc.kind !== 'lcct_mesh' && config.unfoldProgress < 5}
              receiveShadow
              onClick={accTarget ? (e) => handleClickTarget(e, accTarget) : undefined}
              onDoubleClick={accTarget ? (e) => handleDoubleClickTarget(e, accTarget) : undefined}
              onPointerUp={accTarget ? (e) => onContextMenuTarget(e, accTarget) : undefined}
            />
            {acc.edgesGeometry && (
              <lineSegments geometry={acc.edgesGeometry} material={accEdgeMat} />
            )}
            {showFaceLabels &&
              acc.faceLabels &&
              acc.faceLabels.map((lbl) => (
                <InnerFaceDecal
                  key={lbl.id}
                  label={lbl}
                  selected={isPieceSelected}
                  opacity={detFadeOpacity}
                  onClickTarget={handleClickTarget}
                  onDoubleClickTarget={handleDoubleClickTarget}
                  onContextTarget={onContextMenuTarget}
                />
              ))}
          </group>
        );
      })}
    </group>
  );
}
