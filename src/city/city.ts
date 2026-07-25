import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from "three";

import { cityLook, type CityLook } from "./look";
import { applyLookToMaterials, createCityMaterials, type CityMaterials } from "./materials";
import { createSeededRandom, pick } from "./random";
import { createCrosswalkTexture, createSignTexture, createWindowTexture } from "./textures";

export type ShibuyaCityOptions = {
  look?: CityLook;
  seed?: number;
};

export type ShibuyaCity = {
  group: Group;
  colliders: Box3[];
  materials: CityMaterials;
  applyLook: (nextLook?: CityLook) => void;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  dispose: () => void;
};

const UP = new Vector3(0, 1, 0);

export function createShibuyaCity(scene: Scene, options: ShibuyaCityOptions = {}): ShibuyaCity {
  const look = options.look ?? cityLook;
  const random = createSeededRandom(options.seed);
  const group = new Group();
  group.name = "Shibuya city art";

  const windowTexture = createWindowTexture(look, random);
  const crosswalkTexture = createCrosswalkTexture();
  const materials = createCityMaterials(look, windowTexture, crosswalkTexture);
  const colliders: Box3[] = [];
  const animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>> = [];
  const rain = createRain(look, materials);

  addGround(group, look, materials);
  addRoads(group, look, materials);
  addBuildings(group, look, materials, random, colliders, animatedSigns);
  addSkyline(group, look, materials);
  group.add(rain);

  scene.add(group);

  return {
    group,
    colliders,
    materials,
    applyLook(nextLook = look) {
      applyLookToMaterials(materials, nextLook);
      rain.visible = nextLook.rain.enabled;
    },
    update(deltaSeconds, elapsedSeconds) {
      rain.position.y -= nextLookValue(look.rain.speed, deltaSeconds);
      if (rain.position.y < -look.rain.height * 0.5) {
        rain.position.y += look.rain.height;
      }

      for (let index = 0; index < animatedSigns.length; index += 1) {
        const material = animatedSigns[index].material;
        material.opacity = 0.72 + Math.sin(elapsedSeconds * 2.1 + index * 0.73) * 0.09;
      }
    },
    dispose() {
      scene.remove(group);
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
      windowTexture.dispose();
      crosswalkTexture.dispose();
    },
  };
}

function addGround(group: Group, look: CityLook, materials: CityMaterials): void {
  const ground = new Mesh(new PlaneGeometry(look.ground.width, look.ground.depth), materials.ground);
  ground.name = "wet asphalt ground";
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
}

function addRoads(group: Group, look: CityLook, materials: CityMaterials): void {
  const roadMaterial = materials.road;
  const zRoad = new Mesh(new PlaneGeometry(28, look.ground.depth), roadMaterial);
  zRoad.name = "center scramble road z";
  zRoad.rotation.x = -Math.PI / 2;
  zRoad.position.y = 0.015;
  group.add(zRoad);

  const xRoad = new Mesh(new PlaneGeometry(look.ground.width, 26), roadMaterial);
  xRoad.name = "center scramble road x";
  xRoad.rotation.x = -Math.PI / 2;
  xRoad.position.y = 0.02;
  group.add(xRoad);

  for (const rotation of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const crossing = new Mesh(new PlaneGeometry(24, 14), materials.crosswalk);
    crossing.name = "scramble crossing stripes";
    crossing.rotation.set(-Math.PI / 2, 0, rotation);
    crossing.position.y = 0.045;
    group.add(crossing);
  }
}

function addBuildings(
  group: Group,
  look: CityLook,
  materials: CityMaterials,
  random: () => number,
  colliders: Box3[],
  animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>>,
): void {
  const footprint = look.buildings.blockSize;
  const startX = -((look.buildings.columns - 1) * footprint) / 2;
  const startZ = -((look.buildings.rows - 1) * footprint) / 2;
  const box = new BoxGeometry(1, 1, 1);
  const matrix = new Matrix4();
  let instance = 0;

  const lots: Array<{ x: number; z: number; width: number; depth: number; height: number }> = [];

  for (let row = 0; row < look.buildings.rows; row += 1) {
    for (let col = 0; col < look.buildings.columns; col += 1) {
      const x = startX + col * footprint;
      const z = startZ + row * footprint;
      const nearRoad = Math.abs(x) < 20 || Math.abs(z) < 19;

      if (nearRoad || random() < 0.08) {
        continue;
      }

      lots.push({
        x: x + (random() - 0.5) * 3.2,
        z: z + (random() - 0.5) * 3.2,
        width: 9 + random() * 5,
        depth: 9 + random() * 6,
        height: look.buildings.minHeight + random() * (look.buildings.maxHeight - look.buildings.minHeight),
      });
    }
  }

  const shellMesh = new InstancedMesh(box, materials.building, lots.length);
  shellMesh.name = "building shells";
  shellMesh.castShadow = true;
  shellMesh.receiveShadow = true;

  for (const lot of lots) {
    matrix.compose(
      new Vector3(lot.x, lot.height / 2, lot.z),
      new Quaternion(),
      new Vector3(lot.width, lot.height, lot.depth),
    );
    shellMesh.setMatrixAt(instance, matrix);
    shellMesh.setColorAt(instance, new Color(look.buildings.baseColor).offsetHSL(0, 0, random() * 0.08));
    colliders.push(
      new Box3(
        new Vector3(lot.x - lot.width / 2, 0, lot.z - lot.depth / 2),
        new Vector3(lot.x + lot.width / 2, lot.height, lot.z + lot.depth / 2),
      ),
    );
    instance += 1;

    addWindowWrap(group, lot, materials);
    addNeonStack(group, look, random, lot, animatedSigns);
  }

  shellMesh.instanceMatrix.needsUpdate = true;
  if (shellMesh.instanceColor) {
    shellMesh.instanceColor.needsUpdate = true;
  }
  group.add(shellMesh);
}

