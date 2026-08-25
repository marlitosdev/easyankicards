/* Dicas, questões e "abrir onde está".
 * As perguntas sobre o DESENHO passam pelo interpretador de HTML do stub,
 * não por expressão regular na string: o que interessa é se a leitura
 * montou o bloco certo, não se a minha regex casa com o meu próprio HTML. */
const { rodar, diasAtras } = require("./fumaca.js");
let n = 0, falhas = [];
function ok(q, c) { n++; if (!c) falhas.push("DQ" + n + " " + q); }

function testes() {
  n = 0; falhas = [];
  return Promise.resolve(corpo()).then(() => falhas);
}

async function corpo() {

function novo() {
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, "Linha um.\n**Regra do 70/30:** nas Emendas Pix.\nLinha tres.",
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  return { api, ch };
}

/* --- 1. texto vivo: a caixa e o registro andam juntos --- */
{
  const { api, ch } = novo();
  api.matPorSelecao("Regra do 70/30"); api.matMarcarSelecao("duvida");
  ok("dúvida marcada e NÃO salva já aparece na lista", api.matDuvidas().length === 1);
  ok("o contador do topo enxerga a dúvida não salva",
    api.matTextoVivo(ch, "texto").indexOf("==?") >= 0);
  ok("o registro ainda NÃO tem a marca (só a caixa tem)",
    (api.matResumosAtual()[ch].texto || "").indexOf("==?") < 0);
}

/* --- 2. incorporar dica: caixa, registro e disco --- */
{
  const { api, ch } = novo();
  api.matPorSelecao("Regra do 70/30"); api.matMarcarSelecao("duvida");
  api.matGravarDica(ch, "Regra do 70/30", "Capital e investimento.");
  ok("incorporou", api.matIncorporarDica(ch, "Regra do 70/30", "texto") === true);
  ok("a CAIXA na tela mostra a dica", /^> Capital e investimento/m.test(api.$("matTexto").value));
  ok("o REGISTRO tem a dica", /^> Capital/m.test(api.matResumosAtual()[ch].texto));
  ok("saiu da lista de dicas soltas", !api.matDicaDe(ch, "Regra do 70/30"));
  api.$("btnMatSalvar").onclick();
  ok("salvar DEPOIS não apaga a dica",
    /^> Capital/m.test(JSON.parse(api.lojaLer("eac_resumos"))[ch].texto));
}

/* --- 3. questão: enunciado + gabarito --- */
{
  const { api, ch } = novo();
  api.matPorSelecao("Regra do 70/30"); api.matMarcarSelecao("duvida");
  api.matGravarQuestao(ch, "Regra do 70/30", "Qual o percentual de capital?", "70%.");
  const q = api.matQuestaoDe(ch, "Regra do 70/30");
  ok("questão guardada com enunciado", q && q.enunciado === "Qual o percentual de capital?");
  ok("questão guardada com gabarito", q && q.gabarito === "70%.");
  ok("incorporou", api.matIncorporarQuestao(ch, "Regra do 70/30", "texto") === true);
  const txt = api.$("matTexto").value;
  ok("enunciado na caixa", /^\?> Qual o percentual/m.test(txt));
  ok("gabarito na caixa", /^>> 70%\./m.test(txt));
  ok("enunciado vem ANTES do gabarito",
    txt.indexOf("?> Qual") < txt.indexOf(">> 70%"));
  ok("saiu da lista de questões soltas", !api.matQuestaoDe(ch, "Regra do 70/30"));
  api.$("btnMatSalvar").onclick();
  const disco = JSON.parse(api.lojaLer("eac_resumos"))[ch].texto;
  ok("questão GRAVADA em disco", /^\?> Qual/m.test(disco) && /^>> 70%/m.test(disco));
}

/* --- 4. questão sem gabarito não escreve linha vazia --- */
{
  const { api, ch } = novo();
  api.matGravarQuestao(ch, "Regra do 70/30", "Qual o percentual?", "");
  api.matIncorporarQuestao(ch, "Regra do 70/30", "texto");
  ok("sem gabarito, nenhuma linha '>>' é criada",
    !/^>>\s*$/m.test(api.$("matTexto").value) && !/^>>/m.test(api.$("matTexto").value));
}

/* --- 5. o desenho, num DOM DE VERDADE --- */
{
  const { api } = novo();
  const d = api.$("matLeitura");
  d.innerHTML = api.matParaHtml("Um.\n> A dica.\n?> O enunciado?\n>> O gabarito.\nFim.");
  ok("dica vira bloco .mat-dica", d.querySelectorAll(".mat-dica").length === 1);
  ok("enunciado vira bloco .mat-quest", d.querySelectorAll(".mat-quest").length === 1);
  ok("gabarito vira bloco .mat-gab", d.querySelectorAll(".mat-gab").length === 1);
  ok("o gabarito NÃO foi confundido com dica",
    d.querySelector(".mat-gab").textContent.indexOf("gabarito") >= 0
    && d.querySelector(".mat-dica").textContent.indexOf("gabarito") < 0);
  ok("o '?>' não sobrou visível no texto",
    d.querySelector(".mat-quest").textContent.indexOf("?>") < 0);
}

/* --- 6. abrir onde está --- */
{
  const { api } = novo();
  api.matTrocarModo("ler");
  api.matPorSelecao("Regra do 70/30"); api.matMarcarSelecao("duvida");
  const d = api.$("matLeitura");
  d.innerHTML = api.matParaHtml(api.$("matTexto").value);
  const marcas = d.querySelectorAll("mark");
  let achou = false;
  marcas.forEach((mk) => { if (mk.textContent.indexOf("Regra do 70/30") >= 0) achou = true; });
  ok("o trecho da dúvida é achável entre as <mark> da leitura", achou);
  ok("a marca da dúvida saiu com a classe azul", d.querySelectorAll("mark.m-duv").length === 1);
  /* segura os temporizadores: senão o stub apaga o pisca no mesmo instante
   * e o teste não consegue ver o que o usuário veria por 2,4 segundos */
  api.segurarAdiados();
  ok("em modo leitura, rola até o trecho", api.matIrPara("Regra do 70/30", "texto") === true);
  ok("o apagar do pisca ficou de fato ADIADO", api.adiadosPresos() === 1);
  ok("e o trecho fica piscando",
    d.querySelector("mark.m-duv").classList.contains("mat-piscando"));
  api.soltarAdiados();
  ok("passado o tempo, o pisca é retirado",
    !d.querySelector("mark.m-duv").classList.contains("mat-piscando"));
  api.matTrocarModo("editar");
  ok("em modo edição, seleciona o trecho", api.matIrPara("Regra do 70/30", "texto") === true);
  const cx = api.$("matTexto");
  ok("e o trecho fica MESMO selecionado na caixa",
    cx.selectionEnd > cx.selectionStart
    && cx.value.slice(cx.selectionStart, cx.selectionEnd).indexOf("Regra do 70/30") >= 0);
  ok("trecho inexistente devolve false", api.matIrPara("nao existe isso aqui", "texto") === false);
}

/* --- 7. reabrir o mesmo tópico não descarta o que não foi salvo --- */
{
  const { api } = novo();
  api.matPorSelecao("Regra do 70/30"); api.matMarcarSelecao("duvida");
  const antes = api.$("matTexto").value;
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, false);
  ok("reabrir o MESMO tópico preserva a marca não salva",
    api.$("matTexto").value === antes);
}


