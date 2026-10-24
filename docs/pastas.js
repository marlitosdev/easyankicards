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
/* as pastas para mostrar: as de edital (dos editais cadastrados) e as livres */
function pasTodas(idx) {
  const eds = [];
  (idx || new Map()).forEach((ccs) => (ccs || []).forEach((cc) => { if (eds.indexOf(cc) < 0) eds.push(cc); }));
  return eds.sort((a, b) => a.localeCompare(b)).map((cc) => ({ id: "ed:" + cc, nome: cc, edital: true }))
    .concat(pasLer().map((p) => Object.assign({ edital: false }, p)));
}
/* o item está na pasta? (item = {t, id, topicos}) */
function pasContem(pastaId, item, idx) {
  if (!pastaId) return true;
  if (!item) return false;
  if (pastaId.indexOf("ed:") === 0) return pasEditaisDe(item.topicos || [], idx).indexOf(pastaId.slice(3)) >= 0;
  return pasTem(pasLer().find((p) => p.id === pastaId), item.t, item.id);
}

/* ---------------- a fileira de pastas (nas duas bibliotecas) ---------------- */
/* o = { cx, t: "lei"|"jur", itens: [{t, id, topicos}], sel, escolher(id) } */
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
  todas.forEach((p) => {
    const k = conta(p.id);
    /* pasta de edital sem nada deste tipo não ocupa lugar; a livre aparece sempre (é onde se põe) */
    if (p.edital && !k) return;
    bt((p.edital ? "📋 " : "📁 ") + p.nome + " · " + k, t(p.edital ? "pas_edital_aj" : "pas_livre_aj", { p: p.nome }), o.sel === p.id,
      () => o.escolher(o.sel === p.id ? "" : p.id), p.edital ? "pas-edital" : "pas-livre");
    n++;
  });
  bt(t("pas_nova"), t("pas_nova_aj"), false, async () => {
    const nome = await uiTexto(t("pas_nova_pergunta"), "");
    const p = pasCriar(nome);
    if (!p) return;
    try { reg("MATERIAL", "pasta criada", p.nome); } catch (e) {}
    o.escolher(o.sel);
  }, "pas-nova");
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
  const n = pasDoItem(tipo, id).length;
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
  /* as de edital deste item: automáticas, só para saber */
  let eds = [];
  try {
    const topicos = c.t === "lei" ? ((typeof leiDe === "function" && leiDe(c.id)) || {}).topicos : ((typeof jurDe === "function" && jurDe(c.id)) || {}).topicos;
    eds = pasEditaisDe(topicos || [], pasIndice());
  } catch (e) { eds = []; }
  $("pasEditais").textContent = eds.length ? t("pas_editais_do_item", { l: eds.join(", ") }) : t("pas_editais_nenhum");
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
