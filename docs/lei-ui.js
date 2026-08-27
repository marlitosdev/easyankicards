/* =====================================================================
 * A TELA DA LEI SECA
 *
 * A anterior era uma caixa de texto e dois botões. Esta parte de outra
 * pergunta: o que muda quando o app SABE que aquilo é uma lei?
 *
 *   · sabe onde você parou, e diz em artigo ("parei no art. 35"), não em
 *     posição de rolagem — que morre ao mudar a fonte ou o aparelho;
 *   · sabe de onde o texto veio e de quando é, porque lei muda e estudar
 *     redação revogada é pior que não estudar;
 *   · sabe partir a leitura em capítulos, porque 115 artigos não são uma
 *     sessão de estudo;
 *   · sabe esconder o texto e mostrar só a ementa, que é como se confere
 *     se a lei foi realmente aprendida;
 *   · sabe qual artigo mais aparece nas SUAS questões, e quantas você
 *     errou nele.
 *
 * O texto mora na biblioteca (lei-seca.js). Aqui só existe tela.
 * ===================================================================== */

let leiAtual = null;        /* {disciplina, topico, chave} */
let leiIdAtual = "";        /* qual lei da biblioteca está aberta */
let leiModo = "ler";        /* ler | editar | recitar */
let leiSujo = false;
let leiFonte = 15;
let leiRecitados = {};      /* artigos já revelados no modo recitar */
let leiBlocoAberto = "";
let leiCheia = false;       /* leitura ocupando a janela inteira */

function leiModoAtual() { return leiModo; }

/* ---------------------------------------------------------------------
 * REGISTRO PRÓPRIO
 *
 * O registro dos resumos já existe e mistura tudo o que acontece no
 * material. Quando algo falha DENTRO da lei — uma marca que não pegou,
 * um artigo que o leitor não reconheceu, um cartão que não entrou — é
 * preciso garimpar entre centenas de linhas de outra coisa.
 *
 * Aqui fica só o que aconteceu na lei, com a lei e o artigo em cada
 * linha, e com os erros separados. Dois filtros, porque são as duas
 * perguntas que se faz: "o que eu fiz hoje?" e "o que deu errado?".
 * ------------------------------------------------------------------ */

const LEI_LOG_CHAVE = "eac_lei_log";
const LEI_LOG_MAX = 300;
let leiLog = [];
let leiLogSoHoje = true;    /* começa em HOJE: é o caso comum */
let leiLogSoErros = false;

function leiLogCarregar() {
  try { leiLog = JSON.parse(localStorage.getItem(LEI_LOG_CHAVE) || "[]"); }
  catch (e) { leiLog = []; }
  if (!Array.isArray(leiLog)) leiLog = [];
}

function leiReg(tipo, oque, detalhe) {
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  leiLog.push({
    q: new Date().toISOString(),
    t: String(tipo || ""),
    o: String(oque || ""),
    d: String(detalhe == null ? "" : detalhe).slice(0, 240),
    lei: (l && l.nome) || "",
    top: (leiAtual && leiAtual.topico) || "",
    modo: leiModo,
  });
  while (leiLog.length > LEI_LOG_MAX) leiLog.shift();
  try { localStorage.setItem(LEI_LOG_CHAVE, JSON.stringify(leiLog)); } catch (e) {}
  /* continua indo para o registro do material também: quem procura por
   * lá não pode deixar de encontrar */
  try { matReg("lei", oque, detalhe); } catch (e) {}
}

/* TODO BOTÃO DA LEI PASSA POR AQUI.
 * Mesma razão do matBotao: erro dentro de um handler morre no console
 * do navegador, que ninguém abre, e o registro fica mudo justamente no
 * evento que interessa. Envolvendo, a falha vira uma linha com o NOME
 * do botão — que é o que a pessoa consegue relatar. */
function leiBotao(id, nome, acao) {
  const b = $(id);
  if (!b) return;
  b.onclick = function () {
    try {
      const r = acao.apply(this, arguments);
      if (r && typeof r.catch === "function") {
        r.catch((e) => leiReg("erro", "falha em " + nome,
          (e && e.message) || String(e)));
      }
      return r;
    } catch (e) {
      leiReg("erro", "falha em " + nome, (e && e.message) || String(e));
      try { uiAlert(t("lei_erro_botao", { b: nome })); } catch (x) {}
    }
  };
}

function leiLogDiaLocal(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
    + "-" + String(x.getDate()).padStart(2, "0");
}

function leiLogHojeISO() { return leiLogDiaLocal(new Date()); }

/* O DIA É O DIA DA PESSOA, NÃO O DE GREENWICH.
 * O carimbo é gravado em ISO (UTC); "hoje" é o dia do relógio dela. No
 * Brasil, a partir das 21h os dois divergem — e o filtro de hoje,
 * comparando as duas coisas como texto, mostrava ZERO linhas justamente
 * no horário em que mais se estuda. O registro parecia não registrar. */
function leiLogFiltrado() {
  const hoje = leiLogHojeISO();
  return leiLog.filter((x) => {
    if (leiLogSoErros && x.t !== "erro") return false;
    if (leiLogSoHoje && leiLogDiaLocal(x.q) !== hoje) return false;
    return true;
  });
}

function leiLogTexto() {
  const lista = leiLogFiltrado();
  if (!lista.length) return t("lei_log_vazio");
  return lista.map((x) => {
    const d = new Date(x.q);
    const h = isNaN(d.getTime()) ? "--:--:--" : d.toTimeString().slice(0, 8);
    const dia = leiLogDiaLocal(x.q);
    return (leiLogSoHoje ? h : dia + " " + h)
      + "  [" + (x.t || "?") + "] " + (x.o || "")
      + (x.d ? "  — " + x.d : "")
      + (x.lei ? "  (" + x.lei + (x.top ? " · " + x.top : "") + ")" : "");
  }).join("\n");
}

function leiLogPintar() {
  if (!$("leiLogTexto")) return;
  $("leiLogTexto").value = leiLogTexto();
  const erros = leiLog.filter((x) => x.t === "erro").length;
  const hoje = leiLog.filter((x) =>
    leiLogDiaLocal(x.q) === leiLogHojeISO()).length;
  /* O RESUMO DIZ O QUE O FILTRO ESTÁ ESCONDENDO.
   * Sem isto, "0 linhas" com o filtro de hoje ligado parece registro
   * vazio — e a pessoa conclui que o app não registra nada. */
  $("leiLogResumo").textContent = t("lei_log_resumo", {
    v: leiLogFiltrado().length, tot: leiLog.length, hoje, erros,
  });
  const bh = $("btnLeiLogHoje");
  if (bh && bh.classList) bh.classList.toggle("btn-min-ok", leiLogSoHoje);
  const be = $("btnLeiLogErros");
  if (be && be.classList) be.classList.toggle("btn-min-ok", leiLogSoErros);
  /* erro é o único estado que merece cor: é o que se procura */
  if (be && be.classList) be.classList.toggle("btn-min-perigo", erros > 0);
}

function leiLogAbrir() {
  leiLogPintar();
  abrirModal("dlgLeiLog");
}

/* ---------------------------------------------------------------------
 * QUAL LEI ESTÁ ABERTA
 * ------------------------------------------------------------------ */

/* A lei preferida do tópico é a que ele apontou; na falta, a primeira
 * ligada a ele. O ponteiro fica no tópico, o texto fica na lei — é o
 * contrário de antes, e é o que impede cinco cópias da 4.320. */
function leiDoTopicoAtual(chave) {
  const r = (typeof matResumos !== "undefined" && matResumos[chave]) || {};
  if (r.leiId && leiDe(r.leiId)) return leiDe(r.leiId);
  const lista = leisDoTopico(chave);
  return lista[0] || null;
}

function leiTem(chave) {
  const r = (typeof matResumos !== "undefined" && matResumos[chave]) || null;
  /* o campo antigo continua valendo enquanto não for migrado: quem tem
   * lei colada na versão anterior não pode ver o botão apagar */
  if (r && String(r.leiTexto || "").trim()) return true;
  const l = leiDoTopicoAtual(chave);
  return !!(l && String(l.texto || "").trim());
}

