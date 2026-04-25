import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  fromYear?: number;
  toYear?: number;
  disablePast?: boolean;
  disableFuture?: boolean;
  allowClear?: boolean;
};

function toDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const onlyDate = v.includes("T") ? v.split("T")[0] : v;
  const d = parse(onlyDate, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function toIso(d?: Date): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Choose date",
  className,
  fromYear = 1940,
  toYear = new Date().getFullYear() + 5,
  disablePast,
  disableFuture,
  allowClear = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseInp =
    "w-full px-4 py-3.5 bg-card border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-base";

  const setQuick = (d: Date) => {
    onChange(toIso(d));
    setOpen(false);
  };

  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            baseInp,
            "flex items-center justify-between gap-2 text-left",
            !selected && "text-muted-foreground/60",
            className,
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">
              {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
            </span>
          </span>
          {allowClear && selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              className="p-1 -mr-1 rounded-md hover:bg-muted shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 rounded-2xl border-2 shadow-2xl"
        align="start"
        sideOffset={6}
      >
        <div className="p-3 border-b bg-muted/30 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setQuick(today)}>
            Today
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setQuick(addDays(1))}>
            Tomorrow
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setQuick(addDays(7))}>
            +1 week
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setQuick(addDays(30))}>
            +1 month
          </Button>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(toIso(d));
            setOpen(false);
          }}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          defaultMonth={selected || today}
          disabled={
            disablePast
              ? { before: today }
              : disableFuture
                ? { after: today }
                : undefined
          }
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
