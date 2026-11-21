import * as THREE from '../vendor/three.module.min.js';

/* =========================================================
   Scene runner
   One requestAnimationFrame for every canvas on the page.
   Scenes render only while they are on screen and are never
   started when the visitor prefers reduced motion.
   ========================================================= */

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reduceQuery.matches;

const entries = new Set();
const pointer = { nx: 0, ny: 0 };

let frame = 0;
let last = 0;

window.addEventListener('pointermove', function (event) {
  pointer.nx = event.clientX / window.innerWidth - 0.5;
  pointer.ny = event.clientY / window.innerHeight - 0.5;
}, { passive: true });

function hasVisible() {
  let found = false;
  entries.forEach(function (entry) {
    if (entry.visible && entry.canvas.clientWidth) found = true;
  });
  return found;
}

function loop(now) {
  frame = 0;

  if (document.hidden) {
    last = 0;
    return;
  }

  const t = now * 0.001;
  const dt = last ? Math.min(0.05, t - last) : 0.016;
  last = t;

  let active = false;

  entries.forEach(function (entry) {
    if (!entry.visible || !entry.canvas.clientWidth) return;
    active = true;
    entry.update(t, dt);
    entry.renderer.render(entry.scene, entry.camera);
  });

  if (active) frame = window.requestAnimationFrame(loop);
  else last = 0;
}

function wake() {
  if (reduced || frame || document.hidden) return;
  if (!hasVisible()) return;
  last = 0;
  frame = window.requestAnimationFrame(loop);
}

function rest(entry) {
  entry.renderer.render(entry.scene, entry.camera);
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden) wake();
});

if (reduceQuery.addEventListener) {
  reduceQuery.addEventListener('change', function (event) {
    reduced = event.matches;
    if (reduced) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      entries.forEach(function (entry) {
        if (entry.visible && entry.canvas.clientWidth) {
          entry.update(performance.now() * 0.001, 0);
          rest(entry);
        }
      });
    } else {
      wake();
    }
  });
}

/* =========================================================
   Shared helpers
   ========================================================= */

