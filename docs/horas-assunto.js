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
      /* a fatia EXATA (questões do edital) quando o plano a tem; senão a estimada (peso × peso) */
      nome, peso: its[0].disciplinaPeso, pesoPct: plano.fatiaExata && plano.fatia && plano.fatia[nome] != null ? plano.fatia[nome] : (bruto / totalBruto) * 100,
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
/* "Assuntos": a sanfona de todas as disciplinas (abaixo do gráfico), com a MESMA cor de confiança do Domínio,
 * busca + filtro (herdados de "Buscar tópico") e marcar vários de uma vez (edSelecao/edLoteAplicar, os de sempre). */
const HOR_FILTROS = ["tudo", "pendentes", "vermelho", "estudados"];
let horBusca = "", horFiltro = "tudo";
const HOR_NIVEL_ORDEM = ["vermelho", "amarelo", "azul", "verde", "cinza"];
/* o pior dos ramos, quando o tópico nao tem nivel proprio (tópico sem ramo sempre tem) */
function horPiorNivel(a, b) { return HOR_NIVEL_ORDEM.indexOf(a) <= HOR_NIVEL_ORDEM.indexOf(b) ? a : b; }

/* o edital ABERTO na tela do edital: plano do texto de agora + o diário deste concurso */
function horDoAberto() {
  const r = lerEdital($("editalTexto").value);
  const plano = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas, prova: $("edProva").value, feitos: edProgresso });
  const nome = (r.cfg && r.cfg.concurso) || "";
  const diario = (edDiario || []).filter((x) => !x.cc || !nome || x.cc === nome);
  return { r, plano, diario };
}

