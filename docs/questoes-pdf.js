/* =====================================================================
 * QUESTÕES PRONTAS, DIRETO DO PDF (19.120.0)
 *
 * POR QUÊ: a aula em PDF já traz as questões prontas — enunciado, alternativas, o comentário do professor e a tabela
 * de gabarito no fim. Para estudá-las aqui era preciso copiar uma a uma (o PDF quebra as linhas, repete o cabeçalho
 * em cada página e separa o gabarito da questão) ou pedir a uma IA que as reescrevesse.
 *
 * O QUE SE MEDIU no PDF real (aula de 84 páginas, 16 questões): toda questão começa por "N. (origem)", tem as
 * alternativas a)–e), um bloco "Comentários:" e aparece DUAS vezes (comentada e, depois, na "Lista de questões"); o
 * gabarito está numa tabela no fim ("1. B   11. C") e também dentro do comentário ("A letra B está correta",
 * "Gabarito: letra C") — nas 16, os dois conferem. Cada página repete o cabeçalho do curso (com o número da página
 * enfiado no meio do texto: "Pó6s4-Edital") e a MARCA DO COMPRADOR (CPF e nome).
 *
 * COMO: sem IA. As linhas de cada página (o mesmo leitor de PDF das leis) passam por uma limpeza — cabeçalho e
 * rodapé repetidos, marca do comprador, caracteres invisíveis — e viram questões pelo formato. O gabarito é lido de
 * DOIS lugares e conferido: a tabela e o comentário; quando divergem, a questão sai marcada "a conferir". O
 * resultado é o MESMO texto que a criação de questões já lê ([QUESTAO] … [/QUESTAO]): a conferência, as repetidas e
 * o "Criadas em" seguem o caminho de sempre, e nada é gravado antes de a pessoa confirmar.
 *
 * A MARCA DO COMPRADOR NUNCA É GRAVADA: a linha com CPF sai na limpeza, esteja onde estiver.
 * ===================================================================== */

/* uma linha que é a marca do comprador: "00000000000 - Fulano de Tal" ou "000.000.000-00 - …" (CPF e nome) */
const QS_PDF_MARCA_RE = /^\s*(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})\s*[-–—]\s*\S/;

function qsPdfNormal(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/* AS LINHAS LIMPAS: tira a marca do comprador, os invisíveis e o cabeçalho/rodapé — a linha que se repete (sem contar
 * os números: a página vem enfiada no texto) no alto ou no pé de pelo menos 40% das páginas, e a que é só o número da
 * página. O PDF real tem SEIS linhas de rodapé (curso, site, marca, "73", "85", "==1c069=="): por isso a limpeza
 * descasca a página pelas pontas, linha a linha, enquanto a linha for dessas — sem tamanho fixo de cabeçalho. */
function qsPdfLimpar(paginas) {
  const pgs = (paginas || []).map((p) => (p || []).map((l) => (typeof semInvisiveis === "function" ? semInvisiveis(l) : String(l || "")).replace(/\s+/g, " ").trim()).filter(Boolean));
  let marcas = 0;
  const semMarca = pgs.map((p) => p.filter((l) => { if (QS_PDF_MARCA_RE.test(l)) { marcas++; return false; } return true; }));
  const chave = (l) => qsPdfNormal(l).replace(/[\d\s]/g, "");
  const BORDA = 8;
  const conta = new Map();
  semMarca.forEach((p) => {
    const vistos = new Set();
    p.forEach((l, k) => {
      if (k >= BORDA && k < p.length - BORDA) return;
      const c = chave(l);
      if (c.length < 3 || vistos.has(c)) return;
      vistos.add(c);
      conta.set(c, (conta.get(c) || 0) + 1);
    });
  });
  const minimo = Math.max(3, Math.ceil(semMarca.length * 0.4));
  /* o código de marca d'água ("==1c069=="): aparece solto no meio do texto, em poucas páginas — não chega a "repetida" */
  const repetida = (l) => (conta.get(chave(l)) || 0) >= minimo || /^=+\s*[0-9a-z]{3,16}\s*=+$/i.test(l);
  const soNumero = (l) => /^\d{1,4}$/.test(l);
  const linhas = [];
  const porPagina = [];      /* (19.124.0) as mesmas linhas limpas, página a página (cobertura-fonte.js) */
  let cabecalhos = 0;
  semMarca.forEach((p) => {
    /* a linha repetida sai ONDE ESTIVER: numa página do PDF real o bloco de cabeçalho e rodapé vem no meio do texto
     * (a ordem em que o PDF guarda os pedaços não é a da leitura) e entrava num comentário */
    const fora = p.map(repetida);
    /* o número da página: grudado numa linha repetida ("73", "85" depois do site), ou nas pontas da página */
    for (let k = 1; k < p.length; k++) if (!fora[k] && soNumero(p[k]) && fora[k - 1]) fora[k] = true;
    for (let k = p.length - 2; k >= 0; k--) if (!fora[k] && soNumero(p[k]) && fora[k + 1]) fora[k] = true;
    for (let i = 0; i < p.length && (fora[i] || soNumero(p[i])); i++) fora[i] = true;
    for (let j = p.length - 1; j >= 0 && (fora[j] || soNumero(p[j])); j--) fora[j] = true;
    const desta = [];
    p.forEach((l, k) => { if (fora[k]) cabecalhos++; else { linhas.push(l); desta.push(l); } });
    porPagina.push(desta);
  });
  return { linhas, porPagina, marcas, cabecalhos, paginas: pgs.length };
}

const QS_PDF_INICIO_RE = /^(?:quest[ãa]o\s+)?(\d{1,3})\s*[.)\-–:]?\s*\(([^)]{2,140})\)\s*(.*)$/i;
const QS_PDF_OPCAO_RE = /^\(?([a-eA-E])\s*\)\s*(.*)$/;
const QS_PDF_COMENT_RE = /^coment[áa]rios?\s*:?\s*(.*)$/i;
const QS_PDF_SECAO_RE = /^(quest[õo]es\s+comentadas|lista\s+de\s+quest[õo]es|gabaritos?)(?:\s*[-–:].*)?$/i;

