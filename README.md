# IconCraft v2 — Editor de Ícones (PWA)

Editor de ícones e mockups com arquitetura em duas camadas:
vetorial (SVG) para traços escaláveis e pixel (canvas) para
preenchimentos e recortes.

## Como rodar

O Service Worker (modo offline / instalável) exige HTTP. Na pasta:

    python -m http.server 8080

E acesse http://localhost:8080
(Abrir o index.html direto do disco também funciona para testar,
mas sem os recursos de PWA.)

## Ferramentas

- Desenhar (D) — caneta à mão livre; pena redonda ou caligráfica
  (horizontal, vertical, duas diagonais — a grossura muda conforme
  a direção do traço)
- Forma geométrica (G) — rascunhe e escolha: círculo, oval,
  retângulo, retângulo arredondado, triângulo ou linha reta;
  a forma perfeita é encaixada no espaço do rascunho
- Pincel negativo (E) — desenha transparência sobre o que existe,
  com as mesmas opções de ponta e espessura
- Balde de tinta (B) — preenche regiões de cor sólida (camada pixel)
- Selecionar (S) — clique num traço para editar propriedades
- Editar nós (N) — arraste os pontos da curva; duplo clique remove
- Referência (R) — arraste a imagem de referência

## Recursos

- Espelho ao vivo (botão no topo): desenhe de um lado do eixo e o
  outro replica em tempo real; ao suavizar, é tratado como um só
- Suavizar traços: pergunta se o desenho é simétrico (eixo vertical
  ou horizontal) ou assimétrico e limpa o tremido preservando cantos
- Imagem de referência: fica ao fundo com opacidade ajustável, serve
  só de guia — nunca entra na exportação nem no projeto salvo
- Exportação: SVG vetorial (recortes viram máscara) e PNG com fundo
  transparente (inclui os preenchimentos de balde)
- Tema claro/escuro, undo/redo, grade, zoom, projetos no navegador
  com salvamento automático (projetos da v1 são migrados)

## Estrutura

    iconcraft/
    ├── index.html      Interface
    ├── styles.css      Estilos (claro/escuro)
    ├── app.js          Lógica do editor
    ├── manifest.json   Metadados do PWA
    ├── sw.js           Service Worker (cache offline)
    └── icons/          Ícones do app