/* PONTES PARA O RESTO DO APP.
 * As marcas, as dúvidas e o "abrir onde está" perguntam pelo texto da
 * lei de um tópico. Antes iam direto ao registro; agora passam por aqui,
 * que sabe se a lei está na biblioteca ou ainda no campo antigo. */
function leiTextoDoTopico(chave) {
  if (leiAtual && leiAtual.chave === chave
      && $("dlgLeiSeca") && $("dlgLeiSeca").open && $("leiTexto")) {
    return String($("leiTexto").value || "");
  }
  const l = leiDoTopicoAtual(chave);
  if (l) return String(l.texto || "");
  const r = (typeof matResumos !== "undefined" && matResumos[chave]) || {};
  return String(r.leiTexto || "");
}

function leiAplicarNoTopico(chave, novo) {
  const l = leiDoTopicoAtual(chave);
  if (l) leiGuardar({ id: l.id, texto: novo });
  else if (typeof matResumos !== "undefined" && matResumos[chave]) {
    matResumos[chave].leiTexto = novo;
    matSalvar();
  }
  if (leiAtual && leiAtual.chave === chave
      && $("dlgLeiSeca") && $("dlgLeiSeca").open && $("leiTexto")) {
    $("leiTexto").value = novo;
    leiSujo = false;
    leiPintar();
  }
  return true;
}

/* ---------------------------------------------------------------------
 * ABRIR
 * ------------------------------------------------------------------ */

function leiAbrir(disciplina, topico, id) {
  leiAtual = { disciplina, topico, chave: matChave(disciplina, topico) };
  /* migra na primeira abertura: quem tinha lei colada no campo antigo
   * encontra a mesma lei aqui, sem precisar refazer nada */
  try { leisMigrarDe(typeof matResumos !== "undefined" ? matResumos : {}); }
  catch (e) {}

  const l = id ? leiDe(id) : leiDoTopicoAtual(leiAtual.chave);
  leiIdAtual = l ? l.id : "";
  leiRecitados = {};
  leiBlocoAberto = "";
  leiSujo = false;

  $("leiTexto").value = l ? String(l.texto || "") : "";
  leiTrocarModo(l && String(l.texto || "").trim() ? "ler" : "editar");
  leiPintar();
  abrirModal("dlgLeiSeca");
  try { leiReg("lei", "lei seca aberta", topico + " · "
      + (l ? l.nome + " · " + leiArtigos(l.texto).length + " artigos"
           : "nenhuma lei ligada ainda"));
  } catch (e) {}
}

/* ---------------------------------------------------------------------
 * PINTAR
 * ------------------------------------------------------------------ */

function leiPintar() {
  if (!leiAtual) return;
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const r = (typeof matResumos !== "undefined" && matResumos[leiAtual.chave]) || {};

  $("leiTitulo").textContent = l ? l.nome : t("lei_titulo", { tp: leiAtual.topico });
  $("leiSub").textContent = [r.concurso, leiAtual.disciplina, leiAtual.topico]
    .filter(Boolean).join(" · ");

  leiPintarFila();
  leiPintarProcedencia();
  leiPintarOnde();
  leiPintarBlocos();
  leiJanelaAplicar();
  leiCheiaAplicar();
  if (leiModo !== "editar") leiTrocarModo(leiModo);
}

/* A FILA DE LEIS DO TÓPICO.
 * Um tópico pode ser servido por mais de uma lei (despesa pública é
 * 4.320 E a LRF). Trocar entre elas tem de ser um clique, e a fila diz
 * quantos artigos cada uma tem — que é a diferença entre "a lei inteira"
 * e "o artigo que eu colei com pressa". */
function leiPintarFila() {
  const cx = $("leiFila");
  if (!cx) return;
  cx.innerHTML = "";
  const lista = leisDoTopico(leiAtual.chave);

  lista.forEach((l) => {
    const b = document.createElement("button");
    b.className = "lei-chip" + (l.id === leiIdAtual ? " lei-chip-on" : "");
    const p = leiProgresso(l.id) || { total: 0, pct: 0 };
    b.textContent = l.nome + " · " + t("lei_n_artigos", { n: p.total })
      + (p.pct ? " · " + p.pct + "%" : "");
    b.title = t("lei_chip_ajuda", { n: (l.topicos || []).length });
    b.onclick = () => leiTrocarPara(l.id);
    cx.append(b);
  });

  const bNova = document.createElement("button");
  bNova.className = "lei-chip lei-chip-add";
  bNova.id = "btnLeiNova";
  bNova.textContent = t("lei_colar_nova");
  bNova.title = t("lei_colar_nova_ajuda");
  bNova.onclick = () => leiNovaAbrir();
  cx.append(bNova);

  /* vincular uma lei que já está na biblioteca é o gesto que faz a
   * reforma valer: a 4.320 do tópico de receita serve o de despesa sem
   * ser colada de novo */
  const outras = leisLista().filter((l) =>
    !(l.topicos || []).some((c) => leisChaveComparavel(c)
      === leisChaveComparavel(leiAtual.chave)));
  if (outras.length) {
    const bV = document.createElement("button");
    bV.className = "lei-chip lei-chip-add";
    bV.textContent = t("lei_vincular", { n: outras.length });
    bV.title = t("lei_vincular_ajuda");
    bV.onclick = () => leiVincularAbrir();
    cx.append(bV);
  }
}

/* PROCEDÊNCIA — de onde veio e de quando é.
 *
 * Lei muda. A EC 126/2022 apareceu nas questões do usuário; um texto
 * colado antes dela está errado e não tem como saber olhando. Guardar o
 * link e a data da consulta não impede o texto de envelhecer — mas faz o
 * envelhecimento aparecer, que é tudo o que se pode fazer sem internet. */
const LEI_DIAS_VELHA = 180;

function leiPintarProcedencia() {
  const cx = $("leiProc");
  if (!cx) return;
  cx.innerHTML = "";
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  if (!l) { cx.hidden = true; return; }
  cx.hidden = false;

  if (l.fonte) {
    const a = document.createElement("a");
    a.href = l.fonte;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "lei-fonte";
    a.textContent = t("lei_fonte_abrir");
    a.title = l.fonte;
    cx.append(a);
  }

  const d = document.createElement("span");
  d.className = "lei-proc-txt";
  if (l.consultadaEm) {
    const dias = Math.round(
      (Date.now() - new Date(l.consultadaEm + "T12:00:00").getTime()) / 86400000);
    d.textContent = t("lei_consultada", { d: l.consultadaEm })
      + (l.versao ? " · " + l.versao : "");
    if (dias > LEI_DIAS_VELHA) {
      d.classList.add("lei-velha");
      d.textContent += " · " + t("lei_velha", { n: dias });
    }
  } else {
    d.classList.add("lei-velha");
    d.textContent = t("lei_sem_procedencia");
  }
  cx.append(d);

  const b = document.createElement("button");
  b.className = "btn-min";
  b.textContent = t("lei_procedencia_editar");
  b.title = t("lei_procedencia_ajuda");
  b.onclick = () => leiProcAbrir();
  cx.append(b);
}

/* ONDE PAREI — em artigo, e com o botão de continuar dali. */
function leiPintarOnde() {
  const cx = $("leiOnde");
  if (!cx) return;
  cx.innerHTML = "";
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const p = l ? leiProgresso(l.id) : null;
  if (!p || !p.total) { cx.hidden = true; return; }
  cx.hidden = false;

  const barra = document.createElement("div");
  barra.className = "lei-barra";
  const dentro = document.createElement("div");
  dentro.className = "lei-barra-in";
  dentro.style.width = p.pct + "%";
  barra.append(dentro);

  /* O TEXTO É O ATALHO.
   * Dizer "parei no art. 35" e obrigar a pessoa a procurar o art. 35 na
   * rolagem é dar a informação e cobrar o trabalho. O rótulo já nomeia o
   * destino; ele mesmo leva até lá. */
  const txt = document.createElement(p.lidos ? "button" : "span");
  txt.className = "lei-onde-txt" + (p.lidos ? " lei-onde-ir" : "");
  txt.textContent = p.lidos
    ? t("lei_parei_em", { a: p.artigo, n: p.lidos, tot: p.total, p: p.pct })
    : t("lei_nao_comecou", { tot: p.total });
  if (p.lidos) {
    txt.title = t("lei_ir_ao_marcador", { a: p.artigo });
    txt.onclick = () => { leiTrocarModo("ler"); leiIrArtigo(p.artigo); };
  }

  cx.append(barra, txt);

  if (p.proximo) {
    const b = document.createElement("button");
    b.className = "btn-min btn-min-ok";
    b.textContent = t("lei_continuar", { a: p.proximo.numCru });
    b.title = t("lei_continuar_ajuda");
    b.onclick = () => { leiTrocarModo("ler"); leiIrArtigo(p.proximo.num); };
    cx.append(b);
  }
}

