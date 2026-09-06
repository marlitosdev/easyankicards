/* =====================================================================
 * REGISTRO DA GERAÇÃO — cartões e questões feitos com a IA
 *
 * POR QUE ESTE ARQUIVO EXISTE.
 * A tela de conferência dizia "2 cartão(ões) lido(s) · 1 aviso(s)" e
 * parava aí. O aviso EXISTIA — o parser devolve a frase inteira, com o
 * número da linha e o texto recusado — mas ninguém o mostrava. Contar
 * um problema sem dizer qual é pior do que não contar: a pessoa fica
 * sabendo que algo deu errado e sem nenhum caminho para descobrir o quê.
 *
 * Cartão e questão dividem o mesmo ritual — copiar o prompt, colar a
 * resposta, conferir, gravar — e por isso dividem um registro só. Dois
 * registros quase iguais seriam duas telas para conferir e duas listas
 * que nunca somam; aqui o tipo é um FILTRO, não um arquivo separado.
 *
 * O que cada linha precisa carregar para servir de alguma coisa:
 *   - a etapa (prompt, leitura, gravação, erro), porque é o que se
 *     procura: "o prompt saiu?", "o que ele recusou?", "gravou?";
 *   - os números da leitura (lidos, avisos, recusados, repetidos);
 *   - e, junto, os MOTIVOS em texto — não o código interno.
 * ===================================================================== */

const GER_LOG_CHAVE = "eac_ger_log";
const GER_LOG_MAX = 300;

let gerLog = [];
let gerLogSoHoje = true;    /* começa em HOJE: é a pergunta comum */
let gerLogSoErros = false;
let gerLogTipo = "";        /* "", "cartoes" ou "questoes" */

function gerLogCarregar() {
  try { gerLog = JSON.parse(localStorage.getItem(GER_LOG_CHAVE) || "[]"); }
  catch (e) { gerLog = []; }
  if (!Array.isArray(gerLog)) gerLog = [];
  return gerLog;
}

function gerLogGravar() {
  while (gerLog.length > GER_LOG_MAX) gerLog.shift();
  try { localStorage.setItem(GER_LOG_CHAVE, JSON.stringify(gerLog)); } catch (e) {}
}

/* tipo: "cartoes" | "questoes"   etapa: "prompt" | "leitura" | "gravacao"
 *                                       | "descarte" | "erro" */
function gerReg(tipo, etapa, oque, detalhe, extra) {
  const x = extra || {};
  gerLog.push({
    q: new Date().toISOString(),
    tp: String(tipo || ""),
    e: String(etapa || ""),
    o: String(oque || ""),
    d: String(detalhe == null ? "" : detalhe).slice(0, 240),
    top: String(x.topico || ""),
    disc: String(x.disciplina || ""),
    /* MOTIVOS VÃO JUNTO DA LINHA, não em outra estrutura. Guardados
     * separado, a primeira limpeza do log levaria os números e deixaria
     * os motivos órfãos — ou o contrário. */
    mot: Array.isArray(x.motivos) ? x.motivos.slice(0, 20).map(gerMotivoLinha) : [],
    n: x.numeros || null,
  });
  gerLogGravar();
  /* continua indo para o registro geral do material: quem procura por lá
   * não pode deixar de encontrar */
  try { if (typeof matReg === "function") matReg("geracao", oque, detalhe); } catch (e) {}
  return gerLog[gerLog.length - 1];
}

/* Um motivo pode chegar de três formas, porque três lugares diferentes
 * os produzem: o parser dos cartões devolve a FRASE pronta; o leitor de
 * questões devolve um CÓDIGO ("sem_gabarito"); e um cartão suspeito
 * devolve a frase dentro de `issues`. Todas viram uma linha só. */
function gerMotivoLinha(m) {
  if (m == null) return "";
  if (typeof m === "string") return m.slice(0, 200);
  const linha = m.linha || m.line || 0;
  const motivo = m.motivo ? gerMotivoTexto(m.motivo) : (m.txtMotivo || "");
  const trecho = String(m.txt || m.texto || "").slice(0, 90);
  return (linha ? "linha " + linha + ": " : "")
    + (motivo || "") + (trecho ? " — " + trecho : "");
}

