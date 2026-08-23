/* =====================================================================
 * A TELA DO EDITAL
 * Espelha a bancada de cartões de propósito: mesma caixa com números de
 * linha, mesmos botões de topo, mesma lista de sugestões com quem corrige
 * o quê, mesmo registro. Quem aprendeu um lado já sabe usar o outro.
 * ===================================================================== */

let edProgresso = {};      /* nome do tópico -> true */
let edCorrecaoPendente = null;

/* H5 — "Buscar tópico" (antes "Lista completa").
 * Estado próprio: o que se procura, sob qual filtro, e o que está marcado
 * para a ação em lote. */
let edBusca = "";
let edFiltro = "tudo";
let edSelecao = new Set();

function edSalvar() {
  try {
    /* Os dois slots antigos continuam sendo a cópia de trabalho do edital
     * ABERTO — é o que a bancada inteira já lê e escreve. O que mudou em
     * 8.68 é que eles deixaram de ser o destino final: cada gravação também
     * cai dentro do registro do edital na lista. Sem esse espelho, trocar
     * de edital sobrescreveria o outro. */
    guardar("eac_edital_texto", $("editalTexto").value);
    guardar("eac_edital_progresso", JSON.stringify(edProgresso));
  } catch (e) {}
  if (typeof edAberto === "function") {
    const alvo = edAberto();
    if (alvo) {
      alvo.texto = $("editalTexto").value;
      alvo.progresso = edProgresso;
      alvo.tocado = new Date().toISOString();
      /* o nome segue o cabeçalho do edital enquanto ninguém renomear à mão */
      const cfg = (lerEdital(alvo.texto).cfg) || {};
      if (cfg.concurso && !alvo.renomeado) alvo.nome = cfg.concurso;
      edSalvarLista();
    }
  }
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
let edAbertas = {};
let edAgendaAberta = false;        /* disciplinas expandidas */

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
/* Minutos já registrados NAQUELE tópico. A agenda dizia quanto o tópico
 * pede e nunca quanto você já pôs nele — e a diferença entre "1h de 1h" e
 * "10min de 1h" é o que decide se você continua ou passa para o próximo. */
function minutosDoTopico(chave) {
  return (edDiario || []).reduce((a, x) => {
    if (!x || x.a === "pendente") return a;
    const k = x.c || (typeof matChave === "function"
      ? matChave(x.disc, x.n) : "");
    return k === chave ? a + (Number(x.m) || 0) : a;
  }, 0);
}

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
  /* Selo além da cor: quem imprime em preto e branco, ou não distingue
   * azul de cinza, continua sabendo o que é revisão. */
  if (i.ehRevisao) {
    const selo = document.createElement("span");
    selo.className = "ed-selo-rev";
    selo.textContent = t("ed_selo_revisao");
    selo.title = t("ed_selo_revisao_ajuda");
    nome.append(selo);
  }
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

  /* O material do tópico, a um clique da agenda. Vazio por padrão; o ponto
   * verde aparece quando existe conteúdo, para dar para varrer a semana e
   * ver o que já tem resumo sem abrir nada. */
  const doc = document.createElement("button");
  doc.type = "button";
  const ch = matChave(i.disciplina, i.nome);
  const temTxt = !!(matObter(ch) && String(matObter(ch).texto || "").trim());
  const nCard = matContarCartoes(ch);
  /* três estados, não dois: nada, resumo, e resumo COM cartões. Saber que o
   * tópico já virou cartão muda o que fazer com a hora de estudo. */
  doc.className = "ed-doc" + (temTxt || nCard ? " tem" : "") + (nCard ? " cards" : "");
  doc.textContent = nCard ? "🗂" : "📄";
  doc.title = nCard ? t("mat_ver_cards", { n: i.nome, c: nCard })
    : t(temTxt ? "mat_ver" : "mat_criar", { n: i.nome });
  if (nCard) {
    const sel = document.createElement("span");
    sel.className = "ed-doc-n";
    sel.textContent = nCard;
    doc.append(sel);
  }
  doc.onclick = (ev) => { ev.stopPropagation(); matAbrirEditor(i); };

  const min = document.createElement("b");
  min.className = "ed-item-min";
  /* "1h" diz quanto; "seg 19:00 · 1h" diz quando, e é o quando que vira
   * compromisso. A agenda só aparece na semana atual, onde faz sentido. */
  /* SÓ O DIA. O horário de início era invenção do app: ninguém estuda às
   * 05:40 porque uma conta de divisão disse isso, e o número dava ao plano
   * uma precisão que ele não tem. O que serve é o dia e quanto tempo. */
  min.textContent = (i.dia ? i.dia + " · " : "") + horasTexto(i.minutos);

  /* BARRA DO TÓPICO: o que você já pôs contra o que ele pede. */
  const feitoMin = minutosDoTopico(i.chave);
  const pctT = i.minutos ? Math.min(100, Math.round((feitoMin / i.minutos) * 100)) : 0;
  const barraT = document.createElement("div");
  barraT.className = "it-barra";
  const fillT = document.createElement("div");
  fillT.className = "it-fill" + (pctT >= 100 ? " cheio" : (pctT > 0 ? " parcial" : ""));
  fillT.style.width = pctT + "%";
  barraT.append(fillT);
  barraT.title = t("ed_it_barra", {
    f: horasTexto(feitoMin), p: horasTexto(i.minutos), pct: pctT });
  meio.append(barraT);
  /* O NÚMERO AO LADO DA BARRA. Barra sozinha se lê "mais ou menos pela
   * metade" — e "25min de 1h" é uma decisão diferente de "50min de 1h".
   * Só aparece quando há tempo registrado: escrever "0min de 1h · 0%" em
   * 230 linhas seria ruído em cima do que ainda não começou. */
  if (feitoMin > 0) {
    const num = document.createElement("div");
    num.className = "it-num" + (pctT >= 100 ? " cheio" : "");
    num.textContent = t("ed_it_num", {
      f: horasTexto(feitoMin), p: horasTexto(i.minutos), pct: pctT });
    meio.append(num);
  }

  /* a despedida precisa reencontrar esta linha depois; sem a chave aqui ela
   * teria de comparar por texto, que quebra com nomes parecidos */
  /* CARTÕES do tópico, direto da agenda — do mesmo jeito que o resumo.
   * Antes só o resumo tinha porta aqui; para fazer cartão era preciso abrir
   * o material, entrar no painel e voltar. */
  const crt = document.createElement("button");
  crt.type = "button";
  const nCards = matContarCartoes(matChave(i.disciplina, i.nome));
  crt.className = "ed-crt" + (nCards ? " tem" : "");
  crt.textContent = "🃏";
  crt.title = t(nCards ? "ed_crt_ver" : "ed_crt_novo", { n: i.nome, c: nCards });
  crt.onclick = (ev) => {
    ev.stopPropagation();
    /* CARTÃO NÃO PRECISA DO RESUMO.
     * Antes isto abria o resumo em modo de EDIÇÃO e, por cima, o painel de
     * cartões: para rever um cartão a pessoa passava pelo texto cru do
     * resumo, que não tem nada a ver com o gesto. Agora vai direto: tendo
     * cartões, abre o leitor; não tendo, abre a criação. */
    try {
      if (nCards) { mcEstudarDireto(i.disciplina, i.nome); return; }
      mcApontarTopico(i.disciplina, i.nome);
      matCartoesAbrir({ semGravarResumo: true });
    } catch (e) {}
  };

  /* LEI SECA do tópico, o terceiro documento da linha */
  const lei = document.createElement("button");
  lei.type = "button";
  const temLei = typeof leiTem === "function" && leiTem(matChave(i.disciplina, i.nome));
  lei.className = "ed-lei" + (temLei ? " tem" : "");
  lei.textContent = "⚖";
  lei.title = t(temLei ? "ed_lei_ver" : "ed_lei_novo", { n: i.nome });
  lei.onclick = (ev) => {
    ev.stopPropagation();
    if (typeof leiAbrir === "function") leiAbrir(i.disciplina, i.nome);
  };

  /* QUESTÕES do tópico, o quarto documento da linha.
   * Sem isto, responder as questões de um tópico exigia abrir o resumo e
   * procurar o botão lá dentro — três cliques para um gesto que a agenda
   * já oferece para resumo, cartões e lei seca. */
  const qst = document.createElement("button");
  qst.type = "button";
  const nQ = typeof qsContarDoTopico === "function"
    ? qsContarDoTopico(matChave(i.disciplina, i.nome)) : 0;
  qst.className = "ed-qst" + (nQ ? " tem" : "");
  qst.textContent = "❓";
  qst.title = t(nQ ? "ed_qst_ver" : "ed_qst_novo", { n: nQ, tp: i.nome });
  qst.onclick = (ev) => {
    ev.stopPropagation();
    if (typeof matAbrirEditor !== "function") return;
    /* abre o resumo do tópico e vai direto às questões: com questões,
     * responde; sem nenhuma, leva a criar — o mesmo caminho de dentro */
    matAbrirEditor({ disciplina: i.disciplina, nome: i.nome }, "ler");
    try { qsUiResponderDoTopico(); } catch (x) {}
  };

  li._itemChave = i.chave;
  li.append(chk, pt, meio, doc, crt, lei, qst, rev, min);
  return li;
}

/* A frase que explica a recomendação. Sem ela, "Esta semana" é uma ordem sem
 * argumento — e ordem sem argumento a pessoa ignora, ou pior, segue sem
 * perceber que está errada. */
function edPorque(i, semDisciplina) {
  const p = i.porque || {};
  const disc = semDisciplina ? "" : i.disciplina + " · ";
  /* "disciplina vale X% da prova" era a informação mais fraca da linha: é da
   * disciplina, não do tópico, e já aparece no painel e no mapa. Quando há
   * histórico em outro concurso, ela cede o lugar — porque "já vi isto há 9
   * dias" muda o que você faz agora, e a fatia da disciplina não. */
  const h = edMarcaHistorico(i);
  const fatia = h || t("ed_pq_fatia", { p: p.fatia });
  if (p.tipo === "rev_vencida")
    return disc + t("ed_pq_rev_vencida", { n: p.dias }) + " · " + fatia;
  if (p.tipo === "rev_pendente") return disc + t("ed_pq_rev_pendente") + " · " + fatia;
  if (p.tipo === "concluido") return disc + t("ed_pq_concluido");
  return disc + t("ed_pq_peso", { peso: p.peso, faixa: t("ed_faixa_" + i.faixa) })
    + " · " + fatia;
}

/* A marca de histórico, em texto curto. Devolve vazio quando não há
 * vínculo — e vazio é a resposta certa: inventar "sem histórico" em toda
 * linha só encheria a tela de ruído. */
function edMarcaHistorico(i) {
  if (typeof vkHistorico !== "function") return "";
  const h = vkHistorico(i.disciplina, i.nome, i.estado, edDiario);
  if (!h || h.marca === "sem_historico" || h.marca === "estudado_aqui"
      || h.marca === "revisado_aqui") return "";
  return t("vk_marca_" + h.marca, { c: h.concurso || "?", n: h.dias });
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
  try { guardar("eac_edital_diario", JSON.stringify(edDiario)); }
  catch (e) {}
}
function hojeISO() { return new Date().toISOString().slice(0, 10); }

/* Para QUAL concurso foi este estudo. Hoje o app tem um edital só, mas o
 * registro é para sempre: sem esta marca, o dia em que existirem dois planos
 * os históricos se misturam e não há como separá-los depois — informação que
 * não foi gravada na hora não se recupera. Enquanto os planos com nome não
 * existem, a identidade vem do cabeçalho "#" do edital. */
function concursoAtual() {
  try {
    const c = lerEdital($("editalTexto").value).cfg;
    return { nome: c.concurso || "", prova: c.prova || "" };
  } catch (e) { return { nome: "", prova: "" }; }
}

function anotarDiario(i, acao, detalhe) {
  edDiario.push({ d: hojeISO(), c: i.chave, n: i.nome, disc: i.disciplina,
                  p: i.bruto, m: (detalhe && detalhe.minutos) || i.minutos,
                  f: (detalhe && detalhe.formas) || null,
                  hu: (detalhe && detalhe.humor) || null, a: acao,
                  q: (detalhe && detalhe.questoes) || null,
                  onde: (detalhe && detalhe.onde) || null,
                  obs: (detalhe && detalhe.obs) || null,
                  cc: concursoAtual().nome });
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
                    p: i.bruto, m: i.minutos, f: null, a: i.estado, retro: true,
                    cc: concursoAtual().nome });
    n++;
  });
  if (n) { salvarDiario(); reg("EDITAL-DIARIO", n + " marca(s) antigas viraram registro"); }
}