/* BLOCOS — ler por capítulo, com o tempo de cada um. */
function leiPintarBlocos() {
  const cx = $("leiBlocosCx");
  if (!cx) return;
  cx.innerHTML = "";
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  if (!l) return;
  const blocos = leiBlocos(l.texto);
  const lidos = l.blocos || {};

  const cab = document.createElement("div");
  cab.className = "nota";
  cab.textContent = t("lei_blocos_ajuda", {
    n: blocos.length,
    lidos: blocos.filter((b) => lidos[b.nome]).length,
  });
  cx.append(cab);

  blocos.forEach((b) => {
    const linha = document.createElement("div");
    linha.className = "lei-bloco" + (lidos[b.nome] ? " lei-bloco-lido" : "");

    const nome = document.createElement("button");
    nome.className = "lei-bloco-nome";
    nome.textContent = b.nome;
    nome.title = t("lei_bloco_ir", { de: b.de, ate: b.ate });
    nome.onclick = () => {
      leiBlocoAberto = b.nome;
      leiTrocarModo(leiModo === "recitar" ? "recitar" : "ler");
      leiIrArtigo(b.de);
    };

    const meta = document.createElement("span");
    meta.className = "lei-bloco-meta";
    meta.textContent = t("lei_bloco_meta", { n: b.quantos, min: b.minutos });

    const chk = document.createElement("button");
    chk.className = "btn-min" + (lidos[b.nome] ? " btn-min-ok" : "");
    chk.textContent = lidos[b.nome] ? t("lei_bloco_lido", { d: lidos[b.nome] })
                                    : t("lei_bloco_marcar");
    chk.title = t("lei_bloco_marcar_ajuda");
    chk.onclick = () => {
      leiBlocoLido(l.id, b.nome, !lidos[b.nome]);
      /* marcar o capítulo lido move o marcador para o último artigo
       * dele: as duas coisas dizem a mesma verdade, e deixá-las
       * discordando é o começo de "o app não sabe onde eu estou" */
      if (!lidos[b.nome]) leiParar(l.id, b.ate);
      try { leiReg("bloco", (lidos[b.nome] ? "capítulo desmarcado" : "capítulo lido"),
               l.nome + " · " + b.nome);
      } catch (e) {}
      leiPintar();
    };

    linha.append(nome, meta, chk);
    cx.append(linha);
  });
}

/* ---------------------------------------------------------------------
 * MODOS DE LEITURA
 * ------------------------------------------------------------------ */

/* ---------------------------------------------------------------------
 * LER MAIOR — tela cheia e letra que fica
 *
 * Ler lei é a atividade mais longa que este app abriga: são dezenas de
 * minutos de olho no texto. E era justamente a que tinha menos espaço —
 * a fila de leis, a procedência, o marcador, a barra de modos, a barra
 * de marcas e a lista de capítulos empurravam a lei para uma faixa de
 * poucos centímetros, com barra de rolagem própria.
 *
 * Tudo isso é referência, e referência só serve ANTES e DEPOIS de ler.
 * Na tela cheia some tudo o que não é a lei; a saída é um clique, e o
 * marcador continua onde estava.
 *
 * O tamanho da letra é guardado. Quem aumenta a letra tem um motivo que
 * não muda de uma sessão para outra, e refazer o ajuste toda vez é o
 * tipo de atrito que faz a pessoa desistir do recurso.
 * ------------------------------------------------------------------ */

const LEI_FONTE_CHAVE = "eac_lei_fonte";

/* A LETRA É UM GRADIENTE, NÃO UM MENU.
 *
 * Cheguei a pôr uma lista de tamanhos com nome — pequeno, médio,
 * grande, enorme, gigante. Era resposta para a pergunta errada. Quem
 * mexe na letra quer um degrau a mais ou a menos do que está vendo, e
 * decide olhando; nomear os degraus só acrescentou sete botões e a
 * necessidade de traduzir "muito grande" para pixels na cabeça.
 *
 * O A+/A− já era a forma certa. O que faltava era o OUTRO eixo — o
 * tamanho da janela —, e é isso que está logo abaixo. */
const LEI_FONTE_MIN = 13;
const LEI_FONTE_MAX = 56;

function leiFonteCarregar() {
  try {
    const v = Number(localStorage.getItem(LEI_FONTE_CHAVE));
    if (v >= LEI_FONTE_MIN && v <= LEI_FONTE_MAX) leiFonte = v;
  } catch (e) {}
}

function leiFonteDefinir(px) {
  const v = Number(px) || 15;
  leiFonte = Math.max(LEI_FONTE_MIN, Math.min(LEI_FONTE_MAX, v));
  try { localStorage.setItem(LEI_FONTE_CHAVE, String(leiFonte)); } catch (e) {}
  leiTrocarModo(leiModo);
  leiReg("leitura", "tamanho da letra", leiFonte + "px");
}

function leiFonteMudar(delta) {
  leiFonteDefinir(leiFonte + (delta > 0 ? 2 : -2));
}

/* ---------------------------------------------------------------------
 * O TAMANHO DA JANELA
 *
 * Aumentar a letra e aumentar a janela resolvem coisas diferentes, e eu
 * tinha confundido as duas. Letra maior serve a quem tem dificuldade de
 * enxergar; janela maior serve a quem tem tela sobrando — e num monitor
 * de 27 polegadas a lei estava sendo lida numa coluna do tamanho de um
 * celular, com o resto da tela em branco.
 *
 * São quatro larguras, e a última usa a tela inteira. A altura cresce
 * junto: janela larga e baixa continuaria pedindo rolagem a cada dois
 * artigos.
 *
 * A COLUNA DE TEXTO TEM UM LIMITE PRÓPRIO, em "em" e não em pixels: 62
 * vezes a altura da letra. Assim ela cresce quando a letra cresce, e
 * numa janela muito larga com letra pequena o excedente vira margem em
 * vez de virar linha de 200 caracteres — que ninguém consegue seguir
 * sem perder onde estava ao voltar para a esquerda.
 * ------------------------------------------------------------------ */

const LEI_JANELA_CHAVE = "eac_lei_janela";
const LEI_JANELAS = ["estreita", "media", "larga", "maxima"];
let leiJanela = 1;          /* índice em LEI_JANELAS */

function leiJanelaCarregar() {
  try {
    const cru = localStorage.getItem(LEI_JANELA_CHAVE);
    /* AUSENTE NÃO É ZERO. Number(null) vale 0, e 0 é um índice válido
     * aqui — então quem nunca escolheu nada abriria sempre na janela mais
     * estreita, achando que esse é o tamanho normal do aplicativo. */
    if (cru === null || cru === "") return;
    const v = Number(cru);
    if (Number.isFinite(v) && v >= 0 && v < LEI_JANELAS.length) leiJanela = v;
  } catch (e) {}
}

function leiJanelaAplicar() {
  const dlg = $("dlgLeiSeca");
  if (dlg && dlg.classList) {
    LEI_JANELAS.forEach((nome, i) => {
      dlg.classList.toggle("lei-j-" + nome, i === leiJanela);
    });
  }
  const menos = $("btnLeiJanelaMenos");
  const mais = $("btnLeiJanelaMais");
  /* desligar o botão que não tem para onde ir é mais honesto que deixá-lo
   * clicável sem efeito — o clique sem resposta parece defeito */
  if (menos) menos.disabled = leiJanela <= 0;
  if (mais) mais.disabled = leiJanela >= LEI_JANELAS.length - 1;
  const rot = $("leiJanelaNome");
  if (rot) rot.textContent = t("lei_janela_" + LEI_JANELAS[leiJanela]);
}

