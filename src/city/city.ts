import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from "three";

import { cityLook, cityLooks, cloneCityLook, type CityLook, type DistrictId } from "./look";
import { applyLookToMaterials, createCityMaterials, type CityMaterials } from "./materials";
import { createSeededRandom, pick } from "./random";
import {
  createCrowdEscapeCombatSubmode,
  shouldEnableCrowdEscapeCombatSubmode,
  type CrowdEscapeCombatSubmode,
} from "./submodes/crowdEscapeCombat";
import { createCrosswalkTexture, createSignTexture, createWindowTexture } from "./textures";

export type ShibuyaCityOptions = {
  look?: CityLook;
  district?: DistrictId;
  seed?: number;
};

export type ShibuyaCity = {
  group: Group;
  colliders: Box3[];
  materials: CityMaterials;
  applyLook: (nextLook?: CityLook) => void;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  dispose: () => void;
  crowdEscapeCombat?: CrowdEscapeCombatSubmode;
};

const UP = new Vector3(0, 1, 0);

// Real Shibuya proportions → game coords (see shibuya-spec.md). +X east, +Z south.
type Landmark = {
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  shape: "box" | "cylinder" | "taper";
};

const LANDMARKS: Landmark[] = [
  { name: "Shibuya Scramble Square", x: 54, z: 72, width: 60, depth: 60, height: 60, shape: "taper" },
  { name: "Shibuya Hikarie", x: 72, z: 54, width: 45, depth: 45, height: 46, shape: "box" },
  { name: "Shibuya Stream", x: 36, z: 108, width: 40, depth: 40, height: 46, shape: "box" },
  { name: "Shibuya 109", x: -54, z: 36, width: 36, depth: 36, height: 22, shape: "cylinder" },
  { name: "MAGNET by 109", x: -36, z: -36, width: 30, depth: 30, height: 16, shape: "box" },
  { name: "QFRONT", x: 0, z: -36, width: 40, depth: 28, height: 16, shape: "box" },
  { name: "Shibuya Station", x: 18, z: 54, width: 70, depth: 36, height: 10, shape: "box" },
];

function insideAnyLandmark(x: number, z: number): boolean {
  return LANDMARKS.some((l) => Math.abs(x - l.x) < l.width / 2 && Math.abs(z - l.z) < l.depth / 2);
}

// Position + Y-rotation for a plane whose normal points from (cx,cz) at the crossing origin,
// pushed out by `offset` so it clads the building face facing the square.
function faceOrigin(cx: number, cz: number, offset: number): { x: number; z: number; rotationY: number } {
  const nx = -cx;
  const nz = -cz;
  const len = Math.hypot(nx, nz) || 1;
  return { x: cx + (nx / len) * offset, z: cz + (nz / len) * offset, rotationY: Math.atan2(nx, nz) };
}

