import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import {
  EPSILON,
  color,
  deltaTime,
  dot,
  Fn,
  If,
  instancedArray,
  instanceIndex,
  Loop,
  pass,
  positionLocal,
  uniform,
  vec3,
} from 'three/tsl'
import './style.css'
import { toNormalizedDeviceCoordinates } from './ndc'
import { createWordTargets } from './word-targets'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')

if (!canvas) {
  throw new Error('Canvas element not found')
}

/**
 * Scene
 */
const scene = new THREE.Scene()

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.z = 16
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0, 0)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
  canvas,
  antialias: true,
})
renderer.toneMapping = THREE.CineonToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.setSize(sizes.width, sizes.height, false)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x252028)

const inspector = new Inspector()
renderer.inspector = inspector

await renderer.init()

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  renderer.setSize(sizes.width, sizes.height, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Post processing
 */
const renderPipeline = new THREE.RenderPipeline(renderer)
const scenePass = pass(scene, camera)
const scenePassColor = scenePass.getTextureNode('output')
const bloomPass = bloom(scenePassColor)
bloomPass.threshold.value = 0
bloomPass.strength.value = 0.15

const filmIntensity = uniform(0.1)
const filmPass = film(scenePassColor.add(bloomPass), filmIntensity)

renderPipeline.outputNode = filmPass

const bloomGui = inspector.createParameters('Bloom').close()
bloomGui.add(bloomPass.threshold, 'value', 0, 2, 0.01).name('threshold')
bloomGui.add(bloomPass.strength, 'value', 0, 2, 0.01).name('strength')

const filmGui = inspector.createParameters('Film').close()
filmGui.add(filmIntensity, 'value', 0, 1, 0.01).name('intensity')

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3)
directionalLight.castShadow = true
directionalLight.position.set(1, 1, 0.75).normalize().multiplyScalar(8)
directionalLight.shadow.camera.far = 16
directionalLight.shadow.camera.top = 8
directionalLight.shadow.camera.right = 8
directionalLight.shadow.camera.bottom = -8
directionalLight.shadow.camera.left = -8
directionalLight.shadow.mapSize.set(2048, 2048)
directionalLight.shadow.radius = 30
directionalLight.shadow.normalBias = -0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0xe8b8ff, 0.08)
scene.add(ambientLight)

const lightsGui = inspector.createParameters('Lights').close()

lightsGui.addColor(directionalLight, 'color').name('directionalColor')
lightsGui.add(directionalLight, 'intensity', 0, 5, 0.01).name('directionalIntensity')

lightsGui.addColor(ambientLight, 'color').name('ambientColor')
lightsGui.add(ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')

/**
 * Cursor
 */
const raycaster = new THREE.Raycaster()
const cursor = new THREE.Vector2()

window.addEventListener('pointermove', (event) => {
  const coordinates = toNormalizedDeviceCoordinates(
    event.clientX,
    event.clientY,
    sizes.width,
    sizes.height,
  )

  cursor.x = coordinates.x
  cursor.y = coordinates.y
})

const cursorHelper = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1, 3),
  new THREE.MeshBasicMaterial({ wireframe: true }),
)

/**
 * Word particles
 */
const count = 10000
const targets = createWordTargets('ADGUARD', {
  count,
  depth: 1.6,
  worldWidth: 15.5,
  heightScale: 1.5,
})

const positionsBuffer = instancedArray(count, 'vec3')
const velocitiesBuffer = instancedArray(count, 'vec3')
const heatBuffer = instancedArray(count, 'float')
const targetsBuffer = instancedArray(targets, 'vec3')

const radius = uniform(0.08)
const gravityStrength = uniform(0.025)
const impactDamping = uniform(0.05)
const generalDamping = uniform(0.4)
const heatDamping = uniform(2)
const heatImpactStrength = uniform(30)
const emissiveColor = color('#67b279')
const cursorPosition = uniform(vec3())
const cursorVelocity = uniform(vec3())
const cursorRadius = uniform(1.75)
const cursorStrength = uniform(0.05)

const initCompute = Fn(() => {
  const position = positionsBuffer.element(instanceIndex)

  position.assign(targetsBuffer.element(instanceIndex))
})().compute(count)

renderer.compute(initCompute)

