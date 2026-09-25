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

/* ---- a janela do editor (livre: nada aqui trava, tudo se desfaz) ---- */
let ramCtx = null, ramLinhas = [];

const RAM_DICAS = {
  btnRamMais: "ram_tip_mais", btnRamSalvar: "ram_tip_salvar", btnRamFechar: "ram_tip_fechar",
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
  ramPintar();
  dicasDosBotoes(RAM_DICAS);
  abrirModal("dlgRamos");
  return true;
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
  $("btnRamSalvar").onclick = ramSalvar;
  $("btnRamFechar").onclick = () => $("dlgRamos").close();
}
