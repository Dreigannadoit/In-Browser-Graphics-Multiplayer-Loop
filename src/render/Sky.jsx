// Gradient sky dome that follows the camera. Colours come from LOOK.sky; the scene fog uses the same horizon colour.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LOOK } from '../config/gameConfig'

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform float uBands;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    float t = smoothstep(0.0, 0.6, h);
    if (uBands > 0.5) t = floor(t * uBands) / uBands; // optional hard painted stripes
    vec3 c = mix(uHorizon, uTop, t);
    c = mix(c, uGround, 1.0 - smoothstep(-0.3, 0.0, h));
    gl_FragColor = vec4(c, 1.0);
  }
`

export function Sky() {
  const mesh = useRef()
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(LOOK.sky.top) },
          uHorizon: { value: new THREE.Color(LOOK.sky.horizon) },
          uGround: { value: new THREE.Color(LOOK.sky.ground) },
          uBands: { value: LOOK.sky.bands },
        },
      }),
    [],
  )
  const last = useRef('')
  useFrame(({ camera }) => {
    if (mesh.current) mesh.current.position.copy(camera.position)
    // pick up live changes to LOOK.sky (dev tools) without touching uniforms every frame
    const key = `${LOOK.sky.top}|${LOOK.sky.horizon}|${LOOK.sky.ground}|${LOOK.sky.bands}`
    if (key !== last.current) {
      last.current = key
      const u = material.uniforms
      u.uTop.value.set(LOOK.sky.top)
      u.uHorizon.value.set(LOOK.sky.horizon)
      u.uGround.value.set(LOOK.sky.ground)
      u.uBands.value = LOOK.sky.bands
    }
  })
  return (
    <mesh ref={mesh} material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  )
}
