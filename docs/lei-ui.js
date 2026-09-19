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
/* =====================================================================
 * A LIGAÇÃO DE UM BOTÃO PRECISA FALHAR NA HORA DE LIGAR
 *
 * O DEFEITO REAL, achado no registro do usuário: sete botões desta tela
 * — todos os "fechar" das gavetas — estavam ligados com DOIS argumentos
 * numa função de três: liga("btnLeiProcFechar", () => ...). A arrow
 * caiu no lugar do NOME, "acao" ficou undefined, e o clique produzia
 * "Cannot read properties of undefined (reading 'apply')".
 *
 * O sintoma era o pior possível: o botão existia, respondia ao toque,
 * não fazia nada, e o log dizia
 *
 *   falha em () => $("dlgLeiProc").close() — reading 'apply'
 *
 * ou seja, imprimia o CÓDIGO no lugar do nome, porque o código estava
 * mesmo na variável do nome. Quem lê isso procura um erro dentro do
 * close(), que está perfeito.
 *
 * DUAS DEFESAS, e as duas importam:
 *
 * 1. ACEITAR A FORMA DE DOIS ARGUMENTOS. Um botão nunca deve ficar
 *    morto por causa da ordem dos parâmetros. Sem nome, ele é deduzido
 *    do id — pior que um nome escrito à mão, e infinitamente melhor que
 *    não funcionar.
 * 2. RECUSAR NA LIGAÇÃO O QUE NÃO É FUNÇÃO. Se ainda assim vier lixo no
 *    lugar da ação, isso é anotado AGORA, no arranque, e não daqui a
 *    três dias quando alguém tocar no botão. Erro que espera o clique é
 *    erro que chega junto com a frustração.
 * ===================================================================== */
function leiBotao(id, nome, acao) {
  /* liga(id, fn) — a arrow veio no lugar do nome */
  if (typeof nome === "function" && acao === undefined) {
    acao = nome;
    nome = String(id || "").replace(/^btnLei/, "").replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase() || String(id || "");
  }
  const b = $(id);
  if (!b) return;
  if (typeof acao !== "function") {
    /* NÃO liga nada: um onclick que estoura é pior que um botão inerte,
     * porque o alerta de erro cobre a tela em cima de um gesto simples */
    try { leiReg("erro", "botão sem ação: " + id,
                 "ligado com " + (typeof acao) + " no lugar da função"); }
    catch (e) {}
    return;
  }
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
  if (!chave && leiAtual && !leiAtual.chave && leiIdAtual) return leiDe(leiIdAtual);
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
  /* abrir outra lei descarta o desenho em andamento da anterior */
  leiPinturaCancelar();
  /* SEM TÓPICO (aberta pela Biblioteca), a chave é vazia — e tudo o que
   * depende de um tópico (registrar leitura, cartões, a fila) sabe disso */
  leiAtual = { disciplina, topico, chave: (disciplina || topico) ? matChave(disciplina, topico) : "" };
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
  /* UMA PINTURA SÓ. Antes o modo era trocado aqui (o que já pintava a
   * leitura inteira) e leiPintar() pintava tudo de novo logo em seguida.
   * Com lei para ler, só se ajusta o modo — quem pinta é leiPintar, uma
   * vez; e se a lei for grande, ele pinta em pedaços, com o diálogo já
   * aberto (leiAdiarPintura). */
  if (l && String(l.texto || "").trim()) {
    leiModo = "ler";
    leiAdiarPintura = true;
  } else {
    leiTrocarModo("editar");
  }
  try { leiPintar(); } finally { leiAdiarPintura = false; }
  abrirModal("dlgLeiSeca");
  try { leiReg("lei", "lei seca aberta", topico + " · "
      + (l ? l.nome + " · " + leiArtigos(l.texto).length + " artigos"
           : "nenhuma lei ligada ainda"));
  } catch (e) {}
}

/* =====================================================================
 * A ÚNICA PORTA PARA "ABRIR A LEI NUM ARTIGO"
 *
 * Todo caminho novo — o link de citação dentro do comentário, o popover
 * do ⚖ quando o tópico tem duas leis, o "ir ao artigo" vindo de fora —
 * entra por aqui, e não por leiAbrir + leiIrArtigo soltos.
 *
 * A ORDEM NÃO É DETALHE. leiIrArtigo procura "#leiArt_N", e esse
 * elemento só existe depois que leiPintar desenhou o modo LER. Chamado
 * antes, ele devolve false e não rola nada — e um botão que às vezes
 * não faz nada ensina a não confiar nos outros. leiAbrir já pinta;
 * garantir "ler" aqui torna isto independente da decisão dele, que
 * escolhe "editar" quando a lei ainda está vazia.
 *
 * DEVOLVE SE ACHOU. O comentário pode citar o art. 195 numa lei que só
 * foi colada até o 40 — nesse caso a lei abre (o que é útil) mas quem
 * chamou precisa saber que o salto não aconteceu, para dizer isso em vez
 * de deixar a pessoa procurando na tela.
 * ===================================================================== */
function leiAbrirNoArtigo(disciplina, topico, idLei, num, sub) {
  leiAbrir(disciplina, topico, idLei);
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const temTexto = !!(l && String(l.texto || "").trim());
  if (temTexto && leiModo !== "ler") leiTrocarModo("ler");
  if (!num || !temTexto) return false;
  let achou;
  if (leiPintura) {
    /* LEI GRANDE, AINDA ENTRANDO NA TELA: o artigo pode não estar no DOM
     * ainda, mas a lista de artigos já foi lida — dá para dizer se ele
     * existe, e a pintura vai até ele assim que o pedaço dele entrar */
    const alvo = leiNumNormal(num);
    achou = leiPintura.arts.some((a) => a.num === alvo);
    if (achou) leiPintura.alvo = alvo;
  } else {
    achou = leiIrArtigo(num);
    /* a citação disse o INCISO/parágrafo: depois do salto ao artigo, rola até ele */
    if (achou && sub) setTimeout(() => leiIrUnidade(num, sub), 450);
  }
  try {
    leiReg("navegar", achou ? "aberta no artigo citado" : "artigo citado não existe nesta lei",
           (l ? l.nome : "—") + " · art. " + num);
  } catch (e) {}
  return achou;
}

/* ---------------------------------------------------------------------
 * PINTAR
 * ------------------------------------------------------------------ */

