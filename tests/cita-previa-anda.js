/* =====================================================================
 * A PRÉVIA DA LEI CITADA ANDA E SE LÊ BEM (19.148.0)
 *
 * O RELATO: "a função de visualizar parte da lei citada poderia ser mais robusta; o tamanho da letra no computador e
 * no celular precisa ser testado". Medido: letra fixa em 15 px (sem seguir o A−/A+ do leitor), linha de ~95 letras no
 * computador, e no celular 8 espaços de recuo por linha, uma linha vazia entre incisos e o trecho repetido duas vezes.
 *
 * O QUE PRECISA SER VERDADE:
 *  A1. a letra é a do leitor de lei; A−/A+ na própria prévia mudam a dela e a do leitor (mesma chave guardada);
 *  A2. a janela acompanha a letra; no celular o CSS não deixa descer de 16 px;
 *  A3. sem recuo de espaços e sem linhas vazias; inciso, alínea e item ganham degrau pela classe;
 *  A4. a caixa do trecho fica numa linha (curto) e abre ao toque; sem nota, a caixa da nota some e fica "✎ nota";
 *  A5. ‹ anterior · seguinte › mostram os vizinhos; ↩ volta; "desligar"/"ligar a outro" só na citação de origem;
 *  A6. as citações de dentro do artigo viram links que abrem na própria prévia, com volta;
 *  A7. abrir de fora zera o caminho.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const CTN = [
    "Art. 172. A autoridade administrativa pode conceder remissão total ou parcial do crédito tributário.",
    "Art. 173. O direito de a Fazenda Pública constituir o crédito tributário extingue-se após 5 (cinco) anos, contados:",
    "",
    "        I - do primeiro dia do exercício seguinte àquele em que o lançamento poderia ter sido efetuado;",
    "",
    "        II - da data em que se tornar definitiva a decisão que houver anulado, por vício formal, o lançamento anteriormente efetuado.",
    "",
    "        a) alínea de teste;",
    "        Parágrafo único. O direito a que se refere este artigo extingue-se definitivamente, observado o art. 172 desta Lei e o art. 5º da CF.",
    "Art. 174. A ação para a cobrança do crédito tributário prescreve em cinco anos.",
  ].join("\n");
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiGuardar({ id: "ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", especie: "Lei", texto: CTN });
    api.leiGuardar({ id: "cf", nome: "Constituição Federal", apelido: "CF", especie: "Constituição", texto: "Art. 5º. Todos são iguais perante a lei." });
    return api;
  };
  const abrir173 = (api, opc) => {
    const c = api.leiCitacoesNoTexto("conforme o art. 173, I, do CTN")[0];
    c.texto = c.texto || "art. 173, I, do CTN";
    api.leiCitacaoPreviewAbrir(c, "", Object.assign({ lei: api.leiDe("ctn") }, opc || {}));
    return c;
  };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const vis = (api, id) => api.$(id) && api.$(id).hidden === false;
  const fsVar = (api) => (api.$("dlgLeiCitaPreview").getAttribute("data-lei-fs") || "") + "px";

  /* A1 + A2: a letra */
  {
    const api = montar();
    abrir173(api);
    ok(fsVar(api) === api.leiFonteAtualCita() + "px", "A1a a prévia usa a letra do leitor de lei: " + fsVar(api));
    ok(api.$("leiCitaFonte").textContent === "100%", "A1b o tamanho aparece em %: " + api.$("leiCitaFonte").textContent);
    api.$("btnLeiCitaMaior").onclick();
    ok(api.leiFonteAtualCita() === 17 && fsVar(api) === "17px" && api.lojaLer("eac_lei_fonte") === "17", "A1c A+ na prévia muda a letra dela e a do leitor (guardada): " + fsVar(api));
    api.$("btnLeiCitaMenor").onclick(); api.$("btnLeiCitaMenor").onclick();
    ok(api.leiFonteAtualCita() === 13 && api.$("btnLeiCitaMenor").disabled === true, "A1d no mínimo o A− desliga");
    ok(/lei-cita-preview-txt\{[^}]*font-size:var\(--lei-cita-fs/.test(html) && /max\(16px,var\(--lei-cita-fs/.test(html), "A2a o CSS usa a letra do leitor e, no celular, não desce de 16 px");
    ok(/lei-cita-dlg\{max-width:none;width:min\(calc\(100% - 16px\),calc\(var\(--lei-cita-fs,15px\) \* 38/.test(html), "A2b a janela acompanha a letra (~70 letras por linha)");
  }

  /* A3 + A4: o espaço */
  {
    const api = montar();
    abrir173(api);
    const ls = Array.from(api.$("leiCitaPreviewTexto").children);
    ok(ls.length === 5 && ls.every((l) => l.textContent.trim() && !/^\s/.test(l.textContent)), "A3a sem linhas vazias e sem recuo de espaços: " + ls.map((l) => JSON.stringify(l.textContent.slice(0, 8))).join(" "));
    ok(/lcl-inc/.test(ls[1].className) && /lcl-inc/.test(ls[2].className) && /lcl-ali/.test(ls[3].className) && /lcl-par/.test(ls[4].className) && !/lcl-/.test(ls[0].className),
      "A3b inciso, alínea e parágrafo ganham degrau: " + ls.map((l) => l.className).join(" | "));
    ok(ls[1].querySelectorAll("mark").length === 1, "A3c a linha citada continua marcada");
    ok(/\bcurto\b/.test(api.$("leiCitaPreviewTrecho").className), "A4a a caixa do trecho fica numa linha");
    api.leiCitaTrechoTrocar();
    ok(!/\bcurto\b/.test(api.$("leiCitaPreviewTrecho").className), "A4b o toque abre a caixa");
    ok(api.$("leiCitaNotaBox").hidden === true && vis(api, "btnLeiCitaNotaNova"), "A4c sem nota: a caixa some e fica o ✎ nota na barra");
    api.$("btnLeiCitaNotaNova").onclick();
    ok(api.$("leiCitaNotaBox").hidden === false && api.$("leiCitaNotaEd").hidden === false && api.$("btnLeiCitaNotaNova").hidden === true, "A4d ✎ nota abre a edição");
    api.$("leiCitaNotaCampo").value = "decadência do lançamento";
    api.$("btnLeiCitaNotaGuardar").onclick();
    ok(api.$("leiCitaNotaBox").hidden === false && /decadência do lançamento/.test(api.$("leiCitaNotaTxt").textContent) && api.$("btnLeiCitaNotaNova").hidden === true, "A4e com nota, a caixa aparece com ela");
  }

  /* A5: vizinhos e voltar */
  {
    const api = montar();
    abrir173(api, { ctx: { disciplina: "Direito Tributário", topico: "Decadência" } });
    ok(vis(api, "btnLeiCitaAnt") && api.$("btnLeiCitaAnt").textContent === "‹ Art. 172" && api.$("btnLeiCitaProx").textContent === "Art. 174 ›" && !vis(api, "btnLeiCitaVoltar"),
      "A5a os vizinhos aparecem, sem voltar: " + api.$("btnLeiCitaAnt").textContent + " | " + api.$("btnLeiCitaProx").textContent);
    ok(vis(api, "btnLeiCitaDesligar"), "A5b na citação de origem, desligar aparece");
    api.$("btnLeiCitaProx").onclick();
    ok(/^Art\. 174/.test(api.$("leiCitaPreviewArtigo").textContent) && api.$("leiCitaPreviewTrecho").hidden === true && api.$("dlgLeiCitaPreview").open,
      "A5c Art. 174 na mesma janela, sem caixa de trecho: " + api.$("leiCitaPreviewArtigo").textContent);
    ok(vis(api, "btnLeiCitaVoltar") && /voltar ao art\. 173/.test(api.$("btnLeiCitaVoltar").textContent) && !vis(api, "btnLeiCitaProx") && !vis(api, "btnLeiCitaDesligar"),
      "A5d voltar diz para onde; o último artigo não tem seguinte; desligar some: " + api.$("btnLeiCitaVoltar").textContent);
    api.$("btnLeiCitaAnt").onclick();
    ok(/^Art\. 173/.test(api.$("leiCitaPreviewArtigo").textContent) && api.leiCitaPilhaAtual().length === 2, "A5e anterior de novo: a pilha cresce");
    api.$("btnLeiCitaVoltar").onclick(); api.$("btnLeiCitaVoltar").onclick();
    ok(/^Art\. 173/.test(api.$("leiCitaPreviewArtigo").textContent) && !api.$("leiCitaPreviewTrecho").hidden && !vis(api, "btnLeiCitaVoltar") && vis(api, "btnLeiCitaDesligar"),
      "A5f voltando ao início: o trecho citado e o desligar voltam");
    ok((api.leiCitaAlvoAtual().ctx || {}).topico === "Decadência", "A5g o contexto de quem abriu é mantido (abrir a lei inteira vai ao tópico certo)");
  }

  /* A6: links dentro do artigo */
  {
    const api = montar();
    abrir173(api);
    const links = api.$("leiCitaPreviewTexto").querySelectorAll("button.lei-cita-link");
    const txts = links.map((b) => b.textContent);
    ok(links.length === 2 && txts.some((x) => /art\. 172/.test(x)) && txts.some((x) => /art\. 5º da CF/.test(x)), "A6a as citações de dentro do artigo viram links: " + txts.join(" | "));
    ok(!txts.some((x) => /^Art\. 173/.test(x)), "A6b o número do próprio artigo não vira link");
    links.filter((b) => /art\. 5º da CF/.test(b.textContent))[0].onclick({ stopPropagation() {} });
    ok(api.$("leiCitaPreviewTitulo").textContent === "Constituição Federal" && /Todos são iguais/.test(api.$("leiCitaPreviewTexto").textContent) && vis(api, "btnLeiCitaVoltar"),
      "A6c o link de outra lei abre na própria prévia, com voltar");
    api.$("btnLeiCitaVoltar").onclick();
    api.$("leiCitaPreviewTexto").querySelectorAll("button.lei-cita-link").filter((b) => /art\. 172/.test(b.textContent))[0].onclick({ stopPropagation() {} });
    ok(/^Art\. 172/.test(api.$("leiCitaPreviewArtigo").textContent) && /CTN|5\.172/.test(api.$("leiCitaPreviewTitulo").textContent), "A6d 'art. 172 desta Lei' abre o 172 do CTN");
  }

  /* A7: abrir de fora zera o caminho */
  {
    const api = montar();
    abrir173(api);
    api.$("btnLeiCitaProx").onclick();
    ok(api.leiCitaPilhaAtual().length === 1, "A7a navegou: há volta");
    abrir173(api);
    ok(api.leiCitaPilhaAtual().length === 0 && !vis(api, "btnLeiCitaVoltar"), "A7b abrir de fora (outra citação) zera o caminho");
    ok(api.leiCitaNivelClasse("I - x") === " lcl-inc" && api.leiCitaNivelClasse("Inciso solto") === "" && api.leiCitaNivelClasse("1. item") === " lcl-item" && api.leiCitaNivelClasse("§ 2º y") === " lcl-par",
      "A7c o degrau pela abertura da linha");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
