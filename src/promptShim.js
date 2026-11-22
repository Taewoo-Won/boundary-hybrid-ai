// 11/22, Chrome 157 on a real Windows PC: session.prompt([{ role: "user", content: [{ type: "text", value }] }],
// { responseConstraint }) stalled for minutes, while session.prompt(value, { responseConstraint }) — same text,
// same schema, same session options — answered in about 18 s. Firebase AI Logic always sends the message form,
// so a prompt that is one user message of plain text is handed to Chrome as a string. Anything else is untouched.
export function flattenPrompt(input) {
  if (Array.isArray(input) && input.length === 1 && input[0]?.role === "user" && Array.isArray(input[0].content) &&
      input[0].content.length > 0 && input[0].content.every((c) => c?.type === "text" && typeof c.value === "string"))
    return input[0].content.map((c) => c.value).join("\n");
  return input;
}

export function shimLanguageModel(LM = globalThis.LanguageModel) {
  if (!LM?.create || LM.__boundaryFlatPrompt) return false;
  const create = LM.create.bind(LM);
  LM.create = async (opts) => {
    const s = await create(opts);
    const p = s.prompt.bind(s), ps = s.promptStreaming?.bind(s);
    // Same PC: non-streaming prompt() with a responseConstraint never returned, promptStreaming() with the same
    // text and schema finished in ~18 s — so prompt() is served by collecting the stream.
    s.prompt = ps ? async (input, o) => { let out = ""; for await (const c of ps(flattenPrompt(input), o)) out += c; return out; }
                  : (input, o) => p(flattenPrompt(input), o);
    if (ps) s.promptStreaming = (input, o) => ps(flattenPrompt(input), o);
    return s;
  };
  LM.__boundaryFlatPrompt = true;
  return true;
}
