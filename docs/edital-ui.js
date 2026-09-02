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

/* =====================================================================
 * TEMPO DE REVISÃO — uma conta separada, porque é outra coisa
 *
 * O defeito: numa linha de REVISÃO, a tela mostrava "1h15 de 30min".
 * Os dois números existem, e nenhum dos dois está errado sozinho — o
 * problema é que eles não falam da mesma coisa:
 *
 *   1h15  = tudo o que já foi gasto neste tópico desde sempre, incluindo
 *           o estudo original de semanas atrás;
 *   30min = o orçamento SÓ DA REVISÃO (metade do tempo de um tópico
 *           novo, porque revisar custa menos que aprender).
 *
 * Compará-los dá "250% cumprido" numa revisão que ainda não começou. É
 * a mesma família de erro do "1h15 de 30min · 100%" corrigido antes:
 * dois números verdadeiros postos lado a lado como se fossem
 * comparáveis.
 *
 * A régua certa para uma revisão é o tempo gasto DEPOIS da última vez em
 * que o tópico foi dado por estudado. É isso que estas funções separam —
 * e é isso que permite responder "quanto de revisão eu já cumpri?", que
 * antes não tinha resposta em lugar nenhum do app.
 * ================================================================== */

/* MINUTOS DE REVISÃO = o que foi registrado COMO revisão.
 *
 * Cheguei a escrever isto com aritmética de datas — "o tempo gasto
 * depois da última conclusão". Era rebuscado e ambíguo: a própria sessão
 * que conclui a revisão fica de fora do intervalo, e o número zerava
 * justamente quando a revisão acabava de ser feita.
 *
 * O app já distingue os dois gestos no momento do registro: estudar um
 * tópico novo entra como "feito", reestudar um já concluído entra como
 * "revisado". A informação sempre esteve lá; bastava somá-la. */
function minutosDeRevisao(chave) {
  return (edDiario || []).reduce((a, x) => {
    if (!x || x.a !== "revisado") return a;
    const k = x.c || (typeof matChave === "function" ? matChave(x.disc, x.n) : "");
    return k === chave ? a + (Number(x.m) || 0) : a;
  }, 0);
}

/* A data do primeiro "feito" — quando o tópico foi aprendido. É o que dá
 * sentido ao total ("1h15 ao todo, desde 18/08"). */
function ultimaConclusao(chave) {
  let ult = "";
  (edDiario || []).forEach((x) => {
    if (!x || x.a !== "feito" || !x.d || x.d === "?") return;
    const k = x.c || (typeof matChave === "function" ? matChave(x.disc, x.n) : "");
    if (k !== chave) return;
    if (!ult || x.d > ult) ult = x.d;
  });
  return ult;
}

/* FATOR DE REALIDADE — quanto o plano erra, medido pelo que já aconteceu.
 *
 * O plano reparte as horas da semana por peso: "Direito Financeiro vale
 * 15% da prova, então 6h; são 12 tópicos, 30min cada". A conta é honesta
 * e a premissa é chute — 30min por tópico é o que sobrou da divisão, não
 * uma estimativa de quanto aquele tópico leva.
 *
 * Quem estuda descobre a verdade e não tem como contá-la ao app. Este
 * número conta: pega os tópicos JÁ estudados de uma disciplina e compara
 * o tempo real com o previsto. Se der 2,4, o plano dessa disciplina está
 * pedindo menos da metade do que ela custa — e as horas restantes são
 * ficção.
 *
 * De propósito, ele NÃO reescreve o plano sozinho. Um número desses,
 * calculado sobre três tópicos, ainda é frágil; aplicá-lo em silêncio
 * refaria a agenda inteira sem ninguém pedir. Ele informa, e quem decide
 * mudar as horas da semana é a pessoa.
 */
function edFatorReal(disciplina, itens) {
  const lista = (itens || []).filter((x) => x && x.disciplina === disciplina);
  let prev = 0, real = 0, n = 0;
  lista.forEach((x) => {
    const f = minutosDoTopico(x.chave);
    if (!f || !x.minutos) return;
    prev += x.minutos; real += f; n++;
  });
  /* menos de três tópicos é anedota, não medida: uma sessão longa num
   * tópico difícil viraria "a disciplina inteira custa o triplo" */
  if (n < 3 || !prev) return null;
  return { fator: real / prev, topicos: n, previsto: prev, real };
}

function edLinhaTopico(i, semDisciplina) {
  const li = document.createElement("div");
  li.className = "ed-item" + (i.feito ? " feito" : "")
    + (i.revisado ? " revisado" : "") + (i.ehRevisao ? " ehrev" : "");
  /* a chave na própria linha: é o que permite reencontrá-la depois de
   * uma repintura, para piscar exatamente a que mudou */
  if (i.chave) li.dataset.chave = i.chave;

  /* Botão, não caixa. Marcar é rápido demais para o que significa: o registro
   * passa a perguntar QUANTO e COMO, porque é isso que permite, meses depois,
   * dizer "você lê muito e resolve pouca questão". Uma caixa nunca saberia. */
  const chk = document.createElement("button");
  chk.type = "button";
  /* O SINAL DIZ O QUE FALTA, não o que passou.
   * Um "✓" verde numa revisão vencida é a mesma mentira do texto
   * riscado: o tópico foi estudado, sim, e é exatamente por isso que ele
   * está de volta na semana. O "↻" diz o que o botão vai fazer. */
  chk.className = "ed-reg" + (i.revisado ? " rev"
    : (i.ehRevisao ? " arev" : (i.feito ? " ok" : "")));
  chk.textContent = i.revisado ? "✓✓" : (i.ehRevisao ? "↻" : (i.feito ? "✓" : "+"));
  chk.title = t(i.feito ? "ed_reg_mais" : "ed_reg_novo");
  chk.onclick = (ev) => { ev.stopPropagation(); abrirRegistro(i); };

  /* O PONTO COLORIDO TEM DE SE EXPLICAR.
   * Ele carrega a decisão inteira do plano — por que este tópico está
   * na frente dos outros — e era a única coisa da linha sem nada ao
   * passar o mouse. Cor sem legenda é enfeite; com legenda, é o
   * argumento que faz a pessoa aceitar (ou contestar) a ordem. */
  const pt = document.createElement("span");
  pt.className = "ed-ponto ponto-" + i.faixa;
  pt.title = edExplicarCor(i);

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
  /* O SELO DO NÍVEL. Sem ele, a dificuldade mexeria na ordem da agenda
   * sem nada na tela explicando por quê — e ordem que muda sozinha é
   * ordem em que ninguém confia. Vencida aparece riscada: continua à
   * vista para você reavaliar, e já não pesa. */
  const dSelo = (typeof difSeloDe === "function") ? difSeloDe(i) : null;
  if (dSelo) nome.append(dSelo);

  /* "JÁ ESTUDEI ISTO" — o selo que abre a porta para o outro concurso.
   *
   * Ele NÃO diz que o tópico está feito, e não marca nada: diz que
   * existe material seu sobre este assunto, de outra prova. A decisão de
   * pular ou revisar continua sendo tomada por quem estudou, na hora em
   * que olhar o que já escreveu. */
  /* O MESMO VÍNCULO, TRÊS FRASES — porque ele atravessa três momentos.
   *
   * Ligado antes de qualquer estudo (modo "vou estudar os dois"), o selo
   * avisa que o assunto cai nas duas provas: é a hora em que isso muda
   * o que você faz, porque um estudo pode render por dois.
   * Depois que o diário registrar, ele passa a dizer onde e quando.
   * E quando houver resumo, cartões ou questões do outro lado, ele abre
   * a porta para eles.
   *
   * Nenhum dos três marca coisa alguma como estudada: quem decide pular
   * ou revisar é quem estudou. */
  const jaEst = (typeof vkAcervoDoTopico === "function")
    ? vkAcervoDoTopico(i.disciplina, i.nome) : null;
  if (jaEst && jaEst.temVinculo) {
    const b = document.createElement("button");
    b.type = "button";
    /* O NOME DO CONCURSO VEM DE ONDE A FRASE VAI FALAR.
     * Dizendo "já estudei", o nome tem de sair do diário; dizendo
     * "também cai em", tem de sair do edital onde o tópico consta. Um
     * campo só para os dois foi exatamente o que produziu a afirmação
     * falsa. */
    const doEstudo = (jaEst.itens || []).filter((x) => x.estudado)[0];
    const doOutro = (jaEst.itens || []).filter((x) => x.ondeConsta)[0];
    b.className = "ed-item-jaestudei"
      + (jaEst.temAlgo ? "" : (jaEst.temEstudo ? " sem-material" : " so-coincide"));
    b.textContent = jaEst.temAlgo ? t("vka_selo")
      : (jaEst.temEstudo ? t("vka_selo_sem_material")
                         : t("vka_selo_coincide",
                             { c: (doOutro && doOutro.ondeConsta)
                                  || (doEstudo && doEstudo.concurso) || "?" }));
    b.title = jaEst.temAlgo ? t("vka_selo_aj") : t("vka_selo_coincide_aj");
    b.onclick = (ev) => { ev.stopPropagation(); vkaAbrir(i.disciplina, i.nome); };
    nome.append(b);
  }

  /* A TRAVA DIZ QUE ATUOU. Ela dobra a presença da disciplina na semana;
   * fazer isso calado seria a agenda mudando sozinha, que é exatamente a
   * reclamação que deu origem a tudo isto. */
  if (i.trava) {
    const tv = document.createElement("span");
    tv.className = "ed-item-trava";
    tv.textContent = t("ed_trava", { b: i.travaBloco || "?" });
    tv.title = t("ed_trava_aj");
    nome.append(tv);
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
  /* chave VIVA: a lâmpada responde "existe material deste tópico?", não
   * "existe exatamente nesta grafia?". Com a chave exata, um acento de
   * diferença apagava os três indicadores e o material parecia sumido. */
  const ch = (typeof matChaveViva === "function")
    ? matChaveViva(i.disciplina, i.nome) : matChave(i.disciplina, i.nome);
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

  /* BARRA DO TÓPICO: o que você já pôs contra o que ele pede.
   *
   * A BARRA TRAVA EM 100%, O NÚMERO NÃO PODE TRAVAR.
   * Uma barra não sabe passar da própria caixa, e tudo bem. Mas o rótulo
   * dizia "1h15 de 30min · 100%", que é falso de duas formas: 1h15 de
   * 30min são 250%, e o "100%" faz parecer que o plano foi cumprido na
   * medida — quando o tópico custou duas vezes e meia o previsto.
   *
   * Isso não é detalhe estético. O plano inteiro é uma conta de horas: se
   * cada tópico consome 2,5× o reservado, as 40h da semana rendem 16h de
   * matéria, e a pessoa chega na prova com um terço do edital que a tela
   * jurava estar coberto. Esconder o excedente esconde exatamente o dado
   * que denuncia isso. */
  /* NUMA REVISÃO, A CONTA É OUTRA.
   * O orçamento da linha (i.minutos) é o da revisão — metade do de um
   * tópico novo. Medir contra ele o tempo de TODA a vida do tópico dava
   * "1h15 de 30min" numa revisão que sequer tinha começado. */
  const totalMin = minutosDoTopico(i.chave);
  const desdeQuando = i.ehRevisao ? ultimaConclusao(i.chave) : "";
  const feitoMin = i.ehRevisao ? minutosDeRevisao(i.chave) : totalMin;
  const pctReal = i.minutos ? Math.round((feitoMin / i.minutos) * 100) : 0;
  const pctT = Math.min(100, pctReal);
  const excedeu = pctReal > 115;      /* folga: 34min de 30min não é notícia */
  const barraT = document.createElement("div");
  barraT.className = "it-barra";
  const fillT = document.createElement("div");
  fillT.className = "it-fill" + (excedeu ? " excedeu"
    : (pctT >= 100 ? " cheio" : (pctT > 0 ? " parcial" : "")));
  fillT.style.width = pctT + "%";
  barraT.append(fillT);
  barraT.title = excedeu
    ? t("ed_it_barra_mais", { f: horasTexto(feitoMin), p: horasTexto(i.minutos),
        pct: pctReal, extra: horasTexto(feitoMin - i.minutos) })
    : t("ed_it_barra", { f: horasTexto(feitoMin), p: horasTexto(i.minutos), pct: pctT });
  meio.append(barraT);
  /* O NÚMERO AO LADO DA BARRA. Barra sozinha se lê "mais ou menos pela
   * metade" — e "25min de 1h" é uma decisão diferente de "50min de 1h".
   * Só aparece quando há tempo registrado: escrever "0min de 1h · 0%" em
   * 230 linhas seria ruído em cima do que ainda não começou. */
  /* NUMA REVISÃO A LINHA APARECE MESMO EM ZERO.
   * "0 de 30min de revisão" é exatamente a resposta para "quanto de
   * revisão eu já cumpri?" — e esconder o zero deixaria a pergunta sem
   * resposta justamente quando ela mais importa. */
  if (feitoMin > 0 || i.ehRevisao) {
    const num = document.createElement("div");
    num.className = "it-num" + (excedeu ? " excedeu" : (pctT >= 100 ? " cheio" : ""));
    num.textContent = (excedeu
      ? t("ed_it_num_mais", { f: horasTexto(feitoMin), p: horasTexto(i.minutos),
          extra: horasTexto(feitoMin - i.minutos) })
      : t("ed_it_num", { f: horasTexto(feitoMin), p: horasTexto(i.minutos), pct: pctT }))
      + (i.ehRevisao ? " " + t("ed_it_de_revisao") : "");
    meio.append(num);
  }
  /* O TEMPO TOTAL CONTINUA VISÍVEL — em outra linha, e nomeado.
   * Ele é informação boa ("já pus 1h15 neste tópico ao todo"); o erro
   * era usá-lo como se fosse o tempo da revisão. Numa revisão que ainda
   * não começou, esta é a única linha que aparece. */
  if (i.ehRevisao && totalMin > 0) {
    const tot = document.createElement("div");
    tot.className = "it-num it-num-total";
    tot.textContent = t("ed_it_total_antes", {
      f: horasTexto(totalMin),
      d: desdeQuando ? t("ed_it_desde", { d: desdeQuando }) : "",
    });
    tot.title = t("ed_it_total_ajuda");
    meio.append(tot);
  }

  /* a despedida precisa reencontrar esta linha depois; sem a chave aqui ela
   * teria de comparar por texto, que quebra com nomes parecidos */
  /* CARTÕES do tópico, direto da agenda — do mesmo jeito que o resumo.
   * Antes só o resumo tinha porta aqui; para fazer cartão era preciso abrir
   * o material, entrar no painel e voltar. */
  const crt = document.createElement("button");
  crt.type = "button";
  const nCards = matContarCartoes(ch);
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
  const temLei = typeof leiTem === "function" && leiTem(ch);
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
  const nQ = typeof qsContarDoTopico === "function" ? qsContarDoTopico(ch) : 0;
  qst.className = "ed-qst" + (nQ ? " tem" : "");
  qst.textContent = "❓";
  qst.title = t(nQ ? "ed_qst_ver" : "ed_qst_novo", { n: nQ, tp: i.nome });
  qst.onclick = (ev) => {
    ev.stopPropagation();
    /* direto para a resolução, sem abrir o resumo no meio do caminho —
     * igual ao que foi feito com os cartões. Sem questões salvas, o
     * mesmo botão convida a criar pela sistemática de sempre. */
    try { qsUiResponderDireto(i.disciplina, i.nome); } catch (x) {}
  };

  /* TIRAR DA AGENDA — ao lado do registro de estudo.
   * Registrar diz "fiz"; este diz "agora não" ou "não preciso". Sem ele,
   * a única saída para um item fora de hora era marcá-lo como feito,
   * que é mentira que vira número no diário. */
  const fora = document.createElement("button");
  fora.type = "button";
  fora.className = "btn-min ed-fora";
  fora.textContent = "⤳";
  fora.title = t("fa_btn_ajuda");
  fora.onclick = (ev) => {
    ev.stopPropagation();
    faAbrir(i);
  };

  li._itemChave = i.chave;
  /* "tirar da agenda" ao lado de "registrar": as duas respostas possíveis
   * para o mesmo item ficam juntas — "fiz" e "agora não". Lá no fim da
   * linha, entre os atalhos de material, ele parecia mais um documento. */
  /* UM BOTÃO DE ESTUDAR E UM MENU.
   *
   * A linha tinha seis alvos: registrar, tirar, 📄, 🃏, ⚖, ❓, desmarcar.
   * Com dez linhas na semana, sessenta alvos na mesma tela — e os quatro
   * do meio são ícones que só quem já usa reconhece. Trocar por rótulos
   * de texto pioraria: cada linha ficaria três vezes mais alta.
   *
   * A saída é reduzir, não renomear. "Estudar" leva ao que o tópico TEM
   * (resumo, ou cartões se não houver resumo, ou a criação se não houver
   * nada) e o "⋮" guarda o resto — lá dentro há espaço para escrever por
   * extenso, que é onde o rótulo de texto de fato ajuda. */
  /* "Estudar" existia para dar um alvo óbvio à linha. Com as etiquetas
   * clicáveis ele virou um quarto botão dizendo o que o primeiro chip já
   * diz — some quando há material, e fica só para o tópico vazio, onde
   * de fato não há chip nenhum e é preciso um convite. */
  const estudar = document.createElement("button");
  estudar.type = "button";
  estudar.hidden = !!(temTxt || nCards || nQ || temLei);
  estudar.className = "btn-min ed-estudar" + (temTxt || nCard ? " tem" : "");
  estudar.textContent = t(temTxt || nCard ? "ed_estudar" : "ed_estudar_criar");
  estudar.title = t(temTxt ? "ed_estudar_resumo" : (nCard ? "ed_estudar_cartoes"
    : "ed_estudar_vazio"), { n: i.nome, c: nCard });
  estudar.onclick = (ev) => {
    ev.stopPropagation();
    if (temTxt) { matAbrirEditor(i, "ler"); return; }
    if (nCard) { try { mcEstudarDireto(i.disciplina, i.nome); } catch (e) {} return; }
    matAbrirEditor(i);
  };

  const mais = document.createElement("button");
  mais.type = "button";
  mais.className = "btn-min ed-mais";
  mais.textContent = "⋮";
  mais.title = t("ed_mais_ajuda");
  mais.onclick = (ev) => {
    ev.stopPropagation();
    /* UM MENU DE CADA VEZ.
     * Sem isto, abrir o segundo deixava o primeiro aberto — e com dez
     * linhas na semana a agenda virava uma pilha de menus abertos, que
     * foi exatamente o que apareceu na tela. */
    edFecharMenus(li);
    const antigo = li.querySelector(".ed-menu");
    if (antigo) { antigo.hidden = !antigo.hidden; return; }
    const menu = document.createElement("div");
    menu.className = "ed-menu";
    /* os mesmos destinos de antes, agora com nome e contagem: dentro do
     * menu cabe a palavra que não cabia na linha */
    /* SÓ O QUE FALTA. O que existe já está na linha, como etiqueta
     * clicável; repetir aqui foi o que criou as duas listas iguais. */
    const faltando = [
      temTxt ? null : [doc, t("ed_menu_resumo_novo")],
      nCards ? null : [crt, t("ed_menu_cartoes")],
      nQ ? null : [qst, t("ed_menu_questoes")],
      temLei ? null : [lei, t("ed_menu_lei_nova")],
    ].filter(Boolean);
    if (!faltando.length) {
      const vz = document.createElement("span");
      vz.className = "ed-menu-vazio";
      vz.textContent = t("ed_menu_completo");
      menu.append(vz);
    }
    faltando.forEach(([b, rot]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "btn-min ed-menu-item" + (/ tem/.test(" " + (b.className || "")) ? " tem" : "");
      item.textContent = rot;
      item.title = b.title;
      item.onclick = (e2) => { e2.stopPropagation(); menu.hidden = true; b.onclick(e2); };
      menu.append(item);
    });
    li.append(menu);
  };

  /* STATUS NÃO É AÇÃO.
   *
   * Os quatro ícones da linha faziam duas coisas ao mesmo tempo: diziam
   * o que o tópico TEM e serviam de botão para lá ir. A crítica de
   * usabilidade acertou na parte da ação — ícone sem palavra, quatro
   * por linha, sessenta na tela. Mas varrer a semana e ver o que já tem
   * resumo continua valendo, e some junto se tudo for para o menu.
   *
   * Então cada coisa no seu lugar: aqui embaixo do nome, em palavras e
   * sem clique, o que existe; no "⋮", os caminhos. */
  const status = document.createElement("div");
  status.className = "ed-status";
  /* CLASSE PRÓPRIA, NÃO A DO BOTÃO ANTIGO.
   *
   * Na primeira versão isto reusou "ed-doc"/"ed-crt"/"ed-qst" para os
   * testes existentes continuarem encontrando o indicador. Só que essas
   * classes carregam o estilo do ÍCONE que existia ali: 22×22 pixels,
   * fundo colorido e um contador posicionado por cima. Aplicadas a uma
   * etiqueta de texto, espremeram as palavras numa caixinha quadrada e
   * grudaram "cartões" em "questões".
   *
   * Reusar nome de classe para não mexer no teste é o mesmo que mentir
   * para o teste: ele passou a confirmar uma coisa que a tela não fazia. */
  /* UMA COISA SÓ: O QUE EXISTE **É** O CAMINHO PARA ELE.
   *
   * Na versão anterior a linha dizia "3 cartões" e o menu, logo abaixo,
   * dizia "ver os 3 cartões". Duas listas com o mesmo conteúdo, uma
   * informando e a outra agindo — e a pessoa lia tudo duas vezes para
   * descobrir que era a mesma coisa. Eu tinha separado "status" de
   * "ação" por princípio, e o princípio criou a duplicata.
   *
   * Agora a etiqueta é o atalho: ela diz o que tem e leva até lá. O
   * "⋮" fica com o que NÃO existe ainda — criar o que falta —, que é a
   * única coisa que uma etiqueta de conteúdo não tem como mostrar. */
  const atalhos = [
    { tem: temTxt, cls: "ed-st-doc", rot: t("ed_st_resumo"),
      dica: t("ed_menu_resumo"), alvo: doc },
    { tem: nCards, cls: "ed-st-crt",
      rot: nCards === 1 ? t("ed_st_cartao") : t("ed_st_cartoes", { n: nCards }),
      dica: nCards === 1 ? t("ed_menu_cartoes_1") : t("ed_menu_cartoes_n", { n: nCards }),
      alvo: crt },
    { tem: nQ, cls: "ed-st-qst",
      rot: nQ === 1 ? t("ed_st_questao") : t("ed_st_questoes", { n: nQ }),
      dica: nQ === 1 ? t("ed_menu_questoes_1") : t("ed_menu_questoes_n", { n: nQ }),
      alvo: qst },
    { tem: temLei, cls: "ed-st-lei", rot: t("ed_st_lei"),
      dica: t("ed_menu_lei"), alvo: lei },
  ];
  atalhos.filter((x) => x.tem).forEach((x, k) => {
    const b = document.createElement("button");
    b.type = "button";
    /* o primeiro ganha destaque: com três chips iguais lado a lado não
     * há por onde começar, e o resumo é o que se abre em nove de dez vezes */
    b.className = "ed-st-item tem " + x.cls + (k === 0 ? " ed-st-1" : "");
    b.textContent = x.rot;
    b.title = x.dica;
    b.onclick = (ev) => { ev.stopPropagation(); x.alvo.onclick(ev); };
    status.append(b);
  });
  if (status.children.length) meio.append(status);

  li.append(chk, fora, pt, meio, estudar, mais, rev, min);
  return li;
}

/* A AGENDA PERGUNTA "ESTE SAIU?" NUM LUGAR SÓ.
 * O hub e a lista do edital desenham linhas por caminhos diferentes;
 * cada um consultando a gaveta por conta própria era como nasceriam
 * dois critérios para a mesma pergunta. */
/* A COR, EM PALAVRAS. Uma frase que diz o que a cor significa e de onde
 * ela veio — peso da disciplina × peso do tópico — para a ordem da
 * agenda poder ser conferida em vez de obedecida no escuro. */
function edExplicarCor(i) {
  const faixa = i && i.faixa ? t("ed_faixa_" + i.faixa) : null;
  if (!faixa) return t("ed_cor_sem_plano");
  const temPeso = i.disciplinaPeso != null && i.peso != null;
  return t("ed_cor_ajuda", { faixa })
    + (temPeso ? " " + t("ed_cor_conta",
        { d: i.disciplinaPeso, p: i.peso, b: i.disciplinaPeso * i.peso }) : "");
}

function edEstaFora(chave) {
  return typeof faEstaFora === "function" ? faEstaFora(chave) : false;
}

/* ---------------- TIRAR DA AGENDA, COM O PORQUÊ ---------------- */
let faItemAlvo = null;

function faAbrir(item) {
  if (!item || !$("dlgForaAgenda")) return;
  faItemAlvo = item;
  $("faAlvo").textContent = t("fa_alvo", {
    d: item.disciplina || "?", t: item.nome || item.topico || "?" });

  [["faTempo", "adiado"], ["faVez", "dispensado"]].forEach(([id, tipo]) => {
    const cx = $(id);
    if (!cx) return;
    cx.innerHTML = "";
    FA_MOTIVOS.filter((m) => m.tipo === tipo).forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min";
      b.textContent = t("fa_motivo_" + m.id)
        + (m.dias ? "  \u00b7  " + t("ed_fa_dias", { n: m.dias }) : "");
      b.onclick = () => faConfirmar(m.id);
      cx.append(b);
    });
  });
  abrirModal("dlgForaAgenda");
}

