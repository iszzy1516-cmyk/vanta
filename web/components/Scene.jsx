"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const AMBER = new THREE.Color("#e8a33d");
const IVORY = new THREE.Color("#f2ead9");

// per-part explode offsets in glTF child space (from the Blender build)
const EXPLODE_OFFSETS = [
  [/^Screen$/, () => [0, 0.05, 0]],
  [/^AuroraRim$/, () => [0, 0.03, 0]],
  [/^SelfiePunch$/, () => [0, 0.09, 0]],
  [/^BackPanel$/, () => [0, -0.03, 0]],
  [/^CameraModule$/, () => [0, -0.055, 0]],
  [/^Lens|^SpectralSensor/, () => [0, -0.085, 0]],
  [/^Key/, () => [0.022, 0, 0]],
  [/^USBC|^Speaker/, () => [0, 0, 0.022]],
  [/^Antenna/, (o) => [Math.sign(o.position.x) * 0.015 || 0.015, 0, 0]],
];

const FINISHES = {
  void: {
    frame: { color: "#1b1a15", metalness: 0.92, roughness: 0.45, emissive: "#000000", ei: 0 },
    back: { color: "#131209", metalness: 0.1, roughness: 0.35, emissive: "#000000", ei: 0 },
  },
  amber: {
    frame: { color: "#41300f", metalness: 0.85, roughness: 0.35, emissive: "#6e4710", ei: 0.55 },
    back: { color: "#2c2110", metalness: 0.2, roughness: 0.3, emissive: "#7a4d12", ei: 0.6 },
  },
  silver: {
    frame: { color: "#c9ccd4", metalness: 1.0, roughness: 0.32, emissive: "#000000", ei: 0 },
    back: { color: "#d6d8e2", metalness: 0.6, roughness: 0.35, emissive: "#000000", ei: 0 },
  },
};

const CALLOUTS = [
  { id: "hero-dim", anchor: "Body", local: [0.0385, 0.08, 0], tag: "8.9 MM", sub: "titanium-ceramic unibody", section: "one", delay: 0 },
  { id: "spec-display", anchor: "Screen", local: [0.036, 0.06, 0.0005], tag: "6.9″", sub: "LTPO spectral OLED", section: "specs", delay: 0 },
  { id: "spec-body", anchor: "Body", local: [-0.0385, -0.05, 0], tag: "199 G", sub: "sealed unibody", section: "specs", delay: 0.1 },
  { id: "spec-lens", anchor: "Lens1Glass", local: [0, 0, -0.002], tag: "F/1.4", sub: "200MP spectral sensor", section: "specs", delay: 0.2 },
];

