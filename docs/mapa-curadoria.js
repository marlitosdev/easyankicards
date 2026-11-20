/* =====================================================================
 * (19.178.0) 🔍 A CURADORIA DE QUALIDADE DO MAPA — e o registro para pedir a avaliação
 *
 * O mapa é material de revisão: se um galho estiver errado, a pessoa decora o erro. A conferência automática do mapa
 * da IA (mapa-ia.js) pega o galho que não está no resumo e o número inventado, mas não sabe se o RESUMO está certo, nem
 * se a IA trocou o sentido usando as mesmas palavras. Por isso:
 *  · CURADORIA: no modo "🔍 curadoria", cada galho ganha "✓ confere", "✗ errado" ou "? duvidoso", com uma nota (o que
 *    está errado, de onde veio a dúvida). Vale para os dois mapas (do resumo e da IA), cada um com a sua curadoria,
 *    guardada pelo CAMINHO do galho (como o treino), neste aparelho e no backup;
 *  · fora do modo, o veredito fica à vista no galho (✗ errado, ? duvidoso), para ninguém estudar o erro sem saber;
 *  · O REGISTRO DE QUALIDADE junta, do mapa à vista: o que você marcou como errado ou duvidoso e os avisos automáticos
 *    (não está no resumo, número fora do resumo), cada um com o trecho do resumo de onde o galho saiu;
 *  · e monta o PEDIDO DE AVALIAÇÃO (para uma IA, um professor, um colega): o mapa inteiro como contexto e os pontos
 *    numerados, pedindo veredito, correção e fonte de cada um. Sem pontos marcados, pede a avaliação do mapa inteiro;
 *  · a avaliação que voltar pode ser colada e GUARDADA no registro (com a data) — a correção do resumo continua sendo
 *    sua: nada é aplicado sozinho.
 * ===================================================================== */
