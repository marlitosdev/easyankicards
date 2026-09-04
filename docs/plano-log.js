/* =====================================================================
 * RAIO-X DA RECOMENDAÇÃO
 *
 * A agenda diz O QUE estudar. Este painel diz POR QUÊ — e, principalmente,
 * mostra onde a explicação e o resultado não batem.
 *
 * Ele existe para uma finalidade específica: redesenhar a fórmula. Então
 * não é um resumo bonito do plano; é a máquina aberta, com os números
 * intermediários à vista e um confronto explícito entre o que o app diz
 * que está fazendo e o que ele de fato faz.
 *
 * O CONFRONTO QUE MOTIVOU ISTO. O app calcula a "fatia da prova" de cada
 * disciplina, exibe essa fatia no motivo de cada item, e depois monta a
 * semana num rodízio que pega UM tópico de cada disciplina por rodada.
 * Resultado: 40 questões contra 5 viram 50% e 50% do tempo. A fatia é
 * verdadeira, é exibida, e não move nada. Nenhuma tela mostrava isso
 * porque nenhuma tela punha os dois números lado a lado.
 *
 * Aqui eles ficam na mesma linha, com a diferença calculada.
 *
 * E MAIS: o que o app mede e não usa. Percentual de acerto em questões,
 * humor das sessões, minutos gastos — tudo isso existe, por tópico, e não
 * entra no cálculo. A coluna "não entra" é a lista de matéria-prima
 * disponível para a próxima versão do motor.
 * ===================================================================== */

/* ------------------------------------------------------------------
 * 1. A CONTA DE CADA ITEM
 * ------------------------------------------------------------------ */

/* Um item do plano, com a conta desmontada. Nada é recalculado: os
 * valores vêm do motor. Recalcular aqui criaria uma segunda
 * implementação da mesma regra, e um painel que explica uma conta
 * diferente da que roda é pior do que painel nenhum. */
function plItemConta(i) {
  return {
    ordem: i.ordemFila || null,
    rodada: i.rodada || null,
    disciplina: i.disciplina,
    topico: i.nome,
    pesoDisc: i.disciplinaPeso,
    pesoTop: i.peso,
    bruto: i.bruto,
    fator: i.fator == null ? 1 : i.fator,
    brutoOrdem: i.brutoOrdem == null ? i.bruto : i.brutoOrdem,
    prioridade: i.prioridade,
    faixa: i.faixa,
    minutos: i.minutos,
    semana: i.semana === undefined ? null : i.semana,
    estado: i.estado || "",
    ehRevisao: !!i.ehRevisao,
    fatiaDisc: i.fatiaDisc == null ? null : i.fatiaDisc,
    fase2: !!i.fase2,
  };
}

/* ------------------------------------------------------------------
 * 2. FATIA DA PROVA × FATIA DO TEMPO
 *
 * As duas medidas que deveriam andar juntas. A primeira é quanto a
 * disciplina vale na prova; a segunda é quanto do seu tempo ela recebe.
 * A diferença entre elas é o erro de alocação, em pontos percentuais.
 * ------------------------------------------------------------------ */
function plPorDisciplina(plano, r) {
  if (!plano) return [];
  const linhas = {};
  const pega = (nome) => {
    if (!linhas[nome]) {
      linhas[nome] = { disciplina: nome, fatiaProva: null, abs: null,
                       pesoDisc: null, topicos: 0, pendentes: 0,
                       minutos: 0, minutosSemana1: 0, naFila: 0, fora: 0 };
    }
    return linhas[nome];
  };
  (plano.itens || []).forEach((i) => {
    const L = pega(i.disciplina);
    L.fatiaProva = i.fatiaDisc == null ? L.fatiaProva : i.fatiaDisc;
    L.pesoDisc = i.disciplinaPeso;
    L.topicos++;
    if (!i.feito) L.pendentes++;
  });
  ((r && r.disciplinas) || []).forEach((d) => {
    if (linhas[d.nome]) {
      linhas[d.nome].abs = d.abs || null;
      linhas[d.nome].unidade = d.unidade || "";
    }
  });
  (plano.fila || []).forEach((i) => {
    const L = pega(i.disciplina);
    L.minutos += i.minutos; L.naFila++;
    if (i.semana === 1) L.minutosSemana1 += i.minutos;
  });
  (plano.fora || []).forEach((i) => { pega(i.disciplina).fora++; });

  const lista = Object.keys(linhas).map((k) => linhas[k]);
  const totMin = lista.reduce((a, x) => a + x.minutos, 0) || 1;
  const totS1 = lista.reduce((a, x) => a + x.minutosSemana1, 0) || 1;
  lista.forEach((x) => {
    x.fatiaTempo = Math.round((x.minutos / totMin) * 100);
    x.fatiaSemana1 = Math.round((x.minutosSemana1 / totS1) * 100);
    /* O NÚMERO DO PAINEL. Positivo = a disciplina recebe mais tempo do
     * que vale na prova; negativo = recebe menos. Zero é o alvo. */
    x.desvio = x.fatiaProva == null ? null : x.fatiaTempo - x.fatiaProva;
  });
  lista.sort((a, b) => (b.fatiaProva || 0) - (a.fatiaProva || 0)
    || b.fatiaTempo - a.fatiaTempo);
  return lista;
}

/* ------------------------------------------------------------------
 * 3. SINAIS QUE O APP MEDE E O PLANO IGNORA
 *
 * Por disciplina: acertos em questões (do banco de questões e do
 * diário), sessões registradas, minutos, e como você avaliou o
 * rendimento. Tudo isto já está gravado. NADA disto entra na
 * prioridade — e é exatamente por isso que a coluna existe.
 * ------------------------------------------------------------------ */
