"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker, Polygon, ZoomAnimEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DiningTable, MapShape, MapShapeKind } from "@/lib/types";

type LeafletNamespace = typeof import("leaflet");

export type ShapeRect = { x: number; y: number; width: number; height: number };

export type MapSelection = { type: "table"; id: number } | { type: "shape"; id: number } | null;

type TableMapProps = {
  tables: DiningTable[];
  shapes: MapShape[];
  selection: MapSelection;
  mode: "admin" | "kasir";
  onSelectTable: (table: DiningTable) => void;
  onSelectShape?: (shape: MapShape) => void;
  onClearSelection?: () => void;
  onMoveTable?: (table: DiningTable, x: number, y: number) => void;
  onChangeShape?: (shape: MapShape, rect: ShapeRect) => Promise<boolean>;
  className?: string;
};

type Corner = "nw" | "ne" | "se" | "sw";

const BOUNDS: [[number, number], [number, number]] = [[0, 0], [100, 100]];
const GRID_STEP = 10;
const MIN_SHAPE_SIZE = 2;
const ELLIPSE_SEGMENTS = 48;
const CORNERS: Corner[] = ["nw", "ne", "se", "sw"];
const SHAPE_STYLE: Record<MapShapeKind, { fill: string; stroke: string; fillOpacity: number }> = {
  rectangle: { fill: "#86efac", stroke: "#15803d", fillOpacity: 0.35 },
  ellipse: { fill: "#86efac", stroke: "#15803d", fillOpacity: 0.35 },
  wall: { fill: "#44403c", stroke: "#1c1917", fillOpacity: 0.9 },
  counter: { fill: "#d6b98c", stroke: "#92400e", fillOpacity: 0.75 },
};
const MOVE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg>`;

// Leaflet's ESM build exposes named exports, while the CJS fallback sits on `default`.
function resolveLeaflet(module: unknown): LeafletNamespace {
  const candidate = (module as { default?: LeafletNamespace }).default;
  return candidate?.map ? candidate : (module as LeafletNamespace);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const tabTotalFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function roundTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sameRect(a: ShapeRect, b: ShapeRect) {
  return Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05
    && Math.abs(a.width - b.width) < 0.05 && Math.abs(a.height - b.height) < 0.05;
}

function shapeOutline(kind: MapShapeKind, rect: ShapeRect): [number, number][] {
  const { x, y, width, height } = rect;
  if (kind !== "ellipse") {
    return [[100 - y, x], [100 - y, x + width], [100 - (y + height), x + width], [100 - (y + height), x]];
  }
  const cx = x + width / 2;
  const cy = y + height / 2;
  return Array.from({ length: ELLIPSE_SEGMENTS }, (_, index): [number, number] => {
    const angle = (index / ELLIPSE_SEGMENTS) * Math.PI * 2;
    return [100 - (cy + (height / 2) * Math.sin(angle)), cx + (width / 2) * Math.cos(angle)];
  });
}

function cornerPosition(corner: Corner, rect: ShapeRect): [number, number] {
  const east = corner === "ne" || corner === "se";
  const south = corner === "se" || corner === "sw";
  const x = east ? rect.x + rect.width : rect.x;
  const y = south ? rect.y + rect.height : rect.y;
  return [100 - y, x];
}

function centerPosition(rect: ShapeRect): [number, number] {
  return [100 - (rect.y + rect.height / 2), rect.x + rect.width / 2];
}

// The edge opposite the dragged one stays fixed; the dragged edge is kept at least MIN_SHAPE_SIZE away.
function fitAxis(value: number, fixed: number) {
  const target = clampRange(value, 0, 100);
  if (Math.abs(target - fixed) >= MIN_SHAPE_SIZE) return target;
  let direction = target >= fixed ? 1 : -1;
  const candidate = fixed + direction * MIN_SHAPE_SIZE;
  if (candidate < 0 || candidate > 100) direction = -direction;
  return fixed + direction * MIN_SHAPE_SIZE;
}

function resizeRect(origin: ShapeRect, corner: Corner, px: number, py: number): ShapeRect {
  const east = corner === "ne" || corner === "se";
  const south = corner === "se" || corner === "sw";
  const fixedX = east ? origin.x : origin.x + origin.width;
  const fixedY = south ? origin.y : origin.y + origin.height;
  const x = fitAxis(px, fixedX);
  const y = fitAxis(py, fixedY);
  return {
    x: roundTenth(Math.min(x, fixedX)),
    y: roundTenth(Math.min(y, fixedY)),
    width: roundTenth(Math.abs(x - fixedX)),
    height: roundTenth(Math.abs(y - fixedY)),
  };
}

function moveRect(origin: ShapeRect, centerX: number, centerY: number): ShapeRect {
  return {
    x: roundTenth(clampRange(centerX - origin.width / 2, 0, 100 - origin.width)),
    y: roundTenth(clampRange(centerY - origin.height / 2, 0, 100 - origin.height)),
    width: origin.width,
    height: origin.height,
  };
}

function addShapeHandles(
  L: LeafletNamespace,
  group: LayerGroup,
  origin: ShapeRect,
  layers: { kind: MapShapeKind; polygon: Polygon; label?: Marker },
  commit: (rect: ShapeRect) => Promise<boolean>,
) {
  const corners = CORNERS.map((corner) => ({
    corner,
    marker: L.marker(cornerPosition(corner, origin), {
      draggable: true,
      title: "Ubah ukuran",
      keyboard: false,
      icon: L.divIcon({
        className: `table-map-handle is-corner is-${corner}`,
        html: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(group),
  }));

  const moveHandle = L.marker(centerPosition(origin), {
    draggable: true,
    title: "Geser bentuk",
    keyboard: false,
    icon: L.divIcon({
      className: "table-map-handle is-move",
      html: MOVE_ICON,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    }),
  }).addTo(group);

  const preview = (rect: ShapeRect, except?: Marker) => {
    layers.polygon.setLatLngs(shapeOutline(layers.kind, rect));
    layers.label?.setLatLng(centerPosition(rect));
    for (const { corner, marker } of corners) {
      if (marker !== except) marker.setLatLng(cornerPosition(corner, rect));
    }
    if (moveHandle !== except) moveHandle.setLatLng(centerPosition(rect));
  };

  const finish = (rect: ShapeRect) => {
    preview(rect);
    if (sameRect(rect, origin)) return;
    void commit(rect).then((saved) => {
      if (!saved) preview(origin);
    });
  };

  for (const { corner, marker } of corners) {
    marker.on("drag", () => {
      const position = marker.getLatLng();
      preview(resizeRect(origin, corner, position.lng, 100 - position.lat), marker);
    });
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      finish(resizeRect(origin, corner, position.lng, 100 - position.lat));
    });
  }

  moveHandle.on("drag", () => {
    const position = moveHandle.getLatLng();
    preview(moveRect(origin, position.lng, 100 - position.lat), moveHandle);
  });
  moveHandle.on("dragend", () => {
    const position = moveHandle.getLatLng();
    finish(moveRect(origin, position.lng, 100 - position.lat));
  });
}

export function TableMap({
  tables,
  shapes,
  selection,
  mode,
  onSelectTable,
  onSelectShape,
  onClearSelection,
  onMoveTable,
  onChangeShape,
  className,
}: TableMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<{ L: LeafletNamespace; map: LeafletMap } | null>(null);
  const callbacksRef = useRef({ onSelectTable, onSelectShape, onClearSelection, onMoveTable, onChangeShape });
  const selectedTableId = selection?.type === "table" ? selection.id : null;
  const selectedShapeId = selection?.type === "shape" ? selection.id : null;

  useEffect(() => {
    callbacksRef.current = { onSelectTable, onSelectShape, onClearSelection, onMoveTable, onChangeShape };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let map: LeafletMap | undefined;
    let resizeObserver: ResizeObserver | undefined;

    void import("leaflet").then((module) => {
      if (disposed) return;
      const L = resolveLeaflet(module);
      const gridColor = "#d6d3d1";
      map = L.map(container, {
        crs: L.CRS.Simple,
        minZoom: -1,
        maxZoom: 3,
        zoomSnap: 0.25,
        attributionControl: false,
        maxBounds: [[-20, -20], [120, 120]],
        maxBoundsViscosity: 1,
      });

      const grid = L.layerGroup().addTo(map);
      for (let step = 0; step <= 100; step += GRID_STEP) {
        L.polyline([[step, 0], [step, 100]], { color: gridColor, weight: 1, interactive: false }).addTo(grid);
        L.polyline([[0, step], [100, step]], { color: gridColor, weight: 1, interactive: false }).addTo(grid);
      }

      map.fitBounds(BOUNDS, { padding: [16, 16] });

      // Table markers are HTML, so they scale with the zoom level manually to match the grid.
      const baseZoom = map.getZoom();
      const applyMarkerScale = (zoom: number) => {
        container.style.setProperty("--table-marker-scale", String(2 ** (zoom - baseZoom)));
      };
      map.on("zoomanim", (event: ZoomAnimEvent) => applyMarkerScale(event.zoom));
      map.on("zoomend", () => applyMarkerScale(map?.getZoom() ?? baseZoom));
      applyMarkerScale(baseZoom);

      map.on("click", (event) => {
        const target = event.originalEvent.target as Element | null;
        if (target?.closest(".leaflet-interactive, .leaflet-marker-icon")) return;
        callbacksRef.current.onClearSelection?.();
      });
      resizeObserver = new ResizeObserver(() => map?.invalidateSize());
      resizeObserver.observe(container);
      setInstance({ L, map });
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      map?.remove();
      setInstance(null);
    };
  }, []);

  useEffect(() => {
    if (!instance) return;
    const { L, map } = instance;
    if (!map.getPane("shapes")) {
      map.createPane("shapes").style.zIndex = "450";
    }
    const group: LayerGroup = L.layerGroup().addTo(map);
    const admin = mode === "admin";
    let pendingHandles: (() => void) | null = null;

    for (const shape of shapes) {
      const isSelected = shape.id === selectedShapeId;
      const style = SHAPE_STYLE[shape.kind];
      const rect: ShapeRect = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
      const polygon = L.polygon(shapeOutline(shape.kind, rect), {
        pane: "shapes",
        color: style.stroke,
        weight: isSelected ? 3 : 2,
        fillColor: style.fill,
        fillOpacity: style.fillOpacity,
        interactive: admin,
        className: isSelected ? "table-map-shape is-selected" : "table-map-shape",
      }).addTo(group);
      polygon.on("click", () => callbacksRef.current.onSelectShape?.(shape));

      const label = shape.label
        ? L.marker(centerPosition(rect), {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "table-map-shape-label-wrap",
            html: `<span class="table-map-shape-label${isSelected ? " is-above" : ""}">${escapeHtml(shape.label)}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        }).addTo(group)
        : undefined;

      if (admin && isSelected) {
        pendingHandles = () => addShapeHandles(L, group, rect, { kind: shape.kind, polygon, label }, (next) =>
          callbacksRef.current.onChangeShape ? callbacksRef.current.onChangeShape(shape, next) : Promise.resolve(false),
        );
      }
    }

    for (const table of tables) {
      const isSelected = table.id === selectedTableId;
      const status = table.openTab ? `Tab ${tabTotalFormatter.format(table.openTab.total)}` : table.occupied ? "Terisi" : "Kosong";
      const classes = [
        "table-marker",
        table.occupied ? "is-occupied" : "is-free",
        isSelected ? "is-selected" : "",
      ].filter(Boolean).join(" ");

      const icon = L.divIcon({
        className: "table-marker-wrap",
        html: `<div class="${classes}"><span class="table-marker-name">${escapeHtml(table.name)}</span><span class="table-marker-status">${status}</span></div>`,
        iconSize: [96, 56],
        iconAnchor: [48, 28],
      });

      const marker = L.marker([100 - table.y, table.x], {
        icon,
        draggable: admin,
        title: table.name,
      });
      marker.on("click", () => callbacksRef.current.onSelectTable(table));
      if (admin) {
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          callbacksRef.current.onMoveTable?.(table, clamp(position.lng), clamp(100 - position.lat));
        });
      }
      marker.addTo(group);
    }

    pendingHandles?.();

    return () => {
      group.remove();
    };
  }, [instance, tables, shapes, selectedTableId, selectedShapeId, mode]);


  return (
    <div className={`table-map ${className ?? ""}`.trim()}>
      <div
        ref={containerRef}
        className="table-map-canvas"
        role="application"
        aria-label="Denah meja"
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#2f9e6a]" /> Kosong</span>
        <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#d9822b]" /> Terisi</span>
        {mode === "admin" && <span>Geser meja untuk memindahkan posisinya</span>}
        {mode === "admin" && <span>Klik bentuk lalu tarik sudut untuk mengubah ukuran</span>}
      </div>
    </div>
  );
}
