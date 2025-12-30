import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { normalizeDate, addDays, getDiffDays } from '../utils/dateUtils';

export const WorkloadModal = ({ isOpen, onClose, resources, processedTasks, startDate }) => {
    // Calculs avancés pour la heatmap
    const heatmapData = useMemo(() => {
        if (!isOpen) return null; // Optimization: don't calculate if closed

        const data = {};
        const daysToShow = 30; // On affiche 30 jours à partir du début projet
        const start = normalizeDate(startDate);

        // Initialisation de la grille
        resources.forEach(r => {
            data[r.id] = Array(daysToShow).fill(0).map(() => ({ load: 0, tasks: [] }));
        });

        // Remplissage de la charge
        processedTasks.forEach(t => {
            if (t.type === 'task' && t.assignee && t.earlyStart && t.earlyFinish) {
                const startOffset = getDiffDays(start, t.earlyStart);
                const duration = getDiffDays(t.earlyStart, t.earlyFinish);

                for (let i = 0; i < duration; i++) {
                    const dayIndex = startOffset + i;
                    if (dayIndex >= 0 && dayIndex < daysToShow && data[t.assignee]) {
                        data[t.assignee][dayIndex].load += 100; // Suppose 100% charge par tâche
                        data[t.assignee][dayIndex].tasks.push(t.name);
                    }
                }
            }
        });

        // Stats par ressource
        const stats = resources.map(r => {
            const totalLoad = data[r.id].reduce((acc, d) => acc + d.load, 0);
            const capacity = daysToShow * 100; // Capacité théorique (sans compter weekends pour simplifier ici)
            return { id: r.id, avgLoad: Math.round((totalLoad / capacity) * 100) };
        });

        return { grid: data, stats, daysToShow, startDate: start };
    }, [isOpen, resources, processedTasks, startDate]);

    if (!isOpen || !heatmapData) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title="Plan de Charge Capacitaire (30 jours)" size="xl">
            <div className="p-6">
                <div className="flex gap-4 mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-100 border"></div> Dispo</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-200 border"></div> Charge Normale (&lt;80%)</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-400 border"></div> Pleine Charge (100%)</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 border"></div> Surcharge (&gt;100%)</div>
                </div>

                <div className="flex border rounded overflow-hidden bg-white shadow-sm">
                    {/* Colonne Gauche : Ressources */}
                    <div className="w-48 border-r bg-gray-50 flex-shrink-0">
                        <div className="h-10 border-b p-2 font-bold text-xs text-gray-500 uppercase">Ressource</div>
                        {resources.map(r => {
                            const stat = heatmapData.stats.find(s => s.id === r.id);
                            return (
                                <div key={r.id} className="h-12 border-b p-2 flex flex-col justify-center">
                                    <div className="font-medium text-sm truncate">{r.name}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <Activity size={10} /> {stat?.avgLoad}% occup.
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Grille Timeline */}
                    <div className="flex-1 overflow-x-auto">
                        {/* Header Jours */}
                        <div className="flex h-10 border-b">
                            {Array.from({ length: heatmapData.daysToShow }).map((_, i) => {
                                const d = addDays(heatmapData.startDate, i);
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div key={i} className={`w-10 flex-shrink-0 flex flex-col items-center justify-center text-[10px] border-r ${isWeekend ? 'bg-gray-100 text-gray-400' : ''}`}>
                                        <span className="font-bold">{d.getDate()}</span>
                                        <span>{['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()]}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Corps Grille */}
                        {resources.map(r => (
                            <div key={r.id} className="flex h-12 border-b">
                                {heatmapData.grid[r.id].map((cell, i) => {
                                    const load = cell.load;
                                    let bgClass = 'bg-white';
                                    if (load > 100) bgClass = 'bg-red-500 hover:bg-red-600';
                                    else if (load >= 80) bgClass = 'bg-emerald-400 hover:bg-emerald-500';
                                    else if (load > 0) bgClass = 'bg-blue-200 hover:bg-blue-300';

                                    return (
                                        <div key={i} className={`w-10 border-r flex-shrink-0 transition-colors relative group ${bgClass}`}>
                                            {load > 0 && (
                                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 w-48 bg-gray-800 text-white text-xs rounded p-2 shadow-lg pointer-events-none">
                                                    <div className="font-bold mb-1 border-b border-gray-600 pb-1">Charge: {load}%</div>
                                                    <ul className="list-disc pl-3">
                                                        {cell.tasks.map((t, idx) => <li key={idx}>{t}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
                <Button variant="secondary" onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    );
};