/* Períodos do diário. "Últimos 7 dias" era a única janela, e ela não
 * responde "quanto rendi este mês" nem "quanto já pus neste ciclo". */
const DIARIO_PERIODOS = [7, 30, 90, 0];   /* 0 = tudo */
let diarioPeriodo = 7;

function estatisticasDiario(dias) {
  const n = dias === undefined ? 7 : dias;
  const limite = n ? Date.now() - n * 86400000 : 0;
  const recentes = edDiario.filter((x) => (!limite
      || new Date(x.d + "T00:00:00") >= limite)
    && x.a !== "pendente");
  return {
    eventos: recentes.length,
    topicos: new Set(recentes.map((x) => x.c)).size,
    peso: recentes.reduce((a, x) => a + (x.p || 0), 0),
    minutos: recentes.reduce((a, x) => a + (x.m || 0), 0),
    revisoes: recentes.filter((x) => x.a === "revisado").length,
    /* média por dia com estudo — "12h em 30 dias" e "12h em 3 dias" são
     * situações opostas, e o total sozinho não distingue as duas */
    dias: new Set(recentes.map((x) => x.d)).size,
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
  /* GRAVAR e REPINTAR A AGENDA DO TOPO.
   * Faltavam as duas: sem edSalvar() a mudança de progresso ficava só na
   * memória e voltava ao recarregar; sem hubPintarAgenda() a barra do
   * tópico continuava cheia e o item seguia sumido da agenda, porque o
   * topo é montado por outra função. É a mesma armadilha do edMarcar na
   * v8.88 — quem muda progresso tem de gravar E repintar os dois lugares. */
  edSalvar();
  reg("EDITAL-DIARIO", "registro apagado: " + x.n,
      x.a + " de " + x.d + " · " + (x.m || 0) + "min"
      + (ultimoDoTopico ? " · era o último do tópico" : ""));
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
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
  abrirModal("dlgDiagPlano");
}

let diagAchados = [];
let diagPlanoAtual = null;

/* Copiar o PLANO, não o pedido. Nem toda cópia é para a IA: às vezes é para
 * guardar, mandar para alguém ou colar numa planilha — e obrigar a passar
 * pelo prompt faz o usuário editar à mão o que o app já tinha pronto. */
function copiarPlano() {
  const txt = $("editalTexto").value;
  navigator.clipboard.writeText(txt).then(() => {
    const b = $("btnDpCopiar");
    const antes = b.textContent;
    b.textContent = "✓ " + t("diag_copiado");
    b.disabled = true;
    setTimeout(() => { b.textContent = antes; b.disabled = false; }, 1800);
    const r = lerEdital(txt);
    reg("EDITAL", "plano copiado",
        r.disciplinas.length + " disciplinas, "
        + r.disciplinas.reduce((a, d) => a + d.topicos.length, 0) + " tópicos");
  }).catch(() => uiAlert(t("toast_copy_fail")));
}

/* Ver antes de copiar: são 250 linhas, e ninguém devia mandar para fora um
 * texto que não leu. A janela de texto já traz o seu próprio botão de copiar. */
function verPlano() {
  const r = lerEdital($("editalTexto").value);
  const n = r.disciplinas.reduce((a, d) => a + d.topicos.length, 0);
  abrirTextoSimples(t("ed_dp_ver_tit", { d: r.disciplinas.length, t: n }),
    $("editalTexto").value);
}

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

/* Quantos registros a lista mostra de uma vez. Sem limite, um diário de
 * meses monta milhares de linhas de uma vez: a janela demora a abrir e a
 * rolagem engasga. O limite cresce sob demanda. */
const DIARIO_PAGINA = 60;
let diarioMostrar = DIARIO_PAGINA;
let diarioBusca = "";

function diarioPintarPeriodos() {
  const cx = $("diarioPeriodos");
  if (!cx) return;
  cx.innerHTML = "";
  DIARIO_PERIODOS.forEach((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "di-per" + (d === diarioPeriodo ? " ativa" : "");
    b.textContent = t("ed_diario_per_" + d);
    b.onclick = () => { diarioPeriodo = d; diarioMostrar = DIARIO_PAGINA; abrirDiario(); };
    cx.append(b);
  });
}

function abrirDiario() {
  const lista = $("diarioLista");
  lista.innerHTML = "";
  const st = estatisticasDiario(diarioPeriodo);
  /* HORAS NA FRENTE, com rótulo. Antes elas apareciam soltas no meio de
   * "7 tópicos · 0 revisões · 1h30 · 3 registros": um número sem nome,
   * espremido entre outros. */
  const med = st.dias ? Math.round(st.minutos / st.dias) : 0;
  $("diarioResumo").textContent = t("ed_diario_resumo", {
    h: horasTexto(st.minutos),
    p: diarioPeriodo ? t("ed_diario_per_" + diarioPeriodo) : t("ed_diario_per_0"),
    t: st.topicos, r: st.revisoes, e: st.eventos,
    d: st.dias, med: horasTexto(med),
  });
  diarioPintarPeriodos();
  if (!edDiario.length) {
    const p = document.createElement("div");
    p.className = "nota"; p.textContent = t("ed_diario_vazio");
    lista.append(p);
  }
  /* mais recente primeiro: o registro errado costuma ser o que acabou de
   * ser feito, e obrigar a rolar até o fim para achá-lo seria hostil */
  /* Filtra e LIMITA antes de desenhar. Um diário de meses tem milhares de
   * registros; montar todos de uma vez trava a abertura da janela. */
  const q = String(diarioBusca || "").trim().toLowerCase();
  const todos = edDiario.map((x, idx) => ({ x, idx })).reverse()
    .filter(({ x }) => {
      if (diarioPeriodo) {
        const lim = Date.now() - diarioPeriodo * 86400000;
        if (!(new Date(String(x.d) + "T00:00:00") >= lim)) return false;
      }
      if (!q) return true;
      return ((x.n || "") + " " + (x.disc || "") + " " + (x.cc || ""))
        .toLowerCase().includes(q);
    });
  const visiveis = todos.slice(0, diarioMostrar);
  visiveis.forEach(({ x, idx }) => {
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
    ds.className = "di-disc";
    ds.textContent = x.disc + (x.cc ? " · " + x.cc : " · " + t("ed_sem_concurso"));
    ds.title = x.cc ? t("ed_para_concurso", { c: x.cc }) : t("ed_sem_concurso_ajuda");
    /* O DIÁRIO PRECISA LEVAR DE VOLTA AO MATERIAL.
     * Ele registrava o que você fez e não dava caminho nenhum para rever —
     * a única ação da linha era APAGAR o registro. Quem marca "estudei
     * Restos a pagar" e três dias depois quer reler o resumo tinha de sair
     * do diário, achar a disciplina, achar o tópico. */
    const acoes = document.createElement("div");
    acoes.className = "di-acoes";
    const temMat = typeof matTem === "function" && matTem(x.c);
    const rever = botaoMini(temMat ? "ed_diario_rever" : "ed_diario_escrever",
      temMat ? "btn-verde" : "btn-cinza", () => {
        $("dlgDiario").close();
        matAbrirEditor({ disciplina: x.disc, nome: x.n, chave: x.c }, false);
      });
    const irDisc = botaoMini("ed_diario_disciplina", "btn-cinza", () => {
      $("dlgDiario").close();
      abrirDisciplina(x.disc);
    });
    const bt = botaoMini("ed_diario_apagar", "btn-cinza", () => apagarDoDiario(idx));
    acoes.append(rever, irDisc, bt);
    /* Os botões ficam ABAIXO da linha, não ao lado. Em coluna estreita o
     * grid os espremia a ponto de cada rótulo virar uma letra por linha
     * ("r-e-v-e-r"), e a barra de rolagem horizontal escondia a metade
     * direita da informação. */
    const cima = document.createElement("div");
    cima.className = "di-cima";
    cima.append(q, ac, nm);
    const meio = document.createElement("div");
    meio.className = "di-meio";
    meio.append(ds);
    /* O QUE O REGISTRO DIZ DE VERDADE.
     * A linha mostrava data, ação, tópico e disciplina — e escondia
     * justamente o que se quer saber ao reler o diário: quanto tempo foi,
     * de que jeito se estudou, e como foi nas questões. Sem isso, "estudou
     * Leis Orçamentárias" não distingue vinte minutos de três horas. */
    const det = document.createElement("div");
    det.className = "di-det";
    const pedacos = [];
    if (x.m) pedacos.push(horasTexto(x.m));
    const formas = (x.f && x.f.length ? x.f : []).map((f) => t("ed_forma_" + f))
      .filter(Boolean);
    if (formas.length) pedacos.push(formas.join(" + "));
    if (x.q && x.q.feitas) {
      const pct = x.q.feitas ? Math.round((x.q.certas / x.q.feitas) * 100) : 0;
      pedacos.push(t("ed_diario_questoes", { c: x.q.certas, n: x.q.feitas, pct }));
    }
    if (x.hu && x.hu !== "media") pedacos.push(t("ed_humor_" + x.hu));
    if (x.p) pedacos.push(t("ed_diario_peso", { p: x.p }));
    if (x.onde) pedacos.push(String(x.onde).slice(0, 40));
    det.textContent = pedacos.join(" · ");
    if (pedacos.length) meio.append(det);
    if (x.obs) {
      const ob = document.createElement("div");
      ob.className = "di-obs";
      ob.textContent = String(x.obs).slice(0, 220);
      meio.append(ob);
    }
    li.append(cima, meio, acoes);
    lista.append(li);
  });

  if (todos.length > visiveis.length) {
    const mais = document.createElement("button");
    mais.type = "button";
    mais.className = "btn-min";
    mais.style.marginTop = "8px";
    mais.textContent = t("ed_diario_mais", {
      n: Math.min(DIARIO_PAGINA, todos.length - visiveis.length),
      r: todos.length - visiveis.length });
    mais.onclick = () => { diarioMostrar += DIARIO_PAGINA; abrirDiario(); };
    lista.append(mais);
  }
  const conta = $("diarioConta");
  if (conta) {
    conta.textContent = todos.length
      ? t("ed_diario_mostrando", { v: visiveis.length, t: todos.length })
      : t("ed_diario_sem_filtro");
  }
  abrirModal("dlgDiario");
}

/* Formas de estudo. A lista é curta de propósito: dez opções viram uma
 * decisão a cada registro, e decisão a cada registro é o que faz a pessoa
 * parar de registrar. */
/* Ler a letra da lei e rodar cartões são dinâmicas diferentes de ler um PDF
 * teórico — e é a diferença entre elas que explica por que um tópico "com
 * 3h de estudo" continua caindo. */
const ED_FORMAS = ["leitura", "videoaula", "questoes", "leiseca",
                   "flashcards", "resumo", "mapa", "revisao"];
/* Produtividade percebida. Três níveis: cinco viram uma decisão demorada
 * sobre algo que é sensação, não medida. */
const ED_HUMOR = ["ruim", "media", "boa"];
let regAtual = null;
let regFormas = [];
let regHumor = "media";

/* Preenche o registro com o resultado de uma sessão de questões.
 * Chamado DEPOIS de abrirRegistro, que limpa os campos ao abrir — por isso
 * é uma função à parte e não um parâmetro. O que ela põe é sugestão: a
 * pessoa confirma e pode mudar tudo antes de gravar. */
/* Preenche o registro com uma forma e um tempo sugeridos.
 * É a base de regDeQuestoes e de regDeLeitura: as duas sugerem, nenhuma
 * decide — quem confirma é quem estudou. */
function regSugerir(formas, minutos) {
  regFormas = (formas && formas.length ? formas : ["leitura"]).slice();
  if (minutos && $("regMinutos")) {
    $("regMinutos").value = String(minutos);
    if ($("regMinSlider")) $("regMinSlider").value = String(Math.min(240, minutos));
  }
  const cx = $("regFormas");
  if (cx && cx.querySelectorAll) {
    const botoes = cx.querySelectorAll("button");
    ED_FORMAS.forEach((f, k) => {
      if (botoes[k]) botoes[k].classList.toggle("ativa", regFormas.indexOf(f) >= 0);
    });
  }
  if (typeof regPintarQuestoes === "function") regPintarQuestoes();
  if (typeof regPintarPct === "function") regPintarPct();
}

function regDeLeitura(minutos) { regSugerir(["resumo"], minutos); }

function regDeQuestoes(feitas, certas, minutos) {
  regFormas = ["questoes"];
  if ($("regQFeitas")) $("regQFeitas").value = String(feitas || 0);
  if ($("regQCertas")) $("regQCertas").value = String(certas || 0);
  if (minutos && $("regMinutos")) {
    $("regMinutos").value = String(minutos);
    if ($("regMinSlider")) $("regMinSlider").value = String(Math.min(240, minutos));
  }
  /* Repinta A PARTIR de regFormas, não de um rótulo escolhido à mão.
   * Comparar com o texto do botão deixava a tela dizer "Questões" enquanto
   * a variável guardava outra coisa — e é a variável que vai para o diário.
   * Tela e dado têm de vir da mesma fonte, senão um dia divergem e quem
   * lê a tela grava outra coisa sem saber. */
  const cx = $("regFormas");
  if (cx && cx.querySelectorAll) {
    const botoes = cx.querySelectorAll("button");
    ED_FORMAS.forEach((f, k) => {
      if (botoes[k]) botoes[k].classList.toggle("ativa", regFormas.indexOf(f) >= 0);
    });
  }
  if (typeof regPintarQuestoes === "function") regPintarQuestoes();
  if (typeof regPintarPct === "function") regPintarPct();
}

function abrirRegistro(i) {
  regAtual = i;
  regFormas = i.feito ? ["revisao"] : ["leitura"];
  regHumor = "media";
  $("regTitulo").textContent = i.nome;
  $("regSub").textContent = i.disciplina + " · " + edPorque(i, true);
  $("regMinutos").value = i.minutos;
  $("regMinSlider").value = Math.min(240, i.minutos);
  ["regQFeitas", "regQCertas", "regOnde", "regObs"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  if ($("regObs")) $("regObs").hidden = true;
  regPintarAtalhos();
  regPintarQuestoes();

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
      regPintarQuestoes();
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
  abrirModal("dlgRegistro");
}

/* Os campos de questão só existem quando "questões" está marcado. */
function regPintarQuestoes() {
  const bl = $("regQuestoesBloco");
  if (!bl) return;
  bl.hidden = regFormas.indexOf("questoes") < 0;
  regPintarPct();
}

function regPintarPct() {
  const el = $("regQPct");
  if (!el) return;
  const f = Number(($("regQFeitas") || {}).value) || 0;
  const c = Number(($("regQCertas") || {}).value) || 0;
  if (!f) { el.textContent = ""; return; }
  /* acerto acima de 100% é erro de digitação, e mostrar 130% seria fingir
   * que o número faz sentido */
  const pct = Math.round((Math.min(c, f) / f) * 100);
  el.textContent = pct + "%";
  el.className = "reg-q-pct" + (pct < 60 ? " baixo" : (pct < 80 ? " medio" : ""));
}

/* Atalhos que SOMAM ao valor atual: quem estudou 45min costuma clicar
 * +30 e +15, não arrastar o cursor até o número exato. */
function regPintarAtalhos() {
  const cx = $("regAtalhos");
  if (!cx) return;
  cx.innerHTML = "";
  [15, 30, 45, 60].forEach((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reg-atalho";
    b.textContent = "+" + n + "m";
    b.title = t("ed_reg_atalho_ajuda", { n });
    b.onclick = () => {
      const atual = Math.max(0, Number($("regMinutos").value) || 0);
      const novo = Math.min(600, atual + n);
      $("regMinutos").value = novo;
      $("regMinSlider").value = Math.min(240, novo);
    };
    cx.append(b);
  });
  const zerar = document.createElement("button");
  zerar.type = "button";
  zerar.className = "reg-atalho";
  zerar.textContent = t("ed_reg_zerar");
  zerar.title = t("ed_reg_zerar_ajuda");
  zerar.onclick = () => { $("regMinutos").value = 5; $("regMinSlider").value = 5; };
  cx.append(zerar);
}

function confirmarRegistro(estado) {
  if (!regAtual) return;
  const item = regAtual;
  $("dlgRegistro").close();
  regAtual = null;
  /* A ORDEM IMPORTA: edMarcar redesenha a agenda, e a linha que eu queria
   * animar deixa de existir. Na primeira versão a animação nunca aparecia —
   * medi: zero linhas recebiam a classe. Agora a linha é marcada primeiro,
   * o dado é salvo em seguida (sem redesenhar), e o redesenho fica para o
   * fim da animação. Salvar nunca depende do efeito. */
  const linhas = edMarcarLinhasSaindo(item, estado);
  const qf = Number(($("regQFeitas") || {}).value) || 0;
  const qc = Math.min(qf, Number(($("regQCertas") || {}).value) || 0);
  edMarcar(item, estado, {
    minutos: Math.max(1, Number($("regMinutos").value) || item.minutos),
    formas: regFormas.slice(),
    humor: regHumor,
    /* só grava questões quando houve questões: campo vazio não vira zero,
     * porque "0 de 0" e "não fiz questões" são coisas diferentes na conta
     * de acerto depois */
    questoes: qf ? { feitas: qf, certas: qc } : null,
    onde: String(($("regOnde") || {}).value || "").trim() || null,
    obs: String(($("regObs") || {}).value || "").trim() || null,
  }, linhas.length > 0);
  /* O item some da agenda no mesmo instante em que o diálogo fecha, e some
   * calado: dá a impressão de que sumiu, não de que foi guardado. A saída
   * animada mostra PARA ONDE ele foi. */
  edDespedir(item, estado, linhas);
}

/* Some devagar, com um recado de destino. Se o navegador não animar (ou o
 * teste não tiver animação nenhuma), o efeito é pulado e o resultado é o
 * mesmo — animação nunca pode ser a etapa que decide se o dado foi salvo. */
/* Acha as linhas do item na tela e marca a saída. Separada da despedida
 * porque precisa rodar ANTES de qualquer redesenho. */
/* quantas linhas a última despedida animou — instrumentação de verdade,
 * para o teste poder afirmar que a animação ACONTECEU em vez de supor */
let edUltimaDespedida = 0;

function edMarcarLinhasSaindo(item, estado) {
  const linhas = [];
  const anda = (el) => (el && el.children ? Array.from(el.children) : []).forEach((f) => {
    if ((f.className || "").split(/\s+/).indexOf("ed-item") >= 0
        && f._itemChave === item.chave) linhas.push(f);
    anda(f);
  });
  ["edAgendaTopo", "edPainel"].forEach((id) => anda($(id)));

  linhas.forEach((li) => {
    if (!li.classList || !li.classList.add) return;
    li.classList.add("ed-indo");
    const selo = document.createElement("div");
    selo.className = "ed-indo-selo";
    selo.textContent = t(estado === "revisado" ? "ed_indo_revisao" : "ed_indo_diario");
    if (li.append) li.append(selo);
  });
  edUltimaDespedida = linhas.length;
  return linhas;
}

let edUltimoRegistro = null;

/* Um botão que aparece por alguns segundos e desfaz o último registro:
 * apaga o registro do diário e devolve o tópico à agenda. */
function edMostrarDesfazer(item) {
  const bar = $("barraDesfazerReg");
  if (!bar) return;
  $("desfazerRegTxt").textContent = t("ed_desfazer_reg", { n: item.nome });
  bar.hidden = false;
  if (typeof setTimeout === "function") setTimeout(() => {
    if (bar) bar.hidden = true;
  }, 12000);
}

function edDesfazerUltimoRegistro() {
  const bar = $("barraDesfazerReg");
  if (bar) bar.hidden = true;
  if (!edUltimoRegistro) { uiAlert(t("ed_desfazer_nada")); return; }
  /* acha o registro MAIS RECENTE daquele tópico e usa o caminho normal de
   * apagar, que já sabe devolver o progresso anterior */
  let idx = -1;
  for (let k = edDiario.length - 1; k >= 0; k--) {
    if (edDiario[k] && edDiario[k].c === edUltimoRegistro.chave) { idx = k; break; }
  }
  if (idx < 0) { uiAlert(t("ed_desfazer_nada")); return; }
  const x = edDiario[idx];
  const ultimoDoTopico = edDiario.reduce(
    (m, y, k) => (y.c === x.c ? k : m), -1) === idx;
  edDiario.splice(idx, 1);
  if (ultimoDoTopico) {
    const ant = edDiario.filter((y) => y.c === x.c).pop();
    if (ant && ant.a !== "pendente") edProgresso[x.c] = { e: ant.a, d: ant.d };
    else delete edProgresso[x.c];
  }
  salvarDiario();
  edSalvar();
  reg("EDITAL-DIARIO", "último registro desfeito: " + x.n, x.a + " de " + x.d);
  edUltimoRegistro = null;
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  toast("ed_desfeito_reg");
}

function edDespedir(item, estado, linhas) {
  linhas = linhas || [];
  /* DESFAZER À MÃO, no instante seguinte.
   * O erro mais comum aqui é de MIRA: você registra um tópico, ele sai da
   * agenda, a lista sobe, e o próximo clique cai na linha que subiu. Sem um
   * desfazer imediato, corrigir exige abrir o diário e achar o registro. */
  edUltimoRegistro = { chave: item.chave, nome: item.nome, quando: Date.now() };
  toast(estado === "revisado" ? "ed_foi_diario_rev" : "ed_foi_diario");
  edMostrarDesfazer(item);
  reg("EDITAL-PROGRESSO", "item saiu da agenda para o diário",
      item.nome + " · " + (estado || "pendente"));

  /* redesenha DEPOIS da animação. O tempo é curto de propósito: efeito que
   * atrasa o próximo clique vira estorvo na segunda vez. */
  const refazer = () => {
    try { edRender(); } catch (e) {}
    try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
  };
  if (typeof setTimeout === "function" && linhas.length) setTimeout(refazer, 420);
  else refazer();
}

function edMarcar(i, estado, detalhe, semRender) {
  if (estado) edProgresso[i.chave] = { e: estado, d: hojeISO() };
  else delete edProgresso[i.chave];
  anotarDiario(i, estado || "pendente", detalhe);
  /* Sem pesos, o registro dizia "peso undefined×undefined" — pior que não
   * dizer nada, porque parece dado e não é. */
  const temPeso = i.disciplinaPeso != null && i.peso != null;
  reg("EDITAL-PROGRESSO", (estado || "pendente") + ": " + i.nome,
      /* "peso 25" parecia valor fora de escala; 5×5 mostra de onde veio */
      i.disciplina + (temPeso ? " · peso " + i.disciplinaPeso + "×" + i.peso
                              : " · " + t("ed_sem_peso_reg")));
  /* GRAVAR E REDESENHAR SÃO COISAS DIFERENTES.
   * edSalvar() morava dentro de edRender(). Quando a v8.81 passou a pular o
   * redesenho para poder animar a saída do item, pulou a GRAVAÇÃO junto: o
   * progresso ficava só na memória do edital aberto, e a agenda do topo —
   * que lê "progresso" do registro de cada edital na lista — continuava
   * mostrando o tópico já estudado. Pior: até alguém salvar por outro
   * caminho, a marca não sobrevivia a um recarregamento.
   * Agora a gravação acontece SEMPRE; só o desenho é adiável. */
  edSalvar();
  if (!semRender) edRender();
}

/* Ritmo em vez de veredito. "121 ficam de fora" encerra o assunto; ritmo
 * observado ao lado do necessário mostra o tamanho do ajuste — e sobre isso
 * dá para agir. As duas barras usam a MESMA escala, senão a comparação
 * mente. */
function edPintarRitmo(plano) {
  const box = $("edRitmo");
  box.innerHTML = "";
  if (!plano.total || plano.semanas === null) { box.hidden = true; return; }
  box.hidden = false;

  const A = acompanhamento(plano, edDiario, plano.porSemana);

  const tit = document.createElement("div");
  tit.className = "rt-tit";
  tit.textContent = t("ed_ac_titulo");
  box.append(tit);

  /* H3 — O ESCOPO FICA ESCRITO.
   * A agenda logo acima soma todos os editais; este bloco é de UM só. Sem
   * o nome aqui, com dois concursos a tela mostra dois números com o mesmo
   * ar de verdade e nada que os distinga. Foi assim que as duas agendas
   * conviveram. */
  const escopo = document.createElement("div");
  escopo.className = "ac-escopo";
  const qual = (typeof edAberto === "function" && edAberto())
    ? edAberto().nome : (lerEdital($("editalTexto").value).cfg.concurso || t("ed_sem_nome"));
  escopo.textContent = t("ed_ac_escopo", { n: qual });
  box.append(escopo);

  /* H4 — com dois ou mais editais ativos, a comparação vem ANTES do
   * detalhe. Somar a cobertura de dois concursos daria um número que não
   * existe (ninguém presta uma prova média); o que existe é a pergunta
   * "estou abandonando um deles?". */
  if (typeof comparativoEditais === "function") {
    const linhas = comparativoEditais(edDiario);
    if (linhas.length >= 2) box.append(edTabelaComparativa(linhas));
  }

  /* ---------- 1. COBERTURA — por PESO, contagem como legenda ----------
   * Liderar com "0/232 tópicos" inverte a régua: 40% dos tópicos pode ser
   * 12% do peso, e é o peso que decide a prova. */
  const cob = document.createElement("div");
  cob.className = "ac-bloco";
  const cRot = document.createElement("div");
  cRot.className = "ac-rot";
  cRot.textContent = t("ed_ac_cobertura");
  cob.append(cRot);

  /* barra empilhada única: revisado dentro do estudado, na escala da prova */
  const ba = document.createElement("div");
  ba.className = "ac-barra";
  const fRev = document.createElement("div");
  fRev.className = "ac-f-rev";
  fRev.style.width = A.cobertura.pesoRevisado + "%";
  const fEst = document.createElement("div");
  fEst.className = "ac-f-est";
  fEst.style.width = Math.max(0, A.cobertura.pesoEstudado - A.cobertura.pesoRevisado) + "%";
  ba.append(fRev, fEst);
  cob.append(ba);

  const cNum = document.createElement("div");
  cNum.className = "ac-num";
  cNum.textContent = t("ed_ac_cob_num", {
    e: A.cobertura.pesoEstudado, r: A.cobertura.pesoRevisado,
    f: A.cobertura.topicosFeitos, tt: A.cobertura.topicosTotal,
    s: A.cobertura.semanas,
  });
  cob.append(cNum);
  box.append(cob);

  /* ---------- 2. RITMO ---------- */
  const rit = document.createElement("div");
  rit.className = "ac-bloco";
  const rRot = document.createElement("div");
  rRot.className = "ac-rot";
  rRot.textContent = t("ed_ac_ritmo");
  rit.append(rRot);
  const rTxt = document.createElement("div");
  rTxt.className = "ac-num";
  /* sem registro nao se inventa media: a linha vira instrucao, e aparece
   * UMA vez — antes o "nada registrado" ocupava tres lugares na tela */
  rTxt.textContent = A.ritmo.medivel
    ? t("ed_ac_ritmo_txt", { fez: horasTexto(A.ritmo.fezMin),
        n: A.ritmo.semanasComRegistro, meta: horasTexto(A.ritmo.metaMin),
        ag: horasTexto(A.ritmo.agendaMin) })
    : t("ed_ac_ritmo_vazio", { ag: horasTexto(A.ritmo.agendaMin) });
  rit.append(rTxt);
  box.append(rit);

  /* ---------- 3. PROJEÇÃO — a única linha acionável da tela ----------
   * Responde "vale a pena manter este ritmo?". O cálculo ja existia
   * (ritmoDoPlano.alcance) e nunca chegava a ser desenhado. */
  const pj = document.createElement("div");
  pj.className = "ac-proj";
  if (A.projecao) {
    const forte = document.createElement("b");
    forte.textContent = t("ed_ac_proj", { h: horasTexto(A.ritmo.fezMin),
      p: A.projecao.pesoPct });
    pj.append(forte);
    if (A.projecaoMeta && A.projecaoMeta.pesoPct > A.projecao.pesoPct) {
      const segunda = document.createElement("div");
      segunda.className = "ac-proj2";
      segunda.textContent = t("ed_ac_proj_meta", {
        h: horasTexto(A.ritmo.metaMin), p: A.projecaoMeta.pesoPct });
      pj.append(segunda);
    }
    pj.classList.toggle("ruim", A.projecao.pesoPct < 60);
  } else {
    pj.className = "ac-proj ac-proj-vazia";
    pj.textContent = t("ed_ac_proj_sem");
  }
  box.append(pj);

  /* ---------- 4. o alerta, no rodapé: é aviso, nunca meta ---------- */
  if (A.fora.n) {
    const fora = document.createElement("div");
    fora.className = "rt-fora";
    fora.textContent = t("ed_ac_fora", { n: A.fora.n, p: A.fora.pesoPct });
    box.append(fora);
  }
}

/* A tabela que responde "estou abandonando algum concurso?".
 * A coluna que decide é a última: ela mostra qual prova ainda dá tempo de
 * salvar e qual já está fora de alcance no ritmo atual. */
function edTabelaComparativa(linhas) {
  const cx = document.createElement("div");
  cx.className = "ac-comp";
  const h = document.createElement("div");
  h.className = "ac-rot";
  h.textContent = t("ed_ac_comp_tit", { n: linhas.length });
  cx.append(h);

  const cab = document.createElement("div");
  cab.className = "ac-comp-linha ac-comp-cab";
  [t("ed_ac_c_edital"), t("ed_ac_c_prazo"), t("ed_ac_c_coberto"),
   t("ed_ac_c_ritmo"), t("ed_ac_c_proj")].forEach((txt, k) => {
    const c = document.createElement("span");
    c.className = "ac-c c" + k; c.textContent = txt; cab.append(c);
  });
  cx.append(cab);

  linhas.forEach((l) => {
    const li = document.createElement("div");
    li.className = "ac-comp-linha";
    if (typeof edAberto === "function" && edAberto() && edAberto().id === l.id)
      li.classList.add("aberto");

    const nome = document.createElement("button");
    nome.type = "button"; nome.className = "ac-c c0 ac-c-nome";
    nome.textContent = l.nome;
    nome.onclick = () => { if (typeof hubAbrirEdital === "function") hubAbrirEdital(l.id); };

    const prazo = document.createElement("span");
    prazo.className = "ac-c c1";
    prazo.textContent = l.dias === null ? t("hub_prazo_sem") : t("hub_prazo_dias", { n: l.dias });
    if (l.dias !== null && l.dias <= 30) prazo.classList.add("urgente");

    const cob = document.createElement("span");
    cob.className = "ac-c c2"; cob.textContent = l.pesoEstudado + "%";

    const rit = document.createElement("span");
    rit.className = "ac-c c3";
    rit.textContent = l.ritmoMin === null ? "—" : horasTexto(l.ritmoMin);

    const pj = document.createElement("span");
    pj.className = "ac-c c4";
    if (l.projecao === null) pj.textContent = "—";
    else {
      pj.textContent = l.projecao + "%";
      /* a cor diz o que a coluna quer dizer: onde o ritmo atual leva */
      pj.classList.add(l.projecao >= 80 ? "bom" : l.projecao >= 50 ? "medio" : "ruim");
    }
    li.append(nome, prazo, cob, rit, pj);
    cx.append(li);
  });

  /* a leitura da tabela, escrita: sem isto, são cinco colunas de números */
  const risco = linhas.filter((l) => l.projecao !== null && l.projecao < 50
                                     && l.dias !== null && l.dias <= 120);
  if (risco.length) {
    const n = document.createElement("div");
    n.className = "ac-comp-nota";
    n.textContent = t("ed_ac_comp_risco", {
      l: risco.map((x) => x.nome).join(", "), n: risco.length });
    cx.append(n);
  }
  return cx;
}

/* Abre a disciplina no painel e leva o olho até ela. Só expandir não basta:
 * com dezessete cartões, o que abriu pode estar fora da tela. */
/* Rolar até o cartão era pior que não fazer nada: o usuário perdia o lugar
 * onde estava e ainda tinha de achar o que abriu. A disciplina passa a ter
 * uma janela própria, com o panorama dela — e fechar devolve a tela intacta. */
function abrirDisciplina(nome) {
  const r = lerEdital($("editalTexto").value);
  const plano = montarPlano(r, { horas: Number($("edHoras").value),
    prova: $("edProva").value, feitos: edProgresso });
  const d = panoramaDisciplinas(plano).find((x) => x.nome === nome);
  if (!d) return;

  $("dscTitulo").textContent = d.nome;
  if ($("btnDscExcluir")) $("btnDscExcluir").onclick = () => {
    $("dlgDisciplina").close();
    ndExcluir(d.nome);
  };
  $("dscSub").textContent = t("ed_dsc_sub", { p: d.peso, f: d.fatia, n: d.total });

  const cx = $("dscResumo");
  cx.innerHTML = "";
  const cartao = (rot, val, cls) => {
    const b = document.createElement("div");
    b.className = "dsc-num " + (cls || "");
    const v = document.createElement("b"); v.textContent = val;
    const r2 = document.createElement("span"); r2.textContent = rot;
    b.append(v, r2); return b;
  };
  cx.append(
    cartao(t("ed_dsc_estudado"), d.pesoFeito + "%", "n-feito"),
    cartao(t("ed_dsc_revisado"), d.pesoRevisado + "%", "n-rev"),
    cartao(t("ed_dsc_intocado"), d.intocados + "/" + d.total, "n-falta"),
    cartao(t("ed_dsc_alta"), String(d.altaIntocada), d.altaIntocada ? "n-alerta" : ""));

  const lista = $("dscLista");
  lista.innerHTML = "";
  /* dentro da disciplina, o intocado de maior peso vem primeiro: é a ordem
   * em que a pessoa deveria atacar se abrisse a matéria agora */
  d.itens.slice().sort((a, b) => (a.feito - b.feito) || (b.bruto - a.bruto))
    .forEach((i) => lista.append(edLinhaTopico(i, true)));

  abrirModal("dlgDisciplina");
  reg("EDITAL-DISCIPLINA", "panorama aberto: " + nome,
      d.fatia + "% da prova, " + d.intocados + " intocados");
}

let edCards = {};

function edPintarPainel(r, plano) {
  try { vrAtualizarBotao(); } catch (e) {}
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
  /* A barra e os dois quadros ESTUDADO/REVISADO saíram daqui na v8.71:
   * eram os mesmos números do bloco de acompanhamento, logo acima, em
   * outro formato. Dois lugares mostrando o mesmo dado acabam divergindo,
   * e quando divergem ninguém sabe qual acreditar. O topo fica com o que
   * só ele tem: a identidade do edital. */
  topo.append(nome);
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
  /* "esta semana: 82 tópicos · 59h45" saiu: é exatamente o que o cabeçalho
   * da agenda, no topo da tela, já diz — e com o escopo certo (todos os
   * editais), enquanto aqui era só deste. */
  box.append(topo);

  /* -------- esta semana MORA NO TOPO --------
   * Até a v8.69 existiam DUAS "Agenda da semana": esta, do edital aberto, e
   * a do topo, que junta os editais. Duas listas com o mesmo nome e números
   * diferentes — a de cima somava 82 tópicos de todos os concursos, esta
   * somava os deste. Quem olha não tem como saber qual está certa, e passa
   * a não confiar em nenhuma. Era o mesmo defeito das horas por semana,
   * quando o campo e o controle deslizante discordavam.
   *
   * Ficou uma só, no topo, porque a semana é uma só. O que esta tinha de
   * próprio — ver só o edital aberto — virou um filtro lá em cima. */

  /* -------- onde estão os buracos --------
   * Progresso médio esconde o que decide a prova: 40% do plano feito pode
   * ser 100% das matérias leves e 0% da que vale 15%. Esta lista ordena
   * pela FATIA DA PROVA AINDA NÃO ESTUDADA, que é outra coisa. */
  const pan = panoramaDisciplinas(plano);
  const comLacuna = pan.filter((d) => d.lacuna > 0).slice(0, 6);
  if (comLacuna.length) {
    const cx2 = document.createElement("div");
    cx2.className = "ed-caixa";
    const h2 = document.createElement("div");
    h2.className = "ed-caixa-tit";
    h2.textContent = t("ed_lacunas_tit");
    const s2 = document.createElement("div");
    s2.className = "ed-caixa-sub";
    s2.textContent = t("ed_lacunas_sub");
    cx2.append(h2, s2);
    comLacuna.forEach((d) => {
      const li = document.createElement("button");
      li.type = "button";
      li.className = "lac-linha";
      li.onclick = () => abrirDisciplina(d.nome);
      const nm = document.createElement("span");
      nm.className = "lac-nome"; nm.textContent = d.nome;
      const ba = document.createElement("div");
      ba.className = "lac-barra";
      const ok = document.createElement("div");
      ok.className = "lac-ok";
      ok.style.width = d.pesoFeito + "%";
      ba.append(ok);
      const vl = document.createElement("b");
      vl.textContent = t("ed_lac_val", { l: d.lacuna, a: d.altaIntocada });
      if (d.altaIntocada) vl.className = "lac-alerta";
      li.append(nm, ba, vl);
      cx2.append(li);
    });
    box.append(cx2);
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

function edPintarLote() {
  const barra = $("edLote");
  if (!barra) return;
  barra.classList.toggle("mostra", edSelecao.size > 0);
  const c = $("edLoteConta");
  if (c) c.textContent = t("ed_lote_conta", { n: edSelecao.size });
}

async function edLoteAplicar(marcar) {
  if (!edSelecao.size) return;
  const n = edSelecao.size;
  /* marcar em lote mexe em progresso, que é o dado que não se refaz.
   * Pergunta com o número dentro, não um "tem certeza?" genérico. */
  if (!(await uiConfirm(t(marcar ? "ed_lote_conf" : "ed_lote_conf_des", { n })))) return;
  edSelecao.forEach((chave) => {
    if (marcar) edProgresso[chave] = { e: "feito", d: hojeISO() };
    else delete edProgresso[chave];
  });
  reg("EDITAL", (marcar ? "marcados" : "desmarcados") + " em lote", n + " tópicos");
  edSelecao.clear();
  edSalvar();
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  toast(marcar ? "ed_lote_feito_ok" : "ed_colado");
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

  const c = edCompararColagem($("editalTexto").value, novoTxt, edProgresso);
  av.hidden = false;
  av.innerHTML = "";
  av.classList.toggle("grave", c.grave || c.vazio);

  /* A conferência deixou de ser uma frase e virou uma lista. O texto antigo
   * dizia só "perdeu N tópicos" — e não dizia nada quando o número batia,
   * que é justamente o caso perigoso: 3 → 3 tópicos com um deles renomeado
   * apaga a marca de estudado sem aviso nenhum. */
  const linha = (txt, classe) => {
    const d = document.createElement("div");
    d.className = "ed-mud" + (classe ? " " + classe : "");
    d.textContent = txt;
    av.append(d);
    return d;
  };

  linha(t("ed_colar_conf", { a: c.topicosAntes, d: c.topicosDepois,
                             da: c.discAntes, dd: c.discDepois }));

  if (c.vazio) { linha(t("ed_colar_vazio"), "perigo"); return Object.assign(c, { novoTxt }); }

  /* o dano primeiro: é o único item da lista que não se desfaz */
  if (c.orfaos.length) {
    linha(t("ed_colar_orfaos", { n: c.orfaos.length }), "perigo");
    c.orfaos.slice(0, 6).forEach((o) => linha("· " + o.d + " › " + o.t, "detalhe"));
    if (c.orfaos.length > 6) linha(t("ed_colar_mais", { n: c.orfaos.length - 6 }), "detalhe");
  }
  if (c.discSomem.length)
    linha(t("ed_colar_disc_somem", { l: c.discSomem.slice(0, 4).join(", ") }), "aviso");
  if (c.discSurgem.length)
    linha(t("ed_colar_disc_surgem", { l: c.discSurgem.slice(0, 4).join(", ") }));
  if (c.pesosMudam.length)
    linha(t("ed_colar_pesos", {
      l: c.pesosMudam.slice(0, 4).map((p) => p.nome + " " + p.de + "→" + p.para).join(", "),
    }), "aviso");
  if (c.somem.length && !c.orfaos.length)
    linha(t("ed_colar_somem", { n: c.somem.length }), "aviso");
  if (c.ignoradas) linha(t("ed_colar_ignoradas", { n: c.ignoradas }), "aviso");
  if (!c.orfaos.length && !c.discSomem.length && !c.pesosMudam.length && !c.somem.length)
    linha(t("ed_colar_sem_perda"), "ok");

  return Object.assign(c, { novoTxt });
}

async function edAplicarColagem() {
  const c = edConferirColagem();
  if (!c) return;

  /* Confirmação em degraus: cada pergunta cobre um tipo de mudança, e a
   * mais grave vem por último, com o número dentro dela. Uma pergunta só,
   * genérica, é a que a pessoa aprende a responder no automático. */
  if (c.vazio) {
    await uiAlert(t("ed_colar_vazio_erro"));
    return;
  }
  if (c.discSomem.length || c.pesosMudam.length) {
    const partes = [];
    if (c.discSomem.length)
      partes.push(t("ed_conf_disc", { n: c.discSomem.length, l: c.discSomem.slice(0, 5).join(", ") }));
    if (c.pesosMudam.length)
      partes.push(t("ed_conf_pesos", { n: c.pesosMudam.length,
        l: c.pesosMudam.slice(0, 5).map((p) => p.nome + ": " + p.de + " → " + p.para).join("\n· ") }));
    if (!(await uiConfirm(partes.join("\n\n") + "\n\n" + t("ed_conf_seguir")))) {
      reg("EDITAL-COLAR", "colagem cancelada na conferência de estrutura");
      return;
    }
  }
  if (c.somem.length && !c.orfaos.length) {
    if (!(await uiConfirm(t("ed_conf_somem", { n: c.somem.length,
        l: c.somem.slice(0, 5).map((x) => x.t).join("\n· ") })))) {
      reg("EDITAL-COLAR", "colagem cancelada na conferência de tópicos");
      return;
    }
  }
  /* a última e a mais séria: progresso que fica sem dono */
  if (c.orfaos.length) {
    if (!(await uiConfirm(t("ed_conf_orfaos", { n: c.orfaos.length,
        l: c.orfaos.slice(0, 5).map((o) => o.d + " › " + o.t).join("\n· ") })))) {
      reg("EDITAL-COLAR", "colagem cancelada: progresso em risco", c.orfaos.length + " tópicos");
      return;
    }
  }

  guardarVersao("antes de colar o plano corrigido", $("editalTexto").value);
  $("editalTexto").value = c.novoTxt;
  reg("EDITAL-COLAR", "plano corrigido colado",
      c.topicosAntes + " → " + c.topicosDepois + " tópicos, "
      + c.orfaos.length + " marcações órfãs");
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

  /* filtra ANTES de desenhar: 232 linhas é o que tornava esta tela inútil */
  const q = edBusca.trim().toLowerCase();
  const visiveis = itens.filter((i) => {
    if (edFiltro === "pendentes" && i.feito) return false;
    if (edFiltro === "feitos" && !i.feito) return false;
    if (edFiltro === "alta" && i.faixa !== "alta") return false;
    if (!q) return true;
    return (i.nome + " " + i.disciplina).toLowerCase().includes(q);
  });
  edPintarLote();

  if (!visiveis.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6; td.className = "esq-vazio";
    /* a mensagem muda conforme a causa: "edital vazio" e "nada neste
     * filtro" são problemas diferentes e pedem ações diferentes */
    td.textContent = itens.length ? t("ed_busca_vazia") : t("ed_vazio");
    tr.append(td); tb.append(tr); edSalvar(); return;
  }
  visiveis.forEach((i) => {
    const tr = document.createElement("tr");
    const feito = !!i.feito;
    if (feito) tr.className = "ed-feito";
    const cel = (txt, cls) => {
      const td = document.createElement("td");
      td.textContent = txt; if (cls) td.className = cls; return td;
    };
    const tdNome = cel(i.nome);
    if (i.motivo) { tdNome.title = i.motivo; tdNome.classList.add("ed-tem-motivo"); }
    /* caixa de SELEÇÃO (lote), separada da caixa de "estudado": marcar
     * cem tópicos um a um na agenda é o que ninguém faz — e quem chega
     * com meio edital já estudado precisa exatamente disso */
    const sel = document.createElement("input");
    sel.type = "checkbox";
    sel.className = "ed-sel";
    sel.checked = edSelecao.has(i.chave);
    sel.title = t("ed_lote_conta", { n: edSelecao.size });
    sel.onchange = () => {
      if (sel.checked) edSelecao.add(i.chave); else edSelecao.delete(i.chave);
      edPintarLote();
    };
    tr.append((() => { const td = document.createElement("td"); td.append(sel); return td; })());

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
  $("btnDscFechar").onclick = () => $("dlgDisciplina").close();
  $("btnDpFechar").onclick = () => $("dlgDiagPlano").close();
  $("btnDpPrompt").onclick = gerarPromptDoDiag;
  $("btnDpCopiar").onclick = copiarPlano;
  $("btnDpVer").onclick = verPlano;
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
  $("btnRegFechar").onclick = () => { $("dlgRegistro").close(); regAtual = null; };
  ["regQFeitas", "regQCertas"].forEach((id) => {
    if ($(id)) $(id).addEventListener("input", regPintarPct);
  });
  if ($("btnRegObs")) $("btnRegObs").onclick = () => {
    const t2 = $("regObs");
    t2.hidden = !t2.hidden;
    $("btnRegObs").textContent = t(t2.hidden ? "ed_reg_obs_abrir" : "ed_reg_obs_fechar");
  };
  $("btnRegEstudo").onclick = () => confirmarRegistro("feito");
  $("btnRegRevisao").onclick = () => confirmarRegistro("revisado");
  $("btnEditalColar").onclick = () => {
    $("edColarTexto").value = "";
    $("edColarAviso").hidden = true;
    abrirModal("dlgEdColar");
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
  if ($("edBuscaTop")) $("edBuscaTop").addEventListener("input", () => {
    edBusca = $("edBuscaTop").value; edRender();
  });
  [["edFiltroTudo", "tudo"], ["edFiltroPend", "pendentes"],
   ["edFiltroAlta", "alta"], ["edFiltroFeitos", "feitos"]].forEach(([id, k]) => {
    if (!$(id)) return;
    $(id).onclick = () => {
      edFiltro = k;
      ["edFiltroTudo", "edFiltroPend", "edFiltroAlta", "edFiltroFeitos"]
        .forEach((x) => $(x) && $(x).classList.toggle("ativa", x === id));
      edRender();
    };
  });
  if ($("btnLoteFeito")) $("btnLoteFeito").onclick = () => edLoteAplicar(true);
  if ($("btnLoteDesfazer")) $("btnLoteDesfazer").onclick = () => edLoteAplicar(false);
  if ($("btnLoteNada")) $("btnLoteNada").onclick = () => { edSelecao.clear(); edRender(); };
  /* o botão existia na tela desde a v8.70 e não estava ligado a nada —
   * eu embarquei um botão morto */
  if ($("btnDesfazerReg")) $("btnDesfazerReg").onclick = edDesfazerUltimoRegistro;
  if ($("btnDesfazerRegNao")) $("btnDesfazerRegNao").onclick = () => {
    const b = $("barraDesfazerReg"); if (b) b.hidden = true;
  };
  if ($("btnDiarioTopo")) $("btnDiarioTopo").onclick = () => {
    diarioMostrar = DIARIO_PAGINA; diarioBusca = ""; 
    if ($("diarioBusca")) $("diarioBusca").value = "";
    abrirDiario();
  };
  if ($("diarioBusca")) $("diarioBusca").addEventListener("input", () => {
    diarioBusca = $("diarioBusca").value;
    diarioMostrar = DIARIO_PAGINA;
    abrirDiario();
  });
  vrIniciar();
  if ($("btnEdNovaDisc")) $("btnEdNovaDisc").onclick = ndAbrir;
  if ($("btnNdIncluir")) $("btnNdIncluir").onclick = ndIncluir;
  if ($("btnNdFechar")) $("btnNdFechar").onclick = () => $("dlgNovaDisc").close();
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

/* =====================================================================
 * FORMULÁRIO: INCLUIR / EXCLUIR DISCIPLINA
 * ===================================================================== */
let ndPeso = 3;

function ndAbrir() {
  ndPeso = 3;
  $("ndNome").value = "";
  $("ndTopicos").value = "";
  $("ndRedistrib").hidden = true;
  ndPintarPesos();
  abrirModal("dlgNovaDisc");
  reg("EDITAL", "formulário de disciplina aberto");
}

/* Os cinco botões de peso, e ao lado o que JÁ existe em cada um.
 * Pedir "peso de 1 a 5" sem mostrar o resto foi o que produziu, no edital
 * do TCE-PE, 17 disciplinas com peso 3 — o que anula a priorização
 * inteira, porque a prioridade é peso da disciplina × peso do tópico. */
function ndPintarPesos() {
  const cx = $("ndPesos");
  cx.innerHTML = "";
  [1, 2, 3, 4, 5].forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nd-peso" + (p === ndPeso ? " ativa" : "");
    b.textContent = String(p);
    b.onclick = () => { ndPeso = p; ndPintarPesos(); };
    cx.append(b);
  });

  const mapa = $("ndMapa");
  mapa.innerHTML = "";
  const r = lerEdital($("editalTexto").value);
  const porPeso = {};
  r.disciplinas.forEach((d) => {
    (porPeso[d.peso] = porPeso[d.peso] || []).push(d.nome);
  });
  [5, 4, 3, 2, 1].forEach((p) => {
    const linha = document.createElement("div");
    linha.className = "nd-mapa-linha";
    const b = document.createElement("span");
    b.className = "nd-mapa-p"; b.textContent = p;
    const n = document.createElement("span");
    n.className = "nd-mapa-n";
    n.textContent = (porPeso[p] || []).join(", ") || t("nd_nenhuma");
    linha.append(b, n);
    mapa.append(linha);
  });
}

async function ndIncluir() {
  const antes = $("editalTexto").value;
  const r = edIncluirDisciplina(antes, $("ndNome").value, ndPeso, $("ndTopicos").value);
  if (r.erro === "sem_nome") { await uiAlert(t("nd_sem_nome")); return; }
  if (r.erro === "sem_topicos") { await uiAlert(t("nd_sem_topicos")); return; }
  if (r.erro === "repetida") { await uiAlert(t("nd_repetida", { n: r.nome })); return; }

  guardarVersao("antes de incluir disciplina", antes);
  $("editalTexto").value = r.texto;
  reg("EDITAL-DISCIPLINA", "incluída à mão: " + r.nome,
      "peso " + r.peso + ", " + r.topicos + " tópicos");
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  $("dlgNovaDisc").close();
  await uiAlert(t("nd_ok", { n: r.nome, t: r.topicos }));

  /* só DEPOIS de incluir faz sentido perguntar sobre redistribuir: agora
   * dá para mostrar de quanto foi o deslocamento real */
  const mud = edRedistribuir(antes, r.texto);
  if (mud.length) ndOferecerRedistribuicao(mud, r);
}

function ndOferecerRedistribuicao(mud, incluida) {
  const cx = $("edColarAviso");
  const alvo = cx && !cx.hidden ? cx : null;
  const painel = document.createElement("div");
  painel.className = "nd-redistrib";
  const txt = document.createElement("div");
  txt.textContent = t("nd_desloca", {
    n: incluida.nome, p: incluida.peso,
    l: mud.slice(0, 4).map((m) => m.nome + " " + m.fatiaAntes + "% → " + m.fatiaDepois + "%").join("; "),
  });
  const expl = document.createElement("div");
  expl.className = "nota";
  expl.textContent = t("nd_redis_expl");
  const ops = document.createElement("div");
  ops.className = "nd-opcoes";

  /* "manter assim" PRIMEIRO, de propósito: peso vindo do número de
   * questões do edital é dado, e o app não reescreve dado sem pedido. */
  const manter = document.createElement("button");
  manter.type = "button"; manter.className = "btn-min";
  manter.textContent = t("nd_redis_manter");
  manter.onclick = () => { painel.remove(); reg("EDITAL-PESO", "redistribuição recusada"); };

  const aplicar = document.createElement("button");
  aplicar.type = "button"; aplicar.className = "btn-min";
  aplicar.textContent = t("nd_redis_aplicar");
  aplicar.onclick = () => {
    guardarVersao("antes de redistribuir pesos", $("editalTexto").value);
    let txt2 = $("editalTexto").value;
    mud.forEach((m) => {
      txt2 = txt2.replace(new RegExp("^(\\\\s*@\\\\s*" + m.nome.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")
        + "\\\\s*::\\\\s*)\\\\d+", "m"), "$1" + m.para);
    });
    $("editalTexto").value = txt2;
    reg("EDITAL-PESO", "redistribuídos " + mud.length + " pesos",
        mud.map((m) => m.nome + " " + m.de + "→" + m.para).join(", "));
    painel.remove();
    edRender();
  };
  ops.append(manter, aplicar);
  painel.append(txt, expl, ops);
  const destino = $("edPainel");
  if (destino) destino.prepend(painel);
}

async function ndExcluir(nome) {
  const antes = $("editalTexto").value;
  const r = edExcluirDisciplina(antes, nome, edProgresso);
  if (r.erro) { await uiAlert(t("nd_nao_achou", { n: nome })); return; }
  if (!(await uiConfirm(t("nd_excluir_conf", {
    n: r.nome, t: r.topicos, m: r.marcados })))) return;

  guardarVersao("antes de excluir disciplina", antes);
  $("editalTexto").value = r.texto;
  /* NÃO mexe em edProgresso nem no diário: o diário é o histórico do que
   * você fez, e histórico não se reescreve porque o plano mudou. As marcas
   * ficam guardadas pela chave "disciplina›tópico" — se a disciplina
   * voltar, elas voltam com ela. */
  reg("EDITAL-DISCIPLINA", "excluída: " + r.nome,
      r.topicos + " tópicos saíram do plano, " + r.marcados
      + " marcações guardadas para o caso de voltar");
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  toast("nd_excluida");
}

/* =====================================================================
 * TELA "O QUE EU JÁ ESTUDEI DISTO?"
 * ===================================================================== */
let vkTriagem = [];        /* candidatos de nome idêntico + a escolha de cada */
let vkPendentesIa = [];    /* o que vai no prompt */

function vkPendentesDoEdital() {
  const r = lerEdital($("editalTexto").value);
  const plano = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas,
    prova: $("edProva").value, feitos: edProgresso });
  /* só os PENDENTES: comparar o que já foi estudado aqui é desperdício e
   * ainda polui a conferência com pares inúteis */
  return plano.itens.filter((i) => !i.feito)
    .map((i) => ({ disciplina: i.disciplina, nome: i.nome }));
}

function vkAbrir() {
  const est = vkEstudados(edDiario);
  if (!est.length) { uiAlert(t("vk_sem_diario")); return; }
  const pend = vkPendentesDoEdital();
  vkTriagem = vkIdenticos(est, pend).map((c) => Object.assign({}, c, { escolha: "ia" }));
  vkPendentesIa = pend;

  $("vkResumo").textContent = t("vk_resumo", {
    e: est.length, p: pend.length, i: vkTriagem.length });
  vkPintarTriagem();
  abrirModal("dlgJaEstudei");
  reg("VINCULO", "triagem aberta", est.length + " estudados, "
      + vkTriagem.length + " nomes idênticos");
}

function vkPintarTriagem() {
  const box = $("vkLista");
  box.innerHTML = "";
  if (!vkTriagem.length) {
    const p = document.createElement("div");
    p.className = "esq-vazio"; p.textContent = t("vk_sem_identicos");
    box.append(p); return;
  }
  vkTriagem.forEach((c, k) => {
    const li = document.createElement("div");
    li.className = "vk-item";
    const par = document.createElement("div");
    par.className = "vk-par";
    const b = document.createElement("b");
    b.textContent = c.para.topico;
    par.append(b);
    li.append(par);

    const d = document.createElement("div");
    d.className = "vk-disc" + (c.mesmaDisciplina ? "" : " difere");
    d.textContent = c.mesmaDisciplina
      ? t("vk_mesma_disc", { d: c.de.disciplina })
      : t("vk_outra_disc", { a: c.de.disciplina, b: c.para.disciplina });
    li.append(d);

    const esc = document.createElement("div");
    esc.className = "vk-esc";
    [["igual", "vk_op_igual"], ["ia", "vk_op_ia"], ["nao", "vk_op_nao"]]
      .forEach(([v, rot]) => {
        const bt = document.createElement("button");
        bt.type = "button";
        bt.className = "vk-op op-" + v + (c.escolha === v ? " ativa" : "");
        bt.textContent = t(rot);
        bt.onclick = () => { vkTriagem[k].escolha = v; vkPintarTriagem(); };
        esc.append(bt);
      });
    li.append(esc);
    box.append(li);
  });
}

function vkTodos(escolha) {
  vkTriagem.forEach((c) => { c.escolha = escolha; });
  vkPintarTriagem();
}

/* Aplica SÓ o que a pessoa marcou como "é o mesmo". */
function vkAplicarTriagem() {
  const aceitos = vkTriagem.filter((c) => c.escolha === "igual");
  if (!aceitos.length) { uiAlert(t("vk_nada_marcado")); return; }
  const ed = typeof edAberto === "function" ? edAberto() : null;
  const r = vkAplicar(aceitos.map((c) => Object.assign({}, c, {
    conf: "ALTA", por: t("vk_por_identico"), origem: "nome_identico" })),
    ed ? ed.id : "");
  reg("VINCULO", "aceitos por nome idêntico", r.novos + " vínculos");
  vkTriagem = vkTriagem.filter((c) => c.escolha !== "igual");
  vkPintarTriagem();
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  toast("vk_aplicados");
}

/* O prompt leva o que sobrou: os idênticos mandados para a IA MAIS todos os
 * pendentes que não têm nome igual. */
function vkGerarPrompt() {
  const est = vkEstudados(edDiario);
  const paraIa = new Set(vkTriagem.filter((c) => c.escolha === "ia")
    .map((c) => c.para.chave));
  const recusados = new Set(vkTriagem.filter((c) => c.escolha === "nao")
    .map((c) => c.para.chave));
  const pend = vkPendentesIa.filter((p) => {
    const k = vkChave(p.disciplina, p.nome);
    if (recusados.has(k)) return false;
    return true;
  });
  const ed = typeof edAberto === "function" ? edAberto() : null;
  const txt = vkPrompt(est, pend, ed ? ed.nome : "");
  try { navigator.clipboard.writeText(txt); } catch (e) {}
  reg("VINCULO", "prompt gerado", est.length + " estudados × " + pend.length + " pendentes");
  toast("vk_prompt_copiado");
}

function vkConferirColagem() {
  const est = vkEstudados(edDiario);
  const r = vkLerResposta($("vkColarTexto").value, est, vkPendentesIa);
  const av = $("vkColarAviso");
  av.hidden = false;
  av.innerHTML = "";
  const linha = (txt, cls) => {
    const d = document.createElement("div");
    d.className = "ed-mud" + (cls ? " " + cls : "");
    d.textContent = txt; av.append(d);
  };
  const alta = r.pares.filter((p) => p.conf === "ALTA").length;
  linha(t("vk_conf_resumo", { n: r.pares.length, a: alta, m: r.pares.length - alta }));
  if (r.ignoradas.length)
    linha(t("vk_conf_ignoradas", { n: r.ignoradas.length }), "aviso");
  if (!r.pares.length) linha(t("vk_conf_nada"), "perigo");
  return r;
}

async function vkAplicarColagem() {
  const r = vkConferirColagem();
  if (!r || !r.pares.length) return;
  const alta = r.pares.filter((p) => p.conf === "ALTA");
  const media = r.pares.filter((p) => p.conf !== "ALTA");
  /* MÉDIA nunca entra sozinha: se o app aceitasse tudo, conferir viraria
   * apertar "aplicar" e a distinção de confiança não serviria para nada. */
  let usar = alta;
  if (media.length) {
    if (await uiConfirm(t("vk_conf_media", { n: media.length })))
      usar = alta.concat(media);
  }
  const ed = typeof edAberto === "function" ? edAberto() : null;
  const res = vkAplicar(usar, ed ? ed.id : "");
  reg("VINCULO", "aplicados da IA", res.novos + " novos, " + res.repetidos + " já existiam");
  $("dlgVkColar").close();
  $("dlgJaEstudei").close();
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  await uiAlert(t("vk_aplicados_n", { n: res.novos, r: res.repetidos }));
}

function vkIniciarTela() {
  vkCarregar();
  if ($("btnJaEstudei")) $("btnJaEstudei").onclick = vkAbrir;
  if ($("btnVkTudoIa")) $("btnVkTudoIa").onclick = () => vkTodos("ia");
  if ($("btnVkTudoIgual")) $("btnVkTudoIgual").onclick = () => vkTodos("igual");
  if ($("btnVkAplicar")) $("btnVkAplicar").onclick = vkAplicarTriagem;
  if ($("btnVkPrompt")) $("btnVkPrompt").onclick = vkGerarPrompt;
  if ($("btnVkColar")) $("btnVkColar").onclick = () => {
    $("vkColarTexto").value = "";
    $("vkColarAviso").hidden = true;
    abrirModal("dlgVkColar");
  };
  if ($("btnVkFechar")) $("btnVkFechar").onclick = () => $("dlgJaEstudei").close();
  if ($("vkColarTexto")) $("vkColarTexto").addEventListener("input", vkConferirColagem);
  if ($("btnVkColarOk")) $("btnVkColarOk").onclick = vkAplicarColagem;
  if ($("btnVkColarFechar")) $("btnVkColarFechar").onclick = () => $("dlgVkColar").close();
}

/* =====================================================================
 * TELA "SALVAR CARTÕES NO MATERIAL DE ESTUDO"
 * ===================================================================== */
let cmItens = [];
let cmPlano = [];
let cmSoSemDestino = false;

/* Toda recusa e toda decisão do fluxo entram no REGISTRO. A lição veio do
 * marca-texto: enquanto a recusa era só um alerta na tela, o defeito
 * acontecia repetidas vezes e o log não tinha uma linha sobre isso —
 * consertei no escuro, e consertei pela metade. */
function cmRecusa(motivo, detalhe) {
  reg("CARTAO-MATERIAL", "recusado: " + motivo, detalhe || "");
  uiAlert(t("cm_" + motivo));
}

function cmEditalEscolhido() {
  const id = $("cmEdital") && $("cmEdital").value;
  return (editais || []).find((e) => e.id === id) || null;
}

function cmPlanoDoEdital(ed) {
  if (!ed) return [];
  const r = lerEdital(ed.texto || "");
  const lista = [];
  r.disciplinas.forEach((d) =>
    d.topicos.forEach((tp) => lista.push({ disciplina: d.nome, nome: tp.nome })));
  return lista;
}

async function cmAbrir() {
  const r = await validar();
  if (!r || !r.cards.length) { cmRecusa("sem_cartoes"); return; }
  if (!(editais || []).length) { cmRecusa("sem_edital"); return; }

  const sel = $("cmEdital");
  sel.innerHTML = "";
  editais.forEach((e) => {
    const o = document.createElement("option");
    o.value = e.id; o.textContent = e.nome;
    sel.append(o);
  });
  /* PRECISA de um padrão explícito. Sem isto, quem exporta com o edital
   * fechado cai num select vazio, a lista de tópicos vem com zero itens e
   * TODOS os cartões aparecem "sem pista" — silenciosamente, como se as
   * etiquetas não servissem para nada. */
  const valido = (editais || []).some((e) => e.id === editalAtual);
  sel.value = valido ? editalAtual : editais[0].id;
  sel.onchange = () => cmRecalcular(r.cards);
  cmRecalcular(r.cards);
  abrirModal("dlgCartaoMat");
  reg("CARTAO-MATERIAL", "conferência aberta", r.cards.length + " cartões");
}

function cmRecalcular(cards) {
  const ed = cmEditalEscolhido();
  cmPlano = cmPlanoDoEdital(ed);
  cmItens = cmClassificarLocal(cards, cmPlano);
  const dg = $("cmDiscGeral");
  if (dg) {
    dg.innerHTML = "";
    const vazio = document.createElement("option");
    vazio.value = ""; vazio.textContent = t("cm_escolha_disciplina");
    dg.append(vazio);
    const vistas = [];
    cmPlano.forEach((i) => {
      if (vistas.indexOf(i.disciplina) >= 0) return;
      vistas.push(i.disciplina);
      const o = document.createElement("option");
      o.value = i.disciplina; o.textContent = i.disciplina;
      dg.append(o);
    });
  }
  const c = cmContar(cmItens);
  reg("CARTAO-MATERIAL", "classificação local: " + (ed ? ed.nome : "sem edital"),
      c.total + " cartões · " + c.etiqueta + " por tópico, "
      + c.etiqueta_disciplina + " por disciplina, " + c.sem_pista + " sem pista"
      + " (plano: " + cmPlano.length + " tópicos)");
  cmPintar();
}

function cmPintar() {
  const c = cmContar(cmItens);
  $("cmResumo").textContent = t("cm_resumo", {
    t: c.total, d: c.comDestino, u: c.comSugestao, s: c.sem_pista });

  const box = $("cmLista");
  box.innerHTML = "";
  const mostrar = cmSoSemDestino ? cmItens.filter((x) => !x.destino) : cmItens;
  if (!mostrar.length) {
    const p = document.createElement("div");
    p.className = "esq-vazio"; p.textContent = t("cm_lista_vazia");
    box.append(p); return;
  }

  mostrar.forEach((x) => {
    const li = document.createElement("div");
    li.className = "cm-item";
    const fr = document.createElement("div");
    fr.className = "cm-frente";
    fr.textContent = "[" + (x.n + 1) + "] " + String(x.card.front || "").slice(0, 110);
    li.append(fr);

    const d = document.createElement("div");
    const geral = x.destino && x.destino.topico === CM_GERAL;
    d.className = "cm-dest" + (geral ? " geral" : (x.destino ? "" : " vazio"));
    d.textContent = x.destino
      ? "→ " + x.destino.disciplina + " › " + x.destino.topico + "  (" + t("cm_via_" + x.via) + ")"
      : t("cm_sem_destino");
    li.append(d);

    /* A sugestão fica visível e desarmada. Aplicar 519 palpites de uma vez,
     * como a v8.76 fazia, é o mesmo que não perguntar nada — e foi assim
     * que perguntas de Orçamento Base Zero foram parar em Português. */
    if (!x.destino && x.sugestao) {
      const sg = document.createElement("div");
      sg.className = "cm-sug";
      const rot = document.createElement("span");
      rot.textContent = t("cm_sugestao") + " ";
      const b = document.createElement("b");
      b.textContent = x.sugestao.disciplina + " › " + x.sugestao.topico;
      const usar = document.createElement("button");
      usar.type = "button"; usar.className = "cm-usar";
      usar.textContent = t("cm_usar");
      usar.onclick = () => { x.destino = x.sugestao; x.via = "manual"; cmPintar(); };
      sg.append(rot, b, usar);
      li.append(sg);
    }

    if (x.inventado) {
      const inv = document.createElement("div");
      inv.className = "cm-inventou";
      inv.textContent = t("cm_inventou", { n: x.inventado });
      li.append(inv);
    }

    /* trocar o destino à mão, sempre — mesmo quando a etiqueta acertou.
     * Etiqueta errada é tão fácil de escrever quanto etiqueta certa. */
    const tr = document.createElement("div");
    tr.className = "cm-troca";
    const sel = document.createElement("select");
    const vazio = document.createElement("option");
    vazio.value = ""; vazio.textContent = t("cm_nao_salvar");
    sel.append(vazio);
    const discs = [];
    cmPlano.forEach((i) => { if (discs.indexOf(i.disciplina) < 0) discs.push(i.disciplina); });
    discs.forEach((disc) => {
      const g = document.createElement("optgroup");
      g.label = disc;
      const og = document.createElement("option");
      og.value = disc + "›" + CM_GERAL;
      og.textContent = CM_GERAL;
      g.append(og);
      cmPlano.filter((i) => i.disciplina === disc).forEach((i) => {
        const o = document.createElement("option");
        o.value = disc + "›" + i.nome;
        o.textContent = i.nome;
        g.append(o);
      });
      sel.append(g);
    });
    sel.value = x.destino ? (x.destino.disciplina + "›" + x.destino.topico) : "";
    sel.onchange = () => {
      if (!sel.value) { x.destino = null; x.via = "sem_pista"; }
      else {
        const p = sel.value.split("›");
        x.destino = { disciplina: p[0], topico: p[1] };
        x.via = "manual";
      }
      delete x.inventado;
      cmPintar();
    };
    tr.append(sel);
    li.append(tr);
    box.append(li);
  });
}

function cmTudoGeral() {
  const disc = $("cmDiscGeral") && $("cmDiscGeral").value;
  if (!disc) { cmRecusa("escolha_disciplina_erro"); return; }
  const semDestino = cmItens.filter((x) => !x.destino).length;
  if (!semDestino) { cmRecusa("nada_para_geral", cmItens.length + " cartões, todos já com destino"); return; }
  const n = cmParaGerais(cmItens, disc, true);
  reg("CARTAO-MATERIAL", "mandados para os gerais de " + disc, n + " cartões");
  cmPintar();
}

/* Aceitar TODAS as sugestões de uma vez continua possível — mas é um gesto
 * seu, com o número na frente, e não o estado inicial da tela. */
async function cmUsarSugestoes() {
  const alvo = cmItens.filter((x) => !x.destino && x.sugestao);
  if (!alvo.length) { cmRecusa("sem_sugestoes"); return; }
  if (!(await uiConfirm(t("cm_conf_sugestoes", { n: alvo.length })))) return;
  alvo.forEach((x) => { x.destino = x.sugestao; });
  reg("CARTAO-MATERIAL", "sugestões aceitas em bloco", alvo.length + " cartões");
  cmPintar();
}

function cmLimpar() {
  const n = cmItens.filter((x) => x.destino).length;
  cmItens.forEach((x) => { x.destino = null; if (x.via !== "etiqueta" && x.via !== "etiqueta_disciplina") x.via = "sem_pista"; });
  reg("CARTAO-MATERIAL", "destinos limpos", n + " cartões voltaram a ficar sem destino");
  cmPintar();
}

function cmGerarPrompt() {
  const semDestino = cmItens.filter((x) => !x.destino);
  if (!semDestino.length) { cmRecusa("todos_com_destino"); return; }
  const ed = cmEditalEscolhido();
  const txt = cmPrompt(semDestino, cmPlano, ed ? ed.nome : "");
  try { navigator.clipboard.writeText(txt); } catch (e) {}
  reg("CARTAO-MATERIAL", "prompt gerado", semDestino.length + " cartões sem destino");
  toast("cm_prompt_copiado");
}

function cmConferirColagem() {
  const semDestino = cmItens.filter((x) => !x.destino);
  const r = cmLerResposta($("cmColarTexto").value, semDestino, cmPlano);
  const av = $("cmColarAviso");
  av.hidden = false; av.innerHTML = "";
  const linha = (txt, cls) => {
    const d = document.createElement("div");
    d.className = "ed-mud" + (cls ? " " + cls : "");
    d.textContent = txt; av.append(d);
  };
  const inv = r.achados.filter((x) => x.via === "ia_inventou").length;
  linha(t("cm_conf_resumo", { n: r.achados.length, i: inv }));
  if (r.ignoradas.length) linha(t("cm_conf_ignoradas", { n: r.ignoradas.length }), "aviso");
  if (!r.achados.length) linha(t("cm_conf_nada"), "perigo");
  /* o que a IA devolveu e o que foi descartado: sem isto, "a IA não
   * classificou nada" é uma queixa sem como investigar */
  if (r.ignoradas.length || inv) {
    reg("CARTAO-MATERIAL", "resposta da IA conferida",
        r.achados.length + " aceitos, " + inv + " com tópico inventado, "
        + r.ignoradas.length + " linhas descartadas"
        + (r.ignoradas[0] ? " (1ª: " + (r.ignoradas[0].motivo || "fora do formato") + ")" : ""));
  }
  return r;
}

function cmAplicarColagem() {
  const r = cmConferirColagem();
  if (!r || !r.achados.length) return;
  r.achados.forEach((a) => {
    const item = cmItens.find((x) => x.n === a.n);
    if (!item) return;
    item.destino = a.destino;
    item.via = a.via;
    if (a.inventado) item.inventado = a.inventado;
  });
  reg("CARTAO-MATERIAL", "classificação da IA aplicada", r.achados.length + " cartões");
  $("dlgCmColar").close();
  cmPintar();
}

async function cmGravarTudo() {
  const comDestino = cmItens.filter((x) => x.destino);
  if (!comDestino.length) { cmRecusa("nada_a_gravar", cmItens.length + " cartões, nenhum com destino"); return; }
  const ed = cmEditalEscolhido();
  const geral = comDestino.filter((x) => x.destino.topico === CM_GERAL).length;
  if (!(await uiConfirm(t("cm_conf_gravar", {
    n: comDestino.length, g: geral, c: ed ? ed.nome : "", f: cmItens.length - comDestino.length })))) {
    reg("CARTAO-MATERIAL", "gravação cancelada por você", comDestino.length + " cartões");
    return;
  }

  const r = cmAplicar(comDestino, ed ? ed.nome : "", matGravarCartoes);
  cmUltimoRecibo = r;
  try { guardar("eac_cm_recibo", JSON.stringify(r)); } catch (e) {}
  reg("CARTAO-MATERIAL", "gravados no material",
      r.novos + " cartões em " + r.topicos + " tópicos, " + r.repetidos + " já existiam");
  if ($("btnCmDesfazer")) $("btnCmDesfazer").hidden = false;
  $("dlgCartaoMat").close();
  if (typeof matRenderLista === "function") { try { matRenderLista(); } catch (e) {} }
  await uiAlert(t("cm_gravados", { n: r.novos, t: r.topicos, r: r.repetidos }));
}

let cmUltimoRecibo = null;

/* DESFAZER a última gravação. Tira do material exatamente as linhas do
 * recibo — não o tópico, não o que já estava lá, não o que você escreveu
 * depois. Sem isto, o primeiro erro é permanente: foi o que aconteceu com
 * 843 cartões no uso real, e não havia caminho de volta. */
async function cmDesfazerUltimo() {
  if (!cmUltimoRecibo) {
    try { cmUltimoRecibo = JSON.parse(localStorage.getItem("eac_cm_recibo") || "null"); }
    catch (e) { cmUltimoRecibo = null; }
  }
  if (!cmUltimoRecibo || !cmUltimoRecibo.recibo || !cmUltimoRecibo.recibo.length) {
    cmRecusa("nada_a_desfazer"); return;
  }
  const r = cmUltimoRecibo;
  const quantos = r.recibo.reduce((a, x) => a + x.linhas.length, 0);
  if (!(await uiConfirm(t("cm_conf_desfazer", {
    n: quantos, t: r.recibo.length,
    q: String(r.quando || "").slice(0, 16).replace("T", " ") })))) return;

  const d = cmDesfazer(r, matGravarCartoes,
    (ch) => (matResumos[ch] && matResumos[ch].cartoes) || "");
  reg("CARTAO-MATERIAL", "gravação desfeita",
      d.removidas + " cartões retirados de " + d.topicos + " tópicos");
  cmUltimoRecibo = null;
  try { localStorage.removeItem("eac_cm_recibo"); } catch (e) {}
  if ($("btnCmDesfazer")) $("btnCmDesfazer").hidden = true;
  await uiAlert(t("cm_desfeito", { n: d.removidas, t: d.topicos }));
}

function cmIniciarTela() {
  if ($("btnSalvarMaterial")) $("btnSalvarMaterial").onclick = cmAbrir;
  if ($("btnCmFechar")) $("btnCmFechar").onclick = () => $("dlgCartaoMat").close();
  if ($("btnCmGravar")) $("btnCmGravar").onclick = cmGravarTudo;
  if ($("btnCmTudoGeral")) $("btnCmTudoGeral").onclick = cmTudoGeral;
  if ($("btnCmUsarSugestoes")) $("btnCmUsarSugestoes").onclick = cmUsarSugestoes;
  if ($("btnCmLimpar")) $("btnCmLimpar").onclick = cmLimpar;
  if ($("btnCmDesfazer")) $("btnCmDesfazer").onclick = cmDesfazerUltimo;
  if ($("btnCmSoSemDestino")) $("btnCmSoSemDestino").onclick = () => { cmSoSemDestino = true; cmPintar(); };
  if ($("btnCmTodos")) $("btnCmTodos").onclick = () => { cmSoSemDestino = false; cmPintar(); };
  if ($("btnCmPrompt")) $("btnCmPrompt").onclick = cmGerarPrompt;
  if ($("btnCmColar")) $("btnCmColar").onclick = () => {
    $("cmColarTexto").value = ""; $("cmColarAviso").hidden = true;
    abrirModal("dlgCmColar");
  };
  if ($("cmColarTexto")) $("cmColarTexto").addEventListener("input", cmConferirColagem);
  if ($("btnCmColarOk")) $("btnCmColarOk").onclick = cmAplicarColagem;
  if ($("btnCmColarFechar")) $("btnCmColarFechar").onclick = () => $("dlgCmColar").close();
}

/* =====================================================================
 * P4/P5 — O RITUAL DA VIRADA (pré-edital → pós-edital)
 * ===================================================================== */
let vrCmp = null;
let vrOrfaos = [];

function vrEhPrevisto() {
  try { return lerEdital($("editalTexto").value).cfg.fase === "pre"; }
  catch (e) { return false; }
}

/* O botão só existe quando faz sentido: edital com data publicada não tem
 * virada nenhuma para fazer. */
function vrAtualizarBotao() {
  const b = $("btnVirada");
  if (b) b.hidden = !vrEhPrevisto();
}

function vrAbrir() {
  if (!vrEhPrevisto()) { uiAlert(t("vr_nao_e_previsto")); return; }
  $("vrTexto").value = "";
  $("vrAviso").hidden = true;
  $("vrOrfaos").innerHTML = "";
  vrCmp = null; vrOrfaos = [];
  abrirModal("dlgVirada");
  reg("VIRADA", "ritual aberto", (edAberto() && edAberto().nome) || "");
}

function vrGerarPrompt() {
  const txt = t("vr_prompt", { antes: $("editalTexto").value });
  try { navigator.clipboard.writeText(txt); } catch (e) {}
  reg("VIRADA", "prompt de conversão gerado", "");
  toast("vr_prompt_copiado");
}

function vrConferir() {
  const novo = $("vrTexto").value;
  const av = $("vrAviso");
  const cx = $("vrOrfaos");
  cx.innerHTML = "";
  if (!novo.trim()) { av.hidden = true; vrCmp = null; return null; }

  const c = preComparar($("editalTexto").value, novo, edProgresso, edDiario);
  vrCmp = c;
  av.hidden = false;
  av.innerHTML = "";
  const linha = (txt, cls) => {
    const d = document.createElement("div");
    d.className = "vr-resumo";
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = txt;
    d.append(s); av.append(d);
  };
  linha(t("vr_r_ficam", { n: c.ficam.length }), "vr-ok");
  linha(t("vr_r_surgem", { n: c.surgem.length }));
  if (c.somem.length) linha(t("vr_r_somem", { n: c.somem.length }), "vr-atencao");
  /* A LINHA QUE MAIS IMPORTA. Sem ela a pessoa lê "17 tópicos saíram" como
   * "perdi as horas que pus neles". */
  if (c.estudadosQueSomem.length)
    linha(t("vr_r_estudados", { n: c.estudadosQueSomem.length,
      h: Math.round((c.minutosPerdidos / 60) * 10) / 10 }), "vr-atencao");
  if (c.pesos.length) linha(t("vr_r_pesos", { n: c.pesos.length }));
  c.discSomem.forEach((d) => linha(t("vr_r_disc_sai", {
    n: d.nome, c: d.confianca || t("vr_sem_confianca"), t: d.topicos }), "vr-perigo"));
  if (!c.temData) linha(t("vr_r_sem_data"), "vr-perigo");

  vrPintarOrfaos(novo, c);
  return c;
}

/* P5 — cada órfão ganha um destino escolhido POR VOCÊ. Nada é adivinhado:
 * o que a máquina faria de palpite aqui já se mostrou ruim com os cartões
 * (v8.78), e aqui o erro custa mais. */
function vrPintarOrfaos(txtPos, c) {
  const cx = $("vrOrfaos");
  const destinos = preDestinos(txtPos);
  /* GUARDA AS ESCOLHAS ANTES DE REDESENHAR.
   * A lista é reconstruída a cada conferência — e a conferência roda de
   * novo dentro do "Aplicar". Sem isto, clicar em Aplicar apagava os
   * destinos que a pessoa acabara de escolher, e o remanejo não acontecia
   * nunca. Mesma coisa ao corrigir uma vírgula no texto colado. */
  const escolhido = {};
  vrOrfaos.forEach((o) => {
    if (o.destino) escolhido[o.tipo + "|" + o.chave] = o.destino;
  });
  vrOrfaos = [];

  c.estudadosQueSomem.forEach((e) => {
    vrOrfaos.push({ tipo: "estudo", disciplina: e.disciplina, topico: e.topico,
                    chave: e.chave, destino: escolhido["estudo|" + e.chave] || null });
  });
  preMaterialOrfao(matResumos, txtPos).forEach((m) => {
    vrOrfaos.push({ tipo: "material", disciplina: m.disciplina, topico: m.topico,
                    chave: m.chave, chars: m.chars, cartoes: m.cartoes,
                    destino: escolhido["material|" + m.chave] || null });
  });
  if (!vrOrfaos.length) return;

  const tit = document.createElement("div");
  tit.className = "nd-rot";
  tit.textContent = t("vr_orfaos_tit", { n: vrOrfaos.length });
  cx.append(tit);

  vrOrfaos.forEach((o, k) => {
    const li = document.createElement("div");
    li.className = "vr-linha";
    const nome = document.createElement("div");
    const b = document.createElement("span");
    b.className = "vr-o-nome"; b.textContent = o.topico;
    const tp = document.createElement("span");
    tp.className = "vr-o-tipo " + (o.tipo === "estudo" ? "vr-t-estudo" : "vr-t-material");
    tp.textContent = t(o.tipo === "estudo" ? "vr_t_estudo" : "vr_t_material");
    nome.append(b, tp);
    const sub = document.createElement("div");
    sub.className = "vr-o-sub";
    sub.textContent = o.tipo === "material"
      ? t("vr_o_material", { d: o.disciplina, c: o.chars, n: o.cartoes })
      : t("vr_o_estudo", { d: o.disciplina });
    const esc = document.createElement("div");
    esc.className = "vr-o-esc";
    const sel = document.createElement("select");
    const vazio = document.createElement("option");
    vazio.value = ""; vazio.textContent = t("vr_o_manter");
    sel.append(vazio);
    const discs = [];
    destinos.forEach((d) => { if (discs.indexOf(d.disciplina) < 0) discs.push(d.disciplina); });
    discs.forEach((disc) => {
      const g = document.createElement("optgroup");
      g.label = disc;
      destinos.filter((d) => d.disciplina === disc).forEach((d) => {
        const op = document.createElement("option");
        op.value = disc + "›" + d.topico;
        op.textContent = d.topico;
        g.append(op);
      });
      sel.append(g);
    });
    if (o.destino) sel.value = o.destino.disciplina + "›" + o.destino.topico;
    sel.onchange = () => {
      if (!sel.value) { vrOrfaos[k].destino = null; return; }
      const p = sel.value.split("›");
      vrOrfaos[k].destino = { disciplina: p[0], topico: p[1] };
    };
    esc.append(sel);
    li.append(nome, sub, esc);
    cx.append(li);
  });
}

async function vrAplicar() {
  const c = vrConferir();
  if (!c) { uiAlert(t("vr_cole_antes")); return; }
  if (!c.temData && !(await uiConfirm(t("vr_conf_sem_data")))) return;

  const remanejar = vrOrfaos.filter((o) => o.destino);
  if (!(await uiConfirm(t("vr_conf_aplicar", {
    f: c.ficam.length, s: c.somem.length, n: c.surgem.length,
    e: c.estudadosQueSomem.length, r: remanejar.length })))) {
    reg("VIRADA", "cancelada por você", "");
    return;
  }

  const ed = edAberto();
  const antes = $("editalTexto").value;
  guardarVersao("antes da virada do edital", antes);

  /* 1. carimbar o diário ANTES de mexer no plano: depois disso, mesmo que
   * o tópico deixe de existir, o registro continua identificável */
  const carimbados = preCarimbarDiario(edDiario, ed ? ed.nome : "", hojeISO());
  salvarDiario();

  /* 2. remanejar o que a pessoa apontou */
  let mats = 0, estudos = 0;
  remanejar.forEach((o) => {
    if (o.tipo === "material") {
      if (preRemanejarMaterial(matResumos, o.chave, o.destino.disciplina,
            o.destino.topico, matSalvar)) mats++;
    } else {
      if (preRemanejarEstudo(o.disciplina, o.topico, o.destino.disciplina,
            o.destino.topico, ed ? ed.id : "")) estudos++;
    }
  });

  /* 3. só então o texto novo. O progresso NÃO é apagado: fica guardado
   * pela chave, como na exclusão de disciplina (v8.73). */
  $("editalTexto").value = preAplicar($("vrTexto").value, c).texto;

  reg("VIRADA", "aplicada: " + (ed ? ed.nome : ""),
      c.ficam.length + " mantidos, " + c.somem.length + " saíram ("
      + c.estudadosQueSomem.length + " estudados), " + c.surgem.length + " novos · "
      + carimbados + " registros carimbados como pré-edital · "
      + mats + " materiais e " + estudos + " estudos remanejados");

  $("dlgVirada").close();
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  vrAtualizarBotao();
  await uiAlert(t("vr_pronto", {
    f: c.ficam.length, n: c.surgem.length,
    h: Math.round((c.minutosPerdidos / 60) * 10) / 10,
    m: mats + estudos }));
}

function vrIniciar() {
  if ($("btnVirada")) $("btnVirada").onclick = vrAbrir;
  if ($("btnVrPrompt")) $("btnVrPrompt").onclick = vrGerarPrompt;
  if ($("btnVrAplicar")) $("btnVrAplicar").onclick = vrAplicar;
  if ($("btnVrFechar")) $("btnVrFechar").onclick = () => $("dlgVirada").close();
  if ($("vrTexto")) $("vrTexto").addEventListener("input", vrConferir);
  vrAtualizarBotao();
}
