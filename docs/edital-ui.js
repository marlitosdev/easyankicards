/* =====================================================================
 * A TELA DO EDITAL
 * Espelha a bancada de cartões de propósito: mesma caixa com números de
 * linha, mesmos botões de topo, mesma lista de sugestões com quem corrige
 * o quê, mesmo registro. Quem aprendeu um lado já sabe usar o outro.
 * ===================================================================== */

let edProgresso = {};      /* nome do tópico -> true */
let edCorrecaoPendente = null;

function edSalvar() {
  try {
    localStorage.setItem("eac_edital_texto", $("editalTexto").value);
    localStorage.setItem("eac_edital_progresso", JSON.stringify(edProgresso));
  } catch (e) {}
}

function edChave(it) { return (it.disciplina + "›" + it.nome).toLowerCase(); }

function edNumeros(n) {
  const g = $("editalNums");
  if (!g) return;
  let h = "";
  for (let i = 1; i <= n; i++) h += '<div class="lnum">' + i + "</div>";
  g.innerHTML = h;
  g.scrollTop = $("editalTexto").scrollTop;
}

function edSugestoes(r) {
  const box = $("editalSug");
  box.innerHTML = "";
  const itens = [];
  const semPeso = r.disciplinas.reduce(
    (s, d) => s + d.topicos.filter((t) => t.herdado).length, 0);
  const ignoradas = r.achados.filter((a) => a.tipo === "linha_ignorada");
  if (ignoradas.length)
    itens.push({ dot: "dot-red", txt: t("ed_crit_ignorada", { n: ignoradas.length }),
                 linha: ignoradas[0].linha });
  if (temNumeracaoEdital($("editalTexto").value))
    itens.push({ dot: "dot-org", txt: t("ed_crit_numeracao"),
                 fixTxt: t("ed_fix_numeracao"), fix: tirarNumeracaoEdital });
  if (temMarcadorTorto($("editalTexto").value))
    itens.push({ dot: "dot-org", txt: t("ed_crit_marcador"),
                 fixTxt: t("ed_fix_marcador"), fix: normalizarMarcadores });
  if (temPesosIguais(r))
    itens.push({ dot: "dot-org", txt: t("ed_crit_pesos_iguais",
      { n: r.disciplinas.length, p: r.disciplinas[0].peso }),
      linha: r.disciplinas[0].linha });
  if (semPeso)
    itens.push({ dot: "dot-blue", txt: t("ed_crit_peso", { n: semPeso }) });
  /* Sempre em primeiro lugar, mesmo quando está tudo certo: é o número que
   * responde "o edital chegou inteiro?" sem precisar contar à mão. */
  const tops = r.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  if (tops || r.disciplinas.length)
    itens.unshift({ dot: "dot-green", conta: true,
      txt: t("ed_lido", { d: r.disciplinas.length, t: tops }) });
  if (!itens.length) itens.push({ dot: "dot-green", txt: t("ed_crit_ok") });

  itens.forEach((it) => {
    const div = document.createElement("div");
    div.className = "sug";
    const dot = document.createElement("span");
    dot.className = "dot " + it.dot;
    const quem = document.createElement("span");
    const daIA = !it.fix && it.dot !== "dot-green" && !it.conta;
    quem.className = "sug-quem " + (daIA ? "quem-ia" : "quem-app");
    if (it.dot !== "dot-green") quem.textContent = t(daIA ? "quem_ia" : "quem_app");
    const sp = document.createElement("span");
    sp.textContent = it.txt;
    div.append(dot, quem, sp);
    if (it.linha || it.fix) {
      const acoes = document.createElement("div");
      acoes.className = "sug-acao";
      if (it.linha) acoes.append(botaoMini("goto_error", "btn-cinza",
        () => edIrParaLinha(it.linha)));
      if (it.fix) acoes.append(botaoMini(null, "btn-azul",
        () => edAplicar(it.fix), it.fixTxt));
      div.append(acoes);
    }
    box.append(div);
  });

  edCorrecaoPendente = edCorrecaoDeTudo($("editalTexto").value);
  const b = $("btnEditalCorrigir");
  b.disabled = !edCorrecaoPendente;
  b.textContent = t(edCorrecaoPendente ? "ed_corrigir" : "ed_nada");
}

function edIrParaLinha(n) {
  const ed = $("editalTexto");
  const L = ed.value.split("\n");
  let ini = 0;
  for (let i = 0; i < n - 1 && i < L.length; i++) ini += L[i].length + 1;
  ed.focus();
  ed.setSelectionRange(ini, ini + (L[n - 1] || "").length);
  ed.scrollTop = Math.max(0, (n - 3) * 19);
  edNumeros(L.length);
}

async function edAplicar(fn) {
  const antes = lerEdital($("editalTexto").value);
  const novo = fn($("editalTexto").value);
  const depois = lerEdital(novo);
  /* mesma rede da bancada de cartões: correção que perde tópico é recusada */
  const contar = (r) => r.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  if (contar(depois) < contar(antes)) {
    uiAlert(t("fix_would_lose", { a: contar(antes), d: contar(depois) }));
    reg("EDITAL", "correção cancelada: perderia tópicos");
    return;
  }
  $("editalTexto").value = novo;
  reg("EDITAL-CORRIGIR", fn.name || "corrigir",
      contar(antes) + "→" + contar(depois) + " tópicos");
  edRender();
}

/* O registro do edital não tinha NENHUM evento de conteúdo: dava para ver
 * o prompt sendo aberto e nada mais. Quando o usuário perguntou "o edital
 * veio completo?", não havia como responder. Agora cada mudança de peso
 * anota as contagens — e é o histórico delas que mostra o edital chegando
 * pela metade, ou encolhendo sem ninguém mandar. */
