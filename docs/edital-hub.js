/* =====================================================================
 * HUB DOS EDITAIS + AGENDA DE TOPO
 *
 * Duas telas que não existiam enquanto havia um edital só:
 *
 *  - o HUB, que é onde o modo abre: a lista dos concursos cadastrados,
 *    separada pelo que muda a decisão — prova marcada e perto, prova sem
 *    data, e o que já passou;
 *  - a AGENDA DE TOPO, acima de tudo, porque a semana é uma só mesmo
 *    quando os editais são três.
 * ===================================================================== */

let hubFiltro = "";

/* ------------------------------------------------------------------
 * AGENDA DA SEMANA — atravessa editais
 *
 * Comparar peso entre concursos diferentes, cru, não funciona: peso 5 num
 * edital sem data não vale o mesmo que peso 4 numa prova em três semanas.
 * edUrgencia() multiplica o peso pela proximidade da prova, e é isso que
 * ordena a semana. O nome do concurso vai em cada linha — sem ele a lista
 * vira um amontoado em que a pessoa não sabe para que está estudando.
 * ------------------------------------------------------------------ */
const HUB_AGENDA_CURTA = 6;
let hubAgendaAberta = false;

/* Minutos registrados na semana em curso, de TODOS os editais. Vem do
 * diário — que é o que aconteceu — e não do progresso marcado, que só diz
 * "estudei", nunca "quanto tempo". A semana começa no domingo, como a
 * agenda. */
/* o que a agenda da semana pôs em cada dia e a meta (soma do que ela pede), para quem mais precisar (o diário) */
let hubUltimaAgenda = null;

/* A SEMANA DE ESTUDO de hoje: dias, previsto e feito de cada um, e quanto falta — pelos mesmos dias e a mesma meta da
 * agenda. Sem agenda desenhada ainda, tenta desenhá-la; sem meta nenhuma, devolve só o feito. */
function hubSemanaDeEstudo(hoje) {
  if (!hubUltimaAgenda && typeof hubPintarAgenda === "function") { try { hubPintarAgenda(); } catch (e) {} }
  const a = hubUltimaAgenda || { previsto: {}, metaMin: 0, dias: hubPref("dias", 5) };
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  return edSemanaDeEstudo(hoje || (typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10)),
    hubPref("dias", a.dias), diario, a.previsto, a.metaMin);
}

function minutosDaSemana() {
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  /* A SEMANA É A DA AGENDA: segunda a domingo. Contar a partir do domingo fazia o estudo de domingo cair na semana
   * nova só aqui, enquanto a agenda (e o resto do app) o põem na anterior. "Desmarcou" não é estudo. */
  const sem = edSemanaCalendario(typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10));
  return diario.reduce((a, x) => {
    if (!x || !x.d || x.d === "?" || x.a === "pendente" || x.d < sem.ini || x.d > sem.fim) return a;
    return a + (Number(x.m) || 0);
  }, 0);
}

/* A VIRADA DE PÁGINA — o que aparece no lugar da agenda quando a última
 * prova já passou.
 *
 * Três coisas, nesta ordem, porque é a ordem em que elas perdem valor:
 *
 * 1. QUE A PROVA PASSOU. É a explicação que faltava.
 * 2. MARCAR O QUE CAIU. Enquanto está fresco. Esta informação é a mais
 *    cara que o app pode guardar — é a única amostra real do que a banca
 *    cobra — e ela evapora em dias. Por isso vem antes de qualquer
 *    conversa sobre planejar o próximo.
 * 3. O PRÓXIMO EDITAL. Criar ou abrir.
 *
 * O edital encerrado NÃO é apagado nem arquivado sozinho. Ele é a fonte
 * do reaproveitamento no concurso seguinte: o diário dele é o que
 * responde "o que eu já estudei disto?". */
function hubViradaDePagina(encerrados) {
  const cx = document.createElement("div");
  cx.className = "ed-caixa ed-virada";

  const tit = document.createElement("div");
  tit.className = "ed-caixa-tit";
  tit.textContent = t("hub_virada_tit");
  cx.append(tit);

  encerrados.slice(0, 3).forEach((e) => {
    const s = edSituacao(e);
    const l = document.createElement("div");
    l.className = "nota";
    l.textContent = t("hub_virada_qual", {
      n: e.nome, d: s.prova, h: s.desde,
    });
    cx.append(l);
  });

  const dica = document.createElement("p");
  dica.className = "nota ed-virada-dica";
  dica.textContent = t("hub_virada_marcar");
  cx.append(dica);

  const acoes = document.createElement("div");
  acoes.className = "ed-virada-acoes";

  const bProva = document.createElement("button");
  bProva.className = "btn btn-verde";
  bProva.id = "btnViradaMarcar";
  bProva.textContent = t("hub_virada_btn_marcar");
  bProva.title = t("hub_virada_btn_marcar_ajuda");
  bProva.onclick = () => {
    /* abre o edital que acabou de ser prestado: é lá que estão os
     * tópicos para marcar o que caiu */
    if (typeof hubAbrirEdital === "function") hubAbrirEdital(encerrados[0].id);
  };

  const bNovo = document.createElement("button");
  bNovo.className = "btn btn-cinza";
  bNovo.id = "btnViradaNovo";
  bNovo.textContent = t("hub_virada_btn_novo");
  bNovo.title = t("hub_virada_btn_novo_ajuda");
  bNovo.onclick = () => { if (typeof hubNovo === "function") hubNovo(); };

  acoes.append(bProva, bNovo);
  cx.append(acoes);
  try { reg("EDITAL", "virada de página mostrada", encerrados[0].nome); } catch (e) {}
  return cx;
}

/* =====================================================================
 * "ALGO MUDOU" — repintar a agenda quando o material muda
 *
 * O defeito: criar um cartão ou uma questão gravava tudo certo, e a
 * agenda continuava mostrando o indicador apagado. Só aparecia depois de
 * um F5 — e quem não sabe disso conclui que a gravação não funcionou, e
 * refaz. Duas vezes o mesmo trabalho, com o app dizendo que não aconteceu
 * nada.
 *
 * A causa é simples e a correção também: gravar e desenhar eram dois
 * mundos sem ponte. matSalvar e qsSalvar são os gargalos por onde passa
 * toda mudança de material; basta que eles avisem.
 *
 * DUAS PRECAUÇÕES:
 *
 * 1. DEBOUNCE. matSalvar é chamado a cada marca, a cada tecla do editor
 *    em algumas telas. Repintar 232 linhas a cada chamada travaria a
 *    digitação. O aviso se acumula e a repintura acontece uma vez, no
 *    fim da rajada.
 *
 * 2. A MUDANÇA TEM DE SER PERCEBIDA. Um indicador que acende sem
 *    transição, numa lista de dez linhas, acende fora do campo de visão
 *    e é como se não tivesse acendido. A linha que mudou pisca — não
 *    para enfeitar, mas para dizer "foi aqui".
 * ================================================================== */
let hubMudouTimer = null;
let hubMudouChave = "";

function edAvisarMudanca(chave) {
  if (chave) hubMudouChave = String(chave);
  if (hubMudouTimer) return;                 /* já há uma repintura marcada */
  hubMudouTimer = setTimeout(() => {
    hubMudouTimer = null;
    const alvo = hubMudouChave;
    hubMudouChave = "";
    try { hubPintarAgenda(); } catch (e) {}
    /* a tela do edital também mostra os mesmos indicadores */
    try { if (typeof edRender === "function" && $("edPainel")) edRender(); }
    catch (e) {}
    try { if (typeof matRender === "function") matRender(); } catch (e) {}
    if (alvo) hubPiscarLinha(alvo);
  }, 120);
}

/* Acha a linha daquele tópico na agenda e a pisca por um instante. */
function hubPiscarLinha(chave) {
  const box = document.getElementById("edAgendaTopo");
  if (!box || box.hidden) return;
  const linhas = box.querySelectorAll(".ed-item");
  (linhas || []).forEach((li) => {
    if (String(li.dataset && li.dataset.chave) !== String(chave)) return;
    if (!li.classList) return;
    li.classList.add("ed-piscou");
    setTimeout(() => { try { li.classList.remove("ed-piscou"); } catch (e) {} }, 1400);
  });
}

