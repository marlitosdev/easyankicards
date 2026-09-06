/* =====================================================================
 * O REGISTRO INTEIRO, NUM LUGAR SÓ
 *
 * O aplicativo guarda cinco registros, cada um perto do que ele
 * observa: o geral (reg), o do material e das questões (matLog), o das
 * gerações de IA (gerLog), o da vinculação entre editais (vzLog) e os
 * instantâneos do plano. Cada um continua onde está — ler o registro da
 * vinculação dentro da tela de vinculação é o que faz aquele registro
 * ser útil ali.
 *
 * O QUE FALTAVA É A LINHA DO TEMPO ÚNICA. Investigar um defeito é
 * perguntar "o que aconteceu antes disto?", e a resposta quase nunca
 * está toda numa fonte só. O edital que foi gravado por cima do outro é
 * o exemplo: a pista estava no arquivo de backup, o horário no registro
 * geral, e a atividade da hora no registro do material — três lugares,
 * três formatos, três relógios (um deles em UTC).
 *
 * ESTA TELA NÃO GUARDA NADA. Ela lê as fontes e junta. Um sexto
 * registro seria mais uma coisa para sincronizar, e o defeito que ele
 * introduziria seria justamente do tipo que ele existe para achar.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * NÍVEIS
 *
 * Quatro, e não mais: ERRO (quebrou), AVISO (algo foi recusado ou
 * ignorado), INFO (aconteceu algo que muda o conteúdo) e DETALHE (a
 * pessoa mexeu na tela). A escala existe para uma pergunta prática —
 * "mostre só o que deu errado" — e escalas com sete níveis não são
 * usadas, são adivinhadas.
 *
 * O nível é DEDUZIDO do que já está gravado, não acrescentado a cada
 * chamada: reescrever as duzentas chamadas de reg() para carimbar um
 * nível seria mexer em duzentos lugares para ganhar um filtro.
 * ------------------------------------------------------------------ */
const RT_NIVEIS = ["erro", "aviso", "info", "detalhe"];

const RT_ERRO = /^(erro|falha)\b|\bexception\b|is not a function|is not defined|Uncaught/i;
const RT_AVISO = /recusad|ignorad|cancelad|dispensad|sem chave|nao foi possivel|não foi possível|vazio|invalid|conflito|duplicad/i;
const RT_DETALHE = /^(modo|diagnostico|plano-log)$|aberta?$|aberto$|em tela cheia|em janela|tamanho da caixa|painel aberto/i;

function rtNivel(tag, msg, extra) {
  const tudo = String(tag || "") + " " + String(msg || "") + " " + String(extra || "");
  if (RT_ERRO.test(tudo)) return "erro";
  if (RT_AVISO.test(tudo)) return "aviso";
  if (RT_DETALHE.test(String(tag || "")) || RT_DETALHE.test(String(msg || ""))) {
    return "detalhe";
  }
  return "info";
}

/* ---------------------------------------------------------------------
 * MASCARAR O QUE NÃO PODE SAIR DAQUI
 *
 * O registro é feito para ser copiado e mandado para alguém — é para
 * isso que existe o botão de copiar. A chave da IA vive no mesmo
 * armazenamento e pode aparecer num texto colado, numa URL de erro ou
 * num diagnóstico. Uma chave vazada vira cobrança na fatura de quem a
 * gerou, e o custo de mascarar é uma expressão regular.
 *
 * MASCARA POR FORMATO, e não pelo valor guardado: a chave que vazou
 * pode ser outra — uma que a pessoa colou e não salvou, ou a de outro
 * serviço. Guardar as quatro primeiras letras é o que permite conferir
 * "é a minha chave mesmo?" sem entregá-la.
 * ------------------------------------------------------------------ */
const RT_SEGREDOS = [
  /\bAIza[0-9A-Za-z_\-]{10,}/g,          /* Google / Gemini */
  /\bsk-[0-9A-Za-z_\-]{12,}/g,           /* OpenAI */
  /\bsk-ant-[0-9A-Za-z_\-]{12,}/g,       /* Anthropic */
  /\bghp_[0-9A-Za-z]{20,}/g,             /* GitHub */
  /\bBearer\s+[0-9A-Za-z._\-]{16,}/gi,
];

function rtMascarar(txt) {
  let s = String(txt == null ? "" : txt);
  RT_SEGREDOS.forEach((re) => {
    s = s.replace(re, (achado) => achado.slice(0, 6) + "…****");
  });
  /* e a chave guardada, mesmo que não case com nenhum formato acima */
  try {
    const k = localStorage.getItem("eac_chave_gemini") || "";
    if (k && k.length > 8) {
      s = s.split(k).join(k.slice(0, 6) + "…****");
    }
  } catch (e) {}
  return s;
}

/* ---------------------------------------------------------------------
 * JUNTAR AS FONTES
 *
 * Cada uma guarda o instante num campo diferente e num formato
 * diferente — o registro geral separa dia e hora em texto local, os
 * outros usam ISO. Aqui tudo vira um número, que é a única forma de
 * ordenar cinco relógios diferentes sem errar.
 * ------------------------------------------------------------------ */
function rtInstante(x) {
  const n = new Date(x).getTime();
  return isNaN(n) ? 0 : n;
}

function rtDoRegistroGeral() {
  const L = (typeof registro !== "undefined" && registro) ? registro : [];
  return L.map((r) => ({
    quando: rtInstante(r.d + "T" + (r.h || "00:00:00")),
    fonte: "app", tag: r.tipo || "", sessao: r.s || "",
    msg: r.msg || "", extra: r.extra || "",
  }));
}