function leiJanelaMudar(delta) {
  const novo = Math.max(0, Math.min(LEI_JANELAS.length - 1,
    leiJanela + (delta > 0 ? 1 : -1)));
  if (novo === leiJanela) return;
  leiJanela = novo;
  try { localStorage.setItem(LEI_JANELA_CHAVE, String(leiJanela)); } catch (e) {}
  leiJanelaAplicar();
  leiReg("leitura", "tamanho da janela", LEI_JANELAS[leiJanela]);
}

/* UM LUGAR SÓ decide o que é referência e o que é lei.
 * Espalhar "esconde isto, mostra aquilo" por três funções foi como o
 * app já chegou uma vez a um estado em que a barra de marcas ficava
 * visível no modo errado. Aqui a regra é uma linha por elemento. */
function leiCheiaAplicar() {
  const dlg = $("dlgLeiSeca");
  if (dlg && dlg.classList) dlg.classList.toggle("lei-cheia", leiCheia);

  const ref = ["leiFila", "leiSub"];
  ref.forEach((id) => { const el = $(id); if (el) el.hidden = leiCheia; });
  /* procedência e marcador já se escondem sozinhos quando não há o que
   * mostrar; na tela cheia somem de qualquer forma */
  if (leiCheia) {
    ["leiProc", "leiOnde", "leiBlocosCx"].forEach((id) => {
      const el = $(id); if (el) el.hidden = true;
    });
  }
  const mc = $("leiMarcas");
  if (mc) mc.hidden = leiCheia || leiModo !== "ler";

  const b = $("btnLeiCheia");
  if (b) {
    b.textContent = t(leiCheia ? "lei_cheia_sair" : "lei_cheia");
    if (b.classList) b.classList.toggle("btn-min-ok", leiCheia);
  }
}

function leiCheiaTrocar(sim) {
  leiCheia = sim === undefined ? !leiCheia : !!sim;
  if (leiCheia) { leiCheiaAplicar(); leiTrocarModo(leiModo); }
  else leiPintar();          /* leiPintar já chama leiCheiaAplicar */
  leiReg("leitura", leiCheia ? "leitura ampliada" : "leitura normal", "");
}

/* Abre uma gaveta e fecha a outra. */
function leiGaveta(qual) {
  const gavetas = ["leiGavNavegar", "leiGavExibir"];
  const alvo = $(qual);
  const abrindo = alvo ? alvo.hidden !== false : false;
  gavetas.forEach((id) => {
    const el = $(id);
    if (el) el.hidden = !(abrindo && id === qual);
  });
  [["btnLeiNavegar", "leiGavNavegar"], ["btnLeiExibir", "leiGavExibir"]]
    .forEach(([bid, gid]) => {
      const b = $(bid);
      const g = $(gid);
      if (b && b.classList) b.classList.toggle("btn-min-ok", !!(g && g.hidden === false));
    });
  return abrindo;
}

function leiTrocarModo(modo) {
  leiModo = ["ler", "editar", "recitar"].indexOf(modo) >= 0 ? modo : "ler";
  const ed = leiModo === "editar";
  const rec = leiModo === "recitar";
  $("leiTexto").hidden = !ed;
  $("leiLeitura").hidden = ed || rec;
  if ($("leiRecitar")) $("leiRecitar").hidden = !rec;
  /* na tela cheia a barra de marcas some junto: ela é ferramenta de
   * quem está trabalhando o texto, não de quem está lendo */
  if ($("leiMarcas")) $("leiMarcas").hidden = ed || rec || leiCheia;

  [["btnLeiModoLer", "ler"], ["btnLeiModoEditar", "editar"],
   ["btnLeiModoRecitar", "recitar"]].forEach(([id, m]) => {
    const b = $(id);
    if (b && b.classList) b.classList.toggle("btn-min-ok", leiModo === m);
  });

  if (leiModo === "ler") leiPintarLeitura();
  if (rec) leiPintarRecitar();
}

/* A LEITURA, ARTIGO A ARTIGO.
 * Cada artigo vira um bloco com âncora própria — é o que permite rolar
 * até ele, marcar "parei aqui" e gerar lacuna só dele. Um texto corrido
 * não permitiria nenhuma das três. */
function leiPintarLeitura() {
  const cx = $("leiLeitura");
  if (!cx) return;
  cx.innerHTML = "";
  cx.style.fontSize = leiFonte + "px";
  const bruto = String($("leiTexto").value || "");
  const arts = leiArtigos(bruto);
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const parei = l ? l.parei : "";
  /* a estatística é calculada UMA vez para a lei inteira: fazer a conta
   * dentro do laço releria o banco de questões a cada artigo */
  const ranking = {};
  try { leiRanking(leiIdAtual).forEach((r) => { ranking[r.num] = r; }); }
  catch (e) {}

  if (!arts.length) {
    const p = document.createElement("p");
    p.className = "nota";
    /* texto colado que não tem artigo nenhum ainda é texto: mostrar o
     * que existe é melhor que uma tela vazia dizendo "cole a lei" */
    p.innerHTML = matParaHtml(bruto) || t("lei_vazia");
    cx.append(p);
    return;
  }

  let divisao = "";
  arts.forEach((a) => {
    if (a.divisao && a.divisao !== divisao) {
      divisao = a.divisao;
      const h = document.createElement("div");
      h.className = "lei-div";
      h.textContent = divisao;
      cx.append(h);
    }

    const bloco = document.createElement("div");
    bloco.className = "lei-art" + (a.num === parei ? " lei-art-parei" : "");
    bloco.id = "leiArt_" + a.num.replace(/[^A-Z0-9-]/gi, "");

    const cab = document.createElement("div");
    cab.className = "lei-art-cab";

    /* O NÚMERO DO ARTIGO É O MARCADOR.
     *
     * Antes havia um botão "parei aqui" em CADA artigo. Numa lei de 115
     * artigos isso são 115 alvos disputando espaço com o texto — e o
     * cabeçalho de cada artigo ficava mais pesado que alguns artigos.
     *
     * O número já estava lá, já é único, já é o endereço. Clicar nele
     * marca. Zero elementos novos na tela, mesma capacidade. */
    const rot = document.createElement("button");
    rot.className = "lei-art-num" + (a.num === parei ? " lei-art-num-parei" : "");
    rot.textContent = a.rotulo + (a.num === parei ? " " + t("lei_aqui_sinal") : "");
    rot.title = a.num === parei ? t("lei_aqui_ajuda") : t("lei_parar_aqui_ajuda");
    rot.onclick = () => {
      /* clicar de novo no artigo já marcado TIRA o marcador: sem isso, a
       * única forma de desmarcar seria marcar outro artigo qualquer */
      leiParar(leiIdAtual, a.num === parei ? "" : a.num);
      leiPintar();
    };
    cab.append(rot);

    const bCloze = document.createElement("button");
    bCloze.className = "btn-min lei-art-b";
    bCloze.textContent = t("lei_cloze_art");
    bCloze.title = t("lei_cloze_art_ajuda");
    bCloze.onclick = () => leiClozeAbrir(a);

    /* editar ESTE artigo, sem abrir a lei inteira num campo de texto */
    const bEd = document.createElement("button");
    bEd.className = "btn-min lei-art-b";
    bEd.textContent = t("lei_art_editar");
    bEd.title = t("lei_art_editar_ajuda");
    bEd.onclick = () => leiEdAbrir(a.num);

    cab.append(bCloze, bEd);

    const corpo = document.createElement("div");
    corpo.className = "lei-art-txt";
    corpo.innerHTML = matParaHtml(a.texto);

    bloco.append(cab, corpo);

    /* AVISO DO ARTIGO QUE MAIS CAI.
     * O ranking já existia, mas numa janela à parte — e quem está lendo a
     * lei não vai abrir outra tela para conferir se aquele artigo é
     * cobrado. A informação tem de estar onde o olho já está: embaixo do
     * artigo, no momento em que ele está sendo lido.
     *
     * O texto é deliberadamente modesto. Não diz "este é dos mais
     * cobrados do país" — a amostra é o banco de questões da própria
     * pessoa, e prometer mais do que se sabe é o começo de estudar a
     * coisa errada com confiança. */
    const est = ranking[a.num];
    if (est) {
      const av = document.createElement("div");
      av.className = "lei-art-cai"
        + (est.erros > est.acertos ? " lei-art-cai-erro" : "");
      const partes = [];
      if (est.questoes) partes.push(t("lei_cai_questoes", { n: est.questoes }));
      if (est.prova) partes.push(t("lei_cai_prova", { n: est.prova }));
      if (est.erros || est.acertos) {
        partes.push(t("lei_cai_placar", { e: est.erros, a: est.acertos }));
      }
      if (est.incisos.length) {
        partes.push(t("lei_cai_incisos", { i: est.incisos.join(", ") }));
      }
      av.textContent = t("lei_cai_aviso") + " " + partes.join(" · ");
      bloco.append(av);
    }

    cx.append(bloco);
  });
}

