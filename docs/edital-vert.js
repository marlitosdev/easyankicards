/* =====================================================================
 * EDITAL VERTICALIZADO — o MOTOR (puro, sem DOM).
 *
 * "Verticalizado" é o edital escrito em tabela: uma faixa por disciplina e, abaixo, uma linha por
 * assunto com numeração (1, 1.1, 1.2…) e colunas para a pessoa marcar à mão — teoria, questões,
 * acertos, revisão 1 e revisão 2. Este arquivo só decide O QUE entra e EM QUE ORDEM; quem desenha
 * a folha (e imprime) é a tela. Assim a conta pode ser conferida com o edital na mão.
 *
 * Duas regras que vêm do resto do app e não podem divergir daqui:
 *  - a fatia da prova de cada disciplina é a MESMA de montarPlano (exata quando TODAS as
 *    disciplinas trazem número de questões; senão, soma de peso da disciplina × peso do tópico);
 *  - o progresso do ramo segue edEstadoDosRamos: ramo sem marca própria herda a do tópico, e o
 *    tópico só está "feito" quando todos os ramos ativos estão.
 * ===================================================================== */

function edVertFatias(r) {
  const ds = (r && r.disciplinas) || [];
  const comAbs = ds.filter((d) => d.abs > 0);
  const exata = comAbs.length > 0 && comAbs.length === ds.length;
  const fatia = {};
  if (exata) {
    const soma = comAbs.reduce((a, d) => a + d.abs, 0) || 1;
    ds.forEach((d) => { fatia[d.nome] = Math.round((d.abs / soma) * 100); });
  } else {
    const por = {};
    let total = 0;
    ds.forEach((d) => d.topicos.forEach((t) => {
      const b = d.peso * t.peso;
      por[d.nome] = (por[d.nome] || 0) + b;
      total += b;
    }));
    total = total || 1;
    ds.forEach((d) => { fatia[d.nome] = Math.round(((por[d.nome] || 0) / total) * 100); });
  }
  return { exata, fatia };
}

/* uma marca do progresso ({e: "feito"|"revisado"|"pulado", d}) nas três caixas da folha */
function edVertCaixas(m) {
  const e = m && m.e;
  return { teoria: e === "feito" || e === "revisado", rev1: e === "revisado", pulado: e === "pulado" };
}

/* as caixas do tópico e de cada ramo dele, com a regra de edEstadoDosRamos */
function edVertMarcas(chave, ramos, marcaDe) {
  const top = marcaDe ? marcaDe(chave) : null;
  if (!ramos || !ramos.length) return { ...edVertCaixas(top), ramos: [] };
  const rs = ramos.map((rm) => edVertCaixas((marcaDe && marcaDe(chave + "›#" + rm.id)) || top));
  const ativos = rs.filter((x) => !x.pulado);
  return {
    teoria: ativos.length > 0 && ativos.every((x) => x.teoria),
    rev1: ativos.length > 0 && ativos.every((x) => x.rev1),
    pulado: ativos.length === 0,
    ramos: rs,
  };
}

/* opc.ordem: "peso" (padrão: mais questões/peso primeiro; empate = ordem do edital) | "edital"
 * opc.ramos: mostrar os ramos como sub-linhas (1.1, 1.2…)         opc.motivo: levar o motivo/nota do peso
 * opc.soFase2: só os tópicos que caem na 2ª fase (com o peso dela)
 * opc.marcaDe(chave) → {e, d}|null: reflete o que a pessoa já estudou (sem ela, todas as caixas vazias) */
function edVerticalizar(r, opc) {
  opc = opc || {};
  const cfg = (r && r.cfg) || {};
  const ordem = opc.ordem === "edital" ? "edital" : "peso";
  const { exata, fatia } = edVertFatias(r);
  const blocos = (r && r.blocos) || [];
  const marcaDe = typeof opc.marcaDe === "function" ? opc.marcaDe : null;

  let ds = ((r && r.disciplinas) || []).map((d, idx) => ({ d, idx }));
  if (ordem === "peso") {
    const valor = (d) => (exata ? d.abs : d.peso);
    /* empate de peso: a que mais vale na prova (a fatia) vem antes; só então a ordem do edital */
    ds.sort((a, b) => (valor(b.d) - valor(a.d)) || (b.d.peso - a.d.peso) || ((fatia[b.d.nome] || 0) - (fatia[a.d.nome] || 0)) || (a.idx - b.idx));
  }

  const disciplinas = [];
  ds.forEach(({ d }) => {
    const tops = opc.soFase2 ? d.topicos.filter((t) => t.fase2) : d.topicos;
    if (!tops.length) return;
    const bloco = blocos.find((b) => b.nome === d.bloco) || null;
    const linhas = [];
    let nRamos = 0;
    tops.forEach((t, k) => {
      const chave = (d.nome + "›" + t.nome).toLowerCase();
      const num = String(k + 1);
      const m = edVertMarcas(chave, t.ramos, marcaDe);
      const comRamos = !!(opc.ramos && t.ramos && t.ramos.length);
      linhas.push({
        num, nivel: 0, texto: t.nome, peso: opc.soFase2 ? (t.pesoF2 || t.peso) : t.peso,
        motivo: opc.motivo ? (t.motivo || "") : "", fase2: !!t.fase2, pai: comRamos, chave,
        teoria: m.teoria, rev1: m.rev1, rev2: false, pulado: m.pulado,
      });
      if (comRamos) {
        t.ramos.forEach((rm, j) => {
          nRamos++;
          linhas.push({
            num: num + "." + (j + 1), nivel: 1, texto: rm.nome, peso: rm.peso,
            motivo: opc.motivo ? (rm.nota || "") : "", fase2: false, pai: false, chave: chave + "›#" + rm.id,
            teoria: m.ramos[j].teoria, rev1: m.ramos[j].rev1, rev2: false, pulado: m.ramos[j].pulado,
          });
        });
      }
    });
    disciplinas.push({
      pos: disciplinas.length + 1, nome: d.nome, grupo: d.bloco || "", minimo: bloco ? bloco.minimo : null,
      peso: d.peso, abs: d.abs || null, unidade: d.unidade || "", fatia: fatia[d.nome] != null ? fatia[d.nome] : null,
      topicos: tops.length, ramos: nRamos, linhas,
    });
  });

  return {
    titulo: cfg.concurso || "", prova: cfg.prova || "", fase2: cfg.fase2 || null,
    ordem, exata, soFase2: !!opc.soFase2, disciplinas,
    resumo: {
      disciplinas: disciplinas.length,
      topicos: disciplinas.reduce((a, d) => a + d.topicos, 0),
      ramos: disciplinas.reduce((a, d) => a + d.ramos, 0),
    },
  };
}
