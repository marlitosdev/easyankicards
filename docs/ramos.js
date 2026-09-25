/* ===================================================================
 * RAMIFICAÇÕES DO TÓPICO — o editor livre e a ligação com os cartões
 *
 * Um tópico como "Lei de Licitações" é extenso demais para ser uma unidade
 * só de estudo. Os RAMOS (edital.js: "++ Ramo :: peso :: nota") o dividem
 * em pedaços que a pessoa cria, renomeia, reordena, pesa e apaga QUANDO
 * quiser — as prioridades de estudo mudam, e os ramos mudam junto.
 *
 * O ramo mora no TEXTO DO EDITAL (é dele que o plano de estudo lê), e o
 * cartão se liga a ele por uma etiqueta reservada, ram_<id>, sem mudar
 * nada no armazenamento. Este módulo cuida do que junta as duas pontas:
 *  · a etiqueta (ler, trocar, tirar) nos cartões de um tópico;
 *  · a EDIÇÃO dos ramos (uma função só: aplica no texto do edital, acompanha
 *    o que foi renomeado/apagado nos cartões, e deixa UM recibo para desfazer);
 *  · a janela do editor, aberta da Biblioteca (e, depois, do plano).
 * =================================================================== */
const RAM_PREFIXO = "ram_";
const RAM_GERAL = "_geral";     /* o "geral do tópico": cartões sem ramo */

/* o ramo de um cartão (o id da etiqueta ram_<id>), ou "" */
function ramIdDoCartao(card) {
  const tags = ((card && card.ownTags) || []).concat((card && card.tags) || []);
  const t1 = tags.find((x) => /^ram_/i.test(String(x)));
  return t1 ? String(t1).slice(RAM_PREFIXO.length).toLowerCase() : "";
}

/* o cartão com a etiqueta de ramo trocada: id "" só tira. Não mexe nas outras etiquetas. */
function ramCartaoComRamo(card, id) {
  const sem = (l) => (l || []).filter((x) => !/^ram_/i.test(String(x)));
  const own = sem(card.ownTags), tags = sem(card.tags);
  if (id) { own.push(RAM_PREFIXO + id); tags.push(RAM_PREFIXO + id); }
  return Object.assign({}, card, { ownTags: own, tags });
}

/* Troca, no texto do tópico \`chave\`, a etiqueta de ramo de cada cartão de \`cards\` por fn(idAtual) (id novo, ou "" para tirar).
 * Devolve quantos mudaram. O texto é regravado pelo mesmo caminho dos outros gestos (cqGravar). */
function ramRetagar(chave, cards, fn) {
  let texto = cqTexto(chave), mudou = 0;
  (cards || []).forEach((c) => {
    const atual = ramIdDoCartao(c);
    const novo = fn(atual);
    if (novo === atual) return;
    const linha = cardToLine(ramCartaoComRamo(c, novo));
    const t2 = ceSubstituir(texto, c, linha);
    if (t2 === null) return;
    texto = t2; mudou++;
  });
  if (mudou) cqGravar(chave, texto, { disciplina: (matResumos[chave] || {}).disciplina, topico: (matResumos[chave] || {}).topico });
  return mudou;
}

/* Liga os cartões a um ramo (id "" = geral do tópico). Cartão de OUTRO tópico é movido para ele antes.
 * Um recibo só (mover + etiquetar): desfazer volta tudo. Devolve { movidos, ligados, repetidos }. */
function ramAtribuir(notas, chave, id, concurso) {
  const dest = gerPastaInfo(chave);
  const r = { movidos: 0, repetidos: 0, naoAchou: 0 };
  const antes = {};
  if (!dest) return { movidos: 0, ligados: 0, repetidos: 0 };
  const fora = (notas || []).filter((n) => n.chave !== chave);
  if (fora.length) gerMoverNucleo(fora, chave, concurso, dest, antes, r);
  if (!(chave in antes)) { antes[chave] = gerTexto(chave); cqVersaoBancada("antes de ligar cartões a um ramo", [chave]); }
  /* depois do mover, os cartões estão no destino: reencontra-os pelo texto (raw) */
  const cards = (notas || []).map((n) => n.card);
  const ligados = ramRetagar(chave, cards, () => id);
  gerRegistrar(antes);
  try { matReg("cartoes", "ramos: cartões ligados a um ramo", ligados + " ligado(s), " + r.movidos + " movido(s)"); } catch (e) {}
  return { movidos: r.movidos, ligados, repetidos: r.repetidos };
}

