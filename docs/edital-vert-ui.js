/* =====================================================================
 * EDITAL VERTICALIZADO — a TELA e a impressão.
 *
 * O motor (edital-vert.js) decide o que entra e em que ordem; aqui se desenha a folha — uma faixa
 * preta por disciplina e, abaixo, a tabela Nº | CONTEÚDO | TEORIA | QUESTÕES | ACERTOS | REV. 1 | REV. 2 —
 * e se manda imprimir. O PDF é o do próprio navegador ("Salvar como PDF" na janela de impressão):
 * funciona offline e sem biblioteca. A mesma função desenha a prévia (dentro do diálogo) e a folha
 * de impressão (#edVertImpressao, filha direta do body, que o CSS de impressão deixa sozinha na página).
 * ===================================================================== */

const EV_CH = "eac_vert_opc";
const EV_PADRAO = { ordem: "peso", ramos: true, motivo: false, progresso: false, faixa: true, soFase2: false };

function evOpcSalvas() {
  try { return Object.assign({}, EV_PADRAO, JSON.parse(localStorage.getItem(EV_CH) || "{}")); } catch (e) { return Object.assign({}, EV_PADRAO); }
}

/* as opções como estão na tela (e guardadas para a próxima vez) */
function evLerOpc() {
  const op = {
    ordem: $("evOrdem").value === "edital" ? "edital" : "peso",
    ramos: $("evRamos").checked, motivo: $("evMotivo").checked, progresso: $("evProgresso").checked,
    faixa: $("evFaixa").checked, soFase2: !$("evFase2Cx").hidden && $("evFase2").checked,
  };
  try { localStorage.setItem(EV_CH, JSON.stringify({ ordem: op.ordem, ramos: op.ramos, motivo: op.motivo, progresso: op.progresso, faixa: op.faixa, soFase2: $("evFase2").checked })); } catch (e) {}
  return op;
}

/* o edital ABERTO (o texto da bancada) já verticalizado com as opções dadas */
function evMontar(op) {
  const r = lerEdital(($("editalTexto") || {}).value || "");
  const v = edVerticalizar(r, {
    ordem: op.ordem, ramos: op.ramos, motivo: op.motivo, soFase2: op.soFase2,
    marcaDe: op.progresso ? (c) => (typeof edProgresso !== "undefined" && edProgresso[c]) || null : null,
  });
  const ab = typeof edAberto === "function" ? edAberto() : null;
  if (!v.titulo && ab) v.titulo = ab.nome || "";
  return v;
}

function evData(iso) {
  const p = String(iso || "").split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
}

function evMinimoTexto(m) {
  if (!m) return "";
  return t("vert_minimo", { m: m.tipo === "pct" ? m.valor + "%" : t("vert_minimo_abs", { n: m.valor }) });
}

/* o texto à direita da faixa preta: o grupo (e o mínimo dele) e, se pedido, o tamanho da disciplina na prova */
function evTagDaFaixa(d, op, exata) {
  const partes = [];
  if (d.grupo) partes.push(d.grupo + (d.minimo ? " (" + evMinimoTexto(d.minimo) + ")" : ""));
  if (op.faixa) {
    /* A FATIA VEM ANTES DO PESO. "peso 3 · 2% da prova" era lido (por quem extrai o texto do PDF) como "32%": o último dígito
     * do peso colava no primeiro da fatia. Com a fatia primeiro e o peso dito "de 5", os dois números nunca ficam lado a lado.
     * E a fatia sem número de questões é ESTIMADA (peso × peso do tópico) — a folha diz isso. */
    if (d.abs) partes.push(t(d.unidade === "p" ? "vert_pontos" : "vert_questoes", { n: d.abs }));
    if (d.fatia != null) partes.push(t(exata ? "vert_fatia" : "vert_fatia_est", { n: d.fatia }));
    if (!d.abs) partes.push(t("vert_peso", { n: d.peso }));
  }
  return partes.join(" · ");
}

