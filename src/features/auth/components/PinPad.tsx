'use client';

import { useState, useCallback } from 'react';
import Icon from '@/components/shared/Icon';

interface PinPadProps {
  onSubmit: (pin: string) => void;
  error?: string;
  loading?: boolean;
  maxLength?: number;
}

export default function PinPad({ onSubmit, error, loading, maxLength = 4 }: PinPadProps) {
  const [pin, setPin] = useState('');

  const handleKey = useCallback((key: string) => {
    if (loading) return;
    if (key === 'backspace') {
      setPin((p) => p.slice(0, -1));
    } else if (key === 'enter') {
      if (pin.length >= maxLength) onSubmit(pin);
    } else if (pin.length < maxLength) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === maxLength) {
        setTimeout(() => onSubmit(newPin), 200);
      }
    }
  }, [pin, loading, maxLength, onSubmit]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', '0', 'enter'];

  return (
    <div>
      {/* PIN dots display */}
      <div className="pin-display">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>

      {error && <div className="pin-error">{error}</div>}

      {/* Numpad grid */}
      <div className="pin-grid">
        {keys.map((key) => (
          <button
            key={key}
            className={`pin-key ${key === 'enter' ? 'enter' : ''} ${key === 'backspace' || key === 'enter' ? 'action' : ''}`}
            onClick={() => handleKey(key)}
            disabled={loading}
            aria-label={key === 'backspace' ? 'Backspace' : key === 'enter' ? 'Enter' : key}
          >
            {key === 'backspace' ? <Icon name="backspace" size={24} /> : key === 'enter' ? <Icon name="arrowRight" size={24} /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
