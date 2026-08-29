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
function qsUiCriarAbrir(texto, ctx) {
  qsUiCtxCriar = ctx || null;
  qsUiAchados = null;
  qsUiDoTexto = [];
  const t0 = String(texto || "").trim();
  if (!t0) { uiAlert(t("qs_criar_sem_texto")); return; }

  /* 1. o que JÁ está escrito, sem IA nenhuma */
  const blocos = qsNoTexto(t0);
  qsUiDoTexto = qsDeBlocos(blocos.filter((b) => b.completa), ctx || {});
  const incompletos = blocos.filter((b) => !b.completa).map((b) => ({
    linha: b.ini + 1, txt: String(b.enunciado || "").slice(0, 70),
    motivo: b.gabarito ? "sem_enunciado" : "sem_gabarito",
  }));

  /* 2. e o prompt, pronto, para quem quiser mais */
  qsUiTextoBase = t0;
  if ($("qsFonteResumo")) $("qsFonteResumo").checked = true;
  if ($("qsFonteOutro")) $("qsFonteOutro").checked = false;
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
        .filter(Boolean).join(" · ") })
    : "";
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

function qsUiConferir() {
  const r = qsLerResposta($("qsCriarResposta").value, qsUiCtxCriar || {});
  /* SOMA às que vieram do texto, em vez de substituir: quem pediu mais à IA
   * não quis abrir mão das que já tinha. Sem duplicar o que a IA devolveu
   * igual ao que já estava escrito. */
  const juntas = qsUiDoTexto.slice();
  let repetidas = 0;
  r.achados.forEach((q) => {
    if (juntas.some((v) => qsNormal(v.enunciado) === qsNormal(q.enunciado))) {
      repetidas++; return;
    }
    juntas.push(q);
  });
  qsUiPintarConf(juntas, r.ignoradas);
  /* REGISTRO PARA MELHORAR O PROMPT.
   * Só o total não ajuda: para saber o que ajustar é preciso saber POR QUE
   * cada uma foi recusada e quantas de cada motivo. É este detalhe que
   * transforma "2 recusadas" em "a IA não fecha o gabarito em CE". */
  const porMotivo = {};
  r.ignoradas.forEach((x) => { porMotivo[x.motivo] = (porMotivo[x.motivo] || 0) + 1; });
  const detalhe = Object.keys(porMotivo).sort()
    .map((k) => k + "×" + porMotivo[k]).join(", ");
  matReg("questao", "conferência de questões",
         r.achados.length + " da IA · " + repetidas + " repetidas do texto · "
         + r.ignoradas.length + " recusadas"
         + (detalhe ? " · motivos: " + detalhe : "")
         + " · formato: " + (/\[QUESTAO\]/i.test($("qsCriarResposta").value)
             ? "campos nomeados" : "linha compacta"));
  /* O MESMO no registro da geração — e ali com os motivos linha a linha,
   * não só a contagem por motivo. "gabarito_fora_das_opcoes×2" diz o que
   * ajustar no prompt; a linha e o enunciado dizem QUAL questão. */
  try {
    gerReg("questoes", "leitura", "resposta da IA conferida",
      r.achados.length + " lida(s) · " + repetidas + " repetida(s) do texto · "
      + r.ignoradas.length + " recusada(s)"
      + " · formato: " + (/\[QUESTAO\]/i.test($("qsCriarResposta").value)
          ? "campos nomeados" : "linha compacta"),
      { topico: (qsUiCtxCriar || {}).topico || "",
        disciplina: (qsUiCtxCriar || {}).disciplina || "",
        motivos: r.ignoradas,
        numeros: { lidas: r.achados.length, repetidas,
                   recusadas: r.ignoradas.length } });
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
    const r = await uiEscolha(t("qs_retomar_perg", {
      f: retomavel.feitas, n: retomavel.total,
      c: retomavel.certas,
      pct: retomavel.feitas ? Math.round((retomavel.certas / retomavel.feitas) * 100) : 0,
    }), [
      { valor: "continuar", rot: t("qs_retomar_sim"), classe: "btn-verde" },
      { valor: "recomecar", rot: t("qs_retomar_nao"), classe: "btn-azul" },
      { valor: "sair", rot: t("cancel_btn") },
    ]);
    if (r === "sair" || r === null) return;
    if (r === "continuar") retomou = !!qsSessaoRetomar(esc);
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

function qsUiPintarSessao() {
  const q = qsAtual();
  const p = qsPlacar();
  $("qsSessPlacar").textContent = t("qs_placar",
    { i: Math.min(p.feitas + (q ? 1 : 0), p.total), n: p.total,
      c: p.certas, pct: p.pct });

  const corpo = $("qsSessCorpo");
  corpo.innerHTML = "";
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
            t("qs_dica_tit", { e: x.q.enunciado.slice(0, 90) }), minha);
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
    /* rodada encerrada: a sessão guardada deixa de valer, senão a próxima
     * abertura ofereceria "continuar" uma coisa que já acabou */
    if (!qsPendentes().length) { try { qsSessaoApagar(); } catch (e) {} }
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
    if ($("btnQsEmbaralhar")) $("btnQsEmbaralhar").hidden = true;
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
  en.className = "qs-enunciado";
  en.textContent = q.enunciado;
  corpo.append(de);
  /* A PELÍCULA ENVOLVE SÓ O ENUNCIADO.
   * Uma camada por cima das alternativas engoliria os cliques delas — e
   * responder é o gesto mais importante desta tela. Ela nasce desligada
   * e, desligada, não intercepta nada: o texto continua selecionável,
   * que é o que o botão de copiar logo abaixo depende. */
  try {
    const env = plEnvolver(en, q.id);
    corpo.append(env || en);
    corpo.append(plBarra());
    corpo.append(plBarraCopiar(q));
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
  const opcoes = q.tipo === "ce"
    ? [{ letra: "C", txt: t("qs_certo") }, { letra: "E", txt: t("qs_errado") }]
    : q.opcoes;

  const cx = document.createElement("div");
  cx.className = "qs-opcoes";
  opcoes.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "qs-op";
    if (jaFoi) {
      /* depois de responder, as cores contam a história: verde no gabarito,
       * vermelho só no que a pessoa escolheu e estava errado */
      if (o.letra === q.gabarito) b.className += " qs-op-certa";
      else if (o.letra === jaFoi.resp) b.className += " qs-op-errada";
      b.disabled = true;
    }
    b.textContent = o.letra + ") " + o.txt;
    b.onclick = () => {
      const r = qsResponder(o.letra);
      if (!r) return;
      qsUiPintarSessao();
    };
    cx.append(b);
  });
  corpo.append(cx);

  if (jaFoi) {
    const gb = document.createElement("div");
    gb.className = "qs-gab " + (jaFoi.acertou ? "qs-gab-ok" : "qs-gab-nao");
    gb.textContent = (jaFoi.acertou ? t("qs_acertou") : t("qs_errou"))
      + " · " + t("qs_gab_e", { g: q.gabarito });
    corpo.append(gb);
    if (q.comentario) {
      corpo.append(qsUiDobra("qs_coment_tit", (el) => {
        el.className = "qs-coment";
        el.textContent = q.comentario;
      }));
    }
    /* A SUA DICA, depois de responder — nunca antes: dica antes da escolha
     * é gabarito disfarçado. */
    const minha = qsDicaDeQuestao(q.id);
    if (minha) {
      corpo.append(qsUiDobra("qs_dica_dobra", (el) => {
        el.className = "qs-minha-dica";
        try { el.innerHTML = matParaHtml(String(minha)); }
        catch (e) { el.textContent = String(minha); }
      }));
    }
    const bc = document.createElement("button");
    bc.type = "button";
    bc.className = "btn-min qs-bt-dica";
    bc.textContent = t("qs_cartao_btn");
    bc.title = t("qs_cartao_ajuda");
    bc.onclick = () => qsUiCartoesDaQuestao(q);
    corpo.append(bc);

    const bd = document.createElement("button");
    bd.type = "button";
    bd.className = "btn-min qs-bt-dica";
    bd.textContent = t(minha ? "qs_dica_editar" : "qs_dica_incluir");
    bd.title = t("qs_dica_ajuda");
    bd.onclick = async () => {
      const txt = await uiTexto(t("qs_dica_tit", { e: q.enunciado.slice(0, 90) }), minha);
      if (txt === null) return;
      qsGravarDica(q.id, txt);
      matReg("questao", txt.trim() ? "dica da questão guardada" : "dica da questão apagada",
             q.enunciado.slice(0, 60));
      qsUiPintarSessao();
    };
    corpo.append(bd);
  }
  $("btnQsProxima").hidden = false;
  $("btnQsProxima").disabled = !jaFoi;
  $("btnQsProxima").textContent = t("qs_proxima");
  /* PULAR não é errar: a questão fica pendente e volta depois.
   * EMBARALHAR mexe só no que falta — reordenar o que já passou mudaria
   * o histórico da rodada. */
  if ($("btnQsPular")) {
    $("btnQsPular").hidden = !!jaFoi;
    $("btnQsPular").title = t("qs_pular_ajuda");
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
  if ($("btnQsMelhorar")) {
    const bm = $("btnQsMelhorar");
    const qAtual = qsAtual();
    bm.hidden = !qAtual;
    if (qAtual) {
      const d = qsDefeitos(qAtual);
      bm.textContent = d.length ? t("qm_btn_n", { n: d.length }) : t("qm_btn");
      bm.title = t("qm_btn_ajuda");
      /* questão com defeito detectado se anuncia: a pessoa não precisa
       * desconfiar do texto sozinha */
      bm.className = "btn-min" + (d.length ? " qm-alerta" : "");
    }
  }
  if ($("btnQsSoFalhas")) {
    const b = $("btnQsSoFalhas");
    const lig = qsFiltroFalhasLigado();
    const nf = qsQuantasFalhas();
    b.hidden = !qsPlacar().feitas;
    b.textContent = t(lig ? "qs_so_falhas_on" : "qs_so_falhas", { n: nf });
    b.title = t("qs_so_falhas_ajuda");
    b.className = "btn-min" + (lig ? " qs-filtro-on" : "");
  }
  if ($("btnQsEmbaralhar")) {
    const faltam = qsPendentes().length;
    $("btnQsEmbaralhar").hidden = faltam < 2;
    $("btnQsEmbaralhar").textContent = t("qs_embaralhar", { n: faltam });
    $("btnQsEmbaralhar").title = t("qs_embaralhar_ajuda");
  }
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
     * estudo emperra. Por isso tem estado próprio, em cor de atenção. */
    const aberto = !h.fim && h.feitas < h.total;
    li.className = "qs-hist-item" + (aberto ? " qs-hist-aberto" : "");

    const rot = document.createElement("span");
    rot.className = "qs-hist-rot";
    rot.textContent = h.rotulo || t("qs_hist_linha_zero", { tot: h.total });

    const num = document.createElement("span");
    num.className = "qs-hist-num";
    num.textContent = (h.feitas
      ? t("qs_hist_linha", { f: h.feitas, tot: h.total,
          pct: h.pct === null ? "—" : h.pct + "%" })
      : t("qs_hist_linha_zero", { tot: h.total }))
      + (aberto ? " · " + t("qs_hist_aberto") : "");

    const quando = document.createElement("span");
    quando.className = "qs-hist-num";
    quando.textContent = t("qs_hist_quando", {
      d: String(h.q || "").slice(0, 10), min: h.minutos || 0 })
      + " · " + t("qs_hist_origem_" + (h.origem || "aba"));

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

    li.append(rot, num, quando, bRe, bDel);
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
        if (!(await uiConfirm(t("qs_apagar_conf", { e: q.enunciado.slice(0, 90) })))) return;
        qsApagar(q.id);
        qsUiPintarBotaoResumo();
        qsUiRender();
      };
      cx2.append(bDel);
      li.append(cx2);
    };
    ac.append(bResp, bMais);
    li.append(ac);
    if (li._hist) li.append(li._hist);
    box.append(li);
  });
}

