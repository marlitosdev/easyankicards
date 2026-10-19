/* =====================================================================
 * TRÊS PENDÊNCIAS (v18.91.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. a optativa NÃO escolhida sai da Cobertura e do Domínio (como já saía do plano); sem escolha, as duas contam;
 *  2. o histórico de blocos de questões guarda quantos acertos foram no chute e a linha diz "(N no chute)";
 *  3. a ficha do tópico mostra o Domínio: a cor, o porquê e a ação que mais ajuda (refazer as erradas, medir…).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test(e.className || "");

  /* ---- 1: optativa ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const CFO = ["# CFO PM-PE | prova: 2027-02-21 | horas: 20",
      "@ Direito Penal :: 10q", "+ Lei penal :: 5",
      "@ Língua Estrangeira Espanhol :: 5q | escolha: Língua Estrangeira", "+ Gramática :: 3",
      "@ Língua Estrangeira Inglês :: 5q | escolha: Língua Estrangeira", "+ Grammar :: 3"].join("\n");
    const sem = a.edCriar("CFO sem escolha", CFO);
    const com = a.edCriar("CFO com escolha", a.edDefinirEscolha(CFO, "Língua Estrangeira", "Língua Estrangeira Inglês"));
    const nomes = (m) => m.disciplinas.map((d) => d.nome).join(" | ");
    const cSem = a.covDoEdital(sem, []), cCom = a.covDoEdital(com, []);
    ok(cSem.disciplinas.length === 3 && cCom.disciplinas.length === 2 && !/Espanhol/.test(nomes(cCom)) && /Inglês/.test(nomes(cCom)),
      "P1 Cobertura: sem escolha as duas línguas contam; escolhido o Inglês, o Espanhol sai: " + nomes(cCom));
    const pesoIng = cCom.disciplinas.find((d) => /Inglês/.test(d.nome)).pesoPct, pesoPen = cCom.disciplinas.find((d) => /Penal/.test(d.nome)).pesoPct;
    ok(Math.abs(pesoIng + pesoPen - 100) < 0.5 && Math.abs(pesoPen - 66.7) < 0.5, "P1a o peso se refaz sem a não escolhida (Penal 10q de 15q = 66,7%): " + pesoPen.toFixed(1));
    const dCom = a.domDoEdital(com);
    ok(dCom.disciplinas.length === 2 && !dCom.folhas.some((f) => /Espanhol/.test(f.disciplina)), "P1b Domínio: a não escolhida não aparece nem entra na fila");
  }

  /* ---- 2: histórico com chutes ---- */
  {
    const { api: a } = rodar();
    a.qsUiIniciar();
    a.qhIniciar([{ id: "a" }, { id: "b" }, { id: "c" }], { origem: "aba", filtro: {} });
    a.qhAtualizar({ feitas: 3, certas: 2, chutes: 1 });
    const h = a.qhTodos()[0];
    ok(h.chutes === 1 && a.qhResumo(7).chutes === 1, "P2 o bloco guarda os acertos no chute (e o resumo os soma)");
    a.qsUiHistRender();
    const txt = a.$("qsHistLista") ? a.$("qsHistLista").textContent : "";
    ok(txt.indexOf(a.t("qs_hist_linha", { f: 3, tot: 3, pct: "67%" }) + a.t("qs_placar_chutes", { n: 1 })) >= 0, "P2a a linha do histórico diz '(1 no chute)': " + txt.slice(0, 120));
    a.qhIniciar([{ id: "d" }], { origem: "aba", filtro: {} });
    ok(a.qhTodos()[0].chutes === 0, "P2b bloco novo nasce com chutes = 0 (todos os blocos têm os mesmos campos)");
  }

  /* ---- 3: o próximo passo na ficha ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar(); a.qsUiIniciar();
    const ed = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Licitações :: 5", "+ Lei 14.133 :: 5", "+ Convênios :: 2"].join("\n"));
    a.hubAbrirEdital(ed.id);
    const ch = a.matChave("Licitações", "Lei 14.133");
    [["a", false], ["b", false], ["c", false], ["d", true], ["e", true], ["f", true]].forEach(([id, ac], i) => a.qsTodas().push({ id, tipo: "ce", enunciado: "Q " + id, gabarito: "C", comentario: "", disciplina: "Licitações", topico: "Lei 14.133", chave: ch, tentativas: [{ acertou: ac, q: "2026-10-1" + i }] }));
    a.matGravar(ch, "Resumo.", { disciplina: "Licitações", topico: "Lei 14.133" });
    a.edAbrirFicha("Licitações", "Lei 14.133");
    const box = a.$("matFichaPasso");
    const ac1 = achar(box, (e) => cls(e, "dom-acao-1"))[0];
    ok(box.hidden === false && cls(box, "dom-b-vermelho") && achar(box, (e) => cls(e, "dom-nivel"))[0].textContent === a.t("dom_n_vermelho") && /acerto 50%/.test(box.textContent),
      "P3 a ficha mostra o domínio do tópico (vermelho, 3 de 6) e o porquê: " + box.textContent);
    ok(ac1 && ac1.textContent === a.t("dom_ac1_erradas", { n: 3 }), "P3a e a ação que mais ajuda: refazer as 3 erradas");
    ac1.onclick();
    ok(a.$("dlgMatFicha").open === false && a.$("dlgQsResponder").open === true && a.qsSessaoAtual().fila.length === 3, "P3b agir fecha a ficha e abre a rodada das erradas");
    a.$("dlgQsResponder").close();
    a.edAbrirFicha("Licitações", "Convênios");
    ok(a.$("matFichaPasso").hidden === false && !achar(a.$("matFichaPasso"), (e) => cls(e, "dom-acao-1")).length && /ainda não estudado/.test(a.$("matFichaPasso").textContent),
      "P3c não estudado: a ficha diz a cor e o motivo, sem botão (o material já está na própria ficha)");
    achar(a.$("matFichaPasso"), (e) => cls(e, "dom-nivel"))[0].onclick();
    ok(a.$("dlgDominio").open === true && a.$("dlgMatFicha").open === false, "P3d tocar na cor abre o Domínio no tópico");
  }
  return falhas;
}

module.exports = { testes };
