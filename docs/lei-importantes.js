/* =====================================================================
 * (19.189.0) ★ OS ARTIGOS IMPORTANTES DA LEI, PARA O EDITAL
 *
 * O pedido: "a IA me diz que os artigos de 1 a 15 são importantes para a minha prova naquele edital, e eu tenho um
 * atalho com a lista; posso marcar mais; a fuga rápida também usa".
 *
 *  · A LISTA É POR LEI E POR EDITAL: o que importa da Lei 9.784 para o TJ não é o que importa para a Receita. Sem
 *    edital (a lei aberta solta, sem edital em andamento), a lista é a "geral" da lei;
 *  · A IA SUGERE, VOCÊ CONFERE: o pedido leva o edital, os tópicos dele que tratam desta lei e o índice dos artigos
 *    (número e começo do texto); a resposta ("Arts. 1 a 15 — princípios…") vira uma lista com caixas de marcar, cada
 *    artigo com o motivo, e só os marcados entram. Copiar o pedido ou mandar direto ao Gemini (o mesmo botão do resto);
 *  · VOCÊ ACRESCENTA E TIRA: o ☆ no cabeçalho de cada artigo; o que veio da IA e o que você marcou têm cor diferente;
 *  · OS ATALHOS: "★ importantes (N)" ao lado de "só os que caem" lê só eles; a fuga rápida põe os importantes na frente.
 * ===================================================================== */
const LI_CH = "eac_lei_importantes";

