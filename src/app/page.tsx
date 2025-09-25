'use client';

import { useState } from 'react';
import { GitHubUrlSchema } from '@/app/lib/schemas';


export default function GitHubAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const analyzeRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate URL with Zod
    const validationResult = GitHubUrlSchema.safeParse(url);
    
    if (!validationResult.success) {
      alert(`Error de validación: ${validationResult.error.issues[0].message}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: validationResult.data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al analizar el repositorio');
      }

      // Read the entire stream response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No se pudo leer la respuesta');
      }

      let analysisText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        console.log('Raw chunk:', chunk);
        
        // For simple text stream, we can add directly
        analysisText += chunk;
      }
      
      // Show complete analysis in alert and console
      console.log('*******************************');
      console.log('COMPLETE ANALYSIS:');
      console.log(analysisText);
      console.log('*******************************');
      alert(`Análisis del Repositorio:\n\n${analysisText}`);
      
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🔍 GitHub Repository Analyzer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Ingresa una URL de GitHub para obtener un análisis completo del repositorio
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 mb-8">
          <form onSubmit={analyzeRepository} className="space-y-4">
            <div>
              <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                URL del Repositorio de GitHub
              </label>
              <input
                id="github-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/usuario/repositorio"
                className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-700 dark:text-white transition-colors"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Analizando repositorio...</span>
                </div>
              ) : (
                'Analizar Repositorio'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}