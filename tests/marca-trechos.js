/* =====================================================================
 * (19.109.0) MARCAR QUALQUER TRECHO QUE A LEITURA MOSTRA
 *
 * O caso relatado (Raciocínio Lógico, De Morgan): selecionar
 *   "1. Primeira Lei de De Morgan (Negação da Conjunção):" / "~(p ∧ q) ≡ ~p ∨ ~q" / "Regra: Nega a primeira, …"
 * e apertar "importante" dava "Não encontrei esse trecho no texto guardado". O texto guarda "*Regra:*" e "*"e"*" — o
 * itálico de UM asterisco, que a leitura mostra e o mapa da marcação não conhecia. O mapa era uma cópia à mão da leitura
 * e tinha ficado para trás em várias regras; agora usa as MESMAS expressões, na mesma ordem.
 *
 *   MT1  o trecho do relato, com cada um dos cinco botões: marca, a leitura pinta, a lista "1." continua lista, o
 *        itálico continua itálico, e nenhum marcador aparece cru
 *   MT2  começar ou terminar no meio de um itálico ("Regra: Nega…", "conectivo "e" (∧) por"): a marca leva o par junto
 *   MT3  dica (">"), questão ("?>") e gabarito (">>")
 *   MT4  fórmula ("$\sim p \lor q$" aparece "∼p∨q"): marca inteira, nunca cortada ao meio
 *   MT5  trecho que cruza marcas que já existem (pegadinha, prova, lei, nota): só a parte livre recebe a nova, com
 *        aviso; o trecho todo já marcado é recusado
 *   MT6  itálico com "_" e negrito juntos: a marca os envolve e eles continuam itálico e negrito
 *   MT7  a lista "2)" (a leitura mostra "2."): a marca não come o número e a linha continua lista
 *   MT8  o mesmo trecho duas vezes: a ocorrência escolhida é a selecionada
 *   MT9  tirar a marca pelo trecho visível (com itálico dentro)
 *   MT10 o mapa: o que ele monta é exatamente o texto que a leitura mostra
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const CH = api.matChave("Raciocínio Lógico", "De Morgan");
  const FIX = [
    "* **Regras de transformação:**",
    "1. **Primeira Lei de De Morgan (Negação da Conjunção):**",
    "",
    "~(p ∧ q) ≡ ~p ∨ ~q",
    "",
    "",
    "",
    "*Regra:* Nega a primeira, nega a segunda e troca o conectivo *\"e\"* (∧) por *\"ou\"* (∨).",
    "",
    "2) **Segunda Lei** com a lista escrita com parêntese.",
    "*Regra:* Nega a primeira, nega a segunda e troca o conectivo *\"ou\"* (∨) por *\"e\"* (∧).",
    "> A negação da condicional é *p e não q*, sempre.",
    "?> Qual é a negação de p → q, segundo a regra?",
    ">> A negação é p ∧ ~q, sem dúvida.",
    "A fórmula $\\sim p \\lor q$ aparece no meio desta frase.",
    "Uma ==~pegadinha antiga== e uma ==*prova antiga== e uma ==§lei antiga== e uma ==@nota antiga== no meio.",
    "Texto com _itálico sublinhado_ e **negrito forte** juntos na mesma linha.",
  ].join("\n");
  api.matGravar(CH, FIX, { disciplina: "Raciocínio Lógico", topico: "De Morgan" });
  api.matAbrirEditor({ disciplina: "Raciocínio Lógico", nome: "De Morgan" }, "ler");
  const ta = () => api.$("matTexto");
  const zerar = () => { ta().value = FIX; api.matSelOrdinalPor(-1); };
  const marcar = (sel, tipo, ordinal) => { api.matPorSelecao(sel); api.matSelOrdinalPor(ordinal === undefined ? -1 : ordinal); return api.matMarcarSelecao(tipo); };
  /* o texto que a leitura mostra (sem tags), e as marcas que ela pinta */
  const visivel = (src) => api.matHtmlTexto(api.matParaHtml(src));
  const pintadas = (src, tipo) => (api.matParaHtml(src).match(new RegExp('data-marca="' + tipo + '">((?:(?!</mark>)[\\s\\S])*)</mark>', "g")) || []);
  const semCru = (src) => !/==/.test(visivel(src)) && !/\*/.test(visivel(src)) && !/(^|\s)_|_(\s|$)/.test(visivel(src)) && !/\$/.test(visivel(src));
  ok(semCru(FIX), "MT0 (o texto de teste não mostra marcador cru antes de marcar): " + visivel(FIX).slice(0, 200));
  const avisos = [];
  const alerta0 = api.uiAlert;

  /* ---- MT1 o trecho do relato, com os cinco botões ---- */
  const SEL1 = "1. Primeira Lei de De Morgan (Negação da Conjunção):\n~(p ∧ q) ≡ ~p ∨ ~q\nRegra: Nega a primeira, nega a segunda e troca o conectivo \"e\" (∧) por \"ou\" (∨).";
  [["destaque", "destaque"], ["importante", "importante"], ["duvida", "duvida"], ["prova", "prova"], ["pegadinha", "pegadinha"]].forEach(([tipo, dm]) => {
    zerar();
    const r = marcar(SEL1, tipo);
    const src = ta().value;
    const L = src.split("\n");
    const bloco = L.slice(0, 9).join("\n");
    ok(r === true && pintadas(bloco, dm).length === 3, "MT1 [" + tipo + "] marca as três linhas do trecho: " + pintadas(bloco, dm).length + " · " + L.slice(1, 8).join(" | "));
    ok(semCru(src), "MT1a [" + tipo + "] nenhum marcador aparece cru: " + visivel(src).slice(0, 260));
    ok(/^1\. /.test(L[1]) && /class='mat-num'[^>]*><b>1\.<\/b> <mark/.test(api.matParaHtml(src)), "MT1b [" + tipo + "] a lista '1.' continua lista, com a marca depois do número: " + L[1]);
    ok(/<i>Regra:<\/i>/.test(api.matParaHtml(src)) && /<i>"e"<\/i>/.test(api.matParaHtml(src)), "MT1c [" + tipo + "] o itálico continua itálico");
    ok(pintadas(bloco, dm).some((x) => /~\(p ∧ q\) ≡ ~p ∨ ~q/.test(x)) && pintadas(bloco, dm).some((x) => /Nega a primeira/.test(x)), "MT1d [" + tipo + "] a fórmula e a regra dentro das marcas, e da cor certa: " + pintadas(bloco, dm).join(" | ").slice(0, 200));
  });

  /* ---- MT2 começar ou terminar no meio de um itálico ---- */
  zerar();
  ok(marcar("Regra: Nega a primeira", "importante") === true && ta().value.split("\n")[7].indexOf("==!*Regra:* Nega a primeira==") === 0,
    "MT2 começar no 'Regra' leva o asterisco de abertura junto: " + ta().value.split("\n")[7]);
  ok(semCru(ta().value) && pintadas(ta().value, "importante").some((x) => /<i>Regra:<\/i> Nega a primeira/.test(x)), "MT2a e a leitura mostra a marca com o itálico dentro");
  zerar();
  ok(marcar("conectivo \"e\" (∧) por", "destaque") === true && /troca o ==conectivo \*"e"\* \(∧\) por== \*"ou"\*/.test(ta().value), "MT2b atravessar o fecho de um itálico leva o par inteiro: " + ta().value.split("\n")[7]);
  ok(semCru(ta().value), "MT2c sem marcador cru");

  /* ---- MT3 dica, questão e gabarito ---- */
  [["condicional é p e não q, sempre", "importante", 11], ["negação de p → q", "duvida", 12], ["p ∧ ~q, sem dúvida", "destaque", 13]].forEach(([sel, tipo, linha]) => {
    zerar();
    const r = marcar(sel, tipo);
    const L = ta().value.split("\n");
    ok(r === true && /==/.test(L[linha]) && /^(> |\?> |>> )/.test(L[linha]) && semCru(ta().value), "MT3 [" + sel + "] marca dentro da " + (linha === 11 ? "dica" : linha === 12 ? "questão" : "resposta") + ": " + L[linha]);
  });

  /* ---- MT4 fórmula ---- */
  const FV = api.matHtmlTexto(api.matTexParaHtml("\\sim p \\lor q"));
  zerar();
  ok(marcar("fórmula " + FV + " aparece", "importante") === true && ta().value.split("\n")[14] === "A ==!fórmula $\\sim p \\lor q$ aparece== no meio desta frase.",
    "MT4 a fórmula entra inteira na marca: " + ta().value.split("\n")[14]);
  ok(semCru(ta().value) && /<mark[^>]*>fórmula <span class="mt">/.test(api.matParaHtml(ta().value)), "MT4a e continua fórmula, dentro da marca");
  zerar();
  ok(marcar("A fórmula " + FV.slice(0, 2), "destaque") === true && /\$\\sim p \\lor q\$==/.test(ta().value.split("\n")[14]), "MT4b terminar no meio da fórmula: a marca cresce até o fim dela: " + ta().value.split("\n")[14]);

  /* ---- MT5 cruzar marcas que já existem ---- */
  zerar();
  const L15 = () => ta().value.split("\n")[15];
  ok(marcar("pegadinha antiga e uma prova antiga", "destaque") === true && L15().indexOf("==~pegadinha antiga== ==e uma== ==*prova antiga==") >= 0,
    "MT5 só a parte livre recebe a nova; a pegadinha fica: " + L15());
  ok(/==~pegadinha antiga==/.test(L15()) && /==\*prova antiga==/.test(L15()) && semCru(ta().value), "MT5a as marcas antigas continuam inteiras, e nada aparece cru: " + visivel(ta().value).split("\n").slice(-3).join(" | "));
  ok(/só o que estava livre/.test(api.$("matEstado").textContent), "MT5b e a tela avisa: " + api.$("matEstado").textContent);
  zerar();
  ok(marcar("pegadinha antiga", "importante") === false && ta().value === FIX, "MT5c o trecho todo já marcado é recusado, sem mexer no texto");
  zerar();
  ok(marcar("lei antiga e uma nota antiga no meio", "duvida") === true && L15().indexOf("==§lei antiga== ==?e uma== ==@nota antiga== ==?no meio==") >= 0 && semCru(ta().value),
    "MT5d cruzando lei e nota: as duas ficam, o resto marca: " + L15());

  /* ---- MT6 itálico com "_" e negrito juntos ---- */
  zerar();
  ok(marcar("itálico sublinhado e negrito forte juntos", "duvida") === true && /==\?_itálico sublinhado_ e \*\*negrito forte\*\* juntos==/.test(ta().value), "MT6 a marca envolve o itálico e o negrito: " + ta().value.split("\n")[16]);
  ok(semCru(ta().value) && /<i>itálico sublinhado<\/i>/.test(api.matParaHtml(ta().value)) && /<b>negrito forte<\/b>/.test(api.matParaHtml(ta().value)), "MT6a e eles continuam itálico e negrito: " + visivel(ta().value).split("\n").slice(-1)[0]);

  /* ---- MT7 a lista "2)" ---- */
  zerar();
  ok(marcar("2. Segunda Lei com a lista escrita com parêntese.", "importante") === true && ta().value.split("\n")[9] === "2) ==!**Segunda Lei** com a lista escrita com parêntese.==",
    "MT7 a marca não come o número, e a linha continua lista: " + ta().value.split("\n")[9]);
  ok(/class='mat-num'[^>]*><b>2\.<\/b> <mark/.test(api.matParaHtml(ta().value)), "MT7a a leitura mostra '2.' com a marca depois");

  /* ---- MT8 o mesmo trecho duas vezes ---- */
  zerar();
  ok(marcar("Nega a primeira, nega a segunda", "pegadinha", 1) === true && !/==~/.test(ta().value.split("\n")[7]) && /==~Nega a primeira, nega a segunda==/.test(ta().value.split("\n")[10]),
    "MT8 com a 2ª ocorrência selecionada, marca a 2ª: " + ta().value.split("\n")[10]);

  /* ---- MT9 tirar a marca pelo trecho visível ---- */
  zerar();
  marcar("Regra: Nega a primeira", "importante");
  api.matPorSelecao("Regra: Nega a primeira");
  api.matTirarMarca();
  ok(ta().value === FIX, "MT9 tirar a marca devolve o texto como era: " + ta().value.split("\n")[7]);

  /* ---- MT10 o mapa monta o texto que a leitura mostra ---- */
  const norm = (x) => String(x).replace(/\s+/g, " ").trim();
  const semRotulos = (x) => norm(norm(x).split(api.t("mat_dica_rot")).join(" ").split(api.t("mat_gabarito")).join(" "));
  ok(semRotulos(api.matMapear(FIX).plano) === semRotulos(visivel(FIX)), "MT10 o mapa é o texto da leitura:\n  mapa:    " + norm(api.matMapear(FIX).plano).slice(0, 300) + "\n  leitura: " + semRotulos(visivel(FIX)).slice(0, 300));
  api.uiAlert = alerta0;
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