function plSinais(plano, diario, banco) {
  const porDisc = {};
  const pega = (d) => {
    if (!porDisc[d]) {
      porDisc[d] = { disciplina: d, qFeitas: 0, qCertas: 0, sessoes: 0,
                     minutos: 0, humorRuim: 0, humorBom: 0, pctDiario: [] };
    }
    return porDisc[d];
  };
  (plano && plano.itens || []).forEach((i) => pega(i.disciplina));

  /* do diário: o que você anotou ao registrar o estudo */
  (diario || []).forEach((x) => {
    if (!x || !x.disc || x.a === "pendente") return;
    if (!porDisc[x.disc]) return;          /* disciplina de outro edital */
    const L = porDisc[x.disc];
    L.sessoes++;
    L.minutos += Number(x.m) || 0;
    if (x.hu === "ruim") L.humorRuim++;
    if (x.hu === "boa") L.humorBom++;
    if (x.q && x.q.feitas) { L.qFeitas += x.q.feitas; L.qCertas += x.q.certas || 0; }
    else if (x.q && x.q.pct != null) L.pctDiario.push(x.q.pct);
  });

  /* do banco de questões: tentativa a tentativa */
  (banco || []).forEach((q) => {
    const d = q.disciplina || "";
    if (!porDisc[d]) return;
    (q.tentativas || []).forEach((tt) => {
      porDisc[d].qFeitas++;
      if (tt.acertou) porDisc[d].qCertas++;
    });
  });

  return Object.keys(porDisc).map((k) => {
    const L = porDisc[k];
    /* PERCENTUAL SÓ COM CONTAGEM. Misturar "85%" anotado à mão com
     * "17 de 20" contado exigiria pesar os dois, e o primeiro não tem
     * peso — não se sabe de quantas questões ele fala. Os dois ficam
     * lado a lado, cada um dizendo de onde veio. */
    L.pct = L.qFeitas ? Math.round((L.qCertas / L.qFeitas) * 100) : null;
    L.pctAnotado = L.pctDiario.length
      ? Math.round(L.pctDiario.reduce((a, b) => a + b, 0) / L.pctDiario.length)
      : null;
    delete L.pctDiario;
    return L;
  }).sort((a, b) => {
    /* pior desempenho primeiro: é a ordem de quem procura dificuldade */
    if (a.pct == null && b.pct == null) return 0;
    if (a.pct == null) return 1;
    if (b.pct == null) return -1;
    return a.pct - b.pct;
  });
}

/* ------------------------------------------------------------------
 * 4. INSTANTÂNEOS — o histórico das recomendações
 *
 * Um por dia, por edital. Guardar a cada montagem encheria o
 * armazenamento com dezenas de cópias idênticas de um mesmo dia (o
 * plano se remonta a cada render), e a série ficaria ilegível.
 * ------------------------------------------------------------------ */
/* qual edital o painel esta olhando — o relatorio precisa saber de
 * qual serie falar, e ele e chamado de fora da tela nos testes */
let plSnapEdAtual = "";

const PL_SNAP_CHAVE = "eac_plano_snaps";
const PL_SNAP_MAX = 120;
let plSnaps = null;

function plSnapsLer() {
  if (plSnaps) return plSnaps;
  try { plSnaps = JSON.parse(localStorage.getItem(PL_SNAP_CHAVE) || "[]"); }
  catch (e) { plSnaps = []; }
  if (!Array.isArray(plSnaps)) plSnaps = [];
  return plSnaps;
}

function plSnapsSalvar() {
  const txt = JSON.stringify(plSnaps || []);
  if (typeof guardar === "function") guardar(PL_SNAP_CHAVE, txt);
  else { try { localStorage.setItem(PL_SNAP_CHAVE, txt); } catch (e) {} }
}

function plHojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

/* O QUE ENTRA NO INSTANTÂNEO: a semana 1 (o que foi recomendado hoje) e
 * os números de contexto. Guardar o plano inteiro seria multiplicar 231
 * tópicos por 120 dias por edital — e a pergunta que o histórico responde
 * é "o que estava na agenda naquele dia", não "qual era a prioridade do
 * item 173". */
function plSnapDe(plano, cfg, editalId) {
  if (!plano) return null;
  const semana1 = (plano.fila || []).filter((i) => i.semana === 1);
  return {
    d: plHojeISO(),
    ed: editalId || "",
    cc: (cfg && cfg.concurso) || "",
    prazo: plano.prazo || "",
    fase: plano.fase ? plano.fase.n : 1,
    semanas: plano.semanas,
    porSemana: plano.porSemana,
    total: plano.total,
    feitos: plano.feitos,
    fora: (plano.fora || []).length,
    exata: !!plano.fatiaExata,
    itens: semana1.map((i) => ({
      c: i.chave, n: i.nome, disc: i.disciplina,
      b: i.bruto, p: i.prioridade, m: i.minutos,
      r: i.ehRevisao ? 1 : 0,
    })),
  };
}

/* Grava, no máximo um por dia e por edital. Devolve true se gravou. */
function plSnapGravar(plano, cfg, editalId) {
  const s = plSnapDe(plano, cfg, editalId);
  if (!s || !s.itens.length) return false;
  const lista = plSnapsLer();
  const iguais = lista.filter((x) => x.d === s.d && String(x.ed) === String(s.ed));
  if (iguais.length) {
    /* MESMO DIA: substitui. O último estado do dia é o que vale — quem
     * registrou estudo às 15h quer ver a agenda das 15h, não a das 8h. */
    const idx = lista.indexOf(iguais[iguais.length - 1]);
    lista[idx] = s;
  } else {
    lista.push(s);
  }
  lista.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  while (lista.length > PL_SNAP_MAX) lista.shift();
  plSnaps = lista;
  plSnapsSalvar();
  return true;
}

/* O QUE MUDOU ENTRE DOIS DIAS. Não é diferença de texto: é quem entrou
 * na semana, quem saiu, e quem continua lá — que é a pergunta de quem
 * desconfia que a agenda não está andando. */
function plSnapDiferenca(a, b) {
  const chaves = (s) => (s && s.itens || []).map((x) => x.c);
  const A = chaves(a), B = chaves(b);
  const nomeDe = {};
  ((a && a.itens) || []).concat((b && b.itens) || [])
    .forEach((x) => { nomeDe[x.c] = x.disc + " › " + x.n; });
  return {
    entraram: B.filter((k) => A.indexOf(k) < 0).map((k) => nomeDe[k]),
    sairam: A.filter((k) => B.indexOf(k) < 0).map((k) => nomeDe[k]),
    ficaram: B.filter((k) => A.indexOf(k) >= 0).map((k) => nomeDe[k]),
  };
}

function plSnapsDoEdital(editalId) {
  return plSnapsLer().filter((x) => !editalId || String(x.ed) === String(editalId));
}

/* ------------------------------------------------------------------
 * 5. O RELATÓRIO EM TEXTO
 *
 * Para colar numa conversa com uma IA, que é o uso declarado: melhorar a
 * fórmula. Por isso é texto puro, com os números crus, e não uma tabela
 * desenhada — desenho não sobrevive a copiar e colar.
 * ------------------------------------------------------------------ */
