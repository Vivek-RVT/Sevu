import { useState, useEffect } from "react";

// ── Pending customers — module-level store independent of React Query ─────────
// Customers are added here immediately on Save click and shown in the list
// right away. They're removed once the server confirms (or rejects) the save.

type PendingCustomer = {
  id: number;
  businessId: number;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  address: string | null;
  birthday: string | null;
  serviceType: string | null;
  nextServiceDate: string | null;
  notes: string | null;
  totalSpent: number;
  outstandingBalance: number;
  tags: string | null;
  createdAt: string;
};

let _pendingCustomers: PendingCustomer[] = [];
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach(fn => fn());
}

export function addPendingCustomer(customer: PendingCustomer) {
  _pendingCustomers = [customer, ..._pendingCustomers];
  _notify();
}

export function removePendingCustomer(tempId: number) {
  _pendingCustomers = _pendingCustomers.filter(c => c.id !== tempId);
  _notify();
}

export function usePendingCustomers() {
  const [list, setList] = useState<PendingCustomer[]>(() => _pendingCustomers);
  useEffect(() => {
    const listener = () => setList([..._pendingCustomers]);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);
  return list;
}

const BUSINESS_ID_KEY = "sevuBusinessId";
const AUTH_PHONE_KEY = "sevuAuthPhone";

export function useBusinessId() {
  const [businessId, setBusinessIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(BUSINESS_ID_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const setBusinessId = (id: number | null) => {
    if (id === null) {
      localStorage.removeItem(BUSINESS_ID_KEY);
    } else {
      localStorage.setItem(BUSINESS_ID_KEY, id.toString());
    }
    setBusinessIdState(id);
  };

  return { businessId, setBusinessId };
}

export function useAuthPhone() {
  const [phone, setPhoneState] = useState<string | null>(() =>
    localStorage.getItem(AUTH_PHONE_KEY)
  );

  const setPhone = (p: string | null) => {
    if (p === null) {
      localStorage.removeItem(AUTH_PHONE_KEY);
    } else {
      localStorage.setItem(AUTH_PHONE_KEY, p);
    }
    setPhoneState(p);
  };

  return { phone, setPhone };
}

/** Clear all auth state (logout) */
export function clearAuthStorage() {
  localStorage.removeItem(BUSINESS_ID_KEY);
  localStorage.removeItem(AUTH_PHONE_KEY);
  localStorage.removeItem("sevuAuthToken");
}
