/* =====================================================================
 * MATERIAL DE ESTUDO
 * O terceiro modo deixa de ser esqueleto. Ele guarda o CONTEÚDO de cada
 * tópico do edital, indexado pela MESMA chave do progresso — sem tabela de
 * ligação, sem id novo: se a chave serve para dizer "estudei isto", serve
 * para dizer "e o que eu estudei foi isto aqui".
 *
 * O ciclo que isso fecha:
 *   edital decide o assunto → material guarda o conteúdo → cartões fixam
 * ===================================================================== */

let matResumos = {};
let matAtual = null;      /* chave em edição */

function matCarregar() {
  try { matResumos = JSON.parse(localStorage.getItem("eac_resumos") || "{}"); }
  catch (e) { matResumos = {}; }
  if (!matResumos || typeof matResumos !== "object") matResumos = {};
}

/* Carrega AGORA, no carregamento do arquivo, e não só no matIniciar(): a
 * agenda do edital é desenhada pelo edIniciar(), que roda antes — e desenhava
 * com a lista vazia, deixando todos os indicadores apagados mesmo havendo
 * material. Estado que outra tela consulta precisa existir desde o começo. */
try { matCarregar(); } catch (e) {}

function matSalvar() {
  try { guardar("eac_resumos", JSON.stringify(matResumos)); }
  catch (e) {}
}

function matChave(disciplina, topico) {
  return (disciplina + "›" + topico).toLowerCase();
}

/* CONSERTO DE CHAVES ÓRFÃS.
 * Até a v8.78 os cartões salvos pelo fluxo "Salvar no material" iam para
 * uma chave normalizada de outro jeito (sem acento, sem pontuação). Eram
 * gavetas invisíveis: o editor e a agenda procuram pela chave de matChave.
 * Como cada registro guarda disciplina e tópico, dá para recalcular a chave
 * certa e juntar o conteúdo — sem perder nada dos dois lados. */
function matRepararChaves() {
  let movidos = 0, juntados = 0;
  Object.keys(matResumos).forEach((k) => {
    const r = matResumos[k];
    if (!r || !r.disciplina || !r.topico) return;
    const certa = matChave(r.disciplina, r.topico);
    if (certa === k) return;
    const destino = matResumos[certa];
    if (!destino) {
      matResumos[certa] = r;
      movidos++;
    } else {
      /* junta sem sobrescrever: texto do destino manda, cartões somam */
      destino.texto = destino.texto || r.texto || "";
      const a = String(destino.cartoes || "").trim();
      const b = String(r.cartoes || "").trim();
      if (b) {
        const jaTem = new Set(a.split("\n").map((l) => l.split("::")[0].trim().toLowerCase()));
        const novas = b.split("\n").filter((l) =>
          l.trim() && !jaTem.has(l.split("::")[0].trim().toLowerCase()));
        destino.cartoes = (a ? a + "\n" : "") + novas.join("\n");
      }
      juntados++;
    }
    delete matResumos[k];
  });
  if (movidos || juntados) {
    matSalvar();
    try {
      reg("MATERIAL", "chaves órfãs consertadas",
          movidos + " movidas, " + juntados + " juntadas a um tópico existente");
    } catch (e) {}
  }
  return { movidos, juntados };
}

function matTem(chave) {
  const r = matResumos[chave];
  return !!(r && (String(r.texto || "").trim() || String(r.cartoes || "").trim()));
}

function matObter(chave) { return matResumos[chave] || null; }

function matGravar(chave, texto, meta) {
  const limpo = String(texto || "").trim();
  const antigo = matResumos[chave] || {};
  /* APAGAR SÓ QUANDO NÃO SOBRA NADA.
   * Texto vazio apagava o registro inteiro — e com ele os CARTÕES, que
   * moram no mesmo registro e não têm nada a ver com o texto do resumo. */
  if (!limpo) {
    if (!String(antigo.cartoes || "").trim()) {
      delete matResumos[chave]; matSalvar(); return null;
    }
    matResumos[chave] = Object.assign({}, antigo, { texto: "",
      tocado: new Date().toISOString() });
    matSalvar();
    return matResumos[chave];
  }
  /* Object.assign SOBRE O ANTIGO, não um objeto novo.
   * Esta função montava um registro do zero com seis campos — e jogava fora
   * todos os outros: "cartoes", "leiSeca", "marcador", "cartoesInfo".
   * Resultado: gravar o resumo APAGAVA os cartões do tópico. Abrir o painel
   * de cartões grava o texto antes, então o próprio ato de ir ver os
   * cartões destruía os cartões. Foi por isso que eles "não apareciam em
   * lugar nenhum": eram apagados no caminho. */
  matResumos[chave] = Object.assign({}, antigo, {
    texto: limpo,
    disciplina: (meta && meta.disciplina) || antigo.disciplina || "",
    topico: (meta && meta.topico) || antigo.topico || "",
    /* de qual concurso este material nasceu. Um resumo de Direito Financeiro
     * escrito para o TCE-PE serve para o TCU — mas só dá para dizer isso
     * depois se a origem tiver sido gravada na hora. */
    concurso: (meta && meta.concurso) || antigo.concurso
      || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    criado: antigo.criado || new Date().toISOString(),
    tocado: new Date().toISOString(),
  });
  matSalvar();
  return matResumos[chave];
}

/* Estatísticas para o cabeçalho do modo e para o backup. */
/* Os cartões gerados a partir do tópico ficam guardados JUNTO do resumo: o
 * material de um assunto é o texto mais as perguntas que ele gerou. Campo
 * próprio, não emendado no texto, para poder voltar à bancada intacto. */
function matGravarCartoes(chave, texto, meta) {
  const limpo = String(texto || "").trim();
  const antigo = matResumos[chave] || {};
  matResumos[chave] = Object.assign({}, antigo, {
    texto: antigo.texto || "",
    cartoes: limpo,
    disciplina: (meta && meta.disciplina) || antigo.disciplina || "",
    topico: (meta && meta.topico) || antigo.topico || "",
    concurso: (meta && meta.concurso) || antigo.concurso
      || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    criado: antigo.criado || new Date().toISOString(),
    tocado: new Date().toISOString(),
  });
  matSalvar();
  return matResumos[chave];
}

