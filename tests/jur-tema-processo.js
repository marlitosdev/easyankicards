/* =====================================================================
 * TEMA + PROCESSO NO MESMO JULGADO (v19.6.0)
 *
 * O RELATO: "a vinculação de julgado não previamente registrado não está funcionando; a existência de TEMA xxx + ARE
 * xxxxx tem confusão: o ARE está com vínculo mas o tema aparece para preencher; ao tentar vincular não consigo. No
 * julgado, os campos de TEMA + tipo de ação vinculada devem ser nítidos com ambos."
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o julgado tem o campo TEMA ao lado de classe/número, e as duas são identidade: "Tema 1140" e "RE 1320054" acham
 *     o mesmo julgado; o guardado à moda antiga ("Tema 1134 (REsp 1.914.902/SP)") abre em dois campos nítidos;
 *  2. "Tema 1140 (RE 1320054)", "Tema 211 do STF - RE 648.245", "RE 688.223 / Tema 590" formam PAR; tema ao lado de tema não;
 *  3. com o processo guardado, a prévia do tema oferece "é o mesmo julgado — juntar" (e não criar outro); juntar faz o
 *     tema abrir o julgado em todo o material;
 *  4. criar pela prévia do tema, com a IA devolvendo o processo, guarda OS DOIS — e o link do tema acha o novo;
 *     criar com outro número (a IA trocou) deixa o trecho LIGADO ao novo, nunca "não guardado" logo depois;
 *  5. "já existe parecido" reconhece o tema guardado no processo; os pendentes não contam o par como dois.
 * Casos tirados do material real (backup de 19/10/2026).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const DISC = "Sistema Tributário Brasileiro", TOP = "Limitações ao poder de tributar";
  const conduzir = async (api, promessa) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };

  /* ---- 1: identidade e campos ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1320054", tema: "1140", tese: "Empresas públicas delegatárias de serviço público têm imunidade recíproca." });
    const acha = (txt) => { const c = api.jurCitacoesNoTexto(txt)[0]; const r = api.jurAcharCitado(c); return r.julgado && r.julgado.id; };
    ok(acha("Tema 1140 de Repercussão Geral") === j.id && acha("RE 1.320.054") === j.id, "T1 o tema e o processo acham o MESMO julgado");
    ok(api.jurIdentidadesDe(j)[0].cc === "tema", "T1a o tema é a primeira identidade (é por ele que o catálogo acha o precedente)");
    ok(api.jurIdentTexto(j) === "RE 1320054 · Tema 1140" && /STF RE 1320054 · Tema 1140/.test(api.jurTitulo(j)), "T1b os dois aparecem ao ler: " + api.jurIdentTexto(j));
    const velho = { classe: "Tema Repetitivo", numero: "Tema 1134 (REsp 1.914.902/SP)" };
    const sp = api.jurSepararTemaProcesso(velho);
    ok(sp && sp.tema === "1134" && sp.classe === "REsp" && sp.numero === "1.914.902/SP", "T1c o guardado num campo só separa em processo e tema: " + JSON.stringify(sp));
    ok(api.jurIdentPartes(velho).proc === "REsp 1.914.902/SP" && api.jurIdentPartes(velho).tema === "1134", "T1d ao ler, o antigo também sai em duas partes");
    ok(api.jurSepararTemaProcesso({ classe: "Tema", numero: "863 / 827" }) === null && api.jurSepararTemaProcesso({ classe: "RE", numero: "1" }) === null,
      "T1e dois temas, ou processo sem tema: fica como está");
    ok(api.jurTemaNums("Tema 1.108") + "" === "1108" && api.jurTemaNums("863 / 827") + "" === "863,827", "T1f números do tema");
    /* a resposta da IA: o processo que fixou o tema vai para classe/número, o tema para o campo dele */
    const a1 = api.jurDoJson('{"tribunal":"STF","classe":"Tema","numero":"1140","processo_paradigma":"RE 1.320.054","tese_curta":"x"}');
    ok(a1.classe === "RE" && a1.numero === "1.320.054" && a1.tema === "1140", "T1g IA: tema + processo_paradigma → os dois campos: " + JSON.stringify([a1.classe, a1.numero, a1.tema]));
    const a2 = api.jurDoJson('{"tribunal":"STF","classe":"ARE","numero":"800395","tema":"Tema 999","tese_curta":"x"}');
    ok(a2.classe === "ARE" && a2.tema === "999", "T1h IA: processo com tema");
  }

  /* ---- 1b: o formulário (editar o antigo abre separado; guardar grava separado) ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    const j = api.jurGravar({ tribunal: "STJ", classe: "Tema Repetitivo", numero: "Tema 1134 (REsp 1.914.902/SP)", tese: "O arrematante não responde pelos débitos de IPTU anteriores.", topicos: [ch] });
    api.jurAbrir(DISC, TOP);
    api.jurEditar(j.id);
    ok(api.$("jurClasse").value === "REsp" && api.$("jurNumero").value === "1.914.902/SP" && api.$("jurTema").value === "1134",
      "F1 editar o antigo abre processo e tema em campos separados: " + [api.$("jurClasse").value, api.$("jurNumero").value, api.$("jurTema").value].join(" | "));
    ok(!api.$("jurColarAviso").hidden && /campos separados/.test(api.$("jurColarAviso").textContent), "F1a e diz que separou");
    await conduzir(api, api.jurSalvar());
    const s = api.jurDe(j.id);
    ok(s.classe === "REsp" && s.tema === "1134" && s.numero === "1.914.902/SP", "F2 guardado nos dois campos: " + JSON.stringify([s.classe, s.numero, s.tema]));
    const r = api.jurAcharCitado(api.jurCitacoesNoTexto("Tema 1134 do STJ")[0]);
    ok(r.julgado && r.julgado.id === j.id && r.via === "eh", "F2a o tema continua achando o julgado (agora como identidade, não paradigma)");
    ok(api.$("jurTema") && api.$("jurOrigem_tema"), "F3 o formulário tem o campo do tema");
  }

  /* ---- 2: pares no texto ---- */
  {
    const { api } = rodar();
    const par = (txt) => api.citJuntarJulgados(txt, [], "").map((c) => c.texto.trim() + (c._par ? "=" + c._par.texto.trim() : ""));
    ok(par("conforme o Tema 1140 de Repercussão Geral (RE 1320054), x").join("|") === "Tema 1140=RE 1320054|RE 1320054=Tema 1140",
      "P1 tema (processo): " + par("conforme o Tema 1140 de Repercussão Geral (RE 1320054), x").join("|"));
    ok(par("Tema 211 do STF - RE 648.245").length === 2 && par("Tema 211 do STF - RE 648.245").every((x) => /=/.test(x)), "P2 tema - processo: " + par("Tema 211 do STF - RE 648.245").join("|"));
    ok(par("RE 688.223 / Tema 590").every((x) => /=/.test(x)), "P3 processo / tema");
    ok(par("Tema 32/RG (RE 566.621)").every((x) => /=/.test(x)), "P3a Tema 32/RG (RE …)");
    const t3 = par("Tema 863 do STF - Tema 214 do STF (RE 582.461)");
    ok(t3[0] === "Tema 863 do STF" && /Tema 214.*=RE 582\.461/.test(t3[1]), "P4 tema ao lado de tema não é par; o 214 é par do RE: " + t3.join("|"));
    ok(par("o Tema 1140 trata disso. Já o RE 1320054 é outro assunto").every((x) => !/=/.test(x)), "P5 separados por uma frase não são par");
    ok(par("Súmula 435 do STJ (REsp 1.371.128)").every((x) => !/=/.test(x)), "P6 súmula não forma par");
  }

  /* ---- 3: processo guardado, tema não: a prévia oferece juntar ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    const re = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1320054", tese: "Delegatárias de serviço público têm imunidade recíproca.", topicos: [ch] });
    const txt = "* A imunidade recíproca alcança as delegatárias (Tema 1140 de Repercussão Geral (RE 1320054)).";
    api.matGravar(ch, txt, { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const links = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link");
    const tema = () => links().filter((b) => /^Tema 1140/.test(b.textContent))[0];
    ok(links().length === 2 && /jur-cit-sem/.test(tema().className), "J1 antes: o RE abre, o tema aparece como não guardado");
    ok(api.jurCitPendentes(txt, ch).length === 0, "J1a o tema com o processo guardado ao lado não é 'pendente de criar' (é de juntar)");
    tema().onclick({ stopPropagation() {} });
    const bt = api.$("jurCitaCorpo").querySelectorAll("button").filter((b) => b.id === "btnJurCitaJuntar")[0];
    ok(bt && /mesmo julgado/.test(bt.textContent) && /RE 1320054/.test(api.$("jurCitaCorpo").textContent), "J2 a prévia do tema oferece juntar ao RE guardado: " + api.$("jurCitaCorpo").textContent.slice(0, 200));
    bt.onclick();
    ok(api.jurDe(re.id).tema === "1140" && api.jurLista().length === 1, "J3 juntar grava o tema no RE (sem criar outro julgado)");
    ok(/Tese|tese/.test(api.$("jurCitaCorpo").textContent) && /Tema 1140/.test(api.$("jurCitaMeta").textContent), "J3a a prévia passa a mostrar o julgado, com o tema: " + api.$("jurCitaMeta").textContent);
    ok(!/jur-cit-sem/.test(tema().className), "J3b o link do tema, no resumo atrás, passa a achar o julgado");
    ok(api.jurAcharCitado(api.jurCitacoesNoTexto("ver o Tema 1140 do STF")[0]).julgado.id === re.id, "J3c e vale em todo o material (não é vínculo do trecho)");
    /* a prévia do RE já não oferece juntar o que já está junto */
    links().filter((b) => /^RE/.test(b.textContent))[0].onclick({ stopPropagation() {} });
    ok(!api.$("jurCitaCorpo").querySelectorAll("button").filter((b) => b.id === "btnJurCitaJuntar")[0], "J4 depois de juntar, nada a oferecer");
  }

  /* ---- 3b: a prévia do PROCESSO oferece juntar o tema citado junto; recusas ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    const re = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "603136", tese: "Incide ISS no licenciamento de software.", topicos: [ch] });
    const c = api.citJuntarJulgados("Tema 300 do STF - RE 603.136", [], ch).filter((x) => /^RE/.test(x.texto))[0];
    api.jurCitPreviewAbrir(c, api.jurAcharCitado(c, null, ch), { disciplina: DISC, topico: TOP });
    const bt = api.$("jurCitaCorpo").querySelectorAll("button").filter((b) => b.id === "btnJurCitaJuntar")[0];
    ok(bt && /Tema 300/.test(bt.textContent) && /ainda não abre/.test(api.$("jurCitaCorpo").textContent), "J5 na prévia do RE: 'juntar Tema 300 a este julgado'");
    bt.onclick();
    ok(api.jurDe(re.id).tema === "300", "J5a juntou pelo lado do processo");
    /* tema guardado como Tema, processo citado ao lado: o processo entra e o tema vai para o campo dele */
    const tm = api.jurGravar({ tribunal: "STF", classe: "Tema", numero: "211", tese: "A majoração do valor venal exige lei." });
    const r = api.jurJuntarIdentidade(tm.id, { classe: "RE", numero: "648.245", tribunal: "STF" });
    const t2 = api.jurDe(tm.id);
    ok(r.ok && t2.classe === "RE" && t2.numero === "648.245" && t2.tema === "211", "J6 juntar o processo a um tema: " + JSON.stringify([t2.classe, t2.numero, t2.tema]));
    ok(api.jurJuntarIdentidade(re.id, { classe: "Tema", numero: "999", tribunal: "STF" }).motivo === "outro_tema", "J7 já tem outro tema: recusa");
    ok(api.jurJuntarIdentidade(re.id, { classe: "Tema", numero: "300", tribunal: "STJ" }).motivo === "tribunal", "J7a tribunal diferente: recusa");
    ok(!api.jurJuntarIdentidade(re.id, { classe: "Súmula", numero: "300" }).ok, "J7b súmula não se junta");
  }

  /* ---- 4: criar pela prévia do tema ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    api.matGravar(ch, "* Delegatárias de serviço público são imunes (Tema 1140 de Repercussão Geral).", { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const lk = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link")[0];
    lk().onclick({ stopPropagation() {} });
    api.$("btnJurCitaCriar").onclick();
    api.$("btnJurCitaPedido").onclick();
    ok(/"tema"/.test(api.$("jurCitaPedidoTxt").value) && /processo_paradigma/.test(api.$("jurCitaPedidoTxt").value), "C1 o pedido à IA pede o tema e o processo que o fixou");
    api.$("jurCitaResp").value = '{"tribunal":"STF","classe":"RE","numero":"1320054","tese_curta":"Empresas públicas delegatárias de serviço público são imunes.","certeza_da_tese":"alta"}';
    api.$("jurCitaResp").oninput();
    api.$("btnJurCitaGuardar").onclick();
    const g = api.jurLista()[0];
    ok(api.jurLista().length === 1 && g.classe === "RE" && g.numero === "1320054" && g.tema === "1140", "C2 a IA devolveu o RE: o julgado guarda o RE E o tema citado: " + JSON.stringify(g && [g.classe, g.numero, g.tema]));
    ok(!/jur-cit-sem/.test(lk().className), "C2a o link do tema acha o julgado criado (era o defeito: continuava 'não guardado')");
    ok(api.$("dlgJurCitaPreview").open && /RE 1320054 · Tema 1140/.test(api.$("jurCitaMeta").textContent), "C2b a prévia mostra os dois: " + api.$("jurCitaMeta").textContent);
  }
  {
    /* a IA trocou o número: o trecho fica ligado ao que foi criado */
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    api.matGravar(ch, "* Ver o ARE 800.395 sobre a prova do uso do imóvel.", { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    const lk = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link")[0];
    lk().onclick({ stopPropagation() {} });
    api.$("btnJurCitaCriar").onclick();
    api.$("jurCitaResp").value = '{"tribunal":"STF","classe":"ARE","numero":"800395 AgR","tese_curta":"A prova do desvio de finalidade cabe ao fisco.","certeza_da_tese":"alta"}';
    api.$("jurCitaResp").oninput();
    api.$("btnJurCitaGuardar").onclick();
    const g = api.jurLista()[0];
    ok(g && !/jur-cit-sem/.test(lk().className), "C3 criado pela citação, o link sempre abre o julgado novo");
    api.jurApagar(g.id);
    /* a IA devolveu OUTRO número (a pessoa guardou mesmo assim): o trecho fica ligado ao novo, nunca "não guardado" */
    lk().onclick({ stopPropagation() {} });
    api.$("btnJurCitaCriar").onclick();
    api.$("jurCitaResp").value = '{"tribunal":"STF","classe":"ARE","numero":"800396","tese_curta":"A prova do desvio de finalidade cabe ao fisco.","certeza_da_tese":"alta"}';
    api.$("jurCitaResp").oninput();
    api.$("btnJurCitaGuardar").onclick();
    const g2 = api.jurLista().filter((x) => x.numero === "800396")[0];
    ok(g2 && !/jur-cit-sem/.test(lk().className) && api.jurAcharCitado(api.citJuntarJulgados("Ver o ARE 800.395 sobre", [], ch)[0], null, ch).julgado.id === g2.id,
      "C3a a IA trocou o número: o trecho citado fica ligado ao julgado criado");
    api.jurApagar(g2.id);
    const c2 = api.jurCitacoesNoTexto("Tema 777 do STF")[0];
    api.jurCitPreviewAbrir(c2, { julgado: null }, { disciplina: DISC, topico: TOP });
    api.$("btnJurCitaCriar").onclick();
    api.$("jurCitaResp").value = '{"tribunal":"STF","classe":"RE","numero":"555555","tese_curta":"Outra tese qualquer de teste.","certeza_da_tese":"alta"}';
    api.$("jurCitaResp").oninput();
    api.$("btnJurCitaGuardar").onclick();
    const n = api.jurLista().filter((x) => x.numero === "555555")[0];
    const lig = api.citJuntarJulgados("como diz o Tema 777 do STF", [], ch)[0];
    ok(n && n.tema === "777" && api.jurAcharCitado(lig, null, ch).julgado.id === n.id, "C4 tema citado + processo da IA: o tema entra no julgado e o acha");
  }

  /* ---- 5: parecidos e pendentes ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const re = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1320054", tema: "1140", tese: "x y z" });
    const p = api.jurParecidos({ tribunal: "STF", classe: "Tema", numero: "1140", tese: "" });
    ok(p.length === 1 && p[0].j.id === re.id && p[0].motivo === "mesmo", "S1 criar 'Tema 1140' acusa o RE guardado com esse tema");
    ok(api.jurParecidos({ tribunal: "STJ", classe: "Tema", numero: "1140" }).length === 0, "S1a outro tribunal não é o mesmo");
    const ch = api.matChave(DISC, TOP);
    const pend = api.jurCitPendentes("Tema 1.093 do STF (RE 1.287.019) e a Súmula 999 do STJ", ch);
    ok(pend.length === 2 && /Tema 1\.093/.test(pend[0].texto) && pend[0]._par && /RE 1\.287\.019/.test(pend[0]._par.texto),
      "S2 o tema e o processo citados juntos são UM julgado pendente: " + pend.map((c) => c.texto).join(" | "));
    const ped = api.jurCitaPedido({ c: pend[0], base: { topico: TOP } }, "");
    ok(/JUNTO DE "RE 1\.287\.019"/.test(ped), "S3 o pedido de um diz do outro");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["jur_c_tema", "jur_c_tema_aj", "jur_sel_tema_aj", "jur_ed_separado", "jur_cit_par_dica", "jur_cit_par_juntar", "jur_cit_par_juntar_neste", "jur_cit_par_ambos",
      "jur_cit_par_neste", "jur_cit_par_feito", "jur_cit_par_falhou", "jur_cit_par_catalogo", "jur_cn_par_bloco", "jur_cit_par_m_outro"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