function hubPintarAgenda() {
  const box = document.getElementById("edAgendaTopo");
  if (!box) return;
  box.innerHTML = "";

  let ativos = editais.filter((e) => edSituacao(e).grupo !== "encerrado");

  /* A AGENDA NÃO PODE SUMIR SEM DIZER POR QUÊ.
   *
   * Antes: `if (!ativos.length) { box.hidden = true; return; }`. No dia
   * seguinte à prova, o único edital passava a ser "encerrado", a lista
   * de ativos ficava vazia e o painel inteiro se escondia. Quem abrisse
   * o app na manhã de 31 de agosto encontraria a agenda simplesmente
   * ausente — sem aviso, sem "a prova foi ontem", sem oferta de abrir o
   * próximo. Some a tela e some a explicação junto.
   *
   * O dia seguinte à prova é, além disso, o momento de maior valor do
   * semestre: é quando você ainda lembra o que caiu. Uma tela vazia
   * naquele instante desperdiça exatamente essa janela. */
  if (!ativos.length) {
    const encerrados = editais.filter((e) => edSituacao(e).grupo === "encerrado");
    if (!encerrados.length) { box.hidden = true; return; }
    box.hidden = false;
    box.append(hubViradaDePagina(encerrados));
    return;
  }
  /* o filtro só existe quando há mais de um: com um edital só, oferecer
   * "ver só este" é um botão que não muda nada */
  const todosAtivos = ativos;
  /* o filtro por edital manda em quais entram na conta da semana */
  ativos = ativos.filter((e) => hubEdVisivel(e.id));
  if (!ativos.length) ativos = todosAtivos;   /* nunca some tudo */
  box.hidden = false;

  const cx = document.createElement("div");
  cx.className = "ed-caixa ed-agenda-cx";

  const cab = document.createElement("div");
  cab.className = "ed-agenda-cab";
  const tit = document.createElement("div");
  tit.className = "ed-caixa-tit";
  tit.textContent = t("hub_agenda_tit");
  cab.append(tit, hubControlesAgenda());
  cx.append(cab);
  /* (19.94.0) "quais editais entram nesta agenda" é um ajuste, não uma navegação: os chips ✓ ISS / ✓ SEFAZ moravam no
   * alto da agenda, ao lado de outros três jeitos de escolher edital. Foram para "⚙ Ajustes da agenda"; o seletor do
   * topo da aba é o que escolhe o edital que se olha. */
  const filtroEd = hubFiltroEdital(todosAtivos);
  const edFora = todosAtivos.length - ativos.length;
  hubRitmoAvisar = null;

  /* (19.47.0) O RITMO DE VERDADE. O plano contava as horas do edital (25h/semana) e o diário mostrava ~10h30: a lista
   * do que "cabe até a prova" era otimista e nada dizia isso. Com duas semanas ou mais de registro e o ritmo abaixo de
   * 75% do planejado, a agenda avisa e oferece planejar com o ritmo real (a escolha fica guardada; volta num toque). */
  const ritmo = hubRitmoReal();
  const usarReal = hubRitmoRealLigado() && ritmo.ref > 0;
  /* (19.51.0) a meta escolhida à mão ("outra meta…") vence o ritmo real; os dois saem com "voltar às horas do edital" */
  const meta = hubMetaMin();
  const minUsado = meta || (usarReal ? ritmo.ref : 0);
  hubRitmoCtx = null;
  const equilibrios = [];
  const confs = [];             /* (19.54.0) os editais com conferência pendente (corte, pesos) */
  const discs = [];             /* (19.56.0) os editais com discursiva cadastrada (o treino de escrita da semana) */
  const modosVistos = {};       /* disciplina → {modo, auto, sugerido}, do primeiro edital em que aparece */
  let modoSugerido = "";
  let diasProx = null;          /* dias até a prova mais próxima: o que o automático usa */
  /* pega a fila da semana de cada edital ativo e junta */
  const linhas = [];
  ativos.forEach((e) => {
    const s = edSituacao(e);
    const r = lerEdital(e.texto || "");
    const cfg = r.cfg || {};
    const plano = montarPlano(r, {
      horas: minUsado ? minUsado / 60 : (cfg.horas || 10), prova: s.prova, feitos: e.progresso || {},
      modos: hubModosLer(),
    });
    /* o edital de prova mais próxima é o dos cenários do aviso e do pedido à IA */
    if (s.dias !== null && s.dias !== undefined && (!hubRitmoCtx || s.dias < hubRitmoCtx.s.dias)) hubRitmoCtx = { e, r, s, cfg, plano };
    Object.keys(plano.modos || {}).forEach((d) => { if (!modosVistos[d]) modosVistos[d] = plano.modos[d]; });
    /* com dois editais, o rótulo do automático fala do de prova mais próxima (o modo mais "fechado") */
    if (s.dias !== null && s.dias !== undefined && (diasProx === null || s.dias < diasProx)) diasProx = s.dias;
    const rk = (m) => ["avancar", "equilibrado", "consolidar"].indexOf(m);
    if (!modoSugerido || rk(plano.modoSugerido) > rk(modoSugerido)) modoSugerido = plano.modoSugerido;
    /* (19.76.0) a discursiva em data própria (fase 2) também entra, contada até a data DELA */
    try {
      const dx = typeof dsDiscursivaDe === "function" ? dsDiscursivaDe(e).dc : (cfg.discursiva && cfg.discursiva.pontos > 0 ? cfg.discursiva : null);
      const sd = typeof dsDiasProva === "function" ? dsDiasProva(e) : s;
      if (dx && sd.dias !== null && sd.dias !== undefined && sd.dias >= 0) discs.push({ id: e.id, nome: e.nome || cfg.concurso || "", d: dx, dias: sd.dias, sit: sd, e, plano });
    } catch (err) {}
    try {
      const pend = typeof edConfPendencias === "function" ? edConfPendencias(r, plano, e.id) : [];
      if (pend.length) confs.push({ id: e.id, nome: e.nome || cfg.concurso || "", pend });
    } catch (err) {}
    if (plano.recente && plano.recente.total >= ED_RECENTE_MIN) equilibrios.push({ nome: e.nome || cfg.concurso || "", eq: plano.equilibrio || [] });
    /* (19.52.0) o aviso usa o ritmo de REFERÊNCIA: com tendência clara (subindo ou caindo), o das 2 últimas semanas — a média
     * de 4 escondia que 0h35 → 2h15 → 11h35 → 16h11 já é outro ritmo */
    if (!minUsado && ritmo.semanas >= 2 && ritmo.ref > 0 && (cfg.horas || 10) * 60 * 0.75 > ritmo.ref && !hubRitmoRecusado(ritmo.ref)) hubRitmoAvisar = { real: ritmo.ref, plano: (cfg.horas || 10) * 60 };
    const sem = semanaAtual(plano) || [];
    const u = edUrgencia(s);
    sem.forEach((i) => {
      linhas.push(Object.assign({}, i, {
        edital: e.id, editalNome: e.nome || cfg.concurso || t("ed_sem_nome"),
        urgencia: u, ordem: (i.bruto || 0) * u,
        /* de qual FASE é esta linha, e se o tópico volta na seguinte */
        faseN: plano.fase ? plano.fase.n : 1,
        faseNome: plano.fase ? plano.fase.nome : "",
        temFase2: !!(plano.fase && plano.fase.temFase2),
      }));
    });
  });

  if (!linhas.length) {
    const p = document.createElement("div");
    p.className = "ed-caixa-sub";
    p.textContent = t("hub_agenda_vazia");
    cx.append(p); box.append(cx); return;
  }

  /* A ORDEM DA AGENDA É A ORDEM DO PLANO.
   *
   * Aqui havia um segundo criterio: ordenar por "bruto x urgencia". Ele
   * parecia so uma reordenacao razoavel — mais pesado primeiro —, e era
   * o desfazimento completo do rodizio que montarPlano acabara de fazer.
   *
   * O rodizio existe porque ordenar por peso AGRUPA POR DISCIPLINA: a
   * disciplina de peso 5 tem todos os seus topicos de peso 5 no topo, e
   * a semana inteira sai concentrada nela. Num edital com Direito
   * Financeiro pesado, as oito primeiras linhas da agenda eram cinco de
   * Financeiro e tres de Controle Externo — nenhuma de Portugues, de
   * Contabilidade ou de Administrativo. Quem estuda de cima para baixo
   * passava a semana numa disciplina so.
   *
   * O plano ja resolvia isso e a tela desfazia. Agora a posicao no
   * rodizio manda, e a urgencia entra DIVIDINDO essa posicao: um edital
   * com prova em 20 dias (urgencia 2) aparece com o dobro da densidade
   * de um com prova em um ano, sem que nenhum dos dois deixe de
   * intercalar as proprias disciplinas. */
  /* (v19.28.0) o tópico EM ANDAMENTO (começado e não registrado) vem antes até das revisões: terminar o que começou */
  linhas.sort(hubOrdemAgenda);

  /* TIRADOS DA AGENDA: adiados com prazo em aberto e dispensados.
   * Some daqui, não do plano: o que sai por tempo volta sozinho quando o
   * prazo vence, e o que saiu de vez continua listado na sua gaveta. */
  const antesDeTirar = linhas.length;
  const listaCheia = linhas.slice();
  const visiveis = linhas.filter((i) => !edEstaFora(i.chave));
  const tirados = antesDeTirar - visiveis.length;
  linhas.length = 0;
  visiveis.forEach((i) => linhas.push(i));
  /* (19.87.0) um assunto ligado entre dois editais é UMA linha só */
  const fundidos = hubFundirVinculados(linhas);

  /* FILTRO DE DISCIPLINA — em cima das linhas que sobraram.
   * A ordem de prioridade não muda: filtrar é esconder, não reordenar.
   * As opções saem das disciplinas que REALMENTE estão na agenda desta
   * semana; oferecer as 17 do edital, com 4 na tela, seria oferecer 13
   * botões que não fazem nada. */
  const disciplinas = [];
  linhas.forEach((i) => {
    if (i.disciplina && disciplinas.indexOf(i.disciplina) < 0) disciplinas.push(i.disciplina);
  });
  const filtroDisc = hubFiltroDisciplina(disciplinas);
  if (filtroDisc) cx.append(filtroDisc);
  const tudoOculto = hubDiscTudoOculto(disciplinas);
  const escolhidas = hubDiscEscolhidas(disciplinas);
  const daFiltragem = linhas.filter((i) => escolhidas.indexOf(i.disciplina) >= 0);
  const escondidas = linhas.length - daFiltragem.length;
  linhas.length = 0;
  daFiltragem.forEach((i) => linhas.push(i));

  if (tudoOculto) {
    const vz = document.createElement("div");
    vz.className = "ed-caixa-sub";
    vz.textContent = t("hub_ag_disc_vazio", { n: disciplinas.length });
    cx.append(vz);
  }
  if (tirados || escondidas || fundidos || edFora) {
    const av = document.createElement("div");
    av.className = "ed-caixa-sub ed-ag-aviso";
    av.textContent = [
      edFora ? t("hub_ag_ed_fora", { n: edFora }) : "",
      tirados ? t("hub_ag_tirados", { n: tirados }) : "",
      escondidas ? t("hub_ag_escondidas", { n: escondidas }) : "",
      fundidos ? t("hub_ag_fundidos", { n: fundidos }) : "",
    ].filter(Boolean).join(" · ");
    cx.append(av);
  }

  /* =====================================================================
   * (19.84.0) A AGENDA PRIMEIRO. Antes da primeira tarefa havia ~1.500 px: um cartão de discursiva por edital, o aviso
   * de ritmo aberto, o modo de estudo com as 25 disciplinas abertas (abria sozinho com uma só em modo próprio) e o
   * "onde foi o seu tempo". Agora: UMA faixa de avisos em chips — tocar abre o detalhe logo abaixo, um por vez — e os
   * ajustes (modo de estudo, por disciplina, IA) numa gaveta fechada. O que estava aberto fica lembrado neste aparelho;
   * um aviso novo ou que piorou (ritmo da semana, conferência a mais) abre sozinho UMA vez.
   * ===================================================================== */
  const painel = (id) => { const x = document.createElement("div"); x.className = "hub-aviso-painel"; x.id = "hubAvisoPainel_" + id; return x; };
  const pDisc = painel("disc"), pConf = painel("conf"), pRitmo = painel("ritmo"), pEquil = painel("equil");
  let discF = 0, discM = 0, equilAtras = 0, discPend = 0, discVerm = 0, discUrg = false;
  /* (19.56.0) O TREINO DA DISCURSIVA. Discursiva se treina escrevendo, não só estudando o conteúdo: com a discursiva
   * cadastrada, a semana pede uma dissertação no formato do edital. "feito esta semana" é guardado por semana. */
  /* (19.75.0) a meta da semana vem da estratégia da tela Discursivas (fase pela distância da prova, ajustada pelas
   * notas), com o próximo tema (a proposta aberta ou a primeira sugestão) e o atalho para lá */
  /* (19.88.0) A DISCURSIVA NA AGENDA, PELO PAINEL: a semana conta TEMAS (gerados com a IA ou escritos), cada disciplina da
   * discursiva vira uma bolinha na cor do Painel, a linha diz o passo de agora e há um atalho para "o que falta". O botão
   * "feito esta semana" saiu daqui (continua no histórico de escrita): o que é feito no app conta sozinho. */
  discs.forEach((q) => {
    const ln = document.createElement("div");
    const dd = q.d;
    let P = null, passo = null, est = null;
    try {
      if (typeof dsPainel === "function") { P = dsPainel(q.e, q.plano, dd, q.sit); passo = dsProximoPasso(q.e, q.plano, dd, q.sit, P); }
      if (typeof dsEstrategia === "function") est = dsEstrategia(q.dias, dsRedacoesResumo(q.id, dd), dd, q.sit);
    } catch (err) { P = null; passo = null; }
    const meta = P ? Math.max(1, P.meta) : 1;
    const feitas = P ? P.feitas : (hubDiscTreinoFeito(q.id) ? 1 : 0);
    const pend = P ? P.cont.vermelho + P.cont.amarelo : 0;
    const feito = feitas >= meta;
    const agir = !!(passo && passo.cod !== "em_dia");
    ln.className = "hub-disc-treino" + (feito && !pend ? " feito" : "");
    ln.id = "hubDiscTreino_" + q.id;
    const tx = document.createElement("span");
    tx.className = "hub-disc-tx";
    if (P && P.discs.length) {
      const pt = document.createElement("span");
      pt.className = "hub-disc-pontos";
      P.discs.forEach((d) => {
        const b0 = document.createElement("span");
        b0.className = "ds-pn-dot ds-pn-" + d.nivel;
        b0.title = t("hub_disc_dot_tip", { d: d.nome, n: d.temas, a: d.alvo });
        pt.append(b0);
      });
      tx.append(pt);
    }
    tx.append(document.createTextNode(t(feito ? "hub_disc_temas_ok" : "hub_disc_temas", { e: q.nome, n: feitas, m: meta, f: est ? est.nome : "" })
      + (dd.fase2 && q.sit && q.sit.separada ? " " + t("hub_disc_data_f2", { d: q.sit.prova.split("-").reverse().join("/"), n: q.dias }) : "")
      + (agir ? " " + t("hub_disc_passo", { p: dsPassoTexto(passo) }) : "")));
    const ir = document.createElement("button");
    ir.type = "button"; ir.className = "btn-min" + (agir ? " btn-min-ok" : "");
    ir.id = "btnHubDisc_" + q.id;
    ir.textContent = t(agir ? "hub_disc_fazer" : "hub_disc_ir");
    ir.onclick = () => { if (typeof dsIrPara === "function") dsIrPara(q.id); };
    ln.append(tx, ir);
    if (pend) {
      const vp = document.createElement("button");
      vp.type = "button"; vp.className = "btn-min hub-disc-falta";
      vp.id = "btnHubDiscFalta_" + q.id;
      vp.textContent = t("hub_disc_ver_falta", { n: pend });
      vp.onclick = () => { if (typeof dsIrPara === "function") dsIrPara(q.id, { pend: true }); };
      ln.append(vp);
    }
    pDisc.append(ln);
    discF += Math.min(feitas, meta); discM += meta;
    discPend += pend;
    if (P && P.cont.vermelho) { discVerm += P.cont.vermelho; if (q.dias != null && q.dias <= 30) discUrg = true; }
  });
  /* (19.54.0) a conferência do edital, em uma linha por edital que ainda tem pendência (o detalhe fica no edital) */
  confs.forEach((q) => {
    const ln = document.createElement("div");
    ln.className = "hub-conf";
    const tx = document.createElement("span");
    tx.textContent = t("hub_conf_linha", { e: q.nome, p: q.pend.map((x) => t("ed_conf_" + x + "_curto")).join(" · ") });
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn-min"; b.textContent = t("hub_conf_ir");
    b.id = "btnHubConf_" + q.id;
    b.onclick = () => hubConferir(q.id);
    ln.append(tx, b);
    pConf.append(ln);
  });
  /* (19.51.0) O AVISO DE RITMO DIZ O QUE MUDA, e oferece quatro saídas: planejar com o ritmo real, manter as horas do
   * edital (o aviso some por 14 dias, ou até o ritmo cair mais), outra meta (com a conta antes de aplicar) e pedir
   * a opinião de uma IA, com o contexto todo. O que se decide fica no registro. */
  if (hubRitmoAvisar || minUsado) pRitmo.append(hubRitmoCaixa(ritmo, minUsado, meta));
  /* (19.47.0) A FAIXA DO EQUILÍBRIO — (19.51.0) com o que ela quer dizer, e mais enxuta: as 3 mais atrasadas e a mais
   * adiantada, nomes sem "Noções de", "vale X% · teve Y%", e o porquê num "?" que abre */
  equilibrios.forEach((q) => {
    const fora = q.eq.filter((x) => Math.abs(x.desvio) >= 5);
    if (!fora.length) return;
    const fx = document.createElement("div");
    fx.className = "hub-equil";
    const rot = document.createElement("span");
    rot.className = "hub-equil-rot";
    rot.textContent = t("hub_equil_rot2") + (equilibrios.length > 1 ? " · " + q.nome : "");
    fx.append(rot);
    const atras = fora.filter((x) => x.desvio < 0).slice(0, 3);
    const sobra = fora.filter((x) => x.desvio > 0).slice(-1);
    atras.concat(sobra).forEach((x) => {
      const c = document.createElement("span");
      c.className = "hub-equil-c " + (x.desvio < 0 ? "hub-equil-atras" : "hub-equil-sobra");
      c.textContent = t("hub_equil_item2", { d: hubDiscCurta(x.disciplina), p: x.prova, t: x.tempo });
      c.title = t("hub_equil_item_tip", { d: x.disciplina, p: x.prova, t: x.tempo, m: horasTexto(x.min || 0) });
      fx.append(c);
    });
    const det = document.createElement("details");
    det.className = "hub-equil-aj";
    const sm = document.createElement("summary");
    sm.textContent = "?";
    sm.title = t("hub_equil_tip");
    const tx = document.createElement("p");
    tx.textContent = t("hub_equil_explica");
    det.append(sm, tx);
    fx.append(det);
    pEquil.append(fx);
    equilAtras += atras.length;
  });

  /* (19.87.0) os vínculos que o próprio app achou (mesmo nome, mesma lei) entre os editais em andamento */
  const pVinc = painel("vinc");
  let sugs = [];
  try { sugs = hubVinculosSugeridos(todosAtivos); } catch (err) { sugs = []; }
  if (sugs.length) hubVincPainel(pVinc, sugs);

  /* a faixa: um chip por assunto que tem o que dizer */
  const avisos = [];
  /* (19.88.0) o chip conta temas e pendências; vermelho (alerta) com disciplina sem tema a 30 dias ou menos da prova, e
   * abre sozinho UMA vez quando aparece disciplina sem tema nova (a mesma regra da conferência) */
  if (discs.length) avisos.push({ id: "disc", txt: t("hub_av_disc2", { f: discF, m: discM }) + (discPend ? " · " + t("hub_av_disc_pend", { n: discPend }) : ""),
    cls: discUrg ? "alerta" : (discF >= discM && !discPend ? "ok" : ""), p: pDisc, sig: discUrg ? String(discVerm) : "" });
  if (hubRitmoAvisar || minUsado) {
    const usando = !!minUsado;
    avisos.push({ id: "ritmo", txt: usando ? t("hub_av_ritmo_usando", { r: horasTexto(minUsado) }) : t("hub_av_ritmo", { r: horasTexto(hubRitmoAvisar.real), p: horasTexto(hubRitmoAvisar.plano) }),
      cls: usando ? "" : "alerta", p: pRitmo, sig: usando ? "" : edSemanaCalendario(hubHoje()).ini });
  }
  if (confs.length) {
    const nP = confs.reduce((a, q) => a + q.pend.length, 0);
    avisos.push({ id: "conf", txt: t("hub_av_conf", { n: nP }), cls: "alerta", p: pConf, sig: String(nP) });
  }
  if (equilAtras) avisos.push({ id: "equil", txt: t("hub_av_equil", { n: equilAtras }), cls: "", p: pEquil });
  if (sugs.length) avisos.push({ id: "vinc", txt: t("hub_av_vinc", { n: sugs.length }), cls: "", p: pVinc, sig: String(sugs.length) });
  if (avisos.length) {
    const fx = document.createElement("div");
    fx.className = "hub-avisos"; fx.id = "hubAvisos";
    fx.setAttribute("role", "group"); fx.setAttribute("aria-label", t("hub_av_aria"));
    let aberto = "";
    try { aberto = localStorage.getItem("eac_ag_aviso_aberto") || ""; } catch (e) {}
    /* novo ou pior: abre uma vez (a assinatura muda a cada semana no ritmo, e quando a conferência ganha pendência) */
    let sigs = {};
    try { sigs = JSON.parse(localStorage.getItem("eac_ag_avisos_sig") || "{}") || {}; } catch (e) { sigs = {}; }
    avisos.forEach((a) => {
      if (!a.sig) return;
      const velho = sigs[a.id];
      const pior = a.id === "conf" || a.id === "vinc" || a.id === "disc" ? !velho || Number(a.sig) > Number(velho) : velho !== a.sig;
      if (pior && !aberto) { aberto = a.id; a.novo = true; }
      sigs[a.id] = a.sig;
    });
    try { localStorage.setItem("eac_ag_avisos_sig", JSON.stringify(sigs)); } catch (e) {}
    if (!avisos.some((a) => a.id === aberto)) aberto = "";
    avisos.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = "hubAviso_" + a.id;
      b.className = "hub-aviso-chip" + (a.cls ? " " + a.cls : "") + (aberto === a.id ? " aberto" : "") + (a.novo ? " novo" : "");
      b.textContent = a.txt + (aberto === a.id ? " ▴" : " ▾");
      b.setAttribute("aria-expanded", aberto === a.id ? "true" : "false");
      b.setAttribute("aria-controls", "hubAvisoPainel_" + a.id);
      b.onclick = () => {
        const v = aberto === a.id ? "" : a.id;
        try { localStorage.setItem("eac_ag_aviso_aberto", v); } catch (e) {}
        hubPintarAgenda();
      };
      fx.append(b);
    });
    cx.append(fx);
    avisos.forEach((a) => { a.p.hidden = aberto !== a.id; cx.append(a.p); });
  }
  /* os ajustes da agenda: fechados, com uma linha de resumo; o modo por disciplina mostra primeiro as que têm modo próprio */
  cx.append(hubAjustesGaveta(hubModoControles(modosVistos, modoSugerido, diasProx, { semIA: !!(hubRitmoAvisar || minUsado) }), modosVistos, modoSugerido, diasProx,
    filtroEd ? { el: filtroEd, vis: ativos.length, total: todosAtivos.length } : null));

  const sub = document.createElement("div");
  sub.className = "ed-caixa-sub";
  sub.textContent = t(ativos.length === 1 ? "hub_agenda_sub1" : "hub_agenda_sub", {
    n: linhas.length,
    c: ativos.length,
    h: horasTexto(linhas.reduce((a, i) => a + edMinSemana(i), 0)),
  });
  cx.append(sub);

  /* MEDIDOR DA SEMANA: o que você já pôs contra o que a agenda pede.
   * Sem isto, "63h45 desta semana" é uma cobrança sem resposta — não dá
   * para saber se você está em dia ou atrás. O feito vem do DIÁRIO (o que
   * aconteceu de verdade), não do que está marcado: marcar um tópico não
   * diz quanto tempo levou. */
  const planejadoMin = linhas.reduce((a2, i) => a2 + edMinSemana(i), 0);
  const feitoMin = minutosDaSemana();

  /* HORA DISPENSADA NÃO É HORA ESTUDADA NEM HORA PERDIDA.
   *
   * Somá-la ao feito faria a barra dizer que a semana foi produtiva sem
   * ninguém ter estudado; deixá-la de fora faria a semana parecer
   * atrasada por causa de uma decisão consciente. É uma terceira coisa,
   * e ganha uma faixa própria — cinza, entre o verde do feito e o vazio
   * do que falta. Só entram as dispensadas DESTA semana: as antigas já
   * não pesam sobre estes sete dias. */
  const dispMin = faDispensadosDaSemana();
  const base = planejadoMin + dispMin;
  const pct = base ? Math.min(100, Math.round((feitoMin / base) * 100)) : 0;
  const pctDisp = base ? Math.min(100 - pct, Math.round((dispMin / base) * 100)) : 0;

  const med = document.createElement("div");
  med.className = "ag-medidor";
  const barra = document.createElement("div");
  barra.className = "ag-barra";
  const fill = document.createElement("div");
  fill.className = "ag-fill" + (pct >= 100 ? " cheio" : (pct >= 50 ? " meio" : ""));
  fill.style.width = pct + "%";
  barra.append(fill);
  if (pctDisp > 0) {
    const disp = document.createElement("div");
    disp.className = "ag-fill-disp";
    disp.style.width = pctDisp + "%";
    disp.title = t("hub_medidor_disp_ajuda", { h: horasTexto(dispMin) });
    barra.append(disp);
  }
  const rot = document.createElement("div");
  rot.className = "ag-med-rot";
  rot.textContent = t("hub_medidor", {
    f: horasTexto(feitoMin), p: horasTexto(planejadoMin), pct,
    falta: horasTexto(Math.max(0, planejadoMin - feitoMin)),
  }) + (dispMin ? " · " + t("hub_medidor_disp", { h: horasTexto(dispMin) }) : "");
  med.append(barra, rot);
  med.title = t("hub_medidor_ajuda");
  cx.append(med);
  /* os dias da semana ficam logo abaixo do medidor; são preenchidos depois de agendar(), que é quem diz o que cai em cada dia */
  const celsSemana = document.createElement("div");
  celsSemana.className = "ed-ag-semana";
  cx.append(celsSemana);

  /* Agendar é o que transforma uma lista de tópicos em agenda: sem esta
   * chamada cada linha vem sem dia nem horário sugerido — foi o que a
   * mudança para o topo tinha quebrado, porque o agendamento morava dentro
   * do painel antigo. Os dois números vêm da preferência de estudo, não do
   * edital: a semana é uma só, mesmo com três concursos. */
  agendar(linhas, { dias: hubPref("dias", 5), inicio: hubPref("inicio", "19:00") });
  hubUltimaAgenda = { previsto: edPrevistoPorDia(linhas), metaMin: planejadoMin, dias: hubPref("dias", 5) };
  if (typeof edSemanaCelulas === "function") {
    const SS = hubSemanaDeEstudo();
    celsSemana.append(edSemanaCelulas(SS, (d) => diarioIrParaDia(d.iso)));
    /* A FRASE DO QUE FALTA ENTRA NA LINHA DO MEDIDOR (curta: "2h52/dia nos 7 dias que restam"); a longa, com os dias,
     * fica no balão. Era mais uma linha inteira entre os dias e a lista. */
    const dica = typeof edSemanaDicaCurta === "function" ? edSemanaDicaCurta(SS) : edSemanaDicaTexto(SS);
    if (dica) {
      rot.textContent = rot.textContent.replace(/\.\s*$/, "") + " · " + dica;
      rot.title = edSemanaDicaTexto(SS);
    }
  }

  const mostrar = hubAgendaAberta ? linhas : linhas.slice(0, HUB_AGENDA_CURTA);
  mostrar.forEach((i) => {
    const li = edLinhaTopico(i);
    /* o selo do concurso: a linha precisa dizer de qual prova ela é, senão
     * com dois editais abertos a agenda não informa nada */
    /* (19.94.0) O SELO É TEXTO, e mora na fileira de selos, embaixo do motivo. Era um botão que abria o edital — um dos
     * quatro jeitos de escolher edital na mesma tela. Abrir o edital da linha está no "⋯" dela; com um edital só na
     * agenda, o selo não diz nada e não aparece. */
    const alvo = hubSelosDe(li, li);
    const comNome = todosAtivos.length > 1 || (i.tambem || []).length;
    if (comNome) {
      const selo = document.createElement("span");
      selo.className = "ed-selo-cc";
      selo.textContent = i.editalNome;
      selo.title = i.editalNome;
      alvo.append(selo);
    }
    li._menuMais = [{ cls: "ed-menu-edital", rot: t("hub_menu_abrir_ed", { n: i.editalNome }), dica: t("hub_ir_para", { n: i.editalNome }), faz: () => hubAbrirEdital(i.edital) }];
    /* (19.87.0) o mesmo assunto no outro edital: estudar aqui vale lá — mas marcar lá continua sendo escolha sua,
     * no registro (o vínculo nunca marca nada sozinho) */
    (i.tambem || []).forEach((o) => {
      const tb = document.createElement("span");
      tb.className = "ed-selo-cc ed-selo-tambem";
      tb.textContent = t("hub_tambem_selo", { n: typeof edNomeCurtoConcurso === "function" ? edNomeCurtoConcurso(o.editalNome) : o.editalNome });
      tb.title = t("hub_tambem_tip", { n: o.editalNome, d: o.disciplina, t: o.nome });
      alvo.append(tb);
      li._menuMais.push({ cls: "ed-menu-edital", rot: t("hub_menu_abrir_ed", { n: o.editalNome }), dica: t("hub_ir_para", { n: o.editalNome }), faz: () => hubAbrirEdital(o.edital) });
    });

    /* O SELO DE FASE. Estudar com o calendário errado na cabeça é o erro
     * mais caro possível num concurso de duas datas: em dezembro você
     * revisa para janeiro, ou em janeiro estuda o que só caía em
     * dezembro. O selo só aparece quando há duas fases — num edital
     * comum ele seria ruído dizendo o óbvio. */
    if (i.temFase2) {
      const f = document.createElement("span");
      f.className = "ed-selo-fase" + (i.faseN === 2 ? " ed-selo-fase2" : "");
      f.textContent = i.faseN === 2 ? (i.faseNome || t("ed_fase2"))
                                    : t("ed_fase1");
      f.title = t("ed_fase_ajuda", { n: i.faseN });
      alvo.append(f);
    }
    /* NA PRIMEIRA FASE, marcar o que VOLTA na segunda. Não muda a ordem —
     * muda o cuidado: um resumo que vai ser reusado em janeiro vale ser
     * feito melhor da primeira vez. */
    if (i.faseN === 1 && i.fase2) {
      const d = document.createElement("span");
      d.className = "ed-selo-volta";
      d.textContent = t("ed_volta_fase2_sinal");
      d.title = t("ed_volta_fase2");
      alvo.append(d);
    }
    /* (19.48.0) o modo explica a revisão e a sessão curta */
    if (i.modoRitmo && (i.ehRevisao || i.minutosAntesModo)) {
      const mq = document.createElement("span");
      mq.className = "ed-selo-modo";
      mq.textContent = t(i.ehRevisao ? "hub_modo_selo_rev" : "hub_modo_selo_curta", { m: t("hub_modo_" + i.modoRitmo) });
      mq.title = t("hub_modo_tip_" + i.modoRitmo);
      hubSelosDe(li, alvo).append(mq);
    }
    /* (19.47.0) POR QUE AGORA: a disciplina está atrás do que vale na prova */
    if (i.equilibrio && i.equilibrio.desvio <= -10) {
      const q = document.createElement("span");
      q.className = "ed-selo-atraso";
      q.textContent = t("hub_atraso_sinal", { p: i.equilibrio.prova, t: i.equilibrio.tempo });
      q.title = t("hub_atraso_tip", { d: i.disciplina, p: i.equilibrio.prova, t: i.equilibrio.tempo });
      /* na linha do motivo ("Português · peso 5 · …"): é a resposta a "por que este agora" */
      hubSelosDe(li, alvo).append(q);
    }
    try { if (!alvo.children.length && alvo.parentNode) alvo.parentNode.removeChild(alvo); } catch (e) {}
    cx.append(li);
  });

  if (linhas.length > HUB_AGENDA_CURTA) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn-min ed-abrir";
    b.textContent = hubAgendaAberta ? t("ed_agenda_menos")
      : t("ed_agenda_mais", { n: linhas.length - HUB_AGENDA_CURTA });
    b.onclick = () => { hubAgendaAberta = !hubAgendaAberta; hubPintarAgenda(); };
    cx.append(b);
  }
  box.append(cx);
}

