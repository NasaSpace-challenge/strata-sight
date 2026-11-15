import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CallbackPositionProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  Entity,
  HorizontalOrigin,
  ImageryLayer as CesiumImageryLayer,
  LabelStyle,
  Math as CesiumMath,
  ArcType,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer,
  WebMercatorTilingScheme
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { RegionHotspot, EarthVariable } from '../types';
import { PLANETARY_HOTSPOTS, formatCoords } from '../services/earthScienceData';
import {
  addDays,
  clampDate,
  fetchLayers,
  formatDay,
  layerKeyForVariable,
  ImageryLayer,
  LayersResponse
} from '../services/earthView';
import {
  Globe2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  Sparkles,
  Maximize2,
  Minimize2,
  ArrowRight,
  Satellite,
  Layers,
  Moon
} from 'lucide-react';

// CesiumJS loads its web workers and textures from here (copied by vite.config.ts).
(window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL ??= '/cesium';

/** Every picture on the globe is a real NASA GIBS product, streamed as map tiles and draped over a CesiumJS globe. */
export type GlobeLayerMode = 'live' | 'bluemarble' | 'night' | 'lst' | 'aerosol' | 'no2' | 'rain' | 'ndvi';

interface GlobeLayerInfo {
  key: GlobeLayerMode;
  label: string;
  /** which backend catalog entries supply the available dates (first one sets the date range) */
  catalogKeys: string[];
  sensor: string;
  description: string;
}

const GLOBE_LAYERS: GlobeLayerInfo[] = [
  {
    key: 'live',
    label: 'Live Earth',
    catalogKeys: ['terra', 'aqua'],
    sensor: 'Terra + Aqua / MODIS',
    description: 'A real daily picture of the planet, up to 250 m per pixel. Gaps between satellite passes show NASA Blue Marble.'
  },
  {
    key: 'bluemarble',
    label: 'Blue Marble',
    catalogKeys: [],
    sensor: 'NASA Blue Marble',
    description: 'NASA\'s cloud-free composite of land, ocean floor and relief. It does not change from day to day.'
  },
  { key: 'night', label: 'Night lights', catalogKeys: ['night'], sensor: 'Suomi NPP / VIIRS', description: 'City lights from a 2016 night-time composite.' },
  { key: 'lst', label: 'Land temperature', catalogKeys: ['lst'], sensor: 'Terra / MODIS', description: 'How hot the ground is in the daytime. Gaps are cloud.' },
  { key: 'aerosol', label: 'Air pollution', catalogKeys: ['aerosol'], sensor: 'Terra / MODIS', description: 'Smoke, dust and haze in the air.' },
  { key: 'no2', label: 'Nitrogen dioxide', catalogKeys: ['no2'], sensor: 'Aura / OMI', description: 'A gas from traffic, power plants and industry.' },
  { key: 'rain', label: 'Rainfall', catalogKeys: ['rain'], sensor: 'GPM / IMERG', description: 'Estimated rain falling across the world.' },
  { key: 'ndvi', label: 'Vegetation', catalogKeys: ['ndvi'], sensor: 'Terra / MODIS', description: 'How green and healthy plants are.' }
];
const DATA_LAYER_KEYS: GlobeLayerMode[] = ['lst', 'aerosol', 'no2', 'rain', 'ndvi'];
const layerInfo = (k: GlobeLayerMode) => GLOBE_LAYERS.find(l => l.key === k)!;

interface InteractiveEarthGlobeProps {
  selectedRegion: RegionHotspot;
  onSelectRegion: (region: RegionHotspot) => void;
  selectedVariable: EarthVariable;
  onLaunchLab: () => void;
  onCoordinatePicked?: (coords: { lat: number; lon: number }) => void;
}

interface NasaSatelliteData {
  id: string;
  name: string;
  mission: string;
  altitudeKm: number;
  inclinationDeg: number;
  speedKmS: number;
  color: string;
  sensors: string;
  description: string;
}

const NASA_SATELLITE_FLEET: NasaSatelliteData[] = [
  {
    id: 'iss',
    name: 'ISS (Space Station)',
    mission: 'Earth Climate & Canopy Sensors',
    altitudeKm: 420,
    inclinationDeg: 51.6,
    speedKmS: 7.66,
    color: '#38bdf8',
    sensors: 'ECOSTRESS, OCO-3, EMIT, SAGE-III',
    description: 'Measures high-resolution thermal stress on urban cores and agricultural crops.'
  },
  {
    id: 'terra',
    name: 'Terra (EOS AM-1)',
    mission: 'NASA Earth Observing Flagship',
    altitudeKm: 705,
    inclinationDeg: 98.2,
    speedKmS: 7.5,
    color: '#10b981',
    sensors: 'MODIS, ASTER, MISR, CERES',
    description: 'Continuous global tracking of vegetation greenness (NDVI), aerosol optical depth, and wildfires.'
  },
  {
    id: 'aqua',
    name: 'Aqua (EOS PM-1)',
    mission: 'Global Water & Thermal Cycle',
    altitudeKm: 705,
    inclinationDeg: 98.2,
    speedKmS: 7.5,
    color: '#00b4d8',
    sensors: 'AIRS, AMSU, MODIS, CERES',
    description: 'A-Train constellation leader measuring atmospheric temperature soundings and water vapor.'
  },
  {
    id: 'grace_fo',
    name: 'GRACE-FO (Tandem)',
    mission: 'Laser Interferometer Gravimetry',
    altitudeKm: 490,
    inclinationDeg: 89.0,
    speedKmS: 7.6,
    color: '#f59e0b',
    sensors: 'Microwave K-Band Ranging, LRI',
    description: 'Measures gravitational shifts to weigh polar glacier melting and deep groundwater depletion.'
  },
  {
    id: 'sentinel6',
    name: 'Sentinel-6 Michael Freilich',
    mission: 'Global Ocean Radar Altimetry',
    altitudeKm: 1336,
    inclinationDeg: 66.0,
    speedKmS: 7.1,
    color: '#ef4444',
    sensors: 'Poseidon-4 Radar Altimeter, AMR-C',
    description: 'Monitors global mean sea level rise and thermal steric ocean expansion.'
  }
];


const EARTH_MU_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6371;
/** Orbits are drawn at real altitude and inclination but played faster so the motion is visible. */
const ORBIT_SPEEDUP = 60;
const HOME_ALTITUDE_M = 13_500_000;
const MIN_ZOOM_M = 150_000;
const MAX_ZOOM_M = 45_000_000;
/** Colour shown where a tile has not arrived yet: a soft ocean blue that matches the page theme. */
const GLOBE_BASE = '#7dd3fc';

/** A point on a circular orbit, in Earth-fixed metres (schematic: the ring does not rotate with the planet). */
function orbitPoint(sat: NasaSatelliteData, index: number, theta: number): Cartesian3 {
  const r = (EARTH_RADIUS_KM + sat.altitudeKm) * 1000;
  const inc = CesiumMath.toRadians(sat.inclinationDeg);
  const node = (index * Math.PI) / 4;
  const x0 = r * Math.cos(theta);
  const y0 = r * Math.sin(theta);
  const y1 = y0 * Math.cos(inc);
  const z1 = y0 * Math.sin(inc);
  return new Cartesian3(x0 * Math.cos(node) - y1 * Math.sin(node), x0 * Math.sin(node) + y1 * Math.cos(node), z1);
}

const orbitPeriodSeconds = (sat: NasaSatelliteData) =>
  2 * Math.PI * Math.sqrt(Math.pow(EARTH_RADIUS_KM + sat.altitudeKm, 3) / EARTH_MU_KM3_S2);

const round2 = (n: number) => Number(n.toFixed(2));

/** Tiles come from NASA GIBS in the same Web Mercator grid Cesium expects. */
function gibsLayer(
  template: string,
  maximumLevel: number,
  options: { alpha?: number; blackIsEmpty?: boolean; onTileError?: () => void } = {}
): CesiumImageryLayer {
  const provider = new UrlTemplateImageryProvider({
    url: template,
    tilingScheme: new WebMercatorTilingScheme(),
    maximumLevel,
    credit: 'NASA EOSDIS GIBS'
  });
  if (options.onTileError) {
    provider.errorEvent.addEventListener(() => options.onTileError?.());
  }
  const layer = new CesiumImageryLayer(provider, {
    alpha: options.alpha ?? 1,
    ...(options.blackIsEmpty ? { colorToAlpha: Color.BLACK, colorToAlphaThreshold: 0.12 } : {})
  });
  return layer;
}

export const InteractiveEarthGlobe: React.FC<InteractiveEarthGlobeProps> = ({
  selectedRegion,
  onSelectRegion,
  selectedVariable,
  onLaunchLab,
  onCoordinatePicked
}) => {
  const mappedLayer = layerKeyForVariable(selectedVariable.id) as GlobeLayerMode | null;
  const [activeLayer, setActiveLayer] = useState<GlobeLayerMode>(mappedLayer && layerInfo(mappedLayer) ? mappedLayer : 'live');
  const [catalog, setCatalog] = useState<Record<string, ImageryLayer>>({});
  const [baseInfo, setBaseInfo] = useState<LayersResponse['base'] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [date, setDate] = useState<string>('');
  const [viewerReady, setViewerReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [hoveredHotspot, setHoveredHotspot] = useState<RegionHotspot | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<NasaSatelliteData | null>(null);
  const [showSatellites, setShowSatellites] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pickedCoordinates, setPickedCoordinates] = useState<{ lat: number; lon: number }>({
    lat: selectedRegion.coordinates.lat,
    lon: selectedRegion.coordinates.lon
  });

  const mountRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<CustomDataSource | null>(null);
  const satellitesRef = useRef<CustomDataSource | null>(null);
  const baseLayerRef = useRef<CesiumImageryLayer | null>(null);
  const dataLayersRef = useRef<CesiumImageryLayer[]>([]);
  const tileErrorsRef = useRef(0);
  const autoRotateRef = useRef(autoRotate);
  const interactingRef = useRef(false);
  const flyingRef = useRef(false);
  const firstRegionRef = useRef(true);
  const propsRef = useRef({ onSelectRegion, onCoordinatePicked });
  propsRef.current = { onSelectRegion, onCoordinatePicked };
  autoRotateRef.current = autoRotate;

  // Build the CesiumJS globe once: no Cesium ion, no default imagery, only NASA data.
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let viewer: Viewer;
    try {
      viewer = new Viewer(container, {
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        scene3DOnly: true,
        skyBox: false,
        // A see-through canvas lets the page gradient show behind the planet
        contextOptions: { webgl: { alpha: true } },
        creditContainer: creditRef.current ?? undefined
      });
    } catch {
      setInitError('This browser could not start WebGL, which the 3D globe needs.');
      return;
    }
    viewerRef.current = viewer;
    const scene = viewer.scene;
    scene.backgroundColor = Color.TRANSPARENT;
    // The default atmosphere glow blends to black over a see-through canvas, so it is switched off
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.globe.showGroundAtmosphere = false;
    if (scene.sun) scene.sun.show = false;
    if (scene.moon) scene.moon.show = false;
    scene.globe.baseColor = Color.fromCssColorString(GLOBE_BASE);
    scene.globe.enableLighting = false;
    scene.postProcessStages.fxaa.enabled = true;
    const camCtl = scene.screenSpaceCameraController;
    camCtl.minimumZoomDistance = MIN_ZOOM_M;
    camCtl.maximumZoomDistance = MAX_ZOOM_M;
    camCtl.enableTilt = false;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(selectedRegion.coordinates.lon, selectedRegion.coordinates.lat, HOME_ALTITUDE_M)
    });

    // Data sources for the markers and the NASA satellite fleet
    const markers = new CustomDataSource('hotspots');
    const sats = new CustomDataSource('satellites');
    markersRef.current = markers;
    satellitesRef.current = sats;
    void viewer.dataSources.add(markers);
    void viewer.dataSources.add(sats);

    NASA_SATELLITE_FLEET.forEach((sat, idx) => {
      const color = Color.fromCssColorString(sat.color);
      const ring: Cartesian3[] = [];
      for (let a = 0; a <= 360; a += 3) ring.push(orbitPoint(sat, idx, CesiumMath.toRadians(a)));
      const period = orbitPeriodSeconds(sat);
      sats.entities.add({
        id: `sat:${sat.id}`,
        name: sat.name,
        position: new CallbackPositionProperty(() => {
          const theta = (2 * Math.PI * ((performance.now() / 1000) * ORBIT_SPEEDUP)) / period;
          return orbitPoint(sat, idx, theta);
        }, false),
        point: { pixelSize: 9, color, outlineColor: Color.WHITE, outlineWidth: 2 },
        label: {
          text: sat.name.split(' (')[0],
          font: '600 11px Inter, system-ui, sans-serif',
          fillColor: Color.fromCssColorString('#0f172a'),
          outlineColor: Color.WHITE,
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(12, 0)
        }
      });
      sats.entities.add({
        id: `orbit:${sat.id}`,
        polyline: { positions: ring, width: 2, arcType: ArcType.NONE, material: color }
      });
    });

    // Picking: satellites and hotspot beacons, otherwise a point on the planet
    const handler = new ScreenSpaceEventHandler(scene.canvas);
    const entityIdAt = (position: Cartesian2): string | undefined => {
      const hit = scene.pick(position, 14, 14);
      return hit && hit.id instanceof Entity ? String(hit.id.id) : undefined;
    };

    handler.setInputAction((click: { position: Cartesian2 }) => {
      const id = entityIdAt(click.position);
      if (id?.startsWith('sat:')) {
        setSelectedSatellite(NASA_SATELLITE_FLEET.find(s => `sat:${s.id}` === id) ?? null);
        return;
      }
      if (id?.startsWith('hot:')) {
        const spot = PLANETARY_HOTSPOTS.find(h => `hot:${h.id}` === id);
        if (spot) {
          propsRef.current.onSelectRegion(spot);
          setAutoRotate(false);
        }
        return;
      }
      const hit = viewer.camera.pickEllipsoid(click.position, scene.globe.ellipsoid);
      if (!hit) return;
      const carto = Cartographic.fromCartesian(hit);
      const coords = { lat: round2(CesiumMath.toDegrees(carto.latitude)), lon: round2(CesiumMath.toDegrees(carto.longitude)) };
      setPickedCoordinates(coords);
      propsRef.current.onCoordinatePicked?.(coords);
      propsRef.current.onSelectRegion({
        id: `custom_${coords.lat}_${coords.lon}`,
        name: `Custom Point (${coords.lat >= 0 ? coords.lat + '°N' : Math.abs(coords.lat) + '°S'}, ${coords.lon >= 0 ? coords.lon + '°E' : Math.abs(coords.lon) + '°W'})`,
        coordinates: coords,
        biome: Math.abs(coords.lat) > 66 ? 'Polar / Cryosphere' : Math.abs(coords.lat) < 23 ? 'Tropical / Equatorial' : 'Temperate Continental',
        description: 'A point you clicked on the globe.',
        continent: coords.lon < -30 ? 'Americas' : coords.lon > 60 ? 'Asia / Oceania' : 'Europe / Africa'
      });
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((move: { endPosition: Cartesian2 }) => {
      const id = entityIdAt(move.endPosition);
      const spot = id?.startsWith('hot:') ? PLANETARY_HOTSPOTS.find(h => `hot:${h.id}` === id) ?? null : null;
      scene.canvas.style.cursor = id ? 'pointer' : '';
      setHoveredHotspot(prev => (prev?.id === spot?.id ? prev : spot));
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Pause the slow spin while the user is dragging or pinching
    const press = () => {
      interactingRef.current = true;
    };
    const release = () => {
      interactingRef.current = false;
    };
    [ScreenSpaceEventType.LEFT_DOWN, ScreenSpaceEventType.RIGHT_DOWN, ScreenSpaceEventType.MIDDLE_DOWN, ScreenSpaceEventType.PINCH_START].forEach(t =>
      handler.setInputAction(press, t)
    );
    [ScreenSpaceEventType.LEFT_UP, ScreenSpaceEventType.RIGHT_UP, ScreenSpaceEventType.MIDDLE_UP, ScreenSpaceEventType.PINCH_END].forEach(t =>
      handler.setInputAction(release, t)
    );

    let last = performance.now();
    const removeSpin = scene.postRender.addEventListener(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!autoRotateRef.current || interactingRef.current || flyingRef.current) return;
      if (viewer.camera.positionCartographic.height < 3_000_000) return;
      viewer.camera.rotate(Cartesian3.UNIT_Z, -0.06 * dt);
    });

    const removeProgress = scene.globe.tileLoadProgressEvent.addEventListener((pending: number) => {
      setTilesLoading(pending > 0);
    });

    setViewerReady(true);
    return () => {
      removeSpin();
      removeProgress();
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
      markersRef.current = null;
      satellitesRef.current = null;
      baseLayerRef.current = null;
      dataLayersRef.current = [];
      setViewerReady(false);
    };
    // The viewer is created once; later changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the scientific variable the user picked in the wizard
  useEffect(() => {
    const k = layerKeyForVariable(selectedVariable.id) as GlobeLayerMode | null;
    if (k && GLOBE_LAYERS.some(l => l.key === k)) setActiveLayer(k);
  }, [selectedVariable.id]);

  // Which days NASA has for each layer, and the base map
  useEffect(() => {
    let alive = true;
    fetchLayers()
      .then(r => {
        if (!alive) return;
        setCatalog(Object.fromEntries(r.layers.map(l => [l.key, l])));
        setBaseInfo(r.base);
        const terra = r.layers.find(l => l.key === 'terra');
        // Yesterday's mosaic can still be arriving; the day before is complete.
        if (terra) setDate(addDays(terra.end, -1));
      })
      .catch(() => alive && setCatalogError(true));
    return () => {
      alive = false;
    };
  }, []);

  const info = layerInfo(activeLayer);
  const entry = info.catalogKeys[0] ? catalog[info.catalogKeys[0]] : undefined;
  const dated = info.key !== 'bluemarble' && !entry?.fixedTime;
  const effectiveDate = dated && entry && date ? clampDate(date, entry) : '';
  const waitingForCatalog = dated && !effectiveDate && !catalogError;

  // Bottom of the stack: NASA Blue Marble, so gaps between satellite passes are never empty
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer || !baseInfo) return;
    const layer = gibsLayer(baseInfo.template, baseInfo.maxZoom);
    viewer.imageryLayers.add(layer, 0);
    baseLayerRef.current = layer;
    return () => {
      if (!viewer.isDestroyed()) viewer.imageryLayers.remove(layer, true);
      baseLayerRef.current = null;
    };
  }, [viewerReady, baseInfo]);

  // The NASA layer for the chosen product and day, streamed as tiles
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer || !baseInfo || waitingForCatalog || dated && !effectiveDate) return;

    tileErrorsRef.current = 0;
    setTilesFailed(false);
    const onTileError = () => {
      tileErrorsRef.current += 1;
      if (tileErrorsRef.current === 6) setTilesFailed(true);
    };
    const withDay = (e: ImageryLayer, day: string) => e.tileTemplate.replace('{time}', clampDate(day, e));

    const created: CesiumImageryLayer[] = [];
    if (info.key === 'live') {
      // Aqua under Terra: each leaves black no-data wedges, which are made transparent so the other pass (or Blue Marble) shows through
      const aqua = catalog.aqua;
      const terra = catalog.terra;
      if (aqua) created.push(gibsLayer(withDay(aqua, effectiveDate), aqua.maxZoom, { blackIsEmpty: true, onTileError }));
      if (terra) created.push(gibsLayer(withDay(terra, effectiveDate), terra.maxZoom, { blackIsEmpty: true, onTileError }));
    } else if (info.key !== 'bluemarble' && entry) {
      const tpl = entry.fixedTime ? entry.tileTemplate : withDay(entry, effectiveDate);
      created.push(gibsLayer(tpl, entry.maxZoom, { alpha: entry.group === 'science' ? 0.92 : 1, onTileError }));
    }
    created.forEach(l => viewer.imageryLayers.add(l));

    // Keep the previous picture until the new tiles have arrived, so the globe never flashes empty
    const previous = dataLayersRef.current;
    dataLayersRef.current = created;
    const dropPrevious = () => {
      previous.forEach(l => {
        if (!viewer.isDestroyed()) viewer.imageryLayers.remove(l, true);
      });
    };
    let stopWatching: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      stopWatching?.();
      dropPrevious();
    }, 12000);
    if (previous.length) {
      stopWatching = viewer.scene.globe.tileLoadProgressEvent.addEventListener((pending: number) => {
        if (pending === 0) {
          stopWatching?.();
          window.clearTimeout(timer);
          dropPrevious();
        }
      });
    } else {
      window.clearTimeout(timer);
    }
    return () => {
      window.clearTimeout(timer);
      stopWatching?.();
      dropPrevious();
    };
  }, [viewerReady, baseInfo, catalog, info.key, entry, effectiveDate, dated, waitingForCatalog]);

  // Hotspot beacons, the selected one highlighted, plus a pin for a clicked point
  useEffect(() => {
    const markers = markersRef.current;
    if (!viewerReady || !markers) return;
    markers.entities.removeAll();
    PLANETARY_HOTSPOTS.forEach(spot => {
      const selected = selectedRegion.id === spot.id;
      markers.entities.add({
        id: `hot:${spot.id}`,
        name: spot.name,
        position: Cartesian3.fromDegrees(spot.coordinates.lon, spot.coordinates.lat),
        point: {
          pixelSize: selected ? 16 : 11,
          color: selected ? Color.fromCssColorString('#00b4d8') : Color.fromCssColorString('#f59e0b'),
          outlineColor: Color.WHITE,
          outlineWidth: selected ? 3 : 2
        }
      });
    });
    if (selectedRegion.id.startsWith('custom_')) {
      markers.entities.add({
        id: 'picked',
        position: Cartesian3.fromDegrees(pickedCoordinates.lon, pickedCoordinates.lat),
        point: { pixelSize: 13, color: Color.fromCssColorString('#10b981'), outlineColor: Color.WHITE, outlineWidth: 3 }
      });
    }
  }, [viewerReady, selectedRegion.id, pickedCoordinates.lat, pickedCoordinates.lon]);

  useEffect(() => {
    if (satellitesRef.current) satellitesRef.current.show = showSatellites;
  }, [showSatellites, viewerReady]);

  // Fly to whatever region is selected (the first render already starts there)
  useEffect(() => {
    setPickedCoordinates(selectedRegion.coordinates);
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer) return;
    if (firstRegionRef.current) {
      firstRegionRef.current = false;
      return;
    }
    const height = Math.min(Math.max(viewer.camera.positionCartographic.height, 1_500_000), 8_000_000);
    flyingRef.current = true;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(selectedRegion.coordinates.lon, selectedRegion.coordinates.lat, height),
      duration: 1.6,
      complete: () => {
        flyingRef.current = false;
        setAutoRotate(false);
      },
      cancel: () => {
        flyingRef.current = false;
      }
    });
  }, [viewerReady, selectedRegion]);

  const handleZoom = useCallback((factor: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const height = viewer.camera.positionCartographic.height;
    if (factor > 0) viewer.camera.zoomIn(Math.max(0, Math.min(height * factor, height - MIN_ZOOM_M)));
    else viewer.camera.zoomOut(Math.min(height * -factor, MAX_ZOOM_M - height > 0 ? MAX_ZOOM_M - height : 0));
  }, []);

  const handleResetCamera = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    flyingRef.current = true;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(selectedRegion.coordinates.lon, selectedRegion.coordinates.lat, HOME_ALTITUDE_M),
      duration: 1.2,
      complete: () => {
        flyingRef.current = false;
      },
      cancel: () => {
        flyingRef.current = false;
      }
    });
  }, [selectedRegion]);

  const texState: { status: 'loading' | 'ready' | 'error'; message?: string } = initError
    ? { status: 'error', message: initError }
    : catalogError || (dated && !effectiveDate && !waitingForCatalog)
      ? { status: 'error', message: 'NASA\'s list of available days could not be loaded. No picture is shown.' }
      : tilesFailed && !tilesLoading
        ? { status: 'error', message: 'Some NASA tiles for this day could not be loaded. Try another day.' }
        : waitingForCatalog || tilesLoading || !viewerReady
          ? { status: 'loading' }
          : { status: 'ready' };

  return (
    <div
      ref={globeContainerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-white border border-sky-200 ring-1 ring-inset ring-white/80 shadow-card transition-all flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : ''
      }`}
    >
      <div className={`relative w-full bg-gradient-to-br from-sky-100 via-white to-indigo-100 ${isFullscreen ? 'flex-1 min-h-0' : 'h-[520px] sm:h-[600px]'}`}>
      {/* CesiumJS globe mounts here */}
      <div ref={mountRef} className="w-full h-full block select-none" />

      {/* TOP LEFT: Telemetry HUD */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <div className="flex items-center space-x-2.5 bg-white/85 backdrop-blur-xl px-3.5 py-2 rounded-xl border border-sky-200 shadow-card">
          <Globe2 className={`w-4 h-4 text-sky-600 origin-center ${texState.status === 'loading' ? 'animate-spin' : ''}`} />
          <div>
            <div className="text-[11px] font-semibold text-slate-900 tracking-tight">
              NASA imagery · {info.label}
            </div>
            <div className="text-[10px] text-slate-600 font-mono">
              {texState.status === 'loading'
                ? 'Loading from NASA GIBS…'
                : `Target: ${formatCoords(pickedCoordinates.lat, pickedCoordinates.lon, 1)}`}
            </div>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: NASA layer switcher */}
      <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-1.5 bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl border border-sky-200 shadow-card max-w-xl justify-end">
        {(['live', 'bluemarble', 'night'] as GlobeLayerMode[]).map(k => {
          const l = layerInfo(k);
          const Icon = k === 'night' ? Moon : Globe2;
          return (
            <button
              key={k}
              onClick={() => setActiveLayer(k)}
              aria-pressed={activeLayer === k}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all ${
                activeLayer === k ? 'bg-blue-600 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-700 hover:text-slate-900 hover:bg-sky-50'
              }`}
              title={`${l.label}: ${l.sensor}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{l.label}</span>
            </button>
          );
        })}

        <label
          className={`flex items-center space-x-1.5 pl-2.5 pr-1.5 py-1 rounded-xl text-xs border transition-colors ${
            DATA_LAYER_KEYS.includes(activeLayer) ? 'bg-blue-600 border-blue-500 text-white' : 'border-sky-200 text-slate-700 bg-white/70'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="sr-only">NASA data layer</span>
          <select
            value={DATA_LAYER_KEYS.includes(activeLayer) ? activeLayer : ''}
            onChange={e => e.target.value && setActiveLayer(e.target.value as GlobeLayerMode)}
            className="bg-transparent focus:outline-none cursor-pointer text-xs font-medium max-w-[9.5rem]"
          >
            <option value="" className="bg-white text-slate-900">Data layers…</option>
            {DATA_LAYER_KEYS.map(k => (
              <option key={k} value={k} className="bg-white text-slate-900">
                {layerInfo(k).label}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => setShowSatellites(!showSatellites)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all border ${
            showSatellites
              ? 'bg-blue-50 text-blue-700 border-blue-300'
              : 'text-slate-600 border-sky-200 hover:bg-sky-50'
          }`}
          title="Show the NASA satellites' orbits (schematic)"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>Satellites</span>
        </button>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-700 border border-sky-200 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Globe'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen globe'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* BOTTOM LEFT: Hotspot Quick Jumper */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 max-w-lg">
        <div className="bg-white/90 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-sky-200 shadow-card text-xs flex items-center space-x-2">
          <MapPin className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] text-slate-600 font-medium">Quick Fly-To:</span>
          <select
            value={selectedRegion.id}
            onChange={e => {
              const r = PLANETARY_HOTSPOTS.find(item => item.id === e.target.value);
              if (r) onSelectRegion(r);
            }}
            className="bg-transparent text-slate-900 font-medium focus:outline-none cursor-pointer text-xs"
          >
            {PLANETARY_HOTSPOTS.map(spot => (
              <option key={spot.id} value={spot.id} className="bg-white text-slate-900">
                {spot.name.split('(')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* BOTTOM RIGHT: Minimalist Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-1.5 bg-white/90 backdrop-blur-xl p-1.5 rounded-xl border border-sky-200 shadow-card">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2 rounded-lg text-xs transition-colors ${
            autoRotate ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-sky-50'
          }`}
          title={autoRotate ? 'Pause Rotation' : 'Auto-Rotate Globe'}
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          onClick={() => handleZoom(0.4)}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-sky-50 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => handleZoom(-0.4)}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-sky-50 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetCamera}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-sky-50 transition-colors"
          title="Reset View"
        >
          <Compass className="w-4 h-4" />
        </button>

        <button
          onClick={onLaunchLab}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm ring-1 ring-white/10 transition-transform active:scale-95 ml-1"
        >
          <span>Run Lab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SATELLITE INSPECTION POPUP */}
      {selectedSatellite && (
        <div className="absolute top-20 left-4 z-30 bg-white/95 backdrop-blur-xl border border-sky-200 rounded-2xl p-4 shadow-elevated max-w-xs text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-slate-900 flex items-center space-x-1.5">
              <Satellite className="w-4 h-4 text-blue-600" />
              <span>{selectedSatellite.name}</span>
            </span>
            <button
              onClick={() => setSelectedSatellite(null)}
              className="text-slate-500 hover:text-slate-900 text-xs px-1"
            >
              ✕
            </button>
          </div>
          <div className="text-[11px] text-blue-700 font-medium mb-1">{selectedSatellite.mission}</div>
          <p className="text-[11px] text-slate-700 leading-relaxed mb-2.5">{selectedSatellite.description}</p>
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-sky-100 text-[10px] text-slate-600 font-mono">
            <div>Altitude: <span className="text-slate-900">{selectedSatellite.altitudeKm} km</span></div>
            <div>Speed: <span className="text-slate-900">{selectedSatellite.speedKmS} km/s</span></div>
            <div>Inclination: <span className="text-slate-900">{selectedSatellite.inclinationDeg}°</span></div>
          </div>
          <div className="mt-2 text-[10px] text-slate-600">
            Sensors: <span className="text-blue-700 font-mono">{selectedSatellite.sensors}</span>
          </div>
        </div>
      )}

      {/* HOVER HOTSPOT CARD */}
      {hoveredHotspot && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-white/95 backdrop-blur-xl border border-sky-200 rounded-xl px-4 py-2 shadow-elevated text-center max-w-sm">
          <div className="flex items-center justify-center space-x-1.5 text-xs text-amber-700 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{hoveredHotspot.name}</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">{hoveredHotspot.biome}</div>
        </div>
      )}

      {/* Bottom Control Instruction */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none text-[11px] text-slate-700 bg-white/85 backdrop-blur-md px-3.5 py-1 rounded-full border border-sky-200 hidden xl:block">
        Drag to rotate • Scroll to zoom • Click beacons or satellites to inspect
      </div>
      </div>

      {/* Footer: what this picture is, the day, and how to read the colours */}
      <div className="border-t border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-4 py-3 space-y-2" role="region" aria-label="Globe layer details">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">{info.label}</span>
            <span className="text-slate-500"> · </span>
            <span className="font-mono text-[11px] text-sky-700">{info.sensor}</span>
            {entry && <span className="font-mono text-[11px] text-slate-600"> · {entry.resolution}</span>}
            <p className="text-[11px] text-slate-600 mt-0.5 max-w-2xl">{info.description}</p>
          </div>

          {dated && entry && (
            <div className="flex items-center gap-1.5" role="group" aria-label="Day shown on the globe">
              <button
                onClick={() => setDate(clampDate(addDays(effectiveDate, -1), entry))}
                disabled={effectiveDate <= entry.start}
                className="px-2 py-1 rounded-lg text-xs text-slate-700 bg-white border border-sky-200 hover:bg-sky-50 disabled:opacity-40"
                aria-label="Previous day"
              >
                ‹
              </button>
              <input
                type="date"
                value={effectiveDate}
                min={entry.start}
                max={entry.end}
                onChange={e => e.target.value && setDate(clampDate(e.target.value, entry))}
                aria-label="Day"
                className="bg-white border border-sky-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-mono [color-scheme:light]"
              />
              <button
                onClick={() => setDate(clampDate(addDays(effectiveDate, 1), entry))}
                disabled={effectiveDate >= entry.end}
                className="px-2 py-1 rounded-lg text-xs text-slate-700 bg-white border border-sky-200 hover:bg-sky-50 disabled:opacity-40"
                aria-label="Next day"
              >
                ›
              </button>
              <button
                onClick={() => setDate(addDays(catalog.terra?.end ?? entry.end, -1))}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-sky-700 bg-white border border-sky-300 hover:bg-sky-50"
              >
                Latest
              </button>
            </div>
          )}
          {!dated && info.key === 'night' && <span className="text-[11px] font-mono text-slate-600">2016 composite</span>}
        </div>

        {entry?.ramp && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600">
            <span>{entry.rampLow}</span>
            <span
              className="h-2 w-40 rounded-full border border-sky-200"
              style={{ background: `linear-gradient(90deg, ${entry.ramp.join(', ')})` }}
              aria-hidden="true"
            />
            <span>{entry.rampHigh}</span>
          </div>
        )}

        {texState.status === 'error' && (
          <p className="text-[11px] text-amber-700" role="alert">
            {texState.message}
          </p>
        )}

        <p className="text-[10px] text-slate-600">
          {dated && effectiveDate ? `Imagery of ${formatDay(effectiveDate)}. ` : ''}
          Source: NASA EOSDIS Global Imagery Browse Services (GIBS), drawn with CesiumJS. Satellite orbits are drawn at real altitude and tilt, sped up, and are not live tracks.
          NASA does not endorse this application.
        </p>
        <div ref={creditRef} className="ep-cesium-credit text-[10px] text-slate-600" />
      </div>
    </div>
  );
};
