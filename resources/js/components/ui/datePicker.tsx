import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const DAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const getToday = (): string => new Date().toISOString().split('T')[0];

const getDayOfWeek = (dateStr: string): number => {
    const date = new Date(dateStr + 'T00:00:00');
    return ((date.getDay() + 6) % 7) + 1;
};

export type DatePickerProps = {
    value: string;
    onChange: (date: string) => void;
    allowedDays?: Set<number>;
    placeholder?: string;
    locale?: string;
};

export const DatePicker = ({
    value,
    onChange,
    allowedDays,
    placeholder = 'Choisir une date',
}: DatePickerProps) => {
    const today = getToday();
    const todayDate = new Date(today + 'T00:00:00');
    const [viewMonth, setViewMonth] = useState(() => todayDate.getMonth());
    const [viewYear, setViewYear] = useState(() => todayDate.getFullYear());

    const isPast = (dateStr: string) => dateStr < today;
    const isValidDay = (dateStr: string) => {
        if (!allowedDays || allowedDays.size === 0) return true;
        return allowedDays.has(getDayOfWeek(dateStr));
    };

    const formatDate = (y: number, m: number, d: number): string => {
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    };

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = ((firstDayOfMonth.getDay() + 6) % 7);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{ day: number; dateStr: string; disabled: boolean }> = [];
    for (let i = 0; i < startOffset; i++) {
        cells.push({ day: 0, dateStr: '', disabled: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatDate(viewYear, viewMonth, d);
        const disabled = isPast(dateStr) || !isValidDay(dateStr);
        cells.push({ day: d, dateStr, disabled });
    }

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };
    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    const displayDate = value
        ? new Date(value + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
                >
                    {value ? displayDate : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
                <div className="flex items-center justify-between mb-2">
                    <button onClick={prevMonth} className="p-1 hover:bg-muted rounded" type="button">
                        <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm font-semibold">
                        {MONTH_LABELS[viewMonth]} {viewYear}
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-muted rounded" type="button">
                        <ChevronRight className="size-4" />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {DAY_LABELS.map((label) => (
                        <div key={label} className="text-muted-foreground py-1">{label}</div>
                    ))}
                    {cells.map((cell, idx) =>
                        cell.day === 0 ? (
                            <div key={`e-${idx}`} />
                        ) : (
                            <button
                                key={cell.dateStr}
                                type="button"
                                disabled={cell.disabled}
                                onClick={() => onChange(cell.dateStr)}
                                className={cn(
                                    'size-8 rounded text-sm',
                                    cell.disabled && 'text-muted-foreground/30 cursor-not-allowed',
                                    !cell.disabled && 'hover:bg-accent hover:text-accent-foreground',
                                    cell.dateStr === value && 'bg-primary text-primary-foreground hover:bg-primary',
                                    cell.dateStr === today && !cell.disabled && cell.dateStr !== value && 'border border-primary',
                                )}
                            >
                                {cell.day}
                            </button>
                        ),
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};
