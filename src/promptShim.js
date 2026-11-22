// On-device compatibility layer for Chrome's Prompt API, found on a real Windows PC (Chrome 157, 11/22):
//  - a second open session made the next create()/prompt() hang and block every later create();
//  - after a few sessions had been created and destroyed, the next one hung the same way;
//  - non-streaming prompt() with a responseConstraint did not return where promptStreaming() did.
// So every LanguageModel.create() with the same options hands out one shared session (created once, never
// destroyed by callers), calls on it run one at a time, prompt() is served by collecting the stream, and a
// prompt that is one user message of plain text is passed as a string.
export function flattenPrompt(input) {
  if (Array.isArray(input) && input.length === 1 && input[0]?.role === "user" && Array.isArray(input[0].content) &&
      input[0].content.length > 0 && input[0].content.every((c) => c?.type === "text" && typeof c.value === "string"))
    return input[0].content.map((c) => c.value).join("\n");
  return input;
}

const optionsKey = (o) => JSON.stringify(o ?? {}, (k, v) => (typeof v === "function" || k === "signal" ? undefined : v));

export function shimLanguageModel(LM = globalThis.LanguageModel) {
  if (!LM?.create || LM.__boundaryShared) return false;
  const create = LM.create.bind(LM);
  const shared = new Map(); // options → Promise<session>
  let queue = Promise.resolve();
  const serial = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };
  LM.create = async (opts) => {
    const key = optionsKey(opts);
    if (!shared.has(key)) shared.set(key, create(opts).catch((e) => { shared.delete(key); throw e; }));
    const s = await shared.get(key);
    const ps = s.promptStreaming?.bind(s), p = s.prompt.bind(s);
    const collect = async (input, o) => { let out = ""; for await (const c of ps(flattenPrompt(input), o)) out += c; return out; };
    return {
      prompt: (input, o) => serial(() => (ps ? collect(input, o) : p(flattenPrompt(input), o))),
      promptStreaming: ps ? (input, o) => ps(flattenPrompt(input), o) : undefined,
      destroy() { /* shared session stays open for the page */ },
    };
  };
  LM.__boundaryShared = true;
  return true;
}
