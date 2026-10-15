/* =====================================================================
 * QUESTÕES — a tela
 *
 * Dois caminhos para as MESMAS questões, porque são dois momentos
 * diferentes de estudo:
 *  · dentro do resumo, "responder as deste tópico" — acabei de ler, quero
 *    saber se ficou;
 *  · na aba Questões, misturando disciplinas e concursos — quero simular.
 * Nenhum dos dois é dono: o banco é o mesmo (docs/questoes.js).
 * ===================================================================== */

let qsUiFiltro = { disciplina: "", concurso: "", banca: "", tipo: "",
                   soIneditas: false, soErradas: false, busca: "" };
let qsUiCtxCriar = null;      /* de qual tópico vieram as questões sendo criadas */
let qsUiAchados = null;
let qsUiDoTexto = [];   /* as que o detector achou no próprio texto */
let qsUiTextoBase = "";  /* o texto do resumo que abriu esta criação */
let qsUiEscolhas = [];   /* o que a pessoa marcou para gravar, uma por questão */
let qsUiRecibo = null;
let qsUiVoltarPara = null;    /* quem abriu a sessão: resumo ou aba */
/* A GAVETA DO RODAPÉ (encerrar/criar mais/fechar): recolhida por
 * padrão, um toque devolve. Não é preferência salva — é atenção do
 * momento — então não vai para localStorage; um recarregamento de
 * página já a devolve fechada sozinho, e enquanto a sessão dura ela
 * fica do jeito que a pessoa deixou entre uma questão e outra. */
let qsRodapeAberto = false;
/* O ENUNCIADO RECOLHIDO: ao contrário da gaveta do rodapé, este RESETA
 * a cada questão nova — recolher é uma decisão sobre O QUE JÁ FOI LIDO
 * nesta pergunta, não uma preferência de leitura. Ver qsAtual().id
 * guardado junto: repintar a MESMA questão (responder, trocar filtro)
 * não pode fechar o que a pessoa acabou de abrir. */
let qsEnunColapsado = false;
let qsEnunQid = "";
/* AS ALTERNATIVAS RISCADAS DA QUESTÃO ATUAL: puro lembrete visual de
 * quem está decidindo, nunca vai para qsResponder/qsSessao/histórico —
 * marcar e desmarcar não é "responder", é rascunho por cima da própria
 * pergunta. Reseta junto com qsEnunColapsado (mesmo gatilho de questão
 * nova), e some sozinho ao responder de verdade. */
let qsRiscadas = new Set();
/* A ALTERNATIVA ESCOLHIDA, AINDA NÃO GRAVADA — selecionar não é mais
 * responder. Reseta junto com qsEnunColapsado/qsRiscadas (mesma questão
 * nova), e também limpa sozinha assim que qsResponder grava de
 * verdade (ver o onclick das alternativas e o de btnQsProxima). */
let qsSelecionada = "";

function qsUiConcursoAtual() {
  try {
    return typeof concursoAtual === "function" ? (concursoAtual().nome || "") : "";
  } catch (e) { return ""; }
}

/* ---------------------------------------------------------------------
 * CRIAR — o mesmo ritual dos cartões: copiar o prompt, colar a resposta,
 * CONFERIR, e só então aplicar. Nada entra sozinho.
 * ------------------------------------------------------------------- */
/* UMA porta só para criar questões.
 *
 * Antes eram dois botões — "virar em questão" e "importar do texto" — e a
 * diferença entre eles era invisível de fora: os dois terminavam na mesma
 * conferência produzindo questões. A diferença real é a FONTE: uma lê o
 * que já está escrito, a outra pede à IA que escreva mais.
 *
 * Agora é uma janela só: o que já está no texto aparece pronto, e a IA é
 * um extra dentro dela, para quem quer MAIS do que o texto já tem.
 */
function qsUiCriarAbrir(texto, ctx, origem) {
  qsUiCtxCriar = ctx || null;
  qsUiAchados = null;
  qsUiDoTexto = [];
  const t0 = String(texto || "").trim();
  /* SEM RESUMO NÃO É SEM QUESTÃO.
   *
   * O DEFEITO: chamada sem texto (tópico que ainda não tem resumo
   * escrito), esta função recusava com um alerta e nunca abria a tela —
   * mesmo ela já tendo, ali dentro, o caminho de "outro material" que
   * não depende de resumo nenhum: a IA responde sobre um PDF de aula, a
   * lei, um artigo, e a resposta volta colada aqui. Questões é seu
   * próprio material, não um apêndice do resumo; ficar refém de outro
   * ter sido escrito primeiro era o oposto disso. Sem texto, a tela abre
   * igual — só que já com "outro material" marcado, porque não há nada
   * para escanear no que ninguém escreveu. */

  /* 1. o que JÁ está escrito, sem IA nenhuma */
  const blocos = qsNoTexto(t0);
  qsUiDoTexto = qsDeBlocos(blocos.filter((b) => b.completa), ctx || {});
  const incompletos = blocos.filter((b) => !b.completa).map((b) => ({
    linha: b.ini + 1, txt: String(b.enunciado || "").slice(0, 70),
    motivo: b.gabarito ? "sem_enunciado" : "sem_gabarito",
  }));

  /* 2. e o prompt, pronto, para quem quiser mais */
  qsUiTextoBase = t0;
  /* SEM TEXTO NENHUM, NÃO HÁ "A PARTIR DO TEXTO ACIMA" — o rádio que
   * aponta para um resumo vazio nasce marcado em "outro material" (e
   * desligado, para não convidar a escolher uma fonte que não existe);
   * a pessoa que escrever o resumo depois volta a ver o normal. */
  if ($("qsFonteResumo")) {
    $("qsFonteResumo").checked = !!t0;
    $("qsFonteResumo").disabled = !t0;
  }
  if ($("qsFonteOutro")) $("qsFonteOutro").checked = !t0;
  if ($("qsFonteCaderno")) $("qsFonteCaderno").checked = false;
  /* o prompt volta recolhido a cada abertura: ele é para copiar, não
   * para ler, e aberto empurra para baixo o campo que a pessoa usa */
  if ($("qsCriarPrompt")) $("qsCriarPrompt").hidden = true;
  if ($("btnQsVerPrompt")) $("btnQsVerPrompt").textContent = t("qs_ver_prompt");
  if ($("qsCriarFonte")) { $("qsCriarFonte").value = ""; $("qsCriarFonte").hidden = true; }
  qsUiRefazerPrompt();
  $("qsCriarResposta").value = "";
  /* deixa explícito ONDE elas vão parar: é isto que faz os filtros da aba
   * funcionarem depois, e vale igual quando o material vem de fora — a
   * fonte muda, o arquivamento não. */
  $("qsCriarDe").textContent = ctx
    ? t("qs_vinculadas_a", { onde: [ctx.concurso, ctx.disciplina, ctx.topico]
        .filter(Boolean).join(" · ") + (ctx.ramoNome ? " › " + t("qs_ramo_rot", { r: ctx.ramoNome }) : "") })
    : "";
  /* =================================================================
   * E DE QUAL TEXTO ELAS SAEM — que é outra pergunta.
   *
   * "Ficam guardadas em ..." responde ONDE serão arquivadas. Faltava o
   * DE ONDE: quem tocou em "criar questões do trecho" chegava a uma
   * tela cujo rádio dizia "a partir deste resumo", contradizendo o
   * botão que acabara de apertar. Sem uma linha dizendo qual texto está
   * na mão, os dois caminhos produzem telas idênticas — e a diferença
   * entre eles é justamente o texto.
   * ================================================================= */
  if ($("qsCriarOrigem")) {
    const nT = String(texto || "").length;
    $("qsCriarOrigem").textContent = !t0
      ? t("qs_criar_de_vazio")
      : origem === "trecho"
      ? t("qs_criar_de_trecho", { n: nT })
      : t("qs_criar_de_resumo", { n: nT });
    $("qsCriarOrigem").hidden = false;
  }
  /* o bloco da IA nasce fechado quando o texto já rendeu questões: nesse
   * caso o caminho curto já está pronto, e abrir o prompt seria oferecer
   * trabalho antes de mostrar o resultado */
  if ($("qsIA")) $("qsIA").open = !qsUiDoTexto.length;
  $("qsDoTextoAviso").textContent = qsUiDoTexto.length
    ? t("qs_do_texto_achei", { n: qsUiDoTexto.length })
    : t("qs_do_texto_nada");

  qsUiPintarConf(qsUiDoTexto.slice(), incompletos);
  abrirModal("dlgQsCriar");
  const porMot = {};
  incompletos.forEach((x) => { porMot[x.motivo] = (porMot[x.motivo] || 0) + 1; });
  matReg("questao", "criação de questões aberta",
         (ctx && ctx.topico ? ctx.topico + " · " : "")
         + qsUiDoTexto.length + " prontas no texto · "
         + incompletos.length + " recusadas do texto"
         + (incompletos.length ? " (" + Object.keys(porMot).sort()
             .map((k) => k + "×" + porMot[k]).join(", ") + ")" : "")
         + " · " + t0.length + " caracteres");
}


/* De onde a IA parte: deste resumo, ou de um material que você colar.
 * O resumo nem sempre é a melhor fonte — uma aula em PDF, a letra da lei ou
 * um artigo rendem questões que o resumo não tem. O que não muda é o
 * destino: as questões continuam nascendo com a disciplina, o tópico e o
 * concurso deste resumo. */
/* A DICA É DESENHADA, NÃO CUSPIDA.
 * Ela era posta como texto puro, então uma dica colada de uma página
 * aparecia com "**", "###" e "---" à mostra — pior de ler do que o texto
 * original. Passa pelo mesmo desenho do resumo: negrito vira negrito,
 * lista vira lista, quebra de linha vira quebra de linha. */
/* =====================================================================
 * QUESTÃO → CARTÕES
 *
 * Não converte sozinho. Questão e cartão são coisas diferentes: a questão
 * tem enunciado longo, alternativas e comentário; o cartão precisa caber de
 * cabeça, com uma ideia só. Copiar a questão para dentro de um cartão dá um
 * cartão ruim — e cartão ruim se revisa por meses antes de alguém notar.
 *
 * Então vai pelo mesmo caminho de sempre: prompt, colagem, conferência, e
 * gravação no material DESTE tópico, com as mesmas etiquetas dos outros
 * cartões dele. Nada de formato novo.
 * ===================================================================== */
function qsPromptCartao(q) {
  const opcoes = (q.opcoes || []).map((o) => o.letra + ") " + o.txt).join("\n");
  const gab = q.tipo === "ce"
    ? (q.gabarito === "C" ? t("qs_certo") : t("qs_errado"))
    : q.gabarito;
  const tags = (typeof matEtiquetasTopico === "function")
    ? matEtiquetasTopico(q.disciplina, q.topico, q.concurso, "questao").join(" ") : "";
  return t("qs_cartao_prompt", {
    d: q.disciplina || "?", tp: q.topico || "?",
    banca: q.banca || "—", tags,
    enunciado: q.enunciado || "",
    opcoes: opcoes || "—",
    gabarito: gab || "?",
    comentario: q.comentario || "—",
    dica: qsDicaDeQuestao(q.id) || "—",
  });
}

function qsUiCartoesDaQuestao(q) {
  if (!q) return;
  if (!q.disciplina || !q.topico) { uiAlert(t("qs_cartao_sem_topico")); return; }
  if (typeof mcApontarTopico !== "function" || typeof matCartoesAbrir !== "function") {
    uiAlert(t("qs_cartao_sem_material")); return;
  }
  $("dlgQsResponder").close();
  mcApontarTopico(q.disciplina, q.topico);
  matCartoesAbrir({
    semGravarResumo: true,
    voltarPara: "questoes",
    prompt: qsPromptCartao(q),
    sub: t("qs_cartao_sub", { tp: q.topico,
      n: (typeof matContarCartoes === "function"
          ? matContarCartoes(matChave(q.disciplina, q.topico)) : 0) }),
  });
  matReg("questao", "cartões a partir de uma questão",
         q.topico + " · " + String(q.enunciado).slice(0, 60));
}

/* volta para a rodada de questões de onde a pessoa saiu, no ponto em que
 * estava — sem perder a sessão nem obrigar a reabrir pelo caminho longo */
function qsUiVoltarASessao() {
  if (!qsSessaoAtual()) return false;
  qsUiPintarSessao();
  abrirModal("dlgQsResponder");
  return true;
}

/* UMA DOBRA, com o estado lembrado por TIPO — não por questão.
 *
 * O comentário e a dica juntos empurram as alternativas da questão
 * seguinte para fora da tela; recolhidos, a resposta certa continua à
 * vista e o resto espera ser pedido. E a decisão vale para a rodada
 * inteira: quem fecha o comentário numa questão não quer reabri-lo na
 * próxima. Guardar por questão faria o gesto recomeçar do zero a cada
 * uma, que é a forma mais rápida de a pessoa desistir de usar. */
const QS_DOBRAS = {};

/* LER EM TELA CHEIA (gabarito comentado, sua dica): o conteúdo é montado DE NOVO por 'encher' — clonar o nó perderia os
 * links de lei, que são botões com função. A letra tem passos e é guardada; fechar devolve a mesma questão. */
const QS_LER_FS = [15, 17, 19, 22, 26, 30];
function qsLerFsLer() {
  try { const v = Number(localStorage.getItem("eac_qs_ler_fs")); return QS_LER_FS.indexOf(v) >= 0 ? v : 19; } catch (e) { return 19; }
}
function qsLerFsAplicar(px) {
  const c = $("qsLerCorpo");
  if (c && c.style) c.style.setProperty("--qs-ler-fs", px + "px");
  try { localStorage.setItem("eac_qs_ler_fs", String(px)); } catch (e) {}
  return px;
}
function qsLerFsMudar(d) {
  const i = QS_LER_FS.indexOf(qsLerFsLer());
  const j = Math.max(0, Math.min(QS_LER_FS.length - 1, (i < 0 ? 2 : i) + d));
  return qsLerFsAplicar(QS_LER_FS[j]);
}
function qsUiLerAbrir(chaveTitulo, encher) {
  const box = $("qsLerCorpo");
  if (!box || typeof encher !== "function") return false;
  box.innerHTML = "";
  const interno = document.createElement("div");
  box.append(interno);
  encher(interno);
  $("qsLerTit").textContent = t(chaveTitulo);
  const pos = typeof qsPosicao === "function" ? qsPosicao() : { pos: 0, total: 0 };
  $("qsLerSub").textContent = pos.total ? t("qs_ler_sub", { i: pos.pos, n: pos.total }) : "";
  qsLerFsAplicar(qsLerFsLer());
  if (box.scrollTop !== undefined) box.scrollTop = 0;
  abrirModal("dlgQsLer");
  try { reg("QUESTOES", "leitura em tela cheia", t(chaveTitulo)); } catch (e) {}
  return true;
}
/* IR PARA A QUESTÃO Nº: anda sem responder (o placar não muda) */
async function qsUiIrPara() {
  const pos = typeof qsPosicao === "function" ? qsPosicao() : { pos: 0, total: 0 };
  if (!pos.total) return false;
  const txt = await uiTexto(t("qs_ir_tit", { n: pos.total }), String(pos.pos));
  if (txt === null) return false;
  const alvo = Math.floor(Number(String(txt).replace(/\D/g, "")));
  if (!alvo || alvo < 1 || alvo > pos.total) { try { toast("qs_ir_invalido"); } catch (e) {} return false; }
  if (alvo !== pos.pos) { qsAndar(alvo - pos.pos); qsUiPintarSessao(); }
  return true;
}

function qsUiDobra(chaveTitulo, encher) {
  const cx = document.createElement("details");
  cx.className = "qs-dobra";
  /* aberto por padrão: acabar de responder e não ver o comentário seria
   * esconder justamente o que se foi buscar */
  const aberto = QS_DOBRAS[chaveTitulo] !== false;
  /* A PROPRIEDADE é a forma canônica — o navegador reflete no atributo
   * sozinho. O atributo vai junto porque quem lê o HTML (e os testes de
   * estrutura) procura por ele. */
  cx.open = aberto;
  if (aberto) cx.setAttribute("open", "");
  else if (cx.removeAttribute) cx.removeAttribute("open");
  const cab = document.createElement("summary");
  cab.className = "qs-dobra-cab";
  cab.textContent = t(chaveTitulo);
  /* "⤢ tela cheia": o mesmo conteúdo num painel de leitura, com letra grande, X e "voltar à questão" */
  const cheia = document.createElement("button");
  cheia.type = "button";
  cheia.className = "btn-min qs-dobra-cheia";
  cheia.textContent = t("qs_ler_cheia");
  cheia.title = t("qs_ler_cheia_tip");
  cheia.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); qsUiLerAbrir(chaveTitulo, encher); };
  cab.append(cheia);
  cx.append(cab);
  const corpo = document.createElement("div");
  encher(corpo);
  cx.append(corpo);
  cx.ontoggle = () => { QS_DOBRAS[chaveTitulo] = !!cx.open; };
  return cx;
}

function qsUiCaixaDica(texto) {
  const dc = document.createElement("div");
  dc.className = "qs-minha-dica";
  try {
    dc.innerHTML = matParaHtml(String(texto || ""));
  } catch (e) {
    dc.textContent = String(texto || "");
  }
  return dc;
}

function qsUiFonteAtual() {
  const outro = $("qsFonteOutro") && $("qsFonteOutro").checked;
  const caderno = $("qsFonteCaderno") && $("qsFonteCaderno").checked;
  return {
    texto: (outro || caderno) ? "" : qsUiTextoBase,
    externo: !!(outro || caderno),
    caderno: !!caderno,
  };
}

/* MATERIAL DE FORA NÃO PRECISA PASSAR POR AQUI.
 * A primeira versão pedia para colar a aula, a lei ou o artigo dentro do
 * app só para o app devolver o mesmo texto dentro do prompt — um desvio
 * inteiro para nada. Quando a fonte é externa, o que se copia são as
 * INSTRUÇÕES; a pessoa junta com o material onde ele já está.
 * O que volta continua entrando pela mesma conferência. */
function qsUiRefazerPrompt() {
  const f = qsUiFonteAtual();
  if ($("qsCriarFonte")) $("qsCriarFonte").hidden = true;
  if ($("qsFonteNota")) {
    $("qsFonteNota").hidden = !f.externo;
    $("qsFonteNota").textContent = t("qs_fonte_nota");
  }
  /* O CADERNO TEM PROMPT PRÓPRIO.
   * Num caderno do NotebookLM a IA já está com as fontes carregadas e
   * responde ancorada nelas. Mandar ali o prompt genérico — que pede
   * "gere questões sobre este texto" e não traz texto nenhum — joga fora
   * a única vantagem real do caderno, e ainda abre a porta para ela
   * inventar de memória. O prompt do caderno exige o contrário: só o que
   * está nas fontes, com a citação de onde saiu. */
  $("qsCriarPrompt").value = f.caderno
    ? qsPromptCaderno(qsUiCtxCriar || {})
    : (f.externo
        ? qsPrompt(t("qs_marca_material"), qsUiCtxCriar || {})
        : qsPrompt(qsUiTextoBase, qsUiCtxCriar || {}));
  if ($("btnQsCopiarPrompt")) $("btnQsCopiarPrompt").disabled = false;
}

/* DUAS LEITURAS POSSÍVEIS PARA A MESMA CAIXA, NUNCA AS DUAS AO MESMO TEMPO.
 * "[QUESTAO]", "? CE ::" e os campos nomeados (TIPO:/BANCA:/ENUNCIADO:) são
 * marcas inequívocas do formato que a IA devolve. Rodar os dois parsers
 * sempre, incondicionalmente, tem dois defeitos: (1) o detector solto lia
 * "[QUESTAO] TIPO: ME BANCA: …" como enunciado corrido comum, e a linha
 * "A) opção" da IA virava opção de uma QUESTÃO FANTASMA que fechava sozinha
 * no "GABARITO: …" dela — um achado mutilado por cima do que já tinha sido
 * lido certo; (2) o inverso também é ruim: qsLerResposta, ao ler um texto
 * pronto que ele não entende, marca CADA LINHA como "linha solta, fora de
 * qualquer questão" — nove linhas de ruído para uma questão só. Por isso a
 * escolha do parser é EXCLUSIVA, pelo formato do texto colado.
 * "GABARITO:"/"COMENTARIO:" ficam de fora do teste: são também os nomes dos
 * campos do texto pronto (sem acento "GABARITO" bate com os dois; com
 * acento "COMENTÁRIO" só existe no formato solto). */
function qsPareceRespostaDeIA(txt) {
  return /\[\s*\/?\s*QUEST[ÃA]O\s*\]/i.test(txt)
    || /^\s*\?\s*[A-Za-z]{2,4}\s*::/m.test(txt)
    || /^\s*(TIPO|BANCA|ENUNCIADO)\s*:/im.test(txt);
}

function qsUiConferir() {
  const bruto = $("qsCriarResposta").value;
  /* A MESMA CAIXA aceita ou a resposta da IA (os dois formatos que
   * qsLerResposta entende) OU um texto de prova já pronto — enunciado,
   * alternativas a)...e), "Comentário:" e "Gabarito:" — copiado direto de
   * um PDF ou cursinho, sem passar pela IA. qsNoTexto(..., {solto:true}) é
   * o mesmo detector usado no resumo, só sem exigir a palavra "Questão". */
  const ehRespostaDeIA = qsPareceRespostaDeIA(bruto);
  const r = ehRespostaDeIA ? qsLerResposta(bruto, qsUiCtxCriar || {}) : { achados: [], ignoradas: [] };
  const blocosProntos = ehRespostaDeIA ? [] : qsNoTexto(bruto, { solto: true });
  const prontas = qsDeBlocos(blocosProntos.filter((b) => b.completa), qsUiCtxCriar || {});
  const incompletas = blocosProntos.filter((b) => !b.completa).map((b) => ({
    linha: b.ini + 1, txt: String(b.enunciado || "").slice(0, 70),
    motivo: b.gabarito ? "sem_enunciado" : "sem_gabarito",
  }));
  const ignoradas = r.ignoradas.concat(incompletas);
  /* SOMA às que vieram do texto, em vez de substituir: quem pediu mais à IA
   * não quis abrir mão das que já tinha. Sem duplicar o que a IA devolveu
   * (ou o texto pronto) igual ao que já estava escrito. */
  const juntas = qsUiDoTexto.slice();
  let repetidas = 0;
  r.achados.concat(prontas).forEach((q) => {
    if (juntas.some((v) => qsNormal(v.enunciado) === qsNormal(q.enunciado))) {
      repetidas++; return;
    }
    juntas.push(q);
  });
  qsUiPintarConf(juntas, ignoradas);
  /* REGISTRO PARA MELHORAR O PROMPT.
   * Só o total não ajuda: para saber o que ajustar é preciso saber POR QUE
   * cada uma foi recusada e quantas de cada motivo. É este detalhe que
   * transforma "2 recusadas" em "a IA não fecha o gabarito em CE". */
  const porMotivo = {};
  ignoradas.forEach((x) => { porMotivo[x.motivo] = (porMotivo[x.motivo] || 0) + 1; });
  const detalhe = Object.keys(porMotivo).sort()
    .map((k) => k + "×" + porMotivo[k]).join(", ");
  const lidas = r.achados.length + prontas.length;
  matReg("questao", "conferência de questões",
         lidas + " lidas (" + r.achados.length + " da IA, " + prontas.length + " de texto pronto) · "
         + repetidas + " repetidas do texto · "
         + ignoradas.length + " recusadas"
         + (detalhe ? " · motivos: " + detalhe : "")
         + " · formato: " + (/\[QUESTAO\]/i.test(bruto)
             ? "campos nomeados" : (prontas.length ? "texto pronto" : "linha compacta")));
  /* O MESMO no registro da geração — e ali com os motivos linha a linha,
   * não só a contagem por motivo. "gabarito_fora_das_opcoes×2" diz o que
   * ajustar no prompt; a linha e o enunciado dizem QUAL questão. */
  try {
    gerReg("questoes", "leitura", "resposta da IA conferida",
      lidas + " lida(s) · " + repetidas + " repetida(s) do texto · "
      + ignoradas.length + " recusada(s)"
      + " · formato: " + (/\[QUESTAO\]/i.test(bruto)
          ? "campos nomeados" : (prontas.length ? "texto pronto" : "linha compacta")),
      { topico: (qsUiCtxCriar || {}).topico || "",
        disciplina: (qsUiCtxCriar || {}).disciplina || "",
        motivos: ignoradas,
        numeros: { lidas, repetidas,
                   recusadas: ignoradas.length } });
  } catch (e) {}
}

/* o desenho da conferência é o mesmo vindo da IA ou vindo do texto: o que
 * muda é de onde as questões saíram, não o que precisa ser conferido */
