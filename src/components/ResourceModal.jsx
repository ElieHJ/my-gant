import React, { useState } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Check, X, Save } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatDateFr } from '../utils/dateUtils';

const ResourceForm = ({ resource, onUpdate, onDelete }) => {
    const [editRes, setEditRes] = useState(JSON.parse(JSON.stringify(resource)));
    const [newHoliday, setNewHoliday] = useState({ start: '', end: '' });

    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    const toggleWeekendDay = (dayIndex) => {
        setEditRes(prev => ({
            ...prev,
            weekends: prev.weekends.includes(dayIndex)
                ? prev.weekends.filter(d => d !== dayIndex)
                : [...prev.weekends, dayIndex]
        }));
    };

    const addHoliday = () => {
        if (newHoliday.start && newHoliday.end) {
            setEditRes(prev => ({ ...prev, holidays: [...prev.holidays, { ...newHoliday }] }));
            setNewHoliday({ start: '', end: '' });
        }
    };

    const removeHoliday = (index) => {
        setEditRes(prev => ({ ...prev, holidays: prev.holidays.filter((_, i) => i !== index) }));
    };

    const saveChanges = () => onUpdate(editRes);
    const handleDeleteCurrent = () => onDelete(editRes.id);

    return (
        <div className="p-6 overflow-y-auto flex-1 h-full">
            <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input type="text" value={editRes.name} onChange={e => setEditRes({ ...editRes, name: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TJM (€ / jour)</label>
                    <input type="number" value={editRes.dailyRate || 0} onChange={e => setEditRes({ ...editRes, dailyRate: parseInt(e.target.value) })} className="w-full border rounded p-2 text-right" />
                </div>
                <div className="col-span-2 flex justify-end">
                    <Button onClick={saveChanges} icon={Save} variant="secondary">Appliquer modifications</Button>
                </div>
            </div>
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Jours travaillés</label>
                <div className="flex gap-2">
                    {days.map((d, i) => {
                        const isWorking = !editRes.weekends.includes(i);
                        return (
                            <button key={i} onClick={() => toggleWeekendDay(i)} className={`flex-1 py-2 rounded text-xs font-medium border transition-all ${isWorking ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                {d}<br />{isWorking ? <Check size={12} className="mx-auto mt-1" /> : <X size={12} className="mx-auto mt-1" />}
                            </button>
                        )
                    })}
                </div>
            </div>
            <div className="border-t pt-6 mb-6">
                <div className="flex justify-between items-center mb-4"><label className="block text-sm font-medium text-gray-700">Congés</label></div>
                <div className="flex gap-2 items-end mb-4 bg-gray-50 p-3 rounded border border-dashed">
                    <div className="flex-1"><label className="text-xs text-gray-500">Début</label><input type="date" value={newHoliday.start} onChange={e => setNewHoliday({ ...newHoliday, start: e.target.value })} className="w-full border rounded p-1 text-sm" /></div>
                    <div className="flex-1"><label className="text-xs text-gray-500">Fin</label><input type="date" value={newHoliday.end} onChange={e => setNewHoliday({ ...newHoliday, end: e.target.value })} className="w-full border rounded p-1 text-sm" /></div>
                    <Button onClick={addHoliday} icon={Plus} disabled={!newHoliday.start || !newHoliday.end}>Ajouter</Button>
                </div>
                <div className="space-y-2">
                    {editRes.holidays.map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded bg-white hover:bg-red-50 group transition-colors">
                            <div className="flex items-center gap-3">
                                <CalendarIcon size={16} className="text-gray-400" />
                                <span className="text-sm text-gray-700">Du <strong>{formatDateFr(h.start)}</strong> au <strong>{formatDateFr(h.end)}</strong></span>
                            </div>
                            <button onClick={() => removeHoliday(idx)} className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t pt-6">
                <button onClick={handleDeleteCurrent} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded hover:bg-red-50 w-full justify-center border border-transparent hover:border-red-200 transition-all">
                    <Trash2 size={16} /> Supprimer cette ressource
                </button>
            </div>
        </div>
    );
};

export const ResourceModal = ({ isOpen, onClose, resources, onUpdate, onAdd, onDelete }) => {
    const [selectedResId, setSelectedResId] = useState(resources?.[0]?.id);

    // Sécurité : si la ressource sélectionnée est supprimée, on sélectionne la première dispo
    const activeResId = resources.find(r => r.id === selectedResId) ? selectedResId : resources?.[0]?.id;
    const selectedRes = resources?.find(r => r.id === activeResId);

    if (!isOpen) return null;

    const handleCreate = () => {
        const newId = onAdd();
        setSelectedResId(newId);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Gestion des Ressources" size="lg">
            <div className="flex h-[500px]">
                <div className="w-1/3 border-r bg-gray-50 flex flex-col">
                    <div className="p-4 border-b bg-white flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-700">Équipe ({resources.length})</span>
                        <button onClick={handleCreate} className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Ajouter une personne"><Plus size={16} /></button>
                    </div>
                    <div className="p-2 overflow-y-auto flex-1 space-y-2">
                        {resources.map(r => (
                            <div key={r.id} onClick={() => setSelectedResId(r.id)} className={`p-3 rounded cursor-pointer flex items-center gap-3 transition-colors ${activeResId === r.id ? 'bg-white shadow border-l-4 border-blue-500' : 'hover:bg-gray-200'}`}>
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{r.name.charAt(0)}</div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-medium truncate">{r.name}</div>
                                    <div className="text-xs text-gray-500">{r.holidays.length} congé(s)</div>
                                </div>
                            </div>
                        ))}
                        {resources.length === 0 && <div className="text-center p-4 text-xs text-gray-500 italic">Aucune ressource.<br />Cliquez sur + pour ajouter.</div>}
                    </div>
                </div>

                <div className="w-2/3 flex flex-col bg-white">
                    {selectedRes ? (
                        <ResourceForm
                            key={selectedRes.id}
                            resource={selectedRes}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">Sélectionnez une ressource</div>
                    )}
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    );
};
