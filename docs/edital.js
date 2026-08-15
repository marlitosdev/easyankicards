/* =====================================================================
 * EDITAL — leitura, pesos e prioridade
 *
 * Mesma arquitetura do parser.js: SÓ lógica, nada de DOM, para poder ser
 * testado em Node linha a linha. A tela vive em edital-ui.js.
 *
 * O formato reaproveita o que o usuário já sabe da bancada de cartões —
 * "::" separa campos e "@" abre um bloco — em vez de inventar sintaxe:
 *
 *   # TCE-PE | prova: 2026-08-30 | horas: 12
 *   @ Auditoria Governamental :: 5
 *   + Achado de auditoria :: 5 :: cai em quase toda prova da FGV
 *   + Papéis de trabalho :: 3
 *
 * Quem manda o peso da disciplina é o edital (pontuação da prova). O peso
 * do tópico é o que a IA sugere e o usuário corrige — é palpite, e palpite
 * tem de ser fácil de mexer.
 * ===================================================================== */

const ED_CFG_RE = /^#\s*(.*)$/;
const ED_DISC_RE = /^@\s*(.+)$/;
const ED_TOP_RE = /^[+\-*·•]\s*(.+)$/;   /* aceita o que a pessoa digita */

function edPartes(linha) {
  return linha.split("::").map((s) => s.trim());
}

/* Peso ausente vale 3 (meio da escala). Peso fora de 1..5 é registrado como
 * problema, mas o valor é preso na faixa em vez de descartado — perder o
 * tópico seria pior do que aceitar um peso torto. */
function edPeso(txt, achados, linha) {
  if (txt === undefined || txt === "") return { peso: 3, herdado: true };
  const n = Number(String(txt).replace(",", "."));
  if (!isFinite(n)) {
    achados.push({ linha, tipo: "peso_invalido", txt: String(txt) });
    return { peso: 3, herdado: true };
  }
  if (n < 1 || n > 5) {
    achados.push({ linha, tipo: "peso_fora", txt: String(n) });
    return { peso: Math.min(5, Math.max(1, n)), herdado: false };
  }
  return { peso: n, herdado: false };
}

function lerEdital(raw) {
  const linhas = String(raw || "").split(/\r?\n/);
  const cfg = { concurso: "", prova: "", horas: 10 };
  const disciplinas = [];
  const achados = [];
  let atual = null;

  linhas.forEach((l, i) => {
    const n = i + 1;
    const s = l.trim();
    if (!s) return;

    const mc = s.match(ED_CFG_RE);
    if (mc) {
      mc[1].split("|").forEach((p) => {
        const [k, v] = p.split(":").map((x) => (x || "").trim());
        if (!v) { if (k) cfg.concurso = k; return; }
        if (/^prova/i.test(k)) cfg.prova = v;
        else if (/^horas/i.test(k)) cfg.horas = Number(v.replace(",", ".")) || 10;
        else if (/^concurso|^nome/i.test(k)) cfg.concurso = v;
      });
      return;
    }

    const md = s.match(ED_DISC_RE);
    if (md) {
      const p = edPartes(md[1]);
      const { peso } = edPeso(p[1], achados, n);
      atual = { nome: p[0], peso, linha: n, topicos: [] };
      if (!p[0]) achados.push({ linha: n, tipo: "disciplina_sem_nome", txt: s });
      if (disciplinas.some((d) => d.nome.toLowerCase() === p[0].toLowerCase()))
        achados.push({ linha: n, tipo: "disciplina_repetida", txt: p[0] });
      disciplinas.push(atual);
      return;
    }

    const mt = s.match(ED_TOP_RE);
    if (mt) {
      const p = edPartes(mt[1]);
      if (!atual) { achados.push({ linha: n, tipo: "topico_sem_disciplina", txt: p[0] }); return; }
      const { peso, herdado } = edPeso(p[1], achados, n);
      atual.topicos.push({
        nome: p[0], peso, herdado, motivo: p[2] || "", linha: n,
      });
      if (!p[0]) achados.push({ linha: n, tipo: "topico_sem_nome", txt: s });
      return;
    }

    /* Linha que não é nada disso: o edital colado cru costuma trazer
     * cabeçalho, rodapé e numeração solta. Vira aviso, não some calado. */
    achados.push({ linha: n, tipo: "linha_ignorada", txt: s.slice(0, 80) });
  });

  return { cfg, disciplinas, achados, linhas: linhas.length };
}