function qsUiPintarConf(achados, ignoradas) {
  const r = { achados: achados || [], ignoradas: ignoradas || [] };
  qsUiAchados = r.achados;
  qsUiEscolhas = [];
  const box = $("qsCriarConf");
  box.innerHTML = "";

  r.achados.forEach((q, i) => {
    const par = qsSemelhante(q);
    const li = document.createElement("div");
    li.className = "qs-conf" + (par ? " qs-conf-rep" : "");

    /* a escolha fica com quem está olhando. Sem duplicata, marcado; com
     * duplicata, desmarcado — mas VISÍVEL, e ao lado da que já existe. */
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !par;
    qsUiEscolhas.push({ cb, q, par });

    const cab = document.createElement("label");
    cab.className = "qs-conf-cab";
    cab.append(cb, document.createTextNode(" [" + (i + 1) + "] "
      + t("qs_tipo_" + q.tipo) + (q.banca ? " · " + q.banca : "")
      + " · " + t("qs_gab_e", { g: q.gabarito })));
    li.append(cab);

    const en = document.createElement("div");
    en.className = "qs-conf-en";
    en.textContent = q.enunciado;
    li.append(en);
    q.opcoes.forEach((o) => {
      const op = document.createElement("div");
      op.className = "qs-conf-op" + (o.letra === q.gabarito ? " certa" : "");
      op.textContent = o.letra + ") " + o.txt;
      li.append(op);
    });
    if (q.comentario) {
      const cm = document.createElement("div");
      cm.className = "qs-conf-cm";
      cm.textContent = q.comentario;
      li.append(cm);
    }

    if (par) {
      /* MOSTRA A OUTRA. Dizer "repetida" sem mostrar contra o quê obriga a
       * acreditar; mostrando as duas, dá para conferir. */
      const av = document.createElement("div");
      av.className = "qs-conf-aviso";
      av.textContent = t("qs_rep_" + par.como,
        { pct: Math.round(par.score * 100),
          tp: par.existente.topico || "—" });
      const ja = document.createElement("div");
      ja.className = "qs-conf-ja";
      ja.textContent = t("qs_rep_ja") + " " + par.existente.enunciado;
      li.append(av, ja);
    }
    box.append(li);
  });

  /* o que nem chegou a virar questão, com o motivo e o texto inteiro */
  r.ignoradas.forEach((x) => {
    const li = document.createElement("div");
    li.className = "qs-conf qs-conf-ruim";
    const cab = document.createElement("div");
    cab.className = "qs-conf-cab";
    cab.textContent = t("qs_recusada", { l: x.linha,
      m: t("qs_motivo_" + x.motivo) || x.motivo });
    const tx = document.createElement("div");
    tx.className = "qs-conf-en";
    tx.textContent = x.txt || "";
    li.append(cab, tx);
    box.append(li);
  });

  const contar = () => {
    const n = qsUiEscolhas.filter((e) => e.cb.checked).length;
    const reps = qsUiEscolhas.filter((e) => e.par).length;
    $("qsCriarResumo").textContent = t("qs_conf_resumo2",
      { n, tot: r.achados.length, rep: reps, rec: r.ignoradas.length });
    $("btnQsCriarAplicar").disabled = !n;
  };
  qsUiEscolhas.forEach((e) => { e.cb.onchange = contar; });
  contar();
}

/* ---------------------------------------------------------------------
 * D3 — importar as questões que JÁ estão escritas no resumo
 *
 * Sem IA e sem prompt: o detector já leu o texto. Mas passa pela MESMA
 * conferência, porque a detecção pode errar — e porque é aqui que se
 * confirma a banca, já que o parêntese do enunciado nem sempre é uma
 * ("(Questão de Pegadinha)" não é banca).
 * ------------------------------------------------------------------- */



function qsUiAplicar() {
  if (!qsUiEscolhas || !qsUiEscolhas.length) return;
  const escolhidas = qsUiEscolhas.filter((e) => e.cb.checked);
  if (!escolhidas.length) return;
  const deixadas = qsUiEscolhas.filter((e) => !e.cb.checked);
  /* quem marcou uma repetida quis gravar mesmo assim: a decisão dela vale
   * mais do que a regra automática */
  qsUiRecibo = qsAplicar(escolhidas.map((e) => {
    if (e.par) e.q._forcar = true;
    return e.q;
  }));
  $("dlgQsCriar").close();
  qsUiMostrarDesfazer(qsUiRecibo);
  qsUiPintarBotaoResumo();
  qsUiRender();
  /* REGISTRO COM CARA: quantas entraram, quantas a PESSOA deixou de fora,
   * e o começo do enunciado de cada uma que ficou de fora. "6 repetidas"
   * não deixa ninguém conferir depois se a decisão foi boa. */
  const foraTxt = deixadas.map((e) =>
    (e.par ? "[" + e.par.como + "] " : "") + String(e.q.enunciado).slice(0, 60))
    .join(" | ");
  matReg("questao", "questões gravadas",
         qsUiRecibo.novas + " gravadas · " + deixadas.length + " deixadas de fora"
         + (foraTxt ? " → " + foraTxt : ""));
  try {
    gerReg("questoes", "gravacao", "questões gravadas",
      qsUiRecibo.novas + " gravada(s) · " + deixadas.length + " deixada(s) de fora",
      { topico: (qsUiCtxCriar || {}).topico || "",
        disciplina: (qsUiCtxCriar || {}).disciplina || "",
        motivos: deixadas.map((e) => ({
          linha: e.q.linha || 0,
          txtMotivo: e.par ? t("qs_ger_fora_rep") : t("qs_ger_fora_voce"),
          txt: String(e.q.enunciado || "").slice(0, 90) })),
        numeros: { gravadas: qsUiRecibo.novas, fora: deixadas.length } });
  } catch (e) {}
  uiAlert(t("qs_aplicadas2", { n: qsUiRecibo.novas, f: deixadas.length }));
}

function qsUiMostrarDesfazer(rec) {
  const b = $("qsDesfazer");
  if (!b || !rec || !rec.novas) return;
  b.hidden = false;
  $("qsDesfazerTxt").textContent = t("qs_desfazer_txt", { n: rec.novas });
}

function qsUiDesfazer() {
  if (!qsUiRecibo) return;
  const n = qsDesfazer(qsUiRecibo);
  qsUiRecibo = null;
  $("qsDesfazer").hidden = true;
  qsUiPintarBotaoResumo();
  qsUiRender();
  matReg("questao", "gravação de questões desfeita", n + " questões");
}

/* ---------------------------------------------------------------------
 * RESPONDER — o gabarito só depois da escolha
 * ------------------------------------------------------------------- */
/* RETOMAR OU RECOMEÇAR.
 * Fechar a janela deixava a rodada para trás: reabrir mostrava as 31 de
 * novo, inclusive as já respondidas. Agora a sessão é guardada, e ao
 * reabrir o MESMO escopo a pessoa escolhe — nunca se decide por ela, que
 * é o que faria perder o que já tinha sido feito. */
async function qsUiResponderAbrir(lista, deOnde, escopo) {
  if (!lista || !lista.length) { uiAlert(t("qs_nenhuma_para_responder")); return; }
  qsUiVoltarPara = deOnde || null;
  const esc = escopo || ("de:" + (deOnde || "aba"));

  const retomavel = qsSessaoRetomavel(esc);
  let retomou = false;
  if (retomavel) {
    /* O ESCOPO PEDIDO E O ESCOPO ENCONTRADO, lado a lado. Sem isto, um
     * "continuar de onde parei" que aparece no lugar errado (relatado
     * uma vez, sem conseguir reproduzir) não deixa rastro nenhum — o
     * registro mostra o resultado da escolha, nunca a comparação que
     * levou a ela. */
    try {
      reg("QUESTOES", "rodada retomavel encontrada para este escopo",
          "pedido=" + esc + " · encontrado=" + retomavel.escopo
          + " · " + retomavel.feitas + "/" + retomavel.total);
    } catch (e) {}
    /* DUAS SITUAÇÕES DIFERENTES, E DUAS PERGUNTAS DIFERENTES.
     *
     * Rodada PELA METADE: o que se oferece é continuar de onde parou.
     * Rodada TERMINADA e não registrada: continuar não quer dizer nada
     * — não há questão pendente. O que ficou faltando é lançar a hora
     * no diário, e é isso que a tela tem de oferecer. Oferecer
     * "continuar" aqui foi o que fez a rodada de 32 parecer perdida:
     * ela reabria do zero e o placar sumia. */
    const dados = {
      f: retomavel.feitas, n: retomavel.total,
      c: retomavel.certas,
      pct: retomavel.feitas ? Math.round((retomavel.certas / retomavel.feitas) * 100) : 0,
    };
    if (retomavel.terminada) {
      const r = await uiEscolha(t("qs_terminada_perg", dados), [
        { valor: "registrar", rot: t("qs_terminada_reg"), classe: "btn-verde" },
        { valor: "recomecar", rot: t("qs_terminada_nova"), classe: "btn-azul" },
        { valor: "sair", rot: t("cancel_btn") },
      ]);
      if (r === "sair" || r === null) return;
      if (r === "registrar") {
        if (qsSessaoRetomar(esc)) {
          abrirModal("dlgQsResponder");
          qsUiPintarSessao();
          qsUiRegistrarEstudo();
          return;
        }
      }
      /* recomeçar: a rodada velha some, e some SEM ser registrada —
       * foi escolha explícita de quem estava olhando o placar dela */
      try {
        reg("QUESTOES", "rodada terminada descartada sem registrar",
            dados.f + " de " + dados.n + " · " + dados.c + " certas");
      } catch (e) {}
      try { qsSessaoApagar(); } catch (e) {}
    } else {
      const r = await uiEscolha(t("qs_retomar_perg", dados), [
        { valor: "continuar", rot: t("qs_retomar_sim"), classe: "btn-verde" },
        { valor: "recomecar", rot: t("qs_retomar_nao"), classe: "btn-azul" },
        { valor: "sair", rot: t("cancel_btn") },
      ]);
      if (r === "sair" || r === null) return;
      if (r === "continuar") retomou = !!qsSessaoRetomar(esc);
    }
  }
  if (!retomou) {
    qsSessaoIniciar(lista, { embaralhar: true, escopo: esc });
    /* O BLOCO ENTRA NO HISTÓRICO AO COMEÇAR, não ao terminar — rodada
     * abandonada no meio é informação, talvez a mais útil, porque diz
     * onde o estudo emperra. E entra pelo MESMO caminho venha ela da
     * agenda ou da aba: dois formatos para o mesmo gesto seriam duas
     * listas que nunca somam. */
    try {
      qhIniciar(lista, {
        origem: deOnde || "aba", escopo: esc,
        filtro: qsUiFiltroDoEscopo(esc, deOnde),
      });
    } catch (e) {}
  }
  else {
    /* questões criadas depois que a rodada começou entram no fim, em vez
     * de obrigar a recomeçar para incluí-las */
    const n = qsSessaoAcrescentar(lista);
    if (n) matReg("questao", "questões novas somadas à sessão", n + " questões");
  }
  qsUiPintarSessao();
  abrirModal("dlgQsResponder");
  matReg("questao", retomou ? "sessão de questões retomada" : "sessão de questões iniciada",
         qsPlacar().total + " questões · " + (deOnde || "aba")
         + (retomou ? " · " + qsPlacar().feitas + " já feitas" : ""));
}

/* A GAVETA DO RODAPÉ, no mesmo molde de leiGaveta (docs/lei-ui.js):
 * alterna "hidden" sem persistir em lugar nenhum — quem quer ver
 * "encerrar agora"/"criar mais questões"/"Fechar" pede uma vez, e o
 * pedido vale até fechar a sessão. Chamada tanto pelo toque na alça
 * quanto no fim de qsUiPintarSessao, para o rótulo nunca ficar
 * desatualizado depois de repintar a questão. */
function qsRodapePintar() {
  const rod = $("qsRodape");
  if (rod) rod.hidden = !qsRodapeAberto;
  const alca = $("btnQsRodapeAlternar");
  if (alca) {
    alca.textContent = t(qsRodapeAberto ? "qs_rodape_recolher" : "qs_rodape_mostrar");
    alca.title = t("qs_rodape_ajuda");
  }
}

function qsOpRiscada(letra) { return qsRiscadas.has(letra); }

/* LIGA/DESLIGA O TRAÇO — mesmo gesto para marcar e para desfazer, em vez
 * de um jeito de marcar e outro de apagar. Pura função de estado; quem
 * decide QUANDO chamar é o reconhecedor de gesto (qsOpGestoLigar) — dá
 * para testar o efeito de um arrasto sem precisar simular um
 * PointerEvent de verdade, que o simulador de testes não despacha. */
function qsOpRiscarAlternar(letra) {
  if (qsRiscadas.has(letra)) qsRiscadas.delete(letra); else qsRiscadas.add(letra);
  qsUiPintarSessao();
}

/* =====================================================================
 * ARRASTAR UMA ALTERNATIVA PARA A DIREITA RISCA ELA
 *
 * O MESMO BOTÃO JÁ RESPONDE NO TOQUE (onclick, acima) — o gesto de
 * arrastar não pode competir com isso nem com o SCROLL da página, que é
 * o gesto muito mais comum num elemento dentro de uma lista que rola.
 * A saída, com Pointer Events unificados (toque/mouse/caneta, o mesmo
 * padrão de docs/rascunho.js): não decide nada no pointerdown; no
 * pointermove, se o deslocamento vertical passar o horizontal, é
 * rolagem — desiste e deixa o navegador cuidar; só quando o horizontal
 * (para a DIREITA) passa de um limiar é que vira um arrasto de verdade,
 * e aí sim trava a rolagem (preventDefault) e mostra o traço crescendo.
 *
 * O CLIQUE NATIVO JÁ SE CUIDA SOZINHO: navegadores não disparam "click"
 * depois de um pointerdown→pointermove(bastante)→pointerup — é assim
 * que um arrasto não vira também uma resposta. Por isso esta função
 * nunca precisa (nem tenta) impedir o onclick diretamente.
 * ===================================================================== */
function qsOpGestoLigar(el, letra) {
  if (!el || typeof el.addEventListener !== "function") return;
  const LIMIAR_ARRASTO = 24;   /* px para reconhecer "isto é um arrasto" */
  const LIMIAR_RISCAR = 56;    /* px para confirmar a marca ao soltar */
  let x0 = 0, y0 = 0, ativo = false, arrastando = false;

  const limpar = () => {
    ativo = false; arrastando = false;
    el.classList.remove("qs-op-arrastando");
    el.style.removeProperty("--qs-op-arrasto");
  };
  el.addEventListener("pointerdown", (ev) => {
    x0 = ev.clientX; y0 = ev.clientY; ativo = true; arrastando = false;
  });
  el.addEventListener("pointermove", (ev) => {
    if (!ativo) return;
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!arrastando) {
      /* rolando a lista, não arrastando a alternativa: desiste cedo */
      if (Math.abs(dy) > Math.abs(dx) + 6) { ativo = false; return; }
      if (dx > LIMIAR_ARRASTO) {
        arrastando = true;
        try { el.setPointerCapture(ev.pointerId); } catch (e) {}
      }
    }
    if (arrastando) {
      if (ev.preventDefault) ev.preventDefault();
      const p2 = Math.min(1, Math.max(0, dx / (LIMIAR_RISCAR + 30)));
      el.style.setProperty("--qs-op-arrasto", String(p2));
      el.classList.add("qs-op-arrastando");
    }
  });
  el.addEventListener("pointerup", (ev) => {
    if (arrastando) {
      const dx = ev.clientX - x0;
      if (dx > LIMIAR_RISCAR) qsOpRiscarAlternar(letra);
    }
    limpar();
  });
  el.addEventListener("pointercancel", limpar);
}

