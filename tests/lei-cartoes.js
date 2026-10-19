/* =====================================================================
 * OS CARTÕES DE CADA ARTIGO (v18.90.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o leitor da lei mostra "🃏 N" no artigo que tem cartões (etiqueta ou citação), e tocar estuda esses N;
 *  2. o player numa lista não depende da Biblioteca (editar/apagar fora do menu) e fechar não mexe nela;
 *  3. o mapa da lei tem o filtro "sem cartão": os em vigor sem nenhum cartão, os que caem em questão primeiro;
 *  4. a Cobertura "por lei" estuda os cartões de um artigo e os de um capítulo inteiro (cada cartão uma vez);
 *  5. a conta é guardada enquanto a lei e os cartões não mudam.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test(e.className || "");

  const LEI = ["LEI Nº 9.000, DE 2020", "CAPÍTULO I", "Tributos", "Art. 1º Primeiro.", "Art. 2º Segundo.", "Art. 3º Terceiro.",
    "CAPÍTULO II", "Taxas", "Art. 4º Quarto.", "Art. 5º (Revogado).", "Art. 6º Sexto."].join("\n");
  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.leiIniciar(); a.qsUiIniciar();
    const ch = a.matChave("Direito Tributário", "Tributo");
    const l = a.leiGuardar({ id: "lei_x", nome: "Lei 9.000/2020", especie: "Lei", numero: "9000", ano: "2020", texto: LEI, topicos: [ch] });
    [["q6", 6], ["q6b", 6], ["q1", 1]].forEach(([id, n]) => a.qsTodas().push({ id, tipo: "ce", enunciado: "Art. " + n + "º da Lei 9.000/2020.", gabarito: "C", comentario: "", chave: ch, tentativas: [] }));
    a.matGravarCartoes(ch, ["O que diz o terceiro? :: art. 3º da Lei 9.000/2020 :: x",
      "E o terceiro de novo? :: Lei 9.000/2020, art. 2º, art. 3º e art. 4º :: y",
      "Sem artigo? :: nada"].join("\n"), { disciplina: "Direito Tributário", topico: "Tributo" });
    a.leiAbrir("Direito Tributário", "Tributo", "lei_x");
    return { a, ch, l };
  };

  /* ---- 1, 2: o leitor ---- */
  {
    const { a } = montar();
    a.leiPintarLeitura();
    const selo = (num) => achar(a.$("leiArt_" + num), (e) => cls(e, "lei-art-cart"))[0];
    ok(selo("3") && selo("3").textContent === "🃏 2" && selo("4") && selo("4").textContent === "🃏 1" && selo("2") && !selo("1") && !selo("6"),
      "C1 o artigo com cartões mostra quantos (art. 3º: 2; arts. 2º e 4º: 1); sem cartão, nada");
    selo("3").onclick({ stopPropagation() {} });
    const est = a.estcAtual();
    ok(a.$("dlgGerEstudo").open === true && est.un.length === 2 && a.$("dlgLeiSeca").open === true, "C2 tocar estuda os 2 cartões do art. 3º, com a lei aberta por baixo");
    a.estcMenuMontar();
    const itens = achar(a.$("estMenu"), (e) => cls(e, "est-menu-i")).map((b) => b.textContent);
    ok(itens.indexOf(a.t("est_m_editar")) < 0 && itens.indexOf(a.t("est_m_apagar")) < 0 && itens.length >= 1, "C2a numa lista, o menu do player não oferece editar/apagar (são da Biblioteca): " + itens.join(" | "));
    a.$("dlgGerEstudo").close();
    ok(a.$("dlgLeiSeca").open === true, "C2b fechar o player volta à lei");
  }

  /* ---- 3: o mapa da lei, filtro "sem cartão" ---- */
  {
    const { a } = montar();
    a.leiIrAbrir({ filtro: "semcartao" });
    const g = a.$("leiIrGrade");
    const sc = a.leiIrSemCartao(a.leiIrDados());
    ok(sc.total === 5 && sc.itens.map((x) => x.a.num).join(",") === "6,1" && sc.caem === 2,
      "C3 em vigor: 1,2,3,4,6 (o 5 é revogado); sem cartão: o 1 e o 6 — o 6 (2 questões) antes do 1 (1), não na ordem da lei: " + sc.itens.map((x) => x.a.num).join(","));
    ok(g.textContent.indexOf(a.t("lei_ir_sc_cab", { n: 2, t: 5, q: 2 })) >= 0, "C3a o cabeçalho conta: " + g.textContent.slice(0, 100));
    ok(a.$("btnLeiIrF_semcartao") && cls(a.$("btnLeiIrF_semcartao"), "mat-ligado"), "C3b o botão do filtro existe e fica ligado");
  }

  /* ---- 4: a Cobertura "por lei" ---- */
  {
    const { a } = montar();
    a.covAbrirLei("lei_x");
    const cx = a.$("covCorpo");
    const divs = achar(cx, (e) => cls(e, "cov-lei-div"));
    const cap1 = divs.find((d) => /CAPÍTULO I\b/.test(achar(d, (e) => cls(e, "cov-nome"))[0].textContent) && !/II/.test(achar(d, (e) => cls(e, "cov-nome"))[0].textContent));
    const bDiv = achar(cap1, (e) => cls(e, "cov-div-estudar"))[0];
    ok(bDiv && bDiv.textContent === a.t("cov_lei_estudar_div", { n: 2 }), "C4 o capítulo I tem 2 cartões, cada um uma vez (o que cita o 2º e o 3º não conta em dobro): " + (bDiv && bDiv.textContent));
    bDiv.onclick({ stopPropagation() {} });
    ok(a.$("dlgGerEstudo").open === true && a.estcAtual().un.length === 2 && a.$("dlgCobertura").open === true, "C4a estuda os do capítulo, com a Cobertura por baixo");
    a.$("dlgGerEstudo").close();
    /* o artigo: abrir o capítulo II e estudar o art. 4º */
    const cap2 = divs.find((d) => /II/.test(achar(d, (e) => cls(e, "cov-nome"))[0].textContent));
    achar(cap2, (e) => cls(e, "cov-disc-cab"))[0].onclick();
    const b4 = achar(cap2, (e) => e.id === "btnCovLeiEstudar_4")[0];
    ok(b4 && b4.textContent === a.t("cov_lei_estudar", { n: 1 }) && !achar(cap2, (e) => e.id === "btnCovLeiEstudar_6").length, "C4b o artigo com cartão tem '▶ estudar (1)'; o sem cartão, não");
    b4.onclick();
    ok(a.$("dlgGerEstudo").open === true && a.estcAtual().un.length === 1, "C4c estuda o cartão do art. 4º");
    a.$("dlgGerEstudo").close();
  }

  /* ---- 1b: número repetido (corpo × ADCT): o selo só na primeira ocorrência ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.leiIniciar();
    const ch = a.matChave("Direito Constitucional", "Direitos");
    a.leiGuardar({ id: "lei_cf", nome: "Constituição Federal", especie: "Constituição", numero: "", ano: "1988", topicos: [ch],
      texto: ["TÍTULO I", "Princípios", "Art. 1º A República.", "Art. 5º Todos são iguais.", "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS", "Art. 1º O Presidente.", "Art. 5º Não se aplicam."].join(String.fromCharCode(10)) });
    a.matGravarCartoes(ch, "Igualdade? :: art. 5º da CF :: x", { disciplina: "Direito Constitucional", topico: "Direitos" });
    a.leiAbrir("Direito Constitucional", "Direitos", "lei_cf");
    a.leiPintarLeitura();
    const selos = achar(a.$("leiLeitura"), (e) => cls(e, "lei-art-cart"));
    ok(selos.length === 1 && achar(a.$("leiArt_5"), (e) => cls(e, "lei-art-cart")).length === 1, "C6 o art. 5º repetido no ADCT não ganha o selo do corpo: " + selos.length);
  }

  /* ---- 5: a memória ---- */
  {
    const { a, ch, l } = montar();
    const m1 = a.leiCartoesPorArtigo(a.leiDe("lei_x")), m2 = a.leiCartoesPorArtigo(a.leiDe("lei_x"));
    a.matGravarCartoes(ch, "Primeiro? :: art. 1º da Lei 9.000/2020 :: z", { disciplina: "Direito Tributário", topico: "Tributo" });
    const m3 = a.leiCartoesPorArtigo(a.leiDe("lei_x"));
    ok(m1 === m2 && m3 !== m1 && (m3.get("1") || []).length === 1, "C5 a conta é reaproveitada até um cartão mudar; com um cartão novo do art. 1º, recalcula");
    void l;
  }
  return falhas;
}

module.exports = { testes };
