/* =====================================================================
 * O MATERIAL DE ESTUDO MAIS PRÁTICO (v18.45.0, JM7)
 *
 * (1) "Continuar:" — os últimos materiais abertos, de qualquer lugar do
 *     app, a um toque (só neste aparelho; abrir de novo sobe para o topo).
 * (2) Os tópicos do edital ainda sem material, num grupo recolhível no
 *     fim da lista; tocar abre a ficha (que cria o que falta).
 * (3) O estado do estudo na linha: estudado em / revisado em / em andamento.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const cls = (e) => String((e && e.className) || "");
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((x) => { if (pred(x)) acc.push(x); achar(x, pred, acc); }); return acc; };
  const D = "Tributário";
  const EDITAL = ["# ISS | prova: 2027-06-01 | horas: 10", "@ " + D + " :: 5",
    "+ Limitações :: 5", "+ Responsabilidade :: 5", "+ Crédito :: 5"].join("\n");
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("ISS", EDITAL);
    const A = api.matChave(D, "Limitações");
    api.matGravar(A, "Resumo A.", { disciplina: D, topico: "Limitações", concurso: "ISS" });
    api.matFiltroTiposTeste([]);
    return { api, ed, A };
  };

  /* P1: continuar de onde parei */
  {
    const { api } = montar();
    ok(api.matRecentesLer().length === 0, "P1 começa vazio");
    api.matAbrirEditor({ disciplina: D, nome: "Limitações" }, "ler");
    api.jurAbrir(D, "Limitações", "ler");
    let r = api.matRecentesLer();
    ok(r.length === 2 && r[0].tipo === "juris" && r[1].tipo === "resumo" && r[0].topico === "Limitações", "P1a abrir o resumo e os julgados entra na lista, o mais recente primeiro: " + r.map((x) => x.tipo).join());
    api.matAbrirEditor({ disciplina: D, nome: "Limitações" }, "ler");
    r = api.matRecentesLer();
    ok(r.length === 2 && r[0].tipo === "resumo", "P1b abrir de novo sobe para o topo, sem repetir");
    api.leiAbrir(D, "Responsabilidade"); api.qsUiResponderDireto(D, "Crédito"); api.estcEstudarTopico(D, "Limitações");
    ["Um", "Dois", "Três"].forEach((x) => api.jurAbrir(D, x, "ler"));
    ok(api.matRecentesLer().length === 6, "P1c guarda no máximo 6: " + api.matRecentesLer().length);
    ok(api.matRecentesLer().some((x) => x.tipo === "lei") && api.matRecentesLer().some((x) => x.tipo === "questoes") && api.matRecentesLer().some((x) => x.tipo === "cartoes"),
       "P1d lei, questões e cartões também entram (de onde quer que se abra)");
    ["dlgJuris", "dlgMaterial", "dlgGerCartoes", "dlgGerEstudo"].forEach((id) => { try { if (api.$(id) && api.$(id).close) api.$(id).close(); } catch (e) {} });
    api.matRender();
    const chips = achar(api.$("matRecentes"), (e) => /(^| )mat-rec( |$)/.test(cls(e)));
    ok(api.$("matRecentes").hidden === false && chips.length === 6 && /^⚖ Três/.test(chips[0].textContent) && chips[0].title, "P1e a faixa 'Continuar' mostra os 6, com ícone e explicação: " + chips.map((c) => c.textContent).join(" | "));
    chips[0].onclick();
    ok(api.$("dlgJuris").open === true, "P1f tocar reabre (os julgados do tópico)");
  }

  /* P2: tópicos do edital sem material */
  {
    const { api } = montar();
    api.matRender();
    const bt = api.$("btnMatSemMaterial");
    ok(bt && /2 tópico\(s\) do edital ainda sem material/.test(bt.textContent), "P2 o grupo diz quantos tópicos do edital ainda não têm material: " + (bt && bt.textContent));
    ok(!achar(api.$("matLista"), (e) => /mat-sem-item/.test(cls(e))).length, "P2a começa recolhido");
    bt.onclick();
    const itens = achar(api.$("matLista"), (e) => /mat-sem-item/.test(cls(e)));
    ok(itens.length === 2 && itens.map((i) => i.textContent).join("|").indexOf("Responsabilidade") >= 0 && itens.map((i) => i.textContent).join("|").indexOf("Limitações") < 0,
       "P2b aberto: os dois sem material (e não o que já tem): " + itens.map((i) => i.textContent).join(" | "));
    const criar = achar(itens[0], (e) => /mat-sem-criar/.test(cls(e)))[0];
    criar.onclick();
    ok(api.$("dlgMatFicha").open === true, "P2c '＋ criar material' abre a ficha do tópico");
    api.$("dlgMatFicha").close();
    api.matFiltroTiposTeste(["resumo"]); api.matRender();
    ok(!achar(api.$("matLista"), (e) => /mat-sem-cx/.test(cls(e))).length, "P2d numa aba de tipo o grupo não aparece");
    api.matFiltroTiposTeste([]);
  }

  /* P3: o estado do estudo na linha */
  {
    const { api, ed, A } = montar();
    const B = api.matChave(D, "Responsabilidade");
    api.matGravar(B, "Resumo B.", { disciplina: D, topico: "Responsabilidade", concurso: "ISS" });
    const e = api.editaisAtuais.find((x) => x.id === ed.id);
    e.progresso[A] = { e: "revisado", d: "2026-10-12" };
    e.progresso[B + "›#algum_ramo"] = { e: "feito", d: "2026-10-01" };
    api.matRender();
    const sub = (nome) => { const it = achar(api.$("matLista"), (x) => cls(x) === "mat-item").find((i) => i.textContent.indexOf(nome) === 0); return it ? achar(it, (x) => /mat-sub/.test(cls(x)))[0].textContent : ""; };
    ok(/^↻ revisado em 12\/10 · atualizado em /.test(sub("Limitações")), "P3 a linha diz quando foi revisado: " + sub("Limitações"));
    ok(/^em andamento \(1 ramo\(s\) estudado\(s\)\) · /.test(sub("Responsabilidade")), "P3a só um ramo estudado: em andamento: " + sub("Responsabilidade"));
    ok(api.matEstadoEstudo({ disciplina: D, topico: "Crédito" }) === null, "P3b sem marca: nada");
    /* o mesmo tópico em dois editais: vale a marca MAIS RECENTE, qualquer que seja a ordem dos editais */
    const ed2 = api.edCriar("SEFAZ", EDITAL.replace("ISS", "SEFAZ"));
    api.editaisAtuais.find((x) => x.id === ed2.id).progresso[A] = { e: "feito", d: "2026-09-01" };
    const est = api.matEstadoEstudo({ disciplina: D, topico: "Limitações" });
    ok(est && est.e === "revisado" && est.d === "2026-10-12", "P3c em dois editais, vale a marca mais recente: " + JSON.stringify(est));
    /* o caso real ("Os princípios constitucionais tributários"): tópico estudado em 07/09, todos os ramos revisados em 03/10 */
    const C = api.matChave(D, "Crédito");
    e.progresso[C] = { e: "feito", d: "2026-09-07" };
    e.progresso[C + "›#r1"] = { e: "revisado", d: "2026-10-03" };
    const estC = api.matEstadoEstudo({ disciplina: D, topico: "Crédito" });
    ok(estC && estC.e === "revisado" && estC.d === "2026-10-03", "P3d a marca dos ramos, mais recente, vence a do tópico: " + JSON.stringify(estC));
  }

  /* P4: textos */
  {
    const { api } = rodar();
    ["mat_rec_rot", "mat_rec_tip", "mat_est_feito", "mat_est_revisado", "mat_est_andamento", "mat_sem_mat_tit", "mat_sem_mat_tip", "mat_sem_mat_abrir", "mat_sem_mat_criar"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "P4 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
