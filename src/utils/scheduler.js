import { MS_PER_DAY, normalizeDate } from './dateUtils';

export const Scheduler = {
    isWorkingDay: (date, resourceId, resources) => {
        const day = date.getDay();
        const res = resources.find(r => r.id === resourceId);
        if (!res) return day !== 0 && day !== 6; // Par défaut : Lun-Ven

        // 1. Weekends
        if (res.weekends && res.weekends.includes(day)) return false;

        // 2. Congés / Vacances
        if (res.holidays && res.holidays.length > 0) {
            const dateStr = date.toISOString().split('T')[0];
            const isHoliday = res.holidays.some(h => dateStr >= h.start && dateStr <= h.end);
            if (isHoliday) return false;
        }

        return true;
    },

    addWorkingDays: (startDate, duration, resourceId, resources) => {
        let count = 0;
        let currentDate = new Date(startDate);

        // Si durée = 0 (Jalon), on renvoie la date telle quelle (ou ajustée si non ouvré ?)
        // Pour simplifier, un jalon tombe à une date précise, on ne décale pas forcément
        if (duration === 0) return currentDate;

        while (count < duration) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (Scheduler.isWorkingDay(currentDate, resourceId, resources)) {
                count++;
            }
        }
        return currentDate;
    },

    calculate: (tasks, resources, projectStartDateStr) => {
        const taskMap = new Map();
        const processedTasks = tasks.map(t => ({ ...t, dependencies: t.dependencies || [], children: [] }));

        processedTasks.forEach(t => taskMap.set(t.id, t));
        processedTasks.forEach(t => {
            if (t.parentId) {
                const parent = taskMap.get(t.parentId);
                if (parent) parent.children.push(t.id);
            }
        });

        const projectStartDate = normalizeDate(projectStartDateStr);

        // PASSE AVANT (Early Start / Finish)
        const visit = (id) => {
            const t = taskMap.get(id);
            if (!t) return;
            if (t._visited) return;
            t._visited = true;

            // 1. Dépendances
            let maxDepEnd = projectStartDate;
            if (t.dependencies.length > 0) {
                t.dependencies.forEach(dep => {
                    const depTask = taskMap.get(dep.id);
                    if (depTask) {
                        visit(dep.id);
                        if (depTask.earlyFinish) {
                            const depEnd = new Date(depTask.earlyFinish);
                            // Gestion du lag
                            if (dep.lag) depEnd.setDate(depEnd.getDate() + dep.lag);

                            if (depEnd > maxDepEnd) maxDepEnd = depEnd;
                        }
                    }
                });
            }

            // 2. Contraintes manuelles
            if (t.manualStart) {
                const manualDate = normalizeDate(t.manualStart);
                if (manualDate > maxDepEnd) maxDepEnd = manualDate;
            }

            // 3. Calcul
            t.earlyStart = new Date(maxDepEnd);

            if (t.type === 'phase') {
                // La phase sera calculée après ses enfants
                // On initialise temporairement
                t.earlyFinish = new Date(t.earlyStart);
            } else {
                // Tâche ou Jalon
                t.earlyFinish = Scheduler.addWorkingDays(t.earlyStart, t.duration, t.assignee, resources);
            }
        };

        processedTasks.forEach(t => visit(t.id));

        // CALCUL DES PHASES (Bottom-Up)
        // On doit s'assurer que les phases englobent leurs enfants
        const updatePhases = (parentId) => {
            if (!parentId) return;
            const parent = taskMap.get(parentId);
            if (!parent || parent.type !== 'phase') return;

            const children = processedTasks.filter(t => t.parentId === parentId);
            if (children.length > 0) {
                const minStart = new Date(Math.min(...children.map(c => c.earlyStart).filter(d => d)));
                const maxFinish = new Date(Math.max(...children.map(c => c.earlyFinish).filter(d => d)));

                parent.earlyStart = minStart;
                parent.earlyFinish = maxFinish;
                parent.duration = Math.ceil((maxFinish - minStart) / MS_PER_DAY); // Durée calendaire approx
            }
            updatePhases(parent.parentId);
        };

        processedTasks.filter(t => t.type !== 'phase').forEach(t => updatePhases(t.parentId));

        // PASSE ARRIERE
        let projectEnd = projectStartDate;
        processedTasks.forEach(t => {
            if (t.earlyFinish && t.earlyFinish > projectEnd) projectEnd = t.earlyFinish;
        });

        // Tri topologique inversé (approximatif ici via reverse simple si liste ordonnée, sinon il faudrait un vrai tri)
        // Pour simplifier, on itère sur tous les noeuds. L'idéal est un tri topologique.
        // Ici on suppose que l'ordre de définition est +/- chronologique ou on fait plusieurs passes.
        // Mais pour le Late Start, il faut partir de la fin.
        // On va utiliser une approche récursive ou itérative sur les dépendances inverses.

        // On va faire simple : on trie par date de fin early décroissante pour la passe arrière
        const sortedIds = processedTasks.sort((a, b) => (b.earlyFinish || 0) - (a.earlyFinish || 0)).map(t => t.id);

        [...sortedIds].forEach(id => {
            const t = taskMap.get(id);
            if (!t || t.type === 'phase') return;

            let lateFinish = new Date(projectEnd);
            const successors = processedTasks.filter(task => task.dependencies.some(d => d.id === id));

            if (successors.length > 0) {
                const validStarts = successors.map(s => s.lateStart ? s.lateStart.getTime() : null).filter(t => t !== null);
                if (validStarts.length > 0) lateFinish = new Date(Math.min(...validStarts));
            }

            t.lateFinish = lateFinish;
            if (t.earlyFinish) {
                const diffDays = Math.round((t.lateFinish - t.earlyFinish) / MS_PER_DAY);
                t.slack = diffDays;
                t.isCritical = t.slack <= 0;
                t.lateStart = new Date(t.earlyStart);
                t.lateStart.setDate(t.lateStart.getDate() + diffDays);
            }
        });

        const propagateCritical = (id) => {
            const t = taskMap.get(id);
            if (t && t.isCritical && t.parentId) {
                const p = taskMap.get(t.parentId);
                if (p) { p.isCritical = true; propagateCritical(p.id); }
            }
        }
        processedTasks.filter(t => t.isCritical).forEach(t => propagateCritical(t.id));

        // TRI FINAL AUTOMATIQUE
        // 1. Date de début au plus tôt (Early Start)
        // 2. Ordre de dépendance (si dates identiques, le prédécesseur avant le successeur)
        processedTasks.sort((a, b) => {
            const startA = a.earlyStart ? a.earlyStart.getTime() : 0;
            const startB = b.earlyStart ? b.earlyStart.getTime() : 0;

            // Critère 1 : Date de début
            if (startA !== startB) return startA - startB;

            // Critère 2 : Dépendance directe
            // Si A dépend de B, B doit être avant A (donc B < A, return 1)
            if (a.dependencies.some(d => d.id === b.id)) return 1;
            // Si B dépend de A, A doit être avant B (donc A < B, return -1)
            if (b.dependencies.some(d => d.id === a.id)) return -1;

            // Critère 3 : Stabilité (ID)
            return a.id.localeCompare(b.id);
        });

        return processedTasks;
    }
};
