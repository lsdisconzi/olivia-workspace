/* ═══════════════════════════════════════════════════════════════════
   SCENE3D MODULE — Three.js / WebGL 3D Scene Engine for Kout Shaders
   Extends the Shaders Agent to handle 3D scenes, GLB model loading,
   animation mixing, lighting presets and orbit camera controls.
   Loaded as ES module; all public API is exposed on window.sh3d*.
   ═══════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Expose THREE globally so generated three-code blocks can reference it without import statements
window.THREE = THREE;

// Resolve the bridge upload URL relative to the current origin/proxy path.
// The Kout frontend is served under /kout/ (static rewrite), but the backend API
// namespace behind the reverse proxy is /api/kout/* -> http://127.0.0.1:3019/*.
// So for the /kout/ mount we must POST to /api/kout/api/bridge/upload, NOT
// /kout/api/bridge/upload (which the static-rewrite location turns into a 405).
const _S3_UPLOAD_URL = (() => {
  const runtime = (window.OliviaLegal && typeof window.OliviaLegal === 'object')
    ? window.OliviaLegal
    : ((window.LA8159 && typeof window.LA8159 === 'object') ? window.LA8159 : {});
  if (runtime && runtime.bridge) {
    return String(runtime.bridge).replace(/\/$/, '') + '/upload';
  }
  const p = window.location.pathname;
  if (p.indexOf('/api/kout/') === 0 || p === '/api/kout') return '/api/kout/api/bridge/upload';
  if (p.indexOf('/kout/') === 0 || p === '/kout') return '/api/kout/api/bridge/upload';
  return '/api/bridge/upload';
})();

// Prefix used for reading uploaded assets back. Must also pass through the proxy.
const _S3_ASSET_PREFIX = (() => {
  const p = window.location.pathname;
  if (p.indexOf('/api/kout/') === 0 || p === '/api/kout') return '/api/kout';
  if (p.indexOf('/kout/') === 0 || p === '/kout') return '/api/kout';
  return '';
})();

// Rewrite a server-reported asset path (like "/uploads/xyz.glb") to a form
// that's resolvable from the current origin (adds /api/kout prefix under proxy).
function _resolveAssetUrl(url) {
  if (!url) return url;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  if (!_S3_ASSET_PREFIX) return url;
  if (url.indexOf(_S3_ASSET_PREFIX + '/') === 0) return url;
  // Only add prefix to absolute backend paths starting with /uploads, /api/, etc.
  if (url.charAt(0) === '/') return _S3_ASSET_PREFIX + url;
  return url;
}

/* ── ENVIRONMENT PRESETS ────────────────────────────────────────── */
const ENV_PRESETS = {
  studio: {
    label: 'Studio',
    bg: '#1a1a2e',
    ambientColor: 0xffffff, ambientIntensity: 0.6,
    dirColor: 0xffffff, dirIntensity: 1.4, dirPos: [5, 8, 5],
    fillColor: 0x8888ff, fillIntensity: 0.3, fillPos: [-5, 2, -5],
    fogColor: null, fogNear: null, fogFar: null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0,
  },
  outdoor: {
    label: 'Outdoor Day',
    bg: '#87ceeb',
    ambientColor: 0xfff8e1, ambientIntensity: 0.8,
    dirColor: 0xfff8d0, dirIntensity: 1.8, dirPos: [10, 20, 5],
    fillColor: 0xadd8e6, fillIntensity: 0.4, fillPos: [-8, 4, -4],
    fogColor: '#b0d0f0', fogNear: 30, fogFar: 200,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1,
  },
  night: {
    label: 'Night',
    bg: '#050a15',
    ambientColor: 0x1a2a4a, ambientIntensity: 0.3,
    dirColor: 0x6080c0, dirIntensity: 0.6, dirPos: [-5, 10, 3],
    fillColor: 0x200040, fillIntensity: 0.2, fillPos: [5, -2, -5],
    fogColor: '#050a15', fogNear: 15, fogFar: 80,
    toneMapping: THREE.CineonToneMapping, toneMappingExposure: 0.7,
  },
  cyberpunk: {
    label: 'Cyberpunk',
    bg: '#0d0019',
    ambientColor: 0x220044, ambientIntensity: 0.5,
    dirColor: 0xff00aa, dirIntensity: 1.2, dirPos: [3, 6, 4],
    fillColor: 0x00ffff, fillIntensity: 0.8, fillPos: [-4, 2, -3],
    fogColor: '#0d0019', fogNear: 12, fogFar: 60,
    toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.4,
  },
  warm: {
    label: 'Warm Sunset',
    bg: '#1a0e06',
    ambientColor: 0xff8c42, ambientIntensity: 0.6,
    dirColor: 0xffb347, dirIntensity: 1.6, dirPos: [8, 4, 2],
    fillColor: 0xff6b35, fillIntensity: 0.3, fillPos: [-6, 1, -4],
    fogColor: '#2a1005', fogNear: 20, fogFar: 100,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
  },
  product: {
    label: 'Product',
    bg: '#f0f0f0',
    ambientColor: 0xffffff, ambientIntensity: 1.0,
    dirColor: 0xffffff, dirIntensity: 1.0, dirPos: [5, 10, 5],
    fillColor: 0xffffff, fillIntensity: 0.5, fillPos: [-5, 5, -5],
    fogColor: null, fogNear: null, fogFar: null,
    toneMapping: THREE.LinearToneMapping, toneMappingExposure: 1.0,
  },
};

/* ── ANIMATION PRESET NAMES ─────────────────────────────────────── */
const ANIM_SPEED_OPTIONS = [0.1, 0.25, 0.5, 1.0, 1.5, 2.0];

/* ── MODULE STATE ───────────────────────────────────────────────── */
const _SH3D_FAILED_URLS = new Set(); // session-level 404 cache
let _s3 = {
  active: false,          // is the 3D canvas in control?
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  lights: { ambient: null, dir: null, fill: null },
  model: null,            // loaded THREE.Group
  mixer: null,            // AnimationMixer
  clock: null,
  animActions: [],        // AnimationAction list
  animPlaying: true,
  animSpeed: 1.0,
  animClipIndex: 0,
  currentEnv: 'studio',
  bgColor: '#1a1a2e',
  wireframe: false,
  raf: null,
  canvas: null,           // HTMLCanvasElement
  loadedModelUrl: null,
  sceneConfig: null,      // last-loaded 3D scene config
  stats: { triangles: 0, meshes: 0, fps: 0, _fpsFrames: 0, _fpsLast: 0 },
  onModelLoaded: null,    // callback
  // ── Selection (for targeted controls) ─────────────────────────
  selectedName: null,     // null = main model, else the sh3dExtra_*/sh3dPrim_* name
  selectionBox: null,     // THREE.BoxHelper currently drawn
  selectionBoxVisible: true,
  gizmoVisible: true,
  extraMixers: {},        // { [objectName]: { mixer, actions, clips } }
};

/* ── INIT ───────────────────────────────────────────────────────── */
function _initRenderer() {
  const canvas = document.getElementById('sh3dCanvas');
  if (!canvas) return false;
  if (_s3.renderer) return true; // already initialised

  _s3.canvas = canvas;
  _s3.clock = new THREE.Clock();

  // Renderer (alpha:true so we can overlay a 3D model onto a 2D SVG scene)
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    if (!_s3._webglFailed) {
      _s3._webglFailed = true;
      console.error('[scene3d] WebGL not available:', err.message || err);
    }
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  _s3.renderer = renderer;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(_s3.bgColor);
  _s3.scene = scene;

  // Camera
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.01, 1000);
  camera.position.set(0, 1.2, 3.5);
  _s3.camera = camera;

  // Lights — will be properly set by applyEnv
  _s3.lights.ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(_s3.lights.ambient);

  _s3.lights.dir = new THREE.DirectionalLight(0xffffff, 1.4);
  _s3.lights.dir.castShadow = true;
  _s3.lights.dir.shadow.mapSize.set(1024, 1024);
  _s3.lights.dir.shadow.camera.near = 0.5;
  _s3.lights.dir.shadow.camera.far = 100;
  _s3.lights.dir.shadow.camera.left = _s3.lights.dir.shadow.camera.bottom = -10;
  _s3.lights.dir.shadow.camera.right = _s3.lights.dir.shadow.camera.top = 10;
  _s3.lights.dir.position.set(5, 8, 5);
  scene.add(_s3.lights.dir);

  _s3.lights.fill = new THREE.DirectionalLight(0x8888ff, 0.3);
  _s3.lights.fill.position.set(-5, 2, -5);
  scene.add(_s3.lights.fill);

  // Grid helper (subtle reference grid)
  const grid = new THREE.GridHelper(20, 20, 0x333344, 0x222233);
  grid.name = 'sh3dGrid';
  scene.add(grid);

  // Orbit controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.3;
  controls.maxDistance = 50;
  controls.target.set(0, 0.8, 0);
  controls.update();
  _s3.controls = controls;

  // Transform (gizmo) controls — disabled until an object is selected.
  // While the user is dragging a gizmo handle we temporarily suspend OrbitControls
  // so the camera doesn't rotate at the same time.
  const tctrl = new TransformControls(camera, canvas);
  tctrl.setSize(0.9);
  tctrl.visible = false;
  tctrl.enabled = false;
  tctrl.addEventListener('dragging-changed', function (e) {
    if (_s3.controls) _s3.controls.enabled = !e.value;
  });
  tctrl.addEventListener('objectChange', function () {
    if (_s3.selectionBox) _s3.selectionBox.update();
    try { window.dispatchEvent(new Event('sh3d:extras-changed')); } catch (err) { }
  });
  scene.add(tctrl);
  _s3.transformControls = tctrl;
  _s3.transformMode = 'translate';

  _applyEnvPreset(_s3.currentEnv);

  // Resize observer
  const ro = new ResizeObserver(_onResize);
  ro.observe(canvas.parentElement || canvas);

  // ── Pointer picking: click to select a model/extra ──
  _installPicker(canvas);

  return true;
}