/* ---------------------------------------------------------------------
 * EDITAR UM ARTIGO
 *
 * A edição era uma caixa de texto com a lei inteira dentro. Para trocar
 * a redação do art. 35 numa lei de 115 artigos era preciso rolar até
 * achar, mexer no meio de cinco mil palavras e torcer para não ter
 * apagado o vizinho — sem contar as marcas coloridas espalhadas pelo
 * texto, que somem junto com o trecho errado sem avisar.
 *
 * Aqui a unidade de edição é o artigo, porque é a unidade em que a lei
 * muda. Uma emenda troca a redação de UM artigo, ou acrescenta UM artigo
 * — nunca "reescreve o arquivo". A janela mostra só aquele pedaço, e o
 * resto do texto é intocado por construção: a substituição é feita por
 * endereço de linha, não por busca e troca.
 *
 * A caixa com a lei inteira continua existindo, para colar uma lei nova
 * de uma vez. Ela deixou de ser o único caminho, que era o problema.
 * ------------------------------------------------------------------ */

let leiEdNum = "";          /* "" = artigo novo */

function leiEdAbrir(num) {
  if (!$("dlgLeiArt")) return;
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const texto = String($("leiTexto").value || "");
  leiEdNum = num ? leiNumNormal(num) : "";

  const arts = leiArtigos(texto);
  const a = leiEdNum ? arts.filter((x) => x.num === leiEdNum)[0] : null;

  $("leiArtTitulo").textContent = a
    ? t("lei_art_ed_titulo", { a: a.rotulo })
    : t("lei_art_novo_titulo");
  $("leiArtSub").textContent = a
    ? [(l && l.nome) || "", a.divisao].filter(Boolean).join(" · ")
    : t("lei_art_novo_ajuda");
  $("leiArtTexto").value = a ? a.texto : "";
  $("leiArtAviso").textContent = "";
  $("btnLeiArtApagar").hidden = !a;

  /* a lista de artigos ao lado: trocar de artigo sem fechar e reabrir */
  const cx = $("leiArtLista");
  if (cx) {
    cx.innerHTML = "";
    arts.forEach((x) => {
      const b = document.createElement("button");
      b.className = "lei-art-item" + (x.num === leiEdNum ? " lei-art-item-on" : "");
      b.textContent = x.rotulo + (x.ementa ? " — " + x.ementa : "");
      b.title = x.divisao || "";
      b.onclick = () => leiEdTrocar(x.num);
      cx.append(b);
    });
    const bNovo = document.createElement("button");
    bNovo.className = "lei-art-item lei-art-item-novo";
    bNovo.textContent = t("lei_art_novo");
    bNovo.title = t("lei_art_novo_ajuda");
    bNovo.onclick = () => leiEdTrocar("");
    cx.append(bNovo);
  }

  abrirModal("dlgLeiArt");
  leiReg("editar", a ? "edição de artigo aberta" : "artigo novo",
         a ? a.rotulo : "");
}

/* Trocar de artigo dentro da janela SEM perder o que foi digitado sem
 * querer: se há alteração pendente, ela é salva antes. Perguntar a cada
 * clique da lista transformaria navegar em interrogatório. */
function leiEdTrocar(num) {
  if (leiEdSujo()) leiEdSalvar(true);
  leiEdAbrir(num);
}

function leiEdSujo() {
  const texto = String($("leiTexto").value || "");
  const a = leiEdNum ? leiArtigo(texto, leiEdNum) : null;
  const agora = String(($("leiArtTexto") || {}).value || "").replace(/\s+$/, "");
  if (!a) return !!agora.trim();
  return agora !== String(a.texto || "").replace(/\s+$/, "");
}

function leiEdSalvar(silencioso) {
  const novo = String(($("leiArtTexto") || {}).value || "").replace(/\s+$/, "");
  const texto = String($("leiTexto").value || "");
  if (!novo.trim()) {
    $("leiArtAviso").textContent = t("lei_art_vazio");
    return false;
  }
  /* o texto tem de continuar sendo um artigo: sem o "Art. N" na frente,
   * o pedaço deixaria de ser encontrável e o marcador, os cartões e a
   * estatística perderiam a âncora de uma vez */
  const lido = leiArtigos(novo)[0];
  /* o guarda vale por si: sem ele, qualquer caminho abaixo que use
   * "lido" estoura com pilha de erro em vez de dizer o que faltou */
  if (!lido || lido.linha !== 1) {
    $("leiArtAviso").textContent = t("lei_art_sem_numero");
    return false;
  }

  let final;
  if (leiEdNum) {
    if (lido.num !== leiEdNum) {
      /* renumerar é trocar de artigo: some do lugar antigo e entra no
       * novo, senão ficariam dois */
      const semVelho = leiSubstituirArtigo(texto, leiEdNum, "");
      final = leiInserirArtigo(String(semVelho || "").replace(/\n{3,}/g, "\n\n"), novo);
    } else {
      final = leiSubstituirArtigo(texto, leiEdNum, novo);
    }
  } else {
    final = leiInserirArtigo(texto, novo);
    if (final === null) {
      $("leiArtAviso").textContent = t("lei_art_ja_existe", { a: lido.numCru });
      return false;
    }
  }
  if (final === null) { $("leiArtAviso").textContent = t("lei_art_nao_achou"); return false; }

  $("leiTexto").value = final;
  leiSujo = true;
  leiGravar();
  leiEdNum = lido.num;
  if (!silencioso) {
    $("dlgLeiArt").close();
    leiTrocarModo("ler");
    leiIrArtigo(lido.num);
  }
  leiReg("editar", "artigo gravado", lido.rotulo);
  return true;
}

async function leiEdApagar() {
  if (!leiEdNum) return false;
  const texto = String($("leiTexto").value || "");
  const a = leiArtigo(texto, leiEdNum);
  if (!a) return false;
  /* mostra O QUE se perde antes de perguntar: "apagar o art. 35?" sem o
   * texto na frente é perguntar sobre um número */
  if (!(await uiConfirm(t("lei_art_apagar_conf", {
    a: a.rotulo, txt: a.corpo.slice(0, 160) })))) return false;
  $("leiTexto").value = String(leiSubstituirArtigo(texto, leiEdNum, "") || "")
    .replace(/\n{3,}/g, "\n\n");
  leiSujo = true;
  leiGravar();
  leiReg("editar", "artigo apagado", a.rotulo);
  $("dlgLeiArt").close();
  leiTrocarModo("ler");
  return true;
}

/* MODO RECITAR — só o número e a ementa; o texto fica escondido.
 *
 * É a diferença entre reconhecer e lembrar. Reler a lei dá a sensação de
 * que se sabe, porque cada linha parece familiar quando está na frente.
 * Ver "Art. 167 — São vedados:" e ter de completar mostra o que
 * realmente ficou. */
function leiPintarRecitar() {
  const cx = $("leiRecitar");
  if (!cx) return;
  cx.innerHTML = "";
  cx.style.fontSize = leiFonte + "px";
  const arts = leiArtigos(String($("leiTexto").value || ""));
  if (!arts.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = t("lei_recitar_vazio");
    cx.append(p);
    return;
  }

  const cab = document.createElement("p");
  cab.className = "nota";
  cab.textContent = t("lei_recitar_ajuda", {
    n: arts.length, v: Object.keys(leiRecitados).length,
  });
  cx.append(cab);

  arts.forEach((a) => {
    const bloco = document.createElement("div");
    bloco.className = "lei-rec";

    const b = document.createElement("button");
    b.className = "lei-rec-cab";
    b.textContent = a.rotulo + (a.ementa ? " — " + a.ementa : "");
    b.title = t("lei_recitar_ver");
    b.onclick = () => {
      leiRecitados[a.num] = !leiRecitados[a.num];
      leiPintarRecitar();
    };
    bloco.append(b);

    if (leiRecitados[a.num]) {
      const d = document.createElement("div");
      d.className = "lei-rec-txt";
      d.innerHTML = matParaHtml(a.texto);
      bloco.append(d);
    }
    cx.append(bloco);
  });
}

