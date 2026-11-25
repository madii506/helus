// The helus world: a voxel ice planet that assembles from scattered cubes, holders orbiting it on three rings
// (1x, 2x, 3x), payout pulses, and snipers that burn up when they hit the atmosphere. The page drives it with
// setStory(step, k) and setScroll(p); it runs on its own clock otherwise.
import * as THREE from '/vendor/three.module.min.js';

export function createOrbit(canvas, { mobile = false, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const world = new THREE.Group(); scene.add(world);
  const sys = new THREE.Group(); world.add(sys);                           // the planet and its orbits, tilted
  sys.rotation.set(0.32, 0, -0.18);

  scene.add(new THREE.AmbientLight(0x9cc4ff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb8ff, 1.6); rim.position.set(5, -2, -6); scene.add(rim);

  // ---------- the planet: voxels that fly in and settle ----------
  const R = mobile ? 8 : 10, VS = 1 / R;
  const cells = [];
  for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) {
    const d = x * x + y * y + z * z; if (d > R * R + 0.5 || d < (R - 2.2) * (R - 2.2)) continue;   // a shell is enough
    cells.push([x, y, z]);
  }
  const geo = new THREE.BoxGeometry(VS * 0.9, VS * 0.9, VS * 0.9);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  const planet = new THREE.InstancedMesh(geo, mat, cells.length); sys.add(planet);
  const C1 = new THREE.Color('#9fd2ff'), C2 = new THREE.Color('#e4f2ff'), C3 = new THREE.Color('#5a97e8'), tmpC = new THREE.Color();
  const tgt = [], from = [], delay = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const craters = Array.from({ length: 7 }, () => new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize());
  cells.forEach(([x, y, z], i) => {
    const p = new THREE.Vector3(x, y, z).multiplyScalar(VS); tgt.push(p);
    const n = p.clone().normalize();
    const s = n.clone().multiplyScalar(rnd(4, 9)).add(new THREE.Vector3(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2))); from.push(s);
    delay.push(Math.max(0, (y + R) / (2 * R) * 0.55 + rnd(0, 0.35)));
    const band = Math.floor((y + R) / 2.4) % 2;
    tmpC.copy(band ? C1 : C2);
    if (craters.some(c => n.distanceTo(c) < 0.22)) tmpC.copy(C3);
    tmpC.offsetHSL(0, 0, rnd(-0.03, 0.03)); planet.setColorAt(i, tmpC);
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  let built = 0;
  function placePlanet(t) {                                                // t: seconds since the intro started
    let done = true;
    for (let i = 0; i < tgt.length; i++) {
      let k = Math.min(1, Math.max(0, (t - delay[i]) / 1.4)); if (k < 1) done = false;
      k = 1 - Math.pow(1 - k, 3);
      P.lerpVectors(from[i], tgt[i], k); S.setScalar(0.35 + 0.65 * k); M.compose(P, Q, S); planet.setMatrixAt(i, M);
    }
    planet.instanceMatrix.needsUpdate = true; return done;
  }
  placePlanet(reduced ? 99 : 0);

  // the atmosphere: a soft fresnel shell
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.18, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { uC: { value: new THREE.Color('#7cc0ff') }, uA: { value: 0.0 }, uHot: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uA, uHot; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); vec3 c = mix(uC, vec3(1.0,0.55,0.35), uHot); gl_FragColor = vec4(c*f*1.6, f*uA); }',
  }));
  sys.add(atmo);

  // ---------- orbits: three dotted rings, 1x, 2x, 3x ----------
  const RADII = [1.75, 2.3, 2.9];
  const ringMats = [];
  RADII.forEach((r, j) => {
    const n = Math.round(r * 64), pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts[i * 3] = Math.cos(a) * r; pts[i * 3 + 2] = Math.sin(a) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const m = new THREE.PointsMaterial({ color: 0x9cd0ff, size: mobile ? 0.03 : 0.024, transparent: true, opacity: 0.0, depthWrite: false });
    ringMats.push(m); sys.add(new THREE.Points(g, m));
  });

  // holders: pods on the rings
  const PODS = mobile ? 26 : 38;
  const podGeo = new THREE.BoxGeometry(0.075, 0.075, 0.075);
  const pods = new THREE.InstancedMesh(podGeo, new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x2a5fa8, emissiveIntensity: 0.35 }), PODS); sys.add(pods);
  const pod = Array.from({ length: PODS }, (_, i) => ({ ring: i % 3, a: Math.random() * Math.PI * 2, sp: 0, glow: 0, spin: rnd(0, 6), y: rnd(-0.05, 0.05) }));
  pod.forEach(p => { p.sp = 0.32 / Math.pow(RADII[p.ring], 1.5); });
  const PODC = new THREE.Color('#dcefff'), GLOW = new THREE.Color('#ffffff');
  // the one that sells: it leaves the orbit and falls
  const faller = { on: false, t: 0, a: 0, r: RADII[1] };

  // ---------- snipers: ember cubes that burn up in the atmosphere ----------
  const NC = 18;
  const comet = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0xff7d5c }), NC); sys.add(comet);
  const TAIL = 6;
  const tail = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xff9a74, transparent: true, opacity: 0.55, depthWrite: false }), NC * TAIL); sys.add(tail);
  const cs = Array.from({ length: NC }, () => ({ live: false, p: new THREE.Vector3(), v: new THREE.Vector3(), hist: [] }));
  const SPARKS = 420, sp = new Float32Array(SPARKS * 3), sc = new Float32Array(SPARKS * 3), sv = [], sl = new Float32Array(SPARKS);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sys.add(sparks);
  for (let i = 0; i < SPARKS; i++) { sv.push(new THREE.Vector3()); sp[i * 3 + 1] = 999; }
  let sparkI = 0, hot = 0;
  function burst(at, n = 26) {
    for (let k = 0; k < n; k++) {
      const i = sparkI++ % SPARKS; sp[i * 3] = at.x; sp[i * 3 + 1] = at.y; sp[i * 3 + 2] = at.z;
      sv[i].set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.3, 1.1)).add(at.clone().normalize().multiplyScalar(0.4)); sl[i] = 1;
    }
    hot = Math.min(1, hot + 0.35); stats.bounty += rnd(0.4, 2.2);
  }
  function spawnComet() {
    const c = cs.find(x => !x.live); if (!c) return;
    const dir = new THREE.Vector3(rnd(-1, 1), rnd(-0.4, 0.6), rnd(-1, 1)).normalize();
    c.p.copy(dir).multiplyScalar(rnd(6, 8)); c.v.copy(dir).multiplyScalar(-rnd(2.2, 3.2)).add(new THREE.Vector3(rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3)));
    c.hist = []; c.live = true;
  }

  // ---------- payout pulse: a ring of light that sweeps out through the orbits ----------
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 128), pulseMat); pulseRing.rotation.x = -Math.PI / 2; sys.add(pulseRing);
  let pulseT = -1;
  function pulse() { pulseT = 0; stats.paid += stats.bounty * 0.4; stats.bounty *= 0.6; stats.next = 600; }

  // stars
  const NS = mobile ? 700 : 1400, st = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(30, 70)); st.set([v.x, v.y, v.z], i * 3); }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(st, 3));
  const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xbcd8ff, size: 0.16, transparent: true, opacity: 0.7, depthWrite: false })); scene.add(stars);

  // ---------- state the page drives ----------
  const stats = { bounty: 0, paid: 0, next: 600, fee: 99 };
  let step = -1, stepK = 0, scrollP = 0, introT = reduced ? 99 : 0, started = false, last = performance.now(), running = true, cometTimer = 0, pulseTimer = 5, simT = 0;
  const camPos = new THREE.Vector3(0, 0.4, 9.5), camWant = camPos.clone(), look = new THREE.Vector3(), lookWant = new THREE.Vector3();
  let worldX = 0, worldXWant = 0;
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (started && built < 1) { introT += dt; if (placePlanet(introT)) built = 1; }
    simT += dt;

    // where the camera and the planet sit, by page position
    const portrait = innerWidth < innerHeight * 0.9;
    const side = portrait ? 0 : 1.75;
    if (step < 0) { camWant.set(0, 0.5, portrait ? 13.5 : 9.6); worldXWant = portrait ? 0 : 2.15; }
    else {
      const shots = [[0, 0.6, 8.6], [0, 1.4, 7.4], [0, 2.6, 8.4], [0, 3.6, 9.6], [0, 4.6, 10.6], [0, 2.4, 8.2]];
      const a = shots[step], b = shots[Math.min(5, step + 1)], k = stepK * stepK * (3 - 2 * stepK) * 0.35;
      camWant.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, (a[2] + (b[2] - a[2]) * k) * (portrait ? 1.3 : 1)); worldXWant = side;
    }
    if (scrollP > 0) { camWant.y += scrollP * 0.6; }
    camPos.lerp(camWant, Math.min(1, dt * 2.2)); worldX += (worldXWant - worldX) * Math.min(1, dt * 2.2);
    camera.position.copy(camPos); lookWant.set(0, portrait ? 0.6 : 0, 0); look.lerp(lookWant, Math.min(1, dt * 2)); camera.lookAt(look);
    world.position.x = worldX; world.position.y = portrait ? (step < 0 ? 2.6 : 0.9) : 0;   // on phones the planet rides above the words
    sys.rotation.y += dt * 0.05; stars.rotation.y += dt * 0.004;

    // rings fade in once the planet is built
    const ringA = Math.min(1, built ? 1 : introT / 3);
    ringMats.forEach((m, j) => { const focus = step === 4 ? (j === 2 ? 1 : 0.55) : 1; m.opacity = 0.5 * ringA * focus; });
    atmo.material.uniforms.uA.value = 0.55 * Math.min(1, introT / 2.2);
    hot = Math.max(0, hot - dt * 0.8); atmo.material.uniforms.uHot.value = hot;

    // pods
    const pulseR = pulseT >= 0 ? 1 + pulseT * 3.4 : -1;
    for (let i = 0; i < PODS; i++) {
      const p = pod[i]; p.a += p.sp * dt * (reduced ? 0.3 : 1);
      const r = RADII[p.ring];
      if (pulseR > 0 && Math.abs(pulseR - r) < 0.18) p.glow = 1;
      p.glow = Math.max(0, p.glow - dt * 1.4);
      let s = (step === 4 ? 0.8 + p.ring * 0.25 : 1) * Math.min(1, ringA * 1.4) * (1 + p.glow * 0.6);
      if (faller.on && i === 0) s = 0;
      P.set(Math.cos(p.a) * r, p.y, Math.sin(p.a) * r); Q.setFromEuler(new THREE.Euler(p.spin + simT, p.spin * 0.7 + simT * 0.6, 0)); S.setScalar(s); M.compose(P, Q, S); pods.setMatrixAt(i, M);
      tmpC.copy(PODC).lerp(GLOW, p.glow); if (step === 4 && p.ring === 2) tmpC.lerp(new THREE.Color('#9cd0ff'), 0.4); pods.setColorAt(i, tmpC);
    }
    pods.instanceMatrix.needsUpdate = true; if (pods.instanceColor) pods.instanceColor.needsUpdate = true;

    // the faller (step 6): leaves orbit, spirals down and burns
    if (step === 5 && !faller.on && stepK > 0.15) { faller.on = true; faller.t = 0; faller.a = pod[0].a; faller.r = RADII[pod[0].ring]; }
    if (step !== 5 && faller.on && faller.t > 3) faller.on = false;
    if (faller.on) {
      faller.t += dt; faller.a += dt * 0.8; faller.r = Math.max(1.05, faller.r - dt * 0.55);
      const fp = new THREE.Vector3(Math.cos(faller.a) * faller.r, -faller.t * 0.12, Math.sin(faller.a) * faller.r);
      if (faller.r <= 1.2 && !faller.burnt) { faller.burnt = true; burst(fp, 40); }
      if (faller.t > 4) { faller.on = false; faller.burnt = false; }
      M.compose(fp, Q, S.setScalar(faller.burnt ? 0 : 1)); comet.setMatrixAt(NC - 1, M);
    }

    // snipers
    const rate = step === 1 ? 5.5 : step === 0 || step === 2 ? 1.2 : step < 0 ? 0.5 : 0.25;
    cometTimer -= dt * rate; if (started && built && cometTimer <= 0 && !reduced) { spawnComet(); cometTimer = rnd(0.6, 1.4); }
    for (let i = 0; i < NC - 1; i++) {
      const c = cs[i];
      if (!c.live) { M.compose(P.set(0, 999, 0), Q, S.setScalar(0)); comet.setMatrixAt(i, M); for (let k = 0; k < TAIL; k++) tail.setMatrixAt(i * TAIL + k, M); continue; }
      c.hist.unshift(c.p.clone()); if (c.hist.length > TAIL * 2) c.hist.pop();
      c.p.addScaledVector(c.v, dt);
      if (c.p.length() < 1.2) { c.live = false; burst(c.p); continue; }
      M.compose(c.p, Q, S.setScalar(1)); comet.setMatrixAt(i, M);
      for (let k = 0; k < TAIL; k++) { const h = c.hist[k * 2] || c.p; M.compose(h, Q, S.setScalar(1 - k / TAIL)); tail.setMatrixAt(i * TAIL + k, M); }
    }
    if (!faller.on) { M.compose(P.set(0, 999, 0), Q, S.setScalar(0)); comet.setMatrixAt(NC - 1, M); }
    comet.instanceMatrix.needsUpdate = true; tail.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < SPARKS; i++) {
      if (sl[i] <= 0) { sc[i * 3] = sc[i * 3 + 1] = sc[i * 3 + 2] = 0; continue; }
      sl[i] -= dt * 1.3; sp[i * 3] += sv[i].x * dt; sp[i * 3 + 1] += sv[i].y * dt; sp[i * 3 + 2] += sv[i].z * dt; sv[i].multiplyScalar(1 - dt * 1.6);
      const l = Math.max(0, sl[i]); sc[i * 3] = 1.0 * l; sc[i * 3 + 1] = 0.5 * l * l + 0.1 * l; sc[i * 3 + 2] = 0.3 * l * l;
    }
    sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true;

    // payouts: on their own in the hero, on cue in the story
    pulseTimer -= dt; if (built && pulseTimer <= 0 && step !== 1) { pulse(); pulseTimer = step === 3 ? 2.6 : 7; }
    if (pulseT >= 0) { pulseT += dt * 0.9; const r = 1 + pulseT * 3.4; pulseRing.scale.setScalar(r); pulseMat.opacity = Math.max(0, 0.55 * (1 - pulseT)); if (pulseT > 1) pulseT = -1; }
    stats.next = Math.max(0, stats.next - dt * 60);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    start() { started = true; },
    setStory(s, k) { if (s !== step) { if (s === 3) pulseTimer = 0.4; step = s; } stepK = k; },
    clearStory() { step = -1; },
    setScroll(p) { scrollP = p; },
    setRunning(r) { running = r; last = performance.now(); },
    pulse, stats, get built() { return built; },
  };
}
