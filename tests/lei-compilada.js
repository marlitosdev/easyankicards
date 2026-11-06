/* =====================================================================
 * LEI COMPILADA VINDA DE PDF (v19.1.0) — LC 15/2009 de Caruaru (relato de 22/10)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "Art. 3 49 – …" (o número partido pela conversão do PDF) vira "Art. 349 – …" na limpeza da colagem
 *     (grupo "grafia", à vista); "Art. 12 e 13", "Art. 3º O …" e remissão no meio da frase não mudam;
 *  2. num texto COMPILADO (5+ grupos resolvidos por "Redação dada…"), o artigo inteiro repetido sem indício e de
 *     texto parecido vem com a ÚLTIMA redação escolhida, marcado como PROVÁVEL (não "seguro");
 *  3. texto diferente com o mesmo número continua para decidir; fora de lei compilada, nada muda;
 *  4. a conferência dos repetidos já traz a provável escolhida e diz quantas são.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api: a } = rodar();

  /* ---- 1: o número partido ---- */
  ok(a.leiGrafiaDaLinha("Art. 3 49 – Os estabelecimentos de pequeno comércio") === "Art. 349 – Os estabelecimentos de pequeno comércio",
    "C1 'Art. 3 49 –' vira 'Art. 349 –': " + a.leiGrafiaDaLinha("Art. 3 49 – Os estabelecimentos de pequeno comércio"));
  ok(a.leiGrafiaDaLinha("Art. 4 02. É solidariamente responsável") === "Art. 402. É solidariamente responsável", "C1a 'Art. 4 02.' vira 'Art. 402.'");
  ok(a.leiGrafiaDaLinha("Art. 3 68. As instalações de parques") === "Art. 368. As instalações de parques", "C1b 'Art. 3 68.'");
  ok(a.leiGrafiaDaLinha("Art. 12 e 13 desta Lei") === null, "C1c 'Art. 12 e 13' não muda");
  ok(a.leiGrafiaDaLinha("Art. 3º O Código Tributário Municipal é subordinado:") === null, "C1d artigo normal não muda");
  ok(a.leiGrafiaDaLinha("Art. 1 23 de outubro") === null, "C1e número seguido de palavra não é cabeçalho partido");
  ok(a.leiGrafiaDaLinha("Art. 99 99. texto") === "Art. 99 99. texto" || a.leiGrafiaDaLinha("Art. 99 99. texto") === "Art. 9999. texto",
    "C1f no máximo 4 algarismos");
  ok(a.leiGrafiaDaLinha("Art. 150 12. texto") === null, "C1g 5 algarismos juntos: não junta");
  {
    const texto = ["Art. 348. Primeiro artigo da seção.", "", "Art. 3 49 – Os estabelecimentos de pequeno comércio dependem de licença.", "", "Art. 350. Outro."].join("\n");
    const p = a.leiPreprocessar(texto);
    const g = (p.mudancas || []).filter((m) => m.grupo === "grafia");
    ok(g.length === 1 && /Art\. 349 –/.test(g[0].depois), "C1h a limpeza da colagem propõe a junção, à vista no grupo 'grafia': " + JSON.stringify(g));
  }

  /* ---- 2 e 3: lei compilada ---- */
  const nota = (n) => "(Redação dada pela Lei Complementar nº 018, de 09 de outubro de 2009)";
  const bloco = [];
  for (let n = 10; n < 16; n++) {
    bloco.push("Art. " + n + ". A redação antiga do artigo " + n + " sobre tributos municipais e prazos.");
    bloco.push("Art. " + n + ". A redação nova do artigo " + n + " sobre tributos municipais e prazos de recolhimento. " + nota(n));
  }
  const parecido = ["Art. 38. Sujeito ativo da obrigação é o Município de Caruaru.",
    "Art. 38. Sujeito ativo da obrigação tributária é o Município de Caruaru, ou aqueles definidos pela legislação municipal, titulares da competência para exigir o seu cumprimento."];
  const diferente = ["Art. 40. O lançamento será feito pela autoridade administrativa no prazo legal.",
    "Art. 40. As instalações de parques de diversões dependem de licença sanitária anual."];
  const compilado = bloco.concat(parecido, diferente).join("\n\n");
  const gs = a.leiDuplicados(compilado);
  const g38 = gs.find((g) => g.num === a.leiDuplicados(parecido.join("\n\n"))[0].num);
  const g40 = gs.find((g) => g !== g38 && g.candidatos.some((c) => /parques/.test(c.texto)));
  ok(g38 && g38.confianca === "media" && g38.motivo === "compilada" && g38.sugerido === g38.candidatos[1].indice,
    "C2 lei compilada: o artigo repetido sem nota e de texto parecido vem com a ÚLTIMA redação, como provável: " + JSON.stringify(g38 && { c: g38.confianca, m: g38.motivo }));
  ok(g40 && g40.confianca === "fraca", "C3 texto diferente com o mesmo número continua para decidir: " + (g40 && g40.confianca));
  ok(gs.filter((g) => g.confianca === "forte" && g.motivo === "redacao").length === 6, "C3a as com nota continuam seguras");
  {
    const so = a.leiDuplicados(parecido.join("\n\n"));
    ok(so.length === 1 && so[0].confianca === "fraca", "C3b fora de lei compilada (sem notas de redação), nada muda: " + (so[0] && so[0].confianca));
    const poucas = a.leiDuplicados(bloco.slice(0, 8).concat(parecido).join("\n\n"));
    ok(poucas.find((g) => /Sujeito ativo/.test(g.candidatos[0].texto)).confianca === "fraca", "C3c com só 4 notas de redação não se presume compilada");
  }
  {
    const comRevog = bloco.concat(["Art. 38. Sujeito ativo da obrigação é o Município de Caruaru. (Revogado pela Lei Complementar nº 023/10)",
      parecido[1]]).join("\n\n");
    const g = a.leiDuplicados(comRevog).find((x) => /Sujeito ativo/.test(x.candidatos[0].texto));
    ok(g && g.confianca !== "media", "C3d com revogado, a regra da lei compilada não se mete (o sinal manda)");
  }

  /* ---- 4: a tela ---- */
  {
    const { api } = rodar();
    const grupos = api.leiDuplicados(compilado);
    api.leiDuplicadosAbrir({ modo: "criar", texto: compilado, grupos, aoConfirmar() {} });
    const ctx = api.leiDupCtxAtual();
    const gm = grupos.find((g) => g.confianca === "media");
    ok(ctx.decisoes[gm.num] && ctx.decisoes[gm.num].manter === gm.sugerido, "C4 a provável já vem escolhida (a última)");
    const gf = grupos.find((g) => g.confianca === "fraca");
    ok(!ctx.decisoes[gf.num], "C4a a de texto diferente continua sem escolha");
    const res = api.$("leiDupResumo").textContent;
    ok(/1 provável\(is\) pela lei compilada/.test(res) && /1 para você decidir/.test(res), "C4b o resumo separa: seguras, prováveis, para decidir: " + res);
    const html = JSON.stringify(api.$("leiDupLista").textContent || "");
    ok(/provável \(lei compilada\)/.test(html) && /ficou escolhida a ÚLTIMA/.test(html), "C4c o cartão diz por que e pede conferência");
  }
  /* ---- 5 (19.82.0): LRF, art. 51 — o § 1º antigo "nos seguintes prazos:" sem os incisos (riscados na fonte) ---- */
  {
    const { api } = rodar();
    const L = ["Art. 50. Texto.", "", "Art. 51. O Poder Executivo da União promoverá a consolidação das contas.", "",
      "§ 1o Os Estados e os Municípios encaminharão suas contas ao Poder Executivo da União nos seguintes prazos:", "",
      "§ 1º Os Estados e os Municípios encaminharão suas contas ao Poder Executivo da União até 30 de abril.      (Redação dada pela Lei Complementar nº 178, de 2021)          (Vigência)", "",
      "§ 2o O descumprimento dos prazos impedirá o recebimento de transferências.", "", "Art. 52. Outro."];
    const tx = L.join("\n");
    const g = api.leiDuplicados(tx).find((x) => /§\s*1/.test(x.rotulo));
    ok(g && g.candidatos[0].sinais.tipo === "incompleto" && g.candidatos[1].sinais.tipo === "redacao" && g.confianca === "forte" && g.sugerido === g.candidatos[1].indice, "C5 a cabeça do § antigo que termina em ':' sem os incisos é reconhecida, e a nova fica");
    const semNota = tx.replace(/\s*\(Redação dada[^)]*\)\s*\(Vigência\)/, "");
    const g2 = api.leiDuplicados(semNota).find((x) => /§\s*1/.test(x.rotulo));
    ok(g2 && g2.confianca === "forte" && g2.motivo === "incompleto" && g2.sugerido === g2.candidatos[1].indice, "C5b mesmo sem a nota 'Redação dada', o ':' sem itens basta para a sugestão segura: " + (g2 && g2.confianca + "/" + g2.motivo));
    const r = api.leiAplicarDuplicados(tx, [g], { [g.num]: { manter: g.sugerido } });
    const out = String(r.texto || r);
    ok(!/nos seguintes prazos/.test(out) && /até 30 de abril/.test(out) && /§ 2o/.test(out), "C5c o texto final fica só com o § 1º novo");
    const comIncisos = tx.replace("nos seguintes prazos:\n", "nos seguintes prazos:\n\nI - Municípios, até trinta de abril;\n\nII - Estados, até trinta e um de maio.\n");
    const g3 = api.leiDuplicados(comIncisos).find((x) => /§\s*1/.test(x.rotulo));
    ok(g3 && g3.candidatos[0].sinais.tipo !== "incompleto" && g3.sugerido === g3.candidatos[1].indice, "C5d com os incisos presentes, não é 'incompleto' (e a nota de redação decide)");
    api.leiDuplicadosAbrir({ modo: "criar", texto: tx, grupos: [g], aoConfirmar() {} });
    const tela = String(api.$("leiDupLista").textContent || "");
    ok(/anuncia itens que não vêm/.test(tela) && /✓ fica no texto/.test(tela) && /✕ sai do texto/.test(tela), "C5e a tela diz o indício e o que fica e o que sai");
    ok(/SEM indício nenhum/.test(api.t("lei_dup_ajuda")), "C5f a ajuda não diz mais que a repetição dentro do artigo nunca apaga");
  }
  return falhas;
}

module.exports = { testes };
