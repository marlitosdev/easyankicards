/* =====================================================================
 * W1 — TEXTO ERRADO NÃO VIRA EDITAL, e a interface não deixa a pessoa errar.
 *
 * O CASO REAL (relato de 2026-10-03, v17.70.0): o usuário copiou o PROMPT (com a regra de ramos) e o colou no campo
 * "resposta da IA" do Novo edital. O app leu os exemplos do prompt como edital — "Nome da disciplina", Português, Direito
 * Financeiro (duas vezes), Auditoria Governamental, Direito Constitucional e dois blocos "Conhecimentos…" — criou o
 * edital com 25 linhas ignoradas e calculou risco de eliminação, buracos e Raio-X em cima disso, tudo com ar de autoridade.
 * O texto deste teste é o MESMO que o app gera ("# Novo edital | horas: 20" + o prompt).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Texto com a assinatura do prompt gera ZERO disciplinas (e o cabeçalho de cima continua valendo).
 *  2. Nomes de exemplo do prompt ("Nome da disciplina"…) são achados; texto cru (quase tudo ignorado) é "cru".
 *  3. Edital de verdade nunca é tomado por prompt (nem quando cita "edital" ou "exemplo de saída").
 *  4. O Novo edital mostra um SEMÁFORO (cinza/verde/âmbar/vermelho), os chips do que foi entendido e o "antes de criar";
 *     vermelho não cria, âmbar pergunta, verde cria.
 *  5. Texto cru pode virar prompt com o texto DENTRO, e o campo só é limpo se a cópia deu certo.
 *  6. A bancada, a colagem corrigida e o "procurar erros" dizem a mesma coisa, no mesmo tom.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  const conduzir = async (promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };
  const REAL = "# Novo edital | horas: 20\n\n" + api.edPromptEdital(true);
  const EXATO = "@ Português :: 10q\n+ Crase :: 3\n+ Concordância :: 5\n@ Direito Financeiro :: 20q\n+ Orçamento :: 5\n++ PPA :: 4\n+ Receita :: 2";
  const PROSA = Array.from({ length: 12 }, (_, i) => "Direito Penal: 1. Lei penal, interpretação e analogia " + i + ".").join("\n");

  /* ---- G1: o motor ---- */
  {
    const r = api.lerEdital(REAL);
    ok(r.disciplinas.length === 0 && r.blocos.length === 0, "G1a o prompt colado NAO gera disciplina nenhuma: " + r.disciplinas.map((d) => d.nome));
    ok(r.achados.some((a) => a.tipo === "texto_e_o_prompt"), "G1b o leitor diz POR QUE esta vazio (achado texto_e_o_prompt)");
    ok(r.cfg.concurso === "Novo edital" && r.cfg.horas === 20, "G1c o cabecalho de cima (o que o app escreveu) continua valendo: " + JSON.stringify(r.cfg));
    ok(api.edEhPrompt(REAL) && api.edTextoSuspeito(REAL).tipo === "prompt", "G1d edEhPrompt/edTextoSuspeito dizem 'prompt'");
    ok(api.edEhPrompt(api.edPromptEdital(false)) && api.edEhPrompt("Você vai organizar um EDITAL de concurso\n[cole aqui o edital]"), "G1e vale para o prompt sem ramos e para um pedaco dele (duas frases-assinatura)");
    ok(!api.edEhPrompt("Você vai organizar um EDITAL de concurso"), "G1f UMA frase so' nao basta");
    api.setLanguage("en");
    const rEn = api.lerEdital("# Exam X | horas: 12\n\n" + api.edPromptEdital(true));
    api.setLanguage("pt");
    ok(rEn.disciplinas.length === 0 && rEn.cfg.concurso === "Exam X" && rEn.cfg.horas === 12, "G1g em ingles tambem, e o '# Exam name' do meio do prompt nao rouba o cabecalho: " + JSON.stringify(rEn.cfg));
    /* editais de verdade nunca sao tomados por prompt */
    const reais = ["# SEFAZ | prova: 2026-12-13 | horas: 25\n& Básicos | minimo: 50%\n@ Português :: 10q\n+ Crase :: 3",
      "@ Direito :: 5\n+ Exemplo de saída das provas anteriores :: 3 :: cai no EDITAL: sempre", EXATO];
    ok(reais.every((x) => api.edTextoSuspeito(x) === null && api.lerEdital(x).disciplinas.length > 0), "G1h editais de verdade nao sao suspeitos nem ficam vazios");
    /* o que tirar do campo: so' o cabecalho */
    ok(api.edTirarPrompt(REAL) === "# Novo edital | horas: 20\n" && api.edTirarPrompt(api.edPromptEdital(true)) === "", "G1i edTirarPrompt deixa so' o cabecalho de cima (ou nada)");
  }

  /* ---- G2: nomes de modelo e texto cru ---- */
  {
    const m = api.lerEdital("@ Nome da disciplina :: 3\n+ Nome do tópico :: 3\n@ Direito :: 5\n+ Nome social do servidor :: 2");
    ok(m.achados.filter((a) => a.tipo === "nome_de_modelo").length === 2, "G2a 'Nome da disciplina' e 'Nome do topico' sao achados (e 'Nome social…' nao): " + JSON.stringify(m.achados.map((a) => a.tipo + ":" + a.txt)));
    const s = api.edTextoSuspeito("@ NOME DA DISCIPLINA :: 3\n+ x :: 3");
    ok(s && s.tipo === "modelo" && s.nomes[0] === "NOME DA DISCIPLINA", "G2b a deteccao ignora caixa e acento: " + JSON.stringify(s));
    ok(api.lerEdital("@ Nome da disciplina :: 3\n+ x :: 3").disciplinas.length === 1, "G2c nome de modelo e' SINALIZADO, nao apagado (a pessoa decide)");
    const c = api.edTextoSuspeito(PROSA);
    ok(c && c.tipo === "cru" && c.ignoradas >= 12, "G2d texto sem marcadores (o edital como saiu do PDF) e' 'cru': " + JSON.stringify(c));
    ok(api.edTextoSuspeito("@ A :: 3\n+ a :: 3\n+ b :: 3\n@ B :: 3\n+ c :: 3\nlinha solta 1\nlinha solta 2") === null, "G2e poucas linhas soltas num plano bom nao sao 'cru'");
    /* o motor so' grita com 5 ou mais linhas ignoradas E mais ignoradas do que linhas uteis */
    ok(api.edTextoSuspeito("linha solta 1\nlinha solta 2\nlinha solta 3") === null, "G2f 3 linhas ignoradas (abaixo do limite de 5): o motor fica quieto — quem avisa e' a tela, que ve 'nenhuma disciplina'");
    const bom = Array.from({ length: 8 }, (_, i) => "@ D" + i + " :: 3\n+ t" + i + " :: 3\n+ u" + i + " :: 3").join("\n");
    ok(api.edTextoSuspeito(bom + "\n" + Array.from({ length: 6 }, (_, i) => "solta " + i).join("\n")) === null, "G2g 6 linhas ignoradas num plano de 8 disciplinas NAO e' 'cru' (as ignoradas tem de passar as uteis)");
  }

  /* ---- G3: procurar erros e colagem corrigida ---- */
  {
    const r = api.lerEdital(REAL);
    const a = api.diagnosticoPlano(r, api.montarPlano(r, { horas: 20, prova: "" }));
    ok(a.length === 1 && a[0].id === "texto_e_o_prompt" && a[0].grave === true && /PROMPT/.test(a[0].msg), "G3a 'procurar erros' tem UM item, grave, que diz que o texto e' o prompt: " + JSON.stringify(a.map((x) => x.id)));
    const rm = api.lerEdital("@ Nome da disciplina :: 3\n+ Nome do tópico :: 3\n@ Direito :: 5\n+ x :: 3");
    const am = api.diagnosticoPlano(rm, api.montarPlano(rm, { horas: 20, prova: "" }));
    ok(am.some((x) => x.id === "nome_de_modelo" && x.grave && /Nome da disciplina/.test(x.msg)), "G3b nomes de exemplo viram achado GRAVE no diagnostico");
    const c = api.edCompararColagem("@ A :: 3\n+ a :: 3", REAL, {});
    ok(c.suspeito === "prompt" && c.vazio === true, "G3c a conferencia da colagem sabe que o colado e' o prompt");
    ok(api.edCompararColagem("@ A :: 3\n+ a :: 3", "@ A :: 3\n+ a :: 3\n+ b :: 3", {}).suspeito === null, "G3d uma resposta boa nao e' suspeita");
    /* a tela: conferencia e botao aplicar */
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("X", "# X | horas: 10\n@ A :: 3\n+ a :: 3");
    api.hubAbrirEdital(ed.id);
    api.$("edColarTexto").value = REAL;
    api.edConferirColagem();
    ok(/PROMPT/.test(api.$("edColarAviso").textContent) && !/tópicos sumiram|sem_perda/.test(api.$("edColarAviso").textContent), "G3e a conferencia na tela diz que e' o PROMPT: " + api.$("edColarAviso").textContent.slice(0, 80));
    const antes = api.$("editalTexto").value;
    await conduzir(api.edAplicarColagem());
    ok(api.$("editalTexto").value === antes, "G3f 'aplicar' com o prompt NAO troca o texto do edital");
  }

  return Object.assign(falhas, { quantas: n });
}

