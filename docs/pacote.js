/* ===================================================================
 * MONTAR PACOTE .apkg E IMPORTAR PARA UMA PASTA
 *
 * A exportação só saía do texto da bancada, de uma vez, num baralho só.
 * Quem organiza o material em disciplina › tópico não tinha como escolher
 * QUAIS pastas viram um pacote, nem levar essa organização para o Anki.
 *
 * Aqui: marca-se as pastas, vê-se a previsão ("120 notas em 6 baralhos"),
 * e sai UM .apkg (ou .txt) com um baralho por pasta (Raiz::Disciplina::Tópico).
 * Repetidos e cartões abaixo do padrão podem ficar de fora — o que a F2 e a
 * F3 medem. O caminho inverso também existe: um .apkg do Anki entra numa
 * pasta escolhida, ou vira uma pasta por baralho, sem perder o baralho de
 * cada cartão. A importação vai para a lista de "desfazer" do gerenciador.
 * =================================================================== */

/* ---- núcleo (sem tela) ---- */

/* O nome do baralho de uma pasta. "::" dentro do nome viraria nível a mais. */
function pacNomeDeck(n, comEdital, ramo) {
  const limpa = (s) => String(s || "").replace(/\s*::\s*/g, " — ").replace(/\s+/g, " ").trim();
  const d = limpa(n.disciplina), t2 = limpa(n.topico);
  /* com o edital: Edital::Disciplina::Tópico — o Anki mostra o edital como a pasta de cima */
  const ed = comEdital ? limpa(n.edital) : "";
  /* com ramos: ...::Tópico::Ramo (subbaralho do tópico) */
  return [ed, d, t2, limpa(ramo)].filter(Boolean).join("::") || "Sem pasta";
}

/* O NOME do ramo de um cartão (pela etiqueta ram_ e pelos ramos do tópico no texto do edital). "" se o cartão não
 * está em ramo, se o tópico não tem ramos ou se a etiqueta aponta para um ramo que não existe mais. */
function pacRamoDoCartao(n) {
  const id = typeof ramIdDoCartao === "function" ? ramIdDoCartao(n.card) : "";
  if (!id) return "";
  const lista = (typeof editais !== "undefined" && Array.isArray(editais)) ? editais : [];
  const dono = (typeof matResumos !== "undefined" && (matResumos[n.chave] || {}).concurso) || "";
  const ordem = lista.filter((e) => cmNormal(e.nome) === cmNormal(n.edital || "")).concat(lista.filter((e) => cmNormal(e.nome) === cmNormal(dono)), lista);
  for (const e of ordem) {
    const r = edRamosDoTopico(e.texto || "", n.disciplina, n.topico).find((x) => x.id === id);
    if (r) return r.nome;
  }
  return "";
}

/* Importar: "Tópico › Ramo" (o pacote veio com subbaralho de ramo) volta a ser o TÓPICO com o ramo, quando o edital
 * conhece esse ramo; senão fica como está. Devolve { topico, ramoId } ou null. */
