/**
 * OpenLayers 聚合入口（本地 npm 包，构建时单独分包，不使用 CDN）
 * 页面拿到的对象结构与官方 `ol` 命名空间基本一致
 */
import proj4 from 'proj4'

import Map from 'ol/Map.js'
import View from 'ol/View.js'
import Overlay from 'ol/Overlay.js'

import TileLayer from 'ol/layer/Tile.js'
import ImageLayer from 'ol/layer/Image.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import Heatmap from 'ol/layer/Heatmap.js'
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js'
import LayerGroup from 'ol/layer/Group.js'

import OSM from 'ol/source/OSM.js'
import XYZ from 'ol/source/XYZ.js'
import TileWMS from 'ol/source/TileWMS.js'
import ImageWMS from 'ol/source/ImageWMS.js'
import ImageStatic from 'ol/source/ImageStatic.js'
import VectorSource from 'ol/source/Vector.js'
import Cluster from 'ol/source/Cluster.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import WMTS from 'ol/source/WMTS.js'
import TileDebug from 'ol/source/TileDebug.js'

import TileGrid from 'ol/tilegrid/TileGrid.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'

import GeoJSON from 'ol/format/GeoJSON.js'
import WKT from 'ol/format/WKT.js'
import MVT from 'ol/format/MVT.js'

import Draw, { createBox, createRegularPolygon } from 'ol/interaction/Draw.js'
import Modify from 'ol/interaction/Modify.js'
import Snap from 'ol/interaction/Snap.js'
import Select from 'ol/interaction/Select.js'

import Style from 'ol/style/Style.js'
import Stroke from 'ol/style/Stroke.js'
import Fill from 'ol/style/Fill.js'
import CircleStyle from 'ol/style/Circle.js'
import RegularShape from 'ol/style/RegularShape.js'
import Text from 'ol/style/Text.js'
import Icon from 'ol/style/Icon.js'

import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import LineString from 'ol/geom/LineString.js'
import Polygon, { fromExtent as polygonFromExtent } from 'ol/geom/Polygon.js'
import MultiPoint from 'ol/geom/MultiPoint.js'
import MultiLineString from 'ol/geom/MultiLineString.js'
import MultiPolygon from 'ol/geom/MultiPolygon.js'
import Circle from 'ol/geom/Circle.js'

import * as proj from 'ol/proj.js'
import { register as registerProj4 } from 'ol/proj/proj4.js'
import * as sphere from 'ol/sphere.js'
import * as extent from 'ol/extent.js'
import { unByKey } from 'ol/Observable.js'
import { defaults as defaultControls, ScaleLine, MousePosition, FullScreen, ZoomSlider, OverviewMap, Attribution } from 'ol/control.js'

const ol = {
  // 地图与视图
  Map,
  View,
  Overlay,
  // 图层
  TileLayer,
  ImageLayer,
  VectorLayer,
  VectorTileLayer,
  Heatmap,
  WebGLPointsLayer,
  LayerGroup,
  // 数据源
  OSM,
  XYZ,
  TileWMS,
  ImageWMS,
  ImageStatic,
  VectorSource,
  Cluster,
  VectorTileSource,
  WMTS,
  TileDebug,
  // 切片网格
  TileGrid,
  WMTSTileGrid,
  // 格式
  GeoJSON,
  WKT,
  MVT,
  // 交互
  Draw,
  Modify,
  Snap,
  Select,
  createBox,
  createRegularPolygon,
  // 样式
  Style,
  Stroke,
  Fill,
  CircleStyle,
  RegularShape,
  Text,
  Icon,
  // 要素与几何
  Feature,
  Point,
  LineString,
  Polygon,
  polygonFromExtent,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  Circle,
  // 投影（proj4 支持自定义坐标系）
  proj4,
  registerProj4,
  ...proj,
  // 球面计算：getDistance / getLength / getArea
  ...sphere,
  // 范围计算
  boundingExtent: extent.boundingExtent,
  bufferExtent: extent.buffer,
  containsCoordinate: extent.containsCoordinate,
  getCenter: extent.getCenter,
  getWidth: extent.getWidth,
  getTopLeft: extent.getTopLeft,
  isEmpty: extent.isEmpty,
  // 事件
  unByKey,
  // 控件
  defaultControls,
  ScaleLine,
  MousePosition,
  FullScreen,
  ZoomSlider,
  OverviewMap,
  Attribution,
}

export default ol
