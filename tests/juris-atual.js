/* =====================================================================
 * A JURISPRUDÊNCIA CONTINUA VALENDO? (v18.42.0, JM4)
 *
 * Súmula cancelada, tema revisto, entendimento superado: a tese guardada
 * pode estar errada hoje. Na biblioteca de julgados: copiar o pedido (com
 * a lista filtrada), colar a resposta JSON, conferir um a um (antes/depois
 * da tese), aplicar com desfazer. "nao_sei" não grava nada. O selo da
 * situação aparece na gaveta, na biblioteca e na prévia da citação.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const D = "Tributário", T = "Limitações";
  const montar = () => {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(D, T);
    const g = (dados) => { const j = api.jurGravar(dados); api.jurLigar(j.id, ch, D, T); return api.jurDe(j.id); };
    const a = g({ tribunal: "STF", classe: "Súmula", numero: "100", tese: "Tese velha A." });
    const b = g({ tribunal: "STJ", classe: "Tema", numero: "200", tese: "Tese B.", conferidoEm: "2026-09-01" });
    const c = g({ tribunal: "STF", classe: "RE", numero: "300", tese: "Tese C." });
    return { api, a, b, c };
  };
  const resposta = (a, b, c) => JSON.stringify({ julgados: [
    { id: a.id, situacao: "superada", tese_atual: "Tese nova A.", fonte: "RE 999, Tema 9", data: "2025-05-01", explicacao: "O STF mudou." },
    { id: b.id, situacao: "vigente", fonte: "", explicacao: "Continua." },
    { id: c.id, situacao: "nao_sei", explicacao: "Conferir no site." },
    { id: "inventado", situacao: "vigente" },
  ] });

  /* A1: motor puro — "a rever", fora de vigor, pedido e leitura */
  {
    const { api, a, b, c } = montar();
    ok(api.jurPrecisaRever(a) === true && api.jurPrecisaRever(b, "2026-10-14") === false && api.jurPrecisaRever(b, "2027-05-01") === true,
       "A1 'a rever' = nunca verificado ou há mais de 180 dias");
    const p = api.jurAtualPedido([a, b]);
    ok(p.indexOf("id: " + a.id) >= 0 && /STF Súmula 100/.test(p) && /tese: Tese velha A\./.test(p) && /NÃO INVENTE/.test(p) && /"julgados"/.test(p), "A1a o pedido leva id, tribunal, número e tese, e as regras");
    const r = api.jurAtualLer(resposta(a, b, c), [a, b, c]);
    ok(r.est === "ok" && r.itens.length === 3 && r.fora === 1, "A1b lê os 3 do pedido e ignora o id que não estava nele: " + JSON.stringify({ e: r.est, n: r.itens.length, f: r.fora }));
    const ia = r.itens.find((x) => x.id === a.id), ic = r.itens.find((x) => x.id === c.id);
    ok(ia.muda === true && ia.marcado === true && ic.marcado === false, "A1c superada com tese nova = muda; 'nao_sei' vem desmarcado");
    ok(api.jurAtualLer("```json\n" + resposta(a, b, c) + "\n```", [a, b, c]).est === "ok" && api.jurAtualLer("isto não é json", [a]).est === "erro" && api.jurAtualLer("", [a]).est === "vazio",
       "A1d aceita a cerca de markdown; texto sem JSON é erro; vazio é vazio");
    ok(api.jurAtualLer(JSON.stringify([{ id: a.id, situacao: "esquisita" }]), [a]).itens[0].situacao === "nao_sei", "A1e situação desconhecida vira 'nao_sei'");
    const rv = api.jurAtualLer(JSON.stringify([{ id: a.id, situacao: "vigente", tese_atual: "Outra redação." }, { id: b.id, situacao: "alterada", tese_atual: "Tese B." }]), [a, b]);
    ok(rv.itens.every((x) => x.muda === false), "A1f só troca a tese quando ALTERADA/SUPERADA e a tese atual é diferente (vigente com tese_atual não troca; alterada com a mesma tese não troca)");
  }

  /* A2: aplicar e desfazer */
  {
    const { api, a, b, c } = montar();
    const r = api.jurAtualLer(resposta(a, b, c), [a, b, c]);
    const rec = api.jurAtualAplicar(r.itens, "2026-10-14");
    const A = api.jurDe(a.id), B = api.jurDe(b.id), C = api.jurDe(c.id);
    ok(rec.length === 2 && A.situacao === "superada" && A.tese === "Tese nova A." && A.teseAnterior === "Tese velha A." && A.conferidoEm === "2026-10-14" && /RE 999/.test(A.situacaoFonte),
       "A2 superada: troca a tese, guarda a antiga, a fonte e a data: " + JSON.stringify({ s: A.situacao, t: A.tese, ant: A.teseAnterior }));
    ok(B.situacao === "vigente" && B.tese === "Tese B." && B.conferidoEm === "2026-10-14", "A2a vigente: só a situação e a data");
    ok(!C.situacao && !C.conferidoEm, "A2b 'nao_sei' não grava nada (nem a data)");
    ok(api.jurForaDeVigor(A) && !api.jurForaDeVigor(B), "A2c fora de vigor: superada sim, vigente não");
    const forcado = api.jurAtualLer(resposta(a, b, c), [a, b, c]).itens.filter((x) => x.id === c.id).map((x) => Object.assign(x, { marcado: true }));
    ok(api.jurAtualAplicar(forcado, "2026-10-14").length === 0 && !api.jurDe(c.id).conferidoEm, "A2e 'nao_sei' nunca grava, mesmo marcado");
    const n = api.jurAtualDesfazer(rec);
    const A2 = api.jurDe(a.id), B2 = api.jurDe(b.id);
    ok(n === 2 && A2.tese === "Tese velha A." && !A2.situacao && !A2.teseAnterior && B2.conferidoEm === "2026-09-01", "A2d desfazer volta tudo ao que era");
  }

  /* A3: a tela, na biblioteca */
  {
    const { api, a, b, c } = montar();
    api.jurBibAbrir();
    ok(/verificar se continuam valendo \(3\)/.test(api.$("btnJurBibAtual").textContent) && /2 julgado\(s\) estão a rever/.test(api.$("btnJurBibAtual").title), "A3 o botão diz quantos vai verificar e quantos estão a rever: " + api.$("btnJurBibAtual").title);
    api.$("jurBibSit").value = "rever"; api.$("jurBibSit").onchange();
    ok(api.jurBibFiltrados().map((j) => j.numero).sort().join() === "100,300", "A3a o filtro 'a rever' (nunca verificados)");
    api.$("jurBibSit").value = ""; api.$("jurBibSit").onchange();
    api.$("btnJurBibAtual").onclick();
    ok(api.$("jurBibAtual").hidden === false && api.$("jurBibLista").hidden === true && /3 julgado/.test(api.$("jurBibAtualIntro").textContent), "A3b o painel toma o lugar da lista");
    api.$("btnJurBibAtualPedido").onclick();
    const ped = api.$("jurBibAtualPedidoTxt").value;
    ok(api.$("jurBibAtualPedidoTxt").hidden === false && ped.indexOf(a.id) >= 0 && ped.indexOf(c.id) >= 0, "A3c o pedido aparece (para copiar à mão se preciso)");
    api.$("jurBibAtualResp").value = ped; api.$("jurBibAtualResp").oninput();
    ok(/PEDIDO/.test(api.$("jurBibAtualSem").textContent) && api.$("btnJurBibAtualAplicar").hidden === true, "A3d colar o pedido é avisado");
    api.$("jurBibAtualResp").value = resposta(a, b, c); api.$("jurBibAtualResp").oninput();
    ok(/3 julgado\(s\) lidos: 1 vigente\(s\), 1 com mudança, 1 sem certeza/.test(api.$("jurBibAtualSem").textContent) && api.$("btnJurBibAtualAplicar").textContent === "Aplicar 2",
       "A3e o semáforo resume e o botão diz quantos: " + api.$("jurBibAtualSem").textContent + " | " + api.$("btnJurBibAtualAplicar").textContent);
    const prev = api.$("jurBibAtualPrev").querySelectorAll(".jur-atual-item");
    ok(prev.length === 3 && prev.some((x) => x.querySelectorAll(".jur-atual-antes").length && /Tese nova A\./.test(x.textContent)), "A3f a prévia mostra antes/depois da tese");
    api.$("jurAtualCk_1").checked = false; api.$("jurAtualCk_1").onchange();
    ok(api.$("btnJurBibAtualAplicar").textContent === "Aplicar 1", "A3g desmarcar tira da conta");
    api.$("btnJurBibAtualAplicar").onclick();
    ok(api.jurDe(a.id).situacao === "superada" && !api.jurDe(b.id).situacao && /1 julgado\(s\) atualizados/.test(api.$("jurBibAtualFeito").textContent) && api.$("btnJurBibAtualDesfazer").hidden === false,
       "A3h aplica só os marcados e oferece desfazer: " + api.$("jurBibAtualFeito").textContent);
    api.$("btnJurBibAtualDesfazer").onclick();
    ok(!api.jurDe(a.id).situacao && api.jurDe(a.id).tese === "Tese velha A.", "A3i desfazer pela tela");
    api.$("btnJurBibAtualSair").onclick();
    ok(api.$("jurBibAtual").hidden === true && api.$("jurBibLista").hidden === false, "A3j voltar à lista");
  }

  /* A4: os selos — gaveta, biblioteca, prévia da citação */
  {
    const { api, a, b, c } = montar();
    api.jurAtualAplicar(api.jurAtualLer(resposta(a, b, c), [a, b, c]).itens, "2026-10-14");
    api.jurAbrir(D, T, "ler");
    const selos = api.$("jurLista").querySelectorAll(".jur-sit");
    ok(selos.length === 1 && selos[0].textContent === "superada" && /RE 999/.test(selos[0].title) && /Tese velha A\./.test(selos[0].title), "A4 a gaveta mostra 'superada' (só nos fora de vigor), com fonte e tese antiga no balão: " + selos.map((x) => x.textContent).join());
    api.$("dlgJuris").close();
    api.jurBibAbrir();
    const linhas = api.$("jurBibLista").querySelectorAll(".jur-bib-item");
    ok(linhas.some((li) => /superada/.test(li.textContent) && /verificado em 14\/10\/2026/.test(li.textContent)) && linhas.some((li) => /nunca verificado/.test(li.textContent)), "A4a a biblioteca diz a situação e quando foi verificado");
    api.$("jurBibSit").value = "fora"; api.$("jurBibSit").onchange();
    ok(api.jurBibFiltrados().map((j) => j.numero).join() === "100", "A4b filtro 'superados, cancelados ou alterados'");
    ok(api.t("jur_cit_fora", { s: "superada", f: "RE 999" }).indexOf("Atenção") >= 0, "A4c o aviso da prévia existe");
  }

  /* A5: textos nos dois idiomas */
  {
    const { api } = rodar();
    ["jur_atual_btn", "jur_atual_prompt", "jur_atual_sem_ok", "jur_atual_aplicar", "jur_atual_feito", "jur_sit_vigente", "jur_sit_superada", "jur_sit_cancelada", "jur_sit_alterada", "jur_sit_nao_sei", "jur_verif_em", "jur_verif_nunca", "jur_cit_fora", "jur_bib_sit_rever", "jur_bib_sit_fora"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "A5 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