function seeded(seed) {
  let value = seed;
  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const bone = new THREE.Color(0xeceae1);
const amber = new THREE.Color(0xe3a63f);
const red = new THREE.Color(0xe0655a);

const BONE = bone.toArray();
const AMBER = amber.toArray();
const RED = red.toArray();

function dotTexture() {
  const size = 64;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;

  const context = sprite.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.42, 'rgba(255,255,255,.82)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(sprite);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const sprite = dotTexture();

/* Smaller screens get fewer nodes and a camera pulled back far
   enough that the whole object stays in frame. */
function quality() {
  const width = window.innerWidth || 1280;
  if (width < 640) return 0.4;
  if (width < 1024) return 0.65;
  return 1;
}

const FOV = 42;
const HALF_TAN = Math.tan((FOV * Math.PI) / 360);

function viewDepth(canvas, neededWidth, fallbackDepth) {
  const width = canvas.clientWidth || 1200;
  const height = canvas.clientHeight || 600;
  const aspect = Math.max(0.35, width / Math.max(1, height));
  return Math.max(fallbackDepth, (neededWidth * 0.5) / (HALF_TAN * aspect));
}

function depthTracker(canvas, neededWidth, fallbackDepth) {
  let lastWidth = 0;
  let lastHeight = 0;
  let depth = fallbackDepth;

  return function () {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      depth = viewDepth(canvas, neededWidth, fallbackDepth);
    }

    return depth;
  };
}

/* =========================================================
   Hero — the verification graph
   ========================================================= */

function heroScene(canvas, scene, camera) {
  camera.position.set(0, 0, 13);

  const graph = new THREE.Group();
  scene.add(graph);

  const random = seeded(20260217);
  const COUNT = Math.max(34, Math.round(96 * quality()));
  const trackDepth = depthTracker(canvas, 17.4, 13);
  const nodes = [];

  for (let i = 0; i < COUNT; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = 3.4 + random() * 2.4;
    nodes.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * radius * 1.32,
      Math.cos(phi) * radius * 0.74,
      Math.sin(phi) * Math.sin(theta) * radius * 0.9
    ));
  }

  const edgePositions = [];
  const seen = new Set();

  for (let i = 0; i < nodes.length; i += 1) {
    const distances = [];
    for (let j = 0; j < nodes.length; j += 1) {
      if (i === j) continue;
      distances.push([j, nodes[i].distanceTo(nodes[j])]);
    }
    distances.sort(function (a, b) { return a[1] - b[1]; });

    for (let k = 0; k < 2; k += 1) {
      const j = distances[k][0];
      const key = i < j ? i + '-' + j : j + '-' + i;
      if (seen.has(key)) continue;
      seen.add(key);
      edgePositions.push(
        nodes[i].x, nodes[i].y, nodes[i].z,
        nodes[j].x, nodes[j].y, nodes[j].z
      );
    }
  }

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  graph.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({
    color: 0xeceae1, transparent: true, opacity: 0.14, depthWrite: false
  })));

  const positions = new Float32Array(nodes.length * 3);
  const colors = new Float32Array(nodes.length * 3);
  const base = [0.925, 0.918, 0.882];

  nodes.forEach(function (node, i) {
    positions[i * 3] = node.x;
    positions[i * 3 + 1] = node.y;
    positions[i * 3 + 2] = node.z;
    colors[i * 3] = base[0];
    colors[i * 3 + 1] = base[1];
    colors[i * 3 + 2] = base[2];
  });

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pointMaterial = new THREE.PointsMaterial({
    size: 0.095,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true
  });

  graph.add(new THREE.Points(pointGeometry, pointMaterial));

  const flagged = 17;
  const amberNode = [0.89, 0.65, 0.25];
  const redNode = [0.88, 0.38, 0.33];

  let easedX = 0;
  let easedY = 0;
  let spin = 0;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;

  canvas.classList.add('is-interactive');

  canvas.addEventListener('pointerdown', function (event) {
    if (event.pointerType !== 'mouse') return;
    dragging = true;
    lastX = event.clientX;
    canvas.classList.add('is-dragging');
    try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
  });

  canvas.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    const delta = event.clientX - lastX;
    lastX = event.clientX;
    spin += delta * 0.0055;
    velocity = delta * 0.0011;
  });

  function endDrag() {
    dragging = false;
    canvas.classList.remove('is-dragging');
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return function update(t, dt) {
    if (!dragging) {
      spin += velocity;
      velocity *= 0.93;
    }

    graph.rotation.y = t * 0.045 + spin;
    graph.rotation.x = -0.08 + Math.sin(t * 0.12) * 0.03;

    const depth = trackDepth();
    graph.position.x = canvas.clientWidth < 640 ? 0 : 1.1;

    easedX += (pointer.nx - easedX) * 0.035;
    easedY += (pointer.ny - easedY) * 0.035;
    camera.position.x = easedX * 1.7;
    camera.position.y = -easedY * 1.1;
    camera.position.z = depth;
    camera.lookAt(0, 0, 0);

    const phase = (t * 0.2) % 1;
    const sweep = -7 + phase * 14;

    for (let i = 0; i < nodes.length; i += 1) {
      const glow = Math.max(0, 1 - Math.abs(nodes[i].x - sweep) / 1.15);

      if (i === flagged) {
        const pulse = 0.55 + Math.sin(t * 2.2) * 0.25;
        colors[i * 3] = redNode[0];
        colors[i * 3 + 1] = redNode[1] * pulse;
        colors[i * 3 + 2] = redNode[2] * pulse;
      } else {
        colors[i * 3] = base[0] + (amberNode[0] - base[0]) * glow;
        colors[i * 3 + 1] = base[1] + (amberNode[1] - base[1]) * glow;
        colors[i * 3 + 2] = base[2] + (amberNode[2] - base[2]) * glow;
      }
    }

    pointGeometry.attributes.color.needsUpdate = true;
    pointMaterial.size = (0.095 + Math.sin(t * 0.8) * 0.006) * (depth / 13);
  };
}

/* =========================================================
   Work — hash chain sweep
   ========================================================= */