/* ---------------------------------------------------------------------
 * NAVEGAR
 * ------------------------------------------------------------------ */

function leiIrArtigo(num) {
  const alvo = leiNumNormal(num);
  const el = $("leiArt_" + alvo.replace(/[^A-Z0-9-]/gi, ""));
  if (!el) return false;
  if (el.scrollIntoView) {
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
  }
  if (el.classList) {
    el.classList.add("lei-art-pisca");
    setTimeout(() => { try { el.classList.remove("lei-art-pisca"); } catch (e) {} }, 1600);
  }
  return true;
}

async function leiIrAbrir() {
  const arts = leiArtigos(String($("leiTexto").value || ""));
  if (!arts.length) { uiAlert(t("lei_sem_artigos")); return; }
  const v = await uiTexto(t("lei_ir_pergunta", {
    de: arts[0].numCru, ate: arts[arts.length - 1].numCru }), "");
  if (v === null) return;
  if (!leiIrArtigo(v)) uiAlert(t("lei_ir_nao_achou", { a: v }));
}

/* ---------------------------------------------------------------------
 * GRAVAR, COLAR E VINCULAR
 * ------------------------------------------------------------------ */

function leiGravar() {
  if (!leiAtual) return;
  const txt = String($("leiTexto").value || "");
  let l = leiIdAtual ? leiDe(leiIdAtual) : null;

  if (!l) {
    /* primeira colagem: a lei nasce aqui, já identificada pelo próprio
     * cabeçalho quando ele veio junto */
    const ident = leiIdentificar(txt);
    const nome = ident ? ident.nome
      : (leiAtual.disciplina + " — " + leiAtual.topico);
    l = leiGuardar(Object.assign({ nome, texto: txt, topicos: [leiAtual.chave],
      consultadaEm: leisHojeISO() },
      ident ? { especie: ident.especie, numero: ident.numero, ano: ident.ano } : {}));
    if (!l) return;
    leiIdAtual = l.id;
  } else {
    leiGuardar({ id: l.id, texto: txt });
    leiLigar(l.id, leiAtual.chave);
  }

  /* o tópico guarda o PONTEIRO, não o texto */
  const antigo = (typeof matResumos !== "undefined" && matResumos[leiAtual.chave]) || {};
  matResumos[leiAtual.chave] = Object.assign({}, antigo, {
    leiId: leiIdAtual,
    disciplina: antigo.disciplina || leiAtual.disciplina,
    topico: antigo.topico || leiAtual.topico,
    concurso: antigo.concurso
      || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    criado: antigo.criado || new Date().toISOString(),
    tocado: new Date().toISOString(),
  });
  matSalvar();

  leiSujo = false;
  try { leiReg("gravar", "lei gravada",
           leiDe(leiIdAtual).nome + " · " + leiArtigos(txt).length + " artigos");
  } catch (e) {}
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
  leiPintar();
  toast("lei_salva");
}

function leiTrocarPara(id) {
  if (leiSujo) leiGravar();
  leiIdAtual = id;
  const l = leiDe(id);
  $("leiTexto").value = l ? String(l.texto || "") : "";
  if (typeof matResumos !== "undefined" && matResumos[leiAtual.chave]) {
    matResumos[leiAtual.chave].leiId = id;
    matSalvar();
  }
  leiSujo = false;
  leiRecitados = {};
  leiTrocarModo("ler");
  leiPintar();
}

function leiNovaAbrir() {
  leiIdAtual = "";
  $("leiTexto").value = "";
  leiSujo = false;
  leiTrocarModo("editar");
  leiPintar();
  uiAlert(t("lei_colar_instrucao"));
}

function leiVincularAbrir() {
  const cx = $("leiVincCx");
  if (!cx) return;
  cx.innerHTML = "";
  const minha = leisChaveComparavel(leiAtual.chave);
  const outras = leisLista().filter((l) =>
    !(l.topicos || []).some((c) => leisChaveComparavel(c) === minha));
  if (!outras.length) { uiAlert(t("lei_vincular_vazio")); return; }

  outras.forEach((l) => {
    const item = document.createElement("div");
    item.className = "duv-item";
    const tit = document.createElement("div");
    tit.className = "duv-titulo";
    tit.textContent = l.nome;
    const sub = document.createElement("div");
    sub.className = "nota";
    /* dizer QUEM já usa a lei é o que dá confiança de que é a mesma:
     * "a 4.320 que você já leu em Receita" */
    sub.textContent = t("lei_vinc_sub", {
      n: leiArtigos(l.texto).length,
      onde: (l.topicos || []).map((c) => String(c).split("›").pop()).join(", ") || "—",
    });
    const b = document.createElement("button");
    b.className = "btn-min btn-min-ok";
    b.textContent = t("lei_vincular_este");
    b.onclick = () => {
      leiLigar(l.id, leiAtual.chave);
      $("dlgLeiVincular").close();
      leiTrocarPara(l.id);
    };
    item.append(tit, sub, b);
    cx.append(item);
  });
  abrirModal("dlgLeiVincular");
}

/* ---------------------------------------------------------------------
 * PROCEDÊNCIA (link, data, versão)
 * ------------------------------------------------------------------ */

function leiProcAbrir() {
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  if (!l) { uiAlert(t("lei_proc_sem_lei")); return; }
  $("leiProcNome").value = l.nome || "";
  $("leiProcFonte").value = l.fonte || "";
  $("leiProcData").value = l.consultadaEm || leisHojeISO();
  $("leiProcVersao").value = l.versao || "";
  abrirModal("dlgLeiProc");
}

function leiProcSalvar() {
  if (!leiIdAtual) return false;
  const nome = String($("leiProcNome").value || "").trim();
  leiGuardar({
    id: leiIdAtual,
    nome: nome || leiDe(leiIdAtual).nome,
    fonte: String($("leiProcFonte").value || "").trim(),
    consultadaEm: String($("leiProcData").value || "").trim(),
    versao: String($("leiProcVersao").value || "").trim(),
  });
  $("dlgLeiProc").close();
  try { leiReg("procedencia", "procedência atualizada",
           nome + " · " + $("leiProcData").value);
  } catch (e) {}
  leiPintar();
  return true;
}

/* ---------------------------------------------------------------------
 * CLOZE DE UM ARTIGO
 *
 * Lacuna feita à mão num artigo de dez linhas é trabalho de minutos e
 * sai ruim: esconde-se a palavra errada, ou esconde-se tanto que o
 * cartão vira adivinhação. O prompt aqui é específico — pede lacuna nos
 * NÚMEROS e nos VERBOS DE COMANDO, que é o que a banca troca.
 * ------------------------------------------------------------------ */

let leiClozeArt = null;
let leiClozeLidos = [];

function leiClozeAbrir(a) {
  if (!a || !$("dlgLeiCloze")) return;
  leiClozeArt = a;
  leiClozeLidos = [];
  const l = leiDe(leiIdAtual) || {};
  $("leiClozeTitulo").textContent = t("lei_cloze_titulo", { a: a.rotulo });
  $("leiClozePrompt").value = t("lei_cloze_prompt", {
    lei: l.nome || "—",
    artigo: a.rotulo,
    etiqueta: leiEtiquetaDe(l, a),
    texto: a.texto,
  });
  $("leiClozeColar").value = "";
  $("leiClozePrevia").innerHTML = "";
  $("leiClozePrevia").hidden = true;
  $("btnLeiClozeAplicar").hidden = true;
  abrirModal("dlgLeiCloze");
}

/* A ETIQUETA CARREGA O ARTIGO.
 * Cartão de lei sem número de artigo é cartão órfão: quando ele erra na
 * revisão, não há como voltar ao texto. Com "lei4320-art35" na etiqueta,
 * o cartão aponta de volta para a linha exata. */
function leiEtiquetaDe(l, a) {
  const base = String((l && (l.numero || l.nome)) || "lei")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");
  return base + "-art" + String(a.num).toLowerCase();
}