function _onResize() {
  if (!_s3.renderer || !_s3.camera || !_s3.canvas) return;
  const parent = _s3.canvas.parentElement;
  const w = parent ? parent.clientWidth : _s3.canvas.clientWidth;
  const h = parent ? parent.clientHeight : _s3.canvas.clientHeight;
  if (w < 4 || h < 4) return;
  _s3.renderer.setSize(w, h, false);
  _s3.camera.aspect = w / h;
  _s3.camera.updateProjectionMatrix();
}

/* ── PICKING / SELECTION ───────────────────────────────────────── */
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

function _findSelectableAncestor(obj) {
  // Walk up until we hit main model, a sh3dExtra_*, or sh3dPrim_*
  let cur = obj;
  while (cur) {
    if (cur === _s3.model) return { name: null, object: cur };   // main
    if (cur.name && (cur.name.indexOf('sh3dExtra_') === 0 || cur.name.indexOf('sh3dPrim_') === 0)) {
      return { name: cur.name, object: cur };
    }
    cur = cur.parent;
  }
  return null;
}

function _installPicker(canvas) {
  let downX = 0, downY = 0, moved = false;
  canvas.addEventListener('pointerdown', function (e) {
    downX = e.clientX; downY = e.clientY; moved = false;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) moved = true;
  });
  canvas.addEventListener('pointerup', function (e) {
    if (moved) return;               // ignore drag (orbit)
    if (!_s3.scene || !_s3.camera) return;
    const rect = canvas.getBoundingClientRect();
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _ray.setFromCamera(_ndc, _s3.camera);
    // Candidates: main model + any extras + primitives
    const targets = [];
    if (_s3.model) targets.push(_s3.model);
    _s3.scene.children.forEach(function (c) {
      if (c.name && (c.name.indexOf('sh3dExtra_') === 0 || c.name.indexOf('sh3dPrim_') === 0)) {
        targets.push(c);
      }
    });
    if (!targets.length) { window.sh3dSelect(null); return; }
    const hits = _ray.intersectObjects(targets, true);
    if (!hits.length) { window.sh3dSelect(null); return; }
    const pick = _findSelectableAncestor(hits[0].object);
    if (!pick) { window.sh3dSelect(null); return; }
    window.sh3dSelect(pick.name);
  });
}

function _updateSelectionBox() {
  if (_s3.selectionBox) { _s3.scene.remove(_s3.selectionBox); _s3.selectionBox = null; }
  if (!_s3.selectionBoxVisible) return;
  let target = null;
  if (_s3.selectedName) {
    target = _s3.scene && _s3.scene.getObjectByName(_s3.selectedName);
  } else {
    target = _s3.model;
  }
  if (!target || !_s3.scene) return;
  const box = new THREE.BoxHelper(target, 0xc4622d);
  box.name = '__sh3dSelectionBox';
  box.material.depthTest = false;
  box.material.transparent = true;
  box.material.opacity = 0.9;
  box.renderOrder = 999;
  _s3.scene.add(box);
  _s3.selectionBox = box;
}

function _syncSelectionUiButton() {
  var btn = document.getElementById('sh3dBtnSelBox');
  if (!btn) return;
  var isOn = !!_s3.selectionBoxVisible && !!_s3.gizmoVisible;
  btn.classList.toggle('active', isOn);
}

function _getSelectedActions() {
  // Returns {actions, clips, setPaused} for whichever target is selected
  if (_s3.selectedName && _s3.extraMixers[_s3.selectedName]) {
    const e = _s3.extraMixers[_s3.selectedName];
    return { actions: e.actions, clips: e.clips, mixer: e.mixer };
  }
  return { actions: _s3.animActions, clips: (_s3.mixer && _s3.mixer._root && _s3.mixer._root.animations) || [], mixer: _s3.mixer };
}

/* ── RENDER LOOP ────────────────────────────────────────────────── */
function _startLoop() {
  if (_s3.raf) return;
  function loop() {
    _s3.raf = requestAnimationFrame(loop);
    const delta = _s3.clock ? _s3.clock.getDelta() : 0.016;
    if (_s3.mixer && _s3.animPlaying) _s3.mixer.update(delta);
    // Tick extras mixers too (each has its own playing state via action.paused)
    if (_s3.extraMixers) {
      for (var k in _s3.extraMixers) {
        if (_s3.extraMixers[k] && _s3.extraMixers[k].mixer) {
          _s3.extraMixers[k].mixer.update(delta);
        }
      }
    }
    if (_s3.selectionBox) _s3.selectionBox.update();
    if (_s3.controls) _s3.controls.update();
    // Safety: if the gizmo's target got removed from the scene graph elsewhere,
    // detach before rendering so TransformControls doesn't spam warnings.
    if (_s3.transformControls && _s3.transformControls.object) {
      var gp = _s3.transformControls.object, gInScene = false;
      while (gp) { if (gp === _s3.scene) { gInScene = true; break; } gp = gp.parent; }
      if (!gInScene) {
        _s3.transformControls.detach();
        _s3.transformControls.visible = false;
        _s3.transformControls.enabled = false;
      }
    }
    if (_s3.renderer && _s3.scene && _s3.camera) {
      _s3.renderer.render(_s3.scene, _s3.camera);
    }
    _updateFPS(delta);
  }
  loop();
}

function _stopLoop() {
  if (_s3.raf) { cancelAnimationFrame(_s3.raf); _s3.raf = null; }
}

function _updateFPS(delta) {
  _s3.stats._fpsFrames++;
  _s3.stats._fpsLast += delta;
  if (_s3.stats._fpsLast >= 1.0) {
    _s3.stats.fps = Math.round(_s3.stats._fpsFrames / _s3.stats._fpsLast);
    _s3.stats._fpsFrames = 0;
    _s3.stats._fpsLast = 0;
    if (_s3.renderer) {
      const info = _s3.renderer.info.render;
      _s3.stats.triangles = info.triangles;
    }
    _updateHUD();
  }
}

/* ── ENVIRONMENT ────────────────────────────────────────────────── */
function _applyEnvPreset(name) {
  const p = ENV_PRESETS[name] || ENV_PRESETS.studio;
  _s3.currentEnv = name;

  if (!_s3.scene || !_s3.renderer) return;

  _s3.bgColor = p.bg;
  _s3.scene.background = new THREE.Color(p.bg);

  if (p.fogColor && p.fogNear != null) {
    _s3.scene.fog = new THREE.Fog(p.fogColor, p.fogNear, p.fogFar);
  } else {
    _s3.scene.fog = null;
  }

  if (_s3.lights.ambient) {
    _s3.lights.ambient.color.set(p.ambientColor);
    _s3.lights.ambient.intensity = p.ambientIntensity;
  }
  if (_s3.lights.dir) {
    _s3.lights.dir.color.set(p.dirColor);
    _s3.lights.dir.intensity = p.dirIntensity;
    _s3.lights.dir.position.set(...p.dirPos);
  }
  if (_s3.lights.fill) {
    _s3.lights.fill.color.set(p.fillColor);
    _s3.lights.fill.intensity = p.fillIntensity;
  }

  _s3.renderer.toneMapping = p.toneMapping;
  _s3.renderer.toneMappingExposure = p.toneMappingExposure;

  _syncEnvUI(name);
}

/* ── MODEL LOADING ──────────────────────────────────────────────── */
function _loadGLB(url, onDone, onError) {
  if (!_s3.scene) return;
  _sh3dClearModel();

  const loader = new GLTFLoader();
  // Show loading indicator
  _setLoadingHUD(true, 'Loading model…');

  loader.load(
    url,
    function onLoad(gltf) {
      const model = gltf.scene;
      model.name = 'sh3dModel';

      // Centre and fit model
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const centre = new THREE.Vector3();
      box.getCenter(centre);

      // Scale to ~2 units tall
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0.001) {
        const scale = 2.0 / maxDim;
        model.scale.setScalar(scale);
        box.getCenter(centre);
        model.position.sub(centre.multiplyScalar(scale));
      }

      // Floor model to y=0
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y -= box2.min.y;

      // Shadows
      model.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      _s3.scene.add(model);
      _s3.model = model;
      _s3.loadedModelUrl = url;

      // Count stats
      let meshCount = 0, triCount = 0;
      model.traverse(function (c) {
        if (c.isMesh) {
          meshCount++;
          if (c.geometry && c.geometry.index) {
            triCount += c.geometry.index.count / 3;
          } else if (c.geometry && c.geometry.attributes.position) {
            triCount += c.geometry.attributes.position.count / 3;
          }
        }
      });
      _s3.stats.meshes = meshCount;
      _s3.stats.triangles = Math.round(triCount);

      // Animation mixer
      if (gltf.animations && gltf.animations.length > 0) {
        _s3.mixer = new THREE.AnimationMixer(model);
        _s3.animActions = gltf.animations.map(function (clip) {
          const action = _s3.mixer.clipAction(clip);
          return action;
        });
        // Play first clip by default
        _playAnimClip(0);
        _syncAnimUI(gltf.animations);
      } else {
        _s3.mixer = null;
        _s3.animActions = [];
        _syncAnimUI([]);
      }

      // Fit camera to model
      _fitCameraToModel();

      _setLoadingHUD(false);
      _updateHUD();
      _updateStatsPanel();

      if (typeof _s3.onModelLoaded === 'function') _s3.onModelLoaded(url, gltf);
      if (typeof onDone === 'function') onDone(gltf);
    },
    function onProgress(xhr) {
      if (xhr.lengthComputable) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        _setLoadingHUD(true, 'Loading… ' + pct + '%');
      }
    },
    function onErr(err) {
      _setLoadingHUD(false);
      console.error('[scene3d] GLTFLoader error:', err);
      if (typeof onError === 'function') onError(err);
      _sh3dToast('Failed to load model: ' + (err.message || err));
    }
  );
}

