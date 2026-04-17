/**
 * Jest E2E Test Setup
 */

// PrismaClient is managed by AppModule, don't connect manually
// This file just sets global test timeout

// Global test timeout
jest.setTimeout(30000);
