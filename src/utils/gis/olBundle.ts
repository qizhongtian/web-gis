/**
 * OpenLayers 聚合入口（本地 npm 包，构建时单独分包，不使用 CDN）
 * 页面拿到的对象结构与官方 `ol` 命名空间基本一致
 */
import Map from 'ol/Map.js'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import VectorLayer from 'ol/layer/Vector.js'
import OSM from 'ol/source/OSM.js'
import XYZ from 'ol/source/XYZ.js'
import VectorSource from 'ol/source/Vector.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Draw from 'ol/interaction/Draw.js'
import Select from 'ol/interaction/Select.js'
import Style from 'ol/style/Style.js'
import Stroke from 'ol/style/Stroke.js'
import Fill from 'ol/style/Fill.js'
import CircleStyle from 'ol/style/Circle.js'
import Text from 'ol/style/Text.js'
import Overlay from 'ol/Overlay.js'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import Polygon from 'ol/geom/Polygon.js'
import LineString from 'ol/geom/LineString.js'
import Circle from 'ol/geom/Circle.js'
import * as proj from 'ol/proj.js'
import * as sphere from 'ol/sphere.js'

const ol = {
  Map,
  View,
  TileLayer,
  VectorLayer,
  OSM,
  XYZ,
  VectorSource,
  GeoJSON,
  Draw,
  Select,
  Style,
  Stroke,
  Fill,
  CircleStyle,
  Text,
  Overlay,
  Feature,
  Point,
  Polygon,
  LineString,
  Circle,
  // fromLonLat / toLonLat / transform … 以及 getDistance / getLength / getArea
  ...proj,
  ...sphere,
}

export default ol
