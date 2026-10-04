"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildRoom, disposeScene, webglAvailable, type DoorState } from "@/lib/room-scene";

/**
 * The in-game 3D view. Levers are clickable; the parent stays the source of truth for state.
 */
export default function Room3D({
  bits,
  door,
  onToggle,
  height = 300,
}: {
  bits: string;
  door: DoorState;
  onToggle?: (i: number) => void;
  height?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const props = useRef({ bits, door, onToggle });
  const [failed] = useState(() => !webglAvailable());

  useEffect(() => {
    props.current = { bits, door, onToggle };
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || failed) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "manipulation";

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1020, 9, 18);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    const camBase = new THREE.Vector3(0, 3.4, 8.4);
    const lookAt = new THREE.Vector3(0, 1.35, 0);
    camera.position.copy(camBase);
    const room = buildRoom(scene);

    // --- Interaction ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const parallax = new THREE.Vector2();
    let hovered = -1;
    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(room.clickable, false)[0];
      return hit ? (hit.object.userData.index as number) : -1;
    };
    const onMove = (e: PointerEvent) => {
      const i = pick(e);
      if (e.pointerType === "mouse") parallax.copy(pointer);
      hovered = props.current.onToggle ? i : -1;
      renderer.domElement.style.cursor = hovered >= 0 ? "pointer" : "default";
    };
    const onDown = (e: PointerEvent) => {
      const i = pick(e);
      if (i >= 0) props.current.onToggle?.(i);
    };
    const onLeave = () => {
      hovered = -1;
      parallax.set(0, 0);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // Pull the camera back on narrow screens so the whole console fits.
      camBase.z = 8.4 * Math.max(1, 1.45 / camera.aspect);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    // --- Animation ---
    const target = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      room.update(props.current.bits, props.current.door, reducedMotion ? 1 : 0.14, hovered);
      target.copy(camBase).add(new THREE.Vector3(parallax.x * 0.6, parallax.y * 0.3, 0));
      camera.position.lerp(target, reducedMotion ? 1 : 0.05);
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      disposeScene(scene);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [failed]);

  if (failed) {
    return <p className="rounded-xl border border-white/10 p-4 text-sm text-white/60">3D isn&apos;t supported on this device. Switch back to 2D.</p>;
  }
  return (
    <div
      ref={mountRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-xl"
      role="img"
      aria-label={`3D room: switches ${bits.split("").map((b, i) => `${i + 1} ${b === "1" ? "on" : "off"}`).join(", ")}; door ${door}`}
    />
  );
}