export default function Scene() {
  const canvasRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const DPR_CAP = isMobile ? 1.25 : 1.5;

    // surface fatal errors on the page — the user can screenshot them
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;left:12px;bottom:12px;z-index:200;max-width:70vw;" +
      "font:12px/1.5 monospace;background:#3a1212;color:#ffb3b3;padding:10px 14px;" +
      "border:1px solid #ff5470;border-radius:8px;white-space:pre-wrap;display:none";
    document.body.appendChild(toast);
    let toasted = false;
    const showToast = (msg) => {
      if (toasted) return;
      toasted = true;
      toast.style.display = "block";
      toast.textContent = "VANTA diagnostic: " + msg;
    };
    const onGlobalError = (e) => showToast(e.message + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno);
    window.addEventListener("error", onGlobalError);
    window.addEventListener("unhandledrejection", (e) => showToast("promise: " + (e.reason && e.reason.message || e.reason)));

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      canvas.addEventListener("webglcontextlost", () => showToast("WebGL context lost by the browser"));
    } catch (e) {
      document.body.classList.add("no-webgl");
      window.dispatchEvent(new CustomEvent("vanta:ready"));
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1c1b19");

    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 20);
    camera.position.set(0, 0.02, 0.38);
    camera.lookAt(0, 0.01, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    if ("environmentIntensity" in scene) scene.environmentIntensity = 0.15;

    scene.add(new THREE.AmbientLight("#2a2822", 0.5));
    const key = new THREE.DirectionalLight("#fff2dd", 1.0);
    key.position.set(0.4, -0.5, 0.8);
    scene.add(key);
    const rimAmber = new THREE.PointLight(AMBER, 3.5, 3);
    rimAmber.position.set(-0.4, 0.25, 0.25);
    scene.add(rimAmber);
    const rimIvory = new THREE.PointLight(IVORY, 2, 3);
    rimIvory.position.set(0.4, 0.35, 0.15);
    scene.add(rimIvory);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.55, 0.85);
    if (!isMobile) composer.addPass(bloom); // bloom is the heaviest pass — skip on phones
    composer.addPass(new OutputPass());

    // ------------------------------------------------ rig + state
    const pose = { x: 0.05, y: 0, ry: 0.55, rx: 0.1, explode: 0, spin: 0.2, scale: 1, dim: 0 };
    const intro = { v: 0 };
    const root = new THREE.Group();
    const spinner = new THREE.Group();
    root.add(spinner);
    scene.add(root);

    const drag = { active: false, px: 0, py: 0, vx: 0, vy: 0, userY: 0, userX: 0 };
    const mouse = { x: 0, y: 0 };
    const isDesktop = () => window.matchMedia("(min-width: 761px)").matches;

    let parts = [];
    const materials = {};
    let meshGroup = null;
    let particles = null;
    let particleUniforms = null;
    let transitioning = false;
    let rimMats = [];
    let pulseTimer = null;

    // ------------------------------------------------ screen shader
    const screenUniforms = { uTime: { value: 0 } };
    const makeScreenMaterial = () => new THREE.ShaderMaterial({
      uniforms: screenUniforms,
      toneMapped: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
          return v;
        }
        void main() {
          vec2 uv = vUv;
          float t = uTime * 0.12;
          vec3 col = vec3(0.012, 0.011, 0.008);
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float cx = 0.5 + 0.28 * sin(uv.y * (3.5 + fk) + t * (0.8 + 0.2 * fk) + fk * 2.1);
            float w = 0.05 + 0.03 * sin(uv.y * 5.0 + fk);
            float rib = exp(-pow((uv.x - cx) / w, 2.0));
            rib *= 0.55 + 0.7 * fbm(uv * vec2(3.0, 6.0) + vec2(0.0, -t * 1.4) + fk);
            vec3 rc = mix(vec3(0.910, 0.639, 0.239), vec3(0.960, 0.925, 0.860),
                          clamp(uv.y * 0.65 + 0.25 * sin(t + fk), 0.0, 1.0));
            col += rc * rib * 0.3;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    // ------------------------------------------------ callout DOM
    const calloutEls = {};
    for (const c of CALLOUTS) {
      const el = document.createElement("div");
      el.className = "pointer-events-none absolute z-20 opacity-0 transition-opacity duration-500";
      el.innerHTML = `
        <svg class="absolute overflow-visible" width="2" height="2">
          <line class="leader-line" x1="0" y1="0" x2="0" y2="0" opacity="0.9"/>
        </svg>
        <div class="absolute leader-tag" style="transform: translate(14px, -8px)">
          <div class="leader-text" style="font-size:13px">${c.tag}</div>
          <div class="text-mist" style="font-size:12px">${c.sub}</div>
        </div>`;
      layer.appendChild(el);
      calloutEls[c.id] = { el, line: el.querySelector("line"), def: c, shown: false };
    }
    const activeSections = new Set(["one"]);

    // ------------------------------------------------ particles
    const PARTICLE_COUNT = isMobile ? 12000 : 22000;
    function buildParticles(phone) {
      spinner.updateWorldMatrix(true, true);
      const origins = new Float32Array(PARTICLE_COUNT * 3);
      const scatter = new Float32Array(PARTICLE_COUNT * 3);
      const rands = new Float32Array(PARTICLE_COUNT);

      const meshes = [];
      phone.traverse((o) => { if (o.isMesh) meshes.push(o); });
      const totalVerts = meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0);
      let idx = 0;
      const v = new THREE.Vector3();
      for (const m of meshes) {
        const posAttr = m.geometry.attributes.position;
        const share = Math.round((posAttr.count / totalVerts) * PARTICLE_COUNT);
        for (let i = 0; i < share && idx < PARTICLE_COUNT; i++) {
          const vi = Math.floor(Math.random() * posAttr.count);
          v.fromBufferAttribute(posAttr, vi);
          m.localToWorld(v);
          spinner.worldToLocal(v);
          origins[idx * 3] = v.x; origins[idx * 3 + 1] = v.y; origins[idx * 3 + 2] = v.z;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const dist = 0.06 + 0.22 * Math.pow(Math.random(), 1.4);
          scatter[idx * 3] = v.x + Math.sin(phi) * Math.cos(theta) * dist;
          scatter[idx * 3 + 1] = v.y + Math.cos(phi) * dist * 0.8;
          // flatten depth spread so particles never lung toward the camera
          scatter[idx * 3 + 2] = v.z + Math.sin(phi) * Math.sin(theta) * dist * 0.45;
          rands[idx] = Math.random();
          idx++;
        }
      }
      for (; idx < PARTICLE_COUNT; idx++) rands[idx] = Math.random();

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(origins, 3));
      geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
      geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));

      particleUniforms = {
        uProgress: { value: 0 },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 3.4 * DPR_CAP },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms: particleUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute vec3 aScatter;
          attribute float aRand;
          uniform float uProgress;
          uniform float uTime;
          uniform float uSize;
          varying float vRand;
          void main() {
            vRand = aRand;
            float p = uProgress;
            // disassemble then reform: same curve both ways
            float arc = sin(p * 3.14159);
            vec3 pos = mix(position, aScatter, p);
            // swirl while scattered
            float ang = arc * (1.5 + aRand) * (aRand > 0.5 ? 1.0 : -1.0);
            float ca = cos(ang), sa = sin(ang);
            pos = vec3(pos.x * ca - pos.z * sa, pos.y, pos.x * sa + pos.z * ca);
            pos.y += arc * 0.05 * sin(uTime * 2.0 + aRand * 40.0);
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            float atten = clamp(0.10 / -mv.z, 0.35, 1.8);
            gl_PointSize = uSize * (0.4 + 0.6 * aRand) * atten;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uOpacity;
          varying float vRand;
          void main() {
            if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
            vec3 col = mix(vec3(0.910, 0.639, 0.239), vec3(0.960, 0.925, 0.860), vRand * 0.55);
            gl_FragColor = vec4(col, uOpacity * (0.35 + 0.45 * vRand));
          }`,
      });
      particles = new THREE.Points(geo, mat);
      particles.visible = false;
      spinner.add(particles);
    }

    // ------------------------------------------------ finish swap
    function findMats(substr) {
      return Object.entries(materials)
        .filter(([k]) => k.toLowerCase().includes(substr))
        .map(([, v]) => v);
    }

    function applyFinish(name) {
      const f = FINISHES[name];
      if (!f) return;
      for (const [group, spec] of Object.entries(f)) {
        for (const mat of findMats(group === "frame" ? "frame" : "back")) {
          const c = new THREE.Color(spec.color);
          const e = new THREE.Color(spec.emissive);
          gsap.to(mat.color, { r: c.r, g: c.g, b: c.b, duration: 0.6, ease: "power2.out" });
          if (mat.emissive) {
            gsap.to(mat.emissive, { r: e.r, g: e.g, b: e.b, duration: 0.6 });
            gsap.to(mat, { emissiveIntensity: spec.ei, duration: 0.6 });
          }
          gsap.to(mat, { metalness: spec.metalness, roughness: spec.roughness, duration: 0.6 });
        }
      }
    }

    function disintegrate(name) {
      if (transitioning || !particles || REDUCED) {
        applyFinish(name);
        return;
      }
      transitioning = true;
      particles.visible = true;
      const u = particleUniforms;

      const tl = gsap.timeline({
        onComplete: () => {
          particles.visible = false;
          transitioning = false;
        },
      });
      tl.to(u.uOpacity, { value: 1, duration: 0.18, ease: "power1.out" }, 0)
        .add(() => { meshGroup.visible = false; }, 0.02)
        .to(u.uProgress, { value: 1, duration: 1.5, ease: "power2.inOut" }, 0)
        .add(() => applyFinish(name), 0.75)
        .add(() => { meshGroup.visible = true; }, 1.42)
        .to(u.uOpacity, { value: 0, duration: 0.25, ease: "power1.in" }, 1.45);
    }

    const onFinish = (e) => disintegrate(e.detail);

    // ------------------------------------------------ GLB load
    const loader = new GLTFLoader();
    loader.load("/vanta_one.glb", (gltf) => {
      const phone = gltf.scene;
      const index = {};
      phone.traverse((o) => {
        if (!o.isMesh) return;
        index[o.name] = o;
        if (o.name === "Screen") {
          o.material = makeScreenMaterial();
        } else if (o.material) {
          materials[o.material.name || o.name] = o.material;
          if (o.material.isMeshStandardMaterial) {
            // keep reflections subdued — full env intensity reads as glare
            o.material.envMapIntensity = o.name.includes("Lens") ? 0.7 : 0.4;
          }
          if (o.name.startsWith("Antenna") && o.material.color) {
            o.material.color.set("#17150f");
            o.material.roughness = 0.75;
          }
          if ((o.material.name || "").includes("rim")) {
            rimMats.push(o.material);
          }
        }
        for (const [re, fn] of EXPLODE_OFFSETS) {
          if (re.test(o.name)) {
            const off = fn(o);
            parts.push({
              obj: o,
              base: o.position.clone(),
              off: new THREE.Vector3(...off),
              delay: (parts.length % 12) / 12 * 0.45,
            });
            break;
          }
        }
      });

      spinner.add(phone);
      meshGroup = phone;
      phone.scale.setScalar(1.08);
      phone.rotation.x = Math.PI / 2; // stand up: screen (glTF +Y) faces camera
      buildParticles(phone);

      // cache callout anchors once — avoids per-frame scene traversal
      for (const id of Object.keys(calloutEls)) {
        const found = phone.getObjectByName(calloutEls[id].def.anchor);
        if (found) calloutEls[id].anchor = found;
      }

      // intro: parts fly in along their explode axes, then settle
      intro.v = 0;
      gsap.to(intro, { v: 1, duration: 1.9, ease: "power3.inOut", delay: 0.25 });

      // rim signal pulse every 6s
      if (!REDUCED) {
        pulseTimer = setInterval(() => {
          if (document.hidden) return;
          for (const m of rimMats) {
            if (!m.emissiveIntensity) continue;
            gsap.fromTo(m, { emissiveIntensity: 3.4 },
              { emissiveIntensity: 1.8, duration: 1.8, ease: "power2.out" });
          }
        }, 6000);
      }

      window.dispatchEvent(new CustomEvent("vanta:ready"));
    }, undefined, () => {
      document.body.classList.add("no-webgl");
      window.dispatchEvent(new CustomEvent("vanta:ready"));
    });

    // ------------------------------------------------ drag + parallax
    const onPointerDown = (e) => {
      drag.active = true;
      drag.px = e.clientX;
      drag.py = e.clientY;
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      if (!drag.active) return;
      const dx = e.clientX - drag.px;
      const dy = e.clientY - drag.py;
      drag.px = e.clientX;
      drag.py = e.clientY;
      drag.userY += dx * 0.008;
      drag.userX += dy * 0.005;
      drag.vx = dx * 0.008;
      drag.vy = dy * 0.005;
    };
    const onPointerUp = () => {
      drag.active = false;
      canvas.classList.remove("is-dragging");
    };
    const onWindowPointerMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("vanta:finish", onFinish);

    // ------------------------------------------------ scroll poses
    gsap.registerPlugin(ScrollTrigger);
    const setPose = (p) => gsap.to(pose, { ...p, duration: 1.3, ease: "power3.out", overwrite: "auto" });

    const watch = (id, onEnter, onLeaveBack, extra = {}) => {
      ScrollTrigger.create({
        trigger: `#${id}`, start: extra.start || "top 60%",
        end: extra.end, scrub: extra.scrub,
        onEnter, onLeaveBack,
        onUpdate: extra.onUpdate,
      });
    };
    watch("one",
      () => setPose({ x: isDesktop() ? 0.05 : 0, y: 0, ry: 0.55, rx: 0.1, explode: 0, spin: 0.2, scale: 1, dim: 0 }),
      undefined);
    watch("colorways",
      () => setPose({ x: isDesktop() ? 0.06 : 0, y: 0.02, ry: 0.9, rx: 0.16, explode: 0, spin: 0.35, scale: 1, dim: 0 }),
      () => setPose({ x: isDesktop() ? 0.05 : 0, y: 0, ry: 0.55, rx: 0.1, explode: 0, spin: 0.2, scale: 1, dim: 0 }));
    watch("specs",
      () => setPose({ x: isDesktop() ? 0.13 : 0, y: 0.01, ry: 0.4, rx: 0.42, explode: 0, spin: 0, scale: 1, dim: 0 }),
      () => setPose({ x: isDesktop() ? 0.06 : 0, y: 0.02, ry: 0.9, rx: 0.16, explode: 0, spin: 0.35, scale: 1, dim: 0 }),
      { start: "top 70%", end: "bottom 40%", scrub: true,
        onUpdate: (self) => { pose.explode = self.progress; } });
    watch("camera",
      () => setPose({ x: isDesktop() ? -0.05 : 0, y: 0, ry: Math.PI - 0.55, rx: 0.08, explode: 0, spin: 0.1, scale: 1, dim: 0 }),
      () => setPose({ x: isDesktop() ? 0.13 : 0, y: 0.01, ry: 0.4, rx: 0.42, explode: 0, spin: 0, scale: 1, dim: 0 }));
    watch("reserve",
      () => setPose({ x: isDesktop() ? 0.12 : 0, y: 0.05, ry: 0.15, rx: 0, explode: 0, spin: 0, scale: 0.72, dim: 0.7 }),
      () => setPose({ x: isDesktop() ? -0.05 : 0, y: 0, ry: Math.PI - 0.55, rx: 0.08, explode: 0, spin: 0.1 }));

    // track which sections are on screen for callouts
    const sectionIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) activeSections.add(en.target.id);
        else activeSections.delete(en.target.id);
      });
    }, { threshold: 0.25 });
    ["one", "colorways", "specs", "camera", "reserve"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) sectionIO.observe(el);
    });

    // ------------------------------------------------ resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // ------------------------------------------------ main loop
    const clock = new THREE.Clock();
    const proj = new THREE.Vector3();
    let raf = 0;
    let canvasDim = 1;
    let lastIntro = -1;
    let lastEx = -1;
    let frameCount = 0;

    const smooth = (t) => t * t * (3 - 2 * t);

    function tick() {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (!drag.active) {
        drag.userY += drag.vx + pose.spin * dt;
        drag.userX += drag.vy;
        drag.vx *= 0.95;
        drag.vy *= 0.95;
      }
      drag.userX = THREE.MathUtils.clamp(drag.userX, -0.9, 0.9);

      const mobileX = isDesktop() ? pose.x : 0;
      root.position.x += (mobileX - root.position.x) * 0.06;
      root.position.y += ((pose.y + Math.sin(t * 0.8) * 0.004) - root.position.y) * 0.06;
      root.rotation.y += (pose.ry + drag.userY - root.rotation.y) * 0.08;
      root.rotation.x += (pose.rx + drag.userX - root.rotation.x) * 0.08;
      const targetScale = 1.08 * (pose.scale || 1);
      root.scale.x += (targetScale - root.scale.x) * 0.06;
      root.scale.y = root.scale.z = root.scale.x;
      const targetDim = 1 - (pose.dim || 0);
      if (Math.abs(canvasDim - targetDim) > 0.002) {
        canvasDim += (targetDim - canvasDim) * 0.08;
        canvas.style.opacity = canvasDim.toFixed(3);
      }

      rimAmber.position.x = -0.4 + Math.sin(t * 0.4) * 0.12 + mouse.x * 0.08;

      screenUniforms.uTime.value += dt * (REDUCED ? 0.15 : 1);
      if (particleUniforms) particleUniforms.uTime.value = t;

      // part positions: intro assembly + scroll explode — skip when settled
      const exScroll = smooth(pose.explode);
      if (Math.abs(intro.v - lastIntro) > 0.0004 || Math.abs(exScroll - lastEx) > 0.0004) {
        lastIntro = intro.v;
        lastEx = exScroll;
        for (const p of parts) {
          const pi = smooth(THREE.MathUtils.clamp((intro.v - p.delay) / (1 - p.delay), 0, 1));
          const e = Math.max(1 - pi, exScroll);
          p.obj.position.set(
            p.base.x + p.off.x * e,
            p.base.y + p.off.y * e,
            p.base.z + p.off.z * e,
          );
        }
      }

      // callouts track their anchors (desktop only — cached anchors, throttled)
      frameCount++;
      const showCallouts = isDesktop();
      for (const id of Object.keys(calloutEls)) {
        const c = calloutEls[id];
        const anchor = c.anchor;
        const visible = showCallouts && anchor && activeSections.has(c.def.section) && intro.v > 0.92 && !transitioning;
        if (!visible) {
          if (c.shown) { c.el.style.opacity = "0"; c.shown = false; }
          continue;
        }
        if (!c.shown) { c.el.style.opacity = "1"; c.shown = true; }
        proj.set(c.def.local[0], c.def.local[1], c.def.local[2]);
        anchor.localToWorld(proj);
        proj.project(camera);
        if (proj.z > 1) {
          c.el.style.opacity = "0";
          c.shown = false;
          continue;
        }
        const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;
        const flip = sx > window.innerWidth * 0.72;
        const lx = flip ? -150 : 14;
        c.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        c.line.setAttribute("x2", String(lx));
        c.line.setAttribute("y2", "-1");
        const tag = c.el.querySelector(".leader-tag");
        tag.style.transform = `translate(${flip ? -164 : 14}px, -10px)`;
        tag.style.textAlign = flip ? "right" : "left";
      }

      try {
        composer.render();
      } catch (err) {
        showToast("render: " + err.message);
      }
    }
    tick();

    // ------------------------------------------------ cleanup (StrictMode double-mount)
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(pulseTimer);
      window.removeEventListener("error", onGlobalError);
      toast.remove();
      ScrollTrigger.getAll().forEach((st) => st.kill());
      sectionIO.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("vanta:finish", onFinish);
      layer.querySelectorAll(".pointer-events-none.absolute").forEach((n) => n.remove());
      renderer.dispose();
      pmrem.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="stage"
        aria-label="Interactive 3D model of the Vanta One phone. Drag to rotate."
        className="fixed inset-0 w-full h-full block touch-pan-y cursor-grab active:cursor-grabbing"
      />
      <video
        className="fallback-video fixed inset-0 w-full h-full object-contain"
        src="/vanta_turntable.mp4"
        poster="/vanta_poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-label="Rotating view of the Vanta One phone"
      />
      <div ref={layerRef} className="fixed inset-0 z-20 pointer-events-none" aria-hidden="true" />
    </>
  );
}
