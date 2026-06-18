import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { calcPrice, getInflacao, fmt, fmtShort } from "./pricing.js";

const CARD_BG = "#FFFDFB";
const HAIRLINE = "#E8DDD6";
const PKG_COLORS = ["#C4938D", "#D4A088", "#B8956A", "#E8A849", "#C9944A", "#A07D5B", "#8B7355", "#7B5E8D", "#6B4E7D"];
const STEPS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];

// Short names for legend / chips
const shortNames = {
  f1: "Fmg 1", f2: "Fmg 2", f3: "Fmg 3",
  fg1s: "Fmgr 1 Sáb", fg1d: "Fmgr 1 Sem",
  fg2: "Fmgr 2", fg3: "Fmgr 3",
  bb: "Bala Balão", bbp: "BB Premier",
};

// ── Custom Tooltip for Chart ──
function ChartTooltip({ active, payload, label, labelSuffix }) {
  if (!active || !payload) return null;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${HAIRLINE}`, borderRadius: 12, padding: 12, boxShadow: "0 4px 16px rgba(61,46,39,.1)", maxWidth: 220 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#3D2E27", marginBottom: 6 }}>{label} {labelSuffix || ""}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: "#5A4A42", marginBottom: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700 }}>R$ {fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// ── REPORT PAGE ──
// ══════════════════════════════════════
export default function ReportPage({ premissas, onBack }) {
  const [selectedPkg, setSelectedPkg] = useState(0);
  const [tableMode, setTableMode] = useState("together"); // together | adults | children
  const [chartMode, setChartMode] = useState("together"); // together | adults | children

  const pkg = premissas.packages[selectedPkg];

  // Chart data based on chartMode
  const chartData = useMemo(() => {
    return STEPS.map(n => {
      const adults = chartMode === "children" ? 15 : n;
      const children = chartMode === "adults" ? 15 : n;
      const row = { label: n };
      premissas.packages.forEach((p) => {
        const inf = getInflacao(premissas, adults, children);
        row[p.id] = Math.round(calcPrice(adults, children, p.piso, p.adulto, p.crianca, inf));
      });
      return row;
    });
  }, [premissas, chartMode]);

  const chartXLabel = chartMode === "together" ? "Adultos = Crianças" : chartMode === "adults" ? "Adultos (crianças = 15)" : "Crianças (adultos = 15)";
  const chartSubtitle = chartMode === "together" ? "Adultos e crianças variam juntos de 15 a 80" : chartMode === "adults" ? "Adultos variam de 15 a 80 · Crianças fixas em 15" : "Crianças variam de 15 a 80 · Adultos fixos em 15";

  // Table rows
  const tableRows = useMemo(() => {
    const inf = (a, c) => getInflacao(premissas, a, c);
    if (tableMode === "together") {
      return STEPS.map(n => ({ adults: n, children: n, price: calcPrice(n, n, pkg.piso, pkg.adulto, pkg.crianca, inf(n, n)) }));
    } else if (tableMode === "adults") {
      return STEPS.map(n => ({ adults: n, children: 15, price: calcPrice(n, 15, pkg.piso, pkg.adulto, pkg.crianca, inf(n, 15)) }));
    } else {
      return STEPS.map(n => ({ adults: 15, children: n, price: calcPrice(15, n, pkg.piso, pkg.adulto, pkg.crianca, inf(15, n)) }));
    }
  }, [premissas, pkg, tableMode]);

  const sty = {
    section: { background: CARD_BG, borderRadius: 20, padding: 20, boxShadow: "0 4px 24px rgba(61,46,39,.05)", marginBottom: 20 },
    th: { fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#8C7B75", textTransform: "uppercase", letterSpacing: .5, padding: "10px 8px", textAlign: "left", borderBottom: `2px solid ${HAIRLINE}` },
    td: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#5A4A42", padding: "10px 8px", borderBottom: "1px solid #F3EDE8" },
    tdPrice: { fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700, color: "#5A4A42", padding: "10px 8px", borderBottom: "1px solid #F3EDE8", textAlign: "right" },
  };

  return (
    <div style={{ padding: "0 16px", maxWidth: 480, margin: "0 auto", animation: "fadeIn .3s ease" }}>
      {/* Back button */}
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#B8956A" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar às Premissas
      </button>

      {/* Chart Section */}
      <div style={sty.section}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#3D2E27", margin: "0 0 4px" }}>Comparativo de Preços</h3>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A99890", margin: "0 0 14px" }}>{chartSubtitle}</p>

        {/* Chart mode tabs */}
        <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: `1.5px solid ${HAIRLINE}`, marginBottom: 16 }}>
          {[
            { key: "together", label: "Ambos variam" },
            { key: "adults", label: "Adultos variam" },
            { key: "children", label: "Crianças variam" },
          ].map(m => (
            <button key={m.key} onClick={() => setChartMode(m.key)} style={{
              flex: 1, padding: "9px 4px", border: "none",
              background: chartMode === m.key ? "#5A4A42" : CARD_BG,
              color: chartMode === m.key ? "#fff" : "#8C7B75",
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer", transition: "all .2s",
            }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE8" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8C7B75", fontFamily: "'DM Sans', sans-serif" }} label={{ value: chartXLabel, position: "insideBottom", offset: -2, fontSize: 11, fill: "#A99890", fontFamily: "'DM Sans', sans-serif" }} />
              <YAxis tick={{ fontSize: 10, fill: "#8C7B75", fontFamily: "'DM Sans', sans-serif" }} tickFormatter={v => fmtShort(v)} width={52} />
              <Tooltip content={<ChartTooltip labelSuffix={chartMode === "together" ? "adultos + crianças" : chartMode === "adults" ? "adultos (15 crianças)" : "crianças (15 adultos)"} />} />
              {premissas.packages.map((p, i) => (
                <Line key={p.id} type="monotone" dataKey={p.id} name={shortNames[p.id]} stroke={PKG_COLORS[i]} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Compact legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12 }}>
          {premissas.packages.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: PKG_COLORS[i], display: "inline-block" }} />
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#8C7B75" }}>{shortNames[p.id]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Package Selector */}
      <div style={sty.section}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#3D2E27", margin: "0 0 14px" }}>Tabela de Preços</h3>

        {/* Package chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {premissas.packages.map((p, i) => (
            <button key={p.id} onClick={() => setSelectedPkg(i)} style={{
              padding: "7px 12px", borderRadius: 20, border: selectedPkg === i ? "none" : `1.5px solid ${HAIRLINE}`,
              background: selectedPkg === i ? PKG_COLORS[i] : CARD_BG,
              color: selectedPkg === i ? "#fff" : "#5A4A42",
              fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer", transition: "all .2s", whiteSpace: "nowrap",
            }}>
              {shortNames[p.id]}
            </button>
          ))}
        </div>

        {/* Variation mode tabs */}
        <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: `1.5px solid ${HAIRLINE}`, marginBottom: 16 }}>
          {[
            { key: "together", label: "Ambos variam" },
            { key: "adults", label: "Adultos variam" },
            { key: "children", label: "Crianças variam" },
          ].map(m => (
            <button key={m.key} onClick={() => setTableMode(m.key)} style={{
              flex: 1, padding: "9px 4px", border: "none",
              background: tableMode === m.key ? "#5A4A42" : CARD_BG,
              color: tableMode === m.key ? "#fff" : "#8C7B75",
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer", transition: "all .2s",
            }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Info pill */}
        <div style={{ background: "#FAF5F0", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: "#8C7B75" }}>
          {tableMode === "together" && "Adultos e crianças variam juntos de 15 a 80"}
          {tableMode === "adults" && "Adultos variam de 15 a 80 · Crianças fixas em 15"}
          {tableMode === "children" && "Crianças variam de 15 a 80 · Adultos fixos em 15"}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${HAIRLINE}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={sty.th}>Adultos</th>
                <th style={sty.th}>Crianças</th>
                <th style={{ ...sty.th, textAlign: "right" }}>Preço à Vista</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const isHighlight = (row.adults + row.children) === 60;
                return (
                  <tr key={i} style={{ background: isHighlight ? "#FDF6EE" : i % 2 === 0 ? CARD_BG : "#FDFBF9" }}>
                    <td style={sty.td}>{row.adults}</td>
                    <td style={sty.td}>{row.children}</td>
                    <td style={sty.tdPrice}>R$ {fmt(row.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Highlight explanation */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: "#A99890" }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: "#FDF6EE", border: `1px solid ${HAIRLINE}`, display: "inline-block" }} />
          Linha destacada = 60 convidados (mudança de faixa de ajuste)
        </div>
      </div>
    </div>
  );
}
