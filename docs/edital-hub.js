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
let hubSoEste = false;      /* agenda restrita ao edital aberto */

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
function minutosDaSemana() {
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
  const iso = ini.getFullYear() + "-"
    + String(ini.getMonth() + 1).padStart(2, "0") + "-"
    + String(ini.getDate()).padStart(2, "0");
  return diario.reduce((a, x) => {
    if (!x || !x.d || x.d === "?" || x.d < iso) return a;
    return a + (Number(x.m) || 0);
  }, 0);
}

function hubPintarAgenda() {
  const box = document.getElementById("edAgendaTopo");
  if (!box) return;
  box.innerHTML = "";

  let ativos = editais.filter((e) => edSituacao(e).grupo !== "encerrado");
  if (!ativos.length) { box.hidden = true; return; }
  /* o filtro só existe quando há mais de um: com um edital só, oferecer
   * "ver só este" é um botão que não muda nada */
  const todosAtivos = ativos;
  if (hubSoEste && edAberto())
    ativos = ativos.filter((e) => e.id === edAberto().id);
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
  const filtroEd = hubFiltroEdital(ativos);
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
      }));
    });
  });

  if (!linhas.length) {
    const p = document.createElement("div");
    p.className = "ed-caixa-sub";
    p.textContent = t("hub_agenda_vazia");
    cx.append(p); box.append(cx); return;
  }

  linhas.sort((a, b) => (b.ehRevisao ? 1 : 0) - (a.ehRevisao ? 1 : 0) || b.ordem - a.ordem);

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
  const planejadoMin = linhas.reduce((a, i) => a + (i.minutos || 0), 0);
  const feitoMin = minutosDaSemana();
  const pct = planejadoMin ? Math.min(100, Math.round((feitoMin / planejadoMin) * 100)) : 0;

  const med = document.createElement("div");
  med.className = "ag-medidor";
  const barra = document.createElement("div");
  barra.className = "ag-barra";
  const fill = document.createElement("div");
  fill.className = "ag-fill" + (pct >= 100 ? " cheio" : (pct >= 50 ? " meio" : ""));
  fill.style.width = pct + "%";
  barra.append(fill);
  const rot = document.createElement("div");
  rot.className = "ag-med-rot";
  rot.textContent = t("hub_medidor", {
    f: horasTexto(feitoMin), p: horasTexto(planejadoMin), pct,
    falta: horasTexto(Math.max(0, planejadoMin - feitoMin)),
  });
  med.append(barra, rot);
  med.title = t("hub_medidor_ajuda");
  cx.append(med);

  /* Agendar é o que transforma uma lista de tópicos em agenda: sem esta
   * chamada cada linha vem sem dia nem horário sugerido — foi o que a
   * mudança para o topo tinha quebrado, porque o agendamento morava dentro
   * do painel antigo. Os dois números vêm da preferência de estudo, não do
   * edital: a semana é uma só, mesmo com três concursos. */
  agendar(linhas, { dias: hubPref("dias", 5), inicio: hubPref("inicio", "19:00") });

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
    li.append();
    cx.append(li);
  });

  if (linhas.length > HUB_AGENDA_CURTA) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ed-abrir";
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
function hubFiltroEdital(todos) {
  const aberto = edAberto();
  if (!aberto || todos.length < 2) { hubSoEste = false; return null; }
  const cx = document.createElement("div");
  cx.className = "ed-agenda-filtro";
  [[false, "hub_ag_todos"], [true, "hub_ag_so_este"]].forEach(([v, k]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-ag-opt" + (hubSoEste === v ? " ativa" : "");
    b.textContent = t(k, { n: aberto.nome });
    b.onclick = () => { hubSoEste = v; hubPintarAgenda(); };
    cx.append(b);
  });
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
  const lh = document.createElement("div");
  lh.className = "ed-agenda-cfg-item ed-agenda-horas";
  const totalH = (editais.filter((e) => edSituacao(e).grupo !== "encerrado")
    .reduce((s, e) => s + ((lerEdital(e.texto || "").cfg || {}).horas || 0), 0));
  lh.textContent = t("hub_cfg_horas", { h: totalH });
  lh.title = t("hub_cfg_horas_ajuda");

  cx.append(ld, lh);
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
  if (e.sit.grupo === "encerrado") prazo.textContent = t("hub_prazo_passou");
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
  if (ta) e.texto = ta.value;
  try {
    e.progresso = JSON.parse(localStorage.getItem("eac_edital_progresso") || "{}");
  } catch (x) {}
  const cfg = (lerEdital(e.texto || "").cfg) || {};
  if (cfg.concurso && (!e.nome || e.nome === "Novo edital")) e.nome = cfg.concurso;
  e.tocado = new Date().toISOString();
  edSalvarLista();
}

function hubNovo() {
  const nome = prompt(t("hub_novo_pergunta"), t("hub_novo_padrao"));
  if (nome === null) return;
  hubGravarAberto();
  const e = edCriar((nome || "").trim() || t("hub_novo_padrao"), "");
  reg("EDITAL", "edital criado", e.nome);
  hubAbrirEdital(e.id);
}

function hubRenomear() {
  const e = edAberto();
  if (!e) return;
  const n = prompt(t("hub_renomear_pergunta"), e.nome);
  if (n === null) return;
  const antes = e.nome;
  e.nome = (n || "").trim() || e.nome;
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
  const nm = document.getElementById("edNomeAberto");
  if (nm) nm.textContent = aberto ? aberto.nome : "";
  if (!aberto) hubPintarLista();
  hubPintarAgenda();
}

function hubIniciar() {
  edCarregarLista();
  const b = document.getElementById("hubBusca");
  if (b) b.oninput = () => { hubFiltro = b.value; hubPintarLista(); };
  const n = document.getElementById("btnHubNovo");
  if (n) n.onclick = hubNovo;
  const v = document.getElementById("btnEdVoltar");
  if (v) v.onclick = hubVoltar;
  const r = document.getElementById("btnEdRenomear");
  if (r) r.onclick = hubRenomear;
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
