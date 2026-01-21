"use client";

import { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Minimize2, Maximize2 } from 'lucide-react';

const AIAssistant = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Show the button after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isExpanded && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded, isMinimized]);

  // Initialize with welcome message
  useEffect(() => {
    if (isExpanded && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "👋 Hello! I'm your AI assistant for InsightBooks. I can help you with:\n\n• User & Role Management\n• Financial Operations (Invoices, Expenses, Payments)\n• Inventory & Stock Management\n• Reports & Analytics\n• System Configuration\n• Troubleshooting\n\nWhat would you like help with today?",
        timestamp: new Date()
      }]);
    }
  }, [isExpanded]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        timestamp: new Date(),
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggle = () => {
    if (isExpanded && !isMinimized) {
      setIsMinimized(true);
    } else if (isExpanded && isMinimized) {
      setIsMinimized(false);
    } else {
      setIsExpanded(true);
      setIsMinimized(false);
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setIsMinimized(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating AI Assistant Button */}
      <div
        className={`fixed z-50 transition-all duration-300 ease-in-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{ 
          right: '24px',
          bottom: isExpanded && !isMinimized ? '24px' : '100px' // Position above WhatsApp button
        }}
      >
        {/* Main AI Button */}
        {!isExpanded && (
          <button
            onClick={handleToggle}
            className="bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-110"
            style={{
              width: '60px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="AI Assistant - Get Help"
          >
            <Sparkles size={24} />
          </button>
        )}

        {/* Chat Window */}
        {isExpanded && (
          <div
            className={`bg-white rounded-lg shadow-2xl border border-gray-200 transition-all duration-300 ${
              isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
            }`}
            style={{
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Assistant</h3>
                  <p className="text-xs text-white/80">InsightBooks Helper</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggle}
                  className="text-white/80 hover:text-white transition-colors p-1"
                  title={isMinimized ? "Maximize" : "Minimize"}
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button
                  onClick={handleClose}
                  className="text-white/80 hover:text-white transition-colors p-1"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-indigo-600 text-white'
                            : message.error
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-white/70' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-indigo-600" />
                          <span className="text-sm text-gray-600">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-200 p-4 bg-white">
                  <div className="flex gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me anything about InsightBooks..."
                      className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      rows={2}
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 transition-colors duration-200 flex items-center justify-center"
                      title="Send message"
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Backdrop for mobile */}
      {isExpanded && !isMinimized && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"
          onClick={handleClose}
        />
      )}
    </>
  );
};

export default AIAssistant;

