import { getCrewMembers } from "@/lib/crew-api";
import { getJobEstimates } from "@/lib/estimates-api";
import { getJobInvoices } from "@/lib/invoices-api";
import { getJobActivity } from "@/lib/job-activity-api";
import { getJobCosts, getJobCostSummary } from "@/lib/job-costs-api";
import { getJobDocuments } from "@/lib/job-documents-api";
import { getJobMaterials } from "@/lib/job-materials-api";
import { getJobNotes } from "@/lib/job-notes-api";
import { getJobPhotos } from "@/lib/job-photos-api";
import { getJobSchedules } from "@/lib/job-schedules-api";
import { getJobTasks } from "@/lib/job-tasks-api";
import { getJobTimeEntries } from "@/lib/job-time-entries-api";
import { getJob } from "@/lib/jobs-api";
import { getJobContacts } from "@/lib/job-contacts-api";

import { JobActivitySection } from "./job-activity-section";
import { JobAiSummary } from "./job-ai-summary";
import { JobCrewSection } from "./job-crew-section";
import { JobDocumentsSection } from "./job-documents-section";
import { JobEstimatesSection } from "./job-estimates-section";
import { JobFinancialsSection } from "./job-financials-section";
import { JobHeaderSection } from "./job-header-section";
import { JobInvoicesSection } from "./job-invoices-section";
import { JobMaterialsSection } from "./job-materials-section";
import { JobNotesSection } from "./job-notes-section";
import { JobOverviewSection } from "./job-overview-section";
import { JobPhotosSection } from "./job-photos-section";
import { calculateJobReadiness } from "./job-readiness";
import { JobReadinessCard } from "./job-readiness-card";
import { JobScheduleSection } from "./job-schedule-section";
import { JobStatusControl } from "./job-status-control";
import { JobTasksSection } from "./job-tasks-section";
import { JobContactsSection } from "./job-contacts-section";
import { getJobChecklists } from "@/lib/job-checklists-api";
import { JobChecklistsSection } from "./job-checklists-section";
import { getChecklistTemplates } from "@/lib/checklist-templates-api";

type JobDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobDetailsPage({ params }: JobDetailsPageProps) {
  const { id } = await params;

  const [
    job,
    jobContacts,
    jobChecklists,
    checklistTemplates,
    tasks,
    schedules,
    jobEstimates,
    jobInvoices,
    jobCosts,
    jobCostSummary,
    jobMaterials,
    crewMembers,
    jobTimeEntries,
    jobPhotos,
    jobDocuments,
    jobActivity,
    jobNotes,
  ] = await Promise.all([
    getJob(id),
    getJobContacts(id),
    getJobChecklists(id),
    getChecklistTemplates(),
    getJobTasks(id),
    getJobSchedules(id, true),
    getJobEstimates(id),
    getJobInvoices(id),
    getJobCosts(id),
    getJobCostSummary(id),
    getJobMaterials(id),
    getCrewMembers(),
    getJobTimeEntries(id),
    getJobPhotos(id),
    getJobDocuments(id),
    getJobActivity(id),
    getJobNotes(id),
  ]);

  const readiness = calculateJobReadiness({
    status: job.status,
    tasks,
    schedules,
    invoices: jobInvoices,
    checklists: jobChecklists,
  });

  return (
    <div className="space-y-8">
      <JobHeaderSection job={job} />

      <JobStatusControl
        jobId={job.id}
        customerId={job.customer.id}
        status={job.status}
        archived={Boolean(job.archivedAt)}
        readiness={readiness}
      />

      <JobReadinessCard
        jobId={job.id}
        customerId={job.customer.id}
        status={job.status}
        archived={Boolean(job.archivedAt)}
        readiness={readiness}
      />

      <JobAiSummary jobId={job.id} />

      <JobOverviewSection job={job} />

      <JobEstimatesSection
        jobId={job.id}
        customerId={job.customer.id}
        archived={Boolean(job.archivedAt)}
        estimates={jobEstimates}
      />

      <JobInvoicesSection
        jobId={job.id}
        customerId={job.customer.id}
        archived={Boolean(job.archivedAt)}
        invoices={jobInvoices}
      />

      <JobFinancialsSection
        jobId={job.id}
        costs={jobCosts}
        summary={jobCostSummary}
        currency={job.currency}
      />

      <JobScheduleSection
        jobId={job.id}
        customerId={job.customer.id}
        archived={Boolean(job.archivedAt)}
        schedules={schedules}
      />

      <JobTasksSection
        jobId={job.id}
        customerId={job.customer.id}
        archived={Boolean(job.archivedAt)}
        tasks={tasks}
      />

      <JobChecklistsSection
        jobId={job.id}
        archived={Boolean(job.archivedAt)}
        checklists={jobChecklists}
        templates={checklistTemplates}
      />

      <JobMaterialsSection
        jobId={job.id}
        archived={Boolean(job.archivedAt)}
        materials={jobMaterials}
        estimates={jobEstimates}
        invoices={jobInvoices}
        currency={job.currency}
      />

      <JobCrewSection
        jobId={job.id}
        crewMembers={crewMembers}
        timeEntries={jobTimeEntries}
        currency={job.currency}
      />

      <JobPhotosSection
        jobId={job.id}
        archived={Boolean(job.archivedAt)}
        photos={jobPhotos}
      />

      <JobDocumentsSection
        jobId={job.id}
        archived={Boolean(job.archivedAt)}
        documents={jobDocuments}
      />

      <JobNotesSection
        jobId={job.id}
        archived={Boolean(job.archivedAt)}
        notes={jobNotes}
      />

      <JobContactsSection
        jobId={job.id}
        archived={Boolean(job.archivedAt)}
        contacts={jobContacts}
      />

      <JobActivitySection activities={jobActivity} />
    </div>
  );
}
