'use client';

import { create } from 'zustand';
import type { Driver, Invoice, Route, RouteStop } from '@/types';

interface DriverSession {
  driver: Driver | null;
  setDriver: (d: Driver | null) => void;
}

export const useDriverStore = create<DriverSession>((set) => ({
  driver: null,
  setDriver: (driver) => set({ driver }),
}));

interface RouteBuilderState {
  unassigned: Invoice[];
  routes: Record<string, { route: Route; stops: (RouteStop & { invoice: Invoice })[] }>;
  setUnassigned: (invoices: Invoice[]) => void;
  setRoutes: (routes: Record<string, { route: Route; stops: (RouteStop & { invoice: Invoice })[] }>) => void;
  moveInvoice: (invoiceId: string, toDriverId: string, toIndex: number) => void;
  removeFromRoute: (invoiceId: string, fromDriverId: string) => void;
}

export const useRouteBuilder = create<RouteBuilderState>((set) => ({
  unassigned: [],
  routes: {},
  setUnassigned: (unassigned) => set({ unassigned }),
  setRoutes: (routes) => set({ routes }),
  moveInvoice: (invoiceId, toDriverId, toIndex) =>
    set((state) => {
      const newState = { ...state };
      // Remove from unassigned
      newState.unassigned = state.unassigned.filter((i) => i.id !== invoiceId);
      // Remove from any existing route
      for (const dId of Object.keys(newState.routes)) {
        newState.routes[dId] = {
          ...state.routes[dId],
          stops: state.routes[dId].stops.filter((s) => s.invoice_id !== invoiceId),
        };
      }
      // Find the invoice
      let invoice = state.unassigned.find((i) => i.id === invoiceId);
      if (!invoice) {
        for (const dId of Object.keys(state.routes)) {
          const stop = state.routes[dId].stops.find((s) => s.invoice_id === invoiceId);
          if (stop) {
            invoice = stop.invoice;
            break;
          }
        }
      }
      if (!invoice) return state;
      // Add to target route
      const targetRoute = newState.routes[toDriverId];
      if (targetRoute) {
        const newStop: RouteStop & { invoice: Invoice } = {
          id: `temp-${invoiceId}`,
          route_id: targetRoute.route.id,
          invoice_id: invoiceId,
          stop_order: toIndex,
          status: 'pending',
          signature_storage_path: null,
          photo_storage_path: null,
          pod_pdf_storage_path: null,
          google_drive_file_id: null,
          completed_at: null,
          arrived_at: null,
          departed_at: null,
          dwell_seconds: null,
          gps_lat: null,
          gps_lng: null,
          stop_type: invoice.ticket_type || 'delivery',
          notes: null,
          invoice,
        };
        const stops = [...targetRoute.stops];
        stops.splice(toIndex, 0, newStop);
        // Re-number
        stops.forEach((s, i) => (s.stop_order = i + 1));
        newState.routes[toDriverId] = { ...targetRoute, stops };
      }
      return newState;
    }),
  removeFromRoute: (invoiceId, fromDriverId) =>
    set((state) => {
      const route = state.routes[fromDriverId];
      if (!route) return state;
      const stop = route.stops.find((s) => s.invoice_id === invoiceId);
      const newStops = route.stops.filter((s) => s.invoice_id !== invoiceId);
      newStops.forEach((s, i) => (s.stop_order = i + 1));
      return {
        routes: { ...state.routes, [fromDriverId]: { ...route, stops: newStops } },
        unassigned: stop ? [...state.unassigned, stop.invoice] : state.unassigned,
      };
    }),
}));
