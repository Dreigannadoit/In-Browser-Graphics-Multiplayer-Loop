// Cartoon ink outline (+ shadow tint) as a postprocessing Effect. Depth-only (no extra normal pass) for the lines themselves.
//
// How the line works: take the *inverse* view distance (1/z) of a pixel and its 4 neighbours. 1/z is exactly linear across any flat
// surface, so its second difference (neighbours − 2·centre) is ZERO on walls/floors/ramps and only lights up where the
// surface bends (creases / corners) or the depth jump (silhouettes). Dividing by the centre value makes the threshold
// distance-independent. Pixels on the FAR side of a big depth jump are skipped, so silhouettes get a one-sided line
// instead of a double-thick one.
//
// Different ink per surface type: the line above is tuned for big flat map surfaces. A small low-poly character or a glowing
// sphere needs a thinner, calmer line, so there are three "styles": GEOMETRY (the default), ENEMY and POINT (grapple points).
// To know which style a pixel gets, enemies and grapple points are rendered into two small ID buffers (layers in layers.js, drawn
// with a depth material) in this effect's update(). The shader compares each buffer's depth with the scene depth, so an enemy
// hidden behind a wall does not claim the wall's pixels. Each style has its own colour, strength, width and threshold (OUTLINE in
// gameConfig.js); applyConfig() copies them into the uniforms.
//
// Line thickness follows distance continuously: `width` px at widthRefDist metres, thicker when closer (up to maxWidth), thinner
// when farther (down to minWidth), with the falloff exponent `widthFalloff` (1 = true perspective, 0 = constant).
import { Effect, EffectAttribute } from 'postprocessing'
import {
  BasicDepthPacking,
  Color,
  HalfFloatType,
  MeshDepthMaterial,
  NearestFilter,
  RGBAFormat,
  Uniform,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three'
import { wrapEffect } from '@react-three/postprocessing'
import { OUTLINE_LAYER } from './layers'

const fragmentShader = /* glsl */ `
  // style params are vec4(strength, width px, min width px, threshold)
  uniform vec3 uLineColor;
  uniform vec4 uGeo;
  uniform vec3 uEnemyColor;
  uniform vec4 uEnemy;
  uniform vec3 uPointColor;
  uniform vec4 uPoint;
  uniform vec3 uMaxWidth; // x geometry, y enemy, z point: thickest the line gets up close (px)
  uniform sampler2D uEnemyDepth;
  uniform sampler2D uPointDepth;
  uniform float uWidthRef;
  uniform float uFalloff;
  uniform vec2 uFade;
  uniform vec2 uTexel;
  uniform vec3 uShadowColor;
  uniform float uShadowLift;
  uniform float uShadowRange;

  // 1 / distance from the camera (view-space depth is negative in three.js)
  float invDist(const in vec2 uv) {
    float z = -perspectiveDepthToViewZ(readDepth(uv), cameraNear, cameraFar);
    return 1.0 / max(z, 1e-3);
  }

  // The ID buffers hold (1 - depth), cleared to 0 = nothing drawn there. 1 when the layer's surface at this pixel is at the
  // same distance as the scene's visible surface (so a wall in front of an enemy hides it).
  float enemyHit(const in vec2 uv, const in float dist) {
    float v = texture2D(uEnemyDepth, uv).r;
    if (v <= 0.0) return 0.0;
    float z = -perspectiveDepthToViewZ(1.0 - v, cameraNear, cameraFar);
    return step(abs(z - dist), 0.03 * dist + 0.05);
  }
  float pointHit(const in vec2 uv, const in float dist) {
    float v = texture2D(uPointDepth, uv).r;
    if (v <= 0.0) return 0.0;
    float z = -perspectiveDepthToViewZ(1.0 - v, cameraNear, cameraFar);
    return step(abs(z - dist), 0.03 * dist + 0.05);
  }
  // centre + 4 neighbours: the ID buffers are not antialiased like the scene, so grow the mask by one pixel to avoid edge flicker
  float enemyMask(const in vec2 uv, const in float dist) {
    vec2 t = uTexel;
    float m = enemyHit(uv, dist);
    m = max(m, enemyHit(uv + vec2(t.x, 0.0), dist));
    m = max(m, enemyHit(uv - vec2(t.x, 0.0), dist));
    m = max(m, enemyHit(uv + vec2(0.0, t.y), dist));
    m = max(m, enemyHit(uv - vec2(0.0, t.y), dist));
    return m;
  }
  float pointMask(const in vec2 uv, const in float dist) {
    vec2 t = uTexel;
    float m = pointHit(uv, dist);
    m = max(m, pointHit(uv + vec2(t.x, 0.0), dist));
    m = max(m, pointHit(uv - vec2(t.x, 0.0), dist));
    m = max(m, pointHit(uv + vec2(0.0, t.y), dist));
    m = max(m, pointHit(uv - vec2(0.0, t.y), dist));
    return m;
  }

  // 1 when an enemy / point pixel that is NEARER than this surface lies up, down, left or right of it within px pixels. A nearer
  // object owns the line along its own silhouette, so the surface behind it must not draw one of its own. Without this, the floor
  // next to an enemy's lower legs (only a few metres behind them, so the far-side test in edgeAt does not reject it) got the thick
  // map-geometry line and the enemy looked fatter from the knees down.
  float enemyNearer(const in vec2 uv, const in float dist) {
    float v = texture2D(uEnemyDepth, uv).r;
    if (v <= 0.0) return 0.0;
    return step(-perspectiveDepthToViewZ(1.0 - v, cameraNear, cameraFar), dist);
  }
  float pointNearer(const in vec2 uv, const in float dist) {
    float v = texture2D(uPointDepth, uv).r;
    if (v <= 0.0) return 0.0;
    return step(-perspectiveDepthToViewZ(1.0 - v, cameraNear, cameraFar), dist);
  }
  float nearerOwner(const in vec2 uv, const in float dist, const in float px) {
    vec2 a = uTexel * px;        // full reach...
    vec2 b = uTexel * px * 0.5;  // ...and half of it, so thin parts (an arm) are still seen
    float m = 0.0;
    m = max(m, max(enemyNearer(uv + vec2(a.x, 0.0), dist), enemyNearer(uv - vec2(a.x, 0.0), dist)));
    m = max(m, max(enemyNearer(uv + vec2(0.0, a.y), dist), enemyNearer(uv - vec2(0.0, a.y), dist)));
    m = max(m, max(enemyNearer(uv + vec2(b.x, 0.0), dist), enemyNearer(uv - vec2(b.x, 0.0), dist)));
    m = max(m, max(enemyNearer(uv + vec2(0.0, b.y), dist), enemyNearer(uv - vec2(0.0, b.y), dist)));
    m = max(m, max(pointNearer(uv + vec2(a.x, 0.0), dist), pointNearer(uv - vec2(a.x, 0.0), dist)));
    m = max(m, max(pointNearer(uv + vec2(0.0, a.y), dist), pointNearer(uv - vec2(0.0, a.y), dist)));
    m = max(m, max(pointNearer(uv + vec2(b.x, 0.0), dist), pointNearer(uv - vec2(b.x, 0.0), dist)));
    m = max(m, max(pointNearer(uv + vec2(0.0, b.y), dist), pointNearer(uv - vec2(0.0, b.y), dist)));
    return m;
  }

  // Line strength 0..1 at this pixel for a line wPx WHOLE pixels wide (see the note in mainImage on why whole pixels).
  float edgeAt(const in vec2 uv, const in float c, const in float wPx, const in float threshold) {
    vec2 o = uTexel * max(wPx, 1.0);
    float n = invDist(uv + vec2(0.0, o.y));
    float s = invDist(uv - vec2(0.0, o.y));
    float e = invDist(uv + vec2(o.x, 0.0));
    float w2 = invDist(uv - vec2(o.x, 0.0));

    // far side of a big depth jump → leave it to the nearer pixel (keeps the line one-sided and thin)
    float nearest = max(max(n, s), max(e, w2));
    float farSide = step(c * 1.5, nearest);

    float curve = (abs(n + s - 2.0 * c) + abs(e + w2 - 2.0 * c)) / c;
    return smoothstep(threshold, threshold * 2.5, curve) * (1.0 - farSide);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    // shadow tint: lift blacks toward a deep colour (smoothly, only where the pixel is very dark)
    float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 base = inputColor.rgb + uShadowColor * uShadowLift * (1.0 - smoothstep(0.0, uShadowRange, luma));

    float c = invDist(uv);
    float dist = 1.0 / c;

    // which style does this pixel's surface get? geometry unless an ID buffer claims it (enemies win over points)
    float isEnemy = enemyMask(uv, dist);
    float isPoint = pointMask(uv, dist) * (1.0 - isEnemy);
    vec3 ink = mix(mix(uLineColor, uPointColor, isPoint), uEnemyColor, isEnemy);
    vec4 style = mix(mix(uGeo, uPoint, isPoint), uEnemy, isEnemy);
    float strength = style.x;
    float baseWidth = style.y; // px at uWidthRef metres
    float minWidth = style.z;
    float maxWidth = mix(mix(uMaxWidth.x, uMaxWidth.z, isPoint), uMaxWidth.y, isEnemy);
    float threshold = style.w;

    // Line width follows distance: baseWidth px at uWidthRef metres, thicker when closer (up to maxWidth), thinner when farther
    // (down to minWidth). uFalloff is the exponent on the distance ratio: 1 = true perspective (width ~ 1/distance), lower = gentler.
    // The offset has to be WHOLE pixels: the depth texture is nearest-filtered, so a fractional offset (e.g. 1.5px) rounds to 1px on
    // one side and 2px on the other, and the "flat surfaces give zero" maths breaks - every floor/wall seen at a glancing angle then
    // lights up with ink, darkest toward the horizon. To still get a smooth change with distance (no visible steps where the width
    // ticks from 4 px to 3 px), the line is computed at the two neighbouring whole widths and blended by the fractional part.
    // Below minWidth we can't draw a thinner line, so the line stays at minWidth and its ink is faded by the missing coverage.
    float rawW = baseWidth * pow(uWidthRef / max(dist, 1e-3), uFalloff);
    float wf = clamp(rawW, minWidth, maxWidth);
    float coverage = clamp(rawW / minWidth, 0.0, 1.0);
    float wLow = floor(wf);
    float wFrac = wf - wLow;
    float edge = edgeAt(uv, c, wLow, threshold);
    if (wFrac > 0.01) edge = mix(edge, edgeAt(uv, c, wLow + 1.0, threshold), wFrac);

    // lines fade with distance so far geometry doesn't turn into black noise
    // plain geometry gives way to a nearer enemy / grapple point within reach of this line's width
    float geometryOwned = (1.0 - isEnemy) * (1.0 - isPoint);
    if (geometryOwned > 0.5) edge *= 1.0 - nearerOwner(uv, dist, ceil(wf) + 1.0);

    edge *= 1.0 - smoothstep(uFade.x, uFade.y, dist);
    edge *= coverage;

    outputColor = vec4(mix(base, ink, edge * strength), inputColor.a);
  }
`

const makeTarget = () =>
  new WebGLRenderTarget(1, 1, {
    type: HalfFloatType, // 1 - depth sits near 0 for anything farther than a few metres, where floats are precise (8 bits would not be)
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    depthBuffer: true, // the layer occludes itself (an arm in front of a torso)
  })

export class OutlineEffectImpl extends Effect {
  constructor({ config } = {}) {
    const enemyTarget = makeTarget()
    const pointTarget = makeTarget()
    super('OutlineEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uLineColor', new Uniform(new Color('#1b1226'))],
        ['uGeo', new Uniform(new Vector4(1, 5, 2, 0.012))],
        ['uEnemyColor', new Uniform(new Color('#2a0610'))],
        ['uEnemy', new Uniform(new Vector4(1, 2, 1, 0.04))],
        ['uPointColor', new Uniform(new Color('#05060f'))],
        ['uPoint', new Uniform(new Vector4(0.8, 2, 1, 0.03))],
        ['uEnemyDepth', new Uniform(enemyTarget.texture)],
        ['uPointDepth', new Uniform(pointTarget.texture)],
        ['uMaxWidth', new Uniform(new Vector3(12, 6, 4))],
        ['uWidthRef', new Uniform(10)],
        ['uFalloff', new Uniform(0.7)],
        ['uFade', new Uniform(new Vector2(45, 140))],
        ['uTexel', new Uniform(new Vector2(1 / 1920, 1 / 1080))],
        ['uShadowColor', new Uniform(new Color('#2b2a7a'))],
        ['uShadowLift', new Uniform(0.6)],
        ['uShadowRange', new Uniform(0.12)],
      ]),
    })
    this.layerTargets = [
      [OUTLINE_LAYER.enemy, enemyTarget],
      [OUTLINE_LAYER.point, pointTarget],
    ]
    this.depthMaterial = new MeshDepthMaterial({ depthPacking: BasicDepthPacking }) // writes (1 - depth); skinned meshes work too
    this.clearColor = new Color()
    // set every frame by <LiveLook/> (the effect can't find the scene on its own)
    this.idScene = null
    this.idCamera = null
    if (config) this.applyConfig(config)
  }

  /** Copy the OUTLINE config (gameConfig.js) into the uniforms. Top-level values style map geometry; .enemy and .point override. */
  applyConfig(cfg) {
    const u = this.uniforms
    const on = cfg.enabled ? 1 : 0
    const maxW = u.get('uMaxWidth').value
    const style = (colorKey, paramKey, widthSlot, s, master = 1) => {
      u.get(colorKey).value.set(s.color)
      const base = Math.max(1, s.width)
      const min = Math.min(Math.max(1, s.minWidth), base) // minWidth <= width <= maxWidth, whatever the sliders say
      maxW.setComponent(widthSlot, Math.max(base, s.maxWidth ?? base))
      u.get(paramKey).value.set(s.strength * master * (s.enabled === false ? 0 : 1), base, min, s.threshold)
    }
    style('uLineColor', 'uGeo', 0, cfg, on)
    style('uEnemyColor', 'uEnemy', 1, cfg.enemy, on)
    style('uPointColor', 'uPoint', 2, cfg.point, on)
    u.get('uWidthRef').value = Math.max(0.1, cfg.widthRefDist)
    u.get('uFalloff').value = cfg.widthFalloff ?? 1
    u.get('uFade').value.set(cfg.fadeStart, cfg.fadeEnd)
    u.get('uShadowColor').value.set(cfg.shadowColor)
    u.get('uShadowLift').value = cfg.shadowLift
    u.get('uShadowRange').value = cfg.shadowRange
  }

  setSize(width, height) {
    this.uniforms.get('uTexel').value.set(1 / width, 1 / height)
    for (const [, target] of this.layerTargets) target.setSize(width, height)
  }

  /** Called by the EffectPass every frame before the effect is drawn: render the enemy / point layers into their ID buffers. */
  update(renderer, inputBuffer, deltaTime) {
    const scene = this.idScene
    const camera = this.idCamera
    if (!scene || !camera) return

    const saved = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      shadowAuto: renderer.shadowMap.autoUpdate,
      alpha: renderer.getClearAlpha(),
      mask: camera.layers.mask,
      background: scene.background,
      override: scene.overrideMaterial,
    }
    renderer.getClearColor(this.clearColor)
    try {
      renderer.autoClear = true // clears the target before each render
      renderer.shadowMap.autoUpdate = false // don't redo the shadow maps for these tiny renders
      renderer.setClearColor(0x000000, 0) // 0 = "nothing here"
      scene.background = null
      scene.overrideMaterial = this.depthMaterial
      for (const [layer, target] of this.layerTargets) {
        camera.layers.set(layer)
        renderer.setRenderTarget(target)
        renderer.render(scene, camera)
      }
    } finally {
      scene.overrideMaterial = saved.override
      scene.background = saved.background
      camera.layers.mask = saved.mask
      renderer.setClearColor(this.clearColor, saved.alpha)
      renderer.shadowMap.autoUpdate = saved.shadowAuto
      renderer.autoClear = saved.autoClear
      renderer.setRenderTarget(saved.target)
    }
  }

  dispose() {
    for (const [, target] of this.layerTargets) target.dispose()
    this.depthMaterial.dispose()
    super.dispose()
  }
}

export const Outline = wrapEffect(OutlineEffectImpl)
