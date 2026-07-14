"use client";

import { useMemo, useRef, useState } from "react";

type Row = Record<string, string>;
type ParsedFile = { name: string; headers: string[]; rows: Row[]; delimiter: string };
type ContactMap = { email: string; name: string; lastName: string; phone: string; province: string; city: string; country: string; marketing: string };
type SalesMap = { email: string; orderId: string; product: string; category: string; variant: string; date: string; total: string; name: string; phone: string; province: string; city: string; country: string; paymentStatus: string };
type Person = {
  email: string; name: string; lastName: string; phone: string; province: string; city: string; country: string;
  marketing: boolean | null; orders: number; spend: number; lastPurchase: string; products: string[]; categories: string[];
  variants: string[]; paymentStatuses: string[]; purchases: { date: string; product: string; category: string; variant: string }[];
};
type Rule = { id: number; field: "product" | "category" | "variant" | "province"; operator: "contains" | "not_contains"; value: string };

const emptyContactMap: ContactMap = { email: "", name: "", lastName: "", phone: "", province: "", city: "", country: "", marketing: "" };
const emptySalesMap: SalesMap = { email: "", orderId: "", product: "", category: "", variant: "", date: "", total: "", name: "", phone: "", province: "", city: "", country: "", paymentStatus: "" };

const aliases: Record<string, string[]> = {
  email: ["email", "e mail", "mail", "correo", "correo electronico", "customer email", "billing email"],
  name: ["name", "nombre", "first name", "firstname", "customer name", "billing name", "nombre del comprador", "nombre para el envio"],
  lastName: ["last name", "lastname", "apellido", "surname"],
  phone: ["phone", "telefono", "telephone", "whatsapp", "celular", "mobile", "telefono para el envio"],
  province: ["provincia", "provincia o estado", "province", "state", "region", "billing province"],
  city: ["ciudad", "city", "localidad", "town", "billing city"],
  country: ["pais", "country", "billing country"],
  marketing: ["accepts marketing", "acepta marketing", "marketing", "consent", "consentimiento", "opt in", "suscripto"],
  orderId: ["order id", "order", "pedido", "numero de orden", "numero de pedido", "identificador de la orden", "id pedido", "transaction id"],
  product: ["product", "producto", "item", "title", "nombre producto", "nombre del producto", "product title", "lineitem name"],
  category: ["category", "categoria", "product category", "tipo de producto", "collection"],
  variant: ["variant", "variante", "talle", "size", "color", "atributo", "lineitem variant"],
  date: ["date", "fecha", "created at", "order date", "fecha de compra", "fecha pedido"],
  total: ["total", "amount", "monto", "revenue", "price", "precio", "subtotal", "order total"],
  paymentStatus: ["estado del pago", "estado de pago", "payment status", "financial status", "status pago"],
};

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
const normalizeEmail = (value: string) => value.toLowerCase().replace(/\s+/g, "").trim();
const truthy = (value: string): boolean | null => {
  if (!value) return null;
  const v = normalize(value);
  if (["si", "yes", "true", "1", "acepta", "accepted", "suscripto", "subscribed"].includes(v)) return true;
  if (["no", "false", "0", "rechaza", "unsubscribed"].includes(v)) return false;
  return null;
};
const parseMoney = (value: string) => {
  if (!value) return 0;
  let clean = value.replace(/[^0-9,.-]/g, "");
  if (clean.includes(",") && clean.includes(".")) clean = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  else if (clean.includes(",")) clean = clean.replace(",", ".");
  return Number.parseFloat(clean) || 0;
};
const parseDate = (value: string) => {
  if (!value) return "";
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  const parts = value.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!parts) return "";
  const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
  return `${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
};
const esc = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function detectMap<T extends Record<string, string>>(headers: string[], template: T): T {
  const result = { ...template };
  for (const key of Object.keys(template)) {
    const names = aliases[key] || [];
    const exact = headers.find((h) => names.includes(normalize(h)));
    const loose = headers.find((h) => names.some((name) => normalize(h).includes(name) || name.includes(normalize(h))));
    result[key as keyof T] = (exact || loose || "") as T[keyof T];
  }
  return result;
}

function FileCard({ kind, file, busy, onFile }: { kind: "contactos" | "ventas"; file: ParsedFile | null; busy: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const title = kind === "contactos" ? "Base de contactos" : "Ventas o transacciones";
  const detail = kind === "contactos" ? "Tu audiencia completa, con email como mínimo." : "Pedidos, productos, fechas y montos.";
  return (
    <button type="button" className={`file-card ${file ? "is-ready" : ""}`} onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <span className="file-icon">{file ? "✓" : kind === "contactos" ? "01" : "02"}</span>
      <span className="file-copy"><strong>{title}</strong><small>{busy ? "Procesando…" : file ? `${file.name} · ${file.rows.length.toLocaleString("es-AR")} filas` : detail}</small></span>
      <span className="file-action">{file ? "Cambiar" : "Elegir CSV"}</span>
    </button>
  );
}

function MappingSelect({ label, value, headers, required, onChange }: { label: string; value: string; headers: string[]; required?: boolean; onChange: (value: string) => void }) {
  return <label className="mapping-field"><span>{label}{required && <b> obligatorio</b>}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="">No usar</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>;
}

export function SegmenterApp() {
  const [contactsFile, setContactsFile] = useState<ParsedFile | null>(null);
  const [salesFile, setSalesFile] = useState<ParsedFile | null>(null);
  const [contactMap, setContactMap] = useState<ContactMap>(emptyContactMap);
  const [salesMap, setSalesMap] = useState<SalesMap>(emptySalesMap);
  const [stage, setStage] = useState<"upload" | "mapping" | "dashboard">("upload");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [audience, setAudience] = useState("all");
  const [productText, setProductText] = useState("");
  const [excludeText, setExcludeText] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [minOrders, setMinOrders] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [whatsapp, setWhatsapp] = useState("any");
  const [marketing, setMarketing] = useState("any");
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleLogic, setRuleLogic] = useState<"and" | "or">("and");
  const [includePhone, setIncludePhone] = useState(true);
  const [showRules, setShowRules] = useState(false);

  const readFile = (kind: "contacts" | "sales", file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Elegí un archivo con formato CSV."); return; }
    setBusy(kind); setError("");
    const worker = new Worker("./csv-worker.js");
    worker.onmessage = ({ data }) => {
      worker.terminate(); setBusy("");
      if (data.error) { setError(data.error); return; }
      const parsed = { name: file.name, headers: data.headers, rows: data.rows, delimiter: data.delimiter } as ParsedFile;
      if (kind === "contacts") { setContactsFile(parsed); setContactMap(detectMap(parsed.headers, emptyContactMap)); }
      else { setSalesFile(parsed); setSalesMap(detectMap(parsed.headers, emptySalesMap)); }
    };
    worker.onerror = () => { worker.terminate(); setBusy(""); setError("No pudimos procesar ese archivo. Revisá su formato e intentá de nuevo."); };
    file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder("windows-1252").decode(bytes); }
      worker.postMessage({ text, id: kind });
    }).catch(() => { worker.terminate(); setBusy(""); setError("No pudimos leer ese archivo. Revisá que esté disponible e intentá de nuevo."); });
  };

  const people = useMemo<Person[]>(() => {
    if (!contactsFile && !salesFile) return [];
    if (contactsFile && !contactMap.email) return [];
    if (salesFile && !salesMap.email) return [];

    const purchaseMap = new Map<string, { rows: Row[]; orders: Set<string>; totals: Map<string, number> }>();
    (salesFile?.rows || []).forEach((row, index) => {
      const email = normalizeEmail(row[salesMap.email] || ""); if (!email) return;
      const item = purchaseMap.get(email) || { rows: [], orders: new Set<string>(), totals: new Map<string, number>() };
      const orderKey = salesMap.orderId && row[salesMap.orderId] ? row[salesMap.orderId] : `fila-${index}`;
      item.rows.push(row); item.orders.add(orderKey);
      if (!item.totals.has(orderKey)) item.totals.set(orderKey, parseMoney(salesMap.total ? row[salesMap.total] : ""));
      purchaseMap.set(email, item);
    });

    const unique = new Map<string, Row>();
    (contactsFile?.rows || []).forEach((row) => {
      const email = normalizeEmail(row[contactMap.email] || "");
      if (email && !unique.has(email)) unique.set(email, row);
    });
    purchaseMap.forEach((_bundle, email) => { if (!unique.has(email)) unique.set(email, {}); });

    return Array.from(unique.entries()).map(([email, row]) => {
      const bundle = purchaseMap.get(email); const sales = bundle?.rows || []; const firstSale = sales[0] || {};
      const values = (field: keyof SalesMap) => {
        if (field === "variant" && !salesMap.variant && salesMap.product) {
          return Array.from(new Set(sales.flatMap((sale) => {
            const productName = sale[salesMap.product] || "";
            const match = productName.match(/\(([^()]*)\)\s*$/);
            if (!match) return [];
            const parts = match[1].split(",").map((value) => value.trim()).filter(Boolean);
            return [match[1].trim(), ...parts];
          })));
        }
        return Array.from(new Set(sales.map((sale) => salesMap[field] ? sale[salesMap[field]] : "").filter(Boolean)));
      };
      const dates = sales.map((sale) => parseDate(salesMap.date ? sale[salesMap.date] : "")).filter(Boolean).sort();
      return {
        email, name: (contactMap.name ? row[contactMap.name] || "" : "") || (salesMap.name ? firstSale[salesMap.name] || "" : ""), lastName: contactMap.lastName ? row[contactMap.lastName] || "" : "",
        phone: (contactMap.phone ? row[contactMap.phone] || "" : "") || (salesMap.phone ? firstSale[salesMap.phone] || "" : ""), province: (contactMap.province ? row[contactMap.province] || "" : "") || (salesMap.province ? firstSale[salesMap.province] || "" : ""),
        city: (contactMap.city ? row[contactMap.city] || "" : "") || (salesMap.city ? firstSale[salesMap.city] || "" : ""), country: (contactMap.country ? row[contactMap.country] || "" : "") || (salesMap.country ? firstSale[salesMap.country] || "" : ""),
        marketing: contactMap.marketing ? truthy(row[contactMap.marketing] || "") : null, orders: bundle?.orders.size || 0,
        spend: Array.from(bundle?.totals.values() || []).reduce((sum, total) => sum + total, 0), lastPurchase: dates.at(-1) || "",
        products: values("product"), categories: values("category"), variants: values("variant"), paymentStatuses: salesMap.paymentStatus ? Array.from(new Set([...values("paymentStatus"), ...(sales.some((sale) => !sale[salesMap.paymentStatus]) ? ["Sin informar"] : [])])) : [],
        purchases: sales.map((sale) => ({ date: parseDate(salesMap.date ? sale[salesMap.date] : ""), product: salesMap.product ? sale[salesMap.product] || "" : "", category: salesMap.category ? sale[salesMap.category] || "" : "", variant: salesMap.variant ? sale[salesMap.variant] || "" : "" })),
      };
    });
  }, [contactsFile, salesFile, contactMap, salesMap]);

  const categories = useMemo(() => Array.from(new Set(people.flatMap((p) => p.categories))).sort(), [people]);
  const variants = useMemo(() => Array.from(new Set(people.flatMap((p) => p.variants))).sort(), [people]);
  const paymentStatuses = useMemo(() => Array.from(new Set(people.flatMap((p) => p.paymentStatuses))).sort(), [people]);
  const provinces = useMemo(() => Array.from(new Set(people.map((p) => p.province).filter(Boolean))).sort(), [people]);
  const filtered = useMemo(() => people.filter((p) => {
    if (audience === "buyers" && !p.orders) return false; if (audience === "nonbuyers" && p.orders) return false;
    if (productText && !p.products.some((x) => normalize(x).includes(normalize(productText)))) return false;
    if (excludeText && p.products.some((x) => normalize(x).includes(normalize(excludeText)))) return false;
    if (selectedCategories.length && !p.categories.some((x) => selectedCategories.includes(x))) return false;
    if (selectedVariants.length && !p.variants.some((x) => selectedVariants.includes(x))) return false;
    if (selectedPaymentStatuses.length && !p.paymentStatuses.some((x) => selectedPaymentStatuses.includes(x))) return false;
    if (selectedProvinces.length && !selectedProvinces.includes(p.province)) return false;
    if (minOrders && p.orders < Number(minOrders)) return false; if (minSpend && p.spend < Number(minSpend)) return false;
    if (dateFrom || dateTo) { const match = p.purchases.some((x) => x.date && (!dateFrom || x.date >= dateFrom) && (!dateTo || x.date <= dateTo)); if (!match) return false; }
    if (whatsapp === "yes" && !p.phone) return false; if (whatsapp === "no" && p.phone) return false;
    if (marketing === "yes" && p.marketing !== true) return false; if (marketing === "no" && p.marketing !== false) return false;
    if (rules.length) {
      const matches = rules.map((rule) => {
        const pool = rule.field === "product" ? p.products : rule.field === "category" ? p.categories : rule.field === "variant" ? p.variants : [p.province];
        const found = pool.some((x) => normalize(x).includes(normalize(rule.value))); return rule.operator === "contains" ? found : !found;
      });
      if (ruleLogic === "and" ? matches.some((m) => !m) : matches.every((m) => !m)) return false;
    }
    return true;
  }), [people, audience, productText, excludeText, selectedCategories, selectedVariants, selectedPaymentStatuses, selectedProvinces, minOrders, minSpend, dateFrom, dateTo, whatsapp, marketing, rules, ruleLogic]);

  const toggle = (value: string, list: string[], setter: (v: string[]) => void) => setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const resetFilters = () => { setAudience("all"); setProductText(""); setExcludeText(""); setSelectedCategories([]); setSelectedVariants([]); setSelectedPaymentStatuses([]); setSelectedProvinces([]); setMinOrders(""); setMinSpend(""); setDateFrom(""); setDateTo(""); setWhatsapp("any"); setMarketing("any"); setRules([]); };
  const startMapping = () => { if (!contactsFile && !salesFile) return; setStage("mapping"); };
  const finishMapping = () => { if ((contactsFile && !contactMap.email) || (salesFile && !salesMap.email)) { setError("Indicá la columna de email en cada archivo cargado para poder identificar a las personas."); return; } setError(""); setStage("dashboard"); };
  const exportCsv = () => {
    const headers = ["Email", "Nombre", "Apellido", ...(includePhone ? ["Telefono / WhatsApp"] : []), "Provincia", "Ciudad", "Pais", "Cantidad de compras", "Gasto total", "Ultima compra", "Productos", "Categorias", "Variantes", "Estados de pago"];
    const lines = filtered.map((p) => [p.email, p.name, p.lastName, ...(includePhone ? [p.phone] : []), p.province, p.city, p.country, p.orders, p.spend.toFixed(2), p.lastPurchase, p.products.join(" | "), p.categories.join(" | "), p.variants.join(" | "), p.paymentStatuses.join(" | ")].map(esc).join(";"));
    const blob = new Blob(["\uFEFF" + headers.map(esc).join(";") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `segmento-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (stage === "upload") return <main className="welcome-shell">
    <nav className="topbar"><div className="brand"><img src="./creative-center-positive.png" alt="Creative Center" /></div><span className="privacy-pill"><i /> 100% privado</span></nav>
    <section className="hero"><div className="eyebrow">Segmentación simple. Datos bajo control.</div><h1>Convertí tus datos en<br/><em>audiencias accionables.</em></h1><p>Cruzá tu base de contactos con ventas, encontrá oportunidades y exportá segmentos listos para activar.</p></section>
    <section className="upload-panel"><div className="panel-heading"><div><span>PASO 1 DE 2</span><h2>Cargá uno o ambos archivos</h2></div><p>Podés analizar contactos, ventas o cruzar ambos. Aceptamos CSV con coma o punto y coma.</p></div><div className="file-grid"><FileCard kind="contactos" file={contactsFile} busy={busy === "contacts"} onFile={(f) => readFile("contacts", f)} /><FileCard kind="ventas" file={salesFile} busy={busy === "sales"} onFile={(f) => readFile("sales", f)} /></div>{error && <div className="error">{error}</div>}<button className="primary wide" disabled={(!contactsFile && !salesFile) || !!busy} onClick={startMapping}>Revisar y continuar <span>→</span></button></section>
    <div className="privacy-note"><span>⌁</span><div><strong>Tus datos no salen de este navegador.</strong><p>No subimos ni almacenamos tus archivos. Al cerrar o recargar esta pestaña, desaparecen.</p></div></div>
  </main>;

  if (stage === "mapping") return <main className="mapping-shell">
    <nav className="topbar"><button className="text-button" onClick={() => setStage("upload")}>← Volver</button><div className="brand"><img src="./creative-center-positive.png" alt="Creative Center" /></div><span className="privacy-pill"><i /> local</span></nav>
    <section className="mapping-intro"><span>PASO 2 DE 2</span><h1>Confirmá cómo leer los datos</h1><p>Detectamos estas columnas automáticamente. Corregí cualquier campo que no coincida.</p></section>
    <section className={`mapping-grid ${contactsFile && salesFile ? "" : "single"}`}>
      {contactsFile && <div className="mapping-card"><header><span>01</span><div><h2>Contactos</h2><p>{contactsFile.name}</p></div></header><div className="mapping-fields">{([['email','Email'],['name','Nombre'],['lastName','Apellido'],['phone','Teléfono / WhatsApp'],['province','Provincia'],['city','Ciudad'],['country','País'],['marketing','Acepta marketing']] as [keyof ContactMap,string][]).map(([key,label]) => <MappingSelect key={key} label={label} required={key==='email'} value={contactMap[key]} headers={contactsFile.headers} onChange={(v) => setContactMap({...contactMap,[key]:v})}/>)}</div></div>}
      {salesFile && <div className="mapping-card"><header><span>{contactsFile ? '02' : '01'}</span><div><h2>Ventas o transacciones</h2><p>{salesFile.name}</p></div></header><div className="mapping-fields">{([['email','Email'],['orderId','ID de operación'],['product','Producto o servicio'],['category','Categoría'],['variant','Variante / atributo'],['date','Fecha'],['total','Monto'],['paymentStatus','Estado del pago'],['name','Nombre del cliente'],['phone','Teléfono'],['province','Provincia'],['city','Ciudad'],['country','País']] as [keyof SalesMap,string][]).map(([key,label]) => <MappingSelect key={key} label={label} required={key==='email'} value={salesMap[key]} headers={salesFile.headers} onChange={(v) => setSalesMap({...salesMap,[key]:v})}/>)}</div></div>}
    </section>
    {error && <div className="error centered">{error}</div>}
    <div className="mapping-footer"><p>{contactsFile && <><strong>{contactsFile.rows.length.toLocaleString("es-AR")}</strong> contactos</>}{contactsFile && salesFile && ' · '}{salesFile && <><strong>{salesFile.rows.length.toLocaleString("es-AR")}</strong> transacciones</>}</p><button className="primary" onClick={finishMapping}>Crear audiencia <span>→</span></button></div>
  </main>;
  const buyers = people.filter((p) => p.orders > 0).length;
  const phoneCount = people.filter((p) => p.phone).length;
  return <main className="app-shell"><aside className="sidebar"><div className="brand light"><img src="./creative-center-negative.png" alt="Creative Center" /></div><div className="side-label">TIPO DE CONTACTO</div><div className="segmented">{[["all","Toda la base"],["buyers","Compradores"],["nonbuyers","No compradores"]].map(([value,label]) => <button key={value} disabled={!salesFile && value!=='all'} className={audience===value?'active':''} onClick={()=>setAudience(value)}>{label}</button>)}</div><div className="filter-block"><label>Producto o servicio contiene<input value={productText} onChange={(e)=>setProductText(e.target.value)} placeholder="Ej. línea premium" /></label><label>Excluir producto o servicio<input value={excludeText} onChange={(e)=>setExcludeText(e.target.value)} placeholder="Ej. muestra gratis" /></label></div>{categories.length > 0 && <div className="filter-block"><div className="side-label row-label">CATEGORÍAS <small>{selectedCategories.length || ''}</small></div><div className="chip-list">{categories.slice(0,12).map((x)=><button key={x} className={selectedCategories.includes(x)?'active':''} onClick={()=>toggle(x,selectedCategories,setSelectedCategories)}>{x}</button>)}</div></div>}{variants.length > 0 && <div className="filter-block"><div className="side-label row-label">VARIANTES / ATRIBUTOS <small>{selectedVariants.length || ''}</small></div><div className="chip-list">{variants.slice(0,14).map((x)=><button key={x} className={selectedVariants.includes(x)?'active':''} onClick={()=>toggle(x,selectedVariants,setSelectedVariants)}>{x}</button>)}</div></div>}{paymentStatuses.length > 0 && <div className="filter-block"><div className="side-label row-label">ESTADO DEL PAGO <small>{selectedPaymentStatuses.length || ''}</small></div><div className="chip-list">{paymentStatuses.map((x)=><button key={x} className={selectedPaymentStatuses.includes(x)?'active':''} onClick={()=>toggle(x,selectedPaymentStatuses,setSelectedPaymentStatuses)}>{x}</button>)}</div></div>}{provinces.length > 0 && <div className="filter-block"><div className="side-label row-label">UBICACIÓN <small>{selectedProvinces.length || ''}</small></div><div className="chip-list">{provinces.slice(0,10).map((x)=><button key={x} className={selectedProvinces.includes(x)?'active':''} onClick={()=>toggle(x,selectedProvinces,setSelectedProvinces)}>{x}</button>)}</div></div>}<div className="filter-block two-col"><label>Compras mín.<input type="number" min="0" value={minOrders} onChange={(e)=>setMinOrders(e.target.value)} placeholder="0"/></label><label>Gasto mín.<input type="number" min="0" value={minSpend} onChange={(e)=>setMinSpend(e.target.value)} placeholder="$ 0"/></label></div><div className="filter-block two-col"><label>Compra desde<input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)}/></label><label>Compra hasta<input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)}/></label></div><div className="filter-block two-col"><label>WhatsApp<select value={whatsapp} onChange={(e)=>setWhatsapp(e.target.value)}><option value="any">Todos</option><option value="yes">Con WhatsApp</option><option value="no">Sin WhatsApp</option></select></label><label>Marketing<select value={marketing} onChange={(e)=>setMarketing(e.target.value)}><option value="any">Todos</option><option value="yes">Acepta</option><option value="no">No acepta</option></select></label></div><button className="rules-toggle" onClick={()=>setShowRules(!showRules)}>⊕ Condiciones avanzadas <span>{rules.length || '⌄'}</span></button>{showRules && <div className="rules-box"><select value={ruleLogic} onChange={(e)=>setRuleLogic(e.target.value as 'and'|'or')}><option value="and">Cumplir todas (Y)</option><option value="or">Cumplir alguna (O)</option></select>{rules.map((rule)=><div className="rule" key={rule.id}><select value={rule.field} onChange={(e)=>setRules(rules.map(r=>r.id===rule.id?{...r,field:e.target.value as Rule['field']}:r))}><option value="product">Producto o servicio</option><option value="category">Categoría</option><option value="variant">Variante</option><option value="province">Provincia</option></select><select value={rule.operator} onChange={(e)=>setRules(rules.map(r=>r.id===rule.id?{...r,operator:e.target.value as Rule['operator']}:r))}><option value="contains">contiene</option><option value="not_contains">no contiene</option></select><input value={rule.value} onChange={(e)=>setRules(rules.map(r=>r.id===rule.id?{...r,value:e.target.value}:r))} placeholder="valor"/><button onClick={()=>setRules(rules.filter(r=>r.id!==rule.id))}>×</button></div>)}<button className="add-rule" onClick={()=>setRules([...rules,{id:Date.now(),field:'product',operator:'contains',value:''}])}>+ Agregar condición</button></div>}<button className="reset" onClick={resetFilters}>Limpiar filtros</button></aside><section className="workspace"><header className="workspace-header"><div><span>SEGMENTO ACTUAL</span><h1>{audience==='buyers'?'Compradores':audience==='nonbuyers'?'No compradores':'Toda la base'}</h1></div><div className="header-actions"><button className="secondary" onClick={()=>setStage('mapping')}>Revisar archivos</button><button className="primary" onClick={exportCsv} disabled={!filtered.length}>Exportar CSV ↓</button></div></header><div className="stats">
  <article><span>{contactsFile ? 'Contactos' : 'Personas'}</span><strong>{people.length.toLocaleString('es-AR')}</strong><small>{contactsFile && salesFile ? 'base unificada' : contactsFile ? 'base cargada' : 'detectadas en ventas'}</small></article>
  {salesFile && <article><span>Compradores</span><strong>{buyers.toLocaleString('es-AR')}</strong><small>{people.length ? Math.round(buyers/people.length*100) : 0}% de la base</small></article>}
  {salesFile && contactsFile && <article><span>No compradores</span><strong>{(people.length-buyers).toLocaleString('es-AR')}</strong><small>oportunidad</small></article>}
  <article><span>Con WhatsApp</span><strong>{phoneCount.toLocaleString('es-AR')}</strong><small>contactables</small></article>
  <article className="highlight"><span>Resultado</span><strong>{filtered.length.toLocaleString('es-AR')}</strong><small>personas</small></article>
