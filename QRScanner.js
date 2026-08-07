import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QrCode, X } from 'lucide-react';

function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState(null);

  const handleScan = (result) => {
    if (result && result[0]?.rawValue) {
      onScan(result[0].rawValue);
    }
  };

  const handleError = (err) => {
    console.error('Scanner error:', err);
    if (err?.message?.includes('Permission denied') || err?.name === 'NotAllowedError') {
      setError('Camera access denied. Please allow camera access.');
    } else if (err?.message?.includes('no camera') || err?.name === 'NotFoundError') {
      setError('No camera found on this device.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black p-4 flex items-center justify-between safe-area-top">
        <h3 className="text-white text-lg font-semibold flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Scan QR Code
        </h3>
        <button 
          onClick={onClose}
          className="text-white p-2 hover:bg-white/20 rounded-full"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      
      {/* Camera View */}
      <div className="flex-1 relative bg-black">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-6">
              <div className="bg-red-500/20 text-red-200 p-4 rounded-lg mb-4">
                {error}
              </div>
              <button 
                onClick={onClose} 
                className="px-6 py-2 border border-white text-white rounded-lg hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <Scanner
            onScan={handleScan}
            onError={handleError}
            constraints={{
              facingMode: 'environment'  // Always use back camera
            }}
            styles={{
              container: { width: '100%', height: '100%' },
              video: { width: '100%', height: '100%', objectFit: 'cover' }
            }}
            components={{
              audio: false,
              torch: false,  // No flash toggle
              zoom: false,   // No zoom controls
              finder: true   // Show scan area box
            }}
          />
        )}
      </div>
      
      {/* Footer */}
      <div className="bg-black p-4 text-center safe-area-bottom">
        <p className="text-white/70 text-sm">
          Point camera at the QR code
        </p>
      </div>
    </div>
  );
}

export default QRScanner;