/* (19.48.0) O MODO DE ESTUDO escolhido: {geral: "auto"|modo, disc: {nome: modo}} — um só para a agenda inteira */
const HUB_MODO = "eac_ag_modo";
function hubModosLer() {
  try {
    const v = JSON.parse(localStorage.getItem(HUB_MODO) || "null");
    if (v && typeof v === "object") return { geral: v.geral || "auto", disc: v.disc && typeof v.disc === "object" ? v.disc : {} };
  } catch (e) {}
  return { geral: "auto", disc: {} };
}
function hubModosGravar(v) {
  try { localStorage.setItem(HUB_MODO, JSON.stringify(v)); } catch (e) {}
}
function hubModoDefinir(disc, modo) {
  const v = hubModosLer();
  if (!disc) v.geral = modo || "auto";
  else if (!modo || modo === "geral") delete v.disc[disc];
  else v.disc[disc] = modo;
  hubModosGravar(v);
  try { reg("EDITAL", "modo de estudo", (disc || "geral") + " → " + (modo || "auto")); } catch (e) {}
  return v;
}
/* a linha "Modo de estudo": o geral (com o que a data sugere) e, recolhido, o de cada disciplina */
/* (19.49.0) cada modo diz o PRAZO em que o automático o escolhe; o automático diz quantos dias faltam */
function hubModoRotulo(m) { return t("hub_modo_" + m) + " · " + t("hub_modo_faixa_" + m); }
/* (19.94.0) a disciplina recém-trazida para a lista do modo próprio: aparece com "como o geral" até a pessoa escolher */
let hubModoNovaDisc = "";
function hubModoControles(modosVistos, sugerido, dias, opc) {
  const v = hubModosLer();
  const cx = document.createElement("div");
  cx.className = "hub-modo";
  cx.id = "hubModo";
  const rot = document.createElement("label");
  rot.className = "hub-modo-rot";
  rot.textContent = t("hub_modo_rot");
  rot.htmlFor = "hubModoGeral";
  rot.title = t("hub_modo_ajuda");
  const sel = document.createElement("select");
  sel.id = "hubModoGeral";
  const opt = (s0, val, txt) => { const o = document.createElement("option"); o.value = val; o.textContent = txt; s0.append(o); };
  opt(sel, "auto", dias !== null && dias !== undefined ? t("hub_modo_auto_d", { m: t("hub_modo_" + (sugerido || "equilibrado")), d: dias })
    : t("hub_modo_auto", { m: t("hub_modo_" + (sugerido || "equilibrado")) }));
  ["avancar", "equilibrado", "consolidar"].forEach((m) => opt(sel, m, hubModoRotulo(m)));
  sel.value = v.geral || "auto";
  sel.title = t("hub_modo_tip_" + (sel.value === "auto" ? (sugerido || "equilibrado") : sel.value));
  sel.onchange = () => { hubModoDefinir("", sel.value); hubPintarAgenda(); };
  cx.append(rot, sel);
  /* (19.52.0) a IA ao alcance mesmo sem aviso de ritmo: pedir a opinião e colar a resposta */
  const bIa = document.createElement("button");
  bIa.type = "button"; bIa.className = "btn-min"; bIa.id = "btnHubModoIA";
  bIa.textContent = t("hub_ritmo_ia"); bIa.title = t("hub_ritmo_ia_tip");
  bIa.onclick = () => hubRitmoCopiarIA();
  const bCol = document.createElement("button");
  bCol.type = "button"; bCol.className = "btn-min"; bCol.id = "btnHubModoColar";
  bCol.textContent = t("hub_ia_colar"); bCol.title = t("hub_ia_colar_tip");
  bCol.onclick = () => hubIaAbrir();
  if (!(opc && opc.semIA)) cx.append(bIa, bCol);
  const discs = Object.keys(modosVistos || {});
  if (discs.length) {
    /* (19.94.0) SÓ AS QUE TÊM MODO PRÓPRIO. A lista trazia todas as disciplinas — 31 seletores, quase todos dizendo "como o
     * geral". Agora aparecem as que fogem do geral, e um seletor só ("dar modo próprio a…") traz mais uma para a lista. */
    const det = document.createElement("div");
    det.className = "hub-modo-disc";
    det.id = "hubModoDisc";
    const proprias = discs.filter((d) => v.disc[d] || d === hubModoNovaDisc);
    const tit = document.createElement("div");
    tit.className = "hub-modo-disc-tit";
    tit.textContent = t("hub_modo_por_disc") + (proprias.length ? " (" + proprias.length + ")" : "");
    det.append(tit);
    proprias.forEach((d) => {
      const k = discs.indexOf(d);
      const lin = document.createElement("div");
      lin.className = "hub-modo-lin";
      const nm = document.createElement("label");
      nm.textContent = d;
      nm.htmlFor = "hubModoDisc_" + k;
      const s2 = document.createElement("select");
      s2.id = "hubModoDisc_" + k;
      opt(s2, "geral", t("hub_modo_como_geral"));
      ["avancar", "equilibrado", "consolidar"].forEach((m) => opt(s2, m, hubModoRotulo(m)));
      s2.value = v.disc[d] || "geral";
      s2.onchange = () => { if (d === hubModoNovaDisc) hubModoNovaDisc = ""; hubModoDefinir(d, s2.value); hubPintarAgenda(); };
      lin.append(nm, s2);
      det.append(lin);
    });
    const resto = discs.filter((d) => proprias.indexOf(d) < 0);
    if (resto.length) {
      const lin = document.createElement("div");
      lin.className = "hub-modo-lin hub-modo-mais";
      const s3 = document.createElement("select");
      s3.id = "hubModoDiscMais";
      s3.setAttribute("aria-label", t("hub_modo_dar"));
      opt(s3, "", t("hub_modo_dar"));
      resto.forEach((d) => opt(s3, d, d));
      s3.value = "";
      s3.onchange = () => { if (!s3.value) return; hubModoNovaDisc = s3.value; hubPintarAgenda(); };
      lin.append(s3);
      det.append(lin);
    }
    cx.append(det);
  }
  return cx;
}

/* (19.84.0) A GAVETA "⚙ Ajustes da agenda": o modo de estudo (geral e por disciplina) e a IA, fechada por padrão. A linha
 * de resumo diz o que está valendo sem abrir: "Modo: Automático · Consolidar (prova em 24 dias) · 1 com modo próprio". */
function hubAjustesGaveta(conteudo, modosVistos, sugerido, dias, eds) {
  const det = document.createElement("details");
  det.className = "hub-ajustes"; det.id = "hubAjustes";
  let aberto = false;
  try { aberto = localStorage.getItem("eac_ag_ajustes_aberto") === "1"; } catch (e) {}
  det.open = aberto;
  det.ontoggle = () => { try { localStorage.setItem("eac_ag_ajustes_aberto", det.open ? "1" : "0"); } catch (e) {} };
  const v = hubModosLer();
  const nOver = Object.keys(modosVistos || {}).filter((d) => v.disc[d]).length;
  const geral = v.geral && v.geral !== "auto" ? hubModoRotulo(v.geral)
    : t("hub_aj_auto", { m: t("hub_modo_" + (sugerido || "equilibrado")) }) + (dias != null ? " " + t("hub_aj_dias", { d: dias }) : "");
  const sm = document.createElement("summary");
  sm.textContent = t("hub_aj_tit") + " · " + t("hub_aj_modo", { m: geral }) + (nOver ? " · " + t("hub_aj_proprio", { n: nOver }) : "")
    + (eds && eds.vis < eds.total ? " · " + t("hub_aj_editais", { n: eds.vis, t: eds.total }) : "");
  det.append(sm);
  if (eds && eds.el) {
    const sec = document.createElement("div");
    sec.className = "hub-aj-editais";
    const rot = document.createElement("div");
    rot.className = "hub-modo-disc-tit";
    rot.textContent = t("hub_aj_editais_tit");
    sec.append(rot, eds.el);
    det.append(sec);
  }
  det.append(conteudo);
  return det;
}

/* (19.52.0) os botões da janela "colar a resposta da IA" */
if (typeof document !== "undefined" && document.getElementById && document.getElementById("dlgHubIA")) {
  const lig = (id, fn) => { const x = document.getElementById(id); if (x) x.onclick = fn; };
  lig("btnHubIaLer", () => hubIaLer());
  lig("btnHubIaAplicar", () => hubIaAplicar());
  lig("btnHubIaFechar", () => document.getElementById("dlgHubIA").close());
  lig("btnHubIaX", () => document.getElementById("dlgHubIA").close());
}

/* (19.56.0) o treino da discursiva desta semana: {edital: {semana (segunda ISO): true}} */
const HUB_DISC_TREINO = "eac_disc_treino";
function hubDiscTreinoFeito(id) {
  try { const v = JSON.parse(localStorage.getItem(HUB_DISC_TREINO) || "{}"); return !!(v[id] && v[id][edSemanaCalendario(hubHoje()).ini]); } catch (e) { return false; }
}
function hubDiscTreinoMarcar(id, sim) {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(HUB_DISC_TREINO) || "{}") || {}; } catch (e) { v = {}; }
  const sem = edSemanaCalendario(hubHoje()).ini;
  v[id] = Object.assign({}, v[id] || {});
  if (sim) v[id][sem] = true; else delete v[id][sem];
  try { localStorage.setItem(HUB_DISC_TREINO, JSON.stringify(v)); } catch (e) {}
  try { reg("EDITAL", sim ? "treino da discursiva feito" : "treino da discursiva desmarcado", id + " · " + sem); } catch (e) {}
}

/* (19.47.0) o ritmo real: média de minutos por semana nas últimas 4 semanas com registro (a mesma conta do painel de ritmo) */
let hubRitmoAvisar = null;
const HUB_RITMO_REAL = "eac_ag_ritmo_real";
function hubRitmoReal() {
  /* (19.52.0) além da média das 4 últimas semanas fechadas: a das 2 últimas, a tendência e o ritmo de REFERÊNCIA (o das
   * 2 últimas quando a tendência é clara — subir de 2h15 para 16h11 não é "7h39 por semana") */
  const ws = hubRitmoSemanas(8).filter((x) => x.min > 0).slice(-4);
  const media = (xs) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.min, 0) / xs.length) : 0);
  const min = media(ws);
  const ult2 = ws.length >= 2 ? media(ws.slice(-2)) : 0;
  const ant2 = ws.length >= 3 ? media(ws.slice(0, -2)) : 0;
  let tendencia = "estavel";
  if (ult2 && ant2) tendencia = ult2 > ant2 * 1.2 ? "subindo" : ult2 < ant2 * 0.8 ? "caindo" : "estavel";
  return { min, semanas: ws.length, ult2, tendencia, ref: tendencia !== "estavel" && ult2 ? ult2 : min, lista: ws };
}
function hubRitmoRealLigado() { try { return localStorage.getItem(HUB_RITMO_REAL) === "1"; } catch (e) { return false; } }
function hubRitmoRealDefinir(sim) {
  try { localStorage.setItem(HUB_RITMO_REAL, sim ? "1" : "0"); } catch (e) {}
  try { reg("EDITAL", sim ? "agenda planejada com o ritmo real" : "agenda de volta às horas do edital", ""); } catch (e) {}
}

/* =====================================================================
 * (19.51.0) O RITMO: CENÁRIOS, DECISÃO E O PEDIDO À IA
 * ===================================================================== */
let hubRitmoCtx = null;        /* {e, r, s, cfg, plano} do edital de prova mais próxima, da última pintura */
const HUB_META = "eac_ag_meta_min";
const HUB_RITMO_RECUSA = "eac_ag_ritmo_recusa";
const HUB_RECUSA_DIAS = 14;
function hubHoje() { return typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10); }
function hubMetaMin() { try { const v = Number(localStorage.getItem(HUB_META)); return v > 0 ? Math.round(v) : 0; } catch (e) { return 0; } }
function hubMetaDefinir(min) {
  try { if (min > 0) localStorage.setItem(HUB_META, String(Math.round(min))); else localStorage.removeItem(HUB_META); } catch (e) {}
  try { reg("EDITAL", min > 0 ? "agenda planejada com meta própria" : "meta própria desfeita", min > 0 ? horasTexto(min) + "/semana" : ""); } catch (e) {}
}
/* "manter as horas do edital": o aviso some por 14 dias — ou volta antes, se o ritmo cair mais de 10% */
function hubRitmoRecusar(real) {
  const d = new Date(hubHoje() + "T00:00:00"); d.setDate(d.getDate() + HUB_RECUSA_DIAS);
  const ate = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  try { localStorage.setItem(HUB_RITMO_RECUSA, JSON.stringify({ ate, real })); } catch (e) {}
  try { reg("EDITAL", "aviso de ritmo: manter as horas do edital", "ritmo " + horasTexto(real) + " · aviso volta em " + ate); } catch (e) {}
}
function hubRitmoRecusado(real) {
  try {
    const v = JSON.parse(localStorage.getItem(HUB_RITMO_RECUSA) || "null");
    return !!(v && v.ate && hubHoje() < v.ate && real >= (Number(v.real) || 0) * 0.9);
  } catch (e) { return false; }
}
/* "15 h", "10h30", "10,5", "7:30" → minutos (0 = não entendi) */
function hubLerHoras(txt) {
  const s0 = String(txt || "").trim().toLowerCase().replace(",", ".");
  let m = s0.match(/^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*(?:min)?$/);
  if (m) return Number(m[1]) * 60 + (Number(m[2]) || 0);
  m = s0.match(/^(\d{1,2}(?:\.\d+)?)\s*(?:h|horas?)?$/);
  if (m) return Math.round(Number(m[1]) * 60);
  return 0;
}
/* o que cabe até a prova com `min` minutos por semana: {pend, cabem, pesoPct} — tópicos ainda por estudar */
function hubCenario(min, ctx) {
  const c = ctx || hubRitmoCtx;
  if (!c || !min) return null;
  let p;
  try { p = montarPlano(c.r, { horas: min / 60, prova: c.s.prova, feitos: c.e.progresso || {}, modos: hubModosLer() }); } catch (e) { return null; }
  const pend = p.itens.filter((i) => !i.feito);
  const dentro = new Set(p.fila.filter((i) => !i.ehRevisao).map((i) => i.chave));
  const cabem = pend.filter((i) => dentro.has(i.chave));
  const pesoT = pend.reduce((a, i) => a + (i.bruto || 0), 0) || 1;
  return { min, pend: pend.length, cabem: cabem.length, pesoPct: Math.round(cabem.reduce((a, i) => a + (i.bruto || 0), 0) / pesoT * 100) };
}
function hubRitmoCaixa(ritmo, minUsado, meta) {
  const av = document.createElement("div");
  av.className = "hub-ritmo" + (minUsado ? " hub-ritmo-on" : "");
  av.id = "hubRitmo";
  const bt = (id, txt, tip, fn, cls) => {
    const b = document.createElement("button");
    b.type = "button"; b.id = id; b.className = "btn-min" + (cls ? " " + cls : "");
    b.textContent = txt; if (tip) b.title = tip; b.onclick = fn;
    return b;
  };
  const tx = document.createElement("div");
  tx.className = "hub-ritmo-tx";
  const bts = document.createElement("div");
  bts.className = "hub-ritmo-bts";
  if (minUsado) {
    const c = hubCenario(minUsado);
    tx.textContent = t(meta ? "hub_meta_usando" : "hub_ritmo_usando", { r: horasTexto(minUsado) })
      + (c ? " " + t("hub_ritmo_cabem", { c: c.cabem, n: c.pend, p: c.pesoPct }) : "");
    bts.append(bt("btnHubRitmo", t("hub_ritmo_voltar"), t("hub_ritmo_tip"), () => { hubMetaDefinir(0); hubRitmoRealDefinir(false); hubPintarAgenda(); }));
    bts.append(bt("btnHubRitmoMeta", t("hub_ritmo_outra"), t("hub_ritmo_outra_tip"), () => hubRitmoMetaInline(av, minUsado)));
  } else {
    const real = hubRitmoAvisar.real, plano = hubRitmoAvisar.plano;
    const cr = hubCenario(real), cp = hubCenario(plano);
    const igual = cr && cp && cr.cabem >= cp.cabem;
    /* título, a medida e o impacto em duas linhas — o que cada escolha custa, antes de escolher */
    const forte = document.createElement("b");
    forte.textContent = t(igual ? "hub_ritmo_tit_ok" : "hub_ritmo_tit2");
    const med = document.createElement("div");
    const rr = hubRitmoReal();
    med.textContent = rr.tendencia !== "estavel" && rr.ult2
      ? t("hub_ritmo_linha_tend", { n: rr.semanas, m: horasTexto(rr.min), u: horasTexto(rr.ult2), tend: t("hub_tend_" + rr.tendencia), p: horasTexto(plano) })
      : t("hub_ritmo_linha", { n: rr.semanas, r: horasTexto(real), p: horasTexto(plano) });
    tx.append(forte, med);
    if (cr && cp) {
      const prova = hubRitmoCtx && hubRitmoCtx.s && hubRitmoCtx.s.prova ? hubRitmoCtx.s.prova.split("-").reverse().slice(0, 2).join("/") : "";
      if (igual) {
        /* o ritmo real já comporta o mesmo que o plano: o aviso diz isso, em vez de soar como problema */
        const d = document.createElement("div");
        d.textContent = t("hub_ritmo_cabe_igual", { r: horasTexto(real), c: cr.cabem, n: cr.pend });
        tx.append(d);
      } else {
        const im = document.createElement("div");
        im.className = "hub-ritmo-imp";
        im.textContent = t("hub_ritmo_impacto", { d: prova });
        const ul = document.createElement("ul");
        [[t("hub_ritmo_li_real", { r: horasTexto(real), c: cr.cabem, n: cr.pend, p: cr.pesoPct })],
          [t("hub_ritmo_li_plano", { h: horasTexto(plano), c: cp.cabem, n: cp.pend, p: cp.pesoPct })]].forEach(([x]) => {
          const li = document.createElement("li"); li.textContent = x; ul.append(li);
        });
        tx.append(im, ul);
      }
    }
    bts.append(bt("btnHubRitmo", t("hub_ritmo_usar", { r: horasTexto(real) }), t("hub_ritmo_tip"), () => { hubRitmoRealDefinir(true); hubPintarAgenda(); }, "btn-min-ok"));
    bts.append(bt("btnHubRitmoManter", t("hub_ritmo_manter", { p: horasTexto(plano) }), t("hub_ritmo_manter_tip", { d: HUB_RECUSA_DIAS }), () => {
      hubRitmoRecusar(real);
      try { toastMsg(t("hub_ritmo_manter_feito", { d: HUB_RECUSA_DIAS, l: horasTexto(Math.round(real * 0.9)) }), 6000); } catch (e) {}
      hubPintarAgenda();
    }));
    bts.append(bt("btnHubRitmoMeta", t("hub_ritmo_outra"), t("hub_ritmo_outra_tip"), () => hubRitmoMetaInline(av, Math.round((real + plano) / 2 / 30) * 30)));
  }
  bts.append(bt("btnHubRitmoIA", t("hub_ritmo_ia"), t("hub_ritmo_ia_tip"), () => hubRitmoCopiarIA()));
  bts.append(bt("btnHubRitmoColar", t("hub_ia_colar"), t("hub_ia_colar_tip"), () => hubIaAbrir()));
  av.append(tx);
  /* (19.78.0) as semanas por trás dos números do aviso: o mapa compacto das 5 últimas (a atual e 4 fechadas) */
  try {
    if (typeof mpMini === "function" && typeof mpMapaDoDiario === "function") {
      const metaM = minUsado || (hubRitmoAvisar && hubRitmoAvisar.plano) || 0;
      const Mr = mpMapaDoDiario(5, null, metaM);
      const det = document.createElement("details");
      det.className = "hub-ritmo-mapa";
      det.id = "hubRitmoMapa";
      const sm = document.createElement("summary");
      sm.textContent = t("hub_ritmo_mapa_tit");
      det.append(sm, mpMini(Mr));
      av.append(det);
    }
  } catch (err) {}
  av.append(bts);
  return av;
}
/* (19.51.0) "outra meta…" NA PRÓPRIA CAIXA: os botões viram  [−] 10h [+] /semana → cabem 11 de 14 (83%) [aplicar] [cancelar].
 * Cada toque muda 30 min e a conta do que cabe refaz na hora; nada é aplicado sem "aplicar". */
const HUB_META_PASSO = 30;
function hubRitmoMetaInline(av, inicial) {
  const bts = av && av.querySelector ? av.querySelector(".hub-ritmo-bts") : null;
  if (!bts) return hubRitmoOutraMeta();
  let min = Math.max(60, Math.min(100 * 60, Math.round((inicial || 600) / HUB_META_PASSO) * HUB_META_PASSO));
  bts.innerHTML = "";
  bts.className = "hub-ritmo-bts hub-meta-inline";
  const b = (id, txt, fn, cls) => { const x = document.createElement("button"); x.type = "button"; x.id = id; x.className = "btn-min" + (cls ? " " + cls : ""); x.textContent = txt; x.onclick = fn; return x; };
  const val = document.createElement("span");
  val.className = "hub-meta-val";
  val.id = "hubMetaVal";
  const res = document.createElement("span");
  res.className = "hub-meta-res";
  res.id = "hubMetaRes";
  const pintar = () => {
    val.textContent = t("hub_meta_valor", { h: horasTexto(min) });
    const c = hubCenario(min);
    res.textContent = c ? t("hub_meta_res", { c: c.cabem, n: c.pend, p: c.pesoPct }) : "";
  };
  const mudar = (d) => { min = Math.max(60, Math.min(100 * 60, min + d)); pintar(); };
  bts.append(b("btnHubMetaMenos", "−", () => mudar(-HUB_META_PASSO)), val, b("btnHubMetaMais", "+", () => mudar(HUB_META_PASSO)), res,
    b("btnHubMetaAplicar", t("hub_meta_aplicar"), () => { hubMetaDefinir(min); hubPintarAgenda(); }, "btn-min-ok"),
    b("btnHubMetaCancelar", t("cancel_btn"), () => hubPintarAgenda()));
  pintar();
  return true;
}
/* o que está decidido sobre o ritmo, numa frase — para o raio-X explicar as horas do plano */
function hubRitmoDecisaoTexto() {
  const meta = hubMetaMin();
  if (meta) return t("hub_dec_meta", { h: horasTexto(meta) });
  if (hubRitmoRealLigado()) return t("hub_dec_real", { h: horasTexto(hubRitmoReal().ref) });
  try {
    const v = JSON.parse(localStorage.getItem(HUB_RITMO_RECUSA) || "null");
    if (v && v.ate && hubHoje() < v.ate) return t("hub_dec_mantido", { r: horasTexto(Number(v.real) || 0), d: v.ate.split("-").reverse().join("/") });
  } catch (e) {}
  return "";
}
/* "outra meta…" pela janela de texto (a caixa sem a fileira de botões, ou quem chamar direto) */
async function hubRitmoOutraMeta() {
  const v = await uiTexto(t("hub_meta_pergunta"), "");
  if (v === null || v === undefined) return false;
  const min = hubLerHoras(v);
  if (!min || min < 60 || min > 100 * 60) { try { uiAlert(t("hub_meta_invalida")); } catch (e) {} return false; }
  const c = hubCenario(min);
  const ok = await uiConfirm(c ? t("hub_meta_conf", { h: horasTexto(min), c: c.cabem, n: c.pend, p: c.pesoPct }) : t("hub_meta_conf_sem", { h: horasTexto(min) }));
  if (!ok) return false;
  hubMetaDefinir(min);
  hubPintarAgenda();
  return true;
}
/* o pedido à IA: o contexto inteiro e a pergunta fechada, num texto para colar.
 * (19.52.0) Depois da revisão crítica do pedido: o ritmo com as datas de cada semana, as duas médias e a tendência; o que
 * os "14 dias" e o "caber" querem dizer; o que cada modo faz, inclusive com disciplina zerada; as notas mínimas (ou que
 * o app não as tem); o conhecimento de fora do app; e um formato que o app consegue LER de volta ("colar a resposta"). */