let edUltimaMarca = "";
let edTimerLog = null;
function edRegistrarConteudo(r) {
  const tops = r.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  const ign = r.achados.filter((x) => x.tipo === "linha_ignorada").length;
  const semPeso = r.disciplinas.reduce(
    (s, d) => s + d.topicos.filter((t) => t.herdado).length, 0);
  const marca = r.disciplinas.length + "/" + tops + "/" + ign + "/" + semPeso;
  if (marca === edUltimaMarca) return;      /* digitar não gera 200 linhas */
  edUltimaMarca = marca;
  clearTimeout(edTimerLog);
  edTimerLog = setTimeout(() => {
    reg("EDITAL-TEXTO", r.disciplinas.length + " disciplinas, " + tops + " tópicos",
        ign + " linhas ignoradas, " + semPeso + " sem peso");
  }, 800);
}

/* ==================================================================
 * O PAINEL
 * A tabela de 231 linhas responde "qual é a ordem?", que é uma pergunta
 * que se faz uma vez. O painel responde "e agora?", que se faz todo dia.
 * Por isso ele abre por padrão e a tabela vira a segunda aba.
 * ================================================================== */
let edVista = localStorage.getItem("eac_edital_vista") || "painel";
let edAbertas = {};        /* disciplinas expandidas */

/* Uma barra, duas camadas: o verde claro é o que foi estudado, o escuro
 * dentro dele é o que já foi revisado. Duas barras separadas fariam parecer
 * que são coisas somáveis — revisado é um SUBCONJUNTO de estudado. */
function edBarra(feitos, revisados, total, cls) {
  const d = document.createElement("div");
  d.className = "ed-barra" + (cls ? " " + cls : "");
  const f = document.createElement("div");
  f.className = "ed-barra-fill";
  f.style.width = (total ? Math.round((feitos / total) * 100) : 0) + "%";
  const rv = document.createElement("div");
  rv.className = "ed-barra-rev";
  rv.style.width = (total ? Math.round((revisados / total) * 100) : 0) + "%";
  d.append(f, rv);
  return d;
}

/* As duas réguas lado a lado. Contar tópicos e somar peso respondem
 * perguntas diferentes, e é a diferença entre elas que informa: "67% dos
 * tópicos, 7% do peso" quer dizer que o esforço foi para o lugar errado. */
function edMedida(rot, nTop, nTotal, pctPeso, cls) {
  const d = document.createElement("button");
  d.type = "button";
  d.className = "ed-medida " + (cls || "");
  d.title = t("ed_med_abrir");
  d.onclick = abrirDiario;
  const r = document.createElement("span");
  r.className = "ed-med-rot"; r.textContent = rot;
  const a = document.createElement("b");
  a.textContent = t("ed_med_top", { f: nTop, t: nTotal,
    p: nTotal ? Math.round((nTop / nTotal) * 100) : 0 });
  const b = document.createElement("b");
  b.className = "ed-med-peso";
  b.textContent = t("ed_med_peso", { p: pctPeso });
  d.append(r, a, b);
  return d;
}

function edPontos(itens) {
  const box = document.createElement("div");
  box.className = "ed-pontos";
  ["alta", "media", "baixa"].forEach((f) => {
    const n = itens.filter((i) => i.faixa === f).length;
    if (!n) return;
    const s = document.createElement("span");
    s.className = "faixa-" + f;
    s.textContent = "● " + n + " " + t("ed_faixa_" + f);
    box.append(s);
  });
  return box;
}

/* A linha era um <label> com a caixa dentro: clicar em qualquer lugar dela
 * alternava a marca, inclusive no botão "R", e o resultado era um estado que
 * parecia não desfazer. Agora é um <div>, e cada controle responde só por
 * si — quem clica na caixa marca a caixa; quem clica no R marca o R. */
function edLinhaTopico(i, semDisciplina) {
  const li = document.createElement("div");
  li.className = "ed-item" + (i.feito ? " feito" : "")
    + (i.revisado ? " revisado" : "") + (i.ehRevisao ? " ehrev" : "");

  /* Botão, não caixa. Marcar é rápido demais para o que significa: o registro
   * passa a perguntar QUANTO e COMO, porque é isso que permite, meses depois,
   * dizer "você lê muito e resolve pouca questão". Uma caixa nunca saberia. */
  const chk = document.createElement("button");
  chk.type = "button";
  chk.className = "ed-reg" + (i.revisado ? " rev" : (i.feito ? " ok" : ""));
  chk.textContent = i.revisado ? "✓✓" : (i.feito ? "✓" : "+");
  chk.title = t(i.feito ? "ed_reg_mais" : "ed_reg_novo");
  chk.onclick = (ev) => { ev.stopPropagation(); abrirRegistro(i); };

  const pt = document.createElement("span");
  pt.className = "ed-ponto ponto-" + i.faixa;

  const meio = document.createElement("div");
  meio.className = "ed-item-meio";
  const nome = document.createElement("div");
  nome.className = "ed-item-nome";
  nome.textContent = i.nome;
  const porq = document.createElement("div");
  porq.className = "ed-item-porque";
  if (!semDisciplina) {
    /* O nome da disciplina na agenda era texto morto: clicar nele é o gesto
     * óbvio de quem quer ver o resto da matéria, e não acontecia nada. */
    const bd = document.createElement("button");
    bd.type = "button";
    bd.className = "ed-item-disc-link";
    bd.textContent = i.disciplina;
    bd.title = t("ed_abrir_disc", { d: i.disciplina });
    bd.onclick = (ev) => { ev.stopPropagation(); abrirDisciplina(i.disciplina); };
    porq.append(bd, document.createTextNode(" · " + edPorque(i, true)));
  } else porq.textContent = edPorque(i, true);
  meio.append(nome, porq);

  const rev = document.createElement("button");
  rev.type = "button";
  rev.className = "ed-rev";
  rev.textContent = "↺";
  rev.title = t("ed_desmarcar");
  rev.style.visibility = i.feito ? "visible" : "hidden";
  rev.onclick = (ev) => { ev.stopPropagation(); edMarcar(i, null, null); };

  const min = document.createElement("b");
  min.className = "ed-item-min";
  /* "1h" diz quanto; "seg 19:00 · 1h" diz quando, e é o quando que vira
   * compromisso. A agenda só aparece na semana atual, onde faz sentido. */
  min.textContent = (i.dia ? i.dia + " " + i.hora + " · " : "") + horasTexto(i.minutos);

  li.append(chk, pt, meio, rev, min);
  return li;
}