/* CÓDIGO INTERNO NÃO É EXPLICAÇÃO. "gabarito_fora_das_opcoes" diz tudo
 * para quem escreveu o código e nada para quem colou o texto. */
function gerMotivoTexto(codigo) {
  const c = String(codigo || "");
  if (!c) return "";
  let s = "";
  try { s = t("qs_motivo_" + c); } catch (e) { s = ""; }
  if (s && s !== "qs_motivo_" + c) return s;
  /* motivo desconhecido volta legível, e não como chave crua na tela */
  return c.replace(/_/g, " ");
}

/* O DIA É O DA PESSOA, NÃO O DE GREENWICH — mesmo defeito que o registro
 * da lei já teve: o carimbo é ISO (UTC), "hoje" é o relógio dela, e a
 * partir das 21h no Brasil os dois divergem. Comparados como texto, o
 * filtro de hoje mostrava zero linhas na hora em que mais se estuda. */
function gerLogDiaLocal(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
    + "-" + String(x.getDate()).padStart(2, "0");
}

function gerLogHojeISO() { return gerLogDiaLocal(new Date()); }

function gerLogFiltrado() {
  const hoje = gerLogHojeISO();
  return gerLog.filter((x) => {
    if (gerLogSoErros && x.e !== "erro") return false;
    if (gerLogTipo && x.tp !== gerLogTipo) return false;
    if (gerLogSoHoje && gerLogDiaLocal(x.q) !== hoje) return false;
    return true;
  });
}

function gerLogTexto() {
  const lista = gerLogFiltrado();
  if (!lista.length) return typeof t === "function" ? t("ger_log_vazio") : "";
  const linhas = [];
  lista.forEach((x) => {
    const d = new Date(x.q);
    const h = isNaN(d.getTime()) ? "--:--:--" : d.toTimeString().slice(0, 8);
    const dia = gerLogDiaLocal(x.q);
    linhas.push((gerLogSoHoje ? h : dia + " " + h)
      + "  [" + (x.tp || "?") + "/" + (x.e || "?") + "] " + (x.o || "")
      + (x.d ? "  — " + x.d : "")
      + (x.top ? "  (" + x.top + ")" : ""));
    /* os motivos entram INDENTADOS embaixo da linha a que pertencem:
     * é o que permite ler "1 aviso" e o aviso na mesma varrida */
    (x.mot || []).forEach((m) => { if (m) linhas.push("        · " + m); });
  });
  return linhas.join("\n");
}

/* Números para o cabeçalho. O resumo diz O QUE O FILTRO ESTÁ ESCONDENDO:
 * sem isso, "0 linhas" com o filtro de hoje ligado parece registro vazio,
 * e a conclusão é que o app não registra nada. */
function gerLogNumeros() {
  const hoje = gerLogHojeISO();
  return {
    vendo: gerLogFiltrado().length,
    total: gerLog.length,
    hoje: gerLog.filter((x) => gerLogDiaLocal(x.q) === hoje).length,
    erros: gerLog.filter((x) => x.e === "erro").length,
    cartoes: gerLog.filter((x) => x.tp === "cartoes").length,
    questoes: gerLog.filter((x) => x.tp === "questoes").length,
  };
}

function gerLogLimpar() { gerLog = []; gerLogGravar(); }

/* ---------------------------------------------------------------------
 * A TELA
 * ------------------------------------------------------------------ */

