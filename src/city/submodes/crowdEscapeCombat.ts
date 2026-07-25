import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from "three";

import type { CityLook } from "../look";

type Blocker = {
  mesh: Mesh<CylinderGeometry, MeshBasicMaterial>;
  base: Vector3;
  push: Vector3;
  stunSeconds: number;
};

type Pulse = {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  age: number;
  duration: number;
};

export type CrowdEscapeCombatSubmode = {
  group: Group;
  triggerShockwave: (origin?: Vector3) => void;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  dispose: () => void;
};

const SHOCKWAVE_RADIUS = 34;
const SHOCKWAVE_COOLDOWN = 0.8;

export function shouldEnableCrowdEscapeCombatSubmode(search = globalThis.location?.search ?? ""): boolean {
  const params = new URLSearchParams(search);
  const value = (params.get("sub") ?? params.get("mode") ?? "").toLowerCase();
  return value === "crowd-combat" || value === "crowd-escape" || value === "combat";
}

export function createCrowdEscapeCombatSubmode(look: CityLook): CrowdEscapeCombatSubmode {
  const group = new Group();
  group.name = "Crowd Escape Combat submode";

  const palette = districtPalette(look);
  const blockers = createBlockers(group, palette);
  const pulses: Pulse[] = [];
  let cooldown = 0;

  const triggerShockwave = (origin = new Vector3(0, 0.08, 0)) => {
    if (cooldown > 0) {
      return;
    }

    cooldown = SHOCKWAVE_COOLDOWN;
    const pulse = createPulse(origin, palette);
    pulses.push(pulse);
    group.add(pulse.mesh);

    for (const blocker of blockers) {
      const delta = blocker.base.clone().sub(origin);
      delta.y = 0;
      const distance = delta.length();

      if (distance > SHOCKWAVE_RADIUS) {
        continue;
      }

      const strength = 1 - distance / SHOCKWAVE_RADIUS;
      const direction = delta.lengthSq() > 0.01 ? delta.normalize() : new Vector3(0, 0, -1);
      blocker.push.copy(direction.multiplyScalar(8 + strength * 12));
      blocker.stunSeconds = 0.75 + strength * 0.45;
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== "KeyF" && event.code !== "Space") {
      return;
    }

    triggerShockwave();
  };

  globalThis.addEventListener?.("keydown", onKeyDown);

  return {
    group,
    triggerShockwave,
    update(deltaSeconds, elapsedSeconds) {
      cooldown = Math.max(0, cooldown - deltaSeconds);
      updatePulses(group, pulses, deltaSeconds);
      updateBlockers(blockers, deltaSeconds, elapsedSeconds);
    },
    dispose() {
      globalThis.removeEventListener?.("keydown", onKeyDown);
      group.traverse((object) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material?.dispose();
        }
      });
    },
  };
}

function createPulse(origin: Vector3, palette: ReturnType<typeof districtPalette>): Pulse {
  const material = new MeshBasicMaterial({
    color: palette.shockwave,
    transparent: true,
    opacity: 0.9,
    side: DoubleSide,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(new RingGeometry(0.82, 1, 96), material);
  mesh.name = "crowd escape shockwave";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(origin);
  mesh.position.y = 0.1;
  mesh.scale.setScalar(1);

  return {
    mesh,
    age: 0,
    duration: 0.72,
  };
}

function updatePulses(group: Group, pulses: Pulse[], deltaSeconds: number): void {
  for (let index = pulses.length - 1; index >= 0; index -= 1) {
    const pulse = pulses[index];
    pulse.age += deltaSeconds;

    const t = Math.min(1, pulse.age / pulse.duration);
    const radius = 2 + t * SHOCKWAVE_RADIUS;
    pulse.mesh.scale.setScalar(radius);
    pulse.mesh.material.opacity = (1 - t) * 0.9;

    if (t >= 1) {
      group.remove(pulse.mesh);
      pulse.mesh.geometry.dispose();
      pulse.mesh.material.dispose();
      pulses.splice(index, 1);
    }
  }
}

function createBlockers(group: Group, palette: ReturnType<typeof districtPalette>): Blocker[] {
  const material = new MeshBasicMaterial({
    color: palette.blocker,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
  });
  const geometry = new CylinderGeometry(1.2, 1.8, 3.2, 6);
  const positions = [
    new Vector3(-8, 1.6, -30),
    new Vector3(7, 1.6, -22),
    new Vector3(-12, 1.6, -8),
    new Vector3(13, 1.6, 10),
    new Vector3(-7, 1.6, 26),
    new Vector3(9, 1.6, 36),
  ];

  return positions.map((base, index) => {
    const mesh = new Mesh(geometry.clone(), material.clone());
    mesh.name = "crowd escape hostile blocker marker";
    mesh.position.copy(base);
    mesh.rotation.y = index * 0.57;
    group.add(mesh);

    return {
      mesh,
      base,
      push: new Vector3(),
      stunSeconds: 0,
    };
  });
}

function updateBlockers(blockers: Blocker[], deltaSeconds: number, elapsedSeconds: number): void {
  for (let index = 0; index < blockers.length; index += 1) {
    const blocker = blockers[index];
    blocker.stunSeconds = Math.max(0, blocker.stunSeconds - deltaSeconds);
    blocker.push.multiplyScalar(Math.pow(0.04, deltaSeconds));

    const warningBob = Math.sin(elapsedSeconds * 4.5 + index) * 0.24;
    const warningPulse = 0.4 + Math.sin(elapsedSeconds * 6.8 + index * 0.8) * 0.12;
    blocker.mesh.position.copy(blocker.base).add(blocker.push);
    blocker.mesh.position.y = blocker.base.y + warningBob;
    blocker.mesh.rotation.y += deltaSeconds * (1.1 + index * 0.08);
    blocker.mesh.scale.setScalar(blocker.stunSeconds > 0 ? 0.72 : 1 + warningPulse * 0.18);
    blocker.mesh.material.opacity = blocker.stunSeconds > 0 ? 0.18 : 0.42 + warningPulse;
  }
}

function districtPalette(look: CityLook): {
  shockwave: Color;
  blocker: Color;
} {
  if (look.district.id === "roppongi") {
    return {
      shockwave: new Color("#8b5cff"),
      blocker: new Color("#ff3d9a"),
    };
  }

  if (look.district.id === "tokyo-tower") {
    return {
      shockwave: new Color("#ff5a36"),
      blocker: new Color("#ffb04a"),
    };
  }

  if (look.district.id === "kyoto") {
    return {
      shockwave: new Color("#ffb457"),
      blocker: new Color("#d63b24"),
    };
  }

  if (look.district.id === "tokyo") {
    return {
      shockwave: new Color("#f7c76b"),
      blocker: new Color("#92c8ff"),
    };
  }

  return {
    shockwave: new Color("#00e5ff"),
    blocker: new Color("#ff2f8f"),
  };
}
