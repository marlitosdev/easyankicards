/* ===================================================================
 * PACOTE .apkg — O MOTOR DE MONTAR + IMPORTAR PARA UMA PASTA
 *
 * Até a B4a (fusão com a Biblioteca de cartões), este arquivo também tinha
 * a TELA de "Montar pacote" (árvore, lista, arrastar, opções, exportar).
 * Essa tela virou o modo "Montar pacote" de `docs/gerenciador.js`
 * (`#dlgGerCartoes`), que reaproveita a árvore/lista/arrastar DELA (mais
 * madura) — aqui ficou só o MOTOR puro que ela chama: `pacMontar`/
 * `pacCartoes` (monta a lista de cartões + o baralho de cada um, a partir
 * de QUALQUER árvore/seleção, não só a própria), `pacNomeDeck`,
 * `pacChaveCartao`, `pacRamoDoCartao`, `pacResolverRamo`, `pacNomeArquivo`.
 *
 * A outra metade do arquivo — "Importar .apkg para uma pasta" — é um
 * recurso À PARTE (não tem nada a ver com a fusão) e continua com tela
 * própria (`#dlgPacote`, aberto por `#btnPacoteImportar`): um .apkg do
 * Anki entra numa pasta escolhida, ou vira uma pasta por baralho (sem a
 * raiz comum), sem perder o baralho de cada cartão; vai para a lista de
 * "desfazer" do gerenciador.
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

/* Identidade de UM cartão nesta exportação (não persiste, não é usada fora daqui): a nota não
 * tem id próprio, mas a chave do tópico + a linha do cartão no texto já identificam um cartão
 * de forma única dentro de uma sessão do diálogo (a mesma linha que `irParaLinha` usa). */
function pacChaveCartao(n) { return n.chave + "|" + n.card.line; }

/* O baralho de uma nota. A Bancada (o texto do editor) cai DIRETO no baralho raiz — era o que o "Exportar" do
 * rodape da bancada sempre fez, e os cartoes com "@ titulo" seguem virando subbaralho la' dentro (buildApkg).
 * Se a pessoa arrastou a Bancada para outra pasta (mov), vale o destino dela. */
function pacDeckDaNota(n, mov, comEdital, ramo) {
  if (!mov && n.chave === CQ_BANCADA) return "";
  return pacNomeDeck(mov ? Object.assign({}, n, mov) : n, comEdital, ramo);
}

/* O que entra no pacote: as notas das pastas marcadas, menos (opcionalmente)
 * os repetidos — fica o mais completo de cada grupo — e os abaixo do padrão. */
function pacMontar(notas, sel, opc) {
  const o = opc || {};
  /* arrastar um tópico na árvore (pacMoverPara) muda para ONDE ele vai no Anki nesta exportação;
   * arrastar um CARTÃO da lista (pacCartaoMoverPara) separa só ele dos irmãos — tem prioridade
   * sobre o arrasto do tópico. Nenhum dos dois grava nada na Biblioteca. */
  const moverPara = o.moverPara || new Map();
  const cartaoMoverPara = o.cartaoMoverPara || new Map();
  const nomeDeck = (n) => {
    const mov = cartaoMoverPara.get(pacChaveCartao(n)) || moverPara.get(n.chave);
    return pacDeckDaNota(n, mov, o.comEdital, o.comRamos ? pacRamoDoCartao(n) : "");
  };
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
      const mov = moverPara.get(ch);
      const base = mov || { edital: editalDe.get(ch) || i.edital || "", disciplina: i.disciplina, topico: i.topico };
      const nome = pacNomeDeck(base, o.comEdital);
      if (!decks.has(nome)) { decks.set(nome, 0); vazios.push(nome); }
    });
  }
  return { itens, ignRep, ignFracos, decks, vazios };
}

/* Os cartões como o buildApkg / exportTxtString os querem: com o baralho da pasta (já
 * considerando um eventual arrasto desta exportação — do cartão, com prioridade, ou do tópico). */
function pacCartoes(itens, comEdital, comRamos, moverPara, cartaoMoverPara) {
  const mp = moverPara || new Map();
  const cmp = cartaoMoverPara || new Map();
  return (itens || []).map((n) => {
    const mov = cmp.get(pacChaveCartao(n)) || mp.get(n.chave);
    return Object.assign({}, n.card, { deck: pacDeckDaNota(n, mov, comEdital, comRamos ? pacRamoDoCartao(n) : ""), tags: (n.card.tags || []).slice() });
  });
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

/* ---- a tela (só "Importar .apkg"; "Montar pacote" virou o modo exportação
 * da Biblioteca, docs/gerenciador.js — Fusão B1-B4a) ---- */
let pacLido = null;

/* Explicação de cada botão/opção desta janela (o teste confere que nenhum fica de fora). */
const PAC_DICAS = {
  btnPacImportar: "pac_tip_importar", btnPacFechar: "pac_tip_fechar", pacImpComEdital: "pac_tip_imp_com_edital",
};

function pacTemEditais() { return typeof editais !== "undefined" && Array.isArray(editais) && editais.length > 0; }

/* ---- importar ---- */
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
  pacPintarDestinos();
  try { matRender(); } catch (e) {}
  $("pacMsg").textContent = t("pac_import_feito", { n: r.novos, m: r.repetidos, k: r.topicos });
}

function pacAbrir() {
  pacLido = null;
  dicasDosBotoes(PAC_DICAS);
  $("pacMsg").textContent = "";
  pacPintarDestinos(); pacPintarImport();
  abrirModal("dlgPacote");
  try { matReg("cartoes", "importar .apkg aberto", ""); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnPacFechar")) {
  $("btnPacFechar").onclick = () => $("dlgPacote").close();
  $("pacArquivo").onchange = () => pacLerArquivo($("pacArquivo").files && $("pacArquivo").files[0]);
  $("btnPacImportar").onclick = pacAcaoImportar;
  if ($("btnPacoteImportar")) $("btnPacoteImportar").onclick = pacAbrir;
}