function qsUiPintarSessao() {
  const q = qsAtual();
  const p = qsPlacar();
  /* TROCOU DE QUESTÃO: o recolhido da anterior não é decisão sobre a de
   * agora. Repintar a MESMA questão (responder, ligar um filtro) não
   * mexe aqui — senão um clique em "embaralhar" fecharia o enunciado
   * que a pessoa acabou de abrir. */
  if (q && q.id !== qsEnunQid) {
    qsEnunQid = q.id; qsEnunColapsado = false; qsRiscadas.clear(); qsSelecionada = "";
  }
  /* DUAS INFORMAÇÕES, E NÃO UMA ESPREMIDA EM DUAS.
   *
   * "1 de 32" era respondidas+1 — progresso disfarçado de posição. Com
   * zero respondidas ele dizia "1 de 32" estivesse você na primeira ou
   * na décima, e pular (que é andar sem responder) não mexia em nada.
   * Agora a POSIÇÃO anda com você e o PLACAR anda com as respostas. */
  const pos = qsPosicao();
  $("qsSessPlacar").textContent = t("qs_placar",
    { i: pos.pos || Math.min(p.feitas + (q ? 1 : 0), p.total),
      n: pos.total || p.total,
      f: p.feitas, c: p.certas, pct: p.pct });

  const corpo = $("qsSessCorpo");
  corpo.innerHTML = "";
  /* O ESTADO SE ZERA AQUI, no mesmo lugar em que o conteúdo se zera.
   * Deixá-lo para o fim da função significaria que o caminho do FIM DA
   * RODADA — que sai antes, por um return — herdaria a classe da última
   * questão respondida, e a tela final abriria com o arranjo de uma
   * tela que não existe mais. */
  corpo.className = "qs-sess";
  if (!q) {
    /* FIM DA SESSÃO.
     * O placar sozinho não ensina nada. O que ensina é rever o que se
     * errou — com o gabarito comentado ao lado e o lugar para escrever a
     * dica que vai evitar o erro da próxima vez. */
    const fim = document.createElement("div");
    fim.className = "qs-fim";
    /* NUMA REPESCAGEM o placar é DELA, e o rótulo tem de dizer isso.
     * "8 de 10, 80%" logo depois de uma rodada de 60% seria lido como
     * "melhorei de 60 para 80" — e não é: são conjuntos diferentes, um
     * deles feito só do que já tinha dado errado. */
    fim.textContent = t(qsSessao && qsSessao.repescagem ? "qs_fim_rep" : "qs_fim",
      { c: p.certas, n: p.feitas, pct: p.pct });
    corpo.append(fim);

    /* DUAS SAÍDAS, e as duas no topo do fim da rodada: é aqui que se
     * decide o que fazer com o que acabou de acontecer, e ter de rolar
     * até o rodapé para achá-las fazia o placar virar um beco. */
    const acoes = document.createElement("div");
    acoes.className = "qs-fim-acoes";
    const bReg = document.createElement("button");
    bReg.type = "button";
    bReg.className = "btn btn-verde";
    bReg.textContent = t("qs_registrar_btn");
    bReg.title = t("qs_registrar_ajuda");
    bReg.onclick = () => qsUiRegistrarEstudo();
    acoes.append(bReg);

    const erradasQ = qsErradasDaSessao();
    if (erradasQ.length) {
      const bRep = document.createElement("button");
      bRep.type = "button";
      bRep.className = "btn btn-azul";
      bRep.id = "btnQsRepescar";
      bRep.textContent = t("qs_repescar", { n: erradasQ.length });
      bRep.title = t("qs_repescar_ajuda");
      bRep.onclick = () => qsUiRepescar();
      acoes.append(bRep);
    }
    corpo.append(acoes);

    const erradas = (qsSessao ? qsSessao.respondidas : [])
      .filter((x) => !x.acertou)
      .map((x) => ({ resp: x.resp,
                     q: qsSessao.fila.filter((y) => y.id === x.id)[0] }))
      .filter((x) => x.q);

    if (erradas.length) {
      const tit = document.createElement("div");
      tit.className = "qs-rev-tit";
      tit.textContent = t("qs_rever_tit", { n: erradas.length });
      corpo.append(tit);

      erradas.forEach((x) => {
        const li = document.createElement("div");
        li.className = "qs-rev";
        const en = document.createElement("div");
        en.className = "qs-rev-en";
        en.textContent = x.q.enunciado;
        const suaResp = x.q.tipo === "ce"
          ? (x.resp === "C" ? t("qs_certo") : t("qs_errado"))
          : x.resp;
        const gabTxt = x.q.tipo === "ce"
          ? (x.q.gabarito === "C" ? t("qs_certo") : t("qs_errado"))
          : x.q.gabarito;
        const lin = document.createElement("div");
        lin.className = "qs-rev-gab";
        lin.textContent = t("qs_rev_resp", { sua: suaResp, gab: gabTxt });
        li.append(en, lin);
        if (x.q.comentario) {
          const cm = document.createElement("div");
          cm.className = "qs-coment";
          cm.textContent = x.q.comentario;
          li.append(cm);
        }
        const minha = qsDicaDeQuestao(x.q.id);
        if (minha) li.append(qsUiCaixaDica(minha));
        const bcart = document.createElement("button");
        bcart.type = "button"; bcart.className = "btn-min qs-bt-dica";
        bcart.textContent = t("qs_cartao_btn");
        bcart.title = t("qs_cartao_ajuda");
        bcart.onclick = () => qsUiCartoesDaQuestao(x.q);
        li.append(bcart);

        const bd = document.createElement("button");
        bd.type = "button"; bd.className = "btn-min qs-bt-dica";
        bd.textContent = t(minha ? "qs_dica_editar" : "qs_dica_incluir");
        bd.title = t("qs_dica_ajuda");
        bd.onclick = async () => {
          const txt = await uiTexto(
            t("qs_dica_tit", { e: x.q.enunciado.slice(0, 90) }), minha,
            null, qsUiCopiarNaDica(x.q));
          if (txt === null) return;
          qsGravarDica(x.q.id, txt);
          matReg("questao", "dica escrita na revisão dos erros",
                 x.q.enunciado.slice(0, 60));
          qsUiPintarSessao();
        };
        li.append(bd);
        corpo.append(li);
      });
    }

    /* REGISTRAR O ESTUDO. Resolver questão é estudar; sem isto, a hora
     * gasta aqui não entrava no diário e o progresso do edital ficava
     * menor do que o real. */
    /* A RODADA TERMINADA NÃO É APAGADA AQUI — e esta linha apagava.
     *
     * O raciocínio antigo era "acabou, não há o que continuar", e ele
     * confunde duas perguntas: "sobrou questão?" e "esta rodada já virou
     * estudo lançado?". Respondidas as 32 de 32, a sessão sumia; quem
     * fechasse sem tocar em "registrar" perdia o placar da rodada e
     * reabria numa rodada nova, do zero, sem caminho de volta para
     * lançar a hora. Uma hora de estudo evaporando por causa de um botão
     * não tocado é exatamente o defeito que o próprio "encerrar agora"
     * existia para consertar, reaparecendo no fim da fila.
     *
     * Quem apaga agora é o registro (qsSessaoRegistrada), e só depois de
     * o estudo estar no diário. */
    if (p.feitas) {
      const br = document.createElement("button");
      br.type = "button";
      br.className = "btn btn-verde qs-bt-registrar";
      br.textContent = t("qs_registrar_btn");
      br.title = t("qs_registrar_ajuda");
      br.onclick = () => qsUiRegistrarEstudo();
      corpo.append(br);
    }
    $("btnQsProxima").hidden = true;
    if ($("btnQsPular")) $("btnQsPular").hidden = true;
    if ($("btnQsSoFalhas")) {
      /* no fim da rodada o filtro continua à mão: é dali que se volta
       * para as erradas sem recomeçar tudo */
      const lig = qsFiltroFalhasLigado();
      $("btnQsSoFalhas").hidden = !qsQuantasFalhas() && !lig;
      $("btnQsSoFalhas").textContent =
        t(lig ? "qs_so_falhas_on" : "qs_so_falhas", { n: qsQuantasFalhas() });
      $("btnQsSoFalhas").className = "btn-min" + (lig ? " qs-filtro-on" : "");
    }
    /* acabou a rodada: o papel de lado nao tem mais a que se referir */
    try { rsPrepararPara(null); } catch (e) {}
    return;
  }
  /* O rascunho pertence A QUESTAO: trocar de questao troca o papel.
   * Se ele acompanhasse a sessao, a conta da questao 3 apareceria por
   * cima do esquema da questao 4. */
  try { if (!rsMesmaQuestao(q.id)) rsPrepararPara(q.id); } catch (e) {}

  const de = document.createElement("div");
  de.className = "qs-de";
  de.textContent = [q.concurso, q.banca, q.disciplina, q.topico]
    .filter(Boolean).join(" · ");
  const en = document.createElement("div");
  en.className = "qs-enunciado" + (qsEnunColapsado ? " qs-enun-colapsado" : "");
  en.textContent = q.enunciado;
  corpo.append(de);
  /* O GRIFO É O PRÓPRIO TEXTO, e não uma camada por cima dele.
   * Nada intercepta clique, nada precisa ser ligado: selecionar texto
   * sempre foi possível, e as cores só agem sobre o que está
   * selecionado. */
  try {
    grEnvolver(en, q.id, q.enunciado);
    corpo.append(en);
    corpo.append(qsUiFerramentas(q));
  } catch (e) { corpo.append(en); }

  /* HISTÓRICO DESTA QUESTÃO, ANTES DE RESPONDER — SEM ENTREGAR O GABARITO.
   * Saber que já se errou isto duas vezes muda a atenção com que se lê.
   * Mas só o PLACAR aparece: dizer QUAL letra foi marcada da última vez
   * seria, numa questão de certo/errado, contar a resposta. */
  const ts = q.tentativas || [];
  if (ts.length) {
    const hs = document.createElement("div");
    const certas = ts.filter((x) => x.acertou).length;
    hs.className = "qs-hist" + (certas === ts.length ? " ok"
      : (certas === 0 ? " nao" : ""));
    const ult = new Date(ts[ts.length - 1].q);
    const dias = Math.floor((Date.now() - ult.getTime()) / 86400000);
    hs.textContent = t("qs_hist_desta", {
      n: ts.length, c: certas,
      quando: dias <= 0 ? t("qs_hist_hoje") : t("qs_hist_dias", { d: dias }),
    });
    hs.title = t("qs_hist_ajuda");
    corpo.append(hs);
  }

  const jaFoi = qsJaRespondida();
  /* JÁ RESPONDIDA NÃO TEM "SELECIONADA" — é conceito de decisão em
   * aberto; travar isso aqui evita que uma seleção velha (de antes de
   * responder por outro caminho, ex. pular e voltar) sobreviva à toa. */
  if (jaFoi) qsSelecionada = "";
  const opcoes = q.tipo === "ce"
    ? [{ letra: "C", txt: t("qs_certo") }, { letra: "E", txt: t("qs_errado") }]
    : q.opcoes;

  const cx = document.createElement("div");
  cx.className = "qs-opcoes";
  opcoes.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    /* RISCADA E SELECIONADA SÃO SÓ ANTES DE RESPONDER — depois disso as
     * cores já contam a história de verdade (certa/errada), e qualquer
     * uma das duas juntas confundiria mais do que ajudaria. */
    let cls = "qs-op";
    if (!jaFoi && qsOpRiscada(o.letra)) cls += " qs-op-risc";
    if (!jaFoi && qsSelecionada === o.letra) cls += " qs-op-sel";
    if (jaFoi) {
      /* depois de responder, as cores contam a história: verde no gabarito,
       * vermelho só no que a pessoa escolheu e estava errado */
      if (o.letra === q.gabarito) cls += " qs-op-certa";
      else if (o.letra === jaFoi.resp) cls += " qs-op-errada";
    }
    b.className = cls;
    if (jaFoi) b.disabled = true;
    /* A LETRA NUM CÍRCULO (o ") " fica escondido, mas o texto continua "B) ..." para quem lê o DOM) */
    const bl = document.createElement("span"); bl.className = "qs-op-l"; bl.textContent = o.letra;
    const bp = document.createElement("span"); bp.className = "qs-op-p"; bp.textContent = ") ";
    const bt2 = document.createElement("span"); bt2.className = "qs-op-t"; bt2.textContent = String(o.txt);
    b.append(bl, bp, bt2);
    /* TOCAR SÓ SELECIONA — quem responde de verdade é o botão grande
     * (btnQsProxima, que vira "responder" enquanto não há resposta
     * gravada). Antes o toque já respondia na hora; o pedido foi
     * separar "escolher" de "confirmar", para dar chance de mudar de
     * ideia antes de valer. */
    b.onclick = () => {
      if (jaFoi) return;
      qsSelecionada = o.letra;
      qsUiPintarSessao();
    };
    /* ARRASTAR PARA A DIREITA RISCA A ALTERNATIVA — lembrete de "isto
     * está errado", sem impedir escolhê-la depois: o traço é conselho de
     * quem está decidindo, não uma trava. Só liga enquanto ainda dá para
     * responder; depois de jaFoi o botão já está desabilitado e não há
     * mais decisão para marcar. */
    if (!jaFoi) qsOpGestoLigar(b, o.letra);
    cx.append(b);
  });
  corpo.append(cx);

  /* =================================================================
   * ANTES E DEPOIS DE RESPONDER SÃO DUAS TELAS, NÃO UMA
   *
   * ANTES, o que se lê é o enunciado e o que se decide são as
   * alternativas: as alternativas ancoram no pé e o enunciado rola
   * atrás delas.
   *
   * DEPOIS, as alternativas viram botões desligados — não há mais o
   * que clicar nelas — e o que se lê é o comentário. Mantendo o mesmo
   * arranjo, o comentário nascia embaixo de tudo, fora da área que
   * rola, e a única forma de alcançá-lo era arrastar a caixa inteira.
   * Era esta a queixa.
   *
   * Então tudo o que aparece DEPOIS entra num bloco só, que passa a
   * ser a parte elástica da caixa. Não é enfeite de CSS: sem um
   * elemento para chamar de "o depois", não há o que tornar elástico —
   * seis irmãos soltos não podem ser um bloco de rolagem.
   * ================================================================= */
  if (jaFoi) {
    const depois = document.createElement("div");
    depois.className = "qs-depois";
    const gb = document.createElement("div");
    gb.className = "qs-gab " + (jaFoi.acertou ? "qs-gab-ok" : "qs-gab-nao");
    gb.textContent = (jaFoi.acertou ? t("qs_acertou") : t("qs_errou"))
      + " · " + t("qs_gab_e", { g: q.gabarito });

    /* "VIRAR EM CARTÕES" E "INCLUIR/EDITAR MINHA DICA", AO LADO DO
     * GABARITO — moravam soltos no fim de tudo, do tamanho de qualquer
     * outro botão, empurrando o comentário pra baixo à toa. São duas
     * ações de bolso (o gesto comum nem usa nenhuma delas), então
     * ficam pequenas e na mesma linha do "Errou · gabarito: X", que já
     * é a linha mais curta do bloco — sobra espaço ali mesmo. */
    const minha = qsDicaDeQuestao(q.id);
    const gbLinha = document.createElement("div");
    gbLinha.className = "qs-gab-linha";
    const acoes = document.createElement("span");
    acoes.className = "qs-gab-acoes";

    const bc = document.createElement("button");
    bc.type = "button";
    bc.className = "btn-min qs-bt-dica qs-bt-mini";
    bc.textContent = t("qs_cartao_btn");
    bc.title = t("qs_cartao_ajuda");
    bc.onclick = () => qsUiCartoesDaQuestao(q);
    acoes.append(bc);

    const bd = document.createElement("button");
    bd.type = "button";
    bd.className = "btn-min qs-bt-dica qs-bt-mini";
    bd.textContent = t(minha ? "qs_dica_editar" : "qs_dica_incluir");
    bd.title = t("qs_dica_ajuda");
    bd.onclick = async () => {
      const txt = await uiTexto(t("qs_dica_tit", { e: q.enunciado.slice(0, 90) }),
        minha, null, qsUiCopiarNaDica(q));
      if (txt === null) return;
      qsGravarDica(q.id, txt);
      matReg("questao", txt.trim() ? "dica da questão guardada" : "dica da questão apagada",
             q.enunciado.slice(0, 60));
      qsUiPintarSessao();
    };
    acoes.append(bd);

    gbLinha.append(gb, acoes);
    depois.append(gbLinha);

    if (q.comentario) {
      let elCom = null;
      depois.append(qsUiDobra("qs_coment_tit", (el) => { elCom = el; return qsUiComentario(el, q); }));
      /* "🔗 vínculos de lei": ver o que o app entendeu em cada citação, corrigir uma
       * ("este vínculo está errado") e vincular um trecho selecionado */
      depois.append(qsVincBotao(q, () => elCom));
    }
    /* A SUA DICA, depois de responder — nunca antes: dica antes da escolha
     * é gabarito disfarçado. */
    if (minha) {
      depois.append(qsUiDobra("qs_dica_dobra", (el) => {
        el.className = "qs-minha-dica";
        try { el.innerHTML = matParaHtml(String(minha)); }
        catch (e) { el.textContent = String(minha); }
      }));
    }
    corpo.append(depois);
    /* NO TELEFONE a coluna de leitura rola inteira: depois de responder, leva o gabarito e o comentário para o TOPO da
     * área visível (o enunciado fica logo acima, a um gesto), em vez de deixá-los abaixo da dobra */
    try {
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width:760px)").matches) {
        setTimeout(() => { try { corpo.scrollTop = Math.max(0, depois.offsetTop - 10); } catch (e) {} }, 0);
      }
    } catch (e) {}
    /* A CAIXA SABE EM QUAL DOS DOIS ESTADOS ESTÁ. Sem esta classe o CSS
     * teria de adivinhar pela presença de um filho, e ":has()" não
     * existe em todo navegador que roda este aplicativo. */
    corpo.className = "qs-sess qs-fez";
  }
  /* O BOTÃO GRANDE ALTERNA DE PAPEL: "responder" enquanto falta
   * confirmar uma escolha, "próxima" depois de gravada — o mesmo lugar
   * na tela, o mesmo gesto de "seguir em frente", só que o que ele FAZ
   * muda com o estado. Ligado a uma seleção (desabilitado até haver
   * uma) em vez de sempre pronto, porque não há o que responder sem
   * ter escolhido nada ainda. */
  $("btnQsProxima").hidden = false;
  if (jaFoi) {
    $("btnQsProxima").disabled = false;
    $("btnQsProxima").textContent = t("qs_proxima");
    $("btnQsProxima").title = t("qs_proxima_ajuda");
  } else {
    $("btnQsProxima").disabled = !qsSelecionada;
    $("btnQsProxima").textContent = t("qs_responder");
    $("btnQsProxima").title = t("qs_responder_ajuda");
  }
  /* PULAR não é errar: a questão fica pendente e volta depois.
   * EMBARALHAR mexe só no que falta — reordenar o que já passou mudaria
   * o histórico da rodada. */
  if ($("btnQsPular")) {
    $("btnQsPular").hidden = !!jaFoi;
    $("btnQsPular").title = t("qs_pular_ajuda");
  }
  /* =================================================================
   * ANDAR PARA TRÁS SEM RESPONDER
   *
   * "Pular" sempre existiu e é o caminho para a frente: a questão fica
   * PENDENTE e volta no fim da fila. Faltava o contrário — reler a
   * anterior, conferir o comentário de uma que já foi feita, comparar
   * duas assertivas parecidas. Sem isso o único jeito de rever a de
   * trás era encerrar a rodada.
   *
   * NÃO TOCA NO PLACAR, e é o ponto todo: andar não é responder. O
   * "respondidas" só cresce em qsResponder; aqui muda apenas ONDE você
   * está. Uma questão já respondida reabre mostrando o gabarito e as
   * alternativas desligadas, como sempre; uma ainda não respondida
   * reabre esperando a resposta.
   * ================================================================= */
  if ($("btnQsVoltar")) {
    const b = $("btnQsVoltar");
    const s2 = qsSessaoAtual();
    b.hidden = !s2 || (s2.i || 0) <= 0;
    b.textContent = t("qs_voltar");
    b.title = t("qs_voltar_ajuda");
    b.onclick = () => { qsAndar(-1); qsUiPintarSessao(); };
  }
  if ($("btnQsIr")) {
    const bi = $("btnQsIr");
    const s3 = qsSessaoAtual();
    bi.hidden = !s3 || !s3.fila || s3.fila.length < 2;
  }
  /* SÓ AS QUE ERREI — liga e desliga no meio da rodada.
   * Aparece a partir do momento em que existe o que filtrar; antes da
   * primeira resposta ele não teria o que fazer. */
  /* ENCERRAR COM O PLACAR QUE ESTIVER.
   * Uma rodada de 40 questões raramente termina de uma vez, e antes
   * disto só havia duas saídas: responder todas ou fechar a janela — e
   * fechar não registrava nada, então uma hora de estudo evaporava.
   * Aqui a rodada acaba onde está e o placar parcial vira registro. */
  if ($("btnQsEncerrar")) {
    const b = $("btnQsEncerrar");
    const pl = qsPlacar();
    b.hidden = !pl.feitas;
    b.textContent = t("qs_encerrar", { c: pl.certas, n: pl.feitas, pct: pl.pct });
    b.title = t("qs_encerrar_ajuda", { f: Math.max(0, pl.total - pl.feitas) });
  }
  /* "MELHORAR ESTA QUESTÃO" só existe dentro de qsUiFerramentas agora —
   * não faz sentido nenhum sem questão ativa, e questão ativa é
   * exatamente quando aquele ⋮ é desenhado. Sem par estático para
   * manter em dia aqui. */
  /* "SÓ AS QUE ERREI" TEM DE FICAR ESCONDIDO AQUI — enquanto há questão
   * na tela, quem aparece é o gêmeo dentro do ⋮ (qsUiFerramentas); o
   * botão estático segue existindo só para a tela de "rodada
   * terminada" (mais acima nesta função), onde aquele ⋮ nem é
   * desenhado. */
  if ($("btnQsSoFalhas")) $("btnQsSoFalhas").hidden = true;
  /* O JULGADO DESTA QUESTÃO.
   *
   * O botão diz quantos já existem no tópico, e é essa contagem que
   * decide o verbo: com julgados guardados a gaveta abre para LER (a
   * pergunta que se faz ao errar é "qual era mesmo a tese?"); sem
   * nenhum, abre para INCLUIR. Abrir sempre no formulário obrigaria a
   * voltar um passo justamente na hora em que se quer conferir.
   *
   * SÓ APARECE COM DISCIPLINA E TÓPICO: sem eles não há gaveta para
   * onde ir, e um botão que às vezes não faz nada é pior que um botão
   * a menos — ensina a não confiar nos outros. */
  if ($("btnQsJuris")) {
    const b = $("btnQsJuris");
    const q2 = qsAtual();
    const temAlvo = !!(q2 && q2.disciplina && q2.topico);
    b.hidden = !temAlvo;
    if (temAlvo) {
      const ch = (typeof matChave === "function")
        ? matChave(q2.disciplina, q2.topico) : "";
      const nj = (typeof jurContarDoTopico === "function" && ch)
        ? jurContarDoTopico(ch) : 0;
      b.textContent = t(nj ? "qs_juris_ver" : "qs_juris_novo", { n: nj });
      b.title = t(nj ? "qs_juris_ver_ajuda" : "qs_juris_ajuda",
                  { n: nj, tp: q2.topico });
      b.onclick = () => qsUiJuris(q2);
    }
  }
  /* =================================================================
   * CONSULTAR A LEI NO MEIO DA QUESTÃO
   *
   * Metade das questões de Direito se resolve lendo o artigo — e até
   * aqui, para ler o artigo, era preciso ENCERRAR a rodada, achar o
   * tópico no material, abrir a lei e voltar. Quatro telas, com o
   * rascunho e os grifos da questão perdidos no meio.
   *
   * A gaveta sobe POR CIMA da sessão (o <dialog> empilha no top layer)
   * e fechá-la descobre a mesma questão, no mesmo ponto. É o mesmo
   * caminho do botão de julgados, e de propósito: consultar não é sair.
   *
   * ABRE PARA LER. Recitar e editar são exercícios; no meio de uma
   * prova o que se quer é conferir a letra do artigo.
   * ================================================================= */
  if ($("btnQsLei")) {
    const b = $("btnQsLei");
    const q3 = qsAtual();
    const temAlvo = !!(q3 && q3.disciplina && q3.topico);
    b.hidden = !temAlvo;
    if (temAlvo) {
      const ch = (typeof matChave === "function")
        ? matChave(q3.disciplina, q3.topico) : "";
      /* leiTem responde pela BIBLIOTECA e pelo campo antigo ao mesmo
       * tempo — é ele que sabe se há texto para consultar */
      const tem = (typeof leiTem === "function" && ch) ? leiTem(ch) : false;
      /* QUANTAS LEIS SERVEM ESTE TÓPICO decide o comportamento do botão.
       * Com uma, abrir direto; com duas, perguntar — porque abrir a
       * primeira era exatamente o defeito: a metade errada das vezes a
       * questão citava a outra e o app não dizia nada. */
      let nLeis = 0;
      try {
        nLeis = (typeof leisDoTopico === "function" && ch)
          ? leisDoTopico(ch).length : 0;
      } catch (e) { nLeis = 0; }
      b.textContent = nLeis > 1 ? t("qs_lei_ver_n", { n: nLeis })
        : t(tem ? "qs_lei_ver" : "qs_lei_sem");
      b.title = nLeis > 1 ? t("qs_lei_ver_n_ajuda", { n: nLeis, tp: q3.topico })
        : t(tem ? "qs_lei_ver_ajuda" : "qs_lei_sem_ajuda", { tp: q3.topico });
      b.onclick = (ev) => {
        if (nLeis > 1) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          qsUiLeiEscolher(b, q3, null);
          return;
        }
        qsUiLei(q3);
      };
    }
  }
  /* "EMBARALHAR" TAMBÉM SÓ EXISTE DENTRO DE qsUiFerramentas agora — o
   * mesmo caso de "melhorar esta questão", acima. */
  qsRodapePintar();
  if ($("btnQsEnunAlternar")) {
    const be = $("btnQsEnunAlternar");
    be.hidden = !q;
    be.textContent = t(qsEnunColapsado ? "qs_enun_expandir" : "qs_enun_recolher");
    be.title = t("qs_enun_ajuda");
  }
}

/* =====================================================================
 * DA QUESTÃO PARA O JULGADO, E DE VOLTA
 *
 * A SESSÃO NÃO É FECHADA. Um <dialog> aberto por showModal() empilha no
 * top layer do navegador: a gaveta sobe por cima da questão e, ao
 * fechar, descobre a mesma questão — mesma rolagem, mesmo rascunho,
 * mesmos grifos. Fechar e reabrir a sessão perderia as três coisas, e
 * perder o traço de uma conta no meio de uma questão é o tipo de
 * estrago que faz alguém parar de usar o botão.
 *
 * A REPINTURA NA VOLTA não é enfeite: se um julgado foi guardado, o
 * próprio botão precisa passar de "guardar julgado" para "2 julgados" —
 * senão a única prova de que o trabalho foi salvo estaria em outra
 * tela.
 * ===================================================================== */
function qsUiJuris(q) {
  if (!q || !q.disciplina || !q.topico) return;
  if (typeof jurAbrir !== "function") return;
  const ch = (typeof matChave === "function")
    ? matChave(q.disciplina, q.topico) : "";
  const antes = (typeof jurContarDoTopico === "function" && ch)
    ? jurContarDoTopico(ch) : 0;
  jurAbrir(q.disciplina, q.topico, antes ? "ler" : "incluir");
  jurVoltaPara = () => {
    const dep = (typeof jurContarDoTopico === "function" && ch)
      ? jurContarDoTopico(ch) : 0;
    if (dep !== antes) {
      reg("QUESTOES", "julgado guardado a partir de uma questão",
          q.topico + " · " + antes + "→" + dep);
    }
    /* repinta SEMPRE, e não só quando o número mudou: editar um julgado
     * sem criar outro também muda o que a tela de trás deveria dizer */
    try { qsUiPintarSessao(); } catch (e) {}
  };
  reg("QUESTOES", "gaveta de julgados aberta pela questão",
      q.topico + " · " + antes + " guardado(s)");
}

/* =====================================================================
 * O COMENTÁRIO QUE LEVA AO ARTIGO
 *
 * O DEFEITO QUE ISTO CONSERTA. O gabarito comentado dizia "nos termos do
 * art. 156-A, § 1º, IV, da CF/88" e o botão ⚖ abria a PRIMEIRA lei
 * ligada ao tópico — que num tópico servido por duas (despesa pública é
 * a 4.320 E a LRF) tinha metade de chance de ser a outra. Abria calado,
 * e quem lia conferia o artigo errado achando que era o certo.
 *
 * NADA DE innerHTML. O comentário vem de IA ou de colagem: é conteúdo de
 * fora. Por isso leiCitacoesNoTexto devolve POSIÇÕES, e o texto entra
 * por createTextNode — o pedaço clicável é um <button> montado à parte.
 * Um "innerHTML com <a>" aqui seria a porta por onde um comentário mal
 * colado executa script dentro do aplicativo.
 *
 * O QUE ACONTECE AO TOCAR está em qsUiLeiIr, e as três respostas
 * possíveis são de propósito diferentes: abrir, escolher, ou vincular.
 * ===================================================================== */
function qsUiComentario(el, q) {
  el.className = "qs-coment";
  const txt = String((q && q.comentario) || "");
  el.textContent = "";
  let cits = [];
  try {
    if (typeof leiCitacoesNoTexto === "function") cits = leiCitacoesNoTexto(txt);
  } catch (e) { cits = []; }
  /* os vínculos PERMANENTES que a pessoa fixou valem por cima da leitura automática */
  try {
    if (typeof citVinculosAplicar === "function") {
      const chV = (typeof matChave === "function" && q && q.disciplina && q.topico) ? matChave(q.disciplina, q.topico) : "";
      cits = citVinculosAplicar(txt, cits, chV);
    }
  } catch (e) {}
  try { if (typeof leiDeduzirRotulos === "function") leiDeduzirRotulos(txt, cits); } catch (e) {}
  /* os julgados citados (v18.33.0) e os ligados/desligados à mão (v18.34.0) */
  try {
    if (typeof citJuntarJulgados === "function" && typeof jurCitLink === "function") {
      const chJ = (typeof matChave === "function" && q && q.disciplina && q.topico) ? matChave(q.disciplina, q.topico) : "";
      cits = citJuntarJulgados(txt, cits, chJ);
    }
  } catch (e) {}
  /* sem citação — e este é o caso comum em Português e Informática — o
   * comentário continua sendo exatamente o texto, sem nada em volta */
  if (!cits.length) { el.textContent = txt; return el; }

  /* a biblioteca é lida UMA vez por comentário, e não uma por citação:
   * leisLista() lê o armazenamento e ordena, e um comentário longo cita
   * seis artigos */
  const ch = (typeof matChave === "function" && q.disciplina && q.topico)
    ? matChave(q.disciplina, q.topico) : "";
  let lista = [], doTopico = [];
  try {
    lista = (typeof leisLista === "function") ? leisLista() : [];
    doTopico = (typeof leisDoTopico === "function" && ch) ? leisDoTopico(ch) : [];
  } catch (e) {}

  let pos = 0;
  cits.forEach((c) => {
    if (c.ini > pos) el.append(document.createTextNode(txt.slice(pos, c.ini)));
    if (c._jur) {
      el.append(jurCitLink(c, { disciplina: q.disciplina, topico: q.topico, aoVoltar: qsUiVoltaDe(q), onde: "questao" }));
      pos = c.fim;
      return;
    }
    const lk = qsUiLeiLink(c, q, lista, doTopico);
    el.append(lk);
    /* a nota do artigo, ao lado do link (v18.31.0) */
    const nt = typeof citNotaEl === "function" ? citNotaEl(lk) : null;
    if (nt) el.append(nt);
    pos = c.fim;
  });
  if (pos < txt.length) el.append(document.createTextNode(txt.slice(pos)));
  return el;
}

/* PARA ONDE ESTA CITAÇÃO APONTA.
 *
 * Três respostas, e a diferença entre elas é o que salva a consulta:
 *  - a citação nomeia uma lei que está na biblioteca  → abre nela;
 *  - a citação nomeia uma lei que NÃO está           → oferece vincular;
 *  - a citação não nomeia lei nenhuma ("o art. 20")  → só vale se o
 *    tópico tiver UMA lei; com duas, quem escolhe é você.
 *
 * O último caso é o antigo defeito escrito ao contrário: onde o app
 * chutava a primeira, agora ele pergunta. */
function qsUiLeiAlvo(c, lista, doTopico) {
  const dt = doTopico || [];
  /* VÍNCULO FIXADO PELA PESSOA: a lei já vem escolhida, sem casar rótulo */
  if (c && c.leiId) {
    const fixa = (lista || []).filter((x) => x.id === c.leiId)[0];
    if (fixa) return { lei: fixa, ligada: dt.some((x) => x.id === fixa.id) };
    return { lei: null, motivo: "desconhecida" };
  }
  if (c && c.rotulo && typeof leiCasarRotulo === "function") {
    let l = null;
    try { l = leiCasarRotulo(c.rotulo, lista); } catch (e) { l = null; }
    if (l) return { lei: l, ligada: dt.some((x) => x.id === l.id) };
    return { lei: null, motivo: "desconhecida" };
  }
  if (dt.length === 1) return { lei: dt[0], ligada: true };
  /* a lei nomeada antes, no mesmo parágrafo (leiDeduzirRotulos): só aqui,
   * quando o tópico não decide — com uma lei só, vale a do tópico, como antes */
  if (c && c.rotuloDeduzido && typeof leiCasarRotulo === "function") {
    let l = null;
    try { l = leiCasarRotulo(c.rotuloDeduzido, lista); } catch (e) { l = null; }
    if (l) return { lei: l, ligada: dt.some((x) => x.id === l.id), deduzida: true };
  }
  return { lei: null, motivo: dt.length ? "ambigua" : "vazia" };
}

function qsUiLeiLink(c, q, lista, doTopico) {
  const b = document.createElement("button");
  b.type = "button";
  const alvo = qsUiLeiAlvo(c, lista, doTopico);
  /* O ESTADO É VISÍVEL ANTES DO TOQUE. Um link que abre a lei e um link
   * que vai pedir para vincular são coisas diferentes, e descobrir isso
   * só depois de tocar é o que faz alguém parar de tocar. */
  b.className = "qs-lei-link" + (alvo.lei ? "" : " qs-lei-link-sem") + (alvo.deduzida ? " qs-lei-link-ded" : "");
  b.textContent = c.texto;
  /* A NOTA, SE HOUVER, ENTRA NA DICA — não no texto do link. O link já
   * mostra a citação como o comentário a escreveu ("art. 156, § 3º,
   * II"); a nota é o gancho de reconhecimento ("isenção na exportação"),
   * útil para quem passa o mouse/dedo antes de decidir abrir. */
  const nota = alvo.lei && typeof leiNotaDe === "function"
    ? leiNotaDe(alvo.lei.id, c.num) : "";
  b._citNota = nota;
  b.title = alvo.lei
    ? t("qs_lei_link_ir", { l: alvo.lei.nome, a: c.numCru }) + (nota ? " · " + nota : "")
    : (c.rotulo ? t("qs_lei_link_sem", { l: c.rotulo })
                : t("qs_lei_link_qual", { a: c.numCru }));
  if (alvo.deduzida) b.title += " · " + t("qs_lei_link_ded", { l: c.rotuloDeduzido });
  if (c.permanente) {
    b.classList.add("qs-lei-link-perm");
    if (alvo.lei) b.title = t("qs_vinc_link_perm", { l: alvo.lei.nome, a: (c.artigos || []).map((a) => a.numCru).join(", ") || c.numCru || "" });
  }
  b.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    qsUiLeiIr(c, q, b);
  };
  return b;
}

