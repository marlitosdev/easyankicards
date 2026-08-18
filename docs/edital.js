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
  /* "previsto" é a data que ainda não existe. Concurso planejado não tem
   * data — tem JANELA ("entre março e junho de 2027"). Guardar isso como se
   * fosse uma data faria o painel prometer certeza que não há. */
  const cfg = { concurso: "", prova: "", horas: 10, previsto: "", fase: "pos" };
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
        else if (/^previsto|^previsao/i.test(k)) { cfg.previsto = v; cfg.fase = "pre"; }
        else if (/^horas/i.test(k)) cfg.horas = Number(v.replace(",", ".")) || 10;
        else if (/^concurso|^nome/i.test(k)) cfg.concurso = v;
      });
      return;
    }

    const md = s.match(ED_DISC_RE);
    if (md) {
      const p = edPartes(md[1]);
      const { peso } = edPeso(p[1], achados, n);
      /* terceiro campo da disciplina: a confiança, usada só no pré-edital.
       * "@ Auditoria :: 5 :: provavel" */
      const conf = (typeof preConfiancaDe === "function") ? preConfiancaDe(p[2]) : "";
      atual = { nome: p[0], peso, linha: n, topicos: [], confianca: conf };
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
/* "2027-03..2027-06" -> { de: "2027-03-01", ate: "2027-06-30", largura: 4 }
 * Um mês solto ("2027-03") vale como janela daquele mês. */
function edJanela(txt) {
  const s = String(txt || "").trim();
  if (!s) return null;
  const p = s.split("..").map((x) => x.trim()).filter(Boolean);
  const fim = (m) => {
    const [a, b] = m.split("-").map(Number);
    return a + "-" + String(b).padStart(2, "0") + "-"
      + new Date(Date.UTC(a, b, 0)).getUTCDate();
  };
  const ini = (m) => m.length === 7 ? m + "-01" : m;
  const de = ini(p[0]);
  const ate = p[1] ? (p[1].length === 7 ? fim(p[1]) : p[1])
                   : (p[0].length === 7 ? fim(p[0]) : p[0]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return null;
  const meses = (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12
    + (Number(ate.slice(5, 7)) - Number(de.slice(5, 7)));
  return { de, ate, meses: Math.max(0, meses) };
}

/* A data de planejamento de um edital previsto é a borda MAIS PRÓXIMA da
 * janela. É a suposição conservadora: se a prova sair em março e você
 * planejou para junho, você é pego; o contrário só sobra tempo. */
function edDataPlanejada(cfg) {
  if (cfg && cfg.prova) return cfg.prova;
  const j = edJanela(cfg && cfg.previsto);
  return j ? j.de : "";
}

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

/* ------------------------------------------------------------------
 * RITMO
 * "121 ficam de fora" é um veredito; ritmo é um painel. A diferença
 * importa: o veredito diz que o plano falhou, o ritmo diz o quanto falta
 * acelerar — e essa é a informação sobre a qual se pode agir.
 * ------------------------------------------------------------------ */
function ritmoDoPlano(plano, diario) {
  const semanas = plano.semanas;
  const pendentes = plano.total - plano.feitos;
  const minutosNecessarios = plano.itens
    .filter((i) => !i.feito).reduce((a, i) => a + i.minutos, 0);

  /* observado: média das últimas 4 semanas com registro, não da vida toda —
   * quem parou dois meses e voltou não deve ver a média do período parado */
  const porSemana = {};
  (diario || []).forEach((x) => {
    if (!x.d || x.d === "?" || x.a === "pendente") return;
    const dt = new Date(x.d + "T00:00:00");
    const k = Math.floor(dt.getTime() / (7 * 86400000));
    porSemana[k] = (porSemana[k] || 0) + (x.m || 0);
  });
  const chaves = Object.keys(porSemana).sort().slice(-4);
  const obsMin = chaves.length
    ? Math.round(chaves.reduce((a, k) => a + porSemana[k], 0) / chaves.length) : 0;

  const necMin = semanas ? Math.round(minutosNecessarios / semanas) : null;
  return {
    semanas, pendentes,
    necessarioMin: necMin,
    necessarioTop: semanas ? Math.ceil(pendentes / semanas) : null,
    observadoMin: obsMin,
    semanasComRegistro: chaves.length,
    planejadoMin: plano.porSemana,
    /* quanto do necessário o ritmo atual cobre; acima de 1 está sobrando */
    razao: necMin ? obsMin / necMin : null,
    /* onde se chega mantendo o ritmo atual */
    alcance: obsMin && plano.itens.length
      ? Math.min(plano.total, plano.feitos + Math.floor(
          (obsMin * (semanas || 0)) / (minutosNecessarios / (pendentes || 1) || 1)))
      : null,
  };
}

/* ------------------------------------------------------------------
 * AGENDA: dia e hora sugeridos
 * "1h" diz quanto, não quando — e "quando" é o que falta para virar
 * compromisso. Com os dias de estudo e o horário de início, cada tópico
 * da semana ganha um lugar no relógio.
 * ------------------------------------------------------------------ */
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function agendar(itens, cfg) {
  const dias = Math.max(1, Math.min(7, Number(cfg && cfg.dias) || 5));
  const inicio = (cfg && cfg.inicio) || "19:00";
  const [h0, m0] = inicio.split(":").map(Number);
  const porDia = Math.ceil(itens.reduce((a, i) => a + i.minutos, 0) / dias);
  /* estuda-se de segunda a sexta por padrão; sábado e domingo entram só
     quando a pessoa pede mais de cinco dias */
  const ordemDias = [1, 2, 3, 4, 5, 6, 0].slice(0, dias);
  let d = 0, usado = 0;
  itens.forEach((i) => {
    if (usado && usado + i.minutos > porDia && d < dias - 1) { d++; usado = 0; }
    const min = h0 * 60 + m0 + usado;
    i.dia = DIAS_SEMANA[ordemDias[d]];
    i.hora = String(Math.floor(min / 60) % 24).padStart(2, "0") + ":"
      + String(min % 60).padStart(2, "0");
    usado += i.minutos;
  });
  return itens;
}

/* ------------------------------------------------------------------
 * PANORAMA POR DISCIPLINA
 * A pergunta que o painel não respondia: "qual matéria pesada eu ainda não
 * toquei?". Progresso médio esconde isso — 40% do plano feito pode ser
 * 100% das leves e 0% da que vale 15% da prova.
 * ------------------------------------------------------------------ */
function panoramaDisciplinas(plano) {
  const porNome = new Map();
  plano.itens.forEach((i) => {
    if (!porNome.has(i.disciplina))
      porNome.set(i.disciplina, { nome: i.disciplina, peso: i.disciplinaPeso, itens: [] });
    porNome.get(i.disciplina).itens.push(i);
  });
  const totalBruto = plano.peso.total || 1;
  const lista = [...porNome.values()].map((d) => {
    const bruto = d.itens.reduce((a, i) => a + i.bruto, 0);
    const feitos = d.itens.filter((i) => i.feito);
    const revs = d.itens.filter((i) => i.revisado);
    const intocados = d.itens.filter((i) => !i.feito);
    /* o número que importa: quanto do PESO desta disciplina ainda não foi
       tocado. Contar tópicos empata "Ordem social" com "Lei de Responsabilidade
       Fiscal", e a prova não empata. */
    const pesoIntocado = intocados.reduce((a, i) => a + i.bruto, 0);
    return {
      nome: d.nome, peso: d.peso, itens: d.itens,
      total: d.itens.length, feitos: feitos.length, revisados: revs.length,
      intocados: intocados.length,
      altaIntocada: intocados.filter((i) => i.faixa === "alta").length,
      bruto, fatia: Math.round((bruto / totalBruto) * 100),
      pesoFeito: Math.round((d.itens.filter((i) => i.feito)
        .reduce((a, i) => a + i.bruto, 0) / (bruto || 1)) * 100),
      pesoRevisado: Math.round((revs.reduce((a, i) => a + i.bruto, 0) / (bruto || 1)) * 100),
      /* lacuna = fatia da prova ainda não estudada. É a régua da ordenação:
         não adianta ordenar por fatia se a disciplina já está pronta. */
      lacuna: Math.round((pesoIntocado / totalBruto) * 100),
    };
  });
  lista.sort((a, b) => (b.lacuna - a.lacuna) || (b.fatia - a.fatia));
  return lista;
}

/* Os tópicos de maior peso que continuam intocados, em qualquer disciplina.
 * É a lista que responde "o que eu não posso deixar de estudar". */
function lacunasCriticas(plano, n) {
  return plano.itens
    .filter((i) => !i.feito && i.faixa === "alta")
    .sort((a, b) => b.bruto - a.bruto)
    .slice(0, n || 8);
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

/* =====================================================================
 * O QUE MUDA AO COLAR UM PLANO CORRIGIDO
 *
 * Colar substitui o edital inteiro. A pergunta única de antes ("perdeu N
 * tópicos, continuar?") escondia o risco maior: o progresso é guardado por
 * "disciplina›tópico", então um tópico que só mudou de NOME leva junto a
 * marca de estudado — e a pessoa não vê isso acontecer. Meses de leitura
 * viram zero sem uma linha de aviso.
 *
 * Esta função não decide nada. Ela lista o que vai mudar, separando o que
 * é ajuste do que é perda.
 * ===================================================================== */
function edCompararColagem(txtAntes, txtDepois, progresso) {
  const A = lerEdital(txtAntes || "");
  const D = lerEdital(txtDepois || "");
  const prog = progresso || {};

  const chaves = (r) => {
    const m = {};
    r.disciplinas.forEach((d) =>
      d.topicos.forEach((tp) => { m[(d.nome + "›" + tp.nome).toLowerCase()] = { d: d.nome, t: tp.nome }; }));
    return m;
  };
  const kA = chaves(A), kD = chaves(D);

  const somem = Object.keys(kA).filter((k) => !(k in kD));
  const surgem = Object.keys(kD).filter((k) => !(k in kA));

  /* a linha que importa: progresso marcado que deixa de ter dono */
  const orfaos = somem.filter((k) => prog[k]).map((k) => kA[k]);

  const pesoA = {}, pesoD = {};
  A.disciplinas.forEach((d) => { pesoA[d.nome.toLowerCase()] = { n: d.nome, p: d.peso }; });
  D.disciplinas.forEach((d) => { pesoD[d.nome.toLowerCase()] = { n: d.nome, p: d.peso }; });
  const pesosMudam = Object.keys(pesoA)
    .filter((k) => k in pesoD && pesoA[k].p !== pesoD[k].p)
    .map((k) => ({ nome: pesoA[k].n, de: pesoA[k].p, para: pesoD[k].p }));

  const discSomem = A.disciplinas.filter((d) => !(d.nome.toLowerCase() in pesoD)).map((d) => d.nome);
  const discSurgem = D.disciplinas.filter((d) => !(d.nome.toLowerCase() in pesoA)).map((d) => d.nome);

  const ignoradas = D.achados.filter((a) => a.tipo === "linha_ignorada").length;

  return {
    topicosAntes: Object.keys(kA).length,
    topicosDepois: Object.keys(kD).length,
    discAntes: A.disciplinas.length,
    discDepois: D.disciplinas.length,
    somem: somem.map((k) => kA[k]),
    surgem: surgem.map((k) => kD[k]),
    orfaos,
    pesosMudam,
    discSomem,
    discSurgem,
    ignoradas,
    /* "grave" é o que não se desfaz colando de novo: progresso perdido.
     * Tópico a menos é uma escolha; marca de estudado sumindo é um dano. */
    grave: orfaos.length > 0,
    vazio: Object.keys(kD).length === 0,
  };
}

/* =====================================================================
 * ACOMPANHAMENTO — um bloco, três perguntas
 *
 * O painel antigo mostrava "PARA COBRIR TUDO: 163h30" como a barra maior e
 * mais colorida da tela. Esse número é só
 *
 *     minutos pendentes ÷ semanas até a prova
 *
 * e portanto descreve a DISTÂNCIA ATÉ A PROVA, não o seu estudo: o mesmo
 * edital pede 164 h/semana com a prova em 13 dias e 5 h/semana com a prova
 * em 6 meses. Ele aparecia três vezes (barra, rótulo e caixa de aviso),
 * enquanto a informação que decide — onde você chega no ritmo real — já
 * estava calculada e nunca era mostrada.
 *
 * Aqui as três perguntas ficam separadas e cada resposta aparece UMA vez:
 *   1. quanto da prova eu já cubro?      (por PESO, não por contagem)
 *   2. em que ritmo eu estou?            (fez × meta × o que a agenda pede)
 *   3. onde isso me leva no dia da prova? (projeção — a única acionável)
 * ===================================================================== */

/* Projeção honesta: gasta o orçamento de minutos percorrendo a FILA na
 * ordem de prioridade, que é como o plano realmente funciona. Somar peso
 * médio daria um número mais bonito e errado. */
function projetarCobertura(plano, minutosPorSemana) {
  if (!plano || !plano.semanas || !minutosPorSemana) return null;
  let orcamento = minutosPorSemana * plano.semanas;
  const pesoTotal = (plano.peso && plano.peso.total) || 0;
  if (!pesoTotal) return null;

  let pesoGanho = 0, topicos = 0;
  const pendentes = plano.itens
    .filter((i) => !i.feito)
    .slice()
    .sort((a, b) => b.bruto - a.bruto);
  for (const i of pendentes) {
    if (orcamento < i.minutos) break;
    orcamento -= i.minutos;
    pesoGanho += i.bruto;
    topicos++;
  }
  const jaFeito = (plano.peso && plano.peso.feito) || 0;
  return {
    topicos: plano.feitos + topicos,
    pesoPct: Math.round(((jaFeito + pesoGanho) / pesoTotal) * 100),
    sobra: pendentes.length - topicos,
    /* o menor peso que entrou e o maior que ficou de fora. Serve para o
     * teste provar que a fila de prioridade foi respeitada de verdade, em
     * vez de inferir isso de um limiar percentual — que e chute, e que me
     * deixou passar duas sabotagens. */
    menorDentro: topicos ? pendentes[topicos - 1].bruto : null,
    maiorFora: topicos < pendentes.length ? pendentes[topicos].bruto : null,
  };
}

function acompanhamento(plano, diario, metaMin) {
  const r = ritmoDoPlano(plano, diario);
  const peso = plano.peso || { total: 0, pctFeito: 0, pctRevisado: 0 };

  /* a agenda desta semana é o que o app de fato pede — é a meta real, e é
   * comparável com o que a pessoa fez */
  const agendaMin = plano.porSemana || 0;
  const meta = metaMin || agendaMin;

  return {
    /* 1. cobertura — sempre por peso, com a contagem como legenda */
    cobertura: {
      pesoEstudado: peso.pctFeito,
      pesoRevisado: peso.pctRevisado,
      topicosFeitos: plano.feitos,
      topicosTotal: plano.total,
      semanas: plano.semanas,
    },
    /* 2. ritmo */
    ritmo: {
      fezMin: r.observadoMin,
      semanasComRegistro: r.semanasComRegistro,
      metaMin: meta,
      agendaMin,
      /* Sem registro não se inventa média — e "média de 1 semana com 0min"
       * NÃO é registro. Enquanto a condição era só semanasComRegistro > 0,
       * a linha do ritmo anunciava "fez 0min/semana (média de 1 semana)"
       * enquanto a projeção logo abaixo dizia "sem registro de estudo".
       * Dois blocos da mesma tela discordando sobre o mesmo fato. */
      medivel: r.semanasComRegistro > 0 && r.observadoMin > 0,
    },
    /* 3. projeção — só existe com registro, senão é chute com cara de dado */
    projecao: (r.semanasComRegistro > 0 && r.observadoMin > 0)
      ? projetarCobertura(plano, r.observadoMin) : null,
    projecaoMeta: meta ? projetarCobertura(plano, meta) : null,
    /* 4. o alerta, no rodapé: é aviso, nunca meta */
    fora: {
      n: plano.fora.length,
      pesoPct: plano.peso && plano.peso.total
        ? Math.round((plano.fora.reduce((a, i) => a + i.bruto, 0) / plano.peso.total) * 100)
        : 0,
      horasParaTudo: r.necessarioMin ? Math.round(r.necessarioMin / 60) : null,
    },
  };
}

/* =====================================================================
 * INCLUIR E EXCLUIR DISCIPLINA À MÃO
 *
 * Tudo acontece NO TEXTO do edital, como o peso editável e as horas já
 * faziam. Estado que não está no texto é estado que diverge da tela — foi
 * o que aconteceu quando o campo de horas e o controle deslizante
 * brigavam, e não vou repetir isso guardando disciplina em outro lugar.
 * ===================================================================== */

/* "Direito Tributário :: 4 :: cai muito" → { nome, peso, motivo } */
function edLerLinhaTopico(linha) {
  const p = String(linha).replace(/^\s*[+\-*]\s*/, "").split("::").map((x) => x.trim());
  const nome = p[0] || "";
  const peso = p[1] !== undefined && p[1] !== "" ? Number(p[1]) : null;
  return {
    nome,
    peso: (peso && peso >= 1 && peso <= 5) ? peso : 3,
    motivo: p[2] || "",
  };
}

function edIncluirDisciplina(texto, nome, peso, linhasTopicos) {
  const limpo = String(nome || "").trim();
  if (!limpo) return { erro: "sem_nome" };

  const r = lerEdital(texto || "");
  if (r.disciplinas.some((d) => d.nome.toLowerCase() === limpo.toLowerCase()))
    return { erro: "repetida", nome: limpo };

  const tops = String(linhasTopicos || "").split("\n")
    .map((l) => l.trim()).filter(Boolean).map(edLerLinhaTopico)
    .filter((tp) => tp.nome);
  /* disciplina sem tópico não entra na agenda nem na conta do peso: seria
   * um item invisível que a pessoa jura ter cadastrado */
  if (!tops.length) return { erro: "sem_topicos" };

  const p = Math.max(1, Math.min(5, Number(peso) || 3));
  const bloco = ["@ " + limpo + " :: " + p]
    .concat(tops.map((tp) => "+ " + tp.nome + " :: " + tp.peso
      + (tp.motivo ? " :: " + tp.motivo : "")));

  const base = String(texto || "").replace(/\s*$/, "");
  const novo = (base ? base + "\n" : "") + bloco.join("\n") + "\n";
  return { texto: novo, nome: limpo, peso: p, topicos: tops.length };
}

/* Excluir tira a disciplina DO PLANO — e só do plano.
 *
 * O diário de estudos não é mexido: ele é o histórico do que você fez, e
 * histórico não se reescreve porque o plano mudou. As marcas de estudado
 * também ficam guardadas: a chave é "disciplina›tópico", então se a
 * disciplina voltar um dia, o que já estava marcado volta com ela. Apagar
 * seria destruir informação para não ganhar nada.
 *
 * A função devolve as contas para que a confirmação possa dizer o que
 * realmente acontece, em vez de um "tem certeza?" genérico. */
function edExcluirDisciplina(texto, nome, progresso) {
  const alvo = String(nome || "").trim().toLowerCase();
  if (!alvo) return { erro: "sem_nome" };

  const r = lerEdital(texto || "");
  const d = r.disciplinas.find((x) => x.nome.toLowerCase() === alvo);
  if (!d) return { erro: "nao_achou", nome };

  const prog = progresso || {};
  const chaves = d.topicos.map((tp) => (d.nome + "›" + tp.nome).toLowerCase());
  const marcados = chaves.filter((c) => prog[c]);

  /* recorta o bloco no texto: da linha "@ nome" até a próxima "@" */
  const linhas = String(texto || "").split("\n");
  const ini = linhas.findIndex((l) =>
    /^\s*@/.test(l) && l.replace(/^\s*@\s*/, "").split("::")[0].trim().toLowerCase() === alvo);
  if (ini < 0) return { erro: "nao_achou", nome };
  let fim = ini + 1;
  while (fim < linhas.length && !/^\s*@/.test(linhas[fim])) fim++;
  linhas.splice(ini, fim - ini);

  return {
    texto: linhas.join("\n"),
    nome: d.nome,
    topicos: d.topicos.length,
    marcados: marcados.length,
    chaves,
    peso: d.peso,
  };
}

/* Redistribuir: devolve os pesos que fariam a fatia das OUTRAS disciplinas
 * voltar ao que era antes da inclusão. Não aplica nada — quem aplica é a
 * pessoa, e "manter assim" é a primeira opção de propósito, porque peso
 * vindo do número de questões do edital é dado, não palpite do app. */
function edRedistribuir(textoAntes, textoDepois) {
  const A = lerEdital(textoAntes || ""), D = lerEdital(textoDepois || "");
  const fatia = (r) => {
    const tot = r.disciplinas.reduce((a, d) =>
      a + d.peso * d.topicos.reduce((b, tp) => b + tp.peso, 0), 0) || 1;
    const m = {};
    r.disciplinas.forEach((d) => {
      m[d.nome.toLowerCase()] = (d.peso * d.topicos.reduce((b, tp) => b + tp.peso, 0)) / tot;
    });
    return m;
  };
  const fa = fatia(A), fd = fatia(D);
  return D.disciplinas
    .filter((d) => fa[d.nome.toLowerCase()] !== undefined)
    .map((d) => {
      const k = d.nome.toLowerCase();
      const alvoPeso = d.peso * (fa[k] / (fd[k] || 1));
      return {
        nome: d.nome, de: d.peso,
        para: Math.max(1, Math.min(5, Math.round(alvoPeso))),
        fatiaAntes: Math.round(fa[k] * 100),
        fatiaDepois: Math.round(fd[k] * 100),
      };
    })
    .filter((x) => x.de !== x.para);
}