/* o mapa de confiança (Domínio) do MESMO edital e fase, indexado por disciplina e tópico — nada é medido de novo */
function horNiveis(ed, fase) {
  let m = null;
  try { m = domDoEdital(ed, { fase }); } catch (e) { m = null; }
  const porDisc = new Map();
  (m ? m.disciplinas : []).forEach((d) => {
    const porTop = new Map();
    d.topicos.forEach((tp) => porTop.set(tp.nome, tp));
    porDisc.set(d.nome, porTop);
  });
  return porDisc;
}
function horCasa(tp, disc) {
  if (horFiltro === "pendentes" && tp.feito) return false;
  if (horFiltro === "estudados" && !tp.feito) return false;
  if (horFiltro === "vermelho" && tp.nivel !== "vermelho") return false;
  const q = horBusca.trim().toLowerCase();
  if (!q) return true;
  return (tp.nome + " " + disc).toLowerCase().includes(q);
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
    col.onclick = () => { horAbrirDisc(d.nome); };
    graf.append(col);
  });
  cx.append(graf);
  /* a confiança (Domínio) do MESMO edital e fase, e a bandeira ligada onto cada tópico/ramo (nada é medido de novo) */
  const fase = plano.fase && plano.fase.n === 2 ? 2 : 1;
  const niveis = horNiveis({ texto: $("editalTexto").value }, fase);
  m.disciplinas.forEach((d) => {
    const porTop = niveis.get(d.nome) || new Map();
    d.topicos.forEach((tp) => {
      const dm = porTop.get(tp.nome);
      tp.nivel = dm ? dm.nivel : "cinza";
      tp.nivelRamos = new Map((dm && dm.ramos || []).map((r) => [r.ramoId, r.nivel]));
    });
  });
  /* a legenda da confiança: só entra quando há de fato tópicos avaliados (o mesmo mapa existe sempre, mas a legenda
   * é ruído numa tela sem nenhum sinal ainda) */
  const legNiv = gerEl("div", "hor-legenda2");
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    const it = gerEl("span", "hor-leg"); it.title = t("dom_ajuda_" + k);
    it.append(gerEl("i", "hor-leg-i dom-n-" + k), document.createTextNode(" " + t("dom_n_" + k)));
    legNiv.append(it);
  });
  cx.append(legNiv);
  /* busca + filtro + o botão de estudar/registrar seguem os mesmos critérios de sempre (herdados de "Buscar tópico") */
  const barra = gerEl("div", "hor-busca-barra");
  const busca = gerEl("input"); busca.type = "search"; busca.id = "horBusca"; busca.className = "mat-busca";
  busca.placeholder = t("hor_busca_ph"); busca.value = horBusca;
  busca.oninput = () => { horBusca = busca.value; horPintar(); };
  barra.append(busca);
  cx.append(barra);
  const filtros = gerEl("div", "hor-filtros");
  HOR_FILTROS.forEach((f) => {
    const b = gerEl("button", "hor-filtro" + (horFiltro === f ? " ativa" : ""), t("hor_f_" + f)); b.type = "button"; b.id = "horFiltro" + f[0].toUpperCase() + f.slice(1);
    b.onclick = () => { horFiltro = f; horPintar(); };
    filtros.append(b);
  });
  cx.append(filtros);
  /* a sanfona: TODAS as disciplinas, a que foi clicada (no gráfico ou na própria lista) vem primeiro e já aberta */
  const lista = gerEl("div", "hor-lista"); lista.id = "horLista";
  const ordem = m.disciplinas.slice().sort((a, b) => (a.nome === horDiscAberta ? -1 : 0) - (b.nome === horDiscAberta ? -1 : 0));
  let algumTopico = false;
  ordem.forEach((d) => {
    const topsQueCasam = d.topicos.filter((tp) => horCasa(tp, d.nome));
    if (!topsQueCasam.length && (horBusca.trim() || horFiltro !== "tudo")) return;
    algumTopico = true;
    const aberta = d.nome === horDiscAberta;
    const row = gerEl("div", "hor-drow" + (aberta ? " hor-drow-aberta" : "")); row.id = "hor-disc-" + d.nome.replace(/\W+/g, "-");
    const cab = gerEl("div", "hor-drow-cab");
    cab.append(gerEl("i", "hor-drow-seta", aberta ? "▾" : "▸"));
    const meio = gerEl("div", "hor-drow-meio");
    const linha1 = gerEl("div", "hor-drow-l1");
    linha1.append(gerEl("span", "", d.nome), gerEl("span", "hor-drow-peso", t("cov_peso", { p: d.pesoPct.toFixed(1) })));
    meio.append(linha1);
    const trilho = gerEl("div", "hor-drow-trilho");
    const base = d.planejadoMin || Math.max(60, d.totalMin);
    const pEst = Math.min(100, (d.estudoMin / base) * 100), pRev = Math.min(100 - pEst, (d.revisaoMin / base) * 100);
    trilho.append(gerEl("div", "hor-drow-est", ""), gerEl("div", "hor-drow-rev", ""));
    trilho.children[0].style.width = pEst.toFixed(2) + "%"; trilho.children[1].style.width = pRev.toFixed(2) + "%";
    meio.append(trilho, gerEl("div", "hor-un", t("hor_un", { a: d.feitas, n: d.unidades })));
    cab.append(meio);
    row.append(cab);
    cab.onclick = () => horAbrirDisc(d.nome);
    if (aberta) {
      const det = gerEl("div", "hor-det");
      const ac = gerEl("div", "hor-acoes");
      const vc = gerEl("button", "btn-min", t("hor_ver_cobertura")); vc.type = "button";
      vc.onclick = () => { $("dlgHoras").close(); covAbrir(editalAtual, d.nome); };
      ac.append(vc);
      det.append(ac);
      const cont = covContar(cqLerBiblioteca());
      (topsQueCasam.length || (!horBusca.trim() && horFiltro === "tudo") ? topsQueCasam : d.topicos).forEach((tp) => {
        const chave = (d.nome + "›" + tp.nome).toLowerCase();
        const tl = gerEl("div", "hor-top hor-niv-" + tp.nivel + (tp.revisaoMin > 0 && tp.estudoMin === 0 ? " hor-top-so-rev" : ""));
        const cx1 = gerEl("input"); cx1.type = "checkbox"; cx1.className = "hor-sel"; cx1.checked = edSelecao.has(chave);
        cx1.onchange = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); if (cx1.checked) edSelecao.add(chave); else edSelecao.delete(chave); horPintarLote(); };
        cx1.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
        const temRamos = tp.ramos && tp.ramos.length > 0;
        const idAb = "hr|" + chave;
        const ramosAbertos = !horRamosFechados.has(idAb);
        const seta = temRamos ? gerEl("span", "hor-top-seta", ramosAbertos ? "▾" : "▸") : gerEl("span", "hor-top-seta", "");
        if (temRamos) seta.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ramosAbertos) horRamosFechados.add(idAb); else horRamosFechados.delete(idAb); horPintar(); };
        tl.append(cx1, seta, gerEl("span", "hor-top-nome", tp.nome), gerEl("span", "hor-top-h", t("hor_top_h", { e: horTexto(tp.estudoMin), r: horTexto(tp.revisaoMin), a: tp.feitas, n: tp.unidades })));
        const nc = cont.top.get(matChaveViva(d.nome, tp.nome)) || 0;
        const bt = gerEl("button", "btn-min" + (nc ? " btn-min-ok" : ""), nc ? t("hor_estudar", { n: nc }) : t("hor_criar")); bt.type = "button";
        bt.onclick = (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          $("dlgHoras").close();
          if (nc) estcEstudarTopico(d.nome, tp.nome); else bancAlvoDefinir(d.nome, tp.nome);
        };
        tl.append(bt);
        det.append(tl);
        if (temRamos && ramosAbertos) tp.ramos.forEach((r) => {
          const nivR = tp.nivelRamos.get(r.id) || tp.nivel;
          const rl = gerEl("div", "hor-ramo hor-niv-" + nivR + (r.pulado ? " hor-ramo-pulado" : ""));
          rl.append(gerEl("span", "hor-top-nome", (r.revisado ? "↻ " : (r.feito ? "✓ " : "○ ")) + r.nome), gerEl("span", "hor-top-h", t("hor_ramo_h", { e: horTexto(r.estudoMin), r: horTexto(r.revisaoMin) })));
          det.append(rl);
        });
      });
      row.append(det);
    }
    lista.append(row);
  });
  if (!algumTopico) lista.append(gerEl("p", "nota", t("ed_busca_vazia")));
  cx.append(lista);
  /* marcar vários de uma vez: os MESMOS edSelecao/edLoteAplicar de sempre (o "Buscar tópico" antigo usava estes) */
  const lote = gerEl("div", "hor-lote"); lote.id = "horLote";
  const conta = gerEl("span", ""); conta.id = "horLoteConta";
  const bFeito = gerEl("button", "btn-min", t("ed_lote_feito")); bFeito.type = "button"; bFeito.id = "btnHorLoteFeito";
  bFeito.onclick = async () => { await edLoteAplicar(true); horPintar(); };
  const bDesf = gerEl("button", "btn-min", t("ed_lote_desfazer")); bDesf.type = "button"; bDesf.id = "btnHorLoteDesfazer";
  bDesf.onclick = async () => { await edLoteAplicar(false); horPintar(); };
  const bNada = gerEl("button", "btn-min", t("ed_lote_limpar")); bNada.type = "button"; bNada.id = "btnHorLoteNada";
  bNada.onclick = () => { edSelecao.clear(); horPintar(); };
  lote.append(conta, bFeito, bDesf, bNada);
  cx.append(lote);
  horPintarLote();
  const csv = gerEl("button", "btn btn-verde", t("ed_csv")); csv.type = "button"; csv.id = "btnHorCsv";
  csv.onclick = () => edGerarCsv();
  cx.append(csv);
}