/* A EDIÇÃO dos ramos de UM tópico do plano de um edital, num gesto só:
 *  · troca as linhas "++" no texto do edital (edEditarRamos — o resto do texto não é tocado);
 *  · o que foi RENOMEADO leva as etiquetas dos cartões junto; o que foi APAGADO devolve os cartões ao geral do tópico;
 *  · UM recibo (texto do edital + cartões): desfazer volta os dois.
 * ctx: { editalId, disciplina, topico, chave }; linhas: [{ idOrig?, nome, peso?, nota? }] na ordem desejada. */
function ramAplicar(ctx, linhas) {
  const ed = (typeof editais !== "undefined" ? editais : []).find((e) => e.id === ctx.editalId);
  if (!ed) return { ok: false, motivo: "sem_edital" };
  const antesTexto = ed.texto || "";
  const atuais = edRamosDoTopico(antesTexto, ctx.disciplina, ctx.topico);
  const res = edEditarRamos(antesTexto, ctx.disciplina, ctx.topico, (linhas || []).map((l) => ({ nome: l.nome, peso: l.peso, nota: l.nota })));
  if (!res) return { ok: false, motivo: "sem_topico" };
  /* quem é quem: a linha i do formulário virou o ramo res.ramos[?] — o nome (limpo) leva ao id novo */
  const idNovoDe = new Map();
  (linhas || []).forEach((l) => {
    const nome = String(l.nome || "").replace(/\s*::\s*/g, " - ").replace(/\s+/g, " ").trim();
    if (l.idOrig && nome) idNovoDe.set(l.idOrig, edRamoId(nome));
  });
  const idsNovos = new Set(res.ramos.map((x) => x.id));
  const mapa = new Map();        /* id antigo → id novo ("" = tirou) */
  atuais.forEach((a) => {
    const novo = idNovoDe.get(a.id);
    if (novo && idsNovos.has(novo)) { if (novo !== a.id) mapa.set(a.id, novo); }
    else mapa.set(a.id, "");
  });
  /* os cartões do tópico (só quem tem etiqueta que mudou) */
  const antes = {};
  antes[ctx.chave] = gerTexto(ctx.chave);
  const cards = cqLerBiblioteca().filter((n) => n.chave === ctx.chave).map((n) => n.card);
  const retag = ramRetagar(ctx.chave, cards, (id) => (mapa.has(id) ? mapa.get(id) : id));
  ed.texto = res.texto;
  try { edSalvarLista(); } catch (e) {}
  try {
    if (typeof editalAtual !== "undefined" && editalAtual === ed.id && $("editalTexto")) { $("editalTexto").value = res.texto; edRender(); }
  } catch (e) {}
  gerRegistrar(antes, { edital: { id: ed.id, antes: antesTexto, depois: res.texto } });
  try { matReg("ramos", "ramos editados: " + ctx.topico, res.ramos.length + " ramo(s), " + retag + " cartão(ões) acompanharam"); } catch (e) {}
  return { ok: true, ramos: res.ramos, avisos: res.avisos, retag, mapa };
}

/* PROPOR RAMOS PELO ÍNDICE DA LEI (local, sem IA): as divisões da lei carregada no tópico (títulos, capítulos…)
 * viram ramos. Desce um nível enquanto houver menos de 3 divisões (uma lei com "Título único" seria um ramo só).
 * O peso proposto é o tamanho da divisão (artigos), de 1 a 5 — é só um ponto de partida: quem sabe o que mais cai é
 * a pessoa, que ajusta antes de salvar. Devolve { ramos:[{nome, peso, nota, total}], cortou, divisoes }. */
