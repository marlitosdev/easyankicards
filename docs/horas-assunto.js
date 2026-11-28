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
 * (19.213.0) O DADO PRINCIPAL É A COBERTURA, NÃO O TEMPO: a barra de horas contra o planejado parecia "quase tudo
 * estudado" (47h de 51h) com 41% dos assuntos cumpridos — o "de" era só o que faltava, e encolhia a cada ramo. Agora a
 * barra é assuntos cumpridos ÷ todos, o corte do bloco fica na mesma régua (% dos assuntos), e as horas viram apoio:
 * total, fatia do tempo, estudo novo × revisão, ritmo (minutos por assunto) contra o plano e se o que falta cabe até a prova.
 * ===================================================================== */
const HOR = { revisaoAlerta: 0.5, minutosAlerta: 120, ritmoMinUn: 3, minutosConcentra: 300, concentraFator: 1.5, concentraPontos: 15 };

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
  /* (19.213.0) o estudo novo de SEMPRE, por tópico: o ritmo (minutos por assunto cumprido) compara com os assuntos
   * cumpridos de sempre, então não pode olhar só o período escolhido */
  const estTudo = new Map();
  let semMinutos = 0, fora = 0;
  (diario || []).forEach((x) => {
    if (!x || !x.d || x.d === "?" || x.a === "pendente") return;
    const item = porChave.get(x.c);
    if (item && x.a !== "revisado" && Number(x.m) > 0) estTudo.set(x.c, (estTudo.get(x.c) || 0) + Number(x.m));
    if (o.desde && String(x.d) < o.desde) return;
    if (o.ate && String(x.d) > o.ate) return;
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
    let est = 0, rev = 0, estT = 0, orc = 0, faltaPlano = 0, unTotal = 0, unFeitas = 0, unRev = 0;
    const topicos = its.map((i) => {
      const t = topo.get(i.chave) || { est: 0, rev: 0, ramos: new Map() };
      est += t.est; rev += t.rev; estT += estTudo.get(i.chave) || 0;
      const rs = (i.ramos || []).filter((r) => !r.pulado);
      /* (19.213.0) O ORÇAMENTO FIXO do tópico: a soma do tempo dos ramos (sem os pulados), ou o tempo da faixa. Não é
       * `i.minutos`: num tópico com ramos esse é só o que FALTA (encolhe a cada ramo cumprido — era o "de 51h20" que fazia
       * a barra subir sozinha), e na revisão é a sessão (metade). */
      const base = i.ehRevisao ? i.minutos * 2 : i.minutos;
      orc += rs.length ? rs.reduce((a, r) => a + (r.minutos || 0), 0) : base;
      faltaPlano += rs.length ? rs.filter((r) => !r.feito).reduce((a, r) => a + (r.minutos || 0), 0) : (i.feito ? 0 : base);
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
    /* (19.103.0) "VALE X% DA PROVA": a fatia do PLANO (a mesma da agenda e do Domínio) — exata onde o edital dá o número de
     * questões, estimada no resto, com a discursiva. Antes era a soma "peso × peso" dos tópicos (58% num edital em que a
     * disciplina vale 44%). Sem a fatia no plano, a conta antiga continua de reserva. */
    const pesoPct = plano.fatiaFina && plano.fatiaFina[nome] != null ? plano.fatiaFina[nome]
      : (plano.fatiaExata && plano.fatia && plano.fatia[nome] != null ? plano.fatia[nome] : (bruto / totalBruto) * 100);
    /* (19.103.0) COM UM PERÍODO, A META DE HORAS É A DO PERÍODO: as horas por semana × as semanas do período × o que a
     * disciplina vale. Sem período, o planejado é o orçamento fixo da disciplina inteira. */
    const planPer = o.dias && o.minSemana ? o.minSemana * (o.dias / 7) * (pesoPct / 100) : null;
    /* (19.213.0) A COBERTURA É O DADO PRINCIPAL: assuntos (ramos, ou o tópico sem ramos) cumpridos ÷ todos. O corte do bloco
     * fica na MESMA régua (% dos assuntos), com a folga de 25% do painel dos mínimos. Antes o corte virava horas (% do
     * planejado) e passar da linha parecia "passei do corte" quando era só "gastei metade das horas". A cobertura não
     * depende do período, então as linhas ficam em qualquer período. */
    const coberturaPct = unTotal ? (unFeitas / unTotal) * 100 : 0;
    const bl = blocos.find((b) => (b.disciplinas || []).indexOf(nome) >= 0 && b.minPct !== null && b.minPct !== undefined) || null;
    const cortePct = bl ? bl.minPct : null;
    const seguroPct = bl ? Math.min(100, bl.minPct * ED_FOLGA_MINIMO) : null;
    const estado = cortePct === null ? null : coberturaPct < cortePct ? "abaixo" : coberturaPct < seguroPct ? "apertado" : "ok";
    /* O RITMO: minutos de estudo novo (de sempre) por assunto cumprido, contra o que o plano prevê por assunto. Com menos
     * de HOR.ritmoMinUn assuntos cumpridos a média não diz nada e fica de fora. */
    const pendentes = unTotal - unFeitas;
    const ritmoMin = unFeitas >= HOR.ritmoMinUn && estT > 0 ? estT / unFeitas : null;
    const previstoMin = unTotal ? orc / unTotal : null;
    const faltaRitmoMin = ritmoMin === null ? null : ritmoMin * pendentes;
    /* CABE ATÉ A PROVA? O tempo que sobra para ela (horas por semana × semanas até a prova × o que ela vale) contra o que
     * falta (no ritmo real, ou pelo plano sem ritmo). Aproximação declarada: não desconta o tempo de revisão. */
    const dispMin = o.diasProva > 0 && o.minSemana ? o.minSemana * (o.diasProva / 7) * (pesoPct / 100) : null;
    const faltaMin = faltaRitmoMin !== null ? faltaRitmoMin : faltaPlano;
    const revisaoPct = total ? rev / total : 0;
    return {
      nome, peso: its[0].disciplinaPeso, pesoPct,
      estudoMin: est, revisaoMin: rev, totalMin: total, estudoTudoMin: estT, revisaoPct, periodo: planPer !== null,
      planejadoMin: planPer !== null ? planPer : orc, orcamentoMin: orc,
      unidades: unTotal, feitas: unFeitas, revisadas: unRev, pendentes, coberturaPct,
      bloco: bl ? { nome: bl.nome, minPct: bl.minPct, abaixo: !!bl.abaixo, apertado: !!bl.apertado } : null,
      cortePct, seguroPct, estado,
      ritmoMin, previstoMin, faltaRitmoMin, faltaPlanoMin: faltaPlano, faltaMin, dispMin,
      naoCabe: dispMin !== null && pendentes > 0 && faltaMin > dispMin,
      /* muito tempo, mais da metade revisando e ainda há assunto por cumprir: horas que não avançaram o edital */
      alerta: total >= HOR.minutosAlerta && revisaoPct >= HOR.revisaoAlerta && pendentes > 0,
      topicos,
    };
  }).sort((a, b) => (b.pesoPct - a.pesoPct) || (a.nome < b.nome ? -1 : 1));
  const est = disciplinas.reduce((a, d) => a + d.estudoMin, 0), rev = disciplinas.reduce((a, d) => a + d.revisaoMin, 0);
  const tot = est + rev;
  /* (19.213.0) a fatia do TEMPO de cada disciplina, para comparar com a fatia da PROVA */
  disciplinas.forEach((d) => { d.tempoPct = tot ? (d.totalMin / tot) * 100 : 0; });
  const unidades = disciplinas.reduce((a, d) => a + d.unidades, 0), feitas = disciplinas.reduce((a, d) => a + d.feitas, 0);
  /* O RESUMO DO TOPO: onde o tempo se concentrou além do peso, o que vale prova e não teve hora nenhuma, o que não cabe */
  const concentradas = tot >= HOR.minutosConcentra
    ? disciplinas.filter((d) => d.tempoPct >= d.pesoPct * HOR.concentraFator && d.tempoPct - d.pesoPct >= HOR.concentraPontos) : [];
  return {
    disciplinas,
    total: { estudoMin: est, revisaoMin: rev, totalMin: tot, revisaoPct: tot ? rev / tot : 0, unidades, feitas, coberturaPct: unidades ? (feitas / unidades) * 100 : 0 },
    concentradas,
    semHoras: disciplinas.filter((d) => d.totalMin === 0 && d.pendentes > 0),
    naoCabem: disciplinas.filter((d) => d.naoCabe),
    semMinutos, fora,
  };
}

/* (19.213.0) A FRASE-DIAGNÓSTICO de cada coluna: o que o número quer dizer, em palavras */
function horDiagnostico(d) {
  if (!d.pendentes) return t("hor_dg_tudo");
  if (!d.feitas && !d.estudoTudoMin) return t("hor_dg_nada");
  if (!d.feitas) return t("hor_dg_sem_un", { h: horTexto(d.estudoTudoMin) });
  if (d.ritmoMin !== null) return t("hor_dg_ritmo", { r: horTexto(d.ritmoMin), p: horTexto(d.previstoMin), f: horTexto(d.faltaRitmoMin) });
  return t("hor_dg_plano", { f: horTexto(d.faltaPlanoMin) });
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
 *   a barra = assuntos (ramos) cumpridos ÷ todos · linhas = corte do bloco e corte com folga, na mesma régua
 *   embaixo: as horas (azul = estudo novo, roxo = revisão), a fatia do tempo e a frase-diagnóstico. Clicar abre os tópicos.
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
  return { r, plano, diario, minSemana: (Number($("edHoras").value) || r.cfg.horas || 0) * 60 };
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
    return { desde: d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()), dias: Number(v) };
  }
  return {};
}

