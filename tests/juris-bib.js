/* =====================================================================
 * A BIBLIOTECA DE JULGADOS (v18.41.0, JM3)
 *
 * Cada julgado só era visto de dentro do seu tópico. Aqui: todos, com
 * busca, filtros (tribunal, situação), agrupados por tópico ou tribunal;
 * abrir no tópico, ligar a mais um tópico, criar os cartões das teses de
 * uma vez (com desfazer) e estudar as teses.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const tique = () => new Promise((r) => setImmediate(r));
  const cls = (e) => String((e && e.className) || "");
  const D = "Tributário";
  const NL2 = String.fromCharCode(10);

  /* B1: as portas */
  {
    const ferr = HTML.slice(HTML.indexOf('id="matFerrJuris"'), HTML.indexOf("</div>", HTML.indexOf('id="matFerrJuris"')));
    ok(ferr.indexOf('id="btnMatJurBib"') > 0, "B1 a aba Julgados do Material tem o botão da biblioteca");
    ok(HTML.indexOf('id="btnJurBib"') > 0 && HTML.indexOf('<dialog id="dlgJurBib"') > 0, "B1a a gaveta tem 'todos os julgados' e a biblioteca existe");
  }

  const montar = () => {
    const { api } = rodar();
    api.matIniciar();
    const A = api.matChave(D, "Limitações"), B = api.matChave(D, "Princípios"), C = api.matChave(D, "Lançamento");
    api.matGravar(C, "Resumo C.", { disciplina: D, topico: "Lançamento" });
    const g = (dados, tops) => { const j = api.jurGravar(dados); tops.forEach((x) => api.jurLigar(j.id, x[0], D, x[1])); return api.jurDe(j.id); };
    const re = g({ tribunal: "STF", classe: "RE", numero: "111", tese: "Tese do RE.", tags: ["iss"] }, [[A, "Limitações"]]);
    const resp = g({ tribunal: "STJ", classe: "REsp", numero: "222", tese: "Tese do REsp.", aConferir: ["data"] }, [[A, "Limitações"], [B, "Princípios"]]);
    const adi = g({ tribunal: "STF", classe: "ADI", numero: "333", tese: "Tese da ADI.", deMemoria: true, texto: "ementa da ADI" }, []);
    return { api, A, B, C, re, resp, adi };
  };
  const itens = (api) => api.$("jurBibLista").querySelectorAll(".jur-bib-item");
  const grupos = (api) => api.$("jurBibLista").querySelectorAll(".jur-bib-grupo").map((g) => g.textContent);

  /* B2-B6: contagem, grupos, busca e filtros */
  {
    const { api } = montar();
    api.jurBibAbrir();
    ok(api.$("dlgJurBib").open === true && api.$("jurBibConta").textContent === "3 julgado(s) guardado(s) em 2 tópico(s).", "B2 a biblioteca diz quantos julgados e em quantos tópicos: " + api.$("jurBibConta").textContent);
    ok(grupos(api).join(" | ") === "sem tópico (1) | Tributário › Limitações (2) | Tributário › Princípios (1)" && itens(api).length === 4,
       "B2a agrupada por tópico (o julgado de dois tópicos aparece nos dois; o sem tópico tem grupo próprio): " + grupos(api).join(" | "));
    ok(/estudar as teses \(3\)/.test(api.$("btnJurBibEstudar").textContent) && /cartões das teses \(2\)/.test(api.$("btnJurBibCartoes").textContent),
       "B2b os botões dizem quantos: " + api.$("btnJurBibEstudar").textContent + " | " + api.$("btnJurBibCartoes").textContent);
    api.$("jurBibBusca").value = "REsp"; api.$("jurBibBusca").oninput();
    ok(itens(api).length === 2 && api.$("jurBibFiltro").textContent === "Mostrando 1.", "B3 a busca acha pelo número/classe: " + itens(api).length + " " + api.$("jurBibFiltro").textContent);
    api.$("jurBibBusca").value = "princípios"; api.$("jurBibBusca").oninput();
    ok(api.jurBibFiltrados().map((j) => j.numero).join() === "222", "B3a a busca acha pelo nome do tópico: " + api.jurBibFiltrados().map((j) => j.numero).join());
    api.$("jurBibBusca").value = ""; api.$("jurBibBusca").oninput();
    const ops = api.$("jurBibTrib").children.map((o) => o.value);
    ok(ops.join() === ",STF,STJ", "B4 o filtro de tribunal só oferece os que existem: " + ops.join());
    api.$("jurBibTrib").value = "STJ"; api.$("jurBibTrib").onchange();
    ok(itens(api).every((li) => /STJ/.test(li.textContent)) && itens(api).length === 2, "B4a filtrar por STJ");
    api.$("jurBibTrib").value = ""; api.$("jurBibTrib").onchange();
    api.$("jurBibSit").value = "conferir"; api.$("jurBibSit").onchange();
    ok(api.jurBibFiltrados().map((j) => j.numero).sort().join() === "222,333", "B5 'a conferir' inclui os campos a conferir e a tese de memória");
    api.$("jurBibSit").value = "sem_topico"; api.$("jurBibSit").onchange();
    ok(api.jurBibFiltrados().map((j) => j.numero).join() === "333", "B5a 'sem tópico'");
    api.$("jurBibSit").value = "sem_ementa"; api.$("jurBibSit").onchange();
    ok(api.jurBibFiltrados().map((j) => j.numero).sort().join() === "111,222", "B5b 'sem ementa'");
    api.$("jurBibSit").value = ""; api.$("jurBibSit").onchange();
    api.$("jurBibGrupo").value = "tribunal"; api.$("jurBibGrupo").onchange();
    ok(grupos(api).join(" | ") === "STF (2) | STJ (1)", "B6 agrupar por tribunal: " + grupos(api).join(" | "));
    api.$("jurBibGrupo").value = ""; api.$("jurBibGrupo").onchange();
    ok(!grupos(api).length && itens(api).length === 3, "B6a sem agrupar: uma lista só");
  }

  /* B7 (19.126.0): a busca no julgado inteiro, ano, relator, ordem e "seu acervo, hoje" */
  {
    const { api } = montar();
    api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "555", tese: "Tese sobre decadência.", relator: "Min. Herman Benjamin", orgao: "Segunda Turma",
      data: "2019-03-12", texto: "TRIBUTÁRIO. LANÇAMENTO POR HOMOLOGAÇÃO. O prazo decadencial conta-se do fato gerador quando há pagamento antecipado." });
    api.jurGravar({ tribunal: "STJ", classe: "AgInt", numero: "666", tese: "Tese sobre prescrição.", relator: "Ministro HERMAN BENJAMIN", data: "2023-08-01", conferidoEm: api.jurHojeISO() });
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "777", tese: "Tese sobre imunidade.", relator: "Min. Cármen Lúcia", data: "2023-02-10" });
    api.jurBibAbrir();
    const ordem = () => api.jurBibFiltrados().map((j) => j.numero).join();
    const nums = () => api.jurBibFiltrados().map((j) => j.numero).sort().join();
    const busca = (q) => { api.$("jurBibBusca").value = q; api.$("jurBibBusca").oninput(); };
    busca("homologacao");
    ok(nums() === "555", "B7 a busca acha a palavra que só está na EMENTA (sem acento): " + nums());
    const ac = api.$("jurBibLista").querySelectorAll(".jur-bib-achado");
    ok(ac.length === 1 && /na ementa:/.test(ac[0].textContent) && /HOMOLOGAÇÃO/.test(ac[0].textContent) && ac[0].querySelectorAll("mark").length === 1,
       "B7a e a linha mostra o trecho da ementa, com a palavra marcada: " + (ac[0] && ac[0].textContent));
    busca("decadência");
    ok(nums() === "555" && !api.$("jurBibLista").querySelectorAll(".jur-bib-achado").length, "B7b achou na tese (à vista): sem trecho repetido embaixo");
    busca("benjamin");
    ok(nums() === "555,666", "B7c a busca acha pelo relator: " + nums());
    busca("benjamin prescrição");
    ok(nums() === "666", "B7d várias palavras: todas têm de aparecer, cada uma em qualquer campo: " + nums());
    busca('"fato gerador"');
    ok(nums() === "555", "B7e frase entre aspas: a expressão exata: " + nums());
    busca('"gerador fato"');
    ok(nums() === "" && /Nenhum julgado/.test(api.$("jurBibLista").textContent), "B7f a frase invertida não existe: " + nums());
    busca("segunda turma 2019");
    ok(nums() === "555", "B7g órgão e ano também são procurados: " + nums());
    busca("");
    /* o ano e o relator: só os que existem, com a contagem; grafias do mesmo relator viram um só */
    const anos = api.$("jurBibAno").children.map((o) => o.textContent).join(" | ");
    ok(anos === "qualquer ano | 2023 (2) | 2019 (1) | sem data (3)" && api.$("jurBibAno").hidden === false, "B7h os anos, do mais novo ao mais velho, e os sem data: " + anos);
    const rels = api.$("jurBibRelator").children.map((o) => o.textContent).join(" | ");
    ok(rels === "qualquer relator | Min. Cármen Lúcia (1) | Min. Herman Benjamin (2)", "B7i os relatores (duas grafias = um): " + rels);
    api.$("jurBibAno").value = "2023"; api.$("jurBibAno").onchange();
    ok(nums() === "666,777" && api.$("btnJurBibLimpar").hidden === false, "B7j filtrar pelo ano (e o 'limpar filtros' aparece): " + nums());
    api.$("jurBibRelator").value = api.jurBibRelatorChave("Herman Benjamin"); api.$("jurBibRelator").onchange();
    ok(nums() === "666", "B7k ano + relator: " + nums());
    api.$("btnJurBibLimpar").onclick();
    ok(api.jurBibFiltrados().length === 6 && api.$("btnJurBibLimpar").hidden === true && api.$("jurBibAno").value === "" && api.$("jurBibRelator").value === "",
       "B7l 'limpar filtros' volta a mostrar tudo");
    api.$("jurBibAno").value = "sem"; api.$("jurBibAno").onchange();
    ok(nums().split(",").sort().join() === "111,222,333", "B7m 'sem data': " + nums());
    api.$("btnJurBibLimpar").onclick();
    /* a ordem */
    api.$("jurBibOrdem").value = "recente"; api.$("jurBibOrdem").onchange();
    ok(ordem().split(",").slice(0, 3).join() === "666,777,555", "B7n mais recentes primeiro (os sem data no fim): " + nums());
    api.$("jurBibOrdem").value = "antigo"; api.$("jurBibOrdem").onchange();
    ok(ordem().split(",").slice(0, 3).join() === "555,777,666", "B7o mais antigos primeiro: " + nums());
    api.$("jurBibOrdem").value = "verif"; api.$("jurBibOrdem").onchange();
    ok(ordem().split(",").pop() === "666", "B7p há mais tempo sem verificar: o verificado hoje fica por último: " + nums());
    api.$("jurBibOrdem").value = ""; api.$("jurBibOrdem").onchange();
    /* o acervo */
    const a = api.jurBibAcervo();
    ok(a.n === 6 && a.ementa === 2 && a.data === 3 && a.verif === 1 && a.nunca === 5 && a.vencida === 0, "B7q o acervo em números: " + JSON.stringify(a));
    const pe = api.$("jurBibAcervo").textContent;
    ok(api.$("jurBibAcervo").hidden === false && /6 julgado\(s\) · 2 com ementa guardada · verificação em dia: 1 · vencida: 0 · nunca verificados: 5/.test(pe)
       && /4 sem ementa: esses só são achados pela tese/.test(pe) && /não nos tribunais/.test(pe), "B7r o rodapé diz o acervo e o limite da busca: " + pe);
    ok(api.jurBibRelatorChave("Rel. Ministra CÁRMEN LÚCIA") === "carmen lucia" && api.jurBibAno({ data: "12/03/2019" }) === "2019" && api.jurBibAno({ data: "" }) === "",
       "B7s relator e ano normalizados");
  }

  /* B2c: julgado ligado só pela chave (sem rótulo, nome em minúsculas) cai no MESMO grupo, com o nome do material */
  {
    const { api, A } = montar();
    api.matGravar(A, "Resumo A.", { disciplina: D, topico: "Limitações" });
    api.jurGravar({ tribunal: "STF", classe: "Tema", numero: "444", tese: "Tese do tema.", topicos: [A] });
    api.jurBibAbrir();
    ok(grupos(api).filter((g) => /limitações/i.test(g)).join() === "Tributário › Limitações (3)", "B2c o mesmo tópico não vira dois grupos (maiúsculas do material): " + grupos(api).join(" | "));
  }

  /* B7-B8: abrir no tópico; ligar a mais um tópico */
  {
    const { api, C, re } = montar();
    api.jurBibAbrir();
    /* (19.143.0) as ações moram na LEITURA: tocar na linha abre */
    const li = itens(api).find((x) => /RE 111/.test(x.textContent));
    li.onclick();
    ok(api.$("jurBibLeitor").hidden === false && /RE 111/.test(api.$("jurBibLeitor").textContent), "B7- tocar na linha abre a leitura do julgado");
    const bL = api.$("jurBibLeitor").querySelectorAll("button").find((b) => b.id === "btnJurBibLigar_" + re.id);
    bL.onclick();
    const sel = api.$("jurBibLeitor").querySelectorAll("select").find((s) => s.id === "jurBibLigarSel_" + re.id);
    const vals = sel ? sel.children.map((o) => o.value) : [];
    ok(sel && vals.indexOf(C) >= 0 && vals.indexOf(api.matChave(D, "Limitações")) < 0, "B8 '＋ outro tópico' oferece os tópicos onde ele ainda não está: " + vals.join(" | "));
    sel.value = C; sel.onchange();
    ok(api.jurDe(re.id).topicos.indexOf(C) >= 0 && grupos(api).some((g) => /Lançamento \(1\)/.test(g)), "B8a escolher liga o julgado ao tópico, e a lista já mostra");
    const top = api.$("jurBibLeitor").querySelectorAll("button").find((b) => /jur-bib-top/.test(cls(b)));
    top.onclick();
    ok(api.$("dlgJurBib").open === false && api.$("dlgJuris").open === true, "B7 tocar no tópico fecha a biblioteca e abre os julgados de lá");
  }

  /* B9: cartões das teses em lote, sem repetir, com desfazer */
  {
    const { api, A, B } = montar();
    api.jurBibAbrir();
    const p = api.jurBibCartoes();
    for (let i = 0; i < 4; i++) { await tique(); try { api.uiModalResponder(true); } catch (e) {} }
    const rec = await p;
    const cA = String((api.matResumosAtual()[A] || {}).cartoes || ""), cB = String((api.matResumosAtual()[B] || {}).cartoes || "");
    ok(rec && rec.novos === 3 && /STF RE 111/.test(cA) && /STJ REsp 222/.test(cA) && /STJ REsp 222/.test(cB) && /Tese do RE\./.test(cA),
       "B9 um cartão por julgado e por tópico (o sem tópico fica de fora): " + JSON.stringify(rec && { n: rec.novos }) + " | " + cA.replace(/\n/g, " / "));
    ok(/3 cartão\(ões\) criado\(s\)/.test(api.$("jurBibMsg").textContent) && api.$("btnJurBibDesfazer").hidden === false, "B9a diz o que fez e oferece desfazer");
    const p2 = api.jurBibCartoes();
    for (let i = 0; i < 4; i++) { await tique(); try { api.uiModalResponder(true); } catch (e) {} }
    const rec2 = await p2;
    ok(rec2 && rec2.novos === 0 && rec2.repetidos === 3, "B9b de novo: nada repetido");
    const d = api.jurBibDesfazer();
    for (let i = 0; i < 4; i++) { await tique(); try { api.uiModalResponder(true); } catch (e) {} }
    await d;
    /* o desfazer é do ÚLTIMO recibo (o da 2ª vez, vazio); o primeiro lote continua — o que importa é não quebrar */
    ok(api.$("btnJurBibDesfazer").hidden === true, "B9c desfazer esconde o botão");
  }
  {
    const { api, A } = montar();
    api.jurBibAbrir();
    const p = api.jurBibCartoes();
    for (let i = 0; i < 4; i++) { await tique(); try { api.uiModalResponder(true); } catch (e) {} }
    await p;
    const d = api.jurBibDesfazer();
    for (let i = 0; i < 4; i++) { await tique(); try { api.uiModalResponder(true); } catch (e) {} }
    await d;
    ok(!/STF RE 111/.test(String((api.matResumosAtual()[A] || {}).cartoes || "")), "B9d desfazer tira os cartões criados");
  }

  /* B10: estudar as teses */
  {
    const { api } = montar();
    api.jurBibAbrir();
    api.$("btnJurBibEstudar").onclick();
    ok(api.$("jurBibEstudo").hidden === false && api.$("jurBibLista").hidden === true && api.$("jurBibBarra").hidden === true, "B10 o estudo toma o lugar da lista");
    ok(api.$("jurBibEstPos").textContent === "1 de 3" && /^O que decidiu (STF|STJ) · /.test(api.$("jurBibEstFrente").textContent) && api.$("jurBibEstTese").hidden === true,
       "B10a vê o tribunal e o número, a tese escondida: " + api.$("jurBibEstFrente").textContent);
    ok(api.$("jurBibEstPistas").textContent.indexOf("#") < 0, "B10e a pista é só o tópico (as etiquetas entregariam a tese): " + api.$("jurBibEstPistas").textContent);
    api.$("btnJurBibEstVer").onclick();
    ok(api.$("jurBibEstTese").hidden === false && /^Tese d/.test(api.$("jurBibEstTese").textContent) && api.$("btnJurBibEstVer").hidden === true, "B10b 'mostrar a tese' mostra");
    api.$("btnJurBibEstProx").onclick();
    ok(api.$("jurBibEstPos").textContent === "2 de 3" && api.$("jurBibEstTese").hidden === true, "B10c a próxima começa escondida");
    api.$("btnJurBibEstSair").onclick();
    ok(api.$("jurBibEstudo").hidden === true && api.$("jurBibLista").hidden === false, "B10d voltar à lista");
  }

  /* B11: textos nos dois idiomas */
  {
    const { api } = rodar();
    ["jur_bib_tit", "jur_bib_btn", "jur_bib_btn_gaveta", "jur_bib_conta", "jur_bib_estudar", "jur_bib_cartoes", "jur_bib_cartoes_conf", "jur_bib_est_frente", "jur_bib_ligar", "jur_bib_vazio"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "B11 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  /* ---- J143 (19.143.0): três colunas — filtros recolhíveis com chips, lista compacta, leitura de um julgado ---- */
  {
    const { api, re, resp, adi } = montar();
    try { api.loja.setItem("eac_jbb_filtros", "0"); } catch (e) {}
    api.jurBibAbrir();
    ok(!/jbb-filtros-aberto/.test(cls(api.$("dlgJurBib"))) && /Filtros/.test(api.$("btnJurBibFiltros").textContent), "J1 com os filtros fechados, o botão diz 'Filtros'");
    api.$("btnJurBibFiltros").onclick();
    ok(/jbb-filtros-aberto/.test(cls(api.$("dlgJurBib"))) && /Esconder/.test(api.$("btnJurBibFiltros").textContent), "J1a o botão abre o painel (e a escolha é lembrada)");
    ok(api.$("jurBibChips").hidden === true, "J2 sem filtro ativo, sem chips");
    api.$("jurBibTrib").value = "STF"; api.$("jurBibTrib").onchange();
    ok(api.$("jurBibChips").hidden === false && api.$("btnJbbChip_trib") && /STF/.test(api.$("btnJbbChip_trib").textContent) && /· 1/.test(api.$("btnJurBibFiltros").textContent),
      "J2a o filtro ativo vira chip, e o botão conta quantos: " + api.$("jurBibChips").textContent);
    api.$("btnJbbChip_trib").onclick();
    ok(!api.$("btnJbbChip_trib") || api.$("jurBibChips").hidden === true, "J2b tocar no chip tira o filtro");
    ok(api.jurBibFiltrados().length === 3, "J2c e a lista volta inteira");
    /* a linha é compacta: nenhum botão dentro dela */
    const li = itens(api).find((x) => /ADI 333/.test(x.textContent));
    ok(li && !li.querySelectorAll("button").length, "J3 a linha não tem botões (as ações moram na leitura)");
    li.onclick();
    const lt = api.$("jurBibLeitor");
    ok(lt.hidden === false && /jbb-com-leitor/.test(cls(api.$("dlgJurBib"))) && /ementa da ADI/.test(lt.textContent) && /Tese da ADI/.test(lt.textContent), "J4 a leitura mostra a tese e a ementa inteira");
    ok(/sel/.test(cls(itens(api).find((x) => /ADI 333/.test(x.textContent)))), "J4a a linha aberta fica marcada");
    /* navegar pela lista filtrada */
    const L = api.jurBibFiltrados();
    const k = L.findIndex((j) => j.id === adi.id);
    if (k < L.length - 1) { api.$("btnJurBibLtProx").onclick(); ok(api.$("jurBibLeitor").textContent.indexOf(L[k + 1].tese) >= 0, "J5 'próximo ›' abre o seguinte da lista"); }
    else { api.$("btnJurBibLtAnt").onclick(); ok(api.$("jurBibLeitor").textContent.indexOf(L[k - 1].tese) >= 0, "J5 '‹ anterior' abre o de antes da lista"); }
    api.$("btnJurBibLtX").onclick();
    ok(api.$("jurBibLeitor").hidden === true && !/jbb-com-leitor/.test(cls(api.$("dlgJurBib"))), "J6 fechar a leitura volta à lista larga");
    /* o julgado sem ementa diz isso na leitura */
    api.jurBibSelecionar(re.id);
    ok(/Ementa não guardada/.test(api.$("jurBibLeitor").textContent), "J7 sem ementa, a leitura avisa");
    void resp;
    ["jbb_rot_qualidade", "jbb_rot_assunto", "jbb_rot_trib", "jbb_rot_sit", "jbb_rot_tag", "jbb_rot_ano", "jbb_rot_rel", "jbb_rot_grupo", "jbb_rot_ordem", "jbb_rot_pastas",
      "jbb_filtros_mostrar", "jbb_filtros_esconder", "jbb_chip_tirar", "jbb_item_aria", "jbb_lt_ant", "jbb_lt_prox", "jbb_lt_pos", "jbb_lt_fora", "jbb_lt_fechar", "jbb_lt_sem_dados",
      "jbb_lt_tese", "jbb_lt_ementa", "jbb_lt_sem_ementa", "jbb_lt_resumo", "jbb_lt_precedentes", "jbb_lt_fonte", "jbb_lt_sem_fonte", "jbb_lt_topicos"].forEach((k2) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k2) && api.t(k2) !== k2, "J8 falta " + k2 + " em " + l); }));
    api.setLanguage("pt");
  }

  /* ---- C144 (19.144.0): CONFERIR UM A UM — verificações, fila por risco, links da fonte, corrigir, decidir e desfazer ---- */
  {
    const { api, re, resp, adi } = montar();
    api.jcfIniciar();
    const ADI5135 = "EMENTA AGRAVO INTERNO EM RECURSO EXTRAORDINÁRIO COM AGRAVO. DIREITO TRIBUTÁRIO. PROTESTO DE CERTIDÃO DE DÍVIDA ATIVA. MECANISMO CONSTITUCIONAL DE COBRANÇA DE OBRIGAÇÕES FISCAIS. AUSÊNCIA DE OFENSA A DIREITOS FUNDAMENTAIS DOS CONTRIBUINTES. Agravo interno a que se nega provimento, mantida a decisão do tribunal de origem.";
    const j51 = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "5135", tese: "A inclusão das certidões de dívida ativa no rol de títulos sujeitos a protesto é constitucional.", texto: ADI5135, orgao: "Tribunal Pleno", relator: "Min. Roberto Barroso", data: "2016-11-09", fonte: "STF ADI 5135" });
    const v51 = api.jcfVerificacoes(api.jurDe(j51.id)).map((x) => x.k);
    ok(v51.indexOf("outra_classe") >= 0, "C1 a ementa de outro processo (ADI guardando ementa de ARE-AgR) é apontada: " + v51.join());
    ok(api.jcfClassesDaEmenta("EMENTA: AÇÃO DIRETA DE INCONSTITUICIONALIDADE. OFENSA AO PRINCÍPIO")[0].c === "ADI", "C1a a classe é lida no começo da ementa (mesmo com erro de grafia)");
    const are = api.jurGravar({ tribunal: "STF", classe: "ARE", numero: "800395 AgR", tese: "Tese do ARE.", texto: "EMENTA: AGRAVO REGIMENTAL NO RECURSO EXTRAORDINÁRIO COM AGRAVO. IPTU. IMUNIDADE. " + "x ".repeat(120), relator: "Min. X", data: "2014-01-01", orgao: "Primeira Turma", fonte: "STF" });
    ok(api.jcfVerificacoes(api.jurDe(are.id)).every((x) => x.k !== "outra_classe"), "C1b ARE-AgR com ementa de agravo regimental no RE com agravo: confere");
    const vRe = api.jcfVerificacoes(api.jurDe(re.id)).map((x) => x.k), vAdi = api.jcfVerificacoes(api.jurDe(adi.id)).map((x) => x.k);
    const resumo = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "2405", tese: "Tese da 2405.", texto: "— outra tese guardada para o mesmo julgado (STF ADI 2405): no julgamento, o STF decidiu que não há reserva de lei complementar." });
    const vRes = api.jcfVerificacoes(api.jurDe(resumo.id)).map((x) => x.k);
    ok(vRe.indexOf("sem_ementa") >= 0 && vRe.indexOf("sem_relator") >= 0 && vAdi.indexOf("memoria") >= 0 && vRes.indexOf("nao_ementa") >= 0,
      "C2 sem ementa, sem relator, de memória, texto que não é ementa: " + vRe.join() + " / " + vAdi.join() + " / " + vRes.join());
    const fila = api.jcfFila();
    ok(fila.length >= 3 && fila.every((id, i) => i === 0 || api.jcfRisco(api.jurDe(fila[i - 1])) >= api.jcfRisco(api.jurDe(id))), "C3 a fila vai do maior risco para o menor");
    const lk = api.jcfLinks(api.jurDe(j51.id)).map((x) => x.url).join(" ");
    ok(/listarProcessos\.asp\?classe=ADI&numeroProcesso=5135/.test(lk) && /jurisprudencia\.stf\.jus\.br/.test(lk), "C4 os links da fonte: o processo e a pesquisa no STF");
    /* a fila na tela */
    api.jcfAbrir([j51.id, re.id, resp.id]);
    ok(api.$("dlgJcf").open && /1 de 3/.test(api.$("jcfPos").textContent) && /ementa é de “agravo interno/.test(api.$("jcfVer").textContent), "C5 a fila abre no primeiro, com as verificações por extenso");
    ok(api.$("btnJcfConfere").disabled === true, "C6 'confere' só depois dos três vistos");
    ["proc", "ementa", "tese"].forEach((k) => { api.$("jcfCk_" + k).checked = true; });
    api.$("jcfCk_tese").onchange();
    ok(api.$("btnJcfConfere").disabled === false, "C6a com os três vistos, 'confere' liga");
    api.$("btnJcfConfere").onclick();
    ok(api.jurQualidade(api.jurDe(j51.id)).nivel === "conferido" && /2 de 3/.test(api.$("jcfPos").textContent), "C7 'confere' dá o selo azul e passa ao próximo");
    api.$("btnJcfDesfazer").onclick();
    ok(!api.jurDe(j51.id).selo && /1 de 3/.test(api.$("jcfPos").textContent), "C8 desfazer tira o selo e volta ao julgado");
    api.$("btnJcfPular").onclick();
    /* corrigir aqui (o RE sem ementa e sem relator) */
    api.$("jcfCampo_relator").value = "Min. Fulano";
    api.$("jcfCampo_texto").value = "EMENTA: RECURSO EXTRAORDINÁRIO. Tese do RE e mais texto.";
    api.$("btnJcfSalvarCorr").onclick();
    const vRe2 = api.jcfVerificacoes(api.jurDe(re.id)).map((x) => x.k);
    ok(api.jurDe(re.id).relator === "Min. Fulano" && vRe2.indexOf("sem_ementa") < 0 && vRe2.indexOf("sem_relator") < 0, "C9 corrigir aqui grava os campos e refaz as verificações: " + vRe2.join());
    api.$("jcfMotivo").value = "a tese não está no acórdão";
    api.$("btnJcfProblema").onclick();
    const qRe = api.jurQualidade(api.jurDe(re.id), { lista: api.jurLista() });
    ok(qRe.nivel === "problema" && qRe.motivos.some((m) => /tese não está no acórdão/.test(m.txt)), "C10 'problema' marca o julgado (vermelho na biblioteca) com o motivo");
    api.$("btnJcfPular").onclick();
    ok(/1 com problema · 2 pulado/.test(api.$("jcfCorpo").textContent) || /com problema/.test(api.$("jcfCorpo").textContent), "C11 o fim da fila resume: " + api.$("jcfCorpo").textContent.slice(0, 120));
    api.$("dlgJcf").close();
    /* na biblioteca: o botão da fila e, na leitura, as verificações */
    api.jurBibAbrir();
    ok(api.$("btnJurBibFila").hidden === false && /Conferir um a um \(\d+\)/.test(api.$("btnJurBibFila").textContent), "C12 a biblioteca oferece a fila: " + api.$("btnJurBibFila").textContent);
    api.jurBibSelecionar(j51.id);
    ok(/Verificações/.test(api.$("jurBibLeitor").textContent) && api.$("btnJurBibLtConferir"), "C13 a leitura mostra as verificações e 'conferir este'");
    api.$("btnJurBibLtConferir").onclick();
    ok(api.$("dlgJcf").open && /1 de 1/.test(api.$("jcfPos").textContent), "C13a 'conferir este' abre a fila só com ele");
    ["jcf_tit", "jcf_bt", "jcf_bt_aj", "jcf_bt_este", "jcf_pos", "jcf_pos_fim", "jcf_vazia", "jcf_vazia_expl", "jcf_guardado", "jcf_verificacoes", "jcf_na_fonte", "jcf_sem_links",
      "jcf_corrigir", "jcf_c_relator", "jcf_c_orgao", "jcf_c_data", "jcf_c_fonte_url", "jcf_c_ementa", "jcf_salvar_corr", "jcf_corr_nada", "jcf_corr_ok", "jcf_editar_tudo",
      "jcf_editar_tudo_aj", "jcf_checklist", "jcf_ck_proc", "jcf_ck_ementa", "jcf_ck_tese", "jcf_motivo_ph", "jcf_confere", "jcf_confere_aj", "jcf_confere_falta",
      "jcf_confere_sem_tese", "jcf_problema", "jcf_problema_aj", "jcf_problema_sem_motivo", "jcf_pular", "jcf_pular_aj", "jcf_voltar", "jcf_desfazer", "jcf_selo_fonte",
      "jcf_fim_tit", "jcf_fim", "jcf_rever_pulados", "jcf_v_nada", "jcf_v_sem_ementa", "jcf_v_nao_ementa", "jcf_v_outra_classe", "jcf_v_tese_fora", "jcf_v_memoria",
      "jcf_v_sem_fonte", "jcf_v_vig_ia", "jcf_v_certeza", "jcf_v_campos", "jcf_v_sem_relator", "jcf_v_sem_data", "jcf_v_sem_orgao", "jcf_l_stf_proc", "jcf_l_stf_juris",
      "jcf_l_stj_juris", "jcf_l_stj_proc", "jcf_l_sua", "jur_q_m_pessoa_problema"].forEach((k2) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k2) && api.t(k2) !== k2, "C14 falta " + k2 + " em " + l); }));
    api.setLanguage("pt");
  }

  /* ---- I145 (19.145.0): A IA CONFERINDO NA FONTE — pedido, resposta colada ou Gemini, veredito nas verificações, campos ---- */
  {
    const r0 = rodar(); const api = r0.api, J = r0.janela;
    api.matIniciar();
    api.jcfIniciar();
    const j = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "5135", tese: "A inclusão das CDAs no rol de títulos sujeitos a protesto é constitucional.", texto: "EMENTA AGRAVO INTERNO EM RECURSO EXTRAORDINÁRIO COM AGRAVO. PROTESTO DE CDA.", relator: "Min. Roberto Barroso", orgao: "Tribunal Pleno", data: "2016-11-09" });
    const ped = api.jcfIaPedido(api.jurDe(j.id));
    ok(/ADI 5135/.test(ped) && /CDAs no rol/.test(ped) && /PROCESSO: confere \| não confere/.test(ped) && /FONTE: <link oficial>/.test(ped), "I1 o pedido leva os dados do julgado e o formato fixo");
    api.jcfAbrir([j.id]);
    ok(api.$("jcfIa") && api.$("btnJcfIaCopiar") && api.$("btnJcfIaConfig") && !api.$("btnJcfIaGemini"), "I2 sem a opção da jurisprudência ligada, só copiar (e o link para configurar)");
    const RESP = ["**PROCESSO:** não confere — 5135 é ADI de 2016, mas a ementa é do ARE 1.234 AgR", "RELATOR: Min. Roberto Barroso", "ORGAO: Primeira Turma", "DATA: 09/11/2016",
      "TESE: diverge — a tese guardada mistura ARE e ADI", "EMENTA: é de outro processo — ARE 1.234 AgR", "VIGENCIA: vigente", "FONTE: https://portal.stf.jus.br/processos/detalhe.asp?incidente=4."].join(NL2);
    api.$("jcfIaResp").value = RESP;
    api.$("btnJcfIaLer").onclick();
    const jc = api.jurDe(j.id);
    ok(jc.iaConf && jc.iaConf.tese === "diverge" && jc.iaConf.ementa === "outro" && jc.iaConf.processo === "diverge" && !jc.selo, "I3 a resposta colada vira veredito guardado no julgado — e nenhum selo é dado");
    const ks = api.jcfVerificacoes(jc).map((x) => x.k);
    ok(ks.indexOf("ia_tese") >= 0 && ks.indexOf("ia_ementa") >= 0 && ks.indexOf("ia_processo") >= 0, "I4 o veredito entra nas verificações: " + ks.join());
    ok(api.$("jcfIaRes") && /não confere/.test(api.$("jcfIaRes").textContent) && api.$("jcfIaUsar_fonteUrl") && api.$("jcfIaUsar_fonteUrl").checked === true && api.$("jcfIaUsar_orgao") && api.$("jcfIaUsar_orgao").checked === false && !api.$("jcfIaUsar_relator"),
      "I5 os campos achados: o link (vazio no julgado) vem marcado; o órgão diferente vem desmarcado; o relator igual nem aparece");
    api.$("btnJcfIaAplicar").onclick();
    ok(/incidente=4$/.test(api.jurDe(j.id).fonteUrl) && api.jurDe(j.id).orgao === "Tribunal Pleno", "I6 aplicar grava só o que foi marcado (sem o ponto final colado no link)");
    api.$("btnJcfDesfazer").onclick();
    ok(!api.jurDe(j.id).fonteUrl, "I6a e dá para desfazer");
    /* o Gemini direto, com a opção da jurisprudência ligada */
    api.vzGuardarChave("AIzaTESTE123456");
    api.jurIaLigar(true);
    const j2 = api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "1.111", tese: "Tese do REsp de teste.", texto: "EMENTA: RECURSO ESPECIAL. TRIBUTÁRIO. Tese do REsp de teste e mais texto." });
    let pedido = "", busca = false;
    J.fetch = async (url, o) => { const c = JSON.parse(o.body); pedido = c.contents[0].parts[0].text; busca = !!c.tools; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: ["PROCESSO: confere", "RELATOR: Min. Fulano", "ORGAO: Segunda Turma", "DATA: 2020-05-05", "TESE: confere", "EMENTA: confere", "VIGENCIA: vigente", "FONTE: https://scon.stj.jus.br/x"].join(NL2) }] }, finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { title: "STJ", uri: "https://scon.stj.jus.br/y" } }] } }] }) }; };
    api.jcfAbrir([j2.id]);
    ok(api.$("btnJcfIaGemini"), "I7 com a opção ligada, aparece '✨ Pedir ao Gemini'");
    await api.jcfIaGemini();
    const jg = api.jurDe(j2.id);
    ok(/REsp 1\.111/.test(pedido) && busca && jg.iaConf && jg.iaConf.processo === "confere" && jg.iaConf.via === "gemini" && jg.iaConf.fontes.length === 1, "I8 o Gemini vai com a busca ligada; a resposta e as fontes ficam guardadas");
    ok(api.jcfVerificacoes(jg).some((x) => x.k === "ia_ok" && x.peso === 0) && !jg.selo, "I9 'confere' da IA aparece como verificação positiva — o selo continua sendo seu");
    ["jcf_ia_tit", "jcf_ia_expl", "jcf_ia_copiar", "jcf_ia_gemini", "jcf_ia_gemini_aj", "jcf_ia_config", "jcf_ia_ph", "jcf_ia_ler", "jcf_ia_nada", "jcf_ia_lida", "jcf_ia_copiado",
      "jcf_ia_esperando", "jcf_ia_campos", "jcf_ia_antes", "jcf_ia_aplicar", "jcf_ia_fontes", "jcf_ia_lembrete", "jcf_ia_r_processo", "jcf_ia_r_ementa", "jcf_ia_r_tese",
      "jcf_ia_r_vigencia", "jcf_ia_st_confere", "jcf_ia_st_diverge", "jcf_ia_st_outro", "jcf_ia_st_vigente", "jcf_ia_st_superada", "jcf_ia_st_cancelada", "jcf_ia_st_nao_achei",
      "jcf_ia_st_x", "jcf_ia_p_abre", "jcf_ia_p_dados", "jcf_ia_p_tribunal", "jcf_ia_p_processo", "jcf_ia_p_orgao", "jcf_ia_p_relator", "jcf_ia_p_data", "jcf_ia_p_tese",
      "jcf_ia_p_ementa", "jcf_ia_p_fonte", "jcf_ia_p_tarefa", "jcf_ia_p_formato", "jcf_v_ia_processo", "jcf_v_ia_ementa", "jcf_v_ia_tese", "jcf_v_ia_vigencia", "jcf_v_ia_ok"].forEach((k2) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k2) && api.t(k2) !== k2, "I10 falta " + k2 + " em " + l); }));
    api.setLanguage("pt");
  }

  /* ---- M146 (19.146.0): O MAPA — linha do tempo (tocar e período) e temas (tocar filtra e volta à lista) ---- */
  {
    const { api, A, B } = montar();
    const g = (dados, ch, tp) => { const j = api.jurGravar(dados); api.jurLigar(j.id, ch, D, tp); return j; };
    g({ tribunal: "STF", classe: "RE", numero: "901", tese: "Tese 2018.", data: "2018-05-01" }, A, "Limitações");
    g({ tribunal: "STF", classe: "RE", numero: "902", tese: "Tese 2020 a.", data: "2020-03-02" }, A, "Limitações");
    g({ tribunal: "STJ", classe: "REsp", numero: "903", tese: "Tese 2020 b.", data: "2020-07-07" }, B, "Princípios");
    try { api.loja.setItem("eac_jbb_vista", "lista"); } catch (e) {}
    api.jurBibAbrir();
    ok(api.$("jurBibMapa").hidden === true && api.$("btnJurBibVistaLista").getAttribute("aria-pressed") === "true", "M1 a biblioteca abre na lista");
    api.$("btnJurBibVistaMapa").onclick();
    ok(api.$("jurBibMapa").hidden === false && api.$("jurBibLista").hidden === true && api.$("btnJurBibVistaMapa").getAttribute("aria-pressed") === "true", "M2 'Mapa' troca a lista pelo mapa");
    ok(api.$("jmpAno_2018") && api.$("jmpAno_2019") && /vazia/.test(cls(api.$("jmpAno_2019"))) && api.$("jmpAno_2020") && /2 julgado/.test(api.$("jmpAno_2020").title),
      "M3 uma barra por ano, inclusive o ano sem julgado no meio: " + api.$("jmpAno_2020").title);
    ok(/sem ano guardado/.test(api.$("jurBibMapa").textContent), "M3a os sem ano são ditos (fora da linha)");
    api.$("jmpAno_2020").onclick();
    ok(api.jmpPeriodo().de === "2020" && api.jurBibFiltrados().length === 2 && /Período: 2020/.test(api.$("jurBibChips").textContent), "M4 tocar num ano filtra por ele (e vira chip)");
    api.$("jmpAno_2018").onclick();
    ok(api.jmpPeriodo().de === "2018" && api.jmpPeriodo().ate === "2020" && api.jurBibFiltrados().length === 3, "M5 tocar num segundo ano escolhe o período");
    api.$("btnJbbChip_anos").onclick();
    ok(!api.jmpPeriodo() && api.jurBibFiltrados().length > 3, "M6 o chip tira o período");
    /* os temas */
    const tile = api.$("jurBibMapa").querySelectorAll(".jmp-tile").find((b) => /Limitações/.test(b.textContent));
    ok(tile && /\d/.test(tile.textContent), "M7 os tópicos viram blocos com o número de julgados");
    tile.onclick();
    ok(api.$("jurBibMapa").hidden === true && api.$("jurBibLista").hidden === false && /^t:/.test(api.jurBibAtual().assunto || "") && api.jurBibFiltrados().every((j) => (j.topicos || []).indexOf(A) >= 0),
      "M8 tocar num tópico filtra por ele e volta para a lista");
    api.$("btnJurBibVistaMapa").onclick();
    ok(/não é o acervo do tribunal/.test(api.$("jurBibMapa").textContent), "M9 o mapa diz de onde vêm os números");
    ok(api.$("jurBibMapa").querySelectorAll(".jmp-tile.sel").length === 1, "M9a o tópico escolhido aparece marcado no mapa");
    ["jmp_vista_lista", "jmp_vista_mapa", "jmp_vistas_aj", "jmp_tempo_tit", "jmp_tempo_expl", "jmp_tempo_vazio", "jmp_ano_aj", "jmp_periodo", "jmp_sem_ano", "jmp_chip_periodo",
      "jmp_temas_tit", "jmp_temas_expl", "jmp_temas_vazio", "jmp_sem_topico", "jmp_disc_aj", "jmp_top_aj", "jmp_fonte"].forEach((k2) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k2) && api.t(k2) !== k2, "M10 falta " + k2 + " em " + l); }));
    api.setLanguage("pt");
    api.jmpVistaTrocar("lista");
  }

  return falhas;
}

module.exports = { testes };