function faConfirmar(motivoId) {
  const item = faItemAlvo;
  const m = faMotivo(motivoId);
  if (!item || !m) return;
  const r = faTirar(item, motivoId);
  $("dlgForaAgenda").close();
  faItemAlvo = null;
  if (!r) return;
  /* recibo: o que aconteceu e o que esperar. "Sumiu da tela" sozinho
   * não distingue adiado de dispensado, que é justamente a diferença
   * que este gesto criou. */
  uiAlert(t(r.tipo === "adiado" ? "fa_feito_adiado" : "fa_feito_dispensado",
    { t: item.nome || item.topico || "?", d: r.ate || "" }));
  try { edRender(); } catch (e) {}
  try { hubPintarAgenda(); } catch (e) {}
}

function faListaAbrir() {
  const box = $("faListaCx");
  if (!box) return;
  box.innerHTML = "";
  const ad = faAdiados(), di = faDispensados();
  $("faListaResumo").textContent = (ad.length || di.length)
    ? t("fa_lista_resumo", { a: ad.length, d: di.length,
        h: horasTexto(faMinutosDispensados()) })
    : t("fa_lista_vazia");

  ad.concat(di).forEach((r) => {
    const li = document.createElement("div");
    li.className = "duv-item";
    const tit = document.createElement("div");
    tit.className = "duv-trecho";
    tit.textContent = (r.disciplina ? r.disciplina + " › " : "") + (r.topico || r.chave);
    const mot = document.createElement("div");
    mot.className = "fa-item-motivo";
    mot.textContent = t("fa_motivo_" + r.motivo)
      + (r.ate ? " · " + t("fa_volta_em", { d: r.ate })
               : " · " + t("fa_dispensado_rot"));
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn-min";
    b.textContent = t("fa_voltar");
    b.title = t("fa_voltar_ajuda");
    b.onclick = () => {
      faVoltar(r.chave);
      faListaAbrir();
      try { edRender(); } catch (e) {}
      try { hubPintarAgenda(); } catch (e) {}
    };
    li.append(tit, mot, b);
    box.append(li);
  });
  abrirModal("dlgForaLista");
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
  /* SEM DADO, DIZER QUE NAO HA — nao imprimir a moldura vazia.
   * Faltando "porque", isto saia como "peso , · ed_faixa_undefined ·
   * disciplina vale ,% da prova": tres campos com cara de informacao e
   * nenhum conteudo, o que e pior do que uma linha curta e verdadeira. */
  if (p.peso == null || !i.faixa) return disc + t("ed_pq_sem_plano");
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
/* O DIA DE HOJE, NO FUSO DE QUEM ESTUDA.
 *
 * Era "toISOString().slice(0, 10)", que devolve o dia em UTC. No Brasil
 * isso significa que TODO REGISTRO FEITO DEPOIS DAS 21H é gravado com a
 * data de amanhã — e quem estuda para concurso estuda à noite.
 *
 * O estrago é silencioso e composto: a sessão aparece no diário num dia
 * que ainda não chegou; a revisão passa a ser contada a partir da data
 * errada; e "dias desde que estudei" fica negativo, o que nenhuma tela
 * espera. Nada disso avisa, e nada disso se corrige depois — a data que
 * foi gravada é a que ficou.
 *
 * Aqui o dia vem dos componentes LOCAIS, que é o que a pessoa vê no
 * relógio dela. */
function hojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

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
    } else if (x.q && x.q.pct != null) {
      /* sem contagem: o diário diz isso em vez de fingir um "0 de 0" */
      pedacos.push(t("ed_diario_questoes_pct", { pct: x.q.pct }));
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

/* O NÍVEL ESCOLHIDO NESTE REGISTRO. Vazio = você não opinou agora, e
 * então a avaliação anterior fica de pé: não opinar não é o mesmo que
 * dizer "médio", e tratar os dois igual apagaria silenciosamente o que
 * você tinha declarado. */
let regDif = "";

function regDifAtual() { return regDif; }

function regDifPintar(item) {
  const cx = $("regDificuldade");
  if (!cx) return;
  cx.innerHTML = "";
  const atual = (typeof difDe === "function" && item)
    ? difDe(item.disciplina, item.nome) : null;
  (typeof DIF_NIVEIS !== "undefined" ? DIF_NIVEIS : []).forEach((nv) => {
    const b = document.createElement("button");
    b.type = "button";
    /* o que vale AGORA aparece aceso mesmo sem você tocar em nada:
     * é como se vê que já existe uma avaliação para confirmar ou mudar */
    const aceso = regDif ? regDif === nv.id
      : !!(atual && atual.nivel === nv.id && !atual.vencida);
    b.className = "reg-humor dif-" + nv.id + (aceso ? " ativa" : "");
    b.textContent = t("dif_n_" + nv.id);
    b.title = t("dif_n_" + nv.id + "_aj");
    b.onclick = () => {
      /* tocar de novo no que já está aceso desmarca: é como se tira uma
       * opinião sem ter de escolher outra */
      regDif = (regDif === nv.id) ? "" : nv.id;
      regDifPintar(item);
    };
    cx.append(b);
  });
  const eco = $("regDifEco");
  if (eco) {
    eco.textContent = !atual || !atual.nivel ? t("dif_eco_sem")
      : (atual.vencida
          ? t("dif_eco_vencida", { n: t("dif_n_" + atual.nivel), d: atual.dias })
          : t("dif_eco_atual", { n: t("dif_n_" + atual.nivel),
              o: t("dif_origem_" + atual.origem), d: atual.dias }));
  }
}

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

/* O ITEM DE VERDADE, VINDO DO PLANO.
 *
 * Quem chega ao registro por fora da agenda — o fim de uma sessao de
 * questoes, o resumo — so sabe disciplina e topico, e montava um item
 * a mao, sem peso, sem faixa e sem "porque". Dai vinham duas coisas
 * ruins e visiveis: o cabecalho do registro saia quebrado, e o diario
 * gravava o estudo com peso nulo, estragando toda conta por peso
 * depois. Procurar no plano e barato; inventar sai caro. */
function edItemDoPlano(disciplina, nome) {
  try {
    const r = lerEdital($("editalTexto").value);
    const plano = montarPlano(r, {
      horas: Number($("edHoras").value) || r.cfg.horas,
      prova: $("edProva").value, feitos: edProgresso });
    const alvo = matChaveNormal(matChave(disciplina, nome));
    return plano.itens.filter((x) => matChaveNormal(x.chave) === alvo)[0] || null;
  } catch (e) { return null; }
}

/* Qual dos dois lançamentos está preparado neste momento. Começa pelo
 * que o plano diz, e só muda se a pessoa discordar explicitamente. */
let regTipo = "feito";

/* As formas de estudo, num lugar só — antes esta lista era montada
 * dentro de abrirRegistro, e por isso não havia como repintá-la quando o
 * tipo do lançamento mudava. */
function regPintarFormas() {
  const cx = $("regFormas");
  if (!cx) return;
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
}

function regPintarBotoes() {
  const b = $("btnRegEstudo");
  if (b) {
    b.textContent = t(regTipo === "revisado" ? "ed_reg_revisao" : "ed_reg_estudo");
    b.title = t(regTipo === "revisado" ? "ed_reg_revisao_ajuda"
                                       : "ed_reg_estudo_ajuda");
  }
  const o = $("btnRegOutro");
  if (o) {
    o.textContent = t(regTipo === "revisado" ? "ed_reg_como_estudo"
                                             : "ed_reg_como_revisao");
  }
}

function abrirRegistro(i) {
  /* enriquece AQUI, num lugar so: qualquer porta de entrada nova ganha
   * o mesmo tratamento sem precisar lembrar disto */
  const aberto = (typeof edAberto === "function") ? edAberto() : null;
  const deOutroEdital = i && i.edital && (!aberto
    || String(i.edital) !== String(aberto.id));
  /* NÃO ENRIQUECER COM O PLANO DE OUTRO EDITAL. O plano aqui é o do
   * edital ABERTO; para uma linha que veio de outro, ele descreveria um
   * tópico homônimo — mesma disciplina, mesmo nome, outro concurso — e
   * o registro sairia com o peso, os minutos e o estado do vizinho. */
  if (i && i.porque == null && !deOutroEdital) {
    const real = edItemDoPlano(i.disciplina, i.nome);
    if (real) i = Object.assign({}, real, {
      minutos: i.minutos != null ? i.minutos : real.minutos,
      feito: i.feito != null ? i.feito : real.feito,
      /* de qual edital veio a linha SOBREVIVE ao enriquecimento: é ele
       * que decide onde a marca vai ser gravada */
      edital: i.edital != null ? i.edital : real.edital,
    });
  }
  regAtual = i;
  regFormas = i.feito ? ["revisao"] : ["leitura"];
  regHumor = "media";
  regDif = "";
  $("regTitulo").textContent = i.nome;
  $("regSub").textContent = i.disciplina + " · " + edPorque(i, true);
  $("regMinutos").value = i.minutos;
  $("regMinSlider").value = Math.min(240, i.minutos);
  ["regQFeitas", "regQCertas", "regQPctCampo", "regOnde", "regObs"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  regQSoPct = false;
  if ($("regObs")) $("regObs").hidden = true;
  regPintarAtalhos();
  regPintarQuestoes();

  regPintarFormas();

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

  /* O BOTÃO DIZ O QUE VAI FAZER.
   * Um tópico já estudado que volta é revisão; um tópico novo é estudo.
   * O app sabe a diferença — e dizê-la no rótulo é o que transforma uma
   * decisão silenciosa numa informação. O segundo botão continua
   * existindo para quando a pessoa discordar (reler um tópico que ela
   * mal viu é estudo novo, não revisão), mas em cinza e à direita: é a
   * exceção, não a escolha de todo dia. */
  regDifPintar(i);

  regTipo = i.feito ? "revisado" : "feito";
  regPintarBotoes();
  abrirModal("dlgRegistro");
}

/* Os campos de questão só existem quando "questões" está marcado. */
/* PERCENTUAL SOZINHO É UM DADO LEGÍTIMO.
 * "34 de 40" ninguém lembra depois de fechar o caderno; "uns 85%" todo
 * mundo lembra. Sem esta saída, o campo ficava vazio (perdendo o dado)
 * ou era chutado com números inventados — que depois entram nas contas
 * como se tivessem sido contados. O diário guarda o percentual e diz
 * que não houve contagem. */
let regQSoPct = false;

function regPintarQuestoes() {
  const bl = $("regQuestoesBloco");
  if (!bl) return;
  bl.hidden = regFormas.indexOf("questoes") < 0;
  const par = $("regQSoPctCx");
  const btn = $("btnRegQSoPct");
  /* dois blocos irmãos, cada um com o seu id: esconder pelo parentNode do
   * campo parecia mais curto, mas amarra o comportamento à forma do HTML
   * e não dá para o teste afirmar nada sobre ele. */
  if ($("regQContagem")) $("regQContagem").hidden = regQSoPct;
  if (par) par.hidden = !regQSoPct;
  if (btn) {
    btn.textContent = t(regQSoPct ? "ed_reg_conta_exata" : "ed_reg_so_pct");
    btn.title = t(regQSoPct ? "ed_reg_conta_ajuda" : "ed_reg_so_pct_ajuda");
  }
  regPintarPct();
}

/* o que vai para o diário: contagem, percentual puro, ou nada */
function regQuestoesDoFormulario() {
  if (regQSoPct) {
    const v = Number(($("regQPctCampo") || {}).value);
    if (!isFinite(v) || String(($("regQPctCampo") || {}).value).trim() === "") return null;
    const pct = Math.max(0, Math.min(100, Math.round(v)));
    return { pct, semContagem: true };
  }
  const qf = Number(($("regQFeitas") || {}).value) || 0;
  const qc = Math.min(qf, Number(($("regQCertas") || {}).value) || 0);
  return qf ? { feitas: qf, certas: qc } : null;
}

function regPintarPct() {
  if (regQSoPct) {
    const eco = $("regQPctEco");
    if (eco) {
      const v = Number(($("regQPctCampo") || {}).value);
      const vazio = String(($("regQPctCampo") || {}).value).trim() === "";
      const pct = vazio ? null : Math.max(0, Math.min(100, Math.round(v)));
      eco.textContent = pct == null ? "" : pct + "%";
      eco.className = "reg-q-pct" + (pct == null ? ""
        : (pct < 60 ? " baixo" : (pct < 80 ? " medio" : "")));
    }
    return;
  }
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
  const qDados = regQuestoesDoFormulario();
  /* A DIFICULDADE ANTES DE MARCAR: edMarcar redesenha a agenda, e a
   * agenda mostra o selo do nível. Gravar depois pintaria a tela com o
   * valor velho até a próxima repintura. */
  if (typeof difDefinir === "function") {
    if (regDif) difDefinir(item.disciplina, item.nome, regDif, "declarada");
    else if (typeof difDoHumor === "function") {
      /* você não opinou: o "rendeu pouco/bem" da sessão vira palpite —
       * e o palpite não pisa numa declaração sua que ainda vale */
      difDoHumor(item.disciplina, item.nome, regHumor);
    }
  }
  edMarcar(item, estado, {
    minutos: Math.max(1, Number($("regMinutos").value) || item.minutos),
    formas: regFormas.slice(),
    humor: regHumor,
    /* só grava questões quando houve questões: campo vazio não vira zero,
     * porque "0 de 0" e "não fiz questões" são coisas diferentes na conta
     * de acerto depois */
    questoes: qDados,
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

/* Grava o estado no edital DONO do item, que nem sempre é o aberto. */
function edMarcarProgresso(i, estado) {
  const alvo = (typeof edAberto === "function") ? edAberto() : null;
  const deOutro = i.edital && (!alvo || String(i.edital) !== String(alvo.id));
  if (!deOutro) {
    if (estado) edProgresso[i.chave] = { e: estado, d: hojeISO() };
    else delete edProgresso[i.chave];
    edSalvar();
    return true;
  }
  /* A AGENDA DO TOPO JUNTA TODOS OS EDITAIS; edProgresso é de UM só.
   *
   * Este era o defeito, e ele não dava nenhum sinal: registrar uma linha
   * do edital B enquanto o A estava aberto escrevia no progresso do A.
   * A linha de B nunca saía da agenda — por mais vezes que se
   * registrasse —, e o A ganhava calado um tópico "revisado" que ninguém
   * estudou lá. O registro dizia "revisado: Leis Orçamentárias" nas duas
   * vezes, e as duas vezes foram no edital errado.
   *
   * A linha já sabe de onde veio (i.edital). Faltava alguém perguntar. */
  const dono = (typeof editais !== "undefined" ? editais : [])
    .filter((e) => String(e.id) === String(i.edital))[0];
  if (!dono) return false;
  dono.progresso = dono.progresso || {};
  if (estado) dono.progresso[i.chave] = { e: estado, d: hojeISO() };
  else delete dono.progresso[i.chave];
  dono.tocado = new Date().toISOString();
  if (typeof edSalvarLista === "function") edSalvarLista();
  return true;
}

function edMarcar(i, estado, detalhe, semRender) {
  const gravou = edMarcarProgresso(i, estado);
  if (!gravou) {
    try { reg("ERRO", "registro sem edital dono: " + i.nome, String(i.edital)); }
    catch (e) {}
  }
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
  if (!semRender) edRender();
  /* A AGENDA DO TOPO é repintada pela despedida (edDespedir chama
   * hubPintarAgenda), que é por onde todo registro passa. Cheguei a pôr
   * um hubRender() aqui também; tirei porque nenhum teste conseguia
   * distinguir as duas versões — e código que ninguém consegue mostrar
   * que faz diferença é código que vai apodrecer sem aviso. */
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
    /* TRÊS ESTADOS, NÃO DOIS. "sem data" e "já passou" são coisas
     * diferentes, e tratar as duas como "dias === null" fazia uma prova
     * encerrada aparecer como se nunca tivesse tido data marcada. */
    prazo.textContent = l.grupo === "encerrado"
      ? t("hub_prazo_ha_dias", { n: l.desde })
      : (l.dias === null ? t("hub_prazo_sem") : t("hub_prazo_dias", { n: l.dias }));
    if (l.grupo === "encerrado") prazo.classList.add("passou");
    else if (l.dias !== null && l.dias <= 30) prazo.classList.add("urgente");

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

/* =====================================================================
 * O PAINEL DOS MÍNIMOS
 *
 * Desenho pensado para uma leitura só, de relance, respondendo na ordem:
 *
 *   1. Estou em risco? — a cor e o rótulo do bloco.
 *   2. Quanto falta?   — a distância entre a barra e a linha do corte.
 *   3. Onde estudar?   — as disciplinas do bloco, listadas.
 *
 * A escolha visual que faz o painel funcionar é a LINHA DO CORTE
 * desenhada dentro da própria barra. Duas barras lado a lado (coberto e
 * mínimo) obrigam a comparar dois comprimentos, e comparar comprimentos
 * separados é justamente o que o olho faz mal. Com a linha por cima, a
 * pergunta vira binária: a barra passou do risco, ou não passou.
 *
 * A ordem é a do risco, não a do edital: o bloco em que você pode ser
 * eliminado vem primeiro, mesmo sendo o menor da prova.
 * ================================================================== */
function edPintarBlocos(plano) {
  const blocos = (plano && plano.blocos) || [];
  const comMin = blocos.filter((b) => b.minPct !== null);
  if (!comMin.length) return null;

  const cx = document.createElement("div");
  cx.className = "ed-caixa ed-min-cx";

  const emRisco = comMin.filter((b) => b.abaixo).length;
  const tit = document.createElement("div");
  tit.className = "ed-caixa-tit" + (emRisco ? " ed-min-alerta" : "");
  tit.textContent = emRisco
    ? t("ed_min_tit_risco", { n: emRisco })
    : t("ed_min_tit_ok", { n: comMin.length });
  cx.append(tit);

  const sub = document.createElement("p");
  sub.className = "nota";
  /* A RESSALVA VEM JUNTO, não escondida numa ajuda: o mínimo do edital é
   * de ACERTOS e a barra mede COBERTURA. Estar acima da linha é condição
   * necessária, não suficiente — e prometer o contrário seria pior que
   * não ter o painel. */
  sub.textContent = t("ed_min_ajuda");
  cx.append(sub);

  /* risco primeiro, depois apertado, depois o resto — e dentro de cada
   * grupo, o que vale mais na prova na frente */
  const ordem = comMin.slice().sort((a, b) =>
    (b.abaixo ? 2 : b.apertado ? 1 : 0) - (a.abaixo ? 2 : a.apertado ? 1 : 0)
    || b.fatia - a.fatia);

  ordem.forEach((b) => {
    const li = document.createElement("div");
    li.className = "ed-min-bloco"
      + (b.abaixo ? " ed-min-abaixo" : (b.apertado ? " ed-min-apertado" : ""));

    const cab = document.createElement("div");
    cab.className = "ed-min-cab";
    const nm = document.createElement("span");
    nm.className = "ed-min-nome";
    nm.textContent = b.nome;
    const est = document.createElement("span");
    est.className = "ed-min-estado";
    est.textContent = b.abaixo ? t("ed_min_abaixo")
      : (b.apertado ? t("ed_min_apertado") : t("ed_min_ok"));
    cab.append(nm, est);
    li.append(cab);

    /* A BARRA COM A LINHA DO CORTE POR CIMA. */
    const barra = document.createElement("div");
    barra.className = "ed-min-barra";
    const fill = document.createElement("div");
    fill.className = "ed-min-fill";
    fill.style.width = Math.min(100, b.pct) + "%";
    const corte = document.createElement("div");
    corte.className = "ed-min-corte";
    corte.style.left = Math.min(100, b.minPct) + "%";
    corte.title = t("ed_min_corte", { p: b.minPct });
    barra.append(fill, corte);
    barra.title = t("ed_min_barra", { c: b.pct, m: b.minPct, n: b.nome });
    li.append(barra);

    const num = document.createElement("div");
    num.className = "ed-min-num";
    num.textContent = t("ed_min_num", {
      c: b.pct, m: b.minPct, f: b.feitos, tt: b.topicos, fatia: b.fatia });
    li.append(num);

    /* O ACERTO DO BLOCO, quando há questões que o sustentem — e SEMPRE
     * em linha própria, nunca somado à cobertura. Cobrir 100% e acertar
     * 40% é uma situação real, e a média dos dois descreveria alguém que
     * não existe. */
    if (b.acerto !== null && b.acerto !== undefined) {
      const ac = document.createElement("div");
      ac.className = "ed-min-acerto"
        + (b.acertoAbaixo ? " abaixo" : (b.acertoApertado ? " apertado" : ""));
      ac.textContent = t("ed_min_acerto", {
        a: b.acerto, m: b.minPct, meta: b.metaAcerto, n: b.acertoAmostra });
      li.append(ac);
    } else if (b.minPct !== null) {
      const ac = document.createElement("div");
      ac.className = "nota ed-min-semacerto";
      ac.textContent = t("ed_min_sem_acerto", { n: ED_AMOSTRA_MINIMA });
      li.append(ac);
    }

    /* ONDE ESTUDAR: as disciplinas do bloco, uma linha cada, com os DOIS
     * números. Antes era só uma lista de nomes separada por vírgula: o
     * painel dizia que havia risco e não dizia de quê, e com quatro
     * disciplinas dentro isso não é informação, é um enigma. */
    const dl = document.createElement("div");
    dl.className = "ed-min-linhas";
    (b.linhas || []).forEach((L) => {
      const ln = document.createElement("div");
      ln.className = "ed-min-linha"
        + (L.acertoAbaixo ? " abaixo" : (L.acertoApertado ? " apertado" : ""));
      const nm2 = document.createElement("button");
      nm2.type = "button";
      nm2.className = "ed-item-disc-link";
      nm2.textContent = L.nome;
      nm2.title = t("ed_abrir_disc", { d: L.nome });
      nm2.onclick = (ev) => { ev.stopPropagation(); abrirDisciplina(L.nome); };

      const cob = document.createElement("span");
      cob.className = "ed-min-cel";
      cob.textContent = t("ed_min_l_cob", { c: L.cobertura });
      cob.title = t("ed_min_l_cob_aj");

      const acc = document.createElement("span");
      acc.className = "ed-min-cel"
        + (L.acertoAbaixo ? " ruim" : (L.seguro ? " bom" : ""));
      acc.textContent = L.acerto === null ? t("ed_min_l_sem")
        : t("ed_min_l_ac", { a: L.acerto, n: L.acertoAmostra });
      acc.title = L.acerto === null
        ? t("ed_min_sem_acerto", { n: ED_AMOSTRA_MINIMA })
        : t("ed_min_l_ac_aj", { n: L.acertoAmostra });

      ln.append(nm2, cob, acc);
      /* o percentual anotado de cabeça vem à parte, com o nome dele: sem
       * isso, ou ele some (perdendo o dado) ou vira acerto contado
       * (mentindo sobre a origem) */
      if (L.acertoAnotado !== null && L.acertoAnotado !== undefined) {
        const an = document.createElement("span");
        an.className = "ed-min-cel anotado";
        an.textContent = t("ed_min_l_anotado", { a: L.acertoAnotado });
        an.title = t("ed_min_l_anotado_aj");
        ln.append(an);
      }
      dl.append(ln);
    });
    li.append(dl);

    cx.append(li);
  });
  return cx;
}

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

  /* -------- os mínimos por bloco, LOGO ABAIXO DA IDENTIDADE --------
   * Vem antes de tudo o que fala de peso, e de propósito: peso é uma
   * questão de quanto você pontua, mínimo é uma questão de você ser ou
   * não eliminado. Quem lê a tela de cima para baixo tem de encontrar a
   * eliminação primeiro. */
  const pBloc = edPintarBlocos(plano);
  if (pBloc) box.append(pBloc);

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

    /* COLUNAS ALINHADAS, NÃO UMA FRASE POR LINHA.
     * Antes cada disciplina carregava a mesma frase inteira — "falta X%
     * da prova · vale Y% · Z para estudar primeiro" — repetida seis
     * vezes em vermelho. Ler seis frases para comparar três números é
     * trabalho que a tela devia fazer: em coluna, a comparação é o
     * próprio alinhamento, e o olho desce pelo número que interessa.
     * O cabeçalho existe porque, sem ele, três porcentagens seguidas na
     * mesma linha não dizem qual é qual — e era justamente essa confusão
     * ("13% da prova" lido como o peso da disciplina) que a frase longa
     * tentava desfazer com palavras. */
    const cab = document.createElement("div");
    cab.className = "lac-cab";
    [["ed_lac_col_disc", ""], ["ed_lac_col_feito", "lac-num"],
     ["ed_lac_col_vale", "lac-num"], ["ed_lac_col_falta", "lac-num"],
     ["ed_lac_col_prior", "lac-num"]].forEach(([k, cls]) => {
      const c = document.createElement("span");
      c.className = "lac-cab-c " + cls;
      c.textContent = t(k);
      c.title = t(k + "_ajuda");
      cab.append(c);
    });
    cx2.append(cab);

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
      /* a barra e o número do progresso ocupam a MESMA coluna: a barra é
       * a leitura de relance, o número é a conferência */
      const feito = document.createElement("span");
      feito.className = "lac-num lac-feito";
      feito.append(ba);
      const pf = document.createElement("i");
      pf.textContent = Math.round(d.pesoFeito) + "%";
      feito.append(pf);

      const vale = document.createElement("span");
      vale.className = "lac-num";
      vale.textContent = d.fatia + "%";

      const falta = document.createElement("span");
      /* FALTA é a coluna que explica a ordem da lista. Tirá-la deixaria
       * uma tabela ordenada por um critério invisível. */
      falta.className = "lac-num lac-falta";
      falta.textContent = d.lacuna + "%";

      const prior = document.createElement("span");
      prior.className = "lac-num" + (d.altaIntocada ? " lac-alerta" : "");
      prior.textContent = d.altaIntocada ? String(d.altaIntocada) : "—";
      prior.title = t("ed_lac_val_ajuda", { d: d.nome, l: d.lacuna, f: d.fatia });

      li.append(nm, feito, vale, falta, prior);
      li.title = t("ed_lac_val_ajuda", { d: d.nome, l: d.lacuna, f: d.fatia });
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

    /* O CARD FECHADO RESPONDE UMA PERGUNTA SÓ: E AGORA?
     *
     * Antes ele trazia seis números em corpo miúdo — estudados,
     * revisados, porcentagem, fatia da prova, e as bolinhas das três
     * faixas — com peso e porcentagem aparecendo duas vezes, na barra
     * e no badge. Seis números que não dizem o que fazer.
     *
     * Fechado ele agora tem nome, UMA barra e o PRÓXIMO TÓPICO. Os
     * números não sumiram: mudaram de lugar, para dentro do card
     * aberto, que é onde se vai quando a pergunta deixa de ser "e
     * agora?" e passa a ser "como estou nesta matéria?". */
    const share = Math.round((pesoDaDisc[d.nome] / (plano.peso.total || 1)) * 100);
    const proximo = edProximoDa(meus);
    if (proximo) {
      const pr = document.createElement("button");
      pr.type = "button";
      pr.className = "ed-card-prox";
      pr.textContent = t("ed_card_prox", { n: proximo.nome });
      pr.title = t("ed_card_prox_ajuda", { n: proximo.nome,
        p: proximo.disciplinaPeso != null ? proximo.disciplinaPeso * proximo.peso : "?" });
      pr.onclick = (ev) => {
        ev.stopPropagation();
        if (typeof matAbrirEditor === "function") matAbrirEditor(proximo, "ler");
      };
      card.append(pr);
    } else {
      const pr = document.createElement("div");
      pr.className = "ed-card-prox ed-card-prox-fim";
      pr.textContent = t("ed_card_prox_fim");
      card.append(pr);
    }

    const abrir = document.createElement("button");
    abrir.className = "ed-abrir";
    abrir.textContent = edAbertas[d.nome] ? t("ed_fechar") : t("ed_abrir_detalhe");
    abrir.onclick = () => { edAbertas[d.nome] = !edAbertas[d.nome]; edRender(); };
    card.append(abrir);
    if (edAbertas[d.nome]) {
      /* os números que saíram da capa vivem aqui */
      const cont = document.createElement("div");
      cont.className = "ed-card-conta";
      cont.textContent = t("ed_card_conta", { f: feitos, t: meus.length,
        p: pesoD.pctFeito, r: revs });
      const fatia = document.createElement("div");
      fatia.className = "ed-fatia";
      fatia.textContent = t("ed_fatia", { p: share });
      card.append(cont, fatia, edPontos(meus));

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

/* O PRÓXIMO TÓPICO DESTA DISCIPLINA.
 * O mesmo critério da agenda — maior peso da disciplina × peso do
 * tópico — restrito ao que ainda não foi feito e não está fora da
 * agenda. Se estiver tudo feito, devolve nulo e o card diz isso. */
/* fecha os menus abertos das OUTRAS linhas */
function edFecharMenus(menos) {
  ["edAgendaTopo", "edPainel"].forEach((id) => {
    const raiz = $(id);
    if (!raiz || !raiz.querySelectorAll) return;
    (raiz.querySelectorAll(".ed-menu") || []).forEach((m) => {
      if (menos && menos.querySelector && menos.querySelector(".ed-menu") === m) return;
      m.hidden = true;
    });
  });
}

function edProximoDa(itens) {
  const livres = (itens || []).filter((i) => !i.feito && !edEstaFora(i.chave));
  if (!livres.length) return null;
  return livres.slice().sort((a, b) => (b.bruto || 0) - (a.bruto || 0))[0];
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
  if (!novoTxt.trim()) {
    av.hidden = true;
    /* A SAÍDA ANTECIPADA DEIXAVA A TELA MENTINDO. Com a caixa vazia, o
     * aviso sumia e a lista de "o que some" continuava lá, descrevendo
     * um texto que já não existe — junto com os botões de conserto, que
     * agiriam sobre nada. Apagar o texto tem de apagar tudo o que foi
     * dito sobre ele. */
    edColarPintarLista(null);
    return null;
  }

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
  /* DUAS FRASES, DUAS COISAS.
   *
   * "107 tópicos somem" descrevia uma revisão em que nada se perdeu e
   * assustava com razão aparente — dividir "Cassação, anulação,
   * revogação e convalidação" em quatro linhas FAZ o nome antigo deixar
   * de existir, e isso não é perda, é o objetivo.
   *
   * Alarme falso ensina a ignorar o alarme. Então a renomeação vira
   * informação neutra, e a palavra "somem" fica reservada para o que
   * some de verdade. */
  const renomeados = (c.herdados || []).length;
  const perdidos = (c.semHerdeiro || []).length;
  if (renomeados) linha(t("ed_colar_renomeados", { n: renomeados }));
  if (perdidos && !c.orfaos.length)
    linha(t("ed_colar_somem", { n: perdidos }), "aviso");
  /* e o único risco real de uma renomeação: a marca de estudado */
  const marcados = (c.somemDetalhe || []).filter((x) => x.marcado).length;
  if (marcados && !c.orfaos.length)
    linha(t("ed_colar_somem_marcados", { n: marcados }), "perigo");
  edColarPintarLista(c);
  if (c.ignoradas) linha(t("ed_colar_ignoradas", { n: c.ignoradas }), "aviso");
  if (!c.orfaos.length && !c.discSomem.length && !c.pesosMudam.length && !c.somem.length)
    linha(t("ed_colar_sem_perda"), "ok");

  return Object.assign(c, { novoTxt });
}

/* ------------------------------------------------------------------
 * A LISTA DO QUE SOME — separada em duas, porque são duas coisas.
 *
 * "107 tópicos somem" não é uma informação sobre a qual se possa
 * decidir: aceitar arrisca perder conteúdo, recusar joga fora a revisão
 * inteira. E as duas causas são opostas — dividir uma linha em quatro
 * FAZ o nome antigo sumir, e não perdeu nada.
 * ------------------------------------------------------------------ */
function edColarPintarLista(c) {
  const cx = $("edColarListaCx");
  const box = $("edColarLista");
  if (!cx || !box) return;
  /* "c" nulo é a caixa vazia: some tudo, inclusive as ações */
  const det = (c && c.somemDetalhe) || [];
  cx.hidden = !det.length;
  const bRec = $("btnEdColarRecolocar");
  const bPro = $("btnEdColarPrompt");
  const perdidos = (c && c.semHerdeiro) || [];
  /* A FAIXA INTEIRA aparece com a lista: as três ações só fazem sentido
   * quando há algo que sumiu para conferir. */
  const faixa = $("edColarAcoes");
  if (faixa) faixa.hidden = !det.length;
  /* A EXPLICAÇÃO ACOMPANHA O BOTÃO.
   * Esconder só o botão deixava a frase que o explica sozinha na tela —
   * "Devolve ao texto acima..." sem nada para apertar, descrevendo uma
   * ação que não existe naquele momento. */
  const par = (id, mostrar) => {
    /* pelo ID, não pelo parentNode: depender da forma do HTML amarra o
     * comportamento ao desenho e nenhum teste alcança a relação */
    const el = $(id);
    if (el) el.hidden = !mostrar;
  };
  par("edColarAcaoRecolocar", perdidos.length > 0);
  par("edColarAcaoPrompt", perdidos.length > 0);
  if (bRec) {
    bRec.hidden = !perdidos.length;
    bRec.textContent = t("ed_colar_recolocar", { n: perdidos.length });
  }
  if (bPro) bPro.hidden = !perdidos.length;
  /* copiar a lista serve mesmo quando tudo tem herdeiro: é a conferência */
  par("edColarAcaoCopiar", det.length > 0);
  const bCop = $("btnEdColarCopiarLista");
  if (bCop) bCop.hidden = !det.length;
  if (!det.length) { box.innerHTML = ""; return; }

  const tit = $("edColarListaTit");
  if (tit) {
    tit.textContent = t("ed_colar_lista_tit", {
      h: (c.herdados || []).length, p: perdidos.length });
  }

  box.innerHTML = "";
  const grupo = (rotulo, itens, perdido, explica) => {
    if (!itens.length) return;
    const g = document.createElement("div");
    g.className = "ed-colar-grupo";
    g.textContent = rotulo + " (" + itens.length + ")";
    box.append(g);
    /* O MOTIVO JUNTO DO GRUPO. Sem ele, uma lista de cem linhas
     * intitulada "divididos ou renomeados" ainda parece um problema —
     * a pessoa lê cem nomes desaparecendo e conta com o pior. */
    if (explica) {
      const e = document.createElement("div");
      e.className = "nota ed-colar-grupo-exp";
      e.textContent = explica;
      box.append(e);
    }
    itens.forEach((x) => {
      const li = document.createElement("div");
      li.className = "ed-colar-item" + (perdido ? " perdido" : "");
      const de = document.createElement("span");
      de.className = "de";
      de.textContent = x.d + " › " + x.t;
      li.append(de);
      /* MARCADO COMO ESTUDADO é o que dói: some a linha e some junto a
       * prova de que você já passou por ela */
      if (x.marcado) {
        const m = document.createElement("span");
        m.className = "marca";
        m.textContent = t("ed_colar_marcado");
        li.append(m);
      }
      if (!perdido && x.herdeiros.length) {
        const v = document.createElement("span");
        v.className = "virou";
        v.textContent = t("ed_colar_virou", {
          l: x.herdeiros.map((h) => h.nome).join(" · ") });
        li.append(v);
      }
      box.append(li);
    });
  };
  /* o que não tem para onde ter ido vem PRIMEIRO: é a lista sobre a qual
   * se decide, e enterrá-la depois de noventa divisões legítimas seria
   * escondê-la com aparência de completude */
  grupo(t("ed_colar_g_perdidos"), perdidos, true,
        t("ed_colar_g_perdidos_exp"));
  grupo(t("ed_colar_g_herdados"), (c.herdados || []), false,
        t("ed_colar_g_herdados_exp"));
}

function edColarTextoDaLista(c) {
  const L = [];
  ((c && c.semHerdeiro) || []).forEach((x) => {
    L.push("@ " + x.d + "  >  " + x.t);
  });
  return L.join("\n");
}

/* O CONSERTO MECÂNICO: devolve ao texto colado, na disciplina certa,
 * cada tópico que sumiu sem herdeiro — com o peso e o motivo originais. */
async function edColarRecolocar() {
  const c = edConferirColagem();
  if (!c || !(c.semHerdeiro || []).length) return;
  /* SEGUNDA CONFIRMAÇÃO. O botão mexe no texto que a pessoa colou, e
   * mexer no texto de outra pessoa sem avisar é o tipo de ajuda que
   * ninguém pediu. A frase diz o que muda E o que NÃO muda. */
  if (!(await uiConfirm(t("ed_colar_conf_recolocar",
      { n: c.semHerdeiro.length })))) return;
  const r = edRecolocarPerdidos(c.novoTxt, c.semHerdeiro, $("editalTexto").value);
  $("edColarTexto").value = r.texto;
  /* reconfere na hora: o número que a pessoa vê tem de ser o do texto
   * que está na caixa agora, não o de antes do conserto */
  edConferirColagem();
  const avisos = [t("ed_colar_recolocou", { n: r.postos })];
  if (r.semDisciplina.length) {
    avisos.push(t("ed_colar_recolocou_nao", {
      n: r.semDisciplina.length,
      l: r.semDisciplina.slice(0, 3).map((x) => x.d + " › " + x.t).join(", ") }));
  }
  uiAlert(avisos.join("\n\n"));
  reg("EDITAL-COLAR", "topicos sem herdeiro devolvidos ao texto",
      r.postos + " recolocados, " + r.semDisciplina.length + " sem disciplina");
}

/* COPIAR DE VERDADE.
 * A primeira versão chamava copiar(), que não existe neste app — o
 * botão falhava calado, que é o pior modo de falhar: parece que copiou.
 * Aqui a promessa só é feita depois que o navegador confirma. */
function edColarCopiarTexto(txt, aviso, btn) {
  if (!txt) return Promise.resolve(false);
  const ok = () => {
    if (btn) {
      const antes = btn.textContent;
      btn.textContent = "✓ " + t("diag_copiado");
      btn.disabled = true;
      setTimeout(() => { btn.textContent = antes; btn.disabled = false; }, 1800);
    }
    if (aviso) uiAlert(aviso);
    return true;
  };
  try {
    return navigator.clipboard.writeText(txt).then(ok, () => {
      uiAlert(t("toast_copy_fail"));
      return false;
    });
  } catch (e) {
    uiAlert(t("toast_copy_fail"));
    return Promise.resolve(false);
  }
}

async function edColarPrompt() {
  const c = edConferirColagem();
  if (!c) return;
  const lista = edColarTextoDaLista(c);
  if (!lista) return;
  const n = (c.semHerdeiro || []).length;
  /* SEGUNDA CONFIRMAÇÃO, com o que vai acontecer dentro dela. */
  if (!(await uiConfirm(t("ed_colar_conf_prompt", { n })))) return;
  const txt = t("ed_colar_prompt_txt", { n, l: lista });
  await edColarCopiarTexto(txt, t("ed_colar_prompt_copiado"),
                           $("btnEdColarPrompt"));
  reg("EDITAL-COLAR", "prompt de reinclusao copiado", n + " topicos");
}

/* LIMPAR A CAIXA para colar outra versão.
 *
 * Sem isto, trocar de versão exigia selecionar quinhentas linhas com o
 * cursor dentro de uma caixa de doze linhas de altura — e um "colar"
 * feito sem apagar tudo emenda os dois planos num texto que o leitor
 * aceita e ninguém escreveu. */
async function edColarLimpar() {
  const cx = $("edColarTexto");
  if (!cx) return;
  if (String(cx.value || "").trim()
      && !(await uiConfirm(t("ed_colar_conf_limpar")))) return;
  cx.value = "";
  edConferirColagem();
  if (cx.focus) cx.focus();
  toast("ed_colar_limpou");
}

async function edColarCopiarLista() {
  const c = edConferirColagem();
  if (!c) return;
  const det = c.somemDetalhe || [];
  if (!det.length) return;
  if (!(await uiConfirm(t("ed_colar_conf_copiar", { n: det.length })))) return;
  const L = [];
  (c.semHerdeiro || []).forEach((x) => {
    L.push("SEM CORRESPONDENCIA  " + x.d + " > " + x.t);
  });
  (c.herdados || []).forEach((x) => {
    L.push("virou outro nome      " + x.d + " > " + x.t
      + "  ->  " + x.herdeiros.map((h) => h.nome).join(" | "));
  });
  await edColarCopiarTexto(L.join("\n"), "", $("btnEdColarCopiarLista"));
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

  /* A ÚLTIMA PERGUNTA VEM SEMPRE, com os números dentro.
   * As confirmações acima só aparecem quando há risco; sem elas, um
   * plano de 533 tópicos podia substituir outro num clique só, e a
   * única ação irreversível da caixa era a mais fácil de disparar. */
  if (!(await uiConfirm(t("ed_colar_conf_aplicar", {
      a: c.topicosAntes, d: c.topicosDepois, dd: c.discDepois })))) return;

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
  /* PROVA QUE JÁ FOI NÃO TEM "SEMANAS RESTANTES".
   * Dizia "0 semanas até a prova (−6 dias)" — dois números errados na
   * mesma linha. Agora diz o que é: já foi, há quanto tempo, e que o
   * plano abaixo virou retrato em vez de cronograma. */
  const bRestam = $("edRestam");
  if (plano.vencida) {
    bRestam.textContent = t("ed_prova_passou", {
      d: $("edProva").value, n: plano.diasDesde });
    if (bRestam.classList) bRestam.classList.add("ed-passou");
  } else {
    bRestam.textContent = s
      ? t("ed_restam", { s: s.semanas, d: s.dias }) : t("ed_sem_data");
    if (bRestam.classList) bRestam.classList.remove("ed-passou");
    /* CONCURSO DE DUAS DATAS: dizer as duas.
     * O prazo mostrado é o da PRÓXIMA fase; a outra não pode ficar
     * invisível, ou a pessoa planeja dezembro sem saber que janeiro
     * existe — e, passada a objetiva, se assusta com uma agenda que
     * trocou de conteúdo sozinha. */
    const f2 = r.cfg && r.cfg.fase2;
    if (f2 && f2.prova && plano.fase && plano.fase.n === 1) {
      bRestam.textContent += "  ·  " + t("ed_fase2_resumo", {
        nome: f2.nome, d: f2.prova, n: plano.fase2N, h: f2.horas });
    }
  }

  /* MARCAR QUASE TUDO PARA A SEGUNDA FASE ANULA A MARCA.
   * Se 80% dos tópicos voltam em janeiro, a marca deixou de dizer o que
   * priorizar e virou decoração — e a agenda de janeiro fica com o mesmo
   * tamanho da de dezembro, num prazo três vezes menor. */
  if (plano.fase && plano.fase.temFase2 && plano.total) {
    const pct = Math.round((plano.fase2N / plano.total) * 100);
    if (pct > 40) {
      const av = document.createElement("div");
      av.className = "nota ed-passou";
      av.textContent = t("ed_fase2_muitos", {
        n: plano.fase2N, tot: plano.total, p: pct });
      bRestam.append(av);
    }
  }
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
  if ($("btnFaFechar")) $("btnFaFechar").onclick = () => {
    $("dlgForaAgenda").close(); faItemAlvo = null;
  };
  if ($("btnFaListaFechar")) $("btnFaListaFechar").onclick = () => $("dlgForaLista").close();
  ["regQFeitas", "regQCertas", "regQPctCampo"].forEach((id) => {
    if ($(id)) $(id).addEventListener("input", regPintarPct);
  });
  if ($("btnRegQSoPct")) $("btnRegQSoPct").onclick = () => {
    /* trocar de modo NÃO joga fora o que já estava preenchido: quem veio
     * de uma sessão de questões chega com a contagem certa e pode querer
     * voltar atrás sem redigitar */
    regQSoPct = !regQSoPct;
    if (regQSoPct && $("regQPctCampo") && !String($("regQPctCampo").value).trim()) {
      const f = Number(($("regQFeitas") || {}).value) || 0;
      const c = Number(($("regQCertas") || {}).value) || 0;
      if (f) $("regQPctCampo").value = String(Math.round((Math.min(c, f) / f) * 100));
    }
    regPintarQuestoes();
  };
  if ($("btnRegObs")) $("btnRegObs").onclick = () => {
    const t2 = $("regObs");
    t2.hidden = !t2.hidden;
    $("btnRegObs").textContent = t(t2.hidden ? "ed_reg_obs_abrir" : "ed_reg_obs_fechar");
  };
  $("btnRegEstudo").onclick = () => confirmarRegistro(regTipo);
  $("btnRegOutro").onclick = () => {
    regTipo = regTipo === "revisado" ? "feito" : "revisado";
    /* TROCAR O TIPO TROCA A FORMA PADRÃO.
     * Quem clica aqui está declarando "esta sessão foi da outra
     * natureza". Manter "leitura" marcada num lançamento de revisão —
     * ou o contrário — mandaria o tempo para a conta errada, e é
     * exatamente o tipo de divergência que ninguém percebe depois. */
    regFormas = regTipo === "revisado" ? ["revisao"] : ["leitura"];
    regPintarFormas();
    regPintarQuestoes();
    regPintarBotoes();
  };
  $("btnEditalColar").onclick = () => {
    $("edColarTexto").value = "";
    $("edColarAviso").hidden = true;
    abrirModal("dlgEdColar");
  };
  $("edColarTexto").addEventListener("input", edConferirColagem);
  $("btnEdColarAplicar").onclick = edAplicarColagem;
  $("btnEdColarFechar").onclick = () => $("dlgEdColar").close();
  if ($("btnEdColarRecolocar")) $("btnEdColarRecolocar").onclick = edColarRecolocar;
  if ($("btnEdColarPrompt")) $("btnEdColarPrompt").onclick = edColarPrompt;
  if ($("btnEdColarLimpar")) $("btnEdColarLimpar").onclick = edColarLimpar;
  if ($("btnEdColarCopiarLista")) {
    $("btnEdColarCopiarLista").onclick = edColarCopiarLista;
  }
  $("btnEditalCorrigir").onclick = () => {
    if (edCorrecaoPendente) edAplicar(edCorrecaoPendente);
  };
  /* PASSO 1 DA REVISÃO — copiar o pedido, dentro da mesma caixa em que
   * a resposta vai ser colada.
   *
   * Era um botão separado na bancada que abria uma janela de texto para
   * a pessoa selecionar e copiar à mão; e nada ligava aquele botão ao
   * outro, do outro lado da linha, que recebe a resposta. Agora copia de
   * verdade, confirma que copiou e diz o tamanho — porque "abriu uma
   * janela com texto" não é o mesmo que "está na área de transferência",
   * e essa diferença era descoberta depois, na hora de colar. */
  if ($("btnEdColarPedido")) $("btnEdColarPedido").onclick = async () => {
    const txt = t("ed_prompt");
    await edColarCopiarTexto(txt, t("ed_rev_pedir_ok",
      { l: txt.split("\n").length, c: txt.length }), $("btnEdColarPedido"));
    reg("EDITAL", "pedido de revisão copiado", txt.length + " caracteres");
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
  if ($("btnNdPrompt")) {
    $("btnNdPrompt").onclick = () => {
      const cx = $("ndPromptCx");
      cx.hidden = !cx.hidden;
      $("btnNdPrompt").textContent = t(cx.hidden ? "nd_prompt_btn" : "nd_prompt_btn_fechar");
      if (!cx.hidden) ndPintarPrompt();
    };
  }
  if ($("btnNdCopiar")) {
    $("btnNdCopiar").textContent = t("nd_copiar");
    $("btnNdCopiar").onclick = () => {
      ndPintarPrompt();
      try { navigator.clipboard.writeText($("ndPrompt").value); } catch (e) {}
      const b2 = $("btnNdCopiar");
      const r = b2.textContent;
      b2.textContent = t("copied");
      setTimeout(() => { b2.textContent = r; }, 1800);
    };
  }
  if ($("btnNdAplicarIA")) {
    $("btnNdAplicarIA").textContent = t("nd_aplicar_ia");
    $("btnNdAplicarIA").onclick = () => ndAplicarIA();
  }
  /* o prompt cita a disciplina que se está criando: se o nome muda, ele
   * tem de mudar junto, senão a IA recebe um alvo velho */
  if ($("ndNome")) $("ndNome").addEventListener("input", ndPintarPrompt);
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

/* ---------------- O PROMPT DA DISCIPLINA ----------------
 *
 * Preencher 22 tópicos com peso e justificativa à mão é o tipo de
 * trabalho que ninguém faz duas vezes — e quando faz, faz mal: no
 * edital do TCE-PE, 17 disciplinas saíram com peso 3, o que anula a
 * priorização inteira (prioridade é peso da disciplina × peso do
 * tópico; se todos são 3, tudo empata).
 *
 * O prompt não escreve no edital: preenche os CAMPOS desta janela. O
 * texto só entra depois que a pessoa conferir e apertar Incluir — a
 * mesma regra dos outros rituais de IA do app. */
function ndMontarPrompt() {
  let concurso = "", banca = "";
  try {
    const cfg = (lerEdital($("editalTexto").value).cfg) || {};
    concurso = cfg.concurso || "";
    banca = cfg.banca || "";
  } catch (e) {}
  return t("nd_prompt", {
    concurso: concurso || "—",
    banca: banca || "—",
    disc: String(($("ndNome") || {}).value || "").trim() || "—",
  });
}

function ndPintarPrompt() {
  if (!$("ndPrompt")) return;
  $("ndPrompt").value = ndMontarPrompt();
}

/* LÊ A RESPOSTA DA IA.
 * Tolerante com o que muda entre modelos (acento em TÓPICOS, dois
 * pontos ausentes, linha em branco no meio) e rígido com o que
 * importa: sem nome de disciplina não há o que preencher. */
function ndLerRespostaIA(txt) {
  const linhas = String(txt || "").split(/\r?\n/);
  const semAcento = (x) => String(x).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toUpperCase();
  let nome = "", peso = null;
  const topicos = [];
  let emTopicos = false;
  linhas.forEach((l0) => {
    const l = String(l0).trim();
    if (!l) return;
    const chave = semAcento(l);
    if (/^DISCIPLINA\s*:?/.test(chave)) {
      nome = l.replace(/^[^:]*:?/, "").trim();
      emTopicos = false; return;
    }
    if (/^PESO\s*:?/.test(chave)) {
      const m = l.match(/(\d+)/);
      if (m) peso = Math.max(1, Math.min(5, Number(m[1])));
      emTopicos = false; return;
    }
    if (/^TOPICOS\s*:?/.test(chave)) { emTopicos = true; return; }
    if (emTopicos) topicos.push(l.replace(/^[-*\u2022]\s*/, ""));
  });
  return { nome, peso, topicos };
}

function ndAplicarIA() {
  const cru = String(($("ndColar") || {}).value || "").trim();
  if (!cru) { uiAlert(t("nd_ia_vazio")); return false; }
  const r = ndLerRespostaIA(cru);
  if (!r.nome) { uiAlert(t("nd_ia_sem_nome")); return false; }
  $("ndNome").value = r.nome;
  if (r.peso) { ndPeso = r.peso; ndPintarPesos(); }
  if (r.topicos.length) $("ndTopicos").value = r.topicos.join("\n");
  ndPintarPrompt();
  reg("EDITAL", "disciplina preenchida pela IA",
      r.nome + " · peso " + (r.peso || "?") + " · " + r.topicos.length + " tópicos");
  uiAlert(t("nd_ia_ok", { d: r.nome, p: r.peso || "?", n: r.topicos.length }));
  return true;
}

function ndAbrir() {
  ndPeso = 3;
  $("ndNome").value = "";
  $("ndTopicos").value = "";
  if ($("ndColar")) $("ndColar").value = "";
  if ($("ndPromptCx")) $("ndPromptCx").hidden = true;
  if ($("btnNdPrompt")) $("btnNdPrompt").textContent = t("nd_prompt_btn");
  ndPintarPrompt();
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
/* A LISTA DA ESQUERDA QUE FOI MANDADA À IA.
 * A conferência precisa dela para reconhecer as respostas, e não pode
 * recalculá-la: no modo dos dois editais ela depende da disciplina
 * escolhida, e trocar a disciplina depois de copiar o prompt faria a
 * colagem descartar a resposta inteira dizendo "não achei". */
let vkOrigemIa = [];
/* AS DUPLAS QUE A TRIAGEM SEMÂNTICA ESCOLHEU.
 * Vazio = ninguém triou, e o fluxo é o de sempre (duas listas, uma
 * disciplina por vez). Cheio = o prompt passa a classificar duplas
 * prontas, e o log mostra a proximidade de cada uma. */
let vzDuplasAtuais = [];
let vzCortados = 0;

/* ------------------------------------------------------------------
 * O ACERVO DO OUTRO CONCURSO, com os quatro depósitos reais.
 *
 * vinculos.js não conhece material.js nem questoes.js — ele é sobre a
 * LIGAÇÃO, não sobre o que está ligado. É aqui, na camada de tela, que
 * os quatro acervos se juntam; e é por isso que a função lá aceita os
 * mapas de fora e o teste consegue entregar mapas de mentira.
 * ------------------------------------------------------------------ */
function vkAcervoDoTopico(disciplina, topico) {
  /* a chave do vínculo é normalizada; os acervos usam a original. O
   * diário é a ponte: ele guarda a chave real de cada estudo. */
  const chaveReal = {};
  const nomeReal = {};
  const estudo = {};
  (edDiario || []).forEach((x) => {
    if (!x || !x.n || x.a === "pendente") return;
    const norm = vkChave(x.disc, x.n);
    const real = (typeof matChave === "function")
      ? matChave(x.disc, x.n) : (x.disc + "›" + x.n).toLowerCase();
    chaveReal[norm] = real;
    if (!nomeReal[norm]) nomeReal[norm] = (x.disc || "") + "›" + x.n;
    /* o registro MAIS RECENTE manda: um tópico estudado duas vezes tem
     * duas linhas no diário, e a data que importa é a última */
    const antes = estudo[norm];
    if (!antes || String(x.d || "") > String(antes.data || "")) {
      estudo[norm] = { data: x.d || "", concurso: x.cc || "", acao: x.a || "" };
    }
  });

  /* matResumos e a variavel viva do modulo de material; matResumosAtual
   * so existe no simulador de teste, e usa-la aqui daria um objeto vazio
   * no navegador — o acervo apareceria sempre sem resumo nem cartoes. */
  const resumos = (typeof matResumos !== "undefined" && matResumos) || {};
  const leis = {};
  const questoes = {};
  Object.keys(chaveReal).forEach((norm) => {
    const real = chaveReal[norm];
    try {
      leis[real] = (typeof leisDoTopico === "function")
        ? leisDoTopico(real) : [];
    } catch (e) { leis[real] = []; }
    try {
      questoes[real] = (typeof qsContarDoTopico === "function")
        ? qsContarDoTopico(real) : 0;
    } catch (e) { questoes[real] = 0; }
  });

  /* EM QUAL EDITAL CADASTRADO CADA TÓPICO EXISTE.
   *
   * É a resposta certa para "de qual concurso é isto?" quando o diário
   * não registrou nada. O primeiro edital que contém o tópico vence: um
   * mesmo nome em dois editais é raro, e quando acontece qualquer um dos
   * dois é uma resposta melhor do que nenhuma. */
  const editalDoTopico = {};
  /* QUAL DELES AINDA VAI ACONTECER.
   *
   * É o que separa os dois usos do vínculo. De um concurso que já
   * passou só interessa o MATERIAL — o registro de "estudei isto para o
   * TCE-PE" não muda nada hoje. De um concurso que ainda vem, a
   * coincidência é o próprio aviso: você vai estudar isto duas vezes
   * sem perceber. */
  const editalAtivo = {};
  const hoje = hojeISO();
  (typeof editais !== "undefined" ? editais : []).forEach((e) => {
    const nome = vkNomeDoEdital(e.id) || e.nome || "";
    const r = lerEdital(e.texto || "");
    const s3 = typeof edSituacao === "function" ? edSituacao(e) : {};
    /* sem data de prova, conta como ativo: um edital que você ainda não
     * datou é um edital que você ainda pretende fazer, e chamá-lo de
     * encerrado esconderia justamente o aviso que ele deve dar */
    const prova = (s3 && s3.prova) || (r.cfg && r.cfg.prova) || "";
    const vivo = !prova || String(prova).slice(0, 10) >= hoje;
    (r.disciplinas || []).forEach((d) => {
      (d.topicos || []).forEach((tp) => {
        const k = vkChave(d.nome, tp.nome);
        if (!editalDoTopico[k]) editalDoTopico[k] = nome;
        if (vivo) editalAtivo[k] = true;
        if (!chaveReal[k]) chaveReal[k] = matChave(d.nome, tp.nome);
        /* o nome do edital vence o do diário: é o texto que você
         * escreveu no plano, e é como o assunto aparece em toda parte */
        nomeReal[k] = d.nome + "›" + tp.nome;
      });
    });
  });

  return vkAcervoDe(disciplina, topico,
                    { chaveReal, nomeReal, estudo, resumos, leis, questoes,
                      editalDoTopico, editalAtivo });
}

/* ------------------------------------------------------------------
 * A GAVETA DE CONSULTA
 * ------------------------------------------------------------------ */
function vkaAbrir(disciplina, topico) {
  const ac = vkAcervoDoTopico(disciplina, topico);
  const sub = $("vkaSub");
  if (sub) sub.textContent = t("vka_sub", { d: disciplina, t: topico });
  const box = $("vkaLista");
  if (!box) return;
  box.innerHTML = "";

  (ac.itens || []).forEach((x) => {
    const li = document.createElement("div");
    li.className = "vka-item";
    const cab = document.createElement("div");
    cab.className = "vka-cab";
    cab.textContent = x.disciplina + " › " + x.topico;
    li.append(cab);

    /* QUANDO E PARA QUEM. É o par que decide: "estudei há 40 dias para o
     * TCE-PE" e "estudei há dois anos" pedem coisas diferentes. */
    /* A FRASE SEGUE O DADO, e não o contrário.
     *
     * Havia uma frase só — "Estudado para {c}" — usada tanto para o
     * registro do diário quanto para a dedução de "em qual edital este
     * tópico existe". Resultado: tópico nenhum estudado aparecia como
     * estudado, em dois editais marcando 0%.
     *
     * São três estados e três frases:
     *   · estudado, com data  → "Estudado para X em 12/03, há 40 dias"
     *   · não estudado, edital que ainda vem → "Também cai em X"
     *   · não estudado, edital encerrado → "Consta no edital de X" */
    const q = document.createElement("div");
    q.className = "vka-quando" + (x.estudado ? "" : " vka-so-consta");
    let txt;
    if (x.estudado) {
      txt = t(x.acao === "revisado" ? "vka_revisado_em" : "vka_estudado_em",
              { c: x.concurso || "?", d: x.data || "" });
      if (typeof difDias === "function") {
        const dias = difDias(x.data);
        if (isFinite(dias)) txt += t("vka_ha_dias", { n: dias });
      }
    } else {
      txt = t(x.ativo ? "vka_tambem_cai" : "vka_so_consta",
              { c: x.ondeConsta || x.concurso || "?" });
    }
    q.textContent = txt;
    li.append(q);

    const acervo = document.createElement("div");
    acervo.className = "vka-acervo";
    const botao = (rot, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min";
      b.textContent = rot;
      b.onclick = fn;
      acervo.append(b);
    };
    if (x.resumoChars) {
      botao(t("vka_resumo", { n: x.resumoChars }) + " · " + t("vka_abrir"),
            () => vkaIrPara(x, "resumo"));
    }
    if (x.cartoes) {
      botao(t("vka_cartoes", { n: x.cartoes }) + " · " + t("vka_abrir"),
            () => vkaIrPara(x, "cartoes"));
    }
    if (x.leis) {
      botao(t("vka_leis", { n: x.leis }) + " · " + t("vka_abrir"),
            () => vkaIrPara(x, "leis"));
    }
    if (x.questoes) {
      botao(t("vka_questoes", { n: x.questoes }) + " · " + t("vka_abrir"),
            () => vkaIrPara(x, "questoes"));
    }
    if (!x.temAlgo) {
      const n = document.createElement("div");
      n.className = "vka-nada";
      /* "foi estudado mas não sobrou material" só pode ser dito de um
       * tópico que foi mesmo estudado. Para os outros, a verdade é
       * mais simples: não há material daquele lado. */
      n.textContent = t(x.estudado ? "vka_nada" : "vka_sem_material");
      acervo.append(n);
    }
    li.append(acervo);
    box.append(li);
  });

  abrirModal("dlgVkAcervo");
  reg("VINCULO", "acervo de outro concurso consultado",
      disciplina + " › " + topico + " · " + (ac.itens || []).length + " ligado(s)");
}

/* ABRIR O MATERIAL DO OUTRO TÓPICO — o de lá, no lugar dele.
 *
 * Nunca copiar para cá. Trazer o texto para o tópico desta prova
 * misturaria o recorte de dois concursos num resumo só, e ninguém
 * saberia depois qual parte foi escrita para qual banca. */
function vkaIrPara(item, onde) {
  $("dlgVkAcervo").close();
  const alvo = { disciplina: item.disciplina, nome: item.topico };
  if (onde === "questoes" && typeof qsUiAbrirDoTopico === "function") {
    qsUiAbrirDoTopico(item.chave);
    return;
  }
  if (typeof matAbrirEditor === "function") {
    matAbrirEditor(alvo, true);
    if (onde === "cartoes" && typeof matCartoesAbrir === "function") {
      matCartoesAbrir();
    }
  }
}

function vkPendentesDoEdital() {
  const r = lerEdital($("editalTexto").value);
  const plano = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas,
    prova: $("edProva").value, feitos: edProgresso });
  /* só os PENDENTES: comparar o que já foi estudado aqui é desperdício e
   * ainda polui a conferência com pares inúteis */
  return plano.itens.filter((i) => !i.feito)
    .map((i) => ({ disciplina: i.disciplina, nome: i.nome }));
}

/* Os editais que podem entrar na comparação. */
function vkEditaisPara(sel, escolhido) {
  if (!sel) return;
  sel.innerHTML = "";
  (typeof editais !== "undefined" ? editais : []).forEach((e) => {
    const o = document.createElement("option");
    o.value = e.id;
    const cfg = lerEdital(e.texto || "").cfg || {};
    o.textContent = e.nome || cfg.concurso || t("ed_sem_nome");
    if (String(e.id) === String(escolhido)) o.selected = true;
    sel.append(o);
  });
  /* o VALUE explícito, além do "selected" na opção: são duas formas de
   * dizer a mesma coisa, e só a primeira é lida por quem pergunta
   * "sel.value" logo depois — inclusive o próprio app, três linhas
   * abaixo, ao montar o resumo. */
  const primeiro = (typeof editais !== "undefined" ? editais : [])[0];
  sel.value = String(escolhido || (primeiro ? primeiro.id : ""));
}

/* O CABEÇALHO DE UM EDITAL — nome do concurso e cargo, que é o que
 * decide se dois assuntos homônimos são a mesma coisa. */
function vkNomeDoEdital(id) {
  const e = (typeof editais !== "undefined" ? editais : [])
    .filter((x) => String(x.id) === String(id))[0];
  if (!e) return "";
  const cfg = lerEdital(e.texto || "").cfg || {};
  return cfg.concurso || e.nome || "";
}

/* Os pendentes de um edital ESCOLHIDO — não mais só o aberto. */
function vkPendentesDe(id) {
  const e = (typeof editais !== "undefined" ? editais : [])
    .filter((x) => String(x.id) === String(id))[0];
  if (!e) return [];
  const r = lerEdital(e.texto || "");
  const s2 = typeof edSituacao === "function" ? edSituacao(e) : {};
  const plano = montarPlano(r, { horas: (r.cfg || {}).horas || 10,
    prova: s2.prova, feitos: e.progresso || {} });
  return plano.itens.filter((i) => !i.feito)
    .map((i) => ({ disciplina: i.disciplina, nome: i.nome }));
}

/* O que foi estudado NUM edital: o diário filtrado pelo concurso dele. */
function vkEstudadosDe(id) {
  const nome = vkNomeDoEdital(id);
  const doEdital = (edDiario || []).filter((x) =>
    !nome || String(x.cc || "") === nome);
  /* sem nome de concurso no diário antigo, vale tudo: registros de antes
   * da marca de concurso não podem sumir da comparação */
  return vkEstudados(doEdital.length ? doEdital : edDiario);
}

/* ------------------------------------------------------------------
 * OS DOIS MODOS
 *
 * "estudei" — a origem é o DIÁRIO. Responde "o que eu não preciso
 *   refazer?", e só enxerga o que já foi estudado.
 * "ambos"   — a origem são os PENDENTES do outro edital. Responde "o que
 *   eu vou estudar duas vezes sem perceber?", que é a pergunta de quem
 *   tem duas provas abertas ao mesmo tempo.
 *
 * O vínculo criado é o mesmo objeto nos dois casos, e é por isso que
 * este segundo modo não trouxe estrutura nova: assim que o diário
 * registrar qualquer um dos lados, o material passa a aparecer do outro
 * lado sozinho.
 * ------------------------------------------------------------------ */
let vkModo = "estudei";

function vkEhAmbos() { return vkModo === "ambos"; }

/* A LISTA DA ESQUERDA. É o único ponto em que os dois modos divergem. */
function vkOrigemDe(id) {
  return vkEhAmbos() ? vkComoOrigem(vkPendentesDe(id)) : vkEstudadosDe(id);
}

/* Trocar de modo ou de edital JOGA FORA A TRIAGEM.
 * As duplas foram calculadas para um par de editais; mantê-las depois
 * de trocar um dos lados montaria um prompt sobre um concurso e uma
 * conferência sobre outro. */
function vzEsquecer() {
  vzDuplasAtuais = [];
  vzCortados = 0;
  if ($("vzEstado")) $("vzEstado").hidden = true;
}

function vkTrocarModo(m) {
  if (vkModo === m) return;
  vkModo = m;
  vzEsquecer();
  reg("VINCULO", "modo da comparacao", m);
  vkPintarModo();
  vkPintarDiscs();
  vkPintarLados();
}

/* O que muda na tela quando o modo muda: os rótulos dos dois lados, a
 * explicação do topo, o texto dos dois passos e a faixa de disciplinas.
 * Deixar qualquer um destes falando do outro modo seria a tela dizendo
 * uma coisa e fazendo outra. */
function vkPintarModo() {
  const amb = vkEhAmbos();
  const liga = (id, on) => {
    const b = $(id);
    if (b && b.classList) b.classList.toggle("vk-modo-on", on);
  };
  liga("btnVkModoEstudei", !amb);
  liga("btnVkModoAmbos", amb);
  const põe = (id, chave) => { if ($(id)) $(id).textContent = t(chave); };
  põe("vkExplica", amb ? "vk_explica_ambos" : "vk_explica");
  põe("vkRotDe", amb ? "vk_de_ambos" : "vk_de_onde");
  põe("vkRotPara", amb ? "vk_para_ambos" : "vk_para_onde");
  põe("btnVkPrompt", amb ? "vk_prompt_btn_ambos" : "vk_prompt_btn");
  põe("vkPromptExp", amb ? "vk_prompt_exp_ambos" : "vk_prompt_exp");
  põe("vkColarExp", amb ? "vk_colar_exp_ambos" : "vk_colar_exp");
  /* O RECORTE À MÃO É O CAMINHO SEM CHAVE. Com as duplas na mesa, a
   * disciplina deixou de ser o modo de encurtar a pergunta, e deixar os
   * dois seletores na tela sugeriria que ainda mandam em alguma coisa. */
  if ($("vkDiscs")) $("vkDiscs").hidden = !amb || vzDuplasAtuais.length > 0;
  if ($("vzPasso")) $("vzPasso").hidden = !amb;
  if (amb) vzPintarChave();
  /* o atalho dos nomes idênticos é do outro modo: ali ele compara o que
   * foi estudado; aqui não há nada estudado para comparar */
  if (amb && $("vkAtalho")) $("vkAtalho").hidden = true;
}

/* AS DISCIPLINAS DOS DOIS LADOS, com o par provável já escolhido.
 * O palpite é do app; a escolha é de quem estuda. */
function vkPintarDiscs() {
  if (!vkEhAmbos()) return;
  const de = ($("vkDeEdital") || {}).value || "";
  const para = ($("vkParaEdital") || {}).value || "";
  const dA = vkDisciplinasDe(vkPendentesDe(de));
  const dB = vkDisciplinasDe(vkPendentesDe(para));
  const encher = (sel, lista, escolhido) => {
    if (!sel) return;
    sel.innerHTML = "";
    lista.forEach((nome) => {
      const o = document.createElement("option");
      o.value = nome; o.textContent = nome;
      if (nome === escolhido) o.selected = true;
      sel.append(o);
    });
    sel.value = escolhido || lista[0] || "";
  };
  const antesA = ($("vkDeDisc") || {}).value || "";
  const escolhaA = dA.indexOf(antesA) >= 0 ? antesA : (dA[0] || "");
  encher($("vkDeDisc"), dA, escolhaA);
  /* o outro lado acompanha: trocar a disciplina da esquerda e deixar a
   * direita parada montaria um prompt comparando duas matérias que não
   * têm nada a ver — e a IA responderia alguma coisa */
  encher($("vkParaDisc"), dB, vkParDisciplina(escolhaA, dB) || dB[0] || "");
}

/* =====================================================================
 * A TRIAGEM SEMÂNTICA (PASSO 0)
 *
 * Ela ORDENA e ENCURTA. Não vincula, não marca, não decide — e a
 * insistência tem motivo: um vínculo errado faz um tópico sumir da
 * agenda, e esse erro não pode nascer de uma multiplicação de vetores.
 * O cosseno mede "falam do mesmo assunto?"; a pergunta do aplicativo é
 * "estudar um cobre o outro, para estes dois cargos?" — e o cargo não
 * está escrito no nome do tópico.
 *
 * O que ela resolve é o tamanho. 533 × 232 = 123.656 duplas viram umas
 * duzentas e cinquenta, de todo o edital de uma vez, e o recorte à mão
 * por disciplina deixa de ser necessário.
 * ===================================================================== */
function vzEstadoTexto(chave, dados, erro) {
  const el = $("vzEstado");
  if (!el) return;
  el.hidden = false;
  el.className = "vz-estado" + (erro ? " vz-erro" : "");
  el.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = t(chave, dados || {});
  el.append(b);
}

function vzPintarChave() {
  const selo = $("vzChaveSelo");
  if (!selo) return;
  const c = (typeof vzChaveApi === "function") ? vzChaveApi() : "";
  selo.textContent = c
    ? t("vz_chave_tem", { c: vzChaveResumida(c) })
    : t("vz_chave_falta");
}

function vzAbrirChave() {
  if ($("vzChaveCampo")) $("vzChaveCampo").value = "";
  const agora = $("vzChaveAgora");
  const c = vzChaveApi();
  if (agora) {
    agora.textContent = c ? t("vz_chave_tem", { c: vzChaveResumida(c) })
                          : t("vz_chave_falta");
  }
  abrirModal("dlgVzChave");
}

/* A triagem apaga o resultado anterior ANTES de começar.
 * Deixar as duplas velhas na tela durante uma chamada que pode falhar
 * faria a pessoa copiar o prompt do edital errado sem perceber. */
/* "opc" existe para o teste poder responder no lugar da rede E exercer
 * ESTE caminho — o que o botão chama. A primeira versão do teste
 * chamava vzDuplas direto, uma camada abaixo, e com isso a asserção
 * mais importante do arquivo ("a triagem não vincula") passava mesmo
 * com uma linha de vkAplicar plantada bem aqui. Testar a camada de
 * baixo é testar o que eu escolhi testar, não o que a pessoa aperta. */
async function vzTriar(opc) {
  const de = ($("vkDeEdital") || {}).value || "";
  const para = ($("vkParaEdital") || {}).value || "";
  if (String(de) === String(para)) { await uiAlert(t("vk_mesmo_edital")); return; }
  if (!vzChaveApi()) { vzAbrirChave(); return; }

  vzDuplasAtuais = [];
  vzCortados = 0;
  vkPintarLados();

  const a = vkComoOrigem(vkPendentesDe(de));
  const b = vkPendentesDe(para).map((x) =>
    ({ disciplina: x.disciplina, topico: x.nome }));
  if (!a.length || !b.length) { await uiAlert(t("vk_sem_pendentes")); return; }

  const btn = $("btnVzTriar");
  if (btn) { btn.disabled = true; }
  vzEstadoTexto("vz_indo", { n: a.length + b.length });
  try {
    const r = await vzDuplas(a, b, Object.assign({
      andamento: (feitos, total) =>
        vzEstadoTexto("vz_andamento", { f: feitos, t: total }),
    }, opc || {}));
    vzDuplasAtuais = r.pares;
    vzCortados = r.cortados;
    reg("VINCULO", "triagem semantica",
        r.pares.length + " duplas de " + (a.length * b.length)
        + " possiveis, " + r.cortados + " acima do teto");
    vzEstadoTexto("vz_pronto", {
      n: r.pares.length, p: a.length * b.length,
      f: r.pares.filter((x) => x.faixa === "forte").length,
      c: r.cortados,
    });
  } catch (e) {
    /* O MOTIVO NA TELA. "Falhou" manda tentar de novo nos três casos, e
     * só um deles melhora tentando de novo. */
    const q = String((e && e.message) || "rede");
    const chave = q === "chave_recusada" ? "vz_erro_chave"
      : q === "cota" ? "vz_erro_cota"
        : q === "sem_chave" ? "vz_chave_falta"
          : q === "resposta_incompleta" ? "vz_erro_incompleta" : "vz_erro_rede";
    vzEstadoTexto(chave, { d: (e && e.detalhe) || "" }, true);
    reg("VINCULO", "triagem semantica falhou", q);
  }
  if (btn) btn.disabled = false;
  vkPintarLados();
}

/* A proximidade de uma dupla, para o log. Devolve null quando não houve
 * triagem — e null não é 0: "não medi" e "medi e deu zero" viram a
 * mesma coisa se forem o mesmo valor. */
function vzScoreDe(dA, tA, dB, tB) {
  if (!vzDuplasAtuais.length) return null;
  const k = (d, x) => vkChave(d, x);
  const alvo = k(dA, tA) + "|" + k(dB, tB);
  const inv = k(dB, tB) + "|" + k(dA, tA);
  const achou = vzDuplasAtuais.filter((p) => {
    const s = k(p.de.disciplina, p.de.topico) + "|"
      + k(p.para.disciplina, p.para.topico);
    return s === alvo || s === inv;
  })[0];
  return achou ? achou.score : null;
}

function vkAbrir() {
  const abertoId = (typeof edAberto === "function" && edAberto())
    ? edAberto().id : "";
  const outro = (typeof editais !== "undefined" ? editais : [])
    .filter((e) => String(e.id) !== String(abertoId))[0];
  vkEditaisPara($("vkDeEdital"), outro ? outro.id : abertoId);
  vkEditaisPara($("vkParaEdital"), abertoId);
  vkPintarModo();
  vkPintarDiscs();
  vkPintarLados();
  abrirModal("dlgJaEstudei");
  reg("VINCULO", "comparacao entre editais aberta", vkModo);
}

/* O RESUMO SE REESCREVE A CADA MUDANÇA.
 *
 * Antes era escrito uma vez, ao abrir, e a lista se repintava sozinha —
 * dava "1 têm nome idêntico" ao lado de "nenhum tópico tem nome
 * idêntico", as duas frases na mesma tela. Número que não acompanha o
 * que descreve é pior que número nenhum. */
function vkPintarLados() {
  const de = ($("vkDeEdital") || {}).value || "";
  const para = ($("vkParaEdital") || {}).value || "";
  const res = $("vkResumo");
  const at = $("vkAtalho");
  if (String(de) === String(para)) {
    if (res) res.textContent = t("vk_mesmo_edital");
    if (at) at.hidden = true;
    vkTriagem = [];
    vkPendentesIa = [];
    return;
  }
  /* NO MODO DOS DOIS EDITAIS, A COMPARAÇÃO É POR DISCIPLINA.
   * Sem o recorte seriam 533 × 232 combinações num prompt só; com ele,
   * uma disciplina contra a outra — que é o tamanho em que a IA ainda
   * presta atenção e o log ainda dá para ler. */
  /* triado, o recorte por disciplina não se aplica: as duplas vieram de
   * todo o edital, e filtrar aqui esconderia metade das respostas que a
   * IA vai devolver */
  const triado = vkEhAmbos() && vzDuplasAtuais.length > 0;
  const dDe = triado ? "" : (($("vkDeDisc") || {}).value || "");
  const dPara = triado ? "" : (($("vkParaDisc") || {}).value || "");
  const est = vkEhAmbos()
    ? vkSoDaDisciplina(vkOrigemDe(de), dDe) : vkEstudadosDe(de);
  const pend = vkEhAmbos()
    ? vkSoDaDisciplina(vkPendentesDe(para), dPara) : vkPendentesDe(para);
  vkPendentesIa = pend;
  vkTriagem = vkEhAmbos() ? []
    : vkIdenticos(est, pend).map((c) =>
      Object.assign({}, c, { escolha: "igual" }));

  if (res) {
    /* triado, o resumo fala de DUPLAS; sem triagem, de duas listas.
     * São contagens de coisas diferentes e não podem usar a mesma
     * frase — "250" ao lado de "533 × 232" só confunde. */
    res.textContent = (vkEhAmbos() && vzDuplasAtuais.length)
      ? t("vk_resumo_duplas", { n: vzDuplasAtuais.length,
          de: vkNomeDoEdital(de) || "?", para: vkNomeDoEdital(para) || "?" })
      : vkEhAmbos()
        ? t("vk_resumo_ambos", { e: est.length, p: pend.length,
            da: dDe || "?", db: dPara || "?",
            de: vkNomeDoEdital(de) || "?", para: vkNomeDoEdital(para) || "?" })
        : t("vk_resumo_novo", { e: est.length, p: pend.length,
            de: vkNomeDoEdital(de) || "?", para: vkNomeDoEdital(para) || "?" });
  }
  if (at) {
    at.hidden = !vkTriagem.length;
    const txt = $("vkAtalhoTxt");
    if (txt) txt.textContent = t("vk_identicos_txt", { n: vkTriagem.length });
  }
}

/* O ATALHO: aceitar os nomes idênticos sem passar pela IA. Deixou de ser
 * etapa obrigatória — em 7 assuntos contra 533 tópicos ele achou UM par,
 * e ambíguo o bastante para o próprio texto mandar conferir. */
async function vkAceitarIdenticos() {
  if (!vkTriagem.length) return;
  if (!(await uiConfirm(t("vk_identicos_conf", { n: vkTriagem.length })))) return;
  const para = ($("vkParaEdital") || {}).value || "";
  const res = vkAplicar(vkTriagem.map((c) =>
    Object.assign({}, c, { conf: "ALTA" })), para);
  reg("VINCULO", "identicos aceitos sem IA",
      res.novos + " novos, " + res.repetidos + " ja existiam");
  vkPintarLados();
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  await uiAlert(t("vk_aplicados_n", { n: res.novos, r: res.repetidos }));
}

async function vkGerarPrompt() {
  const de = ($("vkDeEdital") || {}).value || "";
  const para = ($("vkParaEdital") || {}).value || "";
  if (String(de) === String(para)) { await uiAlert(t("vk_mesmo_edital")); return; }
  const amb = vkEhAmbos();
  const triado = amb && vzDuplasAtuais.length > 0;
  const dDe = triado ? "" : (($("vkDeDisc") || {}).value || "");
  const dPara = triado ? "" : (($("vkParaDisc") || {}).value || "");
  const est = amb ? vkSoDaDisciplina(vkOrigemDe(de), dDe) : vkEstudadosDe(de);
  const pend = amb ? vkSoDaDisciplina(vkPendentesDe(para), dPara)
                   : vkPendentesDe(para);
  if (!est.length) {
    await uiAlert(t(amb ? "vk_sem_pendentes" : "vk_sem_diario")); return;
  }
  if (amb && !pend.length) { await uiAlert(t("vk_sem_pendentes")); return; }
  /* a lista que a IA vai ver é a MESMA que a conferência vai usar para
   * reconhecer as respostas — guardá-la aqui evita o caso em que a
   * pessoa troca a disciplina depois de copiar e a colagem descarta
   * tudo dizendo "não achei" */
  vkPendentesIa = pend;
  vkOrigemIa = est;
  /* COM AS DUPLAS, A PERGUNTA MUDA DE NATUREZA.
   * Sem triagem, manda-se duas listas e pede-se à IA que ache os pares
   * — 123.656 combinações implícitas numa resposta só. Com triagem,
   * chegam duzentas duplas prontas e pergunta-se de cada uma "esta
   * serve?": uma linha entra, uma linha sai, e dá para conferir. */
  const txt = triado
    ? vkPromptDuplas(vzDuplasAtuais, vkNomeDoEdital(de), vkNomeDoEdital(para))
    : (amb
      ? vkPromptAmbos(est, pend, vkNomeDoEdital(de), vkNomeDoEdital(para), dDe)
      : vkPrompt(est, pend, vkNomeDoEdital(para), vkNomeDoEdital(de)));
  reg("VINCULO", "prompt gerado (" + vkModo + (triado ? "/triado" : "") + ")",
      triado ? vzDuplasAtuais.length + " duplas"
             : est.length + " × " + pend.length + (amb ? " · " + dDe : ""));
  /* A REAÇÃO DO BOTÃO. Antes era um toast de dois segundos que passava
   * despercebido, e ficava a dúvida de sempre: copiou? copiou o quê?
   * Agora o botão confirma e a caixa diz o tamanho do que foi copiado e
   * qual é o próximo passo. */
  await edColarCopiarTexto(txt,
    t(amb ? "vk_prompt_copiado_ambos" : "vk_prompt_copiado_n", {
      e: est.length, p: pend.length, l: txt.split("\n").length,
      c: txt.length, d: dDe }),
    $("btnVkPrompt"));
}

/* ------------------------------------------------------------------
 * O LOG DA VINCULAÇÃO, ANTES DE EFETIVAR
 *
 * Aplicar cem pares vindos de uma IA sem olhá-los é confiar sem
 * conferir, e o erro aqui não é simétrico: um vínculo errado faz você
 * PULAR um assunto na prova; um vínculo que faltou só custa reler.
 *
 * Então cada par vira uma linha com o que a IA sugeriu, por quê, e uma
 * caixa para tirar o que você não aceita. O que entra é o que você
 * marcou — não o que a IA mandou.
 * ------------------------------------------------------------------ */
let vkPares = [];

function vkConferirColagem() {
  const de = ($("vkDeEdital") || {}).value || "";
  const para = ($("vkParaEdital") || {}).value || "";
  /* AS LISTAS ENVIADAS SOMADAS ÀS DE AGORA.
   *
   * A resposta da IA foi escrita contra as listas do momento em que o
   * prompt foi copiado, e no modo dos dois editais essas listas são de
   * UMA disciplina — trocar o seletor entre copiar e colar (que é o
   * gesto normal de quem trabalha disciplina a disciplina) faria a
   * conferência descartar a resposta inteira dizendo "não achei". Somar
   * reconhece os dois conjuntos e não recusa nada legítimo. */
  const est = vkUnir(vkOrigemIa, vkOrigemDe(de));
  const pend = vkUnir(vkPendentesIa, vkPendentesDe(para));
  const r = vkLerResposta($("vkColarTexto").value, est, pend);
  const av = $("vkColarAviso");
  av.hidden = false;
  av.innerHTML = "";
  const linha = (txt, cls) => {
    const d = document.createElement("div");
    d.className = "ed-mud" + (cls ? " " + cls : "");
    d.textContent = txt; av.append(d);
  };
  /* "forte" quer dizer coisas diferentes em cada modo — pular um estudo
   * já feito, ou um estudo só servir para as duas provas — e por isso a
   * frase do resumo também muda. */
  const forte = r.pares.filter((p) =>
    p.sugestao === "PULAR" || p.sugestao === "SERVE").length;
  linha(t(vkEhAmbos() ? "vk_conf_resumo_ambos" : "vk_conf_resumo",
          { n: r.pares.length, a: forte, m: r.pares.length - forte }));
  if (r.ignoradas.length)
    linha(t("vk_conf_ignoradas", { n: r.ignoradas.length }), "aviso");
  /* QUANTAS A IA RECUSOU — a medida de quanto a triagem exagerou.
   * Sem este número não há como calibrar o corte, e a impressão que
   * fica é a de que a vizinhança semântica acertou tudo. */
  if ((r.recusados || []).length) {
    linha(t("vk_conf_recusadas", { n: r.recusados.length }));
  }
  if (!r.pares.length) linha(t("vk_conf_nada"), "perigo");

  /* MARCADO POR PADRÃO, mas visível. Desmarcar tudo faria a pessoa
   * clicar cem vezes para usar a resposta que pediu; marcar tudo sem
   * mostrar é o que este painel existe para acabar. */
  vkPares = r.pares.map((x) => Object.assign({}, x, { usar: true }));
  vkPintarPares();
  return r;
}

function vkPintarPares() {
  const cx = $("vkParesCx");
  const box = $("vkPares");
  if (!cx || !box) return;
  cx.hidden = !vkPares.length;
  box.innerHTML = "";
  const tit = $("vkParesTit");
  if (tit) {
    tit.textContent = t("vk_pares_tit", { n: vkPares.length,
      m: vkPares.filter((x) => x.usar).length });
  }
  vkPares.forEach((x, k) => {
    const li = document.createElement("div");
    li.className = "vk-par-li";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!x.usar;
    cb.onchange = () => { vkPares[k].usar = cb.checked; vkPintarPares(); };
    li.append(cb);

    const tx = document.createElement("div");
    tx.className = "vk-par-tx";
    const sug = document.createElement("span");
    /* QUATRO PALAVRAS, DOIS PARES. O modo "já estudei" devolve
     * PULAR/REVISAR; o modo "vou estudar os dois" devolve
     * SERVE/RECORTE. Traduzir um no outro perderia justamente a
     * diferença: "pular" é veredito sobre estudo feito, "serve para os
     * dois" é previsão sobre estudo que ainda vai acontecer. */
    const forte = x.sugestao === "PULAR" || x.sugestao === "SERVE";
    const nova = x.sugestao === "SERVE" || x.sugestao === "RECORTE";
    sug.className = "vk-sug " + (forte ? "pular" : "revisar");
    sug.textContent = t(nova ? (forte ? "vk_sug_serve" : "vk_sug_recorte")
                             : (forte ? "vk_sug_pular" : "vk_sug_revisar"));
    tx.append(sug);
    const de = document.createElement("span");
    de.className = "vk-par-de";
    de.textContent = (x.de.disciplina ? x.de.disciplina + " › " : "")
      + x.de.topico;
    tx.append(de);
    const seta = document.createElement("span");
    seta.className = "vk-par-seta";
    seta.textContent = "→";
    tx.append(seta);
    tx.append(document.createTextNode(x.para.topico));
    if (x.por) {
      const por = document.createElement("span");
      por.className = "vk-par-por";
      por.textContent = x.por;
      tx.append(por);
    }
    /* A PROXIMIDADE, quando houve triagem — e só então.
     *
     * Ela fica cinza e discreta de propósito: é o motivo de a dupla ter
     * sido PERGUNTADA, não a resposta. Um par de 94% que a IA marcou
     * como recorte diferente continua sendo recorte diferente, e dar ao
     * número o destaque do veredito faria a pessoa confiar na medida
     * errada. */
    const sc = vzScoreDe(x.de.disciplina, x.de.topico,
                         x.para.disciplina, x.para.topico);
    if (sc !== null) {
      const s2 = document.createElement("span");
      s2.className = "vk-par-score";
      s2.textContent = Math.round(sc * 100) + "%";
      s2.title = t("vz_score_aj");
      tx.append(s2);
    }
    li.append(tx);
    box.append(li);
  });
}

function vkMarcarTodos(v) {
  vkPares.forEach((x) => { x.usar = v; });
  vkPintarPares();
}

async function vkCopiarLog() {
  if (!vkPares.length) return;
  const L = vkPares.map((x) =>
    (x.usar ? "[x] " : "[ ] ") + (x.sugestao || "?") + "  "
    + (x.de.disciplina ? x.de.disciplina + " > " : "") + x.de.topico
    + "  ->  " + x.para.disciplina + " > " + x.para.topico
    + (x.por ? "   (" + x.por + ")" : ""));
  try { await navigator.clipboard.writeText(L.join("\n")); }
  catch (e) { await uiAlert(t("toast_copy_fail")); return; }
  await uiAlert(t("diag_copiado"));
}

async function vkAplicarColagem() {
  if (!vkPares.length) { vkConferirColagem(); }
  const usar = vkPares.filter((x) => x.usar);
  if (!usar.length) { await uiAlert(t("vk_nada_marcado")); return; }
  /* SEGUNDA CONFIRMAÇÃO, dizendo o que o vínculo faz E o que ele não
   * faz: a confusão entre "vinculado" e "estudado" é a única que pode
   * custar um assunto na prova. */
  if (!(await uiConfirm(t(vkEhAmbos() ? "vk_par_conf_ambos" : "vk_par_conf",
                          { n: usar.length })))) return;
  const para = ($("vkParaEdital") || {}).value || "";
  const res = vkAplicar(usar, para, vkModo);
  reg("VINCULO", "aplicados da IA (" + vkModo + ")",
      res.novos + " novos, " + res.repetidos + " já existiam");
  $("dlgVkColar").close();
  $("dlgJaEstudei").close();
  edRender();
  if (typeof hubPintarAgenda === "function") hubPintarAgenda();
  await uiAlert(t("vk_aplicados_n", { n: res.novos, r: res.repetidos }));
}

/* =====================================================================
 * A REVISÃO DOS VÍNCULOS
 *
 * Esconder o vínculo mudo resolve a tela de hoje. Não resolve o amanhã:
 * no dia em que você escrever um resumo naquele tópico, ele deixa de
 * ser mudo e volta — apontando o material certo para o assunto errado,
 * com a autoridade de quem tem conteúdo. Por isso existe um lugar para
 * apagar, e por isso apagar continua sendo gesto seu.
 * ===================================================================== */
let vkRevDados = null;
let vkRevSoMudos = false;
let vkRevMarcados = {};

function vkRevFontes() {
  /* as mesmas fontes do acervo, montadas uma vez */
  const chaveReal = {}, nomeReal = {}, estudo = {}, editalDoTopico = {};
  (edDiario || []).forEach((x) => {
    if (!x || !x.n) return;
    const norm = vkChave(x.disc, x.n);
    if (!chaveReal[norm]) chaveReal[norm] = matChave(x.disc, x.n);
    if (!nomeReal[norm]) nomeReal[norm] = (x.disc || "") + "›" + x.n;
    const antes = estudo[norm];
    if (x.a !== "pendente" && (!antes || String(x.d || "") > String(antes.data || ""))) {
      estudo[norm] = { data: x.d || "", concurso: x.cc || "", acao: x.a || "" };
    }
  });
  (typeof editais !== "undefined" ? editais : []).forEach((e) => {
    const nome = vkNomeDoEdital(e.id) || e.nome || "";
    const r = lerEdital(e.texto || "");
    (r.disciplinas || []).forEach((d) => {
      (d.topicos || []).forEach((tp) => {
        const k = vkChave(d.nome, tp.nome);
        if (!editalDoTopico[k]) editalDoTopico[k] = nome;
        if (!chaveReal[k]) chaveReal[k] = matChave(d.nome, tp.nome);
        nomeReal[k] = d.nome + "›" + tp.nome;
      });
    });
  });
  const resumos = (typeof matResumos !== "undefined" && matResumos) || {};
  const leis = {}, questoes = {};
  Object.keys(chaveReal).forEach((norm) => {
    const real = chaveReal[norm];
    try { leis[real] = (typeof leisDoTopico === "function") ? leisDoTopico(real) : []; }
    catch (e) { leis[real] = []; }
    try {
      questoes[real] = (typeof qsContarDoTopico === "function")
        ? qsContarDoTopico(real) : 0;
    } catch (e) { questoes[real] = 0; }
  });
  return { chaveReal, nomeReal, estudo, resumos, leis, questoes, editalDoTopico };
}

function vkRevAbrir() {
  vkRevDados = vkRevisao(vkRevFontes());
  vkRevMarcados = {};
  vkRevSoMudos = false;
  vkRevPintar();
  abrirModal("dlgVkRevisar");
  reg("VINCULO", "revisao de vinculos aberta",
      vkRevDados.total + " vinculos, " + vkRevDados.mudos + " sem nada a dizer");
}

function vkRevChaveDe(x) { return x.a + "|" + x.b; }

function vkRevPintar() {
  const box = $("vkRevLista");
  const res = $("vkRevResumo");
  if (!box || !vkRevDados) return;
  if (res) {
    res.textContent = t("vk_rev_resumo", {
      n: vkRevDados.total, m: vkRevDados.mudos,
      g: vkRevDados.grupos.length });
  }
  box.innerHTML = "";
  let mostrados = 0;
  vkRevDados.grupos.forEach((g) => {
    const itens = vkRevSoMudos ? g.itens.filter((x) => x.mudo) : g.itens;
    if (!itens.length) return;
    const cx = document.createElement("div");
    cx.className = "vk-rev-grupo";
    const par = document.createElement("div");
    par.className = "vk-rev-par";
    par.textContent = g.par;
    cx.append(par);
    const conta = document.createElement("div");
    conta.className = "vk-rev-conta";
    conta.textContent = t("vk_rev_grupo_conta",
      { n: g.itens.length, m: g.mudos });
    cx.append(conta);

    itens.forEach((x) => {
      mostrados++;
      const li = document.createElement("div");
      li.className = "vk-rev-li" + (x.mudo ? " vk-rev-mudo" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const k = vkRevChaveDe(x);
      cb.checked = !!vkRevMarcados[k];
      cb.onchange = () => {
        if (cb.checked) vkRevMarcados[k] = x; else delete vkRevMarcados[k];
        vkRevBotao();
      };
      li.append(cb);
      const tx = document.createElement("div");
      tx.textContent = x.nomeA.replace("›", " › ") + "   ↔   "
        + x.nomeB.replace("›", " › ") + (x.por ? "  ·  " + x.por : "");
      li.append(tx);
      if (x.mudo) {
        const s = document.createElement("span");
        s.className = "vk-rev-selo";
        s.textContent = t("vk_rev_selo_mudo");
        li.append(s);
      }
      cx.append(li);
    });
    box.append(cx);
  });
  if (!mostrados) {
    const p = document.createElement("div");
    p.className = "hub-mapa-vazio";
    p.textContent = t(vkRevSoMudos ? "vk_rev_sem_mudos" : "vk_rev_vazio");
    box.append(p);
  }
  vkRevBotao();
}

function vkRevBotao() {
  const b = $("btnVkRevApagar");
  if (!b) return;
  const n = Object.keys(vkRevMarcados).length;
  b.textContent = t("vk_rev_apagar", { n });
  b.disabled = n === 0;
}

async function vkRevApagar() {
  const marcados = Object.keys(vkRevMarcados).map((k) => vkRevMarcados[k]);
  if (!marcados.length) return;
  /* SEGUNDA CONFIRMAÇÃO, com o que se perde e o que não se perde.
   * Apagar vínculo não toca em material, diário nem progresso — e dizer
   * isso é o que permite apagar sem medo. */
  if (!(await uiConfirm(t("vk_rev_conf", { n: marcados.length })))) return;
  const n = vkApagarPares(marcados);
  reg("VINCULO", "vinculos apagados na revisao", n + " de " + marcados.length);
  vkRevMarcados = {};
  vkRevDados = vkRevisao(vkRevFontes());
  vkRevPintar();
  edRender();
  if (typeof hubRender === "function") hubRender();
  await uiAlert(t("vk_rev_apagados", { n }));
}

function vkRevMarcarMudos() {
  if (!vkRevDados) return;
  vkRevDados.grupos.forEach((g) => {
    g.itens.filter((x) => x.mudo).forEach((x) => {
      vkRevMarcados[vkRevChaveDe(x)] = x;
    });
  });
  vkRevSoMudos = true;
  vkRevPintar();
}

async function vkRevCopiar() {
  if (!vkRevDados) return;
  const L = [];
  vkRevDados.grupos.forEach((g) => {
    L.push("== " + g.par + "  (" + g.itens.length + ")");
    g.itens.forEach((x) => {
      L.push((x.mudo ? "[mudo] " : "       ")
        + x.nomeA + "  ->  " + x.nomeB + (x.por ? "   (" + x.por + ")" : ""));
    });
    L.push("");
  });
  await edColarCopiarTexto(L.join("\n"), t("diag_copiado"), $("btnVkRevCopiar"));
}

/* =====================================================================
 * O MAPA DOS EDITAIS LIGADOS
 *
 * A informação é uma rede: qual concurso encosta em qual, e por quantos
 * assuntos. Em lista isso só se descobre abrindo tópico por tópico; em
 * desenho, é uma olhada.
 *
 * SVG à mão, sem biblioteca. Com três ou quatro editais o desenho é uma
 * linha entre dois nomes com um número em cima — trazer um motor de
 * grafos para isso seria carregar um guindaste para levantar uma
 * cadeira.
 * ===================================================================== */
function vkMapaDados() {
  const fontes = vkRevFontes();
  const nomeDe = (chave) => fontes.editalDoTopico[chave] || "";
  const pares = {};
  const nos = {};
  (vkCarregar() || []).forEach((v) => {
    const na = nomeDe(v.a), nb = nomeDe(v.b);
    if (!na || !nb || na === nb) return;
    const k = [na, nb].sort().join(" ");
    pares[k] = (pares[k] || 0) + 1;
    nos[na] = (nos[na] || 0) + 1;
    nos[nb] = (nos[nb] || 0) + 1;
  });
  return {
    nos: Object.keys(nos),
    arestas: Object.keys(pares).map((k) => {
      const p = k.split(" ");
      return { a: p[0], b: p[1], n: pares[k] };
    }).sort((x, y) => y.n - x.n),
  };
}

function vkMapaPintar() {
  const box = $("hubMapa");
  if (!box) return;
  const d = vkMapaDados();
  box.innerHTML = "";
  if (!d.arestas.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const LARG = 520, LINHA = 46;
  const alt = d.arestas.length * LINHA + 16;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 " + LARG + " " + alt);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(alt));
  const cria = (tag, attrs, texto) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    if (texto != null) el.textContent = texto;
    svg.append(el);
    return el;
  };
  d.arestas.forEach((e, i) => {
    const y = 22 + i * LINHA;
    /* a linha, com a espessura acompanhando o número de assuntos: dois
     * editais que se tocam em oitenta pontos não podem parecer iguais a
     * dois que se tocam em três */
    const esp = Math.max(1.5, Math.min(7, 1.5 + e.n / 8));
    cria("line", { x1: 12, y1: y, x2: LARG - 12, y2: y,
      stroke: "var(--acao)", "stroke-width": esp, "stroke-linecap": "round",
      opacity: "0.5" });
    cria("text", { x: 12, y: y - 9, fill: "var(--texto)",
      "font-size": "11.5", "font-weight": "700" }, e.a);
    cria("text", { x: LARG - 12, y: y - 9, fill: "var(--texto)",
      "font-size": "11.5", "font-weight": "700", "text-anchor": "end" }, e.b);
    /* o número no meio, sobre um fundo, para não sumir na linha */
    cria("rect", { x: LARG / 2 - 46, y: y - 10, width: 92, height: 20,
      rx: 10, fill: "var(--panel)", stroke: "var(--borda)" });
    cria("text", { x: LARG / 2, y: y + 4, fill: "var(--sutil)",
      "font-size": "10.5", "font-weight": "800", "text-anchor": "middle" },
      t("vk_mapa_n", { n: e.n }));
  });
  box.append(svg);
}

function vkIniciarTela() {
  vkCarregar();
  if ($("btnHubVincular")) $("btnHubVincular").onclick = vkAbrir;
  if ($("btnHubRevisar")) $("btnHubRevisar").onclick = vkRevAbrir;
  if ($("btnVkRevFechar")) {
    $("btnVkRevFechar").onclick = () => $("dlgVkRevisar").close();
  }
  if ($("btnVkRevFecharTopo")) {
    $("btnVkRevFecharTopo").onclick = () => $("dlgVkRevisar").close();
  }
  if ($("btnVkRevApagar")) $("btnVkRevApagar").onclick = vkRevApagar;
  if ($("btnVkRevMudos")) $("btnVkRevMudos").onclick = vkRevMarcarMudos;
  if ($("btnVkRevTodos")) $("btnVkRevTodos").onclick = () => {
    vkRevSoMudos = false; vkRevPintar();
  };
  if ($("btnVkRevCopiar")) $("btnVkRevCopiar").onclick = vkRevCopiar;
  if ($("btnVkaFecharTopo")) {
    $("btnVkaFecharTopo").onclick = () => $("dlgVkAcervo").close();
  }
  if ($("btnVkaFechar")) $("btnVkaFechar").onclick = () => $("dlgVkAcervo").close();
  if ($("btnVkIdenticos")) $("btnVkIdenticos").onclick = vkAceitarIdenticos;
  if ($("btnVkModoEstudei")) {
    $("btnVkModoEstudei").onclick = () => vkTrocarModo("estudei");
  }
  if ($("btnVkModoAmbos")) {
    $("btnVkModoAmbos").onclick = () => vkTrocarModo("ambos");
  }
  if ($("btnVzTriar")) $("btnVzTriar").onclick = vzTriar;
  if ($("btnVzChave")) $("btnVzChave").onclick = vzAbrirChave;
  if ($("btnVzChaveFechar")) {
    $("btnVzChaveFechar").onclick = () => $("dlgVzChave").close();
  }
  if ($("btnVzChaveOk")) $("btnVzChaveOk").onclick = () => {
    const v = vzGuardarChave(($("vzChaveCampo") || {}).value || "");
    /* o REGISTRO nunca vê a chave. Ele é copiado e colado em relatos de
     * problema, e uma chave de API dentro dele vira cobrança de outra
     * pessoa. */
    reg("VINCULO", "chave da IA guardada", v ? "sim" : "campo vazio");
    $("dlgVzChave").close();
    vzPintarChave();
  };
  if ($("btnVzChaveApagar")) $("btnVzChaveApagar").onclick = async () => {
    if (!(await uiConfirm(t("vz_chave_apagar_conf")))) return;
    vzGuardarChave("");
    reg("VINCULO", "chave da IA apagada");
    $("dlgVzChave").close();
    vzPintarChave();
  };
  ["vkDeEdital", "vkParaEdital"].forEach((id) => {
    /* trocar de edital refaz as listas de disciplina: mantê-las seria
     * oferecer matérias que não existem no edital agora escolhido */
    if ($(id)) $(id).onchange = () => {
      vzEsquecer(); vkPintarModo(); vkPintarDiscs(); vkPintarLados();
    };
  });
  /* trocar a disciplina da ESQUERDA re-sugere a da direita; trocar a da
   * direita é a palavra final de quem estuda e não mexe em mais nada */
  if ($("vkDeDisc")) {
    $("vkDeDisc").onchange = () => { vkPintarDiscs(); vkPintarLados(); };
  }
  if ($("vkParaDisc")) $("vkParaDisc").onchange = vkPintarLados;
  if ($("btnVkPrompt")) $("btnVkPrompt").onclick = vkGerarPrompt;
  if ($("btnVkTodos")) $("btnVkTodos").onclick = () => vkMarcarTodos(true);
  if ($("btnVkNenhum")) $("btnVkNenhum").onclick = () => vkMarcarTodos(false);
  if ($("btnVkCopiarLog")) $("btnVkCopiarLog").onclick = vkCopiarLog;
  if ($("btnVkColar")) $("btnVkColar").onclick = () => {
    $("vkColarTexto").value = "";
    $("vkColarAviso").hidden = true;
    vkPares = [];
    vkPintarPares();
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