function addWindowWrap(
  group: Group,
  lot: { x: number; z: number; width: number; depth: number; height: number },
  materials: CityMaterials,
): void {
  // Each plane's normal must point away from the shell, or it is backface-culled.
  const faces = [
    { x: lot.x, z: lot.z - lot.depth / 2 - 0.015, width: lot.width, rotation: Math.PI },
    { x: lot.x, z: lot.z + lot.depth / 2 + 0.015, width: lot.width, rotation: 0 },
    { x: lot.x - lot.width / 2 - 0.015, z: lot.z, width: lot.depth, rotation: -Math.PI / 2 },
    { x: lot.x + lot.width / 2 + 0.015, z: lot.z, width: lot.depth, rotation: Math.PI / 2 },
  ];

  for (const face of faces) {
    const windows = new Mesh(new PlaneGeometry(face.width * 0.82, lot.height * 0.82), materials.windows);
    windows.name = "building window texture";
    windows.position.set(face.x, lot.height * 0.53, face.z);
    windows.rotation.y = face.rotation;
    group.add(windows);
  }
}

function addNeonStack(
  group: Group,
  look: CityLook,
  random: () => number,
  lot: { x: number; z: number; width: number; depth: number; height: number },
  animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>>,
): void {
  if (lot.height < look.buildings.minHeight + 5 || random() < 0.1) {
    return;
  }

  const face = random() > 0.5 ? "x" : "z";
  const direction = random() > 0.5 ? 1 : -1;
  const count = 1 + Math.floor(random() * look.neon.signsPerTallBuilding);

  for (let index = 0; index < count; index += 1) {
    const color = pick(look.neon.colors, random);
    const texture = createSignTexture(pick(look.neon.copy, random), color);
    const material = new MeshBasicMaterial({
      map: texture,
      color: new Color(color).multiplyScalar(look.neon.intensity),
      transparent: true,
      toneMapped: false,
    });

    const sign = new Mesh(new PlaneGeometry(look.neon.signWidth, look.neon.signHeight), material);
    sign.name = "neon katakana sign";
    sign.position.y = Math.min(lot.height - 4, 6 + index * (look.neon.signHeight + 1.2));

    if (face === "z") {
      sign.position.x = lot.x + (random() - 0.5) * lot.width * 0.45;
      sign.position.z = lot.z + direction * (lot.depth / 2 + 0.08);
      sign.rotation.y = direction > 0 ? 0 : Math.PI;
    } else {
      sign.position.x = lot.x + direction * (lot.width / 2 + 0.08);
      sign.position.z = lot.z + (random() - 0.5) * lot.depth * 0.45;
      sign.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    animatedSigns.push(sign);
    group.add(sign);
    addReflection(group, look, sign, color);
  }
}

function addReflection(group: Group, look: CityLook, sign: Mesh, color: string): void {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: look.ground.reflectionOpacity,
    depthWrite: false,
    toneMapped: false,
  });
  const reflection = new Mesh(new PlaneGeometry(look.neon.signWidth * 1.5, look.neon.signHeight * 1.8), material);
  reflection.name = "fake neon road reflection";
  reflection.position.set(sign.position.x, 0.055, sign.position.z);
  reflection.rotation.x = -Math.PI / 2;
  reflection.rotation.z = sign.rotation.y;
  group.add(reflection);
}

function addSkyline(group: Group, look: CityLook, materials: CityMaterials): void {
  if (!look.skyline.enabled) {
    return;
  }

  const geometry = new BoxGeometry(1, 1, 1);
  const count = 54;
  const skyline = new InstancedMesh(geometry, materials.skyline, count);
  skyline.name = "distant rooftop skyline";

  const random = createSeededRandom(442);
  const matrix = new Matrix4();

  for (let index = 0; index < count; index += 1) {
    const side = index % 4;
    const width = 6 + random() * 14;
    const depth = 4 + random() * 12;
    const height = 10 + random() * 38;
    const x = side < 2 ? -85 + index * 3.2 : (random() - 0.5) * 170;
    const z = side < 2 ? (side === 0 ? -112 : 112) : side === 2 ? -88 : 88;

    matrix.compose(new Vector3(x, height / 2, z), new Quaternion().setFromAxisAngle(UP, random() * Math.PI), new Vector3(width, height, depth));
    skyline.setMatrixAt(index, matrix);
  }

  skyline.instanceMatrix.needsUpdate = true;
  group.add(skyline);
}

function createRain(look: CityLook, materials: CityMaterials): LineSegments {
  const positions: number[] = [];
  const random = createSeededRandom(991);

  for (let index = 0; index < look.rain.count; index += 1) {
    const x = (random() - 0.5) * look.rain.radius * 2;
    const y = random() * look.rain.height;
    const z = (random() - 0.5) * look.rain.radius * 2;

    positions.push(x, y, z, x + 0.08, y - 1.4, z + 0.05);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  const rain = new LineSegments(geometry, materials.rain);
  rain.name = "rain streak field";
  rain.visible = look.rain.enabled;
  return rain;
}

function nextLookValue(value: number, deltaSeconds: number): number {
  return value * deltaSeconds;
}