/* A frase que explica a recomendação. Sem ela, "Esta semana" é uma ordem sem
 * argumento — e ordem sem argumento a pessoa ignora, ou pior, segue sem
 * perceber que está errada. */
function edPorque(i, semDisciplina) {
  const p = i.porque || {};
  const disc = semDisciplina ? "" : i.disciplina + " · ";
  const fatia = t("ed_pq_fatia", { p: p.fatia });
  if (p.tipo === "rev_vencida")
    return disc + t("ed_pq_rev_vencida", { n: p.dias }) + " · " + fatia;
  if (p.tipo === "rev_pendente") return disc + t("ed_pq_rev_pendente") + " · " + fatia;
  if (p.tipo === "concluido") return disc + t("ed_pq_concluido");
  return disc + t("ed_pq_peso", { peso: p.peso, faixa: t("ed_faixa_" + i.faixa) })
    + " · " + fatia;
}

/* ------------------------------------------------------------------
 * DIÁRIO DE ESTUDOS
 * O progresso diz ONDE você está; o diário diz COMO chegou lá. É ele que
 * responde "quanto rendeu esta semana?" — pergunta que o estado atual não
 * sabe responder, porque ele só guarda o resultado. Append-only.
 * ------------------------------------------------------------------ */
let edDiario = [];
const DIARIO_MAX = 1500;

function carregarDiario() {
  try { edDiario = JSON.parse(localStorage.getItem("eac_edital_diario") || "[]"); }
  catch (e) { edDiario = []; }
  if (!Array.isArray(edDiario)) edDiario = [];
}
function salvarDiario() {
  while (edDiario.length > DIARIO_MAX) edDiario.shift();
  try { localStorage.setItem("eac_edital_diario", JSON.stringify(edDiario)); }
  catch (e) {}
}
function hojeISO() { return new Date().toISOString().slice(0, 10); }

function anotarDiario(i, acao, detalhe) {
  edDiario.push({ d: hojeISO(), c: i.chave, n: i.nome, disc: i.disciplina,
                  p: i.bruto, m: (detalhe && detalhe.minutos) || i.minutos,
                  f: (detalhe && detalhe.formas) || null,
                  hu: (detalhe && detalhe.humor) || null, a: acao });
  salvarDiario();
}

/* O diário nasceu na v8.58; quem já tinha progresso marcado via o contador
 * cheio e o diário vazio — dois números do mesmo app se contradizendo. Aqui
 * o que já estava marcado entra como registro, com a data que houver. */
function completarDiario(itens) {
  const tem = new Set(edDiario.map((x) => x.c));
  let n = 0;
  (itens || []).forEach((i) => {
    if (!i.estado || tem.has(i.chave)) return;
    edDiario.push({ d: i.quando || "?", c: i.chave, n: i.nome, disc: i.disciplina,
                    p: i.bruto, m: i.minutos, f: null, a: i.estado, retro: true });
    n++;
  });
  if (n) { salvarDiario(); reg("EDITAL-DIARIO", n + " marca(s) antigas viraram registro"); }
}

function estatisticasDiario(dias) {
  const limite = Date.now() - (dias || 7) * 86400000;
  const recentes = edDiario.filter((x) => new Date(x.d + "T00:00:00") >= limite
    && x.a !== "pendente");
  return {
    eventos: recentes.length,
    topicos: new Set(recentes.map((x) => x.c)).size,
    peso: recentes.reduce((a, x) => a + (x.p || 0), 0),
    minutos: recentes.reduce((a, x) => a + (x.m || 0), 0),
    revisoes: recentes.filter((x) => x.a === "revisado").length,
  };
}

/* Apagar um registro do diário desfaz a marca, quando ele for o ÚLTIMO
 * daquele tópico: o estado volta a ser o que o registro anterior dizia, ou
 * pendente se não houver. Sem isso o diário viraria um arquivo de coisas
 * erradas que ninguém consegue consertar. */
function apagarDoDiario(idx) {
  const x = edDiario[idx];
  if (!x) return;
  const ultimoDoTopico = edDiario.reduce(
    (m, y, k) => (y.c === x.c ? k : m), -1) === idx;
  edDiario.splice(idx, 1);
  if (ultimoDoTopico) {
    const ant = edDiario.filter((y) => y.c === x.c).pop();
    if (ant && ant.a !== "pendente") edProgresso[x.c] = { e: ant.a, d: ant.d };
    else delete edProgresso[x.c];
  }
  salvarDiario();
  reg("EDITAL-DIARIO", "registro apagado: " + x.n, x.a + " de " + x.d);
  edRender();
  abrirDiario();
}

/* Ver ANTES de decidir. O botão gerava o prompt direto: o usuário recebia um
 * pedido pronto para a IA sem nunca ter lido o que estava errado, e aceitar
 * ou recusar a correção virava um ato de fé. Primeiro o diagnóstico, em
 * português; o prompt fica a um clique, para quem quiser. */
