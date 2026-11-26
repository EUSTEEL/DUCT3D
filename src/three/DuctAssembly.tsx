import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { AccessoryKind, BuiltFaceLabel } from '../domain/endConnectionBuilder';
import {
  MM_TO_M,
  buildUnfoldableDuctRig,
  disposeUnfoldableDuctRig,
  evaluateAccessoryRetractFactor,
  evaluatePieceRuntimePose,
  type HingeSegmentNode,
  type UnfoldableDuctRig,
  type WallRigNode,
} from '../domain/unfoldRigBuilder';
import type { DuctConfig, SelectionTarget } from '../types/duct';
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
  wallHingeMap: Map<string, { group: THREE.Group; side: -1 | 1; pieceId: string }>,
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
      rootGrp.rotation.set(0, 0, pose.rotZ);
    }
  }

  wallHingeMap.forEach(({ group, side, pieceId }) => {
    const pose = poseByPiece.get(pieceId);
    if (!pose) return;
    group.rotation.z = side * (Math.PI / 2) * pose.bodyFoldFactor;
  });

  detailHingeMap.forEach(({ group, node, pieceId }) => {
    const pose = poseByPiece.get(pieceId);
    if (!pose) return;
    const lockMult = node.usesSeamLock ? seamLock : 1;
    const angle = node.foldedAngleRad * pose.detailFoldFactor * lockMult;
    if (node.axis === 'x') {
      group.rotation.x = angle;
    } else {
      group.rotation.z = angle;
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
  onContextMenuTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

interface InnerFaceDecalProps {
  label: BuiltFaceLabel;
  selected: boolean;
  opacity?: number;
  onClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
  onContextTarget: (e: ThreeEvent<PointerEvent>, target: NonNullable<SelectionTarget>) => void;
}

function InnerFaceDecal({
  label,
  selected,
  opacity = 1,
  onClickTarget,
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
  onContextTarget,
}: HingeBranchProps) {
  const target: NonNullable<SelectionTarget> = node.endKey
    ? { kind: 'end', endKey: node.endKey }
    : node.cornerId
      ? { kind: 'seam', cornerId: node.cornerId }
      : { kind: 'piece', partCode };

  const isEndSelected = Boolean(
    node.endKey && selection?.kind === 'end' && selection.endKey === node.endKey
  );
  const isSeamSelected = Boolean(
    node.cornerId && selection?.kind === 'seam' && selection.cornerId === node.cornerId
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
  onRegisterWallHinge: (id: string, group: THREE.Group | null, side: -1 | 1) => void;
  onRegisterDetailHinge: (id: string, group: THREE.Group | null, node: HingeSegmentNode) => void;
  onClickTarget: (e: ThreeEvent<MouseEvent>, target: NonNullable<SelectionTarget>) => void;
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
  onContextTarget,
}: WallBranchProps) {
  const pieceTarget: NonNullable<SelectionTarget> = { kind: 'piece', partCode };

  const wallContent = (
    <group
      name={`wall-${node.id}`}
      position={
        node.hingeSideFromParent === 0
          ? [0, 0, 0]
          : [node.hingeSideFromParent * (node.spanMm / 2) * MM_TO_M, 0, 0]
      }
    >
      <mesh
        geometry={node.geometry}
        material={activeMaterials}
        castShadow
        receiveShadow
        onClick={(e) => onClickTarget(e, pieceTarget)}
        onPointerUp={(e) => onContextTarget(e, pieceTarget)}
      />
      <lineSegments geometry={node.edgesGeometry} material={edgeMaterial} />

      {showFaceLabels && (
        <InnerFaceDecal
          label={node.faceLabel}
          selected={isSelected}
          onClickTarget={onClickTarget}
          onContextTarget={onContextTarget}
        />
      )}

      {/* Integral seams & end flanges hinged directly onto this wall */}
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
          onContextTarget={onContextTarget}
        />
      ))}

      {/* Adjacent walls hinged around this wall's 90° bend edges */}
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
          onContextTarget={onContextTarget}
        />
      ))}
    </group>
  );

  if (node.hingeSideFromParent === 0) {
    return wallContent;
  }

  const side = node.hingeSideFromParent;
  return (
    <group
      name={`hinge-${node.id}`}
      position={[side * (node.parentSpanMm / 2) * MM_TO_M, 0, 0]}
      ref={(el) => onRegisterWallHinge(node.id, el, side)}
    >
      {wallContent}
    </group>
  );
}

/**
 * Renders the parametric 3D straight duct assembly with hierarchical zero-rebuild
 * 60fps pivot groups supporting:
 * - Smooth `Mở phôi 3D` (0% -> 100%) unfolding of walls, seams & integral end flanges
 * - Smooth detached accessory axial retraction & fade during 0% -> 30% unfold
 * - Smooth `Tách mảnh` (0% -> 100%) and `Chưa gò mí <-> Đã gò mí` lock animation
 * - Interactive left-click & right-click picking for pieces, C1/C2 ends, and longitudinal seams
 */
export function DuctAssembly({
  config,
  ribPitchMm,
  selection,
  onSelectTarget,
  onContextMenuTarget,
}: DuctAssemblyProps) {
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

  // Dedicated cloned materials for End Cap accessory so 0->30% opacity fade NEVER affects body pieces
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
  const wallHingeRefs = useRef<Map<string, { group: THREE.Group; side: -1 | 1; pieceId: string }>>(
    new Map()
  );
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

  const handleClickTarget = (
    e: ThreeEvent<MouseEvent>,
    target: NonNullable<SelectionTarget>
  ) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    const same =
      selection !== null &&
      selection.kind === target.kind &&
      ((target.kind === 'piece' && selection.kind === 'piece' && selection.partCode === target.partCode) ||
        (target.kind === 'end' && selection.kind === 'end' && selection.endKey === target.endKey) ||
        (target.kind === 'seam' && selection.kind === 'seam' && selection.cornerId === target.cornerId));
    onSelectTarget(same ? null : target);
  };

  const selectedPartCode = selection?.kind === 'piece' ? selection.partCode : null;
  const detFadeOpacity = 1 - evaluateAccessoryRetractFactor(config.unfoldProgress / 100) * 0.72;

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
              onRegisterWallHinge={(id, grp, side) => {
                if (grp) wallHingeRefs.current.set(id, { group: grp, side, pieceId: piece.id });
                else wallHingeRefs.current.delete(id);
              }}
              onRegisterDetailHinge={(id, grp, node) => {
                if (grp) detailHingeRefs.current.set(id, { group: grp, node, pieceId: piece.id });
                else detailHingeRefs.current.delete(id);
              }}
              onClickTarget={handleClickTarget}
              onContextTarget={onContextMenuTarget}
            />
          </group>
        );
      })}

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
                  onContextTarget={onContextMenuTarget}
                />
              ))}
          </group>
        );
      })}
    </group>
  );
}