const updateCompute = Fn(() => {
  const clampedDeltaTime = deltaTime.min(1 / 30)

  const aPosition = positionsBuffer.element(instanceIndex)
  const aVelocity = velocitiesBuffer.element(instanceIndex)
  const aHeat = heatBuffer.element(instanceIndex)

  const cursorDistance = aPosition.distance(cursorPosition)
  const cursorDistanceRatio = cursorDistance.div(cursorRadius).oneMinus().max(0)
  const currentCursorVelocity = cursorVelocity.mul(cursorDistanceRatio).mul(cursorStrength)
  aVelocity.addAssign(currentCursorVelocity)
  aHeat.addAssign(currentCursorVelocity.length().mul(50))

  const toTarget = targetsBuffer.element(instanceIndex).sub(aPosition)
  const targetDirection = toTarget.div(toTarget.length().max(EPSILON))
  const gravityVelocity = targetDirection.mul(gravityStrength).mul(clampedDeltaTime)
  aVelocity.addAssign(gravityVelocity)

  Loop({ start: instanceIndex.add(1), end: count, condition: '<' }, ({ i }) => {
    const bPosition = positionsBuffer.element(i)
    const bVelocity = velocitiesBuffer.element(i)
    const bHeat = heatBuffer.element(i)

    const delta = bPosition.sub(aPosition)
    const distance = delta.length()
    const direction = delta.div(distance.max(EPSILON))

    const radius2 = radius.mul(2)
    If(distance.lessThan(radius2), () => {
      const overlap = radius2.sub(distance)
      const avoidance = direction.mul(overlap.div(2))
      aPosition.subAssign(avoidance)
      bPosition.addAssign(avoidance)

      const relativeVelocity = aVelocity.sub(bVelocity)
      const impactStrength = dot(relativeVelocity, direction)
      const impactVelocity = direction.mul(impactStrength).mul(impactDamping.oneMinus())
      aVelocity.subAssign(impactVelocity)
      bVelocity.addAssign(impactVelocity)

      const heat = impactStrength.sub(0.01).max(0).mul(heatImpactStrength)
      aHeat.addAssign(heat)
      bHeat.addAssign(heat)
    })
  })

  aPosition.addAssign(aVelocity)
  aVelocity.mulAssign(generalDamping.mul(clampedDeltaTime).oneMinus())
  aHeat.mulAssign(heatDamping.mul(clampedDeltaTime).oneMinus())
})().compute(count)

/**
 * Particles mesh
 */
const geometry = new THREE.IcosahedronGeometry(1, 2)
const material = new THREE.MeshLambertNodeMaterial({
  color: 0xffffff,
}) as THREE.MeshLambertNodeMaterial & {
  emissiveNode: unknown
}

material.positionNode = Fn(() => {
  positionLocal.mulAssign(radius)
  positionLocal.addAssign(positionsBuffer.element(instanceIndex))

  return positionLocal
})()

const heat = heatBuffer.element(instanceIndex)
material.emissiveNode = emissiveColor.mul(heat)

const mesh = new THREE.Mesh(geometry, material)
mesh.castShadow = true
mesh.receiveShadow = true
mesh.frustumCulled = false
mesh.count = count
scene.add(mesh)

const spheresGui = inspector.createParameters('Spheres')
spheresGui.add(radius, 'value', 0, 0.5, 0.001).name('radius')
spheresGui.add(gravityStrength, 'value', 0, 0.1, 0.001).name('gravityStrength')
spheresGui.add(impactDamping, 'value', 0, 1, 0.001).name('impactDamping')
spheresGui.add(generalDamping, 'value', 0, 1, 0.01).name('generalDamping')
spheresGui.add(heatDamping, 'value', 0, 10, 0.1).name('heatDamping')
spheresGui.add(heatImpactStrength, 'value', 0, 100, 0.1).name('heatImpactStrength')
spheresGui.add(cursorRadius, 'value', 0, 5, 0.001).name('cursorRadius')
spheresGui.add(cursorStrength, 'value', 0, 0.2, 0.001).name('cursorStrength')

inspector.hide()

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'i') {
    return
  }

  if (inspector.getVisible()) {
    inspector.hide()
  } else {
    inspector.show()
  }
})

/**
 * Animate
 */
const tick = () => {
  controls.update()

  raycaster.setFromCamera(cursor, camera)
  const planeNormal = camera.position.clone().normalize()
  const plane = new THREE.Plane(planeNormal, 0)

  const intersect = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, intersect)

  cursorHelper.position.copy(intersect)

  cursorVelocity.value.copy(intersect).sub(cursorPosition.value)
  cursorPosition.value.copy(intersect)

  renderer.compute(updateCompute)
  renderPipeline.render()
}

void renderer.setAnimationLoop(tick)
