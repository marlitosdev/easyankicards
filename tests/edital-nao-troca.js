/* UM EDITAL NÃO PODE SER GRAVADO POR CIMA DE OUTRO
 *
 * O CASO REAL, achado comparando dois backups do mesmo dia. Às 20:47 a
 * lista tinha três editais; às 22:58 o "TCE-PE Auditor de Controle
 * Externo" — 17 disciplinas, 232 tópicos, 6 tópicos marcados — estava
 * com o NOME, o TEXTO e o PROGRESSO do "ISS Caruaru Auditor Fiscal".
 * Mesmo id, mesma data de criação, conteúdo do outro. A lista mostrava
 * dois "ISS Caruaru".
 *
 * COMO: duas funções gravam o conteúdo da bancada dentro do edital
 * aberto — edSalvar e hubGravarAberto. Nenhuma conferia se o texto que
 * está na bancada é DAQUELE edital: elas assumiam o par. Basta o
 * "aberto" apontar para um e a bancada estar com o texto de outro para
 * a gravação seguinte escrever um por cima do outro — e ainda renomear
 * o destino, porque o nome segue o cabeçalho do texto.
 *
 * A REGRA: gravar pode mudar o CONTEÚDO de um edital; não pode mudar de
 * QUAL edital ele é. */
const { rodar } = require("./fumaca.js");

