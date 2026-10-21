/* =====================================================================
 * A IA DIRETO PELO APP, NA JURISPRUDÊNCIA (v18.97.0) — opcional, desligado por padrão
 *
 * Os pedidos à IA da jurisprudência eram todos copiar-e-colar: copiar o pedido, abrir uma IA, colar, copiar a
 * resposta, voltar, colar. O app já guarda uma chave do Gemini (vizinhos.js), mas a tela dela promete que a chave
 * serve SÓ para comparar os nomes dos tópicos. Por isso:
 *  · é OPCIONAL e desligado: a pessoa liga na tela da chave, que diz o que vai ao Google;
 *  · nada muda no caminho de sempre: o botão "🤖 Perguntar ao Gemini agora" fica AO LADO do copiar, e a resposta cai
 *    na MESMA caixa de "colar a resposta" — a conferência de sempre acontece antes de qualquer gravação;
 *  · a tela diz o que está acontecendo (⏳ consultando… N s, com Cancelar), há tempo-limite, e cada erro tem nome
 *    (chave recusada, cota, rede, tempo) — e sempre lembra que o copiar-e-colar continua funcionando;
 *  · as páginas em que a IA pesquisou aparecem como links para conferir — nunca são gravadas no campo "fonte"
 *    (o endereço que a busca devolve é um redirecionamento temporário do Google, não a página do tribunal).
 * ===================================================================== */
const JUR_IA_CH = "eac_jur_ia_direta";
const JUR_IA_MODELOS = ["gemini-flash-latest", "gemini-2.5-flash"];
const JUR_IA_TEMPO = 120000;
let jurIaEmCurso = null;   /* { ctrl, inicio, cancelado } — uma consulta por vez */

function jurIaLigada() { try { return localStorage.getItem(JUR_IA_CH) === "1"; } catch (e) { return false; } }
function jurIaLigar(sim) { try { if (sim) localStorage.setItem(JUR_IA_CH, "1"); else localStorage.removeItem(JUR_IA_CH); } catch (e) {} return jurIaLigada(); }
function jurIaPronta() { return jurIaLigada() && typeof vzChaveApi === "function" && !!vzChaveApi(); }

/* o erro com nome: chave_recusada · permissao · cota · servidor · rede · tempo · cancelado · sem_resposta · modelo */
function jurIaErro(cod, det) { const e = new Error(cod); e.codigo = cod; e.detalhe = det || ""; return e; }

/* PERGUNTA AO GEMINI. opc.busca liga a busca do Google (para conferir em fontes oficiais). Devolve { texto, fontes, modelo }.
 * A chave vai no cabeçalho (não na URL, que fica em registros de rede). */
