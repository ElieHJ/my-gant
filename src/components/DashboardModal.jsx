import React, { useMemo } from 'react';
import { PieChart, ShieldAlert, DollarSign, AlertCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils/formatUtils';
import { getDiffDays } from '../utils/dateUtils';

export const DashboardModal = ({ isOpen, onClose, tasks, resources, processedTasks }) => {
    // Calcul des données pour les graphiques
    const stats = useMemo(() => {
        if (!isOpen) return { phases: [], statusCounts: {}, riskCounts: {}, totalTasks: 0, maxPhaseCost: 1, riskyTasks: [] };

        const phases = [];
        let statusCounts = { todo: 0, inProgress: 0, done: 0 };
        let riskCounts = { low: 0, medium: 0, high: 0 };
        const riskyTasks = [];

        // 1. Coûts par Phase
        tasks.filter(t => t.type === 'phase').forEach(phase => {
            let phaseCost = 0;
            const traverse = (parentId) => {
                processedTasks.filter(t => t.parentId === parentId).forEach(t => {
                    if (t.type === 'task') {
                        const res = resources.find(r => r.id === t.assignee);
                        phaseCost += (t.duration || 0) * (res?.dailyRate || 0);
                    }
                    if (t.type === 'phase') traverse(t.id);
                });
            };
            traverse(phase.id);
            phases.push({ name: phase.name, cost: phaseCost });
        });

        // 2. Statuts & Risques
        processedTasks.filter(t => t.type === 'task').forEach(t => {
            if (t.progress === 100) statusCounts.done++;
            else if (t.progress > 0) statusCounts.inProgress++;
            else statusCounts.todo++;

            // Compte des risques
            if (t.risk === 'high') riskCounts.high++;
            else if (t.risk === 'medium') riskCounts.medium++;
            else riskCounts.low++;

            if (t.isCritical || (t.lateFinish && t.baselineFinish && t.lateFinish > new Date(t.baselineFinish)) || t.risk === 'high') {
                riskyTasks.push(t);
            }
        });

        const totalTasks = statusCounts.todo + statusCounts.inProgress + statusCounts.done;
        const maxPhaseCost = Math.max(...phases.map(p => p.cost), 1);

        return { phases, statusCounts, riskCounts, totalTasks, maxPhaseCost, riskyTasks };
    }, [processedTasks, tasks, resources, isOpen]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title="Tableau de Bord Exécutif" size="lg">
            <div className="p-6 bg-gray-50 min-h-[400px]">

                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* GRAPHIQUE 1 : Répartition des Tâches */}
                    <div className="bg-white p-4 rounded shadow-sm border">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><PieChart size={16} /> État d'avancement</h4>
                        <div className="flex items-center gap-6">
                            <div className="relative w-32 h-32 rounded-full" style={{
                                background: `conic-gradient(
                              #22c55e 0% ${stats.totalTasks ? (stats.statusCounts.done / stats.totalTasks) * 100 : 0}%, 
                              #3b82f6 ${stats.totalTasks ? (stats.statusCounts.done / stats.totalTasks) * 100 : 0}% ${stats.totalTasks ? ((stats.statusCounts.done + stats.statusCounts.inProgress) / stats.totalTasks) * 100 : 0}%, 
                              #e2e8f0 ${stats.totalTasks ? ((stats.statusCounts.done + stats.statusCounts.inProgress) / stats.totalTasks) * 100 : 0}% 100%
                          )`
                            }}>
                                <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                                    <span className="text-2xl font-bold text-gray-800">{stats.totalTasks}</span>
                                    <span className="text-[10px] text-gray-500 uppercase">Tâches</span>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm flex-1">
                                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500"></div> Terminé</div> <span className="font-bold">{stats.statusCounts.done}</span></div>
                                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500"></div> En cours</div> <span className="font-bold">{stats.statusCounts.inProgress}</span></div>
                                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-200"></div> À faire</div> <span className="font-bold">{stats.statusCounts.todo}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* GRAPHIQUE 2 : Matrice des Risques */}
                    <div className="bg-white p-4 rounded shadow-sm border">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><ShieldAlert size={16} /> Matrice des Risques</h4>
                        <div className="grid grid-cols-3 gap-2 text-center h-24 mb-2">
                            <div className="bg-green-50 rounded flex flex-col justify-center border border-green-100">
                                <span className="text-2xl font-bold text-green-600">{stats.riskCounts.low}</span>
                                <span className="text-[10px] uppercase text-green-800 font-bold">Faible</span>
                            </div>
                            <div className="bg-orange-50 rounded flex flex-col justify-center border border-orange-100">
                                <span className="text-2xl font-bold text-orange-600">{stats.riskCounts.medium}</span>
                                <span className="text-[10px] uppercase text-orange-800 font-bold">Moyen</span>
                            </div>
                            <div className="bg-red-50 rounded flex flex-col justify-center border border-red-100">
                                <span className="text-2xl font-bold text-red-600">{stats.riskCounts.high}</span>
                                <span className="text-[10px] uppercase text-red-800 font-bold">Élevé</span>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 text-center mt-2">
                            {Math.round((stats.riskCounts.high / (stats.totalTasks || 1)) * 100)}% des tâches sont à risque élevé.
                        </div>
                    </div>

                    {/* GRAPHIQUE 3 : Coûts par Phase */}
                    <div className="bg-white p-4 rounded shadow-sm border col-span-2">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={16} /> Budget par Phase</h4>
                        <div className="space-y-3 overflow-y-auto max-h-[140px] pr-2 scrollbar-thin">
                            {stats.phases.map((phase, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="truncate font-medium text-gray-600" title={phase.name}>{phase.name}</span>
                                        <span className="font-mono">{formatCurrency(phase.cost)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(phase.cost / stats.maxPhaseCost) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* LISTE : Tâches à Risque */}
                <div className="bg-white p-4 rounded shadow-sm border">
                    <h4 className="text-sm font-bold text-red-600 mb-4 flex items-center gap-2"><AlertCircle size={16} /> Tâches Critiques & Retards</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-800 text-xs uppercase">
                                <tr>
                                    <th className="p-2 rounded-l">Tâche</th>
                                    <th className="p-2">Risque</th>
                                    <th className="p-2 text-right rounded-r">Détail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.riskyTasks.length === 0 ? (
                                    <tr><td colSpan="3" className="p-4 text-center text-gray-400 italic">Aucune tâche critique détectée.</td></tr>
                                ) : (
                                    stats.riskyTasks.slice(0, 5).map(t => {
                                        return (
                                            <tr key={t.id}>
                                                <td className="p-2 font-medium text-gray-700">{t.name}</td>
                                                <td className="p-2">
                                                    {t.risk === 'high' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold border border-red-200">ÉLEVÉ</span>}
                                                    {t.risk === 'medium' && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold border border-orange-200">MOYEN</span>}
                                                </td>
                                                <td className="p-2 text-right font-mono text-red-600 text-xs">
                                                    {t.lateFinish && t.baselineFinish && t.lateFinish > new Date(t.baselineFinish) ?
                                                        `+${getDiffDays(new Date(t.baselineFinish), t.lateFinish)}j` :
                                                        t.isCritical ? 'Chemin Crit.' : ''}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {stats.riskyTasks.length > 5 && <div className="text-center text-xs text-gray-400 mt-2">...et {stats.riskyTasks.length - 5} autres</div>}
                </div>

            </div>
            <div className="p-4 border-t bg-white flex justify-end">
                <Button variant="secondary" onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    );
};
