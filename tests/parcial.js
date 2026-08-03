/* =====================================================================
 * TESTES DA CORREÇÃO PARCIAL
 * O prompt parcial só é seguro se a colagem de volta for VERIFICÁVEL.
 * Aqui simulamos as respostas que uma IA pode dar — a boa e as ruins —
 * e conferimos que:
 *   - a boa é aplicada e só toca os blocos enviados;
 *   - cada resposta ruim é recusada com a mensagem certa, sem estragar
 *     o texto do usuário.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

function carregar() {
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.navigator = { language: "pt-BR" };
  const codigo = ["i18n.js", "parser.js"]
    .map((f) => fs.readFileSync(path.join(RAIZ, "docs", f), "utf8")).join("\n");
  const api = new Function(codigo + `\nreturn {
    parseText, setLanguage, t, resumoTexto, problemasDoTexto,
    montarPromptCorrecaoParcial, separarBlocosMarcados,
    conferirCorrecaoParcial, aplicarCorrecaoParcial, blocoDoCartao };`)();
  api.setLanguage("pt");
  return api;
}

/* Texto com 4 cartões: o 2º tem a resposta quebrada em duas linhas e o
 * 4º tem markdown. Os outros dois estão perfeitos e NÃO podem ser tocados. */
const TEXTO = [
  "@ Bloco A - intacto",
  "Qual é a primeira pergunta do baralho? :: A primeira resposta :: tag_a",
  "+ Nota A — explicação que deve sobreviver intacta.",
  "",
  "@ Bloco B - com problema",
  "Quais são os tipos? :: • Um: {{c1::primeiro}}",
  "• Dois: {{c2::segundo}} :: tag_b",
  "",
  "@ Bloco C - intacto",
  "Qual é a terceira pergunta do baralho? :: A terceira resposta :: tag_c",
  "",
  "@ Bloco D - com problema",
  "Qual conceito **importante** aparece aqui? :: A **resposta** destacada :: tag_d",
].join("\n");