/* "Certo"/"Errado" (e as letras) → a letra do gabarito */
function qsPdfLetra(v) {
  const n = qsPdfNormal(v).trim();
  if (/^(certo|certa|correto|correta|verdadeiro)$/.test(n)) return "C";
  if (/^(errado|errada|incorreto|incorreta|falso)$/.test(n)) return "E";
  return /^[a-e]$/.test(n) ? n.toUpperCase() : "";
}

/* o gabarito que o COMENTÁRIO diz — só quando ele diz um só */
function qsPdfGabaritoDoComentario(com, ehCE) {
  const s = String(com || "");
  const achados = new Set();
  let m;
  const g = /gabarito\s*(?:oficial|definitivo|preliminar)?\s*[:\-–]?\s*(?:[ée]\s+a?\s*)?(?:letra|alternativa|item)?\s*["“(]?\s*(certo|errado|correto|incorreto|[A-E])\b/gi;
  while ((m = g.exec(s)) !== null) { const l = qsPdfLetra(m[1]); if (l) achados.add(l); }
  if (achados.size === 1) return [...achados][0];
  if (achados.size > 1) return "";
  if (ehCE) {
    const c = /\b(?:item|quest[ãa]o|assertiva|afirmativa)\s+(certo|errado|correto|correta|incorreto|incorreta|errada|certa)\b/gi;
    while ((m = c.exec(s)) !== null) { const l = qsPdfLetra(m[1]); if (l) achados.add(l); }
    return achados.size === 1 ? [...achados][0] : "";
  }
  const c2 = /(?:letra|alternativa)\s+["“(]?([A-E])["”)]?\s+(?:est[áa]|[ée]\s+a)\s+corret/gi;
  while ((m = c2.exec(s)) !== null) achados.add(m[1].toUpperCase());
  return achados.size === 1 ? [...achados][0] : "";
}

/* junta as linhas quebradas pelo PDF; parágrafo novo só onde o texto pede (item de lista, "A letra B…", "Gabarito…") */
function qsPdfJuntar(linhas, novoPar) {
  const out = [];
  (linhas || []).forEach((l) => {
    if (!out.length || novoPar.test(l)) out.push(l);
    else out[out.length - 1] += " " + l;
  });
  return out;
}
const QS_PDF_PAR_ENUN = /^(?:(?:I{1,3}|IV|VI{0,3}|IX|X)\s*[-–.)]|[•▪·]|[-–]\s|\d{1,2}\s*[.)]\s)/;
const QS_PDF_PAR_COM = /^(?:a\s+(?:letra|alternativa|assertiva|afirmativa)\b|letra\s+[a-e]\b|alternativa\s+[a-e]\b|item\s+(?:[ivx]+|\d+)\b|gabarito\b|portanto\b|logo,|assim,|(?:I{1,3}|IV|VI{0,3}|IX|X)\s*[-–.)])/i;

