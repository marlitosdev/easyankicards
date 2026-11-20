/* =====================================================================
 * (19.180.0) 🖨 IMPRIMIR O MAPA — ou salvar em PDF (a opção "Salvar como PDF" da própria janela de impressão)
 *
 * Para revisar fora do app: no papel, no tablet, no ônibus. A folha é o mapa como está à vista, só que inteiro:
 *  · TUDO ABERTO (o recolhido é coisa da tela), mas respeitando o que você escolheu ver: "só palavras-chave" sai sem os
 *    detalhes e sem as notas; com um filtro ligado (só grifados, só os que não lembrei, a corrigir), sai só o filtrado;
 *  · cada ramo de primeiro nível com a sua cor (a mesma da tela), as suas marcas (❗ ❓ § 🎯 ⚠ 📝 🖍), o peso do edital e
 *    os avisos que importam no papel: ✗ errado, ? duvidoso, ✏ a corrigir, ⚠ não está no resumo, 🔁 não lembrei —
 *    ninguém deve decorar no papel o que já sabe que está errado;
 *  · o mapa do resumo ou o da IA: o que estiver à vista;
 *  · na véspera (Revisão 360°), "🖨 imprimir todos" junta os mapas dos tópicos do plano, um por página.
 * A folha vai para #mmImpressao e o CSS de impressão esconde todo o resto (o mesmo caminho do edital verticalizado).
 * ===================================================================== */
const MMP_ICO = { importante: "❗", duvida: "❓", lei: "§", prova: "🎯", pegadinha: "⚠", nota: "📝", destaque: "🖍" };

/* a folha de um mapa. o = { titulo, disciplina, ia, compacto, vis (Set de caminhos | null), cur ({caminho: {v}}),
 * treino ({caminho: {v}}), pend (no → ponto | null), filtro (o nome do filtro, para o cabeçalho) } */
function mmFolhaEl(arv, o) {
  const op = o || {};
  const folha = document.createElement("section");
  folha.className = "mmp-folha" + (op.compacto ? " mmp-compacto" : "");
  const h = document.createElement("h2");
  h.className = "mmp-tit";
  h.textContent = "🗺 " + (op.titulo || arv.raiz.label || "");
  folha.append(h);
  const sub = document.createElement("p");
  sub.className = "mmp-sub";
  const hoje = new Date();
  const data = String(hoje.getDate()).padStart(2, "0") + "/" + String(hoje.getMonth() + 1).padStart(2, "0") + "/" + hoje.getFullYear();
  sub.textContent = [op.disciplina, t(op.ia ? "mmp_fonte_ia" : "mmp_fonte_texto"), t("mmp_galhos", { n: arv.nos }),
    op.compacto ? t("mmp_compacto") : "", op.filtro ? t("mmp_filtro", { f: op.filtro }) : "", t("mmp_impresso", { d: data })].filter(Boolean).join(" · ");
  folha.append(sub);
  const usados = {};
  const ul = document.createElement("ul");
  ul.className = "mmp-arv";
  const ir = (no, pai) => {
    if (op.vis && !op.vis.has(no.caminho)) return null;
    if (op.compacto && no.nota) return null;
    const li = document.createElement("li");
    li.className = "mmp-no" + (no.cor != null ? " mmp-cor-" + no.cor : "") + (no.titulo || no.ramo ? " mmp-tit-no" : "") + (no.nota ? " mmp-nota" : "") + (no.dica ? " mmp-dica" : "")
      + (/…$/.test(no.label) && no.det ? " mmp-frase" : "");
    const rot = document.createElement("span");
    rot.className = "mmp-rot";
    /* o nome comprido que a tela cortou ("…") continua direto no resto do texto: no papel, a frase vai inteira */
    const cortado = /…$/.test(no.label) && no.det;
    rot.textContent = (no.nota ? "📝 " : no.dica ? "💡 " : "") + (cortado ? no.label.replace(/…$/, "") + " " + (op.compacto && !no.nota ? "…" : no.det) : no.label);
    li.append(rot);
    const sinais = [];
    no.marcas.forEach((m) => { if (MMP_ICO[m]) { sinais.push(MMP_ICO[m]); usados[m] = 1; } });
    if (no.sem === "peg" && sinais.indexOf("⚠") < 0) sinais.push("⚠");
    if (no.sem === "prova" && sinais.indexOf("🎯") < 0) sinais.push("🎯");
    if (sinais.length) { const s = document.createElement("span"); s.className = "mmp-sinais"; s.textContent = " " + sinais.join(" "); li.append(s); }
    if (no.peso >= 4) { const s = document.createElement("span"); s.className = "mmp-selo"; s.textContent = t("mm_peso", { p: no.peso }); li.append(s); }
    const avisos = [];
    const c = op.cur && op.cur[no.caminho];
    if (c && c.v === "errado") avisos.push(t("mmq_selo_errado"));
    if (c && c.v === "duvida") avisos.push(t("mmq_selo_duvida"));
    if (op.pend && op.pend(no)) avisos.push(t("mmq_selo_corrigir"));
    if (no.foraDoResumo) avisos.push(t("mm_ia_fora"));
    else if (no.numFora) avisos.push(t("mm_ia_num"));
    const tr = op.treino && op.treino[no.caminho];
    if (tr && tr.v === "n") avisos.push(t("mmp_nao_lembrei"));
    avisos.forEach((a) => { const s = document.createElement("span"); s.className = "mmp-selo mmp-aviso"; s.textContent = a; li.append(s); });
    if (no.det && !no.nota && !op.compacto && !cortado) { const d = document.createElement("span"); d.className = "mmp-det"; d.textContent = " — " + no.det; li.append(d); }
    const filhos = no.filhos.map((f) => ir(f, no)).filter(Boolean);
    if (filhos.length) { const sub2 = document.createElement("ul"); filhos.forEach((x) => sub2.append(x)); li.append(sub2); }
    return li;
  };
  arv.raiz.filhos.forEach((f) => { const x = ir(f, arv.raiz); if (x) ul.append(x); });
  folha.append(ul);
  /* a legenda: só os sinais que aparecem nesta folha */
  const leg = Object.keys(usados).map((m) => MMP_ICO[m] + " " + t("mm_marca_" + m));
  if (leg.length) { const l = document.createElement("p"); l.className = "mmp-leg"; l.textContent = t("mmp_legenda") + " " + leg.join(" · "); folha.append(l); }
  return folha;
}

