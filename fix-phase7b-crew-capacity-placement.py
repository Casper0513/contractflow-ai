from pathlib import Path

path = (
    Path.home()
    / "Desktop"
    / "contractflow-ai"
    / "apps/web/src/app/(dashboard)/jobs/[id]/job-crew-workspace.tsx"
)

text = path.read_text()

# Remove any existing CrewCapacityForm JSX block(s) so we can reinsert it safely.
block = (
    '      <CrewCapacityForm jobId={jobId} crewMember={crewMember} />\n'
)
text = text.replace(block, "")

block_multiline = (
    '      <CrewCapacityForm\n'
    '        jobId={jobId}\n'
    '        crewMember={crewMember}\n'
    '      />\n'
)
text = text.replace(block_multiline, "")

# Ensure the import exists exactly once.
import_line = 'import { CrewCapacityForm } from "./crew-capacity-form";\n'
if import_line not in text:
    marker = 'import type { JobTimeEntry } from "@/lib/job-time-entries-api";\n'
    if marker not in text:
        raise SystemExit("Could not find JobTimeEntry import marker.")
    text = text.replace(marker, marker + "\n" + import_line, 1)

# Insert only inside CrewMemberCard.
card_start = text.find("function CrewMemberCard({")
if card_start == -1:
    raise SystemExit("Could not find CrewMemberCard.")

card_end = text.find("\nfunction TimeEntryRow(", card_start)
if card_end == -1:
    raise SystemExit("Could not find end of CrewMemberCard.")

card = text[card_start:card_end]

target = (
    '      {state.error && '
    '<p className="mt-3 text-sm text-red-600">{state.error}</p>}\n'
)
if target not in card:
    raise SystemExit("Could not find CrewMemberCard state.error marker.")

capacity = (
    '      <CrewCapacityForm jobId={jobId} crewMember={crewMember} />\n\n'
)

card = card.replace(target, capacity + target, 1)

text = text[:card_start] + card + text[card_end:]

path.write_text(text)

print("Fixed CrewCapacityForm placement inside CrewMemberCard.")
print(path)