const MM_CUR_CH = "eac_mm_curadoria";
let mmCuradoria = false;
function mmCurLer() { try { const v = JSON.parse(localStorage.getItem(MM_CUR_CH) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function mmCurGravar(m) { try { localStorage.setItem(MM_CUR_CH, JSON.stringify(m)); } catch (e) {} }
/* a curadoria do mapa à vista: { caminho: { v: "ok"|"errado"|"duvida", nota, label, det, linha, em } } */
function mmCurDoMapa(ch) { const m = mmCurLer()[ch || mmChaveResumo()]; return m && typeof m === "object" ? m : {}; }
function mmCurHoje() { return typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10); }
function mmCurMarcar(no, v, nota) {
  const ch = mmChaveResumo();
  if (!ch || !no || no.raiz) return null;
  const m = mmCurLer();
  const d = m[ch] && typeof m[ch] === "object" ? m[ch] : {};
  if (!v) delete d[no.caminho];
  else d[no.caminho] = { v, nota: String(nota || "").trim(), label: no.label, det: no.det || "", linha: no.linha, em: mmCurHoje() };
  if (Object.keys(d).length) m[ch] = d; else delete m[ch];
  mmCurGravar(m);
  try { matReg("ler", "mapa: curadoria", (v || "desfeito") + " · " + no.label + (nota ? " · " + nota : "") + " · " + ch); } catch (e) {}
  if (typeof matMapaPintar === "function") matMapaPintar();
  return d[no.caminho] || null;
}
/* o toque no botão: o mesmo veredito de novo desfaz; "errado" e "duvidoso" perguntam a nota (pode ficar em branco) */
function mmCurTocar(no, v) {
  const atual = mmCurDoMapa()[no.caminho];
  if (atual && atual.v === v) return mmCurMarcar(no, "");
  let nota = atual ? atual.nota : "";
  if (v !== "ok" && typeof prompt === "function") {
    const r = prompt(t(v === "errado" ? "mmq_nota_errado" : "mmq_nota_duvida", { g: no.label }), nota || "");
    if (r === null) return null;
    nota = r;
  }
  return mmCurMarcar(no, v, nota);
}
function mmCurAlternar(sim) {
  mmCuradoria = sim === undefined ? !mmCuradoria : !!sim;
  /* curadoria e treino não convivem: um esconde o que o outro precisa ver */
  if (mmCuradoria && typeof mmTreino !== "undefined" && mmTreino) { mmTreino = false; try { mmRevelados = {}; } catch (e) {} }
  if (typeof matMapaPintar === "function") matMapaPintar();
  try { matReg("ler", mmCuradoria ? "mapa: curadoria ligada" : "mapa: curadoria desligada", mmChaveResumo()); } catch (e) {}
  return mmCuradoria;
}
/* a conta da curadoria na árvore à vista (o que saiu do mapa não conta) */
function mmCurContar(arv) {
  const cur = mmCurDoMapa();
  const c = { ok: 0, errado: 0, duvida: 0, falta: 0, total: 0 };
  const ir = (no) => { if (!no.raiz) { c.total++; const x = cur[no.caminho]; if (x && c[x.v] != null) c[x.v]++; else c.falta++; } no.filhos.forEach(ir); };
  if (arv) ir(arv.raiz);
  return c;
}

/* ---------------- o desenho no galho (chamado por mmNoEl) ---------------- */
function mmCurNoEl(no, li, cx) {
  if (no.raiz) return;
  const x = mmCurDoMapa()[no.caminho];
  if (x) li.className += " mm-cur-" + x.v;
  if (mmCuradoria) {
    const box = document.createElement("span");
    box.className = "mm-cur";
    [["ok", "mmCurOk_", "mmq_ok"], ["errado", "mmCurErr_", "mmq_errado"], ["duvida", "mmCurDuv_", "mmq_duvida"]].forEach(([v, pre, k]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn-min mm-cur-" + v + "-bt" + (x && x.v === v ? " on" : ""); b.id = pre + no.id;
      b.textContent = t(k); b.title = t(k + "_tip");
      b.setAttribute("aria-pressed", x && x.v === v ? "true" : "false");
      b.onclick = () => mmCurTocar(no, v);
      box.append(b);
    });
    cx.append(box);
  }
  if (x && x.v !== "ok") {
    const s = document.createElement("span");
    s.className = "mm-cur-selo mm-cur-selo-" + x.v;
    s.textContent = t(x.v === "errado" ? "mmq_selo_errado" : "mmq_selo_duvida");
    s.title = (x.nota ? x.nota + " · " : "") + t("mmq_selo_tip", { d: String(x.em || "").split("-").reverse().join("/") });
    cx.append(s);
  } else if (x && !mmCuradoria) {
    const s = document.createElement("span"); s.className = "mm-cur-selo mm-cur-selo-ok"; s.textContent = "✓"; s.title = t("mmq_ok_tip"); cx.append(s);
  }
  /* (19.179.0) a avaliação apontou erro neste galho e ainda não foi resolvido */
  const pend = mmQualPendenteDe(no);
  if (pend) {
    li.className += " mm-a-corrigir";
    const s = document.createElement("span"); s.className = "mm-cur-selo mm-cur-selo-corrigir";
    s.textContent = t("mmq_selo_corrigir");
    s.title = t("mmq_ver_" + pend.v) + (pend.correcao ? " — " + pend.correcao : "") + (pend.fonte ? " (" + pend.fonte + ")" : "");
    cx.append(s);
  }
}
/* os botões da barra: ligar a curadoria, o placar dela e o registro (chamado por matMapaPintar) */
function mmCurBarra(arv, vista) {
  const bc = document.createElement("button"); bc.type = "button"; bc.className = "btn-min" + (mmCuradoria ? " on" : ""); bc.id = "btnMmCuradoria";
  bc.textContent = t(mmCuradoria ? "mmq_sair" : "mmq_ligar"); bc.title = t("mmq_ligar_tip");
  bc.setAttribute("aria-pressed", mmCuradoria ? "true" : "false");
  bc.onclick = () => mmCurAlternar();
  vista.append(bc);
  const c = mmCurContar(arv);
  if (mmCuradoria) {
    const pl = document.createElement("span"); pl.className = "nota mm-cur-placar"; pl.id = "mmCurPlacar";
    pl.textContent = t("mmq_placar", { ok: c.ok, e: c.errado, d: c.duvida, f: c.falta });
    vista.append(pl);
  }
  const n = mmQualItens(arv).length;
  if (n || mmCuradoria || mmQualAval()) {
    const br = document.createElement("button"); br.type = "button"; br.className = "btn-min"; br.id = "btnMmQualidade";
    br.textContent = t("mmq_registro_bt", { n }); br.title = t("mmq_registro_tip");
    br.onclick = () => mmQualAbrir();
    vista.append(br);
  }
}

/* ---------------- o registro de qualidade ---------------- */
/* os pontos a avaliar, na ordem do mapa: [{ no, caminho (rótulos com ›), tipos: ["errado"|"duvida"|"fora"|"num"], nota, trecho }] */
function mmQualItens(arv) {
  const cur = mmCurDoMapa();
  const txt = String((typeof $ === "function" && $("matTexto") || {}).value || "");
  const linhas = txt.split("\n");
  const out = [];
  const ir = (no, nomes) => {
    const aqui = no.raiz ? [] : nomes.concat([no.label]);
    if (!no.raiz) {
      const x = cur[no.caminho];
      const tipos = [];
      if (x && (x.v === "errado" || x.v === "duvida")) tipos.push(x.v);
      /* o aviso automático que você já conferiu como "✓ confere" sai do registro: a decisão foi sua */
      if (!(x && x.v === "ok")) { if (no.foraDoResumo) tipos.push("fora"); if (no.numFora) tipos.push("num"); }
      if (tipos.length) {
        /* o trecho como se lê: sem o marcador de lista, de título ou de dica */
        const cru = no.linha >= 0 && linhas[no.linha] != null ? String(linhas[no.linha]).replace(/^\s*(?:==\S?\s*)?(?:[-*+]|\d+[.)]|#{1,6}|\?>|>>|>~?)\s+/, "") : "";
        const lin = typeof mmLimpar === "function" ? mmLimpar(cru) : cru;
        out.push({ no, caminho: aqui.join(" › "), tipos, nota: x ? x.nota || "" : "", num: no.numFora || [], trecho: lin.length > 300 ? lin.slice(0, 299) + "…" : lin });
      }
    }
    no.filhos.forEach((f) => ir(f, aqui));
  };
  if (arv) ir(arv.raiz, []);
  return out;
}
/* o mapa como lista recuada (o contexto do pedido) */
function mmArvoreComoLista(arv) {
  const L = [];
  const ir = (no, d) => no.filhos.forEach((f) => { L.push("  ".repeat(d) + "- " + f.label + (f.det ? " — " + f.det : "")); ir(f, d + 1); });
  if (arv) ir(arv.raiz, 0);
  return L.join("\n");
}
function mmQualTipoTxt(it) {
  return it.tipos.map((tp) => t("mmq_tipo_" + tp, { n: it.num.join(", ") })).join("; ");
}
/* O PEDIDO DE AVALIAÇÃO */
function mmQualPedido(arv, ctx) {
  const c = ctx || {};
  const itens = mmQualItens(arv);
  const L = [];
  L.push(t(arv && arv.ia ? "mmq_p_intro_ia" : "mmq_p_intro", { t: c.topico || "", d: c.disciplina || "" }));
  L.push("");
  L.push(t("mmq_p_mapa"));
  L.push(mmArvoreComoLista(arv));
  L.push("");
  if (itens.length) {
    L.push(t("mmq_p_pontos", { n: itens.length }));
    itens.forEach((it, i) => {
      L.push("[" + (i + 1) + "] " + it.caminho + (it.no.det ? " — " + it.no.det : ""));
      L.push("    " + t("mmq_p_motivo") + " " + mmQualTipoTxt(it) + (it.nota ? " · " + t("mmq_p_nota") + " " + it.nota : ""));
      if (it.trecho) L.push("    " + t("mmq_p_trecho") + " \"" + it.trecho + "\"");
    });
    L.push("");
    L.push(t("mmq_p_formato_pontos"));
  } else {
    L.push(t("mmq_p_tudo"));
  }
  return L.join("\n");
}
/* a avaliação recebida, guardada por mapa: { texto, em } */
function mmQualAval(ch) { const v = mmCurLer()[(ch || mmChaveResumo()) + "#aval"]; return v && v.texto ? v : null; }
function mmQualGuardarAval(texto, ch) {
  const k = (ch || mmChaveResumo()) + "#aval";
  const m = mmCurLer();
  const s = String(texto || "").trim();
  /* (19.179.0) a mesma avaliação guardada de novo mantém o que você já resolveu dela; uma nova recomeça */
  const res = m[k] && m[k].texto === s && m[k].res ? m[k].res : {};
  if (s) m[k] = { texto: s, em: m[k] && m[k].texto === s ? m[k].em : new Date().toISOString(), res }; else delete m[k];
  mmCurGravar(m);
  try { matReg("ler", s ? "mapa: avaliação de qualidade guardada" : "mapa: avaliação de qualidade apagada", (ch || mmChaveResumo()) + " · " + s.length + " caracteres"); } catch (e) {}
  return m[k] || null;
}
/* apagar a curadoria e a avaliação de um mapa (o mapa da IA refeito ou apagado: os galhos são outros) */
function mmCurEsquecer(ch) {
  const m = mmCurLer();
  let mudou = false;
  [ch, ch + "#aval", ch + "#ped"].forEach((k) => { if (m[k]) { delete m[k]; mudou = true; } });
  if (mudou) mmCurGravar(m);
  return mudou;
}
function mmQualCtx() {
  return { topico: (matAtual && (matAtual.topico || matAtual.nome)) || "", disciplina: (matAtual && matAtual.disciplina) || "" };
}
function mmQualData(iso) { return typeof mmIaData === "function" ? mmIaData(iso) : String(iso || "").slice(0, 10); }
function mmQualAbrir() {
  const arv = mmUltimo && mmUltimo.arvore;
  if (!arv) return false;
  mmQualPintar(arv);
  const resp = $("mmQualResp");
  const av = mmQualAval();
  if (resp) resp.value = av ? av.texto : "";
  const msg = $("mmQualCopiadoMsg");
  if (msg) msg.textContent = "";
  if (typeof jurIaMontar === "function") {
    jurIaMontar("mmQualGemini", { id: "mmQualGm", pedido: () => mmQualPedidoAtual(), destino: "mmQualResp", rotulo: "avaliação do mapa", modulo: "MAPA" });
  }
  mmQualPintarAval(arv);
  try { matReg("ler", "mapa: registro de qualidade aberto", mmChaveResumo()); } catch (e) {}
  if (typeof abrirModal === "function") abrirModal("dlgMmQual");
  return true;
}
function mmQualPintar(arv) {
  const box = $("mmQualLista"), sub = $("mmQualSub"), info = $("mmQualAvalInfo");
  const itens = mmQualItens(arv);
  const c = mmCurContar(arv);
  if (sub) sub.textContent = t(arv.ia ? "mmq_sub_ia" : "mmq_sub", { n: itens.length, ok: c.ok, tot: c.total });
  if (box) {
    box.innerHTML = "";
    if (!itens.length) { const p = document.createElement("p"); p.className = "nota"; p.id = "mmQualVazio"; p.textContent = t("mmq_vazio"); box.append(p); }
    itens.forEach((it, i) => {
      const d = document.createElement("div"); d.className = "mmq-item"; d.id = "mmQual_" + i;
      const tt = document.createElement("div"); tt.className = "mmq-cam";
      const b = document.createElement("b"); b.textContent = "[" + (i + 1) + "] " + it.caminho; tt.append(b);
      it.tipos.forEach((tp) => { const s = document.createElement("span"); s.className = "mm-cur-selo mmq-tp-" + tp; s.textContent = t("mmq_tipo_" + tp, { n: it.num.join(", ") }); tt.append(s); });
      d.append(tt);
      if (it.no.det) { const p = document.createElement("div"); p.className = "nota"; p.textContent = it.no.det; d.append(p); }
      if (it.nota) { const p = document.createElement("div"); p.className = "mmq-nota"; p.textContent = t("mmq_p_nota") + " " + it.nota; d.append(p); }
      if (it.trecho) { const p = document.createElement("div"); p.className = "nota mmq-trecho"; p.textContent = t("mmq_p_trecho") + " “" + it.trecho + "”"; d.append(p); }
      if (it.no.linha >= 0) {
        const ir = document.createElement("button"); ir.type = "button"; ir.className = "btn-min"; ir.id = "btnMmQualIr_" + i; ir.textContent = t("mmq_ir");
        ir.onclick = () => { mmQualFechar(); if (typeof matMapaIr === "function") matMapaIr(it.no.linha); };
        d.append(ir);
      }
      box.append(d);
    });
  }
  const av = mmQualAval();
  if (info) info.textContent = av ? t("mmq_aval_guardada", { d: mmQualData(av.em) }) : t("mmq_aval_nenhuma");
  return itens;
}
function mmQualFechar() {
  const d = typeof document !== "undefined" ? document.getElementById("dlgMmQual") : null;
  if (d && d.open && d.close) d.close();
}
function mmQualCopiar() {
  const txt = mmQualPedidoAtual();
  const msg = $("mmQualCopiadoMsg");
  const ok = () => { if (msg) msg.textContent = t("mmq_copiado"); };
  try { matReg("ler", "mapa: pedido de avaliação copiado", mmChaveResumo() + " · " + mmQualItens(mmUltimo && mmUltimo.arvore).length + " ponto(s)"); } catch (e) {}
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(ok, ok);
  } catch (e) {}
  ok();
  return Promise.resolve();
}
function mmQualGuardarTela() {
  const g = mmQualGuardarAval(($("mmQualResp") || {}).value || "");
  const info = $("mmQualAvalInfo");
  if (info) info.textContent = g ? t("mmq_aval_guardada", { d: mmQualData(g.em) }) : t("mmq_aval_nenhuma");
  if (typeof matMapaPintar === "function") matMapaPintar();
  mmQualPintarAval(mmUltimo && mmUltimo.arvore);
  return g;
}

/* =====================================================================
 * (19.179.0) A AVALIAÇÃO VIRA CORREÇÃO
 *
 * A avaliação guardada era só texto. Agora o app a lê ponto a ponto ("[n] INCORRETO — a correção — a fonte", ou
 * "Termo — IMPRECISO — …" na seção dos outros problemas), liga cada ponto ao galho do mapa e oferece o próximo passo:
 *  · INCORRETO / IMPRECISO → "✏ corrigir no resumo": abre a edição JÁ na linha de onde o galho saiu, com a correção
 *    sugerida copiada; depois de corrigir, "✓ corrigido" dá o galho por conferido (com a correção na nota);
 *    "discordo" tira o ponto da lista sem mexer em nada — a avaliação também erra;
 *  · CORRETO → "✓ aceitar" (ou todos de uma vez): o galho fica conferido, com a fonte na nota;
 *  · enquanto não resolvido, o galho mostra "✏ a corrigir" no mapa.
 * O número [n] é o da lista enviada: o app guarda, a cada pedido copiado, quais galhos foram em cada número — marcar
 * outro galho depois de pedir não embaralha a resposta.
 * ===================================================================== */
/* o pedido, guardando a lista de galhos na ordem em que foram numerados */
function mmQualPedidoAtual() {
  const arv = mmUltimo && mmUltimo.arvore;
  const ch = mmChaveResumo();
  if (arv && ch) {
    const m = mmCurLer();
    m[ch + "#ped"] = { pontos: mmQualItens(arv).map((it) => it.no.caminho), em: new Date().toISOString() };
    mmCurGravar(m);
  }
  return mmQualPedido(arv, mmQualCtx());
}
/* LER A AVALIAÇÃO: [{ n | null, termo, v: "correto"|"incorreto"|"impreciso", correcao, fonte }] */
function mmQualLerAval(texto) {
  const out = [];
  String(texto || "").replace(/\r/g, "").split("\n").forEach((l0) => {
    const l = l0.replace(/\*\*|__/g, "").replace(/^\s*(?:[-*•]|\d+[.)])\s+(?=\[)/, "").trim();
    const m = l.match(/(?:^|[^A-Za-zÀ-ÿ])(parcialmente correto|partially correct|incorreto|impreciso|incorrect|imprecise|correto|correct)(?![A-Za-zÀ-ÿ])/i);
    if (!m) return;
    const ini = m.index + m[0].length - m[1].length;
    const antes = l.slice(0, ini);
    const w = m[1].toLowerCase();
    const v = /^in/.test(w) ? "incorreto" : /impreci|parcial|partial/.test(w) ? "impreciso" : "correto";
    const nm = antes.match(/^\s*\[\s*(\d{1,3})\s*\]|^\s*(\d{1,3})\s*[.)\]-]/);
    let termo = "";
    if (!nm) {
      /* sem número: "Termo — VEREDITO — …" (os outros problemas); a frase solta ("o mapa é correto") fica de fora */
      if (!/[—–:|]\s*$|\s-\s*$/.test(antes)) return;
      termo = antes.replace(/[\s—–:|-]+$/, "").replace(/^[-*•\s]+/, "").replace(/^["“]|["”]$/g, "").trim();
      if (!termo || termo.length > 100) return;
    }
    const depois = l.slice(ini + m[1].length).replace(/^[\s—–:|.,-]+/, "").trim();
    const partes = depois.split(/\s+[—–|]\s+|\s+-\s+/).map((x) => x.trim()).filter(Boolean);
    out.push({ n: nm ? Number(nm[1] || nm[2]) : null, termo, v, correcao: partes[0] || "", fonte: partes.slice(1).join(" — ") });
  });
  return out;
}
/* os pontos da avaliação ligados aos galhos do mapa à vista */
function mmQualAvalPontos(arv) {
  const av = mmQualAval();
  if (!av || !arv) return [];
  const ped = mmCurLer()[mmChaveResumo() + "#ped"];
  const pontos = ped && Array.isArray(ped.pontos) ? ped.pontos : mmQualItens(arv).map((it) => it.no.caminho);
  const porCam = {}, porNome = {};
  const nrm = (s) => (typeof mmIaNorm === "function" ? mmIaNorm(s) : String(s || "").toLowerCase().trim());
  const ir = (no) => { if (!no.raiz) { porCam[no.caminho] = no; const k = nrm(no.label); if (!porNome[k]) porNome[k] = no; } no.filhos.forEach(ir); };
  ir(arv.raiz);
  const res = av.res || {};
  return mmQualLerAval(av.texto).map((p, i) => {
    let no = null;
    if (p.n) no = porCam[pontos[p.n - 1]] || null;
    else {
      const partes = p.termo.split(/\s*›\s*|\s*>\s*/);
      no = porNome[nrm(partes[partes.length - 1])] || null;
    }
    const chave = no ? no.caminho : "#" + i;
    return Object.assign({}, p, { i, no, chave, res: res[chave] || null });
  });
}
/* o que ainda falta resolver, por galho (o selo "✏ a corrigir" no mapa) */
function mmQualPendentes(arv) {
  const out = {};
  mmQualAvalPontos(arv).forEach((p) => { if (p.no && p.v !== "correto" && !p.res) out[p.no.caminho] = p; });
  return out;
}
let mmQualPendCache = null;     /* { k, mapa } — refeito a cada pintura do mapa */
function mmQualPendenteDe(no) {
  const arv = mmUltimo && mmUltimo.arvore;
  if (!arv) return null;
  const av = mmQualAval();
  if (!av) return null;
  const k = mmChaveResumo() + "|" + av.em + "|" + JSON.stringify(av.res || {}).length + "|" + arv.nos;
  if (!mmQualPendCache || mmQualPendCache.k !== k || mmQualPendCache.arv !== arv) mmQualPendCache = { k, arv, mapa: mmQualPendentes(arv) };
  return mmQualPendCache.mapa[no.caminho] || null;
}
/* RESOLVER UM PONTO: "corrigido" e "aceito" dão o galho por conferido (com a correção ou a fonte na nota); "discordo" só sai */
function mmQualResolver(p, feito) {
  const ch = mmChaveResumo();
  const m = mmCurLer();
  const av = m[ch + "#aval"];
  if (!av) return null;
  av.res = av.res || {};
  if (feito) av.res[p.chave] = { feito, em: mmCurHoje() }; else delete av.res[p.chave];
  mmCurGravar(m);
  mmQualPendCache = null;
  try { matReg("ler", "mapa: ponto da avaliação " + (feito || "reaberto"), (p.no ? p.no.label : p.termo || "[" + p.n + "]") + " · " + p.v + " · " + ch); } catch (e) {}
  if (p.no && (feito === "corrigido" || feito === "aceito")) {
    const nota = feito === "corrigido" ? t("mmq_nota_corrigido", { c: p.correcao || "—", f: p.fonte || "—" }) : t("mmq_nota_aceito", { f: p.fonte || p.correcao || "—" });
    mmCurMarcar(p.no, "ok", nota);
  } else if (typeof matMapaPintar === "function") matMapaPintar();
  mmQualPintarAval(mmUltimo && mmUltimo.arvore);
  return av.res[p.chave] || null;
}
function mmQualAceitarCorretos(arv) {
  const lst = mmQualAvalPontos(arv).filter((p) => p.v === "correto" && p.no && !p.res);
  lst.forEach((p) => mmQualResolver(p, "aceito"));
  return lst.length;
}
/* a edição do resumo JÁ na linha, selecionada; a correção sugerida vai copiada para colar */
function mmEditorNaLinha(n) {
  if (typeof matTrocarModo === "function") { try { if (typeof matModo === "undefined" || matModo !== "editar") matTrocarModo("editar"); } catch (e) {} }
  const ta = $("matTexto");
  if (!ta || n < 0) return false;
  const ls = String(ta.value || "").split("\n");
  if (n >= ls.length) return false;
  let a = 0;
  for (let i = 0; i < n; i++) a += ls[i].length + 1;
  try { ta.focus(); } catch (e) {}
  try { ta.setSelectionRange(a, a + ls[n].length); } catch (e) {}
  mmTaRolarAte(ta, a);
  return true;
}
/* rolar a caixa até uma posição: as linhas longas quebram, então "linha × altura" erra — mede-se o texto até ali numa
 * cópia invisível da caixa, com a mesma largura e a mesma fonte */