function plRelatorio(plano, r, diario, banco, cfg) {
  if (!plano) return "";
  const L = [];
  const pct = (x) => (x == null ? "?" : x + "%");
  L.push("RAIO-X DA RECOMENDACAO — " + plHojeISO());
  L.push("concurso: " + ((cfg && cfg.concurso) || "?")
    + " | prova: " + (plano.prazo || "?")
    + " | fase: " + (plano.fase ? plano.fase.n : 1));
  L.push("orcamento: " + plano.porSemana + " min/semana x "
    + plano.semanas + " semanas = " + (plano.orcamento || 0) + " min");
  L.push("topicos: " + plano.total + " | estudados: " + plano.feitos
    + " | nao cabem: " + (plano.fora || []).length);
  L.push("fatia da prova: " + (plano.fatiaExata
    ? "EXATA (numeros do edital)" : "ESTIMADA (peso 1-5)"));
  L.push("");

  L.push("== POR DISCIPLINA ==");
  L.push("disciplina | prova% | tempo% | desvio | pesoD | topicos | min");
  plPorDisciplina(plano, r).forEach((d) => {
    L.push([d.disciplina, pct(d.fatiaProva), pct(d.fatiaTempo),
            (d.desvio == null ? "?" : (d.desvio > 0 ? "+" : "") + d.desvio + "pp"),
            d.pesoDisc, d.topicos, d.minutos].join(" | "));
  });
  L.push("");

  L.push("== SEMANA 1, NA ORDEM ==");
  L.push("# | rodada | disciplina | topico | pesoD x pesoT = bruto"
    + " | prio | faixa | min");
  (plano.fila || []).filter((i) => i.semana === 1).forEach((i) => {
    const c = plItemConta(i);
    L.push([c.ordem, "r" + c.rodada, c.disciplina, c.topico,
            c.pesoDisc + "x" + c.pesoTop + "=" + c.bruto,
            c.prioridade, c.faixa, c.minutos + "min"
            + (c.ehRevisao ? " (revisao)" : "")].join(" | "));
  });
  L.push("");

  L.push("== SINAIS MEDIDOS QUE NAO ENTRAM NO CALCULO ==");
  L.push("disciplina | acerto | anotado | sessoes | min | rendeu mal/bem");
  plSinais(plano, diario, banco).forEach((s) => {
    L.push([s.disciplina,
            (s.pct == null ? "-" : s.pct + "% (" + s.qCertas + "/" + s.qFeitas + ")"),
            (s.pctAnotado == null ? "-" : s.pctAnotado + "%"),
            s.sessoes, s.minutos,
            s.humorRuim + "/" + s.humorBom].join(" | "));
  });

  const snaps = plSnapsDoEdital(plSnapEdAtual);
  if (snaps.length > 1) {
    L.push("");
    L.push("== HISTORICO ==");
    L.push("dias com registro: " + snaps.length
      + " (de " + snaps[0].d + " a " + snaps[snaps.length - 1].d + ")");
    const dif = plSnapDiferenca(snaps[snaps.length - 2], snaps[snaps.length - 1]);
    L.push("desde o anterior: entraram " + dif.entraram.length
      + ", sairam " + dif.sairam.length + ", ficaram " + dif.ficaram.length);
  }
  return L.join("\n");
}

/* ------------------------------------------------------------------
 * 6. ARMAZENAMENTO — o que pode sair, e o que jamais
 *
 * Tudo isto mora no navegador, num espaço de poucos megabytes, e quando
 * ele acaba a gravação falha. O rascunho já sabe disso: rsGravarTudo
 * avisa "sem espaço" em vez de fingir que salvou. Mas avisar no momento
 * do estouro é tarde — a essa altura você está no meio de uma questão.
 *
 * A pergunta certa não é "o que é grande", é O QUE PODE SER PERDIDO.
 * Três classes, e a diferença entre elas é o que autoriza um botão:
 *
 *  · DIAGNÓSTICO — os logs de geração, de material, de lei. Existem para
 *    explicar o que aconteceu numa importação de ontem. Apagar não perde
 *    nada que o app precise: nenhuma conta os lê.
 *
 *  · RASTRO DE TRABALHO — rascunhos de questões, sessão interrompida,
 *    instantâneos do plano. São seus, mas são de uso momentâneo: um
 *    rascunho de uma questão respondida há quatro meses é um desenho que
 *    ninguém vai reabrir, ocupando o lugar do desenho de amanhã.
 *
 *  · TESTEMUNHO — o diário, o progresso, os editais, os resumos, os
 *    cartões, as questões e as tentativas. Isto NÃO tem botão. O diário
 *    é a única prova do que você estudou e de quanto rendeu; as
 *    tentativas são o sinal de dificuldade que a próxima versão do motor
 *    vai usar. Apagá-los para ganhar espaço seria vender exatamente a
 *    matéria-prima que este painel existe para mostrar.
 *
 * O botão nunca apaga antes de dizer quanto libera e o que leva junto.
 * ------------------------------------------------------------------ */

/* rótulo, classe e a chave de tradução de cada gaveta conhecida */
const PL_GAVETAS = [
  { k: "eac_rascunhos", classe: "rastro", i18n: "plog_g_rascunhos" },
  { k: "eac_ger_log", classe: "diag", i18n: "plog_g_gerlog" },
  { k: "eac_mat_log", classe: "diag", i18n: "plog_g_matlog" },
  { k: "eac_lei_log", classe: "diag", i18n: "plog_g_leilog" },
  { k: "eac_plano_snaps", classe: "rastro", i18n: "plog_g_snaps" },
  { k: "eac_qs_sessao", classe: "rastro", i18n: "plog_g_sessao" },
  { k: "eac_qs_hist", classe: "rastro", i18n: "plog_g_qshist" },
  { k: "eac_recortes", classe: "rastro", i18n: "plog_g_recortes" },
  { k: "eac_hist", classe: "rastro", i18n: "plog_g_hist" },
  { k: "eac_questoes", classe: "testemunho", i18n: "plog_g_questoes" },
  { k: "eac_resumos", classe: "testemunho", i18n: "plog_g_resumos" },
  { k: "eac_edital_diario", classe: "testemunho", i18n: "plog_g_diario" },
  { k: "eac_edital_progresso", classe: "testemunho", i18n: "plog_g_progresso" },
  { k: "eac_editais", classe: "testemunho", i18n: "plog_g_editais" },
  { k: "eac_leis", classe: "testemunho", i18n: "plog_g_leis" },
  { k: "eac_vinculos", classe: "testemunho", i18n: "plog_g_vinculos" },
  { k: "eac_deck", classe: "testemunho", i18n: "plog_g_deck" },
];

