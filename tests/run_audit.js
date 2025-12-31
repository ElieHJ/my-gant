
import { Scheduler } from './scheduler.js';

// Mock Resources
const resources = [
    { id: 'r1', name: 'Dev', weekends: [0, 6], holidays: [] },
    { id: 'r2', name: 'Manager', weekends: [0, 6], holidays: [] }
];

// Mock Tasks
const tasks = [
    { id: 't1', name: 'Task 1', type: 'task', duration: 2, assignee: 'r1', dependencies: [], manualStart: '2025-01-01' },
    { id: 't2', name: 'Task 2', type: 'task', duration: 3, assignee: 'r1', dependencies: [{ id: 't1' }] }, // Should start after t1
    { id: 'm1', name: 'Milestone', type: 'milestone', duration: 0, assignee: 'r2', dependencies: [{ id: 't2' }] } // Should be at end of t2
];

console.log("=== STARTING LOGIC AUDIT ===");

try {
    const result = Scheduler.calculate(tasks, resources, '2025-01-01');

    // Verifications
    const t1 = result.find(t => t.id === 't1');
    const t2 = result.find(t => t.id === 't2');
    const m1 = result.find(t => t.id === 'm1');

    console.log(`T1 Early Start: ${t1.earlyStart.toISOString()}`);
    console.log(`T1 Early Finish: ${t1.earlyFinish.toISOString()}`);

    console.log(`T2 Early Start: ${t2.earlyStart.toISOString()}`);
    console.log(`T2 Early Finish: ${t2.earlyFinish.toISOString()}`);

    if (t2.earlyStart.getTime() === t1.earlyFinish.getTime()) {
        console.warn("WARNING: Tasks start exactly when predecessor finishes. This is standard FS link.");
    }

    console.log("=== AUDIT COMPLETE ===");
} catch (e) {
    console.error("CRITICAL ERROR IN SCHEDULER:", e);
}
