// 3D view: minimal WebGL renderer (one solid pass + one blended glass pass) with an orbit camera.
(function () {
  const A = window.App, V3 = A.v3 = { yaw: -0.6, pitch: 0.5, dist: 12, target: [0, 1.4, 0], gl: null, mesh: null, dirty: true };
  // Lit surfaces use the sun direction L; with sh>0.5 the same geometry is flattened onto the ground along L (planar shadow).
  const VS = 'attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 m;uniform vec3 L;uniform float sh;varying vec4 vc;void main(){vec3 q=p;if(sh>.5){q.x-=L.x*p.y/L.y;q.z-=L.z*p.y/L.y;q.y=.004;vc=vec4(0.,0.,0.,.38);}else{float l=.40+.60*max(dot(normalize(n),L),0.);vc=vec4(c.rgb*l,c.a);}gl_Position=m*vec4(q,1.);}';
  const FS = 'precision mediump float;varying vec4 vc;void main(){gl_FragColor=vc;}';
  let prog, bufs = {}, loc = {}, raf = 0;

  // ---------- tiny matrix helpers (column-major) ----------
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; };
  const look = (e, t, up) => { let z = [e[0] - t[0], e[1] - t[1], e[2] - t[2]]; const nz = Math.hypot(...z); z = z.map(v => v / nz);
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]; const nx = Math.hypot(...x); x = x.map(v => v / nx);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]], d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -d(x, e), -d(y, e), -d(z, e), 1]); };

  V3.init = cv => {
    if (V3.gl) return true; const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, stencil: true }) || cv.getContext('experimental-webgl'); if (!gl) return false;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    loc = { p: gl.getAttribLocation(prog, 'p'), n: gl.getAttribLocation(prog, 'n'), c: gl.getAttribLocation(prog, 'c'), m: gl.getUniformLocation(prog, 'm'), L: gl.getUniformLocation(prog, 'L'), sh: gl.getUniformLocation(prog, 'sh') };
    bufs = { base: gl.createBuffer(), solid: gl.createBuffer(), glass: gl.createBuffer() }; V3.gl = gl; V3.cv = cv; return true;
  };
  V3.rebuild = () => { V3.mesh = A.buildMesh(A.doc); V3.dirty = false; const gl = V3.gl; if (!gl) return;
    ['base', 'solid', 'glass'].forEach(k => { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[k]); gl.bufferData(gl.ARRAY_BUFFER, V3.mesh[k], gl.STATIC_DRAW); }); };
  V3.preset = name => { const b = V3.mesh && V3.mesh.bounds; if (b) { const w = b.x1 - b.x0, h = b.y1 - b.y0, hh = Math.max(...A.doc.items.filter(i => i.t === 'wall').map(i => i.h), 2.8);
      V3.target = [(b.x0 + b.x1) / 2, hh / 3, -(b.y0 + b.y1) / 2]; V3.dist = Math.max(Math.hypot(w, h) * 1.3, 5); } else { V3.target = [0, 1, 0]; V3.dist = 10; }
    if (name === 'top') { V3.yaw = 0; V3.pitch = Math.PI / 2 - 0.001; V3.dist *= 0.9; } else if (name === 'front') { V3.yaw = 0; V3.pitch = 0.12; } else { V3.yaw = -0.6; V3.pitch = 0.5; } V3.draw(); };
  V3.matrix = () => { const cv = V3.cv, asp = cv.width / Math.max(1, cv.height), cp = Math.cos(V3.pitch), t = V3.target,
      eye = [t[0] + V3.dist * cp * Math.sin(V3.yaw), t[1] + V3.dist * Math.sin(V3.pitch), t[2] + V3.dist * cp * Math.cos(V3.yaw)];
    return mul(persp(0.8, asp, Math.max(0.05, V3.dist / 100), V3.dist * 20), look(eye, t, [0, 1, 0])); };
  V3.draw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; V3.render(); }); };
  V3.render = () => { const gl = V3.gl; if (!gl || A.mode !== '3d') return; if (V3.dirty) V3.rebuild();
    const r = A.doc.render, sun = A.sunAt(r.hour), k = Math.max(0, Math.min(1, (sun.el * 180 / Math.PI - 8) / 35)), sky = [0.93 + (0.52 - 0.93) * k, 0.62 + (0.74 - 0.62) * k, 0.45 + (0.93 - 0.45) * k]; V3.clear = sky;
    gl.viewport(0, 0, V3.cv.width, V3.cv.height); gl.clearColor(sky[0], sky[1], sky[2], 1); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.useProgram(prog); gl.uniformMatrix4fv(loc.m, false, V3.matrix()); gl.uniform3fv(loc.L, sun.dir);
    const pass = (buf, data, blend, shadow) => { if (!data.length) return; gl.uniform1f(loc.sh, shadow ? 1 : 0); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      [['p', 3, 0], ['n', 3, 3], ['c', 4, 6]].forEach(([a, n, o]) => { gl.enableVertexAttribArray(loc[a]); gl.vertexAttribPointer(loc[a], n, gl.FLOAT, false, 40, o * 4); });
      if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
      if (shadow) { gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.NOTEQUAL, 1, 1); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); }
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 10); gl.disable(gl.STENCIL_TEST); gl.depthMask(true); };
    pass(bufs.base, V3.mesh.base, false, false);
    if (r.shadows) pass(bufs.solid, V3.mesh.solid, true, true);   // shadows are drawn once per pixel thanks to the stencil
    pass(bufs.solid, V3.mesh.solid, false, false); pass(bufs.glass, V3.mesh.glass, true, false); };
  // Share of pixels that differ from the sky colour (used by the tests to confirm something was drawn).
  V3.coverage = () => { const gl = V3.gl; V3.render(); const w = V3.cv.width, h = V3.cv.height, px = new Uint8Array(w * h * 4), s = V3.clear.map(v => v * 255); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); let n = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - s[0]) + Math.abs(px[i + 1] - s[1]) + Math.abs(px[i + 2] - s[2]) > 30) n++; return n / (w * h); };
  // Picture at `scale` times the screen size (the canvas is restored right after the bitmap is captured).
  V3.snapshot = (scale, cb) => { const cv = V3.cv, w = cv.width, h = cv.height; cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); V3.render(); cv.toBlob(cb, 'image/png'); cv.width = w; cv.height = h; V3.draw(); };
  V3.resize = () => { const cv = V3.cv; if (!cv) return; const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr)); V3.draw(); };

  // ---------- camera input: drag = orbit, Shift/right/middle drag = pan, wheel / pinch = zoom ----------
  V3.initInput = cv => {
    const ptrs = new Map(); let last = null, gest = null;
    const pan = (dx, dy) => { const k = V3.dist * 0.0016, r = [Math.cos(V3.yaw), 0, -Math.sin(V3.yaw)], f = [-Math.sin(V3.yaw), 0, -Math.cos(V3.yaw)];
      V3.target = [V3.target[0] - r[0] * dx * k - f[0] * dy * k, V3.target[1], V3.target[2] - r[2] * dx * k - f[2] * dy * k]; };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); last = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 || e.button === 1 };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, dist: V3.dist, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; } });
    cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size >= 2 && gest) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; V3.dist = Math.max(1, Math.min(2000, gest.dist * gest.d / d)); pan(c[0] - gest.c[0], c[1] - gest.c[1]); gest.c = c; V3.draw(); return; }
      if (!last) return; const dx = e.clientX - last.x, dy = e.clientY - last.y; last.x = e.clientX; last.y = e.clientY;
      if (last.pan) pan(dx, dy); else { V3.yaw -= dx * 0.008; V3.pitch = Math.max(0.02, Math.min(Math.PI / 2 - 0.001, V3.pitch + dy * 0.008)); } V3.draw(); });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) gest = null; if (!ptrs.size) last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); V3.dist = Math.max(1, Math.min(2000, V3.dist * Math.exp(e.deltaY * 0.0012))); V3.draw(); }, { passive: false });
  };
  A.on(() => { V3.dirty = true; if (A.mode === '3d') V3.draw(); });
})();