function _sh3dClearModel() {
  // Detach gizmo if it was pinned to the main model — it'll be disposed below.
  if (_s3.transformControls && _s3.transformControls.object === _s3.model) {
    _s3.transformControls.detach();
    _s3.transformControls.visible = false;
    _s3.transformControls.enabled = false;
  }
  if (_s3.mixer) { _s3.mixer.stopAllAction(); _s3.mixer = null; }
  _s3.animActions = [];
  if (_s3.model) {
    _s3.scene.remove(_s3.model);
    _s3.model.traverse(function (c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(function (m) { m.dispose(); });
        else c.material.dispose();
      }
    });
    _s3.model = null;
  }
  _s3.loadedModelUrl = null;
  _s3.stats.meshes = 0;
}

function _playAnimClip(index) {
  _s3.animActions.forEach(function (a) { a.stop(); });
  if (index >= 0 && index < _s3.animActions.length) {
    _s3.animClipIndex = index;
    const action = _s3.animActions[index];
    action.setEffectiveTimeScale(_s3.animSpeed);
    action.reset().play();
  }
}

function _fitCameraToModel() {
  if (!_s3.model || !_s3.camera || !_s3.controls) return;
  const box = new THREE.Box3().setFromObject(_s3.model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = _s3.camera.fov * (Math.PI / 180);
  let dist = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
  dist = Math.max(dist * 1.6, 1.5);

  _s3.camera.position.set(centre.x, centre.y + size.y * 0.3, centre.z + dist);
  _s3.camera.near = dist / 100;
  _s3.camera.far = dist * 10;
  _s3.camera.updateProjectionMatrix();
  _s3.controls.target.copy(centre);
  _s3.controls.update();
}

/* ── WIREFRAME TOGGLE ───────────────────────────────────────────── */
function _toggleWireframe(force) {
  _s3.wireframe = (force !== undefined) ? !!force : !_s3.wireframe;
  if (!_s3.model) return;
  _s3.model.traverse(function (c) {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(function (m) { m.wireframe = _s3.wireframe; });
    }
  });
  const btn = document.getElementById('sh3dBtnWireframe');
  if (btn) btn.classList.toggle('active', _s3.wireframe);
}

/* ── GROUND PLANE ───────────────────────────────────────────────── */
function _addGroundPlane(visible) {
  const existing = _s3.scene && _s3.scene.getObjectByName('sh3dGround');
  if (visible === false) {
    if (existing) _s3.scene.remove(existing);
    return;
  }
  if (!existing && _s3.scene) {
    const geo = new THREE.PlaneGeometry(30, 30);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.9, metalness: 0.1 });
    const plane = new THREE.Mesh(geo, mat);
    plane.name = 'sh3dGround';
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    _s3.scene.add(plane);
  }
}

/* ── HUD / UI HELPERS ───────────────────────────────────────────── */
function _updateHUD() {
  const fpsEl = document.getElementById('sh3dHudFPS');
  if (fpsEl) fpsEl.textContent = _s3.stats.fps + ' fps';
  const triEl = document.getElementById('sh3dHudTri');
  if (triEl) triEl.textContent = _formatNum(_s3.stats.triangles) + ' ▲';
  const modelEl = document.getElementById('sh3dHudModel');
  if (modelEl) {
    const name = _s3.loadedModelUrl ? _s3.loadedModelUrl.split('/').pop() : '—';
    modelEl.textContent = name;
  }
}

function _updateStatsPanel() {
  const el = document.getElementById('sh3dStatsMeshes');
  if (el) el.textContent = _s3.stats.meshes;
  const el2 = document.getElementById('sh3dStatsAnimClips');
  if (el2) el2.textContent = _s3.animActions.length;
}

function _formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function _setLoadingHUD(show, msg) {
  const el = document.getElementById('sh3dLoadingOverlay');
  if (!el) return;
  el.style.display = show ? 'flex' : 'none';
  const txt = document.getElementById('sh3dLoadingText');
  if (txt) txt.textContent = msg || '';
}

function _syncEnvUI(name) {
  document.querySelectorAll('.sh3d-env-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.env === name);
  });
  const sel = document.getElementById('sh3dEnvSelect');
  if (sel) sel.value = name;
}

function _syncAnimUI(animations) {
  const sel = document.getElementById('sh3dAnimSelect');
  if (sel) {
    sel.innerHTML = animations.length === 0
      ? '<option value="">— no animations —</option>'
      : animations.map(function (a, i) {
        return '<option value="' + i + '">' + (a.name || 'Clip ' + i) + '</option>';
      }).join('');
    sel.disabled = animations.length === 0;
  }
  const playBtn = document.getElementById('sh3dBtnPlayPause');
  if (playBtn) playBtn.disabled = animations.length === 0;
}

function _sh3dToast(msg) {
  if (typeof window.shToast === 'function') { window.shToast(msg); return; }
  const t = document.getElementById('shToast') || document.getElementById('sh3dToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 2800);
}

/* ── SCENE CONFIG APPLY ─────────────────────────────────────────── */
function _applySceneConfig(cfg) {
  if (!cfg) return;
  _s3.sceneConfig = cfg;

  if (cfg.environment) _applyEnvPreset(cfg.environment);
  if (cfg.bg) {
    _s3.bgColor = cfg.bg;
    if (_s3.scene) _s3.scene.background = new THREE.Color(cfg.bg);
  }
  if (cfg.camera) {
    if (cfg.camera.fov && _s3.camera) {
      _s3.camera.fov = cfg.camera.fov;
      _s3.camera.updateProjectionMatrix();
    }
    if (cfg.camera.position && _s3.camera) {
      _s3.camera.position.fromArray(cfg.camera.position);
    }
  }
  if (cfg.model) {
    _loadGLB(cfg.model);
  }
  if (cfg.lighting) {
    if (cfg.lighting.ambient !== undefined && _s3.lights.ambient) {
      _s3.lights.ambient.intensity = cfg.lighting.ambient;
    }
    if (cfg.lighting.directional !== undefined && _s3.lights.dir) {
      _s3.lights.dir.intensity = cfg.lighting.directional;
    }
  }
  if (cfg.animations) {
    if (cfg.animations.speed !== undefined) {
      _s3.animSpeed = Number(cfg.animations.speed) || 1;
    }
    if (typeof cfg.animations.play === 'boolean') {
      _s3.animPlaying = cfg.animations.play;
    }
  }
  _syncSettingsUI();
}

function _syncSettingsUI() {
  const expEl = document.getElementById('sh3dExposureSlider');
  if (expEl && _s3.renderer) expEl.value = _s3.renderer.toneMappingExposure;
  const expValEl = document.getElementById('sh3dExposureVal');
  if (expValEl && _s3.renderer) expValEl.textContent = _s3.renderer.toneMappingExposure.toFixed(2);
  const speedEl = document.getElementById('sh3dAnimSpeedSlider');
  if (speedEl) speedEl.value = _s3.animSpeed;
  const speedValEl = document.getElementById('sh3dAnimSpeedVal');
  if (speedValEl) speedValEl.textContent = _s3.animSpeed.toFixed(2) + '×';
}

/* ══════════════════════════════════════════════════════════════════
   PUBLIC API — exposed on window.sh3d*
   ══════════════════════════════════════════════════════════════════ */

/** Activate 3D mode — initialises renderer, shows canvas */
window.sh3dActivate = function () {
  if (!_initRenderer()) {
    _s3.active = false;
    console.warn('[scene3d] Cannot activate 3D — WebGL unavailable');
    return;
  }
  _s3.active = true;
  const canvas = document.getElementById('sh3dCanvas');
  const svgEl = document.getElementById('shPreviewSVG');
  const fxEl = document.getElementById('shPreviewFxLayer');
  const hudEl = document.getElementById('sh3dHud');
  const ctrl2dEl = document.getElementById('sh3dCtrl2D');
  const ctrl3dEl = document.getElementById('sh3dCtrl3D');

  if (canvas) canvas.style.display = 'block';
  if (svgEl) svgEl.style.display = 'none';
  if (fxEl) fxEl.style.display = 'none';
  if (hudEl) hudEl.style.display = 'flex';
  if (ctrl2dEl) ctrl2dEl.style.display = 'none';
  if (ctrl3dEl) ctrl3dEl.style.display = 'flex';

  _onResize();
  _startLoop();
  _addGroundPlane(true);
  _updateHUD();

  // Sync mode toggle buttons
  document.querySelectorAll('.sh-mode-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === '3d');
  });

  _syncSelectionUiButton();

  _sh3dToast('3D Mode active');
};

/** Deactivate 3D mode — hides canvas, restores SVG */
window.sh3dDeactivate = function () {
  _s3.active = false;
  _stopLoop();

  const canvas = document.getElementById('sh3dCanvas');
  const svgEl = document.getElementById('shPreviewSVG');
  const fxEl = document.getElementById('shPreviewFxLayer');
  const hudEl = document.getElementById('sh3dHud');
  const ctrl2dEl = document.getElementById('sh3dCtrl2D');
  const ctrl3dEl = document.getElementById('sh3dCtrl3D');

  if (canvas) canvas.style.display = 'none';
  if (svgEl) svgEl.style.display = '';
  if (fxEl) fxEl.style.display = '';
  if (hudEl) hudEl.style.display = 'none';
  if (ctrl2dEl) ctrl2dEl.style.display = 'flex';
  if (ctrl3dEl) ctrl3dEl.style.display = 'none';

  document.querySelectorAll('.sh-mode-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === '2d');
  });
};

