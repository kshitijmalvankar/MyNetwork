"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type ForceGraphType from "force-graph";
import type { GraphLink, GraphNode, NodeKind } from "@/lib/graph-model";

/**
 * Node colours by kind. These three slots of the reference palette are the
 * only ones that stay distinguishable (incl. colour-blind) when any two sit
 * side by side; shape is a second cue, so colour never carries meaning alone.
 */
export const KIND_COLORS: Record<"light" | "dark", Record<NodeKind, string>> = {
  light: { person: "#2a78d6", company: "#eb6834", event: "#1baf7a" },
  dark: { person: "#3987e5", company: "#d95926", event: "#199e70" },
};

type Theme = { mode: "light" | "dark"; surface: string; text: string; muted: string; line: string };

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const dark = document.documentElement.classList.contains("dark");
  return {
    mode: dark ? "dark" : "light",
    surface: v("--background", dark ? "#0a0a0a" : "#ffffff"),
    text: v("--foreground", dark ? "#fafafa" : "#0a0a0a"),
    muted: v("--muted-foreground", "#737373"),
    line: v("--border", dark ? "#333333" : "#e5e5e5"),
  };
}

type SimNode = GraphNode & { x?: number; y?: number };
type SimLink = Omit<GraphLink, "source" | "target"> & { source: string | SimNode; target: string | SimNode };

export type ForceCanvasHandle = { fit: (ids?: Set<string> | null) => void; focus: (id: string) => void };

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedId: string | null;
  /** Nodes to keep bright; everything else fades. Null means everything is bright. */
  emphasis: Set<string> | null;
  showSimilar: boolean;
  onSelect: (id: string | null) => void;
};

const endId = (end: string | SimNode) => (typeof end === "string" ? end : end.id);

function radius(n: GraphNode) {
  return n.kind === "person" ? 4.5 : 6 + Math.sqrt(n.size) * 2.2;
}

function drawShape(ctx: CanvasRenderingContext2D, n: SimNode, r: number) {
  const x = n.x ?? 0;
  const y = n.y ?? 0;
  ctx.beginPath();
  if (n.kind === "person") ctx.arc(x, y, r, 0, 2 * Math.PI);
  else if (n.kind === "company") ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.35);
  else {
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r * 1.2, y);
    ctx.lineTo(x, y + r * 1.2);
    ctx.lineTo(x - r * 1.2, y);
    ctx.closePath();
  }
}

