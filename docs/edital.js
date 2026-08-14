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

/* Distribui o orçamento semanal proporcionalmente ao peso bruto, com PISO:
 * sem piso, um tópico de peso 1 num edital grande recebe "0h05" e some da
 * vida do usuário — e um tópico que nunca é estudado é um tópico que a
 * prova cobra. */
const ED_PISO_MIN = 20;
function distribuirHoras(itens, horasSemana) {
  const total = itens.reduce((s, i) => s + i.bruto, 0) || 1;
  const minutos = Math.max(0, (Number(horasSemana) || 0)) * 60;
  itens.forEach((i) => {
    i.minutos = Math.max(ED_PISO_MIN, Math.round((i.bruto / total) * minutos));
  });
  /* o piso estoura o orçamento: reduz proporcionalmente quem está acima */
  let soma = itens.reduce((s, i) => s + i.minutos, 0);
  if (soma > minutos && minutos > 0) {
    const acima = itens.filter((i) => i.minutos > ED_PISO_MIN);
    const excesso = soma - minutos;
    const base = acima.reduce((s, i) => s + (i.minutos - ED_PISO_MIN), 0) || 1;
    acima.forEach((i) => {
      i.minutos = Math.max(ED_PISO_MIN,
        i.minutos - Math.round(((i.minutos - ED_PISO_MIN) / base) * excesso));
    });
  }
  return itens;
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

function edDetectores(raw) {
  const acesos = [];
  if (temNumeracaoEdital(raw)) acesos.push("numeracao");
  if (temMarcadorTorto(raw)) acesos.push("marcador");
  if (temPesoFaltando(raw)) acesos.push("peso_faltando");
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