/** Check if 3D is currently active */
window.sh3dIsActive = function () { return _s3.active; };

/** Load a GLB from URL */
window.sh3dLoadGLB = function (url) {
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer()) return;
  _loadGLB(url);
};

/** Open file picker and upload a GLB */
window.sh3dUploadGLB = function () {
  const input = document.getElementById('sh3dFileInput');
  if (input) { input.click(); return; }
  const tmp = document.createElement('input');
  tmp.type = 'file';
  tmp.accept = '.glb,.gltf';
  tmp.onchange = function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    _uploadAndLoad(file);
  };
  tmp.click();
};

/** Handle file input change from the hidden input */
window.sh3dHandleFileInput = function (event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  _uploadAndLoad(file);
  event.target.value = '';
};

function _uploadAndLoad(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'glb' && ext !== 'gltf') {
    _sh3dToast('Please select a .glb or .gltf file');
    return;
  }
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer()) return;

  // Optimistic local object URL for immediate preview
  const localUrl = URL.createObjectURL(file);
  _setLoadingHUD(true, 'Reading ' + file.name + '…');

  // Also try uploading to server so the file persists
  const formData = new FormData();
  formData.append('file', file, file.name);
  fetch(_S3_UPLOAD_URL, { method: 'POST', body: formData })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
    .then(function (data) {
      var serverUrl = data.url || data.path;
      if (!serverUrl && data.uploaded && data.uploaded.length) {
        serverUrl = '/uploads/' + String(data.uploaded[0]).replace(/^\/+/, '');
      }
      if (!serverUrl) serverUrl = localUrl;
      else serverUrl = _resolveAssetUrl(serverUrl);
      _loadGLB(serverUrl);
      URL.revokeObjectURL(localUrl);
      _sh3dSave3DSceneState({ model: serverUrl, name: file.name.replace(/\.[^.]+$/, '') });
    })
    .catch(function () {
      // Server upload failed — use local object URL (session-only)
      _loadGLB(localUrl);
      _sh3dToast('Model loaded locally (not saved to server)');
    });
}

/** Set environment preset by name */
window.sh3dSetEnvironment = function (name) {
  if (!ENV_PRESETS[name]) return;
  if (!_s3.renderer) _initRenderer();
  _applyEnvPreset(name);
};

/** Reset camera to fit the current model (or selected extra if one is active). */
window.sh3dResetCamera = function () {
  if (_s3.selectedName && typeof window.sh3dFocusExtra === 'function') {
    if (window.sh3dFocusExtra(_s3.selectedName)) return;
  }
  if (_s3.model) { _fitCameraToModel(); return; }
  if (_s3.camera) {
    _s3.camera.position.set(0, 1.2, 3.5);
    _s3.camera.updateProjectionMatrix();
  }
  if (_s3.controls) {
    _s3.controls.target.set(0, 0.8, 0);
    _s3.controls.update();
  }
};

/** Toggle wireframe mode */
window.sh3dToggleWireframe = function () {
  _toggleWireframe();
};

/** Play/pause animation on the selected target (main model or selected extra). */
window.sh3dToggleAnimation = function () {
  var sel = _getSelectedActions();
  var anyPlaying = sel.actions.some(function (a) { return !a.paused; });
  var newPlaying = !anyPlaying;
  sel.actions.forEach(function (a) { a.paused = !newPlaying; if (newPlaying && !a.isRunning()) a.play(); });
  if (!_s3.selectedName) _s3.animPlaying = newPlaying;
  const btn = document.getElementById('sh3dBtnPlayPause');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) { icon.className = newPlaying ? 'fas fa-pause' : 'fas fa-play'; }
  }
};

/** Set animation playback speed on the selected target (0.1 – 3.0) */
window.sh3dSetAnimSpeed = function (v) {
  var speed = Math.max(0.1, Math.min(3.0, parseFloat(v) || 1.0));
  var sel = _getSelectedActions();
  sel.actions.forEach(function (a) { a.setEffectiveTimeScale(speed); });
  if (!_s3.selectedName) _s3.animSpeed = speed;
  const el = document.getElementById('sh3dAnimSpeedVal');
  if (el) el.textContent = speed.toFixed(2) + '×';
};

/** Switch to a different animation clip by index on the selected target. */
window.sh3dSelectClip = function (index) {
  index = parseInt(index, 10);
  if (_s3.selectedName && _s3.extraMixers[_s3.selectedName]) {
    var e = _s3.extraMixers[_s3.selectedName];
    e.actions.forEach(function (a) { a.stop(); });
    if (index >= 0 && index < e.actions.length) {
      e.actions[index].reset().play();
      e.activeClipIndex = index;
    }
    return;
  }
  _playAnimClip(index);
};

/** Set renderer tone-mapping exposure */
window.sh3dSetExposure = function (v) {
  if (!_s3.renderer) return;
  _s3.renderer.toneMappingExposure = Math.max(0.1, Math.min(4.0, parseFloat(v) || 1.0));
  const el = document.getElementById('sh3dExposureVal');
  if (el) el.textContent = _s3.renderer.toneMappingExposure.toFixed(2);
};

/** Set background colour */
window.sh3dSetBgColor = function (hex) {
  _s3.bgColor = hex;
  if (_s3.scene) _s3.scene.background = new THREE.Color(hex);
};

/** Toggle grid helper visibility */
window.sh3dToggleGrid = function () {
  const grid = _s3.scene && _s3.scene.getObjectByName('sh3dGrid');
  if (grid) grid.visible = !grid.visible;
};

/** Toggle ground plane */
window.sh3dToggleGround = function () {
  const ground = _s3.scene && _s3.scene.getObjectByName('sh3dGround');
  if (ground) { ground.visible = !ground.visible; }
  else { _addGroundPlane(true); }
};

/** Apply a full 3D scene config object */
window.sh3dApplyConfig = function (cfg) {
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer()) return;
  _applySceneConfig(cfg);
};

/** Return the current scene config as JSON string (for editor / export) */
window.sh3dExportConfig = function () {
  const cfg = {
    type: '3d',
    model: _s3.loadedModelUrl || '',
    environment: _s3.currentEnv,
    bg: _s3.bgColor,
    camera: _s3.camera ? {
      fov: Math.round(_s3.camera.fov),
      position: _s3.camera.position.toArray().map(function (v) { return +v.toFixed(3); }),
    } : {},
    lighting: {
      ambient: _s3.lights.ambient ? _s3.lights.ambient.intensity : 0.6,
      directional: _s3.lights.dir ? _s3.lights.dir.intensity : 1.4,
    },
    animations: {
      play: _s3.animPlaying,
      speed: _s3.animSpeed,
      clip: _s3.animClipIndex,
    },
    stats: {
      meshes: _s3.stats.meshes,
      triangles: _s3.stats.triangles,
      animClips: _s3.animActions.length,
    },
  };
  return JSON.stringify(cfg, null, 2);
};

function _sh3dHasSkinnedMesh(obj) {
  var hasSkinned = false;
  if (!obj || typeof obj.traverse !== 'function') return false;
  obj.traverse(function (c) { if (c && c.isSkinnedMesh) hasSkinned = true; });
  return hasSkinned;
}

function _sh3dToUSDZMaterial(mat) {
  if (!mat) {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.FrontSide,
    });
  }
  if (mat.isMeshStandardMaterial) {
    var cloned = mat.clone();
    cloned.side = THREE.FrontSide;
    if (!cloned.transparent) cloned.opacity = 1;
    return cloned;
  }
  var converted = new THREE.MeshStandardMaterial({
    color: (mat.color && mat.color.isColor) ? mat.color.clone() : new THREE.Color(0xffffff),
    map: mat.map || null,
    normalMap: mat.normalMap || null,
    emissive: (mat.emissive && mat.emissive.isColor) ? mat.emissive.clone() : new THREE.Color(0x000000),
    emissiveMap: mat.emissiveMap || null,
    emissiveIntensity: (typeof mat.emissiveIntensity === 'number') ? mat.emissiveIntensity : 1,
    roughness: (typeof mat.roughness === 'number') ? mat.roughness : 0.85,
    roughnessMap: mat.roughnessMap || null,
    metalness: (typeof mat.metalness === 'number') ? mat.metalness : 0.05,
    metalnessMap: mat.metalnessMap || null,
    aoMap: mat.aoMap || null,
    alphaMap: mat.alphaMap || null,
    opacity: (typeof mat.opacity === 'number') ? mat.opacity : 1,
    transparent: !!mat.transparent && ((typeof mat.opacity === 'number') ? mat.opacity < 1 : false),
    alphaTest: (typeof mat.alphaTest === 'number') ? mat.alphaTest : 0,
    side: THREE.FrontSide,
  });
  if (mat.name) converted.name = mat.name + '_usdz';
  return converted;
}

function _sh3dSanitizeExportMaterials(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse(function (node) {
    if (!node || !node.isMesh || !node.material) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map(_sh3dToUSDZMaterial);
    } else {
      node.material = _sh3dToUSDZMaterial(node.material);
    }
  });
}

async function _sh3dEnsureArrayBuffer(payload) {
  if (payload instanceof ArrayBuffer) return payload;
  if (typeof Blob !== 'undefined' && payload instanceof Blob) {
    return payload.arrayBuffer();
  }
  if (ArrayBuffer.isView(payload)) {
    return payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
  }
  throw new Error('USDZ exporter returned unsupported payload type');
}

