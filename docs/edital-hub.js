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

function hubPintarAgenda() {
  const box = document.getElementById("edAgendaTopo");
  if (!box) return;
  box.innerHTML = "";

  const ativos = editais.filter((e) => edSituacao(e).grupo !== "encerrado");
  if (!ativos.length) { box.hidden = true; return; }
  box.hidden = false;

  const cx = document.createElement("div");
  cx.className = "ed-caixa ed-agenda-cx";

  const cab = document.createElement("div");
  cab.className = "ed-agenda-cab";
  const tit = document.createElement("div");
  tit.className = "ed-caixa-tit";
  tit.textContent = t("hub_agenda_tit");
  cab.append(tit);
  cx.append(cab);

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
  sub.textContent = t("hub_agenda_sub", {
    n: linhas.length,
    c: ativos.length,
    h: horasTexto(linhas.reduce((a, i) => a + (i.minutos || 0), 0)),
  });
  cx.append(sub);

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
  const bDup = document.createElement("button");
  bDup.type = "button"; bDup.className = "btn-min";
  bDup.textContent = t("hub_duplicar");
  bDup.title = t("hub_duplicar_ajuda");
  bDup.onclick = () => {
    const n = edDuplicar(e.id);
    if (n) { reg("EDITAL", "edital duplicado", e.nome + " → " + n.nome); hubRender(); }
  };
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
  acoes.append(bAbrir, bDup, bDel);
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

  /* o edital aberto manda o seu texto para a bancada */
  const a = edAberto();
  const ta = document.getElementById("editalTexto");
  if (a && ta && !ta.value) ta.value = a.texto || "";
  hubRender();
}