function chainScene(canvas, scene, camera) {
  camera.position.set(0, 0.86, 3.75);
  camera.lookAt(0, 0.04, 0);

  const group = new THREE.Group();
  scene.add(group);

  const random = seeded(99173);
  const COUNT = Math.max(24, Math.round(46 * quality()));
  const trackDepth = depthTracker(canvas, 13.2, 3.75);
  const nodes = [];
  const spread = 11.4;

  for (let i = 0; i < COUNT; i += 1) {
    const x = -spread / 2 + (spread * i) / (COUNT - 1);
    nodes.push(new THREE.Vector3(
      x,
      Math.sin(i * 0.62) * 0.13 + (random() - 0.5) * 0.3,
      (random() - 0.5) * 0.72
    ));
  }

  const edgePositions = [];
  const seen = new Set();

  function link(i, j) {
    if (i === j) return;
    const key = i < j ? i + '-' + j : j + '-' + i;
    if (seen.has(key)) return;
    seen.add(key);
    edgePositions.push(
      nodes[i].x, nodes[i].y, nodes[i].z,
      nodes[j].x, nodes[j].y, nodes[j].z
    );
  }

  for (let i = 0; i < COUNT; i += 1) {
    link(i, Math.min(COUNT - 1, i + 1));
    if (i % 6 === 0) link(i, Math.min(COUNT - 1, i + 3));
  }

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  group.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({
    color: 0xeceae1, transparent: true, opacity: 0.12, depthWrite: false
  })));

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);

  nodes.forEach(function (node, i) {
    positions[i * 3] = node.x;
    positions[i * 3 + 1] = node.y;
    positions[i * 3 + 2] = node.z;
    colors[i * 3] = BONE[0] * 0.9;
    colors[i * 3 + 1] = BONE[1] * 0.9;
    colors[i * 3 + 2] = BONE[2] * 0.9;
  });

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pointMaterial = new THREE.PointsMaterial({
    size: 0.098,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true
  });

  group.add(new THREE.Points(pointGeometry, pointMaterial));

  /* baseline / verify rails */
  const railGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-5.85, -1.02, 0),
    new THREE.Vector3(5.85, -1.02, 0)
  ]);
  group.add(new THREE.Line(railGeometry, new THREE.LineBasicMaterial({
    color: 0xeceae1, transparent: true, opacity: 0.09, depthWrite: false
  })));

  /* moving verification plane */
  const sweepPositions = new Float32Array(6);
  const sweepGeometry = new THREE.BufferGeometry();
  sweepGeometry.setAttribute('position', new THREE.BufferAttribute(sweepPositions, 3));

  const sweepMaterial = new THREE.LineBasicMaterial({
    color: 0xe3a63f, transparent: true, opacity: 0.6, depthWrite: false
  });

  group.add(new THREE.Line(sweepGeometry, sweepMaterial));

  const changed = 31;

  return function update(t) {
    const depth = trackDepth();
    const phase = (t * 0.14) % 1;
    const sweep = -6 + phase * 12;

    sweepPositions[0] = sweep;
    sweepPositions[1] = -1.02;
    sweepPositions[2] = 0;
    sweepPositions[3] = sweep;
    sweepPositions[4] = 1.02;
    sweepPositions[5] = 0;
    sweepGeometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < COUNT; i += 1) {
      const node = nodes[i];
      const glow = Math.max(0, 1 - Math.abs(node.x - sweep) / 0.55);

      if (i === changed) {
        const pulse = 0.5 + Math.sin(t * 2.4) * 0.3;
        colors[i * 3] = RED[0];
        colors[i * 3 + 1] = RED[1] * pulse;
        colors[i * 3 + 2] = RED[2] * pulse;
      } else {
        colors[i * 3] = BONE[0] * 0.9 + (AMBER[0] - BONE[0] * 0.9) * glow;
        colors[i * 3 + 1] = BONE[1] * 0.9 + (AMBER[1] - BONE[1] * 0.9) * glow;
        colors[i * 3 + 2] = BONE[2] * 0.9 + (AMBER[2] - BONE[2] * 0.9) * glow;
      }
    }

    pointGeometry.attributes.color.needsUpdate = true;
    pointMaterial.size = (0.098 + Math.sin(t * 1.1) * 0.005) * (depth / 3.75);

    group.rotation.y = Math.sin(t * 0.13) * 0.05 + pointer.nx * 0.08;
    group.rotation.x = -pointer.ny * 0.04;
    camera.position.z = depth;
    camera.lookAt(0, 0.05, 0);
  };
}