function abrirDiagPlano() {
  const r = lerEdital($("editalTexto").value);
  const plano = montarPlano(r, { horas: Number($("edHoras").value),
    prova: $("edProva").value, feitos: edProgresso });
  const achados = diagnosticoPlano(r, plano);
  $("dpResumo").textContent = t("ed_diag_estado", { d: r.disciplinas.length,
    t: plano.total, s: plano.semanas === null ? "?" : plano.semanas, h: r.cfg.horas });
  const lista = $("dpLista");
  lista.innerHTML = "";
  if (!achados.length) {
    const p = document.createElement("div");
    p.className = "nota"; p.textContent = t("ed_diag_limpo");
    lista.append(p);
  }
  achados.forEach((a) => {
    const li = document.createElement("div");
    li.className = "dp-item" + (a.grave ? " grave" : "");
    const selo = document.createElement("span");
    selo.className = "dp-selo";
    selo.textContent = t(a.grave ? "ed_dp_grave" : "ed_dp_atencao");
    const tx = document.createElement("span");
    tx.textContent = a.msg;
    li.append(selo, tx);
    lista.append(li);
  });
  diagAchados = achados;
  diagPlanoAtual = { r, plano };
  reg("EDITAL-DIAG", achados.length + " impropriedade(s)",
      achados.filter((a) => a.grave).length + " grave(s)");
  $("dlgDiagPlano").showModal();
}

let diagAchados = [];
let diagPlanoAtual = null;

function gerarPromptDoDiag() {
  if (!diagPlanoAtual) return;
  const { r, plano } = diagPlanoAtual;
  const L = [t("ed_diag_cab"), ""];
  L.push(t("ed_diag_estado", { d: r.disciplinas.length, t: plano.total,
    s: plano.semanas === null ? "?" : plano.semanas, h: r.cfg.horas }));
  L.push("");
  if (!diagAchados.length) L.push(t("ed_diag_limpo"));
  else diagAchados.forEach((a, k) =>
    L.push((k + 1) + ". " + (a.grave ? "[GRAVE] " : "") + a.msg));
  L.push("", t("ed_diag_pedido"), "", "PLANO ATUAL:", $("editalTexto").value);
  $("dlgDiagPlano").close();
  abrirTextoSimples(t("ed_diag_btn"), L.join("\n"));
}

function abrirDiario() {
  const lista = $("diarioLista");
  lista.innerHTML = "";
  const st = estatisticasDiario(7);
  $("diarioResumo").textContent = t("ed_diario_resumo", { t: st.topicos,
    r: st.revisoes, h: horasTexto(st.minutos), e: edDiario.length });
  if (!edDiario.length) {
    const p = document.createElement("div");
    p.className = "nota"; p.textContent = t("ed_diario_vazio");
    lista.append(p);
  }
  /* mais recente primeiro: o registro errado costuma ser o que acabou de
   * ser feito, e obrigar a rolar até o fim para achá-lo seria hostil */
  edDiario.slice().reverse().forEach((x, k) => {
    const idx = edDiario.length - 1 - k;
    const li = document.createElement("div");
    li.className = "diario-item";
    const q = document.createElement("span");
    q.className = "di-data"; q.textContent = x.d;
    const ac = document.createElement("span");
    ac.className = "di-acao acao-" + x.a;
    ac.textContent = t("ed_acao_" + x.a);
    const nm = document.createElement("span");
    nm.className = "di-nome"; nm.textContent = x.n;
    const ds = document.createElement("span");
    ds.className = "di-disc"; ds.textContent = x.disc;
    const bt = botaoMini("ed_diario_apagar", "btn-cinza", () => apagarDoDiario(idx));
    li.append(q, ac, nm, ds, bt);
    lista.append(li);
  });
  $("dlgDiario").showModal();
}

/* Formas de estudo. A lista é curta de propósito: dez opções viram uma
 * decisão a cada registro, e decisão a cada registro é o que faz a pessoa
 * parar de registrar. */
const ED_FORMAS = ["leitura", "videoaula", "questoes", "resumo", "mapa", "revisao"];
/* Produtividade percebida. Três níveis: cinco viram uma decisão demorada
 * sobre algo que é sensação, não medida. */
const ED_HUMOR = ["ruim", "media", "boa"];
let regAtual = null;
let regFormas = [];
let regHumor = "media";

function abrirRegistro(i) {
  regAtual = i;
  regFormas = i.feito ? ["revisao"] : ["leitura"];
  regHumor = "media";
  $("regTitulo").textContent = i.nome;
  $("regSub").textContent = i.disciplina + " · " + edPorque(i, true);
  $("regMinutos").value = i.minutos;
  $("regMinSlider").value = Math.min(240, i.minutos);

  const cx = $("regFormas");
  cx.innerHTML = "";
  ED_FORMAS.forEach((f) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reg-forma" + (regFormas.includes(f) ? " ativa" : "");
    b.textContent = t("ed_forma_" + f);
    /* várias formas por sessão: quase ninguém só lê — lê, assiste e resolve
     * questão na mesma hora, e obrigar a escolher uma falsifica o registro */
    b.onclick = () => {
      const k = regFormas.indexOf(f);
      if (k >= 0) { if (regFormas.length > 1) regFormas.splice(k, 1); }
      else regFormas.push(f);
      b.classList.toggle("ativa", regFormas.includes(f));
    };
    cx.append(b);
  });

  const hx = $("regHumor");
  hx.innerHTML = "";
  ED_HUMOR.forEach((hm) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reg-humor humor-" + hm + (hm === regHumor ? " ativa" : "");
    b.textContent = t("ed_humor_" + hm);
    b.onclick = () => {
      regHumor = hm;
      Array.from(hx.children).forEach((x) => x.classList.remove("ativa"));
      b.classList.add("ativa");
    };
    hx.append(b);
  });

  $("btnRegRevisao").hidden = !i.feito;
  $("dlgRegistro").showModal();
}

function confirmarRegistro(estado) {
  if (!regAtual) return;
  edMarcar(regAtual, estado, {
    minutos: Math.max(1, Number($("regMinutos").value) || regAtual.minutos),
    formas: regFormas.slice(),
    humor: regHumor,
  });
  $("dlgRegistro").close();
  regAtual = null;
}

