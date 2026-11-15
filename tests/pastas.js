/* =====================================================================
 * PASTAS DE LEIS E JULGADOS (v19.12.0)
 *
 * O PEDIDO: pastas por edital ou com nome livre ("área fiscal", "município de Recife") para reorganizar leis e
 * julgados; só atalhos; a mesma lei pode estar em várias.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. pasta livre: criar (nome repetido, com ou sem acento, é a mesma), renomear (sem repetir), pôr/tirar atalhos,
 *     a mesma lei em duas pastas, apagar a pasta NÃO apaga a lei;
 *  2. pasta de edital: automática — as leis e julgados ligados a tópicos do edital; edital sem nada não aparece;
 *  3. nas duas bibliotecas: a fileira filtra a lista, e cada item tem o "📁 n" que abre a janela das pastas;
 *  4. a janela: marcar/desmarcar, "＋ criar e pôr aqui", renomear, apagar (com confirmação); diz as de edital;
 *  5. vai no backup.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const conduzir = async (api, promessa, resp) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(resp); } catch (e) {} }
    return promessa;
  };

  /* ---- 1: o modelo ---- */
  {
    const { api } = rodar();
    const a = api.pasCriar("Área fiscal");
    ok(a && a.nome === "Área fiscal" && api.pasCriar("  area   FISCAL ").id === a.id && api.pasLer().length === 1, "P1 nome repetido (sem acento, outra caixa) é a mesma pasta");
    const b = api.pasCriar("Município de Recife");
    ok(api.pasRenomear(b.id, "área fiscal").motivo === "repetido" && api.pasRenomear(b.id, "Recife").ok && api.pasLer()[1].nome === "Recife", "P2 renomear sem repetir nome");
    ok(api.pasAlternar(a.id, "lei", "L1") === true && api.pasAlternar(b.id, "lei", "L1") === true, "P3 pôr a mesma lei em duas pastas");
    ok(api.pasDoItem("lei", "L1").length === 2 && api.pasDoItem("jur", "L1").length === 0, "P3a o tipo conta (lei L1 ≠ julgado L1)");
    ok(api.pasAlternar(a.id, "lei", "L1") === false && api.pasDoItem("lei", "L1").length === 1, "P4 tocar de novo tira");
    const idx = new Map([["d›t1", ["ISS Caruaru"]], ["d›t2", ["SEFAZ AL", "ISS Caruaru"]]]);
    ok(api.pasEditaisDe(["D›T2"], idx).join() === "SEFAZ AL,ISS Caruaru" && api.pasEditaisDe([], idx).length === 0, "P5 os editais de uma lista de tópicos");
    ok(api.pasContem("ed:SEFAZ AL", { t: "lei", id: "x", topicos: ["d›t2"] }, idx) && !api.pasContem("ed:SEFAZ AL", { t: "lei", id: "x", topicos: ["d›t1"] }, idx),
      "P6 a pasta de edital contém o que está ligado a tópico dele");
    ok(api.pasTodas(idx).map((p) => p.id).join() === "ed:ISS Caruaru,ed:SEFAZ AL," + a.id + "," + b.id, "P7 as pastas: as de edital (em ordem) e as livres");
    ok(api.pasApagar(b.id) && api.pasLer().length === 1, "P8 apagar a pasta");
  }

  /* ---- 2 a 5: nas bibliotecas ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    const e = api.edCriar("ISS", ["# ISS Caruaru | prova: 2027-06-01 | horas: 20", "@ Direito Tributário :: 5", "+ Imunidades :: 4", "+ Crédito tributário :: 5"].join(NL));
    api.hubAbrirEdital(e.id);
    /* um segundo edital, sem nenhuma lei nem julgado ligado: a pasta dele não ocupa lugar na fileira */
    api.edCriar("SEFAZ", ["# SEFAZ Alagoas | prova: 2027-08-01 | horas: 20", "@ Contabilidade :: 5", "+ Balanço :: 4"].join(NL));
    const chI = api.matChave("Direito Tributário", "Imunidades");
    api.matGravar(chI, "x", { disciplina: "Direito Tributário", topico: "Imunidades" });
    const ctn = api.leiGuardar({ nome: "CTN", texto: "Art. 1º Texto.", topicos: [chI] });
    const lc = api.leiGuardar({ nome: "LC 15/2009 Caruaru", texto: "Art. 1º Texto.", topicos: [] });
    const cf = api.leiGuardar({ nome: "Constituição Federal", texto: "Art. 1º Texto.", topicos: [] });
    api.leiBibAbrir();
    const chips = () => api.$("leiBibPastas").querySelectorAll("button").map((b) => b.textContent);
    /* (19.98.0) e, no fim, o filtro "🔗 sem tópico" */
    ok(chips().join(" | ") === "📂 Todas as pastas | 📋 ISS Caruaru · 1 | ＋ pasta | 🔗 sem tópico · 2", "B1 a fileira: todas, o edital (com 1 lei), criar e sem tópico: " + chips().join(" | "));
    const fiscal = api.pasCriar("Área fiscal");
    api.pasAlternar(fiscal.id, "lei", lc.id); api.pasAlternar(fiscal.id, "lei", cf.id);
    api.leiBibPintar();
    ok(chips().indexOf("📁 Área fiscal · 2") >= 0, "B2 a pasta livre aparece com a contagem: " + chips().join(" | "));
    const nomes = () => api.$("leiBibLista").querySelectorAll(".lei-bib-tit").map((x) => x.textContent).sort().join(" | ");
    api.$("leiBibPastas").querySelectorAll("button").filter((b) => /Área fiscal/.test(b.textContent))[0].onclick();
    ok(nomes() === "Constituição Federal | LC 15/2009 Caruaru", "B3 escolher a pasta filtra a lista: " + nomes());
    api.$("leiBibPastas").querySelectorAll("button").filter((b) => /ISS Caruaru/.test(b.textContent))[0].onclick();
    ok(nomes() === "CTN", "B4 a pasta do edital: as leis ligadas a tópicos dele: " + nomes());
    api.$("leiBibPastas").querySelectorAll("button").filter((b) => /ISS Caruaru/.test(b.textContent))[0].onclick();
    ok(nomes().split(" | ").length === 3, "B5 tocar de novo volta a todas");
    const bt = api.$("leiBibLista").querySelectorAll("button").filter((b) => b.id === "btnPas_lei_" + cf.id)[0];
    ok(bt && bt.textContent === "📁 1", "B6 o 📁 do item diz em quantas pastas livres ele está: " + (bt && bt.textContent));

    /* a janela */
    bt.onclick({ stopPropagation() {} });
    ok(api.$("dlgPastas").open && /Constituição Federal/.test(api.$("pasTit").textContent), "J1 a janela abre com o nome do item");
    ok(api.$("pasCk_" + fiscal.id).checked === true, "J2 marcada a pasta em que está");
    ok(/nenhuma pasta de edital/i.test(api.$("pasEditais").textContent), "J3 diz que não está em pasta de edital (não ligada a tópico)");
    ok(/data-i18n-ph="pas_nova_ph"/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8")), "J3a o campo da nova pasta usa o atributo de placeholder que o app traduz (data-i18n-ph)");
    api.$("pasNovaNome").value = "Estado de Pernambuco";
    api.$("btnPasCriar").onclick();
    const pe = api.pasLer().find((p) => p.nome === "Estado de Pernambuco");
    ok(pe && pe.itens.some((x) => x.t === "lei" && x.id === cf.id), "J4 '＋ criar e pôr aqui': a pasta nasce com o item");
    ok(/📁 2/.test(api.$("leiBibLista").querySelectorAll("button").filter((b) => b.id === "btnPas_lei_" + cf.id)[0].textContent), "J4a a biblioteca atrás se atualiza (📁 2)");
    api.$("pasCk_" + fiscal.id).checked = false;
    api.$("pasCk_" + fiscal.id).onchange();
    ok(!api.pasDoItem("lei", cf.id).some((p) => p.id === fiscal.id), "J5 desmarcar tira da pasta");
    api.$("btnPasRen_" + pe.id).onclick();
    api.$("pasRenomear_" + pe.id).value = "Pernambuco";
    api.$("pasLista").querySelectorAll("button").filter((b) => b.textContent === "OK")[0].onclick();
    ok(api.pasLer().find((p) => p.id === pe.id).nome === "Pernambuco", "J6 renomear pela janela");
    const pa = api.$("btnPasApagar_" + pe.id).onclick();
    await conduzir(api, pa, false);
    ok(api.pasLer().some((p) => p.id === pe.id), "J7 negar a confirmação não apaga");
    const pa2 = api.$("btnPasApagar_" + pe.id).onclick();
    await conduzir(api, pa2, true);
    ok(!api.pasLer().some((p) => p.id === pe.id) && api.leisLista().some((l) => l.id === cf.id), "J8 apagar a pasta não apaga a lei");
    api.$("btnPasFechar").onclick();

    /* julgados: a mesma fileira e o mesmo 📁 */
    const j1 = api.jurGravar({ tribunal: "STF", classe: "Súmula Vinculante", numero: "52", tese: "Imóvel alugado continua imune.", topicos: [chI] });
    const j2 = api.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "160", tese: "Atualizar IPTU por decreto.", topicos: [] });
    api.pasAlternar(fiscal.id, "jur", j2.id);
    api.jurBibAbrir();
    const chJ = () => api.$("jurBibPastas").querySelectorAll("button").map((b) => b.textContent);
    ok(chJ().indexOf("📋 ISS Caruaru · 1") >= 0 && chJ().indexOf("📁 Área fiscal · 1") >= 0, "U1 na biblioteca de julgados: a pasta do edital e a livre (com os julgados): " + chJ().join(" | "));
    api.$("jurBibPastas").querySelectorAll("button").filter((b) => /Área fiscal/.test(b.textContent))[0].onclick();
    ok(api.$("jurBibLista").querySelectorAll(".jur-bib-item").length === 1 && /160/.test(api.$("jurBibLista").textContent), "U2 a pasta filtra os julgados");
    ok(api.$("jurBibLista").querySelectorAll("button").some((b) => b.id === "btnPas_jur_" + j2.id), "U3 cada julgado tem o 📁");
    void j1;

    /* backup */
    ok(api.montarBackup().dados.material.eac_pastas, "K1 as pastas vão no backup");
  }

  /* ---- L (19.138.0): AS LEIS DO EDITAL — por disciplina e peso, o tópico do ⚖ em destaque, o que falta pelos artigos cobrados ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    api.ledIniciar();
    const e = api.edCriar("ISS", ["# ISS Caruaru | prova: 2027-06-01 | horas: 20", "@ Direito Constitucional :: 3", "+ Repartição de receitas :: 3 :: Art. 3º da CF",
      "@ Sistema Tributário :: 5", "+ Suspensão do crédito :: 5 :: Arts. 3 a 5 do CTN", "++ Moratória :: 4 :: art. 7º do CTN", "+ Imunidades :: 4 :: CF e LC 116/03",
      "+ Dívida ativa :: 3 :: Lei 6.830/80"].join(NL));
    const arts = (n) => Array.from({ length: n }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".").join(NL);
    const chS = api.matChave("Sistema Tributário", "Suspensão do crédito");
    const ctn = api.leiGuardar({ nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: arts(12), topicos: [chS] });
    const cf = api.leiGuardar({ nome: "Constituição Federal", apelido: "CF", texto: arts(10), topicos: [] });
    const lef = api.leiGuardar({ nome: "Lei 6.830/1980 - LEF", texto: arts(8), topicos: [] });
    api.leiParar(ctn.id, "3", 2);
    const M = api.ledModelo(e.id);
    ok(M.disciplinas.map((D) => D.nome).join() === "Sistema Tributário,Direito Constitucional", "L1 as disciplinas na ordem do peso (5 antes de 3): " + M.disciplinas.map((D) => D.nome).join());
    const trib = M.disciplinas[0];
    ok(trib.lista.map((x) => x.id).join() === [ctn.id, cf.id, lef.id].join(), "L1a dentro da disciplina, a lei dos tópicos de maior peso vem antes: " + trib.lista.map((x) => x.id).join());
    ok(M.leis[ctn.id].leit.cobrados.join() === "3,4,5,7", "L2 a faixa 'arts. 3 a 5' abre o miolo, e o artigo do ramo entra no tópico: " + M.leis[ctn.id].leit.cobrados.join());
    ok(M.leis[ctn.id].leit.lidos === 1 && M.leis[ctn.id].leit.prox.num === "4", "L3 o marcador no art. 3º: 1 de 4 lidos, continuar no 4º");
    ok(M.leis[lef.id].leit.modo === "lei" && M.total === 5 && M.lidos === 1, "L4 lei citada sem artigo é medida inteira e NÃO entra no total de artigos cobrados: " + M.total);
    ok(trib.lista[1].leit.modo === "cobrados" && M.disciplinas[1].lista[0].leit.cobrados.join() === "3", "L4a a CF em Constitucional mede o artigo que ESTA disciplina cobra");
    api.leiArtigoVistoMarcar(ctn.id, "7", true);
    ok(api.ledModelo(e.id).leis[ctn.id].leit.lidos === 2, "L5 o artigo marcado como visto conta como lido");
    /* o ⚖ da agenda, com o edital da linha: abre as leis do edital com o tópico em destaque */
    const r = api.edRecursosDoTopico("Sistema Tributário", "Suspensão do crédito", e.id);
    r.lei.onclick({ stopPropagation() {} });
    ok(api.$("dlgLeisEd").open && api.$("ledFoco") && /Suspensão do crédito/.test(api.$("ledFoco").textContent) && /2 de 4 lidos/.test(api.$("ledFoco").textContent),
      "L6 o ⚖ da agenda abre as leis do edital, com o tópico em destaque e o que dele está lido: " + (api.$("ledFoco") && api.$("ledFoco").textContent.slice(0, 160)));
    const bt = api.$("btnLedFocoLer_" + ctn.id);
    ok(bt && /continuar no art\. 4º/.test(bt.textContent), "L7 'continuar' no primeiro artigo cobrado que falta: " + (bt && bt.textContent));
    ok(/2 de 5 artigos cobrados lidos/.test(api.$("ledResumo").textContent), "L8 o resumo do edital: " + api.$("ledResumo").textContent);
    api.$("btnLedF_ok").onclick();
    ok(/Nada neste filtro/.test(api.$("ledCorpo").textContent) && !/Código Tributário/.test(api.$("ledCorpo").textContent.split("Concluídas")[1] || "") && api.$("btnLedF_ok").getAttribute("aria-pressed") === "true", "L9 o filtro 'concluídas' esconde o que falta");
    api.$("btnLedF_falta").onclick();
    ok(api.$("ledLei_0_" + ctn.id) && api.$("ledLei_0_" + lef.id), "L9a 'falta ler' mostra as que faltam");
    bt.onclick();
    ok(api.$("dlgLeiSeca").open, "L10 'continuar' abre a lei (pelo tópico ligado, no artigo)");
    /* sem edital conhecido, o ⚖ continua abrindo a lei do tópico direto */
    api.$("dlgLeiSeca").close(); api.$("dlgLeisEd").close();
    api.edRecursosDoTopico("Sistema Tributário", "Suspensão do crédito").lei.onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiSeca").open && !api.$("dlgLeisEd").open, "L11 sem o edital da linha, o ⚖ abre a lei do tópico como antes");
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const ferr = (html.split('id="edTopoFerr"')[1] || "").split("</div>")[0];
    ok(/id="btnEdLeis"/.test(ferr) && /<dialog id="dlgLeisEd"/.test(html), "L12 o botão '⚖ Leis' nas ferramentas do edital e a janela existem");
    ["led_btn", "led_btn_tip", "led_titulo", "led_como", "led_resumo", "led_foco_tit", "led_foco_sub", "led_foco_vazio", "led_foco_abrir", "led_foco_nums", "led_foco_sem_art",
      "led_f_todas", "led_f_falta", "led_f_ok", "led_disc_meta", "led_cob", "led_cob_lei", "led_em_topicos", "led_tambem", "led_arts", "led_topicos_n", "led_continuar",
      "led_comecar", "led_abrir", "led_anel_aj", "led_nao_ligada", "led_vazio", "led_vazio_filtro"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "L13 falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["pas_todas", "pas_item_0", "pas_todas_aj", "pas_edital_aj", "pas_livre_aj", "pas_nova", "pas_nova_aj", "pas_nova_pergunta", "pas_item_aj", "pas_dlg_tit", "pas_dlg_exp",
      "pas_vazio", "pas_nova_ph", "pas_criar", "pas_ren_ok", "pas_ren_aj", "pas_ren_vazio", "pas_ren_repetido", "pas_apagar_aj", "pas_apagar_conf", "pas_apagar_ok",
      "pas_editais_do_item", "pas_editais_nenhum", "pas_fechar"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
