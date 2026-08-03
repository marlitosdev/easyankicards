# -*- coding: utf-8 -*-
"""
EasyAnkiCards — traduções da interface (pt / en).

Uso:
    import i18n
    i18n.set_language("en")
    i18n.t("deck_label")            -> "Deck:"
    i18n.t("dest_path", path=..., last=...)  -> texto formatado

Manutenção: para adicionar um idioma, copie um dos dicionários de
STRINGS, traduza os valores e acrescente a entrada em LANG_NAMES.
As mensagens do PARSER ficam em core.py (core.set_language).
"""

LANG = "pt"

LANG_NAMES = {"pt": "Português", "en": "English"}
LANG_BY_NAME = {v: k for k, v in LANG_NAMES.items()}


def set_language(lang):
    global LANG
    if lang in STRINGS:
        LANG = lang


def t(key, **kw):
    s = STRINGS[LANG][key]
    return s.format(**kw) if kw else s


STRINGS = {
# ============================= PORTUGUÊS =============================
"pt": {
"app_title": "EasyAnkiCards",
"brand": "by MarlitosDev",
"collection_title": "Nome de arquivo reservado",
"collection_msg": "\"collection\" é um nome reservado do Anki (indica backup da\ncoleção inteira) e pode confundir a importação.\n\nEscolha outro nome de arquivo — por exemplo, o nome do baralho.",
"deck_label": "Baralho:",
"deck_placeholder": "Nome do baralho no Anki (ex.: Direito::Tributário)",
"deck_tooltip": "Nome do baralho no Anki. Use \"::\" para subpastas.\nReexportar com o mesmo nome ATUALIZA o baralho, sem duplicar.",
"tags_label": "Tags globais:",
"tags_placeholder": "Opcional — aplicadas a todos (ex.: concurso, oab)",
"tags_tooltip": "Tags aplicadas a TODOS os cartões.\nCada linha ainda pode ter tags próprias no 3º campo.",
"help_btn": "?  Ajuda",
"help_tooltip": "Guia completo + prompts prontos para IA (F1).",
"dest_path": "Destino no Anki:  {path}   — pasta \"{last}\", definida por ESTE campo (o nome do arquivo não influencia)",
"dest_root": "Destino no Anki: baralho \"{name}\" na raiz. Dica: use \"::\" para pastas — ex.: TCE PE 2025::Direito Administrativo::Jurisprudência",
"copy_path_btn": "Copiar caminho",
"copy_path_done": "Copiado!",
"copy_path_tooltip": "Copia o caminho completo do baralho (ex.: Curso::Matéria::Tema).\nCole-o no campo Baralho nas PRÓXIMAS exportações: a importação\njá coloca os cartões na pasta certa, sem movê-los depois.",
"copy_path_status": "Caminho copiado — cole no campo Baralho nas próximas exportações.",
"editor_label": "1. Cole o texto — a leitura acontece automaticamente",
"editor_tooltip": "Formato: Frente :: Verso :: tags(opcional)\nCloze: A água ferve a {{c1::100 °C}}.\nLinha em branco separa cartões; # comenta a linha.",
"normalize_btn": "Normalizar texto",
"normalize_tooltip": "Reescreve o editor no formato padrão: um cartão por linha,\nlinha em branco entre cartões, campos na ordem certa.\nLinhas não reconhecidas viram comentários (#) no final.",
"normalize_status": "Texto normalizado: {n} cartões.",
"norm_ignored_header": "# --- Linhas não reconhecidas (corrija e remova o #) ---",
"preview_label": "2. Confira os cartões (laranja = verificar)",
"summary": "{n} cartões ({b} básicos, {c} cloze) | {sel} selecionados para exportar",
"summary_verify": " | {n} para VERIFICAR",
"card_basic": "BÁSICO", "card_cloze": "CLOZE", "card_line": "linha",
"card_verify": "VERIFICAR",
"include_chk": "incluir",
"include_tooltip": "Desmarque para deixar este cartão fora da exportação.",
"ignored_prefix": "IGNORADO — ",
"more_cards": "... e mais {n} cartões (ocultos por desempenho)",
"tags_prefix": "tags: ",
"export_txt_btn": "Exportar .txt",
"export_txt_tooltip": "Arquivo de texto para importar no Anki:\nArquivo > Importar. Configurações já incluídas.",
"export_apkg_btn": "3. Exportar .apkg (recomendado)",
"export_apkg_tooltip": "Pacote pronto: dois cliques no arquivo salvo\ne o Anki importa o baralho sozinho.",
"status_ready": "v{v} — Pronto. F1 abre a ajuda.",
"status_auto": "Leitura automática: {n} cartões.",
"status_selected": "{n} cartão(ões) selecionados para exportar.",
"status_cancel": "Exportação cancelada — revise os cartões laranjas.",
"status_saved": "Salvo: {f}",
"none_title": "Nenhum cartão para exportar",
"none_msg": "Nenhum cartão válido está selecionado.\n\nVerifique o formato ( Pergunta :: Resposta ) e as\ncaixas \"incluir\" na pré-visualização.\nClique em \"? Ajuda\" para ver exemplos.",
"problems_title": "Atenção: {n} possível(is) problema(s)",
"problems_msg": "Há cartões que podem ter saído errados:\n\n{resumo}\n\nEles aparecem em LARANJA na pré-visualização — você pode\ndesmarcar \"incluir\" neles ou corrigir o texto.\n\nDeseja exportar mesmo assim?",
"save_txt_title": "Salvar arquivo de texto para o Anki",
"save_apkg_title": "Salvar pacote do Anki",
"file_type_txt": "Texto Anki", "file_type_apkg": "Pacote Anki",
"txt_done_title": "Arquivo .txt gerado",
"txt_done_msg": "Como importar no Anki:\n\n1. Abra o Anki;\n2. Arquivo > Importar;\n3. Selecione o arquivo salvo;\n4. Importar.\n\nO destino já vai gravado DENTRO do arquivo (coluna de deck):\na pasta é criada automaticamente se não existir.",
"apkg_done_title": "Pacote .apkg gerado",
"apkg_done_msg": "Pronto! Dê DOIS CLIQUES no arquivo salvo e o Anki\nimportará o baralho automaticamente.\n\nDestino no Anki:\n    {dest}\n\nDica: use \"Copiar caminho\" e reutilize o mesmo caminho nas\npróximas exportações — os novos cartões já entrarão nessa\nmesma pasta.",
"genanki_title": "Biblioteca genanki não instalada",
"genanki_msg": "A exportação .apkg precisa da biblioteca genanki.\n\nInstale com:  pip install genanki\n\nEnquanto isso, use \"Exportar .txt\".",
"apkg_err_title": "Erro ao gerar .apkg",
"help_title": "Ajuda — EasyAnkiCards v{v}",
"help_close": "Fechar",
"prompt_full_btn": "Copiar prompt completo",
"prompt_mini_btn": "Copiar prompt curto (NotebookLM)",
"copied": "Copiado!",
"example": "# Exemplo — apague estas linhas e cole seu conteúdo.\n# Formato:  Frente :: Verso :: tags (tags são opcionais)\n# Dica: deixe uma linha em branco entre um cartão e outro.\nO que é o princípio da anterioridade tributária? :: Regra que proíbe cobrar tributos no mesmo exercício financeiro da lei que os instituiu. :: tributario\n\nQual a velocidade da luz? :: Aproximadamente 300.000 km/s. :: fisica\n\nA capital da França é {{c1::Paris}}. :: Geografia básica :: geografia\n",
"prompt_full": "Gere flashcards para Anki a partir do texto que enviarei ao final.\n\nREGRAS DE FORMATO (siga exatamente):\n1. Um cartão por linha, com uma LINHA EM BRANCO entre um cartão e outro.\n2. Formato: Pergunta :: Resposta :: tags\n   - Separe os campos com \" :: \" (dois pontos duplos).\n   - Tags: opcionais, 1 a 3 palavras minúsculas sem espaços (use _), separadas por vírgula.\n3. Cartões de omissão (cloze): envolva o termo a memorizar em {{c1::termo}}. Use c1, c2... para lacunas diferentes. O 2º campo vira observação opcional.\n4. NUNCA use \"::\" dentro do texto (só como separador e dentro de {{c1::...}}).\n5. Cada cartão deve ser curto, autossuficiente e testar UMA única ideia.\n6. Responda SOMENTE com os cartões: sem numeração, marcadores ou comentários.\n\nEXEMPLO DE SAÍDA:\nO que é o princípio da anterioridade tributária? :: Regra que proíbe cobrar tributos no mesmo exercício financeiro da lei que os instituiu. :: tributario\n\nA capital da França é {{c1::Paris}}. :: Geografia básica :: geografia\n\nTEXTO-BASE:\n[cole aqui o material de estudo]",
"prompt_mini": "Crie flashcards das fontes. Formato obrigatório: um cartão por linha, linha em branco entre cartões, no padrão \"Pergunta :: Resposta :: tags\". Para lacunas use {{c1::termo}}. Nunca use \"::\" dentro do texto. Cartões curtos, uma ideia por cartão. Responda só com os cartões, sem numeração nem comentários.",
"help_text": """EASYANKICARDS — COMO USAR

1) COLE O TEXTO (painel da esquerda)
   Um cartão por linha:  Pergunta :: Resposta :: tags
   • Separador: "::". O 3º campo (tags) é opcional.
   • Linhas iniciadas com "#" são ignoradas.
   • HTML permitido: <b>negrito</b>, <i>itálico</i>.

2) CARTÕES DE OMISSÃO (CLOZE)
   A capital da França é {{c1::Paris}}.
   • c1, c2... criam lacunas diferentes na mesma frase.
   • Verso extra e tags: Texto {{c1::x}} :: Observação :: tag

3) COLANDO TEXTO DE PDF / WORD / IA
   O app tolera quebras de linha no meio do cartão e
   reorganiza campos deslocados. Garanta com uma LINHA EM
   BRANCO entre cartões. Cartões com aparência de erro ficam
   LARANJAS, com o motivo. "Normalizar texto" reescreve o
   editor já no formato correto.

4) PRÉ-VISUALIZAÇÃO AUTOMÁTICA (direita)
   Atualiza enquanto você digita. Verde = ok; laranja =
   verificar. Desmarque "incluir" para excluir da exportação.

5) BARALHO, SUBPASTAS E TAGS
   • "::" no nome do baralho cria PASTAS no Anki:
     TCE PE 2025::Direito Administrativo::Jurisprudência
     → os cartões entram na pasta "Jurisprudência".
     O destino aparece em tempo real abaixo do campo.
   • "Copiar caminho": reutilize o caminho nas próximas
     exportações e a importação já cai na pasta certa.
   • O NOME DO ARQUIVO (.apkg ou .txt) é só um rótulo: o
     destino é gravado DENTRO do arquivo, pelo campo Baralho.
     Renomear o arquivo NÃO muda a pasta de importação.
     Evite o nome reservado "collection".

6) EXPORTAR
   • .apkg (recomendado): dois cliques e o Anki importa.
     Mesmo nome de baralho = atualiza, não duplica.
   • .txt: Anki > Arquivo > Importar (já pré-configurado).

7) GERANDO CARTÕES COM IA
   • ChatGPT / Claude / Gemini: "Copiar prompt completo".
   • NotebookLM (rejeita prompts longos): "Copiar prompt curto".
   Cole a resposta da IA direto no editor.""",
},
# ============================= ENGLISH =============================
"en": {
"app_title": "EasyAnkiCards",
"brand": "by MarlitosDev",
"collection_title": "Reserved file name",
"collection_msg": "\"collection\" is a reserved Anki name (it means a full collection\nbackup) and can confuse the import.\n\nPick another file name — the deck name, for example.",
"deck_label": "Deck:",
"deck_placeholder": "Deck name in Anki (e.g.: Law::Tax Law)",
"deck_tooltip": "Deck name in Anki. Use \"::\" for subfolders.\nRe-exporting with the same name UPDATES the deck, no duplicates.",
"tags_label": "Global tags:",
"tags_placeholder": "Optional — applied to all cards (e.g.: exam, bar)",
"tags_tooltip": "Tags applied to ALL cards.\nEach line can still have its own tags in the 3rd field.",
"help_btn": "?  Help",
"help_tooltip": "Full guide + ready-to-use AI prompts (F1).",
"dest_path": "Destination in Anki:  {path}   — \"{last}\" folder, set by THIS field (the file name has no effect)",
"dest_root": "Destination in Anki: deck \"{name}\" at root level. Tip: use \"::\" for folders — e.g.: Bar Exam 2025::Administrative Law::Case Law",
"copy_path_btn": "Copy path",
"copy_path_done": "Copied!",
"copy_path_tooltip": "Copies the full deck path (e.g.: Course::Subject::Topic).\nPaste it into the Deck field on FUTURE exports: the import\nwill drop the cards straight into the right folder.",
"copy_path_status": "Path copied — paste it into the Deck field on future exports.",
"editor_label": "1. Paste your text — it is read automatically",
"editor_tooltip": "Format: Front :: Back :: tags(optional)\nCloze: Water boils at {{c1::100 °C}}.\nA blank line separates cards; # comments out a line.",
"normalize_btn": "Normalize text",
"normalize_tooltip": "Rewrites the editor in the standard format: one card per line,\nblank line between cards, fields in the right order.\nUnrecognized lines become comments (#) at the end.",
"normalize_status": "Text normalized: {n} cards.",
"norm_ignored_header": "# --- Unrecognized lines (fix and remove the #) ---",
"preview_label": "2. Review the cards (orange = check)",
"summary": "{n} cards ({b} basic, {c} cloze) | {sel} selected for export",
"summary_verify": " | {n} to CHECK",
"card_basic": "BASIC", "card_cloze": "CLOZE", "card_line": "line",
"card_verify": "CHECK",
"include_chk": "include",
"include_tooltip": "Untick to leave this card out of the export.",
"ignored_prefix": "SKIPPED — ",
"more_cards": "... and {n} more cards (hidden for performance)",
"tags_prefix": "tags: ",
"export_txt_btn": "Export .txt",
"export_txt_tooltip": "Text file to import in Anki:\nFile > Import. Settings already included.",
"export_apkg_btn": "3. Export .apkg (recommended)",
"export_apkg_tooltip": "Ready-made package: double-click the saved file\nand Anki imports the deck by itself.",
"status_ready": "v{v} — Ready. F1 opens help.",
"status_auto": "Auto-read: {n} cards.",
"status_selected": "{n} card(s) selected for export.",
"status_cancel": "Export cancelled — review the orange cards.",
"status_saved": "Saved: {f}",
"none_title": "No cards to export",
"none_msg": "No valid card is selected.\n\nCheck the format ( Question :: Answer ) and the\n\"include\" boxes in the preview.\nClick \"? Help\" for examples.",
"problems_title": "Warning: {n} possible issue(s)",
"problems_msg": "Some cards may have come out wrong:\n\n{resumo}\n\nThey appear in ORANGE in the preview — you can untick\n\"include\" on them or fix the text.\n\nExport anyway?",
"save_txt_title": "Save text file for Anki",
"save_apkg_title": "Save Anki package",
"file_type_txt": "Anki text", "file_type_apkg": "Anki package",
"txt_done_title": ".txt file created",
"txt_done_msg": "How to import in Anki:\n\n1. Open Anki;\n2. File > Import;\n3. Select the saved file;\n4. Import.\n\nThe destination is stored INSIDE the file (deck column):\nthe folder is created automatically if it does not exist.",
"apkg_done_title": ".apkg package created",
"apkg_done_msg": "Done! DOUBLE-CLICK the saved file and Anki\nwill import the deck automatically.\n\nDestination in Anki:\n    {dest}\n\nTip: use \"Copy path\" and reuse the same path on future\nexports — new cards will land in this same folder.",
"genanki_title": "genanki library not installed",
"genanki_msg": ".apkg export needs the genanki library.\n\nInstall with:  pip install genanki\n\nMeanwhile, use \"Export .txt\".",
"apkg_err_title": "Error creating .apkg",
"help_title": "Help — EasyAnkiCards v{v}",
"help_close": "Close",
"prompt_full_btn": "Copy full prompt",
"prompt_mini_btn": "Copy short prompt (NotebookLM)",
"copied": "Copied!",
"example": "# Example — delete these lines and paste your content.\n# Format:  Front :: Back :: tags (tags are optional)\n# Tip: leave a blank line between cards.\nWhat is the principle of tax anteriority? :: Rule forbidding tax collection in the same fiscal year as the law that created it. :: tax\n\nWhat is the speed of light? :: About 300,000 km/s. :: physics\n\nThe capital of France is {{c1::Paris}}. :: Basic geography :: geography\n",
"prompt_full": "Create Anki flashcards from the text I will send at the end.\n\nFORMAT RULES (follow exactly):\n1. One card per line, with a BLANK LINE between cards.\n2. Format: Question :: Answer :: tags\n   - Separate fields with \" :: \" (double colon).\n   - Tags: optional, 1-3 lowercase words without spaces (use _), comma-separated.\n3. Cloze cards: wrap the term to memorize in {{c1::term}}. Use c1, c2... for different blanks. The 2nd field becomes an optional note.\n4. NEVER use \"::\" inside the text (only as separator and inside {{c1::...}}).\n5. Each card must be short, self-contained, and test ONE single idea.\n6. Reply ONLY with the cards: no numbering, bullets or comments.\n\nOUTPUT EXAMPLE:\nWhat is the speed of light? :: About 300,000 km/s. :: physics\n\nThe capital of France is {{c1::Paris}}. :: Basic geography :: geography\n\nSOURCE TEXT:\n[paste your study material here]",
"prompt_mini": "Create flashcards from the sources. Required format: one card per line, blank line between cards, pattern \"Question :: Answer :: tags\". For blanks use {{c1::term}}. Never use \"::\" inside the text. Short cards, one idea each. Reply only with the cards, no numbering or comments.",
"help_text": """EASYANKICARDS — HOW TO USE

1) PASTE YOUR TEXT (left panel)
   One card per line:  Question :: Answer :: tags
   • Separator: "::". The 3rd field (tags) is optional.
   • Lines starting with "#" are ignored.
   • HTML allowed: <b>bold</b>, <i>italic</i>.

2) CLOZE CARDS
   The capital of France is {{c1::Paris}}.
   • c1, c2... create different blanks in the same sentence.
   • Extra back and tags: Text {{c1::x}} :: Note :: tag

3) PASTING FROM PDF / WORD / AI
   The app tolerates line breaks in the middle of a card and
   reorganizes shifted fields. To be safe, leave a BLANK LINE
   between cards. Suspicious cards turn ORANGE with the
   reason. "Normalize text" rewrites the editor in the
   correct format.

4) AUTOMATIC PREVIEW (right panel)
   Updates as you type. Green = ok; orange = check.
   Untick "include" to keep a card out of the export.

5) DECK, SUBFOLDERS AND TAGS
   • "::" in the deck name creates FOLDERS in Anki:
     Bar Exam 2025::Administrative Law::Case Law
     → cards land in the "Case Law" folder.
     The destination shows in real time below the field.
   • "Copy path": reuse the path on future exports and the
     import drops cards straight into the right folder.
   • The FILE NAME (.apkg or .txt) is just a label: the
     destination is stored INSIDE the file, via the Deck field.
     Renaming the file does NOT change the import folder.
     Avoid the reserved name "collection".

6) EXPORT
   • .apkg (recommended): double-click and Anki imports it.
     Same deck name = updates, no duplicates.
   • .txt: Anki > File > Import (pre-configured).

7) GENERATING CARDS WITH AI
   • ChatGPT / Claude / Gemini: "Copy full prompt".
   • NotebookLM (rejects long prompts): "Copy short prompt".
   Paste the AI's reply straight into the editor.""",
},
}
