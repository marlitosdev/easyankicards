/* =====================================================================
 * COMO A PROVA PONTUA (19.55.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  P1 a janela lê do texto os pesos e os blocos que já existem (inclusive o bloco de uma disciplina só = mínimo dela);
 *  P2 gravar escreve só os pesos ("10q"/"20p") e as linhas "&"; tópicos, ramos, motivos e cabeçalho ficam iguais;
 *  P3 disciplinas do mesmo grupo ficam juntas e as sem mínimo vêm antes dos blocos (senão cairiam num bloco);
 *  P4 "Não" nas perguntas tira o item da conferência do edital; "Sim" sem número em alguma disciplina não grava;
 *  P5 a resposta da IA ("Disciplina | questões | pontos | mínimo | grupo") preenche a tabela, sem gravar;
 *  P6 com o edital criado, o texto colado fica recolhido e o resumo oferece "⚖ Pontuação e cortes".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const TXT = [
    "# ISS Teste | prova: 2026-11-29 | horas: 33",
    "",
    "@ Sistema Tributário Brasileiro :: 5",
    "+ Tributos e suas espécies :: 5 :: base",
    "++ Taxas :: 5 :: art. 77",
    "+ Lançamento :: 5",
    "@ Noções de Direito Administrativo :: 4",
    "+ Atos administrativos :: 5",
    "@ Português :: 4",
    "+ Crase :: 5",
    "@ Raciocínio Lógico :: 2",
    "+ Tabela-verdade :: 5",
    "@ Informática :: 2",
    "+ Segurança da Informação :: 5",
  ].join("\n");
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const ed = api.edCriar("ISS Teste", TXT);
  api.hubAbrirEdital(ed.id || ed);
  api.$("editalTexto").value = TXT;

  /* ---- P1 ---- */
  ok(api.epAbrir() === true && api.$("dlgEdPontua").open, "P1 a janela abre");
  const c = api.epCtxAtual();
  ok(c.ds.length === 5 && c.peso === "nao" && c.minimo === "nao", "P1b sem numeros nem blocos: as duas respostas comecam em 'nao'");

  /* ---- P2/P3: o caso Caruaru — Específicos em grupo, as outras com mínimo próprio ---- */
  c.minimo = "sim";
  c.grupos = [{ nome: "Conhecimentos Específicos", min: { tipo: "pct", valor: 50 } }];
  c.ds.forEach((d) => {
    if (/Tributário|Administrativo/.test(d.nome)) d.grupo = "Conhecimentos Específicos";
    if (d.nome === "Português") d.min = { tipo: "pct", valor: 50 };
    if (/Lógico|Informática/.test(d.nome)) d.min = { tipo: "pct", valor: 40 };
  });
  /* Português sem número: "sim" na pergunta 1 não grava */
  c.peso = "sim";
  c.ds.forEach((d) => { d.abs = /Português/.test(d.nome) ? 0 : 5; d.unidade = "q"; });
  ok(api.epGravar() === false && /Falta o número/.test(api.$("epMsg").textContent), "P4b 'sim' com uma disciplina sem numero nao grava");
  c.peso = "nao";
  const novo = api.epNovoTexto(TXT, c);
  const r = api.lerEdital(novo);
  const bl = (nome) => r.blocos.find((b) => b.nome === nome);
  ok(bl("Conhecimentos Específicos") && bl("Conhecimentos Específicos").minimo.valor === 50 && bl("Conhecimentos Específicos").disciplinas.length === 2,
    "P2 o grupo vira um bloco com o minimo e as duas disciplinas: " + JSON.stringify(r.blocos.map((b) => [b.nome, b.disciplinas])));
  ok(bl("Português") && bl("Português").minimo.valor === 50 && bl("Raciocínio Lógico").minimo.valor === 40 && bl("Informática").disciplinas.join() === "Informática",
    "P2b cada disciplina com minimo proprio vira um bloco so dela");
  const conta = (rr) => rr.disciplinas.map((d) => d.nome + ":" + d.topicos.map((tp) => tp.nome + "/" + (tp.ramos || []).length + "/" + (tp.motivo || "")).join(",")).sort().join(";");
  ok(conta(r) === conta(api.lerEdital(TXT)) && r.cfg.prova === "2026-11-29" && r.cfg.horas === 33, "P2c topicos, ramos, motivos e cabecalho iguais");
  ok(r.disciplinas.find((d) => d.nome === "Sistema Tributário Brasileiro").peso === 5, "P2d sem numero do edital, o peso de 1 a 5 continua");

  /* gravar de verdade: vai para o edital, a conferência perde o item de corte */
  ok(api.epGravar() === true && !api.$("dlgEdPontua").open, "P2e gravar fecha a janela");
  const r2 = api.lerEdital(api.$("editalTexto").value);
  ok(r2.blocos.length === 4, "P2f o texto do edital passou a ter os 4 blocos");
  ok(api.edConfPendencias(r2, api.montarPlano(r2, { horas: 33, prova: "2026-11-29", feitos: {} }), ed.id || ed).indexOf("corte") < 0, "P4 com os cortes, sai o item 'pontos de corte' da conferencia");

  /* P1 de novo: lendo o texto gravado, a janela reconhece grupo e mínimos próprios */
  api.epAbrir();
  const c2 = api.epCtxAtual();
  ok(c2.minimo === "sim" && c2.grupos.length === 1 && c2.ds.find((d) => d.nome === "Português").min.valor === 50 && c2.ds.find((d) => /Tributário/.test(d.nome)).grupo === "Conhecimentos Específicos",
    "P1c a janela le de volta o grupo e os minimos proprios");

  /* ---- P3: disciplina sem mínimo não cai dentro de um bloco ---- */
  c2.ds.find((d) => d.nome === "Informática").min = null;
  const r3 = api.lerEdital(api.epNovoTexto(api.$("editalTexto").value, c2));
  ok(!r3.blocos.some((b) => b.disciplinas.indexOf("Informática") >= 0), "P3 a disciplina sem minimo fica fora de todos os blocos: " + JSON.stringify(r3.blocos.map((b) => [b.nome, b.disciplinas])));

  /* ---- P5: IA ---- */
  api.epAbrir();
  ok(/Sistema Tributário Brasileiro/.test(api.epPromptIA()) && /Disciplina \| questões \| pontos \| mínimo \| grupo/.test(api.epPromptIA()), "P5 o pedido leva a lista exata das disciplinas e o formato");
  const lido = api.epLerIA([
    "Disciplina | questões | pontos | mínimo | grupo",
    "Sistema Tributário Brasileiro | - | - | 50% | Conhecimentos Específicos",
    "Noções de Direito Administrativo | - | - | 50% | Conhecimentos Específicos",
    "Português | 10 | 20 | 50% | -",
    "Raciocínio Lógico | 5 | 5 | 40% | -",
    "Informática | 5 | 5 | 40% | -",
    "Química | 5 | 5 | 40% | -",
  ].join("\n"));
  const c3 = api.epCtxAtual();
  ok(lido.lidas === 5 && lido.avisos.some((a) => /Química/.test(a)), "P5b le as linhas e avisa a disciplina desconhecida");
  ok(c3.minimo === "sim" && c3.grupos[0] && c3.grupos[0].min.valor === 50 && c3.ds.find((d) => d.nome === "Português").min.valor === 50 && c3.ds.find((d) => d.nome === "Português").abs === 20,
    "P5c preenche grupo, minimos e pontos");
  ok(c3.peso === "nao" && lido.avisos.some((a) => /Só 3 de 5/.test(a)), "P5d so algumas com numero: os pesos ficam estimados, com aviso");
  ok(api.$("dlgEdPontua").open, "P5e preencher nao grava nem fecha");

  /* ---- textos ---- */
  ["ep_tit", "ep_sub", "ep_btn", "ep_q1", "ep_q2", "ep_frase_grupo", "ep_frase_disc", "ep_ia_pedido", "ep_gravado", "ed_conf_resolver", "ed_banc_texto"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
