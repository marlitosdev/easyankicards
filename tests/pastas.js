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

  /* ---- G (19.139.0): O QUE FALTA NA BIBLIOTECA, AS CITADAS SEM LIGAÇÃO E A IA CONFERINDO A LISTA ---- */
  {
    const { api, janela: J } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    api.ledIniciar();
    const e = api.edCriar("ISS", ["# ISS Caruaru | prova: 2027-06-01 | horas: 20", "@ Direito Constitucional :: 3", "+ Repartição de receitas :: 3 :: Art. 3º da CF",
      "@ Sistema Tributário :: 5", "+ Suspensão do crédito :: 5 :: Arts. 3 a 5 do CTN", "+ Imunidades :: 4 :: CF e LC 116/03, art. 2º", "+ Dívida ativa :: 3 :: Lei 6.830/80 e LEF"].join(NL));
    const arts = (n) => Array.from({ length: n }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".").join(NL);
    const chS = api.matChave("Sistema Tributário", "Suspensão do crédito");
    const ctn = api.leiGuardar({ nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: arts(12), topicos: [chS] });
    const cf = api.leiGuardar({ nome: "Constituição Federal", apelido: "CF", texto: arts(10), topicos: [] });
    const lef = api.leiGuardar({ nome: "Lei 6.830/1980 - LEF", texto: arts(8), topicos: [] });
    let M = api.ledModelo(e.id);
    ok(M.lacunas.map((G) => G.chave).join() === "lc:116" && M.lacunas[0].topicos[0].nome === "Imunidades" && M.lacunas[0].nums.has("2"),
      "G1 a lei citada que não está na biblioteca vira lacuna (e a sigla solta 'LEF' não): " + M.lacunas.map((G) => G.chave + "/" + G.rotulo).join());
    ok(api.ledChaveLacuna("Lei Complementar 116/2003") === "lc:116" && api.ledChaveLacuna("LC 116/03") === "lc:116" && api.ledChaveLacuna("ISS") === "", "G1a a mesma lei escrita de dois jeitos tem a mesma chave");
    api.ledAbrir(e.id);
    ok(/Faltam na biblioteca · 1/.test(api.$("ledLac").textContent) && api.$("btnLedLacInc_lc_116") && /1 falta\(m\) na biblioteca/.test(api.$("ledResumo").textContent),
      "G2 a faixa das lacunas, com '＋ incluir', e o resumo dizem o que falta: " + api.$("ledResumo").textContent);
    api.$("btnLedLacDisp_lc_116").onclick();
    ok(Object.keys(api.ledDispensadas(e.id)).join() === "lc:116" && /Faltam na biblioteca · 0/.test(api.$("ledLac").textContent) && api.$("btnLedLacDispVer"),
      "G3 dispensar tira da lista (lembrado por edital) e deixa o 'mostrar'");
    api.$("btnLedLacDispVer").onclick();
    api.$("btnLedLacVolta_lc_116").onclick();
    ok(!Object.keys(api.ledDispensadas(e.id)).length && /Faltam na biblioteca · 1/.test(api.$("ledLac").textContent), "G3a 'voltar à lista' desfaz");
    /* citadas sem ligação: a CF é citada em dois tópicos e não está ligada a nenhum */
    const cfSem = M.semLigacao.find((x) => x.id === cf.id);
    ok(cfSem && cfSem.topicos.length === 2 && api.$("btnLedLig_" + cf.id), "G4 a lei da biblioteca citada em tópicos sem ligação aparece, com 'ligar'");
    await conduzir(api, api.ledLigarCitada(cfSem), true);
    M = api.ledModelo(e.id);
    ok(!M.semLigacao.some((x) => x.id === cf.id) && api.leiDe(cf.id).topicos.length === 2, "G4a 'ligar' liga a lei aos tópicos que a citam");
    /* a resposta da IA */
    const resp = ["Aqui está:", "* **+ Lei Complementar 116/2003 | Sistema Tributário | é a lei do ISS**", "1. + Lei 9.999/2020 | Sistema Tributário | lei inventada",
      "+ CTN | Sistema Tributário | já tenho", "− Lei 6.830/1980 | execução fiscal não cai na objetiva", "! CTN | o núcleo da prova"].join(NL);
    const itens = api.ledIaLer(resp);
    ok(itens.map((i) => i.tipo).join("") === "+++-!" && itens[0].lei === "Lei Complementar 116/2003" && itens[0].disc === "Sistema Tributário",
      "G5 a resposta é lida com marcador de lista, negrito e o sinal de menos: " + JSON.stringify(itens.map((i) => [i.tipo, i.lei])));
    api.ledIaAplicarTexto(resp);
    M = api.ledModelo(e.id);
    const g116 = M.lacunas.find((G) => G.chave === "lc:116"), g9999 = M.lacunas.find((G) => G.chave === "lei:9999");
    ok(g116 && g116.ia && !g116.soIa && g9999 && g9999.soIa && g9999.noEdital === false, "G6 o '+' da IA junta-se à lacuna do edital; a lei que só a IA cita fica marcada");
    ok(/Só a IA citou/.test(api.$("ledLac_lei_9999").textContent) && /🤖 IA/.test(api.$("ledLac_lc_116").textContent), "G6a a tela avisa que o edital não menciona a lei da IA");
    ok(M.iaJa.length === 1 && M.iaJa[0].lei.id === ctn.id && M.iaNaoCai[lef.id] && M.iaPrioridade[ctn.id], "G7 '+' de lei que já existe, '−' e '!' viram notas na lei, não lacuna");
    ok(/A IA acha que não cai/.test(api.$("ledCorpo").textContent) && /Prioridade \(IA\): o núcleo da prova/.test(api.$("ledCorpo").textContent), "G7a as notas aparecem no cartão da lei");
    ok(api.ledIaGuardado(e.id).itens.length === 5, "G7b a conferência fica guardada para o edital");
    /* o pedido */
    const ped = api.ledIaPedido(M);
    ok(/CONCURSO: ISS Caruaru/.test(ped) && /## Sistema Tributário \(peso 5\)/.test(ped) && /Suspensão do crédito \[5\] — cita: CTN \(art\. 3/.test(ped)
      && /Lei 5\.172\/1966/.test(ped) && /LC 116\/03/.test(ped) && /\+ <nome oficial da lei> \| <disciplina>/.test(ped) && !/Texto do artigo/.test(ped),
      "G8 o pedido leva disciplinas com peso, o que cada tópico cita, as leis que tenho, as lacunas e o formato — nunca o texto das leis: " + ped.slice(0, 300));
    /* o Gemini direto, só com a opção ligada */
    ok(!api.$("btnLedIaGemini") && api.$("btnLedIaConfig"), "G9 sem a opção ligada, só o copiar (e o link para configurar)");
    api.vzGuardarChave("AIzaTESTE123456");
    api.ledIaLigar(true);
    api.ledPintar();
    ok(api.$("btnLedIaGemini"), "G9a com a chave e a opção, aparece '✨ Pedir ao Gemini'");
    let pedidoIa = "";
    J.fetch = async (url, o) => { pedidoIa = JSON.parse(o.body).contents[0].parts[0].text; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "+ Lei 10.257/2001 | Sistema Tributário | Estatuto da Cidade (IPTU progressivo)" }] }, finishReason: "STOP" }] }) }; };
    await api.ledIaGemini();
    M = api.ledModelo(e.id);
    ok(/CONCURSO: ISS Caruaru/.test(pedidoIa) && M.lacunas.some((G) => G.chave === "lei:10257"), "G9b o Gemini recebe o pedido e a resposta vira lacuna");
    api.ledIaLigar(false);
    /* incluir: a lei nova que É a da lacuna é ligada aos tópicos que a citam */
    const lc116 = api.leiGuardar({ nome: "Lei Complementar 116/2003", texto: arts(5), topicos: [] });
    const n = api.ledIncluida(api.ledModelo(e.id).lacunas.find((G) => G.chave === "lc:116") || g116, lc116.id);
    ok(n === 1 && api.leiDe(lc116.id).topicos.length === 1 && !api.ledModelo(e.id).lacunas.some((G) => G.chave === "lc:116" && !G.soIa && G.topicos.length),
      "G10 a lei incluída é ligada ao tópico que a cita e sai das lacunas");
    const outra = api.leiGuardar({ nome: "Lei 8.987/1995", texto: arts(3), topicos: [] });
    ok(api.ledIncluida({ rotulo: "Lei 10.257/2001", topicos: [{ disciplina: "Sistema Tributário", nome: "Imunidades" }] }, outra.id) === 0 && !api.leiDe(outra.id).topicos.length,
      "G10a outra lei (não a da lacuna) não é ligada a nada");
    /* backup, opção na tela da chave, textos */
    const bk = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "backup.js"), "utf8");
    ok(/"eac_led_dispensadas", "eac_led_ia"/.test(bk), "G11 as dispensadas e a conferência da IA vão no backup");
    api.vzAbrirChave();
    ok(api.$("chkVzLedIa") && api.$("chkVzLedIa").checked === false, "G12 a opção nas leis do edital está na tela da chave, desligada");
    ["led_resumo_lac", "led_lac_tit", "led_lac_expl", "led_lac_em", "led_lac_incluir", "led_lac_incluir_aj", "led_lac_dispensar", "led_lac_dispensar_aj", "led_lac_voltar",
      "led_lac_nenhuma", "led_lac_disp_ver", "led_lac_disp_esconder", "led_lac_so_ia", "led_tag_ia", "led_tag_prio", "led_inc_ligada", "led_inc_outra", "led_lig_tit",
      "led_lig_expl", "led_lig_meta", "led_lig_bt", "led_lig_conf", "led_lig_ok", "led_lig_feito", "led_ia_tit", "led_ia_expl", "led_ia_copiar", "led_ia_gemini",
      "led_ia_gemini_aj", "led_ia_config", "led_ia_ph", "led_ia_ler", "led_ia_nada", "led_ia_lida", "led_ia_copiado", "led_ia_nao_copiou", "led_ia_esperando",
      "led_ia_ultima", "led_ia_limpar", "led_ia_ja", "led_ia_motivo", "led_ia_prio", "led_ia_nao_cai", "led_ia_optin", "led_ia_optin_aj", "led_ia_p_abre",
      "led_ia_p_concurso", "led_ia_p_disciplinas", "led_ia_p_peso", "led_ia_p_cita", "led_ia_p_tenho", "led_ia_p_nenhuma", "led_ia_p_em", "led_ia_p_faltam",
      "led_ia_p_tarefa", "led_ia_p_formato", "iac_mod_leis"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "G13 falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }

  /* ---- R (19.140.0): A FILA DA LEITURA EM UMA LINHA, COM AS LEIS DO EDITAL A UM TOQUE; A BIBLIOTECA COM ANEL E LEITURA ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar();
    api.ledIniciar();
    const e = api.edCriar("ISS", ["# ISS Caruaru | prova: 2027-06-01 | horas: 20", "@ Sistema Tributário :: 5", "+ Suspensão do crédito :: 5 :: Arts. 3 a 5 do CTN e art. 2º da CF"].join(NL));
    const arts = (n) => Array.from({ length: n }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".").join(NL);
    const chS = api.matChave("Sistema Tributário", "Suspensão do crédito");
    api.matGravar(chS, "x", { disciplina: "Sistema Tributário", topico: "Suspensão do crédito" });
    const ctn = api.leiGuardar({ nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN", texto: arts(12), topicos: [chS] });
    const cf = api.leiGuardar({ nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", apelido: "CF", texto: arts(10), topicos: [chS] });
    api.leiGuardar({ nome: "Lei 6.830/1980 - LEF", texto: arts(8), topicos: [] });
    ok(api.leiNomeCurto(ctn) === "Lei 5.172/1966" && api.leiNomeCurto(cf) === "Constituição", "R1 o nome curto do chip: " + api.leiNomeCurto(ctn) + " / " + api.leiNomeCurto(cf));
    api.leiAbrir("Sistema Tributário", "Suspensão do crédito", ctn.id);
    const fila = api.$("leiFila");
    const txt = (fila.textContent || "");
    ok(/Lei 5\.172\/1966 · 12 artigos/.test(txt) && /Constituição · 10 artigos/.test(txt) && !/CONSTITUIÇÃO DA REPÚBLICA/.test(txt) && api.$("btnLeiNova").textContent === "＋ colar",
      "R2 a fila com nomes curtos e os botões encolhidos: " + txt);
    ok(api.ledEditalDoTopico("Sistema Tributário", "Suspensão do crédito") === e.id && api.$("btnLeiFilaEdital"), "R3 a fila oferece '📚 leis do edital' quando o tópico é de um edital");
    api.$("btnLeiFilaEdital").onclick();
    ok(api.$("dlgLeisEd").open && api.$("dlgLeiSeca").open && /Suspensão do crédito/.test(api.$("ledFoco").textContent), "R3a abre as Leis do edital por cima da leitura, com o tópico em destaque");
    api.$("btnLedFocoLer_" + cf.id).onclick();
    ok(!api.$("dlgLeisEd").open && api.$("dlgLeiSeca").open && api.leiIdAtualValor() === cf.id, "R3b escolher uma lei ali fecha a tela de cima e a leitura troca para ela");
    api.$("dlgLeiSeca").close();
    /* a biblioteca */
    api.leiParar(ctn.id, "3", 2);
    api.leiParar(cf.id, "10", 9);
    api.leiBibAbrir();
    const est = () => ["todas", "nao", "lendo", "ok"].map((k) => api.$("btnLeiBibE_" + k).textContent).join(" | ");
    ok(est() === "Todas · 3 | Não começadas · 1 | Em leitura · 1 | ✓ Lidas · 1", "R4 a fileira da leitura conta as leis: " + est());
    const nomes = () => api.$("leiBibLista").querySelectorAll(".lei-bib-tit").map((x) => x.textContent.replace(/\s*\d+% lida.*$/, "")).join(" | ");
    api.$("btnLeiBibE_lendo").onclick();
    ok(/^Lei 5\.172/.test(nomes()) && nomes().split(" | ").length === 1, "R4a 'em leitura' mostra só a lei com marcador no meio: " + nomes());
    api.$("btnLeiBibE_todas").onclick();
    ok(api.$("leiBib_" + ctn.id).querySelectorAll(".led-anel").length === 1 && /lb-ok/.test(api.$("leiBib_" + cf.id).className), "R5 cada lei com o anel; a lida com cara de concluída");
    ok(api.$("leiBibEdFaixa").hidden === true, "R6 sem pasta de edital escolhida, nada de faixa");
    const chipEd = api.$("leiBibPastas").querySelectorAll("button").filter((x) => /📋/.test(x.textContent))[0];
    ok(chipEd, "R6- a pasta do edital na fileira: " + api.$("leiBibPastas").querySelectorAll("button").map((x) => x.textContent).join(" | "));
    if (chipEd) chipEd.onclick();
    ok(api.$("leiBibEdFaixa").hidden === false && /📋 ISS/.test(api.$("leiBibEdFaixaTxt").textContent), "R6a a pasta do edital mostra o caminho para as Leis do edital: " + api.$("leiBibEdFaixa").hidden + " " + api.$("leiBibEdFaixaTxt").textContent + " · " + chipEd.textContent);
    api.$("btnLeiBibLed").onclick();
    ok(api.$("dlgLeisEd").open && !api.$("dlgLeiBib").open, "R6b o botão abre as Leis do edital");
    ["lei_nome_cf", "lei_colar_nova_curto", "lei_vincular_curto", "lei_fila_edital", "lei_fila_edital_aj", "lei_bib_e_todas", "lei_bib_e_nao", "lei_bib_e_lendo", "lei_bib_e_ok",
      "lei_bib_anel_aj", "lei_bib_ed_faixa", "lei_bib_ed_bt"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "R7 falta " + k + " em " + l); }));
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