/* --- 8. APERTANDO OS BOTÕES DE VERDADE ---
 * Os três defeitos relatados eram de botão: "abrir onde está" e "resolvida"
 * não faziam nada. Testar as funções por baixo não teria pego, porque o que
 * quebrava era o caminho do clique (um showModal em diálogo já aberto
 * lançava e matava o resto do manipulador). Aqui o teste clica. */
{
  const { api, ch } = novo();
  api.matPorSelecao("Regra do 70/30"); api.matMarcarSelecao("duvida");
  api.matDuvidasAbrir();
  const btns = api.$("duvLista").querySelectorAll("button");
  const acha = (rot) => btns.filter((b) => (b.textContent || "").indexOf(rot) >= 0)[0];
  ok("a lista desenhou os quatro botões da dúvida", btns.length >= 4);

  const bAbrir = acha("onde");
  ok("existe o botão de abrir onde está", !!bAbrir);
  let estourou = null;
  try { bAbrir.onclick(); } catch (e) { estourou = e; }
  ok("clicar em 'abrir onde está' NÃO estoura", estourou === null);
  ok("e a lista de dúvidas se fecha", !api.$("dlgDuvidas").open);
  ok("e o resumo fica aberto", api.$("dlgMaterial").open === true);
  /* em modo leitura a prova é o registro: o botão anota se conseguiu ou não
   * localizar o trecho. Antes ele abria e pronto — e "abrir" sem "onde"
   * era exatamente a queixa. */
  ok("o registro diz que abriu NO TRECHO",
    api.matLogAtual().some((e) => (e.o || "").indexOf("aberto no trecho") >= 0));

  /* resolvida */
  api.matDuvidasAbrir();
  const bOk2 = api.$("duvLista").querySelectorAll("button")
    .filter((b) => (b.textContent || "").indexOf("resolvida") >= 0)[0];
  ok("existe o botão resolvida", !!bOk2);
  let estourou2 = null;
  const antes = api.matDuvidas().length;
  let p = null;
  try { p = bOk2.onclick(); } catch (e) { estourou2 = e; }
  /* o botão pergunta antes de resolver; o teste responde que sim */
  api._uiFechar(true);
  try { await p; } catch (e) { estourou2 = e; }
  ok("clicar em 'resolvida' NÃO estoura", estourou2 === null);
  ok("a dúvida sai da lista", api.matDuvidas().length === antes - 1);
  ok("e a marca ==? some do texto na tela", api.$("matTexto").value.indexOf("==?") < 0);
}

