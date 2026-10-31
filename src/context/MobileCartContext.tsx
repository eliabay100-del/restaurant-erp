'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface MobileCartContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileCartContext = createContext<MobileCartContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function MobileCartProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <MobileCartContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </MobileCartContext.Provider>
  );
}

export function useMobileCart() {
  return useContext(MobileCartContext);
}