function plBytes(k) {
  let v = null;
  try { v = localStorage.getItem(k); } catch (e) { v = null; }
  if (v == null) return 0;
  /* UTF-16: o navegador conta dois bytes por caractere na cota. Medir em
   * comprimento de string subestimaria pela metade — e a conversa toda
   * aqui é sobre chegar ou não no limite. */
  return (String(k).length + String(v).length) * 2;
}

function plTamanho(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " kB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

/* Todas as gavetas, medidas, maiores primeiro. As desconhecidas entram
 * como "outros" — uma chave nova não pode sumir do inventário só porque
 * a lista acima não foi atualizada. */
function plArmazenamento() {
  const vistas = {};
  const linhas = PL_GAVETAS.map((g) => {
    vistas[g.k] = 1;
    return { chave: g.k, classe: g.classe, i18n: g.i18n, bytes: plBytes(g.k) };
  });
  let outros = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || vistas[k]) continue;
      outros += plBytes(k);
    }
  } catch (e) {}
  if (outros) {
    linhas.push({ chave: "", classe: "outros", i18n: "plog_g_outros",
                  bytes: outros });
  }
  const total = linhas.reduce((a, x) => a + x.bytes, 0);
  linhas.forEach((x) => {
    x.pct = total ? Math.round((x.bytes / total) * 100) : 0;
  });
  linhas.sort((a, b) => b.bytes - a.bytes);
  return { linhas, total };
}

/* ---- as podas, cada uma dizendo o que faria ANTES de fazer ----
 * Toda poda tem a mesma forma: (fazer) => se falso, só calcula. É o que
 * permite ao botão prometer um número exato em vez de "libera espaço". */

function plPodaLogs(fazer) {
  let bytes = 0, itens = 0;
  ["eac_ger_log", "eac_mat_log", "eac_lei_log"].forEach((k) => {
    const b = plBytes(k);
    if (!b) return;
    bytes += b;
    try { itens += (JSON.parse(localStorage.getItem(k) || "[]") || []).length; }
    catch (e) {}
    if (fazer) {
      try { localStorage.removeItem(k); } catch (e) {}
    }
  });
  if (fazer) {
    /* as listas em memória também: o módulo não relê do armazenamento a
     * cada uso, e deixá-las cheias faria o log reaparecer na próxima
     * gravação como se nada tivesse sido apagado */
    try { if (typeof gerLog !== "undefined") gerLog.length = 0; } catch (e) {}
    try { if (typeof matLog !== "undefined") matLog.length = 0; } catch (e) {}
    try { if (typeof leiLog !== "undefined") leiLog.length = 0; } catch (e) {}
  }
  return { bytes, itens };
}

/* Rascunhos de questões que você já respondeu há mais de N dias.
 * NUNCA os de questão sem resposta: aquele desenho é trabalho em curso. */
function plPodaRascunhos(dias, fazer, bancoDado) {
  let tudo = {};
  try { tudo = JSON.parse(localStorage.getItem("eac_rascunhos") || "{}") || {}; }
  catch (e) { tudo = {}; }
  const limite = Date.now() - (dias || 90) * 86400000;
  const banco = bancoDado
    || (typeof qsBanco !== "undefined" && qsBanco) || [];
  const porId = {};
  banco.forEach((q) => { porId[String(q.id)] = q; });

  let bytes = 0, itens = 0;
  const ficam = {};
  Object.keys(tudo).forEach((id) => {
    const r = tudo[id];
    const q = porId[String(id)];
    const ts = (q && q.tentativas) || [];
    /* a data que decide é a da ÚLTIMA resposta, não a do desenho: quem
     * refez a questão ontem com um rascunho de março ainda o usa */
    const ultima = ts.length ? Date.parse(ts[ts.length - 1].q) : NaN;
    const velho = ts.length && isFinite(ultima) && ultima < limite;
    if (velho) {
      bytes += JSON.stringify(r).length * 2;
      itens++;
      if (!fazer) ficam[id] = r;
    } else {
      ficam[id] = r;
    }
  });
  if (fazer && itens) {
    try { localStorage.setItem("eac_rascunhos", JSON.stringify(ficam)); }
    catch (e) {}
  }
  return { bytes, itens };
}

/* Instantâneos do plano além dos N dias mais recentes. */
function plPodaSnaps(manter, fazer) {
  const lista = plSnapsLer();
  const n = Math.max(0, lista.length - (manter || 30));
  if (!n) return { bytes: 0, itens: 0 };
  const bytes = JSON.stringify(lista.slice(0, n)).length * 2;
  if (fazer) {
    plSnaps = lista.slice(n);
    plSnapsSalvar();
  }
  return { bytes, itens: n };
}

/* A lista do painel: cada poda com o que ela faria, agora. */
function plPodasDisponiveis() {
  const logs = plPodaLogs(false);
  const rasc = plPodaRascunhos(90, false);
  const snaps = plPodaSnaps(30, false);
  return [
    { id: "logs", i18n: "plog_poda_logs", ajuda: "plog_poda_logs_aj",
      bytes: logs.bytes, itens: logs.itens, fazer: () => plPodaLogs(true) },
    { id: "rascunhos", i18n: "plog_poda_rasc", ajuda: "plog_poda_rasc_aj",
      bytes: rasc.bytes, itens: rasc.itens,
      fazer: () => plPodaRascunhos(90, true) },
    { id: "snaps", i18n: "plog_poda_snaps", ajuda: "plog_poda_snaps_aj",
      bytes: snaps.bytes, itens: snaps.itens,
      fazer: () => plPodaSnaps(30, true) },
  ];
}

/* ------------------------------------------------------------------
 * 7. A TELA
 * ------------------------------------------------------------------ */
let plAba = "disc";      /* abre na comparação: é o que o painel veio dizer */
let plDados = null;      /* { plano, r, cfg, editalId } do último abrir */

/* De onde saem os dados: o edital em vista na agenda. Se houver mais de
 * um ativo, vale o primeiro visível — o painel diz qual, em vez de somar
 * dois editais e produzir uma fatia que não é de prova nenhuma. */
function plContexto() {
  if (typeof editais === "undefined" || !Array.isArray(editais)) return null;
  let ativos = editais.filter((e) =>
    typeof edSituacao === "function" && edSituacao(e).grupo !== "encerrado");
  if (typeof hubEdVisivel === "function") {
    const vis = ativos.filter((e) => hubEdVisivel(e.id));
    if (vis.length) ativos = vis;
  }
  const e = ativos[0];
  if (!e) return null;
  const r = lerEdital(e.texto || "");
  const cfg = r.cfg || {};
  const s = typeof edSituacao === "function" ? edSituacao(e) : { prova: cfg.prova };
  const plano = montarPlano(r, {
    horas: cfg.horas || 10, prova: s.prova, feitos: e.progresso || {},
  });
  return { plano, r, cfg, editalId: e.id, nome: e.nome || cfg.concurso || "",
           quantos: ativos.length };
}

