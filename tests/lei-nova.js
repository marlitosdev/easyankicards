/* =====================================================================
 * INCLUIR LEI EM 3 PASSOS (v19.2.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "＋ Nova lei" abre o assistente no passo 1; sem a lei principal não se avança;
 *  2. a lei principal (arquivo ou colar) mostra o que foi reconhecido — e avisa se parece uma lei que ALTERA;
 *  3. as leis que alteram entram em ordem de data, saem com ✕, e "Pular" quando não há;
 *  4. o passo 3 resume, e "Criar e conferir" usa o motor de sempre: a lei nasce sem tópico e a fila começa;
 *  5. cada tela de conferência mostra a faixa "etapa X de N", com ✓ ▶ ○, e ela some ao terminar ou parar.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const tique = () => new Promise((r) => setImmediate(r));
  const PRINC = "LEI COMPLEMENTAR Nº 015, DE 05 DE JANEIRO DE 2009\nInstitui o Código Tributário do Município.\nArt. 1º Este Código regula os tributos municipais.\nArt. 2º Os tributos são impostos, taxas e contribuições.\nArt. 3º O sujeito ativo é o Município.";
  const alt = (n, data, ano) => "LEI COMPLEMENTAR Nº " + n + ", DE " + data + "\nAltera a Lei Complementar nº 015, de 05 de janeiro de 2009.\n"
    + "Art. 1º O art. 3º da Lei Complementar nº 015, de 05 de janeiro de 2009, passa a vigorar com a seguinte redação:\n“Art. 3º O sujeito ativo é o Município de Caruaru (" + ano + ").” (NR)\nArt. 2º Esta Lei entra em vigor na data de sua publicação.";
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    return api;
  };
  const faixa = (api, id) => (api.$(id).hidden ? "" : api.$(id).textContent);

  /* ---- 1 ---- */
  {
    const api = montar();
    api.leiBibAbrir();
    api.$("btnLeiBibNova").onclick();
    ok(api.$("dlgLeiNova").open && !api.$("leiNovaS1").hidden && api.$("leiNovaS2").hidden && api.$("leiNovaS3").hidden && /atual/.test(api.$("leiNovaP1").className),
      "N1 '＋ Nova lei' abre o assistente no passo 1");
    ok(api.$("btnLeiNovaAvancar").disabled === true && api.$("btnLeiNovaVoltar").hidden === true, "N1a sem a lei principal, Avançar fica desligado");
    ok(api.leiNovaIr(2) === false && /Primeiro escolha o arquivo/.test(api.$("leiNovaMsg").textContent), "N1b e pular o passo é recusado, dizendo por quê");
  }

  /* ---- 2 e 3 e 4 ---- */
  {
    const api = montar();
    api.leiBibAbrir();
    api.$("btnLeiBibNova").onclick();
    api.$("btnLeiNovaColar").onclick();
    ok(api.$("leiNovaColarCx").hidden === false, "N2 'ou colar o texto' abre a caixa");
    api.$("leiNovaTexto").value = PRINC;
    api.$("btnLeiNovaColarOk").onclick();
    const card = api.$("leiNovaPrinc").textContent;
    ok(!api.$("leiNovaPrinc").hidden && /Reconheci/.test(card) && /015/.test(card) && /3 artigo/.test(card) && !/ALTERA outra/.test(card),
      "N2a o que foi reconhecido aparece (nome e artigos): " + card);
    ok(api.$("btnLeiNovaAvancar").disabled === false, "N2b com a principal, Avançar liga");
    api.$("btnLeiNovaAvancar").onclick();
    ok(!api.$("leiNovaS2").hidden && api.$("leiNovaS1").hidden && /feito/.test(api.$("leiNovaP1").className), "N3 passo 2");
    ok(/Pular/.test(api.$("btnLeiNovaAvancar").textContent) && !api.$("leiNovaAltsVazio").hidden, "N3a sem alteradoras, o botão diz 'Pular — não há'");
    /* duas alteradoras, fora de ordem; e uma terceira tirada com ✕ */
    [alt("112", "09 DE JUNHO DE 2023", "2023"), alt("95", "28 DE SETEMBRO DE 2022", "2022"), alt("145", "23 DE DEZEMBRO DE 2024", "2024")].forEach((tx) => {
      api.$("btnLeiNovaAltColar").onclick();
      api.$("leiNovaAltTexto").value = tx;
      api.$("btnLeiNovaAltColarOk").onclick();
    });
    const itens = () => api.$("leiNovaAlts").querySelectorAll("li").map((li) => li.textContent);
    ok(itens().length === 3 && /95/.test(itens()[0]) && /112/.test(itens()[1]) && /145/.test(itens()[2]), "N3b em ordem de data: " + itens().join(" | "));
    api.$("btnLeiNovaAltTirar_2").onclick();
    ok(itens().length === 2 && !itens().some((x) => /145/.test(x)) && /Avançar/.test(api.$("btnLeiNovaAvancar").textContent), "N3c ✕ tira da lista");
    api.$("btnLeiNovaAvancar").onclick();
    const res = api.$("leiNovaResumo").textContent;
    ok(!api.$("leiNovaS3").hidden && /Vou criar/.test(res) && /015/.test(res) && /95/.test(res) && /112/.test(res) && api.$("btnLeiNovaCriar").hidden === false,
      "N4 o passo 3 resume o que vai acontecer: " + res);
    api.$("btnLeiNovaCriar").onclick();
    for (let i = 0; i < 4; i++) await tique();
    const lei = api.leisLista().find((l) => /Município/.test(l.texto || ""));
    ok(lei && Array.isArray(lei.topicos) && lei.topicos.length === 0, "N4a a lei nasce na biblioteca, sem tópico");
    ok(api.$("dlgLeiAtualizar").open && /Altera a Lei Complementar nº 015/.test(api.$("leiUpdTexto").value) && /95/.test(api.$("leiUpdTexto").value),
      "N4b a fila começa pela mais antiga (LC 95)");
    const fx = faixa(api, "leiNovaFaixaUpd");
    ok(/etapa 4 de 5/.test(fx) && /✓ Limpeza do texto/.test(fx) && /✓ Criar a lei/.test(fx) && /▶ /.test(fx) && /○ /.test(fx),
      "N5 a tela da lei que altera mostra a faixa: etapa 4 de 5, com ✓ ▶ ○: " + fx);
    ok(api.leiNovaCtxAtual() && /^alt:/.test(api.leiNovaCtxAtual().faixa.etapa), "N5a a etapa é a da alteradora");
    /* parar a fila: a faixa some */
    api.$("btnLeiUpdFilaParar").onclick();
    ok(api.leiNovaCtxAtual() === null && api.$("leiNovaFaixaUpd").hidden === true, "N5b parar a fila encerra o assistente e a faixa some");
  }

  /* ---- 5: a faixa na conferência dos repetidos ---- */
  {
    const api = montar();
    api.leiNovaAbrir();
    api.leiNovaDefinirPrincipal(PRINC + "\nArt. 3º O sujeito ativo da obrigação é o Município.", "", "colado", 0);
    api.leiNovaIr(3);
    api.$("btnLeiNovaCriar").onclick();
    for (let i = 0; i < 3; i++) await tique();
    ok(api.$("dlgLeiDup").open && /etapa 2 de 3: Artigos repetidos/.test(faixa(api, "leiNovaFaixaDup")) && /✓ Limpeza do texto/.test(faixa(api, "leiNovaFaixaDup")),
      "N5c a conferência dos repetidos mostra a faixa (etapa 2 de 3): " + faixa(api, "leiNovaFaixaDup"));
    ok(api.$("leiNovaFaixaPre").hidden === true || !api.$("dlgLeiPre").open, "N5d só a tela aberta importa");
    { const c = api.leiDupCtxAtual(); c.grupos.forEach((g) => { c.decisoes[g.num] = { manter: g.candidatos[g.candidatos.length - 1].indice }; }); }
    api.leiDupConfirmar();
    for (let i = 0; i < 3; i++) await tique();
    ok(api.leiNovaCtxAtual() === null && api.leisLista().some((l) => /Município/.test(l.texto || "")), "N5e criada sem alteradoras, o assistente termina");
  }

  /* ---- 5f: a faixa na limpeza do texto ---- */
  {
    const api = montar();
    api.leiNovaAbrir();
    api.leiNovaDefinirPrincipal(PRINC + "\nArt . 4º Quarta regra sobre os tributos.", "", "colado", 0);
    api.leiNovaIr(3);
    api.$("btnLeiNovaCriar").onclick();
    for (let i = 0; i < 3; i++) await tique();
    ok(api.$("dlgLeiPre").open && /etapa 1 de 3: Limpeza do texto/.test(faixa(api, "leiNovaFaixaPre")) && /○ Criar a lei/.test(faixa(api, "leiNovaFaixaPre")),
      "N5f a limpeza do texto mostra a faixa (etapa 1 de 3): " + faixa(api, "leiNovaFaixaPre"));
  }

  /* ---- 5g: voltou dos repetidos para revisar o texto e gravou de novo: a faixa volta à limpeza ---- */
  {
    const api = montar();
    api.leiNovaAbrir();
    api.leiNovaDefinirPrincipal(PRINC + "\nArt. 3º O sujeito ativo da obrigação é o Município.", "", "colado", 0);
    api.leiNovaIr(3);
    api.$("btnLeiNovaCriar").onclick();
    for (let i = 0; i < 3; i++) await tique();
    ok(/etapa 2 de 3/.test(faixa(api, "leiNovaFaixaDup")), "N5g (antes) nos repetidos");
    api.leiDupCancelar();
    api.$("leiTexto").value += "\nArt . 9º Nona regra.";
    api.leiGravar();
    for (let i = 0; i < 3; i++) await tique();
    ok(api.$("dlgLeiPre").open && /etapa 1 de 3: Limpeza do texto/.test(faixa(api, "leiNovaFaixaPre")),
      "N5g voltou e gravou de novo: a faixa volta à limpeza: " + faixa(api, "leiNovaFaixaPre"));
  }

  /* ---- 2a: a principal que parece alteradora ---- */
  {
    const api = montar();
    api.leiNovaAbrir();
    api.leiNovaDefinirPrincipal(alt("95", "28 DE SETEMBRO DE 2022", "2022"), "", "colado", 0);
    ok(/ALTERA outra/.test(api.$("leiNovaPrinc").textContent), "N2c avisa quando a 'principal' parece uma lei que altera: " + api.$("leiNovaPrinc").textContent);
  }

  /* ---- 2b: pelo arquivo ---- */
  {
    const api = montar();
    api.leiNovaAbrir();
    const html = "<html><body><p>LEI COMPLEMENTAR Nº 015, DE 05 DE JANEIRO DE 2009</p><p>Art. 1º Este Código regula os tributos municipais.</p><p>Art. 2º Os tributos são impostos.</p></body></html>";
    const bytes = new TextEncoder().encode(html);
    const okArq = await api.leiNovaArquivoPrincipal({ name: "lc15.htm", type: "text/html", arrayBuffer: async () => bytes.buffer });
    ok(okArq && /de: lc15\.htm/.test(api.$("leiNovaPrinc").textContent) && /2 artigo/.test(api.$("leiNovaPrinc").textContent),
      "N2d o arquivo .htm vira a principal, dizendo de onde veio: " + api.$("leiNovaPrinc").textContent);
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["lei_nova_titulo", "lei_nova_p1", "lei_nova_p2", "lei_nova_p3", "lei_nova_faixa", "lei_nova_criar", "lei_nova_pular", "lei_nova_s3_aj"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "N6 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
