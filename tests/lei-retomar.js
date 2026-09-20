/* =====================================================================
 * RETOMAR DE VERDADE — a lei abre no marcador, e o marcador sabe QUAL artigo
 *
 * O marcador guardava só o número, e a Constituição repete quase todos (o corpo e o ADCT têm, cada
 * um, o seu art. 5º): marcar o do ADCT marcava o do corpo. E a lei sempre abria no topo, mesmo
 * com marcador; o "continuar" só existia dentro dela.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O marcador guarda a POSIÇÃO do artigo (pareiIndice). Marcador antigo, sem posição, ou cuja
 *     posição já não aponta para o mesmo número, vale a PRIMEIRA ocorrência — o que sempre valeu.
 *  2. Leitura, faixa, botão flutuante, mapa e "capítulo lido" trabalham pela posição: só a
 *     ocorrência marcada fica marcada; "ir", "continuar" e "desfazer" voltam à ocorrência certa.
 *  3. Ao abrir a lei (inclusive trocando de lei na fila e lei grande entrando na tela) ela vai ao
 *     artigo marcado, que pisca; o seguinte leva "▶ continue aqui" e isso acompanha o marcador.
 *     Citação e questão mandam: vão ao artigo citado (ou ao topo), não ao marcador.
 *  4. A Biblioteca tem "▶ continuar no art. N", que abre a lei no artigo seguinte.
 *  5. O "Registrar estudo" sugere "Lei X, art. N" em "Onde parou" (ou o capítulo escolhido).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const eh = (c, tag) => String(c.tag || c.tagName || "").toLowerCase() === tag;
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  /* dois títulos, e os números 1 e 2 se repetem: posições 0,1 (título I) e 2,3 (título II) */
  const LEI = ["TÍTULO I", "Art. 1º Um do primeiro.", "Art. 2º Dois do primeiro.",
    "TÍTULO II", "Art. 1º Um do segundo.", "Art. 2º Dois do segundo."].join("\n");
  const montar = (extra, texto) => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito", "Tributário");
    api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Tributário", concurso: "TCE" });
    const l = api.leiGuardar(Object.assign({ id: "lei_r", nome: "Lei R", texto: texto || LEI }, extra || {}));
    api.leiLigar(l.id, ch);
    api.leiAbrir("Direito", "Tributário", l.id);
    return { api, l, ch };
  };
  const arts = (api) => Array.from(api.$("leiLeitura").querySelectorAll(".lei-art"));
  const marcados = (api) => arts(api).map((b, i) => (/lei-art-parei/.test(b.className || "") ? i : -1)).filter((i) => i >= 0);
  const onde = (api) => api.$("leiOnde");
  const botoes = (api) => Array.from(onde(api).querySelectorAll("button"));
  const rolou = (api) => arts(api).map((b) => (b._rolouAte ? 1 : 0)).join("");

  /* ==============================================================
   * I: O MARCADOR GUARDA A POSIÇÃO
   * ============================================================== */
  {
    const { api, l } = montar();
    api.leiParar(l.id, "1", 2);
    ok(api.leiDe(l.id).parei === "1" && api.leiDe(l.id).pareiIndice === 2, "I1 leiParar guarda o numero E a posicao: " + JSON.stringify([api.leiDe(l.id).parei, api.leiDe(l.id).pareiIndice]));
    const p = api.leiProgresso(l.id);
    ok(p.lidos === 3 && p.indice === 2 && p.proximo.indice === 3 && p.pct === 75, "I2 o progresso conta ate a posicao marcada (3 de 4), nao ate a 1ª ocorrencia: " + JSON.stringify({ l: p.lidos, i: p.indice, p: p.pct }));
    /* marcador antigo (so o numero): vale a primeira ocorrencia, como sempre valeu */
    api.leiParar(l.id, "1");
    ok(api.leiDe(l.id).pareiIndice === -1 && api.leiProgresso(l.id).lidos === 1, "I3 sem posicao vale a 1ª ocorrencia: " + api.leiProgresso(l.id).lidos);
    /* a posicao guardada nao aponta mais para o mesmo numero (o texto mudou): 1ª ocorrencia */
    api.leiGuardar({ id: l.id, parei: "2", pareiIndice: 2 });          /* a posicao 2 e' um art. "1" */
    ok(api.leiProgresso(l.id).indice === 1, "I4 posicao que nao bate com o numero cai na 1ª ocorrencia: " + api.leiProgresso(l.id).indice);
    /* tirar o marcador zera a posicao */
    api.leiParar(l.id, "");
    ok(api.leiDe(l.id).parei === "" && api.leiDe(l.id).pareiIndice === -1 && api.leiProgresso(l.id).lidos === 0, "I5 tirar zera numero e posicao");
    const arr = api.leiArtigos(LEI).map((a, i) => Object.assign({}, a, { indice: i }));
    ok(api.leiIndiceDoMarcador({ parei: "2", pareiIndice: 3 }, arr) === 3 && api.leiIndiceDoMarcador({ parei: "2" }, arr) === 1 && api.leiIndiceDoMarcador({ parei: "" }, arr) === -1 && api.leiIndiceDoMarcador({ parei: "9" }, arr) === -1, "I6 leiIndiceDoMarcador");
  }
  {
    /* mesclar duas copias da mesma lei leva a posicao junto com o numero */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.leiIniciar();
    a.leiGuardar({ id: "lei_x", nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: LEI, parei: "1", pareiIndice: 2, pareiEm: "2026-02-01T10:00:00.000Z" });
    a.leiGuardar({ id: "lei_y", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "015", ano: "2009", texto: LEI });
    a.leiMesclar("lei_y", ["lei_x"]);
    ok(a.leiDe("lei_y").parei === "1" && a.leiDe("lei_y").pareiIndice === 2, "I7 a mescla leva a POSICAO do marcador junto com o numero: " + JSON.stringify([a.leiDe("lei_y").parei, a.leiDe("lei_y").pareiIndice]));
  }

  /* ==============================================================
   * D: A LEITURA, A FAIXA, O BOTÃO E O DESFAZER PELA POSIÇÃO
   * ============================================================== */
  {
    const { api, l } = montar();
    arts(api)[2]._lei.flag.onclick();                    /* o 2º "Art. 1º" (título II) */
    ok(api.leiDe(l.id).parei === "1" && api.leiDe(l.id).pareiIndice === 2, "D1 a bandeirinha do 2º art. 1º grava a posicao 2");
    ok(marcados(api).join() === "2" && !/lei-art-parei/.test(api.$("leiArt_1").className), "D1a so a ocorrencia marcada fica marcada (o art. 1º do titulo I nao): " + marcados(api));
    ok(/art\. 1 · li 3 de 4 artigos \(75%\)/.test(onde(api).textContent), "D2 a faixa: " + onde(api).textContent);
    botoes(api).filter((b) => /^ir ao art\. 1$/.test(b.textContent))[0].onclick();
    ok(rolou(api) === "0010", "D2a 'ir ao art. 1' vai a ocorrencia MARCADA, nao a 1ª: " + rolou(api));
    botoes(api).filter((b) => /Continuar no art\. 2º/.test(b.textContent))[0].onclick();
    ok(rolou(api) === "0001", "D2b 'Continuar' vai ao artigo seguinte ao marcado (o 2º art. 2º): " + rolou(api));
    /* o botao flutuante: com o marcador na posicao 2, o 1º art. 1º NAO esta marcado */
    const cx = api.$("leiLeitura");
    cx._rect = { top: 100, left: 0, width: 700, height: 400 };
    const topoEm = (i) => { arts(api).forEach((b, k) => { b._rect = { top: 100 + (k - i) * 200, left: 0, width: 700, height: 180 }; }); cx.onscroll(); };
    topoEm(0);
    ok(/⚑ Parei no art\. 1º/.test(api.$("btnLeiFlut").textContent), "D3 no 1º art. 1º o botao oferece marcar (o marcado e' o outro): " + api.$("btnLeiFlut").textContent);
    topoEm(2);
    ok(/Parou aqui/.test(api.$("btnLeiFlut").textContent) && /lei-flut-on/.test(api.$("btnLeiFlut").className), "D3a no 2º art. 1º (o marcado) diz 'Parou aqui': " + api.$("btnLeiFlut").textContent);
    /* o numero do marcado tira; o de outra ocorrencia com o mesmo numero MARCA aquela */
    arts(api)[0]._lei.rot.onclick();
    ok(api.leiDe(l.id).pareiIndice === 0 && marcados(api).join() === "0", "D4 clicar no numero do 1º art. 1º marca ELE (e o outro desmarca): " + marcados(api));
    arts(api)[0]._lei.rot.onclick();
    ok(api.leiDe(l.id).parei === "" && marcados(api).length === 0, "D4a e clicar de novo tira");
    /* o numero da 2ª ocorrencia de um numero repetido marca A 2ª (nao a 1ª com o mesmo numero) */
    arts(api)[3]._lei.rot.onclick();
    ok(api.leiDe(l.id).parei === "2" && api.leiDe(l.id).pareiIndice === 3 && marcados(api).join() === "3", "D4b clicar no numero do 2º art. 2º marca ELE: " + marcados(api) + " / " + api.leiDe(l.id).pareiIndice);
    arts(api)[3]._lei.rot.onclick();
    /* desfazer volta a OCORRENCIA anterior */
    api.segurarAdiados();
    api.leiMarcadorMudar(arts(api)[0]._lei);
    api.leiMarcadorMudar(arts(api)[2]._lei);
    api.$("btnLeiFlutDesfazer").onclick();
    ok(api.leiDe(l.id).pareiIndice === 0 && marcados(api).join() === "0", "D5 desfazer volta ao 1º art. 1º (a ocorrencia de antes, nao a 1ª por acaso): " + marcados(api) + " / " + api.leiDe(l.id).pareiIndice);
    /* e quando a de antes era a 2ª ocorrencia: desfazer volta a ELA (nao a 1ª com o mesmo numero) */
    api.leiMarcadorMudar(arts(api)[3]._lei);
    api.leiMarcadorMudar(arts(api)[0]._lei);
    api.$("btnLeiFlutDesfazer").onclick();
    ok(api.leiDe(l.id).pareiIndice === 3 && marcados(api).join() === "3", "D5a desfazer volta a 2ª ocorrencia (o 2º art. 2º): " + marcados(api) + " / " + api.leiDe(l.id).pareiIndice);
    api.soltarAdiados();
  }
  {
    /* por so o numero, marca a primeira ocorrencia (compatibilidade) */
    const { api, l } = montar();
    api.leiMarcadorMudar("2");
    ok(api.leiDe(l.id).pareiIndice === 1 && marcados(api).join() === "1", "D6 marcar so pelo numero marca a 1ª ocorrencia: " + marcados(api));
  }

  /* ==============================================================
   * M: O MAPA
   * ============================================================== */
  {
    const { api, l } = montar({ parei: "1", pareiIndice: 2 });
    api.leiIrAbrir();
    const grade = api.$("leiIrGrade");
    const chips = achar(grade, (c) => /lei-ir-n(\s|$)/.test(c.className || ""));
    ok(chips.map((c) => (/lei-ir-parei/.test(c.className) ? 1 : 0)).join("") === "0010", "M1 no mapa so a ocorrencia marcada e' verde (a 3ª): " + chips.map((c) => c.className).join(" | "));
    api.$("btnLeiIrF_parei").onclick();
    const ver = achar(grade, (c) => eh(c, "button") && /ver no texto/.test(c.textContent));
    ok(ver.length === 1, "M2 o filtro 'onde parei' lista UM artigo: " + ver.length);
    ver[0].onclick();
    ok(rolou(api) === "0010", "M2a e 'ver no texto' vai a ocorrencia marcada: " + rolou(api));
  }
  {
    /* marcar o titulo II como lido move o marcador para o ULTIMO artigo dele, com a posicao (o 2º art. 2º) */
    const { api, l } = montar();
    api.leiIrAbrir();
    const chks = Array.from(api.$("leiIrGrade").querySelectorAll(".lei-bloco-chk"));
    chks[1].onclick();
    ok(api.leiDe(l.id).parei === "2" && api.leiDe(l.id).pareiIndice === 3 && api.leiProgresso(l.id).lidos === 4, "M3 'capitulo lido' leva o marcador ao ultimo artigo COM a posicao (li 4 de 4, nao 2): " + JSON.stringify([api.leiDe(l.id).parei, api.leiDe(l.id).pareiIndice, api.leiProgresso(l.id).lidos]));
  }

  /* ==============================================================
   * O: ABRIR A LEI NO MARCADOR
   * ============================================================== */
  {
    const { api, l } = montar({ parei: "1", pareiIndice: 2 });
    api.$("dlgLeiSeca").close();
    api.leiAbrir("Direito", "Tributário", l.id);
    ok(rolou(api) === "0010", "O1 a lei abre ja rolada ate o artigo MARCADO (o 2º art. 1º): " + rolou(api));
    ok(/aberta no marcador/.test(api.leiLogTexto()), "O1a e o registro diz");
    ok(!!arts(api)[3]._lei.cont && arts(api)[3]._lei.cont.hidden === false && /continue aqui/.test(arts(api)[3]._lei.cont.textContent), "O2 o artigo seguinte ao marcado leva '▶ continue aqui'");
    ok(arts(api).filter((b) => b._lei.cont && b._lei.cont.hidden === false).length === 1, "O2a e so ele");
    /* o selo acompanha o marcador, no lugar */
    arts(api)[0]._lei.flag.onclick();
    ok(arts(api)[3]._lei.cont.hidden === true && arts(api)[1]._lei.cont && arts(api)[1]._lei.cont.hidden === false, "O3 mudou o marcador: o selo sai do antigo seguinte e vai para o novo");
    arts(api)[0]._lei.rot.onclick();
    ok(arts(api).every((b) => !b._lei.cont || b._lei.cont.hidden === true), "O3a sem marcador nenhum artigo tem o selo");
  }
  {
    const { api } = montar();                           /* sem marcador */
    api.$("dlgLeiSeca").close();
    api.leiAbrir("Direito", "Tributário", "lei_r");
    ok(rolou(api) === "0000", "O4 sem marcador a lei abre no topo, sem rolar: " + rolou(api));
  }
  {
    /* citacao e questao mandam: nao vao ao marcador */
    const { api, l } = montar({ parei: "1", pareiIndice: 2 });
    api.$("dlgLeiSeca").close();
    api.leiAbrirNoArtigo("Direito", "Tributário", l.id, "2");
    ok(rolou(api) === "0100", "O5 aberta por uma citacao vai ao artigo CITADO (art. 2º), nao ao marcador: " + rolou(api));
    api.$("dlgLeiSeca").close();
    const { api: a2, l: l2 } = montar({ parei: "1", pareiIndice: 2 });
    a2.$("dlgLeiSeca").close();
    a2.leiAbrir("Direito", "Tributário", l2.id, { semRetomar: true });
    ok(rolou(a2) === "0000", "O6 semRetomar (o caminho da questao) abre no topo: " + rolou(a2));
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "questoes-ui.js"), "utf8");
    ok(!/leiAbrir\(q\.disciplina, q\.topico\);/.test(src) && (src.match(/leiAbrir\(q\.disciplina, q\.topico, undefined, \{ semRetomar: true \}\)/g) || []).length === 4, "O6a todas as aberturas a partir de uma questao passam semRetomar");
  }
  {
    /* trocar de lei na fila tambem retoma */
    const { api, ch } = montar();
    const l2 = api.leiGuardar({ id: "lei_r2", nome: "Lei R2", texto: LEI, parei: "2", pareiIndice: 3 });
    api.leiLigar(l2.id, ch);
    arts(api).forEach((b) => { b._rolouAte = false; });
    api.leiTrocarPara(l2.id);
    ok(rolou(api) === "0001", "O7 trocar para outra lei da fila abre no marcador dela (o 2º art. 2º): " + rolou(api));
  }
  {
    /* lei grande entrando na tela, com numeros repetidos: vai a ocorrencia certa quando ela e' desenhada */
    const g = []; for (let i = 1; i <= 160; i++) g.push("Art. " + (((i - 1) % 80) + 1) + "º Texto " + i + ".");
    const r = rodar(); const api = r.api;
    api.matIniciar(); api.leiIniciar();
    api.leiGuardar({ id: "lei_g", nome: "Lei Grande", texto: g.join("\n"), parei: "21", pareiIndice: 100 });
    api.leiFatiaDefinir(0);
    api.leiAbrir("Direito", "T", "lei_g");
    await api.leiPinturaPronta();
    ok(api.$("leiArtI_100") && api.$("leiArtI_100")._rolouAte === true && !api.$("leiArt_21")._rolouAte, "O8 lei grande: vai ao art. 21 da SEGUNDA volta (posicao 100), so quando ele e' desenhado, nao ao 1º");
    ok(/lei-art-parei/.test(api.$("leiArtI_100").className) && !/lei-art-parei/.test(api.$("leiArt_21").className), "O8a e so essa ocorrencia esta marcada");
  }

  /* ==============================================================
   * B: A BIBLIOTECA
   * ============================================================== */
  {
    const { api, l } = montar({ parei: "1", pareiIndice: 2 });
    api.$("dlgLeiSeca").close();
    api.leiBibAbrir();
    const bt = achar(api.$("leiBibLista"), (c) => c.id === "btnLeiBibCont_" + l.id);
    const noMarcador = () => (api.leiLogTexto().match(/aberta no marcador/g) || []).length;
    const antesDoClique = noMarcador();
    ok(bt.length === 1 && /▶ continuar no art\. 2º/.test(bt[0].textContent), "B1 o cartao tem '▶ continuar no art. 2º': " + (bt[0] && bt[0].textContent));
    bt[0].onclick();
    ok(api.$("dlgLeiBib").open !== true && api.$("dlgLeiSeca").open === true, "B1a fecha a Biblioteca e abre a lei");
    ok(rolou(api) === "0001", "B1b abre no artigo SEGUINTE ao marcador (o 2º art. 2º), nao no marcado: " + rolou(api));
    ok(noMarcador() === antesDoClique, "B1c e nao passou antes pelo marcador (abre direto no seguinte)");
  }
  {
    const { api, l } = montar();
    api.$("dlgLeiSeca").close();
    api.leiBibAbrir();
    ok(achar(api.$("leiBibLista"), (c) => c.id === "btnLeiBibCont_" + l.id).length === 0, "B2 sem marcador nao ha 'continuar'");
    const { api: a2, l: l2 } = montar({ parei: "2", pareiIndice: 3 });
    a2.$("dlgLeiSeca").close();
    a2.leiBibAbrir();
    ok(achar(a2.$("leiBibLista"), (c) => c.id === "btnLeiBibCont_" + l2.id).length === 0, "B2a marcador no ultimo artigo: nada a continuar");
  }

  /* ==============================================================
   * E: "REGISTRAR ESTUDO" SUGERE ONDE PAROU
   * ============================================================== */
  {
    const { api, l } = montar({ parei: "2", pareiIndice: 1 });
    api.leiRegistrarLeitura();
    ok(api.$("regOnde").value === "Lei R, art. 2", "E1 'Onde parou' vem com o marcador: " + api.$("regOnde").value);
    ok(api.leiDe(l.id).parei === "2", "E1a e o marcador nao mudou (e' so sugestao)");
  }
  {
    const { api } = montar();
    api.leiRegistrarLeitura();
    ok(api.$("regOnde").value === "", "E2 sem marcador (e sem capitulo) o campo fica vazio: " + api.$("regOnde").value);
    api.leiIrAbrir();
    Array.from(api.$("leiIrGrade").querySelectorAll(".lei-ir-ler"))[1].onclick();      /* ler so o titulo II */
    api.leiRegistrarLeitura();
    ok(/TÍTULO II/.test(api.$("regOnde").value), "E3 sem marcador, com um capitulo escolhido, sugere o capitulo: " + api.$("regOnde").value);
  }

  /* ==============================================================
   * T: TEXTOS E CSS
   * ============================================================== */
  {
    const { api } = montar();
    ok(/\.lei-art-cont\{[^}]*color:var\(--verde\)/.test(html) && /\.lei-art-cont\[hidden\]\{display:none\}/.test(html), "T1 o selo tem estilo e escondido de verdade");
    ok(api.t("lei_cont_aqui") === "▶ continue aqui" && api.t("lei_bib_continuar", { a: "2º" }) === "▶ continuar no art. 2º" && api.t("lei_reg_onde", { lei: "Lei X", a: "5" }) === "Lei X, art. 5", "T2 os textos");
    /* a posicao do marcador nao entra na chave do desenho guardado (o marcador e' reaplicado aos nos) */
    const reg = api.leiDe("lei_r");
    const kc = (o) => api.leiChavePintura(o, reg.texto, {});
    ok(kc(Object.assign({}, reg, { parei: "1", pareiIndice: 7 })) === kc(reg), "T2a a posicao do marcador nao entra na chave do cache");
    const aj = api.t("lei_aj_onde_d");
    ok(/ADCT/.test(aj) && /Biblioteca/.test(aj) && /continue aqui/.test(aj) && /Onde parou/.test(aj), "T3 a ajuda conta a posicao, a abertura no marcador, a Biblioteca e o registro");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
