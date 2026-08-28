from pathlib import Path

root = Path.home() / "Desktop" / "contractflow-ai"

schema_path = root / "packages/db/prisma/schema.prisma"
org_service_path = root / "apps/api/src/organizations/organizations.service.ts"

schema = schema_path.read_text()

old_crew = """  hourlyCostCents Int

  active Boolean @default(true)
"""
new_crew = """  hourlyCostCents Int

  dailyCapacityMinutes Int?

  active Boolean @default(true)
"""

if old_crew not in schema and "dailyCapacityMinutes Int?" not in schema:
    raise SystemExit("Could not find CrewMember insertion point in schema.prisma")

if old_crew in schema:
    schema = schema.replace(old_crew, new_crew, 1)

old_dispatch = """  defaultDurationMinutes Int @default(60)

  defaultScheduleType JobScheduleType @default(WORK)
"""
new_dispatch = """  defaultDurationMinutes Int @default(60)

  defaultScheduleType JobScheduleType @default(WORK)

  defaultCrewDailyCapacityMinutes Int @default(480)
"""

if (
    old_dispatch not in schema
    and "defaultCrewDailyCapacityMinutes Int @default(480)" not in schema
):
    raise SystemExit("Could not find DispatchSettings insertion point in schema.prisma")

if old_dispatch in schema:
    schema = schema.replace(old_dispatch, new_dispatch, 1)

schema_path.write_text(schema)

org = org_service_path.read_text()

old_default = """const DEFAULT_DISPATCH_SETTINGS = {
  defaultStartHour: 9,
  defaultStartMinute: 0,
  defaultDurationMinutes: 60,
  defaultScheduleType: JobScheduleType.WORK,
};
"""
new_default = """const DEFAULT_DISPATCH_SETTINGS = {
  defaultStartHour: 9,
  defaultStartMinute: 0,
  defaultDurationMinutes: 60,
  defaultScheduleType: JobScheduleType.WORK,
  defaultCrewDailyCapacityMinutes: 480,
};
"""

if (
    old_default not in org
    and "defaultCrewDailyCapacityMinutes: 480" not in org
):
    raise SystemExit("Could not find DEFAULT_DISPATCH_SETTINGS in organizations.service.ts")

if old_default in org:
    org = org.replace(old_default, new_default, 1)

# Add field to all DispatchSettings select blocks after defaultScheduleType.
needle = """        defaultScheduleType: true,
"""
replacement = """        defaultScheduleType: true,
        defaultCrewDailyCapacityMinutes: true,
"""

if "defaultCrewDailyCapacityMinutes: true" not in org:
    count = org.count(needle)
    if count < 3:
        raise SystemExit(
            f"Expected at least 3 dispatch select blocks, found {count}"
        )
    org = org.replace(needle, replacement)

old_next = """      defaultScheduleType:
        input.defaultScheduleType ?? current.defaultScheduleType,
    };
"""
new_next = """      defaultScheduleType:
        input.defaultScheduleType ?? current.defaultScheduleType,
      defaultCrewDailyCapacityMinutes:
        input.defaultCrewDailyCapacityMinutes ??
        current.defaultCrewDailyCapacityMinutes,
    };
"""

if (
    old_next not in org
    and "input.defaultCrewDailyCapacityMinutes" not in org
):
    raise SystemExit("Could not find dispatch next-settings block")

if old_next in org:
    org = org.replace(old_next, new_next, 1)

org_service_path.write_text(org)

print("Phase 7B schema + organizations service patches applied.")