const RAM_MAX_SUGESTAO = 20;
function ramSugerirDaLei(texto) {
  if (typeof leiEstruturaLei !== "function" || !String(texto || "").trim()) return { ramos: [], cortou: 0, divisoes: 0 };
  const est = leiEstruturaLei(String(texto));
  let nivel = est.raiz.filter((n) => !n.virtual && n.total > 0);
  const divisoes = nivel.length;
  while (nivel.length < 3 && nivel.some((n) => n.filhos.some((f) => f.total > 0))) {
    const prox = [];
    nivel.forEach((n) => {
      const fs = n.filhos.filter((f) => f.total > 0);
      if (fs.length) fs.forEach((f) => prox.push(f)); else prox.push(n);
    });
    nivel = prox;
  }
  const cortou = Math.max(0, nivel.length - RAM_MAX_SUGESTAO);
  nivel = nivel.slice(0, RAM_MAX_SUGESTAO);
  const maior = nivel.reduce((m, n) => Math.max(m, n.total), 0) || 1;
  const num = (i) => (est.artigos[i] ? est.artigos[i].num : "");
  const ramos = nivel.map((n) => {
    const de = num(n.de), ate = num(n.ate);
    const nome = String(n.rotulo || n.nome || "").replace(/\s+/g, " ").trim().slice(0, 70);
    return { nome, peso: String(Math.max(1, Math.min(5, Math.round(5 * n.total / maior)))),
      nota: de && ate ? (de === ate ? "art. " + de : "arts. " + de + " a " + ate) : "", total: n.total };
  }).filter((r) => r.nome);
  return { ramos, cortou, divisoes };
}

/* ASSISTÊNCIA DE IA: o app monta o pedido (com o índice da lei e o que a pessoa já tem), a IA responde com linhas
 * "++ Ramo :: peso :: nota", a pessoa cola, e o app CONFERE antes de acrescentar. Quem calcula é o app; a IA só sugere
 * ramos e pesos, e nada entra sem passar pelo editor (onde a pessoa ajusta e só então salva). */
const RAM_MAX_IA = 30;
function ramPedidoIA(ctx, atuais) {
  const ed = (typeof editais !== "undefined" ? editais : []).find((e) => e.id === ctx.editalId) || {};
  let indice = "";
  try {
    const s = ramSugerirDaLei(typeof leiTextoDoTopico === "function" ? leiTextoDoTopico(ctx.chave) : "");
    if (s.ramos.length) indice = t("ram_prompt_indice") + "\n" + s.ramos.map((r) => "- " + r.nome + (r.nota ? " (" + r.nota + ")" : "")).join("\n") + "\n";
  } catch (e) {}
  let nq = 0;
  try { nq = typeof qsContarDoTopico === "function" ? qsContarDoTopico(ctx.chave) : 0; } catch (e) {}
  return t("ram_prompt_ia", {
    t: ctx.topico, d: ctx.disciplina, c: ed.nome || "—",
    atuais: (atuais || []).length ? atuais.join("; ") : t("ram_prompt_nenhum"),
    indice, dados: nq > 0 ? t("ram_prompt_dados", { n: nq }) + "\n" : "",
  });
}

/* lê a resposta da IA: só entram linhas com marcador ("++", "-", "*", "•" ou "1."); o resto (conversa) é ignorado.
 * Devolve { ramos:[{nome, peso, nota}], ignoradas, avisos:[tipo…] } — o "lerEdital" faz a leitura de nome/peso/nota. */
function ramLerRespostaIA(texto) {
  const brutas = String(texto || "").split(/\r?\n/);
  const linhas = [];
  let ignoradas = 0;
  brutas.forEach((l) => {
    const x = l.trim();
    if (!x) return;
    const m = x.match(/^(?:\+\+|\+|[-*·•]|\d+[.)])\s*(.+)$/);
    if (!m) { ignoradas++; return; }
    linhas.push("++ " + m[1].replace(/^[+\-*·•\s]+/, ""));
  });
  const r = lerEdital("@ D :: 5\n+ T :: 5\n" + linhas.join("\n"));
  const tp = r.disciplinas[0] && r.disciplinas[0].topicos[0];
  const ramos = ((tp && tp.ramos) || []).slice(0, RAM_MAX_IA).map((x) => ({
    nome: x.nome, peso: x.herdado ? "" : String(x.peso), nota: x.nota || "" }));
  return { ramos, ignoradas, avisos: (r.achados || []).map((a) => a.tipo), cortou: Math.max(0, ((tp && tp.ramos) || []).length - RAM_MAX_IA) };
}

