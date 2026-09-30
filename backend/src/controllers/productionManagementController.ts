// Controller for Production Management HTTP requests.
// Handles the request/response layer only — reads the request body, calls the
// service, and returns the same envelopes the old route returned.
// Business rules belong in productionManagementService.ts; SQL belongs in
// productionManagementRepository.ts.
//
// Logging note: request summaries, row counts and timings are preserved. The
// full SQL-text dumps the old route printed are intentionally not reproduced —
// they were debug noise and are not part of the API contract.

import type { Request, Response } from 'express';
import * as svc from '../services/productionManagementService';

function logSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logRequest(endpoint: string, body: any): void {
  console.log(`\n>> Incoming Request: ${endpoint}`);
  console.log(`   Body: ${JSON.stringify(body, null, 2)}`);
}

function logTiming(ms: number): void {
  console.log(`\n   Execution Time: ${ms}ms`);
}

// POST /production-management/calendar-events — Planned + Actual calendar events.
export async function getCalendarEvents(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCTION CALENDAR — GET CALENDAR EVENTS');
  logRequest('getCalendarEvents', req.body);

  try {
    const { date, filters } = req.body ?? {};
    const result = await svc.getCalendarEvents(date, filters ?? {});

    logTiming(Date.now() - startTime);
    console.log(`\n   Events Generated: ${result.events.length}`);
    console.log(`   Sending Response...`);
    console.log(`${'='.repeat(60)}\n`);

    return res.json({ success: true, data: { events: result.events } });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in getCalendarEvents:`);
    console.error(`   Message: ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    return res.status(500).json({ success: false, data: { events: [] }, message: 'Failed to fetch calendar events' });
  }
}

// POST /production-management/product-details — product summary with totals row.
export async function getProductDetails(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCTION CALENDAR — GET PRODUCT DETAILS');
  logRequest('getCalendarDetails', req.body);

  try {
    const { date, filters } = req.body ?? {};
    const details = await svc.getProductDetails(date, filters ?? {});

    const totplan = details.length > 0 ? Number(details[details.length - 1].totplan) || 0 : 0;
    const totact = details.length > 0 ? Number(details[details.length - 1].totact) || 0 : 0;

    logTiming(Date.now() - startTime);
    console.log(`\n   Products: ${details.length - 1}, Plan: ${totplan}, Actual: ${totact}`);
    console.log(`   Sending Response...`);
    console.log(`${'='.repeat(60)}\n`);

    return res.json({ success: true, data: details });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in getCalendarDetails:`);
    console.error(`   Message: ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    return res.status(500).json({ success: false, data: [], message: 'Failed to fetch product details' });
  }
}

// POST /production-management/monthly-summary — 12-month plan vs actual.
export async function getMonthlySummary(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCTION CALENDAR — GET MONTHLY SUMMARY');
  logRequest('getMonthlySummary', req.body);

  try {
    const { date, filters } = req.body ?? {};
    const monthly = await svc.getMonthlySummary(date, filters ?? {});

    logTiming(Date.now() - startTime);
    console.log(`\n   Monthly Points: ${monthly.length}`);
    console.log(`   Sending Response...`);
    console.log(`${'='.repeat(60)}\n`);

    return res.json({ success: true, data: monthly });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in getMonthlySummary:`);
    console.error(`   Message: ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    return res.status(500).json({ success: false, data: [], message: 'Failed to fetch monthly summary' });
  }
}

// POST /production-management/daily-details — shift-by-shift details for a day.
export async function getDailyDetails(req: Request, res: Response) {
  const startTime = Date.now();
  logSection('PRODUCTION CALENDAR — GET DAILY PRODUCTION DETAILS');
  logRequest('getDailyProdDetails', req.body);

  try {
    const { date, filters } = req.body ?? {};
    const details = await svc.getDailyDetails(date, filters ?? {});

    logTiming(Date.now() - startTime);
    console.log(`\n   Details Generated: ${details.length}`);
    console.log(`   Sending Response...`);
    console.log(`${'='.repeat(60)}\n`);

    return res.json({ success: true, data: details });
  } catch (error: any) {
    console.error(`\n   ❌ ERROR in getDailyProdDetails:`);
    console.error(`   Message: ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    return res.status(500).json({ success: false, data: [], message: 'Failed to fetch daily production details' });
  }
}