function _sh3dCloneForExport(obj) {
  if (!obj) return null;
  var cloned = null;
  try {
    if (_sh3dHasSkinnedMesh(obj)) cloned = SkeletonUtils.clone(obj);
  } catch (_e) {
    // Fall through to regular clone when SkeletonUtils cannot clone this graph.
  }
  if (!cloned) cloned = obj.clone(true);
  _sh3dSanitizeExportMaterials(cloned);
  return cloned;
}

function _sh3dDownloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
}

function _sh3dFileStem() {
  var metaId = (document.getElementById('shMetaId') || {}).value;
  if (metaId) return String(metaId);
  if (_s3.loadedModelUrl) {
    var tail = String(_s3.loadedModelUrl).split('/').pop().replace(/\?.*$/, '');
    if (tail) return tail.replace(/\.(glb|gltf)$/i, '');
  }
  return 'scene3d';
}

async function _sh3dBuildHybridBackdropPlane() {
  var host = document.getElementById('shPreviewSVG');
  var svgNode = host ? host.querySelector('svg') : null;
  if (!host || !svgNode || _s3.hybrid !== true) return null;

  var markup = '';
  try {
    markup = new XMLSerializer().serializeToString(svgNode);
  } catch (_e) {
    return null;
  }
  if (!markup) return null;

  var blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  var blobUrl = URL.createObjectURL(blob);
  try {
    var img = await new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = blobUrl;
    });

    var w = Math.max(4, img.naturalWidth || host.clientWidth || 1024);
    var h = Math.max(4, img.naturalHeight || host.clientHeight || 576);
    var texCanvas = document.createElement('canvas');
    texCanvas.width = w;
    texCanvas.height = h;
    var tctx = texCanvas.getContext('2d');
    if (!tctx) return null;
    tctx.drawImage(img, 0, 0, w, h);

    var texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    var aspect = w / Math.max(1, h);
    var bounds = new THREE.Box3();
    var hasAny = false;
    var includeObj = function (obj) {
      if (!obj) return;
      bounds.expandByObject(obj);
      hasAny = true;
    };
    includeObj(_s3.model);
    if (_s3.scene) {
      _s3.scene.children.forEach(function (obj) {
        if (!obj || !obj.name) return;
        if (obj.name.indexOf('sh3dExtra_') === 0 || obj.name.indexOf('sh3dPrim_') === 0) includeObj(obj);
      });
    }

    var center = hasAny ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0);
    var size = hasAny ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(2, 2, 2);
    var planeH = Math.max(2.0, size.y * 2.6);
    var planeW = planeH * aspect;
    var geometry = new THREE.PlaneGeometry(planeW, planeH);
    var material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    var plane = new THREE.Mesh(geometry, material);
    plane.name = 'sh3dHybridBackdropPlane';
    plane.position.set(
      center.x,
      center.y + Math.max(0, size.y * 0.2),
      center.z - Math.max(1.5, size.z * 1.5)
    );
    return plane;
  } catch (_e) {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function _sh3dBuildUSDZScene(includeBackground) {
  var out = new THREE.Scene();
  var count = 0;
  var addObject = function (obj) {
    if (!obj) return;
    var cloned = _sh3dCloneForExport(obj);
    if (!cloned) return;
    out.add(cloned);
    count += 1;
  };

  // Keep lighting so model-only exports still look readable in AR viewers.
  if (_s3.lights && _s3.lights.ambient) addObject(_s3.lights.ambient);
  if (_s3.lights && _s3.lights.dir) {
    var dir = _s3.lights.dir.clone();
    if (_s3.lights.dir.target) {
      dir.target.position.copy(_s3.lights.dir.target.position);
      out.add(dir.target);
    }
    out.add(dir);
  }
  if (_s3.lights && _s3.lights.fill) addObject(_s3.lights.fill);

  // Main model + extras.
  addObject(_s3.model);
  if (_s3.scene) {
    _s3.scene.children.forEach(function (obj) {
      if (!obj || !obj.name) return;
      if (obj.name.indexOf('sh3dExtra_') === 0 || obj.name.indexOf('sh3dPrim_') === 0) {
        addObject(obj);
      }
    });
  }

  if (includeBackground && _s3.scene) {
    if (_s3.scene.background && _s3.scene.background.isTexture) {
      out.background = _s3.scene.background;
    }
    if (_s3.scene.environment && _s3.scene.environment.isTexture) {
      out.environment = _s3.scene.environment;
    }
    var ground = _s3.scene.getObjectByName('sh3dGround');
    if (ground && ground.visible) addObject(ground);

    // In hybrid mode, include a textured backdrop plane from the current SVG frame.
    var hybridBackdrop = await _sh3dBuildHybridBackdropPlane();
    if (hybridBackdrop) {
      _sh3dSanitizeExportMaterials(hybridBackdrop);
      out.add(hybridBackdrop);
      count += 1;
    }
  }

  return { scene: out, objectCount: count };
}

window.sh3dExportUSDZ = async function (options) {
  options = options || {};
  var includeBackground = !!options.includeBackground;
  if (!_s3.scene) {
    _sh3dToast('No 3D scene to export');
    return;
  }

  var built = await _sh3dBuildUSDZScene(includeBackground);
  if (!built.objectCount) {
    _sh3dToast('No 3D objects to export');
    return;
  }

  var exporter = new USDZExporter();
  try {
    _setLoadingHUD(true, includeBackground ? 'Exporting USDZ (+background)…' : 'Exporting USDZ…');
    var parsed = exporter.parse(built.scene);
    var rawPayload = (parsed && typeof parsed.then === 'function') ? await parsed : parsed;
    var arrayBuffer = await _sh3dEnsureArrayBuffer(rawPayload);
    var stem = _sh3dFileStem().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'scene3d';
    var suffix = includeBackground ? '-with-bg' : '-model-only';
    var fileName = stem + suffix + '.usdz';
    var blob = new Blob([arrayBuffer], { type: 'model/vnd.usdz+zip' });
    _sh3dDownloadBlob(blob, fileName);
    if (includeBackground) {
      _sh3dToast('USDZ exported (+background when supported by exporter/viewer)');
    } else {
      _sh3dToast('USDZ exported (model-only)');
    }
  } catch (err) {
    console.error('[scene3d] USDZ export failed', err);
    _sh3dToast('USDZ export failed: ' + (err && err.message ? err.message : err));
  } finally {
    _setLoadingHUD(false);
  }
};

window.sh3dExportUSDZModelOnly = function () {
  return window.sh3dExportUSDZ({ includeBackground: false });
};

window.sh3dExportUSDZWithBackground = function () {
  return window.sh3dExportUSDZ({ includeBackground: true });
};

/** Return full snapshot of the live 3D state as a plain object (for saving scenes).
 *  Includes main model URL, extras (added GLBs + primitives with transforms), hybrid flag.
 */
window.sh3dGetState = function () {
  var extras = [];
  if (_s3.scene) {
    _s3.scene.children.forEach(function (obj) {
      if (!obj.name) return;
      if (obj.name.indexOf('sh3dExtra_') === 0) {
        // userData.sourceUrl is set when added via sh3dAddModel; fallback to name
        extras.push({
          kind: 'glb',
          url: obj.userData && obj.userData.sourceUrl ? obj.userData.sourceUrl : null,
          name: obj.name,
          position: obj.position.toArray().map(function (v) { return +v.toFixed(3); }),
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(function (v) { return +v.toFixed(3); }),
          scale: obj.scale.toArray().map(function (v) { return +v.toFixed(3); }),
        });
      } else if (obj.name.indexOf('sh3dPrim_') === 0) {
        var kind = obj.name.split('_')[1] || 'box';
        extras.push({
          kind: 'primitive',
          shape: kind,
          name: obj.name,
          color: obj.material && obj.material.color ? '#' + obj.material.color.getHexString() : '#cccccc',
          position: obj.position.toArray().map(function (v) { return +v.toFixed(3); }),
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(function (v) { return +v.toFixed(3); }),
          scale: obj.scale.toArray().map(function (v) { return +v.toFixed(3); }),
        });
      }
    });
  }
  return {
    active: !!_s3.active,
    model: _s3.loadedModelUrl || null,
    environment: _s3.currentEnv,
    bg: _s3.bgColor,
    exposure: _s3.renderer ? +_s3.renderer.toneMappingExposure.toFixed(3) : 1,
    hybrid: !!_s3.hybrid,
    extras: extras,
    animSpeed: _s3.animSpeed,
    animPlaying: _s3.animPlaying,
    animClipIndex: _s3.animClipIndex,
    camera: _s3.camera ? {
      fov: Math.round(_s3.camera.fov),
      position: _s3.camera.position.toArray().map(function (v) { return +v.toFixed(3); }),
    } : null,
  };
};

/** Restore a 3D state snapshot produced by sh3dGetState.
 *  Re-creates extras (GLBs by url + primitives by shape/color/transform).
 */
window.sh3dRestoreState = function (state) {
  if (!state) return;
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer() || !_s3.scene) return;
  // blob: URLs only live for the page session that created them — after a
  // reload they always 404. Drop them from the snapshot so GLTFLoader doesn't
  // try to fetch and log "Failed to fetch" noise during restore.
  var _isLiveUrl = function (u) {
    return typeof u === 'string' && u && u.indexOf('blob:') !== 0;
  };
  if (state.model && !_isLiveUrl(state.model)) state.model = null;
  if (Array.isArray(state.extras)) {
    var dropped = 0;
    state.extras = state.extras.filter(function (ex) {
      if (ex && ex.kind === 'glb' && !_isLiveUrl(ex.url)) { dropped++; return false; }
      return true;
    });
    if (dropped > 0) {
      try { _sh3dToast('Ignorados ' + dropped + ' modelo(s) com URL inv\u00e1lida (blob:).'); } catch (e) { }
    }
  }
  // Clear current extras first so we don't duplicate
  if (typeof window.sh3dClearExtras === 'function') window.sh3dClearExtras();
  // Apply base 3D config
  _applySceneConfig({
    environment: state.environment,
    bg: state.bg,
    camera: state.camera || undefined,
    model: state.model || undefined,
    animations: { play: state.animPlaying, speed: state.animSpeed, clip: state.animClipIndex },
  });
  if (_s3.renderer && typeof state.exposure === 'number') {
    _s3.renderer.toneMappingExposure = state.exposure;
  }
  // Recreate extras
  (state.extras || []).forEach(function (ex) {
    if (ex.kind === 'glb' && ex.url) {
      if (_SH3D_FAILED_URLS.has(ex.url)) {
        console.warn('[scene3d] skipping previously-failed extra:', ex.url);
        return;
      }
      new GLTFLoader().load(ex.url, function (gltf) {
        var m = gltf.scene;
        m.name = ex.name || ('sh3dExtra_' + Date.now());
        m.userData = m.userData || {};
        m.userData.sourceUrl = ex.url;
        if (ex.position) m.position.fromArray(ex.position);
        if (ex.rotation) m.rotation.set(ex.rotation[0], ex.rotation[1], ex.rotation[2]);
        if (ex.scale) m.scale.fromArray(ex.scale);
        m.traverse(function (c) { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        _s3.scene.add(m);
        if (gltf.animations && gltf.animations.length) {
          var mixer = new THREE.AnimationMixer(m);
          var actions = gltf.animations.map(function (clip) { return mixer.clipAction(clip); });
          actions[0].play();
          _s3.extraMixers[m.name] = { mixer: mixer, actions: actions, clips: gltf.animations, activeClipIndex: 0 };
        }
      }, undefined, function onErr(err) {
        _SH3D_FAILED_URLS.add(ex.url);
        var status = (err && (err.response && err.response.status || err.status)) || (String(err).match(/\b(404|403|500)\b/) || [])[1];
        console.warn('[scene3d] dropping missing extra (' + (status || 'load error') + '):', ex.url);
        try { _sh3dToast('Asset n\u00e3o encontrado: ' + (ex.name || ex.url.split('/').pop())); } catch (e) { }
        // Self-heal: prune from saved state so the next reload doesn't retry
        try {
          if (typeof window.sh3dPruneExtraByUrl === 'function') {
            window.sh3dPruneExtraByUrl(ex.url);
          }
        } catch (e) { }
      });
    } else if (ex.kind === 'primitive') {
      var geom;
      switch (ex.shape) {
        case 'sphere': geom = new THREE.SphereGeometry(0.6, 32, 24); break;
        case 'plane': geom = new THREE.PlaneGeometry(2, 2); break;
        case 'torus': geom = new THREE.TorusGeometry(0.5, 0.18, 16, 48); break;
        case 'cone': geom = new THREE.ConeGeometry(0.55, 1.1, 32); break;
        case 'cylinder': geom = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32); break;
        default: geom = new THREE.BoxGeometry(1, 1, 1);
      }
      var mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(ex.color || '#cccccc'), roughness: 0.6, metalness: 0.1 });
      var mesh = new THREE.Mesh(geom, mat);
      mesh.name = ex.name || ('sh3dPrim_' + (ex.shape || 'box') + '_' + Date.now());
      mesh.castShadow = true; mesh.receiveShadow = true;
      if (ex.position) mesh.position.fromArray(ex.position);
      if (ex.rotation) mesh.rotation.set(ex.rotation[0], ex.rotation[1], ex.rotation[2]);
      if (ex.scale) mesh.scale.fromArray(ex.scale);
      _s3.scene.add(mesh);
    }
  });
  // Hybrid mode
  if (typeof state.hybrid === 'boolean' && typeof window.sh3dSetHybrid2D === 'function') {
    window.sh3dSetHybrid2D(state.hybrid);
  }
  if (typeof _emitExtrasChanged === 'function') {
    // Fire twice: once now (primitives + HDR changes), again after async GLB loads
    _emitExtrasChanged();
    setTimeout(_emitExtrasChanged, 600);
    setTimeout(_emitExtrasChanged, 1500);
  }
};

