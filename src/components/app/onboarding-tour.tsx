import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type TourStep = {
  /** CSS selector of the element to spotlight. */
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "auto";
};

export const TOUR_STORAGE_KEY = "bc_onboarding_completed_v1";

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: "Welcome to BloodConnect 👋",
    description: "This is your dashboard. Everything important starts from here.",
    placement: "bottom",
  },
  {
    target: '[data-tour="quick-actions"]',
    title: "Quick Actions",
    description: "Request blood, donate, chat or open your profile in one tap.",
    placement: "bottom",
  },
  {
    target: '[data-tour="availability"]',
    title: "Donor Availability",
    description: "Turn this on to receive emergency alerts from people near you.",
    placement: "bottom",
  },
  {
    target: '[data-tour="nav-alerts"]',
    title: "Stay Updated 🔔",
    description: "Check alerts here for new requests and donor responses.",
    placement: "top",
  },
  {
    target: '[data-tour="nav-profile"]',
    title: "Your Profile 👤",
    description: "Manage your blood group, address and account settings here.",
    placement: "top",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;

export function OnboardingTour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setDone(false);
    }
  }, [open]);

  const measure = useCallback(() => {
    const step = steps[index];
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [index, steps]);

  useLayoutEffect(() => {
    if (!open || done) return;
    measure();
    const id = window.setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [open, done, measure]);

  // Lock scrolling while the tour is active.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      /* storage unavailable */
    }
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= steps.length) {
        setDone(true);
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, next]);

  if (!open || !mounted) return null;

  const step = steps[index];
  const spot: Rect = rect ?? {
    top: window.innerHeight / 2 - 40,
    left: 16,
    width: Math.min(window.innerWidth, 448) - 32,
    height: 80,
  };

  const placeBelow =
    step?.placement === "bottom" ||
    (step?.placement !== "top" && spot.top + spot.height < window.innerHeight * 0.55);

  const tooltipStyle = placeBelow
    ? { top: Math.min(spot.top + spot.height + PAD + 6, window.innerHeight - 210) }
    : { bottom: Math.min(window.innerHeight - spot.top + PAD + 6, window.innerHeight - 210) };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
      className="fixed inset-0 z-[100]"
      onClick={(e) => e.stopPropagation()}
    >
      {done ? (
        <div className="absolute inset-0 flex animate-fade-in items-center justify-center bg-background/95 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-primary-soft text-4xl">
              🎉
            </div>
            <h2 className="text-2xl font-extrabold">You're All Set!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Now you know your way around. Let's save lives together.
            </p>
            <Button className="mt-6 h-12 w-full text-base" onClick={finish}>
              Let's Get Started
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Dark overlay with a spotlight cut-out */}
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              boxShadow: "0 0 0 9999px oklch(0.14 0.02 265 / 72%)",
              borderRadius: 20,
              top: spot.top - PAD,
              left: spot.left - PAD,
              width: spot.width + PAD * 2,
              height: spot.height + PAD * 2,
              right: "auto",
              bottom: "auto",
              outline: "3px solid var(--color-primary)",
              outlineOffset: 2,
            }}
          />

          <div
            className="absolute left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-[0_18px_50px_oklch(0.14_0.02_265/35%)] transition-all duration-300"
            style={tooltipStyle}
          >
            <button
              type="button"
              onClick={finish}
              aria-label="Skip tour"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
            <p className="pr-8 text-base font-bold">{step?.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {step?.description}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1} / {steps.length}
                </span>
                <span className="flex gap-1.5">
                  {steps.map((s, i) => (
                    <span
                      key={s.target}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30",
                      )}
                    />
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={finish}>
                  Skip
                </Button>
                <Button size="sm" onClick={next}>
                  {index + 1 === steps.length ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

/** Returns true when the tour has never been completed on this device. */
export function shouldAutoStartTour() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) !== "true";
  } catch {
    return false;
  }
}

export function resetTour() {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
