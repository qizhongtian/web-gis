<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadThree } from '@/utils/gis/threeLoader'

async function init(THREE: any, el: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.set(0, 2, 8)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  const group = new THREE.Group()
  const material = new THREE.MeshNormalMaterial()
  const geometries = [
    new THREE.TorusGeometry(0.8, 0.3, 16, 48),
    new THREE.SphereGeometry(0.8, 24, 24),
    new THREE.ConeGeometry(0.8, 1.5, 24),
    new THREE.TorusKnotGeometry(0.6, 0.2, 64, 12),
  ]
  geometries.forEach((g, i) => {
    const mesh = new THREE.Mesh(g, material)
    mesh.position.x = (i - 1.5) * 2.2
    group.add(mesh)
  })
  scene.add(group)

  let raf = 0
  const tick = () => {
    raf = requestAnimationFrame(tick)
    group.rotation.y += 0.005
    renderer.render(scene, camera)
  }
  tick()

  const onResize = () => {
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  }
  window.addEventListener('resize', onResize)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    renderer.dispose()
    renderer.domElement.remove()
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">基础几何体：Torus / Sphere / Cone / TorusKnot</p>
    <DemoBox class="flex-1" tech :loader="loadThree" :init="init" />
  </div>
</template>