function plEl(tag, cls, txt) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (txt != null) el.textContent = String(txt);
  return el;
}

function plTiras(d) {
  const cx = plEl("div", "plog-tiras");
  const tira = (valor, rotulo) => {
    const t1 = plEl("div", "plog-tira");
    t1.append(plEl("b", "", valor), plEl("span", "", rotulo));
    cx.append(t1);
  };
  const p = d.plano;
  tira(p.total, t("plog_t_topicos"));
  tira(p.feitos, t("plog_t_feitos"));
  tira((p.fila || []).filter((i) => i.semana === 1).length, t("plog_t_semana"));
  tira((p.fora || []).length, t("plog_t_fora"));
  tira(p.semanas == null ? "?" : p.semanas, t("plog_t_semanas"));
  tira(p.porSemana + "min", t("plog_t_orcamento"));
  return cx;
}

/* A CLASSE DA COLUNA VALE PARA O CABEÇALHO E PARA A CÉLULA.
 *
 * Numa tela de 540 px esta tabela tem nove colunas e não cabe. A saída é
 * o CSS esconder algumas e fixar a do tópico — e para isso as células
 * precisam de classe, não de posição.
 *
 * Se cabeçalho e célula recebessem a classe em lugares diferentes do
 * código, uma hora um esconderia a coluna e o outro não: a tabela
 * continuaria desenhando, alinhada, com os números embaixo do rótulo
 * errado. Uma tabela que mente alinhada é pior que uma tabela quebrada,
 * porque parece certa. Por isso a lista de colunas é uma só, e a linha
 * se monta a partir dela. */
function plColCls(c) {
  return [c.num ? "plog-num" : "", c.cls || ""].filter(Boolean).join(" ");
}

function plTabela(cabecalhos) {
  const tab = plEl("table", "plog-tab");
  const thead = plEl("thead");
  const tr = plEl("tr");
  cabecalhos.forEach((c) => {
    const th = plEl("th", plColCls(c), c.txt);
    if (c.ajuda) th.title = c.ajuda;
    tr.append(th);
  });
  thead.append(tr);
  const tbody = plEl("tbody");
  tab.append(thead, tbody);
  return { tab, tbody, cols: cabecalhos };
}

/* Uma linha, montada a partir das MESMAS colunas do cabeçalho. Cada
 * valor pode ser um texto ou um nó — o tópico precisa de dois pedaços
 * dentro da mesma célula. */
function plLinha(tbody, cols, valores, clsLinha) {
  const tr = plEl("tr", clsLinha || "");
  cols.forEach((c, k) => {
    const v = valores[k];
    const td = plEl("td", plColCls(c));
    if (v && v.nodeType) td.append(v);
    else td.textContent = v == null ? "" : String(v);
    tr.append(td);
  });
  tbody.append(tr);
  return tr;
}

/* ---- aba: a fila da semana, item a item ---- */
function plPintarFila(box, d) {
  const semana1 = (d.plano.fila || []).filter((i) => i.semana === 1);
  if (!semana1.length) {
    box.append(plEl("div", "plog-vazio", t("plog_sem_fila")));
    return;
  }
  /* "plog-so-largo" some em tela estreita: a ordem já é a ordem das
   * linhas, e ler "#3" na terceira linha não acrescenta nada num espaço
   * que faz falta. "plog-col-top" é a coluna que fica FIXA ao rolar
   * para o lado — sem ela, três colunas adiante ninguém sabe mais de
   * qual tópico é a linha, e a tabela vira uma grade de números. */
  const { tab, tbody, cols } = plTabela([
    { txt: "#", num: true, cls: "plog-so-largo" },
    { txt: t("plog_c_rodada"), num: true, ajuda: t("plog_c_rodada_aj") },
    { txt: t("plog_c_disc"), cls: "plog-so-largo" },
    { txt: t("plog_c_topico"), cls: "plog-col-top" },
    { txt: t("plog_c_conta"), ajuda: t("plog_c_conta_aj"), cls: "plog-conta" },
    { txt: t("dif_col"), num: true, ajuda: t("dif_col_aj") },
    { txt: t("plog_c_prio"), num: true, ajuda: t("plog_c_prio_aj") },
    { txt: t("plog_c_faixa"), ajuda: t("plog_c_faixa_aj") },
    { txt: t("plog_c_min"), num: true },
  ]);
  semana1.forEach((i) => {
    const c = plItemConta(i);
    /* A DISCIPLINA VAI JUNTO DO TÓPICO, sempre — e o CSS decide qual
     * das duas cópias aparece. Em tela larga vale a coluna própria; em
     * tela estreita, a coluna some e sobra esta linha de cima, para a
     * identidade do item caber numa célula só e poder ser fixada.
     *
     * Montar isto por largura, no JavaScript, criaria um desenho que
     * muda com o tamanho da janela sem ninguém repintar — e um redimensionar
     * deixaria a tabela sem disciplina em lugar nenhum. */
    const cel = plEl("div", "plog-top-cel");
    cel.append(plEl("span", "plog-top-disc", c.disciplina));
    cel.append(plEl("span", "", c.topico + (c.ehRevisao ? " ↻" : "")));
    plLinha(tbody, cols, [
      c.ordem,
      c.rodada == null ? "?" : "r" + c.rodada,
      c.disciplina,
      cel,
      c.pesoDisc + " × " + c.pesoTop + " = " + c.bruto,
      c.fator === 1 ? "—" : "×" + String(c.fator).replace(".", ","),
      c.prioridade,
      t("plog_faixa_" + c.faixa),
      c.minutos,
    ], c.ehRevisao ? "plog-rev" : "");
  });
  box.append(tab);
}