function pacResolverRamo(edital, disciplina, topicoJunto) {
  const partes = String(topicoJunto || "").split(" › ").map((x) => x.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  const lista = (typeof editais !== "undefined" && Array.isArray(editais)) ? editais : [];
  const cand = edital ? lista.filter((e) => cmNormal(e.nome) === cmNormal(edital)) : lista;
  for (let k = partes.length - 1; k >= 1; k--) {
    const base = partes.slice(0, k).join(" › "), ramo = partes.slice(k).join(" › ");
    const id = edRamoId(ramo);
    for (const e of cand) {
      const r = edRamosDoTopico(e.texto || "", disciplina, base).find((x) => x.id === id);
      if (r) return { topico: base, ramoId: r.id };
    }
  }
  return null;
}

/* O que entra no pacote: as notas das pastas marcadas, menos (opcionalmente)
 * os repetidos — fica o mais completo de cada grupo — e os abaixo do padrão. */
function pacMontar(notas, sel, opc) {
  const o = opc || {};
  const nomeDeck = (n) => pacNomeDeck(n, o.comEdital, o.comRamos ? pacRamoDoCartao(n) : "");
  /* o edital de cada tópico marcado (Map chave → nome): sai como a pasta de cima do baralho */
  const editalDe = o.editalDe || new Map();
  const marcadas = (notas || []).filter((n) => sel && sel.has(n.chave)).map((n) => Object.assign({}, n, { edital: editalDe.get(n.chave) || "" }));
  let ignRep = 0, ignFracos = 0;
  let manter = marcadas.map(() => true);
  if (o.semRepetidos) {
    const cards = marcadas.map((n) => n.card);
    cqAgrupar(cards).forEach((g) => {
      const melhor = cqMelhor(cards, g);
      g.forEach((i) => { if (i !== melhor) { manter[i] = false; ignRep++; } });
    });
  }
  if (o.semFracos) {
    marcadas.forEach((n, i) => { if (manter[i] && ceAbaixo(n.card)) { manter[i] = false; ignFracos++; } });
  }
  const itens = marcadas.filter((_, i) => manter[i]);
  const decks = new Map();
  itens.forEach((n) => { const d = nomeDeck(n); decks.set(d, (decks.get(d) || 0) + 1); });
  /* baralhos vazios: tópico marcado SEM nenhum cartão (ex.: tópico do edital ainda por preencher) */
  const vazios = [];
  if (o.vazios && o.info && sel) {
    const comCartao = new Set(marcadas.map((n) => n.chave));
    [...sel].forEach((ch) => {
      const i = o.info.get(ch);
      if (!i || comCartao.has(ch)) return;
      const nome = pacNomeDeck({ edital: editalDe.get(ch) || i.edital || "", disciplina: i.disciplina, topico: i.topico }, o.comEdital);
      if (!decks.has(nome)) { decks.set(nome, 0); vazios.push(nome); }
    });
  }
  return { itens, ignRep, ignFracos, decks, vazios };
}

/* Os cartões como o buildApkg / exportTxtString os querem: com o baralho da pasta. */
function pacCartoes(itens, comEdital, comRamos) {
  return (itens || []).map((n) => Object.assign({}, n.card, { deck: pacNomeDeck(n, comEdital, comRamos ? pacRamoDoCartao(n) : ""), tags: (n.card.tags || []).slice() }));
}

/* Nome de arquivo seguro para o pacote. */
function pacNomeArquivo(raiz) {
  const s = String(raiz || "").replace(/::/g, " - ").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return s || "EasyAnkiCards";
}

/* ---- importar ---- */

/* "A::B::C" -> disciplina "A", tópico "B › C". Com raiz comum (o pacote foi
 * exportado por aqui, ou é um baralho-mãe), a raiz sai. */
function pacSepararDeck(nome, raizComum, comEdital) {
  let comps = String(nome || "").split("::").map((x) => x.trim()).filter(Boolean);
  if (raizComum && comps.length > 1 && comps[0] === raizComum) comps = comps.slice(1);
  if (!comps.length) return { disciplina: "Importados", topico: "Sem baralho" };
  /* Edital::Disciplina::Tópico (o que este montador exporta com "pasta do edital"): o 1º nível é o edital */
  if (comEdital && comps.length >= 3) {
    return { edital: comps[0], disciplina: comps[1], topico: comps.slice(2).join(" › ") };
  }
  return { disciplina: comps[0], topico: comps.slice(1).join(" › ") || "Geral" };
}

/* O 1º nível (depois da raiz) de TODO baralho é o nome de um edital cadastrado? Então já se sabe que o
 * pacote veio com a pasta do edital. */
function pacDetectarEdital(cards) {
  const lista = (typeof editais !== "undefined" && Array.isArray(editais)) ? editais : [];
  if (!lista.length) return false;
  const raiz = pacRaizComum(cards);
  const nomes = new Set(lista.map((e) => cmNormal(e.nome)));
  const decks = [...new Set((cards || []).map((c) => String(c.deck || "").trim()).filter(Boolean))];
  if (!decks.length) return false;
  return decks.every((d) => {
    let comps = d.split("::").map((x) => x.trim()).filter(Boolean);
    if (raiz && comps.length > 1 && comps[0] === raiz) comps = comps.slice(1);
    return comps.length >= 3 && nomes.has(cmNormal(comps[0]));
  });
}

function pacRaizComum(cards) {
  const nomes = new Set((cards || []).map((c) => String(c.deck || "").trim()).filter(Boolean));
  if (nomes.size < 2) return "";
  const raizes = new Set([...nomes].map((x) => x.split("::")[0].trim()));
  return raizes.size === 1 ? [...raizes][0] : "";
}

/* Uma linha "@ … / pergunta :: resposta :: etiquetas / + …" por cartão importado. */
function pacBlocoImportado(c, ramoId) {
  const tags = (c.ownTags || c.tags || []).map((x) => String(x).replace(/::/g, "_").replace(/\s+/g, "_"));
  /* o subbaralho do ramo vira a etiqueta do ramo (uma só: troca a que já vier) */
  if (ramoId) { for (let i = tags.length - 1; i >= 0; i--) if (/^ram_/i.test(tags[i])) tags.splice(i, 1); tags.push("ram_" + ramoId); }
  const limpo = Object.assign({}, c, {
    front: cmCampo(c.front), back: cmCampo(c.back), titulo: cmCampo(c.titulo),
    more: String(c.more || "").split(/<br\s*\/?>|\r?\n/i).map(cmCampo).filter(Boolean).join("<br>"),
    tags, ownTags: tags,
  });
  return cardToLine(limpo);
}

/* Grava os cartões no material. modo "decks": um tópico por baralho do pacote;
 * modo "topico": todos em `destChave`. Pergunta que o destino já tem não entra
 * de novo. Devolve { novos, repetidos, topicos }. */
function pacImportar(cards, modo, destChave, comEdital) {
  const raiz = pacRaizComum(cards);
  const antes = {};
  const r = { novos: 0, repetidos: 0, topicos: 0 };
  const tocados = new Set();
  const frentes = {};
  (cards || []).forEach((c) => {
    let ch, disc, top, edital = "", ramoId = "";
    if (modo === "topico") {
      const d = matResumos[destChave];
      if (!d) return;
      ch = destChave; disc = d.disciplina; top = d.topico;
    } else {
      const s = pacSepararDeck(c.deck, raiz, comEdital);
      disc = s.disciplina; top = s.topico; edital = s.edital || "";
      const rr = pacResolverRamo(edital, disc, top);
      if (rr) { top = rr.topico; ramoId = rr.ramoId; }
      ch = matChaveViva(disc, top);
    }
    if (!(ch in antes)) antes[ch] = gerTexto(ch);
    if (!frentes[ch]) {
      frentes[ch] = new Set(gerTexto(ch).split("\n").filter((l) => !/^\s*[@+*]/.test(l)).map((l) => cmNormal(l.split("::")[0])).filter(Boolean));
    }
    const chaveFrente = cmNormal(cmCampo(c.front));
    if (frentes[ch].has(chaveFrente)) { r.repetidos++; return; }
    frentes[ch].add(chaveFrente);
    const at = gerTexto(ch).replace(/\s*$/, "");
    const meta = { disciplina: disc, topico: top };
    /* o edital só entra em tópico que ainda não tem dono (igual ao mover do gerenciador) */
    if (edital && !(matResumos[ch] || {}).concurso) {
      const ed = (typeof editais !== "undefined" ? editais : []).find((e) => cmNormal(e.nome) === cmNormal(edital));
      meta.concurso = ed ? ed.nome : edital;
    }
    matGravarCartoes(ch, (at ? at + "\n\n" : "") + pacBlocoImportado(c, ramoId), meta);
    tocados.add(ch); r.novos++;
  });
  r.topicos = tocados.size;
  gerRegistrar(antes);
  try { matReg("cartoes", "pacote importado", r.novos + " novos, " + r.repetidos + " repetidos, " + r.topicos + " tópico(s)"); } catch (e) {}
  return r;
}

/* ---- a tela ---- */
let pacNotas = [], pacSel = new Set(), pacLido = null;
let pacEditalDe = new Map();   /* chave do tópico marcado → edital sob o qual foi marcado (pasta de cima no Anki) */
let pacInfo = new Map();       /* chave → { edital, disciplina, topico } dos tópicos SEM cartão (os do plano do edital) */

/* Explicação de cada botão/opção desta janela (o teste confere que nenhum fica de fora). */
const PAC_DICAS = {
  btnPacTudo: "pac_tip_tudo", btnPacLimpar: "pac_tip_limpar", btnPacApkg: "pac_tip_apkg", btnPacTxt: "pac_tip_txt",
  btnPacImportar: "pac_tip_importar", btnPacFechar: "pac_tip_fechar", pacComEdital: "pac_tip_com_edital",
  pacVazios: "pac_tip_vazios", pacRamos: "pac_tip_ramos", pacImpComEdital: "pac_tip_imp_com_edital", pacSemRep: "pac_tip_sem_rep", pacSemFracos: "pac_tip_sem_fracos",
};

function pacEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function pacTemEditais() { return typeof editais !== "undefined" && Array.isArray(editais) && editais.length > 0; }

function pacOpcoes() {
  return { semRepetidos: $("pacSemRep").checked, semFracos: $("pacSemFracos").checked,
    comEdital: $("pacComEdital").checked, comRamos: $("pacRamos").checked, vazios: $("pacVazios").checked && pacTemEditais(), editalDe: pacEditalDe, info: pacInfo };
}

/* marcar/desmarcar UM tópico (guardando de qual edital ele foi marcado) */
function pacMarcar(chave, ligar, edital) {
  if (ligar) { pacSel.add(chave); if (!pacEditalDe.has(chave)) pacEditalDe.set(chave, edital || ""); }
  else { pacSel.delete(chave); pacEditalDe.delete(chave); }
}

/* a árvore por edital: Edital › Disciplina › Tópico, com caixa de três estados (marcado / parcial / vazio) */
function pacPintarNo(cx, no, edital) {
  if (no.tipo === "top") {
    const li = pacEl("label", "pac-top pac-ed-top" + (no.vazia ? " ger-vazia" : ""));
    const c2 = pacEl("input"); c2.type = "checkbox"; c2.checked = pacSel.has(no.chave);
    c2.onchange = () => { pacMarcar(no.chave, c2.checked, edital); pacPintar(); };
    li.append(c2, pacEl("span", "", " " + no.topico + " (" + no.total + ")"));
    cx.append(li);
    return;
  }
  const chaves = [...no.chaves];
  const marcadas = chaves.filter((c) => pacSel.has(c)).length;
  const cab = pacEl("label", no.tipo === "disc" ? "pac-disc pac-ed-disc" : "pac-disc pac-ed-raiz");
  const ck = pacEl("input"); ck.type = "checkbox";
  ck.checked = chaves.length > 0 && marcadas === chaves.length;
  ck.indeterminate = marcadas > 0 && marcadas < chaves.length;
  ck.onchange = () => { chaves.forEach((c) => pacMarcar(c, ck.checked, no.tipo === "bancada" ? "" : edital)); pacPintar(); };
  cab.append(ck, pacEl("span", "", " " + no.nome + " (" + no.total + ")"));
  cx.append(cab);
  no.filhos.forEach((f) => pacPintarNo(cx, f, edital));
}

function pacPintarArvore() {
  const cx = $("pacArvore");
  cx.innerHTML = "";
  $("pacOpcEdital").hidden = !pacTemEditais();
  pacInfo = new Map();
  if (pacTemEditais()) {
    const m = gerModeloEditais(pacNotas, gerPastasVazias(pacNotas));
    m.roots.forEach((r) => {
      r.filhos.forEach((d) => (d.tipo === "disc" ? d.filhos : [d]).forEach((tp) => {
        if (tp.vazia && !pacInfo.has(tp.chave)) pacInfo.set(tp.chave, { edital: r.tipo === "edital" ? r.concurso : "", disciplina: d.tipo === "disc" ? d.nome : "", topico: tp.topico });
      }));
      pacPintarNo(cx, r, r.tipo === "edital" ? r.concurso : "");
    });
    return;
  }
  gerArvore(pacNotas).forEach((d) => {
    const chaves = d.topicos.map((x) => x.chave);
    const cab = pacEl("label", "pac-disc");
    const ck = pacEl("input"); ck.type = "checkbox";
    ck.checked = chaves.every((c) => pacSel.has(c));
    ck.onchange = () => { chaves.forEach((c) => (ck.checked ? pacSel.add(c) : pacSel.delete(c))); pacPintar(); };
    cab.append(ck, pacEl("span", "", " " + d.disciplina + " (" + d.total + ")"));
    cx.append(cab);
    d.topicos.forEach((tp) => {
      const li = pacEl("label", "pac-top");
      const c2 = pacEl("input"); c2.type = "checkbox"; c2.checked = pacSel.has(tp.chave);
      c2.onchange = () => { c2.checked ? pacSel.add(tp.chave) : pacSel.delete(tp.chave); pacPintar(); };
      li.append(c2, pacEl("span", "", " " + tp.topico + " (" + tp.total + ")"));
      cx.append(li);
    });
  });
}

function pacPintarPrevia() {
  const p = pacMontar(pacNotas, pacSel, pacOpcoes());
  $("pacPrevia").textContent = p.itens.length || p.vazios.length
    ? t("pac_previa", { n: p.itens.length, k: p.decks.size, r: p.ignRep, f: p.ignFracos }) + (p.vazios.length ? " " + t("pac_previa_vazios", { v: p.vazios.length }) : "")
    : t("pac_previa_vazia");
  const cx = $("pacDecks");
  cx.innerHTML = "";
  [...p.decks.entries()].slice(0, 12).forEach(([d, n]) => cx.append(pacEl("div", "cq-onde", d.replace(/::/g, " › ") + " — " + n)));
  if (p.decks.size > 12) cx.append(pacEl("div", "cq-onde", t("pac_mais_decks", { n: p.decks.size - 12 })));
  $("btnPacApkg").disabled = !(p.itens.length || p.vazios.length);
  $("btnPacTxt").disabled = !p.itens.length;
  return p;
}

function pacPintar() { pacPintarArvore(); pacPintarPrevia(); }

/* deps: só para teste (o padrão usa o buildApkg e a entrega do app). */
async function pacExportar(formato, deps) {
  const d = deps || {};
  const construir = d.construir || buildApkg;
  const entrega = d.entregar || entregar;
  const p = pacMontar(pacNotas, pacSel, pacOpcoes());
  if (!p.itens.length && !(formato !== "txt" && p.vazios.length)) return { ok: false };
  const raiz = String($("pacNome").value || "").trim() || "EasyAnkiCards";
  const comEdital = $("pacComEdital").checked;
  const cards = pacCartoes(p.itens, comEdital, $("pacRamos").checked);
  try {
    if (formato === "txt") {
      const txt = exportTxtString({ cards }, raiz);
      await entrega(new TextEncoder().encode(txt), pacNomeArquivo(raiz) + ".txt", "text/plain");
    } else {
      const bytes = await construir(cards, raiz, $("selEstilo").value, "", $("selAlinha").value, p.vazios);
      await entrega(bytes, pacNomeArquivo(raiz) + "." + "apkg", "application/octet-stream");
    }
    $("pacMsg").textContent = t("pac_feito", { f: pacNomeArquivo(raiz) + "." + (formato === "txt" ? "txt" : "apkg"), n: p.itens.length, k: p.decks.size });
    try { reg("EXPORTAR", pacNomeArquivo(raiz) + "." + formato, p.itens.length + " cartões em " + p.decks.size + " baralhos (montador de pacote)"); } catch (e) {}
    return { ok: true, n: p.itens.length, k: p.decks.size };
  } catch (e) {
    $("pacMsg").textContent = t("pac_erro", { e: String(e && e.message || e) });
    return { ok: false, erro: e };
  }
}

/* importar */
function pacPintarImport() {
  const l = pacLido;
  $("pacImpCx").hidden = !l;
  if (!l) return;
  const decks = new Set(l.cards.map((c) => c.deck || ""));
  $("pacImpResumo").textContent = t("pac_import_lido", { n: l.cards.length, k: decks.size, d: pacRaizComum(l.cards) || l.deck || "—" });
  $("btnPacImportar").disabled = !l.cards.length;
  /* pacote que já veio com a pasta do edital: a caixa nasce ligada */
  $("pacImpComEdital").checked = pacDetectarEdital(l.cards);
  $("pacImpEditalCx").hidden = !pacTemEditais() && !$("pacImpComEdital").checked;
}

function pacPintarDestinos() {
  const sel = $("pacImpDestino");
  sel.innerHTML = "";
  Object.keys(matResumos).map((ch) => ({ ch, r: matResumos[ch] })).filter((x) => x.r && (x.r.disciplina || x.r.topico))
    .sort((a, b) => String((a.r.disciplina || "") + (a.r.topico || "")).localeCompare(String((b.r.disciplina || "") + (b.r.topico || "")), "pt"))
    .forEach((x) => {
      const o = document.createElement("option");
      o.value = x.ch; o.textContent = [x.r.disciplina, x.r.topico].filter(Boolean).join(" › ");
      sel.append(o);
    });
}

async function pacLerArquivo(arq, deps) {
  if (!arq) return null;
  try {
    const ler = (deps && deps.ler) || lerApkg;
    const buf = deps && deps.ler ? arq : await arq.arrayBuffer();
    pacLido = await ler(buf);
    pacPintarImport();
    $("pacMsg").textContent = "";
    return pacLido;
  } catch (e) {
    pacLido = null; pacPintarImport();
    $("pacMsg").textContent = t("pac_import_erro", { e: String(e && e.message || e) });
    return null;
  }
}

async function pacAcaoImportar() {
  if (!pacLido || !pacLido.cards.length) return;
  const modo = $("pacModoTopico").checked ? "topico" : "decks";
  const dest = $("pacImpDestino").value;
  if (modo === "topico" && !dest) { uiAlert(t("pac_sem_destino")); return; }
  if (!(await uiConfirm(t(modo === "topico" ? "pac_conf_topico" : "pac_conf_decks", { n: pacLido.cards.length })))) return;
  const r = pacImportar(pacLido.cards, modo, dest, $("pacImpComEdital").checked);
  pacLido = null; pacPintarImport();
  pacNotas = cqLerBiblioteca(); pacPintarDestinos(); pacPintar();
  try { matRender(); } catch (e) {}
  $("pacMsg").textContent = t("pac_import_feito", { n: r.novos, m: r.repetidos, k: r.topicos });
}

/* opc.chaves / opc.edital: já abre com essas pastas marcadas (é o que "Exportar esta pasta" da biblioteca faz) */
function pacAbrir(opc) {
  pacNotas = cqLerBiblioteca();
  pacSel = new Set(); pacEditalDe = new Map();
  ((opc && opc.chaves) || []).forEach((c) => pacMarcar(c, true, (opc && opc.edital) || ""));
  $("pacComEdital").checked = pacTemEditais();
  $("pacVazios").checked = false;
  dicasDosBotoes(PAC_DICAS);
  pacLido = null;
  try { $("pacNome").value = (typeof nomeDeck === "function" && nomeDeck()) || "EasyAnkiCards"; } catch (e) { $("pacNome").value = "EasyAnkiCards"; }
  $("pacMsg").textContent = "";
  pacPintarDestinos(); pacPintarImport(); pacPintar();
  abrirModal("dlgPacote");
  try { matReg("cartoes", "montador de pacote aberto", pacNotas.length + " cartões"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnPacote")) {
  $("btnPacote").onclick = pacAbrir;
  $("btnPacFechar").onclick = () => $("dlgPacote").close();
  $("btnPacTudo").onclick = () => {
    pacSel = new Set(); pacEditalDe = new Map();
    if (pacTemEditais()) gerModeloEditais(pacNotas, gerPastasVazias(pacNotas)).roots.forEach((r) => [...r.chaves].forEach((c) => pacMarcar(c, true, r.tipo === "edital" ? r.concurso : "")));
    else pacNotas.forEach((n) => pacMarcar(n.chave, true, ""));
    pacPintar();
  };
  $("btnPacLimpar").onclick = () => { pacSel = new Set(); pacEditalDe = new Map(); pacPintar(); };
  $("pacComEdital").onchange = pacPintarPrevia;
  $("pacVazios").onchange = pacPintarPrevia;
  $("pacSemRep").onchange = pacPintarPrevia;
  $("pacRamos").onchange = pacPintarPrevia;
  $("pacSemFracos").onchange = pacPintarPrevia;
  $("btnPacApkg").onclick = () => pacExportar("apkg");
  $("btnPacTxt").onclick = () => pacExportar("txt");
  $("pacArquivo").onchange = () => pacLerArquivo($("pacArquivo").files && $("pacArquivo").files[0]);
  $("btnPacImportar").onclick = pacAcaoImportar;
}