/* ------------------------------------------------------------------
 * PRIORIDADE E HORAS
 *
 * Quem calcula é o app, não a IA. A IA sugere PESO — que é juízo sobre o
 * assunto — e o cálculo é aritmética, que máquina faz igual toda vez e
 * teste consegue conferir. Misturar os dois foi o erro que deixou os
 * cartões cheios de "gabarito da questão 17".
 * ------------------------------------------------------------------ */
function priorizar(r) {
  const itens = [];
  r.disciplinas.forEach((d) => {
    d.topicos.forEach((t) => {
      itens.push({
        disciplina: d.nome, disciplinaPeso: d.peso,
        nome: t.nome, peso: t.peso, motivo: t.motivo, linha: t.linha,
        bruto: d.peso * t.peso,
      });
    });
  });
  const max = itens.reduce((m, i) => Math.max(m, i.bruto), 0) || 1;
  itens.forEach((i) => { i.prioridade = Math.round((i.bruto / max) * 100); });
  itens.sort((a, b) => b.bruto - a.bruto || a.linha - b.linha);
  return itens;
}

/* ------------------------------------------------------------------
 * O PLANO: uma fila ao longo das semanas
 *
 * O modelo anterior dividia o orçamento SEMANAL entre todos os tópicos.
 * Com o edital real do TCE-PE — 231 tópicos, 12h por semana — isso deu 20
 * minutos para cada um, ou seja 77 horas por semana: seis vezes o tempo que
 * existe. O número era aritmeticamente correto e completamente inútil.
 *
 * Ninguém estuda 231 tópicos por semana. Estuda-se uma FATIA por semana, na
 * ordem da prioridade, até a prova. E quando não cabe, o app diz que não
 * cabe — em vez de fingir espalhando minutos que ninguém consegue cumprir.
 * ------------------------------------------------------------------ */

/* Tempo por FAIXA, não proporcional. Proporção entre 231 itens produz "8
 * minutos de Direito Civil", que não é uma sessão de estudo. */
const ED_FAIXAS = [
  { id: "alta", min: 80, minutos: 60 },
  { id: "media", min: 50, minutos: 45 },
  { id: "baixa", min: 0, minutos: 30 },
];
function faixaDe(prioridade) {
  return ED_FAIXAS.find((f) => prioridade >= f.min) || ED_FAIXAS[ED_FAIXAS.length - 1];
}

/* opcoes: { horas, prova, hoje, feitos } — "feitos" é um objeto/Set com as
 * chaves já concluídas, que saem da fila. */