/* ---- aba: disciplinas, prova × tempo ---- */
function plPintarDisc(box, d) {
  const linhas = plPorDisciplina(d.plano, d.r);
  if (!linhas.length) {
    box.append(plEl("div", "plog-vazio", t("plog_sem_fila")));
    return;
  }
  /* O AVISO QUE ESTE PAINEL EXISTE PARA DAR. Só aparece quando o desvio
   * é real: com duas disciplinas de peso parecido não há nada a dizer. */
  const pior = linhas.slice().sort((a, b) =>
    Math.abs(b.desvio || 0) - Math.abs(a.desvio || 0))[0];
  if (pior && Math.abs(pior.desvio || 0) >= 8) {
    const av = plEl("div", "plog-aviso");
    av.append(plEl("b", "", t("plog_desvio_tit") + " "));
    av.append(document.createTextNode(t("plog_desvio_txt", {
      d: pior.disciplina, p: pior.fatiaProva, tm: pior.fatiaTempo,
      x: (pior.desvio > 0 ? "+" : "") + pior.desvio,
    })));
    box.append(av);
  }

  const leg = plEl("div", "plog-legenda");
  const lp = plEl("span", "lp"); lp.append(plEl("i"), document.createTextNode(t("plog_leg_prova")));
  const lt = plEl("span", "lt"); lt.append(plEl("i"), document.createTextNode(t("plog_leg_tempo")));
  leg.append(lp, lt);
  box.append(leg);

  const { tab, tbody } = plTabela([
    { txt: t("plog_c_disc") },
    { txt: t("plog_c_barras") },
    { txt: t("plog_c_prova"), num: true, ajuda: t("plog_c_prova_aj") },
    { txt: t("plog_c_tempo"), num: true, ajuda: t("plog_c_tempo_aj") },
    { txt: t("plog_c_desvio"), num: true, ajuda: t("plog_c_desvio_aj") },
    { txt: t("plog_c_pesod"), num: true },
    { txt: t("plog_c_tops"), num: true },
    { txt: t("plog_c_min"), num: true },
  ]);
  const maior = linhas.reduce((m, x) =>
    Math.max(m, x.fatiaProva || 0, x.fatiaTempo || 0), 1) || 1;
  linhas.forEach((x) => {
    const tr = plEl("tr");
    tr.append(plEl("td", "", x.disciplina));

    const tdB = plEl("td");
    const bs = plEl("div", "plog-barras");
    [["prova", x.fatiaProva], ["tempo", x.fatiaTempo]].forEach(([k, v]) => {
      const b = plEl("div", "plog-barra " + k);
      const i2 = plEl("i");
      i2.style.width = Math.round(((v || 0) / maior) * 100) + "%";
      b.append(i2); bs.append(b);
    });
    tdB.append(bs); tr.append(tdB);

    tr.append(plEl("td", "plog-num",
      x.fatiaProva == null ? "—" : x.fatiaProva + "%"));
    tr.append(plEl("td", "plog-num", x.fatiaTempo + "%"));
    const cls = x.desvio == null ? "" : (x.desvio > 2 ? "mais"
      : (x.desvio < -2 ? "menos" : "zero"));
    tr.append(plEl("td", "plog-num plog-desvio " + cls,
      x.desvio == null ? "—" : (x.desvio > 0 ? "+" : "") + x.desvio + "pp"));
    tr.append(plEl("td", "plog-num", x.pesoDisc));
    tr.append(plEl("td", "plog-num", x.topicos));
    tr.append(plEl("td", "plog-num", x.minutos));
    tbody.append(tr);
  });
  box.append(tab);
}

/* ---- aba: sinais que não entram ---- */
function plPintarSinais(box, d) {
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const banco = (typeof qsBanco !== "undefined" && qsBanco) || [];
  const linhas = plSinais(d.plano, diario, banco);
  const av = plEl("div", "plog-aviso");
  av.append(plEl("b", "", t("plog_sinais_tit") + " "));
  av.append(document.createTextNode(t("plog_sinais_txt")));
  box.append(av);
  if (!linhas.length) {
    box.append(plEl("div", "plog-vazio", t("plog_sem_fila")));
    return;
  }
  const { tab, tbody } = plTabela([
    { txt: t("plog_c_disc") },
    { txt: t("plog_c_acerto"), num: true, ajuda: t("plog_c_acerto_aj") },
    { txt: t("plog_c_anotado"), num: true, ajuda: t("plog_c_anotado_aj") },
    { txt: t("plog_c_sessoes"), num: true },
    { txt: t("plog_c_min"), num: true },
    { txt: t("plog_c_rendeu"), ajuda: t("plog_c_rendeu_aj") },
  ]);
  linhas.forEach((s) => {
    const tr = plEl("tr");
    tr.append(plEl("td", "", s.disciplina));
    tr.append(plEl("td", "plog-num", s.pct == null ? "—"
      : s.pct + "% (" + s.qCertas + "/" + s.qFeitas + ")"));
    tr.append(plEl("td", "plog-num", s.pctAnotado == null ? "—" : s.pctAnotado + "%"));
    tr.append(plEl("td", "plog-num", s.sessoes));
    tr.append(plEl("td", "plog-num", s.minutos));
    tr.append(plEl("td", "", s.humorRuim + " / " + s.humorBom));
    tbody.append(tr);
  });
  box.append(tab);
}

