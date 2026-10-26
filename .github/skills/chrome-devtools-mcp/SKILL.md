---
name: chrome-devtools-mcp
description: "Use Chrome DevTools MCP to inspect and test web pages, verify frontend changes, interact with UI, capture screenshots, and diagnose browser console or network issues."
argument-hint: "Page URL or frontend behavior to inspect"
---

# Chrome DevTools MCP

Use the available Chrome DevTools MCP tools to verify a web application's behavior in a real browser.

## When to Use

- Validate a frontend change visually or interactively.
- Reproduce a browser-only UI issue.
- Inspect page content, console errors, or network requests.
- Exercise forms and controls, or capture a screenshot for comparison.

## Procedure

1. Identify the page and behavior to verify. For local development, start the app only if it is not already running, then confirm the page is reachable before testing.
2. Check which Chrome DevTools MCP tools are available in the current session. If their definitions are deferred, search for the needed browser capability before calling a tool.
3. Open or select the intended page and navigate to the requested URL. Wait for the page to reach the expected state before interacting.
4. Inspect the rendered page using a snapshot or screenshot. Use the smallest set of interactions needed to verify the requested behavior.
5. When diagnosing errors, inspect relevant console messages and network requests. Distinguish application failures from unrelated browser or third-party messages.
6. Report what was tested, the observed result, and any remaining limitation. Do not claim a check passed if it was not exercised.

## Safe Browser Use

- Use only pages and environments the user has asked you to inspect or is authorized to test.
- Do not submit destructive actions, make purchases, send messages, or modify production data unless the user explicitly requests that action.
- Avoid printing credentials, tokens, personal data, or other sensitive values from page state, console output, or network requests.
- Prefer snapshots and targeted inspection over dumping full page or network state.
- Use browser interaction tools for normal UI workflows. Use script evaluation only for narrow, read-only inspection when ordinary tools are insufficient.