</div><div className="results-card"><div className="results-head"><div><h2>Vista previa del segmento</h2><p>Mostrando hasta 100 personas. La exportación incluye el resultado completo.</p></div><label className="check"><input type="checkbox" checked={includePhone} onChange={(e)=>setIncludePhone(e.target.checked)}/><span/> Incluir teléfono al exportar</label></div><div className="table-wrap"><table><thead><tr><th>Contacto</th><th>Ubicación</th><th>Compras</th><th>Gasto total</th><th>Última compra</th><th>Productos / servicios</th></tr></thead><tbody>{filtered.slice(0,100).map((p)=><tr key={p.email}><td><strong>{[p.name,p.lastName].filter(Boolean).join(' ') || 'Sin nombre'}</strong><small>{p.email}</small></td><td>{[p.city,p.province].filter(Boolean).join(', ') || '—'}</td><td><span className={`count ${p.orders?'has-orders':''}`}>{p.orders}</span></td><td>{p.spend ? p.spend.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td><td>{p.lastPurchase || '—'}</td><td><div className="product-cell">{p.products.slice(0,2).map(x=><span key={x}>{x}</span>)}{p.products.length>2&&<small>+{p.products.length-2}</small>}</div></td></tr>)}{!filtered.length&&<tr><td colSpan={6}><div className="empty"><strong>No hay coincidencias</strong><span>Probá quitando algún filtro o condición.</span></div></td></tr>}</tbody></table></div></div><footer className="app-footer"><span><i/> Los datos viven solo en esta pestaña</span><span>Audiencias · Creative Center</span></footer></section></main>;
}
