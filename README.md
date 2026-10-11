# SIGNAL — Morse Trainer

Estação de rádio no navegador para aprender código Morse. Você opera uma chave telegráfica virtual, vê o sinal chegar numa tela de fósforo verde e treina transmissão e recepção com dificuldade progressiva.

Feito em HTML, CSS e JavaScript puro. Não tem build, framework nem dependências.

## Rodando localmente

O código usa módulos ES (`<script type="module">`), e os navegadores bloqueiam módulos abertos direto do disco (`file://`). Por isso é preciso servir a pasta por HTTP. Qualquer servidor estático serve:

```bash
# Python 3
python3 -m http.server 8000

# ou Node
npx serve .
```

Depois acesse `http://localhost:8000`.

## Como usar

**A chave.** Segure para transmitir e solte para encerrar o sinal. Funciona com:

- botão esquerdo do mouse sobre a chave;
- barra de espaço (em qualquer lugar da página, exceto em campos de texto);
- toque e segure, no celular ou tablet.

Um toque curto vira ponto, um mais longo vira traço. A barrinha logo abaixo da sequência mostra, durante o toque, quanto falta para virar traço e, depois que você solta, quanto falta para fechar a letra ou a palavra.

Enquanto a letra está sendo montada, a tela mostra uma prévia tracejada ("NÃO CONFIRMADO"). Ela só entra na mensagem quando a pausa entre letras se completa. Uma pausa de palavra insere um espaço, uma vez só.

**A tabela.** Clique em qualquer letra ou número para ouvir o código e ver os sinais acenderem. Enquanto você transmite, a tabela destaca os caracteres que ainda são possíveis com a sequência atual.

**Atalhos**

| Tecla     | Ação                                                         |
|-----------|--------------------------------------------------------------|
| Espaço    | chave telegráfica                                            |
| Backspace | apaga o último sinal (ou o último caractere, se não houver sinal) |
| Esc       | interrompe a reprodução / fecha os ajustes                   |

## Modos

**Livre (Free Transmission).** Transmita o que quiser. A mensagem decodificada pode ser copiada.

**Treino TX (Transmission Training).** O equipamento pede um caractere ou uma palavra e você transmite. Se errar, aparece o código esperado, o que você enviou e o que deu errado ("o 2º sinal deveria ser traço", "faltou pausa entre as letras", etc.). Em palavras, a avaliação considera os limites entre as letras, não só os pontos e traços.

**Recepção (Receive Training).** O equipamento transmite e você digita o que entendeu. A luz de transmissão pisca junto com o som e pode ser desligada.

Os dois treinos avançam por cinco etapas: letras simples, letras comuns, letras complexas, números e palavras curtas. Oito acertos numa etapa liberam a próxima, e dá para trocar de etapa manualmente pelas setas.

| Nível         | Transmissão                                   | Recepção          |
|---------------|-----------------------------------------------|-------------------|
| Iniciante     | código visível no desafio, pausas folgadas     | repetições livres |
| Intermediário | código só pelo botão DICA, tempos do ajuste    | 2 repetições      |
| Avançado      | tabela oculta, tempos rígidos, sem OUVIR       | 1 repetição       |

## Temporização

A unidade básica vem do padrão PARIS: `1 unidade = 1200 / WPM` ms. Ponto = 1, traço = 3, pausa entre sinais = 1, entre letras = 3, entre palavras = 7.

O reconhecimento usa limites que ficam entre esses intervalos, para que pequenas variações não juntem nem quebrem letras:

- **Realista:** traço a partir de 2 unidades; a letra fecha depois de 2 a 2,7 unidades de silêncio e a palavra, depois de 4,5 a 5,8 (a tolerância escolhe o ponto dentro dessa faixa).
- **Iniciante:** os sinais seguem a velocidade normal, mas as pausas entre letras e palavras são esticadas (3 a 4,2 e 7 a 9 unidades). O limite entre ponto e traço se ajusta ao seu ritmo, então quem faz traços muito longos não começa a gerar traços sem querer.

A reprodução automática usa os mesmos parâmetros. No perfil iniciante, ela também estica as pausas (espaçamento tipo Farnsworth), o que mantém o que você ouve coerente com o que a chave espera.

Os valores em milissegundos para a velocidade atual aparecem no painel de ajustes.

## Ajustes

Ficam salvos no `localStorage` do navegador:

- perfil iniciante ou realista;
- velocidade (5 a 30 WPM) e tolerância das pausas;
- áudio ligado/desligado, frequência do tom (400 a 1000 Hz) e volume;
- efeitos visuais (completo, reduzido, desligado);
- exibição da tabela e da luz de recepção.

As estatísticas dos treinos (exercícios, acertos, erros, melhor sequência, etapa atual) também ficam no navegador e podem ser zeradas nos ajustes.

Se o sistema estiver com "reduzir movimento" ativado, as animações de tela e a sequência de inicialização são desligadas automaticamente.

## Estrutura

```
index.html
css/style.css
js/
  app.js          liga tudo: estado da tela, modos, controles
  morse.js        tabela Morse (fonte única) e codificação
  timing.js       regras de tempo, perfis, linha do tempo de reprodução
  keyer.js        máquina de estados da chave
  input.js        mouse, toque e teclado -> keyer
  audio.js        tom via Web Audio API
  player.js       reprodução automática sincronizada com a parte visual
  exercises.js    etapas, sorteio dos desafios e avaliação
  storage.js      configurações e estatísticas no localStorage
  ui/             tela CRT, tabela, painel de ajustes, inicialização
  modes/          modo livre, treino de transmissão, treino de recepção
assets/favicon.svg
tests/            testes da lógica (Node)
```

## Testes

```bash
npm test
```

Precisa do Node 18 ou mais novo. Os testes rodam a máquina de estados com um relógio simulado e cobrem:

- todos os caracteres de A a Z e 0 a 9, de 5 a 30 WPM, nos dois perfis;
- SOS, HELLO WORLD e frases com espaço entre palavras sem duplicação;
- variações aleatórias de ±15% a ±25% nos tempos;
- chave segurada com repetição de tecla gerando um único traço;
- soltura por outra fonte de entrada, cancelamento por perda de foco, ruído muito curto;
- reset cancelando temporizadores pendentes;
- avaliação dos exercícios e contagem do placar.

## Compatibilidade

Testado no Chromium (desktop e emulação de celular com toque). Deve funcionar em qualquer navegador atual com suporte a módulos ES, Pointer Events e Web Audio API: Chrome, Edge, Firefox e Safari (inclusive iOS). O áudio só começa depois da primeira interação com a página, por exigência dos navegadores.

As fontes (Share Tech Mono e VT323) vêm do Google Fonts. Sem internet, a interface usa as fontes monoespaçadas do sistema.