/* comparacao LITERAL, so para a pre-condicao do E7 */
const edIguais = (x, y) => String(x) === String(y);

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const TCE = "# TCE-PE Auditor de Controle Externo | horas: 20\n"
    + "@ Direito Financeiro :: 5\n+ Leis Orçamentárias :: 5 :: pq\n"
    + "+ Restos a pagar :: 4 :: pq";
  const ISS = "# ISS Caruaru Auditor Fiscal | horas: 20\n"
    + "@ Sistema Tributário Brasileiro :: 5\n+ Crédito tributário :: 5 :: pq";

  const montar = (api) => {
    api.edIniciar();
    const tce = api.edCriar("TCE-PE Auditor de Controle Externo", TCE);
    const iss = api.edCriar("ISS Caruaru Auditor Fiscal", ISS);
    return { tce, iss };
  };

  /* ================================================================
   * E1: A BANCADA COM O TEXTO DE OUTRO NÃO GRAVA
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce, iss } = montar(api);
    api.hubAbrirEdital(tce.id);

    /* O ESTADO QUE CAUSOU O ESTRAGO: o aberto é o TCE, e a bancada está
     * com o plano do ISS. Acontece quando a página abre com a cópia de
     * trabalho antiga, ou quando algum caminho troca o aberto sem
     * recarregar o texto. */
    api.$("editalTexto").value = ISS;
    api.edSalvar();

    const dep = api.editaisLista().filter((x) => x.id === tce.id)[0];
    ok(dep, "E1-pre o edital do cenario sumiu da lista");
    ok(/TCE-PE/.test(dep.nome || ""),
       "E1 o TCE-PE foi RENOMEADO pelo cabecalho do outro plano: "
       + dep.nome);
    ok(/Leis Orçamentárias/.test(dep.texto || ""),
       "E1a o texto do TCE-PE foi substituido pelo do ISS: "
       + String(dep.texto).slice(0, 60));
    ok(!/Crédito tributário/.test(dep.texto || ""),
       "E1b o plano do ISS entrou dentro do TCE-PE");

    /* E NÃO SOBRAM DOIS COM O MESMO NOME — foi assim que o defeito
     * apareceu na tela. */
    const nomes = api.editaisLista().map((x) => x.nome);
    ok(new Set(nomes).size === nomes.length,
       "E1c a lista ficou com dois editais de mesmo nome: "
       + JSON.stringify(nomes));

    /* O ISS, que era o dono do texto, continua inteiro. */
    const outro = api.editaisLista().filter((x) => x.id === iss.id)[0];
    ok(/Crédito tributário/.test(outro.texto || ""),
       "E1d a recusa mexeu no edital errado");
  }

  /* ---- E2: a recusa não é silêncio ---- */
  {
    const { api } = rodar();
    const { tce } = montar(api);
    api.hubAbrirEdital(tce.id);
    api.$("editalTexto").value = ISS;
    api.edSalvar();
    /* Não gravar sem dizer nada é o outro jeito de perder trabalho:
     * quem digitou fica achando que salvou. */
    const L = api.registroTexto ? api.registroTexto() : "";
    ok(/recusad/i.test(L),
       "E2 a gravacao foi recusada sem deixar registro");
    ok(/TCE-PE/.test(L) && /ISS/.test(L),
       "E2a o registro nao diz quais dois editais estavam envolvidos");
  }

  /* ================================================================
   * E3: O QUE CONTINUA FUNCIONANDO
   *
   * Uma trava que impede o uso normal é pior que o defeito. Editar o
   * plano do edital aberto é o gesto mais comum da bancada.
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce } = montar(api);
    api.hubAbrirEdital(tce.id);

    /* EDITAR O PRÓPRIO PLANO: grava. */
    api.$("editalTexto").value = TCE + "\n+ Precatórios :: 3 :: pq";
    api.edSalvar();
    const dep = api.editaisLista().filter((x) => x.id === tce.id)[0];
    ok(/Precatórios/.test(dep.texto || ""),
       "E3 a trava impediu editar o plano do proprio edital aberto");

    /* RENOMEAR PELO CABEÇALHO, no próprio edital, continua valendo. */
    api.$("editalTexto").value = TCE.replace("TCE-PE Auditor de Controle Externo",
      "TCE-PE Auditor 2027");
    api.edSalvar();
    const dep2 = api.editaisLista().filter((x) => x.id === tce.id)[0];
    ok(/2027/.test(dep2.nome || ""),
       "E3a mudar o cabecalho do proprio edital deixou de renomea-lo: "
       + dep2.nome);
  }

  /* ---- E3b: edital vazio recebendo um plano colado ---- */
  {
    const { api } = rodar();
    api.edIniciar();
    /* É o fluxo de cadastro: cria vazio, cola o plano, o cabeçalho dá o
     * nome. Recusar aqui quebraria o caminho mais comum de todos. */
    const novo = api.edCriar("Novo edital", "");
    api.hubAbrirEdital(novo.id);
    api.$("editalTexto").value = ISS;
    api.edSalvar();
    const dep = api.editaisLista().filter((x) => x.id === novo.id)[0];
    ok(/ISS Caruaru/.test(dep.nome || ""),
       "E3b colar um plano num edital vazio deixou de nomea-lo: " + dep.nome);
    ok(/Crédito tributário/.test(dep.texto || ""),
       "E3c o plano colado num edital vazio nao foi gravado");
  }

  /* ================================================================
   * E4: TROCAR DE EDITAL NÃO CARREGA O TEXTO ERRADO PARA O OUTRO
   *
   * hubGravarAberto roda ANTES da troca — exatamente quando a bancada e
   * o aberto têm mais chance de não combinarem.
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce, iss } = montar(api);
    api.hubAbrirEdital(tce.id);
    api.$("editalTexto").value = ISS;      /* bancada desencontrada */
    api.hubAbrirEdital(iss.id);            /* e agora troca de edital */

    const dep = api.editaisLista().filter((x) => x.id === tce.id)[0];
    ok(/Leis Orçamentárias/.test(dep.texto || ""),
       "E4 trocar de edital gravou o texto errado no que estava aberto: "
       + String(dep.texto).slice(0, 60));
    ok(/TCE-PE/.test(dep.nome || ""),
       "E4a trocar de edital renomeou o anterior: " + dep.nome);
  }

  /* ---- E5: o dono da bancada é marcado ao abrir ---- */
  {
    const { api } = rodar();
    const { tce, iss } = montar(api);
    api.hubAbrirEdital(tce.id);
    ok(api.edDonoDoTexto() === String(tce.id),
       "E5 abrir um edital nao marcou a bancada como sendo dele: "
       + api.edDonoDoTexto());
    api.hubAbrirEdital(iss.id);
    ok(api.edDonoDoTexto() === String(iss.id),
       "E5a trocar de edital nao trocou o dono da bancada");

    /* COM DONO MARCADO, o teste não depende do cabeçalho: mesmo um
     * texto sem "#" nenhum é recusado se for de outro. */
    const r = api.edPodeGravarNo(
      api.editaisLista().filter((x) => x.id === tce.id)[0],
      "@ Qualquer coisa :: 5\n+ Sem cabecalho :: 5 :: pq");
    ok(r.ok === false && r.motivo === "outro-dono",
       "E5b um texto sem cabecalho passou para o edital errado: "
       + JSON.stringify(r));
  }

  /* ================================================================
   * E6: O ESTADO DE QUEM JÁ USAVA O APP — sem dono marcado
   *
   * A trava não pode depender de o dono estar marcado: quem instalou o
   * aplicativo antes dela nunca abriu um edital com a marcação, e é
   * exatamente essa pessoa que já perdeu um edital.
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce } = montar(api);
    /* aberto SEM passar pelo hub: é o que acontece ao recarregar a
     * página com "eac_edital_atual" apontando para um edital e a
     * bancada com a cópia de trabalho antiga */
    api.edAbrir(tce.id);
    api.edMarcarDonoDoTexto(null);
    ok(api.edDonoDoTexto() === "",
       "E6-pre o cenario nasceu com dono marcado e nao reproduz o "
       + "estado antigo: " + api.edDonoDoTexto());

    api.$("editalTexto").value = ISS;
    api.edSalvar();
    const dep = api.editaisLista().filter((x) => x.id === tce.id)[0];
    ok(/TCE-PE/.test(dep.nome || ""),
       "E6 sem dono marcado, o cabecalho do outro edital renomeou este: "
       + dep.nome);
    ok(/Leis Orçamentárias/.test(dep.texto || ""),
       "E6a sem dono marcado, o texto do outro edital foi gravado aqui");

    /* E A GRAVAÇÃO LEGÍTIMA marca o dono, para as próximas nem
     * precisarem do cabeçalho. */
    api.$("editalTexto").value = TCE + "\n+ Precatórios :: 3 :: pq";
    api.edSalvar();
    ok(api.edDonoDoTexto() === String(tce.id),
       "E6b uma gravacao legitima nao adotou o par bancada-edital: "
       + api.edDonoDoTexto());
  }

  /* ---- E7: o nome se compara sem acento e sem caixa ---- */
  {
    const { api } = rodar();
    api.edIniciar();
    const a1 = api.edCriar("SEFAZ Alagoas — Auditor Fiscal",
      "# SEFAZ Alagoas — Auditor Fiscal | horas: 20\n@ D :: 5\n+ T :: 5 :: pq");
    const b1 = api.edCriar("Outro concurso",
      "# Outro concurso | horas: 20\n@ X :: 5\n+ Y :: 5 :: pq");
    api.hubAbrirEdital(b1.id);
    /* MESMO NOME, OUTRA GRAFIA: maiúsculas e acento diferentes. Se a
     * comparação for literal, o texto do SEFAZ entra no "Outro
     * concurso" e ficam dois com o mesmo nome — que é o defeito, só que
     * escrito de outro jeito. */
    const r = api.edPodeGravarNo(b1,
      "# sefaz alagoas — auditor fiscal | horas: 20\n@ D :: 5\n+ T :: 5 :: pq");
    ok(!edIguais(a1.nome, "sefaz alagoas — auditor fiscal"),
       "E7-pre os dois nomes do cenario sao identicos e a comparacao "
       + "literal ja bastaria");
    ok(r.ok === false,
       "E7 o mesmo nome escrito em outra caixa passou pela trava: "
       + JSON.stringify(r));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
