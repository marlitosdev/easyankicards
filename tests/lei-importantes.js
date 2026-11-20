/* =====================================================================
 * ★ OS ARTIGOS IMPORTANTES DA LEI, PARA O EDITAL (19.189.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  I1. a resposta da IA se lê: intervalos ("Arts. 1 a 5"), listas ("12, 14 e 16"), um por linha, o motivo depois do
 *      travessão; "da Lei 9.784" não vira artigo 9 nem 784; o que não existe na lei fica de fora;
 *  I2. a lista é por lei E por edital; o que você marcou continua seu quando a IA sugere o mesmo artigo;
 *  I3. o pedido leva o edital, os tópicos dele que tratam da lei e o índice dos artigos;
 *  I4. no leitor: o ☆/★ de cada artigo, "★ importantes (N)" lê só eles, "✦ pedir à IA" abre a janela;
 *  I5. a janela: colar a resposta, conferir (caixas de marcar), guardar só os marcados;
 *  I6. o mapa "ir para…" tem o filtro dos importantes; I7. a fuga põe os importantes na frente, com o motivo;
 *  I8. a lista vai no backup.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const arts = (k) => Array.from({ length: k }, (_, i) => "Art. " + (i + 1) + (i < 9 ? "º" : ".") + " Texto do artigo " + (i + 1) + " sobre processo.").join(NL);
  const DISC = "Direito Administrativo", TOP = "Atos administrativos";
  const montar = () => {
    const r = rodar();
    const { api } = r;
    api.matIniciar(); api.edIniciar(); api.leiIniciar(); api.ledIniciar && api.ledIniciar();
    const e = api.edCriar("TJ PB", ["# TJ PB | prova: 2027-06-01 | horas: 20", "@ " + DISC + " :: 4", "+ " + TOP + " (Lei 9.784/1999) :: 5", "+ Licitações :: 3"].join(NL));
    const l = api.leiGuardar({ id: "lei_9784", nome: "Lei 9.784/1999 Lei de Processo Administrativo", texto: arts(30), topicos: [] });
    const ch = api.matChave(DISC, TOP + " (Lei 9.784/1999)");
    api.matGravar(ch, "Resumo.", { disciplina: DISC, topico: TOP + " (Lei 9.784/1999)", concurso: "TJ" });
    api.leiLigar(l.id, ch);
    return Object.assign(r, { e, l, ch, TOPC: TOP + " (Lei 9.784/1999)" });
  };

  /* I1: ler a resposta */
  {
    const { api, l } = montar();
    const resp = ["Aqui estão:", "Arts. 1 a 5 — princípios e direitos", "Art. 10 — prazo", "- Arts. 12, 14 e 16: competência", "Art. 9º da Lei 9.784 — o 9 é artigo, o 784 não", "Art. 99 — não existe nesta lei"].join(NL);
    const r = api.liLerResposta(resp, l.id);
    const nums = r.map((x) => x.num).join(",");
    ok(nums === "1,2,3,4,5,10,12,14,16,9", "I1 intervalos, listas e um por linha, na ordem da resposta (sem o 784 nem o 99): " + nums);
    ok(r[0].motivo === "princípios e direitos" && r.find((x) => x.num === "12").motivo === "competência" && /^Art\. 1º/.test(r[0].rotulo), "I1a o motivo depois do travessão (ou dos dois-pontos) e o rótulo do artigo");
    ok(api.liLerResposta("Arts. 3º ao 6º — teste", l.id).map((x) => x.num).join() === "3,4,5,6", "I1b 'ao' e o ordinal também valem");
  }

  /* I2: por lei e por edital; o seu continua seu */
  {
    const { api, l, e } = montar();
    api.liMarcar(l.id, e.id, "7", true, "voce");
    const n = api.liAplicarIA(l.id, e.id, [{ num: "3", motivo: "m3" }, { num: "7", motivo: "m7" }, { num: "1", motivo: "m1" }]);
    const d = api.liDaLei(l.id, e.id);
    ok(n === 3 && api.liLista(l.id, e.id).join() === "1,3,7", "I2 a lista na ordem da lei: " + api.liLista(l.id, e.id).join());
    ok(d["7"].de === "voce" && d["7"].motivo === "m7" && d["3"].de === "ia", "I2a o que você marcou continua seu (a IA só traz o motivo)");
    ok(api.liLista(l.id, "").length === 0 && api.liLista(l.id, "outro_edital").length === 0, "I2b a lista é deste edital: a geral e a de outro edital ficam vazias");
    api.liMarcar(l.id, e.id, "3", false);
    ok(api.liLista(l.id, e.id).join() === "1,7", "I2c tirar da lista");
    ok(api.liTodos().length === 2 && api.liTodos()[0].leiId === l.id, "I2d todos os importantes de todas as leis (para a fuga)");
  }

  /* I3: o pedido */
  {
    const { api, l, e } = montar();
    const p = api.liPedido(l.id, e.id);
    ok(/TJ PB/.test(p) && /Atos administrativos/.test(p) && !/Licitações/.test(p) && /Art\. 1º — Texto do artigo 1/.test(p) && /Arts\. 1 a 15 — motivo curto/.test(p) && /30 artigos/.test(p),
      "I3 o pedido: o edital, só os tópicos que tratam da lei, o índice dos artigos e o formato da resposta");
  }

  /* I4: o leitor */
  {
    const { api, l, e, TOPC } = montar();
    api.leiAbrir(DISC, TOPC, l.id);
    ok(api.liEditalAtual() === String(e.id), "I4-pre a lei aberta pelo tópico sabe o edital dele");
    ok(api.$("leiVer").hidden === false && /★ importantes \(0\)/.test(api.$("btnLeiVerImp").textContent) && api.$("btnLeiVerImp").disabled === true && api.$("btnLeiImpIA"),
      "I4 o seletor aparece com a lei do tópico (mesmo sem questão), com '★ importantes (0)' e '✦ pedir à IA'");
    const estrela = () => api.$("leiLeitura").querySelectorAll(".lei-art-imp-b")[1];
    ok(estrela() && estrela().textContent === "☆", "I4a cada artigo tem o ☆");
    estrela().onclick();
    ok(api.liLista(l.id, e.id).join() === "2" && api.$("leiLeitura").querySelectorAll(".lei-art-imp").length === 1 && /★ importantes \(1\)/.test(api.$("btnLeiVerImp").textContent),
      "I4b tocar no ☆ marca o artigo (★), para este edital, e o contador sobe");
    ok(estrela().textContent === "★" && /lei-art-imp-voce/.test(estrela().className), "I4c a estrela marcada, com a cor do 'você'");
    api.$("btnLeiVerImp").onclick();
    ok(api.leiVerAtual() === "imp" && /lei-ver-imp/.test(api.$("leiLeitura").className), "I4d '★ importantes' lê só eles");
    api.$("btnLeiImpIA").onclick();
    ok(api.$("dlgLeiImp").open === true && /Lei 9\.784/.test(api.$("liTitulo").textContent) && /TJ PB/.test(api.$("liSub").textContent) && api.$("liLin_2"),
      "I4e '✦ pedir à IA' abre a lista da lei para o edital");
  }

  /* I5: a janela — colar, conferir, guardar os marcados */
  {
    const { api, l, e, TOPC } = montar();
    api.leiAbrir(DISC, TOPC, l.id);
    api.liAbrir(l.id, e.id);
    ok(/Nenhum artigo marcado/.test(api.$("liLista").textContent), "I5 a lista começa vazia e diz o que fazer");
    api.$("liResp").value = "Arts. 1 a 3 — princípios" + NL + "Art. 20 — recurso";
    api.$("btnLiConferir").onclick();
    ok(api.$("liSug").hidden === false && api.$("liSug_0") && api.$("liSug_3") && !api.$("liSug_4") && /4 artigo\(s\)/.test(api.$("liSug").textContent), "I5a conferir mostra os 4, com caixas");
    api.$("liSug_1").checked = false; api.$("liSug_1").onchange();
    api.$("btnLiGuardar").onclick();
    ok(api.liLista(l.id, e.id).join() === "1,3,20" && api.liDaLei(l.id, e.id)["20"].de === "ia" && api.liDaLei(l.id, e.id)["20"].motivo === "recurso" && api.$("liSug").hidden === true,
      "I5b só os marcados entram, como da IA, com o motivo: " + api.liLista(l.id, e.id).join());
    api.$("btnLiTirar_3").onclick();
    ok(api.liLista(l.id, e.id).join() === "1,20", "I5c o ✕ da lista tira o artigo");
    ok(/Arts\. 1 a 15/.test(api.liCopiarPedido()), "I5d copiar o pedido");
  }

  /* I6: o mapa */
  {
    const { api, l, e, TOPC } = montar();
    api.leiAbrir(DISC, TOPC, l.id);
    api.liAplicarIA(l.id, e.id, [{ num: "4", motivo: "x" }, { num: "8", motivo: "y" }]);
    api.leiIrAbrir();
    api.$("btnLeiIrF_importantes").onclick();
    const tx = api.$("leiIrGrade").textContent || "";
    ok(/Art\. 4º/.test(tx) && /Art\. 8º/.test(tx) && !/Art\. 5º/.test(tx), "I6 o mapa 'ir para…' tem o filtro dos importantes: " + tx.slice(0, 120));
  }

  /* I7: a fuga */
  {
    const { api, l, e } = montar();
    api.liAplicarIA(l.id, e.id, [{ num: "12", motivo: "competência delegada" }]);
    const a12 = api.fugaArtigos().find((x) => x.leiId === l.id && x.num === "12");
    ok(a12 && /importante para TJ PB \(IA\) — competência delegada/.test(a12.motivoImp) && a12.peso >= 14, "I7 a fuga inclui o importante, na frente, com o motivo: " + (a12 && a12.motivoImp));
    const F = { cartoes: [], questoes: [], artigos: [a12], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() };
    api.fugaAbrir({ fontes: F, disc: "", rnd: () => 0 });
    ok(api.$("fugaImp") && /★ importante para TJ PB/.test(api.$("fugaImp").textContent), "I7a a fuga mostra por que o artigo está ali");
  }

  /* I8: o backup */
  {
    const bk = fs.readFileSync(path.join(__dirname, "..", "docs", "backup.js"), "utf8");
    ok(/"eac_lei_importantes"/.test(bk), "I8 a lista dos importantes vai no backup");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
