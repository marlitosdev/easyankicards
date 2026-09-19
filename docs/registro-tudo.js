/* =====================================================================
 * O REGISTRO INTEIRO, NUM LUGAR SÓ
 *
 * O aplicativo guarda cinco registros, cada um perto do que ele
 * observa: o geral (reg), o do material e das questões (matLog), o das
 * gerações de IA (gerLog), o da vinculação entre editais (vzLog) e os
 * instantâneos do plano. Cada um continua onde está — ler o registro da
 * vinculação dentro da tela de vinculação é o que faz aquele registro
 * ser útil ali.
 *
 * O QUE FALTAVA É A LINHA DO TEMPO ÚNICA. Investigar um defeito é
 * perguntar "o que aconteceu antes disto?", e a resposta quase nunca
 * está toda numa fonte só. O edital que foi gravado por cima do outro é
 * o exemplo: a pista estava no arquivo de backup, o horário no registro
 * geral, e a atividade da hora no registro do material — três lugares,
 * três formatos, três relógios (um deles em UTC).
 *
 * ESTA TELA NÃO GUARDA NADA. Ela lê as fontes e junta. Um sexto
 * registro seria mais uma coisa para sincronizar, e o defeito que ele
 * introduziria seria justamente do tipo que ele existe para achar.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * NÍVEIS
 *
 * Quatro, e não mais: ERRO (quebrou), AVISO (algo foi recusado ou
 * ignorado), INFO (aconteceu algo que muda o conteúdo) e DETALHE (a
 * pessoa mexeu na tela). A escala existe para uma pergunta prática —
 * "mostre só o que deu errado" — e escalas com sete níveis não são
 * usadas, são adivinhadas.
 *
 * O nível é DEDUZIDO do que já está gravado, não acrescentado a cada
 * chamada: reescrever as duzentas chamadas de reg() para carimbar um
 * nível seria mexer em duzentos lugares para ganhar um filtro.
 * ------------------------------------------------------------------ */
const RT_NIVEIS = ["erro", "aviso", "info", "detalhe"];

const RT_ERRO = /^(erro|falha)\b|\bexception\b|is not a function|is not defined|Uncaught/i;
const RT_AVISO = /recusad|ignorad|cancelad|dispensad|sem chave|nao foi possivel|não foi possível|vazio|invalid|conflito|duplicad/i;
const RT_DETALHE = /^(modo|diagnostico|plano-log)$|aberta?$|aberto$|em tela cheia|em janela|tamanho da caixa|painel aberto/i;

function rtNivel(tag, msg, extra) {
  const tudo = String(tag || "") + " " + String(msg || "") + " " + String(extra || "");
  if (RT_ERRO.test(tudo)) return "erro";
  if (RT_AVISO.test(tudo)) return "aviso";
  if (RT_DETALHE.test(String(tag || "")) || RT_DETALHE.test(String(msg || ""))) {
    return "detalhe";
  }
  return "info";
}

/* ---------------------------------------------------------------------
 * MASCARAR O QUE NÃO PODE SAIR DAQUI
 *
 * O registro é feito para ser copiado e mandado para alguém — é para
 * isso que existe o botão de copiar. A chave da IA vive no mesmo
 * armazenamento e pode aparecer num texto colado, numa URL de erro ou
 * num diagnóstico. Uma chave vazada vira cobrança na fatura de quem a
 * gerou, e o custo de mascarar é uma expressão regular.
 *
 * MASCARA POR FORMATO, e não pelo valor guardado: a chave que vazou
 * pode ser outra — uma que a pessoa colou e não salvou, ou a de outro
 * serviço. Guardar as quatro primeiras letras é o que permite conferir
 * "é a minha chave mesmo?" sem entregá-la.
 * ------------------------------------------------------------------ */
const RT_SEGREDOS = [
  /\bAIza[0-9A-Za-z_\-]{10,}/g,          /* Google / Gemini */
  /\bsk-[0-9A-Za-z_\-]{12,}/g,           /* OpenAI */
  /\bsk-ant-[0-9A-Za-z_\-]{12,}/g,       /* Anthropic */
  /\bghp_[0-9A-Za-z]{20,}/g,             /* GitHub */
  /\bBearer\s+[0-9A-Za-z._\-]{16,}/gi,
];

