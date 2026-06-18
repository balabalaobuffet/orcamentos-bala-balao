import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { calcPrice, getInflacao, fmt } from "./pricing.js";

const ReportPage = lazy(() => import("./ReportPage.jsx"));

const DEFAULT_PREMISSAS = {
  parcelaPercent: 15.22,
  numParcelas: 10,
  inflacaoAbaixo60: 6,
  inflacaoAcima60: 0,
  pixPercent: 6,
  observacao: "Tanto o Pix quanto o dinheiro podem ser pagos mês a mês, desde que toda a festa esteja quitada até 15 dias antes do evento.",
  packages: [
    { id: "f1", categoria: "promocional", nome: "Festa Formiguinha 1", dias: "Segunda a quarta", piso: 3380, adulto: 55, crianca: 40 },
    { id: "f2", categoria: "promocional", nome: "Festa Formiguinha 2", dias: "Segunda a quinta", piso: 3615, adulto: 55, crianca: 40 },
    { id: "f3", categoria: "promocional", nome: "Festa Formiguinha 3", dias: "Segunda a sexta", piso: 3850, adulto: 55, crianca: 40 },
    { id: "fg1s", categoria: "tradicional", nome: "Festa Formigueiro 1", dias: "Sábado", piso: 4910, adulto: 90, crianca: 45 },
    { id: "fg1d", categoria: "tradicional", nome: "Festa Formigueiro 1", dias: "Dia de semana, domingo e feriado", piso: 4450, adulto: 90, crianca: 45 },
    { id: "fg2", categoria: "tradicional", nome: "Festa Formigueiro 2", dias: "Todos os dias", piso: 5190, adulto: 95, crianca: 45 },
    { id: "fg3", categoria: "tradicional", nome: "Festa Formigueiro 3", dias: "Todos os dias", piso: 5725, adulto: 95, crianca: 45 },
    { id: "bb", categoria: "premium", nome: "Festa Bala Balão", dias: "Todos os dias", piso: 9640, adulto: 145, crianca: 70 },
    { id: "bbp", categoria: "premium", nome: "Festa Bala Balão Premier", dias: "Todos os dias", piso: 14185, adulto: 190, crianca: 75 },
  ],
};

const STORAGE_KEY = "balabalao-premissas-v1";
const CARD_BG = "#FFFDFB";
const HAIRLINE = "#E8DDD6";

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ── Storage ──
function loadPremissas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...deepClone(DEFAULT_PREMISSAS), ...parsed, packages: parsed.packages || DEFAULT_PREMISSAS.packages };
      merged.packages = merged.packages.map(p => ({ ...p, dias: typeof p.dias === "string" ? p.dias.replace(/^Segunda e /, "Segunda a ") : p.dias }));
      const OBS_ANTIGA = "O valor à vista também pode ser pago via Pix mês a mês, desde que esteja quitado em até 10 dias antes da festa.";
      if (merged.observacao === OBS_ANTIGA) merged.observacao = DEFAULT_PREMISSAS.observacao;
      return merged;
    }
  } catch (e) {}
  return null;
}
function savePremissas(premissas) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(premissas)); } catch (e) {}
}

// ── useNumericField ──
function useNumericField(externalValue, onCommit, isFloat = false) {
  const [display, setDisplay] = useState(String(externalValue));
  const prevExternal = useRef(externalValue);
  useEffect(() => {
    if (externalValue !== prevExternal.current) { setDisplay(String(externalValue)); prevExternal.current = externalValue; }
  }, [externalValue]);
  const handleChange = (raw) => {
    if (raw === "" || raw === "-") { setDisplay(raw); return; }
    if (isFloat && /^-?\d*\.$/.test(raw)) { setDisplay(raw); return; }
    if (isFloat && /^-?\d+\.\d*0$/.test(raw)) {
      const p = parseFloat(raw); if (!isNaN(p)) { setDisplay(raw); onCommit(p); } return;
    }
    const parsed = isFloat ? parseFloat(raw) : parseInt(raw, 10);
    if (isNaN(parsed)) return;
    const shown = isFloat ? raw.replace(/^(-?)0+(\d)/, "$1$2") : String(parsed);
    setDisplay(shown); onCommit(parsed);
  };
  const handleBlur = () => {
    const p = isFloat ? parseFloat(display) : parseInt(display, 10);
    const f = isNaN(p) ? 0 : p; setDisplay(String(f)); onCommit(f);
  };
  return { display, handleChange, handleBlur };
}

