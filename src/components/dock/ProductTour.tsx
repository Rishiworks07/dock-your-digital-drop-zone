import { useState, useEffect, useLayoutEffect } from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle2, Clock, ShieldCheck, Users, Bell, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const STEPS = [
  {
    title: "Main Dock Space",
    content: "This is your temporary workspace. Drop files, notes, or links here for fast access.",
    icon: <Zap className="h-5 w-5 text-primary" />,
    targetId: "upload-zone",
  },
  {
    title: "24-Hour Auto Cleanup",
    content: "Everything in the main Dock is deleted after 24 hours to keep your workspace fresh.",
    icon: <Clock className="h-5 w-5 text-warning" />,
  },
  {
    title: "File Timer Logic",
    content: "Every item shows a live countdown timer so you know when it will expire.",
    icon: <Clock className="h-5 w-5 text-primary" />,
  },
  {
    title: "Private Vault",
    content: "Move important files to the Private Vault for permanent storage (200 MB limit).",
    icon: <ShieldCheck className="h-5 w-5 text-success" />,
    targetId: "vault-tab",
  },
  {
    title: "Shared Spaces",
    content: "Collaborate in Shared Spaces (up to 5 spaces) with a 1 GB total limit.",
    icon: <Users className="h-5 w-5 text-primary" />,
    targetId: "spaces-section",
  },
  {
    title: "Notifications",
    content: "Track invites and system alerts from your notification center.",
    icon: <Bell className="h-5 w-5 text-primary" />,
    targetId: "notifications-bell",
  },
  {
    title: "You're All Set!",
    content: "Start using Dock to simplify your digital workflow.",
    icon: <CheckCircle2 className="h-6 w-6 text-success" />,
  }
];

export function ProductTour({ open, onClose, userId }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cardStyle, setCardStyle] = useState<any>({ top: "50%", left: "50%", x: "-50%", y: "-50%" });

  // Reset on open
  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  // Find target element and update position
  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const step = STEPS[currentStep];
      const el = step.targetId ? document.getElementById(step.targetId) : null;

      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) return; // Not visible yet

        setSpotlight({
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height
        });

        const cardWidth = 320;
        const left = Math.max(20, Math.min(window.innerWidth - cardWidth - 20, rect.left + rect.width / 2 - cardWidth / 2));
        
        if (window.innerHeight - rect.bottom > 300) {
          setCardStyle({ top: rect.bottom + 20, left, x: 0, y: 0 });
        } else if (rect.top > 300) {
          setCardStyle({ top: rect.top - 280, left, x: 0, y: 0 });
        } else {
          setCardStyle({ top: "50%", left: "50%", x: "-50%", y: "-50%" });
        }
      } else {
        setSpotlight(null);
        setCardStyle({ top: "50%", left: "50%", x: "-50%", y: "-50%" });
      }
    };

    updatePosition();
    // Poll a few times in case of slow renders or transitions
    const timer = setInterval(updatePosition, 100);
    return () => clearInterval(timer);
  }, [currentStep, open]);

  const handleComplete = async (skipped = false) => {
    try {
      await supabase.from("profiles").update({ 
        has_seen_guide: true,
        guide_metadata: { completed_at: new Date().toISOString(), skipped }
      }).eq("user_id", userId);
    } catch (e) {
      console.error(e);
    } finally {
      onClose();
    }
  };

  if (!open) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Unified Dimming & Spotlight SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ zIndex: 101 }}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <motion.rect
                initial={false}
                animate={{
                  x: spotlight.x - 10,
                  y: spotlight.y - 10,
                  width: spotlight.w + 20,
                  height: spotlight.h + 20,
                  rx: 20,
                }}
                transition={{ type: "spring", stiffness: 150, damping: 25 }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Clickable backdrop that closes the tour on outside click */}
        <rect 
          x="0" y="0" width="100%" height="100%" 
          fill="rgba(0,0,0,0.6)" 
          mask="url(#tour-spotlight-mask)"
          className="cursor-default"
          onClick={() => handleComplete(true)}
        />
      </svg>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1, ...cardStyle }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className="absolute z-[102] w-[320px] rounded-3xl bg-card border border-border shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden pointer-events-auto"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-muted">
          <motion.div 
            className="h-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {step.icon}
                </div>
                <h2 className="text-base font-bold text-foreground tracking-tight">{step.title}</h2>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {step.content}
              </p>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => currentStep > 0 ? setCurrentStep(s => s - 1) : handleComplete(true)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {currentStep === 0 ? "Skip" : "Back"}
                </button>

                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    onClick={() => isLast ? handleComplete(false) : setCurrentStep(s => s + 1)}
                    className="bg-primary text-white h-9 rounded-xl font-bold text-xs px-6 shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    {isLast ? "Get Started" : "Next Step"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
