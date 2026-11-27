/* (19.212.0) JANELAS DE LEI: FECHAR VOLTA PARA A JANELA DE ONDE VEIO
 *
 * O relato: "ao abrir uma nova janela e depois fechá-la não está voltando para a janela anterior, mas sim pra janela
 * inicial do material de estudo". O "＋ Nova lei" e o "Abrir" da biblioteca FECHAVAM a biblioteca antes de abrir a
 * janela nova — fechar a nova não tinha para onde voltar. E a volta do app era uma vaga só.
 *
 *   JL1  "＋ Nova lei" abre o assistente POR CIMA da biblioteca; o ✕ revela a biblioteca (nada fica armado)
 *   JL2  "Abrir" troca a biblioteca pelo leitor; fechar o leitor traz a biblioteca de volta como estava (pasta, busca,
 *        rolagem), com o foco no "Abrir" e "voltou para Biblioteca de leis" no registro
 *   JL3  "mapa e conferência" (⋯ da biblioteca): fechar o mapa revela o leitor; fechar o leitor, a biblioteca
 *   JL4  no leitor, mapa e conferência → fechar → o leitor continua aberto
 *   JL5  "Criar" no assistente: o leitor entra no lugar da biblioteca, e ela volta quando o leitor fecha
 *   JL6  qualquer caminho que abre uma lei com a biblioteca aberta troca a biblioteca (não fica escondida embaixo)
 *   JL7  pilha: Painel → biblioteca → leitor; fechar o leitor volta à biblioteca, fechar a biblioteca volta ao Painel
 *   JL8  o que já estava aberto embaixo não segura a volta: a biblioteca volta por cima dele
 *   JL9  o "📚 biblioteca" do leitor reabre a biblioteca por cima e desarma a volta antiga (ela não volta duas vezes)
 *   JL10 o caminho do diagnóstico: leis do edital → "＋ incluir" a lacuna → criar → procedência → fechar → leitor →
 *        fechar → biblioteca
 *   JL11 o registro da inclusão leva a lei que está entrando, não a última aberta no leitor
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const tique = () => new Promise((r) => setImmediate(r));
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.leiIniciar();
  const $ = api.$;
  const ch = api.matChave("D", "T");
  const TXT = "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Três.\nArt. 4º Quatro.";
  api.leiGuardar({ id: "la", nome: "Lei A", texto: TXT, topicos: [ch] });
  api.leiGuardar({ id: "lb", nome: "Lei B", texto: "Art. 1º Um.\nArt. 2º Dois.", topicos: [] });
  const pilha = () => api.voltarPilhaAtual();
  /* o "close" do navegador chega à captura do documento; aqui o arranjo não dispara eventos: chama o mesmo caminho */
  const fechou = (id) => { const d = $(id); if (d.open) d.close(); api.voltarDialogoFechou(d); };
  const limpar = () => {
    ["dlgLeiMapa", "dlgLeiSeca", "dlgLeiNova", "dlgLeiBib", "dlgPainel", "dlgHoras", "uiModal"].forEach((id) => { if ($(id).open) $(id).close(); });
    while (pilha().length) api.voltarLimpar();
  };
  const regs = () => (api.registroAtual() || []).map((e) => e.tipo + " " + e.msg + " " + (e.extra || ""));

  /* ---- JL1 ---- */
  limpar();
  api.leiBibAbrir();
  $("btnLeiBibNova").onclick();
  ok($("dlgLeiNova").open === true && $("dlgLeiBib").open === true, "JL1 o assistente abre por cima, a biblioteca fica aberta embaixo");
  $("btnLeiNovaX").onclick();
  api.voltarDialogoFechou($("dlgLeiNova"));
  ok($("dlgLeiNova").open === false && $("dlgLeiBib").open === true && pilha().length === 0, "JL1b o ✕ do assistente revela a biblioteca (nada armado)");

  /* ---- JL2 ---- */
  limpar();
  api.leiBibAbrir();
  $("leiBibBusca").value = "Lei";
  api.leiBibPintar();
  $("leiBibLista").scrollTop = 120;
  $("ledCorpo").scrollTop = 80;   /* na vista por disciplina (leis do edital), quem rola é o #ledCorpo */
  const estAntes = api.leiBibEstadoAgora();
  $("btnLeiBibAbrir_la").onclick();
  ok($("dlgLeiBib").open === false && $("dlgLeiSeca").open === true && api.leiIdAtualValor() === "la", "JL2 'Abrir' troca a biblioteca pelo leitor");
  const v = api.voltarAtual();
  ok(v && v.painel === "dlgLeiBib" && v.vigia === $("dlgLeiSeca") && v.foco === "btnLeiBibAbrir_la", "JL2b a volta para a biblioteca fica armada, vigiando o leitor, com o botão de onde saiu: " + (v && [v.painel, v.vigia && v.vigia.id, v.foco].join(" · ")));
  $("leiBibLista").scrollTop = 0; $("ledCorpo").scrollTop = 0; $("leiBibBusca").value = "";
  await api.leiFechar();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiSeca").open === false && $("dlgLeiBib").open === true && pilha().length === 0, "JL2c fechar o leitor traz a biblioteca de volta");
  ok($("leiBibBusca").value === "Lei" && $("leiBibLista").scrollTop === 120 && $("ledCorpo").scrollTop === 80 && api.leiBibEstadoAgora().pasta === estAntes.pasta,
    "JL2d ...como estava: busca '" + $("leiBibBusca").value + "', rolagem " + $("leiBibLista").scrollTop + " / " + $("ledCorpo").scrollTop);
  /* a biblioteca voltou repintada: o "Abrir" é um botão novo, achado pelo id (o focus() do arranjo conta em _focou) */
  ok(($("btnLeiBibAbrir_la")._focou || 0) >= 1, "JL2e o foco volta ao 'Abrir' da lei");
  ok(regs().some((x) => /^PAINEL voltou para Biblioteca de leis ao fechar dlgLeiSeca/.test(x)) && regs().some((x) => /^PAINEL saiu de Biblioteca de leis/.test(x)),
    "JL2f o registro conta a troca e a volta: " + regs().filter((x) => /^PAINEL/.test(x)).slice(-2).join(" | "));

  /* ---- JL3 ---- */
  limpar();
  api.leiBibAbrir();
  $("btnLeiBibMais_la").onclick({ stopPropagation() {} });
  $("btnLeiBibMapa_la").onclick();
  ok($("dlgLeiBib").open === false && $("dlgLeiSeca").open === true && $("dlgLeiMapa").open === true, "JL3 o ⋯ 'mapa e conferência' abre o leitor com o mapa por cima");
  try { api.edMenuFechar(); } catch (e) {}
  $("btnLeiMapaFechar").onclick();
  api.voltarDialogoFechou($("dlgLeiMapa"));
  ok($("dlgLeiMapa").open === false && $("dlgLeiSeca").open === true && $("dlgLeiBib").open === false, "JL3b fechar o mapa revela o leitor (a biblioteca ainda não)");
  await api.leiFechar();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === true && pilha().length === 0, "JL3c fechar o leitor traz a biblioteca");

  /* ---- JL4 ---- */
  limpar();
  api.leiAbrirAvulsa("la");
  api.leiMapaAbrir();
  ok($("dlgLeiMapa").open === true && $("dlgLeiSeca").open === true, "JL4 o mapa abre por cima do leitor");
  $("btnLeiMapaX").onclick();
  api.voltarDialogoFechou($("dlgLeiMapa"));
  ok($("dlgLeiMapa").open === false && $("dlgLeiSeca").open === true && $("dlgLeiBib").open === false, "JL4b fechar o mapa volta ao leitor");
  await api.leiFechar();

  /* ---- JL5 ---- */
  limpar();
  api.leiBibAbrir();
  $("btnLeiBibNova").onclick();
  api.leiNovaDefinirPrincipal("Art. 1º Primeira regra da lei nova.\nArt. 2º Segunda regra da lei nova.", "", "colado", 0);
  api.leiNovaIr(2);
  if ($("leiNovaNome")) { $("leiNovaNome").value = "Lei Nova"; }
  api.leiNovaIr(4);
  $("btnLeiNovaCriar").onclick();
  for (let i = 0; i < 4; i++) await tique();
  const v5 = pilha().find((x) => x.painel === "dlgLeiBib");
  ok($("dlgLeiNova").open === false && $("dlgLeiSeca").open === true && $("dlgLeiBib").open === false && !!v5 && v5.foco === "btnLeiBibNova",
    "JL5 'Criar': o leitor entra no lugar da biblioteca, com a volta armada: " + pilha().map((x) => x.painel).join(","));
  /* o que o fluxo de criar deixou aberto por cima do leitor fecha antes; depois, o leitor */
  ["dlgLeiPre", "dlgLeiDup", "dlgLeiProc", "dlgLeiAtualizar", "uiModal"].forEach((id) => { if ($(id).open) fechou(id); });
  ok($("dlgLeiBib").open === false, "JL5b com o leitor ainda aberto, a biblioteca espera");
  $("dlgLeiSeca").close();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === true && pilha().length === 0, "JL5c fechar o leitor traz a biblioteca de volta");

  /* ---- JL6 ---- */
  limpar();
  api.leiBibAbrir();
  api.leiAbrirAvulsa("lb");
  ok($("dlgLeiBib").open === false && $("dlgLeiSeca").open === true && api.voltarAtual() && api.voltarAtual().painel === "dlgLeiBib",
    "JL6 abrir uma lei por outro caminho, com a biblioteca aberta, também troca a biblioteca (e arma a volta)");
  $("dlgLeiSeca").close();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === true, "JL6b e a biblioteca volta");

  /* ---- JL7 ---- */
  limpar();
  let painelVoltou = 0;
  api.abrirModal("dlgPainel");
  api.painelArmar("dlgPainel", "Painel do edital", () => { painelVoltou++; api.abrirModal("dlgPainel"); });
  api.leiBibAbrir();
  ok(api.voltarAtual() && api.voltarAtual().vigia === $("dlgLeiBib"), "JL7 a biblioteca aberta pelo Painel é a vigiada");
  $("btnLeiBibAbrir_la").onclick();
  ok(pilha().length === 2 && pilha()[0].painel === "dlgPainel" && pilha()[1].painel === "dlgLeiBib",
    "JL7b a troca da biblioteca EMPILHA (não apaga a volta do Painel): " + pilha().map((x) => x.painel).join(" › "));
  await api.leiFechar();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === true && $("dlgPainel").open === false && pilha().length === 1, "JL7c fechar o leitor volta à biblioteca");
  $("btnLeiBibX").onclick();
  api.voltarDialogoFechou($("dlgLeiBib"));
  ok($("dlgPainel").open === true && painelVoltou === 1 && pilha().length === 0, "JL7d fechar a biblioteca volta ao Painel");

  /* ---- JL8 ---- */
  limpar();
  api.abrirModal("dlgHoras");
  api.leiBibAbrir();
  $("btnLeiBibAbrir_la").onclick();
  ok(pilha().length === 1 && pilha()[0].base.indexOf($("dlgHoras")) >= 0, "JL8 o que estava aberto embaixo fica anotado como base");
  await api.leiFechar();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === true && $("dlgHoras").open === true && pilha().length === 0, "JL8b a biblioteca volta por cima do que já estava aberto");

  /* ---- JL9 ---- */
  limpar();
  api.leiBibAbrir();
  $("btnLeiBibAbrir_la").onclick();
  api.leiBibAbrir();   /* o "📚 biblioteca" da gaveta do leitor */
  ok($("dlgLeiBib").open === true && $("dlgLeiSeca").open === true && pilha().length === 0, "JL9 o 📚 do leitor abre a biblioteca por cima e desarma a volta antiga");
  $("btnLeiBibX").onclick();
  api.voltarDialogoFechou($("dlgLeiBib"));
  ok($("dlgLeiSeca").open === true, "JL9b fechar a biblioteca revela o leitor");
  await api.leiFechar();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === false, "JL9c e fechar o leitor não traz a biblioteca de novo");

  /* ---- JL10: o caminho do diagnóstico (26/11 21:40) — leis do edital → "＋ incluir" a lacuna → criar → procedência ---- */
  limpar();
  api.leiBibAbrir();
  let voltaId = "";
  api.leiNovaAbrir({ volta: (id) => { voltaId = id; }, manterBib: true });   /* é o que ledIncluir chama */
  api.leiNovaDefinirPrincipal("LEI Nº 7.516, DE 2 DE JANEIRO DE 2026\nArt. 1º Primeira regra da lei nova.\nArt. 2º Segunda regra.\nArt. 3º Terceira.", "lei7516.pdf", "pdf", 0);
  /* JL11: o registro da inclusão leva a lei NOVA, não a última lei aberta (era "Lei B" ao lado de "lida de …pdf") */
  const linhaLida = api.leiLogTexto().split("\n").filter((x) => /lei principal lida de lei7516\.pdf/.test(x)).pop() || "";
  ok(/\(lei nova: lei7516\.pdf\)/.test(linhaLida) && !/Lei [AB]\b/.test(linhaLida), "JL11 o registro da inclusão diz qual lei está entrando: " + linhaLida);
  api.leiNovaIr(4);
  $("btnLeiNovaCriar").onclick();
  for (let i = 0; i < 6; i++) { await tique(); try { if ($("uiModal").open) api.uiModalResponder(true); } catch (e) {} }
  ok(!!voltaId && $("dlgLeiProc").open === true && $("dlgLeiSeca").open === true && $("dlgLeiBib").open === false
    && pilha().length === 1 && pilha()[0].painel === "dlgLeiBib",
    "JL10 criada a lacuna, a procedência abre sobre o leitor e a biblioteca espera a volta: " + pilha().map((x) => x.painel + "/" + (x.vigia && x.vigia.id)).join(","));
  fechou("dlgLeiProc");
  ok($("dlgLeiSeca").open === true && $("dlgLeiBib").open === false, "JL10b fechar a procedência revela o leitor com a lei nova");
  await api.leiFechar();
  api.voltarDialogoFechou($("dlgLeiSeca"));
  ok($("dlgLeiBib").open === true && pilha().length === 0, "JL10c fechar o leitor volta à biblioteca (não ao Material de estudo)");

  limpar();
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
