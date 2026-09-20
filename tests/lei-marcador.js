/* =====================================================================
 * "PAREI AQUI" — VISÍVEL, SALVO NA HORA, E SEM PERDER O LUGAR NA LEITURA
 *
 * O marcador existia, mas quem lia não sabia como marcar (o único gesto era clicar no número do
 * artigo, que parece título), a faixa "onde parei" trazia um link disfarçado de texto, marcar
 * repintava a lei inteira e a leitura voltava ao topo, e nada dizia que o marcador significa "li
 * até este artigo" nem que já estava salvo.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Todo artigo tem uma bandeirinha ⚑ (escondida só no artigo marcado); ela e o número marcam.
 *  2. Marcar muda NO LUGAR: os mesmos nós, só os dois artigos envolvidos mudam de estado, e a faixa
 *     "onde parei" e a fila acompanham. Um só artigo fica marcado.
 *  3. A faixa "onde parei" diz o que fazer sem marcador, e com marcador traz "Continuar no art. N+1"
 *     e "ir ao art. N" como BOTÕES; no último artigo não há "continuar".
 *  4. O botão flutuante marca o artigo que está no TOPO da tela, acompanha a rolagem, confirma com
 *     "já está salvo" e oferece desfazer; a confirmação some sozinha (e "desfeito" mais depressa).
 *  5. Numa lei grande que ainda está entrando na tela, marcar vale para os artigos que faltam; e
 *     reabrir pelo desenho guardado põe o marcador de AGORA (ele não faz parte da chave do cache).
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const regra = (sel) => (html.match(new RegExp(sel + "\\{([^}]*)\\}")) || [])[1] || "";
  const LEI = ["CAPÍTULO I — Um", "Art. 1º Primeiro.", "Art. 2º Segundo.", "Art. 3º Terceiro.",
    "CAPÍTULO II — Dois", "Art. 4º Quarto.", "Art. 5º Quinto.", "Art. 6º Sexto."].join("\n");
  const montar = (texto) => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito", "Tributário");
    api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Tributário", concurso: "TCE" });
    const l = api.leiGuardar({ id: "lei_m", nome: "Lei M", texto: texto || LEI });
    api.leiLigar(l.id, ch);
    api.leiAbrir("Direito", "Tributário", l.id);
    return { api, l };
  };
  const arts = (api) => Array.from(api.$("leiLeitura").querySelectorAll(".lei-art"));
  const marcados = (api) => arts(api).filter((b) => /lei-art-parei/.test(b.className || "")).map((b) => b._lei.numCru);
  const onde = (api) => api.$("leiOnde");
  const botoes = (api) => Array.from(onde(api).querySelectorAll("button"));

  /* ==============================================================
   * F: A BANDEIRINHA E O NÚMERO
   * ============================================================== */
  {
    const { api, l } = montar();
    const antes = arts(api);
    ok(antes.length === 6 && antes.every((b) => b._lei && b._lei.flag && b._lei.flag.textContent === "⚑" && b._lei.flag.hidden === false), "F1 todo artigo tem a bandeirinha ⚑, visivel");
    ok(/art\. 3º/.test(antes[2]._lei.flag.title) && /art\. 3º/.test(antes[2]._lei.flag.getAttribute("aria-label")), "F1a a dica (e o nome para leitor de tela) diz de qual artigo e': " + antes[2]._lei.flag.title);
    ok(/li até o art|leu até|Salva na hora/i.test(antes[2]._lei.flag.title), "F1b a dica diz o que o marcador significa e que salva na hora: " + antes[2]._lei.flag.title);
    api.$("leiLeitura").scrollTop = 321;
    antes[2]._lei.flag.onclick();
    ok(api.leiDe(l.id).parei === "3" && !!api.leiDe(l.id).pareiEm, "F2 a bandeirinha marca o art. 3 e ja salva (sem 'gravar')");
    const depois = arts(api);
    ok(depois.length === 6 && depois.every((b, i) => b === antes[i]), "F3 marcar NAO refez a leitura: sao os mesmos nos (senao a rolagem voltava ao topo)");
    ok(api.$("leiLeitura").scrollTop === 321, "F3a e a rolagem ficou onde estava");
    ok(marcados(api).join() === "3º" && /parei aqui/.test(antes[2]._lei.rot.textContent) && antes[2]._lei.flag.hidden === true, "F4 so o art. 3º ficou marcado, com o selo e sem a bandeirinha: " + marcados(api));
    ok(antes[2]._lei.rot.getAttribute("aria-current") === "location", "F4a e o leitor de tela sabe (aria-current)");
    /* mover para outro artigo: o antigo volta ao normal */
    antes[4]._lei.flag.onclick();
    ok(marcados(api).join() === "5º" && api.leiDe(l.id).parei === "5", "F5 mudar de artigo: so o novo fica marcado: " + marcados(api));
    ok(antes[2]._lei.flag.hidden === false && !/parei aqui/.test(antes[2]._lei.rot.textContent) && !/lei-art-num-parei/.test(antes[2]._lei.rot.className) && antes[2]._lei.rot.getAttribute("aria-current") === null, "F5a o antigo voltou ao normal (bandeirinha, selo, aria)");
    /* o número marca e desmarca */
    antes[4]._lei.rot.onclick();
    ok(api.leiDe(l.id).parei === "" && marcados(api).length === 0 && antes[4]._lei.flag.hidden === false, "F6 clicar no numero do marcado TIRA o marcador");
    antes[1]._lei.rot.onclick();
    ok(api.leiDe(l.id).parei === "2" && marcados(api).join() === "2º", "F6a e clicar no numero de outro marca");
    /* a fila acompanha (o progresso em %) */
    ok(/33%/.test(api.$("leiFila").textContent || ""), "F7 a fila de leis mostra o progresso novo: " + api.$("leiFila").textContent);
    ok(api.leiMarcadorMudar("2") === false, "F8 marcar o que ja esta marcado nao muda nada");
  }
  {
    /* ABRIR A LEI JA COM MARCADOR: o artigo marcado nasce marcado (sem bandeirinha) e os outros com ela */
    const { api, l } = montar();
    api.leiParar(l.id, "3");
    api.$("dlgLeiSeca").close();
    api.leiAbrir("Direito", "Tributário", l.id);
    const b = arts(api);
    ok(marcados(api).join() === "3º" && b[2]._lei.flag.hidden === true && b.filter((x, i) => i !== 2).every((x) => x._lei.flag.hidden === false), "F9 ao abrir, o marcado nasce marcado e sem bandeirinha, e os outros com ela: " + marcados(api));
    ok(b[2]._lei.rot.getAttribute("aria-current") === "location" && /parei aqui/.test(b[2]._lei.rot.textContent), "F9a e com o selo e o aria-current");
  }

  /* ==============================================================
   * S: A FAIXA "ONDE PAREI"
   * ============================================================== */
  {
    const { api } = montar();
    ok(/Onde parei/.test(onde(api).textContent) && /ainda não marcou onde parou/.test(onde(api).textContent) && /⚑/.test(onde(api).textContent), "S1 sem marcador a faixa diz COMO marcar: " + onde(api).textContent);
    const comecar = botoes(api).filter((b) => /Começar do art\. 1º/.test(b.textContent))[0];
    ok(!!comecar && botoes(api).filter((b) => /continuar/i.test(b.textContent)).length === 0, "S1a e oferece 'Começar do art. 1º', sem 'continuar'");
    comecar.onclick();
    ok(api.$("leiArt_1")._rolouAte === true, "S1b 'Começar' leva ao art. 1º");
    arts(api)[2]._lei.flag.onclick();
    ok(/art\. 3 · li 3 de 6 artigos \(50%\)/.test(onde(api).textContent), "S2 com marcador: 'art. 3 · li 3 de 6 artigos (50%)': " + onde(api).textContent);
    const cont = botoes(api).filter((b) => /continuar/i.test(b.textContent))[0];
    ok(!!cont && /Continuar no art\. 4º ▶/.test(cont.textContent), "S2a 'Continuar' vai ao SEGUINTE (o marcador quer dizer 'li até aqui'): " + (cont && cont.textContent));
    const ir = botoes(api).filter((b) => /^ir ao art\. 3$/.test(b.textContent))[0];
    ok(!!ir && typeof ir.onclick === "function", "S2b e 'ir ao art. 3' e' um botao");
    ir.onclick();
    ok(api.$("leiArt_3")._rolouAte === true, "S2c 'ir ao art. 3' leva ao art. 3");
    cont.onclick();
    ok(api.$("leiArt_4")._rolouAte === true, "S2d 'Continuar' leva ao art. 4");
    /* no último artigo não há o que continuar */
    arts(api)[5]._lei.flag.onclick();
    ok(botoes(api).filter((b) => /continuar/i.test(b.textContent)).length === 0 && /último artigo/.test(onde(api).textContent), "S3 marcado o ultimo artigo nao ha 'continuar': " + onde(api).textContent);
    ok(botoes(api).filter((b) => /^ir ao art\. 6$/.test(b.textContent)).length === 1, "S3a mas 'ir ao art. 6' continua");
  }

  /* ==============================================================
   * C: O BOTÃO FLUTUANTE
   * ============================================================== */
  {
    const { api, l } = montar();
    const cx = api.$("leiLeitura");
    cx._rect = { top: 100, left: 0, width: 700, height: 400 };
    /* art. i com o começo em 100 + (i-3)*200: o 4º (índice 3) está na linha de cima da leitura */
    arts(api).forEach((b, i) => { b._rect = { top: -500 + i * 200, left: 0, width: 700, height: 180 }; });
    cx.onscroll();
    const linha = api.$("leiFlutLinha"), bt = api.$("btnLeiFlut");
    ok(linha.hidden === false && /⚑ Parei no art\. 4º/.test(bt.textContent), "C1 o botao mostra o artigo que esta no TOPO da tela: " + bt.textContent);
    ok(/Salva na hora/.test(bt.title), "C1a e a dica diz que salva na hora: " + bt.title);
    ok(api.leiArtigoDoTopo().num === "4", "C2 leiArtigoDoTopo acha o 4º");
    /* sem layout (todas as medidas zero) o topo e' o COMECO da lei, nao o ultimo artigo */
    const cx0 = { top: cx._rect.top, height: cx._rect.height };
    cx._rect = { top: 0, left: 0, width: 0, height: 0 };
    arts(api).forEach((b) => { b._rect = { top: 0, left: 0, width: 0, height: 0 }; });
    ok(api.leiArtigoDoTopo().num === "1", "C2a sem layout o topo e' o art. 1º (e nao o ultimo): " + api.leiArtigoDoTopo().num);
    cx._rect = { top: cx0.top, left: 0, width: 700, height: cx0.height };
    arts(api).forEach((b, i) => { b._rect = { top: -500 + i * 200, left: 0, width: 700, height: 180 }; });
    /* rolou: o botao acompanha */
    arts(api).forEach((b, i) => { b._rect = { top: 100 + (i - 1) * 200, left: 0, width: 700, height: 180 }; });   /* o 2º (índice 1) no topo */
    cx.onscroll();
    ok(/art\. 2º/.test(bt.textContent), "C3 rolando a leitura o botao acompanha (agora o 2º): " + bt.textContent);
    arts(api).forEach((b, i) => { b._rect = { top: 300 + i * 200, left: 0, width: 700, height: 180 }; });        /* nenhum acima do topo: vale o primeiro */
    cx.onscroll();
    ok(/art\. 1º/.test(bt.textContent), "C3a no comeco da lei (nenhum artigo passou do topo) vale o 1º: " + bt.textContent);
    arts(api).forEach((b, i) => { b._rect = { top: -500 + i * 200, left: 0, width: 700, height: 180 }; });
    cx.onscroll();

    /* marcar pelo botao: confirma, diz que ja esta salvo e oferece desfazer */
    api.segurarAdiados();
    bt.onclick();
    const av = api.$("leiFlutAviso"), desf = api.$("btnLeiFlutDesfazer");
    ok(api.leiDe(l.id).parei === "4", "C4 o botao marcou o art. 4 e ja salvou");
    ok(av.hidden === false && /Marcado: parei no art\. 4º\. Já está salvo\./.test(av.textContent) && desf.hidden === false && bt.hidden === true, "C4a a confirmacao diz 'ja esta salvo' e oferece desfazer: " + av.textContent);
    ok(api.adiadosPresos() >= 1, "C4b a confirmacao some sozinha (ha um temporizador)");
    desf.onclick();
    ok(api.leiDe(l.id).parei === "" && marcados(api).length === 0, "C5 desfazer devolve o marcador de antes (nenhum)");
    ok(/Desfeito\./.test(av.textContent) && desf.hidden === true, "C5a 'Desfeito.' sem novo desfazer: " + av.textContent);
    api.soltarAdiados();
    ok(av.hidden === true && bt.hidden === false && /⚑ Parei no art\. 4º/.test(bt.textContent), "C6 passado o tempo a confirmacao some e o botao volta");

    /* com o topo ja marcado, o botao TIRA */
    api.leiMarcadorMudar("4");
    api.soltarAdiados();
    api.segurarAdiados();
    ok(bt.hidden === false && /Parou aqui/.test(bt.textContent) && /lei-flut-on/.test(bt.className), "C7 no artigo marcado o botao diz 'Parou aqui · tirar': " + bt.textContent);
    bt.onclick();
    ok(api.leiDe(l.id).parei === "" && /Marcador removido\./.test(av.textContent) && desf.hidden === false, "C7a tirar avisa e oferece desfazer");
    desf.onclick();
    ok(api.leiDe(l.id).parei === "4" && marcados(api).join() === "4º", "C7b desfazer o 'tirar' devolve o marcador ao art. 4");
    /* mover de 4 para 6 e desfazer volta ao 4 (nao a nenhum) */
    api.leiMarcadorMudar("6");
    api.$("btnLeiFlutDesfazer").onclick();
    ok(api.leiDe(l.id).parei === "4", "C8 desfazer uma mudanca volta ao marcador ANTERIOR, nao a 'nenhum': " + api.leiDe(l.id).parei);
    /* abrir uma lei de novo (sem fechar) descarta a confirmacao que estava no ar */
    ok(av.hidden === false, "C8a ha uma confirmacao no ar");
    api.leiAbrir("Direito", "Tributário", "lei_m");
    ok(av.hidden === true && bt.hidden === false, "C8b abrir a lei descarta a confirmacao velha (nao a mostra na lei nova)");
    api.soltarAdiados();

    /* so aparece em modo ler; some ao fechar */
    api.segurarAdiados();
    api.leiMarcadorMudar("2");                    /* ha uma confirmacao no ar */
    ok(linha.hidden === false && api.$("leiFlutAviso").hidden === false, "C9-pre ha uma confirmacao visivel");
    api.leiTrocarModo("editar");
    ok(linha.hidden === true, "C9 no modo editar o botao nao aparece (nem a confirmacao que estava no ar)");
    api.soltarAdiados();
    api.leiTrocarModo("recitar");
    ok(linha.hidden === true, "C9a nem no recitar");
    api.leiTrocarModo("ler");
    ok(linha.hidden === false, "C9b voltando a ler, volta");
    api.leiFechar();
    ok(linha.hidden === true, "C10 fechar a lei esconde o botao");
  }
  {
    /* lei ainda nao gravada (colagem): nao ha onde guardar um marcador */
    const r = rodar(); const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito", "Tributário");
    api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Tributário", concurso: "TCE" });
    api.leiAbrir("Direito", "Tributário");
    ok(api.$("leiFlutLinha").hidden === true, "C11 sem lei gravada nao ha botao de marcador");
  }

  /* ==============================================================
   * G: LEI GRANDE — MARCAR ENQUANTO ENTRA NA TELA, E REABRIR PELO DESENHO GUARDADO
   * ============================================================== */
  {
    const grande = []; for (let i = 1; i <= 160; i++) grande.push("Art. " + i + "º Texto do artigo " + i + ".");
    const r = rodar(); const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_g", nome: "Lei Grande", texto: grande.join("\n") });
    api.leiFatiaDefinir(0);                       /* um artigo por quadro: da para olhar o meio do caminho */
    api.leiAbrir("Direito", "T", l.id);
    for (let i = 0; i < 12; i++) await Promise.resolve();
    ok(api.leiPinturaPronta && api.$("leiArt_100") === null || !api.$("leiArt_100"), "G0 no meio do desenho o art. 100 ainda nao existe");
    api.leiMarcadorMudar("100");
    await api.leiPinturaPronta();
    ok(/lei-art-parei/.test((api.$("leiArt_100") || {}).className || ""), "G1 marcou ENQUANTO a lei entrava e o art. 100 (que nasceu depois) ja nasceu marcado");
    ok(marcados(api).length === 1, "G1a e so um artigo marcado: " + marcados(api));
    api.$("dlgLeiSeca").close();
    /* reabrir: o desenho guardado e' reaproveitado (mesmos nos) e traz o marcador de agora */
    api.leiAbrir("Direito", "T", l.id);
    await api.leiPinturaPronta();
    const primeiro = arts(api)[0];
    ok(/lei-art-parei/.test((api.$("leiArt_100") || {}).className || "") && marcados(api).length === 1, "G2 reabrir traz o marcador");
    api.leiParar(l.id, "5");                      /* mudou por fora (ex.: o mapa marcou um capitulo lido) */
    api.$("dlgLeiSeca").close();
    api.leiAbrir("Direito", "T", l.id);
    await api.leiPinturaPronta();
    ok(arts(api)[0] === primeiro, "G3 o marcador mudou mas o desenho guardado foi reaproveitado (nao refez 160 artigos)");
    ok(marcados(api).join() === "5º" && !/lei-art-parei/.test((api.$("leiArt_100") || {}).className || ""), "G3a e os nos mostram o marcador de AGORA (5º), nao o velho: " + marcados(api));
    /* a chave nao depende do que nao muda o desenho */
    const reg = api.leiDe(l.id);
    const k = (o) => api.leiChavePintura(o, reg.texto, {});
    ok(k(Object.assign({}, reg, { tocado: "2030-01-01T00:00:00.000Z" })) === k(reg), "G4 so a hora da gravacao mudou: mesma chave (senao gravar qualquer coisa refazia a lei)");
    const outraOrdem = {}; Object.keys(reg).reverse().forEach((c) => { outraOrdem[c] = reg[c]; });
    ok(k(outraOrdem) === k(reg), "G4a o mesmo registro com os campos em outra ordem: mesma chave");
    ok(k(Object.assign({}, reg, { blocos: { x: "2026-01-01" } })) !== k(reg), "G4b mas o que muda o desenho (aqui, um capitulo lido) muda a chave");
  }

  /* ==============================================================
   * T: HTML, CSS E TEXTOS
   * ============================================================== */
  {
    const { api } = montar();
    ok(/id="leiFlutLinha"[^>]*hidden/.test(html) && /id="btnLeiFlut"/.test(html) && /id="btnLeiFlutDesfazer"/.test(html) && /id="leiFlutAviso"[^>]*role="status"/.test(html), "T1 o botao flutuante, a confirmacao e o desfazer estao no HTML");
    const pos = (s) => html.indexOf(s);
    ok(pos('id="leiRecitar"') < pos('id="leiFlutLinha"') && pos('id="leiFlutLinha"') < pos('id="leiAnexos"'), "T1a a linha do botao fica logo abaixo da leitura");
    ok(/position:relative/.test(regra("\\.lei-flut-linha")) && /height:0/.test(regra("\\.lei-flut-linha")), "T2 a linha ancora com altura zero (sem calcular posicao em JS): " + regra("\\.lei-flut-linha"));
    ok(/position:absolute/.test(regra("\\.lei-flut")) && /bottom:\d+px/.test(regra("\\.lei-flut")) && /right:\d+px/.test(regra("\\.lei-flut")), "T2a o botao se ancora no canto de baixo/direita");
    ok(/\.lei-flut-linha\[hidden\]\{display:none\}/.test(html) && /\.lei-flut-aviso\[hidden\],\.lei-flut-btn\[hidden\]\{display:none\}/.test(html), "T2b escondido de verdade (display vence hidden sem estas regras)");
    ok(/\.lei-art-flag/.test(html) && /@media \(hover:none\)\{\.lei-art-flag\{opacity:\.8\}\}/.test(html), "T3 a bandeirinha tem estilo, e no toque (sem hover) fica bem visivel");
    ok(!/lei-onde-ir\b/.test(html), "T4 o estilo do link disfarçado saiu");
    ok(api.t("lei_continuar", { a: "4º" }) === "Continuar no art. 4º ▶" && api.t("lei_onde_comecar", { a: "1º" }) === "Começar do art. 1º ▶", "T5 os textos dos botoes");
    ok(/PARA MARCAR/.test(api.t("lei_aj_onde_d")) && /PARA VOLTAR/.test(api.t("lei_aj_onde_d")) && /li até este artigo/.test(api.t("lei_aj_onde_d")), "T6 a ajuda explica como marcar, como voltar e o que o marcador quer dizer");
    ok(/^Grifo feito/.test(api.t("mat_marcado_nao_salvo")), "T7 o aviso do grifo nao se confunde com o marcador: " + api.t("mat_marcado_nao_salvo"));
    ok(api.t("lei_parei_em") === "lei_parei_em" && api.t("lei_nao_comecou") === "lei_nao_comecou", "T8 os textos da faixa antiga sairam");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