/* --- 9. CONSERTAR MARCAÇÃO: mostrar, aplicar e sumir --- */
{
  const { api, ch } = novo();
  api.matGravar(ch, ["**Questao 2 (Cebraspe):* A vedacao.",
                     "* item de lista com **negrito** ok",
                     "*Ato Complexo:** Exige.",
                     "==?duvida aberta e nunca fechada",
                     "linha limpa."].join("\n"),
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.$("dlgMaterial").close();
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");

  /* o marcador de lista NÃO é asterisco solto */
  ok("linha de lista sã não é apontada como torta",
    api.matLinhaTorta("* item de lista com **negrito** ok") === false);
  ok("linha com asterisco perdido DEPOIS do par é apontada",
    api.matLinhaTorta("**Questao 2 (Cebraspe):* A vedacao.") === true);
  ok("linha com asterisco perdido ANTES do par é apontada",
    api.matLinhaTorta("*Ato Complexo:** Exige.") === true);

  const plano = api.matConsertarPlano(ch);
  ok("o plano aponta exatamente as 3 linhas tortas", plano.length === 3);
  ok("toda linha do plano tem conserto", plano.every((p) => p.mudou));
  ok("asterisco perdido depois do par: devolve o par",
    plano.some((p) => p.depois === "**Questao 2 (Cebraspe):** A vedacao."));
  ok("asterisco perdido antes do par: devolve o par",
    plano.some((p) => p.depois === "**Ato Complexo:** Exige."));
  ok("marca aberta: tira só o abridor",
    plano.some((p) => p.depois === "duvida aberta e nunca fechada"));
  /* o plano é só um plano: nem a tela nem o registro podem sair mudados */
  const antesCaixa = api.$("matTexto").value;
  const antesReg = api.matResumosAtual()[ch].texto;
  api.matConsertarPlano(ch);
  ok("montar o plano NÃO altera a caixa", api.$("matTexto").value === antesCaixa);
  ok("montar o plano NÃO altera o registro", api.matResumosAtual()[ch].texto === antesReg);

  api.matPintarConserto();
  ok("o botão aparece com a contagem certa",
    api.$("btnMatConsertar").hidden === false
    && api.$("btnMatConsertar").textContent.indexOf("3") >= 0);

  const n = api.matConsertarNegrito(ch);
  ok("consertou as 3", n === 3);
  ok("a CAIXA na tela recebeu o conserto",
    api.$("matTexto").value.indexOf("**Questao 2 (Cebraspe):**") >= 0);
  ok("o registro também", api.matResumosAtual()[ch].texto.indexOf("**Ato Complexo:**") >= 0);
  ok("a linha de lista ficou intacta",
    api.$("matTexto").value.indexOf("* item de lista com **negrito** ok") >= 0);
  ok("nada mais está torto", api.matConsertarPlano(ch).length === 0);
  api.matPintarConserto();
  ok("e o botão SOME depois de consertar", api.$("btnMatConsertar").hidden === true);
  /* FEEDBACK: apertar salvar tem de responder onde o olho está */
  api.segurarAdiados();
  api.$("btnMatSalvar").onclick();
  ok("o botão de salvar confirma na hora",
    (api.$("btnMatSalvar").textContent || "").indexOf("salvo") >= 0);
  ok("o botão do topo confirma junto",
    (api.$("btnMatSalvarEstadoTopo").textContent || "").indexOf("salvo") >= 0);
  ok("e fica verde", api.$("btnMatSalvar").classList.contains("btn-salvo"));
  ok("a confirmação é temporária, não permanente", api.adiadosPresos() >= 1);
  api.soltarAdiados();
  ok("passado o instante, o rótulo volta",
    (api.$("btnMatSalvar").textContent || "").indexOf("salvo") < 0
    && !api.$("btnMatSalvar").classList.contains("btn-salvo"));
  ok("o conserto sobrevive ao salvamento",
    JSON.parse(api.lojaLer("eac_resumos"))[ch].texto.indexOf("**Ato Complexo:**") >= 0);
}

/* --- 10. dica e gabarito recolhíveis --- */
{
  const { api, ch } = novo();
  api.matGravar(ch, "Trecho.\n> A dica.\n?> Pergunta?\n>> 70%.",
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.$("dlgMaterial").close();
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  const L = api.$("matLeitura");
  ok("a dica virou bloco recolhível", L.querySelectorAll("details.mat-dica").length === 1);
  ok("e vem ABERTA por padrão", L.querySelector("details.mat-dica").open === true);
  ok("o gabarito virou bloco recolhível", L.querySelectorAll("details.mat-gab").length === 1);
  ok("e vem FECHADO — resposta à vista não deixa você se testar",
    !L.querySelector("details.mat-gab").open);
  ok("o botão de recolher dicas aparece", api.$("btnMatDicas").hidden === false);
  api.matAlternarDicas();
  ok("recolher fecha a dica",
    !api.$("matLeitura").querySelector("details.mat-dica").open);
  ok("e a escolha fica lembrada", api.lojaLer("eac_mat_dicas") === "0");
  api.matAlternarDicas();
  ok("expandir abre de novo",
    api.$("matLeitura").querySelector("details.mat-dica").open === true);
}

/* --- 11. uma barra de rolagem só --- */
{
  const { api } = novo();
  const css = require("fs").readFileSync(
    require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
  ok("o painel de leitura não tem mais altura máxima própria",
    /#dlgMaterial #matTexto, #dlgMaterial #matLeitura/.test(css));
  ok("o diálogo do resumo é coluna flexível — e SÓ quando aberto",
    /#dlgMaterial\[open\], #dlgLeiSeca\[open\]\{display:flex;flex-direction:column/.test(css));
}

/* --- 12. MARCAR UM BLOCO DE VÁRIAS LINHAS --- */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  const T = ["**Questao 2 (Cebraspe):** A vedacao e valida?",
             "",
             "- **Resposta: Nao.** O modelo federal preve (ADI 7493).",
             "",
             "**Questao 3 (FGV):** Qual o fundamento?",
             "Outra coisa totalmente separada."].join("\n");
  api.matGravar(ch, T, { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  api.matPorSelecao(T.slice(T.indexOf("Questao 2"), T.indexOf("(ADI 7493).") + 11));
  api.matMarcarSelecao("duvida");
  const v = api.$("matTexto").value.split("\n");

  ok("a marca NÃO vaza para o parágrafo seguinte",
    v[4] === "**Questao 3 (FGV):** Qual o fundamento?");
  ok("a linha intocada depois também fica intacta",
    v[5] === "Outra coisa totalmente separada.");
  ok("a primeira linha foi marcada por inteiro, com o negrito dentro",
    v[0] === "==?**Questao 2 (Cebraspe):** A vedacao e valida?==");
  ok("a segunda linha do bloco também", v[2].indexOf("==?- **Resposta") === 0);
  ok("linha em branco não recebe marca", v[1] === "" && v[3] === "");
  ok("cada linha fecha o próprio negrito",
    v.every((l) => ((l.match(/\*\*/g) || []).length % 2) === 0));

  const d1 = api.matDuvidas();
  ok("uma seleção vira UMA dúvida, não uma por linha", d1.length === 1);
  ok("e ela guarda os dois pedaços", d1[0].pedacos.length === 2);
  ok("nenhuma dúvida em branco na lista", d1.every((x) => x.trecho.trim().length > 3));
  ok("a âncora é a primeira linha, para achar no texto",
    d1[0].ancora.indexOf("Questao 2") === 0);

  /* uma segunda, separada por conteúdo de verdade, NÃO se junta */
  api.matPorSelecao("Outra coisa totalmente separada.");
  api.matMarcarSelecao("duvida");
  ok("marca separada por conteúdo continua sendo outra dúvida",
    api.matDuvidas().length === 2);

  /* resolver limpa TODOS os pedaços */
  api.matResolverDuvida(api.matDuvidas()[0]);
  ok("resolver tira a dúvida inteira da lista", api.matDuvidas().length === 1);
  ok("e o azul sai de todas as linhas dela",
    (api.$("matTexto").value.match(/==\?/g) || []).length === 1);
  ok("o texto volta ao original nas linhas resolvidas",
    api.$("matTexto").value.indexOf("**Questao 2 (Cebraspe):** A vedacao e valida?") >= 0);
}

{
  /* duas marcas na MESMA linha são dois gestos distintos, não um bloco
   * partido: juntá-las quebraria a lista de dúvidas de quem grifa duas
   * expressões da mesma frase. */
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Administrativo", "Atos");
  api.matGravar(ch, "O ato ==?depende de homologacao== e o ==?ato composto== gera duvida.",
    { disciplina: "Direito Administrativo", topico: "Atos" });
  api.matAbrirEditor({ disciplina: "Direito Administrativo", nome: "Atos" }, "ler");
  ok("duas marcas na mesma linha continuam sendo duas dúvidas",
    api.matDuvidas().length === 2);
  api.matResolverDuvida(api.matDuvidas()[0]);
  ok("resolver uma não leva a outra junto", api.matDuvidas().length === 1);
}

{
  /* matEquilibrar, os três caminhos — inclusive o de ENCOLHER, que nenhum
   * cenário de tela alcançava e por isso passava sem ser exercido. */
  const { api } = rodar();
  const E = api.matEquilibrar;
  let r = E("abc **negrito** def", 4, 11);       /* corta o par ao meio */
  ok("equilibrar cresce para incluir o par de negrito",
    "abc **negrito** def".slice(r.ini, r.fim).indexOf("**negrito**") >= 0);
  r = E("**titulo** e mais\n**outro titulo**", 2, 9);
  ok("crescer NÃO atravessa a quebra de linha", r.fim <= 17);
  r = E("abc ** def", 0, 10);                    /* asterisco solto, sem par */
  ok("sem par na linha, encolhe em vez de sair dela", r.fim === 4);
  ok("e nunca devolve faixa invertida", r.fim >= r.ini);
  ok("texto sem conteúdo é reconhecido",
    api.matTemConteudo("**") === false && api.matTemConteudo("---") === false
    && api.matTemConteudo(" a ") === true);
}

/* --- 13. os casos que a sabotagem mostrou que eu não estava alcançando --- */
{
  /* (a) negrito que abre e só fecha na linha SEGUINTE, e perto.
   * Sem trava de linha, o equilíbrio corre atrás desse "**" e a marca
   * atravessa o parágrafo. Com o "**" logo ali, ir para frente é o caminho
   * mais curto — é aqui que a trava importa, e o caso anterior não pegava
   * porque para trás era mais perto. */
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  const T = ["Um trecho com **negrito que nao fecha aqui",
             "**e fecha so nesta linha de baixo.",
             "Linha seguinte intocada."].join("\n");
  api.matGravar(ch, T, { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  api.matPorSelecao("Um trecho com negrito que nao fecha aqui");
  api.matMarcarSelecao("duvida");
  const v = api.$("matTexto").value.split("\n");
  ok("a marca não pula de linha atrás do negrito de fecho",
    v[1] === "**e fecha so nesta linha de baixo.");
  ok("e a marca ficou contida na linha selecionada",
    (v[0].match(/==/g) || []).length === 2);
}
{
  /* (b) pedaço que só tem marcação: "**" sozinho numa linha do bloco.
   * Era o que virava a dúvida em branco da lista. */
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  const T = ["Primeira linha do bloco.", "**", "---", "Terceira linha do bloco."].join("\n");
  api.matGravar(ch, T, { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  /* seleciona como o usuário seleciona: o texto COMO ELE APARECE na
   * leitura, sem os sinais de marcação */
  api.matPorSelecao("Primeira linha do bloco. Terceira linha do bloco.");
  api.matMarcarSelecao("duvida");
  const v = api.$("matTexto").value.split("\n");
  ok("linha que só tem ** não recebe marca", v[1] === "**");
  ok("linha que só tem --- não recebe marca", v[2] === "---");
  ok("as linhas com texto receberam", v[0].indexOf("==?") === 0 && v[3].indexOf("==?") === 0);
  ok("nenhuma dúvida em branco foi criada",
    api.matDuvidas().every((d) => d.trecho.trim().length > 3));
}
{
  /* (c) dica numa dúvida de várias linhas: precisa da âncora para saber
   * ONDE escrever, porque nenhuma linha contém o trecho inteiro. */
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  const T = ["Primeira linha do bloco.", "", "Segunda linha do bloco.", "Fim."].join("\n");
  api.matGravar(ch, T, { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  api.matPorSelecao("Primeira linha do bloco.\n\nSegunda linha do bloco.");
  api.matMarcarSelecao("duvida");
  const d = api.matDuvidas()[0];
  ok("a dúvida tem duas linhas", d && d.pedacos.length === 2);
  api.matGravarDica(ch, d.trecho, "Explicacao da duvida inteira.");
  ok("a dica foi guardada na dúvida de várias linhas", !!api.matDicaDe(ch, d.trecho));
  ok("e consegue ser incorporada", api.matIncorporarDica(ch, d.trecho, "texto") === true);
  const linhas = api.$("matTexto").value.split("\n");
  ok("a dica entra logo abaixo da PRIMEIRA linha do bloco",
    linhas[1] === "> Explicacao da duvida inteira.");
}

/* --- 13b. tirar UMA marca funciona nos SEIS tipos ---
 * Sabotar o regex de matTirarMarca para só conhecer "!" e "?" não quebrava
 * teste nenhum: ninguém verificava tirar marca de lei, prova ou pegadinha.
 * Quem grifasse um artigo em verde não conseguiria desfazer. */
{
  const tipos = [["destaque", "=="], ["importante", "==!"], ["duvida", "==?"],
                 ["lei", "==\u00a7"], ["prova", "==*"], ["pegadinha", "==~"]];
  tipos.forEach(([nome, abre]) => {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "Antes " + abre + "o trecho marcado== depois.",
      { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.matPorSelecao("o trecho marcado");
    api.matTirarMarca();
    ok("tirar a marca de " + nome + " funciona",
      api.$("matTexto").value === "Antes o trecho marcado depois.");
  });
}

/* --- 14. LIMPAR MARCAS: escolher, e não levar dica/questão junto --- */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, "Um ==destaque== e uma ==?duvida com dica== e ==!importante== "
    + "e ==§lei== e ==*prova== e ==~pegadinha== e ==?outra duvida==.",
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  api.matGravarDica(ch, "duvida com dica", "A explicacao.");
  api.matGravarQuestao(ch, "outra duvida", "Enunciado?", "Gabarito.");

  const marcas = api.matMarcasNoTexto(ch, "texto");
  ok("enxerga TODOS os seis tipos de marca", marcas.length === 7);
  ok("reconhece a marca de lei", marcas.some((m) => m.tipo === "lei"));
  ok("reconhece a marca de prova", marcas.some((m) => m.tipo === "prova"));
  ok("reconhece a marca de pegadinha", marcas.some((m) => m.tipo === "pegadinha"));
  ok("sinaliza a que tem dica",
    marcas.filter((m) => m.temDica).length === 1);
  ok("sinaliza a que tem questão",
    marcas.filter((m) => m.temQuestao).length === 1);

  /* await, não "return uma promessa": com return, este bloco encerraria
   * corpo() e qualquer teste acrescentado depois nunca rodaria — em
   * silêncio, com a contagem parecendo saudável. */
  const p = api.matLimparMarcas();
  await Promise.resolve().then(() => {
    const itens = api.$("lmLista").querySelectorAll(".lm-item");
    ok("a janela lista uma linha por marca", itens.length === 7);
    const marcadas = itens.filter((el) => el.querySelectorAll("input")[0].checked);
    ok("as que têm dica ou questão vêm DESMARCADAS", marcadas.length === 5);
    ok("o resumo diz quantas sairão",
      api.$("lmResumo").textContent.indexOf("5") >= 0);
    api.$("btnLmOk").onclick();
    return p;
  }).then(() => {
    const v = api.$("matTexto").value;
    ok("as marcas escolhidas saíram", v.indexOf("==destaque==") < 0
      && v.indexOf("==!") < 0 && v.indexOf("==§") < 0
      && v.indexOf("==*") < 0 && v.indexOf("==~") < 0);
    ok("o TEXTO delas continua lá", v.indexOf("destaque") >= 0 && v.indexOf("pegadinha") >= 0);
    ok("a marca com dica ficou", v.indexOf("==?duvida com dica==") >= 0);
    ok("a marca com questão ficou", v.indexOf("==?outra duvida==") >= 0);
    ok("as duas dúvidas continuam na lista", api.matDuvidas().length === 2);
    ok("a dica continua alcançável", !!api.matDicaDe(ch, "duvida com dica"));
    ok("a questão continua alcançável", !!api.matQuestaoDe(ch, "outra duvida"));
  });
}

/* --- 15. LEI SECA: fecha, tem carimbo e é alcançável pelo material --- */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, "Resumo qualquer.",
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias",
      concurso: "TCE-PE Auditor" });

  api.leiAbrir("Direito Financeiro", "Leis Orcamentarias");
  ok("a janela da lei abre", api.$("dlgLeiSeca").open === true);
  ok("com título do tópico",
    api.$("leiTitulo").textContent.indexOf("Leis Orcamentarias") >= 0);
  ok("e com carimbo do CONCURSO",
    api.$("leiSub").textContent.indexOf("TCE-PE Auditor") >= 0);
  ok("e da DISCIPLINA",
    api.$("leiSub").textContent.indexOf("Direito Financeiro") >= 0);

  api.$("leiTexto").value = "Art. 1o A lei orcamentaria anual...";
  api.leiGravar();
  const r = api.matResumosAtual()[ch];
  ok("a lei fica na mesma gaveta do tópico", (r.leiTexto || "").indexOf("Art. 1o") === 0);
  ok("gravar a lei não apaga o resumo", r.texto === "Resumo qualquer.");
  ok("e o concurso fica carimbado no registro", r.concurso === "TCE-PE Auditor");

  /* fechar tem de fechar */
  await api.$("btnLeiFechar").onclick();
  ok("o botão fechar fecha mesmo", api.$("dlgLeiSeca").open === false);
  api.leiAbrir("Direito Financeiro", "Leis Orcamentarias");
  await api.$("btnLeiFechar2").onclick();
  ok("o fechar do rodapé também", api.$("dlgLeiSeca").open === false);

  /* e o material tem porta para ela */
  api.matRender();
  const bLei = api.$("matLista").querySelectorAll("button")
    .filter((b) => (b.textContent || "").indexOf("lei seca") >= 0)[0];
  ok("a lista do material mostra o caminho para a lei seca", !!bLei);
  bLei.onclick();
  ok("e ele abre a lei do tópico certo",
    api.$("dlgLeiSeca").open === true
    && api.$("leiTitulo").textContent.indexOf("Leis Orcamentarias") >= 0);
}

/* --- 16. o diálogo não pode ser mais alto que a tela --- */
{
  const css = require("fs").readFileSync(
    require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
  const bloco = (css.match(/#dlgMaterial\[open\], #dlgLeiSeca\[open\]\{([^}]*)\}/) || [, ""])[1];
  ok("a regra do diálogo existe", bloco.length > 0);
  ok("nenhuma altura FIXA — só o navegador sabe o tamanho da tela",
    !/(^|[^-])height:/.test(bloco));
  ok("e usa max-height", /max-height:92vh/.test(bloco));
  ok("o modo ampliado também é max-height",
    /dialog\.mat-amplo\{max-height:96vh\}/.test(css));
}

/* --- 17. o contador do topo e a lista contam A MESMA COISA --- */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  const T = ["**Questao 2 (Cebraspe):** A vedacao de inscricao e valida?",
             "- **Resposta: Nao.** O modelo federal preve (ADI 7493)."].join("\n");
  api.matGravar(ch, T, { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  api.matPorSelecao(T.replace(/\*\*/g, ""));
  api.matMarcarSelecao("duvida");

  ok("a marca de várias linhas gera uma marca por linha",
    (api.$("matTexto").value.match(/==\?/g) || []).length === 2);
  const naLista = api.matDuvidas().filter((d) => d.chave === ch).length;
  ok("a lista junta as linhas numa dúvida só", naLista === 1);
  const noBotao = (api.$("btnMatDuvidas").textContent.match(/\d+/) || [])[0];
  ok("e o contador do topo diz o MESMO número que a lista",
    Number(noBotao) === naLista);

  /* --- 18. abrir onde está abre LENDO, que é onde o azul existe --- */
  api.matTrocarModo("editar");
  api.matDuvidasAbrir();
  const bAbrir = api.$("duvLista").querySelectorAll("button")
    .filter((b) => (b.textContent || "").indexOf("onde") >= 0)[0];
  ok("existe o botão de abrir onde está", !!bAbrir);
  bAbrir.onclick();
  ok("abrir onde está leva para a LEITURA, mesmo vindo da edição",
    api.matModoAtual() === "ler");

  /* --- 19. e continua achando com o gabarito OCULTO ---
   * Com "ocultar gabarito" ligado, as linhas de questao viram cartoes e o
   * <mark> azul some da tela. Procurando so por <mark>, nada era achado e a
   * funcao caia no ultimo recurso: abrir a edicao. */
  api.qsUiIniciar();
  api.matTrocarModo("ler");
  api.matAlternarProva();
  ok("o gabarito ficou oculto e virou cartão",
    api.$("matLeitura").querySelectorAll(".qp").length === 1);
  ok("o <mark> azul deixou de existir na tela",
    api.$("matLeitura").querySelectorAll("mark").length === 0);
  api.segurarAdiados();
  const achouOculto = api.matIrPara(api.matDuvidas()[0].ancora, "texto");
  ok("mesmo assim, encontra o trecho", achouOculto === true);
  ok("e NÃO foge para o modo de edição", api.matModoAtual() === "ler");
  ok("o cartão da questão fica piscando",
    api.$("matLeitura").querySelectorAll(".qp")
      .some((x) => x.classList.contains("mat-piscando")));
  api.soltarAdiados();
}

/* --- 20. O PAINEL DAS DICAS: listar, formatar, alinhar, apagar --- */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, ["Trecho importante do resumo.",
                     "> Dica que ja esta no texto.",
                     "Outro paragrafo.",
                     ">> isto e gabarito, nao dica."].join("\n"),
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matGravarDica(ch, "Trecho importante", "Dica presa a um trecho.");
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");

  ok("o contador de dicas aparece no topo", api.$("btnMatDicasLista").hidden === false);
  ok("e diz quantas são", /2/.test(api.$("btnMatDicasLista").textContent));
  ok("junta as presas a uma dúvida e as que já estão no texto",
    api.matDicasContar(ch) === 2);
  ok("e NÃO confunde o gabarito (>>) com dica",
    api.matDicasDoResumo(ch).every((d) => !/gabarito/.test(d.texto)));

  api.matDicasListaAbrir();
  const itens = api.$("dicLista").querySelectorAll(".dic-item");
  ok("a lista mostra uma por dica", itens.length === 2);
  ok("diz de onde cada uma é",
    /presa a/.test(itens[0].querySelector(".dic-onde").textContent)
    && /linha/.test(itens[1].querySelector(".dic-onde").textContent));

  const bt = (el, rot) => el.querySelectorAll("button")
    .filter((b) => b.textContent === rot)[0];

  /* ABRE EM LEITURA: nenhuma vira formulario sem voce pedir */
  ok("nenhuma dica abre em modo de edição",
    itens.every((el) => el.querySelectorAll("textarea").length === 0));
  ok("cada uma mostra o texto já formatado",
    itens.every((el) => !!el.querySelector(".dic-vista")));
  ok("e oferece o botão de editar", !!bt(itens[0], "editar"));

  bt(itens[1], "editar").onclick();
  const its = api.$("dicLista").querySelectorAll(".dic-item");
  ok("clicar em editar abre SÓ aquela",
    its.filter((el) => el.querySelectorAll("textarea").length > 0).length === 1);
  ok("e é a que eu escolhi", its[1].querySelectorAll("textarea").length > 0);
  const campo = its[1].querySelectorAll("textarea")[0];

  /* negrito no que está selecionado, e o mesmo botão desfaz */
  campo.setSelectionRange(0, 4);
  bt(its[1], "N").onclick();
  ok("negrito envolve só o que foi selecionado",
    campo.value === "**Dica** que ja esta no texto.");
  bt(its[1], "N").onclick();
  ok("clicar de novo no mesmo trecho tira o negrito",
    campo.value === "Dica que ja esta no texto.");
  campo.setSelectionRange(0, 0);
  const antesSemSel = campo.value;
  bt(its[1], "N").onclick();
  ok("sem nada selecionado, não mexe no texto", campo.value === antesSemSel);

  /* alinhamento */
  campo.setSelectionRange(0, 4);
  bt(its[1], "N").onclick();
  bt(its[1], "justificar").onclick();
  ok("justificar marca o botão como escolhido",
    bt(its[1], "justificar").classList.contains("mat-ligado"));
  ok("e desmarca o de alinhar à esquerda",
    !bt(its[1], "à esquerda").classList.contains("mat-ligado"));
  bt(its[1], "salvar").onclick();
  const linhas = api.$("matTexto").value.split("\n");
  ok("salvou o negrito no texto", /\*\*Dica\*\*/.test(linhas[1]));
  ok("e guardou o alinhamento como '>~'", linhas[1].indexOf(">~ ") === 0);
  ok("a leitura justifica esse bloco",
    /mat-dica-just/.test(api.$("matLeitura").innerHTML || ""));
  ok("o resto do texto ficou intacto",
    linhas[0] === "Trecho importante do resumo." && linhas[2] === "Outro paragrafo.");

  /* voltar para a esquerda desfaz o "~" */
  api.matDicasListaAbrir();
  bt(api.$("dicLista").querySelectorAll(".dic-item")[1], "editar").onclick();
  const it2 = api.$("dicLista").querySelectorAll(".dic-item")[1];
  bt(it2, "à esquerda").onclick();
  bt(it2, "salvar").onclick();
  ok("voltar para a esquerda tira o '~'",
    api.$("matTexto").value.split("\n")[1].indexOf("> ") === 0);
}

/* --- 20b. DICA DE VÁRIAS LINHAS ---
 * O prompt mandava "responda em uma linha" porque eu esmagava as quebras ao
 * salvar. A IA obedecia e devolvia um RESUMO no lugar da anotacao. */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
  const ch = api.matChave("D", "T");
  api.matGravar(ch, ["Texto do resumo.",
                     "> Primeira linha da dica.",
                     "> Segunda linha da MESMA dica.",
                     "Outro paragrafo.",
                     "> Outra dica, separada."].join("\n"),
    { disciplina: "D", topico: "T" });
  api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");

  const ds = api.matDicasDoResumo(ch);
  ok("linhas seguidas viram UMA dica", ds.length === 2);
  ok("e o texto dela guarda a quebra de linha",
    ds[0].texto === "Primeira linha da dica.\nSegunda linha da MESMA dica.");
  ok("a dica separada por conteúdo continua sendo outra",
    ds[1].texto === "Outra dica, separada.");
  ok("a leitura desenha UM bloco por dica, não um por linha",
    api.$("matLeitura").querySelectorAll(".mat-dica").length === 2);

  /* salvar de volta com mais linhas ainda */
  api.matDicaSalvar(ch, ds[0], "Uma.\nDuas.\nTres.", "esquerda");
  const v = api.$("matTexto").value.split("\n");
  ok("gravou uma linha '>' por linha da dica",
    v[1] === "> Uma." && v[2] === "> Duas." && v[3] === "> Tres.");
  ok("e não comeu o texto que vinha depois",
    v.indexOf("Outro paragrafo.") > 3);
  ok("relendo, continua sendo uma dica só",
    api.matDicasDoResumo(ch)[0].texto === "Uma.\nDuas.\nTres.");
}

/* --- 20c. o que volta da IA, arrumado --- */
{
  const { api } = rodar();
  const sujo = ["## Dica melhorada", "",
                "- **A trava de 70%** vale para cada Emenda Pix.",
                "---",
                "* Ja a exigencia de **50%** incide sobre o bolo total.",
                "", "", " "].join("\n");
  const limpo = api.matDicaLimparColagem(sujo);
  ok("tira o título com #", limpo.indexOf("#") < 0);
  ok("tira a linha de separação", limpo.indexOf("---") < 0);
  ok("padroniza o marcador de lista",
    (limpo.match(/^• /gm) || []).length === 2);
  ok("NÃO mexe no negrito, que é o que a leitura desenha",
    (limpo.match(/\*\*/g) || []).length === 4);
  ok("não deixa linha em branco sobrando no fim",
    limpo === limpo.trim() && !/\n\n$/.test(limpo));
  ok("preserva as quebras entre as ideias", limpo.split("\n").length >= 3);
  ok("texto vazio não vira lixo", api.matDicaLimparColagem("   \n\n  ") === "");
}

/* --- 20d. DA COLAGEM ATÉ O DESENHO ---
 * As marcas que vierem no texto colado tem de virar formatacao de verdade
 * na leitura. Testar so a limpeza nao provaria isso: o que importa e o que
 * aparece na tela no fim. */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
  const ch = api.matChave("D", "T");
  api.matGravar(ch, ["Texto do resumo.", "> Dica antiga."].join("\n"),
    { disciplina: "D", topico: "T" });
  api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");

  const daIA = ["## Regra do 70/30", "",
                "- A **trava de 70%** vale para _cada_ Emenda Pix.",
                "---",
                "- Ja os **50% da saude** incidem sobre o ==bolo total==."].join("\n");
  const limpo = api.matDicaLimparColagem(daIA);
  const dica = api.matDicasDoResumo(ch)[0];
  api.matDicaSalvar(ch, dica, limpo, "justificado");

  const linhas = api.$("matTexto").value.split("\n");
  ok("cada linha da dica virou uma linha do texto",
    linhas.filter((l) => /^>~ /.test(l)).length >= 3);
  ok("o negrito sobreviveu à gravação", /\*\*trava de 70%\*\*/.test(api.$("matTexto").value));

  const html = api.$("matLeitura").innerHTML || "";
  ok("o negrito virou <b> na leitura", /<b>trava de 70%<\/b>/.test(html));
  ok("o itálico virou <i> na leitura", /<i>cada<\/i>/.test(html));
  ok("a marca ==destaque== do app também é respeitada", /<mark/.test(html));
  /* contar ELEMENTOS, não a palavra no HTML: "mat-dica" aparece duas vezes
   * dentro de class="mat-dica mat-dica-just" e a conta dava dois blocos */
  ok("tudo num bloco de dica só",
    api.$("matLeitura").querySelectorAll(".mat-dica").length === 1);
  ok("e justificado, como foi escolhido", /mat-dica-just/.test(html));
  ok("o '#' do título não aparece na tela", html.indexOf("#") < 0);
  ok("a linha de separação não aparece", html.indexOf("---") < 0);

  const box = api.$("matLeitura").querySelector(".mat-dica");
  ok("o texto todo chegou à tela",
    /trava de 70%/.test(box.textContent) && /bolo total/.test(box.textContent)
    && /Regra do 70\/30/.test(box.textContent));
}

/* --- 20e. AVISO QUANDO A IA RESUME EM VEZ DE MELHORAR ---
 * Foi o que aconteceu de verdade: o prompt pedia "uma linha" e "mais
 * curta", a IA obedeceu, e tres paragrafos voltaram como uma frase. O
 * prompt foi corrigido, mas pedido nao e garantia — o aviso e a rede. */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
  const ch = api.matChave("D", "T");
  const longa = "A trava de 70% em despesas de capital vale para cada Emenda Pix "
    + "individualmente, enquanto a exigencia de 50% para a saude incide sobre o "
    + "bolo total das emendas individuais do parlamentar, e nao sobre cada uma "
    + "delas isoladamente, o que muda completamente a conta na hora da prova.";
  api.matGravar(ch, ["Texto.", "> " + longa].join("\n"), { disciplina: "D", topico: "T" });
  api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
  api.matDicasListaAbrir();
  api.$("dicLista").querySelectorAll(".dic-item")[0].querySelectorAll("button")
    .filter((b) => b.textContent === "editar")[0].onclick();
  const it = api.$("dicLista").querySelectorAll(".dic-item")[0];
  const caixas = it.querySelectorAll("textarea");
  const resp = caixas[caixas.length - 1];
  const bUsar = it.querySelectorAll("button")
    .filter((b) => (b.textContent || "").indexOf("usar") >= 0)[0];
  ok("existe o botão de usar a versão da IA", !!bUsar);

  /* resposta bem menor: tem de AVISAR */
  resp.value = "70% por emenda; 50% no bolo total.";
  const p1 = bUsar.onclick();
  const msg1 = api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "";
  ok("avisa que a versão colada encolheu",
    /ATEN|menor|RESUMID/i.test(msg1));
  ok("e mostra os dois tamanhos", /\d+ → \d+|\d+ .* \d+/.test(msg1));
  api._uiFechar(false);
  await Promise.resolve(p1).then(() => {
    ok("dizendo não, a dica original continua",
      api.matDicasDoResumo(ch)[0].texto === longa);

    /* resposta de tamanho parecido: confirma sem alarde */
    const it2 = api.$("dicLista").querySelectorAll(".dic-item")[0];
    const cs = it2.querySelectorAll("textarea");
    const r2 = cs[cs.length - 1];
    r2.value = longa.replace("trava de 70%", "**trava de 70%**");
    const b2 = it2.querySelectorAll("button")
      .filter((b) => (b.textContent || "").indexOf("usar") >= 0)[0];
    const p2 = b2.onclick();
    const msg2 = api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "";
    ok("versão de tamanho parecido NÃO dispara o alarme",
      !/ATEN|RESUMID/i.test(msg2));
    api._uiFechar(true);
    return Promise.resolve(p2);
  }).then(() => {
    const campo = api.$("dicLista").querySelectorAll(".dic-item")[0]
      .querySelectorAll("textarea")[0];
    ok("aceitando, o texto entra na caixa com o negrito",
      /\*\*trava de 70%\*\*/.test(campo.value));
  });
}

/* --- 20f. "Salvar resumo" grava a dica que estiver em edicao ---
 * O painel tem o seu proprio salvar, mas o gesto natural de quem acabou de
 * escrever e apertar o botao grande. Sem isto, esse gesto perdia o texto. */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
  const ch = api.matChave("D", "T");
  api.matGravar(ch, ["Texto.", "> Dica original."].join("\n"),
    { disciplina: "D", topico: "T" });
  api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
  api.matDicasListaAbrir();
  api.$("dicLista").querySelectorAll(".dic-item")[0].querySelectorAll("button")
    .filter((b) => b.textContent === "editar")[0].onclick();
  const campo = api.$("dicLista").querySelectorAll(".dic-item")[0]
    .querySelectorAll("textarea")[0];
  campo.value = "Dica **reescrita** pelo usuario.";

  /* NAO clica no salvar do painel: usa o botao grande do resumo */
  api.$("btnMatSalvar").onclick();
  ok("o salvar do resumo gravou a dica em edição",
    /Dica \*\*reescrita\*\* pelo usuario\./.test(api.matResumosAtual()[ch].texto));
  ok("e a dica antiga saiu", !/Dica original/.test(api.matResumosAtual()[ch].texto));
  ok("o resto do resumo continua lá", /^Texto\./m.test(api.matResumosAtual()[ch].texto));
  ok("sobrou uma dica só", api.matDicasContar(ch) === 1);
}

/* --- 20g. atalho das questoes na agenda da semana --- */
{
  const { api } = rodar();
  api.matIniciar(); api.qsUiIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, "Texto.", { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.qsAplicar(api.qsLerResposta("? CE :: FGV :: Uma afirmacao.\n= C :: comentario.",
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias", chave: ch }).achados);

  const li = api.edLinhaAgendaTeste
    ? api.edLinhaAgendaTeste({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias",
                               chave: ch })
    : null;
  ok("a montagem da linha da agenda está exposta ao teste", !!li);
  /* O "❓" SAIU DA LINHA E FOI PARA O "⋮".
   * Quatro ícones por linha, dez linhas na semana: quarenta alvos, e
   * nenhum com palavra. O atalho continua existindo — dentro do menu,
   * onde cabe escrever "responder as N questões". */
  const achar = (cls) => {
    let r = null;
    const anda = (x) => (x.children || []).forEach((f) => {
      if ((f.className || "").split(/\s+/).includes(cls) && !r) r = f;
      anda(f);
    });
    anda(li); return r;
  };
  const marca = achar("ed-qst");
  ok("a linha mostra que o tópico tem questões", !!marca);
  ok("e a etiqueta diz quantas são", /1 quest/.test((marca && marca.textContent) || ""));

  const bMais = achar("ed-mais");
  ok("a linha da agenda tem o menu ⋮", !!bMais);
  if (bMais) bMais.onclick({ stopPropagation() {} });
  const itens = [];
  const anda2 = (x) => (x.children || []).forEach((f) => {
    if (/ed-menu-item/.test(f.className || "")) itens.push(f);
    anda2(f);
  });
  anda2(li);
  const bq = itens.filter((b) => /quest/i.test(b.textContent || ""))[0];
  ok("o menu oferece as questões do tópico, por extenso", !!bq);
  if (bq) {
    bq.onclick({ stopPropagation() {} });
    ok("o atalho abre a sessão de questões do tópico",
      api.$("dlgQsResponder").open === true);
  }
}

/* --- 21. apagar dica pergunta antes, e o texto do resumo não é tocado --- */
{
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar(); api.qsUiIniciar();
  const ch = api.matChave("D", "T");
  api.matGravar(ch, ["Primeira linha.", "> Uma dica qualquer.", "Ultima linha."].join("\n"),
    { disciplina: "D", topico: "T" });
  api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
  api.matDicasListaAbrir();
  const it = api.$("dicLista").querySelectorAll(".dic-item")[0];
  const bX = it.querySelectorAll("button").filter((b) => b.textContent === "apagar")[0];
  ok("existe o botão de apagar", !!bX);

  /* diz NÃO na confirmação: nada pode sumir */
  const p1 = bX.onclick();
  api._uiFechar(false);
  /* await, nao "return": com return, este bloco encerra corpo() e tudo que
   * vier depois nunca roda — em silencio, com a contagem parecendo sa. */
  await Promise.resolve(p1).then(() => {
    ok("dizendo não, a dica continua lá", api.matDicasContar(ch) === 1);
    const it3 = api.$("dicLista").querySelectorAll(".dic-item")[0];
    const bX2 = it3.querySelectorAll("button").filter((b) => b.textContent === "apagar")[0];
    const p2 = bX2.onclick();
    api._uiFechar(true);
    return Promise.resolve(p2);
  }).then(() => {
    ok("dizendo sim, a dica sai", api.matDicasContar(ch) === 0);
    const v = api.$("matTexto").value.split("\n");
    ok("e o resto do resumo fica intacto",
      v[0] === "Primeira linha." && v[v.length - 1] === "Ultima linha.");
    ok("a linha da dica saiu do texto", !/Uma dica qualquer/.test(api.$("matTexto").value));
  });
}

/* --- 22. o registro filtra o dia de hoje --- */
{
  const { api } = rodar();
  api.matIniciar();
  api.matReg("teste", "evento de hoje", "agora");
  const L = api.matLogAtual();
  L.unshift({ q: "2026-01-05T10:00:00.000Z", t: "teste", o: "evento antigo", d: "ha meses" });

  api.matLogAbrir();
  ok("o botão de hoje aparece e conta", /1/.test(api.$("btnMatLogHoje").textContent));
  ok("sem filtro, o registro traz tudo",
    /evento antigo/.test(api.$("matLogTexto").value)
    && /evento de hoje/.test(api.$("matLogTexto").value));
  ok("e não vem ligado por engano",
    api.$("btnMatLogHoje").getAttribute("aria-pressed") === "false");

  api.matLogAlternarHoje();
  ok("filtrando, o antigo sai", !/evento antigo/.test(api.$("matLogTexto").value));
  ok("e o de hoje fica", /evento de hoje/.test(api.$("matLogTexto").value));
  ok("o cabeçalho diz quantos de quantos",
    /1 de 2/.test(api.$("matLogTexto").value.split("\n")[0]));
  ok("o botão mostra que está ligado",
    api.$("btnMatLogHoje").getAttribute("aria-pressed") === "true"
    && api.$("btnMatLogHoje").classList.contains("mat-ligado"));

  api.matLogAlternarHoje();
  ok("desligando, tudo volta", /evento antigo/.test(api.$("matLogTexto").value));

  /* o dia é o LOCAL, não o UTC: quem estuda às 22h não pode ver a sessão
   * de ontem por causa de fuso */
  const agora = new Date();
  ok("um evento de agora é 'de hoje'", api.matLogDoDia(agora.toISOString()) === true);
  const ontem = new Date(agora.getTime() - 26 * 3600 * 1000);
  ok("um de 26 horas atrás não é", api.matLogDoDia(ontem.toISOString()) === false);
  ok("data inválida não vira 'hoje'", api.matLogDoDia("nao e data") === false);

  /* O FUSO IMPORTA, e aqui dentro ele não aparece: este ambiente roda em
   * UTC, então local e UTC coincidem e a diferença fica invisível.
   * A verificação vai num processo com fuso de verdade — sem isso, trocar
   * a conta por uma em UTC passaria despercebido, e quem estuda às 22h
   * veria a sessão da noite cair no "ontem". */
  {
    const { execFileSync } = require("child_process");
    const script = "const {rodar}=require('" + __dirname.replace(/\\/g, "/")
      + "/fumaca.js');const {api}=rodar();api.matIniciar();"
      + "const agora=new Date();"
      /* ONTEM às 23h50 no relógio LOCAL. Num fuso adiantado esse instante
       * ainda cai HOJE em UTC — então uma conta feita em UTC responde
       * "é de hoje" para um evento que, para quem viveu o dia, foi ontem. */
      + "const d=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()-1,23,50,0);"
      + "console.log(api.matLogDoDia(d.toISOString())?'HOJE':'ONTEM');";
    let saida = "";
    try {
      saida = String(execFileSync(process.execPath, ["-e", script],
        { env: Object.assign({}, process.env, { TZ: "Pacific/Kiritimati" }),
          encoding: "utf8" })).trim();
    } catch (e) { saida = "ERRO:" + e.message; }
    ok("num fuso adiantado, ontem à noite NÃO é hoje (" + saida + ")",
      saida === "ONTEM");
  }
}

/* --- 23. "Li este material" PERGUNTA, e nao fecha o topico sozinho ---
 * Daqui saia um edMarcar direto: o app estimava o tempo pelo tamanho do
 * texto e dava o assunto por ESTUDADO com esse numero. Treze mil
 * caracteres viravam "9 minutos" e fechavam um topico de uma hora. */
{
  const { api } = rodar();
  api.matIniciar(); api.qsUiIniciar(); api.leiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, "palavra ".repeat(1800),
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
  const antes = JSON.stringify(api.edProgressoAtual ? api.edProgressoAtual() : {});

  api.matRegistrarLeitura();
  /* O RESUMO FICA. Antes ele era fechado ao registrar: quem acabou de
   * ler costuma querer continuar ali — marcar mais um trecho, conferir
   * uma duvida — e tinha de reabrir o topico inteiro para isso. */
  ok("o resumo continua aberto atras do registro", api.$("dlgMaterial").open === true);
  ok("e o registro de estudo abre", api.$("dlgRegistro").open === true);
  ok("no tópico certo", api.$("regTitulo").textContent === "Leis Orcamentarias");
  ok("com o tempo estimado apenas SUGERIDO",
    Number(api.$("regMinutos").value) > 0);
  ok("e com a forma marcada como resumo",
    api.regFormasAtual().length === 1 && api.regFormasAtual()[0] === "resumo");
  ok("NADA foi dado por estudado sem confirmação",
    JSON.stringify(api.edProgressoAtual ? api.edProgressoAtual() : {}) === antes);
  ok("o tempo é editável — é sugestão, não imposição",
    (function () { api.$("regMinutos").value = "60"; return api.$("regMinutos").value === "60"; })());
}

/* --- 24. o diario mostra tempo, forma e desempenho --- */
{
  const { api } = rodar();
  api.diarioPor([{ d: diasAtras(1), c: "df›lo", disc: "Direito Financeiro",
    n: "Leis Orcamentarias", a: "feito", cc: "TCE-PE", m: 95, p: 25,
    f: ["resumo", "questoes"], hu: "boa", q: { feitas: 20, certas: 17 },
    obs: "Errei as de restos a pagar." }]);
  api.abrirDiario();
  const li = api.$("diarioLista").children[0];
  const txt = li.textContent || "";
  ok("o diário mostra quanto tempo foi", /1h35/.test(txt));
  ok("mostra de que jeito se estudou", /Resumo/.test(txt) && /Quest/.test(txt));
  ok("mostra como foi nas questões", /17\/20/.test(txt) && /85%/.test(txt));
  ok("e a anotação que eu escrevi", /restos a pagar/.test(txt));
  const det = li.querySelector(".di-det");
  ok("os detalhes ficam na própria linha", !!det && (det.textContent || "").length > 10);
  /* registro sem esses dados nao pode inventar nada */
  api.diarioPor([{ d: diasAtras(1), c: "d›t", disc: "D", n: "T", a: "feito" }]);
  api.abrirDiario();
  const li2 = api.$("diarioLista").children[0];
  ok("registro antigo, sem tempo nem forma, não inventa nada",
    !/undefined|NaN|null/.test(li2.textContent || ""));
}

/* --- 25. o registro principal filtra por periodo --- */
{
  const { api } = rodar();
  api.reg("TESTE", "evento de agora", "x");
  ok("hoje inclui o que acabou de acontecer",
    api.registroFiltrado(null, 1).length >= 1);
  ok("um evento de meses atrás não é de hoje",
    api.regDentroDoPeriodo({ d: "2026-01-05", h: "10:00:00" }, 1) === false);
  ok("nem dos últimos 7 dias",
    api.regDentroDoPeriodo({ d: "2026-01-05", h: "10:00:00" }, 7) === false);
  ok("'tudo' não filtra nada",
    api.registroFiltrado(null, 0).length >= api.registroFiltrado(null, 1).length);
  ok("data inválida não some do registro",
    api.regDentroDoPeriodo({ d: "nao e data", h: "" }, 7) === true);

  /* "HOJE" É O DIA DO CALENDÁRIO LOCAL, e o registro grava em UTC.
   * O evento é montado como reg() monta — fatias de toISOString —, senão o
   * teste verifica um formato que o app nunca produz. Foi exatamente essa
   * diferença que fez um registro das 21h de sábado em Brasília aparecer
   * como domingo e sumir do "só de hoje" no fim do dia. */
  const comoReg = (data) => ({ d: data.toISOString().slice(0, 10),
                               h: data.toISOString().slice(11, 19) });
  const agora = new Date();
  const madrugadaLocal = new Date(agora.getFullYear(), agora.getMonth(),
    agora.getDate(), 0, 30, 0);
  ok("hoje de madrugada, no relógio local, É hoje",
    api.regDentroDoPeriodo(comoReg(madrugadaLocal), 1) === true);
  const fimDoDiaLocal = new Date(agora.getFullYear(), agora.getMonth(),
    agora.getDate(), 23, 30, 0);
  ok("hoje à noite, no relógio local, também É hoje",
    api.regDentroDoPeriodo(comoReg(fimDoDiaLocal), 1) === true);
  const ontemTarde = new Date(agora.getFullYear(), agora.getMonth(),
    agora.getDate() - 1, 23, 0, 0);
  ok("ontem às 23h NÃO é hoje",
    api.regDentroDoPeriodo(comoReg(ontemTarde), 1) === false);
  ok("mas está nos últimos 7 dias",
    api.regDentroDoPeriodo(comoReg(ontemTarde), 7) === true);
}


/* --- 24: fechar o registro nao leva o resumo junto ---
 * ATENCAO A ORDEM: aqui o helper e ok(MENSAGEM, condicao). Escrevi este
 * bloco na ordem do outro arquivo (condicao, mensagem) e ele passou
 * inteiro sem exercitar nada — a mensagem, sendo string nao vazia, era
 * lida como "verdadeiro". */
{
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const ch = api.matChave("D", "T");
  api.matGravar(ch, "Texto do resumo com palavras suficientes para estimar o tempo.",
    { disciplina: "D", topico: "T" });
  api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
  ok("o resumo nem abriu", api.$("dlgMaterial").open === true);

  api.matRegistrarLeitura();
  ok("registrar leitura nao abriu o registro", api.$("dlgRegistro").open === true);
  ok("registrar a leitura FECHOU o resumo que eu estava lendo",
    api.$("dlgMaterial").open === true);
  ok("o registro abriu sem tempo sugerido", Number(api.$("regMinutos").value) > 0);

  api.$("btnRegFechar").onclick();
  ok("o registro nao fechou", api.$("dlgRegistro").open === false);
  ok("fechar o registro levou o resumo junto", api.$("dlgMaterial").open === true);
}

}

module.exports = { testes };

if (require.main === module) {
  Promise.resolve(testes()).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? "\ndicas/questões: " + f.length + " FALHA(S)\n"
    : "\ndicas/questões: texto vivo, incorporação e abrir-onde-está ok ("
      + n + " verificações)\n");
  process.exit(f.length ? 1 : 0);
  });
}