function montarPlano(r, opcoes) {
  const o = opcoes || {};
  const horas = Math.max(0, Number(o.horas) || 0);
  const porSemana = horas * 60;
  const s = semanasAte(o.prova, o.hoje);
  const semanas = s ? Math.max(0, s.semanas) : null;
  /* Aceita o formato antigo (true = estudado) para não perder o progresso de
   * quem já estava usando: migração silenciosa, feita na leitura. */
  const marcaDe = (k) => {
    const v = o.feitos && o.feitos[k];
    if (v === true) return { e: "feito", d: null };            /* formato v8.44 */
    if (v === "feito" || v === "revisado") return { e: v, d: null };  /* v8.55 */
    if (v && typeof v === "object" && v.e) return v;           /* com data */
    return null;
  };

  const todos = priorizar(r);
  todos.forEach((i) => {
    const f = faixaDe(i.prioridade);
    i.faixa = f.id;
    i.minutos = f.minutos;
    i.chave = (i.disciplina + "›" + i.nome).toLowerCase();
    /* dois estados, não um: estudar e revisar são coisas diferentes, e a
     * segunda é a que fixa. "revisado" implica "estudado". */
    const m = marcaDe(i.chave);
    i.estado = m && m.e;
    i.quando = m && m.d;
    i.dias = m && m.d ? Math.floor((Date.now() - new Date(m.d + "T00:00:00")) / 86400000) : null;
    i.feito = i.estado === "feito" || i.estado === "revisado";
    i.revisado = i.estado === "revisado";
  });

  /* Fatia de cada disciplina na prova: entra no motivo porque é o argumento
   * mais forte a favor de estudar aquilo agora. */
  const fatia = {};
  const totalBruto = todos.reduce((a, i) => a + i.bruto, 0) || 1;
  todos.forEach((i) => { fatia[i.disciplina] = (fatia[i.disciplina] || 0) + i.bruto; });
  Object.keys(fatia).forEach((k) => {
    fatia[k] = Math.round((fatia[k] / totalBruto) * 100);
  });

  /* A fila tem duas fontes: o que nunca foi estudado e o que já passou do
   * prazo de revisão. Revisão vencida entra ANTES de assunto novo de peso
   * igual — reaprender custa mais caro do que manter. */
  const pendentes = todos.filter((i) => !i.feito);
  const revVencidas = todos.filter((i) => i.feito && !i.revisado
    && (i.dias === null || i.dias >= REV_DIAS));
  revVencidas.forEach((i) => { i.ehRevisao = true; i.minutos = Math.round(i.minutos / 2); });
  /* ---- INTERCALAR DISCIPLINAS ----
   * Ordenar só por peso agrupa a semana por disciplina: sete horas seguidas
   * de Direito Administrativo, depois oito de Financeiro. Ninguém estuda
   * assim, e quem tenta esquece o primeiro bloco antes de chegar ao fim.
   *
   * O rodízio pega, a cada rodada, o tópico mais pesado de cada disciplina
   * que ainda tem fila — a ordem por peso continua valendo DENTRO de cada
   * disciplina e entre as rodadas, mas a semana sai misturada. */
  const bruta = revVencidas.concat(pendentes)
    .sort((a, b) => (b.bruto - a.bruto) || (a.ehRevisao ? -1 : 1));
  const porDisc = new Map();
  bruta.forEach((i) => {
    if (!porDisc.has(i.disciplina)) porDisc.set(i.disciplina, []);
    porDisc.get(i.disciplina).push(i);
  });
  /* disciplinas entram no rodízio na ordem da sua fatia da prova */
  const ordemDisc = [...porDisc.keys()].sort((a, b) => (fatia[b] || 0) - (fatia[a] || 0));
  const fila = [];
  let restam = true;
  while (restam) {
    restam = false;
    ordemDisc.forEach((d) => {
      const lista = porDisc.get(d);
      if (lista && lista.length) { fila.push(lista.shift()); restam = true; }
    });
  }
  todos.forEach((i) => { i.porque = motivarItem(i, fatia[i.disciplina]); });
  const dentro = [], fora = [];
  let semana = 1, usoSemana = 0, usado = 0;

  fila.forEach((i) => {
    if (!porSemana || semanas === null) {          /* sem data ou sem horas:
      não dá para montar cronograma, mas a ordem continua valendo */
      i.semana = null; dentro.push(i); usado += i.minutos; return;
    }
    if (usoSemana + i.minutos > porSemana) { semana++; usoSemana = 0; }
    if (semanas > 0 && semana > semanas) { i.semana = null; fora.push(i); return; }
    i.semana = semana; usoSemana += i.minutos; usado += i.minutos;
    dentro.push(i);
  });

  return {
    itens: todos,          /* tudo, na ordem, com faixa e minutos */
    fila: dentro,          /* o que cabe até a prova */
    fora,                  /* o que não cabe — nomeado, nunca escondido */
    semanas, porSemana, usado,
    orcamento: semanas === null ? null : semanas * porSemana,
    fatia,
    feitos: todos.filter((i) => i.feito).length,
    revisados: todos.filter((i) => i.revisado).length,
    total: todos.length,
    /* ---- a medida que faltava ----
     * Contar tópicos trata Direito Constitucional e Noções de Direito Penal
     * como iguais. O que decide a prova é PESO: quanto da importância do
     * edital já foi coberta. 18% dos tópicos pode ser 30% da prova, ou 8% —
     * e quem só olha a contagem não tem como saber em qual dos dois está. */
    peso: somarPeso(todos),
    /* quantas horas por semana cobririam TUDO: é a resposta à pergunta
     * "então quanto eu precisaria estudar?" */
    horasNecessarias: semanas ? Math.ceil(
      (fila.reduce((a, i) => a + i.minutos, 0) / semanas) / 60) : null,
  };
}