/* PESOS PELOS SEUS REGISTROS: quantas das suas questões e julgados deste tópico falam de cada ramo. É um indício, não
 * uma medida: o ramo "aparece" num texto quando o texto traz o radical da maioria das palavras do nome do ramo. O
 * peso vai de 1 a 5 pela contagem relativa ao ramo mais citado; ramo sem nenhuma citação NÃO recebe peso (falta de
 * registro não é falta de prova). Devolve [{ nome, citacoes, peso }] (peso "" = sem indício). */
const RAM_GENERICAS = new Set(["titulo", "capitulo", "secao", "subsecao", "livro", "parte", "disposicoes", "gerais", "preliminares", "arts", "art"]);
function ramRadicais(s) {
  const r = new Set();
  cqNormal(s).split(" ").forEach((w) => {
    if (w.length > 3 && !RAM_GENERICAS.has(w) && !CQ_STOP.has(w) && !/^[ivxlc]+$/.test(w)) r.add(w.slice(0, 6));
  });
  return r;
}
function ramPesosPorRegistros(nomes, textos) {
  const docs = (textos || []).map((x) => ramRadicais(x)).filter((x) => x.size);
  const conta = (nomes || []).map((nome) => {
    const rad = ramRadicais(nome);
    if (!rad.size) return { nome, citacoes: 0, peso: "" };
    const minimo = Math.max(1, Math.ceil(rad.size * 0.6));
    let n = 0;
    docs.forEach((d) => { let c = 0; rad.forEach((w) => { if (d.has(w)) c++; }); if (c >= minimo) n++; });
    return { nome, citacoes: n, peso: "" };
  });
  const maior = conta.reduce((m, x) => Math.max(m, x.citacoes), 0);
  if (maior > 0) conta.forEach((x) => { if (x.citacoes > 0) x.peso = String(Math.max(1, Math.min(5, Math.round(1 + 4 * x.citacoes / maior)))); });
  return conta;
}

/* os textos que a pessoa já registrou deste tópico (questões e julgados) */
function ramTextosDoTopico(chave) {
  const out = [];
  try {
    (typeof qsBanco !== "undefined" ? qsBanco : []).filter((q) => q.chave === chave || (typeof qsChaveNormal === "function" && qsChaveNormal(q.chave) === qsChaveNormal(chave)))
      .forEach((q) => out.push([q.enunciado, q.comentario, (q.opcoes || []).join(" ")].join(" ")));
  } catch (e) {}
  try {
    (typeof jurDoTopico === "function" ? jurDoTopico(chave) : []).forEach((j) => out.push([j.tese, j.tese_curta, j.ementa, j.resumo, j.tema].join(" ")));
  } catch (e) {}
  return out;
}

/* ---- a janela do editor (livre: nada aqui trava, tudo se desfaz) ---- */
let ramCtx = null, ramLinhas = [];

const RAM_DICAS = {
  btnRamLei: "ram_tip_lei", btnRamPesos: "ram_tip_pesos", btnRamIa: "ram_tip_ia", btnRamConferir: "ram_tip_conferir", btnRamMais: "ram_tip_mais", btnRamSalvar: "ram_tip_salvar", btnRamFechar: "ram_tip_fechar",
};

function ramEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function ramPintar() {
  const cx = $("ramLista");
  cx.innerHTML = "";
  if (!ramLinhas.length) cx.append(ramEl("p", "nota", t("ram_vazio")));
  ramLinhas.forEach((l, i) => {
    const lin = ramEl("div", "ram-linha");
    const nome = ramEl("input", "ram-nome"); nome.type = "text"; nome.value = l.nome; nome.maxLength = 80;
    nome.placeholder = t("ram_nome_ph"); nome.title = t("ram_tip_nome");
    nome.oninput = () => { l.nome = nome.value; };
    const peso = ramEl("select", "ram-peso"); peso.title = t("ram_tip_peso");
    [["", t("ram_peso_igual")], ["1", "★ 1"], ["2", "★ 2"], ["3", "★ 3"], ["4", "★ 4"], ["5", "★ 5"]].forEach(([v, rot]) => {
      const o = document.createElement("option"); o.value = v; o.textContent = rot; peso.append(o);
    });
    peso.value = l.peso === undefined || l.peso === null ? "" : String(l.peso);
    peso.onchange = () => { l.peso = peso.value; };
    const nota = ramEl("input", "ram-nota"); nota.type = "text"; nota.value = l.nota || ""; nota.maxLength = 160;
    nota.placeholder = t("ram_nota_ph"); nota.title = t("ram_tip_nota");
    nota.oninput = () => { l.nota = nota.value; };
    const sobe = ramEl("button", "btn-min", "▲"); sobe.type = "button"; sobe.title = t("ram_tip_sobe"); sobe.disabled = i === 0;
    sobe.onclick = () => { ramMover(i, -1); };
    const desce = ramEl("button", "btn-min", "▼"); desce.type = "button"; desce.title = t("ram_tip_desce"); desce.disabled = i === ramLinhas.length - 1;
    desce.onclick = () => { ramMover(i, 1); };
    const fora = ramEl("button", "btn-min btn-min-perigo", "✕"); fora.type = "button"; fora.title = t("ram_tip_apagar");
    fora.onclick = () => { ramLinhas.splice(i, 1); ramPintar(); flashBotao($("btnRamMais")); };
    lin.append(nome, peso, nota, sobe, desce, fora);
    cx.append(lin);
  });
}

function ramMover(i, d) {
  const j = i + d;
  if (j < 0 || j >= ramLinhas.length) return;
  const x = ramLinhas[i]; ramLinhas[i] = ramLinhas[j]; ramLinhas[j] = x;
  ramPintar();
}

/* ctx: { editalId, disciplina, topico, chave, depois() } */
function ramAbrirEditor(ctx) {
  const ed = (typeof editais !== "undefined" ? editais : []).find((e) => e.id === ctx.editalId);
  if (!ed) return false;
  ramCtx = ctx;
  ramLinhas = edRamosDoTopico(ed.texto || "", ctx.disciplina, ctx.topico).map((r) => ({
    idOrig: r.id, nome: r.nome, peso: r.herdado ? "" : (r.abs > 0 ? r.abs + (r.unidade === "p" ? "p" : "q") : String(r.peso)), nota: r.nota || "" }));
  $("ramTit").textContent = t("ram_titulo", { t: ctx.topico });
  $("ramMsg").textContent = "";
  $("ramIaBox").hidden = true; $("ramColar").value = "";
  ramPintar();
  const temLei = typeof leiTextoDoTopico === "function" && String(leiTextoDoTopico(ctx.chave) || "").trim().length > 0;
  $("btnRamLei").disabled = !temLei;
  dicasDosBotoes(Object.assign({}, RAM_DICAS, { btnRamLei: temLei ? "ram_tip_lei" : "ram_tip_lei_sem" }));
  abrirModal("dlgRamos");
  return true;
}

/* acrescenta (nunca substitui) os ramos propostos pela lei: o que a pessoa já tem fica como está */
function ramProporDaLei() {
  if (!ramCtx) return null;
  const s = ramSugerirDaLei(typeof leiTextoDoTopico === "function" ? leiTextoDoTopico(ramCtx.chave) : "");
  if (!s.ramos.length) { $("ramMsg").textContent = t("ram_lei_nada"); return s; }
  const tem = new Set(ramLinhas.map((l) => edRamoId(l.nome)));
  let novos = 0;
  s.ramos.forEach((r) => {
    if (tem.has(edRamoId(r.nome))) return;
    ramLinhas.push({ nome: r.nome, peso: r.peso, nota: r.nota }); tem.add(edRamoId(r.nome)); novos++;
  });
  ramPintar();
  $("ramMsg").textContent = t("ram_lei_ok", { n: novos, d: s.ramos.length }) + (s.cortou ? " " + t("ram_lei_cortou", { c: s.cortou }) : "");
  s.novos = novos;
  return s;
}

