/* FORA DA AGENDA — adiar e dispensar, e os filtros da semana.
 *
 * O que precisa valer: adiado volta sozinho e continua devendo;
 * dispensado sai do que falta e aparece em cor própria; o filtro
 * esconde sem reordenar; e o número de horas da agenda diz de quantos
 * editais está falando. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const item = (api, disc, nome, min) => ({
    disciplina: disc, nome, chave: api.matChave(disc, nome), minutos: min || 60,
  });

  /* ---- F1: o motivo decide o tipo ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const i1 = item(api, "Direito Financeiro", "Restos a pagar", 90);

    api.faAbrir(i1);
    ok(api.$("dlgForaAgenda").open === true, "F1 a janela de tirar da agenda nao abriu");
    ok(/Restos a pagar/.test(api.$("faAlvo").textContent || ""),
       "F1b a janela nao diz QUAL topico vai sair");

    const porOra = api.$("faTempo").querySelectorAll("button");
    const deVez = api.$("faVez").querySelectorAll("button");
    ok(porOra.length >= 2, `F1c faltam motivos de tempo (${porOra.length})`);
    ok(deVez.length >= 2, `F1d faltam motivos de cobertura (${deVez.length})`);
    ok(porOra.map((b) => b.textContent).join(" ").indexOf("dias") >= 0,
       "F1e os motivos de tempo nao dizem quando o topico volta");
    ok(deVez.map((b) => b.textContent).join(" ").indexOf("outro edital") >= 0,
       "F1f 'ja estudei para outro edital' ficou de fora dos motivos");

    porOra[0].onclick();
    api.uiModalResponder(true);
    const r = api.faDe(i1.chave);
    ok(!!r, "F1g o topico nao foi tirado da agenda");
    ok(r && r.tipo === "adiado",
       "F1h motivo de TEMPO devia adiar, virou: " + (r && r.tipo));
    ok(!!(r && r.ate), "F1i adiado sem data de volta — nunca voltaria sozinho");
    ok(api.faMinutosDispensados() === 0,
       "F1j adiar tirou horas do que falta estudar — adiado continua devendo");

    api.faVoltar(i1.chave);
    api.faAbrir(i1);
    api.$("faVez").querySelectorAll("button")[0].onclick();
    api.uiModalResponder(true);
    const r2 = api.faDe(i1.chave);
    ok(r2 && r2.tipo === "dispensado",
       "F1k motivo de COBERTURA devia dispensar, virou: " + (r2 && r2.tipo));
    ok(!(r2 && r2.ate), "F1l dispensado ganhou prazo de volta");
    ok(api.faMinutosDispensados() === 90,
       "F1m as horas dispensadas nao sairam da conta: " + api.faMinutosDispensados());
  }

  /* ---- F2: adiado volta sozinho quando o prazo vence ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const i2 = item(api, "D", "T", 60);
    api.faAbrir(i2);
    api.$("faTempo").querySelectorAll("button")[0].onclick();
    api.uiModalResponder(true);
    ok(api.faEstaFora(i2.chave) === true, "F2 nao adiou");

    /* mexe no prazo para ontem, como o tempo faria */
    const tudo = JSON.parse(api.loja.getItem(api.FA_CHAVE) || "{}");
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    tudo[i2.chave].ate = ontem.getFullYear() + "-"
      + String(ontem.getMonth() + 1).padStart(2, "0") + "-"
      + String(ontem.getDate()).padStart(2, "0");
    api.loja.setItem(api.FA_CHAVE, JSON.stringify(tudo));

    ok(api.faEstaFora(i2.chave) === false,
       "F2b prazo vencido e o topico continua fora — adiamento virou exilio");
    ok(api.faAdiados().length === 0,
       "F2c adiamento vencido ainda aparece na lista de adiados");

    /* dispensado NAO vence: fica ate alguem trazer de volta */
    const i3 = item(api, "D", "Outro", 45);
    api.faAbrir(i3);
    api.$("faVez").querySelectorAll("button")[0].onclick();
    api.uiModalResponder(true);
    const t2 = JSON.parse(api.loja.getItem(api.FA_CHAVE) || "{}");
    t2[i3.chave].q = "2020-01-01T00:00:00.000Z";
    api.loja.setItem(api.FA_CHAVE, JSON.stringify(t2));
    ok(api.faEstaFora(i3.chave) === true,
       "F2d o dispensado voltou sozinho com o tempo — dispensa nao tem prazo");
  }

  /* ---- F3: a lista mostra os dois, com o motivo, e devolve ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const a1 = item(api, "D", "Adiado", 30);
    const d1 = item(api, "D", "Dispensado", 120);
    api.faAbrir(a1); api.$("faTempo").querySelectorAll("button")[0].onclick();
    api.uiModalResponder(true);
    api.faAbrir(d1); api.$("faVez").querySelectorAll("button")[0].onclick();
    api.uiModalResponder(true);

    api.faListaAbrir();
    ok(api.$("dlgForaLista").open === true, "F3 a lista de fora da agenda nao abriu");
    const itens = api.$("faListaCx").querySelectorAll(".duv-item");
    ok(itens.length === 2, `F3b a lista devia ter 2, tem ${itens.length}`);
    const txt = itens.map((x) => x.textContent).join(" | ");
    ok(/prioridade|semana cheia|outro concurso/.test(txt),
       "F3c a lista nao mostra o motivo de cada um: " + txt.slice(0, 80));
    ok(/volta em/.test(txt), "F3d o adiado nao mostra quando volta");
    ok(/dispensado/.test(txt), "F3e o dispensado nao se identifica como tal");
    ok(/2h/.test(api.$("faListaResumo").textContent || ""),
       "F3f o resumo nao soma as horas que sairam da conta: "
       + api.$("faListaResumo").textContent);

    const bVolta = itens[0].querySelectorAll("button")
      .filter((b) => /volta/i.test(b.textContent))[0];
    ok(!!bVolta, "F3g falta o botao de trazer de volta");
    if (bVolta) {
      bVolta.onclick();
      ok(api.$("faListaCx").querySelectorAll(".duv-item").length === 1,
         "F3h trazer de volta nao tirou o item da lista");
    }
  }

  /* ---- F4: o filtro de disciplina esconde sem reordenar ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const discs = ["Direito Financeiro", "Controle Externo", "Estatística"];
    const fechado = api.hubFiltroDisciplina(discs);
    ok(!!fechado, "F4 o filtro de disciplina nao foi montado");
    /* FECHADO POR PADRAO: dezessete disciplinas viravam dezessete
     * pilhas empilhadas, mais altas que a propria agenda. */
    ok(fechado.querySelectorAll(".ed-ag-disc-b").length === 0,
       "F4a1 o filtro abriu escancarado — fechado ele tem de ocupar uma linha so");
    const cab = fechado.querySelectorAll(".ed-disc-cabeca")[0];
    ok(!!cab, "F4a2 falta a linha que abre o filtro");
    ok(/3/.test(cab.textContent || ""),
       "F4a3 a linha fechada nao diz quantas estao em vista: " + cab.textContent);
    cab.onclick();

    const filtro = api.hubFiltroDisciplina(discs);
    /* SÓ os botões de disciplina: contar "todo botão do filtro" pegava
     * junto o "desmarcar todas" e o "mostrar todas". */
    const bts = filtro.querySelectorAll(".ed-ag-disc-b");
    ok(bts.length === 3, `F4b deviam aparecer 3 disciplinas, apareceram ${bts.length}`);
    ok(bts.every((b) => /ativa/.test(b.className || "")),
       "F4c nem todas as disciplinas comecam visiveis");
    /* sem disciplina na lista nao ha o que medir adiante, e seguir daqui
     * estoura com pilha de erro — que nao diz O QUE quebrou */
    if (!bts.length) { falhas.quantas = n; return falhas; }

    bts[0].onclick();
    ok(api.hubDiscOcultas().indexOf("Direito Financeiro") >= 0,
       "F4d clicar guardou a escolha? nao: " + JSON.stringify(api.hubDiscOcultas()));
    /* GUARDAR A ESCOLHA NAO E FILTRAR. A primeira versao deste teste
     * olhava so a gaveta, e por isso passava mesmo com o filtro
     * desligado — descobri sabotando. O que importa e quem SOBRA. */
    const sobram = api.hubDiscEscolhidas(discs);
    ok(sobram.indexOf("Direito Financeiro") < 0,
       "F4d2 a disciplina escondida continua na lista que vai para a tela: "
       + JSON.stringify(sobram));
    ok(sobram.length === 2,
       `F4d3 deviam sobrar 2 disciplinas, sobraram ${sobram.length}`);

    /* DESMARCAR TODAS de uma vez: quem quer ver uma disciplina de
     * dezessete nao vai clicar em dezesseis. Esconder tudo passa a ser
     * um estado legitimo — a agenda diz que esta vazia por escolha em
     * vez de se desfazer sozinha e devolver as dezessete. */
    const bNenhuma = api.hubFiltroDisciplina(discs).querySelectorAll("button")
      .filter((b) => /desmarcar/i.test(b.textContent))[0];
    ok(!!bNenhuma, "F4d4 falta o botao de desmarcar todas as disciplinas");
    if (bNenhuma) bNenhuma.onclick();
    ok(api.hubDiscEscolhidas(discs).length === 0,
       "F4d4b desmarcar todas nao escondeu todas");
    ok(api.hubDiscTudoOculto(discs) === true,
       "F4d4c o app nao sabe que estou com tudo escondido — sem isso a "
       + "agenda vazia nao teria como se explicar");

    /* e marcar UMA volta a mostrar so ela */
    const umaSo = api.hubFiltroDisciplina(discs).querySelectorAll(".ed-ag-disc-b")
      .filter((b) => b.textContent === "Controle Externo")[0];
    if (umaSo) umaSo.onclick();
    const so = api.hubDiscEscolhidas(discs);
    ok(so.length === 1 && so[0] === "Controle Externo",
       "F4d4d depois de desmarcar todas, marcar uma devia mostrar so ela: "
       + JSON.stringify(so));

    /* BUSCA: com dezessete nomes, tres letras acham mais rapido que o olho */
    const cxB = api.hubFiltroDisciplina(discs);
    const campo = cxB.querySelectorAll(".ed-disc-busca")[0];
    ok(!!campo, "F4d4e falta a busca dentro do filtro aberto");
    if (campo) {
      campo.value = "contr";
      campo.oninput();
      const filtrados = api.hubFiltroDisciplina(discs)
        .querySelectorAll(".ed-ag-disc-b").map((b) => b.textContent);
      ok(filtrados.length === 1 && filtrados[0] === "Controle Externo",
         "F4d4f a busca nao reduziu a lista: " + JSON.stringify(filtrados));
      /* busca sem acento acha nome COM acento: ninguem digita "Estatística"
       * com o acento no meio de uma busca rapida */
      campo.value = "estatis";
      campo.oninput();
      const semAcento = api.hubFiltroDisciplina(discs)
        .querySelectorAll(".ed-ag-disc-b").map((b) => b.textContent);
      ok(semAcento.length === 1,
         "F4d4g a busca sem acento nao achou o nome acentuado: "
         + JSON.stringify(semAcento));
      campo.value = "";
      campo.oninput();
    }

    const limpar = api.hubFiltroDisciplina(discs).querySelectorAll("button")
      .filter((b) => /mostrar todas/i.test(b.textContent))[0];
    ok(!!limpar, "F4d5 com disciplinas escondidas falta a saida 'mostrar todas'");
    if (limpar) {
      limpar.onclick();
      ok(api.hubDiscOcultas().length === 0, "F4d6 'mostrar todas' nao desfez o filtro");
    }
    /* disciplina NOVA entra visivel: guardar o que foi escondido, e nao o
     * que foi escolhido, e o que garante isso */
    const comNova = api.hubFiltroDisciplina(discs.concat(["Auditoria"]));
    const nova = comNova.querySelectorAll("button")
      .filter((b) => b.textContent === "Auditoria")[0];
    ok(!!nova && /ativa/.test(nova.className || ""),
       "F4e disciplina que entrou depois nasceu escondida");

    /* com uma so disciplina o filtro nao aparece: seria um botao que nao
     * muda nada */
    ok(api.hubFiltroDisciplina(["Uma so"]) === null,
       "F4f o filtro apareceu com uma disciplina so");
  }

  /* ---- F5: as horas da agenda dizem de quantos editais falam ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const vista = api.hubEditaisNaVista();
    ok(Array.isArray(vista),
       "F5 nao ha um lugar unico dizendo quais editais estao na vista — "
       + "foi assim que 40 e 44 apareceram na mesma tela sem explicacao");
  }

  /* ---- F6: adiar ao lado de registrar, e a cor com legenda ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const li = api.edLinhaAgendaTeste({ disciplina: "Direito Financeiro",
      nome: "Restos a pagar", chave: api.matChave("Direito Financeiro", "Restos a pagar"),
      faixa: "alta", disciplinaPeso: 5, peso: 5, minutos: 60 });

    const ordem = [];
    let ponto = null;
    const anda = (x) => (x.children || []).forEach((f) => {
      const c = (f.className || "").split(/\s+/);
      ["ed-reg", "ed-fora", "ed-ponto"].forEach((k) => {
        if (c.includes(k)) ordem.push(k);
      });
      if (c.includes("ed-ponto")) ponto = f;
      anda(f);
    });
    anda(li);
    ok(ordem.indexOf("ed-reg") === 0,
       "F6 o botao de registrar estudo saiu do comeco da linha: " + ordem.join(","));
    ok(ordem.indexOf("ed-fora") === 1,
       "F6b 'tirar da agenda' devia vir logo depois do registrar — as duas "
       + "respostas para o mesmo item ficam juntas. Ordem: " + ordem.join(","));

    ok(!!ponto, "F6c sumiu o marcador colorido da linha");
    const dica = (ponto && ponto.title) || "";
    ok(dica.length > 0,
       "F6d o marcador colorido nao explica a cor ao passar o mouse — "
       + "cor sem legenda e enfeite");
    ok(/prioridade/i.test(dica),
       "F6e a legenda nao diz que a cor e prioridade: " + dica);
    ok(/5/.test(dica) && /25/.test(dica),
       "F6f a legenda nao mostra a conta que gerou a ordem (5 x 5 = 25): " + dica);

    /* sem plano, a legenda diz isso em vez de inventar prioridade */
    const li2 = api.edLinhaAgendaTeste({ disciplina: "D", nome: "Avulso",
      chave: api.matChave("D", "Avulso"), minutos: 30 });
    let p2 = null;
    const anda2 = (x) => (x.children || []).forEach((f) => {
      if ((f.className || "").split(/\s+/).includes("ed-ponto")) p2 = f;
      anda2(f);
    });
    anda2(li2);
    ok(!!p2 && !/undefined/.test(p2.title || ""),
       "F6g a legenda da cor mostrou 'undefined' para topico fora do plano: "
       + (p2 && p2.title));
  }

  /* ---- F7: o prompt da disciplina, copiar e colar de volta ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.ndAbrir();
    ok(api.$("ndPromptCx").hidden === true,
       "F7 o prompt da disciplina nasceu aberto, ocupando a janela toda");
    api.$("btnNdPrompt").onclick();
    ok(api.$("ndPromptCx").hidden === false, "F7b o botao nao abriu o prompt");
    ok(!/nd_prompt/.test(api.$("btnNdPrompt").textContent || ""),
       "F7c o rotulo do botao ficou com a CHAVE de traducao a mostra: "
       + api.$("btnNdPrompt").textContent);

    api.$("ndNome").value = "Direito Tributario";
    api.$("btnNdCopiar").onclick();
    const pr = api.$("ndPrompt").value || "";
    ok(/DISCIPLINA:/.test(pr) && /PESO:/.test(pr),
       "F7d o prompt nao ensina o formato que o app sabe ler");
    ok(/Direito Tributario/.test(pr),
       "F7e o prompt nao cita a disciplina que estou criando");
    ok(!/\{disc\}|\{concurso\}/.test(pr),
       "F7f sobrou marcador de substituicao no prompt: " + pr.slice(0, 60));

    /* colar de volta preenche os CAMPOS, nao o edital */
    const antes = String(api.$("editalTexto").value || "");
    api.$("ndColar").value = [
      "DISCIPLINA: Direito Tributario",
      "PESO: 4",
      "TOPICOS:",
      "Sistema Tributario Nacional :: 5 :: caiu na ultima prova",
      "- Especies tributarias :: 4 :: cobrado constantemente",
    ].join("\n");
    api.$("btnNdAplicarIA").onclick();
    api.uiModalResponder(true);

    ok(api.$("ndNome").value === "Direito Tributario",
       "F7g o nome nao foi preenchido: " + api.$("ndNome").value);
    const tops = String(api.$("ndTopicos").value || "").split("\n").filter(Boolean);
    ok(tops.length === 2, `F7h deviam entrar 2 topicos, entraram ${tops.length}`);
    ok(!/^-/.test(tops[1] || ""),
       "F7i o marcador de lista da IA entrou junto com o topico: " + tops[1]);
    ok(String(api.$("editalTexto").value || "") === antes,
       "F7j a resposta da IA entrou direto no edital — devia so preencher os "
       + "campos e esperar o Incluir");

    /* colagem vazia nao apaga o que ja estava */
    api.$("ndColar").value = "";
    api.$("btnNdAplicarIA").onclick();
    api.uiModalResponder(true);
    ok(api.$("ndNome").value === "Direito Tributario",
       "F7k colar vazio apagou os campos que ja estavam preenchidos");
  }

  /* ---- F8: a linha da agenda tem poucos alvos, e com palavras ----
   * Eram seis por linha, quatro deles icones. Dez linhas na semana =
   * sessenta alvos, nenhum legivel para quem chega. */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    const disc = "Direito Financeiro", top = "Restos a pagar";
    const ch = api.matChave(disc, top);
    api.matGravar(ch, "Resumo do topico.", { disciplina: disc, topico: top });
    api.matGravarCartoes(ch, "P :: R", { disciplina: disc, topico: top });

    const li = api.edLinhaAgendaTeste({ disciplina: disc, nome: top, chave: ch,
      faixa: "alta", disciplinaPeso: 5, peso: 5, minutos: 60 });
    /* conta so os ALVOS DE ACAO, nao o nome da disciplina — que e texto
     * clicavel dentro do bloco de texto, e nao um botao competindo por
     * espaco na faixa de acoes */
    const botoes = [];
    const anda = (x, dentroDoTexto) => (x.children || []).forEach((f) => {
      const noTexto = dentroDoTexto || /ed-item-meio/.test(f.className || "");
      if (f.tag === "button" && !noTexto) botoes.push(f.textContent);
      anda(f, noTexto);
    });
    anda(li, false);
    ok(botoes.length <= 5,
       `F8 a linha voltou a ter ${botoes.length} alvos: ${JSON.stringify(botoes)}`);
    ok(botoes.some((b) => /estudar|come\u00e7ar/i.test(b)),
       "F8b falta o botao primario de estudar: " + JSON.stringify(botoes));
    ok(botoes.indexOf("\u22ee") >= 0, "F8c falta o menu ⋮");
    ok(!botoes.some((b) => b === "\ud83d\udcc4" || b === "\ud83c\udccf" || b === "\u2696"),
       "F8d os icones enigmaticos voltaram para a linha: " + JSON.stringify(botoes));

    /* mas o STATUS continua na linha, em palavras: varrer a semana e ver
     * o que ja tem resumo era util e nao podia ir para dentro do menu */
    const etiquetas = [];
    const anda2 = (x) => (x.children || []).forEach((f) => {
      if (/ed-st-item/.test(f.className || "")) etiquetas.push(f.textContent);
      anda2(f);
    });
    anda2(li);
    ok(etiquetas.some((e) => /resumo/i.test(e)),
       "F8e a linha nao diz mais que o topico tem resumo: " + JSON.stringify(etiquetas));
    ok(etiquetas.some((e) => /cart/i.test(e)),
       "F8f a linha nao diz que o topico tem cartoes");
    ok(!etiquetas.some((e) => /quest/i.test(e)),
       "F8g apareceu etiqueta de questoes num topico que nao tem nenhuma");

    /* e o menu leva aos mesmos lugares, por extenso */
    let mais = null;
    const anda3 = (x) => (x.children || []).forEach((f) => {
      if (/ed-mais/.test(f.className || "") && !mais) mais = f;
      anda3(f);
    });
    anda3(li);
    if (mais) mais.onclick({ stopPropagation() {} });
    const itens = [];
    const anda4 = (x) => (x.children || []).forEach((f) => {
      if (/ed-menu-item/.test(f.className || "")) itens.push(f.textContent);
      anda4(f);
    });
    anda4(li);
    ok(itens.length === 4, `F8h o menu devia ter 4 destinos, tem ${itens.length}`);
    ok(itens.every((x) => /[a-z]{4}/i.test(x)),
       "F8i ha item de menu sem palavra: " + JSON.stringify(itens));
    ok(!itens.some((x) => /ver os 1 /.test(x)),
       "F8j 'ver os 1 cartoes' — falta o singular: " + JSON.stringify(itens));
  }

  /* ---- F9: o card da disciplina responde "e agora?" ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const itens = [
      { disciplina: "D", nome: "Feito", chave: api.matChave("D", "Feito"),
        bruto: 9, feito: true, minutos: 60 },
      { disciplina: "D", nome: "Pesado", chave: api.matChave("D", "Pesado"),
        bruto: 25, feito: false, minutos: 60 },
      { disciplina: "D", nome: "Leve", chave: api.matChave("D", "Leve"),
        bruto: 4, feito: false, minutos: 60 },
    ];
    const prox = api.edProximoDa(itens);
    ok(prox && prox.nome === "Pesado",
       "F9 o proximo devia ser o de maior peso ainda nao feito, veio: "
       + (prox && prox.nome));

    /* topico tirado da agenda nao pode ser o "proximo": ele nao esta
     * disponivel, e recomendar o que a pessoa acabou de adiar e ignora-la */
    api.faTirar(itens[1], "sem_prioridade");
    const prox2 = api.edProximoDa(itens);
    ok(prox2 && prox2.nome === "Leve",
       "F9b o adiado foi recomendado como proximo passo: " + (prox2 && prox2.nome));

    /* tudo feito: devolve nulo, e o card diz isso em vez de inventar */
    ok(api.edProximoDa(itens.map((i) => ({ ...i, feito: true }))) === null,
       "F9c com tudo estudado ainda apareceu um 'proximo'");
    ok(api.edProximoDa([]) === null, "F9d disciplina vazia devolveu um proximo");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "fora-da-agenda", 60000).then((f) => {
    f.forEach((m) => console.log("  FALHA  " + m));
    console.log(f.length ? `\nfora-da-agenda: ${f.length} FALHA(S)\n`
      : `\nfora-da-agenda: adiar, dispensar e filtrar ok (${f.quantas} verificacoes)\n`);
    process.exit(f.length ? 1 : 0);
  });
}
