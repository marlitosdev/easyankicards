/* =====================================================================
 * PADRÃO ÚNICO DOS PROMPTS DE CARTÃO (16.69.0)
 *
 * O que originou: o botão "Selecionar cartões para melhorar conteúdo"
 * devolvia cartões MAIS CURTOS (o prompt mandava "encurte respostas
 * longas" e não tinha nenhuma cláusula contra perder dado), e cada gerador
 * tinha o seu próprio "curto"/"caber de cabeça" sem número. Aqui se fixa:
 *   - nenhum prompt manda encurtar; todos os que mexem em cartão trazem o
 *     bloco de preservação; os que geram trazem tamanho e qualidade;
 *   - o "N cartões" do tópico pede título e literalidade, e a gravação NÃO
 *     descarta "@" e "+";
 *   - a IA recebe a lista do que o tópico já tem (contra a paráfrase).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  const nenhumMarcadorSolto = (s) => !/\{padrao_|\{frentes\}|\{cards\}.*\{padrao/.test(s);

  /* ---- P1: revisar — nao encurta, nao apaga ---- */
  {
    const p = api.t("rev_prompt_full").replace("{cards}", "X");
    ok(!/encurte respostas/i.test(p), "P1 o revisar ainda manda encurtar respostas");
    ok(/NÃO encurte nem apague/.test(p), "P1a falta a ordem de nao encurtar nem apagar");
    ok(/NÃO PERCA CONTEÚDO/.test(p), "P1b falta o bloco de preservacao");
    ok(/DIVIDE em cartões novos|DIVIDA/.test(p), "P1c falta a saida permitida: dividir em cartoes novos");
    ok(!/SEM criar cartões novos/.test(p), "P1d ainda proibe criar cartoes novos (contradiz dividir)");
    ok(nenhumMarcadorSolto(p), "P1e sobrou marcador {padrao_*} sem resolver");
    /* os numeros da politica, escritos por extenso: se alguem os muda, muda de proposito */
    ok(api.PC_LIM.frente === 200 && api.PC_LIM.vmin === 150 && api.PC_LIM.vmax === 500 && api.PC_LIM.mais === 900,
       "P1f a politica de tamanho (200 / 150-500 / 900) mudou sem o teste ser atualizado");
    ok(/até 200 caracteres/.test(p) && /entre 150 e 500 caracteres/.test(p) && /até 900 caracteres/.test(p),
       "P1f2 os numeros de tamanho nao chegaram ao prompt");
    const c = api.t("rev_prompt_short").replace("{cards}", "X");
    ok(!/notebook/i.test(c), "P1g o prompt curto ainda supoe o NotebookLM");
    ok(/NÃO PERCA CONTEÚDO/.test(c) && /NÃO encurte/.test(c), "P1h o prompt curto nao protege o conteudo");
    ok(nenhumMarcadorSolto(c), "P1i sobrou marcador no prompt curto");
  }

  /* ---- P2: o "N cartoes" do topico pede o cartao rico ---- */
  {
    const p = api.t("mc_prompt", { d: "Direito", tp: "ISS", resumo: "R", tags: "a b",
      frentes: ["O que é o ISS?", "Qual o fato gerador do ISS?"] });
    ok(/@ Lei > Tópico/.test(p) && /\+ Literalidade/.test(p), "P2 o prompt do topico nao pede titulo e literalidade");
    ok(!/caber de cabeça/.test(p), "P2a ainda diz 'caber de cabeca' sem numero");
    ok(/- O que é o ISS\?/.test(p) && /- Qual o fato gerador do ISS\?/.test(p), "P2b a lista do que ja existe nao foi para o prompt");
    ok(/NÃO REPITA/.test(p) && /TAMANHO E PROFUNDIDADE/.test(p) && /QUALIDADE/.test(p), "P2c faltam os blocos de gerar");
    ok(!/NÃO PERCA CONTEÚDO/.test(p), "P2d bloco de preservar so faz sentido ao revisar/corrigir");
    ok(/EXATAMENTE estas etiquetas.*a b/.test(p), "P2e as etiquetas exatas se perderam");
    const sem = api.t("mc_prompt", { d: "D", tp: "T", resumo: "R", tags: "a", frentes: [] });
    ok(/NÃO REPITA/.test(sem) && !/Já existem cartões/.test(sem), "P2f sem cartoes antigos nao deve prometer uma lista");
    ok(nenhumMarcadorSolto(p) && nenhumMarcadorSolto(sem), "P2g sobrou marcador");
  }

  /* ---- P3: corrigir um cartao nao perde o "+" e o "@" ---- */
  {
    const p = api.t("cm_mel_prompt", { defeitos: "-", disciplina: "D", topico: "T", etiquetas: "x", atual: "A :: B" });
    ok(!/caber de cabeça/.test(p), "P3 corrigir ainda diz 'caber de cabeca'");
    ok(/NÃO PERCA CONTEÚDO/.test(p) && /sem perder nenhum dado/.test(p), "P3a corrigir nao protege o conteudo");
    ok(/linhas "\+" \(saiba mais\) e "@" \(título\)/.test(p), "P3b nao manda devolver o saiba mais e o titulo");
    ok(nenhumMarcadorSolto(p), "P3c sobrou marcador");
  }

  /* ---- P4: a bancada (prompt completo e curto) ---- */
  {
    const f = api.t("prompt_full");
    ok(/PADRÃO DE QUALIDADE:\nTAMANHO E PROFUNDIDADE/.test(f.replace(/\r/g, "")), "P4 o prompt completo nao traz o padrao");
    ok(!/deve ser curto/.test(f), "P4a o prompt completo ainda manda 'curto'");
    ok(/{{c1::municipal::municipal ou estadual\?}}/.test(f), "P4b falta o exemplo de cloze com dica");
    ok(nenhumMarcadorSolto(f), "P4c sobrou marcador");
    const m = api.t("prompt_mini");
    ok(!/Cartões curtos/.test(m) && /sem cortar informação/.test(m), "P4d o prompt curto ainda manda cartoes curtos");
  }

  /* ---- P5: composicao dos blocos ---- */
  {
    const g = api.pcPadrao("gerar", { frentes: ["Pergunta A"] }), r = api.pcPadrao("revisar"), c = api.pcPadrao("corrigir");
    ok(/NÃO REPITA/.test(g) && !/NÃO PERCA/.test(g), "P5 gerar: antiduplicacao sim, preservar nao");
    ok(/NÃO PERCA/.test(r) && !/NÃO REPITA/.test(r) && /TAMANHO/.test(r), "P5a revisar: preservar e tamanho, sem antiduplicacao");
    ok(/NÃO PERCA/.test(c) && !/TAMANHO/.test(c), "P5b corrigir: so preservar e qualidade");
    ok(api.pcPadrao("inexistente") === "", "P5c tipo desconhecido devolve vazio, sem quebrar");
    ok(api.pcResolver("a {padrao_revisar} b").indexOf("NÃO PERCA") > 0, "P5d pcResolver nao troca o marcador");
  }

  /* ---- P6: a lista de perguntas ja existentes ---- */
  {
    const muitas = [];
    for (let i = 0; i < 100; i++) muitas.push("Pergunta " + i);
    const l = api.pcListaFrentes(muitas.concat(["pergunta 3", "  ", "x".repeat(400)]));
    const linhas = l.split("\n");
    ok(linhas.length === api.PC_LIM.frentesMax, `P6 a lista devia parar em ${api.PC_LIM.frentesMax}, tem ${linhas.length}`);
    const dup = api.pcListaFrentes(["Igual", "igual", "IGUAL "]);
    ok(dup === "- Igual", `P6a repetidas nao foram unidas: ${JSON.stringify(dup)}`);
    const longa = api.pcListaFrentes(["y".repeat(500)]);
    ok(longa.length <= 142, "P6b uma pergunta gigante estoura o prompt");
    ok(api.pcListaFrentes([]) === "" && api.pcListaFrentes(null) === "", "P6c lista vazia devia dar texto vazio");
  }

  /* ---- P7: perguntas do topico, sem confundir com titulo e saiba mais ---- */
  {
    api.matIniciar();
    const ch = api.matChave("Tributário", "ISS");
    api.matGravarCartoes(ch, "@ Trilha\nO que é o ISS? :: Imposto municipal\n+ Literalidade — texto :: com dois pontos\nQual o fato gerador? :: Serviço", { disciplina: "Tributário", topico: "ISS" });
    const f = api.pcFrentesDoTopico("Tributário", "ISS");
    ok(JSON.stringify(f) === JSON.stringify(["O que é o ISS?", "Qual o fato gerador?"]), `P7 as perguntas do topico saíram erradas: ${JSON.stringify(f)}`);
    ok(api.pcFrentesDoTopico("Tributário", "Outro").length === 0 && api.pcFrentesDoTopico("", "").length === 0, "P7a topico sem cartoes devia dar lista vazia");
  }

  /* ---- P8: o cartao gravado no material volta inteiro (ida e volta) ---- */
  {
    const card = { front: "O que é o ISS?", back: "Imposto municipal sobre serviços", tags: ["tributario"],
      titulo: "Tributário > ISS", more: "Literalidade — Art. 156, III<br>Exemplo — serviço de contabilidade" };
    const bloco = api.cmBlocoCartao(card, "Caruaru");
    ok(bloco.length === 4 && bloco[0] === "@ Tributário > ISS" && /^\+ Literalidade/.test(bloco[2]) && /^\+ Exemplo/.test(bloco[3]),
       `P8 o bloco do cartao saiu errado: ${JSON.stringify(bloco)}`);
    const volta = api.parseText(bloco.join("\n")).cards;
    ok(volta.length === 1 && volta[0].titulo === "Tributário > ISS" && /Art\. 156/.test(volta[0].more || "") && /Exemplo/.test(volta[0].more || ""),
       `P8a ida e volta perdeu titulo ou saiba mais: ${JSON.stringify(volta[0])}`);
    const semExtra = api.cmBlocoCartao({ front: "P", back: "R", tags: [] }, "");
    ok(semExtra.length === 1, "P8b cartao simples devia continuar sendo uma linha so");
    const sujo = api.cmExtrasCartao({ titulo: "A :: B\nC", more: "x :: y\n\n+ z" });
    ok(sujo.antes.length === 1 && !/::|\n/.test(sujo.antes[0]) && sujo.depois.length === 2 && sujo.depois[1] === "+ z",
       `P8c titulo/saiba mais nao foram higienizados: ${JSON.stringify(sujo)}`);
  }

  /* ---- P10: o fluxo do topico de ponta a ponta ----
   * A IA devolve o cartao rico; salvar no material NAO pode descartar o "@"
   * e o "+"; e o proximo prompt do mesmo topico ja leva a pergunta gravada. */
  {
    const conduzir = async (a, promessa) => {
      let pronto = false;
      promessa.then(() => { pronto = true; }, () => { pronto = true; });
      for (let i = 0; i < 12 && !pronto; i++) {
        await Promise.resolve();
        try { a._uiFechar(true); } catch (e) {}
      }
      return promessa;
    };
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const ch = a.matChave("Tributário", "ISS Caruaru");
    a.matGravar(ch, "resumo do ISS", { disciplina: "Tributário", topico: "ISS Caruaru", concurso: "SEFAZ" });
    a.matAbrirEditor({ disciplina: "Tributário", nome: "ISS Caruaru" }, true);
    a.matCartoesAbrir();
    a.matCartoesPrompt();
    ok(!/Já existem cartões/.test(a.$("mcPromptTexto").value), "P10 topico vazio nao devia prometer lista de perguntas");
    a.$("mcTexto").value = "@ Tributário > ISS > Fato gerador\nQual o fato gerador do ISS? :: A prestação de serviço da lista da LC 116 (art. 1º). :: x\n+ Literalidade — O ISS tem como fato gerador a prestação de serviços\n+ Exemplo — serviço de contabilidade";
    a.matCartoesConferir();
    await conduzir(a, a.matCartoesSalvar());
    const gravado = String((a.matResumosAtual()[ch] || {}).cartoes || "");
    ok(/^@ Tributário > ISS > Fato gerador\nQual o fato gerador do ISS\? ::/.test(gravado) && /\n\+ Literalidade — O ISS/.test(gravado) && /\n\+ Exemplo — serviço de contabilidade/.test(gravado),
       `P10a salvar no material descartou o titulo ou o saiba mais: ${JSON.stringify(gravado)}`);
    const volta = a.parseText(gravado).cards;
    ok(volta.length === 1 && volta[0].titulo === "Tributário > ISS > Fato gerador" && /Exemplo/.test(volta[0].more || ""),
       `P10b o cartao gravado nao volta inteiro: ${JSON.stringify(volta[0])}`);
    /* repetir a mesma pergunta com outro saiba mais: e repetida, nao entra */
    a.matCartoesAbrir();
    a.$("mcTexto").value = "Qual o fato gerador do ISS? :: Outra redacao. :: x\n+ Outro extra";
    a.matCartoesConferir();
    await conduzir(a, a.matCartoesSalvar());
    ok(String(a.matResumosAtual()[ch].cartoes) === gravado, "P10c a pergunta repetida entrou de novo (ou o + dela foi parar no texto)");
    /* o proximo prompt ja leva a pergunta */
    a.matCartoesPrompt();
    ok(/Já existem cartões/.test(a.$("mcPromptTexto").value) && /- Qual o fato gerador do ISS\?/.test(a.$("mcPromptTexto").value),
       "P10d o prompt do topico nao leva as perguntas que ja existem");
    /* e o prompt da bancada, quando nasce do topico */
    a.abrirGerar("texto-base", { disciplina: "Tributário", topico: "ISS Caruaru" });
    ok(/- Qual o fato gerador do ISS\?/.test(a.$("genTexto").value), "P10e o prompt da bancada (gerar do topico) nao leva as perguntas existentes");
    a.abrirGerar("texto-base", null);
    ok(!/Já existem cartões/.test(a.$("genTexto").value) && /texto-base/.test(a.$("genTexto").value), "P10f sem topico, o prompt da bancada nao devia trazer lista");
  }

  /* ---- P9: contrato — nenhum texto do app manda encurtar resposta ---- */
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok(!/encurte respostas longas|shorten long answers/i.test(src), "P9 sobrou instrucao de encurtar respostas em algum prompt");
    ok((src.match(/"pc_preservar"/g) || []).length === 2 && (src.match(/"pc_tamanho"/g) || []).length === 2,
       "P9a os blocos pc_* precisam existir em PT e EN");
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/prompts-cartao\.js/.test(html) && /prompts-cartao\.js/.test(sw), "P9b o modulo nao esta no index.html e no cache offline");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`prompts-cartao: ok (${f.quantas} verificacoes)`);
  });
}
