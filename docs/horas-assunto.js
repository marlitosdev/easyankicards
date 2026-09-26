/* =====================================================================
 * HORAS POR ASSUNTO: quanto estudei de cada disciplina, quanto foi assunto NOVO e quanto foi só REVISÃO
 *
 * A pergunta: "fiz 20 horas nos mesmos tópicos e não avancei no edital?". O total de horas não responde: 20 horas de
 * revisão e 20 horas de assunto novo aparecem iguais. Aqui cada minuto do diário vai para a disciplina, o tópico e o
 * RAMO a que pertence, separado em ESTUDO (registro "feito") e REVISÃO (registro "revisado"), e ao lado vai o avanço:
 * quantos assuntos (ramos, ou tópicos sem ramos) já foram cumpridos.
 *
 * NADA É MEDIDO DE NOVO: as horas vêm do diário (o mesmo que o ritmo semanal lê), o peso e a ordem vêm do plano
 * (`montarPlano`), e o corte vem do cumprimento dos blocos (`plano.blocos`, o painel dos mínimos).
 *
 * O CORTE EM HORAS é uma aproximação declarada: o mínimo do edital é uma fração da COBERTURA do bloco; aplicada às horas
 * PLANEJADAS de cada disciplina do bloco, vira "quantas horas, mais ou menos, levam até o corte" (e até o corte com a
 * folga de 25% que o painel dos mínimos já usa). Não promete acerto — só mostra o ponto de referência no gráfico.
 * ===================================================================== */
const HOR = { revisaoAlerta: 0.5, minutosAlerta: 120 };

/* Divide `m` minutos entre os ramos de `ids` pelo peso deles (a régua dos ramos do plano). */
function horDividir(item, ids, m) {
  const rs = (item.ramos || []).filter((r) => ids.indexOf(r.id) >= 0);
  if (!rs.length) return [];
  const pesos = edPesosDosRamos(rs), soma = pesos.reduce((a, b) => a + b, 0) || 1;
  return rs.map((r, k) => ({ id: r.id, min: m * pesos[k] / soma }));
}

/* O mapa de horas.
 *   plano:   montarPlano(...) — itens (tópicos com ramos), blocos
 *   diario:  registros do diário (já filtrados para o edital, se for o caso)
 *   opc:     { desde, ate } datas ISO (inclusive) para olhar só um período */