function mmTaRolarAte(ta, pos) {
  try {
    if (typeof getComputedStyle !== "function" || !document.body) return false;
    const cs = getComputedStyle(ta);
    const d = document.createElement("div");
    ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingLeft", "paddingRight", "tabSize"].forEach((k) => { d.style[k] = cs[k]; });
    d.style.boxSizing = "border-box"; d.style.width = ta.clientWidth + "px";
    d.style.position = "absolute"; d.style.visibility = "hidden"; d.style.left = "-9999px"; d.style.top = "0";
    d.style.whiteSpace = "pre-wrap"; d.style.overflowWrap = "break-word";
    d.textContent = String(ta.value || "").slice(0, pos) + "​";
    document.body.appendChild(d);
    const h = d.scrollHeight;
    d.remove();
    ta.scrollTop = Math.max(0, h - ta.clientHeight / 3);
    return true;
  } catch (e) { return false; }
}
function mmQualCorrigir(p) {
  if (!p.no || p.no.linha < 0) return false;
  mmQualFechar();
  const sug = [p.correcao, p.fonte].filter(Boolean).join(" — ");
  try { if (sug && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sug).catch(() => {}); } catch (e) {}
  const ok = mmEditorNaLinha(p.no.linha);
  try { if (typeof toastMsg === "function") toastMsg(t(sug ? "mmq_corrigir_toast" : "mmq_corrigir_toast_sem", { c: sug }), 9000); } catch (e) {}
  try { matReg("ler", "mapa: corrigir no resumo", p.no.label + " · linha " + (p.no.linha + 1) + " · " + mmChaveResumo()); } catch (e) {}
  return ok;
}
/* a lista dos pontos da avaliação, no registro */
function mmQualPintarAval(arv) {
  const box = $("mmQualAvalLista");
  if (!box) return [];
  box.innerHTML = "";
  const pts = arv ? mmQualAvalPontos(arv) : [];
  box.hidden = !pts.length;
  if (!pts.length) {
    const av = mmQualAval();
    if (av) { box.hidden = false; const p = document.createElement("p"); p.className = "nota"; p.id = "mmQualAvalNada"; p.textContent = t("mmq_aval_nada"); box.append(p); }
    return pts;
  }
  const cont = { correto: 0, incorreto: 0, impreciso: 0, feitos: 0 };
  pts.forEach((p) => { cont[p.v]++; if (p.res) cont.feitos++; });
  const hd = document.createElement("div"); hd.className = "mmq-aval-tit"; hd.id = "mmQualAvalTit";
  const h = document.createElement("strong");
  h.textContent = t("mmq_aval_tit", { i: cont.incorreto, p: cont.impreciso, c: cont.correto, r: cont.feitos, n: pts.length });
  hd.append(h);
  const corretosAbertos = pts.filter((p) => p.v === "correto" && p.no && !p.res).length;
  if (corretosAbertos) {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn-min btn-min-ok"; b.id = "btnMmQualAceitarTodos";
    b.textContent = t("mmq_aceitar_todos", { n: corretosAbertos });
    b.onclick = () => mmQualAceitarCorretos(mmUltimo && mmUltimo.arvore);
    hd.append(b);
  }
  box.append(hd);
  pts.forEach((p) => {
    const d = document.createElement("div"); d.className = "mmq-item mmq-v-" + p.v + (p.res ? " mmq-resolvido" : ""); d.id = "mmQualPt_" + p.i;
    const tt = document.createElement("div"); tt.className = "mmq-cam";
    const s = document.createElement("span"); s.className = "mm-cur-selo mmq-ver-" + p.v; s.textContent = t("mmq_ver_" + p.v); tt.append(s);
    const b = document.createElement("b"); b.textContent = (p.n ? "[" + p.n + "] " : "") + (p.no ? p.no.label : p.termo); tt.append(b);
    if (p.res) { const r = document.createElement("span"); r.className = "nota mmq-res"; r.textContent = t("mmq_res_" + p.res.feito, { d: String(p.res.em || "").split("-").reverse().join("/") }); tt.append(r); }
    d.append(tt);
    if (p.correcao) { const c = document.createElement("div"); c.className = "mmq-nota"; c.textContent = t(p.v === "correto" ? "mmq_comentario" : "mmq_correcao") + " " + p.correcao; d.append(c); }
    if (p.fonte) { const f = document.createElement("div"); f.className = "nota"; f.textContent = t("mmq_fonte") + " " + p.fonte; d.append(f); }
    if (!p.no) { const f = document.createElement("div"); f.className = "nota mmq-tp-fora"; f.textContent = t("mmq_sem_galho"); d.append(f); }
    const ac = document.createElement("div"); ac.className = "mmq-acoes";
    const bt = (id, txt, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = "btn-min" + (cls ? " " + cls : ""); x.id = id + p.i; x.textContent = t(txt); x.onclick = fn; ac.append(x); };
    if (p.res) bt("btnMmQualReabrir_", "mmq_reabrir", "", () => mmQualResolver(p, ""));
    else if (p.v === "correto") { if (p.no) bt("btnMmQualAceitar_", "mmq_aceitar", "btn-min-ok", () => mmQualResolver(p, "aceito")); }
    else {
      if (p.no && p.no.linha >= 0) bt("btnMmQualCorrigir_", "mmq_corrigir", "btn-min-ok", () => mmQualCorrigir(p));
      if (p.no) bt("btnMmQualCorrigido_", "mmq_corrigido", "", () => mmQualResolver(p, "corrigido"));
      bt("btnMmQualDiscordo_", "mmq_discordo", "", () => mmQualResolver(p, "discordo"));
    }
    if (ac.children.length) d.append(ac);
    box.append(d);
  });
  return pts;
}
(function mmQualLigar() {
  try {
    if (typeof document === "undefined") return;
    const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
    on("btnMmQualCopiar", () => mmQualCopiar());
    on("btnMmQualGuardar", () => mmQualGuardarTela());
    on("btnMmQualFechar", () => mmQualFechar());
  } catch (e) {}
})();
