import { Fragment } from "react";
import { cn } from "@/lib/cn";

export type StepperItem = {
  label: string;
  short: string;
};

type Props = {
  current: number;
  items: readonly StepperItem[];
};

export function Stepper({ current, items }: Props) {
  return (
    <nav className="app-stepper app-panel mt-4 p-4 sm:p-5" aria-label="作業手順">
      <ol className="m-0 flex w-full list-none items-start justify-center gap-0 p-0 sm:items-center">
        {items.map((item, index) => {
          const n = index + 1;
          const isCurrent = current === n;
          const isDone = current > n;
          const isLast = index === items.length - 1;

          return (
            <Fragment key={item.label}>
              <li className="flex min-w-0 flex-1 list-none flex-col items-center text-center sm:min-w-0">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums shadow-sm transition",
                    isCurrent &&
                      "bg-brand-500 text-white ring-2 ring-brand-200/80 ring-offset-2 ring-offset-white",
                    isDone && !isCurrent && "bg-emerald-500 text-white",
                    !isCurrent && !isDone && "border border-slate-200/90 bg-slate-50 text-slate-500"
                  )}
                  title={item.label}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone && !isCurrent ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
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
                </span>
                <span
                  className={cn(
                    "mt-2 line-clamp-2 w-full max-w-[4.2rem] px-0.5 text-[10px] font-medium leading-tight sm:max-w-[6.5rem] sm:text-xs",
                    isCurrent && "text-brand-800",
                    isDone && !isCurrent && "text-emerald-800",
                    !isCurrent && !isDone && "text-slate-500"
                  )}
                >
                  {item.short}
                </span>
              </li>
              {!isLast ? (
                <li
                  className="mt-[18px] flex h-0.5 w-2 list-none self-center sm:mt-5 sm:min-w-[0.4rem] sm:flex-1"
                  aria-hidden
                >
                  <span
                    className={cn(
                      "h-full w-full min-w-2 rounded-full transition-colors",
                      current > n ? "bg-emerald-300" : "bg-slate-200"
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
