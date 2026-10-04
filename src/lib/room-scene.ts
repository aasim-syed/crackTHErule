import * as THREE from "three";

// The escape room shared by the in-game view and the landing page hero:
// a wall with a door (and light beyond it), a status lamp, and a console of six levers.

export type DoorState = "open" | "closed" | "untested";

const LAMP_COLORS: Record<DoorState, number> = { open: 0x34d399, closed: 0xfb7185, untested: 0x64748b };
export const AMBER = 0xfcd34d;
const SPACING = 0.78;

export const DOOR = { width: 1.5, height: 2.7, z: -1.45 };

export function webglAvailable(): boolean {
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

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

export function buildRoom(scene: THREE.Scene) {
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

  // --- Room shell ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std(0x1c2238));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.3), std(0x2b3459));
  wall.position.set(0, 3.5, -1.65);
  wall.receiveShadow = true;
  scene.add(wall);

  // --- Door, frame, and the light beyond it ---
  const { width: DW, height: DH, z: DZ } = DOOR;
  const beyondMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6 });
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), beyondMat);
  // Sits just in front of the wall face (the wall is solid), hidden by the closed door.
  beyond.position.set(0, DH / 2, DZ - 0.04);
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
  hinge.position.set(-DW / 2, 0, DZ + 0.03);
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

  // --- Status lamp above the door ---
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

  const color = new THREE.Color();
  let doorAngle = 0;

  /** Ease every moving part toward the given state. k is the easing factor (1 = snap). */
  function update(bits: string, door: DoorState, k: number, hovered = -1) {
    levers.forEach((l, i) => {
      const on = bits[i] === "1";
      l.pivot.rotation.x += ((on ? -0.55 : 0.55) - l.pivot.rotation.x) * k;
      l.bulb.emissiveIntensity += ((on ? 2.4 : 0) - l.bulb.emissiveIntensity) * k;
      l.glow.intensity += ((on ? 0.9 : 0) - l.glow.intensity) * k;
      l.knob.color.lerp(color.set(on ? AMBER : i === hovered ? 0x94a3b8 : 0x4b5563), k);
    });
    const open = door === "open";
    doorAngle += ((open ? -1.75 : 0) - doorAngle) * (k >= 1 ? 1 : k * 0.5);
    hinge.rotation.y = doorAngle;
    doorLight.intensity += ((open ? 6 : 0) - doorLight.intensity) * k;
    lampMat.emissive.lerp(color.set(LAMP_COLORS[door]), k);
    lampLight.color.lerp(color.set(LAMP_COLORS[door]), k);
    lampMat.emissiveIntensity = door === "untested" ? 0.6 : 2.2;
  }

  /** 0 = shut, 1 = fully open; handy for effects keyed to the door. */
  const openness = () => Math.min(1, -doorAngle / 1.75);

  return { clickable, update, openness, beyondMat, doorLight };
}

export function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        (m as THREE.SpriteMaterial).map?.dispose();
        m.dispose();
      });
    }
  });
}