function leiPintar() {
  if (!leiAtual) return;
  /* leiPintar é SEMPRE uma repintura completa (marcar, parei aqui, editar
   * um artigo): descarta o desenho em pedaços que ainda estiver rodando —
   * leiTrocarModo, mais abaixo, pintaria por cima de um painel pela metade.
   * Só leiAbrir passa por aqui querendo pintar em pedaços (leiAdiarPintura) */
  if (!leiAdiarPintura) leiPinturaCancelar();
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const r = (typeof matResumos !== "undefined" && matResumos[leiAtual.chave]) || {};

  $("leiTitulo").textContent = l ? l.nome : t("lei_titulo", { tp: leiAtual.topico });
  $("leiSub").textContent = [r.concurso, leiAtual.disciplina, leiAtual.topico]
    .filter(Boolean).join(" · ") || (leiAtual.chave ? "" : t("lei_avulsa_sub"));

  leiPintarFila();
  leiPintarProcedencia();
  leiPintarOnde();
  leiPintarBlocos();
  leiPintarAnexos();
  leiJanelaAplicar();
  leiCheiaAplicar();
  if (leiModo !== "editar") leiTrocarModo(leiModo);
  else leiPintarEdicaoLivre();
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
  if (!leiAtual.chave) {
    /* aberta pela Biblioteca: só a própria lei, sem "desligar" nem "colar nova" */
    const atual = leiIdAtual ? leiDe(leiIdAtual) : null;
    if (atual) {
      const rot = document.createElement("span");
      rot.className = "lei-fila-rot";
      rot.textContent = t("lei_avulsa_rot");
      const chip = document.createElement("span");
      chip.className = "lei-chip lei-chip-on";
      chip.textContent = atual.nome;
      cx.append(rot, chip);
    }
    return;
  }
  const lista = leisDoTopico(leiAtual.chave);

  lista.forEach((l) => {
    const wrap = document.createElement("span");
    wrap.className = "lei-chip-wrap";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lei-chip" + (l.id === leiIdAtual ? " lei-chip-on" : "");
    const p = leiProgresso(l.id) || { total: 0, pct: 0 };
    b.textContent = l.nome + " · " + t("lei_n_artigos", { n: p.total })
      + (p.pct ? " · " + p.pct + "%" : "");
    b.title = t("lei_chip_ajuda", { n: (l.topicos || []).length });
    b.onclick = () => leiTrocarPara(l.id);
    /* DESVINCULAR ESTE TÓPICO DESTA LEI — não apagar a lei, que segue na
     * biblioteca e ligada a quem mais a usa. Existe porque o link entre
     * uma citação e uma lei podia sair errado sem jeito nenhum de
     * corrigir: leiDesligar já fazia a metade certa do trabalho, só não
     * tinha botão nenhum que a chamasse. */
    const x = document.createElement("button");
    x.type = "button";
    x.className = "lei-chip-x";
    x.textContent = "✖";
    x.title = t("lei_chip_desvincular_aj", { l: l.nome });
    x.setAttribute("aria-label", x.title);
    x.onclick = async (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      const ok = await uiConfirm(
        t("lei_chip_desvincular_conf", { l: l.nome, tp: leiAtual.topico }));
      if (!ok) return;
      leiDesligar(l.id, leiAtual.chave);
      reg("LEI", "lei desvinculada do topico", l.nome + " · " + leiAtual.topico);
      const resto = leisDoTopico(leiAtual.chave);
      /* O PONTEIRO PREFERIDO DO TÓPICO (matResumos[chave].leiId) pode
       * continuar apontando para a lei que acabou de sair — sem
       * corrigir, leiDoTopicoAtual voltaria a devolvê-la na próxima vez
       * que o tópico abrisse, como se o desvincular não tivesse
       * acontecido. */
      if (typeof matResumos !== "undefined" && matResumos[leiAtual.chave]
          && matResumos[leiAtual.chave].leiId === l.id) {
        matResumos[leiAtual.chave].leiId = resto[0] ? resto[0].id : "";
        matSalvar();
      }
      if (leiIdAtual === l.id) {
        if (resto[0]) leiTrocarPara(resto[0].id);
        else {
          leiIdAtual = "";
          $("leiTexto").value = "";
          leiTrocarModo("editar");
          leiPintar();
        }
      } else {
        leiPintar();
      }
    };
    wrap.append(b, x);
    cx.append(wrap);
  });

  /* A FILA PRECISA DE UM RÓTULO, senão ela é só uma linha de pílulas.
   *
   * O que ela é: a lista das leis LIGADAS A ESTE TÓPICO. Um tópico pode
   * ter mais de uma (o de "Receita pública" tem a 4.320 e a LRF), e é
   * por isso que existe fila em vez de um texto só. Sem dizer isso, os
   * dois botões do fim parecem duas formas de fazer a mesma coisa. */
  if (lista.length) {
    const rot = document.createElement("span");
    rot.className = "lei-fila-rot";
    rot.textContent = t("lei_fila_rot", { n: lista.length });
    rot.title = t("lei_fila_rot_aj");
    cx.prepend(rot);
  }

  const bNova = document.createElement("button");
  bNova.className = "lei-chip lei-chip-add";
  bNova.id = "btnLeiNova";
  bNova.textContent = t("lei_colar_nova");
  bNova.title = t("lei_colar_nova_ajuda");
  bNova.onclick = () => leiNovaAbrir();

  /* vincular uma lei que já está na biblioteca é o gesto que faz a
   * reforma valer: a 4.320 do tópico de receita serve o de despesa sem
   * ser colada de novo */
  const outras = leisLista().filter((l) =>
    !(l.topicos || []).some((c) => leisChaveComparavel(c)
      === leisChaveComparavel(leiAtual.chave)));

  let bV = null;
  if (outras.length) {
    bV = document.createElement("button");
    bV.className = "lei-chip lei-chip-add";
    /* ID FIXO: o teste que garante a existência deste botão o procurava
     * pela PALAVRA "vincular" no rótulo — e quebrou no dia em que o
     * rótulo virou "usar uma lei já guardada". Um teste que depende do
     * texto do botão cobra a redação, não a função; um id não muda
     * quando a frase melhora. */
    bV.id = "btnLeiVincular";
    bV.textContent = t(outras.length === 1 ? "lei_vincular_1" : "lei_vincular",
                       { n: outras.length });
    bV.title = t("lei_vincular_ajuda");
    bV.onclick = () => leiVincularAbrir();
  }

  /* SEM LEI NENHUMA NESTE TÓPICO, reaproveitar é a escolha melhor que
   * colar de novo — então "usar uma lei já guardada" vem primeiro e com
   * destaque, em vez de ficar igual a "colar nova" na fila. Com o tópico
   * já servido, a urgência de não duplicar já passou e os dois voltam ao
   * mesmo peso visual. */
  const vazio = !lista.length;
  if (vazio && bV) {
    bV.classList.add("lei-chip-destaque");
    cx.append(bV, bNova);
  } else {
    if (bV) bV.classList.remove("lei-chip-destaque");
    cx.append(bNova);
    if (bV) cx.append(bV);
  }

  const ajuda = $("leiTextoAjuda");
  if (ajuda) {
    ajuda.hidden = !(vazio && outras.length);
    if (!ajuda.hidden) {
      ajuda.textContent = t(outras.length === 1 ? "lei_texto_ajuda_1" : "lei_texto_ajuda",
                            { n: outras.length });
    }
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

  /* ATUALIZAR PARA NOVA VERSÃO — só faz sentido com uma base já gravada:
   * sem base não há o que comparar, e "colar nova" (leiNovaAbrir) já
   * resolve o caso de uma lei que ainda não existe. */
  if (String(l.texto || "").trim()) {
    const bA = document.createElement("button");
    bA.className = "btn-min";
    bA.id = "btnLeiAtualizarVersao";
    bA.textContent = t("lei_atualizar_versao");
    bA.title = t("lei_atualizar_versao_ajuda");
    bA.onclick = () => leiAtualizarAbrir();
    cx.append(bA);

    /* ARTIGOS REPETIDOS NUMA LEI JÁ GUARDADA. A conferência da criação só
     * vale para o que se cola de agora em diante; a lei que entrou antes
     * dela (ou que a pessoa mandou "manter" e mudou de ideia) precisa de
     * um caminho de volta. O botão só aparece quando há o que revisar, e
     * some sozinho depois que a pessoa resolve ou manda manter. */
    const rep = leiRepetidosDaLei(l);
    if (rep.length) {
      const bR = document.createElement("button");
      bR.className = "btn-min btn-min-perigo";
      bR.id = "btnLeiRepetidos";
      bR.textContent = t("lei_dup_aviso", { n: rep.length });
      bR.title = t("lei_dup_aviso_aj", { a: rep.map((g) => "art. " + g.numCru).join(", ") });
      bR.onclick = () => leiRevisarRepetidos();
      cx.append(bR);
    }

    /* NUMERAÇÃO FORA DE SEQUÊNCIA: quase sempre é o leitor que entendeu o
     * texto errado (remissão lida como artigo, trecho faltando). Só CRITICA:
     * o toque mostra onde; quem corrige é quem cola. */
    const nm = leiNumeracaoDaLei(l);
    if (nm.graves.length) {
      const bN = document.createElement("button");
      bN.className = "btn-min btn-min-perigo";
      bN.id = "btnLeiNumeracao";
      bN.textContent = t("lei_num_aviso", { n: nm.graves.length });
      bN.title = t("lei_num_aviso_aj", { a: nm.graves.slice(0, 3).map((p) => "art. " + p.numCru).join(", ") });
      bN.onclick = () => uiAlert(t("lei_pre_num_aviso") + "\n\n"
        + leiNumeracaoLinhas(nm.problemas).map((p) => "• " + p.texto).slice(0, 15).join("\n"));
      cx.append(bN);
    }
  }
}

/* Os repetidos de uma lei guardada, sem refazer a leitura a cada repintura
 * (a lei inteira é parseada de novo em leiPintarLeitura, e este aviso roda
 * junto): guarda o último resultado por lei + texto + números já conferidos. */
let leiRepetidosMemo = { chave: "", grupos: [] };
function leiRepetidosDaLei(l) {
  if (!l || !String(l.texto || "").trim()) return [];
  const chave = l.id + "|" + leiHashTexto(l.texto) + "|" + (l.repetidosOk || []).join(",");
  if (leiRepetidosMemo.chave !== chave) {
    leiRepetidosMemo = { chave, grupos: leiDuplicados(l.texto, l.repetidosOk) };
  }
  return leiRepetidosMemo.grupos;
}

function leiRevisarRepetidos() {
  /* marcas ainda não gravadas entram antes: a revisão parte do texto GUARDADO */
  if (leiSujo && leiIdAtual) leiGravar();
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  if (!l) return false;
  const grupos = leiDuplicados(l.texto, l.repetidosOk);
  if (!grupos.length) { leiPintar(); return false; }
  /* uma alteração já registrada para o número NÃO é sobrescrita: guardar a
   * redação nova como "alteração" apagaria a que a pessoa fez à mão */
  const protegidos = {};
  Object.keys(l.alteracoes || {}).forEach((n) => { protegidos[n] = true; });
  leiDuplicadosAbrir({
    modo: "revisar", texto: l.texto, grupos, protegidos,
    aoConfirmar: (res) => {
      const alt = Object.assign({}, l.alteracoes || {}, res.alteracoes);
      const ok = (l.repetidosOk || []).concat(
        res.resumo.filter((r) => r.acao === "todas").map((r) => r.num))
        .filter((n, i, a) => a.indexOf(n) === i);
      leiGuardar({ id: l.id, texto: res.texto, alteracoes: alt, repetidosOk: ok });
      $("leiTexto").value = res.texto;
      leiSujo = false;
      try { leiReg("gravar", "artigos repetidos resolvidos na lei",
        l.nome + " · " + res.resumo.map((r) => "art. " + r.num + " → " + r.acao).join(" · ")); }
      catch (e) {}
      if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
      leiPintar();
      toast("lei_dup_revisado");
    },
  });
  return true;
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
    /* SÓ O NÚMERO, AQUI — sem ambiguidade nova para resolver: "parei"
     * grava só o número desde sempre (leiParar), e sem o índice de QUAL
     * ocorrência foi marcada não há como saber se foi a do corpo ou a
     * do ADCT. Resolver isso de verdade pede guardar a ocorrência no
     * marcador também — mudança maior, fora do que este ajuste cobre.
     * leiIrArtigo cai na primeira ocorrência, como sempre caiu. */
    txt.onclick = () => { leiTrocarModo("ler"); leiIrArtigo(p.artigo); };
  }

  cx.append(barra, txt);

  if (p.proximo) {
    const b = document.createElement("button");
    b.className = "btn-min btn-min-ok";
    /* uma mudança nunca deve passar despercebida bem no momento de
     * retomar a leitura — o mesmo selo que aparece no corpo do artigo
     * (leiPintarLeitura) aparece aqui, antes mesmo de chegar nele */
    b.textContent = t("lei_continuar", { a: p.proximo.numCru })
      + (p.proximo.alterado ? " " + t("lei_selo_alterado_curto",
          { f: p.proximo.fonteAlteracao || "?" }) : "");
    b.title = t("lei_continuar_ajuda");
    /* AQUI O ÍNDICE JÁ NÃO É AMBÍGUO: p.proximo veio de arts[lidos], uma
     * posição exata — não de uma busca por número. Se essa posição
     * calhar de ser uma segunda ocorrência (continuar de um título para
     * o próximo, que também começa do art. 1º), passar só o número
     * levaria de volta à PRIMEIRA ocorrência, silenciosamente — o mesmo
     * estrago de sempre, agora no botão que deveria andar para a
     * FRENTE. O índice mantém leiIrArtigo consistente com o que
     * leiProgresso já decidiu. */
    b.onclick = () => {
      leiTrocarModo("ler");
      leiIrArtigo(p.proximo.num, p.proximo.indice);
    };
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
    chk.className = "btn-min lei-bloco-chk" + (lidos[b.nome] ? " btn-min-ok" : "");
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
  leiFontePintar();
}

/* O NÚMERO, NÃO SÓ O EFEITO. "A+" muda o texto lá embaixo, longe do
 * botão — clicar demais (ou sem querer, feito acidentalmente algumas
 * vezes seguidas) não tem como ser percebido nem desfeito sem contar os
 * cliques de cabeça. O valor ao lado do botão é o que permite notar
 * "isso já está em 56px" antes de abrir um chamado achando que é bug de
 * layout. */
function leiFontePintar() {
  if ($("leiFonteAtual")) $("leiFonteAtual").textContent = leiFonte + "px";
}

function leiFonteDefinir(px) {
  const v = Number(px) || 15;
  leiFonte = Math.max(LEI_FONTE_MIN, Math.min(LEI_FONTE_MAX, v));
  try { localStorage.setItem(LEI_FONTE_CHAVE, String(leiFonte)); } catch (e) {}
  leiFontePintar();
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
  /* já se estava lendo, com a lei grande ainda entrando na tela: pedir
   * "ler" de novo (o caminho da questão faz isso logo após leiAbrir) não
   * pode jogar fora o desenho em andamento e refazê-lo todo de uma vez */
  const jaEntrando = leiModo === "ler" && !!leiPintura;
  leiModo = ["ler", "editar", "recitar"].indexOf(modo) >= 0 ? modo : "ler";
  const ed = leiModo === "editar";
  const rec = leiModo === "recitar";
  $("leiTexto").hidden = !ed;
  $("leiLeitura").hidden = ed || rec;
  if ($("leiRecitar")) $("leiRecitar").hidden = !rec;
  /* na tela cheia a barra de marcas some junto: ela é ferramenta de
   * quem está trabalhando o texto, não de quem está lendo */
  if ($("leiMarcas")) $("leiMarcas").hidden = ed || rec || leiCheia;
  /* =================================================================
   * A CAIXA DE COLAR PRECISA DE ALTURA, E A ALTURA NÃO É DELA
   *
   * O DEFEITO. "#leiTexto" já é "flex:1 1 auto" dentro de um diálogo
   * "flex-direction:column" — deveria esticar. Não esticava, e o motivo
   * é que flex-grow reparte ESPAÇO LIVRE: o diálogo tem "max-height",
   * não "height", então ele se dimensiona pelo conteúdo. No modo LER o
   * conteúdo é a lei inteira e transborda até o teto — parece cheio. No
   * modo EDITAR o conteúdo é um textarea de "rows=14", o diálogo encolhe
   * para caber nele, sobra zero, e não há o que o flex-grow reparta.
   *
   * Por isso o conserto é uma CLASSE NO DIÁLOGO e não uma altura no
   * textarea: dar "height: calc(85vh - 120px)" à caixa acertaria hoje e
   * erraria no dia em que a fila de leis quebrasse para duas linhas —
   * os 120px são a soma, medida a olho, de coisas que mudam de tamanho.
   *
   * dvh e não vh: vh ignora a barra do navegador no telefone, e a caixa
   * nasceria mais alta que a tela.
   * ================================================================= */
  if ($("dlgLeiSeca") && $("dlgLeiSeca").classList) {
    $("dlgLeiSeca").classList.toggle("lei-m-editar", ed);
  }

  [["btnLeiModoLer", "ler"], ["btnLeiModoEditar", "editar"],
   ["btnLeiModoRecitar", "recitar"]].forEach(([id, m]) => {
    const b = $(id);
    /* DENTRO DO GRUPO, o escolhido é preenchido e não só realçado:
     * "btn-min-ok" era a mesma cor do "gravar" ao lado, e a barra
     * mostrava dois botões verdes que não têm nada a ver um com o
     * outro. Num seletor, o estado é qual dos três está ligado. */
    if (b && b.classList) b.classList.toggle("lei-modo-on", leiModo === m);
  });

  if (leiModo === "ler" && !jaEntrando) leiPintarLeitura();
  if (rec) leiPintarRecitar();
  leiPintarEdicaoLivre();

  /* O FOCO PRECISA ESTAR DENTRO DO PAINEL CERTO.
   *
   * Na janela "lado a lado" (leiJurLadoALado, material.js) o diálogo abre
   * com .show() em vez de .showModal() — não é modal de verdade, então o
   * navegador nunca move o foco para dentro dele sozinho. Sem foco em
   * lugar nenhum do painel, Page Down e as setas rolam o documento por
   * trás em vez do texto da lei. leiTexto já é um campo (foca sozinho);
   * leiLeitura/leiRecitar são <div>s e precisam de tabIndex para aceitar
   * foco — -1 os tira da ordem de Tab normal, mas continuam focáveis por
   * script, que é só o que se precisa aqui. */
  const painel = ed ? $("leiTexto") : (rec ? $("leiRecitar") : $("leiLeitura"));
  if (painel) {
    if (painel !== $("leiTexto") && !painel.hasAttribute("tabindex")) {
      painel.tabIndex = -1;
    }
    try { painel.focus({ preventScroll: true }); }
    catch (e) { try { painel.focus(); } catch (e2) {} }
  }
}

/* A EDIÇÃO LIVRE DO TEXTO INTEIRO SÓ EXISTE ANTES DA PRIMEIRA GRAVAÇÃO.
 *
 * Com a base já gravada, "editar" deixa de ser um caminho para reescrever
 * o texto colado — vira só uma tela de conferência, somente-leitura. Toda
 * mudança depois disso passa pelo ✏ por artigo (leiEdAbrir/leiEdSalvar,
 * que já grava na camada de alteração) ou por "atualizar para nova
 * versão" (leiAtualizarAbrir). É a aplicação literal do pedido: "o
 * usuário só poderá alterar a camada de leitura e edição". */
function leiEmCamada() {
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  return !!(l && String(l.texto || "").trim());
}

function leiPintarEdicaoLivre() {
  const travado = leiEmCamada();
  const cx = $("leiTexto");
  if (cx) cx.readOnly = travado;
  /* "GRAVAR" FICA ATIVO — de propósito, mesmo com a base travada.
   *
   * A trava real já é o campo ser somente-leitura: ninguém senta e
   * reescreve o artigo à mão. Mas o valor do campo pode mudar por OUTRO
   * caminho que não é digitação — marcar um trecho (matMarcarSelecao)
   * grava direto em $("leiTexto").value por JS, mesmo com readOnly, e
   * PRECISA do botão de gravar para persistir (a mesma marcação que
   * "Marcado — ainda não salvo" está pedindo para salvar). Desativar o
   * botão aqui já quebrou isso uma vez: a pessoa marcava, via a cor
   * pintar, clicava em "gravar" e nada acontecia — o clique caía num
   * botão morto. Com o campo travado, gravar só pode persistir esse
   * tipo de mudança mesmo, então não há razão para desativar. */
  const b = $("btnLeiSalvar");
  if (b) {
    b.title = t(travado ? "lei_salvar_travado_ajuda" : "lei_salvar_livre_ajuda");
  }
  const nota = $("leiTextoTravado");
  if (nota) {
    nota.hidden = !(travado && leiModo === "editar");
    if (!nota.hidden) nota.textContent = t("lei_texto_travado");
  }
}

/* A LEITURA, ARTIGO A ARTIGO.
 * Cada artigo vira um bloco com âncora própria — é o que permite rolar
 * até ele, marcar "parei aqui" e gerar lacuna só dele. Um texto corrido
 * não permitiria nenhuma das três. */
function leiPintarLeitura() {
  const cx = $("leiLeitura");
  if (!cx) return;
  /* uma pintura nova cancela a que ainda estiver em andamento (ver
   * leiPinturaProgressiva): as duas escreveriam no mesmo painel */
  leiPinturaCancelar();
  const progressivo = leiAdiarPintura;
  leiAdiarPintura = false;
  cx.innerHTML = "";
  cx.style.fontSize = leiFonte + "px";
  const bruto = String($("leiTexto").value || "");
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  /* COM LEI GRAVADA, a leitura sempre mostra o texto VIGENTE — base mais
   * o que a camada de alteração registrou (leiArtigosEfetivos). Sem lei
   * ainda (colagem inicial, l é null), não há camada nenhuma para somar:
   * o que se lê é exatamente o que está sendo digitado.
   *
   * A BASE VEM DO CAMPO AO VIVO (bruto), NÃO DE l.texto GRAVADO.
   * Marcar um trecho (matMarcarSelecao) muda só $("leiTexto").value —
   * de propósito não grava a cada clique, para dar chance de desistir
   * (ver o comentário em matMarcarSelecao). Ler l.texto aqui faria a
   * marca recém-criada ficar invisível até a próxima gravação: quem
   * marcasse não veria a cor pintar. l.alteracoes continua vindo do
   * registro gravado — essa camada só muda por um fluxo que já grava
   * sozinho (leiArtigoAlterar/leiAtualizarAplicar), nunca por digitação
   * solta, então não tem o mesmo problema. */
  const arts = l ? leiArtigosEfetivos(Object.assign({}, l, { texto: bruto }))
                 : leiArtigos(bruto);
  const parei = l ? l.parei : "";
  /* a estatística é calculada UMA vez para a lei inteira: fazer a conta
   * dentro do laço releria o banco de questões a cada artigo */
  const ranking = {};
  let rankingFeito = false;
  const prepararRanking = () => {
    if (rankingFeito) return;
    rankingFeito = true;
    try { leiRanking(leiIdAtual).forEach((r) => { ranking[r.num] = r; }); }
    catch (e) {}
  };

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
  /* quais números já foram desenhados: a Constituição repete quase todos
   * entre o corpo e o ADCT, e é isso que decide o id de cada bloco */
  const vistos = {};
  const desenhar = (a) => {
    if (a.divisao && a.divisao !== divisao) {
      divisao = a.divisao;
      const h = document.createElement("div");
      h.className = "lei-div";
      h.textContent = divisao;
      cx.append(h);
    }

    /* A BORDA LATERAL DIZ ONDE ESTÁ O PERIGO, sem que se leia nada.
     *
     * Na véspera da prova ninguém relê 115 artigos: percorre procurando
     * o que já derrubou. Essa informação já existia — o aviso "cai nas
     * suas questões" embaixo do artigo —, mas ela só aparece DEPOIS de
     * se chegar ao artigo e ler até o fim dele. A borda aparece antes,
     * de relance, enquanto se rola. */
    const risco = ranking[a.num];
    const bloco = document.createElement("div");
    bloco.className = "lei-art"
      + (a.num === parei ? " lei-art-parei" : "")
      + (risco && risco.erros > risco.acertos ? " lei-art-perigo"
         : (risco && risco.prova ? " lei-art-caiu" : ""));
    /* =================================================================
     * O NÚMERO DO ARTIGO NÃO É CHAVE ÚNICA
     *
     * Parece que é, e é assim em toda lei ordinária. Não é na
     * Constituição: o corpo vai do art. 1º ao 250, e o ADCT recomeça do
     * art. 1º. Colada inteira do Planalto, ela tem DOIS art. 5º, dois
     * art. 42, dois de quase tudo até o 97.
     *
     * Enquanto o id era só o número, os dois blocos nasciam com o MESMO
     * id — HTML inválido — e "$" devolve sempre o primeiro. Ir ao art.
     * 5º do ADCT levava ao art. 5º da Constituição, silenciosamente, e o
     * texto que aparecia era plausível o bastante para ninguém
     * desconfiar. É o mesmo estrago da marca que caía na ocorrência
     * errada.
     *
     * A PRIMEIRA OCORRÊNCIA GUARDA O ID PELO NÚMERO; as repetidas ganham
     * id pelo ÍNDICE. Assim:
     *  · quem só tem o número na mão — a citação do comentário, "onde
     *    parei", o ranking — continua chamando leiIrArtigo("5") e cai no
     *    art. 5º do CORPO, que é o que a banca cita;
     *  · quem sabe qual ocorrência quer — a grade, que montou a lista a
     *    partir de leiArtigos — passa o índice junto e acerta o ADCT.
     *
     * Um id só por elemento é o que o HTML permite, e por isso são dois
     * NOMES e não dois atributos: getElementById é o único caminho que o
     * aplicativo usa para achar nó, e querySelector não é alternativa
     * aqui porque o simulador dos testes devolve um nó genérico para
     * qualquer seletor — a asserção passaria sem provar nada.
     * ================================================================= */
    bloco.id = vistos[a.num]
      ? "leiArtI_" + a.indice
      : "leiArt_" + a.num.replace(/[^A-Z0-9-]/gi, "");
    vistos[a.num] = true;

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
    /* PARA QUEM NÃO VÊ A COR. O marcador se anuncia por três meios: a
     * cor da borda, o sinal no rótulo e — só agora — o aria-current,
     * que é o único que um leitor de tela entende. "location" é o valor
     * certo: não é a página atual nem um passo de um processo; é o
     * ponto do documento em que a pessoa está. */
    if (a.num === parei) rot.setAttribute("aria-current", "location");
    else if (rot.removeAttribute) rot.removeAttribute("aria-current");
    rot.onclick = () => {
      /* clicar de novo no artigo já marcado TIRA o marcador: sem isso, a
       * única forma de desmarcar seria marcar outro artigo qualquer */
      leiParar(leiIdAtual, a.num === parei ? "" : a.num);
      leiPintar();
    };
    cab.append(rot);

    /* SELO DE ALTERADO/REVOGADO — a camada de leitura e edição não é
     * invisível: quem lê precisa saber, de relance, que aquele artigo não
     * é mais a redação original, e por qual norma. Clicar mostra a
     * redação de origem, sem escondê-la em lugar nenhum. */
    if (a.alterado || a.revogado) {
      const selo = document.createElement("button");
      selo.type = "button";
      selo.className = "lei-selo-alt" + (a.revogado ? " lei-selo-revogado" : "");
      selo.textContent = t(a.revogado ? "lei_selo_revogado" : "lei_selo_alterado",
                           { f: a.fonteAlteracao || "?" });
      if (a.textoOriginal || a.revogado) {
        selo.title = t("lei_selo_ver_original");
        selo.onclick = () => uiAlert((a.textoOriginal || a.corpo || "").slice(0, 4000));
      }
      cab.append(selo);
    }

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

    /* A NOTA — "do que trata este artigo", em poucas palavras. Ela é o
     * que ajuda a reconhecer uma citação sem abrir a lei: "art. 151" não
     * diz nada de cabeça, "art. 151 — isenção na exportação" diz. */
    const temNota = l ? leiNotaDeEm(l, a.num) : "";
    const bNota = document.createElement("button");
    bNota.className = "btn-min lei-art-b" + (temNota ? " lei-art-b-nota" : "");
    bNota.textContent = temNota ? "📝" : t("lei_nota_add");
    bNota.title = temNota || t("lei_nota_add_ajuda");
    bNota.onclick = () => leiNotaAbrir(a);

    cab.append(bCloze, bEd, bNota);

    const corpo = document.createElement("div");
    corpo.className = "lei-art-txt";
    corpo.innerHTML = matParaHtml(leiSemPontilhado(a.texto));

    /* VER A NOTA ANTES DE CLICAR. A marca "nota" carrega texto — sem
     * mostrar ele em algum lugar, a única forma de saber o que foi
     * escrito é clicar e abrir o editor, que é exatamente o que o
     * pedido de baixo tira do caminho (clicar abre um MENU, não o
     * editor direto). O title já é a dica nativa do navegador (mouse
     * parado em cima, ou toque longo no celular) — sem componente novo. */
    if (l) {
      corpo.querySelectorAll('mark[data-marca="nota"]').forEach((mk) => {
        const nota = leiNotaTrechoDeEm(l, mk.textContent || "");
        if (nota) mk.title = nota.texto;
      });
    }

    /* CITAÇÃO DENTRO DA PRÓPRIA LEI TAMBÉM VIRA LINK — "nos termos do
     * art. 5º da Lei 8.666" passa a abrir um preview daquele artigo,
     * sem sair da leitura atual (ver leiLigarCitacoesEm). */
    leiLigarCitacoesEm(corpo, a.num);

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
  };

  /* LEI PEQUENA: síncrona, como sempre foi. LEI GRANDE ABRINDO: o diálogo
   * abre primeiro, com o andamento à vista, e os artigos entram em
   * pedaços (ver leiPinturaProgressiva). Repintar depois (marcar, parei
   * aqui, trocar de modo) é sempre síncrono: a pessoa já está dentro. */
  /* JÁ FOI DESENHADA ANTES, EXATAMENTE ASSIM? Só lei grande e só com lei
   * gravada. A pergunta barata vem primeiro (há entrada desta lei?): na
   * primeira abertura ninguém paga o custo de montar a chave. */
  const grande = !!l && arts.length > LEI_GRANDE;
  /* lei grande: o navegador só desenha o que está na tela (content-visibility,
   * ver .lei-cv no CSS); e leiIrArtigo sabe que ali o salto precisa de cuidado */
  if (cx.classList) cx.classList.toggle("lei-cv", arts.length > LEI_GRANDE);
  const chaveFn = () => leiChavePintura(l, bruto, ranking);
  if (grande && leiCache.some((e) => e.id === l.id)) {
    prepararRanking();
    const nos = leiCacheLer(l.id, chaveFn());
    if (nos) { nos.forEach((n) => cx.append(n)); return; }
  }
  if (progressivo && arts.length > LEI_GRANDE) {
    leiPinturaProgressiva(arts, desenhar, prepararRanking, l ? l.nome : "",
      grande ? () => leiCacheGuardar(l.id, chaveFn(), Array.from(cx.children)) : null);
    return;
  }
  prepararRanking();
  arts.forEach(desenhar);
  if (grande) leiCacheGuardar(l.id, chaveFn(), Array.from(cx.children));
}

/* =====================================================================
 * O DESENHO PRONTO DE UMA LEI GRANDE FICA GUARDADO
 *
 * Reabrir a CF/88 desenhava os 424 artigos de novo, do zero — e quem
 * estuda por questões faz isso o tempo todo: cada citação de uma questão
 * abre a mesma lei. O que fica guardado são os PRÓPRIOS NÓS do DOM, não o
 * HTML deles: cada botão do artigo (marcar "parei", lacuna, editar, nota,
 * link de citação) é uma função ligada ao nó, e HTML escrito de volta
 * perderia todas.
 *
 * A CHAVE É TUDO DE QUE O DESENHO DEPENDE, e nada além:
 *   · o idioma (os rótulos dos botões);
 *   · o registro da lei SEM o texto — notas, alterações, "parei aqui",
 *     capítulos lidos, o que mais houver nele: guardar o desenho e servir
 *     um "parei aqui" velho seria mentir sobre onde a pessoa está;
 *   · o texto do painel (é dele que vêm as marcas, e marcar muda o texto);
 *   · o ranking das questões (a borda vermelha e o aviso "cai nas suas
 *     questões" vêm dele).
 * Qualquer diferença, e o desenho é refeito — e o novo substitui o velho.
 * Os links de citação não entram: eles só descobrem a lei citada no
 * CLIQUE (leiCitacaoBotao), então não há o que envelheça no nó.
 *
 * SÓ LEI GRANDE, e no máximo duas: é onde o desenho pesa, e cada uma
 * segura alguns milhares de nós na memória.
 * ===================================================================== */
const LEI_CACHE_MAX = 2;
let leiCache = [];            /* [{ id, chave, nos }] — a mais recente por último */

/* dois hashes de 32 bits (DJB2 e FNV-1a) e o tamanho: 300 mil caracteres
 * em poucos milissegundos, e uma colisão exigiria as três coisas iguais */
function leiHashTexto(s) {
  const x = String(s);
  let a = 5381, b = 2166136261;
  for (let i = 0; i < x.length; i++) {
    const c = x.charCodeAt(i);
    a = (((a << 5) + a) + c) | 0;
    b = Math.imul(b ^ c, 16777619);
  }
  return (a >>> 0).toString(36) + "." + (b >>> 0).toString(36) + "." + x.length;
}

function leiChavePintura(l, bruto, ranking) {
  const resto = Object.assign({}, l);
  delete resto.texto;
  return [LANG, l.id, leiHashTexto(bruto), leiHashTexto(JSON.stringify(resto)),
    leiHashTexto(JSON.stringify(ranking || {}))].join("|");
}

function leiCacheLer(id, chave) {
  const i = leiCache.findIndex((e) => e.id === id && e.chave === chave);
  if (i < 0) return null;
  const e = leiCache.splice(i, 1)[0];
  leiCache.push(e);
  return e.nos;
}

function leiCacheGuardar(id, chave, nos) {
  if (!chave || !nos || !nos.length) return;
  /* UMA ENTRADA POR LEI: a versão nova substitui a velha, que já não serve */
  leiCache = leiCache.filter((e) => e.id !== id);
  leiCache.push({ id, chave, nos });
  while (leiCache.length > LEI_CACHE_MAX) leiCache.shift();
}

function leiCacheLimpar() { leiCache = []; }

/* =====================================================================
 * ABRIR UMA LEI GRANDE SEM CONGELAR A TELA
 *
 * O PROBLEMA. leiAbrir pintava a lei inteira ANTES de abrir o diálogo, e
 * a thread principal ocupada não deixa o navegador desenhar nada: a
 * pessoa tocava no link e a tela ficava parada por segundos (a CF/88 tem
 * 424 artigos, o CTN 231), sem saber se o toque pegou.
 *
 * O CONSERTO tem duas metades. (1) O diálogo abre primeiro, com um painel
 * dizendo qual lei e quanto falta, e o navegador ganha DOIS quadros para
 * realmente desenhá-lo antes do trabalho pesado. (2) Os artigos entram em
 * pedaços curtos, cedendo um quadro entre um e outro — e vão aparecendo
 * na tela em vez de tudo de uma vez no fim.
 *
 * NA ORDEM DO DOCUMENTO, SEMPRE. matGuardarOffset conta as ocorrências
 * de um trecho a partir do início do painel: desenhar o artigo pedido
 * primeiro, ou de trás para a frente, faria uma marca cair na ocorrência
 * errada — em silêncio. Em ordem, tudo o que vem antes de qualquer ponto
 * onde a pessoa possa tocar já está desenhado.
 *
 * QUALQUER REPINTURA CANCELA A EM ANDAMENTO (leiPintarLeitura começa por
 * leiPinturaCancelar): marcar, trocar de modo ou abrir outra lei durante
 * o carregamento apenas refaz o painel por inteiro, na hora. Por isso
 * nada precisa ficar desativado enquanto carrega.
 * ===================================================================== */
const LEI_GRANDE = 60;        /* artigos: acima disso a abertura mostra andamento */
let LEI_FATIA_MS = 12;        /* quanto se desenha por quadro antes de ceder (let: o teste o zera) */
let leiAdiarPintura = false;  /* leiAbrir pede: a PRÓXIMA pintura é a de abertura */
let leiPintura = null;        /* a pintura em pedaços que está rodando, se houver */

/* Cede o controle ao navegador até o próximo quadro. rAF sozinho não
 * basta: numa aba escondida ele nunca dispara, e a lei ficaria pela
 * metade para sempre — o setTimeout garante que o desenho continua. */
function leiCedeQuadro() {
  return new Promise((resolve) => {
    let feito = false;
    const fim = () => { if (!feito) { feito = true; resolve(); } };
    try { requestAnimationFrame(fim); } catch (e) {}
    setTimeout(fim, 60);
  });
}

/* resolve quando NÃO há mais pintura em pedaços em andamento (terminou ou
 * foi cancelada) — para o teste, e para quem precise do texto todo */
function leiPinturaPronta() {
  return leiPintura ? leiPintura.pronta : Promise.resolve();
}

function leiPinturaCancelar() {
  const p = leiPintura;
  if (!p) return;
  leiPintura = null;
  leiCargaOcultar();
  p.fim();
}

function leiCargaMostrar(texto, frac) {
  const cx = $("leiCarga");
  if (!cx) return;
  cx.hidden = false;
  if ($("leiCargaTxt")) $("leiCargaTxt").textContent = texto;
  if ($("leiCargaBarra")) $("leiCargaBarra").style.width = Math.round((frac || 0) * 100) + "%";
}

function leiCargaOcultar() {
  const cx = $("leiCarga");
  if (cx) cx.hidden = true;
}

/* se a pessoa pediu um artigo específico e o pedaço dele já entrou, vai
 * até ele (uma vez só) */
function leiPinturaIrAoAlvo(p) {
  if (!p.alvo) return;
  const el = $("leiArt_" + p.alvo.replace(/[^A-Z0-9-]/gi, ""));
  if (!el) return;
  const num = p.alvo;
  p.alvo = "";
  leiIrArtigo(num);
  try {
    leiReg("navegar", "chegou ao artigo citado durante o carregamento",
           "art. " + num + " · " + p.feitos + " de " + p.total + " artigos já na tela");
  } catch (e) {}
}

function leiPinturaProgressiva(arts, desenhar, preparar, nome, aoTerminar) {
  const dlg = $("dlgLeiSeca");
  let fim = () => {};
  const pronta = new Promise((resolve) => { fim = resolve; });
  const p = leiPintura = { arts, total: arts.length, feitos: 0, alvo: "", pronta, fim };
  const nomeLei = nome || t("lei_carga_sem_nome");
  leiCargaMostrar(t("lei_carga_abrindo", { nome: nomeLei }), 0);

  const texto = () => t("lei_carga_desenhando", { i: p.feitos, n: p.total })
    + (p.alvo ? " · " + t("lei_carga_indo", { a: p.alvo }) : "");

  (async () => {
    try {
      await leiCedeQuadro();
      await leiCedeQuadro();
      if (leiPintura !== p) return;
      preparar();
      while (p.feitos < p.total) {
        if (leiPintura !== p) return;
        if (dlg && !dlg.open) { leiPinturaCancelar(); return; }
        const t0 = performance.now();
        do { desenhar(arts[p.feitos++]); }
        while (p.feitos < p.total && performance.now() - t0 < LEI_FATIA_MS);
        leiCargaMostrar(texto(), p.feitos / p.total);
        leiPinturaIrAoAlvo(p);
        if (p.feitos < p.total) await leiCedeQuadro();
      }
      if (leiPintura === p) {
        leiPintura = null;
        leiCargaOcultar();
        leiPinturaIrAoAlvo(p);
        /* desenhada inteira, sem interrupção: vale guardar */
        if (aoTerminar) { try { aoTerminar(); } catch (e) {} }
        fim();
      }
    } catch (e) {
      /* um defeito no meio do desenho não pode deixar a lei pela metade
       * em silêncio: registra, termina o que falta de uma vez e libera */
      try { leiReg("erro", "falha ao desenhar a lei em pedaços", (e && e.message) || ""); } catch (x) {}
      try { while (p.feitos < p.total) desenhar(arts[p.feitos++]); } catch (x) {}
      if (leiPintura === p) leiPintura = null;
      leiCargaOcultar();
      fim();
    }
  })();
}

/* =====================================================================
 * CITAÇÃO DENTRO DA PRÓPRIA LEI — abre um preview, não a lei inteira
 *
 * "Nos termos do art. 156-A, §1º, da CF/88" dentro do texto de OUTRA lei
 * já tinha tudo pronto para virar link — leiCitacoesNoTexto (posição +
 * número + rótulo) e leiCasarRotulo (acha a lei certa na biblioteca, ou
 * devolve null em caso de dúvida) já existiam para o mesmo gesto vindo
 * do comentário de uma questão (qsUiComentario, docs/questoes-ui.js).
 * Só nunca tinham sido ligados DENTRO do leitor da lei.
 *
 * POR QUE PREVIEW, E NÃO ABRIR A LEI CITADA: abrir substituiria a leitura
 * atual inteira (só existe um <dialog id="dlgLeiSeca">, ver leiAtual/
 * leiIdAtual) — trocar de tela e ter que voltar para uma pergunta que
 * "o que esse artigo diz" já responde em duas linhas. Quem realmente quer
 * navegar tem o botão "abrir a lei inteira" dentro do preview, que aí sim
 * reaproveita leiAbrirNoArtigo — a MESMA porta que a questão já usa,
 * inclusive o mesmo "voltar de onde vim" (leiVoltaPara).
 * ===================================================================== */

/* Percorre o HTML já desenhado (marcas, negrito, parágrafos) SÓ NOS NÓS
 * DE TEXTO — nunca mexe nos elementos que matParaHtml já montou. Walker
 * escrito à mão (não document.createTreeWalker) porque childNodes/
 * nodeType já são o que o simulador dos testes sabe navegar; a API mais
 * nova não tinha por que existir ali. */
function leiLigarCitacoesEm(el, origemNum) {
  if (!el || !el.childNodes) return;
  Array.from(el.childNodes).forEach((no) => {
    if (no.nodeType === 3) {                       // nó de texto
      leiCitarNoTexto(no, origemNum);
    } else if (no.nodeType === 1) {                 // elemento — desce
      leiLigarCitacoesEm(no, origemNum);
    }
  });
}

function leiCitarNoTexto(noTexto, origemNum) {
  /* textContent, não nodeValue: os dois valem o mesmo num nó de texto de
   * verdade, mas o texto que nasce do innerHTML (matParaHtml) só ganha
   * textContent no simulador dos testes — nodeValue ficava vazio ali. */
  const txt = String(noTexto.textContent || "");
  let cits = [];
  try { if (typeof leiCitacoesNoTexto === "function") cits = leiCitacoesNoTexto(txt); }
  catch (e) { cits = []; }
  /* SÓ CITAÇÃO A OUTRA LEI, NOMEADA. Sem isto, o "Art. 5º." com que o
   * PRÓPRIO artigo começa (o texto guardado carrega o número junto — ver
   * leiArtigoAlterar) batia como citação de rótulo vazio e virava um
   * link morto em cima do próprio título de cada artigo, em toda lei. */
  cits = cits.filter((c) => c && c.rotulo);
  if (!cits.length) return;
  const pai = noTexto.parentNode;
  if (!pai || !pai.insertBefore) return;

  let pos = 0;
  cits.forEach((c) => {
    if (c.ini > pos) pai.insertBefore(document.createTextNode(txt.slice(pos, c.ini)), noTexto);
    pai.insertBefore(leiCitacaoBotao(c, origemNum), noTexto);
    pos = c.fim;
  });
  if (pos < txt.length) pai.insertBefore(document.createTextNode(txt.slice(pos)), noTexto);
  pai.removeChild(noTexto);
}

function leiCitacaoBotao(c, origemNum) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lei-cita-link";
  b.textContent = c.texto;
  b.title = t("lei_cita_link_ajuda");
  b.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    leiCitacaoPreviewAbrir(c, origemNum);
  };
  return b;
}

