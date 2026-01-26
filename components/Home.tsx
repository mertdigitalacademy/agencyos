import { useState, useEffect } from 'react';
import type { Project } from '../types';
import * as api from '../services/api';
import { useI18n } from '../services/i18n';

interface HomeProps {
  onNavigate: (view: string, projectId?: string) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const { t, lang } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextAction, setNextAction] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await api.getProjects();
      setProjects(data);

      // Basit AI öneri mantığı
      if (data.length === 0) {
        setNextAction(lang === 'tr' ? 'İlk projenizi oluşturun' : 'Create your first project');
      } else {
        const activeProjects = data.filter(p => p.status === 'Live' || p.status === 'Developing');
        if (activeProjects.length === 0) {
          setNextAction(lang === 'tr' ? 'Bir projeyi aktif hale getirin' : 'Activate a project');
        } else {
          setNextAction(lang === 'tr' ? 'Workflow ekleyin ve gelir makinenizi çalıştırın' : 'Add workflows and run your revenue machine');
        }
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  }

  // İstatistik hesaplama
  const stats = {
    pipeline: projects.filter(p => p.status === 'Intake' || p.status === 'Proposal').length,
    active: projects.filter(p => p.status === 'Developing' || p.status === 'Testing' || p.status === 'Live').length,
    billed: projects.reduce((sum, p) => sum + (p.totalBilled || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">{lang === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Hoş Geldiniz Başlığı */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">
          {lang === 'tr' ? 'Merhaba 👋' : 'Welcome 👋'}
        </h1>
        <p className="text-gray-400">
          {lang === 'tr' ? 'İşte ajansınızın durumu:' : "Here's your agency status:"}
        </p>
      </div>

      {/* 3 Ana Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Potansiyel */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center space-y-2">
          <div className="text-4xl">📋</div>
          <div className="text-3xl font-bold text-blue-400">{stats.pipeline}</div>
          <div className="text-sm text-gray-400">
            {lang === 'tr' ? 'Potansiyel' : 'Pipeline'}
          </div>
        </div>

        {/* Aktif */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center space-y-2">
          <div className="text-4xl">⚡</div>
          <div className="text-3xl font-bold text-green-400">{stats.active}</div>
          <div className="text-sm text-gray-400">
            {lang === 'tr' ? 'Aktif Projeler' : 'Active Projects'}
          </div>
        </div>

        {/* Faturalanan */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center space-y-2">
          <div className="text-4xl">💰</div>
          <div className="text-3xl font-bold text-yellow-400">
            ${stats.billed.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">
            {lang === 'tr' ? 'Toplam Faturalanan' : 'Total Billed'}
          </div>
        </div>
      </div>

      {/* Sonraki Adım */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🎯</div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-sm text-gray-400 mb-1">
                {lang === 'tr' ? 'Yapılacak:' : 'Next Step:'}
              </div>
              <div className="text-lg font-medium text-white">{nextAction}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hızlı Aksiyonlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Yeni Proje */}
        <button
          onClick={() => onNavigate('INTAKE')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 px-6 rounded-lg transition flex items-center justify-center gap-3"
        >
          <span className="text-2xl">➕</span>
          <span className="text-lg">
            {lang === 'tr' ? 'Yeni Proje' : 'New Project'}
          </span>
        </button>

        {/* AI Koça Sor */}
        <button
          onClick={() => onNavigate('ASSISTANT')}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-6 px-6 rounded-lg transition flex items-center justify-center gap-3"
        >
          <span className="text-2xl">🤖</span>
          <span className="text-lg">
            {lang === 'tr' ? 'AI Koça Sor' : 'Ask AI Coach'}
          </span>
        </button>
      </div>

      {/* Son Projeler (opsiyonel) */}
      {projects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            {lang === 'tr' ? 'Son Projeler' : 'Recent Projects'}
          </h2>
          <div className="space-y-2">
            {projects.slice(0, 5).map((project) => (
              <button
                key={project.id}
                onClick={() => onNavigate('PROJECT_DETAIL', project.id)}
                className="w-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg p-4 transition text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-white">{project.brief.clientName}</div>
                    <div className="text-sm text-gray-400">
                      {project.brief.industry} • {project.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-400">
                      ${project.totalBilled?.toLocaleString() || 0}
                    </div>
                    <div className="text-xs text-gray-500">
                      {project.activeWorkflows?.length || 0} workflows
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Boş Durum */}
      {projects.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="text-6xl">🚀</div>
          <div className="text-xl font-medium text-white">
            {lang === 'tr' ? 'İlk Projenizi Oluşturun!' : 'Create Your First Project!'}
          </div>
          <p className="text-gray-400 max-w-md mx-auto">
            {lang === 'tr'
              ? 'AI destekli ajansınızı kurmaya başlamak için ilk müşteri projenizi ekleyin.'
              : 'Add your first client project to start building your AI-powered agency.'}
          </p>
          <button
            onClick={() => onNavigate('INTAKE')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition mt-4"
          >
            <span>➕</span>
            <span>{lang === 'tr' ? 'Başlayalım' : "Let's Start"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
