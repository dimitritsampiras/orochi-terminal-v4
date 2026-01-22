"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Flashlight, FlashlightOff, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanResponse } from "@/lib/types/api";

export function GateScanController() {
  const [scanStatus, setScanStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("Ready to scan");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const torchFeatureRef = useRef<any>(null);
  const zoomFeatureRef = useRef<any>(null);

  const playSound = (type: "success" | "error") => {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
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
    const html5QrCode = new Html5Qrcode(scannerId, {
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    const onScanSuccess = (decodedText: string) => {
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      html5QrCode.pause(true);
      setScanStatus("processing");

      scanMutation.mutate(decodedText);
    };

    html5QrCode
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
        },
        onScanSuccess,
        undefined
      )
      .then(() => {
        // Check for torch and zoom support after camera starts
        try {
          const capabilities = html5QrCode.getRunningTrackCameraCapabilities();

          // Check torch support and store reference
          const torch = capabilities.torchFeature();
          if (torch.isSupported()) {
            torchFeatureRef.current = torch;
            setTorchSupported(true);
          }

          // Check zoom support and apply initial zoom
          const zoomFeature = capabilities.zoomFeature();
          if (zoomFeature.isSupported()) {
            zoomFeatureRef.current = zoomFeature;
            const min = zoomFeature.min();
            const max = zoomFeature.max();
            setZoomRange({ min, max });
            // Start with 2x zoom if supported
            const initialZoom = Math.min(2, max);
            setZoom(initialZoom);
            zoomFeature.apply(initialZoom);
          }
        } catch (e) {
          console.log("Camera capabilities not available", e);
        }
      })
      .catch((err) => {
        console.error("Error starting scanner", err);
        setMessage("Camera error. Please allow permissions.");
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const toggleTorch = async () => {
    if (!torchFeatureRef.current) return;
    try {
      const newValue = !torchOn;
      await torchFeatureRef.current.apply(newValue);
      setTorchOn(newValue);
    } catch (e) {
      console.error("Failed to toggle torch", e);
    }
  };

  const adjustZoom = async (delta: number) => {
    if (!zoomFeatureRef.current || !zoomRange) return;
    try {
      const newZoom = Math.max(zoomRange.min, Math.min(zoomRange.max, zoom + delta));
      await zoomFeatureRef.current.apply(newZoom);
      setZoom(newZoom);
    } catch (e) {
      console.error("Failed to adjust zoom", e);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${scanStatus === "success"
        ? "bg-green-600"
        : scanStatus === "error"
          ? "bg-red-600"
          : "bg-zinc-950"
        }`}
    >
      <div className="p-4 text-white text-center font-bold text-xl bg-black/20">
        Warehouse Gate Scanner
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        <div className="relative w-full max-w-sm aspect-square bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
          <div id="reader" className="w-full h-full" />

          {scanStatus === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Camera controls */}
        <div className="flex items-center gap-4">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-3 rounded-full transition-colors ${torchOn ? "bg-yellow-500 text-black" : "bg-zinc-800 text-white"
                }`}
            >
              {torchOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
            </button>
          )}

          {zoomRange && (
            <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-2">
              <button
                onClick={() => adjustZoom(-0.5)}
                disabled={zoom <= zoomRange.min}
                className="p-2 text-white disabled:opacity-30"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-white text-sm min-w-[3ch] text-center">
                {zoom.toFixed(1)}x
              </span>
              <button
                onClick={() => adjustZoom(0.5)}
                disabled={zoom >= zoomRange.max}
                className="p-2 text-white disabled:opacity-30"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <div
            className={`text-2xl font-bold text-white px-6 py-3 rounded-full ${scanStatus === "idle" ? "bg-zinc-800" : "bg-black/20"
              }`}
          >
            {message}
          </div>

          {scanStatus === "idle" && (
            <p className="text-zinc-400 text-sm animate-pulse">
              Point at a shipping label
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