function horMapa(plano, diario, opc) {
  const o = opc || {};
  const itens = (plano && plano.itens) || [];
  const porChave = new Map(itens.map((i) => [i.chave, i]));
  const blocos = (plano && plano.blocos) || [];
  const totalBruto = itens.reduce((a, i) => a + i.bruto, 0) || 1;

  const topo = new Map();          /* chave do tópico → { est, rev, ramos: Map id → {est, rev} } */
  const dela = (chave) => {
    if (!topo.has(chave)) topo.set(chave, { est: 0, rev: 0, ramos: new Map() });
    return topo.get(chave);
  };
  let semMinutos = 0, fora = 0;
  (diario || []).forEach((x) => {
    if (!x || !x.d || x.d === "?" || x.a === "pendente") return;
    if (o.desde && String(x.d) < o.desde) return;
    if (o.ate && String(x.d) > o.ate) return;
    const item = porChave.get(x.c);
    if (!item) { fora++; return; }
    const m = Number(x.m) || 0;
    if (!m) { semMinutos++; return; }
    const campo = x.a === "revisado" ? "rev" : "est";
    const t = dela(x.c);
    t[campo] += m;
    const ids = []
      .concat((x.rm || []).map((z) => z && z.id), (x.rp || []).map((z) => z && z.id))
      .filter((id, k, v) => id && id !== "_topo" && v.indexOf(id) === k);
    horDividir(item, ids, m).forEach((p) => {
      if (!t.ramos.has(p.id)) t.ramos.set(p.id, { est: 0, rev: 0 });
      t.ramos.get(p.id)[campo] += p.min;
    });
  });

  const nomes = [], porDisc = new Map();
  itens.forEach((i) => {
    if (!porDisc.has(i.disciplina)) { porDisc.set(i.disciplina, []); nomes.push(i.disciplina); }
    porDisc.get(i.disciplina).push(i);
  });
  const disciplinas = nomes.map((nome) => {
    const its = porDisc.get(nome);
    const bruto = its.reduce((a, i) => a + i.bruto, 0);
    let est = 0, rev = 0, plan = 0, unTotal = 0, unFeitas = 0, unRev = 0;
    const topicos = its.map((i) => {
      const t = topo.get(i.chave) || { est: 0, rev: 0, ramos: new Map() };
      est += t.est; rev += t.rev;
      plan += i.ehRevisao ? i.minutos * 2 : i.minutos;
      const rs = (i.ramos || []).filter((r) => !r.pulado);
      const un = rs.length ? rs.length : 1;
      const feitas = rs.length ? rs.filter((r) => r.feito).length : (i.feito ? 1 : 0);
      const revs = rs.length ? rs.filter((r) => r.revisado).length : (i.revisado ? 1 : 0);
      unTotal += un; unFeitas += feitas; unRev += revs;
      return {
        nome: i.nome, chave: i.chave, bruto: i.bruto, estudoMin: t.est, revisaoMin: t.rev,
        unidades: un, feitas, revisadas: revs, feito: !!i.feito, revisado: !!i.revisado,
        ramos: (i.ramos || []).map((r) => {
          const p = t.ramos.get(r.id) || { est: 0, rev: 0 };
          return { id: r.id, nome: r.nome, estudoMin: p.est, revisaoMin: p.rev, feito: !!r.feito, revisado: !!r.revisado, pulado: !!r.pulado };
        }),
      };
    }).sort((a, b) => b.bruto - a.bruto);
    const total = est + rev;
    const bl = blocos.find((b) => (b.disciplinas || []).indexOf(nome) >= 0 && b.minPct !== null && b.minPct !== undefined);
    const corteMin = bl ? plan * bl.minPct / 100 : null;
    const seguroMin = bl ? plan * Math.min(100, bl.minPct * ED_FOLGA_MINIMO) / 100 : null;
    const revisaoPct = total ? rev / total : 0;
    return {
      nome, peso: its[0].disciplinaPeso, pesoPct: (bruto / totalBruto) * 100,
      estudoMin: est, revisaoMin: rev, totalMin: total, planejadoMin: plan, revisaoPct,
      unidades: unTotal, feitas: unFeitas, revisadas: unRev, pendentes: unTotal - unFeitas,
      bloco: bl ? { nome: bl.nome, minPct: bl.minPct, abaixo: !!bl.abaixo, apertado: !!bl.apertado } : null,
      corteMin, seguroMin,
      /* muito tempo, mais da metade revisando e ainda há assunto por cumprir: horas que não avançaram o edital */
      alerta: total >= HOR.minutosAlerta && revisaoPct >= HOR.revisaoAlerta && unTotal - unFeitas > 0,
      topicos,
    };
  }).sort((a, b) => (b.pesoPct - a.pesoPct) || (a.nome < b.nome ? -1 : 1));
  const est = disciplinas.reduce((a, d) => a + d.estudoMin, 0), rev = disciplinas.reduce((a, d) => a + d.revisaoMin, 0);
  return { disciplinas, total: { estudoMin: est, revisaoMin: rev, totalMin: est + rev, revisaoPct: est + rev ? rev / (est + rev) : 0 }, semMinutos, fora };
}

/* "12h30" / "45min" */
function horTexto(min) {
  const m = Math.round(min || 0);
  if (m < 60) return m + "min";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + "h" + String(r).padStart(2, "0") : h + "h";
}

/* =====================================================================
 * A TELA: colunas, da esquerda para a direita, na ordem do PESO
 *   azul = estudo novo · roxo = revisão · contorno tracejado = horas planejadas · linhas = corte e corte com folga
 *   embaixo de cada coluna: quantos assuntos (ramos) já foram cumpridos. Clicar numa coluna abre os tópicos e ramos.
 * ===================================================================== */
const HOR_ALTURA = 190;
let horDiscAberta = "";

