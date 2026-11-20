// Synthetic sample notes for the demo — invented people, example.* domains, fake numbers.
// spans = hand labels; used only in demo mode (no model connected), clearly shown as "label".
export const SAMPLES = [
  {
    text: "Visit 11/18 with Maria Lopez (DOB 1979-02-03), 14 Elm Street, Springfield. She was referred by Hope Clinic for panic attacks and is on sertraline. She asked if her daughter Ana can join the next session. Best number 555-201-4477, email maria.lopez@example.com. Next step: send her the group schedule and the sliding-scale fee form.",
    spans: [
      { cls: "NAME", value: "Maria Lopez", role: "the client, she" }, { cls: "NAME", value: "Ana", role: "the client's daughter" }, { cls: "ADDRESS", value: "14 Elm Street, Springfield", role: "home address" },
      { cls: "ORG", value: "Hope Clinic", role: "the referring clinic" }, { cls: "HEALTH", value: "panic attacks", role: "a mental-health condition" }, { cls: "HEALTH", value: "sertraline", role: "a medication" },
    ],
  },
  {
    text: "Tom Becker called about his overdue rent. He lost his job at Northgate Logistics in October and his asthma got worse over the winter. Landlord is threatening eviction from 22 Birch Road. Tom's phone is 555-310-8890. He needs a letter for the emergency rent fund by Friday.",
    spans: [
      { cls: "NAME", value: "Tom Becker", role: "the client, he" }, { cls: "NAME", value: "Tom" }, { cls: "ORG", value: "Northgate Logistics", role: "his former employer" },
      { cls: "HEALTH", value: "asthma", role: "a chronic condition" }, { cls: "ADDRESS", value: "22 Birch Road", role: "his rented home" },
    ],
  },
];
