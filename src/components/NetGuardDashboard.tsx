import React, { useEffect, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * NetGuard — Dashboard Blueprint (React + TypeScript + Recharts + Tailwind)
 *
 * Drop-in component. Replace the mock data generators (search "MOCK —")
 * with real calls to the Flask backend:
 *   - GET  /api/summary          -> stats
 *   - GET  /api/alerts           -> alerts
 *   - GET  /api/protocols        -> protocol breakdown
 *   - GET  /api/connections/geo  -> map pings
 *   - GET  /events (SSE)         -> live feed + traffic volume ticks
 *   - PATCH /api/config          -> threshold sliders
 */

// ---------- types ----------

type Severity = "critical" | "high" | "medium" | "low";

interface AlertItem {
  id: string;
  severity: Severity;
  title: string;
  meta: string;
}

interface ProtocolShare {
  name: "TCP" | "UDP" | "ICMP" | "Other";
  pct: number;
  color: string;
}

interface TrafficPoint {
  t: number; // seconds ago, 0 = now
  packets: number;
}

interface ConnectionPing {
  id: string;
  top: number; // percent
  left: number; // percent
  level: "normal" | "elevated" | "anomaly";
}

interface FeedLine {
  id: string;
  time: string;
  proto: "TCP" | "UDP" | "ICMP";
  src: string;
  dst: string;
  len: number;
  flagged: boolean;
}

interface Thresholds {
  portScanPorts: number; // ports/10s
  spikeMultiplier: number; // x baseline
  geoSensitivity: 1 | 2 | 3; // low/med/high
}

// ---------- design tokens (mirrors the HTML blueprint) ----------

const colors = {
  bg: "#0A0D12",
  panel: "#12161E",
  panelAlt: "#171C26",
  border: "#232A38",
  text: "#E6E9EF",
  textDim: "#8993A6",
  textFaint: "#4B5566",
  cyan: "#2DD4FF",
  amber: "#F5A623",
  red: "#FF4D5E",
  green: "#34D399",
  purple: "#9B8CFF",
};

const severityColor: Record<Severity, string> = {
  critical: colors.red,
  high: colors.amber,
  medium: colors.cyan,
  low: colors.textFaint,
};

// ---------- mock data helpers ----------

const IPS = [
  "10.0.0.14",
  "192.168.1.22",
  "203.0.113.44",
  "172.16.4.9",
  "198.51.100.9",
  "10.0.0.2",
];
const PORTS = [22, 80, 443, 53];
const PROTOS: FeedLine["proto"][] = ["TCP", "UDP", "ICMP"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function randIp(): string {
  return IPS[Math.floor(Math.random() * IPS.length)];
}

// MOCK — replace with SSE-driven state
function makeFeedLine(): FeedLine {
  const now = new Date();
  return {
    id: `${now.getTime()}-${Math.random()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    proto: PROTOS[Math.floor(Math.random() * PROTOS.length)],
    src: `${randIp()}:${Math.floor(Math.random() * 60000 + 1024)}`,
    dst: `${randIp()}:${PORTS[Math.floor(Math.random() * PORTS.length)]}`,
    len: Math.floor(Math.random() * 1400 + 40),
    flagged: Math.random() < 0.12,
  };
}

// MOCK — replace with GET /api/alerts
const INITIAL_ALERTS: AlertItem[] = [
  { id: "a1", severity: "critical", title: "Port scan detected — 45 ports in 8s", meta: "203.0.113.44 → internal/22 · 00:41 ago" },
  { id: "a2", severity: "critical", title: "Blocklist match on inbound connection", meta: "198.51.100.9 · known C2 range · 03:12 ago" },
  { id: "a3", severity: "high", title: "Traffic spike — 4.6× baseline", meta: "eth0 inbound · 05:50 ago" },
  { id: "a4", severity: "medium", title: "Geo-anomaly: new source region", meta: "first connection from AS-14061 · 09:03 ago" },
  { id: "a5", severity: "medium", title: "Repeated auth failures", meta: "10.0.0.14 → 10.0.0.2:22 · 11:40 ago" },
  { id: "a6", severity: "low", title: "New device joined network", meta: "MAC 3C:E1:A1:.. · 22:10 ago" },
];

// MOCK — replace with GET /api/protocols
const PROTOCOLS: ProtocolShare[] = [
  { name: "TCP", pct: 62, color: colors.cyan },
  { name: "UDP", pct: 24, color: colors.purple },
  { name: "ICMP", pct: 9, color: colors.amber },
  { name: "Other", pct: 5, color: colors.textFaint },
];

// MOCK — replace with GET /api/connections/geo
const MAP_PINGS: ConnectionPing[] = [
  { id: "p1", top: 35, left: 16, level: "normal" },
  { id: "p2", top: 55, left: 44, level: "anomaly" },
  { id: "p3", top: 28, left: 66, level: "normal" },
  { id: "p4", top: 60, left: 78, level: "elevated" },
];

function makeInitialTraffic(): TrafficPoint[] {
  return Array.from({ length: 40 }, (_, i) => ({
    t: 39 - i,
    packets: Math.round(20 + Math.random() * 80),
  }));
}

// ---------- small presentational pieces ----------

function StatCard({
  label,
  value,
  delta,
  deltaColor,
  valueColor,
}: {
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-[10px] border p-4"
      style={{ background: colors.panel, borderColor: colors.border }}
    >
      <div className="text-[11.5px] mb-2" style={{ color: colors.textDim }}>
        {label}
      </div>
      <div
        className="font-mono text-[22px] font-semibold"
        style={{ color: valueColor ?? colors.text }}
      >
        {value}
      </div>
      <div className="text-[11px] mt-1.5" style={{ color: deltaColor }}>
        {delta}
      </div>
    </div>
  );
}

function SectionLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 text-[11px] uppercase tracking-[1.2px] mb-2.5 ml-0.5"
      style={{ color: colors.textFaint }}
    >
      <span
        className="font-mono border rounded px-1.5 text-[10px]"
        style={{ borderColor: colors.border }}
      >
        {n}
      </span>
      {children}
    </div>
  );
}

function Panel({
  title,
  sub,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[10px] border p-4 flex flex-col ${className}`}
      style={{ background: colors.panel, borderColor: colors.border }}
    >
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="text-[13.5px] font-semibold m-0" style={{ color: colors.text }}>
          {title}
        </h3>
        {sub && (
          <div className="text-[11px]" style={{ color: colors.textFaint }}>
            {sub}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------- main dashboard ----------

export default function NetGuardDashboard() {
  const [traffic, setTraffic] = useState<TrafficPoint[]>(makeInitialTraffic);
  const [stats, setStats] = useState({ packets: 2000, conns: 220, bw: 4.8 });
  const [feed, setFeed] = useState<FeedLine[]>(() =>
    Array.from({ length: 18 }, makeFeedLine)
  );
  const [thresholds, setThresholds] = useState<Thresholds>({
    portScanPorts: 15,
    spikeMultiplier: 3,
    geoSensitivity: 2,
  });
  const feedEndRef = useRef<HTMLDivElement>(null);

  // MOCK — replace with SSE onmessage handlers
  useEffect(() => {
    const statTimer = setInterval(() => {
      setStats({
        packets: Math.round(1800 + Math.random() * 400),
        conns: Math.round(210 + Math.random() * 30),
        bw: +(4.2 + Math.random() * 1.5).toFixed(1),
      });
      setTraffic((prev) => {
        const next = prev.slice(1);
        next.push({ t: 0, packets: Math.round(20 + Math.random() * 80) });
        return next.map((p, i) => ({ ...p, t: next.length - 1 - i }));
      });
    }, 1800);

    const feedTimer = setInterval(() => {
      setFeed((prev) => {
        const next = [...prev, makeFeedLine()];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });
    }, 700);

    return () => {
      clearInterval(statTimer);
      clearInterval(feedTimer);
    };
  }, []);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: "end" });
  }, [feed]);

  const geoLabel = { 1: "Low", 2: "Medium", 3: "High" }[thresholds.geoSensitivity];

  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: colors.bg, color: colors.text }}
    >
      <div className="max-w-[1400px] mx-auto px-6 pt-5 pb-14">
        {/* header */}
        <header
          className="flex items-center justify-between pb-5 mb-5 border-b"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm"
              style={{
                background: `linear-gradient(135deg, ${colors.cyan}, ${colors.purple})`,
                color: colors.bg,
              }}
            >
              NG
            </div>
            <div>
              <h1 className="text-[17px] font-semibold m-0">NetGuard</h1>
              <div className="text-[11px]" style={{ color: colors.textFaint }}>
                Network Threat Dashboard
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border"
              style={{
                color: colors.green,
                borderColor: "rgba(52,211,153,.25)",
                background: "rgba(52,211,153,.08)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: colors.green }}
              />
              LIVE — SSE connected
            </div>
            <select
              className="text-xs px-2.5 py-1.5 rounded-md border"
              style={{ background: colors.panel, borderColor: colors.border, color: colors.textDim }}
            >
              <option>Last 15 min</option>
              <option>Last hour</option>
              <option>Last 24h</option>
            </select>
            <div
              className="text-xs px-2.5 py-1.5 rounded-md border"
              style={{ color: colors.red, borderColor: "rgba(255,77,94,.3)", background: "rgba(255,77,94,.08)" }}
            >
              ⚠ 3 active alerts
            </div>
          </div>
        </header>

        {/* 1. summary stats */}
        <SectionLabel n={1}>Network Summary Statistics</SectionLabel>
        <div className="grid grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Packets / sec"
            value={stats.packets.toLocaleString()}
            delta="▲ 4.2% vs prior window"
            deltaColor={colors.green}
          />
          <StatCard
            label="Active connections"
            value={stats.conns.toLocaleString()}
            delta="▬ steady"
            deltaColor={colors.textFaint}
          />
          <StatCard
            label="Bandwidth"
            value={`${stats.bw} MB/s`}
            delta="▲ 1.1 MB/s"
            deltaColor={colors.green}
          />
          <StatCard
            label="Alerts (24h)"
            value="17"
            valueColor={colors.amber}
            delta="▲ 3 critical"
            deltaColor={colors.red}
          />
          <StatCard
            label="Blocklist hits"
            value="6"
            valueColor={colors.red}
            delta="▲ 2 new sources"
            deltaColor={colors.textDim}
          />
        </div>

        {/* 2. traffic volume + alerts */}
        <SectionLabel n={2}>Traffic Volume &amp; Alert Panel</SectionLabel>
        <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
          <Panel title="Traffic volume over time" sub="packets/sec, 60s window">
            <div style={{ width: "100%", height: 170 }}>
              <ResponsiveContainer>
                <AreaChart data={[...traffic].reverse()}>
                  <defs>
                    <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.cyan} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={colors.cyan} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.border} vertical={false} />
                  <XAxis
                    dataKey="t"
                    reversed
                    tickFormatter={(v: number) => (v === 0 ? "now" : `-${v}s`)}
                    tick={{ fill: colors.textFaint, fontSize: 10 }}
                    axisLine={{ stroke: colors.border }}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: colors.panelAlt,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v: number) => (v === 0 ? "now" : `${v}s ago`)}
                  />
                  <Area
                    type="monotone"
                    dataKey="packets"
                    stroke={colors.cyan}
                    strokeWidth={2}
                    fill="url(#trafficFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Alert panel" sub="by severity">
            <div className="max-h-[280px] overflow-y-auto">
              {INITIAL_ALERTS.map((a) => (
                <div
                  key={a.id}
                  className="flex gap-2.5 py-2.5 border-b text-xs last:border-b-0"
                  style={{ borderColor: colors.border }}
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                    style={{
                      background: severityColor[a.severity],
                      boxShadow: a.severity === "critical" ? `0 0 8px ${colors.red}99` : undefined,
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="font-mono text-[10.5px]" style={{ color: colors.textFaint }}>
                      {a.meta}
                    </div>
                  </div>
                  <div
                    className="text-[9.5px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold h-fit"
                    style={{
                      color: severityColor[a.severity],
                      background: `${severityColor[a.severity]}20`,
                    }}
                  >
                    {a.severity}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* 3. protocol breakdown + live feed */}
        <SectionLabel n={3}>Protocol Breakdown &amp; Live Packet Feed</SectionLabel>
        <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
          <Panel title="Protocol breakdown" sub="share of total traffic">
            <div className="flex flex-col gap-2.5">
              {PROTOCOLS.map((p) => (
                <div key={p.name} className="flex items-center gap-2.5 text-xs">
                  <span className="w-[70px]" style={{ color: colors.textDim }}>
                    {p.name}
                  </span>
                  <div
                    className="flex-1 h-2 rounded overflow-hidden"
                    style={{ background: colors.panelAlt }}
                  >
                    <div
                      className="h-full rounded"
                      style={{ width: `${p.pct}%`, background: p.color }}
                    />
                  </div>
                  <span className="font-mono w-10 text-right" style={{ color: colors.textDim }}>
                    {p.pct}%
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Live traffic feed" sub="tail -f">
            <div className="h-[220px] overflow-y-auto font-mono text-[11px] flex flex-col gap-px">
              {feed.map((f) => (
                <div
                  key={f.id}
                  className="px-1.5 py-1 rounded flex gap-2.5 whitespace-nowrap"
                >
                  <span style={{ color: colors.textFaint }}>{f.time}</span>
                  <span
                    className="w-9 font-semibold"
                    style={{
                      color:
                        f.proto === "TCP" ? colors.cyan : f.proto === "UDP" ? colors.purple : colors.amber,
                    }}
                  >
                    {f.proto}
                  </span>
                  <span className="flex-1 overflow-hidden text-ellipsis" style={{ color: colors.textDim }}>
                    {f.src} → {f.dst} len={f.len}
                  </span>
                  {f.flagged && (
                    <span className="font-semibold" style={{ color: colors.red }}>
                      FLAGGED
                    </span>
                  )}
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>
          </Panel>
        </div>

        {/* 4. world map */}
        <SectionLabel n={4}>Active Connections — World Map</SectionLabel>
        <Panel title="Global connection map" sub="geo-anomaly detection overlay" className="mb-4">
          <div
            className="relative h-[240px] rounded-lg overflow-hidden"
            style={{ background: colors.panelAlt }}
          >
            <svg viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
              <g fill="#1D2432">
                <rect x="60" y="60" width="180" height="90" rx="14" />
                <rect x="260" y="40" width="140" height="70" rx="12" />
                <rect x="300" y="120" width="90" height="110" rx="16" />
                <rect x="430" y="50" width="220" height="60" rx="10" />
                <rect x="480" y="120" width="150" height="90" rx="14" />
                <rect x="640" y="160" width="110" height="60" rx="10" />
              </g>
            </svg>
            {MAP_PINGS.map((p) => {
              const pingColor =
                p.level === "anomaly" ? colors.red : p.level === "elevated" ? colors.amber : colors.cyan;
              return (
                <div
                  key={p.id}
                  className="absolute w-2 h-2 rounded-full animate-ping"
                  style={{ top: `${p.top}%`, left: `${p.left}%`, background: pingColor }}
                />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2.5 text-[11px]" style={{ color: colors.textDim }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: colors.cyan }} />
              Normal connection
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: colors.amber }} />
              Elevated volume
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: colors.red }} />
              Geo-anomaly / blocklisted
            </span>
          </div>
        </Panel>

        {/* 5. config panel */}
        <SectionLabel n={5}>Configuration Panel</SectionLabel>
        <div
          className="rounded-[10px] border p-4"
          style={{ background: colors.panel, borderColor: colors.border }}
        >
          <div className="mb-1">
            <h3 className="text-[13.5px] font-semibold m-0">Detection thresholds</h3>
            <div className="text-[11px]" style={{ color: colors.textFaint }}>
              applied live — no backend restart
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 mt-3.5">
            <div>
              <label className="block text-xs mb-2" style={{ color: colors.textDim }}>
                Port scan threshold{" "}
                <span className="font-mono float-right" style={{ color: colors.cyan }}>
                  {thresholds.portScanPorts} ports/10s
                </span>
              </label>
              <input
                type="range"
                min={5}
                max={50}
                value={thresholds.portScanPorts}
                onChange={(e) =>
                  setThresholds((t) => ({ ...t, portScanPorts: +e.target.value }))
                }
                className="w-full accent-[#2DD4FF]"
              />
              <div className="text-[10.5px] mt-1.5" style={{ color: colors.textFaint }}>
                Ports probed per host in the window before flagging.
              </div>
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: colors.textDim }}>
                Traffic spike multiplier{" "}
                <span className="font-mono float-right" style={{ color: colors.cyan }}>
                  {thresholds.spikeMultiplier}×
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={thresholds.spikeMultiplier}
                onChange={(e) =>
                  setThresholds((t) => ({ ...t, spikeMultiplier: +e.target.value }))
                }
                className="w-full accent-[#2DD4FF]"
              />
              <div className="text-[10.5px] mt-1.5" style={{ color: colors.textFaint }}>
                Multiple of rolling baseline that triggers an alert.
              </div>
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: colors.textDim }}>
                Geo-anomaly sensitivity{" "}
                <span className="font-mono float-right" style={{ color: colors.cyan }}>
                  {geoLabel}
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={3}
                value={thresholds.geoSensitivity}
                onChange={(e) =>
                  setThresholds((t) => ({
                    ...t,
                    geoSensitivity: +e.target.value as Thresholds["geoSensitivity"],
                  }))
                }
                className="w-full accent-[#2DD4FF]"
              />
              <div className="text-[10.5px] mt-1.5" style={{ color: colors.textFaint }}>
                How aggressively unusual source geographies are flagged.
              </div>
            </div>
          </div>
          <div
            className="text-[11px] mt-4 pt-3 border-t"
            style={{ color: colors.textFaint, borderColor: colors.border }}
          >
            Wire this up to <code>PATCH /api/config</code> on change (debounced) instead of
            local state only.
          </div>
        </div>
      </div>
    </div>
  );
}
