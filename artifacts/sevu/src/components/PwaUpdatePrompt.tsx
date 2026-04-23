import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { onPwaUpdate, applyPwaUpdate } from "@/lib/pwa";

export function PwaUpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    onPwaUpdate(() => setShow(true));
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 inset-x-4 z-[100] max-w-sm mx-auto animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <RefreshCw className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Update available!</p>
          <p className="text-xs opacity-80">Sevu ka naya version ready hai.</p>
        </div>
        <button
          onClick={() => {
            setShow(false);
            applyPwaUpdate();
          }}
          className="shrink-0 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
}
