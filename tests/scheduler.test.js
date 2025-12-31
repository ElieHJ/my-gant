
import { test } from 'node:test';
import assert from 'node:assert';
import { Scheduler } from './scheduler.js';
import { formatDateInput } from './dateUtils.js';

// Mock Resources
const resources = [
    { id: 'r1', name: 'Dev', weekends: [0, 6], holidays: [] },
    { id: 'r2', name: 'Manager', weekends: [0, 6], holidays: [] }
];

test('Scheduler - Basic Duration', () => {
    const tasks = [
        { id: 't1', name: 'Task 1', type: 'task', duration: 2, assignee: 'r1', dependencies: [], manualStart: '2025-01-01' }
    ];
    // Start Jan 1. Duration 2 Days (Jan 1, Jan 2).
    // Early Finish (Exclusive) -> Jan 3. 
    // Early Finish (Inclusive/Last Day of work) -> Jan 2.
    // The Scheduler engine returns EXCLUSIVE finish date (Jan 3).

    // We verify the ENGINE output (Jan 3).
    // The UI handles the -1 day display.

    const res = Scheduler.calculate(tasks, resources, '2025-01-01');
    const t1 = res.find(t => t.id === 't1');

    // Check using local date format to avoid Timezone confusion
    assert.strictEqual(formatDateInput(t1.earlyStart), '2025-01-01', 'Start Date should be Jan 1');
    assert.strictEqual(formatDateInput(t1.earlyFinish), '2025-01-03', 'Finish Date (Exclusive) should be Jan 3');
});

test('Scheduler - Dependencies', () => {
    const tasks = [
        { id: 't1', name: 'Task 1', type: 'task', duration: 1, assignee: 'r1', dependencies: [], manualStart: '2025-01-01' },
        { id: 't2', name: 'Task 2', type: 'task', duration: 1, assignee: 'r1', dependencies: [{ id: 't1' }] }
    ];
    // T1: Jan 1. Finish Jan 2.
    // T2: Starts Jan 2. Finish Jan 3.

    const res = Scheduler.calculate(tasks, resources, '2025-01-01');
    const t2 = res.find(t => t.id === 't2');

    assert.strictEqual(formatDateInput(t2.earlyStart), '2025-01-02', 'Task 2 should start on Jan 2');
});

test('Scheduler - Weekend Skip', () => {
    // Start Friday Jan 3. Duration 2.
    // Friday (Work). Sat (Skip). Sun (Skip). Mon (Work).
    // Finish -> Tue Jan 7 (Exclusive).

    const tasks = [
        { id: 't3', name: 'Weekend Task', type: 'task', duration: 2, assignee: 'r1', dependencies: [], manualStart: '2025-01-03' }
    ];

    const res = Scheduler.calculate(tasks, resources, '2025-01-01');
    const t3 = res.find(t => t.id === 't3');

    assert.strictEqual(formatDateInput(t3.earlyStart), '2025-01-03', 'Start Friday Jan 3');
    // Jan 3 (Fri) + Jan 6 (Mon) work.
    // Finish is Jan 7 (Tue).
    assert.strictEqual(formatDateInput(t3.earlyFinish), '2025-01-07', 'Should finish Tuesday Jan 7 (Exclusive)');
});
