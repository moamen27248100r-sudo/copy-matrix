// Current time for server-rendered pages. Pages are dynamic (rendered per request), so reading the
// clock there is intended; going through this helper keeps the React "pure render" lint rule from
// flagging every such page.
export function nowMs(): number {
  return Date.now();
}
