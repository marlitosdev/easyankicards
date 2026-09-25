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
function pacNomeDeck(n) {
  const limpa = (s) => String(s || "").replace(/\s*::\s*/g, " — ").replace(/\s+/g, " ").trim();
  const d = limpa(n.disciplina), t2 = limpa(n.topico);
  return [d, t2].filter(Boolean).join("::") || "Sem pasta";
}

/* O que entra no pacote: as notas das pastas marcadas, menos (opcionalmente)
 * os repetidos — fica o mais completo de cada grupo — e os abaixo do padrão. */
function pacMontar(notas, sel, opc) {
  const o = opc || {};
  const marcadas = (notas || []).filter((n) => sel && sel.has(n.chave));
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
  itens.forEach((n) => { const d = pacNomeDeck(n); decks.set(d, (decks.get(d) || 0) + 1); });
  return { itens, ignRep, ignFracos, decks };
}

/* Os cartões como o buildApkg / exportTxtString os querem: com o baralho da pasta. */
function pacCartoes(itens) {
  return (itens || []).map((n) => Object.assign({}, n.card, { deck: pacNomeDeck(n), tags: (n.card.tags || []).slice() }));
}

/* Nome de arquivo seguro para o pacote. */
function pacNomeArquivo(raiz) {
  const s = String(raiz || "").replace(/::/g, " - ").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return s || "EasyAnkiCards";
}

/* ---- importar ---- */

/* "A::B::C" -> disciplina "A", tópico "B › C". Com raiz comum (o pacote foi
 * exportado por aqui, ou é um baralho-mãe), a raiz sai. */
function pacSepararDeck(nome, raizComum) {
  let comps = String(nome || "").split("::").map((x) => x.trim()).filter(Boolean);
  if (raizComum && comps.length > 1 && comps[0] === raizComum) comps = comps.slice(1);
  if (!comps.length) return { disciplina: "Importados", topico: "Sem baralho" };
  return { disciplina: comps[0], topico: comps.slice(1).join(" › ") || "Geral" };
}

function pacRaizComum(cards) {
  const nomes = new Set((cards || []).map((c) => String(c.deck || "").trim()).filter(Boolean));
  if (nomes.size < 2) return "";
  const raizes = new Set([...nomes].map((x) => x.split("::")[0].trim()));
  return raizes.size === 1 ? [...raizes][0] : "";
}

/* Uma linha "@ … / pergunta :: resposta :: etiquetas / + …" por cartão importado. */
function pacBlocoImportado(c) {
  const tags = (c.ownTags || c.tags || []).map((x) => String(x).replace(/::/g, "_").replace(/\s+/g, "_"));
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
function pacImportar(cards, modo, destChave) {
  const raiz = pacRaizComum(cards);
  const antes = {};
  const r = { novos: 0, repetidos: 0, topicos: 0 };
  const tocados = new Set();
  const frentes = {};
  (cards || []).forEach((c) => {
    let ch, disc, top;
    if (modo === "topico") {
      const d = matResumos[destChave];
      if (!d) return;
      ch = destChave; disc = d.disciplina; top = d.topico;
    } else {
      const s = pacSepararDeck(c.deck, raiz);
      disc = s.disciplina; top = s.topico; ch = matChave(disc, top);
    }
    if (!(ch in antes)) antes[ch] = gerTexto(ch);
    if (!frentes[ch]) {
      frentes[ch] = new Set(gerTexto(ch).split("\n").filter((l) => !/^\s*[@+*]/.test(l)).map((l) => cmNormal(l.split("::")[0])).filter(Boolean));
    }
    const chaveFrente = cmNormal(cmCampo(c.front));
    if (frentes[ch].has(chaveFrente)) { r.repetidos++; return; }
    frentes[ch].add(chaveFrente);
    const at = gerTexto(ch).replace(/\s*$/, "");
    matGravarCartoes(ch, (at ? at + "\n\n" : "") + pacBlocoImportado(c), { disciplina: disc, topico: top });
    tocados.add(ch); r.novos++;
  });
  r.topicos = tocados.size;
  gerRegistrar(antes);
  try { matReg("cartoes", "pacote importado", r.novos + " novos, " + r.repetidos + " repetidos, " + r.topicos + " tópico(s)"); } catch (e) {}
  return r;
}

/* ---- a tela ---- */
let pacNotas = [], pacSel = new Set(), pacLido = null;

function pacEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function pacOpcoes() { return { semRepetidos: $("pacSemRep").checked, semFracos: $("pacSemFracos").checked }; }

function pacPintarArvore() {
  const cx = $("pacArvore");
  cx.innerHTML = "";
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
  $("pacPrevia").textContent = p.itens.length
    ? t("pac_previa", { n: p.itens.length, k: p.decks.size, r: p.ignRep, f: p.ignFracos })
    : t("pac_previa_vazia");
  const cx = $("pacDecks");
  cx.innerHTML = "";
  [...p.decks.entries()].slice(0, 12).forEach(([d, n]) => cx.append(pacEl("div", "cq-onde", d.replace(/::/g, " › ") + " — " + n)));
  if (p.decks.size > 12) cx.append(pacEl("div", "cq-onde", t("pac_mais_decks", { n: p.decks.size - 12 })));
  $("btnPacApkg").disabled = !p.itens.length;
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
  if (!p.itens.length) return { ok: false };
  const raiz = String($("pacNome").value || "").trim() || "EasyAnkiCards";
  const cards = pacCartoes(p.itens);
  try {
    if (formato === "txt") {
      const txt = exportTxtString({ cards }, raiz);
      await entrega(new TextEncoder().encode(txt), pacNomeArquivo(raiz) + ".txt", "text/plain");
    } else {
      const bytes = await construir(cards, raiz, $("selEstilo").value, "", $("selAlinha").value);
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
  const r = pacImportar(pacLido.cards, modo, dest);
  pacLido = null; pacPintarImport();
  pacNotas = cqLerBiblioteca(); pacPintarDestinos(); pacPintar();
  try { matRender(); } catch (e) {}
  $("pacMsg").textContent = t("pac_import_feito", { n: r.novos, m: r.repetidos, k: r.topicos });
}

function pacAbrir() {
  pacNotas = cqLerBiblioteca();
  pacSel = new Set();
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
  $("btnPacTudo").onclick = () => { pacSel = new Set(pacNotas.map((n) => n.chave)); pacPintar(); };
  $("btnPacLimpar").onclick = () => { pacSel = new Set(); pacPintar(); };
  $("pacSemRep").onchange = pacPintarPrevia;
  $("pacSemFracos").onchange = pacPintarPrevia;
  $("btnPacApkg").onclick = () => pacExportar("apkg");
  $("btnPacTxt").onclick = () => pacExportar("txt");
  $("pacArquivo").onchange = () => pacLerArquivo($("pacArquivo").files && $("pacArquivo").files[0]);
  $("btnPacImportar").onclick = pacAcaoImportar;
}