function leiClozeConferir() {
  const cru = String(($("leiClozeColar") || {}).value || "").trim();
  if (!cru) { uiAlert(t("lei_cloze_vazio")); return false; }
  let lidos = [];
  try { lidos = (parseText(cru).cards || []); } catch (e) { lidos = []; }
  lidos = lidos.filter((c) => c && String(c.front || "").trim());
  if (!lidos.length) { uiAlert(t("lei_cloze_nao_leu")); return false; }

  /* CARTÃO DE LEI SEM LACUNA NENHUMA quase sempre é a IA devolvendo o
   * artigo copiado. Avisa, mas não recusa: pode ser um cartão de
   * pergunta-e-resposta legítimo sobre o artigo. */
  const semLacuna = lidos.filter((c) => !/\{\{c\d+::/.test(String(c.front || "")));
  leiClozeLidos = lidos;

  const cx = $("leiClozePrevia");
  cx.innerHTML = "";
  cx.hidden = false;
  lidos.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "qm-lado qm-depois";
    const fr = document.createElement("div");
    fr.textContent = (i + 1) + ". " + String(c.front || "").slice(0, 400);
    d.append(fr);
    if (String(c.back || "").trim()) {
      const v = document.createElement("div");
      v.className = "qm-gab";
      v.textContent = t("cm_mel_verso") + " " + String(c.back);
      d.append(v);
    }
    cx.append(d);
  });
  $("btnLeiClozeAplicar").hidden = false;
  $("btnLeiClozeAplicar").textContent = t("lei_cloze_aplicar", { n: lidos.length });
  if (semLacuna.length) {
    uiAlert(t("lei_cloze_sem_lacuna", { n: semLacuna.length }));
  }
  return true;
}

function leiClozeAplicar() {
  if (!leiClozeLidos.length || !leiAtual) return false;
  const ch = leiAtual.chave;
  const antigo = String(((typeof matResumos !== "undefined" && matResumos[ch]) || {}).cartoes || "");
  const linhas = leiClozeLidos.map((c) => {
    const etq = (c.ownTags && c.ownTags.length) ? c.ownTags.join(" ")
      : leiEtiquetaDe(leiDe(leiIdAtual) || {}, leiClozeArt);
    return String(c.front || "") + " :: " + String(c.back || "") + " :: " + etq;
  });
  const texto = (antigo ? antigo.replace(/\s+$/, "") + "\n" : "") + linhas.join("\n");
  matGravarCartoes(ch, texto,
    { disciplina: leiAtual.disciplina, topico: leiAtual.topico });
  $("dlgLeiCloze").close();
  try {
    leiReg("cartoes", "cartões gerados de um artigo",
           (leiClozeArt ? leiClozeArt.rotulo : "?") + " · " + linhas.length);
  } catch (e) {}
  uiAlert(t("lei_cloze_pronto", { n: linhas.length }));
  leiClozeLidos = [];
  return true;
}

/* ---------------------------------------------------------------------
 * ARTIGOS QUE MAIS CAEM
 *
 * A estatística não vem de fora: vem das questões que a própria pessoa
 * salvou e das marcas de "caiu na prova" que ela pôs. É pequena, e por
 * isso mesmo é honesta — não diz "o art. 167 é o mais cobrado do país",
 * diz "o art. 167 apareceu em 3 das SUAS questões e você errou 2".
 * ------------------------------------------------------------------ */

function leiRanking(id) {
  const l = leiDe(id || leiIdAtual);
  if (!l) return [];
  const arts = leiArtigos(l.texto);
  const porNum = {};
  arts.forEach((a) => {
    porNum[a.num] = { num: a.num, rotulo: a.rotulo, ementa: a.ementa,
                      questoes: 0, erros: 0, acertos: 0, prova: 0, incisos: [] };
  });

  /* 1. as questões salvas */
  let banco = [];
  try { banco = (typeof qsTodas === "function" ? qsTodas() : []) || []; }
  catch (e) { banco = []; }
  banco.forEach((q) => {
    const alvo = [q.enunciado, q.comentario, q.gabarito].filter(Boolean).join(" ");
    leiCitacoes(alvo).forEach((c) => {
      const r = porNum[c.num];
      if (!r) return;                    /* artigo de outra lei */
      r.questoes++;
      c.incisos.forEach((i) => { if (r.incisos.indexOf(i) < 0) r.incisos.push(i); });
      (q.tentativas || []).forEach((tt) => {
        if (tt && tt.acertou) r.acertos++; else if (tt) r.erros++;
      });
    });
  });

  /* 2. as marcas de "caiu na prova" dentro da própria lei */
  try {
    const marcas = matMarcasNoTexto(leiAtual ? leiAtual.chave : "", "lei") || [];
    marcas.filter((m) => m.tipo === "prova").forEach((m) => {
      /* a marca não diz o artigo: descobre-se por onde ela caiu no texto */
      const antes = String(l.texto || "").slice(0, m.pos);
      const ultimo = leiArtigos(antes).pop();
      if (ultimo && porNum[ultimo.num]) porNum[ultimo.num].prova++;
    });
  } catch (e) {}

  return Object.keys(porNum).map((k) => porNum[k])
    .filter((r) => r.questoes || r.prova)
    .sort((a, b) => (b.questoes + b.prova * 2) - (a.questoes + a.prova * 2)
                 || b.erros - a.erros);
}

function leiRankingAbrir() {
  const cx = $("leiRankCx");
  if (!cx) return;
  cx.innerHTML = "";
  const lista = leiRanking(leiIdAtual);
  const l = leiDe(leiIdAtual) || {};
  $("leiRankTitulo").textContent = t("lei_rank_titulo", { lei: l.nome || "—" });

  if (!lista.length) {
    const p = document.createElement("p");
    p.className = "nota";
    /* dizer POR QUE está vazio: sem isto a tela parece quebrada, quando
     * na verdade só falta a pessoa salvar questões desta lei */
    p.textContent = t("lei_rank_vazio");
    cx.append(p);
  }

  lista.forEach((r) => {
    const item = document.createElement("div");
    item.className = "duv-item";

    const tit = document.createElement("div");
    tit.className = "duv-titulo";
    tit.textContent = r.rotulo + (r.ementa ? " — " + r.ementa : "");

    const sub = document.createElement("div");
    sub.className = "nota";
    const partes = [];
    if (r.questoes) partes.push(t("lei_rank_questoes", { n: r.questoes }));
    if (r.erros || r.acertos) {
      partes.push(t("lei_rank_placar", { e: r.erros, a: r.acertos }));
    }
    if (r.prova) partes.push(t("lei_rank_prova", { n: r.prova }));
    if (r.incisos.length) partes.push(t("lei_rank_incisos", { i: r.incisos.join(", ") }));
    sub.textContent = partes.join(" · ");
    if (r.erros > r.acertos) sub.classList.add("lei-velha");

    const b = document.createElement("button");
    b.className = "btn-min";
    b.textContent = t("lei_rank_ver");
    b.onclick = () => {
      $("dlgLeiRank").close();
      leiTrocarModo("ler");
      leiIrArtigo(r.num);
    };

    item.append(tit, sub, b);
    cx.append(item);
  });
  abrirModal("dlgLeiRank");
}

/* ---------------------------------------------------------------------
 * REGISTRAR LEITURA
 * ------------------------------------------------------------------ */

/* Se um capítulo estiver selecionado, o tempo é o DELE — registrar a lei
 * inteira depois de ler um capítulo infla o estudo e desmonta o plano. */
function leiRegistrarLeitura() {
  if (!leiAtual) return;
  const txt = String($("leiTexto").value || "");
  let palavras = (txt.match(/\S+/g) || []).length;
  let rotulo = "";
  if (leiBlocoAberto) {
    const b = leiBlocos(txt).filter((x) => x.nome === leiBlocoAberto)[0];
    if (b) {
      palavras = b.artigos.reduce((s, a) => s + (a.texto.match(/\S+/g) || []).length, 0);
      rotulo = b.nome;
    }
  }
  const min = Math.max(5, Math.round(palavras / 75));

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
  try { leiReg("leitura", "leitura registrada",
           min + " min · " + palavras + " palavras" + (rotulo ? " · " + rotulo : ""));
  } catch (e) {}
  uiAlert(t("lei_lida", { n: min }));
}