/* ---- aba: armazenamento ---- */
function plPintarArmazem(box) {
  const a = plArmazenamento();
  const tiras = plEl("div", "plog-tiras");
  const t1 = plEl("div", "plog-tira");
  t1.append(plEl("b", "", plTamanho(a.total)), plEl("span", "", t("plog_a_total")));
  tiras.append(t1);
  const guardadas = a.linhas.filter((x) => x.bytes > 0).length;
  const t2 = plEl("div", "plog-tira");
  t2.append(plEl("b", "", guardadas), plEl("span", "", t("plog_a_gavetas")));
  tiras.append(t2);
  box.append(tiras);

  /* AS PODAS PRIMEIRO, com o numero exato. Uma lista de tamanhos sem
   * acao e um diagnostico que nao ajuda; um botao "limpar" sem o numero
   * e um pedido de confianca no escuro. */
  const podas = plPodasDisponiveis();
  const total = podas.reduce((x, y) => x + y.bytes, 0);
  const cx = plEl("div", "plog-podas");
  const cab = plEl("div", "plog-poda-cab");
  cab.append(plEl("b", "", t("plog_poda_tit")));
  cab.append(plEl("span", "plog-naoentra", " " + t("plog_poda_sub")));
  cx.append(cab);

  podas.forEach((p2) => {
    const li = plEl("div", "plog-poda" + (p2.bytes ? "" : " vazia"));
    const esq = plEl("div");
    esq.append(plEl("div", "plog-poda-nome", t(p2.i18n)));
    esq.append(plEl("div", "plog-naoentra", t(p2.ajuda)));
    const dir = plEl("div", "plog-poda-dir");
    dir.append(plEl("span", "plog-poda-tam",
      p2.bytes ? plTamanho(p2.bytes) : t("plog_poda_nada")));
    if (p2.bytes) {
      const b = plEl("button", "btn-min", t("plog_poda_fazer"));
      b.onclick = async () => {
        /* CONFIRMACAO COM O NUMERO DENTRO. "Tem certeza?" nao informa
         * nada; "libera 480 kB e apaga 37 rascunhos" e uma decisao. */
        const ok = typeof uiConfirm === "function"
          ? await uiConfirm(t("plog_poda_conf", {
              n: p2.itens, tam: plTamanho(p2.bytes), o: t(p2.i18n) }))
          : true;
        if (!ok) return;
        p2.fazer();
        plPintar();
        if (typeof toast === "function") toast(t("plog_poda_ok", { tam: plTamanho(p2.bytes) }));
      };
      dir.append(b);
    }
    li.append(esq, dir);
    cx.append(li);
  });
  if (total) {
    cx.append(plEl("div", "plog-poda-total",
      t("plog_poda_total", { tam: plTamanho(total) })));
  }
  box.append(cx);

  /* o inventario, para quem quer ver onde o espaco esta de fato */
  const { tab, tbody } = plTabela([
    { txt: t("plog_c_gaveta") },
    { txt: t("plog_c_classe"), ajuda: t("plog_c_classe_aj") },
    { txt: t("plog_c_tamanho"), num: true },
    { txt: t("plog_c_pct"), num: true },
  ]);
  a.linhas.forEach((x) => {
    if (!x.bytes) return;
    const tr = plEl("tr");
    tr.append(plEl("td", "", t(x.i18n)));
    tr.append(plEl("td", "", t("plog_classe_" + x.classe)));
    tr.append(plEl("td", "plog-num", plTamanho(x.bytes)));
    tr.append(plEl("td", "plog-num", x.pct + "%"));
    tbody.append(tr);
  });
  box.append(tab);

  const nota = plEl("div", "plog-aviso");
  nota.append(plEl("b", "", t("plog_nunca_tit") + " "));
  nota.append(document.createTextNode(t("plog_nunca_txt")));
  box.append(nota);
}

/* ---- aba: histórico ---- */
function plPintarHist(box, d) {
  const snaps = plSnapsDoEdital(d.editalId);
  if (snaps.length < 2) {
    box.append(plEl("div", "plog-vazio", t("plog_hist_pouco", { n: snaps.length })));
    return;
  }
  const { tab, tbody } = plTabela([
    { txt: t("plog_c_dia") },
    { txt: t("plog_c_semana"), num: true },
    { txt: t("plog_c_feitos"), num: true },
    { txt: t("plog_c_fora"), num: true },
    { txt: t("plog_c_entraram") },
    { txt: t("plog_c_sairam") },
  ]);
  snaps.slice().reverse().forEach((s, k, arr) => {
    const antes = arr[k + 1];
    const dif = antes ? plSnapDiferenca(antes, s) : null;
    const tr = plEl("tr");
    tr.append(plEl("td", "", s.d));
    tr.append(plEl("td", "plog-num", (s.itens || []).length));
    tr.append(plEl("td", "plog-num", s.feitos));
    tr.append(plEl("td", "plog-num", s.fora));
    tr.append(plEl("td", "", dif ? (dif.entraram.join(", ") || "—") : "—"));
    tr.append(plEl("td", "", dif ? (dif.sairam.join(", ") || "—") : "—"));
    tbody.append(tr);
  });
  box.append(tab);
}

function plPintar() {
  const box = document.getElementById("plogCorpo");
  if (!box) return;
  box.innerHTML = "";
  const d = plDados;
  const sub = document.getElementById("plogSub");
  if (!d) {
    if (sub) sub.textContent = "";
    /* O ARMAZENAMENTO NAO DEPENDE DE EDITAL. Quem chegou aqui justamente
     * porque o app reclamou de espaco pode nao ter edital ativo nenhum —
     * e era a unica aba que ele precisava. */
    if (plAba === "armazem") { plPintarArmazem(box); plAbasPintar(); return; }
    box.append(plEl("div", "plog-vazio", t("plog_sem_edital")));
    plAbasPintar();
    return;
  }
  if (sub) {
    sub.textContent = t("plog_sub", {
      c: d.nome || "?", p: d.plano.prazo || "?",
      f: d.plano.fase ? d.plano.fase.n : 1,
    }) + (d.quantos > 1 ? " · " + t("plog_sub_varios", { n: d.quantos }) : "");
  }
  box.append(plTiras(d));
  /* O SELO DA FATIA. "Exata" e "estimada" mudam o significado de toda a
   * coluna da prova, e sem dizer qual é a tabela mente por omissão. */
  const selo = plEl("div");
  const sp = plEl("span", "plog-selo" + (d.plano.fatiaExata ? "" : " estimada"),
    t(d.plano.fatiaExata ? "plog_exata" : "plog_estimada"));
  selo.append(sp);
  box.append(selo);
  box.append(plEl("div", "", " "));

  if (plAba === "fila") plPintarFila(box, d);
  else if (plAba === "sinais") plPintarSinais(box, d);
  else if (plAba === "hist") plPintarHist(box, d);
  else if (plAba === "armazem") plPintarArmazem(box);
  else plPintarDisc(box, d);

  plAbasPintar();
}

function plAbasPintar() {
  document.querySelectorAll(".plog-aba").forEach((b) => {
    b.classList.toggle("ativa", b.dataset.plogAba === plAba);
  });
}

/* =====================================================================
 * TELA CHEIA
 *
 * Este painel é uma tabela de nove colunas e algumas centenas de linhas.
 * Numa janela de 500 px ele fica com duas barras de rolagem aninhadas —
 * uma da página, outra do corpo — e um corpo de 66vh que só mostra sete
 * linhas por vez. Não é um problema de estilo: é o painel não cabendo no
 * lugar onde foi posto.
 *
 * ABAIXO DE 760 px ELE JÁ ABRE EM TELA CHEIA. Deixar a escolha para o
 * usuário nesse tamanho seria oferecer uma opção cuja resposta certa é
 * sempre a mesma — e ele descobriria isso depois de tentar ler a tabela
 * na janela pequena.
 *
 * Acima disso a escolha é dele e fica guardada, porque numa tela grande
 * a janela flutuante tem uma vantagem real: dá para ver a agenda atrás
 * enquanto se lê a conta que a produziu.
 * ===================================================================== */
const PL_TELA_CHAVE = "eac_plog_cheia";
const PL_TELA_ESTREITA = 760;
let plTelaCheia = false;

function plTelaEstreita() {
  const l = (typeof window !== "undefined" && window.innerWidth) || 1024;
  return l < PL_TELA_ESTREITA;
}