/** Generate Three.js boilerplate code for the editor */
window.sh3dGenerateCode = function () {
  const modelUrl = _s3.loadedModelUrl || '/uploads/your-model.glb';
  const env = ENV_PRESETS[_s3.currentEnv] || ENV_PRESETS.studio;
  return `// Three.js 3D Scene — generated by Kout Shaders Agent
// Environment: ${_s3.currentEnv}
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('sh3dCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = ${env.toneMappingExposure};
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color('${_s3.bgColor}');

const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.01, 1000);
camera.position.set(0, 1.2, 3.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Lighting
const ambient = new THREE.AmbientLight(${env.ambientColor}, ${env.ambientIntensity});
scene.add(ambient);
const sun = new THREE.DirectionalLight(${env.dirColor}, ${env.dirIntensity});
sun.position.set(${env.dirPos.join(', ')});
sun.castShadow = true;
scene.add(sun);

// Load model
const loader = new GLTFLoader();
loader.load('${modelUrl}', (gltf) => {
  const model = gltf.scene;
  scene.add(model);
  // Auto-fit to view
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2.0 / maxDim;
  model.scale.setScalar(scale);
  model.position.sub(centre.clone().multiplyScalar(scale));
  // Play animations
  if (gltf.animations.length > 0) {
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();
    // Update mixer in animation loop below
  }
});

// Animate
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();`;
};

/* ── Save 3D scene state back to shaders module ─────────────────── */
function _sh3dSave3DSceneState(extra) {
  // Notify shaders.js that a 3D scene is active — creates/updates the scene entry
  if (typeof window.shRegister3DScene === 'function') {
    const cfg = JSON.parse(window.sh3dExportConfig());
    if (extra) Object.assign(cfg, extra);
    window.shRegister3DScene(cfg);
  }
}

/** Build a structured 3D scene prompt for the AI brainstorm agent */
window.sh3dBuildBrainPrompt = function (userText) {
  const config = window.sh3dExportConfig();
  return `You are the Kout 3D Scene Agent, an expert in Three.js, WebGL, GLTF/GLB 3D models, animation mixing, and interactive 3D web experiences.

CURRENT 3D SCENE STATE:
${config}

AVAILABLE ENVIRONMENT PRESETS: ${Object.keys(ENV_PRESETS).join(', ')}

USER REQUEST: ${userText}

Respond with:
1. Analysis of what the user wants in the 3D scene context
2. Concrete Three.js code or config changes to achieve it
3. If relevant, a JSON scene config update in this format:
\`\`\`json
{ "type": "3d", "environment": "...", "bg": "#...", "lighting": {...}, "animations": {...} }
\`\`\`
4. Any tips for optimizing the 3D model/scene for web performance`;
};

/* ── CLEANUP on view hide ───────────────────────────────────────── */
window.sh3dCleanup = function () {
  _stopLoop();
  _s3.active = false;
};

/* ═══════════════════════════════════════════════════════════════════
   EXTENDED API — background image, add objects, hybrid 2D+3D mode
   ═══════════════════════════════════════════════════════════════════ *//** Set an image as the 3D scene background.
*  Auto-detects equirectangular panoramas (width ≈ 2 × height) and uses them as
*  an environment map, otherwise applies a flat 2D background.
*  Accepts a URL string or a File/Blob (uploaded via <input type="file">).
*/
window.sh3dSetBackgroundImage = function (src) {
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer() || !_s3.scene) return;
  var resolve = function (url, cleanup) {
    if (url.toLowerCase().endsWith('.hdr')) {
      new RGBELoader().load(url, function (tex) {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        _s3.scene.background = tex;
        _s3.scene.environment = tex;
        if (cleanup) cleanup();
        _sh3dToast('HDRI background applied');
      });
      return;
    }
    new THREE.TextureLoader().load(url, function (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      var ratio = tex.image ? tex.image.width / Math.max(1, tex.image.height) : 1;
      if (ratio > 1.8 && ratio < 2.2) {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        _s3.scene.environment = tex;
      }
      _s3.scene.background = tex;
      if (cleanup) cleanup();
      _sh3dToast('Background image applied');
    }, undefined, function (err) {
      console.error('[scene3d] background load failed', err);
      _sh3dToast('Failed to load background image');
    });
  };
  if (src && typeof src !== 'string' && src instanceof Blob) {
    var obj = URL.createObjectURL(src);
    resolve(obj, function () { URL.revokeObjectURL(obj); });
  } else {
    resolve(String(src), null);
  }
};

/** Clear the background image and return to the current environment's solid colour. */
window.sh3dClearBackgroundImage = function () {
  if (_s3.scene) {
    _s3.scene.background = new THREE.Color(_s3.bgColor);
    _s3.scene.environment = null;
    _sh3dToast('Background reset');
  }
};

/** Add a GLB model WITHOUT removing the existing scene/model.
 *  Positions new models along +X so they don't overlap. Returns nothing (async).
 */