function matContarCartoes(chave) {
  const r = matResumos[chave];
  if (!r || !r.cartoes) return 0;
  return (r.cartoes.match(/^[^\n#@+].*::/gm) || []).length;
}

/* Quanto do que está guardado NÃO é cartão. Enquanto a gravação vinha com o
 * prompt junto, um tópico tinha 155 linhas e 17 cartões — e nada na tela
 * dizia isso. */
function matLixoNosCartoes(chave) {
  const r = matResumos[chave];
  if (!r || !r.cartoes) return { total: 0, cartoes: 0, lixo: 0 };
  const linhas = String(r.cartoes).split("\n").filter((l) => l.trim());
  const cartoes = matContarCartoes(chave);
  return { total: linhas.length, cartoes, lixo: linhas.length - cartoes };
}

/* Tira do campo de cartões tudo que não for cartão. Não apaga em silêncio:
 * quem chama mostra o número antes. */
function matLimparLixoCartoes(chave) {
  const r = matResumos[chave];
  if (!r || !r.cartoes) return 0;
  const antes = String(r.cartoes).split("\n").filter((l) => l.trim());
  const so = antes.filter((l) => /^[^\n#@+].*::/.test(l));
  const tirados = antes.length - so.length;
  if (!tirados) return 0;
  r.cartoes = so.join("\n");
  matSalvar();
  matReg("cartoes", "limpeza do campo de cartões",
         tirados + " linha(s) que não eram cartão foram retiradas de " + (r.topico || chave));
  return tirados;
}

function matResumo() {
  const ks = Object.keys(matResumos);
  const chars = ks.reduce((a, k) => a + String(matResumos[k].texto || "").length, 0);
  const discs = new Set(ks.map((k) => (matResumos[k].disciplina || "").trim()).filter(Boolean));
  const ccs = new Set(ks.map((k) => (matResumos[k].concurso || "").trim()).filter(Boolean));
  const cartoes = ks.reduce((a, k) => a + matContarCartoes(k), 0);
  return { total: ks.length, caracteres: chars, disciplinas: discs.size,
           concursos: ccs.size, cartoes };
}

/* Lista para a aba, agrupada por disciplina e ordenada pelo que foi mexido
 * por último — quem abre o Material quer continuar de onde parou. */
function matLista() {
  return Object.keys(matResumos).map((k) => Object.assign({ chave: k }, matResumos[k]))
    .sort((a, b) => String(b.tocado || "").localeCompare(String(a.tocado || "")));
}

/* ------------------------------------------------------------------
 * MARCAÇÃO LEVE
 * O texto guardado continua sendo TEXTO — nada de HTML no armazenamento.
 * A formatação são quatro marcas que a pessoa já conhece de qualquer editor,
 * e a conversão para HTML acontece só na hora de ler. Guardar HTML seria
 * amarrar o material ao navegador de hoje e abrir porta para o que for
 * colado de fora.
 * ------------------------------------------------------------------ */
function matEscapar(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------
 * COLAGEM DE FORA (NotebookLM, Gemini, ChatGPT)
 *
 * O que vem de lá é markdown com hábitos próprios: três e quatro níveis de
 * título, bolinhas em vez de hífen, itálico com asterisco simples, e — a
 * marca registrada do NotebookLM — referências numeradas [1] [2, 3] no meio
 * das frases, que só fazem sentido dentro dele.
 *
 * Converter na colagem, e não na hora de exibir, é deliberado: o material
 * fica guardado no formato do app, legível e editável, em vez de carregar
 * para sempre a sintaxe de quem o gerou.
 * ------------------------------------------------------------------ */
/* O texto copiado de uma PÁGINA não traz marcação: "readText" devolve o que
 * está renderizado, sem os "**" e "##" que só existem no markdown de origem.
 * A formatação viaja na área de transferência como text/html — é de lá que
 * ela tem de ser lida, senão o resumo chega achatado. */
function matHtmlParaMarcas(html) {
  const doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = String(html || "");
  const saida = [];

  const inline = (no) => {
    let s = "";
    no.childNodes.forEach((f) => {
      if (f.nodeType === 3) { s += f.nodeValue.replace(/\s+/g, " "); return; }
      if (f.nodeType !== 1) return;
      const tag = f.tagName.toLowerCase();
      const dentro = inline(f);
      if (!dentro.trim()) { s += dentro; return; }
      if (tag === "b" || tag === "strong") s += "**" + dentro.trim() + "**";
      else if (tag === "i" || tag === "em") s += "_" + dentro.trim() + "_";
      else if (tag === "mark") s += "==" + dentro.trim() + "==";
      else if (tag === "br") s += "\n";
      else if (tag === "code") s += dentro;
      else s += dentro;
    });
    return s;
  };

  const anda = (no) => {
    no.childNodes.forEach((f) => {
      if (f.nodeType === 3) {
        const t2 = f.nodeValue.trim();
        if (t2) saida.push(t2);
        return;
      }
      if (f.nodeType !== 1) return;
      const tag = f.tagName.toLowerCase();
      if (/^h[1-2]$/.test(tag)) { saida.push("# " + inline(f).trim()); return; }
      if (/^h[3-6]$/.test(tag)) { saida.push("## " + inline(f).trim()); return; }
      if (tag === "li") {
        const pai = f.parentNode && f.parentNode.tagName;
        const ord = pai && pai.toLowerCase() === "ol";
        const n = ord ? ([].indexOf.call(f.parentNode.children, f) + 1) + ". " : "- ";
        saida.push(n + inline(f).trim());
        return;
      }
      if (tag === "tr") {
        const celulas = [].map.call(f.children, (c) => inline(c).trim()).filter(Boolean);
        if (celulas.length) saida.push("- " + celulas.join(" — "));
        return;
      }
      if (tag === "p" || tag === "div" || tag === "blockquote") {
        /* só emite o parágrafo quando ele não contém blocos dentro, senão o
         * texto sairia duplicado — uma vez pelo pai e outra pelos filhos */
        if (!f.querySelector("p,div,li,tr,h1,h2,h3,h4,h5,h6,ul,ol,table")) {
          const t3 = inline(f).trim();
          if (t3) saida.push(t3);
          return;
        }
      }
      if (tag === "hr") { saida.push("---"); return; }
      if (tag === "script" || tag === "style") return;
      anda(f);
    });
  };

  anda(doc.body);
  return saida.join("\n\n");
}

function matLimparColagem(txt) {
  let s = String(txt || "").replace(/\r\n?/g, "\n");
  /* referências do NotebookLM: [1], [2, 3], [1-4] — fora do começo da linha,
   * para não comer uma lista escrita como "[1] Conceito" */
  s = s.replace(/(\S)\s*\[\d+(?:\s*[,\-–]\s*\d+)*\]/g, "$1");
  /* títulos de qualquer profundidade viram os dois níveis que o app tem */
  s = s.replace(/^\s*#{3,}\s+/gm, "## ");
  s = s.replace(/^\s*#\s+/gm, "# ");
  /* bolinhas e travessões de lista */
  s = s.replace(/^\s*[•‣▪◦·–—]\s+/gm, "- ");
  s = s.replace(/^\s*\*\s+/gm, "- ");
  /* itálico com asterisco simples vira o sublinhado do app, sem tocar no
     negrito: o passo anterior já removeu os "* " de lista */
  s = s.replace(/(^|[^*])\*([^*\n]{1,200})\*(?!\*)/g, "$1_$2_");
  /* negrito com sublinhado duplo (hábito de alguns modelos) */
  s = s.replace(/__([^_\n]{1,200})__/g, "**$1**");
  /* tabelas simples viram linhas legíveis, em vez de canos soltos */
  s = s.replace(/^\s*\|(.+)\|\s*$/gm, (l, meio) => {
    if (/^[\s|:-]+$/.test(meio)) return "";      /* linha separadora */
    return "- " + meio.split("|").map((c) => c.trim()).filter(Boolean).join(" — ");
  });
  s = s.replace(/[ \t]+$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/* Insere a régua do marcador na posição guardada, no fim da linha em que
 * ela cai — cortar a linha ao meio embaralharia o texto. */
function matComMarcador(txt) {
  const r = matAtual && matResumos[matAtual.chave];
  if (!r || !r.marcador) return txt;
  const pos = Math.min(r.marcador, txt.length);
  const quebra = txt.indexOf("\n", pos);
  const corte = quebra < 0 ? txt.length : quebra;
  return txt.slice(0, corte) + "\n\u0001MARCADOR\u0001\n" + txt.slice(corte);
}

function matParaHtml(txt) {
  const linhas = matEscapar(matComMarcador(txt)).split(/\r?\n/);
  const saida = [];
  let emLista = false;
  const inline = (s) => s
    .replace(/\*\*([^*\n]{1,200})\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])_([^_\n]{1,200})_(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>")
    /* O miolo aceita QUALQUER tamanho e aceita "=" solto — só não aceita
     * "==", que é o fecho. Antes o limite era 300 caracteres e o miolo
     * proibia "=": um trecho grande marcado aparecia com os "==" literais
     * na tela, como se a marca não tivesse pegado. */
    .replace(/==!((?:[^=\n]|=(?!=))+)==/g, '<mark class="m-imp">$1</mark>')
    .replace(/==\?((?:[^=\n]|=(?!=))+)==/g, '<mark class="m-duv">$1</mark>')
    .replace(/==§((?:[^=\n]|=(?!=))+)==/g, '<mark class="m-lei">$1</mark>')
    .replace(/==\*(?!\*)((?:[^=\n]|=(?!=))+)==/g, '<mark class="m-prova">$1</mark>')
    .replace(/==~((?:[^=\n]|=(?!=))+)==/g, '<mark class="m-peg">$1</mark>')
    .replace(/==((?:[^=\n]|=(?!=))+)==/g, "<mark>$1</mark>");
  linhas.forEach((l) => {
    const s = l.trim();
    const fecharLista = () => { if (emLista) { saida.push("</ul>"); emLista = false; } };
    /* Títulos de 1 a 6 "#". Antes só "#" e "##" eram reconhecidos, e os
     * resumos do NotebookLM usam "###" e "####" o tempo todo — eles
     * apareciam LITERAIS na leitura, com os quatro jogos da velha na tela.
     * Do terceiro nível em diante todos viram h4: mais que dois tamanhos
     * de título num resumo não ajuda ninguém a ler. */
    const tit = s.match(/^(#{1,6})\s+/);
    if (tit) {
      fecharLista();
      const nivel = tit[1].length === 1 ? "h3" : "h4";
      saida.push("<" + nivel + ">" + inline(s.slice(tit[0].length)) + "</" + nivel + ">");
      return;
    }
    if (/^[-*]\s+/.test(s)) {
      if (!emLista) { saida.push("<ul>"); emLista = true; }
      saida.push("<li>" + inline(s.replace(/^[-*]\s+/, "")) + "</li>");
      return;
    }
    /* lista numerada: chega em toda colagem de fora e virava parágrafo solto,
     * perdendo a ordem — que num resumo de etapas é a informação principal */
    if (/^\d+[.)]\s+/.test(s)) {
      fecharLista();
      saida.push("<div class='mat-num'><b>" + s.match(/^\d+/)[0] + ".</b> "
        + inline(s.replace(/^\d+[.)]\s+/, "")) + "</div>");
      return;
    }
    if (s === "\u0001MARCADOR\u0001") {
      fecharLista();
      saida.push('<div class="mat-marcador" data-rot="' + matEscapar(t("mat_marcador_rot")) + '"></div>');
      return;
    }
    /* "> " é DICA: acréscimo seu ao material, com marca visível. */
    /* o texto já passou por matEscapar, então ">" chega como "&gt;" —
     * testar o caractere cru aqui nunca casaria */
    if (/^&gt;\s?/.test(s)) {
      fecharLista();
      saida.push('<div class="mat-dica">' + inline(s.replace(/^&gt;\s?/, "")) + "</div>");
      return;
    }
    if (/^-{3,}$/.test(s)) { fecharLista(); saida.push("<hr>"); return; }
    if (!s) { fecharLista(); return; }
    fecharLista();
    saida.push("<p>" + inline(s) + "</p>");
  });
  if (emLista) saida.push("</ul>");
  return saida.join("\n");
}

/* Aplica a marca em volta da seleção. Se nada estiver selecionado, insere as
 * marcas e deixa o cursor no meio — quem clicou em "negrito" quer digitar em
 * negrito, não receber "****" e ter de se virar. */
function matEnvolver(ini, fim) {
  const ta = $("matTexto");
  const a = ta.selectionStart || 0, b = ta.selectionEnd || 0;
  const sel = ta.value.slice(a, b);
  ta.value = ta.value.slice(0, a) + ini + sel + (fim === undefined ? ini : fim)
    + ta.value.slice(b);
  const pos = a + ini.length + sel.length;
  ta.focus();
  ta.setSelectionRange(sel ? pos + (fim === undefined ? ini : fim).length : pos, 
                       sel ? pos + (fim === undefined ? ini : fim).length : pos);
}

function matPrefixo(marca) {
  const ta = $("matTexto");
  const a = ta.selectionStart || 0;
  const ini = ta.value.lastIndexOf("\n", a - 1) + 1;
  ta.value = ta.value.slice(0, ini) + marca + ta.value.slice(ini);
  ta.focus();
  ta.setSelectionRange(a + marca.length, a + marca.length);
}

/* =====================================================================
 * A TELA
 * ===================================================================== */

let matModo = "editar";       /* editar | ler */
let matFonte = 15;            /* px do modo leitura */
let matAmpliado = false;

function matAbrirEditor(item, comoLer) {
  /* abre limpo: rascunho pendente é do material anterior */
  matSujo = false;
  matSelGuardada = "";
  matAtual = { chave: matChave(item.disciplina, item.nome),
               disciplina: item.disciplina, topico: item.nome };
  const r = matObter(matAtual.chave);
  $("matTitulo").textContent = item.nome;
  $("matSub").textContent = item.disciplina
    + (r ? " · " + t("mat_tocado", { d: new Date(r.tocado).toLocaleDateString() })
         : " · " + t("mat_novo"))
    + (r && r.concurso ? " · " + r.concurso : "");
  $("matTexto").value = (r && r.texto) || "";
  try {
    matFonte = Number(localStorage.getItem("eac_mat_fonte")) || 15;
    matAmpliado = localStorage.getItem("eac_mat_amplo") === "1";
  } catch (e) {}
  /* material que já existe abre para LER; material novo abre para escrever.
   * Quem clica num tópico que já tem resumo quer relê-lo, não editá-lo. */
  matTrocarModo(comoLer || (r ? "ler" : "editar"));
  abrirModal("dlgMaterial");
  if (matModo === "editar") $("matTexto").focus();
}

function matTrocarModo(modo) {
  matModo = modo;
  const lendo = modo === "ler";
  $("matTexto").hidden = lendo;
  $("matBarra").hidden = lendo;
  $("matLeitura").hidden = !lendo;
  $("matCtrlLeitura").hidden = !lendo;
  if ($("btnMatSalvar")) $("btnMatSalvar").hidden = false;   /* serve nos dois modos */
  $("btnMatLerReg").hidden = !lendo;
  $("btnMatModo").textContent = t(lendo ? "mat_modo_editar" : "mat_modo_ler");
  /* o mesmo comando no topo: com resumo grande, ir até o rodapé para
   * alternar entre ler e editar é o gesto mais repetido da tela */
  if ($("btnMatModoTopo"))
    $("btnMatModoTopo").textContent = t(lendo ? "mat_modo_editar" : "mat_modo_ler");
  matPintarMarcador();
  matPintarLei();
  matPintarDuvidas();
  matPintarConserto();
  $("dlgMaterial").classList.toggle("mat-amplo", matAmpliado);
  if (lendo) {
    $("matLeitura").innerHTML = matParaHtml($("matTexto").value)
      || "<p class='nota'>" + t("mat_vazio_leitura") + "</p>";
    $("matLeitura").style.fontSize = matFonte + "px";
  }
}

function matFonteMudar(d) {
  matFonte = Math.max(12, Math.min(28, matFonte + d));
  $("matLeitura").style.fontSize = matFonte + "px";
  $("matFonteVal").textContent = matFonte + "px";
  try { localStorage.setItem("eac_mat_fonte", String(matFonte)); } catch (e) {}
}

function matAmpliar() {
  matAmpliado = !matAmpliado;
  $("dlgMaterial").classList.toggle("mat-amplo", matAmpliado);
  $("btnMatAmpliar").textContent = t(matAmpliado ? "mat_reduzir" : "mat_ampliar");
  try { localStorage.setItem("eac_mat_amplo", matAmpliado ? "1" : "0"); } catch (e) {}
}

/* Ler é estudar. Registrar a leitura fecha o buraco entre "tenho o material"
 * e "usei o material" — sem isto o resumo vira um arquivo morto que ninguém
 * sabe se foi aberto. O tempo sugerido vem do tamanho do texto: cerca de 200
 * palavras por minuto, com piso de 5 minutos. */
/* ------------------------------------------------------------------
 * MARCA-TEXTO NA LEITURA
 *
 * Marcar não é editar: quem está lendo quer grifar e seguir lendo, não
 * entrar num editor e procurar a frase. A marca é gravada NO TEXTO, como
 * "==assim==" — então ela sobrevive ao backup, à exportação e a qualquer
 * versão futura do app, em vez de virar uma tabela de posições que quebra
 * assim que alguém mexe numa vírgula.
 *
 * Limite honesto: a marcação encontra a PRIMEIRA ocorrência ainda não
 * marcada do trecho selecionado. Selecionando uma palavra que se repete,
 * pode grifar a ocorrência errada — por isso o botão exige uma seleção
 * de pelo menos três caracteres, e frases funcionam melhor que palavras.
 * ------------------------------------------------------------------ */
/* Seis cores. Os sufixos são de um caractere só e nenhum deles pode ser
 * "=", senão o fecho "==" fica ambíguo. */
/* O SUFIXO DE COR NÃO PODE COMER O NEGRITO.
 * "==**Ato Complexo:**" tinha o primeiro "*" lido como sufixo da cor
 * "prova": tirar a marca levava um asterisco junto e o negrito ficava
 * aberto — "*Ato Complexo:**". O "*" só é sufixo quando NÃO for seguido de
 * outro "*", porque "**" é negrito. Uma constante só, para os quatro
 * lugares que precisam disso nunca divergirem. */
const MAT_SUF = "(?:[!?\u00a7~]|\\*(?!\\*))?";

const MAT_MARCAS = { destaque: "==", importante: "==!", duvida: "==?",
                     lei: "==§", prova: "==*", pegadinha: "==~" };

/* A SELEÇÃO MORRE ANTES DO CLIQUE.
 * Apertar o botão dispara mousedown ANTES de click, e o mousedown já move o
 * foco e recolhe a seleção — quando o onclick roda, getSelection() devolve
 * vazio. Era isto que fazia o app responder "selecione pelo menos três
 * caracteres" para quem tinha selecionado uma frase inteira: a mensagem
 * estava certa sobre o que via, e o que via já era o estrago do clique.
 *
 * Dois cuidados, e os dois são necessários:
 *  - guardar a última seleção válida feita DENTRO do painel de leitura;
 *  - preventDefault no mousedown dos botões, para o navegador não recolher
 *    a seleção nem tirar o foco do texto. */
let matSelGuardada = "";
let matSujo = false;      /* há marcação feita e ainda não salva */

/* Onde, dentro da leitura, a seleção começou — em caracteres do texto
 * visível. É o que permite saber de QUAL "transparência" você falou quando
 * a palavra aparece mais de uma vez. */
let matSelOffset = -1;
let matSelTotal = 0;

function matGuardarOffset(sel) {
  matSelOffset = -1; matSelTotal = 0;
  try {
    const painel = $("matLeitura");
    if (!painel || !sel || !sel.anchorNode) return;
    matSelTotal = String(painel.textContent || "").length;
    let antes = 0, achou = false;
    const anda = (no) => {
      if (achou || !no) return;
      if (no === sel.anchorNode) { antes += sel.anchorOffset || 0; achou = true; return; }
      if (!no.childNodes || !no.childNodes.length) {
        antes += String(no.textContent || "").length; return;
      }
      Array.from(no.childNodes).forEach(anda);
    };
    anda(painel);
    if (achou) matSelOffset = antes;
  } catch (e) { matSelOffset = -1; }
}

function matLembrarSelecao() {
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const painel = $("matLeitura");
  if (painel && sel.anchorNode && painel.contains
      && !painel.contains(sel.anchorNode)) return;
  const txt = String(sel).trim();
  if (txt) { matSelGuardada = txt; matGuardarOffset(sel); }
}

/* O QUE SE VÊ NÃO É O QUE ESTÁ GUARDADO.
 * A leitura mostra "créditos suplementares"; o arquivo guarda
 * "**créditos suplementares**". Qualquer seleção que atravesse um marcador
 * simplesmente NÃO EXISTE no texto-fonte, e o indexOf falhava — o app então
 * respondia "não encontrei esse trecho, salve antes de marcar", culpando a
 * pessoa por um defeito dele. Grifar frase inteira, que é o uso normal,
 * quase sempre atravessa um negrito.
 *
 * A ponte é um mapa: percorre a fonte ignorando os marcadores e anotando,
 * para cada caractere visível, de onde ele veio. Assim a busca acontece no
 * texto que a pessoa realmente leu, e a marca é gravada na posição certa
 * do arquivo. */
function matMapear(src) {
  /* Este mapa PRECISA espelhar matParaHtml linha a linha. Na primeira
   * versão ele cuidava só de "**", "==" e "__" — e a leitura também remove
   * "## " de título, "- " e "* " de lista, o "_" de itálico, e apaga "---"
   * inteiro. Cada um desses era um jeito de a seleção não existir no
   * texto-fonte, com o app respondendo "não encontrei esse trecho". */
  const plano = [], mapa = [];
  let pos = 0;
  const empurra = (c, idx) => { plano.push(c); mapa.push(idx); };
  const espaco = (idx) => {
    if (plano.length && plano[plano.length - 1] !== " ") empurra(" ", idx);
  };

  String(src).split(/\r?\n/).forEach((linha) => {
    const ini = pos;
    pos += linha.length + 1;              /* +1 do \n */

    const s = linha.trim();
    const recuo = linha.length - linha.replace(/^\s+/, "").length;
    let i = ini + recuo;

    /* linha divisória some por inteiro da leitura */
    if (/^-{3,}$/.test(s)) { espaco(i); return; }
    if (!s) { espaco(i); return; }

    /* prefixos que a leitura consome */
    const pref = s.match(/^(#{1,6}\s+|[-*]\s+)/);
    let corpo = s;
    if (pref) { corpo = s.slice(pref[0].length); i += pref[0].length; }

    espaco(i);
    let k = 0;
    while (k < corpo.length) {
      const resto = corpo.slice(k);
      /* marcadores em linha, na MESMA ordem em que matParaHtml os consome */
      const mk = resto.match(/^(\*\*|==[!?]?|__)/);
      if (mk) { k += mk[0].length; i += mk[0].length; continue; }
      /* itálico com um "_" só: a leitura exige borda de palavra dos dois
       * lados, então aqui a regra é a mesma — senão "_" de nome_de_arquivo
       * seria comido e o mapa sairia torto */
      if (corpo[k] === "_"
          && (k === 0 || /[\s(]/.test(corpo[k - 1]))
          && /^_[^_\n]{1,200}_(?=[\s).,;:!?]|$)/.test(resto)) {
        k++; i++; continue;
      }
      if (corpo[k] === "_" && k > 0 && /[^\s]/.test(corpo[k - 1])
          && /^_(?=[\s).,;:!?]|$)/.test(resto)) { k++; i++; continue; }

      const c = corpo[k];
      if (/\s/.test(c)) { espaco(i); k++; i++; continue; }
      empurra(c, i); k++; i++;
    }
  });
  return { plano: plano.join(""), mapa };
}

/* A borda da marca não pode partir um negrito ao meio.
 * Selecionando "abertura de créditos suplementares" o recorte terminava
 * ANTES do "**" que fecha o negrito, e o texto virava
 * "==abertura de **créditos suplementares==" — negrito aberto e nunca
 * fechado, que estraga a leitura de todo o resto do resumo. Aqui a faixa
 * cresce até que os pares fiquem completos. */
/* Toda recusa de marcação entra no REGISTRO, com o trecho e o motivo.
 * Enquanto elas eram só um uiAlert, o defeito acontecia repetidas vezes na
 * tela do usuário e o log não tinha uma linha sobre isso — eu consertava no
 * escuro, e consertei errado uma vez por causa disso. */
/* TIRAR UMA MARCA SÓ.
 * Existia "limpar marcas", que apaga todas — e quem errou uma cor tinha de
 * refazer a leitura inteira. Aqui some só a marca que contém o trecho
 * selecionado (ou, sem seleção, a marca sob o cursor). */
function matTirarMarca() {
  matLembrarSelecao();
  const ta = $("matTexto");
  const txt = ta.value;
  const alvo = matNormalizar(matSelGuardada);

  /* todas as marcas do texto, com onde começam e terminam */
  const re = new RegExp("==" + MAT_SUF + "((?:[^=\\n]|=(?!=))+)==", "g");
  let achou = null, mm;
  while ((mm = re.exec(txt)) !== null) {
    const dentro = matNormalizar(mm[1]);
    if (alvo && (dentro.indexOf(alvo) >= 0 || alvo.indexOf(dentro) >= 0)) { achou = mm; break; }
    if (!alvo && ta.selectionStart >= mm.index
        && ta.selectionStart <= mm.index + mm[0].length) { achou = mm; break; }
  }
  if (!achou) { matRecusa("marca_nao_achou", matSelGuardada); return; }

  const abre = achou[0].match(new RegExp("^==" + MAT_SUF))[0];
  ta.value = txt.slice(0, achou.index) + achou[1]
    + txt.slice(achou.index + achou[0].length);
  matReg("marca", "marca retirada (" + abre + ")", achou[1].slice(0, 50));
  matSujo = true;
  matSelGuardada = "";
  matTrocarModo("ler");
  $("matEstado").textContent = t("mat_marcado_nao_salvo");
}

/* =====================================================================
 * REGISTRO PRÓPRIO DOS RESUMOS
 *
 * O registro geral do app mistura tudo — edital, cartões, backup — e para
 * achar por que uma marcação falhou era preciso garimpar. Aqui fica só o
 * que acontece dentro do resumo, com o tópico em cada linha e o trecho
 * exato que a pessoa tentou marcar. Foi o que faltou nas três vezes em que
 * consertei a marcação no escuro.
 * ===================================================================== */
const MAT_LOG_MAX = 400;
let matLog = [];

function matLogCarregar() {
  try { matLog = JSON.parse(localStorage.getItem("eac_mat_log") || "[]"); }
  catch (e) { matLog = []; }
  if (!Array.isArray(matLog)) matLog = [];
}

function matReg(tipo, oque, detalhe) {
  matLog.push({
    q: new Date().toISOString(),
    t: tipo,
    o: String(oque || ""),
    d: String(detalhe || "").slice(0, 200),
    top: (matAtual && matAtual.topico) || "",
    disc: (matAtual && matAtual.disciplina) || "",
    modo: typeof matModo === "string" ? matModo : "",
  });
  while (matLog.length > MAT_LOG_MAX) matLog.shift();
  try {
    if (typeof guardar === "function") guardar("eac_mat_log", JSON.stringify(matLog));
    else localStorage.setItem("eac_mat_log", JSON.stringify(matLog));
  } catch (e) {}
  /* continua indo para o registro geral também: quem procura por lá não
   * pode deixar de encontrar */
  try { reg("MATERIAL-" + tipo.toUpperCase(), oque, detalhe); } catch (e) {}
}

/* TODO BOTÃO DO RESUMO PASSA POR AQUI.
 * Enquanto cada botão chamava sua função direto, um erro dentro dela
 * morria no console do navegador — que ninguém abre — e o registro dos
 * resumos ficava mudo justamente no evento que interessa. Envolvendo os
 * handlers, qualquer falha vira uma linha com o NOME do botão. */
function matBotao(id, nome, acao) {
  const b = $(id);
  if (!b) return;
  b.onclick = function () {
    try {
      const r = acao.apply(this, arguments);
      /* promessa que falha também tem de contar */
      if (r && typeof r.catch === "function") {
        r.catch((e) => matReg("erro", "falha no botão " + nome,
          (e && e.message) || String(e)));
      }
      return r;
    } catch (e) {
      matReg("erro", "falha no botão " + nome, (e && e.message) || String(e));
      try { uiAlert(t("mat_erro_botao", { b: nome })); } catch (x) {}
    }
  };
}

function matLogTexto() {
  if (!matLog.length) return t("mat_log_vazio");
  const linhas = matLog.slice().reverse().map((x) => {
    const q = String(x.q || "").replace("T", " ").slice(0, 19);
    const onde = x.top ? " [" + (x.disc ? x.disc + " › " : "") + x.top + "]" : "";
    return q + "  " + String(x.t).toUpperCase().padEnd(10) + onde
      + "\n      " + x.o + (x.d ? "\n      " + x.d : "");
  });
  return t("mat_log_cab", { n: matLog.length }) + "\n\n" + linhas.join("\n\n");
}

/* Marca o material como "lei seca" — letra da lei, não comentário. É o que
 * permite, na hora de revisar, separar o que se lê para decorar do que se
 * lê para entender. */
function matAlternarLei() {
  if (!matAtual) return;
  const r = matResumos[matAtual.chave];
  if (!r) return;
  r.leiSeca = !r.leiSeca;
  matSalvar();
  matReg("tipo", (r.leiSeca ? "marcado" : "desmarcado") + " como lei seca", "");
  matPintarLei();
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
}

/* Quantas dúvidas ESTE resumo tem em aberto. Sem o número aqui, a pessoa
 * só descobre indo à lista geral — e marca de dúvida que ninguém revisita
 * é o mesmo que não ter marcado. */
function matPintarDuvidas() {
  const b = $("btnMatDuvidas");
  if (!b) return;
  const r = matAtual && matResumos[matAtual.chave];
  const conta = (s) => (String(s || "").match(/==\?((?:[^=\n]|=(?!=))+)==/g) || []).length;
  const n = r ? conta(r.texto) + conta(r.leiTexto) : 0;
  b.hidden = !n;
  if (n) b.textContent = t("mat_duv_conta", { n });
}

function matPintarConserto() {
  const b = $("btnMatConsertar");
  if (!b) return;
  const q = matAtual ? matNegritoQuebrado(matAtual.chave) : [];
  b.hidden = !q.length;
  if (q.length) b.textContent = t("mat_consertar_btn", { n: q.length });
}

async function matConsertarAbrir() {
  if (!matAtual) return;
  const q = matNegritoQuebrado(matAtual.chave);
  if (!q.length) { uiAlert(t("mat_consertar_nada")); return; }
  const amostra = q.slice(0, 4).map((x) => "· " + x.txt.slice(0, 90)).join("\n");
  if (!(await uiConfirm(t("mat_consertar_conf", { n: q.length, a: amostra })))) return;
  const n = matConsertarNegrito(matAtual.chave);
  $("matTexto").value = String((matResumos[matAtual.chave] || {}).texto || "");
  matTrocarModo(matModo);
  matPintarConserto();
  await uiAlert(t("mat_consertado", { n }));
}

function matPintarLei() {
  const b = $("btnMatLei");
  if (!b) return;
  const r = matAtual && matResumos[matAtual.chave];
  const on = !!(r && (String(r.leiTexto || "").trim() || r.leiSeca));
  b.textContent = t(on ? "mat_lei_tem" : "mat_lei_btn");
  if (b.classList) b.classList.toggle("btn-min-ok", on);
}

function matLogAbrir() {
  $("matLogTexto").value = matLogTexto();
  abrirModal("dlgMatLog");
}

function matLogLimpar() {
  const n = matLog.length;
  matLog = [];
  try { localStorage.removeItem("eac_mat_log"); } catch (e) {}
  $("matLogTexto").value = matLogTexto();
  try { reg("MATERIAL", "registro dos resumos apagado", n + " eventos"); } catch (e) {}
}

function matRecusa(motivo, trecho, plano) {
  const t30 = String(trecho || "").slice(0, 60);
  matReg("marca", "recusada: " + motivo, t30);
  if (motivo === "nao_achou" && plano) {
    /* a pista que faltava: o que o app procurou e o que ele tinha */
    matReg("marca", "procurei: " + matNormalizar(trecho).slice(0, 60),
           "no texto de " + plano.length + " caracteres");
  }
  uiAlert(t(motivo === "curta" ? "mat_marca_curta"
    : motivo === "ja_marcado" ? "mat_marca_ja"
    : motivo === "marca_nao_achou" ? "mat_tirar_nao_achou" : "mat_marca_nao_achou"));
}

function matEquilibrar(src, ini, fim) {
  /* A borda da marca não pode partir um par de marcadores ao meio.
   * Selecionando "abertura de créditos suplementares" o recorte terminava
   * ANTES do "**" que fecha o negrito, e o texto virava
   * "==abertura de **créditos suplementares==" — negrito aberto e nunca
   * fechado, que estraga a leitura de TODO o resto do resumo.
   *
   * Vale para os dois marcadores: "**" e o "_" do itálico. Na primeira
   * versão só o negrito era equilibrado, e o itálico quebrava igual. */
  const MARCAS = ["**", "_"];
  const conta = (mk, a, b) => {
    let n = 0, k = a;
    while (k < b) {
      if (src.startsWith("**", k)) { if (mk === "**") n++; k += 2; continue; }
      if (src[k] === "_") { if (mk === "_") n++; k++; continue; }
      k++;
    }
    return n;
  };
  let voltas = 0;
  let mudou = true;
  while (mudou && voltas++ < 12) {
    mudou = false;
    for (const mk of MARCAS) {
      if (conta(mk, ini, fim) % 2 === 0) continue;
      const dep = src.indexOf(mk, fim);
      const ant = src.lastIndexOf(mk, ini - 1);
      /* prefere crescer para a frente: o fecho costuma estar logo ali, e
       * crescer para trás engoliria palavras que a pessoa não selecionou */
      if (dep >= 0 && (ant < 0 || dep - fim <= ini - ant)) { fim = dep + mk.length; mudou = true; }
      else if (ant >= 0) { ini = ant; mudou = true; }
    }
  }
  return { ini, fim };
}

function matNormalizar(s) {
  /* o mesmo conjunto de marcadores do matMapear, senão a busca procura uma
   * coisa e o mapa aponta para outra */
  return String(s || "")
    .replace(/^\s*(#{1,6}\s+|[-*]\s+)/gm, "")
    .replace(/(\*\*|==[!?]?|__)/g, "")
    .replace(/(^|[\s(])_([^_\n]{1,200})_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/\s+/g, " ").trim();
}

function matMarcarSelecao(tipo) {
  matLembrarSelecao();
  const trecho = matSelGuardada;
  if (matNormalizar(trecho).length < 3) { matRecusa("curta", trecho); return; }
  const ta = $("matTexto");
  const marca = MAT_MARCAS[tipo] || "==";

  const { plano, mapa } = matMapear(ta.value);
  const alvo = matNormalizar(trecho);

  /* TODAS as ocorrências, não só a primeira.
   * Era plano.indexOf(alvo): selecionar "transparência" numa linha quando a
   * MESMA palavra já estava marcada mais acima fazia o app olhar a
   * ocorrência de cima, ver o "==" e responder "já marcado" — recusando um
   * trecho que estava livre. */
  const ocorrencias = [];
  for (let k = plano.indexOf(alvo); k >= 0; k = plano.indexOf(alvo, k + 1))
    ocorrencias.push(k);
  if (!ocorrencias.length) { matRecusa("nao_achou", trecho, plano); return; }

  const jaMarcada = (p) => {
    const i0 = mapa[p];
    return new RegExp("==" + MAT_SUF + "$")
      .test(ta.value.slice(Math.max(0, i0 - 3), i0));
  };
  /* se a leitura sabe ONDE você clicou, vale a ocorrência mais próxima;
   * senão, a primeira que ainda estiver livre */
  let escolhida = -1;
  if (matSelOffset >= 0 && matSelTotal > 0 && ocorrencias.length > 1) {
    const aproximado = Math.round((matSelOffset / matSelTotal) * plano.length);
    let melhor = Infinity;
    ocorrencias.forEach((p) => {
      if (jaMarcada(p)) return;
      const d = Math.abs(p - aproximado);
      if (d < melhor) { melhor = d; escolhida = p; }
    });
  }
  if (escolhida < 0) {
    const livre = ocorrencias.find((p) => !jaMarcada(p));
    escolhida = livre === undefined ? -1 : livre;
  }
  if (escolhida < 0) { matRecusa("ja_marcado", trecho); return; }
  const pos = escolhida;

  const faixa = matEquilibrar(ta.value, mapa[pos], mapa[pos + alvo.length - 1] + 1);
  const ini = faixa.ini, fim = faixa.fim;
  /* A checagem de "já marcado" mudou de lugar: agora ela decide QUAL
   * ocorrência usar, em vez de recusar tudo por causa da primeira. Esta
   * linha também tinha um resquício: a regex /==[!?]?$/ não conhecia os
   * marcadores §, * e ~ criados na v8.79, então marca de lei ou de prova
   * não era reconhecida como marca. */
  /* MARCA QUE ATRAVESSA LINHAS FECHA EM CADA UMA.
   * A leitura é montada linha a linha: um "==?" numa linha e o "==" de
   * fecho na seguinte não formam marca nenhuma — as duas aparecem LITERAIS
   * na tela, e a pessoa vê "==?Ato Complexo:" como texto. Selecionar um
   * parágrafo inteiro é o gesto mais comum ao grifar, então isso acontecia
   * o tempo todo. Aqui a marca é reaberta a cada linha. */
  const original = ta.value.slice(ini, fim);
  const marcado = original.indexOf("\n") < 0
    ? marca + original + "=="
    : original.split("\n").map((linha) => {
        /* linha vazia não recebe marca: "==?==" não é nada e ainda
         * apareceria como lixo no texto */
        if (!linha.trim()) return linha;
        return marca + linha + "==";
      }).join("\n");
  ta.value = ta.value.slice(0, ini) + marcado + ta.value.slice(fim);
  /* NÃO grava aqui. Grifar é experimentar: a pessoa marca, olha, desfaz,
   * marca de novo. Gravar a cada clique tira dela a chance de desistir —
   * e sem gravação imediata o botão "Salvar estado" passa a significar
   * alguma coisa, em vez de ser um botão que não muda nada. */
  matSujo = true;
  matSelGuardada = "";
  matReg("marca", "marcado (" + tipo + ")", trecho.slice(0, 60)
    + " · ocorrência " + (ocorrencias.indexOf(pos) + 1) + " de " + ocorrencias.length);
  matTrocarModo("ler");
  $("matEstado").textContent = t("mat_marcado_nao_salvo");
}

function matLimparMarcas() {
  const ta = $("matTexto");
  ta.value = ta.value.replace(/==[!?]?([^=\n]{1,300})==/g, "$1");
  matSujo = true;                    /* também é rascunho: dá para desistir */
  matTrocarModo("ler");
  $("matEstado").textContent = t("mat_marcas_limpas_nao_salvo");
}

function matSalvarEstado() {
  if (!matAtual) return false;
  matGravar(matAtual.chave, $("matTexto").value,
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  matSujo = false;
  $("matEstado").textContent = t("mat_estado_salvo",
    { d: new Date().toLocaleTimeString() });
  matReg("salvar", "resumo salvo",
         (matAtual && matAtual.topico) + " · "
         + String($("matTexto").value || "").length + " caracteres");
  matRender();
  return true;
}

/* Fechar com marcação pendente pergunta antes.
 * A alternativa — descartar calado — é a mesma família de erro que apagou
 * 137 cartões: trabalho que some sem ninguém dizer nada. E salvar sozinho
 * também não serve, porque aí "não salvar" deixa de existir. */
async function matFechar() {
  if (matSujo) {
    /* TRÊS saídas, não duas. O uiConfirm só oferecia sim/não, e "não"
     * significava perder o trabalho — sem terceira opção para desistir de
     * fechar. Quem clica em fechar por engano no meio de uma leitura
     * marcada perdia tudo por um clique. */
    const r = await matPerguntarSaida();
    /* Esc e clique fora resolvem como "false". Aqui o padrão seguro é
     * FICAR: sair sem salvar precisa ser um clique deliberado, porque é o
     * único caminho que perde trabalho. */
    if (r !== "salvar" && r !== "sair") return;
    if (r === "salvar") matSalvarEstado();
    else reg("MATERIAL", "marcação descartada ao fechar",
             matAtual && matAtual.topico);
  }
  matSujo = false;
  matSelGuardada = "";
  $("dlgMaterial").close();
  matAtual = null;
}

/* "salvar e sair" · "sair sem salvar" · "continuar aqui" */
function matPerguntarSaida() {
  return new Promise((resolve) => {
    if (typeof uiEscolha === "function") {
      uiEscolha(t("mat_saida_tit"), [
        { valor: "salvar", rot: t("mat_saida_salvar"), classe: "btn-verde" },
        { valor: "sair", rot: t("mat_saida_sair"), classe: "btn-cinza" },
        { valor: "cancelar", rot: t("mat_saida_cancelar"), classe: "btn-cinza" },
      ]).then(resolve);
      return;
    }
    Promise.resolve(uiConfirm(t("mat_fechar_sem_salvar")))
      .then((sim) => resolve(sim ? "salvar" : "sair"));
  });
}

/* ------------------------------------------------------------------
 * MARCADOR DE PÁGINA
 * Resumo de vinte telas sem marcador vira "onde eu estava?" toda vez. O
 * marcador guarda a POSIÇÃO NO TEXTO (não o pixel): mudar o tamanho da
 * letra ou marcar um trecho não desloca o lugar guardado.
 * ------------------------------------------------------------------ */
function matPorMarcador() {
  if (!matAtual) return;
  const ta = $("matTexto");
  /* EM LEITURA, O CURSOR DO TEXTAREA NÃO SERVE.
   * O campo está escondido e o cursor fica onde o navegador deixou — ao
   * atribuir .value o Chrome põe no FIM, e o marcador ia sempre para a
   * última linha. Lendo, o lugar certo é o quanto da leitura já rolou. */
  let pos = 0;
  const lendo = matModo === "ler";
  const painel = $("matLeitura");
  if (lendo && painel && painel.scrollHeight > 0) {
    const alt = painel.clientHeight || 0;
    const total = Math.max(1, painel.scrollHeight - alt);
    const fracao = Math.min(1, Math.max(0, (painel.scrollTop || 0) / total));
    pos = Math.round(fracao * String(ta.value || "").length);
  } else {
    pos = ta.selectionStart || 0;
  }
  const r = matResumos[matAtual.chave];
  if (!r) return;
  r.marcador = pos;
  r.marcadorEm = new Date().toISOString();
  matSujo = true;
  matReg("marcador", "marcador posto", "caractere " + pos + " · modo " + matModo);
  matTrocarModo(matModo);
  $("matEstado").textContent = t("mat_marcado_nao_salvo");
}

function matPintarMarcador() {
  const r = matAtual && matResumos[matAtual.chave];
  const tem = !!(r && r.marcador);
  const ir = $("btnMatIrMarcador");
  if (ir) ir.hidden = !tem;
  const info = $("matMarcadorInfo");
  if (!info) return;
  if (!tem) { info.textContent = ""; return; }
  const total = String((r && r.texto) || "").length || 1;
  info.textContent = t("mat_marcador_em", {
    p: Math.min(100, Math.round((r.marcador / total) * 100)) });
}

function matIrMarcador() {
  const r = matAtual && matResumos[matAtual.chave];
  if (!r || !r.marcador) return;
  const ta = $("matTexto");
  if (!$("matTexto").hidden) {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = r.marcador;
    /* rolar até lá: sem isto o cursor vai para o lugar certo e a tela fica
     * onde estava, que é o mesmo que não ir */
    const antes = ta.value.slice(0, r.marcador).split("\n").length;
    ta.scrollTop = Math.max(0, (antes - 3) * 22);
  }
  const alvo = $("matLeitura") && $("matLeitura").querySelector
    ? $("matLeitura").querySelector(".mat-marcador") : null;
  if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: "center" });
  reg("MATERIAL", "voltei ao marcador", matAtual.topico);
}

function matRegistrarLeitura() {
  if (!matAtual) return;
  const txt = $("matTexto").value;
  const palavras = (txt.match(/\S+/g) || []).length;
  const min = Math.max(5, Math.round(palavras / 200));
  /* PESOS DE VERDADE, não zeros.
   * Este item era montado à mão com bruto: 0 e sem disciplinaPeso — o
   * registro saía como "peso undefined×undefined" e o diário guardava peso
   * zero para o estudo, o que estraga toda conta por peso depois. Aqui ele
   * é procurado no plano; só se não existir é que vira item avulso. */
  let item = null;
  try {
    const r = lerEdital($("editalTexto").value);
    const plano = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas,
      prova: $("edProva").value, feitos: edProgresso });
    item = plano.itens.find((x) => x.chave === matAtual.chave) || null;
  } catch (e) { item = null; }
  if (item) item = Object.assign({}, item, { minutos: min });
  else item = { disciplina: matAtual.disciplina, nome: matAtual.topico,
                chave: matAtual.chave, minutos: min, bruto: 0,
                disciplinaPeso: null, peso: null, avulso: true };
  if (typeof edMarcar === "function") {
    /* releitura de material é REVISÃO quando o tópico já foi estudado */
    const jaEstudado = typeof edProgresso !== "undefined"
      && edProgresso[matAtual.chave];
    edMarcar(item, jaEstudado ? "revisado" : "feito",
      { minutos: min, formas: ["resumo"], humor: "media" });
  }
  reg("MATERIAL", "leitura registrada: " + matAtual.topico,
      min + " min, " + palavras + " palavras");
  uiAlert(t("mat_lido", { n: min }));
}

/* Colar já limpo. Duas portas: a área de transferência (um clique) e uma
 * caixa para colar à mão, porque ler a área de transferência exige permissão
 * e no Firefox e no Safari ela simplesmente não existe. */
async function matColarDeFora() {
  let txt = "";
  /* primeiro o HTML, que é onde a formatação está; só depois o texto puro */
  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const itens = await navigator.clipboard.read();
      for (const it of itens) {
        if (it.types && it.types.includes("text/html")) {
          const b = await it.getType("text/html");
          txt = matHtmlParaMarcas(await b.text());
          break;
        }
      }
    }
  } catch (e) { txt = ""; }
  try {
    if (!txt && navigator.clipboard && navigator.clipboard.readText)
      txt = await navigator.clipboard.readText();
  } catch (e) { txt = ""; }
  if (!txt) {
    /* sem acesso à área de transferência: pede para colar na caixa */
    $("matColarTexto").value = "";
    abrirModal("dlgMatColar");
    $("matColarTexto").focus();
    return;
  }
  matAplicarColagem(txt);
}

function matAplicarColagem(txt) {
  const limpo = matLimparColagem(txt);
  if (!limpo) { uiAlert(t("mat_colar_vazio")); return; }
  const ta = $("matTexto");
  const antes = ta.value.trim();
  ta.value = antes ? antes + "\n\n" + limpo : limpo;
  $("dlgMatColar").close();
  reg("MATERIAL", "colagem limpa", txt.length + " → " + limpo.length + " caracteres");
  uiAlert(t("mat_colado", { n: limpo.split(/\n/).length }));
}

function matGravarEditor() {
  if (!matAtual) return;
  matGravar(matAtual.chave, $("matTexto").value,
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  reg("MATERIAL", "resumo salvo: " + matAtual.topico,
      matAtual.disciplina + " · " + $("matTexto").value.length + " caracteres");
  $("dlgMaterial").close();
  matAtual = null;
  matRender();
  if (typeof edRender === "function") edRender();
}

/* O botão que fecha o ciclo: o resumo vira material do prompt de cartões,
 * já com a disciplina como etiqueta. Sem isto o resumo seria um depósito. */
function matVirarCartoes() {
  if (!matAtual) return;
  const txt = $("matTexto").value;
  matGravar(matAtual.chave, txt, { disciplina: matAtual.disciplina, topico: matAtual.topico });
  const etiqueta = matAtual.disciplina.toLowerCase().replace(/\s+/g, "_");
  $("dlgMaterial").close();
  trocarModo("cartoes");
  abrirGerar(matAtual.topico + "\n\n" + txt + "\n\n[tags sugeridas: " + etiqueta + "]",
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  reg("MATERIAL", "resumo virou prompt de cartões", matAtual.topico);
  matAtual = null;
}

/* Agrupa concurso → disciplina → tópico. Com dezenas de resumos de dois ou
 * três concursos, uma lista plana ordenada por data vira um monte: o usuário
 * sabe o que procura (a matéria), não quando escreveu. */
/* TIPOS DE MATERIAL.
 * Um tópico pode ter resumo, cartões e lei seca ao mesmo tempo. Filtrar por
 * palavra nunca separaria as três coisas — "lei" aparece no texto de quase
 * todo resumo de Direito. Por isso são marcadores, derivados do conteúdo:
 * cartões e resumo o app sabe sozinho; "lei seca" é uma marca que a pessoa
 * põe, porque só ela sabe se aquilo é a letra da lei ou um comentário. */
const MAT_TIPOS = ["resumo", "cartoes", "lei"];

function matTiposDe(x) {
  const tipos = [];
  if (String(x.texto || "").trim()) tipos.push("resumo");
  if (String(x.cartoes || "").trim()) tipos.push("cartoes");
  /* agora é TEXTO próprio, não uma marca no resumo */
  if (String(x.leiTexto || "").trim() || x.leiSeca) tipos.push("lei");
  return tipos;
}

let matFEdital = "";
let matFDisc = "";
let matFTipos = [];

function matAgrupado(filtro) {
  const f = (filtro || "").trim().toLowerCase();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const fe = norm(matFEdital), fd = norm(matFDisc);
  const casa = (x) => {
    /* o edital manda: escolhido ele, a disciplina é procurada só dentro dele */
    if (fe && norm(x.concurso).indexOf(fe) < 0) return false;
    if (fd && norm(x.disciplina).indexOf(fd) < 0) return false;
    if (matFTipos.length) {
      const tps = matTiposDe(x);
      if (!matFTipos.every((tp) => tps.indexOf(tp) >= 0)) return false;
    }
    return !f || (x.topico + " " + x.disciplina + " "
      + (x.concurso || "") + " " + x.texto).toLowerCase().includes(f);
  };
  const arv = new Map();
  matLista().filter(casa).forEach((x) => {
    const cc = x.concurso || "";
    if (!arv.has(cc)) arv.set(cc, new Map());
    const d = x.disciplina || "";
    if (!arv.get(cc).has(d)) arv.get(cc).set(d, []);
    arv.get(cc).get(d).push(x);
  });
  return arv;
}

let matFiltro = "";
let matFechados = {};

/* As sugestões saem do que EXISTE, não de uma lista fixa: material de um
 * concurso apagado não deve continuar sendo oferecido. */
/* Os selos de tipo, para a linha da lista dizer o que tem ali sem abrir. */
function matSelosDe(x) {
  const cx = document.createElement("span");
  cx.className = "mat-selos";
  matTiposDe(x).forEach((tp) => {
    const s = document.createElement("span");
    s.className = "mat-selo selo-" + tp;
    s.textContent = t("mat_tipo_" + tp);
    cx.append(s);
  });
  return cx;
}

function matPintarSugestoes() {
  const lista = matLista();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const encher = (id, valores) => {
    const dl = $(id);
    if (!dl) return;
    dl.innerHTML = "";
    valores.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      dl.append(o);
    });
  };
  const eds = [];
  lista.forEach((x) => {
    const cc = (x.concurso || "").trim();
    if (cc && eds.indexOf(cc) < 0) eds.push(cc);
  });
  encher("matListaEditais", eds.sort());

  /* disciplinas SÓ do edital escolhido — é o motivo de o edital vir antes */
  const fe = norm(matFEdital);
  const discs = [];
  lista.forEach((x) => {
    if (fe && norm(x.concurso).indexOf(fe) < 0) return;
    const d = (x.disciplina || "").trim();
    if (d && discs.indexOf(d) < 0) discs.push(d);
  });
  encher("matListaDiscs", discs.sort());

  const cx = $("matTipos");
  if (!cx) return;
  cx.innerHTML = "";
  MAT_TIPOS.forEach((tp) => {
    const n = lista.filter((x) => matTiposDe(x).indexOf(tp) >= 0).length;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mat-tipo tp-" + tp + (matFTipos.indexOf(tp) >= 0 ? " ativa" : "");
    /* "cartões (1)" era lido como "1 cartão". O número conta MATERIAIS que
     * têm cartões — coisa diferente, e a diferença confunde justamente quem
     * está procurando os cartões. */
    b.textContent = t("mat_tipo_" + tp) + " · " + t("mat_tipo_conta", { n });
    b.onclick = () => {
      const k = matFTipos.indexOf(tp);
      if (k >= 0) matFTipos.splice(k, 1); else matFTipos.push(tp);
      matRender();
    };
    cx.append(b);
  });
}

function matRender() {
  const box = $("matLista");
  if (!box) return;
  box.innerHTML = "";
  const r = matResumo();
  $("matContagem").textContent = r.total
    ? t("mat_contagem", { n: r.total, d: r.disciplinas,
        c: Math.round(r.caracteres / 1000) })
    : t("mat_vazio_curto");

  if (!r.total) {
    const p = document.createElement("div");
    p.className = "esq-vazio"; p.textContent = t("mat_vazio");
    box.append(p);
    return;
  }

  matPintarSugestoes();
  const arv = matAgrupado(matFiltro);
  let achou = 0;
  arv.forEach((discs, cc) => {
    const grupo = document.createElement("div");
    grupo.className = "mat-grupo";
    const cab = document.createElement("div");
    cab.className = "mat-cc";
    cab.textContent = cc || t("mat_sem_concurso");
    grupo.append(cab);

    discs.forEach((itens, disc) => {
      achou += itens.length;
      const bl = document.createElement("div");
      bl.className = "mat-disc";
      const chave = cc + "›" + disc;
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "mat-disc-cab";
      bt.textContent = (matFechados[chave] ? "▸ " : "▾ ") + (disc || "—")
        + "  (" + itens.length + ")";
      bt.onclick = () => { matFechados[chave] = !matFechados[chave]; matRender(); };
      bl.append(bt);
      if (!matFechados[chave]) {
        itens.forEach((x) => {
          const li = document.createElement("div");
          li.className = "mat-item";
          const esq = document.createElement("div");
          esq.className = "mat-item-txt";
          const nm = document.createElement("div");
          nm.className = "mat-nome";
          nm.textContent = x.topico || x.chave;
          /* OS SELOS APARECEM AQUI.
           * matSelosDe existia desde a v8.84 e nunca foi usada: a lista
           * mostrava só o tamanho do resumo, então um tópico com 155
           * cartões parecia ter apenas texto. Quem salvou cartões não os
           * encontrava em lugar nenhum. */
          nm.append(matSelosDe(x));
          const sub = document.createElement("div");
          sub.className = "mat-sub";
          const nCart = matContarCartoes(x.chave);
          sub.textContent = t("mat_tamanho", { c: String(x.texto || "").length })
            + (nCart ? " · " + t("mat_n_cartoes", { n: nCart }) : "")
            + " · " + new Date(x.tocado).toLocaleDateString();
          esq.append(nm, sub);
          /* e um aviso quando o campo de cartões tem lixo dentro */
          const lx = matLixoNosCartoes(x.chave);
          if (lx.lixo > 0) {
            const av = document.createElement("div");
            av.className = "mat-lixo";
            av.textContent = t("mat_lixo_aviso", { n: lx.lixo, c: lx.cartoes });
            const bl = document.createElement("button");
            bl.type = "button"; bl.className = "btn-min";
            bl.textContent = t("mat_lixo_limpar");
            bl.onclick = async () => {
              if (!(await uiConfirm(t("mat_lixo_conf", { n: lx.lixo, c: lx.cartoes })))) return;
              matLimparLixoCartoes(x.chave);
              matRender();
            };
            av.append(document.createTextNode(" "), bl);
            esq.append(av);
          }
          const acoes = document.createElement("div");
          acoes.className = "mat-acoes";
          const ler = botaoMini("mat_abrir", "btn-cinza",
            () => matAbrirEditor({ disciplina: x.disciplina, nome: x.topico }, "ler"));
          acoes.append(ler);
          /* CAMINHO ATÉ OS CARTÕES. Sem ele, os cartões existiam guardados e
           * não havia como chegar até eles a não ser abrindo o resumo e
           * entrando no painel. */
          if (nCart) {
            /* vai DIRETO aos cartões: sem abrir o resumo no caminho */
            const bCart = botaoMini(null, "btn-roxo",
              () => mcEstudarDireto(x.disciplina, x.topico),
              t("mat_ver_cartoes_n", { n: nCart }));
            bCart.title = t("mat_ver_cartoes_ajuda", { n: nCart, tp: x.topico });
            acoes.append(bCart);
            /* e um caminho para MEXER neles, que aí sim é outra tarefa */
            const bMex = botaoMini(null, "btn-cinza", () => {
              mcApontarTopico(x.disciplina, x.topico);
              try { matCartoesAbrir(); matCartoesVer(); } catch (e) {}
            }, t("mat_mexer_cartoes"));
            bMex.title = t("mat_mexer_cartoes_ajuda");
            acoes.append(bMex);
          }
          li.append(esq, acoes);
          bl.append(li);
        });
      }
      grupo.append(bl);
    });
    box.append(grupo);
  });

  if (!achou) {
    const p = document.createElement("div");
    p.className = "esq-vazio";
    p.textContent = t("mat_sem_resultado", { f: matFiltro });
    box.append(p);
  }
}

function matIniciar() {
  try { matRepararChaves(); } catch (e) {}
  matCarregar();
  if (!$("matTexto")) return;
  /* o botão único: grava e CONTINUA aqui */
  matBotao("btnMatSalvar", "salvar resumo", () => matSalvarEstado());
  $("btnMatColar").onclick = matColarDeFora;
  matBotao("btnMarcaD", "marcar destaque", () => matMarcarSelecao("destaque"));
  matBotao("btnMarcaI", "marcar importante", () => matMarcarSelecao("importante"));
  matBotao("btnMarcaQ", "marcar dúvida", () => matMarcarSelecao("duvida"));
  matBotao("btnMarcaLimpar", "limpar marcas", matLimparMarcas);
  matBotao("btnMarcaLei", "marcar lei", () => matMarcarSelecao("lei"));
  matBotao("btnMarcaProva", "marcar prova", () => matMarcarSelecao("prova"));
  matBotao("btnMarcaPeg", "marcar pegadinha", () => matMarcarSelecao("pegadinha"));
  matBotao("btnMarcaTirar", "tirar marca", matTirarMarca);
  matBotao("btnMatSalvarEstadoTopo", "salvar resumo (topo)", () => matSalvarEstado());
  matBotao("btnMatMarcador", "pôr marcador", matPorMarcador);
  matBotao("btnMatFecharTopo", "fechar (topo)", () => matFechar());
  matBotao("btnMatDuvidas", "dúvidas deste resumo", matDuvidasAbrir);
  if ($("btnMatLei")) $("btnMatLei").onclick = () => {
    if (matAtual) leiAbrir(matAtual.disciplina, matAtual.topico);
  };
  leiIniciar();
  if ($("btnMatLogAba")) $("btnMatLogAba").onclick = matLogAbrir;
  matBotao("btnDuvidas", "minhas dúvidas", matDuvidasAbrir);
  matBotao("btnMatConsertar", "consertar marcação", matConsertarAbrir);
  if ($("btnDuvFechar")) $("btnDuvFechar").onclick = () => $("dlgDuvidas").close();
  if ($("btnMatLog")) $("btnMatLog").onclick = matLogAbrir;
  if ($("btnMatLogFechar")) $("btnMatLogFechar").onclick = () => $("dlgMatLog").close();
  if ($("btnMatLogLimpar")) $("btnMatLogLimpar").onclick = matLogLimpar;
  if ($("btnMatLogCopiar")) $("btnMatLogCopiar").onclick = () => {
    try { navigator.clipboard.writeText($("matLogTexto").value); } catch (e) {}
    toast("mat_log_copiado");
  };
  matLogCarregar();
  matBotao("btnMatIrMarcador", "ir ao marcador", matIrMarcador);
  /* btnMatSalvarEstado foi removido do rodapé na v8.94: fazia a mesma
   * gravação do botão Salvar, e dois rótulos diferentes para o mesmo ato
   * sugeriam que salvavam coisas diferentes. */

  /* mantém a última seleção viva: o clique no botão de marcar chega depois
   * de o navegador já ter recolhido a seleção */
  ["mouseup", "touchend", "keyup"].forEach((ev) => {
    if ($("matLeitura")) $("matLeitura").addEventListener(ev, matLembrarSelecao);
  });
  if (document.addEventListener)
    document.addEventListener("selectionchange", matLembrarSelecao);
  /* e impede o próprio clique de destruí-la */
  ["btnMarcaD", "btnMarcaI", "btnMarcaQ", "btnMarcaLei", "btnMarcaProva",
   "btnMarcaPeg", "btnMarcaTirar"].forEach((id) => {
    if (!$(id)) return;
    if ($(id)) $(id).addEventListener("mousedown", (ev) => ev.preventDefault());
  });
  /* colar na caixa manual também aproveita o HTML */
  if ($("matColarTexto")) {
    $("matColarTexto").addEventListener("paste", (ev) => {
      const html = ev.clipboardData && ev.clipboardData.getData("text/html");
      if (!html) return;
      ev.preventDefault();
      $("matColarTexto").value = matHtmlParaMarcas(html);
    });
  }
  $("btnMatColarOk").onclick = () => matAplicarColagem($("matColarTexto").value);
  $("btnMatColarFechar").onclick = () => $("dlgMatColar").close();
  const trocarModo = () => {
    if (matModo === "editar") matGravar(matAtual.chave, $("matTexto").value,
      { disciplina: matAtual.disciplina, topico: matAtual.topico });
    matTrocarModo(matModo === "editar" ? "ler" : "editar");
  };
  $("btnMatModo").onclick = trocarModo;
  if ($("btnMatModoTopo")) $("btnMatModoTopo").onclick = trocarModo;
  $("btnMatAmpliar").onclick = matAmpliar;
  $("btnMatMaior").onclick = () => matFonteMudar(1);
  $("btnMatMenor").onclick = () => matFonteMudar(-1);
  $("btnMatLerReg").onclick = matRegistrarLeitura;
  [["btnFmtB", () => matEnvolver("**")], ["btnFmtI", () => matEnvolver("_")],
   ["btnFmtM", () => matEnvolver("==")], ["btnFmtH", () => matPrefixo("## ")],
   ["btnFmtL", () => matPrefixo("- ")], ["btnFmtHr", () => matPrefixo("---\n")]]
    .forEach(([id, fn]) => { if ($(id)) $(id).onclick = fn; });
  /* matVirarCartoes fechava o resumo e trocava o app de modo; agora o
   * painel abre por cima. A função antiga fica como caminho para quem quer
   * mesmo levar o resumo inteiro para a bancada de cartões. */
  matCartoesIniciar();
  $("btnMatFechar").onclick = () => matFechar();
  if ($("matBusca")) {
    $("matBusca").addEventListener("input", () => {
      matFiltro = $("matBusca").value; matRender();
    });
  }
  if ($("matFEdital")) $("matFEdital").addEventListener("input", () => {
    matFEdital = $("matFEdital").value;
    /* trocar de edital limpa a disciplina: a que estava escolhida pode nem
     * existir no novo, e o resultado vazio pareceria "não tenho material" */
    if (matFDisc) { matFDisc = ""; if ($("matFDisc")) $("matFDisc").value = ""; }
    matRender();
  });
  if ($("matFDisc")) $("matFDisc").addEventListener("input", () => {
    matFDisc = $("matFDisc").value; matRender();
  });
  matRender();
}

/* =====================================================================
 * CARTÕES DO TÓPICO — sem sair do resumo
 *
 * O botão antigo fechava o material, trocava o app de modo e abria o
 * gerador: quem estava no meio de uma leitura marcada perdia o lugar. Este
 * painel abre POR CIMA (o navegador empilha <dialog> em camada própria) e,
 * ao fechar, a leitura continua onde estava.
 *
 * Sobre os DADOS, que é o que sustenta o resto do projeto: cada cartão
 * carrega as etiquetas que dizem de onde nasceu (disciplina, tópico,
 * concurso), e cada lote gravado deixa uma linha de procedência em
 * "cartoesInfo". Cartão sem origem é cartão que ninguém consegue devolver
 * ao lugar depois — foi o que nos custou a v8.79 inteira.
 * ===================================================================== */

/* Etiquetas planas. Planas porque "::" é o separador de campos do material:
 * hierarquia do Anki aqui faz o cartão voltar mutilado (medido na v8.76). */
function matEtiquetasTopico(disciplina, topico, concurso) {
  const achatar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const tags = [];
  if (disciplina) tags.push("disc_" + achatar(disciplina));
  if (topico) tags.push("top_" + achatar(topico));
  if (concurso) tags.push("concurso_" + achatar(concurso));
  tags.push("de_resumo");
  return tags.filter(Boolean);
}

function matCartoesAbrir() {
  if (!matAtual) return;
  /* grava o texto antes: o prompt sai do que está escrito agora, e o
   * resumo em si não é rascunho */
  matGravar(matAtual.chave, $("matTexto").value,
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  const r = matResumos[matAtual.chave] || {};
  const jaTem = matContarCartoes(matAtual.chave);
  $("mcSub").textContent = t("mc_sub", {
    d: matAtual.disciplina, tp: matAtual.topico, n: jaTem });
  $("mcTexto").value = "";
  $("mcAviso").hidden = true;
  $("mcPreview").innerHTML = "";
  if ($("btnMcVer")) $("btnMcVer").hidden = !jaTem;
  if ($("mcAcoesSalvos")) $("mcAcoesSalvos").hidden = false;
  abrirModal("dlgMatCartoes");
  reg("MATERIAL-CARTOES", "painel aberto", matAtual.topico
      + " · " + String(r.texto || "").length + " caracteres de resumo, "
      + jaTem + " cartões já salvos");
}

function matCartoesPrompt() {
  if (!matAtual) return;
  const r = matResumos[matAtual.chave] || {};
  const txt = t("mc_prompt", {
    d: matAtual.disciplina, tp: matAtual.topico,
    resumo: String(r.texto || ""),
    tags: matEtiquetasTopico(matAtual.disciplina, matAtual.topico,
      r.concurso || (typeof concursoAtual === "function" ? concursoAtual().nome : "")).join(" "),
  });
  try { navigator.clipboard.writeText(txt); } catch (e) {}
  reg("MATERIAL-CARTOES", "prompt gerado", matAtual.topico);
  toast("mc_prompt_copiado");
}

/* Lê com o parser do próprio app: o que não passa aqui não passaria na
 * exportação depois, e é melhor a pessoa saber agora. */
function matCartoesLer() {
  const bruto = $("mcTexto").value;
  if (!bruto.trim()) return { cards: [], avisos: [], repetidos: 0 };
  const r = parseText(bruto);
  const jaTem = new Set(
    String((matResumos[matAtual.chave] || {}).cartoes || "")
      .split("\n").map((l) => l.split("::")[0].trim().toLowerCase()).filter(Boolean));
  let repetidos = 0;
  r.cards.forEach((c) => {
    c._repetido = jaTem.has(String(c.front || "").trim().toLowerCase());
    if (c._repetido) repetidos++;
  });
  return { cards: r.cards, avisos: r.warnings || [], repetidos };
}

function matCartoesConferir() {
  const r = matCartoesLer();
  const av = $("mcAviso");
  const pv = $("mcPreview");
  pv.innerHTML = "";
  if (!r.cards.length) {
    av.hidden = !$("mcTexto").value.trim();
    av.textContent = t("mc_nada_lido");
    return r;
  }
  av.hidden = false;
  av.textContent = t("mc_lidos", { n: r.cards.length,
    a: r.avisos.length, r: r.repetidos });

  const concurso = (matResumos[matAtual.chave] || {}).concurso
    || (typeof concursoAtual === "function" ? concursoAtual().nome : "");
  const tags = matEtiquetasTopico(matAtual.disciplina, matAtual.topico, concurso);
  r.cards.slice(0, 40).forEach((c) => {
    const d = document.createElement("div");
    d.className = "mc-card";
    const f = document.createElement("div");
    f.className = "mc-frente"; f.textContent = c.front;
    const v = document.createElement("div");
    v.className = "mc-verso"; v.textContent = String(c.back || "").slice(0, 160);
    const tg = document.createElement("div");
    tg.className = "mc-tags"; tg.textContent = tags.join(" · ");
    d.append(f, v, tg);
    /* ver aumentado e apagar, cartão a cartão: julgar um cartão exige
     * vê-lo do jeito que ele vai aparecer, não numa linha espremida */
    const ac = document.createElement("div");
    ac.className = "mc-card-acoes";
    const bAmp = document.createElement("button");
    bAmp.type = "button"; bAmp.className = "btn-min";
    bAmp.textContent = t("mc_ampliar");
    bAmp.title = t("mc_ampliar_ajuda");
    bAmp.onclick = () => mcEstudarAbrir(r.cards.indexOf(c));
    ac.append(bAmp);
    if (c._repetido) {
      const bDel = document.createElement("button");
      bDel.type = "button"; bDel.className = "btn-min btn-min-perigo";
      bDel.textContent = t("mc_apagar_este");
      bDel.title = t("mc_apagar_ajuda");
      bDel.onclick = () => {
        mcEstCartoes = mcCartoesSalvos();
        const k = mcEstCartoes.findIndex((x) =>
          String(x.front || "").trim().toLowerCase() === String(c.front || "").trim().toLowerCase());
        if (k >= 0) mcApagarCartao(k);
      };
      ac.append(bDel);
    }
    d.append(ac);
    if (c._repetido) {
      const j = document.createElement("div");
      j.className = "mc-jatem"; j.textContent = t("mc_ja_existe");
      d.append(j);
    }
    pv.append(d);
  });
  return r;
}

async function matCartoesSalvar() {
  if (!matAtual) return;
  const r = matCartoesLer();
  const novos = r.cards.filter((c) => !c._repetido);
  if (!novos.length) {
    reg("MATERIAL-CARTOES", "nada a salvar",
        r.cards.length + " lidos, " + r.repetidos + " já existiam");
    uiAlert(t(r.cards.length ? "mc_todos_repetidos" : "mc_nada_lido"));
    return;
  }
  if (!(await uiConfirm(t("mc_conf_salvar", {
    n: novos.length, tp: matAtual.topico, r: r.repetidos })))) {
    reg("MATERIAL-CARTOES", "gravação cancelada por você", novos.length + " cartões");
    return;
  }

  const reg0 = matResumos[matAtual.chave] || {};
  const concurso = reg0.concurso
    || (typeof concursoAtual === "function" ? concursoAtual().nome : "");
  const tags = matEtiquetasTopico(matAtual.disciplina, matAtual.topico, concurso);
  const limpa = (s) => String(s || "").replace(/\s*::\s*/g, " — ")
    .replace(/\r?\n+/g, " ").trim();
  const linhas = novos.map((c) =>
    limpa(c.front) + " :: " + limpa(c.back) + " :: "
    + tags.concat((c.tags || []).map((x) => String(x).replace(/::/g, "_"))).join(" "));

  const antes = String(reg0.cartoes || "").replace(/\s*$/, "");
  matGravarCartoes(matAtual.chave, (antes ? antes + "\n" : "") + linhas.join("\n"),
    { disciplina: matAtual.disciplina, topico: matAtual.topico, concurso });

  /* PROCEDÊNCIA. Isto não é enfeite: é o que permite, meses depois,
   * responder "de qual resumo saiu este cartão e quando". */
  const alvo = matResumos[matAtual.chave];
  alvo.cartoesInfo = (alvo.cartoesInfo || []).concat([{
    quando: new Date().toISOString(), n: novos.length,
    origem: "resumo", concurso,
    resumoChars: String(alvo.texto || "").length,
    app: (typeof VERSAO === "string" ? VERSAO : ""),
  }]);
  matSalvar();

  reg("MATERIAL-CARTOES", "gravados no tópico",
      novos.length + " cartões em " + matAtual.topico
      + " (" + r.repetidos + " repetidos ignorados) · etiquetas: " + tags.join(" "));
  $("mcTexto").value = "";
  matCartoesConferir();
  if ($("btnMcVer")) $("btnMcVer").hidden = false;
  await uiAlert(t("mc_salvos", { n: novos.length, tp: matAtual.topico }));
}

/* Ver o que já está salvo, sem sair do painel. */
function matCartoesVer() {
  const txt = String((matResumos[matAtual.chave] || {}).cartoes || "");
  $("mcTexto").value = txt;
  matCartoesConferir();
  reg("MATERIAL-CARTOES", "cartões salvos trazidos para conferência",
      matContarCartoes(matAtual.chave) + " cartões");
}

function matCartoesIniciar() {
  if ($("btnMatCartoes")) $("btnMatCartoes").onclick = matCartoesAbrir;
  if ($("btnMcPrompt")) $("btnMcPrompt").onclick = matCartoesPrompt;
  if ($("btnMcSalvar")) $("btnMcSalvar").onclick = matCartoesSalvar;
  if ($("btnMcVer")) $("btnMcVer").onclick = matCartoesVer;
  if ($("btnMcFechar")) $("btnMcFechar").onclick = () => $("dlgMatCartoes").close();
  if ($("mcTexto")) $("mcTexto").addEventListener("input", matCartoesConferir);
  mcEstudoIniciar();
}

/* =====================================================================
 * ESTUDAR OS CARTÕES DO TÓPICO EM TELA
 *
 * No MESMO desenho do módulo de cartões (renderCartaoEstilizado): o que se
 * vê aqui é o que vai para o Anki. Serve para revisar sem exportar, e para
 * julgar se o cartão presta — porque cartão ruim só se revela quando você
 * tenta responder a ele.
 * ===================================================================== */
let mcEstCartoes = [];
let mcEstIdx = 0;
let mcEstMostra = false;

function mcCartoesSalvos() {
  if (!matAtual) return [];
  const bruto = String((matResumos[matAtual.chave] || {}).cartoes || "");
  if (!bruto.trim()) return [];
  try { return parseText(bruto).cards; } catch (e) { return []; }
}

function mcEstudarAbrir(indice) {
  mcEstCartoes = mcCartoesSalvos();
  if (!mcEstCartoes.length) { uiAlert(t("mc_est_vazio")); return; }
  mcEstIdx = Math.max(0, Math.min(mcEstCartoes.length - 1, indice || 0));
  mcEstMostra = false;
  $("mcEstTitulo").textContent = t("mc_est_titulo", { tp: matAtual.topico });
  $("mcEstSub").textContent = t("mc_est_sub", { d: matAtual.disciplina });
  mcEstPintar();
  abrirModal("dlgMcEstudo");
  matReg("estudo", "estudo em tela aberto", mcEstCartoes.length + " cartões");
}

function mcEstPintar() {
  const cx = $("mcEstCartao");
  cx.innerHTML = "";
  const c = mcEstCartoes[mcEstIdx];
  if (!c) return;
  const div = document.createElement("div");
  /* a MESMA função do módulo de cartões: se o desenho divergir aqui, a
   * revisão em tela deixa de valer como ensaio do que vai para o Anki */
  try { renderCartaoEstilizado(div, c, mcEstMostra); }
  catch (e) {
    div.textContent = String(c.front || "") + (mcEstMostra ? "\n" + String(c.back || "") : "");
  }
  cx.append(div);
  $("mcEstPos").textContent = t("mc_est_pos", {
    n: mcEstIdx + 1, t: mcEstCartoes.length });
  $("btnMcEstVirar").textContent = t(mcEstMostra ? "mc_est_esconder" : "mc_est_virar");
}

function mcEstAndar(passo) {
  if (!mcEstCartoes.length) return;
  mcEstIdx = (mcEstIdx + passo + mcEstCartoes.length) % mcEstCartoes.length;
  mcEstMostra = false;
  mcEstPintar();
}

/* APAGAR UM CARTÃO — com duas perguntas.
 * A primeira mostra o cartão inteiro; a segunda exige confirmar que é
 * mesmo aquele. Cartão apagado não volta, e apagar o errado é fácil quando
 * se está passando rápido por uma pilha deles. */
async function mcApagarCartao(indice) {
  const c = mcEstCartoes[indice];
  if (!c || !matAtual) return;
  const frente = String(c.front || "").slice(0, 120);
  if (!(await uiConfirm(t("mc_apagar_1", { f: frente, v: String(c.back || "").slice(0, 120) })))) return;
  if (!(await uiConfirm(t("mc_apagar_2", { f: frente })))) {
    matReg("cartoes", "exclusão de cartão cancelada na segunda pergunta", frente);
    return;
  }

  const bruto = String((matResumos[matAtual.chave] || {}).cartoes || "");
  const linhas = bruto.split("\n");
  const alvo = String(c.front || "").trim().toLowerCase();
  const k = linhas.findIndex((l) =>
    l.split("::")[0].trim().toLowerCase() === alvo);
  if (k < 0) { uiAlert(t("mc_apagar_nao_achou")); return; }
  linhas.splice(k, 1);
  matGravarCartoes(matAtual.chave, linhas.join("\n").replace(/^\s+|\s+$/g, ""),
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  matReg("cartoes", "cartão apagado do tópico", frente);

  mcEstCartoes = mcCartoesSalvos();
  if (!mcEstCartoes.length) { $("dlgMcEstudo").close(); }
  else { mcEstIdx = Math.min(mcEstIdx, mcEstCartoes.length - 1); mcEstMostra = false; mcEstPintar(); }
  try { matCartoesVer(); } catch (e) {}
  try { matRender(); } catch (e) {}
}

/* IMPORTAR de arquivo: quem tem os cartões num .txt não deveria abrir o
 * arquivo, copiar e colar. O conteúdo entra na caixa e passa pela mesma
 * conferência da colagem. */
function mcImportarArquivo(arq) {
  if (!arq) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    const txt = String(leitor.result || "");
    const antes = $("mcTexto").value;
    $("mcTexto").value = (antes.trim() ? antes.replace(/\s*$/, "") + "\n" : "") + txt;
    matReg("cartoes", "arquivo importado para a caixa de cartões",
           (arq.name || "?") + " · " + txt.length + " caracteres");
    matCartoesConferir();
  };
  leitor.onerror = () => uiAlert(t("mc_import_erro"));
  leitor.readAsText(arq);
}

/* Aponta o "tópico atual" SEM abrir a janela do resumo.
 * Consultar os cartões não deveria obrigar a abrir o texto — são duas
 * coisas diferentes, e quem quer revisar cartão não quer ler resumo. */
function mcApontarTopico(disciplina, topico) {
  matAtual = { disciplina, topico, chave: matChave(disciplina, topico) };
  return matAtual;
}

function mcEstudarDireto(disciplina, topico) {
  mcApontarTopico(disciplina, topico);
  mcEstudarAbrir(0);
}

function mcEstudoIniciar() {
  if ($("btnMcEstudar")) $("btnMcEstudar").onclick = () => mcEstudarAbrir(0);
  if ($("btnMcEstAnt")) $("btnMcEstAnt").onclick = () => mcEstAndar(-1);
  if ($("btnMcEstProx")) $("btnMcEstProx").onclick = () => mcEstAndar(1);
  if ($("btnMcEstVirar")) $("btnMcEstVirar").onclick = () => {
    mcEstMostra = !mcEstMostra; mcEstPintar();
  };
  if ($("btnMcEstApagar")) $("btnMcEstApagar").onclick = () => mcApagarCartao(mcEstIdx);
  if ($("btnMcEstFechar")) $("btnMcEstFechar").onclick = () => $("dlgMcEstudo").close();
  if ($("btnMcImportar")) $("btnMcImportar").onclick = () => $("mcArquivo").click();
  if ($("mcArquivo")) $("mcArquivo").onchange = (ev) => {
    const f = ev && ev.target && ev.target.files && ev.target.files[0];
    mcImportarArquivo(f);
    if (ev && ev.target) ev.target.value = "";
  };
}

/* =====================================================================
 * LEI SECA — documento próprio, ao lado do resumo
 *
 * Marcar o resumo inteiro como "lei seca" era confuso, e com razão: um
 * tópico costuma ter as DUAS coisas — a letra da lei e o comentário sobre
 * ela. São dois textos no mesmo registro, cada um com seu leitor, e o
 * tópico pode ter um, outro ou os dois.
 * ===================================================================== */
let leiAtual = null;
let leiModo = "ler";
let leiSujo = false;
let leiFonte = 15;

function leiTem(chave) {
  const r = matResumos[chave];
  return !!(r && String(r.leiTexto || "").trim());
}

function leiAbrir(disciplina, topico) {
  leiAtual = { disciplina, topico, chave: matChave(disciplina, topico) };
  const r = matResumos[leiAtual.chave] || {};
  $("leiTitulo").textContent = t("lei_titulo", { tp: topico });
  $("leiTexto").value = String(r.leiTexto || "");
  leiSujo = false;
  /* abre LENDO quando já existe texto, e EDITANDO quando está vazio: pedir
   * para trocar de modo antes de escrever a primeira linha é atrito à toa */
  leiTrocarModo(String(r.leiTexto || "").trim() ? "ler" : "editar");
  abrirModal("dlgLeiSeca");
  matReg("lei", "lei seca aberta", topico + " · "
    + String(r.leiTexto || "").length + " caracteres");
}

function leiTrocarModo(modo) {
  leiModo = modo === "editar" ? "editar" : "ler";
  const lendo = leiModo === "ler";
  $("leiTexto").hidden = lendo;
  $("leiLeitura").hidden = !lendo;
  $("btnLeiModo").textContent = t(lendo ? "mat_modo_editar" : "mat_modo_ler");
  if (lendo) {
    $("leiLeitura").innerHTML = matParaHtml($("leiTexto").value)
      || "<p class='nota'>" + t("lei_vazia") + "</p>";
    $("leiLeitura").style.fontSize = leiFonte + "px";
  }
}

function leiGravar() {
  if (!leiAtual) return;
  const txt = $("leiTexto").value;
  const antigo = matResumos[leiAtual.chave] || {};
  /* Object.assign sobre o antigo, como em matGravar: gravar a lei seca não
   * pode apagar resumo, cartões nem marcador. */
  matResumos[leiAtual.chave] = Object.assign({}, antigo, {
    leiTexto: txt,
    disciplina: antigo.disciplina || leiAtual.disciplina,
    topico: antigo.topico || leiAtual.topico,
    concurso: antigo.concurso
      || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    criado: antigo.criado || new Date().toISOString(),
    tocado: new Date().toISOString(),
  });
  matSalvar();
  leiSujo = false;
  matReg("lei", "lei seca gravada", leiAtual.topico + " · " + txt.length + " caracteres");
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
  toast("lei_salva");
}

/* Registrar que leu: mesma ideia do resumo, mas dizendo que foi lei seca —
 * ler a letra da lei e ler comentário são esforços diferentes. */
function leiRegistrarLeitura() {
  if (!leiAtual) return;
  const txt = $("leiTexto").value;
  const palavras = (txt.match(/\S+/g) || []).length;
  const min = Math.max(5, Math.round(palavras / 150));
  let item = null;
  try {
    const r = lerEdital($("editalTexto").value);
    const plano = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas,
      prova: $("edProva").value, feitos: edProgresso });
    item = plano.itens.find((x) => x.chave === leiAtual.chave) || null;
  } catch (e) { item = null; }
  if (item) item = Object.assign({}, item, { minutos: min });
  else item = { disciplina: leiAtual.disciplina, nome: leiAtual.topico,
                chave: leiAtual.chave, minutos: min, bruto: 0,
                disciplinaPeso: null, peso: null, avulso: true };

  if (typeof edMarcar === "function") {
    const jaEstudado = typeof edProgresso !== "undefined" && edProgresso[leiAtual.chave];
    edMarcar(item, jaEstudado ? "revisado" : "feito",
      { minutos: min, formas: ["leitura"], humor: "media" });
  }
  matReg("lei", "leitura de lei seca registrada",
         min + " min, " + palavras + " palavras");
  uiAlert(t("lei_lida", { n: min }));
}

async function leiFechar() {
  if (leiSujo) {
    const r = await matPerguntarSaida();
    if (r !== "salvar" && r !== "sair") return;
    if (r === "salvar") leiGravar();
    else matReg("lei", "alterações da lei seca descartadas", leiAtual && leiAtual.topico);
  }
  leiSujo = false;
  $("dlgLeiSeca").close();
  leiAtual = null;
}

function leiIniciar() {
  if ($("btnLeiModo")) $("btnLeiModo").onclick = () => {
    if (leiModo === "editar") leiGravar();
    leiTrocarModo(leiModo === "editar" ? "ler" : "editar");
  };
  if ($("btnLeiSalvar")) $("btnLeiSalvar").onclick = leiGravar;
  if ($("btnLeiLido")) $("btnLeiLido").onclick = leiRegistrarLeitura;
  if ($("btnLeiFechar")) $("btnLeiFechar").onclick = () => leiFechar();
  if ($("btnLeiFechar2")) $("btnLeiFechar2").onclick = () => leiFechar();
  if ($("btnLeiMaior")) $("btnLeiMaior").onclick = () => {
    leiFonte = Math.min(34, leiFonte + 2); leiTrocarModo(leiModo);
  };
  if ($("btnLeiMenor")) $("btnLeiMenor").onclick = () => {
    leiFonte = Math.max(11, leiFonte - 2); leiTrocarModo(leiModo);
  };
  if ($("leiTexto")) $("leiTexto").addEventListener("input", () => { leiSujo = true; });
}

/* =====================================================================
 * MINHAS DÚVIDAS
 *
 * Marcar em azul o que não se entendeu só serve se der para voltar depois.
 * Espalhadas por vinte resumos, as dúvidas somem — e o que era "vou ver
 * isso" vira "esqueci que não sabia". Aqui elas viram uma lista única,
 * atravessando todos os tópicos e concursos.
 *
 * A lista é DERIVADA do texto, não uma cópia: apagar a marca no resumo tira
 * a dúvida daqui, e nada fica fora de sincronia.
 * ===================================================================== */
function matDuvidas() {
  const fora = [];
  Object.keys(matResumos || {}).forEach((chave) => {
    const r = matResumos[chave];
    if (!r) return;
    [["texto", r.texto], ["lei", r.leiTexto]].forEach(([onde, txt]) => {
      const s = String(txt || "");
      if (!s) return;
      const re = /==\?((?:[^=\n]|=(?!=))+)==/g;
      let mm;
      while ((mm = re.exec(s)) !== null) {
        fora.push({
          chave, onde,
          disciplina: r.disciplina || "", topico: r.topico || "",
          concurso: r.concurso || "",
          trecho: mm[1].replace(/(\*\*|__|_)/g, "").trim(),
          pos: mm.index,
        });
      }
    });
  });
  return fora;
}

/* Resolver = tirar a marca de dúvida, mantendo o texto. Não apaga nada do
 * resumo: a dúvida deixa de ser dúvida, o conteúdo fica. */
function matResolverDuvida(d) {
  const r = matResumos[d.chave];
  if (!r) return false;
  const campo = d.onde === "lei" ? "leiTexto" : "texto";
  const s = String(r[campo] || "");
  const re = /==\?((?:[^=\n]|=(?!=))+)==/g;
  let mm, achou = null;
  while ((mm = re.exec(s)) !== null) {
    if (mm.index === d.pos) { achou = mm; break; }
  }
  if (!achou) return false;
  r[campo] = s.slice(0, achou.index) + achou[1] + s.slice(achou.index + achou[0].length);
  r.tocado = new Date().toISOString();
  matSalvar();
  matReg("duvida", "dúvida marcada como resolvida",
         (d.topico || "?") + " · " + d.trecho.slice(0, 60));
  return true;
}

/* CONSERTO DE NEGRITO QUEBRADO.
 * Até a v8.88, tirar a marca de um trecho que começava com "**negrito**"
 * levava um asterisco junto (o "*" era lido como sufixo de cor). O texto
 * ficava com número ímpar de "*" e a leitura embaralhava dali em diante.
 * Isto encontra as linhas nesse estado e mostra ANTES de mexer. */
/* Marca ABERTA e nunca fechada na mesma linha: "==?Ato Complexo:**" sem o
 * "==" de fecho. A leitura mostra o "==?" literal, como se fosse texto. */
function matMarcaOrfa(linha) {
  const abre = new RegExp("==" + MAT_SUF, "g");
  const fecha = /==/g;
  const total = (String(linha).match(fecha) || []).length;
  return total % 2 === 1;
}

function matNegritoQuebrado(chave) {
  const r = matResumos[chave];
  if (!r) return [];
  const fora = [];
  [["texto", r.texto], ["lei", r.leiTexto]].forEach(([onde, txt]) => {
    String(txt || "").split("\n").forEach((l, k) => {
      const n = (l.match(/\*\*/g) || []).length;
      const soltos = (l.match(/\*/g) || []).length - n * 2;
      const marcaSolta = matMarcaOrfa(l);
      if (n % 2 === 1 || soltos > 0 || marcaSolta)
        fora.push({ onde, linha: k, txt: l.slice(0, 120),
                    negrito: n % 2 === 1 || soltos > 0, marca: marcaSolta });
    });
  });
  return fora;
}

/* Tira os asteriscos órfãos, sem tocar nos pares. Não adivinha onde o
 * negrito deveria terminar: só limpa o que sobrou solto, que é o que
 * atrapalha a leitura. */
function matConsertarNegrito(chave) {
  const r = matResumos[chave];
  if (!r) return 0;
  let n = 0;
  ["texto", "leiTexto"].forEach((campo) => {
    const s = String(r[campo] || "");
    if (!s) return;
    const linhas = s.split("\n").map((l0) => {
      let l = l0;
      /* 1. marca aberta e nunca fechada: tira o abridor. Não inventa onde
       * a marca deveria terminar — inventar seria pintar o que a pessoa
       * não escolheu. */
      if (matMarcaOrfa(l)) {
        l = l.replace(new RegExp("==" + MAT_SUF), "");
        n++;
      }
      const pares = (l.match(/\*\*/g) || []).length;
      const soltos = (l.match(/\*/g) || []).length - pares * 2;
      if (pares % 2 === 0 && soltos === 0) return l;
      n++;
      /* O defeito REMOVIA um asterisco de abertura ("**Ato" virava "*Ato"),
       * então consertar é devolvê-lo — não tirar o par que sobrou. Tirar o
       * "*" solto deixaria "Ato Complexo:**", que continua desequilibrado.
       * A primeira versão deste conserto fazia exatamente isso. */
      return l.replace(/(^|[^*])\*(?!\*)([^*]*\*\*)/, "$1**$2");
    });
    r[campo] = linhas.join("\n");
  });
  if (n) {
    r.tocado = new Date().toISOString();
    matSalvar();
    matReg("conserto", "asteriscos órfãos removidos", n + " linha(s)");
  }
  return n;
}

/* DICAS.
 * Uma dúvida sem resposta é só um lembrete de que você não sabe. A dica é a
 * explicação que você escreve quando finalmente entende — e ela precisa
 * ficar ONDE a dúvida está, senão você a escreve e nunca mais encontra.
 *
 * Guardada no registro do material, atrelada ao TRECHO (não à posição): o
 * texto muda de lugar quando você edita o resumo, o trecho não. */
function matChaveDica(trecho) {
  return String(trecho || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
}

function matDicaDe(chave, trecho) {
  const r = matResumos[chave];
  if (!r || !r.dicas) return null;
  const k = matChaveDica(trecho);
  return r.dicas.find((d) => d.k === k) || null;
}

function matGravarDica(chave, trecho, texto) {
  const r = matResumos[chave];
  if (!r) return null;
  const k = matChaveDica(trecho);
  r.dicas = (r.dicas || []).filter((d) => d.k !== k);
  const limpo = String(texto || "").trim();
  if (limpo) {
    r.dicas.push({ k, trecho: String(trecho).slice(0, 200), texto: limpo,
                   criado: new Date().toISOString() });
  }
  r.tocado = new Date().toISOString();
  matSalvar();
  matReg("dica", limpo ? "dica guardada" : "dica apagada",
         (r.topico || chave) + " · " + String(trecho).slice(0, 50));
  return limpo ? r.dicas[r.dicas.length - 1] : null;
}

/* INCORPORAR: a dica vira parte do resumo, como linha própria logo depois
 * do trecho, marcada com ">" para a leitura desenhá-la como DICA. Sai da
 * lista de dicas soltas e passa a ser texto — que é o destino de uma dica
 * que já se provou útil. */
function matIncorporarDica(chave, trecho, onde) {
  const r = matResumos[chave];
  const d = matDicaDe(chave, trecho);
  if (!r || !d) return false;
  const campo = onde === "lei" ? "leiTexto" : "texto";
  const s = String(r[campo] || "");
  /* acha a linha que contém o trecho, mesmo com marcas em volta */
  const alvoN = matChaveDica(trecho);
  const linhas = s.split("\n");
  const k = linhas.findIndex((l) => matChaveDica(l).indexOf(alvoN) >= 0);
  if (k < 0) return false;
  /* Não checo aqui se já foi incorporada: a dica sai da lista assim que
   * entra no texto, então matDicaDe() acima já devolve null na segunda
   * tentativa. Guardar a checagem seria código que nenhuma sabotagem
   * consegue quebrar — e código assim mente sobre o que protege. */
  linhas.splice(k + 1, 0, "> " + d.texto.replace(/\n+/g, " "));
  r[campo] = linhas.join("\n");
  r.dicas = (r.dicas || []).filter((x) => x.k !== d.k);
  r.tocado = new Date().toISOString();
  matSalvar();
  matReg("dica", "dica incorporada ao resumo",
         (r.topico || chave) + " · linha " + (k + 2));
  return true;
}

function matDuvidasAbrir() {
  const lista = matDuvidas();
  const box = $("duvLista");
  box.innerHTML = "";
  $("duvResumo").textContent = lista.length
    ? t("duv_resumo", { n: lista.length,
        d: new Set(lista.map((x) => x.disciplina)).size })
    : t("duv_vazio");

  lista.forEach((d) => {
    const li = document.createElement("div");
    li.className = "duv-item";
    const tr = document.createElement("div");
    tr.className = "duv-trecho";
    tr.textContent = "“" + d.trecho.slice(0, 220) + "”";
    const onde = document.createElement("div");
    onde.className = "duv-onde";
    onde.textContent = (d.concurso ? d.concurso + " · " : "")
      + (d.disciplina || "?") + " › " + (d.topico || "?")
      + (d.onde === "lei" ? " · " + t("duv_na_lei") : "");
    const ac = document.createElement("div");
    ac.className = "duv-acoes";
    const bAbrir = document.createElement("button");
    bAbrir.type = "button"; bAbrir.className = "btn-min";
    bAbrir.textContent = t("duv_abrir");
    bAbrir.title = t("duv_abrir_ajuda");
    bAbrir.onclick = () => {
      $("dlgDuvidas").close();
      if (d.onde === "lei") leiAbrir(d.disciplina, d.topico);
      else matAbrirEditor({ disciplina: d.disciplina, nome: d.topico }, false);
    };
    const bOk = document.createElement("button");
    bOk.type = "button"; bOk.className = "btn-min btn-min-ok";
    bOk.textContent = t("duv_resolvida");
    bOk.title = t("duv_resolvida_ajuda");
    bOk.onclick = async () => {
      if (!(await uiConfirm(t("duv_conf", { t: d.trecho.slice(0, 90) })))) return;
      matResolverDuvida(d);
      matDuvidasAbrir();
      try { matRender(); } catch (e) {}
    };
    /* DICA: escrever a explicação, ver a que já existe, e incorporá-la */
    const jaTem = matDicaDe(d.chave, d.trecho);
    const bDica = document.createElement("button");
    bDica.type = "button"; bDica.className = "btn-min";
    bDica.textContent = t(jaTem ? "duv_dica_editar" : "duv_dica_incluir");
    bDica.title = t("duv_dica_ajuda");
    bDica.onclick = async () => {
      const txt = await uiTexto(t("duv_dica_tit", { t: d.trecho.slice(0, 90) }),
        jaTem ? jaTem.texto : "");
      if (txt === null) return;
      matGravarDica(d.chave, d.trecho, txt);
      matDuvidasAbrir();
    };
    ac.append(bAbrir, bDica);
    if (jaTem) {
      const bInc = document.createElement("button");
      bInc.type = "button"; bInc.className = "btn-min btn-min-ok";
      bInc.textContent = t("duv_dica_incorporar");
      bInc.title = t("duv_dica_incorporar_ajuda");
      bInc.onclick = async () => {
        if (!(await uiConfirm(t("duv_dica_inc_conf", { t: jaTem.texto.slice(0, 120) })))) return;
        const ok2 = matIncorporarDica(d.chave, d.trecho, d.onde);
        if (!ok2) { uiAlert(t("duv_dica_inc_erro")); return; }
        matDuvidasAbrir();
        try { matRender(); } catch (e) {}
      };
      ac.append(bInc);
    }
    ac.append(bOk);
    li.append(tr, onde, ac);
    if (jaTem) {
      const box = document.createElement("div");
      box.className = "duv-dica";
      box.textContent = jaTem.texto;
      li.append(box);
    }
    box.append(li);
  });
  abrirModal("dlgDuvidas");
  matReg("duvida", "lista de dúvidas aberta", lista.length + " dúvidas");
}
