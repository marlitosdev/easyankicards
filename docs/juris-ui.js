/* =====================================================================
 * A TELA DA JURISPRUDÊNCIA
 *
 * Uma gaveta por tópico, aberta dos três lugares em que se decide o que
 * estudar: a agenda da semana, o material e o próprio resumo.
 *
 * O gesto que ela existe para servir é um só e é curto: você está lendo
 * o resumo, encontra a frase que o tribunal decidiu, seleciona e guarda.
 * Tudo o mais — colar a ementa inteira, preencher tribunal e número —
 * é para quem está montando o material antes de estudar.
 * ===================================================================== */

let jurTopicoAtual = null;      /* {disciplina, nome, chave} */
let jurEditando = "";           /* id em edição, "" para novo */
/* "ler" ou "incluir" — ver jurPintarModo */
let jurModo = "ler";

/* ABRE NO MODO QUE A SITUAÇÃO PEDE.
 *
 * Com julgados guardados, o gesto é LER: clicar na etiqueta "3 julgados"
 * é pedir para ver os três, e um formulário de sete campos no topo
 * empurra a leitura para fora da tela. Sem nenhum julgado não há o que
 * ler, e a única coisa a fazer é incluir.
 *
 * É a mesma divisão do "responder / criar mais" das questões: a tela
 * abre no verbo que a pessoa veio exercer, e o outro fica a um toque. */
function jurAbrir(disciplina, topico, modo) {
  const chave = (typeof matChave === "function")
    ? matChave(disciplina, topico) : (disciplina + "›" + topico);
  jurTopicoAtual = { disciplina, nome: topico, chave };
  jurEditando = "";
  const sub = $("jurSub");
  if (sub) sub.textContent = t("jur_sub", { d: disciplina, t: topico });
  jurLimparForm();
  const quantos = jurDoTopico(chave).length;
  jurModo = modo || (quantos ? "ler" : "incluir");
  /* pedir "ler" sem ter o que ler abriria uma tela vazia */
  if (jurModo === "ler" && !quantos) jurModo = "incluir";
  jurPintarModo();
  jurPintarLista();
  abrirModal("dlgJuris");
  reg("JURIS", "gaveta aberta (" + jurModo + ")",
      disciplina + " › " + topico + " · " + quantos + " julgado(s)");
}

function jurPintarModo() {
  const lendo = jurModo === "ler";
  const quantos = jurTopicoAtual ? jurDoTopico(jurTopicoAtual.chave).length : 0;
  if ($("jurForm")) $("jurForm").hidden = lendo;
  if ($("jurLerAcoes")) $("jurLerAcoes").hidden = !lendo;
  /* voltar para a leitura só existe quando há o que ler */
  if ($("btnJurVoltarLer")) $("btnJurVoltarLer").hidden = !quantos;
  if ($("jurTitulo")) {
    $("jurTitulo").textContent = t(lendo ? "jur_titulo_ler" : "jur_titulo_novo");
  }
  const aj = $("jurAjuda");
  if (aj) aj.textContent = t(lendo ? "jur_ajuda_ler" : "jur_ajuda");
}

function jurTrocarModo(m) {
  jurModo = m;
  jurPintarModo();
  jurPintarLista();
  if (m === "incluir" && $("jurTese") && $("jurTese").focus) {
    $("jurTese").focus();
  }
}