/* imprimir as folhas: #mmImpressao recebe, o corpo entra no modo impressão, e depois tudo volta */
function mmImprimirFolhas(folhas) {
  const alvo = typeof document !== "undefined" ? document.getElementById("mmImpressao") : null;
  if (!alvo || !folhas.length) return false;
  alvo.innerHTML = "";
  folhas.forEach((f) => alvo.append(f));
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
/* O MAPA À VISTA, como está (vista compacta, filtro, mapa do resumo ou da IA) */
function mmImprimirAtual() {
  const arv = mmUltimo && mmUltimo.arvore;
  if (!arv || !arv.nos) return false;
  const nomes = { grifos: "mm_f_grifos", esqueci: "mm_f_esqueci", corrigir: "mm_f_corrigir" };
  const folha = mmFolhaEl(arv, {
    titulo: (matAtual && (matAtual.topico || matAtual.nome)) || arv.raiz.label,
    disciplina: (matAtual && matAtual.disciplina) || "",
    ia: !!arv.ia, compacto: mmCompacto, vis: mmVis,
    filtro: mmFiltro && nomes[mmFiltro] ? t(nomes[mmFiltro], { n: "" }).replace(/\s*\(\)\s*$/, "") : "",
    cur: typeof mmCurDoMapa === "function" ? mmCurDoMapa() : null,
    treino: mmResultados(),
    pend: typeof mmQualPendenteDe === "function" ? (no) => mmQualPendenteDe(no) : null,
  });
  try { matReg("ler", "mapa: imprimir", mmChaveResumo() + " · " + arv.nos + " galhos" + (mmFiltro ? " · filtro " + mmFiltro : "") + (mmCompacto ? " · compacto" : "")); } catch (e) {}
  return mmImprimirFolhas([folha]);
}
/* o mapa de um tópico sem abri-lo (para imprimir vários): o da IA se for o preferido e existir; senão, o do texto */
function mmArvoreDoTopico(chave) {
  const r = typeof matObter === "function" ? matObter(chave) : null;
  if (!r) return null;
  const texto = String(r.texto || "");
  const titulo = r.topico || "";
  const g = typeof mmIaGuardado === "function" ? mmIaGuardado(chave) : null;
  if (g && typeof mmFonte !== "undefined" && mmFonte === "ia" && typeof mmIaMontar === "function") return { arv: mmIaMontar(g.texto, texto, titulo), ia: true, r };
  let ramos = [];
  try { if (typeof matIndiceRamos === "function") ramos = matIndiceRamos().get(matChaveNormal(chave)) || []; } catch (e) { ramos = []; }
  return { arv: mmMontar(texto, { titulo, ramos }), ia: false, r };
}
/* VÁRIOS MAPAS (a véspera): [{ disciplina, topico, chave }] → uma folha por tópico, cada uma na sua página */
function mmImprimirVarios(lista) {
  const cur = typeof mmCurLer === "function" ? mmCurLer() : {};
  const tre = typeof mmTreinoLer === "function" ? mmTreinoLer() : {};
  const folhas = [];
  (lista || []).forEach((x) => {
    const m = x && x.chave ? mmArvoreDoTopico(x.chave) : null;
    if (!m || m.arv.nos < 3) return;
    const k = x.chave + (m.ia ? "|ia" : "");
    folhas.push(mmFolhaEl(m.arv, { titulo: x.topico || m.r.topico, disciplina: x.disciplina || m.r.disciplina, ia: m.ia, compacto: mmCompacto, cur: cur[k] || null, treino: tre[k] || null }));
  });
  try { matReg("ler", "mapa: imprimir vários", folhas.length + " mapa(s)"); } catch (e) {}
  return mmImprimirFolhas(folhas) ? folhas.length : 0;
}
