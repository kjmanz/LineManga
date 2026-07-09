import { Fragment } from "react";
import { cn } from "@/lib/cn";

export type StepperItem = {
  label: string;
  short: string;
};

type Props = {
  current: number;
  items: readonly StepperItem[];
  onSelect?: (step: number) => void;
  maxReachable?: number;
};

export function Stepper({ current, items, onSelect, maxReachable }: Props) {
  const reachable = maxReachable ?? current;

  return (
    <nav className="app-panel mt-5 p-3.5 sm:mt-6 sm:p-4" aria-label="作業手順">
      <ol className="m-0 flex w-full list-none items-start justify-center gap-0 p-0 sm:items-center">
        {items.map((item, index) => {
          const n = index + 1;
          const isCurrent = current === n;
          const isDone = current > n;
          const isLast = index === items.length - 1;
          const canJump = Boolean(onSelect) && n <= reachable && n !== current;

          return (
            <Fragment key={item.label}>
              <li className="flex min-w-0 flex-1 list-none flex-col items-center text-center sm:min-w-0">
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => onSelect?.(n)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition sm:h-9 sm:w-9 sm:text-xs",
                    isCurrent && "bg-teal-700 text-white ring-2 ring-teal-700/20 ring-offset-2 ring-offset-white",
                    isDone && !isCurrent && "bg-teal-600 text-white",
                    !isCurrent && !isDone && "border border-slate-200 bg-slate-100 text-slate-500",
                    canJump && "cursor-pointer hover:brightness-110",
                    !canJump && "cursor-default"
                  )}
                  title={item.label}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={item.label}
                >
                  {isDone && !isCurrent ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 9.5a.75.75 0 01-1.127.075l-4.5-4.25a.75.75 0 011.08-1.04l3.86 3.64 7.55-8.99a.75.75 0 011.05-.103z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    n
                  )}
                </button>
                <span
                  className={cn(
                    "mt-2 line-clamp-2 w-full max-w-[4.5rem] px-0.5 text-[10px] font-medium leading-tight sm:max-w-[7rem] sm:text-[11px]",
                    isCurrent && "text-teal-800",
                    isDone && !isCurrent && "text-slate-600",
                    !isCurrent && !isDone && "text-slate-400"
                  )}
                >
                  {item.short}
                </span>
              </li>
              {!isLast ? (
                <li
                  className="mt-[16px] flex h-0.5 w-2 list-none self-center sm:mt-[18px] sm:min-w-[0.4rem] sm:flex-1"
                  aria-hidden
                >
                  <span
                    className={cn(
                      "h-full w-full min-w-2 rounded-full transition-colors",
                      current > n ? "bg-teal-500" : "bg-slate-200"
                    )}
                  />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
