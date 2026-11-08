# Proposta: sprites 2D a partir dos modelos 3D

Status: **proposta, ainda não implementada.** Este documento descreve o pipeline antes de qualquer código.

## O que já existe no repositório

| Fonte | O que é | Como é feito hoje |
|---|---|---|
| `python/anelzero/assets/models/bit.glb` | personagem Bit (4 malhas, cerca de 336 triângulos, sem textura, cor por material) | modelo 3D feito no Blender |
| `models/piso.glb`, `parede.glb`, `canto.glb` | módulos de mapa (cerca de 132, 120 e 228 triângulos) | Blender, `tools/blender/build_assets.py` |
| `python/anelzero/models.py` | falhas (pulga, rasgo, ruído, vazamento), itens e ferramentas | **geometria procedural em Python**, sem GLB |
| `python/anelzero/icon_render.py` | renderiza ícones em PNG num buffer offscreen do Panda3D (160 px) | já roda no PC do usuário |
| `tools/blender/render_layers.py` | renderiza as dez camadas em PNG com Cycles (640 px, 48 amostras) | já gerou `assets/layers/*.png` |
| `vendor/three/` | só `three.module.min.js` | **não tem `GLTFLoader`** |

Conclusão: as falhas, os itens e as ferramentas não têm GLB. Quem gera a forma delas é o código Python. Por isso o pipeline proposto parte do Panda3D, que já sabe ler os GLB e os modelos procedurais.

## Pipeline proposto (Panda3D offscreen)

1. **Entrada.** Um manifesto `2d/assets/sprites/manifest.json` lista cada sprite: `id`, `fonte` (`glb` ou `procedural`), `camera` (`cena` ou `topo`), `tamanho` e `ancora`.
2. **Carga.** Para GLB, `loader.loadModel`. Para falhas, itens e ferramentas, as funções `enemy_node`, `item_node` e `tool_node` de `models.py`.
3. **Normalização.** Igual aos ícones de hoje (`fit_to_frame`): o modelo é centrado na origem e a maior dimensão cabe no quadro. Assim cada sprite ocupa a mesma proporção na célula.
4. **Câmera.** Duas câmeras, em um só script:
   - **Cena (3/4):** a mesma posição dos ícones (`setPos(2.3, -3.0, 2.0)`, `lookAt(0,0,0)`, FOV 34). Usada por falhas, técnicos, itens e o personagem. Mantém o visual dos ícones do cliente Python.
   - **Topo:** câmera ortográfica olhando de cima, para os módulos de piso e parede. Um piso visto de cima encaixa na grade 2D.
5. **Fundo transparente.** Limpar o buffer com cor `(0, 0, 0, 0)` e gravar em RGBA. Os ícones atuais usam a cor da zona como fundo, então isso é uma mudança a validar.
6. **Saída.** `2d/assets/sprites/<id>.png` com resolução de 128 px (o jogo desenha em 34 px, e 128 px fica nítido em tela de celular com densidade alta). Um `manifest.json` com as dimensões gravadas.
7. **Versão.** Um número de versão no manifesto, como `ICON_VERSION`. Se o modelo mudar, a versão sobe e o navegador recarrega a sprite.

## Como o jogo usa as sprites

- `src/sprites.js` (novo, sem DOM na lógica): carrega o manifesto e devolve a imagem de cada id, ou `null`.
- `src/render.js`: cada desenho tenta a sprite primeiro. Se faltar, desenha como hoje (triângulo, bolinha, quadrado). **O jogo continua jogável sem sprites.**
- Teste em `test/sprites.test.mjs`: todo id usado pelo jogo tem entrada no manifesto; sprite ausente cai no desenho antigo; versão diferente invalida o cache.

## Pontos de atenção

- **Transparência:** o Panda3D pode descartar o canal alfa no buffer. Precisa ser verificado no PC do usuário (a sandbox roda Panda3D sob xvfb, mas sem GPU real).
- **GLB sem textura:** as cores vêm dos materiais. O GLB é lido pelo Panda3D, não pelo navegador, então `GLTFLoader` não é necessário.
- **Tamanho dos arquivos:** 128 px em PNG com fundo transparente fica em poucos KB por sprite. Não há atlas nesta fase.
- **Blender como alternativa:** para ilustrações feitas à mão no futuro (retratos de técnicos, por exemplo), `render_layers.py` mostra o caminho com Cycles. Não é necessário para o primeiro pipeline.

## Critérios para aceitar

1. Um comando gera todas as sprites a partir do manifesto, sem interação.
2. Cada falha, técnico, item, ferramenta e o personagem tem sprite com fundo transparente.
3. Sem o diretório `assets/sprites/`, o jogo funciona exatamente como agora.
4. Testes de manifesto e de fallback passam.