/* =========================================================
   Approach — orbital loop
   ========================================================= */

function orbitScene(canvas, scene, camera) {
  camera.position.set(0, 0.15, 8.4);
  camera.lookAt(0, 0, 0);

  const trackDepth = depthTracker(canvas, 10, 8.4);

  const group = new THREE.Group();
  group.rotation.x = -0.16;
  scene.add(group);

  const rings = [
    { radius: 2.55, x: 0.95, y: 0, opacity: 0.17 },
    { radius: 2.95, x: -0.55, y: 0.9, opacity: 0.13 },
    { radius: 3.28, x: 0.3, y: -0.75, opacity: 0.1 }
  ];

  const holders = [];

  rings.forEach(function (ring, index) {
    const points = [];
    for (let a = 0; a <= 96; a += 1) {
      const angle = (a / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * ring.radius,
        0,
        Math.sin(angle) * ring.radius
      ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const holder = new THREE.Group();
    holder.rotation.set(ring.x, ring.y, 0);
    holder.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: 0xeceae1, transparent: true, opacity: ring.opacity, depthWrite: false
    })));

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xe3a63f, transparent: true, opacity: 0.9 })
    );
    dot.position.set(ring.radius, 0, 0);
    holder.add(dot);

    holder.userData.speed = 0.18 + index * 0.06;
    holders.push(holder);
    group.add(holder);
  });

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.33, 1),
    new THREE.MeshBasicMaterial({ color: 0xe3a63f, wireframe: true, transparent: true, opacity: 0.28 })
  );
  group.add(core);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sprite,
    color: 0xe3a63f,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  glow.scale.set(1.7, 1.7, 1);
  group.add(glow);

  const random = seeded(71231);
  const dustCount = Math.max(14, Math.round(30 * quality()));
  const dust = [];
  for (let i = 0; i < dustCount; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = 3.5 + random() * 0.9;
    dust.push(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius * 0.8,
      Math.sin(phi) * Math.sin(theta) * radius
    );
  }

  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
  group.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    size: 0.055,
    map: sprite,
    color: 0xeceae1,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    sizeAttenuation: true
  })));

  return function update(t) {
    group.rotation.y = t * 0.1 + pointer.nx * 0.16;
    group.rotation.x = -0.16 + Math.sin(t * 0.18) * 0.05 - pointer.ny * 0.08;

    holders.forEach(function (holder) {
      holder.rotation.z = t * holder.userData.speed * 0.35;
    });

    core.rotation.y = t * 0.4;
    core.rotation.x = t * 0.16;
    glow.material.opacity = 0.27 + Math.sin(t * 1.6) * 0.05;
    camera.position.z = trackDepth();
    camera.lookAt(0, 0, 0);
  };
}

/* =========================================================
   Services — attack surface terrain
   ========================================================= */

