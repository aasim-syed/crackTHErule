"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { buildRoom, disposeScene, DOOR, webglAvailable, type DoorState } from "@/lib/room-scene";

const BG = 0x070a16;

// Demo rule for the attract loop: the door opens when exactly three switches are on.
const demoRule = (bits: string) => bits.split("").filter((b) => b === "1").length === 3;

function flip(bits: string, i: number) {
  return bits.slice(0, i) + (bits[i] === "1" ? "0" : "1") + bits.slice(i + 1);
}

/** Next pattern in the demo: nudge one or two levers, and land a winner every few tries. */
function nextPattern(bits: string, step: number): string {
  if (step % 4 === 3) {
    const idx = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3);
    return [0, 1, 2, 3, 4, 5].map((i) => (idx.includes(i) ? "1" : "0")).join("");
  }
  let next = bits;
  do {
    next = flip(bits, Math.floor(Math.random() * 6));
    if (Math.random() < 0.4) next = flip(next, Math.floor(Math.random() * 6));
  } while (next === bits || demoRule(next));
  return next;
}

function radialTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export default function HeroScene({ onStep }: { onStep?: (bits: string, open: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onStepRef = useRef(onStep);
  const [supported] = useState(() => webglAvailable());

  useEffect(() => {
    onStepRef.current = onStep;
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !supported) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 12, 26);
    const room = buildRoom(scene);

    const doorSpot = new THREE.SpotLight(0xc7d2fe, 40, 14, Math.PI / 7, 0.7, 1.2);
    doorSpot.position.set(0, 5.5, 3.5);
    doorSpot.target.position.set(0, 1.6, DOOR.z);
    scene.add(doorSpot, doorSpot.target);

    // A pool of light spilling across the floor when the door opens.
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 6),
      new THREE.MeshBasicMaterial({
        map: radialTexture("rgba(255,240,200,0.9)", "rgba(255,240,200,0)"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.3, 0.01, DOOR.z + 2.6);
    scene.add(pool);

    // Dust drifting in the air, catching the light.
    const COUNT = 700;
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 7;
      positions[i * 3 + 1] = Math.random() * 4.5;
      positions[i * 3 + 2] = DOOR.z + Math.random() * 6;
      speeds[i] = 0.05 + Math.random() * 0.12;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.035,
      map: radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)"),
      color: 0xffe9b8,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(dustGeo, dustMat));

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    const camBase = new THREE.Vector3(0, 2.6, 8);
    const lookAt = new THREE.Vector3(0, 1.4, 0);
    camera.position.set(0, 3.4, 15);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.72);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      const wide = camera.aspect > 1.15;
      // Wide screens: room on the right, headline on the left.
      // Narrow screens: room in the lower half, below the headline.
      lookAt.set(wide ? -2.6 : 0, wide ? 1.6 : 3.9, 0);
      camBase.set(wide ? 0.8 : 0, wide ? 3.2 : 6.2, wide ? 10.5 : 7 * Math.max(1, 1.55 / camera.aspect));
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    const parallax = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      parallax.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    window.addEventListener("pointermove", onMove);

    // Only render while the hero is on screen.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(mount);

    // --- Attract loop: someone experimenting with the levers ---
    let bits = reducedMotion ? "111000" : "000000";
    let door: DoorState = reducedMotion ? "open" : "untested";
    let step = 0;
    let nextAt = 1.2;
    let phase: "set" | "test" = "set";

    const clock = new THREE.Clock();
    const target = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (!reducedMotion && t > nextAt) {
        if (phase === "set") {
          bits = nextPattern(bits, step++);
          door = "untested";
          phase = "test";
          nextAt = t + 0.7;
        } else {
          const open = demoRule(bits);
          door = open ? "open" : "closed";
          onStepRef.current?.(bits, open);
          phase = "set";
          nextAt = t + (open ? 3.2 : 1.1);
        }
      }

      room.update(bits, door, reducedMotion ? 1 : 0.12);
      const o = room.openness();
      (pool.material as THREE.MeshBasicMaterial).opacity = o * 0.85;
      dustMat.opacity = 0.25 + o * 0.5;
      bloom.strength = 0.7 + o * 0.6;

      if (!reducedMotion) {
        for (let i = 0; i < COUNT; i++) {
          positions[i * 3 + 1] += speeds[i] * dt;
          positions[i * 3] += Math.sin(t * 0.3 + i) * 0.0015;
          if (positions[i * 3 + 1] > 4.5) positions[i * 3 + 1] = 0;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }

      // Slow cinematic drift plus mouse parallax; the first frames dolly in.
      target.copy(camBase).add(new THREE.Vector3(Math.sin(t * 0.15) * 0.35 + parallax.x * 0.7, parallax.y * 0.35, 0));
      camera.position.lerp(target, reducedMotion ? 1 : 0.025);
      camera.lookAt(lookAt);
      composer.render();
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      disposeScene(scene);
      composer.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [supported]);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
