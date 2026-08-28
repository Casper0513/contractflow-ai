-- AlterTable
ALTER TABLE "CrewMember" ADD COLUMN     "dailyCapacityMinutes" INTEGER;

-- AlterTable
ALTER TABLE "DispatchSettings" ADD COLUMN     "defaultCrewDailyCapacityMinutes" INTEGER NOT NULL DEFAULT 480;