window.sh3dAddModel = function (url) {
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer() || !_s3.scene) return;
  _setLoadingHUD(true, 'Adding model…');
  new GLTFLoader().load(url, function (gltf) {
    var m = gltf.scene;
    m.name = 'sh3dExtra_' + Date.now();
    m.userData = m.userData || {};
    m.userData.sourceUrl = url;
    // Normalise size ~1.5 units tall
    var box = new THREE.Box3().setFromObject(m);
    var size = new THREE.Vector3(); box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0.001) m.scale.setScalar(1.5 / maxDim);
    // Re-floor and offset along X based on how many extras already exist
    var extras = _s3.scene.children.filter(function (c) { return c.name && c.name.indexOf('sh3dExtra_') === 0; });
    var box2 = new THREE.Box3().setFromObject(m);
    m.position.y -= box2.min.y;
    m.position.x = 1.6 * (extras.length + 1);
    m.traverse(function (c) { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    _s3.scene.add(m);
    _s3.stats.meshes += 1;
    // Per-extra animation mixer (each added GLB plays its own animations)
    if (gltf.animations && gltf.animations.length) {
      var mixer = new THREE.AnimationMixer(m);
      var actions = gltf.animations.map(function (clip) { return mixer.clipAction(clip); });
      actions[0].play();
      _s3.extraMixers[m.name] = { mixer: mixer, actions: actions, clips: gltf.animations, activeClipIndex: 0 };
    }
    _setLoadingHUD(false);
    _sh3dToast('Model added');
    if (typeof _emitExtrasChanged === 'function') _emitExtrasChanged();
  }, undefined, function (err) {
    _setLoadingHUD(false);
    console.error('[scene3d] addModel failed', err);
    _sh3dToast('Failed to add model');
  });
};

/** Upload a local GLB and add it to the scene without clearing existing model(s).
 *  We REQUIRE a persistable server URL — otherwise the extra cannot be saved
 *  into a scene (blob URLs die on reload). On upload failure we warn the user
 *  but still add the model to the current session so they can iterate.
 */
window.sh3dUploadAndAddModel = function () {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.glb,.gltf';
  inp.onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var local = URL.createObjectURL(f);
    var fd = new FormData(); fd.append('file', f, f.name);
    _setLoadingHUD(true, 'Uploading ' + f.name + '…');
    fetch(_S3_UPLOAD_URL, { method: 'POST', body: fd })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        // Kout bridge returns {status,uploaded:[name],count}; construct served URL.
        var url = d.url || d.path;
        if (!url && d.uploaded && d.uploaded.length) {
          url = '/uploads/' + String(d.uploaded[0]).replace(/^\/+/, '');
        }
        if (!url) throw new Error('upload: missing url in response');
        url = _resolveAssetUrl(url);
        window.sh3dAddModel(url);
        URL.revokeObjectURL(local);
      })
      .catch(function (err) {
        console.warn('[scene3d] upload failed, using session-only blob URL', err);
        _sh3dToast('Upload falhou — modelo só nesta sessão (não persiste ao salvar cena)');
        window.sh3dAddModel(local);
      })
      .finally(function () { _setLoadingHUD(false); });
  };
  inp.click();
};

/** Add a built-in primitive (box / sphere / plane / torus / cone). */
window.sh3dAddPrimitive = function (kind) {
  if (!_s3.active) window.sh3dActivate();
  if (!_initRenderer() || !_s3.scene) return;
  var geom;
  switch (kind) {
    case 'sphere': geom = new THREE.SphereGeometry(0.6, 32, 24); break;
    case 'plane': geom = new THREE.PlaneGeometry(2, 2); break;
    case 'torus': geom = new THREE.TorusGeometry(0.5, 0.18, 16, 48); break;
    case 'cone': geom = new THREE.ConeGeometry(0.55, 1.1, 32); break;
    case 'cylinder': geom = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32); break;
    default: geom = new THREE.BoxGeometry(1, 1, 1); kind = 'box';
  }
  var mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.55, 0.55),
    roughness: 0.6, metalness: 0.1,
  });
  var mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'sh3dPrim_' + kind + '_' + Date.now();
  mesh.castShadow = true; mesh.receiveShadow = true;
  var extras = _s3.scene.children.filter(function (c) { return c.name && c.name.indexOf('sh3dPrim_') === 0; });
  mesh.position.set(-1.6 * (extras.length + 1), kind === 'plane' ? 0.01 : 0.6, 0);
  if (kind === 'plane') mesh.rotation.x = -Math.PI / 2;
  _s3.scene.add(mesh);
  _s3.stats.meshes += 1;
  _sh3dToast('Added ' + kind);
  if (typeof _emitExtrasChanged === 'function') _emitExtrasChanged();
};

/** Remove all extras (added models + primitives) — keeps the main model. */
window.sh3dClearExtras = function () {
  if (!_s3.scene) return;
  var removed = 0;
  var toRemove = _s3.scene.children.filter(function (c) {
    return c.name && (c.name.indexOf('sh3dExtra_') === 0 || c.name.indexOf('sh3dPrim_') === 0);
  });
  toRemove.forEach(function (o) {
    // Drop mixer if any
    if (_s3.extraMixers[o.name]) {
      _s3.extraMixers[o.name].mixer.stopAllAction();
      delete _s3.extraMixers[o.name];
    }
    o.traverse(function (c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { m.dispose(); }); }
    });
    _s3.scene.remove(o);
    removed += 1;
  });
  _s3.stats.meshes = Math.max(0, _s3.stats.meshes - removed);
  // If the selected object was removed, clear selection
  if (_s3.selectedName && !_s3.scene.getObjectByName(_s3.selectedName)) {
    window.sh3dSelect(null);
  }
  _sh3dToast('Cleared ' + removed + ' extra object' + (removed === 1 ? '' : 's'));
  _emitExtrasChanged();
};

/* ── EXTRAS MANAGEMENT API ──────────────────────────────────────── */

function _emitExtrasChanged() {
  try { window.dispatchEvent(new Event('sh3d:extras-changed')); } catch (e) { }
}

/** List all extras currently in the scene. Returns lightweight plain objects. */
window.sh3dListExtras = function () {
  if (!_s3.scene) return [];
  return _s3.scene.children
    .filter(function (c) { return c.name && (c.name.indexOf('sh3dExtra_') === 0 || c.name.indexOf('sh3dPrim_') === 0); })
    .map(function (obj) {
      var isGlb = obj.name.indexOf('sh3dExtra_') === 0;
      return {
        name: obj.name,
        kind: isGlb ? 'glb' : 'primitive',
        label: isGlb
          ? (obj.userData && obj.userData.sourceUrl
            ? obj.userData.sourceUrl.split('/').pop().replace(/\?.*$/, '')
            : 'GLB')
          : (obj.name.split('_')[1] || 'primitive'),
        url: (obj.userData && obj.userData.sourceUrl) || null,
        position: obj.position.toArray().map(function (v) { return +v.toFixed(2); }),
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(function (v) { return +v.toFixed(2); }),
        scale: +obj.scale.x.toFixed(2),
        color: (!isGlb && obj.material && obj.material.color)
          ? '#' + obj.material.color.getHexString() : null,
        ephemeral: !!(obj.userData && obj.userData.sourceUrl && obj.userData.sourceUrl.indexOf('blob:') === 0),
        selected: _s3.selectedName === obj.name,
        hasAnimations: !!(_s3.extraMixers[obj.name] && _s3.extraMixers[obj.name].actions.length),
        clipCount: _s3.extraMixers[obj.name] ? _s3.extraMixers[obj.name].actions.length : 0,
      };
    });
};

/** Return info about the main model target (or null if nothing is loaded). */
window.sh3dGetMainInfo = function () {
  if (!_s3.model) return null;
  return {
    name: null,
    kind: 'main',
    label: _s3.loadedModelUrl ? _s3.loadedModelUrl.split('/').pop() : 'Modelo principal',
    url: _s3.loadedModelUrl || null,
    selected: _s3.selectedName === null,
    hasAnimations: !!(_s3.mixer && _s3.animActions.length),
    clipCount: _s3.animActions.length,
  };
};

/** Select a target by name. `null` or `'main'` selects the main model.
 *  Highlights it and retargets animation/camera controls.
 */
window.sh3dSelect = function (name) {
  if (name === 'main') name = null;
  _s3.selectedName = name;
  _updateSelectionBox();
  // Attach / detach the transform gizmo to the new selection
  if (_s3.transformControls) {
    var target = null;
    if (name && _s3.scene) target = _s3.scene.getObjectByName(name);
    else if (_s3.model) target = _s3.model;
    // Only attach if the target is actually part of the live scene graph,
    // otherwise TransformControls spams "must be a part of the scene graph"
    // every frame from updateMatrixWorld.
    var inScene = false;
    if (target) {
      var p = target;
      while (p) { if (p === _s3.scene) { inScene = true; break; } p = p.parent; }
    }
    if (target && inScene) {
      _s3.transformControls.attach(target);
      _s3.transformControls.enabled = !!_s3.gizmoVisible;
      _s3.transformControls.visible = !!_s3.gizmoVisible;
      _s3.transformControls.setMode(_s3.transformMode || 'translate');
    } else {
      _s3.transformControls.detach();
      _s3.transformControls.enabled = false;
      _s3.transformControls.visible = false;
    }
  }
  // Refresh HUD model label
  var modelEl = document.getElementById('sh3dHudModel');
  if (modelEl) {
    if (name && _s3.scene) {
      var obj = _s3.scene.getObjectByName(name);
      var lbl = name;
      if (obj && obj.userData && obj.userData.sourceUrl) lbl = obj.userData.sourceUrl.split('/').pop();
      else if (name.indexOf('sh3dPrim_') === 0) lbl = name.split('_')[1];
      modelEl.textContent = '▸ ' + lbl;
    } else if (_s3.loadedModelUrl) {
      modelEl.textContent = _s3.loadedModelUrl.split('/').pop();
    } else {
      modelEl.textContent = '—';
    }
  }
  // Sync animation UI (clip picker + speed) for the new target
  var sel = _getSelectedActions();
  var speedEl = document.getElementById('sh3dAnimSpeedSlider');
  if (speedEl && sel.actions.length) {
    var a0 = sel.actions.find(function (a) { return !a.paused; }) || sel.actions[0];
    var ts = a0.getEffectiveTimeScale();
    speedEl.value = ts;
    var sv = document.getElementById('sh3dAnimSpeedVal');
    if (sv) sv.textContent = (+ts).toFixed(2) + '×';
  }
  try { window.dispatchEvent(new Event('sh3d:selection-changed')); } catch (e) { }
  _emitExtrasChanged();
};

