import { useState } from 'react';
import type { Project, Lead } from '../types';
import { useI18n } from '../services/i18n';

interface DashboardSimpleProps {
  projects: Project[];
  leads: Lead[];
  onNewProject: () => void;
  onOpenProject: (projectId: string, tab?: string) => void;
  onLeadIntake: (lead: Lead) => void;
  onOpenSettings: () => void;
}

export default function DashboardSimple({
  projects,
  leads,
  onNewProject,
  onOpenProject,
  onLeadIntake,
  onOpenSettings
}: DashboardSimpleProps) {
  const { lang } = useI18n();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // İstatistikler
  const stats = {
    total: projects.length,
    active: projects.filter(p => ['Developing', 'Testing', 'Live'].includes(p.status)).length,
    revenue: projects.reduce((sum, p) => sum + (p.totalBilled || 0), 0),
    workflows: projects.reduce((sum, p) => sum + (p.activeWorkflows?.length || 0), 0)
  };

  // Filtrele
  const filteredProjects = projects.filter(p => {
    if (filter === 'active') return ['Developing', 'Testing', 'Live'].includes(p.status);
    if (filter === 'completed') return p.status === 'Live';
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {lang === 'tr' ? '📁 Projeler' : '📁 Projects'}
          </h1>
          <p className="text-gray-400 mt-1">
            {lang === 'tr' ? 'Tüm müşteri projeleriniz' : 'All your client projects'}
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
        >
          <span>➕</span>
          <span>{lang === 'tr' ? 'Yeni Proje' : 'New Project'}</span>
        </button>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">
            {lang === 'tr' ? 'Toplam Proje' : 'Total Projects'}
          </div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">
            {lang === 'tr' ? 'Aktif' : 'Active'}
          </div>
          <div className="text-3xl font-bold text-green-400">{stats.active}</div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">
            {lang === 'tr' ? 'Toplam Gelir' : 'Total Revenue'}
          </div>
          <div className="text-3xl font-bold text-yellow-400">${stats.revenue.toLocaleString()}</div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">
            {lang === 'tr' ? 'Toplam Workflow' : 'Total Workflows'}
          </div>
          <div className="text-3xl font-bold text-purple-400">{stats.workflows}</div>
        </div>
      </div>

      {/* Leads (varsa) */}
      {leads.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/50 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>🎯</span>
              <span>{lang === 'tr' ? 'Yeni Leadler' : 'New Leads'}</span>
            </h2>
            <span className="text-sm text-gray-400">{leads.length} lead</span>
          </div>

          <div className="space-y-2">
            {leads.slice(0, 3).map((lead) => (
              <button
                key={lead.id}
                onClick={() => onLeadIntake(lead)}
                className="w-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg p-4 transition text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-white">{lead.source}</div>
                  <div className="text-sm text-gray-400 line-clamp-1">{lead.brief}</div>
                </div>
                <span className="text-blue-400 text-sm">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {lang === 'tr' ? 'Tümü' : 'All'} ({projects.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {lang === 'tr' ? 'Aktif' : 'Active'} ({stats.active})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
            filter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {lang === 'tr' ? 'Canlı' : 'Live'}
        </button>
      </div>

      {/* Proje Listesi */}
      {filteredProjects.length > 0 ? (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onOpenProject(project.id)}
              className="w-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg p-6 transition text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white text-lg">{project.brief.clientName}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        project.status === 'Live'
                          ? 'bg-green-900/50 text-green-300'
                          : project.status === 'Developing' || project.status === 'Testing'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-400 mb-3">
                    {project.brief.industry}
                    {project.brief.goals && project.brief.goals.length > 0 && (
                      <> • {project.brief.goals[0]}</>
                    )}
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">⚡</span>
                      <span className="text-gray-400">
                        {project.activeWorkflows?.length || 0} workflows
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">💰</span>
                      <span className="text-gray-400">
                        ${project.totalBilled?.toLocaleString() || 0}
                      </span>
                    </div>

                    {project.executionLogs && project.executionLogs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">🔄</span>
                        <span className="text-gray-400">
                          {project.executionLogs.length} runs
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    ${project.totalBilled || 0}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {lang === 'tr' ? 'Faturalanan' : 'Billed'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-4">
          <div className="text-6xl">📁</div>
          <div className="text-xl font-medium text-white">
            {lang === 'tr' ? 'Proje Bulunamadı' : 'No Projects Found'}
          </div>
          <p className="text-gray-400 max-w-md mx-auto">
            {lang === 'tr'
              ? filter === 'all'
                ? 'İlk projenizi oluşturun ve AI ajansınızı büyütmeye başlayın.'
                : 'Bu filtrede proje yok. Farklı bir filtre deneyin.'
              : filter === 'all'
              ? 'Create your first project and start growing your AI agency.'
              : 'No projects in this filter. Try a different one.'}
          </p>
          {filter === 'all' && (
            <button
              onClick={onNewProject}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition mt-4"
            >
              <span>➕</span>
              <span>{lang === 'tr' ? 'İlk Projeyi Oluştur' : 'Create First Project'}</span>
            </button>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          onClick={onOpenSettings}
          className="text-sm text-gray-400 hover:text-gray-300 transition"
        >
          ⚙️ {lang === 'tr' ? 'Ayarlar' : 'Settings'}
        </button>
      </div>
    </div>
  );
}