/* Soma dos pesos brutos (peso da disciplina × peso do tópico) em cada
 * estado. É a régua honesta do progresso: cobrir metade dos tópicos de peso
 * máximo vale mais do que cobrir todos os de peso mínimo. */
function somarPeso(itens) {
  const soma = (f) => itens.filter(f).reduce((a, i) => a + i.bruto, 0);
  const total = soma(() => true) || 1;
  const feito = soma((i) => i.feito);
  const revisado = soma((i) => i.revisado);
  return {
    total, feito, revisado,
    pctFeito: Math.round((feito / total) * 100),
    pctRevisado: Math.round((revisado / total) * 100),
  };
}

/* ------------------------------------------------------------------
 * POR QUE ESTE TÓPICO ESTÁ SENDO RECOMENDADO
 *
 * "Esta semana" mostrava oito linhas sem dizer por que aquelas. Recomendação
 * sem justificativa é ordem, e ordem que a pessoa não entende ela ignora —
 * ou pior, segue sem perceber que está errada. Cada item passa a carregar o
 * motivo, na mesma lógica que decidiu a fila.
 * ------------------------------------------------------------------ */
const REV_DIAS = 7;    /* a partir daqui a revisão é considerada vencida */

function motivarItem(i, fatiaDisc) {
  if (i.feito && !i.revisado)
    return { tipo: i.dias === null ? "rev_pendente" : "rev_vencida",
             dias: i.dias, fatia: fatiaDisc };
  if (i.revisado) return { tipo: "concluido", fatia: fatiaDisc };
  return { tipo: i.faixa === "alta" ? "peso_alto"
    : (i.faixa === "media" ? "peso_medio" : "peso_baixo"),
    peso: i.peso, fatia: fatiaDisc };
}

function semanaAtual(plano) {
  return (plano.fila || []).filter((i) => i.semana === 1);
}

function horasTexto(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + "min";
}

/* Semanas inteiras entre hoje e a prova. Conta para baixo: 6 dias que
 * sobram não viram "1 semana" no planejamento, viram folga. */
function semanasAte(prova, hoje) {
  if (!prova) return null;
  const fim = new Date(prova + "T00:00:00");
  if (isNaN(fim)) return null;
  const ini = hoje ? new Date(hoje) : new Date();
  const dias = Math.floor((fim - ini) / 86400000);
  return { dias, semanas: Math.max(0, Math.floor(dias / 7)) };
}

/* ------------------------------------------------------------------
 * CORREÇÃO AUTOMÁTICA
 * Mesma regra da bancada de cartões: só o que é mecânico. Decidir o peso
 * de um tópico é juízo e fica com a IA ou com o usuário.
 * ------------------------------------------------------------------ */

/* "1.1 Princípios fundamentais" -> "Princípios fundamentais". A numeração
 * do edital serve ao edital; na lista ela só rouba espaço da tela e faz
 * dois tópicos iguais parecerem diferentes. */