/* AS QUESTÕES das linhas limpas: [{ n, origem, enunciado[], opcoes[{letra,txt}], comentario[], gabTabela, gabComentario,
 * gabarito, tipo, situacao }]. As duas cópias da mesma questão (comentada e na lista) viram uma: a que tem comentário. */
function qsPdfQuestoes(linhas) {
  const todas = [];
  let bloco = [];          /* as questões desde a última tabela de gabarito */
  let q = null, parte = "";
  let naTabela = false;
  const tabela = {};
  const fechaTabela = () => {
    if (!Object.keys(tabela).length) return;
    bloco.forEach((x) => { if (tabela[x.n] && !x.gabTabela) x.gabTabela = tabela[x.n]; });
    Object.keys(tabela).forEach((k) => delete tabela[k]);
    bloco = [];
  };
  (linhas || []).forEach((l) => {
    let sec = l.match(QS_PDF_SECAO_RE);
    /* "Gabarito: Errado" / "Gabarito - letra C" é a RESPOSTA de uma questão, dentro do comentário — não o título da
     * tabela de gabarito */
    if (sec && /^gabarito/i.test(sec[1]) && /^gabaritos?\s*[-–:]\s*(?:letra\s+|alternativa\s+)?["“(]?(?:[a-e]|certo|errado|correto|incorreto|certa|errada)\b/i.test(l)) sec = null;
    if (sec) {
      q = null; parte = "";
      if (/^gabarito/i.test(qsPdfNormal(sec[1]))) naTabela = true;
      else { if (naTabela) fechaTabela(); naTabela = false; }
      return;
    }
    const ini = l.match(QS_PDF_INICIO_RE);
    if (ini) {
      if (naTabela) { fechaTabela(); naTabela = false; }
      q = { n: Number(ini[1]), origem: ini[2].trim(), enunciado: ini[3] ? [ini[3]] : [], opcoes: [], comentario: [], gabTabela: "", gabComentario: "" };
      todas.push(q); bloco.push(q);
      parte = "enunciado";
      return;
    }
    if (naTabela) {
      const re = /(\d{1,3})\s*[.)\-–:]?\s*(?:letra\s+)?(certo|errado|[A-E])(?![A-Za-zÀ-ÿ])/gi;
      let m, algum = false;
      while ((m = re.exec(l)) !== null) { const v = qsPdfLetra(m[2]); if (v) { tabela[Number(m[1])] = v; algum = true; } }
      if (!algum && Object.keys(tabela).length && /[a-zà-ÿ]{4,}/i.test(l)) { fechaTabela(); naTabela = false; }
      return;
    }
    if (!q) return;
    const com = l.match(QS_PDF_COMENT_RE);
    if (com && parte !== "comentario") { parte = "comentario"; if (com[1]) q.comentario.push(com[1]); return; }
    if (parte === "comentario") { q.comentario.push(l); return; }
    const op = l.match(QS_PDF_OPCAO_RE);
    if (op && (q.enunciado.length || q.opcoes.length)) {
      const letra = op[1].toUpperCase();
      /* a sequência manda: depois de "a)" vem "b)" — um "e)" solto no meio do enunciado não é alternativa */
      const espera = "ABCDE"[q.opcoes.length];
      if (letra === espera) { q.opcoes.push({ letra, txt: op[2] }); parte = "opcoes"; return; }
    }
    if (parte === "opcoes" && q.opcoes.length) { const u = q.opcoes[q.opcoes.length - 1]; u.txt = (u.txt ? u.txt + " " : "") + l; return; }
    q.enunciado.push(l);
  });
  if (naTabela) fechaTabela();

  /* as duas cópias: a mesma questão pelo número, pelo enunciado E pela primeira alternativa — só o enunciado não basta
   * ("Sobre o processo legislativo, assinale a alternativa correta:" abre três questões diferentes da aula real);
   * fica a que tem comentário, com o gabarito da outra */
  const porChave = new Map();
  const finais = [];
  const so = (s) => qsPdfNormal(s).replace(/[^a-z0-9]/g, "");
  todas.forEach((x) => {
    const en = so(x.enunciado.join(" "));
    if (!en) return;
    const k = x.n + "|" + en.slice(0, 160) + "|" + so((x.opcoes[0] || {}).txt || "").slice(0, 80);
    const ja = porChave.get(k);
    if (!ja) { porChave.set(k, x); finais.push(x); return; }
    if (!ja.comentario.length && x.comentario.length) ja.comentario = x.comentario;
    if (!ja.opcoes.length && x.opcoes.length) ja.opcoes = x.opcoes;
    if (!ja.gabTabela && x.gabTabela) ja.gabTabela = x.gabTabela;
  });
  finais.forEach((x) => {
    x.tipo = x.opcoes.length >= 2 ? "me" : "ce";
    x.gabComentario = qsPdfGabaritoDoComentario(x.comentario.join("\n"), x.tipo === "ce");
    x.gabarito = x.gabTabela || x.gabComentario;
    x.situacao = !x.gabarito ? "sem_gabarito"
      : (x.gabTabela && x.gabComentario && x.gabTabela !== x.gabComentario) ? "diverge"
      : (x.gabTabela && x.gabComentario) ? "conferido"
      : x.gabTabela ? "so_tabela" : "so_comentario";
  });
  return finais;
}

/* o nome de um campo do formato ("Gabarito:", "Comentário:") escrito no meio do texto abriria um campo novo na leitura:
 * os dois-pontos viram travessão */
function qsPdfSemCampo(s) {
  return String(s || "").replace(/\b(TIPO|RAMO|ASSUNTO|BANCA|ENUNCIADO|GABARITO|COMENT[ÁA]RIOS?)(\s*):/gi, "$1 —")
    .replace(/^\s*([?=]|\[\/?QUEST[ÃA]O\]?)/i, "· $1").replace(/^-{3,}$/, "—");
}

/* as questões → o texto que a criação de questões lê */
function qsPdfTexto(questoes) {
  const blocos = [];
  (questoes || []).forEach((x) => {
    const L = ["[QUESTAO]", "TIPO: " + (x.tipo === "me" ? "ME" : "CE"), "BANCA: " + qsPdfSemCampo(x.origem).slice(0, 80)];
    const en = qsPdfJuntar(x.enunciado, QS_PDF_PAR_ENUN).map(qsPdfSemCampo);
    L.push("ENUNCIADO: " + (en[0] || ""));
    en.slice(1).forEach((l) => L.push(l));
    x.opcoes.forEach((o) => L.push(o.letra + ") " + qsPdfSemCampo(o.txt)));
    if (x.gabarito) L.push("GABARITO: " + x.gabarito);
    const com = qsPdfJuntar(x.comentario, QS_PDF_PAR_COM).map(qsPdfSemCampo);
    if (x.situacao === "diverge") {
      com.unshift(typeof t === "function" ? t("qs_pdf_diverge_com", { a: x.gabTabela, b: x.gabComentario }) : "A conferir: a tabela diz " + x.gabTabela + " e o comentário indica " + x.gabComentario + ".");
    }
    if (com.length) { L.push("COMENTARIO: " + com[0]); com.slice(1).forEach((l) => L.push(l)); }
    L.push("[/QUESTAO]");
    blocos.push(L.join("\n"));
  });
  return blocos.join("\n\n");
}

/* tudo junto: páginas (linhas de texto) → { texto, questoes, resumo } */
function qsPdfExtrair(paginas) {
  const limpo = qsPdfLimpar(paginas);
  const questoes = qsPdfQuestoes(limpo.linhas);
  const conta = (s) => questoes.filter((x) => x.situacao === s).length;
  return {
    texto: qsPdfTexto(questoes), questoes,
    resumo: {
      paginas: limpo.paginas, marcas: limpo.marcas, cabecalhos: limpo.cabecalhos,
      achadas: questoes.length, conferidas: conta("conferido"), soTabela: conta("so_tabela"), soComentario: conta("so_comentario"),
      divergem: questoes.filter((x) => x.situacao === "diverge").map((x) => x.n),
      semGabarito: questoes.filter((x) => x.situacao === "sem_gabarito").map((x) => x.n),
      semComentario: questoes.filter((x) => !x.comentario.length).length,
    },
  };
}

/* as páginas do PDF em linhas de texto, pelo mesmo leitor das leis (PDF.js sob demanda) */
async function qsPdfPaginas(bytes, opc) {
  const o = opc || {};
  let lib;
  try { lib = o.pdfjsLib || await (o.carregar || leiPdfCarregarLib)(); }
  catch (e) { return { paginas: [], motivo: "pdf_sem_leitor" }; }
  let pdf;
  try {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const tarefa = lib.getDocument({ data: u8 });
    pdf = await (tarefa.promise || tarefa);
  } catch (e) { return { paginas: [], motivo: "pdf_invalido" }; }
  const paginas = [];
  let letras = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    if (typeof o.onProgresso === "function") { try { o.onProgresso(p, pdf.numPages); } catch (e) {} }
    const pg = await pdf.getPage(p);
    const tc = await pg.getTextContent();
    const linhas = leiPdfLinhas(tc.items, []).map((ln) => ln.runs.map((x) => x.t).join(""));
    linhas.forEach((l) => { letras += l.trim().length; });
    paginas.push(linhas);
  }
  if (letras < Math.max(20, pdf.numPages * 20)) return { paginas: [], motivo: "pdf_sem_texto" };
  return { paginas };
}