function rtMascarar(txt) {
  let s = String(txt == null ? "" : txt);
  RT_SEGREDOS.forEach((re) => {
    s = s.replace(re, (achado) => achado.slice(0, 6) + "…****");
  });
  /* e a chave guardada, mesmo que não case com nenhum formato acima */
  try {
    const k = localStorage.getItem("eac_chave_gemini") || "";
    if (k && k.length > 8) {
      s = s.split(k).join(k.slice(0, 6) + "…****");
    }
  } catch (e) {}
  return s;
}

/* ---------------------------------------------------------------------
 * JUNTAR AS FONTES
 *
 * Cada uma guarda o instante num campo diferente e num formato
 * diferente — o registro geral separa dia e hora em texto local, os
 * outros usam ISO. Aqui tudo vira um número, que é a única forma de
 * ordenar cinco relógios diferentes sem errar.
 * ------------------------------------------------------------------ */
function rtInstante(x) {
  const n = new Date(x).getTime();
  return isNaN(n) ? 0 : n;
}

function rtDoRegistroGeral() {
  const L = (typeof registro !== "undefined" && registro) ? registro : [];
  return L.map((r) => ({
    /* O REGISTRO GERAL GRAVA EM UTC (reg() usa toISOString) — sem o "Z" o
     * navegador lia a hora como LOCAL, e o evento caía horas fora de
     * lugar na linha do tempo, ao lado dos outros registros (que já vêm
     * em ISO com Z). Foi o que fez o mesmo evento aparecer em dois
     * horários, conforme a fonte. */
    quando: rtInstante(r.d + "T" + (r.h || "00:00:00") + "Z"),
    fonte: "app", tag: r.tipo || "", sessao: r.s || "",
    msg: r.msg || "",
    /* a contagem de repetição viaja junto com o extra: a linha unificada
     * não tem campo próprio para ela, e sem isso "×24" só apareceria no
     * painel antigo — dois lugares mostrando o mesmo evento de formas
     * diferentes é o começo de um bug de leitura */
    extra: (r.extra || "")
      + (typeof regRepeticao === "function" ? regRepeticao(r) : ""),
  }));
}

function rtDoMaterial() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_mat_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "material",
    tag: String(x.t || "").toUpperCase(), sessao: "",
    msg: x.o || "", extra: [x.d, x.disc, x.top].filter(Boolean).join(" · "),
  }));
}

function rtDaGeracao() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_ger_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "geracao",
    /* O LOG ESCREVE tp/e (gerReg em geracao-log.js); ler t/tipo deixava a
     * etiqueta vazia em toda linha de geração */
    tag: String(x.tp || x.t || x.tipo || "").toUpperCase(), sessao: "",
    msg: x.o || x.msg || "",
    extra: [x.d || x.extra, x.disc, x.top].filter(Boolean).join(" · "),
  }));
}

function rtDaVinculacao() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_vinculo_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "vinculo",
    tag: String(x.e || "").toUpperCase(), sessao: "",
    msg: x.e || "",
    /* vzLogGravar guarda os números em "d" (e a amostra em "a") — "n"
     * nunca existiu ali, e a linha saía sempre sem os números */
    extra: Object.keys(x.d || x.n || {}).map((k) => k + "=" + (x.d || x.n)[k]).join("  "),
  }));
}

/* O REGISTRO DA LEI, que só existia no visor próprio (dlgLeiLog). Cada
 * linha já traz a lei e o tópico — é o que faltava no relatório, onde a
 * lei chegava só como "MATERIAL-LEI", sem nome nem artigo. */
function rtDaLei() {
  let L = [];
  try { L = JSON.parse(localStorage.getItem("eac_lei_log") || "[]"); } catch (e) { L = []; }
  if (!Array.isArray(L)) L = [];
  return L.map((x) => ({
    quando: rtInstante(x.q), fonte: "lei",
    tag: String(x.t || "").toUpperCase(), sessao: "",
    msg: x.o || "", extra: [x.d, x.lei, x.top].filter(Boolean).join(" · "),
  }));
}

