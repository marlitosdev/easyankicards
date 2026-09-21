/* =====================================================================
 * BOTÕES QUE MOSTRAM O QUE ACONTECEU
 *
 * Na revisão da colagem da LC 214 a pessoa apertava "aceitar todos" / "recusar todos" e não via nada: o botão não
 * dava sinal de apertado, o contador que mudava ficava fora da tela, e o aviso curto do app (toast) era um div
 * comum — uma janela modal fica na camada de cima do navegador, então todo aviso disparado de dentro de uma
 * janela ("relatório copiado"…) aparecia POR BAIXO dela. Quando tudo já estava aceito, "aceitar todos" não mudava
 * NADA e parecia morto.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O aviso curto é um popover (vai para a camada de cima, acima das janelas) e continua funcionando onde o
 *     navegador não tem popover.
 *  2. Todo botão mostra que foi apertado (:active) e onde está o foco.
 *  3. Na revisão da colagem, uma frase FIXA NO TOPO diz o que o clique fez — inclusive "nada mudou"; marcar/
 *     desmarcar um item e escolher o destino de um anexo também dizem.
 *  3b. "aceitar todos" / "recusar todos" mostram o ESTADO do grupo o tempo todo (não só um piscar): ligado quando
 *     todas estão aceitas / nenhuma está; nenhum dos dois quando o grupo está misto; e um contador "N de M aceitas".
 *  4. Confirmar / seguir com o original / voltar mostram um aviso (a janela fecha, o resultado precisa ficar dito),
 *     e a frase velha não sobra quando a revisão reabre.
 *  5. Manter/voltar um ajuste do leitor também diz o que fez.
 *  6. Um número de item de tabela de anexo (1, 2, 3…) não é número de página.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");

  const L = ["LEI Nº 1, DE 2025"];
  for (let i = 1; i <= 24; i++) {
    if (i % 6 === 1) L.push("Presidência da República — Subchefia para Assuntos Jurídicos");
    L.push("Art. " + i + "º Texto próprio do artigo " + i + ", que trata do imposto e da sua incidência.");
  }
  L.push("Art . 25 Texto com um espaço a mais antes do ponto.");
  L.push("Art . 26 Outro texto com um espaço a mais antes do ponto.");
  L.push("ANEXO I", "TABELA DE ALÍQUOTAS POR PRODUTO", "Produto A 10%", "Produto B 12%", "Produto C 15%");
  const TEXTO = L.join("\n");

  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const pre = api.leiPreprocessar(TEXTO);
  let confirmou = null;
  const abrir = () => { confirmou = null; api.leiRevisarColagemAbrir({ modo: "criar", texto: TEXTO, pre, aoConfirmar(r) { confirmou = r; } }); };
  const aviso = () => api.$("leiPreAviso");
  const toastTxt = () => api.$("toast").textContent;

  /* ---- 1: o aviso curto vai para a camada de cima ---- */
  {
    const el = api.$("toast");
    let mostrou = 0, escondeu = 0, aberto = false;
    el.showPopover = () => { mostrou++; aberto = true; };
    el.hidePopover = () => { escondeu++; aberto = false; };
    el.matches = (s) => s === ":popover-open" && aberto;
    api.segurarAdiados();
    api.toastMsg("Gravado na lixeira", 900);
    ok(el.textContent === "Gravado na lixeira" && cls(el, "on") && mostrou === 1 && aberto, "T1 o aviso aparece e entra na camada de cima (popover): " + JSON.stringify([el.textContent, mostrou]));
    api.toastMsg("Outro aviso", 900);
    ok(el.textContent === "Outro aviso" && mostrou === 2 && escondeu === 1, "T1a um aviso novo ENQUANTO outro esta aberto recomeca (fecha e abre de novo, nao some no meio): " + [mostrou, escondeu]);
    api.soltarAdiados();
    ok(!cls(el, "on") && !aberto, "T1b passado o tempo, o aviso some e o popover fecha");
    api.toast("lei_rel_copiado");
    ok(/copiado/i.test(el.textContent) && mostrou >= 3, "T1c toast(chave) usa o mesmo caminho (os ~90 avisos de dentro de janelas passam a aparecer): " + el.textContent);
    api.soltarAdiados();
    delete el.showPopover; delete el.hidePopover; delete el.matches;
    let caiu = false;
    try { api.segurarAdiados(); api.toastMsg("sem popover"); api.soltarAdiados(); } catch (e) { caiu = true; }
    ok(!caiu && el.textContent === "sem popover", "T2 onde o navegador nao tem popover, o aviso continua funcionando");
  }

  /* ---- 2: o CSS ---- */
  {
    ok(/<div id="toast" popover="manual"[^>]*role="status"/.test(html), "C1 o #toast e' um popover manual e um 'status' para leitor de tela");
    ok(/#toast\[popover\]\{[^}]*inset:auto auto 96px 50%[^}]*margin:0/.test(html), "C2 o popover nao e' esticado pela tela (o navegador o centraliza por padrao)");
    const ativo = (html.match(/button:not\(:disabled\):active\{([^}]*)\}/) || [])[1] || "";
    ok(/filter:brightness/.test(ativo) && /box-shadow:inset/.test(ativo), "C3 todo botao apertado escurece e afunda: " + ativo);
    ok(!/transform/.test(ativo), "C3a sem 'transform' (varios botoes usam para se posicionar)");
    ok(/button:focus-visible\{[^}]*outline:/.test(html), "C4 o botao com foco pelo teclado tem contorno");
    ok(/\.lei-pre-cab \.btn-min\[aria-pressed="true"\]\{[^}]*background:var\(--verde\)/.test(html) && /\.lei-pre-nao\[aria-pressed="true"\]\{[^}]*background:var\(--vermelho\)/.test(html) && /\[aria-pressed="true"\]::before\{content:"✓ "\}/.test(html),
      "C7 o botao LIGADO e' cheio (verde; 'recusar' em vermelho) e traz um visto, para nao depender so' da cor");
    ok(/\.lei-pre-sticky\{[^}]*position:sticky;top:0/.test(html) && /\.lei-pre-aviso\{/.test(html), "C5 o topo da revisao (contador + frase) fica fixo");
    ok(/<div class="lei-pre-sticky">[\s\S]*id="leiPreResumo"[\s\S]*id="leiPreAviso" role="status" aria-live="polite" hidden/.test(html), "C6 a frase fica dentro do topo fixo, escondida ate haver o que dizer, e e' anunciada por leitor de tela");
  }

  /* ---- 3: a revisao da colagem diz o que cada clique fez ---- */
  api.segurarAdiados();
  abrir();
  ok(aviso().hidden === true, "R0 ao abrir a revisao nao ha frase");
  const grupo = (g) => api.$("leiPreGrupo_" + g);
  /* procurados DENTRO do card do grupo: achar pelo id aceitaria um botao ou contador solto, fora da tela */
  const botao = (g, k) => achar(api.$("leiPreGrupo_" + g), (c) => c.id === "btnLeiPre" + k + "_" + g)[0];
  const itens = (g) => achar(grupo(g), (c) => cls(c, "lei-pre-item"));
  const nCab = pre.mudancas.filter((m) => m.grupo === "cabecalho").length;
  const lig = (g, k) => botao(g, k).getAttribute("aria-pressed");
  const cont = (g) => { const e = achar(api.$("leiPreGrupo_" + g), (c) => c.id === "leiPreCont_" + g)[0]; return e ? e.textContent : "(ausente)"; };
  {
    ok(lig("cabecalho", "Todos") === "true" && lig("cabecalho", "Nenhum") === "false" && cls(botao("cabecalho", "Todos"), "lei-pre-on") && cont("cabecalho") === nCab + " de " + nCab + " aceitas",
      "E0 ao abrir tudo esta aceito: 'aceitar todos' LIGADO, 'recusar todos' desligado, contador: " + [lig("cabecalho", "Todos"), lig("cabecalho", "Nenhum"), cont("cabecalho")]);
  }
  {
    ok(nCab >= 1, "R0a (ha cabecalho repetido na colagem de teste)");
    botao("cabecalho", "Nenhum").onclick();
    ok(!aviso().hidden && /recusada/.test(aviso().textContent) && aviso().textContent.indexOf("alteradas agora: " + nCab + ".") > 0 && /como veio/.test(aviso().textContent),
      "R1 'recusar todos': a frase diz o que aconteceu e quantos mudaram: " + aviso().textContent);
    ok(lig("cabecalho", "Nenhum") === "true" && cls(botao("cabecalho", "Nenhum"), "lei-pre-nao") && lig("cabecalho", "Todos") === "false" && !cls(botao("cabecalho", "Todos"), "lei-pre-on"),
      "R2 depois de 'recusar todos': ELE fica ligado (e o outro desligado) — o botao NOVO, depois de a tela se repintar");
    ok(cont("cabecalho") === "0 de " + nCab + " aceitas", "R2a e o contador do grupo acompanha: " + cont("cabecalho"));
    botao("cabecalho", "Nenhum").onclick();
    ok(/já estava tudo recusado — nada mudou/.test(aviso().textContent), "R3 apertar de novo diz que NADA mudou (nao parece morto): " + aviso().textContent);
    botao("cabecalho", "Todos").onclick();
    ok(/aceita/.test(aviso().textContent) && aviso().textContent.indexOf("alteradas agora: " + nCab + ".") > 0 && /Serão aplicadas/.test(aviso().textContent), "R4 'aceitar todos' depois de recusar: mudaram todos: " + aviso().textContent);
    botao("cabecalho", "Todos").onclick();
    ok(/já estava tudo aceito — nada mudou/.test(aviso().textContent), "R5 aceitar quando ja esta tudo aceito: 'nada mudou': " + aviso().textContent);
    ok(lig("cabecalho", "Todos") === "true" && lig("cabecalho", "Nenhum") === "false", "R5a mesmo quando nada muda, o botao mostra que esta ligado");
    api.soltarAdiados();
    ok(aviso().hidden === true, "R6 passado o tempo, a frase some");
    ok(lig("cabecalho", "Todos") === "true" && cls(botao("cabecalho", "Todos"), "lei-pre-on") && lig("cabecalho", "Nenhum") === "false",
      "R6a mas o botao NAO volta ao normal com o tempo: continua ligado enquanto o grupo estiver todo aceito");
    api.segurarAdiados();
  }
  {
    ok(itens("grafia").length === 2, "G0 (a colagem de teste tem 2 itens de grafia): " + itens("grafia").length);
    /* a contagem de "alteradas agora" e' a dos que MUDARAM, nao a do grupo */
    achar(itens("grafia")[0], (c) => c.type === "checkbox")[0].checked = false;
    achar(itens("grafia")[0], (c) => c.type === "checkbox")[0].onchange();
    botao("grafia", "Todos").onclick();
    ok(/2 sugestão\(ões\) aceita\(s\); alteradas agora: 1\./.test(aviso().textContent), "G1 'aceitar todos' com um item ja aceito: 2 no grupo, 1 mudou: " + aviso().textContent);
    const it = itens("grafia")[0];
    const cb = achar(it, (c) => c.type === "checkbox")[0];
    cb.checked = false; cb.onchange();
    ok(/fica como veio/.test(aviso().textContent) && /linha \d+/.test(aviso().textContent), "R7 desmarcar UM item: diz que fica como veio e qual linha: " + aviso().textContent);
    ok(lig("grafia", "Todos") === "false" && lig("grafia", "Nenhum") === "false" && cont("grafia") === "1 de 2 aceitas",
      "E1 grupo MISTO (1 de 2): nenhum dos dois botoes fica ligado, e o contador diz quantas: " + [lig("grafia", "Todos"), lig("grafia", "Nenhum"), cont("grafia")]);
    const cb2 = achar(itens("grafia")[0], (c) => c.type === "checkbox")[0];
    cb2.checked = true; cb2.onchange();
    ok(/será aplicada ao gravar/.test(aviso().textContent), "R8 marcar de volta: diz que sera aplicada: " + aviso().textContent);
    ok(lig("grafia", "Todos") === "true" && cont("grafia") === "2 de 2 aceitas", "E2 marcar o ultimo item liga 'aceitar todos' sozinho: " + [lig("grafia", "Todos"), cont("grafia")]);
    achar(itens("grafia")[0], (c) => c.type === "checkbox")[0].checked = false;
    achar(itens("grafia")[0], (c) => c.type === "checkbox")[0].onchange();
    achar(itens("grafia")[1], (c) => c.type === "checkbox")[0].checked = false;
    achar(itens("grafia")[1], (c) => c.type === "checkbox")[0].onchange();
    ok(lig("grafia", "Nenhum") === "true" && lig("grafia", "Todos") === "false" && cont("grafia") === "0 de 2 aceitas", "E3 desmarcar o ultimo item liga 'recusar todos' sozinho: " + [lig("grafia", "Nenhum"), cont("grafia")]);
    botao("grafia", "Todos").onclick();
  }
  {
    const anexo = () => achar(itens("anexo")[0], (c) => c.type === "radio");
    anexo().filter((r) => r.value === "descartar")[0].onchange();
    ok(/ANEXO I — TABELA DE ALÍQUOTAS POR PRODUTO: será descartado — não entra na lei/.test(aviso().textContent), "R9 anexo descartado: a frase diz o destino e o que sobra: " + aviso().textContent);
    anexo().filter((r) => r.value === "manter")[0].onchange();
    ok(/fica dentro do último artigo/.test(aviso().textContent), "R10 anexo mantido: " + aviso().textContent);
    anexo().filter((r) => r.value === "separar")[0].onchange();
    ok(/guardado como Anexo à parte/.test(aviso().textContent), "R11 anexo separado: " + aviso().textContent);
  }

  /* ---- 4: fechar a revisao tambem diz o resultado ---- */
  {
    const aceitas = pre.mudancas.length;
    api.leiPreConfirmar();
    ok(confirmou && aviso().hidden === true, "F1 confirmar segue adiante e limpa a frase");
    ok(/^Revisão confirmada: \d+ sugestão\(ões\) aplicada\(s\), 1 anexo\(s\) separado\(s\)\.$/.test(toastTxt()), "F2 confirmar mostra o que foi aplicado (aviso acima da janela que fechou): " + toastTxt());
    abrir();
    ok(aviso().hidden === true, "F3 reabrir a revisao nao traz a frase da vez anterior");
    botao("cabecalho", "Nenhum").onclick();
    ok(aviso().hidden === false, "F3a (ha frase)");
    abrir();
    ok(aviso().hidden === true, "F3b reabrir com a frase ainda na tela (sem fechar antes) tambem a limpa");
    botao("cabecalho", "Nenhum").onclick();
    api.leiPreOriginal();
    ok(confirmou && /texto original: nenhuma limpeza foi aplicada/.test(toastTxt()) && aviso().hidden === true, "F4 seguir com o original avisa que nada foi limpo: " + toastTxt());
    abrir();
    botao("cabecalho", "Nenhum").onclick();
    api.leiPreCancelar();
    ok(!confirmou && /Nada foi gravado/.test(toastTxt()) && aviso().hidden === true, "F5 voltar avisa que nada foi gravado: " + toastTxt());
  }
  api.soltarAdiados();

  /* ---- 5: as frases existem nos dois idiomas, com os mesmos campos ---- */
  {
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const chaves = ["lei_pre_av_todos", "lei_pre_av_todos_ja", "lei_pre_av_nenhum", "lei_pre_av_nenhum_ja", "lei_pre_av_sim", "lei_pre_av_nao",
      "lei_pre_av_anx_separar", "lei_pre_av_anx_manter", "lei_pre_av_anx_descartar", "lei_pre_t_confirmado", "lei_pre_t_original", "lei_pre_t_voltar", "aj_fez_manter", "aj_fez_usar"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2), "I1 cada frase existe em portugues e em ingles: " + chaves.filter((k) => linhas(k).length !== 2));
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I2 pt e en usam os mesmos campos {n}/{g}/...: " + chaves.filter((k) => linhas(k).length === 2 && campos(linhas(k)[0]) !== campos(linhas(k)[1])));
  }

  /* ---- 6: numero de item de tabela de anexo nao e' numero de pagina ---- */
  {
    const seq = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const corpo = ["Art. 1º Texto um.", "Art. 2º Texto dois."];
    const fora = corpo.concat(["Página 3", "Art. 3º Texto tres."], seq).join("\n");
    const dentro = corpo.concat(["ANEXO I", "TABELA DE ITENS"], seq, ["Página 3"]).join("\n");
    const pag = (t) => api.leiPreprocessar(t).mudancas.filter((m) => m.grupo === "pagina");
    ok(pag(fora).length === 1 && pag(fora)[0].ocorrencias >= 8, "N1 (controle) fora de anexo, a sequencia 1..8 e' tomada por numero de pagina: " + JSON.stringify(pag(fora).map((m) => m.ocorrencias)));
    ok(pag(dentro).length === 0, "N2 dentro de um anexo, a mesma sequencia (e um 'Pagina 3' claro) fica: " + JSON.stringify(pag(dentro).map((m) => m.ocorrencias)));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
