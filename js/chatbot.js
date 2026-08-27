// Assistente virtual da BritoTec — usa o Google Gemini via Firebase AI Logic.
// Este arquivo é um ES module (por isso é carregado com <script type="module">).
// Ele cria seu próprio app Firebase secundário, chamado "chatbot", para não
// interferir com o app padrão usado no login/Firestore (js/app-store.js, js/firebase-config.js).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js";
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-ai.js";

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// ---- Ferramentas: funções reais que consultam window.BritoTec (js/app-store.js) ----

function toolGetStoreSchedule() {
  const store = window.BritoTec;
  if (!store) return { error: "Dados da loja indisponíveis nesta página." };
  const status = store.storeStatus();
  const schedule = store.getSchedule();
  const weekly_schedule = DAY_NAMES.map((name, day) => {
    const config = schedule[day];
    return config?.enabled ? `${name}: ${config.open} às ${config.close}` : `${name}: fechado`;
  });
  return { open_now: status.open, status_label: status.label, weekly_schedule };
}

function toolSearchProducts({ name, category } = {}) {
  const store = window.BritoTec;
  if (!store) return { error: "Catálogo indisponível nesta página." };
  let products = store.getProducts();
  if (category) products = products.filter(p => p.category.toLowerCase() === String(category).toLowerCase());
  if (name) { const term = String(name).toLowerCase(); products = products.filter(p => p.name.toLowerCase().includes(term)); }
  return {
    results: products.map(p => ({ name: p.name, category: p.category, price_brl: p.price, in_stock: p.stock > 0, stock_quantity: p.stock }))
  };
}

function toolGoToPage({ page }) {
  const routes = { inicio: "index.html", celulares: "celulares.html", computadores: "computadores.html", videogames: "videogames.html", acessorios: "acessorios.html" };
  const url = routes[page];
  if (!url) return { navigated: false, error: "Página desconhecida." };
  // pequeno atraso para a resposta em texto do assistente aparecer antes do redirecionamento
  setTimeout(() => { window.location.href = url; }, 1200);
  return { navigated: true, page };
}