/* POR QUE A CITAÇÃO NÃO ABRIU — em uma frase, para o registro. Antes o
 * caminho do menu ("qual destas?") não deixava rastro nenhum: quem
 * tocava num link "sem lei" e via o menu não tinha como mostrar depois
 * o que o aplicativo tinha entendido. Distingue os dois motivos, que
 * pedem consertos diferentes: NENHUMA lei casou (falta guardar ou
 * apelidar) ou MAIS DE UMA casou (dúvida — e quais são). */
function qsUiLeiMotivoFalha(c, lista) {
  if (!c || !c.rotulo) return "a citação não nomeia lei";
  let cand = [];
  try { cand = leiCandidatosDoRotulo(c.rotulo, lista); } catch (e) { cand = []; }
  if (!cand.length) return "nenhuma lei da biblioteca casa com \"" + c.rotulo + "\"";
  return cand.length + " leis casam com \"" + c.rotulo + "\" (dúvida, não abriu nenhuma): "
    + cand.map((l) => l.nome).join(" | ");
}

/* QUEM REPINTA NA VOLTA DA LEI. A questão repinta a sessão; o resumo (e quem
 * mais usar estes links fora das questões) manda o próprio _aoVoltar no "q",
 * que aqui é só {disciplina, topico, comentario} — o texto onde a citação está. */
function qsUiVoltaDe(q) {
  if (q && typeof q._aoVoltar === "function") {
    const f = q._aoVoltar;
    return () => { try { f(); } catch (e) {} };
  }
  return () => { try { qsUiPintarSessao(); } catch (e) {} };
}

function qsUiLeiIr(c, q, botao) {
  if (!q || !q.disciplina || !q.topico) return;
  if (typeof leiAbrir !== "function") return;
  const ch = (typeof matChave === "function") ? matChave(q.disciplina, q.topico) : "";
  let lista = [], doTopico = [];
  try {
    lista = (typeof leisLista === "function") ? leisLista() : [];
    doTopico = (typeof leisDoTopico === "function" && ch) ? leisDoTopico(ch) : [];
  } catch (e) {}
  const alvo = qsUiLeiAlvo(c, lista, doTopico);

  /* a volta é a mesma dos outros dois botões: a gaveta sobe por cima e,
   * ao fechar, descobre a mesma questão — mas o botão ⚖ precisa ser
   * repintado, porque a lei pode ter sido vinculada agora */
  leiVoltaPara = qsUiVoltaDe(q);

  if (alvo.lei) {
    /* CONSULTAR NÃO É VINCULAR. Se a lei existe mas não está ligada a
     * este tópico, ela abre do mesmo jeito — ler o artigo não pode
     * exigir uma decisão de arrumação primeiro. Vincular continua a um
     * toque, na fila de chips do próprio leitor.
     *
     * A PRÉVIA, NÃO A LEI INTEIRA (v18.32.0): abrir a lei cobria a questão
     * e parecia fechá-la. Agora sobe a mesma prévia do resumo — o artigo, o
     * trecho citado e a nota —, e "abrir a lei inteira" continua a um toque. */
    if (c.num && typeof leiCitacaoPreviewAbrir === "function") {
      leiCitacaoPreviewAbrir(c, "", { lei: alvo.lei,
        ctx: { disciplina: q.disciplina, topico: q.topico, aoVoltar: qsUiVoltaDe(q) } });
      reg("QUESTOES", "citação do comentário aberta na prévia",
          alvo.lei.nome + " · art. " + c.numCru + (alvo.ligada ? "" : " · lei não ligada ao tópico"));
      return;
    }
    const achou = leiAbrirNoArtigo(q.disciplina, q.topico, alvo.lei.id, c.num, c);
    if (!achou && c.num) {
      try { uiAlert(t("qs_lei_link_nao_achou", { a: c.numCru, l: alvo.lei.nome })); }
      catch (e) {}
    }
    reg("QUESTOES", "citação do comentário aberta na lei",
        alvo.lei.nome + " · art. " + c.numCru + (alvo.ligada ? "" : " · lei não ligada ao tópico"));
    return;
  }

  /* TODA tentativa que não abriu uma lei fica no registro, com o motivo */
  try {
    reg("QUESTOES", "citação não resolvida",
        (c.rotulo || "sem rótulo") + " · art. " + c.numCru + " · "
        + qsUiLeiMotivoFalha(c, lista));
  } catch (e) {}

  if (alvo.motivo === "ambigua"
      || (alvo.motivo === "desconhecida" && doTopico.length > 0)) {
    /* DOIS MOTIVOS, A MESMA PERGUNTA. "Ambígua": a citação não disse
     * qual das leis já ligadas. "Desconhecida" com o tópico já tendo
     * lei: a citação NOMEOU uma lei que não bate com nada guardado —
     * caso real: "ADCT", quando só a Constituição está na biblioteca,
     * e o ADCT costuma vir DENTRO do próprio texto dela. Ir direto para
     * "vincular uma lei nova" nesse caso pulava a resposta mais provável
     * — "é uma das que este tópico já tem" — e ainda oferecia, no
     * exemplo real, uma lei sem nenhuma relação (a 4.320) só porque era
     * a única outra na biblioteca. O menu único oferece as duas leis do
     * tópico primeiro, e "usar já guardada"/"colar nova" continuam ali
     * para quando a resposta certa não for nenhuma delas. */
    qsUiLeiEscolher(botao || $("btnQsLei"), q, c);
    return;
  }

  /* Sem lei para abrir. O leitor sobe primeiro — leiVincularAbrir lê
   * leiAtual.chave para saber o que filtrar, e leiTrocarPara escreve em
   * "leiTexto" e chama leiPintar. Chamado com o leitor fechado ele
   * vincula de verdade e PINTA UM DIÁLOGO INVISÍVEL: da cadeira de quem
   * usa, o botão não fez nada. */
  leiAbrir(q.disciplina, q.topico, undefined, { semRetomar: true });
  const temOutras = lista.length > doTopico.length;
  /* sigla desconhecida e nenhuma lei no tópico: a lei que a pessoa
   * escolher na janela de vincular passa a se chamar por essa sigla */
  const siglaLembrar = (c.rotulo && /^[A-Za-z0-9-]{2,16}$/.test(String(c.rotulo).trim()))
    ? String(c.rotulo).trim() : "";
  try {
    if (temOutras && typeof leiVincularAbrir === "function") leiVincularAbrir(siglaLembrar);
    else if (typeof leiNovaAbrir === "function" && !doTopico.length) leiNovaAbrir();
  } catch (e) {}
  reg("QUESTOES", "citação sem lei vinculada",
      (c.rotulo || "sem rótulo") + " · art. " + c.numCru + " · " + q.topico);
}

/* =====================================================================
 * "ESTE VÍNCULO ESTÁ ERRADO" e "VINCULAR ESTE TRECHO" — a citação que a
 * pessoa conserta uma vez e vale sempre
 *
 * A leitura automática de uma citação erra (sigla que não conhece, frase fora
 * do padrão). O botão "🔗 vínculos de lei" abaixo do comentário abre a lista
 * do que o app entendeu em CADA citação — com a lei para onde cada uma leva
 * — e deixa:
 *  · corrigir uma citação ("este vínculo está errado"): escolher a lei certa e
 *    os artigos;
 *  · vincular um TRECHO SELECIONADO no comentário a uma lei e artigos;
 *  · tornar o vínculo PERMANENTE (marcado por padrão): a mesma frase, em
 *    qualquer questão, passa a abrir aquela lei; ou só abrir agora;
 *  · remover um vínculo permanente.
 * O vínculo é guardado pelo texto do trecho (citVinculoSalvar), não pela
 * questão. A seleção é capturada ao APERTAR o botão: em alguns aparelhos o
 * toque tira a seleção antes do clique.
 * ===================================================================== */
let qsVincCtx = null;

function qsVincSelecao(el) {
  try {
    const s = typeof window !== "undefined" && window.getSelection ? window.getSelection() : null;
    if (!s || !s.rangeCount) return "";
    const txt = String(s.toString()).replace(/\s+/g, " ").trim();
    if (!txt) return "";
    if (el && el.contains && s.anchorNode && !el.contains(s.anchorNode)) return "";
    return txt.slice(0, 300);
  } catch (e) { return ""; }
}

function qsVincBotao(q, obterEl) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-min qs-vinc-btn";
  b.id = "btnQsVinc";
  b.textContent = t("qs_vinc_btn");
  b.title = t("qs_vinc_btn_aj");
  let sel = "";
  const guardar = () => { sel = qsVincSelecao(obterEl()); };
  b.onmousedown = guardar;
  b.ontouchstart = guardar;
  b.onpointerdown = guardar;
  b.onclick = () => { qsVincAbrir(q, obterEl(), sel || qsVincSelecao(obterEl())); sel = ""; };
  return b;
}

function qsVincContexto(q) {
  const ch = (typeof matChave === "function" && q && q.disciplina && q.topico) ? matChave(q.disciplina, q.topico) : "";
  let lista = [], doTopico = [];
  try {
    lista = leisLista();
    doTopico = (ch && typeof leisDoTopico === "function") ? leisDoTopico(ch) : [];
  } catch (e) {}
  return { ch, lista, doTopico };
}

/* o texto da janela fala do lugar de onde se veio: comentário (questão) ou resumo */
function qsVincT(chave, v) {
  const res = qsVincCtx && qsVincCtx.q && qsVincCtx.q._onde === "resumo";
  return t(res ? chave + "_res" : chave, v);
}

function qsVincAbrir(q, el, selecao) {
  qsVincCtx = { q, el, selecao: selecao || "" };
  if ($("qsVincTit")) $("qsVincTit").textContent = qsVincT("qs_vinc_titulo");
  if ($("qsVincAjuda")) $("qsVincAjuda").textContent = qsVincT("qs_vinc_ajuda");
  qsVincPintar();
  abrirModal("dlgQsVinc");
  try { reg("QUESTOES", "vínculos de lei do comentário abertos", (q && q.topico) || ""); } catch (e) {}
}

function qsVincPintar() {
  const c = qsVincCtx;
  if (!c) return;
  const q = c.q;
  const txt = String((q && q.comentario) || "");
  const { ch, lista, doTopico } = qsVincContexto(q);

  const sel = $("qsVincSel");
  sel.innerHTML = "";
  if (c.selecao) {
    const d = document.createElement("div");
    d.className = "lei-pre-grupo";
    const p = document.createElement("div");
    p.className = "lei-pre-ctx";
    p.textContent = t("qs_vinc_sel", { t: c.selecao });
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min btn-min-ok";
    b.id = "btnQsVincSel";
    b.textContent = t("qs_vinc_sel_btn");
    b.onclick = () => qsVincEscolher({ trecho: c.selecao, cit: null });
    d.append(p, b);
    sel.append(d);
  } else {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = qsVincT("qs_vinc_sem_sel");
    sel.append(p);
  }

  let cits = [];
  try { cits = citVinculosAplicar(txt, leiCitacoesNoTexto(txt), ch); } catch (e) { cits = []; }
  try { leiDeduzirRotulos(txt, cits); } catch (e) {}
  const cx = $("qsVincLista");
  cx.innerHTML = "";
  if (!cits.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = qsVincT("qs_vinc_nenhuma");
    cx.append(p);
  }
  /* (v18.34.0) os links DESLIGADOS e os ligados à mão a um JULGADO, neste texto */
  try {
    const nt = leiTxtChave(txt);
    citVinculosLer().filter((v) => (v.nenhum || v.tipo === "jur") && (!v.chave || v.chave === ch)
      && v.trecho && nt.indexOf(leiTxtChave(v.trecho)) >= 0).forEach((v, i) => {
      const card = document.createElement("div");
      card.className = "lei-bib-card";
      card.id = "qsVincExtra_" + i;
      const tit = document.createElement("div");
      tit.className = "lei-bib-tit";
      tit.textContent = v.trecho;
      const meta = document.createElement("div");
      meta.className = "lei-bib-meta lei-bib-sem";
      const jj = v.jurId && typeof jurDe === "function" ? jurDe(v.jurId) : null;
      meta.textContent = v.nenhum ? t(v.tipo === "jur" ? "qs_vinc_desligado_jur" : "qs_vinc_desligado")
        : t("qs_vinc_jur", { j: jj ? [jj.tribunal, jj.classe, jj.numero].filter(Boolean).join(" ") : "?" });
      const ac = document.createElement("div");
      ac.className = "lei-bib-acoes";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min";
      b.id = "btnQsVincReligar_" + i;
      b.textContent = t(v.nenhum ? "qs_vinc_religar" : "qs_vinc_remover");
      b.onclick = () => {
        citVinculoRemover(v.k);
        try { reg("QUESTOES", v.nenhum ? "link religado" : "vínculo de julgado removido", v.trecho); } catch (e) {}
        qsVincPintar();
        qsUiVoltaDe(q)();
      };
      ac.append(b);
      card.append(tit, meta, ac);
      cx.append(card);
    });
  } catch (e) {}
  cits.forEach((ct, i) => {
    const alvo = qsUiLeiAlvo(ct, lista, doTopico);
    const card = document.createElement("div");
    card.className = "lei-bib-card";
    card.id = "qsVincCit_" + i;
    const tit = document.createElement("div");
    tit.className = "lei-bib-tit";
    tit.textContent = ct.texto;
    const meta = document.createElement("div");
    meta.className = "lei-bib-meta" + (alvo.lei ? "" : " lei-bib-sem");
    meta.textContent = (alvo.lei ? t("qs_vinc_abre", { l: alvo.lei.nome, a: ct.numCru || "—" })
      : t("qs_vinc_sem_lei", { l: ct.rotulo || "?" }))
      + (alvo.deduzida ? " · " + t("qs_vinc_deduzida", { l: ct.rotuloDeduzido }) : "")
      + (ct.permanente ? " · " + t("qs_vinc_permanente") + " · " + t(ct.soTopico ? "qs_vinc_alc_topico" : "qs_vinc_alc_tudo_curto") : "");
    const ac = document.createElement("div");
    ac.className = "lei-bib-acoes";
    const errado = document.createElement("button");
    errado.type = "button";
    errado.className = "btn-min btn-min-perigo";
    errado.id = "btnQsVincErrado_" + i;
    errado.textContent = t("qs_vinc_errado");
    errado.onclick = () => qsVincEscolher({ trecho: ct.texto, cit: ct, atual: alvo.lei });
    ac.append(errado);
    if (ct.permanente) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-min";
      rm.id = "btnQsVincRemover_" + i;
      rm.textContent = t("qs_vinc_remover");
      rm.onclick = () => {
        citVinculoRemover(ct.vinculoK);
        try { reg("QUESTOES", "vínculo permanente removido", ct.texto); } catch (e) {}
        qsVincPintar();
        qsUiVoltaDe(q)();
      };
      ac.append(rm);
    }
    card.append(tit, meta, ac);
    cx.append(card);
  });
}

/* =====================================================================
 * VINCULAR UM TRECHO À LEI — VENDO PARA ONDE ELE VAI LEVAR (v18.25.0)
 *
 * Antes: escolhia-se a lei num select e DIGITAVA-SE o número do artigo às
 * cegas — sem ver o texto, sem poder dizer "é o § 1º", e o vínculo valia
 * para o app inteiro. Agora a mesma janela (mesmos campos) mostra:
 *  · as leis do tópico em fichas, primeiro;
 *  · um campo só para o destino: número ("113", "113, § 1º, II", "77, 78,
 *    79") ou uma PALAVRA, que lista os artigos que a contêm;
 *  · a estrutura do artigo em fichas (caput, § 1º, inciso II…) para apontar
 *    a parte exata;
 *  · a PRÉVIA do texto vigente, com a parte escolhida em destaque, antes de
 *    gravar;
 *  · onde o vínculo vale: só neste tópico (padrão) ou em todo o app.
 * ===================================================================== */

/* "§ 1º", "II", "a)" — o endereço de um destino, para mostrar e para gravar */
function qsVincRotuloDestino(base, sub) {
  const S = sub || {};
  const p = [String(base || "")];
  (S.paragrafos || []).slice(0, 1).forEach((x) => p.push(/^[úu]nico$/i.test(x) ? "parágrafo único" : "§ " + x));
  (S.incisos || []).forEach((x) => p.push(x));
  (S.alineas || []).slice(0, 1).forEach((x) => p.push(x + ")"));
  return p.join(", ");
}

function qsVincSubVazio() { return { incisos: [], paragrafos: [], alineas: [] }; }

/* o que se digitou no campo — "113, § 1º, II; 78" — lido pelo MESMO leitor de citações */
function qsVincLerDestinos(txt) {
  const s = String(txt || "").trim().replace(/^\s*(?:arts?|artigos?)\.?\s*/i, "");
  if (!s || !/^\d/.test(s)) return [];
  let cits = [];
  try { cits = leiCitacoesNoTexto("arts. " + s); } catch (e) { cits = []; }
  const out = [];
  cits.forEach((c) => {
    const sub = { incisos: (c.incisos || []).slice(), paragrafos: (c.paragrafos || []).slice(), alineas: (c.alineas || []).slice() };
    const base = String(c.numCru || c.num);
    const numCru = qsVincRotuloDestino(base, sub);
    if (!out.some((o) => o.numCru === numCru)) out.push({ num: c.num, numCru, base, sub });
  });
  if (!out.length) {
    try { citLerArtigos(s).forEach((a) => out.push({ num: a.num, numCru: a.numCru, base: a.numCru, sub: qsVincSubVazio() })); } catch (e) {}
  }
  return out.slice(0, 30);
}

function qsVincDestinosTexto(ds) {
  const temSub = ds.some((d) => (d.sub.paragrafos || []).length || (d.sub.incisos || []).length || (d.sub.alineas || []).length);
  return ds.map((d) => d.numCru).join(temSub ? "; " : ", ");
}

/* chave da estrutura ("P1>II>a") → endereço que o leitor de citações entende */
function qsVincSubDaUnidade(chave) {
  const sub = qsVincSubVazio();
  String(chave || "").split(">").forEach((p) => {
    let m;
    if (p === "PU") sub.paragrafos.push("único");
    else if ((m = p.match(/^P(\d+)([A-Z]?)$/))) {
      const n = Number(m[1]);
      sub.paragrafos.push((n <= 9 ? n + "º" : String(n)) + (m[2] ? "-" + m[2] : ""));
    } else if (/^[IVXLC]+$/.test(p)) sub.incisos.push(p);
    else if (/^[a-z]$/.test(p)) sub.alineas.push(p);
  });
  return sub;
}

function qsVincMesmoSub(a, b) {
  const j = (x) => JSON.stringify([(x.paragrafos || []).map((y) => String(y).replace(/[ºo°]/g, "")), x.incisos || [], x.alineas || []]);
  return j(a || {}) === j(b || {});
}

/* os artigos VIGENTES da lei escolhida, lidos uma vez por lei enquanto a janela está aberta */
function qsVincArtigos(lei) {
  const c = qsVincCtx;
  if (!lei) return [];
  if (c && c.cacheArts && c.cacheArts.id === lei.id) return c.cacheArts.arts;
  let arts = [];
  try { arts = leiArtigosEfetivos(lei) || []; } catch (e) { arts = []; }
  if (c) c.cacheArts = { id: lei.id, arts };
  return arts;
}

/* (v18.34.0) a escolha da lei SEM passar pela lista — vinda do "ligar a outro…" da prévia */
function qsVincEscolherPara(q, alvo) {
  qsVincCtx = { q, el: null, selecao: "" };
  qsVincEscolher(alvo);
}

function qsVincEscolher(alvo) {
  const c = qsVincCtx;
  if (!c) return;
  c.esc = alvo;
  c.cacheArts = null;
  const { lista, doTopico } = qsVincContexto(c.q);
  $("qsVincEscTitulo").textContent = t(alvo.cit ? "qs_vinc_esc_errado" : "qs_vinc_esc_novo");
  $("qsVincEscTrecho").textContent = "“" + alvo.trecho + "”";
  const s = $("qsVincLei");
  s.innerHTML = "";
  const vazio = document.createElement("option");
  vazio.value = "";
  vazio.textContent = t("qs_vinc_escolha");
  s.append(vazio);
  /* as leis do tópico primeiro: é onde está a resposta mais provável */
  const ordem = doTopico.concat(lista.filter((l) => !doTopico.some((d) => d.id === l.id)));
  ordem.forEach((l) => {
    const o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.nome + (doTopico.some((d) => d.id === l.id) ? " ★" : "");
    s.append(o);
  });
  /* a lei que o app achou é justamente a que a pessoa disse estar errada: não
   * vem marcada. Trecho novo que já nomeia a lei ("do CTN") vem com ela; sem
   * nome e uma lei só no tópico, essa é a sugestão. Corrigir um vínculo que a
   * PRÓPRIA pessoa fixou é outra coisa: a lei dela vem marcada (o que se muda
   * ali costuma ser o artigo, a parte ou onde vale). */
  let sug = "";
  if (alvo.cit && alvo.cit.permanente && alvo.cit.leiId && leiDe(alvo.cit.leiId)) sug = alvo.cit.leiId;
  else if (!alvo.atual) {
    try {
      const c0 = leiCitacoesNoTexto(alvo.trecho)[0];
      const l0 = c0 && c0.rotulo ? leiCasarRotulo(c0.rotulo, lista) : null;
      if (l0 && !alvo.cit) sug = l0.id;
    } catch (e) {}
    if (!sug && doTopico.length === 1) sug = doTopico[0].id;
  }
  s.value = sug;
  let ds = [];
  try {
    if (alvo.cit && alvo.cit.artigos && alvo.cit.artigos.length) {
      ds = alvo.cit.artigos.map((a) => ({ num: a.num, numCru: a.numCru, base: a.base || a.numCru, sub: a.sub || qsVincSubVazio() }));
    } else {
      const fonte = alvo.cit ? [alvo.cit] : leiCitacoesNoTexto(alvo.trecho);
      ds = fonte.filter((x) => x && x.num).map((x) => {
        const sub = { incisos: x.incisos || [], paragrafos: x.paragrafos || [], alineas: x.alineas || [] };
        return { num: x.num, base: x.numCru, numCru: qsVincRotuloDestino(x.numCru, sub), sub };
      });
    }
  } catch (e) { ds = []; }
  $("qsVincArts").value = qsVincDestinosTexto(ds);
  $("qsVincPerm").checked = true;
  if ($("qsVincAlcTopico")) $("qsVincAlcTopico").checked = true;
  if ($("qsVincAlcTudo")) $("qsVincAlcTudo").checked = false;
  $("qsVincEscAviso").textContent = "";
  qsVincPintarEsc();
  abrirModal("dlgQsVincEsc");
}

