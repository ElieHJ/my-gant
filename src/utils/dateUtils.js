export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const normalizeDate = (dateInput) => {
    if (!dateInput) return new Date();
    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const formatDateFr = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const formatDateInput = (date) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
};

export const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const getDiffDays = (start, end) => {
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / MS_PER_DAY);
};
