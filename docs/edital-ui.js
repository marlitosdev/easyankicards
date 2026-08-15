/* =====================================================================
 * A TELA DO EDITAL
 * Espelha a bancada de cartões de propósito: mesma caixa com números de
 * linha, mesmos botões de topo, mesma lista de sugestões com quem corrige
 * o quê, mesmo registro. Quem aprendeu um lado já sabe usar o outro.
 * ===================================================================== */

let edProgresso = {};      /* nome do tópico -> true */
let edCorrecaoPendente = null;

function edSalvar() {
  try {
    localStorage.setItem("eac_edital_texto", $("editalTexto").value);
    localStorage.setItem("eac_edital_progresso", JSON.stringify(edProgresso));
  } catch (e) {}
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

function edRender() {
  const raw = $("editalTexto").value;
  const r = lerEdital(raw);
  edRegistrarConteudo(r);
  edNumeros(raw.split("\n").length);
  edSugestoes(r);

  /* config: os campos de data e horas mandam no texto, e vice-versa */
  if (r.cfg.prova && $("edProva").value !== r.cfg.prova) $("edProva").value = r.cfg.prova;
  if (r.cfg.horas && Number($("edHoras").value) !== r.cfg.horas) $("edHoras").value = r.cfg.horas;

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
                       p: Math.round((plano.feitos / plano.total) * 100) })
    : "";

  /* "Não cabe" dito com todas as letras. O modelo antigo espalhava minutos
   * até dar a soma certa e o usuário só descobria a impossibilidade quando
   * já tinha perdido semanas seguindo um plano que não fechava. */
  const av = $("edNaoCabe");
  if (plano.fora.length) {
    av.hidden = false;
    av.textContent = t("ed_nao_cabe", {
      cabem: plano.fila.length, fora: plano.fora.length,
      s: plano.semanas, h: plano.horasNecessarias,
    });
  } else av.hidden = true;

  const tb = $("edTabela");
  tb.innerHTML = "";
  if (!itens.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5; td.className = "esq-vazio"; td.textContent = t("ed_vazio");
    tr.append(td); tb.append(tr); edSalvar(); return;
  }
  itens.forEach((i) => {
    const tr = document.createElement("tr");
    const feito = !!i.feito;
    if (feito) tr.className = "ed-feito";
    const cel = (txt, cls) => {
      const td = document.createElement("td");
      td.textContent = txt; if (cls) td.className = cls; return td;
    };
    const tdNome = cel(i.nome);
    if (i.motivo) { tdNome.title = i.motivo; tdNome.classList.add("ed-tem-motivo"); }
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
  try { edProgresso = JSON.parse(localStorage.getItem("eac_edital_progresso") || "{}"); }
  catch (e) { edProgresso = {}; }

  $("editalTexto").addEventListener("input", edRender);
  $("editalTexto").addEventListener("scroll", () => {
    $("editalNums").scrollTop = $("editalTexto").scrollTop;
  });
  $("edProva").onchange = edRender;
  $("edHoras").onchange = edRender;
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
