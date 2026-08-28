from pathlib import Path

path = (
    Path.home()
    / "Desktop"
    / "contractflow-ai"
    / "apps/web/src/app/(dashboard)/jobs/[id]/job-crew-workspace.tsx"
)

if not path.exists():
    raise SystemExit(f"File not found: {path}")

text = path.read_text()

capacity_import = 'import { CrewCapacityForm } from "./crew-capacity-form";\n'

if capacity_import not in text:
    import_marker = 'import type { JobTimeEntry } from "@/lib/job-time-entries-api";\n'

    if import_marker not in text:
        raise SystemExit(
            "Could not find the expected JobTimeEntry import. "
            "The file may have changed from the version this patch targets."
        )

    text = text.replace(
        import_marker,
        import_marker + "\n" + capacity_import,
        1,
    )

capacity_block = (
    '      <CrewCapacityForm\n'
    '        jobId={jobId}\n'
    '        crewMember={crewMember}\n'
    '      />\n'
    '\n'
)

if "<CrewCapacityForm" not in text:
    state_error_marker = (
        '      {state.error && '
        '<p className="mt-3 text-sm text-red-600">{state.error}</p>}\n'
    )

    card_start = text.find("function CrewMemberCard({")
    if card_start == -1:
        raise SystemExit(
            "Could not find CrewMemberCard. "
            "The file may have changed from the version this patch targets."
        )

    marker_index = text.find(state_error_marker, card_start)

    if marker_index == -1:
        raise SystemExit(
            "Could not find the CrewMemberCard error block. "
            "The file may have changed from the version this patch targets."
        )

    text = text[:marker_index] + capacity_block + text[marker_index:]

path.write_text(text)

print("Phase 7B job-crew-workspace.tsx patch applied.")
print(path)
