/* =====================================================================
 * CORRIGIR COM A IA OS JULGADOS COM PENDÊNCIA (v18.62.0)
 *
 * Os casos reais do backup de 17/10: a tese "de memória" do Tema 962 do
 * STJ era paráfrase ("não pode atingir o sócio-gerente que não exercia a
 * administração..."), a Súmula 160 trocou "Município" por "Poder
 * Executivo", e a SV 50 estava guardada duas vezes. O app pede à IA o
 * texto OFICIAL, mostra o antes × depois, só grava com aceite, guarda a
 * tese antiga e tem desfazer. O selo "de memória" FICA (a IA também erra)
 * até a pessoa clicar em ✓ conferi; a ficha diz "corrigido pela IA em".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const D = "Direito Tributário", T = "Responsabilidade tributária";
  const T962_MEM = "O redirecionamento da execução fiscal, quando fundado na dissolução irregular da pessoa jurídica executada ou na presunção de sua ocorrência, não pode atingir o sócio-gerente que não exercia a administração da sociedade à época da dissolução.";
  const T962_OF = "O redirecionamento da execução fiscal, quando fundado na dissolução irregular da pessoa jurídica executada ou na presunção de sua ocorrência, não pode ser autorizado contra o sócio ou o terceiro não sócio que, embora exercesse poderes de gerência ao tempo do fato gerador, sem incorrer em prática de atos com excesso de poderes ou infração à lei, ao contrato social ou aos estatutos, dele regularmente se retirou e não deu causa à sua posterior dissolução irregular, conforme art. 135, III, do CTN.";
  const S160_MEM = "É defeso ao Poder Executivo atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária.";
  const S160_OF = "É defeso, ao Município, atualizar o IPTU, mediante decreto, em percentual superior ao índice oficial de correção monetária.";
  const montar = () => {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(D, T);
    const g = (dados) => { const j = api.jurGravar(dados); api.jurLigar(j.id, ch, D, T); return api.jurDe(j.id); };
    const t962 = g({ tribunal: "STJ", classe: "Tema", numero: "962", tese: T962_MEM, deMemoria: true, certeza: "media" });
    const s160 = g({ tribunal: "STJ", classe: "Súmula", numero: "160", tese: S160_MEM, deMemoria: true, aConferir: ["data", "orgao"] });
    const ok435 = g({ tribunal: "STJ", classe: "Súmula", numero: "435", tese: "Presume-se dissolvida irregularmente a empresa que deixar de funcionar no seu domicílio fiscal, sem comunicação aos órgãos competentes, legitimando o redirecionamento da execução fiscal para o sócio-gerente." });
    const sv50a = g({ tribunal: "STF", classe: "Súmula Vinculante", numero: "50", tese: "Norma legal que altera o prazo de recolhimento de obrigação tributária não se sujeita ao princípio da anterioridade." });
    const sv50b = api.jurGravar({ id: "sv50b", tribunal: "STF", classe: "Súmula Vinculante", numero: "50", tese: "Norma que altera prazo de recolhimento não se sujeita à anterioridade.", topicos: [api.matChave(D, "Princípios")] });
    return { api, t962, s160, ok435, sv50a, sv50b };
  };
  const resposta = (o) => JSON.stringify({ julgados: [
    { id: o.t962.id, tese_oficial: T962_OF, tese_confere: "nao", data: "2021-11-24", orgao: "Primeira Seção", fonte: "Tema 962, STJ — página de repetitivos", certeza: "alta", explicacao: "A tese guardada era paráfrase." },
    { id: o.s160.id, tese_oficial: S160_OF, tese_confere: "nao", data: "1996-06-13", orgao: "Primeira Seção", fonte: "Súmula 160, STJ", certeza: "alta", explicacao: "Trocou Município por Poder Executivo." },
    { id: "inventado", tese_oficial: "x" },
  ] });

  /* C1: as pendências e o pedido */
  {
    const o = montar();
    const { api } = o;
    ok(api.jurPendencias(o.t962).join() === "memoria" && api.jurPendencias(o.s160).join() === "memoria,conferir" && api.jurPendencias(o.ok435).length === 0,
       "C1 pendências: de memória, campos a conferir; o conferido não tem: " + JSON.stringify([api.jurPendencias(o.t962), api.jurPendencias(o.s160)]));
    ok(api.jurPendencias(o.sv50a).indexOf("repetido") >= 0 && api.jurPendencias(api.jurDe("sv50b")).indexOf("repetido") >= 0, "C1a a SV 50 guardada duas vezes é 'repetido' (mesmo em tópicos diferentes)");
    ok(api.jurComPendencia().length === 4, "C1b quatro com pendência (962, 160, as duas SV 50): " + api.jurComPendencia().map((j) => j.numero).join());
    const p = api.jurCorrecaoPedido([o.t962, o.s160]);
    ok(p.indexOf("id: " + o.t962.id) >= 0 && /STJ Tema 962/.test(p) && p.indexOf(T962_MEM) >= 0 && /memória de uma IA/.test(p) && /a conferir: data, orgao/.test(p),
       "C1c o pedido leva id, identidade, a tese guardada, a origem de memória e os campos a conferir");
    ok(/EXATAMENTE como está na fonte oficial/.test(p) && /NÃO INVENTE/.test(p) && /"tese_oficial"/.test(p) && /"julgados"/.test(p), "C1d o pedido exige o texto oficial copiado, sem inventar, e o JSON");
  }

  /* C2: a leitura — antes × depois de cada campo */
  {
    const o = montar();
    const { api } = o;
    const r = api.jurCorrecaoLer(resposta(o), [o.t962, o.s160]);
    ok(r.est === "ok" && r.itens.length === 2 && r.fora === 1, "C2 lê os 2 do pedido e ignora o id inventado");
    const i962 = r.itens.find((x) => x.id === o.t962.id);
    const campos = i962.mudancas.map((m) => m.campo).join();
    ok(campos === "tese,data,orgao,fonte" && i962.marcado === true && i962.mudancas[0].antes === T962_MEM && i962.mudancas[0].depois === T962_OF,
       "C2a o 962: tese, data, órgão e fonte mudam, com o antes e o depois: " + campos);
    const baixa = api.jurCorrecaoLer(JSON.stringify([{ id: o.t962.id, tese_oficial: T962_OF, certeza: "baixa" }]), [o.t962]).itens[0];
    ok(baixa.marcado === false && baixa.mudancas.length === 1, "C2b certeza baixa vem DESMARCADA");
    const igual = api.jurCorrecaoLer(JSON.stringify([{ id: o.ok435.id, tese_oficial: "  " + o.ok435.tese + " ", tese_confere: "sim", certeza: "alta" }]), [o.ok435]).itens[0];
    ok(igual.mudancas.length === 0 && igual.marcado === false && igual.confere === "sim", "C2c tese igual (só espaços diferentes) não é mudança");
    const ruim = api.jurCorrecaoLer(JSON.stringify([{ id: o.t962.id, tese_oficial: "", data: "24/11/2021", tese_confere: "talvez" }]), [o.t962]).itens[0];
    ok(ruim.mudancas.length === 0 && ruim.confere === "nao_sei", "C2d tese vazia não apaga a guardada; data fora do formato é ignorada; 'confere' desconhecido = nao_sei");
    ok(api.jurCorrecaoLer("```json\n" + resposta(o) + "\n```", [o.t962]).est === "ok" && api.jurCorrecaoLer("nada", [o.t962]).est === "erro" && api.jurCorrecaoLer("", [o.t962]).est === "vazio",
       "C2e cerca de markdown aceita; texto sem JSON = erro; vazio = vazio");
    ok(api.jurCorrecaoLer(JSON.stringify([{ id: o.t962.id, certeza: "média", orgao: "Primeira Seção" }]), [o.t962]).itens[0].certeza === "media", "C2f 'média' com acento vale");
  }

  /* C3: aplicar — tese antiga guardada, selo de memória FICA, desfazer volta tudo */
  {
    const o = montar();
    const { api } = o;
    const r = api.jurCorrecaoLer(resposta(o), [o.t962, o.s160]);
    const rec = api.jurCorrecaoAplicar(r.itens, "2026-10-17");
    const A = api.jurDe(o.t962.id), S = api.jurDe(o.s160.id);
    ok(rec.length === 2 && A.tese === T962_OF && A.teseAnterior === T962_MEM && A.data === "2021-11-24" && A.orgao === "Primeira Seção" && /repetitivos/.test(A.fonte),
       "C3 o 962 recebe a tese oficial, data, órgão e fonte; a paráfrase fica em teseAnterior");
    ok(A.deMemoria === true && A.certeza === "media" && S.deMemoria === true && S.aConferir.join() === "data,orgao", "C3a o selo 'de memória' e os campos a conferir CONTINUAM (a pessoa confere)");
    ok(A.corrigidoIA === "2026-10-17" && /paráfrase/.test(A.corrigidoNota) && /certeza alta/.test(A.corrigidoNota) && S.tese === S160_OF, "C3b grava quando a IA corrigiu, com a explicação, a fonte e a certeza");
    const desm = api.jurCorrecaoLer(resposta(o), [o.t962]).itens.map((x) => Object.assign(x, { marcado: false }));
    ok(api.jurCorrecaoAplicar(desm, "2026-10-17").length === 0, "C3c desmarcado não grava");
    api.jurAtualDesfazer(rec);
    const A2 = api.jurDe(o.t962.id);
    ok(A2.tese === T962_MEM && !A2.teseAnterior && !A2.corrigidoIA && !A2.data && !A2.orgao && A2.deMemoria === true, "C3d desfazer volta tudo ao que era");
  }

  /* C4: a tela da biblioteca */
  {
    const o = montar();
    const { api } = o;
    api.jurBibAbrir();
    ok(/Corrigir com IA · 4/.test(api.$("btnJurBibCorrigir").textContent) && api.$("btnJurBibCorrigir").disabled === false, "C4 o botão diz quantos têm pendência: " + api.$("btnJurBibCorrigir").textContent);
    api.$("btnJurBibCorrigir").onclick();
    ok(api.$("jurBibAtual").hidden === false && /4 julgado/.test(api.$("jurBibAtualIntro").textContent) && /Tema 962 \(de memória\)/.test(api.$("jurBibAtualIntro").textContent) && /continua até você clicar/.test(api.$("jurBibAtualIntro").textContent),
       "C4a o painel abre no modo corrigir, diz quais e por quê, e avisa que o selo fica: " + api.$("jurBibAtualIntro").textContent);
    const unir = api.$("jurBibAtualPrev").querySelectorAll(".jur-corr-rep");
    ok(unir.length === 1 && /Súmula Vinculante 50 está guardado duas vezes/.test(unir[0].textContent), "C4b o repetido aparece uma vez, com 'unir'");
    api.$("btnJurBibAtualPedido").onclick();
    const ped = api.$("jurBibAtualPedidoTxt").value;
    ok(/EXATAMENTE/.test(ped) && ped.indexOf(o.t962.id) >= 0 && ped.indexOf(o.ok435.id) < 0, "C4c o pedido é o de correção e só leva os pendentes");
    api.$("jurBibAtualResp").value = resposta(o); api.$("jurBibAtualResp").oninput();
    ok(/2 resposta\(s\): 2 com correção/.test(api.$("jurBibAtualSem").textContent) && api.$("btnJurBibAtualAplicar").textContent === "Aplicar 2 correção(ões)",
       "C4d semáforo e botão: " + api.$("jurBibAtualSem").textContent + " | " + api.$("btnJurBibAtualAplicar").textContent);
    const itens = api.$("jurBibAtualPrev").querySelectorAll(".jur-corr-item");
    ok(itens.length === 2 && itens[0].querySelectorAll(".jur-atual-antes").length === 4 && /Tese — antes/.test(itens[0].textContent) && /não pode ser autorizado/.test(itens[0].textContent),
       "C4e a prévia mostra cada campo com antes e depois");
    ok(api.$("jurCorrCk_0").checked === true && api.$("jurCorrCk_1").checked === true, "C4e2 as caixas nascem como o app marcou");
    api.$("jurCorrCk_1").checked = false; api.$("jurCorrCk_1").onchange();
    ok(api.$("btnJurBibAtualAplicar").textContent === "Aplicar 1 correção(ões)", "C4f desmarcar tira da conta");
    api.$("btnJurBibAtualAplicar").onclick();
    ok(api.jurDe(o.t962.id).tese === T962_OF && api.jurDe(o.s160.id).tese === S160_MEM && /1 julgado\(s\) corrigidos \(1 tese/.test(api.$("jurBibAtualFeito").textContent),
       "C4g aplica só o marcado: " + api.$("jurBibAtualFeito").textContent);
    api.$("btnJurBibAtualDesfazer").onclick();
    ok(api.jurDe(o.t962.id).tese === T962_MEM, "C4h desfazer pela tela");
    /* certeza baixa: a caixa nasce DESMARCADA na tela (o que se vê é o que conta) */
    api.$("jurBibAtualResp").value = JSON.stringify([{ id: o.t962.id, tese_oficial: T962_OF, certeza: "baixa" }]); api.$("jurBibAtualResp").oninput();
    ok(api.$("jurCorrCk_0").checked === false && api.$("btnJurBibAtualAplicar").disabled === true, "C4h2 certeza baixa: caixa desmarcada e nada a aplicar");
    /* unir os repetidos, sem IA */
    const bU = api.$("jurBibAtualPrev").querySelectorAll(".jur-corr-rep")[0].querySelectorAll("button")[0];
    bU.onclick();
    const sv = api.jurLista().filter((j) => j.numero === "50");
    ok(sv.length === 1 && sv[0].topicos.length === 2 && /Norma legal que altera/.test(sv[0].tese) && /unido/.test(api.$("jurBibAtualFeito").textContent) && api.$("jurBibAtualPrev").querySelectorAll(".jur-corr-rep").length === 0,
       "C4i 'unir' deixa um só (a tese mais completa), com os dois tópicos, e o aviso some");
  }

  /* C5: a gaveta do tópico e a ficha */
  {
    const o = montar();
    const { api } = o;
    api.jurAbrir(D, T, "ler");
    const b = api.$("btnJurCorrigirIA");
    ok(b.hidden === false && /· 3/.test(b.textContent), "C5 a gaveta oferece corrigir os 3 pendentes do tópico (a outra SV 50 está em outro tópico): " + b.textContent);
    await b.onclick();
    /* (v18.96.0) abre o fluxo único "Conferir julgados" só com os 3 pendentes do tópico (sem catálogo no teste: passo 1
     * avisa e oferece seguir sem ele) */
    ok(api.$("dlgJurAud").open !== false && api.jurAudAtual().ids.length === 3 && api.$("btnJurAudSeguir").hidden === false,
      "C5a abre o fluxo único só com os 3 do tópico: " + JSON.stringify(api.jurAudAtual().ids.length));
    api.jurAudPassoRepetidos();
    api.$("btnJurAudIA").onclick();
    const intro = api.$("jurBibAtualIntro").textContent;
    ok(/3 julgado/.test(intro) && !/435/.test(intro) && api.jurAtualCtxAtual().modo === "unico", "C5a1 sem catálogo, os 3 seguem para a IA num pedido só: " + intro);
    api.jurCorrecaoAplicar(api.jurCorrecaoLer(resposta(o), [o.t962]).itens, "2026-10-17");
    api.jurAbrir(D, T, "ler");
    const notas = api.$("jurLista").querySelectorAll(".jur-corrigido-ia");
    ok(notas.length === 1 && /Corrigido pela IA em 17\/10\/2026/.test(notas[0].textContent) && /repetitivos/.test(notas[0].textContent), "C5b a ficha diz quando a IA corrigiu e com que fonte");
    ok(api.$("jurLista").querySelectorAll(".jur-mem").length === 2, "C5c o selo 'de memória' continua nos dois");
    /* sem pendências, o botão some */
    const { api: api2 } = rodar();
    api2.matIniciar();
    const j = api2.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "1", tese: "Tese." });
    api2.jurLigar(j.id, api2.matChave(D, T), D, T);
    api2.jurAbrir(D, T, "ler");
    ok(api2.$("btnJurCorrigirIA").hidden === true, "C5d sem pendência, sem botão");
  }

  /* C6: textos nos dois idiomas */
  {
    const { api } = rodar();
    ["jur_corrigir_prompt", "jur_corrigir_intro", "jur_corrigir_btn", "jur_corrigir_btn_aj", "jur_pend_memoria", "jur_pend_conferir", "jur_pend_repetido", "jur_corrigir_aplicar", "jur_corrigir_feito", "jur_corrigir_sem_ok",
      "jur_corrigir_conf_sim", "jur_corrigir_conf_nao", "jur_corrigir_conf_nao_sei", "jur_corrigir_campo_tese", "jur_corrigir_campo_data", "jur_corrigir_campo_orgao", "jur_corrigir_campo_fonte", "jur_corrigir_antes", "jur_corrigir_depois",
      "jur_corrigir_nada", "jur_corrigir_nada_ok", "jur_corrigir_repetido", "jur_corrigir_unir", "jur_corrigir_unido", "jur_corrigido_ia"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "C6 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
