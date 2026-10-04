"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type DoorState = "open" | "closed" | "untested";

const LAMP_COLORS: Record<DoorState, number> = { open: 0x34d399, closed: 0xfb7185, untested: 0x64748b };
const AMBER = 0xfcd34d;
const SPACING = 0.78;

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function numberSprite(n: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 32, 34);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  sprite.scale.set(0.28, 0.28, 1);
  return sprite;
}

/**
 * A small escape room: six levers on a console and a door that swings open.
 * Levers are clickable; the parent stays the source of truth for state.
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

    // --- Lighting ---
    scene.add(new THREE.HemisphereLight(0xb4c6ff, 0x2a1d30, 1.4));
    const fill = new THREE.DirectionalLight(0x9db4ff, 0.6);
    fill.position.set(-4, 4, 6);
    scene.add(fill);
    const key = new THREE.SpotLight(0xfff1d6, 120, 25, Math.PI / 4, 0.6, 1.5);
    key.position.set(0.6, 7.5, 5.5);
    key.target.position.set(0, 0.8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 20;
    scene.add(key, key.target);

    // --- Room ---
    const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std(0x1c2238));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.3), std(0x2b3459));
    wall.position.set(0, 3.5, -1.65);
    wall.receiveShadow = true;
    scene.add(wall);

    // Door opening, frame and the light beyond it.
    const DW = 1.5, DH = 2.7, DZ = -1.45;
    const beyond = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), new THREE.MeshBasicMaterial({ color: 0xfff7d6 }));
    beyond.position.set(0, DH / 2, DZ - 0.12);
    scene.add(beyond);
    const frameMat = std(0x3b2f2a, { roughness: 0.6 });
    for (const [w, h, x, y] of [
      [0.16, DH + 0.16, -DW / 2 - 0.08, DH / 2],
      [0.16, DH + 0.16, DW / 2 + 0.08, DH / 2],
      [DW + 0.32, 0.16, 0, DH + 0.08],
    ]) {
      const piece = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), frameMat);
      piece.position.set(x, y, DZ);
      piece.castShadow = true;
      scene.add(piece);
    }
    const hinge = new THREE.Group();
    hinge.position.set(-DW / 2, 0, DZ);
    scene.add(hinge);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.08), std(0x2a3150, { roughness: 0.5, metalness: 0.2 }));
    panel.position.set(DW / 2, DH / 2, 0);
    panel.castShadow = true;
    hinge.add(panel);
    for (const y of [0.75, 1.95]) {
      const inset = new THREE.Mesh(new THREE.BoxGeometry(DW - 0.4, 0.9, 0.02), std(0x232a45));
      inset.position.set(DW / 2, y, 0.05);
      hinge.add(inset);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), std(AMBER, { metalness: 0.8, roughness: 0.3 }));
    knob.position.set(DW - 0.18, 1.3, 0.08);
    hinge.add(knob);
    const doorLight = new THREE.PointLight(0xfff7d6, 0, 6, 1.5);
    doorLight.position.set(0, 1.4, DZ + 0.4);
    scene.add(doorLight);

    // Status lamp above the door.
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: LAMP_COLORS.untested, emissiveIntensity: 1 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), lampMat);
    lamp.position.set(0, DH + 0.42, DZ + 0.1);
    scene.add(lamp);
    const lampLight = new THREE.PointLight(LAMP_COLORS.untested, 2, 4, 2);
    lampLight.position.copy(lamp.position).add(new THREE.Vector3(0, 0, 0.3));
    scene.add(lampLight);

    // --- Console with six levers ---
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.9, 1), std(0x262d4a, { roughness: 0.7 }));
    desk.position.set(0, 0.45, 2.3);
    desk.castShadow = desk.receiveShadow = true;
    scene.add(desk);
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.06, 1.1), std(0x313a5e, { roughness: 0.5 }));
    top.position.set(0, 0.93, 2.3);
    top.receiveShadow = true;
    scene.add(top);

    const clickable: THREE.Object3D[] = [];
    const levers: { pivot: THREE.Group; bulb: THREE.MeshStandardMaterial; knob: THREE.MeshStandardMaterial; glow: THREE.PointLight }[] = [];
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * SPACING;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.55), std(0x11152a, { roughness: 0.4 }));
      base.position.set(x, 1.02, 2.32);
      base.userData.index = i;
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.06, 2.32);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.55, 12), std(0x9aa3b8, { metalness: 0.7, roughness: 0.3 }));
      stick.position.y = 0.27;
      stick.castShadow = true;
      const knobMat = std(0x4b5563, { roughness: 0.35 });
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 20), knobMat);
      handle.position.y = 0.56;
      handle.castShadow = true;
      for (const m of [stick, handle]) m.userData.index = i;
      pivot.add(stick, handle);
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: AMBER, emissiveIntensity: 0 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), bulbMat);
      bulb.position.set(x, 1.0, 1.92);
      const glow = new THREE.PointLight(AMBER, 0, 1.2, 2);
      glow.position.set(x, 1.15, 1.95);
      const label = numberSprite(i + 1);
      label.position.set(x, 0.66, 2.82);
      scene.add(base, pivot, bulb, glow, label);
      clickable.push(base, stick, handle);
      levers.push({ pivot, bulb: bulbMat, knob: knobMat, glow });
    }

    // --- Interaction ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const parallax = new THREE.Vector2();
    let hovered = -1;
    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0];
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
    const color = new THREE.Color();
    let doorAngle = 0;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { bits: b, door: d } = props.current;
      const k = reducedMotion ? 1 : 0.14;

      levers.forEach((l, i) => {
        const on = b[i] === "1";
        l.pivot.rotation.x += ((on ? -0.55 : 0.55) - l.pivot.rotation.x) * k;
        l.bulb.emissiveIntensity += ((on ? 2.4 : 0) - l.bulb.emissiveIntensity) * k;
        l.glow.intensity += ((on ? 0.9 : 0) - l.glow.intensity) * k;
        l.knob.color.lerp(color.set(on ? AMBER : i === hovered ? 0x94a3b8 : 0x4b5563), k);
      });

      const open = d === "open";
      doorAngle += ((open ? -1.75 : 0) - doorAngle) * (reducedMotion ? 1 : 0.07);
      hinge.rotation.y = doorAngle;
      doorLight.intensity += ((open ? 6 : 0) - doorLight.intensity) * k;
      lampMat.emissive.lerp(color.set(LAMP_COLORS[d]), k);
      lampLight.color.lerp(color.set(LAMP_COLORS[d]), k);
      lampMat.emissiveIntensity = d === "untested" ? 0.6 : 2.2;

      const target = camBase.clone().add(new THREE.Vector3(parallax.x * 0.6, parallax.y * 0.3, 0));
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
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            (m as THREE.SpriteMaterial).map?.dispose();
            m.dispose();
          });
        }
      });
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
