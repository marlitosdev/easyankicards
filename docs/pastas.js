/* =====================================================================
 * PASTAS DE LEIS E JULGADOS (v19.12.0)
 *
 * O PEDIDO: "pastas por edital ou com nome livre (área fiscal, área de controle, município de Recife, Estado de
 * Pernambuco) para reorganizar leis e julgados. As pastas guardam só atalhos; a mesma lei pode estar em várias."
 *
 * DOIS TIPOS, uma fileira só nas duas bibliotecas (leis e julgados):
 *  · PASTA DE EDITAL (📋): automática, uma por edital cadastrado — as leis e os julgados ligados a tópicos daquele
 *    edital. Não se mantém à mão: ligar a lei a um tópico já a põe ali. Não se renomeia nem apaga.
 *  · PASTA LIVRE (📁): o nome que a pessoa quiser; guarda ATALHOS ({t: "lei"|"jur", id}). Pôr numa pasta não tira de
 *    outra, não liga a tópico nenhum, e apagar a pasta não apaga lei nem julgado.
 * Mora em "eac_pastas" (pequeno: nomes e ids) e vai no backup.
 *
 * (19.97.0) A PASTA DO EDITAL FICOU COMPLETA. Ela só via as leis ligadas a tópicos do edital — e, no backup de 07/11, o
 * 📋 ISS não tinha a Lei 9.784, a 4.717 nem a 4.320, todas usadas em vínculos de tópicos do ISS; a 4.320 só aparecia no
 * 📋 TCE-PE, edital de prova já passada. Agora a pasta do edital tem três fontes:
 *  · as leis e julgados LIGADOS a tópicos do edital (como antes);
 *  · os USADOS em vínculos de tópicos do edital (o "art. 105" ligado à Lei 4.320 no PCASP);
 *  · os que a pessoa PÔS À MÃO (a lei que vale para o concurso inteiro, não para um tópico) — em "eac_pastas_ed".
 * E a pasta é do EDITAL (id), não do nome do concurso: renomear o cabeçalho não muda mais a pasta. O id antigo
 * ("ed:<nome do concurso>") continua sendo entendido. Os editais de prova já passada vão para o fim, recolhidos.
 * ===================================================================== */
const PAS_CHAVE = "eac_pastas";

/* ---------------- o modelo ---------------- */
function pasLer() {
  try { const v = JSON.parse(localStorage.getItem(PAS_CHAVE) || "[]"); return Array.isArray(v) ? v.filter((p) => p && p.id && p.nome) : []; } catch (e) { return []; }
}
function pasGravar(lista) { try { localStorage.setItem(PAS_CHAVE, JSON.stringify(lista || [])); return true; } catch (e) { return false; } }
function pasNomeNormal(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function pasLimparNome(s) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, 60); }
/* cria (ou devolve a que já tem esse nome: "Área fiscal" e "area fiscal" são a mesma pasta) */
function pasCriar(nome) {
  const n = pasLimparNome(nome);
  if (!n) return null;
  const lista = pasLer();
  const ja = lista.find((p) => pasNomeNormal(p.nome) === pasNomeNormal(n));
  if (ja) return ja;
  const p = { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome: n, itens: [], criado: new Date().toISOString() };
  lista.push(p);
  return pasGravar(lista) ? p : null;
}
function pasRenomear(id, nome) {
  const n = pasLimparNome(nome);
  const lista = pasLer();
  const p = lista.find((x) => x.id === id);
  if (!p || !n) return { ok: false, motivo: "vazio" };
  if (lista.some((x) => x.id !== id && pasNomeNormal(x.nome) === pasNomeNormal(n))) return { ok: false, motivo: "repetido" };
  p.nome = n;
  return { ok: pasGravar(lista) };
}
function pasApagar(id) {
  const lista = pasLer();
  const nova = lista.filter((x) => x.id !== id);
  return nova.length !== lista.length && pasGravar(nova);
}
function pasTem(p, t, id) { return !!(p && (p.itens || []).some((x) => x.t === t && x.id === id)); }
/* põe ou tira o atalho; devolve se ficou dentro */
function pasAlternar(pastaId, t, id, sim) {
  /* (19.97.0) a pasta de um edital também aceita o que se põe à mão */
  if (String(pastaId || "").indexOf("ed:") === 0) return pasEdAlternar(pastaId, t, id, sim);
  const lista = pasLer();
  const p = lista.find((x) => x.id === pastaId);
  if (!p || !id) return false;
  const tem = pasTem(p, t, id);
  const quer = sim === undefined ? !tem : !!sim;
  if (quer && !tem) p.itens = (p.itens || []).concat([{ t, id }]);
  if (!quer && tem) p.itens = p.itens.filter((x) => !(x.t === t && x.id === id));
  pasGravar(lista);
  return quer;
}
function pasDoItem(t, id) { return pasLer().filter((p) => pasTem(p, t, id)); }