// ── Stepper ──
function Stepper({ value, onChange, min = 0, max = 200, label }) {
  const commit = (v) => onChange(Math.max(min, Math.min(max, v)));
  const { display, handleChange, handleBlur } = useNumericField(value, commit);
  return (
    <div>
      <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#8C7B75", letterSpacing: 1, textTransform: "uppercase", fontWeight: 500, display: "block", marginBottom: 8 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: CARD_BG, borderRadius: 16, border: `1.5px solid ${HAIRLINE}`, overflow: "hidden" }}>
        <button aria-label={`Diminuir ${label}`} onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 56, height: 56, border: "none", background: value <= min ? "#F5F0EC" : "#FAF5F0", color: value <= min ? "#C4B8B0" : "#B8956A", fontSize: 24, fontWeight: 600, cursor: value <= min ? "default" : "pointer", transition: "all .2s", fontFamily: "'DM Sans', sans-serif" }}>−</button>
        <input type="text" inputMode="numeric" aria-label={label} value={display} onChange={e => handleChange(e.target.value)} onBlur={handleBlur} onFocus={e => e.target.select()} style={{ flex: 1, border: "none", outline: "none", textAlign: "center", fontSize: 28, fontWeight: 700, color: "#5A4A42", fontFamily: "'Cormorant Garamond', serif", background: "transparent", minWidth: 0 }} />
        <button aria-label={`Aumentar ${label}`} onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 56, height: 56, border: "none", background: value >= max ? "#F5F0EC" : "#C4938D", color: value >= max ? "#C4B8B0" : "#fff", fontSize: 24, fontWeight: 600, cursor: value >= max ? "default" : "pointer", transition: "all .2s", fontFamily: "'DM Sans', sans-serif" }}>+</button>
      </div>
    </div>
  );
}

// ── PriceCard ──
function PaymentRow({ icon, label, value, tag, emphasis }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: emphasis ? "#5A4A42" : "#8C7B75", fontWeight: emphasis ? 600 : 500 }}>
        <span>{icon}</span>{label}
        {tag && <span style={{ fontSize: 9.5, color: "#B8956A", fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>{tag}</span>}
      </span>
      {emphasis ? (
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 25, fontWeight: 700, color: "#B8956A", lineHeight: 1 }}>{value}</span>
      ) : (
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#5A4A42", whiteSpace: "nowrap" }}>{value}</span>
      )}
    </div>
  );
}

function PriceCard({ pkg, adults, children, premissas, accent }) {
  const inflacao = getInflacao(premissas, adults, children);
  const base = calcPrice(adults, children, pkg.piso, pkg.adulto, pkg.crianca, inflacao);
  const nParc = premissas.numParcelas || 1;
  const parcela = (base * (1 + premissas.parcelaPercent / 100)) / nParc;
  const pix = base * (1 + premissas.pixPercent / 100);
  return (
    <div style={{ background: CARD_BG, borderRadius: 16, padding: "18px 18px 16px", border: `1px solid ${HAIRLINE}`, boxShadow: "0 2px 12px rgba(61,46,39,.04)", transition: "transform .2s, box-shadow .2s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(61,46,39,.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(61,46,39,.04)"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#3D2E27", lineHeight: 1.1 }}>{pkg.nome}</span>
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A99890", margin: "3px 0 14px", paddingLeft: 17 }}>📅 {pkg.dias}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <PaymentRow icon="💳" label="Cartão" value={`${nParc}x R$ ${fmt(parcela)}`} />
        <PaymentRow icon="📲" label="Pix" value={`R$ ${fmt(pix)}`} />
        <div style={{ height: 1, background: "#F3EDE8", margin: "1px 0" }} />
        <PaymentRow icon="💵" label="Dinheiro" tag="desc. especial" value={`R$ ${fmt(base)}`} emphasis />
      </div>
    </div>
  );
}

// ── CategorySection ──
function CategorySection({ title, subtitle, packages, adults, children, premissas, accent }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: "#3D2E27", margin: 0, letterSpacing: .5 }}>{title}</h3>
        {subtitle && <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A99890", margin: "2px 0 0" }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {packages.map(pkg => <PriceCard key={pkg.id} pkg={pkg} adults={adults} children={children} premissas={premissas} accent={accent} />)}
      </div>
    </div>
  );
}