function edMarcar(i, estado, detalhe) {
  if (estado) edProgresso[i.chave] = { e: estado, d: hojeISO() };
  else delete edProgresso[i.chave];
  anotarDiario(i, estado || "pendente", detalhe);
  reg("EDITAL-PROGRESSO", (estado || "pendente") + ": " + i.nome,
      /* "peso 25" parecia valor fora de escala; 5×5 mostra de onde veio */
      i.disciplina + " · peso " + i.disciplinaPeso + "×" + i.peso);
  edRender();
}

/* Ritmo em vez de veredito. "121 ficam de fora" encerra o assunto; ritmo
 * observado ao lado do necessário mostra o tamanho do ajuste — e sobre isso
 * dá para agir. As duas barras usam a MESMA escala, senão a comparação
 * mente. */
function edPintarRitmo(plano) {
  const box = $("edRitmo");
  box.innerHTML = "";
  const R = ritmoDoPlano(plano, edDiario);
  if (!plano.total || R.necessarioMin === null) { box.hidden = true; return; }
  box.hidden = false;

  const escala = Math.max(R.necessarioMin, R.observadoMin, R.planejadoMin || 0) || 1;
  const linha = (rot, min, cls, extra) => {
    const d = document.createElement("div");
    d.className = "rt-linha " + cls;
    const r1 = document.createElement("span");
    r1.className = "rt-rot"; r1.textContent = rot;
    const barra = document.createElement("div");
    barra.className = "rt-barra";
    const fill = document.createElement("div");
    fill.className = "rt-fill";
    fill.style.width = Math.round((min / escala) * 100) + "%";
    barra.append(fill);
    const v = document.createElement("b");
    v.textContent = horasTexto(min) + (extra ? " · " + extra : "");
    d.append(r1, barra, v);
    return d;
  };

  box.append(linha(t("ed_rt_necessario"), R.necessarioMin, "rt-nec",
    t("ed_rt_topicos", { n: R.necessarioTop })));
  box.append(linha(t("ed_rt_planejado"), R.planejadoMin || 0, "rt-pla"));
  if (R.semanasComRegistro)
    box.append(linha(t("ed_rt_observado"), R.observadoMin, "rt-obs",
      t("ed_rt_semanas", { n: R.semanasComRegistro })));

  const nota = document.createElement("div");
  nota.className = "rt-nota";
  if (!R.semanasComRegistro) nota.textContent = t("ed_rt_sem_dados");
  else if (R.razao >= 1) nota.textContent = t("ed_rt_no_ritmo");
  else nota.textContent = t("ed_rt_atras", {
    p: Math.round((1 - R.razao) * 100), a: R.alcance, t: plano.total });
  box.append(nota);

  if (plano.fora.length) {
    const fora = document.createElement("div");
    fora.className = "rt-fora";
    fora.textContent = t("ed_rt_fora", { n: plano.fora.length,
      cabem: plano.fila.length, h: plano.horasNecessarias });
    box.append(fora);
  }
}

/* Abre a disciplina no painel e leva o olho até ela. Só expandir não basta:
 * com dezessete cartões, o que abriu pode estar fora da tela. */
