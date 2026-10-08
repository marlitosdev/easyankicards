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
  const filtroEd = hubFiltroEdital(todosAtivos);
  if (filtroEd) cx.append(filtroEd);

  /* pega a fila da semana de cada edital ativo e junta */
  const linhas = [];
  ativos.forEach((e) => {
    const s = edSituacao(e);
    const r = lerEdital(e.texto || "");
    const cfg = r.cfg || {};
    const plano = montarPlano(r, {
      horas: cfg.horas || 10, prova: s.prova, feitos: e.progresso || {},
    });
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
  linhas.sort((a, b) =>
    (b.ehRevisao ? 1 : 0) - (a.ehRevisao ? 1 : 0)
    || ((a.ordemFila || 999) / (a.urgencia || 1))
       - ((b.ordemFila || 999) / (b.urgencia || 1))
    || b.ordem - a.ordem);

  /* TIRADOS DA AGENDA: adiados com prazo em aberto e dispensados.
   * Some daqui, não do plano: o que sai por tempo volta sozinho quando o
   * prazo vence, e o que saiu de vez continua listado na sua gaveta. */
  const antesDeTirar = linhas.length;
  const listaCheia = linhas.slice();
  const visiveis = linhas.filter((i) => !edEstaFora(i.chave));
  const tirados = antesDeTirar - visiveis.length;
  linhas.length = 0;
  visiveis.forEach((i) => linhas.push(i));

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
  if (tirados || escondidas) {
    const av = document.createElement("div");
    av.className = "ed-caixa-sub ed-ag-aviso";
    av.textContent = [
      tirados ? t("hub_ag_tirados", { n: tirados }) : "",
      escondidas ? t("hub_ag_escondidas", { n: escondidas }) : "",
    ].filter(Boolean).join(" · ");
    cx.append(av);
  }

  const sub = document.createElement("div");
  sub.className = "ed-caixa-sub";
  sub.textContent = t(ativos.length === 1 ? "hub_agenda_sub1" : "hub_agenda_sub", {
    n: linhas.length,
    c: ativos.length,
    h: horasTexto(linhas.reduce((a, i) => a + (i.minutos || 0), 0)),
  });
  cx.append(sub);

  /* MEDIDOR DA SEMANA: o que você já pôs contra o que a agenda pede.
   * Sem isto, "63h45 desta semana" é uma cobrança sem resposta — não dá
   * para saber se você está em dia ou atrás. O feito vem do DIÁRIO (o que
   * aconteceu de verdade), não do que está marcado: marcar um tópico não
   * diz quanto tempo levou. */
  const planejadoMin = linhas.reduce((a2, i) => a2 + (i.minutos || 0), 0);
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
    const dica = edSemanaDicaTexto(SS);
    if (dica) {
      const dd = document.createElement("div");
      dd.className = "di-sem-dica"; dd.textContent = dica;
      celsSemana.append(dd);
    }
  }

  const mostrar = hubAgendaAberta ? linhas : linhas.slice(0, HUB_AGENDA_CURTA);
  mostrar.forEach((i) => {
    const li = edLinhaTopico(i);
    /* o selo do concurso: a linha precisa dizer de qual prova ela é, senão
     * com dois editais abertos a agenda não informa nada */
    const selo = document.createElement("button");
    selo.type = "button";
    selo.className = "ed-selo-cc";
    selo.textContent = i.editalNome;
    selo.title = t("hub_ir_para", { n: i.editalNome });
    selo.onclick = (ev) => { ev.stopPropagation(); hubAbrirEdital(i.edital); };
    const alvo = li.querySelector(".ed-lin-disc") || li;
    alvo.append(selo);

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
    li.append();
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
  lh.title = usados.length > 1
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
function edPromptEdital(comRamos, textoDoEdital) {
  let out = t("ed_prompt");
  const corte = out.search(/\n\n(?:EXEMPLO DE SAÍDA|SYLLABUS|EDITAL):/);
  if (comRamos && corte >= 0) {
    let n = 0;
    out.slice(0, corte).replace(/(?:^|\n)(\d+)\./g, (m, d) => { n = Math.max(n, Number(d)); return m; });
    out = out.slice(0, corte) + "\n" + t("ed_prompt_ramos", { n: n + 1 }) + out.slice(corte);
  }
  /* com o texto do edital na mão, ele já vai DENTRO do prompt, no lugar do "[cole aqui o edital]" */
  if (textoDoEdital) out = out.replace(/\[cole aqui o edital\]|\[paste the syllabus here\]/, () => textoDoEdital);
  return out;
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
    const corpo = plano.split(/\r?\n/)
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
  if (!aberto) hubPintarLista();
  hubPintarAgenda();
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
  try { bancRecolhida = localStorage.getItem("eac_banc_recolhida") === "1"; } catch (e) {}
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
  corpo.hidden = bancRecolhida;
  resumo.hidden = !bancRecolhida;
  bt.textContent = t(bancRecolhida ? "ed_expandir" : "ed_recolher");
  /* RECOLHIDO, ELE É A ÚNICA SAÍDA — e por isso fica em cor viva.
   * Expandido é só mais um botão de canto e não precisa disputar
   * atenção com o edital. O estado tem nome próprio e a regra dele só
   * pinta: a geometria mora na classe de identidade, que é o que evita
   * o defeito da faixa de navegação encolhida (E15). */
  if (bt.classList) bt.classList.toggle("banc-aberta", bancRecolhida);
  bt.title = t(bancRecolhida ? "ed_expandir_aj" : "ed_recolher_aj");
  if (bancRecolhida) {
    const ta = document.getElementById("editalTexto");
    const r = lerEdital((ta && ta.value) || "");
    const tops = r.disciplinas.reduce((a, d) => a + d.topicos.length, 0);
    resumo.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = t("ed_banc_resumo", { d: r.disciplinas.length, t: tops });
    resumo.append(b);
  }
  try { localStorage.setItem("eac_banc_recolhida", bancRecolhida ? "1" : "0"); } catch (e) {}
}

function bancAlternar() {
  bancRecolhida = !bancRecolhida;
  reg("EDITAL", "bancada " + (bancRecolhida ? "recolhida" : "expandida"));
  bancAplicar();
}