/* Tudo, em ordem, com nível e já mascarado. */
function rtTudo(opc) {
  const o = opc || {};
  let L = [].concat(rtDoRegistroGeral(), rtDoMaterial(),
                    rtDaGeracao(), rtDaVinculacao(), rtDaLei());
  L = L.filter((x) => x && x.quando > 0);
  L.forEach((x) => {
    x.nivel = rtNivel(x.tag, x.msg, x.extra);
    x.msg = rtMascarar(x.msg);
    x.extra = rtMascarar(x.extra);
    x.assuntos = rtAssuntosDe(x);
  });
  /* MAIS NOVO PRIMEIRO: investigar é olhar para trás a partir de agora. */
  L.sort((a, b) => b.quando - a.quando);
  if (o.semRepetidos) L = rtSemRepetidos(L);
  if (o.nivel && o.nivel !== "tudo") {
    const ate = RT_NIVEIS.indexOf(o.nivel);
    L = L.filter((x) => RT_NIVEIS.indexOf(x.nivel) <= ate);
  }
  if (o.fonte && o.fonte !== "tudo") L = L.filter((x) => x.fonte === o.fonte);
  if (o.desde) L = L.filter((x) => x.quando >= o.desde);
  if (o.dias) L = L.filter((x) => rtDentroDoPeriodo(x.quando, o.dias));
  if (o.assunto && o.assunto !== "tudo") {
    L = L.filter((x) => rtEhErroFixo(x) || x.assuntos.indexOf(o.assunto) >= 0);
  }
  /* "SÓ O QUE DEU ERRADO" = erro e aviso; o resto é andamento normal */
  if (o.gravidade === "problemas") {
    L = L.filter((x) => x.nivel === "erro" || x.nivel === "aviso");
  }
  if (o.limite) L = L.slice(0, o.limite);
  return L;
}

/* =====================================================================
 * ASSUNTOS — a pergunta que a pessoa faz ("o registro das questões",
 * "dos vínculos de lei"), no lugar de "modo" e "fonte", que são o jeito
 * como o aplicativo guarda as coisas.
 *
 * Um evento pode ter MAIS DE UM assunto: "citação não resolvida" é de
 * Questões (aconteceu numa questão) e de Leis (é sobre uma lei que não
 * casou). Quem pede um dos dois recebe a linha.
 *
 * ERRO NUNCA SAI: erro e bloqueio entram em qualquer assunto — a
 * legenda do diagnóstico já prometia "erros e bloqueios nunca são
 * descartados", e o filtro por modo antigo quebrava isso (o erro tinha
 * a etiqueta ERRO, que nenhum modo reconhecia, e sumia do relatório
 * justamente do assunto onde aconteceu).
 * ===================================================================== */
const RT_ASSUNTOS = ["tudo", "questoes", "leis", "material", "cartoes", "edital"];

const RT_RE_CARTOES = /^(CORRIGIR|LIMPAR|COLAR|APLICAR|EXCLUIR|RECORTAR|RECORTES|FOCO|EXPORTAR|REVISAO|PROMPT)/;
const RT_RE_QUESTOES = /^(QUESTOES?|MATERIAL-QUESTOES?|GRIFO|RASCUNHO)/;
const RT_RE_LEIS = /^(LEI|MATERIAL-LEI)$/;
const RT_RE_EDITAL = /^(EDITAL|VINCULO|PLANO)/;
/* linhas de QUESTOES que são sobre uma LEI (citação, sigla, vínculo) */
const RT_RE_QUESTAO_DE_LEI = /\blei\b|leis\b|cita[çc][aã]o|sigla|vinculad|apelido/i;