// ── PremissaInput ──
function PremissaInput({ label, value, onChange, prefix, suffix, type = "number", small, step }) {
  const isFloat = step && String(step).includes(".");
  const isNum = type === "number";
  const { display, handleChange, handleBlur } = useNumericField(value, onChange, isFloat);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: small ? 12 : 13, color: "#8C7B75", minWidth: small ? 80 : 100, flexShrink: 0 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", flex: 1, background: CARD_BG, borderRadius: 10, border: `1.5px solid ${HAIRLINE}`, padding: "6px 10px", gap: 4 }}>
        {prefix && <span style={{ fontSize: 13, color: "#A99890", fontFamily: "'DM Sans', sans-serif" }}>{prefix}</span>}
        {isNum ? (
          <input type="text" inputMode={isFloat ? "decimal" : "numeric"} aria-label={label} value={display} onChange={e => handleChange(e.target.value)} onBlur={handleBlur} onFocus={e => e.target.select()} style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontWeight: 600, color: "#5A4A42", fontFamily: "'DM Sans', sans-serif", background: "transparent", minWidth: 0 }} />
        ) : (
          <input type="text" aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontWeight: 600, color: "#5A4A42", fontFamily: "'DM Sans', sans-serif", background: "transparent", minWidth: 0 }} />
        )}
        {suffix && <span style={{ fontSize: 12, color: "#A99890", fontFamily: "'DM Sans', sans-serif" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ── PremissaPackageCard ──
function PremissaPackageCard({ pkg, index, onChange, accent }) {
  const update = (field, val) => onChange(index, field, val);
  return (
    <div style={{ background: CARD_BG, borderRadius: 14, padding: 16, border: `1px solid ${HAIRLINE}`, marginBottom: 10, boxShadow: "0 1px 6px rgba(61,46,39,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, color: "#3D2E27" }}>{pkg.nome}</span>
      </div>
      <PremissaInput label="Dias" value={pkg.dias} onChange={v => update("dias", v)} type="text" small />
      <PremissaInput label="Piso" value={pkg.piso} onChange={v => update("piso", v)} prefix="R$" small />
      <PremissaInput label="+ Adulto" value={pkg.adulto} onChange={v => update("adulto", v)} prefix="R$" small />
      <PremissaInput label="+ Criança" value={pkg.crianca} onChange={v => update("crianca", v)} prefix="R$" small />
    </div>
  );
}

// ══════════════════════════════════════
// ── LOCK SCREEN ──
// ══════════════════════════════════════
const PIN_CODE = "2580";

function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleDigit = (d) => {
    if (success) return;
    const next = pin + d;
    setError(false);
    if (next.length < 4) {
      setPin(next);
    } else {
      setPin(next);
      if (next === PIN_CODE) {
        setSuccess(true);
        setTimeout(() => onUnlock(), 500);
      } else {
        setError(true);
        setTimeout(() => { setPin(""); setError(false); }, 600);
      }
    }
  };

  const handleDelete = () => {
    if (success) return;
    setPin(p => p.slice(0, -1));
    setError(false);
  };

  const dots = [0, 1, 2, 3];
  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(180deg, #3D2E27 0%, #5A4A42 50%, #8B6F5E 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 20, userSelect: "none",
      transition: "opacity .5s", opacity: success ? 0 : 1,
    }}>

      {/* Logo area */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#B8956A", fontWeight: 600, marginBottom: 8 }}>Bala Balão</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 700, color: "#FAF8F5", margin: 0 }}>Orçamentos</h1>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        {dots.map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            border: `2px solid ${error ? "#E07070" : "#B8956A"}`,
            background: i < pin.length ? (error ? "#E07070" : success ? "#7CB87C" : "#B8956A") : "transparent",
            transition: "all .15s",
            transform: error ? `translateX(${i % 2 === 0 ? -4 : 4}px)` : "none",
          }} />
        ))}
      </div>

      {/* Status text */}
      <div style={{ fontSize: 13, color: error ? "#E07070" : "rgba(250,248,245,.5)", marginBottom: 36, height: 20, transition: "color .2s" }}>
        {error ? "Código incorreto" : "Digite o código de acesso"}
      </div>

      {/* Keypad */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
        {keys.map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            {row.map((k, ki) => {
              if (k === "") return <div key={ki} style={{ width: 72, height: 72 }} />;
              if (k === "del") {
                return (
                  <button key={ki} aria-label="Apagar" onClick={handleDelete} style={{
                    width: 72, height: 72, borderRadius: "50%", border: "none",
                    background: "transparent", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(250,248,245,.7)", fontSize: 13, fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
                  </button>
                );
              }
              return (
                <button key={ki} aria-label={k} onClick={() => handleDigit(k)} style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: "1.5px solid rgba(184,149,106,.3)",
                  background: "rgba(255,255,255,.06)",
                  backdropFilter: "blur(4px)",
                  color: "#FAF8F5", fontSize: 28, fontWeight: 500,
                  fontFamily: "'Cormorant Garamond', serif",
                  cursor: "pointer", transition: "all .15s",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                  onMouseDown={e => { e.currentTarget.style.background = "rgba(184,149,106,.25)"; e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.transform = "scale(1)"; }}
                  onTouchStart={e => { e.currentTarget.style.background = "rgba(184,149,106,.25)"; e.currentTarget.style.transform = "scale(0.95)"; }}
                  onTouchEnd={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.transform = "scale(1)"; }}
                >
                  {k}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ── MAIN APP ──
// ══════════════════════════════════════
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("calc");
  const [adults, setAdults] = useState(20);
  const [children, setChildren] = useState(15);
  const [premissas, setPremissas] = useState(deepClone(DEFAULT_PREMISSAS));
  const [copied, setCopied] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const saveTimeout = useRef(null);

  useEffect(() => { const s = loadPremissas(); if (s) setPremissas(s); setLoaded(true); }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => { savePremissas(premissas); setSaveStatus("saved"); setTimeout(() => setSaveStatus(null), 1500); }, 800);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [premissas, loaded]);

  const promo = useMemo(() => premissas.packages.filter(p => p.categoria === "promocional"), [premissas]);
  const trad = useMemo(() => premissas.packages.filter(p => p.categoria === "tradicional"), [premissas]);
  const prem = useMemo(() => premissas.packages.filter(p => p.categoria === "premium"), [premissas]);

  const updatePackage = useCallback((index, field, value) => {
    setPremissas(prev => { const next = deepClone(prev); next.packages[index][field] = value; return next; });
  }, []);

  const totalGuests = adults + children;
  const activeInflacao = totalGuests < 60 ? premissas.inflacaoAbaixo60 : premissas.inflacaoAcima60;

  const buildWhatsApp = useCallback(() => {
    const lines = [];
    lines.push("🎈 ORÇAMENTO BALA BALÃO 🎈"); lines.push(""); lines.push(`• Adultos: ${adults}`); lines.push(`• Crianças: ${children}`); lines.push(""); lines.push("⸻"); lines.push("");
    const fator = 1 + premissas.parcelaPercent / 100;
    const nP = premissas.numParcelas || 1;
    const addPkg = (pkg) => {
      const inf = getInflacao(premissas, adults, children);
      const base = calcPrice(adults, children, pkg.piso, pkg.adulto, pkg.crianca, inf);
      const parcela = (base * fator) / nP;
      const pix = base * (1 + premissas.pixPercent / 100);
      lines.push(pkg.nome); lines.push(`📅 ${pkg.dias}`);
      lines.push(`💳 Cartão: ${nP}x de R$ ${fmt(parcela)}`);
      lines.push(`📲 Pix: R$ ${fmt(pix)}`);
      lines.push(`💵 Dinheiro (desconto especial): R$ ${fmt(base)}`);
      lines.push("");
    };
    lines.push("FESTAS PROMOCIONAIS"); lines.push("(exceto feriados)"); lines.push(""); promo.forEach(addPkg);
    lines.push("⸻"); lines.push(""); lines.push("FESTAS TRADICIONAIS"); lines.push(""); trad.forEach(addPkg);
    lines.push("⸻"); lines.push(""); lines.push("FESTAS PREMIUM"); lines.push(""); prem.forEach(addPkg);
    lines.push("⸻"); lines.push(""); lines.push("Observação:"); lines.push(premissas.observacao);
    return lines.join("\n");
  }, [adults, children, premissas, promo, trad, prem]);

  const handleCopy = () => {
    const text = buildWhatsApp();
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  const resetPremissas = () => { if (window.confirm("Restaurar todas as premissas para os valores padrão?")) setPremissas(deepClone(DEFAULT_PREMISSAS)); };

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#B8956A", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #FAF8F5 0%, #F3EDE8 100%)", fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: "32px 20px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#B8956A", fontWeight: 600, marginBottom: 6 }}>Bala Balão Buffet Infantil</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 700, color: "#3D2E27", margin: 0, lineHeight: 1.1 }}>
          {showReport ? "Relatório de Preços" : "Orçamentos"}
        </h1>
        <div style={{ width: 40, height: 2, background: "linear-gradient(90deg, #C4938D, #B8956A)", margin: "12px auto 0", borderRadius: 2 }} />
      </div>

      {/* Report Page (lazy) */}
      {showReport && (
        <Suspense fallback={<div style={{ textAlign: "center", padding: 48, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#B8956A", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Carregando relatório...</div>}>
          <ReportPage premissas={premissas} onBack={() => { setShowReport(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </Suspense>
      )}

      {/* Calculator Tab */}
      {!showReport && tab === "calc" && (
        <div style={{ padding: "0 16px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ background: CARD_BG, borderRadius: 20, padding: 24, boxShadow: "0 4px 24px rgba(61,46,39,.05)", marginBottom: 24, border: `1px solid ${HAIRLINE}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Stepper label="Adultos" value={adults} onChange={setAdults} />
              <Stepper label="Crianças" value={children} onChange={setChildren} />
            </div>
            <div style={{ marginTop: 16, padding: "10px 14px", background: "#FAF5F0", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#8C7B75" }}>Total: <strong style={{ color: "#5A4A42" }}>{totalGuests} convidados</strong></span>
              {activeInflacao > 0 && <span style={{ fontSize: 11, color: "#B8956A", fontWeight: 600, background: "#FDF6EE", padding: "3px 8px", borderRadius: 6 }}>+{activeInflacao}% ajuste</span>}
            </div>
          </div>
          <CategorySection title="Festas Promocionais" subtitle="exceto feriados" packages={promo} adults={adults} children={children} premissas={premissas} accent="#C4938D" />
          <CategorySection title="Festas Tradicionais" packages={trad} adults={adults} children={children} premissas={premissas} accent="#B8956A" />
          <CategorySection title="Festas Premium" packages={prem} adults={adults} children={children} premissas={premissas} accent="#8B6F5E" />
          <div style={{ background: "#FAF5F0", borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#8C7B75", margin: 0, lineHeight: 1.6 }}><strong style={{ color: "#5A4A42" }}>Observação:</strong> {premissas.observacao}</p>
          </div>
          <button onClick={handleCopy} style={{
            width: "100%", padding: "16px 24px", border: "none", borderRadius: 16,
            background: copied ? "#5A8C5A" : "linear-gradient(135deg, #C4938D 0%, #B8956A 100%)",
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", transition: "all .3s", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(184,149,106,.3)", letterSpacing: .5, marginBottom: 16,
          }}>
            {copied ? (<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copiado!</>) : (<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copiar Orçamento para WhatsApp</>)}
          </button>
        </div>
      )}

      {/* Premissas Tab */}
      {!showReport && tab === "premissas" && (
        <div style={{ padding: "0 16px", maxWidth: 480, margin: "0 auto" }}>
          {saveStatus && (
            <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", background: saveStatus === "saved" ? "#E8F5E8" : "#FDF6EE", color: saveStatus === "saved" ? "#5A8C5A" : "#B8956A", padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, zIndex: 200, boxShadow: "0 2px 12px rgba(61,46,39,.1)", animation: "fadeIn .2s ease", fontFamily: "'DM Sans', sans-serif" }}>
              {saveStatus === "saving" ? "Salvando..." : "✓ Salvo"}
            </div>
          )}

          {/* Ajuste Global */}
          <div style={{ background: CARD_BG, borderRadius: 20, padding: 20, boxShadow: "0 4px 24px rgba(61,46,39,.05)", marginBottom: 20, border: `1px solid ${HAIRLINE}` }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: "#3D2E27", margin: "0 0 6px" }}>Ajuste de Preços</h3>
            <p style={{ fontSize: 12, color: "#A99890", margin: "0 0 16px", lineHeight: 1.5 }}>Percentual aplicado sobre o valor base de todos os pacotes (ex.: inflação anual).</p>
            <div style={{ background: "#FAF5F0", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#8C7B75", textTransform: "uppercase", letterSpacing: .5, fontWeight: 600, marginBottom: 8 }}>Menos de 60 convidados</div>
              <PremissaInput label="Ajuste" value={premissas.inflacaoAbaixo60} onChange={v => setPremissas(p => ({ ...p, inflacaoAbaixo60: v }))} suffix="%" step="0.1" />
            </div>
            <div style={{ background: "#FAF5F0", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#8C7B75", textTransform: "uppercase", letterSpacing: .5, fontWeight: 600, marginBottom: 8 }}>60 ou mais convidados</div>
              <PremissaInput label="Ajuste" value={premissas.inflacaoAcima60} onChange={v => setPremissas(p => ({ ...p, inflacaoAcima60: v }))} suffix="%" step="0.1" />
            </div>
          </div>

          {/* Pagamento */}
          <div style={{ background: CARD_BG, borderRadius: 20, padding: 20, boxShadow: "0 4px 24px rgba(61,46,39,.05)", marginBottom: 20, border: `1px solid ${HAIRLINE}` }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: "#3D2E27", margin: "0 0 14px" }}>Pagamento</h3>
            <PremissaInput label="Parcelas" value={premissas.numParcelas} onChange={v => setPremissas(p => ({ ...p, numParcelas: v }))} suffix="x" />
            <PremissaInput label="Acréscimo Cartão" value={premissas.parcelaPercent} onChange={v => setPremissas(p => ({ ...p, parcelaPercent: v }))} suffix="%" step="0.01" />
            <PremissaInput label="Acréscimo Pix" value={premissas.pixPercent} onChange={v => setPremissas(p => ({ ...p, pixPercent: v }))} suffix="%" step="0.1" />
          </div>

          {/* Observação */}
          <div style={{ background: CARD_BG, borderRadius: 20, padding: 20, boxShadow: "0 4px 24px rgba(61,46,39,.05)", marginBottom: 20, border: `1px solid ${HAIRLINE}` }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: "#3D2E27", margin: "0 0 14px" }}>Observação do Orçamento</h3>
            <textarea value={premissas.observacao} onChange={e => setPremissas(p => ({ ...p, observacao: e.target.value }))} rows={3} style={{ width: "100%", border: `1.5px solid ${HAIRLINE}`, borderRadius: 10, padding: 10, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#5A4A42", outline: "none", resize: "vertical", background: CARD_BG, boxSizing: "border-box" }} />
          </div>

          {/* Package Categories */}
          {[
            { key: "promocional", label: "Festas Promocionais", accent: "#C4938D" },
            { key: "tradicional", label: "Festas Tradicionais", accent: "#B8956A" },
            { key: "premium", label: "Festas Premium", accent: "#8B6F5E" },
          ].map(cat => {
            const isOpen = expandedCat === cat.key;
            const pkgs = premissas.packages.map((p, i) => ({ ...p, _i: i })).filter(p => p.categoria === cat.key);
            return (
              <div key={cat.key} style={{ marginBottom: 16 }}>
                <button onClick={() => setExpandedCat(isOpen ? null : cat.key)} style={{
                  width: "100%", padding: "14px 18px", background: CARD_BG, border: `1.5px solid ${HAIRLINE}`, borderRadius: 14,
                  display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, color: "#3D2E27",
                  boxShadow: "0 2px 8px rgba(61,46,39,.03)", transition: "all .2s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat.accent }} />
                    {cat.label}
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8C7B75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 10, animation: "fadeIn .2s ease" }}>
                    {pkgs.map(pkg => <PremissaPackageCard key={pkg.id} pkg={pkg} index={pkg._i} onChange={updatePackage} accent={cat.accent} />)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Report Button */}
          <button onClick={() => { setShowReport(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{
            width: "100%", padding: "16px 24px", border: "none", borderRadius: 16,
            background: "linear-gradient(135deg, #5A4A42 0%, #8B6F5E 100%)",
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", transition: "all .3s", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(90,74,66,.3)", letterSpacing: .5, marginBottom: 12,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Obter Relatório de Preços
          </button>

          {/* Restaurar Padrões - small link */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <button onClick={resetPremissas} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#A99890", fontFamily: "'DM Sans', sans-serif", textDecoration: "underline", padding: 4 }}>
              Restaurar padrões
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {!showReport && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,.95)", backdropFilter: "blur(20px)", borderTop: `1px solid ${HAIRLINE}`, display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[
            { key: "calc", label: "Calculadora", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg> },
            { key: "premissas", label: "Premissas", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="8" cy="7" r="2.5" fill="currentColor"/><circle cx="16" cy="12" r="2.5" fill="currentColor"/><circle cx="10" cy="17" r="2.5" fill="currentColor"/></svg> },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{
              flex: 1, padding: "10px 0 8px", border: "none", background: "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              cursor: "pointer", color: tab === t.key ? "#C4938D" : "#A99890", transition: "color .2s",
            }}>
              {t.icon}
              <span style={{ fontSize: 11, fontWeight: tab === t.key ? 700 : 500, fontFamily: "'DM Sans', sans-serif" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
