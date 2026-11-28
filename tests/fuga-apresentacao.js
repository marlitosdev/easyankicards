/* =====================================================================
 * ⚡ A APRESENTAÇÃO DA FUGA RÁPIDA (19.214.0)
 *
 * Quatro queixas, com captura de tela: o artigo cortado no meio ("…dos processos e, indev") e corrido; a barra de
 * rolagem interna escondendo as ações; o "virar" do tamanho de "abrir na Jurisprudência"; e o julgado que era só
 * "STF · Súmula 656" com um link.
 *
 * O QUE PRECISA SER VERDADE:
 *  A1. o artigo vem INTEIRO (sem o corte de 900 caracteres) e com uma linha por dispositivo;
 *  A2. caput, incisos, alíneas e parágrafos em linhas próprias, cada um com a sua classe e o rótulo em negrito;
 *  A3. o artigo longo mostra o começo e "ver o resto (+N linhas)", que abre e recolhe; o curto vem todo, sem botão;
 *  A4. o prazo usa o mesmo desenho;
 *  B1. a janela é uma coluna em que só o meio rola, sem o max-height de 60vh; bolinhas presas em cima, ações embaixo;
 *  C1. virar, "ok" e "próximo" são o botão cheio do cartão (btn btn-azul), um só; "abrir na lei" é secundário;
 *      no rodapé, "outros 5" deixa de competir (secundário);
 *  D1. o julgado guarda tribunal, identificação, órgão · relator · data e resumo;
 *  D2. a frente mostra o selo do tribunal, a identificação, a meta e a pergunta, sem link de citação (o balão
 *      mostrava a tese antes de virar);
 *  D3. virado: o título (enunciado ou tese), a tese e "ver o resumo".
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  /* o simulador guarda os ids dos nós já tirados da tela: o que está à vista se procura dentro da fuga */
  const naTela = (api, id) => (api.$("fugaLista").querySelectorAll("[id=" + id + "]")[0] || null);
  const vazio = (o) => Object.assign({ cartoes: [], questoes: [], artigos: [], marcas: [], julgados: [], mapa: [], prazos: [], dicas: [], discs: new Set() }, o);

  /* um artigo longo como o art. 9º da Lei 14.133/2021 (mais de 900 caracteres, com incisos, alíneas e parágrafos) */
  const art9 = [
    "Art. 9º É vedado ao agente público designado para atuar na área de licitações e contratos, ressalvados os casos previstos em lei:",
    "I - admitir, prever, incluir ou tolerar, nos atos que praticar, situações que:",
    "a) comprometam, restrinjam ou frustrem o caráter competitivo do processo licitatório, inclusive nos casos de participação de sociedades cooperativas;",
    "b) estabeleçam preferências ou distinções em razão da naturalidade, da sede ou do domicílio dos licitantes;",
    "c) sejam impertinentes ou irrelevantes para o objeto específico do contrato;",
    "II - estabelecer tratamento diferenciado de natureza comercial, legal, trabalhista, previdenciária ou qualquer outra entre empresas brasileiras e estrangeiras, inclusive no que se refere a moeda, modalidade e local de pagamento, mesmo quando envolvido financiamento de agência internacional;",
    "III - opor resistência injustificada ao andamento dos processos e, indevidamente, retardar ou deixar de praticar ato de ofício, ou praticá-lo contra disposição expressa em lei.",
    "§ 1º Não poderá participar, direta ou indiretamente, da licitação ou da execução do contrato agente público de órgão ou entidade licitante ou contratante, devendo ser observadas as situações que possam configurar conflito de interesses no exercício ou após o exercício do cargo ou emprego, nos termos da legislação que disciplina a matéria.",
    "§ 2º As vedações de que trata este artigo estendem-se a terceiro que auxilie a condução da contratação na qualidade de integrante de equipe de apoio, profissional especializado ou funcionário ou representante de empresa que preste assessoria técnica.",
    "",
    "Art. 10. Se as autoridades competentes e os servidores públicos que tiverem participado dos procedimentos relacionados às licitações e aos contratos precisarem defender-se, a advocacia pública promoverá a representação judicial.",
  ].join(NL);

  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiGuardar({ id: "lei_14133", nome: "Lei 14.133/2021 - Licitações e Contratos", texto: art9, topicos: [] });
    api.qsTodas().push({ id: "qv1", tipo: "ce", enunciado: "Segundo o art. 9º da Lei 14.133/2021, o agente pode admitir preferência pela sede do licitante.", gabarito: "E",
      tentativas: [{ acertou: false }], disciplina: "Administrativo", topico: "Licitações" });
    const a = api.fugaArtigos().find((x) => x.leiId === "lei_14133" && x.num === "9");
    ok(!!a, "A1-pre o art. 9º entra na fuga");
    if (a) {
      ok(a.verso.length > 900 && /retardar ou deixar de praticar ato de ofício/.test(a.verso) && /assessoria técnica\.$/.test(a.verso),
        "A1 o artigo vem inteiro, sem o corte de 900 caracteres: " + a.verso.length + " car. · fim: " + a.verso.slice(-40));
      ok(a.verso.split(NL).length === 9 && /^I - admitir/.test(a.verso.split(NL)[1]) && /^a\) comprometam/.test(a.verso.split(NL)[2]),
        "A1a uma linha por dispositivo (caput, 3 incisos, 3 alíneas, 2 parágrafos): " + a.verso.split(NL).length);

      api.fugaAbrir({ fontes: vazio({ artigos: [a] }), disc: "", rnd: () => 0 });
      const virar = api.$("btnFugaVirar");
      ok(virar && /\bbtn\b/.test(virar.className) && /btn-azul/.test(virar.className) && !/btn-min/.test(virar.className),
        "C1 'virar' é o botão cheio do cartão (btn btn-azul): " + (virar && virar.className));
      const ir = api.$("btnFugaIr");
      ok(ir && /btn-min/.test(ir.className) && /fuga-ir/.test(ir.className), "C1a 'abrir na lei' fica secundário, à direita: " + (ir && ir.className));
      ok(api.$("fugaLista").querySelectorAll(".btn-azul").length === 1, "C1b um só botão cheio no cartão");
      virar.onclick();
      const lei = api.$("fugaLei");
      ok(!!lei && /fuga-verso-lei/.test(api.$("fugaVerso").className), "A2-pre o verso do artigo é a letra da lei por linhas");
      const lin = lei ? lei.querySelectorAll(".fuga-lei-lin") : [];
      ok(lin.length === 9, "A2 nove linhas, uma por dispositivo: " + lin.length);
      const cls = lin.map((l) => (/fuga-lei-(cap|inc|ali|par|item)/.exec(l.className) || [])[1]).join(",");
      ok(cls === "cap,inc,ali,ali,ali,inc,inc,par,par", "A2a a classe de cada linha (o recuo pela hierarquia): " + cls);
      const rots = lei ? lei.querySelectorAll(".fuga-lei-rot").map((r) => r.textContent).join("|") : "";
      ok(rots === "I -|a)|b)|c)|II -|III -|§ 1º|§ 2º", "A2b o rótulo de cada dispositivo à parte (em negrito): " + rots);
      ok(lin[1] && lin[1].textContent === "I - admitir, prever, incluir ou tolerar, nos atos que praticar, situações que:", "A2c o texto da linha continua inteiro: " + (lin[1] && lin[1].textContent));
      const mais = api.$("btnFugaLeiMais");
      const esc = lin.filter((l) => l.hidden);
      ok(mais && esc.length > 0 && !lin[0].hidden && /ver o resto \(\+\d+ linhas\)/.test(mais.textContent) && mais.textContent.indexOf("+" + esc.length + " ") >= 0,
        "A3 o artigo longo mostra o começo e diz quanto falta: " + (mais && mais.textContent) + " · escondidas " + esc.length);
      if (mais) {
        mais.onclick();
        ok(lin.every((l) => !l.hidden) && /recolher/.test(mais.textContent), "A3a 'ver o resto' mostra tudo e vira 'recolher'");
        mais.onclick();
        ok(lin.filter((l) => l.hidden).length === esc.length, "A3b 'recolher' volta ao recorte");
      }
      ok(api.$("btnFugaSabia") && /btn-min/.test(api.$("btnFugaSabia").className) && api.$("btnFugaNaoSabia"), "C1c 'sabia'/'não sabia' continuam o par de escolhas");
      api.$("btnFugaSabia").onclick();
      api.fugaIr(0);
      const prox = api.$("btnFugaProx");
      ok(prox && /btn-azul/.test(prox.className) && !/btn-min/.test(prox.className), "C1d 'próximo' (ao rever) é o botão cheio: " + (prox && prox.className));
    }
    /* o curto vem todo, sem botão */
    const a10 = api.fugaArtigos().find((x) => x.leiId === "lei_14133" && x.num === "10");
    const curto = a10 || { tipo: "artigo", lei: "Lei X", leiCurta: "Lei X", leiId: "lx", num: "1", rotulo: "Art. 1º", disciplina: "Civil", topico: "T", frente: "Art. 1º · Lei X", verso: "Texto curto do artigo.", motivo: "" };
    api.fugaAbrir({ fontes: vazio({ artigos: [curto] }), disc: "", rnd: () => 0 });
    api.$("btnFugaVirar").onclick();
    ok(naTela(api, "fugaLei") && !naTela(api, "btnFugaLeiMais") && naTela(api, "fugaLei").querySelectorAll(".fuga-lei-lin").every((l) => !l.hidden), "A3c o artigo curto vem todo, sem 'ver o resto'");
  }

  {
    /* A4: o prazo, pela fonte real (com as quebras) e na tela */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiGuardar({ id: "lei_pz", nome: "Lei PZ", texto: ["Art. 5º O recurso será interposto:", "I - em 15 (quinze) dias, da decisão;", "II - em 30 (trinta) dias, da sentença.", "Parágrafo único. O prazo conta da intimação."].join(NL) });
    const pz = api.fugaPrazos(() => 0).find((x) => x.leiId === "lei_pz");
    ok(pz && pz.texto.split(NL).length === 4, "A4 o prazo guarda uma linha por dispositivo: " + (pz && JSON.stringify(pz.texto)));
    if (pz) {
      api.fugaAbrir({ fontes: vazio({ prazos: [Object.assign({}, pz, { disciplina: "Civil" })] }), disc: "", rnd: () => 0 });
      api.$("btnFugaVirar").onclick();
      const cls = api.$("fugaLei") ? api.$("fugaLei").querySelectorAll(".fuga-lei-lin").map((l) => (/fuga-lei-(cap|inc|ali|par|item)/.exec(l.className) || [])[1]).join(",") : "";
      ok(cls === "cap,inc,inc,par", "A4a o prazo usa o mesmo desenho: " + cls);
    }
    /* o que é só de ler: "ok" é o botão cheio */
    api.fugaAbrir({ fontes: vazio({ marcas: [{ tipo: "pegadinha", disciplina: "Civil", topico: "T", texto: "pegadinha para ler com calma" }] }), disc: "", rnd: () => 0 });
    ok(api.$("btnFugaLido") && /btn-azul/.test(api.$("btnFugaLido").className), "C1e o 'ok' do que é só de ler é o botão cheio");
    ok(api.$("btnFugaOutros") && !/btn-azul/.test(api.$("btnFugaOutros").className) && /btn-verde/.test(api.$("btnFugaFechar").className),
      "C1f no rodapé, 'outros 5' não compete com o cartão; 'sair e voltar' segue o primário do rodapé: " + api.$("btnFugaOutros").className);
  }

  {
    /* D: o julgado */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.jurGravar({ tribunal: "STF", classe: "Súmula", numero: "656", orgao: "Tribunal Pleno", data: "2003-09-24",
      tese: "É inconstitucional a lei que estabelece alíquotas progressivas para o imposto de transmissão inter vivos de bens imóveis (ITBI) com base no valor venal do imóvel.",
      resumo: "O ITBI é imposto real: a progressividade só é admitida quando a Constituição autoriza expressamente.",
      topicos: ["direito tributário›impostos municipais"] });
    const js = api.fugaJulgados();
    const j = js[0];
    ok(j && j.tribunal === "STF" && /Súmula 656/.test(j.ident) && !/STF/.test(j.ident) && j.sumula === true,
      "D1 o julgado guarda o tribunal à parte e a identificação: " + JSON.stringify(j && { t: j.tribunal, i: j.ident }));
    ok(j && j.meta === "Tribunal Pleno · 24/09/2003" && /imposto real/.test(j.resumo), "D1a órgão · data e o resumo: " + (j && j.meta));
    if (j) {
      api.fugaAbrir({ fontes: vazio({ julgados: [j] }), disc: "", rnd: () => 0 });
      ok(api.$("fugaJurTrib") && api.$("fugaJurTrib").textContent === "STF" && api.$("fugaJurNome") && /Súmula 656/.test(api.$("fugaJurNome").textContent),
        "D2 a frente: o selo do tribunal e a identificação grande");
      ok(api.$("fugaJurMeta") && /Tribunal Pleno · 24\/09\/2003/.test(api.$("fugaJurMeta").textContent) && api.$("fugaPergunta") && /enunciado/.test(api.$("fugaPergunta").textContent),
        "D2a órgão · data discretos e a pergunta (súmula: o enunciado)");
      ok(!api.$("fugaFrente").querySelectorAll("button").length && !/progressivas/.test(api.$("fugaLista").textContent),
        "D2b a frente não tem link de citação nem a tese (o balão dela entregava a resposta antes de virar)");
      ok(api.$("btnFugaVirar") && /btn-azul/.test(api.$("btnFugaVirar").className) && api.$("btnFugaIr") && /Jurisprudência/.test(api.$("btnFugaIr").textContent) && /btn-min/.test(api.$("btnFugaIr").className),
        "C1g no julgado, 'virar' é o cheio e 'abrir na Jurisprudência' o secundário");
      api.$("btnFugaVirar").onclick();
      const v = api.$("fugaVerso");
      ok(v && /Enunciado/.test(v.textContent) && /progressivas/.test(api.$("fugaJurTese").textContent) && !naTela(api, "fugaPergunta"),
        "D3 virado: o título 'Enunciado', a tese, e a pergunta some");
      ok(api.$("btnFugaJurResumo") && api.$("fugaJurResumo").hidden === true, "D3a o resumo fica num 'ver o resumo'");
      api.$("btnFugaJurResumo").onclick();
      ok(api.$("fugaJurResumo").hidden === false && /esconder/.test(api.$("btnFugaJurResumo").textContent), "D3b 'ver o resumo' mostra o resumo");
    }
    /* o julgado que não é súmula pergunta a tese; o antigo (sem os campos novos) continua de pé */
    const velho = { tipo: "julgado", id: "jv", disciplina: "Civil", topico: "T", frente: "STJ · REsp 123", verso: "tese antiga do julgado", peso: 1 };
    api.fugaAbrir({ fontes: vazio({ julgados: [velho] }), disc: "", rnd: () => 0 });
    ok(/REsp 123/.test(api.$("fugaJurNome").textContent) && /tese/.test(api.$("fugaPergunta").textContent), "D2c o julgado sem os campos novos ainda aparece (e pergunta a tese)");
    api.$("btnFugaVirar").onclick();
    ok(/Tese/.test(api.$("fugaVerso").textContent) && /tese antiga/.test(api.$("fugaVerso").textContent) && !naTela(api, "btnFugaJurResumo"), "D3c sem resumo, sem o botão");
  }

  {
    /* B1: a rolagem (o CSS) */
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(!/\.fuga-palco\{[^}]*max-height:60vh/.test(html), "B1 o meio da fuga perdeu o max-height de 60vh (a barra de rolagem interna)");
    ok(/dialog\.fuga-dlg\[open\]\{display:flex;flex-direction:column;max-height:94dvh/.test(html) && /dialog\.fuga-dlg\[open\] > \.fuga-palco\{flex:1 1 auto\}/.test(html),
      "B1a a janela é uma coluna em que só o meio rola");
    ok(/\.fuga-palco > \.fuga-passos\{position:sticky;top:0/.test(html), "B1b as bolinhas ficam presas no alto");
    ok(/\.fuga-item > \.fuga-acoes,[^{]*\{position:sticky;bottom:0/.test(html), "B1c as ações do item ficam presas embaixo");
    ok(/<button class="btn-min" id="btnFugaOutros"/.test(html), "C1h no HTML, 'outros 5' é secundário");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
