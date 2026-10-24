/* =====================================================================
 * PRÉVIA DO VÍNCULO DE LEI E CITAÇÃO DENTRO DA PRÓPRIA LEI (v19.5.0)
 *
 * O RELATO: a prévia mostrava, no fim do texto corrido, "▶ Trecho citado: inciso II — II - a transmissão…" — sem
 * destaque, com o rótulo repetido; e as marcas de estudo da lei ("==texto==") apareciam cruas.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o trecho citado fica numa caixa em DESTAQUE no topo: "Trecho citado · Art. 156 · inciso II" e o texto UMA vez;
 *     no artigo inteiro, as mesmas linhas vêm marcadas (mark.lei-cita-alvo);
 *  2. nenhuma marca de estudo (==, ==!, ==?, ==§, ==*, ==~, ==@) aparece na prévia — e a lei guardada continua com elas;
 *  3. no texto da lei, "art. 32 desta Lei" vira link para a prévia do art. 32 DESTA lei; o título do próprio artigo,
 *     artigo que não existe e lei que altera outra não viram; "arts. 7º e 8º da CF" vai para a CF.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const CF = ["Art. 155. Compete aos Estados instituir impostos.",
    "Art. 156. Compete aos Municípios instituir impostos sobre:",
    "I - ==propriedade predial== e territorial urbana;",
    "II - a ==!transmissão inter vivos==, a qualquer título, por ato oneroso, de direitos reais sobre imóveis, exceto os de garantia; (Redação dada pela Lei Complementar nº 227, de 2026)",
    "III - serviços de ==?qualquer natureza==.",
    "§ 1º Texto do primeiro parágrafo."].join("\n");
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiGuardar({ id: "cf", nome: "Constituição Federal", apelido: "CF", especie: "Constituição", texto: CF });
    return api;
  };

  /* ---- 1 e 2: a prévia ---- */
  {
    const api = montar();
    const c = api.leiCitacoesNoTexto("nos termos do art. 156, II, da CF")[0];
    api.leiCitacaoPreviewAbrir(c, "");
    const cab = api.$("leiCitaPreviewTrechoCab").textContent, tx = api.$("leiCitaPreviewTrechoTxt").textContent;
    ok(!api.$("leiCitaPreviewTrecho").hidden && cab === "Trecho citado · Art. 156 · inciso II", "P1 a caixa do trecho diz qual parte é: " + cab);
    ok(/^II - a transmissão inter vivos, a qualquer título/.test(tx) && !/inciso II/.test(tx) && (tx.match(/II -/g) || []).length === 1,
      "P1a o texto do trecho aparece uma vez, sem o rótulo repetido ('inciso II — II -'): " + tx);
    ok(/Redação dada pela Lei Complementar nº 227/.test(tx), "P1b a nota de redação continua no trecho");
    const art = api.$("leiCitaPreviewTexto");
    const marcas = art.querySelectorAll("mark");
    ok(marcas.length === 1 && /lei-cita-alvo/.test(marcas[0].className) && /^II - a transmissão/.test(marcas[0].textContent),
      "P1c no artigo inteiro, só a parte citada vem marcada: " + marcas.map((m) => m.textContent.slice(0, 20)).join(" | "));
    const tudo = tx + "\n" + art.textContent + "\n" + cab;
    ok(tudo.indexOf("==") < 0 && /propriedade predial e territorial/.test(art.textContent) && /serviços de qualquer natureza\./.test(art.textContent),
      "P2 as marcas de estudo (==, ==!, ==?) não aparecem na prévia: " + art.textContent.slice(0, 200));
    ok(/==!transmissão inter vivos==/.test(api.leiDe("cf").texto), "P2a a lei guardada continua com as marcas (só a prévia as tira)");
    /* a marca NO COMEÇO da linha do inciso (como no § 3º, II, da CF do usuário: "==*II - excluir…") não pode impedir
     * de achar a parte citada */
    api.leiGuardar({ id: "cf2", nome: "Constituição Dois", apelido: "CF2", especie: "Constituição", texto: [
      "Art. 156. Compete aos Municípios instituir impostos.", "§ 3º Em relação ao imposto, cabe à lei complementar:",
      "I - fixar as suas alíquotas máximas;", "==*II - excluir da sua incidência exportações de serviços para o exterior.==", "III - regular a forma."].join("\n") });
    api.leiCitacaoPreviewAbrir(api.leiCitacoesNoTexto("nos termos do art. 156, § 3º, II, da CF2")[0], "", { lei: api.leiDe("cf2") });
    ok(!api.$("leiCitaPreviewTrecho").hidden && /inciso II do §3º/.test(api.$("leiCitaPreviewTrechoCab").textContent)
      && /^II - excluir da sua incidência/.test(api.$("leiCitaPreviewTrechoTxt").textContent),
      "P2b o inciso com marca no começo da linha é achado: " + api.$("leiCitaPreviewTrechoCab").textContent + " | " + api.$("leiCitaPreviewTrechoTxt").textContent);
    /* artigo citado inteiro (sem parte): sem caixa de trecho */
    api.leiCitacaoPreviewAbrir(api.leiCitacoesNoTexto("o art. 155 da CF")[0], "");
    ok(api.$("leiCitaPreviewTrecho").hidden === true && api.$("leiCitaPreviewTexto").querySelectorAll("mark").length === 0, "P3 citação do artigo inteiro: sem caixa de trecho");
    /* lei que não existe: a caixa também some */
    api.leiCitacaoPreviewAbrir(api.leiCitacoesNoTexto("nos termos do art. 156, II, da CF")[0], "");
    api.leiCitacaoPreviewAbrir({ num: "1", numCru: "1", rotulo: "Lei Inexistente 1/2000", texto: "art. 1 da Lei Inexistente" }, "");
    ok(api.$("leiCitaPreviewTrecho").hidden === true, "P3a lei não achada: a caixa do trecho anterior não fica pendurada");
  }

  /* ---- 3: a citação dentro da própria lei ---- */
  {
    const api = montar();
    api.leiGuardar({ id: "ctm", nome: "Código Tributário Municipal", texto: [
      "Art. 7º. Texto do sétimo artigo desta lei.",
      "Art. 10. Conforme o art. 32 desta Lei, o imposto é anual; nos termos do art. 7º e do art. 8º da CF e do art. 99.",
      "Art. 32. O lançamento do imposto é anual e feito de ofício.",
    ].join("\n") });
    api.leiAbrir("", "", "ctm");
    const bts = api.$("leiLeitura").querySelectorAll("button.lei-cita-link");
    const internos = bts.filter((b) => /lei-cita-interna/.test(b.className));
    ok(internos.length === 1 && internos[0].textContent === "art. 32" && /art\. 32 desta mesma lei|Art\. 32 desta mesma lei/i.test(internos[0].title),
      "I1 'art. 32 desta Lei' vira link para esta mesma lei: " + bts.map((b) => b.textContent + "[" + b.className + "]").join(" | "));
    ok(!bts.some((b) => /^Art\. 10/.test(b.textContent)), "I1a o título do próprio artigo não vira link");
    ok(!bts.some((b) => /99/.test(b.textContent)), "I1b artigo que não existe nesta lei não vira link (seria link morto)");
    const a7 = bts.filter((b) => /^art\. 7º/.test(b.textContent))[0];
    ok(a7 && !/lei-cita-interna/.test(a7.className), "I1c 'do art. 7º e do art. 8º da CF': o 7º vai para a CF — mesmo existindo um art. 7º nesta lei: " + (a7 ? a7.className : "sem link"));
    internos[0].onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open && api.$("leiCitaPreviewTitulo").textContent === "Código Tributário Municipal" && /lançamento do imposto é anual/.test(api.$("leiCitaPreviewTexto").textContent),
      "I2 o link abre a prévia do art. 32 desta lei, sem sair do art. 10: " + api.$("leiCitaPreviewTitulo").textContent);
    ok(api.leiIdAtualValor() === "ctm", "I2a a lei aberta continua a mesma");
  }

  /* ---- 3b: lei que ALTERA outra não ganha link interno ---- */
  {
    const api = montar();
    api.leiGuardar({ id: "lc95", nome: "LC 95/2022", texto: [
      "Art. 1º A Lei Complementar nº 015 passa a vigorar com as seguintes alterações:",
      "“Art. 2º ................................",
      "Parágrafo único. Ver o art. 3º. ” (NR)",
      "“Art. 3º ................................ ” (NR)",
      "Art. 2º Esta Lei entra em vigor na data de sua publicação.",
      "Art. 3º Revogam-se as disposições em contrário.",
    ].join("\n") });
    api.leiAbrir("", "", "lc95");
    const links = api.$("leiLeitura").querySelectorAll("button.lei-cita-link");
    /* os artigos citados entre aspas já viram link PARA A LEI ALTERADA ("art. 2º de Lei Complementar nº 015"): ficam.
     * O que não pode: link interno, nem o "art. 3º" solto (sem lei) do parágrafo citado */
    ok(links.length >= 1 && links.every((b) => /Lei Complementar nº 015/.test(b.textContent) && !/lei-cita-interna/.test(b.className)),
      "I3 lei que altera outra: só os links para a lei alterada; nenhum interno nem 'art. 3º' solto: " + links.map((b) => b.textContent).join(" | "));
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["lei_cita_trecho_cab", "lei_cita_interna_ajuda"].forEach((k) => ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
