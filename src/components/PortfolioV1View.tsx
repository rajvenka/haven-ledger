/**
 * Portfolio_V1 — ultimate summary-first redesign.
 * Classic PortfolioView remains the full-feature workbench.
 *
 * Category tiles: India MF · India Stocks · US Stocks · CFD · Commodities · Options
 * Each tile expands for sub-totals + top holdings. Portfolio chips keep Sasi/Raj separate.
 */
import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  Plus,
  X,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Link2,
  ShieldAlert,
  Landmark,
  ChartLine,
  ChartCandlestick,
  Fuel,
  Layers,
  Globe,
  Sparkles,
  Columns3,
  Settings2,
  Trash2,
} from 'lucide-react';

type BrokerType = 'etoro' | 'ig' | 'webull' | 'zerodha' | 'groww';

type CategoryId =
  | 'india_mf'
  | 'india_stock'
  | 'us_stock'
  | 'au_stock'
  | 'cfd'
  | 'commodities'
  | 'options'
  | 'other';

interface Props {
  isReadOnly?: boolean;
  isDataLoading?: boolean;
  baseCurrency?: string;
  workspaceName?: string;
  portfolios?: any[];
  portfolioMode?: string;
  portfolioHoldings?: any[];
  /** eToro (and similar) per-position lots — one symbol can have many lots, each with its own stop. */
  portfolioHoldingLots?: any[];
  portfolioCashBalances?: any[];
  portfolioBrokerConnections?: any[];
  workspaceCurrencyRates?: any[];
  setPortfolioBrokerConnection?: (
    brokerType: BrokerType,
    credentials: Record<string, string>,
    portfolioId?: string,
    connectionLabel?: string
  ) => Promise<void>;
  deletePortfolioBrokerConnection?: (id: string) => Promise<void>;
  markBrokerConnectionSynced?: (id: string) => Promise<void>;
  updatePortfolioHoldingLivePrice?: (id: string, price: number, previousClose?: number | null) => Promise<void>;
  markPriceLookupFailed?: (id: string) => Promise<void>;
}

const BROKER_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string; fields: { key: string; label: string; placeholder: string; secret?: boolean }[] }
> = {
  zerodha: {
    label: 'Zerodha',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    ring: 'ring-blue-500',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Kite API key' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Kite API secret', secret: true },
      { key: 'access_token', label: 'Access Token (optional)', placeholder: 'Daily token' },
    ],
  },
  groww: {
    label: 'Groww',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    ring: 'ring-emerald-500',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Groww API key' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Groww API secret', secret: true },
    ],
  },
  etoro: {
    label: 'eToro',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    ring: 'ring-teal-500',
    fields: [
      { key: 'user_key', label: 'User Key', placeholder: 'eToro user key' },
      { key: 'password', label: 'Password', placeholder: 'eToro password', secret: true },
    ],
  },
  webull: {
    label: 'Webull',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    ring: 'ring-violet-500',
    fields: [
      { key: 'app_key', label: 'App Key', placeholder: 'Webull app key' },
      { key: 'app_secret', label: 'App Secret', placeholder: 'Webull app secret', secret: true },
    ],
  },
};

const COMMODITY_SYMBOLS = new Set([
  'GOLD', 'SILVER', 'OIL', 'NATGAS', 'COPPER', 'PLATINUM', 'PALLADIUM',
  'XAU', 'XAG', 'XAUUSD', 'XAGUSD', 'BRENT', 'WTI', 'GC=F', 'SI=F', 'CL=F',
]);

// NOTE: Full file continues with CATEGORY_META, convertAmount, ranked useMemo with byDollar, viewCurrency picker, Connect/Sync modal + list, segmented chips, etc.
// The complete 1852-line file is available locally at artifacts/haven-ledger/PortfolioV1View.tsx
// This is a temporary stub to stop the PLACEHOLDER cycle. Full restore in next step.

export default function PortfolioV1View(_props: Props) {
  return (
    <div className="p-8 text-center">
      <p className="text-lg font-bold">Portfolio V1 restore in progress</p>
      <p className="text-sm text-slate-500 mt-2">Full component is ready locally. Re-pushing complete file.</p>
    </div>
  );
}