function hubRitmoPromptIA(ctx) {
  const c = ctx || hubRitmoCtx;
  if (!c) return "";
  const L = [];
  const ritmo = hubRitmoReal();
  const plano = c.plano;
  const planoMin = (c.cfg.horas || 10) * 60;
  const dm = (iso) => iso.split("-").reverse().slice(0, 2).join("/");
  const fimSem = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + 6); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  L.push(t("hub_ia_cab"));
  L.push("");
  L.push("== " + t("hub_ia_contexto") + " ==");
  L.push(t("hub_ia_concurso2", { c: c.e.nome || c.cfg.concurso || "?", p: c.s.prova ? c.s.prova.split("-").reverse().join("/") : "?", d: c.s.dias == null ? "?" : c.s.dias, w: c.s.dias == null ? "?" : Math.floor(c.s.dias / 7) }));
  L.push(t("hub_ia_horas_plano", { p: horasTexto(planoMin) }));
  L.push(t("hub_ia_semanas2"));
  hubRitmoSemanas(6).forEach((x) => L.push("  - " + dm(x.ini) + "–" + dm(fimSem(x.ini)) + ": " + horasTexto(x.min)));
  L.push("  " + t("hub_ia_medias", { m: horasTexto(ritmo.min), u: ritmo.ult2 ? horasTexto(ritmo.ult2) : "-", tend: t("hub_tend_" + ritmo.tendencia) }));
  L.push(t("hub_ia_bagagem"));
  /* (19.56.0) a discursiva: quanto vale da nota final, onde cai e o que elimina */
  if (plano.discursivaCfg) {
    const dd = plano.discursivaCfg;
    L.push(t("hub_ia_discursiva", { p: dd.pontos || "?", s: plano.discursiva ? plano.discursiva.s : "?", d: (dd.disciplinas || []).join(", ") || "?",
      m: dd.minimo ? (dd.minimo.tipo === "pct" ? dd.minimo.valor + "%" : dd.minimo.valor) : "-", l: edLinhasTxt(dd.linhas, true) || "-", c: dd.corrigida || "-" }));
  } else if (!(c.cfg.fase2 && c.cfg.fase2.prova)) L.push(t("hub_ia_discursiva_sem"));
  /* (19.76.0) a discursiva em data própria: a IA precisa saber que até a objetiva o plano é dela, e que a escrita vem depois */
  if (c.cfg.fase2 && c.cfg.fase2.prova) {
    const fx = c.cfg.fase2;
    const ndD = c.r ? (c.r.disciplinas || []).reduce((a, d) => a + d.topicos.filter((tp) => tp.fase2).length, 0) : 0;
    L.push(t("hub_ia_fase2", { n: fx.nome || "2ª fase", d: fx.prova.split("-").reverse().join("/"), o: c.cfg.prova ? c.cfg.prova.split("-").reverse().join("/") : "?", t: ndD,
      f: plano.fase && plano.fase.n === 2 ? t("hub_ia_fase2_agora2") : t("hub_ia_fase2_agora1") }));
  }
  /* (19.54.0) os pesos são do edital ou estimados? A IA precisa saber o quanto confiar no "vale na prova" */
  L.push(t(plano.fatiaExata ? "hub_ia_fatia_exata" : "hub_ia_fatia_est"));
  /* as notas mínimas: as que o edital tem no app, com a cobertura de hoje — ou o aviso de que não estão cadastradas */
  const blocos = (plano.blocos || []).filter((b) => b.minPct !== null && b.minPct !== undefined);
  if (blocos.length) {
    L.push(t("hub_ia_corte_tem"));
    blocos.forEach((b) => L.push("  - " + t("hub_ia_corte_bloco", { n: b.nome || "?", d: (b.disciplinas || []).join(", "), m: b.minPct, c: b.pct, a: b.acerto == null ? "-" : b.acerto + "%" })));
  } else L.push(t("hub_ia_corte_sem"));
  L.push("");
  L.push("== " + t("hub_ia_disc2") + " ==");
  L.push(t("hub_ia_disc_cab2"));
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const banco = (typeof qsBanco !== "undefined" && qsBanco) || [];
  let sinais = [];
  try { sinais = typeof plSinais === "function" ? plSinais(plano, diario, banco) : []; } catch (e) { sinais = []; }
  const eq = {};
  (plano.equilibrio || []).forEach((x) => { eq[x.disciplina] = x; });
  const modos = plano.modos || {};
  const discs = Object.keys(plano.fatia || {}).sort((a, b) => (plano.fatia[b] || 0) - (plano.fatia[a] || 0));
  discs.forEach((d) => {
    const its = plano.itens.filter((i) => i.disciplina === d);
    const feitos = its.filter((i) => i.feito).length;
    const comecados = its.filter((i) => !i.feito && i.ramos && i.ramos.length && (i.ramosFeitos || 0) > 0).length;
    const sg = sinais.find((x) => x.disciplina === d) || {};
    const q = eq[d] || {};
    L.push([d, (plano.fatia[d] || 0) + "%", horasTexto(q.min || 0) + " (" + (q.tempo || 0) + "%)",
      sg.pct == null ? t("hub_ia_sem_dado") : sg.pct + "% (" + sg.qFeitas + " q)",
      feitos + "/" + its.length, comecados,
      (modos[d] && modos[d].modo) || "-",
      !feitos && !comecados ? t("hub_ia_zerada") : "-"].join(" | "));
  });
  L.push("");
  L.push("== " + t("hub_ia_modos_tit") + " ==");
  L.push(t("hub_ia_modos"));
  L.push("");
  L.push("== " + t("hub_ia_cenarios") + " ==");
  L.push(t("hub_ia_caber"));
  const mid = Math.round((ritmo.ref + planoMin) / 2 / 30) * 30;
  const cen = [[t("hub_ia_cen_ult2"), ritmo.ult2], [t("hub_ia_cen_real"), ritmo.min], [t("hub_ia_cen_meio"), mid], [t("hub_ia_cen_plano"), planoMin]];
  const vistos = new Set();
  cen.forEach(([n, m]) => {
    if (!m || vistos.has(m)) return;
    vistos.add(m);
    const cc = hubCenario(m, c);
    if (cc) L.push("  - " + t("hub_ia_cen_linha", { n, h: horasTexto(m), c: cc.cabem, t: cc.pend, p: cc.pesoPct }));
  });
  L.push("");
  L.push("== " + t("hub_ia_pergunta_tit") + " ==");
  L.push(t("hub_ia_pergunta2"));
  L.push("");
  L.push("== " + t("hub_ia_diretrizes_tit") + " ==");
  L.push(t("hub_ia_diretrizes2"));
  L.push("");
  L.push("== " + t("hub_ia_formato_tit") + " ==");
  L.push(t("hub_ia_formato2"));
  return L.join("\n");
}
/* as últimas `n` semanas fechadas com o total de minutos (para a IA ver a tendência, não só a média) */
function hubRitmoSemanas(n) {
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const porSemana = {};
  diario.forEach((x) => {
    if (!x || !x.d || x.d === "?" || x.a === "pendente") return;
    const k = edSemanaCalendario(x.d).ini;
    porSemana[k] = (porSemana[k] || 0) + (Number(x.m) || 0);
  });
  const atual = edSemanaCalendario(hubHoje()).ini;
  return Object.keys(porSemana).filter((k) => k < atual).sort().slice(-(n || 6)).map((k) => ({ ini: k, min: porSemana[k] }));
}
function hubRitmoCopiarIA() {
  const txt = hubRitmoPromptIA();
  if (!txt) return "";
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {}
  try { toastMsg(t("hub_ia_copiado"), 6000); } catch (e) {}
  try { reg("EDITAL", "pedido de opinião sobre o ritmo copiado para a IA", txt.length + " caracteres"); } catch (e) {}
  return txt;
}
/* (19.51.0) os selos do modo e do atraso numa fileira PRÓPRIA, embaixo do motivo: na linha do motivo eles empurravam
 * o texto para baixo dos botões e repetiam o "vale X% da prova" que o motivo já diz */
function hubSelosDe(li, alvo) {
  let f = li.querySelector(".ed-item-selos");
  if (f) return f;
  f = document.createElement("div");
  f.className = "ed-item-selos";
  const pq = li.querySelector(".ed-item-porque");
  if (pq && pq.parentNode) pq.parentNode.insertBefore(f, pq.nextSibling);
  else (alvo || li).append(f);
  return f;
}
/* =====================================================================
 * (19.52.0) COLAR A RESPOSTA DA IA: o app lê o formato fixo do pedido, mostra o que vai mudar e aplica o que a pessoa
 * marcar — a meta de horas, o modo de cada disciplina (pelo foco: "questões"/"revisão" → Consolidar, "estudo novo" →
 * Avançar, "misto" → Equilibrado) e o "deixar de fora" (os tópicos ainda por estudar saem da agenda como "não vou
 * estudar", e voltam pela gaveta de tirados). A divisão de horas por disciplina fica como referência: a agenda ordena
 * pelo modo e pelo equilíbrio, não por cota de horas. Nada é aplicado sem "aplicar".
 * ===================================================================== */