function testes() {
  const api = carregar();
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  const r = api.parseText(TEXTO, []);
  const { texto: prompt, blocos } = api.montarPromptCorrecaoParcial(TEXTO, r);

  // P1. o prompt existe, tem âncoras e NÃO carrega os blocos saudáveis
  ok(!!prompt, "P1 prompt parcial veio vazio");
  ok(blocos.length > 0, "P2 nenhum bloco com problema foi isolado");
  ok(/@@ \d+/.test(prompt), "P3 o prompt não tem âncoras @@");
  ok(!prompt.includes("primeira resposta"),
     "P4 o prompt levou junto um bloco que estava correto");
  ok(!prompt.includes("terceira resposta"),
     "P5 o prompt levou junto um bloco que estava correto");

  const ids = blocos.map((b) => b.id);
  const resp = (partes) => partes.map(([id, txt]) => "@@ " + id + "\n" + txt).join("\n\n");
  // a resposta simulada devolve a MESMA quantidade de cartões de cada bloco
  const cartaoFake = (id, i) => "@ Bloco corrigido " + id + "." + i
    + "\nPergunta corrigida " + id + "." + i
    + "? :: Resposta corrigida em uma linha só :: tag_x\n+ Nota — explicação nova.";
  const bom = resp(blocos.map((b) => [b.id,
    Array.from({ length: b.cartoesOriginais }, (_, i) => cartaoFake(b.id, i + 1)).join("\n\n")]));

  // P6. caminho feliz: aplica e não encosta no resto do texto
  {
    const c = api.conferirCorrecaoParcial(bom, blocos);
    ok(c.erros.length === 0, "P6 caminho feliz acusou erro: " + c.erros.join(" | "));
    ok(c.aplicar.length === ids.length, "P7 nem todos os blocos foram aceitos");
    const novo = api.aplicarCorrecaoParcial(TEXTO, c.aplicar);
    ok(novo.includes("A primeira resposta"), "P8 apagou um bloco que estava correto");
    ok(novo.includes("A terceira resposta"), "P9 apagou um bloco que estava correto");
    ok(novo.includes("Nota A — explicação que deve sobreviver intacta."),
       "P10 apagou a explicação de um bloco correto");
    ok(!novo.includes("**importante**"), "P11 o markdown não foi substituído");
    ok(!novo.includes("@@"), "P12 sobrou âncora dentro do texto do usuário");
    const a = api.resumoTexto(TEXTO), d = api.resumoTexto(novo);
    ok(d.cartoesReais >= a.cartoesReais,
       `P13 perdeu cartões: ${a.cartoesReais} -> ${d.cartoesReais}`);
  }

  // P14. a IA apagou as âncoras -> recusa tudo
  {
    const c = api.conferirCorrecaoParcial("Pergunta qualquer :: Resposta :: tag", blocos);
    ok(c.aplicar.length === 0, "P14 aplicou algo sem âncora");
    ok(/âncora/i.test(c.erros[0] || ""), "P15 faltou a mensagem de âncora ausente");
  }

  // P16. a IA inventou uma âncora que não foi enviada -> ignora, com aviso
  {
    const c = api.conferirCorrecaoParcial(
      bom + "\n\n@@ 999\nPergunta inventada pela IA? :: Resposta :: tag", blocos);
    ok(c.aplicar.length === ids.length, "P16 a âncora inventada entrou na aplicação");
    ok(c.avisos.some((x) => x.includes("999")), "P17 faltou avisar da âncora desconhecida");
  }

  // P18. a IA esqueceu um bloco -> avisa e mantém o original
  {
    const b0 = blocos[0];
    const meio = resp([[b0.id,
      Array.from({ length: b0.cartoesOriginais }, (_, i) => cartaoFake(b0.id, i + 1)).join("\n\n")]]);
    const c = api.conferirCorrecaoParcial(meio, blocos);
    ok(c.aplicar.length === 1, "P18 devia aplicar só o bloco que voltou");
    ok(c.avisos.length === blocos.length - 1, "P19 faltou avisar dos blocos que não voltaram");
    const novo = api.aplicarCorrecaoParcial(TEXTO, c.aplicar);
    ok(novo.includes("**importante**"), "P20 mexeu num bloco que a IA não devolveu");
  }

  // P21. bloco vazio e bloco sem cartão -> recusados, um a um
  {
    const c = api.conferirCorrecaoParcial("@@ " + ids[0] + "\n\n@@ " + (ids[1] || ids[0])
      + "\nsó um comentário solto sem nada de cartão", blocos);
    ok(c.aplicar.length === 0, "P21 aceitou bloco vazio ou sem cartão");
    ok(c.erros.length >= 1, "P22 faltaram os erros de bloco vazio/sem cartão");
  }

  // P23. cercas de código (```) que a IA às vezes adiciona não podem
  //      atrapalhar o reconhecimento das âncoras
  {
    const c = api.conferirCorrecaoParcial("```\n" + bom + "\n```", blocos);
    ok(c.aplicar.length === ids.length, "P23 as cercas ``` quebraram o reconhecimento");
  }

  // P24. aplicar de baixo para cima: com 2+ blocos, nenhum sai do lugar
  if (ids.length >= 2) {
    const c = api.conferirCorrecaoParcial(bom, blocos);
    const novo = api.aplicarCorrecaoParcial(TEXTO, c.aplicar);
    const linhas = novo.split("\n");
    const esperados = blocos.reduce((n, b) => n + b.cartoesOriginais, 0);
    ok(linhas.filter((l) => l.startsWith("@ Bloco corrigido")).length === esperados,
       "P24 algum bloco corrigido se perdeu ou duplicou");
  }

  // P31. a IA ecoou a instrução final do prompt junto com a resposta.
  //      Ela vinha DEPOIS da última âncora e caía dentro do último bloco,
  //      virando conteúdo do cartão (bug do cartão 24, v8.30).
  {
    const eco = bom + "\n\nResponda SOMENTE com os trechos corrigidos, cada um "
      + 'começando pela sua linha "@@ N". Sem comentários, sem cercas de código.';
    const c = api.conferirCorrecaoParcial(eco, blocos);
    ok(c.erros.length === 0, "P31 recusou a resposta por causa do eco: " + c.erros.join(" | "));
    ok(c.avisos.some((x) => /instru/i.test(x)), "P32 não avisou sobre o eco do prompt");
    const novo = api.aplicarCorrecaoParcial(TEXTO, c.aplicar);
    ok(!/Responda SOMENTE/i.test(novo), "P33 a instrução do prompt entrou no baralho");
    ok(!/@@/.test(novo), "P34 sobrou âncora no texto");
  }

  // P25. a IA DIVIDIU um cartão longo: 2 cartões dentro da mesma âncora.
  //      Tem de ser aceito, e o total de cartões cresce.
  {
    const b0 = blocos[0];
    const extras = Array.from({ length: b0.cartoesOriginais - 1 },
      (_, i) => cartaoFake(b0.id, i + 1));
    const dividido = "@@ " + b0.id + "\n" + [...extras,
      "@ Tema — parte 1\nPrimeira pergunta dividida? :: Primeira resposta :: tag_a\n"
      + "+ Nota — explicação da parte 1.",
      "@ Tema — parte 2\nSegunda pergunta dividida? :: Segunda resposta :: tag_a"].join("\n\n");
    const c = api.conferirCorrecaoParcial(dividido, blocos);
    ok(c.erros.length === 0, "P25 recusou a divisão em dois cartões: " + c.erros.join(" | "));
    ok(c.aplicar.length === 1 && c.aplicar[0].cartoes === b0.cartoesOriginais + 1,
       "P26 não reconheceu o cartão a mais dentro da âncora");
    const novo = api.aplicarCorrecaoParcial(TEXTO, c.aplicar);
    const a = api.resumoTexto(TEXTO), d = api.resumoTexto(novo);
    ok(d.cartoesReais === a.cartoesReais + 1,
       `P27 o total devia crescer 1: ${a.cartoesReais} -> ${d.cartoesReais}`);
    const cs = api.parseText(novo, []).cards.filter((x) => /pergunta dividida/i.test(x.front));
    ok(cs.length === 2, "P28 os dois cartões divididos não apareceram");
    ok(cs.every((x) => x.titulo && x.ownTags.length),
       "P29 cartão dividido ficou sem título ou sem tags");
    ok(!novo.includes("@@"), "P30 sobrou âncora no texto após a divisão");
  }

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const falhas = testes();
  falhas.forEach((f) => console.log("  FALHA  " + f));
  console.log(falhas.length
    ? `\nparcial: ${falhas.length} FALHA(S)\n`
    : "\nparcial: prompt e colagem verificados\n");
  process.exit(falhas.length ? 1 : 0);
}
