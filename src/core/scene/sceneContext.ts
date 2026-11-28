import { createContext, useContext } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { SelectionTarget } from '../types/duct';

export type SceneContextMenuHandler = (
  e: ThreeEvent<PointerEvent>,
  target: NonNullable<SelectionTarget>
) => void;

export const SceneContextMenuContext = createContext<SceneContextMenuHandler | null>(null);

/** Hook for pluggable 3D product assemblies inside `<DuctScene>` to trigger CAD right-click menu safely (ignoring right-drag pans). */
export function useSceneContextMenu(): SceneContextMenuHandler {
  const ctx = useContext(SceneContextMenuContext);
  return ctx ?? (() => {});
}