/* dá peso aos ramos SEM peso (igual) pelo que a pessoa já registrou; os que ela pesou ficam como estão */
function ramPesosDosRegistros() {
  if (!ramCtx) return null;
  const textos = ramTextosDoTopico(ramCtx.chave);
  if (!textos.length) { $("ramMsg").textContent = t("ram_pesos_nada"); return { textos: 0, aplicados: 0 }; }
  const res = ramPesosPorRegistros(ramLinhas.map((l) => l.nome), textos);
  let aplicados = 0, jaTinham = 0, semIndicio = 0;
  ramLinhas.forEach((l, i) => {
    const x = res[i];
    if (!x.peso) { semIndicio++; return; }
    if (String(l.peso || "") !== "") { jaTinham++; return; }
    l.peso = x.peso; aplicados++;
  });
  ramPintar();
  $("ramMsg").textContent = t("ram_pesos_ok", { a: aplicados, n: textos.length, s: semIndicio, j: jaTinham });
  return { textos: textos.length, aplicados, semIndicio, jaTinham, res };
}

/* copia o pedido para a IA e abre a caixa onde se cola a resposta */
async function ramPedirIA() {
  if (!ramCtx) return null;
  const pedido = ramPedidoIA(ramCtx, ramLinhas.map((l) => String(l.nome || "").trim()).filter(Boolean));
  $("ramIaBox").hidden = false;
  try { await navigator.clipboard.writeText(pedido); $("ramMsg").textContent = t("ram_ia_copiado"); }
  catch (e) { $("ramMsg").textContent = t("ram_ia_copie_manual"); $("ramColar").value = pedido; }
  return pedido;
}

/* confere a resposta colada e ACRESCENTA ao editor só o que é novo; o que a pessoa já tem não é tocado */
function ramConferirIA() {
  if (!ramCtx) return null;
  const r = ramLerRespostaIA($("ramColar").value);
  if (!r.ramos.length) { $("ramMsg").textContent = t("ram_ia_nada"); return r; }
  const tem = new Set(ramLinhas.map((l) => edRamoId(l.nome)));
  let novos = 0, ja = 0;
  r.ramos.forEach((x) => {
    if (tem.has(edRamoId(x.nome))) { ja++; return; }
    ramLinhas.push({ nome: x.nome, peso: x.peso, nota: x.nota }); tem.add(edRamoId(x.nome)); novos++;
  });
  ramPintar();
  const avisos = r.avisos.filter((a) => /peso|ramo_repetido|ramo_sem_nome/.test(a)).length;
  $("ramMsg").textContent = t("ram_ia_ok", { n: novos, j: ja, i: r.ignoradas, a: avisos }) + (r.cortou ? " " + t("ram_lei_cortou", { c: r.cortou }) : "");
  r.novos = novos; r.jaExistiam = ja;
  return r;
}

function ramAdicionar() {
  ramLinhas.push({ nome: "", peso: "", nota: "" });
  ramPintar();
  try { const ins = achar1($("ramLista"), "ram-nome"); if (ins) ins.focus(); } catch (e) {}
}
function achar1(cx, cls) {
  const l = Array.from((cx && cx.children) || []);
  const ultimo = l[l.length - 1];
  return ultimo ? Array.from(ultimo.children || []).find((x) => String(x.className || "").indexOf(cls) >= 0) : null;
}

function ramSalvar() {
  if (!ramCtx) return null;
  const r = ramAplicar(ramCtx, ramLinhas);
  if (!r.ok) { $("ramMsg").textContent = t("ram_erro"); return r; }
  $("dlgRamos").close();
  const depois = ramCtx.depois; ramCtx = null;
  if (typeof depois === "function") depois(r);
  return r;
}

if (typeof document !== "undefined" && $("btnRamSalvar")) {
  $("btnRamMais").onclick = ramAdicionar;
  $("btnRamLei").onclick = ramProporDaLei;
  $("btnRamIa").onclick = ramPedirIA;
  $("btnRamPesos").onclick = ramPesosDosRegistros;
  $("btnRamConferir").onclick = ramConferirIA;
  $("btnRamSalvar").onclick = ramSalvar;
  $("btnRamFechar").onclick = () => $("dlgRamos").close();
}