function abrirDisciplina(nome) {
  edAbertas[nome] = true;
  edVista = "painel";
  edRender();
  const alvoCard = (edCards || {})[nome];
  if (alvoCard && alvoCard.scrollIntoView)
    alvoCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

let edCards = {};

function edPintarPainel(r, plano) {
  const box = $("edPainel");
  box.innerHTML = "";
  edCards = {};
  if (!plano.total) {
    const p = document.createElement("div");
    p.className = "esq-vazio"; p.textContent = t("ed_vazio");
    box.append(p); return;
  }

  /* -------- topo: progresso e contagem regressiva -------- */
  const topo = document.createElement("div");
  topo.className = "ed-topo";
  const nome = document.createElement("div");
  nome.className = "ed-topo-nome";
  nome.textContent = r.cfg.concurso || t("ed_sem_nome");
  topo.append(nome,
    edBarra(plano.feitos, plano.revisados, plano.total, "grande"));
  const meds = document.createElement("div");
  meds.className = "ed-medidas";
  meds.append(
    edMedida(t("ed_estudado"), plano.feitos, plano.total, plano.peso.pctFeito, "m-feito"),
    edMedida(t("ed_revisado"), plano.revisados, plano.total, plano.peso.pctRevisado, "m-rev"));
  topo.append(meds);
  const st = estatisticasDiario(7);
  if (st.eventos) {
    const linha = document.createElement("div");
    linha.className = "ed-diario";
    linha.title = t("ed_med_abrir");
    linha.onclick = abrirDiario;
    linha.textContent = t("ed_diario_7", { t: st.topicos, r: st.revisoes,
      h: horasTexto(st.minutos) });
    topo.append(linha);
  }
  /* O aviso que dá o recado do painel inteiro: quando a contagem de tópicos
   * anda muito à frente do peso, o esforço está indo para o lado leve. */
  const pctTop = plano.total ? Math.round((plano.feitos / plano.total) * 100) : 0;
  if (plano.feitos >= 5 && pctTop - plano.peso.pctFeito >= 10) {
    const al = document.createElement("div");
    al.className = "ed-alerta-peso";
    al.textContent = t("ed_desalinhado", { top: pctTop, peso: plano.peso.pctFeito });
    topo.append(al);
  }
  const sub = document.createElement("div");
  sub.className = "ed-topo-sub";
  const esq = document.createElement("span");
  esq.textContent = "";
  const dir = document.createElement("span");
  const sem = semanaAtual(plano);
  dir.textContent = plano.semanas === null ? t("ed_sem_data")
    : t("ed_topo_semana", { n: sem.length,
        h: horasTexto(sem.reduce((a, i) => a + i.minutos, 0)) });
  sub.append(esq, dir);
  topo.append(sub);
  box.append(topo);

  /* -------- esta semana: a lista curta -------- */
  if (sem.length) {
    const cx = document.createElement("div");
    cx.className = "ed-caixa";
    const h = document.createElement("div");
    h.className = "ed-caixa-tit";
    h.textContent = t("ed_esta_semana");
    const expl = document.createElement("div");
    expl.className = "ed-caixa-sub";
    expl.textContent = t("ed_semana_expl", { n: sem.length,
      r: sem.filter((i) => i.ehRevisao).length,
      h: horasTexto(sem.reduce((a, i) => a + i.minutos, 0)) });
    cx.append(h, expl);
    agendar(sem, { dias: Number($("edDias").value) || 5,
                   inicio: $("edInicio").value || "19:00" });
    sem.forEach((i) => cx.append(edLinhaTopico(i)));
    box.append(cx);
  }

  /* -------- disciplinas: cartões com barra de progresso -------- */
  const grade = document.createElement("div");
  grade.className = "ed-grade";
  /* Ordenadas pelo PESO TOTAL NA PROVA, não pelo 1-5 da disciplina. São
   * coisas diferentes: Direito Constitucional (26 tópicos) e Noções de
   * Direito Penal (3 tópicos) podem ter o mesmo "peso 3" e mesmo assim
   * representar fatias muito diferentes do que a prova cobra. O que decide
   * é a soma de (peso da disciplina × peso do tópico) de todos os tópicos
   * dela. Empate desempata pelo mais atrasado. */
  const pesoDaDisc = {};
  const progDaDisc = {};
  r.disciplinas.forEach((d) => {
    const meus = plano.itens.filter((i) => i.disciplina === d.nome);
    pesoDaDisc[d.nome] = meus.reduce((a, i) => a + i.bruto, 0);
    progDaDisc[d.nome] = meus.length
      ? meus.filter((i) => i.feito).length / meus.length : 1;
  });
  const ordenadas = r.disciplinas.slice().sort((a, b) =>
    (pesoDaDisc[b.nome] - pesoDaDisc[a.nome]) || (progDaDisc[a.nome] - progDaDisc[b.nome]));
  ordenadas.forEach((d) => {
    const meus = plano.itens.filter((i) => i.disciplina === d.nome);
    if (!meus.length) return;
    const feitos = meus.filter((i) => i.feito).length;
    const revs = meus.filter((i) => i.revisado).length;
    const pesoD = somarPeso(meus);
    const card = document.createElement("div");
    card.className = "ed-card" + (revs === meus.length ? " completo"
      : (feitos === meus.length ? " estudado" : ""));

    const cab = document.createElement("div");
    cab.className = "ed-card-cab";
    const tit = document.createElement("button");
    tit.type = "button";
    tit.className = "ed-card-nome";
    tit.textContent = d.nome;
    tit.title = t("ed_abrir");
    tit.onclick = () => { edAbertas[d.nome] = !edAbertas[d.nome]; edRender(); };
    /* peso editável ali mesmo: mexer no peso é a ação que mais muda o plano,
     * e mandar o usuário procurar a linha no texto é pedir para não fazer */
    const sel = document.createElement("select");
    sel.className = "ed-peso" + (temPesosIguais(r) ? " suspeito" : "");
    [1, 2, 3, 4, 5].forEach((n) => {
      const o = document.createElement("option");
      o.value = n; o.textContent = t("ed_peso_n", { n });
      if (n === d.peso) o.selected = true;
      sel.append(o);
    });
    sel.onchange = () => edMudarPeso(d, Number(sel.value));
    cab.append(tit, sel);
    card.append(cab, edBarra(feitos, revs, meus.length));

    const cont = document.createElement("div");
    cont.className = "ed-card-conta";
    cont.textContent = t("ed_card_conta", { f: feitos, t: meus.length,
      p: pesoD.pctFeito, r: revs });
    /* Quanto ESTA disciplina representa da prova inteira. É o número que
     * justifica a ordem dos cartões e o que decide onde investir a semana. */
    const fatia = document.createElement("div");
    fatia.className = "ed-fatia";
    const share = Math.round((pesoDaDisc[d.nome] / (plano.peso.total || 1)) * 100);
    fatia.textContent = t("ed_fatia", { p: share });
    cab.append(fatia);
    card.append(cont, edPontos(meus));

    const abrir = document.createElement("button");
    abrir.className = "ed-abrir";
    abrir.textContent = edAbertas[d.nome] ? t("ed_fechar") : t("ed_abrir");
    abrir.onclick = () => { edAbertas[d.nome] = !edAbertas[d.nome]; edRender(); };
    card.append(abrir);
    if (edAbertas[d.nome]) {
      const lista = document.createElement("div");
      lista.className = "ed-card-lista";
      meus.forEach((i) => lista.append(edLinhaTopico(i, true)));
      card.append(lista);
    }
    edCards[d.nome] = card;
    grade.append(card);
  });
  box.append(grade);
}

/* Mudar o peso reescreve o TEXTO — nunca um estado paralelo. Enquanto texto
 * e tela puderem divergir, uma das duas está mentindo, e o usuário não tem
 * como saber qual. */
/* As horas moram na linha "#" do texto, igual aos pesos nas linhas "@".
 * Antes o controle mudava só o campo e o edRender seguinte lia o texto e
 * devolvia o valor antigo — arrastar parecia não funcionar, e não funcionava
 * mesmo. Uma fonte da verdade só. */
function edMudarHoras(h) {
  const horas = Math.max(1, Math.min(80, Math.round(Number(h) || 1)));
  const r = lerEdital($("editalTexto").value);
  const L = $("editalTexto").value.split(/\r?\n/);
  const cab = [];
  if (r.cfg.concurso) cab.push(r.cfg.concurso);
  if (r.cfg.prova) cab.push("prova: " + r.cfg.prova);
  cab.push("horas: " + horas);
  const i = L.findIndex((l) => /^\s*#/.test(l));
  if (i < 0) L.unshift("# " + cab.join(" | ")); else L[i] = "# " + cab.join(" | ");
  $("editalTexto").value = L.join("\n");
  $("edHoras").value = horas;
  $("edHorasSlider").value = horas;
  reg("EDITAL-HORAS", horas + "h por semana");
  edRender();
}

function edMudarPeso(disc, peso) {
  const L = $("editalTexto").value.split(/\r?\n/);
  const i = disc.linha - 1;
  if (!L[i]) return;
  const partes = L[i].replace(/^@\s*/, "").split("::").map((s) => s.trim());
  L[i] = "@ " + partes[0] + " :: " + peso;
  $("editalTexto").value = L.join("\n");
  reg("EDITAL-PESO", disc.nome, disc.peso + " → " + peso);
  edRender();
}

function edTrocarVista(v) {
  edVista = v;
  localStorage.setItem("eac_edital_vista", v);
  $("edPainel").hidden = v !== "painel";
  $("edListaBox").hidden = v !== "lista";
  $("btnVistaPainel").classList.toggle("ativa", v === "painel");
  $("btnVistaLista").classList.toggle("ativa", v === "lista");
}

/* ------------------------------------------------------------------
 * COLAR O PLANO CORRIGIDO
 * Faltava o outro lado da ponte: o app gerava o prompt e não dizia para
 * onde a resposta volta. Aqui ela volta com CONFERÊNCIA — o número de
 * tópicos antes e depois é comparado, porque a IA resumir um edital de 231
 * linhas é exatamente o que ela faz quando o pedido é longo.
 * ------------------------------------------------------------------ */
function edConferirColagem() {
  const novoTxt = $("edColarTexto").value;
  const av = $("edColarAviso");
  if (!novoTxt.trim()) { av.hidden = true; return null; }
  const antes = lerEdital($("editalTexto").value);
  const depois = lerEdital(novoTxt);
  const nA = antes.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  const nD = depois.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  const ign = depois.achados.filter((a) => a.tipo === "linha_ignorada").length;
  const partes = [t("ed_colar_conf", { a: nA, d: nD,
    da: antes.disciplinas.length, dd: depois.disciplinas.length })];
  if (nD < nA) partes.push(t("ed_colar_perdeu", { n: nA - nD }));
  if (ign) partes.push(t("ed_colar_ignoradas", { n: ign }));
  av.hidden = false;
  av.textContent = partes.join(" ");
  av.classList.toggle("grave", nD < nA);
  return { nA, nD, novoTxt };
}

async function edAplicarColagem() {
  const c = edConferirColagem();
  if (!c) return;
  if (c.nD < c.nA) {
    if (!(await uiConfirm(t("ed_colar_confirma", { n: c.nA - c.nD })))) return;
  }
  guardarVersao("antes de colar o plano corrigido", $("editalTexto").value);
  $("editalTexto").value = c.novoTxt;
  reg("EDITAL-COLAR", "plano corrigido colado", c.nA + " → " + c.nD + " tópicos");
  $("dlgEdColar").close();
  edRender();
  toast("ed_colado");
}

/* Simulador de horas: a decisão é uma troca, e troca se decide vendo os dois
 * lados ao mesmo tempo. Antes o campo mudava o número e o efeito só aparecia
 * se o usuário fosse ler a tabela inteira. */
function edSimular() {
  const r = lerEdital($("editalTexto").value);
  const horas = Number($("edHorasSlider").value) || 1;
  const p = montarPlano(r, { horas, prova: $("edProva").value, feitos: edProgresso });
  const el = $("edSimTxt");
  el.innerHTML = "";
  if (!p.total) { el.textContent = ""; return; }
  const forte = document.createElement("b");
  forte.textContent = t("ed_sim_horas", { h: horas });
  const resto = document.createElement("span");
  if (p.semanas === null) resto.textContent = " " + t("ed_sem_data");
  else if (!p.fora.length) {
    resto.className = "ok";
    resto.textContent = " " + t("ed_sim_cabe", { n: p.fila.length });
  } else {
    resto.className = "falta";
    resto.textContent = " " + t("ed_sim_falta", { n: p.fila.length,
      f: p.fora.length, h: p.horasNecessarias });
  }
  el.append(forte, resto);
}

function edRender() {
  const raw = $("editalTexto").value;
  const r = lerEdital(raw);
  edRegistrarConteudo(r);
  edNumeros(raw.split("\n").length);
  edSugestoes(r);

  /* config: os campos de data e horas mandam no texto, e vice-versa */
  if (r.cfg.prova && $("edProva").value !== r.cfg.prova) $("edProva").value = r.cfg.prova;
  if (r.cfg.horas) { $("edHoras").value = r.cfg.horas; $("edHorasSlider").value = r.cfg.horas; }

  const plano = montarPlano(r, {
    horas: Number($("edHoras").value) || r.cfg.horas,
    prova: $("edProva").value, feitos: edProgresso,
  });
  const itens = plano.itens;
  const s = semanasAte($("edProva").value);
  $("edRestam").textContent = s
    ? t("ed_restam", { s: s.semanas, d: s.dias }) : t("ed_sem_data");
  $("edResumo").textContent = itens.length
    ? t("ed_resumo", { d: r.disciplinas.length, t: plano.total, f: plano.feitos,
                       p: plano.peso.pctFeito })
    : "";

  /* "Não cabe" dito com todas as letras. O modelo antigo espalhava minutos
   * até dar a soma certa e o usuário só descobria a impossibilidade quando
   * já tinha perdido semanas seguindo um plano que não fechava. */
  edPintarRitmo(plano);

  edSimular();
  completarDiario(plano.itens);
  edPintarPainel(r, plano);
  edTrocarVista(edVista);

  const tb = $("edTabela");
  tb.innerHTML = "";
  if (!itens.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5; td.className = "esq-vazio"; td.textContent = t("ed_vazio");
    tr.append(td); tb.append(tr); edSalvar(); return;
  }
  itens.forEach((i) => {
    const tr = document.createElement("tr");
    const feito = !!i.feito;
    if (feito) tr.className = "ed-feito";
    const cel = (txt, cls) => {
      const td = document.createElement("td");
      td.textContent = txt; if (cls) td.className = cls; return td;
    };
    const tdNome = cel(i.nome);
    if (i.motivo) { tdNome.title = i.motivo; tdNome.classList.add("ed-tem-motivo"); }
    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = feito;
    chk.onchange = () => {
      if (chk.checked) edProgresso[edChave(i)] = true;
      else delete edProgresso[edChave(i)];
      reg("EDITAL-PROGRESSO", (chk.checked ? "feito: " : "desfeito: ") + i.nome);
      edRender();
    };
    const tdOk = document.createElement("td");
    tdOk.append(chk);
    const tdPri = cel(String(i.prioridade), "ed-pri faixa-" + i.faixa);
    const pt = document.createElement("span");
    pt.className = "ed-ponto ponto-" + i.faixa;
    tdPri.prepend(pt);
    tr.append(tdNome, cel(i.disciplina, "ed-disc"), tdPri,
              cel(i.semana ? t("ed_sem_n", { n: i.semana })
                           : (i.feito ? "—" : t("ed_fora")), "ed-h"), tdOk);
    tb.append(tr);
  });
  edSalvar();
}

/* --------- ligações da tela --------- */
function edIniciar() {
  const guardado = localStorage.getItem("eac_edital_texto");
  if (guardado) $("editalTexto").value = guardado;
  carregarDiario();
  try { edProgresso = JSON.parse(localStorage.getItem("eac_edital_progresso") || "{}"); }
  catch (e) { edProgresso = {}; }

  $("editalTexto").addEventListener("input", edRender);
  $("editalTexto").addEventListener("scroll", () => {
    $("editalNums").scrollTop = $("editalTexto").scrollTop;
  });
  $("edProva").onchange = edRender;
  $("edHoras").onchange = () => edMudarHoras($("edHoras").value);
  /* "input" e não "change": o valor tem de responder enquanto o dedo arrasta,
   * senão deixa de ser simulação e vira mais um campo para preencher. */
  $("edHorasSlider").addEventListener("input", edSimular);
  $("edHorasSlider").addEventListener("change", () => edMudarHoras($("edHorasSlider").value));
  $("btnDiarioFechar").onclick = () => $("dlgDiario").close();
  $("btnDpFechar").onclick = () => $("dlgDiagPlano").close();
  $("btnDpPrompt").onclick = gerarPromptDoDiag;
  /* os dois campos de tempo são o MESMO valor: arrastar move o número e
   * digitar move a barra. Dois controles que discordam são um bug esperando. */
  $("regMinSlider").addEventListener("input", () => {
    $("regMinutos").value = $("regMinSlider").value;
  });
  $("regMinutos").addEventListener("input", () => {
    const v = Math.max(5, Math.min(240, Number($("regMinutos").value) || 5));
    $("regMinSlider").value = v;
  });
  $("edDias").onchange = edRender;
  $("edInicio").onchange = edRender;
  $("btnRegFechar").onclick = () => { $("dlgRegistro").close(); regAtual = null; };
  $("btnRegEstudo").onclick = () => confirmarRegistro("feito");
  $("btnRegRevisao").onclick = () => confirmarRegistro("revisado");
  $("btnEditalColar").onclick = () => {
    $("edColarTexto").value = "";
    $("edColarAviso").hidden = true;
    $("dlgEdColar").showModal();
  };
  $("edColarTexto").addEventListener("input", edConferirColagem);
  $("btnEdColarAplicar").onclick = edAplicarColagem;
  $("btnEdColarFechar").onclick = () => $("dlgEdColar").close();
  $("btnEditalCorrigir").onclick = () => {
    if (edCorrecaoPendente) edAplicar(edCorrecaoPendente);
  };
  $("btnEditalPrompt").onclick = () => {
    abrirTextoSimples(t("ed_prompt_btn"), t("ed_prompt"));
    reg("EDITAL", "prompt de organização aberto");
  };
  $("btnEditalCopiar").onclick = async () => {
    try { await navigator.clipboard.writeText($("editalTexto").value); toast("toast_copied"); }
    catch (e) { uiAlert(t("toast_copy_fail")); }
  };
  $("btnEditalLimpar").onclick = async () => {
    const r = lerEdital($("editalTexto").value);
    const itens = priorizar(r);
    const feitos = itens.filter((i) => edProgresso[edChave(i)]).length;
    if (!itens.length && !$("editalTexto").value.trim()) return;
    if (!(await uiConfirm(t("ed_limpar_conf", { t: itens.length, f: feitos })))) return;
    reg("EDITAL", "edital apagado", itens.length + " tópicos");
    $("editalTexto").value = ""; edProgresso = {};
    edRender();
  };
  $("btnEditalDiag").onclick = abrirDiagPlano;
  $("btnVistaPainel").onclick = () => edTrocarVista("painel");
  $("btnVistaLista").onclick = () => edTrocarVista("lista");
  $("btnEditalCsv").onclick = () => {
    const r = lerEdital($("editalTexto").value);
    const plano = montarPlano(r, { horas: Number($("edHoras").value),
      prova: $("edProva").value, feitos: edProgresso });
    const itens = plano.itens;
    /* ponto e vírgula e vírgula decimal: é o que o Excel em português abre
       com dois cliques, sem assistente de importação */
    const linhas = ["Disciplina;Peso disc.;Tópico;Peso tóp.;Prioridade;Faixa;Semana;Minutos;Feito;Por quê"];
    itens.forEach((i) => linhas.push([i.disciplina, i.disciplinaPeso, i.nome, i.peso,
      i.prioridade, i.faixa, i.semana || "fora", i.minutos,
      i.feito ? "sim" : "não", i.motivo || ""]
      .map((c) => String(c).replace(/;/g, ",")).join(";")));
    const url = URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")],
      { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "edital-priorizado.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    reg("EDITAL", "csv baixado", itens.length + " tópicos");
  };
  edRender();
}
