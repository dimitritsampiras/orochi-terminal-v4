"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanResponse } from "@/lib/types/api";

export default function GateScannerPage() {
  const [scanStatus, setScanStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("Ready to scan");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const scanMutation = useMutation({
    mutationFn: async (decodedText: string) => {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decodedText }),
      });

      const data = (await res.json()) as ScanResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to verify shipment");
      }

      return data;
    },
    onSuccess: (data) => {
      setScanStatus("success");
      setMessage("Verified!");
      playSound("success");

      toast.success("Shipment Verified", {
        description: data.data ?? "Successfully scanned at gate",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      setScanStatus("error");
      setMessage(error.message);
      playSound("error");

      toast.error("Scan Failed", {
        description: error.message,
        duration: 4000,
      });
    },
    onSettled: () => {
      // Auto-resume after delay
      setTimeout(() => {
        setScanStatus("idle");
        setMessage("Ready to scan");
        isProcessingRef.current = false;
        scannerRef.current?.resume();
      }, 1500);
    },
  });

  useEffect(() => {
    const scannerId = "reader";
    const html5QrCode = new Html5Qrcode(scannerId);
    scannerRef.current = html5QrCode;

    const config = {
      fps: 20,
      aspectRatio: 1.0,
    };

    const startScanner = async () => {
      try {
        await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, undefined);
      } catch (err) {
        console.error("Error starting scanner", err);
        setMessage("Camera error. Please allow permissions.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const playSound = (type: "success" | "error") => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.value = 1000;
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.frequency.value = 300;
      osc.type = "sawtooth";
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    scannerRef.current?.pause(true);
    setScanStatus("processing");

    scanMutation.mutate(decodedText);
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        scanStatus === "success" ? "bg-green-600" : scanStatus === "error" ? "bg-red-600" : "bg-zinc-950"
      }`}
    >
      <div className="p-4 text-white text-center font-bold text-xl bg-black/20">Warehouse Gate Scanner</div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        <div className="relative w-full max-w-sm aspect-square bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
          <div id="reader" className="w-full h-full object-cover"></div>

          {scanStatus === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <div
            className={`text-2xl font-bold text-white px-6 py-3 rounded-full ${
              scanStatus === "idle" ? "bg-zinc-800" : "bg-black/20"
            }`}
          >
            {message}
          </div>

          {scanStatus === "idle" && <p className="text-zinc-400 text-sm animate-pulse">Point at a shipping label</p>}
        </div>
      </div>
    </div>
  );
}