async function leiFechar() {
  if (leiSujo) {
    const r = await matPerguntarSaida();
    if (r !== "salvar" && r !== "sair") return;
    if (r === "salvar") leiGravar();
    else {
      try { leiReg("gravar", "alterações descartadas",
                   leiAtual && leiAtual.topico); } catch (e) {}
    }
  }
  leiSujo = false;
  /* sair da tela cheia ao fechar: reabrir a lei amputada de tudo, sem
   * ter pedido, parece defeito e nao recurso */
  if (leiCheia) leiCheiaTrocar(false);
  $("dlgLeiSeca").close();
  leiAtual = null;
}

/* ---------------------------------------------------------------------
 * AJUDA
 *
 * Escrita como mapa da janela, não como lista de botões: cada item diz
 * PARA QUE serve e POR QUE existe. "Recitar: esconde o texto" é inútil
 * sem o "porque reler dá sensação de saber" — é o porquê que faz a
 * pessoa usar o recurso em vez de achá-lo estranho.
 * ------------------------------------------------------------------ */

const LEI_AJUDA = [
  "fila", "proc", "onde", "modos", "capitulos", "artigo", "editar",
  "marcas", "cartoes", "cai", "recitar", "ranking", "cheia", "gravar",
  "lido", "log",
];

function leiAjudaAbrir() {
  const cx = $("leiAjudaCx");
  if (!cx) return;
  cx.innerHTML = "";
  LEI_AJUDA.forEach((id) => {
    const item = document.createElement("div");
    item.className = "duv-item";
    const tit = document.createElement("div");
    tit.className = "duv-titulo";
    tit.textContent = t("lei_aj_" + id + "_t");
    const txt = document.createElement("div");
    txt.className = "nota";
    txt.textContent = t("lei_aj_" + id + "_d");
    item.append(tit, txt);
    cx.append(item);
  });
  abrirModal("dlgLeiAjuda");
  leiReg("ajuda", "ajuda aberta", "");
}

/* ---------------------------------------------------------------------
 * LIGAR OS BOTÕES
 * ------------------------------------------------------------------ */

function leiIniciar() {
  leiLogCarregar();
  leiFonteCarregar();
  leiJanelaCarregar();
  /* leiBotao no lugar de um onclick nu: qualquer falha vira linha de
   * registro com o nome do botão, em vez de morrer no console */
  const liga = (id, nome, fn) => leiBotao(id, nome, fn);

  liga("btnLeiModoLer", "ler", () => leiTrocarModo("ler"));
  liga("btnLeiModoEditar", "editar", () => leiTrocarModo("editar"));
  liga("btnLeiModoRecitar", "recitar", () => leiTrocarModo("recitar"));
  liga("btnLeiSalvar", "gravar", () => leiGravar());
  liga("btnLeiBlocos", "capítulos", () => {
    const cx = $("leiBlocosCx");
    if (cx) cx.hidden = !cx.hidden;
  });
  liga("btnLeiIr", "ir ao artigo", () => leiIrAbrir());
  /* AS GAVETAS. Uma de cada vez: duas abertas devolveriam a fila de
   * catorze botões que elas existem para desfazer. */
  liga("btnLeiNavegar", "gaveta ir para", () => leiGaveta("leiGavNavegar"));
  liga("btnLeiExibir", "gaveta exibição", () => leiGaveta("leiGavExibir"));
  liga("btnLeiRank", "artigos que mais caem", () => leiRankingAbrir());
  liga("btnLeiCheia", "tela cheia", () => leiCheiaTrocar());
  liga("btnLeiAjuda", "ajuda", () => leiAjudaAbrir());
  liga("btnLeiAjudaFechar", "fechar ajuda", () => $("dlgLeiAjuda").close());
  liga("btnLeiLog", "registro", () => leiLogAbrir());
  liga("btnLeiFechar", "fechar", () => leiFechar());
  liga("btnLeiFechar2", "fechar", () => leiFechar());
  liga("btnLeiLido", "li este material", () => leiRegistrarLeitura());
  liga("btnLeiMaior", "letra maior", () => leiFonteMudar(2));
  liga("btnLeiMenor", "letra menor", () => leiFonteMudar(-2));
  liga("btnLeiJanelaMais", "janela maior", () => leiJanelaMudar(1));
  liga("btnLeiJanelaMenos", "janela menor", () => leiJanelaMudar(-1));

  liga("btnLeiLogHoje", "filtro de hoje", () => {
    leiLogSoHoje = !leiLogSoHoje; leiLogPintar();
  });
  liga("btnLeiLogErros", "filtro de erros", () => {
    leiLogSoErros = !leiLogSoErros; leiLogPintar();
  });
  liga("btnLeiLogCopiar", "copiar registro", () => {
    try { navigator.clipboard.writeText($("leiLogTexto").value); } catch (e) {}
    const b = $("btnLeiLogCopiar");
    const r = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = r; }, 1800);
  });
  liga("btnLeiLogLimpar", "apagar registro", async () => {
    if (!(await uiConfirm(t("lei_log_limpar_conf", { n: leiLog.length })))) return;
    leiLog = [];
    try { localStorage.setItem(LEI_LOG_CHAVE, "[]"); } catch (e) {}
    leiLogPintar();
  });
  liga("btnLeiLogFechar", "fechar registro", () => $("dlgLeiLog").close());

  liga("btnLeiArtSalvar", "gravar artigo", () => leiEdSalvar(false));
  liga("btnLeiArtApagar", "apagar artigo", () => leiEdApagar());
  liga("btnLeiArtFechar", "fechar artigo", () => {
    /* fechar com alteração pendente não pode jogar fora em silêncio: a
     * pessoa acabou de digitar a nova redação de um artigo */
    if (leiEdSujo()) leiEdSalvar(true);
    $("dlgLeiArt").close();
    leiTrocarModo("ler");
  });

  liga("btnLeiProcSalvar", "guardar procedência", () => leiProcSalvar());
  liga("btnLeiProcFechar", () => $("dlgLeiProc").close());
  liga("btnLeiVincFechar", () => $("dlgLeiVincular").close());
  liga("btnLeiClozeFechar", () => $("dlgLeiCloze").close());
  liga("btnLeiClozeConferir", () => leiClozeConferir());
  liga("btnLeiClozeAplicar", () => leiClozeAplicar());
  liga("btnLeiClozeCopiar", () => {
    try { navigator.clipboard.writeText($("leiClozePrompt").value); } catch (e) {}
    const b = $("btnLeiClozeCopiar");
    const r = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = r; }, 1800);
  });
  liga("btnLeiRankFechar", () => $("dlgLeiRank").close());

  /* as seis marcas, as MESMAS do resumo */
  [["btnLeiMarcaDest", "destaque"], ["btnLeiMarcaImp", "importante"],
   ["btnLeiMarcaDuv", "duvida"], ["btnLeiMarcaProva", "prova"],
   ["btnLeiMarcaPeg", "pegadinha"]].forEach(([id, tipo]) => {
    liga(id, "marca " + tipo, () => matMarcarSelecao(tipo, "lei"));
  });

  if ($("leiTexto")) {
    $("leiTexto").addEventListener("input", () => { leiSujo = true; });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    leiAbrir, leiGravar, leiTem, leiFechar, leiRegistrarLeitura, leiIniciar,
    leiTrocarModo, leiModoAtual, leiPintar, leiIrArtigo, leiTrocarPara,
    leiVincularAbrir, leiProcAbrir, leiProcSalvar, leiClozeAbrir,
    leiClozeConferir, leiClozeAplicar, leiRanking, leiRankingAbrir,
    leiTextoDoTopico, leiAplicarNoTopico, leiEtiquetaDe, leiDoTopicoAtual,
    leiReg, leiLogTexto, leiLogAbrir, leiLogPintar, leiLogFiltrado,
    leiAjudaAbrir, leiCheiaTrocar, leiFonteMudar, LEI_AJUDA, LEI_LOG_CHAVE,
    leiGaveta,
    leiEdAbrir, leiEdSalvar, leiEdApagar, leiEdTrocar, leiEdSujo,
    leiFonteDefinir, leiJanelaMudar, leiJanelaAplicar, LEI_JANELAS,
    leiJanelaAtual: () => leiJanela,
  };
}
