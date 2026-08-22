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
  matReg("questao", "criação de questões aberta",
         (ctx && ctx.topico ? ctx.topico + " · " : "")
         + qsUiDoTexto.length + " já no texto · " + t0.length + " caracteres");
}


/* De onde a IA parte: deste resumo, ou de um material que você colar.
 * O resumo nem sempre é a melhor fonte — uma aula em PDF, a letra da lei ou
 * um artigo rendem questões que o resumo não tem. O que não muda é o
 * destino: as questões continuam nascendo com a disciplina, o tópico e o
 * concurso deste resumo. */
function qsUiFonteAtual() {
  const outro = $("qsFonteOutro") && $("qsFonteOutro").checked;
  if (!outro) return { texto: qsUiTextoBase, externo: false };
  return { texto: String(($("qsCriarFonte") || {}).value || ""), externo: true };
}

function qsUiRefazerPrompt() {
  const f = qsUiFonteAtual();
  if ($("qsCriarFonte")) $("qsCriarFonte").hidden = !f.externo;
  const pronto = f.texto.trim();
  $("qsCriarPrompt").value = pronto
    ? qsPrompt(pronto, qsUiCtxCriar || {})
    : t("qs_fonte_vazia");
  if ($("btnQsCopiarPrompt")) $("btnQsCopiarPrompt").disabled = !pronto;
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
  matReg("questao", "conferência de questões",
         r.achados.length + " da IA · " + repetidas + " repetidas do texto · "
         + r.ignoradas.length + " recusadas");
}

/* o desenho da conferência é o mesmo vindo da IA ou vindo do texto: o que
 * muda é de onde as questões saíram, não o que precisa ser conferido */
function qsUiPintarConf(achados, ignoradas) {
  const r = { achados: achados || [], ignoradas: ignoradas || [] };
  qsUiAchados = r.achados;
  const box = $("qsCriarConf");
  box.innerHTML = "";
  r.achados.forEach((q, i) => {
    const li = document.createElement("div");
    li.className = "qs-conf";
    const cab = document.createElement("div");
    cab.className = "qs-conf-cab";
    cab.textContent = "[" + (i + 1) + "] " + t("qs_tipo_" + q.tipo)
      + (q.banca ? " · " + q.banca : "") + " · " + t("qs_gab_e", { g: q.gabarito });
    const en = document.createElement("div");
    en.className = "qs-conf-en";
    en.textContent = q.enunciado;
    li.append(cab, en);
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
    box.append(li);
  });
  /* o que foi RECUSADO fica à vista, com o motivo: uma questão que some em
   * silêncio é pior que uma questão errada, porque ninguém vai procurá-la */
  r.ignoradas.forEach((x) => {
    const li = document.createElement("div");
    li.className = "qs-conf qs-conf-ruim";
    li.textContent = t("qs_recusada", { l: x.linha, m: t("qs_motivo_" + x.motivo) || x.motivo })
      + (x.txt ? " — " + x.txt : "");
    box.append(li);
  });
  $("qsCriarResumo").textContent = t("qs_conf_resumo",
    { n: r.achados.length, r: r.ignoradas.length });
  $("btnQsCriarAplicar").disabled = !r.achados.length;
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
  if (!qsUiAchados || !qsUiAchados.length) return;
  qsUiRecibo = qsAplicar(qsUiAchados);
  $("dlgQsCriar").close();
  qsUiMostrarDesfazer(qsUiRecibo);
  qsUiPintarBotaoResumo();
  qsUiRender();
  matReg("questao", "questões gravadas",
         qsUiRecibo.novas + " novas · " + qsUiRecibo.repetidas + " repetidas");
  uiAlert(t("qs_aplicadas", { n: qsUiRecibo.novas, r: qsUiRecibo.repetidas }));
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
function qsUiResponderAbrir(lista, deOnde) {
  if (!lista || !lista.length) { uiAlert(t("qs_nenhuma_para_responder")); return; }
  qsUiVoltarPara = deOnde || null;
  qsSessaoIniciar(lista, { embaralhar: true });
  qsUiPintarSessao();
  abrirModal("dlgQsResponder");
  matReg("questao", "sessão de questões iniciada",
         lista.length + " questões · " + (deOnde || "aba"));
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
    /* fim da fila: o placar vira o assunto */
    const fim = document.createElement("div");
    fim.className = "qs-fim";
    fim.textContent = t("qs_fim", { c: p.certas, n: p.feitas, pct: p.pct });
    corpo.append(fim);
    $("btnQsProxima").hidden = true;
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
    if (minha) {
      const dc = document.createElement("div");
      dc.className = "qs-minha-dica";
      dc.textContent = minha;
      corpo.append(dc);
    }
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
}

/* ---------------------------------------------------------------------
 * A ABA
 * ------------------------------------------------------------------- */
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
    bResp.onclick = () => qsUiResponderAbrir([q], "aba");
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
  const n = (qsContarPorChave()[matAtual.chave] || 0);
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
  qsUiResponderAbrir(lista, "resumo");
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
  if ($("btnQsSessFechar")) {
    $("btnQsSessFechar").onclick = () => {
      $("dlgQsResponder").close();
      qsUiRender();
      if (qsUiVoltarPara === "resumo") qsUiPintarBotaoResumo();
    };
  }
  if ($("btnQsResponderTudo")) {
    $("btnQsResponderTudo").onclick = () => qsUiResponderAbrir(qsFiltrar(qsUiFiltro), "aba");
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
