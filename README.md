# AMV Conectar — versão estática completa

## Abrir no computador
Extraia toda a pasta e abra `index.html` no navegador. Não mova os arquivos HTML para fora da pasta: eles usam os recursos em `assets/`.

## Hospedar
Envie todo o conteúdo de `versao-estatica/` para a pasta pública de sua hospedagem. Não é necessário instalar programas, pacotes, React ou um serviço de servidor. Os endereços das páginas terminam em `.html`.

## Conteúdo
- `index.html`: página inicial com serviços, diferenciais, processo e contato.
- `quem-somos.html`, `missao.html`, `visao.html`, `valores.html`, `projeto-integrador.html`: páginas institucionais.
- `assets/site.css`: estilos e temas.
- `assets/theme.js`: tema inicial e preferência salva.
- `assets/site.js`: menu, troca de tema, assistente, validação e envio do formulário via Formspree.
- `assets/faq.js`: perguntas rápidas do assistente, preservadas como alternativa caso a IA esteja indisponível.
- `assets/assistant-ai.js` e `assets/assistant-ai.css`: interface da IA da Groq.
- `assets/assistant-config.js`: endereço público do Worker, nunca a chave privada.
- `privacidade.html`: política de privacidade e tecnologias de armazenamento.
- `assets/*.png`: logos transparentes e favicon.
- `assets/manrope-*`: fontes locais.
- `assets/OFL-Manrope.txt`: licença da fonte Manrope.

## Funcionalidades e limites
As seis páginas institucionais, os arquivos estáticos, o menu e o tema não exigem serviços externos. O chatbot com Groq, o Formspree e o WhatsApp exigem conexão com a internet. Os links WhatsApp abrem https://wa.me/5598984833670.

O formulário de contato da página inicial está configurado para enviar os dados (nome, e-mail, empresa, assunto e mensagem) ao **Formspree** no endpoint `https://formspree.io/f/mgaawnyg`. Ele só exibe confirmação após resposta positiva do serviço. Se ocorrer erro, informa o problema e mantém os campos preenchidos. O Formspree exige conexão com a internet, conta ativa e e-mail de destino confirmado. Os envios e notificações ficam sujeitos às configurações e limites do serviço. A confirmação de entrega à caixa de e-mail deve ser verificada no painel do Formspree.

Para testar: publique no GitHub Pages, acesse a página de contato e envie uma mensagem de teste; confira o painel do Formspree e a caixa de entrada/spam do e-mail configurado. Abrir o arquivo `index.html` diretamente por `file://` pode bloquear o envio AJAX em certos navegadores devido a restrições de origem; nesse caso, teste pela hospedagem HTTP(S). Se o JavaScript estiver desabilitado, o formulário usa o envio HTML normal. Não insira chaves privadas nos arquivos estáticos.

A preferência claro/escuro é salva quando o navegador permite armazenamento local. Abrir arquivos diretamente pode restringir essa persistência em alguns navegadores; em uma hospedagem normal, ela é compartilhada entre as páginas.

O site existente não foi substituído: esta pasta é uma entrega independente em HTML, CSS e JavaScript puro. A logo superior é distinta da logo central e do rodapé, preservando as versões atuais sem fundo. Ícones SVG estão embutidos nos arquivos HTML.


## Integração ativa com IA da Groq

O site permanece hospedado no GitHub Pages. O assistente usa uma Cloudflare Worker independente para encaminhar perguntas à Groq sem expor o segredo `GROQ_API_KEY`. O endereço do Worker está em `assets/assistant-config.js`, mas a chave real existe somente nos Secrets da Cloudflare. O chatbot foi implantado em outubro de 2026 e deve ter sua disponibilidade e cotas periodicamente verificadas. O uso do assistente está sujeito aos limites da Groq e Cloudflare.

## Autoria e direitos

O desenvolvimento técnico e design originais do site foram feitos por **Vizza** e são atribuídos a Vizza. O projeto pedagógico AMV Conectar pertence a seu contexto institucional e coletivo. Direitos sobre imagens, textos de colaboradores, fontes licenciadas e outros materiais de terceiros permanecem com seus respectivos titulares. O símbolo ® só deve ser usado para marca registrada; o crédito de desenvolvimento não exige registro de marca.

## Privacidade e cookies

A página `privacidade.html` descreve o uso de armazenamento local para preferência de tema, o formulário enviado pelo Formspree e o chat encaminhado pela Cloudflare à Groq. Nesta versão não foram incluídos scripts de anúncios ou de rastreamento de visitantes, de modo que não se instalou um banner para cookies não essenciais. Se novos recursos de análise/publicidade forem adicionados, revisar a política e, quando necessário, implementar consentimento prévio e opção de recusa.

## Manutenção

Não copie segredos para o GitHub. Para atualizar a base de conhecimento da IA, edite `worker/src/index.js` e faça deploy na branch vinculada ao Cloudflare Builds. O Worker foi conectado inicialmente à branch `feat/assistente-groq-cloudflare`; mantenha-a em sincronia com a `main` ou configure a produção do Worker para `main` antes de depender apenas dela.


## Banner de privacidade (Outubro de 2026)

O aviso flutuante com os botões **Aceitar** e **Recusar** aparece na primeira visita e pode ser reaberto por **Preferências de privacidade**, no rodapé. Como não há cookies próprios de publicidade/estatísticas no site, a escolha diz respeito somente a salvar a preferência opcional de tema claro/escuro no `localStorage`. Quando a opção é recusada, o tema não é salvo; é mantido apenas `amv-cookie-choice=rejected` para lembrar a recusa. Ao aceitar, grava `amv-cookie-choice=accepted` e a preferência de tema. A política explica que usar o formulário ou enviar mensagens ao chatbot envolve processamento por serviços externos, independentemente desta preferência. Nenhum pixel de anúncio ou biblioteca de métricas foi acrescentado.