async function jurIaPerguntar(pedido, opc) {
  const o = opc || {};
  const chave = o.chave || (typeof vzChaveApi === "function" ? vzChaveApi() : "");
  if (!chave) throw jurIaErro("sem_chave");
  /* window.fetch (o mesmo fetch no navegador): assim o teste consegue pôr um Gemini de mentira no lugar */
  const buscar = typeof window !== "undefined" && window && typeof window.fetch === "function" ? window.fetch.bind(window) : (typeof fetch === "function" ? fetch : null);
  if (!buscar) throw jurIaErro("rede");
  if (jurIaEmCurso) throw jurIaErro("ocupado");
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const em = { ctrl, inicio: Date.now(), cancelado: false };
  jurIaEmCurso = em;
  let tempoEsgotado = false;
  const timer = setTimeout(() => { tempoEsgotado = true; try { if (ctrl) ctrl.abort(); } catch (e) {} }, o.tempo || JUR_IA_TEMPO);
  try {
    const corpo = { contents: [{ role: "user", parts: [{ text: String(pedido || "") }] }], generationConfig: { temperature: 0.1 } };
    if (o.busca) corpo.tools = [{ google_search: {} }];
    let r = null, modelo = "";
    for (const m of (o.modelos || JUR_IA_MODELOS)) {
      modelo = m;
      try {
        r = await buscar("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
          body: JSON.stringify(corpo), signal: ctrl ? ctrl.signal : undefined,
        });
      } catch (e) {
        if (em.cancelado) throw jurIaErro("cancelado");
        if (tempoEsgotado) throw jurIaErro("tempo");
        throw jurIaErro("rede", String(e && e.message || e));
      }
      if (r && r.status === 404) continue;   /* modelo que a conta não tem: tenta o próximo */
      break;
    }
    if (!r) throw jurIaErro("rede");
    if (!r.ok) {
      let msg = "";
      try { const d = await r.json(); msg = (d && d.error && d.error.message) || ""; } catch (e) {}
      const st = r.status || 0;
      throw jurIaErro(st === 404 ? "modelo" : st === 400 && /api key/i.test(msg) ? "chave_recusada" : st === 401 || st === 403 ? (/api key/i.test(msg) ? "chave_recusada" : "permissao")
        : st === 429 ? "cota" : st >= 500 ? "servidor" : "rede", st + (msg ? " · " + msg : ""));
    }
    const d = await r.json();
    const cand = (d && d.candidates && d.candidates[0]) || null;
    const texto = cand && cand.content && (cand.content.parts || []).map((p) => p.text || "").join("\n").trim();
    if (!texto) throw jurIaErro("sem_resposta", cand && cand.finishReason ? String(cand.finishReason) : "");
    const fontes = ((cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [])
      .map((c) => c && c.web ? { titulo: String(c.web.title || ""), url: String(c.web.uri || "") } : null)
      .filter((f) => f && /^https?:\/\//.test(f.url));
    return { texto, fontes, modelo };
  } finally {
    clearTimeout(timer);
    if (jurIaEmCurso === em) jurIaEmCurso = null;
  }
}
function jurIaCancelar() {
  const em = jurIaEmCurso;
  if (!em) return false;
  em.cancelado = true;
  try { if (em.ctrl) em.ctrl.abort(); } catch (e) {}
  return true;
}

/* O BOTÃO, para qualquer pedido: opc = { id, pedido(): string|Promise<string>, destino: id da caixa da resposta,
 * depois(): o leitor de sempre, busca: bool, rotulo: para o registro }. Sem a chave ou sem ligar: um link discreto para
 * configurar (abre a tela da chave). */
function jurIaBotao(opc) {
  const box = document.createElement("span");
  box.className = "jur-ia-box";
  if (opc.id) box.id = opc.id;
  if (!jurIaPronta()) {
    const a = document.createElement("button");
    a.type = "button";
    a.className = "btn-min jur-ia-config";
    a.id = (opc.id || "jurIa") + "_config";
    a.textContent = t("jur_ia_config");
    a.title = t("jur_ia_config_aj");
    a.onclick = () => { if (typeof vzAbrirChave === "function") vzAbrirChave(); };
    box.append(a);
    return box;
  }
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-min btn-min-ok jur-ia-bt";
  b.id = (opc.id || "jurIa") + "_bt";
  b.textContent = t("jur_ia_btn");
  const comBusca = () => (typeof opc.busca === "function" ? !!opc.busca() : !!opc.busca);
  b.title = t(comBusca() ? "jur_ia_btn_aj_busca" : "jur_ia_btn_aj");
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "btn-min";
  cancelar.id = (opc.id || "jurIa") + "_cancelar";
  cancelar.textContent = t("jur_ia_cancelar");
  cancelar.hidden = true;
  cancelar.onclick = () => jurIaCancelar();
  const st = document.createElement("span");
  st.className = "nota jur-ia-status";
  st.id = (opc.id || "jurIa") + "_status";
  st.setAttribute("role", "status");
  st.setAttribute("aria-live", "polite");
  const fontes = document.createElement("span");
  fontes.className = "nota jur-ia-fontes";
  fontes.id = (opc.id || "jurIa") + "_fontes";
  b.onclick = async () => {
    let pedido = "";
    try { pedido = await opc.pedido(); } catch (e) { pedido = ""; }
    if (!pedido) return null;
    b.disabled = true;
    cancelar.hidden = false;
    fontes.textContent = "";
    const inicio = Date.now();
    const busca = comBusca();
    const msgEspera = () => t(busca ? "jur_ia_esperando_busca" : "jur_ia_esperando", { s: Math.round((Date.now() - inicio) / 1000) });
    st.className = "nota jur-ia-status esperando";
    st.textContent = msgEspera();
    const relogio = setInterval(() => { st.textContent = msgEspera(); }, 1000);
    try { reg("JURIS", "Gemini direto: consulta", (opc.rotulo || "") + " · " + pedido.length + " caracteres" + (busca ? " · com busca" : "")); } catch (e) {}
    try {
      const r = await jurIaPerguntar(pedido, { busca });
      const caixa = $(opc.destino);
      if (caixa) { caixa.value = r.texto; try { if (caixa.oninput) caixa.oninput(); } catch (e) {} }
      st.className = "nota jur-ia-status ok";
      st.textContent = t("jur_ia_ok", { s: Math.round((Date.now() - inicio) / 1000) });
      if (r.fontes.length) {
        fontes.append(t("jur_ia_fontes") + " ");
        r.fontes.slice(0, 6).forEach((f, i) => {
          if (i) fontes.append(" · ");
          const a = document.createElement("a");
          a.href = f.url; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = f.titulo || t("jur_ia_fonte_n", { n: i + 1 });
          fontes.append(a);
        });
      }
      try { reg("JURIS", "Gemini direto: resposta", (opc.rotulo || "") + " · " + r.texto.length + " caracteres · " + r.fontes.length + " fonte(s) · " + r.modelo); } catch (e) {}
      try { if (typeof opc.depois === "function") await opc.depois(r); } catch (e) {}
      return r;
    } catch (e) {
      const cod = (e && e.codigo) || "rede";
      st.className = "nota jur-ia-status erro";
      st.textContent = t("jur_ia_erro_" + cod) + (e && e.detalhe && cod !== "cancelado" ? " (" + e.detalhe + ")" : "") + " " + t("jur_ia_erro_rodape");
      try { reg("JURIS", "Gemini direto: falhou", (opc.rotulo || "") + " · " + cod + (e && e.detalhe ? " · " + e.detalhe : "")); } catch (e2) {}
      return null;
    } finally {
      clearInterval(relogio);
      b.disabled = false;
      cancelar.hidden = true;
    }
  };
  box.append(b, cancelar, st, fontes);
  return box;
}

/* coloca (ou troca) o botão num lugar fixo da tela: o contêiner de id "lugar" */
function jurIaMontar(lugar, opc) {
  const cx = $(lugar);
  if (!cx) return null;
  cx.innerHTML = "";
  const el = jurIaBotao(opc);
  cx.append(el);
  return el;
}