export function createShibuyaCity(scene: Scene, options: ShibuyaCityOptions = {}): ShibuyaCity {
  const look = options.look ?? (options.district ? cloneCityLook(cityLooks[options.district]) : cityLook);
  const random = createSeededRandom(options.seed);
  const group = new Group();
  group.name = `${look.district.label} city art`;

  const windowTexture = createWindowTexture(look, random);
  const crosswalkTexture = createCrosswalkTexture();
  const materials = createCityMaterials(look, windowTexture, crosswalkTexture);
  const colliders: Box3[] = [];
  const animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>> = [];
  const rain = createRain(look, materials);
  const crowdEscapeCombat = shouldEnableCrowdEscapeCombatSubmode()
    ? createCrowdEscapeCombatSubmode(look)
    : undefined;

  addGround(group, look, materials);
  addRoads(group, look, materials);
  addDistrictLandmarks(group, look, colliders);
  addBuildings(group, look, materials, random, colliders, animatedSigns);
  addLandmarks(group, look, materials, colliders, animatedSigns);
  addSkyline(group, look, materials);
  if (crowdEscapeCombat) {
    group.add(crowdEscapeCombat.group);
  }
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
      crowdEscapeCombat?.update(deltaSeconds, elapsedSeconds);
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
      crowdEscapeCombat?.dispose();
      windowTexture.dispose();
      crosswalkTexture.dispose();
    },
    crowdEscapeCombat,
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
  const zRoad = new Mesh(new PlaneGeometry(look.ground.verticalRoadWidth, look.ground.depth), roadMaterial);
  zRoad.name = "center scramble road z";
  zRoad.rotation.x = -Math.PI / 2;
  zRoad.position.y = 0.015;
  group.add(zRoad);

  const xRoad = new Mesh(new PlaneGeometry(look.ground.width, look.ground.horizontalRoadWidth), roadMaterial);
  xRoad.name = "center scramble road x";
  xRoad.rotation.x = -Math.PI / 2;
  xRoad.position.y = 0.02;
  group.add(xRoad);

  // 4 straight edge crosswalks + 2 diagonals long enough to span the ~50 square corner-to-corner.
  const crossings: Array<{ w: number; h: number; rot: number }> = [
    { w: 24, h: 14, rot: 0 },
    { w: 24, h: 14, rot: Math.PI / 2 },
    { w: 64, h: 16, rot: Math.PI / 4 },
    { w: 64, h: 16, rot: -Math.PI / 4 },
  ];
  for (const { w, h, rot } of crossings) {
    const crossing = new Mesh(new PlaneGeometry(w, h), materials.crosswalk);
    crossing.name = "scramble crossing stripes";
    crossing.rotation.set(-Math.PI / 2, 0, rot);
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
      const nearRoad = Math.abs(x) < look.ground.verticalRoadWidth * 0.72 || Math.abs(z) < look.ground.horizontalRoadWidth * 0.72;

      if (nearRoad || insideAnyLandmark(x, z) || random() < 0.08) {
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

function addLandmarks(
  group: Group,
  look: CityLook,
  materials: CityMaterials,
  colliders: Box3[],
  animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>>,
): void {
  // Few and distinct — individual meshes, not the instanced shell.
  const glass = new MeshStandardMaterial({
    color: "#0d1826",
    roughness: 0.16,
    metalness: 0.85,
    emissive: new Color("#12325a"),
    emissiveIntensity: 0.45,
  });
  const concrete = new MeshStandardMaterial({ color: "#20344a", roughness: 0.42, metalness: 0.28 });

  for (const l of LANDMARKS) {
    if (l.shape === "cylinder") {
      // Shibuya 109: round fashion tower — reads distinct from the boxy grid.
      const body = new Mesh(new CylinderGeometry(l.width / 2, l.width / 2, l.height, 24), concrete);
      body.name = l.name;
      body.position.set(l.x, l.height / 2, l.z);
      body.castShadow = true;
      group.add(body);
      addRoofSign(group, l);
    } else if (l.shape === "taper") {
      // Scramble Square: tapered glass tower, clearly tallest. ponytail: 4-seg cylinder = square prism taper.
      const radius = l.width / Math.SQRT2;
      const tower = new Mesh(new CylinderGeometry(radius * 0.72, radius, l.height, 4), glass);
      tower.name = l.name;
      tower.rotation.y = Math.PI / 4;
      tower.position.set(l.x, l.height / 2, l.z);
      tower.castShadow = true;
      group.add(tower);
    } else {
      const lot = { x: l.x, z: l.z, width: l.width, depth: l.depth, height: l.height };
      const box = new Mesh(new BoxGeometry(l.width, l.height, l.depth), materials.building);
      box.name = l.name;
      box.position.set(l.x, l.height / 2, l.z);
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);
      addWindowWrap(group, lot, materials);
    }

    colliders.push(
      new Box3(
        new Vector3(l.x - l.width / 2, 0, l.z - l.depth / 2),
        new Vector3(l.x + l.width / 2, l.height, l.z + l.depth / 2),
      ),
    );
  }

  // Hachiko plinth — tiny landmark in the plaza just S of the crossing.
  const plinth = new Mesh(new BoxGeometry(2, 2, 2), concrete);
  plinth.name = "Hachiko statue plinth";
  plinth.position.set(16, 1, 30);
  group.add(plinth);
  colliders.push(new Box3(new Vector3(15, 0, 29), new Vector3(17, 2, 31)));

  // Signature inward-facing LED ad screens ringing the crossing.
  const q = faceOrigin(0, -36, 14); // QFRONT hero — curved south face
  for (const t of [-1, 0, 1]) {
    // ponytail: segmented curve, not a real curved mesh.
    addAdScreen(group, animatedSigns, {
      copy: "渋谷",
      color: "#00e5ff",
      x: q.x + t * 9.5,
      y: 12,
      z: q.z - Math.abs(t) * 1.5,
      width: 10,
      height: 24,
      rotationY: -t * 0.28,
    });
  }

  const magnet = faceOrigin(-36, -36, 15);
  addAdScreen(group, animatedSigns, {
    copy: "MAGNET",
    color: "#ff2f8f",
    x: magnet.x,
    y: 10,
    z: magnet.z,
    width: 14,
    height: 18,
    rotationY: magnet.rotationY,
  });

  const westWall = faceOrigin(-28, -6, 0); // vertical ad wall toward the 109 fork, faces E into the square
  addAdScreen(group, animatedSigns, {
    copy: "SALE",
    color: "#ffd23f",
    x: westWall.x,
    y: 11,
    z: westWall.z,
    width: 10,
    height: 20,
    rotationY: westWall.rotationY,
  });

  const scramble = faceOrigin(54, 72, 30); // Scramble Square NW station-side board
  addAdScreen(group, animatedSigns, {
    copy: "SHIBUYA",
    color: "#48ff7b",
    x: scramble.x,
    y: 14,
    z: scramble.z,
    width: 16,
    height: 20,
    rotationY: scramble.rotationY,
  });

  materials.all.push(glass, concrete);
}

function addRoofSign(group: Group, l: Landmark): void {
  const face = faceOrigin(l.x, l.z, l.width / 2 + 0.1);
  const texture = createSignTexture("109", "#101018");
  const material = new MeshBasicMaterial({
    map: texture,
    color: new Color("#ffffff").multiplyScalar(1.6),
    transparent: true,
    toneMapped: false,
  });
  const sign = new Mesh(new PlaneGeometry(7, 15), material);
  sign.name = "109 vertical roof sign";
  sign.position.set(face.x, l.height * 0.7, face.z);
  sign.rotation.y = face.rotationY;
  group.add(sign);
}

function addAdScreen(
  group: Group,
  animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>>,
  opts: { copy: string; color: string; x: number; y: number; z: number; width: number; height: number; rotationY: number },
): void {
  const texture = createSignTexture(opts.copy, opts.color);
  const material = new MeshBasicMaterial({
    map: texture,
    color: new Color(opts.color).multiplyScalar(2.6),
    transparent: true,
    toneMapped: false,
  });
  const screen = new Mesh(new PlaneGeometry(opts.width, opts.height), material);
  screen.name = "shibuya led ad screen";
  screen.position.set(opts.x, opts.y, opts.z);
  screen.rotation.y = opts.rotationY;
  animatedSigns.push(screen);
  group.add(screen);
}

function addNeonStack(
  group: Group,
  look: CityLook,
  random: () => number,
  lot: { x: number; z: number; width: number; depth: number; height: number },
  animatedSigns: Array<Mesh<PlaneGeometry, MeshBasicMaterial>>,
): void {
  if (lot.height < look.buildings.minHeight + 5 || random() > look.neon.signChance) {
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

function addDistrictLandmarks(group: Group, look: CityLook, colliders: Box3[]): void {
  if (look.district.id === "tokyo") {
    addTokyoStationGlow(group, look);
    return;
  }

  if (look.district.id === "roppongi") {
    addRoppongiTower(group, colliders);
    return;
  }

  if (look.district.id === "tokyo-tower") {
    addTokyoTowerArea(group, colliders);
    return;
  }

  if (look.district.id === "kyoto") {
    addKyotoLandmarks(group, look, colliders);
  }
}

function addTokyoStationGlow(group: Group, look: CityLook): void {
  const amber = new MeshBasicMaterial({
    color: "#ffbf6d",
    transparent: true,
    opacity: 0.74,
    toneMapped: false,
  });
  const glass = new MeshBasicMaterial({
    color: "#9edcff",
    transparent: true,
    opacity: 0.32,
    toneMapped: false,
  });

  const platformNorth = new Mesh(new PlaneGeometry(look.ground.width * 0.72, 2.6), amber);
  platformNorth.name = "Tokyo station amber platform glow";
  platformNorth.rotation.x = -Math.PI / 2;
  platformNorth.position.set(0, 0.07, look.ground.horizontalRoadWidth * 0.72);
  group.add(platformNorth);

  const platformSouth = platformNorth.clone();
  platformSouth.position.z = -look.ground.horizontalRoadWidth * 0.72;
  group.add(platformSouth);

  for (const x of [-42, 42]) {
    const concourse = new Mesh(new BoxGeometry(16, 1.8, 5), glass);
    concourse.name = "Tokyo station glass concourse light";
    concourse.position.set(x, 4.2, -look.ground.horizontalRoadWidth * 0.95);
    group.add(concourse);
  }
}

function addRoppongiTower(group: Group, colliders: Box3[]): void {
  const towerMaterial = new MeshBasicMaterial({
    color: "#6fb7ff",
    transparent: true,
    opacity: 0.34,
    toneMapped: false,
  });
  const crownMaterial = new MeshBasicMaterial({
    color: "#b895ff",
    transparent: true,
    opacity: 0.86,
    toneMapped: false,
  });
  const tower = new Mesh(new BoxGeometry(11, 82, 11), towerMaterial);
  tower.name = "Roppongi glass tower silhouette";
  tower.position.set(46, 41, -48);
  group.add(tower);

  const crown = new Mesh(new BoxGeometry(14, 1.2, 14), crownMaterial);
  crown.name = "Roppongi tower violet crown";
  crown.position.set(46, 82.8, -48);
  group.add(crown);

  colliders.push(new Box3(new Vector3(40.5, 0, -53.5), new Vector3(51.5, 82, -42.5)));
}

function addTokyoTowerArea(group: Group, colliders: Box3[]): void {
  const towerRed = new MeshBasicMaterial({
    color: "#ff4d2e",
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
  });
  const towerWhite = new MeshBasicMaterial({
    color: "#fff4df",
    transparent: true,
    opacity: 0.86,
    toneMapped: false,
  });
  const warmLight = new MeshBasicMaterial({
    color: "#ffb05c",
    transparent: true,
    opacity: 0.48,
    toneMapped: false,
  });

  const tower = new Group();
  tower.name = "Tokyo Tower landmark";
  tower.position.set(-44, 0, -58);

  const core = new Mesh(new CylinderGeometry(1.8, 4.8, 74, 4), towerRed);
  core.name = "Tokyo Tower red lattice core";
  core.position.y = 37;
  core.rotation.y = Math.PI / 4;
  tower.add(core);

  for (const y of [18, 38, 58]) {
    const deck = new Mesh(new BoxGeometry(18 - y * 0.18, 1.2, 18 - y * 0.18), y === 38 ? towerWhite : towerRed);
    deck.name = "Tokyo Tower observation deck band";
    deck.position.y = y;
    tower.add(deck);
  }

  const antenna = new Mesh(new CylinderGeometry(0.3, 0.7, 28, 8), towerWhite);
  antenna.name = "Tokyo Tower antenna";
  antenna.position.y = 88;
  tower.add(antenna);

  const beacon = new Mesh(new ConeGeometry(3.8, 7, 8), warmLight);
  beacon.name = "Tokyo Tower warm beacon";
  beacon.position.y = 104;
  tower.add(beacon);

  for (const x of [-9, 9]) {
    for (const z of [-9, 9]) {
      const leg = new Mesh(new BoxGeometry(1.2, 32, 1.2), towerRed);
      leg.name = "Tokyo Tower angled support";
      leg.position.set(x, 16, z);
      leg.rotation.z = x > 0 ? -0.16 : 0.16;
      leg.rotation.x = z > 0 ? 0.16 : -0.16;
      tower.add(leg);
    }
  }

  group.add(tower);
  colliders.push(new Box3(new Vector3(-54, 0, -68), new Vector3(-34, 74, -48)));
}

function addKyotoLandmarks(group: Group, look: CityLook, colliders: Box3[]): void {
  const vermilion = new MeshBasicMaterial({
    color: "#d63b24",
    transparent: true,
    opacity: 0.88,
    toneMapped: false,
  });
  const lantern = new MeshBasicMaterial({
    color: "#ffb457",
    transparent: true,
    opacity: 0.78,
    toneMapped: false,
  });
  const roof = new MeshBasicMaterial({
    color: "#18120c",
    transparent: true,
    opacity: 0.9,
  });

  for (let index = 0; index < 7; index += 1) {
    const z = -58 + index * 6.5;
    const torii = new Group();
    torii.name = "Kyoto torii gate";
    torii.position.set(-28, 0, z);

    const leftPost = new Mesh(new BoxGeometry(0.9, 7, 0.9), vermilion);
    leftPost.position.set(-3, 3.5, 0);
    const rightPost = leftPost.clone();
    rightPost.position.x = 3;
    const topBeam = new Mesh(new BoxGeometry(8.6, 0.7, 1.2), vermilion);
    topBeam.position.y = 7.1;
    const lowerBeam = new Mesh(new BoxGeometry(6.8, 0.45, 1), vermilion);
    lowerBeam.position.y = 5.9;

    torii.add(leftPost, rightPost, topBeam, lowerBeam);
    group.add(torii);
  }

  const templeBase = new Mesh(new BoxGeometry(22, 5, 12), roof);
  templeBase.name = "Kyoto low temple silhouette";
  templeBase.position.set(38, 2.5, -46);
  group.add(templeBase);

  const templeRoof = new Mesh(new ConeGeometry(15, 7, 4), roof);
  templeRoof.name = "Kyoto temple roof";
  templeRoof.position.set(38, 9, -46);
  templeRoof.rotation.y = Math.PI / 4;
  group.add(templeRoof);

  for (const x of [-look.ground.verticalRoadWidth * 0.62, look.ground.verticalRoadWidth * 0.62]) {
    for (let z = -72; z <= 72; z += 24) {
      const lamp = new Mesh(new BoxGeometry(1.2, 2.2, 1.2), lantern);
      lamp.name = "Kyoto lantern glow";
      lamp.position.set(x, 2.2, z);
      group.add(lamp);
    }
  }

  colliders.push(new Box3(new Vector3(27, 0, -52), new Vector3(49, 8, -40)));
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
