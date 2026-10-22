/* =====================================================================
 * CONSUMO DA API DO GEMINI (v18.99.0) — o painel, na tela da chave
 *
 * Cada chamada feita com a chave (a jurisprudência pelo juris-ia.js, os vínculos pelo vizinhos.js) é anotada NO
 * APARELHO: módulo, modelo que respondeu, tokens (os que o Google devolve em usageMetadata; nas incorporações, que não
 * devolvem, uma estimativa marcada como tal), busca do Google, tempo e status. NUNCA o texto do pedido.
 *
 * O que o app NÃO sabe e por isso pergunta, em vez de inventar:
 *  · o LIMITE diário da conta (muda com o plano e com o tempo; está no AI Studio) — sem ele, o painel só conta;
 *  · a COTAÇÃO do dólar — sem ela, só US$;
 *  · os PREÇOS: há uma tabela de partida (com a data), editável, e o link da página oficial de preços.
 * As FATURAS de verdade só o Console do Google mostra (a chave de API não dá acesso ao faturamento): aqui são anotações
 * da pessoa, com os atalhos para o Cloud Billing — e a estimativa do app vem sempre marcada como estimativa.
 * Tudo fica fora do backup (como a chave).
 * ===================================================================== */
const IAC_CH = "eac_ia_consumo";
const IAC_RECENTES = 50;
const IAC_DIAS = 120;
/* tabela de partida, por família de modelo (US$ por milhão de tokens; busca do Google por consulta) */
const IAC_TABELA_EM = "2026-10";
const IAC_PRECOS_PADRAO = {
  flash: { rotulo: "Gemini Flash", entrada: 0.30, saida: 2.50, busca: 0.035 },
  embedding: { rotulo: "Gemini Embedding", entrada: 0.15, saida: 0, busca: 0 },
};
const IAC_LINKS = [
  { id: "precos", url: "https://ai.google.dev/gemini-api/docs/pricing" },
  { id: "limites", url: "https://aistudio.google.com/rate-limit" },
  { id: "billing", url: "https://console.cloud.google.com/billing" },
  { id: "relatorios", url: "https://console.cloud.google.com/billing/reports" },
  { id: "cotas", url: "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas" },
];

