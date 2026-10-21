/* =====================================================================
 * BIBLIOTECA DE JULGADOS (v18.96.0): tela cheia, filtros por assunto e etiqueta, etiquetas à vista e o estudo refeito
 *
 * O QUE PRECISA SER VERDADE:
 *  1. filtrar pela disciplina inteira, por um tópico e por uma etiqueta — e só aparecem as opções que existem;
 *  2. a etiqueta na lista é um botão: tocar filtra, tocar de novo tira o filtro;
 *  3. a biblioteca abre em tela cheia (padrão), o botão volta à janela e a escolha é lembrada;
 *  4. o estudo: a frente tem o selo e os dados que não entregam a tese (sem etiquetas); o verso traz tese, resumo,
 *     etiquetas, precedentes, fonte, ementa recolhida e a página oficial; teclado ← → e espaço;
 *  5. ✏️ Editar abre o julgado no formulário e, ao fechar a gaveta, volta ao mesmo ponto do estudo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const e = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Direito Tributário :: 5", "+ Imunidades :: 4", "+ Crédito tributário :: 5", "@ Direito Administrativo :: 3", "+ Licitações :: 3"].join(NL));
    a.hubAbrirEdital(e.id);
    const ch = (d, t2) => a.matChave(d, t2);
    const liga = (j, d, t2) => { a.jurLigar(j.id, ch(d, t2), d, t2); return a.jurDe(j.id); };
    const j1 = liga(a.jurGravar({ tribunal: "STF", classe: "Súmula Vinculante", numero: "52", tese: "Tese da imunidade do IPTU.", resumo: "Resumo 1.", tags: ["imunidade", "IPTU"], data: "2015-06-18", orgao: "Tribunal Pleno", precedentes: "RE 385.091", texto: "EMENTA longa." }), "Direito Tributário", "Imunidades");
    const j2 = liga(a.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "436", tese: "Tese do crédito.", tags: ["crédito tributário"] }), "Direito Tributário", "Crédito tributário");
    const j3 = liga(a.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "1234567", tese: "Tese de licitação.", tags: ["imunidade"] }), "Direito Administrativo", "Licitações");
    return { a, j1, j2, j3 };
  };

  /* ---- 1 e 2: filtros e etiquetas ---- */
  {
    const { a, j1, j2, j3 } = montar();
    a.jurBibAbrir();
    const opsA = a.$("jurBibAssunto").querySelectorAll("option").map((o) => o.value + "=" + o.textContent);
    ok(opsA.length === 1 + 2 + 3 && opsA.some((x) => /^d:direito tributario=/.test(x)) && opsA.some((x) => /Imunidades \(1\)/.test(x)), "B1 o assunto lista as disciplinas (todos os tópicos) e cada tópico, com quantos: " + opsA.join(" | "));
    a.$("jurBibAssunto").value = "d:direito tributario"; a.$("jurBibAssunto").onchange();
    ok(a.jurBibFiltrados().map((j) => j.id).sort().join() === [j1.id, j2.id].sort().join(), "B1a a disciplina inteira");
    const tCred = a.$("jurBibAssunto").querySelectorAll("option").find((o) => /Crédito tributário/.test(o.textContent)).value;
    a.$("jurBibAssunto").value = tCred; a.$("jurBibAssunto").onchange();
    ok(a.jurBibFiltrados().map((j) => j.id).join() === j2.id, "B1b um tópico só");
    a.$("jurBibAssunto").value = ""; a.$("jurBibAssunto").onchange();
    const opsT = a.$("jurBibTag").querySelectorAll("option").map((o) => o.textContent);
    ok(opsT[0] === a.t("jur_bib_tag_todas") && opsT.indexOf("#imunidade (2)") >= 0 && opsT.indexOf("#crédito tributário (1)") >= 0, "B1c as etiquetas que existem, com quantos: " + opsT.join(" | "));
    a.$("jurBibTag").value = "imunidade"; a.$("jurBibTag").onchange();
    ok(a.jurBibFiltrados().map((j) => j.id).sort().join() === [j1.id, j3.id].sort().join(), "B1d pela etiqueta (de disciplinas diferentes)");
    a.$("jurBibTag").value = ""; a.$("jurBibTag").onchange();
    /* a etiqueta na lista vira filtro */
    const chip = a.$("jurBibLista").querySelectorAll(".jur-tag-chip").find((b) => b.textContent === "#IPTU");
    ok(chip, "B2 a etiqueta aparece na lista da biblioteca");
    chip.onclick();
    ok(a.jurBibFiltrados().map((j) => j.id).join() === j1.id && a.$("jurBibTag").value === "iptu", "B2a tocar na etiqueta filtra (e o seletor acompanha)");
    a.$("jurBibLista").querySelectorAll(".jur-tag-chip").find((b) => b.textContent === "#IPTU").onclick();
    ok(a.jurBibFiltrados().length === 3, "B2b tocar de novo tira o filtro");
  }

  /* ---- 3: tela cheia ---- */
  {
    const { a } = montar();
    a.jurBibAbrir();
    ok(a.jurBibCheiaAtual() === true && a.$("dlgJurBib").classList.contains("jur-bib-cheia") && a.$("btnJurBibCheia").textContent === a.t("dom_cheia_sair"), "B3 abre em tela cheia (padrão)");
    a.$("btnJurBibCheia").onclick();
    ok(a.jurBibCheiaAtual() === false && !a.$("dlgJurBib").classList.contains("jur-bib-cheia") && a.lojaLer("eac_jur_bib_cheia") === "0", "B3a o botão volta à janela e lembra");
    a.$("dlgJurBib").close();
    a.jurBibAbrir();
    ok(a.jurBibCheiaAtual() === false, "B3b reabre como ficou");
  }

  /* ---- 4 e 5: o estudo ---- */
  {
    const { a, j1 } = montar();
    a.jurBibAbrir();
    a.$("jurBibTag").value = "iptu"; a.$("jurBibTag").onchange();
    a.$("btnJurBibEstudar").onclick();
    const cab = a.$("jurBibEstCab").textContent, meta = a.$("jurBibEstMeta").textContent;
    ok(/A conferir|Conferido|Oficial|Problema/.test(cab) && /STF/.test(cab) && /18\/06\/2015/.test(meta) && /Tribunal Pleno/.test(meta), "B4 a frente: selo, tribunal, data e órgão: " + cab + " | " + meta);
    ok(a.$("jurBibEstPistas").textContent === "Imunidades" && a.$("jurBibEstVerso").hidden === true && a.$("jurBibEstTese").hidden === true, "B4a sem etiquetas na frente (entregariam a tese); verso e tese escondidos");
    ok(a.$("jurBibEstProg").value === 100, "B4b a barra mostra a posição no estudo");
    a.$("btnJurBibEstVer").onclick();
    const vs = a.$("jurBibEstVerso").textContent;
    ok(a.$("jurBibEstTese").textContent === "Tese da imunidade do IPTU." && /Resumo 1\./.test(vs) && /#imunidade/.test(vs) && /RE 385\.091/.test(vs) && a.$("jurBibEstVerso").querySelectorAll("details").length === 1,
      "B4c o verso: tese, resumo, etiquetas, precedentes e a ementa recolhida: " + vs.slice(0, 120));
    ok(a.$("btnJurBibEstConferi").hidden === false, "B4d '✓ Conferi na fonte' no verso de quem não tem selo");
    /* teclado */
    a.$("dlgJurBib").close();
    a.jurBibAbrir();
    a.$("btnJurBibEstudar").onclick();
    const k = (key) => a.$("dlgJurBib")._ouv.keydown.forEach((f) => f({ key, target: { tagName: "DIV" }, preventDefault() {} }));
    k(" ");
    ok(a.jurBibAtual().estudo.ver === true, "B4e espaço mostra a tese");
    k("ArrowRight");
    ok(a.jurBibAtual().estudo.i === 1 && a.jurBibAtual().estudo.ver === false, "B4f → próxima (começa escondida)");
    k("ArrowLeft");
    ok(a.jurBibAtual().estudo.i === 0, "B4g ← anterior");
    /* editar e voltar ao mesmo ponto */
    k("ArrowRight");
    const idAqui = a.jurBibAtual().estudo.ids[1];
    a.$("btnJurBibEstEditar").onclick();
    ok(a.$("dlgJurBib").open === false && a.$("dlgJuris").open && a.$("jurTese").value === a.jurDe(idAqui).tese, "B5 ✏️ Editar abre o julgado no formulário");
    a.jurFechar();
    ok(a.$("dlgJurBib").open && a.jurBibAtual().estudo && a.jurBibAtual().estudo.i === 1 && a.jurBibAtual().estudo.ver === true, "B5a fechar a gaveta volta à biblioteca, no mesmo ponto do estudo, já mostrando");
  }
  return falhas;
}

module.exports = { testes };