function horPintar() {
  const cx = $("horCorpo");
  cx.innerHTML = "";
  const { plano, diario, minSemana } = horDoAberto();
  if (!plano.itens.length) { cx.append(gerEl("p", "nota", t("hor_sem_plano"))); return; }
  const per = horPeriodo();
  const sp = plano.prazo && typeof semanasAte === "function" ? semanasAte(plano.prazo) : null;
  const m = horMapa(plano, diario, Object.assign({ minSemana, diasProva: sp ? sp.dias : null }, per));
  const tt = m.total;
  /* (19.213.0) O RESUMO DIZ A CONCLUSÃO PRIMEIRO: quanto do edital foi cumprido; depois as horas; depois o que pede atenção */
  const res = gerEl("div", "hor-resumo");
  res.append(gerEl("b", "", t("hor_cob_total", { a: tt.feitas, n: tt.unidades, p: Math.round(tt.coberturaPct) })),
    document.createTextNode(" " + t("hor_total", { h: horTexto(tt.totalMin) }) + " " + t("hor_total2", { e: horTexto(tt.estudoMin), r: horTexto(tt.revisaoMin), p: Math.round(tt.revisaoPct * 100) })));
  const avisos = [];
  m.concentradas.forEach((d) => avisos.push(t("hor_res_concentra", { d: d.nome, t: Math.round(d.tempoPct), p: pctProva(d.pesoPct) })));
  if (m.semHoras.length) avisos.push(t("hor_res_sem_horas", { l: m.semHoras.map((d) => d.nome + " (" + pctProva(d.pesoPct) + "%)").join(", ") }));
  if (m.naoCabem.length) avisos.push(t("hor_res_nao_cabe", { l: m.naoCabem.map((d) => d.nome).join(", ") }));
  if (avisos.length) {
    const ul = gerEl("ul", "hor-resumo-av");
    avisos.forEach((a) => ul.append(gerEl("li", "", a)));
    res.append(ul);
  }
  cx.append(res);
  if (m.semMinutos) cx.append(gerEl("p", "nota", t("hor_sem_minutos", { n: m.semMinutos })));
  const leg = gerEl("div", "hor-legenda");
  /* as linhas de corte só entram na legenda quando alguma coluna tem uma (blocos com mínimo no edital) */
  const temCorte = m.disciplinas.some((d) => d.cortePct !== null);
  [["hor-cob", t("hor_leg_cob")]]
    .concat(temCorte ? [["hor-corte", t("hor_leg_corte")], ["hor-seguro", t("hor_leg_seguro")]] : [])
    .concat([["hor-est", t("hor_leg_est")], ["hor-rev", t("hor_leg_rev")]]).forEach(([c, r]) => {
    const it = gerEl("span", "hor-leg"); it.append(gerEl("i", "hor-leg-i " + c), document.createTextNode(" " + r));
    leg.append(it);
  });
  cx.append(leg);
  /* (19.213.0) CADA COLUNA É A COBERTURA: a trilha de altura fixa é a disciplina inteira (100% dos assuntos), o
   * preenchimento é o que já foi cumprido e as linhas de corte estão na mesma régua. A cor diz o estado contra o corte
   * (vermelho abaixo, laranja apertado, verde com folga; sem corte, azul). As HORAS vêm embaixo, como apoio: o total, a
   * fatia do seu tempo e uma tira (azul = estudo novo, roxo = revisão) do tamanho das horas, comparável entre colunas. */
  const graf = gerEl("div", "hor-graf");
  const maxMin = m.disciplinas.reduce((a, d) => Math.max(a, d.totalMin), 0) || 1;
  m.disciplinas.forEach((d) => {
    const col = gerEl("div", "hor-col" + (d.alerta || d.naoCabe ? " hor-col-alerta" : "") + (horDiscAberta === d.nome ? " hor-col-aberta" : ""));
    col.title = d.nome + " — " + t("hor_tip_col", { a: d.feitas, n: d.unidades, c: Math.round(d.coberturaPct), e: horTexto(d.estudoMin), r: horTexto(d.revisaoMin) })
      + (d.cortePct !== null ? " — " + t("hor_tip_corte", { p: d.cortePct }) : "");
    const topo = gerEl("div", "hor-topo");
    topo.append(gerEl("b", "", Math.round(d.coberturaPct) + "%"), gerEl("span", "hor-topo-de", t("hor_un", { a: d.feitas, n: d.unidades })));
    col.append(topo);
    const area = gerEl("div", "hor-area");
    area.style.height = HOR_ALTURA + "px";
    const cob = gerEl("div", "hor-cob" + (d.estado ? " hor-cob-" + d.estado : ""));
    cob.style.height = Math.min(100, d.coberturaPct).toFixed(2) + "%";
    area.append(cob);
    if (d.cortePct !== null) {
      const c = gerEl("div", "hor-corte" + (d.estado === "abaixo" ? " hor-corte-risco" : "")); c.style.bottom = d.cortePct.toFixed(2) + "%"; area.append(c);
      const s = gerEl("div", "hor-seguro"); s.style.bottom = d.seguroPct.toFixed(2) + "%"; area.append(s);
    }
    col.append(area);
    /* as horas: no período, contra a meta do período; sem período, a fatia do seu tempo */
    col.append(gerEl("div", "hor-horas", d.periodo
      ? t("hor_horas_periodo", { h: horTexto(d.totalMin), p: horTexto(d.planejadoMin), d: per.dias })
      : t("hor_horas", { h: horTexto(d.totalMin), p: Math.round(d.tempoPct) })));
    const tira = gerEl("div", "hor-tira");
    const tiraIn = gerEl("div", "hor-tira-in"); tiraIn.style.width = ((d.totalMin / maxMin) * 100).toFixed(2) + "%";
    const te = gerEl("div", "hor-est"), tr = gerEl("div", "hor-rev");
    te.style.width = (d.totalMin ? (d.estudoMin / d.totalMin) * 100 : 0).toFixed(2) + "%";
    tr.style.width = (d.totalMin ? (d.revisaoMin / d.totalMin) * 100 : 0).toFixed(2) + "%";
    tiraIn.append(te, tr); tira.append(tiraIn);
    col.append(tira, gerEl("div", "hor-diag", horDiagnostico(d)));
    col.append(gerEl("div", "hor-nome", d.nome), gerEl("div", "hor-pesop", t("cov_vale", { p: pctProva(d.pesoPct) })));
    /* o alerta ocupa SEMPRE a mesma linha (vazia quando não há), para as colunas terminarem alinhadas */
    const al = [];
    if (d.naoCabe) al.push("⚠ " + t("hor_alerta_cabe"));
    if (d.alerta) al.push("⚠ " + t("hor_alerta", { p: Math.round(d.revisaoPct * 100) }));
    col.append(gerEl("div", "hor-alerta", al.join(" · ")));
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
    linha1.append(gerEl("span", "", d.nome), gerEl("span", "hor-drow-peso", t("cov_vale", { p: pctProva(d.pesoPct) })));
    meio.append(linha1);
    /* (19.213.0) o trilho da linha é a mesma cobertura da coluna (não mais as horas contra o planejado) */
    const trilho = gerEl("div", "hor-drow-trilho");
    const cobL = gerEl("div", "hor-cob" + (d.estado ? " hor-cob-" + d.estado : ""));
    cobL.style.width = Math.min(100, d.coberturaPct).toFixed(2) + "%";
    trilho.append(cobL);
    meio.append(trilho, gerEl("div", "hor-un", t("hor_un", { a: d.feitas, n: d.unidades }) + " · " + horTexto(d.totalMin)));
    cab.append(meio);
    row.append(cab);
    cab.onclick = () => horAbrirDisc(d.nome);
    if (aberta) {
      const det = gerEl("div", "hor-det");
      const ac = gerEl("div", "hor-acoes");
      const vc = gerEl("button", "btn-min", t("hor_ver_cobertura")); vc.type = "button";
      vc.onclick = () => { horFechar(); covAbrir(editalAtual, d.nome); };
      ac.append(vc);
      det.append(ac);
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
        /* os mesmos 5 materiais e o mesmo "⋮" da Agenda da semana (edRecursosDoTopico/edMontarStatusEMenu, em
         * edital-ui.js) — abrir qualquer um deles fecha esta janela primeiro, como o botão único fazia antes. */
        const r = edRecursosDoTopico(d.nome, tp.nome);
        ["doc", "crt", "lei", "jur", "qst"].forEach((k) => {
          const orig = r[k].onclick;
          r[k].onclick = (ev) => { horFechar(); orig(ev); };
        });
        const { status, estudar, mais } = edMontarStatusEMenu(tl, d.nome, tp.nome, tp.ramos, editalAtual, r);
        const origEstudar = estudar.onclick;
        estudar.onclick = (ev) => { horFechar(); origEstudar(ev); };
        tl.append(estudar, mais);
        if (status.children.length) tl.append(status);
        det.append(tl);
        if (temRamos && ramosAbertos) tp.ramos.forEach((r) => {
          const nivR = tp.nivelRamos.get(r.id) || tp.nivel;
          const rl = gerEl("div", "hor-ramo hor-niv-" + nivR + (r.pulado ? " hor-ramo-pulado" : ""));
          rl.append(gerEl("span", "hor-top-nome", (r.revisado ? "↻ " : (r.feito ? "✓ " : "○ ")) + r.nome), gerEl("span", "hor-top-h", t("hor_ramo_h", { e: horTexto(r.estudoMin), r: horTexto(r.revisaoMin) })));
          /* os materiais DESTE ramo: abre a ficha do tópico já no ramo (a mesma porta da Agenda da semana) */
          const rmais = gerEl("button", "btn-min ed-materiais", t("ed_materiais_ramo_btn")); rmais.type = "button";
          edLigarMenuDoRamo(rmais, rl, d.nome, tp.nome, r, null, { ramos: tp.ramos, editalId: editalAtual });
          rl.append(rmais);
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

/* (19.103.0) TELA CHEIA, como o Domínio: a janela ocupa a tela toda e pede a tela cheia ao navegador; a escolha é lembrada
 * (padrão: tela cheia). Era "ver maior" (só mais largura). */
const HOR_CH_CHEIA = "eac_hor_cheia";
let horCheia = false;
function horCheiaPreferida() { try { return localStorage.getItem(HOR_CH_CHEIA) !== "0"; } catch (e) { return true; } }
function horCheiaTrocar(sim, lembrar) {
  horCheia = sim === undefined ? !horCheia : !!sim;
  const dlg = $("dlgHoras");
  if (dlg) dlg.classList.toggle("hor-cheia", horCheia);
  const b = $("btnHorGrande");
  if (b) { b.textContent = t(horCheia ? "dom_cheia_sair" : "dom_cheia"); b.title = t("hor_cheia_tip"); b.setAttribute("aria-pressed", horCheia ? "true" : "false"); }
  if (horCheia) { if (typeof telaCheiaPedir === "function") telaCheiaPedir("horas", () => { if (horCheia) horCheiaTrocar(false, false); }); }
  else if (typeof telaCheiaSair === "function") telaCheiaSair("horas");
  if (lembrar) { try { localStorage.setItem(HOR_CH_CHEIA, horCheia ? "1" : "0"); } catch (e) {} }
  return horCheia;
}
function horTrocarGrande() { return horCheiaTrocar(undefined, true); }

/* (19.103.0) fechar as horas para abrir outra coisa deixa a volta armada: ao fechar o que foi aberto, volta igual */
function horFechar() {
  const c = $("horCorpo");
  const y = c ? c.scrollTop : 0;
  painelArmar("dlgHoras", t("hor_titulo"), () => {
    horAbrir({ manter: true });
    const c2 = $("horCorpo");
    if (c2) c2.scrollTop = y;
  });
}

function horAbrir(opc) {
  const manter = !!(opc && opc.manter);
  if (!manter) {
    horDiscAberta = ""; horBusca = ""; horFiltro = "tudo"; horRamosFechados = new Set();
    if (typeof voltarLimpar === "function") voltarLimpar("dlgHoras");
  }
  horPintar();
  dicasDosBotoes({ btnEdHoras: "hor_tip_abrir", btnHorX: "hor_tip_x", horPeriodo: "hor_tip_periodo" });
  abrirModal("dlgHoras");
  horCheiaTrocar(horCheiaPreferida(), false);
}

if (typeof document !== "undefined" && $("dlgHoras")) {
  $("btnEdHoras").onclick = () => horAbrir();
  $("btnHorX").onclick = () => $("dlgHoras").close();
  $("btnHorGrande").onclick = horTrocarGrande;
  $("horPeriodo").onchange = horPintar;
  if ($("dlgHoras").addEventListener) $("dlgHoras").addEventListener("close", () => { if (horCheia) { horCheia = false; $("dlgHoras").classList.remove("hor-cheia"); if (typeof telaCheiaSair === "function") telaCheiaSair("horas"); } });
}