/* a parte da interface é assíncrona e fica em outro bloco para ler melhor */
async function testesInterface() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api, janela } = rodar();
  api.matIniciar(); api.edIniciar();
  api.hubIniciar();
  const REAL = "# Novo edital | horas: 20\n\n" + api.edPromptEdital(true);
  const PROSA = Array.from({ length: 12 }, (_, i) => "Direito Penal: 1. Lei penal, interpretação e analogia " + i + ".").join("\n");
  const BOM = "@ Português :: 10q\n+ Crase :: 3\n@ Direito Financeiro :: 20q\n+ Orçamento :: 5\n++ PPA :: 4";
  const cls = (e) => String((e || {}).className || "");
  const filhos = (e) => Array.from((e && e.children) || []);
  const digitar = (txt) => { api.$("edNovoPlano").value = txt; api.$("edNovoPlano").oninput(); };
  /* nome + a resposta da data ("sem" = o edital saiu, mas a data nao): o minimo que o Novo edital exige para criar */
  const decidir = (nome, modo) => {
    api.$("edNovoNome").value = nome; api.$("edNovoNome").oninput();
    const id = { data: "edNovoModoData", sem: "edNovoModoSem", pre: "edNovoModoPre" }[modo || "sem"];
    api.$(id).checked = true; api.$(id).onchange();
    if (modo === "data") { api.$("edNovoProva").value = "2030-05-10"; api.$("edNovoProva").oninput(); }
  };
  const total = () => api.editaisAtuais.length;
  const avisos = [];
  const confirmar = (v) => async (m) => { avisos.push(m); return v; };

  /* ---- I1: estados do semáforo ---- */
  {
    const E = (t) => api.hubNovoEstadoPlano(t);
    ok(E("").estado === "vazio" && E("   ").estado === "vazio", "I1a vazio");
    ok(E(REAL).estado === "prompt", "I1b o prompt e' 'prompt'");
    const b = E(BOM);
    ok(b.estado === "ok" && b.d === 2 && b.t === 2 && b.r === 1 && b.disc.length === 2, "I1c edital bom: ok, 2 disciplinas, 2 topicos, 1 ramo: " + JSON.stringify([b.estado, b.d, b.t, b.r]));
    ok(E(BOM + "\nlinha solta").estado === "atencao" && E(BOM + "\nlinha solta").ign === 1, "I1d uma linha ignorada: atencao");
    ok(E(BOM + "\n@ Português :: 5\n+ x :: 3").rep === 1 && E(BOM + "\n@ Português :: 5\n+ x :: 3").estado === "atencao", "I1e disciplina repetida: atencao");
    ok(E("@ Vazia :: 3\n" + BOM).sem === 1 && E("@ Vazia :: 3\n" + BOM).estado === "atencao", "I1f disciplina sem topico: atencao");
    ok(E(PROSA).estado === "cru" && E("abc").estado === "cru", "I1g prosa solta ou texto sem formato: cru");
    ok(E("@ Nome da disciplina :: 3\n+ x :: 3").estado === "modelo", "I1h nome de exemplo: modelo");
    ok(E("# so cabecalho\n# outro").estado === "vazio", "I1i so' linhas de cabecalho: vazio");
  }

  /* ---- I2: o prompt no campo — vermelho, bloqueia, oferece limpar ---- */
  {
    api.hubNovo();
    digitar(REAL);
    ok(cls(api.$("edNovoSem")).includes("sem-erro") && api.$("edNovoSemIco").textContent === "⛔" && /PROMPT/.test(api.$("edNovoSemTxt").textContent), "I2a o semaforo fica VERMELHO e diz que e' o prompt: " + cls(api.$("edNovoSem")));
    ok(cls(api.$("edNovoPlano")).includes("ta-erro"), "I2b o proprio campo ganha a borda vermelha");
    ok(api.$("btnEdNovoCriar").disabled === true && api.$("btnEdNovoCriar").title === api.t("ed_novo_criar_bloq"), "I2c 'Criar edital' fica desligado e o motivo esta na dica");
    ok(api.$("edNovoEntendi").hidden === true, "I2d nao mostra 'o que entendi' (nao entendeu nada)");
    ok(api.$("edNovoConf").textContent === "", "I2d2 e a contagem '0 disciplinas, 25 linhas…' nao repete o que o semaforo ja disse");
    ok(filhos(api.$("edNovoSemAcoes")).map((b) => b.id).join(",") === "btnEdNovoLimpar", "I2e a unica acao oferecida e' limpar o campo");
    ok(cls(api.$("edNovoProntPlano")) === "pront-erro" && /não cria/.test(api.$("edNovoProntPlano").textContent), "I2f o 'antes de criar' tambem marca o plano em vermelho");
    const antes = total();
    ok((await api.hubNovoCriarConfirmado(confirmar(true))) === null && total() === antes, "I2g o botao nao cria edital com o prompt, nem se a pessoa 'confirmar'");
    ok(api.hubNovoCriar() === null && total() === antes, "I2h hubNovoCriar chamado direto tambem recusa");
    api.$("btnEdNovoLimpar").onclick();
    ok(api.$("edNovoPlano").value === "" && cls(api.$("edNovoSem")).includes("sem-vazio") && api.$("btnEdNovoCriar").disabled === false, "I2i 'Limpar o campo' volta ao cinza e liga o botao");
  }

  /* ---- I3: verde, chips do que foi entendido ---- */
  {
    api.hubNovo();
    digitar(BOM);
    ok(cls(api.$("edNovoSem")).includes("sem-ok") && api.$("edNovoSemIco").textContent === "✓" && cls(api.$("edNovoPlano")).includes("ta-ok"), "I3a verde: entendido");
    const chips = filhos(api.$("edNovoEntendi"));
    ok(api.$("edNovoEntendi").hidden === false && chips.map((c) => c.textContent).join("|") === "Português · 1|Direito Financeiro · 1", "I3b um chip por disciplina, com o numero de topicos: " + chips.map((c) => c.textContent));
    ok(chips.every((c) => !cls(c).includes("chip-")), "I3c chips normais nao sao marcados");
    ok(cls(api.$("edNovoProntPlano")) === "pront-ok" && /2 disciplina\(s\), 2 tópico\(s\)/.test(api.$("edNovoProntPlano").textContent), "I3d 'antes de criar': plano ok com a contagem");
    digitar("@ Nome da disciplina :: 3\n+ x :: 3\n@ Vazia :: 3\n" + BOM);
    const c2 = filhos(api.$("edNovoEntendi"));
    ok(cls(c2[0]).includes("chip-erro") && cls(c2[1]).includes("chip-atencao") && !cls(c2[2]).includes("chip-"), "I3e nome de exemplo = chip vermelho; disciplina sem topico = chip ambar: " + c2.map((c) => cls(c)));
    ok(cls(api.$("edNovoSem")).includes("sem-atencao") && /exemplo|EXEMPLO/.test(api.$("edNovoSemTxt").textContent), "I3f e o semaforo e' ambar e fala dos nomes de exemplo");
    digitar(Array.from({ length: 14 }, (_, i) => "@ D" + i + " :: 3\n+ t :: 3").join("\n"));
    ok(filhos(api.$("edNovoEntendi")).length === 13 && filhos(api.$("edNovoEntendi"))[12].textContent === "+2", "I3g mais de 12 disciplinas: 12 chips e um '+N'");
  }

  /* ---- I4: âmbar pergunta; verde cria ---- */
  {
    api.hubNovo();
    decidir("Concurso Z");
    digitar(BOM + "\nlinha solta 1\nlinha solta 2");
    ok(cls(api.$("edNovoSem")).includes("sem-atencao") && /2 linha\(s\) ignorada/.test(api.$("edNovoSemTxt").textContent), "I4a amarelo e diz quantas linhas ficaram de fora: " + api.$("edNovoSemTxt").textContent);
    avisos.length = 0;
    let antes = total();
    ok((await api.hubNovoCriarConfirmado(confirmar(false))) === null && total() === antes && avisos.length === 1 && /2 linhas não foram entendidas/.test(avisos[0]), "I4b ambar PERGUNTA, e 'nao' nao cria: " + avisos[0]);
    ok((await api.hubNovoCriarConfirmado(confirmar(true))) && total() === antes + 1, "I4c e 'sim' cria");
    api.hubNovo();
    decidir("Concurso Y");
    digitar(BOM);
    avisos.length = 0; antes = total();
    ok((await api.hubNovoCriarConfirmado(confirmar(false))) && avisos.length === 0 && total() === antes + 1, "I4d verde cria direto, sem perguntar");
    api.hubNovo();
    decidir("Concurso W");
    digitar("");
    avisos.length = 0; antes = total();
    ok((await api.hubNovoCriarConfirmado(confirmar(false))) && avisos.length === 0 && total() === antes + 1, "I4e campo vazio (colar depois) tambem cria sem perguntar");
    api.hubNovo();
    decidir("Concurso V");
    digitar(PROSA);
    avisos.length = 0; antes = total();
    ok((await api.hubNovoCriarConfirmado(confirmar(false))) === null && avisos.length === 1 && /quase nada/.test(avisos[0]) && total() === antes, "I4f texto cru: pergunta ('quase nada foi entendido') e 'nao' nao cria");
  }

  /* ---- I5: texto cru -> prompt com o texto dentro ---- */
  {
    api.hubNovo();
    digitar(PROSA);
    ok(cls(api.$("edNovoSem")).includes("sem-atencao") && filhos(api.$("edNovoSemAcoes")).map((b) => b.id).join(",") === "btnEdNovoMontar,btnEdNovoEstruturar,btnEdNovoLimpar", "I5a texto cru numerado: ambar, com 'montar o prompt', 'estruturar aqui' e 'limpar'");
    ok(api.$("edNovoEntendi").hidden === true && api.$("edNovoConf").textContent === "", "I5b sem chips e sem contagem");
    janela.__area = "";
    const feito = await api.hubNovoMontarPrompt();
    ok(feito === true && janela.__area.includes("Direito Penal: 1. Lei penal, interpretação e analogia 5.") && !janela.__area.includes("[cole aqui o edital]") && /^Você vai organizar um EDITAL/.test(janela.__area), "I5c o prompt copiado leva o texto no lugar do '[cole aqui o edital]'");
    ok(api.$("edNovoPlano").value === "" && api.$("edNovoPromptMsg").textContent === api.t("ed_novo_montar_ok") && cls(api.$("edNovoSem")).includes("sem-vazio"), "I5d depois de copiar, o campo e' limpo e o passo 1 avisa");
    ok(api.$("edNovoPasso1").className === "ednovo-passo feito" && api.$("edNovoPasso2").className === "ednovo-passo ativo", "I5e o passo 1 vira feito e o passo 2 ganha o destaque");
    /* com ramos marcados */
    api.hubNovo();
    api.$("edNovoPedirRamos").checked = true;
    digitar(PROSA);
    janela.__area = "";
    await api.hubNovoMontarPrompt();
    ok(/RAMIFICAÇÕES/.test(janela.__area) && janela.__area.includes("analogia 3."), "I5f respeita a caixa das ramificacoes");
    /* se a copia falha, o texto NAO e' apagado */
    api.hubNovo();
    digitar(PROSA);
    const antesW = janela.navigator.clipboard.writeText;
    janela.navigator.clipboard.writeText = () => { throw new Error("negado"); };
    const f2 = await api.hubNovoMontarPrompt();
    janela.navigator.clipboard.writeText = antesW;
    ok(f2 === false && api.$("edNovoPlano").value === PROSA && api.$("edNovoPromptMsg").textContent === api.t("ed_novo_montar_falha"), "I5g copia negada: o texto continua no campo e a pessoa e' avisada");
  }

  /* ---- W4: estruturar o edital cru, numerado, SEM IA (trechos do edital da Câmara) ---- */
  {
    const CAM = [
      "CONHECIMENTOS BÁSICOS",
      "LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos de gêneros variados. 2 Reconhecimento de tipos e gêneros textuais. 3 Domínio da ortografia oficial. 4 Emprego das classes de palavras. 5 Sintaxe da oração e do período. 6 Pontuação.",
      "LÍNGUA INGLESA: 1 Compreensão de textos variados: ideias principais. 2 Itens gramaticais relevantes para a compreensão dos conteúdos semânticos.",
      "NOÇÕES DE DIREITO CONSTITUCIONAL: 1 Constituição da República Federativa do Brasil de 1988. 1.1 Princípios fundamentais. 1.2 Direitos e garantias fundamentais. 2 Administração pública, conforme a Lei 8.112/1990, art. 12 e seguintes. 3 Poder Legislativo.",
      "CONHECIMENTOS ESPECÍFICOS",
      "Tecnologia da Informação e Dados: 1 MSOffice 365. 2 Redes de computadores. 2.1 Conceitos básicos. 2.2 Topologias.",
      "LINGUÍSTICA",
      "Sem numeração nenhuma aqui mas um texto longo o bastante para ser reportado como disciplina sem itens numerados, passando de cento e vinte caracteres no total para valer."
    ].join("\n");
    const r = api.edEstruturarCru(CAM);
    ok(r.disciplinas === 4 && r.topicos === 13 && r.ramos === 4 && r.blocos === 2, "W4a conta disciplinas, tópicos, ramos e blocos: " + JSON.stringify(r));
    ok(/^& Conhecimentos Básicos\n@ Língua Portuguesa :: 3\n\+ Compreensão e interpretação de textos de gêneros variados :: 3\n/.test(r.texto), "W4b bloco '&' em caixa de título, disciplina '@' e primeiro tópico '+', todos com peso 3");
    ok(!/::\s*[^3\s]/.test(r.texto.replace(/ :: 3/g, "")) && r.texto.split("\n").filter((l) => /^[@+]/.test(l) || /^\+\+/.test(l)).every((l) => / :: 3$/.test(l)), "W4c todo peso sai 3 (o app não inventa prioridade)");
    ok(r.texto.includes("+ Administração pública, conforme a Lei 8.112/1990, art. 12 e seguintes :: 3") && !r.texto.includes("+ 112/1990") , "W4d 'Lei 8.112/1990' e 'art. 12' não viram item (só o PRÓXIMO número da sequência, antes de maiúscula)");
    ok(r.texto.includes("+ Constituição da República Federativa do Brasil de 1988 :: 3\n++ Princípios fundamentais :: 3\n++ Direitos e garantias fundamentais :: 3\n+ Administração"), "W4e '1.1', '1.2' viram ramos '++' logo abaixo do tópico 1");
    ok(r.semNumeracao.length === 1 && r.semNumeracao[0] === "Linguística" && !r.texto.includes("Linguística"), "W4f disciplina sem numeração fica fora e é reportada: " + r.semNumeracao);
    const sr = api.edEstruturarCru(CAM, { ramos: false });
    ok(sr.ramos === 0 && sr.topicos === 13 && sr.texto.includes("+ Constituição da República Federativa do Brasil de 1988. 1.1 Princípios fundamentais. 1.2 Direitos e garantias fundamentais :: 3") && !/^\+\+/m.test(sr.texto), "W4g sem ramos, '1.1' e '1.2' ficam DENTRO do tópico (nada se perde)");
    const lido = api.lerEdital(r.texto);
    ok(lido.disciplinas.length === 4 && lido.disciplinas[2].topicos[0].ramos.length === 2 && lido.blocos.length === 2 && !lido.achados.some((x) => x.tipo === "ignorada" || x.tipo === "sem_topico"), "W4h o que sai é lido de volta pelo app sem linha ignorada nem disciplina sem tópico: " + lido.achados.map((x) => x.tipo));
    ok(api.edEstruturarCru("").disciplinas === 0 && api.edEstruturarCru("só uma frase qualquer.").disciplinas === 0 && api.edEstruturarCru(null).texto === "", "W4i texto vazio / sem estrutura não estrutura nada");
    ok(api.edEstruturarCru("DIREITO PENAL\n1 Lei penal. 2 Crime.\n3 Pena.").topicos === 3, "W4j título sozinho em CAIXA ALTA abre a disciplina e as linhas seguintes são juntadas");
    const longo = "MATÉRIA X: 1 Palavra " + "palavra, ".repeat(60) + "fim. 2 Outro item.";
    const rl = api.edEstruturarCru(longo).texto.split("\n")[1];
    ok(rl.length < 300 && rl.includes("…"), "W4k item enorme é cortado no nome do tópico (com reticências): " + rl.length);
    ok(!api.edEstruturarCru("MATÉRIA Y: 1 Item com :: dois pontos. 2 Outro.").texto.includes("com ::"), "W4l '::' do texto não vaza para o formato");

    const seq = api.edEstruturarCru("DIREITO Q: 1 Lei Geral. 2 Código Civil, art. 12 Das pessoas. 3 Penal.");
    ok(seq.topicos === 3 && !seq.texto.includes("+ Das pessoas"), "W4m0 um número fora da sequência ('art. 12 Das…') não abre item mesmo antes de maiúscula");
    ok(api.edEstruturarCru("DIREITO T: 1 Lei Geral. 2 Código, ver 3 itens abaixo. 3 Penal.").texto.includes("+ Código, ver 3 itens abaixo. :: 3".replace(". ::"," ::")),"W4m1b número seguido de minúscula ('3 itens') não abre item");
    ok(api.edEstruturarCru("DIREITO R: 1 Primeiro. 2 Segundo 3Terceiro").topicos === 2, "W4m1 número colado na palavra ('3Terceiro') não abre item (exige espaço)");
    ok(api.edEstruturarCru("DIREITO S: 1 Primeiro. 2 Segundo.\nBREVE: texto curto sem numero.").semNumeracao.length === 0, "W4m2 disciplina sem numeração mas curta (até 120 caracteres) não é reportada");
    const corta = api.edEstruturarCru("MATÉRIA W: 1 Pal " + "palavra, ".repeat(60) + "fim. 2 Outro.").texto.split("\n")[1];
    ok(/palavra…( :: 3)?$/.test(corta), "W4m3 o corte do item longo acontece numa vírgula (não no meio da palavra): " + corta.slice(-24));
    const semPonto = api.edEstruturarCru("DIREITO Z: 1 Lei penal 2 Crime").texto.split("\n");
    ok(semPonto[1] === "+ Lei penal :: 3" && semPonto[2] === "+ Crime :: 3", "W4m4 o último caractere do item sem ponto final não se perde: " + semPonto.slice(1));
    /* a tela: botão aparece só no cru estruturável; clicar troca o texto e deixa voltar */
    api.hubNovo();
    digitar(CAM);
    ok(cls(api.$("edNovoSem")).includes("sem-atencao") && filhos(api.$("edNovoSemAcoes")).map((b) => b.id).join(",") === "btnEdNovoMontar,btnEdNovoEstruturar,btnEdNovoLimpar", "W4m texto cru numerado: ganha 'estruturar aqui (sem IA)'");
    ok(api.hubNovoEstruturar() === true && api.$("edNovoPlano").value === r.texto, "W4n clicar troca o campo pelo texto estruturado");
    const ids = filhos(api.$("edNovoSemAcoes")).map((b) => b.id);
    ok(ids.includes("btnEdNovoDesestruturar") && !ids.includes("btnEdNovoEstruturar") && /4 disciplina\(s\), 13 tópico\(s\), 4 ramo\(s\)/.test(api.$("edNovoPromptMsg").textContent) && /pesos ficaram em 3/.test(api.$("edNovoPromptMsg").textContent) && /Linguística/.test(api.$("edNovoPromptMsg").textContent), "W4o a mensagem conta o que entrou, avisa dos pesos 3 e do que ficou de fora; aparece 'voltar ao texto original': " + api.$("edNovoPromptMsg").textContent);
    ok(api.hubNovoDesestruturar() === true && api.$("edNovoPlano").value === CAM && api.$("edNovoPromptMsg").textContent === "", "W4p 'voltar ao texto original' devolve EXATAMENTE o que a pessoa colou");
    ok(api.hubNovoDesestruturar() === false, "W4q sem original guardado, voltar não faz nada");
    digitar("texto sem estrutura nenhuma, só prosa solta que não tem como virar edital " + "x".repeat(40));
    ok(api.hubNovoEstruturar() === false && api.$("edNovoPromptMsg").textContent === api.t("ed_novo_estruturar_nada"), "W4r sem o que estruturar, avisa e não mexe");
    digitar(Array.from({ length: 12 }, () => "Frase solta sem estrutura nenhuma para virar edital").join("\n"));
    ok(cls(api.$("edNovoSem")).includes("sem-atencao") && !filhos(api.$("edNovoSemAcoes")).some((b) => b.id === "btnEdNovoEstruturar") && filhos(api.$("edNovoSemAcoes")).some((b) => b.id === "btnEdNovoMontar"), "W4r2 texto cru SEM estrutura numerada: continua 'montar o prompt' e NÃO oferece estruturar");
    api.hubNovo();
    digitar(CAM);
    api.hubNovoEstruturar();
    api.hubNovo();
    ok(!filhos(api.$("edNovoSemAcoes")).some((b) => b.id === "btnEdNovoDesestruturar"), "W4s abrir o Novo edital de novo esquece o original guardado");
  }

  /* ---- I6: passos e "antes de criar" ---- */
  {
    api.hubNovo();
    ok(api.$("edNovoPasso1").className === "ednovo-passo" && api.$("edNovoPasso2").className === "ednovo-passo", "I6a ao abrir, nenhum passo esta marcado");
    api.$("btnEdNovoPrompt").onclick();
    ok(api.$("edNovoPasso1").className === "ednovo-passo feito" && api.$("edNovoPasso2").className === "ednovo-passo ativo", "I6b copiar o prompt marca o passo 1 e destaca o 2");
    api.hubNovo();
    ok(api.$("edNovoPasso1").className === "ednovo-passo" && api.$("edNovoPasso2").className === "ednovo-passo", "I6c abrir de novo desmarca");
    ok(cls(api.$("edNovoProntNome")) === "pront-vazio" && /obrigatório/.test(api.$("edNovoProntNome").textContent), "I6d nome vazio ao abrir: cinza 'obrigatorio' (o nome nao vem mais pre-preenchido)");
    ok(cls(api.$("edNovoProntData")) === "pront-vazio" && /três opções/.test(api.$("edNovoProntData").textContent), "I6e sem resposta da data: cinza, pede uma das tres opcoes");
    ok(cls(api.$("edNovoProntPlano")) === "pront-vazio", "I6f sem plano: cinza (pode colar depois)");
    api.$("edNovoNome").value = "CFO PM-PE"; api.$("edNovoNome").oninput();
    api.$("edNovoModoData").checked = true; api.$("edNovoModoData").onchange();
    api.$("edNovoProva").value = "2030-02-21"; api.$("edNovoProva").oninput();
    ok(cls(api.$("edNovoProntNome")) === "pront-ok" && /CFO PM-PE/.test(api.$("edNovoProntNome").textContent) && cls(api.$("edNovoProntData")) === "pront-ok" && /21\/02\/2030/.test(api.$("edNovoProntData").textContent), "I6g com nome e data os dois ficam verdes (data dd/mm/aaaa)");
  }

  /* ---- I7: a bancada (edital ja' criado e contaminado) ---- */
  {
    const ed = api.edCriar("Contaminado", REAL);
    api.hubAbrirEdital(ed.id);
    api.edRender();
    const sug = filhos(api.$("editalSug"));
    ok(sug.length > 0 && /PROMPT/.test(sug[0].textContent) && cls(filhos(sug[0])[0]).includes("dot-red"), "I7a a PRIMEIRA sugestao da bancada e' vermelha e diz que o texto e' o prompt: " + (sug[0] || {}).textContent);
    ok(!sug.some((s) => cls(filhos(s)[0]).includes("dot-green")), "I7b e nao ha mais bolinha verde ao lado do vermelho");
    const fix = filhos(filhos(sug[0])[filhos(sug[0]).length - 1]).find((b) => b.textContent === api.t("ed_fix_prompt"));
    ok(!!fix, "I7c ha o botao 'tirar o prompt do texto'");
    await fix.onclick();
    ok(api.$("editalTexto").value === "# Novo edital | horas: 20\n", "I7d consertar deixa so' o cabecalho: " + JSON.stringify(api.$("editalTexto").value.slice(0, 60)));
    /* "Lido" so' e' verde quando nao sobrou nada de fora */
    api.$("editalTexto").value = BOM + "\nlinha solta";
    api.edRender();
    const lido = filhos(api.$("editalSug")).find((s) => /Lido:/.test(s.textContent));
    ok(lido && cls(filhos(lido)[0]).includes("dot-org"), "I7e 'Lido: …' fica ambar quando ha linha ignorada: " + (lido && cls(filhos(lido)[0])));
    api.$("editalTexto").value = BOM;
    api.edRender();
    const lido2 = filhos(api.$("editalSug")).find((s) => /Lido:/.test(s.textContent));
    ok(lido2 && cls(filhos(lido2)[0]).includes("dot-green"), "I7f e verde quando esta tudo entendido");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes: async () => {
  const a = await testes();
  const b = await testesInterface();
  const f = [...a, ...b]; f.quantas = (a.quantas || 0) + (b.quantas || 0);
  return f;
} };