function rtAssuntosDe(x) {
  const tag = String(x.tag || "").toUpperCase();
  const a = [];
  const mais = (id) => { if (a.indexOf(id) < 0) a.push(id); };
  if (x.fonte === "lei" || RT_RE_LEIS.test(tag)) mais("leis");
  if (RT_RE_QUESTOES.test(tag) || (x.fonte === "geracao" && /QUEST/.test(tag))) {
    mais("questoes");
    if (/^QUESTOES?$/.test(tag) && RT_RE_QUESTAO_DE_LEI.test(String(x.msg || ""))) mais("leis");
  }
  if (RT_RE_CARTOES.test(tag) || (x.fonte === "geracao" && a.indexOf("questoes") < 0)) mais("cartoes");
  if (x.fonte === "material" || /^MATERIAL/.test(tag)) {
    if (a.indexOf("leis") < 0 && a.indexOf("questoes") < 0) mais("material");
  }
  if (RT_RE_EDITAL.test(tag) || x.fonte === "vinculo") mais("edital");
  return a;
}

/* erro e bloqueio entram em qualquer assunto */
function rtEhErroFixo(x) {
  return x.nivel === "erro" || /^(ERRO|BLOQUEIO|APAGAR)$/.test(String(x.tag || "").toUpperCase());
}

/* O PERÍODO SOBRE O INSTANTE JÁ NORMALIZADO. Mesma regra do filtro
 * antigo do registro geral (o dia é o LOCAL de quem lê; "hoje" não pode
 * cair no dia anterior por causa de fuso): 1 = hoje, N = últimos N dias. */
function rtDentroDoPeriodo(quando, dias) {
  if (!dias) return true;
  const d = new Date(quando);
  if (dias === 1) {
    const h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth()
      && d.getDate() === h.getDate();
  }
  return quando >= Date.now() - dias * 86400000;
}

/* GÊMEOS. matReg copia cada evento para o registro geral como
 * "MATERIAL-x", e leiReg/gerReg copiam para o do material — a mesma
 * linha em dois ou três lugares. Numa linha do tempo única isso vira
 * contagem inflada e relatório repetido. Fica a cópia da fonte MAIS RICA
 * (a da lei sabe o nome da lei; a do material, a disciplina; o registro
 * geral sabe menos), e só cai quem é espelho de fato: mesma mensagem,
 * fontes diferentes, no mesmo instante. */
function rtSemRepetidos(L) {
  const rica = { lei: 3, geracao: 3, vinculo: 3, material: 2, app: 1 };
  const chave = (x) => String(x.msg || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 90);
  const espelho = (a, b) =>
    (b.fonte === "app" && /^MATERIAL-/.test(String(b.tag || "").toUpperCase()))
    || (b.fonte === "material" && (a.fonte === "lei" || a.fonte === "geracao")
        && /^(LEI|GERACAO)$/.test(String(b.tag || "").toUpperCase()));
  const grupos = {};
  L.forEach((x) => { (grupos[chave(x)] = grupos[chave(x)] || []).push(x); });
  const fora = new Set();
  Object.keys(grupos).forEach((k) => {
    const g = grupos[k];
    if (g.length < 2) return;
    g.forEach((a) => g.forEach((b) => {
      if (a === b || fora.has(a) || fora.has(b) || a.fonte === b.fonte) return;
      if (Math.abs(a.quando - b.quando) > 5000) return;
      if ((rica[a.fonte] || 0) > (rica[b.fonte] || 0) && espelho(a, b)) fora.add(b);
    }));
  });
  return L.filter((x) => !fora.has(x));
}

/* quantos eventos cada assunto tem, para mostrar no próprio botão */
function rtContarPorAssunto(lista) {
  const c = {};
  RT_ASSUNTOS.forEach((id) => { c[id] = 0; });
  (lista || []).forEach((x) => {
    c.tudo++;
    /* o número do botão é o do relatório que ele vai gerar — e o erro
     * entra em qualquer assunto (ver rtTudo), então conta em todos */
    if (rtEhErroFixo(x)) {
      RT_ASSUNTOS.forEach((id) => { if (id !== "tudo") c[id]++; });
      return;
    }
    (x.assuntos || []).forEach((id) => { if (c[id] !== undefined) c[id]++; });
  });
  return c;
}