let leiCitaPreviewOrigemArt = "";

/* Resolve a lei citada, busca o artigo VIGENTE nela (leiArtigosEfetivos —
 * mostra a redação alterada, se houver, com o mesmo selo da leitura
 * normal) e abre um diálogo pequeno por cima, sem tocar em leiAtual/
 * leiIdAtual da lei que está sendo lida agora. */
function leiCitacaoPreviewAbrir(c, origemNum) {
  if (!$("dlgLeiCitaPreview")) return;
  leiCitaPreviewOrigemArt = origemNum || "";
  let lei = null;
  try { lei = leiCasarRotulo(c.rotulo, leisLista()); } catch (e) { lei = null; }

  if (!lei) {
    $("leiCitaPreviewTitulo").textContent = c.rotulo
      ? t("lei_cita_nao_achou_rotulo", { l: c.rotulo }) : t("lei_cita_nao_achou");
    $("leiCitaPreviewArtigo").textContent = "";
    $("leiCitaPreviewTexto").textContent = "";
    $("btnLeiCitaPreviewAbrir").hidden = true;
    abrirModal("dlgLeiCitaPreview");
    return;
  }

  const efetivos = leiArtigosEfetivos(lei);
  const art = efetivos.filter((x) => x.num === c.num)[0];
  $("leiCitaPreviewTitulo").textContent = lei.nome;
  if (!art) {
    $("leiCitaPreviewArtigo").textContent = "";
    $("leiCitaPreviewTexto").textContent = t("lei_cita_artigo_nao_achou", { a: c.numCru });
  } else {
    $("leiCitaPreviewArtigo").textContent = art.rotulo
      + (art.alterado ? " " + t("lei_selo_alterado_curto", { f: art.fonteAlteracao || "?" }) : "")
      + (art.revogado ? " " + t("lei_selo_revogado", { f: art.fonteAlteracao || "?" }) : "");
    let texto = art.texto;
    /* o trecho CITADO (inciso, parágrafo), separado embaixo do artigo */
    try {
      const un = leiAcharUnidades(art.texto, c);
      if (un.length) {
        texto += "\n\n▶ " + t("lei_cita_trecho") + ":\n" + un.map((u) => leiRotuloDaUnidade(u) + " — "
          + art.texto.split("\n").slice(u.linha, u.linhaFim + 1).join(" ").trim()).join("\n");
      }
    } catch (e) {}
    $("leiCitaPreviewTexto").textContent = texto;
  }
  leiCitaPreviewAlvo = { lei, num: c.num, sub: c };
  $("btnLeiCitaPreviewAbrir").hidden = false;
  abrirModal("dlgLeiCitaPreview");
  try { leiReg("citacao", "preview de citação aberto", lei.nome + " · art. " + c.numCru); }
  catch (e) {}
}

let leiCitaPreviewAlvo = null;

/* O ESCAPE HATCH — quem realmente quer navegar. Reaproveita 100% do
 * caminho que a questão já usa: leiAbrirNoArtigo empilha via
 * showModal(), e leiVoltaPara volta para a lei e o artigo de origem
 * quando a lei citada for fechada. */
function leiCitacaoPreviewAbrirLeiInteira() {
  if (!leiCitaPreviewAlvo || !leiCitaPreviewAlvo.lei) return;
  const alvo = leiCitaPreviewAlvo;
  const disciplina = leiAtual && leiAtual.disciplina;
  const topico = leiAtual && leiAtual.topico;
  const idOrigem = leiIdAtual;
  const artOrigem = leiCitaPreviewOrigemArt;
  $("dlgLeiCitaPreview").close();
  if (disciplina && topico) {
    leiVoltaPara = () => {
      try { leiAbrirNoArtigo(disciplina, topico, idOrigem, artOrigem); } catch (e) {}
    };
  }
  leiAbrirNoArtigo(disciplina, topico, alvo.lei.id, alvo.num, alvo.sub);
}

/* =====================================================================
 * A NOTA DO ARTIGO — "do que ele trata", para reconhecer sem abrir
 *
 * Uma citação sozinha ("art. 151") não diz nada de cabeça a quem não
 * decorou a lei — a diferença entre "onde estava mesmo isso?" e
 * reconhecer de relance. A nota é curta de propósito: não é um resumo
 * do artigo, é o gancho que lembra do assunto ("isenção na
 * exportação"), não o texto reescrito.
 *
 * A IA PODE SUGERIR; QUEM DECIDE SE FICA É QUEM ESTUDA — a mesma regra
 * da tese e do resumo da jurisprudência. Por isso não há "aplicar
 * direto": a sugestão cai na MESMA caixa que se edita à mão, e só vira
 * nota de verdade quando a pessoa clica em guardar.
 * ===================================================================== */
let leiNotaArt = null;
/* A NOTA POR TRECHO usa a MESMA janela (dlgLeiNota), em vez de uma
 * segunda janela quase idêntica — só troca o que está em `leiNotaArt`
 * (nota de artigo) por `leiNotaTrechoAlvo` (nota de trecho), os dois
 * mutuamente exclusivos: abrir um zera o outro. leiNotaSugerir/
 * leiNotaSalvar abaixo checam qual dos dois está ativo. */
let leiNotaTrechoAlvo = "";

function leiNotaAbrir(a) {
  if (!a || !$("dlgLeiNota")) return;
  leiNotaArt = a;
  leiNotaTrechoAlvo = "";
  $("leiNotaTitulo").textContent = t("lei_nota_titulo", { a: a.rotulo });
  $("leiNotaTexto").placeholder = t("lei_nota_placeholder");
  $("leiNotaTexto").value = leiIdAtual ? leiNotaDe(leiIdAtual, a.num) : "";
  $("leiNotaPrompt").hidden = true;
  $("leiNotaPromptTxt").value = "";
  abrirModal("dlgLeiNota");
}

/* Chamada depois que a marca "nota" já pegou de verdade
 * (matMarcarSelecao devolveu true) — o trecho é o mesmo que estava
 * selecionado, capturado ANTES da marcação (leiNotaTrechoMarcar). */
function leiNotaTrechoAbrir(trecho) {
  if (!trecho || !$("dlgLeiNota")) return;
  leiNotaArt = null;
  leiNotaTrechoAlvo = trecho;
  $("leiNotaTitulo").textContent = t("lei_nota_trecho_titulo",
    { t: trecho.length > 60 ? trecho.slice(0, 60) + "…" : trecho });
  $("leiNotaTexto").placeholder = t("lei_nota_trecho_placeholder");
  const existente = leiIdAtual ? leiNotaTrechoDe(leiIdAtual, trecho) : null;
  $("leiNotaTexto").value = existente ? existente.texto : "";
  $("leiNotaPrompt").hidden = true;
  $("leiNotaPromptTxt").value = "";
  abrirModal("dlgLeiNota");
}

function leiNotaSugerir() {
  if (leiNotaArt) {
    $("leiNotaPromptTxt").value = t("lei_nota_prompt",
      { artigo: leiNotaArt.rotulo, texto: leiNotaArt.texto });
    $("leiNotaPrompt").hidden = false;
    try { leiReg("nota", "sugestão de nota copiada", leiNotaArt.rotulo); } catch (e) {}
    return;
  }
  if (leiNotaTrechoAlvo) {
    $("leiNotaPromptTxt").value = t("lei_nota_trecho_prompt",
      { texto: leiNotaTrechoAlvo });
    $("leiNotaPrompt").hidden = false;
    try { leiReg("nota", "sugestão de nota de trecho copiada",
             leiNotaTrechoAlvo.slice(0, 60)); } catch (e) {}
  }
}

function leiNotaCopiarPrompt() {
  try { navigator.clipboard.writeText($("leiNotaPromptTxt").value); } catch (e) {}
}

function leiNotaSalvar() {
  if (!leiIdAtual) return false;
  const texto = String($("leiNotaTexto").value || "").trim();

  if (leiNotaTrechoAlvo) {
    const ok = leiNotaTrechoGuardar(leiIdAtual, leiNotaTrechoAlvo, texto);
    if (ok) {
      $("dlgLeiNota").close();
      try { leiReg("nota", texto ? "nota de trecho guardada" : "nota de trecho apagada",
               leiNotaTrechoAlvo.slice(0, 60)); }
      catch (e) {}
      leiPintarLeitura();
    }
    return ok;
  }

  if (!leiNotaArt) return false;
  const ok = leiNotaGuardar(leiIdAtual, leiNotaArt.num, texto);
  if (ok) {
    $("dlgLeiNota").close();
    try { leiReg("nota", texto ? "nota guardada" : "nota apagada", leiNotaArt.rotulo); }
    catch (e) {}
    leiPintarLeitura();
  }
  return ok;
}

/* Botão da barra de marcas: marca o trecho selecionado como "nota" e,
 * se pegou de verdade, já abre a caixa para escrever a anotação — o
 * gesto vira um só (selecionar → clicar → escrever), sem uma parada
 * extra só para "confirmar que marcou". */