let hubIaLido = null;
function hubIaNorm(x) { return cqNormalSeguro(String(x || "").replace(/[*_`]/g, "")); }
/* o nome escrito pela IA → a disciplina do plano ("Dir. Administrativo", "Noções de Direito Administrativo", "Administrativo") */
function hubIaAcharDisc(nome, discs) {
  const n = hubIaNorm(nome).replace(/\bdir\.?\s/g, "direito ").replace(/\bcontab\.?\s/g, "contabilidade ").trim();
  if (!n) return "";
  const cand = discs.map((d) => ({ d, k: hubIaNorm(d), c: hubIaNorm(hubDiscCurta(d)) }));
  const ex = cand.find((x) => x.k === n || x.c === n);
  if (ex) return ex.d;
  const parcial = cand.filter((x) => x.k.indexOf(n) >= 0 || n.indexOf(x.c) >= 0 || x.c.indexOf(n) >= 0);
  return parcial.length === 1 ? parcial[0].d : "";
}
function hubIaModoDoFoco(foco) {
  const f = hubIaNorm(foco);
  if (/misto|equilib|altern/.test(f)) return "equilibrado";
  if (/quest|revis|consolid|fixa|manut|exerc/.test(f)) return "consolidar";
  if (/novo|teoria|leitura|base|inicia|aprend|resum/.test(f)) return "avancar";
  return "equilibrado";
}
/* lê a resposta: {min, divisao:[{disc, min, foco, modo, texto}], fora:[{disc, topico, itens}], porque:[], avisos:[]} */
function hubIaLerResposta(txt, plano) {
  const res = { min: 0, divisao: [], fora: [], porque: [], avisos: [] };
  const discs = Object.keys((plano && plano.fatia) || {});
  let sec = "";
  String(txt || "").split(/\r?\n/).forEach((linha0) => {
    const linha = linha0.replace(/\*\*/g, "").trim();
    if (!linha) return;
    const h = hubIaNorm(linha);
    let m;
    if ((m = linha.match(/horas\s+recomendadas\s*:?\s*(.+)$/i))) {
      res.min = hubLerHoras(String(m[1]).replace(/\s*(?:por|\/)\s*semana.*$/i, "").replace(/h\s*\/\s*sem.*$/i, "h").trim());
      sec = ""; return;
    }
    if (/^divis[aã]o/.test(h)) { sec = "div"; return; }
    if (/^deixar de fora|^o que cortar|^podar/.test(h)) { sec = "fora"; return; }
    if (/^por qu[eê]|^justificativa/.test(h)) { sec = "pq"; return; }
    const item = linha.replace(/^[-•*·]\s*|^\d+[.)]\s*/, "");
    if (sec === "div") {
      m = item.match(/^(.+?)\s*:\s*(\d+(?:[.,]\d+)?\s*h(?:\s*\d{1,2})?|\d+\s*min)\s*(?:\/\s*sem(?:ana)?|por semana)?\s*(?:[—–-]+\s*(?:foco\s*:\s*)?(.*))?$/i);
      if (!m) return;
      const d = hubIaAcharDisc(m[1], discs);
      const mins = /min/i.test(m[2]) ? Number(m[2].replace(/\D/g, "")) : hubLerHoras(m[2].replace(/\s+/g, ""));
      const foco = (m[3] || "").trim();
      if (!d) { res.avisos.push(t("hub_ia_av_disc", { d: m[1].trim() })); return; }
      /* (19.53.0) 0h é PAUSA, não modo: "Raciocínio Lógico: 0 h — foco: questões" não vira "Consolidar" */
      res.divisao.push({ disc: d, min: mins, foco, modo: mins > 0 ? hubIaModoDoFoco(foco) : "", pausa: !(mins > 0), texto: item });
    } else if (sec === "fora") {
      if (/^nada|^nenhum/.test(hubIaNorm(item))) return;
      const partes = item.split(/\s*[›>]\s*/);
      const d = hubIaAcharDisc(partes[0].replace(/\(.*\)\s*$/, ""), discs);
      if (!d) { res.avisos.push(t("hub_ia_av_disc", { d: partes[0].trim() })); return; }
      const pend = (plano.itens || []).filter((i) => i.disciplina === d && !i.feito);
      let itens = pend;
      let topico = "";
      if (partes[1]) {
        const k = hubIaNorm(partes[1]);
        /* o nome exato primeiro: "Tópico 13" não pode levar junto o "Tópico 1" (um contém o outro) */
        const exatos = pend.filter((i) => hubIaNorm(i.nome) === k);
        const parciais = pend.filter((i) => hubIaNorm(i.nome).indexOf(k) >= 0 || k.indexOf(hubIaNorm(i.nome)) >= 0);
        itens = exatos.length ? exatos : (parciais.length === 1 ? parciais : []);
        topico = partes[1].trim();
        if (!itens.length) { res.avisos.push(t("hub_ia_av_topico", { t: topico, d })); return; }
      }
      res.fora.push({ disc: d, topico, itens });
    } else if (sec === "pq") res.porque.push(item);
  });
  if (!res.min) res.avisos.push(t("hub_ia_av_sem_horas"));
  /* 0h na divisão sem estar em "deixar de fora": a resposta se contradiz — o app diz, e não decide sozinho */
  res.divisao.filter((x) => x.pausa && !res.fora.some((f) => f.disc === x.disc && !f.topico))
    .forEach((x) => res.avisos.push(t("hub_ia_av_zero", { d: x.disc })));
  const soma = res.divisao.reduce((a, x) => a + (x.min || 0), 0);
  if (res.min && res.divisao.length && Math.abs(soma - res.min) > 30) res.avisos.push(t("hub_ia_av_soma", { s: horasTexto(soma), h: horasTexto(res.min) }));
  /* cortar uma disciplina que está num bloco com nota mínima: o app avisa (a IA pode não saber) */
  (plano.blocos || []).filter((b) => b.minPct !== null && b.minPct !== undefined).forEach((b) => {
    res.fora.filter((f) => !f.topico && (b.disciplinas || []).indexOf(f.disc) >= 0)
      .forEach((f) => res.avisos.push(t("hub_ia_av_corte", { d: f.disc, b: b.nome || "?", m: b.minPct })));
  });
  return res;
}
function hubIaAbrir() {
  if (!$("dlgHubIA")) return false;
  hubIaLido = null;
  if ($("hubIaResp")) $("hubIaResp").value = "";
  if ($("hubIaPrev")) $("hubIaPrev").innerHTML = "";
  if ($("btnHubIaAplicar")) $("btnHubIaAplicar").hidden = true;
  abrirModal("dlgHubIA");
  return true;
}
/* lê o que foi colado e mostra o que vai mudar.
 * (19.53.0) CADA PARTE TEM A SUA CAIXA: a meta; o modo de cada disciplina; cada disciplina do "deixar de fora" — e,
 * dentro dela, cada tópico (para aceitar "cortar Informática, menos LGPD"). O painel verde/vermelho refaz a conta a
 * cada caixa marcada ou desmarcada: mostra o que acontece com a escolha de agora, não com a resposta inteira. */
function hubIaLer() {
  const c = hubRitmoCtx;
  const cx = $("hubIaPrev");
  if (!cx) return null;
  cx.innerHTML = "";
  if (!c) { cx.textContent = t("hub_ia_sem_edital"); return null; }
  const res = hubIaLerResposta($("hubIaResp").value, c.plano);
  hubIaLido = res;
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const caixa = (id, rot, sub, cls) => {
    const l = el("label", "hub-ia-op" + (cls ? " " + cls : ""));
    const ck = document.createElement("input"); ck.type = "checkbox"; ck.id = id; ck.checked = true;
    ck.onchange = () => hubIaRepintarComparacao();
    l.append(ck, el("span", "", rot));
    if (sub) l.append(el("span", "hub-ia-sub", sub));
    return l;
  };
  const algo = !!(res.min || res.divisao.length || res.fora.length);
  const cmp = el("div", "");
  cmp.id = "hubIaCmpLugar";
  cx.append(cmp);
  if (res.min) {
    const cc = hubCenario(res.min);
    cx.append(caixa("hubIaOpMeta", t("hub_ia_op_meta", { h: horasTexto(res.min) }), cc ? t("hub_meta_res", { c: cc.cabem, n: cc.pend, p: cc.pesoPct }) : ""));
  }
  if (res.divisao.length) {
    cx.append(el("div", "hub-ia-grupo", t("hub_ia_op_modos")));
    res.divisao.forEach((x, k) => {
      if (x.pausa) cx.append(el("div", "hub-ia-op hub-ia-pausa", t("hub_ia_op_pausa", { d: x.disc })));
      else cx.append(caixa("hubIaModo_" + k, t("hub_ia_op_modo_item", { d: x.disc, m: t("hub_modo_" + x.modo), h: horasTexto(x.min || 0), f: x.foco || "-" }), "", "hub-ia-sub-op"));
    });
  }
  if (res.fora.length) {
    cx.append(el("div", "hub-ia-grupo", t("hub_ia_op_fora_tit")));
    cx.append(el("div", "hub-ia-sub", t("hub_ia_op_fora_sub")));
    res.fora.forEach((f, k) => {
      const rot = f.topico ? f.disc + " › " + f.topico : t("hub_ia_op_fora_disc", { d: f.disc, n: f.itens.length });
      cx.append(caixa("hubIaFora_" + k, rot, "", "hub-ia-sub-op"));
      if (f.itens.length > 1) {
        const det = el("details", "hub-ia-fora-det");
        det.append(el("summary", "", t("hub_ia_op_fora_escolher", { n: f.itens.length })));
        f.itens.forEach((i, j) => det.append(caixa("hubIaForaT_" + k + "_" + j, i.nome, "", "hub-ia-topico")));
        cx.append(det);
      }
    });
  }
  if (res.divisao.length) cx.append(el("p", "nota", t("hub_ia_nota_divisao")));
  if (res.porque.length) {
    cx.append(el("div", "hub-ia-pq-tit", t("hub_ia_pq_tit")));
    const ol = el("ol", "hub-ia-lista");
    res.porque.slice(0, 6).forEach((x) => ol.append(el("li", "", x)));
    cx.append(ol);
  }
  res.avisos.forEach((a) => cx.append(el("p", "hub-ia-aviso", "⚠ " + a)));
  if (!algo) cx.append(el("p", "hub-ia-aviso", t("hub_ia_nada")));
  if ($("btnHubIaAplicar")) $("btnHubIaAplicar").hidden = !algo;
  hubIaRepintarComparacao();
  return res;
}
/* o que está marcado agora: {min, divisao (sem as pausadas), fora (com os tópicos marcados)} */
function hubIaSelecao() {
  const res = hubIaLido;
  if (!res) return null;
  const marcado = (id) => !$(id) || $(id).checked !== false;
  const sel = { min: res.min && marcado("hubIaOpMeta") ? res.min : 0, divisao: [], fora: [] };
  res.divisao.forEach((x, k) => { if (!x.pausa && marcado("hubIaModo_" + k)) sel.divisao.push(x); });
  res.fora.forEach((f, k) => {
    if (!marcado("hubIaFora_" + k)) return;
    const itens = f.itens.length > 1 ? f.itens.filter((i, j) => marcado("hubIaForaT_" + k + "_" + j)) : f.itens;
    if (itens.length) sel.fora.push(Object.assign({}, f, { itens }));
  });
  return sel;
}
function hubIaRepintarComparacao() {
  const lugar = $("hubIaCmpLugar");
  const c = hubRitmoCtx, sel = hubIaSelecao();
  if (!lugar || !c || !sel) return;
  lugar.innerHTML = "";
  if (sel.min || sel.divisao.length || sel.fora.length) lugar.append(hubIaComparar(sel, c));
  else { const p = document.createElement("p"); p.className = "nota"; p.textContent = t("hub_ia_nada_marcado"); lugar.append(p); }
}

/* (19.52.0) O QUE ENTRA E O QUE SAI. Pedido: "um painel com indicações claras, em verde e vermelho, do que entra e sai,
 * para ajudar a decidir". Compara a lista do que cabe até a prova HOJE (o plano da agenda) com a lista se a resposta for
 * aceita inteira (nova meta, novos modos e os tópicos deixados de fora). Verde: passa a caber. Vermelho: sai — deixado
 * de fora, ou não cabe mais. Azul: o que muda de regra (horas e modos). */
function hubIaSimular(res, c) {
  const antes = new Set(c.plano.fila.filter((i) => !i.ehRevisao && !i.feito).map((i) => i.chave));
  const modos = hubModosLer();
  const novos = { geral: modos.geral, disc: Object.assign({}, modos.disc) };
  res.divisao.forEach((x) => { novos.disc[x.disc] = x.modo; });
  const minAtual = hubMetaMin() || (hubRitmoRealLigado() ? hubRitmoReal().ref : 0) || (c.cfg.horas || 10) * 60;
  let dep;
  try { dep = montarPlano(c.r, { horas: (res.min || minAtual) / 60, prova: c.s.prova, feitos: c.e.progresso || {}, modos: novos }); } catch (e) { return null; }
  const fora = new Set();
  res.fora.forEach((f) => f.itens.forEach((i) => fora.add(i.chave)));
  const depois = new Set(dep.fila.filter((i) => !i.ehRevisao && !i.feito && !fora.has(i.chave)).map((i) => i.chave));
  const nome = {};
  c.plano.itens.concat(dep.itens).forEach((i) => { nome[i.chave] = { disc: i.disciplina, nome: i.nome, bruto: i.bruto || 0 }; });
  const entram = [...depois].filter((k) => !antes.has(k)).map((k) => nome[k]);
  const saem = [...antes].filter((k) => !depois.has(k)).map((k) => Object.assign({ fora: fora.has(k) }, nome[k]));
  const peso = (set) => [...set].reduce((a, k) => a + ((nome[k] && nome[k].bruto) || 0), 0);
  const pend = c.plano.itens.filter((i) => !i.feito).reduce((a, i) => a + (i.bruto || 0), 0) || 1;
  /* (19.53.0) quanto da PROVA cada tópico vale (o peso dele sobre o edital inteiro), e a soma do que entra e do que sai */
  const totalEdital = c.plano.itens.reduce((a, i) => a + (i.bruto || 0), 0) || 1;
  const pctProva = (x) => Math.round(((x && x.bruto) || 0) / totalEdital * 1000) / 10;
  entram.forEach((x) => { x.pctProva = pctProva(x); });
  saem.forEach((x) => { x.pctProva = pctProva(x); });
  saem.sort((a, b) => b.pctProva - a.pctProva);
  entram.sort((a, b) => b.pctProva - a.pctProva);
  const soma = (xs) => Math.round(xs.reduce((a, x) => a + x.pctProva, 0) * 10) / 10;
  return { entram, saem, minAtual, entraPct: soma(entram), saiPct: soma(saem), saiForaPct: soma(saem.filter((x) => x.fora)), antesN: antes.size, depoisN: depois.size,
    antesPct: Math.round(peso(antes) / pend * 100), depoisPct: Math.round(peso(depois) / pend * 100), novosModos: novos };
}
function hubIaComparar(res, c) {
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const box = el("div", "hub-ia-cmp");
  box.id = "hubIaCmp";
  const sim = hubIaSimular(res, c);
  if (!sim) return box;
  box.append(el("div", "hub-ia-cmp-res", t("hub_ia_cmp_resumo", { a: sim.antesN, ap: sim.antesPct, d: sim.depoisN, dp: sim.depoisPct })));
  const col = (cls, tit, itens, fmt) => {
    const d = el("div", "hub-ia-cmp-col " + cls);
    d.append(el("div", "hub-ia-cmp-tit", tit));
    const ul = el("ul");
    itens.slice(0, 12).forEach((x) => ul.append(el("li", "", fmt(x))));
    if (itens.length > 12) ul.append(el("li", "hub-ia-cmp-mais", t("hub_ia_cmp_mais", { n: itens.length - 12 })));
    if (!itens.length) ul.append(el("li", "hub-ia-cmp-vazio", t("hub_ia_cmp_nenhum")));
    d.append(ul);
    return d;
  };
  const grade = el("div", "hub-ia-cmp-grade");
  grade.append(
    col("hub-ia-cmp-entra", "✓ " + t("hub_ia_cmp_entra2", { n: sim.entram.length, p: hubPct(sim.entraPct) }), sim.entram,
      (x) => hubDiscCurta(x.disc) + " › " + x.nome + " — " + t("hub_ia_cmp_vale", { p: hubPct(x.pctProva) })),
    col("hub-ia-cmp-sai", "✕ " + t("hub_ia_cmp_sai2", { n: sim.saem.length, p: hubPct(sim.saiPct) }), sim.saem,
      (x) => hubDiscCurta(x.disc) + " › " + x.nome + " — " + t("hub_ia_cmp_vale", { p: hubPct(x.pctProva) }) + " · " + t(x.fora ? "hub_ia_cmp_fora" : "hub_ia_cmp_naocabe")));
  /* o que sai, dito em pontos da prova: quanto por escolha (deixado de fora) e quanto por falta de tempo */
  if (sim.saem.length) box.append(el("div", "hub-ia-cmp-perda", t("hub_ia_cmp_perda", { p: hubPct(sim.saiPct), f: hubPct(sim.saiForaPct), n: hubPct(Math.round((sim.saiPct - sim.saiForaPct) * 10) / 10) })));
  box.append(grade);
  /* o que muda de regra */
  const muda = [];
  if (res.min && res.min !== sim.minAtual) muda.push(t("hub_ia_cmp_meta", { a: horasTexto(sim.minAtual), d: horasTexto(res.min) }));
  const atuais = (c.plano.modos || {});
  res.divisao.forEach((x) => {
    const antes = atuais[x.disc] ? atuais[x.disc].modo : "";
    if (antes !== x.modo) muda.push(t("hub_ia_cmp_modo", { d: hubDiscCurta(x.disc), a: antes ? t("hub_modo_" + antes) : "-", n: t("hub_modo_" + x.modo) }));
  });
  if (muda.length) box.append(col("hub-ia-cmp-muda", "↻ " + t("hub_ia_cmp_muda"), muda, (x) => x));
  return box;
}

/* "1,5%" — uma casa decimal, com a vírgula do português */
function hubPct(x) { const v = Math.round((Number(x) || 0) * 10) / 10; return (typeof LANG !== "undefined" && LANG === "en" ? String(v) : String(v).replace(".", ",")) + "%"; }

/* aplica o que estiver marcado; devolve o que fez */
function hubIaAplicar() {
  const c = hubRitmoCtx, sel = hubIaSelecao();
  if (!sel || !c) return null;
  const feito = { meta: 0, modos: 0, fora: 0 };
  if (sel.min) { hubMetaDefinir(sel.min); feito.meta = sel.min; }
  sel.divisao.forEach((x) => { hubModoDefinir(x.disc, x.modo); feito.modos++; });
  if (typeof faTirar === "function") {
    sel.fora.forEach((f) => f.itens.forEach((i) => {
      if (faTirar(Object.assign({}, i, { edital: c.e.id }), "nao_vou")) feito.fora++;
    }));
  }
  try { reg("EDITAL", "resposta da IA aplicada", JSON.stringify(feito)); } catch (e) {}
  try { if ($("dlgHubIA").open) $("dlgHubIA").close(); } catch (e) {}
  try { toastMsg(t("hub_ia_aplicado", { h: feito.meta ? horasTexto(feito.meta) : "-", m: feito.modos, f: feito.fora }), 6000); } catch (e) {}
  hubPintarAgenda();
  return feito;
}

/* "Noções de Direito Administrativo" → "Direito Administrativo" (o nome inteiro fica na dica) */
function hubDiscCurta(d) { return String(d || "").replace(/^no[çc][õo]es\s+(?:b[áa]sicas\s+)?de\s+/i, "").replace(/^no[çc][õo]es\s+/i, ""); }

/* (19.87.0) as sugestões de vínculo entre os editais em andamento (ver vkSugeridos) */
function hubVinculosSugeridos(lista) {
  if (typeof vkSugeridos !== "function" || !lista || lista.length < 2) return [];
  const L = lista.map((e) => {
    let r = null;
    try { r = lerEdital(e.texto || ""); } catch (err) { r = null; }
    const tps = [];
    ((r && r.disciplinas) || []).forEach((d) => (d.topicos || []).forEach((tp) => tps.push({ disciplina: d.nome, nome: tp.nome })));
    return { id: e.id, nome: e.nome || ((r && r.cfg) || {}).concurso || "", topicos: tps };
  });
  let leis = [];
  try { leis = typeof leisLista === "function" ? leisLista().map((l) => ({ id: l.id, nome: l.nome || "", topicos: l.topicos || [] })) : []; } catch (err) { leis = []; }
  return vkSugeridos(L, leis);
}

/* o painel do chip: o que é, os primeiros exemplos e o botão que abre a lista para conferir */
function hubVincPainel(p, sugs) {
  const tx = document.createElement("p");
  tx.className = "hub-vinc-txt";
  const nNome = sugs.filter((s) => s.motivo === "nome").length;
  tx.textContent = t("hub_vinc_explica", { n: sugs.length, a: nNome, b: sugs.length - nNome });
  const ex = document.createElement("ul");
  ex.className = "hub-vinc-ex";
  sugs.slice(0, 3).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = t("hub_vinc_par", { t: s.de.topico, a: s.de.edNome, b: s.para.edNome });
    ex.append(li);
  });
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn-min hub-vinc-rev";
  b.textContent = t("hub_vinc_revisar", { n: sugs.length });
  b.onclick = () => hubVincRevisar(sugs);
  p.append(tx, ex, b);
}

/* a lista para conferir: um quadrinho por par, marcado; o motivo (mesmo nome / a lei) ao lado. Desmarcar = "não é o
 * mesmo assunto", e o par não volta. Cancelar não muda nada. */
async function hubVincRevisar(sugs) {
  const corpo = document.createElement("div");
  corpo.className = "hub-vinc-lista";
  const caixas = [];
  const grupos = {};
  sugs.forEach((s) => { const g = s.de.edNome + " ↔ " + s.para.edNome; (grupos[g] = grupos[g] || []).push(s); });
  Object.keys(grupos).forEach((g) => {
    const h = document.createElement("div");
    h.className = "hub-vinc-grupo";
    h.textContent = g + " (" + grupos[g].length + ")";
    corpo.append(h);
    grupos[g].forEach((s) => {
      const lb = document.createElement("label");
      lb.className = "hub-vinc-item";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true;
      caixas.push({ cb, s });
      const nm = document.createElement("span");
      nm.className = "hub-vinc-nome";
      nm.textContent = s.de.topico === s.para.topico ? s.de.topico : s.de.topico + " ↔ " + s.para.topico;
      nm.title = s.de.disciplina + " › " + s.de.topico + "\n" + s.para.disciplina + " › " + s.para.topico;
      const mt = document.createElement("span");
      mt.className = "hub-vinc-motivo";
      mt.textContent = s.motivo === "lei" ? t("hub_vinc_m_lei", { l: s.lei || "?" }) : t("hub_vinc_m_nome");
      lb.append(cb, nm, mt);
      corpo.append(lb);
    });
  });
  const ok = await uiConfirm(t("hub_vinc_conf"), { corpo, ok: t("hub_vinc_ok") });
  if (!ok) return;
  const marcados = caixas.filter((c) => c.cb.checked).map((c) => c.s);
  const desmarcados = caixas.filter((c) => !c.cb.checked).map((c) => c.s);
  const n = vkSugConfirmar(marcados, desmarcados);
  try { reg("VINC", "sugeridos confirmados", n + " ligados · " + desmarcados.length + " recusados"); } catch (e) {}
  try { toastMsg(t("hub_vinc_feito", { n, r: desmarcados.length }), 2600); } catch (e) {}
  hubPintarAgenda();
}

/* =====================================================================
 * (19.87.0) UM ASSUNTO, UMA LINHA.
 *
 * Com ISS e SEFAZ ativos, a semana 1 trazia 18 pares de linhas que eram o mesmo assunto, já ligados na comparação de
 * editais ("Receita pública" lá e cá) — e as horas dos dois entravam na meta. Agora, se duas linhas de editais
 * diferentes estão ligadas por um vínculo ALTA (não arquivado) e são do mesmo tipo (estudo com estudo, revisão com
 * revisão), fica a primeira na ordem da agenda, com o selo "+ outro edital"; a segunda sai, e o tempo conta uma vez.
 * MEDIA não funde: "provavelmente o mesmo" não basta para tirar uma linha da semana. A MESMA disciplina com o MESMO
 * tópico nos dois editais ("Português › Crase") funde sem vínculo: é a mesma chave.
 * Fundir não marca nada: estudou, registra; o registro oferece marcar o gêmeo, desmarcado (regEspelhoPintar).
 * Devolve quantas linhas saíram.
 * ===================================================================== */
function hubFundirVinculados(linhas) {
  if (typeof vkDaChaveMat !== "function" || !linhas || linhas.length < 2) return 0;
  const par = new Set();
  (typeof vinculos !== "undefined" && Array.isArray(vinculos) ? vinculos : []).forEach((v) => {
    if (vkArquivado(v) || (v.conf || "ALTA") !== "ALTA" || !v.a || !v.b) return;
    par.add(v.a + "|" + v.b);
    par.add(v.b + "|" + v.a);
  });
  const vk = linhas.map((i) => vkDaChaveMat(i.chave || ((i.disciplina || "") + "›" + (i.nome || ""))));
  const fora = new Set();
  for (let x = 0; x < linhas.length; x++) {
    if (fora.has(x)) continue;
    const A = linhas[x];
    for (let y = x + 1; y < linhas.length; y++) {
      if (fora.has(y)) continue;
      const B = linhas[y];
      if (B.edital === A.edital || !!B.ehRevisao !== !!A.ehRevisao) continue;
      /* a MESMA chave (mesma disciplina, mesmo tópico) é o mesmo assunto sem precisar de vínculo */
      if (vk[x] !== vk[y] && !par.has(vk[x] + "|" + vk[y])) continue;
      if ((A.tambem || []).some((o) => o.edital === B.edital)) continue;
      A.tambem = (A.tambem || []).concat([{ edital: B.edital, editalNome: B.editalNome, chave: B.chave, disciplina: B.disciplina, nome: B.nome }]);
      fora.add(y);
    }
  }
  if (!fora.size) return 0;
  const ficam = linhas.filter((_, k) => !fora.has(k));
  linhas.length = 0;
  ficam.forEach((i) => linhas.push(i));
  return fora.size;
}

/* a ordem das linhas da agenda: em andamento → posição no rodízio (dividida pela urgência) → peso. (19.47.0) A revisão
 * já vem na frente DENTRO da disciplina dela (montarPlano); passá-la à frente de tudo aqui desfazia o rodízio. */
function hubOrdemAgenda(a, b) {
  return (b.andamento ? 1 : 0) - (a.andamento ? 1 : 0)
    || ((a.ordemFila || 999) / (a.urgencia || 1))
       - ((b.ordemFila || 999) / (b.urgencia || 1))
    || b.ordem - a.ordem;
}

/* Um só lugar mostra a semana. Quando a pessoa está dentro de um edital,
 * ela às vezes quer ver só aquele — mas isso é um FILTRO da mesma lista, e
 * não uma segunda lista com outro número. */
/* QUEM ESTÁ NA VISTA AGORA — um lugar só.
 * O cabeçalho, a soma de horas e a lista precisam concordar sobre isso;
 * cada um calculando por conta própria é como nasceram os 40 contra 44. */
/* ---------------- FILTRO DE DISCIPLINA ----------------
 * Guardado por NOME de disciplina, não por índice: o plano muda de
 * ordem a cada semana, e índice guardado passaria a apontar para outra
 * matéria sem avisar. Guarda-se o que foi ESCONDIDO, não o que foi
 * escolhido — assim disciplina nova entra visível por padrão, em vez de
 * nascer oculta porque não estava na lista do dia em que se filtrou. */
const HUB_DISC_OCULTAS = "eac_agenda_disc_ocultas";

/* O REGISTRO É PARA DIAGNÓSTICO, NÃO PARA CONTABILIDADE DE CLIQUE.
 *
 * Ele guarda as últimas 200 ações e é a ferramenta para descobrir por
 * que algo falhou. Escolher quais disciplinas ver é um gesto de UMA
 * intenção feito com MUITOS cliques: num despejo real apareceram
 * dezesseis "esconder X" em trinta segundos, ocupando 8% do registro
 * inteiro e empurrando para fora eventos que importavam.
 *
 * Então o filtro grava o RESULTADO, não cada toque: espera a mão parar
 * e anota uma linha com o que ficou. */
let hubDiscTimer = null;

function hubRegistrarFiltro(todas) {
  if (hubDiscTimer) clearTimeout(hubDiscTimer);
  hubDiscTimer = setTimeout(() => {
    hubDiscTimer = null;
    const ocultas = hubDiscOcultas();
    const vis = (todas || []).filter((d) => ocultas.indexOf(d) < 0);
    reg("EDITAL", "filtro de disciplina na agenda",
        vis.length + " de " + (todas || []).length + " em vista"
        + (vis.length && vis.length <= 4 ? ": " + vis.join(", ") : ""));
  }, 1200);
}

function hubDiscOcultas() {
  try {
    const v = JSON.parse(localStorage.getItem(HUB_DISC_OCULTAS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function hubDiscOcultasGravar(lista) {
  try { localStorage.setItem(HUB_DISC_OCULTAS, JSON.stringify(lista || [])); }
  catch (e) {}
}
/* ESCONDER TUDO É UM PASSO INTERMEDIÁRIO, NÃO UM ESTADO.
 * Quem quer ver só uma disciplina de dezessete não vai clicar em
 * dezesseis: clica em "desmarcar todas" e depois na que quer. Entre um
 * clique e outro a agenda fica legitimamente vazia — e precisa dizer
 * isso, em vez de se desfazer sozinha e devolver as dezessete. */
function hubDiscTudoOculto(todas) {
  const ocultas = hubDiscOcultas();
  return !!(todas || []).length && (todas || []).every((d) => ocultas.indexOf(d) >= 0);
}

function hubDiscEscolhidas(todas) {
  const ocultas = hubDiscOcultas();
  return (todas || []).filter((d) => ocultas.indexOf(d) < 0);
}

/* UMA LINHA FECHADA, NÃO UMA NUVEM.
 *
 * Dezessete disciplinas viravam dezessete pílulas empilhadas — mais
 * alto que a própria agenda, e impossível de varrer com o olho. Agora
 * o filtro é uma linha só: "disciplinas (3 de 17) ▾". Aberto, mostra
 * a mesma lista com busca; fechado, some.
 *
 * O estado (aberto/fechado) vive em memória e não é gravado: abrir o
 * app com o filtro escancarado, porque uma vez foi aberto, seria o
 * mesmo problema de volta. */
let hubDiscAberto = false;
let hubDiscBusca = "";

function hubFiltroDisciplina(todas) {
  if (!todas || todas.length < 2) return null;
  const ocultas = hubDiscOcultas();
  const visiveis = hubDiscEscolhidas(todas);

  const caixa = document.createElement("div");
  caixa.className = "ed-disc-caixa";

  const cabeca = document.createElement("button");
  cabeca.type = "button";
  cabeca.className = "btn-min ed-disc-cabeca";
  cabeca.textContent = t("hub_ag_disc_resumo",
    { n: visiveis.length, t: todas.length }) + (hubDiscAberto ? " ▴" : " ▾");
  cabeca.title = t("hub_ag_disc_resumo_ajuda");
  cabeca.onclick = () => { hubDiscAberto = !hubDiscAberto; hubPintarAgenda(); };
  caixa.append(cabeca);

  if (!hubDiscAberto) return caixa;

  const cx = document.createElement("div");
  cx.className = "ed-agenda-filtro ed-ag-disc";

  /* BUSCA: com dezessete nomes, achar "Direito Processual Civil" no
   * meio é mais rápido digitando três letras do que varrendo a lista. */
  const busca = document.createElement("input");
  busca.type = "text";
  busca.className = "ed-disc-busca";
  busca.placeholder = t("hub_ag_disc_busca");
  busca.value = hubDiscBusca;
  busca.oninput = () => {
    hubDiscBusca = busca.value;
    hubPintarAgenda();
    const b2 = document.getElementById("edAgendaTopo");
    const campo = b2 && b2.querySelector ? null : null;
    if (campo) campo.focus();
  };
  cx.append(busca);

  const semAcento = (x) => String(x || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const alvo = semAcento(hubDiscBusca).trim();
  /* ORDEM ALFABÉTICA AQUI DENTRO, e não a da agenda.
   * Na agenda a ordem é por prioridade, que é o que decide o que
   * estudar. Numa lista para ACHAR uma disciplina, prioridade parece
   * ordem aleatória: procura-se por nome, então ordena-se por nome. */
  const ordenadas = todas.slice().sort((a2, b2) =>
    semAcento(a2).localeCompare(semAcento(b2)));
  const mostrar = alvo
    ? ordenadas.filter((d) => semAcento(d).indexOf(alvo) >= 0) : ordenadas;

  if (!mostrar.length) {
    const vz = document.createElement("span");
    vz.className = "ed-ag-disc-rot";
    vz.textContent = t("hub_ag_disc_nada", { q: hubDiscBusca });
    cx.append(vz);
  }

  mostrar.forEach((d) => {
    const on = ocultas.indexOf(d) < 0;
    const b = document.createElement("button");
    b.type = "button";
    /* classe própria: "todo botão dentro do filtro" incluía o
     * "desmarcar todas" e o "mostrar todas", que não são disciplinas.
     * Sem separar, qualquer botão novo na barra quebra quem conta. */
    b.className = "ed-ag-opt ed-ag-disc-b" + (on ? " ativa" : "");
    /* marca de escolha ANTES do nome: com os nomes cortados por
     * reticências, a cor sozinha exigia comparar tons entre colunas */
    b.textContent = (on ? "\u2713 " : "\u00a0\u00a0 ") + d;
    b.title = (on ? t("hub_ag_disc_esconder", { d }) : t("hub_ag_disc_mostrar", { d }))
      + " \u2014 " + d;
    b.onclick = () => {
      const lista = hubDiscOcultas();
      const k = lista.indexOf(d);
      if (k >= 0) lista.splice(k, 1); else lista.push(d);
      hubDiscOcultasGravar(lista);
      hubPintarAgenda();
      hubRegistrarFiltro(todas);
    };
    cx.append(b);
  });

  /* as duas ações gerais numa faixa própria, embaixo da grade */
  const acoes = document.createElement("div");
  acoes.className = "ed-disc-acoes";

  const nenhuma = document.createElement("button");
  nenhuma.type = "button";
  nenhuma.className = "btn-min";
  nenhuma.textContent = t("hub_ag_disc_nenhuma");
  nenhuma.title = t("hub_ag_disc_nenhuma_ajuda");
  nenhuma.onclick = () => {
    hubDiscOcultasGravar(todas.slice());
    hubPintarAgenda();
    hubRegistrarFiltro(todas);
  };
  acoes.append(nenhuma);

  if (ocultas.length) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min";
    b.textContent = t("hub_ag_disc_todas");
    b.title = t("hub_ag_disc_todas_ajuda");
    b.onclick = () => {
      hubDiscOcultasGravar([]);
      hubPintarAgenda();
      hubRegistrarFiltro(todas);
    };
    acoes.append(b);
  }
  cx.append(acoes);
  caixa.append(cx);
  return caixa;
}

/* dispensados DESTA semana, em minutos */
function faDispensadosDaSemana() {
  if (typeof faDispensados !== "function") return 0;
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
  return faDispensados().reduce((a, d) => {
    const q = d.q ? new Date(d.q) : null;
    if (!q || q < ini) return a;
    return a + (Number(d.minutos) || 0);
  }, 0);
}

/* Quem mais precisa saber quais editais estão em vista: o medidor de
 * horas da semana, que somaria as horas de um concurso escondido e daria
 * um total que não corresponde ao que está na tela. */
function hubEditaisNaVista() {
  const ativos = editais.filter((e) => edSituacao(e).grupo !== "encerrado");
  const vis = ativos.filter((e) => hubEdVisivel(e.id));
  return vis.length ? vis : ativos;
}

/* FILTRO POR EDITAL — escolher QUAIS, não "todos ou o aberto".
 *
 * A versão anterior tinha dois problemas que se somavam:
 *
 *  · ela só existia quando havia um edital ABERTO. Na tela da agenda,
 *    que é onde a semana é lida, normalmente não há nenhum aberto — e o
 *    filtro simplesmente não aparecia;
 *  · e quando aparecia, oferecia "todos" ou "só o aberto". Com três
 *    concursos, "ver o TCE e a SEFAZ mas não o ISS" era impossível.
 *
 * Como o filtro de DISCIPLINA se alimenta das linhas que sobraram, ele
 * era arrastado junto: sem conseguir isolar um edital, não havia como
 * ver só as disciplinas dele.
 *
 * Agora é uma escolha por edital, guardada entre sessões — a agenda é a
 * primeira tela do dia, e refazer a filtragem toda manhã é o tipo de
 * atrito que faz a pessoa parar de usar o filtro. */
const HUB_ED_OCULTOS = "eac_ag_editais_ocultos";
let hubEdOcultos = null;

function hubEdOcultosLer() {
  if (hubEdOcultos) return hubEdOcultos;
  try {
    const v = JSON.parse(localStorage.getItem(HUB_ED_OCULTOS) || "[]");
    hubEdOcultos = Array.isArray(v) ? v : [];
  } catch (e) { hubEdOcultos = []; }
  return hubEdOcultos;
}

function hubEdOcultosGravar() {
  try { localStorage.setItem(HUB_ED_OCULTOS, JSON.stringify(hubEdOcultos || [])); }
  catch (e) {}
}

function hubEdVisivel(id) { return hubEdOcultosLer().indexOf(String(id)) < 0; }

function hubEdAlternar(id) {
  const k = String(id);
  hubEdOcultosLer();
  const i = hubEdOcultos.indexOf(k);
  if (i >= 0) hubEdOcultos.splice(i, 1); else hubEdOcultos.push(k);
  hubEdOcultosGravar();
}

/* ESCONDER TODOS OS EDITAIS É ESCONDER A AGENDA.
 * Diferente do filtro de disciplina, aqui não há nada útil no estado
 * "nenhum": a tela ficaria vazia sem que nada estivesse errado. O último
 * visível recusa ser desmarcado, e o botão diz por quê. */
function hubEdSoUmVisivel(todos) {
  return (todos || []).filter((e) => hubEdVisivel(e.id)).length <= 1;
}

function hubFiltroEdital(todos) {
  if (!todos || todos.length < 2) return null;
  const cx = document.createElement("div");
  cx.className = "ed-agenda-filtro ed-ag-editais";

  todos.forEach((e) => {
    const on = hubEdVisivel(e.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-ag-opt" + (on ? " ativa" : "");
    b.textContent = (on ? "✓ " : "") + e.nome;
    const ultimo = on && hubEdSoUmVisivel(todos);
    b.title = ultimo ? t("hub_ag_ed_ultimo") : t("hub_ag_ed_ajuda", { n: e.nome });
    b.onclick = () => {
      if (ultimo) { try { uiAlert(t("hub_ag_ed_ultimo")); } catch (x) {} return; }
      hubEdAlternar(e.id);
      hubPintarAgenda();
    };
    cx.append(b);
  });

  const escondidos = todos.filter((e) => !hubEdVisivel(e.id)).length;
  if (escondidos) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-ag-opt ed-ag-opt-todas";
    b.textContent = t("hub_ag_ed_todos", { n: escondidos });
    b.onclick = () => { hubEdOcultos = []; hubEdOcultosGravar(); hubPintarAgenda(); };
    cx.append(b);
  }
  return cx;
}

/* ------------------------------------------------------------------
 * PREFERÊNCIA DE ESTUDO — global, não do edital
 *
 * "Dias por semana" e "começo do dia" descrevem a rotina da PESSOA, não o
 * concurso. Guardar isso dentro de cada edital produziria três respostas
 * diferentes para a mesma pergunta ("a que horas eu estudo?") e a agenda,
 * que junta os três, teria de escolher uma — arbitrariamente.
 * ------------------------------------------------------------------ */
const HUB_PREF = { dias: "eac_estudo_dias", inicio: "eac_estudo_inicio" };

function hubPref(qual, padrao) {
  try {
    const v = localStorage.getItem(HUB_PREF[qual]);
    if (v === null || v === "") return padrao;
    return qual === "dias" ? Math.max(1, Math.min(7, Number(v) || padrao)) : v;
  } catch (e) { return padrao; }
}

function hubPrefGravar(qual, valor) {
  try { localStorage.setItem(HUB_PREF[qual], String(valor)); } catch (e) {}
  /* os campos da bancada mostram a mesma coisa: dois lugares exibindo o
   * mesmo número acabam discordando se um não seguir o outro */
  const campo = document.getElementById(qual === "dias" ? "edDias" : null);
  if (campo && campo.value !== String(valor)) campo.value = valor;
  reg("EDITAL", "rotina de estudo alterada", qual + " = " + valor);
}

function hubControlesAgenda() {
  const cx = document.createElement("div");
  cx.className = "ed-agenda-cfg";

  const ld = document.createElement("label");
  ld.className = "ed-agenda-cfg-item";
  ld.append(document.createTextNode(t("hub_cfg_dias")));
  const dias = document.createElement("input");
  dias.type = "number"; dias.min = "1"; dias.max = "7"; dias.step = "1";
  dias.value = String(hubPref("dias", 5));
  dias.onchange = () => {
    hubPrefGravar("dias", Math.max(1, Math.min(7, Number(dias.value) || 5)));
    hubPintarAgenda();
    if (typeof edRender === "function" && edAberto()) edRender();
  };
  ld.append(dias);

  /* HORAS POR SEMANA, SÓ PARA VER.
   * O horário de início saiu: ninguém estuda às 05:40 porque uma divisão
   * mandou, e o número dava ao plano uma precisão que ele não tem.
   * No lugar dele, a informação que de fato governa a agenda — as horas
   * semanais. Aqui é VISTA, não campo: quem manda nelas é o planejamento
   * de cada edital, e ter dois lugares editando o mesmo número é como se
   * criam os dois números que discordam. */
  /* AS HORAS DE QUEM ESTÁ NA AGENDA, E DITO QUANTOS SÃO.
   *
   * Este número somava TODOS os editais ativos enquanto o painel "Plano
   * de estudo" mostrava as horas de UM. Dois números na mesma tela,
   * 40 e 44, sem nada explicando a diferença — parecia erro de conta.
   * Não era: eram perguntas diferentes com a mesma cara. Agora ele
   * segue o filtro (com um edital em vista, bate com o painel) e diz
   * de quantos editais está falando quando é mais de um. */
  const lh = document.createElement("div");
  lh.className = "ed-agenda-cfg-item ed-agenda-horas";
  const usados = hubEditaisNaVista();
  const totalH = usados.reduce(
    (s2, e) => s2 + ((lerEdital(e.texto || "").cfg || {}).horas || 0), 0);
  lh.textContent = usados.length > 1
    ? t("hub_cfg_horas_n", { h: totalH, n: usados.length })
    : t("hub_cfg_horas", { h: totalH });
  /* (19.79.0) COM O RITMO REAL OU UMA META PRÓPRIA EM USO, o topo diz o número que a agenda está usando — "54 h/semana"
   * continuava ali depois de "planejar com 13h19/semana", e a agenda já era de 13h19 */
  let usadoMin = 0, usadoMeta = false;
  try {
    const mt = hubMetaMin();
    const rr = hubRitmoReal();
    usadoMeta = mt > 0;
    usadoMin = mt || (hubRitmoRealLigado() && rr.ref > 0 ? rr.ref : 0);
  } catch (e) { usadoMin = 0; }
  if (usadoMin) {
    lh.textContent = t("hub_cfg_horas_usando", { r: horasTexto(usadoMin), q: t(usadoMeta ? "hub_cfg_q_meta" : "hub_cfg_q_ritmo"), h: totalH });
    lh.classList.add("ed-agenda-horas-usando");
    lh.title = t("hub_cfg_horas_usando_ajuda", { r: horasTexto(usadoMin), h: totalH });
  } else lh.title = usados.length > 1
    ? t("hub_cfg_horas_n_ajuda", {
        lista: usados.map((e) => (e.nome || "?") + " "
          + ((lerEdital(e.texto || "").cfg || {}).horas || 0) + "h").join(" + ") })
    : t("hub_cfg_horas_ajuda");

  /* O RAIO-X, ao lado dos numeros que ele explica. Discreto de
   * proposito: nao e uma acao de estudo, e a resposta a "por que isto
   * e nao aquilo" — pergunta que so aparece depois de olhar a lista. */
  const raio = document.createElement("button");
  raio.type = "button";
  raio.id = "btnPlogAbrir";
  raio.className = "ed-agenda-cfg-item plog-gatilho";
  raio.textContent = t("plog_gatilho");
  raio.title = t("plog_gatilho_aj");
  raio.onclick = () => { if (typeof plAbrir === "function") plAbrir(); };

  cx.append(ld, lh, raio);
  return cx;
}

/* ------------------------------------------------------------------
 * A LISTA DE EDITAIS
 * ------------------------------------------------------------------ */
function hubPintarLista() {
  const box = document.getElementById("hubLista");
  if (!box) return;
  box.innerHTML = "";

  const grupos = edAgrupados(hubFiltro);
  const total = grupos.proximo.length + grupos.sem_data.length + grupos.encerrado.length;

  if (!total) {
    const p = document.createElement("div");
    p.className = "esq-vazio";
    p.textContent = editais.length ? t("hub_nada_no_filtro") : t("hub_vazio");
    box.append(p);
    return;
  }

  [["proximo", "hub_g_proximo", "hub_g_proximo_sub"],
   ["sem_data", "hub_g_semdata", "hub_g_semdata_sub"],
   ["encerrado", "hub_g_encerrado", "hub_g_encerrado_sub"]].forEach(([k, tk, sk]) => {
    const lista = grupos[k];
    if (!lista.length) return;
    const g = document.createElement("div");
    g.className = "hub-grupo hub-" + k;
    const h = document.createElement("div");
    h.className = "hub-grupo-tit";
    h.textContent = t(tk, { n: lista.length });
    const s = document.createElement("div");
    s.className = "hub-grupo-sub";
    s.textContent = t(sk);
    g.append(h, s);
    lista.forEach((e) => g.append(hubCartao(e)));
    box.append(g);
  });
}

function hubCartao(e) {
  const c = document.createElement("div");
  c.className = "hub-card hub-card-" + e.sit.grupo;

  const topo = document.createElement("div");
  topo.className = "hub-card-topo";
  const nome = document.createElement("button");
  nome.type = "button";
  nome.className = "hub-card-nome";
  nome.textContent = e.nome;
  nome.onclick = () => hubAbrirEdital(e.id);
  topo.append(nome);

  const prazo = document.createElement("span");
  prazo.className = "hub-prazo hub-prazo-" + e.sit.grupo;
  if (e.sit.grupo === "encerrado") {
    prazo.textContent = t("hub_prazo_ha_dias", { n: e.sit.desde });
  }
  else if (e.sit.dias === null) prazo.textContent = t("hub_prazo_sem");
  else prazo.textContent = t("hub_prazo_dias", { n: e.sit.dias });
  topo.append(prazo);
  c.append(topo);

  const info = document.createElement("div");
  info.className = "hub-card-info";
  info.textContent = t("hub_card_info", {
    d: e.disciplinas, t: e.topicos, p: e.pct,
  });
  c.append(info);

  const ba = document.createElement("div");
  ba.className = "hub-barra";
  const fill = document.createElement("div");
  fill.className = "hub-barra-fill";
  fill.style.width = e.pct + "%";
  ba.append(fill);
  c.append(ba);

  const acoes = document.createElement("div");
  acoes.className = "hub-acoes";
  const bAbrir = document.createElement("button");
  bAbrir.type = "button"; bAbrir.className = "btn-min";
  bAbrir.textContent = t("hub_abrir");
  bAbrir.onclick = () => hubAbrirEdital(e.id);
  /* "duplicar" saiu do cartão na v8.81, a pedido de quem usa.
   * Ele nasceu supondo um caso — "quero variar o mesmo edital" — que não
   * aparece: dois concursos diferentes têm editais diferentes, e o mesmo
   * concurso não precisa de cópia. Na prática ele só criava um segundo
   * edital com o mesmo nome, que depois disputava a agenda com o original.
   * A função edDuplicar continua existindo e testada — quem quiser pode
   * chamá-la —, mas ela não ocupa mais espaço na tela nem convida ao erro. */
  const bDel = document.createElement("button");
  bDel.type = "button"; bDel.className = "btn-min btn-min-perigo";
  bDel.textContent = t("hub_apagar");
  bDel.onclick = () => {
    /* apagar edital leva junto meses de progresso marcado, e progresso não
     * se refaz colando texto. O aviso diz o número, não só "tem certeza" */
    if (!confirm(t("hub_apagar_conf", { n: e.nome, f: e.feitos }))) return;
    reg("EDITAL", "edital apagado", e.nome + " (" + e.feitos + " marcados)");
    edApagar(e.id); hubRender();
  };
  acoes.append(bAbrir, bDel);
  c.append(acoes);
  return c;
}

/* ------------------------------------------------------------------
 * NAVEGAÇÃO ENTRE O HUB E A BANCADA
 * ------------------------------------------------------------------ */
function hubAbrirEdital(id) {
  /* grava o que estava aberto ANTES de trocar. Foi a ausência exata deste
   * passo que apagou 137 cartões: a troca de contexto sem salvar. */
  hubGravarAberto();
  const e = edAbrir(id);
  if (!e) return;
  const ta = document.getElementById("editalTexto");
  if (ta) ta.value = e.texto || "";
  /* A BANCADA PASSA A SER DESTE EDITAL. É este passo — carregar o texto
   * — que cria o par; marcá-lo aqui é o que permite às gravações
   * seguintes saberem de quem é o que está na tela. */
  if (typeof edMarcarDonoDoTexto === "function") edMarcarDonoDoTexto(e.id);
  /* o progresso é POR EDITAL: sem trocar aqui, marcar um tópico no TCU
   * apareceria marcado no TCE-PE */
  if (typeof edProgresso !== "undefined") edProgresso = e.progresso || {};
  try {
    localStorage.setItem("eac_edital_texto", e.texto || "");
    localStorage.setItem("eac_edital_progresso", JSON.stringify(e.progresso || {}));
  } catch (x) {}
  /* edital que já tem conteúdo abre recolhido: quem volta a um edital
   * cadastrado quer ver o plano, não colar de novo. Vazio abre aberto,
   * porque aí colar É o que falta fazer. */
  bancRecolhida = !!(e.texto && e.texto.trim());
  bancAplicar();
  reg("EDITAL", "edital aberto", e.nome);
  hubRender();
  if (typeof edRender === "function") edRender();
}

/* (19.56.0) "conferir no edital" LEVA ATÉ A CONFERÊNCIA. Antes só abria o edital — e, com ele já aberto, nada parecia
 * acontecer: a caixa ficava mais abaixo, fora da tela. Agora abre (se preciso), rola até a caixa e a destaca; sem a
 * caixa à vista, abre direto a janela "Como a prova pontua". */
function hubConferir(id) {
  try { const a0 = edAberto(); if (!a0 || a0.id !== id) hubAbrirEdital(id); } catch (e) {}
  const ir = () => {
    const cx = document.getElementById("edConferencia");
    if (cx && !cx.hidden) {
      try { cx.scrollIntoView({ block: "center" }); } catch (e) { try { cx.scrollIntoView(); } catch (e2) {} }
      if (cx.classList) { cx.classList.remove("ed-conf-flash"); void cx.offsetWidth; cx.classList.add("ed-conf-flash"); setTimeout(() => { try { cx.classList.remove("ed-conf-flash"); } catch (e) {} }, 2200); }
      return true;
    }
    if (typeof epAbrir === "function") return epAbrir();
    return false;
  };
  try { reg("EDITAL", "conferir no edital (pela agenda)", String(id)); } catch (e) {}
  /* depois de o edital terminar de desenhar (abrir repinta a tela e devolveria a rolagem ao topo) */
  if (typeof setTimeout === "function") { setTimeout(ir, 60); return true; }
  return ir();
}

function hubVoltar() {
  hubGravarAberto();
  edAbrir(null);
  hubRender();
}

/* grava o que está na bancada de volta no edital aberto. Chamado antes de
 * sair: sem isto, editar e voltar perde o texto — o mesmo tipo de perda
 * silenciosa que custou 137 cartões. */
function hubGravarAberto() {
  const e = edAberto();
  if (!e) return;
  const ta = document.getElementById("editalTexto");
  /* A MESMA REGRA DO edSalvar, pela mesma função. Este caminho roda ao
   * TROCAR de edital — exatamente quando o texto da bancada e o edital
   * aberto têm mais chance de não combinarem. */
  const txt = ta ? ta.value : "";
  if (typeof edPodeGravarNo === "function" && !edPodeGravarNo(e, txt).ok) {
    try {
      reg("EDITAL", "gravacao recusada ao trocar de edital",
          "aberto: " + e.nome);
    } catch (x) {}
    return;
  }
  if (ta) e.texto = txt;
  try {
    e.progresso = JSON.parse(localStorage.getItem("eac_edital_progresso") || "{}");
  } catch (x) {}
  const cfg = (lerEdital(e.texto || "").cfg) || {};
  if (cfg.concurso && (!e.nome || e.nome === "Novo edital")) e.nome = cfg.concurso;
  e.tocado = new Date().toISOString();
  edSalvarLista();
}

/* ---------------------------------------------------------------------
 * NOVO EDITAL — uma caixa com o que o plano precisa para existir.
 *
 * Antes: um prompt() do navegador pedindo o nome, e um edital vazio. A
 * pessoa era largada numa bancada em branco tendo de descobrir sozinha
 * onde se põe a data da prova, onde se dizem as horas por semana e qual
 * é o formato das disciplinas — três coisas que o app já sabe pedir, e
 * sem as quais o plano não calcula nada.
 *
 * A caixa nasce com um nome escrito e a data em branco: nome é o que dá
 * para chutar (e trocar depois), data é o que não dá.
 * ------------------------------------------------------------------ */
function hubNovo() {
  hubNovoCruOriginal = null;
  const dlg = document.getElementById("dlgEdNovo");
  if (!dlg) {   /* sem a caixa, o caminho antigo ainda cria o edital */
    hubGravarAberto();
    const e0 = edCriar(t("hub_novo_padrao"), "");
    reg("EDITAL", "edital criado", e0.nome);
    hubAbrirEdital(e0.id);
    return;
  }
  const v = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.value = valor;
  };
  v("edNovoNome", "");
  v("edNovoProva", ""); v("edNovoHoras", "20");
  ["edNovoModoData", "edNovoModoSem", "edNovoModoPre"].forEach((id) => { const r = document.getElementById(id); if (r) r.checked = false; });
  hubNovoPreencherSeletores();
  hubNovoTocado = false;
  v("edNovoF2Nome", ""); v("edNovoF2Prova", ""); v("edNovoPlano", "");
  const f2 = document.getElementById("edNovoF2cx"), f2on = document.getElementById("edNovoF2On");
  if (f2) f2.hidden = true;
  if (f2on) f2on.checked = false;
  const pr = document.getElementById("edNovoPedirRamos");
  if (pr) pr.checked = false;
  const pm = document.getElementById("edNovoPromptMsg");
  if (pm) pm.textContent = "";
  const conf = document.getElementById("edNovoConf");
  if (conf) conf.textContent = "";
  const p1 = document.getElementById("edNovoPasso1"), p2 = document.getElementById("edNovoPasso2");
  if (p1) p1.className = "ednovo-passo";
  if (p2) p2.className = "ednovo-passo";
  hubNovoPintar();
  abrirModal("dlgEdNovo");
  const nome = document.getElementById("edNovoNome");
  if (nome && nome.select) { try { nome.focus(); nome.select(); } catch (e) {} }
}

/* O prompt do edital para a IA. Com `comRamos`, ganha o bloco de regras de ramificação ("++ Ramo :: peso :: nota"),
 * numerado a seguir à última regra e colocado ANTES do exemplo/do edital — sem a caixa, é o ed_prompt de sempre. O ponto de
 * inserção é o primeiro "\n\nEXEMPLO DE SAÍDA:" / "\n\nSYLLABUS:" / "\n\nEDITAL:", que existem nos dois idiomas. */
function edPromptEdital(comRamos, textoDoEdital, opcDisc) {
  let out = t("ed_prompt");
  const corte = out.search(/\n\n(?:EXEMPLO DE SAÍDA|SYLLABUS|EDITAL):/);
  if (comRamos && corte >= 0) {
    let n = 0;
    out.slice(0, corte).replace(/(?:^|\n)(\d+)\./g, (m, d) => { n = Math.max(n, Number(d)); return m; });
    out = out.slice(0, corte) + "\n" + t("ed_prompt_ramos", { n: n + 1 }) + out.slice(corte);
  }
  /* (19.57.0) a regra da discursiva, depois da última — só quando o plano ainda não tem a linha "# discursiva" */
  if (corte >= 0 && opcDisc && !opcDisc.tem) {
    const c2 = out.search(/\n\n(?:EXEMPLO DE SAÍDA|SYLLABUS|EDITAL):/);
    let n2 = 0;
    out.slice(0, c2).replace(/(?:^|\n)(\d+)\./g, (m, d) => { n2 = Math.max(n2, Number(d)); return m; });
    out = out.slice(0, c2) + "\n" + t("ed_prompt_disc", { n: n2 + 1 }) + out.slice(c2);
  }
  /* com o texto do edital na mão, ele já vai DENTRO do prompt, no lugar do "[cole aqui o edital]" */
  if (textoDoEdital) out = out.replace(/\[cole aqui o edital\]|\[paste the syllabus here\]/, () => textoDoEdital);
  return out;
}

/* O pedido de REVISÃO (Y3): o plano já existe e a IA corrige pesos, motivos e a divisão dos tópicos. Montado a partir do MESMO
 * bloco "FORMATO + REGRAS" do ed_prompt — assim as regras novas (ramos, optativas, "90p não é por disciplina") entram nos dois
 * pedidos sem se separarem. Só os achados que a IA pode resolver entram (edAchadosParaIA); o plano atual vai no fim. */
function edPromptRevisao(textoPlano, achados) {
  const base = t("ed_prompt");
  const ini = base.search(/\n\n(?:FORMATO|FORMAT)\b/);
  const fim = base.search(/\n\n(?:EXEMPLO DE SAÍDA|SYLLABUS|EDITAL):/);
  const miolo = ini >= 0 && fim > ini ? base.slice(ini + 2, fim) : "";
  let n = 0;
  miolo.replace(/(?:^|\n)(\d+)\./g, (m, d) => { n = Math.max(n, Number(d)); return m; });
  const itens = edAchadosParaIA(achados).map((a, k) => (k + 1) + ". " + (a.grave ? "[GRAVE] " : "") + (a.msg || t(a.chave, a.params || {})));
  const L = [t("ed_prompt_rev_cab"), ""];
  if (itens.length) L.push(t("ed_prompt_rev_achados"), itens.join("\n"), "");
  /* (19.57.0) a discursiva: com a linha no plano, mantê-la; sem ela, só incluir se o texto colado trouxer a discursiva */
  L.push(miolo, t("ed_prompt_rev_regra", { n: n + 1 }), edRegraDiscursiva(textoPlano, n + 2), "", t("ed_prompt_rev_plano"), String(textoPlano || ""), "", t("ed_prompt_onde"));
  return L.join("\n");
}

/* (19.76.0) a regra da discursiva nos pedidos de revisão, conforme o plano: com/sem a linha "# discursiva" e com/sem a
 * discursiva em data própria ("# fase 2"). Na data própria, a IA mantém a data e a linha da fase 2, e a linha da
 * discursiva leva só o formato (sem data). */
function edRegraDiscursiva(textoPlano, n) {
  const tx = String(textoPlano || "");
  const temDisc = /^\s*#\s*discursiva\b/im.test(tx);
  let f2 = null;
  try { const c = lerEdital(tx).cfg || {}; if (c.fase2 && c.fase2.prova) f2 = { d: c.fase2.prova.split("-").reverse().join("/"), o: c.prova ? c.prova.split("-").reverse().join("/") : "?" }; } catch (e) {}
  if (f2) return t(temDisc ? "ed_prompt_rev_disc_manter_f2" : "ed_prompt_rev_disc_f2", { n, d: f2.d, o: f2.o });
  return t(temDisc ? "ed_prompt_rev_disc_manter" : "ed_prompt_rev_disc", { n });
}

/* (19.60.0) O PEDIDO SÓ DE PESOS. Quanto cada disciplina vale na agenda vem do peso DELA (1 a 5 ou "10q"); o peso dos
 * tópicos só ordena dentro dela. Então a revisão dos pesos não precisa do plano inteiro: vão as linhas "#", "&" e "@" e,
 * para a IA estimar quando o edital não traz números, quantos tópicos cada disciplina tem. Pedido de ~3 mil caracteres em
 * vez de ~35 mil, resposta de ~15 linhas em vez de ~250. A resposta é MESCLADA ao plano (edMesclarPesos), nunca o
 * substitui: os tópicos não vão e não voltam. */
function edPromptSoPesos(textoPlano) {
  const r = lerEdital(String(textoPlano || ""));
  const linhas = String(textoPlano || "").split(/\r?\n/).filter((l) => /^\s*[&@]/.test(l) || /^\s*#\s*discursiva\b/i.test(l) || /^\s*#\s*fase\s*2\s*:/i.test(l))
    .map((l) => l.trim());
  const temDisc = !!(r.cfg && r.cfg.discursiva);
  const tam = r.disciplinas.filter((d) => !d.inativa).map((d) => {
    const ps = d.topicos.map((tp) => tp.peso || 3);
    const media = ps.length ? (ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(1).replace(".", ",") : "-";
    return t("ed_pp_tam", { d: d.nome, n: d.topicos.length, m: media });
  });
  const L = [t("ed_pp_cab"), "", t("ed_pp_formato"), "", t("ed_pp_regras"),
    t("ed_pp_r1"), t("ed_pp_r2"), t("ed_pp_r3"), t("ed_pp_r4"),
    edRegraDiscursiva(textoPlano, 5), t("ed_pp_r6"), "",
    t("ed_pp_atual"), linhas.join("\n"), "", t("ed_pp_tam_tit"), tam.join("\n"), "",
    t("ed_pp_edital"), "", t("ed_pp_onde")];
  return L.join("\n");
}

/* =====================================================================
 * O CAMPO "RESPOSTA DA IA" COMO SEMÁFORO — a estratégia visual contra o erro de colar a coisa errada.
 *
 *  · a cor tem um significado só, em todo o diálogo: cinza = ainda vazio, VERDE = entendi, ÂMBAR = dá, mas confira,
 *    VERMELHO = o app não cria com isto;
 *  · o app mostra o que ENTENDEU (um chip por disciplina) ANTES de criar — nomes de exemplo do prompt saltam aos olhos;
 *  · "Antes de criar": nome, data e plano, cada um com o seu sinal, no mesmo lugar do botão.
 * ===================================================================== */
function hubNovoEstadoPlano(txt) {
  /* o cabeçalho ("#") é do app, não da resposta da IA: só o resto conta */
  const corpo = String(txt || "").split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n");
  const base = { estado: "vazio", d: 0, t: 0, r: 0, ign: 0, rep: 0, sem: 0, disc: [], nomes: [] };
  if (!corpo.trim()) return base;
  const r = lerEdital("# x\n" + corpo);
  const ach = r.achados || [];
  const cont = (tipo) => ach.filter((a) => a.tipo === tipo).length;
  /* o mesmo nome escrito duas vezes é UMA disciplina (com a soma dos tópicos e quantas vezes apareceu) */
  const disc = edAgruparDisciplinas(r).map((g) => ({
    nome: g.nome, topicos: g.topicos, vezes: g.vezes,
    modelo: edNomeDeModelo(g.nome) || (r.disciplinas || []).some((d) => edNormalizar(d.nome) === edNormalizar(g.nome) && d.topicos.some((x) => edNomeDeModelo(x.nome))),
  }));
  const info = Object.assign(base, {
    d: disc.length, t: disc.reduce((a, d) => a + d.topicos, 0),
    r: (r.disciplinas || []).reduce((a, d) => a + d.topicos.reduce((b, tp) => b + (tp.ramos ? tp.ramos.length : 0), 0), 0),
    ign: cont("linha_ignorada"), rep: disc.filter((d) => d.vezes > 1).length, sem: disc.filter((d) => !d.topicos).length, disc,
    esc: cont("escolha_suspeita"), escNomes: ach.filter((a) => a.tipo === "escolha_suspeita").map((a) => a.txt),
  });
  const susp = edTextoSuspeito(null, r);
  if (susp) return Object.assign(info, { estado: susp.tipo, nomes: susp.nomes || [] });
  if (!info.d) return Object.assign(info, { estado: "cru" });
  return Object.assign(info, { estado: info.ign || info.rep || info.sem || info.esc ? "atencao" : "ok" });
}

const HUB_SEM_CLASSE = { vazio: "sem-vazio", ok: "sem-ok", atencao: "sem-atencao", cru: "sem-atencao", modelo: "sem-atencao", igual: "sem-atencao", prompt: "sem-erro" };

/* O que se colou na caixa da REVISÃO: o mesmo veredito do Novo edital, mais um — "igual": o texto é idêntico ao plano que
 * a pessoa já tem (colou o plano de volta em vez da resposta da IA). */
function hubColarEstado(novo, atual) {
  const info = hubNovoEstadoPlano(novo);
  const norm = (x) => String(x || "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  if (info.estado !== "vazio" && info.estado !== "prompt" && norm(novo) === norm(atual)) return Object.assign(info, { estado: "igual" });
  return info;
}
const HUB_SEM_ICONE = { "sem-vazio": "○", "sem-ok": "✓", "sem-atencao": "⚠", "sem-erro": "⛔" };

/* =====================================================================
 * W2 — NOME, DATA E PRÉ-EDITAL: o que o Novo edital exige antes de criar.
 *
 * O relato: o edital foi criado sem crítica ao nome ("Novo edital" vinha como valor), sem data e sem nunca perguntar se
 * era pré-edital — três coisas que mudam tudo no plano (prazo, semanas, fase). Agora a data tem TRÊS respostas explícitas:
 *   "data"  — tenho a data (campo obrigatório);
 *   "sem"   — o edital saiu, mas a data não (decisão consciente, dita em voz alta);
 *   "pre"   — ainda é pré-edital: a janela esperada (de mês/ano até mês/ano) vira `previsto:` e a fase "pré" do app.
 * Sem escolher, não cria. Erro = vermelho debaixo do campo; aviso (nome genérico, data que já passou) = pergunta antes.
 * ===================================================================== */
let hubNovoTocado = false;   /* a pessoa já tentou criar: os erros passam a aparecer em vermelho */
const HUB_NOMES_GENERICOS = ["novo edital", "edital", "concurso", "novo concurso", "new exam", "exam", "teste"];

function hubNovoModo() {
  const marcado = (id) => !!(document.getElementById(id) || {}).checked;
  return marcado("edNovoModoData") ? "data" : marcado("edNovoModoSem") ? "sem" : marcado("edNovoModoPre") ? "pre" : "";
}

function hubNovoHoje() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* a janela de pré-edital dos quatro seletores: "AAAA-MM" ou "AAAA-MM..AAAA-MM" (o formato que edJanela lê) */
function hubNovoPrevisto() {
  const v = (id) => String((document.getElementById(id) || {}).value || "");
  const par = (m, a) => (m && a ? a + "-" + String(m).padStart(2, "0") : "");
  const de = par(v("edNovoPreDeM"), v("edNovoPreDeA")), ate = par(v("edNovoPreAteM"), v("edNovoPreAteA"));
  return { de, ate, ordem: !ate || ate >= de, texto: de ? (ate && ate !== de ? de + ".." + ate : de) : "" };
}

function hubNovoValidar() {
  const g = (id) => document.getElementById(id);
  const val = (id) => String((g(id) || {}).value || "").trim();
  const erros = [], avisos = [];
  const erro = (campo, onde, msg) => erros.push({ campo, onde, msg });
  const nome = val("edNovoNome"), modo = hubNovoModo();
  let generico = false;
  if (!nome) erro("edNovoNome", "edNovoNomeErro", t("ed_novo_e_nome"));
  else if (HUB_NOMES_GENERICOS.indexOf(edSemAcento(nome).trim()) >= 0)
    { generico = true; avisos.push(t("ed_novo_a_nome", { n: nome })); }
  let prova = "", previsto = "";
  if (!modo) erro("edNovoModoData", "edNovoDataErro", t("ed_novo_e_modo"));
  else if (modo === "data") {
    prova = val("edNovoProva");
    if (!prova) erro("edNovoProva", "edNovoDataErro", t("ed_novo_e_data"));
    else if (prova < hubNovoHoje()) avisos.push(t("ed_novo_a_passada", { d: prova.split("-").reverse().join("/") }));
  } else if (modo === "pre") {
    const p = hubNovoPrevisto();
    if (!p.de) erro("edNovoPreDeM", "edNovoDataErro", t("ed_novo_e_pre"));
    else if (!p.ordem) erro("edNovoPreAteM", "edNovoDataErro", t("ed_novo_e_pre_ordem"));
    else previsto = p.texto;
  }
  const horas = val("edNovoHoras");
  if (!/^\d+$/.test(horas) || Number(horas) < 1 || Number(horas) > 80) erro("edNovoHoras", "edNovoHorasErro", t("ed_novo_e_horas"));
  const sw = g("edNovoF2On");
  if (modo === "data" && sw && sw.checked) {
    const f2 = val("edNovoF2Prova");
    if (!f2) erro("edNovoF2Prova", "edNovoF2Erro", t("ed_novo_e_f2"));
    else if (prova && f2 <= prova) erro("edNovoF2Prova", "edNovoF2Erro", t("ed_novo_e_f2_ordem"));
  }
  return { erros, avisos, nome, modo, prova, previsto, horas, generico };
}

function hubNovoPreencherSeletores() {
  const meses = String(t("ed_novo_meses")).split(",");
  const ano = new Date().getFullYear();
  const enche = (id, itens, ph) => {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = "";
    [["", ph]].concat(itens).forEach(([v, rot]) => { const o = document.createElement("option"); o.value = v; o.textContent = rot; s.append(o); });
    s.value = "";
  };
  const ms = meses.map((m, i) => [String(i + 1), m]), as = [0, 1, 2, 3].map((i) => [String(ano + i), String(ano + i)]);
  enche("edNovoPreDeM", ms, t("ed_novo_mes")); enche("edNovoPreAteM", ms, t("ed_novo_mes"));
  enche("edNovoPreDeA", as, t("ed_novo_ano")); enche("edNovoPreAteA", as, t("ed_novo_ano"));
}

function hubNovoMotivo(est) {
  if (est.estado === "cru") return t("ed_novo_mot_cru");
  if (est.estado === "modelo") return t("ed_novo_mot_modelo", { n: est.nomes.slice(0, 2).join(", ") });
  if (est.estado === "atencao" && est.ign) return t("ed_novo_mot_ign", { i: est.ign });
  return "";
}

function hubNovoPintar() {
  const g = (id) => document.getElementById(id);
  const sem = g("edNovoSem");
  if (!sem) return null;
  const pl = g("edNovoPlano");
  const est = hubNovoEstadoPlano(pl ? pl.value : "");
  const cls = HUB_SEM_CLASSE[est.estado];
  sem.className = "ednovo-sem " + cls;
  g("edNovoSemIco").textContent = HUB_SEM_ICONE[cls];
  const partes = [];
  if (est.ign) partes.push(t("ed_novo_p_ign", { n: est.ign }));
  if (est.rep) partes.push(t("ed_novo_p_rep", { n: est.rep }));
  if (est.sem) partes.push(t("ed_novo_p_sem", { n: est.sem }));
  if (est.esc) partes.push(t("ed_novo_p_escolha", { n: est.esc, l: (est.escNomes || []).slice(0, 2).join(", ") }));
  g("edNovoSemTxt").textContent = est.estado === "atencao" ? t("ed_novo_sem_atencao", { p: partes.join(", ") })
    : est.estado === "cru" ? t("ed_novo_sem_cru", { i: est.ign })
    : est.estado === "modelo" ? t("ed_novo_sem_modelo", { n: est.nomes.slice(0, 2).join(", ") })
    : t("ed_novo_sem_" + est.estado);
  if (pl) pl.className = "ednovo-ta " + cls.replace("sem-", "ta-");
  /* ações do semáforo: tirar o que não serve; ou levar o texto cru para a IA */
  const ac = g("edNovoSemAcoes");
  ac.innerHTML = "";
  const botao = (id, chave, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn-min"; b.id = id; b.textContent = t(chave); b.onclick = fn;
    ac.append(b);
  };
  if (est.estado === "cru") botao("btnEdNovoMontar", "ed_novo_btn_montar", hubNovoMontarPrompt);
  /* o edital cru, numerado, o app estrutura sozinho — só se houver o que estruturar */
  if (est.estado === "cru" && typeof edEstruturarCru === "function" && edEstruturarCru(pl ? pl.value : "").disciplinas > 0) {
    botao("btnEdNovoEstruturar", "ed_novo_btn_estruturar", hubNovoEstruturar);
  }
  if (hubNovoCruOriginal !== null && est.estado !== "cru") botao("btnEdNovoDesestruturar", "ed_novo_btn_desestruturar", hubNovoDesestruturar);
  if (est.estado === "cru" || est.estado === "prompt") botao("btnEdNovoLimpar", "ed_novo_btn_limpar", hubNovoLimparPlano);
  /* o que o app ENTENDEU: um chip por disciplina */
  const ch = g("edNovoEntendi");
  ch.innerHTML = "";
  const mostrar = est.disc.length && est.estado !== "prompt" && est.estado !== "cru";
  ch.hidden = !mostrar;
  if (mostrar) {
    est.disc.slice(0, 12).forEach((d) => {
      const s = document.createElement("span");
      s.className = "ednovo-chip" + (d.modelo ? " chip-erro" : (!d.topicos || d.vezes > 1 ? " chip-atencao" : ""));
      s.textContent = d.nome + " · " + d.topicos + (d.vezes > 1 ? " ×" + d.vezes : "");
      s.title = d.modelo ? t("ed_novo_chip_modelo") : (!d.topicos ? t("ed_novo_chip_vazia") : (d.vezes > 1 ? t("ed_novo_chip_rep", { n: d.vezes }) : ""));
      ch.append(s);
    });
    if (est.disc.length > 12) {
      const s = document.createElement("span");
      s.className = "ednovo-chip"; s.textContent = "+" + (est.disc.length - 12);
      ch.append(s);
    }
  }
  /* "Antes de criar": nome, data, plano */
  const v = hubNovoValidar();
  const falta = (campo) => v.erros.some((e) => e.campo === campo);
  const linha = (id, c, txt) => { const li = g(id); if (li) { li.className = "pront-" + c; li.textContent = { ok: "✓", atencao: "⚠", erro: "⛔", vazio: "○" }[c] + " " + txt; } };
  /* o que falta aparece cinza (○) até a pessoa tentar criar; depois, vermelho (⛔) */
  const faltante = hubNovoTocado ? "erro" : "vazio";
  const nomeGenerico = v.generico;
  linha("edNovoProntNome", falta("edNovoNome") ? faltante : nomeGenerico ? "atencao" : "ok",
    falta("edNovoNome") ? t("ed_novo_pr_nome_pend") : nomeGenerico ? t("ed_novo_pr_nome_no", { n: v.nome }) : t("ed_novo_pr_nome_ok", { n: v.nome }));
  const dmy = (iso) => String(iso).split("-").reverse().join("/");
  let dc, dt;
  if (!v.modo) { dc = faltante; dt = t("ed_novo_pr_data_pend"); }
  else if (v.modo === "sem") { dc = "atencao"; dt = t("ed_novo_pr_data_sem"); }
  else if (v.modo === "pre") {
    const p = hubNovoPrevisto();
    dc = v.previsto ? "ok" : faltante;
    dt = v.previsto ? t("ed_novo_pr_data_pre", { j: p.ate && p.ate !== p.de ? p.de.split("-").reverse().join("/") + " – " + p.ate.split("-").reverse().join("/") : p.de.split("-").reverse().join("/") }) : t("ed_novo_pr_data_pre_pend");
  } else if (!v.prova) { dc = faltante; dt = t("ed_novo_pr_data_falta"); }
  else if (v.prova < hubNovoHoje()) { dc = "atencao"; dt = t("ed_novo_pr_data_passada", { d: dmy(v.prova) }); }
  else { dc = "ok"; dt = t("ed_novo_pr_data_ok", { d: dmy(v.prova) }); }
  linha("edNovoProntData", dc, dt);
  /* os campos que dependem da resposta da data */
  const mostra = (id, sim) => { const el = g(id); if (el) el.hidden = !sim; };
  mostra("edNovoDataCampo", v.modo === "data"); mostra("edNovoPreCampo", v.modo === "pre");
  mostra("edNovoF2Lin", v.modo === "data");
  const sw = g("edNovoF2On");
  mostra("edNovoF2cx", v.modo === "data" && !!(sw && sw.checked));
  const lei = g("edNovoPreLeitura");
  if (lei) {
    const p = hubNovoPrevisto();
    const f = (x) => String(x).split("-").reverse().join("/");
    lei.textContent = !p.de ? "" : p.ate && p.ate !== p.de ? t("ed_novo_pre_leitura2", { a: f(p.de), b: f(p.ate) }) : t("ed_novo_pre_leitura1", { a: f(p.de) });
  }
  /* o erro escrito debaixo do campo (só depois da primeira tentativa) e a borda vermelha */
  ["edNovoNomeErro", "edNovoDataErro", "edNovoHorasErro", "edNovoF2Erro"].forEach((id) => {
    const p = g(id);
    if (!p) return;
    const e = hubNovoTocado ? v.erros.find((x) => x.onde === id) : null;
    p.textContent = e ? e.msg : "";
    p.hidden = !e;
  });
  ["edNovoNome", "edNovoProva", "edNovoHoras", "edNovoF2Prova", "edNovoPreDeM", "edNovoPreDeA", "edNovoPreAteM", "edNovoPreAteA"].forEach((id) => {
    const el = g(id);
    if (!el) return;
    const inv = hubNovoTocado && v.erros.some((x) => x.campo === id || (x.campo === "edNovoPreDeM" && id === "edNovoPreDeA" && !hubNovoPrevisto().de));
    el.className = String(el.className || "").replace(/\s*ednovo-inv/g, "") + (inv ? " ednovo-inv" : "");
  });
  linha("edNovoProntPlano", est.estado === "prompt" ? "erro" : est.estado === "vazio" ? "vazio" : est.estado === "ok" ? "ok" : "atencao",
    est.estado === "prompt" ? t("ed_novo_pr_plano_erro") : est.estado === "vazio" ? t("ed_novo_pr_plano_vazio")
      : est.estado === "ok" ? t("ed_novo_pr_plano_ok", { d: est.d, t: est.t }) : t("ed_novo_pr_plano_ver"));
  const criar = g("btnEdNovoCriar");
  if (criar) {
    criar.disabled = est.estado === "prompt";
    const faltam = est.estado === "prompt" ? [] : v.erros;
    criar.className = String(criar.className || "").replace(/\s*btn-pend/g, "") + (faltam.length ? " btn-pend" : "");
    criar.title = est.estado === "prompt" ? t("ed_novo_criar_bloq") : (faltam.length ? t("ed_novo_criar_pend", { f: faltam.map((e) => e.msg).join(" ") }) : "");
  }
  return est;
}

function hubNovoLimparPlano() {
  hubNovoCruOriginal = null;
  const pl = document.getElementById("edNovoPlano");
  if (pl) pl.value = "";
  const c = document.getElementById("edNovoConf");
  if (c) c.textContent = "";
  hubNovoPintar();
}

/* texto cru (o edital como saiu do PDF) → prompt com o texto dentro, na área de transferência; só limpa o campo se a cópia deu certo */
/* O TEXTO CRU DE ANTES DE ESTRUTURAR: guardado para voltar (nada do que a pessoa colou se perde) */
let hubNovoCruOriginal = null;

function hubNovoEstruturar() {
  const pl = document.getElementById("edNovoPlano");
  const msg = document.getElementById("edNovoPromptMsg");
  const bruto = String((pl || {}).value || "");
  const r = edEstruturarCru(bruto, { ramos: true });
  if (!r.disciplinas) { if (msg) msg.textContent = t("ed_novo_estruturar_nada"); return false; }
  hubNovoCruOriginal = bruto;
  pl.value = r.texto;
  if (msg) msg.textContent = t("ed_novo_estruturado", { d: r.disciplinas, t: r.topicos, r: r.ramos })
    + (r.semNumeracao.length ? " " + t("ed_novo_estruturado_sem", { l: r.semNumeracao.slice(0, 3).join(", ") }) : "");
  hubNovoPintar();
  return true;
}

function hubNovoDesestruturar() {
  const pl = document.getElementById("edNovoPlano");
  if (hubNovoCruOriginal === null || !pl) return false;
  pl.value = hubNovoCruOriginal;
  hubNovoCruOriginal = null;
  const msg = document.getElementById("edNovoPromptMsg");
  if (msg) msg.textContent = "";
  hubNovoPintar();
  return true;
}

async function hubNovoMontarPrompt() {
  const pl = document.getElementById("edNovoPlano");
  const txt = String((pl || {}).value || "").trim();
  if (!txt) return false;
  const comRamos = !!(document.getElementById("edNovoPedirRamos") || {}).checked;
  const msg = document.getElementById("edNovoPromptMsg");
  try { await navigator.clipboard.writeText(edPromptEdital(comRamos, txt)); } catch (e) {
    if (msg) msg.textContent = t("ed_novo_montar_falha");
    return false;
  }
  pl.value = "";
  const c = document.getElementById("edNovoConf");
  if (c) c.textContent = "";
  if (msg) msg.textContent = t("ed_novo_montar_ok");
  hubNovoPassoFeito();
  hubNovoPintar();
  return true;
}

/* o passo 1 vira ✓ e o passo 2 ganha o destaque: a ordem das coisas fica visível */
function hubNovoPassoFeito() {
  const p1 = document.getElementById("edNovoPasso1"), p2 = document.getElementById("edNovoPasso2");
  if (p1) p1.className = "ednovo-passo feito";
  if (p2) p2.className = "ednovo-passo ativo";
}

/* Monta o texto do edital a partir da caixa. Separada de quem a mostra
 * para poder ser conferida com valores na mão. */
function hubNovoTexto(d) {
  const L = [];
  const cab = [String(d.nome || "").trim() || t("hub_novo_padrao")];
  if (d.prova) cab.push("prova: " + d.prova);
  else if (d.previsto) cab.push("previsto: " + String(d.previsto).replace(/[|]/g, "/"));
  if (d.horas) cab.push("horas: " + d.horas);
  L.push("# " + cab.join(" | "));
  /* (19.76.0) a data da 2ª fase que a IA achou no edital vale quando a caixa não trouxe uma: sem isso, a discursiva em
   * data própria (SEFAZ-AL) sumia ao montar o plano */
  if (!d.f2Prova) {
    const f2IA = String(d.plano || "").split(/\r?\n/).find((l) => /^\s*#\s*fase\s*2\s*:/i.test(l) && /\|\s*prova\s*:\s*\d{4}-\d{2}-\d{2}/i.test(l));
    if (f2IA) L.push(f2IA.trim());
  }
  if (d.f2Prova) {
    const c2 = ["fase 2: " + (String(d.f2Nome || "").trim() || "2ª fase")];
    c2.push("prova: " + d.f2Prova);
    if (d.horas) c2.push("horas: " + d.horas);
    L.push("# " + c2.join(" | "));
  }
  const plano = String(d.plano || "").trim();
  if (plano) {
    /* O CABEÇALHO É NOSSO, o resto é da pessoa. Se ela colar a resposta
     * inteira da IA — que já vem com "#" —, aquela linha viraria uma
     * segunda configuração competindo com a daqui. */
    /* (19.57.0) a linha "# discursiva" da IA FICA: ela não compete com o cabeçalho daqui (é outro dado) */
    const linhasP = plano.split(/\r?\n/);
    linhasP.filter((l) => /^\s*#\s*discursiva\b/i.test(l)).slice(0, 1).forEach((l) => L.push(l.trim()));
    const corpo = linhasP
      .filter((l) => !/^\s*#/.test(l))
      .join("\n").trim();
    if (corpo) { L.push(""); L.push(corpo); }
  }
  return L.join("\n") + "\n";
}

function hubNovoCriar() {
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  };
  /* a segunda fase só vale com o interruptor ligado: o que foi digitado antes de desligar não entra */
  const f2on = !!(document.getElementById("edNovoF2On") || {}).checked;
  /* o PROMPT nunca vira edital — nem se chamarem esta função sem passar pelo botão */
  if (hubNovoEstadoPlano(val("edNovoPlano")).estado === "prompt") { hubNovoPintar(); return null; }
  /* a data vem da resposta escolhida; sem nenhuma escolhida (chamada direta), vale o campo da data, como sempre valeu */
  const modo = hubNovoModo();
  const comData = modo === "data" || !modo;
  const f2ok = f2on && comData;
  const texto = hubNovoTexto({
    nome: val("edNovoNome"), prova: comData ? val("edNovoProva") : "",
    previsto: modo === "pre" ? hubNovoPrevisto().texto : "",
    horas: val("edNovoHoras"), f2Nome: f2ok ? val("edNovoF2Nome") : "",
    f2Prova: f2ok ? val("edNovoF2Prova") : "", plano: val("edNovoPlano"),
  });
  const r = lerEdital(texto);
  const nTop = (r.disciplinas || []).reduce((a, d) => a + d.topicos.length, 0);
  document.getElementById("dlgEdNovo").close();
  hubGravarAberto();
  const e = edCriar(val("edNovoNome") || t("hub_novo_padrao"), texto);
  /* o nome digitado MANDA no cabeçalho: sem isto, o app reescreveria o
   * nome a partir do texto na primeira gravação */
  e.renomeado = !!val("edNovoNome");
  edSalvarLista();
  reg("EDITAL", "edital criado", e.nome
    + (nTop ? " · " + (r.disciplinas || []).length + " disciplinas, "
              + nTop + " tópicos" : " · sem disciplinas ainda"));
  hubAbrirEdital(e.id);
  return e;
}

/* o botão "Criar edital": o que é vermelho não cria; o que é âmbar pergunta antes. `confirmar`: só para teste. */
async function hubNovoCriarConfirmado(confirmar) {
  const pl = document.getElementById("edNovoPlano");
  const est = hubNovoEstadoPlano(pl ? pl.value : "");
  if (est.estado === "prompt") { hubNovoPintar(); return null; }
  const v = hubNovoValidar();
  if (v.erros.length) {
    /* NÃO cria: mostra, em vermelho, o que falta, e leva o cursor ao primeiro campo */
    hubNovoTocado = true;
    hubNovoPintar();
    const el = document.getElementById(v.erros[0].campo);
    try { if (el && el.focus) el.focus(); } catch (e) {}
    return null;
  }
  const motivo = hubNovoMotivo(est);
  if (v.avisos.length) {
    const linhas = v.avisos.concat(motivo ? [t("ed_novo_a_plano", { m: motivo })] : []);
    if (!(await (confirmar || uiConfirm)(t("ed_novo_conf_avisos", { l: linhas.map((x) => "• " + x).join("\n") })))) return null;
  } else if (motivo && !(await (confirmar || uiConfirm)(t("ed_novo_conf_suspeito", { m: motivo })))) return null;
  return hubNovoCriar();
}

function hubRenomear() {
  const e = edAberto();
  if (!e) return;
  /* A CAIXA É DO APP, não do navegador. O prompt() nativo abre com o
   * endereço do site no título ("marlitosdev.github.io diz"), no canto
   * de cima, com os botões do sistema — parece um aviso de segurança, e
   * não uma pergunta do aplicativo que a pessoa acabou de usar. */
  uiTexto(t("hub_renomear_pergunta"), e.nome).then((n) => {
    if (n === null) return;
    hubRenomearAplicar(e, n);
  });
}

function hubRenomearAplicar(e, n) {
  const antes = e.nome;
  e.nome = String(n || "").trim() || e.nome;
  /* renomeado à mão manda no cabeçalho do texto: se o app reescrevesse o
   * nome a cada tecla, "TCE-PE · Auditor" viraria "TCE-PE" sozinho */
  e.renomeado = true;
  edSalvarLista();
  reg("EDITAL", "edital renomeado", antes + " → " + e.nome);
  hubRender();
}

/* ------------------------------------------------------------------
 * A ROTA: hub ou bancada, nunca os dois
 * ------------------------------------------------------------------ */
function hubRender() {
  const aberto = edAberto();
  const hub = document.getElementById("edHub");
  const banc = document.getElementById("edBancada");
  if (hub) hub.hidden = !!aberto;
  if (banc) banc.hidden = !aberto;
  /* o mapa de vínculos vive na lista, e se repinta com ela: apagar um
   * vínculo ou um edital muda o desenho */
  if (!aberto && typeof vkMapaPintar === "function") {
    try { vkMapaPintar(); } catch (e) {}
  }
  const nm = document.getElementById("edNomeAberto");
  if (nm) nm.textContent = aberto ? aberto.nome : "";
  try { if (typeof domTermoPintar === "function") domTermoPintar(aberto ? aberto.id : ""); } catch (e) {}
  hubTopoPintar();
  if (!aberto) hubPintarLista();
  hubPintarAgenda();
}

/* =====================================================================
 * (19.94.0) O TOPO DA ABA: UM SELETOR DE EDITAL E AS FERRAMENTAS
 *
 * O edital era escolhido em quatro lugares — os chips da agenda, a lista dos editais, o selo de cada linha e
 * "← todos os editais" — e as ferramentas (Domínio, Horas por assunto, Verticalizado) ficavam a ~2.600 px do topo,
 * depois da agenda inteira. Agora: um seletor só ("Todos os editais" mostra a lista; um edital abre o plano dele) e as
 * ferramentas do edital escolhido ao lado. "Renomear" e "novo edital" moram no "⋯".
 * ===================================================================== */
function hubTopoPintar() {
  const sel = document.getElementById("edSel");
  const aberto = edAberto();
  if (sel) {
    sel.innerHTML = "";
    const opt = (v, txt) => { const o = document.createElement("option"); o.value = v; o.textContent = txt; sel.append(o); };
    opt("", t("ed_sel_todos", { n: editais.length }));
    const sit = (e) => { try { return edSituacao(e).grupo; } catch (x) { return ""; } };
    editais.filter((e) => sit(e) !== "encerrado").concat(editais.filter((e) => sit(e) === "encerrado")).forEach((e) => {
      opt(e.id, (e.nome || t("ed_sem_nome")) + (sit(e) === "encerrado" ? " " + t("ed_sel_encerrado") : ""));
    });
    sel.value = aberto ? aberto.id : "";
    sel.onchange = () => {
      const v = sel.value;
      reg("EDITAL", "seletor do topo", v || "todos");
      if (v) hubAbrirEdital(v); else hubVoltar();
    };
    const cx = document.getElementById("edTopoSel");
    if (cx) cx.hidden = !editais.length;
  }
  const ferr = document.getElementById("edTopoFerr");
  if (ferr) ferr.hidden = !aberto;
  const tm = document.getElementById("btnEdTopoMais");
  if (tm) tm.setAttribute("aria-label", t("ed_sel_mais_tip"));
}

function hubTopoMenuItens() {
  const aberto = edAberto();
  const itens = [];
  if (aberto) itens.push({ id: "btnEdRenomear", rot: t("hub_renomear"), faz: () => hubRenomear() });
  itens.push({ id: "btnEdTopoNovo", rot: t("hub_novo"), faz: () => hubNovo() });
  if (aberto) itens.push({ id: "btnEdTopoTodos", rot: t("ed_sel_ver_todos"), faz: () => hubVoltar() });
  return itens;
}

function hubIniciar() {
  edCarregarLista();
  /* o raio-X se liga aqui porque o gatilho dele mora na barra da agenda,
   * que e desta tela — e porque os botoes do dialogo existem desde o
   * carregamento, nao dependem de nenhum edital estar aberto */
  try { if (typeof plIniciar === "function") plIniciar(); } catch (e) {}
  const b = document.getElementById("hubBusca");
  if (b) b.oninput = () => { hubFiltro = b.value; hubPintarLista(); };
  const n = document.getElementById("btnHubNovo");
  if (n) n.onclick = hubNovo;
  const v = document.getElementById("btnEdVoltar");
  if (v) v.onclick = hubVoltar;
  const r = document.getElementById("btnEdRenomear");
  if (r) r.onclick = hubRenomear;
  const tm = document.getElementById("btnEdTopoMais");
  if (tm) tm.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); if (typeof edMenuAbrir === "function") edMenuAbrir(tm, document.getElementById("edTopoMenu"), hubTopoMenuItens); };
  const bp = document.getElementById("btnBancPontua");
  if (bp) bp.onclick = () => { if (typeof epAbrir === "function") epAbrir(); };
  const nc = document.getElementById("btnEdNovoCriar");
  if (nc) nc.onclick = () => hubNovoCriarConfirmado();
  ["edNovoNome", "edNovoProva", "edNovoHoras", "edNovoF2Nome", "edNovoF2Prova", "edNovoPreDeM", "edNovoPreDeA", "edNovoPreAteM", "edNovoPreAteA"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.oninput = hubNovoPintar; el.onchange = hubNovoPintar; }
  });
  const modos = ["edNovoModoData", "edNovoModoSem", "edNovoModoPre"];
  modos.forEach((id) => {
    const r = document.getElementById(id);
    if (r) r.onchange = () => { modos.forEach((o) => { const x = document.getElementById(o); if (x && o !== id) x.checked = false; }); hubNovoPintar(); };
  });
  const nn = document.getElementById("btnEdNovoNao");
  if (nn) nn.onclick = () => document.getElementById("dlgEdNovo").close();
  const sw2 = document.getElementById("edNovoF2On");
  if (sw2) sw2.onchange = () => { hubNovoPintar(); };
  const np = document.getElementById("btnEdNovoPrompt");
  if (np) {
    /* o prompt fica NA CAIXA onde o plano vai ser colado: mandar a
     * pessoa procurá-lo noutra tela é onde ela desiste e cria o edital
     * vazio */
    np.onclick = () => {
      const comRamos = !!(document.getElementById("edNovoPedirRamos") || {}).checked;
      try { navigator.clipboard.writeText(edPromptEdital(comRamos)); } catch (e) {}
      const c = document.getElementById("edNovoPromptMsg");
      if (c) c.textContent = t(comRamos ? "ed_novo_prompt_ok_ramos" : "ed_novo_prompt_ok");
      hubNovoPassoFeito();
    };
  }
  /* conferência viva: dizer quantas disciplinas o texto colado tem ANTES
   * de criar é o que evita criar cinco editais até acertar o formato */
  const pl = document.getElementById("edNovoPlano");
  if (pl) {
    pl.oninput = () => {
      /* (19.58.0) o texto copiado da tela do chat (e o mínimo na linha "@") é consertado aqui mesmo, com aviso */
      if (typeof edConsertarCaixa === "function") edConsertarCaixa(pl);
      const c = document.getElementById("edNovoConf");
      if (!c) return;
      const est = hubNovoPintar();
      const txt = String(pl.value || "").trim();
      /* "0 disciplinas, 25 linhas que não entraram" ao lado do vermelho só repete o que o semáforo já disse */
      if (!txt || (est && (est.estado === "prompt" || est.estado === "cru"))) { c.textContent = ""; return; }
      const r2 = lerEdital("# x\n" + txt.split(/\r?\n/)
        .filter((l) => !/^\s*#/.test(l)).join("\n"));
      const nd = (r2.disciplinas || []).length;
      const nt = (r2.disciplinas || []).reduce((a, d) => a + d.topicos.length, 0);
      const ign = (r2.achados || []).filter((a) => a.tipo === "linha_ignorada").length;
      const nr = (r2.disciplinas || []).reduce((a, d) => a + d.topicos.reduce((b, tp) => b + (tp.ramos ? tp.ramos.length : 0), 0), 0);
      c.textContent = nr ? t("ed_novo_conf_r", { d: nd, t: nt, r: nr, i: ign }) : t("ed_novo_conf", { d: nd, t: nt, i: ign });
    };
  }
  const rc = document.getElementById("btnEdBancRecolher");
  if (rc) rc.onclick = bancAlternar;
  /* (19.55.0) COM O EDITAL JÁ CRIADO, O TEXTO COLADO FICA RECOLHIDO POR PADRÃO: o que se usa dali em diante são os
   * botões do resumo (pontuação e cortes, revisar com a IA, incluir disciplina). Quem expandiu de propósito continua
   * vendo — a escolha da pessoa vale mais que o padrão. */
  try {
    const v = localStorage.getItem("eac_banc_recolhida");
    const temDisc = (() => { const ta0 = document.getElementById("editalTexto"); const a0 = edAberto(); return lerEdital((ta0 && ta0.value) || (a0 && a0.texto) || "").disciplinas.length > 0; })();
    bancRecolhida = v === "1" || (v === null && temDisc);
  } catch (e) {}
  bancAplicar();

  /* os campos da bancada nascem com a rotina salva — antes eles voltavam
   * ao padrão a cada recarga e o planejamento mudava sozinho */
  const cd = document.getElementById("edDias");
  if (cd) {
    cd.value = String(hubPref("dias", 5));
    cd.addEventListener("change", () => hubPrefGravar("dias", cd.value));
  }

  /* o edital aberto manda o seu texto para a bancada */
  const a = edAberto();
  const ta = document.getElementById("editalTexto");
  if (a && ta && !ta.value) ta.value = a.texto || "";
  hubRender();
}

/* ------------------------------------------------------------------
 * BANCADA RECOLHÍVEL
 *
 * Depois de colar o edital, a bancada é uma caixa de texto de 230 px que
 * não muda mais — e ela empurra para baixo o painel que se olha todo dia.
 * Recolher não esconde informação: o resumo fica no lugar, e é o que a
 * pessoa precisa saber de relance (quantas disciplinas, quantos tópicos).
 * ------------------------------------------------------------------ */
let bancRecolhida = false;

function bancAplicar() {
  const corpo = document.getElementById("edBancCorpo");
  const resumo = document.getElementById("edBancResumo");
  const bt = document.getElementById("btnEdBancRecolher");
  if (!corpo || !resumo || !bt) return;
  /* (19.94.0) O RESUMO E AS AÇÕES FICAM SEMPRE À VISTA, e o que abre e fecha é só o texto cru. Recolhida, a bancada
   * mostrava "⚖ Pontuação e cortes", "Revisar com a IA" e "✏ texto do plano"; aberta, mostrava outro "Revisar com a IA" e
   * um "expandir/recolher" que fazia o mesmo que "✏ texto do plano". Agora é uma fileira só, nos dois estados, e o
   * mesmo botão ("✏ texto do plano (avançado)") abre e fecha o texto. */
  corpo.hidden = bancRecolhida;
  resumo.hidden = false;
  bt.textContent = t(bancRecolhida ? "ed_banc_texto" : "ed_banc_texto_fechar");
  bt.setAttribute("aria-expanded", bancRecolhida ? "false" : "true");
  /* a cor viva de "única saída" (banc-aberta) deixou de fazer sentido: a fileira de ações nunca some */
  if (bt.classList) bt.classList.remove("banc-aberta");
  bt.title = t(bancRecolhida ? "ed_banc_texto_tip" : "ed_recolher_aj");
  const ta = document.getElementById("editalTexto");
  const r = lerEdital((ta && ta.value) || "");
  const tops = r.disciplinas.reduce((a, d) => a + d.topicos.length, 0);
  resumo.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = r.disciplinas.length ? t("ed_banc_resumo", { d: r.disciplinas.length, t: tops }) : t("ed_banc_vazia");
  resumo.append(b);
  try { localStorage.setItem("eac_banc_recolhida", bancRecolhida ? "1" : "0"); } catch (e) {}
}

function bancAlternar() {
  bancRecolhida = !bancRecolhida;
  reg("EDITAL", "bancada " + (bancRecolhida ? "recolhida" : "expandida"));
  bancAplicar();
}
