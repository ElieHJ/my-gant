import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    ChevronDown, ChevronRight, Plus, Users, Save, Trash2, AlertCircle,
    Flag, Activity, X, Calendar as CalendarIcon, Check, Download, Upload,
    Move, Anchor, BarChart2, Undo, Redo, Clock, DollarSign, PieChart, TrendingUp,
    AlertTriangle, ShieldAlert, Grid, UserCheck
} from 'lucide-react';
import { Button } from './components/ui/Button';
import { Modal } from './components/ui/Modal';
import { TaskModal } from './components/TaskModal';
import { ResourceModal } from './components/ResourceModal';
import { WorkloadModal } from './components/WorkloadModal';
import { DashboardModal } from './components/DashboardModal';
import { Scheduler } from './utils/scheduler';
import { normalizeDate, formatDateInput, getWeekNumber, addDays, getDiffDays, MS_PER_DAY } from './utils/dateUtils';
import { formatCurrency } from './utils/formatUtils';


// --- DONNÉES DE DÉMONSTRATION ---

const INITIAL_RESOURCES = [
    { id: 'r1', name: 'Alice Dev', dailyRate: 450, weekends: [0, 6], holidays: [{ start: '2025-01-10', end: '2025-01-15' }] },
    { id: 'r2', name: 'Bob Design', dailyRate: 400, weekends: [0, 6], holidays: [] },
    { id: 'r3', name: 'Charlie Manager', dailyRate: 600, weekends: [0, 6], holidays: [] },
];

const INITIAL_TASKS = [
    { id: 'p1', name: 'Phase 1: Conception', type: 'phase', risk: 'low', parentId: null, isExpanded: true, dependencies: [] },
    { id: 't1', name: 'Brief Client', type: 'task', risk: 'low', parentId: 'p1', duration: 2, progress: 100, assignee: 'r3', dependencies: [], manualStart: '2025-01-01' },
    { id: 't2', name: 'Wireframes', type: 'task', risk: 'medium', parentId: 'p1', duration: 5, progress: 60, assignee: 'r2', dependencies: ['t1'] },
    { id: 'm1', name: 'Validation Maquettes', type: 'milestone', risk: 'low', parentId: 'p1', duration: 0, assignee: 'r3', dependencies: [{ id: 't2', lag: 2 }] },

    { id: 'p2', name: 'Phase 2: Développement', type: 'phase', risk: 'medium', parentId: null, isExpanded: true, dependencies: [] },
    { id: 't3', name: 'Setup Architecture', type: 'task', risk: 'low', parentId: 'p2', duration: 3, progress: 0, assignee: 'r1', dependencies: ['m1'] },
    { id: 't4', name: 'Backend API', type: 'task', risk: 'high', parentId: 'p2', duration: 8, progress: 0, assignee: 'r1', dependencies: ['t3'] },
    { id: 't5', name: 'Frontend Integration', type: 'task', risk: 'medium', parentId: 'p2', duration: 6, progress: 0, assignee: 'r2', dependencies: ['t3'] },
    { id: 't6', name: 'Tests E2E', type: 'task', risk: 'low', parentId: 'p2', duration: 4, progress: 0, assignee: 'r1', dependencies: ['t4', 't5'] },

    { id: 'm2', name: 'Go Live', type: 'milestone', risk: 'high', parentId: null, duration: 0, assignee: 'r3', dependencies: ['t6'] }
];

const INITIAL_CONFIG = {
    startDate: '2025-01-01',
    title: 'Projet Refonte Web V2',
    viewMode: 'Day', // 'Day', 'Week', 'Month'
    zoom: 50,
};


// --- COMPOSANT PRINCIPAL APP ---