function leiNotaTrechoMarcar() {
  const trecho = matSelGuardada;
  if (!matMarcarSelecao("nota", "lei")) return;
  leiNotaTrechoAbrir(trecho);
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
  const camada = leiEmCamada();
  leiEdNum = num ? leiNumNormal(num) : "";

  const arts = camada ? leiArtigosEfetivos(l) : leiArtigos(texto);
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

  /* o campo da norma alteradora só aparece depois que a lei já tem base:
   * é a mesma distinção da janela inteira — colagem inicial não tem
   * "norma que alterou", porque nada foi alterado ainda */
  const cxFonte = $("leiArtFonteCx");
  if (cxFonte) {
    cxFonte.hidden = !camada;
    if (camada) $("leiArtFonte").value = (a && a.fonteAlteracao) || "";
  }

  /* a lista de artigos ao lado: trocar de artigo sem fechar e reabrir */
  const cx = $("leiArtLista");
  if (cx) {
    cx.innerHTML = "";
    arts.forEach((x) => {
      const b = document.createElement("button");
      b.className = "lei-art-item" + (x.num === leiEdNum ? " lei-art-item-on" : "")
        + (x.alterado || x.revogado ? " lei-art-item-alt" : "");
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
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const texto = String($("leiTexto").value || "");
  const a = leiEdNum
    ? (leiEmCamada() ? leiArtigosEfetivos(l) : leiArtigos(texto))
        .filter((x) => x.num === leiEdNum)[0]
    : null;
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

  if (leiEmCamada()) {
    const fonte = String(($("leiArtFonte") || {}).value || "").trim();
    const l = leiDe(leiIdAtual);
    const efetivos = leiArtigosEfetivos(l);
    if (!leiEdNum) {
      if (efetivos.some((x) => x.num === lido.num)) {
        $("leiArtAviso").textContent = t("lei_art_ja_existe", { a: lido.numCru });
        return false;
      }
    } else if (lido.num !== leiEdNum) {
      /* renumerar: sai do número antigo (revogado se era da base, ou
       * simplesmente esquecido se era só da camada) e entra no novo */
      const eraDaBase = !!leiArtigo(l.texto, leiEdNum);
      leiArtigoAlterar(leiIdAtual, leiEdNum,
        eraDaBase ? { revogado: true, fonteAlteracao: fonte } : null);
    }
    leiArtigoAlterar(leiIdAtual, lido.num, { texto: novo, fonteAlteracao: fonte });
    leiEdNum = lido.num;
    leiReg("editar", "artigo alterado (camada de leitura e edição)",
           lido.rotulo + (fonte ? " · " + fonte : ""));
    if (!silencioso) {
      $("dlgLeiArt").close();
      leiTrocarModo("ler");
      leiIrArtigo(lido.num);
    }
    leiPintar();
    return true;
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

  if (leiEmCamada()) {
    const l = leiDe(leiIdAtual);
    const a = leiArtigosEfetivos(l).filter((x) => x.num === leiEdNum)[0];
    if (!a) return false;
    const eraDaBase = !!leiArtigo(l.texto, leiEdNum);
    if (!(await uiConfirm(t(eraDaBase ? "lei_art_revogar_conf" : "lei_art_apagar_conf", {
      a: a.rotulo, txt: (a.corpo || "").slice(0, 160) })))) return false;
    const fonte = String(($("leiArtFonte") || {}).value || "").trim();
    leiArtigoAlterar(leiIdAtual, leiEdNum, eraDaBase ? { revogado: true, fonteAlteracao: fonte } : null);
    $("dlgLeiArt").close();
    leiTrocarModo("ler");
    leiPintar();
    return true;
  }

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
/* UM EXERCÍCIO SÓ: o artigo fechado. Houve um segundo, "texto com lacunas"
 * (o artigo inteiro com prazos, percentuais e "salvo/vedado/somente"
 * apagados), escolhido por um botão no alto da lista. Saiu: era lento — cada
 * troca repintava todos os artigos, e a cada repintura o texto de cada um
 * passava por leiComLacunas — e só escondia informação de pouca serventia
 * para quem estava treinando. A necessidade de treinar com lacunas passa a
 * ser atendida pela criação de cartões (leiClozeAbrir e o que vier dela),
 * que é o lugar de repetir espaçado. leiComLacunas e leiQuantasLacunas
 * ficam: os cartões de lacuna usam as duas. */
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
  /* QUAL EXERCÍCIO ESTÁ VALENDO, escrito antes de tudo. Sem esta linha
   * a tela mostra dois desenhos muito diferentes — artigos fechados ou
   * artigos com buracos — e nada dizia qual dos dois era, nem que havia
   * dois. */
  cab.textContent = t("lei_rec_modo_esc")
    + " " + t("lei_recitar_ajuda", {
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

/* O ÍNDICE, QUANDO QUEM CHAMA SABE QUAL OCORRÊNCIA QUER.
 * Sem ele, "ir ao art. 5º" na Constituição inteira sempre cai no do
 * corpo — inclusive quando o clique veio do art. 5º do ADCT, que está
 * quatrocentos artigos abaixo. Com ele, a grade acerta os dois. O
 * número continua valendo sozinho: é o que a citação de uma questão
 * tem para oferecer. */
function leiIrArtigo(num, indice) {
  const alvo = leiNumNormal(num);
  const el = (indice !== undefined && indice !== null && $("leiArtI_" + indice))
    || $("leiArt_" + alvo.replace(/[^A-Z0-9-]/gi, ""));
  if (!el) return false;
  /* "center" E NÃO "start" ERA O DEFEITO, para artigo mais alto que a
   * tela. O CASO REAL: uma Emenda Constitucional cujo Art. 1º cita, por
   * inteiro, a nova redação de dezenas de artigos da Constituição — um
   * bloco de milhares de pixels. "center" mira o MEIO desse bloco, não
   * o começo: quem tocava "continuar no art. 1º" caía no meio de um
   * parágrafo qualquer, sem o cabeçalho "Art. 1º" à vista em lugar
   * nenhum — e não tinha como saber que chegou aonde pediu. "start" põe
   * o topo do bloco — o cabeçalho — no topo da tela, que é o que "ir a
   * um artigo" promete: mostrar ONDE ele começa. */
  /* EM LEI GRANDE O SALTO É INSTANTÂNEO, E DADO DUAS VEZES.
   *
   * Os artigos fora da tela não têm layout (content-visibility): ficam com
   * um tamanho ESTIMADO. Um salto suave mira a posição calculada no
   * começo e, conforme os artigos entram e ganham o tamanho real, o alvo
   * se afasta — medido, terminava ~2400 px (dez artigos) antes do pedido.
   * O salto instantâneo cai perto; o segundo, depois que o navegador
   * desenhou os vizinhos, acerta o resto. Em lei pequena nada disso vale
   * e o salto continua suave. */
  const painelLei = $("leiLeitura");
  const grandeLei = !!(painelLei && painelLei.classList && painelLei.classList.contains("lei-cv"));
  if (el.scrollIntoView) {
    try { el.scrollIntoView({ block: "start", behavior: grandeLei ? "auto" : "smooth" }); }
    catch (e) {}
    if (grandeLei) {
      setTimeout(() => {
        try { if (el.isConnected !== false) el.scrollIntoView({ block: "start", behavior: "auto" }); }
        catch (e) {}
      }, 120);
    }
  }
  if (el.classList) {
    el.classList.add("lei-art-pisca");
    /* 2200ms = os quatro pulsos de ".55s" da animação matPisca inteiros —
     * tirar a classe antes cortaria o contorno no meio de um pulso */
    setTimeout(() => { try { el.classList.remove("lei-art-pisca"); } catch (e) {} }, 2200);
  }
  return true;
}

/* =====================================================================
 * ROLAR ATÉ O INCISO CITADO
 *
 * "arts. 148, I, 153, I, II, IV e V; e 154, II" — a citação diz o INCISO, e
 * levar só ao artigo obriga a procurar o inciso dentro dele. leiAcharUnidades
 * (lei-seca.js) lê a estrutura do artigo (parágrafo, inciso, alínea, item) e
 * diz quais linhas são as citadas; aqui a tela rola até a primeira e destaca
 * todas. Quando o inciso vem no meio de um trecho corrido (uma linha só, "I -
 * …; II - …"), a linha inteira é destacada: é o menor pedaço que a tela tem.
 * ===================================================================== */
function leiBlocoDoArtigo(num, indice) {
  const alvo = leiNumNormal(num);
  return (indice !== undefined && indice !== null && $("leiArtI_" + indice))
    || $("leiArt_" + alvo.replace(/[^A-Z0-9-]/gi, ""));
}

/* os elementos de texto do artigo desenhado, na ordem em que aparecem */
function leiLinhasDesenhadas(el, acc) {
  acc = acc || [];
  Array.from((el && el.children) || []).forEach((c) => {
    const tag = String(c.tagName || c.tag || "").toUpperCase();
    if (tag === "P" || tag === "LI" || (c.className && /mat-num/.test(c.className))) acc.push(c);
    else leiLinhasDesenhadas(c, acc);
  });
  return acc;
}

function leiIrUnidade(num, sub) {
  if (!sub || !((sub.incisos || []).length || (sub.paragrafos || []).length)) return false;
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  if (!l) return false;
  const a = leiArtigosEfetivos(l).filter((x) => x.num === leiNumNormal(num))[0];
  const bloco = leiBlocoDoArtigo(num);
  if (!a || !bloco) return false;
  const unidades = leiAcharUnidades(a.texto, sub);
  if (!unidades.length) return false;
  const linhas = a.texto.split("\n");
  const so = (s) => String(s || "").replace(/==[!?§*~@]?|\*\*|_/g, "").replace(/[^0-9A-Za-zÀ-ú]/g, "").slice(0, 14).toLowerCase();
  const desenhadas = leiLinhasDesenhadas(bloco);
  const alvos = [];
  unidades.forEach((u) => {
    const ini = so(linhas[u.linha]);
    if (!ini) return;
    const el = desenhadas.filter((e) => so(e.textContent) === ini)[0];
    if (el && alvos.indexOf(el) < 0) alvos.push(el);
  });
  if (!alvos.length) return false;
  alvos.forEach((e) => { if (e.classList) e.classList.add("lei-unidade-alvo"); });
  try { alvos[0].scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
  setTimeout(() => alvos.forEach((e) => { try { e.classList.remove("lei-unidade-alvo"); } catch (x) {} }), 4500);
  try { leiReg("navegar", "rolou até o trecho citado", "art. " + num + " · " + unidades.map(leiRotuloDaUnidade).join(", ")); }
  catch (e) {}
  return true;
}

/* =====================================================================
 * IR A UM ARTIGO: UMA GRADE, NÃO UMA CAIXA DE DIGITAÇÃO
 *
 * Perguntar "qual artigo?" e esperar que a pessoa digite exige que ela
 * SAIBA o número — e quem está lendo uma lei nova quase nunca sabe:
 * quer voltar "àquele que falava de prazo", que estava "lá pelo meio".
 * Digitar também erra: "8" e "8º" e "8-A" são três coisas, e a caixa
 * respondia "não achei" para duas delas.
 *
 * A grade mostra o que EXISTE. Não há como pedir um artigo que não há,
 * não há grafia para acertar, e a numeração inteira à vista dá a
 * dimensão da lei — que é informação por si só.
 *
 * OS SELOS VIAJAM JUNTO: o artigo onde parei e os que mais caem nas
 * suas questões vêm marcados na própria grade. É onde a pergunta "por
 * onde eu continuo?" costuma ser respondida.
 * ===================================================================== */
function leiIrAbrir() {
  const arts = leiArtigos(String($("leiTexto").value || ""));
  if (!arts.length) { uiAlert(t("lei_sem_artigos")); return; }
  const cx = $("leiIrGrade");
  if (!cx) {
    /* sem a grade no HTML, a caixa antiga — nunca ficar sem caminho */
    return leiIrDigitando(arts);
  }
  cx.innerHTML = "";
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const parei = l ? l.parei : "";
  const ranking = {};
  try { leiRanking(leiIdAtual).forEach((r) => { ranking[r.num] = r; }); }
  catch (e) {}

  /* A GRADE PRECISA DIZER ONDE CADA FAIXA COMEÇA.
   *
   * Com 424 números iguais em fila, "1º" aparece duas vezes e não há
   * como saber que o segundo é o ADCT — a pessoa clica no primeiro,
   * chega ao lugar errado e conclui que a grade está quebrada. O
   * cabeçalho de divisão não é enfeite: é o que transforma a repetição
   * de numeração da Constituição de defeito aparente em informação.
   *
   * E é por isso que a lista NÃO é ordenada por número: a ordem é a do
   * documento. Ordenar embaralharia o art. 5º do ADCT com o do corpo e
   * destruiria a única coisa que os distingue — a posição. */
  let divGrade = "";
  arts.forEach((a) => {
    if (a.divisao && a.divisao !== divGrade) {
      divGrade = a.divisao;
      const h = document.createElement("div");
      h.className = "lei-ir-div";
      h.textContent = divGrade;
      cx.append(h);
    }
    const b = document.createElement("button");
    b.type = "button";
    const est = ranking[a.num];
    b.className = "lei-ir-n"
      + (a.num === parei ? " lei-ir-parei" : "")
      + (est && est.prova ? " lei-ir-prova" : "")
      + (est && est.erros > est.acertos ? " lei-ir-erro" : "");
    b.textContent = a.numCru;
    const dicas = [];
    if (a.num === parei) dicas.push(t("lei_ir_dica_parei"));
    if (est && est.prova) dicas.push(t("lei_ir_dica_prova", { n: est.prova }));
    if (est && est.questoes) dicas.push(t("lei_ir_dica_q", { n: est.questoes }));
    b.title = dicas.length ? dicas.join(" · ") : t("lei_ir_dica_simples", { a: a.rotulo });
    b.onclick = () => {
      $("dlgLeiIr").close();
      /* o índice viaja junto: é o que separa o art. 5º do corpo do art.
       * 5º do ADCT, e a grade é quem sabe em qual dos dois se clicou */
      leiIrArtigo(a.num, a.indice);
    };
    cx.append(b);
  });
  if ($("leiIrSub")) {
    $("leiIrSub").textContent = t("lei_ir_sub", { n: arts.length });
  }
  abrirModal("dlgLeiIr");
  try { leiReg("navegar", "grade de artigos aberta", arts.length + " artigos"); }
  catch (e) {}
}

/* O caminho antigo, guardado inteiro: ele ainda serve numa lei de
 * trezentos artigos, onde a grade é grande demais para o olho. */
async function leiIrDigitando(lista) {
  const arts = lista || leiArtigos(String($("leiTexto").value || ""));
  if (!arts.length) { uiAlert(t("lei_sem_artigos")); return; }
  const v = await uiTexto(t("lei_ir_pergunta", {
    de: arts[0].numCru, ate: arts[arts.length - 1].numCru }), "");
  if (v === null) return;
  if (!leiIrArtigo(v)) uiAlert(t("lei_ir_nao_achou", { a: v }));
}

/* ---------------------------------------------------------------------
 * GRAVAR, COLAR E VINCULAR
 * ------------------------------------------------------------------ */

function leiGravar(opc) {
  if (!leiAtual) return;
  const txt = String($("leiTexto").value || "");
  let l = leiIdAtual ? leiDe(leiIdAtual) : null;

  if (!l) {
    /* ARTIGOS REPETIDOS: ANTES de a lei nascer, a pessoa vê a lista e
     * escolhe qual fica (leiDuplicadosAbrir). A lei só é criada no
     * "confirmar", que volta aqui já com o texto resolvido e a marca
     * "conferido" — sem ela, um número que a pessoa mandou manter nas
     * duas cópias (corpo e ADCT) reabriria a conferência para sempre.
     * Devolve "pendente" para quem chamou não fechar nem trocar de lei
     * no meio da escolha. */
    /* TEXTO NUMA LINHA SÓ vem ANTES dos repetidos: só depois de separado o
     * leitor enxerga os artigos (e os que se repetem) */
    if (!(opc && opc.separado)) {
      const sep = leiSepararColagem(txt);
      if (sep.aplicavel) {
        leiSepararPerguntar(sep).then((ok) => {
          try { leiReg("gravar", ok ? "texto numa linha só: separado em artigos"
                                   : "texto numa linha só: a pessoa voltou para revisar",
                       sep.artigos.length + " artigos"); } catch (e) {}
          if (!ok) return;
          $("leiTexto").value = sep.texto;
          leiGravar({ separado: true });
        });
        return "pendente";
      }
    }
    /* LIMPEZA DO TEXTO DE PDF vem antes dos repetidos: só depois de corrigir
     * "Art . 382" e de unir a remissão partida o leitor enxerga os artigos
     * (e os que se repetem) do jeito que são. A pessoa vê e aprova tudo em
     * leiRevisarColagemAbrir; a marca "limpo" impede de perguntar de novo. */
    if (!(opc && opc.limpo)) {
      const an = leiPreAnalisar(txt);
      if (an.deve) {
        leiRevisarColagemAbrir({
          modo: "criar", texto: txt, pre: an.pre,
          aoConfirmar: (res) => {
            $("leiTexto").value = res.texto;
            leiGravar({ separado: true, limpo: true, anexos: res.anexos });
          },
        });
        return "pendente";
      }
    }
    const grupos = (opc && opc.conferido) ? [] : leiDuplicados(txt);
    if (grupos.length) {
      leiDuplicadosAbrir({
        modo: "criar", texto: txt, grupos,
        aoConfirmar: (res) => {
          $("leiTexto").value = res.texto;
          leiGravar({ separado: true, limpo: true, conferido: true,
            anexos: opc && opc.anexos, alteracoes: res.alteracoes,
            repetidosOk: res.resumo.filter((r) => r.acao === "todas").map((r) => r.num) });
        },
      });
      return "pendente";
    }
    /* primeira colagem: a lei nasce aqui, já identificada pelo próprio
     * cabeçalho quando ele veio junto */
    const ident = leiIdentificar(txt);
    const ente = leiEnteDoTexto(txt);
    const nome = ident ? ident.nome
      : (leiAtual.disciplina + " — " + leiAtual.topico);
    /* A LEI JÁ EXISTE NA BIBLIOTECA? Sem esta pergunta, colar a mesma lei num
     * segundo tópico caía no mesmo registro e SUBSTITUÍA o texto e a lista de
     * tópicos do primeiro. A pessoa escolhe: usar a que existe, usar e
     * comparar, ou criar outra separada de propósito. */
    if (!(opc && opc.jaVerificado)) {
      const igual = leiAcharIgual({ nome, especie: ident ? ident.especie : "",
        numero: ident ? ident.numero : "", ano: ident ? ident.ano : "", ente });
      if (igual) {
        leiJaAbrir({
          igual, artigosColados: leiArtigos(txt).length,
          iguais: leiNormalizaComparacao(igual.texto) === leiNormalizaComparacao(txt),
          aoEscolher: (esc) => {
            if (esc === "separada") {
              leiGravar(Object.assign({}, opc || {},
                { jaVerificado: true, separada: true, separado: true, limpo: true, conferido: true }));
            } else leiUsarExistente(igual, txt, esc === "atualizar");
          },
        });
        return "pendente";
      }
    }
    const alteracoes = (opc && opc.alteracoes) || {};
    /* um id LIVRE, sempre: se o id do nome já é de outra lei (mesmo número em
     * outra cidade), esta nasce com outro — nunca por cima do registro alheio */
    l = leiGuardar(Object.assign({ id: leiIdLivre(nome, ente),
      nome, texto: txt, topicos: [leiAtual.chave],
      consultadaEm: leisHojeISO() },
      ente ? { ente } : {},
      Object.keys(alteracoes).length ? { alteracoes } : {},
      (opc && opc.repetidosOk && opc.repetidosOk.length) ? { repetidosOk: opc.repetidosOk } : {},
      (opc && opc.anexos && opc.anexos.length) ? { anexos: opc.anexos } : {},
      ident ? { especie: ident.especie, numero: ident.numero, ano: ident.ano } : {}));
    if (!l) return;
    leiIdAtual = l.id;
  } else {
    /* CONTINUA GRAVANDO O TEXTO INTEIRO — de propósito.
     *
     * "A base não se reescreve mais" (leiPintarEdicaoLivre) trava a
     * DIGITAÇÃO: o textarea fica somente-leitura e o botão "gravar"
     * desativado, então uma pessoa não senta e reescreve o artigo à mão
     * por aqui depois que a lei já existe.
     *
     * Mas leiGravar() continua sendo o caminho de gravação de QUEM MEXE
     * no valor por JS sem ser reescrita de conteúdo — o caso real é a
     * marcação (matMarcarSelecao insere "==destaque==" etc. direto no
     * texto e conta com leiGravar() para persistir ao fechar/trocar de
     * lei). Bloquear esta função também travaria os grifos, que são um
     * recurso à parte e ninguém pediu para travar. A trava certa é só na
     * ENTRADA (textarea + botão), não nesta função. */
    leiGuardar({ id: l.id, texto: txt });
    leiLigar(l.id, leiAtual.chave);
  }

  /* o tópico guarda o PONTEIRO, não o texto — mas só ATUALIZA um resumo
   * que já existe. Criar um aqui de graça é o mesmo defeito que
   * matDuvidas e matTirarMarcaDe já consertaram do lado deles: um tópico
   * pode ter lei sem ter resumo, e salvar a lei não é motivo para esse
   * tópico ganhar um. Quem precisa achar a lei de um tópico sem resumo
   * já faz isso por leisDoTopico/leisLista, não por matResumos. */
  if (typeof matResumos !== "undefined" && matResumos[leiAtual.chave]) {
    const antigo = matResumos[leiAtual.chave];
    matResumos[leiAtual.chave] = Object.assign({}, antigo, {
      leiId: leiIdAtual,
      concurso: antigo.concurso
        || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
      tocado: new Date().toISOString(),
    });
    matSalvar();
  }

  leiSujo = false;
  try { leiReg("gravar", "lei gravada",
           leiDe(leiIdAtual).nome + " · " + leiArtigos(txt).length + " artigos");
  } catch (e) {}
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
  leiPintar();
  toast("lei_salva");
}

function leiTrocarPara(id) {
  if (leiSujo && leiGravar() === "pendente") return;   /* a pessoa ainda está escolhendo os artigos repetidos */
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

/* =====================================================================
 * CONFERIR OS ARTIGOS REPETIDOS — criação e atualização
 *
 * A tela mostra, por número repetido, cada ocorrência com o que o TEXTO diz
 * sobre a vigência dela (redação nova, revogado…) e as palavras que a
 * distinguem da outra. O que tem indício vem MARCADO (sugestão segura); o
 * que não tem começa VAZIO e o "confirmar" fica travado até a pessoa
 * escolher: escolher pela posição, sem ninguém ter olhado, é o defeito que
 * esta tela existe para evitar. Nada é criado nem comparado antes do
 * "confirmar".
 * ===================================================================== */
let leiDupCtx = null;

/* O TEXTO VEIO NUMA LINHA SÓ? Mostra os artigos que se encontrou e pergunta
 * se deve separar (nenhuma palavra muda; só entram quebras de linha). Devolve
 * uma promessa de true/false — e só se aplica quando leiSepararColagem acha
 * cabeçalhos que o leitor, por estarem no meio da linha, não enxergava. */
function leiSepararPerguntar(sep, chave) {
  const nomes = sep.artigos.map((a) => a.rotulo);
  const lista = nomes.slice(0, 10).join(", ")
    + (nomes.length > 10 ? " … " + t("lei_sep_mais", { n: nomes.length - 10 }) : "");
  return uiConfirm(t(chave || "lei_sep_conf", { n: sep.artigos.length, lista }));
}

/* guardar a substituída como texto original só faz sentido na CRIAÇÃO, em
 * grupo de duas ocorrências onde a escolhida traz "Redação dada pela…" e a
 * outra não (ver leiAplicarDuplicados) */
function leiDupPodeOriginal(g, indice) {
  if (!leiDupCtx || leiDupCtx.modo === "atualizar" || g.intra || g.candidatos.length !== 2) return false;
  if (leiDupCtx.protegidos && leiDupCtx.protegidos[g.num]) return false;
  const esc = g.candidatos.filter((c) => c.indice === indice)[0];
  const outro = g.candidatos.filter((c) => c.indice !== indice)[0];
  return !!(esc && outro && esc.sinais.tipo === "redacao" && outro.sinais.tipo !== "redacao");
}

function leiDupSugestoes() {
  const c = leiDupCtx;
  if (!c) return;
  c.decisoes = {};
  c.grupos.forEach((g) => {
    if (g.confianca === "forte") {
      c.decisoes[g.num] = { manter: g.sugerido, original: leiDupPodeOriginal(g, g.sugerido) };
    }
  });
}

function leiDuplicadosAbrir(ctx) {
  leiDupCtx = Object.assign({ modo: "criar", decisoes: {} }, ctx);
  leiDupSugestoes();
  leiDupPintar();
  abrirModal("dlgLeiDup");
  try {
    leiReg("gravar", "artigos repetidos: conferência aberta (" + leiDupCtx.modo + ")",
      leiDupCtx.grupos.length + " grupo(s)");
    /* uma linha por grupo, com as linhas das ocorrências e o sinal de cada uma */
    leiDupCtx.grupos.slice(0, 40).forEach((g) => leiReg("gravar", "repetido: " + g.rotulo + " ×" + g.candidatos.length,
      g.candidatos.map((x) => "L" + x.linha + "=" + (x.sinais.tipo || "—")).join(" ")
        + " · sugestão " + g.confianca + "/" + g.motivo));
  } catch (e) {}
}

function leiDupPintar() {
  const c = leiDupCtx;
  if (!c) return;
  const atualizar = c.modo === "atualizar";
  const revisar = c.modo === "revisar";
  $("leiDupTitulo").textContent = t(atualizar ? "lei_dup_titulo_upd"
    : (revisar ? "lei_dup_titulo_rev" : "lei_dup_titulo"));
  $("leiDupAjuda").textContent = t(atualizar ? "lei_dup_ajuda_upd"
    : (revisar ? "lei_dup_ajuda_rev" : "lei_dup_ajuda"));
  const fortes = c.grupos.filter((g) => g.confianca === "forte").length;
  $("leiDupResumo").textContent = t("lei_dup_resumo",
    { n: c.grupos.length, f: fortes, c: c.grupos.length - fortes });

  const cx = $("leiDupLista");
  cx.innerHTML = "";
  c.grupos.forEach((g) => {
    const dec = c.decisoes[g.num];
    const card = document.createElement("div");
    card.className = "lei-dup-grupo " + g.confianca;
    card.id = "leiDupGrupo_" + g.num;

    const cab = document.createElement("div");
    cab.className = "lei-dup-cab";
    const tit = document.createElement("span");
    tit.textContent = t("lei_dup_grupo", { a: g.numCru, n: g.candidatos.length });
    const forca = document.createElement("span");
    forca.className = "lei-dup-forca " + g.confianca;
    forca.textContent = t(g.confianca === "forte" ? "lei_dup_forte" : "lei_dup_fraca");
    cab.append(tit, forca);
    card.append(cab);

    if (g.confianca === "forte") {
      const mo = document.createElement("div");
      mo.className = "lei-dup-motivo";
      mo.textContent = t("lei_dup_m_" + g.motivo, { f: g.fonte });
      card.append(mo);
    }

    /* uma opção por ocorrência; o texto de cada uma com as palavras que a
     * distinguem da outra destacadas */
    g.candidatos.forEach((cand) => {
      const ref = g.candidatos.filter((o) => o !== cand)[0];
      const marcada = dec && dec.manter === cand.indice;
      const op = document.createElement("label");
      op.className = "lei-dup-op" + (marcada ? " sel" : "")
        + (g.confianca === "forte" && g.sugerido === cand.indice ? " sug" : "");
      const r = document.createElement("input");
      r.type = "radio";
      r.name = "leiDup_" + g.num;
      r.value = String(cand.indice);
      r.checked = !!marcada;
      r.onchange = () => {
        c.decisoes[g.num] = { manter: cand.indice, original: leiDupPodeOriginal(g, cand.indice) };
        leiDupPintar();
      };
      const nome = document.createElement("span");
      nome.className = "lei-dup-op-tit";
      nome.textContent = t("lei_dup_ocorrencia", { i: cand.pos + 1, l: cand.linha });
      op.append(r, nome);
      if (g.confianca === "forte" && g.sugerido === cand.indice) {
        const sug = document.createElement("span");
        sug.className = "lei-dup-chip sug";
        sug.textContent = t("lei_dup_sugerido");
        op.append(sug);
      }
      const chip = document.createElement("span");
      const tp = cand.sinais.tipo;
      chip.className = "lei-dup-chip " + (tp === "redacao" ? "ok"
        : (tp === "revogado" || tp === "vetado" || tp === "vazio" ? "ruim" : ""));
      chip.textContent = t("lei_dup_c_" + (tp || "nenhum"));
      op.append(chip);

      const palavras = leiPalavrasDiferentes(cand.corpo, ref ? ref.corpo : "");
      const desenha = (lista) => {
        const d = document.createElement("div");
        d.className = "lei-dup-txt";
        lista.forEach((p, i) => {
          if (i) d.append(document.createTextNode(" "));
          if (p.dif && ref) {
            const m = document.createElement("mark");
            m.className = "lei-dup-dif";
            m.textContent = p.t;
            d.append(m);
          } else d.append(document.createTextNode(p.t));
        });
        return d;
      };
      op.append(desenha(palavras.slice(0, 48)));
      if (palavras.length > 48) {
        const det = document.createElement("details");
        det.className = "lei-dup-mais";
        const sm = document.createElement("summary");
        sm.textContent = t("lei_dup_ver_tudo");
        det.append(sm, desenha(palavras));
        op.append(det);
      }
      card.append(op);
      card.append(leiDupContextoEl(c.texto, cand));
    });

    /* "manter todas" — só na criação: na atualização a comparação usa UM
     * artigo por número, então a opção não teria como ser respeitada */
    if (!atualizar) {
      const op = document.createElement("label");
      op.className = "lei-dup-op" + (dec && dec.manter === "todas" ? " sel" : "");
      const r = document.createElement("input");
      r.type = "radio";
      r.name = "leiDup_" + g.num;
      r.value = "todas";
      r.checked = !!(dec && dec.manter === "todas");
      r.onchange = () => { c.decisoes[g.num] = { manter: "todas", original: false }; leiDupPintar(); };
      const nome = document.createElement("span");
      nome.className = "lei-dup-op-tit";
      nome.textContent = t("lei_dup_todas");
      op.append(r, nome);
      card.append(op);
    }

    if (dec && dec.manter !== "todas" && leiDupPodeOriginal(g, dec.manter)) {
      const escolhido = g.candidatos.filter((x) => x.indice === dec.manter)[0];
      const lb = document.createElement("label");
      lb.className = "lei-dup-original";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "leiDupOriginal_" + g.num;
      cb.checked = !!dec.original;
      cb.onchange = () => { dec.original = cb.checked; };
      const tx = document.createElement("span");
      tx.textContent = t("lei_dup_original", { f: escolhido.sinais.fonte || "…" });
      lb.append(cb, tx);
      card.append(lb);
    }
    cx.append(card);
  });
  const leg = document.createElement("div");
  leg.className = "lei-dup-motivo";
  leg.textContent = t("lei_dup_legenda");
  cx.append(leg);

  const faltam = c.grupos.filter((g) => !c.decisoes[g.num]).length;
  $("btnLeiDupConfirmar").disabled = faltam > 0;
  $("btnLeiDupConfirmar").textContent = t(atualizar ? "lei_dup_confirmar_upd"
    : (revisar ? "lei_dup_confirmar_rev" : "lei_dup_confirmar"));
  $("leiDupFaltam").textContent = faltam ? t("lei_dup_faltam", { n: faltam }) : t("lei_dup_pronto");
}

function leiDupConfirmar() {
  const c = leiDupCtx;
  if (!c || c.grupos.some((g) => !c.decisoes[g.num])) return false;
  const res = leiAplicarDuplicados(c.texto, c.grupos, c.decisoes);
  leiDupCtx = null;
  $("dlgLeiDup").close();
  try {
    leiReg("gravar", "artigos repetidos: escolhas confirmadas",
      res.resumo.map((r) => "art. " + r.num + " → " + r.acao).join(" · "));
  } catch (e) {}
  c.aoConfirmar(res);
  return true;
}

function leiDupCancelar() {
  if (!leiDupCtx) { if ($("dlgLeiDup")) $("dlgLeiDup").close(); return; }
  leiDupCtx = null;
  $("dlgLeiDup").close();
  try { leiReg("gravar", "artigos repetidos: voltou para revisar o texto", ""); } catch (e) {}
}

/* =====================================================================
 * VER O TRECHO NO TEXTO, SEM FECHAR A TELA
 *
 * Escolher qual redação de um artigo repetido fica exige olhar como ela está
 * na lei: o que vem antes, o que vem depois, se o vizinho já traz a redação
 * nova. Antes só havia o texto da própria ocorrência; para conferir era
 * preciso fechar a caixa e perder a escolha. Agora cada ocorrência tem um
 * "ver no texto" que abre, DENTRO da mesma tela, as linhas ao redor, com as
 * da ocorrência destacadas.
 * ===================================================================== */
function leiDupContextoEl(texto, cand) {
  const det = document.createElement("details");
  det.className = "lei-dup-mais lei-dup-ctx-det";
  const sm = document.createElement("summary");
  sm.textContent = t("lei_dup_ver_contexto");
  det.append(sm);
  const corpo = document.createElement("div");
  corpo.className = "lei-ctx";
  det.append(corpo);
  const encher = () => {
    if (corpo.dataset && corpo.dataset.pronto) return;
    if (corpo.dataset) corpo.dataset.pronto = "1";
    const ajuda = document.createElement("div");
    ajuda.className = "lei-pre-ctx";
    ajuda.textContent = t("lei_dup_ctx_ajuda");
    corpo.append(ajuda);
    leiContextoDeLinhas(texto, cand.linha, cand.linhaFim, 8, 8).forEach((x) => {
      const s = document.createElement("span");
      s.className = "lei-ctx-l" + (x.alvo ? " lei-ctx-alvo" : "");
      const n = document.createElement("span");
      n.className = "lei-ctx-n";
      n.textContent = String(x.n);
      s.append(n, document.createTextNode(String(x.texto).slice(0, 320) || " "));
      corpo.append(s);
    });
  };
  det.ontoggle = () => { if (det.open) encher(); };
  det.encher = encher;
  return det;
}

/* =====================================================================
 * O RELATÓRIO DO FLUXO DE ATUALIZAÇÃO
 *
 * Quando algo dá errado numa tela do fluxo (colar, limpar, repetidos,
 * conferir, comparar), a pessoa precisa mostrar O QUE ESTAVA NA TELA — o
 * que o app entendeu, o que sugeriu, o que ela escolheu — e não só "deu
 * errado". O botão "copiar relatório desta tela" junta isso, com a versão
 * do app e as últimas linhas do registro, num texto só para colar numa
 * conversa. Nada é enviado sozinho.
 * ===================================================================== */
function leiRelatorioFluxo(tela) {
  const p = [];
  const cortar = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n || 200);
  p.push("EasyAnkiCards " + (typeof VERSAO !== "undefined" ? VERSAO : "?")
    + " — relatório do fluxo da lei — " + new Date().toISOString());
  p.push("Tela: " + (tela || "?"));
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  if (l) {
    p.push("Lei aberta: " + l.nome + " (" + l.id + ") · " + leiArtigos(l.texto).length + " artigos · "
      + (l.topicos || []).length + " tópico(s) · consultada em " + (l.consultadaEm || "?")
      + " · versão: " + (l.versao || "—") + " · alterações: " + Object.keys(l.alteracoes || {}).length);
  } else p.push("Lei aberta: nenhuma");
  if ($("leiUpdFonte") && $("leiUpdFonte").value) p.push("Norma informada: " + cortar($("leiUpdFonte").value, 120));
  if ($("leiUpdTexto") && $("leiUpdTexto").value) {
    const tx = $("leiUpdTexto").value;
    p.push("Texto colado: " + tx.length + " caracteres, " + tx.split("\n").length + " linhas, "
      + leiArtigos(tx).length + " artigos reconhecidos · começa com: " + cortar(tx, 140));
  }
  if (leiPreCtx) {
    const c = leiPreCtx;
    p.push("— Revisão da colagem (" + c.modo + "): " + c.pre.mudancas.length + " mudança(s) sugerida(s)");
    LEI_PRE_GRUPOS.forEach((g) => {
      const it = c.pre.mudancas.filter((m) => m.grupo === g);
      if (!it.length) return;
      p.push("  · " + g + ": " + it.length + " (aceitas " + it.filter((m) => leiPreAceita(c, m)).length + ")");
      it.slice(0, 6).forEach((m) => p.push("      " + m.id + " linha(s) " + (m.linhas || []).slice(0, 4).join(",")
        + " · " + cortar(m.antes, 110) + (m.depois ? "  =>  " + cortar(m.depois, 110) : "")));
    });
  }
  if (leiDupCtx) {
    const c = leiDupCtx;
    p.push("— Artigos repetidos (" + c.modo + "): " + c.grupos.length + " grupo(s)");
    c.grupos.slice(0, 40).forEach((g) => {
      const d = c.decisoes[g.num];
      p.push("  · " + g.rotulo + " ×" + g.candidatos.length + " [" + g.confianca + "/" + g.motivo + "] escolha: "
        + (d ? (d.manter === "todas" ? "manter todas" : "linha " + ((g.candidatos.filter((x) => x.indice === d.manter)[0] || {}).linha)) : "—"));
      g.candidatos.forEach((x) => p.push("      linha " + x.linha + "-" + x.linhaFim + " (" + (x.sinais.tipo || "sem indício") + "): " + cortar(x.texto, 160)));
    });
  }
  if (leiCobCtx) {
    p.push("— Conferência da versão nova: " + leiCobCtx.g.avisos.map((a) => a.k).join(", ")
      + " · escolha: " + (leiCobCtx.escolha || "—"));
  }
  if (leiUpdComparo) {
    const it = leiUpdComparo;
    p.push("— Comparação: " + it.length + " itens · aceitos " + it.filter((x) => x.aceito).length
      + " · recusados " + it.filter((x) => x.recusado).length + " · modo dos ausentes: " + leiUpdModoAusentes);
    it.slice(0, 40).forEach((x) => p.push("  · art. " + x.numCru + " " + x.tipo
      + ((x.alertas || []).length ? " [" + x.alertas.map((a) => a.k).join(",") + "]" : "")));
  }
  if (leiJaCtx) p.push("— Lei já existente: " + leiJaCtx.igual.nome + " · escolha: " + (leiJaCtx.escolha || "—"));
  p.push("— Registro (últimas 60 linhas)");
  leiLog.slice(-60).forEach((x) => p.push("  " + String(x.q).slice(11, 19) + " [" + x.t + "] " + x.o + (x.d ? " — " + x.d : "")));
  return p.join("\n");
}

function leiRelatorioCopiar(tela) {
  const txt = leiRelatorioFluxo(tela);
  try { leiReg("relatorio", "relatório do fluxo pedido", tela || ""); } catch (e) {}
  const ok = () => { try { toast("lei_rel_copiado"); } catch (e) {} };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, () => leiRelatorioMostrar(txt));
      return txt;
    }
  } catch (e) {}
  leiRelatorioMostrar(txt);
  return txt;
}

/* sem área de transferência (navegador recusou), o relatório abre no visor do registro para copiar à mão */
function leiRelatorioMostrar(txt) {
  if ($("leiLogTexto")) $("leiLogTexto").value = txt;
  abrirModal("dlgLeiLog");
}

/* UMA FALHA NO FLUXO NÃO PODE SER SILENCIOSA. Cada etapa do fluxo de colar e
 * atualizar é envolvida: se estourar, vira uma linha [erro] no registro, com a
 * etapa, e a pessoa é avisada de que pode copiar o relatório da tela. */
let leiFluxoEnvolvido = false;
function leiSeguro(nome, fn) {
  return function () {
    try { return fn.apply(this, arguments); }
    catch (e) {
      try { leiReg("erro", "falha em " + nome, ((e && e.message) || String(e)) + " · " + String((e && e.stack) || "").split("\n")[1]); }
      catch (x) {}
      try { uiAlert(t("lei_erro_fluxo", { e: nome })); } catch (x) {}
      return false;
    }
  };
}

function leiEnvolverFluxo() {
  if (leiFluxoEnvolvido) return;
  leiFluxoEnvolvido = true;
  /* eslint-disable no-func-assign */
  leiAtualizarComparar = leiSeguro("atualizar: comparar", leiAtualizarComparar);
  leiAtualizarAplicar = leiSeguro("atualizar: finalizar", leiAtualizarAplicar);
  leiRevisarColagemAbrir = leiSeguro("revisar a colagem", leiRevisarColagemAbrir);
  leiPreConfirmar = leiSeguro("revisar a colagem: finalizar", leiPreConfirmar);
  leiDuplicadosAbrir = leiSeguro("artigos repetidos", leiDuplicadosAbrir);
  leiDupConfirmar = leiSeguro("artigos repetidos: confirmar", leiDupConfirmar);
  leiUpdGuardaAbrir = leiSeguro("conferir a versão nova", leiUpdGuardaAbrir);
  leiUpdMostrar = leiSeguro("comparação: mostrar", leiUpdMostrar);
}

/* =====================================================================
 * A LEI JÁ ESTÁ NA BIBLIOTECA — antes de criar outra por cima
 *
 * Colar a 4.320 num segundo tópico substituía o texto e apagava o vínculo
 * do primeiro (ver "A LEI EXISTE UMA VEZ SÓ", lei-seca.js). Agora, quando o
 * texto colado é de uma lei que a biblioteca já tem, a pessoa escolhe:
 * usar a que existe (só liga este tópico), usar e comparar (atualizar
 * versão) ou, de propósito, criar outra separada.
 * ===================================================================== */
let leiJaCtx = null;

function leiJaAbrir(ctx) {
  leiJaCtx = Object.assign({ escolha: "" }, ctx);
  leiJaPintar();
  abrirModal("dlgLeiJa");
  try {
    leiReg("gravar", "a lei colada já existe na biblioteca",
      ctx.igual.nome + " · " + (ctx.igual.topicos || []).length + " tópico(s)");
  } catch (e) {}
}

function leiJaPintar() {
  const c = leiJaCtx;
  if (!c) return;
  const n = leiArtigos(c.igual.texto).length;
  $("leiJaMsg").textContent = t("lei_ja_msg", { nome: c.igual.nome, n, t: (c.igual.topicos || []).length,
    m: c.artigosColados, igual: t(c.iguais ? "lei_ja_igual" : "lei_ja_dif") });
  const ox = $("leiJaOpcoes");
  ox.innerHTML = "";
  ["usar", "atualizar", "separada"].forEach((v) => {
    if (v === "atualizar" && c.iguais) return;      /* texto igual: nada a comparar */
    const lb = document.createElement("label");
    lb.className = "lei-dup-op" + (c.escolha === v ? " sel" : "");
    const r = document.createElement("input");
    r.type = "radio";
    r.name = "leiJa";
    r.value = v;
    r.checked = c.escolha === v;
    r.onchange = () => { c.escolha = v; leiJaPintar(); };
    const tx = document.createElement("span");
    tx.className = "lei-dup-op-tit";
    tx.textContent = t("lei_ja_o_" + v);
    lb.append(r, tx);
    ox.append(lb);
  });
  $("btnLeiJaConfirmar").disabled = !c.escolha;
}

function leiJaConfirmar() {
  const c = leiJaCtx;
  if (!c || !c.escolha) return false;
  leiJaCtx = null;
  $("dlgLeiJa").close();
  try { leiReg("gravar", "lei já existente: escolha", c.escolha); } catch (e) {}
  c.aoEscolher(c.escolha);
  return true;
}

function leiJaCancelar() {
  if ($("dlgLeiJa")) $("dlgLeiJa").close();
  if (!leiJaCtx) return;
  leiJaCtx = null;
  try { leiReg("gravar", "lei já existente: voltou para revisar o texto", ""); } catch (e) {}
}

/* usar a lei que já existe neste tópico (e, se pedido, abrir a comparação) */
function leiUsarExistente(igual, txt, comparar) {
  leiSujo = false;
  leiLigar(igual.id, leiAtual.chave);
  leiTrocarPara(igual.id);
  try { leiReg("gravar", "tópico ligado à lei que já existia", igual.nome + " · " + leiAtual.topico); } catch (e) {}
  if (comparar) {
    leiAtualizarAbrir();
    $("leiUpdTexto").value = txt;
  }
  toast("lei_ligada");
}

/* =====================================================================
 * A BIBLIOTECA DE LEIS — as leis do usuário, fora de qualquer tópico
 *
 * Cada lei existe uma vez; os tópicos só guardam o ponteiro. Aqui se vê o
 * conjunto: onde cada lei é usada, quais não têm vínculo, e se faz o que a
 * fonte única exige — ligar, desligar, apagar SABENDO onde é usada, e
 * mesclar as que parecem a mesma.
 * ===================================================================== */
let leiBibFiltro = "todas";
let leiBibTexto = "";
let leiBibMeta = {};

function leiConcursoAtualNome() {
  try { return (typeof concursoAtual === "function" && (concursoAtual() || {}).nome) || ""; }
  catch (e) { return ""; }
}

/* Onde a lei é usada: uma linha por tópico ligado, com o concurso que o
 * edital diz (ou o do resumo). */
function leiUsosDaLei(l, idx) {
  const atual = leiConcursoAtualNome();
  const porNorm = {};
  if (typeof matResumos !== "undefined" && matResumos) {
    Object.keys(matResumos).forEach((k) => { porNorm[leisChaveComparavel(k)] = matResumos[k]; });
  }
  return (l.topicos || []).map((chave) => {
    const r = porNorm[leisChaveComparavel(chave)] || {};
    const partes = String(chave).split("›");
    const disciplina = r.disciplina || partes[0] || "";
    const topico = r.topico || partes.slice(1).join("›") || "";
    let concurso = r.concurso || "";
    if (!concurso && typeof matConcursoDoTopico === "function") {
      try { concurso = matConcursoDoTopico(disciplina, topico, atual, idx) || ""; } catch (e) { concurso = ""; }
    }
    return { chave, disciplina, topico, concurso };
  });
}

/* quantos artigos e quantos alterados — memorizado: a lei inteira é lida de novo a cada desenho */
function leiBibMetaDe(l) {
  const k = l.id + "|" + (l.tocado || "") + "|" + String(l.texto || "").length;
  if (!leiBibMeta[k]) {
    const arts = leiArtigosEfetivos(l);
    leiBibMeta[k] = { n: arts.length, alt: arts.filter((a) => a.alterado || a.revogado || a.novo).length,
      parei: l.parei, pct: (leiProgresso(l.id) || {}).pct || 0 };
  }
  return leiBibMeta[k];
}

function leiBibLista() {
  const idx = (typeof matIndiceConcursos === "function") ? matIndiceConcursos() : null;
  const atual = leiConcursoAtualNome();
  const q = leiTxtChave(leiBibTexto);
  return leisLista().map((l) => ({ l, usos: leiUsosDaLei(l, idx) })).filter(({ l, usos }) => {
    if (leiBibFiltro === "sem" && usos.length) return false;
    if (leiBibFiltro === "concurso" && !(atual && usos.some((u) => u.concurso === atual))) return false;
    if (!q) return true;
    const palheiro = leiTxtChave([l.nome, l.apelido, l.numero, leiNumeroNorm(l.numero), l.ano,
      l.ente, l.especie].join(" "));
    return palheiro.indexOf(q) >= 0;
  });
}

function leiBibAbrir() {
  leiBibTexto = "";
  if ($("leiBibBusca")) $("leiBibBusca").value = "";
  leiBibPintar();
  abrirModal("dlgLeiBib");
  try { leiReg("lei", "biblioteca de leis aberta", leisLista().length + " leis"); } catch (e) {}
}

function leiBibPintar() {
  const dlg = $("dlgLeiBib");
  const rolagem = dlg && dlg.scrollTop ? dlg.scrollTop : 0;
  const atual = leiConcursoAtualNome();
  if ($("leiBibBusca")) $("leiBibBusca").placeholder = t("lei_bib_busca");
  [["btnLeiBibTodas", "todas"], ["btnLeiBibConcurso", "concurso"], ["btnLeiBibSem", "sem"]].forEach(([id, f]) => {
    const b = $(id);
    if (!b) return;
    b.classList.toggle("mat-ligado", leiBibFiltro === f);
    if (f === "concurso") b.title = atual ? t("lei_bib_f_concurso_aj", { c: atual }) : t("lei_bib_f_concurso_sem");
  });
  const todas = leisLista();
  const lista = leiBibLista();
  const semVinculo = todas.filter((l) => !(l.topicos || []).length).length;
  $("leiBibResumo").textContent = t("lei_bib_resumo", { n: lista.length, v: semVinculo });

  const dup = leiDuplicadasNaBiblioteca();
  $("leiBibDup").hidden = !dup.length;
  if (dup.length) $("btnLeiBibDup").textContent = t("lei_bib_dup_aviso", { n: dup.length });

  const cx = $("leiBibLista");
  cx.innerHTML = "";
  if (!lista.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = t("lei_bib_vazio");
    cx.append(p);
  }
  lista.forEach((it) => cx.append(leiBibCartao(it)));
  if (dlg && rolagem) dlg.scrollTop = rolagem;
}

function leiBibCartao({ l, usos }) {
  const m = leiBibMetaDe(l);
  const card = document.createElement("div");
  card.className = "lei-bib-card";
  card.id = "leiBib_" + l.id;

  const tit = document.createElement("div");
  tit.className = "lei-bib-tit";
  tit.textContent = l.nome;
  card.append(tit);

  const meta = [];
  meta.push(t("lei_bib_meta_artigos", { n: m.n }));
  if (m.alt) meta.push(t("lei_bib_meta_alt", { n: m.alt }));
  if ((l.anexos || []).length) meta.push(t("lei_bib_meta_anexos", { n: l.anexos.length }));
  if (l.ente) meta.push(t("lei_bib_ente", { e: l.ente }));
  if (l.apelido) meta.push(t("lei_bib_sigla", { s: l.apelido }));
  if (m.parei) meta.push(t("lei_bib_meta_parei", { a: String(m.parei).toUpperCase(), p: m.pct }));
  const l1 = document.createElement("div");
  l1.className = "lei-bib-meta";
  l1.textContent = meta.join(" · ");
  card.append(l1);

  const cons = new Set(usos.map((u) => u.concurso).filter(Boolean));
  const l2 = document.createElement("div");
  l2.className = "lei-bib-meta" + (usos.length ? "" : " lei-bib-sem");
  l2.textContent = usos.length ? t("lei_bib_meta_uso", { t: usos.length, c: cons.size })
                               : t("lei_bib_meta_sem");
  card.append(l2);

  if (usos.length) {
    const det = document.createElement("details");
    det.className = "lei-bib-usos";
    const sm = document.createElement("summary");
    sm.textContent = t("lei_bib_usos");
    det.append(sm);
    usos.forEach((u) => {
      const li = document.createElement("div");
      li.className = "lei-bib-uso";
      const tx = document.createElement("span");
      tx.textContent = [u.concurso, u.disciplina, u.topico].filter(Boolean).join(" › ");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min";
      b.textContent = t("lei_bib_desvincular");
      b.onclick = () => leiBibDesligar(l, u);
      li.append(tx, b);
      det.append(li);
    });
    card.append(det);
  }

  const acoes = document.createElement("div");
  acoes.className = "lei-bib-acoes";
  const mk = (id, txt, fn, extra) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min" + (extra ? " " + extra : "");
    b.id = id + "_" + l.id;
    b.textContent = t(txt);
    b.onclick = fn;
    acoes.append(b);
  };
  mk("btnLeiBibAbrir", "lei_bib_abrir", () => { $("dlgLeiBib").close(); leiAbrirAvulsa(l.id); }, "btn-min-ok");
  mk("btnLeiBibLigar", "lei_bib_vincular", () => leiTopicoAbrir(l));
  mk("btnLeiBibApagar", "lei_bib_apagar", () => leiBibApagar(l), "btn-min-perigo");
  card.append(acoes);
  return card;
}

/* abrir uma lei SEM tópico: o que depende de um tópico (registrar leitura,
 * criar cartões, a fila de leis) fica de fora e diz por quê */
function leiAbrirAvulsa(id) { leiAbrir("", "", id); }

async function leiBibDesligar(l, u) {
  const ok = await uiConfirm(t("lei_bib_desv_conf", { l: l.nome, tp: u.topico || u.chave }));
  if (!ok) return false;
  leiDesligarTopico(l, u.chave);
  try { reg("LEI", "lei desvinculada do tópico (biblioteca)", l.nome + " · " + u.chave); } catch (e) {}
  leiBibPintar();
  return true;
}

/* tirar a lei de UM tópico: a lei continua na biblioteca e nos outros */
function leiDesligarTopico(l, chave) {
  leiDesligar(l.id, chave);
  if (typeof matResumos !== "undefined") {
    Object.keys(matResumos).forEach((k) => {
      if (leisChaveComparavel(k) === leisChaveComparavel(chave) && matResumos[k].leiId === l.id) {
        const resto = leisDoTopico(k);
        matResumos[k].leiId = resto[0] ? resto[0].id : "";
        try { matSalvar(); } catch (e) {}
      }
    });
  }
}

/* APAGAR sabendo onde é usada */
async function leiBibApagar(l) {
  const usos = leiUsosDaLei(l, null);
  const lista = usos.slice(0, 8).map((u) => "• " + [u.disciplina, u.topico].filter(Boolean).join(" › ")).join("\n")
    + (usos.length > 8 ? "\n" + t("lei_num_mais", { n: usos.length - 8 }) : "");
  const ok = await uiConfirm(usos.length
    ? t("lei_bib_apagar_conf", { l: l.nome, t: usos.length, lista })
    : t("lei_bib_apagar_livre", { l: l.nome }));
  if (!ok) return false;
  leiApagar(l.id);
  if (leiIdAtual === l.id) leiIdAtual = "";
  leiBibPintar();
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
  toast("lei_bib_apagada");
  return true;
}

/* ---- ligar uma lei a um tópico, a partir da Biblioteca ---- */
let leiTopCtx = null;

/* todos os tópicos que o app conhece: os dos editais (mesmo sem material
 * ainda) e os que já têm resumo */
function leiTopicosDisponiveis() {
  const mapa = new Map();
  const norm = (c) => leisChaveComparavel(c);
  if (typeof editais !== "undefined" && Array.isArray(editais) && typeof lerEdital === "function") {
    editais.forEach((e) => {
      let r = null;
      try { r = lerEdital(e.texto); } catch (x) { return; }
      const cc = String(((r && r.cfg) || {}).concurso || "").trim();
      ((r && r.disciplinas) || []).forEach((d) => (d.topicos || []).forEach((tp) => {
        const chave = matChave(d.nome, tp.nome);
        if (!mapa.has(norm(chave))) mapa.set(norm(chave), { chave, disciplina: d.nome, topico: tp.nome, concurso: cc });
      }));
    });
  }
  if (typeof matListaCheia === "function") {
    try {
      matListaCheia().forEach((x) => {
        if (!x.chave || mapa.has(norm(x.chave))) return;
        mapa.set(norm(x.chave), { chave: x.chave, disciplina: x.disciplina || "", topico: x.topico || "", concurso: x.concurso || "" });
      });
    } catch (e) {}
  }
  return Array.from(mapa.values());
}

function leiTopicoAbrir(l) {
  leiTopCtx = { l, busca: "" };
  if ($("leiTopBusca")) $("leiTopBusca").value = "";
  leiTopicoPintar();
  abrirModal("dlgLeiTopico");
}

function leiTopicoPintar() {
  const c = leiTopCtx;
  if (!c) return;
  const l = leiDe(c.l.id) || c.l;
  $("leiTopTitulo").textContent = t("lei_top_titulo", { l: l.nome });
  $("leiTopBusca").placeholder = t("lei_top_busca");
  const q = leiTxtChave(c.busca);
  const ja = new Set((l.topicos || []).map((x) => leisChaveComparavel(x)));
  const todos = leiTopicosDisponiveis().filter((x) => !q
    || leiTxtChave([x.concurso, x.disciplina, x.topico].join(" ")).indexOf(q) >= 0);
  const cx = $("leiTopLista");
  cx.innerHTML = "";
  if (!todos.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = t("lei_top_vazio");
    cx.append(p);
  }
  todos.slice(0, 60).forEach((x) => {
    const li = document.createElement("div");
    li.className = "lei-bib-uso";
    const tx = document.createElement("span");
    tx.textContent = [x.concurso, x.disciplina, x.topico].filter(Boolean).join(" › ");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min btn-min-ok";
    const ligada = ja.has(leisChaveComparavel(x.chave));
    b.textContent = t(ligada ? "lei_top_ja" : "lei_top_ligar");
    b.disabled = ligada;
    b.onclick = () => {
      leiLigar(l.id, x.chave);
      try { reg("LEI", "lei ligada a tópico (biblioteca)", l.nome + " · " + x.chave); } catch (e) {}
      if (typeof matRender === "function") { try { matRender(); } catch (e2) {} }
      leiTopicoPintar();
      leiBibPintar();
    };
    li.append(tx, b);
    cx.append(li);
  });
  if (todos.length > 60) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = t("lei_top_mais", { n: 60 });
    cx.append(p);
  }
}

/* ---- leis que parecem a mesma: escolher qual fica ---- */
let leiMesCtx = null;

function leiMesAbrir() {
  const grupos = leiDuplicadasNaBiblioteca();
  if (!grupos.length) { leiBibPintar(); return false; }
  leiMesCtx = { grupos, i: 0, manter: "" };
  leiMesPintar();
  abrirModal("dlgLeiMes");
  return true;
}

function leiMesInfo(l) {
  return t("lei_mes_info", { a: leiArtigos(l.texto).length, t: (l.topicos || []).length,
    n: Object.keys(l.notasArtigos || {}).length + (l.notasTrechos || []).length, c: String(l.texto || "").length });
}

function leiMesPintar() {
  const c = leiMesCtx;
  if (!c) return;
  const g = c.grupos[c.i].map((l) => leiDe(l.id)).filter(Boolean);
  if (g.length < 2) { leiMesProximo(); return; }
  /* sugestão: a mais ligada a tópicos; empate, a de texto maior */
  if (!c.manter || !g.some((l) => l.id === c.manter)) {
    c.manter = g.slice().sort((a, b) => ((b.topicos || []).length - (a.topicos || []).length)
      || (String(b.texto || "").length - String(a.texto || "").length))[0].id;
  }
  $("leiMesPasso").textContent = t("lei_mes_passo", { i: c.i + 1, n: c.grupos.length });
  const cx = $("leiMesLista");
  cx.innerHTML = "";
  g.forEach((l) => {
    const lb = document.createElement("label");
    lb.className = "lei-dup-op" + (c.manter === l.id ? " sel" : "");
    const r = document.createElement("input");
    r.type = "radio";
    r.name = "leiMes";
    r.value = l.id;
    r.checked = c.manter === l.id;
    r.onchange = () => { c.manter = l.id; leiMesPintar(); };
    const nome = document.createElement("span");
    nome.className = "lei-dup-op-tit";
    nome.textContent = t("lei_mes_manter") + ": " + l.nome;
    const info = document.createElement("div");
    info.className = "lei-pre-ctx";
    info.textContent = leiMesInfo(l);
    lb.append(r, nome, info);
    cx.append(lb);
  });
  const mantida = g.filter((l) => l.id === c.manter)[0];
  const maior = g.filter((l) => l.id !== c.manter
    && leiArtigos(l.texto).length > leiArtigos(mantida.texto).length)[0];
  $("leiMesAviso").hidden = !maior;
  if (maior) $("leiMesAviso").textContent = t("lei_mes_texto_maior",
    { a: leiArtigos(maior.texto).length, b: leiArtigos(mantida.texto).length });
}

function leiMesProximo() {
  const c = leiMesCtx;
  if (!c) return;
  c.i++;
  c.manter = "";
  if (c.i >= c.grupos.length) {
    leiMesCtx = null;
    $("dlgLeiMes").close();
    leiBibPintar();
    return;
  }
  leiMesPintar();
}

function leiMesConfirmar() {
  const c = leiMesCtx;
  if (!c || !c.manter) return false;
  const g = c.grupos[c.i].map((l) => l.id);
  const res = leiMesclar(c.manter, g.filter((id) => id !== c.manter));
  if (res) {
    if (leiIdAtual && g.indexOf(leiIdAtual) >= 0) leiIdAtual = c.manter;
    if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
    toast("lei_mes_pronto");
  }
  leiMesProximo();
  return !!res;
}

function leiMesDistintas() {
  const c = leiMesCtx;
  if (!c) return false;
  leiMarcarDistintas(c.grupos[c.i].map((l) => l.id));
  leiMesProximo();
  return true;
}

function leiMesFechar() {
  if ($("dlgLeiMes")) $("dlgLeiMes").close();
  leiMesCtx = null;
  leiBibPintar();
}

/* =====================================================================
 * REVISAR A COLAGEM — limpeza do texto de um PDF, na criação e na atualização
 *
 * leiPreprocessar (lei-seca.js) SUGERE; esta tela mostra tudo — o que sairia
 * riscado em vermelho, o que ficaria em verde —, deixa recusar grupo a grupo
 * e item a item, e só o "finalizar" entrega o texto limpo a quem chamou.
 * Enquanto isso NADA é criado, comparado ou gravado. Junto vai a CRÍTICA da
 * numeração (leiNumeracao): artigos fora de sequência quase sempre são o
 * leitor errando, e a pessoa vê onde antes de seguir.
 * ===================================================================== */
const LEI_PRE_GRUPOS = ["invisiveis", "cabecalho", "pagina", "grafia", "remissao", "anexo"];
/* trecho colado com poucos artigos não tem sequência a criticar */
const LEI_NUMERACAO_MIN_ARTIGOS = 8;
let leiPreCtx = null;

/* Há o que limpar OU a numeração está fora de sequência? */
function leiPreAnalisar(texto, opc) {
  const pre = leiPreprocessar(texto, opc);
  const arts = leiArtigos(texto);
  /* numeração não se critica numa lei que ALTERA: ela só cita artigos soltos */
  const num = (arts.length >= LEI_NUMERACAO_MIN_ARTIGOS && !(opc && opc.semNumeracao))
    ? leiNumeracao(arts) : { problemas: [], graves: [] };
  return { pre, num, deve: pre.mudancas.length > 0 || num.graves.length > 0 };
}

/* os problemas de numeração já escritos em frase, na ordem do texto */
function leiNumeracaoLinhas(problemas) {
  return (problemas || []).map((p) => ({
    gravidade: p.gravidade,
    texto: t("lei_num_" + p.tipo, { n: p.numCru, l: p.linha, de: p.de || "—",
      f: (p.faltam || []).join(", ") + ((p.nFaltam || 0) > (p.faltam || []).length ? "…" : "") }),
  }));
}

function leiRevisarColagemAbrir(ctx) {
  leiPreCtx = Object.assign({ modo: "criar", decisoes: {} }, ctx);
  leiPreCtx.texto = String(leiPreCtx.texto == null ? "" : leiPreCtx.texto).replace(/\r\n?/g, "\n");
  leiPreSugestoes();
  leiPrePintar();
  abrirModal("dlgLeiPre");
  try {
    leiReg(leiPreCtx.modo === "atualizar" ? "atualizacao" : "gravar", "revisão da colagem aberta",
      leiPreCtx.pre.mudancas.length + " mudanças sugeridas: "
      + LEI_PRE_GRUPOS.map((g) => g + " " + leiPreCtx.pre.mudancas.filter((m) => m.grupo === g).length)
          .filter((x) => !/ 0$/.test(x)).join(" · "));
  } catch (e) {}
}

/* tudo começa ACEITO — é a sugestão do app —, e anexos começam "separar" */
function leiPreSugestoes() {
  const c = leiPreCtx;
  if (!c) return;
  c.decisoes = {};
  c.pre.mudancas.forEach((m) => { c.decisoes[m.id] = m.grupo === "anexo" ? "separar" : true; });
}

function leiPreAceita(c, m) {
  const d = c.decisoes[m.id];
  return m.grupo === "anexo" ? (d === "separar" || d === "descartar") : !!d;
}

function leiPreItemEl(c, m) {
  const aceita = leiPreAceita(c, m);
  const el = document.createElement("div");
  el.className = "lei-pre-item" + (aceita ? "" : " off");
  el.id = "leiPreItem_" + m.id;
  const linhasTxt = (m.linhas || []).slice(0, 6).join(", ") + ((m.linhas || []).length > 6 ? "…" : "");
  const linha = (cls, txt) => {
    const s = document.createElement("span");
    s.className = cls;
    s.textContent = txt;
    return s;
  };

  if (m.grupo === "anexo") {
    const tit = document.createElement("div");
    tit.className = "lei-pre-ctx";
    tit.textContent = m.titulo + " · " + t("lei_pre_anexo_tam", { n: m.tamanho });
    el.append(tit);
    const op = document.createElement("div");
    op.className = "lei-pre-anexo-op";
    [["separar", c.modo === "atualizar" ? "lei_pre_anexo_separar_upd" : "lei_pre_anexo_separar"],
     ["manter", "lei_pre_anexo_manter"], ["descartar", "lei_pre_anexo_descartar"]].forEach(([v, k]) => {
      const lb = document.createElement("label");
      const r = document.createElement("input");
      r.type = "radio";
      r.name = "leiPreAx_" + m.id;
      r.value = v;
      r.checked = c.decisoes[m.id] === v;
      r.onchange = () => { c.decisoes[m.id] = v; leiPrePintar(); };
      const tx = document.createElement("span");
      tx.textContent = t(k);
      lb.append(r, tx);
      op.append(lb);
    });
    el.append(op);
    return el;
  }

  const lb = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = aceita;
  cb.onchange = () => { c.decisoes[m.id] = cb.checked; leiPrePintar(); };
  const corpo = document.createElement("span");
  if (m.grupo === "invisiveis") {
    corpo.append(linha("lei-pre-ctx", t("lei_pre_item_linhas_n", { n: m.ocorrencias })));
  } else if (m.grupo === "cabecalho") {
    corpo.append(linha("lei-pre-ctx", t("lei_pre_item_linhas", { n: m.ocorrencias, l: linhasTxt })));
    corpo.append(linha("lei-pre-antes", m.antes));
  } else if (m.grupo === "pagina") {
    corpo.append(linha("lei-pre-ctx", t("lei_pre_item_linhas_n", { n: m.ocorrencias })));
    corpo.append(linha("lei-pre-antes", m.antes));
  } else if (m.grupo === "grafia") {
    corpo.append(linha("lei-pre-ctx", t("lei_pre_item_linha", { l: m.linhas[0] })));
    corpo.append(linha("lei-pre-antes", m.antes));
    corpo.append(linha("lei-pre-depois", m.depois));
  } else {
    corpo.append(linha("lei-pre-ctx", t("lei_pre_item_linha", { l: m.linhas[0] }) + " — " + t("lei_pre_rem_" + m.motivo)));
    corpo.append(linha("lei-pre-ctx", "… " + m.contexto));
    corpo.append(linha("lei-pre-antes", m.antes));
    corpo.append(linha("lei-pre-ctx", t("lei_pre_ficara")));
    corpo.append(linha("lei-pre-depois", m.depois));
  }
  lb.append(cb, corpo);
  el.append(lb);
  return el;
}

function leiPreGrupoEl(c, g, itens) {
  const card = document.createElement("div");
  card.className = "lei-pre-grupo";
  card.id = "leiPreGrupo_" + g;
  const cab = document.createElement("div");
  cab.className = "lei-pre-cab";
  const tit = document.createElement("span");
  tit.textContent = t("lei_pre_g_" + g) + " (" + itens.length + ")";
  cab.append(tit);
  if (g !== "anexo") {
    [["lei_pre_todos", true], ["lei_pre_nenhum", false]].forEach(([k, v]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min";
      b.id = "btnLeiPre" + (v ? "Todos_" : "Nenhum_") + g;
      b.textContent = t(k);
      b.onclick = () => { itens.forEach((m) => { c.decisoes[m.id] = v; }); leiPrePintar(); };
      cab.append(b);
    });
  }
  card.append(cab);
  const aj = document.createElement("div");
  aj.className = "lei-pre-ajuda";
  aj.textContent = t("lei_pre_h_" + g);
  card.append(aj);

  let lista = card;
  if (itens.length > 30) {
    const det = document.createElement("details");
    const sm = document.createElement("summary");
    sm.textContent = t("lei_pre_ver_itens", { n: itens.length });
    det.append(sm);
    card.append(det);
    lista = det;
  }
  itens.forEach((m) => lista.append(leiPreItemEl(c, m)));

  if (itens.some((m) => !leiPreAceita(c, m))) {
    const co = document.createElement("div");
    co.className = "lei-pre-consequencia";
    co.textContent = t("lei_pre_c_" + g);
    card.append(co);
  }
  return card;
}

function leiPrePintar() {
  const c = leiPreCtx;
  if (!c) return;
  const dlg = $("dlgLeiPre");
  const rolagem = dlg && dlg.scrollTop ? dlg.scrollTop : 0;
  const atualizar = c.modo === "atualizar";
  const soNum = !c.pre.mudancas.length;
  $("leiPreTitulo").textContent = t(soNum ? "lei_pre_titulo_num"
    : (atualizar ? "lei_pre_titulo_upd" : "lei_pre_titulo_criar"));
  $("leiPreAjuda").textContent = t(soNum ? "lei_pre_ajuda_num" : "lei_pre_ajuda");
  const aceitas = c.pre.mudancas.filter((m) => leiPreAceita(c, m)).length;
  $("leiPreResumo").textContent = soNum ? "" : t("lei_pre_resumo", { n: c.pre.mudancas.length, a: aceitas });
  $("btnLeiPreOriginal").hidden = soNum;

  const cx = $("leiPreLista");
  cx.innerHTML = "";
  LEI_PRE_GRUPOS.forEach((g) => {
    const itens = c.pre.mudancas.filter((m) => m.grupo === g);
    if (itens.length) cx.append(leiPreGrupoEl(c, g, itens));
  });

  /* A CRÍTICA DA NUMERAÇÃO, sobre o texto COMO FICARIA com as escolhas de
   * agora: recusar uma limpeza pode fazer aparecer (ou sumir) um salto */
  const res = leiAplicarPreprocesso(c.texto, c.pre.mudancas, c.decisoes);
  const arts = leiArtigos(res.texto);
  const pn = $("leiPreNumeracao");
  pn.innerHTML = "";
  if (arts.length < LEI_NUMERACAO_MIN_ARTIGOS || c.semNumeracao) {
    pn.hidden = true;
  } else {
    const num = leiNumeracao(arts);
    pn.hidden = false;
    pn.className = "lei-pre-num" + (num.graves.length ? "" : " ok");
    const cabN = document.createElement("div");
    cabN.className = "lei-pre-cab";
    cabN.textContent = num.graves.length ? t("lei_pre_num_aviso") : t("lei_pre_num_ok", { n: arts.length });
    pn.append(cabN);
    if (num.problemas.length) {
      const ul = document.createElement("ul");
      const ord = num.problemas.slice().sort((x, y) => (x.gravidade === y.gravidade ? 0 : x.gravidade === "grave" ? -1 : 1));
      leiNumeracaoLinhas(ord).slice(0, 12).forEach((p) => {
        const li = document.createElement("li");
        li.className = p.gravidade;
        li.textContent = p.texto;
        ul.append(li);
      });
      if (ord.length > 12) {
        const li = document.createElement("li");
        li.textContent = t("lei_num_mais", { n: ord.length - 12 });
        ul.append(li);
      }
      pn.append(ul);
    }
  }

  const r = res.resumo;
  $("leiPreFim").textContent = t("lei_pre_res", { cab: r.cabecalho + r.pagina, gra: r.grafia,
    rem: r.remissao, anx: r.anexosSeparados, inv: r.invisiveis }) + " " + t("lei_pre_fim");
  $("btnLeiPreConfirmar").textContent = t(atualizar ? "lei_pre_confirmar_upd" : "lei_pre_confirmar_criar");
  if (dlg && rolagem) dlg.scrollTop = rolagem;
}

function leiPreConfirmar() {
  const c = leiPreCtx;
  if (!c) return false;
  const res = leiAplicarPreprocesso(c.texto, c.pre.mudancas, c.decisoes);
  leiPreCtx = null;
  $("dlgLeiPre").close();
  try {
    leiReg(c.modo === "atualizar" ? "atualizacao" : "gravar", "revisão da colagem: escolhas confirmadas",
      JSON.stringify(res.resumo));
  } catch (e) {}
  c.aoConfirmar(res);
  return true;
}

/* "usar o texto original": segue sem limpar nada */
function leiPreOriginal() {
  const c = leiPreCtx;
  if (!c) return false;
  leiPreCtx = null;
  $("dlgLeiPre").close();
  try {
    leiReg(c.modo === "atualizar" ? "atualizacao" : "gravar", "revisão da colagem: seguiu com o texto original", "");
  } catch (e) {}
  c.aoConfirmar({ texto: c.texto, anexos: [], resumo: {} });
  return true;
}

function leiPreCancelar() {
  if ($("dlgLeiPre")) $("dlgLeiPre").close();
  if (!leiPreCtx) return;
  const modo = leiPreCtx.modo;
  leiPreCtx = null;
  try { leiReg(modo === "atualizar" ? "atualizacao" : "gravar", "revisão da colagem: voltou para revisar o texto", ""); }
  catch (e) {}
}

/* =====================================================================
 * ANTES DE COMPARAR UMA VERSÃO NOVA — o texto é desta lei? é a lei inteira?
 *
 * Três coisas que a comparação artigo a artigo não sabe sozinha:
 *   · o texto novo se apresenta como OUTRA lei (número/ano diferentes);
 *   · o texto é de uma lei que ALTERA (traz "[...]", "(NR)", "passa a
 *     vigorar…"): comparar trocaria artigos inteiros por trechos;
 *   · o texto novo tem só uma fração dos artigos: colagem incompleta, ou
 *     só as alterações. Nesse caso "não apareceu" NÃO é "foi revogado".
 * A pessoa escolhe; escolher "só os presentes" é o modo seguro.
 * ===================================================================== */
let leiUpdModoAusentes = "revogar";
let leiUpdAlteradora = null;      /* {texto, par}: a lei que ALTERA, lida, enquanto se decide */
let leiUpdInfo = null;
let leiCobCtx = null;

function leiUpdGuardas(l, novoTexto) {
  const antigos = leiArtigos(l.texto);
  const novos = leiArtigos(novoTexto);
  const ident = leiConfereIdentidade(l, novoTexto);
  const alt = leiPareceAlteradora(novoTexto);
  const cob = leiCoberturaDaAtualizacao(antigos, novos);
  const baixa = cob.total >= 10 && cob.pct < 0.5;
  const avisos = [];
  if (ident.conflito) avisos.push({ k: "identidade", novo: ident.novo.nome, gravada: l.nome });
  if (alt.sim) avisos.push({ k: "alteradora", s: alt.sinais.map((x) => t("lei_cob_s_" + x)).join(", ") });
  if (baixa) avisos.push({ k: "cobertura", n: cob.presentes, total: cob.total });
  return { avisos, baixa, alt: alt.sim, ident: ident.conflito, cob };
}

function leiUpdGuardaAbrir(g, aoContinuar) {
  leiCobCtx = { g, escolha: "", aoContinuar };
  leiCobPintar();
  abrirModal("dlgLeiCob");
  try {
    leiReg("atualizacao", "conferência da versão nova aberta",
      g.avisos.map((a) => a.k).join(" · "));
  } catch (e) {}
}

function leiCobPintar() {
  const c = leiCobCtx;
  if (!c) return;
  $("leiCobAjuda").textContent = t("lei_cob_ajuda");
  const av = $("leiCobAvisos");
  av.innerHTML = "";
  c.g.avisos.forEach((a) => {
    const d = document.createElement("div");
    d.className = "lei-upd-al alerta";
    d.textContent = t("lei_cob_a_" + a.k, a);
    av.append(d);
  });
  const ops = [];
  if (c.g.alt) ops.push("alteracoes");
  if (c.g.baixa || c.g.alt) ops.push("presentes");
  if (c.g.baixa && !c.g.alt) ops.push("revogar");
  if (!c.g.baixa && !c.g.alt && c.g.ident) ops.push("continuar");
  const ox = $("leiCobOpcoes");
  ox.innerHTML = "";
  ops.forEach((v) => {
    const lb = document.createElement("label");
    lb.className = "lei-dup-op" + (c.escolha === v ? " sel" : "");
    const r = document.createElement("input");
    r.type = "radio";
    r.name = "leiCob";
    r.value = v;
    r.checked = c.escolha === v;
    r.onchange = () => { c.escolha = v; leiCobPintar(); };
    const tx = document.createElement("span");
    tx.className = "lei-dup-op-tit";
    tx.textContent = t("lei_cob_o_" + v);
    lb.append(r, tx);
    ox.append(lb);
  });
  $("btnLeiCobConfirmar").disabled = !c.escolha;
  $("leiCobFim").textContent = t(c.escolha ? "lei_cob_pronto" : "lei_cob_escolha");
}

function leiCobConfirmar() {
  const c = leiCobCtx;
  if (!c || !c.escolha) return false;
  leiCobCtx = null;
  $("dlgLeiCob").close();
  try { leiReg("atualizacao", "conferência da versão nova: escolha", c.escolha); } catch (e) {}
  c.aoContinuar(c.escolha);
  return true;
}

function leiCobCancelar() {
  if ($("dlgLeiCob")) $("dlgLeiCob").close();
  if (!leiCobCtx) return;
  leiCobCtx = null;
  try { leiReg("atualizacao", "conferência da versão nova: voltou para revisar o texto", ""); } catch (e) {}
}

/* A numeração de uma lei JÁ GUARDADA: o aviso ao lado dos repetidos */
let leiNumeracaoMemo = { chave: "", res: null };
function leiNumeracaoDaLei(l) {
  const vazio = { problemas: [], graves: [] };
  if (!l || !String(l.texto || "").trim()) return vazio;
  const chave = l.id + "|" + leiHashTexto(l.texto);
  if (leiNumeracaoMemo.chave !== chave) {
    const arts = leiArtigos(l.texto);
    leiNumeracaoMemo = { chave, res: arts.length >= LEI_NUMERACAO_MIN_ARTIGOS ? leiNumeracao(arts) : vazio };
  }
  return leiNumeracaoMemo.res;
}

/* Os ANEXOS separados na colagem: sob o texto da lei, um bloco recolhível por anexo */
function leiPintarAnexos() {
  const cx = $("leiAnexos");
  if (!cx) return;
  cx.innerHTML = "";
  const l = leiIdAtual ? leiDe(leiIdAtual) : null;
  const an = (l && l.anexos) || [];
  if (!an.length) { cx.hidden = true; return; }
  cx.hidden = false;
  const h = document.createElement("div");
  h.className = "duv-titulo";
  h.textContent = t("lei_anexos_titulo", { n: an.length });
  cx.append(h);
  an.forEach((a) => {
    const det = document.createElement("details");
    det.className = "lei-anexo";
    const sm = document.createElement("summary");
    sm.textContent = a.titulo + " · " + t("lei_anexo_tam", { n: String(a.texto || "").length });
    const tx = document.createElement("div");
    tx.className = "lei-anexo-txt";
    tx.textContent = a.texto || "";
    det.append(sm, tx);
    cx.append(det);
  });
}

/* Pinta o texto com as palavras que NÃO existem no outro lado marcadas,
 * preservando as quebras de linha (leiPalavrasDiferentes as achata) */
function leiMarcarDiferencas(el, txt, contra) {
  const limpa = (w) => String(w).toLowerCase().replace(/^[^a-z0-9à-ú]+|[^a-z0-9à-ú]+$/gi, "");
  const contagem = {};
  String(contra || "").split(/\s+/).forEach((w) => {
    const k = limpa(w);
    if (k) contagem[k] = (contagem[k] || 0) + 1;
  });
  String(txt || "").split(/(\s+)/).forEach((tok) => {
    if (!tok) return;
    if (/^\s+$/.test(tok)) { el.append(document.createTextNode(tok)); return; }
    const k = limpa(tok);
    if (k && contagem[k] > 0) { contagem[k]--; el.append(document.createTextNode(tok)); return; }
    if (!k) { el.append(document.createTextNode(tok)); return; }
    const m = document.createElement("mark");
    m.className = "lei-upd-marca";
    m.textContent = tok;
    el.append(m);
  });
}

function leiNovaAbrir() {
  leiIdAtual = "";
  $("leiTexto").value = "";
  leiSujo = false;
  leiTrocarModo("editar");
  leiPintar();
  uiAlert(t("lei_colar_instrucao"));
}

/* De qual(is) disciplina(s) uma lei já serve, lido pelos próprios tópicos
 * ligados a ela — sem campo novo no dado, porque a lei pode legitimamente
 * servir mais de uma disciplina ao mesmo tempo (a 4.320 em "Receita
 * pública" E "Despesa pública", disciplinas diferentes do mesmo edital
 * ou de editais diferentes). */
function leiDisciplinasDe(l) {
  const vistas = {};
  (l.topicos || []).forEach((c) => {
    const disc = String(c).split("›")[0];
    if (disc) vistas[disc] = true;
  });
  return Object.keys(vistas);
}

function leiVincularAbrir(siglaParaLembrar) {
  const cx = $("leiVincCx");
  if (!cx) return;
  if (!leiAtual || !leiAtual.chave) return;
  cx.innerHTML = "";
  /* VINCULAR À FORÇA, POR ESTA PORTA TAMBÉM: quando a janela foi aberta
   * a partir de uma citação de sigla desconhecida ("CTN"), escolher a
   * lei aqui é dizer o que a sigla significa — e a sigla vira apelido
   * da lei escolhida. A sigla fica na CLOSURE desta chamada, e não numa
   * variável global à espera: uma variável esquecida vazaria para a
   * próxima vez que alguém abrisse esta janela por outro motivo. */
  const sigla = String(siglaParaLembrar || "");
  if ($("leiVincLembrar")) {
    $("leiVincLembrar").hidden = !sigla;
    if (sigla) $("leiVincLembrar").textContent = t("lei_vinc_lembrar", { l: sigla });
  }
  const minha = leisChaveComparavel(leiAtual.chave);
  const outras = leisLista().filter((l) =>
    !(l.topicos || []).some((c) => leisChaveComparavel(c) === minha));
  if (!outras.length) { uiAlert(t("lei_vincular_vazio")); return; }

  const item = (l) => {
    const el = document.createElement("div");
    el.className = "duv-item";
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
      if (sigla) {
        try {
          if (leiApelidoAdicionar(l.id, sigla)) {
            leiReg("vinculo", "sigla vinculada à lei à força", sigla + " → " + l.nome);
          }
        } catch (e) {}
      }
      $("dlgLeiVincular").close();
      leiTrocarPara(l.id);
    };
    el.append(tit, sub, b);
    return el;
  };

  /* AGRUPAR POR DISCIPLINA — sem isso a lista mistura leis de disciplinas
   * inteiramente diferentes, e "reutilizar lei já existente na
   * disciplina" (o pedido) vira "procurar na lista inteira do app". A
   * disciplina do tópico atual vem primeiro; o resto, depois. */
  const desta = outras.filter((l) => leiDisciplinasDe(l).some((d) =>
    leisChaveComparavel(d) === leisChaveComparavel(leiAtual.disciplina)));
  const outrasDisc = outras.filter((l) => desta.indexOf(l) < 0);

  if (desta.length) {
    const rot = document.createElement("div");
    rot.className = "lei-vinc-grupo";
    rot.textContent = t("lei_vinc_grupo_disc", { d: leiAtual.disciplina });
    cx.append(rot);
    desta.forEach((l) => cx.append(item(l)));
  }
  if (outrasDisc.length) {
    const rot = document.createElement("div");
    rot.className = "lei-vinc-grupo";
    rot.textContent = t("lei_vinc_grupo_outras");
    cx.append(rot);
    outrasDisc.forEach((l) => cx.append(item(l)));
  }
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
  /* SEM DATA SALVA, O CAMPO NASCE VAZIO — nunca "hoje" por padrão.
   * Chutar hoje fazia abrir esta janela só para corrigir o link e
   * clicar "guardar" registrar "consultada hoje" mesmo que ninguém
   * tivesse conferido nada agora: uma data que parece confirmada e
   * nunca foi. leiPintarProcedencia já trata a ausência corretamente
   * ("nunca conferida") — quem decide que hoje É a data é a pessoa,
   * escolhendo, não o formulário chutando por ela. */
  $("leiProcData").value = l.consultadaEm || "";
  $("leiProcVersao").value = l.versao || "";
  if ($("leiProcEnte")) $("leiProcEnte").value = l.ente || "";
  if ($("leiProcApelido")) {
    $("leiProcApelido").value = String(l.apelido || "").split(/[\s/,]+/)
      .filter(Boolean).join(", ");
  }
  abrirModal("dlgLeiProc");
}

/* O NOME É A FONTE DA VERDADE DE ESPÉCIE, NÚMERO E ANO.
 *
 * Sem isto, corrigir o nome corrigia METADE do registro: a Constituição
 * que tinha sido identificada errado como "Emenda Constitucional
 * 106/2020" passava a se CHAMAR Constituição e continuava guardando
 * especie:"Emenda Constitucional" e numero:"106". Ninguém veria — até o
 * dia em que um comentário citasse "a EC 106" e o aplicativo abrisse a
 * Constituição inteira dizendo que era a emenda. É a armadilha de
 * sempre: a mesma informação escrita em dois lugares, e o conserto que
 * só alcança um deles.
 *
 * NÃO PARSEOU, LIMPA. Guardar numero:"106" debaixo de um nome que não
 * diz 106 é manter uma afirmação falsa; e não se perde nada, porque
 * leiCasarRotulo já procura o número dentro do NOME quando o campo está
 * vazio. O apelido é campo à parte e não é tocado. */
function leiCamposDoNome(nome) {
  const k = (typeof leiRotuloChave === "function")
    ? leiRotuloChave(nome) : { especie: "", numero: "" };
  const bonito = {
    "lc": "Lei Complementar", "lei": "Lei", "decreto-lei": "Decreto-Lei",
    "decreto": "Decreto", "ec": "Emenda Constitucional",
    "constituicao": "Constituição",
  }[k.especie] || "";
  const ano = (String(nome || "").match(/\b(1[89]\d{2}|20\d{2})\b/) || [])[1] || "";
  return { especie: bonito, numero: k.numero || "", ano };
}

function leiProcSalvar() {
  if (!leiIdAtual) return false;
  const nome = String($("leiProcNome").value || "").trim();
  const nomeFinal = nome || leiDe(leiIdAtual).nome;
  const campos = leiCamposDoNome(nomeFinal);
  leiGuardar({
    id: leiIdAtual,
    nome: nomeFinal,
    especie: campos.especie,
    numero: campos.numero,
    ano: campos.ano,
    fonte: String($("leiProcFonte").value || "").trim(),
    consultadaEm: String($("leiProcData").value || "").trim(),
    versao: String($("leiProcVersao").value || "").trim(),
    ente: $("leiProcEnte") ? String($("leiProcEnte").value || "").trim() : (leiDe(leiIdAtual).ente || ""),
    /* as siglas viram a lista do campo "apelido" que o casamento já lê;
     * apagar uma daqui é como se desfaz um vínculo à força errado */
    apelido: $("leiProcApelido")
      ? String($("leiProcApelido").value || "").split(/[\s/,;]+/)
          .filter(Boolean).map((x) => x.toUpperCase()).join(" ")
      : leiDe(leiIdAtual).apelido || "",
  });
  $("dlgLeiProc").close();
  try { leiReg("procedencia", "procedência atualizada",
           nome + " · " + $("leiProcData").value);
  } catch (e) {}
  leiPintar();
  return true;
}

/* =====================================================================
 * ATUALIZAR PARA NOVA VERSÃO
 *
 * Compara a lei gravada com uma versão nova colada, ARTIGO A ARTIGO — o
 * próprio número do artigo já é a âncora, então o diff é só casar por
 * `leiNumNormal` e comparar o texto depois de normalizar espaço. Nada é
 * gravado até "finalizar": até lá, tudo fica num estado local
 * (leiUpdComparo), e só os itens marcados como aceitos entram na camada
 * de alteração. A base (`l.texto`) nunca é lida por `leiGuardar` aqui.
 * ===================================================================== */
let leiUpdComparo = null;    /* [{num, numCru, tipo, antigo, novo, aceito}] */
let leiUpdIdx = -1;
let leiUpdFonteGlobal = "";

function leiAtualizarAbrir() {
  if (!$("dlgLeiAtualizar") || !leiIdAtual) return;
  $("leiUpdFonte").value = "";
  $("leiUpdTexto").value = "";
  $("leiUpdAviso1").textContent = "";
  $("leiUpdPasso1").hidden = false;
  $("leiUpdPasso2").hidden = true;
  leiUpdComparo = null;
  leiUpdIdx = -1;
  leiUpdModoAusentes = "revogar";
  leiUpdInfo = null;
  leiUpdAlteradora = null;
  if ($("leiUpdModoCompleta")) { $("leiUpdModoCompleta").checked = true; $("leiUpdModoAlt").checked = false; }
  if ($("leiUpdGuardarAltCx")) $("leiUpdGuardarAltCx").hidden = true;
  abrirModal("dlgLeiAtualizar");
  leiReg("atualizacao", "janela de atualização aberta", "");
}

function leiAtualizarComparar(opc) {
  const o = opc || {};
  const l = leiDe(leiIdAtual);
  if (!l) return false;
  const novoTexto = String($("leiUpdTexto").value || "");
  const modoAlt = !!(o.modoAlt || ($("leiUpdModoAlt") && $("leiUpdModoAlt").checked));
  let fonte = String($("leiUpdFonte").value || "").trim();
  /* lei que ALTERA: a norma que motivou a atualização é ela mesma — o título serve de fonte */
  if (!fonte && modoAlt) {
    const idf = leiIdentificar(novoTexto);
    if (idf) { fonte = idf.curto; $("leiUpdFonte").value = fonte; }
  }
  if (!fonte) { $("leiUpdAviso1").textContent = t("lei_upd_sem_fonte"); return false; }
  if (modoAlt) return leiAtualizarAlteracoes(l, fonte, novoTexto, o);
  /* cada etapa que abre uma tela volta aqui, dizendo o que já foi feito */
  const seguinte = (extra) => leiAtualizarComparar(Object.assign({}, o, extra));

  /* 1. TEXTO NOVO NUMA LINHA SÓ: propõe separar antes de tudo (sem isso dava
   * "nenhum artigo" e a atualização morria com o texto certo na mão) */
  if (!o.separado) {
    const sep = leiSepararColagem(novoTexto);
    if (sep.aplicavel) {
      leiSepararPerguntar(sep, "lei_sep_conf_upd").then((ok) => {
        try { leiReg("atualizacao", ok ? "texto novo numa linha só: separado em artigos"
                                       : "texto novo numa linha só: a pessoa voltou para revisar",
                     sep.artigos.length + " artigos"); } catch (e) {}
        if (!ok) return;
        $("leiUpdTexto").value = sep.texto;
        seguinte({ separado: true });
      });
      return false;
    }
  }

  /* 2. LIMPEZA DO TEXTO DE PDF (cabeçalho de página, anexos, "Art . 382",
   * remissão partida) — a pessoa vê e aprova antes de qualquer comparação */
  if (!o.limpo) {
    const an = leiPreAnalisar(novoTexto);
    if (an.deve) {
      leiRevisarColagemAbrir({
        modo: "atualizar", texto: novoTexto, pre: an.pre,
        aoConfirmar: (res) => {
          $("leiUpdTexto").value = res.texto;
          seguinte({ separado: true, limpo: true });
        },
      });
      return false;
    }
  }

  const novos = leiArtigos(novoTexto);
  if (!novos.length) { $("leiUpdAviso1").textContent = t("lei_upd_sem_artigo"); return false; }

  /* 3. A COMPARAÇÃO É POR NÚMERO, UM ARTIGO POR NÚMERO. Com um artigo repetido
   * no texto novo (o antigo tachado e o novo, como sai de um PDF), o mapa
   * deixava a ÚLTIMA ocorrência ganhar sem dizer nada — e se a ordem fosse a
   * inversa, valeria a antiga. A pessoa escolhe antes. Os números que a lei
   * gravada repete DE VERDADE (corpo e ADCT) já foram conferidos. */
  if (!o.conferido) {
    const grupos = leiDuplicados(novoTexto, l.repetidosOk);
    if (grupos.length) {
      leiDuplicadosAbrir({
        modo: "atualizar", texto: novoTexto, grupos,
        aoConfirmar: (res) => {
          $("leiUpdTexto").value = res.texto;
          seguinte({ separado: true, limpo: true, conferido: true });
        },
      });
      return false;
    }
  }

  /* 4. É desta lei? É a lei inteira? Ou só as alterações? */
  if (!o.guardado) {
    const g = leiUpdGuardas(l, novoTexto);
    if (g.avisos.length) {
      leiUpdGuardaAbrir(g, (escolha) => {
        /* o texto é de uma lei que ALTERA: recomeça no modo "só alterações" */
        if (escolha === "alteracoes") {
          if ($("leiUpdModoAlt")) $("leiUpdModoAlt").checked = true;
          leiAtualizarComparar({ modoAlt: true });
          return;
        }
        leiUpdModoAusentes = escolha === "presentes" ? "presentes" : "revogar";
        seguinte({ separado: true, limpo: true, conferido: true, guardado: true });
      });
      return false;
    }
    leiUpdModoAusentes = "revogar";
  }

  /* 5. a comparação em si (leiCompararVersoes), com os alertas de cada item */
  const cmp = leiCompararVersoes(l.texto, novoTexto,
    { ausentes: leiUpdModoAusentes, ignorar: l.repetidosOk });
  if (!cmp.itens.length) {
    uiAlert(t("lei_upd_sem_mudanca")
      + (cmp.soFormatacao.length ? " " + t("lei_upd_soformat", { n: cmp.soFormatacao.length }) : ""));
    return false;
  }

  leiUpdComparo = cmp.itens;
  leiUpdInfo = cmp;
  leiUpdIdx = 0;
  leiUpdFonteGlobal = fonte;
  $("leiUpdPasso1").hidden = true;
  $("leiUpdPasso2").hidden = false;
  leiUpdMostrar();
  leiReg("atualizacao", "comparação aberta", fonte + " · " + cmp.itens.length + " diferenças"
    + (cmp.soFormatacao.length ? " · " + cmp.soFormatacao.length + " só de formatação" : "")
    + (leiUpdModoAusentes === "presentes" ? " · só os artigos presentes" : ""));
  return true;
}

/* =====================================================================
 * ATUALIZAR COM UMA LEI QUE ALTERA — "só alterações"
 *
 * O texto colado é a LC 95/2022, 112/2023 ou 145/2024: não traz o Código
 * inteiro, traz artigos citados com "[...]", (NR), (AC) e REVOGADO. Aqui não
 * se compara "lei inteira contra lei inteira": lê-se cada artigo-alvo por
 * endereço (parágrafo, inciso, alínea), mescla-se no artigo VIGENTE e a
 * pessoa decide, artigo a artigo, com o texto proposto ao lado do atual —
 * e pode editar o texto proposto antes de aceitar. Os artigos que a lei
 * alteradora NÃO cita nunca são tocados (nada vira "revogado" por ausência).
 * ===================================================================== */
function leiAtualizarAlteracoes(l, fonte, novoTexto, o) {
  const seguinte = (extra) => leiAtualizarComparar(Object.assign({}, o, { modoAlt: true }, extra));
  /* 1. limpeza (cabeçalho de página, anexos…) SEM tirar as aspas que separam o artigo citado */
  if (!o.limpo) {
    const an = leiPreAnalisar(novoTexto, { manterAspas: true, semNumeracao: true });
    if (an.deve) {
      leiRevisarColagemAbrir({
        modo: "atualizar", texto: novoTexto, pre: an.pre, semNumeracao: true,
        aoConfirmar: (res) => { $("leiUpdTexto").value = res.texto; seguinte({ limpo: true }); },
      });
      return false;
    }
  }
  const texto = String($("leiUpdTexto").value || novoTexto);
  const par = leiLerAlteradora(texto, l);
  if (!par.blocos.length && !par.revogacoes.length) { uiAlert(t("lei_upd_alt_nenhuma")); return false; }
  /* 2. o texto fala DESTA lei? */
  if (!o.guardado && !leiAlteradoraCitaLei(texto, l)) {
    leiUpdGuardaAbrir({ avisos: [{ k: "nao_cita", nome: l.nome }], baixa: false, alt: false, ident: true },
      () => seguinte({ limpo: true, guardado: true }));
    return false;
  }
  const itens = leiItensDaAlteradora(l, par);
  if (!itens.length) { uiAlert(t("lei_upd_sem_mudanca")); return false; }
  leiUpdComparo = itens;
  leiUpdInfo = { soFormatacao: [], naoComparados: [], cobertura: { pct: 1 }, avisos: par.avisos, alteradora: par };
  leiUpdModoAusentes = "presentes";
  leiUpdAlteradora = { texto, par };
  leiUpdIdx = 0;
  leiUpdFonteGlobal = fonte;
  $("leiUpdPasso1").hidden = true;
  $("leiUpdPasso2").hidden = false;
  leiUpdMostrar();
  leiReg("atualizacao", "comparação de lei que altera aberta", fonte + " · " + itens.length + " artigos-alvo · "
    + par.proprios + " artigos próprios da lei alteradora · " + par.avisos.length + " aviso(s)");
  return true;
}

/* guardar também o texto da lei que ALTERA, como lei própria (sem vínculo com tópicos) */
function leiGuardarAlteradora() {
  const a = leiUpdAlteradora;
  if (!a || !a.par.ident) return null;
  const ident = a.par.ident;
  const ente = leiEnteDoTexto(a.texto);
  if (leiAcharIgual({ nome: ident.nome, especie: ident.especie, numero: ident.numero, ano: ident.ano, ente })) return null;
  const r = leiGuardar({ id: leiIdLivre(ident.nome, ente), nome: ident.nome, especie: ident.especie,
    numero: ident.numero, ano: ident.ano, texto: a.texto, topicos: [], consultadaEm: leisHojeISO(),
    ...(ente ? { ente } : {}) });
  try { leiReg("atualizacao", "lei que altera guardada na biblioteca", ident.nome); } catch (e) {}
  return r;
}

function leiUpdMostrar() {
  if (!leiUpdComparo || leiUpdIdx < 0) return;
  const item = leiUpdComparo[leiUpdIdx];
  $("leiUpdConta").textContent = (leiUpdIdx + 1) + "/" + leiUpdComparo.length;
  const ac = leiUpdComparo.filter((x) => x.aceito).length;
  const re = leiUpdComparo.filter((x) => x.recusado).length;
  $("leiUpdResumo").textContent = t("lei_upd_placar",
    { a: ac, r: re, p: leiUpdComparo.length - ac - re });
  $("btnLeiUpdAnterior").disabled = leiUpdIdx <= 0;
  $("btnLeiUpdProximo").disabled = leiUpdIdx >= leiUpdComparo.length - 1;

  const cx = $("leiUpdItem");
  cx.innerHTML = "";
  const h = document.createElement("div");
  h.className = "duv-titulo";
  h.textContent = "Art. " + item.numCru + " — " + t("lei_upd_tipo_" + item.tipo)
    + (item.aceito ? " · " + t("lei_upd_ok") : "");
  if (item.recusado) {
    const rc = document.createElement("span");
    rc.className = "lei-upd-recusada";
    rc.textContent = t("lei_upd_recusada");
    h.append(rc);
  }
  cx.append(h);

  /* O QUE O APP SABE SOBRE ESTA MUDANÇA, antes de a pessoa decidir */
  if ((item.alertas || []).length) {
    const als = document.createElement("div");
    als.className = "lei-upd-als";
    item.alertas.forEach((a) => {
      const d = document.createElement("div");
      d.className = "lei-upd-al " + a.sev;
      d.textContent = t("lei_upd_al_" + a.k, a);
      als.append(d);
    });
    cx.append(als);
  }

  /* o texto INTEIRO de cada lado, com as palavras que só existem ali marcadas */
  [["cm_mel_antes", item.antigo, "qm-antes", item.novo], ["cm_mel_depois", item.novo, "qm-depois", item.antigo]]
    .forEach(([rot, txt, cls, contra]) => {
      if (!txt) return;   /* "novo" não tem antes; "revogado" não tem depois */
      const r1 = document.createElement("div");
      r1.className = "qm-rot";
      r1.textContent = t(rot);
      const d = document.createElement("div");
      d.className = "qm-lado lei-upd-lado " + cls;
      if (item.tipo === "mudou") leiMarcarDiferencas(d, txt, contra);
      else d.textContent = String(txt);
      cx.append(r1, d);
    });

  /* PARCIAL: o texto proposto é uma MESCLA — a pessoa pode conferir e corrigir antes de aceitar */
  if (item.parcial && item.tipo !== "revogado") {
    const rot = document.createElement("div");
    rot.className = "qm-rot";
    rot.textContent = t("lei_upd_proposto");
    const ta = document.createElement("textarea");
    ta.id = "leiUpdProposto";
    ta.rows = 8;
    ta.style.width = "100%";
    ta.style.boxSizing = "border-box";
    ta.value = item.novo;
    ta.oninput = () => { item.novo = ta.value; };
    cx.append(rot, ta);
  }
  if (leiUpdInfo && leiUpdInfo.avisos && leiUpdInfo.avisos.length) {
    leiUpdInfo.avisos.slice(0, 6).forEach((a) => {
      const n = document.createElement("div");
      n.className = "nota";
      n.textContent = t(a.k === "anexo" ? "lei_upd_anexo_nota" : "lei_upd_revogar_ausente", { t: a.texto, a: a.texto });
      cx.append(n);
    });
  }
  if (leiUpdInfo) {
    if (leiUpdInfo.soFormatacao.length) {
      const n = document.createElement("div");
      n.className = "nota";
      n.textContent = t("lei_upd_soformat", { n: leiUpdInfo.soFormatacao.length });
      cx.append(n);
    }
    if (leiUpdInfo.naoComparados.length) {
      const n = document.createElement("div");
      n.className = "nota";
      n.textContent = t("lei_upd_naocomp", { n: leiUpdInfo.naoComparados.length });
      cx.append(n);
    }
  }

  $("btnLeiUpdAceitar").textContent = t(item.aceito ? "lei_upd_aceito" : "lei_upd_aceitar");
  $("leiUpdPrompt").hidden = true;
  $("leiUpdPromptBarra").hidden = true;
  $("leiUpdExplicaRot").hidden = true;
  $("leiUpdExplica").hidden = true;
  $("leiUpdExplica").value = item.explicacao || "";
}

function leiUpdMover(delta) {
  if (!leiUpdComparo) return;
  const novo = leiUpdIdx + delta;
  if (novo < 0 || novo >= leiUpdComparo.length) return;
  leiUpdIdx = novo;
  leiUpdMostrar();
}

function leiUpdAceitar() {
  if (!leiUpdComparo) return;
  const item = leiUpdComparo[leiUpdIdx];
  item.aceito = true;
  item.recusado = false;
  item.explicacao = String(($("leiUpdExplica") || {}).value || "").trim();
  leiUpdMostrar();
}

/* RECUSAR é uma decisão, não um "depois": o artigo fica marcado como recusado
 * (e não entra na gravação), e a contagem mostra quantos ainda esperam decisão */
function leiUpdPular() {
  if (!leiUpdComparo) return;
  const item = leiUpdComparo[leiUpdIdx];
  item.aceito = false;
  item.recusado = true;
  if (leiUpdIdx < leiUpdComparo.length - 1) leiUpdMover(1);
  else leiUpdMostrar();
}

/* PEDIR APOIO DA IA — mesmo formato do resto do app: monta o prompt com
 * o antes e o depois, mostra numa caixa copiável, e a resposta colada
 * fica numa caixa própria — ela não é aplicada sozinha em lugar nenhum,
 * só acompanha a alteração se o artigo for aceito. */
function leiUpdIA() {
  if (!leiUpdComparo) return;
  const item = leiUpdComparo[leiUpdIdx];
  $("leiUpdPrompt").value = t("lei_upd_ia_prompt", {
    artigo: "Art. " + item.numCru,
    antigo: item.antigo || t("lei_upd_nao_existia"),
    novo: item.novo || t("lei_upd_revogado_texto"),
  });
  $("leiUpdPrompt").hidden = false;
  $("leiUpdPromptBarra").hidden = false;
  $("leiUpdExplicaRot").hidden = false;
  $("leiUpdExplica").hidden = false;
  leiReg("atualizacao", "apoio de IA pedido", "Art. " + item.numCru);
}

/* FINALIZAR — só aqui algo é gravado, e só os itens aceitos. A base
 * (`l.texto`) não faz parte deste payload em nenhuma hipótese. */
function leiAtualizarAplicar() {
  const l = leiDe(leiIdAtual);
  if (!l || !leiUpdComparo) return false;
  const aceitos = leiUpdComparo.filter((x) => x.aceito);
  if (!aceitos.length) { uiAlert(t("lei_upd_nenhum_aceito")); return false; }

  const alt = Object.assign({}, l.alteracoes || {});
  aceitos.forEach((item) => {
    /* HISTÓRICO POR ARTIGO: cada lei que mexeu nele fica registrada, na ordem em que foi
     * aplicada, com a data DA LEI (para avisar de aplicação fora de ordem) */
    const prev = alt[item.num];
    const hoje = leisHojeISO();
    const hist = (prev && Array.isArray(prev.historico)) ? prev.historico.slice()
      : (prev ? [{ fonte: prev.fonteAlteracao || "", data: prev.data || "", dataLei: prev.dataLei || "", tipo: "anterior" }] : []);
    hist.push({ fonte: item.fonteItem || leiUpdFonteGlobal, data: hoje, dataLei: item.dataLei || "", tipo: item.tipo });
    const fontes = [];
    hist.forEach((h) => { if (h.fonte && fontes.indexOf(h.fonte) < 0) fontes.push(h.fonte); });
    alt[item.num] = {
      texto: item.tipo === "revogado" ? "" : item.novo,
      fonteAlteracao: fontes.join("; "),
      data: hoje,
      revogado: item.tipo === "revogado",
      historico: hist,
      dataLei: item.dataLei || "",
    };
  });

  leiGuardar({
    id: leiIdAtual,
    alteracoes: alt,
    consultadaEm: leisHojeISO(),
    versao: (l.versao ? l.versao + "; " : "")
      + t("lei_upd_versao_sufixo", { f: leiUpdFonteGlobal }),
  });

  leiReg("atualizacao", "versão atualizada",
         leiUpdFonteGlobal + " · " + aceitos.length + " artigos");
  if (leiUpdAlteradora && $("leiUpdGuardarAlt") && $("leiUpdGuardarAlt").checked) leiGuardarAlteradora();
  leiUpdAlteradora = null;
  $("dlgLeiAtualizar").close();
  leiUpdComparo = null;
  leiPintar();
  uiAlert(t("lei_upd_pronto", { n: aceitos.length }));
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
  if (!leiAtual.chave) { uiAlert(t("lei_avulsa_sem_topico")); return false; }
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
  if (!leiAtual.chave) { uiAlert(t("lei_avulsa_sem_topico")); return; }
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

  /* =================================================================
   * O REGISTRO PASSA PELA MESMA TELA DE TODO O RESTO DO APLICATIVO
   *
   * Até aqui este botão gravava SOZINHO: chamava edMarcar com os
   * minutos que ele mesmo tinha calculado, e avisava depois. Duas
   * coisas erradas nisso, e a segunda é a grave.
   *
   * 1. É A ÚNICA PORTA ASSIM. Agenda, material e questões todas abrem
   *    o mesmo formulário — minutos, forma de estudo, questões feitas,
   *    dificuldade, onde parei, observação. Aqui não havia nada disso:
   *    quem leu a lei com o livro do lado e resolveu vinte questões
   *    registrava "leitura, 193 min, humor médio" e ponto.
   *
   * 2. OS MINUTOS ERAM UM PALPITE APRESENTADO COMO FATO. Ninguém
   *    cronometrou nada: "min" é palavras ÷ 75, ou seja "quanto tempo
   *    ESTA lei levaria para ser lida inteira, a 75 palavras por
   *    minuto". Para a EC 132/2023, 14465 palavras, isso dá 193
   *    minutos — e iam para o diário como três horas de estudo por
   *    causa de um botão. Um erro assim não fica no diário: ele entra
   *    no cálculo de cobertura, muda a prioridade da disciplina e
   *    desloca as horas das outras.
   *
   * O palpite continua útil — é um bom ponto de partida, e melhor que
   * um campo em branco. Ele passa a ser o valor SUGERIDO num campo que
   * se corrige em dois toques, que é a diferença entre estimar e
   * afirmar.
   * ================================================================= */
  if (typeof abrirRegistro !== "function") {
    /* sem a tela, o caminho antigo — é melhor registrar de forma tosca
     * do que não registrar; mas isto não acontece no app montado */
    if (typeof edMarcar === "function") {
      const ja = typeof edProgresso !== "undefined" && edProgresso[leiAtual.chave];
      edMarcar(item, ja ? "revisado" : "feito",
        { minutos: min, formas: ["leitura"], humor: "media" });
    }
    return;
  }
  /* O REGISTRO SÓ É ANOTADO DEPOIS DE CONFIRMADO.
   * Anotar aqui diria "leitura registrada" mesmo quando a pessoa
   * fechasse o formulário sem gravar — e um registro que mente sobre o
   * que aconteceu é pior que registro nenhum, porque é para ele que se
   * olha quando algo não bate. */
  const quanto = palavras + " palavras" + (rotulo ? " · " + rotulo : "");
  regDepois = (m2) => {
    try { leiReg("leitura", "leitura registrada", m2 + " min · " + quanto); }
    catch (e) {}
  };
  abrirRegistro(item);
  try { leiReg("leitura", "tela de registro aberta",
               "sugestão de " + min + " min · " + quanto); } catch (e) {}
}

/* =====================================================================
 * DE ONDE A LEI FOI ABERTA — E PARA ONDE ELA DEVOLVE
 *
 * Mesmo desenho do "jurVoltaPara" da jurisprudência, e pelo mesmo
 * motivo: a gaveta da lei passou a ser aberta DE DENTRO de uma sessão
 * de questões, e quem consulta o artigo no meio de uma prova quer
 * voltar para a MESMA questão, com o rascunho e os grifos intactos.
 *
 * A sessão não é fechada — o <dialog> empilha no top layer e a lei sobe
 * por cima dela. O que sobra para este retorno é repintar a tela de
 * trás: o botão dela conta os artigos da lei, e esse número pode ter
 * mudado enquanto a gaveta esteve aberta.
 *
 * DE UM USO SÓ, e zerado ao disparar: um retorno que sobrevive dispara
 * na próxima abertura da lei, vinda de outra tela.
 * ===================================================================== */
let leiVoltaPara = null;

function leiVoltarPara() {
  const f = leiVoltaPara;
  leiVoltaPara = null;
  if (typeof f === "function") { try { f(); } catch (e) {} }
}

async function leiFechar() {
  if (leiSujo) {
    const r = await matPerguntarSaida();
    if (r !== "salvar" && r !== "sair") return;
    if (r === "salvar") {
      /* a conferência de artigos repetidos abriu: não se fecha a lei por
       * baixo dela, senão o "confirmar" voltaria para uma lei já fechada */
      if (leiGravar() === "pendente") return;
    } else {
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
  leiVoltarPara();
}

/* ---------------------------------------------------------------------
 * AJUDA
 *
 * Escrita como mapa da janela, não como lista de botões: cada item diz
 * PARA QUE serve e POR QUE existe. "Recitar: esconde o texto" é inútil
 * sem o "porque reler dá sensação de saber" — é o porquê que faz a
 * pessoa usar o recurso em vez de achá-lo estranho.
 * ------------------------------------------------------------------ */

/* A ORDEM É A DA JORNADA, e não a da barra de botões: como o texto
 * chega aqui, como se lê, como se marca, como se testa, como se
 * registra. Quem abre a ajuda está perdido em algum ponto do caminho, e
 * um índice na ordem do caminho é o que deixa achar o ponto.
 *
 * "consulta" e "sinais" entraram com os recursos que descrevem — o ⚖ da
 * tela de questões e as bordas coloridas do artigo. Ajuda que não
 * acompanha a tela vira a segunda fonte de verdade, e a errada. */
const LEI_AJUDA = [
  "fila", "proc", "consulta", "onde", "modos", "capitulos", "artigo",
  "editar", "marcas", "sinais", "cartoes", "cai", "recitar", "ranking",
  "cheia", "gravar", "lido", "log",
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
    /* "lei-aj-d" existe por causa do parágrafo.
     *
     * Três destas explicações passaram a ter mais de um parágrafo — os
     * dois exercícios do "testar", os dois limites das marcas, os dois
     * botões da fila. Elas são escritas com "\n\n" e entram por
     * textContent, e textContent NÃO quebra linha sozinho: sem um
     * white-space que preserve a quebra, os parágrafos viram um
     * paredão de texto corrido — pior de ler do que a versão curta que
     * eles substituíram.
     *
     * A classe é própria e não mexe em ".nota", que é usada em dezenas
     * de lugares onde a quebra não foi pensada. */
    txt.className = "nota lei-aj-d";
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
  leiEnvolverFluxo();
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
  liga("btnLeiIrDigitar", "ir ao artigo digitando", () => {
    $("dlgLeiIr").close();
    leiIrDigitando();
  });
  liga("btnLeiIrFechar", "fechar a grade de artigos", () => $("dlgLeiIr").close());
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
  liga("btnLeiFonteReset", "letra padrão", () => leiFonteDefinir(15));
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
  /* o caminho para ENVIAR: o relatório completo (com período, erros e
   * o texto pronto para copiar/baixar/compartilhar), já em "Leis e vínculos" */
  liga("btnLeiLogEnviar", "enviar relatório", () => {
    if (typeof abrirDiagnostico === "function") abrirDiagnostico({ assunto: "leis" });
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
  liga("btnLeiProcFechar", "fechar a procedência", () => $("dlgLeiProc").close());

  liga("btnLeiUpdComparar", "comparar versão nova", () => leiAtualizarComparar());
  liga("btnLeiDupConfirmar", "confirmar artigos repetidos", () => leiDupConfirmar());
  liga("btnLeiDupCancelar", "voltar da conferência de repetidos", () => leiDupCancelar());
  liga("btnLeiDupX", "fechar conferência de repetidos", () => leiDupCancelar());
  liga("btnLeiDupSugestoes", "voltar às sugestões", () => { leiDupSugestoes(); leiDupPintar(); });
  liga("btnLeiPreConfirmar", "confirmar a revisão da colagem", () => leiPreConfirmar());
  liga("btnLeiPreVoltar", "voltar da revisão da colagem", () => leiPreCancelar());
  liga("btnLeiPreX", "fechar a revisão da colagem", () => leiPreCancelar());
  liga("btnLeiPreOriginal", "usar o texto original", () => leiPreOriginal());
  liga("btnLeiCobConfirmar", "continuar depois da conferência", () => leiCobConfirmar());
  liga("btnLeiCobVoltar", "voltar da conferência da versão nova", () => leiCobCancelar());
  liga("btnLeiCobX", "fechar a conferência da versão nova", () => leiCobCancelar());
  liga("btnMatLeis", "abrir a biblioteca de leis", () => leiBibAbrir());
  if ($("leiUpdModoAlt")) {
    const mostrar = () => { $("leiUpdGuardarAltCx").hidden = !$("leiUpdModoAlt").checked; };
    $("leiUpdModoAlt").onchange = mostrar;
    $("leiUpdModoCompleta").onchange = mostrar;
  }
  liga("btnQsVincX", "fechar vínculos de lei", () => $("dlgQsVinc").close());
  liga("btnQsVincFechar", "fechar vínculos de lei", () => $("dlgQsVinc").close());
  liga("btnQsVincEscX", "fechar escolha de lei", () => $("dlgQsVincEsc").close());
  liga("btnQsVincEscCancelar", "cancelar escolha de lei", () => $("dlgQsVincEsc").close());
  liga("btnQsVincEscOk", "gravar vínculo de lei", () => qsVincSalvar());
  liga("btnLeiRelDup", "relatório: artigos repetidos", () => leiRelatorioCopiar("artigos repetidos"));
  liga("btnLeiRelPre", "relatório: revisar a colagem", () => leiRelatorioCopiar("revisar a colagem"));
  liga("btnLeiRelCob", "relatório: conferir a versão nova", () => leiRelatorioCopiar("conferir a versão nova"));
  liga("btnLeiRelUpd", "relatório: atualizar a lei", () => leiRelatorioCopiar("atualizar a lei"));
  liga("btnLeiRelJa", "relatório: lei já existente", () => leiRelatorioCopiar("lei já existente"));
  liga("btnLeiBibX", "fechar a biblioteca de leis", () => $("dlgLeiBib").close());
  liga("btnLeiBibFechar", "fechar a biblioteca de leis", () => $("dlgLeiBib").close());
  liga("btnLeiBibTodas", "biblioteca: todas", () => { leiBibFiltro = "todas"; leiBibPintar(); });
  liga("btnLeiBibConcurso", "biblioteca: do concurso atual", () => { leiBibFiltro = "concurso"; leiBibPintar(); });
  liga("btnLeiBibSem", "biblioteca: sem vínculo", () => { leiBibFiltro = "sem"; leiBibPintar(); });
  liga("btnLeiBibDup", "biblioteca: leis que parecem a mesma", () => leiMesAbrir());
  if ($("leiBibBusca")) $("leiBibBusca").oninput = () => { leiBibTexto = $("leiBibBusca").value; leiBibPintar(); };
  liga("btnLeiTopX", "fechar ligar a tópico", () => $("dlgLeiTopico").close());
  liga("btnLeiTopFechar", "fechar ligar a tópico", () => $("dlgLeiTopico").close());
  if ($("leiTopBusca")) $("leiTopBusca").oninput = () => { if (leiTopCtx) { leiTopCtx.busca = $("leiTopBusca").value; leiTopicoPintar(); } };
  liga("btnLeiJaConfirmar", "confirmar lei já existente", () => leiJaConfirmar());
  liga("btnLeiJaVoltar", "voltar da lei já existente", () => leiJaCancelar());
  liga("btnLeiJaX", "fechar lei já existente", () => leiJaCancelar());
  liga("btnLeiMesConfirmar", "mesclar leis", () => leiMesConfirmar());
  liga("btnLeiMesDistintas", "leis diferentes", () => leiMesDistintas());
  liga("btnLeiMesFechar", "fechar mesclagem", () => leiMesFechar());
  liga("btnLeiMesX", "fechar mesclagem", () => leiMesFechar());
  liga("btnLeiUpdFechar1", "fechar atualização", () => $("dlgLeiAtualizar").close());
  liga("btnLeiUpdFechar2", "fechar atualização", () => $("dlgLeiAtualizar").close());
  liga("btnLeiUpdAnterior", "artigo anterior da comparação", () => leiUpdMover(-1));
  liga("btnLeiUpdProximo", "próximo artigo da comparação", () => leiUpdMover(1));
  liga("btnLeiUpdAceitar", "aceitar alteração", () => leiUpdAceitar());
  liga("btnLeiUpdPular", "pular alteração", () => leiUpdPular());
  liga("btnLeiUpdFinalizar", "finalizar atualização", () => leiAtualizarAplicar());
  liga("btnLeiUpdIA", "pedir apoio da IA", () => leiUpdIA());
  liga("btnLeiUpdIACopiar", "copiar prompt de apoio", () => {
    try { navigator.clipboard.writeText($("leiUpdPrompt").value); } catch (e) {}
    const b = $("btnLeiUpdIACopiar");
    const r = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = r; }, 1800);
  });

  liga("btnLeiNotaSugerir", "sugerir nota do artigo", () => leiNotaSugerir());
  liga("btnLeiNotaCopiar", "copiar sugestão de nota", () => leiNotaCopiarPrompt());
  liga("btnLeiNotaSalvar", "guardar nota do artigo", () => leiNotaSalvar());
  liga("btnLeiNotaFechar", "fechar a nota do artigo", () => $("dlgLeiNota").close());
  liga("btnLeiCitaPreviewAbrir", "abrir a lei inteira da citação",
    () => leiCitacaoPreviewAbrirLeiInteira());
  liga("btnLeiCitaPreviewFechar", "fechar o preview da citação",
    () => $("dlgLeiCitaPreview").close());
  liga("btnLeiVincFechar", "fechar o vínculo", () => $("dlgLeiVincular").close());
  liga("btnLeiClozeFechar", "fechar a lacuna", () => $("dlgLeiCloze").close());
  liga("btnLeiClozeConferir", "conferir a lacuna", () => leiClozeConferir());
  liga("btnLeiClozeAplicar", "aplicar a lacuna", () => leiClozeAplicar());
  liga("btnLeiClozeCopiar", "copiar o prompt da lacuna", () => {
    try { navigator.clipboard.writeText($("leiClozePrompt").value); } catch (e) {}
    const b = $("btnLeiClozeCopiar");
    const r = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = r; }, 1800);
  });
  liga("btnLeiRankFechar", "fechar os artigos que mais caem", () => $("dlgLeiRank").close());

  /* as seis marcas, as MESMAS do resumo */
  [["btnLeiMarcaDest", "destaque"], ["btnLeiMarcaImp", "importante"],
   ["btnLeiMarcaDuv", "duvida"], ["btnLeiMarcaProva", "prova"],
   ["btnLeiMarcaPeg", "pegadinha"]].forEach(([id, tipo]) => {
    liga(id, "marca " + tipo, () => matMarcarSelecao(tipo, "lei"));
  });
  /* a sétima é diferente: marca E já abre a caixa de anotação, em vez de
   * só pintar (ver leiNotaTrechoMarcar) */
  liga("btnLeiMarcaNota", "marcar nota", () => leiNotaTrechoMarcar());

  if ($("leiTexto")) {
    $("leiTexto").addEventListener("input", () => { leiSujo = true; });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    leiAbrir, leiGravar, leiTem, leiFechar, leiRegistrarLeitura, leiIniciar,
    leiAbrirNoArtigo, leiIrAbrir, leiNovaAbrir,
    leiTrocarModo, leiModoAtual, leiPintar, leiIrArtigo, leiTrocarPara,
    leiVincularAbrir, leiProcAbrir, leiProcSalvar, leiCamposDoNome, leiClozeAbrir,
    leiClozeConferir, leiClozeAplicar, leiRanking, leiRankingAbrir,
    leiTextoDoTopico, leiAplicarNoTopico, leiEtiquetaDe, leiDoTopicoAtual,
    leiReg, leiLogTexto, leiLogAbrir, leiLogPintar, leiLogFiltrado,
    leiAjudaAbrir, leiCheiaTrocar, leiFonteMudar, LEI_AJUDA, LEI_LOG_CHAVE,
    leiGaveta,
    leiEdAbrir, leiEdSalvar, leiEdApagar, leiEdTrocar, leiEdSujo, leiEmCamada,
    leiFonteDefinir, leiFontePintar, leiFonteCarregar, leiJanelaMudar, leiJanelaAplicar, LEI_JANELAS,
    leiJanelaAtual: () => leiJanela,
    leiDisciplinasDe,
    leiAtualizarAbrir, leiAtualizarComparar, leiUpdMostrar, leiUpdMover,
    leiUpdAceitar, leiUpdPular, leiUpdIA, leiAtualizarAplicar,
    leiUpdComparoAtual: () => leiUpdComparo,
    leiUpdIdxAtual: () => leiUpdIdx,
    leiPintarEdicaoLivre,
    leiNotaAbrir, leiNotaTrechoAbrir, leiNotaTrechoMarcar,
    leiNotaSugerir, leiNotaCopiarPrompt, leiNotaSalvar,
    leiLigarCitacoesEm, leiCitarNoTexto, leiCitacaoBotao,
    leiCitacaoPreviewAbrir, leiCitacaoPreviewAbrirLeiInteira,
    leiCitaPreviewAlvoAtual: () => leiCitaPreviewAlvo,
  };
}