/* a frase do que foi lido, para a linha de aviso da tela */
function qsPdfFrase(r) {
  const p = [t("qs_pdf_lidas", { n: r.achadas, p: r.paginas })];
  if (r.conferidas) p.push(t("qs_pdf_conferidas", { n: r.conferidas }));
  if (r.soTabela) p.push(t("qs_pdf_so_tabela", { n: r.soTabela }));
  if (r.soComentario) p.push(t("qs_pdf_so_coment", { n: r.soComentario }));
  if (r.divergem.length) p.push(t("qs_pdf_divergem", { n: r.divergem.length, l: r.divergem.join(", ") }));
  if (r.semGabarito.length) p.push(t("qs_pdf_sem_gab", { n: r.semGabarito.length, l: r.semGabarito.join(", ") }));
  if (r.marcas) p.push(t("qs_pdf_marca"));
  return p.join(" · ");
}

/* O ARQUIVO ESCOLHIDO: lê, extrai, põe o texto na caixa da resposta (acrescenta, como "colar") e confere */
async function qsUiPdfImportar(arquivo) {
  const msg = $("qsPdfMsg");
  const dizer = (s, erro) => { if (msg) { msg.textContent = s; msg.hidden = !s; msg.className = "nota qs-pdf-msg" + (erro ? " qs-pdf-erro" : ""); } };
  if (!arquivo) return null;
  dizer(t("qs_pdf_lendo", { p: 0, n: "…" }));
  let bytes;
  try { bytes = new Uint8Array(await arquivo.arrayBuffer()); } catch (e) { dizer(t("qs_pdf_m_pdf_invalido"), true); return null; }
  const lido = await qsPdfPaginas(bytes, { onProgresso: (p, n) => dizer(t("qs_pdf_lendo", { p, n })) });
  if (lido.motivo) {
    dizer(t("qs_pdf_m_" + lido.motivo), true);
    try { matReg("questao", "PDF de questões não lido", lido.motivo); } catch (e) {}
    return null;
  }
  const r = qsPdfExtrair(lido.paginas);
  if (!r.questoes.length) {
    dizer(t("qs_pdf_nenhuma", { p: r.resumo.paginas }), true);
    try { matReg("questao", "PDF de questões: nenhuma questão reconhecida", r.resumo.paginas + " páginas"); } catch (e) {}
    return r;
  }
  const cx = $("qsCriarResposta");
  const antes = String(cx.value || "");
  cx.value = antes.trim() ? antes.replace(/\s*$/, "") + "\n\n" + r.texto : r.texto;
  dizer(qsPdfFrase(r.resumo));
  try {
    matReg("questao", "questões lidas de PDF", r.resumo.achadas + " em " + r.resumo.paginas + " páginas · " + r.resumo.conferidas + " com gabarito conferido"
      + (r.resumo.divergem.length ? " · divergem: " + r.resumo.divergem.join(", ") : "") + (r.resumo.semGabarito.length ? " · sem gabarito: " + r.resumo.semGabarito.join(", ") : ""));
  } catch (e) {}
  qsUiConferir();
  return r;
}

function qsUiPdfIniciar() {
  const b = $("btnQsPdf"), arq = $("qsPdfArquivo");
  if (!b || !arq) return;
  b.onclick = () => { try { arq.value = ""; } catch (e) {} arq.click(); };
  arq.onchange = () => { const f = arq.files && arq.files[0]; if (f) qsUiPdfImportar(f); };
}