function terrainScene(canvas, scene, camera) {
  camera.position.set(0, 1.5, 2.85);
  camera.fov = 42;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0.02, 0);

  const COLS = Math.max(22, Math.round(44 * quality()));
  const ROWS = Math.max(7, Math.round(11 * quality()));
  const WIDTH = 6.2;
  const DEPTH = 2.1;

  const vertices = [];
  const positions = [];
  const colors = [];

  function addVertex(c, r) {
    vertices.push([c, r]);
    positions.push(0, 0, 0);
    colors.push(BONE[0] * 0.5, BONE[1] * 0.5, BONE[2] * 0.5);
  }

  for (let r = 0; r <= ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      addVertex(c, r);
      addVertex(c + 1, r);
    }
  }

  for (let c = 0; c <= COLS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      addVertex(c, r);
      addVertex(c, r + 1);
    }
  }

  const positionData = new Float32Array(positions);
  const colorData = new Float32Array(colors);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positionData, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorData, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });

  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const count = vertices.length;

  return function update(t) {
    const pointerX = pointer.nx * WIDTH * 0.5;
    const pointerZ = pointer.ny * DEPTH * 0.5;

    for (let i = 0; i < count; i += 1) {
      const c = vertices[i][0];
      const r = vertices[i][1];

      const x = -WIDTH / 2 + (c / COLS) * WIDTH;
      const z = -DEPTH / 2 + (r / ROWS) * DEPTH;

      const wave =
        Math.sin(x * 1.35 + t * 0.5) * 0.16 +
        Math.cos(z * 2.1 - t * 0.35) * 0.09 +
        Math.sin((x + z) * 2.3 + t * 0.85) * 0.05;

      const dx = x - pointerX;
      const dz = z - pointerZ;
      const bump = Math.exp(-(dx * dx + dz * dz) * 4.2) * 0.34;

      const y = wave + bump;
      const k = Math.max(0, Math.min(1, (y + 0.12) / 0.46));

      positionData[i * 3] = x;
      positionData[i * 3 + 1] = y;
      positionData[i * 3 + 2] = z;

      colorData[i * 3] = BONE[0] + (AMBER[0] - BONE[0]) * k * k;
      colorData[i * 3 + 1] = BONE[1] + (AMBER[1] - BONE[1]) * k * k;
      colorData[i * 3 + 2] = BONE[2] + (AMBER[2] - BONE[2]) * k * k;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    camera.position.x = pointer.nx * 0.22;
    camera.position.y = 1.5 - pointer.ny * 0.12;
    camera.lookAt(0, 0.02, 0);
  };
}

/* =========================================================
   Mount
   ========================================================= */

const BUILDERS = {
  graph: heroScene,
  chain: chainScene,
  orbit: orbitScene,
  terrain: terrainScene
};

function fit(entry) {
  const width = entry.canvas.clientWidth;
  const height = entry.canvas.clientHeight;

  if (!width || !height) return false;

  entry.renderer.setSize(width, height, false);
  entry.camera.aspect = width / height;
  entry.camera.updateProjectionMatrix();
  return true;
}

export function mount(canvas) {
  if (!canvas || canvas.dataset.sceneMounted) return;
  canvas.dataset.sceneMounted = '1';

  const build = BUILDERS[canvas.dataset.scene];
  if (!build) return;

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
  } catch (error) {
    canvas.style.display = 'none';
    return;
  }

  const maxRatio = window.innerWidth < 700 ? 1.25 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  let update;

  try {
    update = build(canvas, scene, camera);
  } catch (error) {
    canvas.style.display = 'none';
    renderer.dispose();
    return;
  }

  const entry = {
    canvas: canvas,
    renderer: renderer,
    scene: scene,
    camera: camera,
    update: update,
    visible: false,
    ready: false
  };

  entries.add(entry);

  const wrap = canvas.closest('[data-scene-wrap]');

  function draw() {
    if (!fit(entry)) return;
    entry.update(0, 0);
    entry.renderer.render(entry.scene, entry.camera);
    if (wrap) wrap.classList.add('is-live');
  }

  draw();
  entry.ready = true;

  if (!('IntersectionObserver' in window)) {
    entry.visible = true;
    if (!reduced) wake();
    return;
  }

  new IntersectionObserver(function (rows) {
    rows.forEach(function (row) {
      entry.visible = row.isIntersecting;

      if (!entry.visible) return;

      if (reduced) {
        if (fit(entry)) {
          entry.update(performance.now() * 0.001, 0);
          rest(entry);
        }
      } else {
        fit(entry);
        wake();
      }
    });
  }, { threshold: 0.01 }).observe(canvas);

  function onResize() {
    if (!fit(entry)) return;
    if (reduced || !entry.visible) rest(entry);
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(onResize).observe(canvas);
  } else {
    window.addEventListener('resize', onResize);
  }
}