export default function GanttApp() {
    const [projectState, setProjectState] = useState({
        tasks: INITIAL_TASKS,
        resources: INITIAL_RESOURCES
    });

    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const [config, setConfig] = useState(INITIAL_CONFIG);
    const [ui, setUi] = useState({
        showCriticalPath: false,
        selectedTaskId: null,
        showResourceModal: false,
        showTaskModal: false,
        showBaselineConfirm: false,
        showHistogram: false,
        showDashboard: false,
        showWorkloadModal: false, // NOUVEAU
    });

    const [dragState, setDragState] = useState({ isDragging: false, type: null, taskId: null, startX: 0, initialTaskStart: null, initialDuration: 0, currentX: 0 });
    const fileInputRef = useRef(null);

    // Init depuis LocalStorage
    useEffect(() => {
        const savedTasks = localStorage.getItem('gantt_tasks');
        const savedRes = localStorage.getItem('gantt_resources');
        const savedConfig = localStorage.getItem('gantt_config');
        if (savedTasks && savedRes) {
            try {
                const t = JSON.parse(savedTasks);
                const r = JSON.parse(savedRes);
                if (t && r) setProjectState({ tasks: t, resources: r });
            } catch (e) { console.error(e); }
        }
        if (savedConfig) {
            try { setConfig(JSON.parse(savedConfig)); } catch { /* ignore */ }
        }
    }, []);

    // Sauvegarde & Historique Wrapper
    const updateProjectState = useCallback((newState, addToHistory = true) => {
        setProjectState(prev => {
            const next = typeof newState === 'function' ? newState(prev) : newState;

            if (addToHistory) {
                setHistory(currentHistory => {
                    const newHistory = currentHistory.slice(0, historyIndex + 1);
                    newHistory.push(JSON.parse(JSON.stringify(prev)));
                    if (newHistory.length > 50) newHistory.shift();
                    return newHistory;
                });
                setHistoryIndex(idx => idx + 1);
            }

            localStorage.setItem('gantt_tasks', JSON.stringify(next.tasks));
            localStorage.setItem('gantt_resources', JSON.stringify(next.resources));

            return next;
        });
    }, [historyIndex]);

    const undo = () => {
        if (historyIndex >= 0 && history.length > 0) {
            const currentSnapshot = JSON.parse(JSON.stringify(projectState));

            setHistory(h => {
                const newHistory = [...h];
                if (historyIndex === h.length) {
                    newHistory.push(currentSnapshot);
                }
                return newHistory;
            });

            const prevState = history[historyIndex];

            if (prevState) {
                setProjectState(prevState);
                setHistoryIndex(idx => idx - 1);
            }
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            setProjectState(nextState);
            setHistoryIndex(historyIndex + 1);
        }
    };

    const processedTasks = useMemo(() => {
        if (!projectState.tasks || !projectState.resources) return [];
        return Scheduler.calculate(projectState.tasks, projectState.resources, config.startDate);
    }, [projectState.tasks, projectState.resources, config.startDate]);

    // --- CALCUL DES STATS PROJET (KPI) ---
    const projectStats = useMemo(() => {
        let totalCost = 0;
        let totalManDays = 0;
        let totalTasks = 0;
        let completedTasks = 0;
        let currentProjectEnd = 0;
        let baselineProjectEnd = 0;

        processedTasks.forEach(t => {
            // Calcul dates fin max pour le retard
            if (t.earlyFinish) {
                const ef = t.earlyFinish.getTime();
                if (ef > currentProjectEnd) currentProjectEnd = ef;
            }
            if (t.baselineFinish) {
                const bf = new Date(t.baselineFinish).getTime();
                if (bf > baselineProjectEnd) baselineProjectEnd = bf;
            }

            if (t.type === 'task') {
                totalTasks++;
                if (t.progress === 100) completedTasks++;

                totalManDays += t.duration;

                const res = projectState.resources.find(r => r.id === t.assignee);
                const dailyRate = res && res.dailyRate ? Number(res.dailyRate) : 0;
                totalCost += t.duration * dailyRate;
            }
        });

        // Calcul du glissement en jours
        const delayDays = (baselineProjectEnd > 0 && currentProjectEnd > 0)
            ? Math.round((currentProjectEnd - baselineProjectEnd) / MS_PER_DAY)
            : 0;

        return {
            totalCost,
            totalManDays,
            progress: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
            delayDays,
            hasBaseline: baselineProjectEnd > 0
        };
    }, [processedTasks, projectState.resources]);


    useEffect(() => {
        if (config.viewMode === 'Day') setConfig(c => ({ ...c, zoom: 50 }));
        if (config.viewMode === 'Week') setConfig(c => ({ ...c, zoom: 20 }));
        if (config.viewMode === 'Month') setConfig(c => ({ ...c, zoom: 5 }));
    }, [config.viewMode]);

    // CALCULS DÉRIVÉS & CONSTANTES (Déplacés ici pour portée globale)
    const projectStart = normalizeDate(config.startDate);
    let maxDate = projectStart;
    processedTasks.forEach(t => { if (t.earlyFinish && t.earlyFinish > maxDate) maxDate = t.earlyFinish; });

    const totalDays = Math.max(getDiffDays(projectStart, maxDate) + 60, 60);

    // IMPORTANT : Déclaration de canvasWidth ici pour être accessible partout
    const canvasWidth = totalDays * config.zoom;

    const resourceLoad = useMemo(() => {
        const loadMap = {};
        if (projectState.resources) {
            projectState.resources.forEach(r => { loadMap[r.id] = new Array(totalDays).fill(0); });
            processedTasks.forEach(t => {
                if (t.type !== 'task' || !t.assignee || !t.earlyStart || !t.earlyFinish) return;
                const startIdx = getDiffDays(projectStart, t.earlyStart);
                const duration = getDiffDays(t.earlyStart, t.earlyFinish);
                for (let i = 0; i < duration; i++) {
                    const dayIdx = startIdx + i;
                    if (dayIdx >= 0 && dayIdx < totalDays && loadMap[t.assignee]) loadMap[t.assignee][dayIdx] += 100;
                }
            });
        }
        return loadMap;
    }, [processedTasks, projectState.resources, totalDays, projectStart]);

    // --- HANDLERS ---
    const confirmBaseline = () => {
        updateProjectState(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => {
                const computed = processedTasks.find(p => p.id === t.id);
                if (!computed || !computed.earlyStart || !computed.earlyFinish) return t;
                return { ...t, baselineStart: computed.earlyStart.toISOString(), baselineFinish: computed.earlyFinish.toISOString() };
            })
        }));
        setUi(prev => ({ ...prev, showBaselineConfirm: false }));
    };

    const handleMouseDown = (e, task, type) => {
        if (task.type === 'phase') return;
        e.stopPropagation(); e.preventDefault();
        setDragState({ isDragging: true, type: type, taskId: task.id, startX: e.clientX, initialTaskStart: task.earlyStart, initialDuration: task.duration, currentX: e.clientX });
    };

    const handleGlobalMouseMove = useCallback((e) => {
        if (!dragState.isDragging) return;
        setDragState(prev => ({ ...prev, currentX: e.clientX }));
    }, [dragState.isDragging]);

    const handleGlobalMouseUp = useCallback(() => {
        if (!dragState.isDragging) return;
        const { type, taskId, startX, currentX, initialTaskStart, initialDuration } = dragState;
        const deltaX = currentX - startX;
        const deltaDays = Math.round(deltaX / config.zoom);
        if (deltaDays !== 0) {
            updateProjectState(prev => ({
                ...prev,
                tasks: prev.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    if (type === 'move') {
                        const newDate = addDays(initialTaskStart, deltaDays);
                        return { ...t, manualStart: formatDateInput(newDate) };
                    } else if (type === 'resize') {
                        const newDuration = Math.max(1, initialDuration + deltaDays);
                        return { ...t, duration: newDuration };
                    }
                    return t;
                })
            }));
        }
        setDragState({ isDragging: false, type: null, taskId: null, startX: 0, initialTaskStart: null, initialDuration: 0, currentX: 0 });
    }, [dragState, config.zoom, updateProjectState]);

    useEffect(() => {
        if (dragState.isDragging) { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); }
        return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
    }, [dragState.isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);

    const handleUpdateTask = (updatedTask) => {
        updateProjectState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) }));
        setUi(prev => ({ ...prev, showTaskModal: false, selectedTaskId: null }));
    };

    const handleUpdateResource = (updatedResource) => {
        updateProjectState(prev => ({ ...prev, resources: prev.resources.map(r => r.id === updatedResource.id ? updatedResource : r) }));
    };

    const handleAddResource = () => {
        const newId = 'r' + Date.now();
        const newRes = { id: newId, name: 'Nouveau Membre', dailyRate: 0, weekends: [0, 6], holidays: [] };
        updateProjectState(prev => ({ ...prev, resources: [...prev.resources, newRes] }));
        return newId;
    };

    const handleDeleteResource = (id) => {
        const isUsed = projectState.tasks.some(t => t.assignee === id);
        if (isUsed && !window.confirm(`Cette ressource est assignée à des tâches existantes.\nLes tâches resteront mais sans responsable assigné.\n\nVoulez-vous continuer ?`)) return;

        updateProjectState(prev => ({ ...prev, resources: prev.resources.filter(r => r.id !== id) }));
    };

    const handleAddTask = (type) => updateProjectState(prev => ({ ...prev, tasks: [...prev.tasks, { id: 't' + Date.now(), name: type === 'phase' ? 'Nouvelle Phase' : 'Nouvelle Tâche', type, risk: 'low', duration: type === 'milestone' ? 0 : 1, progress: 0, dependencies: [], parentId: null, assignee: prev.resources[0]?.id, manualStart: null, isExpanded: true }] }));

    const handleDeleteTask = (id) => {
        updateProjectState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id && t.parentId !== id) }));
        setUi(prev => ({ ...prev, selectedTaskId: null }));
    };

    const handleExportJSON = () => {
        const data = { tasks: projectState.tasks, resources: projectState.resources, config, version: "2.0", exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Gantt-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const handleImportJSON = (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try { const json = JSON.parse(e.target.result); if (json.tasks && Array.isArray(json.tasks)) { if (window.confirm("Écraser le projet actuel ?")) { updateProjectState({ tasks: json.tasks, resources: json.resources || INITIAL_RESOURCES }); if (json.config) setConfig(prev => ({ ...prev, ...json.config })); } } } catch { alert("Erreur import JSON"); } event.target.value = '';
        }; reader.readAsText(file);
    };

    const visibleRows = useMemo(() => {
        const rows = [];
        const traverse = (parentId) => { processedTasks.filter(t => t.parentId === parentId).forEach(t => { rows.push({ ...t, _isResource: false }); if (t.type === 'phase' && t.isExpanded) traverse(t.id); }); };
        traverse(null);
        if (ui.showHistogram && projectState.resources) {
            rows.push({ id: 'sep-1', _isSeparator: true, name: 'CHARGES & RESSOURCES' });
            projectState.resources.forEach(r => { rows.push({ id: r.id, name: r.name, _isResource: true }); });
        }
        return rows;
    }, [processedTasks, ui.showHistogram, projectState.resources]);

    const renderTimeHeader = () => {
        if (config.viewMode === 'Month') {
            const months = [];
            let currentMonth = -1;
            for (let i = 0; i < totalDays; i++) {
                const d = addDays(projectStart, i);
                if (d.getMonth() !== currentMonth) {
                    months.push({ name: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), width: 0, start: i });
                    currentMonth = d.getMonth();
                }
                months[months.length - 1].width += config.zoom;
            }
            return months.map((m, i) => (
                <div key={i} className="border-r flex justify-center items-center text-xs font-bold text-gray-600 bg-gray-50" style={{ width: m.width }}>{m.name}</div>
            ));
        }
        if (config.viewMode === 'Week') {
            const weeks = [];
            let currentWeek = -1;
            for (let i = 0; i < totalDays; i++) {
                const d = addDays(projectStart, i);
                const w = getWeekNumber(d);
                if (w !== currentWeek) {
                    weeks.push({ name: `S${w}`, width: 0 });
                    currentWeek = w;
                }
                weeks[weeks.length - 1].width += config.zoom;
            }
            return weeks.map((w, i) => (
                <div key={i} className="border-r flex justify-center items-center text-xs text-gray-600 bg-white" style={{ width: w.width }}>{w.name}</div>
            ));
        }
        return Array.from({ length: totalDays }).map((_, i) => {
            const d = addDays(projectStart, i);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (<div key={i} className={`border-r flex flex-col justify-center items-center text-[10px] flex-shrink-0 ${isWeekend ? 'bg-gray-50 text-gray-400' : 'text-gray-600'}`} style={{ width: config.zoom }}><span className="font-bold">{d.getDate()}</span> <span>{['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()]}</span></div>)
        });
    };





    // --- NOUVEAU COMPOSANT : WORKLOAD HEATMAP ---


    // --- DASHBOARD KPI EXISTANT ---


    // --- LAYOUT UNIFIÉ (CSS SCROLL) ---
    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
            <header className="bg-white border-b shadow-sm z-20 flex flex-col flex-shrink-0">
                {/* TOP BAR */}
                <div className="px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded text-white"><Activity size={20} /></div>
                        <div>
                            <input className="font-bold text-xl bg-transparent border-none focus:ring-0 p-0 text-gray-800" value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} />
                            <div className="text-xs text-gray-500 flex items-center gap-2">Début: <input type="date" value={config.startDate} onChange={e => setConfig({ ...config, startDate: e.target.value })} className="bg-transparent border-b border-dotted border-gray-400 text-xs" /></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" icon={Undo} onClick={undo} disabled={historyIndex < 0} title="Annuler"></Button>
                        <Button variant="secondary" icon={Redo} onClick={redo} disabled={historyIndex >= history.length - 2} title="Rétablir"></Button>
                        <div className="h-6 w-px bg-gray-300 mx-1"></div>
                        <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportJSON} />
                        <Button variant="ghost" icon={Download} onClick={handleExportJSON} title="Sauvegarder">Export</Button>
                        <Button variant="ghost" icon={Upload} onClick={() => fileInputRef.current.click()} title="Restaurer">Import</Button>
                        <div className="h-6 w-px bg-gray-300 mx-1"></div>

                        {/* BOUTONS WORKLOAD & KPI */}
                        <Button variant="ghost" icon={UserCheck} onClick={() => setUi(u => ({ ...u, showWorkloadModal: true }))} className={ui.showWorkloadModal ? "bg-green-50 text-green-700" : ""} title="Matrice de charge détaillée">Plan de Charge</Button>
                        <Button variant="ghost" icon={TrendingUp} onClick={() => setUi(u => ({ ...u, showDashboard: true }))} className={ui.showDashboard ? "bg-purple-50 text-purple-600" : ""} title="Indicateurs clés">KPIs</Button>

                        <Button variant="ghost" icon={Anchor} onClick={() => setUi(u => ({ ...u, showBaselineConfirm: true }))} title="Figer Baseline">Baseline</Button>
                        <Button variant="ghost" icon={BarChart2} onClick={() => setUi(u => ({ ...u, showHistogram: !u.showHistogram }))} title="Vue rapide inline" className={ui.showHistogram ? "bg-blue-50 text-blue-600" : ""}>Vue Charge</Button>

                        <button onClick={() => setUi(u => ({ ...u, showCriticalPath: !u.showCriticalPath }))} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium border transition-all ${ui.showCriticalPath ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-300 text-gray-600'}`}><Activity size={16} /> Crit. Path</button>
                        <Button variant="ghost" icon={Users} onClick={() => setUi(u => ({ ...u, showResourceModal: true }))}>Équipe</Button>
                        <div className="flex bg-gray-100 rounded p-1 gap-1">{['Day', 'Week', 'Month'].map(mode => (<button key={mode} onClick={() => setConfig(c => ({ ...c, viewMode: mode }))} className={`px-2 py-1 text-xs rounded ${config.viewMode === mode ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-200'}`}>{mode === 'Day' ? 'J' : mode === 'Week' ? 'S' : 'M'}</button>))}</div>
                        <Button variant="primary" icon={Plus} onClick={() => handleAddTask('task')}>Tâche</Button>
                        <Button variant="secondary" icon={Plus} onClick={() => handleAddTask('phase')}>Phase</Button>
                    </div>
                </div>

                {/* DASHBOARD BAR (KPIs) */}
                <div className="bg-gray-50 border-t px-4 py-2 flex gap-6 items-center text-xs border-b">
                    <div className="font-bold text-gray-500 uppercase tracking-wider mr-2">Tableau de Bord</div>

                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-100 p-1 rounded text-emerald-600"><DollarSign size={14} /></div>
                        <div>
                            <span className="block font-bold text-gray-800">{formatCurrency(projectStats.totalCost)}</span>
                            <span className="text-gray-500">Budget Estimé</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-gray-300"></div>

                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-1 rounded text-blue-600"><Clock size={14} /></div>
                        <div>
                            <span className="block font-bold text-gray-800">{projectStats.totalManDays} jours/h</span>
                            <span className="text-gray-500">Charge Totale</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-gray-300"></div>

                    <div className="flex items-center gap-2">
                        <div className="bg-purple-100 p-1 rounded text-purple-600"><PieChart size={14} /></div>
                        <div>
                            <span className="block font-bold text-gray-800">{projectStats.progress}%</span>
                            <span className="text-gray-500">Tâches Terminées</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-gray-300"></div>

                    {/* NOUVEL INDICATEUR DE PERFORMANCE (GLISSEMENT) */}
                    <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${!projectStats.hasBaseline ? 'bg-gray-100 text-gray-400' : projectStats.delayDays > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {projectStats.delayDays > 0 ? <AlertCircle size={14} /> : <Check size={14} />}
                        </div>
                        <div>
                            <span className={`block font-bold ${!projectStats.hasBaseline ? 'text-gray-400' : projectStats.delayDays > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {!projectStats.hasBaseline ? '-' : projectStats.delayDays > 0 ? `+${projectStats.delayDays} j` : '0 j'}
                            </span>
                            <span className="text-gray-500">Retard Global</span>
                        </div>
                    </div>

                </div>

            </header>

            {/* CONTENEUR PRINCIPAL SCROLLABLE */}
            <div className="flex-1 overflow-auto relative scrollbar-thin">
                <div className="min-w-max flex flex-col">

                    {/* HEADER ROW (Sticky Top) */}
                    <div className="sticky top-0 z-30 flex h-10 bg-white border-b shadow-sm">
                        {/* Left Header (Sticky Left) */}
                        <div className="w-[350px] sticky left-0 z-40 bg-gray-50 border-r flex items-center px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <div className="flex-1">Tâche / Ressource</div>
                            <div className="w-16 text-right">Durée</div>
                            <div className="w-12 text-right">%</div>
                        </div>
                        {/* Right Header */}
                        <div className="flex relative" style={{ width: canvasWidth }}>
                            {renderTimeHeader()}
                        </div>
                    </div>

                    {/* BODY ROW (Flex) */}
                    <div className="flex relative">
                        {/* Left Column (Sticky Left) */}
                        <div className="w-[350px] sticky left-0 z-20 bg-white border-r flex flex-col">
                            {visibleRows.map(row => {
                                if (row._isSeparator) return <div key={row.id} className="h-[40px] bg-gray-100 border-b border-gray-200 flex items-center px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{row.name}</div>;
                                if (row._isResource) return <div key={row.id} className="h-[40px] border-b border-gray-100 flex items-center px-4 bg-gray-50/50"><div className="flex-1 flex items-center gap-2 font-medium text-gray-700"><div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">{row.name.charAt(0)}</div>{row.name}</div></div>;
                                return (
                                    <div key={row.id} onClick={() => setUi(u => ({ ...u, selectedTaskId: row.id, showTaskModal: true }))} className={`h-[40px] border-b border-gray-100 flex items-center px-4 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${ui.selectedTaskId === row.id ? 'bg-blue-50 ring-inset ring-2 ring-blue-500' : ''}`} style={{ paddingLeft: `${(row.parentId ? 20 : 0) + 10}px` }}>
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            {row.type === 'phase' && <button onClick={(e) => { e.stopPropagation(); updateProjectState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === row.id ? { ...t, isExpanded: !t.isExpanded } : t) }), false); }} className="p-0.5 hover:bg-gray-200 rounded">{row.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}
                                            {row.type === 'milestone' && <Flag size={14} className="text-yellow-600 flex-shrink-0" />}
                                            {/* INDICATEURS DE RISQUE DANS LA LISTE */}
                                            {row.risk === 'high' && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                                            {row.risk === 'medium' && <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />}
                                            <span className={`truncate ${row.type === 'phase' ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{row.name || 'Sans nom'}</span>
                                            {row.isCritical && ui.showCriticalPath && <AlertCircle size={12} className="text-red-500 ml-1" />}
                                        </div>
                                        <div className="w-16 text-right text-gray-500 text-xs">{row.type === 'milestone' ? '-' : `${row.duration}j`}</div>
                                        <div className="w-12 text-right text-xs font-mono bg-gray-100 rounded px-1 ml-2">{row.progress}%</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Column (Chart) */}
                        <div className="relative bg-slate-50 cursor-grab active:cursor-grabbing" style={{ width: canvasWidth, height: visibleRows.length * 40 }}>
                            <div className="absolute inset-0 flex pointer-events-none">{Array.from({ length: totalDays }).map((_, i) => { const d = addDays(projectStart, i); const isWeekend = d.getDay() === 0 || d.getDay() === 6; const showLine = config.viewMode === 'Day' || (config.viewMode === 'Week' && d.getDay() === 1) || (config.viewMode === 'Month' && d.getDate() === 1); return <div key={i} className={`border-r h-full flex-shrink-0 ${isWeekend && config.viewMode === 'Day' ? 'bg-gray-100/50' : 'bg-transparent'} ${!showLine ? 'border-transparent' : 'border-gray-200'}`} style={{ width: config.zoom }}></div> })}</div>
                            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                                <defs>
                                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" /></marker>
                                    <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" /></marker>
                                    {/* PATTERN POUR RISQUE ÉLEVÉ */}
                                    <pattern id="diagonalHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                        <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: '#ef4444', strokeWidth: 2, opacity: 0.5 }} />
                                    </pattern>
                                </defs>
                                {processedTasks.map(task => {
                                    if (!visibleRows.find(r => r.id === task.id)) return null;
                                    return (task.dependencies || []).map(dep => {
                                        const parent = processedTasks.find(t => t.id === dep.id);
                                        if (!parent || !visibleRows.find(r => r.id === parent.id) || !parent.earlyFinish || !task.earlyStart) return null;
                                        let startX = (getDiffDays(projectStart, parent.earlyFinish) * config.zoom);
                                        let endX = (getDiffDays(projectStart, task.earlyStart) * config.zoom);
                                        if (dragState.isDragging && dragState.type === 'move') { const deltaPixels = dragState.currentX - dragState.startX; if (task.id === dragState.taskId) endX += deltaPixels; if (parent.id === dragState.taskId) startX += deltaPixels; }
                                        const startY = (visibleRows.findIndex(r => r.id === parent.id) * 40) + 20;
                                        const endY = (visibleRows.findIndex(r => r.id === task.id) * 40) + 20;
                                        const isCriticalLink = task.isCritical && parent.isCritical && ui.showCriticalPath;
                                        let path = endX > startX + 10 ? `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${endY} L ${endX} ${endY}` : `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${startY + 20} L ${endX - 10} ${startY + 20} L ${endX - 10} ${endY} L ${endX} ${endY}`;
                                        return <path key={`${task.id}-${dep.id}`} d={path} stroke={isCriticalLink ? '#ef4444' : '#94a3b8'} strokeWidth="2" fill="none" markerEnd={isCriticalLink ? 'url(#arrowhead-critical)' : 'url(#arrowhead)'} opacity="0.6" />;
                                    });
                                })}
                                {visibleRows.map((row, index) => {
                                    const y = index * 40;
                                    if (row._isResource) { const loads = resourceLoad[row.id] || []; return (<g key={row.id}>{loads.map((load, dayIdx) => { if (load === 0) return null; const x = dayIdx * config.zoom; const isOverloaded = load > 100; const barHeight = Math.min(30, (load / 100) * 15); return (<rect key={dayIdx} x={x + 2} y={y + 40 - barHeight - 4} width={config.zoom - 4} height={barHeight} fill={isOverloaded ? '#ef4444' : '#22c55e'} opacity="0.8" rx="2" />); })}<line x1="0" y1={y + 25} x2={canvasWidth} y2={y + 25} stroke="#e5e7eb" strokeDasharray="4 4" strokeWidth="1" /></g>); }
                                    if (row._isSeparator) return null;
                                    const task = row;
                                    if (!task.earlyStart || !task.earlyFinish) return null;
                                    const startOffset = getDiffDays(projectStart, task.earlyStart);
                                    const durationDays = getDiffDays(task.earlyStart, task.earlyFinish);
                                    let width = Math.max(2, durationDays * config.zoom);
                                    if (isNaN(width) || isNaN(startOffset)) return null;
                                    let x = startOffset * config.zoom;
                                    let baselineRect = null;
                                    if (task.baselineStart && task.baselineFinish) { const bs = new Date(task.baselineStart); const be = new Date(task.baselineFinish); const bx = getDiffDays(projectStart, bs) * config.zoom; const bwidth = Math.max(2, getDiffDays(bs, be) * config.zoom); if (!isNaN(bx)) baselineRect = (<rect x={bx} y={y + 22} width={bwidth} height={8} rx="2" fill="#cbd5e1" opacity="1" />); }
                                    const isDraggingThis = dragState.isDragging && dragState.taskId === task.id;
                                    if (isDraggingThis) { const delta = dragState.currentX - dragState.startX; if (dragState.type === 'move') x += delta; else if (dragState.type === 'resize') width = Math.max(config.zoom, width + delta); }
                                    const isCrit = task.isCritical && ui.showCriticalPath;
                                    const barHeight = 16; const barY = y + 4;

                                    // Rendu des barres
                                    if (task.type === 'phase') { return (<g key={task.id} className="pointer-events-auto">{baselineRect}<rect x={x} y={barY} width={width} height={barHeight} rx="4" fill="#e2e8f0" opacity="0.9" /><rect x={x} y={barY} width={width * (task.progress / 100)} height={barHeight} rx="4" fill="#64748b" /><path d={`M ${x} ${barY + barHeight + 4} L ${x} ${barY} L ${x + 5} ${barY}`} stroke="black" strokeWidth="1" fill="none" opacity="0.5" /><path d={`M ${x + width} ${barY + barHeight + 4} L ${x + width} ${barY} L ${x + width - 5} ${barY}`} stroke="black" strokeWidth="1" fill="none" opacity="0.5" /><text x={x + width + 5} y={y + 20} fontSize="10" fill="#475569" fontWeight="bold">{task.name}</text></g>); }
                                    if (task.type === 'milestone') { return (<g key={task.id} onMouseDown={(e) => handleMouseDown(e, task, 'move')} onClick={() => { if (!dragState.isDragging) setUi(u => ({ ...u, selectedTaskId: task.id, showTaskModal: true })) }} className="cursor-pointer pointer-events-auto hover:opacity-80">{baselineRect && <rect x={getDiffDays(projectStart, new Date(task.baselineStart)) * config.zoom - 10} y={y + 10} width={20} height={20} transform={`rotate(45 ${getDiffDays(projectStart, new Date(task.baselineStart)) * config.zoom} ${y + 20})`} fill="#cbd5e1" />}<rect x={x - 10} y={y + 10} width={20} height={20} transform={`rotate(45 ${x} ${y + 20})`} fill={isCrit ? '#ef4444' : '#f59e0b'} stroke="white" strokeWidth="2" /><text x={x + 20} y={y + 24} fontSize="11" fill="#4b5563">{task.name}</text></g>); }

                                    // Tâche Standard avec gestion du risque visuel
                                    return (
                                        <g key={task.id} onClick={() => { if (!dragState.isDragging && Math.abs(dragState.currentX - dragState.startX) < 5) setUi(u => ({ ...u, selectedTaskId: task.id, showTaskModal: true })) }} className={`pointer-events-auto ${isDraggingThis ? 'cursor-grabbing' : 'cursor-grab group'}`}>
                                            {baselineRect}
                                            <rect x={x} y={barY} width={width} height={barHeight} rx="4" fill={isCrit ? '#fca5a5' : '#bfdbfe'} stroke={isDraggingThis ? '#2563eb' : 'none'} strokeWidth="2" onMouseDown={(e) => handleMouseDown(e, task, 'move')} />
                                            {/* Hachures pour risque élevé */}
                                            {task.risk === 'high' && <rect x={x} y={barY} width={width} height={barHeight} rx="4" fill="url(#diagonalHatch)" className="pointer-events-none" />}

                                            <rect x={x} y={barY} width={width * (Number(task.progress || 0) / 100)} height={barHeight} rx="4" fill={isCrit ? '#ef4444' : '#3b82f6'} className="pointer-events-none" />

                                            {width > 50 ? <text x={x + width / 2} y={y + 16} textAnchor="middle" fontSize="11" fill={task.progress > 50 ? 'white' : '#1e3a8a'} className="select-none pointer-events-none">{task.name}</text> : <text x={x + width + 5} y={y + 16} fontSize="11" fill="#4b5563" className="select-none pointer-events-none">{task.name}</text>}
                                            <rect x={x + width - 8} y={barY} width={8} height={barHeight} fill="transparent" className="cursor-ew-resize hover:fill-black/10" onMouseDown={(e) => handleMouseDown(e, task, 'resize')} />
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            <TaskModal
                key={ui.selectedTaskId}
                isOpen={ui.showTaskModal}
                onClose={() => setUi(u => ({ ...u, showTaskModal: false }))}
                task={projectState.tasks.find(t => t.id === ui.selectedTaskId)}
                tasks={projectState.tasks}
                resources={projectState.resources}
                onUpdate={handleUpdateTask}
                onDelete={handleDeleteTask}
            />
            <ResourceModal
                isOpen={ui.showResourceModal}
                onClose={() => setUi(u => ({ ...u, showResourceModal: false }))}
                resources={projectState.resources}
                onUpdate={handleUpdateResource}
                onAdd={handleAddResource}
                onDelete={handleDeleteResource}
            />
            <DashboardModal
                isOpen={ui.showDashboard}
                onClose={() => setUi(u => ({ ...u, showDashboard: false }))}
                tasks={projectState.tasks}
                resources={projectState.resources}
                processedTasks={processedTasks}
            />
            <WorkloadModal
                isOpen={ui.showWorkloadModal}
                onClose={() => setUi(u => ({ ...u, showWorkloadModal: false }))}
                resources={projectState.resources}
                processedTasks={processedTasks}
                startDate={config.startDate}
            />
            {ui.showBaselineConfirm && (<Modal isOpen={true} onClose={() => setUi(u => ({ ...u, showBaselineConfirm: false }))} title="Confirmation Baseline"><div className="p-6"><p className="text-gray-700 mb-4">Voulez-vous figer le planning actuel comme référence ?</p><div className="bg-yellow-50 border-l-4 border-yellow-400 p-4"><div className="flex"><div className="ml-3"><p className="text-sm text-yellow-700">Cette action écrasera la référence (Baseline) précédente si elle existe.</p></div></div></div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setUi(u => ({ ...u, showBaselineConfirm: false }))}>Annuler</Button><Button variant="primary" onClick={confirmBaseline}>Confirmer</Button></div></div></Modal>)}
        </div>
    );
}