/* repinta tudo o que depende da lei e do destino: fichas, achados, partes e prévia */
function qsVincPintarEsc() {
  const c = qsVincCtx;
  if (!c || !c.esc) return;
  const { doTopico } = qsVincContexto(c.q);
  const leiId = String($("qsVincLei").value || "");
  const lei = leiId ? leiDe(leiId) : null;

  /* 1. as leis do tópico, em fichas */
  const fx = $("qsVincLeisTopico");
  if (fx) {
    fx.innerHTML = "";
    fx.hidden = !doTopico.length;
    if (doTopico.length) {
      const r = document.createElement("span");
      r.className = "nota";
      r.textContent = t("qs_vinc_leis_topico");
      fx.append(r);
    }
    doTopico.forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min qs-vinc-ficha" + (l.id === leiId ? " sel" : "");
      b.textContent = l.nome;
      b.setAttribute("aria-pressed", l.id === leiId ? "true" : "false");
      b.onclick = () => { $("qsVincLei").value = l.id; c.cacheArts = null; qsVincPintarEsc(); };
      fx.append(b);
    });
  }

  const campo = String($("qsVincArts").value || "").trim();
  const ds = qsVincLerDestinos(campo);
  const arts = lei ? qsVincArtigos(lei) : [];

  /* 2. palavra no campo: os artigos que a contêm */
  const ach = $("qsVincAchados");
  if (ach) {
    ach.innerHTML = "";
    const busca = campo && !ds.length && !/^\d/.test(campo) ? campo : "";
    ach.hidden = !(busca && lei);
    if (busca && lei) {
      const k = leiTxtChave(busca);
      const achados = arts.filter((a) => leiTxtChave(a.texto).indexOf(k) >= 0).slice(0, 8);
      const cab = document.createElement("div");
      cab.className = "nota";
      cab.textContent = achados.length ? t("qs_vinc_achados", { q: busca }) : t("qs_vinc_achados_nada", { q: busca });
      ach.append(cab);
      achados.forEach((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qs-vinc-achado";
        b.id = "qsVincAchado_" + i;
        /* sem repetir o número: "Art. 113 — A obrigação…", e não "Art. 113 — Art. 113. A obrigação…" */
        const ini = String(a.texto || "").replace(/\s+/g, " ").trim()
          .replace(/^art(?:igo)?\.?\s*[\dº°o]+(?:\s*-\s*[A-Z])?\s*[.\-–—]?\s*/i, "");
        b.textContent = a.rotulo + " — " + (ini.length > 110 ? ini.slice(0, 110) + "…" : ini);
        b.onclick = () => { $("qsVincArts").value = a.numCru || a.num; qsVincPintarEsc(); };
        ach.append(b);
      });
    }
  }

  /* 3. as partes do 1º artigo, em fichas */
  const d0 = ds[0];
  const art = d0 && lei ? arts.filter((a) => a.num === d0.num)[0] : null;
  const dp = $("qsVincDisp");
  if (dp) {
    dp.innerHTML = "";
    let unidades = [];
    try { unidades = art ? (leiEstruturaArtigo(art.texto).unidades || []) : []; } catch (e) { unidades = []; }
    dp.hidden = !art;
    if (art) {
      const r = document.createElement("span");
      r.className = "nota";
      r.textContent = t("qs_vinc_disp_rot");
      dp.append(r);
      const ficha = (rot, sub, id) => {
        const b = document.createElement("button");
        b.type = "button";
        const sel = qsVincMesmoSub(d0.sub, sub);
        b.className = "btn-min qs-vinc-ficha" + (sel ? " sel" : "");
        b.id = id;
        b.textContent = rot;
        b.setAttribute("aria-pressed", sel ? "true" : "false");
        b.onclick = () => {
          const todos = qsVincLerDestinos($("qsVincArts").value);
          if (!todos.length) return;
          todos[0].sub = sub;
          todos[0].numCru = qsVincRotuloDestino(todos[0].base, sub);
          $("qsVincArts").value = qsVincDestinosTexto(todos);
          qsVincPintarEsc();
        };
        dp.append(b);
      };
      ficha(t("qs_vinc_disp_inteiro"), qsVincSubVazio(), "qsVincDisp_0");
      unidades.slice(0, 120).forEach((u, i) => ficha(leiRotuloDaUnidade(u), qsVincSubDaUnidade(u.chave), "qsVincDisp_" + (i + 1)));
    }
  }

  /* 4. a prévia: o texto vigente, com a parte escolhida em destaque */
  const pv = $("qsVincPrev");
  if (pv) {
    pv.innerHTML = "";
    const nota = (txt, cls) => { const p = document.createElement("p"); p.className = cls || "nota"; p.textContent = txt; pv.append(p); };
    if (!lei) nota(t("qs_vinc_prev_sem_lei"));
    else if (!d0) nota(t(campo ? "qs_vinc_prev_escolha" : "qs_vinc_prev_sem_art"));
    else if (!art) nota(t("qs_vinc_prev_nao_achou", { a: d0.base, l: lei.nome }), "nota qs-vinc-aviso");
    else {
      const cab = document.createElement("div");
      cab.className = "qs-vinc-prev-cab";
      cab.textContent = lei.nome + " · " + art.rotulo
        + (art.alterado ? " " + t("lei_selo_alterado_curto", { f: art.fonteAlteracao || "?" }) : "")
        + (art.revogado ? " " + t("lei_selo_revogado", { f: art.fonteAlteracao || "?" }) : "");
      pv.append(cab);
      let un = [];
      const temSub = !qsVincMesmoSub(d0.sub, qsVincSubVazio());
      try { un = temSub ? leiAcharUnidades(art.texto, d0.sub) : []; } catch (e) { un = []; }
      if (temSub && !un.length) nota(t("qs_vinc_disp_nao_achou", { d: d0.numCru, a: d0.base }), "nota qs-vinc-aviso");
      const linhas = String(art.texto || "").split("\n");
      const corpo = document.createElement("div");
      corpo.className = "qs-vinc-prev-txt";
      let primeira = null;
      linhas.forEach((ln, i) => {
        const dv = document.createElement("div");
        const alvo = un.some((u) => i >= u.linha && i <= u.linhaFim);
        dv.className = "qs-vinc-prev-l" + (alvo ? " qs-vinc-prev-alvo" : "");
        dv.textContent = ln;
        if (alvo && !primeira) primeira = dv;
        corpo.append(dv);
      });
      pv.append(corpo);
      if (ds.length > 1) nota(t("qs_vinc_tambem", { l: ds.slice(1).map((d) => "art. " + d.numCru).join(" · ") }));
      try { if (primeira && primeira.scrollIntoView) primeira.scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
  }

  /* 5. onde vale — só faz sentido se o vínculo for guardado */
  if ($("qsVincAlcanceBox")) $("qsVincAlcanceBox").hidden = !$("qsVincPerm").checked;
}

function qsVincCurto(s) {
  const x = String(s || "").replace(/\s+/g, " ").trim();
  return x.length > 60 ? x.slice(0, 59) + "…" : x;
}
/* o link (ou os links) com este trecho, onde estiverem desenhados agora, ganha um destaque por alguns segundos */
let citUltimoDestaque = null;   /* {trecho, n}: o último destaque pedido (para conferir) */
function citDestacarRecem(trecho, ms) {
  const alvo = String(trecho || "").replace(/\s+/g, " ").trim().toLowerCase();
  citUltimoDestaque = { trecho: alvo, n: 0 };
  if (!alvo || typeof document === "undefined") return 0;
  let n = 0;
  const marcar = () => {
    /* nos painéis onde há links (leitura do resumo, leitor de lei, questão) e no resto do documento */
    const vistos = new Set();
    ["matLeitura", "leiLeitura", "qsSessCorpo"].map((id) => $(id)).filter(Boolean).concat([document]).forEach((raiz) => {
      ["button.qs-lei-link", "button.lei-cita-link"].forEach((sel) => {
        try { Array.from(raiz.querySelectorAll(sel) || []).forEach((b) => vistos.add(b)); } catch (e) {}
      });
    });
    const bs = Array.from(vistos);
    bs.filter((b) => String(b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() === alvo).forEach((b, i) => {
      if (b.classList) b.classList.add("cit-recem"); else b.className = (b.className || "") + " cit-recem";
      if (i === 0) { try { if (b.scrollIntoView) b.scrollIntoView({ block: "nearest" }); } catch (e) {} }
      n++;
      citUltimoDestaque.n = n;
      setTimeout(() => { try { if (b.classList) b.classList.remove("cit-recem"); } catch (e) {} }, ms || 4000);
    });
  };
  marcar();
  /* repintura que ainda não terminou (leitor de lei grande): tenta de novo logo depois */
  if (!n) setTimeout(marcar, 120);
  return n;
}

function qsVincSalvar() {
  const c = qsVincCtx;
  if (!c || !c.esc) return false;
  const leiId = String($("qsVincLei").value || "");
  if (!leiId) { $("qsVincEscAviso").textContent = t("qs_vinc_sem_escolha"); return false; }
  const l = leiDe(leiId);
  if (!l) { $("qsVincEscAviso").textContent = t("qs_vinc_sem_escolha"); return false; }
  const campo = String($("qsVincArts").value || "").trim();
  const destinos = qsVincLerDestinos(campo);
  /* uma palavra no campo ainda não é um destino: escolher na lista primeiro */
  if (campo && !destinos.length) { $("qsVincEscAviso").textContent = t("qs_vinc_sem_artigo"); return false; }
  const artigos = destinos.map((d) => ({ num: d.num, numCru: d.numCru, base: d.base, sub: d.sub }));
  const perm = !!$("qsVincPerm").checked;
  const trecho = c.esc.trecho;
  const q = c.q;
  const soTopico = !$("qsVincAlcTudo") || !$("qsVincAlcTudo").checked;
  const chave = soTopico && q && q.disciplina && q.topico && typeof matChave === "function"
    ? matChave(q.disciplina, q.topico) : "";
  $("dlgQsVincEsc").close();
  if (perm) {
    const r = citVinculoSalvar({ trecho, leiId, artigos, chave });
    try { reg("QUESTOES", (c.esc.cit ? "vínculo corrigido (permanente)" : "vínculo criado (permanente)"),
      trecho + " → " + l.nome + " · " + artigos.map((a) => a.numCru).join("; ")
      + (chave ? " · só no tópico " + (q.topico || "") : " · em todo o app")); } catch (e) {}
    if (!r) { try { uiAlert(t("qs_vinc_erro_gravar")); } catch (e) {} return false; }
    /* o vínculo velho do MESMO trecho, no outro alcance, sairia vencido em silêncio */
    if (c.esc.cit && c.esc.cit.vinculoK && c.esc.cit.vinculoK !== r.k) citVinculoRemover(c.esc.cit.vinculoK);
    qsVincPintar();
    qsUiVoltaDe(q)();
    /* (v18.49.0) A CONFIRMAÇÃO: o relato foi "visualmente não tenho garantia de que o vínculo foi efetivado". Um aviso
     * diz o que foi ligado e onde vale, e o link recém-ligado pisca na tela (de onde se veio já repintada). */
    try {
      toastMsg(t("qs_vinc_feito", { tr: qsVincCurto(trecho), l: l.apelido || l.nome, a: artigos.map((x) => x.numCru).filter(Boolean).join("; ") || "—",
        alc: t(chave ? "qs_vinc_alc_topico" : "qs_vinc_alc_tudo_curto") }), 4500);
    } catch (e) {}
    citDestacarRecem(trecho);
    return true;
  }
  /* só desta vez: abre agora, sem guardar */
  try { reg("QUESTOES", "vínculo usado só agora", trecho + " → " + l.nome); } catch (e) {}
  if ($("dlgQsVinc").open) $("dlgQsVinc").close();
  leiVoltaPara = qsUiVoltaDe(q);
  const a0 = artigos[0];
  const achou = leiAbrirNoArtigo(q.disciplina, q.topico, l.id, a0 ? a0.num : "", a0 ? a0.sub : undefined);
  if (a0 && !achou) {
    try { uiAlert(t("qs_lei_link_nao_achou", { a: a0.numCru, l: l.nome })); } catch (e) {}
  }
  return true;
}

/* =====================================================================
 * O ⚖ COM MAIS DE UMA LEI: PERGUNTAR, NÃO CHUTAR
 *
 * Com uma lei só, perguntar seria burocracia — abre direto. Com duas, o
 * botão abria a primeira e essa era a metade errada das vezes.
 *
 * O MENU É FIXED, e é o mesmo motivo do ⋮: ele nasce dentro de
 * #qsSessCorpo, que recorta. Um absolute pendurado no botão é cortado na
 * borda da caixa e não há z-index que resolva — z-index decide quem fica
 * na frente, não quem existe fora da moldura. Por isso reaproveita
 * qsFerMenu inteiro, com o mesmo fechar-no-clique-fora e no Esc.
 * ===================================================================== */
/* (v18.51.0) As citações SEM LEI de um texto que ainda perguntam (sem vínculo, sem lei herdada na mesma linha, sem
 * resolução sozinha), uma por trecho, fora a "exceto". A herança da linha segue a da leitura (citLigarEm): "art. 3º do
 * CTN ... art. 4º" na mesma linha é do CTN — ligar esse "art. 4º" a outra lei seria errado. */
function citSemLeiDoTexto(texto, ch, lista, doTopico, exceto) {
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const vistos = new Set([norm(exceto)]);
  const out = [];
  String(texto || "").split(/\n/).forEach((linha) => {
    let cs = [];
    try {
      cs = leiCitacoesNoTexto(linha);
      if (typeof citVinculosAplicar === "function") cs = citVinculosAplicar(linha, cs, ch);
    } catch (e) { cs = []; }
    let rot = "";
    cs.forEach((c) => {
      if (c.rotulo) { rot = c.rotulo; return; }
      if (rot || !c.num || !c.texto) return;
      let a = null;
      try { a = qsUiLeiAlvo(c, lista, doTopico); } catch (e) { a = null; }
      if (a && a.lei) return;
      const k = norm(c.texto);
      if (vistos.has(k)) return;
      vistos.add(k);
      out.push(c);
    });
  });
  return out;
}

function qsUiLeiEscolher(botao, q, cit) {
  if (!botao || !q) return null;
  const ch = (typeof matChave === "function") ? matChave(q.disciplina, q.topico) : "";
  let doTopico = [], lista = [];
  try {
    doTopico = (typeof leisDoTopico === "function" && ch) ? leisDoTopico(ch) : [];
    lista = (typeof leisLista === "function") ? leisLista() : [];
  } catch (e) {}

  let menu = $("qsLeiMenu");
  if (!menu) {
    menu = document.createElement("span");
    menu.id = "qsLeiMenu";
    menu.className = "qs-fer-menu qs-lei-menu";
    menu.hidden = true;
    (botao.parentNode || document.body).append(menu);
  }
  /* já aberto, o mesmo toque fecha — senão o botão vira um interruptor
   * que só liga */
  if (!menu.hidden) { qsFerFechar(); return null; }
  menu.innerHTML = "";

  const rot = document.createElement("span");
  rot.className = "qs-fer-rot";
  /* TRÊS PERGUNTAS DIFERENTES, e o texto diz qual é: a citação nomeou
   * uma lei que não bate com nenhuma guardada (diz o nome, para quem
   * está lendo reconhecer o motivo); não nomeou nenhuma, com o tópico
   * tendo mais de uma; ou é o botão ⚖ perguntando em geral, sem citação
   * nenhuma por trás. */
  rot.textContent = cit && cit.rotulo
    ? t("qs_lei_esc_desconhecida", { l: cit.rotulo, a: cit.numCru })
    : cit
    ? t("qs_lei_esc_cit", { a: cit.numCru })
    : t("qs_lei_esc_tit", { n: doTopico.length });
  menu.append(rot);

  /* O MARCADOR DE "VINCULAR À FORÇA". Quando a citação NOMEOU uma sigla
   * que o aplicativo não reconheceu ("CTN"), escolher a lei aqui é a
   * pessoa dizendo o que a sigla significa — e valia só desta vez: na
   * citação seguinte, o mesmo menu de novo. Marcado (padrão), a escolha
   * vira o apelido da lei e todo "CTN" dali em diante abre direto. Dá
   * para desmarcar para uma consulta avulsa, e corrigir o apelido depois
   * em "fonte e data" da lei. */
  const podeLembrar = !!(cit && cit.rotulo && typeof leiApelidoAdicionar === "function"
    && leiTxtChave(cit.rotulo).replace(/[^a-z0-9-]/g, "").length >= 2
    && leiTxtChave(cit.rotulo).indexOf(" ") < 0);
  let lembrar = null;
  /* (v18.50.0) CITAÇÃO SEM LEI ("art. 148", sem dizer de qual): escolher aqui valia SÓ DESTA VEZ — a prévia abria na
   * lei escolhida, mas o link continuava "sem lei" no próximo desenho, e a pessoa achava que tinha ligado (o relato:
   * "mesmo depois de carregar a nova versão, o vínculo ainda não efetiva"). Agora, marcado (padrão), a escolha vira o
   * vínculo guardado do trecho neste tópico — com o aviso, o 🔗 e o destaque de qualquer vínculo. */
  let lembrarVinc = null;
  if (cit && !cit.rotulo && cit.texto && cit.num && typeof citVinculoSalvar === "function") {
    const lv = document.createElement("label");
    lv.className = "qs-lei-lembrar qs-lei-lembrar-vinc";
    lembrarVinc = document.createElement("input");
    lembrarVinc.type = "checkbox";
    lembrarVinc.checked = true;
    lembrarVinc.id = "qsLeiLembrarVinc";
    lv.append(lembrarVinc, document.createTextNode(" " + t("qs_lei_lembrar_vinc", { tr: qsVincCurto(cit.texto) })));
    lv.title = t("qs_lei_lembrar_vinc_aj");
    menu.append(lv);
  }
  /* (v18.51.0) AS OUTRAS CITAÇÕES SEM LEI DO MESMO TEXTO: num resumo com dez "art. N" sem lei, eram dez perguntas.
   * Uma caixa a mais (DESMARCADA: CF e CTN têm artigos de mesmo número) liga de uma vez as que ainda perguntam;
   * a que cita artigo que esta lei não tem fica como está, e o aviso diz quais. */
  let todas = null, outrasSemLei = [];
  if (lembrarVinc) {
    try { outrasSemLei = citSemLeiDoTexto(q._texto || q.comentario || "", ch, lista, doTopico, cit.texto); } catch (e) { outrasSemLei = []; }
  }
  if (outrasSemLei.length) {
    const lt = document.createElement("label");
    lt.className = "qs-lei-lembrar qs-lei-lembrar-vinc";
    todas = document.createElement("input");
    todas.type = "checkbox";
    todas.checked = false;
    todas.id = "qsLeiTodasSemLei";
    const chaveTxt = q._onde === "resumo" ? "qs_lei_todas_resumo" : q._texto ? "qs_lei_todas" : "qs_lei_todas_coment";
    lt.append(todas, document.createTextNode(" " + t(chaveTxt, { n: outrasSemLei.length })));
    lt.title = t("qs_lei_todas_aj") + "\n" + outrasSemLei.map((c) => c.texto).join(" · ");
    menu.append(lt);
  }
  if (podeLembrar) {
    const lb = document.createElement("label");
    lb.className = "qs-lei-lembrar";
    lembrar = document.createElement("input");
    lembrar.type = "checkbox";
    lembrar.checked = true;
    lembrar.id = "qsLeiLembrar";
    lb.append(lembrar, document.createTextNode(" " + t("qs_lei_lembrar", { l: cit.rotulo })));
    lb.title = t("qs_lei_lembrar_ajuda");
    menu.append(lb);
  }

  doTopico.forEach((l) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min";
    let nArt = 0;
    try { nArt = leiArtigos(l.texto).length; } catch (e) {}
    const linha1 = document.createElement("span");
    linha1.className = "qs-lei-esc-nome";
    linha1.textContent = l.nome + " · " + t("lei_n_artigos", { n: nArt });
    b.append(linha1);
    /* A NOTA AJUDA A ESCOLHER SEM ABRIR AS DUAS. "cit" só existe quando
     * o popover nasceu de uma citação de artigo específica — sem ele,
     * não há UM artigo para procurar nota nenhuma. */
    const notaEsc = cit && typeof leiNotaDe === "function"
      ? leiNotaDe(l.id, cit.num) : "";
    if (notaEsc) {
      const linha2 = document.createElement("span");
      linha2.className = "qs-lei-esc-nota";
      linha2.textContent = notaEsc;
      b.append(linha2);
    }
    b.title = t("qs_lei_esc_item", { l: l.nome });
    b.onclick = () => {
      const lembrarEsta = !!(lembrar && lembrar.checked);
      qsFerFechar();
      if (lembrarEsta) {
        try {
          if (leiApelidoAdicionar(l.id, cit.rotulo)) {
            reg("QUESTOES", "sigla vinculada à lei à força", cit.rotulo + " → " + l.nome);
          }
          /* CONFERE SE A SIGLA REALMENTE PASSOU A RESOLVER. Gravar o
           * apelido e a citação seguinte continuar sem abrir era o
           * defeito do print, e ninguém via: agora fica dito no registro
           * quando isso acontece, com o motivo. */
          const casou = leiCasarRotulo(cit.rotulo, leisLista());
          if (!casou || casou.id !== l.id) {
            reg("QUESTOES", "sigla vinculada mas AINDA não resolve",
                cit.rotulo + " → " + l.nome + " · " + qsUiLeiMotivoFalha(cit, leisLista()));
          }
        } catch (e) {}
      }
      leiVoltaPara = qsUiVoltaDe(q);
      const num = cit ? cit.num : "";
      /* (v18.50.0) lembrar a escolha: o vínculo do trecho, neste tópico */
      let citP = cit;
      const todasEsta = !!(todas && todas.checked);
      const gravarVinc = (c0) => {
        const sub = { incisos: (c0.incisos || []).slice(), paragrafos: (c0.paragrafos || []).slice(), alineas: (c0.alineas || []).slice() };
        const numCru = typeof qsVincRotuloDestino === "function" ? qsVincRotuloDestino(c0.numCru, sub) : c0.numCru;
        const r = citVinculoSalvar({ trecho: c0.texto, leiId: l.id, artigos: [{ num: c0.num, numCru, base: c0.numCru, sub }], chave: ch });
        if (r) try { reg("QUESTOES", "vínculo criado pelo menu de escolha (permanente)", c0.texto + " → " + l.nome + " · art. " + numCru + (ch ? " · só no tópico " + (q.topico || "") : "")); } catch (e) {}
        return r ? { r, numCru } : null;
      };
      if (cit && ((lembrarVinc && lembrarVinc.checked) || todasEsta)) {
        const g = gravarVinc(cit);
        if (g) {
          const feitos = [cit.texto], pulou = [];
          if (todasEsta) {
            let nums = null;
            try { nums = new Set(leiArtigosEfetivos(l).map((x) => x.num)); } catch (e) { nums = null; }
            outrasSemLei.forEach((c0) => {
              if (nums && !nums.has(c0.num)) { pulou.push(c0.texto); return; }
              if (gravarVinc(c0)) feitos.push(c0.texto);
            });
          }
          try { qsUiVoltaDe(q)(); } catch (e) {}
          const alc = t(ch ? "qs_vinc_alc_topico" : "qs_vinc_alc_tudo_curto");
          try {
            toastMsg(todasEsta
              ? t("qs_vinc_feito_lote", { n: feitos.length, l: l.apelido || l.nome, alc }) + (pulou.length ? t("qs_vinc_lote_pulou", { lista: pulou.join(", ") }) : "")
              : t("qs_vinc_feito", { tr: qsVincCurto(cit.texto), l: l.apelido || l.nome, a: g.numCru, alc }), todasEsta ? 7000 : 4500);
          } catch (e) {}
          feitos.forEach((tr) => citDestacarRecem(tr));
          citP = Object.assign({}, cit, { leiId: l.id, permanente: true, vinculoK: g.r.k, soTopico: !!ch });
          /* VÁRIAS DE UMA VEZ: o que importa é o resultado (quantas, quais ficaram de fora) — a prévia de UM artigo
           * cobriria o aviso. Fica o texto à vista, com os links piscando; tocar num deles abre a prévia. */
          if (todasEsta) { leiVoltaPara = null; return; }
        }
      }
      /* escolhida a lei para uma CITAÇÃO, sobe a prévia do artigo (v18.32.0); o ⚖ geral abre a lei */
      if (num && typeof leiCitacaoPreviewAbrir === "function") {
        leiVoltaPara = null;
        leiCitacaoPreviewAbrir(citP, "", { lei: l, ctx: { disciplina: q.disciplina, topico: q.topico, aoVoltar: qsUiVoltaDe(q) } });
        reg("QUESTOES", "lei escolhida na questão (prévia)", l.nome + " · art. " + num);
        return;
      }
      const achou = leiAbrirNoArtigo(q.disciplina, q.topico, l.id, num, cit);
      if (num && !achou) {
        try { uiAlert(t("qs_lei_link_nao_achou", { a: cit.numCru, l: l.nome })); }
        catch (e) {}
      }
      reg("QUESTOES", "lei escolhida na questão", l.nome + (num ? " · art. " + num : ""));
    };
    menu.append(b);
  });

  /* AS DUAS PORTAS DE ENTRADA DE LEI NOVA, aqui pelo mesmo motivo que
   * estão na fila de chips do leitor: quando a lei que a questão cita
   * não está entre as do tópico, o caminho não pode ser "feche tudo e
   * vá procurar no material". */
  const outras = lista.filter((l) => !doTopico.some((d) => d.id === l.id));
  if (outras.length) {
    const bv = document.createElement("button");
    bv.type = "button";
    bv.className = "btn-min";
    bv.id = "btnQsLeiVincular";
    bv.textContent = t("lei_vincular", { n: outras.length });
    bv.title = t("lei_vincular_ajuda");
    bv.onclick = () => {
      qsFerFechar();
      leiVoltaPara = qsUiVoltaDe(q);
      leiAbrir(q.disciplina, q.topico, undefined, { semRetomar: true });
      try {
        leiVincularAbrir(lembrar && lembrar.checked ? cit.rotulo : "");
      } catch (e) {}
    };
    menu.append(bv);
  }
  const bn = document.createElement("button");
  bn.type = "button";
  bn.className = "btn-min";
  bn.id = "btnQsLeiNova";
  bn.textContent = t("lei_colar_nova");
  bn.title = t("lei_colar_nova_ajuda");
  bn.onclick = () => {
    qsFerFechar();
    leiVoltaPara = qsUiVoltaDe(q);
    leiAbrir(q.disciplina, q.topico, undefined, { semRetomar: true });
    try { leiNovaAbrir(); } catch (e) {}
  };
  menu.append(bn);

  return qsFerMenu(botao, menu);
}

/* =====================================================================
 * DA QUESTÃO PARA A LEI, E DE VOLTA
 *
 * A SESSÃO NÃO É FECHADA — mesma regra do botão de julgados. Um
 * <dialog> aberto por showModal() empilha no top layer: a lei sobe por
 * cima da questão e, ao fechar, descobre a mesma questão com a rolagem,
 * o rascunho e os grifos como estavam. Fechar e reabrir a sessão
 * perderia as três coisas, e perder o traço de uma conta no meio de uma
 * questão é o tipo de estrago que faz alguém parar de usar o botão.
 * ===================================================================== */
function qsUiLei(q) {
  if (!q || !q.disciplina || !q.topico) return;
  if (typeof leiAbrir !== "function") return;
  const ch = (typeof matChave === "function")
    ? matChave(q.disciplina, q.topico) : "";
  const antes = (typeof leiTem === "function" && ch) ? leiTem(ch) : false;
  leiAbrir(q.disciplina, q.topico, undefined, { semRetomar: true });
  /* LER, e não editar: no meio de uma prova o que se quer é conferir a
   * letra do artigo. leiAbrir já decide isso pelo conteúdo, mas dizer
   * aqui torna o comportamento independente daquela decisão. */
  try { if (typeof leiTrocarModo === "function" && antes) leiTrocarModo("ler"); }
  catch (e) {}
  leiVoltaPara = () => {
    /* repinta SEMPRE: além de a lei poder ter sido colada agora, o
     * botão da sessão conta o que existe — e conta errado se ninguém
     * lhe disser que algo mudou */
    try { qsUiPintarSessao(); } catch (e) {}
  };
  reg("QUESTOES", "lei seca aberta pela questão",
      q.topico + (antes ? " · consulta" : " · ainda sem lei ligada"));
}

/* ---------------------------------------------------------------------
 * A ABA
 * ------------------------------------------------------------------- */
/* Leva o resultado da sessão para o registro de estudo do edital.
 * Não grava nada sozinho: abre o mesmo formulário de sempre, já preenchido,
 * para a pessoa conferir, ajustar e confirmar. */
/* =====================================================================
 * MELHORAR ESTA QUESTÃO
 *
 * Questão gerada por IA sai torta com frequência, e até aqui a única
 * saída era apagá-la — perdendo junto o histórico de acertos e a dica
 * escrita à mão. Aqui ela é CONSERTADA: mesma questão, mesmo id, mesmo
 * histórico, texto novo.
 *
 * O prompt não pede "melhore". Pede para consertar defeitos NOMEADOS,
 * porque "melhore esta questão" devolve outra versão do mesmo
 * problema — a IA não sabe o que incomodou.
 * ===================================================================== */
let qmAlvo = null;
let qmNova = null;
let qmExtras = [];

function qmTextoDaQuestao(q) {
  const L = ["TIPO: " + (q.tipo === "ce" ? "CE" : "ME"),
             "BANCA: " + (q.banca || "")];
  L.push("ENUNCIADO: " + String(q.enunciado || ""));
  (q.opcoes || []).forEach((o) => L.push(o.letra + ") " + o.txt));
  L.push("GABARITO: " + String(q.gabarito || ""));
  if (q.comentario) L.push("COMENTARIO: " + String(q.comentario));
  return L.join("\n");
}

function qmDescreverDefeitos(lista) {
  if (!lista.length) return "- " + t("qm_sem_defeito");
  return lista.map((d) => "- " + t("qm_def_" + d.id, { n: d.n, g: d.g })).join("\n");
}

function qsUiMelhorarAbrir() {
  const q = qsAtual();
  if (!q) return;
  qmAlvo = q;
  qmNova = null;
  const defeitos = qsDefeitos(q);

  const cx = $("qmDefeitos");
  cx.innerHTML = "";
  if (!defeitos.length) {
    const d = document.createElement("div");
    d.className = "nota";
    d.textContent = t("qm_sem_defeito");
    cx.append(d);
  } else {
    defeitos.forEach((x) => {
      const d = document.createElement("div");
      d.className = "qm-def";
      d.textContent = t("qm_def_" + x.id, { n: x.n, g: x.g });
      cx.append(d);
    });
  }

  $("qmPrompt").value = t("qm_prompt", {
    defeitos: qmDescreverDefeitos(defeitos),
    tipo: q.tipo === "ce" ? "CE" : "ME",
    banca: q.banca || "—",
    disciplina: q.disciplina || "—",
    topico: q.topico || "—",
    opcoes_rot: q.tipo === "ce" ? "" : "A) … B) … C) … D) … E) …\n",
    atual: qmTextoDaQuestao(q),
  });
  $("qmColar").value = "";
  $("qmComparar").hidden = true;
  $("btnQmAplicar").hidden = true;
  if ($("btnQmAplicarTodas")) $("btnQmAplicarTodas").hidden = true;
  if ($("qmExtrasAviso")) $("qmExtrasAviso").hidden = true;
  qmExtras = [];
  abrirModal("dlgQsMelhorar");
  matReg("questao", "correção de questão aberta",
         defeitos.map((d) => d.id).join(", ") || "sem defeito detectado");
}

function qsUiMelhorarConferir() {
  const cru = String(($("qmColar") || {}).value || "").trim();
  if (!cru) { uiAlert(t("qm_vazio")); return false; }
  const r = qsLerResposta(cru, {
    disciplina: qmAlvo && qmAlvo.disciplina, topico: qmAlvo && qmAlvo.topico,
    chave: qmAlvo && qmAlvo.chave, concurso: qmAlvo && qmAlvo.concurso,
  });
  const nova = (r.achados || [])[0];
  if (!nova || !nova.enunciado) { uiAlert(t("qm_nao_leu")); return false; }
  qmNova = nova;
  /* A IA DEVOLVEU MAIS DE UMA.
   *
   * O prompt pede uma questão só, mas quando o enunciado original tinha
   * três coladas — que é um dos defeitos que este recurso existe para
   * consertar — devolver três é a resposta CERTA. Até aqui o app pegava
   * a primeira e descartava o resto sem dizer nada: o trabalho da IA
   * sumia, e quem colou não tinha como saber.
   *
   * Agora as extras aparecem e a escolha é explícita. Elas entram como
   * questões NOVAS (a rodada em curso não as vê — a fila dela foi
   * montada antes), e por isso o recibo diz isso. */
  qmExtras = (r.achados || []).slice(1).filter((q) => q && q.enunciado);

  /* ANTES E DEPOIS, LADO A LADO. Aplicar sem ver o que muda é confiar
   * na IA justamente onde ela já falhou uma vez. */
  const cx = $("qmComparar");
  cx.innerHTML = "";
  /* "GABARITO: E" NAO SE LE.
   *
   * Numa questao de certo/errado, o enunciado corrigido e uma AFIRMACAO
   * a julgar — e uma afirmacao falsa e um item perfeitamente valido. Mas
   * a comparacao mostrava a frase sozinha, seguida de "gabarito: E", e
   * quem le ve o app afirmando uma coisa errada e conclui que a correcao
   * saiu torta. Foi exatamente o que aconteceu com "É constitucional a
   * norma que vincula o ISS...": a questao estava certa, o painel e que
   * nao dizia que aquilo era um item para julgar, nem o que "E"
   * significa, nem por que.
   *
   * Tres consertos: a moldura de "julgue o item", o gabarito por
   * extenso, e o comentario — que e o que permite discordar da IA. */
  const gabPorExtenso = (q) => {
    const g = String(q.gabarito || "").toUpperCase();
    if (q.tipo !== "ce") return t("qs_gab_e", { g: g || "?" });
    if (g === "C") return t("qm_gab_certo");
    if (g === "E") return t("qm_gab_errado");
    return t("qs_gab_e", { g: g || "?" });
  };

  [["qm_antes", qmAlvo, "qm-antes"], ["qm_depois", nova, "qm-depois"]]
    .forEach(([rot, q, cls]) => {
      const r1 = document.createElement("div");
      r1.className = "qm-rot";
      r1.textContent = t(rot);
      const d = document.createElement("div");
      d.className = "qm-lado " + cls;

      if (q.tipo === "ce") {
        const mold = document.createElement("div");
        mold.className = "qm-julgue";
        mold.textContent = t("qm_julgue");
        d.append(mold);
      }
      const en = document.createElement("div");
      en.textContent = String(q.enunciado || "").slice(0, 700);
      const gb = document.createElement("div");
      gb.className = "qm-gab";
      gb.textContent = gabPorExtenso(q);
      d.append(en, gb);
      if (q.comentario) {
        const cm = document.createElement("div");
        cm.className = "qm-coment";
        cm.textContent = String(q.comentario).slice(0, 400);
        d.append(cm);
      }
      cx.append(r1, d);
    });
  cx.hidden = false;
  $("btnQmAplicar").hidden = false;
  $("btnQmAplicar").textContent = t("qm_aplicar");

  const av = $("qmExtrasAviso");
  if (av) {
    av.hidden = !qmExtras.length;
    av.textContent = qmExtras.length
      ? t("qm_extras", { n: qmExtras.length,
          lista: qmExtras.map((q) => "\u2022 " + String(q.enunciado).slice(0, 90))
            .join("\n") })
      : "";
  }
  const bMais = $("btnQmAplicarTodas");
  if (bMais) {
    bMais.hidden = !qmExtras.length;
    bMais.textContent = t("qm_aplicar_todas", { n: qmExtras.length });
    bMais.title = t("qm_aplicar_todas_ajuda", { n: qmExtras.length });
  }

  /* a versão nova também passa pelo detector: sem isto, trocaríamos um
   * texto torto por outro sem ninguém perceber */
  const aindaRuim = qsDefeitos(nova);
  if (aindaRuim.length) {
    uiAlert(t("qm_ainda_ruim", { n: aindaRuim.length,
      lista: aindaRuim.map((d) => d.id).join(", ") }));
  }
  return true;
}

function qsUiMelhorarAplicar(comExtras) {
  if (!qmAlvo || !qmNova) return false;
  /* MESMO id, MESMO histórico: o que muda é o texto. Criar uma questão
   * nova e apagar a velha perderia as tentativas e a dica escrita à
   * mão — que é o que dói mais numa questão já respondida. */
  const ok2 = qsSubstituir(qmAlvo.id, {
    enunciado: qmNova.enunciado,
    opcoes: qmNova.opcoes || qmAlvo.opcoes,
    gabarito: qmNova.gabarito || qmAlvo.gabarito,
    comentario: qmNova.comentario || qmAlvo.comentario,
    banca: qmNova.banca || qmAlvo.banca,
  });
  if (!ok2) { uiAlert(t("qm_nao_leu")); return false; }
  let entraram = 0;
  if (comExtras && qmExtras.length) {
    /* passam pela MESMA porta das questões novas: dedupe por semelhança
     * e tudo o mais. Uma extra igual a uma que já existe é recusada
     * ali, como seria em qualquer criação. */
    const res = qsAplicar(qmExtras.map((q) => Object.assign({}, q, {
      disciplina: qmAlvo.disciplina, topico: qmAlvo.topico,
      chave: qmAlvo.chave, concurso: qmAlvo.concurso,
    })));
    entraram = (res && res.novas ? res.novas.length : 0);
  }
  $("dlgQsMelhorar").close();
  qsUiPintarSessao();
  uiAlert(entraram
    ? t("qm_aplicado_mais", { n: entraram })
    : t("qm_aplicado"));
  matReg("questao", "questão corrigida pela IA",
         String(qmNova.enunciado || "").slice(0, 60)
         + (entraram ? " · +" + entraram + " acrescentadas" : ""));
  qmAlvo = null; qmNova = null; qmExtras = [];
  return true;
}

/* ENCERRAR AGORA — com duas perguntas.
 *
 * A primeira mostra o placar e o que fica pendente; a segunda exige
 * confirmar que é isso mesmo. Duas porque o gesto é irreversível para a
 * rodada: as pendentes voltam a ser pendentes, e quem apertou por
 * engano perde a sequência em que estava. Depois do sim, vai direto ao
 * registro de estudo com o placar parcial — que é o motivo de existir
 * este botão. */
async function qsUiEncerrarComPlacar() {
  const s = qsSessaoAtual();
  const p = qsPlacar();
  if (!s || !p.feitas) { uiAlert(t("qs_registrar_nada")); return; }
  const faltam = Math.max(0, p.total - p.feitas);

  if (!(await uiConfirm(t("qs_encerrar_conf1", {
    c: p.certas, n: p.feitas, pct: p.pct, f: faltam })))) return;
  if (!(await uiConfirm(t("qs_encerrar_conf2", { n: p.feitas })))) return;

  matReg("questao", "rodada encerrada pelo placar parcial",
         p.certas + "/" + p.feitas + " (" + p.pct + "%) · " + faltam + " pendentes");
  /* o registro precisa da sessão VIVA para saber o tópico e o tempo;
   * apagar antes deixaria o registro sem de onde tirar os dados */
  qsUiRegistrarEstudo();
}

/* SEGUNDA PASSADA, só nas que erraram — e com placar próprio.
 *
 * Somar os acertos da repescagem no placar da primeira rodada apagaria a
 * única informação que interessa aqui: quanto você acertava ANTES de
 * rever. Uma rodada nova, marcada como repescagem, mantém as duas
 * medidas separadas e comparáveis.
 *
 * A ORDEM É MANTIDA, sem embaralhar: a repescagem é releitura do próprio
 * erro, e reencontrar a questão onde ela estava ajuda a lembrar o que se
 * pensou na hora. */
function qsUiRepescar() {
  const erradas = qsErradasDaSessao();
  if (!erradas.length) { uiAlert(t("qs_repescar_nada")); return false; }
  const s0 = qsSessaoAtual();
  const p0 = qsPlacar();
  /* REGISTRA A PRIMEIRA RODADA ANTES de abrir a segunda: sem isto, o
   * histórico do bloco ficaria com o placar da repescagem por cima do
   * original, e o bloco original desapareceria da conta. */
  try {
    if (typeof qhAtualizar === "function") qhAtualizar(p0, { fechar: true });
  } catch (e) {}
  matReg("questao", "repescagem das erradas",
         erradas.length + " de " + p0.feitas + " feitas · "
         + p0.certas + " certas na primeira passada");

  qsSessaoIniciar(erradas, {
    escopo: (s0 && s0.escopo) || "", repescagem: true,
    deRodada: { feitas: p0.feitas, certas: p0.certas, pct: p0.pct },
  });
  try {
    if (typeof qhIniciar === "function") {
      qhIniciar(erradas, { origem: "repescagem", escopo: (s0 && s0.escopo) || "" });
    }
  } catch (e) {}
  qsUiPintarSessao();
  return true;
}

function qsUiRegistrarEstudo() {
  const s = qsSessaoAtual();
  if (!s || !s.respondidas.length) { uiAlert(t("qs_registrar_nada")); return; }
  const p = qsPlacar();

  /* de qual tópico foi esta sessão? Se ela misturou tópicos, não há um
   * lugar honesto para lançar as horas — e inventar um seria pior. */
  const chaves = {};
  s.fila.forEach((q) => { if (q.chave) chaves[q.chave] = q; });
  const nomes = Object.keys(chaves);
  if (nomes.length !== 1) {
    uiAlert(t("qs_registrar_varios", { n: nomes.length }));
    return;
  }
  const modelo = chaves[nomes[0]];

  /* tempo da sessão, arredondado para cima: meia questão não é meio minuto */
  const min = Math.max(1, Math.min(240,
    Math.round((Date.now() - new Date(s.comecou).getTime()) / 60000)));

  $("dlgQsResponder").close();
  if (typeof abrirRegistro !== "function") { uiAlert(t("qs_registrar_sem_edital")); return; }
  /* NÃO DIZER "feito: false" AQUI.
   *
   * Era este o defeito: resolver questões de um tópico que estava para
   * revisar somava as horas mas não cumpria a revisão — o tópico
   * continuava cobrado na agenda, dia após dia, com o tempo entrando
   * numa conta e a revisão em outra.
   *
   * A causa era esta linha. O "feito: false" não era uma informação,
   * era um valor de preenchimento — e abrirRegistro respeita o que
   * recebe: só busca o estado real do plano quando o campo vem VAZIO.
   * Dizer "false" sobrescrevia a verdade com um palpite, e o palpite
   * estava sempre errado justamente nos tópicos já estudados.
   *
   * Omitindo o campo, quem decide é o plano — que é quem sabe. */
  /* A RODADA SÓ É DADA POR LANÇADA DEPOIS DE CONFIRMADA.
   *
   * Marcar aqui, na abertura do formulário, repetiria o erro que este
   * trabalho inteiro veio consertar: quem fechasse o formulário sem
   * gravar teria a rodada apagada tendo registrado nada. É o mesmo
   * "regDepois" que a lei seca usa — e pelo mesmo motivo. */
  regDepois = () => {
    try { qsSessaoRegistrada(); } catch (e) {}
    try {
      matReg("questao", "rodada registrada e encerrada",
             modelo.topico + " · " + p.certas + "/" + p.feitas);
    } catch (e) {}
  };
  abrirRegistro({
    nome: modelo.topico, disciplina: modelo.disciplina,
    chave: modelo.chave, minutos: min,
  });
  if (typeof regDeQuestoes === "function") {
    regDeQuestoes(p.feitas, p.certas, min);
  }
  matReg("questao", "registro de estudo por questões aberto",
         modelo.topico + " · " + p.certas + "/" + p.feitas
         + " (" + p.pct + "%) · " + min + " min sugeridos");
}

function qsUiOpcoesDe(sel, valores, rotuloTodos, atual) {
  const s = $(sel);
  if (!s) return;
  s.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = ""; o0.textContent = rotuloTodos;
  s.append(o0);
  valores.forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    if (v === atual) o.selected = true;
    s.append(o);
  });
}

