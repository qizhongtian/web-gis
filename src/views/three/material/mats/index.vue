<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadThree } from '@/utils/gis/threeLoader'

const material = ref('normal')
let THREE: any = null
let mesh: any = null
let lights: any[] = []

function setMaterial(kind: string) {
  material.value = kind
  if (!mesh || !THREE) return
  const T = THREE
  if (lights.length) lights.forEach((l) => l.parent?.remove(l))
  lights = []
  switch (kind) {
    case 'basic':
      mesh.material = new T.MeshBasicMaterial({ color: 0x22d3ee })
      break
    case 'standard':
      {
        const l1 = new T.DirectionalLight(0xffffff, 1.5)
        l1.position.set(3, 4, 5)
        mesh.parent?.add(l1)
        lights.push(l1)
        mesh.material = new T.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.6, roughness: 0.25 })
      }
      break
    case 'wireframe':
      mesh.material = new T.MeshNormalMaterial({ wireframe: true })
      break
    default:
      mesh.material = new T.MeshNormalMaterial()
  }
}

async function init(lib: any, el: HTMLElement) {
  THREE = lib
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.z = 4

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  mesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 48, 48), new THREE.MeshNormalMaterial())
  scene.add(mesh)

  let raf = 0
  const tick = () => {
    raf = requestAnimationFrame(tick)
    mesh.rotation.y += 0.006
    renderer.render(scene, camera)
  }
  tick()

  return () => {
    cancelAnimationFrame(raf)
    renderer.dispose()
    renderer.domElement.remove()
    mesh = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">材质展示：Basic / Normal / Standard(需光照) / Wireframe 实时切换</p>
    <el-radio-group v-model="material" size="small" @change="setMaterial as any">
      <el-radio-button value="normal">Normal</el-radio-button>
      <el-radio-button value="basic">Basic</el-radio-button>
      <el-radio-button value="standard">Standard</el-radio-button>
      <el-radio-button value="wireframe">Wireframe</el-radio-button>
    </el-radio-group>
    <DemoBox class="flex-1" tech :loader="loadThree" :init="init" />
  </div>
</template>
