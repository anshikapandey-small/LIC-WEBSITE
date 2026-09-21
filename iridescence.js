/**
 * createIridescence(container, options)
 *
 * Renders the React Bits "Iridescence" shader into `container` using raw WebGL.
 * No dependencies. The container must have a size.
 *
 * Options
 *   color         [r, g, b] with values 0-1, or a hex string like "#4b80ec"
 *   speed         animation speed multiplier                  (default 1)
 *   amplitude     strength of the mouse-driven offset         (default 0.1)
 *   mouseReact    react to the pointer                        (default true)
 *   mouseTarget   element that receives mousemove events      (default container)
 *   dpr           canvas pixel ratio; 1 is fastest            (default 1)
 *
 * Returns { update(options), pause(), resume(), destroy() }
 */
function createIridescence(container, options) {
  var opts = Object.assign({
    color: [1, 1, 1],
    speed: 1.0,
    amplitude: 0.1,
    mouseReact: true,
    mouseTarget: container,
    dpr: 1
  }, options);

  var VERTEX = [
    'attribute vec2 uv;',
    'attribute vec2 position;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAGMENT = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    '',
    'uniform float uTime;',
    'uniform vec3 uColor;',
    'uniform vec3 uResolution;',
    'uniform vec2 uMouse;',
    'uniform float uAmplitude;',
    'uniform float uSpeed;',
    '',
    'varying vec2 vUv;',
    '',
    'void main() {',
    '  float mr = min(uResolution.x, uResolution.y);',
    '  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;',
    '',
    '  uv += (uMouse - vec2(0.5)) * uAmplitude;',
    '',
    '  float d = -uTime * 0.5 * uSpeed;',
    '  float a = 0.0;',
    '  for (float i = 0.0; i < 8.0; ++i) {',
    '    a += cos(i - d - a * uv.x);',
    '    d += sin(uv.y * i + a);',
    '  }',
    '  d += uTime * 0.5 * uSpeed;',
    '  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);',
    '  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var noop = { update: function () {}, pause: function () {}, resume: function () {}, destroy: function () {} };

  var canvas = document.createElement('canvas');
  var gl = canvas.getContext('webgl', { alpha: false, antialias: false }) ||
           canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('Iridescence: WebGL is not available in this browser.');
    return noop;
  }

  // ---- helpers -----------------------------------------------------------
  function parseColor(c) {
    if (typeof c === 'string') {
      var hex = c.replace('#', '');
      if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
      var n = parseInt(hex, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return c;
  }

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Iridescence shader error: ' + log);
    }
    return shader;
  }

  // ---- program -----------------------------------------------------------
  var program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Iridescence link error: ' + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // One oversized triangle that covers the whole screen.
  function bindAttribute(name, data) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return buffer;
  }
  var positionBuffer = bindAttribute('position', [-1, -1, 3, -1, -1, 3]);
  var uvBuffer = bindAttribute('uv', [0, 0, 2, 0, 0, 2]);

  var u = {
    time: gl.getUniformLocation(program, 'uTime'),
    color: gl.getUniformLocation(program, 'uColor'),
    resolution: gl.getUniformLocation(program, 'uResolution'),
    mouse: gl.getUniformLocation(program, 'uMouse'),
    amplitude: gl.getUniformLocation(program, 'uAmplitude'),
    speed: gl.getUniformLocation(program, 'uSpeed')
  };

  function applyUniforms() {
    var c = parseColor(opts.color);
    gl.uniform3f(u.color, c[0], c[1], c[2]);
    gl.uniform1f(u.amplitude, opts.amplitude);
    gl.uniform1f(u.speed, opts.speed);
  }
  applyUniforms();
  gl.uniform2f(u.mouse, 0.5, 0.5);

  // ---- sizing ------------------------------------------------------------
  var STATIC_TIME = 3.0;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var staticFrame = reducedMotion.matches;
  var paused = false;
  var rafId = 0;

  function draw(seconds) {
    gl.uniform1f(u.time, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    var w = Math.max(1, Math.round(container.clientWidth * opts.dpr));
    var h = Math.max(1, Math.round(container.clientHeight * opts.dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform3f(u.resolution, w, h, w / h);
    // Resizing clears the canvas, so repaint straight away.
    if (staticFrame || paused) draw(STATIC_TIME);
  }

  var resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
  } else {
    window.addEventListener('resize', resize);
  }

  // ---- pointer -----------------------------------------------------------
  var listeningTarget = null;

  function onMouseMove(e) {
    var rect = container.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width;
    var y = 1.0 - (e.clientY - rect.top) / rect.height;
    gl.uniform2f(u.mouse, x, y);
  }

  function syncMouseListener() {
    if (listeningTarget) {
      listeningTarget.removeEventListener('mousemove', onMouseMove);
      listeningTarget = null;
    }
    if (opts.mouseReact) {
      listeningTarget = opts.mouseTarget || container;
      listeningTarget.addEventListener('mousemove', onMouseMove);
    } else {
      gl.uniform2f(u.mouse, 0.5, 0.5);
    }
  }
  syncMouseListener();

  // ---- render loop -------------------------------------------------------
  function frame(t) {
    rafId = requestAnimationFrame(frame);
    draw(t * 0.001);
  }

  function start() {
    cancelAnimationFrame(rafId);
    if (paused) return;
    if (staticFrame) {
      draw(STATIC_TIME); // one still frame for people who prefer reduced motion
    } else {
      rafId = requestAnimationFrame(frame);
    }
  }

  function onMotionPreferenceChange(e) {
    staticFrame = e.matches;
    start();
  }
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
  } else if (reducedMotion.addListener) {
    reducedMotion.addListener(onMotionPreferenceChange);
  }

  container.appendChild(canvas);
  resize();
  start();

  // ---- public API --------------------------------------------------------
  return {
    /** Change options live without rebuilding the WebGL context. */
    update: function (next) {
      var prevDpr = opts.dpr;
      Object.assign(opts, next);
      applyUniforms();
      syncMouseListener();
      if (opts.dpr !== prevDpr) resize();
      if (staticFrame) draw(STATIC_TIME);
    },

    /** Stop drawing (e.g. while scrolled out of view) to save battery. */
    pause: function () {
      paused = true;
      cancelAnimationFrame(rafId);
    },

    /** Continue drawing after pause(). */
    resume: function () {
      if (!paused) return;
      paused = false;
      start();
    },

    /** Stop the animation and release everything. */
    destroy: function () {
      cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', resize);
      if (listeningTarget) listeningTarget.removeEventListener('mousemove', onMouseMove);
      if (reducedMotion.removeEventListener) {
        reducedMotion.removeEventListener('change', onMotionPreferenceChange);
      } else if (reducedMotion.removeListener) {
        reducedMotion.removeListener(onMotionPreferenceChange);
      }
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(uvBuffer);
      gl.deleteProgram(program);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  };
}
