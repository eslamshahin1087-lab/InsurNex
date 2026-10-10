"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContextString = buildContextString;
function buildContextString(ctx) {
    if (!ctx)
        return '';
    const parts = [];
    if (ctx.page)
        parts.push(`Current page: ${ctx.page}`);
    if (ctx.client) {
        parts.push(`Client context:\n${JSON.stringify(ctx.client, null, 2)}`);
    }
    if (ctx.policy) {
        parts.push(`Policy context:\n${JSON.stringify(ctx.policy, null, 2)}`);
    }
    if (ctx.claim) {
        parts.push(`Claim context:\n${JSON.stringify(ctx.claim, null, 2)}`);
    }
    if (ctx.stats) {
        parts.push(`Portfolio stats:\n${JSON.stringify(ctx.stats, null, 2)}`);
    }
    if (ctx.notes) {
        parts.push(`Additional notes from user: ${ctx.notes}`);
    }
    if (parts.length === 0)
        return '';
    return `\n\n## Current context\nThe following data is authoritative. Use it when relevant, but do not echo raw JSON.\n\n${parts.join('\n\n')}`;
}
