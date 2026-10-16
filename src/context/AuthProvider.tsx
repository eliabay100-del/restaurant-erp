'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { logoutAction, getCurrentStaff } from '@/features/auth/actions';

interface StaffInfo {
  id: number;
  name: string;
  nameAm: string | null;
  role: string;
}

interface ShiftInfo {
  id: number;
  startTime: string;
  openingCash: number;
  status: string;
}

interface AuthContextType {
  staff: StaffInfo | null;
  shift: ShiftInfo | null;
  isAuthenticated: boolean;
  /** True once the persisted session has been restored on the client. */
  isReady: boolean;
  setStaff: (staff: StaffInfo | null) => void;
  setShift: (shift: ShiftInfo | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  staff: null,
  shift: null,
  isAuthenticated: false,
  isReady: false,
  setStaff: () => {},
  setShift: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaffState] = useState<StaffInfo | null>(null);
  const [shift, setShiftState] = useState<ShiftInfo | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load from sessionStorage on mount, falling back to the session cookie so a
  // new tab or hard refresh keeps the signed-in user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const savedStaff = sessionStorage.getItem('warka_staff');
        const savedShift = sessionStorage.getItem('warka_shift');
        if (savedStaff) {
          if (!cancelled) setStaffState(JSON.parse(savedStaff));
        } else {
          const current = await getCurrentStaff();
          if (!cancelled && current) {
            setStaffState(current);
            sessionStorage.setItem('warka_staff', JSON.stringify(current));
          }
        }
        if (savedShift && !cancelled) setShiftState(JSON.parse(savedShift));
      } catch {
        // Ignore storage errors
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setStaff = useCallback((newStaff: StaffInfo | null) => {
    setStaffState(newStaff);
    if (newStaff) {
      sessionStorage.setItem('warka_staff', JSON.stringify(newStaff));
    } else {
      sessionStorage.removeItem('warka_staff');
    }
  }, []);

  const setShift = useCallback((newShift: ShiftInfo | null) => {
    setShiftState(newShift);
    if (newShift) {
      sessionStorage.setItem('warka_shift', JSON.stringify(newShift));
    } else {
      sessionStorage.removeItem('warka_shift');
    }
  }, []);

  const logout = useCallback(() => {
    setStaffState(null);
    setShiftState(null);
    sessionStorage.removeItem('warka_staff');
    sessionStorage.removeItem('warka_shift');
    // Clear the session cookies server-side — they are httpOnly, so they cannot
    // be removed from JavaScript.
    void logoutAction();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        staff,
        shift,
        isAuthenticated: !!staff,
        isReady,
        setStaff,
        setShift,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