/* ---------------- (19.97.0) a pasta do edital ---------------- */
const PAS_ED_CHAVE = "eac_pastas_ed";          /* {editalId: [{t, id}]} — o que foi posto à mão na pasta de um edital */
function pasEdManualLer() {
  try { const v = JSON.parse(localStorage.getItem(PAS_ED_CHAVE) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function pasEdManualGravar(o) { try { localStorage.setItem(PAS_ED_CHAVE, JSON.stringify(o || {})); return true; } catch (e) { return false; } }
function pasNormChave(c) { return typeof matChaveNormal === "function" ? matChaveNormal(c) : String(c || "").toLowerCase().trim(); }
/* os editais, os tópicos de cada um e onde cada lei/julgado é usado em vínculos — memorizado por uma assinatura barata */
let pasEdCache = null;
function pasEdIndice() {
  const eds = typeof editais !== "undefined" && Array.isArray(editais) ? editais : [];
  let vs = [];
  try { vs = typeof citVinculosLer === "function" ? citVinculosLer() : []; } catch (e) { vs = []; }
  const sig = eds.map((e) => e.id + ":" + String(e.texto || "").length + ":" + (e.nome || "")).join("|") + "#"
    + vs.map((v) => (v.k || "") + (v.leiId || "") + (v.jurId || "") + (v.nenhum ? "0" : "")).join("|");
  if (pasEdCache && pasEdCache.sig === sig) return pasEdCache;
  const lista = [];
  eds.forEach((e) => {
    let r = null;
    try { r = typeof lerEdital === "function" ? lerEdital(e.texto || "") : null; } catch (x) { r = null; }
    const cfg = (r && r.cfg) || {};
    const chaves = new Set();
    ((r && r.disciplinas) || []).forEach((d) => (d.topicos || []).forEach((tp) => chaves.add(pasNormChave(typeof matChave === "function" ? matChave(d.nome, tp.nome) : d.nome + "›" + tp.nome))));
    let enc = false;
    try { enc = typeof edSituacao === "function" && edSituacao(e).grupo === "encerrado"; } catch (x) { enc = false; }
    lista.push({ id: String(e.id), nome: e.nome || cfg.concurso || "?", concurso: String(cfg.concurso || "").trim(), chaves, encerrado: enc });
  });
  const usos = new Map();
  vs.forEach((v) => {
    if (!v || v.nenhum || !v.chave) return;
    const k = v.tipo === "jur" ? (v.jurId ? "jur:" + v.jurId : "") : (v.leiId ? "lei:" + v.leiId : "");
    if (!k) return;
    const u = usos.get(k) || new Set();
    u.add(pasNormChave(v.chave));
    usos.set(k, u);
  });
  pasEdCache = { sig, lista, usos };
  return pasEdCache;
}
/* o edital de uma pasta "ed:…": pelo id; o id antigo ("ed:<nome do concurso>") também serve */
function pasEdAchar(pastaId, ix) {
  const r = String(pastaId || "").slice(3);
  const l = (ix || pasEdIndice()).lista;
  return l.find((e) => e.id === r) || l.find((e) => e.concurso === r || e.nome === r) || null;
}
/* POR QUE o item está na pasta do edital: "topico" (ligado a tópico), "vinculo" (usado em vínculo), "mao" ou "" */
function pasEdMotivo(ed, item, ix) {
  if (!ed || !item) return "";
  if ((item.topicos || []).some((c) => ed.chaves.has(pasNormChave(c)))) return "topico";
  const u = (ix || pasEdIndice()).usos.get(item.t + ":" + item.id);
  if (u && [...u].some((c) => ed.chaves.has(c))) return "vinculo";
  if ((pasEdManualLer()[ed.id] || []).some((x) => x.t === item.t && x.id === item.id)) return "mao";
  return "";
}
function pasEdAlternar(pastaId, t, id, sim) {
  const ed = pasEdAchar(pastaId);
  if (!ed || !id) return false;
  const o = pasEdManualLer();
  const l = Array.isArray(o[ed.id]) ? o[ed.id] : [];
  const tem = l.some((x) => x.t === t && x.id === id);
  const quer = sim === undefined ? !tem : !!sim;
  if (quer && !tem) o[ed.id] = l.concat([{ t, id }]);
  if (!quer && tem) o[ed.id] = l.filter((x) => !(x.t === t && x.id === id));
  if (o[ed.id] && !o[ed.id].length) delete o[ed.id];
  pasEdManualGravar(o);
  return quer;
}
/* as pastas de edital em que o item está (com o porquê) */
function pasEditaisDoItem(item) {
  const ix = pasEdIndice();
  return ix.lista.map((ed) => ({ ed, motivo: pasEdMotivo(ed, item, ix) })).filter((x) => x.motivo);
}

/* os editais (concursos) de uma lista de tópicos (as chaves "disciplina›tópico"), pelo índice do material */
function pasEditaisDe(chaves, idx) {
  const out = [];
  if (!idx || typeof idx.get !== "function") return out;
  (chaves || []).forEach((c) => {
    const k = typeof matChaveNormal === "function" ? matChaveNormal(c) : String(c || "").toLowerCase();
    (idx.get(k) || []).forEach((cc) => { if (out.indexOf(cc) < 0) out.push(cc); });
  });
  return out;
}
function pasIndice() { try { return typeof matIndiceConcursos === "function" ? matIndiceConcursos() : new Map(); } catch (e) { return new Map(); } }
/* as pastas para mostrar: as de edital (por id; as de prova já passada no fim) e as livres. Sem editais cadastrados,
 * as de edital saem do índice de concursos que a pessoa passar (o modo antigo). */
function pasTodas(idx) {
  const ix = pasEdIndice();
  let eds;
  if (ix.lista.length) {
    const ord = (a, b) => a.nome.localeCompare(b.nome);
    eds = ix.lista.filter((e) => !e.encerrado).sort(ord).concat(ix.lista.filter((e) => e.encerrado).sort(ord))
      .map((e) => ({ id: "ed:" + e.id, nome: e.nome, edital: true, encerrado: e.encerrado }));
  } else {
    const nomes = [];
    (idx || new Map()).forEach((ccs) => (ccs || []).forEach((cc) => { if (nomes.indexOf(cc) < 0) nomes.push(cc); }));
    eds = nomes.sort((a, b) => a.localeCompare(b)).map((cc) => ({ id: "ed:" + cc, nome: cc, edital: true, encerrado: false }));
  }
  return eds.concat(pasLer().map((p) => Object.assign({ edital: false }, p)));
}
/* o item está na pasta? (item = {t, id, topicos}) */
function pasContem(pastaId, item, idx) {
  if (!pastaId) return true;
  if (!item) return false;
  if (pastaId.indexOf("ed:") === 0) {
    const ix = pasEdIndice();
    const ed = pasEdAchar(pastaId, ix);
    if (ed) return !!pasEdMotivo(ed, item, ix);
    return pasEditaisDe(item.topicos || [], idx).indexOf(pastaId.slice(3)) >= 0;
  }
  return pasTem(pasLer().find((p) => p.id === pastaId), item.t, item.id);
}

/* ---------------- a fileira de pastas (nas duas bibliotecas) ---------------- */
/* o = { cx, t: "lei"|"jur", itens: [{t, id, topicos}], sel, escolher(id) } */
let pasVerEncerrados = false;
function pasFileira(o) {
  const cx = o && o.cx;
  if (!cx) return 0;
  cx.innerHTML = "";
  const idx = o.idx || pasIndice();
  const todas = pasTodas(idx);
  const conta = (id) => (o.itens || []).filter((it) => pasContem(id, it, idx)).length;
  const bt = (txt, tit, ativo, fn, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min pas-chip" + (ativo ? " mat-ligado" : "") + (cls ? " " + cls : "");
    b.textContent = txt;
    b.title = tit;
    b.setAttribute("aria-pressed", ativo ? "true" : "false");
    b.onclick = fn;
    cx.append(b);
    return b;
  };
  bt(t("pas_todas"), t("pas_todas_aj"), !o.sel, () => o.escolher(""));
  let n = 0;
  const chip = (p, k) => {
    bt((p.edital ? "📋 " : "📁 ") + p.nome + " · " + k, t(p.edital ? (p.encerrado ? "pas_edital_enc_aj" : "pas_edital_aj") : "pas_livre_aj", { p: p.nome }), o.sel === p.id,
      () => o.escolher(o.sel === p.id ? "" : p.id), p.edital ? "pas-edital" + (p.encerrado ? " pas-encerrado" : "") : "pas-livre");
    n++;
  };
  /* pasta de edital sem nada deste tipo não ocupa lugar; a livre aparece sempre (é onde se põe) */
  const encerradas = [];
  todas.forEach((p) => {
    const k = conta(p.id);
    if (p.edital && !k) return;
    if (p.edital && p.encerrado) { encerradas.push([p, k]); return; }
    chip(p, k);
  });
  bt(t("pas_nova"), t("pas_nova_aj"), false, async () => {
    const nome = await uiTexto(t("pas_nova_pergunta"), "");
    const p = pasCriar(nome);
    if (!p) return;
    try { reg("MATERIAL", "pasta criada", p.nome); } catch (e) {}
    o.escolher(o.sel);
  }, "pas-nova");
  /* (19.97.0) as de prova já passada no fim, atrás de um toque (aberto se uma delas é a escolhida) */
  if (encerradas.length) {
    const ver = pasVerEncerrados || encerradas.some(([p]) => p.id === o.sel);
    if (ver) encerradas.forEach(([p, k]) => chip(p, k));
    bt(ver ? t("pas_enc_menos") : t("pas_enc_mais", { n: encerradas.length }), t("pas_enc_aj"), false,
      () => { pasVerEncerrados = !ver; o.escolher(ver && encerradas.some(([p]) => p.id === o.sel) ? "" : o.sel); }, "pas-enc-alt");
  }
  return n;
}

/* ---------------- a janela "📁 pastas" de um item ---------------- */
let pasCtx = null;
/* o botão do item: "📁 2" (em quantas pastas livres está) */
function pasBotaoItem(tipo, id, rotulo, aoMudar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-min pas-item";
  b.id = "btnPas_" + tipo + "_" + id;
  /* (19.97.0) conta as pastas livres e as de edital em que o item está */
  let nEd = 0;
  try {
    const it = tipo === "lei" ? ((typeof leiDe === "function" && leiDe(id)) || {}) : ((typeof jurDe === "function" && jurDe(id)) || {});
    nEd = pasEditaisDoItem({ t: tipo, id, topicos: it.topicos || [] }).length;
  } catch (e) { nEd = 0; }
  const n = pasDoItem(tipo, id).length + nEd;
  b.textContent = n ? "📁 " + n : t("pas_item_0");
  b.title = t("pas_item_aj", { n });
  b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); pasAbrir(tipo, id, rotulo, aoMudar); };
  return b;
}
function pasAbrir(tipo, id, rotulo, aoMudar) {
  if (!$("dlgPastas")) return false;
  pasCtx = { t: tipo, id, rotulo: rotulo || "", aoMudar: typeof aoMudar === "function" ? aoMudar : null, renomeando: "" };
  pasPintar();
  abrirModal("dlgPastas");
  return true;
}
function pasPintar() {
  const c = pasCtx;
  if (!c) return;
  $("pasTit").textContent = t("pas_dlg_tit", { r: c.rotulo });
  const cx = $("pasLista");
  cx.innerHTML = "";
  const lista = pasLer();
  if (!lista.length) { const p = document.createElement("p"); p.className = "nota"; p.textContent = t("pas_vazio"); cx.append(p); }
  lista.forEach((p) => {
    const li = document.createElement("div");
    li.className = "pas-li";
    if (c.renomeando === p.id) {
      const inp = document.createElement("input");
      inp.type = "text"; inp.id = "pasRenomear_" + p.id; inp.value = p.nome; inp.className = "pas-ren";
      const ok = document.createElement("button");
      ok.type = "button"; ok.className = "btn-min btn-min-ok"; ok.textContent = t("pas_ren_ok");
      ok.onclick = () => {
        const r = pasRenomear(p.id, inp.value);
        if (!r.ok) { $("pasMsg").textContent = t(r.motivo === "repetido" ? "pas_ren_repetido" : "pas_ren_vazio"); return; }
        try { reg("MATERIAL", "pasta renomeada", p.nome + " → " + pasLimparNome(inp.value)); } catch (e) {}
        c.renomeando = ""; $("pasMsg").textContent = ""; pasPintar(); pasAvisar();
      };
      inp.onkeydown = (ev) => { if (ev && ev.key === "Enter") ok.onclick(); };
      li.append(inp, ok);
    } else {
      const lb = document.createElement("label");
      lb.className = "pas-marca";
      const ck = document.createElement("input");
      ck.type = "checkbox"; ck.id = "pasCk_" + p.id; ck.checked = pasTem(p, c.t, c.id);
      ck.onchange = () => {
        const dentro = pasAlternar(p.id, c.t, c.id, ck.checked);
        try { reg("MATERIAL", dentro ? "atalho posto na pasta" : "atalho tirado da pasta", c.rotulo + " · " + p.nome); } catch (e) {}
        pasAvisar();
      };
      const nm = document.createElement("span");
      nm.textContent = "📁 " + p.nome + " · " + (p.itens || []).length;
      lb.append(ck, " ", nm);
      const ren = document.createElement("button");
      ren.type = "button"; ren.className = "btn-min"; ren.id = "btnPasRen_" + p.id; ren.textContent = "✎"; ren.title = t("pas_ren_aj");
      ren.onclick = () => { c.renomeando = p.id; pasPintar(); };
      const ap = document.createElement("button");
      ap.type = "button"; ap.className = "btn-min btn-min-perigo"; ap.id = "btnPasApagar_" + p.id; ap.textContent = "🗑"; ap.title = t("pas_apagar_aj");
      ap.onclick = async () => {
        if (!(await uiConfirm(t("pas_apagar_conf", { p: p.nome, n: (p.itens || []).length }), { perigo: true, ok: t("pas_apagar_ok") }))) return;
        pasApagar(p.id);
        try { reg("MATERIAL", "pasta apagada (os itens continuam)", p.nome); } catch (e) {}
        pasPintar(); pasAvisar();
      };
      li.append(lb, ren, ap);
    }
    cx.append(li);
  });
  /* (19.97.0) AS PASTAS DE EDITAL, NA MESMA JANELA. Marcadas sozinhas (e travadas) quando a lei é ligada a um tópico do
   * edital ou usada em vínculo dele — o porquê vem ao lado; nas outras, marcar põe à mão (a lei do concurso inteiro). */
  let topicos = [];
  try { topicos = (c.t === "lei" ? ((typeof leiDe === "function" && leiDe(c.id)) || {}) : ((typeof jurDe === "function" && jurDe(c.id)) || {})).topicos || []; } catch (e) { topicos = []; }
  const item = { t: c.t, id: c.id, topicos };
  const ix = pasEdIndice();
  const cxE = $("pasEdLista");
  const nomesEd = [];
  if (cxE) {
    cxE.innerHTML = "";
    const ord = (a, b) => a.nome.localeCompare(b.nome);
    ix.lista.filter((e) => !e.encerrado).sort(ord).concat(ix.lista.filter((e) => e.encerrado).sort(ord)).forEach((ed) => {
      const mot = pasEdMotivo(ed, item, ix);
      if (mot) nomesEd.push(ed.nome);
      const li = document.createElement("div");
      li.className = "pas-li" + (ed.encerrado ? " pas-encerrado" : "");
      const lb = document.createElement("label");
      lb.className = "pas-marca";
      const ck = document.createElement("input");
      ck.type = "checkbox"; ck.id = "pasEdCk_" + ed.id; ck.checked = !!mot;
      ck.disabled = mot === "topico" || mot === "vinculo";
      ck.onchange = () => {
        const dentro = pasEdAlternar("ed:" + ed.id, c.t, c.id, ck.checked);
        try { reg("MATERIAL", dentro ? "posto à mão na pasta do edital" : "tirado da pasta do edital", c.rotulo + " · " + ed.nome); } catch (e) {}
        pasPintar(); pasAvisar();
      };
      const nm = document.createElement("span");
      nm.textContent = "📋 " + ed.nome + (ed.encerrado ? " " + t("ed_sel_encerrado") : "");
      lb.append(ck, " ", nm);
      li.append(lb);
      if (mot) {
        const pq = document.createElement("span");
        pq.className = "pas-porque";
        pq.textContent = t("pas_mot_" + mot);
        li.append(pq);
      }
      cxE.append(li);
    });
    cxE.hidden = !ix.lista.length;
    if ($("pasEdTit")) $("pasEdTit").hidden = !ix.lista.length;
  }
  $("pasEditais").textContent = nomesEd.length ? t("pas_editais_do_item", { l: nomesEd.join(", ") }) : t("pas_editais_nenhum");
  $("pasNovaNome").value = "";
}
/* "＋ criar e pôr aqui" */
function pasCriarEPor() {
  const c = pasCtx;
  const nome = String(($("pasNovaNome") || {}).value || "").trim();
  if (!c || !nome) { $("pasMsg").textContent = t("pas_ren_vazio"); return null; }
  const p = pasCriar(nome);
  if (!p) return null;
  pasAlternar(p.id, c.t, c.id, true);
  try { reg("MATERIAL", "pasta criada com o item", p.nome + " · " + c.rotulo); } catch (e) {}
  $("pasMsg").textContent = "";
  pasPintar(); pasAvisar();
  return p;
}
function pasAvisar() { try { if (pasCtx && pasCtx.aoMudar) pasCtx.aoMudar(); } catch (e) {} }

if (typeof document !== "undefined" && $("dlgPastas")) {
  $("btnPasCriar").onclick = () => pasCriarEPor();
  $("pasNovaNome").onkeydown = (ev) => { if (ev && ev.key === "Enter") pasCriarEPor(); };
  $("btnPasFechar").onclick = () => $("dlgPastas").close();
}
