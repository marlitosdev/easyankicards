/* =====================================================================
 * LEITOR DE LEI: LIGAR À MÃO, "ALÍNEA b", LETRA DO EDITAR, NOVA LEI (v18.47.0)
 *
 * O relato, com prints: (1) no leitor (aberto pela Biblioteca de leis), o
 * trecho "art. 5º, inciso XV, alínea b, da Constituição Federal" não virava
 * link e não havia como ligá-lo à mão; (2) no modo editar, o A+ não mudava
 * a letra; (3) a biblioteca não deixava incluir uma lei sem tópico.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const tique = () => new Promise((r) => setImmediate(r));
  const CTN = "Art. 1º Esta Lei regula, com fundamento no art. 5º, inciso XV, alínea b, da Constituição Federal as normas gerais.\nArt. 2º O sistema tributário nacional é regido conforme a regra geral da tributação.";
  const CF = "Art. 5º Todos são iguais perante a lei.\nXV - é livre a locomoção;\nb) item b.\nArt. 150. Sem prejuízo de outras garantias.";
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiGuardar({ id: "ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: CTN });
    api.leiGuardar({ id: "cf", nome: "Constituição Federal", apelido: "CF", especie: "Constituição", texto: CF });
    return api;
  };
  const links = (api) => api.$("leiLeitura").querySelectorAll("button.lei-cita-link");

  /* V1: "alínea b" por extenso não interrompe a citação */
  {
    const api = montar();
    const c = api.leiCitacoesNoTexto("com fundamento no art. 5º, inciso XV, alínea b, da Constituição Federal as normas")[0];
    ok(c && c.texto === "art. 5º, inciso XV, alínea b, da Constituição Federal" && c.rotulo === "Constituição Federal" && c.incisos.join() === "XV" && c.alineas.join() === "b",
       "V1 a citação vai até a lei, com inciso e alínea: " + JSON.stringify(c && { t: c.texto, r: c.rotulo, a: c.alineas }));
    ok(api.leiCitacoesNoTexto("nos termos do art. 150, VI, alínea c, da CF").map((x) => x.rotulo + "|" + x.alineas.join()).join() === "CF|c", "V1a também depois de inciso romano solto");
  }

  /* V2: aberta pela Biblioteca (sem tópico), a citação vira link e a prévia oferece desligar/ligar a outro */
  {
    const api = montar();
    api.leiAbrir("", "", "ctn");
    const l = links(api).find((b) => /alínea b, da Constituição Federal/.test(b.textContent));
    ok(!!l, "V2 'art. 5º, inciso XV, alínea b, da Constituição Federal' vira link no leitor: " + links(api).map((b) => b.textContent).join(" | "));
    if (l) l.onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true && api.$("leiCitaPreviewTitulo").textContent === "Constituição Federal" && api.$("btnLeiCitaDesligar").hidden === false && api.$("btnLeiCitaOutro").hidden === false,
       "V2a a prévia abre na CF e oferece desligar e ligar a outro");
    api.$("dlgLeiCitaPreview").close();
  }

  /* V3: o vínculo MANUAL vale no leitor (um trecho sem citação vira link; um desligado deixa de ser) */
  {
    const api = montar();
    api.citVinculoSalvar({ trecho: "conforme a regra geral", leiId: "cf", artigos: [{ num: "150", numCru: "150" }] });
    api.citVinculoSalvar({ trecho: "art. 5º, inciso XV, alínea b, da Constituição Federal", nenhum: true });
    api.leiAbrir("", "", "ctn");
    const tx = links(api).map((b) => b.textContent);
    ok(tx.indexOf("conforme a regra geral") >= 0 && !tx.some((x) => /alínea b/.test(x)), "V3 ligado à mão vira link; desligado deixa de ser: " + tx.join(" | "));
    const l = links(api).find((b) => b.textContent === "conforme a regra geral");
    if (l) l.onclick({ stopPropagation() {} });
    ok(api.$("leiCitaPreviewTitulo").textContent === "Constituição Federal" && /Art\. 150/.test(api.$("leiCitaPreviewArtigo").textContent), "V3a o link manual abre a lei e o artigo escolhidos: " + api.$("leiCitaPreviewArtigo").textContent);
    api.$("dlgLeiCitaPreview").close();
  }

  /* V4: a bolha da seleção liga o trecho à mão (aberta sem tópico: vale em todo o app) */
  {
    const api = montar();
    api.leiAbrir("", "", "ctn");
    const no = api.document.createElement("span");
    api.$("leiLeitura").append(no);
    const sel = { isCollapsed: false, rangeCount: 1, anchorNode: no, toString() { return "regido conforme"; }, getRangeAt() { return { getBoundingClientRect() { return { top: 200, bottom: 220, left: 100, width: 80 }; } }; } };
    ok(api.leiBolhaAtualizar(sel) === true && api.$("leiBolha").hidden === false, "V4 selecionar no leitor mostra a bolha");
    ok(api.leiBolhaAtualizar({ isCollapsed: true }) === false && api.$("leiBolha").hidden === true, "V4a sem seleção, a bolha some");
    api.leiBolhaAtualizar(sel);
    api.$("btnLeiBolhaVinc").onclick();
    ok(api.$("dlgQsVincEsc").open === true && /regido conforme/.test(api.$("qsVincEscTrecho").textContent) && api.$("qsVincAlcTudo").checked === true,
       "V4b a bolha abre a janela de vincular com o trecho; sem tópico, o alcance é todo o app");
    api.$("dlgQsVincEsc").close();
    /* no navegador de verdade, o toque no botão desfazia a seleção antes do clique: o mousedown é barrado */
    const ouv = (api.$("btnLeiBolhaVinc")._ouv || {}).mousedown || [];
    let barrou = false;
    ouv.forEach((f) => f({ preventDefault() { barrou = true; } }));
    ok(barrou, "V4c o toque no botão da bolha não desfaz a seleção (mousedown barrado)");
  }

  /* V5: o A+ também muda a letra do modo editar */
  {
    const api = montar();
    api.leiAbrir("", "", "ctn");
    api.leiFonteDefinir(25);
    ok(api.$("leiTexto").style.fontSize === "22.5px", "V5 a caixa do modo editar acompanha a letra: " + api.$("leiTexto").style.fontSize);
    api.leiFonteDefinir(15);
    ok(api.$("leiTexto").style.fontSize === "13.5px", "V5a e volta: " + api.$("leiTexto").style.fontSize);
  }

  /* V6: "＋ Nova lei" na biblioteca — abre vazio (não reabre a última) e grava SEM tópico */
  {
    const api = montar();
    api.leiAbrir("", "", "ctn");
    api.$("dlgLeiSeca").close();
    api.leiBibAbrir();
    /* (v19.2.0) o botão abre o assistente "Incluir lei"; o leitor vazio é o "editor completo" (leiBibNovaEditor) */
    api.$("btnLeiBibNova").onclick();
    ok(api.$("dlgLeiBib").open === false && api.$("dlgLeiNova").open === true, "V6 '＋ Nova lei' abre o assistente de inclusão");
    api.$("btnLeiNovaEditor").onclick();
    ok(api.$("dlgLeiNova").open === false && api.$("dlgLeiSeca").open === true && api.$("leiTexto").value === "" && api.leiIdAtualValor() === "",
       "V6 o editor completo abre o leitor VAZIO para a lei nova (não a última aberta)");
    api.$("leiTexto").value = "LEI Nº 9.999, DE 2 DE JANEIRO DE 2020\nArt. 1º Primeira regra.\nArt. 2º Segunda regra.";
    const p = Promise.resolve(api.leiGravar());
    for (let i = 0; i < 6; i++) { await tique(); try { api.uiModalResponder(true); } catch (e) {} }
    await p;
    const nova = api.leisLista().find((l) => /9\.999/.test(l.nome || "") || /Primeira regra/.test(l.texto || ""));
    ok(nova && Array.isArray(nova.topicos) && nova.topicos.length === 0, "V6a a lei nova fica na biblioteca sem tópico: " + JSON.stringify(nova && { n: nova.nome, t: nova.topicos }));
    ok(api.leiDe("ctn").texto === CTN, "V6b a lei aberta antes não foi tocada");
  }

  /* V7: textos */
  {
    const { api } = rodar();
    ["lei_bib_nova", "lei_bib_nova_aj", "lei_bolha_vinc", "lei_bolha_vinc_aj"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "V7 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