function qsUiLerFiltros() {
  qsUiFiltro = {
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
function qsUiPintarBotaoResumo() {
  const b = $("btnMatQuestoes");
  if (!b) return;
  if (!matAtual) { b.hidden = true; return; }
  const n = qsContarDoTopico(matAtual.chave);
  b.hidden = false;
  b.textContent = n ? t("qs_do_topico_n", { n }) : t("qs_do_topico_zero");
  b.disabled = false;
  b.title = n ? t("qs_do_topico_ajuda", { n }) : t("qs_do_topico_zero_ajuda");

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
  const sel = qsUiSelecaoViva();
  const bt = $("btnMatQstTrecho");
  if (bt) {
    bt.hidden = false;
    bt.disabled = !sel;
    bt.textContent = sel ? t("qs_qst_trecho_n", { n: sel.length })
                         : t("qs_qst_trecho_sem");
    bt.title = t(sel ? "qs_qst_trecho_ajuda" : "qs_qst_trecho_sem_ajuda");
    bt.className = "btn-min" + (sel ? " btn-min-ok" : "");
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
function qsUiResponderDireto(disciplina, topico) {
  if (typeof mcApontarTopico !== "function") return;
  mcApontarTopico(disciplina, topico);
  qsUiResponderDoTopico();
}

function qsUiResponderDoTopico() {
  if (!matAtual) return;
  const lista = qsFiltrar({ chave: matAtual.chave });
  /* sem questão neste tópico, o botão não pode ser um beco: leva a criar,
   * que é o que a pessoa faria em seguida de qualquer jeito */
  if (!lista.length) { qsUiVirarSelecao(); return; }
  qsUiResponderAbrir(lista, "resumo", "topico:" + matAtual.chave);
}

/* "virar em questão": pega o que está selecionado no resumo — ou o resumo
 * inteiro, se nada estiver selecionado — e leva ao ritual do prompt. */
function qsUiVirarSelecao(origem) {
  if (!matAtual) return;
  matLembrarSelecao();
  const sel = origem === "resumo" ? "" : String(matSelGuardada || "").trim();
  if (origem === "trecho" && !sel) { uiAlert(t("qs_qst_trecho_sem_ajuda")); return; }
  const texto = sel || matTextoVivo(matAtual.chave, "texto");
  qsUiCriarAbrir(texto, {
    disciplina: matAtual.disciplina, topico: matAtual.topico,
    chave: matAtual.chave, concurso: qsUiConcursoAtual(),
  });
}

function qsUiIniciar() {
  qsCarregar();
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
  if ($("btnQsProxima")) $("btnQsProxima").onclick = () =>
    sairDaQuestao(() => { qsAndar(1); qsUiPintarSessao(); });
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
  if ($("btnQsMelhorar")) $("btnQsMelhorar").onclick = () => qsUiMelhorarAbrir();
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
      const lig = qsFiltroFalhas(!qsFiltroFalhasLigado());
      qsUiPintarSessao();
      if (lig && !qsAtual() && !qsQuantasFalhas()) uiAlert(t("qs_so_falhas_fim"));
      matReg("questao", "filtro de erradas " + (lig ? "ligado" : "desligado"),
             qsQuantasFalhas() + " interessam");
    };
  }
  if ($("btnQsEmbaralhar")) {
    $("btnQsEmbaralhar").onclick = () => {
      const n = qsEmbaralharRestantes();
      qsUiPintarSessao();
      matReg("questao", "questões restantes embaralhadas", n + " pendentes");
    };
  }
  if ($("btnQsSessFechar")) {
    $("btnQsSessFechar").onclick = () => sairDaQuestao(() => {
      $("dlgQsResponder").close();
      qsUiRender();
      if (qsUiVoltarPara === "resumo") qsUiPintarBotaoResumo();
    });
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
  ["qsFEdital", "qsFTopico", "qsFDisc", "qsFBanca", "qsFTipo",
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