function jurLimparForm() {
  ["jurColar", "jurTese", "jurTribunal", "jurClasse", "jurNumero",
   "jurData", "jurOrgao", "jurFonte"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  jurEditando = "";
  const av = $("jurColarAviso");
  if (av) { av.hidden = true; av.textContent = ""; }
  jurMeta(false);
  jurBotaoSalvar();
}

/* A SANFONA DOS SEIS CAMPOS.
 *
 * Eles são conferência, não digitação: quando "ler e preencher"
 * funciona — que é quase sempre — já vêm certos e ninguém os toca.
 * Abertos, ocupam metade da tela e empurram a tese, que é a única coisa
 * escrita à mão, para fora da dobra. */
function jurMeta(abrir) {
  const cx = $("jurMetaCampos");
  if (cx) cx.hidden = !abrir;
  const b = $("btnJurMeta");
  if (b) b.textContent = t(abrir ? "jur_meta_esconder" : "jur_meta_ver");
}

function jurMetaAberta() {
  return !!($("jurMetaCampos") && !$("jurMetaCampos").hidden);
}

function jurBotaoSalvar() {
  const b = $("btnJurSalvar");
  if (b) b.textContent = t(jurEditando ? "jur_salvar_edicao" : "jur_salvar");
}

/* ------------------------------------------------------------------
 * COLAR COM FORMATAÇÃO
 *
 * O bloco cru do sítio do tribunal entra numa caixa e sai nos campos.
 * O que o app reconheceu fica ESCRITO na tela antes de qualquer coisa
 * ser salva — extrair em silêncio e mostrar formulário preenchido faria
 * a pessoa confiar num palpite sem saber que houve palpite.
 * ------------------------------------------------------------------ */
function jurColar() {
  const bruto = String(($("jurColar") || {}).value || "");
  if (!bruto.trim()) { jurReagirBtn("btnJurColar", t("jur_colar_vazio")); return; }
  const a = jurIdentificar(bruto);
  const põe = (id, v) => { if ($(id) && v) $(id).value = v; };
  põe("jurTribunal", a.tribunal);
  põe("jurClasse", a.classe);
  põe("jurNumero", a.numero);
  põe("jurData", a.data);
  põe("jurOrgao", a.orgao);
  /* a tese só é sugerida quando o campo está vazio: quem já escreveu a
   * sua não pode perdê-la para um palpite */
  if ($("jurTese") && !$("jurTese").value.trim() && a.tese) {
    $("jurTese").value = a.tese;
  }

  /* A PÍLULA DIZ OS VALORES, NÃO OS NOMES DOS CAMPOS.
   *
   * "5 campos: tribunal, classe, número, data, órgão" informa que houve
   * leitura e nada sobre o que foi lido — para conferir era preciso
   * descer até os campos. "STF · RE 574706 · Pleno · 15/03/2017" se
   * confere de relance, que é o ponto de mostrar. */
  const achou = ["tribunal", "classe", "numero", "data", "orgao"]
    .filter((k) => a[k]);
  const pedacos = [];
  if (a.tribunal) pedacos.push(a.tribunal + (a.tribunalDeduzido ? "*" : ""));
  if (a.classe || a.numero) {
    pedacos.push([a.classe, a.numero].filter(Boolean).join(" "));
  }
  if (a.orgao) pedacos.push(a.orgao);
  if (a.data) pedacos.push(String(a.data).split("-").reverse().join("/"));
  const av = $("jurColarAviso");
  if (av) {
    av.hidden = false;
    av.className = "jur-pilula" + (achou.length ? " ok" : " aviso");
    av.textContent = achou.length
      ? t("jur_pilula", { c: pedacos.join(" · ") })
      : t("jur_pilula_nada");
  }
  /* NÃO RECONHECEU NADA: aí os campos precisam aparecer, porque não há
   * o que conferir — há o que preencher. Reconheceu: ficam fechados,
   * e a pílula acima já mostra o que há dentro. */
  jurMeta(!achou.length);
  reg("JURIS", "ementa colada",
      achou.length + " campos reconhecidos de " + bruto.length + " caracteres");
  jurReagirBtn("btnJurColar", t("jur_colou_btn", { n: achou.length }));
}

/* a mesma reação curta dos outros botões do app */
function jurReagirBtn(id, txt) {
  if (typeof vkReagir === "function") vkReagir($(id), txt);
}

async function jurSalvar() {
  if (!jurTopicoAtual) return;
  const v = (id) => String(($(id) || {}).value || "").trim();
  const tese = v("jurTese");
  const texto = v("jurColar");
  /* SEM TESE E SEM TEXTO não há o que guardar. Um julgado só com o
   * número é uma etiqueta que não se revisa. */
  if (!tese && !texto) { await uiAlert(t("jur_falta")); return; }

  const j = jurGravar({
    id: jurEditando || undefined,
    tribunal: v("jurTribunal"), classe: v("jurClasse"),
    numero: v("jurNumero"), data: v("jurData"), orgao: v("jurOrgao"),
    fonte: v("jurFonte"), tese, texto,
    topicos: jurEditando ? undefined : [jurTopicoAtual.chave],
  });
  if (!j) { await uiAlert(t("jur_nao_salvou")); return; }
  if (jurEditando) jurLigar(j.id, jurTopicoAtual.chave);

  reg("JURIS", jurEditando ? "julgado editado" : "julgado guardado",
      jurTitulo(j) + " · " + jurTopicoAtual.nome);
  jurLimparForm();
  /* GUARDOU, VOLTA PARA A LEITURA. É onde o resultado aparece — ficar no
   * formulário vazio depois de salvar não mostra que salvou. */
  jurModo = "ler";
  jurPintarModo();
  jurPintarLista();
  jurRepintarTelas();
  jurReagirBtn("btnJurSalvar", t("jur_salvou"));
}

/* Depois de guardar, a agenda e o material precisam mostrar o selo novo
 * — senão o julgado existe e não aparece em lugar nenhum até um F5. */
function jurRepintarTelas() {
  try { if (typeof edRender === "function") edRender(); } catch (e) {}
  try { if (typeof matRender === "function") matRender(); } catch (e) {}
  try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
}

function jurEditar(id) {
  const j = jurDe(id);
  if (!j) return;
  jurEditando = id;
  const põe = (idc, v) => { if ($(idc)) $(idc).value = v || ""; };
  põe("jurTribunal", j.tribunal); põe("jurClasse", j.classe);
  põe("jurNumero", j.numero); põe("jurData", j.data);
  põe("jurOrgao", j.orgao); põe("jurFonte", j.fonte);
  põe("jurTese", j.tese); põe("jurColar", j.texto);
  /* editar é incluir com os campos preenchidos: sem trocar de modo, o
   * formulário ficaria escondido e o clique não faria nada visível */
  jurModo = "incluir";
  jurPintarModo();
  /* editando à mão, os campos são o que se veio mexer */
  jurMeta(true);
  jurBotaoSalvar();
  if ($("jurTese") && $("jurTese").focus) $("jurTese").focus();
}

async function jurTirar(id) {
  if (!jurTopicoAtual) return;
  const j = jurDe(id);
  /* DESLIGAR NÃO É APAGAR, e a diferença precisa estar na pergunta: o
   * mesmo julgado costuma servir a meia dúzia de tópicos. */
  const outros = ((j && j.topicos) || []).length - 1;
  if (!(await uiConfirm(t(outros > 0 ? "jur_tirar_conf_varios"
                                     : "jur_tirar_conf"),
        { t: jurTitulo(j), n: outros }))) return;
  jurDesligar(id, jurTopicoAtual.chave);
  reg("JURIS", "julgado desligado do topico",
      jurTitulo(j) + " · " + jurTopicoAtual.nome);
  /* tirou o último: não há mais leitura, e a tela precisa acompanhar */
  if (!jurDoTopico(jurTopicoAtual.chave).length) jurModo = "incluir";
  jurPintarModo();
  jurPintarLista();
  jurRepintarTelas();
}

function jurPintarLista() {
  const box = $("jurLista");
  if (!box || !jurTopicoAtual) return;
  box.innerHTML = "";
  const lista = jurDoTopico(jurTopicoAtual.chave);
  const conta = $("jurConta");
  if (conta) {
    conta.textContent = lista.length
      ? t("jur_conta", { n: lista.length }) : t("jur_conta_zero");
  }
  if (!lista.length) return;

  lista.forEach((j) => {
    const li = document.createElement("div");
    li.className = "jur-item";

    const cab = document.createElement("div");
    cab.className = "jur-cab";

    /* ETIQUETAS, NÃO UMA FRASE.
     *
     * "STF ADI 2.405 19/12/2003" é uma linha de texto em que os três
     * dados têm o mesmo peso e nenhum se acha de relance. Separados, o
     * olho pula direto para a corte — que é como se procura julgado
     * numa lista de dez. */
    const sel = (txt, cls) => {
      const b = document.createElement("span");
      b.className = "jur-sel " + cls;
      b.textContent = txt;
      cab.append(b);
      return b;
    };
    if (j.tribunal) sel(j.tribunal, "trib");
    const proc = [j.classe, j.numero].filter(Boolean).join(" ");
    if (proc) sel(proc, "proc");
    if (j.data) {
      const d = document.createElement("span");
      d.className = "jur-data";
      d.textContent = String(j.data).split("-").reverse().join("/");
      cab.append(d);
    }
    if (j.orgao) {
      const o = document.createElement("span");
      o.className = "jur-orgao";
      o.textContent = j.orgao;
      cab.append(o);
    }

    /* AS AÇÕES NO CANTO, EM ÍCONES.
     *
     * Três botões escritos por extenho no rodapé de cada cartão custam
     * uma linha inteira por julgado — com cinco guardados, cinco linhas
     * de botão contra cinco de tese. Em ícone ocupam o canto que já
     * estava vazio. Cada um leva title e aria-label: ícone sozinho é
     * ilegível para quem não adivinha o desenho, e mudo para o leitor
     * de tela. */
    const acoes = document.createElement("div");
    acoes.className = "jur-acoes";
    const bt = (icone, rot, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "jur-ic" + (cls ? " " + cls : "");
      b.textContent = icone;
      b.title = rot;
      b.setAttribute("aria-label", rot);
      b.onclick = fn;
      acoes.append(b);
      return b;
    };
    bt("🃏", t("jur_card_dica"), "", () => jurGerarCartao(j.id));
    bt("✏️", t("jur_ed"), "", () => jurEditar(j.id));
    bt("📋", t("jur_cp"), "", async () => {
      const ok = await edColarCopiarTexto(jurTexto([j]), "", null);
      if (ok) toast("toast_copied");
    });
    bt("🗑️", t("jur_tr"), "jur-ic-perigo", () => jurTirar(j.id));
    cab.append(acoes);
    li.append(cab);

    /* A TESE COMO CITAÇÃO. É o que se revisa; a ementa é onde se
     * confere. Com a mesma tipografia, os dois viravam um bloco só de
     * texto e a tese se perdia dentro dele. */
    if (j.tese) {
      const p = document.createElement("blockquote");
      p.className = "jur-tese";
      p.textContent = j.tese;
      li.append(p);
    }

    /* EM QUANTOS TÓPICOS ELE ESTÁ. É o que impede o susto de "tirei
     * daqui e sumiu de lá também" — e mostra que a mesma tese está
     * fazendo trabalho em mais de um lugar. */
    const n = (j.topicos || []).length;
    if (n > 1) {
      const em = document.createElement("div");
      em.className = "jur-em";
      em.textContent = t("jur_em_varios", { n });
      li.append(em);
    }

    /* A EMENTA INTEIRA, sob demanda e só na leitura.
     *
     * A tese cabe em três linhas e é o que se revisa; a ementa tem
     * trinta e é o que se consulta quando a tese sozinha não basta.
     * Mostrar as duas sempre faria a lista de cinco julgados virar uma
     * rolagem de página inteira. No formulário ela já está na caixa de
     * colar, e repeti-la ali seria o mesmo texto duas vezes na tela. */
    if (jurModo === "ler" && j.texto && j.texto.trim() !== (j.tese || "").trim()) {
      const cheia = document.createElement("pre");
      cheia.className = "jur-ementa";
      cheia.textContent = j.texto;
      cheia.hidden = true;
      const bVer = document.createElement("button");
      bVer.type = "button";
      bVer.className = "btn-min jur-ementa-btn";
      bVer.textContent = t("jur_ver_ementa");
      /* o próprio botão, não o alvo do evento: o simulador dos testes
       * chama onclick sem evento, e "ev.target" seria undefined lá */
      bVer.onclick = () => {
        cheia.hidden = !cheia.hidden;
        bVer.textContent = t(cheia.hidden ? "jur_ver_ementa"
                                          : "jur_esconder_ementa");
      };
      li.append(bVer, cheia);
    }

    box.append(li);
  });
}

/* ------------------------------------------------------------------
 * DO JULGADO PARA O CARTÃO
 *
 * Guardar a tese é metade do trabalho; a outra metade é reencontrá-la
 * na semana que vem sem abrir esta gaveta. O cartão nasce da TESE, não
 * da ementa: um verso de trinta linhas não se responde, e cartão que
 * não se responde não se revisa.
 *
 * NÃO É CLOZE. O formato do app é "frente :: verso :: etiquetas", com
 * dois lados; a omissão de trecho do Anki ({{c1::…}}) atravessaria o
 * separador e chegaria mutilada na tela de estudo. Pergunta direta é o
 * que este app sabe guardar inteiro.
 *
 * E NÃO GRAVA SOZINHO: mostra frente e verso e pergunta. Um cartão
 * gerado sem confirmação vira lixo que só aparece na revisão, quando
 * já não se sabe de onde veio.
 * ------------------------------------------------------------------ */
function jurCartaoDe(j, topico) {
  if (!j || !String(j.tese || "").trim()) return null;
  const quem = [j.tribunal, [j.classe, j.numero].filter(Boolean).join(" ")]
    .filter(Boolean).join(" ");
  const frente = t("jur_card_frente", {
    q: quem ? "do " + quem : "do tribunal", tp: topico });
  return { frente, verso: String(j.tese).trim() };
}

async function jurGerarCartao(id) {
  const j = jurDe(id);
  if (!jurTopicoAtual || !j) return;
  const c = jurCartaoDe(j, jurTopicoAtual.nome);
  if (!c) { await uiAlert(t("jur_card_sem_tese")); return; }

  const ch = jurTopicoAtual.chave;
  const atual = String(((typeof matResumos !== "undefined" && matResumos[ch])
    || {}).cartoes || "");
  /* IDEMPOTENTE, como o resto do app: gerar duas vezes o mesmo julgado
   * não cria dois cartões iguais. A comparação é pela FRENTE, que é o
   * que identifica a pergunta. */
  const jaTem = atual.split("\n").some((l) =>
    l.split("::")[0].trim().toLowerCase() === c.frente.trim().toLowerCase());
  if (jaTem) { await uiAlert(t("jur_card_repetido")); return; }

  if (!(await uiConfirm(t("jur_card_conf",
      { tp: jurTopicoAtual.nome, f: c.frente, v: c.verso })))) return;

  const tags = [jurTopicoAtual.disciplina, jurTopicoAtual.nome, "jurisprudencia"]
    .concat(j.tribunal ? [j.tribunal] : [])
    .map((x) => String(x).replace(/::/g, "_").replace(/\s+/g, "_"))
    .filter(Boolean);
  const linha = c.frente.replace(/\s*::\s*/g, " — ") + " :: "
    + c.verso.replace(/\s*::\s*/g, " — ").replace(/\r?\n+/g, " ")
    + " :: " + tags.join(" ");
  matGravarCartoes(ch, (atual.trim() ? atual.replace(/\s*$/, "") + "\n" : "") + linha,
    { disciplina: jurTopicoAtual.disciplina, topico: jurTopicoAtual.nome });

  reg("JURIS", "cartão gerado do julgado",
      jurTitulo(j) + " › " + jurTopicoAtual.nome);
  jurRepintarTelas();
  jurPintarLista();
  toast("jur_card_feito");
}

/* ------------------------------------------------------------------
 * DO RESUMO, COM O TEXTO SELECIONADO
 *
 * O gesto principal: lendo o resumo, você encontra a frase que o
 * tribunal decidiu, seleciona e guarda como tese. Sem isso, guardar
 * jurisprudência exigiria sair da leitura, abrir outra tela e redigitar
 * — e ninguém faz isso no meio de um estudo.
 * ------------------------------------------------------------------ */
function jurDaSelecao() {
  if (typeof matLembrarSelecao === "function") matLembrarSelecao("matLeitura");
  /* O TÓPICO É O QUE ESTÁ ABERTO NO EDITOR, e a seleção é a que o
   * material acabou de guardar. Os dois já existem — reimplementá-los
   * aqui criaria uma segunda leitura da mesma coisa, que é como as
   * divergências nascem. */
  const trecho = (typeof matSelGuardadaAtual === "function")
    ? matSelGuardadaAtual() : "";
  const alvo = (typeof matAtualAtual === "function") ? matAtualAtual() : null;
  if (!alvo || !alvo.disciplina) { uiAlert(t("jur_sem_topico")); return; }
  jurAbrir(alvo.disciplina, alvo.topico || alvo.nome, "incluir");
  if (trecho && $("jurTese")) {
    $("jurTese").value = trecho;
    const av = $("jurColarAviso");
    if (av) {
      av.hidden = false;
      av.className = "ed-mud";
      av.textContent = t("jur_da_selecao", { n: trecho.length });
    }
  }
}

function jurIniciarTela() {
  const liga = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  liga("btnJurColar", jurColar);
  liga("btnJurSalvar", jurSalvar);
  liga("btnJurLimpar", () => {
    jurLimparForm();
    jurReagirBtn("btnJurLimpar", t("jur_limpou"));
  });
  liga("btnJurMais", () => jurTrocarModo("incluir"));
  liga("btnJurMeta", () => jurMeta(!jurMetaAberta()));
  dicaLigar("btnJurAjuda", "jur_ajuda");
  liga("btnJurVoltarLer", () => jurTrocarModo("ler"));
  liga("btnJurFechar", () => $("dlgJuris").close());
  liga("btnJurFecharTopo", () => $("dlgJuris").close());
  liga("btnMatJuris", jurDaSelecao);
}