/* =====================================================================
 * FILTRAR POR EDITAL E POR TÓPICO
 *
 * Disciplina é o nome que a questão carrega; o edital é a lista que a
 * pessoa está estudando. Com dois ou três concursos abertos, "todas as
 * questões de Direito Financeiro" mistura recortes de bancas e cargos
 * diferentes — e a pergunta real, na hora de estudar, é sempre "o que eu
 * tenho PARA ESTE edital?".
 *
 * O tópico vem depois e é filtrado pelo edital escolhido. E os BLOCOS do
 * edital entram como cabeçalho da lista (<optgroup>): é o que transforma
 * 232 linhas soltas numa lista navegável, e é também onde a pergunta
 * "tenho questões do bloco que está abaixo do mínimo?" ganha resposta.
 * ================================================================== */

/* As chaves de tópico de um edital, agrupadas pelos blocos dele. */
function qsUiTopicosDoEdital(id) {
  if (typeof editais === "undefined" || typeof lerEdital !== "function") return [];
  const e = (editais || []).filter((x) => x.id === id)[0];
  if (!e) return [];
  const r = lerEdital(e.texto || "");
  const porBloco = {};
  const ordem = [];
  (r.disciplinas || []).forEach((d) => {
    /* sem blocos declarados, a DISCIPLINA vira o cabeçalho: melhor um
     * agrupamento óbvio que uma lista de 232 nomes sem hierarquia */
    const grupo = d.bloco || d.nome;
    if (!porBloco[grupo]) { porBloco[grupo] = []; ordem.push(grupo); }
    (d.topicos || []).forEach((tp) => {
      porBloco[grupo].push({
        chave: (d.nome + "›" + tp.nome).toLowerCase(),
        nome: tp.nome, disciplina: d.nome,
      });
    });
  });
  return ordem.map((g) => ({ grupo: g, itens: porBloco[g] }));
}

/* A lista que está na tela agora — usada pelo "responder tudo", que
 * precisa responder exatamente o que está sendo mostrado. */
/* O QUE REFAZER PRECISA SABER.
 * Um item de histórico que diz "12 de 20, 60%" é um número solto que não
 * leva a lugar nenhum. Guardando o filtro, "refazer" reconstrói o mesmo
 * recorte — e é isso que transforma o histórico numa ferramenta em vez
 * de um placar. */
/* =====================================================================
 * O HISTÓRICO NA TELA
 *
 * Cada linha responde três coisas, nesta ordem: DE QUE foi o bloco, COMO
 * você foi, e o caminho para REFAZER. A terceira é a que separa um
 * histórico de um placar — sem ela, a lista é só um museu de números.
 * ================================================================== */
function qsUiHistRender() {
  const box = $("qsHistLista");
  if (!box) return;
  qhCarregar();
  const todos = qhTodos();

  const r = qhResumo(7);
  const cab = $("qsHistResumo");
  if (cab) {
    cab.textContent = r.blocos
      ? t("qs_hist_resumo_cab", { n: r.blocos + (r.blocos === 1 ? " bloco" : " blocos"),
          pct: r.pct === null ? "—" : r.pct + "%" })
      : t("qs_hist_resumo_zero");
  }

  box.innerHTML = "";
  if (!todos.length) {
    const p = document.createElement("div");
    p.className = "nota";
    /* dizer POR QUE está vazio, e o que fazer para deixar de estar */
    p.textContent = t("qs_hist_vazio");
    box.append(p);
    return;
  }

  todos.slice(0, 40).forEach((h) => {
    const li = document.createElement("div");
    /* INTERROMPIDO NÃO É ERRO — é informação, e a mais útil: diz onde o
     * estudo emperra. Por isso tem estado próprio, em cor de atenção.
     * SÓ QUANDO HÁ ALGO A RETOMAR (feitas > 0): um bloco com 0 feitas já
     * diz "não começou" — somar "interrompido" ali é a mesma notícia
     * duas vezes, não uma segunda informação. */
    const aberto = !h.fim && h.feitas < h.total;
    const interrompido = aberto && h.feitas > 0;
    li.className = "qs-hist-item" + (interrompido ? " qs-hist-aberto" : "");

    /* LINHA 1: de que foi, e as duas ações — sempre juntas, porque o
     * rótulo cede (trunca, no CSS) o espaço que os botões precisam. */
    const cab = document.createElement("div");
    cab.className = "qs-hist-cab";

    const rot = document.createElement("span");
    rot.className = "qs-hist-rot";
    /* "" só sobrevive em bloco salvo ANTES do fallback existir em
     * qhRotulo (docs/questoes-hist.js) — mesmo texto genérico aqui,
     * para não voltar a duplicar a linha de baixo. */
    rot.textContent = h.rotulo || t("qs_todas_disc");
    rot.title = rot.textContent;

    const acoes = document.createElement("span");
    acoes.className = "qs-hist-acoes";
    const bRe = document.createElement("button");
    bRe.type = "button";
    bRe.className = "btn-min";
    bRe.textContent = t("qs_hist_refazer");
    bRe.title = t("qs_hist_refazer_ajuda");
    bRe.onclick = () => qsUiHistRefazer(h.id);
    const bDel = document.createElement("button");
    bDel.type = "button";
    bDel.className = "btn-min btn-min-perigo";
    bDel.textContent = "×";
    bDel.title = t("qs_hist_apagar_ajuda");
    bDel.onclick = () => { qhApagar(h.id); qsUiHistRender(); };
    acoes.append(bRe, bDel);
    cab.append(rot, acoes);

    /* LINHA 2: como você foi e quando — uma frase só, em vez dos dois
     * <span> de antes (que quebravam em linhas próprias no celular). */
    const meta = document.createElement("div");
    meta.className = "qs-hist-meta";
    const stats = h.feitas
      ? t("qs_hist_linha", { f: h.feitas, tot: h.total,
          pct: h.pct === null ? "—" : h.pct + "%" })
      : t("qs_hist_linha_zero", { tot: h.total });
    meta.textContent = stats + " · " + t("qs_hist_quando", {
        d: String(h.q || "").slice(0, 10), min: h.minutos || 0 })
      + " · " + t("qs_hist_origem_" + (h.origem || "aba"));
    if (interrompido) {
      const flag = document.createElement("span");
      flag.className = "qs-hist-flag";
      flag.textContent = " · " + t("qs_hist_aberto");
      meta.append(flag);
    }

    li.append(cab, meta);
    box.append(li);
  });
}

/* REFAZER = reconstruir o mesmo recorte, não repetir as mesmas questões
 * na mesma ordem. Se uma questão foi apagada desde então, o bloco vem
 * menor — e isso é mais honesto que ressuscitar o que não existe mais. */
function qsUiHistRefazer(id) {
  const h = qhTodos().filter((x) => x.id === id)[0];
  if (!h) return false;
  if (!h.filtro) { uiAlert(t("qs_hist_sem_filtro")); return false; }
  if (h.filtro.umaId) {
    const q = qsTodas().filter((x) => x.id === h.filtro.umaId)[0];
    if (!q) { uiAlert(t("qs_hist_sem_filtro")); return false; }
    qsUiResponderAbrir([q], "aba", "uma:" + q.id);
    return true;
  }
  Object.keys(h.filtro).forEach((k) => { qsUiFiltro[k] = h.filtro[k]; });
  qsUiRender();
  qsUiResponderAbrir(qsUiListaFiltrada(), h.origem || "aba", h.escopo || "");
  return true;
}

function qsUiFiltroDoEscopo(esc, deOnde) {
  if (deOnde === "aba") return Object.assign({}, qsUiFiltro);
  const m = String(esc || "").match(/^topico:(.+)$/);
  if (m) return { chave: m[1] };
  const u = String(esc || "").match(/^uma:(.+)$/);
  if (u) return { umaId: u[1] };
  return null;
}

/* Q2b — OS RAMOS DO TÓPICO de uma chave de questão, procurados nos editais (o primeiro que tem o tópico com ramos).
 * memo: um objeto da mesma pintura, para não reler os editais a cada linha da lista. */
