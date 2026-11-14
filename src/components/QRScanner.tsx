import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode } from "lucide-react";

interface QRScannerProps {
  onScanSuccess: (tokenOrUrl: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>("");
  const [active, setActive] = useState<boolean>(false);

  useEffect(() => {
    const readerId = "voyagee-qr-reader";
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    let mounted = true;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (!mounted) return;
          scanner
            .stop()
            .catch(() => {})
            .finally(() => {
              onScanSuccess(decodedText);
            });
        },
        () => {}
      )
      .then(() => {
        if (mounted) setActive(true);
      })
      .catch(() => {
        if (mounted) {
          setError(
            "Impossible d'accéder à la caméra. Vérifiez les permissions du navigateur ou saisissez le jeton manuellement ci-dessous."
          );
        }
      });

    return () => {
      mounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-eni-950 border-2 border-eni-700 aspect-square flex items-center justify-center">
        <div id="voyagee-qr-reader" className="w-full h-full" />
        {!active && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-eni-200 gap-2 p-4 text-center">
            <QrCode className="w-10 h-10 text-gold-400 animate-pulse" />
            <p className="text-sm">Initialisation de la caméra...</p>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center max-w-sm">
          {error}
        </p>
      )}
    </div>
  );
};

export default QRScanner;
