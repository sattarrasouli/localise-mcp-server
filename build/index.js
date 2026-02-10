#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const API_BASE = "https://localise.biz/api";
function getApiKey() {
    const key = process.env.LOCALISE_API_KEY;
    if (!key)
        throw new Error("LOCALISE_API_KEY environment variable is not set");
    return key;
}
async function locoFetch(endpoint, options = {}) {
    const { rawBody, ...fetchOptions } = options;
    const headers = {
        Authorization: `Loco ${getApiKey()}`,
        ...options.headers,
    };
    // Loco translations API expects raw string body, not JSON
    if (!rawBody) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers,
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Loco API ${res.status}: ${text}`);
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
// --- Server setup ---
const server = new McpServer({
    name: "localise-biz",
    version: "1.0.0",
});
// --- Tools ---
// 1. List all locales
server.tool("list_locales", "List all locales configured in the localise.biz project", {}, async () => {
    const locales = (await locoFetch("/locales"));
    const list = locales
        .map((l) => `${l.code} — ${l.name}`)
        .join("\n");
    return {
        content: [{ type: "text", text: `Locales (${locales.length}):\n${list}` }],
    };
});
// 2. List assets (translation keys)
server.tool("list_assets", "List all translation keys (assets) in the project", {
    filter: z
        .string()
        .optional()
        .describe("Optional text filter to search asset IDs"),
}, async ({ filter }) => {
    let endpoint = "/assets";
    if (filter)
        endpoint += `?filter=${encodeURIComponent(filter)}`;
    const assets = (await locoFetch(endpoint));
    if (assets.length === 0) {
        return { content: [{ type: "text", text: "No assets found." }] };
    }
    const list = assets.map((a) => `• ${a.id} (${a.type})`).join("\n");
    return {
        content: [{ type: "text", text: `Assets (${assets.length}):\n${list}` }],
    };
});
// 3. Create a new asset (translation key)
server.tool("create_asset", "Create a new translation key (asset) in localise.biz", {
    id: z.string().describe("Unique asset ID, e.g. 'home.welcome_title'"),
    text: z
        .string()
        .optional()
        .describe("Initial source language translation text"),
    type: z
        .enum(["text", "html", "xml"])
        .optional()
        .describe("Asset type, defaults to 'text'"),
    context: z
        .string()
        .optional()
        .describe("Context descriptor for translators"),
    notes: z.string().optional().describe("Notes for translators"),
}, async ({ id, text, type, context, notes }) => {
    const body = { id };
    if (text)
        body.text = text;
    if (type)
        body.type = type;
    if (context)
        body.context = context;
    if (notes)
        body.notes = notes;
    const result = await locoFetch("/assets", {
        method: "POST",
        body: JSON.stringify(body),
    });
    return {
        content: [
            {
                type: "text",
                text: `Asset created:\n${JSON.stringify(result, null, 2)}`,
            },
        ],
    };
});
// 4. Add or update a translation
server.tool("translate", "Add or update a translation for a specific key and locale", {
    assetId: z.string().describe("The asset/key ID, e.g. 'home.welcome_title'"),
    locale: z.string().describe("Locale code, e.g. 'fr', 'de', 'ar', 'es'"),
    translation: z.string().describe("The translated text"),
}, async ({ assetId, locale, translation }) => {
    // Loco expects the raw translation string as the POST body
    const result = await locoFetch(`/translations/${encodeURIComponent(assetId)}/${encodeURIComponent(locale)}`, {
        method: "POST",
        body: translation,
        rawBody: true,
    });
    return {
        content: [
            {
                type: "text",
                text: `Translation saved for "${assetId}" in [${locale}]:\n${JSON.stringify(result, null, 2)}`,
            },
        ],
    };
});
// 5. Get all translations for a key
server.tool("get_translations", "Get all translations for a specific asset/key across all locales", {
    assetId: z.string().describe("The asset/key ID"),
}, async ({ assetId }) => {
    const result = (await locoFetch(`/translations/${encodeURIComponent(assetId)}.json`));
    const lines = Object.entries(result)
        .map(([locale, data]) => `[${locale}] ${data.translation || "(empty)"}`)
        .join("\n");
    return {
        content: [{ type: "text", text: `Translations for "${assetId}":\n${lines}` }],
    };
});
// 6. Export a locale as JSON
server.tool("export_locale", "Export all translations for a locale as JSON", {
    locale: z.string().describe("Locale code to export, e.g. 'fr'"),
    format: z
        .enum(["json", "xml", "csv", "xliff", "po"])
        .optional()
        .describe("Export format, defaults to 'json'"),
}, async ({ locale, format }) => {
    const ext = format || "json";
    const result = await locoFetch(`/export/locale/${encodeURIComponent(locale)}.${ext}`);
    const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return {
        content: [
            {
                type: "text",
                text: `Export [${locale}] (${ext}):\n${output}`,
            },
        ],
    };
});
// 7. Batch translate — create key + add translations in one go
server.tool("batch_translate", "Create an asset and add translations for multiple locales at once", {
    id: z.string().describe("Asset ID, e.g. 'buttons.submit'"),
    sourceText: z.string().describe("Source language text"),
    translations: z
        .record(z.string())
        .describe("Object mapping locale codes to translated text, e.g. { \"fr\": \"Soumettre\", \"de\": \"Einreichen\" }"),
    context: z.string().optional().describe("Context for translators"),
}, async ({ id, sourceText, translations, context }) => {
    // Step 1: Create the asset
    const body = { id, text: sourceText };
    if (context)
        body.context = context;
    await locoFetch("/assets", {
        method: "POST",
        body: JSON.stringify(body),
    });
    // Step 2: Add each translation
    const results = [`Asset "${id}" created with source: "${sourceText}"`];
    for (const [locale, text] of Object.entries(translations)) {
        await locoFetch(`/translations/${encodeURIComponent(id)}/${encodeURIComponent(locale)}`, { method: "POST", body: text, rawBody: true });
        results.push(`  [${locale}] ${text}`);
    }
    return {
        content: [{ type: "text", text: results.join("\n") }],
    };
});
// --- Start ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("localise-biz MCP server running on stdio");
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
