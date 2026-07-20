# -*- coding: utf-8 -*-
"""
EasyAnkiCards — aplicativo de desktop (Windows/Linux/macOS).

COMO FUNCIONA (leia antes de manter este arquivo):
    Até a v5.2 o desktop tinha uma interface própria em CustomTkinter,
    escrita em Python, e a versão web (pasta docs/) tinha outra em
    JavaScript. Manter as duas em paralelo fez o desktop ficar para trás
    (parou na v5.2 enquanto a web chegou à v6.4).

    A partir da v6.4 o desktop passou a ser uma JANELA NATIVA que carrega
    os MESMOS arquivos da pasta docs/ — ou seja, uma única base de código
    para web, celular e desktop. Toda melhoria feita na PWA aparece aqui
    automaticamente, sem reescrever nada.

    Tudo continua offline e local: os arquivos são lidos do disco, nada
    é enviado para servidor algum. A geração de .apkg roda no próprio
    aparelho (SQLite/WebAssembly), como na versão web.

Execução:
    python app.py            (usa pywebview, se instalado)
Requisitos:
    pip install pywebview    — opcional; sem ele, abre no navegador padrão
Executável:
    scripts\\build_exe.bat    — gera release\\EasyAnkiCards.exe
"""

import os
import sys
import webbrowser

APP_NOME = "EasyAnkiCards"
LARGURA, ALTURA = 1180, 820


def caminho_recurso(rel):
    """Resolve caminhos tanto rodando do código quanto dentro do .exe.

    PyInstaller com --onefile extrai os dados em sys._MEIPASS; fora dele,
    a pasta docs/ fica dois níveis acima deste arquivo (raiz do projeto).
    """
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return os.path.join(base, rel)
    raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(raiz, rel)


def main():
    index = caminho_recurso(os.path.join("docs", "index.html"))
    if not os.path.exists(index):
        print("[ERRO] Não encontrei a interface em:", index)
        print("Verifique se a pasta 'docs' está junto do aplicativo.")
        input("Pressione Enter para sair...")
        return 1

    try:
        import webview  # pywebview: janela nativa usando o motor do sistema
    except ImportError:
        # Sem pywebview: abre no navegador padrão (funciona igual).
        print("pywebview não instalado — abrindo no navegador padrão.")
        print("Para uma janela própria, instale com:  pip install pywebview")
        webbrowser.open("file:///" + index.replace("\\", "/"))
        return 0

    webview.create_window(APP_NOME, index, width=LARGURA, height=ALTURA,
                          min_size=(820, 600), text_select=True)
    webview.start()
    return 0


if __name__ == "__main__":
    sys.exit(main())