/* a barrinha de "N marcados" some sozinha quando não há nada marcado — o mesmo padrão do "Buscar tópico" antigo */
function horPintarLote() {
  const b = $("horLote"); if (!b) return;
  b.classList.toggle("mostra", edSelecao.size > 0);
  const c = $("horLoteConta"); if (c) c.textContent = t("ed_lote_conta", { n: edSelecao.size });
}

/* a disciplina clicada (no gráfico ou na sanfona) sobe para o topo da lista, já aberta, e a tela rola até ela */
function horAbrirDisc(nome) {
  horDiscAberta = horDiscAberta === nome ? "" : nome;
  horPintar();
  if (horDiscAberta) { try { const el = $("hor-disc-" + nome.replace(/\W+/g, "-")); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
}
let horRamosFechados = new Set();

function horAbrir() {
  horDiscAberta = ""; horBusca = ""; horFiltro = "tudo"; horRamosFechados = new Set();
  horPintar();
  dicasDosBotoes({ btnEdHoras: "hor_tip_abrir", btnHorX: "hor_tip_x", horPeriodo: "hor_tip_periodo" });
  abrirModal("dlgHoras");
}

if (typeof document !== "undefined" && $("dlgHoras")) {
  $("btnEdHoras").onclick = horAbrir;
  $("btnHorX").onclick = () => $("dlgHoras").close();
  $("horPeriodo").onchange = horPintar;
}