async function callTool(name, args) {
  try {
    if (name === "getStoreSchedule") return toolGetStoreSchedule();
    if (name === "searchProducts") return toolSearchProducts(args);
    if (name === "goToPage") return toolGoToPage(args);
    return { error: `Função desconhecida: ${name}` };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

const TOOLS = {
  functionDeclarations: [
    {
      name: "getStoreSchedule",
      description: "Retorna se a loja BritoTec está aberta agora e o horário de funcionamento de cada dia da semana. Use sempre que o cliente perguntar sobre horário, se a loja está aberta, ou a que horas abre/fecha.",
      parameters: Schema.object({ properties: {} })
    },
    {
      name: "searchProducts",
      description: "Busca produtos no catálogo de acessórios da BritoTec (capinhas, carregadores, fones, suportes, cabos, docks magnéticos), retornando preço em reais e se há estoque disponível. Use sempre que o cliente perguntar o preço de um acessório, se tem em estoque, ou pedir recomendações.",
      parameters: Schema.object({
        properties: {
          name: Schema.string({ description: "Parte do nome do produto para buscar, ex: 'carregador', 'fone'. Deixe vazio para listar o catálogo inteiro." }),
          category: Schema.string({ description: "Filtra por categoria: proteção, energia, áudio ou setup." })
        },
        optionalProperties: ["name", "category"]
      })
    },
    {
      name: "goToPage",
      description: "Leva o cliente automaticamente para a página correta do site. Use quando o cliente quiser abrir uma solicitação de reparo (celulares, computadores ou videogames) ou ver a loja de acessórios.",
      parameters: Schema.object({
        properties: {
          page: Schema.string({ description: "Uma destas opções exatas: 'celulares', 'computadores', 'videogames', 'acessorios', 'inicio'." })
        }
      })
    }
  ]
};

const SYSTEM_INSTRUCTION = `Você é a assistente virtual da BritoTec, uma loja e assistência técnica de eletrônicos em São João de Meriti (RJ), com atendimento pelo site e loja online de acessórios.

Sobre a BritoTec:
- Presta manutenção de Celulares, Computadores/Notebooks e Videogames (consoles).
- Vende acessórios: capinhas, carregadores, fones, suportes, cabos e docks magnéticos.
- Para pedir um reparo, o cliente preenche um formulário na página do aparelho (Celulares, Computadores ou Videogames) com marca, modelo, defeito, foto opcional, nome, WhatsApp, e-mail e CPF.

Ferramentas disponíveis (USE SEMPRE que fizer sentido, em vez de dizer que não sabe):
- getStoreSchedule: retorna se a loja está aberta agora e o horário de cada dia da semana. Use sempre que perguntarem sobre horário de funcionamento.
- searchProducts: busca no catálogo real de acessórios, com preço em reais e se há estoque. Use sempre que perguntarem preço, disponibilidade ou pedirem recomendação de acessórios.
- goToPage: leva o cliente direto pra página certa do site (celulares, computadores, videogames, acessorios, inicio). Use sempre que o cliente indicar que quer pedir um reparo ou ver a loja.

Regras importantes:
- Você NÃO tem acesso a preços exatos de reparo (dependem de avaliação técnica) nem a dados de pedidos específicos de clientes. Para isso, oriente a abrir uma ordem de serviço ou falar com a equipe.
- Nunca invente preços de acessórios, estoque ou horários — sempre confira com as ferramentas antes de responder algo que elas poderiam te dizer.

Como se comportar:
- Fale português do Brasil, em tom caloroso, direto e prestativo — como um atendente humano bem treinado, não robótico.
- Responda SOMENTE sobre assuntos da BritoTec: reparos, acessórios, como pedir um serviço, dúvidas gerais sobre os produtos e o funcionamento do site.
- Se perguntarem algo fora desse escopo (temas gerais, outras empresas, assuntos pessoais, etc.), recuse educadamente e traga a conversa de volta para como você pode ajudar com a BritoTec.
- Nunca peça ou processe dados sensíveis (senha, CPF completo, cartão de crédito) dentro do chat.
- Mantenha as respostas curtas (poucas frases), a não ser que o cliente peça mais detalhes.`;

function isLocalHost() {
  return ["localhost", "127.0.0.1"].includes(location.hostname);
}

async function initFirebaseAI() {
  if (!window.BRITOTEC_FIREBASE_CONFIG) {
    console.error("Chatbot BritoTec: js/firebase-config.js não foi carregado antes de js/chatbot.js.");
    return null;
  }

  // App Firebase dedicado ao chatbot (nome "chatbot"), separado do app padrão de login/Firestore.
  const chatbotApp = initializeApp(window.BRITOTEC_FIREBASE_CONFIG, "chatbot");

  // Firebase App Check protege sua cota gratuita do Gemini contra uso indevido por terceiros.
  if (isLocalHost()) {
    // Em desenvolvimento local, ativa o "debug provider": abra o console do navegador,
    // copie o token exibido e registre-o em Firebase Console > Build > App Check > Apps > "Manage debug tokens".
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(chatbotApp, {
      // Depois de criar uma chave "Website" no Google Cloud Console > reCAPTCHA Enterprise
      // (e registrar o app no Firebase Console > Build > App Check > Apps > "reCAPTCHA Enterprise"),
      // troque a chave abaixo pela "Site Key" gerada lá.
      provider: new ReCaptchaEnterpriseProvider("6Lcw6JctAAAAAJVFCkUMWrBxYjrB4AW8YQmtAoNB"),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    console.warn("Chatbot BritoTec: não foi possível inicializar o App Check.", error);
  }

  const ai = getAI(chatbotApp, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, { model: "gemini-3.5-flash", systemInstruction: SYSTEM_INSTRUCTION, tools: [TOOLS] });
}

function buildWidget() {
  const launcher = document.createElement("button");
  launcher.className = "britotec-chat-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Abrir chat com a BritoTec");
  launcher.innerHTML = `<span class="britotec-chat-dot"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

  const panel = document.createElement("section");
  panel.className = "britotec-chat-panel";
  panel.innerHTML = `
    <div class="britotec-chat-head">
      <span class="britotec-chat-avatar">B</span>
      <div><strong>Assistente BritoTec</strong><small>Fala com a gente sobre reparos e acessórios</small></div>
      <button type="button" class="britotec-chat-close" aria-label="Fechar chat">×</button>
    </div>
    <div class="britotec-chat-messages" data-chat-messages></div>
    <form class="britotec-chat-form" data-chat-form>
      <input type="text" placeholder="Digite sua mensagem…" autocomplete="off" data-chat-input required />
      <button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg></button>
    </form>`;

  document.body.append(launcher, panel);
  return { launcher, panel };
}

function addMessage(container, text, who) {
  const bubble = document.createElement("div");
  bubble.className = `britotec-chat-msg ${who}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function addTypingIndicator(container) {
  const bubble = document.createElement("div");
  bubble.className = "britotec-chat-msg bot typing";
  bubble.innerHTML = "<span></span><span></span><span></span>";
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

async function main() {
  const model = await initFirebaseAI();
  const { launcher, panel } = buildWidget();
  const messages = panel.querySelector("[data-chat-messages]");
  const form = panel.querySelector("[data-chat-form]");
  const input = panel.querySelector("[data-chat-input]");
  const closeButton = panel.querySelector(".britotec-chat-close");

  let chat = null;
  let opened = false;
  let sending = false;

  function toggle(open) {
    opened = open ?? !panel.classList.contains("open");
    panel.classList.toggle("open", opened);
    if (opened) {
      if (!messages.children.length) {
        addMessage(messages, "Oi! 👋 Sou a assistente virtual da BritoTec. Posso te contar sobre nosso horário, ver preço e estoque dos acessórios, e te levar direto pra página certa pra pedir um reparo. Como posso ajudar?", "bot");
      }
      input.focus();
    }
  }

  launcher.addEventListener("click", () => toggle());
  closeButton.addEventListener("click", () => toggle(false));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;

    if (!model) {
      addMessage(messages, text, "user");
      addMessage(messages, "O assistente de IA ainda não está configurado neste site. Fale com a equipe pelo WhatsApp ou formulário de contato.", "bot");
      input.value = "";
      return;
    }

    sending = true;
    input.value = "";
    form.querySelector("button[type=submit]").disabled = true;
    addMessage(messages, text, "user");
    const typing = addTypingIndicator(messages);

    try {
      if (!chat) chat = model.startChat({ history: [] });
      const withTimeout = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 45000))]);

      let result = await withTimeout(chat.sendMessage(text));
      let calls = result.response.functionCalls();
      let rounds = 0;
      while (calls && calls.length && rounds < 5) {
        rounds++;
        const responses = await Promise.all(calls.map(async call => ({
          functionResponse: { name: call.name, response: await callTool(call.name, call.args) }
        })));
        result = await withTimeout(chat.sendMessage([{ role: "user", parts: responses }]));
        calls = result.response.functionCalls();
      }

      typing.remove();
      addMessage(messages, result.response.text(), "bot");
    } catch (error) {
      console.error("Chatbot BritoTec: erro ao chamar o Gemini.", error);
      typing.remove();
      const msg = error?.message === "timeout"
        ? "Estou demorando mais que o normal pra responder. Tente novamente em instantes ou fale com a gente pelo WhatsApp."
        : "Não consegui responder agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.";
      addMessage(messages, msg, "bot");
    } finally {
      sending = false;
      form.querySelector("button[type=submit]").disabled = false;
      input.focus();
    }
  });
}

main();
