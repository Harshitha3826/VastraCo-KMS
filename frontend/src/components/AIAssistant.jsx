import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X, Send, Mic, MicOff, ShoppingBag, Star } from 'lucide-react';
import api from '../api/axios';

/**
 * Cross-environment UUID v4 generator.
 *
 * crypto.randomUUID()       — preferred; requires HTTPS or localhost (secure context)
 * crypto.getRandomValues()  — fallback; works on HTTP too, still cryptographically random
 * Math.random()             — last resort; not cryptographically secure but never throws
 */
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    // RFC 4122 v4 UUID using getRandomValues
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    );
  }
  // Final fallback — works in every environment, not cryptographically secure
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const getSessionId = () => {
  try {
    let id = sessionStorage.getItem('vee_session_id');
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem('vee_session_id', id);
    }
    return id;
  } catch {
    // sessionStorage blocked (e.g. iframe sandbox) — use an in-memory ID
    return generateUUID();
  }
};

const SUGGESTIONS = [
  'Show dresses under ₹2000',
  'Best formal shirts for men',
  'What is your return policy?',
  'Track my latest order',
];

const MiniProductCard = ({ product }) => (
  <Link
    to={`/products/${product.id}`}
    className="flex flex-col bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
  >
    <div className="aspect-square overflow-hidden bg-gray-50">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ShoppingBag className="h-6 w-6 text-gray-300" />
        </div>
      )}
    </div>
    <div className="p-1.5">
      {product.brand && (
        <p className="text-[10px] text-gray-400 truncate">{product.brand}</p>
      )}
      <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{product.name}</p>
      <p className="text-xs font-semibold text-brand-dark mt-0.5">
        ₹{Number(product.price).toLocaleString('en-IN')}
      </p>
      {product.rating && (
        <div className="flex items-center gap-0.5 mt-0.5">
          <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] text-gray-500">{Number(product.rating).toFixed(1)}</span>
        </div>
      )}
    </div>
  </Link>
);

const TypingIndicator = () => (
  <div className="flex gap-2">
    <div className="w-6 h-6 rounded-full bg-brand-accent flex-shrink-0 mt-0.5 flex items-center justify-center">
      <ShoppingBag className="h-3 w-3 text-brand-dark" />
    </div>
    <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const AIAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  // setSessionId is used by clearChat to start a genuinely new server-side session
  const [sessionId, setSessionId] = useState(getSessionId);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || loading) return;

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
      setLoading(true);

      try {
        const res = await api.post('/ai/chat', {
          message: trimmed,
          session_id: sessionId,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: res.data.response || '',
            products: res.data.products || [],
          },
        ]);
      } catch (err) {
        const serverMsg = err?.response?.data?.error;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: serverMsg || "I'm having trouble connecting right now. Please try again in a moment.",
            products: [],
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, sessionId]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input requires Chrome or Edge. Please type your question instead.');
      return;
    }

    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const clearChat = () => {
    const newId = generateUUID();
    try {
      sessionStorage.setItem('vee_session_id', newId);
    } catch {
      // sessionStorage unavailable — the in-memory newId is still used
    }
    setMessages([]);
    setSessionId(newId); // update state so subsequent messages use the new session
  };

  return (
    <>
      {/* Floating open button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-brand-dark text-brand-accent rounded-full px-4 py-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-medium text-sm"
          aria-label="Open AI Shopping Assistant"
        >
          <MessageCircle className="h-5 w-5" />
          Ask Vee
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-96 h-[92vh] sm:h-[620px] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-dark flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="h-4 w-4 text-brand-dark" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Vee</p>
                <p className="text-gray-400 text-xs">VastraCo AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1 text-xs"
                title="Start a new conversation"
              >
                New chat
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 ml-1"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-0">

            {/* Welcome state */}
            {messages.length === 0 && (
              <div>
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-brand-accent flex-shrink-0 mt-0.5 flex items-center justify-center">
                    <ShoppingBag className="h-3 w-3 text-brand-dark" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm text-sm text-gray-700 max-w-[85%]">
                    Hi! I&apos;m <strong>Vee</strong>, VastraCo&apos;s AI Shopping Assistant. I can help
                    you find the perfect outfit, track your orders, or answer questions about returns.
                  </div>
                </div>
                <div className="mt-3 ml-9 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs bg-white border border-gray-200 text-gray-600 hover:border-brand-accent hover:text-brand-dark px-3 py-1.5 rounded-full transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-2.5'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-brand-accent flex-shrink-0 mt-0.5 flex items-center justify-center">
                    <ShoppingBag className="h-3 w-3 text-brand-dark" />
                  </div>
                )}

                <div className={`max-w-[82%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-brand-dark text-white rounded-tr-none'
                        : 'bg-white text-gray-700 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Product mini-cards */}
                  {msg.role === 'assistant' && msg.products && msg.products.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 w-full">
                      {msg.products.slice(0, 6).map((p) => (
                        <MiniProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 bg-white border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-accent transition-colors">
              <input
                ref={inputRef}
                type="text"
                placeholder={listening ? 'Listening…' : 'Ask about products, orders…'}
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400 min-w-0"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || listening}
              />
              <button
                onClick={toggleVoice}
                disabled={loading}
                className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                  listening
                    ? 'text-red-500 animate-pulse'
                    : 'text-gray-400 hover:text-brand-dark disabled:opacity-40'
                }`}
                aria-label={listening ? 'Stop listening' : 'Voice input'}
                title={listening ? 'Stop listening' : 'Voice input (Chrome/Edge)'}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="p-1.5 rounded-lg bg-brand-dark text-brand-accent disabled:opacity-40 hover:bg-gray-800 transition-colors flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Powered by Amazon Bedrock · VastraCo AI
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