/* o edital ABERTO na tela do edital: plano do texto de agora + o diário deste concurso */
function horDoAberto() {
  const r = lerEdital($("editalTexto").value);
  const plano = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas, prova: $("edProva").value, feitos: edProgresso });
  const nome = (r.cfg && r.cfg.concurso) || "";
  const diario = (edDiario || []).filter((x) => !x.cc || !nome || x.cc === nome);
  return { r, plano, diario };
}

function horPeriodo() {
  const v = $("horPeriodo").value;
  if (v === "7" || v === "30" || v === "90") {
    const d = new Date(); d.setDate(d.getDate() - Number(v));
    const p = (n) => String(n).padStart(2, "0");
    return { desde: d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) };
  }
  return {};
}

function horPintar() {
  const cx = $("horCorpo");
  cx.innerHTML = "";
  const { plano, diario } = horDoAberto();
  if (!plano.itens.length) { cx.append(gerEl("p", "nota", t("hor_sem_plano"))); return; }
  const m = horMapa(plano, diario, horPeriodo());
  const tt = m.total;
  const res = gerEl("div", "hor-resumo");
  res.append(gerEl("b", "", t("hor_total", { h: horTexto(tt.totalMin) })),
    document.createTextNode(" " + t("hor_total2", { e: horTexto(tt.estudoMin), r: horTexto(tt.revisaoMin), p: Math.round(tt.revisaoPct * 100) })));
  cx.append(res);
  if (m.semMinutos) cx.append(gerEl("p", "nota", t("hor_sem_minutos", { n: m.semMinutos })));
  const leg = gerEl("div", "hor-legenda");
  /* as linhas de corte só entram na legenda quando alguma coluna tem uma (blocos com mínimo no edital) */
  const temCorte = m.disciplinas.some((d) => d.corteMin !== null);
  [["hor-est", t("hor_leg_est")], ["hor-rev", t("hor_leg_rev")], ["hor-plano", t("hor_leg_plano")]]
    .concat(temCorte ? [["hor-corte", t("hor_leg_corte")], ["hor-seguro", t("hor_leg_seguro")]] : []).forEach(([c, r]) => {
    const it = gerEl("span", "hor-leg"); it.append(gerEl("i", "hor-leg-i " + c), document.createTextNode(" " + r));
    leg.append(it);
  });
  cx.append(leg);
  /* CADA COLUNA É UMA TRILHA DE ALTURA FIXA = as horas PLANEJADAS daquela disciplina (100%). O azul e o roxo sobem
   * da base como fração da meta; as linhas de corte ficam na mesma escala (o mínimo é % do planejado). Assim todas as
   * colunas têm o mesmo topo e o mesmo rótulo, e o que muda é o quanto da meta foi cumprido — as horas absolutas vão no
   * rótulo de cima ("2h45 de 30h"). Passou da meta: a trilha enche e mostra o "+". */
  const graf = gerEl("div", "hor-graf");
  m.disciplinas.forEach((d) => {
    const col = gerEl("div", "hor-col" + (d.alerta ? " hor-col-alerta" : "") + (horDiscAberta === d.nome ? " hor-col-aberta" : ""));
    col.title = d.nome + " — " + t("hor_tip_col", { e: horTexto(d.estudoMin), r: horTexto(d.revisaoMin), p: horTexto(d.planejadoMin), a: d.feitas, n: d.unidades })
      + (d.bloco ? " — " + t("hor_tip_corte", { p: d.bloco.minPct, h: horTexto(d.corteMin) }) : "");
    const topo = gerEl("div", "hor-topo");
    topo.append(gerEl("b", "", horTexto(d.totalMin)), gerEl("span", "hor-topo-de", t("hor_de", { p: horTexto(d.planejadoMin) })));
    col.append(topo);
    const area = gerEl("div", "hor-area" + (d.totalMin > d.planejadoMin ? " hor-excede" : ""));
    area.style.height = HOR_ALTURA + "px";
    const base = d.planejadoMin || Math.max(60, d.totalMin);
    const pEst = Math.min(100, (d.estudoMin / base) * 100), pRev = Math.min(100 - pEst, (d.revisaoMin / base) * 100);
    const est = gerEl("div", "hor-est"); est.style.height = pEst.toFixed(2) + "%";
    const rev = gerEl("div", "hor-rev"); rev.style.height = pRev.toFixed(2) + "%";
    area.append(rev, est);
    if (d.corteMin !== null && d.planejadoMin) {
      const c = gerEl("div", "hor-corte" + (d.bloco.abaixo ? " hor-corte-risco" : "")); c.style.bottom = ((d.corteMin / d.planejadoMin) * 100).toFixed(2) + "%"; area.append(c);
      const s = gerEl("div", "hor-seguro"); s.style.bottom = ((d.seguroMin / d.planejadoMin) * 100).toFixed(2) + "%"; area.append(s);
    }
    col.append(area);
    const prog = gerEl("div", "hor-prog");
    const barra = gerEl("div", "hor-prog-b"); barra.style.width = (d.unidades ? (d.feitas / d.unidades) * 100 : 0).toFixed(0) + "%";
    prog.append(barra);
    col.append(prog, gerEl("div", "hor-un", t("hor_un", { a: d.feitas, n: d.unidades })));
    col.append(gerEl("div", "hor-nome", d.nome), gerEl("div", "hor-pesop", t("cov_peso", { p: d.pesoPct.toFixed(1) })));
    /* o alerta ocupa SEMPRE a mesma linha (vazia quando não há), para as colunas terminarem alinhadas */
    col.append(gerEl("div", "hor-alerta", d.alerta ? "⚠ " + t("hor_alerta", { p: Math.round(d.revisaoPct * 100) }) : ""));
    col.onclick = () => { horDiscAberta = horDiscAberta === d.nome ? "" : d.nome; horPintar(); };
    graf.append(col);
  });
  cx.append(graf);
  /* o detalhe da disciplina escolhida: tópicos e ramos, com as horas de cada um */
  const esc = m.disciplinas.find((d) => d.nome === horDiscAberta);
  if (esc) {
    const det = gerEl("div", "hor-det");
    det.append(gerEl("h4", "", esc.nome));
    const rx = gerEl("ul", "hor-rx");
    [t("hor_rx_peso", { p: esc.pesoPct.toFixed(1) }),
      t("hor_rx_horas", { h: horTexto(esc.totalMin), p: horTexto(esc.planejadoMin) }),
      t("hor_rx_mix", { e: horTexto(esc.estudoMin), r: horTexto(esc.revisaoMin) }),
      t("hor_rx_assuntos", { a: esc.feitas, n: esc.unidades })]
      .concat(esc.bloco ? [t("hor_tip_corte", { p: esc.bloco.minPct, h: horTexto(esc.corteMin) })] : [])
      .forEach((x) => rx.append(gerEl("li", "", x)));
    det.append(rx);
    esc.topicos.forEach((tp) => {
      const l = gerEl("div", "hor-top" + (tp.revisaoMin > 0 && tp.estudoMin === 0 ? " hor-top-so-rev" : ""));
      l.append(gerEl("span", "hor-top-nome", tp.nome), gerEl("span", "hor-top-h", t("hor_top_h", { e: horTexto(tp.estudoMin), r: horTexto(tp.revisaoMin), a: tp.feitas, n: tp.unidades })));
      det.append(l);
      tp.ramos.forEach((r) => {
        const rl = gerEl("div", "hor-ramo" + (r.pulado ? " hor-ramo-pulado" : ""));
        rl.append(gerEl("span", "hor-top-nome", (r.revisado ? "↻ " : (r.feito ? "✓ " : "○ ")) + r.nome), gerEl("span", "hor-top-h", t("hor_ramo_h", { e: horTexto(r.estudoMin), r: horTexto(r.revisaoMin) })));
        det.append(rl);
      });
    });
    cx.append(det);
  }
}

function horAbrir() {
  horDiscAberta = "";
  horPintar();
  dicasDosBotoes({ btnEdHoras: "hor_tip_abrir", btnHorX: "hor_tip_x", horPeriodo: "hor_tip_periodo" });
  abrirModal("dlgHoras");
}

if (typeof document !== "undefined" && $("dlgHoras")) {
  $("btnEdHoras").onclick = horAbrir;
  $("btnHorX").onclick = () => $("dlgHoras").close();
  $("horPeriodo").onchange = horPintar;
}
