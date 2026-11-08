# Anel Zero — versão Python (Panda3D)

Port em Python do jogo. A versão web (raiz do repositório) continua sendo a que roda em celular.

## Requisitos
- Python 3.11+ (testado em 3.13)
- `pip install -r requirements.txt` (Panda3D 1.10.16)

## Executar
```
python -m anelzero                 # slot 1
python -m anelzero --slot 2        # outro slot
python -m anelzero --novo          # começar do zero no slot
```
Controles: WASD ou setas para andar, F5 salvar, Esc salvar e sair.
Saves ficam em `~/.anelzero/saves` (mude com a variável `ANELZERO_SAVE_DIR`).

## Testes
```
cd python
python3 -m unittest discover -s tests -v
```
Os testes cobrem geração de mapas (paridade com o JavaScript), estado e salvamento, regras de combate, alcance das zonas e colisão.

Os testes do cliente (`tests/test_client.py`) abrem o jogo sem tela e simulam teclas. Eles precisam de um display virtual:
```
xvfb-run -a -s "-screen 0 1280x720x24" python3 -m unittest discover -s tests -v
```

Capturas de tela para conferir o visual: `python -m anelzero --novo --shot tela.png` (tela de jogo, pulando o título).

## Estrutura
- `anelzero/data/` — JSON exportado da versão JS por `tools/export_data.mjs`
- `anelzero/mapgen.py` — gerador determinístico de mapas
- `anelzero/state.py` — estado, missões, XP, inventário e slots de salvamento
- `anelzero/combat.py` — regras de combate
- `anelzero/world.py` — grade, marcadores, portais e colisão
- `anelzero/client.py` — cliente 3D (Panda3D)

Para regenerar os dados após mudar o conteúdo JS: `node tools/export_data.mjs`.