const ED_NUM_RE = /^(\d+(?:\.\d+)*)[).\-–—]?\s+(?=\S)/;
function temNumeracaoEdital(raw) {
  return String(raw || "").split(/\r?\n/).some((l) => {
    const m = l.trim().match(ED_TOP_RE) || l.trim().match(ED_DISC_RE);
    return !!m && ED_NUM_RE.test(m[1]);
  });
}
function tirarNumeracaoEdital(raw) {
  return String(raw || "").split(/\r?\n/).map((l) => {
    const s = l.trim();
    const mt = s.match(ED_TOP_RE), md = s.match(ED_DISC_RE);
    if (mt) return "+ " + mt[1].replace(ED_NUM_RE, "");
    if (md) return "@ " + md[1].replace(ED_NUM_RE, "");
    return l;
  }).join("\n");
}

/* Marcador solto ("-", "*", "•") vira "+", que é a forma canônica. */
function temMarcadorTorto(raw) {
  return String(raw || "").split(/\r?\n/).some((l) => /^\s*[\-*·•]\s+\S/.test(l));
}
function normalizarMarcadores(raw) {
  return String(raw || "").split(/\r?\n/)
    .map((l) => l.replace(/^(\s*)[\-*·•](\s+)/, "$1+$2")).join("\n");
}

function temPesoFaltando(raw) {
  const r = lerEdital(raw);
  return r.disciplinas.some((d) => d.topicos.some((t) => t.herdado));
}

/* A IA usou o peso padrão em TODAS as disciplinas: foi o que aconteceu no
 * edital real (17 disciplinas, todas com 3). Como a prioridade é peso da
 * disciplina × peso do tópico, a disciplina sai da conta e a "priorização"
 * vira um empate geral. Formalmente válido, praticamente inútil — o mesmo
 * tipo de defeito do cartão preso à prova de origem. */
function temPesosIguais(raw) {
  const r = typeof raw === "string" ? lerEdital(raw) : raw;
  if (!r.disciplinas || r.disciplinas.length < 3) return false;
  const p = r.disciplinas[0].peso;
  return r.disciplinas.every((d) => d.peso === p);
}

function edDetectores(raw) {
  const acesos = [];
  if (temNumeracaoEdital(raw)) acesos.push("numeracao");
  if (temMarcadorTorto(raw)) acesos.push("marcador");
  if (temPesoFaltando(raw)) acesos.push("peso_faltando");
  if (temPesosIguais(raw)) acesos.push("pesos_iguais");
  return acesos;
}

const ED_CORRECOES = [
  [temMarcadorTorto, normalizarMarcadores],
  [temNumeracaoEdital, tirarNumeracaoEdital],
];

function edCorrecaoDeTudo(raw) {
  const aplicadas = [];
  let txt = raw;
  for (let volta = 0; volta < 3; volta++) {
    let mexeu = false;
    ED_CORRECOES.forEach(([detecta, corrige]) => {
      if (!detecta(txt)) return;
      const novo = corrige(txt);
      if (novo === txt) return;
      txt = novo; mexeu = true;
      if (!aplicadas.includes(corrige)) aplicadas.push(corrige);
    });
    if (!mexeu) break;
  }
  if (!aplicadas.length) return null;
  const tudo = (t0) => aplicadas.reduce((acc, f) => f(acc), t0);
  Object.defineProperty(tudo, "name",
    { value: aplicadas.map((f) => f.name).join(" + ") });
  return tudo;
}

/* ------------------------------------------------------------------
 * DIAGNÓSTICO DO PLANEJAMENTO
 *
 * Diferente do diagnóstico técnico: aqui não se procura defeito de FORMATO,
 * e sim impropriedade de PLANEJAMENTO. Um edital pode estar impecavelmente
 * escrito e ainda assim descrever um plano que não decide nada — foi o que
 * aconteceu com as 17 disciplinas empatadas em peso 3.
 *
 * O app aponta; quem corrige é a IA ou o usuário. Julgar que Auditoria vale
 * mais que Direito Civil exige conhecer o concurso, e isso o app não sabe.
 * ------------------------------------------------------------------ */
