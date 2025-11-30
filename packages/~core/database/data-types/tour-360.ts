export type TourLink = {
  sceneId: string
  label: string
  yaw: number
  pitch: number
  rotation?: number
}

export type TourInfoHotspot = {
  yaw: number
  pitch: number
  title: string
  text: string
}

export type TourScene = {
  sceneId: string
  label: string
  links?: TourLink[]
  levels: Array<{
    tileSize: number
    size: number
    fallbackOnly?: boolean
  }>
  initialViewParameters?: {
    pitch: number
    yaw: number
    fov: number
  }
  infoHotspots?: TourInfoHotspot[]
}

export type Tour360 = TourScene[]
