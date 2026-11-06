<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadThree } from '@/utils/gis/threeLoader'

async function init(THREE: any, el: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.z = 6

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  // 粒子系统：BufferGeometry + PointsMaterial
  const COUNT = 3000
  const positions = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.04, transparent: true, opacity: 0.85 }),
  )
  scene.add(points)

  let raf = 0
  const tick = () => {
    raf = requestAnimationFrame(tick)
    points.rotation.y += 0.002
    points.rotation.x += 0.0008
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
    geometry.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">粒子动画：BufferGeometry + Points 渲染 3000 粒子星空</p>
    <DemoBox class="flex-1" tech :loader="loadThree" :init="init" />
  </div>
</template>