/** The force-directed map itself (canvas). Labels are drawn on the canvas, never as HTML. */
export const ForceCanvas = forwardRef<ForceCanvasHandle, Props>(function ForceCanvas({ nodes, links, selectedId, emphasis, showSimilar, onSelect }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const graph = useRef<ForceGraphType<SimNode, SimLink> | null>(null);
  const theme = useRef<Theme | null>(null);
  const state = useRef({ selectedId, emphasis, showSimilar, hovered: null as string | null, near: new Set<string>() });
  const onSelectRef = useRef(onSelect);
  const fitted = useRef(false);
  // Drawing reads from refs, so tell the graph to repaint after they change.
  const redraw = () => graph.current?.linkWidth(graph.current.linkWidth());

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the graph once.
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let themeWatch: MutationObserver | undefined;
    void import("force-graph").then(({ default: ForceGraph }) => {
      if (disposed || !container.current) return;
      theme.current = readTheme();
      const el = container.current;
      const g = new ForceGraph<SimNode, SimLink>(el)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .nodeId("id")
        .nodeLabel(() => "")
        .cooldownTicks(250)
        .d3VelocityDecay(0.3)
        .minZoom(0.2)
        .maxZoom(8)
        .nodePointerAreaPaint((n, color, ctx) => {
          ctx.fillStyle = color;
          drawShape(ctx, n, radius(n) + 3);
          ctx.fill();
        })
        .nodeCanvasObject((n, ctx, scale) => {
          const t = theme.current!;
          const s = state.current;
          const r = radius(n);
          const focused = n.id === s.selectedId || n.id === s.hovered;
          const faded = s.emphasis ? !s.emphasis.has(n.id) : s.selectedId ? !focused && !s.near.has(n.id) : false;
          ctx.globalAlpha = faded ? 0.15 : 1;
          drawShape(ctx, n, focused ? r * 1.25 : r);
          ctx.fillStyle = KIND_COLORS[t.mode][n.kind];
          ctx.fill();
          ctx.lineWidth = (focused ? 2.5 : 1.5) / scale;
          ctx.strokeStyle = focused ? t.text : t.surface;
          ctx.stroke();

          const hub = n.kind !== "person";
          // Name a handful of highlighted people at any zoom; with many, wait until zoomed in.
          const highlighted = s.emphasis?.has(n.id) && (s.emphasis.size <= 40 || scale > 0.9);
          // Zoomed out, only the bigger companies and events are named so labels don't pile up.
          const hubLabel = scale > 1.1 || (scale > 0.6 && n.size >= 3) || (s.selectedId !== null && s.near.has(n.id));
          const showLabel = focused || (!faded && (hub ? hubLabel : scale > 1.8 || (s.selectedId !== null && s.near.has(n.id)) || highlighted));
          if (showLabel) {
            const size = (hub ? 12 : 11) / scale;
            ctx.font = `${hub || focused ? 600 : 500} ${size}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const label = n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label;
            const y = (n.y ?? 0) + (hub ? r * 1.25 : r) + 3 / scale;
            ctx.lineWidth = 3 / scale;
            ctx.strokeStyle = t.surface;
            ctx.strokeText(label, n.x ?? 0, y);
            ctx.fillStyle = hub || focused ? t.text : t.muted;
            ctx.fillText(label, n.x ?? 0, y);
          }
          ctx.globalAlpha = 1;
        })
        .linkColor((l) => {
          const t = theme.current!;
          const s = state.current;
          const ends = [endId(l.source), endId(l.target)];
          if (s.selectedId && ends.includes(s.selectedId)) return t.text;
          return l.kind === "similar" ? t.muted : t.line;
        })
        .linkWidth((l) => {
          const s = state.current;
          return s.selectedId && [endId(l.source), endId(l.target)].includes(s.selectedId) ? 1.6 : l.kind === "similar" ? 0.8 : 1;
        })
        .linkLineDash((l) => (l.kind === "similar" ? [3, 3] : null))
        .linkVisibility((l) => {
          const s = state.current;
          const ends = [endId(l.source), endId(l.target)];
          // Similar-background links show when switched on, and always for the selected person.
          if (l.kind === "similar" && !s.showSimilar && !(s.selectedId && ends.includes(s.selectedId))) return false;
          if (!s.emphasis) return true;
          return s.emphasis.has(ends[0]) && s.emphasis.has(ends[1]);
        })
        .onNodeHover((n) => {
          state.current.hovered = n?.id ?? null;
          el.style.cursor = n ? "pointer" : "grab";
          redraw();
        })
        .onNodeClick((n) => onSelectRef.current(n.id))
        .onBackgroundClick(() => onSelectRef.current(null))
        .onEngineStop(() => {
          if (!fitted.current) {
            fitted.current = true;
            // First layout: frame whatever is highlighted (e.g. people from an Ask answer), else everything.
            const focus = state.current.emphasis;
            g.zoomToFit(400, 48, focus?.size ? (n) => focus.has(n.id) : undefined);
          }
        });

      // Hubs push harder; similar-background links pull gently so they don't distort clusters.
      const charge = g.d3Force("charge");
      charge?.strength?.((n: SimNode) => (n.kind === "person" ? -40 : -160));
      const link = g.d3Force("link");
      link?.distance?.((l: SimLink) => (l.kind === "similar" ? 70 : l.kind === "met" ? 45 : 30));
      link?.strength?.((l: SimLink) => (l.kind === "similar" ? 0.04 : 0.6));

      graph.current = g;
      g.graphData({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) });

      resize = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
      resize.observe(el);
      themeWatch = new MutationObserver(() => {
        theme.current = readTheme();
        redraw();
      });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    });
    return () => {
      disposed = true;
      resize?.disconnect();
      themeWatch?.disconnect();
      graph.current?._destructor();
      graph.current = null;
    };
    // The data effect below keeps the graph in sync after creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New nodes/links: keep positions of nodes that stay, so the map doesn't jump.
  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    const old = new Map(g.graphData().nodes.map((n) => [n.id, n]));
    g.graphData({
      nodes: nodes.map((n) => ({ ...n, x: old.get(n.id)?.x, y: old.get(n.id)?.y })),
      links: links.map((l) => ({ ...l })),
    });
  }, [nodes, links]);

  // Selection and emphasis only change how things are drawn.
  useEffect(() => {
    const near = new Set<string>();
    if (selectedId)
      for (const l of links) {
        if (l.source === selectedId) near.add(l.target);
        if (l.target === selectedId) near.add(l.source);
      }
    state.current = { ...state.current, selectedId, emphasis, showSimilar, near };
    redraw();
  }, [selectedId, emphasis, showSimilar, links]);

  useImperativeHandle(ref, () => ({
    fit: (ids) => graph.current?.zoomToFit(500, 56, ids?.size ? (n) => ids.has(n.id) : undefined),
    focus: (id) => {
      const g = graph.current;
      const n = g?.graphData().nodes.find((x) => x.id === id);
      if (!g || n?.x === undefined || n.y === undefined) return;
      g.centerAt(n.x, n.y, 500);
      g.zoom(Math.max(g.zoom(), 2.2), 500);
    },
  }));

  return <div ref={container} className="size-full cursor-grab touch-none" role="img" aria-label="Map of your network. Use the list view for a text version." />;
});