/* lido a cada artigo desenhado: guardado enquanto o texto guardado não muda */
let liMemo = { raw: null, val: {} };
function liLer() {
  let raw = "{}";
  try { raw = localStorage.getItem(LI_CH) || "{}"; } catch (e) { raw = "{}"; }
  if (raw === liMemo.raw) return liMemo.val;
  let v = {};
  try { v = JSON.parse(raw); } catch (e) { v = {}; }
  liMemo = { raw, val: v && typeof v === "object" ? v : {} };
  return liMemo.val;
}
function liGravar(m) {
  try { localStorage.setItem(LI_CH, JSON.stringify(m)); return true; } catch (e) { return false; }
}
function liChave(leiId, edId) { return String(leiId || "") + "|" + String(edId || ""); }
/* o edital da lei aberta: o do tópico (quando a lei abriu por ele); senão o edital aberto; senão nenhum ("geral") */
function liEditalAtual() {
  try {
    if (typeof leiAtual !== "undefined" && leiAtual && leiAtual.chave && typeof lvEditalDoTopico === "function") {
      const e = lvEditalDoTopico(leiAtual.disciplina, leiAtual.topico);
      if (e) return String(e);
    }
  } catch (e) {}
  try { if (typeof editalAtual !== "undefined" && editalAtual) return String(editalAtual); } catch (e) {}
  return "";
}
function liEditalNome(edId) {
  try { const e = (typeof editais !== "undefined" ? editais : []).find((x) => String(x.id) === String(edId)); return e ? String(e.nome || "") : ""; } catch (e) { return ""; }
}
/* { num: { de: "ia" | "voce", motivo, em } } */
function liDaLei(leiId, edId) {
  const m = liLer()[liChave(leiId, edId)];
  return (m && m.arts) || {};
}
function liEh(leiId, edId, num) { return liDaLei(leiId, edId)[String(num)] || null; }
/* os números marcados, na ordem da lei */
function liLista(leiId, edId) {
  const arts = liDaLei(leiId, edId);
  const nums = Object.keys(arts);
  if (!nums.length) return [];
  let ordem = [];
  try { const l = leiDe(leiId); ordem = l ? leiArtigosEfetivos(l).map((a) => a.num) : []; } catch (e) { ordem = []; }
  return nums.sort((a, b) => {
    const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}
function liMarcar(leiId, edId, num, sim, de, motivo) {
  const m = JSON.parse(JSON.stringify(liLer()));
  const k = liChave(leiId, edId);
  const o = m[k] || { arts: {} };
  o.arts = o.arts || {};
  const n = String(num);
  if (sim) o.arts[n] = Object.assign({}, o.arts[n] || {}, { de: de || "voce", em: new Date().toISOString() }, motivo ? { motivo: String(motivo).slice(0, 240) } : {});
  else delete o.arts[n];
  m[k] = o;
  liGravar(m);
  try { reg("LEI", sim ? "artigo marcado como importante" : "artigo tirado dos importantes", ((leiDe(leiId) || {}).nome || leiId) + " · art. " + n + " · " + (de || "voce") + (edId ? " · " + liEditalNome(edId) : "")); } catch (e) {}
  return true;
}
/* do leitor: alterna o ★ do artigo na lista da lei aberta (para o edital dela) */
function liAlternar(num) {
  if (typeof leiIdAtual === "undefined" || !leiIdAtual) return false;
  const ed = liEditalAtual();
  const ja = liEh(leiIdAtual, ed, num);
  liMarcar(leiIdAtual, ed, num, !ja, "voce");
  try { if (typeof leiPintar === "function") leiPintar(); } catch (e) {}
  return !ja;
}

/* ---------------- O PEDIDO À IA ---------------- */
/* os tópicos do edital que tratam desta lei (ligados a ela ou que a citam pelo número) */
function liTopicosDaLei(leiId, edId) {
  const e = (typeof editais !== "undefined" ? editais : []).find((x) => String(x.id) === String(edId));
  if (!e || typeof lvTopicosDoEdital !== "function") return [];
  return lvTopicosDoEdital(e).filter((tp) => {
    try {
      if (leisDoTopico(matChave(tp.disciplina, tp.nome)).some((l) => l.id === leiId)) return true;
      return typeof lvCandidatas === "function" && lvCandidatas([tp.nome, tp.motivo || ""].concat((tp.ramos || []).map((r) => (r && (r.nome || r.texto)) || "")).join(" ; ")).some((o) => o.lei.id === leiId);
    } catch (x) { return false; }
  }).map((tp) => tp.disciplina + " › " + tp.nome + ((tp.ramos || []).length ? " (" + tp.ramos.map((r) => (r && (r.nome || r.texto)) || "").filter(Boolean).slice(0, 6).join("; ") + ")" : ""));
}
function liPedido(leiId, edId) {
  const l = leiDe(leiId);
  if (!l) return "";
  let arts = [];
  try { arts = leiArtigosEfetivos(l).filter((a) => !a.revogado); } catch (e) { arts = []; }
  const indice = arts.map((a) => a.rotulo + " — " + String(a.corpo || a.texto || "").replace(/\s+/g, " ").replace(/^Art\.?\s*\S+\s*/i, "").slice(0, 90)).join("\n");
  const tps = edId ? liTopicosDaLei(leiId, edId) : [];
  return t("li_pedido", {
    lei: l.nome,
    ed: edId ? liEditalNome(edId) : t("li_sem_edital"),
    tps: tps.length ? tps.map((x) => "- " + x).join("\n") : t("li_sem_topicos"),
    n: arts.length,
    indice,
  });
}
/* A RESPOSTA: uma linha por item — "Art. 5º — motivo", "Arts. 1 a 15 — motivo", "Arts. 37, 39 e 41: motivo".
 * Os intervalos se abrem na ordem da lei (o "1 a 15" pega o 1-A, se existir). Devolve [{ num, rotulo, motivo }] */
function liLerResposta(txt, leiId) {
  const l = leiDe(leiId);
  if (!l) return [];
  let efetivos = [];
  try { efetivos = leiArtigosEfetivos(l); } catch (e) { efetivos = []; }
  const nums = efetivos.map((a) => a.num);
  const rotDe = (n) => { const a = efetivos.find((x) => x.num === n); return a ? a.rotulo : "Art. " + n; };
  const out = [], vistos = {};
  const por = (n, motivo) => {
    if (!n || vistos[n] || nums.indexOf(n) < 0) return;
    vistos[n] = true;
    out.push({ num: n, rotulo: rotDe(n), motivo });
  };
  String(txt || "").split(/\r?\n/).forEach((linha0) => {
    const linha = linha0.replace(/^\s*(?:[-*•]|\d+[.)])\s+(?=art)/i, "").trim();
    if (!/\bart/i.test(linha)) return;
    const sep = linha.search(/\s[—–-]\s|:\s/);
    /* o cabeçalho é só a parte dos artigos: "Art. 5º da Lei 9.784" não pode dar os artigos 9 e 784 */
    const cab = (sep >= 0 ? linha.slice(0, sep) : linha).replace(/\s(?:da|do|de)\s+(?:lei|lc|constitui|cf\b|decreto|c[óo]digo|emenda).*$/i, "");
    const motivo = sep >= 0 ? linha.slice(sep).replace(/^\s*[—–:-]\s*/, "").trim() : "";
    /* intervalos: "1 a 15", "1º ao 15", "1-15", "1 até 15" */
    const reInt = /(\d{1,4}(?:\s*[ºo°])?(?:-[A-Z])?)\s*(?:a|ao|até|-|–)\s*(\d{1,4}(?:\s*[ºo°])?(?:-[A-Z])?)(?![\d])/gi;
    let m, temInt = false;
    while ((m = reInt.exec(cab)) !== null) {
      const a = leiNumNormal(m[1]), b = leiNumNormal(m[2]);
      const ia = nums.indexOf(a), ib = nums.indexOf(b);
      if (ia < 0 || ib < 0 || ib < ia || ib - ia > 400) continue;
      temInt = true;
      for (let k = ia; k <= ib; k++) por(nums[k], motivo);
    }
    /* os números soltos da linha ("Arts. 37, 39 e 41") */
    const resto = temInt ? cab.replace(reInt, " ") : cab;
    (resto.match(/\d{1,4}(?:\s*[ºo°])?(?:-[A-Z])?/g) || []).forEach((x) => por(leiNumNormal(x), motivo));
  });
  return out;
}
/* guarda os escolhidos da resposta da IA (os que você deixou marcados) */
function liAplicarIA(leiId, edId, itens) {
  const m = JSON.parse(JSON.stringify(liLer()));
  const k = liChave(leiId, edId);
  const o = m[k] || { arts: {} };
  o.arts = o.arts || {};
  const agora = new Date().toISOString();
  (itens || []).forEach((x) => {
    const ja = o.arts[x.num];
    /* o que você marcou à mão continua seu (a IA só acrescenta o motivo, se não havia) */
    o.arts[x.num] = ja && ja.de === "voce" ? Object.assign({}, ja, ja.motivo ? {} : { motivo: x.motivo }) : { de: "ia", motivo: String(x.motivo || "").slice(0, 240), em: agora };
  });
  o.iaEm = agora;
  m[k] = o;
  liGravar(m);
  try { reg("LEI", "artigos importantes da IA guardados", ((leiDe(leiId) || {}).nome || leiId) + " · " + (itens || []).length + " artigo(s)" + (edId ? " · " + liEditalNome(edId) : "")); } catch (e) {}
  return (itens || []).length;
}
/* todos os importantes de todas as leis (para a fuga): [{ leiId, edId, num, de, motivo }] */
function liTodos() {
  const m = liLer(), out = [];
  Object.keys(m).forEach((k) => {
    const [leiId, edId] = k.split("|");
    Object.keys((m[k] && m[k].arts) || {}).forEach((num) => out.push(Object.assign({ leiId, edId: edId || "", num }, m[k].arts[num])));
  });
  return out;
}

/* ---------------- A JANELA ---------------- */
let liCtx = null;           /* { leiId, edId, sugestoes: [{ num, rotulo, motivo, sim }] } */
function liEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function liAbrir(leiId, edId) {
  const id = leiId || (typeof leiIdAtual !== "undefined" ? leiIdAtual : "");
  if (!id || !leiDe(id)) return false;
  liCtx = { leiId: id, edId: edId != null ? String(edId) : liEditalAtual(), sugestoes: null };
  if ($("liResp")) $("liResp").value = "";
  if (typeof jurIaMontar === "function") {
    try { jurIaMontar("liGemini", { id: "liGm", pedido: () => liPedido(liCtx.leiId, liCtx.edId), destino: "liResp", rotulo: "artigos importantes", modulo: "LEI" }); } catch (e) {}
  }
  liPintar();
  try { reg("LEI", "artigos importantes abertos", (leiDe(id) || {}).nome + (liCtx.edId ? " · " + liEditalNome(liCtx.edId) : "")); } catch (e) {}
  if (typeof abrirModal === "function") abrirModal("dlgLeiImp");
  return true;
}
function liPintar() {
  if (!liCtx) return;
  const l = leiDe(liCtx.leiId);
  if ($("liTitulo")) $("liTitulo").textContent = t("li_titulo", { l: l ? l.nome : "" });
  if ($("liSub")) $("liSub").textContent = liCtx.edId ? t("li_sub_ed", { e: liEditalNome(liCtx.edId) }) : t("li_sub_geral");
  /* a lista atual */
  const cx = $("liLista");
  if (cx) {
    cx.innerHTML = "";
    const nums = liLista(liCtx.leiId, liCtx.edId);
    const arts = liDaLei(liCtx.leiId, liCtx.edId);
    let efs = [];
    try { efs = l ? leiArtigosEfetivos(l) : []; } catch (e) { efs = []; }
    if (!nums.length) cx.append(liEl("p", "nota", t("li_vazia")));
    nums.forEach((n) => {
      const x = arts[n];
      const lin = liEl("div", "li-lin li-" + (x.de === "ia" ? "ia" : "voce"));
      lin.id = "liLin_" + n;
      const b = liEl("button", "btn-min li-ir", (efs.find((a) => a.num === n) || { rotulo: "Art. " + n }).rotulo);
      b.type = "button";
      b.title = t("li_ir_tip");
      b.onclick = () => { $("dlgLeiImp").close(); if (typeof leiIrArtigo === "function" && leiIdAtual === liCtx.leiId) leiIrArtigo(n); };
      lin.append(b);
      lin.append(liEl("span", "li-de", t(x.de === "ia" ? "li_de_ia" : "li_de_voce")));
      if (x.motivo) lin.append(liEl("span", "li-motivo", x.motivo));
      const tira = liEl("button", "btn-min li-tirar", "✕");
      tira.type = "button";
      tira.id = "btnLiTirar_" + n;
      tira.title = t("li_tirar_tip");
      tira.onclick = () => { liMarcar(liCtx.leiId, liCtx.edId, n, false); liPintar(); try { if (typeof leiPintar === "function" && leiIdAtual === liCtx.leiId) leiPintar(); } catch (e) {} };
      lin.append(tira);
      cx.append(lin);
    });
  }
  /* a conferência da resposta da IA */
  const sg = $("liSug");
  if (sg) {
    sg.innerHTML = "";
    const S = liCtx.sugestoes;
    sg.hidden = !S;
    if (S) {
      sg.append(liEl("div", "li-sec", S.length ? t("li_sug_tit", { n: S.length }) : t("li_sug_nada")));
      S.forEach((x, i) => {
        const lab = liEl("label", "li-sug-lin");
        const cb = liEl("input");
        cb.type = "checkbox";
        cb.id = "liSug_" + i;
        cb.checked = x.sim !== false;
        cb.onchange = () => { x.sim = !!cb.checked; };
        lab.append(cb, liEl("b", "", x.rotulo), liEl("span", "li-motivo", x.motivo ? " — " + x.motivo : ""));
        sg.append(lab);
      });
      if (S.length) {
        const ok = liEl("button", "btn-min btn-min-ok", t("li_guardar"));
        ok.type = "button";
        ok.id = "btnLiGuardar";
        ok.onclick = () => liGuardarSugestoes();
        sg.append(ok);
      }
    }
  }
}
function liCopiarPedido() {
  if (!liCtx) return "";
  const txt = liPedido(liCtx.leiId, liCtx.edId);
  try { navigator.clipboard.writeText(txt); } catch (e) {}
  try { if (typeof toastMsg === "function") toastMsg(t("li_copiado"), 3500); } catch (e) {}
  try { reg("LEI", "pedido de artigos importantes copiado", txt.length + " caracteres"); } catch (e) {}
  return txt;
}
function liConferir() {
  if (!liCtx) return [];
  const resp = $("liResp") ? String($("liResp").value || "") : "";
  liCtx.sugestoes = liLerResposta(resp, liCtx.leiId).map((x) => Object.assign(x, { sim: true }));
  liPintar();
  return liCtx.sugestoes;
}
function liGuardarSugestoes() {
  if (!liCtx || !liCtx.sugestoes) return 0;
  const n = liAplicarIA(liCtx.leiId, liCtx.edId, liCtx.sugestoes.filter((x) => x.sim !== false));
  liCtx.sugestoes = null;
  if ($("liResp")) $("liResp").value = "";
  liPintar();
  try { if (typeof leiPintar === "function" && leiIdAtual === liCtx.leiId) leiPintar(); } catch (e) {}
  return n;
}
(function liLigar() {
  try {
    if (typeof document === "undefined") return;
    const liga = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    liga("btnLiCopiar", () => liCopiarPedido());
    liga("btnLiConferir", () => liConferir());
    liga("btnLiFechar", () => { const d = document.getElementById("dlgLeiImp"); if (d && d.open) d.close(); });
  } catch (e) {}
})();
