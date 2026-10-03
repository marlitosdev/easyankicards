/* =====================================================================
 * W2 — NOME, DATA E PRÉ-EDITAL no Novo edital.
 *
 * O relato: o edital foi criado sem crítica ao nome ("Novo edital" vinha como VALOR do campo), sem data e sem que o app
 * perguntasse se era um pré-edital (o app já tem a fase "pré": "# Nome | previsto: 2027-03..2027-06"). Três coisas que mudam
 * o plano inteiro (prazo, semanas, fase) passavam caladas.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O nome nasce VAZIO (com exemplo no placeholder) e é obrigatório; nome de rascunho ("Novo edital") pergunta.
 *  2. A data tem TRES respostas — "tenho a data", "o edital saiu, mas a data nao", "ainda e pre-edital" — e NAO cria sem escolher.
 *  3. Pre-edital: a janela (mes/ano ate mes/ano) vira \`previsto:\` no cabecalho e a fase "pre"; sem prova.
 *  4. Erros aparecem escritos debaixo do campo, em vermelho, so' depois da primeira tentativa; o cursor vai ao primeiro.
 *  5. Avisos (nome de rascunho, data que ja passou, linhas ignoradas) viram UMA pergunta so'.
 *  6. A 2a fase so' existe com a data conhecida, e tem de vir DEPOIS da primeira prova.
 *  7. Horas por semana: inteiro de 1 a 80.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  const cls = (id) => String(api.$(id).className || "");
  const ano = new Date().getFullYear();
  const FUTURA = (ano + 2) + "-05-10", PASSADA = "2020-01-15";
  const BOM = "@ Português :: 10q\n+ Crase :: 3\n@ Direito Financeiro :: 20q\n+ Orçamento :: 5";
  const avisos = [];
  const confirmar = (v) => async (m) => { avisos.push(m); return v; };
  const total = () => api.editaisAtuais.length;
  const set = (id, v) => { api.$(id).value = v; if (api.$(id).oninput) api.$(id).oninput(); };
  const modo = (qual) => { const id = { data: "edNovoModoData", sem: "edNovoModoSem", pre: "edNovoModoPre" }[qual]; api.$(id).checked = true; api.$(id).onchange(); };
  const abrir = () => { api.hubNovo(); };
  let foco = null;
  ["edNovoNome", "edNovoProva", "edNovoHoras", "edNovoF2Prova", "edNovoPreDeM", "edNovoModoData", "edNovoPreAteM"].forEach((id) => { api.$(id).focus = () => { foco = id; }; });
  const criar = async (c) => { avisos.length = 0; return api.hubNovoCriarConfirmado(confirmar(c === undefined ? true : c)); };
  const pre = (dm, da, am, aa) => { set("edNovoPreDeM", dm); set("edNovoPreDeA", da); set("edNovoPreAteM", am); set("edNovoPreAteA", aa); };

  /* ---- D1: ao abrir ---- */
  {
    abrir();
    ok(api.$("edNovoNome").value === "" && !/Novo edital/.test(api.$("edNovoNome").value), "D1a o nome nasce VAZIO (antes vinha 'Novo edital' como valor)");
    ok(["edNovoModoData", "edNovoModoSem", "edNovoModoPre"].every((id) => api.$(id).checked === false) && api.hubNovoModo() === "", "D1b nenhuma resposta da data vem marcada");
    ok(api.$("edNovoDataCampo").hidden === true && api.$("edNovoPreCampo").hidden === true && api.$("edNovoF2Lin").hidden === true, "D1c sem resposta, nenhum campo de data aparece (nem a 2a fase)");
    const meses = Array.from(api.$("edNovoPreDeM").children), anos = Array.from(api.$("edNovoPreDeA").children);
    ok(meses.length === 13 && meses[1].textContent === "janeiro" && meses[12].textContent === "dezembro", "D1d o seletor de mes tem os 12 meses (e o 'mes')");
    ok(anos.length === 5 && anos[1].value === String(ano) && anos[4].value === String(ano + 3), "D1e o seletor de ano vai do ano atual a +3");
    ok(cls("edNovoProntNome") === "pront-vazio" && cls("edNovoProntData") === "pront-vazio", "D1f antes da primeira tentativa o que falta aparece CINZA, nao vermelho");
    ok(["edNovoNomeErro", "edNovoDataErro", "edNovoHorasErro"].every((id) => api.$(id).hidden === true), "D1g nenhum erro escrito antes de tentar");
    ok(/btn-pend/.test(cls("btnEdNovoCriar")) && /Falta/.test(api.$("btnEdNovoCriar").title), "D1h o botao Criar fica 'pendente' e a dica diz o que falta");
  }

  /* ---- D2: tentar criar vazio mostra o que falta ---- */
  {
    abrir();
    const antes = total();
    ok((await criar()) === null && total() === antes, "D2a vazio nao cria");
    ok(!api.$("edNovoNomeErro").hidden && api.$("edNovoNomeErro").textContent === api.t("ed_novo_e_nome") && !api.$("edNovoDataErro").hidden && api.$("edNovoDataErro").textContent === api.t("ed_novo_e_modo"), "D2b os erros aparecem escritos debaixo do nome e da data");
    ok(/ednovo-inv/.test(cls("edNovoNome")), "D2c o campo do nome ganha a borda vermelha");
    ok(foco === "edNovoNome", "D2d o cursor vai ao PRIMEIRO campo com erro: " + foco);
    ok(cls("edNovoProntNome") === "pront-erro" && cls("edNovoProntData") === "pront-erro", "D2e depois da tentativa o 'antes de criar' fica vermelho");
    set("edNovoNome", "CFO PM-PE 2027");
    ok(api.$("edNovoNomeErro").hidden === true && !/ednovo-inv/.test(cls("edNovoNome")) && cls("edNovoProntNome") === "pront-ok", "D2f corrigir o campo apaga o erro na hora");
    ok((await criar()) === null && foco === "edNovoModoData" && api.$("edNovoDataErro").textContent === api.t("ed_novo_e_modo"), "D2g so' o nome: ainda nao cria e pede a resposta da data");
    modo("data");
    ok(api.$("edNovoDataCampo").hidden === false && api.$("edNovoDataErro").textContent === api.t("ed_novo_e_data") && (await criar()) === null && foco === "edNovoProva", "D2h 'tenho a data' sem a data: mostra o campo, pede a data e leva o cursor a ele");
    set("edNovoProva", FUTURA);
    ok(/btn-pend/.test(cls("btnEdNovoCriar")) === false && api.$("btnEdNovoCriar").title === "", "D2i completo: o botao deixa de ser 'pendente'");
    const e = await criar();
    ok(e && total() === antes + 1 && avisos.length === 0, "D2j nome + data: cria sem perguntar nada");
    const r = api.lerEdital(e.texto);
    ok(r.cfg.concurso === "CFO PM-PE 2027" && r.cfg.prova === FUTURA && r.cfg.fase === "pos", "D2k o cabecalho leva nome e data: " + JSON.stringify(r.cfg));
  }

  /* ---- D2b: depois de uma tentativa, abrir de novo volta ao cinza e sem borda ---- */
  {
    abrir();
    await criar();
    ok(/ednovo-inv/.test(cls("edNovoNome")) && cls("edNovoProntNome") === "pront-erro", "D2k2 (depois da tentativa: borda e vermelho)");
    abrir();
    ok(!api.$("edNovoNomeErro").textContent && api.$("edNovoNomeErro").hidden === true && cls("edNovoProntNome") === "pront-vazio" && !/ednovo-inv/.test(cls("edNovoNome")), "D2l abrir de novo esquece a tentativa: sem erro escrito, sem borda e o 'antes de criar' volta ao cinza");
    ok(["edNovoNome", "edNovoProva", "edNovoHoras", "edNovoPreDeM", "edNovoPreDeA"].every((id) => !/ednovo-inv/.test(cls(id))), "D2m antes de qualquer tentativa nenhum campo tem borda vermelha");
  }

  /* ---- D3: "o edital saiu, mas a data nao" ---- */
  {
    abrir(); set("edNovoNome", "SEFAZ Teste"); modo("data"); set("edNovoProva", FUTURA); modo("sem");
    api.$("edNovoF2On").checked = true; api.$("edNovoF2On").onchange();
    ok(api.$("edNovoF2cx").hidden === true && api.hubNovoValidar().erros.length === 0, "D3pre (modo 'sem', interruptor da 2a fase ligado e SEM data da 2a fase): campos escondidos e nenhum erro — a 2a fase escondida nao e' cobrada");
    api.$("edNovoF2On").checked = false; api.$("edNovoF2On").onchange();
    ok(cls("edNovoProntData") === "pront-atencao" && /ainda não divulgada/.test(api.$("edNovoProntData").textContent), "D3a decisao consciente: ambar, e diz o que se perde");
    ok(api.$("edNovoF2Lin").hidden === true, "D3b sem data nao ha 2a fase");
    api.$("edNovoF2On").checked = true; set("edNovoF2Prova", FUTURA);
    const e = await criar();
    const r = api.lerEdital(e.texto);
    ok(e && avisos.length === 0 && r.cfg.prova === "" && r.cfg.previsto === "" && !(r.cfg.fase2 && r.cfg.fase2.prova), "D3c (a data digitada antes de escolher 'sem data' tambem nao entra) cria sem prova, sem previsto e ignora a 2a fase escondida: " + JSON.stringify(r.cfg));
  }

  /* ---- D4: pre-edital ---- */
  {
    abrir(); set("edNovoNome", "PM-PE Previsto"); modo("pre");
    ok(api.$("edNovoPreCampo").hidden === false && api.$("edNovoDataCampo").hidden === true && api.$("edNovoF2Lin").hidden === true, "D4a pre-edital mostra a janela (e nao a data nem a 2a fase)");
    ok((await criar()) === null && api.$("edNovoDataErro").textContent === api.t("ed_novo_e_pre") && foco === "edNovoPreDeM", "D4b sem a janela nao cria e pede o inicio");
    pre("3", String(ano + 1), "6", String(ano));
    ok((await criar()) === null && api.$("edNovoDataErro").textContent === api.t("ed_novo_e_pre_ordem") && foco === "edNovoPreAteM", "D4c fim antes do inicio: erro");
    pre("3", String(ano + 1), "6", String(ano + 1));
    ok(api.hubNovoPrevisto().texto === (ano + 1) + "-03.." + (ano + 1) + "-06" && /03\/\d{4} e 06\/\d{4}/.test(api.$("edNovoPreLeitura").textContent), "D4d a janela vira AAAA-MM..AAAA-MM e a tela le de volta: " + api.$("edNovoPreLeitura").textContent);
    ok(cls("edNovoProntData") === "pront-ok" && /Pré-edital/.test(api.$("edNovoProntData").textContent), "D4e o 'antes de criar' mostra o pre-edital em verde");
    const e = await criar();
    const r = api.lerEdital(e.texto);
    ok(e && avisos.length === 0 && r.cfg.previsto === (ano + 1) + "-03.." + (ano + 1) + "-06" && r.cfg.fase === "pre" && r.cfg.prova === "" && api.edJanela(r.cfg.previsto) !== null, "D4f o edital nasce em fase 'pre' com a janela prevista: " + JSON.stringify(r.cfg));
    abrir(); set("edNovoNome", "Um mes so"); modo("pre"); pre("9", String(ano + 1), "", "");
    const e2 = await criar();
    abrir(); set("edNovoNome", "Mesmo mes"); modo("pre"); pre("9", String(ano + 1), "9", String(ano + 1));
    ok(api.hubNovoPrevisto().texto === (ano + 1) + "-09", "D4g2 inicio e fim no MESMO mes: a janela e' aquele mes (AAAA-MM, sem '..'): " + api.hubNovoPrevisto().texto);
    ok(e2 && api.lerEdital(e2.texto).cfg.previsto === (ano + 1) + "-09", "D4g so' o inicio: a janela e' aquele mes: " + (e2 && api.lerEdital(e2.texto).cfg.previsto));
    ok(api.hubNovoTexto({ nome: "X", prova: "2030-01-01", previsto: "2030-03", horas: 20 }).indexOf("previsto") < 0 && /previsto: 2030-03/.test(api.hubNovoTexto({ nome: "X", previsto: "2030-03", horas: 20 })), "D4h com data da prova nao ha 'previsto'; sem ela, ha");
  }

  /* ---- D5: avisos viram UMA pergunta ---- */
  {
    abrir(); set("edNovoNome", "Novo edital"); modo("sem");
    let antes = total();
    ok((await criar(false)) === null && total() === antes && avisos.length === 1 && /rascunho/.test(avisos[0]), "D5a nome de rascunho: pergunta e 'nao' nao cria: " + avisos[0]);
    ok(cls("edNovoProntNome") === "pront-atencao", "D5b o 'antes de criar' mostra o nome de rascunho em ambar");
    ok(!!(await criar(true)) && total() === antes + 1, "D5c e 'sim' cria");
    abrir(); set("edNovoNome", "Prova Antiga"); modo("data"); set("edNovoProva", PASSADA);
    ok(cls("edNovoProntData") === "pront-atencao" && /já passou/.test(api.$("edNovoProntData").textContent), "D5d data passada: ambar");
    antes = total();
    ok((await criar(false)) === null && avisos.length === 1 && /15\/01\/2020/.test(avisos[0]) && /já passou/.test(avisos[0]), "D5e data passada: pergunta com a data");
    abrir(); set("edNovoNome", "Concurso"); modo("data"); set("edNovoProva", PASSADA); api.$("edNovoPlano").value = BOM + "\nlinha solta 1\nlinha solta 2"; api.$("edNovoPlano").oninput();
    avisos.length = 0; antes = total();
    await api.hubNovoCriarConfirmado(confirmar(false));
    ok(avisos.length === 1 && /rascunho/.test(avisos[0]) && /já passou/.test(avisos[0]) && /2 linhas/.test(avisos[0]) && total() === antes, "D5f tres avisos (nome, data, linhas) = UMA pergunta so': " + avisos.length);
  }

  /* ---- D6: horas e 2a fase ---- */
  {
    abrir(); set("edNovoNome", "Horas"); modo("sem");
    for (const h of ["0", "81", "abc", "", "12.5"]) {
      set("edNovoHoras", h);
      const antes = total();
      ok((await criar()) === null && total() === antes && api.$("edNovoHorasErro").textContent === api.t("ed_novo_e_horas") && foco === "edNovoHoras", "D6a horas '" + h + "' e' recusado");
    }
    set("edNovoHoras", "35");
    const e = await criar();
    ok(e && api.lerEdital(e.texto).cfg.horas === 35, "D6b 35 horas entra no cabecalho");
    abrir(); set("edNovoNome", "Duas Fases"); modo("data"); set("edNovoProva", FUTURA);
    api.$("edNovoF2On").checked = true; api.$("edNovoF2On").onchange();
    ok(api.$("edNovoF2cx").hidden === false, "D6c com a data conhecida o interruptor mostra a 2a fase");
    ok((await criar()) === null && api.$("edNovoF2Erro").textContent === api.t("ed_novo_e_f2") && foco === "edNovoF2Prova", "D6d 2a fase ligada sem data: erro");
    set("edNovoF2Prova", FUTURA);
    ok((await criar()) === null && api.$("edNovoF2Erro").textContent === api.t("ed_novo_e_f2_ordem"), "D6e 2a fase no MESMO dia (ou antes) da primeira: erro");
    set("edNovoF2Prova", (ano + 2) + "-06-20"); set("edNovoF2Nome", "discursiva");
    const e2 = await criar();
    const r2 = api.lerEdital(e2.texto);
    ok(e2 && r2.cfg.fase2 && r2.cfg.fase2.prova === (ano + 2) + "-06-20", "D6f 2a fase valida entra: " + JSON.stringify(r2.cfg.fase2));
  }

  /* ---- D8: as tres respostas formam UM grupo de radios (o navegador desmarca as outras sozinho) ---- */
  {
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const radios = html.match(/<input type="radio" name="edNovoDataModo" id="edNovoModo(?:Data|Sem|Pre)"/g) || [];
    ok(radios.length === 3, "D8a as tres respostas da data compartilham o name='edNovoDataModo': " + radios.length);
    ok(/<input type="radio"[^>]*id="edNovoModoData"[^>]*value="data"/.test(html) && /id="edNovoModoSem"[^>]*value="sem"/.test(html) && /id="edNovoModoPre"[^>]*value="pre"/.test(html), "D8b e cada uma tem o seu valor");
  }

  /* ---- D7: mudar de resposta nao apaga o que foi digitado ---- */
  {
    abrir(); set("edNovoNome", "Troca"); modo("data"); set("edNovoProva", FUTURA);
    modo("sem");
    ok(api.$("edNovoDataCampo").hidden === true, "D7a trocar para 'sem data' esconde o campo");
    modo("data");
    ok(api.$("edNovoProva").value === FUTURA && api.$("edNovoDataCampo").hidden === false, "D7b voltar para 'tenho a data' encontra a data ainda la");
    ok(api.$("edNovoModoSem").checked === false && api.hubNovoModo() === "data", "D7c so' uma resposta marcada por vez");
    abrir();
    ok(api.hubNovoModo() === "" && api.$("edNovoProva").value === "" && api.$("edNovoNome").value === "", "D7d abrir de novo limpa tudo");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