function rtDoMaterial() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_mat_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "material",
    tag: String(x.t || "").toUpperCase(), sessao: "",
    msg: x.o || "", extra: [x.d, x.disc, x.top].filter(Boolean).join(" · "),
  }));
}

function rtDaGeracao() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_ger_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "geracao",
    tag: String(x.t || x.tipo || "").toUpperCase(), sessao: "",
    msg: x.o || x.msg || "", extra: x.d || x.extra || "",
  }));
}

function rtDaVinculacao() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_vinculo_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "vinculo",
    tag: String(x.e || "").toUpperCase(), sessao: "",
    msg: x.e || "",
    extra: Object.keys(x.n || {}).map((k) => k + "=" + x.n[k]).join("  "),
  }));
}

/* Tudo, em ordem, com nível e já mascarado. */
function rtTudo(opc) {
  const o = opc || {};
  let L = [].concat(rtDoRegistroGeral(), rtDoMaterial(),
                    rtDaGeracao(), rtDaVinculacao());
  L = L.filter((x) => x && x.quando > 0);
  L.forEach((x) => {
    x.nivel = rtNivel(x.tag, x.msg, x.extra);
    x.msg = rtMascarar(x.msg);
    x.extra = rtMascarar(x.extra);
  });
  /* MAIS NOVO PRIMEIRO: investigar é olhar para trás a partir de agora. */
  L.sort((a, b) => b.quando - a.quando);
  if (o.nivel && o.nivel !== "tudo") {
    const ate = RT_NIVEIS.indexOf(o.nivel);
    L = L.filter((x) => RT_NIVEIS.indexOf(x.nivel) <= ate);
  }
  if (o.fonte && o.fonte !== "tudo") L = L.filter((x) => x.fonte === o.fonte);
  if (o.desde) L = L.filter((x) => x.quando >= o.desde);
  if (o.limite) L = L.slice(0, o.limite);
  return L;
}

function rtContarPorNivel(lista) {
  const c = { erro: 0, aviso: 0, info: 0, detalhe: 0 };
  (lista || []).forEach((x) => { if (c[x.nivel] !== undefined) c[x.nivel]++; });
  return c;
}

function rtLinha(x) {
  const d = new Date(x.quando);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
    + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
    + "  " + String(x.nivel).toUpperCase().padEnd(7)
    + " " + String(x.fonte).padEnd(9)
    + " [" + x.tag + "] " + x.msg + (x.extra ? "  " + x.extra : "");
}

function rtTexto(opc) {
  const L = rtTudo(opc);
  const c = rtContarPorNivel(L);
  const cab = L.length + " eventos · " + c.erro + " erro(s) · "
    + c.aviso + " aviso(s)";
  return cab + "\n" + L.map(rtLinha).join("\n");
}

/* =====================================================================
 * A TELA
 *
 * Mora dentro do painel de diagnóstico, que já é onde se vai quando
 * algo deu errado — uma tela nova seria mais um lugar para lembrar.
 * ===================================================================== */
let rtFiltro = "nenhum";     /* "nenhum" | "tudo" | erro | aviso | info | fonte */

function rtPintarAbas() {
  const box = $("rtAbas");
  if (!box) return;
  box.innerHTML = "";
  const todos = rtTudo({});
  const c = rtContarPorNivel(todos);
  const fontes = {};
  todos.forEach((x) => { fontes[x.fonte] = (fontes[x.fonte] || 0) + 1; });

  const abas = [
    ["nenhum", t("rt_aba_fechar"), 0, false],
    ["erro", t("rt_aba_erro", { n: c.erro }), c.erro, c.erro > 0],
    ["aviso", t("rt_aba_aviso", { n: c.aviso }), c.aviso, false],
    ["tudo", t("rt_aba_tudo", { n: todos.length }), todos.length, false],
  ].concat(Object.keys(fontes).sort().map((f) =>
    ["fonte:" + f, t("rt_aba_fonte", { f: f, n: fontes[f] }), fontes[f], false]));

  abas.forEach(([id, rot, n, alerta]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rt-aba" + (rtFiltro === id ? " sel" : "")
      + (alerta ? " tem-erro" : "");
    b.textContent = rot;
    b.onclick = () => { rtFiltro = id; rtPintar(); };
    box.append(b);
  });
}

function rtPintar() {
  rtPintarAbas();
  const cx = $("rtLista");
  if (!cx) return;
  cx.innerHTML = "";
  cx.hidden = rtFiltro === "nenhum";
  if (cx.hidden) return;

  const opc = { limite: 400 };
  if (rtFiltro.indexOf("fonte:") === 0) opc.fonte = rtFiltro.slice(6);
  else if (rtFiltro !== "tudo") opc.nivel = rtFiltro;

  const L = rtTudo(opc);
  if (!L.length) {
    const p = document.createElement("div");
    p.className = "rt-li";
    p.textContent = t("rt_vazio");
    cx.append(p);
    return;
  }
  L.forEach((x) => {
    const li = document.createElement("div");
    li.className = "rt-li n-" + x.nivel;
    const q = document.createElement("span");
    q.className = "rt-q";
    const d = new Date(x.quando);
    const p2 = (v) => String(v).padStart(2, "0");
    q.textContent = p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " "
      + p2(d.getHours()) + ":" + p2(d.getMinutes());
    const f = document.createElement("span");
    f.className = "rt-f";
    f.textContent = x.fonte;
    const m = document.createElement("span");
    m.className = "rt-m";
    m.textContent = "[" + x.tag + "] " + x.msg + (x.extra ? "  " + x.extra : "");
    li.append(q, f, m);
    cx.append(li);
  });
}

function rtIniciarTela() { rtFiltro = "nenhum"; rtPintar(); }