function iacPadrao() {
  return { config: { limiteDia: 0, plano: "gratuito", cotacao: 0, precos: JSON.parse(JSON.stringify(IAC_PRECOS_PADRAO)), tabelaEm: IAC_TABELA_EM },
    porDia: {}, recentes: [], faturas: [], disp: null };
}
function iacLer() {
  const b = iacPadrao();
  try {
    const c = JSON.parse(localStorage.getItem(IAC_CH) || "null");
    if (!c || typeof c !== "object") return b;
    return {
      config: Object.assign({}, b.config, c.config || {}, { precos: Object.assign({}, b.config.precos, (c.config && c.config.precos) || {}) }),
      porDia: c.porDia && typeof c.porDia === "object" ? c.porDia : {},
      recentes: Array.isArray(c.recentes) ? c.recentes.slice(-IAC_RECENTES) : [],
      faturas: Array.isArray(c.faturas) ? c.faturas : [],
      disp: c.disp || null,
    };
  } catch (e) { return b; }
}
function iacSalvar(d) {
  try {
    const dias = Object.keys(d.porDia || {}).sort();
    while (dias.length > IAC_DIAS) delete d.porDia[dias.shift()];
    d.recentes = (d.recentes || []).slice(-IAC_RECENTES);
    localStorage.setItem(IAC_CH, JSON.stringify(d));
  } catch (e) {}
}
function iacHoje(agora) {
  const d = agora ? new Date(agora) : new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
/* a família de preço pelo nome do modelo que respondeu (flash-latest, 2.5-flash, …) */
function iacFamilia(modelo) { return /embed/i.test(String(modelo || "")) ? "embedding" : "flash"; }

/* o custo de TABELA de uma chamada (US$), pela tabela da pessoa */
function iacCusto(ev, precos) {
  const p = (precos || IAC_PRECOS_PADRAO)[iacFamilia(ev.modelo)] || IAC_PRECOS_PADRAO.flash;
  return (Math.max(0, +ev.tkIn || 0) / 1e6) * (+p.entrada || 0) + (Math.max(0, +ev.tkOut || 0) / 1e6) * (+p.saida || 0) + (ev.busca ? (+p.busca || 0) : 0);
}

/* ANOTA UMA CHAMADA. ev = { modulo, modelo, ok, status, ms, tkIn, tkOut, busca, estimado, erro } — sem texto do pedido */
function iacRegistrar(ev0) {
  const ev = ev0 || {};
  const d = iacLer();
  const dia = iacHoje(ev.em);
  const D = d.porDia[dia] || (d.porDia[dia] = { n: 0, ok: 0, erros: 0, cota: 0, tkIn: 0, tkOut: 0, buscas: 0, usd: 0, porModulo: {} });
  const ok = ev.ok !== false;
  const usd = ok ? iacCusto(ev, d.config.precos) : 0;
  D.n++;
  if (ok) D.ok++; else D.erros++;
  if (ev.status === 429 || ev.erro === "cota") D.cota++;
  D.tkIn += Math.max(0, +ev.tkIn || 0);
  D.tkOut += Math.max(0, +ev.tkOut || 0);
  if (ok && ev.busca) D.buscas++;
  D.usd += usd;
  const mod = String(ev.modulo || "outro");
  D.porModulo[mod] = (D.porModulo[mod] || 0) + 1;
  d.recentes.push({ em: ev.em || new Date().toISOString(), modulo: mod, modelo: String(ev.modelo || ""), ok, status: +ev.status || 0,
    ms: Math.max(0, Math.round(+ev.ms || 0)), tkIn: +ev.tkIn || 0, tkOut: +ev.tkOut || 0, busca: !!ev.busca, estimado: !!ev.estimado, erro: ev.erro ? String(ev.erro) : "" });
  iacSalvar(d);
  try { if (typeof iacPintarSelo === "function") iacPintarSelo(); } catch (e) {}
  return D;
}

/* O RESUMO: hoje, o mês (AAAA-MM) e o custo, de tabela e efetivo (no plano gratuito, efetivo = 0) */
function iacResumo(agora) {
  const d = iacLer();
  const hoje = iacHoje(agora);
  const mes = hoje.slice(0, 7);
  const H = d.porDia[hoje] || { n: 0, ok: 0, erros: 0, cota: 0, tkIn: 0, tkOut: 0, buscas: 0, usd: 0, porModulo: {} };
  const M = { n: 0, ok: 0, erros: 0, cota: 0, tkIn: 0, tkOut: 0, buscas: 0, usd: 0, porModulo: {} };
  Object.keys(d.porDia).filter((k) => k.slice(0, 7) === mes).forEach((k) => {
    const x = d.porDia[k];
    ["n", "ok", "erros", "cota", "tkIn", "tkOut", "buscas", "usd"].forEach((c) => { M[c] += +x[c] || 0; });
    Object.keys(x.porModulo || {}).forEach((m) => { M.porModulo[m] = (M.porModulo[m] || 0) + x.porModulo[m]; });
  });
  const cfg = d.config;
  return { hoje: H, mes: M, mesISO: mes, limiteDia: +cfg.limiteDia || 0, plano: cfg.plano, cotacao: +cfg.cotacao || 0,
    usdTabela: M.usd, usdEfetivo: cfg.plano === "pago" ? M.usd : 0, usdHojeTabela: H.usd, tabelaEm: cfg.tabelaEm, recentes: d.recentes.slice().reverse(), disp: d.disp };
}
function iacConfigurar(patch) {
  const d = iacLer();
  const p = patch || {};
  if (p.limiteDia !== undefined) d.config.limiteDia = Math.max(0, Math.round(+p.limiteDia || 0));
  if (p.plano === "gratuito" || p.plano === "pago") d.config.plano = p.plano;
  if (p.cotacao !== undefined) d.config.cotacao = Math.max(0, +String(p.cotacao).replace(",", ".") || 0);
  if (p.precos) Object.keys(p.precos).forEach((f) => { if (d.config.precos[f]) Object.assign(d.config.precos[f], p.precos[f]); });
  if (p.tabelaEm) d.config.tabelaEm = String(p.tabelaEm);
  iacSalvar(d);
  return d.config;
}
function iacLimpar() { const d = iacLer(); d.porDia = {}; d.recentes = []; iacSalvar(d); }

/* TESTAR A CHAVE: lista os modelos (só leitura, não gasta cota de geração); chave no cabeçalho, nunca na URL */
async function iacTestarChave(opc) {
  const o = opc || {};
  const chave = o.chave || (typeof vzChaveApi === "function" ? vzChaveApi() : "");
  const res = { em: new Date().toISOString(), ativa: false, status: 0, ms: 0, temFlash: false, temEmbedding: false, n: 0, erro: "" };
  if (!chave) { res.erro = "sem_chave"; return iacGuardarDisp(res); }
  const buscar = typeof window !== "undefined" && window && typeof window.fetch === "function" ? window.fetch.bind(window) : (typeof fetch === "function" ? fetch : null);
  if (!buscar) { res.erro = "rede"; return iacGuardarDisp(res); }
  const t0 = Date.now();
  try {
    const r = await buscar("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { method: "GET", headers: { "x-goog-api-key": chave } });
    res.ms = Date.now() - t0;
    res.status = r.status || 0;
    if (r.ok) {
      const dd = await r.json();
      const nomes = ((dd && dd.models) || []).map((m) => String(m.name || ""));
      res.n = nomes.length;
      res.temFlash = nomes.some((x) => /flash/i.test(x));
      res.temEmbedding = nomes.some((x) => /embedding/i.test(x));
      res.ativa = true;
    } else {
      let msg = "";
      try { const e = await r.json(); msg = (e && e.error && e.error.message) || ""; } catch (e2) {}
      res.erro = res.status === 429 ? "cota" : (res.status === 400 && /api key/i.test(msg)) || res.status === 401 || res.status === 403 ? "chave_recusada" : res.status >= 500 ? "servidor" : "rede";
    }
  } catch (e) { res.ms = Date.now() - t0; res.erro = "rede"; }
  return iacGuardarDisp(res);
}
function iacGuardarDisp(res) { const d = iacLer(); d.disp = res; iacSalvar(d); return res; }

/* FATURAS: anotações da pessoa (o app não lê o faturamento do Google) */
function iacFaturaGuardar(f) {
  const comp = String((f && f.competencia) || "").trim();
  if (!/^\d{4}-\d{2}$/.test(comp)) return null;
  const d = iacLer();
  const nova = { competencia: comp, valor: Math.max(0, +String((f && f.valor) || 0).replace(",", ".") || 0), moeda: f && f.moeda === "BRL" ? "BRL" : "USD",
    status: ["aberta", "paga", "isenta"].indexOf(f && f.status) >= 0 ? f.status : "aberta", nota: String((f && f.nota) || "").slice(0, 200) };
  d.faturas = d.faturas.filter((x) => x.competencia !== comp).concat([nova]).sort((a, b) => b.competencia.localeCompare(a.competencia));
  iacSalvar(d);
  return nova;
}
function iacFaturaStatus(comp, st) {
  const d = iacLer();
  const f = d.faturas.find((x) => x.competencia === comp);
  if (!f || ["aberta", "paga", "isenta"].indexOf(st) < 0) return null;
  f.status = st;
  iacSalvar(d);
  return f;
}
function iacFaturaApagar(comp) { const d = iacLer(); const n = d.faturas.length; d.faturas = d.faturas.filter((x) => x.competencia !== comp); iacSalvar(d); return d.faturas.length < n; }
function iacFaturas() { return iacLer().faturas; }

/* ---------------- a tela ---------------- */
function iacDinheiro(usd, cot) {
  const u = "US$ " + (usd < 0.01 && usd > 0 ? usd.toFixed(4) : usd.toFixed(2)).replace(".", ",");
  return cot > 0 ? u + " · R$ " + (usd * cot).toFixed(2).replace(".", ",") : u;
}
function iacMil(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " mi" : n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + " mil" : String(n); }

/* o selo do cabeçalho: só com chave guardada */
function iacPintarSelo() {
  const b = typeof $ === "function" ? $("btnHdrIa") : null;
  if (!b) return;
  const tem = typeof vzChaveApi === "function" && !!vzChaveApi();
  b.hidden = !tem;
  if (!tem) return;
  const r = iacResumo();
  b.textContent = t("iac_selo", { n: r.hoje.n, c: iacDinheiro(r.usdHojeTabela, 0) });
  b.title = t("iac_selo_aj");
}

/* as abas da tela da chave: chave · consumo · faturas */
function iacAba(qual) {
  ["chave", "consumo", "faturas"].forEach((a) => {
    const sec = $("vzAba_" + a), bt = $("btnVzAba_" + a);
    if (sec) sec.hidden = a !== qual;
    if (bt) { bt.className = "vz-aba" + (a === qual ? " ativa" : ""); bt.setAttribute("aria-selected", String(a === qual)); }
  });
  if (qual === "consumo") iacPintarConsumo();
  if (qual === "faturas") iacPintarFaturas();
  return qual;
}

function iacPintarConsumo() {
  const r = iacResumo();
  const cx = $("iacKpis");
  if (!cx) return;
  const card = (rot, val, sub, id) => {
    const d = document.createElement("div"); d.className = "iac-kpi"; if (id) d.id = id;
    const a = document.createElement("div"); a.className = "iac-kpi-rot"; a.textContent = rot;
    const b = document.createElement("div"); b.className = "iac-kpi-val"; b.textContent = val;
    const c = document.createElement("div"); c.className = "iac-kpi-sub"; c.textContent = sub;
    d.append(a, b, c);
    return d;
  };
  cx.innerHTML = "";
  cx.append(
    card(t("iac_k_hoje"), String(r.hoje.n), r.limiteDia ? t("iac_k_hoje_lim", { l: r.limiteDia, p: Math.round(r.hoje.n / r.limiteDia * 100) }) : t("iac_k_hoje_sem"), "iacKpiHoje"),
    card(t("iac_k_mes"), String(r.mes.n), r.mes.n ? t("iac_k_mes_sub", { p: Math.round(r.mes.ok / r.mes.n * 100), c: r.mes.cota }) : "—", "iacKpiMes"),
    card(t("iac_k_tokens"), iacMil(r.mes.tkIn + r.mes.tkOut), t("iac_k_tokens_sub", { e: iacMil(r.mes.tkIn), s: iacMil(r.mes.tkOut), b: r.mes.buscas }), "iacKpiTk"),
    card(t("iac_k_custo"), iacDinheiro(r.plano === "pago" ? r.usdTabela : 0, r.cotacao),
      r.plano === "pago" ? t("iac_k_custo_pago", { d: r.tabelaEm }) : t("iac_k_custo_gratis", { v: iacDinheiro(r.usdTabela, r.cotacao) }), "iacKpiCusto"));
  if ($("iacLimiteBarra")) { $("iacLimiteBarra").hidden = !r.limiteDia; $("iacLimiteBarra").value = r.limiteDia ? Math.min(100, Math.round(r.hoje.n / r.limiteDia * 100)) : 0; }
  /* disponibilidade (o último teste) */
  const dp = r.disp;
  if ($("iacDisp")) {
    $("iacDisp").className = "nota iac-disp" + (dp ? (dp.ativa ? " ok" : " erro") : "");
    $("iacDisp").textContent = !dp ? t("iac_disp_nunca")
      : dp.ativa ? t("iac_disp_ok", { ms: dp.ms, n: dp.n, f: dp.temFlash ? "✓" : "✗", e: dp.temEmbedding ? "✓" : "✗", d: new Date(dp.em).toLocaleString() })
      : t("iac_disp_erro_" + (dp.erro || "rede"), { s: dp.status });
  }
  if ($("iacPorModulo")) $("iacPorModulo").textContent = Object.keys(r.mes.porModulo).length
    ? t("iac_por_modulo") + " " + Object.keys(r.mes.porModulo).map((m) => t("iac_mod_" + m.toLowerCase()) + " " + r.mes.porModulo[m]).join(" · ") : t("iac_sem_chamadas");
  const L = $("iacRecentes");
  if (L) {
    L.innerHTML = "";
    r.recentes.slice(0, 15).forEach((x) => {
      const li = document.createElement("li");
      li.className = x.ok ? "" : "erro";
      li.textContent = [new Date(x.em).toLocaleString(), t("iac_mod_" + x.modulo.toLowerCase()), x.modelo || "—",
        (x.estimado ? "≈" : "") + iacMil(x.tkIn + x.tkOut) + " tokens" + (x.busca ? " · " + t("iac_busca") : ""), (x.ms / 1000).toFixed(1).replace(".", ",") + " s",
        x.ok ? String(x.status || 200) : (x.status || "") + " " + t("jur_ia_erro_" + (x.erro || "rede")).replace(/^✗\s*/, "").split(/[.(]/)[0]].join(" · ");
      L.append(li);
    });
  }
  /* a configuração, mostrada como está */
  const c = iacLer().config;
  if ($("iacLimite")) $("iacLimite").value = c.limiteDia || "";
  if ($("iacPlano")) $("iacPlano").value = c.plano;
  if ($("iacCotacao")) $("iacCotacao").value = c.cotacao ? String(c.cotacao).replace(".", ",") : "";
  if ($("iacTabela")) $("iacTabela").textContent = t("iac_tabela", { d: c.tabelaEm, fe: c.precos.flash.entrada, fs: c.precos.flash.saida, fb: c.precos.flash.busca, ee: c.precos.embedding.entrada });
}

function iacPintarFaturas() {
  const L = $("iacFaturas");
  if (!L) return;
  const r = iacResumo();
  if ($("iacFatEstimativa")) $("iacFatEstimativa").textContent = t("iac_fat_estimativa", { m: r.mesISO.split("-").reverse().join("/"), v: iacDinheiro(r.usdTabela, r.cotacao), p: t("iac_plano_" + r.plano) });
  L.innerHTML = "";
  const fs = iacFaturas();
  if (!fs.length) { const li = document.createElement("li"); li.className = "nota"; li.textContent = t("iac_fat_vazia"); L.append(li); }
  fs.forEach((f) => {
    const li = document.createElement("li");
    li.className = "iac-fat iac-fat-" + f.status;
    li.id = "iacFat_" + f.competencia;
    const tx = document.createElement("span");
    tx.textContent = f.competencia.split("-").reverse().join("/") + " · " + (f.moeda === "BRL" ? "R$ " : "US$ ") + f.valor.toFixed(2).replace(".", ",") + " · " + t("iac_fat_st_" + f.status) + (f.nota ? " · " + f.nota : "");
    li.append(tx);
    ["aberta", "paga", "isenta"].filter((s) => s !== f.status).forEach((s) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn-min"; b.id = "iacFat_" + f.competencia + "_" + s;
      b.textContent = t("iac_fat_marcar_" + s);
      b.onclick = () => { iacFaturaStatus(f.competencia, s); iacPintarFaturas(); };
      li.append(" ", b);
    });
    const x = document.createElement("button"); x.type = "button"; x.className = "btn-min"; x.id = "iacFat_" + f.competencia + "_apagar"; x.textContent = "✖"; x.title = t("iac_fat_apagar");
    x.onclick = async () => { if (await uiConfirm(t("iac_fat_apagar_conf", { m: f.competencia }))) { iacFaturaApagar(f.competencia); iacPintarFaturas(); } };
    li.append(" ", x);
    L.append(li);
  });
  const lk = $("iacLinks");
  if (lk && !lk.childNodes.length) IAC_LINKS.forEach((x, i) => {
    if (i) lk.append(" · ");
    const a = document.createElement("a"); a.href = x.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = t("iac_link_" + x.id);
    lk.append(a);
  });
}

function iacIniciarTela() {
  if (typeof document === "undefined" || !$("dlgVzChave")) return;
  ["chave", "consumo", "faturas"].forEach((a) => { if ($("btnVzAba_" + a)) $("btnVzAba_" + a).onclick = () => iacAba(a); });
  if ($("btnIacTestar")) $("btnIacTestar").onclick = async () => {
    $("btnIacTestar").disabled = true;
    if ($("iacDisp")) { $("iacDisp").className = "nota iac-disp"; $("iacDisp").textContent = t("iac_disp_testando"); }
    try { await iacTestarChave(); } finally { $("btnIacTestar").disabled = false; iacPintarConsumo(); }
  };
  if ($("btnIacSalvarCfg")) $("btnIacSalvarCfg").onclick = () => {
    iacConfigurar({ limiteDia: ($("iacLimite") || {}).value, plano: ($("iacPlano") || {}).value, cotacao: ($("iacCotacao") || {}).value });
    try { reg("IA", "consumo: configuração salva", "limite " + (($("iacLimite") || {}).value || "—") + " · plano " + (($("iacPlano") || {}).value || "")); } catch (e) {}
    iacPintarConsumo(); iacPintarSelo();
  };
  if ($("btnIacLimpar")) $("btnIacLimpar").onclick = async () => {
    if (!(await uiConfirm(t("iac_limpar_conf")))) return;
    iacLimpar(); iacPintarConsumo(); iacPintarSelo();
  };
  if ($("btnIacFatGuardar")) $("btnIacFatGuardar").onclick = () => {
    const f = iacFaturaGuardar({ competencia: ($("iacFatMes") || {}).value, valor: ($("iacFatValor") || {}).value, moeda: ($("iacFatMoeda") || {}).value, status: ($("iacFatStatus") || {}).value, nota: ($("iacFatNota") || {}).value });
    if ($("iacFatMsg")) $("iacFatMsg").textContent = f ? t("iac_fat_ok", { m: f.competencia.split("-").reverse().join("/") }) : t("iac_fat_erro");
    iacPintarFaturas();
  };
  if ($("btnHdrIa")) $("btnHdrIa").onclick = () => { if (typeof vzAbrirChave === "function") vzAbrirChave("consumo"); };
  ["btnIacFechar1", "btnIacFechar2"].forEach((id) => { if ($(id)) $(id).onclick = () => $("dlgVzChave").close(); });
  iacPintarSelo();
}