function gerLogPintar() {
  if (typeof $ !== "function" || !$("gerLogTexto")) return;
  $("gerLogTexto").value = gerLogTexto();
  const n = gerLogNumeros();
  $("gerLogResumo").textContent = t("ger_log_resumo", {
    v: n.vendo, tot: n.total, hoje: n.hoje, erros: n.erros,
    c: n.cartoes, q: n.questoes,
  });
  const marcar = (id, ligado, perigo) => {
    const b = $(id);
    if (!b || !b.classList) return;
    b.classList.toggle("btn-min-ok", !!ligado);
    if (perigo !== undefined) b.classList.toggle("btn-min-perigo", !!perigo);
  };
  marcar("btnGerLogHoje", gerLogSoHoje);
  /* erro é o único estado que merece cor: é o que se procura */
  marcar("btnGerLogErros", gerLogSoErros, n.erros > 0);
  marcar("btnGerLogCartoes", gerLogTipo === "cartoes");
  marcar("btnGerLogQuestoes", gerLogTipo === "questoes");
}

/* O filtro de tipo é um INTERRUPTOR, não uma escolha exclusiva: tocar no
 * que já está ligado volta a mostrar os dois. Sem isso não haveria como
 * desligar o filtro sem um terceiro botão "tudo". */
function gerLogTipoAlternar(tipo) {
  gerLogTipo = gerLogTipo === tipo ? "" : tipo;
  gerLogPintar();
}

function gerLogAbrir(tipo) {
  gerLogCarregar();
  if (tipo) gerLogTipo = tipo;
  gerLogPintar();
  if (typeof abrirModal === "function") abrirModal("dlgGerLog");
}

/* TODO BOTÃO DA GERAÇÃO PASSA POR AQUI — mesma razão do matBotao e do
 * leiBotao: erro dentro de um handler morre no console do navegador, que
 * ninguém abre, e o registro fica mudo justamente no evento que
 * interessa. Envolvido, o erro vira uma linha com o NOME do botão, que é
 * o que a pessoa consegue relatar. */
function gerBotao(id, tipo, nome, acao) {
  const b = typeof $ === "function" ? $(id) : null;
  if (!b) return;
  b.onclick = function () {
    try {
      const r = acao.apply(this, arguments);
      if (r && typeof r.catch === "function") {
        r.catch((e) => gerReg(tipo, "erro", "falha em " + nome,
          (e && e.message) || String(e)));
      }
      return r;
    } catch (e) {
      gerReg(tipo, "erro", "falha em " + nome, (e && e.message) || String(e));
      try { uiAlert(t("ger_erro_botao", { b: nome })); } catch (x) {}
    }
  };
}

/* Os botões da janela. Todos passam por gerBotao, incluindo os do próprio
 * registro: um erro ao APAGAR o registro é exatamente o tipo de coisa que
 * some sem deixar rastro. */
function gerLogIniciar() {
  gerLogCarregar();
  gerBotao("btnGerLogHoje", "log", "filtro de hoje", () => {
    gerLogSoHoje = !gerLogSoHoje; gerLogPintar();
  });
  gerBotao("btnGerLogErros", "log", "filtro de erros", () => {
    gerLogSoErros = !gerLogSoErros; gerLogPintar();
  });
  gerBotao("btnGerLogCartoes", "log", "filtro de cartões",
    () => gerLogTipoAlternar("cartoes"));
  gerBotao("btnGerLogQuestoes", "log", "filtro de questões",
    () => gerLogTipoAlternar("questoes"));
  gerBotao("btnGerLogCopiar", "log", "copiar registro", () => {
    try { navigator.clipboard.writeText($("gerLogTexto").value); } catch (e) {}
    const b = $("btnGerLogCopiar");
    const r = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = r; }, 1800);
  });
  gerBotao("btnGerLogLimpar", "log", "apagar registro", async () => {
    if (!(await uiConfirm(t("ger_log_limpar_conf", { n: gerLog.length })))) return;
    gerLogLimpar();
    gerLogPintar();
  });
  gerBotao("btnGerLogFechar", "log", "fechar registro",
    () => $("dlgGerLog").close());
  /* as duas portas de entrada: a conferência dos cartões e a das questões */
  gerBotao("btnMcLog", "cartoes", "abrir o registro pelos cartões",
    () => gerLogAbrir("cartoes"));
  gerBotao("btnQsLog", "questoes", "abrir o registro pelas questões",
    () => gerLogAbrir("questoes"));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
