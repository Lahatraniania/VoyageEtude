export interface ProgrammeDayInfo {
    jour: number;
    isoDate: string;
    weekday: string;
    weekdayShort: string;
    dateLong: string;
    dateShort: string;
    dateFullNumeric: string;
    fullLabel: string;
    compactLabel: string;
}

const WEEKDAYS_FR = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
];

const WEEKDAYS_SHORT_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const MONTHS_FR = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
];

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

export function parseIsoDateParts(
    dateStr: string | null | undefined
): { year: number; month: number; day: number } | null {
    if (!dateStr) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr).trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const test = new Date(year, month - 1, day, 12, 0, 0);
    if (
        Number.isNaN(test.getTime()) ||
        test.getFullYear() !== year ||
        test.getMonth() !== month - 1 ||
        test.getDate() !== day
    ) {
        return null;
    }
    return { year, month, day };
}

export function addDaysToIsoDate(
    dateStr: string | null | undefined,
    daysToAdd: number
): string {
    const parts = parseIsoDateParts(dateStr);
    if (!parts) return "";
    const dt = new Date(parts.year, parts.month - 1, parts.day + daysToAdd, 12, 0, 0);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function getProgrammeDayInfo(
    dateDebut: string | null | undefined,
    jour: number
): ProgrammeDayInfo | null {
    const parts = parseIsoDateParts(dateDebut);
    if (!parts || jour < 1) return null;

    const dt = new Date(parts.year, parts.month - 1, parts.day + (jour - 1), 12, 0, 0);
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const d = dt.getDate();
    const dow = dt.getDay();

    const weekday = WEEKDAYS_FR[dow];
    const weekdayShort = WEEKDAYS_SHORT_FR[dow];
    const dateLong = `${d} ${MONTHS_FR[m]} ${y}`;
    const dateShort = `${pad2(d)}/${pad2(m + 1)}`;
    const dateFullNumeric = `${pad2(d)}/${pad2(m + 1)}/${y}`;
    const isoDate = `${y}-${pad2(m + 1)}-${pad2(d)}`;

    return {
        jour,
        isoDate,
        weekday,
        weekdayShort,
        dateLong,
        dateShort,
        dateFullNumeric,
        fullLabel: `${weekday} ${dateLong}`,
        compactLabel: `${weekdayShort} ${dateShort}`,
    };
}

export function formatIsoDateFr(dateStr: string | null | undefined): string {
    const info = getProgrammeDayInfo(dateStr, 1);
    return info ? info.fullLabel : dateStr || "";
}