/** Currently selected target (null => main model). */
window.sh3dGetSelected = function () { return _s3.selectedName; };

/** List all selectable objects in the scene for remote UIs.
 *  Returns [{name, label, type, selected, hasAnimations}] where `name` is
 *  the canonical identifier understood by `window.sh3dSelect`.
 *  The main model uses name="main".
 */
window.sh3dListObjects = function () {
  var out = [];
  if (_s3.model) {
    var mainLabel = _s3.loadedModelUrl ? _s3.loadedModelUrl.split('/').pop() : 'Main model';
    out.push({
      name: 'main',
      label: mainLabel,
      type: 'main',
      selected: !_s3.selectedName,
      hasAnimations: !!(_s3.mixer && _s3.animActions && _s3.animActions.length)
    });
  }
  if (_s3.scene) {
    _s3.scene.children.forEach(function (c) {
      if (!c.name) return;
      var isExtra = c.name.indexOf('sh3dExtra_') === 0;
      var isPrim = c.name.indexOf('sh3dPrim_') === 0;
      if (!isExtra && !isPrim) return;
      var lbl;
      if (isExtra) {
        lbl = (c.userData && c.userData.sourceUrl) ? c.userData.sourceUrl.split('/').pop()
          : c.name.replace('sh3dExtra_', 'extra:');
      } else {
        lbl = c.name.split('_')[1] || 'primitive';
      }
      var ex = _s3.extraMixers && _s3.extraMixers[c.name];
      out.push({
        name: c.name,
        label: lbl,
        type: isExtra ? 'glb' : 'primitive',
        selected: _s3.selectedName === c.name,
        hasAnimations: !!(ex && ex.actions && ex.actions.length)
      });
    });
  }
  return out;
};

/** Set the gizmo transform mode: 'translate' | 'rotate' | 'scale'. */
window.sh3dSetTransformMode = function (mode) {
  if (['translate', 'rotate', 'scale'].indexOf(mode) < 0) return;
  _s3.transformMode = mode;
  if (_s3.transformControls && _s3.transformControls.object) {
    _s3.transformControls.setMode(mode);
  }
  try { window.dispatchEvent(new Event('sh3d:transform-mode-changed')); } catch (e) { }
};

/** Read the current gizmo mode. */
window.sh3dGetTransformMode = function () { return _s3.transformMode || 'translate'; };

/** Hide/show the gizmo entirely (without changing the selection). */
window.sh3dSetGizmoVisible = function (on) {
  _s3.gizmoVisible = !!on;
  if (_s3.transformControls) {
    _s3.transformControls.visible = _s3.gizmoVisible && !!_s3.transformControls.object;
    _s3.transformControls.enabled = _s3.gizmoVisible && !!_s3.transformControls.object;
  }
  _syncSelectionUiButton();
};

/** Toggle both selection box and gizmo visibility from the UI control button. */
window.sh3dToggleSelectionBox = function (force) {
  var next = (typeof force === 'boolean')
    ? !!force
    : !(_s3.selectionBoxVisible && _s3.gizmoVisible);
  _s3.selectionBoxVisible = next;
  _s3.gizmoVisible = next;
  _updateSelectionBox();
  if (_s3.transformControls) {
    var hasTarget = !!_s3.transformControls.object;
    _s3.transformControls.visible = next && hasTarget;
    _s3.transformControls.enabled = next && hasTarget;
  }
  _syncSelectionUiButton();
  return next;
};

/** Remove a single extra by its unique name. */
window.sh3dRemoveExtra = function (name) {
  if (!_s3.scene || !name) return false;
  var obj = _s3.scene.getObjectByName(name);
  if (!obj) return false;
  // Detach gizmo first so it doesn't keep pointing at a disposed object.
  if (_s3.transformControls && _s3.transformControls.object === obj) {
    _s3.transformControls.detach();
    _s3.transformControls.visible = false;
    _s3.transformControls.enabled = false;
  }
  if (_s3.extraMixers[name]) {
    _s3.extraMixers[name].mixer.stopAllAction();
    delete _s3.extraMixers[name];
  }
  obj.traverse(function (c) {
    if (c.geometry) c.geometry.dispose();
    if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { m.dispose(); }); }
  });
  _s3.scene.remove(obj);
  _s3.stats.meshes = Math.max(0, _s3.stats.meshes - 1);
  if (_s3.selectedName === name) window.sh3dSelect(null);
  _sh3dToast('Removed: ' + name);
  _emitExtrasChanged();
  return true;
};

/** Update transform of an extra. Accepts any subset of {position,rotation,scale,color}. */
window.sh3dUpdateExtra = function (name, patch) {
  if (!_s3.scene || !name || !patch) return false;
  var obj = _s3.scene.getObjectByName(name);
  if (!obj) return false;
  if (patch.position && patch.position.length === 3) obj.position.fromArray(patch.position);
  if (patch.rotation && patch.rotation.length === 3) obj.rotation.set(patch.rotation[0], patch.rotation[1], patch.rotation[2]);
  if (typeof patch.scale === 'number') obj.scale.setScalar(patch.scale);
  else if (patch.scale && patch.scale.length === 3) obj.scale.fromArray(patch.scale);
  if (patch.color && obj.material && obj.material.color) {
    obj.material.color.set(patch.color);
  }
  _emitExtrasChanged();
  return true;
};

/** Focus camera on a given extra. */
window.sh3dFocusExtra = function (name) {
  if (!_s3.scene || !_s3.controls) return false;
  var obj = _s3.scene.getObjectByName(name);
  if (!obj) return false;
  var box = new THREE.Box3().setFromObject(obj);
  var centre = new THREE.Vector3(); box.getCenter(centre);
  var size = new THREE.Vector3(); box.getSize(size);
  var dist = Math.max(size.x, size.y, size.z) * 2.5 + 1;
  _s3.controls.target.copy(centre);
  _s3.camera.position.copy(centre).add(new THREE.Vector3(dist, dist * 0.6, dist));
  _s3.controls.update();
  return true;
};


/** Hybrid 2D+3D overlay mode.
 *  When enabled, keeps the 2D SVG scene visible behind a transparent 3D canvas,
 *  so a GLB model appears INSIDE the SVG environment.
 */
window.sh3dSetHybrid2D = function (on) {
  on = !!on;
  if (on && !_s3.active) window.sh3dActivate();
  if (!_initRenderer()) return;
  var svgEl = document.getElementById('shPreviewSVG');
  var fxEl = document.getElementById('shPreviewFxLayer');
  _s3.hybrid = on;
  if (on) {
    _s3.scene.background = null;                       // transparent
    _s3.renderer.setClearColor(0x000000, 0);
    if (svgEl) svgEl.style.display = '';               // reveal SVG
    if (fxEl) fxEl.style.display = '';
    _sh3dToast('Hybrid 2D + 3D overlay ON');
  } else {
    _s3.scene.background = new THREE.Color(_s3.bgColor);
    _s3.renderer.setClearColor(_s3.bgColor, 1);
    if (svgEl) svgEl.style.display = 'none';
    if (fxEl) fxEl.style.display = 'none';
    _sh3dToast('Hybrid mode OFF');
  }
  var btn = document.getElementById('sh3dBtnHybrid');
  if (btn) btn.classList.toggle('active', on);
};

/** Open a file picker for a background image/HDRI. */
window.sh3dUploadBackgroundImage = function () {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.png,.jpg,.jpeg,.webp,.hdr,.exr';
  inp.onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) window.sh3dSetBackgroundImage(f);
  };
  inp.click();
};

/* ── END EXTENDED API ─────────────────────────────────────────── */

/** Remove any saved extras matching the given URL from persisted state.
 *  Called when an extra fails to load (e.g. 404) so the next reload
 *  doesn't keep retrying a missing asset. */
window.sh3dPruneExtraByUrl = function (url) {
  if (!url) return 0;
  var pruned = 0;
  try {
    var raw = localStorage.getItem('kout.scene3d.last');
    if (!raw) return 0;
    var cfg = JSON.parse(raw);
    if (cfg && Array.isArray(cfg.extras)) {
      var before = cfg.extras.length;
      cfg.extras = cfg.extras.filter(function (ex) { return !(ex && ex.url === url); });
      pruned = before - cfg.extras.length;
      if (pruned > 0) {
        localStorage.setItem('kout.scene3d.last', JSON.stringify(cfg));
        console.warn('[scene3d] pruned ' + pruned + ' missing extra(s) from saved state:', url);
      }
    }
  } catch (e) { /* ignore */ }
  return pruned;
};

/* ── INIT HOOK: called once the DOM is ready ────────────────────── */
function _sh3dDOMInit() {
  // Pre-wire the file input if present
  const fi = document.getElementById('sh3dFileInput');
  if (fi) fi.addEventListener('change', window.sh3dHandleFileInput);
  _syncSelectionUiButton();
  // Restore last 3D scene if saved
  try {
    const raw = localStorage.getItem('kout.scene3d.last');
    if (raw) {
      const cfg = JSON.parse(raw);
      _s3.sceneConfig = cfg;
      // Do NOT auto-activate; only restore config, activate on explicit user action
      if (cfg.currentEnv) _s3.currentEnv = cfg.currentEnv;
    }
  } catch (_e) { /* ignore */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _sh3dDOMInit);
} else {
  _sh3dDOMInit();
}
