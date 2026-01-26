import { useState } from 'react';
import type { WorkflowSuggestion } from '../services/autoWorkflow';
import { useI18n } from '../services/i18n';

interface WorkflowSuggestionCardProps {
  suggestions: WorkflowSuggestion[];
  onInstall: (workflowId: string) => void;
  onInstallAll: () => void;
  loading?: boolean;
}

export default function WorkflowSuggestionCard({
  suggestions,
  onInstall,
  onInstallAll,
  loading = false
}: WorkflowSuggestionCardProps) {
  const { lang } = useI18n();
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  if (suggestions.length === 0) return null;

  async function handleInstall(workflowId: string) {
    setInstalling(prev => new Set(prev).add(workflowId));
    try {
      await onInstall(workflowId);
    } finally {
      setInstalling(prev => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
    }
  }

  const highConfidenceSuggestions = suggestions.filter(s => s.confidence > 0.6);

  return (
    <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/50 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🤖</span>
            <span>{lang === 'tr' ? 'AI Workflow Önerileri' : 'AI Workflow Suggestions'}</span>
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {lang === 'tr'
              ? `Projeniz için ${suggestions.length} workflow bulduk`
              : `Found ${suggestions.length} workflows for your project`}
          </p>
        </div>

        {highConfidenceSuggestions.length > 1 && (
          <button
            onClick={onInstallAll}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{lang === 'tr' ? 'Kuruluyor...' : 'Installing...'}</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>{lang === 'tr' ? 'Tümünü Kur' : 'Install All'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Suggestions List */}
      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const isInstalling = installing.has(suggestion.workflow.id);
          const confidencePercent = Math.round(suggestion.confidence * 100);

          return (
            <div
              key={suggestion.workflow.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-blue-600/50 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Workflow Name & Complexity */}
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-white">{suggestion.workflow.name}</h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        suggestion.workflow.complexity === 'Low'
                          ? 'bg-green-900/50 text-green-300'
                          : suggestion.workflow.complexity === 'Medium'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {suggestion.workflow.complexity}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-3">{suggestion.workflow.description}</p>

                  {/* Reason */}
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-blue-400 text-xs mt-0.5">💡</span>
                    <p className="text-xs text-blue-300">{suggestion.reason}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {suggestion.workflow.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-900/50 text-gray-400 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Confidence Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-900 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          confidencePercent > 70
                            ? 'bg-green-500'
                            : confidencePercent > 40
                            ? 'bg-yellow-500'
                            : 'bg-gray-500'
                        }`}
                        style={{ width: `${confidencePercent}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {confidencePercent}%
                    </span>
                  </div>
                </div>

                {/* Install Button */}
                <button
                  onClick={() => handleInstall(suggestion.workflow.id)}
                  disabled={isInstalling || loading}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition min-w-[100px] ${
                    suggestion.oneClickInstall
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isInstalling ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : suggestion.oneClickInstall ? (
                    lang === 'tr' ? 'Kur' : 'Install'
                  ) : (
                    lang === 'tr' ? 'İncele' : 'Review'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Help */}
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
        <span>💡 </span>
        {lang === 'tr'
          ? 'AI, proje özetinize göre en uygun workflow\'ları seçti. Tek tıkla kurabilirsiniz.'
          : 'AI selected the best workflows based on your project brief. Install with one click.'}
      </div>
    </div>
  );
}