function diagnosticoPlano(r, plano) {
  const achados = [];
  const add = (id, grave, msg, dado) => achados.push({ id, grave, msg, dado });
  const discs = r.disciplinas || [];
  const itens = (plano && plano.itens) || [];
  const pesoTotal = (plano && plano.peso && plano.peso.total) || 1;

  if (!discs.length) return achados;

  if (temPesosIguais(r))
    add("pesos_iguais", true,
      "Todas as " + discs.length + " disciplinas estão com peso " + discs[0].peso
      + ". Como a prioridade é peso da disciplina × peso do tópico, a disciplina "
      + "sai da conta e a ordenação vira quase um empate.");

  /* fatia de cada disciplina na prova — é o número que o usuário não vê no
   * texto e que muda completamente a leitura do plano */
  const fatia = {};
  discs.forEach((d) => {
    const meus = itens.filter((i) => i.disciplina === d.nome);
    fatia[d.nome] = { pct: Math.round((meus.reduce((a, i) => a + i.bruto, 0)
      / pesoTotal) * 100), n: meus.length, peso: d.peso };
  });
  const dominante = Object.keys(fatia).filter((k) => fatia[k].pct >= 25);
  dominante.forEach((k) => add("dominante", false,
    '"' + k + '" sozinha representa ' + fatia[k].pct + "% do peso do plano, "
    + "com " + fatia[k].n + " tópicos. Confira se isso corresponde à prova ou se "
    + "a disciplina foi detalhada demais em relação às outras."));

  /* muitos tópicos com peso baixo, ou poucos com peso alto: sinal de que a
   * granularidade da divisão está desigual entre disciplinas */
  const media = discs.reduce((a, d) => a + d.topicos.length, 0) / discs.length;
  discs.forEach((d) => {
    if (d.topicos.length === 1)
      add("uma_linha", false, '"' + d.nome + '" tem um único tópico — '
        + "provavelmente o conteúdo dela não foi dividido.");
    else if (d.topicos.length > media * 2.5)
      add("granular", false, '"' + d.nome + '" tem ' + d.topicos.length
        + " tópicos, muito acima da média de " + Math.round(media)
        + ". Se os outros forem divididos no mesmo detalhe, a ordem muda.");
  });

  const semPeso = itens.filter((i) => {
    const d = discs.find((x) => x.nome === i.disciplina);
    const t0 = d && d.topicos.find((x) => x.nome === i.nome);
    return t0 && t0.herdado;
  });
  if (semPeso.length) add("sem_peso", true, semPeso.length
    + " tópico(s) entraram sem peso e valem 3 por padrão — um palpite "
    + "disfarçado de escolha.");

  /* O motivo GENÉRICO é pior que o motivo ausente: ele silencia o detector
   * de motivo faltando e passa a impressão de que a informação existe. E a
   * culpa é do prompt — a frase "não localizei em provas anteriores" foi
   * oferecida por ele como saída de emergência, e a IA a usou em 60% dos
   * casos do edital real. Quem oferece a saída fácil colhe a saída fácil. */
  /* Cuidado com abreviaturas curtas: a primeira versão trazia "n\/?a\b" e ele
   * casava com o "na" de "caiu NA última prova" — o detector acusava 21 de 21
   * onde o certo era 19. Padrão curto demais acha o que não existe. */
  const RE_MOTIVO_VAZIO = /n[ãa]o\s+(localizei|sei|encontrei|consta)|sem\s+informa[çc]|desconhec|^n\/a$|not\s+found/i;
  const genericos = itens.filter((i) => i.motivo && RE_MOTIVO_VAZIO.test(i.motivo));
  if (genericos.length >= itens.length * 0.3)
    add("motivo_generico", false, genericos.length + " de " + itens.length
      + ' tópicos repetem uma justificativa genérica ("' + genericos[0].motivo.slice(0, 40)
      + '..."). O campo está preenchido, mas não informa nada — e isso desliga o '
      + "aviso de motivo faltando. Vale pedir à IA só os que ela consegue justificar.");

  const semMotivo = itens.filter((i) => !i.motivo);
  if (semMotivo.length > itens.length * 0.5)
    add("sem_motivo", false, semMotivo.length + " de " + itens.length
      + " tópicos não dizem POR QUE têm aquele peso. Sem o motivo não dá para "
      + "conferir o julgamento nem revisá-lo depois.");

  /* nomes repetidos entre disciplinas: costuma ser o mesmo assunto contado
     duas vezes, o que infla artificialmente a fatia de uma delas */
  const vistos = {};
  itens.forEach((i) => {
    const k = i.nome.toLowerCase().trim();
    if (vistos[k] && vistos[k] !== i.disciplina)
      add("repetido", false, 'O tópico "' + i.nome + '" aparece em "'
        + vistos[k] + '" e em "' + i.disciplina + '".');
    else vistos[k] = i.disciplina;
  });

  /* Colisão de prioridade: um tópico que a banca cobrou, dentro de uma
   * disciplina de peso baixo, fica atrás de um tópico irrelevante de uma
   * disciplina de peso alto. É consequência de multiplicar os dois pesos, e
   * o app não pode decidir sozinho — mas pode mostrar o caso concreto. */
  const marcados = itens.filter((i) => i.motivo
    && /caiu|cobrad|cai em|toda prova/i.test(i.motivo));
  if (marcados.length) {
    const pior = marcados.reduce((m, i) => (i.bruto < m.bruto ? i : m), marcados[0]);
    const acimaDele = itens.filter((i) => i.bruto > pior.bruto
      && (!i.motivo || RE_MOTIVO_VAZIO.test(i.motivo))).length;
    if (acimaDele >= itens.length * 0.25)
      add("colisao", false, '"' + pior.nome.slice(0, 46) + '" caiu em prova mas está '
        + "atrás de " + acimaDele + " tópicos sem histórico conhecido, porque a "
        + 'disciplina dele ("' + pior.disciplina + '") tem peso baixo. Se o assunto '
        + "importa mais que a disciplina, suba o peso do tópico.");
  }

  const longos = itens.filter((i) => i.nome.length > 90);
  if (longos.length) add("longo", false, longos.length
    + " tópico(s) têm nome muito comprido — costumam ser vários assuntos numa "
    + "linha só, o que impede pesar cada um.");

  if (plano && plano.fora && plano.fora.length)
    add("nao_cabe", true, plano.fora.length + " de " + itens.length
      + " tópicos não cabem nas " + plano.semanas + " semanas até a prova. "
      + "Seriam necessárias cerca de " + plano.horasNecessarias + "h por semana "
      + "para cobrir tudo.");

  if (!r.cfg.prova) add("sem_data", true,
    "O plano não tem data de prova, então não há como saber o que cabe.");

  return achados;
}

/* Devolve o texto canônico a partir da estrutura — é o que permite o
 * usuário mexer no peso pela tabela e o editor acompanhar. */
function edParaTexto(r) {
  const L = [];
  const c = r.cfg || {};
  const cab = [];
  if (c.concurso) cab.push(c.concurso);
  if (c.prova) cab.push("prova: " + c.prova);
  if (c.horas) cab.push("horas: " + c.horas);
  if (cab.length) { L.push("# " + cab.join(" | ")); L.push(""); }
  (r.disciplinas || []).forEach((d) => {
    L.push("@ " + d.nome + " :: " + d.peso);
    d.topicos.forEach((t) => {
      L.push("+ " + t.nome + " :: " + t.peso + (t.motivo ? " :: " + t.motivo : ""));
    });
    L.push("");
  });
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
