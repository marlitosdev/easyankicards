/* A MATRIZ DE REUSO ENTRE EDITAIS.
 *
 * O mapa antigo desenhava três linhas com um número no meio, e os
 * números eram 191, 158 e 138. Quatro coisas estavam erradas ali, e as
 * três primeiras apareciam na tela:
 *
 * 1. A ESPESSURA NÃO DIZIA NADA. A fórmula era "1,5 + n/8" com teto de
 *    7 pixels: qualquer número acima de 44 saturava. As três linhas
 *    saíam idênticas — a barra deixara de dizer o que existia para
 *    dizer.
 *
 * 2. OS NOMES ATROPELAVAM O NÚMERO. Texto em SVG não quebra nem corta,
 *    e "TCE-PE Auditor de Controle Externo - Contas Públicas" passava
 *    por cima da etiqueta do meio.
 *
 * 3. "ASSUNTOS" CONTAVA ARESTAS. Um tópico ligado a três do outro lado
 *    contava três. E 191 entre dois editais de 533 tópicos é uma coisa;
 *    entre dois de 60, outra — o número não era comparável com nada.
 *
 * 4. O QUARTO ERA O PIOR e não aparecia: o mapa não separava o concurso
 *    que já passou. O TCE-PE, encerrado, era desenhado com a mesma
 *    espessura dos dois que ainda vão acontecer — sugerindo que aquela
 *    ligação valia tanto quanto as vivas. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };

  /* Três concursos: dois futuros e um encerrado. O de origem tem dez
   * tópicos, para a cobertura poder ser uma fração de verdade. */
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    api.diarioPor([]);
    const tops = (pre, q) => {
      const L = [];
      for (let i = 1; i <= q; i++) L.push("+ " + pre + " " + i + " :: 4 :: pq");
      return L.join("\n");
    };
    const iss = api.edCriar("ISS", "# ISS Caruaru | prova: " + daqui(88)
      + " | horas: 20\n@ Tributario :: 5\n" + tops("Assunto ISS", 10));
    /* EDITAIS DE TAMANHOS DIFERENTES, de propósito: 10 e 20 tópicos.
     * Com os dois do mesmo tamanho a cobertura sai igual dos dois
     * lados, e aí "o melhor lado" e "o pior lado" dão o mesmo número —
     * nenhuma asserção sobre qual dos dois vale conseguiria falhar. */
    const sefaz = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + daqui(109)
      + " | horas: 20\n@ Fiscal :: 5\n" + tops("Assunto SEFAZ", 20));
    const tce = api.edCriar("TCE", "# TCE-PE Auditor de Controle Externo"
      + " - Contas Publicas | prova: " + daqui(-30)
      + " | horas: 20\n@ Controle :: 5\n" + tops("Assunto TCE", 10));
    api.hubAbrirEdital(iss.id);
    api.hubVoltar();
    return { iss, sefaz, tce };
  };
  const lig = (api, dA, tA, dB, tB, ed) => api.vkAplicar([{
    de: { chave: api.vkChave(dA, tA) },
    para: { chave: api.vkChave(dB, tB) }, conf: "ALTA" }], ed, "ambos");

  /* ================================================================
   * M1: COBERTURA, NÃO CONTAGEM DE ARESTAS
   * ============================================================== */
  {
    const { api } = rodar();
    const { sefaz } = montar(api);
    /* REPETIÇÃO DOS DOIS LADOS, de propósito.
     *
     * A primeira versão repetia só um tópico do ISS contra três da
     * SEFAZ — e qual dos dois vira o "lado A" depende da ordem dos
     * identificadores, que é aleatória. Metade das vezes a sabotagem
     * caía justamente no lado que já tinha três tópicos distintos, onde
     * contar arestas e contar tópicos dá o mesmo número, e nada
     * aparecia. Com repetição dos dois lados, corromper qualquer um
     * deles muda a conta.
     *
     * São 5 ligações e 3 tópicos distintos de cada lado. */
    lig(api, "Tributario", "Assunto ISS 1", "Fiscal", "Assunto SEFAZ 1", sefaz.id);
    lig(api, "Tributario", "Assunto ISS 1", "Fiscal", "Assunto SEFAZ 2", sefaz.id);
    lig(api, "Tributario", "Assunto ISS 1", "Fiscal", "Assunto SEFAZ 3", sefaz.id);
    lig(api, "Tributario", "Assunto ISS 2", "Fiscal", "Assunto SEFAZ 1", sefaz.id);
    lig(api, "Tributario", "Assunto ISS 3", "Fiscal", "Assunto SEFAZ 1", sefaz.id);

    const p = api.vkMapaDados().pares[0];
    ok(p, "M1-pre o par nao foi montado");
    ok(p.ligacoes === 5,
       "M1 a contagem de ligacoes mudou: " + p.ligacoes);
    /* UM TÓPICO COBERTO DE UM LADO, TRÊS DO OUTRO. */
    const doIss = p.a === "ISS Caruaru" ? p.topicosA : p.topicosB;
    const daSefaz = p.a === "ISS Caruaru" ? p.topicosB : p.topicosA;
    ok(doIss === 3,
       "M1b as ligacoes foram contadas no lugar dos topicos do ISS "
       + "(5 ligacoes, 3 topicos): " + doIss);
    ok(daSefaz === 3,
       "M1c as ligacoes foram contadas no lugar dos topicos da SEFAZ "
       + "(5 ligacoes, 3 topicos): " + daSefaz);

    /* A FRAÇÃO SOBRE O TOTAL DO EDITAL. É o que torna o número
     * comparável entre pares e entre concursos de tamanhos diferentes. */
    ok([p.totalA, p.totalB].sort((x, y) => x - y).join() === "10,20",
       "M1d o total de topicos de cada edital nao entrou na conta: "
       + p.totalA + "/" + p.totalB);
    /* OS DOIS LADOS, e não só o máximo.
     * Cobrar apenas "reuso" deixava passar o estrago em um dos lados: o
     * max() do outro lado tapava o buraco, e a asserção passava com
     * metade da conta quebrada. */
    const pctIss = p.a === "ISS Caruaru" ? p.pctA : p.pctB;
    const pctSef = p.a === "ISS Caruaru" ? p.pctB : p.pctA;
    ok(pctIss === 30,
       "M1e a cobertura do ISS nao e' a fracao sobre o total do edital "
       + "(3 de 10): " + pctIss);
    ok(pctSef === 15,
       "M1f a cobertura da SEFAZ saiu errada (3 de 20): " + pctSef);
    /* O MELHOR DOS DOIS LADOS. É o que responde "vale estudar os dois
     * juntos?": basta que UM dos editais seja bem coberto pelo outro
     * para o estudo compartilhado valer a pena. */
    ok(p.reuso === 30,
       "M1g o reuso nao e' o melhor dos dois lados (30 e 15): "
       + p.reuso);
  }

  /* ---- M2: as faixas de leitura seguem a cobertura ---- */
  {
    const { api } = rodar();
    /* O RÓTULO É ATALHO, O NÚMERO É A MEDIDA — e o corte é arbitrário,
     * o que precisa estar dito em algum lugar. Aqui só se cobra que ele
     * seja monotônico: mais cobertura nunca pode virar faixa menor. */
    ok(api.vkFaixaReuso(40, 5) === "alta", "M2 40% nao e' alta");
    ok(api.vkFaixaReuso(15, 5) === "media", "M2b 15% nao e' media");
    ok(api.vkFaixaReuso(3, 5) === "baixa", "M2c 3% nao e' baixa");
    /* SEM LIGAÇÃO VIVA, a faixa é outra coisa: não é "pouco em comum",
     * é "esta prova já passou". As duas frases levam a decisões
     * diferentes. */
    ok(api.vkFaixaReuso(90, 0) === "encerrado",
       "M2d um par sem ligacao viva foi classificado por cobertura");
  }

  /* ================================================================
   * M3: O CONCURSO ENCERRADO NÃO CONCORRE COM OS VIVOS
   * ============================================================== */
  {
    const { api } = rodar();
    const { sefaz, tce } = montar(api);
    /* uma ligação viva e TRÊS com o concurso que já passou: pela
     * contagem bruta o encerrado ganharia o topo da lista */
    lig(api, "Tributario", "Assunto ISS 1", "Fiscal", "Assunto SEFAZ 1", sefaz.id);
    lig(api, "Tributario", "Assunto ISS 2", "Controle", "Assunto TCE 1", tce.id);
    lig(api, "Tributario", "Assunto ISS 3", "Controle", "Assunto TCE 2", tce.id);
    lig(api, "Tributario", "Assunto ISS 4", "Controle", "Assunto TCE 3", tce.id);

    const d = api.vkMapaDados();
    ok(d.pares.length === 2, "M3-pre nao sao dois pares: " + d.pares.length);
    /* o "|| {}" evita que uma falha na separacao derrube o arquivo
     * inteiro com TypeError, levando junto as falhas ja coletadas */
    const vivo = d.pares.filter((p) => !p.encerrado)[0] || {};
    const morto = d.pares.filter((p) => p.encerrado)[0] || {};
    ok(vivo.a && morto.a,
       "M3-pre2 o cenario nao separou vivo de encerrado: "
       + JSON.stringify(d.pares.map((p) => p.a + "|" + p.encerrado)));

    /* O VIVO VEM PRIMEIRO, mesmo tendo menos ligações. Ordenar por
     * quantidade poria o concurso que já passou no topo — e o topo da
     * lista é onde o olho decide o que estudar. */
    ok(d.pares[0] === vivo && !!vivo.a,
       "M3 o par com o concurso encerrado ficou na frente do vivo: "
       + JSON.stringify(d.pares.map((p) => p.a + "|" + p.encerrado)));
    ok(morto.ativas === 0,
       "M3b as ligacoes com um concurso encerrado e vazio foram contadas "
       + "como vivas: " + morto.ativas);
    ok(morto.ligacoes === 3,
       "M3c o historico do concurso encerrado se perdeu: " + morto.ligacoes);
    /* e o maior, que dá a escala da barra, é o das VIVAS */
    ok(d.maior === vivo.ativas,
       "M3d a escala foi calibrada pelas ligacoes mortas: " + d.maior);
    /* E O PAR MORTO NÃO TEM COBERTURA. Cobertura mede "quanto do meu
     * edital o outro cobre" — e um concurso que já passou não cobre
     * nada do que ainda vou estudar. */
    ok(morto.reuso === 0,
       "M3e um concurso encerrado apareceu com cobertura: " + morto.reuso);
  }

  /* ---- M4: a barra mostra a MESMA grandeza que ordena a lista ---- */
  {
    const { api } = rodar();
    const { sefaz, tce } = montar(api);
    /* dois pares vivos com coberturas diferentes. Na escala absoluta
     * antiga (teto de 7 px a partir de 44 ligações) os dois sairiam
     * idênticos. */
    const tceVivo = api.edCriar("TCE2", "# TCE vivo | prova: " + daqui(200)
      + " | horas: 20\n@ Controle2 :: 5\n"
      + "+ A :: 4 :: pq\n+ B :: 4 :: pq\n+ C :: 4 :: pq\n+ D :: 4 :: pq");
    for (let i = 1; i <= 4; i++) {
      lig(api, "Tributario", "Assunto ISS " + i,
          "Fiscal", "Assunto SEFAZ " + i, sefaz.id);
    }
    lig(api, "Tributario", "Assunto ISS 1", "Controle2", "A", tceVivo.id);
    lig(api, "Tributario", "Assunto ISS 2", "Controle2", "B", tceVivo.id);

    const d = api.vkMapaDados();
    api.hubRender();
    const linhas = Array.from(api.$("hubMapa").children || [])
      .filter((x) => x.tag === "button");
    ok(linhas.length >= 2, "M4-pre nao ha duas linhas: " + linhas.length);

    const largura = (li) => {
      const t = Array.from(li.children || [])
        .filter((x) => /hub-par-trilho/.test(x.className || ""))[0];
      const i = t && Array.from(t.children || [])[0];
      return (i && i.style && i.style.width) || "";
    };
    /* A BARRA E A ORDEM MEDEM A MESMA COISA.
     *
     * A primeira versão desenhava a barra em cima do número de ligações
     * e ordenava a lista pela cobertura: o olho lia "esta é maior" e a
     * lista dizia "aquela vem primeiro". Duas grandezas no mesmo
     * desenho é o mesmo defeito de sempre, agora em pixels. */
    const pcts = d.pares.map((p) => p.reuso);
    ok(pcts[0] >= pcts[1],
       "M4 a lista nao esta ordenada pela cobertura: "
       + JSON.stringify(pcts));
    ok(pcts[0] !== pcts[1],
       "M4-pre3 os dois pares tem a mesma cobertura, e assim a barra "
       + "passaria com qualquer formula: " + JSON.stringify(pcts));
    ok(largura(linhas[0]) === pcts[0] + "%",
       "M4b a barra da primeira linha nao mostra a cobertura dela: "
       + largura(linhas[0]) + " para " + pcts[0] + "%");
    ok(largura(linhas[1]) === pcts[1] + "%",
       "M4c a barra da segunda linha nao mostra a cobertura dela: "
       + largura(linhas[1]) + " para " + pcts[1] + "%");
    /* E NUNCA SATURA: cobertura é fração, vai de 0 a 100 por
     * construção — que é o que a escala absoluta antiga não fazia. */
    ok(pcts.every((x) => x >= 0 && x <= 100),
       "M4d a cobertura saiu da faixa de 0 a 100: " + JSON.stringify(pcts));
    ok(tce && true, "M4-pre2");
  }

  /* ================================================================
   * M5: NOME LONGO NÃO ATROPELA NADA
   * ============================================================== */
  {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
    const regra = (css.match(/\.hub-par-n\s*\{([^}]*)\}/) || [])[1] || "";
    ok(/text-overflow\s*:\s*ellipsis/.test(regra),
       "M5 o nome do concurso nao corta com reticencias: " + regra);
    ok(/white-space\s*:\s*nowrap/.test(regra),
       "M5b o nome quebra em duas linhas e desalinha a barra: " + regra);
    /* O "min-width:0" É O QUE FAZ FUNCIONAR. Num filho de flex o
     * tamanho mínimo é o do conteúdo, e sem zerá-lo o text-overflow
     * nunca chega a agir — a caixa cresce em vez de cortar. */
    ok(/min-width\s*:\s*0/.test(regra),
       "M5c sem min-width:0 num filho de flex as reticencias nao "
       + "funcionam: " + regra);

    const { api } = rodar();
    const { tce } = montar(api);
    lig(api, "Tributario", "Assunto ISS 1", "Controle", "Assunto TCE 1", tce.id);
    api.hubRender();
    const li = Array.from(api.$("hubMapa").children || [])
      .filter((x) => x.tag === "button")[0];
    const nomes = [];
    const varrer = (el) => Array.from(el.children || []).forEach((f) => {
      if (/hub-par-n( |$)/.test(f.className || "")) nomes.push(f);
      varrer(f);
    });
    varrer(li);
    /* O NOME INTEIRO FICA NO TÍTULO. Cortar sem oferecer o texto
     * completo troca um defeito por outro: quem tem dois concursos com
     * prefixo igual não consegue distingui-los. */
    ok(nomes.length === 2, "M5d a linha nao tem os dois nomes");
    ok(nomes.every((x) => x.title && x.title === x.textContent),
       "M5e o nome cortado nao guarda o texto completo no titulo: "
       + JSON.stringify(nomes.map((x) => x.title)));
  }

  /* ---- M6: a linha explica o número, e não só o exibe ---- */
  {
    const { api } = rodar();
    const { sefaz } = montar(api);
    lig(api, "Tributario", "Assunto ISS 1", "Fiscal", "Assunto SEFAZ 1", sefaz.id);
    lig(api, "Tributario", "Assunto ISS 2", "Fiscal", "Assunto SEFAZ 2", sefaz.id);
    api.hubRender();
    const box = api.$("hubMapa");

    /* UMA FRASE ANTES DA TABELA. Sem ela, barras com números são
     * enfeite: não se sabe se "191" é bom, nem o que fazer com o dado. */
    const intro = Array.from(box.children || [])
      .filter((x) => /hub-mapa-intro/.test(x.className || ""))[0];
    ok(intro && (intro.textContent || "").length > 60,
       "M6 o mapa nao se explica antes de mostrar numeros: "
       + (intro && intro.textContent));

    /* O TEXTO DA LINHA, e não o da caixa inteira: a frase de
     * introdução já contém a palavra "cobre" e satisfazia sozinha a
     * asserção — que então media a introdução, não a linha. */
    const linha = Array.from(box.children || [])
      .filter((x) => x.tag === "button")[0];
    const txt = (linha && linha.textContent) || "";
    ok(/cobre/i.test(txt),
       "M6b a linha mostra a contagem sem dizer o que ela cobre: "
       + txt.slice(0, 140));
    ok(/%/.test(txt),
       "M6c a cobertura em porcentagem nao aparece na linha: "
       + txt.slice(0, 140));
    /* e o que fazer a seguir */
    ok(/Comparar/i.test(txt),
       "M6d a linha nao diz o que acontece ao tocar nela: "
       + txt.slice(0, 140));
  }

  /* ================================================================
   * M7: CLICAR ABRE A COMPARAÇÃO JÁ COM OS DOIS ESCOLHIDOS
   * ============================================================== */
  {
    const { api } = rodar();
    const { iss, sefaz } = montar(api);
    lig(api, "Tributario", "Assunto ISS 1", "Fiscal", "Assunto SEFAZ 1", sefaz.id);
    api.vkIniciarTela();
    api.hubRender();
    const li = Array.from(api.$("hubMapa").children || [])
      .filter((x) => x.tag === "button")[0];
    ok(li && typeof li.onclick === "function",
       "M7-pre a linha do mapa nao e clicavel");
    li.onclick();

    /* VER O PAR MAIS PROMISSOR E TER DE REENCONTRÁ-LO em dois seletores
     * é pedir o mesmo trabalho duas vezes. */
    const de = api.$("vkDeEdital").value, para = api.$("vkParaEdital").value;
    const ids = [String(iss.id), String(sefaz.id)].sort().join();
    ok([String(de), String(para)].sort().join() === ids,
       "M7 clicar no par nao pre-selecionou os dois editais: "
       + de + " / " + para + " · esperado " + ids);
    ok(api.$("dlgJaEstudei").open === true,
       "M7b clicar no par nao abriu a ferramenta de comparacao");
  }

  /* ---- M8: um par com ele mesmo nunca vira linha ---- */
  {
    const { api } = rodar();
    const { iss } = montar(api);
    /* dois tópicos irmãos do MESMO edital, ligados numa passada da IA.
     * Acontece, e desenhar "ISS ↔ ISS" não informa nada. */
    lig(api, "Tributario", "Assunto ISS 1", "Tributario", "Assunto ISS 2",
        iss.id);
    const d = api.vkMapaDados();
    ok(d.pares.length === 0,
       "M8 um vinculo dentro do mesmo edital virou linha no mapa: "
       + JSON.stringify(d.pares.map((p) => p.a + " x " + p.b)));
    api.hubRender();
    ok(api.$("hubMapa").hidden === true,
       "M8b o mapa vazio ficou ocupando espaco na lista");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
