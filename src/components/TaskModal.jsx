import React, { useState, useMemo } from 'react';
import { Trash2, Save, DollarSign, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils/formatUtils';

export const TaskModal = ({ isOpen, onClose, task, tasks, resources, onUpdate, onDelete }) => {
    const normalizeDeps = (deps) => (deps || []).map(d => typeof d === 'string' ? { id: d, lag: 0 } : d);
    const [formData, setFormData] = useState(task ? { ...task, dependencies: normalizeDeps(task.dependencies) } : { dependencies: [] });

    const estimatedCost = useMemo(() => {
        if (!task || task.type !== 'task' || !task.assignee) return 0;
        const res = resources.find(r => r.id === task.assignee);
        return (res?.dailyRate || 0) * (task.duration || 0);
    }, [task, resources]);

    if (!isOpen || !task) return null;

    const availablePhases = tasks.filter(t => t.type === 'phase' && t.id !== formData.id);

    return (
        <Modal isOpen={true} onClose={onClose} title="Éditer la Tâche">
            <div className="p-6 grid grid-cols-2 gap-4 flex-1 overflow-y-auto">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700">Nom</label><input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="mt-1 w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700">Type</label><select value={formData.type || 'task'} onChange={e => setFormData({ ...formData, type: e.target.value })} className="mt-1 w-full border rounded p-2"><option value="task">Tâche Standard</option><option value="milestone">Jalon</option><option value="phase">Phase</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Niveau de Risque</label><select value={formData.risk || 'low'} onChange={e => setFormData({ ...formData, risk: e.target.value })} className="mt-1 w-full border rounded p-2 bg-gray-50"><option value="low">Faible (Standard)</option><option value="medium">Moyen (À surveiller)</option><option value="high">Élevé (Critique)</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Rattacher à une Phase</label><select value={formData.parentId || ''} onChange={e => setFormData({ ...formData, parentId: e.target.value || null })} className="mt-1 w-full border rounded p-2 bg-blue-50"><option value="">-- Aucune (Racine) --</option>{availablePhases.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                <div><label className="block text-sm font-medium text-gray-700">Avancement (%)</label><input type="number" value={formData.progress || 0} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })} className="mt-1 w-full border rounded p-2" /></div>
                {formData.type !== 'phase' && (<>
                    <div><label className="block text-sm font-medium text-gray-700">Durée (j ouvrés)</label><input type="number" value={formData.duration || 0} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} className="mt-1 w-full border rounded p-2" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Responsable</label><select value={formData.assignee || ''} onChange={e => setFormData({ ...formData, assignee: e.target.value })} className="mt-1 w-full border rounded p-2">{resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>

                    {/* Estimated Cost Display */}
                    {formData.assignee && formData.duration > 0 && (
                        <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded p-3 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-emerald-800">
                                <DollarSign size={16} />
                                <span className="text-sm font-medium">Coût Estimé</span>
                            </div>
                            <span className="font-bold text-emerald-700">{formatCurrency(estimatedCost)}</span>
                        </div>
                    )}

                    <div className="col-span-2"><label className="block text-sm font-medium text-gray-700">Contrainte Début</label><input type="date" value={formData.manualStart || ''} onChange={e => setFormData({ ...formData, manualStart: e.target.value || null })} className="mt-1 w-full border rounded p-2" /></div>
                    <div className="col-span-2"><label className="block text-sm font-medium text-gray-700">Dépendances & Délais</label><select className="mt-1 w-full border rounded p-2" onChange={(e) => { if (e.target.value && !formData.dependencies.some(d => d.id === e.target.value)) setFormData({ ...formData, dependencies: [...formData.dependencies, { id: e.target.value, lag: 0 }] }) }} value=""><option value="">+ Ajouter prédécesseur</option>{tasks.filter(t => t.id !== formData.id && t.type !== 'phase').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><div className="flex flex-col gap-2 mt-2 bg-gray-50 p-2 rounded">{formData.dependencies.map((dep, idx) => { const depTask = tasks.find(t => t.id === dep.id); return (<div key={dep.id} className="flex items-center justify-between bg-white p-1 rounded border shadow-sm"><span className="text-xs font-bold text-gray-700 px-2">{depTask?.name || dep.id}</span><div className="flex items-center gap-2"><span className="text-xs text-gray-500">Lag (j):</span><input type="number" className="w-12 border rounded text-xs p-1 text-center" value={dep.lag} onChange={(e) => { const newDeps = [...formData.dependencies]; newDeps[idx].lag = parseInt(e.target.value) || 0; setFormData({ ...formData, dependencies: newDeps }); }} /><button onClick={() => setFormData({ ...formData, dependencies: formData.dependencies.filter(d => d.id !== dep.id) })}><X size={14} className="text-red-500" /></button></div></div>); })}</div></div>
                </>)}
            </div>
            <div className="p-4 border-t flex justify-between flex-shrink-0 bg-white z-10"><Button variant="danger" onClick={() => onDelete(formData.id)} icon={Trash2}>Supprimer</Button><Button onClick={() => onUpdate(formData)} icon={Save}>Enregistrer</Button></div>
        </Modal>
    );
};
