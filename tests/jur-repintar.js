/* =====================================================================
 * OS JULGADOS CHEGAM DEPOIS DO RESUMO ABERTO (v19.12.1)
 *
 * O CASO (visto ao verificar a 19.6.0): logo depois de abrir o app, os julgados ainda vêm do IndexedDB; um resumo
 * aberto nesse instante desenhava as citações de julgado como "não guardado" — e ficava assim até ser reaberto,
 * porque o aviso de "chegaram os julgados" (jurRepintarTelas) redesenhava a agenda e a lista, não a leitura aberta.
 *
 * O QUE PRECISA SER VERDADE: com a leitura aberta, jurRepintarTelas a redesenha (e o link passa a achar o julgado);
 * no modo editar, não mexe no texto que se está escrevendo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api } = rodar();
  api.matIniciar();
  const ch = api.matChave("Direito Tributário", "Responsabilidade");
  api.matGravar(ch, "* O inadimplemento não gera responsabilidade do sócio (Súmula 430 do STJ).", { disciplina: "Direito Tributário", topico: "Responsabilidade" });
  api.matAbrirEditor({ disciplina: "Direito Tributário", nome: "Responsabilidade" }, true);
  const link = () => api.$("matLeitura").querySelectorAll("button.jur-cit-link")[0];
  ok(link() && /jur-cit-sem/.test(link().className), "R0 antes de os julgados chegarem: 'não guardado'");
  /* os julgados chegam (sem passar pela tela — como a leitura do IndexedDB) */
  api.jurGravar({ tribunal: "STJ", classe: "Súmula", numero: "430", tese: "O inadimplemento da obrigação tributária pela sociedade não gera, por si só, a responsabilidade solidária do sócio-gerente." });
  ok(/jur-cit-sem/.test(link().className), "R0a (sem o aviso, a leitura continua velha)");
  api.jurRepintarTelas();
  ok(link() && !/jur-cit-sem/.test(link().className), "R1 o aviso redesenha a leitura aberta: o link acha o julgado");
  /* no modo editar, o texto em edição não é tocado */
  api.matTrocarModo("editar");
  api.$("matTexto").value = "texto que estou escrevendo agora";
  api.jurRepintarTelas();
  ok(api.$("matTexto").value === "texto que estou escrevendo agora", "R2 editando, nada muda no que se escreve");
  return falhas;
}

module.exports = { testes };