/* desenha a folha inteira dentro de `destino` */
function evFolha(v, op, destino) {
  destino.innerHTML = "";
  const folha = gerEl("div", "ev-folha");
  const cab = gerEl("div", "ev-cab");
  cab.append(gerEl("h1", "ev-tit", v.titulo || t("vert_sem_titulo")));
  const sub = [t("vert_edital")];
  if (v.prova) sub.push(t("vert_prova", { d: evData(v.prova) }));
  sub.push(t(v.ordem === "peso" ? "vert_ordem_peso" : "vert_ordem_edital"));
  if (v.soFase2) sub.push(t("vert_so_fase2"));
  sub.push(t("vert_resumo", { d: v.resumo.disciplinas, t: v.resumo.topicos, r: v.resumo.ramos }));
  /* o edital tem 2ª fase: a data dela e a legenda da marca (só quando a folha mostra todos os tópicos) */
  const f2 = v.fase2 && v.fase2.prova ? v.fase2 : null;
  if (f2) sub.push(t("vert_fase2_info", { nome: f2.nome || t("vert_f2_marca"), d: evData(f2.prova) }));
  if (f2 && !v.soFase2) sub.push(t("vert_f2_legenda"));
  cab.append(gerEl("div", "ev-sub", sub.join(" · ")));
  folha.append(cab);

  v.disciplinas.forEach((d) => {
    const sec = gerEl("section", "ev-disc");
    const faixa = gerEl("div", "ev-faixa");
    faixa.append(gerEl("span", "ev-faixa-nome", d.nome), gerEl("span", "ev-faixa-tag", evTagDaFaixa(d, op, v.exata)));
    sec.append(faixa);
    const tab = gerEl("table", "ev-tab");
    const cabTr = gerEl("tr", "");
    [["ev-n", "vert_col_n"], ["ev-c", "vert_col_conteudo"], ["ev-k", "vert_col_teoria"], ["ev-k", "vert_col_questoes"],
      ["ev-k", "vert_col_acertos"], ["ev-k", "vert_col_rev1"], ["ev-k", "vert_col_rev2"]].forEach(([c, k]) => cabTr.append(gerEl("th", c, t(k))));
    const thead = gerEl("thead", ""); thead.append(cabTr);
    const tbody = gerEl("tbody", "");
    d.linhas.forEach((l) => {
      const tr = gerEl("tr", "ev-lin" + (l.pai ? " ev-pai" : "") + (l.nivel ? " ev-ramo" : "") + (l.pulado ? " ev-pulado" : ""));
      tr.append(gerEl("td", "ev-n", l.num));
      const c = gerEl("td", "ev-c", l.texto);
      if (l.motivo) c.append(gerEl("span", "ev-motivo", l.motivo));
      if (f2 && !v.soFase2 && l.fase2) c.append(gerEl("span", "ev-f2", t("vert_f2_marca")));
      tr.append(c);
      /* teoria, questões, acertos (em branco), rev. 1, rev. 2 */
      [l.teoria, false, null, l.rev1, l.rev2].forEach((marca) => {
        const td = gerEl("td", "ev-k");
        if (marca !== null) td.append(gerEl("span", "ev-cx" + (marca ? " ev-cx-ok" : ""), marca ? "✓" : ""));
        if (l.pulado) td.textContent = "—";
        tr.append(td);
      });
      tbody.append(tr);
    });
    tab.append(thead, tbody);
    sec.append(tab);
    folha.append(sec);
  });
  folha.append(gerEl("div", "ev-rodape", t("vert_gerado", { d: new Date().toLocaleDateString() })));
  destino.append(folha);
}

function evPintar() {
  const op = evLerOpc();
  const v = evMontar(op);
  /* "só a 2ª fase" só existe se o edital tiver tópico marcado para ela */
  const tem2 = (lerEdital(($("editalTexto") || {}).value || "").disciplinas || []).some((d) => d.topicos.some((x) => x.fase2));
  $("evFase2Cx").hidden = !tem2;
  const vazio = !v.disciplinas.length;
  $("evResumo").textContent = vazio ? t("vert_vazio") : t("vert_resumo", { d: v.resumo.disciplinas, t: v.resumo.topicos, r: v.resumo.ramos });
  $("btnEdVertImprimir").disabled = vazio;
  evFolha(v, op, $("evPrevia"));
  return v;
}

function evAbrir() {
  const s = evOpcSalvas();
  $("evOrdem").value = s.ordem; $("evRamos").checked = !!s.ramos; $("evMotivo").checked = !!s.motivo;
  $("evProgresso").checked = !!s.progresso; $("evFaixa").checked = !!s.faixa; $("evFase2").checked = !!s.soFase2;
  evPintar();
  dicasDosBotoes({ btnEdVert: "vert_tip_abrir", btnEdVertImprimir: "vert_tip_imprimir", btnEdVertX: "cov_tip_x", evOrdem: "vert_tip_ordem",
    evRamos: "vert_tip_ramos", evMotivo: "vert_tip_motivo", evProgresso: "vert_tip_progresso", evFaixa: "vert_tip_faixa", evFase2: "vert_tip_fase2" });
  abrirModal("dlgEdVert");
}

/* a folha vai para #edVertImpressao e o CSS de impressão esconde todo o resto; depois da impressão, tudo volta */
function evImprimir() {
  const op = evLerOpc();
  const v = evMontar(op);
  if (!v.disciplinas.length) return false;
  const alvo = $("edVertImpressao");
  evFolha(v, op, alvo);
  document.body.classList.add("eac-imprimindo");
  const fim = () => {
    document.body.classList.remove("eac-imprimindo");
    alvo.innerHTML = "";
    if (typeof window.removeEventListener === "function") window.removeEventListener("afterprint", fim);
  };
  if (typeof window.addEventListener === "function") window.addEventListener("afterprint", fim);
  if (typeof window.print === "function") window.print(); else fim();
  return true;
}

if (typeof document !== "undefined" && $("dlgEdVert")) {
  $("btnEdVert").onclick = evAbrir;
  $("btnEdVertX").onclick = () => $("dlgEdVert").close();
  $("btnEdVertFechar").onclick = () => $("dlgEdVert").close();
  ["evOrdem", "evRamos", "evMotivo", "evProgresso", "evFaixa", "evFase2"].forEach((id) => { $(id).onchange = evPintar; });
  $("btnEdVertImprimir").onclick = evImprimir;
}
