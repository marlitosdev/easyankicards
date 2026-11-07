/* (19.96.0) O VÍNCULO MANUAL LIGA A LEI AO TÓPICO — e a citação "art. 105, § 2º e § 4º, da Lei nº 4.320/1964"
 *
 * O caso real (backup de 07/11): no resumo do PCASP, "art. 105, § 2º" virou link para a LC 101/2000, que nem tem
 * art. 105. Dois defeitos juntos: a leitura parava em "e § 4º" antes de chegar à lei, e a citação sem lei ia para a
 * única lei ligada ao tópico sem conferir se ela tinha o artigo.
 *
 *   LT1  "art. 105, § 2º e § 4º, da Lei nº 4.320/1964": dois links, os dois do art. 105, os dois da Lei 4.320
 *   LT2  sem lei no fim, a enumeração continua sendo só o primeiro (a regra antiga)
 *   LT3  a lei única do tópico só responde quando tem o artigo; sem ele, o app pergunta (motivo "sem_artigo")
 *   LT4  na janela do vínculo, a lei escolhida que não é do tópico traz "ligar também ao tópico?" (marcado)
 *   LT5  salvar com a caixa marcada liga a lei ao tópico e o aviso diz isso; desmarcada, não liga
 *   LT6  a lei que já é do tópico não pergunta
 *   LT7  os vínculos antigos: as leis usadas sem estar ligadas viram sugestão, e "ligar" liga
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* ---- a leitura e a resolução ---- */
  {
    const { api } = rodar();
    const s = "conforme o art. 105, § 2º e § 4º, da Lei nº 4.320/1964 (bens móveis).";
    const cs = api.leiCitacoesNoTexto(s);
    ok(cs.length === 2 && cs.every((c) => c.num === "105" && /4\.320\/1964/.test(c.rotulo))
      && cs[0].paragrafos[0] === "2º" && cs[1].paragrafos[0] === "4º" && cs[0].texto === "art. 105, § 2º" && /^§ 4º, da Lei nº 4\.320\/1964$/.test(cs[1].texto),
      "LT1 as duas partes do art. 105 levam a Lei 4.320: " + JSON.stringify(cs.map((c) => [c.texto, c.num, c.paragrafos, c.rotulo])));
    const cs2 = api.leiCitacoesNoTexto("ver o art. 105, § 2º e § 4º, sem lei nomeada.");
    ok(cs2.length === 1 && cs2[0].texto === "art. 105, § 2º" && !cs2[0].rotulo, "LT2 sem lei no fim, continua só o primeiro: " + JSON.stringify(cs2.map((c) => c.texto)));
    const lc101 = { id: "lc101", nome: "LC 101/2000", especie: "lc", numero: "101", ano: "2000", texto: "Art. 1º Um.\nArt. 75. Fim." };
    const l4320 = { id: "l4320", nome: "Lei 4.320/1964", especie: "lei", numero: "4.320", ano: "1964", texto: "Art. 104. A.\nArt. 105. B.\n§ 2º C.\n§ 4º D." };
    const r1 = api.leiResolverCitacao(cs2[0], [lc101, l4320], [lc101]);
    ok(!r1.lei && r1.motivo === "sem_artigo", "LT3 a LC 101 (do tópico, sem art. 105) não responde pelo art. 105: " + JSON.stringify(r1.motivo));
    const r2 = api.leiResolverCitacao(api.leiCitacoesNoTexto("ver o art. 75.")[0], [lc101, l4320], [lc101]);
    ok(r2.lei && r2.lei.id === "lc101", "LT3b com o artigo, a lei do tópico continua respondendo");
    const r3 = api.leiResolverCitacao(cs[0], [lc101, l4320], [lc101]);
    ok(r3.lei && r3.lei.id === "l4320", "LT3c com a lei nomeada, vai para ela");
  }

  /* ---- a janela do vínculo ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const DISC = "Noções de Contabilidade", TOP = "PCASP";
    const ch = api.matChave(DISC, TOP);
    api.matGravar(ch, "R.", { disciplina: DISC, topico: TOP });
    api.leiGuardar({ id: "lei_lc101", nome: "LC 101/2000", numero: "101", ano: "2000", texto: "Art. 1º Um." });
    api.leiLigar("lei_lc101", ch);
    api.leiGuardar({ id: "lei_4320", nome: "Lei 4.320/1964", numero: "4.320", ano: "1964", texto: "Art. 105. A.\n§ 2º B." });
    const q = { disciplina: DISC, topico: TOP, comentario: "x" };

    api.qsVincEscolherPara(q, { trecho: "art. 105, § 2º", cit: null });
    api.$("qsVincLei").value = "lei_4320"; api.$("qsVincLei").onchange();
    ok(api.$("qsVincLigarBox").hidden === false && api.$("qsVincLigar").checked === true && /Lei 4\.320\/1964/.test(api.$("qsVincLigarTxt").textContent) && /PCASP/.test(api.$("qsVincLigarTxt").textContent),
      "LT4 a lei que não é do tópico traz 'ligar também ao tópico', marcado: " + api.$("qsVincLigarTxt").textContent);
    api.$("qsVincArts").value = "105, § 2º";
    api.qsVincSalvar();
    const lig = (id) => api.leisDoTopico(ch).some((l) => l.id === id);
    ok(lig("lei_4320") && /ligada ao tópico/.test(api.$("toast").textContent || ""), "LT5 salvar liga a lei ao tópico e o aviso diz isso: " + api.$("toast").textContent);

    api.leiGuardar({ id: "lei_8137", nome: "Lei 8.137/1990", numero: "8.137", ano: "1990", texto: "Art. 1º Um." });
    api.qsVincEscolherPara(q, { trecho: "art. 1º da outra", cit: null });
    api.$("qsVincLei").value = "lei_8137"; api.$("qsVincLei").onchange();
    api.$("qsVincLigar").checked = false;
    api.$("qsVincArts").value = "1";
    api.qsVincSalvar();
    ok(!lig("lei_8137"), "LT5b desmarcada, a lei não é ligada");

    api.qsVincEscolherPara(q, { trecho: "art. 1º", cit: null });
    api.$("qsVincLei").value = "lei_lc101"; api.$("qsVincLei").onchange();
    ok(api.$("qsVincLigarBox").hidden === true, "LT6 a lei que já é do tópico não pergunta");
    try { api.$("dlgQsVincEsc").close(); } catch (e) {}

    /* ---- os vínculos antigos ---- */
    const sug = api.citLigacoesSugeridas();
    ok(sug.length === 1 && sug[0].leiId === "lei_8137" && sug[0].topico === api.matChave(DISC, TOP).split("›").pop() && sug[0].n === 1,
      "LT7 o vínculo para a lei não ligada vira sugestão (e a já ligada não): " + JSON.stringify(sug));
    ok(api.citLigarSugeridas(sug) === 1 && lig("lei_8137") && api.citLigacoesSugeridas().length === 0, "LT7b 'ligar' liga e a sugestão some");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
