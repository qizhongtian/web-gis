<script setup lang="ts">
import DemoBox from '@/components/DemoBox.vue'
import { loadThree } from '@/utils/gis/threeLoader'

async function init(THREE: any, el: HTMLElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.z = 5

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.8, 1.8),
    new THREE.MeshNormalMaterial({ wireframe: false }),
  )
  scene.add(mesh)

  let raf = 0
  const tick = () => {
    raf = requestAnimationFrame(tick)
    mesh.rotation.x += 0.008
    mesh.rotation.y += 0.015
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
    <p class="demo-hint">Three.js 基础：场景 / 相机 / 渲染器 + requestAnimationFrame 旋转立方体</p>
    <DemoBox class="flex-1" tech :loader="loadThree" :init="init" />
  </div>
</template>