function rtContarPorNivel(lista) {
  const c = { erro: 0, aviso: 0, info: 0, detalhe: 0 };
  (lista || []).forEach((x) => { if (c[x.nivel] !== undefined) c[x.nivel]++; });
  return c;
}

function rtLinha(x) {
  const d = new Date(x.quando);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
    + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
    + "  " + String(x.nivel).toUpperCase().padEnd(7)
    + " " + String(x.fonte).padEnd(9)
    + " [" + x.tag + "] " + x.msg + (x.extra ? "  " + x.extra : "");
}

function rtTexto(opc) {
  const L = rtTudo(opc);
  const c = rtContarPorNivel(L);
  const cab = L.length + " eventos · " + c.erro + " erro(s) · "
    + c.aviso + " aviso(s)";
  return cab + "\n" + L.map(rtLinha).join("\n");
}

/* O TEXTO DO RELATÓRIO, do MESMO filtro que a prévia e a linha do tempo
 * usam. Antes o que se COPIAVA (só o registro geral, filtrado por
 * "modo") e o que se VIA (as abas da linha do tempo) eram dois filtros
 * diferentes: as abas nunca entravam no relatório, e quem escolhia
 * "erros" achava que estava escolhendo o que ia ser enviado. */
function rtRelatorio(opc) {
  const L = rtTudo(Object.assign({ semRepetidos: true }, opc || {}));
  const c = rtContarPorNivel(L);
  const cab = L.length + " eventos · " + c.erro + " erro(s) · " + c.aviso + " aviso(s)";
  return { n: L.length, lista: L, texto: L.length ? cab + "\n" + L.map(rtLinha).join("\n") : "" };
}

/* =====================================================================
 * A TELA
 *
 * Mora dentro do painel de diagnóstico, que já é onde se vai quando
 * algo deu errado — uma tela nova seria mais um lugar para lembrar.
 *
 * UM SÓ MODELO DE FILTRO: assunto × período × gravidade. O que a
 * pessoa vê na prévia é exatamente o que copia. (Eram dois: botões que
 * mudavam o texto copiado, e abas que só mudavam a lista — e ninguém
 * sabia qual dos dois valia para "enviar".)
 * ===================================================================== */
let diagAssunto = "tudo";
let diagGravidade = "tudo";    /* "tudo" | "problemas" (erro e aviso) */

/* opções do relatório na tela agora — um lugar só, para a prévia, a
 * contagem e o texto copiado nunca discordarem */
function rtOpcoesAtuais() {
  return {
    assunto: diagAssunto,
    dias: (typeof regPeriodo !== "undefined") ? regPeriodo : 0,
    gravidade: diagGravidade,
  };
}

/* Abre já num assunto/gravidade — quem chega por um botão "ver registro"
 * veio atrás de alguma coisa. Vale UMA abertura; sem pedido, começa em
 * "tudo" (ou no assunto da bancada aberta, ver abrirDiagnostico). */
function rtIniciarTela(pedido) {
  const p = pedido || {};
  diagAssunto = RT_ASSUNTOS.indexOf(p.assunto) >= 0 ? p.assunto : "tudo";
  diagGravidade = p.gravidade === "problemas" ? "problemas" : "tudo";
  rtPintar();
}

function rtChip(rot, sel, alerta, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "rt-aba" + (sel ? " sel" : "") + (alerta ? " tem-erro" : "");
  b.textContent = rot;
  b.setAttribute("aria-pressed", sel ? "true" : "false");
  b.onclick = onclick;
  return b;
}