function qsUiRamosDoTopico(chave, memo) {
  if (!chave || typeof editais === "undefined" || typeof lerEdital !== "function") return [];
  const alvo = qsChaveNormal(chave);
  if (memo && memo[alvo]) return memo[alvo];
  let achou = [];
  (editais || []).some((e) => {
    let r = null;
    try { r = lerEdital(e.texto || ""); } catch (x) { return false; }
    return (r.disciplinas || []).some((d) => (d.topicos || []).some((tp) => {
      if (qsChaveNormal((d.nome + "›" + tp.nome).toLowerCase()) !== alvo || !(tp.ramos && tp.ramos.length)) return false;
      achou = tp.ramos;
      return true;
    }));
  });
  if (memo) memo[alvo] = achou;
  return achou;
}
/* o filtro "Ramo": só aparece com um tópico escolhido que tem ramos */
function qsUiPintarRamos() {
  const sel = $("qsFRamo");
  if (!sel) return [];
  const ramos = qsUiFiltro.chave ? qsUiRamosDoTopico(qsUiFiltro.chave) : [];
  sel.hidden = !ramos.length;
  if (!ramos.length) { sel.innerHTML = ""; if (qsUiFiltro.ramo) qsUiFiltro.ramo = ""; return ramos; }
  const atual = qsUiFiltro.ramo || "";
  const val = atual === "_sem" || ramos.some((r) => r.id === atual) ? atual : "";
  sel.innerHTML = "";
  [["", t("qs_f_ramo_todos")], ["_sem", t("qs_f_ramo_sem")]].concat(ramos.map((r) => [r.id, r.nome])).forEach(([v, rot]) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = rot;
    sel.append(o);
  });
  sel.value = val;
  qsUiFiltro.ramo = val;
  return ramos;
}

function qsUiListaFiltrada() {
  const filtro = Object.assign({}, qsUiFiltro);
  if (filtro.edital && !filtro.chave) {
    const ks = [];
    qsUiTopicosDoEdital(filtro.edital).forEach((g) => {
      g.itens.forEach((it) => ks.push(qsChaveNormal(it.chave)));
    });
    filtro.chaves = ks;
  }
  delete filtro.edital;
  return qsFiltrar(filtro);
}

function qsUiPintarEditais() {
  const sel = $("qsFEdital");
  if (!sel) return;
  const lista = (typeof editais !== "undefined" ? editais : []) || [];
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = ""; o0.textContent = t("qs_todos_editais");
  sel.append(o0);
  lista.forEach((e) => {
    const o = document.createElement("option");
    o.value = e.id;
    o.textContent = e.nome;
    if (e.id === qsUiFiltro.edital) o.selected = true;
    sel.append(o);
  });
  /* com um edital só, escolher entre "todos" e "ele" não muda nada */
  sel.hidden = lista.length < 2;
}

function qsUiPintarTopicos() {
  const sel = $("qsFTopico");
  if (!sel) return;
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = ""; o0.textContent = t("qs_todos_topicos");
  sel.append(o0);

  const grupos = qsUiFiltro.edital ? qsUiTopicosDoEdital(qsUiFiltro.edital) : [];
  /* SEM EDITAL ESCOLHIDO NÃO HÁ LISTA DE TÓPICOS. Juntar os tópicos de
   * três editais numa lista só devolveria o amontoado que este filtro
   * existe para desfazer. */
  sel.hidden = !grupos.length;
  if (!grupos.length) { qsUiFiltro.chave = ""; return; }

  /* quantas questões existem por tópico: um tópico sem questão nenhuma
   * na lista é uma escolha que leva a uma tela vazia */
  const conta = {};
  qsTodas().forEach((q) => {
    const k = qsChaveNormal(q.chave || "");
    if (k) conta[k] = (conta[k] || 0) + 1;
  });

  grupos.forEach((g) => {
    const og = document.createElement("optgroup");
    og.label = g.grupo;
    let algum = false;
    g.itens.forEach((it) => {
      const n = conta[qsChaveNormal(it.chave)] || 0;
      if (!n) return;                 /* tópico sem questão não entra */
      algum = true;
      const o = document.createElement("option");
      o.value = it.chave;
      o.textContent = it.nome + " (" + n + ")";
      if (qsChaveNormal(it.chave) === qsChaveNormal(qsUiFiltro.chave)) o.selected = true;
      og.append(o);
    });
    if (algum) sel.append(og);
  });
}

function qsUiRender() {
  const box = $("qsLista");
  if (!box) return;
  qsUiPintarEditais();
  qsUiPintarTopicos();
  const ramosDoFiltro = qsUiPintarRamos();
  const memoRamos = {};
  qsUiOpcoesDe("qsFDisc", qsDisciplinas(), t("qs_todas_disc"), qsUiFiltro.disciplina);
  qsUiOpcoesDe("qsFBanca", qsBancas(), t("qs_todas_bancas"), qsUiFiltro.banca);

  /* o filtro de edital vira um CONJUNTO DE CHAVES aqui, não lá dentro:
   * o banco de questões não precisa saber o que é um edital */
  const lista = qsUiListaFiltrada();
  const d = qsDesempenho(lista);
  try { qsUiHistRender(); } catch (e) {}
  $("qsResumo").textContent = qsTodas().length
    ? t("qs_resumo", { n: lista.length, tot: qsTodas().length,
        f: d.feitas, pct: d.pct === null ? "—" : d.pct + "%" })
    : t("qs_vazio_curto");
  $("btnQsResponderTudo").disabled = !lista.length;
  $("btnQsResponderTudo").textContent = t("qs_responder_n", { n: lista.length });
  /* o assistente "ligar aos ramos": com um tópico de ramos escolhido e questões dele ainda sem ramo */
  const bLig = $("btnQsLigarRamos");
  if (bLig) {
    const semRamo = ramosDoFiltro.length ? qsFiltrar({ chave: qsUiFiltro.chave, ramo: "_sem" }).length : 0;
    bLig.hidden = !semRamo;
    bLig.textContent = t("qs_ligar_btn", { n: semRamo });
  }

  box.innerHTML = "";
  if (!lista.length) {
    const p = document.createElement("div");
    p.className = "esq-vazio";
    p.textContent = qsTodas().length ? t("qs_sem_resultado") : t("qs_vazio");
    box.append(p);
    return;
  }
  lista.slice(0, 200).forEach((q) => {
    const li = document.createElement("div");
    li.className = "qs-item";
    const cab = document.createElement("div");
    /* TRÊS CAMADAS, NÃO UM BLOCO.
     * Tudo em uma linha de texto miúdo fazia a lista parecer um muro:
     * tipo, banca, disciplina, tópico e concurso disputando com o
     * enunciado, que é a única coisa que se lê para decidir. Agora:
     * etiquetas pequenas em cima, enunciado em corpo maior no meio, e
     * o histórico discreto embaixo. */
    cab.className = "qs-item-cab";
    const etiquetas = [
      { txt: t("qs_tipo_" + q.tipo), cls: "qs-tag qs-tag-tipo" },
      q.banca ? { txt: q.banca, cls: "qs-tag qs-tag-banca" } : null,
      { txt: q.disciplina || "—", cls: "qs-tag" },
      q.ramo ? { txt: t("qs_ramo_tag", { r: q.ramoNome || q.ramo }), cls: "qs-tag qs-tag-ramo" } : null,
    ].filter(Boolean);
    etiquetas.forEach((e) => {
      const sp = document.createElement("span");
      sp.className = e.cls;
      sp.textContent = e.txt;
      cab.append(sp);
    });
    /* tópico e concurso na dica, não na tela: são o contexto de quem já
     * sabe onde está, e ocupavam a mesma linha do que se precisa ler */
    cab.title = (q.topico || "—") + (q.concurso ? " · " + q.concurso : "");

    const en = document.createElement("div");
    en.className = "qs-item-en";
    en.textContent = q.enunciado.slice(0, 240);
    li.append(cab, en);

    const ts = q.tentativas || [];
    if (ts.length) {
      const hs = document.createElement("div");
      hs.className = "qs-item-hist";
      const certas = ts.filter((x) => x.acertou).length;
      hs.textContent = t("qs_hist", { n: ts.length, c: certas })
        + " · " + (ts[ts.length - 1].acertou ? t("qs_ultima_ok") : t("qs_ultima_nao"));
      hs.className += ts[ts.length - 1].acertou ? " ok" : " nao";
      /* o histórico vai para DEPOIS das ações, na base do card: é
       * informação de apoio, não o que se lê primeiro */
      li._hist = hs;
    }

    const ac = document.createElement("div");
    ac.className = "qs-item-acoes";
    const bResp = document.createElement("button");
    bResp.type = "button"; bResp.className = "btn-min btn-min-ok";
    bResp.textContent = t("qs_responder_esta");
    bResp.onclick = () => qsUiResponderAbrir([q], "aba", "uma:" + q.id);
    /* APAGAR SAI DA LINHA DE FRENTE.
     * Em vermelho forte ao lado de "responder", ele atraía mais o olho
     * do que a ação principal — e o alvo errado num toque de celular é
     * uma questão perdida com o histórico dela junto. Vai para um "⋮":
     * continua a um toque de distância de quem o procura, e a nenhum
     * de quem não procura. */
    const bMais = document.createElement("button");
    bMais.type = "button"; bMais.className = "btn-min qs-item-mais";
    bMais.textContent = "⋮";
    bMais.title = t("qs_mais_ajuda");
    bMais.onclick = () => {
      const menu = li.querySelector(".qs-item-menu");
      if (menu) { menu.hidden = !menu.hidden; return; }
      const cx2 = document.createElement("div");
      cx2.className = "qs-item-menu";
      const bDel = document.createElement("button");
      bDel.type = "button"; bDel.className = "btn-min btn-perigo";
      bDel.textContent = t("qs_apagar");
      bDel.title = t("qs_apagar_ajuda");
      bDel.onclick = async () => {
        const aviso = typeof lixAvisoRisco === "function" ? lixAvisoRisco("questao", { q }) : "";
        if (!(await uiConfirm(t("qs_apagar_conf", { e: q.enunciado.slice(0, 90) }) + aviso))) {
          try { lixRecusou("questao", [q.disciplina, q.topico].filter(Boolean).join(" · "), q.enunciado.slice(0, 90), { q }); } catch (e) {}
          return;
        }
        qsApagar(q.id);
        qsUiPintarBotaoResumo();
        qsUiRender();
      };
      /* Q2b — o RAMO desta questão (quando o tópico tem ramos): trocar liga na hora; "tópico inteiro" desliga */
      const ramosQ = qsUiRamosDoTopico(q.chave, memoRamos);
      if (ramosQ.length) {
        const lb = document.createElement("label");
        lb.className = "qs-item-ramo";
        const sp = document.createElement("span");
        sp.textContent = t("qs_ramo_desta") + " ";
        const sel = document.createElement("select");
        [["", t("qs_ramo_nenhum")]].concat(ramosQ.map((r) => [r.id, r.nome])).forEach(([v, rot]) => {
          const o = document.createElement("option"); o.value = v; o.textContent = rot; sel.append(o);
        });
        sel.value = q.ramo && ramosQ.some((r) => r.id === q.ramo) ? q.ramo : "";
        sel.onchange = () => {
          const r = ramosQ.find((x) => x.id === sel.value);
          qsLigarRamo([q.id], sel.value, r ? r.nome : "");
          qsUiRender();
        };
        lb.append(sp, sel);
        cx2.append(lb);
      }
      cx2.append(bDel);
      li.append(cx2);
    };
    ac.append(bResp, bMais);
    li.append(ac);
    if (li._hist) li.append(li._hist);
    box.append(li);
  });
}

/* =====================================================================
 * Q2b — LIGAR AS QUESTÕES QUE JÁ EXISTEM AOS RAMOS
 *
 * As questões criadas antes dos ramos (ou sem escolher ramo) ficam "do tópico inteiro". Aqui o app lista as que ainda não
 * têm ramo, sugere um pelas palavras (ramSugerirRamoDaQuestao) e a pessoa confere, troca ou deixa sem — e só então liga.
 * Tudo de uma vez, com Desfazer (os recibos de qsLigarRamo).
 * ===================================================================== */
let qsRamosCtx = null;
function qsUiLigarRamosAbrir(chave) {
  const dlg = $("dlgQsRamos");
  if (!dlg || !chave) return null;
  const ramos = qsUiRamosDoTopico(chave);
  const qs = qsFiltrar({ chave, ramo: "_sem" });
  qsRamosCtx = { chave, ramos, recibo: null, linhas: qs.map((q) => {
    const s = typeof ramSugerirRamoDaQuestao === "function" ? ramSugerirRamoDaQuestao(q, ramos) : null;
    return { q, escolha: s ? s.id : "", sugerido: s ? s.id : "" };
  }) };
  $("qsRamosTit").textContent = t("qs_ramos_tit", { tp: (qs[0] && qs[0].topico) || chave });
  $("qsRamosMsg").textContent = "";
  $("btnQsRamosDesfazer").hidden = true;
  qsUiLigarRamosPintar();
  abrirModal("dlgQsRamos");
  return dlg;
}
function qsUiLigarRamosPintar() {
  const bx = $("qsRamosLista");
  bx.innerHTML = "";
  const c = qsRamosCtx;
  if (!c.linhas.length) {
    const p = document.createElement("p"); p.className = "nota"; p.textContent = t("qs_ramos_vazio"); bx.append(p);
  }
  c.linhas.forEach((ln) => {
    const lin = document.createElement("div");
    lin.className = "qs-ramos-lin";
    const en = document.createElement("div");
    en.className = "qs-ramos-en";
    en.textContent = String(ln.q.enunciado || "").slice(0, 180);
    en.title = String(ln.q.enunciado || "");
    const sel = document.createElement("select");
    [["", t("qs_ramo_nenhum")]].concat(c.ramos.map((r) => [r.id, r.nome])).forEach(([v, rot]) => {
      const o = document.createElement("option"); o.value = v; o.textContent = rot; sel.append(o);
    });
    sel.value = ln.escolha;
    const tag = document.createElement("span");
    tag.className = "qs-ramos-sug";
    const pinta = () => { tag.textContent = ln.sugerido && ln.escolha === ln.sugerido ? t("qs_ramos_sugerido") : ""; };
    sel.onchange = () => { ln.escolha = sel.value; pinta(); qsUiLigarRamosBotao(); };
    pinta();
    lin.append(en, sel, tag);
    bx.append(lin);
  });
  qsUiLigarRamosBotao();
}
function qsUiLigarRamosBotao() {
  const n = qsRamosCtx.linhas.filter((l) => l.escolha).length;
  $("btnQsRamosAplicar").textContent = t("qs_ramos_aplicar", { n });
  $("btnQsRamosAplicar").disabled = !n;
}
function qsUiLigarRamosAplicar() {
  const c = qsRamosCtx;
  if (!c) return 0;
  const porRamo = {};
  c.linhas.filter((l) => l.escolha).forEach((l) => { (porRamo[l.escolha] = porRamo[l.escolha] || []).push(l.q.id); });
  let recibo = [];
  Object.keys(porRamo).forEach((id) => {
    const r = c.ramos.find((x) => x.id === id);
    recibo = recibo.concat(qsLigarRamo(porRamo[id], id, r ? r.nome : ""));
  });
  c.recibo = recibo;
  c.linhas = c.linhas.filter((l) => !l.escolha);
  $("qsRamosMsg").textContent = t("qs_ramos_feito", { n: recibo.length });
  $("btnQsRamosDesfazer").hidden = !recibo.length;
  try { reg("QUESTOES", "questões ligadas aos ramos", recibo.length + " · " + c.chave); } catch (e) {}
  qsUiLigarRamosPintar();
  qsUiRender();
  return recibo.length;
}
function qsUiLigarRamosDesfazer() {
  const c = qsRamosCtx;
  if (!c || !c.recibo) return 0;
  const n = qsDesfazerRamo(c.recibo);
  c.recibo = null;
  $("qsRamosMsg").textContent = t("qs_ramos_desfeito");
  $("btnQsRamosDesfazer").hidden = true;
  qsUiLigarRamosAbrir(c.chave);
  $("qsRamosMsg").textContent = t("qs_ramos_desfeito");
  qsUiRender();
  return n;
}

function qsUiLerFiltros() {
  const ramoSel = $("qsFRamo") && !$("qsFRamo").hidden ? $("qsFRamo").value || "" : "";
  qsUiFiltro = {
    ramo: ramoSel,
    edital: ($("qsFEdital") || {}).value || "",
    chave: ($("qsFTopico") || {}).value || "",
    disciplina: ($("qsFDisc") || {}).value || "",
    banca: ($("qsFBanca") || {}).value || "",
    tipo: ($("qsFTipo") || {}).value || "",
    soIneditas: !!($("qsFIneditas") || {}).checked,
    soErradas: !!($("qsFErradas") || {}).checked,
    busca: ($("qsBusca") || {}).value || "",
  };
  qsUiRender();
}

/* ---------------------------------------------------------------------
 * O QUE APARECE DENTRO DO RESUMO
 * ------------------------------------------------------------------- */
/* O MÍNIMO DE TEXTO PARA VALER UMA QUESTÃO.
 *
 * Não é um número mágico: é o tamanho abaixo do qual o trecho é um
 * título ou meia frase, e o prompt vai sem o contexto de que a IA
 * precisa para escrever uma assertiva verdadeira. Generoso de
 * propósito — um parágrafo curto de lei passa. */
const QS_TRECHO_MIN = 120;

function qsUiPintarBotaoResumo() {
  const b = $("btnMatQuestoes");
  if (!b) return;
  if (!matAtual) { b.hidden = true; return; }
  const n = qsContarDoTopico(matAtual.chave);
  b.hidden = false;
  /* =================================================================
   * SEM QUESTÃO, ESTE BOTÃO SOME — não fica morto, e não fica sendo um
   * terceiro caminho para criar.
   *
   * A PRIMEIRA TENTATIVA FOI DESABILITÁ-LO, e um teste antigo (U1c)
   * apontou o erro: com zero questões ele não era um beco, era um
   * atalho — clicá-lo LEVAVA a criar. Desabilitar teria tirado um
   * caminho que funcionava, para consertar uma confusão de rótulo.
   *
   * Só que esse atalho nasceu quando ele era o ÚNICO botão de questões
   * do resumo. Hoje há dois, explícitos e rotulados com o verbo, logo
   * ao lado — e o atalho virou um terceiro caminho para o mesmo lugar,
   * com um rótulo ("sem questões") que não diz que leva a criar. Era
   * exatamente esta a queixa: "não sei informar se existem ou não
   * questões".
   *
   * Some é melhor que morto e melhor que repetido: a fila fica com uma
   * linha só quando não há o que responder, e o que fazer a seguir está
   * escrito nos dois botões que sobraram.
   * ================================================================= */
  b.hidden = !n;
  if (!n) return qsUiPintarCriadores();
  b.textContent = t("qs_do_topico_n", { n });
  b.disabled = false;
  b.title = t("qs_do_topico_ajuda", { n });

  /* O BOTAO TEM DE DIZER DE QUAL TEXTO VAI SAIR A QUESTAO.
   * "virar em questão" sem mais nada nao deixa ver se vai usar o trecho
   * marcado ou o resumo todo — e a pessoa so descobre lendo o prompt
   * gerado. Com o tamanho no rotulo, da para conferir antes. */
  /* DOIS BOTOES, UM POR ORIGEM.
   * Um botao so, que trocava de rotulo conforme houvesse selecao, obrigava
   * a LER o rotulo para saber o que ia acontecer — e "trecho marcado"
   * ainda se confundia com as marcas coloridas da mesma barra. Separados,
   * cada um diz uma coisa so, e o do trecho fica apagado enquanto nao ha
   * trecho: dai se ve, sem ler, que falta selecionar. */
  return qsUiPintarCriadores();
}

/* Os DOIS botões que criam. Separados de qsUiPintarBotaoResumo porque
 * são pintados também quando o de responder some — e um "return" no
 * meio da função anterior os teria deixado de fora justamente no caso
 * em que eles são o único caminho que resta. */
function qsUiPintarCriadores() {
  if (!matAtual) return;
  const sel = qsUiSelecaoViva();
  const bt = $("btnMatQstTrecho");
  if (bt) {
    const nSel = sel ? sel.length : 0;
    /* TRECHO CURTO DEMAIS NÃO VIRA QUESTÃO.
     *
     * O relato veio com "31 caracteres" no rótulo — um título, meia
     * frase. O prompt sai sem contexto nenhum e a IA devolve questões
     * sobre coisa nenhuma, que entram no banco e depois são respondidas
     * como se valessem. O erro não aparece na hora: aparece semanas
     * depois, numa rodada, e aí já não dá para saber de onde veio.
     *
     * O botão passa a dizer o que falta em vez de aceitar e produzir
     * lixo — mesmo raciocínio da caixa de julgado vazia, que desabilita
     * em vez de abrir um alerta. */
    const curto = nSel > 0 && nSel < QS_TRECHO_MIN;
    bt.hidden = false;
    bt.disabled = !sel || curto;
    bt.textContent = curto ? t("qs_qst_trecho_curto", { n: nSel })
      : (sel ? t("qs_qst_trecho_n", { n: nSel }) : t("qs_qst_trecho_sem"));
    bt.title = curto
      ? t("qs_qst_trecho_curto_ajuda", { n: nSel, m: QS_TRECHO_MIN })
      : t(sel ? "qs_qst_trecho_ajuda" : "qs_qst_trecho_sem_ajuda");
    bt.className = "btn-min" + (sel && !curto ? " btn-min-ok" : "");
  }
  const br = $("btnMatQstResumo");
  if (br) {
    br.hidden = false;
    /* o tamanho nos DOIS botoes: e comparando os dois numeros que se ve,
     * sem abrir nada, o que cada caminho vai mandar para a IA */
    const todo = String(matTextoVivo(matAtual.chave, "texto") || "");
    br.textContent = t("qs_qst_resumo", { n: todo.length });
    br.title = t("qs_qst_resumo_ajuda");
  }
}

/* O trecho marcado AGORA, se houver. Lê a seleção viva da caixa antes de
 * olhar a guardada: entre selecionar e clicar não pode haver espaço para
 * o app usar um trecho velho. */
function qsUiSelecaoViva() {
  try { matLembrarSelecao(); } catch (e) {}
  const s = String(typeof matSelGuardada === "string" ? matSelGuardada : "").trim();
  return s || null;
}

/* RESPONDER SEM PASSAR PELO RESUMO.
 * O atalho da agenda abria o resumo em modo de leitura e só então as
 * questões — o mesmo desvio que os cartões tinham. Quem clica em "❓" na
 * agenda quer responder, não ler o texto. Sem questão nenhuma no tópico,
 * o botão não vira beco: leva à criação de sempre, já apontada para
 * este tópico e com o texto do resumo como matéria-prima. */
/* Q2 — o ramo da vez ({ id, nome }): responder abre SÓ as questões dele; criar já as liga a ele. Vale para UMA ida
 * (é zerado depois de usado), para um "responder do tópico" seguinte não herdar o ramo. */
let qsUiRamoAlvo = null;
function qsUiResponderDireto(disciplina, topico, ramo) {
  try { if (typeof matLembrarRecente === "function" && disciplina && topico) matLembrarRecente("questoes", disciplina, topico); } catch (e) {}
  if (typeof mcApontarTopico !== "function") return;
  mcApontarTopico(disciplina, topico);
  qsUiRamoAlvo = ramo && ramo.id ? { id: ramo.id, nome: ramo.nome || "" } : null;
  qsUiResponderDoTopico();
}

function qsUiResponderDoTopico() {
  if (!matAtual) return;
  const ramo = qsUiRamoAlvo;
  const lista = qsFiltrar(ramo ? { chave: matAtual.chave, ramo: ramo.id } : { chave: matAtual.chave });
  /* sem questão neste tópico, o botão não pode ser um beco: leva a criar,
   * que é o que a pessoa faria em seguida de qualquer jeito */
  if (!lista.length) { qsUiVirarSelecao(); return; }
  qsUiRamoAlvo = null;
  qsUiResponderAbrir(lista, "resumo", "topico:" + matAtual.chave + (ramo ? "#" + ramo.id : ""));
}

/* "virar em questão": pega o que está selecionado no resumo — ou o resumo
 * inteiro, se nada estiver selecionado — e leva ao ritual do prompt. */
function qsUiVirarSelecao(origem) {
  if (!matAtual) return;
  matLembrarSelecao();
  const sel = origem === "resumo" ? "" : String(matSelGuardada || "").trim();
  if (origem === "trecho" && !sel) { uiAlert(t("qs_qst_trecho_sem_ajuda")); return; }
  if (origem === "trecho" && sel.length < QS_TRECHO_MIN) {
    uiAlert(t("qs_qst_trecho_curto_ajuda", { n: sel.length, m: QS_TRECHO_MIN }));
    return;
  }
  const texto = sel || matTextoVivo(matAtual.chave, "texto");
  const ramo = qsUiRamoAlvo;
  qsUiRamoAlvo = null;
  qsUiCriarAbrir(texto, Object.assign({
    disciplina: matAtual.disciplina, topico: matAtual.topico,
    chave: matAtual.chave, concurso: qsUiConcursoAtual(),
  }, ramo ? { ramo: ramo.id, ramoNome: ramo.nome } : {}), sel ? "trecho" : "resumo");
}

