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
  return { texto: outro ? "" : qsUiTextoBase, externo: !!outro };
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
  $("qsCriarPrompt").value = f.externo
    ? qsPrompt(t("qs_marca_material"), qsUiCtxCriar || {})
    : qsPrompt(qsUiTextoBase, qsUiCtxCriar || {});
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
  if (!retomou) qsSessaoIniciar(lista, { embaralhar: true, escopo: esc });
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
    fim.textContent = t("qs_fim", { c: p.certas, n: p.feitas, pct: p.pct });
    corpo.append(fim);

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
    return;
  }
  const de = document.createElement("div");
  de.className = "qs-de";
  de.textContent = [q.concurso, q.banca, q.disciplina, q.topico]
    .filter(Boolean).join(" · ");
  const en = document.createElement("div");
  en.className = "qs-enunciado";
  en.textContent = q.enunciado;
  corpo.append(de, en);

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
      const cm = document.createElement("div");
      cm.className = "qs-coment";
      cm.textContent = q.comentario;
      corpo.append(cm);
    }
    /* A SUA DICA, depois de responder — nunca antes: dica antes da escolha
     * é gabarito disfarçado. */
    const minha = qsDicaDeQuestao(q.id);
    if (minha) corpo.append(qsUiCaixaDica(minha));
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
  abrirRegistro({
    nome: modelo.topico, disciplina: modelo.disciplina,
    chave: modelo.chave, minutos: min, feito: false,
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

function qsUiRender() {
  const box = $("qsLista");
  if (!box) return;
  qsUiOpcoesDe("qsFDisc", qsDisciplinas(), t("qs_todas_disc"), qsUiFiltro.disciplina);
  qsUiOpcoesDe("qsFBanca", qsBancas(), t("qs_todas_bancas"), qsUiFiltro.banca);

  const lista = qsFiltrar(qsUiFiltro);
  const d = qsDesempenho(lista);
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
    cab.className = "qs-item-cab";
    cab.textContent = t("qs_tipo_" + q.tipo)
      + (q.banca ? " · " + q.banca : "")
      + " · " + (q.disciplina || "—") + " › " + (q.topico || "—")
      + (q.concurso ? " · " + q.concurso : "");
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
      li.append(hs);
    }

    const ac = document.createElement("div");
    ac.className = "qs-item-acoes";
    const bResp = document.createElement("button");
    bResp.type = "button"; bResp.className = "btn-min btn-min-ok";
    bResp.textContent = t("qs_responder_esta");
    bResp.onclick = () => qsUiResponderAbrir([q], "aba", "uma:" + q.id);
    const bDel = document.createElement("button");
    bDel.type = "button"; bDel.className = "btn-min btn-min-perigo";
    bDel.textContent = t("qs_apagar");
    bDel.title = t("qs_apagar_ajuda");
    bDel.onclick = async () => {
      if (!(await uiConfirm(t("qs_apagar_conf", { e: q.enunciado.slice(0, 90) })))) return;
      qsApagar(q.id);
      qsUiPintarBotaoResumo();
      qsUiRender();
    };
    ac.append(bResp, bDel);
    li.append(ac);
    box.append(li);
  });
}

function qsUiLerFiltros() {
  qsUiFiltro = {
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
function qsUiVirarSelecao() {
  if (!matAtual) return;
  matLembrarSelecao();
  const sel = String(matSelGuardada || "").trim();
  const texto = sel || matTextoVivo(matAtual.chave, "texto");
  qsUiCriarAbrir(texto, {
    disciplina: matAtual.disciplina, topico: matAtual.topico,
    chave: matAtual.chave, concurso: qsUiConcursoAtual(),
  });
}

function qsUiIniciar() {
  qsCarregar();
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
  ["qsFonteResumo", "qsFonteOutro"].forEach((id) => {
    if ($(id)) $(id).onchange = () => qsUiRefazerPrompt();
  });
  if ($("qsCriarFonte")) $("qsCriarFonte").oninput = () => qsUiRefazerPrompt();
  if ($("btnQsCopiarPrompt")) {
    $("btnQsCopiarPrompt").onclick = () => {
      try { navigator.clipboard.writeText($("qsCriarPrompt").value); } catch (e) {}
      const b = $("btnQsCopiarPrompt");
      const r = b.textContent;
      b.textContent = t("copied");
      setTimeout(() => { b.textContent = r; }, 1800);
    };
  }
  if ($("btnQsProxima")) $("btnQsProxima").onclick = () => { qsAndar(1); qsUiPintarSessao(); };
  if ($("btnQsPular")) {
    $("btnQsPular").onclick = () => {
      const q = qsAtual();
      qsPular();
      qsUiPintarSessao();
      matReg("questao", "questão pulada",
             q ? String(q.enunciado).slice(0, 60) : "");
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
    $("btnQsSessFechar").onclick = () => {
      $("dlgQsResponder").close();
      qsUiRender();
      if (qsUiVoltarPara === "resumo") qsUiPintarBotaoResumo();
    };
  }
  if ($("btnQsResponderTudo")) {
    $("btnQsResponderTudo").onclick = () => qsUiResponderAbrir(qsFiltrar(qsUiFiltro),
      "aba", "aba:" + JSON.stringify(qsUiFiltro));
  }
  ["qsFDisc", "qsFBanca", "qsFTipo", "qsFIneditas", "qsFErradas"].forEach((id) => {
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
  if ($("btnMatVirarQuestao")) $("btnMatVirarQuestao").onclick = () => qsUiVirarSelecao();

  if ($("btnQsCriarDaAba")) {
    $("btnQsCriarDaAba").onclick = () => {
      uiAlert(t("qs_criar_pela_aba"));
    };
  }
  qsUiRender();
}