function rtPintarControles() {
  const dias = (typeof regPeriodo !== "undefined") ? regPeriodo : 0;
  /* a contagem de cada assunto respeita o PERÍODO (é o que a pessoa vê
   * ao trocar), mas não a gravidade — ela mostra o que existe */
  const base = rtTudo({ dias, semRepetidos: true });
  const c = rtContarPorAssunto(base);

  const ass = $("diagAssuntos");
  if (ass) {
    ass.innerHTML = "";
    RT_ASSUNTOS.forEach((id) => {
      ass.append(rtChip(t("diag_ass_" + id) + " (" + c[id] + ")", diagAssunto === id, false,
        () => { diagAssunto = id; rtAoMudarFiltro(); }));
    });
  }
  const gr = $("diagGravidade");
  if (gr) {
    gr.innerHTML = "";
    /* a contagem é a do ASSUNTO escolhido: o botão diz quantas linhas
     * vão sobrar, não quantas existem no aparelho todo */
    const prob = rtTudo({ dias, semRepetidos: true, assunto: diagAssunto,
      gravidade: "problemas" }).length;
    gr.append(
      rtChip(t("diag_grav_tudo"), diagGravidade === "tudo", false,
        () => { diagGravidade = "tudo"; rtAoMudarFiltro(); }),
      rtChip(t("diag_grav_prob", { n: prob }), diagGravidade === "problemas", prob > 0,
        () => { diagGravidade = "problemas"; rtAoMudarFiltro(); }));
  }
}

/* trocar assunto/gravidade REFILTRA — não reabre o diálogo nem mede o
 * armazenamento de novo (o botão de período reabria tudo) */
function rtAoMudarFiltro() {
  if (typeof montarPainelDiag === "function") montarPainelDiag();
  else rtPintar();
}

/* Remove só os eventos de tipo ERRO do registro geral — nada de avisos,
 * ações ou o resto da linha do tempo, e nada nos outros quatro registros
 * (material, geração, vinculação): "limpar erros" não é "limpar tudo". */
async function rtLimparErros() {
  const L = (typeof registro !== "undefined" && registro) ? registro : [];
  const n = L.filter((r) => r.tipo === "ERRO").length;
  if (!n) return;
  if (!(await uiConfirm(t("rt_limpar_conf", { n })))) return;
  registro = L.filter((r) => r.tipo !== "ERRO");
  try { localStorage.setItem("eac_registro", JSON.stringify(registro)); } catch (e) {}
  reg("REGISTRO", "erros antigos removidos", n + " removidos");
  rtPintar();
  if (typeof montarPainelDiag === "function") montarPainelDiag();
  toast("rt_limpar_feito");
}

/* A LINHA DO TEMPO COLORIDA, dentro de "ver linha do tempo": as mesmas
 * linhas do relatório, uma por linha, com nível e hora — só para olhar.
 * Só desenha com a gaveta aberta (são até 400 linhas). */
function rtPintar() {
  rtPintarControles();
  const btnLimpar = $("btnRtLimparErros");
  if (btnLimpar) {
    const nErros = ((typeof registro !== "undefined" && registro) || [])
      .filter((r) => r.tipo === "ERRO").length;
    btnLimpar.hidden = !nErros;
    if (nErros) {
      btnLimpar.textContent = t("rt_limpar_btn", { n: nErros });
      btnLimpar.title = t("rt_limpar_ajuda");
      btnLimpar.onclick = () => rtLimparErros();
    }
  }
  const cx = $("rtLista");
  if (!cx) return;
  cx.innerHTML = "";
  const gaveta = $("diagTempo");
  if (gaveta && gaveta.open === false) return;

  const L = rtTudo(Object.assign(rtOpcoesAtuais(), { semRepetidos: true, limite: 400 }));
  if (!L.length) {
    const p = document.createElement("div");
    p.className = "rt-li";
    p.textContent = t("rt_vazio");
    cx.append(p);
    return;
  }
  L.forEach((x) => {
    const li = document.createElement("div");
    li.className = "rt-li n-" + x.nivel;
    const q = document.createElement("span");
    q.className = "rt-q";
    const d = new Date(x.quando);
    const p2 = (v) => String(v).padStart(2, "0");
    q.textContent = p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " "
      + p2(d.getHours()) + ":" + p2(d.getMinutes());
    const f = document.createElement("span");
    f.className = "rt-f";
    f.textContent = x.fonte;
    const m = document.createElement("span");
    m.className = "rt-m";
    m.textContent = "[" + x.tag + "] " + x.msg + (x.extra ? "  " + x.extra : "");
    li.append(q, f, m);
    cx.append(li);
  });
}
