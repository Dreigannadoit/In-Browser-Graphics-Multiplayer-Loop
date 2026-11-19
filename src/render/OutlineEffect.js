// Cartoon ink outline (+ shadow tint) as a postprocessing Effect. Depth-only (no extra normal pass), so it costs one full-screen pass.
//
// How it works: take the *inverse* view distance (1/z) of a pixel and its 4 neighbours. 1/z is exactly linear across any flat
// surface, so its second difference (neighbours − 2·centre) is ZERO on walls/floors/ramps and only lights up where the
// surface bends (creases / corners) or the depth jumps (silhouettes). Dividing by the centre value makes the threshold
// distance-independent. Pixels on the FAR side of a big depth jump are skipped, so silhouettes get a one-sided line
// instead of a double-thick one.
import { Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform, Vector2 } from 'three'
import { wrapEffect } from '@react-three/postprocessing'

const fragmentShader = /* glsl */ `
  uniform vec3 uLineColor;
  uniform float uStrength;
  uniform float uWidth;
  uniform float uThreshold;
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

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    // shadow tint: lift blacks toward a deep colour (smoothly, only where the pixel is very dark)
    float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 base = inputColor.rgb + uShadowColor * uShadowLift * (1.0 - smoothstep(0.0, uShadowRange, luma));

    float c = invDist(uv);
    float dist = 1.0 / c;

    // Line width in WHOLE pixels, thick up close and tapering to 1px with distance. Whole pixels matter: the depth texture is
    // nearest-filtered, so a fractional offset (e.g. 1.5px) rounds to 1px on one side and 2px on the other, and the "flat surfaces
    // give zero" maths breaks - every floor/wall seen at a glancing angle then lights up with ink, darkest toward the horizon.
    float w = floor(mix(uWidth, 1.0, smoothstep(uFade.x * 0.3, uFade.y, dist)) + 0.5);
    vec2 o = uTexel * max(w, 1.0);
    float n = invDist(uv + vec2(0.0, o.y));
    float s = invDist(uv - vec2(0.0, o.y));
    float e = invDist(uv + vec2(o.x, 0.0));
    float w2 = invDist(uv - vec2(o.x, 0.0));

    // far side of a big depth jump → leave it to the nearer pixel (keeps the line one-sided and thin)
    float nearest = max(max(n, s), max(e, w2));
    float farSide = step(c * 1.5, nearest);

    float curve = (abs(n + s - 2.0 * c) + abs(e + w2 - 2.0 * c)) / c;
    float edge = smoothstep(uThreshold, uThreshold * 2.5, curve) * (1.0 - farSide);

    // lines fade with distance so far geometry doesn't turn into black noise
    edge *= 1.0 - smoothstep(uFade.x, uFade.y, dist);

    outputColor = vec4(mix(base, uLineColor, edge * uStrength), inputColor.a);
  }
`

export class OutlineEffectImpl extends Effect {
  constructor({
    lineColor = '#1b1226', // ink colour
    lineStrength = 1, // 0..1 how solid the ink is
    lineWidth = 4, // pixels at close range (rounded to whole pixels; tapers to 1px with distance)
    edgeThreshold = 0.012, // curvature needed to count as an edge; lower = more lines
    fadeStart = 45, // metres where lines start to fade...
    fadeEnd = 140, // ...and vanish
    shadowColor = '#2b2a7a', // colour that near-black pixels are lifted toward
    shadowLift = 0.6, // 0 = off
    shadowRange = 0.12, // linear brightness below which the tint applies
  } = {}) {
    super('OutlineEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uLineColor', new Uniform(new Color(lineColor))],
        ['uStrength', new Uniform(lineStrength)],
        ['uWidth', new Uniform(lineWidth)],
        ['uThreshold', new Uniform(edgeThreshold)],
        ['uFade', new Uniform(new Vector2(fadeStart, fadeEnd))],
        ['uTexel', new Uniform(new Vector2(1 / 1920, 1 / 1080))],
        ['uShadowColor', new Uniform(new Color(shadowColor))],
        ['uShadowLift', new Uniform(shadowLift)],
        ['uShadowRange', new Uniform(shadowRange)],
      ]),
    })
  }

  setSize(width, height) {
    this.uniforms.get('uTexel').value.set(1 / width, 1 / height)
  }
}

export const Outline = wrapEffect(OutlineEffectImpl)
