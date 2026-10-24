# AMV CONECTAR — Versão profissional V2 (prévia isolada)

> **IMPORTANTE: esta branch é uma cópia de demonstração.**
> A versão pública do GitHub Pages permanece na branch `main`; não altere a origem de publicação nem faça merge desta prévia sem revisar e aprovar as mudanças.

## Como baixar e testar

1. Abra [a branch de demonstração](https://github.com/Vizzahck/AMVCONECTAR2.0/tree/preview/amv-profissional-v2).
2. Clique em **Code → Download ZIP** (confirme que a branch selecionada é `preview/amv-profissional-v2`).
3. Extraia todos os arquivos e abra `index.html` no navegador.
4. Navegue para **Projetos**, **Equipe** e **Sobre a AMV**; teste também a visualização no celular.

O CSS, o HTML, o menu, as preferências de tema e as perguntas prontas funcionam sem uma nova hospedagem. **O assistente Groq só responde a partir da origem autorizada pelo Worker existente**, por isso o teste local ou em um domínio de prévia diferente pode receber bloqueio CORS — isso não é uma falha das páginas. O envio do formulário continua apontando para o Formspree real, portanto não o teste com dados fictícios repetidamente.

## O que mudou nesta cópia

- Apresentação inicial mais clara: a AMV é identificada como projeto pedagógico dos estudantes do SENAC Pinheiro – MA.
- Chamada principal para **Projetos**, com cartões visuais e seção de trabalhos na página inicial.
- Página **projetos.html** com exemplos de apresentação de cases e etapas: contexto, processo, aprendizado.
- Página **equipe.html** com organização conceitual em quatro áreas, silhuetas ilustrativas e texto contextual.
- Menu de navegação agrupando Quem Somos, Missão, Visão, Valores e Projeto Integrador em **Sobre a AMV**; links diretos para Serviços, Projetos, Equipe e Contato.
- Estilo responsivo separado em `assets/pro-preview.css` e limpeza de atributos técnicos `data-tsd-source`.
- Ajustes básicos para acessibilidade (link “Pular para o conteúdo”) e imagem de compartilhamento Open Graph/Twitter.

## Conteúdos ilustrativos

Os cartões do portfólio **não representam trabalhos de clientes ou resultados reais**. As quatro áreas ilustrativas da equipe **não descrevem integrantes ou números de pessoas reais**. Antes de uma eventual publicação, substituir essas amostras por informações verificadas e fotos autorizadas, ou manter claramente a identificação de conteúdo demonstrativo.

## O que foi preservado

As páginas institucionais originais, os links para o WhatsApp, o formulário Formspree, o aviso de preferências, a alternância de tema, o Assistente AMV com perguntas prontas, os easter eggs e os arquivos do backend Cloudflare Worker/Groq permanecem no repositório. As configurações e Secrets da Cloudflare não foram alterados.

## Possíveis melhorias posteriores

- Cadastrar cases acadêmicos reais e nome/função dos participantes com autorização.
- Converter imagens para WebP, fontes para WOFF2 após medição de tamanho/carregamento e verificação de licenças.
- Testar visualmente em aparelhos reais, navegador móvel, teclado e leitores de tela.
- Adicionar métricas de performance e monitoramento com respeito à privacidade, apenas quando necessário.

**Crédito:** Desenvolvimento e design originais do site por Vizza; direitos sobre conteúdos de terceiros permanecem com seus respectivos titulares.


## Equipe organizada por áreas — V2

A página `equipe.html` agora usa a mesma organização da V1: **o nome da área aparece acima**, seguido pelas **fotos e nomes** de todos os integrantes daquela área. Não é necessário repetir o cargo em cada cartão. O visual exclusivo da V2 está em `assets/equipe-areas.css`.

As quatro áreas e os dez cartões são **ilustrativos**, até receber a lista real da equipe. Nos ZIPs futuros, o nome do ZIP será a área e o nome do arquivo de imagem será o nome da pessoa. Localize os blocos marcados com `<!-- ÁREA N -->` no HTML para editar os títulos e integrantes. Para inserir fotos, substitua o conteúdo da div `.v2-member-image` por `<img src="assets/equipe/nome.webp" alt="Retrato de Nome Sobrenome" loading="lazy">`, removendo `role="img"` e `aria-label` da div. Só publique fotografias autorizadas.

A V1 (`Vizzahck/AMVCONECTAR2.0`) não foi alterada nesta entrega.