function qsUiIniciar() {
  qsCarregar();
  /* O TAMANHO GUARDADO É APLICADO NO ARRANQUE, e não ao abrir a sessão:
   * a classe fica no <dialog>, que já existe, e assim a primeira
   * questão da rodada já nasce no tamanho certo — sem o pisca de abrir
   * pequeno e crescer. */
  if ($("btnQsTamanho")) $("btnQsTamanho").onclick = qsTamanhoTrocar;
  qsTamanhoPintar();
  /* os gatilhos do rascunho vivem na barra da questão: quem os liga é
   * esta tela, no arranque, e não a montagem preguiçosa do rascunho */
  try { rsGatilhosIniciar(); } catch (e) {}
  if ($("btnQsConferir")) $("btnQsConferir").onclick = () => qsUiConferir();
  /* colar direto o que a IA devolveu, sem trocar de janela */
  if ($("btnQsColar")) {
    $("btnQsColar").onclick = async () => {
      let lido = "";
      try { lido = await navigator.clipboard.readText(); } catch (e) { lido = ""; }
      if (!String(lido).trim()) { await uiAlert(t("qs_colar_vazio")); return; }
      /* ACRESCENTA, não substitui.
       * Uma tanda de questões raramente vem numa resposta só: pede-se
       * mais, cola-se de novo, e a colagem anterior era apagada — o
       * trabalho da rodada passada sumia sem aviso. Agora cada colagem
       * entra no fim, e a conferência lê tudo junto. */
      const antes = String($("qsCriarResposta").value || "");
      $("qsCriarResposta").value = antes.trim()
        ? antes.replace(/\s*$/, "") + "\n\n" + lido
        : lido;
      matReg("questao", "resposta da IA colada",
             String(lido).length + " caracteres"
             + (antes.trim() ? " · acrescentados a " + antes.length : ""));
      qsUiConferir();
    };
  }
  if ($("btnQsCriarAplicar")) $("btnQsCriarAplicar").onclick = () => qsUiAplicar();
  if ($("btnQsCriarFechar")) $("btnQsCriarFechar").onclick = () => $("dlgQsCriar").close();
  ["qsFonteResumo", "qsFonteOutro", "qsFonteCaderno"].forEach((id) => {
    if ($(id)) $(id).onchange = () => qsUiRefazerPrompt();
  });
  if ($("qsCriarFonte")) $("qsCriarFonte").oninput = () => qsUiRefazerPrompt();
  if ($("btnQsVerPrompt")) {
    $("btnQsVerPrompt").onclick = () => {
      const ta = $("qsCriarPrompt");
      if (!ta) return;
      ta.hidden = !ta.hidden;
      $("btnQsVerPrompt").textContent =
        t(ta.hidden ? "qs_ver_prompt" : "qs_esconder_prompt");
    };
  }
  if ($("btnQsCopiarPrompt")) {
    $("btnQsCopiarPrompt").onclick = () => {
      let copiou = true;
      try { navigator.clipboard.writeText($("qsCriarPrompt").value); }
      catch (e) { copiou = false; }
      const b = $("btnQsCopiarPrompt");
      const r = b.textContent;
      b.textContent = t("copied");
      setTimeout(() => { b.textContent = r; }, 1800);
      /* QUAL PROMPT SAIU importa tanto quanto se saiu: o do caderno e o
       * comum pedem coisas diferentes, e quando a resposta vem torta a
       * primeira pergunta é qual dos dois foi usado. */
      try {
        const f = qsUiFonteAtual();
        gerReg("questoes", "prompt",
          copiou ? "prompt copiado" : "prompt gerado (a área de transferência recusou)",
          $("qsCriarPrompt").value.length + " caracteres · "
          + (f.caderno ? "prompt do caderno" : f.externo ? "material externo" : "deste resumo"),
          { topico: (qsUiCtxCriar || {}).topico || "",
            disciplina: (qsUiCtxCriar || {}).disciplina || "" });
      } catch (e) {}
    };
  }
  /* SAIR DA QUESTAO COM RABISCO NA TELA.
   * Nao salva sozinho (o pedido foi "a pedido do usuario"), mas
   * tambem nao joga fora calado: pergunta uma vez e segue. */
  const sairDaQuestao = (segue) => {
    let perguntar = false;
    try { perguntar = rsPrecisaPerguntar(); } catch (e) { perguntar = false; }
    if (!perguntar) { segue(); return; }
    return rsGuardarSeSair().then(segue, segue);
  };
  if ($("btnQsProxima")) {
    $("btnQsProxima").onclick = () => {
      /* AINDA NÃO RESPONDIDA: este toque É o "responder" — grava a
       * escolha e revela o gabarito NO LUGAR, sem avançar (é a mesma
       * tela mostrando o resultado, como já acontecia ao tocar numa
       * alternativa antes deste pedido). Só troca para "avançar" na
       * PRÓXIMA vez que o botão for tocado, já como "próxima". */
      if (!qsJaRespondida()) {
        if (!qsSelecionada) return;
        const r = qsResponder(qsSelecionada);
        if (!r) return;
        qsRiscadas.clear();
        qsUiPintarSessao();
        return;
      }
      sairDaQuestao(() => { qsAndar(1); qsUiPintarSessao(); });
    };
  }
  if ($("btnQsPular")) {
    $("btnQsPular").onclick = () => sairDaQuestao(() => {
      const q = qsAtual();
      qsPular();
      qsUiPintarSessao();
      matReg("questao", "questão pulada",
             q ? String(q.enunciado).slice(0, 60) : "");
    });
  }
  if ($("btnQsEncerrar")) {
    $("btnQsEncerrar").onclick = () => qsUiEncerrarComPlacar();
  }
  if ($("btnQmFechar")) $("btnQmFechar").onclick = () => $("dlgQsMelhorar").close();
  if ($("btnQmConferir")) {
    $("btnQmConferir").textContent = t("qm_conferir");
    $("btnQmConferir").onclick = () => qsUiMelhorarConferir();
  }
  if ($("btnQmAplicar")) {
    $("btnQmAplicar").textContent = t("qm_aplicar");
    $("btnQmAplicar").onclick = () => qsUiMelhorarAplicar(false);
  }
  if ($("btnQmAplicarTodas")) {
    $("btnQmAplicarTodas").onclick = () => qsUiMelhorarAplicar(true);
  }
  if ($("btnQmCopiar")) {
    $("btnQmCopiar").textContent = t("qm_copiar");
    $("btnQmCopiar").onclick = () => {
      try { navigator.clipboard.writeText($("qmPrompt").value); } catch (e) {}
      const b2 = $("btnQmCopiar");
      const r = b2.textContent;
      b2.textContent = t("copied");
      setTimeout(() => { b2.textContent = r; }, 1800);
    };
  }
  if ($("btnQsSoFalhas")) {
    $("btnQsSoFalhas").onclick = () => {
      qsFerFechar();
      const lig = qsFiltroFalhas(!qsFiltroFalhasLigado());
      qsUiPintarSessao();
      if (lig && !qsAtual() && !qsQuantasFalhas()) uiAlert(t("qs_so_falhas_fim"));
      matReg("questao", "filtro de erradas " + (lig ? "ligado" : "desligado"),
             qsQuantasFalhas() + " interessam");
    };
  }
  if ($("btnQsSessFechar")) {
    $("btnQsSessFechar").onclick = () => sairDaQuestao(() => {
      $("dlgQsResponder").close();
      qsUiRender();
      if (qsUiVoltarPara === "resumo") qsUiPintarBotaoResumo();
    });
  }
  if ($("btnQsX")) $("btnQsX").onclick = () => { const f = $("btnQsSessFechar"); if (f && typeof f.onclick === "function") f.onclick(); };
  if ($("btnQsLerX")) $("btnQsLerX").onclick = () => $("dlgQsLer").close();
  if ($("btnQsLerVoltar")) $("btnQsLerVoltar").onclick = () => $("dlgQsLer").close();
  if ($("btnQsLerMenos")) $("btnQsLerMenos").onclick = () => qsLerFsMudar(-1);
  if ($("btnQsLerMais")) $("btnQsLerMais").onclick = () => qsLerFsMudar(1);
  if ($("btnQsIr")) $("btnQsIr").onclick = () => qsUiIrPara();
  if ($("btnQsRodapeAlternar")) {
    $("btnQsRodapeAlternar").onclick = () => {
      qsRodapeAberto = !qsRodapeAberto;
      qsRodapePintar();
    };
  }
  if ($("btnQsEnunAlternar")) {
    $("btnQsEnunAlternar").onclick = () => {
      qsEnunColapsado = !qsEnunColapsado;
      qsUiPintarSessao();
    };
  }
  if ($("btnQsResponderTudo")) {
    $("btnQsResponderTudo").onclick = () => qsUiResponderAbrir(qsUiListaFiltrada(),
      "aba", "aba:" + JSON.stringify(qsUiFiltro));
  }
  if ($("btnQsHistLimpar")) {
    $("btnQsHistLimpar").onclick = async () => {
      const n = qhTodos().length;
      if (!n) return;
      if (!(await uiConfirm(t("qs_hist_limpar_conf", { n })))) return;
      qhLimpar();
      qsUiHistRender();
    };
  }
  if ($("btnQsLigarRamos")) $("btnQsLigarRamos").onclick = () => qsUiLigarRamosAbrir(qsUiFiltro.chave);
  if ($("btnQsRamosAplicar")) $("btnQsRamosAplicar").onclick = () => qsUiLigarRamosAplicar();
  if ($("btnQsRamosDesfazer")) $("btnQsRamosDesfazer").onclick = () => qsUiLigarRamosDesfazer();
  if ($("btnQsRamosFechar")) $("btnQsRamosFechar").onclick = () => $("dlgQsRamos").close();
  ["qsFEdital", "qsFTopico", "qsFRamo", "qsFDisc", "qsFBanca", "qsFTipo",
   "qsFIneditas", "qsFErradas"].forEach((id) => {
    if ($(id)) $(id).onchange = () => qsUiLerFiltros();
  });
  if ($("qsBusca")) $("qsBusca").oninput = () => qsUiLerFiltros();
  if ($("btnQsDesfazer")) $("btnQsDesfazer").onclick = () => qsUiDesfazer();
  if ($("btnMatQuestoes")) $("btnMatQuestoes").onclick = () => qsUiResponderDoTopico();
  if ($("btnQsCriarDaSessao")) {
    $("btnQsCriarDaSessao").onclick = () => {
      $("dlgQsResponder").close();
      qsUiVirarSelecao();
    };
  }
  if ($("btnMatQstTrecho")) {
    $("btnMatQstTrecho").onclick = () => qsUiVirarSelecao("trecho");
  }
  if ($("btnMatQstResumo")) {
    $("btnMatQstResumo").onclick = () => qsUiVirarSelecao("resumo");
  }

  if ($("btnQsCriarDaAba")) {
    $("btnQsCriarDaAba").onclick = () => {
      uiAlert(t("qs_criar_pela_aba"));
    };
  }
  qsUiRender();
}

/* O BOTÃO "COPIAR A QUESTÃO" DENTRO DA CAIXA DA DICA.
 *
 * Escrever a explicação com suas palavras quase sempre passa por
 * perguntar a alguma IA, e para perguntar é preciso o enunciado. Sem
 * isto o caminho era fechar a caixa — perdendo o que já estava escrito
 * —, copiar na tela de trás e reabrir.
 *
 * VAI SEM A DICA, de propósito: é ela que você está escrevendo agora, e
 * mandar para a IA o rascunho da própria resposta é pedir que ela
 * concorde com você. Gabarito e comentário vão, porque são o que
 * permite à IA explicar em vez de chutar. */
function qsUiCopiarNaDica(q) {
  if (!q || typeof plTextoDaQuestao !== "function") return null;
  return {
    rotulo: t("dic_copiar_q"),
    dica: t("dic_copiar_q_ajuda"),
    faz: () => {
      const txt = plTextoDaQuestao(q, { gabarito: true, dica: false });
      try { navigator.clipboard.writeText(txt); } catch (e) {}
      try {
        matReg("questao", "questão copiada de dentro da caixa da dica",
               String(q.enunciado || "").slice(0, 60));
      } catch (e) {}
      return txt;
    },
  };
}

/* =====================================================================
 * O TAMANHO DA CAIXA DE RESPONDER
 *
 * Enunciado de concurso é texto longo, cheio de vírgula e de negativa,
 * lido com atenção — e a caixa nasceu dimensionada para caber num
 * telefone. Num monitor sobra tela vazia dos dois lados enquanto o
 * texto se espreme em quinze linhas curtas.
 *
 * A CLASSE VAI NO <dialog>, e não na fonte de um elemento: crescer só a
 * letra dentro de uma caixa estreita piora, porque produz ainda mais
 * linhas curtas. Cresce a caixa e o texto juntos.
 *
 * E FICA GUARDADO. Quem precisa de letra maior precisa dela SEMPRE; um
 * ajuste que se perde ao fechar a sessão é um ajuste que se refaz toda
 * vez, e aí não se usa.
 * ===================================================================== */
const QS_TAM_CHAVE = "eac_qs_tamanho";
const QS_TAMS = 3;

function qsTamanhoAtual() {
  let v = 0;
  try { v = parseInt(localStorage.getItem(QS_TAM_CHAVE) || "0", 10); } catch (e) { v = 0; }
  return (v >= 0 && v < QS_TAMS) ? v : 0;
}

function qsTamanhoPor(v) {
  const n = ((v % QS_TAMS) + QS_TAMS) % QS_TAMS;
  try { guardar(QS_TAM_CHAVE, String(n)); } catch (e) {}
  qsTamanhoPintar();
  return n;
}

function qsTamanhoPintar() {
  const n = qsTamanhoAtual();
  const dlg = $("dlgQsResponder");
  if (dlg) {
    /* as três classes são exclusivas: deixar duas ligadas faria a última
     * regra do arquivo ganhar, e o tamanho passaria a depender da ordem
     * do CSS em vez da escolha da pessoa */
    ["qs-t1", "qs-t2"].forEach((c, i) => {
      const liga = (i + 1) === n;
      if (dlg.classList) dlg.classList[liga ? "add" : "remove"](c);
    });
  }
  const b = $("btnQsTamanho");
  if (b) {
    b.textContent = t("qs_tam_" + n);
    b.title = t("qs_tam_ajuda");
  }
}

function qsTamanhoTrocar() {
  const n = qsTamanhoPor(qsTamanhoAtual() + 1);
  try { reg("QUESTOES", "tamanho da caixa trocado", t("qs_tam_" + n)); } catch (e) {}
  return n;
}

/* =====================================================================
 * AS FERRAMENTAS DA QUESTÃO, NUMA LINHA SÓ
 *
 * Antes eram três faixas empilhadas entre o enunciado e as
 * alternativas: a do grifo (sete botões), a de copiar (um botão e duas
 * caixas de marcar) e o histórico. Num telefone isso é meia tela de
 * controle entre o texto que se lê e a resposta que se dá — e ler e
 * responder são as duas únicas coisas que esta tela faz.
 *
 * Agora: as quatro cores, que são o gesto frequente e precisam estar à
 * mão; e o resto atrás de um ⋮.
 * ===================================================================== */
function qsUiFerramentas(q) {
  const barra = document.createElement("div");
  barra.className = "qs-fer";

  GR_CORES.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "qs-cor gr-" + c.id + (grCorAtual() === c.id ? " sel" : "");
    b.title = t("gr_cor_ajuda", { c: t(c.i18n) });
    b.setAttribute("aria-label", b.title);
    b.onclick = () => {
      /* GRIFA O QUE ESTIVER SELECIONADO; sem seleção, só troca a cor
       * para o próximo grifo. Um botão que não faz nada quando não há
       * seleção pareceria quebrado — então ele sempre faz alguma coisa
       * visível. */
      /* A COR PRIMEIRO, o grifo depois. Assim tocar numa cor sem nada
       * selecionado faz o que o botão promete: escolhe a cor do
       * próximo grifo. */
      grEscolherCor(c.id);
      const feito = grDaSelecao();
      qsUiPintarCores(barra);
      if (!feito) vkReagir(b, t("gr_sem_selecao"));
    };
    barra.append(b);
  });

  const limpar = document.createElement("button");
  limpar.type = "button";
  limpar.className = "btn-min qs-fer-limpar";
  limpar.textContent = t("gr_limpar");
  limpar.title = t("gr_limpar_ajuda");
  limpar.onclick = () => { grLimparTela(); vkReagir(limpar, t("gr_limpou")); };
  barra.append(limpar);

  /* o ⋮ com o que não é gesto de leitura */
  const mais = document.createElement("span");
  mais.className = "qs-fer-mais";
  const bm = document.createElement("button");
  bm.type = "button";
  bm.className = "btn-min";
  bm.textContent = "⋮";
  bm.title = t("qs_fer_mais");
  const menu = document.createElement("span");
  menu.className = "qs-fer-menu";
  menu.hidden = true;
  bm.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    qsFerMenu(menu.hidden ? bm : null, menu);
  };
  try { menu.append(plBarraCopiar(q)); } catch (e) {}

  /* O REGISTRO, A PARTIR DAQUI.
   *
   * Ele sempre existiu — [QUESTOES], [MATERIAL-QUESTAO] e agora
   * [GRIFO] —, mas só se chegava nele pelo rodapé do aplicativo, com a
   * sessão de questões fechada. Quem está respondendo e vê algo
   * estranho não vai fechar a sessão para procurar o registro: vai
   * desistir e concluir que o app quebrou.
   *
   * Ele abre já no assunto "Questões" (erros e avisos entram sempre). */
  try {
    const bl = document.createElement("button");
    bl.type = "button";
    bl.className = "btn-min";
    bl.textContent = t("qs_ver_registro");
    bl.title = t("qs_ver_registro_aj");
    bl.onclick = () => {
      qsFerFechar();
      if (typeof abrirDiagnostico === "function") abrirDiagnostico({ assunto: "questoes" });
    };
    menu.append(bl);
  } catch (e) {}
  /* =====================================================================
   * EMBARALHAR / SÓ AS QUE ERREI / MELHORAR ESTA QUESTÃO — o mesmo ⋮,
   * não um segundo do lado dele.
   *
   * O PRIMEIRO DESENHO MOVIA os botões estáticos (btnQsEmbaralhar etc.)
   * para dentro deste menu com .append() — funciona uma vez, e quebra
   * na questão seguinte: #qsSessCorpo é esvaziado a cada repintura
   * (qsUiPintarSessao), e um nó estático que passou a morar AQUI DENTRO
   * é destruído junto, para sempre — $() nunca mais o acha. Só apareceu
   * testando ao vivo no navegador: o simulador de testes guarda cada
   * id num mapa próprio, não numa árvore de verdade, e não nota a
   * diferença entre "escondido" e "destruído".
   *
   * O CONSERTO: construir os três do zero a cada questão, exatamente
   * como "copiar a questão" e "ver registro" acima — nunca há nó
   * emprestado para perder. */
  const faltamEmb = qsPendentes().length;
  if (faltamEmb >= 2) {
    const be = document.createElement("button");
    be.type = "button";
    be.className = "btn-min";
    be.textContent = t("qs_embaralhar", { n: faltamEmb });
    be.title = t("qs_embaralhar_ajuda");
    be.onclick = () => {
      qsFerFechar();
      const n = qsEmbaralharRestantes();
      qsUiPintarSessao();
      matReg("questao", "questões restantes embaralhadas", n + " pendentes");
    };
    menu.append(be);
  }
  /* SÓ AS QUE ERREI AINDA É UM BOTÃO ESTÁTICO — é o único dos três que
   * também precisa aparecer na tela de "rodada terminada", sem questão
   * ativa nenhuma (onde este ⋮ nem é desenhado). Aqui dentro é só uma
   * cópia visual do mesmo estado; o clique aciona o botão de verdade
   * (mesma lógica ligada uma vez só, em qsUiIniciar — nada duplicado). */
  if (qsPlacar().feitas) {
    const ligFalhas = qsFiltroFalhasLigado();
    const bf = document.createElement("button");
    bf.type = "button";
    bf.className = "btn-min" + (ligFalhas ? " qs-filtro-on" : "");
    bf.textContent = t(ligFalhas ? "qs_so_falhas_on" : "qs_so_falhas",
      { n: qsQuantasFalhas() });
    bf.title = t("qs_so_falhas_ajuda");
    bf.onclick = () => {
      const alvo = $("btnQsSoFalhas");
      if (alvo && alvo.onclick) alvo.onclick();
    };
    menu.append(bf);
  }
  const dQ = qsDefeitos(q);
  const bMelhorar = document.createElement("button");
  bMelhorar.type = "button";
  bMelhorar.className = "btn-min" + (dQ.length ? " qm-alerta" : "");
  bMelhorar.textContent = dQ.length ? t("qm_btn_n", { n: dQ.length }) : t("qm_btn");
  bMelhorar.title = t("qm_btn_ajuda");
  bMelhorar.onclick = () => { qsFerFechar(); qsUiMelhorarAbrir(); };
  menu.append(bMelhorar);

  mais.append(bm, menu);
  barra.append(mais);
  return barra;
}

/* =====================================================================
 * O ⋮ TEM DE SAIR DE DENTRO DO RECORTE
 *
 * O DEFEITO. O menu era "position:absolute" pendurado no botão, e o
 * botão mora dentro de #qsSessCorpo — que tem recorte (era
 * "overflow-y:auto", virou "overflow:hidden" quando as duas zonas de
 * rolagem desceram para os filhos). Quem recorta é o ANCESTRAL: um
 * absolute cujo bloco contenedor está dentro da caixa recortada é
 * cortado na borda dela, e não há z-index que resolva isso — z-index
 * decide quem fica na frente, não quem existe fora da moldura.
 *
 * É EXATAMENTE O CASO DO BALÃO DO (?), e a saída é a mesma: sair do
 * subárvore recortada. Lá, pendurando o balão no <dialog>; aqui,
 * trocando para "position:fixed" e calculando a posição a partir do
 * retângulo do botão. Um elemento fixed só é recortado por ancestral
 * com transform, filter ou contain — overflow sozinho não o alcança.
 *
 * TAMBÉM RESOLVE O EMPILHAMENTO DE QUEBRA: as alternativas são
 * "position:sticky", e sticky cria contexto de empilhamento. O menu já
 * ganhava delas por z-index, mas essa vitória dependia de os dois
 * estarem no MESMO contexto — uma condição que qualquer transform novo
 * em algum pai romperia sem aviso.
 *
 * FECHAR: clique fora e Esc. Um menu aberto que só fecha pelo próprio
 * botão vira um retângulo grudado na tela quando a pessoa clica em
 * outro lugar — e, sendo fixed, ele não rola junto com nada.
 * ===================================================================== */
let qsFerAberto = null;      /* {menu, fora, tecla} do único menu aberto */

function qsFerMenu(botao, menu) {
  qsFerFechar();
  if (!botao || !menu) return null;
  menu.hidden = false;
  /* SÓ AQUI ELE VIRA fixed, e não na folha de estilo: escondido, um
   * fixed continua ocupando lugar nenhum, mas passa a ser medido
   * contra a janela mesmo quando ninguém o pediu. */
  if (menu.style) menu.style.position = "fixed";
  qsFerPosicionar(botao, menu);

  const fora = () => qsFerFechar();
  const tecla = (ev) => { if (ev && ev.key === "Escape") qsFerFechar(); };
  qsFerAberto = { menu, fora, tecla };
  try {
    document.addEventListener("click", fora);
    document.addEventListener("keydown", tecla);
  } catch (e) {}
  return menu;
}

function qsFerPosicionar(botao, menu) {
  const r = (botao.getBoundingClientRect && botao.getBoundingClientRect()) || null;
  if (!r || !menu.style) return;
  const larg = 230;                       /* o min-width da folha de estilo */
  const jan = (typeof window !== "undefined" && window.innerWidth) || 360;
  const altoJan = (typeof window !== "undefined" && window.innerHeight) || 640;
  /* ALINHADO À DIREITA DO BOTÃO, como era com "right:0" — e recuado
   * quando isso o jogaria para fora da janela num telefone. */
  const esq = Math.max(8, Math.min(r.right - larg, jan - larg - 8));
  menu.style.left = esq + "px";
  menu.style.right = "auto";

  /* NEM SEMPRE CABE EMBAIXO. O botão que abre este menu costuma estar
   * perto do fim de um comentário comprido — perto do rodapé fixo da
   * questão —, e "sempre abrir para baixo" empurrava as últimas opções
   * ("usar uma lei já guardada", "+ colar uma lei nova") para fora da
   * tela, sem nenhum jeito de rolar até elas. Mede o menu já cheio (o
   * chamador preenche o conteúdo antes de chamar isto) e escolhe o lado
   * com mais espaço; o que sobrar vira teto com rolagem própria — nunca
   * um corte sem aviso nem sem saída. */
  const altoMenu = menu.scrollHeight || menu.offsetHeight || 0;
  const espacoEmbaixo = altoJan - r.bottom - 8;
  const espacoEmCima = r.top - 8;
  if (altoMenu <= espacoEmbaixo || espacoEmbaixo >= espacoEmCima) {
    menu.style.top = (r.bottom + 4) + "px";
    menu.style.bottom = "auto";
    menu.style.maxHeight = Math.max(120, espacoEmbaixo) + "px";
  } else {
    menu.style.top = "auto";
    menu.style.bottom = (altoJan - r.top + 4) + "px";
    menu.style.maxHeight = Math.max(120, espacoEmCima) + "px";
  }
  menu.style.overflowY = "auto";
}

function qsFerFechar() {
  const a = qsFerAberto;
  qsFerAberto = null;
  if (!a) return;
  a.menu.hidden = true;
  try {
    document.removeEventListener("click", a.fora);
    document.removeEventListener("keydown", a.tecla);
  } catch (e) {}
}

function qsUiPintarCores(barra) {
  if (!barra || !barra.querySelectorAll) return;
  GR_CORES.forEach((c) => {
    const b = barra.querySelector(".qs-cor.gr-" + c.id);
    if (b && b.classList) b.classList.toggle("sel", grCorAtual() === c.id);
  });
}
