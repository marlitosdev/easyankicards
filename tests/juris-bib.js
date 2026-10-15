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
    const li = itens(api).find((x) => /RE 111/.test(x.textContent));
    const bL = li.querySelectorAll("button").find((b) => b.id === "btnJurBibLigar_" + re.id);
    bL.onclick();
    const sel = api.$("jurBibLista").querySelectorAll("select").find((s) => s.id === "jurBibLigarSel_" + re.id);
    const vals = sel ? sel.children.map((o) => o.value) : [];
    ok(sel && vals.indexOf(C) >= 0 && vals.indexOf(api.matChave(D, "Limitações")) < 0, "B8 '＋ outro tópico' oferece os tópicos onde ele ainda não está: " + vals.join(" | "));
    sel.value = C; sel.onchange();
    ok(api.jurDe(re.id).topicos.indexOf(C) >= 0 && grupos(api).some((g) => /Lançamento \(1\)/.test(g)), "B8a escolher liga o julgado ao tópico, e a lista já mostra");
    const li2 = itens(api).find((x) => /RE 111/.test(x.textContent));
    const top = li2.querySelectorAll("button").find((b) => /jur-bib-top/.test(cls(b)));
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
  return falhas;
}

module.exports = { testes };