/* O TAMANHO QUE O DEDO DEIXOU GRAVADO.
 *
 * O diálogo tem "resize: both": arrastar o canto é um gesto legítimo, e
 * o navegador guarda o resultado como estilo INLINE no elemento —
 * style="width: 550px; height: 700px".
 *
 * Estilo inline vence qualquer regra de classe, inclusive
 * ".plog-cheia{width:100vw}". Foi por isso que a tela cheia parecia só
 * esticar para baixo: a altura vinha de "height:100dvh" numa janela
 * onde o inline de altura já tinha sido substituído pela rolagem, mas a
 * LARGURA continuava presa nos 550 px de um arrasto feito semanas
 * antes. Nenhum ajuste de CSS resolve isso, porque o problema não está
 * no CSS.
 *
 * Entrar em tela cheia guarda esse tamanho e o apaga; sair devolve
 * exatamente o que estava lá. O arrasto da pessoa não se perde. */
let plTamanhoGuardado = null;

function plSoltarTamanho(dlg) {
  if (!dlg || !dlg.style) return;
  /* GUARDA UMA VEZ SÓ. plTelaAplicar roda a cada repintura, e na segunda
   * o que ele leria já seria o vazio que ele mesmo escreveu — o
   * tamanho original iria embora e "sair da tela cheia" devolveria uma
   * caixa sem largura nenhuma. */
  if (plTamanhoGuardado) return;
  plTamanhoGuardado = { w: dlg.style.width || "", h: dlg.style.height || "" };
  dlg.style.width = "";
  dlg.style.height = "";
}

function plDevolverTamanho(dlg) {
  if (!dlg || !dlg.style || !plTamanhoGuardado) return;
  dlg.style.width = plTamanhoGuardado.w;
  dlg.style.height = plTamanhoGuardado.h;
  plTamanhoGuardado = null;
}

function plTelaAplicar() {
  const dlg = document.getElementById("dlgPlanoLog");
  const bt = document.getElementById("btnPlogTela");
  if (dlg && dlg.classList) dlg.classList.toggle("plog-cheia", plTelaCheia);
  if (dlg) {
    if (plTelaCheia) plSoltarTamanho(dlg);
    else plDevolverTamanho(dlg);
  }
  if (bt) {
    bt.textContent = t(plTelaCheia ? "plog_tela_sair" : "plog_tela_cheia");
    bt.title = t(plTelaCheia ? "plog_tela_sair_aj" : "plog_tela_cheia_aj");
    /* NUMA TELA ESTREITA O BOTÃO SOME em vez de ficar desligado: ele
     * ofereceria voltar para um formato em que a tabela não se lê. */
    bt.hidden = plTelaEstreita();
  }
}

function plTelaAlternar() {
  plTelaCheia = !plTelaCheia;
  try { localStorage.setItem(PL_TELA_CHAVE, plTelaCheia ? "1" : "0"); }
  catch (e) {}
  if (typeof reg === "function") {
    reg("PLANO-LOG", "raio-X " + (plTelaCheia ? "em tela cheia" : "em janela"));
  }
  plTelaAplicar();
}

function plAbrir() {
  /* a largura manda; a preferência só decide o que a largura não decide */
  try {
    plTelaCheia = plTelaEstreita()
      || localStorage.getItem(PL_TELA_CHAVE) === "1";
  } catch (e) { plTelaCheia = plTelaEstreita(); }
  plTelaAplicar();
  plDados = plContexto();
  /* GRAVA AO ABRIR, não a cada render da agenda: o plano se remonta
   * dezenas de vezes por sessão, e gravar em todas encheria a série de
   * cópias do mesmo minuto. Abrir o painel é um ato deliberado, e é o
   * momento em que a foto do dia interessa. */
  if (plDados) {
    plSnapEdAtual = plDados.editalId;
    try { plSnapGravar(plDados.plano, plDados.cfg, plDados.editalId); }
    catch (e) {}
  }
  plPintar();
  if (typeof abrirModal === "function") abrirModal("dlgPlanoLog");
}

function plCopiar() {
  if (!plDados) return;
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const banco = (typeof qsBanco !== "undefined" && qsBanco) || [];
  const txt = plRelatorio(plDados.plano, plDados.r, diario, banco, plDados.cfg);
  if (typeof copiar === "function") copiar(txt, t("plog_copiado"));
  else if (navigator.clipboard) navigator.clipboard.writeText(txt);
}

/* Trocar de aba é uma função, não um trecho dentro de um onclick: o
 * teste precisa poder pedir a aba da semana sem depender de o
 * simulador achar o botão por seletor de classe. */
function plAbaTrocar(nome) {
  plAba = nome || "disc";
  plPintar();
  return plAba;
}

function plIniciar() {
  const liga = (id, fn) => {
    const b = document.getElementById(id);
    if (b) b.onclick = fn;
  };
  liga("btnPlogFechar", () => {
    if (typeof fecharModal === "function") fecharModal("dlgPlanoLog");
    else { const d = document.getElementById("dlgPlanoLog"); if (d) d.close(); }
  });
  liga("btnPlogCopiar", plCopiar);
  liga("btnPlogTela", plTelaAlternar);
  /* GIRAR O APARELHO É TROCAR DE TELA.
   * Sem isto, quem abre o painel em pé (estreito, portanto em tela
   * cheia) e deita o telefone fica com uma janela de 100vh dentro de
   * uma tela mais larga, e o botão de sair continuaria escondido. */
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", () => {
      const d = document.getElementById("dlgPlanoLog");
      if (!d || !d.open) return;
      if (plTelaEstreita()) plTelaCheia = true;
      plTelaAplicar();
    });
  }
  document.querySelectorAll(".plog-aba").forEach((b) => {
    b.onclick = () => plAbaTrocar(b.dataset.plogAba);
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plItemConta, plPorDisciplina, plSinais,
    plSnapDe, plSnapGravar, plSnapsLer, plSnapsDoEdital, plSnapDiferenca,
    plRelatorio, plHojeISO, PL_SNAP_CHAVE, PL_SNAP_MAX,
    plContexto, plAbrir, plPintar, plIniciar, plCopiar,
    plArmazenamento, plPodasDisponiveis, plPodaLogs, plPodaRascunhos,
    plPodaSnaps, plTamanho, plBytes, PL_GAVETAS,
    plTelaAplicar, plTelaAlternar, plTelaEstreita, plColCls, plAbaTrocar,
    plTabela, plLinha, PL_TELA_ESTREITA, PL_TELA_CHAVE,
    plTelaCheiaAtual: () => plTelaCheia,
  };
}
